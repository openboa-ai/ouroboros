import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape,
  type ResearchPreflightCommitmentRecord,
  type TradingEvaluationResultRecord
} from "./index";

describe("ResearchPreflightCommitment", () => {
  it("accepts and canonically hashes the complete pre-effect commitment", () => {
    const record = commitmentFixture();

    expect(researchPreflightCommitmentHasRuntimeShape(record)).toBe(true);
    expect(researchPreflightCommitmentDigestInput(structuredClone(record))).toBe(
      researchPreflightCommitmentDigestInput(record)
    );
    expect(researchPreflightCommitmentDigestInput({
      ...record,
      sealed_admission_policy: { ...record.sealed_admission_policy },
      development_policy: { ...record.development_policy }
    })).toBe(researchPreflightCommitmentDigestInput(record));
  });

  it("freezes identity, allocation, policies, budgets, time, and authority in digest input", () => {
    const baseline = commitmentFixture();
    const digestInput = researchPreflightCommitmentDigestInput(baseline);
    const mutations: Array<(record: ResearchPreflightCommitmentRecord) => void> = [
      (record) => { record.candidate_arena_tick_id = "tick-other"; },
      (record) => { record.research_direction_ref.id = "direction-other"; },
      (record) => { record.research_worker_ref.id = "worker-other"; },
      (record) => { record.research_allocation_ref.id = "allocation-other"; },
      (record) => { record.research_allocation_digest = digest("allocation-other"); },
      (record) => { record.source_system_code_ref.id = "source-code-other"; },
      (record) => { record.source_artifact_digest = digest("source-other"); },
      (record) => {
        record.development_policy.suite_version =
          "other" as typeof record.development_policy.suite_version;
      },
      (record) => { record.development_policy.suite_digest = digest("development-other"); },
      (record) => { record.development_policy.submission_limit = 1; },
      (record) => {
        record.development_policy.feedback_release =
          "other" as typeof record.development_policy.feedback_release;
      },
      (record) => {
        record.sealed_admission_policy.suite_version =
          "other" as typeof record.sealed_admission_policy.suite_version;
      },
      (record) => {
        record.sealed_admission_policy.generator_version =
          "other" as typeof record.sealed_admission_policy.generator_version;
      },
      (record) => {
        record.sealed_admission_policy.rotation_commitment_digest = digest("rotation-other");
      },
      (record) => {
        record.sealed_admission_policy.suite_digest = digest("sealed-other");
      },
      (record) => {
        record.sealed_admission_policy.submission_limit =
          2 as typeof record.sealed_admission_policy.submission_limit;
      },
      (record) => {
        record.sealed_admission_policy.feedback_release =
          "other" as typeof record.sealed_admission_policy.feedback_release;
      },
      (record) => { record.committed_at = "2026-07-12T11:00:00.000Z"; },
      (record) => { record.research_preflight_authority = false as true; },
      (record) => { record.admission_authority = true as false; },
      (record) => { record.promotion_authority = true as false; },
      (record) => { record.order_submission_authority = true as false; },
      (record) => { record.live_exchange_authority = true as false; },
      (record) => { record.authority_status = "research_only" as "not_live"; }
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(researchPreflightCommitmentDigestInput(changed)).not.toBe(digestInput);
    }
  });

  it.each([
    ["wrong record kind", (record: any) => { record.record_kind = "other"; }],
    ["empty tick", (record: any) => { record.candidate_arena_tick_id = ""; }],
    ["wrong direction ref", (record: any) => {
      record.research_direction_ref.record_kind = "research_worker";
    }],
    ["wrong worker ref", (record: any) => {
      record.research_worker_ref.record_kind = "research_direction";
    }],
    ["wrong allocation ref", (record: any) => {
      record.research_allocation_ref.record_kind = "candidate_arena_tick";
    }],
    ["wrong source ref", (record: any) => {
      record.source_system_code_ref.record_kind = "trading_system_candidate";
    }],
    ["invalid allocation digest", (record: any) => {
      record.research_allocation_digest = "sha256:not-hex";
    }],
    ["invalid source digest", (record: any) => {
      record.source_artifact_digest = "";
    }],
    ["unknown development suite", (record: any) => {
      record.development_policy.suite_version = "development_v2";
    }],
    ["empty development suite digest", (record: any) => {
      record.development_policy.suite_digest = "";
    }],
    ["zero development budget", (record: any) => {
      record.development_policy.submission_limit = 0;
    }],
    ["excess development budget", (record: any) => {
      record.development_policy.submission_limit = 3;
    }],
    ["development release drift", (record: any) => {
      record.development_policy.feedback_release = "terminal_after_freeze";
    }],
    ["unknown sealed suite", (record: any) => {
      record.sealed_admission_policy.suite_version = "sealed_v2";
    }],
    ["unknown generator", (record: any) => {
      record.sealed_admission_policy.generator_version = "generator_v2";
    }],
    ["invalid seed commitment", (record: any) => {
      record.sealed_admission_policy.rotation_commitment_digest = "seed-visible";
    }],
    ["empty sealed suite digest", (record: any) => {
      record.sealed_admission_policy.suite_digest = "";
    }],
    ["same development and sealed suite", (record: any) => {
      record.sealed_admission_policy.suite_digest = record.development_policy.suite_digest;
    }],
    ["extra sealed submission", (record: any) => {
      record.sealed_admission_policy.submission_limit = 2;
    }],
    ["sealed release drift", (record: any) => {
      record.sealed_admission_policy.feedback_release = "aggregate_after_each_submission";
    }],
    ["non-canonical time", (record: any) => {
      record.committed_at = "2026-07-12 10:00:00";
    }],
    ["invalid commitment digest", (record: any) => {
      record.commitment_digest = "pending";
    }],
    ["raw seed leakage", (record: any) => {
      record.sealed_admission_policy.rotation_seed = "00".repeat(32);
    }],
    ["research authority removed", (record: any) => {
      record.research_preflight_authority = false;
    }],
    ["admission authority", (record: any) => { record.admission_authority = true; }],
    ["promotion authority", (record: any) => { record.promotion_authority = true; }],
    ["order authority", (record: any) => { record.order_submission_authority = true; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; }],
    ["wrong authority status", (record: any) => {
      record.authority_status = "research_only";
    }]
  ])("rejects invalid %s", (_label, mutate) => {
    const record = commitmentFixture() as any;
    mutate(record);
    expect(researchPreflightCommitmentHasRuntimeShape(record)).toBe(false);
  });
});

describe("TradingEvaluationResult ResearchPreflight linkage", () => {
  it("accepts historical records without linkage and complete sealed admission linkage", () => {
    const historical = evaluationFixture();
    const sealed = sealedEvaluationFixture();

    expect(tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(historical)).toBe(true);
    expect(tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(sealed)).toBe(true);
  });

  it.each([
    ["commitment ref", (record: any) => { delete record.research_preflight_commitment_ref; }],
    ["commitment digest", (record: any) => { delete record.research_preflight_commitment_digest; }],
    ["SystemCode ref", (record: any) => { delete record.submitted_system_code_ref; }],
    ["artifact digest", (record: any) => { delete record.submitted_artifact_digest; }],
    ["suite digest", (record: any) => { delete record.sealed_admission_suite_digest; }],
    ["phase", (record: any) => { delete record.evaluation_phase; }],
    ["sequence", (record: any) => { delete record.submission_sequence; }],
    ["wrong commitment ref", (record: any) => {
      record.research_preflight_commitment_ref.record_kind = "paper_trading_evaluation_commitment";
    }],
    ["invalid commitment digest", (record: any) => {
      record.research_preflight_commitment_digest = "sha256:short";
    }],
    ["wrong SystemCode ref", (record: any) => {
      record.submitted_system_code_ref.record_kind = "candidate_version";
    }],
    ["invalid artifact digest", (record: any) => {
      record.submitted_artifact_digest = "";
    }],
    ["invalid suite digest", (record: any) => {
      record.sealed_admission_suite_digest = "suite";
    }],
    ["development phase", (record: any) => {
      record.evaluation_phase = "development";
    }],
    ["second submission", (record: any) => { record.submission_sequence = 2; }]
  ])("rejects incomplete or invalid %s", (_label, mutate) => {
    const record = sealedEvaluationFixture() as any;
    mutate(record);
    expect(tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(record)).toBe(false);
  });
});

function commitmentFixture(): ResearchPreflightCommitmentRecord {
  return {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: "preflight-tick-7-trend-following",
    candidate_arena_tick_id: "tick-7",
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-trend-following"
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: "research-worker-trend-following"
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-tick-7"
    },
    research_allocation_digest: digest("allocation-tick-7"),
    source_system_code_ref: { record_kind: "system_code", id: "source-system-code" },
    source_artifact_digest: digest("source-system-code"),
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest("development-suite"),
      submission_limit: 2,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest("rotation-seed"),
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
    commitment_digest: digest("commitment")
  };
}

function sealedEvaluationFixture(): TradingEvaluationResultRecord {
  return {
    ...evaluationFixture(),
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: "preflight-tick-7-trend-following"
    },
    research_preflight_commitment_digest: digest("commitment"),
    submitted_system_code_ref: { record_kind: "system_code", id: "submitted-system-code" },
    submitted_artifact_digest: digest("submitted-system-code"),
    sealed_admission_suite_digest: digest("sealed-suite"),
    evaluation_phase: "sealed_admission",
    submission_sequence: 1
  };
}

function evaluationFixture(): TradingEvaluationResultRecord {
  return {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "trading-evaluation-result-tick-7",
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-tick-7" },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    evaluator_ref: { record_kind: "external_evaluator", id: "sealed-admission-evaluator-v1" },
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
    evaluator_trace_ref: { record_kind: "trace_placeholder", id: "trace-tick-7" },
    completed_at: "2026-07-12T10:00:01.000Z",
    authority_status: "not_counted"
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
