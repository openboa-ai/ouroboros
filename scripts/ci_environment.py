#!/usr/bin/env python3
"""Prepare explicit, disposable GitHub-hosted test bindings; never use a developer VM.

This helper is only for the checked-in workflow. Local checks consume an operator's
explicit environment JSON directly. It never imports account state or provider keys.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import pwd
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RUST = '1.94.1'
AGE_ARCHIVE = '6b8dc4333c53a5a57c9e5834e3a48f92605d7154014cd07269ff3327db5d37f4'
AGE_TOOLS = {'age': '41b072352f4561018949623c674d16ef704019b9108a9bbdbd21292efebfc94f',
             'age-keygen': '00b549cebf68302893fc489830f37e706712689ca877f84d85439d700d2997c7'}  # public binary SHA-256; gitleaks:allow


def child_environment():
    names = ('PATH', 'HOME', 'CARGO_HOME', 'RUSTUP_HOME', 'RUSTUP_TOOLCHAIN',
             'CARGO_INCREMENTAL', 'CARGO_PROFILE_DEV_DEBUG', 'CARGO_PROFILE_TEST_DEBUG')
    result = {name: os.environ[name] for name in names if name in os.environ}
    result.update(LANG='C.UTF-8', LC_ALL='C.UTF-8', PYTHONDONTWRITEBYTECODE='1')
    return result


def run(argv, *, timeout=600, capture=False, env=None):
    return subprocess.run([str(arg) for arg in argv], check=True, cwd=ROOT,
                          stdin=subprocess.DEVNULL, env=env or child_environment(),
                          stdout=subprocess.PIPE if capture else None,
                          timeout=timeout).stdout


def hosted():
    if (os.environ.get('GITHUB_ACTIONS') != 'true'
            or os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted'
            or Path(os.environ.get('GITHUB_WORKSPACE', '')).resolve() != ROOT
            or os.geteuid() == 0):
        raise ValueError('requires the nonroot job user in this checkout on a disposable GitHub-hosted VM')


def linux():
    if (platform.system() != 'Linux' or platform.machine() != 'aarch64'
            or 'VERSION_ID="24.04"' not in Path('/etc/os-release').read_text()):
        raise ValueError('this lane requires the Ubuntu 24.04 ARM64 reference VM')


def private_directory(path):
    if path.is_symlink() or any(parent.is_symlink() for parent in path.parents):
        raise ValueError('CI paths cannot traverse symbolic aliases')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    path = path.resolve(strict=True)
    info = path.stat()
    if info.st_uid != os.getuid() or not stat.S_ISDIR(info.st_mode):
        raise ValueError('runner-owned directory required')
    path.chmod(0o700)
    return path


def write_json(path, value):
    with path.open('x') as stream:
        os.fchmod(stream.fileno(), 0o600)
        json.dump(value, stream, indent=2)
        stream.write('\n')


def download(url, path, maximum, digest=None):
    # Suppress ambient proxy routing; only public official release material is downloaded.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url, timeout=60) as response, path.open('xb') as target:
        total = 0
        checksum = hashlib.sha256()
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > maximum:
                raise ValueError('public dependency exceeds download bound')
            checksum.update(chunk)
            target.write(chunk)
    if digest is not None and checksum.hexdigest() != digest:
        raise ValueError('public dependency digest mismatch')


def postgres(stage):
    linux()
    run(['sudo', '-n', 'apt-get', 'update', '-qq'])
    run(['sudo', '-n', 'apt-get', 'install', '-y', '--no-install-recommends',
         'ca-certificates', 'curl', 'gnupg', 'build-essential', 'pkg-config', 'libssl-dev'])
    key = stage / 'postgresql.asc'
    download('https://www.postgresql.org/media/keys/ACCC4CF8.asc', key, 65536)
    info = run(['gpg', '--batch', '--show-keys', '--with-colons', key], capture=True).decode()
    fingerprints = [line.split(':')[9] for line in info.splitlines() if line.startswith('fpr:')]
    if not fingerprints or fingerprints[0] != 'B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8':
        raise ValueError('PostgreSQL signing identity differs from the reviewed key')
    run(['sudo', '-n', 'install', '-m', '0644', key, '/usr/share/keyrings/ouroboros-pgdg.asc'])
    source = stage / 'pgdg.list'
    source.write_text('deb [signed-by=/usr/share/keyrings/ouroboros-pgdg.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main\n')
    run(['sudo', '-n', 'install', '-m', '0644', source, '/etc/apt/sources.list.d/ouroboros-pgdg.list'])
    run(['sudo', '-n', 'apt-get', 'update', '-qq'])
    versions = run(['apt-cache', 'madison', 'postgresql-18'], capture=True).decode()
    candidates = [row.split('|')[1].strip() for row in versions.splitlines() if '|' in row]
    version = next((v for v in candidates if re.fullmatch(r'18\.6-[A-Za-z0-9.+~]+', v)), None)
    if version is None:
        raise ValueError('PGDG no longer offers pinned PostgreSQL 18.6; explicitly qualify a replacement')
    # The fixture starts its own finite clusters; package installation must not create one.
    setting = stage / 'createcluster.conf'
    setting.write_text('create_main_cluster = false\n')
    run(['sudo', '-n', 'install', '-d', '-m', '0755', '/etc/postgresql-common'])
    run(['sudo', '-n', 'install', '-m', '0644', setting, '/etc/postgresql-common/createcluster.conf'])
    run(['sudo', '-n', 'env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y',
         '-o', 'Dpkg::Options::=--force-confold', '--no-install-recommends',
         'postgresql-18=' + version, 'postgresql-client-18=' + version])
    binary = Path('/usr/lib/postgresql/18/bin')
    actual = run([binary / 'postgres', '--version'], capture=True).decode().strip()
    if re.fullmatch(r'postgres \(PostgreSQL\) 18\.6(?: .*|)', actual) is None:
        raise ValueError('installed PostgreSQL does not match the pinned profile')
    return binary


def age(stage):
    linux()
    archive = stage / 'age.tar.gz'
    download('https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-arm64.tar.gz',
             archive, 20 * 1024 * 1024, AGE_ARCHIVE)
    outputs = {}
    with tarfile.open(archive, 'r:gz') as source:
        for name, digest in AGE_TOOLS.items():
            entry = source.getmember('age/' + name)
            if not entry.isfile() or entry.size > 64 * 1024 * 1024:
                raise ValueError('invalid pinned age executable')
            incoming = source.extractfile(entry)
            content = incoming.read()
            if hashlib.sha256(content).hexdigest() != digest:
                raise ValueError('age executable digest mismatch')
            output = stage / name
            with output.open('xb') as stream:
                stream.write(content)
            output.chmod(0o700)
            outputs[name] = str(output)
    return outputs


def native(config, stage):
    linux()
    if Path('/proc/1/comm').read_text().strip() != 'systemd':
        raise ValueError('native lane requires a real systemd VM, not a job container')
    if not {'cpu', 'memory', 'pids'} <= set(Path('/sys/fs/cgroup/cgroup.controllers').read_text().split()):
        raise ValueError('native lane requires cgroup v2 CPU/memory/PID controllers')
    handle = os.pidfd_open(os.getpid())
    os.close(handle)
    socket = Path('/run/docker.sock')
    if not socket.is_socket() or socket.is_symlink() or socket.stat().st_uid != 0:
        raise ValueError('root-owned fixed Docker socket missing; no alternate backend')
    environment = child_environment()
    environment.update(OURO_TEST_PROFILE='linux-aarch64-reference', OURO_TEST_STAGE_ROOT=str(stage),
                       OURO_DOCKER_SOCKET=str(socket), CARGO_TARGET_DIR=config['target_dir'])
    image = None
    for script in ('prepare-codex-fixture.sh', 'prepare-connected-native.sh', 'prepare-connected-program.sh'):
        command = ['bash', ROOT / 'scripts' / script]
        if image is not None:
            command.append(image)
        output = run(command, timeout=1200, capture=True, env=environment).decode()
        identities = re.findall(r'^sha256:[a-f0-9]{64}$', output, re.MULTILINE)
        if not identities:
            raise ValueError('image preparation did not return an immutable identity')
        image = identities[-1]
    barrier = run(['sudo', '-n', 'env', '-i', 'PATH=/usr/local/bin:/usr/bin:/bin', 'python3',
                   ROOT / 'scripts/prepare-checkpoint-read-fixture.py', '--image', image,
                   '--socket', socket], capture=True).decode().splitlines()[-1]
    barrier = json.loads(barrier)['image_id']
    base = Path('/var/lib/ouroboros-ci')
    roots = {name: base / name for name in ('runs', 'deployments', 'ipc', 'releases')}
    run(['sudo', '-n', 'install', '-d', '-m', '0755', base, *roots.values()])
    identity = pwd.getpwnam('postgres')
    kernel_target = private_directory(Path(config['target_dir']) / 'kernel-tests')
    kernel_manifest = stage / 'kernel-contract.json'
    run(['python3', ROOT / 'scripts/prepare-kernel-contract.py', '--source-root', ROOT,
         '--target-dir', kernel_target, '--output', kernel_manifest], timeout=1230)
    data = dict(version=1, disposable_host=True, source_root=str(ROOT), bin_dir=config['bin_dir'],
                run_root=str(roots['runs']), deployment_root=str(roots['deployments']),
                ipc_root=str(roots['ipc']), release_root=str(roots['releases']),
                pg_bin=config['pg_bin'], postgres_uid=identity.pw_uid, postgres_gid=identity.pw_gid,
                docker_socket=str(socket), native_image=image, checkpoint_read_image=barrier,
                codex_version='0.153.4', bridge_uid=130001, guard_uid=130002, kernel_test_manifest=str(kernel_manifest))
    path = stage / 'native-environment.json'
    write_json(path, data)
    return str(path)


def prepare(lane, output):
    hosted()
    local = private_directory(ROOT / '.local')
    target = private_directory(local / 'target')
    private_directory(target / 'debug')
    scratch = Path(tempfile.mkdtemp(prefix='ouro-ci-', dir=Path(os.environ['RUNNER_TEMP']).resolve(strict=True)))
    scratch.chmod(0o700)
    config = dict(target_dir=str(target), bin_dir=str(target / 'debug'), scratch_root=str(scratch),
                  build_manifest=str(local / 'build.json'))
    if lane != 'integrity':
        if platform.system() != 'Darwin':
            linux()
        run(['rustup', 'toolchain', 'install', RUST, '--profile', 'minimal', '--component', 'clippy,rustfmt'])
        if lane != 'package':
            run(['cargo', 'fetch', '--locked'], timeout=600)
    if lane in ('postgres', 'recovery', 'native'):
        config['pg_bin'] = str(postgres(scratch))
    if lane == 'recovery':
        tools = age(scratch)
        config.update(age=tools['age'], keygen=tools['age-keygen'])
    if lane == 'native':
        config['native_environment'] = native(config, scratch)
    write_json(output, config)


def build_records(manifest):
    if not isinstance(manifest, dict):
        raise ValueError('build manifest must be an object')
    records = manifest.get('binaries')
    if not isinstance(records, list) or not 1 <= len(records) <= 63:
        raise ValueError('build manifest inventory is missing or unbounded')
    result = {}
    for record in records:
        if not isinstance(record, dict):
            raise ValueError('build member must be an object')
        name, digest, size = record.get('name'), record.get('sha256'), record.get('size')
        if (not isinstance(name, str) or re.fullmatch(r'ouroboros-[a-z0-9-]+', name) is None
                or name in result or not isinstance(digest, str) or re.fullmatch(r'[a-f0-9]{64}', digest) is None
                or type(size) is not int or not 0 < size <= 128 * 1024**2):
            raise ValueError('invalid build manifest member')
        result[name] = record
    return result


def bundle(archive):
    local = ROOT / '.local'
    manifest_path = local / 'build.json'
    if manifest_path.is_symlink() or manifest_path.stat().st_size > 1024**2:
        raise ValueError('invalid build manifest file')
    manifest = json.loads(manifest_path.read_text())
    records = build_records(manifest)
    members = [manifest_path] + [local / 'target/debug' / name for name in records]
    with tarfile.open(archive, 'x:gz') as output:
        for path in members:
            if path.is_symlink() or not path.is_file() or path.stat().st_size > 128 * 1024**2:
                raise ValueError('build bundle only contains bounded regular manifest/executables')
            if path.name in records:
                record = records[path.name]
                with path.open('rb') as source:
                    digest = hashlib.file_digest(source, 'sha256').hexdigest()
                if digest != record['sha256'] or path.stat().st_size != record['size']:
                    raise ValueError('binary changed since source-bound build')
            output.add(path, arcname=str(path.relative_to(local)), recursive=False)


def unpack(archive):
    local = private_directory(ROOT / '.local')
    with tarfile.open(archive, 'r:gz') as source:
        members = source.getmembers()
        if not 2 <= len(members) <= 64 or len({entry.name for entry in members}) != len(members):
            raise ValueError('invalid build bundle inventory')
        total = 0
        for entry in members:
            if ((entry.name != 'build.json' and re.fullmatch(r'target/debug/ouroboros-[a-z0-9-]+', entry.name) is None)
                    or not entry.isfile() or not 0 <= entry.size <= 128 * 1024**2):
                raise ValueError('invalid build bundle entry')
            total += entry.size
            if total > 2 * 1024**3:
                raise ValueError('build bundle exceeds capacity')
        manifest_entry = source.getmember('build.json')
        if manifest_entry.size > 1024**2:
            raise ValueError('build manifest exceeds bound')
        manifest = json.load(source.extractfile(manifest_entry))
        records = build_records(manifest)
        if {entry.name for entry in members} != {'build.json', *('target/debug/' + name for name in records)}:
            raise ValueError('bundle and manifest inventories differ')
        # Validate every received byte before replacing any disposable compiled cache output.
        with tempfile.TemporaryDirectory(prefix='received-build-', dir=local) as directory:
            staged = Path(directory)
            for entry in members:
                path = staged / entry.name
                path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with path.open('xb') as output:
                    shutil.copyfileobj(source.extractfile(entry), output)
                if path.name in records:
                    with path.open('rb') as stream:
                        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
                    if digest != records[path.name]['sha256'] or path.stat().st_size != records[path.name]['size']:
                        raise ValueError('received executable differs from build receipt')
            for entry in members:
                path = local / entry.name
                private_directory(path.parent)
                if path.is_symlink() or (path.exists() and not path.is_file()):
                    raise ValueError('build destination must be an ordinary compiled-cache file')
            for entry in members:
                path = local / entry.name
                candidate = staged / entry.name
                candidate.chmod(0o600 if entry.name == 'build.json' else 0o755)
                os.replace(candidate, path)


def workflow_summary(case_summary, jobs, report_exit, build_required, mac_required):
    summary = dict(case_summary) if isinstance(case_summary, dict) else {'schema': 1, 'status': 'FAIL', 'missing_case_summary': True}
    required = ['PLAN_RESULT', 'CHECKS_RESULT']
    invalid_flags = build_required not in ('true', 'false') or mac_required not in ('true', 'false')
    if build_required == 'true':
        required.append('BUILD_RESULT')
    if mac_required == 'true':
        required.append('MAC_RESULT')
    failed = {name: jobs.get(name, 'missing') for name in required if jobs.get(name) != 'success'}
    if failed or report_exit != 0 or invalid_flags or summary.get('status') != 'PASS':
        summary.update(status='FAIL', workflow_failures=failed, report_exit=report_exit)
    return summary


def finalize(case_file, output, report_exit):
    case = json.loads(case_file.read_text()) if case_file.is_file() else None
    summary = workflow_summary(case, os.environ, report_exit, os.environ.get('BUILD_REQUIRED'), os.environ.get('MAC_REQUIRED'))
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    write_json(output, summary)
    return 0 if summary['status'] == 'PASS' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    prepare_parser = sub.add_parser('prepare')
    prepare_parser.add_argument('--lane', choices=('integrity', 'build', 'fast', 'postgres', 'native', 'recovery', 'package'), required=True)
    prepare_parser.add_argument('--output', type=Path, required=True)
    for name in ('bundle', 'unpack'):
        sub.add_parser(name).add_argument('--archive', type=Path, required=True)
    final = sub.add_parser('finalize')
    final.add_argument('--case-summary', type=Path, required=True)
    final.add_argument('--output', type=Path, required=True)
    final.add_argument('--report-exit', type=int, required=True)
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args.lane, args.output)
    elif args.command == 'bundle':
        bundle(args.archive)
    elif args.command == 'unpack':
        unpack(args.archive)
    else:
        return finalize(args.case_summary, args.output, args.report_exit)


if __name__ == '__main__':
    raise SystemExit(main())
