"""One real contained Company host, two requests and a deliberately lost HTTP reply.

Only the contained program writes Company results. Observation never creates runtime
bindings, resource receipts or compute returns. All inputs and credentials are disposable.
"""
import hashlib
import http.client
import http.server
import json
import signal
import socket
import ssl
import subprocess
import threading
import time
from urllib.parse import urlsplit

from tests.support.program_service_continuation import ProgramServiceContinuation


def lose_admission_response(config, path, body, key):
    """Forward exactly one admission, then close before any caller-facing response bytes."""
    config = json.loads(config.read_text())
    target = urlsplit(config['gateway_url'])
    tls = config['tls']
    context = ssl.create_default_context(cafile=tls['ca'])
    context.load_cert_chain(tls['certificate'], tls['private_key'])
    audit = {'upstream_calls': 0, 'forwarded_response_bytes': 0}

    class Fault(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_POST(self):
            if self.path != path or self.headers.get('Idempotency-Key') != key:
                self.send_error(403)
                return
            payload = self.rfile.read(int(self.headers['Content-Length']))
            if payload != body:
                self.send_error(400)
                return
            connection = http.client.HTTPSConnection(target.hostname, target.port,
                                                     context=context, timeout=10)
            try:
                audit['upstream_calls'] += 1
                connection.request('POST', path, payload,
                                   {'Content-Type': 'application/json', 'Idempotency-Key': key})
                response = connection.getresponse()
                retained = response.read(65537)
                assert response.status == 202 and len(retained) <= 65536
                audit['upstream_status'] = response.status
                audit['upstream_response_sha256'] = hashlib.sha256(retained).hexdigest()
                # The caller cannot consume this admission. Recovery must look up its key.
                self.connection.shutdown(socket.SHUT_RDWR)
                self.close_connection = True
            except Exception as error:
                audit['error_type'] = type(error).__name__
            finally:
                connection.close()

    server = http.server.HTTPServer(('127.0.0.1', 0), Fault)
    server.timeout = 15
    thread = threading.Thread(target=server.handle_request, daemon=True)
    thread.start()
    caller = http.client.HTTPConnection(*server.server_address, timeout=15)
    try:
        caller.request('POST', path, body,
                       {'Content-Type': 'application/json', 'Idempotency-Key': key})
        try:
            caller.getresponse()
            raise AssertionError('fault unexpectedly delivered an HTTP response')
        except http.client.RemoteDisconnected:
            audit['caller_observation'] = 'connection_closed_without_response'
    finally:
        caller.close()
        thread.join(timeout=16)
        server.server_close()
    assert not thread.is_alive() and 'error_type' not in audit, audit
    assert audit['upstream_calls'] == 1 and audit['upstream_status'] == 202, audit
    return audit


class ProgramServiceHost(ProgramServiceContinuation):
    def __init__(self, context):
        super().__init__(context, target='host-state')

    def plan(self):
        return {'name': 'retain_test_state',
                'host': {'max_requests': 3, 'max_input_bytes': 1024, 'max_result_bytes': 1024},
                'effects': [{'slot': 'record', 'target': self.target, 'operation': 'db.write',
                             'max_input_bytes': 1024, 'input_equals': {'operation': 'record_result'}}]}

    def program(self, original):
        return r'''set -eu
if ! /usr/local/bin/ouroboros-cli --instance conditions >/dev/null 2>&1; then
  while :; do
    wget -q -O /workspace/claim.json --header='Content-Type: application/json' --post-data='{}' http://127.0.0.1:18080/service-hosts/self/claim
    if grep -q '"request":null' /workspace/claim.json; then sleep 1; continue; fi
    request=$(sed -n 's/.*"intent_id":"\([a-f0-9-]*\)".*/\1/p' /workspace/claim.json)
    marker=$(sed -n 's/.*"marker":"\(host-one\|host-two\)".*/\1/p' /workspace/claim.json)
    test -n "$request" && test -n "$marker"
    printf '{"operation":"record_result","parameters":{"marker":"%s"}}' "$marker" > /workspace/effect.json
    wget -q -O /workspace/effect-receipt.json --header='Content-Type: application/json' --header='x-ouro-resource-target: host-state' --header='x-ouro-effect-slot: record' --header="x-ouro-service-request: $request" --header='Idempotency-Key: local-transport' --post-file=/workspace/effect.json http://127.0.0.1:18080/db/transactions
    printf '{"request_intent_id":"%s","marker":"%s"}' "$request" "$marker" > /workspace/reply.json
    wget -q -O /workspace/reply-receipt.json --header='Content-Type: application/json' --post-file=/workspace/reply.json "http://127.0.0.1:18080/service-hosts/self/requests/$request/reply"
    printf 'OUROBOROS_HOST_REQUEST_REPLIED %s\n' "$request"
  done
fi
'''.encode() + original

    def run(self):
        c = self.c
        root, cli, sql, write = (c[k] for k in ['root', 'cli', 'sql', 'write'])

        def progress(stage, **values):
            write(root / 'owner-acceptance.json', json.dumps({'stage': stage, 'work_id': c['work'], **values}, indent=2))

        def request(method, path, body=None, key=None, expected=200):
            argv = ['request', method, path]
            if key is not None:
                argv += ['--key', key]
            return cli(*argv, body=body, client='reviewer', expected=expected)

        progress('qualified', owner_profile=str(root / 'cli/config.json'))
        if c['args'].native_owner_stop:
            c['wait_until'](lambda: (root / 'owner-ready').is_file(), 300, 'native owner connected, then window closed')

        invocation = {'activation_id': c['selected']['id'], 'execution': c['verifier_request'],
                      'service': {'operation': 'retain_test_state', 'input': {'purpose': 'disposable host acceptance'}}}
        admitted = request('POST', f"/adapter-submissions/{c['candidate']['id']}/invocations",
                           invocation, 'host-launch', expected=202)
        execution = admitted['resource_id']
        config_file = root / 'runtime/config.json'
        config = json.loads(config_file.read_text())
        config['managed_guard'] = {'systemd_run': '/usr/bin/systemd-run', 'systemctl': '/usr/bin/systemctl',
                                  'setpriv': '/usr/bin/setpriv', 'memory_max_bytes': 33554432, 'tasks_max': 4}
        write(config_file, json.dumps(config))
        with (root / 'runtime/host-process.log').open('xb') as log:
            c['runtime'] = subprocess.Popen([str(c['binary'] / 'ouroboros-runtime'), '--config', str(config_file),
                                            '--service', '--poll-interval-seconds', '1'],
                                           stdout=log, stderr=log, env=c['environment'])

        def released():
            row = sql(f"SELECT to_jsonb(r) FROM runtime_instances r WHERE execution_id='{execution}' AND phase='released'", c['dbs']['core'])
            return json.loads(row) if row else None

        instance = c['wait_until'](released, 20, 'actual host instance released')
        route = f'/service-hosts/{execution}/requests'
        receipts = []
        database_receipts = []
        for ordinal, marker in enumerate(('host-one', 'host-two'), 1):
            body = {'work_id': c['work'], 'delegation_id': c['reviewer_grant'],
                    'invocation': {'operation': 'retain_test_state', 'input': {'marker': marker}}}
            key = f'host-request-{ordinal}'
            if ordinal == 1:
                admitted_request = request('POST', route, body, key, expected=202)
            else:
                fault = lose_admission_response(root / 'reviewer/config.json', route, json.dumps(body).encode(), key)
                write(root / 'host-response-loss.json', json.dumps(fault, indent=2))
                lookup = request('GET', f'/intents/by-request-key?operation=service.request&request_key={key}')
                assert lookup['resubmitted'] is False
                admitted_request = lookup['intent']
            identity = admitted_request['intent_id']

            def result():
                view = request('GET', '/service-requests/' + identity)
                return view if view['result'] is not None else None

            view = c['wait_until'](result, 20, f'contained request {ordinal} reply and receipt')
            assert view['result'] == {'request_intent_id': identity, 'marker': marker}
            assert view['assignment'] == {'instance_id': instance['instance_id'], 'generation': instance['generation']}
            assert view['execution_id'] == execution and view['resubmitted'] is False
            assert len(view['effects']) == 1 and view['effects'][0]['receipt_available'] is True
            assert view['effects'][0]['state'] == 'succeeded'
            assert request('GET', '/service-requests/' + identity) == view
            effect_id = view['effects'][0]['intent_id']
            db_receipt = json.loads(sql(f"SELECT jsonb_build_object('intent_id',e.intent_id,'result_id',e.result_id,'input',e.input,'content',r.content) FROM effect_receipts e JOIN results r ON (r.firm_id,r.id)=(e.firm_id,e.result_id) WHERE e.firm_id='{c['firm']}' AND e.intent_id='{effect_id}'", self.database))
            core_receipt = json.loads(sql(f"SELECT reply->'receipt' FROM resource_calls WHERE firm_id='{c['firm']}' AND intent_id='{effect_id}'", c['dbs']['core']))
            assert db_receipt['input'] == db_receipt['content'] == {'marker': marker}
            assert core_receipt['effect_receipt'] == effect_id
            assert core_receipt['result_id'] == db_receipt['result_id']
            database_receipts.append(db_receipt)
            receipts.append(view)
        assert receipts[0]['request_intent_id'] != receipts[1]['request_intent_id']
        assert receipts[0]['effects'][0]['intent_id'] != receipts[1]['effects'][0]['intent_id']
        assert sql(f"SELECT count(*) FROM results WHERE firm_id='{c['firm']}' AND content->>'marker' IN ('host-one','host-two')", self.database) == '2'
        assert sql(f"SELECT count(*) FROM effect_receipts WHERE firm_id='{c['firm']}'", self.database) == '2'
        assert sql(f"SELECT count(*) FROM service_host_requests WHERE execution_id='{execution}'", c['dbs']['core']) == '2'
        assert sql(f"SELECT count(*) FROM runtime_instances WHERE execution_id='{execution}'", c['dbs']['core']) == '1'
        assert sql('SELECT count(*) FROM adapter_invocations', c['dbs']['core']) == '1'
        write(root / 'host-requests.json', json.dumps(receipts, indent=2))
        progress('awaiting_owner_stop', execution_id=execution, request_ids=[r['request_intent_id'] for r in receipts])
        if not c['args'].native_owner_stop:
            revision = request('GET', '/conditions')['revision']
            request('POST', f'/executions/{execution}/stop', {'expected_revision': revision}, 'fixture-host-stop', expected=202)

        def stopped():
            view = request('GET', '/executions/' + execution)
            return view if view.get('compute_return') else None

        final = c['wait_until'](stopped, 120, 'owner restriction, actual termination and compute return')
        assert final['stopped'] is True and final['terminated'] is True
        closed_boottime_ns = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        assert closed_boottime_ns < instance['binding']['deadline_boottime_ns']
        stop = json.loads(sql(f"SELECT jsonb_build_object('intent_id',id,'principal_id',principal_id,'request_key',request_key,'input',input) FROM intents WHERE firm_id='{c['firm']}' AND operation='execution.stop' AND input->>'id'='{execution}'", c['dbs']['core']))
        assert stop['principal_id'] == c['human' if c['args'].native_owner_stop else 'reviewer']
        assert stop['input']['id'] == execution
        request('POST', route, body, 'after-stop-with-spare-quota', expected=403)
        assert sql(f"SELECT count(*) FROM service_host_requests WHERE execution_id='{execution}'", c['dbs']['core']) == '2'
        for view in receipts:
            assert request('GET', '/service-requests/' + view['request_intent_id']) == view
        for before in database_receipts:
            after = json.loads(sql(f"SELECT jsonb_build_object('intent_id',e.intent_id,'result_id',e.result_id,'input',e.input,'content',r.content) FROM effect_receipts e JOIN results r ON (r.firm_id,r.id)=(e.firm_id,e.result_id) WHERE e.firm_id='{c['firm']}' AND e.intent_id='{before['intent_id']}'", self.database))
            assert after == before
        assert sql(f"SELECT committed FROM limits WHERE firm_id='{c['firm']}' AND id='compute'", c['dbs']['core']) == '0'
        assert sql(f"SELECT count(*) FROM compute_returns WHERE execution_id='{execution}'", c['dbs']['core']) == '1'
        assert not json.loads(c['run'](['docker', 'inspect', instance['binding']['container_id']]))[0]['State']['Running']
        guard = json.loads((root / 'runtime' / instance['instance_id'] / 'guard-binding.json').read_text())
        assert guard['backend'] == 'systemd'
        observed = c['process_identity'](guard['identity']['pid'])
        assert observed is None or observed['start_ticks'] != guard['identity']['start_ticks']
        disposition = root / 'runtime' / instance['instance_id'] / 'worker-disposition.json'
        c['wait_until'](disposition.is_file, 5, 'host slot released with separate effects disposition')
        assert json.loads(disposition.read_text()) == {'reason': 'execution_restricted', 'slot_released': True,
                                                     'work_success_confirmed': False, 'effects_settled': False}
        assert c['runtime'].poll() is None
        self.result = {'result': 'PASS', 'execution_id': execution, 'instance_id': instance['instance_id'],
                       'generation': instance['generation'], 'requests': receipts, 'response_loss': fault,
                       'final': final, 'stop': stop, 'closed_boottime_ns': closed_boottime_ns,
                       'database_receipts': database_receipts, 'request_count': 2, 'effect_count': 2, 'compute_return_count': 1,
                       'stop_with_spare_quota': True, 'native_owner_stop': c['args'].native_owner_stop,
                       'model_calls': 0, 'exchange_calls': 0,
                       'qualification': 'real source and separate verifier; synthetic business inputs only'}
        write(root / 'host-result.json', json.dumps(self.result, indent=2))
        progress('stopped', execution_id=execution)
        if c['args'].native_owner_stop:
            c['wait_until'](lambda: (root / 'owner-observed').is_file(), 120, 'native stopped-state screen capture')
        c['runtime'].send_signal(signal.SIGTERM)
        c['runtime'].wait(timeout=10)
        assert c['runtime'].returncode == 0
        return self.result
