"""Real mTLS services + disposable PostgreSQL. No isolated payload or provider calls.
Requires --config with an explicit disposable admin URL file and PostgreSQL psql on PATH.
The caller's OS UID is shared: this suite does not certify process credential isolation.
--postgres-restart-checkpoint permits a bounded external restart handoff, never a shell command.
Optional storage_root keeps prepared artifact directories on a caller-selected fixture volume.
--storage-failure-checks uses an in-process, one-certificate loopback fault proxy,
four completion-loss cases, one claim-response-loss case, and a 100-byte quota.
These are transport/receipt/quota checks, not power-loss or physical-media tests.
--binary-checks explicitly selects a 1MiB file bound, 4MiB storage budget and 96 calls.
It adds non-UTF8 API/CLI transfers and bounded partial/stalled upload observations. It never
retransmits an interrupted upload or treats stdout prefixes as a complete failed download.
--workspace-checks adds a four-workspace namespace, 24 resource-call slots, real human CLI
creation/list/detail, binary object retention, one lost completion and a two-request quota race.
It reuses the Catalog worker and makes no Runtime-instance or model-execution claim.
--retirement-checks requires --workspace-checks and explicitly grants a zero-age fixture
retirement policy plus 16 call slots. It tests reference retirement, never physical collection.
--collection-checks requires the workspace and retirement checks and explicitly adds collect
permission plus 24 call slots. It tests one real fixture-owner shared lock, two exact UUID
removals and a lost completion; it makes no native-reader or device-block reclamation claim.
"""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse, fcntl, hashlib, http.client, json, os, secrets, shutil, socket, ssl, subprocess, time, urllib.error, urllib.parse, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from threading import Barrier, Lock
from tests.support.fixture_config import clean_environment, load_config, local_url, postgres_environment
p=argparse.ArgumentParser()
p.add_argument('--postgres-restart-checkpoint',action='store_true',help='pause at an on-disk checkpoint for an externally orchestrated PostgreSQL restart (60 seconds maximum)')
p.add_argument('--storage-failure-checks',action='store_true',help='inject bounded catalog-to-Core acknowledgement loss and test storage byte admission')
p.add_argument('--binary-checks',action='store_true',help='exercise bounded >64KiB binary API/CLI transfers and interrupted uploads')
p.add_argument('--workspace-checks',action='store_true',help='exercise namespace workspace API/CLI, retained objects, scope isolation and quota')
p.add_argument('--retirement-checks',action='store_true',help='with --workspace-checks, exercise explicit reference retirement and historical receipt recovery')
p.add_argument('--collection-checks',action='store_true',help='with workspace and retirement checks, exercise bounded explicit collection steps and confirmed logical byte refunds')
a,fixture=load_config(p)
if a.retirement_checks and not a.workspace_checks:p.error('--retirement-checks requires --workspace-checks')
if a.collection_checks and not (a.workspace_checks and a.retirement_checks):p.error('--collection-checks requires --workspace-checks and --retirement-checks')
file_bound=1048576 if a.binary_checks else 65536
storage_capacity=4194304 if a.binary_checks else 1048576
resource_capacity=(96 if a.binary_checks else 40)+(24 if a.workspace_checks else 0)+(16 if a.retirement_checks else 0)+(24 if a.collection_checks else 0)
fixture.require_ports('core','gateway','company','catalog','fixture')
admin=fixture.admin_url();parsed=local_url(admin)
storage_container=fixture.existing_storage_root()
root=fixture.create_root();binary=fixture.binary;processes={};service_runs=[];fault_proxy=None
storage_container=storage_container or root
child_env=clean_environment()
def run(cmd,**kw):
    result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,**({'env':child_env,'cwd':root.parent,**kw}))
    if result.returncode:raise RuntimeError('fixture command failed: '+Path(cmd[0]).name)
    return result.stdout
def write(name,data):
    path=root/name;path.write_text(data);path.chmod(0o600);return path
def sql(statement,url=admin):
    return run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],input=statement.encode(),env=postgres_environment(url)).decode().strip()
def db_url(database,user=None,password=None):
    authority=parsed.netloc if user is None else f'{user}:{password}@{"["+parsed.hostname+"]" if ":" in parsed.hostname else parsed.hostname}:{parsed.port}'
    return urllib.parse.urlunsplit((parsed.scheme,authority,'/'+database,parsed.query,''))
run(['openssl','genpkey','-algorithm','ED25519','-out',str(root/'ca.key')]);(root/'ca.key').chmod(0o600)
run(['openssl','req','-x509','-new','-key',str(root/'ca.key'),'-subj','/CN=Ouroboros resource fixture','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-out',str(root/'ca.pem')])
write('cert.ext',fixture.cert_extensions())
fps={}
for name in ['human','core','gateway','gateway-service','company','catalog','fixture']+(['binary-human'] if a.binary_checks else []):
    run(['openssl','genpkey','-algorithm','ED25519','-out',str(root/f'{name}.key')]);(root/f'{name}.key').chmod(0o600)
    run(['openssl','req','-new','-key',str(root/f'{name}.key'),'-subj',f'/CN={name}','-out',str(root/f'{name}.csr')])
    run(['openssl','x509','-req','-in',str(root/f'{name}.csr'),'-CA',str(root/'ca.pem'),'-CAkey',str(root/'ca.key'),'-CAcreateserial','-days','1','-extfile',str(root/'cert.ext'),'-out',str(root/f'{name}.pem')])
    fps[name]=hashlib.sha256(run(['openssl','x509','-in',str(root/f'{name}.pem'),'-outform','DER'])).hexdigest()
def tls(name):return {'certificate':f'{name}.pem','private_key':f'{name}.key','ca':'ca.pem'}
urls={};service_urls={}
for name in ['core','company','catalog']:
    database='ouro_api_'+name+'_'+secrets.token_hex(4);sql(f'CREATE DATABASE {database}')
    urls[name]=db_url(database);migrate=write(name+'-migrate.url',urls[name])
    cmd=[str(binary/('ouroboros-migrate' if name=='core' else 'ouroboros-resource-migrate')),'--database-url-file',str(migrate)]
    if name!='core':cmd+=['--role',name]
    run(cmd)
    role='ouro_api_'+secrets.token_hex(4);pw=secrets.token_hex(24)
    sql(f"CREATE ROLE {role} LOGIN PASSWORD '{pw}'; GRANT CONNECT ON DATABASE {database} TO {role}; GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {role};",urls[name])
    service_urls[name]=write(name+'-service.url',db_url(database,role,pw))
firm,human,grant,workspace,input_id,store_id,generation,negative_grant,initial_upload_id=[str(uuid.uuid4()) for _ in range(9)]
original_grant=grant
ops=['inspect','work.create','db.read','db.write','file.read','file.upload','file.publish','mcp','model.responses']
if a.workspace_checks:ops+=['workspace.create']
if a.retirement_checks:ops+=['file.retire']
if a.collection_checks:ops+=['file.collect']
legacy_ops=[op for op in ops if op not in ['file.retire','file.collect']]
workspace_namespace=str(uuid.uuid4()) if a.workspace_checks else None
workspace_target='company-files'
workspace_capacity=4
workspace_ops=['workspace.create','file.upload','file.read','file.publish','inspect']
if a.retirement_checks:workspace_ops+=['file.retire']
if a.collection_checks:workspace_ops+=['file.collect']
retirement_policy={'id':str(uuid.uuid4()),'revision':1,'min_retention_seconds':0,
                   'allowed':['upload','revision','workspace_close']} if a.retirement_checks else None
if a.collection_checks:retirement_policy['allowed'].append('collect')
sql(f"""INSERT INTO firms(id) VALUES('{firm}');INSERT INTO principals VALUES('{firm}','{human}','human',true);
INSERT INTO credentials VALUES('{fps['human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{grant}','{human}',ARRAY[{','.join(repr(x) for x in ops)}],clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{negative_grant}','{human}',ARRAY[{','.join(repr(x) for x in ops)}],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','resource_calls',{resource_capacity},0);
INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES('{firm}','{store_id}','{generation}',{storage_capacity});
""",urls['core'])
binary_stream_grant=None
if a.binary_checks:
    binary_stream_grant=str(uuid.uuid4())
    # Trusted fixture setup: a second certificate for the same human and an attenuated
    # upload grant to revoke permanently. Neither is a product enrollment/approval proof.
    sql(f"INSERT INTO credentials VALUES('{fps['binary-human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour'); INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES('{firm}','{binary_stream_grant}','{human}','{original_grant}',ARRAY['inspect','file.upload'],clock_timestamp()+interval '1 hour');",urls['core'])
def prepare_storage(label):
    artifact=storage_container/(label+'-blobs');artifact.mkdir(mode=0o700)
    binding=root/(label+'-storage.json')
    prepare=write(label+'-prepare.json',json.dumps({'root':str(artifact),'binding_file':binding.name,'owner_uid':os.getuid(),'firm_id':firm,'store_id':store_id,'generation':generation}))
    run([str(binary/'ouroboros-storage'),'prepare','--config',str(prepare)])
    return artifact,binding
blob,storage_binding=prepare_storage('catalog')
sql(f"INSERT INTO storage_binding(singleton,firm_id,store_id,generation) VALUES(true,'{firm}','{store_id}','{generation}')",urls['catalog'])
catalog_role=local_url(service_urls['catalog'].read_text()).username
sql(f'REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON storage_binding FROM {catalog_role}; GRANT EXECUTE ON FUNCTION public.check_storage_binding(uuid,uuid,uuid) TO {catalog_role}',urls['catalog'])
content=b'fixture input';digest=hashlib.sha256(content).hexdigest();(blob/digest).write_bytes(content);(blob/digest).chmod(0o600)
sql(f"INSERT INTO inputs VALUES('{firm}','{input_id}','{{\"input\":true}}')",urls['company'])
# Synthetic metadata for the manually seeded input; this setup does not prove the upload API path.
sql(f"INSERT INTO uploads(firm_id,intent_id,digest,size) VALUES('{firm}','{initial_upload_id}','{digest}',{len(content)})",urls['catalog'])
sql(f"INSERT INTO workspaces VALUES('{firm}','{workspace}',0,'{json.dumps({'input.txt':digest})}')",urls['catalog'])
configs={'core':{'listen':fixture.endpoint('core'),'tls':tls('core'),'database_url_file':service_urls['core'].name,'firm_id':firm,'gateway_fingerprint':fps['gateway-service']},'gateway':{'listen':fixture.endpoint('gateway'),'tls':tls('gateway'),'core_url':fixture.url('core'),'core_client':tls('gateway-service'),'workers':{},'native_routes':{'model':'fixture','mcp':'fixture'}}}
for name in ['company','catalog','fixture']:
    configs[name]={'listen':fixture.endpoint(name),'tls':tls(name),'core_url':fixture.url('core'),'core_client':tls(name),'gateway_fingerprint':fps['gateway-service'],'role':name}
    if name!='fixture':configs[name]['database_url_file']=service_urls[name].name
    if name=='catalog':
        configs[name]['storage_binding_file']=storage_binding.name
    if name=='fixture':configs[name]['fixture_command']='printf controlled-fixture'
    configs['gateway']['workers'][name]=fixture.url(name)
    conf={'input_id':input_id} if name=='company' else {'workspace_id':workspace,'store_id':store_id,'storage_generation':generation,'max_file_bytes':file_bound,'transfer_seconds':120} if name=='catalog' else {'fixture':True}
    sql(f"INSERT INTO resource_targets VALUES('{firm}','{name}','{fps[name]}',true,'{json.dumps(conf)}',2097152)",urls['core'])
if a.workspace_checks:
    # Explicit fixture provisioning, not agent self-registration or a new worker credential.
    configs['gateway']['workers'][workspace_target]=fixture.url('catalog')
    conf={'namespace_id':workspace_namespace,'store_id':store_id,'storage_generation':generation,
          'max_file_bytes':file_bound,'transfer_seconds':120}
    if a.retirement_checks:conf['retirement_policy']=retirement_policy
    sql(f"INSERT INTO resource_targets VALUES('{firm}','{workspace_target}','{fps['catalog']}',true,'{json.dumps(conf)}',2097152); INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES('{firm}','{workspace_namespace}','{workspace_target}','{store_id}','{generation}',{workspace_capacity})",urls['core'])
ctx=ssl.create_default_context(cafile=str(root/'ca.pem'));ctx.load_cert_chain(root/'human.pem',root/'human.key')
opener=fixture.opener(ctx)
work=None
def call(method,path,body=None,key=None,target=None,extra=None):
    headers={}
    if work:headers.update({'x-ouro-work-id':work,'x-ouro-delegation-id':grant})
    if target:headers['x-ouro-resource-target']=target
    if key:headers['idempotency-key']=key
    headers.update(extra or {})
    data=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
    if body is not None:headers['content-type']='application/octet-stream' if isinstance(body,bytes) else 'application/json'
    request=urllib.request.Request(fixture.url('gateway')+path,data=data,headers=headers,method=method)
    try:
        with opener.open(request,timeout=5) as response:
            data=response.read().decode();typ=response.headers.get('content-type','')
            return response.status,json.loads(data) if typ=='application/json' and data else data,typ
    except urllib.error.HTTPError as e:return e.code,e.read().decode(),None
service_names=['core','company','catalog','fixture','gateway']
def listening(name):
    try:
        with socket.create_connection((fixture.host,fixture.ports[name]),timeout=.15):return True
    except OSError:return False
def stop_services():
    stopped={name:proc.pid for name,proc in processes.items()}
    for proc in reversed(list(processes.values())):
        if proc.poll() is None:proc.terminate()
    deadline=time.monotonic()+10
    forced=[]
    for name,proc in reversed(list(processes.items())):
        try:proc.wait(timeout=max(.01,deadline-time.monotonic()))
        except subprocess.TimeoutExpired:
            forced.append(name);proc.kill();proc.wait(timeout=3)
    processes.clear()
    assert not any(listening(name) for name in service_names),'service listener survived shutdown'
    assert not forced,('service required forced shutdown',forced)
    return stopped
def restart_catalog(label):
    proc=processes.pop('catalog');proc.terminate();proc.wait(timeout=5)
    assert not listening('catalog'),'catalog listener survived worker restart'
    log=(root/('catalog-'+label+'.log')).open('xb')
    try:processes['catalog']=subprocess.Popen([str(binary/'ouroboros-resources'),'--config',str(root/'catalog.json')],stdout=log,stderr=log,env=child_env,cwd=root.parent)
    finally:log.close()
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        assert processes['catalog'].poll() is None,'catalog exited during worker restart'
        if listening('catalog'):break
        time.sleep(.05)
    else:raise RuntimeError('catalog did not restart')
def start_services(label,ready_status=200):
    assert not processes,'previous service children are still tracked'
    assert not any(listening(name) for name in service_names),'fixture port already has a listener'
    for path,digest in restart_files.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest()==digest,('restart input changed',path.name)
    for name in service_names:
        log=(root/(name+'-'+label+'.log')).open('xb')
        exe='ouroboros-resources' if name in ['company','catalog','fixture'] else 'ouroboros-'+name
        try:processes[name]=subprocess.Popen([str(binary/exe),'--config',str(root/(name+'.json'))],stdout=log,stderr=log,env=child_env,cwd=root.parent)
        finally:log.close()
    deadline=time.monotonic()+15
    while time.monotonic()<deadline:
        assert all(proc.poll() is None for proc in processes.values()),'service exited during startup'
        try:
            if all(listening(name) for name in service_names) and call('GET','/conditions')[0]==ready_status:break
        except OSError:pass  # A listener may start during this bounded readiness loop.
        time.sleep(.1)
    else:raise RuntimeError('services not ready: '+label)
    service_runs.append({'phase':label,'pids':{name:proc.pid for name,proc in processes.items()}})
def persisted_state():
    tables={'core':['work','intents','resource_calls','resource_transfers','reservations','storage_budgets','storage_allocations','outbox','attempts','events','limits','delegations','resource_targets','resource_scopes'],
            'company':['inputs','results','effect_receipts'],
            'catalog':['storage_binding','workspaces','workspace_snapshots','uploads','upload_staging','publication_receipts','blob_objects','upload_object_holds','revision_object_holds']}
    if a.workspace_checks:
        tables['core']+=['workspace_namespaces','workspace_allocations']
        tables['catalog']+=['workspace_create_receipts']
    if a.retirement_checks:
        tables['core']+=['resource_retirements','workspace_releases']
        tables['catalog']+=['catalog_retirements']
    if a.collection_checks:
        tables['core']+=['resource_collections','collection_steps','storage_releases']
        tables['catalog']+=['catalog_collections']
    result={}
    for name,names in tables.items():
        pairs=','.join(f"'{table}',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {table} t WHERE firm_id='{firm}')" for table in names)
        result[name]=json.loads(sql('SELECT jsonb_build_object('+pairs+')',urls[name]))
    return result
def effects(state):return {name:state[name] for name in ['company','catalog']}
def expected_upload_response(identity):
    recorded=json.loads(sql(f"SELECT to_jsonb(t) FROM uploads t WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['catalog']))
    expected={'intent_id':identity,'upload_id':identity,'sha256':recorded['digest']}
    if recorded['object_id'] is not None:expected['object_id']=recorded['object_id']
    return expected
def assert_receipt_completion(before,after,intent):
    expected=[{**row,'state':'succeeded'} if row['intent_id']==intent else row for row in before['core']['attempts']]
    by_id=lambda rows:sorted(rows,key=lambda row:row['id'])
    assert by_id(after['core']['attempts'])==by_id(expected),'receipt recovery changed execution identity or unrelated attempt state'
    assert sum(row['intent_id']==intent for row in expected)==1,'receipt recovery has no unique original attempt'
def tree_state(path):
    if not path.exists():return None
    assert path.is_dir() and not path.is_symlink(),'unexpected fixture artifact path type'
    entries={}
    for child in sorted(path.rglob('*')):
        assert not child.is_symlink(),'unexpected fixture artifact symlink'
        entries[str(child.relative_to(path))]='directory' if child.is_dir() else hashlib.sha256(child.read_bytes()).hexdigest()
    return entries
def failed_catalog_start(label,config_file,artifact):
    assert not processes and not listening('catalog'),'negative startup requires all services stopped'
    before=persisted_state();before_tree=tree_state(artifact)
    log=(root/('catalog-'+label+'.log')).open('xb')
    try:proc=subprocess.Popen([str(binary/'ouroboros-resources'),'--config',str(config_file)],stdout=log,stderr=log,env=child_env,cwd=root.parent)
    finally:log.close()
    saw_listener=False
    try:
        deadline=time.monotonic()+10
        while proc.poll() is None and time.monotonic()<deadline:
            saw_listener=bool(listening('catalog')) or saw_listener
            time.sleep(.05)
        assert proc.poll() is not None,'invalid storage startup did not exit within 10 seconds'
        assert proc.returncode!=0,'invalid storage startup exited successfully'
        assert not saw_listener and not listening('catalog'),'invalid storage startup opened a listener'
    finally:
        if proc.poll() is None:proc.terminate()
        try:proc.wait(timeout=3)
        except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=3)
    assert persisted_state()==before,'invalid startup changed persistent database evidence'
    assert tree_state(artifact)==before_tree,'invalid startup created or changed artifact files'
def restart_checkpoint(stopped):
    if not a.postgres_restart_checkpoint:return {'result':'NOT RUN'}
    started=sql('SELECT pg_postmaster_start_time()::text')
    resume=root/'postgres-restart-continue.json'
    assert not resume.exists(),'PostgreSQL restart continuation was supplied before checkpoint'
    write('postgres-restart-checkpoint.json',json.dumps({'fixture_id':fixture.identity,'state':'all-services-stopped','stopped_pids':stopped,'postgres_started_before':started,'continue_file':str(resume),'continue_value':{'fixture_id':fixture.identity,'continue':True}},indent=2))
    print(json.dumps({'checkpoint':'postgres-restart','fixture_id':fixture.identity,'timeout_seconds':60}),flush=True)
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        if resume.exists():
            assert not resume.is_symlink() and resume.is_file(),'invalid PostgreSQL restart continuation'
            assert json.loads(resume.read_text())=={'fixture_id':fixture.identity,'continue':True},'PostgreSQL continuation binding mismatch'
            break
        time.sleep(.2)
    else:raise RuntimeError('PostgreSQL restart checkpoint expired after 60 seconds')
    observed=sql('SELECT pg_postmaster_start_time()::text')
    assert sql(f"SELECT pg_postmaster_start_time() > '{started}'::timestamptz")=='t','PostgreSQL postmaster did not restart'
    assert not any(listening(name) for name in service_names),'service restarted outside fixture lifecycle'
    return {'result':'PASS','kind':'externally orchestrated PostgreSQL service restart','started_before':started,'started_after':observed,'shutdown_mode':'externally recorded; not inferred from postmaster timestamps'}

def workspace_checks():
    """Finite human mTLS API/CLI checks over one explicitly provisioned namespace."""
    report={'result':'RUNNING','namespace_id':workspace_namespace,'target_id':workspace_target,
            'capacity':workspace_capacity,'checks':[],'workspaces':[],'objects':[],'publications':[],
            'requests':{'http':0,'cli':0},'runtime_instance':'NOT RUN','native_codex':'NOT RUN',
            'same_authority_human_and_instance':'NOT RUN','process_credential_isolation':'NOT RUN',
            'post_restart':'NOT RUN'}
    counter_lock=Lock()
    cli_config=write('workspace-cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))
    cli_prefix=[str(binary/'ouroboros-cli'),'--config',str(cli_config),'workspaces']

    def raw(method,path,data=None,key=None,work_id=None):
        with counter_lock:report['requests']['http']+=1
        fields={'x-ouro-work-id':work_id or work,'x-ouro-delegation-id':grant,
                'x-ouro-resource-target':workspace_target}
        if key:fields['idempotency-key']=key
        if data is not None:fields['content-type']='application/octet-stream' if isinstance(data,bytes) else 'application/json'
        body=data if isinstance(data,bytes) or data is None else json.dumps(data).encode()
        connection=http.client.HTTPSConnection(fixture.host,fixture.ports['gateway'],context=ctx,timeout=5)
        try:
            connection.request(method,path,body=body,headers=fields)
            response=connection.getresponse();body=response.read(file_bound+1)
            assert len(body)<=file_bound,'workspace response exceeded fixture bound'
            return response.status,body,{name.lower():value for name,value in response.getheaders()}
        finally:connection.close()
    def json_call(method,path,data=None,key=None,work_id=None):
        status,body,fields=raw(method,path,data,key,work_id)
        return status,json.loads(body) if fields.get('content-type')=='application/json' and body else body,fields
    def cli(*arguments):
        report['requests']['cli']+=1
        output=run(cli_prefix+list(arguments)+['--work',work,'--delegation',grant,'--target',workspace_target])
        assert len(output)<=file_bound,'workspace CLI output exceeded fixture bound'
        return json.loads(output)
    def observe_created(record,label):
        identity=record['intent_id'];workspace_id=record['workspace_id']
        uuid.UUID(identity);uuid.UUID(workspace_id)
        expected={'intent_id':identity,'workspace_id':workspace_id,'namespace_id':workspace_namespace,
                  'work_id':work,'label':label,'revision':0}
        assert record==expected,'workspace creation response changed its allocated identity'
        actual=json.loads(sql(f"SELECT jsonb_build_object('workspace_id',workspace_id,'namespace_id',namespace_id,'work_id',work_id,'label',label,'revision',revision) FROM workspace_create_receipts WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['catalog']))
        assert actual=={key:value for key,value in expected.items() if key!='intent_id'},'workspace creation receipt differs from API result'
        assert sql(f"SELECT count(*) FROM attempts WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['core'])=='1'
        assert sql(f"SELECT state FROM workspace_allocations WHERE firm_id='{firm}' AND id='{workspace_id}'",urls['core'])=='active'
        report['workspaces'].append(expected)
    def scopes(work_id):
        sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{firm}','{work_id}','{grant}','{workspace_target}',ARRAY[{','.join(repr(op) for op in workspace_ops)}],'{workspace_namespace}')",urls['core'])

    try:
        assert sql(f"SELECT NOT revoked AND expires_at>clock_timestamp() FROM delegations WHERE firm_id='{firm}' AND id='{grant}'",urls['core'])=='t','workspace phase has no current fixture grant'
        status,created,_=json_call('POST','/workspaces',{'label':'API workspace'},'workspace-api-create')
        assert status==200,('workspace API create',status)
        observe_created(created,'API workspace');workspace_id=created['workspace_id']
        before=persisted_state()
        assert json_call('POST','/workspaces',{'label':'API workspace'},'workspace-api-create')[:2]==(200,created)
        assert json_call('POST','/workspaces',{'label':'Changed workspace'},'workspace-api-create')[0]==409
        assert persisted_state()==before,'duplicate or conflicting workspace request changed an allocation or effect'
        status,listed,_=json_call('GET','/workspaces')
        assert status==200 and [row['workspace_id'] for row in listed['items']]==[workspace_id]
        assert listed['next_cursor'] is None
        status,detail,_=json_call('GET',f'/workspaces/{workspace_id}')
        assert status==200 and {key:detail[key] for key in listed['items'][0]}==listed['items'][0] and detail['state']=='active'
        observation=detail['publication_observation']
        assert observation['source']=='core_publication_records' and observation['initial_revision']==0
        assert observation['latest_confirmed_publication'] is None and not observation['has_pending_publication']
        shown=cli('show',workspace_id)
        assert shown.keys()==detail.keys()
        expected_detail={**detail,'publication_observation':{**observation,'observed_at':shown['publication_observation']['observed_at']}}
        assert shown==expected_detail
        cli_created=cli('create','--label','CLI workspace','--key','workspace-cli-create')
        observe_created(cli_created,'CLI workspace')
        cli_list=cli('list')
        assert {row['workspace_id'] for row in cli_list['items']}=={workspace_id,cli_created['workspace_id']}
        assert all(row['work_id']==work and row['namespace_id']==workspace_namespace for row in cli_list['items'])
        report['checks'].append('human mTLS API and real Rust CLI create/list/show the same allocated namespace workspaces; stable key replays and changed label conflicts')

        # The caller selects upload intents. Object IDs identify separate physical lifetimes.
        data=bytes([0,255,128,10])+b'workspace-result';digest=hashlib.sha256(data).hexdigest()
        uploads=[]
        for suffix in ['first','same-bytes']:
            status,pending,_=json_call('POST','/uploads',{'sha256':digest,'size':len(data)},'workspace-upload-'+suffix)
            assert status==202,('workspace upload admission',status)
            identity=pending['upload_id']
            status,uploaded,_=json_call('PUT',f'/uploads/{identity}/content',data)
            assert status==200 and uploaded==expected_upload_response(identity)
            object_id=uploaded['object_id'];uuid.UUID(object_id)
            assert object_id!=identity
            assert sql(f"SELECT count(*) FROM upload_object_holds WHERE firm_id='{firm}' AND intent_id='{identity}' AND object_id='{object_id}'",urls['catalog'])=='1'
            assert sql(f"SELECT count(*) FROM blob_objects WHERE firm_id='{firm}' AND upload_intent_id='{identity}' AND object_id='{object_id}' AND digest='{digest}' AND size={len(data)} AND state='verified'",urls['catalog'])=='1'
            assert (blob/('blob-'+object_id)).read_bytes()==data
            assert not (blob/digest).exists(),'new object gained a digest-addressed fallback'
            uploads.append(identity);report['objects'].append({'upload_id':identity,'object_id':object_id,'sha256':digest,'size':len(data)})
        assert report['objects'][0]['object_id']!=report['objects'][1]['object_id'],'equal bytes reused a physical object identity'
        for revision,identity in enumerate(uploads):
            publication={'workspace_id':workspace_id,'expected_revision':revision,'files':{'result.bin':identity}}
            if revision==1:
                # Preserve two total revisions while observing a real committed effect whose Core receipt is lost.
                assert fault_proxy is not None
                fault_proxy.arm(None,'before-completion')
            status,published,_=json_call('POST','/publications',publication,'workspace-publish-'+str(revision))
            if revision==1:
                assert status==503 and fault_proxy.consumed(),'publication loss did not cross the intended Core boundary'
                publication_intent=sql(f"SELECT intent_id FROM publication_receipts WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=2",urls['catalog'])
                uuid.UUID(publication_intent)
                before_observation=persisted_state()
                pending_observation=json_call('GET',f'/workspaces/{workspace_id}')[1]['publication_observation']
                assert pending_observation['has_pending_publication']
                assert pending_observation['latest_confirmed_publication']['revision']==1
                assert pending_observation['latest_confirmed_publication']['files'][0]['upload_id']==uploads[0]
                assert any(item['intent_id']==publication_intent and item['expected_revision']==1 for item in pending_observation['pending_publications'])
                assert persisted_state()==before_observation,'publication metadata discovery replayed an external effect'
                status,published,_=json_call('POST',f'/resource-intents/{publication_intent}/reconcile')
                assert effects(persisted_state())==effects(before_observation),'receipt reconciliation republished the file'
            assert status==200 and published['revision']==revision+1
            before_observation=persisted_state()
            observed=json_call('GET',f'/workspaces/{workspace_id}')[1]['publication_observation']
            confirmed=observed['latest_confirmed_publication']
            assert not observed['has_pending_publication'] and not observed['pending_has_more']
            assert confirmed['intent_id']==published['intent_id'] and confirmed['revision']==revision+1
            assert confirmed['files_complete'] and confirmed['file_count']==1 and confirmed['retirement_state']=='none_recorded'
            assert confirmed['files']==[{'workspace_id':workspace_id,'revision':revision+1,'path':'result.bin','upload_id':identity,'work_id':work,'target_id':workspace_target}]
            assert confirmed['confirmed_at'] is not None
            assert persisted_state()==before_observation,'confirmed publication discovery mutated persistent state'
            report['publications'].append({'reply':published,'input':publication,'request_key':'workspace-publish-'+str(revision)})
            snapshot=json.loads(sql(f"SELECT manifest FROM workspace_snapshots WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision={revision+1}",urls['catalog']))
            expected_object={key:value for key,value in report['objects'][revision].items() if key!='upload_id'}
            assert snapshot['result.bin']==expected_object,'snapshot did not pin its exact object generation'
            assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision={revision+1} AND object_id='{expected_object['object_id']}'",urls['catalog'])=='1'
        for revision in [1,2]:
            status,downloaded,fields=raw('GET',f'/workspaces/{workspace_id}/snapshots/{revision}/files/result.bin')
            assert status==200 and downloaded==data,'namespace binary read changed the published bytes'
            assert fields['content-type']=='application/octet-stream' and int(fields['content-length'])==len(data)
            assert fields['x-ouro-content-sha256']==digest
        assert sql(f"SELECT count(*) FROM upload_object_holds WHERE firm_id='{firm}' AND intent_id IN ('{uploads[0]}','{uploads[1]}')",urls['catalog'])=='2'
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}'",urls['catalog'])=='2'
        assert sql(f"SELECT count(*) FROM workspace_snapshots WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=0 AND manifest='{{}}'::jsonb",urls['catalog'])=='1'
        report['checks'].append('publication metadata separates Core-confirmed revision from pending Catalog effects; reconciliation reveals the same immutable file refs without another publication')
        report['checks'].append('two equal-byte uploads have distinct object identities; upload and both immutable revision holds persist after replacing the workspace head; both historical binary reads are exact')

        status,other,_=json_call('POST','/work',{'purpose':'namespace isolation fixture','delegation_id':grant},'workspace-other-work')
        assert status==200;other_work=other['resource_id'];scopes(other_work)
        before=persisted_state()
        status,other_list,_=json_call('GET','/workspaces',work_id=other_work)
        assert status==200 and other_list['items']==[]
        assert json_call('GET',f'/workspaces/{workspace_id}',work_id=other_work)[0]==403
        assert raw('GET',f'/workspaces/{workspace_id}/snapshots/1/files/result.bin',work_id=other_work)[0]==403
        assert json_call('POST','/publications',{'workspace_id':workspace_id,'expected_revision':2,'files':{'intrusion.bin':uploads[0]}},'workspace-other-publish',other_work)[0]==403
        assert persisted_state()==before,'cross-work requests changed protected or Catalog state'
        report['checks'].append('another work with the same human and namespace permissions sees no foreign workspaces and cannot inspect/read/publish the first work\'s workspace')

        assert fault_proxy is not None
        fault_proxy.arm(None,'after-completion')
        assert json_call('POST','/workspaces',{'label':'Lost completion'},'workspace-lost-completion')[0]==503
        assert fault_proxy.consumed(),'workspace completion fault was not consumed'
        identity=sql(f"SELECT intent_id FROM workspace_create_receipts WHERE firm_id='{firm}' AND work_id='{work}' AND namespace_id='{workspace_namespace}' AND label='Lost completion'",urls['catalog'])
        uuid.UUID(identity)
        assert fault_proxy.events[-1]['path']=='/resource/completions/'+identity
        assert fault_proxy.events[-1]['upstream_status']==204
        before=persisted_state();artifacts=tree_state(blob)
        restart_catalog('workspace-completion-loss')
        assert persisted_state()==before and tree_state(blob)==artifacts
        status,recovered,_=json_call('POST',f'/resource-intents/{identity}/reconcile')
        assert status==200,('workspace reconciliation',status)
        observe_created(recovered,'Lost completion')
        assert json_call('POST','/workspaces',{'label':'Lost completion'},'workspace-lost-completion')[:2]==(200,recovered)
        assert persisted_state()==before and tree_state(blob)==artifacts,'workspace receipt observation repeated creation or changed evidence'
        report['checks'].append('lost successful workspace completion response recovers after Catalog restart from the exact initial receipt with one attempt and no second allocation')

        assert int(sql(f"SELECT allocated FROM workspace_namespaces WHERE firm_id='{firm}' AND id='{workspace_namespace}'",urls['core']))==workspace_capacity-1
        start=Barrier(2)
        def compete(index):
            start.wait(timeout=5)
            return index,json_call('POST','/workspaces',{'label':'Quota candidate '+str(index)},'workspace-quota-'+str(index))
        with ThreadPoolExecutor(max_workers=2) as pool:raced=list(pool.map(compete,[0,1]))
        assert sorted(value[0] for _,value in raced)==[200,429],'namespace quota did not admit exactly one of two concurrent requests'
        winner=next((index,value) for index,value in raced if value[0]==200)
        observe_created(winner[1][1],'Quota candidate '+str(winner[0]))
        assert sql(f"SELECT allocated=capacity AND allocated={workspace_capacity} FROM workspace_namespaces WHERE firm_id='{firm}' AND id='{workspace_namespace}'",urls['core'])=='t'
        assert sql(f"SELECT count(*) FROM workspace_allocations WHERE firm_id='{firm}' AND namespace_id='{workspace_namespace}'",urls['core'])==str(workspace_capacity)
        assert sql(f"SELECT count(*) FROM workspace_create_receipts WHERE firm_id='{firm}' AND namespace_id='{workspace_namespace}'",urls['catalog'])==str(workspace_capacity)
        report['checks'].append('one remaining namespace slot admits exactly one of two concurrent creates; both Core and Catalog contain exactly four allocations/receipts')
        assert sum(report['requests'].values())<=40,'workspace fixture exceeded its finite request plan'
        report['result']='PASS'
        return report
    except BaseException:
        report['result']='FAIL';raise
    finally:write('workspace-checks.json',json.dumps(report,indent=2))

def retirement_checks(workspace_report):
    """Release named ordinary references; prove that unrelated holds and receipts survive."""
    report={'result':'RUNNING','policy':retirement_policy,'checks':[],'receipts':[],
            'original_effects':[],'requests':{'http':0,'cli':0},'post_restart':'NOT RUN',
            'physical_collection':'NOT RUN','runtime_instance':'NOT RUN','native_codex':'NOT RUN'}
    first=workspace_report['workspaces'][0];workspace_id=first['workspace_id']
    objects=workspace_report['objects'];publications=workspace_report['publications']
    assert len(objects)==2 and len(publications)==2
    data=bytes([0,255,128,10])+b'workspace-result'
    cli_config=write('retirement-cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))

    def api(method,path,body=None,key=None):
        report['requests']['http']+=1
        fields={'x-ouro-work-id':work,'x-ouro-delegation-id':grant,'x-ouro-resource-target':workspace_target}
        if key:fields['idempotency-key']=key
        if body is not None:fields['content-type']='application/json'
        connection=http.client.HTTPSConnection(fixture.host,fixture.ports['gateway'],context=ctx,timeout=5)
        try:
            connection.request(method,path,body=json.dumps(body).encode() if body is not None else None,headers=fields)
            response=connection.getresponse();value=response.read(file_bound+1)
            assert len(value)<=file_bound,'retirement response exceeded fixture bound'
            if response.getheader('content-type')=='application/json' and value:value=json.loads(value)
            return response.status,value
        finally:connection.close()
    def request(target,reason):
        return {'target':target,'reason':reason,'policy_id':retirement_policy['id'],'policy_revision':retirement_policy['revision']}
    def observed(record,body,key):
        identity=record['intent_id'];uuid.UUID(identity)
        disposition={'upload':'upload_retired','revision':'revision_retired','workspace_close':'workspace_closed'}[body['target']['kind']]
        expected={'intent_id':identity,'target':body['target'],'policy_id':body['policy_id'],
                  'policy_revision':body['policy_revision'],'disposition':disposition}
        assert record==expected,'retirement result changed its target or policy'
        row=json.loads(sql(f"SELECT jsonb_build_object('input',input,'policy',policy,'record',record) FROM catalog_retirements WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['catalog']))
        assert row=={'input':{'work_id':work,'namespace_id':workspace_namespace,'request':body},'policy':retirement_policy,'record':record}
        core=json.loads(sql(f"SELECT jsonb_build_object('intent_id',i.id,'operation',i.operation,'state',i.state,'worker_id',r.worker_id,'reply',r.reply,'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'intent_id',a.intent_id,'worker_id',a.worker_id,'state',a.state)),'[]'::jsonb) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id)) FROM intents i JOIN resource_calls r ON (r.firm_id,r.intent_id)=(i.firm_id,i.id) WHERE i.firm_id='{firm}' AND i.id='{identity}'",urls['core']))
        assert core['intent_id']==identity and core['operation']=='file.retire' and core['state']=='succeeded'
        assert core['worker_id']==fps['catalog'] and len(core['attempts'])==1
        attempt=core['attempts'][0];uuid.UUID(attempt['id'])
        assert attempt=={'id':attempt['id'],'intent_id':identity,'worker_id':fps['catalog'],'state':'succeeded'}
        stored=core['reply']
        assert isinstance(stored,dict) and isinstance(stored.get('body'),str),'Core retirement reply has no serialized body'
        canonical={**stored,'body':json.loads(stored['body'])}
        assert canonical=={'status':200,'content_type':'application/json','body':record,
                           'receipt':{'source':'catalog','retirement_receipt':identity,'record':record}},'Core protected retirement body/receipt differs from the returned result'
        report['receipts'].append({'record':record,'request':body,'request_key':key,
                                   'core':{'intent_id':identity,'state':core['state'],'attempt':attempt,'reply':canonical}})
        return identity
    def read(revision):return api('GET',f'/workspaces/{workspace_id}/snapshots/{revision}/files/result.bin')
    def allocated():return int(sql(f"SELECT allocated FROM workspace_namespaces WHERE firm_id='{firm}' AND id='{workspace_namespace}'",urls['core']))

    try:
        assert retirement_policy is not None and retirement_policy['min_retention_seconds']==0
        assert sql(f"SELECT NOT revoked AND expires_at>clock_timestamp() FROM delegations WHERE firm_id='{firm}' AND id='{grant}'",urls['core'])=='t'
        initial_tree=tree_state(blob)
        initial_core=persisted_state()['core']
        report['byte_storage_before']={name:initial_core[name] for name in ['storage_budgets','storage_allocations']}
        for item in objects:report['original_effects'].append({'intent_id':item['upload_id'],'reply':expected_upload_response(item['upload_id'])})
        for item in publications:report['original_effects'].append({'intent_id':item['reply']['intent_id'],'reply':item['reply']})
        report['original_effects'].append({'intent_id':first['intent_id'],'reply':first})

        for index,item in enumerate(objects):
            body=request({'kind':'upload','upload_id':item['upload_id']},'Retire superseded upload reference '+str(index))
            key='retirement-upload-'+str(index)
            if index==0:
                status,record=api('POST','/retirements',body,key)
                assert status==200,('upload retirement API',status)
            else:
                report['requests']['cli']+=1
                output=run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'retire','upload',item['upload_id'],
                            '--reason',body['reason'],'--policy-id',body['policy_id'],'--policy-revision',str(body['policy_revision']),
                            '--key',key,'--work',work,'--delegation',grant,'--target',workspace_target])
                assert len(output)<=file_bound
                record=json.loads(output)
            identity=observed(record,body,key)
            assert sql(f"SELECT retired_by='{identity}'::uuid FROM uploads WHERE firm_id='{firm}' AND intent_id='{item['upload_id']}'",urls['catalog'])=='t'
            assert sql(f"SELECT released_by='{identity}'::uuid FROM upload_object_holds WHERE firm_id='{firm}' AND intent_id='{item['upload_id']}' AND object_id='{item['object_id']}'",urls['catalog'])=='t'
            assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND released_by IS NULL",urls['catalog'])=='2'
            assert read(index+1)==(200,data),'retiring an upload invalidated its independent published snapshot'
        before=persisted_state()
        assert api('POST','/publications',{'workspace_id':workspace_id,'expected_revision':2,'files':{'again.bin':objects[0]['upload_id']}},'retirement-fresh-publish')[0]==403
        assert persisted_state()==before,'fresh use of a retired upload changed state'
        report['checks'].append('API and real CLI retire only each upload hold; both independent revision holds and exact binary snapshot reads survive; a fresh publication using a retired upload is denied')

        head=request({'kind':'revision','workspace_id':workspace_id,'revision':2},'Head cannot retire while open')
        before=persisted_state()
        assert api('POST','/retirements',head,'retirement-open-head')[0]==409
        assert persisted_state()==before,'open-head retirement created an effect'
        body=request({'kind':'revision','workspace_id':workspace_id,'revision':1},'Retire exact historical revision')
        status,record=api('POST','/retirements',body,'retirement-revision-one')
        assert status==200,('revision retirement',status)
        revision_release=observed(record,body,'retirement-revision-one')
        assert sql(f"SELECT retired_by='{revision_release}'::uuid FROM workspace_snapshots WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=1",urls['catalog'])=='t'
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=1 AND released_by='{revision_release}'",urls['catalog'])=='1'
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=2 AND released_by IS NULL",urls['catalog'])=='1'
        before=persisted_state()
        assert read(1)[0]==403
        assert persisted_state()==before,'reading a retired revision changed state'
        assert read(2)==(200,data)
        report['checks'].append('an open current head cannot retire; exact non-head revision retirement releases only that revision and denies new reads while the current revision remains readable')

        body=request({'kind':'workspace_close','workspace_id':workspace_id,'expected_revision':2},'Close workspace writes and return its slot')
        assert allocated()==workspace_capacity and fault_proxy is not None
        fault_proxy.arm(None,'before-completion')
        assert api('POST','/retirements',body,'retirement-workspace-close')[0]==503
        assert fault_proxy.consumed(),'retirement completion fault was not consumed'
        record=json.loads(sql(f"SELECT record FROM catalog_retirements WHERE firm_id='{firm}' AND input->>'work_id'='{work}' AND input->>'namespace_id'='{workspace_namespace}' AND record->'target'->>'kind'='workspace_close' AND record->'target'->>'workspace_id'='{workspace_id}'",urls['catalog']))
        identity=record['intent_id'];uuid.UUID(identity)
        assert fault_proxy.events[-1]=={'path':'/resource/completions/'+identity,'fault':'before-completion','upstream_sent':False}
        pending=json.loads(sql(f"SELECT jsonb_build_object('state',i.state,'reply',r.reply,'attempts',(SELECT jsonb_agg(a.state) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id)) FROM intents i JOIN resource_calls r ON (r.firm_id,r.intent_id)=(i.firm_id,i.id) WHERE i.firm_id='{firm}' AND i.id='{identity}'",urls['core']))
        assert pending=={'state':'claimed','reply':None,'attempts':['claimed']},'close completion reached Core before the injected loss'
        assert allocated()==workspace_capacity
        assert sql(f"SELECT closed_by='{identity}'::uuid FROM workspaces WHERE firm_id='{firm}' AND id='{workspace_id}'",urls['catalog'])=='t'
        assert sql(f"SELECT count(*) FROM workspace_releases WHERE firm_id='{firm}' AND workspace_id='{workspace_id}'",urls['core'])=='0'
        before=persisted_state();artifacts=tree_state(blob)
        restart_catalog('retirement-completion-loss')
        assert persisted_state()==before and tree_state(blob)==artifacts
        assert api('POST',f'/resource-intents/{identity}/reconcile')==(200,record)
        observed(record,body,'retirement-workspace-close')
        after_recovery=persisted_state()
        assert effects(after_recovery)==effects(before) and tree_state(blob)==artifacts,'close recovery repeated the Catalog effect or rewrote artifacts'
        assert_receipt_completion(before,after_recovery,identity)
        assert allocated()==workspace_capacity-1
        assert api('POST','/retirements',body,'retirement-workspace-close')==(200,record)
        assert allocated()==workspace_capacity-1 and persisted_state()==after_recovery,'closure receipt replay returned capacity twice or re-executed retirement'
        assert sql(f"SELECT count(*) FROM workspace_releases WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND retirement_intent_id='{identity}'",urls['core'])=='1'
        assert sql(f"SELECT closed_by='{identity}'::uuid FROM workspaces WHERE firm_id='{firm}' AND id='{workspace_id}'",urls['catalog'])=='t'
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND revision=2 AND released_by IS NULL",urls['catalog'])=='1'
        assert read(2)==(200,data),'workspace closure removed access to a retained historical snapshot'
        before=persisted_state()
        assert api('POST','/publications',{'workspace_id':workspace_id,'expected_revision':2,'files':{}},'retirement-closed-publish')[0]==403
        assert persisted_state()==before,'closed workspace accepted a new publication'
        report['checks'].append('Catalog-committed workspace close survives loss before Core completion with its slot still charged; receipt recovery after Catalog restart completes the original attempt and returns exactly one slot, while replay returns none and the other revision hold/read survives')

        status,replacement=api('POST','/workspaces',{'label':'Retirement replacement'},'retirement-replacement')
        assert status==200 and replacement['workspace_id']!=workspace_id
        assert replacement=={'intent_id':replacement['intent_id'],'workspace_id':replacement['workspace_id'],
                             'namespace_id':workspace_namespace,'work_id':work,'label':'Retirement replacement','revision':0}
        workspace_report['workspaces'].append(replacement)
        assert allocated()==workspace_capacity
        before=persisted_state()
        assert api('POST','/workspaces',{'label':'No second returned slot'},'retirement-no-extra-slot')[0]==429
        assert persisted_state()==before
        assert sql(f"SELECT count(*) FROM workspace_allocations WHERE firm_id='{firm}' AND namespace_id='{workspace_namespace}'",urls['core'])==str(workspace_capacity+1)
        assert sql(f"SELECT count(*) FROM workspace_allocations WHERE firm_id='{firm}' AND namespace_id='{workspace_namespace}' AND state='active'",urls['core'])==str(workspace_capacity)
        report['checks'].append('the single returned slot admits one new identity; historical closed allocation remains recorded and a second extra allocation is denied')

        before=persisted_state()
        for index,item in enumerate(objects):
            expected=report['original_effects'][index]['reply']
            key='workspace-upload-'+('first' if index==0 else 'same-bytes')
            assert api('POST','/uploads',{'sha256':item['sha256'],'size':item['size']},key)==(200,expected)
        for publication in publications:
            assert api('POST','/publications',publication['input'],publication['request_key'])==(200,publication['reply'])
        assert api('POST','/workspaces',{'label':'API workspace'},'workspace-api-create')==(200,first)
        for effect in report['original_effects']:
            assert api('POST',f"/resource-intents/{effect['intent_id']}/reconcile")==(200,effect['reply'])
        for item in report['receipts']:
            assert api('POST',f"/resource-intents/{item['record']['intent_id']}/reconcile")==(200,item['record'])
        assert persisted_state()==before,'historical effect or retirement receipt recovery changed effects or allocation state'
        assert tree_state(blob)==initial_tree,'reference retirement changed physical artifact content'
        final_core=persisted_state()['core']
        assert {name:final_core[name] for name in report['byte_storage_before']}==report['byte_storage_before'],'reference retirement changed byte charges or original storage allocations'
        report['byte_storage_unchanged']='PASS'
        report['checks'].append('original upload/publication/workspace effects replay and reconcile after retirement with exact original receipts; retirement receipts remain inspectable without another release or physical deletion')
        report['checks'].append('every returned retirement matches one succeeded Core intent/attempt and its exact protected body/receipt; byte budgets and allocations remain identical throughout reference retirement')
        assert sum(report['requests'].values())<=48,'retirement fixture exceeded its finite request plan'
        report['result']='PASS'
        return report
    except BaseException:
        report['result']='FAIL';raise
    finally:write('retirement-checks.json',json.dumps(report,indent=2))

def collection_checks(retirement_report,workspace_report):
    """One explicit step at a time; a lock conflict and response loss never imply retry authority."""
    report={'result':'RUNNING','checks':[],'collections':[],'additional_retirements':[],
            'requests':{'http':0,'cli':0},'post_restart':'NOT RUN',
            'reader_kind':'fixture-owner OS shared flock, not a native agent or HTTP stream',
            'runtime_instance':'NOT RUN','native_codex':'NOT RUN','physical_block_reclamation':'NOT RUN',
            'unlink_before_directory_sync':'NOT RUN','power_loss':'NOT RUN','physical_ssd_loss':'NOT RUN'}
    objects=workspace_report['objects'];workspace_id=workspace_report['workspaces'][0]['workspace_id']
    assert len(objects)==2 and objects[0]['sha256']==objects[1]['sha256'] and objects[0]['object_id']!=objects[1]['object_id']
    cli_config=write('collection-cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))

    def api(method,path,body=None,key=None):
        report['requests']['http']+=1
        fields={'x-ouro-work-id':work,'x-ouro-delegation-id':grant,'x-ouro-resource-target':workspace_target}
        if key:fields['idempotency-key']=key
        if body is not None:fields['content-type']='application/json'
        connection=http.client.HTTPSConnection(fixture.host,fixture.ports['gateway'],context=ctx,timeout=5)
        try:
            connection.request(method,path,body=json.dumps(body).encode() if body is not None else None,headers=fields)
            response=connection.getresponse();value=response.read(file_bound+1)
            assert len(value)<=file_bound,'collection response exceeded fixture bound'
            if response.getheader('content-type')=='application/json' and value:value=json.loads(value)
            return response.status,value
        finally:connection.close()
    def budget():
        return int(sql(f"SELECT committed_bytes FROM storage_budgets WHERE firm_id='{firm}' AND store_id='{store_id}' AND generation='{generation}'",urls['core']))
    def root_state(identity):
        return json.loads(sql(f"SELECT jsonb_build_object('state',i.state,'operation',i.operation,'reply',r.reply,'attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'worker_id',a.worker_id,'state',a.state)),'[]'::jsonb) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id)) FROM intents i JOIN resource_calls r ON (r.firm_id,r.intent_id)=(i.firm_id,i.id) WHERE i.firm_id='{firm}' AND i.id='{identity}'",urls['core']))
    def binding(item):
        return {**item,'store_id':store_id,'generation':generation}
    def request(item,index):
        return {'upload_id':item['upload_id'],'reason':'Collect exact retired object '+str(index),
                'policy_id':retirement_policy['id'],'policy_revision':retirement_policy['revision']}
    def declare(item,index):
        body=request(item,index);key='collection-root-'+str(index)
        before=persisted_state();artifacts=tree_state(blob)
        status,pending=api('POST','/collections',body,key)
        assert status==202,('collection admission',status)
        identity=pending['intent_id'];uuid.UUID(identity)
        assert pending['operation']=='file.collect' and pending['target']==workspace_target
        assert pending['state']=='accepted' and pending['reply'] is None
        assert root_state(identity)=={'state':'accepted','operation':'file.collect','reply':None,'attempts':[]}
        row=json.loads(sql(f"SELECT to_jsonb(t) FROM resource_collections t WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['core']))
        assert row['binding']==binding(item) and row['policy']==retirement_policy
        assert row['work_id']==work and row['target_id']==workspace_target and row['namespace_id']==workspace_namespace
        assert row['upload_id']==item['upload_id'] and row['state']=='pending' and row['last_sequence']==0 and row['current_step_id'] is None
        after=persisted_state()
        assert effects(after)==effects(before) and tree_state(blob)==artifacts,'collection declaration executed an effect'
        assert after['core']['storage_allocations']==before['core']['storage_allocations'] and after['core']['storage_budgets']==before['core']['storage_budgets'],'collection declaration changed byte charges'
        assert api('POST','/collections',body,key)==(202,pending)
        assert persisted_state()==after and tree_state(blob)==artifacts,'root replay issued a step, effect or resource charge'
        item_report={'intent_id':identity,'request':body,'request_key':key,'binding':binding(item),'steps':[]}
        report['collections'].append(item_report)
        return item_report
    def observed_record(item,record,expected_budget):
        identity=item['intent_id'];obj=item['binding']
        expected={'intent_id':identity,'binding':obj,'policy_id':retirement_policy['id'],
                  'policy_revision':retirement_policy['revision'],'confirmation':'removed'}
        assert record==expected,'collection result differs from its fixed source, policy or physical outcome'
        catalog=json.loads(sql(f"SELECT to_jsonb(t) FROM catalog_collections t WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['catalog']))
        assert catalog['state']=='deleted' and catalog['record']==record and catalog['binding']==obj
        assert catalog['input']=={'work_id':work,'namespace_id':workspace_namespace,'request':item['request']}
        assert catalog['policy']==retirement_policy and catalog['upload_id']==obj['upload_id'] and catalog['object_id']==obj['object_id']
        assert catalog['physical_identity']==item['physical_identity'],'Catalog marker selected a different physical object'
        assert catalog['completed_at'] is not None
        core=root_state(identity)
        assert core['state']=='succeeded' and core['operation']=='file.collect' and len(core['attempts'])==1
        assert core['attempts'][0]['state']=='succeeded' and core['attempts'][0]['worker_id']==fps['catalog']
        stored=core['reply'];canonical={**stored,'body':json.loads(stored['body'])}
        assert canonical=={'status':200,'content_type':'application/json','body':record,
                           'receipt':{'source':'catalog','collection_receipt':identity,'record':record}}
        release=json.loads(sql(f"SELECT to_jsonb(t) FROM storage_releases t WHERE firm_id='{firm}' AND collection_intent_id='{identity}'",urls['core']))
        assert release=={'firm_id':firm,'upload_intent_id':obj['upload_id'],'collection_intent_id':identity,
                         'object_id':obj['object_id'],'store_id':store_id,'generation':generation,'bytes':obj['size'],'record':record}
        assert sql(f"SELECT count(*) FROM storage_releases WHERE firm_id='{firm}' AND upload_intent_id='{obj['upload_id']}'",urls['core'])=='1'
        assert sql(f"SELECT state='completed' AND record='{json.dumps(record)}'::jsonb FROM resource_collections WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['core'])=='t'
        assert sql(f"SELECT state FROM blob_objects WHERE firm_id='{firm}' AND object_id='{obj['object_id']}'",urls['catalog'])=='deleted'
        assert budget()==expected_budget,'confirmed collection did not refund the exact source byte charge once'
        assert persisted_state()['core']['storage_allocations']==report['source_allocations'],'collection rewrote or removed an original upload allocation'
        steps=json.loads(sql(f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY sequence),'[]'::jsonb) FROM collection_steps t WHERE firm_id='{firm}' AND collection_intent_id='{identity}'",urls['core']))
        assert [step['sequence'] for step in steps]==list(range(1,len(steps)+1)) and steps[-1]['state']=='dispatched'
        assert all(step['principal_id']==human and step['fingerprint']==fps['human'] and step['delegation_id']==grant for step in steps)
        item['record']=record;item['core_reply']=canonical;item['release']=release;item['persisted_steps']=steps
    def historical_receipts():
        before=persisted_state();artifacts=tree_state(blob)
        for effect in retirement_report['original_effects']:
            assert api('POST',f"/resource-intents/{effect['intent_id']}/reconcile")== (200,effect['reply'])
        for item in retirement_report['receipts']+report['additional_retirements']:
            assert api('POST',f"/resource-intents/{item['record']['intent_id']}/reconcile")== (200,item['record'])
        for item in report['collections']:
            if 'record' in item:
                assert api('POST',f"/resource-intents/{item['intent_id']}/reconcile")== (200,item['record'])
        assert persisted_state()==before and tree_state(blob)==artifacts,'historical receipt inspection performed an effect or altered source lineage'
    def physical(item):
        object_id=str(uuid.UUID(item['object_id']));path=blob/('blob-'+object_id)
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
        meta=os.fstat(fd)
        assert meta.st_nlink==1 and meta.st_size==item['size'],'fixture object metadata mismatch'
        identity={'object_id':object_id,'device':meta.st_dev,'inode':meta.st_ino,
                  'sha256':item['sha256'],'size':item['size']}
        return fd,identity

    try:
        assert retirement_report['result']=='PASS' and 'collect' in retirement_policy['allowed']
        initial=persisted_state();initial_tree=tree_state(blob);initial_budget=budget()
        report['byte_storage_before']={name:initial['core'][name] for name in ['storage_budgets','storage_allocations']}
        report['source_allocations']=initial['core']['storage_allocations']
        namespace_before={name:initial['core'][name] for name in ['workspace_namespaces','workspace_allocations','workspace_releases']}
        assert sql(f"SELECT state FROM workspace_allocations WHERE firm_id='{firm}' AND id='{workspace_id}'",urls['core'])=='closed'
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND released_by IS NULL",urls['catalog'])=='1'

        first=declare(objects[0],0);identity=first['intent_id'];busy_key='collection-step-reader-busy'
        fd,first['physical_identity']=physical(objects[0])
        try:
            fcntl.flock(fd,fcntl.LOCK_SH|fcntl.LOCK_NB)
            report['requests']['cli']+=1
            output=run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'collect','advance',identity,
                        '--key',busy_key,'--work',work,'--delegation',grant])
            assert len(output)<=file_bound
            busy=json.loads(output);advance=busy['advance'];step=busy['step']
            assert advance['intent_id']==identity and advance['dispatch_allowed'] is True and advance['sequence']==1
            assert step=={'intent_id':identity,'step_id':advance['step_id'],'state':'busy','reply':None}
            assert busy['current']['intent_id']==identity and busy['current']['reply'] is None
            first['steps'].append({'request_key':busy_key,'response':busy,'reader_lock':'LOCK_SH held by fixture observer'})
            assert sql(f"SELECT state FROM collection_steps WHERE firm_id='{firm}' AND id='{advance['step_id']}' AND collection_intent_id='{identity}'",urls['core'])=='busy'
            assert sql(f"SELECT count(*) FROM catalog_collections WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['catalog'])=='0'
            assert budget()==initial_budget and tree_state(blob)==initial_tree,'busy reader caused deletion, marking or byte refund'
        finally:
            fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd)
        before=persisted_state()
        status,replayed=api('POST',f'/resource-intents/{identity}/advance',key=busy_key)
        assert status==202 and replayed['advance']['dispatch_allowed'] is False and replayed['step'] is None
        assert replayed['advance']['step_id']==advance['step_id']
        assert persisted_state()==before and tree_state(blob)==initial_tree,'same step key resumed deletion after the reader unlocked'
        first['steps'].append({'request_key':busy_key,'replay':replayed})
        status,record=api('POST',f'/resource-intents/{identity}/advance',key='collection-step-remove-first')
        assert status==200,('first explicit collection step',status)
        observed_record(first,record,initial_budget-objects[0]['size'])
        assert sql(f"SELECT count(*) FROM collection_steps WHERE firm_id='{firm}' AND collection_intent_id='{identity}'",urls['core'])=='2'
        after_first={name:sha for name,sha in initial_tree.items() if name!='blob-'+objects[0]['object_id']}
        assert tree_state(blob)==after_first,'collection removed or rewrote a sibling, legacy object or unrelated artifact'
        assert (blob/('blob-'+objects[1]['object_id'])).read_bytes()==bytes([0,255,128,10])+b'workspace-result'
        historical_receipts()
        report['checks'].append('root admission and stable-key replay create no attempt or byte effect; real human CLI advance observes a fixture-owned shared flock as busy; replay after unlock stays inert, and a distinct key removes only the first UUID while equal-byte sibling and legacy content remain')

        body={'target':{'kind':'revision','workspace_id':workspace_id,'revision':2},
              'reason':'Release the closed workspace final ordinary revision before collection',
              'policy_id':retirement_policy['id'],'policy_revision':retirement_policy['revision']}
        status,retired=api('POST','/retirements',body,'collection-retire-revision-two')
        assert status==200 and retired=={'intent_id':retired['intent_id'],'target':body['target'],
            'policy_id':body['policy_id'],'policy_revision':body['policy_revision'],'disposition':'revision_retired'}
        report['additional_retirements'].append({'record':retired,'request':body,'request_key':'collection-retire-revision-two'})
        assert sql(f"SELECT count(*) FROM revision_object_holds WHERE firm_id='{firm}' AND workspace_id='{workspace_id}' AND released_by IS NULL",urls['catalog'])=='0'
        assert budget()==initial_budget-objects[0]['size'] and tree_state(blob)==after_first,'reference retirement reclaimed bytes'
        second=declare(objects[1],1);identity=second['intent_id']
        fd,second['physical_identity']=physical(objects[1]);os.close(fd)
        assert fault_proxy is not None
        fault_proxy.arm(identity,'before-completion')
        assert api('POST',f'/resource-intents/{identity}/advance',key='collection-step-remove-second')[0]==503
        assert fault_proxy.consumed(),'collection completion fault was not consumed'
        assert fault_proxy.events[-1]=={'path':'/resource/completions/'+identity,'fault':'before-completion','upstream_sent':False}
        record=json.loads(sql(f"SELECT record FROM catalog_collections WHERE firm_id='{firm}' AND intent_id='{identity}' AND state='deleted'",urls['catalog']))
        pending=root_state(identity)
        assert pending['state']=='claimed' and pending['reply'] is None and len(pending['attempts'])==1
        assert pending['attempts'][0]['state']=='claimed'
        assert budget()==initial_budget-objects[0]['size'] and sql(f"SELECT count(*) FROM storage_releases WHERE firm_id='{firm}' AND collection_intent_id='{identity}'",urls['core'])=='0'
        after_second={name:sha for name,sha in after_first.items() if name!='blob-'+objects[1]['object_id']}
        assert tree_state(blob)==after_second,'second collection changed more than its exact UUID'
        before=persisted_state();restart_catalog('collection-completion-loss')
        assert persisted_state()==before and tree_state(blob)==after_second,'worker restart repeated a deletion or changed evidence'
        assert api('POST',f'/resource-intents/{identity}/reconcile')==(200,record)
        after=persisted_state()
        assert effects(after)==effects(before) and tree_state(blob)==after_second,'collection receipt recovery changed Catalog state or physical content'
        assert_receipt_completion(before,after,identity)
        observed_record(second,record,initial_budget-sum(item['size'] for item in objects))
        second['completion_fault']=fault_proxy.events[-1]
        second['charged_before_receipt_recovery']=initial_budget-objects[0]['size']
        historical_receipts()
        before=persisted_state()
        for item in report['collections']:
            status,replayed=api('POST','/collections',item['request'],item['request_key'])
            assert status==202 and replayed['intent_id']==item['intent_id'] and replayed['state']=='succeeded'
            assert json.loads(replayed['reply']['body'])==item['record']
            assert api('POST',f"/resource-intents/{item['intent_id']}/reconcile")== (200,item['record'])
        assert persisted_state()==before and tree_state(blob)==after_second,'completed root replay repeated deletion, step execution or byte refund'
        assert {name:before['core'][name] for name in namespace_before}==namespace_before,'collection changed closed-workspace state or returned a workspace slot again'
        assert before['core']['storage_allocations']==report['source_allocations']
        assert len(before['core']['storage_releases'])==len(initial['core']['storage_releases'])+2
        report['byte_storage_after']={name:before['core'][name] for name in report['byte_storage_before']}
        report['budget_trace']={'before':initial_budget,'after_first':initial_budget-objects[0]['size'],
                                'second_deleted_before_recovery':initial_budget-objects[0]['size'],
                                'after_second_receipt':budget(),'returned_bytes':sum(item['size'] for item in objects)}
        report['checks'].append('retiring the second closed-workspace revision releases its hold without refund; the exact second object is then removed, but a lost pre-Core completion leaves its original allocation charged until Catalog restart and receipt-only reconciliation return its exact byte charge once')
        report['checks'].append('original upload/publication/retirement receipts survive physical deletion as source-lineage metadata; roots, steps, exact Catalog records and unique storage releases stay attributable; closed-workspace slot state and original allocation records remain unchanged')
        assert sum(report['requests'].values())<=64,'collection fixture exceeded its finite request plan'
        report['result']='PASS'
        return report
    except BaseException:
        report['result']='FAIL';raise
    finally:write('collection-checks.json',json.dumps(report,indent=2))

def binary_checks():
    """One bounded extension of this fixture; no provider, background retry, or new service."""
    report={'result':'RUNNING','max_file_bytes':file_bound,'storage_capacity':storage_capacity,
            'resource_capacity':resource_capacity,'checks':[],'transfers':{},
            'requests':{'http':0,'cli':0,'sql_observations':0},
            'slow_reader_backpressure':'NOT RUN','control_under_load':'NOT RUN',
            'memory_bound_measurement':'NOT RUN','instance_isolation':'NOT RUN',
            'deadline_expiry':'NOT RUN','automatic_partial_recovery':'NOT RUN'}
    alternate=ssl.create_default_context(cafile=str(root/'ca.pem'))
    alternate.load_cert_chain(root/'binary-human.pem',root/'binary-human.key')
    cli_config=write('binary-cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))
    cli_prefix=[str(binary/'ouroboros-cli'),'--config',str(cli_config),'request']
    digest_of=lambda value:hashlib.sha256(value).hexdigest()

    def connect(context=ctx):
        return http.client.HTTPSConnection(fixture.host,fixture.ports['gateway'],context=context,timeout=5)
    def headers(delegation=None):
        return {'x-ouro-work-id':work,'x-ouro-delegation-id':delegation or grant}
    def raw(method,path,data=None,key=None,context=ctx,delegation=None):
        report['requests']['http']+=1
        fields=headers(delegation)
        if key:fields['idempotency-key']=key
        if data is not None:fields['content-type']='application/octet-stream' if isinstance(data,bytes) else 'application/json'
        body=data if isinstance(data,bytes) or data is None else json.dumps(data).encode()
        connection=connect(context)
        try:
            # http.client follows neither redirects nor proxies and does not retry this request.
            connection.request(method,path,body=body,headers=fields)
            response=connection.getresponse();body=response.read(file_bound+1)
            assert len(body)<=file_bound,'binary fixture response exceeded its explicit bound'
            return response.status,body,{name.lower():value for name,value in response.getheaders()}
        finally:connection.close()
    def json_call(method,path,data=None,key=None,context=ctx,delegation=None):
        status,body,fields=raw(method,path,data,key,context,delegation)
        return status,json.loads(body) if fields.get('content-type')=='application/json' and body else body,fields
    def cli(method,path,*,input_path=None,key=None,output=None,max_bytes=None,success=True):
        report['requests']['cli']+=1
        command=cli_prefix+[method,path,'--work',work,'--delegation',grant]
        if input_path is not None:command+=['--input',str(input_path)]
        if key:command+=['--key',key]
        if output is not None:command+=['--output',str(output)]
        if max_bytes is not None:command+=['--max-bytes',str(max_bytes)]
        observed=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                                env=child_env,cwd=root.parent,timeout=15)
        assert (observed.returncode==0)==success,('unexpected binary CLI exit',method,observed.returncode)
        return observed
    def fast_sql(statement,url,deadline=None):
        remaining=2 if deadline is None else min(2,deadline-time.monotonic())
        assert remaining>0,'bounded upload observation expired'
        report['requests']['sql_observations']+=1
        observed=subprocess.run(['psql','-X','-At','-v','ON_ERROR_STOP=1'],input=statement.encode(),
                                stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                                env=postgres_environment(url),timeout=remaining)
        assert observed.returncode==0,'binary fixture state observation failed'
        return observed.stdout.decode().strip()
    def observation(identity,deadline=None):
        core=json.loads(fast_sql(f"SELECT jsonb_build_object('state',i.state,'reply',r.reply,'attempts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id),'reservation',(SELECT to_jsonb(v) FROM reservations v WHERE v.firm_id=i.firm_id AND v.intent_id=i.id),'allocation',(SELECT to_jsonb(v) FROM storage_allocations v WHERE v.firm_id=i.firm_id AND v.intent_id=i.id),'transfer',(SELECT to_jsonb(v) FROM resource_transfers v WHERE v.firm_id=i.firm_id AND v.intent_id=i.id)) FROM intents i JOIN resource_calls r ON (r.firm_id,r.intent_id)=(i.firm_id,i.id) WHERE i.firm_id='{firm}' AND i.id='{identity}'",urls['core'],deadline))
        catalog=json.loads(fast_sql(f"SELECT jsonb_build_object('uploads',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM uploads v WHERE firm_id='{firm}' AND intent_id='{identity}'),'staging',(SELECT to_jsonb(v) FROM upload_staging v WHERE firm_id='{firm}' AND intent_id='{identity}'))",urls['catalog'],deadline))
        return {'core':core,'catalog':catalog}
    def file_state(path):
        assert not path.is_symlink() and path.is_file(),'expected a regular fixture artifact'
        stat=path.stat();assert stat.st_size<=file_bound,'fixture artifact exceeded its bound'
        return {'inode':stat.st_ino,'size':stat.st_size,'sha256':digest_of(path.read_bytes()),'mtime_ns':stat.st_mtime_ns}
    def artifact_state():
        return {str(path.relative_to(blob)):file_state(path) for path in sorted(blob.rglob('*')) if path.is_file()}
    def writer_locked(path):
        descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
        try:
            try:fcntl.flock(descriptor,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:return True
            fcntl.flock(descriptor,fcntl.LOCK_UN);return False
        finally:os.close(descriptor)
    def await_stage(identity,prefix):
        deadline=time.monotonic()+5
        for _ in range(30):
            state=observation(identity,deadline)
            stage=state['catalog']['staging'];attempts=state['core']['attempts']
            if stage is not None and len(attempts)==1:
                path=blob/('.staging-'+stage['staging_id'])
                if path.is_file() and path.stat().st_size==len(prefix):
                    actual=file_state(path)
                    assert state['core']['state']=='claimed' and attempts[0]['state']=='claimed'
                    assert stage['state']=='prepared' and state['catalog']['uploads']==[]
                    assert state['core']['reply'] is None and actual['sha256']==digest_of(prefix)
                    assert writer_locked(path),'upload writer ended before fault injection'
                    return state,path,actual
            assert time.monotonic()<deadline,'partial upload did not reach prepared storage'
            time.sleep(.05)
        raise RuntimeError('partial upload exceeded 30 bounded observations')
    def await_writer_release(path):
        deadline=time.monotonic()+5
        for _ in range(100):
            if not writer_locked(path):return
            assert time.monotonic()<deadline,'interrupted upload retained its active writer'
            time.sleep(.05)
        raise RuntimeError('interrupted upload writer did not finish')
    def begin_partial(identity,declared_size,prefix,delegation=None,context=ctx):
        report['requests']['http']+=1
        connection=connect(context)
        try:
            connection.putrequest('PUT',f'/uploads/{identity}/content',skip_accept_encoding=True)
            for key,value in headers(delegation).items():connection.putheader(key,value)
            connection.putheader('content-type','application/octet-stream')
            connection.putheader('content-length',str(declared_size))
            connection.endheaders();connection.send(prefix)
            return connection
        except BaseException:connection.close();raise
    def rejected_headers(identity,declared_size,context=ctx):
        # These two decisions precede body consumption. Do not race a large client send
        # against the server closing a denied connection before its response is read.
        connection=begin_partial(identity,declared_size,b'',context=context)
        try:
            response=connection.getresponse();response.read(4096);return response.status
        finally:connection.close()
    def declare(data,key,*,sha=None,size=None,delegation=None):
        body={'sha256':sha or digest_of(data),'size':len(data) if size is None else size}
        status,accepted,_=json_call('POST','/uploads',body,key,delegation=delegation)
        assert status==202,(key,status)
        return accepted['upload_id'],body
    def assert_unfinished(identity,expected_attempts):
        state=observation(identity)
        assert state['core']['reply'] is None and state['core']['state']==('claimed' if expected_attempts else 'accepted')
        assert len(state['core']['attempts'])==expected_attempts and state['catalog']['uploads']==[]
        assert state['core']['reservation']['settled'] is False
        assert state['core']['allocation']['bytes']>0,'interrupted transfer lost its byte reservation'
        return state
    def reconcile_without_transfer(identity):
        before=observation(identity);artifacts=artifact_state()
        status,reply,_=json_call('POST',f'/resource-intents/{identity}/reconcile')
        assert status==202 and reply['reply'] is None,'an interrupted upload acquired a successful receipt'
        assert observation(identity)==before and artifact_state()==artifacts,'receipt observation retried or rewrote a partial effect'

    try:
        # Byte declarations remain metadata. No inline content and no default-limit widening.
        before=persisted_state()
        status,_,_=json_call('POST','/uploads',{'sha256':'a'*64,'size':file_bound+1},'binary-over-limit')
        assert status==400 and persisted_state()==before,'oversized file admission had an effect'
        data_api=bytes(range(256))*768+b'\x00\xff\x80api-tail'
        data_cli=bytes(reversed(range(256)))*640+b'\xff\x00\xfecli-tail'
        assert len(data_api)>65536 and len(data_cli)>65536
        for value in [data_api,data_cli]:
            try:value.decode('utf-8')
            except UnicodeDecodeError:pass
            else:raise AssertionError('binary fixture must contain non-UTF8 bytes')
        api_id,api_declaration=declare(data_api,'binary-api-upload')
        before=persisted_state();artifacts=artifact_state()
        status,metadata,_=json_call('GET',f'/resource-intents/{api_id}',context=alternate)
        assert status==200 and metadata['intent_id']==api_id,'second valid certificate lacks its current inspect scope'
        assert rejected_headers(api_id,len(data_api),context=alternate)==403,'another certificate took over an accepted transfer'
        assert persisted_state()==before and artifact_state()==artifacts,'denied certificate created an attempt or artifact'
        status,api_receipt,_=json_call('PUT',f'/uploads/{api_id}/content',data_api)
        assert status==200 and api_receipt['sha256']==digest_of(data_api)
        cli_source=root/'binary-cli-input.bin';cli_source.write_bytes(data_cli);cli_source.chmod(0o600)
        cli_declaration={'sha256':digest_of(data_cli),'size':len(data_cli)}
        cli_input=write('binary-cli-upload.json',json.dumps(cli_declaration))
        cli_accepted=json.loads(cli('POST','/uploads',input_path=cli_input,key='binary-cli-upload').stdout)
        cli_id=cli_accepted['upload_id']
        cli_receipt=json.loads(cli('PUT',f'/uploads/{cli_id}/content',input_path=cli_source,max_bytes=file_bound).stdout)
        assert cli_receipt['sha256']==digest_of(data_cli)
        for label,identity,data in [('api',api_id,data_api),('cli',cli_id,data_cli)]:
            observed=observation(identity)
            assert observed['core']['state']=='succeeded' and len(observed['core']['attempts'])==1
            assert len(observed['catalog']['uploads'])==1
            assert observed['catalog']['uploads'][0]['size']==len(data)
            assert observed['catalog']['uploads'][0]['digest']==digest_of(data)
            assert observed['core']['reply']['receipt']['size']==len(data)
            object_id=observed['catalog']['uploads'][0]['object_id'];uuid.UUID(object_id)
            assert observed['core']['reply']['receipt']['object_id']==object_id
            assert (blob/('blob-'+object_id)).read_bytes()==data
            assert not (blob/digest_of(data)).exists(),'new binary upload used a legacy digest address'
            report['transfers'][label]={'intent_id':identity,'object_id':object_id,'size':len(data),'sha256':digest_of(data)}
        report['checks'].append('API and Rust CLI independently uploaded non-UTF8 files above 64KiB with one attempt and exact catalog size/digest')
        report['checks'].append('second valid certificate for the same human can inspect but cannot acquire the first certificate\'s accepted transfer')

        revision=int(sql(f"SELECT revision FROM workspaces WHERE firm_id='{firm}' AND id='{workspace}'",urls['catalog']))
        publication={'workspace_id':workspace,'expected_revision':revision,'files':{'api.bin':api_id,'cli.bin':cli_id}}
        status,published,_=json_call('POST','/publications',publication,'binary-publication')
        assert status==200 and published['revision']==revision+1
        download=f'/workspaces/{workspace}/snapshots/{revision+1}/files/api.bin'
        status,downloaded,response_headers=raw('GET',download)
        assert status==200 and downloaded==data_api,'API download changed non-UTF8 content'
        assert response_headers['content-type']=='application/octet-stream'
        assert int(response_headers['content-length'])==len(data_api)
        assert response_headers['x-ouro-content-sha256']==digest_of(data_api)
        read_id=response_headers['x-ouro-intent-id'];uuid.UUID(read_id)
        status,read_metadata,_=json_call('GET',f'/resource-intents/{read_id}')
        assert status==200 and read_metadata['state']=='succeeded'
        assert read_metadata['reply']['body']=='' and read_metadata['reply']['content_type']=='application/octet-stream'
        assert read_metadata['reply']['receipt']['sha256']==digest_of(data_api)
        assert read_metadata['reply']['receipt']['size']==len(data_api)
        expected_snapshot={'workspace_id':workspace,'revision':revision+1,'path':'api.bin'}
        assert read_metadata['reply']['receipt']['snapshot']==expected_snapshot
        cli_download=f'/workspaces/{workspace}/snapshots/{revision+1}/files/cli.bin'
        assert cli('GET',cli_download,max_bytes=file_bound).stdout==data_cli,'CLI stdout changed bytes or appended a newline'
        destination=root/'binary-cli-download.bin'
        assert cli('GET',cli_download,output=destination,max_bytes=file_bound).stdout==b''
        assert destination.read_bytes()==data_cli and digest_of(destination.read_bytes())==digest_of(data_cli)
        refused=root/'binary-cli-too-small.bin'
        failed=cli('GET',cli_download,output=refused,max_bytes=65536,success=False)
        assert failed.stdout==b'' and not refused.exists(),'CLI published output beyond its explicit client limit'
        assert b'CLI response bound' in failed.stderr,'CLI failed for a different reason than its file limit'
        report['checks'].append('separate publication exposes a pinned binary snapshot; API headers, protected read metadata, CLI stdout and verified output file agree exactly')
        report['checks'].append('CLI client byte limit fails without publishing an output file; no completeness guarantee is claimed for stdout on stream failure')

        before=persisted_state();artifacts=artifact_state()
        for key,identity,declaration,receipt in [('binary-api-upload',api_id,api_declaration,api_receipt),('binary-cli-upload',cli_id,cli_declaration,cli_receipt)]:
            assert json_call('POST','/uploads',declaration,key)[:2]==(200,receipt)
            assert json_call('POST',f'/resource-intents/{identity}/reconcile')[:2]==(200,receipt)
        assert persisted_state()==before and artifact_state()==artifacts,'metadata replay changed attempts, charges, receipts or artifact identity'
        report['checks'].append('completed declaration/receipt replay sends no content PUT and creates no new attempt, charge, write or publication')

        wrong_size_data=b'\x00\xffsize-check'*10000
        wrong_size,_=declare(wrong_size_data,'binary-wrong-size',size=len(wrong_size_data)+1)
        before=persisted_state();artifacts=artifact_state()
        assert rejected_headers(wrong_size,len(wrong_size_data))==409
        assert persisted_state()==before and artifact_state()==artifacts,'declared length mismatch consumed an attempt'
        assert_unfinished(wrong_size,0);reconcile_without_transfer(wrong_size)
        report['checks'].append('wrong Content-Length is denied before dispatch; its unresolved allocation is retained')

        bad_data=b'\x80\xffdigest-check'*10000
        wrong_digest,_=declare(bad_data,'binary-wrong-digest',sha='f'*64)
        prefix=bad_data[:16384];connection=begin_partial(wrong_digest,len(bad_data),prefix)
        try:
            _,stage_path,_=await_stage(wrong_digest,prefix)
            connection.send(bad_data[len(prefix):])
            response=connection.getresponse();status=response.status;response.read(4096)
            assert status in {409,503},('digest mismatch did not fail closed',status)
        finally:connection.close()
        await_writer_release(stage_path);unfinished=assert_unfinished(wrong_digest,1)
        assert not (blob/('f'*64)).exists(),'wrong digest was installed as declared content'
        assert not (blob/('blob-'+unfinished['catalog']['staging']['object_id'])).exists(),'wrong digest acquired a completed object'
        reconcile_without_transfer(wrong_digest)
        report['transfers']['wrong_digest']={'intent_id':wrong_digest,'http_status':status,'content_puts':1,'receipt':None}
        report['checks'].append('wrong digest after actual staging leaves one unresolved attempt without a successful upload receipt; content is not retried')

        for mode in ['disconnect','revocation']:
            data=(b'\x00\xff'+mode.encode())*12000
            delegated=binary_stream_grant if mode=='revocation' else grant
            identity,_=declare(data,'binary-'+mode,delegation=delegated)
            prefix=data[:16384];connection=begin_partial(identity,len(data),prefix,delegation=delegated)
            try:
                before,stage_path,stage_before=await_stage(identity,prefix)
                remaining=float(fast_sql(f"SELECT extract(epoch FROM expires_at-clock_timestamp()) FROM resource_transfers WHERE firm_id='{firm}' AND intent_id='{identity}'",urls['core']))
                assert remaining>30,'fault injection is too close to the original admission expiry'
                proof={'intent_id':identity,'attempt_id':before['core']['attempts'][0]['id'],
                       'admitted_size':len(data),'staged_prefix':stage_before,'remaining_seconds_before_fault':remaining,'content_puts':1}
                if mode=='revocation':
                    assert raw('GET','/conditions')[0]==200,'Gateway was unavailable before revocation'
                    started=time.monotonic()
                    # The attenuated fixture grant stays revoked; no later case restores it.
                    sql(f"UPDATE delegations SET revoked=true WHERE firm_id='{firm}' AND id='{binary_stream_grant}'",urls['core'])
                    response=connection.getresponse();status=response.status;response.read(4096)
                    elapsed=time.monotonic()-started
                    assert status in {403,503} and elapsed<5,('stalled transfer did not observe current revocation',status,elapsed)
                    assert raw('GET','/conditions')[0]==200,'a general Gateway outage cannot prove revocation'
                    proof.update({'http_status':status,'revocation_observed_seconds':elapsed,'grant_stays_revoked':True})
                else:
                    # No EOF completion frame, response assumption, or retry: close this sole PUT.
                    connection.close();proof['transport']='caller disconnected before declared length'
            finally:connection.close()
            await_writer_release(stage_path)
            after=assert_unfinished(identity,1)
            assert after==before,'interruption changed the original attempt, deadline, allocation or receipt'
            assert file_state(stage_path)==stage_before,'interruption removed or rewrote the observed partial bytes'
            assert not (blob/digest_of(data)).exists(),'partial input acquired a complete blob identity'
            assert not (blob/('blob-'+after['catalog']['staging']['object_id'])).exists(),'partial input acquired its completed object address'
            reconcile_without_transfer(identity)
            proof['writer_lock_released']=True;report['transfers'][mode]=proof
        report['checks'].append('partial disconnect preserves the exact staged prefix, original attempt, absolute expiry and unsettled reservation; receipt observation does not retry it')
        report['checks'].append('a healthy Gateway stops a stalled upload after scoped revocation well before its deadline; the worker releases its file lock and no success receipt appears')
        assert sql(f"SELECT revoked FROM delegations WHERE firm_id='{firm}' AND id='{binary_stream_grant}'",urls['core'])=='t'
        assert report['requests']['http']+report['requests']['cli']<=48,'binary fixture exceeded its finite request plan'
        report['result']='PASS'
        return report
    except BaseException:
        report['result']='FAIL';raise
    finally:write('binary-checks.json',json.dumps(report,indent=2))

try:
    if a.storage_failure_checks or a.workspace_checks:
        from tests.fixtures.storage_fault_proxy import StorageFaultProxy
        fault_proxy=StorageFaultProxy(fixture.host,fixture.url('core'),root/'ca.pem',root/'catalog.pem',root/'catalog.key',fps['catalog'])
        configs['catalog']['core_url']=fault_proxy.url
    for name in service_names:write(name+'.json',json.dumps(configs[name]))
    restart_paths=[root/(name+'.json') for name in service_names]+[storage_binding]+list(root.glob('*.pem'))+list(root.glob('*.key'))+list(service_urls.values())
    restart_paths += [binary/name for name in ['ouroboros-core','ouroboros-gateway','ouroboros-resources','ouroboros-cli']]
    restart_files={path:hashlib.sha256(path.read_bytes()).hexdigest() for path in restart_paths}
    start_services('initial')
    status,w,_=call('POST','/work',{'purpose':'resource fixture','delegation_id':grant},'work');assert status==200,(status,w)
    work=w['resource_id']
    for target in ['company','catalog','fixture']:
        for scope_grant in [grant,negative_grant]:
            sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{scope_grant}','{target}',ARRAY[{','.join(repr(x) for x in legacy_ops)}])",urls['core'])
    if a.workspace_checks:
        for scope_grant in [grant,negative_grant]:
            sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{firm}','{work}','{scope_grant}','{workspace_target}',ARRAY[{','.join(repr(op) for op in workspace_ops)}],'{workspace_namespace}')",urls['core'])
    if a.binary_checks:
        sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{binary_stream_grant}','catalog',ARRAY['inspect','file.upload'])",urls['core'])
    bound={'X-Ouro-Owner-Binding':json.dumps(call('GET','/conditions')[1]['owner_binding'])}
    initial_read=call('GET',f'/workspaces/{workspace}/snapshots/0/files/input.txt',extra=bound)
    assert initial_read[:2]==(200,'fixture input'),('initial fixture read',initial_read[0],str(initial_read[1])[:512],initial_read[2])
    # A slot selector has no authority without a server-established service execution.
    before_service_spoof=persisted_state()
    for slot,status in [('snapshot',403),('root:child',400),('*',400)]:
        extra={**bound,'X-Ouro-Effect-Slot':slot,'X-Ouro-Effective-Caller':str(uuid.uuid4()),'X-Ouro-Root-Intent':str(uuid.uuid4())}
        result=call('POST','/db/queries',{'operation':'read_input','parameters':{'input_id':input_id}},'service-spoof',extra=extra)
        assert result[0]==status,(slot,result[0])
    assert persisted_state()==before_service_spoof,'unbound service selector created an effect'
    assert call('POST','/db/queries',{'operation':'read_input','parameters':{'input_id':input_id}},'query',extra=bound)[:2]==(200,{'input':True})
    db={'operation':'record_result','parameters':{'marker':'recorded'}}
    status,record,_=call('POST','/db/transactions',db,'record',extra=bound);assert status==200,(status,record)
    before_binding=sql(f"SELECT count(*) FROM resource_calls WHERE firm_id='{firm}'",urls['core'])
    observed_binding=json.loads(bound['X-Ouro-Owner-Binding'])
    for field in ('environment_id','firm_id','principal_id','serving_generation'):
        changed={**observed_binding,field:str(uuid.uuid4())}
        for original_key in ('record','binding-must-not-write'):
            assert call('POST','/db/transactions',db,original_key,extra={'X-Ouro-Owner-Binding':json.dumps(changed)})[0]==409
    assert sql(f"SELECT count(*) FROM resource_calls WHERE firm_id='{firm}'",urls['core'])==before_binding,'stale owner binding reserved or dispatched a resource'
    assert call('POST','/db/transactions',db,'record')[1]==record
    assert call('POST','/db/transactions',{**db,'parameters':{}},'record')[0]==409
    assert call('PUT',f"/uploads/{record['intent_id']}/content",b'wrong')[0]==409
    result=b'result';sha=hashlib.sha256(result).hexdigest()
    status,upload,_=call('POST','/uploads',{'size':len(result),'sha256':sha},'upload',extra=bound);assert status==202,(status,upload)
    upload_id=upload['upload_id'];path=f'/uploads/{upload_id}/content'
    sql("UPDATE resource_scopes SET operations=array_remove(operations,'file.upload') WHERE target_id='catalog'",urls['core'])
    assert call('GET','/resource-intents/'+upload_id)[0]==200
    assert call('PUT',path,result)[0]==403
    assert call('POST','/uploads',{'size':len(result),'sha256':sha},'upload')[0]==403
    sql("UPDATE resource_scopes SET operations=operations||ARRAY['file.upload'] WHERE target_id='catalog'",urls['core'])
    assert call('PUT',path,b'wrong first body')[0]==409
    # A denied content attempt leaves the approved intent available for its exact body.
    status,receipt,_=call('PUT',path,result,extra=bound);assert status==200,(status,receipt)
    assert call('PUT',path,result)[1]==receipt
    assert call('PUT',path,b'changed')[0]==409
    publication={'workspace_id':workspace,'expected_revision':0,'files':{'result.txt':upload_id}}
    status,pub,_=call('POST','/publications',publication,'publish');assert status==200,(status,pub)
    assert call('POST','/publications',publication,'publish')[1]==pub
    assert call('GET',f'/workspaces/{workspace}/snapshots/1/files/result.txt')[:2]==(200,'result')
    assert call('GET',f'/workspaces/{workspace}/snapshots/0/files/input.txt')[:2]==(200,'fixture input')
    init={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}}
    assert call('POST','/mcp',init)[1]['result']['protocolVersion']=='2025-11-25'
    assert call('POST','/mcp',{'jsonrpc':'2.0','method':'notifications/initialized'})[0]==202
    assert call('GET','/mcp')[0]==405
    assert call('POST','/mcp',{'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'fixture_echo','arguments':{'marker':'fixture'}}})[1]['result']['isError'] is False
    model={'model':'fixture-model','stream':True,'input':[],'tools':[{'name':'fixture_echo'}]}
    status,sse,typ=call('POST','/v1/responses',model);assert status==200 and typ=='text/event-stream' and 'response.completed' in sse
    assert sql('SELECT count(*) FROM results',urls['company'])=='1'
    assert sql('SELECT count(*) FROM effect_receipts',urls['company'])=='1'
    assert sql('SELECT count(*) FROM publication_receipts',urls['catalog'])=='1'
    status,notifications,_=call('GET','/notifications')
    assert status==200 and notifications['unread']['by_category']['publication']==1
    notices=[item for item in notifications['items'] if item['category']=='publication']
    assert len(notices)==1 and notices[0]['source']=={'work_id':work,'intent_id':pub['intent_id']}
    assert notices[0]['kind']=='publication_recorded' and not any(key in notices[0]['source'] for key in ['workspace_id','path','revision','target_id'])
    assert call('POST','/notifications/read',{'ids':[notices[0]['id']]})[0]==200
    assert call('GET','/notifications')[1]['unread']['by_category']['publication']==0

    storage_failure={'result':'NOT RUN'}
    if a.storage_failure_checks:
        failure_checks=[]
        recovered_uploads=[]
        recovery_grant=str(uuid.uuid4())
        sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{recovery_grant}','{human}',ARRAY[{','.join(repr(x) for x in ops)}],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{recovery_grant}','catalog',ARRAY[{','.join(repr(x) for x in legacy_ops)}])",urls['core'])
        for index,mode in enumerate(['before-completion','after-completion']):
            # The first effect belongs to a grant that remains revoked afterwards.
            # A different currently valid inspector recovers only that receipt.
            if index==0:grant=recovery_grant
            data=('completion-loss-'+mode).encode();data_sha=hashlib.sha256(data).hexdigest()
            status,pending,_=call('POST','/uploads',{'size':len(data),'sha256':data_sha},'loss-upload-'+mode)
            assert status==202,(status,pending)
            identity=pending['upload_id'];fault_proxy.arm(identity,mode)
            status,_,_=call('PUT',f'/uploads/{identity}/content',data)
            assert status==503 and fault_proxy.consumed(),('completion loss was not exercised',mode,status)
            assert sql(f"SELECT count(*) FROM uploads WHERE intent_id='{identity}'",urls['catalog'])=='1'
            assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{identity}'",urls['core'])=='1'
            committed=sql(f"SELECT reply IS NOT NULL FROM resource_calls WHERE intent_id='{identity}'",urls['core'])
            assert committed==('f' if mode=='before-completion' else 't'),('fault crossed the wrong commit boundary',mode)
            before_recovery=persisted_state();before_recovery_tree=tree_state(blob)
            restart_catalog('upload-'+mode)
            assert persisted_state()==before_recovery and tree_state(blob)==before_recovery_tree,'worker restart replayed or discarded an effect'
            if index==0:
                sql(f"UPDATE delegations SET revoked=true WHERE id='{recovery_grant}'; UPDATE resource_targets SET active=false WHERE id='catalog'",urls['core'])
                denied=persisted_state()
                assert call('POST',f'/resource-intents/{identity}/reconcile')[0]==403,'revoked inspector recovered a receipt'
                assert persisted_state()==denied,'denied receipt recovery changed persistent state'
                grant=original_grant
            status,recovered,_=call('POST',f'/resource-intents/{identity}/reconcile')
            assert (status,recovered)==(200,expected_upload_response(identity)),(mode,status,recovered)
            assert recovered['sha256']==data_sha
            after_recovery=persisted_state()
            assert effects(after_recovery)==effects(before_recovery),'receipt recovery rewrote catalog or company data'
            assert_receipt_completion(before_recovery,after_recovery,identity)
            assert after_recovery['core']['storage_budgets']==before_recovery['core']['storage_budgets'],'receipt recovery charged storage twice'
            assert after_recovery['core']['storage_allocations']==before_recovery['core']['storage_allocations'],'receipt recovery changed the original storage allocation'
            assert tree_state(blob)==before_recovery_tree,'receipt recovery rewrote artifact content'
            assert call('POST',f'/resource-intents/{identity}/reconcile')[:2]==(200,recovered)
            assert persisted_state()==after_recovery,'receipt replay changed persistent state'
            assert call('POST',f'/resource-intents/{identity}/reconcile',{})[0]==400,'reconcile accepted a new execution payload'
            if index==0:
                assert sql(f"SELECT revoked FROM delegations WHERE id='{recovery_grant}'",urls['core'])=='t'
                sql("UPDATE resource_targets SET active=true WHERE id='catalog'",urls['core'])
                failure_checks.append('revoked original grant denied; current inspector recovered an inactive-target receipt without restoring the old grant')
            recovered_uploads.append(identity)
            failure_checks.append('upload '+mode+' loss recovered after Catalog restart with one effect, attempt and byte allocation')
        for index,mode in enumerate(['before-completion','after-completion']):
            expected_revision=index+1
            body={'workspace_id':workspace,'expected_revision':expected_revision,'files':{'recovered.txt':recovered_uploads[index]}}
            fault_proxy.arm(None,mode)
            status,_,_=call('POST','/publications',body,'loss-publication-'+mode)
            assert status==503 and fault_proxy.consumed(),('publication completion loss was not exercised',mode,status)
            identity=sql(f"SELECT intent_id FROM publication_receipts WHERE workspace_id='{workspace}' AND revision={expected_revision+1}",urls['catalog'])
            assert identity and len(identity)==36,'publication effect receipt missing after response loss'
            assert fault_proxy.events[-1]['path']=='/resource/completions/'+identity,'publication fault targeted another request'
            committed=sql(f"SELECT reply IS NOT NULL FROM resource_calls WHERE intent_id='{identity}'",urls['core'])
            assert committed==('f' if mode=='before-completion' else 't')
            before_recovery=persisted_state();before_recovery_tree=tree_state(blob)
            restart_catalog('publication-'+mode)
            assert persisted_state()==before_recovery,'publication worker restart changed persistent state'
            status,recovered,_=call('POST',f'/resource-intents/{identity}/reconcile')
            assert (status,recovered)==(200,{'intent_id':identity,'revision':expected_revision+1}),(mode,status,recovered)
            after_recovery=persisted_state()
            assert effects(after_recovery)==effects(before_recovery),'publication recovery advanced the manifest again'
            assert_receipt_completion(before_recovery,after_recovery,identity)
            assert after_recovery['core']['storage_budgets']==before_recovery['core']['storage_budgets'],'publication recovery changed storage charge'
            assert tree_state(blob)==before_recovery_tree,'publication recovery rewrote content'
            assert call('POST',f'/resource-intents/{identity}/reconcile')[:2]==(200,recovered)
            assert persisted_state()==after_recovery,'publication recovery replay changed persistent state'
            failure_checks.append('publication '+mode+' loss recovered its original revision after Catalog restart without duplicate effect')
        assert all(200<=event['upstream_status']<300 for event in fault_proxy.events if event.get('fault')=='after-completion'),'response was dropped before successful Core acknowledgement'
        # Owner-only mutation of synthetic evidence tests inconsistent stores.
        # The worker never gets deletion or repair authority from this fixture.
        missing_id=recovered_uploads[0]
        saved_upload=sql(f"SELECT to_jsonb(t)::text FROM uploads t WHERE intent_id='{missing_id}'",urls['catalog'])
        saved_hold=sql(f"SELECT to_jsonb(t)::text FROM upload_object_holds t WHERE firm_id='{firm}' AND intent_id='{missing_id}'",urls['catalog'])
        assert saved_upload,'completed upload receipt unavailable for missing-evidence probe'
        assert saved_hold,'new upload lacks its durable object hold before missing-evidence probe'
        before_missing=persisted_state();before_missing_tree=tree_state(blob)
        # The fixture owner removes the dependent upload hold atomically with this synthetic
        # missing receipt. Revision holds and physical object identity remain untouched.
        sql(f"BEGIN; DELETE FROM upload_object_holds WHERE firm_id='{firm}' AND intent_id='{missing_id}'; DELETE FROM uploads WHERE firm_id='{firm}' AND intent_id='{missing_id}'; COMMIT",urls['catalog'])
        try:
            assert call('POST',f'/resource-intents/{missing_id}/reconcile')[0]==503,'Core cached success concealed missing Catalog evidence'
            assert persisted_state()['core']==before_missing['core'],'missing Catalog evidence changed Core history'
            assert tree_state(blob)==before_missing_tree,'missing-receipt probe wrote or removed content'
        finally:
            sql("BEGIN; INSERT INTO uploads SELECT * FROM jsonb_populate_record(NULL::uploads,'"+saved_upload.replace("'","''")+"'::jsonb); INSERT INTO upload_object_holds SELECT * FROM jsonb_populate_record(NULL::upload_object_holds,'"+saved_hold.replace("'","''")+"'::jsonb); COMMIT",urls['catalog'])
        assert persisted_state()==before_missing,'fixture receipt restoration did not restore exact evidence'
        failure_checks.append('missing Catalog receipt returns 503 despite Core cached success; synthetic owner-only evidence probe restored exactly')
        recovery_cli=write('receipt-cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))
        before_cli=persisted_state();before_cli_tree=tree_state(blob)
        output=run([str(binary/'ouroboros-cli'),'--config',str(recovery_cli),'request','POST',f'/resource-intents/{missing_id}/reconcile','--work',work,'--delegation',grant])
        assert json.loads(output)==expected_upload_response(missing_id),'CLI receipt recovery differed from the original receipt'
        assert json.loads(output)['sha256']==json.loads(saved_upload)['digest']
        assert persisted_state()==before_cli and tree_state(blob)==before_cli_tree,'CLI receipt recovery changed effects, attempts, capacity, or content'
        failure_checks.append('Rust CLI receipt reconciliation returns the same original receipt without new state or artifact changes')
        # Quota is synthetic and tiny; no physical disk is filled. Accepted bytes
        # remain charged even before a worker claim and after a missing receipt.
        sql("UPDATE storage_budgets SET capacity_bytes=committed_bytes+100",urls['core'])
        tiny=b'x'*70;tiny_body={'size':len(tiny),'sha256':hashlib.sha256(tiny).hexdigest()}
        before_capacity=persisted_state()
        with ThreadPoolExecutor(max_workers=2) as concurrent:
            admitted=list(concurrent.map(lambda key:call('POST','/uploads',tiny_body,key),['quota-a','quota-b']))
        assert sorted(reply[0] for reply in admitted)==[202,429],('concurrent 70+70 exceeded available 100',admitted)
        winner=next(index for index,reply in enumerate(admitted) if reply[0]==202)
        winner_id=admitted[winner][1]['upload_id'];winner_key=['quota-a','quota-b'][winner]
        charged=persisted_state()
        assert charged['core']['storage_budgets'][0]['committed_bytes']==before_capacity['core']['storage_budgets'][0]['committed_bytes']+70
        assert len(charged['core']['storage_allocations'])==len(before_capacity['core']['storage_allocations'])+1
        assert charged['core']['attempts']==before_capacity['core']['attempts'],'admission alone created an execution attempt'
        assert len(charged['core']['outbox'])==len(before_capacity['core']['outbox'])+1,'rejected admission created an outbox entry'
        assert call('POST','/uploads',tiny_body,winner_key)[1]['upload_id']==winner_id
        assert call('POST','/uploads',tiny_body,'quota-equal-content-new-key')[0]==429,'equal content bypassed a new staging reservation'
        assert persisted_state()==charged,'duplicate or rejected upload changed capacity or request state'
        status,unresolved,_=call('POST',f'/resource-intents/{winner_id}/reconcile')
        assert status==202,(status,unresolved)
        assert persisted_state()==charged,'missing-receipt recovery released capacity or started an attempt'
        failure_checks.append('100 available bytes admits exactly one simultaneous 70-byte upload; duplicate key is free and equal-content new key is denied')
        failure_checks.append('accepted upload without a receipt stays charged and unclaimed after receipt-only reconciliation')
        fault_proxy.arm(winner_id,'after-claim')
        assert call('PUT',f'/uploads/{winner_id}/content',tiny)[0]==503 and fault_proxy.consumed(),'claim response loss was not exercised'
        claimed=persisted_state();claimed_tree=tree_state(blob)
        assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{winner_id}'",urls['core'])=='1'
        assert effects(claimed)==effects(charged),'worker wrote staging or content after losing its claim response'
        restart_catalog('claim-response-loss')
        assert call('POST',f'/resource-intents/{winner_id}/reconcile')[0]==202,'claimed upload without receipt did not stay unresolved'
        assert persisted_state()==claimed and tree_state(blob)==claimed_tree,'missing claimed receipt caused another attempt, capacity release, or file write'
        assert claimed['core']['storage_budgets']==charged['core']['storage_budgets']
        failure_checks.append('lost claim response preserves one claimed attempt and byte charge; worker restart and no-receipt reconciliation perform no upload')
        # This explicit disposable fixture budget is restored to permit the
        # pre-existing restart/storage-loss checks. The unresolved charge stays.
        sql(f"UPDATE storage_budgets SET capacity_bytes={storage_capacity}",urls['core'])
        storage_failure={'result':'PASS','checks':failure_checks,'faults':fault_proxy.events,
                         'physical_enospc':'NOT RUN','power_loss':'NOT RUN','physical_ssd_loss':'NOT RUN'}
        write('storage-failure.json',json.dumps(storage_failure,indent=2))
    binary_result=binary_checks() if a.binary_checks else {'result':'NOT RUN'}
    workspace_result=workspace_checks() if a.workspace_checks else {'result':'NOT RUN'}
    retirement_result=retirement_checks(workspace_result) if a.retirement_checks else {'result':'NOT RUN'}
    collection_result=collection_checks(retirement_result,workspace_result) if a.collection_checks else {'result':'NOT RUN'}
    lookup_paths=[f'/work/{work}',f"/intents/{w['intent_id']}"]+[f'/resource-intents/{identity}' for identity in [record['intent_id'],upload_id,pub['intent_id']]]
    namespace_paths={f"/workspaces/{item['workspace_id']}" for item in workspace_result.get('workspaces',[])}
    retirement_paths={f"/resource-intents/{item['record']['intent_id']}" for item in retirement_result.get('receipts',[])}
    retirement_paths.update(f"/resource-intents/{effect['intent_id']}" for effect in retirement_result.get('original_effects',[]))
    collection_paths={f"/resource-intents/{item['intent_id']}" for item in collection_result.get('collections',[])}
    collection_paths.update(f"/resource-intents/{item['record']['intent_id']}" for item in collection_result.get('additional_retirements',[]))
    scoped_paths=namespace_paths|retirement_paths|collection_paths
    lookup_paths+=sorted(scoped_paths)
    before_query_start=datetime.now(timezone.utc)
    historical={path:call('GET',path,target=workspace_target if path in scoped_paths else None) for path in lookup_paths}
    before_query_end=datetime.now(timezone.utc)
    assert all(reply[0]==200 for reply in historical.values()),'historical API evidence unavailable before restart'
    baseline=persisted_state();baseline_tree=tree_state(blob)
    write('restart-before.json',json.dumps({'state':baseline,'api':historical,'artifacts':baseline_tree},indent=2))
    stopped=stop_services()
    postgres_restart=restart_checkpoint(stopped)
    start_services('persisted-restart')
    assert persisted_state()==baseline,'service restart changed persisted identities or receipts'
    assert tree_state(blob)==baseline_tree,'service restart changed artifact contents'
    after_query_start=datetime.now(timezone.utc)
    restarted={path:call('GET',path,target=workspace_target if path in scoped_paths else None) for path in lookup_paths}
    after_query_end=datetime.now(timezone.utc)
    stable_restarted=deepcopy(restarted)
    for path in namespace_paths:
        assert restarted[path][0]==200,'workspace evidence unavailable after restart'
        before_observation=historical[path][1]['publication_observation']
        after_observation=restarted[path][1]['publication_observation']
        before_time=datetime.fromisoformat(before_observation['observed_at'])
        after_time=datetime.fromisoformat(after_observation['observed_at'])
        assert before_time.tzinfo is not None and after_time.tzinfo is not None,'observation time lacks timezone'
        assert before_query_start<=before_time<=before_query_end,'prior observation is not from its actual query window'
        assert after_query_start<=after_time<=after_query_end and after_time>before_time,'restarted observation is not fresh'
        # Query observation time advances; every persisted identity, receipt, state,
        # file reference, confirmation time and response status must remain exact.
        stable_restarted[path][1]['publication_observation']['observed_at']=before_observation['observed_at']
    assert stable_restarted==historical,'API evidence changed after restart'
    if a.workspace_checks:
        workspace_result['post_restart']='PASS'
        workspace_result['checks'].append('all-service restart preserves exact workspace records and refreshes only the verified query observation time')
        write('workspace-checks.json',json.dumps(workspace_result,indent=2))
    if a.retirement_checks:
        for item in retirement_result['receipts']:
            identity=item['record']['intent_id']
            assert call('POST',f'/resource-intents/{identity}/reconcile',target=workspace_target)[:2]==(200,item['record'])
        for effect in retirement_result['original_effects']:
            assert call('POST',f"/resource-intents/{effect['intent_id']}/reconcile",target=workspace_target)[:2]==(200,effect['reply'])
        assert persisted_state()==baseline and tree_state(blob)==baseline_tree,'retirement/effect receipt recovery after restart changed state or artifact bytes'
        restarted_core=persisted_state()['core']
        byte_baseline=collection_result['byte_storage_after'] if a.collection_checks else retirement_result['byte_storage_before']
        assert {name:restarted_core[name] for name in byte_baseline}==byte_baseline,'byte budgets or source allocations changed during all-service restart'
        retirement_result['byte_storage_post_restart']='PASS'
        if a.collection_checks:retirement_result['byte_storage_post_restart_basis']='post-collection confirmed budget; byte_storage_before and byte_storage_unchanged retain the retirement-only observations'
        retirement_result['post_restart']='PASS'
        retirement_result['checks'].append('all-service restart preserves retirement lineage, slot return, independent holds and exact original effect/retirement receipt reconciliation without another release')
        write('retirement-checks.json',json.dumps(retirement_result,indent=2))
    if a.collection_checks:
        for item in collection_result['collections']:
            assert call('POST',f"/resource-intents/{item['intent_id']}/reconcile",target=workspace_target)[:2]==(200,item['record'])
            status,replayed,_=call('POST','/collections',item['request'],item['request_key'],target=workspace_target)
            assert status==202 and replayed['intent_id']==item['intent_id'] and replayed['state']=='succeeded'
            assert json.loads(replayed['reply']['body'])==item['record']
        for item in collection_result['additional_retirements']:
            assert call('POST',f"/resource-intents/{item['record']['intent_id']}/reconcile",target=workspace_target)[:2]==(200,item['record'])
        assert persisted_state()==baseline and tree_state(blob)==baseline_tree,'post-restart collection observation repeated deletion, step execution or quota return'
        collection_result['post_restart']='PASS'
        collection_result['checks'].append('all-service restart preserves root/step identities, Catalog deletion receipts, retired reference lineage and exact unique byte refunds; root replay and receipt reconciliation remain observation-only')
        write('collection-checks.json',json.dumps(collection_result,indent=2))
    # Replaying original keys uses existing receipts and must create no Core or domain effect.
    assert call('POST','/work',{'purpose':'resource fixture','delegation_id':grant},'work')[:2]==(200,{**w,'replayed':True})
    assert call('POST','/db/queries',{'operation':'read_input','parameters':{'input_id':input_id}},'query')[:2]==(200,{'input':True})
    assert call('POST','/db/transactions',db,'record')[:2]==(200,record)
    assert call('POST','/uploads',{'size':len(result),'sha256':sha},'upload')[:2]==(200,receipt)
    assert call('PUT',f'/uploads/{upload_id}/content',result)[:2]==(200,receipt)
    assert call('POST','/publications',publication,'publish')[:2]==(200,pub)
    assert persisted_state()==baseline,'stable-key replay created or changed persistent effects'
    for revision,filename,expected in [(1,'result.txt',result),(0,'input.txt',content)]:
        status,body,_=call('GET',f'/workspaces/{workspace}/snapshots/{revision}/files/{filename}')
        assert status==200 and hashlib.sha256(body.encode()).digest()==hashlib.sha256(expected).digest(),'snapshot content hash changed after restart'
    assert effects(persisted_state())==effects(baseline),'snapshot reads changed domain state'
    write('restart-after.json',json.dumps({'state':persisted_state(),'api':restarted,'artifacts':tree_state(blob),'postgres':postgres_restart},indent=2))
    # CLI reads the same Gateway API and receipt, including an inactive target.
    cfg=write('cli.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('human')}))
    sql("UPDATE resource_targets SET active=false WHERE id='catalog'",urls['core'])
    output=run([str(binary/'ouroboros-cli'),'--config',str(cfg),'request','GET',f"/resource-intents/{pub['intent_id']}",'--work',work,'--delegation',grant])
    assert json.loads(output)['reply']['receipt']['revision']==1
    sql(f"UPDATE delegations SET revoked=true WHERE id='{grant}'",urls['core'])
    assert call('GET',f"/resource-intents/{pub['intent_id']}")[0]==403
    revoked=persisted_state()
    stop_services();start_services('revocation-restart')
    assert persisted_state()==revoked,'revocation state changed across restart'
    assert call('GET',f"/resource-intents/{pub['intent_id']}")[0]==403
    assert call('POST','/db/transactions',db,'record')[0]==403
    assert call('PUT',f'/uploads/{upload_id}/content',result)[0]==403
    assert sql(f"SELECT revoked FROM delegations WHERE id='{original_grant}'",urls['core'])=='t'
    assert persisted_state()==revoked,'denied retries changed persisted evidence'
    stop_services()
    # Startup negatives and the live loss checks follow here. Each startup case owns
    # a separate descriptor sidecar; the original published store is never reenrolled.
    negative_checks=[]
    for label in ['missing-root','empty-root','copied-root']:
        case=root/label;case.mkdir(mode=0o700)
        artifact=storage_container/(label+'-blobs');artifact.mkdir(mode=0o700)
        saved=storage_container/(label+'-saved')
        assert not saved.exists(),'negative fixture saved path already exists'
        case_store,case_generation=str(uuid.uuid4()),str(uuid.uuid4())
        case_binding=case/'binding.json'
        case_prepare=write(label+'/prepare.json',json.dumps({'root':str(artifact),'binding_file':str(case_binding),'owner_uid':os.getuid(),'firm_id':firm,'store_id':case_store,'generation':case_generation}))
        run([str(binary/'ouroboros-storage'),'prepare','--config',str(case_prepare)])
        artifact.rename(saved)
        if label=='empty-root':artifact.mkdir(mode=0o700)
        if label=='copied-root':shutil.copytree(saved,artifact)
        case_config=write(label+'-catalog.json',json.dumps({**configs['catalog'],'storage_binding_file':str(case_binding)}))
        failed_catalog_start(label,case_config,artifact)
        failure=(root/('catalog-'+label+'.log')).read_text()
        assert 'external storage registration identity mismatch' not in failure,'negative failed at registration custody instead of artifact identity'
        assert 'catalog database storage binding mismatch' not in failure,'negative reached database binding instead of rejecting artifact identity'
        assert (case/f'.ouroboros-restricted-{case_store}-{case_generation}').is_file(),'artifact mismatch did not persist its independent restriction'
        if label!='missing-root':assert 'physical store identity mismatch' in failure,'replacement was not rejected by physical root identity'
        if label=='missing-root':assert not artifact.exists(),'startup created a missing artifact root'
        assert tree_state(blob)==baseline_tree,'negative startup changed original published artifacts'
        negative_checks.append(label+' startup rejected before listening or persistent effects')
    # The original grant remains revoked. A second explicit fixture grant permits
    # the final storage-loss probes without restoring the revoked authority.
    grant=negative_grant
    sql("UPDATE resource_targets SET active=true WHERE id='catalog'",urls['core'])
    start_services('before-live-loss')
    blocked_bytes=b'replacement-write-probe'
    status,blocked_upload,_=call('POST','/uploads',{'size':len(blocked_bytes),'sha256':hashlib.sha256(blocked_bytes).hexdigest()},'blocked-upload')
    assert status==202,(status,blocked_upload)
    before_loss=effects(persisted_state());before_loss_tree=tree_state(blob)
    displaced=storage_container/'catalog-blobs-displaced';replacement=storage_container/'catalog-blobs-replacement'
    assert not displaced.exists() and not replacement.exists(),'live negative fixture path already exists'
    blob.rename(displaced);blob.mkdir(mode=0o700)
    try:
        assert call('GET',f'/workspaces/{workspace}/snapshots/1/files/result.txt')[0]==503,'replacement artifact root was served'
        assert call('PUT',f"/uploads/{blocked_upload['upload_id']}/content",blocked_bytes)[0]==503,'upload to replacement artifact root was not unavailable'
        assert tree_state(blob)=={},'worker wrote to replacement artifact directory'
        blob.rename(replacement);displaced.rename(blob)
        assert call('GET',f'/workspaces/{workspace}/snapshots/1/files/result.txt')[0]==503,'restoring the root cleared live restriction'
        assert effects(persisted_state())==before_loss,'storage loss changed domain state'
        assert tree_state(blob)==before_loss_tree and tree_state(replacement)=={},'storage loss changed artifact content'
        stop_services()
        failed_catalog_start('durable-restriction',root/'catalog.json',blob)
        assert effects(persisted_state())==before_loss,'restart cleared durable restriction or changed domain state'
        assert sql(f"SELECT revoked FROM delegations WHERE id='{original_grant}'",urls['core'])=='t','original revoked grant was restored'
    finally:
        if displaced.exists():
            if blob.exists():blob.rename(replacement)
            displaced.rename(blob)
    negative_checks+=['live root replacement read and upload denied with 503 and no replacement writes','restored root remains restricted in same process','durable restriction rejects Catalog restart']
    report={'result':'PASS','checks':['mTLS Core/worker dispatch','fixed file and DB scopes','stable-key replay and conflict','one DB effect and receipt','upload content retry binding','separate publication and historical snapshot','raw native Responses and MCP fixture transports','owner CLI historical receipt and current revocation','same binaries/configuration/certificates and persisted state after all-service restart','identical work/request/result/publication receipts and content hashes after restart','stable-key replay after restart creates no new effects','original grant stays revoked across all-service restart','completed publication notification uses safe work/intent metadata and durable reads']+negative_checks,'fixture_id':fixture.identity,'storage_failure':storage_failure,'restart':{'services':{'result':'PASS','runs':service_runs},'postgresql':postgres_restart,'vm':'NOT RUN','power_loss':'NOT RUN','storage_device':'explicit storage_root' if 'storage_root' in fixture.data else 'dedicated fixture directories','physical_ssd_loss':'NOT RUN','physical_mount_loss':'NOT RUN'},'native_codex':'NOT RUN','linux_isolation':'NOT RUN','subscription':'NOT RUN'}
    report['binary']=binary_result
    report['workspace']=workspace_result
    report['retirement']=retirement_result
    report['collection']=collection_result
    write('result.json',json.dumps(report,indent=2));print(json.dumps(report))
except BaseException:
    try:
        # Bounded fixture diagnostics contain identifiers/states only, never request bodies
        # or credentials. Do not replace the original failure if observation also fails.
        states=sql(f"SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM (SELECT id,operation,state,(SELECT count(*) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id) AS attempts FROM intents i WHERE firm_id='{firm}' ORDER BY id LIMIT 200) v",urls['core'])
        write('failure-states.json',states)
    except Exception:pass  # Keep the original failure if diagnostic observation also fails.
    print(json.dumps({'result':'FAIL','fixture_id':fixture.identity}));raise
finally:
    try:stop_services()
    finally:
        if fault_proxy:fault_proxy.close()
