import { describe, expect, it, vi } from "vitest";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "./runtime-binding";

describe("paper trading API provider request cap", () => {
  it("executes only the committed request count and rejects every later request before handlers", async () => {
    const marketData = fixedMarketData();
    const readAccountState = vi.fn(async () => ({
      equity: 10_000,
      max_position_notional: 350,
      max_risk_fraction: 0.03,
      target_risk_fraction: 0.02
    }));
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData }),
      {
        maximum_request_count: 2,
        request_log_limit: 10,
        readAccountState
      }
    );

    try {
      expect(marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
      expect(readAccountState).toHaveBeenCalledTimes(1);

      const market = await fetch(`${provider.base_url}/market/snapshot`);
      const account = await fetch(`${provider.base_url}/account/state`);
      const rejectedOrder = await fetch(`${provider.base_url}/orders/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ side: "buy", quantity: 1 })
      });
      const rejectedAgain = await fetch(`${provider.base_url}/market/snapshot`);

      expect([market.status, account.status, rejectedOrder.status, rejectedAgain.status])
        .toEqual([200, 200, 429, 429]);
      await expect(rejectedOrder.json()).resolves.toEqual({
        error: "paper_api_request_limit_exceeded",
        maximum_request_count: 2,
        authority_status: "not_live"
      });
      expect(marketData.readMarketSnapshot).toHaveBeenCalledTimes(2);
      expect(readAccountState).toHaveBeenCalledTimes(2);
      expect(provider.requests().map((request) => request.response_status))
        .toEqual([200, 200, 429, 429]);
      expect(provider.request_count()).toBe(4);
    } finally {
      await expect(provider.close()).resolves.toBeUndefined();
    }
  });

  it("keeps total request count inspectable when the bounded log truncates", async () => {
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      { maximum_request_count: 1, request_log_limit: 1 }
    );

    try {
      await fetch(`${provider.base_url}/market/snapshot`);
      await fetch(`${provider.base_url}/account/state`);
      await fetch(`${provider.base_url}/orders/validate`, { method: "POST" });

      expect(provider.request_count()).toBe(3);
      expect(provider.requests()).toHaveLength(1);
      expect(provider.requests()[0]).toMatchObject({
        path: "/orders/validate",
        response_status: 429
      });
    } finally {
      await provider.close();
    }
  });
});

function fixedMarketData(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: ["/market"],
    authority_status: "read_only",
    readMarketSnapshot: vi.fn(async () => ({
      symbol: "BTCUSDT" as const,
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long" as const,
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest" as const,
      freshness: "fresh" as const
    })),
    readPublicExecutionSnapshot: vi.fn(async () => ({
      symbol: "BTCUSDT" as const,
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest" as const,
      source_priority: "rest_fallback" as const,
      freshness: "fresh" as const,
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "fixed",
      agg_trades: [],
      authority_status: "read_only" as const
    })),
    readPublicMarketLivenessSurface: vi.fn(async () => {
      throw new Error("not_used");
    })
  };
}
