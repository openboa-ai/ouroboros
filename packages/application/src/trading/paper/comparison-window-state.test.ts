import { describe, expect, it } from "vitest";
import {
  classifyPaperTradingComparisonWindow,
  type PaperTradingComparisonWindowFacts
} from "./comparison-window-state";

describe("classifyPaperTradingComparisonWindow", () => {
  it("waits for the first frozen cadence and then admits exactly the first checkpoint", () => {
    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:00:59.999Z"
    }))).toEqual({
      phase: "waiting_first_checkpoint_due",
      transition: "none",
      checkpoint_sequence: 1,
      terminal: false,
      next_wake_at: "2026-07-11T00:01:00.000Z"
    });
    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:01:00.000Z"
    }))).toEqual({
      phase: "waiting_first_checkpoint_due",
      transition: "capture_first_checkpoint",
      checkpoint_sequence: 1,
      terminal: false
    });
  });

  it("waits for both current tick acknowledgements before the next capture", () => {
    const current = facts({
      now: "2026-07-11T00:02:00.000Z",
      tick_count: 1,
      checkpoint_attempt_count: 1,
      paired_checkpoint_count: 1,
      latest_checkpoint_status: "paired",
      latest_tick_acknowledged_roles: ["champion"]
    });

    expect(classifyPaperTradingComparisonWindow(current)).toEqual({
      phase: "waiting_tick_acknowledgements",
      transition: "none",
      checkpoint_sequence: 1,
      terminal: false
    });
    expect(classifyPaperTradingComparisonWindow({
      ...current,
      latest_tick_acknowledged_roles: ["champion", "challenger"]
    })).toEqual({
      phase: "checkpoint_committed",
      transition: "capture_next_tick",
      checkpoint_sequence: 1,
      terminal: false
    });
  });

  it("separates a captured tick, open view, and acknowledgement-ready completion", () => {
    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:02:00.000Z",
      tick_count: 2,
      latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
      checkpoint_attempt_count: 1,
      paired_checkpoint_count: 1,
      latest_checkpoint_status: "paired"
    }))).toEqual({
      phase: "next_tick_captured",
      transition: "begin_next_checkpoint",
      checkpoint_sequence: 2,
      terminal: false
    });

    const open = facts({
      now: "2026-07-11T00:01:30.000Z",
      tick_count: 2,
      latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
      checkpoint_attempt_count: 2,
      paired_checkpoint_count: 1,
      latest_checkpoint_status: "open",
      latest_checkpoint_deadline_at: "2026-07-11T00:02:00.000Z"
    });
    expect(classifyPaperTradingComparisonWindow(open)).toEqual({
      phase: "views_advanced",
      transition: "none",
      checkpoint_sequence: 2,
      terminal: false
    });
    expect(classifyPaperTradingComparisonWindow({
      ...open,
      latest_tick_acknowledged_roles: ["challenger", "champion"]
    })).toEqual({
      phase: "views_advanced",
      transition: "complete_next_checkpoint",
      checkpoint_sequence: 2,
      terminal: false
    });
    expect(classifyPaperTradingComparisonWindow({
      ...open,
      now: "2026-07-11T00:02:00.001Z"
    })).toMatchObject({
      phase: "views_advanced",
      transition: "complete_next_checkpoint",
      checkpoint_sequence: 2,
      terminal: false,
      stable_error_code: "paper_trading_comparison_checkpoint_deadline_exceeded"
    });
  });

  it("stops only at frozen maximum boundaries rather than minimum evidence", () => {
    const paired = facts({
      now: "2026-07-11T00:02:00.000Z",
      tick_count: 3,
      latest_tick_observed_at: "2026-07-11T00:02:00.000Z",
      checkpoint_attempt_count: 3,
      paired_checkpoint_count: 3,
      latest_checkpoint_status: "paired",
      maximum_observation_count: 3,
      latest_tick_acknowledged_roles: ["champion", "challenger"]
    });
    expect(classifyPaperTradingComparisonWindow(paired)).toEqual({
      phase: "checkpoint_committed",
      transition: "stop_window",
      checkpoint_sequence: 3,
      terminal: false
    });

    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:04:30.000Z",
      tick_count: 2,
      latest_tick_observed_at: "2026-07-11T00:04:30.000Z",
      checkpoint_attempt_count: 2,
      paired_checkpoint_count: 2,
      latest_checkpoint_status: "paired",
      latest_tick_acknowledged_roles: ["champion", "challenger"],
      maximum_elapsed_ms: 300_000
    }))).toMatchObject({
      transition: "stop_window",
      checkpoint_sequence: 2
    });

    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:10:00.001Z",
      tick_count: 1,
      latest_tick_observed_at: "2026-07-11T00:01:00.000Z",
      checkpoint_attempt_count: 1,
      paired_checkpoint_count: 1,
      latest_checkpoint_status: "paired",
      latest_tick_acknowledged_roles: ["champion", "challenger"]
    }))).toMatchObject({
      transition: "stop_window",
      checkpoint_sequence: 1
    });

    expect(classifyPaperTradingComparisonWindow(facts({
      now: "2026-07-11T00:10:00.001Z"
    }))).toMatchObject({
      transition: "stop_window",
      checkpoint_sequence: 1
    });
  });

  it.each([
    ["lost ownership", facts({ owned: false }), "recovery_required", true],
    [
      "clean stop",
      facts({ owned: false, activation_status: "stopped_cleanly" }),
      "window_stopped",
      true
    ],
    [
      "cleanup required",
      facts({ owned: false, activation_status: "cleanup_required" }),
      "comparison_failed",
      true
    ],
    [
      "incomplete checkpoint",
      facts({
        tick_count: 2,
        checkpoint_attempt_count: 2,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "incomplete"
      }),
      "comparison_failed",
      true
    ],
    [
      "failed paired side",
      facts({
        checkpoint_attempt_count: 1,
        paired_checkpoint_count: 1,
        latest_checkpoint_status: "paired",
        latest_checkpoint_has_failed_side: true
      }),
      "comparison_failed",
      true
    ]
  ] as const)("classifies %s without another effect", (_label, input, phase, terminal) => {
    expect(classifyPaperTradingComparisonWindow(input)).toMatchObject({
      phase,
      transition: "none",
      terminal
    });
  });

  it.each([
    ["tick gap", { tick_count: 3, checkpoint_attempt_count: 1 }],
    [
      "attempt gap",
      { tick_count: 2, checkpoint_attempt_count: 0, paired_checkpoint_count: 0 }
    ],
    [
      "paired overflow",
      { checkpoint_attempt_count: 1, paired_checkpoint_count: 2 }
    ],
    [
      "duplicate acknowledgement",
      { latest_tick_acknowledged_roles: ["champion", "champion"] }
    ],
    [
      "acknowledgement before first checkpoint",
      { latest_tick_acknowledged_roles: ["champion"] }
    ],
    [
      "failed side without paired checkpoint",
      { latest_checkpoint_has_failed_side: true }
    ],
    ["invalid clock", { now: "not-a-clock" }],
    [
      "clock before activation",
      {
        now: "2026-07-10T23:59:59.999Z",
        activation_attempted_at: "2026-07-11T00:00:00.000Z"
      }
    ],
    [
      "future tick",
      {
        now: "2026-07-11T00:00:00.000Z",
        latest_tick_observed_at: "2026-07-11T00:00:00.001Z"
      }
    ]
  ])("rejects impossible %s facts", (_label, changes) => {
    expect(() => classifyPaperTradingComparisonWindow(facts(changes as never)))
      .toThrowError(expect.objectContaining({
        code: "paper_trading_comparison_window_graph_invalid"
      }));
  });
});

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
