import { describe, expect, it, vi } from "vitest";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import {
  createGatewayRuntimeBinding,
  PaperTradingApiProviderComparisonTickClientError,
  startPaperTradingApiProvider
} from "./runtime-binding";
import type { PaperTradingComparisonTickContext } from "@ouroboros/domain";
import type {
  PaperTradingApiProviderComparisonTickHooks
} from "../research/types";

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

describe("paper API provider comparison tick protocol", () => {
  it("preserves generic market response bytes and leaves acknowledgement route absent", async () => {
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() })
    );

    try {
      const market = await fetch(`${provider.base_url}/market/snapshot`);
      const acknowledgement = await fetch(
        `${provider.base_url}/comparison/tick/ack`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validComparisonTickContext())
        }
      );

      expect(market.status).toBe(200);
      expect(await market.text()).toBe(`${JSON.stringify(expectedMarketPayload())}\n`);
      expect(acknowledgement.status).toBe(404);
      await expect(acknowledgement.json()).resolves.toEqual({ error: "not_found" });
    } finally {
      await provider.close();
    }
  });

  it("keeps startup, dormant market reads, account reads, and order validation non-attributing", async () => {
    const deliver = vi.fn(async () => undefined);
    const acknowledge = vi.fn();
    const marketData = fixedMarketData();
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData }),
      { comparison_tick_hooks: { deliver, acknowledge } }
    );

    try {
      expect(deliver).not.toHaveBeenCalled();
      expect(marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
      expect(provider.candidate_input.market).toEqual(expectedMarketPayload());

      const market = await fetch(`${provider.base_url}/market/snapshot`);
      await fetch(`${provider.base_url}/account/state`);
      await fetch(`${provider.base_url}/orders/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "BTCUSDT",
          side: "hold",
          quantity: 0,
          order_type: "none"
        })
      });

      await expect(market.json()).resolves.toEqual(expectedMarketPayload());
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(deliver).toHaveBeenCalledWith(expect.objectContaining({
        provider_request_count: 1,
        market: expect.objectContaining({ expected_direction: "long" })
      }));
      expect(acknowledge).not.toHaveBeenCalled();
      expect(marketData.readMarketSnapshot).toHaveBeenCalledTimes(3);
    } finally {
      await provider.close();
    }
  });

  it("persists delivery before exposing the same context on repeated candidate reads", async () => {
    const context = validComparisonTickContext();
    const deliver = vi.fn<PaperTradingApiProviderComparisonTickHooks["deliver"]>(
      async () => context
    );
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      { comparison_tick_hooks: comparisonTickHooks(deliver) }
    );

    try {
      const first = await fetch(`${provider.base_url}/market/snapshot`);
      const second = await fetch(`${provider.base_url}/market/snapshot`);

      await expect(first.json()).resolves.toEqual({
        ...expectedMarketPayload(),
        comparison_tick_context: context
      });
      await expect(second.json()).resolves.toEqual({
        ...expectedMarketPayload(),
        comparison_tick_context: context
      });
      expect(deliver).toHaveBeenCalledTimes(2);
      expect(deliver.mock.calls.map(([input]) => input.provider_request_count))
        .toEqual([1, 2]);
      expect(provider.request_count()).toBe(2);
    } finally {
      await provider.close();
    }
  });

  it("fails closed without context when delivery persistence fails", async () => {
    const deliver = vi.fn(async () => {
      throw new Error("comparison_tick_delivery_failed");
    });
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      { comparison_tick_hooks: comparisonTickHooks(deliver) }
    );

    try {
      const response = await fetch(`${provider.base_url}/market/snapshot`);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "paper_runtime_api_unavailable",
        reason: "comparison_tick_delivery_failed",
        authority_status: "not_live"
      });
      expect(deliver).toHaveBeenCalledTimes(1);
    } finally {
      await provider.close();
    }
  });

  it("persists acknowledgement before returning its exact reference and digest", async () => {
    const context = validComparisonTickContext();
    const acknowledge = vi.fn(async () => ({
      acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: "ack-1"
      },
      acknowledgement_digest: "sha256:acknowledgement"
    }));
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      {
        comparison_tick_hooks: {
          deliver: vi.fn(async () => context),
          acknowledge
        }
      }
    );

    try {
      await fetch(`${provider.base_url}/market/snapshot`);
      const response = await fetch(`${provider.base_url}/comparison/tick/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(context)
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        acknowledgement_ref: {
          record_kind: "paper_trading_comparison_tick_acknowledgement",
          id: "ack-1"
        },
        acknowledgement_digest: "sha256:acknowledgement",
        authority_status: "not_live"
      });
      expect(acknowledge).toHaveBeenCalledTimes(1);
      expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({
        context,
        provider_request_count: 2,
        acknowledged_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      }));
    } finally {
      await provider.close();
    }
  });

  it("rejects malformed and stale acknowledgement without false evidence", async () => {
    const acknowledge = vi.fn()
      .mockRejectedValueOnce(new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_context_stale",
        409
      ));
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      {
        comparison_tick_hooks: {
          deliver: vi.fn(async () => validComparisonTickContext()),
          acknowledge
        }
      }
    );

    try {
      const malformed = await fetch(`${provider.base_url}/comparison/tick/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tick_digest: "sha256:tick" })
      });
      expect(malformed.status).toBe(422);
      await expect(malformed.json()).resolves.toEqual({
        error: "comparison_tick_context_invalid",
        authority_status: "not_live"
      });
      expect(acknowledge).not.toHaveBeenCalled();

      const stale = await fetch(`${provider.base_url}/comparison/tick/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validComparisonTickContext())
      });
      expect(stale.status).toBe(409);
      await expect(stale.json()).resolves.toEqual({
        error: "comparison_tick_context_stale",
        authority_status: "not_live"
      });
      expect(acknowledge).toHaveBeenCalledTimes(1);
    } finally {
      await provider.close();
    }
  });

  it("fails closed when acknowledgement hook returns extra authority", async () => {
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      {
        comparison_tick_hooks: {
          deliver: vi.fn(async () => validComparisonTickContext()),
          acknowledge: vi.fn(async () => ({
            acknowledgement_ref: {
              record_kind: "paper_trading_comparison_tick_acknowledgement",
              id: "ack-1",
              live_exchange_authority: false
            },
            acknowledgement_digest: "sha256:acknowledgement"
          }))
        }
      }
    );

    try {
      const response = await fetch(`${provider.base_url}/comparison/tick/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validComparisonTickContext())
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: "paper_runtime_api_unavailable",
        reason: "comparison_tick_acknowledgement_result_invalid"
      });
    } finally {
      await provider.close();
    }
  });

  it("rejects over-cap delivery and acknowledgement before hooks or body handling", async () => {
    const hooks = comparisonTickHooks(vi.fn(async () => validComparisonTickContext()));
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ environment: "paper", marketData: fixedMarketData() }),
      { comparison_tick_hooks: hooks, maximum_request_count: 0 }
    );

    try {
      const market = await fetch(`${provider.base_url}/market/snapshot`);
      const acknowledgement = await fetch(
        `${provider.base_url}/comparison/tick/ack`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{not-json"
        }
      );

      expect([market.status, acknowledgement.status]).toEqual([429, 429]);
      expect(hooks.deliver).not.toHaveBeenCalled();
      expect(hooks.acknowledge).not.toHaveBeenCalled();
    } finally {
      await provider.close();
    }
  });
});

function comparisonTickHooks(
  deliver: PaperTradingApiProviderComparisonTickHooks["deliver"]
): PaperTradingApiProviderComparisonTickHooks {
  return {
    deliver,
    acknowledge: vi.fn(async () => ({
      acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: "ack-1"
      },
      acknowledgement_digest: "sha256:acknowledgement"
    }))
  };
}

function validComparisonTickContext(): PaperTradingComparisonTickContext {
  return {
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-1"
    },
    tick_digest: "sha256:tick",
    tick_sequence: 1,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery",
      id: "delivery-1"
    },
    delivery_digest: "sha256:delivery"
  };
}

function expectedMarketPayload() {
  return {
    symbol: "BTCUSDT",
    price: 60_000,
    moving_average_fast: 60_100,
    moving_average_slow: 59_900,
    volatility: 0.01,
    observed_at: "2026-07-11T00:00:00.000Z",
    source_kind: "binance_production_public_rest",
    freshness: "fresh"
  };
}

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
