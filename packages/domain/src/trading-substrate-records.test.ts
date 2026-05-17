import { describe, expect, it } from "vitest";
import {
  TRADING_SUBSTRATE_BINANCE_USDM_TERMS,
  TRADING_SUBSTRATE_CANONICAL_NOUNS,
  TRADING_SUBSTRATE_SURFACE_FAMILIES,
  TRADING_SUBSTRATE_SURFACE_TAXONOMY,
  evaluatePrivateReadGateDecision,
  evaluatePrivateReadinessPolicyDecision
} from "./index";
import {
  BINANCE_BTCUSDT_INSTRUMENT,
  BINANCE_NO_AUTHORITY,
  BINANCE_NO_AUTHORITY_LABEL,
  BINANCE_PRIVATE_READINESS_SECURITY_TYPES,
  BINANCE_USDM_CONNECTOR_TRANSPORT,
  BINANCE_USDM_FUTURES_VENUE,
  BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
  binanceBtcusdtNoAuthoritySurfaceExpectation,
  binancePrivateReadinessPolicyDecisionNoAuthorityExpectation,
  fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface,
  fixturePrivateReadinessPolicyReadyPreflightSurface,
  privateReadinessGate,
  privateReadinessPolicyGate,
  ref
} from "../../../test/support/binance-no-authority";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  AccountPositionRiskMirrorSurfaceRecord,
  OrderFillPosture,
  OrderFillSurfaceReadModel,
  OrderFillSurfaceRecord,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord
} from "./index";

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
      "posture",
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

  it("keeps Binance USD-M Futures terms available for trading substrate naming", () => {
    expect(TRADING_SUBSTRATE_BINANCE_USDM_TERMS).toEqual([
      "symbol",
      "baseAsset",
      "quoteAsset",
      "account",
      "asset",
      "balance",
      "walletBalance",
      "availableBalance",
      "marginBalance",
      "initialMargin",
      "maintMargin",
      "openOrderInitialMargin",
      "positionInitialMargin",
      "position",
      "positionSide",
      "positionAmt",
      "entryPrice",
      "breakEvenPrice",
      "order",
      "orderId",
      "clientOrderId",
      "trade",
      "side",
      "type",
      "quantity",
      "price",
      "origQty",
      "executedQty",
      "cumQty",
      "avgPrice",
      "status",
      "userDataStream",
      "listenKey",
      "margin",
      "marginAsset",
      "marginType",
      "leverage",
      "markPrice",
      "liquidationPrice",
      "notional",
      "unrealizedProfit",
      "unRealizedProfit",
      "timeInForce",
      "reduceOnly",
      "tickSize",
      "stepSize",
      "minQty",
      "minNotional",
      "BOTH",
      "LONG",
      "SHORT",
      "BUY",
      "SELL",
      "LIMIT",
      "MARKET",
      "STOP",
      "STOP_MARKET",
      "TAKE_PROFIT",
      "TAKE_PROFIT_MARKET",
      "TRAILING_STOP_MARKET",
      "GTC",
      "IOC",
      "FOK",
      "GTX",
      "GTD",
      "NEW",
      "PARTIALLY_FILLED",
      "FILLED",
      "CANCELED",
      "REJECTED",
      "EXPIRED",
      "USER_DATA",
      "USER_STREAM",
      "MARKET_DATA",
      "TRADE"
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
      venue: BINANCE_USDM_FUTURES_VENUE,
      instrument: BINANCE_BTCUSDT_INSTRUMENT,
      product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
        ...BINANCE_USDM_CONNECTOR_TRANSPORT
      },
      fixture_backed: true,
      simulated: true,
      no_authority: BINANCE_NO_AUTHORITY,
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
      no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
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
    expect(surface).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation());
    expect(surface.venue).toBe(BINANCE_USDM_FUTURES_VENUE);
    expect(surface.instrument).toBe(BINANCE_BTCUSDT_INSTRUMENT);
    expect(surface.product_category).toBe(BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY);
    expect(surface.transport).toMatchObject({
      repository: "binance/binance-connector-js",
      package_name: "@binance/derivatives-trading-usds-futures",
      integration_role: "transport_only",
      authority_status: "not_live"
    });
    expect(surface.no_authority).toEqual(BINANCE_NO_AUTHORITY);
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
      venue: BINANCE_USDM_FUTURES_VENUE,
      instrument: BINANCE_BTCUSDT_INSTRUMENT,
      product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
      transport: BINANCE_USDM_CONNECTOR_TRANSPORT,
      fixture_backed: true,
      simulated: true,
      no_authority: BINANCE_NO_AUTHORITY,
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
      no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
      authority_status: surface.authority_status
    } satisfies PublicMarketLivenessSurfaceReadModel;

    expect(surface.surface_family).toBe("public_market_liveness");
    expect(surface).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation());
    expect(surface.venue).toBe(BINANCE_USDM_FUTURES_VENUE);
    expect(surface.instrument).toBe(BINANCE_BTCUSDT_INSTRUMENT);
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
    expect(surface.no_authority).toEqual(BINANCE_NO_AUTHORITY);
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
      venue: BINANCE_USDM_FUTURES_VENUE,
      instrument: BINANCE_BTCUSDT_INSTRUMENT,
      product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
      transport: BINANCE_USDM_CONNECTOR_TRANSPORT,
      fixture_backed: true,
      simulated: true,
      no_authority: BINANCE_NO_AUTHORITY,
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
      no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
      authority_status: surface.authority_status
    } satisfies PrivateReadinessPreflightSurfaceReadModel;

    expect(surface.surface_family).toBe("private_readiness_preflight");
    expect(surface).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation());
    expect(surface.venue).toBe(BINANCE_USDM_FUTURES_VENUE);
    expect(surface.instrument).toBe(BINANCE_BTCUSDT_INSTRUMENT);
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
    expect(surface.no_authority).toEqual(BINANCE_NO_AUTHORITY);
    expect(readModel.no_authority_label).toBe(BINANCE_NO_AUTHORITY_LABEL);
    expect(readModel.authority_status).toBe("not_live");
  });
});

describe("Trading substrate private-readiness policy decisions", () => {
  it("returns ready from explicit Binance USER_DATA and USER_STREAM posture without private reads", () => {
    const decision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    expect(decision).toMatchObject({
      ...binancePrivateReadinessPolicyDecisionNoAuthorityExpectation(),
      status: "ready"
    });
    expect(decision.binance_security_types).toEqual([...BINANCE_PRIVATE_READINESS_SECURITY_TYPES]);
    expect(decision.reason_codes).toEqual(["no_private_read_performed"]);
    expect(decision.blocking_conditions).toEqual([]);
    expect(decision.checked_gates.map((gate) => gate.dimension)).toEqual([
      "configuration",
      "operator_approval",
      "jurisdiction_risk",
      "live_binding",
      "secret_handling",
      "account_position_freshness",
      "kill_switch",
      "stop_behavior",
      "listen_key",
      "user_data_stream",
      "trade_authority"
    ]);
  });

  it("uses stored posture gates for operator approval and jurisdiction risk when provided", () => {
    const decision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      operator_approval_gate: privateReadinessPolicyGate(
        "blocked",
        "operator_approval_posture_blocked_for_test"
      ),
      jurisdiction_risk_gate: privateReadinessPolicyGate(
        "review_required",
        "jurisdiction_risk_posture_review_for_test"
      ),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    expect(decision.status).toBe("blocked");
    expect(decision.reason_codes).toEqual(expect.arrayContaining([
      "operator_approval_blocked",
      "jurisdiction_review_required",
      "no_private_read_performed"
    ]));
    expect(decision.checked_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dimension: "operator_approval",
        status: "blocked",
        reason_code: "operator_approval_blocked",
        reason: "operator_approval_posture_blocked_for_test"
      }),
      expect.objectContaining({
        dimension: "jurisdiction_risk",
        status: "review_required",
        reason_code: "jurisdiction_review_required",
        reason: "jurisdiction_risk_posture_review_for_test"
      })
    ]));
    expect(decision.blocking_conditions).toEqual(expect.arrayContaining([
      "operator_approval: operator_approval_posture_blocked_for_test",
      "jurisdiction_risk: jurisdiction_risk_posture_review_for_test"
    ]));
  });

  it("returns not_ready with explicit reason codes for fixture-backed no-authority posture", () => {
    const decision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface({
        credential_gate: privateReadinessGate("not_configured", false, "no_binance_api_key_configured"),
        jurisdiction_gate: privateReadinessGate("not_evaluated", false, "operator_jurisdiction_not_recorded"),
        operator_approval_gate: privateReadinessGate(
          "not_approved",
          false,
          "operator_live_private_read_approval_missing"
        ),
        private_account_read_gate: privateReadinessGate(
          "disabled",
          false,
          "signed_user_data_account_read_deferred"
        ),
        private_position_read_gate: privateReadinessGate(
          "disabled",
          false,
          "signed_user_data_position_read_deferred"
        ),
        user_data_stream_gate: privateReadinessGate("disabled", false, "listen_key_lifecycle_not_enabled"),
        listen_key_gate: privateReadinessGate(
          "disabled",
          false,
          "listen_key_creation_forbidden_in_preflight"
        ),
        freshness: "stale",
        liveness: "degraded",
        degraded_reason: "fixture_seed_no_private_authority"
      }),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface({
        risk_status: "watch",
        freshness: "stale",
        liveness: "degraded",
        degraded_reason: "fixture_seed_no_private_account_or_position_read"
      }),
      live_binding_gate: {
        status: "not_ready",
        reason: "live_binding_profile_not_configured"
      },
      secret_handling_gate: {
        status: "not_ready",
        reason: "secret_handling_profile_not_configured"
      },
      stop_behavior_gate: {
        status: "not_ready",
        reason: "operator_stop_behavior_not_recorded"
      }
    });

    expect(decision.status).toBe("not_ready");
    expect(decision).toMatchObject(binancePrivateReadinessPolicyDecisionNoAuthorityExpectation([
      "configuration_not_ready",
      "operator_approval_missing",
      "jurisdiction_review_required",
      "live_binding_not_ready",
      "secret_handling_not_ready",
      "account_position_freshness_not_ready",
      "stop_behavior_not_ready",
      "listen_key_not_ready",
      "user_data_stream_not_ready",
      "private_account_read_not_ready",
      "private_position_read_not_ready",
      "no_private_read_performed"
    ]));
    expect(decision.reason_codes).toEqual(expect.arrayContaining([
      "configuration_not_ready",
      "operator_approval_missing",
      "jurisdiction_review_required",
      "live_binding_not_ready",
      "secret_handling_not_ready",
      "account_position_freshness_not_ready",
      "stop_behavior_not_ready",
      "listen_key_not_ready",
      "user_data_stream_not_ready",
      "private_account_read_not_ready",
      "private_position_read_not_ready",
      "no_private_read_performed"
    ]));
    expect(decision.blocking_conditions).toEqual(expect.arrayContaining([
      "configuration: no_binance_api_key_configured",
      "operator_approval: operator_live_private_read_approval_missing",
      "secret_handling: secret_handling_profile_not_configured"
    ]));
  });

  it("returns blocked when stop controls or Binance TRADE authority expand beyond private-read scope", () => {
    const decision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface({
        order_submission_gate: privateReadinessGate("ready", true, "TRADE_endpoint_enabled")
      }),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface({
        kill_switch_status: "active"
      }),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "blocked",
        reason: "runtime_stop_semantics_conflict_with_active_kill_switch"
      }
    });

    expect(decision.status).toBe("blocked");
    expect(decision).toMatchObject(binancePrivateReadinessPolicyDecisionNoAuthorityExpectation([
      "kill_switch_active",
      "stop_behavior_blocked",
      "trade_authority_scope_expanded",
      "no_private_read_performed"
    ]));
    expect(decision.reason_codes).toEqual(expect.arrayContaining([
      "kill_switch_active",
      "stop_behavior_blocked",
      "trade_authority_scope_expanded",
      "no_private_read_performed"
    ]));
    expect(decision.blocking_conditions).toEqual(expect.arrayContaining([
      "kill_switch: active",
      "stop_behavior: runtime_stop_semantics_conflict_with_active_kill_switch",
      "trade_authority: TRADE_endpoint_enabled"
    ]));
  });
});

describe("Trading substrate PrivateReadGate decisions", () => {
  it("keeps a ready Binance USER_DATA policy disabled until signed-read authority is granted", () => {
    const policyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    const gateDecision = evaluatePrivateReadGateDecision({
      evaluated_at: "2026-05-16T00:00:03.000Z",
      policy_decision: policyDecision
    });

    expect(gateDecision).toMatchObject({
      decision_kind: "private_read_gate_decision",
      status: "ready_but_disabled",
      policy_status: "ready",
      venue: BINANCE_USDM_FUTURES_VENUE,
      instrument: BINANCE_BTCUSDT_INSTRUMENT,
      product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
      credential_reference_status: "reference_only",
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      leverage_margin_mutation_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_decision_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(gateDecision.binance_security_types).toEqual([...BINANCE_PRIVATE_READINESS_SECURITY_TYPES]);
    expect(gateDecision.reason_codes).toEqual(expect.arrayContaining([
      "no_private_read_performed",
      "private_read_gate_ready_but_disabled"
    ]));
    expect(gateDecision.required_next_actions).toContain(
      "grant_signed_read_authority_before_private_user_data_reads"
    );
  });

  it("maps policy states into gate states without granting account, stream, order, or promotion authority", () => {
    const notReadyPolicyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface({
        credential_gate: privateReadinessGate("not_configured", false, "no_binance_api_key_configured")
      }),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });
    const reviewRequiredPolicyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface({
        jurisdiction_gate: privateReadinessGate("not_evaluated", false, "operator_jurisdiction_not_recorded")
      }),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });
    const blockedPolicyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface({
        order_submission_gate: privateReadinessGate("ready", true, "TRADE_endpoint_enabled")
      }),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_references_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    const expectedGateStatuses = [
      [notReadyPolicyDecision, "not_ready"],
      [reviewRequiredPolicyDecision, "review_required"],
      [blockedPolicyDecision, "blocked"]
    ] as const;

    for (const [policyDecision, expectedStatus] of expectedGateStatuses) {
      const gateDecision = evaluatePrivateReadGateDecision({
        evaluated_at: "2026-05-16T00:00:03.000Z",
        policy_decision: policyDecision
      });

      expect(gateDecision.status).toBe(expectedStatus);
      expect(gateDecision.signed_read_permission).toBe("not_granted");
      expect(gateDecision.account_balance_position_read_authority).toBe("not_granted");
      expect(gateDecision.listen_key_user_data_stream_authority).toBe("not_granted");
      expect(gateDecision.leverage_margin_mutation_authority).toBe("not_granted");
      expect(gateDecision.order_submission_authority).toBe("not_granted");
      expect(gateDecision.gateway_decision_authority).toBe("not_granted");
      expect(gateDecision.evidence_sealing_authority).toBe("not_counted");
      expect(gateDecision.promotion_authority).toBe("not_granted");
    }
  });

  it("carries reference-only credential metadata without granting signed USER_DATA reads", () => {
    const credentialReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const policyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "not_ready",
        reason: "live_binding_profile_not_configured"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_reference_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    const gateDecision = evaluatePrivateReadGateDecision({
      evaluated_at: "2026-05-16T00:00:03.000Z",
      policy_decision: policyDecision,
      credential_reference: {
        configured: true,
        ref: credentialReference,
        raw_secret_material_present: false,
        source: "private_readiness_posture"
      }
    });

    expect(gateDecision).toMatchObject({
      credential_reference_status: "reference_only",
      credential_reference_source: "private_readiness_posture",
      credential_reference_ref: credentialReference,
      raw_secret_material_present: false,
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_decision_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      authority_status: "not_live"
    });
    expect(gateDecision.status).toBe("not_ready");
    expect(gateDecision.reason_codes).toEqual(expect.arrayContaining([
      "credential_reference_only",
      "private_read_gate_not_ready",
      "no_private_read_performed"
    ]));
  });

  it("surfaces USER_DATA signed-read permission preflight without granting private reads", () => {
    const credentialReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const policyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_reference_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    const gateDecision = evaluatePrivateReadGateDecision({
      evaluated_at: "2026-05-16T00:00:03.000Z",
      policy_decision: policyDecision,
      credential_reference: {
        configured: true,
        ref: credentialReference,
        raw_secret_material_present: false,
        source: "private_readiness_posture"
      }
    });

    expect(gateDecision).toMatchObject({
      status: "ready_but_disabled",
      credential_reference_status: "reference_only",
      signed_read_permission_preflight_status: "preflight_only",
      signed_read_permission_preflight_source: "policy_decision",
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      leverage_margin_mutation_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_decision_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(gateDecision.reason_codes).toEqual(expect.arrayContaining([
      "signed_read_permission_preflight_only",
      "private_read_gate_ready_but_disabled",
      "no_private_read_performed"
    ]));
    expect(gateDecision.required_next_actions).toContain(
      "grant_signed_read_authority_before_private_user_data_reads"
    );
  });

  it("surfaces USER_DATA signed request construction boundary without generating signatures", () => {
    const credentialReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const policyDecision = evaluatePrivateReadinessPolicyDecision({
      evaluated_at: "2026-05-16T00:00:02.000Z",
      private_readiness_preflight_surface: fixturePrivateReadinessPolicyReadyPreflightSurface(),
      account_position_risk_mirror_surface: fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(),
      live_binding_gate: {
        status: "ready",
        reason: "operator_bound_private_read_profile_recorded"
      },
      secret_handling_gate: {
        status: "ready",
        reason: "secret_reference_recorded_without_values"
      },
      stop_behavior_gate: {
        status: "ready",
        reason: "kill_switch_and_runtime_pause_semantics_recorded"
      }
    });

    const gateDecision = evaluatePrivateReadGateDecision({
      evaluated_at: "2026-05-16T00:00:03.000Z",
      policy_decision: policyDecision,
      credential_reference: {
        configured: true,
        ref: credentialReference,
        raw_secret_material_present: false,
        source: "private_readiness_posture"
      }
    });

    expect(gateDecision).toMatchObject({
      status: "ready_but_disabled",
      credential_reference_status: "reference_only",
      signed_read_permission_preflight_status: "preflight_only",
      signed_request_construction_boundary_status: "dry_run_only",
      signed_request_construction_boundary_source: "policy_decision",
      signed_request_construction_required_components: [
        "API key",
        "timestamp",
        "recvWindow",
        "query string",
        "signature",
        "signed endpoint"
      ],
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      leverage_margin_mutation_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_decision_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(gateDecision.reason_codes).toEqual(expect.arrayContaining([
      "signed_request_construction_boundary_only",
      "private_read_gate_ready_but_disabled",
      "no_private_read_performed"
    ]));
    expect(gateDecision.required_next_actions).toEqual(expect.arrayContaining([
      "grant_signed_read_authority_before_private_user_data_reads",
      "grant_signed_request_authority_before_private_user_data_reads"
    ]));
    expect(JSON.stringify(gateDecision)).not.toMatch(/\"signature\"\\s*:\\s*\"/i);
    expect(JSON.stringify(gateDecision)).not.toContain("secretKey");
    expect(JSON.stringify(gateDecision)).not.toContain("apiKey");
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
      venue: BINANCE_USDM_FUTURES_VENUE,
      instrument: BINANCE_BTCUSDT_INSTRUMENT,
      product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
      transport: BINANCE_USDM_CONNECTOR_TRANSPORT,
      fixture_backed: true,
      simulated: true,
      no_authority: BINANCE_NO_AUTHORITY,
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
      no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
      authority_status: surface.authority_status
    } satisfies AccountPositionRiskMirrorSurfaceReadModel;

    expect(surface.surface_family).toBe("account_position_risk_mirror");
    expect(surface).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation());
    expect(surface.venue).toBe(BINANCE_USDM_FUTURES_VENUE);
    expect(surface.instrument).toBe(BINANCE_BTCUSDT_INSTRUMENT);
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
    expect(surface.no_authority).toEqual(BINANCE_NO_AUTHORITY);
    expect(readModel.no_authority_label).toBe(BINANCE_NO_AUTHORITY_LABEL);
    expect(readModel.authority_status).toBe("not_live");
  });
});
