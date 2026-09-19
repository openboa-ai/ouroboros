#!/usr/bin/env python3
"""Recheck retained agent UI bytes against protected run evidence; never execute the module."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location('company_ui_demo', ROOT / 'tests/integration/demo-basic-flow.py')
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-root', type=Path, required=True)
    args = parser.parse_args()
    root = args.run_root.resolve(strict=True)
    evidence_path = root / 'resource-evidence.json'
    if evidence_path.stat().st_size > 32 * 1024 * 1024:
        parser.error('resource evidence exceeds bound')
    proof = json.loads(evidence_path.read_text())
    proof['published'] = json.loads((root / 'result.json').read_text())
    demo.verify_resource_smoke(proof)
    files = {}
    for name in demo.COMPANY_UI_FILES:
        path = root / name
        if path.is_symlink() or path.stat().st_size > 65536:
            parser.error('UI candidate must be a bounded regular file')
        files[name] = path.read_bytes()
    report = demo.verify_company_ui_artifacts(proof, files)
    print(json.dumps({'result': 'PASS', 'resource_checks': 'PASS', **report}, indent=2))


if __name__ == '__main__':
    main()
