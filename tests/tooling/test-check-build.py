#!/usr/bin/env python3
"""Distribution behavior tests using synthetic executables and Cargo event records.

No Cargo build, daemon, provider, account or installation is invoked here.
"""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import contextlib
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
import sys
import unittest
from unittest.mock import patch

import tests.support.check as runner
import tests.support.check_build as distribution
from tests.support.check_catalog import aggregate_results, build_plan

SOURCE = 'a' * 64
OTHER = 'b' * 64
VERSIONS = {'toolchain': {'cargo': 'cargo 1.94.1', 'rustc': 'rustc 1.94.1'},
            'platform': {'system': 'Linux', 'machine': 'aarch64'}}


class DistributionContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='distribution-contract-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        (self.root / 'Cargo.toml').write_text('[workspace]\nmembers=["app"]\n')
        app = self.root / 'app'
        (app / 'src/bin').mkdir(parents=True)
        (app / 'Cargo.toml').write_text('[package]\nname="primary"\nversion="0.1.0"\n')
        (app / 'src/main.rs').write_text('fn main() {}\n')
        (app / 'src/bin/secondary.rs').write_text('fn main() {}\n')
        self.target = self.root / 'target'
        self.binary = self.target / 'debug'
        self.binary.mkdir(parents=True)
        self.manifest_path = self.target / 'build.json'
        self.config = {'target_dir': str(self.target), 'bin_dir': str(self.binary),
                       'build_manifest': str(self.manifest_path)}
        self.calls = []
        self.versions = patch.object(distribution, '_versions', return_value=copy.deepcopy(VERSIONS))
        self.versions.start()
        self.addCleanup(self.versions.stop)

    def execute(self, command, timeout, log):
        self.calls.append((command, timeout))
        for name in ('primary', 'secondary'):
            binary = self.binary / name
            binary.write_bytes(b'synthetic executable: ' + name.encode())
            binary.chmod(0o755)
            event = {'reason': 'compiler-artifact', 'target': {'name': name, 'kind': ['bin']},
                     'executable': str(binary)}
            log.write((json.dumps(event) + '\n').encode())
        log.write(b'{"reason":"build-finished","success":true}\n')
        return 0

    def build(self, digest=lambda: SOURCE, execute=None):
        return distribution.build(self.root, self.config, digest, execute or self.execute)

    def plan(self, paths=('Cargo.toml',)):
        plan = build_plan(paths, base='1' * 40, head='2' * 40, source_digest=SOURCE)
        results = [{'id': name, 'status': 'PASS', 'source_digest': SOURCE,
                    'plan_digest': plan['plan_digest']} for name in plan['selected']]
        return plan, aggregate_results(plan, results, source_digest=SOURCE)

    def test_build_identifies_all_binaries_without_recording_local_paths(self):
        manifest = self.build()
        self.assertEqual(manifest, distribution.validate_build(self.root, self.config, SOURCE))
        self.assertEqual({row['name'] for row in manifest['binaries']}, {'primary', 'secondary'})
        self.assertNotIn(str(self.root), self.manifest_path.read_text())
        self.assertEqual(self.manifest_path.stat().st_mode & 0o777, 0o600)
        command, timeout = self.calls[0]
        self.assertIn('--locked', command)
        self.assertIn('--offline', command)
        self.assertIn('--message-format=json', command)
        self.assertEqual(command[command.index('--target-dir') + 1], str(self.target))
        self.assertGreater(timeout, 0)

    def test_build_normalizes_current_owned_group_writable_outputs(self):
        def group_writable(command, timeout, log):
            result = self.execute(command, timeout, log)
            for name in ('primary', 'secondary'):
                (self.binary / name).chmod(0o775)
            return result
        manifest = self.build(execute=group_writable)
        self.assertEqual(manifest, distribution.validate_build(self.root, self.config, SOURCE))
        self.assertTrue(all((self.binary / name).stat().st_mode & 0o777 == 0o755
                            for name in ('primary', 'secondary')))

    def test_build_uses_restrictive_umask_and_restores_it_after_failure(self):
        observed = []
        def fail(command, timeout, log):
            mask = os.umask(0o077)
            os.umask(mask)
            observed.append(mask)
            raise RuntimeError('synthetic command failure')
        previous = os.umask(0o002)
        try:
            with self.assertRaises(RuntimeError):
                self.build(execute=fail)
            restored = os.umask(0o002)
            self.assertEqual(restored, 0o002)
            self.assertEqual(observed, [0o077])
        finally:
            os.umask(previous)

    def test_cargo_executable_and_accounted_deps_hardlink_are_normalized_together(self):
        deps = self.binary / 'deps'
        deps.mkdir()
        def linked(command, timeout, log):
            result = self.execute(command, timeout, log)
            for name in ('primary', 'secondary'):
                binary = self.binary / name
                binary.chmod(0o775)
                os.link(binary, deps / (name + '-0123456789abcdef'))
            return result
        self.build(execute=linked)
        for name in ('primary', 'secondary'):
            binary, alias = self.binary / name, deps / (name + '-0123456789abcdef')
            self.assertEqual(binary.stat().st_ino, alias.stat().st_ino)
            self.assertEqual(alias.stat().st_mode & 0o777, 0o755)
            self.assertEqual(alias.stat().st_nlink, 2)

    def test_unaccounted_hardlink_cannot_change_another_file_permissions(self):
        (self.binary / 'deps').mkdir()
        external = self.root / 'unrelated-file'
        def linked_elsewhere(command, timeout, log):
            result = self.execute(command, timeout, log)
            binary = self.binary / 'primary'
            binary.chmod(0o775)
            os.link(binary, external)
            return result
        with self.assertRaises(ValueError):
            self.build(execute=linked_elsewhere)
        self.assertEqual(external.stat().st_mode & 0o777, 0o775)
        self.assertFalse(self.manifest_path.exists())

    def test_build_cannot_normalize_outputs_owned_by_another_identity(self):
        def unowned(command, timeout, log):
            result = self.execute(command, timeout, log)
            (self.binary / 'primary').chmod(0o775)
            return result
        caller = os.geteuid()
        with patch.object(distribution.os, 'geteuid', return_value=caller + 1):
            with self.assertRaises(ValueError):
                self.build(execute=unowned)
        self.assertEqual((self.binary / 'primary').stat().st_mode & 0o777, 0o775)
        self.assertFalse(self.manifest_path.exists())

    def test_executable_tampering_or_lost_execute_permission_invalidates_build(self):
        self.build()
        binary = self.binary / 'primary'
        original = binary.read_bytes()
        binary.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            distribution.validate_build(self.root, self.config, SOURCE)
        binary.write_bytes(original)
        binary.chmod(0o600)
        with self.assertRaises(ValueError):
            distribution.validate_build(self.root, self.config, SOURCE)

    def test_manifest_cannot_redirect_or_omit_a_required_binary(self):
        manifest = self.build()
        for mutate in (lambda item: item['binaries'].pop(),
                       lambda item: item['binaries'][0].update(name='../secret'),
                       lambda item: item.update(source_digest=OTHER),
                       lambda item: item.update(path=str(self.root))):
            candidate = copy.deepcopy(manifest)
            mutate(candidate)
            self.manifest_path.write_text(json.dumps(candidate))
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                distribution.validate_build(self.root, self.config, SOURCE)

    def test_same_manifest_cannot_attest_changed_source_or_another_binary_directory(self):
        self.build()
        with self.assertRaises(ValueError):
            distribution.validate_build(self.root, self.config, OTHER)
        other = self.target / 'elsewhere'
        other.mkdir()
        with self.assertRaises(ValueError):
            distribution.validate_build(self.root, self.config | {'bin_dir': str(other)}, SOURCE)

    def test_symlink_and_writable_executable_are_not_distribution_inputs(self):
        self.build()
        binary = self.binary / 'primary'
        binary.chmod(0o777)
        with self.assertRaises(ValueError):
            distribution.validate_build(self.root, self.config, SOURCE)
        binary.unlink()
        binary.symlink_to('secondary')
        with self.assertRaises((ValueError, OSError)):
            distribution.validate_build(self.root, self.config, SOURCE)

    def test_config_must_use_exact_paths_and_existing_manifest_is_preserved(self):
        self.build()
        previous = self.manifest_path.read_bytes()
        with self.assertRaises(FileExistsError):
            self.build()
        self.assertEqual(self.manifest_path.read_bytes(), previous)
        alias = self.root / 'alias'
        alias.symlink_to(self.target, target_is_directory=True)
        for target in ('target', str(alias)):
            with self.subTest(target=target), self.assertRaises(ValueError):
                distribution.validate_build(self.root, self.config | {'target_dir': target}, SOURCE)
        self.assertEqual(len(self.calls), 1)

    def test_successful_exit_without_current_cargo_artifacts_does_not_attest_stale_files(self):
        for name in ('primary', 'secondary'):
            path = self.binary / name
            path.write_text('stale executable')
            path.chmod(0o755)
        with self.assertRaises(ValueError):
            self.build(execute=lambda command, timeout, log: 0)
        self.assertFalse(self.manifest_path.exists())

    def test_redirected_cargo_artifact_is_rejected(self):
        def redirected(command, timeout, log):
            fake = io.BytesIO()
            self.execute(command, timeout, fake)
            log.write(fake.getvalue().replace(str(self.binary).encode(), str(self.target / 'other').encode()))
            return 0
        with self.assertRaises(ValueError):
            self.build(execute=redirected)
        self.assertFalse(self.manifest_path.exists())

    def test_source_mutation_during_build_prevents_manifest_publication(self):
        values = iter([SOURCE, OTHER])
        with self.assertRaises(ValueError):
            self.build(digest=lambda: next(values))
        self.assertFalse(self.manifest_path.exists())

    def test_failed_build_does_not_produce_attestation(self):
        with self.assertRaises(ValueError):
            self.build(execute=lambda command, timeout, log: 9)
        self.assertFalse(self.manifest_path.exists())

    def test_workspace_addition_invalidates_old_binary_inventory(self):
        self.build()
        (self.root / 'app/src/bin/third.rs').write_text('fn main() {}')
        with self.assertRaises(FileNotFoundError):
            distribution.validate_build(self.root, self.config, SOURCE)

    def test_archive_is_reproducible_and_contains_only_verified_sanitized_payload(self):
        manifest = self.build()
        plan, summary = self.plan()
        outputs = [self.target / 'first.tar.gz', self.target / 'second.tar.gz']
        for output in outputs:
            distribution.package(self.root, self.config, plan, summary, manifest, output)
        self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())
        with tarfile.open(outputs[0], 'r:gz') as archive:
            self.assertEqual(set(archive.getnames()), {'bin/primary', 'bin/secondary', 'SHA256SUMS',
                                                      'build-manifest.json', 'versions.json', 'validation.json'})
            for entry in archive:
                self.assertEqual((entry.uid, entry.gid, entry.mtime, entry.uname, entry.gname), (0, 0, 0, '', ''))
                content = archive.extractfile(entry).read()
                self.assertNotIn(str(self.root).encode(), content)
                if entry.name.startswith('bin/'):
                    record = next(row for row in manifest['binaries'] if row['name'] == entry.name[4:])
                    self.assertEqual(hashlib.sha256(content).hexdigest(), record['sha256'])
                    self.assertEqual(entry.mode, 0o755)
        before = outputs[0].read_bytes()
        with self.assertRaises(FileExistsError):
            distribution.package(self.root, self.config, plan, summary, manifest, outputs[0])
        self.assertEqual(outputs[0].read_bytes(), before)

    def test_package_cli_accepts_relative_output_without_resolving_aliases(self):
        self.build()
        plan, summary = self.plan()
        inputs = {'plan.json': plan, 'summary.json': summary, 'environment.json': self.config}
        for name, value in inputs.items():
            (self.root / name).write_text(json.dumps(value))
        destination = self.root / '.local/verified'
        destination.mkdir(parents=True)

        def package(output):
            arguments = ['tests.support.check.py', 'package', '--plan', str(self.root / 'plan.json'),
                         '--summary', str(self.root / 'summary.json'),
                         '--build-manifest', str(self.manifest_path),
                         '--environment', str(self.root / 'environment.json'), '--output', output]
            with contextlib.chdir(self.root), patch.object(sys, 'argv', arguments), \
                 patch.object(runner, 'ROOT', self.root), \
                 patch.object(runner, 'source_digest', return_value=SOURCE), \
                 contextlib.redirect_stdout(io.StringIO()):
                return runner.main()

        relative = '.local/verified/fixture.tar.gz'
        self.assertEqual(package(relative), 0)
        final = self.root / relative
        with tarfile.open(final, 'r:gz') as archive:
            self.assertTrue({'bin/primary', 'bin/secondary', 'validation.json'} <= set(archive.getnames()))
        original = final.read_bytes()
        with self.assertRaises(FileExistsError):
            package(relative)
        self.assertEqual(final.read_bytes(), original)

        (self.root / 'shortcut').symlink_to(destination, target_is_directory=True)
        for rejected in ['shortcut/rejected.tar.gz', '.local/verified/../verified/rejected.tar.gz']:
            with self.subTest(path=rejected), self.assertRaises(ValueError):
                package(rejected)
            self.assertFalse((destination / 'rejected.tar.gz').exists())
            self.assertFalse((destination / 'rejected.tar.gz.partial').exists())

    def test_unverified_or_mismatched_summary_never_produces_final_archive(self):
        manifest = self.build()
        plan, summary = self.plan()
        mutations = [dict(status='FAIL'), dict(source_digest=OTHER), dict(plan_digest=OTHER),
                     dict(required=0), dict(passed=0), dict(missing=['native.workflow']),
                     dict(failed=[{'id': 'rust.invariants', 'status': 'NOT RUN'}]),
                     dict(raw_log='secret value')]
        for number, mutation in enumerate(mutations):
            output = self.target / f'rejected-{number}.tar.gz'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                distribution.package(self.root, self.config, plan, summary | mutation, manifest, output)
            self.assertFalse(output.exists())

    def test_docs_only_success_is_not_an_installation_validation(self):
        manifest = self.build()
        plan, summary = self.plan(('README.md',))
        with self.assertRaises(ValueError):
            distribution.package(self.root, self.config, plan, summary, manifest, self.target / 'docs.tar.gz')

    def test_failed_final_recheck_does_not_publish_partial_archive(self):
        manifest = self.build()
        plan, summary = self.plan()
        output = self.target / 'race.tar.gz'
        with patch.object(distribution, 'validate_build', side_effect=[manifest, ValueError('changed')]):
            with self.assertRaises(ValueError):
                distribution.package(self.root, self.config, plan, summary, manifest, output)
        self.assertFalse(output.exists())
        self.assertTrue(output.with_name(output.name + '.partial').exists())


if __name__ == '__main__':
    unittest.main()
