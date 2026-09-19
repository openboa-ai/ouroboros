"""Synthetic local adapter preparation through ordinary APIs for the native guest fixture.

Only the explicit disposable fixture provisions authority. Submission, verification, acceptance,
activation and invocation use product APIs; no approval or effect receipt is fabricated.
"""

import concurrent.futures
import hashlib
import json
import os
import signal
from pathlib import Path
import subprocess
import time
import uuid


def wait_worker_execution(worker, read_execution, *, timeout=25):
    """Observe the admitted execution while its bounded worker completes."""
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        value = read_execution()
        if value['terminated'] and value['compute_return'] is not None:
            return value
        exit_code = worker.poll()
        if exit_code is not None:
            assert exit_code == 0, f'bounded worker exited with code {exit_code}'
            # The previous API snapshot can precede the worker's final commit.
            # Successful process exit still requires a fresh terminal record.
            value = read_execution()
            assert value['terminated'] and value['compute_return'] is not None, \
                'bounded worker exited without committed completion'
            return value
        time.sleep(.05)
    raise AssertionError('bounded worker did not finish admitted execution')


class NativeAdapterFixture:
    def __init__(self, c):
        self.c = c
        self.worker = None
        self.preparation_worker = None
        self.service_pool = None

    def prepare(self):
        c = self.c
        root, firm, work, grant = (c[k] for k in ['root', 'firm', 'work', 'grant'])
        sql, run, write, cli = (c[k] for k in ['sql', 'run', 'write', 'cli'])
        db, child = c['db'], c['child']
        reviewer, review_grant, verifier, verify_grant = [str(uuid.uuid4()) for _ in range(4)]
        folder = root/'reviewer'
        folder.mkdir(mode=0o700)
        # These fixture-only credentials stay outside every contained execution.
        c['key']('reviewer')
        run(['openssl','req','-new','-key',str(root/'ca/reviewer.key'),'-subj','/CN=reviewer','-out',str(root/'ca/reviewer.csr')])
        run(['openssl','x509','-req','-in',str(root/'ca/reviewer.csr'),'-CA',str(root/'ca/ca.pem'),'-CAkey',str(root/'ca/ca.key'),'-CAcreateserial','-days','1','-extfile',str(root/'ca/cert.ext'),'-out',str(root/'ca/reviewer.pem')])
        fingerprint = hashlib.sha256(run(['openssl','x509','-in',str(root/'ca/reviewer.pem'),'-outform','DER'])).hexdigest()
        write(folder/'config.json',json.dumps({'gateway_url':c['fixture'].url('gateway'),'tls':c['tls']('reviewer','reviewer',0)}))
        operations=['conversation.create','conversation.send','conversation.read','adapter.submit','adapter.verify','adapter.evaluate','adapter.accept','adapter.activate','adapter.invoke','adapter.stop']
        sql(f"UPDATE delegations SET actions=actions||ARRAY[{','.join(repr(x) for x in operations)}] WHERE firm_id='{firm}' AND id IN ('{grant}','{child}'); INSERT INTO resource_targets VALUES('{firm}','adapter-tools','unbound-adapter',true,'{{}}',4096);",db)
        for d in [grant,child]:
            sql(f"INSERT INTO resource_scopes VALUES('{firm}','{work}','{d}','adapter-tools',ARRAY['inspect',{','.join(repr(x) for x in operations)}],NULL)",db)
        sql(f"INSERT INTO principals VALUES('{firm}','{reviewer}','human',true),('{firm}','{verifier}','agent',true); INSERT INTO credentials VALUES('{fingerprint}','{firm}','{reviewer}',true,clock_timestamp()+interval '1 hour'); INSERT INTO work_controls VALUES('{firm}','{work}','{reviewer}'); INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{review_grant}','{reviewer}',NULL,actions,expires_at FROM delegations WHERE id='{grant}'; INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{verify_grant}','{verifier}','{review_grant}',actions,expires_at FROM delegations WHERE id='{child}'; INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{c['adapter_child']}','{verifier}','{child}',actions,expires_at FROM delegations WHERE id='{child}'",db)
        if c['a'].admission_pause or c['a'].admission_pause_running:
            sql(f"UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE firm_id='{firm}' AND id='{review_grant}'",db)
        for d in [review_grant,verify_grant,c['adapter_child']]:
            sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,'{d}',target_id,operations,namespace_id FROM resource_scopes WHERE delegation_id='{grant}'",db)
        def request(path, body, key, review=False):
            file=root/'runtime'/('adapter-'+key+'.json');write(file,json.dumps(body))
            if review:
                return json.loads(run([str(c['binary']/'ouroboros-cli'),'--config',str(folder/'config.json'),'request','POST',path,'--input',str(file),'--key',key]))
            write(file,json.dumps(body),70003)
            # CLI input must be traversable by its own UID.
            target=root/'cli'/file.name;write(target,json.dumps(body),70003)
            return cli('request','POST',path,'--input',str(target),'--key',key)
        self.service_channels = []
        self.service_questions = []
        if c['a'].bounded_service:
            for principal, label in [(c['agent'],'source'),(verifier,'service')]:
                channel=request('/conversations',{'work_id':work,'delegation_id':grant,'responsible_agent_id':principal},'channel-'+label)['resource_id']
                self.service_channels.append(channel)
                for number in range(2):
                    message=request('/conversations/'+channel+'/messages',{'delegation_id':grant,'text':'service-request-'+label+str(number)},'question-'+label+str(number))
                    self.service_questions.append(message['resource_id'])
        scope={'work_id':work,'delegation_id':grant}
        def resource(path,body,key):
            file=root/'cli'/('adapter-'+key+'.json');write(file,json.dumps(body),70003)
            return cli('request','POST',path,'--input',str(file),'--key',key,'--work',work,'--delegation',grant,'--target','native-inputs')
        selected=resource('/workspaces',{'label':'Approved adapter input'},'workspace')['workspace_id']
        data=b"printf 'approved-adapter-result\\n'\n"
        if c['a'].bounded_service:
            from tests.fixtures.bounded_service_fixture import PROGRAM, DB_PROGRAM, FAULT_PROGRAM
            data=FAULT_PROGRAM if c['a'].bounded_service_fault else DB_PROGRAM if c['a'].bounded_service_db else PROGRAM
        if c['a'].encrypted_provider:
            data=b'''set -eu
printf '%s' '{"model":"fixture-adapter","stream":false,"input":"bounded adapter probe","reasoning":{"effort":"low"}}' > /workspace/provider.json
test "$(/usr/local/bin/ouroboros-cli --instance request POST /v1/responses --input /workspace/provider.json --select /model)" = fixture-confirmed-adapter
printf 'approved-adapter-result\\n'
'''
        if c['a'].native_adapter_running_stop:data+=b'sleep 5\n'
        upload=resource('/uploads',{'size':len(data),'sha256':hashlib.sha256(data).hexdigest()},'upload')['upload_id']
        file=root/'cli/adapter.sh';write(file,data.decode(),70003)
        cli('request','PUT','/uploads/'+upload+'/content','--input',str(file),'--work',work,'--delegation',grant,'--target','native-inputs')
        resource('/publications',{'workspace_id':selected,'expected_revision':0,'files':{'adapter.sh':upload}},'publication')
        cfg=json.loads((root/'runtime/config.json').read_text())
        profile=dict(cfg['program'],compute_units=20,lifetime_seconds=20)
        profile.pop('native_codex')
        self.evidence=root/'adapter-runtime'
        self.evidence.mkdir(mode=0o700)
        self.config=root/'runtime/adapter-config.json'
        write(self.config,json.dumps(dict(cfg,profile_id='native-call-adapter',evidence_dir=str(self.evidence),profile=dict(cfg['profile'],lifetime_seconds=20),program=profile)))
        sql(f"INSERT INTO profiles VALUES('{firm}','native-call-adapter',true,20,20); INSERT INTO program_profiles(firm_id,profile_id,profile,active) VALUES('{firm}','native-call-adapter','{json.dumps(profile)}',true)",db)
        execution={'work_id':work,'delegation_id':grant,'agent_delegation_id':child,'profile_id':'native-call-adapter','units':20,'lifetime_seconds':20,'predecessor_execution_id':None,'program':{'argv':['/bin/sh','code/adapter.sh'],'inputs':[{'target':'native-inputs','workspace_id':selected,'revision':1,'file':'adapter.sh','destination':'code/adapter.sh'}]}}
        def execute(admitted,label):
            if c['a'].bounded_worker:
                if self.preparation_worker is None:
                    with (root/'runtime/adapter-worker.log').open('xb') as log:
                        options=['--service','--poll-interval-seconds','1'] if c['a'].persistent_worker else ['--max-executions','2','--idle-timeout-seconds','10']
                        self.preparation_worker=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config),*options],stdout=log,stderr=log,env=c['child_env'])
                value=wait_worker_execution(self.preparation_worker,
                    lambda: cli('get','executions',admitted['resource_id']))
                if label=='source':
                    assert self.preparation_worker.poll() is None
                    peer=subprocess.run([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config),'--max-executions','1','--idle-timeout-seconds','1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=c['child_env'],timeout=3)
                    assert peer.returncode!=0 and b'another Runtime owns' in peer.stderr
                else:
                    if c['a'].persistent_worker:
                        before=sql('SELECT count(*) FROM runtime_instances',db)
                        time.sleep(2.2)
                        assert self.preparation_worker.poll() is None,'service stopped at the fixture execution count or empty queue'
                        assert sql('SELECT count(*) FROM runtime_instances',db)==before,'idle service invented an execution'
                        assert not (self.evidence/'pending-claim.json').exists()
                        assert len(list(self.evidence.glob('claim-resolved-*.json')))==2
                        self.preparation_worker.terminate()
                    self.preparation_worker.wait(timeout=5)
                    assert self.preparation_worker.returncode==0
                    records=[json.loads(line) for line in (root/'runtime/adapter-worker.log').read_text().splitlines()]
                    assert records[-1]=={'worker':'stop_requested' if c['a'].persistent_worker else 'execution_limit_reached','completed_executions':2}
                    before=sql('SELECT count(*) FROM runtime_instances',db)
                    empty=run([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config),'--max-executions','1','--idle-timeout-seconds','1'],timeout=5)
                    assert json.loads(empty)=={'worker':'idle_limit_reached','completed_executions':0}
                    assert sql('SELECT count(*) FROM runtime_instances',db)==before
                    self.worker_checks={'completed_executions':2,'same_process':True,'duplicate_slot_denied':True,'idle_created_instances':0}
                    if c['a'].persistent_worker:
                        # Reopening the same service must inspect historical return records, stay
                        # alive on the empty queue, and stop without a replacement execution.
                        with (root/'runtime/adapter-service-restart.log').open('xb') as log:
                            self.preparation_worker=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config),'--service','--poll-interval-seconds','1'],stdout=log,stderr=log,env=c['child_env'])
                        time.sleep(2.2)
                        assert self.preparation_worker.poll() is None
                        self.preparation_worker.terminate();self.preparation_worker.wait(timeout=5)
                        assert self.preparation_worker.returncode==0
                        assert sql('SELECT count(*) FROM runtime_instances',db)==before
                        self.worker_checks.update(service_mode=True,explicit_stop=True,restart_created_instances=0,original_claims_resolved=2)
            else:
                with (root/'runtime'/('adapter-'+label+'.log')).open('xb') as log:
                    result=subprocess.run([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config)],stdout=log,stderr=log,env=c['child_env'],timeout=30)
                assert result.returncode==0, label
                value=cli('get','executions',admitted['resource_id'])
            assert value['program_observation']['receipt']['exit_code']==0
            assert (self.evidence/value['instance_id']/'program-stdout.bin').read_bytes()==b'approved-adapter-result\n'
            return value
        source=request('/executions',execution,'source')
        execute(source,'source')
        self.submission=request('/adapter-submissions',dict(scope,target='adapter-tools',source_execution_id=source['resource_id']),'submit')
        verification=request('/adapter-submissions/'+self.submission['id']+'/verification-executions',dict(execution,program=None,delegation_id=review_grant,agent_delegation_id=verify_grant),'verify',True)
        execute(verification,'verify')
        review_scope={'work_id':work,'delegation_id':review_grant}
        evaluation=request('/adapter-submissions/'+self.submission['id']+'/evaluations',dict(review_scope,verification_execution_id=verification['resource_id'],conclusion='supported',criteria='Exact bounded script produces expected bytes',rationale='Observed isolated execution and protected output receipt',limitations='Synthetic environment fixture; no provider or economic qualification'),'evaluate',True)
        accepted=request('/adapter-submissions/'+self.submission['id']+'/acceptances',dict(review_scope,evaluation_id=evaluation['id'],max_calls=2 if c['a'].bounded_service else 1,lifetime_seconds=120,rationale='Two bounded service invocations' if c['a'].bounded_service else 'One native invocation of the verified fixture',independence_basis='Separate fixture reviewer; no organizational independence claim'),'accept',True)
        self.active=request('/adapter-submissions/'+self.submission['id']+'/activate',dict(review_scope,acceptance_id=accepted['id'],expected_activation_id=None),'activate',True)
        self.review_request=request
        self.review_scope=review_scope
        if c['a'].bounded_service_db:
            self.service_db_before=json.loads(sql("SELECT json_agg(json_build_object('intent_id',intent_id,'result_id',result_id) ORDER BY intent_id) FROM effect_receipts WHERE input->>'marker'='bounded-service-state'",c['resource_dbs']['company']))
            assert len(self.service_db_before)==2
            self.service_result=sql(f"SELECT reply->'receipt'->>'result_id' FROM resource_calls r JOIN intents i ON i.id=r.intent_id WHERE i.principal_id='{verifier}' AND i.operation='db.write' AND i.request_key='service-state'",db)
            assert self.service_result in [r['result_id'] for r in self.service_db_before]
        self.execution_template=execution
        self.source, self.verification = source, verification
        if c['a'].bounded_service:
            self.service_verify_grant=verify_grant
            self.seed_service('native',range(1))
        return self

    def seed_service(self, label, numbers=range(2)):
        for number in numbers:
            message=self.review_request('/conversations/'+self.service_channels[1]+'/messages',
                {'delegation_id':self.c['grant'],'text':'service-request-'+label+str(number)},
                'question-'+label+str(number))
            self.service_questions.append(message['resource_id'])

    def verify_service(self, first):
        c=self.c
        def history():
            rows=[];cursor=0
            for _ in range(4):
                page=c['cli']('request','GET','/conversations/'+self.service_channels[1]+'/messages?cursor='+str(cursor))
                rows.extend(page['messages'])
                if not page['has_more']:return rows
                cursor=page['cursor']
            raise AssertionError('fixture conversation exceeds bounded page count')
        if self.service_delivery is not None:
            delivery=self.service_delivery.result(timeout=3)
            assert delivery['instance_id']==first['instance_id']
        before=history()
        replies=[m for m in before if m['text'].startswith('service-response')]
        assert len(replies)==4 and len({m['reply_to'] for m in replies})==4
        assert sum(m['origin_instance_id']==first['instance_id'] for m in replies)==2
        self.seed_service('replacement')
        execution=dict(self.execution_template,program=None,delegation_id=self.review_scope['delegation_id'],agent_delegation_id=self.service_verify_grant)
        admitted=self.review_request('/adapter-submissions/'+self.submission['id']+'/invocations',{'activation_id':self.active['id'],'execution':execution},'service-replacement',True)
        with (c['root']/'runtime/service-replacement.log').open('xb') as log:
            self.worker=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config)],stdout=log,stderr=log,env=c['child_env'])
        self.worker.wait(timeout=30)
        assert self.worker.returncode==0
        observed=c['cli']('get','executions',admitted['resource_id'])
        assert observed['terminated'] and observed['compute_return']['units']==20
        assert observed['instance_id']!=first['instance_id']
        assert observed['program_observation']['receipt']['exit_code']==0
        after=history()
        assert after[:len(before)]==before
        replies=[m for m in after if m['text'].startswith('service-response')]
        assert len(replies)==6 and len({m['reply_to'] for m in replies})==6
        assert sum(m['origin_instance_id']==observed['instance_id'] for m in replies)==2
        assert c['sql']('SELECT count(*) FROM adapter_invocations',c['db'])=='2'
        db_recovery=None
        if c['a'].bounded_service_db:
            receipts=json.loads(c['sql']("SELECT json_agg(json_build_object('intent_id',intent_id,'result_id',result_id) ORDER BY intent_id) FROM effect_receipts WHERE input->>'marker'='bounded-service-state'",c['resource_dbs']['company']))
            assert receipts==self.service_db_before
            assert all(m['text']=='service-response-'+self.service_result for m in replies)
            assert c['sql']("SELECT count(*) FROM results WHERE content->>'marker'='bounded-service-state'",c['resource_dbs']['company'])=='2'
            # Both independently admitted service instances reached the successful DB response
            # before answering; the same two original effects/receipts remain authoritative.
            db_recovery={'effect_count':2,'receipt_count':2,'original_receipts_unchanged':True,'new_effects_for_service_invocations':0,'reported_result_matches_original_receipt':True}

        return {'requests_per_instance':2,'retained_replies':6,'distinct_reply_targets':6,'first_instance':first['instance_id'],'replacement_instance':observed['instance_id'],'history_preserved':True,'external_effects':'NOT RUN','database_recovery':db_recovery,'live_request_delivery':delivery}

    def verify_fault_service(self, failed):
        c=self.c;proxy=c['service_fault_proxy']
        assert proxy.consumed() and len(proxy.events)==1
        event=proxy.events[0]
        assert event['fault']=='before-completion' and not event['upstream_sent']
        intent=event['path'].rsplit('/',1)[1]
        marker='service-effect-'+self.service_questions[-1]
        pending=json.loads(c['sql'](f"SELECT json_build_object('state',i.state,'attempt_id',(SELECT a.id FROM attempts a WHERE a.intent_id=i.id),'reply',r.reply) FROM intents i JOIN resource_calls r ON r.intent_id=i.id WHERE i.id='{intent}'",c['db']))
        assert pending['state']=='claimed' and pending['reply'] is None
        receipt=json.loads(c['sql'](f"SELECT json_build_object('result_id',result_id,'input',input) FROM effect_receipts WHERE intent_id='{intent}'",c['resource_dbs']['company']))
        assert receipt['input']['marker']==marker
        before=c['cli']('request','GET','/conversations/'+self.service_channels[1]+'/messages')
        assert not before['has_more']
        assert all(m['reply_to']!=self.service_questions[-1] for m in before['messages'])
        self.seed_service('native',range(1,2))
        execution=dict(self.execution_template,program=None,delegation_id=self.review_scope['delegation_id'],agent_delegation_id=self.service_verify_grant)
        admitted=self.review_request('/adapter-submissions/'+self.submission['id']+'/invocations',{'activation_id':self.active['id'],'execution':execution},'service-fault-replacement',True)
        with (c['root']/'runtime/service-fault-replacement.log').open('xb') as log:
            self.worker=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config)],stdout=log,stderr=log,env=c['child_env'])
        self.worker.wait(timeout=30)
        assert self.worker.returncode==0
        replacement=c['cli']('get','executions',admitted['resource_id'])
        assert replacement['terminated'] and replacement['compute_return']['units']==20
        assert replacement['instance_id']!=failed['instance_id']
        assert replacement['program_observation']['receipt']['exit_code']==0
        after=c['cli']('request','GET','/conversations/'+self.service_channels[1]+'/messages')
        assert not after['has_more'] and after['messages'][:len(before['messages'])]==before['messages']
        recovered=[m for m in after['messages'] if m['reply_to']==self.service_questions[-2]]
        assert len(recovered)==1 and recovered[0]['text']=='service-response-'+receipt['result_id']
        assert recovered[0]['origin_instance_id']==replacement['instance_id']
        completed=json.loads(c['sql'](f"SELECT json_build_object('state',i.state,'attempt_id',(SELECT a.id FROM attempts a WHERE a.intent_id=i.id),'reply',r.reply) FROM intents i JOIN resource_calls r ON r.intent_id=i.id WHERE i.id='{intent}'",c['db']))
        assert completed['state']=='succeeded' and completed['attempt_id']==pending['attempt_id']
        assert completed['reply']['receipt']['result_id']==receipt['result_id']
        assert c['sql'](f"SELECT count(*) FROM effect_receipts WHERE input->>'marker'='{marker}'",c['resource_dbs']['company'])=='1'
        assert c['sql']('SELECT count(*) FROM adapter_invocations',c['db'])=='2'
        assert c['sql']('SELECT count(*) FROM results',c['resource_dbs']['company'])=='7'
        assert c['sql']('SELECT count(*) FROM effect_receipts',c['resource_dbs']['company'])=='7'
        return {'fault':event,'failed_instance':failed['instance_id'],'replacement_instance':replacement['instance_id'],'original_attempt_preserved':True,'effect_count_for_lost_request':1,'reported_result_matches_original_receipt':True,'history_preserved':True}

    def verify_admission_pause(self):
        c=self.c
        revision=int(c['sql']('SELECT revision FROM firms',c['db']))
        request={'delegation_id':c['grant'],'expected_revision':revision,'paused':True,'reason':'Fixture cold-boundary preparation'}
        try:self.review_request('/environment/admission',request,'pause-without-action')
        except subprocess.CalledProcessError as error:assert b'403' in error.stderr
        else:raise AssertionError('ungranted caller paused environment')
        request['delegation_id']=self.review_scope['delegation_id']
        receipt=self.review_request('/environment/admission',request,'environment-pause',True)
        assert receipt['admission_paused'] and not receipt['drain_confirmed'] and not receipt['backup_ready']
        assert c['cli']('request','GET','/conditions')['admission_paused']
        execution=dict(self.execution_template,delegation_id=self.review_scope['delegation_id'],agent_delegation_id=self.service_verify_grant)
        try:self.review_request('/executions',execution,'pause-new-execution',True)
        except subprocess.CalledProcessError as error:assert b'403' in error.stderr
        else:raise AssertionError('paused environment admitted new execution')
        payload=c['root']/'cli/paused-db.json';c['write'](payload,json.dumps({'operation':'record_result','parameters':{'marker':'must-not-run'}}),70003)
        try:c['cli']('request','POST','/db/transactions','--input',str(payload),'--key','paused-db','--work',c['work'],'--delegation',c['grant'])
        except subprocess.CalledProcessError as error:assert b'403' in error.stderr
        else:raise AssertionError('paused environment admitted DB effect')
        intent=c['sql']("SELECT intent_id FROM effect_receipts WHERE input->>'marker'='native-result'",c['resource_dbs']['company'])
        result=c['cli']('request','POST','/resource-intents/'+intent+'/reconcile','--work',c['work'],'--delegation',c['grant'])
        assert result['intent_id']==intent and result['result_id']
        assert c['sql']("SELECT count(*) FROM results WHERE content->>'marker'='must-not-run'",c['resource_dbs']['company'])=='0'
        resume=dict(request,paused=False,expected_revision=receipt['revision'])
        self.review_request('/environment/admission',resume,'environment-resume',True)
        assert self.review_request('/environment/admission',request,'environment-pause',True)==receipt
        assert not c['cli']('request','GET','/conditions')['admission_paused']
        return {'pause':True,'ungranted_denied':True,'new_db_denied':True,'existing_receipt_recovered':True,'resumed':True,'old_replay_did_not_repause':True,'backup_ready':False}

    def start_worker(self):
        c=self.c
        if c['a'].bounded_service_fault:
            c['service_fault_proxy'].arm_db_marker('service-effect-'+self.service_questions[-1])
        elif c['a'].bounded_service:
            def deliver_while_running():
                end=time.monotonic()+15
                while time.monotonic()<end:
                    page=c['cli']('request','GET','/conversations/'+self.service_channels[1]+'/messages')
                    matching=[m for m in page['messages'] if m['reply_to']==self.service_questions[-1]]
                    if matching:
                        instance=matching[0]['origin_instance_id']
                        binding=json.loads(c['sql'](f"SELECT json_build_object('phase',phase,'container_id',binding->>'container_id') FROM runtime_instances WHERE instance_id='{instance}'",c['db']))
                        assert binding['phase']=='released'
                        assert json.loads(c['run'](['docker','inspect',binding['container_id']]))[0]['State']['Running']
                        if c['a'].bounded_service_stop:
                            return self.stop_waiting_service(instance,binding['container_id'])
                        self.seed_service('native',range(1,2))
                        return {'instance_id':instance,'after_first_reply':True,'container_running':True}
                    time.sleep(.05)
                raise AssertionError('service first reply not observed before bounded delivery timeout')
            self.service_pool=concurrent.futures.ThreadPoolExecutor(max_workers=1)
            self.service_delivery=self.service_pool.submit(deliver_while_running)
        with (c['root']/'runtime/adapter-invoke.log').open('xb') as log:
            self.worker=subprocess.Popen([str(c['binary']/'ouroboros-runtime'),'--config',str(self.config)],stdout=log,stderr=log,env=c['child_env'])

    def environment_inventory(self):
        c=self.c
        grant=self.review_scope['delegation_id']
        return json.loads(c['run']([str(c['binary']/'ouroboros-cli'),'--config',str(c['root']/'reviewer/config.json'),'request','GET','/environment/status/'+grant]))

    def stop_waiting_service(self, instance, container):
        c=self.c
        # Freeze only the supervisor to distinguish access revocation from instance death.
        os.kill(self.worker.pid,signal.SIGSTOP)
        try:
            end=time.monotonic()+2
            while time.monotonic()<end:
                if any(line.startswith('State:') and 'T' in line for line in (Path('/proc')/str(self.worker.pid)/'status').read_text().splitlines()):break
                time.sleep(.02)
            else:raise AssertionError('service supervisor did not pause')
            command=c['fixture'].docker('exec',container,'/usr/local/bin/ouroboros-cli','--instance','request','GET','/conditions')
            before=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=c['child_env'],timeout=3)
            assert before.returncode==0 and json.loads(before.stdout)['instance_id']==instance
            if c['a'].admission_pause_running:
                revision=int(c['sql']('SELECT revision FROM firms',c['db']))
                self.pause=self.review_request('/environment/admission',dict(delegation_id=self.review_scope['delegation_id'],expected_revision=revision,paused=True,reason='Fixture pause during active service'),'running-environment-pause',True)
                assert self.pause['admission_paused'] and not self.pause['drain_confirmed'] and not self.pause['backup_ready']
                inventory=self.environment_inventory()
                assert inventory['admission_paused'] and inventory['instances_without_termination']>=1
                assert inventory['source']=='core_records' and not inventory['backup_ready']
                self.running_inventory=inventory
                try:c['cli']('request','GET','/environment/status/'+c['grant'])
                except subprocess.CalledProcessError as error:assert b'403' in error.stderr
                else:raise AssertionError('ordinary caller accessed whole-firm inventory')
            else:
                self.stop=self.review_request('/adapter-submissions/'+self.submission['id']+'/stop',dict(self.review_scope,activation_id=self.active['id']),'service-stop',True)
                assert not self.stop['termination_confirmed']
            after=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=c['child_env'],timeout=3)
            if c['a'].admission_pause_running:
                assert after.returncode==0 and json.loads(after.stdout)['admission_paused']
                execution=dict(self.execution_template,delegation_id=self.review_scope['delegation_id'],agent_delegation_id=self.service_verify_grant)
                try:self.review_request('/executions',execution,'running-pause-new-execution',True)
                except subprocess.CalledProcessError as error:assert b'403' in error.stderr
                else:raise AssertionError('pause admitted new execution while service remained alive')
            else:
                assert after.returncode!=0 and b'403' in after.stderr
            assert json.loads(c['run'](['docker','inspect',container]))[0]['State']['Running']
            stopped_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        finally:os.kill(self.worker.pid,signal.SIGCONT)
        self.worker.wait(timeout=8)
        assert self.worker.returncode!=0
        terminated_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        evidence=self.evidence/instance
        finish=json.loads((evidence/'finish.json').read_text())
        assert finish['terminated_observed'] and not finish['runtime_success'] and not finish['effects_settled']
        deadline=json.loads((evidence/'binding.json').read_text())['deadline_boottime_ns']
        assert terminated_at<deadline
        assert not json.loads(c['run'](['docker','inspect',container]))[0]['State']['Running']
        self.seed_service('after-stop',range(1))
        return {'instance_id':instance,'admission_paused':c['a'].admission_pause_running,'gateway_before':200,'gateway_after':200 if c['a'].admission_pause_running else 403,'stopped_at_boottime_ns':stopped_at,'terminated_at_boottime_ns':terminated_at,'deadline_boottime_ns':deadline}

    def verify_stopped_service(self, observed):
        c=self.c
        stopped=self.service_delivery.result(timeout=10)
        assert observed['instance_id']==stopped['instance_id']
        assert observed['terminated'] and observed['compute_return']['units']==20
        page=c['cli']('request','GET','/conversations/'+self.service_channels[1]+'/messages')
        assert not page['has_more']
        replies=[m for m in page['messages'] if m['text'].startswith('service-response')]
        assert len(replies)==3 and len({m['reply_to'] for m in replies})==3
        assert sum(m['origin_instance_id']==observed['instance_id'] for m in replies)==1
        assert all(m['reply_to']!=self.service_questions[-1] for m in replies)
        execution=dict(self.execution_template,program=None,delegation_id=self.review_scope['delegation_id'],agent_delegation_id=self.service_verify_grant)
        try:self.review_request('/adapter-submissions/'+self.submission['id']+'/invocations',{'activation_id':self.active['id'],'execution':execution},'stopped-service-replacement',True)
        except subprocess.CalledProcessError as error:assert b'403' in error.stderr
        else:raise AssertionError('restricted environment or activation admitted replacement service')
        assert c['sql']('SELECT count(*) FROM adapter_invocations',c['db'])=='1'
        inventory=None
        if c['a'].admission_pause_running:
            inventory=self.environment_inventory()
            assert inventory['admission_paused'] and not inventory['backup_ready']
            assert inventory['instances_without_termination']==0
            assert inventory['unsettled_reservation_records']>0
        return {'stop':stopped,'retained_replies':3,'post_stop_request_unanswered':True,'replacement_denied':True,'inventory_after':inventory,'inventory_running':getattr(self,'running_inventory',None)}

    def stop_pending(self):
        c=self.c
        end=time.monotonic()+12
        while time.monotonic()<end:
            row=c['sql']("SELECT json_build_object('intent_id',i.id,'execution_id',e.id,'origin',i.origin_instance_id) FROM adapter_invocations v JOIN executions e ON e.id=v.execution_id JOIN intents i ON i.id=e.intent_id",c['db'])
            if row:break
            time.sleep(.05)
        else:raise AssertionError('native adapter admission not observed')
        row=json.loads(row)
        def parent_live():
            raw=c['sql'](f"SELECT json_build_object('phase',phase,'container_id',binding->>'container_id') FROM runtime_instances WHERE instance_id='{row['origin']}'",c['db'])
            binding=json.loads(raw)
            detail=json.loads(c['run'](['docker','inspect',binding['container_id']]))[0]
            return binding['phase']=='released' and detail['State']['Running']
        assert parent_live(), 'stop must be tested while caller is live'
        self.stop=self.review_request('/adapter-submissions/'+self.submission['id']+'/stop',dict(self.review_scope,activation_id=self.active['id']),'stop-pending',True)
        assert self.stop['termination_confirmed'] is False
        self.start_worker()
        self.worker.wait(timeout=10)
        assert self.worker.returncode!=0
        assert parent_live(), 'caller exit cannot explain the rejected claim'
        assert c['sql'](f"SELECT count(*) FROM runtime_instances WHERE execution_id='{row['execution_id']}'",c['db'])=='0'
        assert c['sql'](f"SELECT count(*) FROM attempts WHERE intent_id='{row['intent_id']}'",c['db'])=='0'
        assert c['sql'](f"SELECT claimed FROM outbox WHERE intent_id='{row['intent_id']}'",c['db'])=='f'
        assert c['sql'](f"SELECT units FROM reservations WHERE intent_id='{row['intent_id']}' AND NOT settled",c['db'])=='20'
        self.stopped_intent=row['intent_id']

    def stop_running(self):
        c=self.c
        end=time.monotonic()+12
        while time.monotonic()<end:
            raw=c['sql']("SELECT json_build_object('execution_id',r.execution_id,'instance_id',r.instance_id,'binding',r.binding) FROM adapter_invocations v JOIN runtime_instances r ON r.execution_id=v.execution_id WHERE r.phase='released'",c['db'])
            if raw:
                row=json.loads(raw)
                evidence=self.evidence/row['instance_id']
                output=evidence/'program-stdout.bin'
                if output.is_file() and output.read_bytes()==b'approved-adapter-result\n':break
            assert self.worker.poll() is None
            time.sleep(.05)
        else:raise AssertionError('running adapter output not observed')
        cid=row['binding']['container_id']
        def probe(expected):
            command=c['fixture'].docker('exec',cid,'/usr/local/bin/ouroboros-cli','--instance','request','GET','/conditions')
            result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=c['child_env'],timeout=3)
            if expected==200:
                assert result.returncode==0
                assert json.loads(result.stdout)['instance_id']==row['instance_id']
            else:assert result.returncode!=0 and b'403' in result.stderr
            assert json.loads(c['run'](['docker','inspect',cid]))[0]['State']['Running']
        os.kill(self.worker.pid,signal.SIGSTOP)
        try:
            end=time.monotonic()+2
            while time.monotonic()<end:
                status=Path('/proc')/str(self.worker.pid)/'status'
                if any(line.startswith('State:') and 'T' in line for line in status.read_text().splitlines()):break
                time.sleep(.02)
            else:raise AssertionError('adapter Runtime did not pause')
            probe(200)
            self.stop=self.review_request('/adapter-submissions/'+self.submission['id']+'/stop',dict(self.review_scope,activation_id=self.active['id']),'stop-running',True)
            assert self.stop['termination_confirmed'] is False
            probe(403)
            self.stopped_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        finally:os.kill(self.worker.pid,signal.SIGCONT)
        self.worker.wait(timeout=8)
        assert self.worker.returncode!=0
        finish=json.loads((evidence/'finish.json').read_text())
        assert finish['terminated_observed'] and not finish['runtime_success'] and not finish['effects_settled']
        assert b'403 Forbidden' in (c['root']/'runtime/adapter-invoke.log').read_bytes()
        self.terminated_at=time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        deadline=json.loads((evidence/'binding.json').read_text())['deadline_boottime_ns']
        assert self.terminated_at < deadline
        assert not json.loads(c['run'](['docker','inspect',cid]))[0]['State']['Running']
        self.running_stop={'instance_id':row['instance_id'],'gateway_before':200,'gateway_after':403,'stopped_at_boottime_ns':self.stopped_at,'terminated_at_boottime_ns':self.terminated_at,'deadline_boottime_ns':deadline}

    def verify(self, events, parent):
        c=self.c
        self.worker.wait(timeout=30)
        assert c['a'].bounded_service_fault or (self.worker.returncode != 0 if (c['a'].native_adapter_stop or c['a'].native_adapter_running_stop or c['a'].bounded_service_stop) else self.worker.returncode == 0)
        calls=[e['params']['item'] for e in events if e.get('method')=='item/completed' and e.get('params',{}).get('item',{}).get('id')=='fixture_adapter']
        assert len(calls)==1 and calls[0]['status']=='completed' and calls[0].get('error') is None
        assert calls[0]['server']=='managed' and calls[0]['tool']=='invoke_'+self.active['id'].replace('-','')
        result=calls[0]['result']['structuredContent']
        assert result['completion']=='not_confirmed'
        admitted=result['admission']
        observed=c['cli']('get','executions',admitted['resource_id'])
        if c['a'].bounded_service_fault:
            assert observed['terminated'] and observed['compute_return']['units']==20
            assert observed['program_observation']['receipt']['exit_code']!=0
        elif c['a'].bounded_service_stop:
            assert observed['terminated'] and observed['compute_return']['units']==20
        elif c['a'].native_adapter_running_stop:
            assert observed['terminated'] and observed['compute_return']['units']==20
            assert observed['instance_id']==self.running_stop['instance_id']
            assert observed['unstarted_cancellation'] is None
            revision=int(c['sql']('SELECT revision FROM firms',c['db']))
            path=c['root']/'cli/reject-cancel-running.json'
            c['write'](path,json.dumps({'expected_revision':revision}),70003)
            try:c['cli']('request','POST','/executions/'+admitted['resource_id']+'/cancel-unstarted','--input',str(path),'--key','cannot-cancel-started')
            except subprocess.CalledProcessError as error:assert b'409' in error.stderr
            else:raise AssertionError('started execution accepted as unstarted')
            assert c['sql'](f"SELECT count(*) FROM execution_inputs WHERE execution_id='{admitted['resource_id']}' AND retained",c['db'])=='1'
        elif not c['a'].native_adapter_stop:
            assert observed['terminated'] and observed['program_observation']['receipt']['exit_code']==0
            assert observed['instance_id']!=parent['instance_id']
            assert observed['compute_return']['units']==20
            assert observed['program_observation']['work_success_confirmed'] is False
            assert (self.evidence/observed['instance_id']/'program-stdout.bin').read_bytes()==b'approved-adapter-result\n'
        else:
            assert admitted['intent_id']==self.stopped_intent
            assert observed['instance_id'] is None and observed['program_observation'] is None
            assert observed['state']=='accepted'
        row=json.loads(c['sql'](f"SELECT json_build_object('instance_id',origin_instance_id,'generation',origin_generation) FROM intents WHERE id='{admitted['intent_id']}'",c['db']))
        assert row['instance_id']==parent['instance_id'] and row['generation']==parent['generation']
        assert c['sql']('SELECT count(*) FROM adapter_invocations',c['db'])=='1'
        service=self.verify_fault_service(observed) if c['a'].bounded_service_fault else self.verify_stopped_service(observed) if c['a'].bounded_service_stop else self.verify_service(observed) if c['a'].bounded_service else None
        admission_control=self.verify_admission_pause() if c['a'].admission_pause else None
        cancellation=None
        if c['a'].native_adapter_stop:
            revision=int(c['sql']('SELECT revision FROM firms',c['db']))
            path=c['root']/'cli/cancel-unstarted.json'
            c['write'](path,json.dumps({'expected_revision':revision}),70003)
            route='/executions/'+admitted['resource_id']+'/cancel-unstarted'
            cancellation=c['cli']('request','POST',route,'--input',str(path),'--key','cancel-blocked-native')
            assert cancellation['never_dispatched'] and cancellation['released_compute_units']==20
            assert c['cli']('request','POST',route,'--input',str(path),'--key','cancel-blocked-native')==cancellation
            closed=c['cli']('get','executions',admitted['resource_id'])
            assert closed['state']=='restricted' and closed['stopped'] and not closed['terminated']
            assert closed['unstarted_cancellation']==cancellation and closed['compute_return'] is None
            assert c['sql'](f"SELECT committed FROM limits WHERE id='compute'",c['db'])=='0'
            assert c['sql'](f"SELECT count(*) FROM execution_inputs WHERE execution_id='{admitted['resource_id']}' AND retained",c['db'])=='0'
            assert c['sql']('SELECT count(*) FROM adapter_invocations',c['db'])=='1'
        return {'native_admission':admitted,'actual_child':observed,'source':self.source,'verification':self.verification,'activation':self.active['id'],'pending_stop':getattr(self,'stop',None),'unstarted_cancellation':cancellation,'running_stop':getattr(self,'running_stop',None),'bounded_worker':getattr(self,'worker_checks',None),'bounded_service':service,'admission_control':admission_control}

    def close(self):
        if self.service_pool is not None:
            self.service_pool.shutdown(wait=True,cancel_futures=True)
        for worker in [self.worker,self.preparation_worker]:
            if worker and worker.poll() is None:
                worker.terminate()
                try:worker.wait(timeout=3)
                except subprocess.TimeoutExpired:worker.kill();worker.wait()
