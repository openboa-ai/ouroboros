import { describe, expect, it } from "vitest";
import { qualifyPaperTradingEvaluation } from "@ouroboros/application/trading/paper/qualification";
import type { PaperTradingEvaluationRecord, PaperTradingObservationRecord } from "@ouroboros/domain";

describe("PaperTradingQualificationPolicy", () => {
  it("keeps profitable paper evaluations collecting until the evidence window is large enough", () => {
    const evaluation = paperEvaluation({
      observationCount: 5,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:05:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
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

  it("qualifies paper evaluations only after enough observations, elapsed time, and public fill evidence", () => {
    const evaluation = paperEvaluation({
      observationCount: 30,
      netRevenueUsdt: 42,
      startedAt: "2026-05-16T00:00:00.000Z",
      lastObservedAt: "2026-05-16T00:31:00.000Z"
    });

    expect(qualifyPaperTradingEvaluation({
      evaluation,
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
        elapsed_ms: 31 * 60_000
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
});

function paperEvaluation(input: {
  observationCount: number;
  netRevenueUsdt: number;
  startedAt: string;
  lastObservedAt: string;
}): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-qualification-evaluation",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-paper-qualification" },
    candidate_version_ref: { record_kind: "candidate_version", id: "candidate-version-paper-qualification" },
    trading_run_ref: { record_kind: "trading_run", id: "trading-run-paper-qualification" },
    status: "running",
    interval_ms: 60_000,
    observation_count: input.observationCount,
    started_at: input.startedAt,
    last_observed_at: input.lastObservedAt,
    latest_score: {
      revenue_usdt: input.netRevenueUsdt + 1,
      cost_usdt: 1,
      net_revenue_usdt: input.netRevenueUsdt,
      net_return_pct: input.netRevenueUsdt / 10_000 * 100
    },
    paper_account_snapshot: {
      wallet_balance_usdt: "10042",
      available_balance_usdt: "10042",
      equity_usdt: "10042",
      realized_pnl_usdt: "42",
      unrealized_pnl_usdt: "0",
      fee_paid_usdt: "0.4",
      slippage_paid_usdt: "0.3",
      funding_paid_usdt: "0.3",
      margin_reserved_usdt: "0",
      position: {
        symbol: "BTCUSDT",
        quantity: "0.001",
        side: "long",
        average_entry_price: "65000",
        mark_price: "65042",
        notional_usdt: "65.042"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
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

function recordedObservations(count: number): PaperTradingObservationRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const observedAt = new Date(Date.UTC(2026, 4, 16, 0, sequence, 0)).toISOString();
    return {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id: `paper-qualification-observation-${sequence}`,
      paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: "paper-qualification-evaluation" },
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
      score_delta: {
        revenue_usdt: 1,
        cost_usdt: 0.1,
        net_revenue_usdt: 0.9,
        net_return_pct: 0.009
      },
      cumulative_score: {
        revenue_usdt: sequence,
        cost_usdt: sequence * 0.1,
        net_revenue_usdt: sequence * 0.9,
        net_return_pct: sequence * 0.009
      },
      authority_status: "not_live"
    };
  });
}

function failedObservation(sequence: number): PaperTradingObservationRecord {
  return {
    ...recordedObservations(1)[0]!,
    paper_trading_observation_id: `paper-qualification-observation-failed-${sequence}`,
    sequence,
    status: "failed",
    failure_reason: "fake public execution stream unavailable"
  };
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
