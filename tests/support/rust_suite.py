"""Run pinned Rust checks and account for every discovered unit-test harness.

Cargo identifies current executables; cached directory contents never select tests.
Feature-gated PostgreSQL tests and named ignored tests run in their registered lanes.
"""
if __package__ in (None, ''):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
from pathlib import Path
import platform
import re
import subprocess
import sys
import time

from tests.support.rust_quality import ROOT, check, policy


def test_summary(output, *, allow_empty=False):
    summaries = re.findall(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored; (\d+) measured; (\d+) filtered out', output)
    if not summaries or any(int(row[index]) for row in summaries for index in (1, 3, 4)):
        raise ValueError('test output is incomplete, failed or filtered')
    passed = sum(int(row[0]) for row in summaries)
    ignored = sum(int(row[2]) for row in summaries)
    if not allow_empty and passed + ignored == 0:
        raise ValueError('test suite discovered no tests')
    return {'passed': passed, 'ignored': ignored}


def test_names(output):
    names = re.findall(r'^([^\r\n]+): test$', output, re.MULTILINE)
    if len(names) != len(set(names)):
        raise ValueError('duplicate test identity')
    if not re.search(r'\d+ tests?, \d+ benchmarks?', output):
        raise ValueError('test discovery did not complete')
    return set(names)


def harnesses(output, target):
    found = {}
    finished = False
    for line in output.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get('reason') == 'build-finished':
            if finished or event.get('success') is not True:
                raise ValueError('test compilation did not complete once')
            finished = True
        if (event.get('reason') == 'compiler-artifact' and event.get('profile', {}).get('test')
                and event.get('executable')):
            path = Path(event['executable'])
            if not path.is_absolute() or not path.resolve(strict=True).is_relative_to(target):
                raise ValueError('test executable is outside the selected target')
            if path in found:
                raise ValueError('duplicate test executable')
            found[path] = event['target']['name']
    if not finished or not found:
        raise ValueError('Cargo did not identify current test executables')
    return found


def compiler_locations(output, manifest=ROOT / "Cargo.toml"):
    locations = set()
    for line in output.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict) or event.get('reason') != 'compiler-message':
            continue
        message = event.get('message', {})
        if message.get('level') != 'error':
            continue
        for span in message.get('spans', []):
            if span.get('is_primary') and type(span.get('line_start')) is int:
                path = (ROOT / span.get('file_name', '')).resolve()
                if not path.is_file():
                    path = (manifest.parent / span.get('file_name', '')).resolve()
                if path.is_relative_to(ROOT):
                    locations.add(str(path.relative_to(ROOT)) + ':' + str(span['line_start']))
    from tests.support.ci_report import safe_locations
    return safe_locations(sorted(locations))


def run(command, timeout=1200):
    before = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=timeout, text=True)
    # Kept in the enclosing runner's private log, never in public gate summaries.
    print(result.stdout, end='', flush=True)
    if result.returncode:
        if '--manifest-path' in command:
            manifest = Path(command[command.index('--manifest-path') + 1])
            entry = next((item for item in policy()['workspaces'] if ROOT / item['manifest'] == manifest), None)
            if entry:
                print(json.dumps({'scenario_id': entry['scenario'],
                                  'failure_locations': compiler_locations(result.stdout, manifest)}), flush=True)
        raise ValueError('required Rust command failed')
    return result.stdout, round(time.monotonic() - before, 3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--target-dir', required=True, type=Path)
    args = parser.parse_args()
    rules = policy()
    if check()['status'] != 'PASS':
        raise ValueError('Rust policy failed')
    entry = next(entry for entry in rules['workspaces'] if entry['manifest'] == args.manifest)
    target = args.target_dir.resolve(strict=True)
    if not args.target_dir.is_absolute() or args.target_dir != target:
        raise ValueError('target must be an exact existing absolute directory')
    if args.manifest != 'Cargo.toml' and platform.system() != 'Darwin':
        raise ValueError('Mac Rust requires the actual macOS target')
    versions = {}
    for tool in ('rustc', 'cargo'):
        value, _ = run([tool, '--version'], 15)
        if value.split()[1] != rules['rust']:
            raise ValueError('effective toolchain differs from quality policy')
        versions[tool] = value.strip()
    common = ['--manifest-path', str(ROOT / args.manifest), '--workspace', '--locked',
              '--offline', '--target-dir', str(target)]
    durations = {}
    _, durations['fmt'] = run(['cargo', 'fmt', '--manifest-path', str(ROOT / args.manifest), '--all', '--check'], 120)
    _, durations['clippy'] = run(['cargo', 'clippy', *common, '--all-targets', '--all-features', '--message-format=json', '--', '-D', 'warnings'])
    compilation, durations['test_build'] = run(['cargo', 'test', *common, '--all-targets', '--no-run', '--message-format=json'])
    expected_ignored = {item['name'] for item in rules['ignored_tests']
                        if item['platform'] == platform.system()
                        and (item['path'].startswith('apps/mac/') == args.manifest.startswith('apps/mac/'))}
    ignored_seen = set()
    totals = {'passed': 0, 'ignored': 0, 'discovered': 0, 'harnesses': 0}
    test_seconds = 0
    for binary in harnesses(compilation, target):
        listing, _ = run([str(binary), '--list'], 60)
        names = test_names(listing)
        ignores, _ = run([str(binary), '--ignored', '--list'], 60)
        ignored = test_names(ignores)
        if not ignored <= expected_ignored or ignored_seen & ignored:
            raise ValueError('unregistered or duplicate ignored test')
        ignored_seen.update(ignored)
        output, duration = run([str(binary), '--test-threads=2'])
        summary = test_summary(output, allow_empty=True)
        if summary['passed'] + summary['ignored'] != len(names) or summary['ignored'] != len(ignored):
            raise ValueError('executed tests differ from discovered tests')
        totals['passed'] += summary['passed']
        totals['ignored'] += summary['ignored']
        totals['discovered'] += len(names)
        totals['harnesses'] += 1
        test_seconds += duration
    if ignored_seen != expected_ignored or totals['passed'] == 0:
        raise ValueError('registered test inventory was not observed')
    durations['tests'] = round(test_seconds, 3)
    metadata, _ = run(['cargo', 'metadata', '--manifest-path', str(ROOT / args.manifest),
                       '--no-deps', '--format-version', '1', '--locked', '--offline'], 60)
    metadata = json.loads(metadata)
    members = set(metadata['workspace_members'])
    has_docs = any(target.get('doctest') for package in metadata['packages'] if package['id'] in members
                   for target in package['targets'])
    docs, durations['doctests'] = run(['cargo', 'test', *common, '--doc']) if has_docs else ('', 0)
    # Binary-only workspaces have no doctest target, verified by current Cargo metadata.
    doctests = test_summary(docs, allow_empty=True) if docs else {'passed': 0, 'ignored': 0}
    if doctests['ignored']:
        raise ValueError('ignored doctests are not qualified')
    _, durations['build'] = run(['cargo', 'build', *common, '--bins'])
    print(json.dumps({'scenario_id': entry['scenario'], 'quality': {
        'manifest': args.manifest, 'toolchain': versions, 'tests': totals,
        'doctests': doctests, 'duration_seconds': durations,
        'ignored_executed_by': sorted(item['scenario'] for item in rules['ignored_tests']
                                     if item['name'] in ignored_seen)}}))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, StopIteration, subprocess.SubprocessError):
        print('Rust quality verification failed; private command output is retained', file=sys.stderr)
        raise SystemExit(1)
