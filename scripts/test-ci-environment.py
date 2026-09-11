"""Deterministic CI binding/artifact/gate checks; no downloads, provisioning or Docker."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import ci_environment as ci

kernel_spec = importlib.util.spec_from_file_location('kernel_builder', Path(__file__).with_name('prepare-kernel-contract.py'))
kernel = importlib.util.module_from_spec(kernel_spec)
kernel_spec.loader.exec_module(kernel)


class EnvironmentContracts(unittest.TestCase):
    def test_developer_environment_is_never_adopted_as_hosted_runner(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                ci.hosted()

    def test_child_commands_cannot_inherit_account_or_proxy_configuration(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'not-real', 'HTTPS_PROXY': 'https://invalid',
                                    'RUSTUP_TOOLCHAIN': '1.94.1', 'CARGO_PROFILE_DEV_DEBUG': '0'}, clear=True):
            output = ci.child_environment()
        self.assertNotIn('OPENAI_API_KEY', output)
        self.assertNotIn('HTTPS_PROXY', output)
        self.assertEqual(output['RUSTUP_TOOLCHAIN'], '1.94.1')
        self.assertEqual(output['CARGO_PROFILE_DEV_DEBUG'], '0')

    def test_fresh_checkout_prepares_the_build_directory_before_cargo(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / 'temp').mkdir()
            with patch.object(ci, 'ROOT', root), patch.object(ci, 'hosted'), patch.object(ci, 'linux'), patch.object(ci, 'run') as execute, patch.dict(os.environ, {'RUNNER_TEMP': str(root / 'temp')}):
                ci.prepare('build', root / '.local/environment.json')
                config = json.loads((root / '.local/environment.json').read_text())
            self.assertTrue(Path(config['bin_dir']).is_dir())
            self.assertEqual(Path(config['bin_dir']).parent, Path(config['target_dir']))
            self.assertEqual(stat.S_IMODE(Path(config['scratch_root']).stat().st_mode), 0o700)
            self.assertEqual(execute.call_args_list[0].args[0][:4], ['rustup', 'toolchain', 'install', '1.94.1'])

    def test_package_checks_pinned_toolchain_without_fetching_dependencies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            with patch.object(ci, 'ROOT', root), patch.object(ci, 'hosted'), patch.object(ci, 'linux'), patch.object(ci, 'run') as execute, patch.dict(os.environ, {'RUNNER_TEMP': str(root)}):
                ci.prepare('package', root / '.local/environment.json')
            calls = [call.args[0] for call in execute.call_args_list]
            self.assertTrue(any(command[:3] == ['rustup', 'toolchain', 'install'] for command in calls))
            self.assertFalse(any(command[0] == 'cargo' for command in calls))

    def test_directory_alias_cannot_change_an_unrelated_permission(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            directory = root / 'untouched'
            directory.mkdir(mode=0o755)
            alias = root / 'alias'
            alias.symlink_to(directory, target_is_directory=True)
            mode = directory.stat().st_mode
            with self.assertRaises(ValueError):
                ci.private_directory(alias)
            self.assertEqual(directory.stat().st_mode, mode)


class BuildBundleContracts(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name).resolve()
        self.patch = patch.object(ci, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.local = self.root / '.local'
        self.binary = self.local / 'target/debug/ouroboros-cli'
        self.binary.parent.mkdir(parents=True)
        self.content = b'synthetic executable bytes\n'
        self.binary.write_bytes(self.content)
        self.binary.chmod(0o755)
        self.manifest = {'schema': 1, 'binaries': [{'name': self.binary.name,
            'sha256': hashlib.sha256(self.content).hexdigest(), 'size': len(self.content), 'executable': True}]}
        (self.local / 'build.json').write_text(json.dumps(self.manifest))
        self.archive = self.root / 'bundle.tar.gz'

    def custom_bundle(self, entries):
        with tarfile.open(self.archive, 'w:gz') as output:
            for name, kind, content in entries:
                item = tarfile.TarInfo(name)
                item.type = kind
                item.size = len(content) if kind == tarfile.REGTYPE else 0
                if kind in (tarfile.SYMTYPE, tarfile.LNKTYPE):
                    item.linkname = 'unrelated'
                output.addfile(item, io.BytesIO(content))

    def valid_entries(self, binary=None):
        return [('build.json', tarfile.REGTYPE, json.dumps(self.manifest).encode()),
                ('target/debug/ouroboros-cli', tarfile.REGTYPE, self.content if binary is None else binary)]

    def test_received_verified_build_replaces_only_disposable_binary_cache(self):
        unrelated = self.local / 'retained.json'
        unrelated.write_text('retained')
        ci.bundle(self.archive)
        self.binary.write_bytes(b'old compiler output')
        ci.unpack(self.archive)
        self.assertEqual(self.binary.read_bytes(), self.content)
        self.assertEqual(stat.S_IMODE(self.binary.stat().st_mode), 0o755)
        self.assertEqual(unrelated.read_text(), 'retained')

    def test_binary_changed_after_build_receipt_cannot_be_bundled(self):
        self.binary.write_bytes(b'different source result')
        with self.assertRaises(ValueError):
            ci.bundle(self.archive)

    def test_bad_received_digest_does_not_overwrite_existing_binary(self):
        self.custom_bundle(self.valid_entries(b'tampered artifact'))
        with self.assertRaises(ValueError):
            ci.unpack(self.archive)
        self.assertEqual(self.binary.read_bytes(), self.content)

    def test_unlisted_member_and_duplicate_cannot_be_adopted(self):
        for entry in [('target/debug/ouroboros-extra', tarfile.REGTYPE, b'extra'), self.valid_entries()[1]]:
            with self.subTest(entry=entry[0]):
                self.custom_bundle(self.valid_entries() + [entry])
                with self.assertRaises(ValueError):
                    ci.unpack(self.archive)
                self.assertEqual(self.binary.read_bytes(), self.content)

    def test_traversal_and_archive_links_are_rejected(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                           ('target/debug/ouroboros-cli', tarfile.SYMTYPE),
                           ('target/debug/ouroboros-cli', tarfile.LNKTYPE)]:
            with self.subTest(name=name, kind=kind):
                self.custom_bundle([self.valid_entries()[0], (name, kind, b'')])
                with self.assertRaises(ValueError):
                    ci.unpack(self.archive)
                self.assertFalse((self.root / 'escape').exists())

    def test_destination_symlink_cannot_redirect_verified_bytes(self):
        ci.bundle(self.archive)
        self.binary.unlink()
        target = self.root / 'unrelated'
        target.write_text('retained')
        self.binary.symlink_to(target)
        with self.assertRaises(ValueError):
            ci.unpack(self.archive)
        self.assertEqual(target.read_text(), 'retained')


class GateContracts(unittest.TestCase):
    def test_missing_failed_cancelled_or_skipped_required_jobs_cannot_publish_pass(self):
        jobs = {name: 'success' for name in ('PLAN_RESULT', 'BUILD_RESULT', 'CHECKS_RESULT', 'MAC_RESULT')}
        for name in jobs:
            for state in ('failure', 'cancelled', 'skipped', None):
                with self.subTest(job=name, state=state):
                    failed = dict(jobs)
                    if state is None:
                        failed.pop(name)
                    else:
                        failed[name] = state
                    self.assertEqual(ci.workflow_summary({'status': 'PASS'}, failed, 0, 'true', 'true')['status'], 'FAIL')

    def test_only_unselected_build_and_mac_jobs_can_be_skipped(self):
        jobs = {'PLAN_RESULT': 'success', 'CHECKS_RESULT': 'success', 'BUILD_RESULT': 'skipped', 'MAC_RESULT': 'skipped'}
        self.assertEqual(ci.workflow_summary({'status': 'PASS'}, jobs, 0, 'false', 'false'), {'status': 'PASS'})

    def test_missing_report_failure_or_invalid_selection_cannot_pass(self):
        jobs = {name: 'success' for name in ('PLAN_RESULT', 'BUILD_RESULT', 'CHECKS_RESULT', 'MAC_RESULT')}
        for case, exit_code, build, mac in [(None, 0, 'true', 'true'), ({'status': 'PASS'}, 1, 'true', 'true'),
                                          ({'status': 'FAIL'}, 0, 'true', 'true'), ({'status': 'PASS'}, 0, None, 'true')]:
            self.assertEqual(ci.workflow_summary(case, jobs, exit_code, build, mac)['status'], 'FAIL')


class KernelBuildContracts(unittest.TestCase):
    def test_cargo_must_identify_current_harness_instead_of_discovering_cached_binary(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            binary = target / 'debug/deps/runtime-fixture'
            binary.parent.mkdir(parents=True)
            binary.write_bytes(b'synthetic test executable')
            log = target / 'build.log'
            artifact = {'reason': 'compiler-artifact', 'target': {'name': 'ouroboros_runtime', 'kind': ['lib']},
                        'profile': {'test': True}, 'executable': str(binary)}
            finished = {'reason': 'build-finished', 'success': True}
            log.write_text(json.dumps(artifact) + '\n' + json.dumps(finished) + '\n')
            self.assertEqual(kernel.artifact(log, target), binary)
            for events in ([finished], [artifact], [artifact, artifact, finished], [artifact, {'reason': 'build-finished', 'success': False}]):
                log.write_text('\n'.join(json.dumps(event) for event in events))
                with self.assertRaises(ValueError):
                    kernel.artifact(log, target)

    def test_cargo_cannot_redirect_kernel_identity_to_an_arbitrary_executable(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary).resolve()
            binary = target / 'unrelated'
            binary.write_bytes(b'not a test harness')
            event = {'reason': 'compiler-artifact', 'target': {'name': 'ouroboros_runtime', 'kind': ['lib']},
                     'profile': {'test': True}, 'executable': str(binary)}
            log = target / 'build.log'
            log.write_text(json.dumps(event) + '\n' + json.dumps({'reason': 'build-finished', 'success': True}))
            with self.assertRaises(ValueError):
                kernel.artifact(log, target)

    def test_caller_owned_group_writable_cargo_output_gets_fixed_permissions(self):
        with tempfile.TemporaryDirectory() as temporary:
            binary = Path(temporary).resolve() / 'harness'
            content = b'synthetic executable'
            binary.write_bytes(content)
            binary.chmod(0o775)
            self.assertEqual(kernel.protect_harness(binary), hashlib.sha256(content).hexdigest())
            self.assertEqual(stat.S_IMODE(binary.stat().st_mode), 0o755)
            self.assertEqual(binary.read_bytes(), content)

    def test_aliases_or_other_owners_are_not_permission_repair_targets(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            binary = root / 'harness'
            binary.write_bytes(b'executable')
            binary.chmod(0o775)
            alias = root / 'alias'
            alias.symlink_to(binary)
            with self.assertRaises((OSError, ValueError)):
                kernel.protect_harness(alias)
            alias.unlink()
            os.link(binary, alias)
            with self.assertRaises(ValueError):
                kernel.protect_harness(binary)
            alias.unlink()
            with patch.object(kernel.os, 'geteuid', return_value=binary.stat().st_uid + 1):
                with self.assertRaises(ValueError):
                    kernel.protect_harness(binary)
            self.assertEqual(stat.S_IMODE(binary.stat().st_mode), 0o775)

    def test_failed_qualification_never_publishes_a_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            output = root / 'kernel.json'
            with patch.object(kernel, 'verify_manifest', side_effect=ValueError('ineligible executable')):
                with self.assertRaises(ValueError):
                    kernel.publish_manifest({'version': 1}, root, output)
            self.assertFalse(output.exists())
            self.assertTrue(output.with_name('kernel.json.partial').is_file())

    def test_qualification_precedes_exclusive_final_publication(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            output = root / 'kernel.json'
            def verify(partial, checked_root):
                self.assertFalse(output.exists())
                self.assertEqual(checked_root, root)
                self.assertEqual(json.loads(partial.read_text()), {'version': 1})
            with patch.object(kernel, 'verify_manifest', side_effect=verify):
                kernel.publish_manifest({'version': 1}, root, output)
            self.assertEqual(json.loads(output.read_text()), {'version': 1})
            self.assertFalse(output.with_name('kernel.json.partial').exists())
            self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o600)

    def test_cargo_child_uses_private_creation_mask(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            with patch.object(kernel.platform, 'system', return_value='Linux'), patch.object(kernel.platform, 'machine', return_value='aarch64'), patch.object(kernel, 'source_digest', return_value='a' * 64), patch.object(kernel.subprocess, 'Popen') as execute:
                execute.return_value.wait.return_value = 1
                with self.assertRaises(ValueError):
                    kernel.build(root, root, root / 'kernel.json')
            self.assertEqual(execute.call_args.kwargs['umask'], 0o077)
            self.assertFalse((root / 'kernel.json').exists())

    def test_non_linux_host_cannot_prepare_a_kernel_claim(self):
        with patch.object(kernel.platform, 'system', return_value='Darwin'), patch.object(kernel.subprocess, 'Popen') as execute:
            with self.assertRaises(ValueError):
                kernel.build(Path('/source'), Path('/target'), Path('/manifest'))
            execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
