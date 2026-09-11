#!/usr/bin/env python3
"""Deterministic check-runner orchestration, source binding and owned-child cleanup.

External product commands are substituted at the execution seam. The sole real
process test starts disposable Python children, never a database, VM or model.
"""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

import check as runner
from check_catalog import build_plan
from native_scenarios import SCENARIOS


SOURCE = "a" * 64
CHANGED = "b" * 64


def load_native_driver():
    path = Path(__file__).resolve().parent / 'run-native-suite.py'
    spec = importlib.util.spec_from_file_location('native_check_runner_contract', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CheckRunnerContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='check-runner-contract-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        self.output = self.root / 'result.json'

    def plan(self, paths=('README.md',)):
        return build_plan(paths, base='1' * 40, head='2' * 40, source_digest=SOURCE)

    def run_lane(self, plan, lane, config=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return runner.run(plan, lane, config or {}, self.output)

    def test_current_source_is_required_before_any_execution_or_output(self):
        with patch.object(runner, 'source_digest', return_value=CHANGED), \
             patch.object(runner, 'execute') as execute, \
             patch.object(runner, 'integrity') as integrity:
            with self.assertRaises(ValueError):
                self.run_lane(self.plan(), 'integrity')
        execute.assert_not_called()
        integrity.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_narrowed_plan_is_rejected_before_effects(self):
        plan = copy.deepcopy(self.plan(('crates/core/src/lib.rs',)))
        plan['selected'] = ['repository.integrity']
        with patch.object(runner, 'source_digest', return_value=SOURCE), \
             patch.object(runner, 'integrity') as integrity:
            with self.assertRaises(ValueError):
                self.run_lane(plan, 'integrity')
        integrity.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_missing_environment_is_failed_evidence_not_successful_skip(self):
        plan = self.plan(('crates/core/src/lib.rs',))
        with patch.object(runner, 'source_digest', return_value=SOURCE), \
             patch.object(runner, 'execute') as execute:
            self.assertFalse(self.run_lane(plan, 'postgres'))
        execute.assert_not_called()
        results = json.loads(self.output.read_text())
        expected = next(entry['scenarios'] for entry in plan['matrix']['include'] if entry['lane'] == 'postgres')
        self.assertEqual({item['id'] for item in results}, set(expected))
        self.assertTrue(all(item['status'] != 'PASS' for item in results))
        self.assertTrue(all(item['source_digest'] == SOURCE and item['plan_digest'] == plan['plan_digest']
                            for item in results))
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o600)

    def test_failed_command_stops_its_scenario_and_retains_current_identity(self):
        plan = self.plan(('scripts/test-config-startup.py',))
        commands = lambda name, config: [(['synthetic', name, 'first'], 1),
                                         (['synthetic', name, 'second'], 1)]
        executed = []
        def fail(command, timeout, log):
            executed.append(command)
            return 9
        with patch.object(runner, 'source_digest', return_value=SOURCE), \
             patch.object(runner, 'commands', side_effect=commands), \
             patch.object(runner, 'execute', side_effect=fail):
            self.assertFalse(self.run_lane(plan, 'fast'))
        self.assertTrue(executed)
        self.assertTrue(all(command[-1] == 'first' for command in executed))
        results = json.loads(self.output.read_text())
        self.assertTrue(all(item['status'] == 'FAIL' and item['exit_code'] == 9 for item in results))
        self.assertTrue(all(item['plan_digest'] == plan['plan_digest'] for item in results))

    def test_source_change_stops_further_selected_commands(self):
        plan = self.plan(('scripts/test-config-startup.py',))
        changed = False
        executed = []
        def digest():
            return CHANGED if changed else SOURCE
        def mutate(command, timeout, log):
            nonlocal changed
            executed.append(command)
            changed = True
            return 0
        with patch.object(runner, 'source_digest', side_effect=digest), \
             patch.object(runner, 'commands', return_value=[(['synthetic-first'], 1), (['synthetic-second'], 1)]), \
             patch.object(runner, 'execute', side_effect=mutate):
            self.assertFalse(self.run_lane(plan, 'fast'))
        self.assertEqual(len(executed), 1, 'a stale plan must not continue launching work')
        results = json.loads(self.output.read_text())
        self.assertTrue(all(item['status'] != 'PASS' for item in results))
        selected = next(entry['scenarios'] for entry in plan['matrix']['include'] if entry['lane'] == 'fast')
        self.assertEqual({item['id'] for item in results}, set(selected))

    def test_existing_result_is_preserved_and_empty_lane_is_rejected(self):
        self.output.write_text('preserve existing evidence')
        with patch.object(runner, 'source_digest', return_value=SOURCE), \
             patch.object(runner, 'integrity', return_value={'status': 'PASS'}) as integrity:
            with self.assertRaises(FileExistsError):
                self.run_lane(self.plan(), 'integrity')
        integrity.assert_not_called()
        self.assertEqual(self.output.read_text(), 'preserve existing evidence')
        with patch.object(runner, 'source_digest', return_value=SOURCE):
            with self.assertRaises(ValueError):
                self.run_lane(self.plan(), 'native')

    def test_local_and_full_plan_have_explicit_base_identity(self):
        for full in (False, True):
            with self.subTest(full=full):
                output = self.root / ('full.json' if full else 'local.json')
                arguments = ['check.py', 'plan', '--output', str(output)] + (['--full'] if full else [])
                def git(*args):
                    if args[0] == 'rev-parse':
                        return '2' * 40 + '\n'
                    if args[0] == 'diff':
                        return 'README.md\0'
                    if args[0] == 'ls-files':
                        return ''
                    raise AssertionError('unexpected git query')
                with patch.object(sys, 'argv', arguments), patch.object(runner, 'git', side_effect=git), \
                     patch.object(runner, 'source_digest', return_value=SOURCE), \
                     contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(runner.main(), 0)
                self.assertTrue(json.loads(output.read_text())['base'])

    def test_explicit_base_head_still_includes_dirty_and_untracked_source(self):
        arguments = ['check.py', 'plan', '--base', 'HEAD', '--output', str(self.output)]
        def git(*args):
            if args[0] == 'rev-parse':
                return '2' * 40 + '\n'
            if args[0] == 'diff':
                # The committed comparison is empty, but the source being tested is dirty.
                return 'crates/runtime/src/guard_process.rs\0' if args[1] == 'HEAD' else ''
            if args[0] == 'ls-files':
                return 'docs/untracked-note.md\0'
            raise AssertionError('unexpected git query')
        with patch.object(sys, 'argv', arguments), patch.object(runner, 'git', side_effect=git), \
             patch.object(runner, 'source_digest', return_value=SOURCE), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(runner.main(), 0)
        plan = json.loads(self.output.read_text())
        self.assertEqual(plan['base'], plan['head'])
        self.assertEqual(plan['changed_paths'], ['crates/runtime/src/guard_process.rs', 'docs/untracked-note.md'])
        self.assertIn('native.runtime-loss', plan['selected'])

    def test_noncurrent_head_is_rejected_before_source_attestation(self):
        arguments = ['check.py', 'plan', '--head', 'previous', '--output', str(self.output)]
        def git(*args):
            if args[0] == 'rev-parse':
                return ('1' if args[-1] == 'previous^{commit}' else '2') * 40 + '\n'
            raise AssertionError('no changed-source query is justified for another head')
        with patch.object(sys, 'argv', arguments), patch.object(runner, 'git', side_effect=git), \
             patch.object(runner, 'source_digest') as digest:
            with self.assertRaises(ValueError):
                runner.main()
        digest.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_child_cannot_inherit_assertion_disabling_or_account_environment(self):
        keys = ['PYTHONOPTIMIZE', 'PYTHONPATH', 'OPENAI_API_KEY', 'PGHOST', 'DOCKER_HOST', 'HTTPS_PROXY']
        child = "import json,os; print(json.dumps({'debug':__debug__,'unexpected':[k for k in " + repr(keys) + " if k in os.environ]}))"
        log_path = self.root / 'environment.log'
        with patch.dict(os.environ, {key: ('2' if key == 'PYTHONOPTIMIZE' else 'synthetic-canary') for key in keys}), \
             log_path.open('wb') as log:
            self.assertEqual(runner.execute([sys.executable, '-c', child], 5, log), 0)
        observed = json.loads(log_path.read_text())
        self.assertTrue(observed['debug'], 'Python assertion oracles must remain active')
        self.assertEqual(observed['unexpected'], [])

    def test_native_names_are_bounded_and_new_for_retained_attempts(self):
        env = self.root / 'native.json'
        env.write_text(json.dumps({'source_root': str(runner.ROOT)}))
        config = {'native_environment': str(env)}
        names = []
        for scenario in SCENARIOS:
            command, _ = runner.commands(scenario, config)[0]
            self.assertEqual(command[command.index('--scenario') + 1], scenario)
            name = command[command.index('--run-name') + 1]
            self.assertRegex(name, r'^[a-z][a-z0-9-]{0,31}$')
            names.append(name)
        first = runner.commands('native.workflow', config)[0][0]
        second = runner.commands('native.workflow', config)[0][0]
        self.assertNotEqual(first[first.index('--run-name') + 1], second[second.index('--run-name') + 1])
        self.assertEqual(len(names), len(set(names)))

    def test_native_environment_cannot_attest_another_checkout(self):
        other = self.root / 'different-source'
        other.mkdir()
        env = self.root / 'native.json'
        env.write_text(json.dumps({'source_root': str(other)}))
        with self.assertRaises(ValueError):
            runner.commands('native.workflow', {'native_environment': str(env)})

    def test_native_failure_blocks_following_host_fixtures(self):
        binary = self.root / 'bin'
        binary.mkdir()
        native = self.root / 'native.json'
        native.write_text(json.dumps({'bin_dir': str(binary), 'source_root': str(runner.ROOT)}))
        config = {'bin_dir': str(binary), 'native_environment': str(native)}
        with patch.object(runner, 'source_digest', return_value=SOURCE), \
             patch.object(runner, 'require_build'), \
             patch.object(runner, 'commands', return_value=[(['synthetic-native'], 1)]), \
             patch.object(runner, 'execute', return_value=9) as execute:
            self.assertFalse(self.run_lane(self.plan(('crates/runtime/src/lib.rs',)), 'native', config))
        self.assertEqual(execute.call_count, 1)
        results = json.loads(self.output.read_text())
        self.assertEqual(results[0]['status'], 'FAIL')
        self.assertGreater(len(results), 1)
        self.assertTrue(all(item['status'] == 'NOT RUN' for item in results[1:]))

    @unittest.skipUnless(os.name == 'posix', 'file mode and link identity require POSIX')
    def test_source_identity_includes_bytes_names_executable_mode_and_link_text(self):
        source = self.root / 'source'
        source.mkdir()
        script = source / 'tool.py'
        script.write_text('first')
        script.chmod(0o600)
        link = source / 'alias'
        link.symlink_to('tool.py')
        with patch.object(runner, 'ROOT', source), \
             patch.object(runner, 'git', return_value='tool.py\0alias\0'):
            first = runner.source_digest()
            script.write_text('second')
            second = runner.source_digest()
            self.assertNotEqual(first, second)
            script.chmod(0o700)
            executable = runner.source_digest()
            self.assertNotEqual(second, executable)
            link.unlink()
            link.symlink_to('missing-but-tracked-target')
            self.assertNotEqual(executable, runner.source_digest())

    def test_native_zero_exit_requires_matching_underlying_result(self):
        native = load_native_driver()
        job = native.NativeRun.__new__(native.NativeRun)
        job.scenario_id = 'native.workflow'
        job.scenario = SCENARIOS[job.scenario_id]
        job.environment = {'source_root': self.root}
        job.config_file = self.root / 'fixture.json'
        job.deployment = self.root / 'deployment'
        evidence = job.deployment / 'test'
        evidence.mkdir(parents=True)
        job.command = Mock(return_value=None)  # Process returned success; independently inspect its evidence.
        for result in [None, {'result': 'FAIL', 'scenario_id': job.scenario_id},
                       {'result': 'PASS', 'scenario_id': 'native.controls'}]:
            target = evidence / 'result.json'
            if target.exists():
                target.unlink()
            if result is not None:
                target.write_text(json.dumps(result))
            with self.subTest(result=result), self.assertRaises((RuntimeError, FileNotFoundError)):
                job.execute()
        (evidence / 'result.json').write_text(json.dumps({'result': 'PASS', 'scenario_id': job.scenario_id}))
        job.execute()
        self.assertEqual(job.command.call_count, 4)

    @unittest.skipUnless(os.name == 'posix' and hasattr(os, 'killpg'), 'owned process groups require POSIX')
    def test_timeout_stops_descendant_even_when_group_leader_exits_first(self):
        identity = self.root / 'descendant.json'
        heartbeat = self.root / 'descendant.fifo'
        os.mkfifo(heartbeat, mode=0o600)
        reader = os.open(heartbeat, os.O_RDONLY | os.O_NONBLOCK)
        descendant = ("import json,os,signal,sys,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                      "held=os.open(sys.argv[2],os.O_WRONLY); "
                      "open(sys.argv[1],'w').write(json.dumps({'pid':os.getpid(),'group':os.getpgrp()})); time.sleep(60)")
        leader = ("import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',sys.argv[1],sys.argv[2],sys.argv[3]]); time.sleep(60)")
        unrelated = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'], start_new_session=True)
        observed = None
        try:
            with (self.root / 'timeout.log').open('wb') as log, self.assertRaises(subprocess.TimeoutExpired):
                runner.execute([sys.executable, '-c', leader, descendant, str(identity), str(heartbeat)], 1, log)
            self.assertTrue(identity.exists(), 'the child must have started before testing its deadline')
            observed = json.loads(identity.read_text())
            def running():
                # This exact child opens its FIFO before publishing readiness and holds it
                # throughout sleep; EOF observes descriptor closure without host process scans.
                try:
                    return os.read(reader, 1) != b''
                except BlockingIOError:
                    return True
            deadline = time.monotonic() + 3
            while running() and time.monotonic() < deadline:
                time.sleep(.02)
            self.assertFalse(running(), 'a TERM-ignoring descendant outlived the selected command deadline')
            self.assertIsNone(unrelated.poll(), 'only the owned command group may be terminated')
        finally:
            if observed is None and identity.exists():
                observed = json.loads(identity.read_text())
            if observed is not None:
                try:
                    if os.getpgid(observed['pid']) == observed['group']:
                        os.killpg(observed['group'], signal.SIGKILL)
                except ProcessLookupError:
                    pass
            os.close(reader)
            unrelated.terminate()
            unrelated.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
