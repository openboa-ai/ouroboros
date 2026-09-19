"""Non-swapping Linux memory files for disposable credentials, never retained evidence.

The existing services require regular file locators. Create a bounded noswap tmpfs,
make its populated file read-only, and bind it at the required locator. The underlying
disk file stays empty. Cleanup verifies the owned mounts before releasing them.
"""
import ctypes
import json
import mmap
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile


def mount(source, target, filesystem, flags, options=None):
    call = ctypes.CDLL(None, use_errno=True).mount
    call.argtypes = (ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_ulong, ctypes.c_char_p)
    values = [os.fsencode(value) if value is not None else None for value in (source, target, filesystem, options)]
    if call(values[0], values[1], values[2], flags, values[3]) != 0:
        raise OSError(ctypes.get_errno(), 'credential memory mount failed')


def unmount(path):
    call = ctypes.CDLL(None, use_errno=True).umount2
    call.argtypes = (ctypes.c_char_p, ctypes.c_int)
    if call(os.fsencode(path), 0) != 0:
        raise OSError(ctypes.get_errno(), 'credential memory unmount failed')


def memory_mount(path):
    """Observe the selected mount's filesystem and actual no-swap/read-only policy."""
    for line in Path('/proc/self/mountinfo').read_text().splitlines():
        fields = line.split()
        target = re.sub(r'\\([0-7]{3})', lambda value: chr(int(value[1], 8)), fields[4])
        if target == str(path):
            split = fields.index('-')
            return fields[split + 1], set(fields[5].split(',')), set(fields[split + 3].split(','))
    raise RuntimeError('credential memory mount was not observed')


class VolatileCredential:
    def __init__(self, content, uid=0, gid=None):
        data = content.encode() if isinstance(content, str) else content
        if not 1 <= len(data) <= 16384:
            raise ValueError('bounded nonempty credential required')
        self.data, self.uid, self.gid = data, uid, uid if gid is None else gid
        self.path = self.placeholder = self.backing = self.directory = None
        self.directory_placeholder = self.directory_mount = None
        self.closed = False

    @staticmethod
    def identity(info):
        return info.st_dev, info.st_ino

    def publish(self, path):
        if self.path is not None or self.closed:
            raise ValueError('credential may only be published once')
        path = Path(path)
        if not path.is_absolute() or path.parent.resolve(strict=True) != path.parent:
            raise ValueError('exact credential parent required')
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            self.placeholder = self.identity(os.fstat(descriptor))
        finally:
            os.close(descriptor)
        self.path = path
        self.directory = Path(tempfile.mkdtemp(prefix='.credential-', dir=path.parent))
        self.directory_placeholder = self.identity(self.directory.stat())
        # MS_NOSUID | MS_NODEV | MS_NOEXEC. Unknown/unsupported noswap fails closed.
        mount('ouroboros-credential', self.directory, 'tmpfs', 14,
              'size=65536,nr_inodes=4,mode=0700,noswap')
        self.directory_mount = self.identity(self.directory.stat())
        filesystem, _, options = memory_mount(self.directory)
        if filesystem != 'tmpfs' or 'noswap' not in options:
            raise RuntimeError('non-swapping credential memory was not observed')
        source = self.directory / 'input'
        descriptor = os.open(source, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.ftruncate(descriptor, len(self.data))
            # The mapping belongs to the verified noswap tmpfs, never a disk file.
            with mmap.mmap(descriptor, len(self.data)) as view:
                view[:] = self.data
            os.fchown(descriptor, self.uid, self.gid)
            os.fchmod(descriptor, 0o400)
            self.backing = self.identity(os.fstat(descriptor))
        finally:
            os.close(descriptor)
        # MS_REMOUNT | MS_RDONLY plus the existing protection flags.
        mount(None, self.directory, None, 32 | 1 | 14,
              'size=65536,nr_inodes=4,mode=0700,noswap')
        _, flags, options = memory_mount(self.directory)
        if 'ro' not in flags or 'noswap' not in options:
            raise RuntimeError('read-only credential memory was not observed')
        mount(source, path, None, 4096)  # MS_BIND; both paths are namespace-visible.
        if self.identity(path.stat()) != self.backing:
            raise RuntimeError('credential file binding was not observed')
        self.data = None

    def close(self):
        if self.closed:
            return
        if self.path is not None:
            current = self.identity(self.path.lstat())
            if self.backing is not None and current == self.backing:
                unmount(self.path)
            elif current != self.placeholder:
                raise RuntimeError('credential locator changed; preserve for inspection')
            if self.identity(self.path.lstat()) != self.placeholder or self.path.stat().st_size != 0:
                raise RuntimeError('credential backing file changed; preserve for inspection')
            self.path.unlink()
            self.path = None
        if self.directory is not None:
            current = self.identity(self.directory.lstat())
            if self.directory_mount is not None and current == self.directory_mount:
                unmount(self.directory)
            elif current != self.directory_placeholder:
                raise RuntimeError('credential memory directory changed; preserve for inspection')
            if self.identity(self.directory.lstat()) != self.directory_placeholder:
                raise RuntimeError('credential directory binding changed; preserve for inspection')
            self.directory.rmdir()
            self.directory = None
        self.data = None
        self.closed = True


def publish_retained(path, content, uid=0, gid=None):
    """Retain across fixture processes; the owning suite closes after cold recovery.

    The root-only journal contains mount identities, never credential content. If a
    publisher is killed before journaling, the suite detects the unaccounted mount
    and fails cleanup instead of claiming that every credential was released.
    """
    path = Path(path)
    journal = path.with_name('.' + path.name + '.credential.json')
    value = VolatileCredential(content, uid, gid)
    journal_identity = None
    try:
        with open(journal, 'x', opener=lambda name, flags: os.open(name, flags, 0o600)) as output:
            journal_identity = value.identity(os.fstat(output.fileno()))
            value.publish(path)
            record = {key: getattr(value, key) for key in
                      ('placeholder', 'backing', 'directory_placeholder', 'directory_mount')}
            record.update(path=str(value.path), directory=str(value.directory))
            json.dump(record, output)
            output.flush()
            os.fsync(output.fileno())
    except BaseException:
        value.close()
        if journal_identity is not None and value.identity(journal.lstat()) == journal_identity:
            journal.unlink()
        raise


def release_retained(root):
    """Release exact owned bindings after all consumers and the database have stopped."""
    root = Path(root)
    released = 0
    for journal in sorted(root.rglob('.*.credential.json')):
        info = journal.lstat()
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1
                or info.st_mode & 0o077 or info.st_size > 4096):
            raise RuntimeError('credential ownership journal requires inspection')
        record = json.loads(journal.read_text())
        if set(record) != {'path', 'directory', 'placeholder', 'backing', 'directory_placeholder', 'directory_mount'}:
            raise RuntimeError('invalid credential ownership journal')
        path, directory = Path(record['path']), Path(record['directory'])
        if (path.parent != journal.parent or directory.parent != path.parent
                or path.parent.resolve(strict=True) != path.parent
                or journal.name != '.' + path.name + '.credential.json'
                or not directory.name.startswith('.credential-')):
            raise RuntimeError('credential ownership journal escaped its locator')
        value = VolatileCredential(b'unused reconstruction input')
        value.data = None
        value.path, value.directory = path, directory
        for key in ('placeholder', 'backing', 'directory_placeholder', 'directory_mount'):
            identity = record[key]
            if not isinstance(identity, list) or len(identity) != 2 or any(type(n) is not int or n < 0 for n in identity):
                raise RuntimeError('invalid credential mount identity')
            setattr(value, key, tuple(identity))
        value.close()
        journal.unlink()
        released += 1
    if Path('/proc/self/mountinfo').is_file():
        for line in Path('/proc/self/mountinfo').read_text().splitlines():
            target = Path(re.sub(r'\\([0-7]{3})', lambda value: chr(int(value[1], 8)), line.split()[4]))
            if target.is_relative_to(root) and any(part.startswith('.credential-') for part in target.parts):
                raise RuntimeError('unaccounted credential memory mount requires inspection')
    return released


def verify_binding(root, environment):
    """Real root/Linux qualification before the existing native fixture launch."""
    from tests.support.fixture_config import guard_preexec
    path = root / 'volatile-credential-check'
    value = VolatileCredential(b'disposable fixture input', 70007)
    try:
        value.publish(path)
        directory = value.directory
        assert path.read_bytes() == b'disposable fixture input'
        assert path.stat().st_mode & 0o777 == 0o400 and path.stat().st_nlink == 1
        for uid, permitted in ((70007, True), (70003, False)):
            probe = subprocess.run(['/usr/bin/python3', '-c',
                'import pathlib,sys; assert pathlib.Path(sys.argv[1]).read_bytes() == b"disposable fixture input"',
                str(path)], preexec_fn=guard_preexec(uid), env=environment,
                capture_output=True, timeout=3)
            assert (probe.returncode == 0) == permitted
        try:
            with path.open('r+b') as stream:
                stream.write(b'changed')
        except OSError:
            pass  # Read-only memory must reject writes even from the fixture root.
        else:
            raise AssertionError('credential memory accepted a write')
    finally:
        value.close()
    assert not path.exists() and not directory.exists()
    # A later suite phase reconstructs ownership after the publisher has exited.
    retained = root / 'retained-credential-check'
    publish_retained(retained, b'disposable recovery input', 70007)
    assert retained.read_bytes() == b'disposable recovery input'
    journal = retained.with_name('.' + retained.name + '.credential.json')
    original = journal.read_text()
    changed = json.loads(original)
    changed['backing'] = [0, 0]
    journal.write_text(json.dumps(changed))
    try:
        release_retained(root)
    except RuntimeError:
        pass  # A changed identity must preserve the binding for inspection.
    else:
        raise AssertionError('changed credential ownership was accepted')
    assert retained.read_bytes() == b'disposable recovery input'
    journal.write_text(original)
    assert release_retained(root) == 1
    assert not retained.exists()


if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    verify_binding(Path(sys.argv[1]), dict(os.environ))
