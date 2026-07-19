import { describe, expect, it, vi } from "vitest";
import type {
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  PaperTradingEvaluationRecord,
  RunControlAuditInput
} from "@ouroboros/domain";
import {
  ArenaPaperRuntimeService,
  loadArenaPaperCapacity
} from "./arena-runtime";
import type { PaperTradingCommandResponse } from "./commands";

describe("ArenaPaperRuntimeService", () => {
  it("queues only materialized candidates with one exact runnable admission", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a", "materialized", {
        workspace_key: `sha256:${"b".repeat(64)}`,
        generation: 2
      }),
      candidate("candidate-ambiguous", "system-code-ambiguous"),
      candidate("candidate-unadmitted", "system-code-unadmitted"),
      candidate("candidate-fixture", "system-code-fixture", "fixture_only")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z"),
      admission("admission-ambiguous-1", "system-code-ambiguous", "2026-07-19T00:01:00.000Z"),
      admission("admission-ambiguous-2", "system-code-ambiguous", "2026-07-19T00:02:00.000Z")
    ]);
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    await expect(runtime.snapshot()).resolves.toMatchObject({
      capacity: 2,
      eligible_count: 1,
      queued_count: 1,
      occupied_count: 0,
      available_capacity: 2,
      systems: [{
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "candidate-a"
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "candidate-version-a"
        },
        system_code_ref: {
          record_kind: "system_code",
          id: "system-code-a"
        },
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-a"
        },
        paper_trading_handoff_conformance_ref: {
          record_kind: "paper_trading_handoff_conformance",
          id: "conformance-admission-a"
        },
        trading_run_ref: {
          record_kind: "trading_run",
          id: "trading-run-a"
        },
        lifecycle_status: "queued",
        authority_status: "not_live"
      }]
    });
  });

  it("fails closed when multiple materialized candidates claim one SystemCode", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-shared"),
      candidate("candidate-b", "system-code-shared")
    ], [
      admission(
        "admission-shared",
        "system-code-shared",
        "2026-07-19T00:00:00.000Z"
      )
    ]);
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    await expect(runtime.snapshot()).resolves.toMatchObject({
      eligible_count: 0,
      queued_count: 0,
      systems: []
    });
  });

  it("fills capacity after one candidate start fails and serializes concurrent reconciliation", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a", "materialized", {
        workspace_key: `sha256:${"b".repeat(64)}`,
        generation: 2
      }),
      candidate("candidate-b", "system-code-b"),
      candidate("candidate-c", "system-code-c"),
      candidate("candidate-d", "system-code-d")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z"),
      admission("admission-b", "system-code-b", "2026-07-19T00:01:00.000Z"),
      admission("admission-c", "system-code-c", "2026-07-19T00:02:00.000Z"),
      admission("admission-d", "system-code-d", "2026-07-19T00:03:00.000Z")
    ]);
    fixture.paperTrading.start.mockImplementation(async (candidateId: string) => {
      await Promise.resolve();
      if (candidateId === "candidate-b") {
        fixture.evaluations.push({
          ...runningEvaluation(candidateId),
          status: "not_started",
          next_observation_at: undefined
        });
        return {
          statusCode: 422,
          body: { error: "trading_run_failed", reason: "sandbox_unavailable" }
        };
      }
      fixture.running.add(`trading-run-${candidateId.slice("candidate-".length)}`);
      fixture.evaluations.push(runningEvaluation(candidateId));
      return {
        statusCode: 201,
        body: {
          status: "started",
          runner_status: "running",
          paper_trading_evaluation: runningEvaluation(candidateId)
        }
      };
    });
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    const [first, second] = await Promise.all([
      runtime.reconcile(),
      runtime.reconcile()
    ]);

    expect(first).toEqual(second);
    expect(fixture.paperTrading.start.mock.calls.map(([candidateId]) => candidateId))
      .toEqual(["candidate-a", "candidate-b", "candidate-c"]);
    expect(first).toMatchObject({
      occupied_count: 2,
      available_capacity: 0,
      running_count: 2,
      failed_count: 1,
      queued_count: 1
    });
    expect(first.systems.map((system) => [
      system.candidate_ref.id,
      system.lifecycle_status
    ])).toEqual([
      ["candidate-a", "running"],
      ["candidate-b", "failed"],
      ["candidate-c", "running"],
      ["candidate-d", "queued"]
    ]);
    expect(fixture.evaluations.find((evaluation) =>
      evaluation.candidate_ref.id === "candidate-b"
    )).toMatchObject({
      status: "failed",
      latest_failure_reason: "sandbox_unavailable"
    });
  });

  it("persists pre-evaluation start failures across runtime restarts", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z")
    ]);
    fixture.paperTrading.start.mockResolvedValue({
      statusCode: 409,
      body: {
        error: "trading_run_failed",
        reason: "paper_handoff_artifact_digest_mismatch"
      }
    });
    const firstRuntime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 1
    });

    await expect(firstRuntime.reconcile()).resolves.toMatchObject({
      failed_count: 1,
      queued_count: 0,
      needs_reconcile: false
    });
    expect(fixture.evaluations).toEqual([]);

    const restartedRuntime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 1
    });
    await expect(restartedRuntime.reconcile()).resolves.toMatchObject({
      failed_count: 1,
      queued_count: 0,
      needs_reconcile: false
    });
    expect(fixture.paperTrading.start).toHaveBeenCalledTimes(1);
    expect(fixture.runControlAudits).toEqual([
      expect.objectContaining({
        candidate_id: "candidate-a",
        candidate_version_id: "candidate-version-a",
        runtime_id: "trading-run-a",
        decision: expect.objectContaining({
          decision_outcome: "rejected",
          resulting_lifecycle_status: "failed"
        }),
        audit_event: expect.objectContaining({
          runtime_lifecycle_status: "failed",
          message: "Arena paper start failed: paper_handoff_artifact_digest_mismatch."
        })
      })
    ]);
  });

  it("starts every available slot without waiting for a slow sibling", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a"),
      candidate("candidate-b", "system-code-b")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z"),
      admission("admission-b", "system-code-b", "2026-07-19T00:01:00.000Z")
    ]);
    let releaseFirst!: () => void;
    const firstStart = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    fixture.paperTrading.start.mockImplementation(async (candidateId: string) => {
      if (candidateId === "candidate-a") await firstStart;
      fixture.running.add(`trading-run-${candidateId.slice("candidate-".length)}`);
      fixture.evaluations.push(runningEvaluation(candidateId));
      return {
        statusCode: 201,
        body: {
          status: "started",
          runner_status: "running",
          paper_trading_evaluation: runningEvaluation(candidateId)
        }
      };
    });
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    const reconciliation = runtime.reconcile();
    await vi.waitFor(() => {
      expect(fixture.paperTrading.start).toHaveBeenCalledTimes(2);
    });
    expect(fixture.paperTrading.start.mock.calls.map(([candidateId]) => candidateId))
      .toEqual(["candidate-a", "candidate-b"]);

    releaseFirst();
    await expect(reconciliation).resolves.toMatchObject({
      occupied_count: 2,
      running_count: 2
    });
  });

  it("stops every late batch start after the runtime is fenced", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a"),
      candidate("candidate-b", "system-code-b")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z"),
      admission("admission-b", "system-code-b", "2026-07-19T00:01:00.000Z")
    ]);
    let releaseStarts!: () => void;
    const startsReleased = new Promise<void>((resolve) => {
      releaseStarts = resolve;
    });
    fixture.paperTrading.start.mockImplementation(async (candidateId: string) => {
      await startsReleased;
      fixture.running.add(`trading-run-${candidateId.slice("candidate-".length)}`);
      fixture.evaluations.push(runningEvaluation(candidateId));
      return {
        statusCode: 201,
        body: {
          status: "started",
          runner_status: "running",
          paper_trading_evaluation: runningEvaluation(candidateId)
        }
      };
    });
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    const reconciliation = runtime.reconcile();
    await vi.waitFor(() => {
      expect(fixture.paperTrading.start).toHaveBeenCalledTimes(2);
    });
    runtime.fencePendingStarts();
    releaseStarts();

    await expect(reconciliation).resolves.toMatchObject({
      occupied_count: 0,
      stopped_count: 2,
      needs_reconcile: false
    });
    expect(fixture.paperTrading.stop.mock.calls.map(([tradingRunId]) =>
      tradingRunId
    )).toEqual(["trading-run-a", "trading-run-b"]);
  });

  it("reconstructs persisted running and stopped ownership before filling a free slot", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a", "materialized", {
        workspace_key: `sha256:${"b".repeat(64)}`,
        generation: 2
      }),
      candidate("candidate-b", "system-code-b"),
      candidate("candidate-c", "system-code-c")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z"),
      admission("admission-b", "system-code-b", "2026-07-19T00:01:00.000Z"),
      admission("admission-c", "system-code-c", "2026-07-19T00:02:00.000Z")
    ], [
      runningEvaluation("candidate-a"),
      {
        ...runningEvaluation("candidate-b"),
        status: "stopped",
        stopped_at: "2026-07-19T00:05:00.000Z",
        next_observation_at: undefined
      }
    ]);
    fixture.paperTrading.start.mockImplementation(async (candidateId: string) => {
      fixture.running.add(`trading-run-${candidateId.slice("candidate-".length)}`);
      fixture.evaluations.push(runningEvaluation(candidateId));
      return {
        statusCode: 201,
        body: {
          status: "started",
          runner_status: "running",
          paper_trading_evaluation: runningEvaluation(candidateId)
        }
      };
    });
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 2
    });

    const reconstructed = await runtime.snapshot();
    expect(reconstructed.systems[0]).toMatchObject({
      sandbox_ref: { record_kind: "sandbox", id: "sandbox-a" },
      workspace_key: `sha256:${"b".repeat(64)}`,
      sandbox_generation: 2
    });
    expect(reconstructed.systems.map((system) => [
      system.candidate_ref.id,
      system.lifecycle_status
    ])).toEqual([
      ["candidate-a", "recovering"],
      ["candidate-b", "stopped"],
      ["candidate-c", "queued"]
    ]);

    const reconciled = await runtime.reconcile();
    expect(fixture.paperTrading.start).toHaveBeenCalledOnce();
    expect(fixture.paperTrading.start).toHaveBeenCalledWith("candidate-c", {});
    expect(reconciled).toMatchObject({
      occupied_count: 2,
      recovering_count: 1,
      running_count: 1,
      stopped_count: 1
    });
  });

  it("requeues a capacity-deferred stopped evaluation when a slot is free", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z")
    ], [{
      ...runningEvaluation("candidate-a"),
      status: "stopped",
      stopped_at: "2026-07-19T00:05:00.000Z",
      next_observation_at: undefined,
      runtime_coordination_status: "arena_capacity_deferred"
    }]);
    fixture.paperTrading.start.mockImplementation(async (candidateId: string) => {
      fixture.running.add("trading-run-a");
      fixture.evaluations[0] = runningEvaluation(candidateId);
      return {
        statusCode: 201,
        body: {
          status: "started",
          runner_status: "running",
          paper_trading_evaluation: fixture.evaluations[0]
        }
      };
    });
    const runtime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 1
    });

    await expect(runtime.snapshot()).resolves.toMatchObject({
      queued_count: 1,
      stopped_count: 0,
      needs_reconcile: true,
      systems: [{
        runtime_coordination_status: "arena_capacity_deferred"
      }]
    });
    await expect(runtime.reconcile()).resolves.toMatchObject({
      queued_count: 0,
      running_count: 1,
      occupied_count: 1
    });
    expect(fixture.paperTrading.start).toHaveBeenCalledWith("candidate-a", {});
  });

  it("persists a failed deferred restart and does not retry it after restart", async () => {
    const fixture = runtimeFixture([
      candidate("candidate-a", "system-code-a")
    ], [
      admission("admission-a", "system-code-a", "2026-07-19T00:00:00.000Z")
    ], [{
      ...runningEvaluation("candidate-a"),
      status: "stopped",
      stopped_at: "2026-07-19T00:05:00.000Z",
      next_observation_at: undefined,
      runtime_coordination_status: "arena_capacity_deferred"
    }]);
    fixture.paperTrading.start.mockResolvedValue({
      statusCode: 409,
      body: {
        error: "trading_run_failed",
        reason: "paper_handoff_artifact_digest_mismatch"
      }
    });
    const firstRuntime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 1
    });

    await expect(firstRuntime.reconcile()).resolves.toMatchObject({
      failed_count: 1,
      queued_count: 0,
      needs_reconcile: false
    });
    expect(fixture.evaluations[0]).toMatchObject({
      status: "failed",
      next_observation_at: undefined,
      runtime_coordination_status: undefined,
      latest_failure_reason: "paper_handoff_artifact_digest_mismatch"
    });

    const restartedRuntime = new ArenaPaperRuntimeService({
      store: fixture.store,
      paperTrading: fixture.paperTrading,
      capacity: 1
    });
    await expect(restartedRuntime.reconcile()).resolves.toMatchObject({
      failed_count: 1,
      queued_count: 0,
      needs_reconcile: false
    });
    expect(fixture.paperTrading.start).toHaveBeenCalledTimes(1);
  });
});

describe("loadArenaPaperCapacity", () => {
  it("defaults to two and rejects invalid configured limits", () => {
    expect(loadArenaPaperCapacity({})).toBe(2);
    expect(loadArenaPaperCapacity({ OUROBOROS_ARENA_PAPER_CAPACITY: "4" }))
      .toBe(4);
    expect(() => loadArenaPaperCapacity({
      OUROBOROS_ARENA_PAPER_CAPACITY: "0"
    })).toThrow("OUROBOROS_ARENA_PAPER_CAPACITY must be a positive integer.");
  });
});

function runtimeFixture(
  candidates: CandidateInspectReadModel[],
  admissions: CandidateAdmissionDecisionRecord[],
  initialEvaluations: PaperTradingEvaluationRecord[] = []
) {
  const evaluations = [...initialEvaluations];
  const running = new Set<string>();
  const runControlAudits: RunControlAuditInput[] = [];
  const runLifecycles = new Map<string, "registered" | "failed">();
  const byId = new Map(candidates.map((item) => [item.candidate_id, item]));
  const store = {
    async listCandidates() {
      return candidates.map((item) => ({
        candidate_id: item.candidate_id,
        display_name: item.display_name,
        status: item.status,
        active_version_id: item.active_version_id,
        fixture_notice: item.fixture_notice
      }));
    },
    async getCandidate(candidateId: string) {
      return byId.get(candidateId);
    },
    async getTradingRun(tradingRunId: string) {
      const candidateId = `candidate-${tradingRunId.slice("trading-run-".length)}`;
      const item = byId.get(candidateId);
      if (!item) return undefined;
      return {
        record_kind: "trading_run",
        version: 1,
        trading_run_id: tradingRunId,
        stage_binding_profile: "paper",
        runtime_lifecycle_status: runLifecycles.get(tradingRunId) ?? "registered",
        candidate_ref: { record_kind: "trading_system_candidate", id: candidateId },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: item.candidate_version.candidate_version_id
        },
        placement_ref: { record_kind: "sandbox_placement", id: `placement-${candidateId}` },
        hands_environment_ref: { record_kind: "hands_environment", id: `hands-${candidateId}` },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: `memory-${candidateId}` },
        authority_status: "not_live"
      };
    },
    async listCandidateAdmissionDecisions() {
      return admissions;
    },
    async listPaperTradingEvaluations() {
      return evaluations;
    },
    async getLatestPaperTradingEvaluationForTradingRun(tradingRunId: string) {
      return evaluations.filter((evaluation) =>
        evaluation.trading_run_ref.id === tradingRunId
      ).at(-1);
    },
    async recordPaperTradingEvaluation(evaluation: PaperTradingEvaluationRecord) {
      const index = evaluations.findIndex((existing) =>
        existing.paper_trading_evaluation_id ===
          evaluation.paper_trading_evaluation_id
      );
      if (index >= 0) evaluations[index] = evaluation;
      else evaluations.push(evaluation);
      return evaluation;
    },
    async recordRunControlAudit(input: RunControlAuditInput) {
      runControlAudits.push(input);
      runLifecycles.set(
        input.runtime_id!,
        input.decision.resulting_lifecycle_status === "failed"
          ? "failed"
          : "registered"
      );
      return {} as never;
    }
  };
  const paperTrading = {
    active: vi.fn((tradingRunId: string) => running.has(tradingRunId)),
    start: vi.fn(async (
      _candidateId: string,
      _payload: unknown
    ): Promise<PaperTradingCommandResponse> => ({
      statusCode: 500,
      body: { error: "not_implemented" }
    })),
    stop: vi.fn(async (tradingRunId: string): Promise<PaperTradingCommandResponse> => {
      running.delete(tradingRunId);
      const evaluation = evaluations.find((entry) =>
        entry.trading_run_ref.id === tradingRunId
      );
      if (evaluation) {
        const index = evaluations.indexOf(evaluation);
        evaluations[index] = {
          ...evaluation,
          status: "stopped",
          stopped_at: "2026-07-19T00:06:00.000Z",
          next_observation_at: undefined
        };
      }
      return { statusCode: 200, body: { status: "stopped" } };
    })
  };
  return {
    store: store as never,
    paperTrading,
    evaluations,
    running,
    runControlAudits
  };
}

function candidate(
  candidateId: string,
  systemCodeId: string,
  status: "materialized" | "fixture_only" = "materialized",
  sandbox?: { workspace_key: string; generation: number }
): CandidateInspectReadModel {
  const suffix = candidateId.slice("candidate-".length);
  return {
    candidate_id: candidateId,
    display_name: candidateId,
    status,
    active_version_id: `candidate-version-${suffix}`,
    fixture_notice: {
      is_fixture: status === "fixture_only",
      message: status === "fixture_only" ? "fixture" : "materialized"
    },
    system_code: {
      ref: { record_kind: "system_code", id: systemCodeId },
      summary: systemCodeId,
      declared_outputs: []
    },
    candidate_version: {
      candidate_version_id: `candidate-version-${suffix}`,
      version_label: "v1",
      provenance_refs: []
    },
    runtime: {
      ref: { record_kind: "trading_run", id: `trading-run-${suffix}` },
      ...(sandbox ? {
        sandbox: {
          sandbox_id: `sandbox-${suffix}`,
          workspace_key: sandbox.workspace_key,
          generation: sandbox.generation
        }
      } : {})
    }
  } as unknown as CandidateInspectReadModel;
}

function admission(
  admissionId: string,
  systemCodeId: string,
  decidedAt: string
): CandidateAdmissionDecisionRecord {
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: admissionId,
    source_system_code_ref: { record_kind: "system_code", id: `source-${systemCodeId}` },
    system_code_ref: { record_kind: "system_code", id: systemCodeId },
    experiment_run_ref: { record_kind: "experiment_run", id: `experiment-${admissionId}` },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: `evaluation-${admissionId}`
    },
    research_finding_ref: { record_kind: "research_finding", id: `finding-${admissionId}` },
    source_artifact_digest: `sha256:source-${admissionId}`,
    submitted_artifact_digest: `sha256:submitted-${admissionId}`,
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    paper_handoff_conformance_status: "passed",
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: `conformance-${admissionId}`
    },
    paper_trading_handoff_conformance_digest: `sha256:conformance-${admissionId}`,
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    authority_status: "not_live",
    decided_at: decidedAt
  };
}

function runningEvaluation(candidateId: string): PaperTradingEvaluationRecord {
  const suffix = candidateId.slice("candidate-".length);
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: `paper-evaluation-${suffix}`,
    candidate_ref: { record_kind: "trading_system_candidate", id: candidateId },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `candidate-version-${suffix}`
    },
    trading_run_ref: { record_kind: "trading_run", id: `trading-run-${suffix}` },
    status: "running",
    interval_ms: 60_000,
    observation_count: 0,
    started_at: "2026-07-19T00:04:00.000Z",
    next_observation_at: "2026-07-19T00:05:00.000Z",
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    authority_status: "not_live"
  };
}
