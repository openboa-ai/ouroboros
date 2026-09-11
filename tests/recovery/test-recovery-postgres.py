#!/usr/bin/env python3
"""Finite local PostgreSQL recovery rehearsal; synthetic data, no company authority."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('archive', 'seal', 'open', 'age', 'keygen', 'pg-bin', 'fixture-parent', 'source-root'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--inspection', action='store_true')
    args = parser.parse_args()
    assert os.geteuid() != 0, 'fixture PostgreSQL must not run as root'
    tools = {name: str(getattr(args, name).resolve(strict=True)) for name in ('archive', 'seal', 'open', 'age', 'keygen')}
    pg = args.pg_bin.resolve(strict=True)
    parent = args.fixture_parent.resolve(strict=True)
    assert shutil.disk_usage(parent).free >= 512 * 1024 * 1024, 'insufficient rehearsal headroom'
    env = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C'}
    children = []
    from tests.support.fixture_recovery_inspection import free_port
    pg_port = free_port() if args.inspection else 5432

    def run(command, timeout=40):
        r = subprocess.run(command, capture_output=True, timeout=timeout, env=env)
        assert r.returncode == 0, 'bounded synthetic recovery command failed'
        return r.stdout

    with tempfile.TemporaryDirectory(prefix='pg-', dir=parent) as temporary:
        root = Path(temporary).resolve()
        socket = root / 'socket'
        assert len(os.fsencode(socket / '.s.PGSQL.5432')) < 104, 'injected fixture path exceeds Unix socket limit'
        socket.mkdir(mode=0o700)
        cluster = root / 'postgres'
        run([str(pg / 'initdb'), '-D', str(cluster), '-A', 'trust', '--no-locale', '--encoding=UTF8'])
        if args.inspection:
            hba = cluster / 'pg_hba.conf'
            lines = [line for line in hba.read_text().splitlines() if not line.lstrip().startswith('host')]
            hba.write_text('\n'.join(lines) + '\nhost fixture_control fixture_inspector 127.0.0.1/32 scram-sha-256\nhost all all 127.0.0.1/32 reject\n')


        def sql(database, text):
            return run([str(pg / 'psql'), '-X', '-A', '-t', '-h', str(socket), '-p', str(pg_port), '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', text]).strip()

        def start(data, label):
            log = root / (label + '.log')
            with log.open('xb') as output:
                os.fchmod(output.fileno(), 0o600)
                child = subprocess.Popen([str(pg / 'postgres'), '-D', str(data), '-k', str(socket), '-p', str(pg_port), '-c', 'listen_addresses=127.0.0.1' if args.inspection else 'listen_addresses=', '-c', 'unix_socket_permissions=0700'], stdout=output, stderr=output, env=env)
            children.append(child)
            for _ in range(100):
                assert child.poll() is None, 'fixture database exited during readiness'
                r = subprocess.run([str(pg / 'pg_isready'), '-h', str(socket), '-p', str(pg_port)], capture_output=True, timeout=2, env=env)
                if r.returncode == 0:
                    return child
                time.sleep(0.05)
            raise AssertionError('fixture readiness timeout')

        def stop(child, data):
            child.terminate()
            assert child.wait(timeout=15) == 0
            assert not (data / 'postmaster.pid').exists()
            control = run([str(pg / 'pg_controldata'), str(data)]).decode()
            state = next(line.split(':', 1)[1].strip() for line in control.splitlines() if line.startswith('Database cluster state:'))
            assert state == 'shut down'
            return hashlib.sha256(control.encode()).hexdigest()

        try:
            child = start(cluster, 'original')
            for setting in ('fsync', 'synchronous_commit', 'full_page_writes'):
                assert sql('postgres', 'SHOW ' + setting) == b'on'
            from tests.support.fixture_recovery_schema import prepare, snapshot
            databases = prepare(sql, args.source_root.resolve(strict=True))
            inspection_context = None
            if args.inspection:
                from tests.support.fixture_recovery_inspection import prepare as prepare_inspection
                inspection_context = prepare_inspection(root, sql, run)
            actual_firm = sql('fixture_control', 'SELECT id FROM firms').decode()
            baseline = snapshot(sql, databases)
            cutoff = stop(child, cluster)
            roots = {'postgres': str(cluster)}
            for name in ('content', 'configuration', 'recovery'):
                path = root / name
                path.mkdir(mode=0o700)
                roots[name] = str(path)
            content = root / 'content' / 'artifact'
            content.write_bytes(b'synthetic retained artifact\x00' * 1024)
            content.chmod(0o600)
            for directory, name, data in [('configuration', 'fixture.json', {'synthetic': True, 'network': 'unix_only'}), ('recovery', 'cutoff.json', {'clean_shutdown_control_sha256': cutoff, 'baseline': baseline})]:
                file = root / directory / name
                file.write_text(json.dumps(data))
                file.chmod(0o600)
            maximum = 128 * 1024 * 1024
            total = sum(p.stat().st_size for directory in roots.values() for p in Path(directory).rglob('*') if p.is_file())
            assert total <= maximum, 'synthetic cluster exceeds explicit 128 MiB fixture bound'
            assert shutil.disk_usage(root).free >= 4 * total + 128 * 1024 * 1024, 'insufficient bounded copy headroom'
            spec = root / 'spec.json'
            spec.write_text(json.dumps(dict(firm_id=actual_firm, generation=str(uuid.uuid4()), cutoff_record=cutoff, roots=roots, max_bytes=maximum, max_entries=10000)))
            spec.chmod(0o600)
            archive = root / 'recovery.tar'
            receipt = json.loads(run([tools['archive'], 'create', '--spec', str(spec), '--output', str(archive)]))
            key, recipient = root / 'key', root / 'recipient'
            run([tools['keygen'], '-o', str(key)])
            key.chmod(0o600)
            recipient.write_bytes(run([tools['keygen'], '-y', str(key)]))
            recipient.chmod(0o600)
            common = ['--age-binary', tools['age'], '--age-sha256', hashlib.sha256(Path(tools['age']).read_bytes()).hexdigest(), '--max-bytes', str(maximum + 16 * 1024 * 1024), '--timeout-seconds', '30']
            encrypted, reopened, staged = root / 'recovery.age', root / 'reopened.tar', root / 'isolated'
            run([tools['seal'], *common, '--recipient-file', str(recipient), '--input', str(archive), '--output', str(encrypted)])
            run([tools['open'], *common, '--identity-file', str(key), '--input', str(encrypted), '--output', str(reopened), '--plaintext-bytes', str(receipt['bytes']), '--plaintext-sha256', receipt['sha256']])
            stage = json.loads(run([tools['archive'], 'stage', '--archive', str(reopened), '--expected-sha256', receipt['sha256'], '--max-bytes', str(maximum), '--max-entries', '10000', '--staging-directory', str(staged)]))
            assert stage['services_started'] is False and not (cluster / 'postmaster.pid').exists()
            assert stage['firm_id'] == actual_firm, 'staged company identity mismatch'
            assert (staged / 'content/artifact').read_bytes() == content.read_bytes()
            restored = start(staged / 'postgres', 'restored')
            assert sql('fixture_control', 'SELECT id FROM firms').decode() == stage['firm_id']
            assert snapshot(sql, databases) == baseline
            inspection_result = None
            if inspection_context:
                from tests.support.fixture_recovery_inspection import inspect
                inspection_result = inspect(inspection_context, Path(tools['archive']).parent, pg_port, env)
                assert snapshot(sql, databases) == baseline, 'inspection changed restored records'
            stop(restored, staged / 'postgres')
            print(json.dumps({'status': 'PASS', 'databases': len(databases), 'tables_preserved': len(baseline['tables']), 'revocation_and_unsettled_reservation_preserved': True, 'database_role_boundary_preserved': True, 'artifact_bytes_preserved': True, 'clean_shutdown_observed': True, 'encrypted_archive_staged': True, 'unix_socket_only': not args.inspection, 'inspection': inspection_result, 'company_schema_restore': 'PASS', 'restored_gateway_authority': 'NOT RUN', 'independent_destination': 'NOT RUN', 'real_account': False}))
        finally:
            for child in reversed(children):
                if child.poll() is None:
                    child.terminate()
                    try:
                        child.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        child.kill()
                        child.wait(timeout=5)
                        raise AssertionError('fixture required forced cleanup')


if __name__ == '__main__':
    main()
