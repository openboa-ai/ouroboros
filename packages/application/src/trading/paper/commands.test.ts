import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  decideCandidateAdmission,
  paperTradingHandoffConformanceDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateInspectReadModel,
  type ExperimentRunRecord,
  type PaperTradingHandoffConformanceRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { PaperTradingCommandService } from "./commands";
import type { PaperTradingSessionService } from "./session-service";

describe("PaperTradingCommandService handoff conformance", () => {
  it.each([
    ["missing conformance", "paper_handoff_conformance_missing", (graph: TestGraph) => {
      graph.conformance = undefined;
    }],
    ["rejected conformance", "paper_handoff_conformance_not_passed", (graph: TestGraph) => {
      graph.conformance!.status = "rejected";
      graph.conformance!.reason = "runtime_stop_missing";
      graph.conformance!.runnable_paper_handoff = false;
      graph.conformance!.evidence_digest = conformanceDigest(graph.conformance!);
      graph.admission.paper_handoff_conformance_status = "rejected";
      graph.admission.paper_trading_handoff_conformance_digest =
        graph.conformance!.evidence_digest;
      Object.assign(graph.admission, decideCandidateAdmission(graph.admission));
    }],
    ["malformed conformance", "paper_handoff_conformance_invalid", (graph: TestGraph) => {
      (graph.conformance as any).promotion_authority = true;
    }],
    ["tampered digest", "paper_handoff_conformance_invalid", (graph: TestGraph) => {
      graph.conformance!.evidence_digest = "sha256:tampered";
    }],
    ["wrong SystemCode", "paper_handoff_conformance_system_code_mismatch", (graph: TestGraph) => {
      graph.conformance!.system_code_ref.id = "other-system-code";
      graph.conformance!.evidence_digest = conformanceDigest(graph.conformance!);
      graph.admission.paper_trading_handoff_conformance_digest =
        graph.conformance!.evidence_digest;
    }],
    ["wrong ExperimentRun", "paper_handoff_conformance_experiment_mismatch", (graph: TestGraph) => {
      graph.conformance!.experiment_run_ref.id = "other-experiment-run";
      graph.conformance!.evidence_digest = conformanceDigest(graph.conformance!);
      graph.admission.paper_trading_handoff_conformance_digest =
        graph.conformance!.evidence_digest;
    }],
    ["wrong evaluation task", "paper_handoff_conformance_evaluation_task_mismatch", (graph: TestGraph) => {
      graph.conformance!.trading_evaluation_task_ref.id = "other-evaluation-task";
      graph.conformance!.evidence_digest = conformanceDigest(graph.conformance!);
      graph.admission.paper_trading_handoff_conformance_digest =
        graph.conformance!.evidence_digest;
    }],
    ["non-admitted conformance", "paper_handoff_conformance_not_admitted", (graph: TestGraph) => {
      graph.admission.status = "quarantined";
      graph.admission.reason = "paper_handoff_conformance_failed";
      graph.admission.runnable_paper_handoff = false;
    }]
  ])("rejects %s before any paper effect", async (_label, reason, mutate) => {
    const graph = testGraph();
    mutate(graph);
    const effects = effectSpies();
    const service = commandService(graph, effects);

    await expect(service.start(graph.candidate.candidate_id, {
      runtime_environment: "paper",
      paper_order_request: "valid"
    })).resolves.toMatchObject({
      statusCode: 409,
      body: {
        error: "trading_run_failed",
        reason
      }
    });
    for (const effect of Object.values(effects)) {
      expect(effect).not.toHaveBeenCalled();
    }
  });

  it("does not require generated-candidate evidence for a fixture without materialization", async () => {
    const graph = testGraph();
    graph.candidate.candidate_version.materialization_attempt_ref = undefined;
    graph.candidate.materialization_attempt = undefined;
    const effects = effectSpies();
    effects.prepare.mockRejectedValueOnce(new Error("fixture_reached_session_prepare"));
    const service = commandService(graph, effects, {
      listCandidateAdmissionDecisions: vi.fn(() => {
        throw new Error("fixture must not read arena admission");
      })
    });

    await expect(service.start(graph.candidate.candidate_id, {
      runtime_environment: "paper",
      paper_order_request: "valid"
    })).rejects.toThrow("fixture_reached_session_prepare");
    expect(effects.prepare).toHaveBeenCalledOnce();
  });
});

interface TestGraph {
  candidate: CandidateInspectReadModel;
  admission: CandidateAdmissionDecisionRecord;
  conformance?: PaperTradingHandoffConformanceRecord;
  systemCode: SystemCodeRecord;
  experiment: ExperimentRunRecord;
  evaluation: TradingEvaluationResultRecord;
}

function commandService(
  graph: TestGraph,
  effects: ReturnType<typeof effectSpies>,
  overrides: Record<string, unknown> = {}
): PaperTradingCommandService {
  const store = {
    getCandidate: vi.fn(async () => graph.candidate),
    listCandidateAdmissionDecisions: vi.fn(async () => [graph.admission]),
    getPaperTradingHandoffConformance: vi.fn(async () => graph.conformance),
    getSystemCode: vi.fn(async () => graph.systemCode),
    getExperimentRun: vi.fn(async () => graph.experiment),
    getTradingEvaluationResult: vi.fn(async () => graph.evaluation),
    getLatestPaperTradingEvaluationForTradingRun: vi.fn(async () => undefined),
    ...overrides
  } as unknown as OuroborosStorePort;
  const sessions = {
    active: vi.fn(() => false),
    prepare: effects.prepare,
    activate: effects.activate,
    observe: effects.observe,
    schedule: effects.schedule
  } as unknown as PaperTradingSessionService;
  return new PaperTradingCommandService({
    store,
    marketData: {} as never,
    tradingGatewayEnvironment: {} as never,
    sessions
  });
}

function effectSpies() {
  return {
    prepare: vi.fn(),
    activate: vi.fn(),
    observe: vi.fn(),
    schedule: vi.fn()
  };
}

function testGraph(): TestGraph {
  const systemCode = systemCodeFixture();
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "paper-start-experiment",
    research_worker_ref: { record_kind: "research_worker", id: "worker" },
    research_direction_ref: { record_kind: "research_direction", id: "direction" },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    submitted_at: "2026-07-12T10:00:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "paper-start-evaluation",
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: { record_kind: "external_evaluator", id: "evaluator" },
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
    evaluator_trace_ref: { record_kind: "trace_placeholder", id: "trace" },
    completed_at: "2026-07-12T10:00:02.000Z",
    authority_status: "not_counted"
  };
  const conformance = conformanceFixture(systemCode, experiment);
  const admissionInput = {
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    paper_handoff_conformance_status: "passed"
  } as const;
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: "paper-start-admission",
    source_system_code_ref: { record_kind: "system_code", id: "source-system-code" },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    research_finding_ref: { record_kind: "research_finding", id: "finding" },
    source_artifact_digest: "sha256:source",
    submitted_artifact_digest: systemCode.artifact_digest,
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: conformance.paper_trading_handoff_conformance_id
    },
    paper_trading_handoff_conformance_digest: conformance.evidence_digest,
    ...admissionInput,
    ...decideCandidateAdmission(admissionInput),
    decided_at: "2026-07-12T10:00:03.000Z"
  };
  const candidate = {
    candidate_id: "generated-candidate",
    candidate_version: {
      candidate_version_id: "generated-candidate-version",
      materialization_attempt_ref: {
        record_kind: "candidate_materialization_attempt",
        id: "generated-materialization"
      }
    },
    system_code: {
      ref: { record_kind: "system_code", id: systemCode.system_code_id }
    },
    runtime: {
      ref: { record_kind: "trading_run", id: "generated-trading-run" }
    },
    materialization_attempt: { attempt_id: "generated-materialization" }
  } as unknown as CandidateInspectReadModel;
  return { candidate, admission, conformance, systemCode, experiment, evaluation };
}

function systemCodeFixture(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "generated-system-code",
    artifact_kind: "python_file",
    runtime_kind: "python",
    artifact_path: "/tmp/generated-system-code.py",
    artifact_digest: "sha256:generated-system-code",
    entrypoint: ["python3", "/tmp/generated-system-code.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "research-only" },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-12T09:59:00.000Z",
    authority_status: "not_live"
  };
}

function conformanceFixture(
  systemCode: SystemCodeRecord,
  experiment: ExperimentRunRecord
): PaperTradingHandoffConformanceRecord {
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: "paper-start-conformance",
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "docker_sandboxes_sbx",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "hold",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: "2026-07-12T10:00:00.000Z",
    completed_at: "2026-07-12T10:00:01.000Z",
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

function conformanceDigest(record: PaperTradingHandoffConformanceRecord): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingHandoffConformanceDigestInput(record))
    .digest("hex")}`;
}
