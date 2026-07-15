import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonQualificationResultDigestInput,
  paperTradingComparisonVerdictDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonVerdictRecord
} from "./index";

describe("paper trading comparison verdict evidence", () => {
  it("accepts qualified improved and not-improved verdicts", () => {
    const improved = verdictFixture("challenger_improved");
    const notImproved = verdictFixture("challenger_not_improved");

    expect(paperTradingComparisonVerdictHasRuntimeShape(improved)).toBe(true);
    expect(paperTradingComparisonVerdictHasRuntimeShape(notImproved)).toBe(true);
  });

  it("accepts a settled ineligible verdict without economic fields", () => {
    const verdict = verdictFixture("comparison_ineligible");

    expect(paperTradingComparisonVerdictHasRuntimeShape(verdict)).toBe(true);
    expect(verdict.metric).toBeUndefined();
    expect(verdict.champion.net_revenue_usdt).toBeUndefined();
    expect(verdict.challenger.cost_usdt).toBeUndefined();
  });

  it("uses canonical qualification and verdict digest payloads", () => {
    const verdict = verdictFixture("challenger_improved");
    const {
      record_kind: _recordKind,
      version: _version,
      paper_trading_comparison_verdict_id: _id,
      verdict_digest: _digest,
      ...payload
    } = verdict;

    expect(paperTradingComparisonVerdictDigestInput(verdict)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(payload)
    );
    expect(paperTradingComparisonQualificationResultDigestInput(
      verdict.pair_qualification
    )).toBe(paperTradingComparisonPersistedRecordDigestInput(
      verdict.pair_qualification
    ));
  });

  it.each([
    ["qualification identity drift", (value: any) => {
      value.pair_qualification.activation_id = "activation-other";
    }],
    ["missing exact side ref", (value: any) => {
      value.champion.trading_run_ref = undefined;
    }],
    ["non-finite score", (value: any) => {
      value.challenger.net_revenue_usdt = Number.NaN;
    }],
    ["metric arithmetic drift", (value: any) => {
      value.metric.observed_lift_usdt += 1;
    }],
    ["score-bearing ineligible record", (value: any) => {
      value.champion.net_revenue_usdt = 0;
    }],
    ["score-less qualified record", (value: any) => {
      delete value.champion.cost_usdt;
    }],
    ["wrong improved next action", (value: any) => {
      value.next_action = "return_to_candidate_arena";
    }],
    ["promotion eligibility", (value: any) => {
      value.promotion_eligibility = "eligible";
    }],
    ["released evidence", (value: any) => {
      value.release_status = "released";
    }],
    ["post-hoc confirmation field", (value: any) => {
      value.confirmation_count = 1;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }],
    ["checkpoint cardinality mismatch", (value: any) => {
      value.checkpoint_outcome_digests.pop();
    }],
    ["duplicate checkpoint ref", (value: any) => {
      value.checkpoint_outcome_refs[1] = { ...value.checkpoint_outcome_refs[0] };
    }],
    ["non-canonical evaluation time", (value: any) => {
      value.evaluated_at = "2026-07-12 02:00:00";
    }]
  ])("rejects %s", (_label, mutate) => {
    const verdict = verdictFixture(
      _label.includes("ineligible") ? "comparison_ineligible" : "challenger_improved"
    ) as any;
    mutate(verdict);

    expect(paperTradingComparisonVerdictHasRuntimeShape(verdict)).toBe(false);
  });
});

function verdictFixture(
  outcome: PaperTradingComparisonVerdictRecord["verdict_outcome"]
): PaperTradingComparisonVerdictRecord {
  const ineligible = outcome === "comparison_ineligible";
  const improved = outcome === "challenger_improved";
  const qualification = {
    comparison_id: "comparison-001",
    activation_id: "activation-001",
    activation_attempt_id: "activation-attempt-001",
    qualification_status: ineligible ? "not_qualified" as const : "qualified" as const,
    qualification_reasons: ineligible
      ? ["comparison_minimum_observation_count_not_met" as const]
      : [],
    checkpoint_count: 3,
    champion: sideQualification(ineligible),
    challenger: sideQualification(ineligible),
    authority_status: "not_verdict" as const
  };
  const side = (role: "champion" | "challenger") => ({
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_artifact_digest: `sha256:${role}-code`,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_commitment_record_digest: `sha256:${role}-commitment-record`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:${role}-evaluation-record`,
    paper_trading_observation_chain_digest: `sha256:${role}-observations`,
    ...(!ineligible ? {
      net_revenue_usdt: role === "challenger" && improved ? 10 : 0,
      cost_usdt: role === "challenger" && improved ? 2 : 0
    } : {})
  });
  const metric = !ineligible ? {
    metric_kind: "net_revenue_usdt" as const,
    champion_value_usdt: 0,
    challenger_value_usdt: improved ? 10 : 0,
    observed_lift_usdt: improved ? 10 : 0,
    minimum_lift_usdt: 10
  } : undefined;
  return {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: "verdict-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: qualification.comparison_id
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: qualification.activation_id
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: qualification.activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:attempt",
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "activation-outcome-stopped"
    },
    final_activation_outcome_digest: "sha256:activation-outcome",
    latest_tick_ref: { record_kind: "paper_trading_comparison_tick", id: "tick-3" },
    latest_tick_digest: "sha256:tick-3",
    checkpoint_outcome_refs: [1, 2, 3].map((sequence) => ({
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: `checkpoint-outcome-${sequence}`
    })),
    checkpoint_outcome_digests: [1, 2, 3].map((sequence) =>
      `sha256:checkpoint-outcome-${sequence}`),
    pair_qualification: qualification,
    pair_qualification_digest:
      `sha256:${paperTradingComparisonQualificationResultDigestInput(qualification)}`,
    champion: side("champion"),
    challenger: side("challenger"),
    ...(metric ? { metric } : {}),
    verdict_outcome: outcome,
    window_started_at: "2026-07-12T00:00:00.000Z",
    window_ended_at: "2026-07-12T00:02:00.000Z",
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: improved
      ? "requires_precommitted_campaign"
      : "not_applicable",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: improved
      ? "precommit_confirmation_campaign"
      : ineligible
        ? "repair_evidence_or_rerun_comparison"
        : "return_to_candidate_arena",
    evaluated_at: "2026-07-12T02:00:00.000Z",
    verdict_digest: "sha256:verdict",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function sideQualification(ineligible: boolean) {
  return {
    qualification_status: ineligible ? "collecting_evidence" as const : "qualified" as const,
    qualification_reasons: ineligible
      ? ["min_observation_count_not_met" as const]
      : [],
    evidence_window: {
      observation_count: ineligible ? 2 : 3,
      elapsed_ms: ineligible ? 60_000 : 120_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T00:00:00.000Z",
      last_observed_at: "2026-07-12T00:02:00.000Z"
    }
  };
}
