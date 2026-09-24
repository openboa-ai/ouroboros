#!/usr/bin/env python3
"""Exercise the real Mac Rust client with fresh PostgreSQL/Core/Gateway/Catalog.

Only synthetic identities and one exact published JSON document are created. This
is a client integration test, not a native window or Linux isolation acceptance.
"""
if __package__ in (None, ''):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import secrets
import resource
import shutil
import subprocess
import tempfile
import time
import traceback
import uuid

from tests.support.postgres_suite_support import (
    Cancellation, Commands, PostgreSQL, SuiteFailure, free_ports, private_write,
    report_write, safe_environment, terminate_group, redact,
)
from tests.support.rust_quality import ROOT

TEST = 'gateway_fixture_tests::observes_real_gateway_and_exact_catalog_bytes'


def fixture(args, root, commands, pg, children):
    service = root / 'services'
    service.mkdir(mode=0o700)
    private_write(service / 'cert.ext', 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n'
        'extendedKeyUsage=serverAuth,clientAuth\nsubjectAltName=IP:127.0.0.1\n')
    keys, fingerprints = {}, {}
    for name in ('ca', 'core', 'gateway', 'gateway-service', 'human', 'catalog'):
        keys[name] = commands.run(name + '-key', ['openssl', 'genpkey', '-algorithm', 'ED25519'], log=False).decode()
        commands.secrets.append(keys[name].strip())
        if name == 'ca':
            commands.run('ca-cert', ['openssl', 'req', '-x509', '-new', '-key', '/dev/stdin',
                '-subj', '/CN=Ouroboros disposable CA', '-days', '1', '-addext', 'basicConstraints=critical,CA:TRUE',
                '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', str(service / 'ca.pem')], input_text=keys[name])
        else:
            commands.run(name + '-csr', ['openssl', 'req', '-new', '-key', '/dev/stdin',
                '-subj', '/CN=' + name, '-out', str(service / (name + '.csr'))], input_text=keys[name])
            commands.run(name + '-cert', ['openssl', 'x509', '-req', '-in', str(service / (name + '.csr')),
                '-CA', str(service / 'ca.pem'), '-CAkey', '/dev/stdin', '-CAcreateserial', '-days', '1',
                '-extfile', str(service / 'cert.ext'), '-out', str(service / (name + '.pem'))], input_text=keys['ca'])
            der = commands.run(name + '-der', ['openssl', 'x509', '-in', str(service / (name + '.pem')),
                '-outform', 'DER'], log=False)
            fingerprints[name] = hashlib.sha256(der).hexdigest()
    def tls(name, variable='OURO_SECRET_TLS_KEY'):
        return dict(certificate=str(service / (name + '.pem')), private_key={'env': variable}, ca=str(service / 'ca.pem'))
    def migrate(label, binary, database, *extra):
        commands.run(label, [str(args.binary_dir / binary), '--database-url-env', 'OURO_SECRET_DB_URL', *extra],
            env=dict(commands.env, OURO_SECRET_DB_URL=pg.url(database)))
    database = 'ouro_test_' + secrets.token_hex(8)
    pg.sql('CREATE DATABASE ' + database)
    migrate('core-migrate', 'ouroboros-migrate', database)
    firm, principal, grant = (str(uuid.uuid4()) for _ in range(3))
    core_role, core_password = 'ouro_core_' + secrets.token_hex(8), secrets.token_hex(24)
    commands.secrets.append(core_password)
    pg.sql(f"CREATE ROLE {core_role} LOGIN PASSWORD '{core_password}'; GRANT CONNECT ON DATABASE {database} TO {core_role}")
    pg.sql(f"GRANT USAGE ON SCHEMA public TO {core_role}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {core_role}; "
           f"INSERT INTO firms(id) VALUES('{firm}'); INSERT INTO principals VALUES('{firm}','{principal}','human',true); "
           f"INSERT INTO credentials VALUES('{fingerprints['human']}','{firm}','{principal}',true,clock_timestamp()+interval '1 hour'); "
           f"INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES('{firm}','{grant}','{principal}',"
           f"ARRAY['work.create'],clock_timestamp()+interval '1 hour')", database)
    core_url = f'postgresql://{core_role}:{core_password}@127.0.0.1:{pg.port}/{database}?sslmode=disable'
    core_port, gateway_port = free_ports(2)
    core = dict(listen=f'127.0.0.1:{core_port}', tls=tls('core'), database_url={'env': 'OURO_SECRET_DB_URL'},
        firm_id=firm, gateway_fingerprint=fingerprints['gateway-service'])
    gateway = dict(listen=f'127.0.0.1:{gateway_port}', tls=tls('gateway'), core_url=f'https://127.0.0.1:{core_port}',
        core_client=tls('gateway-service', 'OURO_SECRET_CORE_CLIENT_KEY'))
    private_write(service / 'cli.json', json.dumps(dict(gateway_url=f'https://127.0.0.1:{gateway_port}', tls=tls('human'))))
    namespace, store, generation = (str(uuid.uuid4()) for _ in range(3))
    catalog_database = 'ouro_mac_' + secrets.token_hex(8)
    pg.sql('CREATE DATABASE ' + catalog_database)
    migrate('catalog-migrate', 'ouroboros-resource-migrate', catalog_database, '--role', 'catalog')
    role = 'ouro_mac_' + secrets.token_hex(8)
    password = secrets.token_hex(24)
    commands.secrets.append(password)
    pg.sql(f"CREATE ROLE {role} LOGIN PASSWORD '{password}'; GRANT CONNECT ON DATABASE {catalog_database} TO {role}")
    pg.sql(f"GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO {role}; "
           f"REVOKE INSERT,UPDATE ON storage_binding FROM {role}; GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {role}; "
           f"INSERT INTO storage_binding VALUES(true,'{firm}','{store}','{generation}')", catalog_database)
    catalog_url = f'postgresql://{role}:{password}@127.0.0.1:{pg.port}/{catalog_database}?sslmode=disable'
    fingerprint = fingerprints['catalog']
    port = free_ports(1)[0]
    blobs = root / 'catalog-blobs'
    blobs.mkdir(mode=0o700)
    binding = root / 'storage-binding.json'
    storage_config = root / 'prepare-storage.json'
    private_write(storage_config, json.dumps(dict(root=str(blobs), binding_file=str(binding),
        owner_uid=os.getuid(), firm_id=firm, store_id=store, generation=generation)))
    commands.run('storage-prepare', [str(args.binary_dir / 'ouroboros-storage'), 'prepare', '--config', str(storage_config)])
    target = dict(namespace_id=namespace, store_id=store, storage_generation=generation,
                  max_file_bytes=65536, transfer_seconds=60)
    pg.sql(f"UPDATE delegations SET actions=ARRAY['work.create','workspace.create','inspect','file.upload','file.publish','file.read'] WHERE firm_id='{firm}' AND id='{grant}'; "
           f"INSERT INTO limits VALUES('{firm}','resource_calls',16,0); "
           f"INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES('{firm}','{store}','{generation}',1048576); "
           f"INSERT INTO resource_targets VALUES('{firm}','catalog','{fingerprint}',true,'{json.dumps(target)}',65536); "
           f"INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES('{firm}','{namespace}','catalog','{store}','{generation}',1)", database)
    catalog = dict(listen=f'127.0.0.1:{port}', tls=tls('catalog'), core_url=gateway['core_url'],
        core_client=tls('catalog'), gateway_fingerprint=fingerprints['gateway-service'], role='catalog',
        database_url={'env': 'OURO_SECRET_DB_URL'}, storage_binding_file=str(binding))
    gateway['workers'] = {'catalog': f'https://127.0.0.1:{port}'}
    work = None
    sequence = 0
    client_env = dict(commands.env, OURO_SECRET_TLS_KEY=keys['human'])
    def request(method, path, data=None, key=None):
        nonlocal sequence
        sequence += 1
        command = [str(args.binary_dir / 'ouroboros-cli'), '--config', str(service / 'cli.json'), 'request', method, path]
        if work:
            command += ['--work', work, '--delegation', grant, '--target', 'catalog']
        if key:
            command += ['--key', key]
        if data is not None:
            body = root / ('request-' + str(sequence) + '.json')
            # Only public synthetic work/file content is persisted, never credentials.
            body.write_bytes(data if isinstance(data, bytes) else json.dumps(data).encode())
            command += ['--input', str(body)]
        output = commands.run('api-' + str(sequence), command, env=client_env, timeout=10)
        return json.loads(output)
    for name, executable, config, environment in (
        ('core', 'ouroboros-core', core, dict(commands.env, OURO_SECRET_TLS_KEY=keys['core'], OURO_SECRET_DB_URL=core_url)),
        ('catalog', 'ouroboros-resources', catalog, dict(commands.env, OURO_SECRET_TLS_KEY=keys['catalog'], OURO_SECRET_DB_URL=catalog_url)),
        ('gateway', 'ouroboros-gateway', gateway, dict(commands.env, OURO_SECRET_TLS_KEY=keys['gateway'], OURO_SECRET_CORE_CLIENT_KEY=keys['gateway-service'])),
    ):
        private_write(service / (name + '.json'), json.dumps(config))
        log = root / (name + '.private.log')
        with log.open('xb') as stream:
            os.fchmod(stream.fileno(), 0o600)
            children.append(subprocess.Popen([str(args.binary_dir / executable), '--config', str(service / (name + '.json'))],
                env=environment, stdin=subprocess.DEVNULL, stdout=stream, stderr=stream, start_new_session=True))
    deadline = time.monotonic() + 20
    while True:
        if any(child.poll() is not None for child in children):
            raise SuiteFailure('owned service exited before readiness')
        try:
            request('GET', '/conditions')
            break
        except SuiteFailure:
            if time.monotonic() >= deadline:
                raise SuiteFailure('owned Gateway did not become ready') from None
            time.sleep(0.05)
    work = request('POST', '/work', {'purpose': 'Disposable native-client quality check', 'delegation_id': grant}, 'work')['resource_id']
    pg.sql(f"INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES('{firm}','{work}','{grant}','catalog',ARRAY['workspace.create','inspect','file.upload','file.publish','file.read'],'{namespace}')", database)
    workspace = request('POST', '/workspaces', {'label': 'Native client fixture'}, 'workspace')['workspace_id']
    content = json.dumps({'companyId': firm, 'schemaVersion': 1}).encode()
    upload = request('POST', '/uploads', {'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}, 'upload')
    request('PUT', '/uploads/' + upload['upload_id'] + '/content', content)
    publication = request('POST', '/publications', {'workspace_id': workspace, 'expected_revision': 0,
        'files': {'company-ui.json': upload['upload_id']}}, 'publication')
    if publication['revision'] != 1:
        raise SuiteFailure('fixture did not publish the exact revision')
    from tests.support.rust_suite import harnesses
    compiled = commands.run('native-client-build', ['cargo', 'test', '--locked', '--offline', '--manifest-path',
        str(ROOT / 'apps/mac/src-tauri/Cargo.toml'), '--target-dir', str(args.target_dir),
        '--bin', 'ouroboros-mac', '--no-run', '--message-format=json'], cwd=ROOT, timeout=1200)
    binaries = harnesses(compiled.decode(), args.target_dir)
    if len(binaries) != 1:
        raise SuiteFailure('native client requires exactly one current test executable')
    env = dict(client_env, OURO_MAC_FIXTURE_PROFILE=str(service / 'cli.json'))
    output = commands.run('native-client', [str(next(iter(binaries))), '--ignored', '--exact', TEST, '--nocapture'],
        env=env, cwd=ROOT, timeout=1200)
    # Other tests are filtered intentionally by this single exact, registered scenario.
    if not re_success(output):
        raise SuiteFailure('native client did not execute the required exact test')
    return {'status': 'PASS', 'tests_passed': 1, 'ignored': 0, 'provider_calls': 0}


def re_success(output):
    import re
    return bool(re.search(rb'test result: ok\. 1 passed; 0 failed; 0 ignored;', output)
                and ('test ' + TEST + ' ... ').encode() in output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('binary-dir', 'pg-bin', 'scratch-root', 'target-dir'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if platform.system() != 'Darwin' or os.geteuid() == 0 or not __debug__:
        parser.error('requires a nonroot macOS test host with assertions enabled')
    for key, value in vars(args).copy().items():
        if not value.is_absolute() or value.resolve(strict=True) != value or not value.is_dir():
            parser.error(key + ' must be an exact existing absolute directory')
    info = args.scratch_root.stat()
    if info.st_uid != os.getuid() or info.st_mode & 0o777 != 0o700:
        parser.error('scratch root must be private and owned')
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    root = Path(tempfile.mkdtemp(prefix='mac-gateway-', dir=args.scratch_root))
    children, secret_values = [], [secrets.token_hex(24)]
    commands = Commands(root, safe_environment(args.pg_bin), secret_values)
    pg = PostgreSQL(root, args.pg_bin, commands, 'ouro_mac_' + secrets.token_hex(8), secret_values[0])
    cancellation = Cancellation()
    cancellation.install()
    result = {'status': 'FAIL'}
    try:
        if not commands.run('openssl-version', ['openssl', 'version']).startswith(b'OpenSSL 3.'):
            raise SuiteFailure('fixture requires OpenSSL 3 for synthetic Ed25519 certificates')
        pg.start()
        report_write(root / 'database-ready.json', {'ready': True})
        result = fixture(args, root, commands, pg, children)
    except (Exception, KeyboardInterrupt):
        private_write(root / 'failure.private.log', redact(traceback.format_exc().encode(), commands.secrets).decode())
        result = {'status': 'FAIL', 'failure': 'owned Mac client fixture failed'}
    finally:
        cancellation.begin_cleanup()
        clean = commands.cleanup_ok
        for child in reversed(children):
            try:
                clean = terminate_group(child) and clean
            except Exception:
                clean = False
        try:
            pg.stop()
        except Exception:
            clean = False
        result['cleanup_ok'] = clean and pg.shutdown_verified
        result['private_material_removed'] = False
        if result['cleanup_ok']:
            try:
                result['persisted_secret_values'] = any(
                    secret.encode() in item.read_bytes()
                    for item in root.rglob('*') if item.is_file() and not item.is_symlink()
                    for secret in commands.secrets if secret)
                if result['persisted_secret_values']:
                    result['status'] = 'FAIL'
                for item in root.iterdir():
                    if item.name == 'failure.private.log':
                        continue
                    if item.is_dir() and not item.is_symlink():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
                result['private_material_removed'] = True
            except OSError:
                result['cleanup_ok'] = False
        if not result['cleanup_ok']:
            result['status'] = 'FAIL'
        report_write(root / 'result.json', result)
        cancellation.restore()
    print(json.dumps(result))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
