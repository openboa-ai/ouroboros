"""Source-bound Cargo outputs and a sanitized, reproducible installation archive.

The caller owns source selection and execution timeouts. build's digest_fn takes no
arguments; execute_fn(command, timeout_seconds, private_log) returns an exit code.
package's caller must check its current source digest before and after the call.
Neither a manifest nor an archive grants installation or operational authority.
"""

import contextlib
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import re
import stat
import subprocess
import tarfile
import tomllib

from tests.support.check_catalog import aggregate_results, validate_plan

DIGEST = re.compile(r'[0-9a-f]{64}')
NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}')


def _digest(value):
    if not isinstance(value, str) or not DIGEST.fullmatch(value):
        raise ValueError('invalid source or executable digest')
    return value


def _exact(path, *, directory=False, new=False):
    path = Path(path)
    checked = path.parent if new else path
    if not path.is_absolute() or checked.resolve(strict=True) != checked:
        raise ValueError('an exact existing absolute path is required')
    if new:
        if path.name in ('', '.', '..') or os.path.lexists(path):
            raise FileExistsError('output already exists')
    elif directory and not path.is_dir():
        raise ValueError('configured directory is not a directory')
    elif not directory and not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError('configured input is not a regular file')
    return path


def _layout(root, config, *, new_manifest=False):
    root = _exact(root, directory=True)
    target = _exact(config['target_dir'], directory=True)
    binary = _exact(config['bin_dir'], directory=True)
    if binary != target / 'debug':
        raise ValueError('binary directory must be this target directory debug profile')
    manifest = _exact(config['build_manifest'], new=new_manifest)
    return root, target, binary, manifest


def _binary_names(root):
    """Discover Cargo's explicit bins, src/main.rs and automatic src/bin targets.

    A feature-gated binary remains required: a profile must build all distribution
    binaries, never silently attest a partial set. Duplicate binary names fail.
    """
    document = tomllib.loads((root / 'Cargo.toml').read_text())
    workspace = document.get('workspace', {})
    members = {root} if 'package' in document else set()
    excluded = set()
    for pattern in workspace.get('exclude', []):
        excluded.update(root.glob(pattern))
    for pattern in workspace.get('members', []):
        relative = Path(pattern)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('workspace member is outside source root')
        found = set(root.glob(pattern)) - excluded
        if not found:
            raise ValueError('workspace member missing')
        members.update(found)
    names = set()
    for member in sorted(members):
        if member.resolve(strict=True) != member or not member.is_relative_to(root):
            raise ValueError('workspace member is not an exact source directory')
        package = tomllib.loads((member / 'Cargo.toml').read_text())
        definition = package['package']
        bins = {entry['name'] for entry in package.get('bin', [])}
        if definition.get('autobins', True):
            if (member / 'src/main.rs').is_file():
                bins.add(definition['name'])
            directory = member / 'src/bin'
            if directory.exists():
                for entry in directory.iterdir():
                    if entry.is_file() and entry.suffix == '.rs':
                        bins.add(entry.stem)
                    elif entry.is_dir() and (entry / 'main.rs').is_file():
                        bins.add(entry.name)
        if any(not NAME.fullmatch(name) for name in bins) or names.intersection(bins):
            raise ValueError('invalid or ambiguous distribution executable name')
        names.update(bins)
    if not names:
        raise ValueError('workspace has no distribution executables')
    return sorted(names)


def _versions(root):
    tools = {}
    for name in ('cargo', 'rustc'):
        text = subprocess.check_output([name, '--version'], cwd=root, timeout=15,
                                       stderr=subprocess.DEVNULL).decode().strip()
        if not re.fullmatch(name + r' [0-9][A-Za-z0-9 .()+_-]{0,200}', text):
            raise ValueError('unsupported tool version response')
        tools[name] = text
    machine = platform.machine()
    system = platform.system()
    if system not in ('Darwin', 'Linux') or not re.fullmatch(r'[A-Za-z0-9_-]{1,32}', machine):
        raise ValueError('unsupported installation platform')
    return {'toolchain': tools, 'platform': {'system': system, 'machine': machine}}


def _identity(info):
    return (info.st_dev, info.st_ino, info.st_uid, info.st_gid, info.st_nlink,
            info.st_mode, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


@contextlib.contextmanager
def _opened_binary(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as binary:
        info = os.fstat(binary.fileno())
        if (not stat.S_ISREG(info.st_mode) or not info.st_mode & stat.S_IXUSR
                or info.st_mode & (stat.S_IWGRP | stat.S_IWOTH) or info.st_size <= 0):
            raise ValueError('distribution input must be a protected executable regular file')
        yield binary, info
        if _identity(os.fstat(binary.fileno())) != _identity(info) or _identity(path.lstat()) != _identity(info):
            raise ValueError('distribution executable changed during observation')


def _record(binary_dir, name):
    with _opened_binary(binary_dir / name) as (binary, info):
        digest = hashlib.file_digest(binary, 'sha256').hexdigest()
    return {'name': name, 'sha256': digest, 'size': info.st_size, 'executable': True}


def _encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()


@contextlib.contextmanager
def _publication(output):
    """Publish only the complete fsynced file, without replacing earlier evidence."""
    output = _exact(output, new=True)
    partial = output.with_name(output.name + '.partial')
    with partial.open('xb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        yield stream
        stream.flush()
        os.fsync(stream.fileno())
    os.link(partial, output)
    partial.unlink()
    descriptor = os.open(output.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _cargo_lines(log):
    with log.open(errors='replace') as source:
        while True:
            line = source.readline(1024 * 1024 + 1)
            if not line:
                return
            if len(line) > 1024 * 1024:
                raise ValueError('Cargo event exceeds observation bound')
            yield line


def _cargo_outputs(log, names, binary_dir):
    observed = set()
    finished = False
    for line in _cargo_lines(log):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        if event.get('reason') == 'build-finished':
            if finished or event.get('success') is not True:
                raise ValueError('Cargo did not finish one successful build')
            finished = True
        if event.get('reason') == 'compiler-artifact' and event.get('executable') is not None:
            name = event.get('target', {}).get('name')
            if (name not in names or name in observed or event['executable'] != str(binary_dir / name)
                    or event.get('target', {}).get('kind') != ['bin']):
                raise ValueError('Cargo executable is outside the selected distribution')
            observed.add(name)
    if not finished or observed != set(names):
        raise ValueError('Cargo did not identify every distribution executable')


@contextlib.contextmanager
def _build_umask():
    previous = os.umask(0o077)
    try:
        yield
    finally:
        os.umask(previous)


def _cargo_aliases(binary_dir, name, info):
    """Accept a sole output or Cargo's accounted-for executable/deps hardlinks.

    Changing an inode with an unaccounted alias could change another user file's
    permissions. Count every allowed alias against nlink before normalizing it.
    Directory scanning is shallow and bounded; links outside this set fail closed.
    """
    if info.st_nlink == 1:
        return []
    if info.st_nlink != 2:
        raise ValueError('build executable has unaccounted hardlinks')
    directory = _exact(binary_dir / 'deps', directory=True)
    pattern = re.compile(re.escape(name.replace('-', '_')) + r'-[0-9a-f]{16}')
    aliases = []
    with os.scandir(directory) as entries:
        for number, entry in enumerate(entries):
            if number >= 100000:
                raise ValueError('Cargo dependency directory exceeds observation bound')
            if not pattern.fullmatch(entry.name):
                continue
            observed = entry.stat(follow_symlinks=False)
            if (observed.st_dev, observed.st_ino) == (info.st_dev, info.st_ino):
                if _identity(observed) != _identity(info):
                    raise ValueError('Cargo executable alias changed during observation')
                aliases.append(Path(entry.path))
    if len(aliases) + 1 != info.st_nlink:
        raise ValueError('build executable has unaccounted hardlinks')
    return aliases


def _normalize_build_output(binary_dir, name):
    """Set permissions only on the current, caller-owned Cargo-reported output FD."""
    path = binary_dir / name
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(descriptor)
        if (not stat.S_ISREG(before.st_mode) or before.st_uid != os.geteuid()
                or not before.st_mode & stat.S_IXUSR or before.st_mode & 0o7000
                or not 0 < before.st_size <= 1024 * 1024 * 1024):
            raise ValueError('build output is not an owned bounded executable')
        aliases = _cargo_aliases(binary_dir, name, before)
        if (_identity(os.fstat(descriptor)) != _identity(before)
                or _identity(path.lstat()) != _identity(before)
                or any(_identity(alias.lstat()) != _identity(before) for alias in aliases)):
            raise ValueError('build output changed before permission normalization')
        os.fchmod(descriptor, 0o755)
        after = os.fstat(descriptor)
        stable = lambda value: (value.st_dev, value.st_ino, value.st_uid, value.st_gid,
                                value.st_nlink, value.st_size, value.st_mtime_ns)
        if (stable(before) != stable(after) or stat.S_IMODE(after.st_mode) != 0o755
                or _identity(path.lstat()) != _identity(after)
                or any(_identity(alias.lstat()) != _identity(after) for alias in aliases)):
            raise ValueError('build output changed during permission normalization')
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def build(root, config, digest_fn, execute_fn):
    root, target, binary, output = _layout(root, config, new_manifest=True)
    source = _digest(digest_fn())
    names = _binary_names(root)
    versions = _versions(root)
    log_path = output.with_name(output.name + '.private.log')
    with log_path.open('xb') as log:
        os.fchmod(log.fileno(), 0o600)
        command = ['cargo', 'build', '--workspace', '--bins', '--locked', '--offline',
                   '--target-dir', str(target), '--manifest-path', str(root / 'Cargo.toml'),
                   '--message-format=json']
        with _build_umask():
            if execute_fn(command, 1200, log) != 0:
                raise ValueError('distribution build failed')
    _cargo_outputs(log_path, names, binary)
    for name in names:
        _normalize_build_output(binary, name)
    manifest = {'schema': 1, 'source_digest': source, 'profile': 'debug', **versions,
                'binaries': [_record(binary, name) for name in names]}
    if _digest(digest_fn()) != source or _versions(root) != versions:
        raise ValueError('source or toolchain changed during build')
    with _publication(output) as stream:
        stream.write(_encoded(manifest))
    return manifest


def validate_build(root, config, current_digest):
    root, _, binary, path = _layout(root, config)
    source = _digest(current_digest)
    if path.stat().st_size > 1024 * 1024:
        raise ValueError('build manifest is too large')
    manifest = json.loads(path.read_text())
    expected = {'schema': 1, 'source_digest': source, 'profile': 'debug', **_versions(root),
                'binaries': [_record(binary, name) for name in _binary_names(root)]}
    if manifest != expected:
        raise ValueError('build manifest does not match current source, tools, platform and binaries')
    return expected


def _member(archive, name, stream, size, mode):
    entry = tarfile.TarInfo(name)
    entry.size, entry.mode, entry.mtime = size, mode, 0
    entry.uid = entry.gid = 0
    entry.uname = entry.gname = ''
    archive.addfile(entry, stream)


class _HashingReader:
    def __init__(self, source):
        self.source, self.digest, self.size = source, hashlib.sha256(), 0

    def read(self, size):
        value = self.source.read(size)
        self.digest.update(value)
        self.size += len(value)
        return value


def package(root, config, plan, summary, manifest, output):
    current = validate_build(root, config, plan['source_digest'])
    if manifest != current:
        raise ValueError('supplied manifest differs from verified build')
    validate_plan(plan, source_digest=current['source_digest'])
    if 'rust.invariants' not in plan['selected']:
        raise ValueError('installation packaging requires Rust validation')
    required = [{'id': name, 'status': 'PASS', 'source_digest': current['source_digest'],
                 'plan_digest': plan['plan_digest']} for name in plan['selected']]
    verified = aggregate_results(plan, required, source_digest=current['source_digest'])
    if summary != verified or summary['status'] != 'PASS':
        raise ValueError('required validation is missing, failed or bound to another plan')
    binary_dir = _exact(config['bin_dir'], directory=True)
    metadata = {'build-manifest.json': current, 'validation.json': verified,
                'versions.json': {key: current[key] for key in ('platform', 'toolchain', 'profile')}}
    with _publication(output) as destination:
        with gzip.GzipFile(filename='', fileobj=destination, mode='wb', mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode='w|', format=tarfile.USTAR_FORMAT) as archive:
                for record in current['binaries']:
                    with _opened_binary(binary_dir / record['name']) as (source, info):
                        measured = _HashingReader(source)
                        _member(archive, 'bin/' + record['name'], measured, info.st_size, 0o755)
                        if measured.size != record['size'] or measured.digest.hexdigest() != record['sha256']:
                            raise ValueError('executable changed while packaging')
                checksums = ''.join(f"{record['sha256']}  bin/{record['name']}\n"
                                    for record in current['binaries']).encode()
                _member(archive, 'SHA256SUMS', io.BytesIO(checksums), len(checksums), 0o644)
                for name, value in sorted(metadata.items()):
                    content = _encoded(value)
                    _member(archive, name, io.BytesIO(content), len(content), 0o644)
        # Observe executable identity again before the final archive name is published.
        if validate_build(root, config, plan['source_digest']) != current:
            raise ValueError('build changed before archive publication')
