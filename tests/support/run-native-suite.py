#!/usr/bin/env python3
"""Run named native contracts from a checkout on an explicit disposable Linux ARM64 VM.

Example (all paths are supplied by the selected host's configuration):
  python3 tests/support/run-native-suite.py --environment /absolute/native.json \
      --scenario native.environment --run-name environment-check

`--list` has no environment requirement. `--preflight` only inspects the selected
host/image; it does not install, provision, execute Codex or start a database.
A run uses real product binaries and Codex but only finite synthetic model responses.
Evidence and failed attempts are retained; an existing run name is never reused.
"""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import stat
import subprocess
import sys
import time

from tests.support.fixture_release import hash_file, install
from tests.support.native_build_input import hash_build_binary
from tests.support.native_image_identity import CLI_LABEL, MATERIALIZER_LABEL, PROBE_LABEL
from tests.support.native_kernel_contract import TEST_NAME, verify_manifest as verify_kernel_manifest
from tests.support.native_scenarios import SCENARIOS, catalogue, select_scenario
from tests.support.native_suite_environment import CODEX_VERSION, child_environment, docker, load_environment, preflight

# Export only known result and boundary receipts, not configuration, keys, HTTP
# request logs or arbitrary files that a fixture workload might create.
_ROOT_EVIDENCE = (
    'result.json', 'credential-boundaries.json', 'service-identities.json',
    'cold-restart-result.json', 'bounded-load-result.json', 'cold-native-result.json',
    'service-units-result.json', 'installation-faults-result.json',
)
_INSTANCE_EVIDENCE = (
    'container.json', 'finish.json', 'binding.json', 'guard.json', 'materialization.json',
    'allocation.json', 'allocation-observation.json', 'compute-return.json',
    'compute-return-accepted.json', 'guard-binding.json', 'guard-closure.json',
    'native-terminal.json', 'native-checkpoint.json', 'native-restore.json',
)


def interrupted(signum, frame):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    raise KeyboardInterrupt('native suite cancelled')


def group_members(group):
    """Observe live members of the command's own Linux process group, excluding zombies."""
    members = []
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            fields = (path / 'stat').read_text().rsplit(')', 1)[1].split()
            if int(fields[2]) == group and fields[0] != 'Z':
                members.append(int(path.name))
        except (FileNotFoundError, ProcessLookupError):
            continue
    return members


def terminate_group(proc):
    # start_new_session binds this ID to a command-owned process group. Children that
    # survive their parent are still members; waiting on only the parent is insufficient.
    if group_members(proc.pid):
        os.killpg(proc.pid, signal.SIGTERM)
    deadline = time.monotonic() + 35
    while group_members(proc.pid) and time.monotonic() < deadline:
        proc.poll()
        time.sleep(.05)
    if group_members(proc.pid):
        os.killpg(proc.pid, signal.SIGKILL)
    proc.wait(timeout=5)
    deadline = time.monotonic() + 5
    while group_members(proc.pid) and time.monotonic() < deadline:
        time.sleep(.05)
    if group_members(proc.pid):
        raise RuntimeError('cancelled native command still has live descendants')


def write_json(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    path.chmod(0o600)


def drop_identity(uid, gid):
    def drop():
        os.setgroups([])
        os.setgid(gid)
        os.setuid(uid)
    return drop


def free_ports(names):
    ports, held = {}, []
    try:
        for name in names:
            sock = socket.socket()
            sock.bind(('127.0.0.1', 0))
            held.append(sock)
            ports[name] = sock.getsockname()[1]
    finally:
        for sock in held:
            sock.close()
    return ports


def evidence_export(source, destination):
    destination.mkdir(mode=0o700)
    paths = [source / name for name in _ROOT_EVIDENCE]
    for role in ('runtime', 'adapter-runtime'):
        for name in _INSTANCE_EVIDENCE:
            paths.extend((source / role).glob('*/' + name))
    records, total = [], 0
    for path in paths:
        if not path.exists():
            continue
        meta = path.lstat()
        if not stat.S_ISREG(meta.st_mode) or meta.st_size > 4 * 1024**2:
            raise ValueError('evidence entry must be a bounded regular file')
        total += meta.st_size
        if total > 32 * 1024**2:
            raise ValueError('evidence export exceeds bounded inventory')
        target = destination / path.relative_to(source)
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with target.open('xb') as output, path.open('rb') as incoming:
            shutil.copyfileobj(incoming, output)
        target.chmod(0o600)
        records.append({'path': str(target.relative_to(destination)), 'sha256': hash_file(target)})
    write_json(destination / 'manifest.json', records)
    return records


class NativeRun:
    """Own only this invocation's DB, logs, release reference and fixture process."""
    def __init__(self, environment, scenario_id, run_name):
        self.environment = environment
        self.scenario_id = scenario_id
        self.scenario = select_scenario(scenario_id)
        self.root = environment['run_root'] / run_name
        self.deployment = environment['deployment_root'] / run_name
        self.ipc = environment['ipc_root'] / run_name
        self.data = self.root / 'postgres' / 'data'
        self.pg_home = self.root / 'postgres'
        self.commands = []
        self.created = False
        self.container_baseline = None
        self.postgres = None
        self.postgres_log = None
        self.active_process = None
        self.command_cleanup_complete = True
        self.env = child_environment(environment)
        self.config_file = self.root / 'fixture.json'
        self.pg_identity = drop_identity(environment['postgres_uid'], environment['postgres_gid'])

    def command(self, argv, label, timeout=30, postgres=False):
        with (self.root / (label + '.log')).open('xb') as log:
            proc = subprocess.Popen([str(v) for v in argv], cwd=self.environment['source_root'],
                                    env=child_environment(self.environment, self.pg_home) if postgres else self.env,
                                    stdout=log, stderr=subprocess.STDOUT,
                                    preexec_fn=self.pg_identity if postgres else None,
                                    start_new_session=True)
            self.active_process = proc
            self.command_cleanup_complete = False
            residual = False
            try:
                code = proc.wait(timeout=timeout)
                residual = bool(group_members(proc.pid))
                if residual:
                    raise RuntimeError('native command exited while descendants remained live')
                self.command_cleanup_complete = True
            except BaseException:
                # The process group is created exclusively for this command. Give
                # fixture finally blocks time to close their recorded resources.
                terminate_group(proc)
                self.command_cleanup_complete = True
                self.commands.append({'step': label, 'status': 'FAIL' if residual else 'INTERRUPTED',
                                      'exit': proc.returncode, 'residual_descendants': residual})
                raise
            finally:
                self.active_process = None
        self.commands.append({'step': label, 'status': 'PASS' if code == 0 else 'FAIL', 'exit': code})
        if code != 0:
            raise RuntimeError(label + ' failed; protected log retained')

    def start_database(self):
        self.postgres_log = (self.pg_home / 'postgres.log').open('ab')
        self.postgres = subprocess.Popen([str(self.environment['pg_bin'] / 'postgres'), '-D', str(self.data)],
                                         env=child_environment(self.environment, self.pg_home),
                                         stdout=self.postgres_log, stderr=subprocess.STDOUT,
                                         preexec_fn=self.pg_identity, start_new_session=True)
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.postgres.poll() is not None:
                raise RuntimeError('fixture PostgreSQL exited before readiness')
            probe = subprocess.run([str(self.environment['pg_bin'] / 'pg_isready'), '-h', '127.0.0.1',
                                    '-p', str(self.pg_port)], env=self.env, capture_output=True, timeout=2)
            if probe.returncode == 0:
                return
            time.sleep(0.05)  # readiness polling, not an ordering assumption in a race test
        raise TimeoutError('fixture PostgreSQL readiness deadline')

    def stop_database(self):
        if self.postgres is None:
            return {'started': False, 'postmaster_pid_exists': (self.data / 'postmaster.pid').exists()}
        proc = self.postgres
        if proc.poll() is None:
            proc.send_signal(signal.SIGINT)  # PostgreSQL fast, durable shutdown of our exact child.
            try:
                proc.wait(timeout=30)
            except subprocess.TimeoutExpired:
                # Do not pretend a forced or unobserved stop is a valid durable closure.
                raise RuntimeError('fixture PostgreSQL shutdown needs inspection')
        if self.postgres_log:
            self.postgres_log.close()
            self.postgres_log = None
        stopped = {'started': True, 'postgres_exit': proc.returncode,
                   'postmaster_pid_exists': (self.data / 'postmaster.pid').exists()}
        if proc.returncode != 0 or stopped['postmaster_pid_exists']:
            raise RuntimeError('fixture PostgreSQL did not close cleanly')
        return stopped

    def containers(self):
        output = subprocess.run(docker(self.environment, 'container', 'ls', '-a', '--no-trunc', '--format', '{{.ID}}'),
                                env=self.env, capture_output=True, check=True, timeout=15).stdout.decode()
        values = set(output.splitlines())
        if any(not re.fullmatch(r'[a-f0-9]{64}', value) for value in values):
            raise ValueError('Docker returned an invalid container inventory')
        return values

    def observe_runtime_cleanup(self):
        if not self.command_cleanup_complete:
            raise RuntimeError('native command descendant termination is unconfirmed')
        if self.container_baseline is None:
            return {'started': False}
        remaining = self.containers() - self.container_baseline
        if remaining:
            # Preserve unknown/unfinished resource evidence. Never remove arbitrary
            # containers just because they appeared while a test was running.
            raise RuntimeError('native fixture left new containers requiring inspection')
        protected_uids = {*range(70001, 70009), self.environment['bridge_uid'], self.environment['guard_uid']}
        for path in Path('/proc').iterdir():
            if not path.name.isdigit():
                continue
            try:
                values = dict(line.split(':', 1) for line in (path / 'status').read_text().splitlines() if ':' in line)
                if int(values['Uid'].split()[0]) in protected_uids and not values['State'].lstrip().startswith('Z'):
                    raise RuntimeError('native fixture service or bridge remains live')
            except (FileNotFoundError, ProcessLookupError):
                continue
        return {'no_new_containers': True, 'fixture_service_identities_terminated': True}

    def prepare(self):
        for path in (self.root, self.deployment, self.ipc):
            if os.path.lexists(path):
                raise ValueError('a run, deployment or IPC name already exists; preserve it and choose a new name')
        if len(os.fsencode(self.ipc / 'gateway/instance.sock')) >= 100:
            raise ValueError('selected run name makes the instance socket path too long')
        if len(os.fsencode(self.pg_home / 'socket/.s.PGSQL.65535')) >= 104:
            raise ValueError('selected run root makes PostgreSQL Unix socket path too long')
        for path in (self.environment['run_root'], self.environment['deployment_root']):
            if shutil.disk_usage(path).free < 1024**3:
                raise ValueError('at least 1 GiB available space required on each fixture filesystem')
        self.root.mkdir(mode=0o755)
        self.created = True
        self.container_baseline = self.containers()
        self.root.chmod(0o755)  # only the explicitly dropped PostgreSQL uid traverses this parent
        if self.scenario_id == 'native.environment':
            from tests.support.volatile_credentials import verify_binding
            verify_binding(self.root, child_environment(self.environment))
            write_json(self.root / 'volatile-credentials.json', {'binding': 'PASS', 'cleanup': 'PASS'})
        self.deployment.mkdir(mode=0o755)
        self.deployment.chmod(0o755)
        self.pg_home.mkdir(mode=0o700)
        os.chown(self.pg_home, self.environment['postgres_uid'], self.environment['postgres_gid'])
        write_json(self.root / 'selection.json', {'scenario_id': self.scenario_id,
                   'purpose': self.scenario.purpose, 'responsibilities': self.scenario.responsibilities,
                   'provider': 'synthetic-only', 'actual_account': False})
        manifest = {path.name: hash_build_binary(path) for path in sorted(self.environment['bin_dir'].glob('ouroboros-*'))
                    if path.is_file() and re.fullmatch(r'ouroboros-[a-z0-9-]+', path.name)}
        write_json(self.root / 'binaries.json', manifest)
        source_hashes = {}
        source = self.environment['source_root']
        for pattern in ('Cargo.toml', 'Cargo.lock', 'crates/**/*.rs', 'crates/**/*.sql',
                        'crates/**/Cargo.toml', 'scripts/*.py', 'tests/**/*.py', 'tests/**/*.sh', 'tests/fixtures/*.rs'):
            for path in sorted(source.glob(pattern)):
                source_hashes[str(path.relative_to(source))] = hash_file(path)
        write_json(self.root / 'sources.json', source_hashes)
        release = install(self.environment['bin_dir'], self.environment['release_root'], manifest, 0)
        write_json(self.root / 'release.json', release)
        if self.scenario.driver == 'kernel':
            value = verify_kernel_manifest(self.environment['kernel_test_manifest'], self.environment['source_root'])
            candidate = self.root / 'kernel-contracts'
            with candidate.open('xb') as output, Path(value['binary']).open('rb') as incoming:
                shutil.copyfileobj(incoming, output)
                output.flush()
                os.fsync(output.fileno())
            candidate.chmod(0o555)
            if hash_file(candidate) != value['sha256']:
                raise ValueError('kernel harness changed during protected copying')
            return
        image = self.environment['checkpoint_read_image' if self.scenario.image_kind == 'checkpoint-read-barrier' else 'native_image']
        self.command(docker(self.environment, 'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
                            '--security-opt=no-new-privileges', '--pids-limit=32', '--memory=128m',
                            '--user=65532:65532', '--env=HOME=/home/agent', '--env=CODEX_HOME=/home/agent',
                            '--tmpfs=/home/agent:rw,nosuid,nodev,size=16m,uid=65532,gid=65532',
                            '--tmpfs=/tmp:rw,nosuid,nodev,size=16m,uid=65532,gid=65532',
                            '--entrypoint=/usr/local/bin/codex', image, '--version'),
                     'codex-version', timeout=20)
        if (self.root / 'codex-version.log').read_text().strip() != 'codex-cli ' + CODEX_VERSION:
            raise ValueError('actual native executable is not the selected official Codex version')
        labels = json.loads(subprocess.run(docker(self.environment, 'image', 'inspect', image),
                                           env=self.env, check=True, capture_output=True, timeout=15).stdout)[0]['Config']['Labels']
        self.command(docker(self.environment, 'run', '--rm', '--network=none', '--read-only', '--cap-drop=ALL',
                            '--security-opt=no-new-privileges', '--pids-limit=16', '--memory=64m',
                            '--user=65532:65532', '--entrypoint=/bin/sha256sum', image,
                            '/usr/local/bin/ouroboros-cli', '/usr/local/bin/ouroboros-materialize',
                            '/usr/local/bin/ouroboros-fixture-net-probe'),
                     'native-image-binaries', timeout=20)
        expected = {'/usr/local/bin/ouroboros-cli': labels[CLI_LABEL],
                    '/usr/local/bin/ouroboros-materialize': labels[MATERIALIZER_LABEL],
                    '/usr/local/bin/ouroboros-fixture-net-probe': labels[PROBE_LABEL]}
        observed = {}
        for line in (self.root / 'native-image-binaries.log').read_text().splitlines():
            digest, path = line.split()
            observed[path] = digest
        if observed != expected:
            raise ValueError('native image binaries do not match their recorded build identities')
        password = secrets.token_hex(24)
        password_file = self.pg_home / 'initial-password'
        password_file.write_text(password)
        password_file.chmod(0o400)
        os.chown(password_file, self.environment['postgres_uid'], self.environment['postgres_gid'])
        self.command([self.environment['pg_bin'] / 'initdb', '-D', self.data, '--username=fixture_owner',
                      '--auth-local=scram-sha-256', '--auth-host=scram-sha-256',
                      '--pwfile', password_file, '--no-locale'], 'initdb', postgres=True)
        password_file.unlink()
        self.pg_port = free_ports(['database'])['database']
        pg_socket = self.pg_home / 'socket'
        pg_socket.mkdir(mode=0o700)
        os.chown(pg_socket, self.environment['postgres_uid'], self.environment['postgres_gid'])
        with (self.data / 'postgresql.conf').open('a') as stream:
            # Config paths have no shell expansion; escape PostgreSQL string literals.
            socket_literal = str(pg_socket).replace("'", "''")
            stream.write(f"\nlisten_addresses='127.0.0.1'\nport={self.pg_port}\nunix_socket_directories='{socket_literal}'\n"
                         "shared_buffers='32MB'\nmax_connections=40\nfsync=on\nsynchronous_commit=on\nfull_page_writes=on\n")
        self.start_database()
        admin = self.root / 'admin.url'
        admin.write_text(f'postgresql://fixture_owner:{password}@127.0.0.1:{self.pg_port}/postgres?sslmode=disable\n')
        admin.chmod(0o600)
        ports = free_ports(['core', 'gateway', 'company', 'catalog', 'fixture'])
        ports['bridge'] = 18080
        write_json(self.config_file, {
            'root': str(self.deployment / 'test'), 'bin_dir': release['bin_dir'],
            'bind_host': '127.0.0.1', 'ports': ports, 'admin_url_file': str(admin),
            'disposable_database': True,
            'runtime': {'docker_socket': str(self.environment['docker_socket']), 'ipc_root': str(self.ipc),
                        'image': image, 'bridge_uid': self.environment['bridge_uid'],
                        'guard_uid': self.environment['guard_uid']},
        })

    def execute(self):
        if self.scenario.driver == 'kernel':
            self.command([self.root / 'kernel-contracts', '--ignored', '--exact', TEST_NAME,
                          '--test-threads=1', '--nocapture'], 'kernel-contracts', timeout=30)
            output = (self.root / 'kernel-contracts.log').read_text()
            if not re.search(r'test result: ok\. 1 passed; 0 failed; 0 ignored;', output):
                raise RuntimeError('required kernel contract did not execute exactly once')
            proof = self.deployment / 'test'
            proof.mkdir(mode=0o700)
            write_json(proof / 'result.json', {'result': 'PASS', 'scenario_id': self.scenario_id,
                       'test_name': TEST_NAME, 'passed': 1, 'failed': 0, 'ignored': 0})
            return
        driver = {'management': 'test-connected-management-guest.py',
                  'program': 'test-connected-program-guest.py'}.get(self.scenario.driver, 'test-connected-native-guest.py')
        options = {'management': [], 'program': ['--restriction', 'complete']}.get(
            self.scenario.driver, ['--scenario', self.scenario_id])
        if self.scenario_id == 'native.program-continuation':
            options += ['--adapter-verification', '--service-continuation']
        self.command([sys.executable, '-B', self.environment['source_root'] / 'tests/integration' / driver,
                      '--config', self.config_file, *options], 'program', timeout=300)
        result_file = self.deployment / 'test/result.json'
        result = json.loads(result_file.read_text())
        if result.get('result') != 'PASS' or (self.scenario.driver not in ('management', 'program') and result.get('scenario_id') != self.scenario_id):
            raise RuntimeError('connected fixture did not prove the selected named scenario')
        if self.scenario.driver == 'management' and (len(result.get('bound_instances', {})) != 2 or result.get('cleanup') != 'complete'):
            raise RuntimeError('two-instance management or cleanup proof missing')
        if self.scenario.driver == 'program':
            if (result.get('cleanup') != 'complete' or result.get('program_natural_exit') != 'PASS'
                    or result.get('compute_settlement') != 'PASS' or result.get('successful_successor') != 'PASS'):
                raise RuntimeError('generic program completion, compute replay or current-authority successor proof missing')
            if self.scenario_id == 'native.program-continuation':
                continuation = result.get('service_continuation', {})
                final = continuation.get('final', {})
                if (continuation.get('result') != 'PASS' or final.get('state') != 'stopped'
                        or final.get('restarts_used') != 1 or final.get('compute_returned') is not True):
                    raise RuntimeError('actual Company recovery and owner stop proof missing')
        if self.scenario.driver == 'installation':
            release = json.loads((self.root / 'release.json').read_text())
            install_root = self.deployment / 'test/installation-faults'
            self.command([sys.executable, '-B', self.environment['source_root'] / 'tests/integration/test-service-install.py',
                          '--binary', Path(release['bin_dir']) / 'ouroboros-service-unit',
                          '--bundle', self.deployment / 'test/service-bundle.json',
                          '--root', install_root, '--faults'], 'installation-faults', timeout=120)
            proof = json.loads((install_root / 'result.json').read_text())
            if proof.get('result') != 'PASS' or proof.get('fsync_fault_points') != [1, 3, 7, 9, 13]:
                raise RuntimeError('installation fault and resumption proof missing')
            write_json(self.deployment / 'test/installation-faults-result.json', proof)
        if self.scenario.restart:
            command = [sys.executable, '-B', self.environment['source_root'] / 'tests/recovery/test-existing-storage-guest.py',
                       '--config', self.config_file]
            self.command([*command, '--phase', 'before'], 'cold-before', timeout=60)
            self.stop_database()
            self.command([self.environment['pg_bin'] / 'pg_controldata', self.data], 'cold-control-data', postgres=True)
            if not re.search(r'Database cluster state:\s+shut down', (self.root / 'cold-control-data.log').read_text()):
                raise RuntimeError('cold restart requires an observed clean database shutdown')
            self.start_database()
            extra = {'storage': [], 'load': ['--load'], 'native': ['--native-recovery'],
                     'services': ['--system-services']}[self.scenario.restart]
            self.command([*command, '--phase', 'after', *extra], 'cold-after', timeout=180)
            after = json.loads((self.deployment / 'test/cold-restart-result.json').read_text())
            if after.get('result') != 'PASS':
                raise RuntimeError('cold restart proof missing')

    def run(self):
        error = None
        cleanup = {'database': 'NOT RUN', 'runtime': 'NOT RUN', 'evidence': 'NOT RUN', 'errors': []}
        try:
            self.prepare()
            self.execute()
        except (Exception, KeyboardInterrupt) as caught:
            error = type(caught).__name__
            # Detailed errors and argv stay in protected local logs; no credentials in the public report.
            if self.created:
                write_json(self.root / 'failure.json', {'type': error, 'stage': self.commands[-1]['step'] if self.commands else 'prepare'})
        finally:
            if self.created:
                try:
                    cleanup['evidence'] = evidence_export(self.deployment / 'test', self.root / 'evidence')
                except Exception as caught:
                    cleanup['errors'].append({'step': 'evidence_export', 'type': type(caught).__name__})
                try:
                    cleanup['runtime'] = self.observe_runtime_cleanup()
                except Exception as caught:
                    cleanup['errors'].append({'step': 'runtime_cleanup', 'type': type(caught).__name__})
                try:
                    cleanup['database'] = self.stop_database()
                except Exception as caught:
                    cleanup['errors'].append({'step': 'postgres_stop', 'type': type(caught).__name__})
                write_json(self.root / 'commands.json', self.commands)
                write_json(self.root / 'cleanup.json', cleanup)
        status = 'PASS' if error is None and not cleanup['errors'] else 'FAIL'
        from tests.support.ci_report import traceback_locations
        locations = []
        if error and self.created:
            for path in (self.root / 'program.log',):
                if path.is_file() and not path.is_symlink():
                    with path.open('rb') as stream:
                        stream.seek(max(0, path.stat().st_size - 262144))
                        locations.extend(traceback_locations(stream.read().decode('utf-8', errors='replace')))
        report = {'failure_locations': locations, 'scenario_id': self.scenario_id, 'status': status, 'error_type': error,
                  'cleanup_complete': not cleanup['errors'], 'actual_account': False,
                  'subscription': 'NOT RUN', 'model_provider': 'synthetic-only'}
        if self.created:
            write_json(self.root / 'report.json', report)
        return report


def main():
    signal.signal(signal.SIGTERM, interrupted)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--preflight', action='store_true')
    parser.add_argument('--environment', type=Path)
    parser.add_argument('--scenario', choices=tuple(SCENARIOS), action='append')
    parser.add_argument('--run-name')
    args = parser.parse_args()
    if args.list:
        if args.preflight or args.environment or args.scenario or args.run_name:
            parser.error('--list must be used alone')
        print(json.dumps(catalogue(), indent=2))
        return 0
    if args.environment is None:
        parser.error('--environment is required')
    if not args.preflight and (not args.scenario or not args.run_name):
        parser.error('--scenario and --run-name are required for execution')
    if args.run_name is not None and not re.fullmatch(r'[a-z][a-z0-9-]{0,31}', args.run_name):
        parser.error('--run-name must be a new lowercase name, at most 32 characters')
    if args.scenario and len(args.scenario) != len(set(args.scenario)):
        parser.error('a scenario may only be selected once in a suite invocation')
    try:
        data = load_environment(args.environment)
        if any(select_scenario(name).driver == 'kernel' for name in args.scenario or []):
            if 'kernel_test_manifest' not in data:
                raise ValueError('selected kernel contract requires an explicit prebuilt test manifest')
            verify_kernel_manifest(data['kernel_test_manifest'], data['source_root'])
        observed = preflight(data, any(select_scenario(name).image_kind == 'checkpoint-read-barrier'
                                       for name in args.scenario or []))
        if args.preflight:
            print(json.dumps(observed, indent=2))
            return 0
        os.umask(0o077)
        # Fixed OS identities are intentionally not shared by simultaneous suite runs.
        # A kernel lock, not a stale file, decides whether another run is active.
        # Fixed fixture UIDs are host-wide, so separate deployment roots cannot have
        # separate locks. This is a Linux coordination path, never a user-machine path.
        lock_path = Path('/run/lock/ouroboros-native-validation.lock')
        if lock_path.parent.resolve(strict=True) != lock_path.parent or lock_path.parent.stat().st_uid != 0:
            raise ValueError('host-wide native lock directory is not trusted')
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(lock_fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1 or stat.S_IMODE(info.st_mode) != 0o600:
                raise ValueError('native suite lock identity is invalid')
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            results = []
            for index, name in enumerate(args.scenario):
                run_name = args.run_name if len(args.scenario) == 1 else f'{args.run_name}-{index + 1}'
                result = NativeRun(data, name, run_name).run()
                results.append(result)
                print(json.dumps(result), flush=True)
                if result['status'] != 'PASS':
                    return 1  # Stop after failure; never silently retry or skip a selected case.
            return 0
        finally:
            os.close(lock_fd)
    except (OSError, ValueError, subprocess.SubprocessError, KeyboardInterrupt) as error:
        print(json.dumps({'status': 'FAIL', 'stage': 'preflight-or-launch', 'error_type': type(error).__name__,
                          'actual_account': False}), flush=True)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
