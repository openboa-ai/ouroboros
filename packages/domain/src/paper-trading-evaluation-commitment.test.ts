import { describe, expect, it } from "vitest";
import {
  paperTradingEvaluationCommitmentDigestInput,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvidencePurpose
} from "./index";

describe("PaperTradingEvaluationCommitment", () => {
  it("produces the same digest input for equivalent object key order", () => {
    const left = commitment("research_feedback");
    const right = Object.fromEntries(
      Object.entries(left).reverse()
    ) as unknown as PaperTradingEvaluationCommitmentRecord;

    expect(paperTradingEvaluationCommitmentDigestInput(left))
      .toBe(paperTradingEvaluationCommitmentDigestInput(right));
  });

  it("binds evidence purpose into the digest input", () => {
    expect(paperTradingEvaluationCommitmentDigestInput(commitment("research_feedback")))
      .not.toBe(paperTradingEvaluationCommitmentDigestInput(commitment("qualification")));
  });

  it("excludes record metadata and commit time from the digest input", () => {
    const left = commitment("research_feedback");
    const right = {
      ...left,
      version: 2,
      paper_trading_evaluation_commitment_id: "paper-commitment-another-id",
      committed_at: "2026-07-10T09:30:00.000Z",
      commitment_digest: "sha256:another-derived-value"
    } as unknown as PaperTradingEvaluationCommitmentRecord;

    expect(paperTradingEvaluationCommitmentDigestInput(left))
      .toBe(paperTradingEvaluationCommitmentDigestInput(right));
  });

  it("rejects non-finite canonical values", () => {
    const invalid = commitment("research_feedback") as unknown as Record<string, unknown>;
    invalid.invalid_value = Number.NaN;

    expect(() => paperTradingEvaluationCommitmentDigestInput(
      invalid as unknown as PaperTradingEvaluationCommitmentRecord
    )).toThrow("paper_trading_commitment_non_canonical_value");
  });

  it("rejects undefined canonical values", () => {
    const invalid = commitment("research_feedback") as unknown as Record<string, unknown>;
    invalid.invalid_value = undefined;

    expect(() => paperTradingEvaluationCommitmentDigestInput(
      invalid as unknown as PaperTradingEvaluationCommitmentRecord
    )).toThrow("paper_trading_commitment_non_canonical_value");
  });
});

function commitment(
  evidencePurpose: PaperTradingEvidencePurpose
): PaperTradingEvaluationCommitmentRecord {
  return {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "paper-commitment-candidate-001",
    evidence_purpose: evidencePurpose,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-001"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "candidate-version-001"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: "system-code-001"
    },
    system_code_artifact_digest: "sha256:stored-system-code-digest",
    resolved_artifact_digest: "sha256:resolved-system-code-digest",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "/tmp/candidate.py"],
      artifact_runtime_contract_ref: {
        record_kind: "artifact_runtime_contract",
        id: "artifact-runtime-contract-001"
      }
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    policy_identity: {
      market_data_policy_version: "binance-public-market-v1",
      gateway_policy_version: "paper-gateway-dry-run-v1",
      cost_policy_version: "paper-cost-8bps-v1",
      funding_policy_version: "paper-funding-engine-v1",
      slippage_policy_version: "paper-public-fill-slippage-v1",
      fill_policy_version: "paper-public-execution-fill-v1",
      risk_policy_version: "paper-risk-validation-v1",
      paper_account_policy_version: "fake-paper-account-10000usdt-v1",
      decision_event_protocol_version: "trading-system-paper-events-v1",
      persistent_state_boundary_version: "paper-engine-checkpoint-v1"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_hybrid",
      market_data_configuration_digest: "sha256:market-data-configuration",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: evidencePurpose === "research_feedback"
        ? "closed_observation"
        : "sealed_until_adjudication",
      eligibility_policy_version: "paper-evidence-eligibility-v1"
    },
    initial_account_snapshot: {
      wallet_balance_usdt: "10000",
      available_balance_usdt: "10000",
      equity_usdt: "10000",
      realized_pnl_usdt: "0",
      unrealized_pnl_usdt: "0",
      fee_paid_usdt: "0",
      slippage_paid_usdt: "0",
      funding_paid_usdt: "0",
      margin_reserved_usdt: "0",
      position: {
        symbol: "BTCUSDT",
        quantity: "0",
        side: "flat",
        mark_price: "0",
        notional_usdt: "0"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
    committed_at: "2026-07-10T09:00:00.000Z",
    commitment_digest: "sha256:derived-value",
    authority_status: "not_live"
  };
}
