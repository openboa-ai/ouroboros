"""Exercise real Rust processes + mTLS + PostgreSQL. Never dispatch a private payload."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse,concurrent.futures,json,ssl,subprocess,time,urllib.request,urllib.error
from pathlib import Path
from tests.support.fixture_config import clean_environment, load_config
args,fixture=load_config(argparse.ArgumentParser())
fixture.require_ports('core','gateway');p=fixture.existing_root();meta=json.loads((p/'fixture.json').read_text())
fixture.claim_test('api-cli')
ctx=ssl.create_default_context(cafile=str(p/'ca.pem'));ctx.load_cert_chain(p/'human.pem',p/'human.key')
unregistered=ssl.create_default_context(cafile=str(p/'ca.pem'));unregistered.load_cert_chain(p/'unregistered.pem',p/'unregistered.key')
def call(path,body=None,key=None,context=ctx,port=None,extra=None):
 headers={'Content-Type':'application/json'}
 if key:headers['Idempotency-Key']=key
 headers.update(extra or {})
 req=urllib.request.Request(fixture.url('gateway' if port is None else port)+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with fixture.opener(context).open(req,timeout=8) as res:return res.status,json.load(res)
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
def cli(*args):
 result=subprocess.run([str(fixture.binary/'ouroboros-cli'),'--config',str(p/'cli.json'),*args],capture_output=True,check=True,env=clean_environment())
 return json.loads(result.stdout)
processes=[]
try:
 for name in ['core','gateway']:
  log=(p/(name+'.log')).open('wb')
  processes.append(subprocess.Popen([str(fixture.binary/f'ouroboros-{name}'),'--config',str(p/(name+'.json'))],stdout=log,stderr=log,env=clean_environment()));log.close()
 for attempt in range(30):
  try:
   ready=call('/conditions')
   if ready[0]==200:break
  except OSError as e:ready=str(e)
  time.sleep(.1)
 else:raise RuntimeError('services not ready: '+str(ready))
 conditions=cli('conditions');assert conditions['runtime_ready'] is False
 assert call('/conditions',context=unregistered)[0]==403
 assert call('/conditions',port='core')[0]==403,'human cannot act as Gateway service'
 assert call('/conditions',extra={'X-Ouro-Client-Fingerprint':meta['fingerprints']['unregistered']})[1]['principal_id']==meta['principal_id'],'Gateway replaces forged context'
 no_cert=ssl.create_default_context(cafile=str(p/'ca.pem'))
 try:call('/conditions',context=no_cert);raise AssertionError('missing client certificate accepted')
 except (ssl.SSLError,urllib.error.URLError):pass
 work={'delegation_id':meta['delegation_id'],'purpose':'API CLI environment fixture'};(p/'work.json').write_text(json.dumps(work))
 w=cli('work','--input',str(p/'work.json'),'--key','api-work');assert w['state']=='succeeded'
 listed=cli('list-work');assert [item['id'] for item in listed['items']]==[w['resource_id']] and listed['next_cursor'] is None
 child_request={**work,'purpose':'scoped child','parent_work_id':w['resource_id']}
 status,child=call('/work',child_request,'api-child');assert status==200
 assert cli('get','work',child['resource_id'])['parent_id']==w['resource_id']
 assert {item['id'] for item in cli('list-work')['items']}=={w['resource_id'],child['resource_id']}
 assert call('/work',{**child_request,'parent_work_id':'00000000-0000-0000-0000-000000000000'},'outside-parent')[0]==403
 execution={'work_id':w['resource_id'],'delegation_id':meta['delegation_id'],'profile_id':'fixture-no-payload','units':70,'lifetime_seconds':30,'predecessor_execution_id':None}
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as workers:
  results=list(workers.map(lambda k:(k,call('/executions',execution,k)),['api-A','api-B']))
 assert sorted(v[0] for _,v in results)==[202,429]
 key,(_,accepted)=next((k,v) for k,v in results if v[0]==202)
 assert call('/executions',execution,key)[1]['intent_id']==accepted['intent_id']
 changed={**execution,'units':71};assert call('/executions',changed,key)[0]==409
 state=cli('get','executions',accepted['resource_id']);assert state['instance_id'] is None
 cursor=conditions['cursor']
 req=urllib.request.Request(fixture.url('gateway')+'/events?cursor='+cursor)
 with fixture.opener(ctx).open(req,timeout=5) as res:
  lines=[res.readline().decode() for _ in range(3)]
  assert any('intent.accepted' in line or 'work.created' in line for line in lines)
 stop=cli('stop',accepted['resource_id'],'--revision','0','--key','api-stop');assert stop['state']=='accepted'
 state=cli('get','executions',accepted['resource_id']);assert state['stopped'] and not state['terminated']
 cli('revoke',meta['delegation_id'],'--revision','1','--key','api-revoke')
 assert call('/executions',{**execution,'units':1},'after-revoke')[0]==403
 assert call('/events?cursor='+cursor)[0]==409
 assert cli('get','intents',accepted['intent_id'])['id']==accepted['intent_id']
 assert 'input' not in cli('get','intents',accepted['intent_id'])
 assert cli('conditions')['limits'][0]['committed']==70
 result={'suite':'real Rust mTLS API/CLI + caller-selected PostgreSQL','result':'PASS','private_execution':'NOT RUN','subscription':'NOT RUN','checks':['mTLS required','unregistered credential denied','Core service boundary','forged context replaced','CLI work/list/detail','authorized parent and scoped child','unauthorized parent denied','management input projection','concurrent capacity','idempotency','conflict','accepted versus running','snapshot/event continuation','stop versus termination','revocation denies successor','historical evidence retained','unresolved reservation retained']}
 (p/'api-test-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 for process in reversed(processes):
  process.terminate()
  try:process.wait(timeout=5)
  except subprocess.TimeoutExpired:process.kill();process.wait()
