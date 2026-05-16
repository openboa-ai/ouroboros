import { describe, expect, it } from "vitest";
import type {
  OrderFillPosture,
  OrderFillSurfaceReadModel,
  OrderFillSurfaceRecord,
  Ref
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("Trading substrate order-fill surface records", () => {
  it("models Binance BTCUSDT perpetual futures order-fill posture without order authority", () => {
    const requiredPostures: OrderFillPosture[] = [
      "received",
      "working",
      "partially_filled",
      "filled",
      "canceled",
      "rejected",
      "expired",
      "unknown"
    ];
    const surfaceRef = ref("order_fill_surface", "binance-btcusdt-order-fill-surface-001");

    const surface = {
      record_kind: "order_fill_surface",
      version: 1,
      order_fill_surface_id: surfaceRef.id,
      surface_family: "order_fill",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      runtime_ref: ref("trading_system_runtime", "runtime-paper-btcusdt"),
      order_scope_ref: "fixture-btcusdt-paper-order-001",
      local_client_order_id: "fixture-btcusdt-paper-order-001",
      upstream_order_id: "fixture-upstream-order-001",
      side: "buy",
      order_type: "limit",
      time_in_force: "GTC",
      requested_quantity: "0.001",
      cumulative_filled_quantity: "0.0004",
      remaining_quantity: "0.0006",
      average_fill_price: "65000",
      last_fill_price: "65010",
      last_fill_quantity: "0.0004",
      raw_upstream_status: "PARTIALLY_FILLED",
      raw_upstream_execution_type: "TRADE",
      posture: "partially_filled",
      source_timestamp: "2026-05-16T00:00:02.000Z",
      observed_at: "2026-05-16T00:00:03.000Z",
      updated_at: "2026-05-16T00:00:03.000Z",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_live_connector",
      source_kind: "fixture",
      source_ref: ref("fixture", "binance-btcusdt-order-fill"),
      transport: {
        transport_kind: "official_binance_connector",
        repository: "binance/binance-connector-js",
        package_name: "@binance/derivatives-trading-usds-futures",
        api_family: "derivatives_trading_usds_futures",
        supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
        production_base_url: "https://fapi.binance.com",
        testnet_base_url: "https://testnet.binancefuture.com",
        integration_role: "transport_only",
        authority_status: "not_live"
      },
      fixture_backed: true,
      simulated: true,
      no_authority: {
        live_exchange: false,
        order_submission: false,
        credentials: false
      },
      authority_status: "not_live"
    } satisfies OrderFillSurfaceRecord;

    const readModel = {
      surface_id: surface.order_fill_surface_id,
      surface_family: surface.surface_family,
      surface_label: "Binance BTCUSDT order_fill",
      venue: surface.venue,
      instrument: surface.instrument,
      product_category: surface.product_category,
      order_scope_ref: surface.order_scope_ref,
      local_client_order_id: surface.local_client_order_id,
      upstream_order_id: surface.upstream_order_id,
      side: surface.side,
      order_type: surface.order_type,
      time_in_force: surface.time_in_force,
      requested_quantity: surface.requested_quantity,
      cumulative_filled_quantity: surface.cumulative_filled_quantity,
      remaining_quantity: surface.remaining_quantity,
      average_fill_price: surface.average_fill_price,
      last_fill_price: surface.last_fill_price,
      last_fill_quantity: surface.last_fill_quantity,
      raw_upstream_status: surface.raw_upstream_status,
      raw_upstream_execution_type: surface.raw_upstream_execution_type,
      posture: surface.posture,
      source_timestamp: surface.source_timestamp,
      observed_at: surface.observed_at,
      updated_at: surface.updated_at,
      freshness: surface.freshness,
      liveness: surface.liveness,
      degraded_reason: surface.degraded_reason,
      source_kind: surface.source_kind,
      source_ref: surface.source_ref,
      transport: surface.transport,
      fixture_backed: surface.fixture_backed,
      simulated: surface.simulated,
      no_authority: surface.no_authority,
      no_authority_label: "live_exchange=false, order_submission=false, credentials=false",
      authority_status: surface.authority_status
    } satisfies OrderFillSurfaceReadModel;

    expect(requiredPostures).toContain("received");
    expect(requiredPostures).toContain("working");
    expect(requiredPostures).toContain("partially_filled");
    expect(requiredPostures).toContain("filled");
    expect(requiredPostures).toContain("canceled");
    expect(requiredPostures).toContain("rejected");
    expect(requiredPostures).toContain("expired");
    expect(requiredPostures).toContain("unknown");
    expect(surface.venue).toBe("binance_usd_m_futures");
    expect(surface.instrument).toBe("BTCUSDT");
    expect(surface.product_category).toBe("perpetual_futures");
    expect(surface.transport).toMatchObject({
      repository: "binance/binance-connector-js",
      package_name: "@binance/derivatives-trading-usds-futures",
      integration_role: "transport_only",
      authority_status: "not_live"
    });
    expect(surface.no_authority).toEqual({
      live_exchange: false,
      order_submission: false,
      credentials: false
    });
    expect(readModel.surface_label).toBe("Binance BTCUSDT order_fill");
    expect(readModel.authority_status).toBe("not_live");
  });
});
