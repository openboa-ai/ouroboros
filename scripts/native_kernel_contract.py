"""One source-bound prebuilt kernel contract; never run Cargo or discover a test by glob."""
import json
from pathlib import Path
import re
import stat

from native_build_input import hash_build_binary
from native_image_identity import source_digest

TEST_NAME = 'guard_handoff::tests::descriptor_packet_preserves_handles_and_rejects_unbacked_input'


def verify_manifest(filename, source_root):
    filename = Path(filename)
    if not filename.is_absolute() or filename.resolve(strict=True) != filename:
        raise ValueError('kernel manifest must be an exact existing absolute file')
    if not stat.S_ISREG(filename.lstat().st_mode) or filename.stat().st_size > 65536:
        raise ValueError('kernel manifest must be a bounded regular file')
    value = json.loads(filename.read_text())
    if (not isinstance(value, dict) or set(value) != {'version', 'source_sha256', 'binary', 'sha256', 'test_name'}
            or type(value['version']) is not int or value['version'] != 1 or value['test_name'] != TEST_NAME):
        raise ValueError('kernel manifest does not describe the required trusted-sender contract')
    if value['source_sha256'] != source_digest(source_root):
        raise ValueError('kernel test harness does not identify the current source')
    if not isinstance(value['binary'], str) or not isinstance(value['sha256'], str):
        raise ValueError('kernel executable identity fields must be strings')
    binary = Path(value['binary'])
    if not binary.is_absolute() or binary.resolve(strict=True) != binary:
        raise ValueError('kernel test binary must be an exact existing absolute file')
    info = binary.lstat()
    if not stat.S_ISREG(info.st_mode) or not info.st_mode & stat.S_IXUSR or info.st_mode & 0o022:
        raise ValueError('kernel test binary must be a protected regular executable')
    if not re.fullmatch(r'[a-f0-9]{64}', value['sha256']) or hash_build_binary(binary) != value['sha256']:
        raise ValueError('kernel test binary differs from its build record')
    return value
