import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  researchPreflightCommitmentDigestInput,
  type CandidateArenaResearchAllocationRecord,
  type ResearchDirectionRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchPreflightCommitment", () => {
  let storeRoot: string;
  let store: LocalStore;

  beforeEach(async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-preflight-commitment-store-"));
    store = new LocalStore(storeRoot);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(storeRoot, { recursive: true, force: true });
  });

  it("persists supporting identities and exactly replays, lists, and reloads a commitment", async () => {
    const graph = await persistSupport(store);
    const record = commitmentFixture(graph);

    await expect(store.recordResearchPreflightCommitment(record)).resolves.toEqual(record);
    await expect(store.recordResearchPreflightCommitment(record)).resolves.toEqual(record);
    await expect(store.getResearchPreflightCommitment(
      record.research_preflight_commitment_id
    )).resolves.toEqual(record);
    await expect(store.listResearchPreflightCommitments()).resolves.toEqual([record]);
    await expect(store.getResearchDirection(graph.direction.research_direction_id))
      .resolves.toEqual(graph.direction);
    await expect(store.getResearchWorker(graph.worker.research_worker_id))
      .resolves.toEqual(graph.worker);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.getResearchPreflightCommitment(
      record.research_preflight_commitment_id
    )).resolves.toEqual(record);
    await expect(restarted.listResearchPreflightCommitments()).resolves.toEqual([record]);
  });

  it("rejects malformed, digest-drifted, raw-seed, and same-ID-mutated commitments", async () => {
    const graph = await persistSupport(store);
    const record = commitmentFixture(graph);
    const malformed = structuredClone(record) as any;
    malformed.sealed_admission_policy.submission_limit = 2;
    await expect(store.recordResearchPreflightCommitment(malformed)).rejects.toMatchObject({
      code: "invalid_research_preflight_commitment_input"
    });

    const rawSeed = structuredClone(record) as any;
    rawSeed.sealed_admission_policy.rotation_seed = "00".repeat(32);
    await expect(store.recordResearchPreflightCommitment(rawSeed)).rejects.toMatchObject({
      code: "invalid_research_preflight_commitment_input"
    });

    const digestDrift = { ...record, commitment_digest: digest("drift") };
    await expect(store.recordResearchPreflightCommitment(digestDrift)).rejects.toMatchObject({
      code: "research_preflight_commitment_digest_mismatch"
    });

    await store.recordResearchPreflightCommitment(record);
    const changed = withCommitmentDigest({
      ...record,
      committed_at: "2026-07-12T10:00:01.000Z"
    });
    await expect(store.recordResearchPreflightCommitment(changed)).rejects.toMatchObject({
      code: "research_preflight_commitment_conflict"
    });
  });

  it("rejects missing references and allocation, source, direction, tick, or budget drift", async () => {
    const graph = await persistSupport(store);
    const cases: Array<{
      label: string;
      code: string;
      mutate: (record: ResearchPreflightCommitmentRecord) => void;
    }> = [
      {
        label: "source",
        code: "research_preflight_commitment_reference_not_found",
        mutate: (record) => { record.source_system_code_ref.id = "missing-source"; }
      },
      {
        label: "worker",
        code: "research_preflight_commitment_reference_not_found",
        mutate: (record) => { record.research_worker_ref.id = "missing-worker"; }
      },
      {
        label: "direction",
        code: "research_preflight_commitment_reference_not_found",
        mutate: (record) => { record.research_direction_ref.id = "missing-direction"; }
      },
      {
        label: "allocation",
        code: "research_preflight_commitment_reference_not_found",
        mutate: (record) => { record.research_allocation_ref.id = "missing-allocation"; }
      },
      {
        label: "allocation digest",
        code: "research_preflight_commitment_graph_mismatch",
        mutate: (record) => { record.research_allocation_digest = digest("other-allocation"); }
      },
      {
        label: "source digest",
        code: "research_preflight_commitment_graph_mismatch",
        mutate: (record) => { record.source_artifact_digest = digest("other-source"); }
      },
      {
        label: "tick",
        code: "research_preflight_commitment_graph_mismatch",
        mutate: (record) => { record.candidate_arena_tick_id = "other-tick"; }
      },
      {
        label: "direction selection",
        code: "research_preflight_commitment_graph_mismatch",
        mutate: (record) => {
          record.research_direction_ref.id = "research-direction-execution-cost";
        }
      },
      {
        label: "development budget",
        code: "research_preflight_commitment_graph_mismatch",
        mutate: (record) => { record.development_policy.submission_limit = 1; }
      }
    ];

    for (const [index, testCase] of cases.entries()) {
      const record = commitmentFixture(graph);
      record.research_preflight_commitment_id += `-${index}`;
      testCase.mutate(record);
      withCommitmentDigest(record);
      await expect(store.recordResearchPreflightCommitment(record), testCase.label)
        .rejects.toMatchObject({ code: testCase.code });
    }
  });

  it("rejects reuse of one evaluator rotation or sealed suite under a new commitment", async () => {
    const graph = await persistSupport(store);
    const first = commitmentFixture(graph);
    await store.recordResearchPreflightCommitment(first);

    const second = withCommitmentDigest({
      ...structuredClone(first),
      research_preflight_commitment_id: "preflight-rotation-reuse",
      committed_at: "2026-07-12T10:00:01.000Z"
    });
    await expect(store.recordResearchPreflightCommitment(second)).rejects.toMatchObject({
      code: "research_preflight_commitment_rotation_reuse"
    });
  });

  it("binds terminal sealed evaluation to exact commitment, submitted code, and suite", async () => {
    const graph = await persistSupport(store);
    const commitment = commitmentFixture(graph);
    await store.recordResearchPreflightCommitment(commitment);
    const submitted = systemCodeFixture("submitted-system-code", digest("submitted-artifact"));
    await store.recordSystemCode(submitted);
    const experiment = {
      record_kind: "experiment_run" as const,
      version: 1 as const,
      experiment_run_id: "sealed-experiment",
      research_worker_ref: { record_kind: "research_worker", id: graph.worker.research_worker_id },
      research_direction_ref: {
        record_kind: "research_direction",
        id: graph.direction.research_direction_id
      },
      system_code_ref: { record_kind: "system_code", id: submitted.system_code_id },
      trading_evaluation_task_ref: {
        record_kind: "trading_evaluation_task",
        id: "candidate-arena-revenue-cost-v1"
      },
      submitted_at: "2026-07-12T10:00:01.000Z",
      status: "evaluated" as const,
      authority_status: "not_live" as const
    };
    await store.recordExperimentRun(experiment);
    const evaluation = evaluationFixture(commitment, submitted, experiment.experiment_run_id);

    await expect(store.recordTradingEvaluationResult(evaluation)).resolves.toEqual(evaluation);
    await expect(store.recordTradingEvaluationResult({
      ...structuredClone(evaluation),
      trading_evaluation_result_id: "sealed-evaluation-second-submission"
    })).rejects.toMatchObject({
      code: "research_preflight_terminal_reuse"
    });
    const mutations: Array<(record: any) => void> = [
      (record) => { record.research_preflight_commitment_ref.id = "missing-commitment"; },
      (record) => { record.research_preflight_commitment_digest = digest("other-commitment"); },
      (record) => { record.submitted_system_code_ref.id = graph.source.system_code_id; },
      (record) => { record.submitted_artifact_digest = digest("other-submitted"); },
      (record) => { record.sealed_admission_suite_digest = digest("other-suite"); },
      (record) => { record.evaluation_phase = "development"; },
      (record) => { record.submission_sequence = 2; }
    ];
    for (const [index, mutate] of mutations.entries()) {
      const changed = structuredClone(evaluation) as any;
      changed.trading_evaluation_result_id += `-${index}`;
      mutate(changed);
      await expect(store.recordTradingEvaluationResult(changed)).rejects.toMatchObject({
        code: index >= 5
          ? "invalid_trading_evaluation_result_input"
          : "research_preflight_terminal_graph_mismatch"
      });
    }

    const historical = structuredClone(evaluation) as any;
    historical.trading_evaluation_result_id = "historical-evaluation";
    delete historical.research_preflight_commitment_ref;
    delete historical.research_preflight_commitment_digest;
    delete historical.submitted_system_code_ref;
    delete historical.submitted_artifact_digest;
    delete historical.sealed_admission_suite_digest;
    delete historical.evaluation_phase;
    delete historical.submission_sequence;
    await expect(store.recordTradingEvaluationResult(historical)).resolves.toEqual(historical);
  });
});

async function persistSupport(store: LocalStore): Promise<{
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
}> {
  const allocation = allocationFixture();
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: "research-direction-trend-following",
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore robust trend behavior without prescribing an implementation.",
    created_at: "2026-07-12T10:00:00.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: "research-worker-trend-following",
    display_name: "Trend following ResearchWorker",
    model: "fixture",
    provider_kind: "fixture_only",
    research_direction_ref: {
      record_kind: "research_direction",
      id: direction.research_direction_id
    },
    created_at: "2026-07-12T10:00:00.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const alternateDirection: ResearchDirectionRecord = {
    ...direction,
    research_direction_id: "research-direction-execution-cost",
    direction_kind: "execution_cost_robustness",
    prompt_seed: "Explore execution-cost robustness without prescribing an implementation."
  };
  const source = systemCodeFixture("source-system-code", digest("source-artifact"));
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchDirection(direction);
  await store.recordResearchDirection(alternateDirection);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  return { allocation, direction, worker, source };
}

function commitmentFixture(input: Awaited<ReturnType<typeof persistSupport>>): ResearchPreflightCommitmentRecord {
  return withCommitmentDigest({
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: "preflight-tick-7-trend",
    candidate_arena_tick_id: input.allocation.tick_id,
    research_direction_ref: {
      record_kind: "research_direction",
      id: input.direction.research_direction_id
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: input.worker.research_worker_id
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: input.allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: input.allocation.allocation_digest,
    source_system_code_ref: { record_kind: "system_code", id: input.source.system_code_id },
    source_artifact_digest: input.source.artifact_digest,
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest("development-suite"),
      submission_limit: 2,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest("rotation"),
      suite_digest: digest("sealed-suite"),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-12T10:00:00.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: `sha256:${"0".repeat(64)}`
  });
}

function allocationFixture(): CandidateArenaResearchAllocationRecord {
  const record: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: "allocation-tick-7",
    tick_id: "tick-7",
    allocation_mode: "adaptive_default",
    allocation_policy_basis: { basis_kind: "repository_default" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [
      allocationSignal("trend_following", 10),
      allocationSignal("mean_reversion", 9),
      allocationSignal("volatility_regime", 0),
      allocationSignal("funding_aware_risk", -1),
      allocationSignal("execution_cost_robustness", -2)
    ],
    selected_directions: [
      {
        direction_kind: "trend_following",
        selection_kind: "focus",
        priority: 1,
        experiment_budget: 2,
        signal_score: 10,
        reasons: ["test_focus"]
      },
      {
        direction_kind: "mean_reversion",
        selection_kind: "focus",
        priority: 2,
        experiment_budget: 2,
        signal_score: 9,
        reasons: ["test_focus"]
      },
      {
        direction_kind: "volatility_regime",
        selection_kind: "exploration",
        priority: 3,
        experiment_budget: 1,
        signal_score: 0,
        reasons: ["exploration_floor"]
      }
    ],
    deferred_directions: ["funding_aware_risk", "execution_cost_robustness"],
    allocated_at: "2026-07-12T10:00:00.000Z",
    allocation_digest: "pending",
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.allocation_digest = exactDigest(candidateArenaResearchAllocationDigestInput(record));
  return record;
}

function allocationSignal(
  direction_kind: CandidateArenaResearchAllocationRecord["signal_snapshot"][number]["direction_kind"],
  score: number
): CandidateArenaResearchAllocationRecord["signal_snapshot"][number] {
  return {
    direction_kind,
    finding_pressure_score: score,
    research_efficiency_score: 0,
    recent_outcome_score: 0,
    focus_score: score,
    completed_selection_count: 0,
    source_candidate_ids: [],
    source_tick_ids: [],
    reasons: ["test_signal"]
  };
}

function systemCodeFixture(id: string, artifactDigest: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: id,
    artifact_kind: "python_file",
    artifact_path: `/tmp/${id}.py`,
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", `/tmp/${id}.py`],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "research-only" },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-12T10:00:00.000Z",
    authority_status: "not_live"
  };
}

function evaluationFixture(
  commitment: ResearchPreflightCommitmentRecord,
  submitted: SystemCodeRecord,
  experimentRunId: string
): TradingEvaluationResultRecord {
  return {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "sealed-evaluation",
    experiment_run_ref: { record_kind: "experiment_run", id: experimentRunId },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    evaluator_ref: { record_kind: "external_evaluator", id: "sealed-evaluator" },
    result_status: "accepted",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: 1,
      oos_score: 1,
      drawdown_score: 1,
      turnover_score: 1,
      cost_survival_score: 1,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: [],
    evaluator_trace_ref: { record_kind: "trace_placeholder", id: "sealed-trace" },
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: commitment.commitment_digest,
    submitted_system_code_ref: { record_kind: "system_code", id: submitted.system_code_id },
    submitted_artifact_digest: submitted.artifact_digest,
    sealed_admission_suite_digest: commitment.sealed_admission_policy.suite_digest,
    evaluation_phase: "sealed_admission",
    submission_sequence: 1,
    completed_at: "2026-07-12T10:00:02.000Z",
    authority_status: "not_counted"
  };
}

function withCommitmentDigest<T extends ResearchPreflightCommitmentRecord>(record: T): T {
  record.commitment_digest = exactDigest(researchPreflightCommitmentDigestInput(record));
  return record;
}

function digest(value: string): string {
  return exactDigest(value);
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
