#!/usr/bin/env python3
"""Check runnable discovery after moves, without a DB, Docker, network or model."""
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from tests.support.check import ROOT, commands
from tests.support.check_catalog import build_plan, catalog


class TestLayoutContract(unittest.TestCase):
    def test_every_standalone_tooling_check_is_selected(self):
        discovered = set((ROOT / 'tests/tooling').glob('test-*.py'))
        selected = {Path(command[1]) for command, _ in commands('tooling.contracts', {})}
        self.assertEqual(discovered, selected)
        self.assertTrue(all(path.is_file() for path in selected))

    def test_public_entrypoints_run_without_checkout_working_directory(self):
        with tempfile.TemporaryDirectory() as scratch:
            for entry in (ROOT / 'scripts').glob('*.py'):
                with self.subTest(entry=entry.name):
                    result = subprocess.run([sys.executable, str(entry), '--help'], cwd=scratch,
                        env={'PATH': os.environ['PATH'], 'PYTHONDONTWRITEBYTECODE': '1'},
                        capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn('usage:', result.stdout)

    def test_discovery_and_fixture_help_do_not_require_the_execution_environment(self):
        with tempfile.TemporaryDirectory() as scratch:
            for relative, option in (
                ('tests/support/run-native-suite.py', '--list'),
                ('tests/support/run-postgres-suite.py', '--help'),
                ('tests/integration/test-connected-native-guest.py', '--help'),
                ('tests/contracts/test-api-cli.py', '--help'),
            ):
                with self.subTest(entry=relative):
                    result = subprocess.run([sys.executable, str(ROOT / relative), option], cwd=scratch,
                        env={'PATH': os.environ['PATH'], 'PYTHONDONTWRITEBYTECODE': '1'},
                        capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_shared_test_package_change_requires_complete_inventory(self):
        for path in ('tests/__init__.py', 'tests/support/__init__.py',
                     'tests/support/check_catalog.py', 'scripts/check.py'):
            with self.subTest(path=path):
                plan = build_plan([path], base='1'*40, head='2'*40, source_digest='a'*64)
                self.assertEqual(set(plan['selected']), set(catalog()))


if __name__ == '__main__':
    unittest.main()
