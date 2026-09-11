#!/usr/bin/env python3
"""Synthetic recovery-set -> seal -> open -> complete-inventory verification."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import uuid


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('archive', 'seal', 'open', 'age', 'keygen', 'fixture-parent'):
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    tools = {name: str(getattr(a, name).resolve(strict=True)) for name in ('archive', 'seal', 'open', 'age', 'keygen')}

    def run(args, success=True):
        r = subprocess.run(args, capture_output=True, timeout=40)
        assert (r.returncode == 0) == success, 'bounded recovery command had unexpected exit'
        return r.stdout

    with tempfile.TemporaryDirectory(prefix='recovery-set-', dir=a.fixture_parent.resolve(strict=True)) as d:
        root = Path(d).resolve()
        sources = {}
        for name in ('postgres', 'content', 'configuration', 'recovery'):
            path = root / name
            path.mkdir(mode=0o700)
            file = path / 'synthetic-record'
            file.write_bytes((name.encode() + b'\x00') * 4096)
            file.chmod(0o600)
            sources[name] = str(path)
        long_name = 'retained-' + 'x' * 170
        long_file = root / 'configuration' / long_name
        long_file.write_bytes(b'bounded long pathname')
        long_file.chmod(0o600)
        spec = root / 'spec.json'
        spec.write_text(json.dumps(dict(firm_id=str(uuid.uuid4()), generation=str(uuid.uuid4()), cutoff_record='synthetic-cutoff-no-company', roots=sources, max_bytes=1048576, max_entries=100)))
        spec.chmod(0o600)
        archive = root / 'recovery.tar'
        command = [tools['archive'], 'create', '--spec', str(spec), '--output', str(archive)]
        receipt = json.loads(run(command))
        assert receipt['coherence_verified'] is False and receipt['authority_granted'] is False
        digest = receipt['sha256']
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest

        def verify(path, sha):
            return [tools['archive'], 'verify', '--archive', str(path), '--expected-sha256', sha, '--max-bytes', '1048576', '--max-entries', '100']

        assert json.loads(run(verify(archive, digest)))['entries'] == 9
        run(command, False)
        assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest
        key, recipient = root / 'key', root / 'recipient'
        run([tools['keygen'], '-o', str(key)])
        key.chmod(0o600)
        recipient.write_bytes(run([tools['keygen'], '-y', str(key)]))
        recipient.chmod(0o600)
        common = ['--age-binary', tools['age'], '--age-sha256', hashlib.sha256(Path(tools['age']).read_bytes()).hexdigest(), '--max-bytes', '1048576', '--timeout-seconds', '20']
        sealed, restored = root / 'recovery.age', root / 'restored.tar'
        run([tools['seal'], *common, '--recipient-file', str(recipient), '--input', str(archive), '--output', str(sealed)])
        run([tools['open'], *common, '--identity-file', str(key), '--input', str(sealed), '--output', str(restored), '--plaintext-bytes', str(receipt['bytes']), '--plaintext-sha256', digest])
        assert json.loads(run(verify(restored, digest)))['status'] == 'inventory_verified'
        def stage(path, sha, destination):
            return [tools['archive'], 'stage', '--archive', str(path), '--expected-sha256', sha,
                    '--max-bytes', '1048576', '--max-entries', '100', '--staging-directory', str(destination)]

        destination = root / 'isolated-stage'
        staged = json.loads(run(stage(restored, digest, destination)))
        assert staged['services_started'] is False and staged['archived_ownership_applied'] is False
        assert (destination / 'STAGED.json').is_file()
        assert (destination / 'configuration' / long_name).read_bytes() == long_file.read_bytes()
        for name, original in sources.items():
            candidate = destination / name / 'synthetic-record'
            assert candidate.read_bytes() == (Path(original) / 'synthetic-record').read_bytes()
            assert candidate.stat().st_mode & 0o777 == 0o600
            assert candidate.stat().st_uid == os.getuid()
        run(stage(restored, digest, destination), False)
        # Repack with a valid outer hash but invalid inner membership/content.
        for case in ('missing', 'changed', 'duplicate', 'symlink', 'traversal'):
            corrupt = root / (case + '.tar')
            with tarfile.open(archive, 'r:') as original, tarfile.open(corrupt, 'w:', format=tarfile.GNU_FORMAT) as target:
                for i, item in enumerate(original):
                    data = original.extractfile(item).read() if item.isfile() else None
                    if i == 2:
                        if case == 'missing':
                            continue
                        if case == 'changed':
                            data = bytes([data[0] ^ 1]) + data[1:]
                        if case == 'symlink':
                            item.type = tarfile.SYMTYPE
                            item.linkname = '/outside'
                            item.size = 0
                            data = None
                        if case == 'traversal':
                            item.name = '../outside'
                    target.addfile(item, None if data is None else io.BytesIO(data))
                    if i == 2 and case == 'duplicate':
                        target.addfile(item, io.BytesIO(data))
            corrupt.chmod(0o600)
            run(verify(corrupt, hashlib.sha256(corrupt.read_bytes()).hexdigest()), False)
            rejected_stage = root / ('rejected-' + case)
            run(stage(corrupt, hashlib.sha256(corrupt.read_bytes()).hexdigest(), rejected_stage), False)
            assert not rejected_stage.exists()
        oversized = root / 'oversized-metadata.tar'
        with tarfile.open(oversized, 'w:', format=tarfile.GNU_FORMAT) as target:
            header = tarfile.TarInfo('././@LongLink')
            header.type = tarfile.GNUTYPE_LONGNAME
            header.size = 8192
            target.addfile(header, io.BytesIO(b'x' * 8191 + b'\0'))
        oversized.chmod(0o600)
        failure = subprocess.run(verify(oversized, hashlib.sha256(oversized.read_bytes()).hexdigest()), capture_output=True, timeout=10)
        assert failure.returncode != 0 and b'pathname metadata exceeds bound' in failure.stderr
        print(json.dumps({'status': 'PASS', 'cases': ['four_root_inventory', 'seal_open_verify', 'no_overwrite', 'missing_entry', 'changed_content', 'duplicate_entry', 'symlink_entry', 'path_traversal', 'isolated_staging', 'staging_no_overwrite', 'no_archived_privileges', 'bounded_long_path', 'oversized_metadata_preflight'], 'actual_postgres_restore': 'NOT RUN', 'independent_destination': 'NOT RUN'}))


if __name__ == '__main__':
    main()
