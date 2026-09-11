#!/usr/bin/env python3
"""Deterministic contracts for the native shutdown fixture's process barrier."""
import sys
from contextlib import ExitStack
from pathlib import Path
import signal
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.support.fixture_runtime_unit_loss import frozen_process


class BarrierTests(unittest.TestCase):
    def fixture(self, stack, states=('State:\tT (stopped)\n',), times=(0, 0)):
        actions = []
        stack.enter_context(patch('os.pidfd_open', side_effect=lambda pid: actions.append(('open', pid)) or 17, create=True))
        stack.enter_context(patch('signal.pidfd_send_signal', side_effect=lambda fd, sig: actions.append(('signal', fd, sig)), create=True))
        stack.enter_context(patch('os.close', side_effect=lambda fd: actions.append(('close', fd))))
        stack.enter_context(patch.object(Path, 'read_text', side_effect=states))
        stack.enter_context(patch('time.monotonic', side_effect=times))
        stack.enter_context(patch('time.sleep'))
        return actions

    def test_body_runs_only_after_stop_and_resumes_same_handle(self):
        with ExitStack() as stack:
            actions = self.fixture(stack, states=['State:\tR (running)\n', 'State:\tT (stopped)\n'], times=[0, 0, 1])
            with frozen_process(42):
                actions.append(('body',))
            self.assertEqual(actions, [('open', 42), ('signal', 17, signal.SIGSTOP), ('body',),
                                       ('signal', 17, signal.SIGCONT), ('close', 17)])

    def test_failed_assertion_still_resumes(self):
        with ExitStack() as stack:
            actions = self.fixture(stack)
            with self.assertRaisesRegex(AssertionError, 'negative check failed'):
                with frozen_process(42):
                    raise AssertionError('negative check failed')
            self.assertEqual(actions[-2:], [('signal', 17, signal.SIGCONT), ('close', 17)])

    def test_unobserved_stop_cannot_run_body(self):
        with ExitStack() as stack:
            actions = self.fixture(stack, times=[0, 4])
            with self.assertRaisesRegex(AssertionError, 'stopped-process barrier'):
                with frozen_process(42):
                    self.fail('body ran without observing stop')
            self.assertEqual(actions[-2:], [('signal', 17, signal.SIGCONT), ('close', 17)])

    def test_missing_process_closes_handle_without_running_body(self):
        with ExitStack() as stack:
            actions = self.fixture(stack, states=FileNotFoundError())
            with self.assertRaises(FileNotFoundError):
                with frozen_process(42):
                    self.fail('body ran after process disappeared')
            self.assertEqual(actions[-1], ('close', 17))

    def test_signal_failure_never_runs_body_and_closes_handle(self):
        with ExitStack() as stack:
            actions = self.fixture(stack)
            stack.enter_context(patch('signal.pidfd_send_signal', side_effect=ProcessLookupError(), create=True))
            with self.assertRaises(ProcessLookupError):
                with frozen_process(42):
                    self.fail('body ran without a signaled process')
            self.assertEqual(actions, [('open', 42), ('close', 17)])


if __name__ == '__main__':
    unittest.main()
