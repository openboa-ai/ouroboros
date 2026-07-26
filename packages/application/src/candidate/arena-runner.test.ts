import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../ports/store";
import {
  CandidateArenaRunner,
  CandidateArenaResearchWorkRegistry,
  candidateArenaRunnerNextTickCount,
  candidateArenaRunnerTickCountFromTicks
} from "./arena";

describe("CandidateArenaRunner health", () => {
  it("resets a stopped runner to the persisted maximum sequence", () => {
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
    runner.restoreTickCount(2, ["tick-1"]);

    runner.restoreTickCount(3, ["tick-1", "tick-3"]);

    expect(runner.ticks()).toBe(3);
  });

  it("advances past allocations orphaned before tick closure", () => {
    expect(candidateArenaRunnerTickCountFromTicks(
      [{ tick_id: "tick-1" }],
      [{ tick_id: "tick-2" }]
    )).toBe(2);
  });

  it("restores sequence past allocations with terminal ticks", () => {
    expect(candidateArenaRunnerTickCountFromTicks(
      [{ tick_id: "tick-1" }, { tick_id: "tick-2" }],
      [{ tick_id: "tick-2" }]
    )).toBe(2);
  });

  it("uses a new sequence after mixed completed and orphaned allocations", () => {
    const completedTickIds = new Set(["tick-1", "tick-3"]);
    const restoredTickCount = candidateArenaRunnerTickCountFromTicks(
      [{ tick_id: "tick-1" }, { tick_id: "tick-3" }],
      [{ tick_id: "tick-2" }, { tick_id: "tick-3" }]
    );

    expect(restoredTickCount).toBe(3);
    expect(candidateArenaRunnerNextTickCount(
      restoredTickCount,
      completedTickIds
    )).toBe(4);
    expect(candidateArenaRunnerNextTickCount(2, completedTickIds)).toBe(4);
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
      active_tick_id: undefined,
      active_research_work_items: [],
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

  it("reports the exact active tick id without changing restored counts", async () => {
    let releaseRecovery!: (checkpoints: never[]) => void;
    const recovery = new Promise<never[]>((resolve) => {
      releaseRecovery = resolve;
    });
    const runner = new CandidateArenaRunner({
      store: {
        listResearchWorkerCheckpoints: () => recovery
      } as unknown as OuroborosStorePort,
      researchAgent: "fixture",
      agentFactory: () => ({}) as never
    });
    runner.restoreTickCount(7, ["tick-1"]);

    const tick = runner.tick();

    expect(runner.health()).toMatchObject({
      tick_count: 8,
      active_tick: true,
      active_tick_id: "tick-8",
      active_research_work_items: []
    });
    runner.restoreTickCount(2, ["tick-1"]);
    expect(runner.ticks()).toBe(8);

    releaseRecovery([]);
    await expect(tick).rejects.toBeInstanceOf(Error);
    expect(runner.health()).toMatchObject({
      tick_count: 8,
      active_tick: false,
      active_tick_id: undefined,
      active_research_work_items: []
    });
  });

  it("tracks only started directions and preserves pre-commit failure until tick persistence", () => {
    const registry = new CandidateArenaResearchWorkRegistry();
    registry.beginTick("tick-9");
    const observer = registry.observerForTick("tick-9");

    observer.directionStarted({
      research_allocation_id: "allocation-9",
      direction_kind: "trend_following"
    });
    observer.directionStarted({
      research_allocation_id: "allocation-9",
      direction_kind: "mean_reversion"
    });

    expect(registry.snapshot().active_research_work_items).toHaveLength(2);
    expect(registry.snapshot().active_research_work_items.map((item) =>
      item.direction_kind
    )).not.toContain("execution_cost_robustness");

    observer.commitmentPersisted({
      research_allocation_id: "allocation-9",
      direction_kind: "trend_following",
      commitment_id: "commitment-9-trend"
    });
    observer.directionFailed({
      research_allocation_id: "allocation-9",
      direction_kind: "mean_reversion"
    });

    expect(registry.snapshot().active_research_work_items).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        phase: "running",
        commitment_id: "commitment-9-trend"
      }),
      expect.objectContaining({
        direction_kind: "mean_reversion",
        phase: "failed_closed_pending_tick",
        failure_code: "candidate_arena_research_precommit_failed"
      })
    ]);

    observer.terminalEvidencePersisted({
      research_allocation_id: "allocation-9",
      direction_kind: "trend_following"
    });
    expect(registry.snapshot().active_research_work_items).toHaveLength(1);

    observer.tickPersisted();
    expect(registry.snapshot().active_research_work_items).toEqual([]);
  });

  it("clears only matching tick state and isolates an older observer", () => {
    const registry = new CandidateArenaResearchWorkRegistry();
    registry.beginTick("tick-new");
    const current = registry.observerForTick("tick-new");
    const older = registry.observerForTick("tick-old");
    current.directionStarted({
      research_allocation_id: "allocation-new",
      direction_kind: "trend_following"
    });

    older.clearMatchingTick();
    expect(registry.snapshot()).toMatchObject({
      active_tick_id: "tick-new",
      active_research_work_items: [expect.objectContaining({
        research_allocation_id: "allocation-new"
      })]
    });

    current.clearMatchingTick();
    expect(registry.snapshot()).toEqual({
      active_tick_id: undefined,
      active_research_work_items: []
    });
  });
});
