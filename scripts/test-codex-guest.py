"""Actual pinned Codex behind an authenticated fixture UDS. No provider/account access."""
import argparse,hashlib,http.server,json,os,select,secrets,socket,socketserver,struct,subprocess,threading,time,uuid
from pathlib import Path
from fixture_config import clean_environment, guard_preexec, load_config, observe_guard
p=argparse.ArgumentParser();p.add_argument('--sandbox-policy',choices=['workspaceWrite','externalSandbox'],default='workspaceWrite');p.add_argument('--mode',choices=['normal','unauthorized','shell'],default='normal');args,fixture=load_config(p)
assert os.geteuid()==0
values=fixture.runtime_values();image=values['image'];bindir=fixture.binary
root=fixture.create_root(mode=0o755);ipc=fixture.create_ipc_root();child_env=clean_environment()
token=secrets.token_hex(24);requests=[];tool_outputs=[];cid=None;bridge=guard=native=None;server=None
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  pid,uid,_=struct.unpack('3i',self.connection.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,12))
  if (pid,uid)!=(bridge.pid,values['bridge_uid']) or self.headers.get('Authorization')!='Bearer '+token:
   self.send_error(403);return
  n=int(self.headers.get('Content-Length','0'))
  if n<=0 or n>2_000_000 or len(requests)>=4:self.send_error(429);return
  body=json.loads(self.rfile.read(n));requests.append({'path':self.path,'model':body.get('model'),'stream':body.get('stream'),'tool_names':[x.get('name',x.get('type')) for x in body.get('tools',[])]})
  if args.mode=='unauthorized':self.send_error(401);return
  if len(requests)>1:
   tool_outputs.extend(x.get('output','') for x in body.get('input',[]) if isinstance(x,dict) and x.get('type')=='function_call_output')
  item={'id':'msg_fixture','type':'message','role':'assistant','content':[{'type':'output_text','text':'controlled fixture completed','annotations':[]}]}
  if args.mode=='shell' and len(requests)==1:
   item={'id':'fc_fixture','type':'function_call','call_id':'fixture_call_1','name':'exec_command','arguments':json.dumps({'cmd':'cat /workspace/input.txt','max_output_tokens':64})}
  response={'id':'resp_fixture','object':'response','created_at':int(time.time()),'model':body.get('model'),'status':'completed','output':[item],'usage':{'input_tokens':1,'output_tokens':3,'total_tokens':4}}
  events=[{'type':'response.created','response':{**response,'status':'in_progress','output':[]}}, {'type':'response.output_item.added','output_index':0,'item':{**item,'content':[]}}, {'type':'response.output_text.delta','item_id':'msg_fixture','output_index':0,'content_index':0,'delta':'controlled fixture completed'}, {'type':'response.output_item.done','output_index':0,'item':item}, {'type':'response.completed','response':response}]
  if item['type']=='function_call':events=[events[0],{'type':'response.output_item.added','output_index':0,'item':item},{'type':'response.output_item.done','output_index':0,'item':item},events[-1]]
  data=''.join('event: '+e['type']+'\ndata: '+json.dumps(e)+'\n\n' for e in events).encode()
  self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
def run(*a):
 if a[0]=='docker':a=fixture.docker(*a[1:])
 return subprocess.run(a,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15,env=child_env).stdout.decode().strip()
def read_line(proc,seconds=8):
 if not select.select([proc.stdout],[],[],seconds)[0]:raise TimeoutError('child readiness or protocol timeout')
 return proc.stdout.readline().decode().strip()
def send(method,params=None,id=None):
 msg={'method':method};
 if params is not None:msg['params']=params
 if id is not None:msg['id']=id
 native.stdin.write((json.dumps(msg)+'\n').encode());native.stdin.flush()
def response(id):
 until=time.monotonic()+15
 while time.monotonic()<until:
  msg=json.loads(read_line(native))
  if msg.get('id')==id:
   if 'error' in msg:raise RuntimeError('native error: '+json.dumps(msg['error']))
   return msg['result']
 raise TimeoutError('native response timeout')
try:
 cid=run('docker','create','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','512m','--cpus','1','--pids-limit','64','--tmpfs','/home/agent:rw,nosuid,nodev,size=67108864,uid=20000,gid=20000','--tmpfs','/tmp:rw,nosuid,nodev,size=67108864','--tmpfs','/workspace:rw,nosuid,nodev,size=67108864,uid=20000,gid=20000',image)
 run('docker','start',cid);pid=json.loads(run('docker','inspect',cid))[0]['State']['Pid']
 cgroup=Path('/sys/fs/cgroup')/Path(Path(f'/proc/{pid}/cgroup').read_text().split('0::',1)[1].strip()).relative_to('/')
 fd=os.open(cgroup/'cgroup.kill',os.O_WRONLY);deadline=time.clock_gettime_ns(time.CLOCK_BOOTTIME)+60_000_000_000
 guard=subprocess.Popen([str(bindir/'ouroboros-guard'),str(fd),str(deadline)],pass_fds=(fd,),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=guard_preexec(values['guard_uid']),env={});os.close(fd)
 assert read_line(guard).startswith('armed ')
 guard_observation=observe_guard(guard.pid,values['guard_uid'],fd,cgroup)
 (root/'guard-observation.json').write_text(json.dumps(guard_observation,indent=2)+'\n')
 guard.stdin.close()
 uds=ipc/'model.sock';server=socketserver.UnixStreamServer(str(uds),Handler);os.chmod(uds,0o666)
 netfd=os.open(f'/proc/{pid}/ns/net',os.O_RDONLY)
 bridge=subprocess.Popen([str(bindir/'ouroboros-bridge'),str(netfd),str(ipc),str(uds),'0',str(values['bridge_uid']),str(values['bridge_uid']),str(fixture.ports['bridge'])],pass_fds=(netfd,),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=child_env);os.close(netfd)
 assert read_line(bridge)=='bridge_ready'
 threading.Thread(target=server.serve_forever,daemon=True).start()
 run('docker','exec',cid,'sh','-c','printf fixture-input-42 > /workspace/input.txt')
 cmd=fixture.docker('exec','-i','-e','OURO_GATEWAY_TOKEN='+token,cid,'/usr/local/bin/codex')
 configs={'model':'fixture-model','model_provider':'ouro_fixture','model_providers.ouro_fixture.name':'Ouroboros controlled fixture','model_providers.ouro_fixture.base_url':f'http://127.0.0.1:{fixture.ports["bridge"]}/v1','model_providers.ouro_fixture.env_key':'OURO_GATEWAY_TOKEN','model_providers.ouro_fixture.wire_api':'responses','model_providers.ouro_fixture.requires_openai_auth':False,'model_providers.ouro_fixture.request_max_retries':0,'model_providers.ouro_fixture.stream_max_retries':0,'check_for_update_on_startup':False}
 for key,value in configs.items():cmd+=['-c',key+'='+json.dumps(value)]
 cmd+=['app-server','--listen','stdio://']
 native=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(root/'native.stderr').open('wb'),bufsize=0,env=child_env)
 send('initialize',{'clientInfo':{'name':'ouroboros_fixture','version':'0.1.0'}},1);initial=response(1);send('initialized')
 send('thread/start',{'cwd':'/workspace','approvalPolicy':'never','sandbox':'workspace-write','model':'fixture-model'},2);thread=response(2)['thread']['id']
 send('turn/start',{'threadId':thread,'sandboxPolicy':({'type':'externalSandbox','networkAccess':'enabled'} if args.sandbox_policy=='externalSandbox' else {'type':'workspaceWrite','writableRoots':['/workspace'],'networkAccess':False}),'input':[{'type':'text','text':'Reply with the controlled fixture acknowledgement.'}]},3);response(3)
 complete=False;until=time.monotonic()+20
 while time.monotonic()<until:
  msg=json.loads(read_line(native))
  if msg.get('method')=='turn/completed':
   expected='failed' if args.mode=='unauthorized' else 'completed'
   assert msg['params']['turn']['status']==expected,msg['params']['turn'];complete=True;break
 assert complete and len(requests)==(2 if args.mode=='shell' else 1),requests
 if args.mode=='shell':assert 'fixture-input-42' in json.dumps(tool_outputs),tool_outputs
 assert not run('docker','exec',cid,'sh','-c','find /home/agent -name auth.json -print')
 print(json.dumps({'result':'PASS','fixture_id':fixture.identity,'mode':args.mode,'sandbox_policy':args.sandbox_policy,'codex_version':'0.153.4','requests':requests,'native_lifecycle':'initialize/thread/start/turn/start/turn.completed','isolation':'none network + bound bridge + armed guard','guard':guard_observation,'subscription':'NOT RUN','native_shell':'PASS' if args.mode=='shell' else 'NOT RUN','steer_resume':'NOT RUN'}))
finally:
 if native and native.poll() is None:native.terminate();native.wait(timeout=3)
 if bridge and bridge.poll() is None:bridge.terminate();bridge.wait(timeout=3)
 if server:server.shutdown();server.server_close()
 if cid:subprocess.run(fixture.docker('rm','-f',cid),env=child_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 if guard and guard.poll() is None:guard.terminate();guard.wait(timeout=3)
