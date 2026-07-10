import { describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationProviderIdentity,
  PaperTradingEvaluationRecord,
  SystemCodeRecord
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import {
  createPaperTradingEvaluationCommitment,
  invalidatePaperTradingEvaluation,
  PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
  verifyPaperTradingEvaluationCommitment
} from "./commitment";

describe("PaperTradingEvaluation commitment service", () => {
  it("creates a purpose-bound research feedback commitment", () => {
    const commitment = createCommitment();

    expect(commitment).toMatchObject({
      record_kind: "paper_trading_evaluation_commitment",
      evidence_purpose: "research_feedback",
      candidate_ref: { id: "candidate-commitment-001" },
      candidate_version_ref: { id: "candidate-version-commitment-001" },
      trading_run_ref: { id: "trading-run-commitment-001" },
      system_code_ref: { id: "system-code-commitment-001" },
      resolved_artifact_digest: "sha256:resolved-artifact-001",
      provider_identity: {
        runtime_provider_kind: "none",
        qualification_eligible: true
      },
      window_policy: {
        interval_ms: 60_000,
        release_policy: "closed_observation",
        eligibility_policy_version: "paper-evidence-eligibility-v1"
      },
      authority_status: "not_live"
    });
    expect(commitment.commitment_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("creates sealed qualification commitments only when explicitly requested internally", () => {
    const commitment = createPaperTradingEvaluationCommitment({
      ...creationInput(),
      evidencePurpose: "qualification"
    });

    expect(commitment).toMatchObject({
      evidence_purpose: "qualification",
      window_policy: {
        release_policy: "sealed_until_adjudication"
      }
    });
  });

  it("verifies an unchanged execution envelope", () => {
    const commitment = createCommitment();

    expect(verifyPaperTradingEvaluationCommitment({
      commitment,
      evaluation: evaluation(commitment),
      candidate: candidate(),
      systemCode: systemCode(),
      resolvedArtifactDigest: "sha256:resolved-artifact-001",
      marketData: marketData(),
      intervalMs: 60_000,
      providerIdentity: providerIdentity(),
      policyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1
    })).toEqual({ status: "verified" });
  });

  it.each([
    {
      label: "candidate identity",
      expected: "candidate_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        candidate: { ...input.candidate, candidate_id: "candidate-changed" }
      })
    },
    {
      label: "candidate version identity",
      expected: "candidate_version_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        candidate: {
          ...input.candidate,
          candidate_version: {
            ...input.candidate.candidate_version,
            candidate_version_id: "candidate-version-changed"
          }
        }
      })
    },
    {
      label: "TradingRun identity",
      expected: "candidate_version_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        candidate: {
          ...input.candidate,
          runtime: {
            ...input.candidate.runtime,
            ref: { record_kind: "trading_run", id: "trading-run-changed" }
          }
        }
      })
    },
    {
      label: "SystemCode identity",
      expected: "system_code_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: { ...input.systemCode, system_code_id: "system-code-changed" }
      })
    },
    {
      label: "stored artifact digest",
      expected: "stored_artifact_digest_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: { ...input.systemCode, artifact_digest: "sha256:stored-artifact-changed" }
      })
    },
    {
      label: "resolved artifact digest",
      expected: "resolved_artifact_digest_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        resolvedArtifactDigest: "sha256:resolved-artifact-changed"
      })
    },
    {
      label: "runtime identity",
      expected: "runtime_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: {
          ...input.systemCode,
          entrypoint: ["python3", "/tmp/changed.py"]
        }
      })
    },
    {
      label: "provider identity",
      expected: "provider_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        providerIdentity: {
          runtime_provider_kind: "managed_agent" as const,
          model: "changed-model",
          qualification_eligible: false,
          ineligibility_reason: "provider_identity_unavailable" as const
        }
      })
    },
    {
      label: "capability policy",
      expected: "capability_policy_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: {
          ...input.systemCode,
          capability_policy_ref: {
            record_kind: "capability_policy",
            id: "capability-policy-changed"
          }
        }
      })
    },
    {
      label: "secret policy",
      expected: "secret_policy_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: {
          ...input.systemCode,
          secret_policy_ref: {
            record_kind: "secret_policy",
            id: "secret-policy-changed"
          }
        }
      })
    },
    {
      label: "evaluation policy",
      expected: "evaluation_policy_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        policyIdentity: {
          ...PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
          risk_policy_version: "paper-risk-validation-changed"
        }
      })
    },
    {
      label: "market data identity",
      expected: "evaluation_policy_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        marketData: {
          ...input.marketData,
          source_kind: "binance_production_public_rest" as const
        }
      })
    },
    {
      label: "window interval",
      expected: "evaluation_policy_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        intervalMs: 30_000
      })
    },
    {
      label: "initial account anchor",
      expected: "initial_account_identity_mismatch",
      mutate: (input: VerificationInput) => ({
        ...input,
        evaluation: {
          ...input.evaluation,
          paper_account_snapshot: {
            ...input.evaluation.paper_account_snapshot!,
            equity_usdt: "9999"
          }
        }
      })
    },
    {
      label: "paper-only authority",
      expected: "paper_only_authority_violation",
      mutate: (input: VerificationInput) => ({
        ...input,
        systemCode: {
          ...input.systemCode,
          authority_status: "live" as "not_live"
        }
      })
    }
  ])("classifies $label drift before evidence", ({ expected, mutate }) => {
    const input = mutate(verificationInput());

    expect(verifyPaperTradingEvaluationCommitment(input)).toMatchObject({
      status: "invalidated",
      reason: expected
    });
  });

  it("detects commitment content tampering before envelope checks", () => {
    const commitment = {
      ...createCommitment(),
      evidence_purpose: "qualification" as const
    };

    expect(verifyPaperTradingEvaluationCommitment({
      ...verificationInput(),
      commitment
    })).toMatchObject({
      status: "invalidated",
      reason: "commitment_digest_mismatch"
    });
  });

  it("converts a verification failure into a terminal evaluation without adding evidence", () => {
    const commitment = createCommitment();
    const original = evaluation(commitment);

    expect(invalidatePaperTradingEvaluation({
      evaluation: original,
      verification: {
        status: "invalidated",
        reason: "resolved_artifact_digest_mismatch",
        diagnostic: "resolved SystemCode artifact bytes changed"
      },
      invalidatedAt: "2026-07-10T09:01:00.000Z"
    })).toEqual({
      ...original,
      status: "invalidated",
      invalidation_reason: "resolved_artifact_digest_mismatch",
      latest_failure_reason: "resolved SystemCode artifact bytes changed",
      next_observation_at: undefined,
      stopped_at: "2026-07-10T09:01:00.000Z"
    });
  });
});

type VerificationInput = Parameters<typeof verifyPaperTradingEvaluationCommitment>[0];

function verificationInput(): VerificationInput {
  const commitment = createCommitment();
  return {
    commitment,
    evaluation: evaluation(commitment),
    candidate: candidate(),
    systemCode: systemCode(),
    resolvedArtifactDigest: "sha256:resolved-artifact-001",
    marketData: marketData(),
    intervalMs: 60_000,
    providerIdentity: providerIdentity(),
    policyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1
  };
}

function createCommitment(): PaperTradingEvaluationCommitmentRecord {
  return createPaperTradingEvaluationCommitment(creationInput());
}

function creationInput(): Parameters<typeof createPaperTradingEvaluationCommitment>[0] {
  return {
    commitmentId: "paper-commitment-001",
    evidencePurpose: "research_feedback",
    candidate: candidate(),
    systemCode: systemCode(),
    resolvedArtifactDigest: "sha256:resolved-artifact-001",
    marketData: marketData(),
    intervalMs: 60_000,
    initialAccountSnapshot: initialAccount(),
    providerIdentity: providerIdentity(),
    policyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
    committedAt: "2026-07-10T09:00:00.000Z"
  };
}

function candidate(): CandidateInspectReadModel {
  return {
    candidate_id: "candidate-commitment-001",
    candidate_version: {
      candidate_version_id: "candidate-version-commitment-001",
      version_label: "v1",
      provenance_refs: []
    },
    runtime: {
      ref: { record_kind: "trading_run", id: "trading-run-commitment-001" },
      status: "registered",
      stage_binding_profile: "paper",
      run_control: {
        available_actions: [],
        authority_status: "not_live"
      }
    },
    system_code: {
      ref: { record_kind: "system_code", id: "system-code-commitment-001" },
      summary: "test SystemCode",
      declared_runtime: "python",
      declared_outputs: ["order_request"]
    }
  } as unknown as CandidateInspectReadModel;
}

function systemCode(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-commitment-001",
    artifact_kind: "python_file",
    artifact_path: "/tmp/candidate.py",
    artifact_digest: "sha256:stored-artifact-001",
    artifact_runtime_contract_ref: {
      record_kind: "artifact_runtime_contract",
      id: "artifact-runtime-contract-001"
    },
    runtime_kind: "python",
    entrypoint: ["python3", "/tmp/candidate.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-10T08:59:00.000Z",
    authority_status: "not_live"
  };
}

function marketData(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: ["/fapi/v1/time", "/fapi/v1/klines?symbol=BTCUSDT"],
    authority_status: "read_only",
    readMarketSnapshot: async () => {
      throw new Error("unused");
    },
    readPublicMarketLivenessSurface: async () => {
      throw new Error("unused");
    },
    readPublicExecutionSnapshot: async () => {
      throw new Error("unused");
    }
  };
}

function providerIdentity(): PaperTradingEvaluationProviderIdentity {
  return {
    runtime_provider_kind: "none",
    qualification_eligible: true
  };
}

function initialAccount() {
  return {
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
      symbol: "BTCUSDT" as const,
      quantity: "0",
      side: "flat" as const,
      mark_price: "0",
      notional_usdt: "0"
    },
    open_order_count: 0,
    authority_status: "not_live" as const
  };
}

function evaluation(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-evaluation-commitment-001",
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    paper_account_snapshot: commitment.initial_account_snapshot,
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}
