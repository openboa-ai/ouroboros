import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../ports/store";
import {
  CandidateArenaRunner,
  candidateArenaRunnerTickCountFromTicks
} from "./arena";

describe("CandidateArenaRunner health", () => {
  it("restores sequence to retry allocations orphaned before tick closure", () => {
    expect(candidateArenaRunnerTickCountFromTicks(
      [{ tick_id: "tick-1" }],
      [{ tick_id: "tick-2" }]
    )).toBe(1);
  });

  it("restores sequence past allocations with terminal ticks", () => {
    expect(candidateArenaRunnerTickCountFromTicks(
      [{ tick_id: "tick-1" }, { tick_id: "tick-2" }],
      [{ tick_id: "tick-2" }]
    )).toBe(2);
  });

  it("reports consecutive tick failure without converting it into trading authority", async () => {
    const runner = new CandidateArenaRunner({
      store: {} as OuroborosStorePort,
      researchAgent: "fixture",
      agentFactory: () => ({
        agent: {
          provider: "fixture",
          model: "fixture",
          permission_mode: "fixture"
        }
      }) as never
    });

    await expect(runner.tick()).rejects.toBeInstanceOf(Error);

    expect(runner.health()).toEqual({
      status: "stopped",
      tick_count: 1,
      completed_tick_count: 0,
      active_tick: false,
      consecutive_failure_count: 1,
      last_error_code: "candidate_arena_tick_failed",
      runtime_coordination_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    });
  });
});
