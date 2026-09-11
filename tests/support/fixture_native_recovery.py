"""Read-only native continuation probe after cold restart; synthetic model responses only."""

import hashlib,json,os,subprocess,re

def prepare(fixture,databases):
    root=fixture.root;db=databases['core']
    request=json.loads((root/'cli/start.json').read_text())
    original=fixture.sql("SELECT resource_id FROM intents WHERE operation='execution.start' AND request_key='native-start'",db)
    assert original
    previous=json.loads(fixture.sql("SELECT row_to_json(e) FROM executions e WHERE id='"+original+"'",db))
    turn=json.loads(fixture.sql("SELECT row_to_json(n) FROM native_turns n WHERE execution_id='"+original+"'",db))
    evidence=root/'runtime'/previous['instance_id']
    checkpoint=(evidence/'native-checkpoint.jsonl').read_bytes()
    capture=json.loads((evidence/'native-checkpoint.json').read_text())
    assert capture['bytes']==len(checkpoint) and capture['sha256']==hashlib.sha256(checkpoint).hexdigest()
    result=json.loads(fixture.sql("SELECT json_build_object('intent_id',intent_id,'result_id',result_id) FROM effect_receipts WHERE input->>'marker'='native-result'",databases['company']))
    cfg_path=root/'fixture/config.json';cfg=json.loads(cfg_path.read_text())
    (root/'fixture/pre-cold-recovery-config.json').write_text(json.dumps(cfg))
    cfg['fixture_command']=f'''set -eu
c() {{ /usr/local/bin/ouroboros-cli --instance request "$@"; }}
test "$(cat /workspace/task/input.txt)" = 'managed-native-input'
test "$(c GET /resource-intents/{result['intent_id']} --select /reply/receipt/result_id)" = '{result['result_id']}'
c GET /conditions
printf '\\nOUROBOROS_COLD_RECORDS_RECOVERED\\n'
'''
    cfg_path.write_text(json.dumps(cfg))
    request['predecessor_execution_id']=original
    request['program']['native']['prompt']='Observe the existing authorized company result from this new instance. Do not repeat the earlier write.'
    request_path=root/'cli/cold-native-start.json';request_path.write_text(json.dumps(request));os.chown(request_path,70003,70003);request_path.chmod(0o600)
    return {'request':request_path,'previous':previous,'turn':turn,'checkpoint':checkpoint,'result':result,'rows':fixture.sql('SELECT count(*) FROM results',databases['company'])}

def run(fixture,databases,context,grant,drop,env):
    root=fixture.root;binary=fixture.binary
    def cli(*args,review=False,check=True):
        cfg=root/('reviewer' if review else 'cli')/'config.json'
        result=subprocess.run([str(binary/'ouroboros-cli'),'--config',str(cfg),*args],preexec_fn=None if review else drop(70003),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=8)
        if check and result.returncode!=0:
            (root/'cold-native-errors.json').write_text(json.dumps({'operation':args[:2],'status_codes':re.findall(r'\b[45][0-9]{2}\b',result.stderr.decode(errors='replace'))}))
            raise AssertionError('cold native CLI request failed; retained fixture state')
        return json.loads(result.stdout) if result.returncode==0 else result
    denied=cli('start','--input',str(context['request']),'--key','cold-native-while-paused',check=False)
    assert denied.returncode!=0 and b'403' in denied.stderr
    current=cli('request','GET','/environment/status/'+grant,review=True)
    transition=root/'reviewer/cold-native-resume.json';transition.write_text(json.dumps({'delegation_id':grant,'expected_revision':current['revision'],'paused':False,'reason':'Fixture explicit new native instance after cold restart'}))
    cli('request','POST','/environment/admission','--input',str(transition),'--key','cold-native-resume',review=True)
    runtime=None;accepted=None;state=None
    try:
        request=json.loads(context['request'].read_text())
        source=request['program']['inputs'][0]
        scope=['--work',request['work_id'],'--delegation',request['delegation_id'],'--target',source['target']]
        def body(name,value):
            path=root/'cli'/name;path.write_bytes(value if isinstance(value,bytes) else json.dumps(value).encode())
            os.chown(path,70003,70003);path.chmod(0o600);return str(path)
        data=context['checkpoint'];sha=hashlib.sha256(data).hexdigest()
        upload=cli('request','POST','/uploads','--input',body('cold-checkpoint-upload.json',{'sha256':sha,'size':len(data)}),'--key','cold-checkpoint-upload',*scope)
        stored=cli('request','PUT','/uploads/'+upload['upload_id']+'/content','--input',body('cold-checkpoint.jsonl',data),*scope)
        assert stored['sha256']==sha
        publication=cli('request','POST','/publications','--input',body('cold-checkpoint-publication.json',{'workspace_id':source['workspace_id'],'expected_revision':source['revision'],'files':{'session.jsonl':upload['upload_id']}}),'--key','cold-checkpoint-publication',*scope)
        request['program']['inputs'].append({'target':source['target'],'workspace_id':source['workspace_id'],'revision':publication['revision'],'file':'session.jsonl','destination':'state/session.jsonl'})
        request['program']['native']['resume']={'thread_id':context['turn']['thread_id'],'checkpoint_destination':'state/session.jsonl'}
        body(context['request'].name,request)
        accepted=cli('start','--input',str(context['request']),'--key','cold-native-recovery')
        with (root/'runtime/cold-native.log').open('xb') as log:
            runtime=subprocess.Popen([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json')],stdout=log,stderr=log,env=env)
        assert runtime.wait(timeout=70)==0
        state=cli('get','executions',accepted['resource_id'])
        assert state['terminated'] and state['instance_id']!=context['previous']['instance_id']
        assert state['generation']!=context['previous']['generation']
        events=[json.loads(line) for line in (root/'runtime'/state['instance_id']/'native.jsonl').read_text().splitlines()]
        restored=json.loads((root/'runtime'/state['instance_id']/'native-restore.json').read_text())
        assert restored['thread_id']==context['turn']['thread_id'] and restored['instance_id']==state['instance_id']
        resumed=[e['result']['thread'] for e in events if isinstance(e.get('result'),dict) and 'thread' in e['result']]
        assert len(resumed)==1 and resumed[0]['id']==context['turn']['thread_id']
        assert any(t['id']==context['turn']['turn_id'] for t in resumed[0]['turns'])
        completed=[e['params']['item'] for e in events if e.get('method')=='item/completed' and e.get('params',{}).get('item',{}).get('type')=='commandExecution']
        assert any(e.get('id')=='fixture_work' and e.get('exitCode')==0 for e in completed)
        assert fixture.sql('SELECT count(*) FROM results',databases['company'])==context['rows']
        result={'result':'PASS','new_instance':state['instance_id'],'new_generation':state['generation'],'predecessor':context['previous']['id'],'original_result_id':context['result']['result_id'],'company_rows_unchanged':True,'paused_start_denied':True,'actual_native':True,'subscription':'NOT RUN','checkpoint_resume':'PASS'}
        (root/'cold-native-result.json').write_text(json.dumps(result,indent=2)+'\n')
    finally:
        if runtime is not None and runtime.poll() is None:runtime.kill();runtime.wait(timeout=5)
        if state is None and accepted is not None:state=cli('get','executions',accepted['resource_id'])
        if state is not None and state.get('instance_id'):
            record=root/'runtime'/state['instance_id']/'container.json'
            if record.exists():subprocess.run(fixture.docker('rm','-f',json.loads(record.read_text())['container_id']),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=env,timeout=10,check=True)
        current=cli('request','GET','/environment/status/'+grant,review=True)
        transition.write_text(json.dumps({'delegation_id':grant,'expected_revision':current['revision'],'paused':True,'reason':'Fixture preserve paused state after native recovery'}))
        cli('request','POST','/environment/admission','--input',str(transition),'--key','cold-native-pause',review=True)
