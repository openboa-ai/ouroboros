"""Read protected Cargo outputs without imposing immutable-release link constraints.

Cargo may hardlink target/debug/name to target/debug/deps/name-HASH. A verified copy
into the release store still must have one link; this reader only identifies the
incoming build bytes while checking one open descriptor and its pathname binding.
"""
import hashlib
import os
from pathlib import Path
import stat

MAX_BINARY_BYTES = 128 * 1024**2


def _identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns)


def hash_build_binary(path):
    path = Path(path)
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, 'rb') as incoming:
        before = os.fstat(incoming.fileno())
        if (not stat.S_ISREG(before.st_mode) or not before.st_mode & stat.S_IXUSR
                or before.st_mode & 0o022 or not 0 < before.st_size <= MAX_BINARY_BYTES):
            raise ValueError('incoming build binary must be a protected bounded regular executable')
        digest, total = hashlib.sha256(), 0
        while chunk := incoming.read(1024**2):
            total += len(chunk)
            if total > MAX_BINARY_BYTES:
                raise ValueError('incoming build binary grew beyond its bound')
            digest.update(chunk)
        if (total != before.st_size or _identity(os.fstat(incoming.fileno())) != _identity(before)
                or _identity(path.lstat()) != _identity(before)):
            raise ValueError('incoming build binary changed while being identified')
        return digest.hexdigest()
