import { describe, expect, it, vi } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  type CandidateInspectReadModel,
  type LedgerInput,
  type LedgerWriteOutcome,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonTickRecord,
  type PaperTradingEvaluationRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { createGatewayRuntimeBinding } from "../gateway/runtime-binding";
import { preparePaperTradingComparisonCheckpointEvidence } from "./observation";

describe("paper comparison checkpoint preparation", () => {
  it("previews candidate-emitted order evidence without economic Store writes", async () => {
    const fixture = preparationFixture([orderEventLine()]);

    const prepared = await preparePaperTradingComparisonCheckpointEvidence(
      fixture.input
    );

    expect(prepared.ledger_inputs).toHaveLength(1);
    expect(prepared.ledger_outcomes).toEqual([fixture.ledgerOutcome]);
    expect(prepared.observation).toMatchObject({
      status: "recorded",
      paper_trading_comparison_tick_ref: fixture.attempt.tick_ref,
      paper_trading_comparison_tick_digest: fixture.attempt.tick_digest,
      paper_trading_comparison_checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: fixture.attempt.paper_trading_comparison_checkpoint_attempt_id
      },
      paper_trading_comparison_checkpoint_attempt_digest: fixture.attempt.attempt_digest,
      decision: { decision_kind: "order_request" },
      ledger_ref: {
        record_kind: "ledger_chain",
        id: fixture.ledgerOutcome.order_request.order_request_id
      }
    });
    expect(prepared.evaluation.observation_count).toBe(1);
    expect(prepared.evaluation.processed_trading_system_event_ids)
      .toEqual(["checkpoint-order-1"]);
    expect(prepared.consumed_event_count).toBe(1);
    expect(fixture.store.previewLedger).toHaveBeenCalledTimes(1);
    expect(fixture.store.recordLedger).not.toHaveBeenCalled();
    expect(fixture.store.recordPaperTradingObservation).not.toHaveBeenCalled();
    expect(fixture.marketData.readMarketSnapshot).not.toHaveBeenCalled();
    expect(fixture.marketData.readPublicExecutionSnapshot).not.toHaveBeenCalled();
  });

  it("records silence as no-order continuity without a synthesized decision", async () => {
    const fixture = preparationFixture([]);

    const prepared = await preparePaperTradingComparisonCheckpointEvidence(
      fixture.input
    );

    expect(prepared.ledger_inputs).toEqual([]);
    expect(prepared.ledger_outcomes).toEqual([]);
    expect(prepared.observation.status).toBe("no_order");
    expect(prepared.observation.decision).toBeUndefined();
    expect(prepared.observation.ledger_ref).toBeUndefined();
    expect(prepared.observation.score_delta).toEqual(PAPER_TRADING_COMPARISON_ZERO_SCORE);
    expect(prepared.evaluation.paper_account_snapshot).toMatchObject({
      wallet_balance_usdt: "10000",
      realized_pnl_usdt: "0",
      fee_paid_usdt: "0",
      slippage_paid_usdt: "0",
      funding_paid_usdt: "0",
      position: {
        side: "flat",
        quantity: "0",
        mark_price: "60000",
        notional_usdt: "0"
      }
    });
    expect(prepared.consumed_event_count).toBe(0);
    expect(fixture.store.previewLedger).not.toHaveBeenCalled();
  });

  it("consumes candidate hold as no-order continuity without a Ledger chain", async () => {
    const fixture = preparationFixture([holdEventLine()]);

    const prepared = await preparePaperTradingComparisonCheckpointEvidence(
      fixture.input
    );

    expect(prepared.observation).toMatchObject({
      status: "no_order",
      decision: {
        decision_kind: "hold",
        reason: "candidate cadence hold"
      },
      processed_trading_system_event_ids: ["checkpoint-hold-1"]
    });
    expect(prepared.ledger_outcomes).toEqual([]);
    expect(prepared.consumed_event_count).toBe(1);
  });

  it("turns a rejected candidate protocol event into paired negative evidence", async () => {
    const fixture = preparationFixture([malformedOrderEventLine()]);

    const prepared = await preparePaperTradingComparisonCheckpointEvidence(
      fixture.input
    );

    expect(prepared.observation.status).toBe("failed");
    expect(prepared.observation.decision).toMatchObject({
      decision_kind: "error",
      reason: "forbidden_private_or_live_authority"
    });
    expect(prepared.observation.failure_reason)
      .toBe("forbidden_private_or_live_authority");
    expect(prepared.observation.cumulative_score)
      .toEqual(PAPER_TRADING_COMPARISON_ZERO_SCORE);
    expect(prepared.evaluation.status).toBe("failed");
    expect(prepared.ledger_outcomes).toEqual([]);
    expect(fixture.store.recordLedger).not.toHaveBeenCalled();
    expect(fixture.store.recordPaperTradingObservation).not.toHaveBeenCalled();
  });
});

function preparationFixture(lines: string[]) {
  const tick = comparisonTick();
  const attempt = checkpointAttempt(tick);
  const evaluation = runningEvaluation();
  const candidate = candidateWithLogs(lines);
  const ledgerOutcome = previewedLedgerOutcome();
  const store = {
    previewLedger: vi.fn(async (_input: LedgerInput) => structuredClone(ledgerOutcome)),
    recordLedger: vi.fn(),
    recordPaperTradingObservation: vi.fn()
  } as unknown as OuroborosStorePort;
  const marketData = {
    provider_kind: "binance_production_public_market_data" as const,
    source_kind: "binance_production_public_hybrid" as const,
    rest_base_url: "https://example.invalid",
    required_endpoints: ["/fapi/v1/ticker/price"],
    authority_status: "read_only" as const,
    readMarketSnapshot: vi.fn(async () => {
      throw new Error("underlying market read forbidden");
    }),
    readPublicExecutionSnapshot: vi.fn(async () => {
      throw new Error("underlying execution read forbidden");
    }),
    readPublicMarketLivenessSurface: vi.fn(async () => {
      throw new Error("liveness read forbidden");
    })
  };
  const binding = createGatewayRuntimeBinding({ environment: "paper", marketData });
  if (binding.status !== "enabled") throw new Error("paper binding disabled");
  return {
    attempt,
    ledgerOutcome,
    store,
    marketData,
    input: {
      store,
      role: "champion" as const,
      candidate,
      evaluation,
      tick,
      checkpointAttempt: attempt,
      gatewayRuntimeBinding: binding,
      intervalMs: 60_000
    }
  };
}

function candidateWithLogs(lines: string[]): CandidateInspectReadModel {
  return {
    candidate_id: "candidate-champion",
    candidate_version: {
      candidate_version_id: "version-champion"
    },
    runtime: {
      sandbox: {
        sandbox_id: "sandbox-champion",
        logs: lines.length > 0 ? [{
          captured_at: "2026-07-11T00:00:05.000Z",
          lines
        }] : []
      }
    }
  } as unknown as CandidateInspectReadModel;
}

function runningEvaluation(): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "evaluation-champion",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
    candidate_version_ref: { record_kind: "candidate_version", id: "version-champion" },
    trading_run_ref: { record_kind: "trading_run", id: "run-champion" },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: "commitment-champion"
    },
    status: "running",
    interval_ms: 60_000,
    observation_count: 0,
    started_at: "2026-07-11T00:00:00.000Z",
    next_observation_at: "2026-07-11T00:01:00.000Z",
    latest_score: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
    paper_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function comparisonTick(): PaperTradingComparisonTickRecord {
  return {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "tick-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    sequence: 1,
    market_data_configuration_digest: "sha256:market",
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: "2026-07-11T00:00:01.000Z",
      source_kind: "binance_production_public_hybrid",
      freshness: "fresh",
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-11T00:00:01.000Z",
      source_kind: "binance_production_public_hybrid",
      freshness: "fresh",
      gap_detected: false,
      stream_marker: "first-tick",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:02.000Z",
    tick_digest: "sha256:tick",
    authority_status: "not_live"
  };
}

function checkpointAttempt(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonCheckpointAttemptRecord {
  return {
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id: "checkpoint-attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "activation-attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:activation-attempt",
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "activation-outcome-1"
    },
    activation_outcome_digest: "sha256:activation-outcome",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    tick_digest: tick.tick_digest,
    checkpoint_sequence: 1,
    champion: {
      role: "champion",
      trading_run_ref: { record_kind: "trading_run", id: "run-champion" },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "evaluation-champion"
      },
      evaluation_record_digest: "sha256:evaluation",
      observation_chain_digest: "sha256:observations",
      provider_request_count_before: 0
    },
    challenger: {
      role: "challenger",
      trading_run_ref: { record_kind: "trading_run", id: "run-challenger" },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "evaluation-challenger"
      },
      evaluation_record_digest: "sha256:evaluation-challenger",
      observation_chain_digest: "sha256:observations-challenger",
      provider_request_count_before: 0
    },
    attempted_at: "2026-07-11T00:00:03.000Z",
    checkpoint_deadline_at: "2026-07-11T00:01:03.000Z",
    attempt_status: "preparing",
    attempt_digest: "sha256:checkpoint-attempt",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function previewedLedgerOutcome(): LedgerWriteOutcome {
  return {
    candidate_id: "candidate-champion",
    candidate_version_id: "version-champion",
    runtime_id: "run-champion",
    order_request: {
      record_kind: "order_request",
      version: 1,
      order_request_id: "order-request-checkpoint-1",
      runtime_ref: { record_kind: "trading_run", id: "run-champion" },
      candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
      candidate_version_ref: { record_kind: "candidate_version", id: "version-champion" },
      stage_binding_ref: { record_kind: "stage_binding", id: "stage-paper" },
      intent_kind: "place_order",
      market_scope: "external_trading_api_fixture",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-07-11T00:00:01.000Z",
      authority_status: "not_submitted"
    },
    gateway_result: {
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: "gateway-result-checkpoint-1",
      runtime_ref: { record_kind: "trading_run", id: "run-champion" },
      order_request_ref: { record_kind: "order_request", id: "order-request-checkpoint-1" },
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-07-11T00:00:01.000Z",
      authority_status: "dry_run_only"
    },
    execution_result: {
      record_kind: "execution_result",
      version: 1,
      execution_result_id: "execution-result-checkpoint-1",
      runtime_ref: { record_kind: "trading_run", id: "run-champion" },
      order_request_ref: { record_kind: "order_request", id: "order-request-checkpoint-1" },
      gateway_result_ref: { record_kind: "gateway_result", id: "gateway-result-checkpoint-1" },
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "external_trading_api_fixture",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-07-11T00:00:01.000Z",
      authority_status: "dry_run_only"
    }
  };
}

function orderEventLine(): string {
  return JSON.stringify({
    event: "order_request",
    event_id: "checkpoint-order-1",
    instance_id: "sandbox-champion",
    at: "2026-07-11T00:00:04.000Z",
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    reason: "candidate first-tick order"
  });
}

function holdEventLine(): string {
  return JSON.stringify({
    event: "hold",
    event_id: "checkpoint-hold-1",
    instance_id: "sandbox-champion",
    at: "2026-07-11T00:00:04.000Z",
    authority_status: "trace_only",
    reason: "candidate cadence hold"
  });
}

function malformedOrderEventLine(): string {
  return JSON.stringify({
    event: "order_request",
    event_id: "checkpoint-error-1",
    instance_id: "sandbox-champion",
    at: "2026-07-11T00:00:04.000Z",
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    api_key: "forbidden"
  });
}
