#!/usr/bin/env python3
"""Build, but never execute, the source-bound Linux kernel contract harness."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import signal
import stat
import subprocess

from native_image_identity import source_digest
from native_kernel_contract import TEST_NAME, verify_manifest


def artifact(log, target):
    selected = []
    finished = 0
    for line in log.read_text().splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        if event.get('reason') == 'build-finished':
            if event.get('success') is not True:
                raise ValueError('kernel contract build did not succeed')
            finished += 1
        if event.get('reason') == 'compiler-artifact' and event.get('executable') is not None:
            if (event.get('target', {}).get('name') != 'ouroboros_runtime'
                    or event.get('target', {}).get('kind') != ['lib']
                    or event.get('profile', {}).get('test') is not True):
                raise ValueError('unexpected executable in kernel contract build')
            selected.append(Path(event['executable']))
    if finished != 1 or len(selected) != 1:
        raise ValueError('Cargo must identify exactly one successful kernel harness build')
    binary = selected[0]
    if (not binary.is_absolute() or binary.resolve(strict=True) != binary
            or binary.parent != target / 'debug/deps'):
        raise ValueError('kernel contract executable differs from the selected build directory')
    return binary


def _identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_uid, info.st_nlink,
            info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def protect_harness(binary):
    """Normalize only the exact Cargo-observed, caller-owned standalone executable."""
    descriptor = os.open(binary, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        info = os.fstat(stream.fileno())
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1
                or not info.st_mode & stat.S_IXUSR or not 0 < info.st_size <= 128 * 1024**2
                or _identity(info) != _identity(binary.lstat())):
            raise ValueError('kernel harness must be the caller-owned ordinary Cargo executable')
        os.fchmod(stream.fileno(), 0o755)
        os.fsync(stream.fileno())
        protected = os.fstat(stream.fileno())
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if (_identity(protected) != _identity(os.fstat(stream.fileno()))
                or _identity(protected) != _identity(binary.lstat())):
            raise ValueError('kernel harness changed while binding its permissions and digest')
    return digest


def publish_manifest(manifest, root, output):
    # Failed qualification preserves only an explicitly partial candidate. A final name
    # is published only after the same strict verifier used by the Runtime succeeds.
    partial = output.with_name(output.name + '.partial')
    with partial.open('x') as stream:
        os.fchmod(stream.fileno(), 0o600)
        json.dump(manifest, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    verify_manifest(partial, root)
    os.link(partial, output)
    partial.unlink()
    directory = os.open(output.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def build(root, target, output):
    if platform.system() != 'Linux' or platform.machine() not in ('aarch64', 'arm64'):
        raise ValueError('kernel contract compilation requires the Linux ARM64 reference host')
    for path in (root, target):
        if not path.is_absolute() or path.resolve(strict=True) != path or not path.is_dir():
            raise ValueError('source and target must be exact existing absolute directories')
    if (not output.is_absolute() or output.parent.resolve(strict=True) != output.parent
            or os.path.lexists(output)):
        raise ValueError('kernel manifest requires a new exact output path')
    before = source_digest(root)
    log_path = output.with_name(output.name + '.private.log')
    with log_path.open('xb') as log:
        os.fchmod(log.fileno(), 0o600)
        command = ['cargo', 'test', '--manifest-path', str(root / 'Cargo.toml'),
                   '-p', 'ouroboros-runtime', '--lib', '--no-run', '--locked', '--offline',
                   '--target-dir', str(target), '--message-format=json']
        allowed = {'PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'CARGO_HOME', 'RUSTUP_HOME',
                   'RUSTUP_TOOLCHAIN', 'CARGO_INCREMENTAL', 'CARGO_PROFILE_DEV_DEBUG',
                   'CARGO_PROFILE_TEST_DEBUG', 'LANG', 'LC_ALL'}
        environment = {key: value for key, value in os.environ.items() if key in allowed}
        child = subprocess.Popen(command, cwd=root, stdin=subprocess.DEVNULL, stdout=log,
                                 stderr=log, env=environment, start_new_session=True, umask=0o077)
        try:
            status = child.wait(timeout=1200)
        except BaseException:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait(timeout=5)
            raise
        if status != 0:
            raise ValueError('kernel contract compilation failed')
    if log_path.stat().st_size > 64 * 1024**2:
        raise ValueError('kernel build evidence exceeds bound')
    binary = artifact(log_path, target)
    if source_digest(root) != before:
        raise ValueError('kernel contract source changed while building')
    manifest = dict(version=1, source_sha256=before, binary=str(binary),
                    sha256=protect_harness(binary), test_name=TEST_NAME)
    publish_manifest(manifest, root, output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--target-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.source_root, args.target_dir, args.output)))


if __name__ == '__main__':
    main()
