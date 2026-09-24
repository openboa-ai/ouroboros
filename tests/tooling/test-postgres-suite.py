#!/usr/bin/env python3
"""Deterministic contract checks for the disposable database test driver itself."""

# Allow direct fixture execution without ambient PYTHONPATH or installation.
if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import json
import importlib.util
import errno
import os
from pathlib import Path
import subprocess
import signal
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from tests.support.postgres_suite_support import (Commands, SuiteFailure, cargo_result, free_ports,
                                    private_write, redact, safe_environment, PostgreSQL)


class DatabaseDriverContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="pg-driver-contract-")
        self.root = Path(self.temporary.name).resolve()
        self.root.chmod(0o700)
        self.secret = "synthetic-password-not-an-account"
        self.commands = Commands(self.root, safe_environment(Path(sys.executable).parent), [self.secret])

    def tearDown(self):
        self.temporary.cleanup()

    def test_bootstrap_password_uses_transient_input_without_creating_a_file(self):
        class StopAfterBootstrap(Exception):
            pass
        calls = []
        def run(label, argv, **options):
            calls.append((label, argv, options))
            if label == 'postgres-version':
                return b'postgres (PostgreSQL) 18.6\n'
            if label == 'initdb':
                self.assertEqual(options['input_text'], self.secret + '\n')
                self.assertIn('--pwfile=/dev/stdin', argv)
                self.assertEqual(list(self.root.iterdir()), [])
                raise StopAfterBootstrap()
            raise AssertionError('unexpected subprocess')
        pg = PostgreSQL(self.root, Path('/synthetic/pg'), self.commands, 'fixture', self.secret)
        with patch.object(self.commands, 'run', side_effect=run), self.assertRaises(StopAfterBootstrap):
            pg.start()
        self.assertEqual([item[0] for item in calls], ['postgres-version', 'initdb'])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_mutation_driver_preserves_cargo_proxy_dispatch_name(self):
        spec = importlib.util.spec_from_file_location("control_mutations", Path(__file__).resolve().parents[2] / "tests/contracts/test-control-mutations.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        source = Path(__file__).resolve().parents[2]
        target = self.root / "target"
        scratch = self.root / "scratch"
        target.mkdir(mode=0o700)
        scratch.mkdir(mode=0o700)
        url = self.root / "database.url"
        private_write(url, "postgresql://fixture@127.0.0.1:5432/fixture")
        proxy = self.root / "rustup"
        proxy.write_text('#!/bin/sh\n[ "${0##*/}" = cargo ]\n')
        proxy.chmod(0o700)
        cargo = self.root / "cargo"
        cargo.symlink_to(proxy)
        argv = ["mutation", "--source-root", str(source), "--target-dir", str(target),
                "--scratch-root", str(scratch), "--database-url-file", str(url), "--cargo", str(cargo)]
        with patch.object(sys, "argv", argv):
            args = module.arguments()
        self.assertEqual(subprocess.run([args.cargo], check=False).returncode, 0)

    def test_success_requires_executed_unfiltered_database_tests(self):
        valid = b"test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out\n"
        self.assertEqual(cargo_result(valid)["tests_passed"], 7)
        for invalid in (b"", valid.replace(b"7 passed", b"0 passed"),
                        valid.replace(b"0 ignored", b"1 ignored"),
                        valid.replace(b"0 filtered out", b"3 filtered out")):
            with self.subTest(output=invalid), self.assertRaises(SuiteFailure):
                cargo_result(invalid)

    def test_completed_child_returns_evidence_without_credentials_in_log(self):
        text = "postgresql://another:unregistered-secret@127.0.0.1:49999/postgres " + self.secret
        result = self.commands.run("credential-output", [sys.executable, "-c", "import sys; print(sys.stdin.read())"], input_text=text)
        self.assertIn(self.secret.encode(), result)  # Raw output is transient only.
        log = self.root / "credential-output.log"
        self.assertEqual(log.stat().st_mode & 0o777, 0o600)
        self.assertNotIn(self.secret, log.read_text())
        self.assertNotIn("unregistered-secret", log.read_text())
        self.assertTrue(self.commands.cleanup_ok)

    def test_failed_child_does_not_report_success_or_leak_its_diagnostic(self):
        with self.assertRaisesRegex(SuiteFailure, r"deliberate-failure failed \(exit 3\)"):
            self.commands.run("deliberate-failure", [sys.executable, "-c", "import sys; print(sys.stdin.read()); sys.exit(3)"], input_text=self.secret)
        self.assertNotIn(self.secret, (self.root / "deliberate-failure.log").read_text())

    def test_deadline_terminates_only_owned_group(self):
        unrelated = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"], start_new_session=True)
        try:
            with self.assertRaisesRegex(SuiteFailure, "exceeded its deadline"):
                self.commands.run("deadline", [sys.executable, "-c", "import time; time.sleep(60)"], timeout=1)
            self.assertIsNone(unrelated.poll())
            self.assertTrue(self.commands.cleanup_ok)
        finally:
            unrelated.terminate()
            unrelated.wait(timeout=5)

    def test_descendant_that_retains_output_cannot_escape_suite_deadline(self):
        code = "import subprocess,sys; subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); sys.exit(0)"
        with self.assertRaisesRegex(SuiteFailure, "exceeded its deadline"):
            self.commands.run("descendant-deadline", [sys.executable, "-c", code], timeout=1)

    def test_missing_executable_fails_instead_of_skipping(self):
        with self.assertRaises(FileNotFoundError):
            self.commands.run("missing-tool", [str(self.root / "does-not-exist")])

    def test_external_repeated_cancellation_reports_failure_and_cleans_child(self):
        script = '''
import json,sys,time
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from tests.support.postgres_suite_support import Cancellation,Commands,private_write,safe_environment
root=Path(sys.argv[2]); cancellation=Cancellation(); cancellation.install()
commands=Commands(root,safe_environment(Path(sys.executable).parent),[])
child_code="import os,time; from pathlib import Path; Path("+repr(str(root/'ready'))+").write_text(str(os.getpid())); time.sleep(60)"
try:
    commands.run('cancel-child',[sys.executable,'-c',child_code],timeout=30)
except BaseException:
    cancellation.begin_cleanup()
    private_write(root/'cancel-result.json',json.dumps({'status':'FAIL','cancelled':cancellation.interrupted,'cleanup':commands.cleanup_ok}))
finally:
    cancellation.restore()
'''
        actor = subprocess.Popen([sys.executable, "-c", script, str(Path(__file__).resolve().parents[2]), str(self.root)],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, start_new_session=True)
        try:
            deadline = time.monotonic() + 5
            while not (self.root / "ready").exists():
                self.assertIsNone(actor.poll(), "cancellation fixture exited before readiness")
                self.assertLess(time.monotonic(), deadline, "cancellation fixture readiness deadline")
                time.sleep(0.01)
            os.kill(actor.pid, signal.SIGTERM)
            os.kill(actor.pid, signal.SIGTERM)
            actor.communicate(timeout=20)
            self.assertEqual(actor.returncode, 0)
            report = json.loads((self.root / "cancel-result.json").read_text())
            self.assertEqual(report, {"status": "FAIL", "cancelled": True, "cleanup": True})
            child = int((self.root / "ready").read_text())
            with self.assertRaises(ProcessLookupError):
                os.kill(child, 0)
        finally:
            if actor.poll() is None:
                actor.terminate()
                actor.wait(timeout=20)
            actor.stderr.close()

    def test_ignored_termination_forces_failure_even_after_child_is_killed(self):
        code = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
        with self.assertRaisesRegex(SuiteFailure, "exceeded its deadline"):
            self.commands.run("ignored-termination", [sys.executable, "-c", code], timeout=2)
        self.assertFalse(self.commands.cleanup_ok, "forced termination cannot masquerade as clean teardown")

    def test_output_flood_is_bounded_and_fails_the_command(self):
        with self.assertRaisesRegex(SuiteFailure, "exceeded its output bound"):
            self.commands.run("output-bound", [sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'x' * (17 * 1024 * 1024))"])
        self.assertLessEqual((self.root / "output-bound.log").stat().st_size, 16 * 1024 * 1024)

    def test_protected_credential_creation_never_overwrites_existing_file(self):
        selected = self.root / "credential.url"
        private_write(selected, "old")
        with self.assertRaises(FileExistsError):
            private_write(selected, "new")
        self.assertEqual(selected.read_text(), "old")
        self.assertEqual(selected.stat().st_mode & 0o777, 0o600)

    def test_ports_are_distinct_and_unprivileged(self):
        ports = free_ports(4)
        self.assertEqual(len(set(ports)), 4)
        self.assertTrue(all(port >= 1024 for port in ports))

    def test_unknown_fixture_passwords_are_also_redacted(self):
        raw = b"postgresql://u:p@localhost:59999/db PASSWORD 'notlisted'; password=abc"
        result = redact(raw, [])
        self.assertNotIn(b"notlisted", result)
        self.assertNotIn(b"abc", result)
        self.assertNotIn(b"u:p", result)

    def test_interpreter_and_test_overrides_cannot_disable_child_assertions(self):
        hostile = {"PYTHONOPTIMIZE": "2", "PYTHONPATH": str(self.root), "PYTHONHOME": str(self.root),
                   "RUSTFLAGS": "--cfg skip_contracts", "RUST_TEST_THREADS": "0",
                   "RUST_TEST_NOCAPTURE": "1", "PGHOST": "unrelated", "DATABASE_URL": "unrelated",
                   "HTTPS_PROXY": "http://unrelated", "CARGO_PROFILE_TEST_DEBUG": "0"}
        with patch.dict(os.environ, hostile):
            selected = safe_environment(Path(sys.executable).parent)
        for key in hostile.keys() - {"CARGO_PROFILE_TEST_DEBUG"}:
            self.assertNotIn(key, selected)
        self.assertEqual(selected["CARGO_PROFILE_TEST_DEBUG"], "0")
        child = subprocess.run([sys.executable, "-c", "import json; print(json.dumps({'assertions':__debug__})); assert False"],
                               env=selected, capture_output=True, text=True, timeout=5)
        self.assertNotEqual(child.returncode, 0)
        self.assertEqual(json.loads(child.stdout), {"assertions": True})

    def test_direct_optimized_runner_is_rejected_before_fixture_preparation(self):
        child = subprocess.run([sys.executable, "-O", str(Path(__file__).resolve().parents[2] / "tests/support/run-postgres-suite.py"), "--help"],
                               env=self.commands.env, capture_output=True, text=True, timeout=5)
        self.assertEqual(child.returncode, 2)
        self.assertIn("optimized Python cannot execute assertion-based validation", child.stderr)

    def test_transient_group_permission_requires_actual_disappearance(self):
        real_killpg = os.killpg
        observed = {"terminated": False, "injected": 0, "absence": False}

        def transient(group, selected_signal):
            if selected_signal == signal.SIGTERM:
                result = real_killpg(group, selected_signal)
                observed["terminated"] = True
                return result
            if selected_signal == 0 and observed["terminated"] and observed["injected"] < 2:
                observed["injected"] += 1
                raise PermissionError(errno.EPERM, "injected exit-race observation")
            try:
                return real_killpg(group, selected_signal)
            except ProcessLookupError:
                if selected_signal == 0:
                    observed["absence"] = True
                raise

        with patch("tests.support.postgres_suite_support.os.killpg", side_effect=transient):
            with self.assertRaisesRegex(SuiteFailure, "exceeded its deadline"):
                self.commands.run("transient-observation", [sys.executable, "-c", "import time; time.sleep(30)"], timeout=1)
        self.assertEqual(observed, {"terminated": True, "injected": 2, "absence": True})
        self.assertTrue(self.commands.cleanup_ok)

    def test_persistent_group_permission_cannot_certify_cleanup(self):
        real_killpg = os.killpg
        observed = {"terminated": False}

        def unavailable(group, selected_signal):
            if selected_signal == signal.SIGTERM:
                result = real_killpg(group, selected_signal)
                observed["terminated"] = True
                return result
            if selected_signal == 0 and observed["terminated"]:
                raise PermissionError(errno.EPERM, "injected persistent observation denial")
            return real_killpg(group, selected_signal)

        with patch("tests.support.postgres_suite_support.os.killpg", side_effect=unavailable):
            with self.assertRaisesRegex(SuiteFailure, "exceeded its deadline"):
                self.commands.run("unavailable-observation", [sys.executable, "-c", "import time; time.sleep(30)"], timeout=1)
        self.assertTrue(observed["terminated"])
        self.assertFalse(self.commands.cleanup_ok)


if __name__ == "__main__":
    unittest.main()
