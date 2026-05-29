import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BinancePublicMarketSdkAdapter,
  readBinanceBtcUsdtPublicExecutionSnapshot,
  readBinanceBtcUsdtPublicMarketLivenessSurface,
  type BinancePublicMarketDataClient
} from "@ouroboros/adapters/binance/public-market-adapter";

describe("Binance public market liveness adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("reads public execution snapshots with bookTicker and aggTrade evidence through cache", async () => {
    let now = Date.parse("2026-05-16T00:00:03.000Z");
    const fetchCalls: string[] = [];
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const href = String(url);
      fetchCalls.push(href);
      if (href.includes("/ticker/bookTicker")) {
        return jsonFetchResponse({
          symbol: "BTCUSDT",
          bidPrice: "59999",
          bidQty: "1.000",
          askPrice: "60001",
          askQty: "1.000",
          time: 1778889602500
        });
      }
      if (href.includes("/aggTrades")) {
        return jsonFetchResponse([
          {
            a: 123,
            p: "60000",
            q: "0.001",
            T: 1778889602400,
            m: false
          }
        ]);
      }
      throw new Error(`unexpected fetch ${href}`);
    });
    const adapter = new BinancePublicMarketSdkAdapter({
      restBaseUrl: "https://fapi.binance.com",
      client: fakeBinancePublicMarketDataClient(),
      cache: { now: () => now }
    });

    const [first, second] = await Promise.all([
      adapter.readPublicExecutionSnapshot({ observedAt: "2026-05-16T00:00:03.000Z" }),
      adapter.readPublicExecutionSnapshot({ observedAt: "2026-05-16T00:00:03.000Z" })
    ]);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      symbol: "BTCUSDT",
      source_kind: "binance_production_public_stream",
      book_ticker: {
        bid_price: "59999",
        ask_price: "60001"
      },
      agg_trades: [{
        trade_id: "123",
        price: "60000",
        quantity: "0.001",
        trade_time: "2026-05-16T00:00:02.400Z",
        is_buyer_maker: false
      }],
      authority_status: "read_only"
    });
    expect(fetchCalls).toHaveLength(2);

    await adapter.readPublicExecutionSnapshot({ observedAt: "2026-05-16T00:00:03.000Z" });
    expect(fetchCalls).toHaveLength(2);

    now += 6_000;
    await adapter.readPublicExecutionSnapshot({ observedAt: "2026-05-16T00:00:03.000Z" });
    expect(fetchCalls).toHaveLength(4);
  });

  it("normalizes a public execution snapshot without private or live authority", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const href = String(url);
      if (href.includes("/ticker/bookTicker")) {
        return jsonFetchResponse({
          symbol: "BTCUSDT",
          bidPrice: "59999",
          bidQty: "1.000",
          askPrice: "60001",
          askQty: "1.000",
          time: 1778889602500
        });
      }
      return jsonFetchResponse([
        { a: 456, p: "60000", q: "0.001", T: 1778889602400, m: true }
      ]);
    });

    await expect(readBinanceBtcUsdtPublicExecutionSnapshot({
      restBaseUrl: "https://fapi.binance.com",
      observedAt: "2026-05-16T00:00:03.000Z"
    })).resolves.toMatchObject({
      source_kind: "binance_production_public_stream",
      stream_marker: "binance-public-execution-1778889603000",
      agg_trades: [{
        trade_id: "456",
        is_buyer_maker: true
      }],
      authority_status: "read_only"
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

function jsonFetchResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload;
    }
  } as Response;
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
