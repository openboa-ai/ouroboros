"""Dedicated Linux guest only. Real Rust services/Runtime, synthetic authority, no provider calls."""
import argparse
import ctypes
import shlex
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import ssl
import subprocess
import time
import concurrent.futures
import urllib.error
import urllib.request
import uuid


def interrupted(signum, frame):
    # A supervising suite cancellation must execute this fixture's existing finally
    # block. Ignore repeated TERM while cleanup runs; its parent owns the hard bound.
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise KeyboardInterrupt('native fixture cancelled')


signal.signal(signal.SIGTERM, interrupted)

from native_scenarios import SCENARIOS, select_scenario
from fixture_config import clean_environment, load_config, local_url
p = argparse.ArgumentParser(description=__doc__)
if not __debug__:
    p.error("optimized Python disables behavioral assertions and is not a test profile")
p.add_argument("--scenario", required=True, choices=tuple(SCENARIOS),
               help="one named behavioral contract; arbitrary feature combinations are unsupported")
arguments, fixture = load_config(p)
a = select_scenario(arguments.scenario).options(arguments.scenario)
if os.geteuid() != 0:
    p.error("the connected native fixture requires the explicitly selected disposable root guest")
fixture.require_ports('core','gateway','company','catalog','fixture');admin=local_url(fixture.admin_url())
runtime_values=fixture.runtime_values();binary=fixture.binary
if fixture.ports['bridge'] != 18080:
    raise ValueError('the pinned native CLI/MCP profile requires explicit bridge port 18080')
root=fixture.create_root(mode=0o755);root.chmod(0o755);ipc=fixture.create_ipc_root();ipc.chmod(0o755)
(ipc/'gateway').mkdir(mode=0o711);(ipc/'gateway').chmod(0o711);os.chown(ipc/'gateway',70002,70002)
child_env=clean_environment()
processes = []
rendered_environment_state = None
runtime = None
runtime_unit = None
cid = None
checks = []
provider_server = None
native_adapter = None
adapter_child = str(uuid.uuid4())

def run(args, **kw):
    if args[0]=='docker':args=fixture.docker(*args[1:])
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **{'timeout':20,'env':child_env,**kw}).stdout

def write(path, content, uid=0, mode=0o600):
    path.write_text(content)
    path.chmod(mode)
    os.chown(path, uid, uid)

def drop(uid):
    def f():
        os.setgroups([])
        os.setgid(uid)
        os.setuid(uid)
        libc=ctypes.CDLL(None,use_errno=True)
        if libc.prctl(38,1,0,0,0)!=0: # PR_SET_NO_NEW_PRIVS, fixture service launch only.
            raise OSError(ctypes.get_errno(),'cannot prohibit service privilege gain')
    return f

# Fixed test OS identities have no Docker group membership or shared private keys.
for name, uid in [('core',70001),('gateway',70002),('cli',70003),('runtime',0),('ca',0),('company',70004),('catalog',70005),('fixture',70006)]+([('provider',70007),('upstream',70008)] if a.encrypted_provider else []):
    folder = root/name
    folder.mkdir(mode=0o700)
    os.chown(folder,uid,uid)

def key(name):
    run(['openssl','genpkey','-algorithm','ED25519','-out',str(root/'ca'/f'{name}.key')])
key('ca')
run(['openssl','req','-x509','-new','-key',str(root/'ca/ca.key'),'-subj','/CN=Ouroboros connected fixture','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-out',str(root/'ca/ca.pem')])
write(root/'ca/cert.ext',fixture.cert_extensions())
fps = {}
for name in ['core','gateway','gateway-service','runtime','human','company','catalog','fixture']+(['provider','upstream'] if a.encrypted_provider else []):
    key(name)
    run(['openssl','req','-new','-key',str(root/'ca'/f'{name}.key'),'-subj',f'/CN={name}','-out',str(root/'ca'/f'{name}.csr')])
    run(['openssl','x509','-req','-in',str(root/'ca'/f'{name}.csr'),'-CA',str(root/'ca/ca.pem'),'-CAkey',str(root/'ca/ca.key'),'-CAcreateserial','-days','1','-extfile',str(root/'ca/cert.ext'),'-out',str(root/'ca'/f'{name}.pem')])
    fps[name] = hashlib.sha256(run(['openssl','x509','-in',str(root/'ca'/f'{name}.pem'),'-outform','DER'])).hexdigest()

def tls(service,name,uid):
    dest=root/service
    for src,target in [(f'{name}.key',f'{name}.key'),(f'{name}.pem',f'{name}.pem'),('ca.pem','ca.pem')]:
        write(dest/target,(root/'ca'/src).read_text(),uid)
    return {'certificate':str(dest/f'{name}.pem'),'private_key':str(dest/f'{name}.key'),'ca':str(dest/'ca.pem')}

def sql(text,db=None):
    return fixture.sql(text,db)

def database_url(user,password,database):
    host='['+admin.hostname+']' if ':' in admin.hostname else admin.hostname
    return f'postgresql://{user}:{password}@{host}:{admin.port}/{database}?sslmode=disable\n'

db='ouro_connected_'+secrets.token_hex(4)
password=secrets.token_hex(24)
sql(f"CREATE ROLE {db} LOGIN PASSWORD '{password}'; CREATE DATABASE {db} OWNER {db};")
url=database_url(db,password,db)
write(root/'runtime/migrate.url',url)
run([str(binary/'ouroboros-migrate'),'--database-url-file',str(root/'runtime/migrate.url')])
firm,human,agent,grant,child,control=[str(uuid.uuid4()) for _ in range(6)]
role='ouro_service_'+secrets.token_hex(4)
pw=secrets.token_hex(24)
sql(f"""CREATE ROLE {role} LOGIN PASSWORD '{pw}';
GRANT CONNECT ON DATABASE {db} TO {role};
GRANT USAGE ON SCHEMA public TO {role};
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {role};
INSERT INTO firms(id) VALUES('{firm}');
INSERT INTO principals VALUES('{firm}','{human}','human',true),('{firm}','{agent}','agent',true);
INSERT INTO credentials VALUES('{fps['human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES
('{firm}','{grant}','{human}',NULL,ARRAY['work.create','execution.start','inspect','file.read','file.upload','file.publish','db.read','db.write','model.responses','mcp'],clock_timestamp()+interval '1 hour'),
('{firm}','{child}','{agent}','{grant}',ARRAY['execution.start','inspect','file.read','file.upload','file.publish','db.read','db.write','model.responses','mcp'],clock_timestamp()+interval '1 hour'),
('{firm}','{control}','{human}',NULL,ARRAY['inspect','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','compute',100,0);
INSERT INTO profiles VALUES('{firm}','codex-fixture',true,100,60);
INSERT INTO limits VALUES('{firm}','resource_calls',40,0);
""",db)
if a.rendered_environment:
    sql(f"UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE id='{control}'",db)
recovery,recovery_child=[str(uuid.uuid4()) for _ in range(2)]
sql(f"""INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES
('{firm}','{recovery}','{human}',NULL,ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour'),
('{firm}','{recovery_child}','{agent}','{recovery}',ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour');""",db)
write(root/'core/db.url',database_url(role,pw,db),70001)
gw_socket=ipc/'gateway/instance.sock'
write(root/'core/config.json',json.dumps({'listen':fixture.endpoint('core'),'tls':tls('core','core',70001),'database_url_file':str(root/'core/db.url'),'firm_id':firm,'gateway_fingerprint':fps['gateway-service'],'runtime_fingerprint':fps['runtime'],**({'wake_poll_interval_ms':100} if a.wake_successor else {})}),70001)
write(root/'gateway/config.json',json.dumps({'listen':fixture.endpoint('gateway'),'tls':tls('gateway','gateway',70002),'core_url':fixture.url('core'),'core_client':tls('gateway','gateway-service',70002),'instance_socket':str(gw_socket)}),70002)
# Bridge traverses only the separate IPC directory; Gateway credentials remain private.
write(root/'cli/config.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('cli','human',70003)}),70003)
write(root/'runtime/config.json',json.dumps({'core_url':fixture.url('core'),'tls':tls('runtime','runtime',0),'profile_id':'codex-fixture','profile':{'image':runtime_values['image'],'docker_socket':str(runtime_values['docker_socket']),'memory_bytes':536870912,'nano_cpus':500000000,'pids_limit':96,'lifetime_seconds':60},'gateway_socket':str(gw_socket),'binary_dir':str(binary),'evidence_dir':str(root/'runtime'),'bridge_uid':runtime_values['bridge_uid'],'guard_uid':runtime_values['guard_uid'],'gateway_uid':70002,'ipc_root':str(ipc)}))
if a.managed_guard:
    managed=json.loads((root/'runtime/config.json').read_text())
    managed['managed_guard']={'systemd_run':'/usr/bin/systemd-run','systemctl':'/usr/bin/systemctl','setpriv':'/usr/bin/setpriv','memory_max_bytes':33554432,'tasks_max':4}
    write(root/'runtime/config.json',json.dumps(managed))
ctx=ssl.create_default_context(cafile=str(root/'cli/ca.pem'))
ctx.load_cert_chain(root/'cli/human.pem',root/'cli/human.key')

def api(path,port='gateway',headers=None):
    try:
        with fixture.opener(ctx).open(urllib.request.Request(fixture.url(port)+path,headers=headers or {}),timeout=3) as response:
            return response.status,json.load(response)
    except urllib.error.HTTPError as e:
        return e.code,e.read().decode()

def cli(*args):
    return json.loads(run([str(binary/'ouroboros-cli'),'--config',str(root/'cli/config.json'),*args],preexec_fn=drop(70003)))

workspace,input_id,initial_upload_id=[str(uuid.uuid4()) for _ in range(3)]
text='Ouroboros controlled input\n'
digest=hashlib.sha256(text.encode()).hexdigest()
artifact=root/'catalog/blobs'
artifact.mkdir(mode=0o700);os.chown(artifact,70005,70005)
store_id,storage_generation=[str(uuid.uuid4()) for _ in range(2)]
sql(f"INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES('{firm}','{store_id}','{storage_generation}',1048576)",db)
binding=root/'catalog/storage.json'
prepare=root/'catalog/prepare.json'
write(prepare,json.dumps({'root':str(artifact),'binding_file':str(binding),'owner_uid':70005,'firm_id':firm,'store_id':store_id,'generation':storage_generation}),70005)
run([str(binary/'ouroboros-storage'),'prepare','--config',str(prepare)],preexec_fn=drop(70005))
store_check=[str(binary/'ouroboros-storage'),'check','--binding-file',str(binding),'--firm',firm,'--store',store_id,'--generation',storage_generation]
if a.rendered_environment:
    wrong=store_check.copy();wrong[-1]=str(uuid.uuid4())
    denied=subprocess.run(wrong,preexec_fn=drop(70005),env=child_env,capture_output=True,timeout=5)
    assert denied.returncode!=0
    assert json.loads(run(store_check,preexec_fn=drop(70005)))['ready']

write(artifact/digest,text,70005,0o400)
if a.conversation_reply:
    sql(f"UPDATE delegations SET actions=actions||ARRAY['conversation.read','conversation.send'] WHERE firm_id='{firm}'",db)
resource_dbs={}
service_fault_proxy=None
for name,uid in [('company',70004),('catalog',70005),('fixture',70006)]:
    config={'listen':fixture.endpoint(name),'tls':tls(name,name,uid),'core_url':fixture.url('core'),'core_client':tls(name,name,uid),'gateway_fingerprint':fps['gateway-service'],'role':name}
    if name!='fixture':
        rd='ouro_'+name+'_'+secrets.token_hex(4)
        rp=secrets.token_hex(24)
        sql(f"CREATE ROLE {rd} LOGIN PASSWORD '{rp}'; CREATE DATABASE {rd} OWNER {rd};")
        migrate=root/'runtime'/f'{name}.url'
        write(migrate,database_url(rd,rp,rd))
        run([str(binary/'ouroboros-resource-migrate'),'--role',name,'--database-url-file',str(migrate)])
        service='ouro_rw_'+secrets.token_hex(4);sp=secrets.token_hex(24)
        tables='inputs,results,effect_receipts' if name=='company' else 'workspaces,workspace_snapshots,uploads,publication_receipts,upload_staging,blob_objects,upload_object_holds,revision_object_holds,workspace_create_receipts,catalog_retirements,catalog_collections'
        sql(f"CREATE ROLE {service} LOGIN PASSWORD '{sp}'; GRANT CONNECT ON DATABASE {rd} TO {service}; GRANT USAGE ON SCHEMA public TO {service}; GRANT SELECT,INSERT,UPDATE ON {tables} TO {service};",rd)
        write(root/name/'db.url',database_url(service,sp,rd),uid)
        config['database_url_file']=str(root/name/'db.url')
        resource_dbs[name]=rd
        if name=='catalog':
            config['storage_binding_file']=str(binding)
            sql(f"GRANT SELECT ON storage_binding TO {service}; GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {service}; INSERT INTO storage_binding VALUES(true,'{firm}','{store_id}','{storage_generation}');",rd)
            # Synthetic metadata for the manually seeded input; this setup does not prove the upload API path.
            sql(f"INSERT INTO uploads(firm_id,intent_id,digest,size) VALUES('{firm}','{initial_upload_id}','{digest}',{len(text.encode())});",rd)
            sql(f"INSERT INTO workspaces VALUES('{firm}','{workspace}',0,'{json.dumps({'input.txt':digest})}');",rd)
        else:sql(f"INSERT INTO inputs VALUES('{firm}','{input_id}','{{\"marker\":\"company-input\"}}');",rd)
    else:
        config['fixture_command']=f'''set -eu
c() {{ /usr/local/bin/ouroboros-cli --instance request "$@"; }}
test "$(id -u)" = 65532
test "$(ls /sys/class/net)" = lo
test ! -e /var/run/docker.sock
test ! -e /run/docker.sock
test ! -e {shlex.quote(str(root))}
/usr/local/bin/ouroboros-fixture-net-probe 18080 {admin.port} > /workspace/network-proof.txt
c GET /workspaces/{workspace}/snapshots/0/files/input.txt --output /workspace/input.txt
cat /workspace/input.txt
printf '%s' '{{"operation":"read_input","parameters":{{"input_id":"{input_id}"}}}}' > /workspace/query.json
c POST /db/queries --input /workspace/query.json --key fixture-read
printf '%s' '{{"operation":"record_result","parameters":{{"marker":"native-result"}}}}' > /workspace/record.json
c POST /db/transactions --input /workspace/record.json --key fixture-record
printf '%s' 'native-result' > /workspace/result.txt
printf '%s' '{{"size":13,"sha256":"{hashlib.sha256(b'native-result').hexdigest()}"}}' > /workspace/upload.json
upload=$(c POST /uploads --input /workspace/upload.json --key fixture-upload --select /upload_id)
c PUT /uploads/$upload/content --input /workspace/result.txt
printf '{{"workspace_id":"{workspace}","expected_revision":0,"files":{{"result.txt":"%s"}}}}' "$upload" > /workspace/publication.json
c POST /publications --input /workspace/publication.json --key fixture-publication
c GET /workspaces/{workspace}/snapshots/1/files/result.txt
cat /workspace/network-proof.txt
printf '\\nOUROBOROS_NATIVE_WORK_COMPLETE\\n'
'''
    if name=='fixture' and a.managed_mcp:
        config['fixture_command'] = '# ouroboros-managed-mcp\n'+config['fixture_command']
    if name=='fixture' and a.native_adapter:
        config['fixture_command'] = '# ouroboros-adapter-child '+adapter_child+'\n'+config['fixture_command']
    if name=='fixture' and (a.native_adapter_stop or a.native_adapter_running_stop):
        config['fixture_command'] += '\nsleep 5\n'
    if name=='fixture' and a.materialized_native:
        config['fixture_command'] = "test \"$(cat /workspace/task/input.txt)\" = 'managed-native-input'\n" + config['fixture_command']
    if name=='fixture' and (a.revoke_native or a.control_native):
        config['fixture_command'] += "touch /workspace/revoke-ready\n"
        if a.conversation_reply:
            config['fixture_command'] += f'''w=$(c GET /conditions --select /work_id)
conversation=null
for attempt in $(seq 1 100); do
  if conversation=$(c GET /work/$w/conversations --select /items/0/id 2>/dev/null); then break; fi
  conversation=null
  sleep 0.1
done
test "$conversation" != null
for attempt in $(seq 1 100); do
  delivery=$(c GET /conversations/$conversation/messages --select /messages/0/deliveries/0/state 2>/dev/null) || delivery=pending
  test "$delivery" = succeeded && break
  sleep 0.1
done
test "$delivery" = succeeded
message=$(c GET /conversations/$conversation/messages --select /messages/0/id)
test "$(c GET /conversations/$conversation/messages --select /messages/0/text)" = 'Keep the current task; report the existing fixture result when finished.'
printf '{{"delegation_id":"{child}","text":"The authorized fixture result is recorded and published.","reply_to":"%s"}}' "$message" > /workspace/conversation-reply.json
c POST /conversations/$conversation/messages --input /workspace/conversation-reply.json --key native-fixture-reply
'''
        config['fixture_command'] += "while :; do sleep 1; done\n"
    if name=='fixture' and a.runtime_unit_loss:
        config['fixture_command'] += "touch /workspace/runtime-loss-ready\nwhile :; do sleep 1; done\n"
    if name=='company' and a.bounded_service_fault:
        from storage_fault_proxy import StorageFaultProxy
        service_fault_proxy=StorageFaultProxy(fixture.host,fixture.url('core'),root/'company/ca.pem',root/'company/company.pem',root/'company/company.key',fps['company'])
        config['core_url']=service_fault_proxy.url
    write(root/name/'config.json',json.dumps(config),uid)
    target_config={'input_id':input_id} if name=='company' else {'workspace_id':workspace,'store_id':store_id,'storage_generation':storage_generation,'max_file_bytes':65536,'transfer_seconds':120} if name=='catalog' else {'fixture':True}
    sql(f"INSERT INTO resource_targets VALUES('{firm}','{name}','{fps[name]}',true,'{json.dumps(target_config)}',2097152);",db)
gateway=json.loads((root/'gateway/config.json').read_text())
gateway['native_routes']={'model':'fixture','mcp':'fixture'}
gateway['workers']={name:fixture.url(name) for name in ['company','catalog','fixture']}
if a.encrypted_provider:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    custody='native_custody_'+secrets.token_hex(4)
    cp=secrets.token_hex(24)
    sql(f"CREATE ROLE {custody} LOGIN PASSWORD '{cp}'; CREATE DATABASE {custody} OWNER {custody};")
    migrate=root/'runtime/custody.url';write(migrate,database_url(custody,cp,custody))
    run([str(binary/'ouroboros-resource-migrate'),'--role','custody','--database-url-file',str(migrate)])
    service='native_custody_worker_'+secrets.token_hex(4);sp=secrets.token_hex(24)
    sql(f"CREATE ROLE {service} LOGIN PASSWORD '{sp}'; GRANT USAGE ON SCHEMA public TO {service}; GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts TO {service}; GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {service}; GRANT INSERT(owner_id,attempt_id,credential_id,version) ON credential_use_claims TO {service}; GRANT INSERT(owner_id,attempt_id,ticket_sha256,reply) ON provider_receipts TO {service};",custody)
    credential=uuid.uuid4();encryption_key=secrets.token_bytes(32);nonce=secrets.token_bytes(12)
    header=b'ouroboros-credential-aes256gcm-1'
    aad=header+uuid.UUID(firm).bytes+credential.bytes+(1).to_bytes(8,'big')
    envelope=header+nonce+AESGCM(encryption_key).encrypt(nonce,b'synthetic-native-only',aad)
    sql(f"INSERT INTO credential_versions(owner_id,credential_id,version,envelope) VALUES('{firm}','{credential}',1,decode('{envelope.hex()}','hex'));",custody)
    key_path=root/'provider/custody.key';key_path.write_bytes(encryption_key);key_path.chmod(0o600);os.chown(key_path,70007,70007)
    del encryption_key
    write(root/'provider/db.url',database_url(service,sp,custody),70007)
    def free_port():
        with socket.socket() as sock: sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
    upstream_port,provider_port=free_port(),free_port()
    upstream_tls=tls('upstream','upstream',70008)
    write(root/'upstream/server.py',Path(__file__).with_name('native-provider-fixture.py').read_text(),70008)
    write(root/'upstream/server.json',json.dumps({'port':upstream_port,'command':json.loads((root/'fixture/config.json').read_text())['fixture_command'],'adapter':a.native_adapter,'max_calls':8 if a.native_adapter else 3}),70008)
    provider_binding={'target':'managed-model','endpoint':f'https://127.0.0.1:{upstream_port}/responses','credential_id':str(credential),'credential_version':1,'timeout_ms':10000,'max_response_bytes':65536}
    provider_tls=tls('provider','provider',70007)
    write(root/'provider/config.json',json.dumps({'listen':f'127.0.0.1:{provider_port}','tls':provider_tls,'core_url':fixture.url('core'),'core_client':provider_tls,'gateway_fingerprint':fps['gateway-service'],'role':'provider','database_url_file':str(root/'provider/db.url'),'key_file':str(key_path),'provider_ca_file':str(root/'provider/ca.pem'),'provider':provider_binding}),70007)
    sql(f"INSERT INTO resource_targets VALUES('{firm}','managed-model','{fps['provider']}',true,'{json.dumps(provider_binding)}',2097152);",db)
    gateway['native_routes']['model']='managed-model';gateway['workers']['managed-model']=f'https://127.0.0.1:{provider_port}'

if a.materialized_native:
    native_namespace=str(uuid.uuid4())
    target_config={'namespace_id':native_namespace,'store_id':store_id,'storage_generation':storage_generation,'max_file_bytes':65536,'transfer_seconds':120}
    sql(f"INSERT INTO resource_targets VALUES('{firm}','native-inputs','{fps['catalog']}',true,'{json.dumps(target_config)}',2097152); INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES('{firm}','{native_namespace}','native-inputs','{store_id}','{storage_generation}',2);",db)
    gateway['workers']['native-inputs']=fixture.url('catalog')
write(root/'gateway/config.json',json.dumps(gateway),70002)

def query(statement,database):
    return fixture.sql(statement,database)

# Each source path is known to exist. A missing file or a crashed probe cannot count as denial.
def credential_boundaries():
    observations=[]
    owners={'core':70001,'gateway':70002,'cli':70003,'company':70004,'catalog':70005,'fixture':70006}
    secrets_by_owner={'core':root/'core/core.key','gateway':root/'gateway/gateway-service.key',
                      'cli':root/'cli/human.key','company':root/'company/db.url',
                      'catalog':root/'catalog/db.url','fixture':root/'fixture/fixture.key',
                      'runtime':root/'runtime/runtime.key','ca':root/'ca/ca.key'}
    if a.encrypted_provider:
        owners.update(provider=70007,upstream=70008)
        secrets_by_owner.update(provider=root/'provider/custody.key',upstream=root/'upstream/upstream.key')
    assert all(path.is_file() for path in secrets_by_owner.values())
    probe="""import errno,json,pathlib,socket,sys
own=pathlib.Path(sys.argv[1]); assert own.open('rb').read(1)
for value in json.loads(sys.argv[2]):
 try:
  with open(value,'rb') as stream:stream.read(1)
 except PermissionError as error:assert error.errno in (errno.EACCES,errno.EPERM)
 else:raise AssertionError('another service credential was readable')
with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as sock:
 try:sock.connect(sys.argv[3])
 except PermissionError as error:assert error.errno in (errno.EACCES,errno.EPERM)
 else:raise AssertionError('non-Runtime service reached Docker')
print('denied')
"""
    for owner,uid in owners.items():
        other=[str(path) for name,path in secrets_by_owner.items() if name!=owner]
        assert run(['python3','-c',probe,str(secrets_by_owner[owner]),json.dumps(other),str(runtime_values['docker_socket'])],preexec_fn=drop(uid)).strip()==b'denied'
        observations.append({'service':owner,'uid':uid,'other_credentials_denied':len(other),'docker_socket':'denied','own_credential':'readable'})
    write(root/'credential-boundaries.json',json.dumps(observations,indent=2))
    return observations


def controlled_native():
    global cid
    assert not a.revoke_native
    sql(f"UPDATE delegations SET actions=actions||ARRAY['execution.steer','execution.interrupt'] WHERE id='{grant}'",db)
    for _ in range(150):
        state=cli('get','executions',accepted['resource_id'])
        if state['instance_id'] and state.get('native_turn'):
            evidence=root/'runtime'/state['instance_id']
            path=evidence/'container.json'
            if path.exists():
                cid=json.loads(path.read_text())['container_id']
                ready=subprocess.run(fixture.docker('exec','--user','65532:65532',cid,'test','-f','/workspace/revoke-ready'),capture_output=True,timeout=2,env=child_env)
                if ready.returncode==0:break
        assert runtime.poll() is None,'native Runtime exited before control checkpoint'
        time.sleep(.1)
    else:raise AssertionError('native control checkpoint missing')
    turn=state['native_turn']; controls=[];conversation=None;message=None
    if a.conversation_control:
        sql(f"UPDATE delegations SET actions=actions||ARRAY['conversation.create','conversation.send','conversation.read'] WHERE firm_id='{firm}'",db)
        def post_conversation(url,body,key):
            path=root/'cli'/(key+'.json');write(path,json.dumps(body),70003)
            return cli('request','POST',url,'--input',str(path),'--key',key)
        conversation=post_conversation('/conversations',{'work_id':work,'delegation_id':grant,'responsible_agent_id':agent},'native-conversation')['resource_id']
        message=post_conversation('/conversations/'+conversation+'/messages',{'delegation_id':grant,'text':'Keep the current task; report the existing fixture result when finished.'},'native-message')['resource_id']
    if a.ack_timeout:return delayed_ack_native(state,evidence,turn)
    for instruction in [{'kind':'steer','text':'Keep the current task; report the existing fixture result when finished.'},{'kind':'interrupt'}]:
        body={'delegation_id':grant,'thread_id':turn['thread_id'],'turn_id':turn['turn_id'],'instruction':instruction}
        path=root/'cli'/('control-'+instruction['kind']+'.json');write(path,json.dumps(body),70003)
        if a.conversation_control and instruction['kind']=='steer':
            target={'delegation_id':grant,'execution_id':accepted['resource_id'],'thread_id':turn['thread_id'],'turn_id':turn['turn_id']}
            command=post_conversation('/conversations/'+conversation+'/messages/'+message+'/deliver',target,'native-message-delivery')
            replay=post_conversation('/conversations/'+conversation+'/messages/'+message+'/deliver',target,'native-message-delivery-replay')
            assert replay['replayed'] and replay['intent_id']==command['intent_id']
        else:
            command=cli('native-control',accepted['resource_id'],'--input',str(path),'--key','native-'+instruction['kind'])
        for _ in range(60):
            record=cli('get','intents',command['intent_id'])
            if record['state']=='succeeded':break
            assert record['state'] in ['accepted','claimed']
            time.sleep(.1)
        else:raise AssertionError('native acknowledgement missing')
        controls.append(command['intent_id'])
        if a.conversation_reply and instruction['kind']=='steer':
            for _ in range(80):
                page=cli('request','GET','/conversations/'+conversation+'/messages')
                if len(page['messages'])==2:break
                time.sleep(.1)
            else:raise AssertionError('native addressed reply missing')
            reply=page['messages'][1]
            assert reply['author_kind']=='agent' and reply['author_principal_id']==agent and reply['reply_to']==message
            assert reply['origin_instance_id']==state['instance_id']
            assert reply['native_context']=={'execution_id':accepted['resource_id'],'thread_id':turn['thread_id'],'turn_id':turn['turn_id'],'source':'core_active_turn'}
            assert reply['text']=='The authorized fixture result is recorded and published.'

    if a.conversation_control:
        page=cli('request','GET','/conversations/'+conversation+'/messages?cursor=0')
        assert len(page['messages'])==(2 if a.conversation_reply else 1) and page['messages'][0]['id']==message
        assert page['messages'][0]['deliveries']==[{'recipient_principal_id':agent,'intent_id':controls[0],'state':'succeeded'}]
        assert page['messages'][0]['author_kind']=='human'
    assert runtime.wait(timeout=8)==0
    state=cli('get','executions',accepted['resource_id'])
    assert state['terminated'] and state['compute_return']['units']==70
    assert query("SELECT committed FROM limits WHERE id='compute'",db)=='0'
    assert query("SELECT count(*) FROM native_control_acks",db)=='2'
    assert query("SELECT status FROM native_turns",db)=='interrupted'
    assert query('SELECT count(*) FROM results',resource_dbs['company'])=='1'
    assert query('SELECT count(*) FROM effect_receipts',resource_dbs['company'])=='1'
    assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])==str(1+int(a.materialized_native))
    checkpoint=(evidence/'native-checkpoint.jsonl').read_bytes()
    capture=json.loads((evidence/'native-checkpoint.json').read_text())
    assert capture['execution_id']==accepted['resource_id'] and capture['thread_id']==turn['thread_id']
    assert capture['bytes']==len(checkpoint) and capture['sha256']==hashlib.sha256(checkpoint).hexdigest()
    assert capture['resume_qualified'] is False
    saved=list(evidence.glob('native-ack-*.json'))
    assert len(saved)==2,'native acknowledgements were not durably recorded'
    terminal_receipt=json.loads((evidence/'native-terminal.json').read_text())
    assert terminal_receipt=={'execution_id':accepted['resource_id'],'report':{'thread_id':turn['thread_id'],'turn_id':turn['turn_id'],'status':'interrupted'}}
    original_trace=(evidence/'native.jsonl').read_bytes()
    original_acks=query('SELECT json_agg(t ORDER BY intent_id)::text FROM native_control_acks t',db)
    for _ in range(2):
        run([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],timeout=15)
        assert query('SELECT json_agg(t ORDER BY intent_id)::text FROM native_control_acks t',db)==original_acks
        assert query("SELECT status FROM native_turns",db)=='interrupted'
        assert query('SELECT count(*) FROM compute_returns',db)=='1'
        assert query("SELECT committed FROM limits WHERE id='compute'",db)=='0'
        assert query('SELECT count(*) FROM results',resource_dbs['company'])==('6' if a.bounded_service_fault else '3' if a.bounded_service_db else '1')
        assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])==str(1+int(a.materialized_native))
        assert (evidence/'native.jsonl').read_bytes()==original_trace,'reconciliation changed native execution trace'
    events=[json.loads(line) for line in original_trace.splitlines()]
    assert any(e.get('method')=='turn/completed' and e['params']['threadId']==turn['thread_id'] and e['params']['turn']['id']==turn['turn_id'] and e['params']['turn']['status']=='interrupted' for e in events)
    admitted_checkpoint=publish_checkpoint(evidence,checkpoint,capture)
    successor=resume_native(state,turn,admitted_checkpoint) if a.successor_native else None
    if successor:admitted_checkpoint['native_successor_admission']='INPUT_ADMITTED_RESTORE_REJECTED' if (a.invalid_checkpoint or a.revoke_restore) else 'PASS'
    return {'result':'PASS','scenario':'native-materialized-controls' if a.materialized_native else 'native-controls','fixture_id':fixture.identity,'conversation_id':conversation,'message_id':message,'addressed_reply':'PASS' if a.conversation_reply else 'NOT RUN','controls':controls,'native_turn':turn,'checkpoint_artifact':admitted_checkpoint,'successor':successor,
        'checks':['real Codex executes the fixture workflow through Gateway','CLI steering acknowledged by the bound real native turn','CLI interruption produces the matching native interrupted event','compute returns once while committed DB and publication receipts survive','two stop-only reconciliations preserve original acknowledgements without native execution'],
        'subscription':'NOT RUN','model_semantic_steering_effect':'NOT RUN','native_checkpoint_recovery':'REJECTED_AS_EXPECTED' if (a.invalid_checkpoint or a.revoke_restore) else 'PASS' if successor else 'NOT RUN'}

def resume_native(previous,turn,artifact):
    global runtime,cid
    assert a.materialized_native
    request=json.loads((root/'cli/start.json').read_text())
    request['predecessor_execution_id']=accepted['resource_id']
    request['program']['native']={'prompt':'Continue the same authorized work from the saved context; preserve already committed results.','resume':{'thread_id':turn['thread_id'],'checkpoint_destination':'state/session.jsonl'}}
    request['program']['inputs'].append({'target':artifact['target'],'workspace_id':artifact['workspace_id'],'revision':artifact['revision'],'file':artifact['file'],'destination':'state/session.jsonl'})
    path=root/'cli/successor.json';write(path,json.dumps(request),70003)
    failed=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(root/'cli/config.json'),'start','--input',str(path),'--key','native-successor-old-rights'],preexec_fn=drop(70003),env=child_env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
    assert failed.returncode!=0 and b'403' in failed.stderr,'removed read right restored by predecessor'
    next_grant,next_child=[str(uuid.uuid4()) for _ in range(2)]
    # Explicit new synthetic grants; historical revocation is not undone.
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{next_grant}',principal_id,NULL,actions||ARRAY['file.read'],expires_at FROM delegations WHERE id='{grant}'; INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{next_child}',principal_id,'{next_grant}',actions,expires_at FROM delegations WHERE id='{child}';",db)
    for old,new in [(grant,next_grant),(child,next_child)]:
        sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,'{new}',target_id,operations,namespace_id FROM resource_scopes WHERE delegation_id='{old}';",db)
    request['delegation_id']=next_grant;request['agent_delegation_id']=next_child
    write(path,json.dumps(request),70003)
    wake_id=None
    if a.wake_successor:
        sql(f"UPDATE delegations SET actions=actions||ARRAY['wake.register'] WHERE firm_id='{firm}' AND id='{next_grant}'",db)
        timer={'due_at_seconds':int(time.time())+3,'expires_at_seconds':int(time.time())+120,'execution':request}
        timer_path=root/'cli/successor-timer.json';write(timer_path,json.dumps(timer),70003)
        wake_id=cli('request','POST','/wakes','--input',str(timer_path),'--key','native-successor-timer')['resource_id']
        assert cli('request','GET','/wakes/'+wake_id)['execution_intent_id'] is None
        for _ in range(80):
            wake=cli('request','GET','/wakes/'+wake_id)
            if wake['execution_intent_id']:break
            time.sleep(.1)
        else:raise AssertionError('native successor timer did not deliver')
        next_execution=cli('get','intents',wake['execution_intent_id'])['resource_id']
        assert query(f"SELECT count(*) FROM wake_occurrences WHERE wake_id='{wake_id}'",db)=='1'
        replay=cli('request','POST','/wakes','--input',str(timer_path),'--key','native-successor-timer')
        assert replay['replayed'] and replay['resource_id']==wake_id
    else:
        next_execution=cli('start','--input',str(path),'--key','native-successor')['resource_id']
    log=(root/'runtime/successor-process.log').open('wb')
    runtime=subprocess.Popen([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json')],stdout=log,stderr=log,env=child_env);log.close()
    if a.revoke_restore:
        for _ in range(120):
            state=cli('get','executions',next_execution)
            if state['instance_id']:
                evidence=root/'runtime'/state['instance_id']
                container=evidence/'container.json'
                if container.exists():
                    cid=json.loads(container.read_text())['container_id']
                    ready=subprocess.run(fixture.docker('exec','--user','65532:65532',cid,'test','-f','/tmp/checkpoint-read-ready'),capture_output=True,timeout=2,env=child_env)
                    if ready.returncode==0:break
            assert runtime.poll() is None,'Runtime exited before checkpoint read barrier'
            time.sleep(.05)
        else:raise AssertionError('checkpoint read barrier was not reached')
        assert (evidence/'materialization.json').exists() and not (evidence/'native.jsonl').exists()
        cli('revoke',next_grant,'--revision','0','--key','restore-revoke')
    exit_code=runtime.wait(timeout=65)
    assert (exit_code!=0) if (a.invalid_checkpoint or a.revoke_restore) else (exit_code==0),'unexpected native successor exit; protected evidence retained'
    state=cli('get','executions',next_execution)
    assert state['instance_id']!=previous['instance_id'] and state['terminated']
    evidence=root/'runtime'/state['instance_id'];cid=json.loads((evidence/'container.json').read_text())['container_id']
    if a.invalid_checkpoint or a.revoke_restore:
        assert not (evidence/'native-restore.json').exists() and not (evidence/'native.jsonl').exists()
        assert (evidence/'materialization.json').exists(),'invalid state was not tested after valid materialization'
        expected='403 Forbidden' if a.revoke_restore else 'native checkpoint identity mismatch' if a.invalid_checkpoint=='identity' else 'incomplete or oversized native state'
        assert expected in (root/'runtime/successor-process.log').read_text()
        assert query(f"SELECT count(*) FROM resource_calls WHERE instance_id='{state['instance_id']}' AND operation='model.responses'",db)=='0'
        assert query('SELECT count(*) FROM compute_returns',db)=='2' and query("SELECT committed FROM limits WHERE id='compute'",db)=='0'
        assert query('SELECT count(*) FROM execution_inputs',db)=='3'
        assert query('SELECT count(*) FROM results',resource_dbs['company'])==('6' if a.bounded_service_fault else '3' if a.bounded_service_db else '1') and query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])=='3'
        return {'result':'PASS','scenario':'revoked-during-checkpoint-read' if a.revoke_restore else 'invalid-checkpoint-'+a.invalid_checkpoint,'outcome':'rejected_before_native_start','execution_id':next_execution,'materialized':True,'new_model_calls':0,'original_effects_preserved':True,'subscription':'NOT RUN'}
    restored=json.loads((evidence/'native-restore.json').read_text())
    assert restored['execution_id']==next_execution and restored['instance_id']==state['instance_id'] and restored['thread_id']==turn['thread_id']
    frames=[json.loads(line) for line in (evidence/'native.jsonl').read_text().splitlines()]
    resumed=[e['result']['thread'] for e in frames if isinstance(e.get('result'),dict) and 'thread' in e['result']]
    assert len(resumed)==1 and resumed[0]['id']==turn['thread_id'] and any(t['id']==turn['turn_id'] for t in resumed[0]['turns'])
    final=json.loads((evidence/'native-terminal.json').read_text())['report']
    assert final['thread_id']==turn['thread_id'] and final['turn_id']!=turn['turn_id'] and final['status']=='completed'
    assert query('SELECT count(*) FROM compute_returns',db)=='2' and query("SELECT committed FROM limits WHERE id='compute'",db)=='0'
    assert query('SELECT count(*) FROM execution_inputs',db)=='3'
    assert query('SELECT count(*) FROM results',resource_dbs['company'])=='1'
    assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])=='3'
    return {'result':'PASS','wake_id':wake_id,'admission':'core_timer' if wake_id else 'direct_start','execution_id':next_execution,'instance_id':state['instance_id'],'thread_id':final['thread_id'],'turn_id':final['turn_id'],'old_read_rights':'DENIED','new_synthetic_grants':True,'restored_inputs':2,'original_effects_preserved':True,'subscription':'NOT RUN'}


def configure_native_profile():
    cfg=json.loads((root/'runtime/config.json').read_text())
    profile={**cfg['profile'],'native_codex':True,'compute_units':70,'workspace_bytes':67108864,'home_bytes':33554432,'temporary_bytes':16777216,'max_input_files':8,'max_input_bytes':1048576,'max_file_bytes':65536,'max_output_bytes':2097152}
    profile.pop('docker_socket')
    cfg['program']=profile;cfg['profile_id']='native-input-fixture'
    write(root/'runtime/config.json',json.dumps(cfg))
    return profile


def prepare_native_inputs():
    sql(f"UPDATE delegations SET actions=actions||ARRAY['workspace.create'] WHERE id='{grant}'",db)
    for delegation,ops in [(grant,['inspect','workspace.create','file.read','file.upload','file.publish']),(child,['inspect','file.read'])]:
        sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{firm}','{work}','{delegation}','native-inputs',ARRAY[{','.join(repr(x) for x in ops)}],'{native_namespace}');",db)
    scope=['--work',work,'--delegation',grant,'--target','native-inputs']
    def post(url,body,key):
        path=root/'cli'/('input-'+key+'.json');write(path,json.dumps(body),70003)
        return cli('request','POST',url,'--input',str(path),'--key',key,*scope)
    selected=post('/workspaces',{'label':'Native retained inputs'},'native-input-workspace')['workspace_id']
    data=b'managed-native-input\n'
    upload=post('/uploads',{'size':len(data),'sha256':hashlib.sha256(data).hexdigest()},'native-input-upload')['upload_id']
    path=root/'cli/native-input.txt';write(path,data.decode(),70003)
    cli('request','PUT','/uploads/'+upload+'/content','--input',str(path),*scope)
    post('/publications',{'workspace_id':selected,'expected_revision':0,'files':{'input.txt':upload}},'native-input-publication')
    profile=configure_native_profile()
    sql(f"INSERT INTO profiles VALUES('{firm}','native-input-fixture',true,100,60); INSERT INTO program_profiles(firm_id,profile_id,profile,active) VALUES('{firm}','native-input-fixture','{json.dumps(profile)}',true);",db)
    return {'native':{'prompt':'Perform the authorized fixture and use the managed task input.'},'argv':[],'inputs':[{'target':'native-inputs','workspace_id':selected,'revision':1,'file':'input.txt','destination':'task/input.txt'}]}


def publish_checkpoint(evidence,checkpoint,capture):
    # The fixture owner submits captured bytes through ordinary Gateway APIs.
    # This is not a privileged Runtime write into catalog storage.
    selected_workspace=json.loads((root/'cli/start.json').read_text())['program']['inputs'][0]['workspace_id'] if a.materialized_native else workspace
    scope=['--work',work,'--delegation',grant]+(['--target','native-inputs'] if a.materialized_native else [])
    if a.invalid_checkpoint=='identity':
        lines=checkpoint.splitlines();first=json.loads(lines[0]);first['payload']['id']=str(uuid.uuid4());checkpoint=json.dumps(first).encode()+b'\n'+b'\n'.join(lines[1:])+b'\n'
    elif a.invalid_checkpoint=='truncated':checkpoint=checkpoint[:-1]
    files={}
    for name,data in [('session.jsonl',checkpoint),('capture.json',json.dumps(capture).encode())]:
        body=root/'cli'/('upload-'+name+'.json')
        write(body,json.dumps({'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)}),70003)
        upload=cli('request','POST','/uploads','--input',str(body),'--key','checkpoint-upload-'+name,*scope)
        content=root/'cli'/name;content.write_bytes(data);os.chown(content,70003,70003);content.chmod(0o600)
        result=cli('request','PUT','/uploads/'+upload['upload_id']+'/content','--input',str(content),*scope)
        assert result['sha256']==hashlib.sha256(data).hexdigest()
        files[name]=upload['upload_id']
    body=root/'cli/checkpoint-publication.json';write(body,json.dumps({'workspace_id':selected_workspace,'expected_revision':1,'files':files}),70003)
    publication=cli('request','POST','/publications','--input',str(body),'--key','checkpoint-publication',*scope)
    assert publication['revision']==2
    original=query("SELECT count(*) FROM publication_receipts",resource_dbs['catalog'])
    assert original==str(2+int(a.materialized_native))
    assert cli('request','POST','/publications','--input',str(body),'--key','checkpoint-publication',*scope)==publication
    assert query("SELECT count(*) FROM publication_receipts",resource_dbs['catalog'])==original
    url=f'/workspaces/{selected_workspace}/snapshots/2/files/session.jsonl'
    output=root/'cli/checkpoint-download.jsonl'
    run([str(binary/'ouroboros-cli'),'--config',str(root/'cli/config.json'),'request','GET',url,'--output',str(output),*scope],preexec_fn=drop(70003))
    assert output.read_bytes()==checkpoint
    sql(f"UPDATE delegations SET actions=array_remove(actions,'file.read') WHERE id='{grant}'",db)
    denied=root/'cli/checkpoint-denied.jsonl'
    result=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(root/'cli/config.json'),'request','GET',url,'--output',str(denied),*scope],preexec_fn=drop(70003),env=child_env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
    assert result.returncode!=0 and b'403' in result.stderr and not denied.exists()
    assert query("SELECT count(*) FROM publication_receipts",resource_dbs['catalog'])==str(2+int(a.materialized_native))
    return {'target':'native-inputs' if a.materialized_native else 'catalog','workspace_id':selected_workspace,'revision':2,'file':'session.jsonl','manifest_file':'capture.json','publication':publication,'current_read_revocation':'PASS','native_successor_admission':'NOT IMPLEMENTED'}


def delayed_ack_native(state,evidence,turn):
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        locked=pool.submit(sql,'BEGIN; LOCK TABLE native_control_acks IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(8); ROLLBACK;',db)
        for _ in range(60):
            if query("SELECT count(*) FROM pg_locks WHERE relation='native_control_acks'::regclass AND mode='AccessExclusiveLock' AND granted",db)=='1':break
            time.sleep(.05)
        else:raise AssertionError('bounded acknowledgement barrier was not acquired')
        path=root/'cli/control-timeout.json'
        write(path,json.dumps({'delegation_id':grant,'thread_id':turn['thread_id'],'turn_id':turn['turn_id'],'instruction':{'kind':'steer','text':'Continue only the existing fixture task.'}}),70003)
        command=cli('native-control',accepted['resource_id'],'--input',str(path),'--key','native-timeout')
        receipt=evidence/('native-ack-'+command['intent_id']+'.json')
        for _ in range(60):
            if receipt.exists():break
            time.sleep(.05)
        else:raise AssertionError('native response not saved before delayed Core delivery')
        assert not locked.done(),'barrier ended before response persistence'
        # The HTTP report deadline is two seconds. Retain the barrier beyond it.
        time.sleep(2.5)
        assert not locked.done(),'barrier did not outlive report timeout'
        locked.result(timeout=12)
    assert runtime.wait(timeout=12)!=0,'report timeout should contain the native execution'
    before=query('SELECT count(*) FROM native_control_acks',db)
    assert before in ['0','1'] # A timed-out request can still commit remotely.
    trace=(evidence/'native.jsonl').read_bytes()
    for _ in range(2):
        run([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']],timeout=15)
        assert query('SELECT count(*) FROM native_control_acks',db)=='1'
        assert query("SELECT count(*) FROM attempts WHERE intent_id='"+command['intent_id']+"'",db)=='1'
        assert cli('get','intents',command['intent_id'])['state']=='succeeded'
        assert (evidence/'native.jsonl').read_bytes()==trace
        assert query('SELECT count(*) FROM results',resource_dbs['company'])==('6' if a.bounded_service_fault else '3' if a.bounded_service_db else '1')
        assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])=='1'
    return {'result':'PASS','scenario':'native-ack-timeout','fixture_id':fixture.identity,'ack_count_before_recovery':int(before),
        'checks':['real native acknowledgement persisted while Core transaction blocked','Core barrier outlived Runtime report deadline','Runtime exited unsuccessfully and stop-only recovery succeeded','two reconciliations preserve one attempt and receipt without changing native trace or resource effects'],
        'subscription':'NOT RUN','native_terminal_recovery':'NOT IMPLEMENTED','native_checkpoint_recovery':'NOT RUN'}


def revoked_native():
    global cid
    # This is a native command that has already committed its results and is still running.
    for _ in range(150):
        state=cli('get','executions',accepted['resource_id'])
        if state['instance_id']:
            evidence=root/'runtime'/state['instance_id']
            path=evidence/'container.json'
            if path.exists():
                cid=json.loads(path.read_text())['container_id']
                ready=subprocess.run(fixture.docker('exec','--user','65532:65532',cid,
                    'test','-f','/workspace/revoke-ready'),capture_output=True,timeout=2,env=child_env)
                trace=evidence/'native.jsonl'
                lines=trace.read_text().splitlines() if trace.exists() else []
                observed=[]
                for line in lines:
                    try:observed.append(json.loads(line))
                    except json.JSONDecodeError:pass # A writer can be between frame writes.
                if ready.returncode==0 and any(e.get('method')=='item/started'
                    and e.get('params',{}).get('item',{}).get('id')=='fixture_work' for e in observed):break
        assert runtime.poll() is None,'native Runtime exited before revocation checkpoint'
        time.sleep(.1)
    else:raise AssertionError('native revocation checkpoint did not appear')
    before=json.loads(run(['docker','inspect',cid]))[0]
    assert before['State']['Running']
    # Inspect tmpfs separately: Docker's Mounts list may omit HostConfig.Tmpfs entries.
    expected_tmpfs={'/workspace':'rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=0700',
                    '/home/agent':'rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=0700',
                    '/tmp':'rw,nosuid,nodev,size=16m,mode=1777'}
    assert before['HostConfig']['Tmpfs']==expected_tmpfs and before['Mounts']==[]
    command=[str(binary/'ouroboros-cli'),'--config',str(root/'cli/config.json')]
    def rejected(args,status):
        response=subprocess.run(command+args,preexec_fn=drop(70003),capture_output=True,timeout=3,env=child_env)
        assert response.returncode!=0 and str(status).encode() in response.stderr,response.stderr.decode()
    def inside_conditions():
        return subprocess.run(fixture.docker('exec','--user','65532:65532',cid,
            '/usr/local/bin/ouroboros-cli','--instance','request','GET','/conditions'),
            capture_output=True,timeout=3,env=child_env)
    assert inside_conditions().returncode==0,'positive control must reach Gateway'
    os.kill(runtime.pid,signal.SIGSTOP)
    try:
        for _ in range(50):
            if Path(f'/proc/{runtime.pid}/status').read_text().split('State:',1)[1].lstrip().startswith('T'):break
            time.sleep(.01)
        else:raise AssertionError('Runtime pause was not observed')
        binding=json.loads((evidence/'binding.json').read_text())
        revoked_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        assert binding['deadline_boottime_ns']-revoked_at>12_000_000_000,'insufficient deadline separation'
        cli('revoke',grant,'--revision','0','--key','native-revoke')
        denied=inside_conditions()
        assert denied.returncode!=0 and b'403' in denied.stderr
        assert json.loads(run(['docker','inspect',cid]))[0]['State']['Running']
        # A new request key must not restore the original revoked authority.
        request=json.loads((root/'cli/start.json').read_text())
        request['predecessor_execution_id']=accepted['resource_id']
        request['units']=10
        write(root/'cli/revoked-start.json',json.dumps(request),70003)
        rejected(['start','--input',str(root/'cli/revoked-start.json'),'--key','revoked-successor'],403)
    finally:
        os.kill(runtime.pid,signal.SIGCONT)
    exit_code=runtime.wait(timeout=8)
    terminated_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    assert terminated_at<binding['deadline_boottime_ns'],'deadline expiry is not revocation proof'
    assert exit_code!=0 and '403' in (root/'runtime/process.log').read_text()
    state=cli('get','executions',accepted['resource_id'])
    finish=json.loads((evidence/'finish.json').read_text())
    assert state['terminated'] and finish['terminated_observed'] and not finish['effects_settled']
    assert not json.loads(run(['docker','inspect',cid]))[0]['State']['Running']
    # Returning confirmed compute is separate from settling company work or external effects.
    # Match the original Runtime receipt to Core's exact reservation before admitting a successor.
    def compute_ledger():
        return json.loads(query(f"""SELECT jsonb_build_object(
            'committed',l.committed,
            'reservations',(SELECT coalesce(jsonb_agg(jsonb_build_object(
                'execution_id',e.id,'intent_id',r.intent_id,'units',r.units,
                'settled',r.settled,'terminated',e.terminated) ORDER BY e.id),'[]'::jsonb)
                FROM reservations r JOIN executions e ON (e.firm_id,e.intent_id)=(r.firm_id,r.intent_id)
                WHERE r.firm_id=l.firm_id AND r.limit_id='compute'),
            'returns',(SELECT coalesce(jsonb_agg(jsonb_build_object(
                'execution_id',c.execution_id,'units',c.units,'receipt',c.receipt)
                ORDER BY c.execution_id),'[]'::jsonb) FROM compute_returns c WHERE c.firm_id=l.firm_id))
            FROM limits l WHERE l.firm_id='{firm}' AND l.id='compute'""",db))
    original_units=json.loads((root/'cli/start.json').read_text())['units']
    original_receipt=json.loads((evidence/'compute-return.json').read_text())
    original_ticket=json.loads((evidence/'intent.json').read_text())['ticket']
    assert original_ticket['execution_id']==accepted['resource_id']
    assert original_ticket['intent_id']==accepted['intent_id']
    assert original_receipt['instance_id']==state['instance_id']==original_ticket['instance_id']
    assert original_receipt['generation']==original_ticket['generation']
    assert original_receipt['binding']==binding
    assert all(original_receipt[k] for k in ['container_terminated','bridge_terminated','guard_terminated'])
    assert state['compute_return']['units']==original_units
    before_successor=compute_ledger()
    assert before_successor=={
        'committed':0,
        'reservations':[{'execution_id':accepted['resource_id'],'intent_id':accepted['intent_id'],
            'units':original_units,'settled':True,'terminated':True}],
        'returns':[{'execution_id':accepted['resource_id'],'units':original_units,'receipt':original_receipt}]
    },'original compute must return exactly once before successor admission'
    # Pre-provisioned current authority permits a successor only after confirmed compute return.
    request['delegation_id']=recovery
    request['agent_delegation_id']=recovery_child
    write(root/'cli/unsettled-start.json',json.dumps(request),70003)
    successor = cli('start','--input',str(root/'cli/unsettled-start.json'),'--key','current-successor')
    assert successor['resource_id'] != accepted['resource_id']
    assert query('SELECT count(*) FROM executions',db)=='2'
    successor_state=cli('get','executions',successor['resource_id'])
    assert successor_state['instance_id'] is None and not successor_state['terminated']
    assert successor_state['compute_return'] is None
    after_successor=compute_ledger()
    assert after_successor['committed']==request['units']
    assert after_successor['returns']==before_successor['returns']
    assert len(after_successor['reservations'])==2
    assert {row['execution_id']:row for row in after_successor['reservations']}=={
        accepted['resource_id']:before_successor['reservations'][0],
        successor['resource_id']:{'execution_id':successor['resource_id'],'intent_id':successor['intent_id'],
            'units':request['units'],'settled':False,'terminated':False}
    },'only the newly admitted successor holds compute; old return is preserved'
    assert query("SELECT count(*) FROM reservations WHERE limit_id='compute' AND NOT settled",db)=='1'
    assert query('SELECT count(*) FROM results',resource_dbs['company'])=='1'
    assert query('SELECT count(*) FROM effect_receipts',resource_dbs['company'])=='1'
    assert query('SELECT revision FROM workspaces',resource_dbs['catalog'])=='1'
    assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])=='1'
    assert query('SELECT committed_bytes FROM storage_budgets',db)=='13'
    publication=query("SELECT intent_id FROM resource_calls WHERE operation='file.publish' AND target_id='catalog'",db)
    rejected(['request','GET','/resource-intents/'+publication,'--work',work,'--delegation',grant],403)
    record=cli('request','GET','/resource-intents/'+publication,'--work',work,'--delegation',control)
    assert record['state']=='succeeded'
    recovered=cli('request','POST','/resource-intents/'+publication+'/reconcile','--work',work,'--delegation',control)
    assert recovered==json.loads(record['reply']['body'])
    for statement,database,expected in [
        ('SELECT count(*) FROM executions',db,'2'),
        ("SELECT committed FROM limits WHERE id='compute'",db,str(request['units'])),
        ("SELECT count(*) FROM reservations WHERE limit_id='compute' AND NOT settled",db,'1'),
        ('SELECT committed_bytes FROM storage_budgets',db,'13'),
        ('SELECT count(*) FROM results',resource_dbs['company'],'1'),
        ('SELECT count(*) FROM effect_receipts',resource_dbs['company'],'1'),
        ('SELECT revision FROM workspaces',resource_dbs['catalog'],'1'),
        ('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'],'1'),
    ]:assert query(statement,database)==expected,'observation changed effects or obligations'
    assert compute_ledger()==after_successor,'receipt observation changed a compute return or reservation'
    events=[json.loads(line) for line in (evidence/'native.jsonl').read_text().splitlines()]
    assert any(e.get('method')=='item/started' and e.get('params',{}).get('item',{}).get('id')=='fixture_work' for e in events)
    assert any(e.get('method')=='item/completed'
        and e.get('params',{}).get('item',{}).get('type')=='mcpToolCall'
        and e['params']['item'].get('id')=='fixture_mcp'
        and e['params']['item'].get('status')=='completed'
        and e['params']['item'].get('error') is None
        and 'ouroboros-native-mcp' in json.dumps(e['params']['item'].get('result')) for e in events)
    result={'result':'PASS','scenario':'native-revocation','fixture_id':fixture.identity,
        'instance_id':state['instance_id'],'image':runtime_values['image'],'runtime_exit':exit_code,
        'runtime_pause_observed':True,'revoked_at_boottime_ns':revoked_at,
        'terminated_at_boottime_ns':terminated_at,'deadline_boottime_ns':binding['deadline_boottime_ns'],
        'gateway_before':200,'gateway_after_revocation':403,'old_grant_successor':403,
        'current_grant_successor_admission':202,'observed_termination':True,
        'returned_compute':original_units,'retained_compute':request['units'],
        'compute_ledger':after_successor,'storage_bytes':13,'publication_revision':1,
        'host_config_tmpfs':before['HostConfig']['Tmpfs'],'bind_or_volume_mounts':before['Mounts'],
        'subscription':'NOT RUN','native_checkpoint_successor':'NOT IMPLEMENTED',
        'native_steer_and_stream_revocation':'NOT RUN','effective_tmpfs_capacity':'NOT RUN'}
    write(root/'revocation.json',json.dumps(result,indent=2))
    return result

try:
    if a.encrypted_provider:
        log=(root/'upstream/process.log').open('wb')
        provider_server=subprocess.Popen(['python3',str(root/'upstream/server.py'),str(root/'upstream')],preexec_fn=drop(70008),stdout=log,stderr=log,env=child_env);log.close()
        for _ in range(50):
            if (root/'upstream/ready').exists():break
            assert provider_server.poll() is None, 'upstream fixture exited'
            time.sleep(.1)
        else:raise RuntimeError('upstream fixture unavailable')
    credential_observations=credential_boundaries()
    if a.rendered_environment:
        from fixture_service_units import start as start_services, verify as verify_services
        if a.materialized_native:configure_native_profile()
        processes,rendered_environment_state=start_services(fixture)
        verify_services(processes,fixture)
    else:
        for name,uid in ([('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)]+([('provider',70007)] if a.encrypted_provider else [])):
            log=(root/name/'process.log').open('wb')
            executable='ouroboros-resources' if name in resource_dbs or name in ['fixture','provider'] else f'ouroboros-{name}'
            processes.append(subprocess.Popen([str(binary/executable),'--config',str(root/name/'config.json')],preexec_fn=drop(uid),stdout=log,stderr=log,env=child_env))
            log.close()
    process_identities=[]
    for proc,(name,uid) in zip(processes,([('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)]+([('provider',70007)] if a.encrypted_provider else []))):
        status=dict(line.split(':',1) for line in Path(f'/proc/{proc.pid}/status').read_text().splitlines() if ':' in line)
        assert [int(x) for x in status['Uid'].split()]==[uid]*4
        actual_groups=sorted(int(value) for value in status['Groups'].split())
        assert set(actual_groups).issubset({uid}) and int(status['CapEff'].strip(),16)==0
        assert status['NoNewPrivs'].strip()=='1'
        process_identities.append({'service':name,'uid':uid,'pid':proc.pid,'supplementary_groups':actual_groups,'effective_capabilities':0,'no_new_privileges':True})
    write(root/'service-identities.json',json.dumps(process_identities,indent=2))
    for _ in range(50):
        try:
            if api('/conditions')[0]==200:break
        except OSError:pass
        time.sleep(.1)
    else:raise RuntimeError('control services not ready')
    assert api('/conditions',port='core')[0]==403,'human certificate bypassed Gateway into Core'
    if a.rendered_environment:
        busy=subprocess.run(store_check,preexec_fn=drop(70005),env=child_env,capture_output=True,timeout=5)
        assert busy.returncode!=0, 'offline store check accepted a competing live writer'

    write(root/'cli/work.json',json.dumps({'purpose':'native connected environment fixture','delegation_id':grant}),70003)
    work=cli('work','--input',str(root/'cli/work.json'),'--key','native-work')['resource_id']
    for target in ['company','catalog','fixture']:
        sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{control}','{target}',ARRAY['inspect']);",db)
    for delegation in [grant,child]:
        for target,ops in [('company',['inspect','db.read','db.write']),('catalog',['inspect','file.read','file.upload','file.publish']),('fixture',['inspect','mcp','model.responses'])]:
            sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{delegation}','{target}',ARRAY[{','.join(repr(x) for x in ops)}]);",db)
    if a.encrypted_provider:
        for scope in [grant,child,control]:
            sql(f"INSERT INTO resource_scopes SELECT firm_id,work_id,delegation_id,'managed-model',operations,namespace_id FROM resource_scopes WHERE firm_id='{firm}' AND work_id='{work}' AND delegation_id='{scope}' AND target_id='fixture';",db)
    write(root/'cli/start.json' ,json.dumps({'work_id':work,'delegation_id':grant,'agent_delegation_id':child,'profile_id':'codex-fixture','units':70,'lifetime_seconds':55,'predecessor_execution_id':None}),70003)
    if a.materialized_native:
        start=json.loads((root/'cli/start.json').read_text());start['program']=prepare_native_inputs();start['profile_id']='native-input-fixture';write(root/'cli/start.json',json.dumps(start),70003)
    if a.native_adapter:
        from native_adapter_fixture import NativeAdapterFixture
        native_adapter = NativeAdapterFixture(globals())
        native_adapter.prepare()
    baseline_bytes=int(query('SELECT committed_bytes FROM storage_budgets',db))
    baseline_publications=int(query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog']))
    baseline_staging=int(query("SELECT count(*) FROM upload_staging WHERE state='committed'",resource_dbs['catalog']))
    accepted=cli('start','--input',str(root/'cli/start.json'),'--key','native-start')
    if native_adapter and not a.native_adapter_stop:native_adapter.start_worker()
    log=(root/'runtime/process.log').open('wb')
    if a.runtime_unit_loss:
        from fixture_runtime_unit_loss import start as start_unit
        runtime_unit=(json.loads((root/'installed-service-bundle.json').read_text())['runtime_unit']
            if a.rendered_environment else 'ouroboros-runtime-fixture-'+uuid.uuid4().hex+'.service')
        runtime=start_unit(binary,root/'runtime/config.json',runtime_unit,log,child_env,rendered=a.rendered_runtime)
    else:
        runtime=subprocess.Popen([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json')],stdout=log,stderr=log,env=child_env)
    log.close()
    if a.native_adapter_stop:native_adapter.stop_pending()
    if a.native_adapter_running_stop:native_adapter.stop_running()
    if a.runtime_unit_loss:
        from fixture_runtime_unit_loss import verify as verify_unit_loss
        result=verify_unit_loss(globals(),runtime_unit,graceful=a.runtime_stop_signal=="TERM")
    elif a.control_native:
        result=controlled_native()
    elif a.revoke_native:
        result=revoked_native()
    else:
        code=runtime.wait(timeout=65)
        state=cli('get','executions',accepted['resource_id'])
        evidence=root/'runtime'/state['instance_id']
        if (evidence/'container.json').exists():cid=json.loads((evidence/'container.json').read_text())['container_id']
        assert code==0, 'native Runtime failed; inspect protected evidence'
        assert state['terminated']
        native=(evidence/'native.jsonl').read_text()
        events=[json.loads(line) for line in native.splitlines()]
        completed=[event['params']['item'] for event in events if event.get('method')=='item/completed'
                   and event.get('params',{}).get('item',{}).get('type')=='commandExecution']
        assert any(item.get('id')=='fixture_work' and item.get('exitCode')==0
                   and item.get('status')=='completed' for item in completed),'completed native command exit 0 required'
        # App Server aggregatedOutput is optional and can omit already-drained startup output.
        # Read the harness's actual tool result sent in its subsequent native Responses request,
        # bound by Core to this exact work/instance; command text and model narration are not proof.
        outputs=json.loads(query(f"""SELECT json_agg(output) FROM intents i
            JOIN resource_calls r ON r.firm_id=i.firm_id AND r.intent_id=i.id
            CROSS JOIN LATERAL jsonb_array_elements(i.input->'input'->'input') output
            WHERE r.firm_id='{firm}' AND r.work_id='{work}' AND r.instance_id='{state['instance_id']}'
              AND r.operation='model.responses' AND output->>'type'='function_call_output'
              AND output->>'call_id'='fixture_work'""",db))
        assert len(outputs)==1 and isinstance(outputs[0].get('output'),str)
        assert 'OUROBOROS_NATIVE_WORK_COMPLETE' in outputs[0]['output']
        assert 'OUROBOROS_DIRECT_ACCESS_DENIED' in outputs[0]['output']
        write(root/'native-tool-output.json',json.dumps({'instance_id':state['instance_id'],
            'work_id':work,'source':'native Responses request recorded by Core','outputs':outputs},indent=2))
        assert any(event.get('method')=='item/completed'
                   and event.get('params',{}).get('item',{}).get('type')=='mcpToolCall'
                   and event['params']['item'].get('id')=='fixture_mcp'
                   and event['params']['item'].get('status')=='completed'
                   and event['params']['item'].get('error') is None
                   and 'ouroboros-native-mcp' in json.dumps(event['params']['item'].get('result'))
                   for event in events)
        assert query('SELECT count(*) FROM results',resource_dbs['company'])==('6' if a.bounded_service_fault else '3' if a.bounded_service_db else '1')
        assert query('SELECT count(*) FROM effect_receipts',resource_dbs['company'])==('6' if a.bounded_service_fault else '3' if a.bounded_service_db else '1')
        assert query(f"SELECT revision FROM workspaces WHERE firm_id='{firm}' AND id='{workspace}'",resource_dbs['catalog'])=='1'
        assert query('SELECT count(*) FROM publication_receipts',resource_dbs['catalog'])==str(1+baseline_publications)
        counts=json.loads(query("SELECT json_object_agg(operation,n) FROM (SELECT operation,count(*) n FROM resource_calls GROUP BY operation) t",db))
        assert all(counts.get(op,0)>0 for op in ['file.read','file.upload','file.publish','db.read','db.write','mcp','model.responses'])
        assert counts['model.responses']==(8 if a.encrypted_provider and a.native_adapter else 4+int(a.native_adapter) if a.managed_mcp else 3)
        if a.managed_mcp:
            observed=[e['params']['item'] for e in events if e.get('method')=='item/completed' and e.get('params',{}).get('item',{}).get('id')=='fixture_managed']
            assert len(observed)==1 and observed[0]['type']=='mcpToolCall'
            assert observed[0]['status']=='completed' and observed[0].get('error') is None
            assert accepted['resource_id'] in json.dumps(observed[0].get('result'))
            assert state['instance_id'] in json.dumps(observed[0].get('result'))

        assert query('SELECT committed_bytes FROM storage_budgets',db)==str(13+baseline_bytes)
        assert query('SELECT count(*) FROM storage_allocations WHERE bytes=13',db)=='1'
        assert query("SELECT count(*) FROM upload_staging WHERE state='committed'",resource_dbs['catalog'])==str(1+baseline_staging)
        detail=json.loads(run(['docker','inspect',cid]))[0]
        assert detail['Config']['User']=='65532:65532'
        assert detail['HostConfig']['NetworkMode']=='none' and detail['HostConfig']['ReadonlyRootfs']
        assert detail['HostConfig']['CapDrop']==['ALL'] and not detail['HostConfig']['Privileged']
        assert 'no-new-privileges:true' in detail['HostConfig']['SecurityOpt']
        assert all(m['Type']=='tmpfs' and m['Destination'] in ['/workspace','/home/agent','/tmp'] for m in detail['Mounts'])
        write(root/'container-inspection.json',json.dumps({
            'id':cid,'image':detail['Image'],'user':detail['Config']['User'],
            'network_mode':detail['HostConfig']['NetworkMode'],'readonly_rootfs':detail['HostConfig']['ReadonlyRootfs'],
            'cap_drop':detail['HostConfig']['CapDrop'],'privileged':detail['HostConfig']['Privileged'],
            'security_opt':detail['HostConfig']['SecurityOpt'],'mounts':detail['Mounts'],
            'running':detail['State']['Running'],'oom_killed':detail['State']['OOMKilled'],
        },indent=2))
        assert query(f"SELECT state FROM intents WHERE id='{accepted['intent_id']}'",db)=='claimed' # execution work outcome remains unresolved
        checks=['real Codex performs registered MCP tool call','native shell uses instance CLI through Gateway','file input and historical snapshot read','prepared DB result and receipt commit once','upload and separate publication commit once',('five' if a.native_adapter else 'four' if a.managed_mcp else 'three')+' controlled native Responses calls','actual termination observed; compute reservation retained']
        if a.managed_mcp:checks.append('actual unmodified Codex discovers and invokes execution_self through managed MCP; Core binds observed execution and instance')
        # Owner can inspect the same work's agent effects, including after target deactivation.
        publication=query("SELECT intent_id FROM resource_calls WHERE operation='file.publish' AND target_id='catalog'",db)
        record=cli('request','GET','/resource-intents/'+publication,'--work',work,'--delegation',grant)
        assert record['state']=='succeeded'
        sql(f"UPDATE resource_targets SET active=false WHERE firm_id='{firm}' AND id='catalog';",db)
        assert cli('request','GET','/resource-intents/'+publication,'--work',work,'--delegation',grant)['reply']==record['reply']
        checks.append('current authorized owner reads inactive-target historical receipt')
        recovered=cli('request','POST','/resource-intents/'+publication+'/reconcile','--work',work,'--delegation',grant)
        assert recovered==json.loads(record['reply']['body'])
        assert query('SELECT committed_bytes FROM storage_budgets',db)==str(13+baseline_bytes)
        assert query(f"SELECT revision FROM workspaces WHERE firm_id='{firm}' AND id='{workspace}'",resource_dbs['catalog'])=='1'
        checks+=['distinct observed service UIDs with no supplementary groups or effective capabilities',
                 'each service reads its own credential and is denied every other service credential',
                 'non-Runtime services cannot connect to Docker socket',
                 'human mTLS cannot enter Core directly',
                 'native private shell denied tested IPv4 metadata, external network, direct DB and host-path access',
                 '13-byte Core allocation and committed catalog staging match native output',
                 'owner reconciles terminated private work through Gateway without new revision or charge']
        adapter_result = native_adapter.verify(events,state) if native_adapter else None
        if native_adapter:checks.append('running native-admitted adapter denies Gateway use after stop while still contained; Runtime observes termination before guard deadline' if a.native_adapter_running_stop else 'native MCP admission stopped before claim while caller remains live; no instance or attempt and reservation retained' if a.native_adapter_stop else 'actual native MCP invocation admits one distinct approved child with bound parent origin and observed exact output')
        result={'adapter_invocation':adapter_result,'result':'PASS','checks':checks,'resource_calls':counts,'fixture_id':fixture.identity,'image':runtime_values['image'],'subscription':'NOT RUN','native_resume_steer_stream_revocation':'NOT RUN','credential_boundaries':credential_observations,'service_identities':process_identities,'full_bypass_matrix':'NOT RUN'}
    if a.encrypted_provider:
        expected_calls=8 if a.native_adapter else 3
        observed=json.loads((root/'upstream/observed.json').read_text());assert observed['count']==expected_calls and observed['authorized']
        assert query('SELECT count(*) FROM credential_use_claims',custody)==str(expected_calls)
        assert query('SELECT count(*) FROM provider_receipts',custody)==str(expected_calls)
        replies=json.loads(query("SELECT json_agg(reply) FROM resource_calls WHERE operation='model.responses'",db))
        assert all(r['receipt']['source']=='provider_worker' and (r['receipt']['requested_model'],r['receipt']['provider_observation']['reported_model']) in ([('fixture-model','fixture-confirmed-native'),('fixture-adapter','fixture-confirmed-adapter')] if a.native_adapter else [('fixture-model','fixture-confirmed-native')]) for r in replies)
        assert all(r['receipt']['provider_observation']['usage']['total_tokens']==2 for r in replies)
        for path in [p for folder in ['runtime','adapter-runtime'] for p in (root/folder).rglob('*')]:
            if path.is_file() and path.suffix in ['.json','.jsonl','.log','.bin']:
                assert b'synthetic-native-only' not in path.read_bytes(), 'provider token appeared in runtime evidence'
        if a.native_adapter:
            provenance=json.loads(query("SELECT json_agg(json_build_object('instance_id',instance_id,'target',target_id,'attempt_id',reply->'receipt'->>'attempt_id','requested_model',reply->'receipt'->>'requested_model','requested_effort',reply->'receipt'->>'requested_effort','reported_model',reply->'receipt'->'provider_observation'->>'reported_model')) FROM resource_calls WHERE operation='model.responses'",db))
            adapter_calls=[r for r in provenance if r['requested_model']=='fixture-adapter']
            assert len(adapter_calls)==3 and all(r['requested_effort']=='low' and r['target']=='managed-model' and r['reported_model']=='fixture-confirmed-adapter' for r in adapter_calls)
            expected_instances={query(f"SELECT instance_id FROM executions WHERE id='{e}'",db) for e in [adapter_result['source']['resource_id'],adapter_result['verification']['resource_id'],adapter_result['native_admission']['resource_id']]}
            assert {r['instance_id'] for r in adapter_calls}==expected_instances
            native_calls=[r for r in provenance if r['requested_model']=='fixture-model']
            assert len(native_calls)==5 and all(r['instance_id']==state['instance_id'] and r['target']=='managed-model' for r in native_calls)
            assert len({r['attempt_id'] for r in provenance})==8
            envelope_bytes=bytes.fromhex(query("SELECT encode(envelope,'hex') FROM credential_versions",custody))
            assert b'synthetic-native-only' not in envelope_bytes
            result['provider_provenance']=provenance
        result['encrypted_provider']={'result':'PASS','upstream_calls':expected_calls,'custody_claims':expected_calls,'saved_replies':expected_calls,'real_account':False,'incremental_stream':True}
    if a.shutdown_services:
        inventory=native_adapter.environment_inventory()
        historical_publication=cli('request','GET','/resource-intents/'+publication,'--work',work,'--delegation',grant)
        historical_db=query("SELECT intent_id FROM effect_receipts WHERE input->>'marker'='native-result'",resource_dbs['company'])
        historical_db_record=cli('request','GET','/resource-intents/'+historical_db,'--work',work,'--delegation',grant)
        company_count=int(query('SELECT count(*) FROM results',resource_dbs['company']))
        assert inventory['admission_paused'] and inventory['instances_without_termination']==0
        assert inventory['runtime_records_without_termination']==0
        # Signal only our owned children; root process ownership is not a Gateway authority grant.
        stopped={}
        mapping=dict(zip(['core','company','catalog','fixture','gateway'],processes[:5]))
        for service in ['gateway','company','catalog','fixture','core']:
            process=mapping[service]
            assert process.poll() is None
            began=time.monotonic();process.terminate()
            assert process.wait(timeout=7)==0
            stopped[service]={'exit_code':0,'seconds':time.monotonic()-began}
            host,port=fixture.endpoint(service).rsplit(':',1)
            try:
                with socket.create_connection((host,int(port)),timeout=.5):pass
            except OSError:pass
            else:raise AssertionError('terminated service listener still reachable')
        with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as unix:
            unix.settimeout(.5)
            try:unix.connect(str(gw_socket))
            except FileNotFoundError:pass
            else:raise AssertionError('graceful Gateway did not retire its socket')
        assert not gw_socket.exists()
        with (root/'gateway/graceful-restart.log').open('xb') as log:
            replacement=subprocess.Popen([str(binary/'ouroboros-gateway'),'--config',str(root/'gateway/config.json')],preexec_fn=drop(70002),stdout=log,stderr=log,env=child_env)
        processes.append(replacement)
        deadline=time.monotonic()+3
        while time.monotonic()<deadline:
            assert replacement.poll() is None
            if gw_socket.exists():
                with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as unix:
                    unix.settimeout(.5)
                    try:unix.connect(str(gw_socket));break
                    except ConnectionRefusedError:pass
            time.sleep(.01)
        else:raise AssertionError('Gateway did not rebind after graceful shutdown')
        original_socket=gw_socket.lstat()
        recover_command=[str(binary/'ouroboros-gateway'),'--config',str(root/'gateway/config.json'),'--recover-instance-socket']
        active_recovery=subprocess.run(recover_command,preexec_fn=drop(70002),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=child_env,timeout=7)
        assert active_recovery.returncode!=0 and gw_socket.lstat().st_ino==original_socket.st_ino
        replacement.kill();replacement.wait(timeout=7)
        assert gw_socket.lstat().st_ino==original_socket.st_ino
        with (root/'gateway/stale-restart.log').open('xb') as log:
            stale=subprocess.Popen([str(binary/'ouroboros-gateway'),'--config',str(root/'gateway/config.json')],preexec_fn=drop(70002),stdout=log,stderr=log,env=child_env)
        processes.append(stale)
        assert stale.wait(timeout=7)!=0, 'restart silently replaced existing Unix socket'
        assert gw_socket.lstat().st_ino==original_socket.st_ino
        recovered=subprocess.run(recover_command,preexec_fn=drop(70002),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=child_env,timeout=7,check=True)
        assert json.loads(recovered.stdout)=={'socket_retired':True,'listeners_started':False,'authority_changed':False}
        assert not gw_socket.exists()
        for service,uid in [('core',70001),('company',70004),('catalog',70005),('fixture',70006),('gateway',70002)]:
            executable='ouroboros-resources' if service in ['company','catalog','fixture'] else 'ouroboros-'+service
            with (root/service/'full-restart.log').open('xb') as log:
                child_process=subprocess.Popen([str(binary/executable),'--config',str(root/service/'config.json')],preexec_fn=drop(uid),stdout=log,stderr=log,env=child_env)
            processes.append(child_process)
        for _ in range(50):
            try:
                restored_inventory=native_adapter.environment_inventory();break
            except subprocess.CalledProcessError:time.sleep(.1)
        else:raise AssertionError('restarted services did not restore current inventory')
        assert {k:v for k,v in restored_inventory.items() if k!='observed_at'}=={k:v for k,v in inventory.items() if k!='observed_at'}
        assert cli('request','GET','/resource-intents/'+publication,'--work',work,'--delegation',grant)==historical_publication
        assert cli('request','GET','/resource-intents/'+historical_db,'--work',work,'--delegation',grant)==historical_db_record
        restored_result=cli('request','POST','/resource-intents/'+historical_db+'/reconcile','--work',work,'--delegation',grant)
        assert restored_result['result_id']==historical_db_record['reply']['receipt']['result_id']
        assert int(query('SELECT count(*) FROM results',resource_dbs['company']))==company_count
        scope=native_adapter.review_scope['delegation_id']
        native_adapter.review_request('/environment/admission',{'delegation_id':scope,'expected_revision':restored_inventory['revision'],'paused':False,'reason':'Fixture explicit resumption after service restart'},'service-restart-resume',True)
        payload=root/'cli/restarted-result.json';write(payload,json.dumps({'operation':'record_result','parameters':{'marker':'after-service-restart'}}),70003)
        fresh=cli('request','POST','/db/transactions','--input',str(payload),'--key','after-service-restart','--work',work,'--delegation',grant)
        assert fresh['result_id']
        assert int(query('SELECT count(*) FROM results',resource_dbs['company']))==company_count+1
        assert query("SELECT count(*) FROM effect_receipts WHERE input->>'marker'='after-service-restart'",resource_dbs['company'])=='1'
        current=native_adapter.environment_inventory()
        native_adapter.review_request('/environment/admission',{'delegation_id':scope,'expected_revision':current['revision'],'paused':True,'reason':'Fixture preserve restricted state before cleanup'},'service-restart-pause',True)
        result['company_restart']={'existing_configuration':True,'paused_state_preserved':True,'inventory_preserved':True,'historical_receipts_preserved':True,'explicit_resume':True,'fresh_db_effects':1}
        result['service_shutdown']={'processes':stopped,'instance_listener_closed':True,'graceful_socket_retired':True,'graceful_restart_bound':True,'active_recovery_denied':True,'explicit_crash_recovery':True,'stale_socket_preserved':True,'unsafe_restart_denied':True,'inventory':inventory,'backup_ready':False}
    if a.managed_guard and not a.runtime_unit_loss:
        bindings=list((root/'runtime').glob('*/guard-binding.json'));assert len(bindings)==1
        binding=json.loads(bindings[0].read_text())
        assert binding['backend']=='systemd' and binding['independent_service']
        assert binding['instance_id']==bindings[0].parent.name and binding['deadline_boottime_ns']>0
        assert binding['identity']['uid']==runtime_values['guard_uid']
        closure=json.loads((bindings[0].parent/'allocation-observation.json').read_text())
        assert closure['guard_terminated'] and closure['bridge_terminated']
        unit_state=run(['/usr/bin/systemctl','show',binding['unit'],'--property=MainPID,LoadState'])
        assert b'MainPID=0' in unit_state
        receipt_path=bindings[0].parent/'guard-closure.json'
        receipt=json.loads(receipt_path.read_text())
        receipt_meta=receipt_path.stat()
        assert binding['receipt_file']=={'device':receipt_meta.st_dev,'inode':receipt_meta.st_ino}
        assert receipt['deadline_boottime_ns']==binding['deadline_boottime_ns']
        assert receipt['state'] in ('empty','deactivated')
        assert receipt_meta.st_uid==0 and receipt_meta.st_mode&0o077==0 and receipt_meta.st_nlink==1
        result['managed_guard']={'result':'PASS','identity':binding['identity'],'independent_service':True,'actual_guard_terminated':True,'helper_is_not_guard':True,'protected_closure_persisted':True}
    if a.rendered_environment:
        from fixture_service_units import stop_phase
        stopped=stop_phase(binary,root,'control',control)
        assert stopped['status']=='phase_stopped'
        result['product_stop']={'runtime':True,'control':True,'obligations_settled':False}
        result['rendered_environment']={'services':5,'authenticated_gateway_ready':True,'runtime_after_gateway':True,'service_isolation_verified':True,'store_preflight':True,'competing_store_check_denied':True,'reviewed_bundle_installed':True,'runtime_waited_for_gateway':True}
    result['scenario_id'] = a.scenario_id
    write(root/'result.json',json.dumps(result,indent=2)+'\n');print(json.dumps(result))
except BaseException as e:
    write(root/'result.json',json.dumps({'result':'FAIL','scenario_id':a.scenario_id,'type':type(e).__name__,'fixture_id':fixture.identity})+'\n');print(json.dumps({'result':'FAIL','fixture_id':fixture.identity}));raise
finally:
    if native_adapter:native_adapter.close()
    if service_fault_proxy is not None:
        service_fault_proxy.close()
        write(root/'service-fault-proxy.json',json.dumps({'faults':service_fault_proxy.events,'observations':service_fault_proxy.observations}))
    if provider_server is not None:
        provider_server.terminate();provider_server.wait(timeout=5)
    if runtime and runtime.poll() is None:
        runtime.terminate()
        try:runtime.wait(timeout=3)
        except subprocess.TimeoutExpired:runtime.kill();runtime.wait()
    containers={json.loads(p.read_text())['container_id'] for folder in ['runtime','adapter-runtime'] for p in (root/folder).glob('*/container.json')}
    if cid:containers.add(cid)
    for container in containers:subprocess.run(fixture.docker('rm','-f',container),env=child_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10,check=True)
    if runtime_unit is not None:
        for unit in [runtime_unit,*[json.loads(p.read_text())['unit'] for p in (root/'runtime').glob('*/guard-binding.json') if json.loads(p.read_text()).get('backend')=='systemd']]:
            unit_state=run(['/usr/bin/systemctl','show',unit,'--property=LoadState,MainPID'])
            if b'LoadState=not-found' not in unit_state:
                run(['/usr/bin/systemctl','stop',unit])
                assert b'MainPID=0' in run(['/usr/bin/systemctl','show',unit,'--property=MainPID'])
                subprocess.run(['/usr/bin/systemctl','reset-failed',unit],capture_output=True,timeout=5)
    if runtime_unit is not None:
        from fixture_runtime_unit_loss import close_rendered
        close_rendered(root,runtime_unit)
    if rendered_environment_state is not None:
        from fixture_service_units import close as close_services
        close_services(processes,rendered_environment_state)
    else:
        for proc in reversed(processes):
            proc.terminate();proc.wait(timeout=3)
