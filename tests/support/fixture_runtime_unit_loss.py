"""Actual native work under a finite Runtime unit; independent guard and stop-only recovery."""

import errno,hashlib,json,os,signal,subprocess,time
from contextlib import contextmanager
from pathlib import Path

@contextmanager
def frozen_process(pid):
    """Hold this exact fixture process until a negative shutdown assertion completes."""
    assert pid > 0
    fd = os.pidfd_open(pid)
    stopped = False
    try:
        signal.pidfd_send_signal(fd, signal.SIGSTOP)
        stopped = True
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            state = next(line for line in Path('/proc', str(pid), 'status').read_text().splitlines()
                         if line.startswith('State:')).split()[1]
            if state == 'T':
                break
            time.sleep(.01)
        else:
            raise AssertionError('fixture Runtime did not reach the stopped-process barrier')
        yield
    finally:
        try:
            if stopped:
                signal.pidfd_send_signal(fd, signal.SIGCONT)
        finally:
            os.close(fd)


def start(binary,config,unit,log,env,rendered=False):
    if rendered:return start_rendered(binary,config,unit,env)
    return subprocess.Popen(['/usr/bin/systemd-run','--quiet','--pipe','--wait','--collect','--service-type=exec',
        '--unit='+unit,'--property=Restart=no','--property=KillMode=control-group',
        '--property=RuntimeMaxSec=90s','--property=MemoryMax=536870912','--property=TasksMax=128',
        '--property=NoNewPrivileges=yes',str(binary/'ouroboros-runtime'),'--config',str(config)],
        stdout=log,stderr=log,env=env)

def verify(context,unit,graceful=False):
    c=context;root=c['root'];fixture=c['fixture'];runtime=c['runtime'];cli=c['cli'];run=c['run'];query=c['query'];db=c['db']
    def main_pid(name):return int(run(['/usr/bin/systemctl','show',name,'--property=MainPID','--value']).strip())
    def inspect(cid):return json.loads(run(['docker','inspect',cid]))[0]
    for _ in range(150):
        state=cli('get','executions',c['accepted']['resource_id'])
        if state['instance_id'] and state.get('native_turn'):
            evidence=root/'runtime'/state['instance_id']
            record=evidence/'container.json'
            if record.exists():
                cid=json.loads(record.read_text())['container_id']
                result=subprocess.run(fixture.docker('exec','--user','65532:65532',cid,'test','-f','/workspace/runtime-loss-ready'),env=c['child_env'],capture_output=True,timeout=2)
                if result.returncode==0:break
        assert runtime.poll() is None
        time.sleep(.1)
    else:raise AssertionError('native work did not reach the unit-loss barrier')
    guard=json.loads((evidence/'guard-binding.json').read_text())
    assert guard['backend']=='systemd' and guard['instance_id']==state['instance_id']
    deadline=guard['deadline_boottime_ns'];guard_pid=guard['identity']['pid']
    pid=inspect(cid)['State']['Pid'];assert pid>0 and main_pid(guard['unit'])==guard_pid
    private_cgroup=Path('/sys/fs/cgroup')/Path(Path('/proc',str(pid),'cgroup').read_text().split('0::',1)[1].strip()).relative_to('/')
    events=os.open(private_cgroup/'cgroup.events',os.O_RDONLY)
    guard_group=Path('/proc',str(guard_pid),'cgroup').read_text()
    runtime_group=Path('/proc',str(main_pid(unit)),'cgroup').read_text()
    if getattr(runtime,'rendered',False):
        binding=json.loads((evidence/'binding.json').read_text())
        for observed_pid,uid,capabilities,ambient in [(main_pid(unit),0,0x2800e2,0x80),(binding['peer']['pid'],c['runtime_values']['bridge_uid'],0,0)]:
            fields=dict(line.split(':',1) for line in Path('/proc',str(observed_pid),'status').read_text().splitlines() if ':' in line)
            assert set(fields['Uid'].split())=={str(uid)} and fields['NoNewPrivs'].strip()=='1'
            assert int(fields['CapEff'].strip(),16)==capabilities and int(fields['CapAmb'].strip(),16)==ambient

    assert guard_group!=runtime_group and unit in runtime_group
    supervisor_cgroup=Path('/sys/fs/cgroup')/Path(runtime_group.split('0::',1)[1].strip()).relative_to('/')
    supervisor_events=os.open(supervisor_cgroup/'cgroup.events',os.O_RDONLY)
    def empty_fd(fd):
        try:return b'populated 0' in os.pread(fd,4096,0)
        except OSError as error:
            if error.errno!=errno.ENODEV:raise
            return True
    rows=query('SELECT count(*) FROM results',c['resource_dbs']['company']);assert rows=='1'
    reservations=query('SELECT committed FROM limits WHERE id=\'compute\'',db)
    try:
        if graceful:
            if getattr(runtime,'rendered',False) and (root/'installed-service-bundle.json').exists():
                from tests.support.fixture_service_units import stop_phase
                stop_phase(c['binary'],root,'runtime',c['control'],reject='separately authorized admission pause required')
                current=cli('request','GET','/environment/status/'+c['control'])
                pause=root/'cli/host-maintenance-pause.json'
                c['write'](pause,json.dumps({'delegation_id':c['control'],'expected_revision':current['revision'],'paused':True,'reason':'Bounded fixture host shutdown'}),70003)
                # Admission pause also interrupts work. Hold only the supervisor so completion
                # cannot clear the unresolved record before the negative control-stop request.
                # The independent guard keeps running; the pidfd prevents signaling a successor.
                with frozen_process(main_pid(unit)):
                    cli('request','POST','/environment/admission','--input',str(pause),'--key','host-maintenance-pause')
                    pending=cli('request','GET','/environment/status/'+c['control'])
                    assert pending['instances_without_termination']>0
                    stop_phase(c['binary'],root,'control',c['control'],reject='unresolved execution/effect records')
                result=stop_phase(c['binary'],root,'runtime',c['control'])
                assert result['status']=='phase_stopped' and not result['obligations_settled']
            elif getattr(runtime,'rendered',False):runtime.terminate()
            else:subprocess.run(['/usr/bin/systemctl','kill','--signal=SIGTERM','--kill-whom=main',unit],env=c['child_env'],check=True,capture_output=True,timeout=5)
            assert runtime.wait(timeout=15)!=0 # interruption is not a successful native task
            assert time.clock_gettime_ns(time.CLOCK_BOOTTIME)<deadline
            assert empty_fd(events) and empty_fd(supervisor_events)
            assert main_pid(unit)==0 and main_pid(guard['unit'])==0 and not inspect(cid)['State']['Running']
            stop_request=evidence/'stop-request.json'
            if (root/'installed-service-bundle.json').exists():
                # Admission pause can already interrupt native work before SIGTERM is observed.
                finish=json.loads((evidence/'finish.json').read_text())
                assert finish['terminated_observed'] and not finish['runtime_success']
                stopped=json.loads((root/'product-stop-runtime.json').read_text())
                records=list((root/'installation-receipts').glob('stop-'+stopped['operation_id']+'.*.observed.json'))
                assert records and all(json.loads(p.read_text())['unit_cgroup_empty'] for p in records)
            else:assert stop_request.exists()
            if stop_request.exists():assert json.loads(stop_request.read_text())['source']=='host_signal'
            assert json.loads((evidence/'guard-closure.json').read_text())['deadline_boottime_ns']==deadline
            assert json.loads((evidence/'allocation-observation.json').read_text())['guard_terminated']
            assert cli('get','executions',c['accepted']['resource_id'])['terminated']
            assert query('SELECT count(*) FROM results',c['resource_dbs']['company'])==rows
            assert query("SELECT committed FROM limits WHERE id='compute'",db)=='0'
            assert query('SELECT count(*) FROM compute_returns',db)=='1'
            assert query('SELECT count(*) FROM executions',db)=='1'
            # A fresh bounded worker with no pending work must stop without claiming a successor.
            idle_log=root/'idle-stop.log'
            with idle_log.open('xb') as output:
                idle=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),
                    '--max-executions','2','--idle-timeout-seconds','30'],env=c['child_env'],stdout=output,stderr=output)
                try:
                    for _ in range(100):
                        assert idle.poll() is None
                        status=Path('/proc',str(idle.pid),'status').read_text()
                        mask=int(next(line.split()[1] for line in status.splitlines() if line.startswith('SigCgt:')),16)
                        if mask & (1 << (15-1)):break
                        time.sleep(.01)
                    else:raise AssertionError('idle worker did not register stop handling')
                    idle.terminate()
                    assert idle.wait(timeout=10)==0
                finally:
                    if idle.poll() is None:idle.kill();idle.wait(timeout=5)
            assert 'stop_requested' in idle_log.read_text()
            assert query('SELECT count(*) FROM executions',db)=='1'
            assert query('SELECT count(*) FROM compute_returns',db)=='1'
            return {'result':'PASS','scenario':'native-runtime-graceful-stop','signal':'SIGTERM','host_signal_observed':stop_request.exists(),
                    'contained_before_deadline':True,'protected_closure_persisted':True,'compute_return_once':True,'idle_stop_without_claim':True,'rendered_service':getattr(runtime,'rendered',False),
                    'company_rows':int(rows),'new_execution':False,'subscription':'NOT RUN'}
        kill_request=subprocess.run(['/usr/bin/systemctl','kill','--signal=SIGKILL','--kill-whom=all',unit],env=c['child_env'],capture_output=True,timeout=10)
        # A failed control command may already have signalled processes. Observe the original
        # cgroup before deciding whether termination happened; never retry the kill blindly.
        assert runtime.wait(timeout=10)!=0
        for _ in range(30):
            if empty_fd(supervisor_events):break
            time.sleep(.1)
        else:raise AssertionError('original Runtime unit cgroup is not empty')
        assert main_pid(unit)==0 and main_pid(guard['unit'])==guard_pid
        assert time.clock_gettime_ns(time.CLOCK_BOOTTIME)<deadline and inspect(cid)['State']['Running']
        # The observing test retains its original read-only events FD; it never signals the target.
        while time.clock_gettime_ns(time.CLOCK_BOOTTIME)<deadline+3_000_000_000:
            if empty_fd(events):break
            time.sleep(.1)
        else:raise AssertionError('original target remained populated after guard deadline')
        assert time.clock_gettime_ns(time.CLOCK_BOOTTIME)>=deadline
        for _ in range(30):
            if not inspect(cid)['State']['Running'] and main_pid(guard['unit'])==0:break
            time.sleep(.1)
        else:raise AssertionError('guard/backend termination not observed')
        assert not (evidence/'compute-return.json').exists()
        receipt=evidence/'guard-closure.json';saved=evidence/'guard-closure.withheld'
        assert receipt.exists() and receipt.stat().st_size>0
        pending=root/'runtime/pending-claim.json'
        original_pending=pending.read_bytes()
        receipt.rename(saved)
        try:
            # Termination without original closure cannot resolve the durable claim.
            # The CLI must report incomplete recovery, not release the worker slot.
            incomplete=subprocess.run([str(c['binary']/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],env=c['child_env'],capture_output=True,timeout=15)
            assert incomplete.returncode!=0 and b'original Runtime claim remains unresolved' in incomplete.stderr
            assert pending.read_bytes()==original_pending
            assert query('SELECT committed FROM limits WHERE id=\'compute\'',db)==reservations
            assert query('SELECT count(*) FROM compute_returns',db)=='0'
        finally:saved.rename(receipt)
        original=receipt.read_bytes()
        altered=json.loads(original);altered['deadline_boottime_ns']+=1
        receipt.write_text(json.dumps(altered)+'\n')
        try:
            refused=subprocess.run([str(c['binary']/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],env=c['child_env'],capture_output=True,timeout=15)
            assert refused.returncode!=0
            assert query('SELECT committed FROM limits WHERE id=\'compute\'',db)==reservations
            assert query('SELECT count(*) FROM compute_returns',db)=='0'
        finally:receipt.write_bytes(original)
        reconciliation=json.loads(run([str(c['binary']/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],timeout=15))
        assert reconciliation['guard']['state'] in ['gone','pid_reused']
        assert not reconciliation['guard']['capacity_returned']
        recovered=cli('get','executions',c['accepted']['resource_id'])
        assert recovered['terminated'] and query('SELECT count(*) FROM results',c['resource_dbs']['company'])==rows
        assert query('SELECT committed FROM limits WHERE id=\'compute\'',db)=='0'
        assert query('SELECT count(*) FROM compute_returns',db)=='1'
        assert not pending.exists()
        run([str(c['binary']/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],timeout=15)
        assert query('SELECT count(*) FROM compute_returns',db)=='1'
        assert query('SELECT count(*) FROM executions',db)=='1'
        return {'result':'PASS','scenario':'native-runtime-unit-loss','instance_id':state['instance_id'],
                'native_turn':state['native_turn'],'runtime_unit_killed':True,'runtime_cgroup_empty':True,
                'kill_command_exit':kill_request.returncode,'independent_guard_survived':True,
                'original_deadline_preserved':True,'target_empty':True,'stop_only_reconciliation':True,
                'original_company_rows':int(rows),'reservation_preserved_without_evidence':True,'mismatched_guard_receipt_denied':True,'capacity_returned_once':True,
                'guard_reconciliation':reconciliation['guard'],'new_execution':False,'subscription':'NOT RUN','compute_return_reconstruction':'PASS'}
    finally:os.close(events);os.close(supervisor_events)


def start_rendered(binary,config,unit,env):
    from tests.support.fixture_service_units import Unit,ctl
    class RuntimeUnit(Unit):
        rendered=True
        def kill(self):ctl('kill','--signal=SIGKILL','--kill-whom=all',self.name)
        def wait(self,timeout=15):return super().wait(timeout)
    root=config.parent.parent
    values=json.loads(config.read_text())
    # A required managed guard must reject a direct-child configuration before any claim.
    rejected=root/'runtime-direct-rejected.json'
    direct=dict(values);direct.pop('managed_guard');rejected.write_text(json.dumps(direct));rejected.chmod(0o600)
    probe=subprocess.run([str(binary/'ouroboros-runtime'),'--config',str(rejected),'--require-managed-guard'],env=env,capture_output=True,timeout=5)
    assert probe.returncode!=0 and b'direct-child fallback refused' in probe.stderr
    spec_path=prepare_spec(binary,config)
    content=subprocess.run([str(binary/'ouroboros-service-unit'),'--spec',str(spec_path)],env=env,capture_output=True,check=True,timeout=5).stdout
    bundled=(root/'installed-service-bundle.json').exists()
    if not bundled:assert 'LoadState=not-found' in ctl('show',unit,'--property=LoadState')
    destination=Path('/run/systemd/system')/unit
    receipt=root/'runtime-service-unit.json'
    receipt.write_text(json.dumps({'unit':unit,'sha256':hashlib.sha256(content).hexdigest()}));receipt.chmod(0o600)
    if bundled:
        installed=json.loads((root/'installed-service-bundle.json').read_text())
        assert unit==installed['runtime_unit']
        assert destination.read_bytes()==content and not destination.is_symlink()
    else:
        fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o644)
        with os.fdopen(fd,'wb') as output:output.write(content);output.flush();os.fsync(output.fileno())
    subprocess.run(['/usr/bin/systemd-analyze','verify',str(destination)],capture_output=True,check=True,timeout=10)
    if bundled:
        from tests.support.fixture_service_units import start_phase
        applied=start_phase(binary,root,'runtime')
        assert applied['phase']=='runtime' and applied['authority_granted'] is False
    else:ctl('daemon-reload');ctl('start',unit)
    properties=dict(line.split('=',1) for line in ctl('show',unit,'--property=KillMode,Restart,MemoryMax,TasksMax,User').splitlines())
    assert properties=={'KillMode':'mixed','Restart':'no','MemoryMax':'536870912','TasksMax':'128','User':'0'}
    return RuntimeUnit(unit)


def close_rendered(root,unit):
    from tests.support.fixture_service_units import ctl
    receipt=root/'runtime-service-unit.json'
    if not receipt.exists():return
    if (root/'installed-service-bundle.json').exists():return # whole-bundle cleanup owns this file
    expected=json.loads(receipt.read_text());assert expected['unit']==unit
    destination=Path('/run/systemd/system')/unit
    assert 'MainPID=0' in ctl('show',unit,'--property=MainPID')
    if destination.exists():
        assert not destination.is_symlink() and hashlib.sha256(destination.read_bytes()).hexdigest()==expected['sha256']
        destination.unlink();ctl('daemon-reload')


def prepare_spec(binary,config):
    root=config.parent.parent
    values=json.loads(config.read_text())
    launch=root/'runtime-launch.json'
    encoded=json.dumps(values)
    if launch.exists():assert launch.read_text()==encoded
    else:launch.write_text(encoded);launch.chmod(0o600)
    spec={'role':'runtime','binary_directory':str(binary),'config':str(launch),'uid':0,'gid':0,
          'writable_directories':[str(config.parent)],'memory_max_bytes':536870912,'tasks_max':128,
          'stop_timeout_seconds':15,'worker':{'max_executions':2,'idle_timeout_seconds':30,'lifetime_seconds':90}}
    spec_path=root/'runtime-service-spec.json';spec_path.write_text(json.dumps(spec));spec_path.chmod(0o600)
    return spec_path
