import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  qualifyPaperTradingEvaluation,
  paperTradingEvidenceIntegrityReasons
} from "./qualification";
import { decidePaperTradingQualification } from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentDigest } from "./commitment";

describe("application paper qualification compatibility", () => {
  it("exports the domain qualification baseline and treats a missing commitment as integrity failure", () => {
    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY.minObservationCount).toBe(30);
    expect(paperTradingEvidenceIntegrityReasons({
      evaluation: {} as never,
      observations: []
    })).toEqual(["paper_evaluation_commitment_missing"]);
  });

  it("delegates verified qualification and rejects a stale commitment digest", () => {
    const fixture = qualificationFixture();
    const input = { ...fixture, runnerActive: false, policy: { minObservationCount: 1, minElapsedMs: 0 } };

    expect(qualifyPaperTradingEvaluation(input)).toEqual(decidePaperTradingQualification({
      ...input,
      commitmentDigestVerified: true
    }));

    fixture.commitment.data_identity.market_data_configuration_digest = "sha256:stale";
    expect(qualifyPaperTradingEvaluation(input)).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"]
    });
  });
});

function qualificationFixture(): any {
  const account = { wallet_balance_usdt: "10000", available_balance_usdt: "10000", equity_usdt: "10000", realized_pnl_usdt: "0", unrealized_pnl_usdt: "0", fee_paid_usdt: "0", slippage_paid_usdt: "0", funding_paid_usdt: "0", margin_reserved_usdt: "0", position: { symbol: "BTCUSDT", quantity: "0", side: "flat", mark_price: "0", notional_usdt: "0" }, open_order_count: 0, authority_status: "not_live" } as const;
  const score = { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 };
  const draft = { record_kind: "paper_trading_evaluation_commitment", version: 1, paper_trading_evaluation_commitment_id: "commitment", evidence_purpose: "qualification", candidate_ref: { record_kind: "trading_system_candidate", id: "candidate" }, candidate_version_ref: { record_kind: "candidate_version", id: "version" }, trading_run_ref: { record_kind: "trading_run", id: "run" }, system_code_ref: { record_kind: "system_code", id: "code" }, system_code_artifact_digest: "sha256:code", resolved_artifact_digest: "sha256:resolved", runtime_identity: { artifact_kind: "python_file", runtime_kind: "python", entrypoint: ["python3", "run.py"] }, provider_identity: { runtime_provider_kind: "none", qualification_eligible: true }, capability_policy_ref: { record_kind: "capability_policy", id: "policy" }, secret_policy_ref: { record_kind: "secret_policy", id: "policy" }, policy_identity: { market_data_policy_version: "market", gateway_policy_version: "gateway", cost_policy_version: "cost", funding_policy_version: "funding", slippage_policy_version: "slippage", fill_policy_version: "fill", risk_policy_version: "risk", paper_account_policy_version: "account", decision_event_protocol_version: "decision", persistent_state_boundary_version: "state" }, data_identity: { symbol: "BTCUSDT", market_data_port: "gateway_owned", allowed_market_data_source: "binance_production_public_rest", market_data_configuration_digest: "sha256:market", private_exchange_access: "forbidden", live_order_access: "forbidden" }, window_policy: { interval_ms: 60_000, release_policy: "sealed_until_adjudication", eligibility_policy_version: "v1" }, initial_account_snapshot: account, committed_at: "2026-07-09T22:00:00.000Z", commitment_digest: "", authority_status: "not_live" } as any;
  const commitment = { ...draft, commitment_digest: paperTradingEvaluationCommitmentDigest(draft) };
  const evaluation = { record_kind: "paper_trading_evaluation", version: 1, paper_trading_evaluation_id: "evaluation", candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref, trading_run_ref: commitment.trading_run_ref, paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id }, status: "stopped", interval_ms: 60_000, observation_count: 1, started_at: "2026-07-09T22:00:00.000Z", last_observed_at: "2026-07-09T22:01:00.000Z", stopped_at: "2026-07-09T22:01:00.000Z", latest_score: score, paper_account_snapshot: account, open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], authority_status: "not_live" } as any;
  const observations = [{ record_kind: "paper_trading_observation", version: 1, paper_trading_observation_id: "observation", paper_trading_evaluation_ref: { record_kind: evaluation.record_kind, id: evaluation.paper_trading_evaluation_id }, paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id }, candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref, trading_run_ref: commitment.trading_run_ref, sequence: 1, status: "no_order", observed_at: "2026-07-09T22:01:00.000Z", market_snapshot: { symbol: "BTCUSDT", price: 60_000, observed_at: "2026-07-09T22:01:00.000Z", source_kind: "binance_production_public_rest", authority_status: "read_only" }, paper_account_snapshot: account, open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], score_delta: score, cumulative_score: score, authority_status: "not_live" }] as any;
  return { commitment, evaluation, observations };
}
