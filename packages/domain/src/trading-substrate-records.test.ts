import { describe, expect, it } from "vitest";
import {
  TRADING_SUBSTRATE_CANONICAL_NOUNS,
  TRADING_SUBSTRATE_SURFACE_FAMILIES,
  TRADING_SUBSTRATE_SURFACE_TAXONOMY
} from "./index";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  AccountPositionRiskMirrorSurfaceRecord,
  OrderFillPosture,
  OrderFillSurfaceReadModel,
  OrderFillSurfaceRecord,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord,
  Ref
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("Trading substrate taxonomy contract", () => {
  it("keeps every landed substrate family in the canonical family list", () => {
    expect(TRADING_SUBSTRATE_SURFACE_FAMILIES).toEqual([
      "order_fill",
      "public_market_liveness",
      "private_readiness_preflight",
      "account_position_risk_mirror"
    ]);
  });

  it("separates compact canonical nouns from compatibility names and persisted keys", () => {
    expect(TRADING_SUBSTRATE_CANONICAL_NOUNS).toEqual([
      "market",
      "account",
      "position",
      "order",
      "execution",
      "risk",
      "gate",
      "connector",
      "authority",
      "snapshot",
      "event",
      "command",
      "decision"
    ]);

    expect(TRADING_SUBSTRATE_SURFACE_TAXONOMY).toMatchObject([
      {
        family: "order_fill",
        canonical_noun: "execution",
        data_role: "snapshot",
        compatibility_type_prefix: "OrderFillSurface",
        persisted_record_kind: "order_fill_surface",
        persisted_latest_key: "latest_order_fill_surface"
      },
      {
        family: "public_market_liveness",
        canonical_noun: "market",
        data_role: "snapshot",
        compatibility_type_prefix: "PublicMarketLivenessSurface",
        persisted_record_kind: "public_market_liveness_surface",
        persisted_latest_key: "latest_public_market_liveness_surface"
      },
      {
        family: "private_readiness_preflight",
        canonical_noun: "gate",
        data_role: "gate",
        compatibility_type_prefix: "PrivateReadinessPreflightSurface",
        persisted_record_kind: "private_readiness_preflight_surface",
        persisted_latest_key: "latest_private_readiness_preflight_surface"
      },
      {
        family: "account_position_risk_mirror",
        canonical_noun: "account",
        data_role: "snapshot",
        compatibility_type_prefix: "AccountPositionRiskMirrorSurface",
        persisted_record_kind: "account_position_risk_mirror_surface",
        persisted_latest_key: "latest_account_position_risk_mirror_surface"
      }
    ]);
  });
});

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

describe("Trading substrate public market and liveness surface records", () => {
  it("models Binance BTCUSDT public market posture without credentials or order authority", () => {
    const surfaceRef = ref(
      "public_market_liveness_surface",
      "binance-btcusdt-public-market-liveness-surface-001"
    );

    const surface = {
      record_kind: "public_market_liveness_surface",
      version: 1,
      public_market_liveness_surface_id: surfaceRef.id,
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
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_live_connector",
      source_kind: "fixture",
      source_ref: ref("fixture", "binance-btcusdt-public-market-liveness"),
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
    } satisfies PublicMarketLivenessSurfaceRecord;

    const readModel = {
      surface_id: surface.public_market_liveness_surface_id,
      surface_family: surface.surface_family,
      surface_label: "Binance BTCUSDT public_market_liveness",
      venue: surface.venue,
      instrument: surface.instrument,
      product_category: surface.product_category,
      symbol_status: surface.symbol_status,
      contract_type: surface.contract_type,
      price_tick_size: surface.price_tick_size,
      quantity_step_size: surface.quantity_step_size,
      min_quantity: surface.min_quantity,
      min_notional: surface.min_notional,
      mark_price: surface.mark_price,
      index_price: surface.index_price,
      estimated_settle_price: surface.estimated_settle_price,
      funding_rate: surface.funding_rate,
      interest_rate: surface.interest_rate,
      next_funding_time: surface.next_funding_time,
      server_time: surface.server_time,
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
    } satisfies PublicMarketLivenessSurfaceReadModel;

    expect(surface.surface_family).toBe("public_market_liveness");
    expect(surface.venue).toBe("binance_usd_m_futures");
    expect(surface.instrument).toBe("BTCUSDT");
    expect(surface.symbol_status).toBe("TRADING");
    expect(surface.price_tick_size).toBe("0.10");
    expect(surface.quantity_step_size).toBe("0.001");
    expect(surface.min_quantity).toBe("0.001");
    expect(surface.mark_price).toBe("65000.12340000");
    expect(surface.index_price).toBe("64995.00000000");
    expect(surface.funding_rate).toBe("0.00010000");
    expect(surface.next_funding_time).toBe("2026-05-16T08:00:00.000Z");
    expect(surface.server_time).toBe("2026-05-16T00:00:01.000Z");
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
    expect(readModel.surface_label).toBe("Binance BTCUSDT public_market_liveness");
    expect(readModel.authority_status).toBe("not_live");
  });
});

describe("Trading substrate private-readiness preflight surface records", () => {
  it("models Binance BTCUSDT private-read and live-binding gates without activating private authority", () => {
    const surfaceRef = ref(
      "private_readiness_preflight_surface",
      "binance-btcusdt-private-readiness-preflight-surface-001"
    );

    const surface = {
      record_kind: "private_readiness_preflight_surface",
      version: 1,
      private_readiness_preflight_surface_id: surfaceRef.id,
      surface_family: "private_readiness_preflight",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      credential_gate: {
        status: "not_configured",
        enabled: false,
        reason: "no_binance_api_key_configured"
      },
      jurisdiction_gate: {
        status: "not_evaluated",
        enabled: false,
        reason: "operator_jurisdiction_not_recorded"
      },
      operator_approval_gate: {
        status: "not_approved",
        enabled: false,
        reason: "operator_live_private_read_approval_missing"
      },
      private_account_read_gate: {
        status: "disabled",
        enabled: false,
        reason: "signed_user_data_account_read_deferred"
      },
      private_position_read_gate: {
        status: "disabled",
        enabled: false,
        reason: "signed_user_data_position_read_deferred"
      },
      user_data_stream_gate: {
        status: "disabled",
        enabled: false,
        reason: "listen_key_lifecycle_not_enabled"
      },
      listen_key_gate: {
        status: "disabled",
        enabled: false,
        reason: "listen_key_creation_forbidden_in_preflight"
      },
      order_submission_gate: {
        status: "disabled",
        enabled: false,
        reason: "trade_endpoint_forbidden"
      },
      leverage_or_margin_mutation_gate: {
        status: "disabled",
        enabled: false,
        reason: "account_mutation_forbidden"
      },
      account_information_endpoint: "GET /fapi/v3/account",
      user_data_stream_endpoint: "POST /fapi/v1/listenKey",
      order_endpoint: "POST /fapi/v1/order",
      next_blocked_action: "configure_private_read_credentials",
      next_blocked_reason: "credential_and_operator_gates_not_ready",
      source_timestamp: "2026-05-16T00:00:00.000Z",
      observed_at: "2026-05-16T00:00:03.000Z",
      updated_at: "2026-05-16T00:00:03.000Z",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_private_authority",
      source_kind: "fixture",
      source_ref: ref("fixture", "binance-btcusdt-private-readiness-preflight"),
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
    } satisfies PrivateReadinessPreflightSurfaceRecord;

    const readModel = {
      surface_id: surface.private_readiness_preflight_surface_id,
      surface_family: surface.surface_family,
      surface_label: "Binance BTCUSDT private_readiness_preflight",
      venue: surface.venue,
      instrument: surface.instrument,
      product_category: surface.product_category,
      credential_gate: surface.credential_gate,
      jurisdiction_gate: surface.jurisdiction_gate,
      operator_approval_gate: surface.operator_approval_gate,
      private_account_read_gate: surface.private_account_read_gate,
      private_position_read_gate: surface.private_position_read_gate,
      user_data_stream_gate: surface.user_data_stream_gate,
      listen_key_gate: surface.listen_key_gate,
      order_submission_gate: surface.order_submission_gate,
      leverage_or_margin_mutation_gate: surface.leverage_or_margin_mutation_gate,
      account_information_endpoint: surface.account_information_endpoint,
      user_data_stream_endpoint: surface.user_data_stream_endpoint,
      order_endpoint: surface.order_endpoint,
      next_blocked_action: surface.next_blocked_action,
      next_blocked_reason: surface.next_blocked_reason,
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
    } satisfies PrivateReadinessPreflightSurfaceReadModel;

    expect(surface.surface_family).toBe("private_readiness_preflight");
    expect(surface.venue).toBe("binance_usd_m_futures");
    expect(surface.instrument).toBe("BTCUSDT");
    expect(surface.credential_gate).toEqual({
      status: "not_configured",
      enabled: false,
      reason: "no_binance_api_key_configured"
    });
    expect(surface.listen_key_gate.enabled).toBe(false);
    expect(surface.user_data_stream_gate.enabled).toBe(false);
    expect(surface.private_account_read_gate.enabled).toBe(false);
    expect(surface.private_position_read_gate.enabled).toBe(false);
    expect(surface.order_submission_gate.enabled).toBe(false);
    expect(surface.leverage_or_margin_mutation_gate.enabled).toBe(false);
    expect(surface.account_information_endpoint).toBe("GET /fapi/v3/account");
    expect(surface.user_data_stream_endpoint).toBe("POST /fapi/v1/listenKey");
    expect(surface.order_endpoint).toBe("POST /fapi/v1/order");
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
    expect(readModel.no_authority_label).toBe("live_exchange=false, order_submission=false, credentials=false");
    expect(readModel.authority_status).toBe("not_live");
  });
});

describe("Trading substrate account-position-risk mirror surface records", () => {
  it("models Binance BTCUSDT account, position, and risk posture without private reads or mutation authority", () => {
    const surfaceRef = ref(
      "account_position_risk_mirror_surface",
      "binance-btcusdt-account-position-risk-mirror-surface-001"
    );

    const surface = {
      record_kind: "account_position_risk_mirror_surface",
      version: 1,
      account_position_risk_mirror_surface_id: surfaceRef.id,
      surface_family: "account_position_risk_mirror",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      account_scope_ref: "fixture-binance-usdt-account-mirror",
      asset: "USDT",
      account_mode: "single_asset",
      total_wallet_balance: "1250.00000000",
      total_unrealized_profit: "12.50000000",
      total_margin_balance: "1262.50000000",
      available_balance: "1100.00000000",
      max_withdraw_amount: "1100.00000000",
      total_initial_margin: "162.50000000",
      total_maint_margin: "35.00000000",
      total_position_initial_margin: "150.00000000",
      total_open_order_initial_margin: "12.50000000",
      total_cross_wallet_balance: "1250.00000000",
      total_cross_un_pnl: "12.50000000",
      position_side: "BOTH",
      position_amount: "0.015",
      entry_price: "65000.00000000",
      break_even_price: "65010.00000000",
      mark_price: "65833.33333333",
      unrealized_profit: "12.50000000",
      liquidation_price: "42000.00000000",
      notional: "987.50000000",
      margin_asset: "USDT",
      margin_type: "cross",
      leverage: 5,
      isolated_margin: "0.00000000",
      isolated_wallet: "0.00000000",
      initial_margin: "150.00000000",
      maint_margin: "35.00000000",
      position_initial_margin: "150.00000000",
      open_order_initial_margin: "12.50000000",
      adl_quantile: 2,
      risk_status: "watch",
      risk_limit_profile_ref: "fixture-btcusdt-risk-limit-profile-001",
      max_notional_value: "1000000",
      kill_switch_status: "inactive",
      runtime_pause_status: "not_paused",
      account_information_endpoint: "GET /fapi/v3/account",
      position_information_endpoint: "GET /fapi/v3/positionRisk",
      leverage_endpoint: "POST /fapi/v1/leverage",
      margin_type_endpoint: "POST /fapi/v1/marginType",
      next_blocked_action: "configure_private_read_credentials",
      next_blocked_reason: "mirror_is_fixture_backed_no_signed_user_data_read",
      source_timestamp: "2026-05-16T00:00:00.000Z",
      observed_at: "2026-05-16T00:00:04.000Z",
      updated_at: "2026-05-16T00:00:04.000Z",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_private_account_or_position_read",
      source_kind: "fixture",
      source_ref: ref("fixture", "binance-btcusdt-account-position-risk-mirror"),
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
    } satisfies AccountPositionRiskMirrorSurfaceRecord;

    const readModel = {
      surface_id: surface.account_position_risk_mirror_surface_id,
      surface_family: surface.surface_family,
      surface_label: "Binance BTCUSDT account_position_risk_mirror",
      venue: surface.venue,
      instrument: surface.instrument,
      product_category: surface.product_category,
      account_scope_ref: surface.account_scope_ref,
      asset: surface.asset,
      account_mode: surface.account_mode,
      total_wallet_balance: surface.total_wallet_balance,
      total_unrealized_profit: surface.total_unrealized_profit,
      total_margin_balance: surface.total_margin_balance,
      available_balance: surface.available_balance,
      max_withdraw_amount: surface.max_withdraw_amount,
      total_initial_margin: surface.total_initial_margin,
      total_maint_margin: surface.total_maint_margin,
      total_position_initial_margin: surface.total_position_initial_margin,
      total_open_order_initial_margin: surface.total_open_order_initial_margin,
      total_cross_wallet_balance: surface.total_cross_wallet_balance,
      total_cross_un_pnl: surface.total_cross_un_pnl,
      position_side: surface.position_side,
      position_amount: surface.position_amount,
      entry_price: surface.entry_price,
      break_even_price: surface.break_even_price,
      mark_price: surface.mark_price,
      unrealized_profit: surface.unrealized_profit,
      liquidation_price: surface.liquidation_price,
      notional: surface.notional,
      margin_asset: surface.margin_asset,
      margin_type: surface.margin_type,
      leverage: surface.leverage,
      isolated_margin: surface.isolated_margin,
      isolated_wallet: surface.isolated_wallet,
      initial_margin: surface.initial_margin,
      maint_margin: surface.maint_margin,
      position_initial_margin: surface.position_initial_margin,
      open_order_initial_margin: surface.open_order_initial_margin,
      adl_quantile: surface.adl_quantile,
      risk_status: surface.risk_status,
      risk_limit_profile_ref: surface.risk_limit_profile_ref,
      max_notional_value: surface.max_notional_value,
      kill_switch_status: surface.kill_switch_status,
      runtime_pause_status: surface.runtime_pause_status,
      account_information_endpoint: surface.account_information_endpoint,
      position_information_endpoint: surface.position_information_endpoint,
      leverage_endpoint: surface.leverage_endpoint,
      margin_type_endpoint: surface.margin_type_endpoint,
      next_blocked_action: surface.next_blocked_action,
      next_blocked_reason: surface.next_blocked_reason,
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
    } satisfies AccountPositionRiskMirrorSurfaceReadModel;

    expect(surface.surface_family).toBe("account_position_risk_mirror");
    expect(surface.venue).toBe("binance_usd_m_futures");
    expect(surface.instrument).toBe("BTCUSDT");
    expect(surface.asset).toBe("USDT");
    expect(surface.position_amount).toBe("0.015");
    expect(surface.unrealized_profit).toBe("12.50000000");
    expect(surface.risk_status).toBe("watch");
    expect(surface.kill_switch_status).toBe("inactive");
    expect(surface.runtime_pause_status).toBe("not_paused");
    expect(surface.account_information_endpoint).toBe("GET /fapi/v3/account");
    expect(surface.position_information_endpoint).toBe("GET /fapi/v3/positionRisk");
    expect(surface.leverage_endpoint).toBe("POST /fapi/v1/leverage");
    expect(surface.margin_type_endpoint).toBe("POST /fapi/v1/marginType");
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
    expect(readModel.no_authority_label).toBe("live_exchange=false, order_submission=false, credentials=false");
    expect(readModel.authority_status).toBe("not_live");
  });
});
