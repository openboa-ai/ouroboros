import type { GatewayMarketDataPort } from "@ouroboros/application/ports/market-data";
import type { MarketSnapshot } from "@ouroboros/application/trading/research/types";
import type { PublicMarketLivenessSurfaceRecord } from "@ouroboros/domain";

export function fakeGatewayMarketDataPort(input: {
  price?: number;
  observedAt?: string;
  snapshots?: Array<Partial<MarketSnapshot>>;
  executionSnapshots?: Array<{
    observed_at?: string;
    book_ticker?: {
      bid_price: string;
      bid_quantity: string;
      ask_price: string;
      ask_quantity: string;
      event_time?: string;
    };
    agg_trades?: Array<{
      trade_id: string;
      price: string;
      quantity: string;
      trade_time: string;
      is_buyer_maker?: boolean;
    }>;
  }>;
  failMarketSnapshot?: boolean;
  failPublicExecutionSnapshot?: boolean;
} = {}): GatewayMarketDataPort {
  const price = input.price ?? 65_000;
  const observedAt = input.observedAt ?? "2026-05-16T00:00:03.000Z";
  let snapshotIndex = 0;
  let executionSnapshotIndex = 0;
  const port: GatewayMarketDataPort = {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_rest",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: [
      "/fapi/v1/time",
      "/fapi/v1/exchangeInfo",
      "/fapi/v1/premiumIndex?symbol=BTCUSDT",
      "/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=30",
      "/fapi/v1/ticker/bookTicker?symbol=BTCUSDT",
      "/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100"
    ],
    authority_status: "read_only",
    async readMarketSnapshot(request: { observedAt?: string } = {}): Promise<MarketSnapshot> {
      if (input.failMarketSnapshot) {
        throw new Error("fake market data unavailable");
      }
      const snapshot = input.snapshots?.[Math.min(snapshotIndex, input.snapshots.length - 1)] ?? {};
      snapshotIndex += 1;
      const snapshotPrice = snapshot.price ?? price;
      return {
        symbol: snapshot.symbol ?? "BTCUSDT",
        price: snapshotPrice,
        moving_average_fast: snapshot.moving_average_fast ?? snapshotPrice + 25,
        moving_average_slow: snapshot.moving_average_slow ?? snapshotPrice - 25,
        volatility: snapshot.volatility ?? 0.001,
        expected_direction: snapshot.expected_direction ?? "long",
        observed_at: snapshot.observed_at ?? request.observedAt ?? observedAt
      };
    },
    async readPublicMarketLivenessSurface(
      request: { observedAt?: string } = {}
    ): Promise<PublicMarketLivenessSurfaceRecord> {
      const now = request.observedAt ?? observedAt;
      return {
        record_kind: "public_market_liveness_surface",
        version: 1,
        public_market_liveness_surface_id: `fake-binance-btcusdt-public-market-liveness-${Date.parse(now)}`,
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
        mark_price: String(price),
        index_price: String(price - 5),
        estimated_settle_price: String(price - 10),
        funding_rate: "0.00010000",
        interest_rate: "0.00010000",
        next_funding_time: "2026-05-16T08:00:00.000Z",
        server_time: now,
        source_timestamp: now,
        observed_at: now,
        updated_at: now,
        freshness: "fresh",
        liveness: "connected",
        source_kind: "binance_market_data_rest",
        source_ref: {
          record_kind: "binance_rest_endpoint",
          id: "fake-fapi-v1-exchangeInfo-premiumIndex-time"
        },
        transport: {
          transport_kind: "official_binance_connector",
          repository: "binance/binance-connector-js",
          package_name: "@binance/derivatives-trading-usds-futures",
          api_family: "derivatives_trading_usds_futures",
          supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
          production_base_url: "https://fapi.binance.com",
          testnet_base_url: "https://demo-fapi.binance.com",
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
      };
    },
    async readPublicExecutionSnapshot(request: { observedAt?: string } = {}) {
      if (input.failPublicExecutionSnapshot) {
        throw new Error("fake public execution stream unavailable");
      }
      const now = request.observedAt ?? observedAt;
      const executionSnapshot = input.executionSnapshots?.[
        Math.min(executionSnapshotIndex, input.executionSnapshots.length - 1)
      ] ?? {};
      executionSnapshotIndex += 1;
      return {
        symbol: "BTCUSDT",
        observed_at: executionSnapshot.observed_at ?? now,
        source_kind: "binance_production_public_stream",
        stream_marker: `fake-public-execution-${executionSnapshotIndex}`,
        book_ticker: executionSnapshot.book_ticker ?? {
          bid_price: String(price - 1),
          bid_quantity: "1.000",
          ask_price: String(price + 1),
          ask_quantity: "1.000",
          event_time: now
        },
        agg_trades: executionSnapshot.agg_trades ?? [],
        authority_status: "read_only"
      };
    }
  };
  return port;
}
