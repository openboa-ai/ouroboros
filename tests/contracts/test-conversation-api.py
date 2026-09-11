"""Bounded real Core/Gateway/mTLS CLI conversation test; no Runtime or external provider."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
import subprocess
import time
from tests.support.fixture_config import clean_environment, load_config

args,fixture=load_config(argparse.ArgumentParser())
root=fixture.existing_root()
fixture.claim_test('conversation-api')
meta=json.loads((root/'fixture.json').read_text())
firm,grant=meta['firm_id'],meta['delegation_id']
fixture.sql(f"UPDATE delegations SET actions=actions||ARRAY['conversation.create','conversation.send','conversation.read'] WHERE firm_id='{firm}' AND id='{grant}'",fixture.metadata()['database'])
config=json.loads((root/'core.json').read_text());config.pop('wake_poll_interval_ms',None)
(root/'core.json').write_text(json.dumps(config))
processes=[]
def start(name,label):
    with (root/(label+'.log')).open('xb') as log:
        process=subprocess.Popen([str(fixture.binary/('ouroboros-'+name)),'--config',str(root/(name+'.json'))],stdout=log,stderr=log,env=clean_environment())
    processes.append(process)
    return process

def cli(*arguments):
    result=subprocess.run([str(fixture.binary/'ouroboros-cli'),'--config',str(root/'cli.json'),*arguments],capture_output=True,env=clean_environment(),timeout=5)
    assert result.returncode==0,result.stderr.decode()
    return json.loads(result.stdout)

def post(path,value,key):
    file=root/(key+'.json');file.write_text(json.dumps(value))
    return cli('request','POST',path,'--input',str(file),'--key',key)

def stop(process):
    if process.poll() is None:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)

try:
    core=start('core','core-initial');start('gateway','gateway-initial')
    for _ in range(40):
        try:cli('conditions');break
        except AssertionError:time.sleep(.1)
    else:raise AssertionError('services unavailable')
    import uuid
    agent=str(uuid.uuid4())
    fixture.sql(f"INSERT INTO principals VALUES('{firm}','{agent}','agent',true)",fixture.metadata()['database'])
    work=post('/work',{'purpose':'direct conversation fixture','delegation_id':grant},'conversation-work')['resource_id']
    conversation=post('/conversations',{'work_id':work,'delegation_id':grant,'responsible_agent_id':agent},'conversation-create')['resource_id']
    path='/conversations/'+conversation+'/messages'
    message={'delegation_id':grant,'text':'What is the current work status?','reply_to':None}
    text_file=root/'message.txt';text_file.write_text(message['text'])
    def send():
        return cli('conversations','send',conversation,'--delegation',grant,'--text-file',str(text_file),'--key','message-one')
    listed=cli('conversations','list',work)
    assert any(item['id']==conversation for item in listed['items'])
    accepted=send()
    assert accepted['state']=='succeeded'
    assert send()['replayed']
    page=cli('conversations','read',conversation,'--cursor','0')
    assert len(page['messages'])==1 and page['messages'][0]['text']==message['text']
    assert page['messages'][0]['author_principal_id']==meta['principal_id']
    assert page['messages'][0]['author_kind']=='human' and page['messages'][0]['origin_instance_id'] is None
    assert page['cursor']==1
    assert cli('conversations','read',conversation,'--cursor','1')['messages']==[]
    assert cli('conditions')['limits'][0]['committed']==0
    stop(core);core=start('core','core-restarted')
    for _ in range(40):
        try:after=cli('conversations','read',conversation,'--cursor','0');break
        except AssertionError:time.sleep(.1)
    else:raise AssertionError('Core did not restart')
    assert after==page
    result={'result':'PASS','checks':['actual mTLS CLI creates a work-bound conversation','named conversation list/read/send commands use live Gateway','stable-key message replay stores one message','authenticated human attribution','cursor reads and Core restart preserve content','message storage does not reserve compute'],'native_delivery':'NOT RUN','runtime':'NOT RUN','subscription':'NOT RUN'}
    (root/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

finally:
    for process in reversed(processes):stop(process)
