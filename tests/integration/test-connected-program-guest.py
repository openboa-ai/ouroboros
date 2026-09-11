"""One disposable Linux artifact-backed program run; no Codex, model or provider calls.

Human CLI publishes code and binary input. Core resolves their exact retained references;
Runtime's contained materializer alone obtains them before program release. The actual
program uses its instance CLI to upload and separately publish generated binary output.
Distinct service UIDs, real PostgreSQL and current Gateway authority are observed. Root's
Docker exec is used only for bounded test observations, never to deliver input or start work.

The caller supplies an already prepared immutable image and disposable configuration. This
script does not pull/build images, settle compute, release dependencies, or create a successor.
The Catalog is briefly SIGSTOP'ed to make the materialization barrier observable; --restriction
selects an independently observed stop, delegation revocation, or natural zero-exit case.
"""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import time
import uuid

from tests.support.fixture_config import clean_environment, load_config, local_url

def interrupted(signum, frame):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise KeyboardInterrupt('program fixture cancelled')

signal.signal(signal.SIGTERM, interrupted)
parser = argparse.ArgumentParser()
if not __debug__:
    parser.error('optimized Python disables behavioral assertions and is not a test profile')
parser.add_argument('--restriction', choices=['stop', 'revoke', 'complete'], default='revoke')
parser.add_argument('--adapter-verification', action='store_true')
args, fixture = load_config(parser)
if args.adapter_verification and args.restriction != 'complete':
    parser.error('adapter verification requires natural completion')
if os.geteuid() != 0 or not Path('/proc/self/status').is_file():
    parser.error('a dedicated root-operated Linux fixture is required')
fixture.require_ports('core', 'gateway', 'catalog', 'bridge')
if fixture.ports['bridge'] != 18080:
    parser.error('the current contained CLI requires explicit bridge port 18080')
admin = local_url(fixture.admin_url())
values = fixture.runtime_values()
binary = fixture.binary
for name in ['core', 'gateway', 'cli', 'runtime', 'bridge', 'guard', 'migrate', 'resources', 'resource-migrate', 'storage']:
    if not (binary / ('ouroboros-' + name)).is_file():
        parser.error('a required product binary is absent from bin_dir')
root = fixture.create_root(mode=0o755)
root.chmod(0o755)
ipc = fixture.create_ipc_root()
ipc.chmod(0o755)
(ipc / 'gateway').mkdir(mode=0o711)
(ipc / 'gateway').chmod(0o711)
os.chown(ipc / 'gateway', 70002, 70002)
environment = clean_environment()
processes, databases, roles, guards = {}, [], [], {}
runtime = None
container = None
result = None
checks = []
work = None
lifetime = 90
profile_id = 'artifact-program'
target = 'company-files'
file_bound = 524288
profile = {'image': values['image'], 'memory_bytes': 268435456, 'nano_cpus': 500000000,
           'pids_limit': 64, 'lifetime_seconds': lifetime, 'compute_units': 20,
           'workspace_bytes': 16777216, 'home_bytes': 4194304, 'temporary_bytes': 4194304,
           'max_input_files': 4, 'max_input_bytes': 1048576, 'max_file_bytes': file_bound,
           'max_output_bytes': 65536}


def drop(uid):
    def apply():
        os.setgroups([])
        os.setgid(uid)
        os.setuid(uid)
        if ctypes.CDLL(None, use_errno=True).prctl(38, 1, 0, 0, 0) != 0:
            raise OSError('fixture could not prohibit service privilege gain')
    return apply


def write(path, content, uid=0, mode=0o600):
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content)
    path.chmod(mode)
    os.chown(path, uid, uid)


def command(argv, *, data=None, uid=None, timeout=15):
    if argv[0] == 'docker':
        argv = fixture.docker(*argv[1:])
    return subprocess.run(argv, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          env=environment, timeout=timeout, preexec_fn=drop(uid) if uid is not None else None)


def run(argv, **kwargs):
    observed = command(argv, **kwargs)
    if observed.returncode:
        # Persist no raw protocol/credential output. Relevant product evidence is stored separately.
        raise RuntimeError('fixture command failed: ' + Path(argv[0]).name)
    return observed.stdout


def sql(statement, database=None):
    return fixture.sql(statement, database)


def database_url(user, password, database):
    host = '[' + admin.hostname + ']' if ':' in admin.hostname else admin.hostname
    return f'postgresql://{user}:{password}@{host}:{admin.port}/{database}?sslmode=disable\n'


def tls(service, name, uid):
    for source in [name + '.pem', name + '.key', 'ca.pem']:
        write(root / service / source, (root / 'ca' / source).read_text(), uid)
    return {'certificate': str(root / service / (name + '.pem')),
            'private_key': str(root / service / (name + '.key')), 'ca': str(root / service / 'ca.pem')}


def cli(*arguments, body=None, expected=200, binary_output=False, client="cli"):
    client_uid = 70003 if client == "cli" else 70004
    path = None
    if body is not None:
        path = root / client / ('request-' + uuid.uuid4().hex + '.json')
        write(path, json.dumps(body), client_uid)
        arguments = (*arguments, '--input', str(path))
    try:
        observed = command([str(binary / 'ouroboros-cli'), '--config', str(root / client / 'config.json'), *arguments], uid=client_uid)
    finally:
        if path is not None:
            path.unlink()
    statuses = re.findall(rb'HTTP ([0-9]{3})', observed.stderr)
    if statuses:
        assert int(statuses[-1]) == expected and (observed.returncode == 0) == (200 <= expected < 300), (
            'unexpected CLI result', expected, int(statuses[-1]))
    else:
        # Generic request prints exact statuses only on failure. Its success path establishes
        # a 2xx response, not its precise code. Actual receipt/state/hash checks below establish
        # completion; the test makes no exact successful resource-status observation claim.
        assert arguments[0] == 'request' and expected < 300 and observed.returncode == 0, (
            'CLI process failure is not an HTTP policy observation', expected)
    if expected >= 300:
        return None
    return observed.stdout if binary_output else json.loads(observed.stdout)


def scoped(method, path, *, body=None, key=None, expected=200, input_path=None, output=None):
    arguments = ['request', method, path, '--work', work, '--delegation', grant, '--target', target]
    if key:
        arguments += ['--key', key]
    if input_path is not None:
        arguments += ['--input', str(input_path), '--max-bytes', str(file_bound)]
    if output is not None:
        arguments += ['--output', str(output), '--max-bytes', str(file_bound)]
    return cli(*arguments, body=body, expected=expected, binary_output=output is not None)


def private_conditions(expected):
    # Trusted observer; this command supplies no credential, identity header or private input.
    observed = command(['docker', 'exec', '--user', '65532:65532', container,
                        '/usr/local/bin/ouroboros-cli', '--instance', 'conditions'], timeout=5)
    statuses = re.findall(rb'HTTP ([0-9]{3})', observed.stderr)
    assert statuses and int(statuses[-1]) == expected, 'missing exact private Gateway result'
    assert (observed.returncode == 0) == (200 <= expected < 300)
    return json.loads(observed.stdout) if expected < 300 else None


def process_identity(pid):
    try:
        fields = (Path('/proc') / str(pid) / 'stat').read_text().rpartition(')')[2].split()
        return {'start_ticks': int(fields[19]), 'state': fields[0]}
    except FileNotFoundError:
        return None


def capture_guards():
    if runtime is None:
        return
    for path in (Path('/proc') / str(runtime.pid) / 'task').glob('*/children'):
        try:
            children = [int(value) for value in path.read_text().split()]
        except FileNotFoundError:
            continue
        for pid in children:
            proc = Path('/proc') / str(pid)
            try:
                if os.readlink(proc / 'exe') != str(binary / 'ouroboros-guard'):
                    continue
                identity = process_identity(pid)
                argv = (proc / 'cmdline').read_bytes().split(b'\0')
                if identity is None or len(argv) != 4:
                    continue
                assert os.readlink(proc / 'fd' / argv[1].decode()).endswith('/cgroup.kill')
                guards[(pid, identity['start_ticks'])] = {'pid': pid, 'start_ticks': identity['start_ticks'],
                    'deadline_boottime_ns': int(argv[2])}
            except FileNotFoundError:
                continue


def wait_until(check, seconds, description):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        capture_guards()
        value = check()
        if value:
            return value
        time.sleep(.05)
    raise RuntimeError('bounded observation failed: ' + description)


def snapshot():
    groups = {'core': ['compute_returns', 'executions', 'execution_programs', 'execution_inputs', 'runtime_instances',
                       'intents', 'resource_calls', 'reservations', 'storage_budgets', 'storage_allocations', 'attempts'],
              'catalog': ['uploads', 'workspace_snapshots', 'publication_receipts', 'revision_object_holds']}
    return {name: {table: json.loads(sql(f"SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM {table} t WHERE firm_id='{firm}'", dbs[name]))
                   for table in tables} for name, tables in groups.items()}


try:
    owners = [('reviewer', 70004), ('core', 70001), ('gateway', 70002), ('cli', 70003), ('catalog', 70005), ('runtime', 0), ('ca', 0)]
    for name, uid in owners:
        (root / name).mkdir(mode=0o700)
        os.chown(root / name, uid, uid)
    run(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', str(root / 'ca/ca.key')])
    run(['openssl', 'req', '-x509', '-new', '-key', str(root / 'ca/ca.key'), '-subj',
         '/CN=Ouroboros disposable program fixture', '-days', '1', '-addext',
         'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', str(root / 'ca/ca.pem')])
    write(root / 'ca/cert.ext', fixture.cert_extensions())
    fingerprints = {}
    for name in ['core', 'gateway', 'gateway-service', 'catalog', 'runtime', 'human', 'reviewer']:
        key, csr, cert = [root / 'ca' / (name + '.' + suffix) for suffix in ['key', 'csr', 'pem']]
        run(['openssl', 'genpkey', '-algorithm', 'ED25519', '-out', str(key)])
        run(['openssl', 'req', '-new', '-key', str(key), '-subj', '/CN=' + name, '-out', str(csr)])
        run(['openssl', 'x509', '-req', '-in', str(csr), '-CA', str(root / 'ca/ca.pem'), '-CAkey',
             str(root / 'ca/ca.key'), '-CAcreateserial', '-days', '1', '-extfile', str(root / 'ca/cert.ext'), '-out', str(cert)])
        fingerprints[name] = hashlib.sha256(run(['openssl', 'x509', '-in', str(cert), '-outform', 'DER'])).hexdigest()
    dbs = {}
    for name, uid in [('core', 70001), ('catalog', 70005)]:
        database = 'ouro_program_' + name + '_' + secrets.token_hex(6)
        owner_password = secrets.token_hex(24)
        sql(f"CREATE ROLE {database} LOGIN PASSWORD '{owner_password}';")
        roles.append(database)
        sql(f'CREATE DATABASE {database} OWNER {database};')
        databases.append(database)
        dbs[name] = database
        migration = root / 'runtime' / (name + '-migrate.url')
        write(migration, database_url(database, owner_password, database))
        argv = [str(binary / ('ouroboros-migrate' if name == 'core' else 'ouroboros-resource-migrate')),
                '--database-url-file', str(migration)]
        if name == 'catalog':
            argv += ['--role', 'catalog']
        run(argv)
        role, password = 'ouro_program_service_' + secrets.token_hex(6), secrets.token_hex(24)
        sql(f"CREATE ROLE {role} LOGIN PASSWORD '{password}';")
        roles.append(role)
        sql(f'GRANT CONNECT ON DATABASE {database} TO {role}; GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {role};', database)
        write(root / name / 'db.url', database_url(role, password, database), uid)
        if name == 'catalog':
            catalog_role = role
    firm, human, agent, grant, child, namespace, store, generation, policy_id = [str(uuid.uuid4()) for _ in range(9)]
    actions = ['inspect', 'work.create', 'execution.start', 'execution.stop', 'delegation.revoke',
               'workspace.create', 'file.read', 'file.upload', 'file.publish', 'file.retire']
    agent_actions = ['inspect', 'execution.start', 'file.read', 'file.upload', 'file.publish']
    if args.adapter_verification:
        actions += ['adapter.submit','adapter.verify','adapter.evaluate','adapter.accept','adapter.activate','adapter.invoke','adapter.stop']
        agent_actions += ['workspace.create']
    sql(f"""INSERT INTO firms(id) VALUES('{firm}');
INSERT INTO principals VALUES('{firm}','{human}','human',true),('{firm}','{agent}','agent',true);
INSERT INTO credentials VALUES('{fingerprints['human']}','{firm}','{human}',true,clock_timestamp()+interval '1 hour');
INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES
('{firm}','{grant}','{human}',NULL,ARRAY[{','.join(repr(value) for value in actions)}],clock_timestamp()+interval '1 hour'),
('{firm}','{child}','{agent}','{grant}',ARRAY[{','.join(repr(value) for value in agent_actions)}],clock_timestamp()+interval '1 hour');
INSERT INTO limits VALUES('{firm}','compute',100,0),('{firm}','resource_calls',40,0);
INSERT INTO profiles VALUES('{firm}','{profile_id}',true,20,{lifetime});
INSERT INTO program_profiles(firm_id,profile_id,profile,active) VALUES('{firm}','{profile_id}','{json.dumps(profile)}',true);
INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES('{firm}','{store}','{generation}',2097152);
""", dbs['core'])
    external_artifact_parent = fixture.existing_storage_root()
    artifact_parent = external_artifact_parent or (root / 'catalog')
    if external_artifact_parent is not None:
        # This explicitly supplied parent was verified empty, private and fixture-owned.
        # Give its sole Catalog owner traversal without exposing the backing store to peers.
        os.chown(external_artifact_parent, 70005, 70005)
    artifact = artifact_parent / 'program-blobs'
    artifact.mkdir(mode=0o700)
    os.chown(artifact, 70005, 70005)
    binding = root / 'catalog/storage.json'
    write(root / 'catalog/prepare.json', json.dumps({'root': str(artifact), 'binding_file': str(binding),
          'owner_uid': 70005, 'firm_id': firm, 'store_id': store, 'generation': generation}), 70005)
    run([str(binary / 'ouroboros-storage'), 'prepare', '--config', str(root / 'catalog/prepare.json')], uid=70005)
    sql(f"REVOKE INSERT,UPDATE ON storage_binding FROM {catalog_role}; GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {catalog_role}; INSERT INTO storage_binding VALUES(true,'{firm}','{store}','{generation}');", dbs['catalog'])
    policy = {'id': policy_id, 'revision': 1, 'min_retention_seconds': 0, 'allowed': ['revision']}
    resource_config = {'namespace_id': namespace, 'store_id': store, 'storage_generation': generation,
                       'max_file_bytes': file_bound, 'transfer_seconds': 60, 'retirement_policy': policy}
    sql(f"INSERT INTO resource_targets VALUES('{firm}','{target}','{fingerprints['catalog']}',true,'{json.dumps(resource_config)}',2097152); INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES('{firm}','{namespace}','{target}','{store}','{generation}',{5 if args.adapter_verification else 2});", dbs['core'])
    gateway_socket = ipc / 'gateway/instance.sock'
    write(root / 'core/config.json', json.dumps({'listen': fixture.endpoint('core'), 'tls': tls('core', 'core', 70001),
          'database_url_file': str(root / 'core/db.url'), 'firm_id': firm,
          'gateway_fingerprint': fingerprints['gateway-service'], 'runtime_fingerprint': fingerprints['runtime']}), 70001)
    write(root / 'gateway/config.json', json.dumps({'listen': fixture.endpoint('gateway'), 'tls': tls('gateway', 'gateway', 70002),
          'core_url': fixture.url('core'), 'core_client': tls('gateway', 'gateway-service', 70002),
          'instance_socket': str(gateway_socket), 'workers': {target: fixture.url('catalog')}}), 70002)
    write(root / 'catalog/config.json', json.dumps({'listen': fixture.endpoint('catalog'), 'tls': tls('catalog', 'catalog', 70005),
          'core_url': fixture.url('core'), 'core_client': tls('catalog', 'catalog', 70005),
          'database_url_file': str(root / 'catalog/db.url'), 'gateway_fingerprint': fingerprints['gateway-service'],
          'role': 'catalog', 'storage_binding_file': str(binding)}), 70005)
    write(root / 'cli/config.json', json.dumps({'gateway_url': fixture.url('gateway'), 'tls': tls('cli', 'human', 70003)}), 70003)
    runtime_profile = {key: profile[key] for key in ['image', 'memory_bytes', 'nano_cpus', 'pids_limit', 'lifetime_seconds']}
    runtime_profile['docker_socket'] = str(values['docker_socket'])
    write(root / 'runtime/config.json', json.dumps({'core_url': fixture.url('core'), 'tls': tls('runtime', 'runtime', 0),
          'profile_id': profile_id, 'profile': runtime_profile, 'program': profile, 'gateway_socket': str(gateway_socket),
          'binary_dir': str(binary), 'evidence_dir': str(root / 'runtime'), 'bridge_uid': values['bridge_uid'],
          'guard_uid': values['guard_uid'], 'gateway_uid': 70002, 'ipc_root': str(ipc)}))
    service_identities = []
    for name, uid in [('core', 70001), ('catalog', 70005), ('gateway', 70002)]:
        with (root / name / 'process.log').open('xb') as stream:
            os.chmod(stream.name, 0o600)
            executable = 'ouroboros-resources' if name == 'catalog' else 'ouroboros-' + name
            proc = subprocess.Popen([str(binary / executable), '--config', str(root / name / 'config.json')],
                                    stdout=stream, stderr=stream, env=environment, preexec_fn=drop(uid))
        processes[name] = proc
        status = dict(line.split(':', 1) for line in (Path('/proc') / str(proc.pid) / 'status').read_text().splitlines() if ':' in line)
        assert [int(value) for value in status['Uid'].split()] == [uid] * 4
        assert not status['Groups'].strip() and int(status['CapEff'].strip(), 16) == 0 and status['NoNewPrivs'].strip() == '1'
        service_identities.append({'name': name, 'pid': proc.pid, 'uid': uid, 'groups': [], 'effective_capabilities': 0, 'no_new_privileges': True})
    # Read-only OS probes use the same dropped identities as the real services. They output
    # only denial, never key contents; Runtime's Docker capability is not shared with them.
    credentials = {'core': root / 'core/core.key', 'gateway': root / 'gateway/gateway-service.key',
                   'catalog': root / 'catalog/catalog.key', 'cli': root / 'cli/human.key',
                   'runtime': root / 'runtime/runtime.key'}
    credential_probe = '''import errno,json,socket,sys
from pathlib import Path
assert Path(sys.argv[1]).read_bytes()
for other in json.loads(sys.argv[2]):
 try: Path(other).read_bytes()
 except PermissionError as error: assert error.errno in (errno.EACCES,errno.EPERM)
 else: raise AssertionError('peer credential readable')
with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as connection:
 try: connection.connect(sys.argv[3])
 except PermissionError as error: assert error.errno in (errno.EACCES,errno.EPERM)
 else: raise AssertionError('Docker capability shared with ordinary service')
print('denied')
'''
    credential_boundaries = []
    for name, uid in [('core', 70001), ('gateway', 70002), ('catalog', 70005), ('cli', 70003)]:
        peers = [str(path) for owner, path in credentials.items() if owner != name]
        assert run(['python3', '-c', credential_probe, str(credentials[name]), json.dumps(peers),
                    str(values['docker_socket'])], uid=uid).strip() == b'denied'
        credential_boundaries.append({'service': name, 'uid': uid, 'peer_credentials_denied': len(peers), 'docker_socket': 'denied'})
    checks.append('actual service UIDs have no supplementary groups/capabilities; read-only identity probes deny peer credentials and Docker socket access')
    # CLI uses its own certificate; setup root retains no authority channel visible to private code.
    def ready():
        observed = command([str(binary / 'ouroboros-cli'), '--config', str(root / 'cli/config.json'), 'conditions'], uid=70003, timeout=3)
        return observed.returncode == 0
    wait_until(ready, 8, 'Gateway readiness')
    work = cli('work', '--key', 'program-work', body={'delegation_id': grant, 'purpose': 'Artifact-backed contained program fixture'})['resource_id']
    for delegation, permitted in [(grant, ['inspect', 'workspace.create', 'file.read', 'file.upload', 'file.publish', 'file.retire']),
                                 (child, ['inspect', 'file.read', 'file.upload', 'file.publish'] + (['workspace.create'] if args.adapter_verification else []))]:
        sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{firm}','{work}','{delegation}','{target}',ARRAY[{','.join(repr(value) for value in permitted)}],'{namespace}');", dbs['core'])
    input_workspace = scoped('POST', '/workspaces', body={'label': 'Program inputs'}, key='program-input-workspace')['workspace_id']
    output_workspace = scoped('POST', '/workspaces', body={'label': 'Program outputs'}, key='program-output-workspace')['workspace_id']
    data = bytes(range(256)) * 768 + b'\x00\xffprogram-input'
    output_data = b'Ouroboros generated output\n' + data
    script = '''set -eu
cd /workspace
test "$(id -u)" = 65532
test "$(ls /sys/class/net)" = lo
test ! -e /var/run/docker.sock
test ! -e /run/docker.sock
printf 'Ouroboros generated output\\n' > output.bin
cat inputs/data.bin >> output.bin
if [ "$1" -gt 0 ]; then cmp output.bin checkpoint/output.bin; fi
c() { /usr/local/bin/ouroboros-cli --instance request "$@" --target company-files; }
sha=$(sha256sum output.bin); sha=${sha%% *}
size=$(wc -c < output.bin); size=$(printf '%s' "$size" | tr -d ' ')
printf '{"sha256":"%s","size":%s}' "$sha" "$size" > upload.json
upload=$(c POST /uploads --input upload.json --key program-output-upload-$1 --select /upload_id)
c PUT /uploads/$upload/content --input output.bin --max-bytes 524288
printf '{"workspace_id":"OUTPUT_WORKSPACE","expected_revision":%s,"files":{"output.bin":"%s"}}' "$1" "$upload" > publish.json
c POST /publications --input publish.json --key program-output-publication-$1
printf 'OUROBOROS_PROGRAM_OUTPUT_PUBLISHED\\n'
: > /workspace/program-ready
/bin/sleep 90
'''.replace('OUTPUT_WORKSPACE', output_workspace).encode()
    if args.adapter_verification:
        # A deliberate new invocation is new work, with stable keys inside that invocation.
        script=script.replace(b'set -eu\n',b'set -eu\nnonce=$(cat /proc/sys/kernel/random/uuid)\n')
        script=script.replace(b'program-output-upload-$1',b'program-output-upload-$nonce').replace(b'program-output-publication-$1',b'program-output-publication-$nonce')
        script=script.replace(b'sha=$(sha256sum output.bin)', b"printf '{\"label\":\"Adapter result\"}' > workspace.json\nresult_workspace=$(c POST /workspaces --input workspace.json --key adapter-result-space-$nonce --select /workspace_id)\nsha=$(sha256sum output.bin)")
        script=script.replace(output_workspace.encode(),b'%s').replace(b"\"}}' \"$1\" \"$upload\"", b"\"}}' \"$result_workspace\" \"$1\" \"$upload\"")
    if args.restriction == 'complete':
        # The admitted program itself reports the files it actually read before natural exit.
        # Runtime captures the complete output and independently reports the actual exit code.
        completion_tail = b'''for input in code/program.sh inputs/data.bin; do
  actual=$(sha256sum "$input"); actual=${actual%% *}
  printf 'OUROBOROS_PROGRAM_INPUT_SHA256 %s %s\\n' "$input" "$actual"
done
exit 0
'''
        assert script.count(b'/bin/sleep 90\n') == 1
        script = script.replace(b'/bin/sleep 90\n', completion_tail)
    uploads = []
    for index, (filename, content) in enumerate([('program.sh', script), ('data.bin', data)]):
        path = root / 'cli' / filename
        write(path, content, 70003)
        sha = hashlib.sha256(content).hexdigest()
        accepted_upload = scoped('POST', '/uploads', body={'sha256': sha, 'size': len(content)}, key='program-input-' + str(index), expected=202)
        identity = accepted_upload['upload_id']
        reply = scoped('PUT', '/uploads/' + identity + '/content', input_path=path)
        assert reply['upload_id'] == identity and reply['sha256'] == sha
        uploads.append({'upload_id': identity, 'sha256': sha, 'size': len(content), 'object_id': reply['object_id']})
    input_publication = scoped('POST', '/publications', body={'workspace_id': input_workspace, 'expected_revision': 0,
        'files': {'program.sh': uploads[0]['upload_id'], 'data.bin': uploads[1]['upload_id']}}, key='program-input-publication')
    assert input_publication['revision'] == 1
    # A different live head makes revision 1 ordinarily retireable; a head restriction cannot
    # accidentally masquerade as retained execution-input enforcement in this test.
    scoped('POST', '/publications', body={'workspace_id': input_workspace, 'expected_revision': 1, 'files': {}}, key='program-input-new-head')
    program = {'argv': ['/bin/sh', '/workspace/code/program.sh', '0'], 'inputs': [
        {'target': target, 'workspace_id': input_workspace, 'revision': 1, 'file': 'program.sh', 'destination': 'code/program.sh'},
        {'target': target, 'workspace_id': input_workspace, 'revision': 1, 'file': 'data.bin', 'destination': 'inputs/data.bin'}]}
    execution_request = {'work_id': work, 'delegation_id': grant, 'agent_delegation_id': child,
        'profile_id': profile_id, 'units': profile['compute_units'], 'lifetime_seconds': lifetime,
        'predecessor_execution_id': None, 'program': program}
    accepted = cli('start', '--key', 'program-start', body=execution_request, expected=202)
    execution = accepted['resource_id']
    retained = json.loads(sql(f"SELECT jsonb_agg(to_jsonb(t) ORDER BY input_index) FROM execution_inputs t WHERE execution_id='{execution}'", dbs['core']))
    assert len(retained) == 2 and all(item['retained'] for item in retained)
    for index, item in enumerate(retained):
        resolved = item['resolved']
        assert resolved['reference'] == program['inputs'][index] and resolved['upload_id'] == uploads[index]['upload_id']
        assert all(resolved[key] == uploads[index][key] for key in ['object_id', 'sha256', 'size'])
    retirement = {'target': {'kind': 'revision', 'workspace_id': input_workspace, 'revision': 1},
                  'reason': 'Cannot retire an admitted program input', 'policy_id': policy_id, 'policy_revision': 1}
    before = snapshot()
    scoped('POST', '/retirements', body=retirement, key='program-retained-input', expected=409)
    assert snapshot() == before, 'denied input retirement changed authority or records'
    checks.append('human CLI publishes exact code and non-UTF8 data; admission retains resolved object identities; non-head input retirement is denied')
    materialization_pause_started = time.monotonic()
    os.kill(processes['catalog'].pid, signal.SIGSTOP)
    try:
        wait_until(lambda: process_identity(processes['catalog'].pid)['state'] == 'T', 2, 'Catalog pause')
        with (root / 'runtime/process.log').open('xb') as stream:
            os.chmod(stream.name, 0o600)
            runtime = subprocess.Popen([str(binary / 'ouroboros-runtime'), '--config', str(root / 'runtime/config.json')],
                                       stdout=stream, stderr=stream, env=environment)
        def materializing():
            row = sql(f"SELECT jsonb_build_object('instance_id',instance_id,'generation',generation,'phase',phase,'binding',binding) FROM runtime_instances WHERE execution_id='{execution}'", dbs['core'])
            if not row:
                assert runtime.poll() is None, 'Runtime ended before materialization'
                return None
            value = json.loads(row)
            return value if value['phase'] == 'materializing' else None
        preparing = wait_until(materializing, 8, 'actual materializing instance')
        container = preparing['binding']['container_id']
        if args.restriction == 'complete':
            # The guard is already armed; capture it while paused input delivery guarantees
            # Runtime is still its parent. A naturally exited Runtime cannot be searched later.
            capture_guards()
            assert any(item['deadline_boottime_ns'] == preparing['binding']['deadline_boottime_ns'] for item in guards.values())
        private_conditions(403)
        marker = command(['docker', 'exec', '--user', '65532:65532', container, '/bin/sh', '-c', 'test ! -e /workspace/program-ready'], timeout=3)
        assert marker.returncode == 0
        assert sql(f"SELECT count(*) FROM resource_calls WHERE firm_id='{firm}' AND instance_id='{preparing['instance_id']}' AND operation IN ('file.upload','file.publish')", dbs['core']) == '0'
        assert time.monotonic() - materialization_pause_started < 12, 'Catalog stall exceeded its finite fixture window'
        checks.append('paused Catalog makes materialization observable; ordinary instance requests return 403 and private output work has not started before release')
    finally:
        os.kill(processes['catalog'].pid, signal.SIGCONT)
    evidence = root / 'runtime' / preparing['instance_id']
    def output_ready():
        if args.restriction != 'complete':
            assert runtime.poll() is None, 'Runtime ended before the program published output'
        value = sql(f"SELECT intent_id FROM resource_calls WHERE firm_id='{firm}' AND work_id='{work}' AND instance_id='{preparing['instance_id']}' AND operation='file.publish' AND reply IS NOT NULL", dbs['core'])
        if not value:
            assert runtime.poll() is None, 'Runtime ended without the program publication receipt'
        return value or None
    publication_id = wait_until(output_ready, 20, 'real private publication')
    natural_terminated_at = None
    if args.restriction == 'complete':
        assert runtime.wait(timeout=8) == 0, 'Runtime did not finish the natural-exit path successfully'
        natural_terminated_at = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
    else:
        current = private_conditions(200)
        assert current['principal_id'] == agent and current['work_id'] == work
    materialization = json.loads((evidence / 'materialization.json').read_text())
    program_start = json.loads((evidence / 'program-start.json').read_text())
    assert program_start['instance_id'] == preparing['instance_id'] and program_start['generation'] == preparing['generation']
    assert program_start['source'] == 'runtime_backend' and program_start['exec_id']
    program_result = None
    if args.restriction == 'complete':
        program_result = json.loads((evidence / 'program-result.json').read_text())
        assert program_result['source'] == 'runtime_backend' and program_result['exec_id'] == program_start['exec_id']
        assert program_result['instance_id'] == preparing['instance_id'] and program_result['generation'] == preparing['generation']
        assert program_result['exit_code'] == 0 and program_result['program_succeeded'] is True
        assert program_result['output_complete'] is True and program_result['effects_settled'] is False
        assert program_result['output_source'] == 'private_program'
        stdout = (evidence / 'program-stdout.bin').read_bytes()
        stderr = (evidence / 'program-stderr.bin').read_bytes()
        assert program_result['stdout_bytes'] == len(stdout) and program_result['stderr_bytes'] == len(stderr)
        assert len(stdout) + len(stderr) <= profile['max_output_bytes']
        reported_hashes = re.findall(rb'^OUROBOROS_PROGRAM_INPUT_SHA256 (code/program.sh|inputs/data.bin) ([0-9a-f]{64})$', stdout, re.MULTILINE)
        assert reported_hashes == [(b'code/program.sh', uploads[0]['sha256'].encode()),
                                   (b'inputs/data.bin', uploads[1]['sha256'].encode())]
        assert stdout.count(b'OUROBOROS_PROGRAM_OUTPUT_PUBLISHED\n') == 1
    else:
        for path, expected in [('code/program.sh', uploads[0]['sha256']), ('inputs/data.bin', uploads[1]['sha256'])]:
            # Observer reads only: no Docker copy, mount, command injection into the input, or host materialization.
            observed_hash = run(['docker', 'exec', '--user', '65532:65532', container, 'sha256sum', '/workspace/' + path]).split()[0].decode()
            assert observed_hash == expected, 'actual private input differs from its protected receipt'
    recorded_program = json.loads(sql(f"SELECT to_jsonb(t) FROM execution_programs t WHERE execution_id='{execution}'", dbs['core']))
    assert recorded_program['profile'] == profile and recorded_program['request'] == program
    expected_files = [{'index': index, 'sha256': item['sha256'], 'size': item['size']} for index, item in enumerate(uploads)]
    assert materialization == {'instance_id': preparing['instance_id'], 'generation': preparing['generation'],
        'manifest_digest': recorded_program['manifest_digest'], 'files': expected_files}
    assert recorded_program['materialization'] == materialization
    final_inputs = json.loads(sql(f"SELECT jsonb_agg(to_jsonb(t) ORDER BY input_index) FROM execution_inputs t WHERE execution_id='{execution}'", dbs['core']))
    assert all(item['retained'] and item['read_intent_id'] and item['read_instance_id'] == preparing['instance_id']
               and item['read_generation'] == preparing['generation'] for item in final_inputs)
    for index, item in enumerate(final_inputs):
        reply = scoped('GET', '/resource-intents/' + item['read_intent_id'])
        assert reply['state'] == 'succeeded' and reply['reply']['body'] == ''
        assert reply['reply']['receipt']['sha256'] == uploads[index]['sha256'] and reply['reply']['receipt']['size'] == uploads[index]['size']
    if args.adapter_verification:
        output_workspace=sql(f"SELECT input->'input'->>'workspace_id' FROM intents WHERE id='{publication_id}'",dbs['core'])
    output_path = root / 'cli/output.bin'
    assert scoped('GET', f'/workspaces/{output_workspace}/snapshots/1/files/output.bin', output=output_path) == b''
    assert output_path.read_bytes() == output_data
    published = scoped('GET', '/resource-intents/' + publication_id)
    assert published['state'] == 'succeeded'
    private_effects = json.loads(sql(f"SELECT jsonb_agg(jsonb_build_object('intent_id',intent_id,'operation',operation,'instance_id',instance_id,'reply',reply)) FROM resource_calls WHERE firm_id='{firm}' AND work_id='{work}' AND instance_id='{preparing['instance_id']}' AND operation IN ('file.upload','file.publish')", dbs['core']))
    assert sorted(item['operation'] for item in private_effects) == ['file.publish', 'file.upload']
    assert all(item['reply'] is not None for item in private_effects)
    assert sql(f"SELECT count(*) FROM resource_calls WHERE firm_id='{firm}' AND operation IN ('model.responses','mcp','db.read','db.write')", dbs['core']) == '0'
    detail = json.loads(run(['docker', 'inspect', container]))[0]
    assert detail['State']['Running'] == (args.restriction != 'complete')
    assert detail['Config']['User'] == '65532:65532'
    assert detail['HostConfig']['NetworkMode'] == 'none' and detail['HostConfig']['ReadonlyRootfs']
    assert detail['HostConfig']['CapDrop'] == ['ALL'] and not detail['HostConfig']['Privileged']
    assert 'no-new-privileges:true' in detail['HostConfig']['SecurityOpt']
    assert all(item['Type'] == 'tmpfs' and item['Destination'] in ['/workspace', '/home/agent', '/tmp'] for item in detail['Mounts'])
    assert set(detail['HostConfig']['Tmpfs']) == {'/workspace', '/home/agent', '/tmp'}
    checks.append('contained materializer hashes exact inputs; real released shell program generates binary output and its instance CLI uploads/publishes through Gateway; human CLI downloads exact output')
    capture_guards()
    runtime_binding = json.loads((evidence / 'binding.json').read_text())
    assert any(item['deadline_boottime_ns'] == runtime_binding['deadline_boottime_ns'] for item in guards.values())
    if args.restriction == 'complete':
        terminated_at = natural_terminated_at
        assert terminated_at is not None and terminated_at < runtime_binding['deadline_boottime_ns'], 'guard expiry cannot substitute for natural program completion'
        assert sql(f"SELECT count(*) FROM intents WHERE firm_id='{firm}' AND operation IN ('execution.stop','delegation.revoke')", dbs['core']) == '0'
        assert sql(f"SELECT stopped FROM executions WHERE firm_id='{firm}' AND id='{execution}'", dbs['core']) == 'f'
        assert sql(f"SELECT revoked FROM delegations WHERE firm_id='{firm}' AND id='{child}'", dbs['core']) == 'f'
        restriction_result = {'kind': 'complete', 'control_request': False,
            'stop_or_revoke_records': 0, 'terminated_at_boottime_ns': terminated_at,
            'deadline_boottime_ns': runtime_binding['deadline_boottime_ns']}
    else:
        os.kill(runtime.pid, signal.SIGSTOP)
        try:
            wait_until(lambda: process_identity(runtime.pid)['state'] == 'T', 2, 'Runtime pause')
            private_conditions(200)
            now = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
            assert runtime_binding['deadline_boottime_ns'] - now >= 15_000_000_000
            revision = str(cli('conditions')['revision'])
            restriction_target = execution if args.restriction == 'stop' else child
            cli(args.restriction, restriction_target, '--revision', revision, '--key', 'program-restriction', expected=202)
            private_conditions(403)
            assert json.loads(run(['docker', 'inspect', container]))[0]['State']['Running']
            restricted_at = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        finally:
            os.kill(runtime.pid, signal.SIGCONT)
        runtime.wait(timeout=8)
        terminated_at = time.clock_gettime_ns(time.CLOCK_BOOTTIME)
        assert terminated_at < runtime_binding['deadline_boottime_ns'], 'deadline expiry cannot prove explicit restriction'
        restriction_result = {'kind': args.restriction, 'before': 200, 'after': 403,
            'container_still_running_when_denied': True, 'restricted_at_boottime_ns': restricted_at,
            'terminated_at_boottime_ns': terminated_at, 'deadline_boottime_ns': runtime_binding['deadline_boottime_ns']}
    state = cli('get', 'executions', execution)
    if args.restriction == 'complete':
        observation=json.loads((evidence/'program-observation.json').read_text())
        assert state['program_observation']['receipt']==observation
        assert state['program_observation']['work_success_confirmed'] is False
        assert observation['stdout_sha256']==hashlib.sha256((evidence/'program-stdout.bin').read_bytes()).hexdigest()
        assert observation['stderr_sha256']==hashlib.sha256((evidence/'program-stderr.bin').read_bytes()).hexdigest()

    finish = json.loads((evidence / 'finish.json').read_text())
    assert state['terminated'] and finish['terminated_observed'] and not finish['effects_settled']
    assert state['compute_return']['units'] == 20
    returned = json.loads((evidence / 'compute-return.json').read_text())
    observation = json.loads((evidence / 'allocation-observation.json').read_text())
    assert returned['binding'] == runtime_binding
    assert returned['binding']['allocation'] == observation['cgroup']
    assert returned['container_terminated'] and returned['bridge_terminated'] and returned['guard_terminated']
    assert observation['guard_terminated'] and observation['state'] in ['empty', 'deactivated']
    assert all(process_identity(g['pid']) is None for g in guards.values()), 'owned guards must be gone before return'
    assert sql(f"SELECT count(*) FROM compute_returns WHERE execution_id='{execution}'", dbs['core']) == '1'
    assert state['state'] != 'succeeded'

    if args.restriction == 'complete':
        assert finish['runtime_success'] is True
    assert not json.loads(run(['docker', 'inspect', container]))[0]['State']['Running']
    assert sql(f"SELECT committed FROM limits WHERE firm_id='{firm}' AND id='compute'", dbs['core']) == '0'
    assert sql(f"SELECT count(*) FROM execution_inputs WHERE execution_id='{execution}' AND retained", dbs['core']) == '2'
    # Lose only the local acceptance marker; retry must use the exact persisted request.
    before_return_retry = snapshot()
    (evidence / 'compute-return-accepted.json').unlink()
    run([str(binary / 'ouroboros-runtime'), '--config', str(root / 'runtime/config.json'), '--reconcile', preparing['instance_id']], timeout=15)
    assert json.loads((evidence / 'compute-return-accepted.json').read_text())['capacity_returned']
    assert snapshot() == before_return_retry, 'reconciliation duplicated accounting or altered prior effects'
    run([str(binary / 'ouroboros-runtime'), '--config', str(root / 'runtime/config.json'), '--reconcile', preparing['instance_id']], timeout=15)
    assert snapshot() == before_return_retry, 'ordinary repeated reconciliation changed accounting'

    checks.append('replacement Runtime replays saved return after local acknowledgement loss without a second capacity decrement')
    before = snapshot()
    scoped('POST', '/retirements', body=retirement, key='program-terminated-input', expected=409)
    assert scoped('POST', '/resource-intents/' + publication_id + '/reconcile') == json.loads(published['reply']['body'])
    assert snapshot() == before, 'post-termination observation or denied retirement changed effects or dependency holds'
    if args.restriction == 'complete':
        checks.append('program exits zero after publication without stop/revoke; backend reports complete bounded stdout/stderr and actual termination before deadline; compute returns once while input dependencies and work outcome remain unresolved')
    else:
        checks.append('current Gateway restriction applies while paused Runtime container is still running; actual termination precedes original guard deadline; compute returns once while input dependencies and work outcome remain unresolved')
    successor_result = None
    if args.restriction == 'complete':
        if args.adapter_verification:
            reviewer, reviewer_grant, verifier, verifier_grant = [str(uuid.uuid4()) for _ in range(4)]
            sql(f"INSERT INTO resource_targets VALUES('{firm}','adapter-tools','unbound-adapter',true,'{{}}',4096); INSERT INTO resource_scopes VALUES('{firm}','{work}','{grant}','adapter-tools',ARRAY['inspect','adapter.submit','adapter.verify','adapter.evaluate','adapter.accept','adapter.activate','adapter.invoke','adapter.stop'],NULL)",dbs['core'])
            candidate=cli('request','POST','/adapter-submissions','--key','adapter-code',body={'work_id':work,'delegation_id':grant,'target':'adapter-tools','source_execution_id':execution},expected=201)
            assert candidate['program']==program and candidate['tool_exposed'] is False
            assert cli('request','POST',f"/adapter-submissions/{candidate['id']}/inspect",body={'work_id':work,'delegation_id':grant})==candidate
            verifier_request=dict(execution_request,program=None,predecessor_execution_id=None)
            cli('request','POST',f"/adapter-submissions/{candidate['id']}/verification-executions",'--key','self-verification',body=verifier_request,expected=403)
            sql(f"INSERT INTO principals VALUES('{firm}','{reviewer}','human',true),('{firm}','{verifier}','agent',true); INSERT INTO credentials VALUES('{fingerprints['reviewer']}','{firm}','{reviewer}',true,clock_timestamp()+interval '1 hour'); INSERT INTO work_controls VALUES('{firm}','{work}','{reviewer}'); INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{reviewer_grant}','{reviewer}',NULL,actions,expires_at FROM delegations WHERE id='{grant}'; INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,'{verifier_grant}','{verifier}','{reviewer_grant}',actions,expires_at FROM delegations WHERE id='{child}'",dbs['core'])
            for d in [reviewer_grant,verifier_grant]:
                sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,'{d}',target_id,operations,namespace_id FROM resource_scopes WHERE delegation_id='{grant}'",dbs['core'])
            write(root/'reviewer/config.json',json.dumps({'gateway_url':fixture.url('gateway'),'tls':tls('reviewer','reviewer',70004)}),70004)
            verifier_request.update(delegation_id=reviewer_grant,agent_delegation_id=verifier_grant)
            next_accepted=cli('request','POST',f"/adapter-submissions/{candidate['id']}/verification-executions",'--key','adapter-verification',body=verifier_request,expected=202,client='reviewer')
            replay=cli('request','POST',f"/adapter-submissions/{candidate['id']}/verification-executions",'--key','adapter-verification',body=verifier_request,expected=202,client='reviewer')
            assert next_accepted['resource_id']==replay['resource_id']
        else:
            next_program = json.loads(json.dumps(program))
            next_program['argv'][-1] = '1'
            next_program['inputs'].append({'target': target, 'workspace_id': output_workspace,
                'revision': 1, 'file': 'output.bin', 'destination': 'checkpoint/output.bin'})
            next_request = dict(execution_request, predecessor_execution_id=execution, program=next_program)
            next_accepted = cli('start', '--key', 'program-successor', body=next_request, expected=202)
        assert next_accepted['resource_id'] != execution
        os.kill(processes['catalog'].pid, signal.SIGSTOP)
        try:
            with (root / 'runtime/successor-process.log').open('xb') as stream:
                runtime = subprocess.Popen([str(binary / 'ouroboros-runtime'), '--config', str(root / 'runtime/config.json')], stdout=stream, stderr=stream, env=environment)
            def next_materializing():
                capture_guards()
                row = sql(f"SELECT to_jsonb(r) FROM runtime_instances r WHERE execution_id='{next_accepted['resource_id']}'", dbs['core'])
                if not row:
                    assert runtime.poll() is None
                    return None
                value = json.loads(row)
                return value if value['phase'] == 'materializing' else None
            next_binding = wait_until(next_materializing, 8, 'successor materialization')
            assert next_binding['instance_id'] != preparing['instance_id']
            assert next_binding['generation'] != preparing['generation']
        finally:
            os.kill(processes['catalog'].pid, signal.SIGCONT)
        runtime.wait(timeout=15)
        assert runtime.returncode == 0
        next_evidence = root / 'runtime' / next_binding['instance_id']
        assert json.loads((next_evidence / 'program-result.json').read_text())['exit_code'] == 0
        next_state = cli('get', 'executions', next_accepted['resource_id'])
        assert next_state['predecessor_id'] == (None if args.adapter_verification else execution) and next_state['compute_return']['units'] == 20
        if args.adapter_verification:
            verified_program=json.loads(sql(f"SELECT request FROM execution_programs WHERE execution_id='{next_accepted['resource_id']}'",dbs['core']))
            assert verified_program==candidate['program']
            observed=json.loads((next_evidence/'program-observation.json').read_text())
            assert next_state['program_observation']['receipt']==observed
            assert observed['stdout_sha256']==hashlib.sha256((next_evidence/'program-stdout.bin').read_bytes()).hexdigest()
            assert observed['stderr_sha256']==hashlib.sha256((next_evidence/'program-stderr.bin').read_bytes()).hexdigest()
            assert observed['exit_code']==0 and observed['instance_id']==next_binding['instance_id']

            assert sql(f"SELECT submission_id FROM adapter_verifications WHERE execution_id='{next_accepted['resource_id']}'",dbs['core'])==candidate['id']
            effects=json.loads(sql(f"SELECT jsonb_agg(jsonb_build_object('operation',r.operation,'intent_id',r.intent_id,'reply',r.reply)) FROM resource_calls r WHERE instance_id='{next_binding['instance_id']}' AND operation IN ('workspace.create','file.upload','file.publish')",dbs['core']))
            assert sorted(e['operation'] for e in effects)==['file.publish','file.upload','workspace.create']
            assert all(e['reply'] is not None for e in effects)
            verified_publication=next(e['intent_id'] for e in effects if e['operation']=='file.publish')
            verified_workspace=sql(f"SELECT input->'input'->>'workspace_id' FROM intents WHERE id='{verified_publication}'",dbs['core'])
            verified_output=root/'cli/verified-output.bin'
            scoped('GET',f'/workspaces/{verified_workspace}/snapshots/1/files/output.bin',output=verified_output)
            assert verified_output.read_bytes()==output_data
            assert json.loads((next_evidence/'materialization.json').read_text())['files']==expected_files
            verifier_container=json.loads(run(['docker','inspect',next_binding['binding']['container_id']]))[0]
            assert verifier_container['Config']['User']=='65532:65532'
            assert verifier_container['HostConfig']['NetworkMode']=='none'
            assert verifier_container['HostConfig']['ReadonlyRootfs'] and not verifier_container['HostConfig']['Privileged']
            assert all(m['Type']=='tmpfs' for m in verifier_container['Mounts'])

            assessment={'work_id':work,'delegation_id':reviewer_grant,
                'verification_execution_id':next_accepted['resource_id'],'conclusion':'supported',
                'criteria':'Exact retained input executes in the constrained container and publishes the expected bytes',
                'rationale':'Fixture compared published bytes, materialization hashes, container constraints and backend observation',
                'limitations':'Environment fixture only; no provider, MCP exposure, subscription or operating qualification'}
            route=f"/adapter-submissions/{candidate['id']}/evaluations"
            reviewed=cli('request','POST',route,'--key','adapter-assessment',body=assessment,expected=201,client='reviewer')
            assert reviewed['runtime_observation']==observed
            assert reviewed['operating_acceptance'] is False and reviewed['tool_exposed'] is False
            assert reviewed['independence_confirmed'] is False
            assert cli('request','POST',route,'--key','adapter-assessment',body=assessment,expected=201,client='reviewer')==reviewed
            cli('request','POST',route,'--key','adapter-assessment',body={**assessment,'conclusion':'unsupported'},expected=409,client='reviewer')
            cli('request','POST',route,'--key','self-assessment',body={**assessment,'delegation_id':grant},expected=403)
            acceptance={'work_id':work,'delegation_id':reviewer_grant,'evaluation_id':reviewed['id'],
                'max_calls':2,'lifetime_seconds':60,
                'rationale':'Bounded reuse of the exact environment fixture; the cited byte and isolation checks support this scope only',
                'independence_basis':'Reviewer is a separate fixture principal with source access; this does not establish real organizational independence'}
            accept_route=f"/adapter-submissions/{candidate['id']}/acceptances"
            accepted_scope=cli('request','POST',accept_route,'--key','adapter-acceptance',body=acceptance,expected=201,client='reviewer')
            assert accepted_scope['activation_required'] is True and accepted_scope['tool_exposed'] is False
            assert cli('request','POST',accept_route,'--key','adapter-acceptance',body=acceptance,expected=201,client='reviewer')==accepted_scope
            cli('request','POST',accept_route,'--key','adapter-acceptance',body={**acceptance,'max_calls':3},expected=409,client='reviewer')
            cli('request','POST',accept_route,'--key','self-acceptance',body={**acceptance,'delegation_id':grant},expected=403)
            inspected=cli('request','POST',f"/adapter-submissions/{candidate['id']}/inspect",body={'work_id':work,'delegation_id':grant})
            assert inspected['evaluations']==[reviewed] and inspected['acceptances']==[accepted_scope]
            checks.append('bounded adapter acceptance preserves assessment and deadline; read-only inspection exposes evidence; self-acceptance and changed replay rejected without activation')
            activate_route=f"/adapter-submissions/{candidate['id']}/activate"
            activation={'work_id':work,'delegation_id':reviewer_grant,'acceptance_id':accepted_scope['id'],'expected_activation_id':None}
            selected=cli('request','POST',activate_route,'--key','adapter-activate',body=activation,expected=201,client='reviewer')
            assert cli('request','POST',activate_route,'--key','adapter-activate',body=activation,expected=201,client='reviewer')==selected
            invoke_route=f"/adapter-submissions/{candidate['id']}/invocations"
            invocation={'activation_id':selected['id'],'execution':verifier_request}
            mcp_path=f'/mcp/work/{work}/delegation/{reviewer_grant}'
            transport_probe = r"""import http.client,json,ssl,sys,urllib.parse
from pathlib import Path
stage='setup'
try:
 stage='configuration'
 c=json.loads(Path(sys.argv[1]).read_text());u=urllib.parse.urlsplit(c['gateway_url'])
 t=c['tls'];ctx=ssl.create_default_context(cafile=t['ca']);ctx.load_cert_chain(t['certificate'],t['private_key'])
 base={'content-type':'application/json','accept':'application/json, text/event-stream','mcp-protocol-version':'2025-11-25'}
 init=json.dumps({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'transport-probe','version':'1'}}})
 cases=[(dict(base,origin='https://untrusted.invalid'),init,403),
        (dict(base,**{'mcp-protocol-version':'invalid'}),init,400),
        (dict(base,accept='application/json'),init,406),
        (base,'{',200),
        (base,json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'}),202)]
 for index,(headers,body,expected) in enumerate(cases):
  stage=str(index)
  connection=http.client.HTTPSConnection(u.hostname,u.port,context=ctx,timeout=5)
  connection.request('POST',sys.argv[2],body,headers);response=connection.getresponse();data=response.read();connection.close()
  assert response.status==expected,(response.status,expected)
  if body=='{':assert json.loads(data)['error']['code']==-32700
  if expected==202:assert data==b''
 print(json.dumps({'result':'PASS'}))
except Exception as error:
 print(json.dumps({'result':'FAIL','stage':stage,'type':type(error).__name__}))
 sys.exit(1)
"""
            probe=command(['python3','-c',transport_probe,str(root/'reviewer/config.json'),mcp_path],uid=70004)
            probe_result=json.loads(probe.stdout)
            write(root/'managed-mcp-transport.json',json.dumps(probe_result),0)
            assert probe_result=={'result':'PASS'},probe_result
            init=cli('request','POST',mcp_path,body={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25','capabilities':{},'clientInfo':{'name':'ouroboros-fixture','version':'1'}}},client='reviewer')
            assert init['result']['protocolVersion']=='2025-11-25'
            assert cli('request','POST',mcp_path,body={'jsonrpc':'2.0','method':'notifications/initialized'},binary_output=True,client='reviewer').strip()==b''
            cli('request','GET',mcp_path,expected=405,client='reviewer')
            listing=cli('request','POST',mcp_path,body={'jsonrpc':'2.0','id':2,'method':'tools/list'},client='reviewer')
            tool='invoke_'+selected['id'].replace('-','')
            assert any(t['name']==tool for t in listing['result']['tools'])
            rpc={'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':tool,'arguments':{'request_key':'adapter-invoke','agent_delegation_id':verifier_grant}}}
            mcp_admission=cli('request','POST',mcp_path,body=rpc,client='reviewer')['result']
            assert mcp_admission['isError'] is False and mcp_admission['structuredContent']['completion']=='not_confirmed'
            invoked=mcp_admission['structuredContent']['admission']
            invocation_replay=cli('request','POST',invoke_route,'--key','adapter-invoke',body=invocation,expected=202,client='reviewer')
            assert invocation_replay['resource_id']==invoked['resource_id'] and invocation_replay['intent_id']==invoked['intent_id']
            with (root/'runtime/invocation-process.log').open('xb') as stream:
                runtime=subprocess.Popen([str(binary/'ouroboros-runtime'),'--config',str(root/'runtime/config.json')],stdout=stream,stderr=stream,env=environment)
            wait_until(lambda: True if runtime.poll() is not None else None,15,'managed invocation completion')
            assert runtime.returncode==0
            used=cli('get','executions',invoked['resource_id'])
            mcp_observed=cli('request','POST',mcp_path,body={'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'execution_get','arguments':{'execution_id':invoked['resource_id']}}},client='reviewer')
            assert mcp_observed['result']['structuredContent']==used
            invoked_instance=used['program_observation']['receipt']['instance_id']
            assert invoked_instance not in [preparing['instance_id'],next_binding['instance_id']]
            assert used['program_observation']['receipt']['exit_code']==0 and used['compute_return']['units']==20
            called_effects=json.loads(sql(f"SELECT jsonb_agg(jsonb_build_object('operation',r.operation,'intent_id',r.intent_id,'reply',r.reply)) FROM resource_calls r WHERE instance_id='{invoked_instance}' AND operation IN ('workspace.create','file.upload','file.publish')",dbs['core']))
            assert sorted(e['operation'] for e in called_effects)==['file.publish','file.upload','workspace.create']
            called_publication=next(e['intent_id'] for e in called_effects if e['operation']=='file.publish')
            called_workspace=sql(f"SELECT input->'input'->>'workspace_id' FROM intents WHERE id='{called_publication}'",dbs['core'])
            called_output=root/'cli/invoked-output.bin'
            scoped('GET',f'/workspaces/{called_workspace}/snapshots/1/files/output.bin',output=called_output)
            assert called_output.read_bytes()==output_data
            assert sql('SELECT count(*) FROM adapter_invocations',dbs['core'])=='1'
            stop={'work_id':work,'delegation_id':reviewer_grant,'activation_id':selected['id']}
            stopped=cli('request','POST',f"/adapter-submissions/{candidate['id']}/stop",'--key','adapter-stop',body=stop,client='reviewer')
            assert stopped['termination_confirmed'] is False
            cli('request','POST',invoke_route,'--key','after-adapter-stop',body=invocation,expected=403,client='reviewer')
            assert sql('SELECT count(*) FROM adapter_invocations',dbs['core'])=='1'
            stopped_view=cli('request','POST',f"/adapter-submissions/{candidate['id']}/inspect",body={'work_id':work,'delegation_id':grant})
            assert stopped_view['activations'][0]['stop_recorded'] is True and stopped_view['activations'][0]['admitted_calls']==1
            listing=cli('request','POST',mcp_path,body={'jsonrpc':'2.0','id':5,'method':'tools/list'},client='reviewer')
            assert all(t['name']!=tool for t in listing['result']['tools'])
            denied=cli('request','POST',mcp_path,body={**rpc,'id':6},client='reviewer')
            assert denied['result']['isError'] is True
            checks.append('managed MCP initialization, discovery, third execution admission and observation use current Gateway authority; direct API replay shares its slot and stopped tools disappear')
            checks.append('explicit activation admits a real third contained invocation with exact published output; replay consumes one slot and stop denies a new call while allowance remains')
            write(root/'adapter-evaluation.json',json.dumps(reviewed,indent=2),0)
            checks.append('scoped evaluator records criteria and limitations tied to actual backend observation; replay is stable, self-assessment and changed-key input rejected; no activation')
            checks.append('registered immutable adapter runs as a distinct verifier instance via API/CLI; normal Gateway workspace/upload/publication and Runtime materialization remain enforced')
        else:
            assert sql(f"SELECT revision FROM workspaces WHERE id='{output_workspace}'", dbs['catalog']) == '2'
        assert sql(f"SELECT count(*) FROM compute_returns", dbs['core']) == ('3' if args.adapter_verification else '2')
        assert sql(f"SELECT committed FROM limits WHERE id='compute'", dbs['core']) == '0'
        assert sql(f"SELECT count(*) FROM execution_inputs WHERE execution_id='{execution}' AND retained", dbs['core']) == '2'
        assert sql(f"SELECT count(*) FROM execution_inputs WHERE execution_id='{next_accepted['resource_id']}' AND retained", dbs['core']) == ('2' if args.adapter_verification else '3')
        assert cli('get', 'executions', execution)['state'] != 'succeeded'
        successor_result = {'execution_id': next_accepted['resource_id'], 'instance_id': next_binding['instance_id'],
            'generation': next_binding['generation'], 'output_revision': 1 if args.adapter_verification else 2, 'retained_inputs': 2 if args.adapter_verification else 3, 'adapter_submission': candidate['id'] if args.adapter_verification else None}
        if not args.adapter_verification: checks.append('fresh instance uses current permission and exact prior result as input, publishes next revision and returns compute without rewriting predecessor outcome')
    write(root / 'observed-state.json', json.dumps(snapshot(), indent=2))
    result = {'result': 'PASS', 'fixture_id': fixture.identity, 'checks': checks, 'image': values['image'],
        'work_id': work, 'execution_id': execution, 'instance_id': preparing['instance_id'],
        'generation': preparing['generation'], 'profile': profile, 'program': program,
        'input_uploads': uploads, 'materialization': materialization, 'program_start': program_start, 'private_effects': private_effects,
        'output': {'size': len(output_data), 'sha256': hashlib.sha256(output_data).hexdigest(), 'publication_intent_id': publication_id},
        'restriction': restriction_result, 'program_result': program_result,
        'service_identities': service_identities, 'credential_boundaries': credential_boundaries, 'retained_compute': 0, 'retained_input_count': 2,
        'resource_cli_success_status': '2xx only; exact success code not emitted by generic CLI request',
        'native_codex': 'NOT RUN', 'model_subscription': 'NOT RUN', 'provider_credentials': 'NOT RUN',
        'db_workflow': 'NOT RUN', 'program_natural_exit': 'PASS' if args.restriction == 'complete' else 'NOT RUN', 'full_network_bypass_matrix': 'NOT RUN',
        'compute_settlement': 'PASS', 'successful_successor': 'PASS' if successor_result else 'NOT RUN', 'successor': successor_result,
        'dependency_release': 'NOT IMPLEMENTED', 'production_qualification': 'NOT RUN'}
except BaseException as error:
    result = {'result': 'FAIL', 'fixture_id': fixture.identity, 'error_type': type(error).__name__, 'completed_checks': checks}
    raise
finally:
    cleanup_errors = []
    if runtime is not None:
        capture_guards()
        if not guards:
            cleanup_errors.append('no owned original guard was observed; guard cleanup remains unknown')
        if runtime.poll() is None:
            try:
                os.kill(runtime.pid, signal.SIGCONT)
                runtime.terminate()
                try:
                    runtime.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    runtime.kill()
                    runtime.wait(timeout=3)
            except (OSError, subprocess.TimeoutExpired):
                cleanup_errors.append('Runtime shutdown requires inspection')
    owned = {container} if container else set()
    for path in (root / 'runtime').glob('*/container.json'):
        try:
            identity = json.loads(path.read_text())['container_id']
            if re.fullmatch(r'[a-f0-9]{64}', identity):
                owned.add(identity)
        except (OSError, ValueError, KeyError):
            cleanup_errors.append('fixture container journal requires inspection')
    for identity in owned:
        try:
            if command(['docker', 'rm', '-f', identity], timeout=10).returncode:
                cleanup_errors.append('fixture container removal failed')
        except (OSError, subprocess.TimeoutExpired):
            cleanup_errors.append('fixture container removal uncertain')
    for proc in reversed(list(processes.values())):
        try:
            if proc.poll() is None:
                os.kill(proc.pid, signal.SIGCONT)
                proc.terminate()
                proc.wait(timeout=3)
        except (OSError, subprocess.TimeoutExpired):
            cleanup_errors.append('fixture service shutdown requires inspection')
    for database in reversed(databases):
        try:
            sql(f'DROP DATABASE {database} WITH (FORCE);')
        except Exception:
            cleanup_errors.append('disposable database cleanup failed')
    for role in reversed(roles):
        try:
            sql(f'DROP ROLE {role};')
        except Exception:
            cleanup_errors.append('disposable role cleanup failed')
    guard_cleanup = []
    for guard in guards.values():
        observed = dict(guard)
        bound = time.monotonic() + max(0, (guard['deadline_boottime_ns'] - time.clock_gettime_ns(time.CLOCK_BOOTTIME)) / 1e9) + 3
        while True:
            current = process_identity(guard['pid'])
            if current is None or current['start_ticks'] != guard['start_ticks']:
                observed['original_process_gone'] = True
                break
            if time.monotonic() >= bound:
                observed['original_process_gone'] = False
                cleanup_errors.append('original deadline guard still present')
                break
            time.sleep(.2)
        guard_cleanup.append(observed)
    if result is None:
        result = {'result': 'FAIL', 'fixture_id': fixture.identity, 'completed_checks': checks}
    if cleanup_errors:
        result['result'] = 'FAIL'
    result['cleanup'] = cleanup_errors or 'complete'
    result['guard_cleanup'] = guard_cleanup
    write(root / 'result.json', json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    if cleanup_errors:
        raise RuntimeError('fixture cleanup incomplete; inspect protected evidence')
