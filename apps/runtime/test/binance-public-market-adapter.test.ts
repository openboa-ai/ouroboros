import { describe, expect, it } from "vitest";
import { readBinanceBtcUsdtPublicMarketLivenessSurface } from "@ouroboros/adapters/binance/public-market-adapter";

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
});

function response<T>(payload: T) {
  return {
    async data() {
      return payload;
    }
  };
}
