"""Finite synthetic local HTTPS load; no model/provider requests or credential logging."""

import concurrent.futures,json,math,ssl,threading,time,urllib.request
from pathlib import Path

def measure(fixture,processes,grant):
    root=fixture.root
    cfg=json.loads((root/'reviewer/config.json').read_text())
    ctx=ssl.create_default_context(cafile=cfg['tls']['ca'])
    ctx.load_cert_chain(cfg['tls']['certificate'],cfg['tls']['private_key'])
    # Only the explicitly selected loopback fixture endpoint is used.
    endpoint=fixture.url('gateway')
    lock=threading.Lock();ready=threading.Barrier(5,timeout=5)
    active=0;peak=0;timings=[];started=threading.Event()
    def request(method,path,body=None,key=None):
        headers={}
        if body is not None:headers['content-type']='application/json'
        if key is not None:headers['idempotency-key']=key
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ctx))
        with opener.open(urllib.request.Request(endpoint+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method),timeout=3) as response:
            assert response.status==200
            content=response.read(1048577);assert len(content)<=1048576
            return json.loads(content)
    current=request('GET','/conditions')
    assert grant in current['delegations']
    def worker():
        nonlocal active,peak
        ready.wait()
        for _ in range(32):
            with lock:active+=1;peak=max(peak,active)
            started.set();begin=time.perf_counter()
            try:
                value=request('GET','/conditions')
                assert value['admission_paused']
            finally:
                elapsed=time.perf_counter()-begin
                with lock:active-=1;timings.append(elapsed)
    begin=time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(worker) for _ in range(4)]
        ready.wait();assert started.wait(timeout=3)
        with lock:overlap=active
        assert overlap>0
        control_start=time.perf_counter()
        receipt=request('POST','/environment/admission',{'delegation_id':grant,'expected_revision':current['revision'],'paused':True,'reason':'Fixture control under bounded read load'},'bounded-load-control')
        control_seconds=time.perf_counter()-control_start
        assert receipt['admission_paused'] and not receipt['backup_ready']
        for future in futures:future.result(timeout=30)
    elapsed=time.perf_counter()-begin
    assert len(timings)==128 and peak>=2
    values=sorted(timings)
    def percentile(p):return values[math.ceil(len(values)*p)-1]*1000
    memory=[]
    for role,process in zip(['core','company','catalog','fixture','gateway'],processes):
        assert process.poll() is None
        fields={line.split(':',1)[0]:line.split(':',1)[1].strip() for line in (Path('/proc')/str(process.pid)/'status').read_text().splitlines() if ':' in line}
        memory.append({'role':role,'pid':process.pid,'rss_kib':int(fields['VmRSS'].split()[0]),'high_water_kib':int(fields['VmHWM'].split()[0])})
    result={'result':'PASS','requests':128,'concurrency':4,'peak_active_clients':peak,'p50_ms':percentile(.5),'p95_ms':percentile(.95),'p99_ms':percentile(.99),'elapsed_seconds':elapsed,'requests_per_second':128/elapsed,'control_ms':control_seconds*1000,'active_clients_at_control':overlap,'memory':memory,'includes_tls_and_client_overhead':True,'provider_calls':0,'stream_backpressure':'NOT RUN','production_slo':'NOT SET'}
    (root/'bounded-load-result.json').write_text(json.dumps(result,indent=2)+'\n')
    return result
