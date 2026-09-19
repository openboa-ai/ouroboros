"""Portable catalogue/selection/lifecycle checks; no native, Docker or database calls."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import ast
import contextlib
import importlib.util
import hashlib
import io
import json
import os
import subprocess
import sys
import shutil
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from tests.support.native_scenarios import SCENARIOS, catalogue
from tests.support.native_image_identity import source_digest
from tests.support.native_kernel_contract import TEST_NAME, verify_manifest
from tests.support.native_build_input import hash_build_binary
from tests.support.native_suite_environment import child_environment, load_environment

spec = importlib.util.spec_from_file_location('native_suite_runner', Path(__file__).resolve().parents[2] / 'tests/support/run-native-suite.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class NativeSuiteContract(unittest.TestCase):
    def test_embedded_managed_mcp_transport_probe_compiles(self):
        # Parsing the fixture alone does not compile Python passed to `python -c`.
        path = Path(__file__).resolve().parents[1] / 'integration/test-connected-program-guest.py'
        tree = ast.parse(path.read_text())
        probes = [node.value.value for node in ast.walk(tree)
                  if isinstance(node, ast.Assign)
                  and any(isinstance(target, ast.Name) and target.id == 'transport_probe'
                          for target in node.targets)
                  and isinstance(node.value, ast.Constant)]
        self.assertEqual(len(probes), 1)
        compile(probes[0], str(path) + ':transport_probe', 'exec')

    def test_catalogue_has_unique_purposes_and_inherited_requirements(self):
        rows = catalogue()
        self.assertEqual(len(rows), len({row['id'] for row in rows}))
        self.assertTrue(all(row['purpose'] and row['responsibilities'] and row['provider'] == 'synthetic-only' for row in rows))
        self.assertTrue(set(SCENARIOS['native.adapter'].responsibilities) <= set(SCENARIOS['native.adapter-provider'].responsibilities))
        self.assertTrue(SCENARIOS['native.environment'].options('native.environment').rendered_environment)

    def test_every_named_scenario_is_a_valid_existing_oracle_combination(self):
        for name, scenario in SCENARIOS.items():
            with self.subTest(scenario=name):
                a = scenario.options(name)
                self.assertTrue(not a.shutdown_services or a.admission_pause_running)
                self.assertTrue(not a.admission_pause_running or (a.bounded_service_stop and not a.admission_pause))
                self.assertTrue(not a.admission_pause or a.bounded_service_fault)
                self.assertTrue(not a.bounded_service_fault or (a.bounded_service and not a.bounded_service_db and not a.bounded_service_stop))
                self.assertTrue(not a.bounded_service_db or (a.bounded_service and not a.bounded_service_stop))
                self.assertTrue(not a.bounded_service_stop or a.bounded_service)
                self.assertTrue(not a.bounded_service or (a.native_adapter and not any([a.bounded_worker, a.encrypted_provider, a.native_adapter_stop, a.native_adapter_running_stop])))
                self.assertTrue(not a.bounded_worker or (a.native_adapter and not a.native_adapter_stop and not a.native_adapter_running_stop))
                self.assertTrue(not a.persistent_worker or (a.bounded_worker and a.managed_guard))
                self.assertTrue(not a.native_adapter_running_stop or (a.native_adapter and not a.native_adapter_stop))
                self.assertTrue(not a.native_adapter_stop or a.native_adapter)
                self.assertTrue(not a.native_adapter or a.managed_mcp)
                self.assertTrue(not a.managed_mcp or a.materialized_native)
                self.assertTrue(not a.rendered_environment or (a.rendered_runtime and not any([a.encrypted_provider, a.shutdown_services, a.native_adapter])))
                self.assertTrue(not a.rendered_runtime or a.runtime_unit_loss)
                self.assertTrue(not a.runtime_unit_loss or (a.managed_guard and a.materialized_native and not any([a.control_native, a.revoke_native, a.native_adapter, a.encrypted_provider])))
                self.assertTrue(not a.encrypted_provider or not any([a.control_native, a.revoke_native, a.native_adapter_stop, a.native_adapter_running_stop]))
                self.assertTrue(not (a.encrypted_provider and a.materialized_native) or a.native_adapter)
                self.assertEqual(scenario.image_kind == 'checkpoint-read-barrier', a.revoke_restore)
                self.assertTrue(not scenario.restart or a.shutdown_services)

    def test_listing_needs_no_host_and_does_not_run_preflight(self):
        output = io.StringIO()
        with patch('sys.argv', ['run-native-suite.py', '--list']), patch.object(runner, 'preflight', side_effect=AssertionError('must not inspect host')), contextlib.redirect_stdout(output):
            self.assertEqual(runner.main(), 0)
        self.assertEqual({row['id'] for row in json.loads(output.getvalue())}, set(SCENARIOS))

    def test_connected_fixture_refuses_disabled_assertions_before_setup(self):
        result = subprocess.run([sys.executable, '-O', '-B',
                                 str(Path(__file__).resolve().parents[2] / 'tests/integration/test-connected-native-guest.py'), '--help'],
                                capture_output=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'optimized Python disables behavioral assertions', result.stderr)

    def test_child_environment_never_inherits_account_or_proxy_configuration(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'not-a-real-key', 'CODEX_HOME': '/some/account', 'HTTPS_PROXY': 'https://invalid', 'PATH': '/untrusted'}):
            env = child_environment({'pg_bin': Path('/tools/pg')}, Path('/test/home'))
        self.assertEqual(set(env), {'PATH', 'LANG', 'LC_ALL', 'PYTHONDONTWRITEBYTECODE', 'HOME', 'TMPDIR'})
        self.assertEqual(env['PATH'], '/tools/pg:/usr/local/bin:/usr/bin:/bin')

    def test_prepare_collision_never_writes_existing_run(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            old = root / 'runs' / 'old'
            old.mkdir(parents=True)
            retained = old / 'evidence.json'
            retained.write_text('existing test evidence')
            environment = {'run_root': root / 'runs', 'deployment_root': root / 'deployments',
                           'ipc_root': root / 'ipc', 'pg_bin': root / 'pg',
                           'postgres_uid': 123, 'postgres_gid': 123}
            observed = runner.NativeRun(environment, 'native.workflow', 'old').run()
            self.assertEqual(observed['status'], 'FAIL')
            self.assertEqual(list(old.iterdir()), [retained])
            self.assertEqual(retained.read_text(), 'existing test evidence')

    def test_failed_cleanup_cannot_be_reported_as_pass(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            environment = {'run_root': root, 'deployment_root': root / 'deployments',
                           'ipc_root': root / 'ipc', 'pg_bin': root / 'pg',
                           'postgres_uid': 123, 'postgres_gid': 123}
            case = runner.NativeRun(environment, 'native.workflow', 'new')
            def prepare():
                case.root.mkdir()
                case.created = True
            with patch.object(case, 'prepare', side_effect=prepare), patch.object(case, 'execute'), patch.object(runner, 'evidence_export', side_effect=ValueError('missing evidence')):
                observed = case.run()
            self.assertEqual(observed['status'], 'FAIL')
            self.assertFalse(observed['cleanup_complete'])
            self.assertEqual(json.loads((case.root / 'report.json').read_text()), observed)

    def test_image_identity_changes_with_build_inputs_but_not_research_or_docs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            names = ['Cargo.toml', 'Cargo.lock', 'tests/support/prepare-codex-fixture.sh',
                     'tests/support/prepare-connected-native.sh', 'tests/support/prepare-connected-program.sh',
                     'tests/support/test-profile.sh', 'tests/support/native_image_identity.py', 'tests/support/prepare-checkpoint-read-fixture.py',
                     'crates/example/Cargo.toml', 'crates/example/src/lib.rs', 'tests/fixtures/probe.rs']
            for name in names:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(name)
            before = source_digest(root)
            (root / 'README.md').write_text('unrelated prose')
            (root / 'research').mkdir()
            (root / 'research/local.json').write_text('local-only data')
            self.assertEqual(source_digest(root), before)
            (root / 'crates/example/src/lib.rs').write_text('changed compiled behavior')
            self.assertNotEqual(source_digest(root), before)
            (root / 'Cargo.lock').unlink()
            with self.assertRaises(FileNotFoundError):
                source_digest(root)

    def test_successful_parent_with_live_descendant_is_failed_and_cleaned(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            environment = {'run_root': root, 'deployment_root': root / 'deployments',
                           'ipc_root': root / 'ipc', 'pg_bin': root / 'pg', 'source_root': root,
                           'postgres_uid': 123, 'postgres_gid': 123}
            case = runner.NativeRun(environment, 'native.workflow', 'children')
            case.root.mkdir()
            class Parent:
                pid = 777
                returncode = 0
                def wait(self, timeout):
                    return 0
            with patch.object(runner.subprocess, 'Popen', return_value=Parent()), patch.object(runner, 'group_members', return_value=[778]), patch.object(runner, 'terminate_group') as cleanup:
                with self.assertRaisesRegex(RuntimeError, 'descendants remained'):
                    case.command(['never-executed'], 'leaked-child')
                cleanup.assert_called_once()
            self.assertEqual(case.commands[-1]['status'], 'FAIL')
            self.assertEqual(case.commands[-1]['exit'], 0)

    def test_kernel_manifest_rejects_old_source_wrong_test_and_changed_binary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            binary = root / 'test-harness'
            binary.write_bytes(b'not an executable fixture; never launched')
            binary.chmod(0o700)
            manifest = {'version': 1, 'source_sha256': 'a' * 64, 'binary': str(binary),
                        'sha256': hashlib.sha256(binary.read_bytes()).hexdigest(), 'test_name': TEST_NAME}
            path = root / 'kernel.json'
            with patch('tests.support.native_kernel_contract.source_digest', return_value='a' * 64):
                path.write_text(json.dumps(manifest))
                self.assertEqual(verify_manifest(path, root), manifest)
                for change in ({'source_sha256': 'b' * 64}, {'test_name': 'unrelated_test'}, {'sha256': '0' * 64}, {'version': True}):
                    path.write_text(json.dumps({**manifest, **change}))
                    with self.subTest(change=list(change)), self.assertRaises(ValueError):
                        verify_manifest(path, root)

    def test_cargo_hardlink_is_copied_into_single_link_immutable_release(self):
        # Same protected-parent policy as fixture_release's own portable tests.
        root = Path(tempfile.mkdtemp(prefix='.native-cargo-test-', dir=Path.cwd())).resolve()
        try:
            source = root / 'debug'
            dependencies = source / 'deps'
            dependencies.mkdir(parents=True)
            original = dependencies / 'ouroboros-example-build'
            original.write_bytes(b'reproducible example build bytes')
            original.chmod(0o755)
            candidate = source / 'ouroboros-example'
            os.link(original, candidate)
            self.assertEqual(candidate.stat().st_nlink, 2)
            digest = hash_build_binary(candidate)
            manifest = {candidate.name: digest}
            released = runner.install(source, root / 'releases', manifest, os.geteuid())
            copied = Path(released['bin_dir']) / candidate.name
            self.assertEqual(copied.stat().st_nlink, 1)
            self.assertEqual(copied.stat().st_mode & 0o777, 0o555)
            self.assertNotEqual(copied.stat().st_ino, candidate.stat().st_ino)
            self.assertEqual(runner.hash_file(copied), digest)
            # Mutating Cargo's shared input cannot mutate the accepted release copy.
            original.write_bytes(b'new local build')
            self.assertEqual(candidate.read_bytes(), b'new local build')
            self.assertEqual(runner.hash_file(copied), digest)
            # The release invariant remains strict even though incoming Cargo aliases are valid.
            copied.parent.chmod(0o755)
            os.link(copied, copied.parent / 'unauthorized-link')
            with self.assertRaises(ValueError):
                runner.hash_file(copied)
        finally:
            for directory, _, _ in os.walk(root):
                os.chmod(directory, 0o700)
            shutil.rmtree(root)

    def test_build_input_rejects_symlink_mutability_and_changed_path_binding(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            path = root / 'binary'
            path.write_bytes(b'executable build')
            path.chmod(0o777)
            with self.assertRaises(ValueError):
                hash_build_binary(path)
            path.chmod(0o755)
            alias = root / 'alias'
            alias.symlink_to(path)
            with self.assertRaises(OSError):
                hash_build_binary(alias)
            other = root / 'other'
            other.write_bytes(path.read_bytes())
            other.chmod(0o755)
            with patch.object(Path, 'lstat', return_value=other.lstat()):
                with self.assertRaisesRegex(ValueError, 'changed while'):
                    hash_build_binary(path)

    def test_environment_rejects_identity_collision_unknown_fields_and_unpinned_image(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            (root / 'source/tests/integration').mkdir(parents=True)
            (root / 'source/tests/integration/test-connected-native-guest.py').touch()
            env = {'version': 1, 'disposable_host': True, 'source_root': str(root / 'source'),
                   'bin_dir': str(root / 'bin'), 'run_root': str(root / 'runs'),
                   'deployment_root': str(root / 'deployments'), 'ipc_root': str(root / 'ipc'),
                   'release_root': str(root / 'releases'), 'pg_bin': str(root / 'pg'),
                   'postgres_uid': 123, 'postgres_gid': 123, 'bridge_uid': 100101, 'guard_uid': 100102,
                   'docker_socket': str(root / 'docker.sock'), 'native_image': 'sha256:' + '1' * 64,
                   'codex_version': '0.153.4'}
            path = root / 'environment.json'
            path.write_text(json.dumps(env))
            self.assertEqual(load_environment(path)['postgres_uid'], 123)
            for change in ({'bridge_uid': 1}, {'bridge_uid': 123}, {'native_image': 'latest'}, {'extra': True}, {'disposable_host': False}):
                path.write_text(json.dumps({**env, **change}))
                with self.subTest(change=list(change)), self.assertRaises(ValueError):
                    load_environment(path)


class DemoCredentialFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        entry = Path(__file__).resolve().parents[1] / 'integration/demo-basic-flow.py'
        spec = importlib.util.spec_from_file_location('demo_credential_files', entry)
        cls.demo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.demo)

    def test_private_permissions_precede_content_even_with_permissive_umask(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'input'
            def before_write(fd, uid, gid):
                self.assertEqual(os.fstat(fd).st_mode & 0o777, 0o600)
                self.assertEqual(os.fstat(fd).st_size, 0)
                self.assertEqual((uid, gid), (70007, 70007))
            previous = os.umask(0)
            try:
                with patch.object(self.demo.os, 'fchown', side_effect=before_write) as owner:
                    self.demo.private(path, b'fixture input', 70007)
                owner.assert_called_once()
            finally:
                os.umask(previous)
            self.assertEqual(path.read_bytes(), b'fixture input')
            with self.assertRaises(FileExistsError):
                self.demo.private(path, b'replacement')
            alias = Path(temporary) / 'alias'
            alias.symlink_to(path)
            with self.assertRaises(FileExistsError):
                self.demo.private(alias, b'replacement')
            self.assertEqual(path.read_bytes(), b'fixture input')

    def test_cleanup_retires_only_owned_credentials_after_process_closure(self):
        from types import SimpleNamespace
        for closed in (True, False):
            with self.subTest(closed=closed), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                env = {'pg_bin': root, 'run_root': root, 'deployment_root': root, 'ipc_root': root}
                demo = self.demo.Demo(env, SimpleNamespace(run_name='fixture'))
                demo.root.mkdir()
                owned = demo.root / 'binding'
                retained = demo.root / 'evidence'
                retained.write_bytes(b'retained evidence')
                with patch.object(self.demo.os, 'fchown'):
                    demo.credential_file(owned, b'fixture input')
                    if closed:
                        demo.cleanup()
                    else:
                        demo.postgres = Mock()
                        demo.postgres.poll.return_value = None
                        demo.postgres.wait.side_effect = subprocess.TimeoutExpired('postgres', 30)
                        with self.assertRaisesRegex(RuntimeError, 'cleanup incomplete'):
                            demo.cleanup()
                self.assertEqual(owned.exists(), not closed)
                self.assertEqual(retained.read_bytes(), b'retained evidence')


class ResourceSmokeEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        entry = Path(__file__).resolve().parents[1] / 'integration/demo-basic-flow.py'
        spec = importlib.util.spec_from_file_location('resource_smoke_demo', entry)
        cls.demo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.demo)

    def evidence(self):
        expected = {'file_marker': 'from-file', 'db_marker': 'from-db', 'execution_id': 'execution'}
        reply = lambda body, receipt: {'status': 200, 'body': json.dumps(body), 'receipt': receipt}
        return {'expected': expected, 'instance_id': 'instance',
                'events': [{'method': 'item/completed', 'params': {'item': {
                    'type': 'mcpToolCall', 'server': 'managed', 'tool': 'execution_self',
                    'status': 'completed', 'error': None,
                    'result': {'isError': False, 'structuredContent': {'id': 'execution', 'instance_id': 'instance'}}}}}],
                'calls': [
                    {'operation': 'db.read', 'instance_id': 'instance', 'intent_id': 'read',
                     'reply': reply({'db_marker': 'from-db'}, {})},
                    {'operation': 'db.write', 'instance_id': 'instance', 'intent_id': 'write',
                     'reply': reply({}, {'result_id': 'result'})},
                    {'operation': 'file.publish', 'instance_id': 'instance', 'intent_id': 'publish',
                     'reply': reply({}, {})}],
                'rows': [{'id': 'result', 'content': dict(expected)}],
                'db_receipts': [{'intent_id': 'write', 'result_id': 'result', 'input': dict(expected)}],
                'revision': 2,
                'publications': [{'intent_id': 'publish', 'revision': 2, 'input': {'files': {'result.json': 'upload'}}}],
                'published': dict(expected)}

    def test_complete_bound_evidence_passes(self):
        checks = self.demo.verify_resource_smoke(self.evidence())
        self.assertEqual(set(checks), {'mcp', 'db.read', 'db.write', 'file.publish', 'file.readback'})
        self.assertEqual(set(checks.values()), {'PASS'})

    def test_missing_or_wrong_mcp_is_not_proved_by_other_successes(self):
        for kind in ('missing', 'wrong-instance', 'failed'):
            proof = self.evidence()
            if kind == 'missing':
                proof['events'] = []
            elif kind == 'wrong-instance':
                proof['events'][0]['params']['item']['result']['structuredContent']['instance_id'] = 'other'
            else:
                proof['events'][0]['params']['item']['result']['isError'] = True
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, 'mcp'):
                self.demo.verify_resource_smoke(proof)

    def test_database_needs_bound_read_matching_content_and_commit_receipt(self):
        for kind in ('wrong-read', 'wrong-row', 'missing-receipt', 'wrong-writer', 'duplicate-row'):
            proof = self.evidence()
            if kind == 'wrong-read':
                proof['calls'][0]['reply']['body'] = '{}'
            elif kind == 'wrong-row':
                proof['rows'][0]['content']['db_marker'] = 'invented'
            elif kind == 'missing-receipt':
                proof['db_receipts'] = []
            elif kind == 'wrong-writer':
                proof['calls'][1]['instance_id'] = 'other'
            else:
                proof['rows'].append(proof['rows'][0])
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, 'db\\.'):
                self.demo.verify_resource_smoke(proof)

    def test_upload_only_wrong_publisher_and_wrong_readback_fail(self):
        for kind in ('no-publication', 'old-revision', 'wrong-publisher', 'wrong-bytes'):
            proof = self.evidence()
            if kind == 'no-publication':
                proof['publications'] = []
            elif kind == 'old-revision':
                proof['revision'] = 1
            elif kind == 'wrong-publisher':
                proof['calls'][2]['intent_id'] = 'different'
            else:
                proof['published']['file_marker'] = 'invented'
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, 'file\\.'):
                self.demo.verify_resource_smoke(proof)

    def test_markers_are_fresh_and_basic_flow_defaults_remain(self):
        from types import SimpleNamespace
        env = {'pg_bin': Path('/pg'), 'run_root': Path('/run'), 'deployment_root': Path('/deployment'), 'ipc_root': Path('/ipc')}
        args = SimpleNamespace(run_name='unused')
        a, b = [self.demo.ResourceSmokeDemo(env, args) for _ in range(2)]
        self.assertNotEqual(a.file_marker, b.file_marker)
        self.assertNotEqual(a.db_marker, b.db_marker)
        self.assertNotIn(a.db_marker, a.sample)
        self.assertEqual(self.demo.Demo.sample, self.demo.SAMPLE)
        self.assertEqual(self.demo.Demo.extra_services, ())

    def test_resource_bounds_reject_an_expanded_allowance_before_environment_access(self):
        for bound in (['--max-calls', '31'], ['--max-seconds', '301']):
            argv = ['demo', '--environment', '/unused', '--run-name', 'unused',
                    '--model', 'gpt-5.6-sol', '--scenario', 'resource-smoke', *bound]
            with self.subTest(bound=bound), patch('sys.argv', argv), contextlib.redirect_stderr(io.StringIO()), \
                    patch.object(self.demo, 'load_environment', side_effect=AssertionError('must not inspect environment')):
                with self.assertRaises(SystemExit) as error:
                    self.demo.main()
                self.assertEqual(error.exception.code, 2)

    def test_live_clock_starts_after_preparation_without_replenishing_calls(self):
        from types import SimpleNamespace
        env = {'pg_bin': Path('/pg'), 'run_root': Path('/run'), 'deployment_root': Path('/deployment'), 'ipc_root': Path('/ipc')}
        for no_deadline in (False, True):
            demo = self.demo.ResourceSmokeDemo(env, SimpleNamespace(run_name='unused', max_seconds=300, no_deadline=no_deadline))
            demo.work, demo.workspace, demo.ids = 'work', 'workspace', {'child': 'child'}
            order = []
            with patch.object(demo, 'prepare_flow', side_effect=lambda: order.append('prepare')), \
                    patch.object(demo, 'message', side_effect=lambda *args: order.append('message')), \
                    patch.object(demo, 'sql', side_effect=lambda sql: order.append(sql)), \
                    patch.object(self.demo.signal, 'alarm', side_effect=lambda seconds: order.append(seconds)), \
                    patch.object(demo, 'turn', side_effect=RuntimeError('stop before execution')):
                with self.assertRaisesRegex(RuntimeError, 'stop before execution'):
                    demo.run_flow()
            self.assertEqual(order[:2], ['prepare', 'message'])
            self.assertIn('UPDATE credentials SET expires_at=', order[2])
            self.assertNotIn('limits', order[2])
            self.assertEqual(order[3:], [] if no_deadline else [300])

    def test_failed_turn_preserves_committed_evidence_and_does_not_start_again(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env = {'pg_bin': root, 'run_root': root, 'deployment_root': root, 'ipc_root': root}
            demo = self.demo.ResourceSmokeDemo(env, SimpleNamespace(run_name='unused', max_seconds=300))
            demo.root = demo.test = root
            demo.work, demo.workspace, demo.ids = 'work', 'workspace', {'child': 'child'}
            demo.executions = ['execution']
            proof = {'rows': [{'id': 'committed-result'}], 'publications': []}
            with patch.object(demo, 'prepare_flow'), patch.object(demo, 'message'), patch.object(demo, 'sql'), \
                    patch.object(self.demo.signal, 'alarm'), \
                    patch.object(demo, 'cli', return_value={'instance_id': 'instance'}), \
                    patch.object(demo, 'collect_evidence', return_value=proof), \
                    patch.object(self.demo.os, 'fchown'), \
                    patch.object(demo, 'turn', side_effect=RuntimeError('native failed')) as turn:
                with self.assertRaisesRegex(RuntimeError, 'native failed'):
                    demo.run_flow()
            turn.assert_called_once()
            self.assertEqual(json.loads((root / 'resource-evidence.json').read_text()), proof)
            self.assertFalse((root / 'resource-summary.json').exists())


class CompanyUiEvidence(ResourceSmokeEvidence):
    """The UI candidate cannot pass from an agent report or upload-only response."""
    def candidate(self):
        proof = self.evidence()
        proof.update({'company_id': 'firm', 'workspace_id': 'workspace', 'ui_uploads': []})
        composition = {
            'schemaVersion': 1, 'companyId': 'firm', 'revision': 1, 'author': 'execution',
            'pages': [{'id': 'pulse', 'title': 'Company pulse', 'module': 'agent-pulse',
                       'widgets': [{'id': 'pulse-proof', 'widget': 'agent-pulse.summary', 'size': 'medium'}]}],
            'publication': {'workspace': 'workspace', 'revision': 2, 'path': 'company-ui.json', 'executionId': 'execution'},
        }
        source = '''import { defineCompanyModule } from "@/contracts/company-sdk";
export default defineCompanyModule({id:"agent-pulse",name:"Company pulse",version:"1.0.0",
pages:[{id:"pulse",title:"Company pulse"}],widgets:[{id:"agent-pulse.summary",title:"Company pulse",
description:"Evidence",provider:"Company",sizes:["small","medium"],Component:function CompanyPulse(){
return <section><h3 className="type-section">Verification snapshot</h3><p className="type-data">execution</p>
<p className="type-data">from-file</p><p className="type-data">from-db</p></section>;}}]});'''
        files = {'CompanyPulse.tsx': source.encode(), 'company-ui.json': json.dumps(composition).encode()}
        self.bind_uploads(proof, files)
        return proof, files

    def bind_uploads(self, proof, files):
        proof['ui_uploads'] = []
        for index, (name, content) in enumerate(files.items()):
            intent = 'ui-upload-' + str(index)
            proof['publications'][0]['input']['files'][name] = intent
            digest = hashlib.sha256(content).hexdigest()
            proof['ui_uploads'].append({'intent_id': intent, 'instance_id': 'instance',
                'input': {'sha256': digest, 'size': len(content)},
                'reply': {'status': 200, 'receipt': {'source': 'catalog', 'upload_receipt': intent,
                                                    'sha256': digest, 'size': len(content)}}})

    def test_ui_requires_resource_proof_and_exact_published_bytes(self):
        proof, files = self.candidate()
        self.demo.verify_resource_smoke(proof)
        report = self.demo.verify_company_ui_artifacts(proof, files)
        self.assertEqual(set(report['checks'].values()), {'PASS'})
        self.assertEqual(report['compiled'], 'NOT RUN')
        self.assertEqual(report['displayed'], 'NOT RUN')
        self.assertEqual(report['files']['CompanyPulse.tsx']['sha256'], hashlib.sha256(files['CompanyPulse.tsx']).hexdigest())

    def test_ui_missing_publication_wrong_writer_changed_readback_fail(self):
        for kind in ('unpublished', 'writer', 'digest', 'receipt', 'empty', 'oversize'):
            proof, files = self.candidate()
            if kind == 'unpublished':
                del proof['publications'][0]['input']['files']['CompanyPulse.tsx']
            elif kind == 'writer':
                proof['ui_uploads'][0]['instance_id'] = 'someone-else'
            elif kind == 'digest':
                files['CompanyPulse.tsx'] += b' changed'
            elif kind == 'receipt':
                proof['ui_uploads'][0]['reply']['receipt'] = {}
            elif kind == 'empty':
                files['CompanyPulse.tsx'] = b''
            else:
                files['CompanyPulse.tsx'] = b'x' * 65537
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, 'company-ui evidence failed'):
                self.demo.verify_company_ui_artifacts(proof, files)

    def test_ui_rejects_wrong_company_execution_widget_and_revision(self):
        for kind in ('company', 'author', 'widget', 'revision', 'extra-page'):
            proof, files = self.candidate()
            composition = json.loads(files['company-ui.json'])
            if kind == 'company':
                composition['companyId'] = 'other'
            elif kind == 'author':
                composition['author'] = 'other'
            elif kind == 'widget':
                composition['pages'][0]['widgets'][0]['widget'] = 'system.stop'
            elif kind == 'revision':
                composition['publication']['revision'] = 3
            else:
                composition['pages'].append(dict(composition['pages'][0]))
            files['company-ui.json'] = json.dumps(composition).encode()
            self.bind_uploads(proof, files)
            with self.subTest(kind=kind), self.assertRaisesRegex(RuntimeError, 'composition'):
                self.demo.verify_company_ui_artifacts(proof, files)

    def test_ui_source_must_use_sdk_observed_values_and_snapshot_label(self):
        for original, replacement in ((b'@/contracts/company-sdk', b'@/app/internal'),
                                      (b'from-db', b'invented'),
                                      (b'Verification snapshot', b'Live health')):
            proof, files = self.candidate()
            files['CompanyPulse.tsx'] = files['CompanyPulse.tsx'].replace(original, replacement)
            self.bind_uploads(proof, files)
            with self.subTest(original=original), self.assertRaisesRegex(RuntimeError, 'company-ui evidence failed'):
                self.demo.verify_company_ui_artifacts(proof, files)

    def test_ui_scenario_prompt_does_not_leak_fresh_markers(self):
        from types import SimpleNamespace
        env = {'pg_bin': Path('/pg'), 'run_root': Path('/run'), 'deployment_root': Path('/deployment'), 'ipc_root': Path('/ipc')}
        demo = self.demo.CompanyUiDemo(env, SimpleNamespace(run_name='unused'))
        demo.workspace, demo.ids = 'workspace', {'firm': 'firm'}
        prompt = demo.additional_task()
        self.assertNotIn(demo.file_marker, prompt)
        self.assertNotIn(demo.db_marker, prompt)
        self.assertIn('ONE POST /publications', prompt)
        self.assertEqual(demo.additional_outputs, ('CompanyPulse.tsx', 'company-ui.json'))
        self.assertEqual(self.demo.ResourceSmokeDemo.additional_outputs, ())


if __name__ == '__main__':
    unittest.main()
