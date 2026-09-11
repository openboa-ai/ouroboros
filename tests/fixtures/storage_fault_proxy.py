"""Bounded, disposable mTLS transport faults for the storage API fixture only.

This is not a product endpoint. It accepts one exact fixture certificate, forwards
only the fixed Core claim/live/completion/receipt and collection-step routes, never retries,
and retains no payloads.
"""

import hashlib
import http.client
import http.server
import ipaddress
import json
import re
import socket
import ssl
import threading
import time
import urllib.parse


class StorageFaultProxy:
    MAX_BODY = 2 * 1024 * 1024
    REQUEST_SECONDS = 5
    LIFETIME_SECONDS = 600
    ROUTE = re.compile(
        r"/resource/(?:(?:claims|live|completions|receipt-recovery|company-recovery)/[0-9a-f-]{36}"
        r"|collections/[0-9a-f-]{36}/steps/[0-9a-f-]{36}/(?:claim|dispatch|observe))\Z")

    def __init__(self, host, upstream, ca, certificate, private_key, fingerprint):
        if not ipaddress.ip_address(host).is_loopback:
            raise ValueError("fault proxy requires a numeric loopback address")
        target = urllib.parse.urlsplit(upstream)
        if (target.scheme != "https" or target.hostname != host or not target.port
                or target.path or target.query or target.fragment or target.username):
            raise ValueError("fault proxy requires the fixed local Core HTTPS origin")
        self.target = target
        self.fingerprint = fingerprint
        self.deadline = time.monotonic() + self.LIFETIME_SECONDS
        self.events = []
        self.observations = []
        self.lock = threading.Lock()
        self.fault = None
        self.claim_marker = None
        self.slots = threading.BoundedSemaphore(4)
        self.upstream_tls = ssl.create_default_context(cafile=str(ca))
        self.upstream_tls.load_cert_chain(str(certificate), str(private_key))
        incoming_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        incoming_tls.minimum_version = ssl.TLSVersion.TLSv1_2
        incoming_tls.load_cert_chain(str(certificate), str(private_key))
        incoming_tls.load_verify_locations(cafile=str(ca))
        incoming_tls.verify_mode = ssl.CERT_REQUIRED
        owner = self

        class Server(http.server.ThreadingHTTPServer):
            address_family = socket.AF_INET6 if ":" in host else socket.AF_INET
            daemon_threads = False
            block_on_close = True

            def get_request(self):
                connection, address = self.socket.accept()
                connection.settimeout(owner.REQUEST_SECONDS)
                try:
                    secured = incoming_tls.wrap_socket(connection, server_side=True)
                    if hashlib.sha256(secured.getpeercert(binary_form=True)).hexdigest() != owner.fingerprint:
                        secured.close()
                        raise OSError("fixture client certificate does not match")
                    return secured, address
                except BaseException:
                    connection.close()
                    raise

            def handle_error(self, request, client_address):
                # No payload, credentials, or source paths in fixture diagnostics.
                with owner.lock:
                    owner.events.append({"result": "connection-error"})

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *args):
                pass

            def do_POST(self):
                self.close_connection = True
                if not owner.slots.acquire(blocking=False):
                    self.send_error(503)
                    return
                connection = None
                try:
                    if time.monotonic() >= owner.deadline or not owner.ROUTE.fullmatch(self.path):
                        with owner.lock:
                            owner.observations.append({'path':self.path,'proxy_status':403,'reason':'route_or_deadline'})
                        self.send_error(403)
                        return
                    length = self.headers.get("Content-Length", "")
                    if (not length.isdecimal() or int(length) > owner.MAX_BODY
                            or self.headers.get("Transfer-Encoding") is not None):
                        with owner.lock:
                            owner.observations.append({'path':self.path,'proxy_status':413,'reason':'body_framing'})
                        self.send_error(413)
                        return
                    payload = self.rfile.read(int(length))
                    if len(payload) != int(length):
                        return
                    with owner.lock:
                        mode = None
                        if owner.fault and (owner.fault[0] == self.path or (
                                owner.fault[0] is None and self.path.startswith("/resource/completions/"))):
                            _, mode = owner.fault
                            owner.fault = None
                    if mode == "before-completion":
                        with owner.lock:
                            owner.events.append({"path": self.path, "fault": mode, "upstream_sent": False})
                        return
                    connection = http.client.HTTPSConnection(
                        owner.target.hostname, owner.target.port,
                        context=owner.upstream_tls, timeout=owner.REQUEST_SECONDS)
                    connection.request("POST", self.path, body=payload, headers={
                        "content-type": "application/json", "connection": "close"})
                    response = connection.getresponse()
                    body = response.read(owner.MAX_BODY + 1)
                    with owner.lock:
                        if len(owner.observations)<256:
                            owner.observations.append({'path':self.path,'upstream_status':response.status})
                    if len(body) > owner.MAX_BODY:
                        raise ValueError("Core response exceeds fixture bound")
                    if self.path.startswith("/resource/claims/") and response.status == 200:
                        ticket = json.loads(body)
                        with owner.lock:
                            if (owner.claim_marker is not None and ticket.get('operation') == 'db.write'
                                    and ticket.get('input',{}).get('parameters',{}).get('marker') == owner.claim_marker):
                                owner.fault = ('/resource/completions/'+ticket['intent_id'], 'before-completion')
                                owner.claim_marker = None
                    if mode in {"after-completion", "after-claim"}:
                        with owner.lock:
                            owner.events.append({"path": self.path, "fault": mode,
                                                 "upstream_sent": True, "upstream_status": response.status})
                        return
                    self.send_response(response.status)
                    self.send_header("content-type", response.getheader("content-type", "application/json"))
                    self.send_header("content-length", str(len(body)))
                    self.send_header("connection", "close")
                    self.end_headers()
                    self.wfile.write(body)
                finally:
                    if connection is not None:
                        connection.close()
                    owner.slots.release()

        self.server = Server((host, 0), Handler)
        port = self.server.server_address[1]
        self.url = f"https://{'[' + host + ']' if ':' in host else host}:{port}"
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": .05})
        self.thread.start()

    def arm(self, intent_id, mode):
        if mode not in {"before-completion", "after-completion", "after-claim"}:
            raise ValueError("unknown one-shot fixture fault")
        route = "claims" if mode == "after-claim" else "completions"
        path = f"/resource/{route}/{intent_id}" if intent_id is not None else None
        if mode == "after-claim" and intent_id is None:
            raise ValueError("claim response fault requires an exact intent")
        if path is not None and not self.ROUTE.fullmatch(path):
            raise ValueError("invalid fixture intent")
        with self.lock:
            if self.fault is not None:
                raise RuntimeError("previous fixture fault was not consumed")
            self.fault = (path, mode)

    def arm_db_marker(self, marker):
        # Fixture-only exact synthetic input selector: arm before returning its claim ticket.
        if not isinstance(marker,str) or not re.fullmatch(r'service-effect-[0-9a-f-]{36}',marker):
            raise ValueError('expected one synthetic service message marker')
        with self.lock:
            if self.fault is not None or self.claim_marker is not None:
                raise RuntimeError('previous fixture fault was not consumed')
            self.claim_marker=marker

    def consumed(self):
        with self.lock:
            return self.fault is None and self.claim_marker is None

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=self.REQUEST_SECONDS + 1)
        if self.thread.is_alive():
            raise RuntimeError("fixture proxy survived shutdown")
