"""Bounded real Core/Gateway/mTLS CLI timer test; no Runtime or external provider."""

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
fixture.claim_test('wake-api')
meta=json.loads((root/'fixture.json').read_text())
firm,grant=meta['firm_id'],meta['delegation_id']
fixture.sql(f"UPDATE delegations SET actions=actions||ARRAY['wake.register','wake.cancel'] WHERE firm_id='{firm}' AND id='{grant}'",fixture.metadata()['database'])
config=json.loads((root/'core.json').read_text());config['wake_poll_interval_ms']=100
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
    work=post('/work',{'purpose':'one-shot timer fixture','delegation_id':grant},'wake-work')['resource_id']
    request={'due_at_seconds':int(time.time())+3,'expires_at_seconds':int(time.time())+90,
        'execution':{'work_id':work,'delegation_id':grant,'profile_id':'fixture-no-payload','units':70,'lifetime_seconds':30,'predecessor_execution_id':None}}
    registered=post('/wakes',request,'scheduled')
    assert registered['state']=='succeeded'
    path='/wakes/'+registered['resource_id']
    assert cli('request','GET',path)['execution_intent_id'] is None
    for _ in range(80):
        observed=cli('request','GET',path)
        if observed['execution_intent_id']:break
        time.sleep(.1)
    else:raise AssertionError('enabled timer did not deliver')
    intent=observed['execution_intent_id']
    assert cli('get','intents',intent)['state']=='accepted'
    assert cli('conditions')['limits'][0]['committed']==70
    stop(core);core=start('core','core-restarted')
    for _ in range(40):
        try:after=cli('request','GET',path);break
        except AssertionError:time.sleep(.1)
    else:raise AssertionError('Core did not restart')
    assert after['execution_intent_id']==intent
    assert cli('conditions')['limits'][0]['committed']==70
    post(path+'/cancel',{'delegation_id':grant},'cancel-scheduled')
    assert cli('request','GET',path)['cancelled']
    assert post('/wakes',request,'scheduled')['replayed']
    assert cli('request','GET',path)['cancelled']
    result={'result':'PASS','checks':['real mTLS CLI registration and observation','enabled timer delivers after due time','Core restart preserves one execution intent and reservation','cancellation and replay cannot reactivate'],'runtime':'NOT RUN','subscription':'NOT RUN'}
    (root/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
finally:
    for process in reversed(processes):stop(process)
