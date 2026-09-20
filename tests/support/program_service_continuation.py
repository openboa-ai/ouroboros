"""Actual Linux continuation acceptance, using the existing contained-program fixture.

Qualification uses ordinary service APIs and a separate fixture reviewer. Only the
contained program creates the business effect; the observer never fabricates Runtime
bindings, exit observations, resource receipts, successors or compute returns.
"""
import json
import os
import re
import secrets
import signal
import subprocess


class ProgramServiceContinuation:
    def __init__(self, context, target='continuation-state'):
        self.c = context
        self.target = target
        self.result = None

    def prepare_company(self):
        c = self.c
        root, sql, write = c['root'], c['sql'], c['write']
        folder = root / 'company'
        folder.mkdir(mode=0o700)
        os.chown(folder, 70006, 70006)
        database = 'ouro_continuation_' + secrets.token_hex(6)
        password = secrets.token_hex(24)
        sql(f"CREATE ROLE {database} LOGIN PASSWORD '{password}';")
        c['roles'].append(database)
        sql(f'CREATE DATABASE {database} OWNER {database};')
        c['databases'].append(database)
        self.database = database
        migration = root / 'runtime/company-migrate.url'
        c['credential_file'](migration, c['database_url'](database, password, database))
        c['run']([str(c['binary'] / 'ouroboros-resource-migrate'), '--role', 'company', '--database-url-file', str(migration)])
        role, password = 'ouro_continuation_worker_' + secrets.token_hex(6), secrets.token_hex(24)
        sql(f"CREATE ROLE {role} LOGIN PASSWORD '{password}';")
        c['roles'].append(role)
        sql(f'GRANT CONNECT ON DATABASE {database} TO {role}; GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE ON inputs,results,effect_receipts TO {role};', database)
        c['credential_file'](folder / 'db.url', c['database_url'](role, password, database), 70006)
        config = {'listen': c['fixture'].endpoint('company'), 'tls': c['tls']('company', 'company', 70006),
                  'core_url': c['fixture'].url('core'), 'core_client': c['tls']('company', 'company', 70006),
                  'database_url_file': str(folder / 'db.url'), 'gateway_fingerprint': c['fingerprints']['gateway-service'], 'role': 'company'}
        write(folder / 'config.json', json.dumps(config), 70006)
        sql(f"INSERT INTO resource_targets VALUES('{c['firm']}','{self.target}','{c['fingerprints']['company']}',true,'{{}}',4096);", c['dbs']['core'])
        gateway = json.loads((root / 'gateway/config.json').read_text())
        gateway['workers'][self.target] = c['fixture'].url('company')
        write(root / 'gateway/config.json', json.dumps(gateway), 70002)
        with (folder / 'process.log').open('xb') as log:
            c['processes']['company'] = subprocess.Popen([str(c['binary'] / 'ouroboros-resources'), '--config', str(folder / 'config.json')],
                stdout=log, stderr=log, env=c['environment'], preexec_fn=c['drop'](70006))

    def scope(self):
        c = self.c
        for grant in [c['grant'], c['child']]:
            c['sql'](f"INSERT INTO resource_scopes VALUES('{c['firm']}','{c['work']}','{grant}','{self.target}',ARRAY['inspect','db.write'],NULL);", c['dbs']['core'])

    def program(self, original):
        # The normal source/verification path remains the existing file-publication proof.
        # A scoped Company instance cannot access management /conditions. Its explicit
        # resource request uses the same fixed Bridge address, with no identity headers.
        prefix = r'''set -eu
if ! /usr/local/bin/ouroboros-cli --instance conditions >/dev/null 2>&1; then
  printf '%s' '{"operation":"record_result","parameters":{"marker":"continuation-proof"}}' > /workspace/effect.json
  wget -q -O /workspace/service-receipt.json --header='Content-Type: application/json' --header='x-ouro-resource-target: continuation-state' --header='x-ouro-effect-slot: record' --header='Idempotency-Key: local-transport' --post-file=/workspace/effect.json http://127.0.0.1:18080/db/transactions
  printf '%s\n' "$$" > /workspace/service-pid
  printf 'OUROBOROS_SERVICE_EFFECT_OBSERVED\n'
  exec /bin/sleep 90
fi
'''.encode()
        return prefix + original

    def plan(self):
        return {'name': 'retain_test_state', 'effects': [{'slot': 'record', 'target': self.target,
                'operation': 'db.write', 'max_input_bytes': 1024, 'input_equals': {'operation': 'record_result'}}]}

    def run(self):
        c = self.c
        root, cli, sql, write = (c[k] for k in ['root', 'cli', 'sql', 'write'])
        observation_file = root / 'owner-acceptance.json'
        def publish_progress(stage, **values):
            write(observation_file, json.dumps({'stage': stage, 'work_id': c['work'], **values}, indent=2))
        def request(method, path, body=None, key=None):
            argv = ['request', method, path]
            if key is not None:
                argv += ['--key', key]
            return cli(*argv, body=body, client='reviewer')
        def observe():
            return request('GET', '/service-continuations/' + admitted['intent_id'])
        def effect():
            row = sql(f"SELECT jsonb_build_object('root',s.root_intent_id,'slot',s.effect_slot,'intent',s.child_intent_id,'state',i.state,'reply',r.reply) FROM service_effects s JOIN intents i ON i.id=s.child_intent_id AND i.firm_id=s.firm_id JOIN resource_calls r ON r.intent_id=i.id AND r.firm_id=i.firm_id WHERE s.firm_id='{c['firm']}' AND s.root_intent_id='{admitted['intent_id']}'", c['dbs']['core'])
            return json.loads(row) if row else None
        def released(execution):
            row = sql(f"SELECT to_jsonb(r) FROM runtime_instances r WHERE execution_id='{execution}' AND phase='released'", c['dbs']['core'])
            return json.loads(row) if row else None

        # Export only disposable test owner material, outside every private container.
        # The native app selects its copy through the normal connection picker.
        publish_progress('qualified', owner_profile=str(root / 'cli/config.json'))
        if c['args'].native_owner_stop:
            c['wait_until'](lambda: (root / 'owner-ready').is_file(), 300, 'native owner connection before timed execution')

        invocation = {'activation_id': c['selected']['id'], 'execution': c['verifier_request'],
                      'service': {'operation': 'retain_test_state', 'input': {'purpose': 'disposable acceptance'}}}
        admitted = request('POST', f"/adapter-submissions/{c['candidate']['id']}/invocations", invocation, 'continuation-root')
        config_file = root / 'runtime/config.json'
        config = json.loads(config_file.read_text())
        config['managed_guard'] = {'systemd_run': '/usr/bin/systemd-run', 'systemctl': '/usr/bin/systemctl',
                                  'setpriv': '/usr/bin/setpriv', 'memory_max_bytes': 33554432, 'tasks_max': 4}
        write(config_file, json.dumps(config))
        with (root / 'runtime/continuation-process.log').open('xb') as log:
            c['runtime'] = subprocess.Popen([str(c['binary'] / 'ouroboros-runtime'), '--config', str(config_file), '--service', '--poll-interval-seconds', '1'],
                                            stdout=log, stderr=log, env=c['environment'])
        first = c['wait_until'](lambda: released(admitted['resource_id']), 20, 'first actual service instance')
        original_effect = c['wait_until'](lambda: (value if (value := effect()) and value['state'] == 'succeeded' and value['reply'] else None), 15, 'contained DB write receipt')
        policy = {'execution_id': admitted['resource_id'], 'max_restarts': 1, 'restart_window_seconds': 180, 'backoff_seconds': 1}
        registered = request('POST', '/service-continuations', policy, 'finite-policy')
        assert registered['restarts_used'] == 0 and registered['root_intent_id'] == admitted['intent_id']
        write(root / 'continuation-before.json', json.dumps(observe(), indent=2))
        first_container = first['binding']['container_id']
        pid = c['run'](['docker', 'exec', '--user', '65532:65532', first_container, 'cat', '/workspace/service-pid']).decode().strip()
        assert re.fullmatch(r'[1-9][0-9]*', pid) and int(pid) > 1
        # Kill precisely the contained program, not Runtime or its guard. The controller
        # alone must report the abnormal exit, return capacity and admit its successor.
        c['run'](['docker', 'exec', '--user', '65532:65532', first_container, '/bin/kill', '-KILL', pid])
        def recovered():
            value = observe()
            return value if value['restarts_used'] == 1 and released(value['current_execution_id']) else None
        after = c['wait_until'](recovered, 30, 'finite controller recovery without owner resubmission')
        second = released(after['current_execution_id'])
        assert after['root_intent_id'] == admitted['intent_id'] and second['instance_id'] != first['instance_id']
        assert after['history'][0]['terminated'] and after['history'][0]['compute_returned']
        c['wait_until'](lambda: c['command'](['docker', 'exec', '--user', '65532:65532', second['binding']['container_id'], 'test', '-s', '/workspace/service-receipt.json']).returncode == 0, 10, 'recovered program receives original effect receipt')
        assert effect() == original_effect
        assert sql(f"SELECT count(*) FROM results WHERE firm_id='{c['firm']}' AND content->>'marker'='continuation-proof'", self.database) == '1'
        assert sql(f"SELECT count(*) FROM effect_receipts WHERE firm_id='{c['firm']}'", self.database) == '1'
        write(root / 'continuation-recovered.json', json.dumps(after, indent=2))
        publish_progress('awaiting_owner_stop', root_intent_id=admitted['intent_id'], execution_id=after['current_execution_id'])
        if not c['args'].native_owner_stop:
            request('POST', '/service-continuations/' + admitted['intent_id'] + '/stop', {'expected_execution_id': after['current_execution_id']}, 'fixture-owner-stop')
        final = c['wait_until'](lambda: (value if (value := observe())['state'] == 'stopped' and value['compute_returned'] else None), 75, 'owner stop and actual compute return')
        assert final['restarts_used'] == 1 and len(final['history']) == 2
        assert all(item['terminated'] and item['compute_returned'] for item in final['history'])
        assert effect() == original_effect
        assert sql(f"SELECT committed FROM limits WHERE firm_id='{c['firm']}' AND id='compute'", c['dbs']['core']) == '0'
        disposition = root / 'runtime' / second['instance_id'] / 'worker-disposition.json'
        c['wait_until'](disposition.is_file, 5, 'service remains available after reconciled owner restriction')
        assert json.loads(disposition.read_text()) == {'reason': 'execution_restricted', 'slot_released': True,
                                                     'work_success_confirmed': False, 'effects_settled': False}
        assert c['runtime'].poll() is None, 'one owner stop terminated the shared Runtime service'
        stop = json.loads(sql(f"SELECT jsonb_build_object('request_key',request_key,'issuer_id',issuer_id,'request',request) FROM service_continuation_stops WHERE firm_id='{c['firm']}' AND root_intent_id='{admitted['intent_id']}'", c['dbs']['core']))
        for binding in [first, second]:
            assert not json.loads(c['run'](['docker', 'inspect', binding['binding']['container_id']]))[0]['State']['Running']
            guard = json.loads((root / 'runtime' / binding['instance_id'] / 'guard-binding.json').read_text())
            assert guard['backend'] == 'systemd'
            identity = c['process_identity'](guard['identity']['pid'])
            assert identity is None or identity['start_ticks'] != guard['identity']['start_ticks']
        observed_result = {'result': 'PASS', 'root_intent_id': admitted['intent_id'], 'first': first['instance_id'], 'replacement': second['instance_id'],
                       'original_effect': original_effect, 'stop': stop, 'final': final, 'native_owner_stop': c['args'].native_owner_stop,
                       'qualification': 'real source and separate verifier; no business-quality or organizational independence claim',
                       'model_calls': 0, 'exchange_calls': 0}
        publish_progress('stopped', root_intent_id=admitted['intent_id'])
        if c['args'].native_owner_stop:
            c['wait_until'](lambda: (root / 'owner-observed').is_file(), 120, 'native stopped-state screen capture')
        c['runtime'].send_signal(signal.SIGTERM)
        c['runtime'].wait(timeout=10)
        assert c['runtime'].returncode == 0
        self.result = observed_result
        write(root / 'continuation-result.json', json.dumps(self.result, indent=2))
        return self.result
