import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  decidePaperTradingQualification,
  paperTradingComparisonCandidateVersionPairKey,
  paperTradingComparisonPersistedRecordDigestInput,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord
} from "./index";

describe("PaperTradingComparisonCommitment", () => {
  it("canonically digests persisted records and creates unordered candidate pairs", () => {
    expect(paperTradingComparisonPersistedRecordDigestInput({ b: 2, a: 1, omitted: undefined }))
      .toBe(paperTradingComparisonPersistedRecordDigestInput({ a: 1, b: 2 }));
    expect(paperTradingComparisonCandidateVersionPairKey("version-b", "version-a"))
      .toBe(paperTradingComparisonCandidateVersionPairKey("version-a", "version-b"));
    expect(() => paperTradingComparisonPersistedRecordDigestInput({ values: [undefined] }))
      .toThrow("paper_trading_comparison_non_persistable_record");
  });

  it("makes qualification decisions in the domain", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);

    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY).toEqual({
      minObservationCount: 30,
      minElapsedMs: 1_800_000,
      maxFailedObservationRatio: 0.1,
      assessRunnerHealth: true
    });
    expect(decidePaperTradingQualification({
      evaluation,
      commitment,
      observations,
      commitmentDigestVerified: true,
      runnerActive: false
    })).toMatchObject({ qualification_status: "qualified", qualification_reasons: [] });
  });
});

function qualificationCommitment(): PaperTradingEvaluationCommitmentRecord {
  return {
    record_kind: "paper_trading_evaluation_commitment", version: 1,
    paper_trading_evaluation_commitment_id: "commitment", evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate" },
    candidate_version_ref: { record_kind: "candidate_version", id: "version" },
    trading_run_ref: { record_kind: "trading_run", id: "run" },
    system_code_ref: { record_kind: "system_code", id: "code" },
    system_code_artifact_digest: "sha256:code", resolved_artifact_digest: "sha256:resolved",
    runtime_identity: { artifact_kind: "python_file", runtime_kind: "python", entrypoint: ["python3", "run.py"] },
    provider_identity: { runtime_provider_kind: "none", qualification_eligible: true },
    capability_policy_ref: { record_kind: "capability_policy", id: "policy" },
    secret_policy_ref: { record_kind: "secret_policy", id: "policy" },
    policy_identity: { market_data_policy_version: "market", gateway_policy_version: "gateway", cost_policy_version: "cost", funding_policy_version: "funding", slippage_policy_version: "slippage", fill_policy_version: "fill", risk_policy_version: "risk", paper_account_policy_version: "account", decision_event_protocol_version: "decision", persistent_state_boundary_version: "state" },
    data_identity: { symbol: "BTCUSDT", market_data_port: "gateway_owned", allowed_market_data_source: "binance_production_public_rest", market_data_configuration_digest: "sha256:market", private_exchange_access: "forbidden", live_order_access: "forbidden" },
    window_policy: { interval_ms: 60_000, release_policy: "sealed_until_adjudication", eligibility_policy_version: "v1" },
    initial_account_snapshot: account(), committed_at: "2026-07-09T22:00:00.000Z",
    commitment_digest: "sha256:verified", authority_status: "not_live"
  };
}

function qualificationEvaluation(commitment: PaperTradingEvaluationCommitmentRecord): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation", version: 1, paper_trading_evaluation_id: "evaluation",
    candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id },
    status: "stopped", interval_ms: 60_000, observation_count: 30,
    started_at: "2026-07-09T22:00:00.000Z", last_observed_at: "2026-07-09T22:30:00.000Z", stopped_at: "2026-07-09T22:30:00.000Z",
    latest_score: score(), paper_account_snapshot: account(), open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], authority_status: "not_live"
  };
}

function qualificationObservations(commitment: PaperTradingEvaluationCommitmentRecord, evaluation: PaperTradingEvaluationRecord): PaperTradingObservationRecord[] {
  return Array.from({ length: 30 }, (_, index) => ({
    record_kind: "paper_trading_observation", version: 1, paper_trading_observation_id: `observation-${index + 1}`,
    paper_trading_evaluation_ref: { record_kind: evaluation.record_kind, id: evaluation.paper_trading_evaluation_id },
    paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id },
    candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref, trading_run_ref: commitment.trading_run_ref,
    sequence: index + 1, status: "no_order", observed_at: `2026-07-09T22:${String(index + 1).padStart(2, "0")}:00.000Z`,
    market_snapshot: { symbol: "BTCUSDT", price: 60_000, observed_at: `2026-07-09T22:${String(index + 1).padStart(2, "0")}:00.000Z`, source_kind: "binance_production_public_rest", authority_status: "read_only" },
    paper_account_snapshot: account(), open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], score_delta: score(), cumulative_score: score(), authority_status: "not_live"
  }));
}

function account() {
  return { wallet_balance_usdt: "10000", available_balance_usdt: "10000", equity_usdt: "10000", realized_pnl_usdt: "0", unrealized_pnl_usdt: "0", fee_paid_usdt: "0", slippage_paid_usdt: "0", funding_paid_usdt: "0", margin_reserved_usdt: "0", position: { symbol: "BTCUSDT" as const, quantity: "0", side: "flat" as const, mark_price: "0", notional_usdt: "0" }, open_order_count: 0, authority_status: "not_live" as const };
}

function score() {
  return { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 };
}
