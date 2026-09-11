"""Root-only qualification driver in the dedicated guest; no product payload or provider call."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse,json,os,select,socket,struct,subprocess,threading,time,uuid
from pathlib import Path
from tests.support.fixture_config import clean_environment, guard_preexec, load_config, observe_guard
p=argparse.ArgumentParser();args,fixture=load_config(p)
assert os.geteuid()==0
values=fixture.runtime_values();image=values['image'];bindir=fixture.binary;run_id=uuid.uuid4().hex[:10]
if values['bridge_uid']+1 == values['guard_uid']:
 raise ValueError('the two-instance fixture requires guard and both bridge UIDs to differ')
root=fixture.create_root(mode=0o755);ipc=fixture.create_ipc_root();child_env=clean_environment()
containers=[];bridges=[];guards=[];listeners=[];observed=[];guard_observations=[]
def run(*a,**kw):
 if a[0]=='docker':a=fixture.docker(*a[1:])
 return subprocess.run(a,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=20,**{'env':child_env,**kw}).stdout.decode().strip()
def line(proc):
 assert select.select([proc.stdout],[],[],5)[0],'readiness timeout'
 return proc.stdout.readline().decode().strip()
try:
 for index in range(2):
  name='ouro-test-'+run_id+'-'+str(index)
  cid=run('docker','create','--name',name,'--network','none','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--memory','64m','--cpus','0.5','--pids-limit','16',image,'sleep','90')
  containers.append(cid);run('docker','start',cid)
  detail=json.loads(run('docker','inspect',cid))[0];pid=detail['State']['Pid'];assert pid>0
  assert detail['HostConfig']['NetworkMode']=='none'
  assert not detail['Mounts'] and detail['HostConfig']['ReadonlyRootfs']
  cgroup=Path('/sys/fs/cgroup')/Path(Path(f'/proc/{pid}/cgroup').read_text().split('0::',1)[1].strip()).relative_to('/')
  fd=os.open(cgroup/'cgroup.kill',os.O_WRONLY)
  deadline=time.clock_gettime_ns(time.CLOCK_BOOTTIME)+18_000_000_000
  guard=subprocess.Popen([str(bindir/'ouroboros-guard'),str(fd),str(deadline)],pass_fds=(fd,),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=guard_preexec(values['guard_uid']),env={})
  guards.append((guard,cgroup,deadline));os.close(fd);assert line(guard)==f'armed {deadline}'
  guard_observations.append(observe_guard(guard.pid,values['guard_uid'],fd,cgroup))
  (root/'guard-observations.json').write_text(json.dumps(guard_observations,indent=2)+'\n')
  guard.stdin.close()
  # No useful payload has run: only immutable BusyBox sleep is present when the guard arms.
  path=ipc/(str(index)+'.sock');listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);listener.bind(str(path));os.chmod(path,0o666);listener.listen();listeners.append(listener)
  uid=values['bridge_uid']+index;netfd=os.open(f'/proc/{pid}/ns/net',os.O_RDONLY)
  bridge=subprocess.Popen([str(bindir/'ouroboros-bridge'),str(netfd),str(ipc),str(path),'0',str(uid),str(uid),str(fixture.ports['bridge'])],pass_fds=(netfd,),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=child_env)
  os.close(netfd);bridges.append(bridge);assert line(bridge)=='bridge_ready'
  # Actual netns is shared; mount and PID namespace identities must differ.
  assert os.stat(f'/proc/{bridge.pid}/ns/net').st_ino==os.stat(f'/proc/{pid}/ns/net').st_ino
  for ns in ['mnt','pid']:
   assert os.stat(f'/proc/{bridge.pid}/ns/{ns}').st_ino!=os.stat(f'/proc/{pid}/ns/{ns}').st_ino
  def serve(listener=listener,expected_pid=bridge.pid,expected_uid=uid,index=index):
   # The bridge first probes the pinned upstream and closes without an HTTP request.
   for _ in range(3):
    conn,_=listener.accept()
    with conn:
     peer_pid,peer_uid,_=struct.unpack('3i',conn.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))
     assert (peer_pid,peer_uid)==(expected_pid,expected_uid)
     data=conn.recv(4096)
     if not data:continue
     assert data.startswith(b'GET /')
     observed.append({'instance':index,'pid':peer_pid,'uid':peer_uid})
     body=f'instance-{index}'.encode();conn.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: '+str(len(body)).encode()+b'\r\nConnection: close\r\n\r\n'+body)
     return
   raise AssertionError('no HTTP request followed the bounded bridge probe')
  thread=threading.Thread(target=serve,daemon=True);thread.start()
  assert run('docker','exec',cid,'wget','-qO-',f'http://127.0.0.1:{fixture.ports["bridge"]}/conditions')==f'instance-{index}'
  thread.join(2);assert not thread.is_alive()
  for cmd in [('wget','-T','1','-qO-','http://169.254.169.254/'),('wget','-T','1','-qO-','http://1.1.1.1/'),('test','-e','/var/run/docker.sock')]:
   result=subprocess.run(fixture.docker('exec',cid,*cmd),env=child_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3);assert result.returncode!=0
 assert len(observed)==2 and observed[0]['uid']!=observed[1]['uid']
 for guard,cgroup,deadline in guards:
  guard.wait(timeout=22);assert guard.returncode==0,guard.stderr.read().decode()
  assert b'kill_written' in guard.stdout.read()
  # Confirm independently rather than equating write success with process disappearance.
  for _ in range(30):
   if not cgroup.exists() or 'populated 0' in (cgroup/'cgroup.events').read_text():break
   time.sleep(.1)
  else:raise AssertionError('cgroup still populated')
  assert time.clock_gettime_ns(time.CLOCK_BOOTTIME)>=deadline
 for cid in containers:assert not json.loads(run('docker','inspect',cid))[0]['State']['Running']
 print(json.dumps({'result':'PASS','fixture_id':fixture.identity,'image':image,'instances':observed,'guards':guard_observations,'checks':['netns only','distinct kernel peer identity','fixed UDS','network and metadata denied','no Docker socket','guard configured UID and fixed descriptor observed','guard survives stdin EOF','deadline kill independently observed'],'not_run':['supervisor SIGKILL','native Codex','memory pressure','host sleep','production Runtime integration']}))
finally:
 for bridge in bridges:
  bridge.terminate()
  try:bridge.wait(timeout=3)
  except subprocess.TimeoutExpired:bridge.kill();bridge.wait()
 for cid in containers:subprocess.run(fixture.docker('rm','-f',cid),env=child_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for guard,_,_ in guards:
  # The test owner removes only its own already-contained guard after reconciliation.
  if guard.poll() is None:guard.terminate();guard.wait(timeout=3)
 for listener in listeners:listener.close()
