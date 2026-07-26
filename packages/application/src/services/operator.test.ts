import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CandidateArenaReadModel,
  CandidateArenaTickRecord,
  OuroborosCommandKind
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import type {
  CandidateArenaRunner,
  CandidateArenaTickContinuation,
  CandidateArenaTickOutcome
} from "../candidate/arena";
import { OperatorReadError, OperatorService } from "./operator";

describe("OperatorService autonomous Arena control", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-operator-service-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("does not resume from stale persisted start intent after an in-flight stop", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    let running = true;
    const runner = {
      status: () => running ? "running" as const : "stopped" as const,
      ticks: () => 0,
      researchAgent: () => "fixture" as const,
      setTickContinuation: () => undefined,
      restoreTickCount: () => undefined,
      start: () => {
        running = true;
        return "started" as const;
      },
      stop: () => {
        running = false;
        return "stopped" as const;
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: {
        run: async () => {
          throw new Error("paper_evidence_not_expected");
        }
      }
    });
    await service.recordCommand({
      commandKind: "arena.start",
      status: "succeeded",
      requestedAt: "2026-07-22T10:00:00.000Z"
    });

    await service.executeCommand("arena.stop", undefined);
    expect(running).toBe(false);

    await expect(service.resumeAutonomousArenaLoop()).resolves.toBe(
      "not_requested"
    );
    expect(running).toBe(false);
  });

  it("always exposes authoritative Research operations and exact detail reads", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const runner = {
      status: () => "stopped" as const,
      ticks: () => 0,
      health: () => ({
        status: "stopped" as const,
        tick_count: 0,
        completed_tick_count: 0,
        active_tick: false,
        active_research_work_items: [],
        consecutive_failure_count: 0,
        runtime_coordination_authority: true as const,
        evaluation_authority: false as const,
        promotion_authority: false as const,
        order_submission_authority: false as const,
        live_exchange_authority: false as const,
        authority_status: "runtime_coordination_only" as const
      }),
      researchAgent: () => "fixture" as const,
      setTickContinuation: () => undefined,
      restoreTickCount: () => undefined,
      start: () => "started" as const,
      stop: () => "stopped" as const
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: {
        run: async () => {
          throw new Error("paper_evidence_not_expected");
        }
      }
    });

    const operator = await service.readOperator();

    expect(operator.research_operations).toEqual({
      projection_kind: "research_operations",
      availability: "available",
      loop_status: "stopped",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 0,
        queued_session_count: 0
      },
      sessions: [],
      recorded_session_count: 0,
      projected_session_count: 0,
      omitted_session_count: 0,
      sessions_truncated: false,
      authority_status: "research_only"
    });
    await expect(service.readResearchSessionDetail("research-session-v1-missing"))
      .resolves.toBeUndefined();
  });

  it("classifies exact Research detail projection failures without exposing their cause", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const privateOwner = "service-detail-private-owner";
    const urlPassword = "service-detail-url-password";
    const tokenValue = "service-detail-token";
    const rawFailure = [
      `projection failed at /Users/${privateOwner}/research/session.json`,
      `https://operator:${urlPassword}@example.test/private`,
      `access_token=${tokenValue}`
    ].join(" ");
    vi.spyOn(store, "listCandidateArenaResearchAllocations")
      .mockRejectedValue(new Error(rawFailure));
    const service = new OperatorService({
      store,
      candidateArenaRunner: stoppedArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter()
    });

    const failure = await service
      .readResearchSessionDetail("research-session-v1-private")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OperatorReadError);
    expect(failure).toMatchObject({
      statusCode: 503,
      error: "research_operations_unavailable",
      details: {
        availability: "unavailable"
      }
    });
    const serialized = `${String(failure)} ${JSON.stringify(failure)}`;
    for (const privateValue of [privateOwner, urlPassword, tokenValue, rawFailure]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("marks only the Research projection unavailable when its store read fails", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const privateFailure = "operator-private-research-read-failure";
    vi.spyOn(store, "listResearchWorkers")
      .mockRejectedValue(new Error(privateFailure));
    const service = new OperatorService({
      store,
      candidateArenaRunner: stoppedArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter()
    });

    const operator = await service.readOperator();

    expect(operator.research_operations).toMatchObject({
      projection_kind: "research_operations",
      availability: "unavailable",
      loop_status: "degraded",
      sessions: []
    });
    expect(operator.candidate_arena.authority_status).toBe("not_live");
    expect(operator.paper_trading_board.authority_status).toBe("not_live");
    expect(JSON.stringify(operator)).not.toContain(privateFailure);
  });

  it("projects a legacy Arena runner without requiring a health method", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const runner = {
      status: () => "stopped" as const,
      ticks: () => 0,
      researchAgent: () => "fixture" as const,
      setTickContinuation: () => undefined,
      restoreTickCount: () => undefined,
      start: () => "started" as const,
      stop: () => "stopped" as const
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter()
    });

    await expect(service.readOperator()).resolves.toMatchObject({
      candidate_arena: {
        runner_status: "stopped",
        tick_count: 0
      },
      research_operations: {
        availability: "available",
        loop_status: "stopped",
        sessions: [],
        authority_status: "research_only"
      }
    });
  });

  it("re-sanitizes and bounds historical Arena failures in the application read model", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const privateOwner = "application-private-owner-sentinel";
    const urlPassword = "application-url-password-sentinel";
    const tokenValue = "application-token-value-sentinel";
    const rawFailure = [
      `provider failed at /Users/${privateOwner}/research/session.json`,
      `https://operator:${urlPassword}@example.test/private`,
      `access_token=${tokenValue}`,
      "x".repeat(2_000)
    ].join(" ");
    await store.recordCandidateArenaTick({
      ...candidateArenaTick("tick-private", rawFailure),
      paper_trading_continuation: {
        status: "failed",
        command_kind: "trading_run.start",
        selected_candidate_id: FIXTURE_CANDIDATE_ID,
        error: rawFailure,
        authority_status: "not_live"
      }
    });
    const service = new OperatorService({
      store,
      candidateArenaRunner: stoppedArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter()
    });

    const operator = await service.readOperator();
    const failure = operator.candidate_arena.latest_ticks[0]
      ?.direction_results[0]?.error;
    const continuationFailure = operator.candidate_arena.latest_ticks[0]
      ?.paper_trading_continuation?.error;
    const serialized = JSON.stringify(operator);
    for (const summary of [failure, continuationFailure]) {
      expect(summary).toContain("[private-path]");
      expect(summary).toContain("[external-url]");
      expect(summary).toContain("[redacted]");
      expect(summary?.length).toBeLessThanOrEqual(256);
    }
    for (const sentinel of [privateOwner, urlPassword, tokenValue]) {
      expect(serialized).not.toContain(sentinel);
    }
    const stored = (await store.listCandidateArenaTicks())[0];
    expect(stored?.direction_results[0]?.error).toBe(rawFailure);
    expect(stored?.paper_trading_continuation?.error).toBe(rawFailure);
  });

  it.each(["arena.tick", "arena.cycle"] satisfies OuroborosCommandKind[])(
    "restores persisted sequence before one-shot %s",
    async (commandKind) => {
      const store = new LocalStore(root);
      await store.initialize();
      await store.recordCandidateArenaTick(candidateArenaTick(
        "tick-1",
        "historical_failure"
      ));
      let sequence = 0;
      const restoreCalls: Array<{
        tickCount: number;
        completedTickIds: string[];
      }> = [];
      const runner = {
        ...stoppedArenaRunner(),
        ticks: () => sequence,
        restoreTickCount: (
          tickCount: number,
          completedTickIds: Iterable<string>
        ) => {
          sequence = tickCount;
          restoreCalls.push({
            tickCount,
            completedTickIds: [...completedTickIds]
          });
        },
        tick: async () => {
          sequence += 1;
          if (sequence === 1) {
            throw new Error(
              "candidate_arena_research_allocation_already_effected"
            );
          }
          return {
            status: "completed" as const,
            tick_id: `tick-${sequence}`,
            created_candidate_count: 1,
            created_candidate_ids: [FIXTURE_CANDIDATE_ID],
            arena: { leaderboard: [] } as unknown as CandidateArenaReadModel
          };
        }
      } as unknown as CandidateArenaRunner;
      const service = new OperatorService({
        store,
        candidateArenaRunner: runner,
        paperEvidenceAdapter: unexpectedPaperEvidenceAdapter(),
        mutationPort: {
          run: async () => ({
            statusCode: 200,
            body: { status: "running" }
          })
        }
      });

      const execution = await service.executeCommand(commandKind, undefined);
      const result = execution.result as {
        tick_id?: string;
        arena_tick?: { tick_id: string };
      };
      expect(result.arena_tick?.tick_id ?? result.tick_id).toBe("tick-2");
      expect(restoreCalls).toEqual([{
        tickCount: 1,
        completedTickIds: ["tick-1"]
      }]);
    }
  );

  it("coalesces concurrent one-shot restore and tick work", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    await store.recordCandidateArenaTick(candidateArenaTick(
      "tick-1",
      "historical_failure"
    ));
    let sequence = 0;
    let restoreCount = 0;
    let tickCount = 0;
    const runner = {
      ...stoppedArenaRunner(),
      ticks: () => sequence,
      restoreTickCount: (tickSequence: number) => {
        restoreCount += 1;
        sequence = tickSequence;
      },
      tick: async () => {
        tickCount += 1;
        sequence += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          status: "completed" as const,
          tick_id: `tick-${sequence}`,
          created_candidate_count: 0,
          created_candidate_ids: [],
          arena: { leaderboard: [] } as unknown as CandidateArenaReadModel
        };
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter()
    });

    const [first, second] = await Promise.all([
      service.executeCommand("arena.tick", undefined),
      service.executeCommand("arena.tick", undefined)
    ]);

    expect(first.result).toMatchObject({ tick_id: "tick-2" });
    expect(second.result).toMatchObject({ tick_id: "tick-2" });
    expect(restoreCount).toBe(1);
    expect(tickCount).toBe(1);
  });

  it("sanitizes and bounds a newly recorded autonomous continuation failure", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const privateOwner = "new-continuation-private-owner";
    const urlPassword = "new-continuation-url-password";
    const tokenValue = "new-continuation-token";
    const rawFailure = [
      `paper start failed at /Users/${privateOwner}/paper/session.json`,
      `https://operator:${urlPassword}@example.test/private`,
      `access_token=${tokenValue}`,
      "x".repeat(2_000)
    ].join(" ");
    const outcome = candidateArenaOutcome("tick-new-continuation");
    await store.recordCandidateArenaTick(successfulCandidateArenaTick(
      outcome.tick_id
    ));
    let continuation: CandidateArenaTickContinuation | undefined;
    const runner = {
      ...stoppedArenaRunner(),
      setTickContinuation: (value: CandidateArenaTickContinuation | undefined) => {
        continuation = value;
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter(),
      mutationPort: {
        run: async () => ({
          statusCode: 422,
          body: { reason: rawFailure }
        })
      }
    });

    await service.executeCommand("arena.start", undefined);
    const returned = await continuation?.(outcome);
    await waitForPersistedContinuation(store, outcome.tick_id);

    const stored = (await store.listCandidateArenaTicks())
      .find((tick) => tick.tick_id === outcome.tick_id);
    const storedFailure = stored?.paper_trading_continuation?.error;
    const returnedFailure = returned?.error;
    for (const summary of [storedFailure, returnedFailure]) {
      expect(summary).toContain("[private-path]");
      expect(summary).toContain("[external-url]");
      expect(summary).toContain("[redacted]");
      expect(summary?.length).toBeLessThanOrEqual(256);
    }
    for (const sentinel of [privateOwner, urlPassword, tokenValue]) {
      expect(JSON.stringify({ stored, returned })).not.toContain(sentinel);
    }
  });

  it("starts paper once for concurrent cycle callers sharing one tick", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const outcome = candidateArenaOutcome("tick-1");
    let tickCount = 0;
    let paperStartCount = 0;
    const runner = {
      ...stoppedArenaRunner(),
      tick: async () => {
        tickCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return outcome;
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter(),
      mutationPort: {
        run: async () => {
          paperStartCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            statusCode: 200,
            body: {
              status: "running",
              paper_start_id: `paper-start-${paperStartCount}`
            }
          };
        }
      }
    });

    const [first, second] = await Promise.all([
      service.executeCommand("arena.cycle", undefined),
      service.executeCommand("arena.cycle", undefined)
    ]);

    expect(tickCount).toBe(1);
    expect(paperStartCount).toBe(1);
    expect(first.result).toMatchObject({
      arena_tick: { tick_id: "tick-1" },
      paper_trading: { paper_start_id: "paper-start-1" }
    });
    expect(second.result).toEqual(first.result);
  });

  it("reuses the autonomous continuation paper start for an overlapping cycle", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    const outcome = candidateArenaOutcome("tick-autonomous-overlap");
    let running = false;
    let continuation: CandidateArenaTickContinuation | undefined;
    let paperStartCount = 0;
    const runner = {
      ...stoppedArenaRunner(),
      status: () => running ? "running" as const : "stopped" as const,
      setTickContinuation: (value: CandidateArenaTickContinuation | undefined) => {
        continuation = value;
      },
      start: () => {
        running = true;
        return "started" as const;
      },
      tick: async () => {
        await continuation?.(outcome);
        return outcome;
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: unexpectedPaperEvidenceAdapter(),
      mutationPort: {
        run: async () => {
          paperStartCount += 1;
          return {
            statusCode: 200,
            body: {
              status: "running",
              paper_start_id: `paper-start-${paperStartCount}`
            }
          };
        }
      }
    });

    await service.executeCommand("arena.start", undefined);
    const cycle = await service.executeCommand("arena.cycle", undefined);

    expect(paperStartCount).toBe(1);
    expect(cycle.result).toMatchObject({
      arena_tick: { tick_id: "tick-autonomous-overlap" },
      paper_trading: { paper_start_id: "paper-start-1" }
    });
  });
});

function candidateArenaTick(
  tickId: string,
  error: string
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-${tickId}`,
    tick_id: tickId,
    started_at: "2026-07-23T00:00:00.000Z",
    completed_at: "2026-07-23T00:00:01.000Z",
    status: "failed",
    created_candidate_refs: [],
    direction_results: [{
      direction_kind: "trend_following",
      status: "failed",
      error
    }],
    authority_status: "not_live"
  };
}

function successfulCandidateArenaTick(tickId: string): CandidateArenaTickRecord {
  return {
    ...candidateArenaTick(tickId, "unused"),
    status: "completed",
    created_candidate_refs: [{
      record_kind: "trading_system_candidate",
      id: FIXTURE_CANDIDATE_ID
    }],
    direction_results: [{
      direction_kind: "trend_following",
      status: "created",
      candidate_id: FIXTURE_CANDIDATE_ID
    }]
  };
}

function candidateArenaOutcome(tickId: string): CandidateArenaTickOutcome {
  return {
    status: "completed",
    tick_id: tickId,
    created_candidate_count: 1,
    created_candidate_ids: [FIXTURE_CANDIDATE_ID],
    arena: { leaderboard: [] } as unknown as CandidateArenaReadModel
  };
}

async function waitForPersistedContinuation(
  store: LocalStore,
  tickId: string
): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    const tick = (await store.listCandidateArenaTicks())
      .find((entry) => entry.tick_id === tickId);
    if (tick?.paper_trading_continuation) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("paper_continuation_persistence_timeout");
}

function stoppedArenaRunner() {
  return {
    status: () => "stopped" as const,
    ticks: () => 0,
    health: () => ({
      status: "stopped" as const,
      tick_count: 0,
      completed_tick_count: 0,
      active_tick: false,
      active_research_work_items: [],
      consecutive_failure_count: 0,
      runtime_coordination_authority: true as const,
      evaluation_authority: false as const,
      promotion_authority: false as const,
      order_submission_authority: false as const,
      live_exchange_authority: false as const,
      authority_status: "runtime_coordination_only" as const
    }),
    researchAgent: () => "fixture" as const,
    setTickContinuation: () => undefined,
    restoreTickCount: () => undefined,
    start: () => "started" as const,
    stop: () => "stopped" as const
  };
}

function unexpectedPaperEvidenceAdapter() {
  return {
    run: async () => {
      throw new Error("paper_evidence_not_expected");
    }
  };
}
