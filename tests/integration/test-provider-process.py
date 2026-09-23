"""Disposable Core/Gateway/provider processes against the already running loopback fixture."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import urllib.parse
import uuid

root = Path(sys.argv[1])
c = json.loads((root/'process-input.json').read_text())
binary = Path(c['binary'])
admin = urllib.parse.urlsplit(Path(c['admin_url_file']).read_text().strip())
assert admin.hostname in ('127.0.0.1', 'localhost')
env = {'PATH':'/usr/lib/postgresql/18/bin:/usr/bin:/bin','LANG':'C.UTF-8'}
os.umask(0o077)
def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, check=True, timeout=20, env=env, **kw).stdout
def sql(statement, database=None):
    e = dict(env, PGHOST=admin.hostname, PGPORT=str(admin.port), PGUSER=urllib.parse.unquote(admin.username), PGPASSWORD=urllib.parse.unquote(admin.password), PGDATABASE=database or admin.path[1:], PGSSLMODE='disable')
    return subprocess.run(['psql','-X','-A','-t','-v','ON_ERROR_STOP=1'],input=statement.encode(),capture_output=True,check=True,timeout=20,env=e).stdout.decode().strip()
def write(name, value):
    p=root/name;p.write_text(json.dumps(value) if not isinstance(value,str) else value);return p
name='provider_process_'+uuid.uuid4().hex
sql('CREATE DATABASE '+name)
core_url=urllib.parse.urlunsplit(admin._replace(path='/'+name))
core_file=write('process-core-owner.url',core_url)
run([str(binary/'ouroboros-migrate'),'--database-url-file',str(core_file)])
# Short-lived CA and client/server identities are local fixture authority only.
run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=fixture-ca','-keyout',str(root/'process-ca.key'),'-out',str(root/'process-ca.pem'),'-addext','basicConstraints=critical,CA:TRUE'])
write('process-cert.ext','basicConstraints=critical,CA:FALSE\nsubjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\n')
fps={}
for role in ['core','gateway','gateway-service','human','provider','custody','reviewer']:
    prefix=root/('process-'+role)
    run(['openssl','req','-new','-newkey','rsa:2048','-nodes','-subj','/CN='+role,'-keyout',str(prefix)+'.key','-out',str(prefix)+'.csr'])
    run(['openssl','x509','-req','-in',str(prefix)+'.csr','-CA',str(root/'process-ca.pem'),'-CAkey',str(root/'process-ca.key'),'-CAcreateserial','-days','1','-extfile',str(root/'process-cert.ext'),'-out',str(prefix)+'.pem'])
    fps[role]=hashlib.sha256(run(['openssl','x509','-in',str(prefix)+'.pem','-outform','DER'])).hexdigest()
def tls(role):
    return {'certificate':str(root/('process-'+role+'.pem')),'private_key':str(root/('process-'+role+'.key')),'ca':str(root/'process-ca.pem')}
ports={}
for role in ['core','gateway','provider','custody']:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));ports[role]=sock.getsockname()[1]
def endpoint(role): return f'127.0.0.1:{ports[role]}'
def url(role): return 'https://'+endpoint(role)
firm=c['firm'];human=str(uuid.uuid4());grant=str(uuid.uuid4());control=str(uuid.uuid4())
binding={'target':'managed-model','endpoint':json.loads((root/'ready.json').read_text())['endpoint'],'credential_id':c['credential'],'credential_version':11,'timeout_ms':2000,'max_response_bytes':65536}
role='process_core_'+uuid.uuid4().hex;pw=secrets.token_hex(24)
sql(f"CREATE ROLE {role} LOGIN PASSWORD '{pw}'; GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {role}; INSERT INTO firms(id) VALUES('{firm}'); INSERT INTO principals VALUES('{firm}','{human}','human',true); INSERT INTO credentials VALUES('{fps['human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour'); INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{grant}','{human}',ARRAY['inspect','work.create','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{control}','{human}',ARRAY['inspect','delegation.revoke'],clock_timestamp()+interval '1 hour'); INSERT INTO limits VALUES('{firm}','resource_calls',10,0); INSERT INTO resource_targets VALUES('{firm}','managed-model','{fps['provider']}',true,'{json.dumps(binding)}',2097152);",name)
service_url=urllib.parse.urlunsplit(admin._replace(netloc=f'{role}:{pw}@{admin.hostname}:{admin.port}',path='/'+name))
write('process-core.url',service_url)
write('process-core.json',{'listen':endpoint('core'),'tls':tls('core'),'database_url_file':str(root/'process-core.url'),'firm_id':firm,'gateway_fingerprint':fps['gateway-service']})
write('process-gateway.json',{'listen':endpoint('gateway'),'tls':tls('gateway'),'core_url':url('core'),'core_client':tls('gateway-service'),'workers':{'managed-model':url('provider'),'custody':url('custody')},'native_routes':{'model':'managed-model'}})
consumer='native_consumer_'+uuid.uuid4().hex;consumer_pw=secrets.token_hex(24)
sql(f"CREATE ROLE {consumer} LOGIN PASSWORD '{consumer_pw}'; GRANT USAGE ON SCHEMA public TO {consumer}; GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts TO {consumer}; GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {consumer}; GRANT INSERT(owner_id,attempt_id,credential_id,version) ON credential_use_claims TO {consumer}; GRANT INSERT(owner_id,attempt_id,ticket_sha256,reply) ON provider_receipts TO {consumer};")
consumer_url=urllib.parse.urlunsplit(admin._replace(netloc=f'{consumer}:{consumer_pw}@{admin.hostname}:{admin.port}'))
write('process-consumer.url',consumer_url)
packages=root/'auth-modules';packages.mkdir(mode=0o700)
write('process-provider.json',{'listen':endpoint('provider'),'tls':tls('provider'),'core_url':url('core'),'core_client':tls('provider'),'gateway_fingerprint':fps['gateway-service'],'role':'provider','database_url_file':str(root/'process-consumer.url'),'key_file':str(root/'process-key.bin'),'provider_ca_file':str(root/'cert.pem'),'provider':binding,'provider_managed_versions':True,'auth_module_host':{'worker_executable':str(binary/'ouroboros-auth-module'),'package_directory':str(packages)}})
management='process_management_'+uuid.uuid4().hex;management_pw=secrets.token_hex(24)
sql(f"CREATE ROLE {management} LOGIN PASSWORD '{management_pw}'; GRANT USAGE ON SCHEMA public TO {management}; GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts,credential_enrollments,credential_disables TO {management}; GRANT INSERT ON credential_versions,credential_use_claims,provider_receipts,credential_enrollments,credential_disables TO {management}; GRANT UPDATE(disabled,disabled_at) ON credential_versions TO {management}; GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {management};")
management_url=urllib.parse.urlunsplit(admin._replace(netloc=f'{management}:{management_pw}@{admin.hostname}:{admin.port}'))
write('process-management.url',management_url)
write('process-custody.json',{'listen':endpoint('custody'),'tls':tls('custody'),'core_url':url('core'),'core_client':tls('custody'),'gateway_fingerprint':fps['gateway-service'],'role':'custody-management','database_url_file':str(root/'process-management.url'),'key_file':str(root/'process-key.bin')})
cli_config=write('process-cli.json',{'gateway_url':url('gateway'),'tls':tls('human')})
processes=[]
services={}
idle_readers=[]
def cli(*args, success=True):
    r=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),*args],capture_output=True,timeout=8,env=env)
    if success: assert r.returncode==0,'CLI request failed: '+r.stderr.decode()
    else: assert r.returncode!=0,'denied request succeeded'
    return r
try:
    for service,exe in [('core','ouroboros-core'),('provider','ouroboros-resources'),('gateway','ouroboros-gateway'),('custody','ouroboros-resources')]:
        with (root/('process-'+service+'.log')).open('xb') as log:
            processes.append(subprocess.Popen([str(binary/exe),'--config',str(root/('process-'+service+'.json'))],stdout=log,stderr=log,env=env))
            services[service]=processes[-1]
    for _ in range(50):
        if not all(p.poll() is None for p in processes): raise RuntimeError('service exited')
        try:
            cli('conditions');break
        except AssertionError: time.sleep(.1)
    else: raise RuntimeError('services unavailable')
    work_input=write('process-work.json',{'purpose':'provider connection fixture','delegation_id':grant})
    work=json.loads(cli('work','--input',str(work_input),'--key','provider-work').stdout)['resource_id']
    sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    before=json.loads((root/'observed.json').read_text())['count']
    request=write('process-model.json',{'model':'process-requested','reasoning':{'effort':'low'},'input':'synthetic'})
    # Reject the real worker's Core completion transaction after custody has saved its reply.
    # No runtime test bypass: a disposable owner-installed trigger injects a storage failure.
    sql("CREATE FUNCTION reject_provider_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='model.responses' AND NEW.state='succeeded' THEN RAISE EXCEPTION 'fixture completion unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_provider_completion BEFORE UPDATE ON intents FOR EACH ROW EXECUTE FUNCTION reject_provider_completion();",name)
    cli('request','POST','/v1/responses','--input',str(request),'--work',work,'--delegation',grant,success=False)
    original=sql("SELECT id FROM intents WHERE operation='model.responses' AND state='claimed'",name)
    assert original and sql("SELECT count(*) FROM attempts",name)=='1'
    sql("DROP TRIGGER reject_provider_completion ON intents; DROP FUNCTION reject_provider_completion();",name)
    response=json.loads(cli('request','POST',f'/resource-intents/{original}/reconcile','--work',work,'--delegation',grant).stdout)
    assert json.loads((root/'observed.json').read_text())['count']==before+1
    assert sql("SELECT count(*) FROM attempts",name)=='1'

    assert response['model']=='fixture-confirmed'
    # Correlate the actual Core receipt, rather than an in-process authorization callback.
    recorded=json.loads(sql("SELECT reply::text FROM resource_calls WHERE reply IS NOT NULL",name))
    assert recorded['receipt']['requested_model']=='process-requested'
    assert recorded['receipt']['provider_observation']['reported_model']=='fixture-confirmed'
    assert recorded['receipt']['provider_observation']['usage']['output_tokens']==2
    result=sql("SELECT count(*) FROM intents WHERE operation='model.responses' AND state='succeeded'",name)
    assert result=='1'
    outage_request=write('process-outage.json',{'model':'process-requested','fixture_mode':'stall','input':'core outage'})
    outage=subprocess.Popen([str(binary/'ouroboros-cli'),'--config',str(cli_config),'request','POST','/v1/responses','--input',str(outage_request),'--work',work,'--delegation',grant],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
    processes.append(outage)
    for _ in range(100):
        if json.loads((root/'observed.json').read_text())['count']==before+2: break
        time.sleep(.02)
    else: raise RuntimeError('outage upstream did not receive request')
    processes[0].terminate();processes[0].wait(timeout=5)
    stopped_at=time.monotonic()
    lost_body,_=outage.communicate(timeout=1.5)
    assert outage.returncode!=0 and lost_body==b''
    assert time.monotonic()-stopped_at<1.5
    with (root/'process-core-restart.log').open('xb') as log:
        restarted=subprocess.Popen([str(binary/'ouroboros-core'),'--config',str(root/'process-core.json')],stdout=log,stderr=log,env=env)
    processes.append(restarted)
    services['core']=restarted
    for _ in range(50):
        try:cli('conditions');break
        except AssertionError:time.sleep(.1)
    else:raise RuntimeError('Core restart failed')
    assert sql("SELECT count(*) FROM intents WHERE operation='model.responses' AND state='claimed'",name)=='1'
    slow=write('process-slow.json',{'model':'process-requested','fixture_mode':'stall','input':'synthetic'})
    pending=subprocess.Popen([str(binary/'ouroboros-cli'),'--config',str(cli_config),'request','POST','/v1/responses','--input',str(slow),'--work',work,'--delegation',grant],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
    processes.append(pending)
    for _ in range(100):
        if json.loads((root/'observed.json').read_text())['count']==before+3: break
        time.sleep(.02)
    else: raise RuntimeError('slow upstream did not receive request')
    revision=json.loads(cli('conditions').stdout)['revision']
    revoked_at=time.monotonic()
    accepted=json.loads(cli('revoke',grant,'--revision',str(revision),'--key','provider-revoke').stdout)
    assert accepted['intent_id']
    assert sql(f"SELECT revoked FROM delegations WHERE id='{grant}'",name)=='t'
    assert int(sql(f"SELECT revision FROM firms WHERE id='{firm}'",name))==revision+1
    output,_=pending.communicate(timeout=1.5)
    assert pending.returncode!=0 and output==b'', 'revoked response escaped'
    revoke_elapsed=time.monotonic()-revoked_at
    assert revoke_elapsed<1.5
    assert sql("SELECT count(*) FROM intents WHERE operation='model.responses' AND state='claimed'",name)=='2'
    cli('request','POST','/v1/responses','--input',str(request),'--work',work,'--delegation',grant,success=False)
    assert json.loads((root/'observed.json').read_text())['count']==before+3
    # A separate current read scope can recover the old result after execution revocation.
    cli('request','POST',f'/resource-intents/{original}/reconcile','--work',work,'--delegation',grant,success=False)
    sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{control}','managed-model',ARRAY['inspect']);",name)
    recovered=json.loads(cli('request','POST',f'/resource-intents/{original}/reconcile','--work',work,'--delegation',control).stdout)
    assert recovered==response
    assert json.loads((root/'observed.json').read_text())['count']==before+3
    # Real HTTP first-byte proof: upstream withholds its tail until this reader receives data.
    import ssl, urllib.request
    streaming_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{streaming_grant}','{human}',ARRAY['inspect','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{streaming_grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    release=root/'stream-release'
    if release.exists():release.unlink()
    context=ssl.create_default_context(cafile=str(root/'process-ca.pem'))
    context.load_cert_chain(root/'process-human.pem',root/'process-human.key')
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context))
    native=urllib.request.Request(url('gateway')+'/v1/responses',data=json.dumps({'model':'process-requested','stream':True,'fixture_mode':'http-stream'}).encode(),headers={'content-type':'application/json','x-ouro-work-id':work,'x-ouro-delegation-id':streaming_grant})
    with opener.open(native,timeout=5) as streamed:
        assert streamed.headers['content-type']=='text/event-stream'
        first=streamed.read(1);assert first==b'd'
        draining_intent=streamed.headers['x-ouro-intent-id']
        gateway=services['gateway']
        gateway.terminate()
        host,port=endpoint('gateway').rsplit(':',1)
        deadline=time.monotonic()+2
        while time.monotonic()<deadline:
            try:
                with socket.create_connection((host,int(port)),timeout=.2):pass
            except OSError:break
            time.sleep(.01)
        else:raise AssertionError('draining Gateway continued accepting connections')
        assert gateway.poll() is None, 'Gateway exited before in-flight response drained'
        release.write_text('release')
        full=first+streamed.read()
        assert b'response.completed' in full
    assert gateway.wait(timeout=7)==0
    assert sql(f"SELECT state FROM intents WHERE id='{draining_intent}'",name)=='succeeded'
    with (root/'process-gateway-restart.log').open('xb') as log:
        restarted_gateway=subprocess.Popen([str(binary/'ouroboros-gateway'),'--config',str(root/'process-gateway.json')],stdout=log,stderr=log,env=env)
    processes.append(restarted_gateway)
    services['gateway']=restarted_gateway
    for _ in range(50):
        try:cli('conditions');break
        except AssertionError:time.sleep(.1)
    else:raise RuntimeError('Gateway restart failed')
    assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{draining_intent}'",name)=='1'
    assert json.loads((root/'observed.json').read_text())['count']==before+4
    # Revocation after partial delivery must truncate, never release a terminal success event.
    import http.client
    release.unlink()
    partial=opener.open(native,timeout=5)
    partial_intent=partial.headers['x-ouro-intent-id']
    assert partial.read(1)==b'd'
    revision=json.loads(cli('conditions').stdout)['revision']
    cli('revoke',streaming_grant,'--revision',str(revision),'--key','stream-partial-revoke')
    restricted_at=time.monotonic()
    try:
        partial.read()
        raise AssertionError('revoked stream ended cleanly')
    except http.client.IncompleteRead as error:
        assert b'response.completed' not in error.partial
    finally:partial.close()
    assert time.monotonic()-restricted_at<1.5
    assert sql(f"SELECT state FROM intents WHERE id='{partial_intent}'",name)=='claimed'
    assert sql(f"SELECT reply IS NULL FROM resource_calls WHERE intent_id='{partial_intent}'",name)=='t'
    release.write_text('release')
    # A newly authorized caller disconnects after first data. The original dispatch keeps its
    # obligation, but its credential-use transaction must stop without waiting for the deadline.
    disconnect_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{disconnect_grant}','{human}',ARRAY['inspect','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{disconnect_grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    release.unlink()
    disconnect_request=urllib.request.Request(url('gateway')+'/v1/responses',data=json.dumps({'model':'process-requested','stream':True,'fixture_mode':'http-stream'}).encode(),headers={'content-type':'application/json','x-ouro-work-id':work,'x-ouro-delegation-id':disconnect_grant})
    disconnected=opener.open(disconnect_request,timeout=5)
    disconnect_intent=disconnected.headers['x-ouro-intent-id']
    assert disconnected.read(1)==b'd'
    disconnected.close()
    disconnected_at=time.monotonic()
    # Probe the exact version's shared-use lock through a rollback-only owner transaction.
    for _ in range(50):
        try:
            unlocked=sql(f"BEGIN; SELECT 1 FROM credential_versions WHERE owner_id='{firm}' AND credential_id='{c['credential']}' AND version=11 FOR UPDATE NOWAIT; ROLLBACK;")
            assert '1' in unlocked;break
        except subprocess.CalledProcessError:time.sleep(.02)
    else:raise AssertionError('disconnected credential use did not release its lock')
    assert time.monotonic()-disconnected_at<1.5
    assert sql(f"SELECT state FROM intents WHERE id='{disconnect_intent}'",name)=='claimed'
    assert sql(f"SELECT reply IS NULL FROM resource_calls WHERE intent_id='{disconnect_intent}'",name)=='t'
    release.write_text('release')
    assert json.loads((root/'observed.json').read_text())['count']==before+6
    # Three connected callers deliberately do not consume response bodies. This establishes
    # idle-reader control behavior, not kernel send-buffer saturation.
    idle_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{idle_grant}','{human}',ARRAY['inspect','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{idle_grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    release.unlink()
    idle_started=time.monotonic()
    for _ in range(3):
        request_idle=urllib.request.Request(url('gateway')+'/v1/responses',data=json.dumps({'model':'process-requested','stream':True,'fixture_mode':'http-stream'}).encode(),headers={'content-type':'application/json','x-ouro-work-id':work,'x-ouro-delegation-id':idle_grant})
        idle_readers.append(opener.open(request_idle,timeout=5))
    ids=[reader.headers['x-ouro-intent-id'] for reader in idle_readers]
    assert len(set(ids))==3
    control_started=time.monotonic()
    revision=json.loads(cli('conditions').stdout)['revision']
    condition_latency=time.monotonic()-control_started
    assert condition_latency<1
    # Revoke well before the 2-second provider deadline so timeout is not the explanation.
    assert time.monotonic()-idle_started<1
    control_started=time.monotonic()
    cli('revoke',idle_grant,'--revision',str(revision),'--key','idle-readers-revoke')
    control_latency=time.monotonic()-control_started
    assert control_latency<1
    assert time.monotonic()-idle_started<1.5
    for _ in range(40):
        try:
            sql(f"BEGIN; SELECT 1 FROM credential_versions WHERE owner_id='{firm}' AND credential_id='{c['credential']}' AND version=11 FOR UPDATE NOWAIT; ROLLBACK;")
            break
        except subprocess.CalledProcessError:time.sleep(.01)
    else:raise AssertionError('idle readers kept credential use alive after revocation')
    assert time.monotonic()-idle_started<2
    for reader,intent in zip(idle_readers,ids):
        try:
            reader.read()
            raise AssertionError('idle revoked response completed')
        except http.client.IncompleteRead as error:assert b'response.completed' not in error.partial
        finally:reader.close()
        assert sql(f"SELECT state FROM intents WHERE id='{intent}'",name)=='claimed'
        assert sql(f"SELECT reply IS NULL FROM resource_calls WHERE intent_id='{intent}'",name)=='t'
    idle_readers.clear()
    release.write_text('release')
    assert json.loads((root/'observed.json').read_text())['count']==before+9
    idle_result={'connections':3,'conditions_seconds':condition_latency,'revoke_seconds':control_latency,'terminal_events':0,'tcp_saturation_proven':False}
    # Environment pause must truncate an already-open stream without inventing settlement.
    pause_grant=str(uuid.uuid4())
    sql(f"UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE id='{control}'; INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{pause_grant}','{human}',ARRAY['inspect','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{pause_grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    release.unlink()
    pause_request=urllib.request.Request(url('gateway')+'/v1/responses',data=json.dumps({'model':'process-requested','stream':True,'fixture_mode':'http-stream'}).encode(),headers={'content-type':'application/json','x-ouro-work-id':work,'x-ouro-delegation-id':pause_grant})
    paused_stream=opener.open(pause_request,timeout=5)
    pause_intent=paused_stream.headers['x-ouro-intent-id']
    assert paused_stream.read(1)==b'd'
    reserved=sql("SELECT committed FROM limits WHERE id='resource_calls'",name)
    pause_body=write('pause-input.json',{'delegation_id':control,'expected_revision':json.loads(cli('conditions').stdout)['revision'],'paused':True,'reason':'Fixture open stream shutdown boundary'})
    receipt=json.loads(cli('request','POST','/environment/admission','--input',str(pause_body),'--key','open-stream-pause').stdout)
    assert receipt['admission_paused'] and not receipt['backup_ready'] and not receipt['drain_confirmed']
    paused_at=time.monotonic()
    try:
        paused_stream.read()
        raise AssertionError('paused stream ended as complete')
    except http.client.IncompleteRead as error:
        assert b'response.completed' not in error.partial
    finally:paused_stream.close()
    pause_elapsed=time.monotonic()-paused_at
    assert pause_elapsed<1.5
    assert sql(f"SELECT state FROM intents WHERE id='{pause_intent}'",name)=='claimed'
    assert sql(f"SELECT reply IS NULL FROM resource_calls WHERE intent_id='{pause_intent}'",name)=='t'
    assert sql("SELECT committed FROM limits WHERE id='resource_calls'",name)==reserved
    assert json.loads(cli('conditions').stdout)['admission_paused']
    resumed=write('resume-input.json',{'delegation_id':control,'expected_revision':receipt['revision'],'paused':False,'reason':'Fixture continue after stream observation'})
    cli('request','POST','/environment/admission','--input',str(resumed),'--key','open-stream-resume')
    release.write_text('release')
    # An incomplete HTTP body keeps a real connection task pending past drain.
    host,port=endpoint('gateway').rsplit(':',1)
    stalled=context.wrap_socket(socket.create_connection((host,int(port)),timeout=8),server_hostname=host)
    stalled.settimeout(8)
    stalled.sendall(('POST /work HTTP/1.1\r\nHost: '+host+'\r\nContent-Type: application/json\r\nContent-Length: 128\r\nExpect: 100-continue\r\n\r\n').encode())
    interim=b''
    while b'\r\n\r\n' not in interim:
        chunk=stalled.recv(1024)
        assert chunk, 'HTTP connection closed before body acceptance'
        interim+=chunk
        assert len(interim)<=4096
    assert interim.startswith(b'HTTP/1.1 100 Continue')
    stalled.sendall(b'{')
    original_intents=sql('SELECT count(*) FROM intents',name)
    stalled_reserved=sql("SELECT committed FROM limits WHERE id='resource_calls'",name)
    gateway=services['gateway'];started_shutdown=time.monotonic();gateway.terminate()
    assert gateway.wait(timeout=7)!=0, 'stalled drain was reported as successful'
    stalled_seconds=time.monotonic()-started_shutdown
    assert 4.5<=stalled_seconds<7
    assert stalled.recv(1024)==b''
    stalled.close()
    assert sql('SELECT count(*) FROM intents',name)==original_intents
    assert sql("SELECT committed FROM limits WHERE id='resource_calls'",name)==stalled_reserved
    assert b'transport drain deadline expired' in (root/'process-gateway-restart.log').read_bytes()
    with (root/'process-gateway-after-timeout.log').open('xb') as log:
        replacement_gateway=subprocess.Popen([str(binary/'ouroboros-gateway'),'--config',str(root/'process-gateway.json')],stdout=log,stderr=log,env=env)
    processes.append(replacement_gateway);services['gateway']=replacement_gateway
    for _ in range(50):
        try:cli('conditions');break
        except AssertionError:time.sleep(.1)
    else:raise RuntimeError('Gateway replacement after failed drain did not start')
    enrollment_grant=str(uuid.uuid4())
    sql(f"UPDATE limits SET capacity=100 WHERE id='resource_calls'; INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{enrollment_grant}','{human}',ARRAY['inspect','credential.enroll'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_targets VALUES('{firm}','custody','{fps['custody']}',true,'{{}}',1024); INSERT INTO resource_scopes VALUES('{firm}','{work}','{enrollment_grant}','custody',ARRAY['inspect','credential.enroll']);",name)
    enrollment_headers={'content-type':'application/json','x-ouro-work-id':work,'x-ouro-delegation-id':enrollment_grant,'x-ouro-resource-target':'custody','idempotency-key':'enrollment-through-gateway'}
    credential_id=str(uuid.uuid4());enrollment_id=str(uuid.uuid4())
    metadata={'credential_id':credential_id,'enrollment_id':enrollment_id,'version':1}
    req=urllib.request.Request(url('gateway')+'/credential-enrollments',data=json.dumps(metadata).encode(),headers=enrollment_headers)
    with opener.open(req,timeout=5) as result:
        assert result.status==202
        enrollment_intent=json.load(result)['intent_id']
    assert sql(f"SELECT count(*) FROM credential_versions WHERE credential_id='{credential_id}'")=='0'
    secret=b'synthetic-enrollment-only-never-log'
    secret_headers={'content-type':'application/octet-stream','x-ouro-work-id':work,'x-ouro-delegation-id':enrollment_grant}
    def send_secret(payload):
        req=urllib.request.Request(url('gateway')+f'/credential-enrollments/{enrollment_intent}/secret',method='PUT',data=payload,headers=secret_headers)
        return opener.open(req,timeout=15)
    for payload in [b'',b'x'*16385]:
        try:
            with send_secret(payload):raise AssertionError('invalid secret transfer accepted')
        except urllib.error.HTTPError:pass
    assert sql(f"SELECT state FROM intents WHERE id='{enrollment_intent}'",name)=='accepted'
    direct=urllib.request.Request(url('custody')+f'/enrollments/{enrollment_intent}/secret',method='PUT',data=secret,headers=secret_headers)
    try:
        with opener.open(direct,timeout=5):raise AssertionError('human bypassed Gateway')
    except urllib.error.HTTPError as error:assert error.code==403
    another_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{another_grant}','{human}',ARRAY['inspect','credential.enroll'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{another_grant}','custody',ARRAY['inspect','credential.enroll']);",name)
    substituted=dict(secret_headers,**{'x-ouro-delegation-id':another_grant})
    request_substitution=urllib.request.Request(url('gateway')+f'/credential-enrollments/{enrollment_intent}/secret',method='PUT',data=secret,headers=substituted)
    try:
        with opener.open(request_substitution,timeout=5):raise AssertionError('another grant replaced enrollment origin')
    except urllib.error.HTTPError as error:assert error.code==403
    assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{enrollment_intent}'",name)=='0'
    registration=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',enrollment_intent,'--work',work,'--delegation',enrollment_grant],input=secret,capture_output=True,timeout=25,env=env)
    assert registration.returncode==0,'credential CLI did not confirm registration'
    assert secret not in registration.stdout+registration.stderr
    record=json.loads(registration.stdout)
    assert record['credential_id']==credential_id and record['enrollment_id']==enrollment_id
    assert sql(f"SELECT state FROM intents WHERE id='{enrollment_intent}'",name)=='succeeded'
    assert sql(f"SELECT count(*) FROM credential_enrollments WHERE enrollment_id='{enrollment_id}'")=='1'
    try:
        with send_secret(b'different-secret'):raise AssertionError('secret resubmission accepted')
    except urllib.error.HTTPError as error:assert error.code==409
    lost_metadata={'credential_id':str(uuid.uuid4()),'enrollment_id':str(uuid.uuid4()),'version':1}
    def admit_enrollment(metadata,key):
        h=dict(enrollment_headers,**{'idempotency-key':key})
        request=urllib.request.Request(url('gateway')+'/credential-enrollments',data=json.dumps(metadata).encode(),headers=h)
        with opener.open(request,timeout=5) as result:return json.load(result)['intent_id']
    lost_id=admit_enrollment(lost_metadata,'enrollment-lost-completion')
    sql(f"CREATE FUNCTION reject_enrollment_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='{lost_id}' AND NEW.state='succeeded' THEN RAISE EXCEPTION 'fixture enrollment completion unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_enrollment_completion BEFORE UPDATE ON intents FOR EACH ROW EXECUTE FUNCTION reject_enrollment_completion();",name)
    lost=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',lost_id,'--work',work,'--delegation',enrollment_grant],input=secret,capture_output=True,timeout=25,env=env)
    assert lost.returncode!=0 and secret not in lost.stdout+lost.stderr
    assert sql(f"SELECT count(*) FROM credential_enrollments WHERE intent_id='{lost_id}'")=='1'
    assert sql(f"SELECT state FROM intents WHERE id='{lost_id}'",name)=='claimed'
    sql('DROP TRIGGER reject_enrollment_completion ON intents; DROP FUNCTION reject_enrollment_completion();',name)
    # A different Core attempt cannot adopt the first receipt even with identical metadata.
    duplicate_id=admit_enrollment(lost_metadata,'different-enrollment-attempt')
    duplicate=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',duplicate_id,'--work',work,'--delegation',enrollment_grant],input=b'different-synthetic-value',capture_output=True,timeout=25,env=env)
    assert duplicate.returncode!=0
    assert sql(f"SELECT count(*) FROM credential_enrollments WHERE enrollment_id='{lost_metadata['enrollment_id']}'")=='1'
    pending_metadata={'credential_id':str(uuid.uuid4()),'enrollment_id':str(uuid.uuid4()),'version':1}
    pending_headers=dict(enrollment_headers,**{'idempotency-key':'revoke-before-secret'})
    req=urllib.request.Request(url('gateway')+'/credential-enrollments',data=json.dumps(pending_metadata).encode(),headers=pending_headers)
    with opener.open(req,timeout=5) as result:pending_id=json.load(result)['intent_id']
    revision=json.loads(cli('conditions').stdout)['revision']
    cli('revoke',enrollment_grant,'--revision',str(revision),'--key','enrollment-grant-revoke')
    denied=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',pending_id,'--work',work,'--delegation',enrollment_grant],input=secret,capture_output=True,timeout=25,env=env)
    assert denied.returncode!=0 and secret not in denied.stdout+denied.stderr
    assert sql(f"SELECT count(*) FROM credential_enrollments WHERE enrollment_id='{pending_metadata['enrollment_id']}'")=='0'
    assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{pending_id}'",name)=='0'
    sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{control}','custody',ARRAY['inspect']);",name)
    cli('request','POST',f'/resource-intents/{lost_id}/reconcile','--work',work,'--delegation',enrollment_grant,success=False)
    recovered=json.loads(cli('request','POST',f'/resource-intents/{lost_id}/reconcile','--work',work,'--delegation',control).stdout)
    assert recovered['enrollment_id']==lost_metadata['enrollment_id']
    assert sql(f"SELECT state FROM intents WHERE id='{lost_id}'",name)=='succeeded'
    assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{lost_id}'",name)=='1'
    assert sql(f"SELECT count(*) FROM credential_enrollments WHERE enrollment_id='{lost_metadata['enrollment_id']}'")=='1'
    absent=json.loads(cli('request','POST',f'/resource-intents/{duplicate_id}/reconcile','--work',work,'--delegation',control).stdout)
    assert absent['state']=='claimed' and absent['reply'] is None
    assert sql(f"SELECT state FROM intents WHERE id='{duplicate_id}'",name)=='claimed'
    # Disable changes current usability, never the immutable enrollment success response.
    sql(f"UPDATE credential_versions SET disabled=true,disabled_at=clock_timestamp() WHERE owner_id='{firm}' AND credential_id='{lost_metadata['credential_id']}' AND version=1")
    recovered_again=json.loads(cli('request','POST',f'/resource-intents/{lost_id}/reconcile','--work',work,'--delegation',control).stdout)
    assert recovered_again==recovered
    disable_grant=str(uuid.uuid4());post_disable_model_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{disable_grant}','{human}',ARRAY['inspect','credential.disable'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{disable_grant}','custody',ARRAY['inspect','credential.disable']); INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{post_disable_model_grant}','{human}',ARRAY['inspect','model.responses'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{post_disable_model_grant}','managed-model',ARRAY['inspect','model.responses']);",name)
    disable_input=write('process-disable.json',{'credential_id':c['credential'],'version':11})
    cli('request','POST','/credential-disables','--input',str(disable_input),'--key','disable-no-authority','--work',work,'--delegation',another_grant,'--target','custody',success=False)
    assert sql(f"SELECT disabled FROM credential_versions WHERE owner_id='{firm}' AND credential_id='{c['credential']}' AND version=11")=='f'
    invalid_disable=write('process-invalid-disable.json',{'credential_id':c['credential'],'version':11,'enabled':True})
    cli('request','POST','/credential-disables','--input',str(invalid_disable),'--key','invalid-disable','--work',work,'--delegation',disable_grant,'--target','custody',success=False)
    sql("CREATE FUNCTION reject_disable_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='credential.disable' AND NEW.state='succeeded' THEN RAISE EXCEPTION 'fixture disable completion unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_disable_completion BEFORE UPDATE ON intents FOR EACH ROW EXECUTE FUNCTION reject_disable_completion();",name)
    cli('request','POST','/credential-disables','--input',str(disable_input),'--key','disable-lost-completion','--work',work,'--delegation',disable_grant,'--target','custody',success=False)
    disable_intent=sql("SELECT id FROM intents WHERE operation='credential.disable'",name)
    assert disable_intent and sql(f"SELECT state FROM intents WHERE id='{disable_intent}'",name)=='claimed'
    assert sql(f"SELECT count(*) FROM credential_disables WHERE intent_id='{disable_intent}'")=='1'
    assert sql(f"SELECT disabled FROM credential_versions WHERE owner_id='{firm}' AND credential_id='{c['credential']}' AND version=11")=='t'
    sql('DROP TRIGGER reject_disable_completion ON intents; DROP FUNCTION reject_disable_completion();',name)
    call_count=json.loads((root/'observed.json').read_text())['count']
    cli('request','POST','/v1/responses','--input',str(root/'process-model.json'),'--work',work,'--delegation',post_disable_model_grant,success=False)
    assert json.loads((root/'observed.json').read_text())['count']==call_count
    revision=json.loads(cli('conditions').stdout)['revision']
    cli('revoke',disable_grant,'--revision',str(revision),'--key','disable-grant-revoke')
    cli('request','POST',f'/resource-intents/{disable_intent}/reconcile','--work',work,'--delegation',disable_grant,success=False)
    disabled=json.loads(cli('request','POST',f'/resource-intents/{disable_intent}/reconcile','--work',work,'--delegation',control).stdout)
    assert disabled['state']=='disabled' and disabled['version']==11
    assert sql(f"SELECT state FROM intents WHERE id='{disable_intent}'",name)=='succeeded'
    assert sql(f"SELECT count(*) FROM attempts WHERE intent_id='{disable_intent}'",name)=='1'
    assert sql(f"SELECT count(*) FROM credential_disables WHERE intent_id='{disable_intent}'")=='1'
    # A registered successor is only a proposal; the live provider remains unchanged.
    candidate_grant=str(uuid.uuid4())
    sql(f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{candidate_grant}','{human}',ARRAY['inspect','credential.enroll','connection.propose'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{candidate_grant}','custody',ARRAY['inspect','credential.enroll']); INSERT INTO resource_scopes VALUES('{firm}','{work}','{candidate_grant}','managed-model',ARRAY['inspect','connection.propose']);",name)
    successor_metadata={'credential_id':c['credential'],'enrollment_id':str(uuid.uuid4()),'version':12}
    successor_input=write('process-successor-enrollment.json',successor_metadata)
    successor=json.loads(cli('request','POST','/credential-enrollments','--input',str(successor_input),'--key','successor-enrollment','--work',work,'--delegation',candidate_grant,'--target','custody').stdout)['intent_id']
    candidate_metadata={'target':'managed-model','work_id':work,'delegation_id':candidate_grant,'expected_credential_version':11,'enrollment_intent_id':successor}
    candidate_input=write('process-candidate.json',candidate_metadata)
    cli('request','POST','/connection-candidates','--input',str(candidate_input),'--key','candidate-successor',success=False)
    assert sql('SELECT count(*) FROM connection_candidates',name)=='0'
    registration=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',successor,'--work',work,'--delegation',candidate_grant],input=b'synthetic-bearer',capture_output=True,timeout=25,env=env)
    assert registration.returncode==0
    proposal=json.loads(cli('request','POST','/connection-candidates','--input',str(candidate_input),'--key','candidate-successor').stdout)
    assert proposal['state']=='proposed' and proposal['base_configuration']['credential_version']==11
    assert proposal['proposed_configuration']['credential_version']==12
    original=dict(proposal['base_configuration']);proposed=dict(proposal['proposed_configuration'])
    original.pop('credential_version');proposed.pop('credential_version');assert original==proposed
    assert sql("SELECT configuration->>'credential_version' FROM resource_targets WHERE id='managed-model'",name)=='11'
    assert json.loads(cli('request','POST','/connection-candidates','--input',str(candidate_input),'--key','candidate-successor').stdout)==proposal
    inspected_input=write('process-candidate-read.json',{'work_id':work,'delegation_id':candidate_grant})
    assert json.loads(cli('request','POST',f"/connection-candidates/{proposal['id']}/inspect",'--input',str(inspected_input)).stdout)==proposal
    changed=write('process-candidate-changed.json',dict(candidate_metadata,expected_credential_version=10))
    cli('request','POST','/connection-candidates','--input',str(changed),'--key','candidate-successor',success=False)
    try:
        sql(f"UPDATE connection_candidates SET proposed_configuration='{{}}' WHERE id='{proposal['id']}'",name)
        raise AssertionError('immutable connection proposal was updated')
    except subprocess.CalledProcessError:pass
    # Review is an attributable recommendation, not operational acceptance or activation.
    sql(f"UPDATE delegations SET actions=array_append(actions,'connection.review') WHERE id='{candidate_grant}'; UPDATE resource_scopes SET operations=array_append(operations,'connection.review') WHERE delegation_id='{candidate_grant}' AND target_id='managed-model';",name)
    review_data={'work_id':work,'delegation_id':candidate_grant,'recommendation':'recommend','rationale':'Registration receipt exists; provider compatibility is not yet tested.','evidence_intent_ids':[successor]}
    review_input=write('process-review.json',review_data)
    review_path=f"/connection-candidates/{proposal['id']}/reviews"
    cli('request','POST',review_path,'--input',str(review_input),'--key','review-successor',success=False)
    assert sql('SELECT count(*) FROM connection_reviews',name)=='0'
    reviewer=str(uuid.uuid4());review_grant=str(uuid.uuid4())
    sql(f"INSERT INTO principals VALUES('{firm}','{reviewer}','human',true); INSERT INTO work_controls VALUES('{firm}','{work}','{reviewer}'); INSERT INTO credentials VALUES('{fps['reviewer']}','{firm}','{reviewer}',true,clock_timestamp()+interval '1 hour'); INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{review_grant}','{reviewer}',ARRAY['inspect','connection.review'],clock_timestamp()+interval '1 hour'); INSERT INTO resource_scopes VALUES('{firm}','{work}','{review_grant}','managed-model',ARRAY['inspect','connection.review']); INSERT INTO resource_scopes VALUES('{firm}','{work}','{review_grant}','custody',ARRAY['inspect']);",name)
    original_cli_config=cli_config
    cli_config=write('process-reviewer-cli.json',{'gateway_url':url('gateway'),'tls':tls('reviewer')})
    review_data['delegation_id']=review_grant
    write('process-review.json',review_data)
    reviewed=json.loads(cli('request','POST',review_path,'--input',str(review_input),'--key','review-successor').stdout)
    assert reviewed['state']=='recorded' and reviewed['operating_acceptance'] is False
    assert reviewed['reviewer_id']==reviewer and reviewed['candidate_id']==proposal['id']
    assert reviewed['evidence'][0]['intent_id']==successor
    assert json.loads(cli('request','POST',review_path,'--input',str(review_input),'--key','review-successor').stdout)==reviewed
    altered=write('process-review-altered.json',dict(review_data,recommendation='reject'))
    cli('request','POST',review_path,'--input',str(altered),'--key','review-successor',success=False)
    missing=write('process-review-missing.json',dict(review_data,evidence_intent_ids=[str(uuid.uuid4())]))
    cli('request','POST',review_path,'--input',str(missing),'--key','review-missing',success=False)
    try:
        sql(f"UPDATE connection_reviews SET evidence='[]' WHERE id='{reviewed['id']}'",name)
        raise AssertionError('immutable review was updated')
    except subprocess.CalledProcessError:pass
    # Scope acceptance is explicit and does not itself select configuration.
    accept_path=f"/connection-candidates/{proposal['id']}/acceptances"
    accept_data={'work_id':work,'delegation_id':review_grant,'review_id':reviewed['id'],'max_calls':2,'lifetime_seconds':60}
    accept_input=write('process-acceptance.json',accept_data)
    cli('request','POST',accept_path,'--input',str(accept_input),'--key','accept-successor',success=False)
    sql(f"UPDATE delegations SET actions=actions||ARRAY['connection.accept','connection.activate','model.responses'] WHERE id='{review_grant}'; UPDATE resource_scopes SET operations=operations||ARRAY['connection.accept','connection.activate','model.responses'] WHERE delegation_id='{review_grant}' AND target_id='managed-model';",name)
    accepted=json.loads(cli('request','POST',accept_path,'--input',str(accept_input),'--key','accept-successor').stdout)
    assert accepted['profile']=='bounded-verification' and accepted['operating_qualification'] is False
    assert sql("SELECT configuration->>'credential_version' FROM resource_targets WHERE id='managed-model'",name)=='11'
    assert json.loads(cli('request','POST',accept_path,'--input',str(accept_input),'--key','accept-successor').stdout)==accepted
    changed_accept=write('process-acceptance-changed.json',dict(accept_data,max_calls=3))
    cli('request','POST',accept_path,'--input',str(changed_accept),'--key','accept-successor',success=False)
    activate_path=f"/connection-candidates/{proposal['id']}/activate"
    activation_input=write('process-activation.json',{'work_id':work,'delegation_id':review_grant,'acceptance_id':accepted['id']})
    # Stale configuration and a commit fault cannot partially select a candidate.
    sql("UPDATE resource_targets SET configuration=jsonb_set(configuration,'{timeout_ms}','1900') WHERE id='managed-model'",name)
    cli('request','POST',activate_path,'--input',str(activation_input),'--key','activate-successor',success=False)
    assert sql('SELECT count(*) FROM connection_activations',name)=='0'
    sql("UPDATE resource_targets SET configuration=jsonb_set(configuration,'{timeout_ms}','2000') WHERE id='managed-model'",name)
    sql("CREATE FUNCTION reject_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture activation commit failure'; END $$; CREATE TRIGGER reject_activation BEFORE INSERT ON connection_activations FOR EACH ROW EXECUTE FUNCTION reject_activation();",name)
    cli('request','POST',activate_path,'--input',str(activation_input),'--key','activate-successor',success=False)
    assert sql("SELECT configuration->>'credential_version' FROM resource_targets WHERE id='managed-model'",name)=='11'
    assert sql('SELECT count(*) FROM active_connections',name)=='0'
    sql("DROP TRIGGER reject_activation ON connection_activations; DROP FUNCTION reject_activation();",name)
    activation=json.loads(cli('request','POST',activate_path,'--input',str(activation_input),'--key','activate-successor').stdout)
    assert activation['state']=='configuration_selected'
    assert json.loads(cli('request','POST',activate_path,'--input',str(activation_input),'--key','activate-successor').stdout)==activation
    cli('request','POST',activate_path,'--input',str(activation_input),'--key','activate-again',success=False)
    assert sql("SELECT configuration->>'credential_version' FROM resource_targets WHERE id='managed-model'",name)=='12'
    verify_input=write('process-verification.json',{'model':'process-requested','reasoning':{'effort':'low'},'input':'bounded verification'})
    result=json.loads(cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant).stdout)
    assert result['model']=='fixture-confirmed'
    assert json.loads((root/'observed.json').read_text())['count']==call_count+1
    assert sql("SELECT count(*) FROM resource_calls WHERE operation='model.responses' AND reply->'receipt'->>'credential_version'='12'",name)=='1'
    sql(f"UPDATE principals SET enabled=false WHERE id='{reviewer}'",name)
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant,success=False)
    sql(f"UPDATE principals SET enabled=true WHERE id='{reviewer}'",name)
    # Removal of acceptance authority blocks use despite a remaining call slot.
    sql(f"UPDATE resource_scopes SET operations=array_remove(operations,'connection.accept') WHERE delegation_id='{review_grant}' AND target_id='managed-model'",name)
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant,success=False)
    assert sql('SELECT count(*) FROM connection_call_slots',name)=='1'
    assert json.loads((root/'observed.json').read_text())['count']==call_count+1
    # Restore the disposable fixture's scope to exercise independent exhaustion, not production regrant.
    sql(f"UPDATE resource_scopes SET operations=array_append(operations,'connection.accept') WHERE delegation_id='{review_grant}' AND target_id='managed-model'",name)
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant)
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant,success=False)
    assert sql('SELECT count(*) FROM connection_call_slots',name)=='2'
    call_count+=2
    status_input=write('process-connection-status.json',{'work_id':work,'delegation_id':review_grant})
    def status(candidate):
        return json.loads(cli('request','POST',f"/connection-candidates/{candidate['id']}/status",'--input',str(status_input)).stdout)
    exhausted=status(proposal)
    assert exhausted['worker_readiness']=='not_assessed'
    assert exhausted['activations'][0]['state']=='exhausted'
    assert exhausted['activations'][0]['admitted_calls']==2
    assert exhausted['activations'][0]['new_admission_policy_satisfied'] is False
    def next_connection(version):
        global cli_config
        reviewer_config=cli_config
        cli_config=original_cli_config
        meta=write(f'process-enrollment-{version}.json',{'credential_id':c['credential'],'enrollment_id':str(uuid.uuid4()),'version':version})
        enrolled=json.loads(cli('request','POST','/credential-enrollments','--input',str(meta),'--key',f'enroll-{version}','--work',work,'--delegation',candidate_grant,'--target','custody').stdout)['intent_id']
        sent=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cli_config),'credential-secret',enrolled,'--work',work,'--delegation',candidate_grant],input=b'synthetic-bearer',capture_output=True,timeout=25,env=env)
        assert sent.returncode==0
        proposal_input=write(f'process-proposal-{version}.json',{'target':'managed-model','work_id':work,'delegation_id':candidate_grant,'expected_credential_version':version-1,'enrollment_intent_id':enrolled})
        cand=json.loads(cli('request','POST','/connection-candidates','--input',str(proposal_input),'--key',f'proposal-{version}').stdout)
        cli_config=reviewer_config
        ri=write(f'process-review-{version}.json',dict(review_data,evidence_intent_ids=[enrolled]))
        rev=json.loads(cli('request','POST',f"/connection-candidates/{cand['id']}/reviews",'--input',str(ri),'--key',f'review-{version}').stdout)
        ai=write(f'process-accept-{version}.json',dict(accept_data,review_id=rev['id'],max_calls=3))
        acc=json.loads(cli('request','POST',f"/connection-candidates/{cand['id']}/acceptances",'--input',str(ai),'--key',f'accept-{version}').stdout)
        xi=write(f'process-activate-{version}.json',{'work_id':work,'delegation_id':review_grant,'acceptance_id':acc['id']})
        act=json.loads(cli('request','POST',f"/connection-candidates/{cand['id']}/activate",'--input',str(xi),'--key',f'activate-{version}').stdout)
        return cand,act
    stopped_candidate,stopped_activation=next_connection(13)
    assert status(proposal)['activations'][0]['state']=='replaced'
    assert status(stopped_candidate)['activations'][0]['state']=='selected'
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant)
    call_count+=1
    stop_input=write('process-connection-stop.json',{'work_id':work,'delegation_id':review_grant,'activation_id':stopped_activation['id']})
    stop_path=f"/connection-candidates/{stopped_candidate['id']}/stop"
    cli('request','POST',stop_path,'--input',str(stop_input),'--key','connection-stop',success=False)
    sql(f"UPDATE delegations SET actions=array_append(actions,'connection.stop') WHERE id='{review_grant}'; UPDATE resource_scopes SET operations=array_append(operations,'connection.stop') WHERE delegation_id='{review_grant}' AND target_id='managed-model'",name)
    stopped=json.loads(cli('request','POST',stop_path,'--input',str(stop_input),'--key','connection-stop').stdout)
    assert stopped['state']=='restricted'
    assert json.loads(cli('request','POST',stop_path,'--input',str(stop_input),'--key','connection-stop').stdout)==stopped
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant,success=False)
    view=status(stopped_candidate)['activations'][0]
    assert view['state']=='stopped' and view['selected']
    assert view['remaining_admissions']==2 and view['admitted_calls']==1
    assert view['succeeded_calls']==1 and not view['dispatch_policy_satisfied']
    assert json.loads((root/'observed.json').read_text())['count']==call_count
    replacement,replacement_activation=next_connection(14)
    # A historical replay observes its original restriction; it cannot stop the successor.
    assert json.loads(cli('request','POST',stop_path,'--input',str(stop_input),'--key','connection-stop').stdout)==stopped
    cli('request','POST',stop_path,'--input',str(stop_input),'--key','stale-stop',success=False)
    assert status(replacement)['activations'][0]['state']=='selected'
    assert status(stopped_candidate)['activations'][0]['selected'] is False
    cli('request','POST','/v1/responses','--input',str(verify_input),'--work',work,'--delegation',review_grant)
    call_count+=1
    assert sql('SELECT count(*) FROM connection_stops',name)=='1'
    assert sql('SELECT count(*) FROM connection_call_slots',name)=='4'
    sql(f"DELETE FROM resource_scopes WHERE delegation_id='{review_grant}' AND target_id='custody'",name)
    cli('request','POST',review_path,'--input',str(review_input),'--key','review-successor',success=False)
    assert sql('SELECT count(*) FROM connection_reviews',name)=='3'
    assert sql("SELECT configuration->>'credential_version' FROM resource_targets WHERE id='managed-model'",name)=='14'
    cli_config=original_cli_config
    sql(f"DELETE FROM resource_scopes WHERE delegation_id='{candidate_grant}' AND target_id='custody'",name)
    cli('request','POST','/connection-candidates','--input',str(candidate_input),'--key','candidate-successor',success=False)
    cli('request','POST',f"/connection-candidates/{proposal['id']}/inspect",'--input',str(inspected_input),success=False)
    assert sql('SELECT count(*) FROM connection_candidates',name)=='3'
    assert json.loads((root/'observed.json').read_text())['count']==call_count
    from tests.support.auth_module_fixture import check_auth_module
    auth_evidence=check_auth_module(root=root,binary=binary,env=env,sql=sql,database=name,firm=firm,work=work,credential=c['credential'],author=human,author_grant=candidate_grant,author_config=original_cli_config,reviewer=reviewer,review_grant=review_grant,reviewer_config=root/'process-reviewer-cli.json',enrollment=sql("SELECT enrollment_intent_id FROM connection_candidates WHERE proposed_configuration->>'credential_version'='14'",name))
    records=sql(f"SELECT input::text FROM intents WHERE id='{enrollment_intent}'; SELECT reply::text FROM resource_calls WHERE intent_id='{enrollment_intent}';",name)
    assert secret.decode() not in records
    for p in root.glob('process-*.log'): assert secret not in p.read_bytes()
    for p in root.glob('process-*.log'): assert b'synthetic-bearer' not in p.read_bytes()
    for reader in idle_readers:reader.close()
    idle_readers.clear()
    transport_shutdown={}
    for service in ['gateway','provider','custody','core']:
        process=services[service]
        assert process.poll() is None
        began=time.monotonic()
        process.terminate()
        assert process.wait(timeout=7)==0, 'transport did not drain cleanly: '+service
        transport_shutdown[service]={'exit_code':0,'seconds':time.monotonic()-began}
        host,port=endpoint(service).rsplit(':',1)
        try:
            with socket.create_connection((host,int(port)),timeout=.5):pass
        except OSError:pass
        else:raise AssertionError('listener remains after process termination')
    write('process-result.json',{'auth_module':auth_evidence,'stalled_gateway_drain':{'seconds':stalled_seconds,'nonzero_exit':True,'unresolved_preserved':True},'inflight_gateway_drain':'PASS','transport_shutdown':transport_shutdown,'result':'PASS','path':'CLI -> Gateway -> Core -> provider -> HTTPS fixture','core_outage_restriction':'PASS','core_restart_preserves_unresolved':'PASS','revoked_extra_calls':0,'pending_response_restricted_seconds':revoke_elapsed,'revocation_path':'human mTLS CLI -> Gateway -> Core','partial_stream_admission_pause':{'result':'PASS','seconds':pause_elapsed,'unresolved_preserved':True},'partial_stream_revocation':'PASS','partial_disconnect':'PASS','idle_readers':idle_result,'credential_enrollment':'Gateway/Core/custody PASS','enrollment_lost_completion_recovery':'PASS','foreign_attempt_receipt_rejected':'PASS','credential_disable_recovery':'PASS','disabled_provider_extra_calls':0,'connection_candidate':'proposed-only PASS','connection_review':'recommendation-only PASS','connection_activation':'bounded verification PASS','connection_stop_replacement':'PASS','real_account':False})
finally:
    for reader in idle_readers:reader.close()
    for p in reversed(processes):
        if p.poll() is None: p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.wait(timeout=5)
