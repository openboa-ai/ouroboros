import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  paperTradingComparisonTickDigestInput,
  type PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import { paperTradingMarketDataConfigurationDigest } from "./commitment";
import {
  ComparisonMarketDataView,
  ComparisonMarketDataViewError
} from "./comparison-market-data-view";

describe("ComparisonMarketDataView", () => {
  it("serves independent clones of one stored tick without delegating reads", async () => {
    const source = sourcePort();
    const tick = validTick(source);
    const view = new ComparisonMarketDataView({ source, tick });

    const firstMarket = await view.readMarketSnapshot();
    const secondMarket = await view.readMarketSnapshot({
      observedAt: "2099-01-01T00:00:00.000Z"
    });
    const firstExecution = await view.readPublicExecutionSnapshot();
    const secondExecution = await view.readPublicExecutionSnapshot({
      observedAt: "2099-01-01T00:00:00.000Z"
    });

    expect(firstMarket).toEqual({
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
      gap_detected: false
    });
    expect(secondMarket).toEqual(firstMarket);
    expect(secondMarket).not.toBe(firstMarket);
    expect(firstExecution).toEqual(tick.public_execution_snapshot);
    expect(secondExecution).toEqual(firstExecution);
    expect(secondExecution).not.toBe(firstExecution);

    firstMarket.price = 1;
    firstExecution.agg_trades.push({
      trade_id: "mutated",
      price: "1",
      quantity: "1",
      trade_time: "2026-07-11T00:00:00.000Z"
    });
    await expect(view.readMarketSnapshot()).resolves.toMatchObject({ price: 60_000 });
    await expect(view.readPublicExecutionSnapshot()).resolves.toMatchObject({ agg_trades: [] });
    expect(source.readMarketSnapshot).not.toHaveBeenCalled();
    expect(source.readPublicExecutionSnapshot).not.toHaveBeenCalled();
    expect(source.readPublicMarketLivenessSurface).not.toHaveBeenCalled();
  });

  it("fails closed instead of fabricating a market liveness surface", async () => {
    const source = sourcePort();
    const view = new ComparisonMarketDataView({ source, tick: validTick(source) });

    await expect(view.readPublicMarketLivenessSurface()).rejects.toMatchObject({
      code: "comparison_market_liveness_surface_unavailable"
    });
    expect(source.readPublicMarketLivenessSurface).not.toHaveBeenCalled();
  });

  it("rejects source configuration drift and tick digest drift", () => {
    const source = sourcePort();
    const tick = validTick(source);
    expect(() => new ComparisonMarketDataView({
      source: { ...source, rest_base_url: "https://drift.invalid" },
      tick
    })).toThrowError(ComparisonMarketDataViewError);
    expect(() => new ComparisonMarketDataView({
      source,
      tick: { ...tick, tick_digest: "sha256:drift" }
    })).toThrowError(ComparisonMarketDataViewError);
  });

  it("rejects malformed tick state without calling a source", () => {
    const source = sourcePort();
    const tick = validTick(source);
    expect(() => new ComparisonMarketDataView({
      source,
      tick: {
        ...tick,
        market_snapshot: { ...tick.market_snapshot, freshness: "stale" }
      }
    })).toThrowError(ComparisonMarketDataViewError);
    expect(source.readMarketSnapshot).not.toHaveBeenCalled();
    expect(source.readPublicExecutionSnapshot).not.toHaveBeenCalled();
  });
});

function sourcePort(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: ["/market", "/execution"],
    authority_status: "read_only",
    readMarketSnapshot: vi.fn(async () => {
      throw new Error("source_market_read_forbidden");
    }),
    readPublicExecutionSnapshot: vi.fn(async () => {
      throw new Error("source_execution_read_forbidden");
    }),
    readPublicMarketLivenessSurface: vi.fn(async () => {
      throw new Error("source_liveness_read_forbidden");
    })
  };
}

function validTick(source: GatewayMarketDataPort): PaperTradingComparisonTickRecord {
  const tick: PaperTradingComparisonTickRecord = {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "paper-comparison-tick-view-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "paper-comparison-001"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    sequence: 1,
    market_data_configuration_digest:
      paperTradingMarketDataConfigurationDigest(source),
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
      stream_marker: "public-execution-view-001",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:01.000Z",
    tick_digest: "",
    authority_status: "not_live"
  };
  return {
    ...tick,
    tick_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(tick))
      .digest("hex")}`
  };
}
