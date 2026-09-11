"""Content identity of inputs built into the native fixture image; no Git/research dependency."""
import argparse
import hashlib
import json
from pathlib import Path
import stat

SOURCE_LABEL = 'io.ouroboros.fixture.source-sha256'
CLI_LABEL = 'io.ouroboros.fixture.cli-sha256'
MATERIALIZER_LABEL = 'io.ouroboros.fixture.materializer-sha256'
PROBE_LABEL = 'io.ouroboros.fixture.probe-sha256'
_IMAGE_SCRIPTS = (
    'scripts/prepare-codex-fixture.sh', 'scripts/prepare-connected-native.sh',
    'scripts/prepare-connected-program.sh', 'scripts/test-profile.sh',
    'scripts/native_image_identity.py', 'scripts/prepare-checkpoint-read-fixture.py',
)


def source_digest(root):
    root = Path(root)
    if not root.is_absolute() or root.resolve(strict=True) != root:
        raise ValueError('image source must be an exact checkout path')
    paths = {root / name for name in ('Cargo.toml', 'Cargo.lock', *_IMAGE_SCRIPTS)}
    for pattern in ('crates/**/*.rs', 'crates/**/*.sql', 'crates/**/Cargo.toml', 'scripts/fixtures/*.rs'):
        paths.update(root.glob(pattern))
    if not 10 <= len(paths) <= 3000:
        raise ValueError('unexpected native image input inventory')
    manifest, total = {}, 0
    for path in sorted(paths):
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_size > 16 * 1024**2:
            raise ValueError('native image inputs must be bounded regular files')
        total += info.st_size
        if total > 128 * 1024**2:
            raise ValueError('native image source inventory exceeds bound')
        manifest[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    encoded = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(encoded).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    args = parser.parse_args()
    print(source_digest(args.source_root))
