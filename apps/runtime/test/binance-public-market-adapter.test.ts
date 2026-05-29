import { describe, expect, it } from "vitest";
import {
  BinancePublicMarketSdkAdapter,
  readBinanceBtcUsdtPublicMarketLivenessSurface,
  type BinancePublicMarketDataClient
} from "@ouroboros/adapters/binance/public-market-adapter";

describe("Binance public market liveness adapter", () => {
  it("normalizes official connector market data into a no-authority BTCUSDT substrate surface", async () => {
    const client = {
      async exchangeInformation() {
        return response({
          serverTime: 1778889601000,
          symbols: [
            {
              symbol: "BTCUSDT",
              contractType: "PERPETUAL",
              status: "TRADING",
              filters: [
                { filterType: "PRICE_FILTER", tickSize: "0.10" },
                { filterType: "LOT_SIZE", minQty: "0.001", stepSize: "0.001" },
                { filterType: "MIN_NOTIONAL", notional: "100" }
              ]
            }
          ]
        });
      },
      async markPrice(request: { symbol?: string }) {
        expect(request).toEqual({ symbol: "BTCUSDT" });
        return response({
          symbol: "BTCUSDT",
          markPrice: "65000.12340000",
          indexPrice: "64995.00000000",
          estimatedSettlePrice: "64990.00000000",
          lastFundingRate: "0.00010000",
          interestRate: "0.00010000",
          nextFundingTime: 1778918400000,
          time: 1778889600000
        });
      },
      async checkServerTime() {
        return response({
          serverTime: 1778889601000
        });
      }
    };

    const surface = await readBinanceBtcUsdtPublicMarketLivenessSurface({
      client,
      observedAt: "2026-05-16T00:00:03.000Z"
    });

    expect(surface).toMatchObject({
      record_kind: "public_market_liveness_surface",
      public_market_liveness_surface_id: "binance-btcusdt-public-market-liveness-1778889603000",
      surface_family: "public_market_liveness",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      symbol_status: "TRADING",
      contract_type: "PERPETUAL",
      price_tick_size: "0.10",
      quantity_step_size: "0.001",
      min_quantity: "0.001",
      min_notional: "100",
      mark_price: "65000.12340000",
      index_price: "64995.00000000",
      estimated_settle_price: "64990.00000000",
      funding_rate: "0.00010000",
      interest_rate: "0.00010000",
      next_funding_time: "2026-05-16T08:00:00.000Z",
      server_time: "2026-05-16T00:00:01.000Z",
      source_timestamp: "2026-05-16T00:00:00.000Z",
      observed_at: "2026-05-16T00:00:03.000Z",
      updated_at: "2026-05-16T00:00:03.000Z",
      freshness: "fresh",
      liveness: "connected",
      source_kind: "binance_market_data_rest",
      transport: {
        repository: "binance/binance-connector-js",
        package_name: "@binance/derivatives-trading-usds-futures",
        integration_role: "transport_only",
        authority_status: "not_live"
      },
      fixture_backed: false,
      simulated: false,
      no_authority: {
        live_exchange: false,
        order_submission: false,
        credentials: false
      },
      authority_status: "read_only"
    });
  });

  it("serves Gateway market snapshots through TTL cache and shared in-flight reads", async () => {
    let now = Date.parse("2026-05-16T00:00:03.000Z");
    const client = fakeBinancePublicMarketDataClient({ delayMs: 5 });
    const adapter = new BinancePublicMarketSdkAdapter({
      restBaseUrl: "https://fapi.binance.com",
      client,
      cache: { now: () => now }
    });

    const [first, second] = await Promise.all([
      adapter.readMarketSnapshot(),
      adapter.readMarketSnapshot()
    ]);
    expect(first).toMatchObject({
      symbol: "BTCUSDT",
      price: 65000,
      expected_direction: "long"
    });
    expect(second).toEqual(first);
    expect(client.calls).toEqual({
      checkServerTime: 1,
      exchangeInformation: 1,
      markPrice: 1,
      klineCandlestickData: 1
    });

    await adapter.readMarketSnapshot();
    expect(client.calls).toEqual({
      checkServerTime: 1,
      exchangeInformation: 1,
      markPrice: 1,
      klineCandlestickData: 1
    });

    now += 6_000;
    await adapter.readMarketSnapshot();
    expect(client.calls).toEqual({
      checkServerTime: 2,
      exchangeInformation: 1,
      markPrice: 2,
      klineCandlestickData: 1
    });

    now += 31_000;
    await adapter.readMarketSnapshot();
    expect(client.calls).toEqual({
      checkServerTime: 3,
      exchangeInformation: 1,
      markPrice: 3,
      klineCandlestickData: 2
    });
  });
});

function response<T>(payload: T) {
  return {
    async data() {
      return payload;
    }
  };
}

function fakeBinancePublicMarketDataClient(input: { delayMs?: number } = {}) {
  const calls = {
    checkServerTime: 0,
    exchangeInformation: 0,
    markPrice: 0,
    klineCandlestickData: 0
  };
  const client = {
    calls,
    async checkServerTime() {
      calls.checkServerTime += 1;
      await delay(input.delayMs);
      return response({ serverTime: 1778889601000 });
    },
    async exchangeInformation() {
      calls.exchangeInformation += 1;
      await delay(input.delayMs);
      return response({
        serverTime: 1778889601000,
        symbols: [
          {
            symbol: "BTCUSDT",
            contractType: "PERPETUAL",
            status: "TRADING",
            filters: [
              { filterType: "PRICE_FILTER", tickSize: "0.10" },
              { filterType: "LOT_SIZE", minQty: "0.001", stepSize: "0.001" },
              { filterType: "MIN_NOTIONAL", notional: "100" }
            ]
          }
        ]
      });
    },
    async markPrice() {
      calls.markPrice += 1;
      await delay(input.delayMs);
      return response({
        symbol: "BTCUSDT",
        markPrice: "65000.00000000",
        indexPrice: "64995.00000000",
        estimatedSettlePrice: "64990.00000000",
        lastFundingRate: "0.00010000",
        interestRate: "0.00010000",
        nextFundingTime: 1778918400000,
        time: 1778889600000
      });
    },
    async klineCandlestickData() {
      calls.klineCandlestickData += 1;
      await delay(input.delayMs);
      return response([
        [1778887860000, "64000", "64100", "63900", "64000", "10"],
        [1778887920000, "64100", "64200", "64000", "64100", "10"],
        [1778887980000, "64200", "64300", "64100", "64200", "10"],
        [1778888040000, "64300", "64400", "64200", "64300", "10"],
        [1778888100000, "64400", "64500", "64300", "64400", "10"],
        [1778888160000, "64500", "64600", "64400", "64500", "10"]
      ]);
    }
  };
  return client as BinancePublicMarketDataClient & { calls: typeof calls };
}

async function delay(ms = 0): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}
