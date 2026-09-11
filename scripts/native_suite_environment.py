"""Explicit disposable-host bindings and read-only preflight for native scenarios."""
import json
import os
from pathlib import Path
import platform
import re
import stat
import subprocess

from native_image_identity import SOURCE_LABEL, CLI_LABEL, MATERIALIZER_LABEL, PROBE_LABEL, source_digest

CODEX_VERSION = '0.153.4'
_FIELDS = {
    'version', 'disposable_host', 'source_root', 'bin_dir', 'run_root',
    'deployment_root', 'ipc_root', 'release_root', 'pg_bin', 'postgres_uid',
    'postgres_gid', 'docker_socket', 'native_image', 'checkpoint_read_image',
    'codex_version', 'bridge_uid', 'guard_uid', 'kernel_test_manifest',
}
_PATHS = ('source_root', 'bin_dir', 'run_root', 'deployment_root', 'ipc_root',
          'release_root', 'pg_bin', 'docker_socket')


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate environment field')
        result[key] = value
    return result


def absolute_path(value):
    if not isinstance(value, str) or any(ord(c) < 32 for c in value):
        raise ValueError('environment paths must be explicit absolute paths')
    path = Path(value)
    if (not path.is_absolute() or path == Path('/') or '..' in path.parts
            or str(path) != value or any(p.is_symlink() for p in (path, *path.parents))):
        raise ValueError('environment paths cannot be aliases, roots or relative paths')
    return path


def load_environment(filename):
    filename = absolute_path(str(filename))
    data = json.loads(filename.read_text(), object_pairs_hook=_object)
    if not isinstance(data, dict) or set(data) - _FIELDS:
        raise ValueError('unknown native suite environment field')
    if (_FIELDS - {'checkpoint_read_image', 'kernel_test_manifest'}) - set(data):
        raise ValueError('missing native suite environment field')
    if data['version'] != 1 or data['disposable_host'] is not True:
        raise ValueError('version 1 and explicit disposable_host acknowledgement required')
    if data['codex_version'] != CODEX_VERSION:
        raise ValueError('native suite supports only the source-pinned Codex version')
    for key in _PATHS:
        data[key] = absolute_path(data[key])
    if 'kernel_test_manifest' in data:
        data['kernel_test_manifest'] = absolute_path(data['kernel_test_manifest'])
    for key in ('native_image', 'checkpoint_read_image'):
        if key in data and not re.fullmatch(r'sha256:[a-f0-9]{64}', data[key]):
            raise ValueError('native images must be exact immutable image IDs')
    for key in ('postgres_uid', 'postgres_gid', 'bridge_uid', 'guard_uid'):
        if type(data[key]) is not int or not (100000 if key in ('bridge_uid', 'guard_uid') else 1) <= data[key] < 2**32 - 1:
            raise ValueError('explicit non-root fixture identities required')
    if (len({data['postgres_uid'], data['bridge_uid'], data['guard_uid']}) != 3
            or any(data[key] in {*range(70001, 70009), 65532} for key in ('postgres_uid', 'bridge_uid', 'guard_uid'))):
        raise ValueError('database, bridge, guard and fixed fixture identities must be distinct')
    outputs = [data[key] for key in ('run_root', 'deployment_root', 'ipc_root', 'release_root')]
    inputs = [data[key] for key in ('source_root', 'bin_dir', 'pg_bin')]
    for index, path in enumerate(outputs):
        for other in [*outputs[index + 1:], *inputs]:
            if path == other or path in other.parents or other in path.parents:
                raise ValueError('fixture output roots must be separate from one another and all inputs')
    if not (data['source_root'] / 'scripts/test-connected-native-guest.py').is_file():
        raise ValueError('source_root must identify the checkout containing the connected native fixture')
    return data


def child_environment(data, home=None):
    """A positive allowlist: account, proxy, SDK and user shell settings never propagate."""
    result = {'PATH': str(data['pg_bin']) + ':/usr/local/bin:/usr/bin:/bin',
              'LANG': 'C.UTF-8', 'LC_ALL': 'C.UTF-8', 'PYTHONDONTWRITEBYTECODE': '1'}
    if home is not None:
        result['HOME'] = str(home)
        result['TMPDIR'] = str(home)
    return result


def command_output(args, data, timeout=15):
    return subprocess.run([str(arg) for arg in args], env=child_environment(data),
                          check=True, capture_output=True, timeout=timeout).stdout


def docker(data, *args):
    return ['docker', '--host', 'unix://' + str(data['docker_socket']), *args]


def preflight(data, require_barrier=False):
    if platform.system() != 'Linux' or platform.machine() not in ('aarch64', 'arm64') or os.geteuid() != 0:
        raise ValueError('native scenarios require root in an explicitly disposable Linux ARM64 VM')
    if Path('/proc/1/comm').read_text().strip() != 'systemd':
        raise ValueError('native reference suite requires systemd as PID 1')
    if not {'cpu', 'memory', 'pids'} <= set(Path('/sys/fs/cgroup/cgroup.controllers').read_text().split()):
        raise ValueError('cgroup v2 CPU, memory and PID controllers required')
    fd = os.pidfd_open(os.getpid())
    os.close(fd)
    for key in ('run_root', 'deployment_root', 'ipc_root', 'release_root'):
        path = data[key]
        for ancestor in (path, *path.parents):
            info = ancestor.lstat()
            if (not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022
                    or not info.st_mode & 0o001):
                raise ValueError('native output roots and ancestry must be protected root-owned directories traversable by fixture identities')
    info = data['docker_socket'].lstat()
    if not stat.S_ISSOCK(info.st_mode) or info.st_uid != 0:
        raise ValueError('explicit root-owned Docker Unix socket required')
    for name in ('initdb', 'postgres', 'pg_ctl', 'pg_isready', 'pg_controldata', 'psql'):
        if not os.access(data['pg_bin'] / name, os.X_OK):
            raise ValueError('missing explicitly selected PostgreSQL executable')
    for name in ('ouroboros-core', 'ouroboros-gateway', 'ouroboros-resources', 'ouroboros-runtime',
                 'ouroboros-cli', 'ouroboros-migrate', 'ouroboros-service-unit',
                 'ouroboros-storage', 'ouroboros-resource-migrate', 'ouroboros-materialize',
                 'ouroboros-bridge', 'ouroboros-guard'):
        if not os.access(data['bin_dir'] / name, os.X_OK):
            raise ValueError('missing native suite product executable: ' + name)
    pg_version = command_output([data['pg_bin'] / 'postgres', '--version'], data).decode().strip()
    if not re.fullmatch(r'postgres \(PostgreSQL\) 18\.6(?: .*|)', pg_version):
        raise ValueError('native reference suite requires PostgreSQL 18.6')
    docker_info = json.loads(command_output(docker(data, 'info', '--format', '{{json .}}'), data))
    if docker_info.get('CgroupVersion') != '2' or docker_info.get('OSType') != 'linux':
        raise ValueError('Docker must use Linux cgroup v2')
    if require_barrier and 'checkpoint_read_image' not in data:
        raise ValueError('selected scenario requires an explicitly prepared checkpoint-read barrier image')
    images = {}
    expected_source = source_digest(data['source_root'])
    for key in ('native_image', 'checkpoint_read_image'):
        if key not in data:
            continue
        observed = json.loads(command_output(docker(data, 'image', 'inspect', data[key]), data))[0]
        if observed.get('Id') != data[key] or observed.get('Architecture') != 'arm64' or observed.get('Os') != 'linux':
            raise ValueError('native image identity or architecture does not match the selected profile')
        labels = observed.get('Config', {}).get('Labels') or {}
        if labels.get(SOURCE_LABEL) != expected_source:
            raise ValueError('native image was not built from the current checkout inputs')
        if any(not re.fullmatch(r'[a-f0-9]{64}', labels.get(label, '')) for label in (CLI_LABEL, MATERIALIZER_LABEL, PROBE_LABEL)):
            raise ValueError('native image lacks exact embedded CLI/materializer identities')
        images[key] = {'image_id': observed['Id'], 'source_sha256': expected_source,
                       'cli_sha256': labels[CLI_LABEL], 'materializer_sha256': labels[MATERIALIZER_LABEL], 'probe_sha256': labels[PROBE_LABEL]}
    return {'platform': 'linux-arm64', 'root': True, 'systemd': True, 'cgroup_v2': True,
            'pidfd': True, 'postgres': pg_version, 'docker': docker_info.get('ServerVersion'),
            'images': images, 'codex_version_expected': CODEX_VERSION,
            'actual_provider_calls': False, 'native_execution': 'NOT RUN'}
