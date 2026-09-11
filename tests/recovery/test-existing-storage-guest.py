"""Bounded disposable-fixture cold restart checks; no provisioning or model calls."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse,ctypes,hashlib,json,os,re,signal,subprocess,time,urllib.parse
from pathlib import Path
from tests.support.fixture_config import load_config,clean_environment

def interrupted(signum, frame):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise KeyboardInterrupt('storage fixture cancelled')

signal.signal(signal.SIGTERM, interrupted)
if not __debug__:
    raise RuntimeError('optimized Python disables behavioral assertions and is not a test profile')
p=argparse.ArgumentParser();p.add_argument('--load',action='store_true');p.add_argument('--native-recovery',action='store_true');p.add_argument('--system-services',action='store_true');p.add_argument('--phase',choices=['before','after'],required=True)
a,fixture=load_config(p)
assert os.geteuid()==0
root=fixture.existing_root();binary=fixture.binary;env=clean_environment();os.umask(0o077)
def digest(value):return hashlib.sha256(value).hexdigest()
configs={role:json.loads((root/role/'config.json').read_text()) for role in ['core','company','catalog']}
databases={role:urllib.parse.urlsplit(Path(cfg['database_url_file']).read_text().strip()).path[1:] for role,cfg in configs.items()}
snapshot={'tables':{},'files':{}}
for role,db in databases.items():
    for setting in ['fsync','synchronous_commit','full_page_writes']:
        assert fixture.sql('SHOW '+setting,db)=='on'
    names=fixture.sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",db).splitlines()
    assert len(names)<=150
    for name in names:
        assert re.fullmatch('[a-z_][a-z0-9_]*',name)
        rows=fixture.sql('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\'::jsonb)::text FROM "'+name+'" t',db).encode()
        assert len(rows)<=8*1024*1024
        snapshot['tables'][role+'/'+name]=digest(rows)
total=0
for path in sorted((root/'catalog/blobs').rglob('*')):
    assert not path.is_symlink()
    if path.is_file():
        total+=path.stat().st_size;assert total<=16*1024*1024
        snapshot['files'][str(path.relative_to(root/'catalog/blobs'))]=digest(path.read_bytes())
assert snapshot['files']
assert fixture.sql('SELECT admission_paused FROM firms',databases['core'])=='t'
baseline=root/'cold-restart-baseline.json'
if a.phase=='before':
    with baseline.open('x') as f:json.dump(snapshot,f)
    print(json.dumps({'phase':'before','tables':len(snapshot['tables']),'files':len(snapshot['files'])}))
else:
    assert snapshot==json.loads(baseline.read_text()),'record or artifact changed across cold restart'
    def drop(uid):
        def child():
            os.setgroups([]);os.setgid(uid);os.setuid(uid)
            if ctypes.CDLL(None).prctl(38,1,0,0,0)!=0:raise RuntimeError('cannot prohibit privilege gain')
        return child
    if a.native_recovery:
        from tests.support.fixture_native_recovery import prepare,run
        native_context=prepare(fixture,databases)
    processes=[];managed=None;inventory_checked=False
    try:
        if a.system_services:
            assert not a.load and not a.native_recovery
            from tests.support.fixture_service_units import start,close
            processes,managed=start(fixture)
        for role,uid in ([] if a.system_services else [('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)]):
            executable='ouroboros-resources' if role in ['company','catalog','fixture'] else 'ouroboros-'+role
            with (root/role/'cold-restart.log').open('xb') as log:
                processes.append(subprocess.Popen([str(binary/executable),'--config',str(root/role/'config.json')],preexec_fn=drop(uid),stdout=log,stderr=log,env=env))
        grant=fixture.sql("SELECT id FROM delegations WHERE 'environment.admission'=ANY(actions)",databases['core'])
        assert re.fullmatch('[a-f0-9-]{36}',grant)
        command=[str(binary/'ouroboros-cli'),'--config',str(root/'reviewer/config.json'),'request','GET','/environment/status/'+grant]
        for _ in range(50):
            result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=5)
            if result.returncode==0:break
            assert all(child.poll() is None for child in processes)
            time.sleep(.1)
        else:raise AssertionError('service inventory unavailable after database restart')
        inventory=json.loads(result.stdout)
        assert inventory['admission_paused'] and not inventory['backup_ready']
        assert inventory['instances_without_termination']==0
        if a.system_services:
            from tests.support.fixture_service_units import verify
            verify(processes,fixture)
        inventory_checked=True
        if a.native_recovery:run(fixture,databases,native_context,grant,drop,env)
        if a.load:
            from tests.support.fixture_load import measure
            measure(fixture,processes,grant)
    finally:
        if managed is not None:
            close(processes,managed)
            if inventory_checked:
                (root/'service-units-result.json').write_text(json.dumps({'result':'PASS','managed_services':len(processes),'api_inventory_checked':True,'clean_exit':True,'automatic_restart':False,'boot_enabled':False})+'\n')
        for child in ([] if managed is not None else reversed(processes)):
            if child.poll() is None:child.terminate()
            try:child.wait(timeout=7)
            except subprocess.TimeoutExpired:child.kill();child.wait(timeout=3);raise
    result={'result':'PASS','same_database_rows':True,'same_artifact_bytes':True,'durability_settings_on':True,'paused_api_recovered':True,'tables':len(snapshot['tables']),'files':len(snapshot['files']),'backup_restore':'NOT RUN','real_account':False}
    (root/'cold-restart-result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
