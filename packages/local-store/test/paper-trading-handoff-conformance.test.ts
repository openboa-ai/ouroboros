import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decideCandidateAdmission,
  paperTradingHandoffConformanceDigestInput,
  type CandidateAdmissionDecisionRecord,
  type ExperimentRunRecord,
  type PaperTradingHandoffConformanceRecord,
  type ResearchFindingRecord,
  type TradingEvaluationResultRecord,
  type SystemCodeRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

describe("LocalStore PaperTradingHandoffConformance", () => {
  let storeRoot: string;
  let store: LocalStore;

  beforeEach(async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-handoff-store-"));
    store = new LocalStore(storeRoot);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(storeRoot, { recursive: true, force: true });
  });

  it("persists, exactly replays, lists, and reloads canonical evidence", async () => {
    const graph = await persistedGraph(store);
    const first = conformanceFixture(graph.systemCode, graph.experiment);
    const second = conformanceFixture(graph.systemCode, graph.experiment, {
      id: "paper-handoff-conformance-second",
      started_at: "2026-07-12T10:01:00.000Z",
      completed_at: "2026-07-12T10:01:01.000Z"
    });

    await expect(store.recordPaperTradingHandoffConformance(first)).resolves.toEqual(first);
    await expect(store.recordPaperTradingHandoffConformance(first)).resolves.toEqual(first);
    await expect(store.recordPaperTradingHandoffConformance(second)).resolves.toEqual(second);
    await expect(store.getPaperTradingHandoffConformance(
      first.paper_trading_handoff_conformance_id
    )).resolves.toEqual(first);
    await expect(store.listPaperTradingHandoffConformances()).resolves.toEqual([second, first]);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.getPaperTradingHandoffConformance(
      first.paper_trading_handoff_conformance_id
    )).resolves.toEqual(first);
    await expect(restarted.listPaperTradingHandoffConformances()).resolves.toEqual([second, first]);
  });

  it("rejects malformed, digest-drifted, rejected-as-runnable, and same-ID-mutated evidence", async () => {
    const graph = await persistedGraph(store);
    const record = conformanceFixture(graph.systemCode, graph.experiment);
    const malformed = structuredClone(record) as any;
    malformed.status = "infrastructure_failed";
    await expect(store.recordPaperTradingHandoffConformance(malformed)).rejects.toMatchObject({
      code: "invalid_paper_trading_handoff_conformance_input"
    });

    const digestDrift = structuredClone(record);
    digestDrift.evidence_digest = "sha256:drift";
    await expect(store.recordPaperTradingHandoffConformance(digestDrift)).rejects.toMatchObject({
      code: "paper_trading_handoff_conformance_digest_mismatch"
    });

    const rejectedAsRunnable = structuredClone(record) as any;
    rejectedAsRunnable.status = "rejected";
    rejectedAsRunnable.reason = "runtime_stop_missing";
    await expect(store.recordPaperTradingHandoffConformance(rejectedAsRunnable))
      .rejects.toMatchObject({
        code: "invalid_paper_trading_handoff_conformance_input"
      });

    await store.recordPaperTradingHandoffConformance(record);
    const mutated = structuredClone(record);
    mutated.runner_kind = "docker_sandboxes_sbx";
    mutated.evidence_digest = conformanceDigest(mutated);
    await expect(store.recordPaperTradingHandoffConformance(mutated)).rejects.toMatchObject({
      code: "paper_trading_handoff_conformance_conflict"
    });
  });

  it.each([
    ["missing SystemCode", async (
      record: PaperTradingHandoffConformanceRecord
    ) => { record.system_code_ref.id = "missing-system-code"; },
    "paper_trading_handoff_conformance_reference_not_found"],
    ["missing ExperimentRun", async (
      record: PaperTradingHandoffConformanceRecord
    ) => { record.experiment_run_ref.id = "missing-experiment-run"; },
    "paper_trading_handoff_conformance_reference_not_found"],
    ["SystemCode digest mismatch", async (
      record: PaperTradingHandoffConformanceRecord
    ) => { record.system_code_artifact_digest = "sha256:other-artifact"; },
    "paper_trading_handoff_conformance_reference_mismatch"],
    ["cross-SystemCode ExperimentRun", async (
      record: PaperTradingHandoffConformanceRecord,
      graph: PersistedGraph
    ) => {
      const other = systemCodeFixture("paper-handoff-other-system-code", "sha256:other");
      await graph.store.recordSystemCode(other);
      record.system_code_ref.id = other.system_code_id;
      record.system_code_artifact_digest = other.artifact_digest;
    }, "paper_trading_handoff_conformance_reference_mismatch"],
    ["evaluation task mismatch", async (
      record: PaperTradingHandoffConformanceRecord
    ) => { record.trading_evaluation_task_ref.id = "other-evaluation-task"; },
    "paper_trading_handoff_conformance_reference_mismatch"]
  ])("rejects %s", async (_label, mutate, expectedCode) => {
    const graph = await persistedGraph(store);
    const record = conformanceFixture(graph.systemCode, graph.experiment);
    await mutate(record, graph);
    record.evidence_digest = conformanceDigest(record);

    await expect(store.recordPaperTradingHandoffConformance(record)).rejects.toMatchObject({
      code: expectedCode
    });
  });

  it("requires admission conformance ref, digest, status, SystemCode, ExperimentRun, and task to match", async () => {
    const graph = await persistedGraph(store);
    const conformance = conformanceFixture(graph.systemCode, graph.experiment);
    await store.recordPaperTradingHandoffConformance(conformance);
    const baseline = boundAdmission(graph.admission, conformance);
    await expect(store.recordCandidateAdmissionDecision(baseline)).resolves.toEqual(baseline);

    const mutations: Array<{
      label: string;
      mutate(record: CandidateAdmissionDecisionRecord): void;
      code: string;
    }> = [
      {
        label: "missing conformance",
        mutate: (record) => {
          record.candidate_admission_decision_id += "-missing";
          record.paper_trading_handoff_conformance_ref!.id = "missing-conformance";
        },
        code: "candidate_admission_reference_not_found"
      },
      {
        label: "digest mismatch",
        mutate: (record) => {
          record.candidate_admission_decision_id += "-digest";
          record.paper_trading_handoff_conformance_digest = "sha256:other";
        },
        code: "candidate_admission_reference_mismatch"
      },
      {
        label: "status mismatch",
        mutate: (record) => {
          record.candidate_admission_decision_id += "-status";
          record.paper_handoff_conformance_status = "rejected";
          Object.assign(record, decideCandidateAdmission(record));
        },
        code: "candidate_admission_reference_mismatch"
      }
    ];
    for (const mutation of mutations) {
      const changed = structuredClone(baseline);
      mutation.mutate(changed);
      await expect(store.recordCandidateAdmissionDecision(changed), mutation.label)
        .rejects.toMatchObject({ code: mutation.code });
    }
  });
});

interface PersistedGraph {
  store: LocalStore;
  systemCode: SystemCodeRecord;
  experiment: ExperimentRunRecord;
  admission: CandidateAdmissionDecisionRecord;
}

async function persistedGraph(store: LocalStore): Promise<PersistedGraph> {
  const sourceSystemCode = systemCodeFixture(
    "paper-handoff-source-system-code",
    "sha256:paper-handoff-source"
  );
  const systemCode = systemCodeFixture(
    "paper-handoff-system-code",
    "sha256:paper-handoff-submitted"
  );
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "paper-handoff-experiment-run",
    research_worker_ref: { record_kind: "research_worker", id: "research-worker-trend" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-trend"
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    trace_ref: { record_kind: "trace_placeholder", id: "paper-handoff-trace" },
    submitted_at: "2026-07-12T09:59:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "paper-handoff-evaluation-result",
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: { record_kind: "external_evaluator", id: "paper-handoff-evaluator" },
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
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: "paper-handoff-evaluator-trace"
    },
    completed_at: "2026-07-12T10:02:00.000Z",
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: "paper-handoff-finding",
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "Paper handoff test graph accepted.",
    supporting_record_refs: [],
    created_at: "2026-07-12T10:02:01.000Z",
    authority_status: "research_trace_only"
  };
  const admissionInput = {
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted"
  } as const;
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: "paper-handoff-legacy-admission",
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    research_finding_ref: { record_kind: "research_finding", id: finding.research_finding_id },
    source_artifact_digest: sourceSystemCode.artifact_digest,
    submitted_artifact_digest: systemCode.artifact_digest,
    ...admissionInput,
    ...decideCandidateAdmission(admissionInput),
    decided_at: "2026-07-12T10:02:02.000Z"
  };
  await store.recordSystemCode(sourceSystemCode);
  await store.recordSystemCode(systemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  await store.recordCandidateAdmissionDecision(admission);
  return { store, systemCode, experiment, admission };
}

function conformanceFixture(
  systemCode: SystemCodeRecord,
  experiment: ExperimentRunRecord,
  options: {
    id?: string;
    started_at?: string;
    completed_at?: string;
  } = {}
): PaperTradingHandoffConformanceRecord {
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id:
      options.id ?? "paper-handoff-conformance-fixture",
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: experiment.experiment_run_id
    },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "hold",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: options.started_at ?? "2026-07-12T10:00:00.000Z",
    completed_at: options.completed_at ?? "2026-07-12T10:00:01.000Z",
    evidence_digest: "pending",
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.evidence_digest = conformanceDigest(record);
  return record;
}

function boundAdmission(
  source: CandidateAdmissionDecisionRecord,
  conformance: PaperTradingHandoffConformanceRecord
): CandidateAdmissionDecisionRecord {
  const record: CandidateAdmissionDecisionRecord = {
    ...structuredClone(source),
    candidate_admission_decision_id: "candidate-admission-paper-handoff-bound",
    paper_handoff_conformance_status: conformance.status,
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: conformance.paper_trading_handoff_conformance_id
    },
    paper_trading_handoff_conformance_digest: conformance.evidence_digest
  };
  return { ...record, ...decideCandidateAdmission(record) };
}

function systemCodeFixture(id: string, artifactDigest: string): SystemCodeRecord {
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
    created_at: "2026-07-12T09:00:00.000Z",
    authority_status: "not_live"
  };
}

function conformanceDigest(record: PaperTradingHandoffConformanceRecord): string {
  return "sha256:" + createHash("sha256")
    .update(paperTradingHandoffConformanceDigestInput(record))
    .digest("hex");
}
