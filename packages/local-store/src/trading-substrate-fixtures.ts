import type {
  AccountPositionRiskMirrorSurfaceRecord,
  OrderFillSurfaceRecord,
  PrivateReadinessPostureRecord,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceRecord,
  Ref
} from "@ouroboros/domain";

export interface TradingSubstrateFixtureIds {
  orderFillSurface: string;
  publicMarketLivenessSurface: string;
  privateReadinessPreflightSurface: string;
  privateReadinessPosture: string;
  accountPositionRiskMirrorSurface: string;
  runtime: string;
  candidate: string;
  stageBinding: string;
}

export interface TradingSubstrateFixtureItem {
  collection: "substrate-state-surfaces" | "private-readiness-postures";
  id: string;
  record:
    | OrderFillSurfaceRecord
    | PublicMarketLivenessSurfaceRecord
    | PrivateReadinessPreflightSurfaceRecord
    | PrivateReadinessPostureRecord
    | AccountPositionRiskMirrorSurfaceRecord;
}

export interface CreateTradingSubstrateFixtureItemsInput {
  ids: TradingSubstrateFixtureIds;
  ref: (record_kind: string, id: string) => Ref;
}

const binanceUsdsFuturesConnectorTransport = {
  transport_kind: "official_binance_connector",
  repository: "binance/binance-connector-js",
  package_name: "@binance/derivatives-trading-usds-futures",
  api_family: "derivatives_trading_usds_futures",
  supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
  production_base_url: "https://fapi.binance.com",
  testnet_base_url: "https://demo-fapi.binance.com",
  integration_role: "transport_only",
  authority_status: "not_live"
} as const;

export function createBinanceBtcusdtTradingSubstrateFixtureItems({
  ids,
  ref
}: CreateTradingSubstrateFixtureItemsInput): TradingSubstrateFixtureItem[] {
  const orderFillSurface: OrderFillSurfaceRecord = {
    record_kind: "order_fill_surface",
    version: 1,
    order_fill_surface_id: ids.orderFillSurface,
    surface_family: "order_fill",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    runtime_ref: ref("trading_system_runtime", ids.runtime),
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    stage_binding_ref: ref("stage_binding", ids.stageBinding),
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
    transport: binanceUsdsFuturesConnectorTransport,
    fixture_backed: true,
    simulated: true,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "not_live"
  };
  const publicMarketLivenessSurface: PublicMarketLivenessSurfaceRecord = {
    record_kind: "public_market_liveness_surface",
    version: 1,
    public_market_liveness_surface_id: ids.publicMarketLivenessSurface,
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
    transport: binanceUsdsFuturesConnectorTransport,
    fixture_backed: true,
    simulated: true,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "not_live"
  };
  const privateReadinessPreflightSurface: PrivateReadinessPreflightSurfaceRecord = {
    record_kind: "private_readiness_preflight_surface",
    version: 1,
    private_readiness_preflight_surface_id: ids.privateReadinessPreflightSurface,
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
    transport: binanceUsdsFuturesConnectorTransport,
    fixture_backed: true,
    simulated: true,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "not_live"
  };
  const privateReadinessPosture: PrivateReadinessPostureRecord = {
    record_kind: "private_readiness_posture",
    version: 1,
    private_readiness_posture_id: ids.privateReadinessPosture,
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    operator_approval_gate: {
      status: "not_ready",
      reason: "operator_live_private_read_approval_missing"
    },
    jurisdiction_risk_gate: {
      status: "review_required",
      reason: "operator_jurisdiction_not_recorded"
    },
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
    },
    secret_reference_configured: false,
    raw_secret_material_present: false,
    source_timestamp: "2026-05-16T00:00:00.000Z",
    observed_at: "2026-05-16T00:00:04.000Z",
    updated_at: "2026-05-16T00:00:04.000Z",
    source_kind: "fixture",
    source_ref: ref("fixture", "binance-btcusdt-private-readiness-posture"),
    fixture_backed: true,
    simulated: true,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "not_live"
  };
  const accountPositionRiskMirrorSurface: AccountPositionRiskMirrorSurfaceRecord = {
    record_kind: "account_position_risk_mirror_surface",
    version: 1,
    account_position_risk_mirror_surface_id: ids.accountPositionRiskMirrorSurface,
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
    transport: binanceUsdsFuturesConnectorTransport,
    fixture_backed: true,
    simulated: true,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "not_live"
  };

  return [
    { collection: "substrate-state-surfaces", id: ids.orderFillSurface, record: orderFillSurface },
    {
      collection: "substrate-state-surfaces",
      id: ids.publicMarketLivenessSurface,
      record: publicMarketLivenessSurface
    },
    {
      collection: "substrate-state-surfaces",
      id: ids.privateReadinessPreflightSurface,
      record: privateReadinessPreflightSurface
    },
    {
      collection: "private-readiness-postures",
      id: ids.privateReadinessPosture,
      record: privateReadinessPosture
    },
    {
      collection: "substrate-state-surfaces",
      id: ids.accountPositionRiskMirrorSurface,
      record: accountPositionRiskMirrorSurface
    }
  ];
}
