#!/usr/bin/env python3
"""One opt-in real-model CLI demonstration; never part of the synthetic test catalog.

Prepare an explicit disposable native environment first. --preflight makes no model
request. Execution requires a fresh bounded allowance and a credential on nonterminal
stdin. No login, ambient credential discovery, refresh, retry, or account provisioning.
"""
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import ctypes
import hashlib
import json
import os
import re
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import sys
import time
import uuid

from tests.support.fixture_config import FixtureConfig, guard_preexec
from tests.support.fixture_release import install
from tests.support.native_build_input import hash_build_binary
from tests.support.native_suite_environment import child_environment, load_environment, preflight
from tests.support.volatile_credentials import VolatileCredential

SAMPLE = """동네 도서관 운영 메모
1. 지난달 방문자는 120명, 이번 달 방문자는 150명이다.
2. 수요일 운영 시간을 오후 6시에서 오후 8시로 늘렸다. 퇴근 후 이용 요청에 따른 변경이다.
3. 다음 달에는 토요일 독서 모임을 두 번 열 예정이다.
"""
FIRST = "task/input.txt를 읽고 핵심 내용을 한국어로 정확히 세 항목으로 요약해줘."
FOLLOWUP = "앞선 요약의 두 번째 항목을 두 문장으로 더 자세하게 설명해줘. 파일에 없는 사실은 추가하지 마."


def identifier(value):
    if not value or len(value) > 96 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in value):
        raise argparse.ArgumentTypeError('use a short alphanumeric identifier')
    return value


def model_identifier(value):
    if not value or len(value) > 128 or any(not c.isascii() or not (c.isalnum() or c in '._:-') for c in value):
        raise argparse.ArgumentTypeError('invalid native model identifier')
    return value


def ports(names):
    sockets = [socket.socket() for _ in names]
    try:
        for sock in sockets:
            sock.bind(('127.0.0.1', 0))
        return dict(zip(names, (sock.getsockname()[1] for sock in sockets)))
    finally:
        for sock in sockets:
            sock.close()


def private(path, content, uid=0, mode=0o600):
    data = content.encode() if isinstance(content, str) else content
    # Create with restrictive permissions before any bytes exist, regardless of umask.
    with open(path, 'xb', opener=lambda name, flags: os.open(name, flags, 0o600)) as output:
        os.fchmod(output.fileno(), mode)
        os.fchown(output.fileno(), uid, uid)
        output.write(data)


def postgres_identity(env):
    def drop():
        os.setgroups([])
        os.setgid(env['postgres_gid'])
        os.setuid(env['postgres_uid'])
        if ctypes.CDLL(None, use_errno=True).prctl(38, 1, 0, 0, 0) != 0:
            raise OSError('cannot prohibit PostgreSQL privilege gain')
    return drop


def codex_tools_preflight(env):
    """Inspect the pinned tool package before accepting any actual account credential."""
    docker = ['docker', '--host', 'unix://' + str(env['docker_socket'])]
    child_env = child_environment(env)
    owner = 'ouroboros-basic-flow-preflight-' + uuid.uuid4().hex
    label = 'ouroboros.demo-preflight=' + owner
    try:
        subprocess.run([*docker, 'create', '--name', owner, '--label', label,
            '--network', 'none', '--read-only', '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges', '--memory', '128m',
            '--pids-limit', '32', '--user', '65532:65532', '--entrypoint', '/bin/sh',
            env['native_image'], '-c', 'test -x /usr/local/bin/codex-code-mode-host && /usr/local/bin/codex --version'],
            check=True, capture_output=True, timeout=10, env=child_env)
        result = subprocess.run([*docker, 'start', '--attach', owner],
            check=True, capture_output=True, timeout=10, env=child_env)
        if result.stdout.decode().strip() != 'codex-cli ' + env['codex_version']:
            raise RuntimeError('Codex tool package or version mismatch')
    finally:
        owned = subprocess.run([*docker, 'ps', '-a', '--no-trunc', '--filter', 'label=' + label,
            '--format', '{{.ID}}'], check=True, capture_output=True, timeout=10, env=child_env)
        for container in owned.stdout.decode().splitlines():
            if len(container) != 64 or any(c not in '0123456789abcdef' for c in container):
                raise RuntimeError('invalid preflight container identity')
            subprocess.run([*docker, 'rm', '--force', container], check=True,
                capture_output=True, timeout=10, env=child_env)


class Demo:
    extra_services = ()
    sample = SAMPLE
    purpose = FIRST
    tool_instruction = 'Use only local file and shell tools; no network or extra agents.'

    def __init__(self, env, args):
        self.env, self.args = env, args
        self.child_env = child_environment(env)
        self.root = env['run_root'] / args.run_name
        self.deployment = env['deployment_root'] / args.run_name
        self.ipc = env['ipc_root'] / args.run_name
        self.services = []
        self.runtime = None
        self.postgres = None
        self.executions = []
        self.transcript = []
        self.credentials = []
        self.step = 'prepare'

    def credential_file(self, path, content, uid=0):
        """Expose a locked memory file through the existing regular-file contract."""
        value = VolatileCredential(content, uid)
        self.credentials.append(value)
        value.publish(path)
        return value

    def command(self, argv, uid=None, timeout=30, input=None):
        return subprocess.run([str(x) for x in argv], input=input, capture_output=True,
                              timeout=timeout, check=True, env=self.child_env,
                              preexec_fn=postgres_identity(self.env) if uid == self.env['postgres_uid'] else guard_preexec(uid) if uid is not None else None).stdout

    def note(self, label, **value):
        entry = {'step': label, **value}
        self.transcript.append(entry)
        print(json.dumps(entry, ensure_ascii=False), flush=True)

    def setup(self, token):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        for path in (self.root, self.deployment, self.ipc):
            if path.exists():
                raise ValueError('run name already exists; preserve it and select a new name')
        for path in (self.root, self.deployment, self.ipc):
            path.mkdir(mode=0o755)
            path.chmod(0o755)
        manifest = {p.name: hash_build_binary(p) for p in self.env['bin_dir'].glob('ouroboros-*') if p.is_file() and '.' not in p.name}
        release = install(self.env['bin_dir'], self.env['release_root'], manifest, 0)
        self.binary = Path(release['bin_dir'])
        private(self.root / 'source.json', json.dumps({'source_root': str(self.env['source_root']), 'binaries': manifest}))
        pg = self.root / 'pg'
        pg.mkdir(mode=0o700)
        os.chown(pg, self.env['postgres_uid'], self.env['postgres_gid'])
        password = secrets.token_hex(24)
        bootstrap = self.credential_file(pg / 'password', password, self.env['postgres_uid'])
        self.command([self.env['pg_bin'] / 'initdb', '-D', pg / 'data', '--username=demo_owner',
                      '--auth-local=scram-sha-256', '--auth-host=scram-sha-256',
                      '--pwfile', pg / 'password', '--no-locale'], self.env['postgres_uid'])
        bootstrap.close()
        chosen = ports(['database', 'core', 'gateway', 'catalog', 'fixture', *[name for name, _ in self.extra_services]])
        self.pg_port = chosen.pop('database')
        with (pg / 'postgres.log').open('xb') as log:
            os.chmod(pg / 'postgres.log', 0o600)
            self.postgres = subprocess.Popen([str(self.env['pg_bin'] / 'postgres'), '-D', str(pg / 'data'),
                '-h', '127.0.0.1', '-p', str(self.pg_port), '-k', '', '-c', 'shared_buffers=32MB', '-c', 'max_connections=40'],
                env=self.child_env, preexec_fn=postgres_identity(self.env), stdout=log, stderr=log)
        for _ in range(100):
            ready = subprocess.run([str(self.env['pg_bin'] / 'pg_isready'), '-h', '127.0.0.1', '-p', str(self.pg_port)],
                                   env=self.child_env, capture_output=True, timeout=2)
            if ready.returncode == 0:
                break
            if self.postgres.poll() is not None:
                raise RuntimeError('demo PostgreSQL exited')
            time.sleep(.05)
        else:
            raise TimeoutError('demo PostgreSQL readiness')
        self.credential_file(self.root / 'admin.url', f'postgresql://demo_owner:{password}@127.0.0.1:{self.pg_port}/postgres?sslmode=disable\n')
        chosen['bridge'] = 18080
        private(self.root / 'fixture.json', json.dumps({'root': str(self.deployment / 'test'), 'bin_dir': str(self.binary),
            'bind_host': '127.0.0.1', 'ports': chosen, 'admin_url_file': str(self.root / 'admin.url'),
            'disposable_database': True, 'runtime': {'docker_socket': str(self.env['docker_socket']),
                'ipc_root': str(self.ipc / 'test'), 'image': self.env['native_image'],
                'bridge_uid': self.env['bridge_uid'], 'guard_uid': self.env['guard_uid']}}))
        self.fixture = FixtureConfig(str(self.root / 'fixture.json'))
        self.test = self.fixture.create_root(mode=0o755)
        self.test.chmod(0o755)
        ipc = self.fixture.create_ipc_root()
        ipc.chmod(0o755)
        (ipc / 'gateway').mkdir(mode=0o711)
        (ipc / 'gateway').chmod(0o711)
        os.chown(ipc / 'gateway', 70002, 70002)
        self.ids = {key: str(uuid.uuid4()) for key in ('firm', 'human', 'agent', 'grant', 'child', 'control', 'store', 'generation', 'namespace', 'credential')}
        for name, uid in [('ca', 0), ('core', 70001), ('gateway', 70002), ('cli', 70003), ('catalog', 70005), ('provider', 70007), ('runtime', 0), *self.extra_services]:
            (self.test / name).mkdir(mode=0o700)
            os.chown(self.test / name, uid, uid)
        self.certificates()
        self.db = self.database('core')
        self.catalog_db = self.database('catalog')
        custody = self.custody_db = self.database('custody')
        i = self.ids
        lifetime = self.args.max_seconds
        self.sql(f"""INSERT INTO firms(id) VALUES('{i['firm']}');
INSERT INTO principals VALUES('{i['firm']}','{i['human']}','human',true),('{i['firm']}','{i['agent']}','agent',true);
INSERT INTO credentials VALUES('{self.fps['human']}','{i['firm']}','{i['human']}',true,clock_timestamp()+interval '{lifetime} seconds');
INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES
('{i['firm']}','{i['grant']}','{i['human']}',NULL,ARRAY['work.create','execution.start','inspect','workspace.create','file.read','file.upload','file.publish','conversation.create','conversation.read','conversation.send','model.responses','mcp'],clock_timestamp()+interval '{lifetime} seconds'),
('{i['firm']}','{i['child']}','{i['agent']}','{i['grant']}',ARRAY['execution.start','inspect','file.read','conversation.read','conversation.send','model.responses','mcp'],clock_timestamp()+interval '{lifetime} seconds'),
('{i['firm']}','{i['control']}','{i['human']}',NULL,ARRAY['inspect','execution.stop','delegation.revoke'],clock_timestamp()+interval '{lifetime} seconds');
INSERT INTO limits VALUES('{i['firm']}','compute',100,0),('{i['firm']}','resource_calls',{self.args.max_calls},0);
INSERT INTO profiles VALUES('{i['firm']}','basic-flow',true,100,{lifetime});
INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES('{i['firm']}','{i['store']}','{i['generation']}',8388608);""")
        self.profile = {'native_codex': True, 'native_model': self.args.model, 'image': self.env['native_image'],
            'memory_bytes': 1073741824, 'nano_cpus': 1000000000, 'pids_limit': 96,
            'lifetime_seconds': lifetime, 'compute_units': 70, 'workspace_bytes': 67108864, 'home_bytes': 67108864,
            'temporary_bytes': 16777216, 'max_input_files': 8, 'max_input_bytes': 2097152,
            'max_file_bytes': 1048576, 'max_output_bytes': 2097152}
        self.sql(f"INSERT INTO program_profiles VALUES('{i['firm']}','basic-flow','{json.dumps(self.profile)}',true)")
        core = {'listen': self.fixture.endpoint('core'), 'tls': self.tls('core', 'core', 70001),
            'database_url_file': str(self.test / 'core/db.url'), 'firm_id': i['firm'],
            'gateway_fingerprint': self.fps['gateway-service'], 'runtime_fingerprint': self.fps['runtime']}
        self.config('core', core, 70001)
        provider = {'target': 'managed-model', 'endpoint': 'https://chatgpt.com/backend-api/codex/responses',
            'credential_id': i['credential'], 'credential_version': 1, 'timeout_ms': 30000,
            'max_response_bytes': 2097152, 'chatgpt_account_id': self.args.account_id,
            'codex_responses_lite': self.args.responses_lite}
        key, nonce = secrets.token_bytes(32), secrets.token_bytes(12)
        header = b'ouroboros-credential-aes256gcm-1'
        aad = header + uuid.UUID(i['firm']).bytes + uuid.UUID(i['credential']).bytes + (1).to_bytes(8, 'big')
        envelope = header + nonce + AESGCM(key).encrypt(nonce, token, aad)
        self.sql(f"INSERT INTO credential_versions(owner_id,credential_id,version,envelope) VALUES('{i['firm']}','{i['credential']}',1,decode('{envelope.hex()}','hex'))", custody)
        # The existing custody key loader requires a private, singly linked key file.
        private(self.test / 'provider/custody.key', key, 70007)
        del key, envelope, token
        self.resource('provider', 70007, {'key_file': str(self.test / 'provider/custody.key'), 'provider': provider})
        blobs = self.test / 'catalog/blobs'
        blobs.mkdir(mode=0o700)
        os.chown(blobs, 70005, 70005)
        storage = self.test / 'catalog/storage.json'
        private(self.test / 'catalog/prepare.json', json.dumps({'root': str(blobs), 'binding_file': str(storage),
            'owner_uid': 70005, 'firm_id': i['firm'], 'store_id': i['store'], 'generation': i['generation']}), 70005)
        self.command([self.binary / 'ouroboros-storage', 'prepare', '--config', self.test / 'catalog/prepare.json'], 70005)
        self.sql(f"INSERT INTO storage_binding VALUES(true,'{i['firm']}','{i['store']}','{i['generation']}')", self.catalog_db)
        self.resource('catalog', 70005, {'storage_binding_file': str(storage)})
        target = {'namespace_id': i['namespace'], 'store_id': i['store'], 'storage_generation': i['generation'], 'max_file_bytes': 1048576, 'transfer_seconds': 120}
        for name, fingerprint, config in [('files', self.fps['catalog'], target), ('managed-model', self.fps['provider'], provider)]:
            self.sql(f"INSERT INTO resource_targets VALUES('{i['firm']}','{name}','{fingerprint}',true,'{json.dumps(config)}',2097152)")
        self.sql(f"INSERT INTO workspace_namespaces VALUES('{i['firm']}','{i['namespace']}','files','{i['store']}','{i['generation']}',2,0)")
        extra_workers = self.prepare_extra_resources()
        gw_tls = self.tls('gateway', 'gateway-service', 70002)
        self.config('gateway', {'listen': self.fixture.endpoint('gateway'), 'tls': self.tls('gateway', 'gateway', 70002),
            'core_url': self.fixture.url('core'), 'core_client': gw_tls,
            'workers': {'files': self.fixture.url('catalog'), 'managed-model': self.fixture.url('fixture'), **extra_workers},
            'native_routes': {'model': 'managed-model'}, 'instance_socket': str(ipc / 'gateway/instance.sock')}, 70002)
        self.config('cli', {'gateway_url': self.fixture.url('gateway'), 'tls': self.tls('cli', 'human', 70003)}, 70003)
        self.config('runtime', {'core_url': self.fixture.url('core'), 'tls': self.tls('runtime', 'runtime', 0),
            'profile_id': 'basic-flow', 'profile': {key: self.profile[key] for key in ('image', 'memory_bytes', 'nano_cpus', 'pids_limit', 'lifetime_seconds')} | {'docker_socket': str(self.env['docker_socket'])},
            'program': self.profile, 'ipc_root': str(ipc), 'gateway_socket': str(ipc / 'gateway/instance.sock'),
            'gateway_uid': 70002, 'binary_dir': str(self.binary), 'evidence_dir': str(self.test / 'runtime'),
            'bridge_uid': self.env['bridge_uid'], 'guard_uid': self.env['guard_uid']}, 0)
        for name, uid in [('core', 70001), ('catalog', 70005), ('provider', 70007), *self.extra_services, ('gateway', 70002)]:
            self.services.append(self.launch(name, uid))
        for _ in range(100):
            try:
                self.cli('conditions')
                break
            except subprocess.CalledProcessError:
                if any(p.poll() is not None for p in self.services):
                    raise RuntimeError('demo service exited during startup')
                time.sleep(.1)
        else:
            raise TimeoutError('demo Gateway readiness')

    def sql(self, statement, database=None):
        return self.fixture.sql(statement, database or self.db)

    def prepare_extra_resources(self):
        return {}

    def check_prepared(self):
        pass

    def database(self, role):
        name, password = 'demo_' + role + '_' + secrets.token_hex(4), secrets.token_hex(24)
        self.fixture.sql(f"CREATE ROLE {name} LOGIN PASSWORD '{password}'; CREATE DATABASE {name} OWNER {name};")
        owner = 'provider' if role == 'custody' else role
        uid = {'core': 70001, 'catalog': 70005, 'provider': 70007, 'company': 70004}[owner]
        migration_url = self.test / 'runtime' / (role + '-migration.url')
        self.credential_file(migration_url, f'postgresql://{name}:{password}@127.0.0.1:{self.pg_port}/{name}?sslmode=disable\n')
        executable = 'ouroboros-migrate' if role == 'core' else 'ouroboros-resource-migrate'
        argv = [self.binary / executable, '--database-url-file', migration_url]
        if role != 'core':
            argv += ['--role', role]
        self.command(argv)
        service, secret = 'demo_service_' + secrets.token_hex(4), secrets.token_hex(24)
        grants = f"CREATE ROLE {service} LOGIN PASSWORD '{secret}'; GRANT CONNECT ON DATABASE {name} TO {service}; GRANT USAGE ON SCHEMA public TO {service};"
        if role == 'core':
            grants += f"GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {service};"
        elif role == 'catalog':
            tables = 'workspaces,workspace_snapshots,uploads,publication_receipts,upload_staging,blob_objects,upload_object_holds,revision_object_holds,workspace_create_receipts,catalog_retirements,catalog_collections'
            grants += f"GRANT SELECT,INSERT,UPDATE ON {tables} TO {service}; GRANT SELECT ON storage_binding TO {service}; GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {service};"
        elif role == 'company':
            grants += f"GRANT SELECT,INSERT,UPDATE ON inputs,results,effect_receipts TO {service};"
        else:
            grants += f"GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts TO {service}; GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {service}; GRANT INSERT(owner_id,attempt_id,credential_id,version) ON credential_use_claims TO {service}; GRANT INSERT(owner_id,attempt_id,ticket_sha256,reply) ON provider_receipts TO {service};"
        self.fixture.sql(grants, name)
        self.credential_file(self.test / owner / 'db.url', f'postgresql://{service}:{secret}@127.0.0.1:{self.pg_port}/{name}?sslmode=disable\n', uid)
        return name

    def certificates(self):
        ca = self.test / 'ca'
        self.command(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', ca / 'ca.key'])
        self.command(['openssl', 'req', '-x509', '-new', '-key', ca / 'ca.key', '-subj', '/CN=Ouroboros demo', '-days', '1',
            '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', ca / 'ca.pem'])
        private(ca / 'cert.ext', self.fixture.cert_extensions())
        self.fps = {}
        for name in ('core', 'gateway', 'gateway-service', 'runtime', 'human', 'catalog', 'provider', *[name for name, _ in self.extra_services]):
            self.command(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', ca / (name + '.key')])
            self.command(['openssl', 'req', '-new', '-key', ca / (name + '.key'), '-subj', '/CN=' + name, '-out', ca / (name + '.csr')])
            self.command(['openssl', 'x509', '-req', '-in', ca / (name + '.csr'), '-CA', ca / 'ca.pem', '-CAkey', ca / 'ca.key',
                '-CAcreateserial', '-days', '1', '-extfile', ca / 'cert.ext', '-out', ca / (name + '.pem')])
            self.fps[name] = hashlib.sha256(self.command(['openssl', 'x509', '-in', ca / (name + '.pem'), '-outform', 'DER'])).hexdigest()

    def tls(self, service, name, uid):
        for source in (name + '.key', name + '.pem', 'ca.pem'):
            dest = self.test / service / source
            if not dest.exists():
                private(dest, (self.test / 'ca' / source).read_bytes(), uid)
        return {'certificate': str(self.test / service / (name + '.pem')), 'private_key': str(self.test / service / (name + '.key')), 'ca': str(self.test / service / 'ca.pem')}

    def config(self, service, body, uid):
        private(self.test / service / 'config.json', json.dumps(body), uid)

    def resource(self, role, uid, extra):
        tls = self.tls(role, role, uid)
        self.config(role, {'listen': self.fixture.endpoint('fixture' if role == 'provider' else role), 'tls': tls, 'core_url': self.fixture.url('core'), 'core_client': tls,
            'gateway_fingerprint': self.fps['gateway-service'], 'role': role, 'database_url_file': str(self.test / role / 'db.url'), **extra}, uid)

    def launch(self, name, uid):
        binary = 'ouroboros-resources' if name in ('catalog', 'provider', 'company') else 'ouroboros-' + name
        log = self.test / name / ('process-' + secrets.token_hex(3) + '.log')
        with log.open('xb') as output:
            log.chmod(0o600)
            return subprocess.Popen([str(self.binary / binary), '--config', str(self.test / name / 'config.json')],
                env=self.child_env, preexec_fn=guard_preexec(uid), stdout=output, stderr=output)

    def cli(self, *args):
        return json.loads(self.command([self.binary / 'ouroboros-cli', '--config', self.test / 'cli/config.json', *args], 70003))

    def post(self, url, body, key, *scope):
        path = self.test / 'cli' / ('request-' + uuid.uuid4().hex + '.json')
        private(path, json.dumps(body), 70003)
        return self.cli('request', 'POST', url, '--input', str(path), '--key', key, *scope)

    def scope(self):
        return ('--work', self.work, '--delegation', self.ids['grant'], '--target', 'files')

    def publish(self, files, expected_revision, key):
        uploaded = {}
        for name, content in files.items():
            upload = self.post('/uploads', {'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}, key + '-' + name, *self.scope())
            path = self.test / 'cli' / ('content-' + uuid.uuid4().hex)
            private(path, content, 70003)
            self.cli('request', 'PUT', '/uploads/' + upload['upload_id'] + '/content', '--input', str(path), '--max-bytes', '1048576', *self.scope())
            uploaded[name] = upload['upload_id']
        return self.post('/publications', {'workspace_id': self.workspace, 'expected_revision': expected_revision, 'files': uploaded}, key, *self.scope())

    def message(self, text, key):
        path = self.test / 'cli' / (key + '.txt')
        private(path, text, 70003)
        return self.cli('conversations', 'send', self.conversation, '--delegation', self.ids['grant'], '--text-file', str(path), '--key', key)['resource_id']

    def turn(self, question, message, key, predecessor=None, checkpoint=None):
        i = self.ids
        prompt = f"""{question}
Ouroboros 기본 흐름을 확인하는 짧은 데모입니다. 답변은 한국어로 작성하세요.
Read /workspace/task/input.txt using the shell. {self.tool_instruction}
Write your own answer to /workspace/answer.txt, then persist that exact answer with this command:
/usr/local/bin/ouroboros-cli --instance conversations send {self.conversation} --delegation {i['child']} --text-file /workspace/answer.txt --reply-to {message} --key {key}-answer
After the command succeeds, finish your turn. Do not wait for another message.
"""
        native = {'prompt': prompt}
        inputs = [{'target': 'files', 'workspace_id': self.workspace, 'revision': 1, 'file': 'input.txt', 'destination': 'task/input.txt'}]
        if checkpoint:
            native['resume'] = {'thread_id': checkpoint['thread_id'], 'checkpoint_destination': 'state/session.jsonl'}
            inputs.append({'target': 'files', 'workspace_id': self.workspace, 'revision': 2, 'file': 'session.jsonl', 'destination': 'state/session.jsonl'})
        request = {'work_id': self.work, 'delegation_id': i['grant'], 'agent_delegation_id': i['child'], 'profile_id': 'basic-flow',
            'units': 70, 'lifetime_seconds': min(240, self.args.max_seconds), 'predecessor_execution_id': predecessor,
            'program': {'native': native, 'argv': [], 'inputs': inputs}}
        path = self.test / 'cli' / (key + '-start.json')
        private(path, json.dumps(request), 70003)
        accepted = self.cli('start', '--input', str(path), '--key', key)
        execution = accepted['resource_id']
        self.executions.append(execution)
        self.runtime = self.launch('runtime', 0)
        self.note(key + '.started', work_id=self.work, execution_id=execution, input=question)
        deadline = time.monotonic() + min(250, self.args.max_seconds)
        while time.monotonic() < deadline:
            state = self.cli('get', 'executions', execution)
            if state.get('terminated') and self.runtime.poll() is not None:
                # Runtime reports compute return after termination; the first read
                # can predate that report even when poll() observes its later exit.
                state = self.cli('get', 'executions', execution)
                break
            time.sleep(.3)
        else:
            raise TimeoutError('native turn did not terminate within the demo bound')
        if self.runtime.returncode != 0:
            raise RuntimeError('native runtime failed; inspect protected process evidence')
        messages = self.cli('conversations', 'read', self.conversation)['messages']
        answers = [m for m in messages if m.get('reply_to') == message and m.get('author_kind') == 'agent' and m.get('origin_instance_id') == state['instance_id']]
        if len(answers) != 1 or not answers[0]['text'].strip():
            raise RuntimeError('one persisted native answer is required')
        answer = answers[0]
        if (answer.get('native_context') or {}).get('execution_id') != execution or not state.get('compute_return'):
            raise RuntimeError('answer origin or execution closure missing')
        evidence = self.test / 'runtime' / state['instance_id']
        terminal = json.loads((evidence / 'native-terminal.json').read_text())['report']
        if terminal['status'] != 'completed':
            raise RuntimeError('native turn did not complete')
        self.note(key + '.answer', text=answer['text'], message_id=answer['id'], native_context=answer['native_context'])
        self.note(key + '.terminated', execution_id=execution, terminated=True, compute_return=state['compute_return'])
        return execution, evidence, terminal

    def prepare_flow(self):
        self.step = 'work'
        self.work = self.post('/work', {'purpose': self.purpose, 'delegation_id': self.ids['grant']}, 'demo-work')['resource_id']
        i = self.ids
        for delegation, ops in [(i['grant'], ['inspect', 'workspace.create', 'file.read', 'file.upload', 'file.publish']), (i['child'], ['inspect', 'file.read'])]:
            self.sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{i['firm']}','{self.work}','{delegation}','files',ARRAY[{','.join(repr(x) for x in ops)}],'{i['namespace']}')")
            self.sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) VALUES('{i['firm']}','{self.work}','{delegation}','managed-model',ARRAY['inspect','model.responses'])")
        self.workspace = self.post('/workspaces', {'label': 'Basic flow demo'}, 'demo-workspace', *self.scope())['workspace_id']
        self.publish({'input.txt': self.sample.encode()}, 0, 'demo-input')
        self.conversation = self.post('/conversations', {'work_id': self.work, 'delegation_id': i['grant'], 'responsible_agent_id': i['agent']}, 'demo-conversation')['resource_id']
        self.note('input', text=self.sample, work_id=self.work, conversation_id=self.conversation)

    def run_flow(self):
        self.prepare_flow()
        first = self.message(FIRST, 'first-question')
        self.step = 'first'
        execution, evidence, terminal = self.turn(FIRST, first, 'first')
        self.step = 'followup'
        self.publish({'session.jsonl': (evidence / 'native-checkpoint.jsonl').read_bytes()}, 1, 'demo-checkpoint')
        followup = self.message(FOLLOWUP, 'followup-question')
        _, _, resumed = self.turn(FOLLOWUP, followup, 'followup', execution, terminal)
        if resumed['thread_id'] != terminal['thread_id'] or resumed['turn_id'] == terminal['turn_id']:
            raise RuntimeError('follow-up did not continue the original native session')
        self.note('complete', actual_model=True, continuation='same native thread, new turn',
                  model_calls=int(self.sql("SELECT count(*) FROM resource_calls WHERE operation='model.responses'")),
                  result='basic flow observed; semantic result requires reading the two answers')

    def cleanup(self):
        failures = []
        if getattr(self, 'test', None) and self.executions:
            for execution in self.executions:
                try:
                    state = self.cli('get', 'executions', execution)
                    if not state.get('terminated'):
                        revision = self.cli('conditions')['revision']
                        self.cli('stop', execution, '--revision', str(revision), '--key', 'demo-stop-' + execution)
                        for _ in range(100):
                            if self.cli('get', 'executions', execution).get('terminated'):
                                break
                            time.sleep(.1)
                        else:
                            raise RuntimeError('stop not observed')
                except Exception:
                    failures.append('execution stop or observation')
        processes = ([self.runtime] if self.runtime else []) + list(reversed(self.services))
        for proc in processes:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    failures.append('owned process stop')
                    proc.kill()
                    proc.wait(timeout=5)
        if getattr(self, 'test', None):
            for receipt in (self.test / 'runtime').glob('*/container.json'):
                try:
                    container = json.loads(receipt.read_text())['container_id']
                    if len(container) != 64 or any(c not in '0123456789abcdef' for c in container):
                        raise ValueError('invalid recorded container identity')
                    docker = ['docker', '--host', 'unix://' + str(self.env['docker_socket'])]
                    observed = json.loads(self.command([*docker, 'inspect', container]))[0]
                    if observed['Config']['Labels'].get('ouroboros.instance') != receipt.parent.name or observed['State']['Running']:
                        raise RuntimeError('owned container termination not verified')
                    self.command([*docker, 'rm', container])
                    remaining = self.command([*docker, 'ps', '-a', '--no-trunc', '--filter', 'id=' + container, '--format', '{{.ID}}'])
                    if remaining.strip():
                        raise RuntimeError('owned container removal not observed')
                except Exception:
                    failures.append('recorded container cleanup')
            if all(proc.poll() is not None for proc in processes):
                (self.test / 'provider/custody.key').unlink(missing_ok=True)
        if self.postgres and self.postgres.poll() is None:
            self.postgres.send_signal(signal.SIGINT)
            try:
                if self.postgres.wait(timeout=30) != 0:
                    failures.append('database closure')
            except subprocess.TimeoutExpired:
                failures.append('database closure')
        if all(proc.poll() is not None for proc in processes) and (self.postgres is None or self.postgres.poll() is not None):
            for credential in self.credentials:
                credential.close()
        if self.root.exists():
            private(self.root / 'transcript.json', json.dumps(self.transcript, ensure_ascii=False, indent=2))
            private(self.root / 'cleanup.json', json.dumps({'errors': failures}))
        if failures:
            raise RuntimeError('demo cleanup incomplete; owned evidence retained')


def verify_resource_smoke(proof):
    """Check collected native/Core/worker/read-back evidence, not the agent's report."""
    def require(condition, stage):
        if not condition:
            raise RuntimeError('resource-smoke evidence failed: ' + stage)

    expected = proof['expected']
    instance = proof['instance_id']
    calls = proof['calls']
    mcp = [e.get('params', {}).get('item', {}) for e in proof['events']
           if e.get('method') == 'item/completed']
    require(any(item.get('type') == 'mcpToolCall' and item.get('server') == 'managed'
                and item.get('tool') == 'execution_self' and item.get('status') == 'completed'
                and item.get('error') is None and isinstance(item.get('result'), dict)
                and not item['result'].get('isError', False)
                and (item['result'].get('structuredContent') or {}).get('id') == expected['execution_id']
                and (item['result'].get('structuredContent') or {}).get('instance_id') == instance
                for item in mcp), 'mcp')

    def successful(operation):
        return [c for c in calls if c['operation'] == operation and c['instance_id'] == instance
                and isinstance(c.get('reply'), dict) and 200 <= c['reply']['status'] < 300]

    require(any(json.loads(c['reply']['body']) == {'db_marker': expected['db_marker']}
                for c in successful('db.read')), 'db.read')
    rows, receipts = proof['rows'], proof['db_receipts']
    require(len(rows) == len(receipts) == 1 and rows[0]['content'] == expected
            and receipts[0]['input'] == expected and receipts[0]['result_id'] == rows[0]['id']
            and any(c['intent_id'] == receipts[0]['intent_id']
                    and c['reply']['receipt'].get('result_id') == rows[0]['id']
                    for c in successful('db.write')), 'db.write')
    publications = proof['publications']
    require(proof['revision'] == 2 and len(publications) == 1
            and publications[0]['revision'] == 2
            and 'result.json' in publications[0]['input'].get('files', {})
            and any(c['intent_id'] == publications[0]['intent_id'] for c in successful('file.publish')),
            'file.publish')
    require(proof['published'] == expected, 'file.readback')
    return dict.fromkeys(('mcp', 'db.read', 'db.write', 'file.publish', 'file.readback'), 'PASS')


class ResourceSmokeDemo(Demo):
    scenario_name = 'resource-smoke'
    additional_outputs = ()
    extra_services = (('company', 70004),)
    purpose = 'MCP 호출, DB 조회와 저장, 결과 파일 게시를 한 작업에서 확인해줘.'
    tool_instruction = ('Use the native managed MCP execution_self tool and local shell/files with the '
                        'Ouroboros CLI. No arbitrary network access or extra agents.')

    def __init__(self, env, args):
        super().__init__(env, args)
        self.file_marker = secrets.token_hex(12)
        self.db_marker = secrets.token_hex(12)
        self.input_id = str(uuid.uuid4())
        self.sample = json.dumps({'file_marker': self.file_marker}) + '\n'

    def prepare_extra_resources(self):
        i = self.ids
        self.company_db = self.database('company')
        self.sql(f"INSERT INTO inputs VALUES('{i['firm']}','{self.input_id}',"
                 f"'{json.dumps({'db_marker': self.db_marker})}')", self.company_db)
        self.resource('company', 70004, {})
        self.sql(f"INSERT INTO resource_targets VALUES('{i['firm']}','company','{self.fps['company']}',true,"
                 f"'{json.dumps({'input_id': self.input_id})}',2097152)")
        self.sql(f"UPDATE delegations SET actions=actions||ARRAY['db.read','db.write'] WHERE firm_id='{i['firm']}' "
                 f"AND id IN ('{i['grant']}','{i['child']}'); "
                 f"UPDATE delegations SET actions=actions||ARRAY['file.upload','file.publish'] "
                 f"WHERE firm_id='{i['firm']}' AND id='{i['child']}'")
        return {'company': self.fixture.url('company')}

    def prepare_flow(self):
        super().prepare_flow()
        i = self.ids
        self.sql(f"UPDATE resource_scopes SET operations=operations||ARRAY['file.upload','file.publish'] "
                 f"WHERE firm_id='{i['firm']}' AND work_id='{self.work}' AND delegation_id='{i['child']}' AND target_id='files'")
        for grant in (i['grant'], i['child']):
            self.sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) "
                     f"VALUES('{i['firm']}','{self.work}','{grant}','company',ARRAY['inspect','db.read','db.write'])")

    def check_prepared(self):
        observed = self.post('/db/queries', {'operation': 'read_input', 'parameters': {'input_id': self.input_id}},
                             'prepare-db-read', '--work', self.work, '--delegation', self.ids['grant'], '--target', 'company')
        if observed != {'db_marker': self.db_marker} or int(self.sql('SELECT count(*) FROM results', self.company_db)):
            raise RuntimeError('resource-smoke DB preparation mismatch')
        output = self.test / 'cli/prepared-input.json'
        self.download(f'/workspaces/{self.workspace}/snapshots/1/files/input.txt', output)
        if json.loads(output.read_bytes()) != {'file_marker': self.file_marker}:
            raise RuntimeError('resource-smoke file preparation mismatch')
        self.note('resources.prepared', db_read='PASS', file_read='PASS', db_rows=0, actual_model_calls=0)

    def download(self, location, output):
        # Binary --output succeeds with empty stdout; it is not a JSON CLI response.
        self.command([self.binary / 'ouroboros-cli', '--config', self.test / 'cli/config.json',
                      'request', 'GET', location, '--output', str(output), *self.scope()], 70003)

    def additional_task(self):
        return ''

    def check_additional_artifacts(self, proof):
        return {}

    def run_flow(self):
        self.prepare_flow()
        publication_files = {'result.json': '<upload_id>'}
        publication_files.update({name: '<' + name + ' upload_id>' for name in self.additional_outputs})
        publication_body = json.dumps({'workspace_id': self.workspace, 'expected_revision': 1, 'files': publication_files})
        question = f"""{self.purpose}
Perform this small task once. Use the native managed MCP tool execution_self with {{}} (not a hand-written HTTP substitute).
Read file_marker from /workspace/task/input.txt. Read db_marker with the prepared read_input operation below.
Write /workspace/result.json with exactly file_marker, db_marker, execution_id; execution_id is the id returned by execution_self.
Store that same JSON object through record_result, then upload and publish result.json. Do not put the expected values in commands until you have read them.
The existing CLI is /usr/local/bin/ouroboros-cli. Use --instance request for resource requests.
All resource requests need --work {self.work} --delegation {self.ids['child']} and --target company (DB) or --target files (files).
Use --input PATH for JSON bodies and --key for POST operations. --select /upload_id extracts an upload identifier from POST /uploads.
DB read: POST /db/queries, key smoke-read, body {{"operation":"read_input","parameters":{{"input_id":"{self.input_id}"}}}}.
DB write: POST /db/transactions, key smoke-write, body {{"operation":"record_result","parameters":<the result.json object>}}.
Upload: POST /uploads, key smoke-upload, body {{"size":<exact byte count>,"sha256":"<sha256 of result.json>"}}; then PUT /uploads/<upload_id>/content with --input /workspace/result.json.
Publish: POST /publications, key smoke-publish, body {publication_body}.
{self.additional_task()}
Use available sh, cat, printf, wc -c and sha256sum; no installation or Python dependency is needed.
After successful publication, write a brief Korean report to /workspace/answer.txt containing the exact path /workspaces/{self.workspace}/snapshots/2/files/result.json.
"""
        message = self.message(question, 'resource-question')
        # Start this run's single live window only after fixture/input preparation.
        # This never resets the resource-call counter or retries an execution.
        expiry = f"clock_timestamp()+interval '{self.args.max_seconds} seconds'"
        self.sql(f"UPDATE credentials SET expires_at={expiry}; UPDATE delegations SET expires_at={expiry}")
        if not getattr(self.args, 'no_deadline', False):
            signal.alarm(self.args.max_seconds)
        self.step = 'resource-agent'
        try:
            execution, native_root, terminal = self.turn(question, message, 'resource')
        except BaseException:
            # Collect committed effects before cleanup closes the private databases.
            try:
                if self.executions:
                    execution = self.executions[-1]
                    state = self.cli('get', 'executions', execution)
                    native_root = self.test / 'runtime' / state['instance_id']
                    proof = self.collect_evidence(execution, native_root)
                    private(self.root / 'resource-evidence.json', json.dumps(proof, ensure_ascii=False, indent=2))
            except Exception as evidence_error:
                private(self.root / 'resource-evidence-error.json', json.dumps({'type': type(evidence_error).__name__}))
            raise
        self.step = 'resource-evidence'
        proof = self.collect_evidence(execution, native_root)
        # Preserve evidence even when publication is missing or read-back fails.
        private(self.root / 'resource-evidence.json', json.dumps(proof, ensure_ascii=False, indent=2))
        location = f'/workspaces/{self.workspace}/snapshots/2/files/result.json'
        output = self.test / 'cli/published-result.json'
        self.download(location, output)
        published_bytes = output.read_bytes()
        proof['published'] = json.loads(published_bytes)
        checks = verify_resource_smoke(proof)
        checks.update(self.check_additional_artifacts(proof))
        report = next(v for v in self.transcript if v['step'] == 'resource.answer')
        if location not in report['text']:
            raise RuntimeError('published file location missing from conversation answer')
        private(self.root / 'result.json', published_bytes)
        checks.update({'execution.terminated': 'PASS', 'compute.return': 'PASS'})
        summary = {'scenario': self.scenario_name, 'result': 'PENDING_CLEANUP', 'checks': checks, 'actual_model': True,
                   'model_calls': int(self.sql("SELECT count(*) FROM resource_calls WHERE operation='model.responses'")),
                   'resource_calls': int(self.sql('SELECT count(*) FROM resource_calls')),
                   'execution_id': execution, 'native_context': terminal,
                   'published_path': location, 'result_file': str(self.root / 'result.json')}
        private(self.root / 'resource-summary.json', json.dumps(summary, ensure_ascii=False, indent=2))
        self.note('resources.verified', **summary)

    def collect_evidence(self, execution, native_root):
        instance = native_root.name
        proof = {
            'expected': {'file_marker': self.file_marker, 'db_marker': self.db_marker, 'execution_id': execution},
            'instance_id': instance,
            'events': [json.loads(line) for line in (native_root / 'native.jsonl').read_text().splitlines()],
            'calls': json.loads(self.sql(f"SELECT COALESCE(json_agg(json_build_object('operation',operation,'instance_id',instance_id,'intent_id',intent_id,'reply',reply)),'[]'::json) FROM resource_calls WHERE firm_id='{self.ids['firm']}' AND work_id='{self.work}' AND operation IN ('db.read','db.write','file.publish')")),
            'rows': json.loads(self.sql('SELECT COALESCE(json_agg(r),\'[]\'::json) FROM results r', self.company_db)),
            'db_receipts': json.loads(self.sql('SELECT COALESCE(json_agg(r),\'[]\'::json) FROM effect_receipts r', self.company_db)),
            'publications': json.loads(self.sql(f"SELECT COALESCE(json_agg(r),'[]'::json) FROM publication_receipts r WHERE workspace_id='{self.workspace}' AND revision>1", self.catalog_db)),
            'revision': int(self.sql(f"SELECT revision FROM workspaces WHERE id='{self.workspace}'", self.catalog_db)),
        }
        return proof

    def cleanup(self):
        super().cleanup()
        summary_path = self.root / 'resource-summary.json'
        if summary_path.exists():
            if ((self.test / 'provider/custody.key').exists()
                    or (self.root / 'pg/data/postmaster.pid').exists()):
                raise RuntimeError('resource-smoke private key or database cleanup incomplete')
            summary = json.loads(summary_path.read_text())
            summary['checks']['cleanup'] = 'PASS'
            summary['result'] = 'PASS'
            summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
            self.note('complete', **summary)


COMPANY_UI_FILES = ('CompanyPulse.tsx', 'company-ui.json')


def verify_company_ui_artifacts(proof, files):
    """Verify transport provenance and a bounded SDK candidate; not a JS sandbox or build check."""
    def require(condition, stage):
        if not condition:
            raise RuntimeError('company-ui evidence failed: ' + stage)

    require(set(files) == set(COMPANY_UI_FILES), 'files')
    publications = proof['publications']
    require(len(publications) == 1 and publications[0]['revision'] == 2, 'publication')
    publication = publications[0]
    require(any(c.get('operation') == 'file.publish' and c.get('instance_id') == proof['instance_id']
                and c.get('intent_id') == publication['intent_id']
                and isinstance(c.get('reply'), dict) and 200 <= c['reply'].get('status', 0) < 300
                for c in proof['calls']), 'publisher')
    metadata = {}
    for name, content in files.items():
        require(isinstance(content, bytes) and 0 < len(content) <= 65536, 'size')
        digest = hashlib.sha256(content).hexdigest()
        upload_id = publication['input'].get('files', {}).get(name)
        uploads = [u for u in proof.get('ui_uploads', []) if u.get('intent_id') == upload_id]
        require(upload_id and len(uploads) == 1, 'publication.' + name)
        upload = uploads[0]
        reply = upload.get('reply') or {}
        receipt = reply.get('receipt') or {}
        require(upload.get('instance_id') == proof['instance_id']
                and 200 <= reply.get('status', 0) < 300
                and upload.get('input') == {'size': len(content), 'sha256': digest}
                and receipt.get('source') == 'catalog'
                and receipt.get('upload_receipt') == upload_id
                and receipt.get('sha256') == digest and receipt.get('size') == len(content),
                'readback.' + name)
        metadata[name] = {'sha256': digest, 'bytes': len(content), 'upload_intent': upload_id,
                          'publication_intent': publication['intent_id'], 'revision': 2}

    def object_without_duplicates(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise RuntimeError('company-ui evidence failed: duplicate JSON field')
            obj[key] = value
        return obj

    try:
        source = files['CompanyPulse.tsx'].decode('utf-8')
        composition = json.loads(files['company-ui.json'].decode('utf-8'), object_pairs_hook=object_without_duplicates)
    except (ValueError, UnicodeError) as error:
        raise RuntimeError('company-ui evidence failed: encoding') from error
    execution = proof['expected']['execution_id']
    expected_composition = {
        'schemaVersion': 1, 'companyId': proof['company_id'], 'revision': 1, 'author': execution,
        'pages': [{'id': 'pulse', 'title': 'Company pulse', 'module': 'agent-pulse',
                   'widgets': [{'id': 'pulse-proof', 'widget': 'agent-pulse.summary', 'size': 'medium'}]}],
        'publication': {'workspace': proof['workspace_id'], 'revision': 2, 'path': 'company-ui.json', 'executionId': execution},
    }
    require(composition == expected_composition, 'composition')
    require(re.search(r'import\s*\{\s*defineCompanyModule\s*\}\s*from\s*[\'"]@/contracts/company-sdk[\'"]', source)
            and re.search(r'export\s+default\s+defineCompanyModule\s*\(', source), 'sdk')
    # The TypeScript compiler and app registry validate executable structure afterward.
    # These candidate checks only bind observed values and expected identity to the downloaded source.
    for value in ('agent-pulse', 'Company pulse', '1.0.0', 'agent-pulse.summary', *proof['expected'].values()):
        require(value in source, 'source-content')
    require('Verification snapshot' in source, 'historical-label')
    return {'checks': {'ui.publication': 'PASS', 'ui.readback': 'PASS', 'ui.composition': 'PASS', 'ui.source_candidate': 'PASS'},
            'files': metadata, 'compiled': 'NOT RUN', 'displayed': 'NOT RUN'}


class CompanyUiDemo(ResourceSmokeDemo):
    """One real native turn authors a bounded UI module; the owner app compiles it separately."""
    scenario_name = 'company-ui'
    additional_outputs = COMPANY_UI_FILES
    purpose = '기존 리소스 검증을 수행하고, 그 관측을 보여주는 작은 Company 화면과 위젯을 구현해 게시해줘.'

    def additional_task(self):
        composition = {
            'schemaVersion': 1, 'companyId': self.ids['firm'], 'revision': 1, 'author': '<execution_id from execution_self>',
            'pages': [{'id': 'pulse', 'title': 'Company pulse', 'module': 'agent-pulse',
                       'widgets': [{'id': 'pulse-proof', 'widget': 'agent-pulse.summary', 'size': 'medium'}]}],
            'publication': {'workspace': self.workspace, 'revision': 2, 'path': 'company-ui.json',
                            'executionId': '<execution_id from execution_self>'},
        }
        return f"""Before the single publication, also implement /workspace/CompanyPulse.tsx and /workspace/company-ui.json.
Use the values you actually observed from execution_self, input.txt, and read_input; do not invent live system health.
CompanyPulse.tsx must import {{ defineCompanyModule }} from \"@/contracts/company-sdk\" and default-export defineCompanyModule with:
id \"agent-pulse\", name \"Company pulse\", version \"1.0.0\", pages [{{id:\"pulse\",title:\"Company pulse\"}}],
widgets [{{id:\"agent-pulse.summary\",title:\"Company pulse\",description:\"Evidence from a completed resource verification\",provider:\"Company\",sizes:[\"small\",\"medium\"],Component: function CompanyPulse() {{ return <your JSX>; }}}}].
Implement the JSX yourself: a compact English component labeled \"Verification snapshot\", with clearly labeled observed execution ID, file marker, and DB marker.
Use semantic HTML and the classes type-data, type-meta, type-section; rely on the host theme. Use no fetch, URLs, scripts, storage, imports other than this SDK, or dependencies.
The host uses the automatic React JSX runtime, so do not import React. The component represents this completed verification, not a live monitoring feed.
Write company-ui.json matching this exact composition shape, replacing only the two execution placeholders with the observed execution ID:
{json.dumps(composition)}
Each of the two extra files must be at most 65536 bytes. Upload each separately using the same POST/PUT path above, unique keys ui-source-upload and ui-composition-upload, and its own exact byte count and sha256sum.
Use all THREE upload IDs (result.json, CompanyPulse.tsx, company-ui.json) in ONE POST /publications with expected_revision 1. Do not publish partial revisions.
Include all three exact /workspaces/{self.workspace}/snapshots/2/files/<filename> paths in your persisted answer.
No local build or dependency installation is needed in the native container; the host will compile the downloaded source separately.
"""

    def collect_evidence(self, execution, native_root):
        proof = super().collect_evidence(execution, native_root)
        proof.update({'company_id': self.ids['firm'], 'workspace_id': self.workspace})
        proof['ui_uploads'] = json.loads(self.sql(
            "SELECT COALESCE(json_agg(json_build_object('intent_id',r.intent_id,'instance_id',r.instance_id,"
            "'input',i.input->'input','reply',r.reply)),'[]'::json) FROM resource_calls r "
            "JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) "
            f"WHERE r.firm_id='{self.ids['firm']}' AND r.work_id='{self.work}' AND r.operation='file.upload'"))
        return proof

    def check_additional_artifacts(self, proof):
        self.step = 'company-ui-artifacts'
        files = {}
        for name in COMPANY_UI_FILES:
            location = f'/workspaces/{self.workspace}/snapshots/2/files/{name}'
            output = self.test / 'cli' / ('published-' + name)
            self.command([self.binary / 'ouroboros-cli', '--config', self.test / 'cli/config.json',
                          'request', 'GET', location, '--output', str(output), '--max-bytes', '65536',
                          *self.scope()], 70003)
            content = output.read_bytes()
            # Preserve downloaded bytes even if the candidate's content check fails.
            private(self.root / name, content)
            files[name] = content
        report = verify_company_ui_artifacts(proof, files)
        report['publication'] = {'workspace': self.workspace, 'revision': 2, 'path': 'company-ui.json',
                                 'executionId': proof['expected']['execution_id']}
        private(self.root / 'company-ui-evidence.json', json.dumps(report, indent=2))
        answer = next(v for v in self.transcript if v['step'] == 'resource.answer')['text']
        if any(f'/workspaces/{self.workspace}/snapshots/2/files/{name}' not in answer for name in COMPANY_UI_FILES):
            raise RuntimeError('company-ui published paths missing from persisted answer')
        self.note('company-ui.verified', **report)
        return report['checks']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--environment', type=Path, required=True)
    parser.add_argument('--run-name', type=identifier, required=True)
    parser.add_argument('--model', type=model_identifier, required=True)
    parser.add_argument('--scenario', choices=('basic-flow', 'resource-smoke', 'company-ui'), default='basic-flow')
    parser.add_argument('--account-id', type=identifier)
    parser.add_argument('--responses-lite', action='store_true', help='pin the Codex Responses Lite dialect for a model that emits it')
    parser.add_argument('--max-calls', type=int, help='total governed resource calls, including model requests')
    parser.add_argument('--max-seconds', type=int)
    parser.add_argument('--no-deadline', action='store_true',
                        help='remove the demo-wide wall-clock alarm; finite native leases and request timeouts remain')
    parser.add_argument('--preflight', action='store_true')
    parser.add_argument('--prepare-only', action='store_true', help='exercise setup, file publication and conversation creation without a model call or real credential')
    parser.add_argument('--credential-stdin', action='store_true')
    args = parser.parse_args()
    resource_smoke = args.scenario in ('resource-smoke', 'company-ui')
    if args.max_calls is None:
        args.max_calls = 30 if resource_smoke else 20
    if args.max_seconds is None:
        args.max_seconds = 900 if args.no_deadline else (300 if resource_smoke else 600)
    if not 1 <= args.max_calls <= 40 or not 60 <= args.max_seconds <= 900:
        parser.error('finite demo bounds required: 1..40 calls and 60..900 seconds')
    if resource_smoke and (args.max_calls > 30 or (args.max_seconds > 300 and not args.no_deadline)):
        parser.error('resource-smoke is limited to 30 calls and 300 seconds')
    env = load_environment(args.environment)
    preflight(env)
    codex_tools_preflight(env)
    if args.preflight:
        print(json.dumps({'ready': True, 'actual_model_calls': 0, 'model': args.model,
            'max_resource_calls': args.max_calls, 'max_seconds': args.max_seconds}))
        return
    if args.prepare_only:
        if args.credential_stdin or args.account_id:
            parser.error('prepare-only accepts no real credential or account')
        args.account_id = 'demo-setup-only'
        token = b'synthetic-preparation-no-model-call'
    else:
        if not args.credential_stdin or sys.stdin.isatty() or not args.account_id:
            parser.error('explicit account and credential via nonterminal stdin required after bounded allowance')
        token = sys.stdin.buffer.read(16385).strip()
    if not token or len(token) > 16384 or any(b < 33 or b > 126 for b in token):
        parser.error('invalid credential input')
    os.umask(0o077)
    demo = {'basic-flow': Demo, 'resource-smoke': ResourceSmokeDemo, 'company-ui': CompanyUiDemo}[args.scenario](env, args)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        demo.setup(token)
        del token
        if args.prepare_only:
            demo.prepare_flow()
            demo.check_prepared()
            if int(demo.sql("SELECT count(*) FROM resource_calls WHERE operation='model.responses'")) != 0 or int(demo.sql('SELECT count(*) FROM credential_use_claims', demo.custody_db)) != 0:
                raise RuntimeError('prepare-only made an unexpected model or credential claim')
            demo.note('prepared', actual_model_calls=0, native_execution='NOT RUN')
        else:
            signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('demo deadline')))
            if not resource_smoke and not args.no_deadline:
                signal.alarm(args.max_seconds)
            demo.run_flow()
    except BaseException as error:
        if demo.root.exists():
            private(demo.root / 'failure.json', json.dumps({'stage': demo.step, 'type': type(error).__name__}))
        raise
    finally:
        signal.alarm(0)
        demo.cleanup()


if __name__ == '__main__':
    main()
