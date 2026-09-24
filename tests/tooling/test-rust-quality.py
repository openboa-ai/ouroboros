#!/usr/bin/env python3
"""Negative coverage, test accounting and required Mac result contracts."""
if __package__ in (None, ''):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import contextlib
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from tests.support import check as runner
from tests.support.check_catalog import build_plan, aggregate_results, CatalogError
from tests.support.rust_quality import ROOT, check, source_paths
from tests.support.rust_suite import compiler_locations, harnesses, test_names, test_summary
from tests.support.rust_audit import audit_ok


class QualityContract(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='rust-quality-contract-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.paths = [name for name in source_paths(ROOT)
                      if Path(name).name in ('Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml')
                      or name.endswith('.rs') or name == 'tests/support/rust_quality.toml']
        for name in self.paths:
            destination = self.root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, destination)
        self.assertEqual(self.result()['status'], 'PASS')

    def result(self):
        return check(self.root, self.paths)

    def change(self, path, old, new):
        file = self.root / path
        text = file.read_text()
        self.assertIn(old, text)
        file.write_text(text.replace(old, new))

    def test_new_workspace_and_lockfile_cannot_be_omitted(self):
        for name, content in [('future/Cargo.toml', '[workspace]\n'), ('future/Cargo.lock', '')]:
            file = self.root / name
            file.parent.mkdir(exist_ok=True)
            file.write_text(content)
            self.paths.append(name)
            self.assertEqual(self.result()['status'], 'FAIL')
            self.paths.remove(name)

    def test_member_cannot_drop_lints_or_rust_version(self):
        name = 'crates/core/Cargo.toml'
        file = self.root / name
        original = file.read_text()
        for before, after in [('rust-version.workspace = true', 'rust-version = "1.93"'),
                              ('[lints]\nworkspace = true', '[lints.rust]\nunused_must_use = "allow"')]:
            file.write_text(original.replace(before, after))
            self.assertEqual(self.result()['status'], 'FAIL')
        file.write_text(original)

    def test_mac_cannot_weaken_workspace_policy(self):
        self.change('apps/mac/src-tauri/Cargo.toml', 'undocumented_unsafe_blocks = "deny"',
                    'undocumented_unsafe_blocks = "warn"')
        self.assertEqual(self.result()['status'], 'FAIL')

    def test_drifted_or_nested_toolchain_is_rejected(self):
        self.change('rust-toolchain.toml', '1.94.1', '1.93.0')
        self.assertEqual(self.result()['status'], 'FAIL')
        self.change('rust-toolchain.toml', '1.93.0', '1.94.1')
        nested = 'apps/mac/rust-toolchain.toml'
        (self.root / nested).write_text('[toolchain]\nchannel="1.94.1"\n')
        self.paths.append(nested)
        self.assertEqual(self.result()['status'], 'FAIL')

    def test_new_ignored_or_feature_gated_test_requires_execution_mapping(self):
        path = self.root / 'crates/core/src/lib.rs'
        original = path.read_text()
        path.write_text(original + '\n#[test]\n#[ignore]\nfn omitted_obligation() {}\n')
        self.assertEqual(self.result()['status'], 'FAIL')
        path.write_text(original)
        with (self.root / 'crates/core/Cargo.toml').open('a') as output:
            output.write('\n[[test]]\nname="extra"\nrequired-features=["unregistered"]\n')
        self.assertEqual(self.result()['status'], 'FAIL')

    def test_incomplete_empty_and_filtered_test_output_cannot_pass(self):
        good = 'test result: ok. 2 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out'
        self.assertEqual(test_summary(good), {'passed': 2, 'ignored': 1})
        for value in ['', good.replace('2 passed', '0 passed').replace('1 ignored', '0 ignored'),
                      good.replace('0 failed', '1 failed'), good.replace('0 filtered', '1 filtered'),
                      'test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                test_summary(value)
        with self.assertRaises(ValueError):
            test_names('some_test: test\n')
        with self.assertRaises(ValueError):
            test_names('some_test: test\nsome_test: test\n2 tests, 0 benchmarks\n')

    def test_only_current_cargo_executables_can_be_selected(self):
        binary = self.root / 'test-bin'
        binary.write_bytes(b'fixture')
        artifact = {'reason': 'compiler-artifact', 'profile': {'test': True},
                    'executable': str(binary), 'target': {'name': 'fixture'}}
        finish = {'reason': 'build-finished', 'success': True}
        output = lambda records: '\n'.join(json.dumps(item) for item in records)
        self.assertEqual(list(harnesses(output([artifact, finish]), self.root)), [binary])
        for items in [[artifact], [finish], [artifact, artifact, finish],
                      [artifact, {**finish, 'success': False}], [artifact, finish, finish]]:
            with self.subTest(items=items), self.assertRaises(ValueError):
                harnesses(output(items), self.root)
        with self.assertRaises(ValueError):
            harnesses(output([artifact, finish]), self.root / 'other-target')

    def test_compiler_diagnostics_publish_only_known_source_locations(self):
        def event(path):
            return json.dumps({'reason': 'compiler-message', 'message': {
                'level': 'error', 'message': 'private-diagnostic-canary',
                'spans': [{'is_primary': True, 'file_name': path, 'line_start': 12}]}})
        result = compiler_locations('\n'.join([event('crates/transport/src/lib.rs'),
            event('/private/canary.rs'), event('crates/unknown-canary.rs')]))
        self.assertEqual(result, ['crates/transport/src/lib.rs:12'])
        self.assertNotIn('canary', str(result))

    def test_failed_or_incomplete_audit_cannot_pass(self):
        clean = {'vulnerabilities': {'found': False, 'count': 0, 'list': []}}
        self.assertTrue(audit_ok(clean))
        for value in [{}, {'vulnerabilities': {'found': False}},
                      {'vulnerabilities': {'found': True, 'count': 1, 'list': [{'id': 'fixture'}]}}]:
            self.assertFalse(audit_ok(value))

    def test_every_mac_result_is_required_once_for_current_source(self):
        source = 'a' * 64
        plan = build_plan(['apps/mac/src-tauri/src/main.rs'], base='1'*40, head='2'*40, source_digest=source)
        rows = [{'id': name, 'status': 'PASS', 'plan_digest': plan['plan_digest'], 'source_digest': source}
                for name in plan['selected']]
        self.assertEqual(aggregate_results(plan, rows, source_digest=source)['status'], 'PASS')
        for name in ('mac.frontend', 'mac.rust', 'mac.gateway', 'rust.dependencies'):
            row = next(item for item in rows if item['id'] == name)
            self.assertEqual(aggregate_results(plan, [item for item in rows if item != row], source_digest=source)['status'], 'FAIL')
            for status in ('FAIL', 'NOT RUN', 'CANCELLED', 'SKIPPED'):
                changed = [{**item, 'status': status} if item == row else item for item in rows]
                self.assertEqual(aggregate_results(plan, changed, source_digest=source)['status'], 'FAIL')
            for bad in [rows + [row], [{**item, 'source_digest': 'b'*64} if item == row else item for item in rows]]:
                with self.assertRaises(CatalogError):
                    aggregate_results(plan, bad, source_digest=source)

    def test_success_exit_without_rust_receipt_is_a_failed_scenario(self):
        source = 'a' * 64
        plan = build_plan(['apps/mac/src-tauri/src/main.rs'], base='1'*40, head='2'*40, source_digest=source)
        result = self.root / 'results.json'
        with patch.object(runner, 'source_digest', return_value=source), \
             patch.object(runner, 'commands', return_value=[(['fixture'], 1)]), \
             patch.object(runner, 'execute', return_value=0), contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(runner.run(plan, 'mac', {}, result))
        row = next(item for item in json.loads(result.read_text()) if item['id'] == 'mac.rust')
        self.assertEqual(row['status'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
