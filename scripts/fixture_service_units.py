"""Bounded qualification of rendered units in the selected disposable Linux guest."""
import grp,hashlib,json,os,pwd,re,subprocess,time
from pathlib import Path

def ctl(*args):
    return subprocess.run(['/usr/bin/systemctl',*args],capture_output=True,check=True,timeout=15).stdout.decode()

def accounts():
    created=[]
    try:
        for uid in [70001,70002,70004,70005,70006]:
            try:pwd.getpwuid(uid)
            except KeyError:pass
            else:continue
            name='ouroboros-fixture-'+str(uid)
            try:grp.getgrgid(uid)
            except KeyError:
                subprocess.run(['/usr/sbin/groupadd','--gid',str(uid),name],check=True,capture_output=True,timeout=5)
                created.append(('group',name,uid))
            subprocess.run(['/usr/sbin/useradd','--no-log-init','--no-create-home','--no-user-group','--uid',str(uid),'--gid',str(uid),'--home-dir','/nonexistent','--shell','/usr/sbin/nologin',name],check=True,capture_output=True,timeout=5)
            created.append(('user',name,uid))
        return created
    except BaseException:
        remove_accounts(created);raise

def remove_accounts(created):
    for kind,name,uid in reversed(created):
        if kind=='user':
            entry=pwd.getpwnam(name);assert entry.pw_uid==uid and entry.pw_shell=='/usr/sbin/nologin' and entry.pw_dir=='/nonexistent'
        else:
            # Ubuntu userdel can remove the now-empty matching primary group itself.
            try:entry=grp.getgrnam(name)
            except KeyError:continue
            assert entry.gr_gid==uid
        subprocess.run(['/usr/sbin/'+('userdel' if kind=='user' else 'groupdel'),name],check=True,capture_output=True,timeout=5)

class Unit:
    def __init__(self,name):self.name=name
    @property
    def pid(self):return int(self.status()["MainPID"])
    def status(self):
        return dict(line.split('=',1) for line in ctl('show',self.name,'--property=ActiveState,MainPID,ExecMainStatus,Result,LoadState').splitlines())
    def poll(self):
        state=self.status()
        if state['ActiveState'] in ['active','activating','deactivating']:return None
        return int(state['ExecMainStatus']) if state['Result']=='success' else 1
    def terminate(self):ctl('stop',self.name)
    def wait(self,timeout):
        until=time.monotonic()+timeout
        while time.monotonic()<until:
            result=self.poll()
            if result is not None:
                assert self.status()['MainPID']=='0';return result
            time.sleep(.05)
        raise subprocess.TimeoutExpired(self.name,timeout)

def verify(units,fixture):
    for unit,(role,uid) in zip(units,[('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)],strict=True):
        pid=int(unit.status()['MainPID']);assert pid>0
        fields=dict(line.split(':',1) for line in Path('/proc',str(pid),'status').read_text().splitlines() if ':' in line)
        assert set(fields['Uid'].split())=={str(uid)} and fields['NoNewPrivs'].strip()=='1'
        assert int(fields['CapEff'].strip(),16)==0
        assert {int(g) for g in fields['Groups'].split()}.issubset({uid})
        properties=dict(line.split('=',1) for line in ctl('show',unit.name,'--property=MemoryMax,TasksMax,Restart,KillMode').splitlines())
        assert properties=={'MemoryMax':'134217728','TasksMax':'64','Restart':'no','KillMode':'control-group'}
        script='import errno,os,sys\ntry: fd=os.open(sys.argv[1],os.O_WRONLY)\nexcept OSError as e: assert e.errno==errno.EROFS\nelse: os.close(fd);raise AssertionError("launch config writable")\n'
        subprocess.run(['/usr/bin/nsenter','--target',str(pid),'--mount','--','/usr/bin/setpriv','--reuid',str(uid),'--regid',str(uid),'--clear-groups','--no-new-privs','/usr/bin/python3','-c',script,str(fixture.root/role/'config.json')],capture_output=True,check=True,timeout=5)

def start(fixture):
    assert os.geteuid()==0
    token=str(fixture.identity);assert re.fullmatch('[a-zA-Z0-9-]{1,80}',token)
    owned=[];units=[];entries=[];created=accounts()
    try:
        for role,uid in [('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)]:
            name='ouroboros-fixture-'+token+'-'+role+'.service'
            assert 'LoadState=not-found' in ctl('show',name,'--property=LoadState')
            config=fixture.root/role/'config.json';cfg=json.loads(config.read_text())
            writable=[str(Path(cfg['instance_socket']).parent)] if role=='gateway' else []
            if role=='catalog':writable=[str(fixture.root/'catalog/blobs')]
            spec={'role':role if role in ['core','gateway'] else 'resources','binary_directory':str(fixture.binary),
                  'config':str(config),'uid':uid,'gid':uid,'writable_directories':writable,
                  'memory_max_bytes':134217728,'tasks_max':64,'stop_timeout_seconds':10}
            path=fixture.root/role/'service-spec.json';path.write_text(json.dumps(spec));path.chmod(0o600)
            entries.append({'name':name,'service':spec})
        from fixture_runtime_unit_loss import prepare_spec
        runtime_name='ouroboros-fixture-'+token+'-runtime.service'
        runtime_spec=prepare_spec(fixture.binary,fixture.root/'runtime/config.json')
        entries.append({'name':runtime_name,'service':json.loads(runtime_spec.read_text())})
        assert 'LoadState=not-found' in ctl('show',runtime_name,'--property=LoadState')
        bundle=fixture.root/'service-bundle.json';bundle.write_text(json.dumps({'services':entries}));bundle.chmod(0o600)
        renderer=[str(fixture.binary/'ouroboros-service-unit'),'--bundle',str(bundle)]
        report=json.loads(subprocess.run(renderer,capture_output=True,check=True,timeout=5).stdout)
        receipts=fixture.root/'installation-receipts';receipts.mkdir(mode=0o700)
        outcome=json.loads(subprocess.run(renderer+['--install-directory','/run/systemd/system',
            '--receipt-directory',str(receipts),'--reviewed-sha256',report['bundle_sha256']],capture_output=True,check=True,timeout=10).stdout)
        assert outcome['status']=='installed_not_started'
        owned=[(Path('/run/systemd/system')/entry['name'],entry['sha256']) for entry in report['units']]
        marker=fixture.root/'installed-service-bundle.json'
        marker.write_text(json.dumps({'runtime_unit':runtime_name,'bundle_sha256':report['bundle_sha256'],'outcome':outcome}));marker.chmod(0o600)
        for entry in report['units']:
            destination=Path('/run/systemd/system')/entry['name']
            assert destination.read_text()==entry['content']
            subprocess.run(['/usr/bin/systemd-analyze','verify',str(destination)],capture_output=True,check=True,timeout=10)
        units=[Unit(entry['name']) for entry in entries[:-1]]
        applied=start_phase(fixture.binary,fixture.root,'control')
        assert applied['phase']=='control' and applied['authority_granted'] is False
        inspect_install(fixture.binary,fixture.root,applied['operation_id'],withheld=True)
        assert Unit(runtime_name).pid==0, 'Runtime started before authenticated readiness'
        return units,(owned,created)
    except BaseException:
        close(units,(owned,created));raise

def close(units,state):
    owned,created=state
    errors=[];stopped=set()
    for unit in reversed(units):
        try:
            unit.terminate();result=unit.wait(5);stopped.add(unit.name)
            if result!=0:errors.append(unit.name+' did not exit cleanly')
        except BaseException:errors.append(unit.name+' termination unconfirmed')
    for path,digest in owned:
        if any(unit.name==path.name for unit in units) and path.name not in stopped:continue
        assert Unit(path.name).pid==0
        assert not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest()==digest
        path.unlink()
    if owned:ctl('daemon-reload')
    if len(stopped)==len(units):remove_accounts(created)
    if errors:raise AssertionError('; '.join(errors))


def start_phase(binary,root,phase):
    marker=json.loads((root/'installed-service-bundle.json').read_text())
    firm=json.loads((root/'core/config.json').read_text())['firm_id']
    command=[str(binary/'ouroboros-service-unit'),'--bundle',str(root/'service-bundle.json'),
        '--install-directory','/run/systemd/system','--receipt-directory',str(root/'installation-receipts'),
        '--reviewed-sha256',marker['bundle_sha256'],'--start-phase',phase,
        '--gateway-client',str(root/'cli/config.json'),'--expected-firm',firm]
    if phase=='runtime':
        denied=list(command);denied[-1]='00000000-0000-0000-0000-000000000000'
        rejected=subprocess.run(denied,capture_output=True,timeout=30)
        assert rejected.returncode!=0 and b'unexpected conditions identity' in rejected.stderr
        assert Unit(marker['runtime_unit']).pid==0, 'wrong company readiness started Runtime'
    result=resume_interrupted_control(command,root) if phase=='control' else subprocess.run(command,capture_output=True,timeout=120)
    if result.returncode:raise AssertionError('product start phase failed: '+result.stderr.decode())
    observed=json.loads(result.stdout)
    if phase=='control':
        before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'installation-receipts').iterdir()}
        repeated=subprocess.run(command,capture_output=True,timeout=30)
        assert repeated.returncode!=0 and b'service is not inactive' in repeated.stderr
        assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'installation-receipts').iterdir()}
        assert Unit(marker['runtime_unit']).pid==0
    receipt=root/('product-start-'+phase+'.json');receipt.write_text(json.dumps(observed));receipt.chmod(0o600)
    return observed


def stop_phase(binary,root,phase,delegation,reject=None):
    marker=json.loads((root/'installed-service-bundle.json').read_text())
    firm=json.loads((root/'core/config.json').read_text())['firm_id']
    command=[str(binary/'ouroboros-service-unit'),'--bundle',str(root/'service-bundle.json'),
        '--install-directory','/run/systemd/system','--receipt-directory',str(root/'installation-receipts'),
        '--reviewed-sha256',marker['bundle_sha256'],'--stop-phase',phase,
        '--gateway-client',str(root/'cli/config.json'),'--expected-firm',firm,'--environment-delegation',delegation]
    before=Unit(marker['runtime_unit']).pid
    target_names=[entry['name'] for entry in json.loads((root/'service-bundle.json').read_text())['services']
                  if (entry['service']['role']=='runtime')==(phase=='runtime')]
    target_pids={name:Unit(name).pid for name in target_names}
    receipts_before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'installation-receipts').iterdir()}
    result=restore_interrupted_shutdown(command,root) if phase=='control' and reject is None else subprocess.run(command,capture_output=True,timeout=120)
    if reject is not None:
        assert result.returncode!=0 and reject.encode() in result.stderr, result.stderr.decode()
        assert target_pids and all(pid>0 for pid in target_pids.values())
        assert {name:Unit(name).pid for name in target_names}==target_pids
        assert receipts_before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'installation-receipts').iterdir()}
        # A separately authorized admission pause may already terminate Runtime while control
        # shutdown is rejected. Only this request's actual target services must remain unchanged.
        if phase=='runtime':assert Unit(marker['runtime_unit']).pid==before and before>0
        return None
    if result.returncode:raise AssertionError('product stop phase failed: '+result.stderr.decode())
    observed=json.loads(result.stdout)
    receipt=root/('product-stop-'+phase+'.json');receipt.write_text(json.dumps(observed));receipt.chmod(0o600)
    if phase=='control':inspect_install(binary,root,observed['operation_id'],stopped=True)
    return observed


def inspect_install(binary,root,operation,withheld=False,stopped=False):
    marker=json.loads((root/'installed-service-bundle.json').read_text())
    command=[str(binary/'ouroboros-service-unit'),'--bundle',str(root/'service-bundle.json'),
        '--install-directory','/run/systemd/system','--receipt-directory',str(root/'installation-receipts'),
        '--reviewed-sha256',marker['bundle_sha256'],'--inspect-installed','--operation',operation]
    receipts=root/'installation-receipts'
    before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in receipts.iterdir()}
    def inspect():
        result=subprocess.run(command,capture_output=True,check=True,timeout=120)
        value=json.loads(result.stdout)
        assert value['installation_verified'] and not value['actions_performed']
        assert value['application_inventory']=='not_queried' and not value['recovery_authorized']
        assert len(value['units'])==6 and all(u['matches_installed_fragment'] for u in value['units'])
        return value
    value=inspect()
    assert value['operation']['completion_recorded']
    if stopped:
        assert all(u['manager']['MainPID']=='0' and u['cgroup_observation'] in ['empty','no_current_unit_cgroup'] for u in value['units'])
    if withheld:
        record=next(receipts.glob('start-'+operation+'.*.observed.json'))
        saved=record.with_suffix('.withheld');record.rename(saved)
        try:
            uncertain=inspect()
            assert any(s['record_state']=='requested_outcome_unrecorded' for s in uncertain['operation']['steps'])
            assert any(u['manager']['ActiveState']=='active' for u in uncertain['units'])
        finally:saved.rename(record)
    assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in receipts.iterdir()}
    output=root/('inspection-'+('stopped' if stopped else 'active')+'.json')
    output.write_text(json.dumps(value));output.chmod(0o600)


def resume_interrupted_control(command,root):
    from fixture_config import clean_environment
    source=root/'start-fsync-fault.c';library=root/'start-fsync-fault.so'
    source.write_text('#define _GNU_SOURCE\n#include <dlfcn.h>\n#include <errno.h>\nint fsync(int fd) { static int n; int (*real)(int)=dlsym(RTLD_NEXT,"fsync"); if(++n==5){errno=EIO;return -1;} return real(fd); }\n')
    subprocess.run(['/usr/bin/cc','-shared','-fPIC','-o',str(library),str(source),'-ldl'],capture_output=True,check=True,timeout=20)
    failed=subprocess.run(command,env={**clean_environment(),'LD_PRELOAD':str(library)},capture_output=True,timeout=120)
    assert failed.returncode!=0
    receipts=root/'installation-receipts'
    prepared=list(receipts.glob('start-*.prepared.json'));assert len(prepared)==1
    path=prepared[0];origin=path.name.removeprefix('start-').removesuffix('.prepared.json')
    assert not (receipts/('start-'+origin+'.complete.json')).exists()
    observation=receipts/('start-'+origin+'.0.observed.json')
    first=json.loads(observation.read_text());name=first['unit']
    before=ctl('show',name,'--property=MainPID,InvocationID')
    assert 'MainPID=0' not in before
    resume=list(command);index=resume.index('--start-phase');resume[index:index+2]=['--resume-control',origin]
    for target,field in [(path,'boot_id'),(observation,'InvocationID')]:
        original=target.read_bytes();changed=json.loads(original)
        if field=='boot_id':changed[field]='00000000-0000-0000-0000-000000000000'
        else:changed['manager'][field]='00000000000000000000000000000000'
        target.write_text(json.dumps(changed))
        try:
            denied=subprocess.run(resume,capture_output=True,timeout=30)
            assert denied.returncode!=0
            assert ctl('show',name,'--property=MainPID,InvocationID')==before
        finally:target.write_bytes(original)
    result=subprocess.run(resume,capture_output=True,timeout=120)
    if result.returncode:raise AssertionError('control recovery failed: '+result.stderr.decode())
    assert ctl('show',name,'--property=MainPID,InvocationID')==before
    resumed=json.loads((receipts/('start-'+origin+'.resumed.json')).read_text())
    assert resumed['existing_units_retained']==1
    repeated=subprocess.run(resume,capture_output=True,timeout=30)
    assert repeated.returncode!=0 and b'already complete or superseded' in repeated.stderr
    evidence={'result':'PASS','original_operation':origin,'resumed_operation':json.loads(result.stdout)['operation_id'],
        'original_invocation_retained':True,'boot_mismatch_denied':True,'invocation_mismatch_denied':True,'repeated_resume_denied':True,'fault':'fsync_call_5'}
    (root/'control-resume.json').write_text(json.dumps(evidence))
    return result


def restore_interrupted_shutdown(command,root):
    from fixture_config import clean_environment
    bundle=json.loads((root/'service-bundle.json').read_text())
    names={e['service']['role']:e['name'] for e in bundle['services']}
    core_before=ctl('show',names['core'],'--property=MainPID,InvocationID')
    library=root/'start-fsync-fault.so';assert library.exists()
    failed=subprocess.run(command,env={**clean_environment(),'LD_PRELOAD':str(library)},capture_output=True,timeout=120)
    assert failed.returncode!=0 and Unit(names['gateway']).pid==0
    records=[p for p in (root/'installation-receipts').glob('stop-*.prepared.json') if json.loads(p.read_text())['phase']=='control']
    assert len(records)==1
    prior=records[0];origin=prior.name.removeprefix('stop-').removesuffix('.prepared.json')
    assert not (prior.parent/('stop-'+origin+'.complete.json')).exists()
    restore=list(command);i=restore.index('--stop-phase');restore[i:i+2]=['--restore-control',origin]
    i=restore.index('--environment-delegation');del restore[i:i+2]
    original=prior.read_bytes();altered=json.loads(original);altered['boot_id']='00000000-0000-0000-0000-000000000000';prior.write_text(json.dumps(altered))
    try:
        denied=subprocess.run(restore,capture_output=True,timeout=30)
        assert denied.returncode!=0 and Unit(names['gateway']).pid==0
    finally:prior.write_bytes(original)
    result=subprocess.run(restore,capture_output=True,timeout=120)
    if result.returncode:raise AssertionError('control restoration failed: '+result.stderr.decode())
    assert Unit(names['gateway']).pid>0 and Unit(names['runtime']).pid==0
    assert ctl('show',names['core'],'--property=MainPID,InvocationID')==core_before
    repeated=subprocess.run(restore,capture_output=True,timeout=30)
    assert repeated.returncode!=0 and b'already restored' in repeated.stderr
    fresh_stop=subprocess.run(command,capture_output=True,timeout=120)
    if fresh_stop.returncode:raise AssertionError('fresh shutdown failed: '+fresh_stop.stderr.decode())
    evidence={'result':'PASS','interrupted_stop':origin,'restoration':json.loads(result.stdout)['operation_id'],
        'fresh_stop':json.loads(fresh_stop.stdout)['operation_id'],'core_invocation_retained':True,
        'gateway_restored':True,'runtime_not_restarted':True,'boot_mismatch_denied':True,'repeat_denied':True,'fresh_authorized_inventory_required':True}
    (root/'control-restoration.json').write_text(json.dumps(evidence))
    return fresh_stop
