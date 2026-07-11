import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonTickCaptureWriteContextHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonTickCaptureWriteContext,
  type PaperTradingComparisonTickRecord
} from "./index";

describe("PaperTradingComparisonTick", () => {
  it("canonically binds every first-tick evidence field", () => {
    const tick = validTick();
    const reordered = {
      authority_status: tick.authority_status,
      tick_digest: tick.tick_digest,
      observed_at: tick.observed_at,
      public_execution_snapshot: {
        authority_status: tick.public_execution_snapshot.authority_status,
        agg_trades: tick.public_execution_snapshot.agg_trades,
        stream_marker: tick.public_execution_snapshot.stream_marker,
        gap_detected: tick.public_execution_snapshot.gap_detected,
        rest_fallback_used: tick.public_execution_snapshot.rest_fallback_used,
        ws_connected: tick.public_execution_snapshot.ws_connected,
        freshness: tick.public_execution_snapshot.freshness,
        source_priority: tick.public_execution_snapshot.source_priority,
        source_kind: tick.public_execution_snapshot.source_kind,
        observed_at: tick.public_execution_snapshot.observed_at,
        symbol: tick.public_execution_snapshot.symbol
      },
      market_snapshot: { ...tick.market_snapshot },
      market_data_configuration_digest: tick.market_data_configuration_digest,
      sequence: tick.sequence,
      paper_trading_comparison_commitment_digest:
        tick.paper_trading_comparison_commitment_digest,
      paper_trading_comparison_commitment_ref: {
        ...tick.paper_trading_comparison_commitment_ref
      },
      paper_trading_comparison_tick_id: tick.paper_trading_comparison_tick_id,
      version: tick.version,
      record_kind: tick.record_kind
    } satisfies PaperTradingComparisonTickRecord;

    expect(paperTradingComparisonTickDigestInput(reordered)).toBe(
      paperTradingComparisonTickDigestInput(tick)
    );

    const mutations: PaperTradingComparisonTickRecord[] = [
      { ...tick, sequence: 2 },
      { ...tick, paper_trading_comparison_commitment_digest: "sha256:changed" },
      { ...tick, market_data_configuration_digest: "sha256:changed" },
      { ...tick, observed_at: "2026-07-11T00:00:02.000Z" },
      {
        ...tick,
        market_snapshot: { ...tick.market_snapshot, price: 60_001 }
      },
      {
        ...tick,
        public_execution_snapshot: {
          ...tick.public_execution_snapshot,
          stream_marker: "public-execution-changed"
        }
      }
    ];
    for (const mutation of mutations) {
      expect(paperTradingComparisonTickDigestInput(mutation)).not.toBe(
        paperTradingComparisonTickDigestInput(tick)
      );
    }
  });

  it("accepts one complete fresh read-only first tick", () => {
    expect(paperTradingComparisonTickHasRuntimeShape(validTick())).toBe(true);
  });

  it("accepts one contiguous later tick and its exact capture authority", () => {
    expect(paperTradingComparisonTickHasRuntimeShape(validNextTick())).toBe(true);
    expect(
      paperTradingComparisonTickCaptureWriteContextHasRuntimeShape(validCaptureContext())
    ).toBe(true);
  });

  it.each([
    ["first tick with predecessor ref", { ...validTick(), previous_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "prior"
    }}],
    ["first tick with predecessor digest", {
      ...validTick(),
      previous_tick_digest: "sha256:prior"
    }],
    ["later tick without predecessor ref", (() => {
      const value: any = validNextTick();
      delete value.previous_tick_ref;
      return value;
    })()],
    ["later tick without predecessor digest", (() => {
      const value: any = validNextTick();
      delete value.previous_tick_digest;
      return value;
    })()],
    ["later tick with wrong predecessor kind", {
      ...validNextTick(),
      previous_tick_ref: { record_kind: "wrong", id: "tick-1" }
    }],
    ["zero sequence", { ...validTick(), sequence: 0 }]
  ])("rejects invalid tick lineage: %s", (_label, value) => {
    expect(() => paperTradingComparisonTickHasRuntimeShape(value)).not.toThrow();
    expect(paperTradingComparisonTickHasRuntimeShape(value)).toBe(false);
  });

  it.each([
    ["null", null],
    ["wrong activation ref", {
      ...validCaptureContext(),
      paper_trading_comparison_activation_ref: { record_kind: "wrong", id: "activation-1" }
    }],
    ["wrong previous attempt ref", {
      ...validCaptureContext(),
      previous_checkpoint_attempt_ref: { record_kind: "wrong", id: "checkpoint-attempt-1" }
    }],
    ["wrong previous outcome ref", {
      ...validCaptureContext(),
      previous_checkpoint_outcome_ref: { record_kind: "wrong", id: "checkpoint-outcome-1" }
    }],
    ["empty previous outcome digest", {
      ...validCaptureContext(),
      previous_checkpoint_outcome_digest: ""
    }],
    ["wrong operation", { ...validCaptureContext(), operation: "capture_first_tick" }],
    ["extra live authority", { ...validCaptureContext(), live_exchange_authority: false }]
  ])("rejects invalid next-tick capture authority: %s", (_label, value) => {
    expect(() =>
      paperTradingComparisonTickCaptureWriteContextHasRuntimeShape(value)
    ).not.toThrow();
    expect(paperTradingComparisonTickCaptureWriteContextHasRuntimeShape(value)).toBe(false);
  });

  it.each([
    ["null", (tick: any) => null],
    ["later sequence without lineage", (tick: any) => ({ ...tick, sequence: 2 })],
    ["wrong symbol", (tick: any) => ({
      ...tick,
      market_snapshot: { ...tick.market_snapshot, symbol: "ETHUSDT" }
    })],
    ["non-positive price", (tick: any) => ({
      ...tick,
      market_snapshot: { ...tick.market_snapshot, price: 0 }
    })],
    ["missing moving average", (tick: any) => {
      delete tick.market_snapshot.moving_average_fast;
      return tick;
    }],
    ["negative volatility", (tick: any) => ({
      ...tick,
      market_snapshot: { ...tick.market_snapshot, volatility: -0.01 }
    })],
    ["missing direction", (tick: any) => {
      delete tick.market_snapshot.expected_direction;
      return tick;
    }],
    ["missing market source priority", (tick: any) => {
      delete tick.market_snapshot.source_priority;
      return tick;
    }],
    ["stale market", (tick: any) => ({
      ...tick,
      market_snapshot: { ...tick.market_snapshot, freshness: "stale" }
    })],
    ["market gap", (tick: any) => ({
      ...tick,
      market_snapshot: { ...tick.market_snapshot, gap_detected: true }
    })],
    ["stale public execution", (tick: any) => ({
      ...tick,
      public_execution_snapshot: {
        ...tick.public_execution_snapshot,
        freshness: "stale"
      }
    })],
    ["public execution gap", (tick: any) => ({
      ...tick,
      public_execution_snapshot: {
        ...tick.public_execution_snapshot,
        gap_detected: true
      }
    })],
    ["missing public execution source priority", (tick: any) => {
      delete tick.public_execution_snapshot.source_priority;
      return tick;
    }],
    ["malformed aggregate trade", (tick: any) => ({
      ...tick,
      public_execution_snapshot: {
        ...tick.public_execution_snapshot,
        agg_trades: [null]
      }
    })],
    ["malformed book ticker", (tick: any) => ({
      ...tick,
      public_execution_snapshot: {
        ...tick.public_execution_snapshot,
        book_ticker: { bid_price: {}, bid_quantity: "1", ask_price: "2", ask_quantity: "1" }
      }
    })],
    ["malformed order book", (tick: any) => ({
      ...tick,
      public_execution_snapshot: {
        ...tick.public_execution_snapshot,
        order_book: {
          symbol: "BTCUSDT",
          observed_at: "2026-07-11T00:00:00.000Z",
          source_kind: "binance_production_public_rest",
          sync_status: "synced",
          gap_detected: "false",
          authority_status: "read_only"
        }
      }
    })],
    ["non-ISO capture time", (tick: any) => ({ ...tick, observed_at: "not-a-time" })],
    ["live tick authority", (tick: any) => ({ ...tick, authority_status: "live" })]
  ])("returns false without throwing for %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validTick()));
    expect(() => paperTradingComparisonTickHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonTickHasRuntimeShape(malformed)).toBe(false);
  });
});

function validTick(): PaperTradingComparisonTickRecord {
  return {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "paper-comparison-tick-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "paper-comparison-001"
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
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "public-execution-001",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:01.000Z",
    tick_digest: "sha256:tick",
    authority_status: "not_live"
  };
}

function validNextTick(): PaperTradingComparisonTickRecord {
  const first = validTick();
  return {
    ...first,
    paper_trading_comparison_tick_id: "paper-comparison-tick-002",
    sequence: 2,
    previous_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: first.paper_trading_comparison_tick_id
    },
    previous_tick_digest: first.tick_digest,
    market_snapshot: {
      ...first.market_snapshot,
      price: 60_100,
      observed_at: "2026-07-11T00:01:00.000Z"
    },
    public_execution_snapshot: {
      ...first.public_execution_snapshot,
      observed_at: "2026-07-11T00:01:00.000Z",
      stream_marker: "public-execution-002"
    },
    observed_at: "2026-07-11T00:01:01.000Z",
    tick_digest: "sha256:tick-2"
  };
}

function validCaptureContext(): PaperTradingComparisonTickCaptureWriteContext {
  return {
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
    previous_checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: "checkpoint-attempt-1"
    },
    previous_checkpoint_attempt_digest: "sha256:checkpoint-attempt-1",
    previous_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: "checkpoint-outcome-1"
    },
    previous_checkpoint_outcome_digest: "sha256:checkpoint-outcome-1",
    operation: "capture_next_tick"
  };
}
