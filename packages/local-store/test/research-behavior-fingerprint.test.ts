import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  decideCandidateAdmission,
  paperTradingHandoffConformanceDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchPreflightCommitmentDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type ExperimentRunRecord,
  type PaperTradingHandoffConformanceRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchDirectionRecord,
  type ResearchFindingRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchBehaviorFingerprint", () => {
  let storeRoot: string;
  let store: LocalStore;

  beforeEach(async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-behavior-store-"));
    store = new LocalStore(storeRoot);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(storeRoot, { recursive: true, force: true });
  });

  it("persists, exactly replays, lists, and reloads canonical fingerprints", async () => {
    const first = await persistedFingerprintGraph(store, "first", 0);
    const second = await persistedFingerprintGraph(store, "second", 1, "sell");

    await expect(store.recordResearchBehaviorFingerprint(first.fingerprint))
      .resolves.toEqual(first.fingerprint);
    await expect(store.recordResearchBehaviorFingerprint(first.fingerprint))
      .resolves.toEqual(first.fingerprint);
    await expect(store.recordResearchBehaviorFingerprint(second.fingerprint))
      .resolves.toEqual(second.fingerprint);
    await expect(store.getResearchBehaviorFingerprint(
      first.fingerprint.research_behavior_fingerprint_id
    )).resolves.toEqual(first.fingerprint);
    await expect(store.listResearchBehaviorFingerprints()).resolves.toEqual([
      second.fingerprint,
      first.fingerprint
    ]);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.listResearchBehaviorFingerprints()).resolves.toEqual([
      second.fingerprint,
      first.fingerprint
    ]);
  });

  it("rejects malformed, digest-drifted, graph-mismatched, and same-ID-mutated evidence", async () => {
    const graph = await persistedFingerprintGraph(store, "integrity", 0);
    const malformed = structuredClone(graph.fingerprint) as any;
    malformed.observations.reverse();
    await expect(store.recordResearchBehaviorFingerprint(malformed)).rejects.toMatchObject({
      code: "invalid_research_behavior_fingerprint_input"
    });

    const digestDrift = structuredClone(graph.fingerprint);
    digestDrift.fingerprint_digest = digest("drift");
    await expect(store.recordResearchBehaviorFingerprint(digestDrift)).rejects.toMatchObject({
      code: "research_behavior_fingerprint_digest_mismatch"
    });

    const mismatchCases: Array<{
      label: string;
      mutate(record: ResearchBehaviorFingerprintRecord): void;
      code: string;
    }> = [
      {
        label: "missing commitment",
        mutate: (record) => { record.research_preflight_commitment_ref.id = "missing"; },
        code: "research_behavior_fingerprint_reference_not_found"
      },
      {
        label: "commitment digest",
        mutate: (record) => {
          record.research_preflight_commitment_digest = digest("other-commitment");
        },
        code: "research_behavior_fingerprint_reference_mismatch"
      },
      {
        label: "missing SystemCode",
        mutate: (record) => { record.system_code_ref.id = "missing"; },
        code: "research_behavior_fingerprint_reference_not_found"
      },
      {
        label: "artifact digest",
        mutate: (record) => { record.system_code_artifact_digest = digest("other-artifact"); },
        code: "research_behavior_fingerprint_reference_mismatch"
      },
      {
        label: "development suite",
        mutate: (record) => { record.development_suite_digest = digest("other-suite"); },
        code: "research_behavior_fingerprint_reference_mismatch"
      },
      {
        label: "time before commitment",
        mutate: (record) => { record.created_at = "2026-07-12T09:29:59.999Z"; },
        code: "research_behavior_fingerprint_reference_mismatch"
      }
    ];
    for (const testCase of mismatchCases) {
      const changed = structuredClone(graph.fingerprint);
      testCase.mutate(changed);
      changed.fingerprint_digest = behaviorDigest(changed);
      await expect(store.recordResearchBehaviorFingerprint(changed), testCase.label)
        .rejects.toMatchObject({ code: testCase.code });
    }

    await store.recordResearchBehaviorFingerprint(graph.fingerprint);
    const mutated = structuredClone(graph.fingerprint);
    mutated.observations[1]!.decision.quantity = 0.019;
    mutated.fingerprint_digest = behaviorDigest(mutated);
    await expect(store.recordResearchBehaviorFingerprint(mutated)).rejects.toMatchObject({
      code: "research_behavior_fingerprint_conflict"
    });
  });

  it("reloads a distinct admission without treating itself as a prior duplicate", async () => {
    const graph = await persistedAdmissionGraph(store, "reload-distinct", 0);
    await store.recordResearchBehaviorFingerprint(graph.fingerprint);
    const admission = behaviorAdmission(graph, "distinct");
    await store.recordCandidateAdmissionDecision(admission);

    const restarted = new LocalStore(storeRoot);
    await expect(restarted.getCandidateAdmissionDecision(
      admission.candidate_admission_decision_id
    )).resolves.toEqual(admission);
    await expect(restarted.listCandidateAdmissionDecisions()).resolves.toEqual([
      admission
    ]);
  });

  it("uses only an earlier admitted exact match as the duplicate baseline", async () => {
    const orphan = await persistedAdmissionGraph(store, "orphan", 0);
    await store.recordResearchBehaviorFingerprint(orphan.fingerprint);

    const firstAdmitted = await persistedAdmissionGraph(store, "admitted", 1);
    await store.recordResearchBehaviorFingerprint(firstAdmitted.fingerprint);
    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(firstAdmitted, "distinct")
    )).resolves.toMatchObject({
      status: "admitted",
      behavior_comparison_status: "distinct"
    });

    const duplicate = await persistedAdmissionGraph(store, "duplicate", 2);
    await store.recordResearchBehaviorFingerprint(duplicate.fingerprint);
    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(duplicate, "distinct")
    )).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });

    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(duplicate, "duplicate", firstAdmitted.fingerprint)
    )).resolves.toMatchObject({
      status: "duplicate",
      reason: "behavior_duplicate",
      matching_research_behavior_fingerprint_ref: {
        id: firstAdmitted.fingerprint.research_behavior_fingerprint_id
      }
    });
  });

  it("rejects a duplicate claim that points to unadmitted, nonmatching, or later evidence", async () => {
    const admitted = await persistedAdmissionGraph(store, "baseline", 1);
    await store.recordResearchBehaviorFingerprint(admitted.fingerprint);
    await store.recordCandidateAdmissionDecision(behaviorAdmission(admitted, "distinct"));

    const unadmitted = await persistedAdmissionGraph(store, "unadmitted", 0);
    await store.recordResearchBehaviorFingerprint(unadmitted.fingerprint);
    const candidate = await persistedAdmissionGraph(store, "candidate", 2);
    await store.recordResearchBehaviorFingerprint(candidate.fingerprint);

    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(candidate, "duplicate", unadmitted.fingerprint)
    )).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });

    const nonmatching = await persistedAdmissionGraph(store, "nonmatching", 3, "sell");
    await store.recordResearchBehaviorFingerprint(nonmatching.fingerprint);
    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(nonmatching, "duplicate", admitted.fingerprint)
    )).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });

    const later = await persistedAdmissionGraph(store, "later", 4);
    await store.recordResearchBehaviorFingerprint(later.fingerprint);
    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(candidate, "duplicate", later.fingerprint)
    )).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });
  });

  it("rejects a duplicate baseline admitted after the current decision time", async () => {
    const baseline = await persistedAdmissionGraph(store, "future-baseline", 1);
    baseline.decidedAt = "2026-07-12T14:00:00.000Z";
    await store.recordResearchBehaviorFingerprint(baseline.fingerprint);
    await store.recordCandidateAdmissionDecision(behaviorAdmission(baseline, "distinct"));

    const candidate = await persistedAdmissionGraph(store, "backdated-candidate", 2);
    await store.recordResearchBehaviorFingerprint(candidate.fingerprint);
    await expect(store.recordCandidateAdmissionDecision(
      behaviorAdmission(candidate, "duplicate", baseline.fingerprint)
    )).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });
  });

  it("rejects duplicate admission source identity outside the fingerprint commitment", async () => {
    const baseline = await persistedAdmissionGraph(store, "source-baseline", 1);
    await store.recordResearchBehaviorFingerprint(baseline.fingerprint);
    await store.recordCandidateAdmissionDecision(behaviorAdmission(baseline, "distinct"));

    const candidate = await persistedAdmissionGraph(store, "source-candidate", 2);
    await store.recordResearchBehaviorFingerprint(candidate.fingerprint);
    const foreignSource = systemCodeFixture(
      "foreign-source",
      digest("foreign-source"),
      "2026-07-12T12:00:00.000Z"
    );
    await store.recordSystemCode(foreignSource);
    const forged = behaviorAdmission(candidate, "duplicate", baseline.fingerprint);
    forged.source_system_code_ref = {
      record_kind: "system_code",
      id: foreignSource.system_code_id
    };
    forged.source_artifact_digest = foreignSource.artifact_digest;

    await expect(store.recordCandidateAdmissionDecision(forged)).rejects.toMatchObject({
      code: "candidate_admission_behavior_comparison_mismatch"
    });
  });
});

interface FingerprintGraph {
  sourceSystemCode: SystemCodeRecord;
  systemCode: SystemCodeRecord;
  commitment: ResearchPreflightCommitmentRecord;
  fingerprint: ResearchBehaviorFingerprintRecord;
}

interface AdmissionGraph extends FingerprintGraph {
  experiment: ExperimentRunRecord;
  evaluation: TradingEvaluationResultRecord;
  conformance: PaperTradingHandoffConformanceRecord;
  finding: ResearchFindingRecord;
  decidedAt: string;
}

async function persistedFingerprintGraph(
  store: LocalStore,
  suffix: string,
  hourOffset: number,
  side: "buy" | "sell" = "buy"
): Promise<FingerprintGraph> {
  const hour = 10 + hourOffset;
  const at = (minute: number) => `2026-07-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  const sourceSystemCode = systemCodeFixture(`source-code-${suffix}`, digest(`source-${suffix}`), at(0));
  const systemCode = systemCodeFixture(`system-code-${suffix}`, digest(`submitted-${suffix}`), at(31));
  const allocation = allocationFixture(suffix, at(0));
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: `research-direction-${suffix}`,
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore robust trend behavior without prescribing an implementation.",
    diversity_axis: "trend_following",
    created_at: at(0),
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: `research-worker-${suffix}`,
    display_name: `ResearchWorker ${suffix}`,
    model: "fixture",
    provider_kind: "fixture_only",
    research_direction_ref: { record_kind: "research_direction", id: direction.research_direction_id },
    created_at: at(0),
    status: "active",
    authority_status: "research_only"
  };
  const commitment = commitmentFixture(
    suffix,
    allocation,
    direction,
    worker,
    sourceSystemCode,
    at(30)
  );
  const fingerprint = fingerprintFixture(
    suffix,
    commitment,
    systemCode,
    at(32),
    side
  );
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchDirection(direction);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(sourceSystemCode);
  await store.recordResearchPreflightCommitment(commitment);
  await store.recordSystemCode(systemCode);
  return { sourceSystemCode, systemCode, commitment, fingerprint };
}

async function persistedAdmissionGraph(
  store: LocalStore,
  suffix: string,
  hourOffset: number,
  side: "buy" | "sell" = "buy"
): Promise<AdmissionGraph> {
  const graph = await persistedFingerprintGraph(store, suffix, hourOffset, side);
  const hour = 10 + hourOffset;
  const at = (minute: number) => `2026-07-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-${suffix}`,
    research_worker_ref: { ...graph.commitment.research_worker_ref },
    research_direction_ref: { ...graph.commitment.research_direction_ref },
    system_code_ref: { record_kind: "system_code", id: graph.systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    trace_ref: { record_kind: "trace_placeholder", id: `trace-${suffix}` },
    submitted_at: at(33),
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: { record_kind: "external_evaluator", id: "arena-evaluator-v1" },
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
    evaluator_trace_ref: { record_kind: "trace_placeholder", id: `evaluator-trace-${suffix}` },
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: graph.commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    submitted_system_code_ref: { record_kind: "system_code", id: graph.systemCode.system_code_id },
    submitted_artifact_digest: graph.systemCode.artifact_digest,
    sealed_admission_suite_digest: graph.commitment.sealed_admission_policy.suite_digest,
    evaluation_phase: "sealed_admission",
    submission_sequence: 1,
    selected_development_submission_sequence: 1,
    completed_at: at(35),
    authority_status: "not_counted"
  };
  const conformance = conformanceFixture(suffix, graph.systemCode, experiment, at(34), at(36));
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "Candidate produced complete externally observed behavior evidence.",
    supporting_record_refs: [{
      record_kind: "research_behavior_fingerprint",
      id: graph.fingerprint.research_behavior_fingerprint_id
    }],
    created_at: at(37),
    authority_status: "research_trace_only"
  };
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordPaperTradingHandoffConformance(conformance);
  await store.recordResearchFinding(finding);
  return { ...graph, experiment, evaluation, conformance, finding, decidedAt: at(38) };
}

function behaviorAdmission(
  graph: AdmissionGraph,
  behaviorStatus: "distinct" | "duplicate",
  matching?: ResearchBehaviorFingerprintRecord
): CandidateAdmissionDecisionRecord {
  const input = {
    research_worker_outcome: "changed" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const,
    paper_handoff_conformance_status: "passed" as const,
    behavior_comparison_status: behaviorStatus
  };
  const record: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-${graph.fingerprint.research_behavior_fingerprint_id}`,
    source_system_code_ref: { record_kind: "system_code", id: graph.sourceSystemCode.system_code_id },
    system_code_ref: { record_kind: "system_code", id: graph.systemCode.system_code_id },
    experiment_run_ref: { record_kind: "experiment_run", id: graph.experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: graph.evaluation.trading_evaluation_result_id
    },
    research_finding_ref: { record_kind: "research_finding", id: graph.finding.research_finding_id },
    source_artifact_digest: graph.sourceSystemCode.artifact_digest,
    submitted_artifact_digest: graph.systemCode.artifact_digest,
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: graph.conformance.paper_trading_handoff_conformance_id
    },
    paper_trading_handoff_conformance_digest: graph.conformance.evidence_digest,
    research_behavior_fingerprint_ref: {
      record_kind: "research_behavior_fingerprint",
      id: graph.fingerprint.research_behavior_fingerprint_id
    },
    research_behavior_fingerprint_digest: graph.fingerprint.fingerprint_digest,
    ...(matching
      ? {
          matching_research_behavior_fingerprint_ref: {
            record_kind: "research_behavior_fingerprint",
            id: matching.research_behavior_fingerprint_id
          },
          matching_research_behavior_fingerprint_digest:
            graph.fingerprint.fingerprint_digest
        }
      : {}),
    ...input,
    ...decideCandidateAdmission(input),
    decided_at: graph.decidedAt,
    authority_status: "not_live"
  };
  return record;
}

function allocationFixture(
  suffix: string,
  allocatedAt: string
): CandidateArenaResearchAllocationRecord {
  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `allocation-${suffix}`,
    tick_id: `tick-${suffix}`,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: "trend_following",
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["test_explicit_direction"]
    }],
    deferred_directions: [
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ],
    allocated_at: allocatedAt,
    allocation_digest: digest("pending"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  return allocation;
}

function commitmentFixture(
  suffix: string,
  allocation: CandidateArenaResearchAllocationRecord,
  direction: ResearchDirectionRecord,
  worker: ResearchWorkerRecord,
  sourceSystemCode: SystemCodeRecord,
  committedAt: string
): ResearchPreflightCommitmentRecord {
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `preflight-${suffix}`,
    candidate_arena_tick_id: allocation.tick_id,
    research_direction_ref: { record_kind: "research_direction", id: direction.research_direction_id },
    research_worker_ref: { record_kind: "research_worker", id: worker.research_worker_id },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: { record_kind: "system_code", id: sourceSystemCode.system_code_id },
    source_artifact_digest: sourceSystemCode.artifact_digest,
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest("shared-development-suite"),
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${suffix}`),
      suite_digest: digest(`sealed-suite-${suffix}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: committedAt,
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));
  return commitment;
}

function fingerprintFixture(
  suffix: string,
  commitment: ResearchPreflightCommitmentRecord,
  systemCode: SystemCodeRecord,
  createdAt: string,
  side: "buy" | "sell"
): ResearchBehaviorFingerprintRecord {
  const record: ResearchBehaviorFingerprintRecord = {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id: `fingerprint-${suffix}`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: commitment.commitment_digest,
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: commitment.development_policy.suite_version,
    development_suite_digest: commitment.development_policy.suite_digest,
    observations: [
      {
        scenario_id: "range_flat",
        decision: { symbol: "BTCUSDT", side: "hold", quantity: 0, order_type: "none" }
      },
      {
        scenario_id: "trend_long",
        decision: { symbol: "BTCUSDT", side, quantity: 0.02, order_type: "market" }
      }
    ],
    observation_count: 2,
    fingerprint_digest: digest("pending"),
    created_at: createdAt,
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.fingerprint_digest = behaviorDigest(record);
  return record;
}

function conformanceFixture(
  suffix: string,
  systemCode: SystemCodeRecord,
  experiment: ExperimentRunRecord,
  startedAt: string,
  completedAt: string
): PaperTradingHandoffConformanceRecord {
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: `conformance-${suffix}`,
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "hold",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: startedAt,
    completed_at: completedAt,
    evidence_digest: digest("pending"),
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.evidence_digest = "sha256:" + createHash("sha256")
    .update(paperTradingHandoffConformanceDigestInput(record))
    .digest("hex");
  return record;
}

function systemCodeFixture(
  id: string,
  artifactDigest: string,
  createdAt: string
): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: id,
    artifact_kind: "python_file",
    runtime_kind: "python",
    artifact_path: `/tmp/${id}.py`,
    artifact_digest: artifactDigest,
    entrypoint: ["python3", `/tmp/${id}.py`],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "research-only" },
    provenance_refs: [],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function behaviorDigest(record: ResearchBehaviorFingerprintRecord): string {
  return "sha256:" + createHash("sha256")
    .update(researchBehaviorFingerprintDigestInput(record))
    .digest("hex");
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
