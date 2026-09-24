"""Audit every registered lockfile against one freshly fetched RustSec database."""
if __package__ in (None, ''):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

from tests.support.rust_quality import ROOT, check, policy


def audit_ok(value):
    vulnerabilities = value.get('vulnerabilities', {})
    return (vulnerabilities.get('found') is False and vulnerabilities.get('count') == 0
            and vulnerabilities.get('list') == [])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, type=Path)
    args = parser.parse_args()
    if args.database.resolve(strict=True) != args.database or check()['status'] != 'PASS':
        raise ValueError('invalid inventory or advisory database')
    version = subprocess.check_output(['cargo-audit', '--version'], cwd=ROOT, text=True, timeout=15).strip()
    if version != 'cargo-audit ' + policy()['audit']:
        raise ValueError('audit executable differs from policy')
    commit = subprocess.check_output(['git', '-C', str(args.database), 'rev-parse', 'HEAD'], text=True, timeout=15).strip()
    committed = int(subprocess.check_output(['git', '-C', str(args.database), 'log', '-1', '--format=%ct'],
                                             text=True, timeout=15).strip())
    if not 0 <= time.time() - committed <= 7 * 24 * 3600:
        raise ValueError('advisory database is stale or future dated')
    results = []
    failed = False
    for entry in policy()['workspaces']:
        command = ['cargo', 'audit', '--json', '--no-fetch', '--db', str(args.database),
                   '--file', entry['lockfile']]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
        print(result.stdout, end='')
        print(result.stderr, end='', file=sys.stderr)
        value = json.loads(result.stdout)
        clean = result.returncode == 0 and audit_ok(value)
        failed = failed or not clean
        results.append({'lockfile': entry['lockfile'], 'status': 'PASS' if clean else 'FAIL',
                        'vulnerabilities': value.get('vulnerabilities', {}).get('count'),
                        'warnings': sum(len(items) for items in value.get('warnings', {}).values())})
    print(json.dumps({'scenario_id': 'rust.dependencies', 'database_commit': commit,
                      'auditor': version, 'lockfiles': results}))
    if failed:
        raise ValueError('required dependency audit failed')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        print('Required Rust dependency audit failed', file=sys.stderr)
        raise SystemExit(1)
