import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  AccountPositionRiskMirrorSurfaceRecord,
  OrderFillSurfaceReadModel,
  OrderFillSurfaceRecord,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord,
  Ref,
  TradingSubstrateInstrument,
  TradingSubstrateVenue
} from "@ouroboros/domain";

export interface OrderFillSurfaceQueryInput {
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
}

export interface PublicMarketLivenessSurfaceQueryInput {
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
}

export interface PrivateReadinessPreflightSurfaceQueryInput {
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
}

export interface AccountPositionRiskMirrorSurfaceQueryInput {
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
}

export function toOrderFillSurfaceReadModel(surface: OrderFillSurfaceRecord): OrderFillSurfaceReadModel {
  return {
    surface_id: surface.order_fill_surface_id,
    surface_family: surface.surface_family,
    surface_label: orderFillSurfaceLabel(surface),
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
    no_authority_label: formatSubstrateNoAuthority(surface.no_authority),
    authority_status: surface.authority_status
  };
}

export function toPublicMarketLivenessSurfaceReadModel(
  surface: PublicMarketLivenessSurfaceRecord
): PublicMarketLivenessSurfaceReadModel {
  return {
    surface_id: surface.public_market_liveness_surface_id,
    surface_family: surface.surface_family,
    surface_label: publicMarketLivenessSurfaceLabel(surface),
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
    no_authority_label: formatSubstrateNoAuthority(surface.no_authority),
    authority_status: surface.authority_status
  };
}

export function toPrivateReadinessPreflightSurfaceReadModel(
  surface: PrivateReadinessPreflightSurfaceRecord
): PrivateReadinessPreflightSurfaceReadModel {
  return {
    surface_id: surface.private_readiness_preflight_surface_id,
    surface_family: surface.surface_family,
    surface_label: privateReadinessPreflightSurfaceLabel(surface),
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
    no_authority_label: formatSubstrateNoAuthority(surface.no_authority),
    authority_status: surface.authority_status
  };
}

export function toAccountPositionRiskMirrorSurfaceReadModel(
  surface: AccountPositionRiskMirrorSurfaceRecord
): AccountPositionRiskMirrorSurfaceReadModel {
  return {
    surface_id: surface.account_position_risk_mirror_surface_id,
    surface_family: surface.surface_family,
    surface_label: accountPositionRiskMirrorSurfaceLabel(surface),
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
    no_authority_label: formatSubstrateNoAuthority(surface.no_authority),
    authority_status: surface.authority_status
  };
}

export function compareOrderFillSurfaces(a: OrderFillSurfaceRecord, b: OrderFillSurfaceRecord): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.order_fill_surface_id.localeCompare(b.order_fill_surface_id);
}

export function comparePublicMarketLivenessSurfaces(
  a: PublicMarketLivenessSurfaceRecord,
  b: PublicMarketLivenessSurfaceRecord
): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.public_market_liveness_surface_id.localeCompare(b.public_market_liveness_surface_id);
}

export function comparePrivateReadinessPreflightSurfaces(
  a: PrivateReadinessPreflightSurfaceRecord,
  b: PrivateReadinessPreflightSurfaceRecord
): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.private_readiness_preflight_surface_id.localeCompare(
    b.private_readiness_preflight_surface_id
  );
}

export function compareAccountPositionRiskMirrorSurfaces(
  a: AccountPositionRiskMirrorSurfaceRecord,
  b: AccountPositionRiskMirrorSurfaceRecord
): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.account_position_risk_mirror_surface_id.localeCompare(
    b.account_position_risk_mirror_surface_id
  );
}

export function matchesOrderFillSurfaceQuery(
  surface: OrderFillSurfaceRecord,
  query: OrderFillSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

export function matchesPublicMarketLivenessSurfaceQuery(
  surface: PublicMarketLivenessSurfaceRecord,
  query: PublicMarketLivenessSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

export function matchesPrivateReadinessPreflightSurfaceQuery(
  surface: PrivateReadinessPreflightSurfaceRecord,
  query: PrivateReadinessPreflightSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

export function matchesAccountPositionRiskMirrorSurfaceQuery(
  surface: AccountPositionRiskMirrorSurfaceRecord,
  query: AccountPositionRiskMirrorSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

export function isOrderFillSurfaceRecord(value: unknown): value is OrderFillSurfaceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<OrderFillSurfaceRecord>;
  return (
    raw.record_kind === "order_fill_surface" &&
    raw.version === 1 &&
    nonEmpty(raw.order_fill_surface_id) &&
    raw.surface_family === "order_fill" &&
    raw.venue === "binance_usd_m_futures" &&
    raw.instrument === "BTCUSDT" &&
    raw.product_category === "perpetual_futures" &&
    nonEmpty(raw.order_scope_ref) &&
    raw.cumulative_filled_quantity !== undefined &&
    raw.remaining_quantity !== undefined &&
    nonEmpty(raw.raw_upstream_status) &&
    isOrderFillPosture(raw.posture) &&
    nonEmpty(raw.source_timestamp) &&
    nonEmpty(raw.observed_at) &&
    nonEmpty(raw.updated_at) &&
    isTradingSubstrateFreshness(raw.freshness) &&
    isTradingSubstrateLiveness(raw.liveness) &&
    isTradingSubstrateSourceKind(raw.source_kind) &&
    isBinanceUsdsFuturesConnectorTransport(raw.transport) &&
    typeof raw.fixture_backed === "boolean" &&
    typeof raw.simulated === "boolean" &&
    raw.no_authority !== undefined &&
    raw.no_authority.live_exchange === false &&
    raw.no_authority.order_submission === false &&
    raw.no_authority.credentials === false &&
    (raw.authority_status === "not_live" || raw.authority_status === "read_only") &&
    (raw.runtime_ref === undefined || isRef(raw.runtime_ref, "trading_system_runtime")) &&
    (raw.candidate_ref === undefined || isRef(raw.candidate_ref, "trading_system_candidate")) &&
    (raw.stage_binding_ref === undefined || isRef(raw.stage_binding_ref, "stage_binding")) &&
    (raw.source_ref === undefined || isRef(raw.source_ref))
  );
}

export function isPublicMarketLivenessSurfaceRecord(
  value: unknown
): value is PublicMarketLivenessSurfaceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PublicMarketLivenessSurfaceRecord>;
  return (
    raw.record_kind === "public_market_liveness_surface" &&
    raw.version === 1 &&
    nonEmpty(raw.public_market_liveness_surface_id) &&
    raw.surface_family === "public_market_liveness" &&
    raw.venue === "binance_usd_m_futures" &&
    raw.instrument === "BTCUSDT" &&
    raw.product_category === "perpetual_futures" &&
    nonEmpty(raw.symbol_status) &&
    nonEmpty(raw.contract_type) &&
    nonEmpty(raw.price_tick_size) &&
    nonEmpty(raw.quantity_step_size) &&
    nonEmpty(raw.min_quantity) &&
    nonEmpty(raw.mark_price) &&
    nonEmpty(raw.index_price) &&
    nonEmpty(raw.funding_rate) &&
    nonEmpty(raw.next_funding_time) &&
    nonEmpty(raw.server_time) &&
    nonEmpty(raw.source_timestamp) &&
    nonEmpty(raw.observed_at) &&
    nonEmpty(raw.updated_at) &&
    isTradingSubstrateFreshness(raw.freshness) &&
    isTradingSubstrateLiveness(raw.liveness) &&
    isTradingSubstrateSourceKind(raw.source_kind) &&
    isBinanceUsdsFuturesConnectorTransport(raw.transport) &&
    typeof raw.fixture_backed === "boolean" &&
    typeof raw.simulated === "boolean" &&
    raw.no_authority !== undefined &&
    raw.no_authority.live_exchange === false &&
    raw.no_authority.order_submission === false &&
    raw.no_authority.credentials === false &&
    (raw.authority_status === "not_live" || raw.authority_status === "read_only") &&
    (raw.source_ref === undefined || isRef(raw.source_ref))
  );
}

export function isPrivateReadinessPreflightSurfaceRecord(
  value: unknown
): value is PrivateReadinessPreflightSurfaceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PrivateReadinessPreflightSurfaceRecord>;
  return (
    raw.record_kind === "private_readiness_preflight_surface" &&
    raw.version === 1 &&
    nonEmpty(raw.private_readiness_preflight_surface_id) &&
    raw.surface_family === "private_readiness_preflight" &&
    raw.venue === "binance_usd_m_futures" &&
    raw.instrument === "BTCUSDT" &&
    raw.product_category === "perpetual_futures" &&
    isPrivateReadinessPreflightGate(raw.credential_gate) &&
    isPrivateReadinessPreflightGate(raw.jurisdiction_gate) &&
    isPrivateReadinessPreflightGate(raw.operator_approval_gate) &&
    isPrivateReadinessPreflightGate(raw.private_account_read_gate) &&
    isPrivateReadinessPreflightGate(raw.private_position_read_gate) &&
    isPrivateReadinessPreflightGate(raw.user_data_stream_gate) &&
    isPrivateReadinessPreflightGate(raw.listen_key_gate) &&
    isPrivateReadinessPreflightGate(raw.order_submission_gate) &&
    isPrivateReadinessPreflightGate(raw.leverage_or_margin_mutation_gate) &&
    raw.account_information_endpoint === "GET /fapi/v3/account" &&
    raw.user_data_stream_endpoint === "POST /fapi/v1/listenKey" &&
    raw.order_endpoint === "POST /fapi/v1/order" &&
    nonEmpty(raw.next_blocked_action) &&
    nonEmpty(raw.next_blocked_reason) &&
    nonEmpty(raw.source_timestamp) &&
    nonEmpty(raw.observed_at) &&
    nonEmpty(raw.updated_at) &&
    isTradingSubstrateFreshness(raw.freshness) &&
    isTradingSubstrateLiveness(raw.liveness) &&
    isTradingSubstrateSourceKind(raw.source_kind) &&
    isBinanceUsdsFuturesConnectorTransport(raw.transport) &&
    typeof raw.fixture_backed === "boolean" &&
    typeof raw.simulated === "boolean" &&
    raw.no_authority !== undefined &&
    raw.no_authority.live_exchange === false &&
    raw.no_authority.order_submission === false &&
    raw.no_authority.credentials === false &&
    raw.authority_status === "not_live" &&
    (raw.source_ref === undefined || isRef(raw.source_ref))
  );
}

export function isAccountPositionRiskMirrorSurfaceRecord(
  value: unknown
): value is AccountPositionRiskMirrorSurfaceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<AccountPositionRiskMirrorSurfaceRecord>;
  return (
    raw.record_kind === "account_position_risk_mirror_surface" &&
    raw.version === 1 &&
    nonEmpty(raw.account_position_risk_mirror_surface_id) &&
    raw.surface_family === "account_position_risk_mirror" &&
    raw.venue === "binance_usd_m_futures" &&
    raw.instrument === "BTCUSDT" &&
    raw.product_category === "perpetual_futures" &&
    nonEmpty(raw.account_scope_ref) &&
    raw.asset === "USDT" &&
    (raw.account_mode === "single_asset" || raw.account_mode === "multi_assets") &&
    nonEmpty(raw.total_wallet_balance) &&
    nonEmpty(raw.total_unrealized_profit) &&
    nonEmpty(raw.total_margin_balance) &&
    nonEmpty(raw.available_balance) &&
    nonEmpty(raw.max_withdraw_amount) &&
    nonEmpty(raw.total_initial_margin) &&
    nonEmpty(raw.total_maint_margin) &&
    nonEmpty(raw.total_position_initial_margin) &&
    nonEmpty(raw.total_open_order_initial_margin) &&
    nonEmpty(raw.total_cross_wallet_balance) &&
    nonEmpty(raw.total_cross_un_pnl) &&
    (raw.position_side === "BOTH" || raw.position_side === "LONG" || raw.position_side === "SHORT") &&
    nonEmpty(raw.position_amount) &&
    nonEmpty(raw.entry_price) &&
    nonEmpty(raw.break_even_price) &&
    nonEmpty(raw.mark_price) &&
    nonEmpty(raw.unrealized_profit) &&
    nonEmpty(raw.liquidation_price) &&
    nonEmpty(raw.notional) &&
    raw.margin_asset === "USDT" &&
    (raw.margin_type === "cross" || raw.margin_type === "isolated") &&
    typeof raw.leverage === "number" &&
    Number.isFinite(raw.leverage) &&
    raw.leverage > 0 &&
    nonEmpty(raw.isolated_margin) &&
    nonEmpty(raw.isolated_wallet) &&
    nonEmpty(raw.initial_margin) &&
    nonEmpty(raw.maint_margin) &&
    nonEmpty(raw.position_initial_margin) &&
    nonEmpty(raw.open_order_initial_margin) &&
    (raw.adl_quantile === undefined || (Number.isInteger(raw.adl_quantile) && raw.adl_quantile >= 0)) &&
    (raw.risk_status === "nominal" || raw.risk_status === "watch" || raw.risk_status === "breach") &&
    nonEmpty(raw.risk_limit_profile_ref) &&
    nonEmpty(raw.max_notional_value) &&
    (raw.kill_switch_status === "inactive" || raw.kill_switch_status === "active") &&
    (raw.runtime_pause_status === "not_paused" || raw.runtime_pause_status === "paused") &&
    raw.account_information_endpoint === "GET /fapi/v3/account" &&
    raw.position_information_endpoint === "GET /fapi/v3/positionRisk" &&
    raw.leverage_endpoint === "POST /fapi/v1/leverage" &&
    raw.margin_type_endpoint === "POST /fapi/v1/marginType" &&
    nonEmpty(raw.next_blocked_action) &&
    nonEmpty(raw.next_blocked_reason) &&
    nonEmpty(raw.source_timestamp) &&
    nonEmpty(raw.observed_at) &&
    nonEmpty(raw.updated_at) &&
    isTradingSubstrateFreshness(raw.freshness) &&
    isTradingSubstrateLiveness(raw.liveness) &&
    isTradingSubstrateSourceKind(raw.source_kind) &&
    isBinanceUsdsFuturesConnectorTransport(raw.transport) &&
    typeof raw.fixture_backed === "boolean" &&
    typeof raw.simulated === "boolean" &&
    raw.no_authority !== undefined &&
    raw.no_authority.live_exchange === false &&
    raw.no_authority.order_submission === false &&
    raw.no_authority.credentials === false &&
    raw.authority_status === "not_live" &&
    (raw.source_ref === undefined || isRef(raw.source_ref))
  );
}

function orderFillSurfaceLabel(surface: OrderFillSurfaceRecord): string {
  const venueLabel = surface.venue === "binance_usd_m_futures" ? "Binance" : surface.venue;
  return `${venueLabel} ${surface.instrument} ${surface.surface_family}`;
}

function publicMarketLivenessSurfaceLabel(surface: PublicMarketLivenessSurfaceRecord): string {
  const venueLabel = surface.venue === "binance_usd_m_futures" ? "Binance" : surface.venue;
  return `${venueLabel} ${surface.instrument} ${surface.surface_family}`;
}

function privateReadinessPreflightSurfaceLabel(surface: PrivateReadinessPreflightSurfaceRecord): string {
  const venueLabel = surface.venue === "binance_usd_m_futures" ? "Binance" : surface.venue;
  return `${venueLabel} ${surface.instrument} ${surface.surface_family}`;
}

function accountPositionRiskMirrorSurfaceLabel(surface: AccountPositionRiskMirrorSurfaceRecord): string {
  const venueLabel = surface.venue === "binance_usd_m_futures" ? "Binance" : surface.venue;
  return `${venueLabel} ${surface.instrument} ${surface.surface_family}`;
}

function formatSubstrateNoAuthority(noAuthority: OrderFillSurfaceRecord["no_authority"]): string {
  return [
    `live_exchange=${noAuthority.live_exchange}`,
    `order_submission=${noAuthority.order_submission}`,
    `credentials=${noAuthority.credentials}`
  ].join(", ");
}

function isPrivateReadinessPreflightGate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PrivateReadinessPreflightSurfaceRecord["credential_gate"]>;
  return (
    (raw.status === "not_configured" ||
      raw.status === "not_evaluated" ||
      raw.status === "not_approved" ||
      raw.status === "disabled" ||
      raw.status === "blocked" ||
      raw.status === "ready") &&
    typeof raw.enabled === "boolean" &&
    nonEmpty(raw.reason)
  );
}

function isBinanceUsdsFuturesConnectorTransport(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<OrderFillSurfaceRecord["transport"]>;
  return (
    raw.transport_kind === "official_binance_connector" &&
    raw.repository === "binance/binance-connector-js" &&
    raw.package_name === "@binance/derivatives-trading-usds-futures" &&
    raw.api_family === "derivatives_trading_usds_futures" &&
    Array.isArray(raw.supported_endpoints) &&
    raw.supported_endpoints.includes("rest_api") &&
    raw.supported_endpoints.includes("websocket_api") &&
    raw.supported_endpoints.includes("websocket_streams") &&
    raw.production_base_url === "https://fapi.binance.com" &&
    raw.testnet_base_url === "https://testnet.binancefuture.com" &&
    raw.integration_role === "transport_only" &&
    raw.authority_status === "not_live"
  );
}

function isOrderFillPosture(value: unknown): boolean {
  return (
    value === "received" ||
    value === "working" ||
    value === "partially_filled" ||
    value === "filled" ||
    value === "cancel_pending" ||
    value === "canceled" ||
    value === "replace_pending" ||
    value === "replaced" ||
    value === "rejected" ||
    value === "expired" ||
    value === "suspended_or_blocked" ||
    value === "unknown"
  );
}

function isTradingSubstrateFreshness(value: unknown): boolean {
  return (
    value === "fresh" ||
    value === "delayed" ||
    value === "stale" ||
    value === "degraded" ||
    value === "disconnected"
  );
}

function isTradingSubstrateLiveness(value: unknown): boolean {
  return (
    value === "connected" ||
    value === "stale" ||
    value === "degraded" ||
    value === "disconnected" ||
    value === "fixture"
  );
}

function isTradingSubstrateSourceKind(value: unknown): boolean {
  return (
    value === "binance_user_data_stream" ||
    value === "binance_market_data_rest" ||
    value === "binance_rest_query" ||
    value === "local_config" ||
    value === "fixture"
  );
}

function isRef(value: unknown, recordKind?: string): value is Ref {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<Ref>;
  return (
    nonEmpty(raw.record_kind) &&
    nonEmpty(raw.id) &&
    (recordKind === undefined || raw.record_kind === recordKind)
  );
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
