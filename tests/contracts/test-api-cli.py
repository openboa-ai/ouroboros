"""Exercise real Rust processes + mTLS + PostgreSQL. Never dispatch a private payload."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse,concurrent.futures,json,ssl,subprocess,time,urllib.request,urllib.error,uuid
from pathlib import Path
from tests.support.fixture_config import clean_environment, load_config
args,fixture=load_config(argparse.ArgumentParser())
fixture.require_ports('core','gateway');p=fixture.existing_root();meta=json.loads((p/'fixture.json').read_text())
fixture.claim_test('api-cli')
ctx=ssl.create_default_context(cafile=str(p/'ca.pem'));ctx.load_cert_chain(p/'human.pem',p/'human.key')
unregistered=ssl.create_default_context(cafile=str(p/'ca.pem'));unregistered.load_cert_chain(p/'unregistered.pem',p/'unregistered.key')
runtime_ctx=ssl.create_default_context(cafile=str(p/'ca.pem'));runtime_ctx.load_cert_chain(p/'runtime.pem',p/'runtime.key')
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
 for _ in range(30):
  try:
   ready=call('/conditions')
   if ready[0]==200:break
  except OSError as e:ready=str(e)
  time.sleep(.1)
 else:raise RuntimeError('services not ready: '+str(ready))
 conditions=cli('conditions');assert conditions['runtime_ready'] is False
 # Only the authenticated Runtime can reconcile existing registrations; Gateway is not a worker.
 reconcile='/runtime/service-continuations/reconcile'
 body={'profile_id':'fixture-no-payload'}
 assert call(reconcile,body,port='core')[0]==403
 assert call(reconcile,body)==(503,'capability not connected'),'Gateway must not forward the Runtime controller route'
 assert call(reconcile,body,port='core',context=unregistered,extra={'X-Ouro-Client-Fingerprint':meta['fingerprints']['runtime']})[0]==403
 assert call(reconcile,body,port='core',context=runtime_ctx)==(200,{'checked':[]})
 assert call(reconcile,{**body,'worker_id':meta['fingerprints']['runtime']},port='core',context=runtime_ctx)[0]==422

 assert call('/conditions',context=unregistered)[0]==403
 assert call('/conditions',port='core')[0]==403,'human cannot act as Gateway service'
 assert call('/conditions',extra={'X-Ouro-Client-Fingerprint':meta['fingerprints']['unregistered']})[1]['principal_id']==meta['principal_id'],'Gateway replaces forged context'
 no_cert=ssl.create_default_context(cafile=str(p/'ca.pem'))
 try:call('/conditions',context=no_cert);raise AssertionError('missing client certificate accepted')
 except (ssl.SSLError,urllib.error.URLError):pass
 work={'delegation_id':meta['delegation_id'],'purpose':'API CLI environment fixture'};(p/'work.json').write_text(json.dumps(work))
 w=cli('work','--input',str(p/'work.json'),'--key','api-work');assert w['state']=='succeeded'
 binding=conditions['owner_binding']
 assert binding['environment_id']==conditions['environment_id'] and binding['firm_id']==conditions['firm_id'] and binding['principal_id']==conditions['principal_id']
 bound_headers={'X-Ouro-Owner-Binding':json.dumps(binding)}
 assert call('/conditions',extra=bound_headers)[0]==200
 before_bound=cli('conditions')
 for field in ('environment_id','firm_id','principal_id','serving_generation'):
  stale={**binding,field:str(uuid.uuid4())}
  for original_key in ('api-work','must-not-be-created'):
   assert call('/work',work,original_key,extra={'X-Ouro-Owner-Binding':json.dumps(stale)})[0]==409
 assert call('/conditions',extra={'X-Ouro-Owner-Binding':'{}'})[0]==400
 assert cli('conditions')==before_bound,'stale owner bindings changed authority, reservations or events'
 original_path='/intents/by-request-key?operation=work.create&request_key=api-work'
 original=call(original_path,extra=bound_headers)
 assert original[0]==200 and original[1]['intent']['intent_id']==w['intent_id'] and original[1]['resubmitted'] is False
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
 # Public continuation routes preserve the same Gateway boundary and require a scoped Company root.
 assert call('/service-continuations',{'execution_id':accepted['resource_id'],'max_restarts':1,'restart_window_seconds':60,'backoff_seconds':1},'not-a-company-call')[0]==403

 claim_path='/runtime/claims/'+accepted['intent_id']
 assert call(claim_path,port='core')[0]==403
 assert call(claim_path,port='core',context=unregistered,extra={'X-Ouro-Client-Fingerprint':meta['fingerprints']['runtime']})[0]==403
 status,unclaimed=call(claim_path,port='core',context=runtime_ctx)
 assert status==200 and unclaimed['claim'] is None
 claim_context=unclaimed['context']
 assert claim_context['environment_id']==conditions['environment_id'] and claim_context['worker_id']==meta['fingerprints']['runtime']
 assert claim_context['execution_id']==accepted['resource_id'] and claim_context['intent_id']==accepted['intent_id']
 before_claims=cli('conditions')
 for field in ('environment_id','firm_id','serving_generation','worker_id','execution_id','intent_id','profile_id'):
  changed={**claim_context,field:str(uuid.uuid4())}
  assert call(claim_path,{},port='core',context=runtime_ctx,extra={'X-Ouro-Runtime-Claim':json.dumps(changed)})[0]==409
 assert call(claim_path,{},port='core',context=runtime_ctx,extra={'X-Ouro-Runtime-Claim':'{}'})[0]==400
 assert cli('conditions')==before_claims,'invalid Runtime context admitted an attempt or changed resource accounting'
 # Service recovery observations are independent of general executions and never submit work.
 services_path=f"/work/{w['resource_id']}/service-continuations"
 status,services=call(services_path)
 assert status==200 and services['items']==[] and services['source']=='core_service_records'
 assert services['health_assessed'] is False and services['has_more'] is False
 assert call(f"/service-continuations/{accepted['intent_id']}/stop-requests/absent")[0]==404
 # Exercise the owner observations against the same real Core SQL/mTLS fixture.
 execution_path=f"/work/{w['resource_id']}/executions"
 activity_path=f"/work/{w['resource_id']}/activity"
 status,execution_page=call(execution_path)
 assert status==200 and execution_page['authority_revision']==conditions['revision']
 assert execution_page['source']=='core_records' and execution_page['observed_at']
 assert execution_page['next_cursor'] is None and not execution_page['has_more']
 assert [row['id'] for row in execution_page['items']]==[accepted['resource_id']]
 observed=execution_page['items'][0]
 assert observed['initiating_principal_id']==meta['principal_id'] and observed['agent_principal_id'] is None
 assert observed['instance_id'] is None and observed['runtime'] is None and observed['native_model'] is None
 assert observed['can_stop'] and not observed['terminated'] and observed['compute_return'] is None
 assert observed['profile_id']=='fixture-no-payload'
 assert call(f"/work/{child['resource_id']}/executions")[1]['items']==[]
 assert call(execution_path,context=unregistered)[0]==403
 assert call('/work/'+str(uuid.uuid4())+'/executions')[0]==404
 # A separate registered human has inspection scope only on the child, not its parent.
 observer,observer_grant=str(uuid.uuid4()),str(uuid.uuid4())
 database=fixture.metadata()['database']
 fixture.sql(f"""INSERT INTO principals VALUES('{meta['firm_id']}','{observer}','human',true);
 INSERT INTO credentials VALUES('{meta['fingerprints']['unregistered']}','{meta['firm_id']}','{observer}',true,clock_timestamp()+interval '1 hour');
 INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at,work_root_id)
 VALUES('{meta['firm_id']}','{observer_grant}','{observer}',ARRAY['inspect'],clock_timestamp()+interval '1 hour','{child['resource_id']}');
 INSERT INTO work_controls VALUES('{meta['firm_id']}','{child['resource_id']}','{observer}');""",database)
 assert call(f"/work/{child['resource_id']}/executions",context=unregistered)[0]==200
 assert call(f"/work/{child['resource_id']}/activity",context=unregistered)[0]==200
 assert call(execution_path,context=unregistered)[0]==404
 assert call(activity_path,context=unregistered)[0]==404
 assert call(services_path,context=unregistered)[0]==404
 assert call(f"/work/{child['resource_id']}/service-continuations",context=unregistered)[0]==200
 assert call(f"/executions/{accepted['resource_id']}/stop",{'expected_revision':conditions['revision']},'observer-stop',context=unregistered)[0]==403
 # Seed retained event evidence, including historical native events with missing work_id.
 # Sensitive-looking fixture payloads must never leak from the metadata-only projection.
 fixture.sql(f"""WITH updated AS (
 UPDATE firms SET event_sequence=event_sequence+102 WHERE id='{meta['firm_id']}' RETURNING event_sequence-102 AS base)
 INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data,work_id)
 SELECT '{meta['firm_id']}',base+n,'{meta['principal_id']}',
 CASE WHEN n=1 THEN 'native.turn_observed' ELSE 'resource.completed' END,
 '{accepted['resource_id']}',jsonb_build_object('operation','fixture.read','state','succeeded',
 'thread_id','fixture-native-thread','turn_id','fixture-native-turn','status','completed',
 'input','PRIVATE-FIXTURE-PAYLOAD','output','PRIVATE-FIXTURE-PAYLOAD','text','PRIVATE-FIXTURE-PAYLOAD',
 'receipt',jsonb_build_object('secret','PRIVATE-FIXTURE-PAYLOAD'),'binding','PRIVATE-FIXTURE-PAYLOAD'),
 CASE WHEN n=1 THEN NULL::uuid ELSE '{w['resource_id']}'::uuid END
 FROM updated CROSS JOIN generate_series(1,102) n;""",database)
 status,activity=call(activity_path)
 assert status==200 and activity['native_transcript_available'] is False
 assert len(activity['items'])==100 and activity['has_more'] and activity['next_cursor']==activity['cursor']
 all_events=activity['items'][:]
 while activity['has_more']:
  status,activity=call(activity_path+'?cursor='+urllib.parse.quote(activity['next_cursor'],safe=''))
  assert status==200;all_events.extend(activity['items'])
 activity_cursor=activity['cursor']
 assert len({event['sequence'] for event in all_events})==len(all_events)
 assert all(event['work_id']==w['resource_id'] for event in all_events)
 assert any(event['kind']=='native.turn_observed' and event['status']=='completed' for event in all_events)
 assert 'PRIVATE-FIXTURE-PAYLOAD' not in json.dumps(all_events)
 assert all(not {'input','output','receipt','text','binding'} & event.keys() for event in all_events)
 assert call(activity_path+'?cursor='+urllib.parse.quote(activity_cursor,safe=''))[1]['items']==[]
 child_events=call(f"/work/{child['resource_id']}/activity")[1]['items']
 assert all(event['work_id']==child['resource_id'] for event in child_events)
 assert not any(event['kind']=='native.turn_observed' for event in child_events)
 assert call(f"/work/{child['resource_id']}/activity?cursor="+urllib.parse.quote(activity_cursor,safe=''))[0]==409
 assert call(execution_path+'?cursor='+urllib.parse.quote(activity_cursor,safe=''))[0]==409
 assert call(services_path+'?cursor='+urllib.parse.quote(activity_cursor,safe=''))[0]==409
 wrong_actor=activity_cursor.replace(meta['principal_id'],observer,1)
 assert call(activity_path+'?cursor='+urllib.parse.quote(wrong_actor,safe=''))[0]==409
 # Notifications project the same retained native event, with durable personal reads.
 status,notifications=call('/notifications')
 assert status==200 and notifications['unread']=={'total':1,'by_category':{'message':0,'execution':1,'control':0,'publication':0}}
 assert len(notifications['items'])==1 and notifications['items'][0]['kind']=='native_turn_completed'
 notification=notifications['items'][0];notification_id=notification['id']
 assert notification['source']['execution_id']==accepted['resource_id'] and notification['read_at'] is None
 assert 'PRIVATE-FIXTURE-PAYLOAD' not in json.dumps(notifications)
 assert call('/notifications',context=unregistered)[1]['items']==[]
 assert call('/notifications/read',{'ids':[notification_id]},context=unregistered)[0]==404
 before_reads=cli('conditions')
 assert call('/notifications')[1]['items']==notifications['items']
 assert cli('conditions')==before_reads,'GET notifications created state/events'
 assert call('/notifications/read',{'ids':[notification_id,'event:9223372036854775807']})[0]==404
 assert call('/notifications')[1]['unread']['total']==1,'mixed forbidden batch partially marked reads'
 status,read=call('/notifications/read',{'ids':[notification_id]})
 assert status==200 and read['unread']['total']==0 and read['items'][0]['read_at']
 assert 'T' in read['read_at'] and 'T' in notifications['observed_at']
 assert call('/notifications/read',{'ids':[notification_id]})[1]==read,'same source ID changed original read receipt'
 assert call('/notifications/read',{'ids':[notification_id],'principal_id':observer})[0]==422
 assert cli('conditions')==before_reads,'read acknowledgment changed authority/events/resources'
 read_page=call('/notifications')[1]
 # Restart only the two owned service processes; the same PG records must retain reads.
 for process in reversed(processes):process.terminate();process.wait(timeout=5)
 processes.clear()
 for name in ['core','gateway']:
  log=(p/(name+'-notification-restart.log')).open('wb')
  processes.append(subprocess.Popen([str(fixture.binary/f'ouroboros-{name}'),'--config',str(p/(name+'.json'))],stdout=log,stderr=log,env=clean_environment()));log.close()
 for attempt in range(30):
  try:
   if call('/conditions')[0]==200:break
  except OSError:
   # The listeners are still starting; the bounded loop must observe readiness.
   pass
  time.sleep(.1)
 else:raise AssertionError('services did not restart for notification read persistence')
 reconnected=call('/conditions')[1]
 assert reconnected['environment_id']==conditions['environment_id']
 assert reconnected['owner_binding']['serving_generation']!=binding['serving_generation']
 assert call(claim_path,{},port='core',context=runtime_ctx,extra={'X-Ouro-Runtime-Claim':json.dumps(claim_context)})[0]==409
 fresh_claim=call(claim_path,port='core',context=runtime_ctx)[1]
 assert fresh_claim['context']['serving_generation']!=claim_context['serving_generation']
 assert {k:v for k,v in fresh_claim['context'].items() if k!='serving_generation'}=={k:v for k,v in claim_context.items() if k!='serving_generation'}
 assert call(original_path,extra=bound_headers)[0]==409,'restarted Core accepted a stale native binding'
 assert call(original_path,extra={'X-Ouro-Owner-Binding':json.dumps(reconnected['owner_binding'])})[1]['intent']['intent_id']==w['intent_id']
 restored=call('/notifications')[1]
 assert restored['items']==read_page['items'] and restored['unread']==read_page['unread'] and restored['cursor']==read_page['cursor']
 assert call('/notifications/read',{'ids':[notification_id]})[1]==read
 notification_cursor=f"{restored['firm_id']}/{restored['principal_id']}:{restored['authority_revision']}:notifications:{restored['snapshot_sequence']}:0"
 # Incorrect authority revision must have no control effect.
 assert call(f"/executions/{accepted['resource_id']}/stop",{'expected_revision':conditions['revision']+1},'wrong-revision-stop')[0]==409
 assert not cli('get','executions',accepted['resource_id'])['stopped']
 stop_lookup=f"/executions/{accepted['resource_id']}/stop-requests/api-stop"
 status,missing_stop=call(stop_lookup)
 assert status==200 and missing_stop['recorded'] is False and missing_stop['resubmitted'] is False
 assert call(stop_lookup,context=unregistered)[0]==404
 cursor=conditions['cursor']
 req=urllib.request.Request(fixture.url('gateway')+'/events?cursor='+cursor)
 with fixture.opener(ctx).open(req,timeout=5) as res:
  lines=[res.readline().decode() for _ in range(3)]
  assert any('intent.accepted' in line or 'work.created' in line for line in lines)
 stop=cli('stop',accepted['resource_id'],'--revision',str(execution_page['authority_revision']),'--key','api-stop');assert stop['state']=='accepted'
 state=cli('get','executions',accepted['resource_id']);assert state['stopped'] and not state['terminated']
 before_lookup=cli('conditions')
 status,recorded_stop=call(stop_lookup)
 assert status==200 and recorded_stop['recorded'] and recorded_stop['resubmitted'] is False
 assert recorded_stop['intent']['intent_id']==stop['intent_id']
 assert recorded_stop['intent']['resource_id']==accepted['resource_id'] and recorded_stop['intent']['operation']=='execution.stop'
 assert recorded_stop['intent']['expected_revision']==execution_page['authority_revision']
 assert call(stop_lookup+'-different')[1]['recorded'] is False
 assert cli('conditions')==before_lookup,'request observation changed authority, event cursor, or reservations'
 assert call(activity_path+'?cursor='+urllib.parse.quote(activity_cursor,safe=''))[0]==409
 status,after_stop=call(execution_path)
 assert status==200 and after_stop['authority_revision']==execution_page['authority_revision']+1
 assert after_stop['items'][0]['stopped'] and not after_stop['items'][0]['can_stop']
 assert after_stop['items'][0]['compute_return'] is None and not after_stop['items'][0]['terminated']
 assert call(activity_path)[1]['authority_revision']==after_stop['authority_revision']
 status,after_stop_notifications=call('/notifications')
 assert status==200 and after_stop_notifications['unread']['by_category']['control']==1
 stop_notifications=[item for item in after_stop_notifications['items'] if item['category']=='control']
 assert len(stop_notifications)==1 and stop_notifications[0]['source']['intent_id']==stop['intent_id']
 assert stop_notifications[0]['kind']=='execution.stop_accepted' and stop_notifications[0]['status']=='accepted'
 assert call('/notifications?cursor='+urllib.parse.quote(notification_cursor,safe=''))[0]==409
 # A real Core claim with synthetic authority, deliberately without starting a payload.
 agent,agent_grant=str(uuid.uuid4()),str(uuid.uuid4())
 fixture.sql(f"""UPDATE delegations SET actions=array_append(actions,'inspect') WHERE firm_id='{meta['firm_id']}' AND id='{meta['delegation_id']}';
 INSERT INTO principals VALUES('{meta['firm_id']}','{agent}','agent',true);
 INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at)
 VALUES('{meta['firm_id']}','{agent_grant}','{agent}','{meta['delegation_id']}',ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour');
 INSERT INTO profiles VALUES('{meta['firm_id']}','codex-fixture',true,1,30);""",database)
 status,runtime_start=call('/executions',{**execution,'profile_id':'codex-fixture','units':1,'agent_delegation_id':agent_grant},'runtime-claim-fixture')
 assert status==202
 runtime_path='/runtime/claims/'+runtime_start['intent_id']
 prepared=call(runtime_path,port='core',context=runtime_ctx)[1]
 runtime_headers={'X-Ouro-Runtime-Claim':json.dumps(prepared['context'])}
 status,ticket=call(runtime_path,{},port='core',context=runtime_ctx,extra=runtime_headers)
 assert status==200 and ticket['intent_id']==runtime_start['intent_id']
 assert call(runtime_path,{},port='core',context=runtime_ctx,extra=runtime_headers)[0]==403,'claim must never be replayed as another execution'
 claimed=call(runtime_path,port='core',context=runtime_ctx)[1]
 assert claimed['claim']['instance_id']==ticket['instance_id'] and claimed['claim']['attempt_id']==ticket['attempt_id']
 assert claimed['claim']['generation']==ticket['generation'] and claimed['claim']['phase']=='preparing'
 assert claimed['claim']['terminated'] is False and claimed['claim']['capacity_returned'] is False
 before_claim_read=cli('conditions')
 assert call(runtime_path,port='core',context=runtime_ctx)[1]==claimed
 assert cli('conditions')==before_claim_read,'claim lookup created an attempt, event or allowance'
 cli('revoke',meta['delegation_id'],'--revision','1','--key','api-revoke')
 assert call('/executions',{**execution,'units':1},'after-revoke')[0]==403
 assert call('/events?cursor='+cursor)[0]==409
 assert cli('get','intents',accepted['intent_id'])['id']==accepted['intent_id']
 assert 'input' not in cli('get','intents',accepted['intent_id'])
 assert cli('conditions')['limits'][0]['committed']==71,'both unresolved reservations must remain counted'
 assert call(runtime_path,port='core',context=runtime_ctx)[1]==claimed,'revocation must retain assigned-worker inspection without permission to run'
 result={'suite':'real Rust mTLS API/CLI + caller-selected PostgreSQL','result':'PASS','private_execution':'NOT RUN','subscription':'NOT RUN','checks':['mTLS required','Runtime-only finite service continuation reconciliation and forged worker rejection','unregistered credential denied','Core service boundary','forged context replaced','CLI work/list/detail','authorized parent and scoped child','unauthorized parent denied','management input projection','concurrent capacity','idempotency','conflict','accepted versus running','snapshot/event continuation','stop versus termination','revocation denies successor','historical evidence retained','unresolved reservation retained','scoped per-work execution SQL projection','different human cannot inspect or stop parent work','metadata-only event pagination and historical native scope','actor/work/projection/revision-bound cursors','stop uses observed company authority revision','stable event-derived notification IDs and exact unread grouping','owner-only read IDs with atomic visibility checks and immutable replay receipts','notification reads survive owned service restart without new events','canonical stop request notification excludes mirrored acceptance']}
 result['notification_examples']={'first_page':notifications,'read_response':read,'after_restart':restored,'after_stop':after_stop_notifications}
 result['checks']+=['Runtime claim context checked before admission','Runtime context does not authenticate a caller','original claim lookup survives Core restart and revocation','claim lookup does not renew allowance or repeat dispatch']
 (p/'api-test-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 for process in reversed(processes):
  process.terminate()
  try:process.wait(timeout=5)
  except subprocess.TimeoutExpired:process.kill();process.wait()
