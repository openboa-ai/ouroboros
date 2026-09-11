"""Loopback-only synthetic HTTPS provider for the Rust receipt suite. No account access."""
import http.server
import json
import os
from pathlib import Path
import ssl
import subprocess
import sys
import time
import threading

root = Path(sys.argv[1])
assert root.is_absolute() and root.is_dir() and not root.is_symlink()
os.umask(0o077)
subprocess.run([
    'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', str(root/'key.pem'), '-out', str(root/'cert.pem'),
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1',
    '-addext', 'basicConstraints=critical,CA:FALSE',
    '-addext', 'extendedKeyUsage=serverAuth',
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
count = 0
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_POST(self):
        global count
        count += 1
        size = int(self.headers.get('content-length', '0'))
        assert 0 < size <= 1048576
        value = json.loads(self.rfile.read(size))
        mode = value.get('fixture_mode', 'ok')
        authorized = self.headers.get('authorization') == 'Bearer synthetic-bearer'
        observed=root/f'observed-{threading.get_ident()}.json'
        observed.write_text(json.dumps({'count':count,'authorized':authorized,'path':self.path,'mode':mode}))
        observed.replace(root/'observed.json')
        code = 200
        body = b'{"model":"fixture-confirmed","output":[],"usage":{"input_tokens":1,"output_tokens":2}}'
        if mode=='http-stream':
            body=('data: '+json.dumps({'type':'response.created','response':{'id':'early'}})+'\n\n'+'data: '+json.dumps({'type':'response.completed','response':{'id':'early','model':'fixture-confirmed','usage':{'input_tokens':1,'output_tokens':2}}})+'\n\n').encode()
        if not authorized: code = 401
        elif mode == 'reflect': body = b'{"output":"synthetic-bearer"}'
        elif mode == 'error': code, body = 500, b'synthetic-bearer'
        elif mode == 'oversize': body = b'x' * 70000
        elif mode == 'redirect': code = 307
        self.send_response(code)
        self.send_header('content-type', 'text/event-stream' if mode=='http-stream' else 'application/json')
        self.send_header('content-length',str(len(body)))
        if code == 307: self.send_header('location', '/responses')
        self.end_headers()
        if mode == "stall": time.sleep(3)
        try:
            if mode in ['stream','stream-blocked','http-stream']:
                split=body.index(b'\n\n')+34 if mode=='http-stream' else 40
                self.wfile.write(body[:split]);self.wfile.flush()
                deadline=time.monotonic()+3
                while not (root/'stream-release').exists() and time.monotonic()<deadline: time.sleep(.01)
                self.wfile.write(body[split:])
            else: self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1',0), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(root/'cert.pem', root/'key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)
(root/'ready.json').write_text(json.dumps({'endpoint':f'https://127.0.0.1:{server.server_port}/responses'}))
server.serve_forever()
