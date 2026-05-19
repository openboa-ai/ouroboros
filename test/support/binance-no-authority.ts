import { expect } from "vitest";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  BinanceUsdsFuturesConnectorTransport,
  PrivateReadGateDecision,
  PrivateReadinessPolicyDecision,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPreflightGate,
  PrivateReadinessPreflightGateStatus,
  PrivateReadinessPreflightSurfaceReadModel,
  PublicMarketLivenessSurfaceReadModel,
  OrderFillSurfaceReadModel,
  Ref,
  TradingGatewayContractReadModel,
  TradingSubstrateInstrument,
  TradingSubstrateNoAuthority,
  TradingSubstrateProductCategory,
  TradingSubstrateVenue
} from "@ouroboros/domain";

export const BINANCE_USDM_FUTURES_VENUE =
  "binance_usd_m_futures" satisfies TradingSubstrateVenue;

export const BINANCE_BTCUSDT_INSTRUMENT =
  "BTCUSDT" satisfies TradingSubstrateInstrument;

export const BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY =
  "perpetual_futures" satisfies TradingSubstrateProductCategory;

export const BINANCE_BTCUSDT_QUERY = {
  venue: BINANCE_USDM_FUTURES_VENUE,
  instrument: BINANCE_BTCUSDT_INSTRUMENT
} as const;

export const BINANCE_NO_AUTHORITY = {
  live_exchange: false,
  order_submission: false,
  credentials: false
} satisfies TradingSubstrateNoAuthority;

export const BINANCE_NO_AUTHORITY_LABEL =
  "live_exchange=false, order_submission=false, credentials=false";

export const BINANCE_USDM_CONNECTOR_TRANSPORT = {
  transport_kind: "official_binance_connector",
  repository: "binance/binance-connector-js",
  package_name: "@binance/derivatives-trading-usds-futures",
  api_family: "derivatives_trading_usds_futures",
  supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
  production_base_url: "https://fapi.binance.com",
  testnet_base_url: "https://demo-fapi.binance.com",
  integration_role: "transport_only",
  authority_status: "not_live"
} satisfies BinanceUsdsFuturesConnectorTransport;

export const BINANCE_PRIVATE_READINESS_SECURITY_TYPES = [
  "USER_DATA",
  "USER_STREAM",
  "TRADE"
] as const;

export const OPERATOR_ACTION_CONTROL_PATTERN =
  /<button[^>]*>\s*(Start|Pause|Resume|Stop|Promote)\s*<\/button>/i;

export const OPERATOR_SIDE_EFFECT_COMMAND_PATTERN =
  /Run provider|Run evaluator|Live order/i;

export const PRIVATE_AUTHORITY_TEXT_PATTERN =
  /broker|provider_api_key|apiKey|secretKey|signature=/i;

export function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

export function privateReadinessGate(
  status: PrivateReadinessPreflightGateStatus,
  enabled: boolean,
  reason: string
): PrivateReadinessPreflightGate {
  return { status, enabled, reason };
}

export function privateReadinessPolicyGate(
  status: PrivateReadinessPolicyGateInput["status"],
  reason: string
): PrivateReadinessPolicyGateInput {
  return { status, reason };
}

export function binanceBtcusdtNoAuthoritySurfaceExpectation(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    transport: {
      repository: BINANCE_USDM_CONNECTOR_TRANSPORT.repository,
      package_name: BINANCE_USDM_CONNECTOR_TRANSPORT.package_name,
      integration_role: BINANCE_USDM_CONNECTOR_TRANSPORT.integration_role,
      authority_status: BINANCE_USDM_CONNECTOR_TRANSPORT.authority_status
    },
    fixture_backed: true,
    simulated: true,
    no_authority: BINANCE_NO_AUTHORITY,
    authority_status: "not_live",
    ...overrides
  };
}

export function binancePrivateReadinessPolicyDecisionNoAuthorityExpectation(
  reasonCodes?: readonly string[]
): Record<string, unknown> {
  return {
    decision_kind: "private_readiness_policy_decision",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    binance_security_types: [...BINANCE_PRIVATE_READINESS_SECURITY_TYPES],
    no_private_read_performed: true,
    signed_request_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live",
    ...(reasonCodes ? { reason_codes: expect.arrayContaining([...reasonCodes]) } : {})
  };
}

export function binancePrivateReadinessPostureNoAuthorityExpectation(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    posture_label: "Binance BTCUSDT private_readiness_posture",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    operator_approval_gate: {
      status: "not_ready",
      reason: "operator_live_private_read_approval_missing"
    },
    jurisdiction_risk_gate: {
      status: "review_required",
      reason: "operator_jurisdiction_not_recorded"
    },
    fixture_backed: true,
    simulated: true,
    no_authority: BINANCE_NO_AUTHORITY,
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function expectNoOperatorActionControls(
  html: string,
  options: { includePrivateAuthorityTerms?: boolean } = {}
): void {
  expect(html).not.toMatch(OPERATOR_ACTION_CONTROL_PATTERN);
  expect(html).not.toMatch(OPERATOR_SIDE_EFFECT_COMMAND_PATTERN);
  if (options.includePrivateAuthorityTerms) {
    expect(html).not.toMatch(PRIVATE_AUTHORITY_TEXT_PATTERN);
  }
}

export function expectNoPrivateReadSecrets(serialized: string): void {
  expect(serialized).not.toContain("apiKey");
  expect(serialized).not.toContain("secretKey");
  expect(serialized).not.toContain("listenKey\":\"");
  expect(serialized).not.toMatch(/"signature"\s*:\s*"[^"]+"/i);
  expect(serialized).not.toMatch(/signature=[^"&\s]+/i);
  expect(serialized).not.toMatch(/hmac/i);
}

export function fixtureOrderFillSurface(
  overrides: Partial<OrderFillSurfaceReadModel> = {}
): OrderFillSurfaceReadModel {
  return {
    surface_id: "fixture-binance-btcusdt-order-fill-surface-001",
    surface_family: "order_fill",
    surface_label: "Binance BTCUSDT order_fill",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
    transport: BINANCE_USDM_CONNECTOR_TRANSPORT,
    fixture_backed: true,
    simulated: true,
    no_authority: BINANCE_NO_AUTHORITY,
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePublicMarketLivenessSurface(
  overrides: Partial<PublicMarketLivenessSurfaceReadModel> = {}
): PublicMarketLivenessSurfaceReadModel {
  return {
    surface_id: "fixture-binance-btcusdt-public-market-liveness-surface-001",
    surface_family: "public_market_liveness",
    surface_label: "Binance BTCUSDT public_market_liveness",
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
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePrivateReadinessPreflightSurface(
  overrides: Partial<PrivateReadinessPreflightSurfaceReadModel> = {}
): PrivateReadinessPreflightSurfaceReadModel {
  return {
    surface_id: "fixture-binance-btcusdt-private-readiness-preflight-surface-001",
    surface_family: "private_readiness_preflight",
    surface_label: "Binance BTCUSDT private_readiness_preflight",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
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
    order_submission_gate: privateReadinessGate("disabled", false, "trade_endpoint_forbidden"),
    leverage_or_margin_mutation_gate: privateReadinessGate("disabled", false, "account_mutation_forbidden"),
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
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePrivateReadinessPosture(
  overrides: Partial<PrivateReadinessPostureReadModel> = {}
): PrivateReadinessPostureReadModel {
  return {
    posture_id: "fixture-binance-btcusdt-private-readiness-posture-001",
    posture_label: "Binance BTCUSDT private_readiness_posture",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    operator_approval_gate: privateReadinessPolicyGate(
      "not_ready",
      "operator_live_private_read_approval_missing"
    ),
    jurisdiction_risk_gate: privateReadinessPolicyGate(
      "review_required",
      "operator_jurisdiction_not_recorded"
    ),
    live_binding_gate: privateReadinessPolicyGate(
      "not_ready",
      "live_binding_profile_not_configured"
    ),
    secret_handling_gate: privateReadinessPolicyGate(
      "not_ready",
      "secret_handling_profile_not_configured"
    ),
    stop_behavior_gate: privateReadinessPolicyGate(
      "not_ready",
      "operator_stop_behavior_not_recorded"
    ),
    secret_reference_configured: false,
    raw_secret_material_present: false,
    source_timestamp: "2026-05-16T00:00:00.000Z",
    observed_at: "2026-05-16T00:00:04.000Z",
    updated_at: "2026-05-16T00:00:04.000Z",
    source_kind: "fixture",
    source_ref: ref("fixture", "binance-btcusdt-private-readiness-posture"),
    fixture_backed: true,
    simulated: true,
    no_authority: BINANCE_NO_AUTHORITY,
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePrivateReadinessPolicyDecision(
  overrides: Partial<PrivateReadinessPolicyDecision> = {}
): PrivateReadinessPolicyDecision {
  return {
    decision_kind: "private_readiness_policy_decision",
    status: "not_ready",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    evaluated_at: "2026-05-16T00:00:04.000Z",
    source_surface_refs: [
      ref(
        "private_readiness_preflight_surface",
        "fixture-binance-btcusdt-private-readiness-preflight-surface-001"
      ),
      ref(
        "account_position_risk_mirror_surface",
        "fixture-binance-btcusdt-account-position-risk-mirror-surface-001"
      )
    ],
    checked_gates: [
      {
        dimension: "configuration",
        status: "not_ready",
        reason_code: "configuration_not_ready",
        reason: "no_binance_api_key_configured"
      },
      {
        dimension: "operator_approval",
        status: "not_ready",
        reason_code: "operator_approval_missing",
        reason: "operator_live_private_read_approval_missing"
      },
      {
        dimension: "jurisdiction_risk",
        status: "review_required",
        reason_code: "jurisdiction_review_required",
        reason: "operator_jurisdiction_not_recorded"
      },
      {
        dimension: "live_binding",
        status: "not_ready",
        reason_code: "live_binding_not_ready",
        reason: "live_binding_profile_not_configured"
      },
      {
        dimension: "secret_handling",
        status: "not_ready",
        reason_code: "secret_handling_not_ready",
        reason: "secret_handling_profile_not_configured"
      },
      {
        dimension: "account_position_freshness",
        status: "not_ready",
        reason_code: "account_position_freshness_not_ready",
        reason: "fixture_seed_no_private_account_or_position_read"
      },
      {
        dimension: "kill_switch",
        status: "ready",
        reason_code: "ready",
        reason: "inactive"
      },
      {
        dimension: "stop_behavior",
        status: "not_ready",
        reason_code: "stop_behavior_not_ready",
        reason: "operator_stop_behavior_not_recorded"
      },
      {
        dimension: "listen_key",
        status: "not_ready",
        reason_code: "listen_key_not_ready",
        reason: "listen_key_creation_forbidden_in_preflight"
      },
      {
        dimension: "user_data_stream",
        status: "not_ready",
        reason_code: "user_data_stream_not_ready",
        reason: "listen_key_lifecycle_not_enabled"
      },
      {
        dimension: "trade_authority",
        status: "ready",
        reason_code: "ready",
        reason: "TRADE authority disabled for private-read readiness"
      }
    ],
    reason_codes: [
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
    ],
    blocking_conditions: [
      "configuration: no_binance_api_key_configured",
      "operator_approval: operator_live_private_read_approval_missing",
      "jurisdiction_risk: operator_jurisdiction_not_recorded",
      "live_binding: live_binding_profile_not_configured",
      "secret_handling: secret_handling_profile_not_configured"
    ],
    required_next_actions: [
      "configure_private_read_credentials",
      "configuration",
      "operator_approval",
      "jurisdiction_risk",
      "live_binding",
      "secret_handling"
    ],
    binance_security_types: [...BINANCE_PRIVATE_READINESS_SECURITY_TYPES],
    no_private_read_performed: true,
    signed_request_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePrivateReadGateDecision(
  overrides: Partial<PrivateReadGateDecision> = {}
): PrivateReadGateDecision {
  return {
    decision_kind: "private_read_gate_decision",
    status: "not_ready",
    policy_status: "not_ready",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    evaluated_at: "2026-05-16T00:00:04.000Z",
    source_surface_refs: [
      ref(
        "private_readiness_preflight_surface",
        "fixture-binance-btcusdt-private-readiness-preflight-surface-001"
      ),
      ref(
        "account_position_risk_mirror_surface",
        "fixture-binance-btcusdt-account-position-risk-mirror-surface-001"
      )
    ],
    credential_reference_status: "not_configured",
    credential_reference_source: "policy_configuration_gate",
    signed_read_permission_preflight_status: "not_requested",
    signed_read_permission_preflight_source: "policy_decision",
    signed_request_construction_boundary_status: "not_requested",
    signed_request_construction_boundary_source: "policy_decision",
    signed_request_construction_required_components: [],
    signed_read_permission_grant_boundary_status: "not_requested",
    signed_read_permission_grant_boundary_source: "policy_decision",
    signed_request_execution_boundary_status: "not_requested",
    signed_request_execution_boundary_source: "policy_decision",
    account_balance_position_read_boundary_status: "not_requested",
    account_balance_position_read_boundary_source: "policy_decision",
    signed_read_permission: "not_granted",
    account_balance_position_read_authority: "not_granted",
    listen_key_user_data_stream_authority: "not_granted",
    leverage_margin_mutation_authority: "not_granted",
    order_submission_authority: "not_granted",
    gateway_result_authority: "not_granted",
    evidence_sealing_authority: "not_counted",
    promotion_authority: "not_granted",
    reason_codes: [
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
      "no_private_read_performed",
      "private_read_gate_not_ready"
    ],
    blocking_conditions: [
      "configuration: no_binance_api_key_configured",
      "operator_approval: operator_live_private_read_approval_missing",
      "jurisdiction_risk: operator_jurisdiction_not_recorded",
      "live_binding: live_binding_profile_not_configured",
      "secret_handling: secret_handling_profile_not_configured"
    ],
    required_next_actions: [
      "configure_private_read_credentials",
      "configuration",
      "operator_approval",
      "jurisdiction_risk",
      "live_binding",
      "secret_handling"
    ],
    binance_security_types: [...BINANCE_PRIVATE_READINESS_SECURITY_TYPES],
    raw_secret_material_present: false,
    no_private_read_performed: true,
    signed_request_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixtureTradingGatewayContract(
  overrides: Partial<TradingGatewayContractReadModel> = {}
): TradingGatewayContractReadModel {
  return {
    contract_kind: "trading_gateway_contract",
    venue: BINANCE_USDM_FUTURES_VENUE,
    instrument: BINANCE_BTCUSDT_INSTRUMENT,
    product_category: BINANCE_USDM_PERPETUAL_FUTURES_PRODUCT_CATEGORY,
    evaluated_at: "2026-05-16T00:00:08.000Z",
    gateway_name: "TradingGateway",
    sandbox_direct_exchange_access: false,
    gateway_required_for: ["USER_DATA", "TRADE"],
    tracking_chain: ["order_request", "gateway_result", "execution_result"],
    market_data: {
      security_type: "MARKET_DATA",
      status: "enabled",
      source: "public_market_liveness_surface",
      authority_status: "not_live"
    },
    account_read: {
      security_type: "USER_DATA",
      status: "disabled",
      endpoint_labels: ["GET /fapi/v3/account", "GET /fapi/v3/positionRisk"],
      authority_status: "not_granted",
      gateway_required: true
    },
    order_submission: {
      security_type: "TRADE",
      status: "disabled",
      endpoint_labels: ["POST /fapi/v1/order"],
      authority_status: "not_granted",
      gateway_required: true
    },
    no_authority: {
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false
    },
    authority_status: "not_live",
    ...overrides
  };
}

export function fixtureAccountPositionRiskMirrorSurface(
  overrides: Partial<AccountPositionRiskMirrorSurfaceReadModel> = {}
): AccountPositionRiskMirrorSurfaceReadModel {
  return {
    surface_id: "fixture-binance-btcusdt-account-position-risk-mirror-surface-001",
    surface_family: "account_position_risk_mirror",
    surface_label: "Binance BTCUSDT account_position_risk_mirror",
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
    no_authority_label: BINANCE_NO_AUTHORITY_LABEL,
    authority_status: "not_live",
    ...overrides
  };
}

export function fixturePrivateReadinessPolicyReadyPreflightSurface(
  overrides: Partial<PrivateReadinessPreflightSurfaceReadModel> = {}
): PrivateReadinessPreflightSurfaceReadModel {
  return fixturePrivateReadinessPreflightSurface({
    surface_id: "policy-ready-private-readiness-preflight-surface-001",
    credential_gate: privateReadinessGate("ready", true, "USER_DATA_secret_reference_configured"),
    jurisdiction_gate: privateReadinessGate("ready", true, "operator_jurisdiction_and_risk_policy_recorded"),
    operator_approval_gate: privateReadinessGate("ready", true, "operator_private_read_approval_recorded"),
    private_account_read_gate: privateReadinessGate("ready", true, "GET_/fapi/v3/account_preflight_ready"),
    private_position_read_gate: privateReadinessGate(
      "ready",
      true,
      "GET_/fapi/v3/positionRisk_preflight_ready"
    ),
    user_data_stream_gate: privateReadinessGate("ready", true, "USER_STREAM_lifecycle_policy_ready"),
    listen_key_gate: privateReadinessGate("ready", true, "listenKey_lifecycle_policy_ready"),
    order_submission_gate: privateReadinessGate(
      "disabled",
      false,
      "TRADE_endpoint_out_of_private_readiness_scope"
    ),
    leverage_or_margin_mutation_gate: privateReadinessGate("disabled", false, "account_mutation_out_of_scope"),
    next_blocked_action: "none",
    next_blocked_reason: "private_readiness_policy_ready",
    observed_at: "2026-05-16T00:00:01.000Z",
    updated_at: "2026-05-16T00:00:01.000Z",
    freshness: "fresh",
    liveness: "connected",
    source_ref: ref("fixture", "policy-ready-private-readiness-preflight"),
    degraded_reason: undefined,
    ...overrides
  });
}

export function fixturePrivateReadinessPolicyReadyAccountPositionRiskSurface(
  overrides: Partial<AccountPositionRiskMirrorSurfaceReadModel> = {}
): AccountPositionRiskMirrorSurfaceReadModel {
  return fixtureAccountPositionRiskMirrorSurface({
    surface_id: "policy-ready-account-position-risk-mirror-surface-001",
    account_scope_ref: "policy-ready-binance-usdt-account-mirror",
    total_unrealized_profit: "0.00000000",
    total_margin_balance: "1250.00000000",
    available_balance: "1250.00000000",
    max_withdraw_amount: "1250.00000000",
    total_initial_margin: "0.00000000",
    total_maint_margin: "0.00000000",
    total_position_initial_margin: "0.00000000",
    total_open_order_initial_margin: "0.00000000",
    total_cross_un_pnl: "0.00000000",
    position_amount: "0.000",
    entry_price: "0.00000000",
    break_even_price: "0.00000000",
    mark_price: "65000.00000000",
    unrealized_profit: "0.00000000",
    liquidation_price: "0.00000000",
    notional: "0.00000000",
    isolated_margin: "0.00000000",
    isolated_wallet: "0.00000000",
    initial_margin: "0.00000000",
    maint_margin: "0.00000000",
    position_initial_margin: "0.00000000",
    open_order_initial_margin: "0.00000000",
    adl_quantile: undefined,
    risk_status: "nominal",
    risk_limit_profile_ref: "policy-ready-btcusdt-risk-limit-profile-001",
    next_blocked_action: "none",
    next_blocked_reason: "account_position_policy_ready",
    observed_at: "2026-05-16T00:00:01.000Z",
    updated_at: "2026-05-16T00:00:01.000Z",
    freshness: "fresh",
    liveness: "connected",
    source_ref: ref("fixture", "policy-ready-account-position-risk-mirror"),
    degraded_reason: undefined,
    ...overrides
  });
}
