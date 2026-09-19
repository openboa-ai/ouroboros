"""Locked Linux memory files for disposable demo credentials, never retained evidence.

The existing services require regular file locators. Bind a sealed memfd at that locator;
the underlying disk file remains empty. Keep its mapping locked against swap until every
consumer has stopped, then unmount only the verified owned inode and release the memory.
"""
import ctypes
import fcntl
import mmap
import os
from pathlib import Path
import subprocess


class VolatileCredential:
    def __init__(self, content, uid=0, gid=None):
        data = content.encode() if isinstance(content, str) else content
        if not 1 <= len(data) <= 16384:
            raise ValueError('bounded nonempty credential required')
        self.path = self.placeholder = self.mapping = None
        self.fd = os.memfd_create('ouroboros-demo-credential', os.MFD_CLOEXEC | os.MFD_ALLOW_SEALING)
        try:
            os.ftruncate(self.fd, len(data))
            self.mapping = mmap.mmap(self.fd, len(data))
            libc = ctypes.CDLL(None, use_errno=True)
            libc.mlock.argtypes = (ctypes.c_void_p, ctypes.c_size_t)
            address = ctypes.addressof(ctypes.c_char.from_buffer(self.mapping))
            if libc.mlock(address, len(data)) != 0:
                raise OSError(ctypes.get_errno(), 'credential memory could not be locked')
            # This is locked anonymous memory; no credential bytes are written to disk.
            self.mapping[:] = data
            os.fchown(self.fd, uid, uid if gid is None else gid)
            os.fchmod(self.fd, 0o400)
            # F_SEAL_FUTURE_WRITE permits this existing locked mapping, but prevents new
            # writable mappings and writes through the regular-file service locator.
            seals = fcntl.F_SEAL_SEAL | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | 0x0010
            fcntl.fcntl(self.fd, fcntl.F_ADD_SEALS, seals)
        except BaseException:
            self.close()
            raise

    @staticmethod
    def identity(info):
        return info.st_dev, info.st_ino

    def publish(self, path):
        if self.path is not None or self.fd is None:
            raise ValueError('credential may only be published once')
        path = Path(path)
        if not path.is_absolute() or path.parent.resolve(strict=True) != path.parent:
            raise ValueError('exact credential parent required')
        placeholder = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            self.placeholder = self.identity(os.fstat(placeholder))
        finally:
            os.close(placeholder)
        self.path = path
        # Resolve /proc/self in this process, which owns the descriptor; do not
        # depend on an external mount utility preserving inherited descriptors.
        mount = ctypes.CDLL(None, use_errno=True).mount
        mount.argtypes = (ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_ulong, ctypes.c_void_p)
        if mount(os.fsencode(f'/proc/self/fd/{self.fd}'), os.fsencode(path), None, 4096, None) != 0:  # MS_BIND
            raise OSError(ctypes.get_errno(), 'credential memory bind failed')
        if self.identity(path.stat()) != self.identity(os.fstat(self.fd)):
            raise RuntimeError('credential memory binding was not observed')

    def close(self):
        if self.fd is None:
            return
        if self.path is not None:
            current = self.identity(self.path.lstat())
            if current == self.identity(os.fstat(self.fd)):
                unmount = ctypes.CDLL(None, use_errno=True).umount2
                unmount.argtypes = (ctypes.c_char_p, ctypes.c_int)
                if unmount(os.fsencode(self.path), 0) != 0:
                    raise OSError(ctypes.get_errno(), 'credential memory unmount failed')
            elif current != self.placeholder:
                raise RuntimeError('credential locator changed; preserve for inspection')
            if self.identity(self.path.lstat()) != self.placeholder or self.path.stat().st_size != 0:
                raise RuntimeError('credential backing file changed; preserve for inspection')
            self.path.unlink()
            self.path = None
        if self.mapping is not None:
            self.mapping.close()  # Unmapping also releases the mlock.
            self.mapping = None
        os.close(self.fd)
        self.fd = None


def verify_binding(root, environment):
    """Real root/Linux check, called by the existing native environment scenario."""
    from tests.support.fixture_config import guard_preexec
    path = root / 'volatile-credential-check'
    value = VolatileCredential(b'disposable fixture input', 70007)
    try:
        value.publish(path)
        assert path.read_bytes() == b'disposable fixture input'
        assert path.stat().st_mode & 0o777 == 0o400
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
            pass  # A sealed memory file must reject writes even from the fixture root.
        else:
            raise AssertionError('credential memory accepted a write')
    finally:
        value.close()
    assert not path.exists()


if __name__ == '__main__':
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    verify_binding(Path(sys.argv[1]), dict(os.environ))
