"""Verified immutable binary releases for disposable local fixtures, not production adoption.

All locations are injected. No credentials, executable startup, old-release deletion or symlink
switching is performed. Existing releases are verified in full before reuse.
"""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile


def manifest_bytes(manifest):
    if not isinstance(manifest, dict) or not 1 <= len(manifest) <= 32:
        raise ValueError('bounded binary manifest required')
    for name, digest in manifest.items():
        if not re.fullmatch(r'ouroboros-[a-z0-9-]+', name) or not isinstance(digest, str) or not re.fullmatch(r'[a-f0-9]{64}', digest):
            raise ValueError('invalid binary identity')
    return (json.dumps(manifest,sort_keys=True,separators=(',',':'))+'\n').encode()


def directory(path, owner, allow_root=False):
    info=path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid not in ({0,owner} if allow_root else {owner}) or info.st_mode & 0o022:
        raise ValueError('release directory ownership or permissions invalid')


def hash_file(path, owner=None, mode=None):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        info=os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size>134217728 or info.st_nlink!=1:
            raise ValueError('invalid release file')
        if owner is not None and (info.st_uid!=owner or stat.S_IMODE(info.st_mode)!=mode):
            raise ValueError('release file ownership or permissions invalid')
        digest=hashlib.sha256()
        while chunk:=os.read(fd,1048576):digest.update(chunk)
        return digest.hexdigest()
    finally:os.close(fd)


def verify(path, manifest, owner):
    directory(path,owner)
    if stat.S_IMODE(path.stat().st_mode)!=0o555:
        raise ValueError('release is writable')
    if {p.name for p in path.iterdir()}!=set(manifest)|{'manifest.json'}:
        raise ValueError('release inventory mismatch')
    expected=hashlib.sha256(manifest_bytes(manifest)).hexdigest()
    if hash_file(path/'manifest.json',owner,0o444)!=expected:
        raise ValueError('release manifest mismatch')
    for name,digest in manifest.items():
        if hash_file(path/name,owner,0o555)!=digest:raise ValueError('release binary mismatch')


def install(source, store, manifest, owner):
    if os.geteuid()!=owner:raise ValueError('installer identity mismatch')
    source,store=Path(source),Path(store)
    if not source.is_absolute() or not store.is_absolute():raise ValueError('explicit absolute paths required')
    # Store ancestors may be readable but cannot be controlled by a fixture workload.
    for ancestor in [store.parent,*store.parent.parents]:directory(ancestor,owner,allow_root=True)
    encoded=manifest_bytes(manifest)
    identity=hashlib.sha256(encoded).hexdigest()
    store.mkdir(mode=0o755,exist_ok=True);directory(store,owner)
    lock=os.open(store/'.install.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
    try:
        info=os.fstat(lock)
        if info.st_uid!=owner or not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600:
            raise ValueError('invalid release lock')
        fcntl.flock(lock,fcntl.LOCK_EX)
        target=store/identity
        if target.exists() or target.is_symlink():
            verify(target,manifest,owner)
            return {'release_id':identity,'bin_dir':str(target),'reused':True}
        stage=Path(tempfile.mkdtemp(prefix='.stage-',dir=store))
        try:
            for name,digest in manifest.items():
                # Hash and copy the same open file; never follow an executable symlink.
                fd=os.open(source/name,os.O_RDONLY|os.O_NOFOLLOW)
                with os.fdopen(fd,'rb') as incoming:
                    info=os.fstat(incoming.fileno())
                    if not stat.S_ISREG(info.st_mode) or info.st_size>134217728:raise ValueError('invalid source binary')
                    h=hashlib.sha256()
                    with (stage/name).open('xb') as output:
                        total=0
                        while chunk:=incoming.read(1048576):
                            total+=len(chunk)
                            if total>134217728:raise ValueError('source binary exceeds bound')
                            h.update(chunk);output.write(chunk)
                        output.flush();os.fsync(output.fileno())
                    if h.hexdigest()!=digest:raise ValueError('source changed or manifest mismatch')
                (stage/name).chmod(0o555)
            with (stage/'manifest.json').open('xb') as output:
                output.write(encoded);output.flush();os.fsync(output.fileno())
            (stage/'manifest.json').chmod(0o444);stage.chmod(0o555)
            verify(stage,manifest,owner)
            sync=os.open(stage,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(sync)
            finally:os.close(sync)
            # Some Darwin filesystems require write permission on the directory
            # being renamed. Keep it owner-only during publication, then seal it
            # before returning a usable release. A crash leaves an ineligible
            # private directory; reuse must reject it rather than repair/adopt it.
            stage.chmod(0o700)
            os.rename(stage,target)
            target.chmod(0o555)
            verify(target,manifest,owner)
            sync=os.open(target,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(sync)
            finally:os.close(sync)
            sync=os.open(store,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(sync)
            finally:os.close(sync)
        finally:
            if stage.exists():stage.chmod(0o700);shutil.rmtree(stage)
        return {'release_id':identity,'bin_dir':str(target),'reused':False}
    finally:os.close(lock)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--store',required=True);p.add_argument('--manifest',required=True)
    a=p.parse_args()
    print(json.dumps(install(a.source,a.store,json.loads(Path(a.manifest).read_text()),0)))
