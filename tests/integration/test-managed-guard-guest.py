"""Finite Linux guard-unit qualification. No model, Docker, company authority or boot install."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse,hashlib,json,os,select,shutil,subprocess,time,uuid
from pathlib import Path

def command(*args):
    return subprocess.run(args,check=True,capture_output=True,timeout=15).stdout.decode().strip()

def status(unit):
    return dict(line.split('=',1) for line in command('/usr/bin/systemctl','show',unit,'--property=LoadState,ActiveState,MainPID,Result,ExecMainStatus').splitlines())

def launch(path):
    cfg=json.loads(path.read_text())
    fd=os.open(Path(cfg['target'])/'cgroup.kill',os.O_WRONLY)
    try:
        with Path(cfg['log']).open('xb') as log:
            child=subprocess.Popen(['/usr/bin/systemd-run','--quiet','--pipe','--wait','--service-type=exec','--unit='+cfg['guard_unit'],
                '--property=Restart=no','--property=MemoryMax=33554432','--property=TasksMax=4',
                '--property=NoNewPrivileges=yes','--property=CapabilityBoundingSet=CAP_SETUID CAP_SETGID',
                '--property=ProtectSystem=strict','--property=ProtectHome=read-only','--property=PrivateNetwork=yes',
                '--property=ProtectControlGroups=yes','--property=PrivateTmp=yes',
                '/usr/bin/setpriv','--reuid='+str(cfg['uid']),'--regid='+str(cfg['uid']),'--clear-groups','--no-new-privs',
                cfg['binary'],'0',str(cfg['deadline'])],stdin=fd,stdout=log,stderr=log,env={})
        # Remain alive only until the controller kills this exact unit cgroup.
        child.wait(timeout=30)
    finally:os.close(fd)

def probe(root,binary,uid):
    assert os.geteuid()==0 and uid>=100000 and root.is_absolute() and binary.is_absolute()
    assert root.parent.is_dir() and not root.exists()
    root.mkdir(mode=0o755);(root/'private').mkdir(mode=0o700)
    # A single verified tiny guard copy makes traversal independent of a developer's home.
    installed=root/'guard';shutil.copyfile(binary,installed);installed.chmod(0o555)
    assert hashlib.sha256(installed.read_bytes()).digest()==hashlib.sha256(binary.read_bytes()).digest()
    for descriptor in [0,1,2]:
        rejected=subprocess.run([str(installed),str(descriptor),str(time.clock_gettime_ns(time.CLOCK_BOOTTIME)+10_000_000_000)],stdin=subprocess.DEVNULL,capture_output=True,timeout=2)
        assert rejected.returncode!=0 and b'armed' not in rejected.stdout
    token=uuid.uuid4().hex
    launcher_unit='ouroboros-guard-launcher-'+token+'.service';guard_unit='ouroboros-guard-'+token+'.service'
    target=Path('/sys/fs/cgroup')/('ouroboros-guard-probe-'+token)
    sleeper=None;started=False
    try:
        assert status(launcher_unit)['LoadState']=='not-found' and status(guard_unit)['LoadState']=='not-found'
        target.mkdir()
        sleeper=subprocess.Popen(['/usr/bin/sleep','60'],env={})
        (target/'cgroup.procs').write_text(str(sleeper.pid))
        deadline=time.clock_gettime_ns(time.CLOCK_BOOTTIME)+16_000_000_000
        log=root/'private/guard.log'
        cfg={'target':str(target),'log':str(log),'binary':str(installed),'uid':uid,'guard_unit':guard_unit,'deadline':deadline}
        config=root/'private/launch.json';config.write_text(json.dumps(cfg));config.chmod(0o600)
        started=True
        command('/usr/bin/systemd-run','--quiet','--service-type=exec','--unit='+launcher_unit,'--property=Restart=no',
                '--property=KillMode=control-group','--property=MemoryMax=67108864','--property=TasksMax=16',
                '/usr/bin/python3',str(Path(__file__).resolve()),'--launch',str(config))
        for _ in range(60):
            if log.exists() and f'armed {deadline}' in log.read_text():break
            time.sleep(.1)
        else:raise AssertionError('managed guard did not arm; protected log retained')
        guard_pid=int(status(guard_unit)['MainPID']);launcher_pid=int(status(launcher_unit)['MainPID'])
        assert guard_pid>0 and launcher_pid>0
        fields=dict(line.split(':',1) for line in Path('/proc',str(guard_pid),'status').read_text().splitlines() if ':' in line)
        assert set(fields['Uid'].split())=={str(uid)} and fields['NoNewPrivs'].strip()=='1' and int(fields['CapEff'],16)==0
        guard_cgroup=Path('/proc',str(guard_pid),'cgroup').read_text()
        launcher_cgroup=Path('/proc',str(launcher_pid),'cgroup').read_text()
        assert guard_unit in guard_cgroup and launcher_unit in launcher_cgroup and guard_cgroup!=launcher_cgroup
        command('/usr/bin/systemctl','kill','--signal=SIGKILL','--kill-whom=all',launcher_unit)
        for _ in range(30):
            if status(launcher_unit)['MainPID']=='0':break
            time.sleep(.1)
        else:raise AssertionError('launcher termination not observed')
        assert time.clock_gettime_ns(time.CLOCK_BOOTTIME)<deadline and sleeper.poll() is None
        assert status(guard_unit)['MainPID']==str(guard_pid)
        sleeper.wait(timeout=20)
        assert sleeper.returncode==-9 and time.clock_gettime_ns(time.CLOCK_BOOTTIME)>=deadline
        assert 'populated 0' in (target/'cgroup.events').read_text()
        for _ in range(30):
            if status(guard_unit)['MainPID']=='0':break
            time.sleep(.1)
        else:raise AssertionError('guard did not terminate')
        assert 'kill_written' in log.read_text()
        result={'result':'PASS','guard_sha256':hashlib.sha256(installed.read_bytes()).hexdigest(),
                'guard_uid':uid,'separate_unit_cgroups':True,'launcher_cgroup_killed':True,'guard_survived':True,
                'original_deadline_preserved':True,'target_empty':True,'native_runtime_integration':'NOT RUN','host_suspend':'NOT RUN'}
    finally:
        if sleeper is not None and sleeper.poll() is None:sleeper.kill();sleeper.wait(timeout=3)
        if started:
            for unit in [launcher_unit,guard_unit]:
                if status(unit)['LoadState']!='not-found':
                    command('/usr/bin/systemctl','stop',unit)
                    assert status(unit)['MainPID']=='0'
                    subprocess.run(['/usr/bin/systemctl','reset-failed',unit],capture_output=True,timeout=5)
        if target.exists():
            assert 'populated 0' in (target/'cgroup.events').read_text();target.rmdir()
    (root/'private/result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path);p.add_argument('--guard',type=Path);p.add_argument('--uid',type=int);p.add_argument('--launch',type=Path);a=p.parse_args()
    if a.launch:launch(a.launch)
    else:
        if a.root is None or a.guard is None or a.uid is None:p.error('root, guard and uid required')
        probe(a.root,a.guard,a.uid)
