"""Finite loopback native Responses fixture. Synthetic authority only, never real accounts."""

import http.server
import json
from pathlib import Path
import ssl
import sys
import time

root = Path(sys.argv[1])
config = json.loads((root/'server.json').read_text())
count = 0
first_response_delay_elapsed = 0.0
first_response_delay = config.get('first_response_delay_seconds', 0)
assert first_response_delay in (0, 6)
def find_tool(value,name,prefix=False):
    choices=[]
    def matches(candidate):return candidate.startswith(name) if prefix else candidate==name
    for tool in value['tools']:
        if tool.get('type')=='namespace' and tool.get('name')=='mcp__managed':
            choices += [('mcp__managed',child['name']) for child in tool['tools'] if matches(child.get('name',''))]
        elif tool.get('name','').startswith('mcp__managed__') and matches(tool['name'].removeprefix('mcp__managed__')):
            choices.append((None,tool['name']))
    assert len(choices)==1
    return choices[0]

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        global count, first_response_delay_elapsed
        size = int(self.headers.get('content-length', '0'))
        if not 0 < size <= 1048576 or self.path != '/responses' or count >= config.get('max_calls',3):
            self.send_error(400); return
        if self.headers.get('authorization') != 'Bearer synthetic-native-only':
            self.send_error(401); return
        value = json.loads(self.rfile.read(size))
        adapter = config.get('adapter',False) and value.get('model')=='fixture-adapter' and value.get('stream') is False
        assert adapter or (value['model']=='fixture-model' and value['stream'] is True)
        count += 1
        if count == 1 and first_response_delay:
            started = time.monotonic()
            time.sleep(first_response_delay)
            first_response_delay_elapsed = time.monotonic() - started
        if adapter:
            body=json.dumps({'id':f'adapter_{count}','model':'fixture-confirmed-adapter','output':[],'usage':{'input_tokens':1,'output_tokens':1,'total_tokens':2}}).encode()
            (root/'observed.json').write_text(json.dumps({'count':count,'first_response_delay_elapsed':first_response_delay_elapsed,'authorized':True,'requested_model':value['model'],'requested_effort':value.get('reasoning',{}).get('effort')}))
            self.send_response(200);self.send_header('content-type','application/json');self.send_header('content-length',str(len(body)));self.end_headers();self.wfile.write(body)
            return

        done = {item.get('call_id') for item in value['input'] if item.get('type')=='function_call_output'}
        if 'fixture_work' in done:
            item={'id':'message_fixture','type':'message','role':'assistant','content':[{'type':'output_text','text':'Connected fixture workflow completed.','annotations':[]}]}
        elif 'fixture_mcp' in done and 'fixture_managed' not in done and config.get('adapter',False):
            namespace,name=find_tool(value,'execution_self')
            item={'id':'fc_managed','type':'function_call','call_id':'fixture_managed','namespace':namespace,'name':name,'arguments':'{}'}
        elif 'fixture_managed' in done and 'fixture_adapter' not in done and config.get('adapter',False):
            namespace,name=find_tool(value,'invoke_',prefix=True)
            child=next(line.removeprefix('# ouroboros-adapter-child ') for line in config['command'].splitlines() if line.startswith('# ouroboros-adapter-child '))
            item={'id':'fc_adapter','type':'function_call','call_id':'fixture_adapter','namespace':namespace,'name':name,'arguments':json.dumps({'request_key':'native-adapter-call','agent_delegation_id':child})}
        elif 'fixture_mcp' in done:
            item={'id':'fc_work','type':'function_call','call_id':'fixture_work','name':'exec_command','arguments':json.dumps({'cmd':config['command'],'max_output_tokens':1000,'yield_time_ms':10000})}
        else:
            choices=[]
            for tool in value['tools']:
                if tool.get('type')=='namespace' and tool.get('name')=='mcp__fixture':
                    choices += [('mcp__fixture','fixture_echo') for child in tool['tools'] if child.get('name')=='fixture_echo']
                elif tool.get('name') in ['fixture_echo','mcp__fixture__fixture_echo']:
                    choices.append((None,tool['name']))
            assert choices
            namespace,name=choices[0]
            item={'id':'fc_mcp','type':'function_call','call_id':'fixture_mcp','namespace':namespace,'name':name,'arguments':json.dumps({'marker':'ouroboros-native-mcp'})}
        response={'id':f'response_fixture_{count}','object':'response','model':'fixture-confirmed-native','status':'completed','output':[item],'usage':{'input_tokens':1,'output_tokens':1,'total_tokens':2}}
        events=[{'type':'response.created','response':{'id':response['id'],'status':'in_progress','output':[]}}, {'type':'response.output_item.added','output_index':0,'item':item}, {'type':'response.output_item.done','output_index':0,'item':item}, {'type':'response.completed','response':response}]
        body=''.join('event: '+e['type']+'\ndata: '+json.dumps(e)+'\n\n' for e in events).encode()
        (root/'observed.json').write_text(json.dumps({'count':count,'first_response_delay_elapsed':first_response_delay_elapsed,'authorized':True,'requested_model':value['model'],'requested_effort':value.get('reasoning',{}).get('effort')}))
        self.send_response(200);self.send_header('content-type','text/event-stream');self.send_header('content-length',str(len(body)));self.end_headers();self.wfile.write(body)
server=http.server.HTTPServer(('127.0.0.1',config['port']),Handler)
context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.minimum_version=ssl.TLSVersion.TLSv1_2
context.load_cert_chain(root/'upstream.pem',root/'upstream.key')
server.socket=context.wrap_socket(server.socket,server_side=True)
(root/'ready').write_text('ready')
server.serve_forever()
