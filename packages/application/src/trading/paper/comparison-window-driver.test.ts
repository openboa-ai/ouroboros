import { describe, expect, it, vi } from "vitest";
import {
  PaperTradingComparisonWindowDriver,
  type PaperTradingComparisonWindowDriverOptions
} from "./comparison-window-driver";
import type {
  PaperTradingComparisonWindowSnapshot,
  PaperTradingComparisonWindowStateReader
} from "./comparison-window-reader";
import type { PaperTradingComparisonWindowFacts } from "./comparison-window-state";

describe("PaperTradingComparisonWindowDriver", () => {
  it.each([
    [
      "first checkpoint",
      snapshot(facts({ now: "2026-07-11T00:01:00.000Z" })),
      snapshot(facts({
        now: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired"
      }), "tick-1", "checkpoint-1"),
      "captureFirst",
      "capture_first_checkpoint",
      { phase: "waiting_tick_acknowledgements", checkpoint_sequence: 1 }
    ],
    [
      "next tick",
      snapshot(facts({
        now: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired",
        latest_tick_acknowledged_roles: ["champion", "challenger"]
      }), "tick-1", "checkpoint-1"),
      snapshot(facts({
        now: "2026-07-11T00:01:00.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired"
      }), "tick-2", "checkpoint-1"),
      "captureNextTick",
      "capture_next_tick",
      { phase: "next_tick_captured", checkpoint_sequence: 2 }
    ],
    [
      "next checkpoint begin",
      snapshot(facts({
        now: "2026-07-11T00:01:01.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired"
      }), "tick-2", "checkpoint-1"),
      snapshot(facts({
        now: "2026-07-11T00:01:01.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "open",
        latest_checkpoint_deadline_at: "2026-07-11T00:02:01.000Z"
      }), "tick-2", "checkpoint-2"),
      "beginNext",
      "begin_next_checkpoint",
      { phase: "views_advanced", checkpoint_sequence: 2 }
    ],
    [
      "next checkpoint completion",
      snapshot(facts({
        now: "2026-07-11T00:01:02.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "open",
        latest_checkpoint_deadline_at: "2026-07-11T00:02:01.000Z",
        latest_tick_acknowledged_roles: ["champion", "challenger"]
      }), "tick-2", "checkpoint-2"),
      snapshot(facts({
        now: "2026-07-11T00:01:02.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 2,
        latest_checkpoint_status: "paired"
      }), "tick-2", "checkpoint-2"),
      "completeNext",
      "complete_next_checkpoint",
      { phase: "waiting_tick_acknowledgements", checkpoint_sequence: 2 }
    ],
    [
      "window stop",
      snapshot(facts({
        now: "2026-07-11T00:02:00.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 2,
        latest_checkpoint_status: "paired",
        maximum_observation_count: 2
      }), "tick-2", "checkpoint-2"),
      snapshot(facts({
        owned: false,
        now: "2026-07-11T00:02:00.000Z",
        tick_count: 2,
        latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 2,
        latest_checkpoint_status: "paired",
        maximum_observation_count: 2,
        activation_status: "stopped_cleanly"
      }), "tick-2", "checkpoint-2"),
      "stopOwnedAttempt",
      "stop_window",
      { phase: "window_stopped", checkpoint_sequence: 2, terminal: true }
    ]
  ] as const)("executes one %s transition", async (
    _label,
    before,
    after,
    expectedMethod,
    transition,
    expected
  ) => {
    const fixture = driverFixture([before, after]);

    await expect(fixture.driver.advance(input())).resolves.toMatchObject({
      activation_id: "activation-1",
      activation_attempt_id: "attempt-1",
      transition,
      terminal: false,
      authority_status: "not_live",
      ...expected
    });
    expect(fixture.calls()).toEqual([expectedMethod]);
    expect(fixture.reader.load).toHaveBeenCalledTimes(2);

    if (expectedMethod === "captureFirst") {
      expect(fixture.checkpoints.captureFirst).toHaveBeenCalledWith({
        activationId: "activation-1",
        activationAttemptId: "attempt-1",
        idempotencyKey: "window:attempt-1:checkpoint:1"
      });
    } else if (expectedMethod === "captureNextTick") {
      expect(fixture.ticks.captureNextTick).toHaveBeenCalledWith({
        activationId: "activation-1",
        activationAttemptId: "attempt-1",
        idempotencyKey: "window:attempt-1:tick:2"
      });
    } else if (expectedMethod === "beginNext") {
      expect(fixture.checkpoints.beginNext).toHaveBeenCalledWith({
        activationId: "activation-1",
        activationAttemptId: "attempt-1",
        tickId: "tick-2",
        idempotencyKey: "window:attempt-1:checkpoint:2"
      });
    } else if (expectedMethod === "completeNext") {
      expect(fixture.checkpoints.completeNext).toHaveBeenCalledWith({
        checkpointAttemptId: "checkpoint-2"
      });
    } else {
      expect(fixture.activations.stopOwnedAttempt).toHaveBeenCalledWith({
        attemptId: "attempt-1",
        reason: "handoff_cleanup"
      });
    }
  });

  it.each([
    [
      "acknowledgement wait",
      snapshot(facts({
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired"
      }), "tick-1", "checkpoint-1"),
      "waiting_tick_acknowledgements",
      false
    ],
    [
      "lost ownership",
      snapshot(facts({ owned: false })),
      "recovery_required",
      true
    ]
  ] as const)("returns %s without an effect", async (_label, current, phase, terminal) => {
    const fixture = driverFixture([current]);

    await expect(fixture.driver.advance(input())).resolves.toMatchObject({
      phase,
      transition: "none",
      terminal
    });
    expect(fixture.calls()).toEqual([]);
    expect(fixture.reader.load).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent calls so the second reads the first transition", async () => {
    const before = snapshot(facts({ now: "2026-07-11T00:01:00.000Z" }));
    const after = snapshot(facts({
      now: "2026-07-11T00:01:00.000Z",
      checkpoint_attempt_count: 1,
      paired_checkpoint_count: 1,
      latest_checkpoint_status: "paired"
    }), "tick-1", "checkpoint-1");
    const fixture = driverFixture([before, after, after]);

    const [first, second] = await Promise.all([
      fixture.driver.advance(input()),
      fixture.driver.advance(input())
    ]);

    expect(first.transition).toBe("capture_first_checkpoint");
    expect(second.transition).toBe("none");
    expect(fixture.calls()).toEqual(["captureFirst"]);
  });

  it("stops after a child error and preserves its stable code", async () => {
    const fixture = driverFixture([
      snapshot(facts({ now: "2026-07-11T00:01:00.000Z" }))
    ]);
    fixture.checkpoints.captureFirst.mockRejectedValueOnce(Object.assign(
      new Error("checkpoint failed"),
      { code: "paper_trading_comparison_checkpoint_persistence_failed" }
    ));

    await expect(fixture.driver.advance(input())).rejects.toMatchObject({
      code: "paper_trading_comparison_window_transition_failed",
      details: {
        transition: "capture_first_checkpoint",
        cause_code: "paper_trading_comparison_checkpoint_persistence_failed"
      }
    });
    expect(fixture.reader.load).toHaveBeenCalledTimes(1);
  });
});

function driverFixture(snapshots: PaperTradingComparisonWindowSnapshot[]) {
  const calls: string[] = [];
  const reader: PaperTradingComparisonWindowStateReader = {
    load: vi.fn(async () => {
      const next = snapshots.shift();
      if (!next) throw new Error("missing scripted snapshot");
      return structuredClone(next);
    })
  };
  const ticks = {
    captureNextTick: vi.fn(async () => {
      calls.push("captureNextTick");
      return {} as never;
    })
  };
  const checkpoints = {
    captureFirst: vi.fn(async () => {
      calls.push("captureFirst");
      return {} as never;
    }),
    beginNext: vi.fn(async () => {
      calls.push("beginNext");
      return {} as never;
    }),
    completeNext: vi.fn(async () => {
      calls.push("completeNext");
      return {} as never;
    })
  };
  const activations = {
    stopOwnedAttempt: vi.fn(async () => {
      calls.push("stopOwnedAttempt");
      return { status: "stopped_cleanly" } as never;
    })
  };
  const options: PaperTradingComparisonWindowDriverOptions = {
    reader,
    ticks,
    checkpoints,
    activations
  };
  return {
    driver: new PaperTradingComparisonWindowDriver(options),
    reader: reader as { load: ReturnType<typeof vi.fn> },
    ticks,
    checkpoints,
    activations,
    calls: () => [...calls]
  };
}

function input() {
  return { activationId: "activation-1", activationAttemptId: "attempt-1" };
}

function snapshot(
  currentFacts: PaperTradingComparisonWindowFacts,
  latestTickId = "tick-1",
  latestCheckpointAttemptId?: string
): PaperTradingComparisonWindowSnapshot {
  return {
    facts: currentFacts,
    latest_tick_id: latestTickId,
    ...(latestCheckpointAttemptId
      ? { latest_checkpoint_attempt_id: latestCheckpointAttemptId }
      : {})
  };
}

function facts(
  changes: Partial<PaperTradingComparisonWindowFacts> = {}
): PaperTradingComparisonWindowFacts {
  return {
    owned: true,
    now: "2026-07-11T00:00:00.000Z",
    activation_attempted_at: "2026-07-11T00:00:00.000Z",
    interval_ms: 60_000,
    maximum_observation_count: 10,
    maximum_elapsed_ms: 600_000,
    tick_count: 1,
    latest_tick_observed_at: "2026-07-11T00:00:00.000Z",
    checkpoint_attempt_count: 0,
    paired_checkpoint_count: 0,
    latest_checkpoint_has_failed_side: false,
    latest_tick_acknowledged_roles: [],
    activation_status: "both_running",
    ...changes
  };
}
