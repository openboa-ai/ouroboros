"""Deterministic completion/exit ordering checks for the native test observer."""

if __package__ in (None, ""):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import unittest
from unittest.mock import patch

from tests.support.native_adapter_fixture import wait_worker_execution


class CompletionSchedule:
    """A worker finishes between a caller's snapshot and process observation."""

    def __init__(self, final_record, exit_code=0):
        self.record = {'terminated': False, 'compute_return': None}
        self.final_record = final_record
        self.exit_code = exit_code

    def read_execution(self):
        return dict(self.record)

    def poll(self):
        self.record = dict(self.final_record)
        return self.exit_code


class WorkerObservationContract(unittest.TestCase):
    def test_successful_exit_after_old_snapshot_observes_committed_completion(self):
        terminal = {'terminated': True, 'compute_return': {'units': 20}}
        schedule = CompletionSchedule(terminal)
        self.assertEqual(wait_worker_execution(schedule, schedule.read_execution), terminal)

    def test_zero_returned_compute_is_a_completed_record(self):
        terminal = {'terminated': True, 'compute_return': {'units': 0}}
        schedule = CompletionSchedule(terminal)
        self.assertEqual(wait_worker_execution(schedule, schedule.read_execution), terminal)

    def test_existing_terminal_snapshot_can_be_observed_before_process_exit(self):
        terminal = {'terminated': True, 'compute_return': {'units': 20}}
        schedule = CompletionSchedule(terminal, exit_code=None)
        schedule.record = terminal
        self.assertEqual(wait_worker_execution(schedule, schedule.read_execution), terminal)

    def test_exit_without_both_terminal_fields_cannot_be_success(self):
        for record in ({'terminated': False, 'compute_return': None},
                       {'terminated': True, 'compute_return': None},
                       {'terminated': False, 'compute_return': {'units': 20}}):
            with self.subTest(record=record):
                schedule = CompletionSchedule(record)
                with self.assertRaises(AssertionError):
                    wait_worker_execution(schedule, schedule.read_execution)

    def test_failed_worker_cannot_be_accepted_on_a_later_terminal_record(self):
        for exit_code in (1, -9):
            with self.subTest(exit_code=exit_code):
                schedule = CompletionSchedule({'terminated': True, 'compute_return': {'units': 20}}, exit_code)
                with self.assertRaises(AssertionError):
                    wait_worker_execution(schedule, schedule.read_execution)

    def test_live_worker_without_completion_is_bounded_by_deadline(self):
        schedule = CompletionSchedule({'terminated': False, 'compute_return': None}, exit_code=None)
        with patch('tests.support.native_adapter_fixture.time.monotonic', side_effect=[0, 0, 26]), \
                patch('tests.support.native_adapter_fixture.time.sleep'):
            with self.assertRaisesRegex(AssertionError, 'did not finish'):
                wait_worker_execution(schedule, schedule.read_execution)


if __name__ == '__main__':
    unittest.main()
