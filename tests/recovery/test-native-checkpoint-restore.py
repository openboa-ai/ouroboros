"""Bounded, account-free Linux compatibility probe; not company successor admission."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import selectors
import subprocess
import time
import uuid
from tests.support.fixture_config import clean_environment

p=argparse.ArgumentParser()
for name in ['docker-socket','image','checkpoint','manifest','output']:p.add_argument('--'+name,required=True)
a=p.parse_args()
assert os.uname().sysname=='Linux'
assert Path(a.docker_socket).is_absolute() and '..' not in Path(a.docker_socket).parts
assert re.fullmatch(r'sha256:[0-9a-f]{64}',a.image)
root=Path(a.output);root.mkdir(mode=0o700)
manifest=json.loads(Path(a.manifest).read_text());data=Path(a.checkpoint).read_bytes()
assert 0<len(data)<=4*1024*1024 and len(data)==manifest['bytes'] and hashlib.sha256(data).hexdigest()==manifest['sha256']
thread=manifest['thread_id'];assert str(uuid.UUID(thread))==thread
path=PurePosixPath(manifest['source_path']);relative=path.relative_to('/home/agent/.codex/sessions')
assert len(relative.parts)==4 and all(re.fullmatch(r'[0-9]+',v) for v in relative.parts[:3])
assert path.name.startswith('rollout-') and path.name.endswith('-'+thread+'.jsonl') and '..' not in str(path)
records=[json.loads(line) for line in data.splitlines()]
assert records[0]['type']=='session_meta' and records[0]['payload']['id']==thread
original_turns={r['payload']['turn_id'] for r in records if r.get('type')=='event_msg' and r.get('payload',{}).get('type')=='task_started'}
assert original_turns
cmd=['docker','-H','unix://'+a.docker_socket];env=clean_environment()
def run(args,**kw):return subprocess.run(cmd+args,env=env,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15,**kw).stdout
cid=None;proc=None
try:
    cid=run(['create','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=256m','--pids-limit=64','--user=65532:65532','--tmpfs','/home/agent:rw,nosuid,nodev,size=16m,uid=65532,gid=65532','--tmpfs','/workspace:rw,nosuid,nodev,size=1m,uid=65532,gid=65532','--tmpfs','/tmp:rw,nosuid,nodev,size=16m,uid=65532,gid=65532','--entrypoint','/bin/sleep',a.image,'40']).decode().strip()
    run(['start',cid])
    run(['exec','-i',cid,'/bin/sh','-c','umask 077; mkdir -p "$1" /workspace/recovered && cat > "$2"','checkpoint-import',str(path.parent),str(path)],input=data)
    settings=['model="fixture-model"','model_provider="ouroboros"','model_providers.ouroboros.name="Ouroboros offline restore probe"','model_providers.ouroboros.base_url="http://127.0.0.1:9/v1"','model_providers.ouroboros.wire_api="responses"','model_providers.ouroboros.requires_openai_auth=false','mcp_servers.fixture.enabled=false','mcp_servers.fixture.url="http://127.0.0.1:9/mcp"']
    argv=cmd+['exec','-i','-e','HOME=/home/agent','-e','CODEX_HOME=/home/agent/.codex',cid,'/usr/local/bin/codex']
    for setting in settings:argv+=['-c',setting]
    stderr=(root/'native-stderr.log').open('xb')
    proc=subprocess.Popen(argv+['app-server'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=stderr,env=env);stderr.close()
    pending=bytearray();selector=selectors.DefaultSelector();selector.register(proc.stdout,selectors.EVENT_READ);total=0
    def send(value):proc.stdin.write((json.dumps(value)+'\n').encode());proc.stdin.flush()
    def answer(request_id):
        global total
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            if b'\n' not in pending:
                if not selector.select(max(0,deadline-time.monotonic())):raise TimeoutError('native response deadline')
                chunk=os.read(proc.stdout.fileno(),65536);assert chunk,'native channel closed'
                pending.extend(chunk);total+=len(chunk);assert total<=2*1024*1024
                continue
            line,_,rest=pending.partition(b'\n');pending[:]=rest
            value=json.loads(line)
            assert not ('method' in value and 'id' in value),'unexpected native server request'
            if value.get('id')==request_id:
                assert 'error' not in value,'native request rejected'
                return value['result']
        raise TimeoutError('native response deadline')
    send({'id':1,'method':'initialize','params':{'clientInfo':{'name':'ouroboros_restore_probe','version':'0.1.0'}}});answer(1)
    send({'method':'initialized'})
    send({'id':2,'method':'thread/resume','params':{'threadId':thread,'cwd':'/workspace/recovered','model':'fixture-model','modelProvider':'ouroboros','approvalPolicy':'never','sandbox':'workspace-write'}})
    resumed=answer(2)
    assert resumed['thread']['id']==thread
    assert original_turns.issubset({turn['id'] for turn in resumed['thread']['turns']})
    assert resumed['cwd']=='/workspace/recovered' and resumed['modelProvider']=='ouroboros'
    (root/'response.json').write_text(json.dumps(resumed))
    (root/'result.json').write_text(json.dumps({'result':'PASS','thread_id':thread,'restored_turns':len(resumed['thread']['turns']),'current_cwd':resumed['cwd'],'network':'none','owner_credentials_imported':False,'copied_files':1,'turn_start':'NOT RUN','company_successor_admission':'NOT RUN','resume_qualified':False},indent=2)+'\n')
finally:
    if proc and proc.poll() is None:
        proc.terminate()
        try:proc.wait(timeout=2)
        except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=2)
    if cid:run(['rm','-f',cid])
