import { describe, expect, it } from "vitest";
import { paperTradingEvaluationCommitmentDigest } from "@ouroboros/application/trading/paper/commitment";
import { paperTradingQualificationBlockerGroups } from "@ouroboros/application/trading/paper/qualification-blockers";
import { qualifyPaperTradingEvaluation } from "@ouroboros/application/trading/paper/qualification";
import type {
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingEvidencePurpose,
  PaperTradingObservationRecord
} from "@ouroboros/domain";

describe("PaperTradingQualificationPolicy", () => {
  it("never qualifies mature profitable research-feedback evidence", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("research_feedback"),
      observations: recordedObservations(30),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["evidence_purpose_not_qualification"]
    });
  });

  it("never infers qualification purpose when the commitment is missing", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: undefined,
      observations: recordedObservations(30),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"]
    });
  });

  it("blocks invalidated qualification evidence before maturity checks", () => {
    const evaluation = {
      ...paperEvaluation({
        observationCount: 30,
        netRevenueUsdt: 42,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:31:00.000Z"
      }),
      status: "invalidated" as const,
      invalidation_reason: "resolved_artifact_digest_mismatch" as const
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: recordedObservations(30),
      runnerActive: false
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_evaluation_invalidated"]
    });
  });

  it("preserves terminal invalidation when the provider identity is also ineligible", () => {
    const evaluation = {
      ...paperEvaluation({
        observationCount: 30,
        netRevenueUsdt: 42,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:31:00.000Z"
      }),
      status: "invalidated" as const,
      invalidation_reason: "provider_identity_mismatch" as const
    };
    const eligible = paperCommitment("qualification");
    const ineligibleWithoutDigest: PaperTradingEvaluationCommitmentRecord = {
      ...eligible,
      provider_identity: {
        runtime_provider_kind: "managed_agent",
        qualification_eligible: false,
        ineligibility_reason: "provider_identity_unavailable"
      },
      commitment_digest: ""
    };
    const ineligible = {
      ...ineligibleWithoutDigest,
      commitment_digest: paperTradingEvaluationCommitmentDigest(ineligibleWithoutDigest)
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: ineligible,
      observations: recordedObservations(30),
      runnerActive: false
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_evaluation_invalidated"]
    });
  });

  it("preserves terminal invalidation when the commitment digest no longer verifies", () => {
    const evaluation = {
      ...paperEvaluation({
        observationCount: 30,
        netRevenueUsdt: 42,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:31:00.000Z"
      }),
      status: "invalidated" as const,
      invalidation_reason: "commitment_digest_mismatch" as const
    };
    const commitment = paperCommitment("qualification");
    const mutatedCommitment: PaperTradingEvaluationCommitmentRecord = {
      ...commitment,
      policy_identity: {
        ...commitment.policy_identity,
        cost_policy_version: "mutated-after-commit"
      }
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: mutatedCommitment,
      observations: recordedObservations(30),
      runnerActive: false
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_evaluation_invalidated"]
    });
  });

  it("rejects qualification evidence whose frozen commitment content no longer matches its digest", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const commitment = paperCommitment("qualification");
    const mutatedCommitment: PaperTradingEvaluationCommitmentRecord = {
      ...commitment,
      policy_identity: {
        ...commitment.policy_identity,
        cost_policy_version: "mutated-after-commit"
      }
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: mutatedCommitment,
      observations: recordedObservations(30),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"]
    });
  });

  it("honors a canonical frozen eligibility policy version after the current policy advances", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const current = paperCommitment("qualification");
    const historicalWithoutDigest: PaperTradingEvaluationCommitmentRecord = {
      ...current,
      window_policy: {
        ...current.window_policy,
        eligibility_policy_version: "paper-evidence-eligibility-v0"
      },
      commitment_digest: ""
    };
    const historical = {
      ...historicalWithoutDigest,
      commitment_digest: paperTradingEvaluationCommitmentDigest(historicalWithoutDigest)
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: historical,
      observations: recordedObservations(30),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: []
    });
  });

  it("rejects a qualification window whose frozen provider identity is ineligible", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const eligible = paperCommitment("qualification");
    const ineligibleWithoutDigest: PaperTradingEvaluationCommitmentRecord = {
      ...eligible,
      provider_identity: {
        runtime_provider_kind: "managed_agent",
        model: "unresolved-provider-model",
        qualification_eligible: false,
        ineligibility_reason: "provider_identity_unavailable"
      },
      commitment_digest: ""
    };
    const ineligible = {
      ...ineligibleWithoutDigest,
      commitment_digest: paperTradingEvaluationCommitmentDigest(ineligibleWithoutDigest)
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: ineligible,
      observations: recordedObservations(30),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["provider_identity_not_qualification_eligible"]
    });
  });

  it("blocks qualification when the persisted observation chain is incomplete", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: recordedObservations(29),
      runnerActive: true
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_observation_chain_incomplete"]
    });
  });

  it("blocks qualification when persisted score does not reconcile to the fake account", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const tamperedScore = {
      revenue_usdt: 1_001,
      cost_usdt: 1,
      net_revenue_usdt: 1_000,
      net_return_pct: 10
    };
    const observations = recordedObservations(30);
    observations[29] = {
      ...observations[29]!,
      cumulative_score: tamperedScore
    };

    const qualification = qualifyPaperTradingEvaluation({
      evaluation: { ...evaluation, latest_score: tamperedScore },
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true
    });
    expect(qualification).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_score_account_mismatch"]
    });
    expect(paperTradingQualificationBlockerGroups(qualification.qualification_reasons))
      .toEqual([{
        group_kind: "observation_quality",
        severity: "blocked",
        blockers: ["paper_score_account_mismatch"],
        summary: "Paper observation and account evidence do not form a trustworthy chain.",
        next_action:
          "Preserve the inconsistent evidence for audit and start a new prospective qualification window after repairing persistence or accounting."
      }]);
  });

  it("blocks qualification when an observation delta is tampered independently", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const observations = recordedObservations(30);
    observations[14] = {
      ...observations[14]!,
      score_delta: {
        ...observations[14]!.score_delta,
        net_revenue_usdt: observations[14]!.score_delta.net_revenue_usdt + 10
      }
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_score_account_mismatch"]
    });
  });

  it("blocks qualification when an observation account is tampered independently", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const observations = recordedObservations(30);
    observations[14] = {
      ...observations[14]!,
      paper_account_snapshot: {
        ...observations[14]!.paper_account_snapshot!,
        equity_usdt: "999999"
      }
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_score_account_mismatch"]
    });
  });

  it("keeps profitable paper evaluations collecting until the evidence window is large enough", () => {
    const evaluation = paperEvaluation({
      observationCount: 5,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:05:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: recordedObservations(5),
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "collecting_evidence",
      qualification_reasons: [
        "min_observation_count_not_met",
        "min_elapsed_ms_not_met"
      ],
      evidence_window: {
        observation_count: 5,
        failed_observation_count: 0,
        elapsed_ms: 5 * 60_000
      }
    });
  });

  it("uses actual observation timestamps instead of mutable evaluation elapsed time", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const compressedObservations = recordedObservations(30).map((observation) => ({
      ...observation,
      observed_at: "2026-05-16T00:01:00.000Z",
      market_snapshot: observation.market_snapshot
        ? { ...observation.market_snapshot, observed_at: "2026-05-16T00:01:00.000Z" }
        : undefined
    }));

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: compressedObservations,
      runnerActive: true
    })).toMatchObject({
      qualification_status: "collecting_evidence",
      qualification_reasons: ["min_elapsed_ms_not_met"],
      evidence_window: {
        elapsed_ms: 60_000
      }
    });
  });

  it("keeps empty or not-yet-sampled evaluations collecting instead of quality blocked", () => {
    const evaluation = {
      ...paperEvaluation({
        observationCount: 0,
        netRevenueUsdt: 0,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:00:00.000Z"
      }),
      latest_fill: undefined,
      latest_public_execution_snapshot: undefined,
      latest_score: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      }
    };

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: [],
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "collecting_evidence",
      qualification_reasons: [
        "min_observation_count_not_met",
        "min_elapsed_ms_not_met"
      ]
    });
  });

  it("qualifies paper evaluations only after enough observations, elapsed time, and public fill evidence", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: recordedObservations(30),
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: [],
      evidence_window: {
        observation_count: 30,
        failed_observation_count: 0,
        elapsed_ms: 30 * 60_000
      }
    });
  });

  it("blocks running evaluations when the runner is inactive or data quality is not credible", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations: [
        ...recordedObservations(26),
        failedObservation(27),
        failedObservation(28),
        failedObservation(29),
        failedObservation(30)
      ],
      runnerActive: false,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: [
        "runner_inactive_for_running_evaluation",
        "failed_observation_ratio_exceeded"
      ],
      evidence_window: {
        observation_count: 30,
        failed_observation_count: 4
      }
    });
  });

  it("blocks fill-bearing paper evaluations that lack public execution evidence", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });
    const observations = recordedObservations(30).map((observation) => ({
      ...observation,
      public_execution_snapshot: undefined
    }));

    expect(qualifyPaperTradingEvaluation({
      evaluation: {
        ...evaluation,
        latest_public_execution_snapshot: undefined
      },
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["fill_public_execution_evidence_missing"]
    });
  });

  it("does not qualify fills using unrelated public execution snapshots elsewhere in the window", () => {
    const latestFill = {
      fill_id: "paper-qualification-late-fill",
      order_id: "paper-qualification-order",
      fill_status: "filled" as const,
      fill_price: "65000",
      fill_quantity: "0.001",
      fee_usdt: "0.4",
      slippage_usdt: "0.3",
      funding_usdt: "0.3",
      trade_time: "2026-05-16T00:31:00.000Z",
      source_trade_id: "paper-qualification-late-trade"
    };
    const evaluation = {
      ...paperEvaluation({
        observationCount: 30,
        netRevenueUsdt: 42,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:31:00.000Z"
      }),
      latest_fill: latestFill,
      latest_public_execution_snapshot: undefined
    };
    const observations = recordedObservations(30).map((observation) =>
      observation.sequence === 30
        ? {
            ...observation,
            latest_fill: latestFill,
            public_execution_snapshot: undefined
          }
        : observation
    );

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["fill_public_execution_evidence_missing"]
    });
  });

  it("qualifies carried-forward latest fills when the original observation has matching public execution evidence", () => {
    const evaluation = {
      ...paperEvaluation({
        observationCount: 30,
        netRevenueUsdt: 42,
        startedAt: "2026-05-16T00:00:00.000Z",
        lastObservedAt: "2026-05-16T00:31:00.000Z"
      }),
      latest_public_execution_snapshot: {
        ...publicExecutionSnapshot("2026-05-16T00:31:00.000Z"),
        stream_marker: "later-unrelated-marker",
        agg_trades: []
      }
    };
    const observations = recordedObservations(30).map((observation) =>
      observation.sequence === 30
        ? {
            ...observation,
            latest_fill: evaluation.latest_fill,
            public_execution_snapshot: {
              ...publicExecutionSnapshot(observation.observed_at),
              stream_marker: "later-unrelated-observation-marker",
              agg_trades: []
            }
          }
        : observation
    );

    expect(qualifyPaperTradingEvaluation({
      evaluation,
      commitment: paperCommitment("qualification"),
      observations,
      runnerActive: true,
      policy: {
        minObservationCount: 30,
        minElapsedMs: 30 * 60_000,
        maxFailedObservationRatio: 0.1
      }
    })).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: []
    });
  });
});

function paperEvaluation(input: {
  observationCount: number;
  netRevenueUsdt: number;
  startedAt: string;
  lastObservedAt: string;
}): PaperTradingEvaluationRecord {
  const latestScore = profitLossForNetRevenue(
    input.observationCount === 0 ? 0 : input.netRevenueUsdt
  );
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-qualification-evaluation",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-paper-qualification" },
    candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-paper-qualification" },
    trading_run_ref: { record_kind: "trading_run", id: "trading-run-paper-qualification" },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: "paper-qualification-commitment"
    },
    status: "running",
    interval_ms: 60_000,
    observation_count: input.observationCount,
    started_at: input.startedAt,
    last_observed_at: input.lastObservedAt,
    latest_score: latestScore,
    paper_account_snapshot: paperAccountForScore(latestScore, input.observationCount > 0),
    open_orders: [],
    latest_fill: {
      fill_id: "paper-qualification-fill",
      order_id: "paper-qualification-order",
      fill_status: "filled",
      fill_price: "65000",
      fill_quantity: "0.001",
      fee_usdt: "0.4",
      slippage_usdt: "0.3",
      funding_usdt: "0.3",
      trade_time: input.lastObservedAt,
      source_trade_id: "paper-qualification-trade"
    },
    latest_public_execution_snapshot: publicExecutionSnapshot(input.lastObservedAt),
    authority_status: "not_live"
  };
}

function paperCommitment(
  evidencePurpose: PaperTradingEvidencePurpose
): PaperTradingEvaluationCommitmentRecord {
  const commitment: PaperTradingEvaluationCommitmentRecord = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "paper-qualification-commitment",
    evidence_purpose: evidencePurpose,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-paper-qualification"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "candidate-version-paper-qualification"
    },
    trading_run_ref: {
      record_kind: "trading_run",
      id: "trading-run-paper-qualification"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: "system-code-paper-qualification"
    },
    system_code_artifact_digest: "sha256:paper-qualification-artifact",
    resolved_artifact_digest: "sha256:paper-qualification-resolved-artifact",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "/tmp/paper-qualification.py"]
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "paper-only"
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "no-raw-secrets"
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
      market_data_configuration_digest: "sha256:paper-market-data",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: evidencePurpose === "qualification"
        ? "sealed_until_adjudication"
        : "closed_observation",
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
        mark_price: "65000",
        notional_usdt: "0"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
    committed_at: "2026-05-16T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
  return {
    ...commitment,
    commitment_digest: paperTradingEvaluationCommitmentDigest(commitment)
  };
}

function recordedObservations(count: number, targetNetRevenueUsdt = 42): PaperTradingObservationRecord[] {
  let previousScore = profitLossForNetRevenue(0);
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const observedAt = new Date(Date.UTC(2026, 4, 16, 0, sequence, 0)).toISOString();
    const cumulativeScore = profitLossForNetRevenue(
      roundProfit(targetNetRevenueUsdt * sequence / count),
      roundProfit(sequence / count)
    );
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id: `paper-qualification-observation-${sequence}`,
      paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: "paper-qualification-evaluation" },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "paper-qualification-commitment"
      },
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-paper-qualification" },
      candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-paper-qualification" },
      trading_run_ref: { record_kind: "trading_run", id: "trading-run-paper-qualification" },
      sequence,
      status: "recorded",
      observed_at: observedAt,
      market_snapshot: {
        symbol: "BTCUSDT",
        price: 65_000 + sequence,
        observed_at: observedAt,
        source_kind: "binance_production_public_hybrid",
        source_priority: "websocket_primary",
        freshness: "fresh",
        ws_connected: true,
        rest_fallback_used: false,
        authority_status: "read_only"
      },
      public_execution_snapshot: publicExecutionSnapshot(observedAt),
      latest_fill: sequence === 1
        ? {
            fill_id: "paper-qualification-fill",
            order_id: "paper-qualification-order",
            fill_status: "filled",
            fill_price: "65000",
            fill_quantity: "0.001",
            fee_usdt: "0.4",
            slippage_usdt: "0.3",
            funding_usdt: "0.3",
            trade_time: observedAt,
            source_trade_id: "paper-qualification-trade"
          }
        : undefined,
      paper_account_snapshot: paperAccountForScore(cumulativeScore, true),
      score_delta: profitLossDelta(cumulativeScore, previousScore),
      cumulative_score: cumulativeScore,
      authority_status: "not_live"
    };
    previousScore = cumulativeScore;
    return observation;
  });
}

function failedObservation(sequence: number): PaperTradingObservationRecord {
  const cumulativeScore = profitLossForNetRevenue(42);
  const observedAt = new Date(Date.UTC(2026, 4, 16, 0, sequence, 0)).toISOString();
  return {
    ...recordedObservations(1)[0]!,
    paper_trading_observation_id: `paper-qualification-observation-failed-${sequence}`,
    sequence,
    status: "failed",
    observed_at: observedAt,
    market_snapshot: {
      ...recordedObservations(1)[0]!.market_snapshot!,
      observed_at: observedAt
    },
    paper_account_snapshot: paperAccountForScore(cumulativeScore, true),
    score_delta: profitLossDelta(cumulativeScore, cumulativeScore),
    cumulative_score: cumulativeScore,
    failure_reason: "fake public execution stream unavailable"
  };
}

function profitLossForNetRevenue(
  netRevenueUsdt: number,
  costFraction = netRevenueUsdt === 0 ? 0 : 1
): PaperTradingEvaluationRecord["latest_score"] {
  const costUsdt = roundProfit(costFraction);
  const net = roundProfit(netRevenueUsdt);
  return {
    revenue_usdt: roundProfit(net + costUsdt),
    cost_usdt: costUsdt,
    net_revenue_usdt: net,
    net_return_pct: roundProfit(net / 10_000 * 100)
  };
}

function paperAccountForScore(
  score: PaperTradingEvaluationRecord["latest_score"],
  hasPosition: boolean
): NonNullable<PaperTradingEvaluationRecord["paper_account_snapshot"]> {
  const fee = roundProfit(score.cost_usdt * 0.4);
  const slippage = roundProfit(score.cost_usdt * 0.3);
  const funding = roundProfit(score.cost_usdt - fee - slippage);
  const equity = roundProfit(10_000 + score.net_revenue_usdt);
  return {
    wallet_balance_usdt: `${equity}`,
    available_balance_usdt: `${equity}`,
    equity_usdt: `${equity}`,
    realized_pnl_usdt: `${score.revenue_usdt}`,
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: `${fee}`,
    slippage_paid_usdt: `${slippage}`,
    funding_paid_usdt: `${funding}`,
    margin_reserved_usdt: "0",
    position: hasPosition
      ? {
          symbol: "BTCUSDT",
          quantity: "0.001",
          side: "long",
          average_entry_price: "65000",
          mark_price: "65042",
          notional_usdt: "65.042"
        }
      : {
          symbol: "BTCUSDT",
          quantity: "0",
          side: "flat",
          mark_price: "65000",
          notional_usdt: "0"
        },
    open_order_count: 0,
    authority_status: "not_live"
  };
}

function profitLossDelta(
  current: PaperTradingEvaluationRecord["latest_score"],
  previous: PaperTradingEvaluationRecord["latest_score"]
): PaperTradingEvaluationRecord["latest_score"] {
  return {
    revenue_usdt: roundProfit(current.revenue_usdt - previous.revenue_usdt),
    cost_usdt: roundProfit(current.cost_usdt - previous.cost_usdt),
    net_revenue_usdt: roundProfit(current.net_revenue_usdt - previous.net_revenue_usdt),
    net_return_pct: roundProfit(current.net_return_pct - previous.net_return_pct)
  };
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function publicExecutionSnapshot(observedAt: string) {
  return {
    symbol: "BTCUSDT" as const,
    observed_at: observedAt,
    source_kind: "binance_production_public_hybrid" as const,
    source_priority: "websocket_primary" as const,
    freshness: "fresh" as const,
    ws_connected: true,
    rest_fallback_used: false,
    stream_marker: `aggTrade:${observedAt}`,
    agg_trades: [{
      trade_id: "paper-qualification-trade",
      price: "65000",
      quantity: "0.001",
      trade_time: observedAt
    }],
    authority_status: "read_only" as const
  };
}
