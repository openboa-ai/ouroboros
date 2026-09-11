"""Dedicated Linux guest only. Real Rust services/Runtime, synthetic authority, no provider calls."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
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
import urllib.error
import urllib.request
import uuid

p = argparse.ArgumentParser()
p.add_argument('--failure', choices=['revoke', 'runtime-kill'], default='revoke')
from tests.support.fixture_config import clean_environment, load_config, local_url
a,fixture = load_config(p)
assert os.geteuid() == 0
fixture.require_ports('core','gateway');admin=local_url(fixture.admin_url())
runtime_values=fixture.runtime_values();binary=fixture.binary
if fixture.ports['bridge'] != 18080:
    raise ValueError('the pinned native CLI/MCP profile requires explicit bridge port 18080')
root=fixture.create_root(mode=0o755);ipc=fixture.create_ipc_root()
(ipc/'gateway').mkdir(mode=0o711);os.chown(ipc/'gateway',70002,70002)
child_env=clean_environment()
processes = []
runtime = None
cid = None
checks = []

def run(args, **kw):
    if args[0]=='docker':args=fixture.docker(*args[1:])
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, **{'env':child_env,**kw}).stdout

def write(path, content, uid=0, mode=0o600):
    path.write_text(content)
    path.chmod(mode)
    os.chown(path, uid, uid)

def drop(uid):
    def f():
        os.setgroups([])
        os.setgid(uid)
        os.setuid(uid)
    return f

# Fixed test OS identities have no Docker group membership or shared private keys.
for name, uid in [('core',70001),('gateway',70002),('cli',70003),('runtime',0),('ca',0)]:
    folder = root/name
    folder.mkdir(mode=0o700)
    os.chown(folder,uid,uid)

def key(name):
    run(['openssl','genpkey','-algorithm','ED25519','-out',str(root/'ca'/f'{name}.key')])
key('ca')
run(['openssl','req','-x509','-new','-key',str(root/'ca/ca.key'),'-subj','/CN=Ouroboros connected fixture','-days','1','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign','-out',str(root/'ca/ca.pem')])
write(root/'ca/cert.ext',fixture.cert_extensions())
fps = {}
for name in ['core','gateway','gateway-service','runtime','human']:
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
('{firm}','{grant}','{human}',NULL,ARRAY['work.create','execution.start','inspect'],clock_timestamp()+interval '1 hour'),
('{firm}','{child}','{agent}','{grant}',ARRAY['execution.start','inspect'],clock_timestamp()+interval '1 hour'),
('{firm}','{control}','{human}',NULL,ARRAY['inspect','execution.stop','delegation.revoke'],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','compute',100,0);
INSERT INTO profiles VALUES('{firm}','gateway-probe',true,100,20);
""",db)
write(root/'core/db.url',database_url(role,pw,db),70001)
gw_socket=ipc/'gateway/instance.sock'
write(root/'core/config.json',json.dumps({'listen':fixture.endpoint('core'),'tls':tls('core','core',70001),'database_url_file':str(root/'core/db.url'),'firm_id':firm,'gateway_fingerprint':fps['gateway-service'],'runtime_fingerprint':fps['runtime']}),70001)
write(root/'gateway/config.json',json.dumps({'listen':fixture.endpoint('gateway'),'tls':tls('gateway','gateway',70002),'core_url':fixture.url('core'),'core_client':tls('gateway','gateway-service',70002),'instance_socket':str(gw_socket)}),70002)
# Bridge traverses only the separate IPC directory; Gateway credentials remain private.
write(root/'cli/config.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('cli','human',70003)}),70003)
write(root/'runtime/config.json',json.dumps({'core_url':fixture.url('core'),'tls':tls('runtime','runtime',0),'profile_id':'gateway-probe','profile':{'image':runtime_values['image'],'docker_socket':str(runtime_values['docker_socket']),'memory_bytes':67108864,'nano_cpus':500000000,'pids_limit':32,'lifetime_seconds':20},'gateway_socket':str(gw_socket),'binary_dir':str(binary),'evidence_dir':str(root/'runtime'),'bridge_uid':runtime_values['bridge_uid'],'guard_uid':runtime_values['guard_uid'],'gateway_uid':70002,'ipc_root':str(ipc)}))
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

try:
    for name,uid in [('core',70001),('gateway',70002)]:
        log=(root/name/'process.log').open('wb')
        proc=subprocess.Popen([str(binary/f'ouroboros-{name}'),'--config',str(root/name/'config.json')],preexec_fn=drop(uid),stdout=log,stderr=log,env=child_env)
        processes.append(proc)
        log.close()
    for _ in range(50):
        try:
            if api('/conditions')[0]==200:break
        except OSError:pass
        time.sleep(.1)
    else:raise RuntimeError('control services not ready')
    assert api('/runtime/pending?profile=gateway-probe')[0]==503
    assert api('/runtime/pending?profile=gateway-probe','core')[0]==403
    assert api('/conditions',headers={'x-ouro-bridge-peer':'{}'})[1]['principal_id']==human
    checks+=['service RPC not exposed to human','human cannot forge instance context']
    write(root/'cli/work.json',json.dumps({'purpose':'connected environment probe','delegation_id':grant}),70003)
    work=cli('work','--input',str(root/'cli/work.json'),'--key','connected-work')['resource_id']
    write(root/'cli/start.json',json.dumps({'work_id':work,'delegation_id':grant,'agent_delegation_id':child,'profile_id':'gateway-probe','units':70,'lifetime_seconds':12,'predecessor_execution_id':None}),70003)
    accepted=cli('start','--input',str(root/'cli/start.json'),'--key','connected-start')
    assert accepted['state']=='accepted'
    log=(root/'runtime/process.log').open('wb')
    runtime=subprocess.Popen([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json')],stdout=log,stderr=log,env=child_env)
    log.close()
    for _ in range(70):
        state=cli('get','executions',accepted['resource_id'])
        if state['instance_id']:
            evidence=root/'runtime'/state['instance_id']
            probe=evidence/'probe.jsonl'
            if probe.exists() and agent in probe.read_text():break
        if runtime.poll() is not None:raise RuntimeError('Runtime failed before probe; inspect protected runtime log')
        time.sleep(.1)
    else:raise RuntimeError('connected probe did not appear')
    binding=json.loads((evidence/'binding.json').read_text())
    cid=binding['container_id']
    sample=json.loads(next(x for x in probe.read_text().splitlines() if x.startswith('{')))
    assert sample['principal_id']==agent and sample['delegations']==[child] and sample['work_id']==work
    checks+=['Core admission creates actual bound instance','actual instance uses shared Gateway and Core','agent sees only bound delegation']
    # An outer local process is not this bridge even if it copies the same claimed identity.
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
        s.connect(str(gw_socket))
        fake=json.dumps(binding['peer'])
        s.sendall(f'GET /conditions HTTP/1.1\r\nHost: local\r\nx-ouro-bridge-peer: {fake}\r\nConnection: close\r\n\r\n'.encode())
        assert b'403' in s.recv(4096).split(b'\r\n',1)[0]
    checks.append('copied bridge identity denied by actual kernel peer')
    if a.failure=='revoke':
        os.kill(runtime.pid,signal.SIGSTOP)
        cli('revoke',grant,'--revision','0','--key','connected-revoke')
        denied=subprocess.run(fixture.docker('exec',cid,'wget','-T','1','-qO-',f'http://127.0.0.1:{fixture.ports["bridge"]}/conditions'),capture_output=True,timeout=3,env=child_env)
        assert denied.returncode!=0 and b'403' in denied.stderr
        checks.append('revocation cuts Gateway access while Runtime is paused')
        os.kill(runtime.pid,signal.SIGCONT)
        assert runtime.wait(timeout=8)==0
        state=cli('get','executions',accepted['resource_id'])
        assert state['terminated'] and cli('conditions')['limits'][0]['committed']==70
        checks+=['revocation triggers actual termination','termination preserves unsettled reservation']
    else:
        os.kill(runtime.pid,signal.SIGKILL)
        runtime.wait(timeout=3)
        end=time.monotonic()+16
        while time.monotonic()<end:
            if not json.loads(run(['docker','inspect',cid]))[0]['State']['Running']:break
            time.sleep(.2)
        else:raise RuntimeError('guard did not stop orphaned instance')
        state=cli('get','executions',accepted['resource_id'])
        assert not state['terminated'] and cli('conditions')['limits'][0]['committed']==70
        checks+=['independent guard terminates after Runtime SIGKILL','Core does not invent termination receipt after observer loss']
        # Recovery authenticates as the assigned Runtime and reconciles the original backend ID.
        cli('revoke',grant,'--revision','0','--key','revoke-before-reconcile')
        run([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json'),'--reconcile',state['instance_id']])
        state=cli('get','executions',accepted['resource_id'])
        assert state['terminated'] and cli('conditions')['limits'][0]['committed']==70
        checks.append('replacement Runtime reconciles original termination after revocation without releasing reservations')
    assert not json.loads(run(['docker','inspect',cid]))[0]['State']['Running']
    result={'result':'PASS','failure':a.failure,'checks':checks,'fixture_id':fixture.identity,'native_codex':'NOT RUN in this connected test','subscription':'NOT RUN','resources_and_fresh_instance_recovery':'NOT RUN'}
    write(root/'result.json',json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
except BaseException as e:
    write(root/'result.json',json.dumps({'result':'FAIL','type':type(e).__name__,'fixture_id':fixture.identity})+'\n')
    print(json.dumps({'result':'FAIL','fixture_id':fixture.identity}))
    raise
finally:
    if runtime and runtime.poll() is None:
        os.kill(runtime.pid,signal.SIGCONT)
        runtime.terminate()
        try:runtime.wait(timeout=3)
        except subprocess.TimeoutExpired:runtime.kill();runtime.wait()
    if cid:
        subprocess.run(fixture.docker('rm','-f',cid),env=child_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
    for proc in reversed(processes):
        proc.terminate()
        proc.wait(timeout=3)
