#!/usr/bin/env python3
"""Render bounded public CI identifiers, never private logs or assertion values."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import argparse
import json
import os
from pathlib import Path
import re

from tests.support.check_catalog import catalog


def safe_locations(values):
    root = Path(__file__).resolve().parents[2]
    known = {str(p.relative_to(root / 'tests')) for p in (root / 'tests').rglob('*.py')}
    known.update(str(p.relative_to(root)) for directory in (root / 'crates', root / 'apps/mac/src-tauri/src')
                 for p in directory.rglob('*.rs'))
    if not isinstance(values, list):
        return []
    result = []
    for value in values[:16]:
        match = re.fullmatch(r'([A-Za-z0-9_/-]+\.(?:py|rs)):([1-9][0-9]{0,5})', value) if isinstance(value, str) else None
        if match and match[1] in known:
            result.append(value)
    return result


def traceback_locations(text):
    return safe_locations([name + ':' + line for name, line in
        re.findall(r'File "[^"\n]*/tests/([A-Za-z0-9_/-]+\.py)", line ([1-9][0-9]{0,5})', text)[-16:]])


def render(plan, records):
    known = catalog()
    lines = ['## Responsibility checks', '', '| Case | Result | Seconds | Failed test identifiers |',
             '| --- | --- | --- | --- |']
    annotations = []
    for row in records:
        if not isinstance(row, dict) or row.get('id') not in known:
            continue
        name = row['id']
        status = row.get('status') if row.get('status') in ('PASS', 'FAIL', 'NOT RUN') else 'INVALID'
        seconds = row.get('duration_seconds')
        seconds = round(seconds, 3) if type(seconds) in (int, float) and 0 <= seconds <= 86400 else '-'
        tests = row.get('failed_tests', [])
        tests = [t for t in tests[:32] if isinstance(t, str) and re.fullmatch(r'test_[A-Za-z0-9_]{1,120}', t)] if isinstance(tests, list) else []
        index = row.get('command_index')
        detail = ', '.join(tests) or ('command ' + str(index) if type(index) is int and 0 <= index < 128 else '-')
        locations = safe_locations(row.get('failure_locations', []))
        if locations:
            detail += '; ' + ', '.join(locations)
        lines.append(f'| {name} | {status} | {seconds} | {detail} |')
        quality = row.get('quality')
        if name in ('rust.invariants', 'mac.rust') and isinstance(quality, dict):
            counts = quality.get('tests', {})
            values = [counts.get(key) for key in ('passed', 'ignored', 'discovered', 'harnesses')] if isinstance(counts, dict) else []
            if len(values) == 4 and all(type(value) is int and 0 <= value <= 100000 for value in values):
                lines.append(f'| {name} test accounting | {values[0]} passed / {values[1]} ignored | - | {values[2]} discovered / {values[3]} harnesses |')
        if status != 'PASS':
            annotations.append(f'::error title=Responsibility check::{name}: {status}; {detail}')
    if isinstance(plan, dict):
        selected = plan.get('selected', [])
        if isinstance(selected, list):
            lines.extend(['', 'Selected: ' + ', '.join(x for x in selected if isinstance(x, str) and x in known)])
        for key in ('head', 'source_digest', 'plan_digest'):
            value = plan.get(key, '')
            if isinstance(value, str) and re.fullmatch(r'[a-f0-9]{40,64}', value):
                lines.append(f'- {key}: `{value}`')
    return '\n'.join(lines) + '\n', annotations


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--results', nargs='*', type=Path, default=[])
    args = parser.parse_args()
    def read(path):
        if path and path.is_file() and not path.is_symlink() and path.stat().st_size <= 4 * 1024**2:
            return json.loads(path.read_text())
        return None
    records = []
    for path in args.results:
        value = read(path)
        if isinstance(value, list):
            records.extend(value)
    output, annotations = render(read(args.plan), records)
    if os.environ.get('CACHE_HIT') in ('true', 'false'):
        output += '\nCompiler cache hit: ' + os.environ['CACHE_HIT'] + '\n'
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as stream:
            stream.write(output)
    print(output)
    for annotation in annotations:
        print(annotation)


if __name__ == '__main__':
    main()
