import type {
  PrivateReadinessPolicyDecision,
  PrivateReadinessPolicyGateInput
} from "./private-readiness-policy";
import type { PrivateReadGateDecision } from "./private-read-gate";

export * from "./private-read-gate";
export * from "./private-readiness-policy";

export type FixtureMode = "fixture_convenience_mode" | "local_promoted_candidate_bundle";

export type NonAuthorityStatus =
  | "not_executed"
  | "not_probed"
  | "not_scanned"
  | "not_mounted"
  | "not_granted"
  | "not_counted"
  | "not_promoted"
  | "not_live";

export type ProviderKind = "codex_cli" | "claude_code" | "local_process" | "fixture_only";

export type AgentRunPurpose =
  | "candidate_generation"
  | "candidate_generation_placeholder"
  | "artifact_change_proposal_generation";

export type AgentRunStatus = "succeeded" | "failed" | "rejected" | "fixture_placeholder";

export type CandidateStatus = "fixture_only" | "materialized";

export type CandidateMaterializationStatus = "materialized" | "failed";

export type StageBindingStage = "backtest" | "paper" | "live";

export type StageBindingProfile = "backtest" | "paper" | "live";

export type TradingSystemExecutionMode = "backtest" | "paper" | "live";

export type TradingSystemExecutionModeSupportStatus = "available" | "planned";

export type TradingApiProviderMarketDataPlane =
  | "historical_replay"
  | "realtime_market_data";

export type TradingApiProviderAccountPlane =
  | "simulated_account"
  | "paper_account"
  | "live_account";

export type TradingApiProviderOrderPlane =
  | "order_validation_only"
  | "paper_order_sink"
  | "gated_live_order_gateway";

export type TradingSystemExecutionAuthorityStatus =
  | "not_live"
  | "paper_only"
  | "live_requires_gateway";

export interface TradingSystemExecutionModeContractReadModel {
  mode: TradingSystemExecutionMode;
  label: string;
  support_status: TradingSystemExecutionModeSupportStatus;
  stage_binding_profile: StageBindingProfile;
  artifact_contract: {
    artifact_shape: "opaque_trading_system";
    api_provider_boundary: "TradingApiProvider";
    credentials_access: "forbidden";
    order_submission: "forbidden";
  };
  provider_contract: {
    market_data: TradingApiProviderMarketDataPlane;
    account: TradingApiProviderAccountPlane;
    order_plane: TradingApiProviderOrderPlane;
    credentials_scope: "none_required" | "provider_side_only";
  };
  authority: {
    artifact_has_credentials: false;
    artifact_has_order_authority: false;
    provider_may_submit_orders: boolean;
    live_exchange_authority: boolean;
    status: TradingSystemExecutionAuthorityStatus;
  };
  required_controls: string[];
  forbidden_artifact_capabilities: string[];
}

export type EvaluationExecutionMode =
  | "host_local"
  | "containerized_local"
  | "containerized_remote";

export type RuntimePlacementKind =
  | EvaluationExecutionMode
  | "provider_managed"
  | "endpoint_backed"
  | "fixture_local_placeholder";

export type RuntimePlacementToolingKind =
  | "host_process"
  | "docker_compose"
  | "docker_sandbox"
  | "remote_container"
  | "provider_session"
  | "http_endpoint"
  | "fixture_only";

export type RunnableArtifactKind = "python_file" | "container_image";

export type RunnableArtifactRuntimeKind = "python" | "container_image";

export type RunnableArtifactOutputKind =
  | "program_event"
  | "runtime_log"
  | "runtime_heartbeat"
  | "metric_snapshot"
  | "diagnostic_artifact"
  | "order_intent_draft";

export type RunnableArtifactStatus = "registered";

export type SandboxRuntimeInstanceLifecycleStatus =
  | "requested"
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | "removed";

export type SandboxRuntimeAdapterKind = "deterministic_test" | "docker_sandboxes_sbx";

export type ResearchDirectionKind =
  | "trend_following"
  | "mean_reversion"
  | "volatility_regime"
  | "funding_aware_risk"
  | "liquidation_aware_risk"
  | "execution_cost_robustness"
  | "other";

export type ResearchWorkerStatus = "active" | "retired";

export type ExperimentRunStatus =
  | "submitted"
  | "evaluated"
  | "failed"
  | "discarded";

export type TradingEvaluationMarketScope = "external_trading_api_fixture";

export type TradingEvaluationStage = "backtest";

export type TradingEvaluationResultStatus =
  | "accepted"
  | "quarantined_for_review"
  | "disqualified";

export type TradingEvaluationDisqualificationReason =
  | "lookahead_leakage"
  | "data_leakage"
  | "survivorship_bias"
  | "cost_model_bypass"
  | "funding_ignored"
  | "liquidation_ignored"
  | "seed_cherry_pick"
  | "oos_overfit"
  | "unreproducible"
  | "runtime_self_report_only";

export type TradingEvaluationQuarantineReason =
  | "metric_instability"
  | "insufficient_oos_coverage"
  | "excessive_complexity"
  | "manual_review_required"
  | "partial_trace";

export type ResearchFindingKind =
  | "positive_result"
  | "negative_result"
  | "failure_analysis"
  | "anti_hacking_case"
  | "next_artifact_hint";

export type ArtifactChangeProposalStatus =
  | "proposed"
  | "materialized"
  | "discarded";

export type ResearchOrchestrationRunStatus =
  | "started"
  | "proposed"
  | "failed"
  | "discarded";

export type TradingSystemRuntimeLifecycleStatus =
  | "registered"
  | "deployed"
  | "starting"
  | "running"
  | "paused"
  | "stopping"
  | "stopped"
  | "failed"
  | "killed"
  | "human_review_required"
  | "fixture_placeholder";

export type RuntimeExecutionStage = "paper" | "live";

export type RuntimeControlAction =
  | "inspect"
  | "pause"
  | "resume"
  | "stop"
  | "override"
  | "kill"
  | "handoff"
  | "audit";

export type RuntimeControlCommandStatus =
  | "pending_decision"
  | "decided"
  | "canceled"
  | "superseded";

export type RuntimeControlCommandReason =
  | "operator_request"
  | "inspection_request"
  | "manual_override"
  | "safety_intervention"
  | "handoff_requested"
  | "audit_request"
  | "fixture_only";

export type RuntimeControlDecisionOutcome =
  | "allowed"
  | "rejected"
  | "dry_run_only"
  | "no_live_authority";

export type RuntimeControlDecisionReason =
  | "policy_allows_control"
  | "policy_rejected_control"
  | "no_live_authority"
  | "runtime_lifecycle_incompatible"
  | "operator_hold"
  | "manual_override_allowed"
  | "safety_kill_allowed"
  | "fixture_only";

export type RuntimeControlActorKind =
  | "human_operator"
  | "policy_engine"
  | "external_handoff"
  | "fixture_operator";

export type RuntimeControlAuthorityStatus =
  | "not_live"
  | "control_only"
  | "dry_run_only"
  | "audit_only";

export type RuntimeAuditEventKind =
  | "control_command_recorded"
  | "control_decision_recorded"
  | "runtime_lifecycle_transitioned"
  | "runtime_inspection_recorded"
  | "control_override_recorded"
  | "control_kill_recorded"
  | "operator_handoff_recorded"
  | "audit_snapshot_recorded";

export type OrderIntentDraftKind =
  | "place_order"
  | "cancel_order"
  | "adjust_position";

export type OrderIntentDraftStatus = "proposed" | "withdrawn" | "expired" | "rejected";

export type OrderIntentDraftAuthorityStatus = "not_submitted" | "trace_only";

export type GatewayDecisionOutcome =
  | "allowed"
  | "rejected"
  | "clipped"
  | "dry_run_only";

export type GatewayDecisionReason =
  | "paper_stage_only"
  | "dry_run_allowed"
  | "no_live_authority"
  | "risk_limit_exceeded"
  | "operator_hold"
  | "fixture_only";

export type GatewayDecisionAuthorityStatus = "not_live" | "dry_run_only";

export type ExecutionAttemptStatus =
  | "not_submitted"
  | "dry_run_recorded"
  | "blocked"
  | "canceled"
  | "failed";

export type ExecutionAttemptAuthorityStatus =
  | "not_live"
  | "not_submitted"
  | "dry_run_only";

export type EvaluationRunStatus = "created" | "running" | "succeeded" | "failed" | "canceled";

export type EvaluationAuthorityStatus = "not_live" | "not_counted";

export type EvaluationComparabilityStatus = "comparable" | "not_comparable" | "not_evaluated";

export type EvidenceDisposition = "not_counted" | "counted" | "quarantined_for_review";

export type EvidenceDispositionReason =
  | "fixture_only"
  | "no_external_evaluator"
  | "provider_output_trace_only"
  | "non_comparable"
  | "partial_trace"
  | "method_not_authoritative"
  | "container_or_sandbox_legitimacy_insufficient"
  | "sealed_counted_fixture_only_allowed_by_test"
  | "no_evaluation_runs"
  | "evaluation_links_incomplete";

export type EvidenceClassificationKind =
  | "trace_debug_material"
  | "candidate_evidence"
  | "non_counted_evidence"
  | "counted_evidence"
  | "rejected_evidence"
  | "sealed_decision";

export type EvidenceClassificationStatus =
  | "trace_only"
  | "candidate"
  | "not_counted"
  | "counted"
  | "rejected"
  | "sealed";

export type EvidenceClassificationAuthorityStatus = "not_counted" | "counted";

export type CandidateMaterializationFailureReason =
  | "provider_unavailable"
  | "model_inaccessible"
  | "provider_failed"
  | "schema_missing"
  | "schema_invalid"
  | "materialization_rejected";

export type MaterializationValidationStatus = "accepted" | "rejected";

export type ArtifactChangeProposalProviderFailureReason =
  | "artifact_change_proposal_provider_unavailable"
  | "artifact_change_proposal_provider_failed"
  | "artifact_change_proposal_provider_timeout"
  | "invalid_artifact_change_proposal_request"
  | "no_eligible_research_finding"
  | "unsupported_artifact_change_proposal_task"
  | "unsupported_artifact_change_proposal_provider";

export type ArtifactChangeProposalProviderOutputAuthorityStatus = "proposal_input_only";

export type ArtifactChangeProposalProviderReadinessStatus =
  | "active_verified"
  | "blocked_or_not_installed"
  | "candidate_unverified";

export type ArtifactChangeProposalMaterializationStatus = "materialized" | "failed";

export type ArtifactChangeProposalMaterializationFailureReason =
  | "provider_output_schema_invalid"
  | "provider_output_rejected"
  | "artifact_change_proposal_source_finding_not_found"
  | ArtifactChangeProposalProviderFailureReason;

export interface FixtureNotice {
  mode: FixtureMode;
  label: string;
  statements: string[];
}

export interface BaseRecord {
  record_kind: string;
  version: 1;
}

export interface Ref {
  record_kind: string;
  id: string;
}

export const TRADING_SUBSTRATE_SURFACE_FAMILIES = [
  "order_fill",
  "public_market_liveness",
  "private_readiness_preflight",
  "account_position_risk_mirror"
] as const;

export type TradingSubstrateSurfaceFamily = (typeof TRADING_SUBSTRATE_SURFACE_FAMILIES)[number];

export type TradingSubstrateVenue = "binance_usd_m_futures";

export type TradingSubstrateInstrument = "BTCUSDT";

export type TradingSubstrateProductCategory = "perpetual_futures";

export const TRADING_SUBSTRATE_BINANCE_USDM_TERMS = [
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
] as const;

export type TradingSubstrateBinanceUsdmTerm = (typeof TRADING_SUBSTRATE_BINANCE_USDM_TERMS)[number];

export const TRADING_SUBSTRATE_CANONICAL_NOUNS = [
  "market",
  "account",
  "position",
  "order",
  "execution",
  "risk",
  "posture",
  "gate",
  "gateway",
  "connector",
  "authority",
  "snapshot",
  "event",
  "command",
  "decision"
] as const;

export type TradingSubstrateCanonicalNoun = (typeof TRADING_SUBSTRATE_CANONICAL_NOUNS)[number];

export type TradingSubstrateTaxonomyDataRole = "snapshot" | "gate";

export type TradingSubstrateSourceKind =
  | "binance_user_data_stream"
  | "binance_market_data_rest"
  | "binance_rest_query"
  | "local_config"
  | "fixture";

export type TradingSubstrateFreshnessClass =
  | "fresh"
  | "delayed"
  | "stale"
  | "degraded"
  | "disconnected";

export type TradingSubstrateLivenessClass =
  | "connected"
  | "stale"
  | "degraded"
  | "disconnected"
  | "fixture";

export interface TradingSubstrateSurfaceTaxonomyEntry {
  family: TradingSubstrateSurfaceFamily;
  canonical_noun: TradingSubstrateCanonicalNoun;
  data_role: TradingSubstrateTaxonomyDataRole;
  compatibility_type_prefix: string;
  persisted_record_kind: string;
  persisted_latest_key: string;
  extension_guidance: string;
}

export const TRADING_SUBSTRATE_SURFACE_TAXONOMY = [
  {
    family: "order_fill",
    canonical_noun: "execution",
    data_role: "snapshot",
    compatibility_type_prefix: "OrderFillSurface",
    persisted_record_kind: "order_fill_surface",
    persisted_latest_key: "latest_order_fill_surface",
    extension_guidance: "Prefer execution snapshot vocabulary for new concepts; keep order_fill persisted keys compatible."
  },
  {
    family: "public_market_liveness",
    canonical_noun: "market",
    data_role: "snapshot",
    compatibility_type_prefix: "PublicMarketLivenessSurface",
    persisted_record_kind: "public_market_liveness_surface",
    persisted_latest_key: "latest_public_market_liveness_surface",
    extension_guidance: "Prefer market snapshot vocabulary for new concepts; keep public_market_liveness persisted keys compatible."
  },
  {
    family: "private_readiness_preflight",
    canonical_noun: "gate",
    data_role: "gate",
    compatibility_type_prefix: "PrivateReadinessPreflightSurface",
    persisted_record_kind: "private_readiness_preflight_surface",
    persisted_latest_key: "latest_private_readiness_preflight_surface",
    extension_guidance: "Prefer private access gate vocabulary for new concepts; keep private_readiness_preflight keys compatible."
  },
  {
    family: "account_position_risk_mirror",
    canonical_noun: "account",
    data_role: "snapshot",
    compatibility_type_prefix: "AccountPositionRiskMirrorSurface",
    persisted_record_kind: "account_position_risk_mirror_surface",
    persisted_latest_key: "latest_account_position_risk_mirror_surface",
    extension_guidance: "Prefer account and position snapshot vocabulary for new concepts; keep account_position_risk_mirror keys compatible."
  }
] as const satisfies readonly TradingSubstrateSurfaceTaxonomyEntry[];

export type OrderFillPosture =
  | "received"
  | "working"
  | "partially_filled"
  | "filled"
  | "cancel_pending"
  | "canceled"
  | "replace_pending"
  | "replaced"
  | "rejected"
  | "expired"
  | "suspended_or_blocked"
  | "unknown";

export type OrderFillSurfaceAuthorityStatus = "not_live" | "read_only";

export type PublicMarketLivenessSurfaceAuthorityStatus = "not_live" | "read_only";

export type PrivateReadinessPreflightSurfaceAuthorityStatus = "not_live";

export type PrivateReadinessPostureAuthorityStatus = "not_live";

export type AccountPositionRiskMirrorSurfaceAuthorityStatus = "not_live";

export type PrivateReadinessPreflightGateStatus =
  | "not_configured"
  | "not_evaluated"
  | "not_approved"
  | "disabled"
  | "blocked"
  | "ready";

export interface PrivateReadinessPreflightGate {
  status: PrivateReadinessPreflightGateStatus;
  enabled: boolean;
  reason: string;
}

export interface PrivateReadinessPostureRecord extends BaseRecord {
  record_kind: "private_readiness_posture";
  private_readiness_posture_id: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  operator_approval_gate: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate: PrivateReadinessPolicyGateInput;
  live_binding_gate: PrivateReadinessPolicyGateInput;
  secret_handling_gate: PrivateReadinessPolicyGateInput;
  stop_behavior_gate: PrivateReadinessPolicyGateInput;
  secret_reference_configured: boolean;
  secret_reference_ref?: Ref;
  raw_secret_material_present: false;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  authority_status: PrivateReadinessPostureAuthorityStatus;
}

export interface PrivateReadinessPostureReadModel {
  posture_id: string;
  posture_label: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  operator_approval_gate: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate: PrivateReadinessPolicyGateInput;
  live_binding_gate: PrivateReadinessPolicyGateInput;
  secret_handling_gate: PrivateReadinessPolicyGateInput;
  stop_behavior_gate: PrivateReadinessPolicyGateInput;
  secret_reference_configured: boolean;
  secret_reference_ref?: Ref;
  raw_secret_material_present: false;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  no_authority_label: string;
  authority_status: PrivateReadinessPostureAuthorityStatus;
}

export interface PrivateReadinessPostureWriteInput {
  idempotency_key: string;
  venue?: TradingSubstrateVenue;
  instrument?: TradingSubstrateInstrument;
  product_category?: TradingSubstrateProductCategory;
  operator_approval_gate: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate: PrivateReadinessPolicyGateInput;
  live_binding_gate: PrivateReadinessPolicyGateInput;
  secret_handling_gate: PrivateReadinessPolicyGateInput;
  stop_behavior_gate: PrivateReadinessPolicyGateInput;
  secret_reference_configured: boolean;
  secret_reference_ref?: Ref;
  source_ref?: Ref;
  observed_at?: string;
}

export interface TradingSubstrateNoAuthority {
  live_exchange: false;
  order_submission: false;
  credentials: false;
}

export interface BinanceUsdsFuturesConnectorTransport {
  transport_kind: "official_binance_connector";
  repository: "binance/binance-connector-js";
  package_name: "@binance/derivatives-trading-usds-futures";
  api_family: "derivatives_trading_usds_futures";
  supported_endpoints: ReadonlyArray<"rest_api" | "websocket_api" | "websocket_streams">;
  production_base_url: "https://fapi.binance.com";
  testnet_base_url: "https://testnet.binancefuture.com";
  integration_role: "transport_only";
  authority_status: "not_live";
}

export interface OrderFillSurfaceRecord extends BaseRecord {
  record_kind: "order_fill_surface";
  order_fill_surface_id: string;
  surface_family: "order_fill";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  runtime_ref?: Ref;
  candidate_ref?: Ref;
  stage_binding_ref?: Ref;
  order_scope_ref: string;
  local_client_order_id?: string;
  upstream_order_id?: string;
  side?: "buy" | "sell";
  order_type?: "market" | "limit" | "stop" | "take_profit" | "trailing_stop_market";
  time_in_force?: string;
  requested_quantity?: string;
  cumulative_filled_quantity: string;
  remaining_quantity: string;
  average_fill_price?: string;
  last_fill_price?: string;
  last_fill_quantity?: string;
  raw_upstream_status: string;
  raw_upstream_execution_type?: string;
  posture: OrderFillPosture;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  authority_status: OrderFillSurfaceAuthorityStatus;
}

export interface OrderFillSurfaceReadModel {
  surface_id: string;
  surface_family: "order_fill";
  surface_label: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  order_scope_ref: string;
  local_client_order_id?: string;
  upstream_order_id?: string;
  side?: "buy" | "sell";
  order_type?: OrderFillSurfaceRecord["order_type"];
  time_in_force?: string;
  requested_quantity?: string;
  cumulative_filled_quantity: string;
  remaining_quantity: string;
  average_fill_price?: string;
  last_fill_price?: string;
  last_fill_quantity?: string;
  raw_upstream_status: string;
  raw_upstream_execution_type?: string;
  posture: OrderFillPosture;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  no_authority_label: string;
  authority_status: OrderFillSurfaceAuthorityStatus;
}

export interface PublicMarketLivenessSurfaceRecord extends BaseRecord {
  record_kind: "public_market_liveness_surface";
  public_market_liveness_surface_id: string;
  surface_family: "public_market_liveness";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  symbol_status: string;
  contract_type: string;
  price_tick_size: string;
  quantity_step_size: string;
  min_quantity: string;
  min_notional?: string;
  mark_price: string;
  index_price: string;
  estimated_settle_price?: string;
  funding_rate: string;
  interest_rate?: string;
  next_funding_time: string;
  server_time: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  authority_status: PublicMarketLivenessSurfaceAuthorityStatus;
}

export interface PublicMarketLivenessSurfaceReadModel {
  surface_id: string;
  surface_family: "public_market_liveness";
  surface_label: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  symbol_status: string;
  contract_type: string;
  price_tick_size: string;
  quantity_step_size: string;
  min_quantity: string;
  min_notional?: string;
  mark_price: string;
  index_price: string;
  estimated_settle_price?: string;
  funding_rate: string;
  interest_rate?: string;
  next_funding_time: string;
  server_time: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  no_authority_label: string;
  authority_status: PublicMarketLivenessSurfaceAuthorityStatus;
}

export interface PrivateReadinessPreflightSurfaceRecord extends BaseRecord {
  record_kind: "private_readiness_preflight_surface";
  private_readiness_preflight_surface_id: string;
  surface_family: "private_readiness_preflight";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  credential_gate: PrivateReadinessPreflightGate;
  jurisdiction_gate: PrivateReadinessPreflightGate;
  operator_approval_gate: PrivateReadinessPreflightGate;
  private_account_read_gate: PrivateReadinessPreflightGate;
  private_position_read_gate: PrivateReadinessPreflightGate;
  user_data_stream_gate: PrivateReadinessPreflightGate;
  listen_key_gate: PrivateReadinessPreflightGate;
  order_submission_gate: PrivateReadinessPreflightGate;
  leverage_or_margin_mutation_gate: PrivateReadinessPreflightGate;
  account_information_endpoint: "GET /fapi/v3/account";
  user_data_stream_endpoint: "POST /fapi/v1/listenKey";
  order_endpoint: "POST /fapi/v1/order";
  next_blocked_action: string;
  next_blocked_reason: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  authority_status: PrivateReadinessPreflightSurfaceAuthorityStatus;
}

export interface PrivateReadinessPreflightSurfaceReadModel {
  surface_id: string;
  surface_family: "private_readiness_preflight";
  surface_label: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  credential_gate: PrivateReadinessPreflightGate;
  jurisdiction_gate: PrivateReadinessPreflightGate;
  operator_approval_gate: PrivateReadinessPreflightGate;
  private_account_read_gate: PrivateReadinessPreflightGate;
  private_position_read_gate: PrivateReadinessPreflightGate;
  user_data_stream_gate: PrivateReadinessPreflightGate;
  listen_key_gate: PrivateReadinessPreflightGate;
  order_submission_gate: PrivateReadinessPreflightGate;
  leverage_or_margin_mutation_gate: PrivateReadinessPreflightGate;
  account_information_endpoint: PrivateReadinessPreflightSurfaceRecord["account_information_endpoint"];
  user_data_stream_endpoint: PrivateReadinessPreflightSurfaceRecord["user_data_stream_endpoint"];
  order_endpoint: PrivateReadinessPreflightSurfaceRecord["order_endpoint"];
  next_blocked_action: string;
  next_blocked_reason: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  no_authority_label: string;
  authority_status: PrivateReadinessPreflightSurfaceAuthorityStatus;
}

export type AccountPositionRiskMirrorAccountMode = "single_asset" | "multi_assets";

export type AccountPositionRiskMirrorPositionSide = "BOTH" | "LONG" | "SHORT";

export type AccountPositionRiskMirrorMarginType = "cross" | "isolated";

export type AccountPositionRiskMirrorRiskStatus = "nominal" | "watch" | "breach";

export type AccountPositionRiskMirrorKillSwitchStatus = "inactive" | "active";

export type AccountPositionRiskMirrorRuntimePauseStatus = "not_paused" | "paused";

export interface AccountPositionRiskMirrorSurfaceRecord extends BaseRecord {
  record_kind: "account_position_risk_mirror_surface";
  account_position_risk_mirror_surface_id: string;
  surface_family: "account_position_risk_mirror";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  account_scope_ref: string;
  asset: "USDT";
  account_mode: AccountPositionRiskMirrorAccountMode;
  total_wallet_balance: string;
  total_unrealized_profit: string;
  total_margin_balance: string;
  available_balance: string;
  max_withdraw_amount: string;
  total_initial_margin: string;
  total_maint_margin: string;
  total_position_initial_margin: string;
  total_open_order_initial_margin: string;
  total_cross_wallet_balance: string;
  total_cross_un_pnl: string;
  position_side: AccountPositionRiskMirrorPositionSide;
  position_amount: string;
  entry_price: string;
  break_even_price: string;
  mark_price: string;
  unrealized_profit: string;
  liquidation_price: string;
  notional: string;
  margin_asset: "USDT";
  margin_type: AccountPositionRiskMirrorMarginType;
  leverage: number;
  isolated_margin: string;
  isolated_wallet: string;
  initial_margin: string;
  maint_margin: string;
  position_initial_margin: string;
  open_order_initial_margin: string;
  adl_quantile?: number;
  risk_status: AccountPositionRiskMirrorRiskStatus;
  risk_limit_profile_ref: string;
  max_notional_value: string;
  kill_switch_status: AccountPositionRiskMirrorKillSwitchStatus;
  runtime_pause_status: AccountPositionRiskMirrorRuntimePauseStatus;
  account_information_endpoint: "GET /fapi/v3/account";
  position_information_endpoint: "GET /fapi/v3/positionRisk";
  leverage_endpoint: "POST /fapi/v1/leverage";
  margin_type_endpoint: "POST /fapi/v1/marginType";
  next_blocked_action: string;
  next_blocked_reason: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  authority_status: AccountPositionRiskMirrorSurfaceAuthorityStatus;
}

export interface AccountPositionRiskMirrorSurfaceReadModel {
  surface_id: string;
  surface_family: "account_position_risk_mirror";
  surface_label: string;
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  account_scope_ref: string;
  asset: "USDT";
  account_mode: AccountPositionRiskMirrorAccountMode;
  total_wallet_balance: string;
  total_unrealized_profit: string;
  total_margin_balance: string;
  available_balance: string;
  max_withdraw_amount: string;
  total_initial_margin: string;
  total_maint_margin: string;
  total_position_initial_margin: string;
  total_open_order_initial_margin: string;
  total_cross_wallet_balance: string;
  total_cross_un_pnl: string;
  position_side: AccountPositionRiskMirrorPositionSide;
  position_amount: string;
  entry_price: string;
  break_even_price: string;
  mark_price: string;
  unrealized_profit: string;
  liquidation_price: string;
  notional: string;
  margin_asset: "USDT";
  margin_type: AccountPositionRiskMirrorMarginType;
  leverage: number;
  isolated_margin: string;
  isolated_wallet: string;
  initial_margin: string;
  maint_margin: string;
  position_initial_margin: string;
  open_order_initial_margin: string;
  adl_quantile?: number;
  risk_status: AccountPositionRiskMirrorRiskStatus;
  risk_limit_profile_ref: string;
  max_notional_value: string;
  kill_switch_status: AccountPositionRiskMirrorKillSwitchStatus;
  runtime_pause_status: AccountPositionRiskMirrorRuntimePauseStatus;
  account_information_endpoint: AccountPositionRiskMirrorSurfaceRecord["account_information_endpoint"];
  position_information_endpoint: AccountPositionRiskMirrorSurfaceRecord["position_information_endpoint"];
  leverage_endpoint: AccountPositionRiskMirrorSurfaceRecord["leverage_endpoint"];
  margin_type_endpoint: AccountPositionRiskMirrorSurfaceRecord["margin_type_endpoint"];
  next_blocked_action: string;
  next_blocked_reason: string;
  source_timestamp: string;
  observed_at: string;
  updated_at: string;
  freshness: TradingSubstrateFreshnessClass;
  liveness: TradingSubstrateLivenessClass;
  degraded_reason?: string;
  source_kind: TradingSubstrateSourceKind;
  source_ref?: Ref;
  transport: BinanceUsdsFuturesConnectorTransport;
  fixture_backed: boolean;
  simulated: boolean;
  no_authority: TradingSubstrateNoAuthority;
  no_authority_label: string;
  authority_status: AccountPositionRiskMirrorSurfaceAuthorityStatus;
}

export type TradingGatewayCapabilityStatus = "enabled" | "disabled";

export type TradingGatewaySecurityType = "MARKET_DATA" | "USER_DATA" | "TRADE";

export type TradingGatewayTrackedRecordKind =
  | "order_intent_draft"
  | "gateway_decision"
  | "execution_attempt";

export interface TradingGatewayContractReadModel {
  contract_kind: "trading_gateway_contract";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  evaluated_at: string;
  gateway_name: "TradingGateway";
  sandbox_direct_exchange_access: false;
  gateway_required_for: TradingGatewaySecurityType[];
  tracking_chain: TradingGatewayTrackedRecordKind[];
  market_data: {
    security_type: "MARKET_DATA";
    status: TradingGatewayCapabilityStatus;
    source: "public_market_liveness_surface";
    authority_status: PublicMarketLivenessSurfaceAuthorityStatus;
  };
  account_read: {
    security_type: "USER_DATA";
    status: TradingGatewayCapabilityStatus;
    endpoint_labels: Array<"GET /fapi/v3/account" | "GET /fapi/v3/positionRisk">;
    authority_status: PrivateReadGateDecision["account_balance_position_read_authority"];
    gateway_required: true;
  };
  order_submission: {
    security_type: "TRADE";
    status: TradingGatewayCapabilityStatus;
    endpoint_labels: Array<"POST /fapi/v1/order">;
    authority_status: PrivateReadGateDecision["order_submission_authority"];
    gateway_required: true;
  };
  no_authority: {
    raw_secret_material_present: false;
    no_private_read_performed: true;
    signed_request_authority: false;
    live_exchange_authority: false;
  };
  authority_status: "not_live";
}

export interface TradingGatewayContractInput {
  evaluated_at: string;
  public_market_liveness_surface?: PublicMarketLivenessSurfaceReadModel | null;
  private_readiness_preflight_surface?: PrivateReadinessPreflightSurfaceReadModel | null;
  account_position_risk_mirror_surface?: AccountPositionRiskMirrorSurfaceReadModel | null;
  private_read_gate_decision?: PrivateReadGateDecision | null;
}

export function buildTradingGatewayContractReadModel(
  input: TradingGatewayContractInput
): TradingGatewayContractReadModel {
  const scope =
    input.private_read_gate_decision
    ?? input.private_readiness_preflight_surface
    ?? input.account_position_risk_mirror_surface
    ?? input.public_market_liveness_surface;

  return {
    contract_kind: "trading_gateway_contract",
    venue: scope?.venue ?? "binance_usd_m_futures",
    instrument: scope?.instrument ?? "BTCUSDT",
    product_category: scope?.product_category ?? "perpetual_futures",
    evaluated_at: input.evaluated_at,
    gateway_name: "TradingGateway",
    sandbox_direct_exchange_access: false,
    gateway_required_for: ["USER_DATA", "TRADE"],
    tracking_chain: ["order_intent_draft", "gateway_decision", "execution_attempt"],
    market_data: {
      security_type: "MARKET_DATA",
      status: input.public_market_liveness_surface ? "enabled" : "disabled",
      source: "public_market_liveness_surface",
      authority_status: input.public_market_liveness_surface?.authority_status ?? "not_live"
    },
    account_read: {
      security_type: "USER_DATA",
      status: "disabled",
      endpoint_labels: accountReadEndpointLabels(input),
      authority_status:
        input.private_read_gate_decision?.account_balance_position_read_authority ?? "not_granted",
      gateway_required: true
    },
    order_submission: {
      security_type: "TRADE",
      status: "disabled",
      endpoint_labels: orderSubmissionEndpointLabels(input),
      authority_status: input.private_read_gate_decision?.order_submission_authority ?? "not_granted",
      gateway_required: true
    },
    no_authority: {
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false
    },
    authority_status: "not_live"
  };
}

function accountReadEndpointLabels(
  input: TradingGatewayContractInput
): Array<"GET /fapi/v3/account" | "GET /fapi/v3/positionRisk"> {
  const endpoints = [
    input.private_readiness_preflight_surface?.account_information_endpoint,
    input.account_position_risk_mirror_surface?.account_information_endpoint,
    input.account_position_risk_mirror_surface?.position_information_endpoint
  ];

  return uniqueStrings(endpoints).length > 0
    ? uniqueStrings(endpoints) as Array<"GET /fapi/v3/account" | "GET /fapi/v3/positionRisk">
    : ["GET /fapi/v3/account", "GET /fapi/v3/positionRisk"];
}

function orderSubmissionEndpointLabels(
  input: TradingGatewayContractInput
): Array<"POST /fapi/v1/order"> {
  return input.private_readiness_preflight_surface?.order_endpoint
    ? [input.private_readiness_preflight_surface.order_endpoint]
    : ["POST /fapi/v1/order"];
}

function uniqueStrings<T extends string>(values: ReadonlyArray<T | undefined>): T[] {
  return [...new Set(values.filter((value): value is T => typeof value === "string"))];
}

export interface TradingSubstrateReadModel {
  latest_order_fill_surface: OrderFillSurfaceReadModel | null;
  latest_public_market_liveness_surface: PublicMarketLivenessSurfaceReadModel | null;
  latest_private_readiness_preflight_surface: PrivateReadinessPreflightSurfaceReadModel | null;
  latest_private_readiness_posture: PrivateReadinessPostureReadModel | null;
  private_readiness_posture_history: PrivateReadinessPostureReadModel[];
  latest_private_readiness_policy_decision?: PrivateReadinessPolicyDecision | null;
  latest_private_read_gate_decision?: PrivateReadGateDecision | null;
  latest_trading_gateway_contract?: TradingGatewayContractReadModel | null;
  latest_account_position_risk_mirror_surface: AccountPositionRiskMirrorSurfaceReadModel | null;
}

export interface TradingSystemCandidateRecord extends BaseRecord {
  record_kind: "trading_system_candidate";
  candidate_id: string;
  display_name: string;
  status: CandidateStatus;
  active_version_id: string;
  provenance_refs: Ref[];
  title?: string;
  system_summary?: string;
  first_market_scope?: "external_trading_api_fixture";
  candidate_status?: "materialized" | "handoff_ready" | "archived";
  evaluation_handoff_ready?: boolean;
  materialized_from_attempt_ref?: Ref;
  active_runnable_artifact_ref?: Ref;
  authority_status?: "not_live";
}

export interface CandidateVersionRecord extends BaseRecord {
  record_kind: "candidate_version";
  candidate_version_id: string;
  candidate_id: string;
  version_label: string;
  spec_ref: Ref;
  program_ref: Ref;
  capability_package_refs: Ref[];
  runtime_ref: Ref;
  trace_placeholder_ref: Ref;
  evaluation_run_ref?: Ref;
  materialization_attempt_ref?: Ref;
  agent_spec_ref?: Ref;
  agent_session_ref?: Ref;
  agent_run_ref?: Ref;
  agent_event_ref?: Ref;
  provider_readiness_ref?: Ref;
  provider_probe_attempt_ref?: Ref;
  runnable_artifact_ref?: Ref;
}

export interface TradingSystemSpecRecord extends BaseRecord {
  record_kind: "trading_system_spec";
  trading_system_spec_id: string;
  summary: string;
  market: string;
  instrument: string;
  supported_stage_binding_profiles: Array<"backtest" | "paper" | "live">;
}

export interface TradingSystemProgramRecord extends BaseRecord {
  record_kind: "trading_system_program";
  trading_system_program_id: string;
  summary: string;
  manifest_ref: Ref;
  validation_record_ref: Ref;
}

export interface ProgramManifestRecord extends BaseRecord {
  record_kind: "program_manifest";
  program_manifest_id: string;
  declared_runtime: string;
  declared_outputs: string[];
}

export interface ProgramValidationRecord extends BaseRecord {
  record_kind: "program_validation_record";
  program_validation_record_id: string;
  status: "fixture_placeholder";
  authority_status: "not_runnable";
}

export interface RunnableArtifactOutputContract {
  contract_kind: "opaque_runtime_boundary";
  declared_output_kinds: RunnableArtifactOutputKind[];
  event_envelope_ref?: Ref;
  log_contract_ref?: Ref;
  heartbeat_contract_ref?: Ref;
}

export interface RunnableArtifactRuntimeContract {
  runtime_kind: RunnableArtifactRuntimeKind;
  entrypoint: string[];
  declared_output_contract: RunnableArtifactOutputContract;
  secret_policy_ref: Ref;
  capability_policy_ref: Ref;
}

export interface ArtifactRuntimeContractRecord
  extends BaseRecord,
    RunnableArtifactRuntimeContract {
  record_kind: "artifact_runtime_contract";
  artifact_runtime_contract_id: string;
  created_at: string;
  authority_status: "contract_only";
}

interface RunnableArtifactBaseRecord
  extends BaseRecord,
    RunnableArtifactRuntimeContract {
  record_kind: "runnable_artifact";
  runnable_artifact_id: string;
  artifact_kind: RunnableArtifactKind;
  artifact_digest: string;
  artifact_ref?: Ref;
  artifact_runtime_contract_ref?: Ref;
  provenance_refs: Ref[];
  status: RunnableArtifactStatus;
  created_at: string;
  authority_status: "not_live";
}

export type RunnableArtifactRecord =
  | (RunnableArtifactBaseRecord & {
      artifact_kind: "python_file";
      artifact_path: string;
    })
  | (RunnableArtifactBaseRecord & {
      artifact_kind: "container_image";
      image_ref: string;
    });

export interface ResearchDirectionRecord extends BaseRecord {
  record_kind: "research_direction";
  research_direction_id: string;
  direction_kind: ResearchDirectionKind;
  market_scope: TradingEvaluationMarketScope;
  prompt_seed: string;
  diversity_axis?: string;
  created_at: string;
  authority_status: "research_seed_only";
}

export interface ResearchWorkerRecord extends BaseRecord {
  record_kind: "research_worker";
  research_worker_id: string;
  display_name: string;
  model?: string;
  provider_kind?: ProviderKind;
  research_direction_ref: Ref;
  sandbox_policy_ref?: Ref;
  budget_policy_ref?: Ref;
  created_at: string;
  status: ResearchWorkerStatus;
  authority_status: "research_only";
}

export interface TradingEvaluationTaskRecord extends BaseRecord {
  record_kind: "trading_evaluation_task";
  trading_evaluation_task_id: string;
  market_scope: TradingEvaluationMarketScope;
  stage: TradingEvaluationStage;
  data_window_ref: Ref;
  fee_model_ref: Ref;
  funding_model_ref: Ref;
  slippage_model_ref: Ref;
  leverage_limit_ref: Ref;
  liquidation_model_ref: Ref;
  heldout_policy_ref: Ref;
  evaluation_policy_ref: Ref;
  evaluator_ref?: Ref;
  created_at: string;
  authority_status: "not_live";
}

export interface ExperimentRunRecord extends BaseRecord {
  record_kind: "experiment_run";
  experiment_run_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  runnable_artifact_ref: Ref;
  trading_evaluation_task_ref: Ref;
  sandbox_runtime_instance_ref?: Ref;
  runtime_trace_refs?: Ref[];
  trace_ref?: Ref;
  submitted_at: string;
  status: ExperimentRunStatus;
  authority_status: "not_live";
}

export interface TradingEvaluationScoreSummary {
  total_score: number;
  oos_score: number;
  drawdown_score: number;
  turnover_score: number;
  cost_survival_score: number;
  reproducibility_score: number;
  complexity_penalty: number;
}

export interface TradingEvaluationResultRecord extends BaseRecord {
  record_kind: "trading_evaluation_result";
  trading_evaluation_result_id: string;
  experiment_run_ref: Ref;
  trading_evaluation_task_ref: Ref;
  evaluator_ref: Ref;
  result_status: TradingEvaluationResultStatus;
  evidence_disposition: EvidenceDisposition;
  score_summary: TradingEvaluationScoreSummary;
  metric_refs: Ref[];
  evaluator_trace_ref: Ref;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
  quarantine_reason?: TradingEvaluationQuarantineReason;
  completed_at: string;
  authority_status: "not_counted" | "counted";
}

export interface ResearchFindingRecord extends BaseRecord {
  record_kind: "research_finding";
  research_finding_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  experiment_run_ref: Ref;
  trading_evaluation_result_ref: Ref;
  finding_kind: ResearchFindingKind;
  summary: string;
  supporting_record_refs: Ref[];
  created_at: string;
  authority_status: "research_trace_only";
}

export interface ArtifactLineageRecord extends BaseRecord {
  record_kind: "artifact_lineage";
  artifact_lineage_id: string;
  child_runnable_artifact_ref: Ref;
  parent_runnable_artifact_ref?: Ref;
  source_finding_refs: Ref[];
  created_by_research_worker_ref?: Ref;
  created_at: string;
  authority_status: "lineage_only";
}

export interface ArtifactChangeProposalRecord extends BaseRecord {
  record_kind: "artifact_change_proposal";
  artifact_change_proposal_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  trading_evaluation_task_ref: Ref;
  proposed_runnable_artifact_ref: Ref;
  parent_runnable_artifact_ref?: Ref;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs?: Ref[];
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  created_at: string;
  status: ArtifactChangeProposalStatus;
  authority_status: "proposal_only";
}

export interface ResearchOrchestrationRunRecord extends BaseRecord {
  record_kind: "research_orchestration_run";
  research_orchestration_run_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  trading_evaluation_task_ref: Ref;
  input_finding_refs: Ref[];
  input_lineage_refs?: Ref[];
  output_artifact_proposal_ref?: Ref;
  output_runnable_artifact_ref?: Ref;
  output_lineage_ref?: Ref;
  trace_ref?: Ref;
  started_at: string;
  completed_at?: string;
  status: ResearchOrchestrationRunStatus;
  authority_status: "research_only";
}

export interface ArtifactChangeProposalProviderAttribution {
  provider_kind: ProviderKind;
  model: string;
  invocation_surface: string;
}

export interface ArtifactChangeProposalProviderProbeResult extends ArtifactChangeProposalProviderAttribution {
  readiness_status: ArtifactChangeProposalProviderReadinessStatus;
  supported_purposes: Array<Extract<AgentRunPurpose, "artifact_change_proposal_generation">>;
  version?: string;
  provider_readiness_ref?: Ref;
  provider_probe_attempt_ref?: Ref;
  failure_reason?: ArtifactChangeProposalProviderFailureReason;
}

export interface ArtifactChangeProposalProviderRequest {
  idempotency_key: string;
  task: TradingEvaluationTaskRecord;
  findings: ResearchFindingRecord[];
  existing_lineages?: ArtifactLineageRecord[];
  existing_lineage_refs?: Ref[];
  parent_runnable_artifact_ref?: Ref;
  input_artifact_refs?: Ref[];
  requested_output_contract_ref?: Ref;
  agent_run_ref: Ref;
  trace_ref: Ref;
  created_at?: string;
}

export interface ArtifactChangeProposalProviderOutput {
  output_kind: "artifact_change_proposal_input";
  trading_evaluation_task_ref: Ref;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs?: Ref[];
  parent_runnable_artifact_ref?: Ref;
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  proposed_artifact_refs: Ref[];
  output_authority_status: ArtifactChangeProposalProviderOutputAuthorityStatus;
}

export type ArtifactChangeProposalProviderResult =
  | {
      status: "succeeded";
      provider: ArtifactChangeProposalProviderAttribution;
      output: ArtifactChangeProposalProviderOutput;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: ArtifactChangeProposalProviderOutputAuthorityStatus;
    }
  | {
      status: "failed";
      provider: ArtifactChangeProposalProviderAttribution;
      failure_reason: ArtifactChangeProposalProviderFailureReason;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: ArtifactChangeProposalProviderOutputAuthorityStatus;
    };

export interface ArtifactChangeProposalMaterializationInput {
  idempotency_key: string;
  provider_result: Extract<ArtifactChangeProposalProviderResult, { status: "succeeded" }>;
  artifact_path?: string;
  artifact_runtime_contract_ref?: Ref;
  secret_policy_ref?: Ref;
  capability_policy_ref?: Ref;
  created_at?: string;
}

export interface ArtifactChangeProposalProviderFailureInput {
  idempotency_key: string;
  provider_result: Extract<ArtifactChangeProposalProviderResult, { status: "failed" }>;
  created_at?: string;
}

export interface ArtifactChangeProposalMaterializationAttemptRecord extends BaseRecord {
  record_kind: "artifact_change_proposal_materialization_attempt";
  artifact_change_proposal_materialization_attempt_id: string;
  idempotency_key: string;
  provider: ArtifactChangeProposalProviderAttribution;
  agent_run_ref: Ref;
  agent_event_refs: Ref[];
  trace_ref: Ref;
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  status: ArtifactChangeProposalMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: ArtifactChangeProposalMaterializationFailureReason;
  output_artifact_proposal_ref?: Ref;
  output_runnable_artifact_ref?: Ref;
  output_lineage_ref?: Ref;
  created_at: string;
  authority_status: ArtifactChangeProposalProviderOutputAuthorityStatus;
}

export type ArtifactChangeProposalMaterializationOutcome =
  | {
      status: "materialized";
      attempt: ArtifactChangeProposalMaterializationAttemptRecord;
      proposal: ArtifactChangeProposalRecord;
      runnable_artifact: RunnableArtifactRecord;
      lineage: ArtifactLineageRecord;
    }
  | {
      status: "failed";
      attempt: ArtifactChangeProposalMaterializationAttemptRecord;
    };

export interface CapabilityPackageRecord extends BaseRecord {
  record_kind: "capability_package";
  capability_package_id: string;
  summary: string;
  manifest_ref: Ref;
  admission_record_ref: Ref;
  grant_ref: Ref;
  mount_record_ref: Ref;
}

export interface CapabilityManifestRecord extends BaseRecord {
  record_kind: "capability_manifest";
  capability_manifest_id: string;
  allowed_stages: Array<"backtest" | "paper">;
  declared_permissions: string[];
  forbidden_contents: string[];
}

export interface CapabilityPackageAdmissionRecord extends BaseRecord {
  record_kind: "capability_package_admission_record";
  capability_package_admission_record_id: string;
  status: "fixture_placeholder";
  authority_status: "not_scanned";
}

export interface CapabilityGrantRecord extends BaseRecord {
  record_kind: "capability_grant";
  capability_grant_id: string;
  status: "fixture_placeholder";
  authority_status: "not_granted";
}

export interface CapabilityMountRecord extends BaseRecord {
  record_kind: "capability_mount_record";
  capability_mount_record_id: string;
  status: "fixture_placeholder";
  authority_status: "not_mounted";
}

export interface AgentSpecRecord extends BaseRecord {
  record_kind: "agent_spec";
  agent_spec_id: string;
  purpose: AgentRunPurpose;
  provider_kind: ProviderKind;
  model?: string;
  output_contract_ref?: Ref;
}

export interface AgentSessionRecord extends BaseRecord {
  record_kind: "agent_session";
  agent_session_id: string;
  agent_spec_ref: Ref;
  provider_kind?: ProviderKind;
  model?: string;
  authority_status: "not_executed" | "trace_only";
}

export interface AgentRunRecord extends BaseRecord {
  record_kind: "agent_run";
  agent_run_id: string;
  agent_session_ref: Ref;
  purpose: AgentRunPurpose;
  status?: AgentRunStatus;
  provider_kind?: ProviderKind;
  model?: string;
  trace_ref?: Ref;
  failure_reason?: CandidateMaterializationFailureReason;
  authority_status: "not_executed" | "trace_only";
}

export interface AgentEventRecord extends BaseRecord {
  record_kind: "agent_event";
  agent_event_id: string;
  agent_run_ref: Ref;
  status: "fixture_placeholder" | "provider_output_captured";
}

export interface ProviderReadinessRecord extends BaseRecord {
  record_kind: "provider_readiness_record";
  provider_readiness_record_id: string;
  provider_kind: ProviderKind;
  model?: string;
  invocation_surface?: string;
  readiness_status?: "active_verified" | "candidate_unverified" | "blocked_or_not_installed";
  authority_status: "not_ready" | "readiness_only";
}

export interface ProviderProbeAttemptRecord extends BaseRecord {
  record_kind: "provider_probe_attempt";
  provider_probe_attempt_id: string;
  provider_readiness_record_ref: Ref;
  provider_kind?: ProviderKind;
  model?: string;
  result?: "succeeded" | "failed" | "not_run";
  failure_reason?: CandidateMaterializationFailureReason;
  authority_status: "not_probed" | "probe_trace_only";
}

export interface TradingSystemRuntimeRecord extends BaseRecord {
  record_kind: "trading_system_runtime";
  trading_system_runtime_id: string;
  stage_binding_profile: "paper";
  runtime_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  candidate_ref?: Ref;
  candidate_version_ref?: Ref;
  stage_binding_ref?: Ref;
  placement_ref: Ref;
  hands_environment_ref: Ref;
  memory_surface_ref: Ref;
  runtime_operating_policy_ref?: Ref;
  trace_ref?: Ref;
  order_intent_draft_refs?: Ref[];
  gateway_decision_refs?: Ref[];
  execution_attempt_refs?: Ref[];
  runtime_control_command_refs?: Ref[];
  runtime_control_decision_refs?: Ref[];
  runtime_audit_event_refs?: Ref[];
  runnable_artifact_ref?: Ref;
  sandbox_runtime_instance_ref?: Ref;
  created_at?: string;
  authority_status: "not_live";
}

export interface RuntimePlacementRecord extends BaseRecord {
  record_kind: "runtime_placement";
  runtime_placement_id: string;
  placement_kind: RuntimePlacementKind;
  tooling_kind?: RuntimePlacementToolingKind;
  service_name?: string;
  image_ref?: Ref;
  compose_project?: string;
  sandbox_template_ref?: Ref;
  endpoint_ref?: Ref;
  local_store_root?: string;
  network_ref?: Ref;
  volume_ref?: Ref;
  authority_status: "not_launched";
}

export interface SandboxRuntimeInstanceRecord extends BaseRecord {
  record_kind: "sandbox_runtime_instance";
  sandbox_runtime_instance_id: string;
  adapter_kind: SandboxRuntimeAdapterKind;
  runnable_artifact_ref: Ref;
  runtime_ref?: Ref;
  runtime_placement_ref: Ref;
  lifecycle_status: SandboxRuntimeInstanceLifecycleStatus;
  sandbox_name: string;
  sandbox_ref?: Ref;
  created_at: string;
  started_at?: string;
  last_heartbeat_at?: string;
  stopped_at?: string;
  removed_at?: string;
  log_refs: Ref[];
  heartbeat_refs: Ref[];
  command_evidence_refs?: Ref[];
  trace_ref?: Ref;
  authority_status: "not_live";
}

export interface RuntimeInstanceLogRecord extends BaseRecord {
  record_kind: "runtime_instance_log";
  runtime_instance_log_id: string;
  sandbox_runtime_instance_ref: Ref;
  lines: string[];
  captured_at: string;
  authority_status: "trace_only";
}

export interface RuntimeHeartbeatRecord extends BaseRecord {
  record_kind: "runtime_heartbeat";
  runtime_heartbeat_id: string;
  sandbox_runtime_instance_ref: Ref;
  heartbeat_line: string;
  observed_at: string;
  authority_status: "trace_only";
}

export interface SandboxCommandEvidenceRecord extends BaseRecord {
  record_kind: "sandbox_command_evidence";
  sandbox_command_evidence_id: string;
  sandbox_runtime_instance_ref?: Ref;
  command: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  started_at: string;
  completed_at: string;
  authority_status: "trace_only";
}

export interface HandsEnvironmentRecord extends BaseRecord {
  record_kind: "hands_environment";
  hands_environment_id: string;
  environment_kind: "fixture_no_tools";
  authority_status: "not_mounted";
}

export interface RuntimeMemorySurfaceRecord extends BaseRecord {
  record_kind: "runtime_memory_surface";
  runtime_memory_surface_id: string;
  trust_class: "fixture_context";
  access_mode: "read_only";
  surface_version: string;
  visibility: "operator_visible";
  quarantine_status: "not_quarantined";
  authority_status: "not_evidence";
}

export interface TracePlaceholderRecord extends BaseRecord {
  record_kind: "trace_placeholder";
  trace_id: string;
  input_artifact_refs?: Ref[];
  provider_output_artifact_refs?: Ref[];
  debug_artifact_refs?: Ref[];
  captured_at?: string;
  authority_label?: "provider_output_not_evidence";
  authority_status: "not_counted";
}

export interface StageBindingRecord extends BaseRecord {
  record_kind: "stage_binding";
  stage_binding_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage: StageBindingStage;
  profile: StageBindingProfile;
  execution_mode?: EvaluationExecutionMode;
  runtime_placement_ref?: Ref;
  hands_environment_ref?: Ref;
  data_window_ref?: Ref;
  simulator_ref?: Ref;
  created_at: string;
  authority_status: "not_live";
}

export interface EvaluationRunRecord extends BaseRecord {
  record_kind: "evaluation_run_record";
  evaluation_run_record_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage_binding_ref: Ref;
  trace_ref: Ref;
  evaluator_ref?: Ref;
  status: EvaluationRunStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  authority_status: EvaluationAuthorityStatus;
}

export interface EvaluationComparisonSetRecord extends BaseRecord {
  record_kind: "evaluation_comparison_set";
  evaluation_comparison_set_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage_binding_ref: Ref;
  evaluation_run_refs: Ref[];
  comparability_status: EvaluationComparabilityStatus;
  comparability_reason: string;
  created_at: string;
  authority_status: "not_counted";
}

interface EvidenceSealingDecisionBase extends BaseRecord {
  record_kind: "evidence_sealing_decision";
  evidence_sealing_decision_id: string;
  evaluation_comparison_set_ref: Ref;
  evaluation_run_refs: Ref[];
  disposition_reason: EvidenceDispositionReason;
  created_at: string;
  sealed_at?: string;
}

export type EvidenceSealingDecisionRecord =
  | (EvidenceSealingDecisionBase & {
      evidence_disposition: "counted";
      authority_status: "counted";
    })
  | (EvidenceSealingDecisionBase & {
      evidence_disposition: "not_counted" | "quarantined_for_review";
      authority_status: "not_counted";
    });

export interface EvidenceClassificationRecord extends BaseRecord {
  record_kind: "evidence_classification";
  evidence_classification_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  evaluation_run_ref: Ref;
  classified_ref: Ref;
  classification_kind: EvidenceClassificationKind;
  classification_status: EvidenceClassificationStatus;
  classification_reason: EvidenceDispositionReason;
  created_at: string;
  sealed_by_decision_ref?: Ref;
  authority_status: EvidenceClassificationAuthorityStatus;
}

export interface RuntimeControlCommandRecord extends BaseRecord {
  record_kind: "runtime_control_command";
  runtime_control_command_id: string;
  runtime_ref: Ref;
  action: RuntimeControlAction;
  requested_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  actor_kind: RuntimeControlActorKind;
  actor_ref?: Ref;
  runtime_operating_policy_ref?: Ref;
  idempotency_key: string;
  reason: RuntimeControlCommandReason;
  reason_summary?: string;
  trace_ref?: Ref;
  related_order_intent_draft_refs?: Ref[];
  related_gateway_decision_refs?: Ref[];
  related_execution_attempt_refs?: Ref[];
  requested_at: string;
  status: RuntimeControlCommandStatus;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface RuntimeControlDecisionRecord extends BaseRecord {
  record_kind: "runtime_control_decision";
  runtime_control_decision_id: string;
  runtime_ref: Ref;
  command_ref: Ref;
  decision_outcome: RuntimeControlDecisionOutcome;
  decision_reason: RuntimeControlDecisionReason;
  decided_by_actor_kind: RuntimeControlActorKind;
  decided_by_actor_ref?: Ref;
  runtime_operating_policy_ref?: Ref;
  resulting_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  trace_ref?: Ref;
  related_order_intent_draft_refs?: Ref[];
  related_gateway_decision_refs?: Ref[];
  related_execution_attempt_refs?: Ref[];
  decided_at: string;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface RuntimeAuditEventRecord extends BaseRecord {
  record_kind: "runtime_audit_event";
  runtime_audit_event_id: string;
  runtime_ref: Ref;
  event_kind: RuntimeAuditEventKind;
  command_ref?: Ref;
  decision_ref?: Ref;
  actor_kind?: RuntimeControlActorKind;
  actor_ref?: Ref;
  runtime_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  message?: string;
  trace_ref?: Ref;
  supporting_record_refs?: Ref[];
  related_order_intent_draft_refs?: Ref[];
  related_gateway_decision_refs?: Ref[];
  related_execution_attempt_refs?: Ref[];
  created_at: string;
  authority_status: "not_live" | "audit_only";
}

export interface RuntimeControlAuditInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  runtime_id?: string;
  command: {
    action: RuntimeControlAction;
    requested_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
    actor_kind: RuntimeControlActorKind;
    actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    reason: RuntimeControlCommandReason;
    reason_summary?: string;
    trace_ref?: Ref;
    related_order_intent_draft_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  decision: {
    decision_outcome: RuntimeControlDecisionOutcome;
    decision_reason: RuntimeControlDecisionReason;
    decided_by_actor_kind: RuntimeControlActorKind;
    decided_by_actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    resulting_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
    trace_ref?: Ref;
    related_order_intent_draft_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  audit_event: {
    event_kind: RuntimeAuditEventKind;
    actor_kind?: RuntimeControlActorKind;
    actor_ref?: Ref;
    runtime_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
    message?: string;
    trace_ref?: Ref;
    supporting_record_refs?: Ref[];
    related_order_intent_draft_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  created_at?: string;
}

export interface RuntimeControlAuditOutcome {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  command: RuntimeControlCommandRecord;
  decision: RuntimeControlDecisionRecord;
  audit_event: RuntimeAuditEventRecord;
}

export interface BoundedRuntimeAuthorityInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  runtime_id?: string;
  intent: {
    intent_kind: OrderIntentDraftKind;
    side?: "buy" | "sell";
    order_type?: "market" | "limit";
    quantity?: string;
    limit_price?: string;
  };
  gateway_decision: {
    decision_outcome: GatewayDecisionOutcome;
    decision_reason: GatewayDecisionReason;
    policy_ref?: Ref;
  };
  execution_attempt?: {
    execution_mode?: EvaluationExecutionMode;
    status?: ExecutionAttemptStatus;
    result_reason?: GatewayDecisionReason;
    trace_ref?: Ref;
    completed_at?: string;
  };
  created_at?: string;
}

export interface OrderIntentDraftRecord extends BaseRecord {
  record_kind: "order_intent_draft";
  order_intent_draft_id: string;
  runtime_ref: Ref;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage_binding_ref: Ref;
  trace_ref?: Ref;
  intent_kind: OrderIntentDraftKind;
  market_scope: "external_trading_api_fixture";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderIntentDraftStatus;
  created_at: string;
  authority_status: OrderIntentDraftAuthorityStatus;
}

export interface GatewayDecisionRecord extends BaseRecord {
  record_kind: "gateway_decision";
  gateway_decision_id: string;
  runtime_ref: Ref;
  order_intent_draft_ref: Ref;
  decision_outcome: GatewayDecisionOutcome;
  decision_reason: GatewayDecisionReason;
  decided_at: string;
  policy_ref?: Ref;
  clipped_order_intent_draft_ref?: Ref;
  authority_status: GatewayDecisionAuthorityStatus;
}

export interface ExecutionAttemptRecord extends BaseRecord {
  record_kind: "execution_attempt";
  execution_attempt_id: string;
  runtime_ref: Ref;
  order_intent_draft_ref: Ref;
  gateway_decision_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "external_trading_api_fixture";
  trace_ref?: Ref;
  status: ExecutionAttemptStatus;
  result_reason: GatewayDecisionReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionAttemptAuthorityStatus;
}

export interface BoundedRuntimeAuthorityOutcome {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  order_intent_draft: OrderIntentDraftRecord;
  gateway_decision: GatewayDecisionRecord;
  execution_attempt: ExecutionAttemptRecord;
}

export interface CandidateMaterializationInput {
  idempotency_key: string;
  provider: {
    provider_kind: ProviderKind;
    model: string;
    invocation_surface: string;
    agent_run_id: string;
    agent_event_id: string;
    trace_id: string;
    output_artifact_hash: string;
  };
  candidate: {
    title: string;
    system_summary: string;
    first_market_scope: "external_trading_api_fixture";
  };
  spec: {
    summary: string;
    market: "ExternalTradingApiProvider";
    instrument: "generic trading instruments";
    supported_stage_binding_profiles: Array<"backtest" | "paper" | "live">;
  };
  program: {
    summary: string;
    declared_runtime: string;
    declared_outputs: string[];
  };
  capability_package: {
    summary: string;
    allowed_stages: Array<"backtest" | "paper">;
    declared_permissions: string[];
    forbidden_contents: string[];
  };
  artifact_refs: Ref[];
}

export interface CandidateMaterializationFailureInput {
  idempotency_key: string;
  provider_kind: ProviderKind;
  model: string;
  agent_run_id: string;
  trace_id: string;
  failure_reason: CandidateMaterializationFailureReason;
  artifact_refs: Ref[];
}

export interface CandidateMaterializationAttemptRecord extends BaseRecord {
  record_kind: "candidate_materialization_attempt";
  candidate_materialization_attempt_id: string;
  idempotency_key: string;
  provider_kind: ProviderKind;
  model: string;
  agent_run_ref: Ref;
  trace_ref: Ref;
  status: CandidateMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: CandidateMaterializationFailureReason;
  resulting_candidate_ref?: Ref;
  artifact_refs: Ref[];
  created_at: string;
}

export type FixtureRecord =
  | TradingSystemCandidateRecord
  | CandidateVersionRecord
  | TradingSystemSpecRecord
  | TradingSystemProgramRecord
  | ProgramManifestRecord
  | ProgramValidationRecord
  | CapabilityPackageRecord
  | CapabilityManifestRecord
  | CapabilityPackageAdmissionRecord
  | CapabilityGrantRecord
  | CapabilityMountRecord
  | ArtifactRuntimeContractRecord
  | RunnableArtifactRecord
  | ResearchDirectionRecord
  | ResearchWorkerRecord
  | ExperimentRunRecord
  | TradingEvaluationTaskRecord
  | TradingEvaluationResultRecord
  | ResearchFindingRecord
  | ArtifactLineageRecord
  | ArtifactChangeProposalRecord
  | ResearchOrchestrationRunRecord
  | ArtifactChangeProposalMaterializationAttemptRecord
  | AgentSpecRecord
  | AgentSessionRecord
  | AgentRunRecord
  | AgentEventRecord
  | ProviderReadinessRecord
  | ProviderProbeAttemptRecord
  | TradingSystemRuntimeRecord
  | RuntimePlacementRecord
  | SandboxRuntimeInstanceRecord
  | RuntimeInstanceLogRecord
  | RuntimeHeartbeatRecord
  | SandboxCommandEvidenceRecord
  | HandsEnvironmentRecord
  | RuntimeMemorySurfaceRecord
  | TracePlaceholderRecord
  | StageBindingRecord
  | EvaluationRunRecord
  | EvaluationComparisonSetRecord
  | EvidenceSealingDecisionRecord
  | EvidenceClassificationRecord
  | RuntimeControlCommandRecord
  | RuntimeControlDecisionRecord
  | RuntimeAuditEventRecord
  | OrderIntentDraftRecord
  | GatewayDecisionRecord
  | ExecutionAttemptRecord
  | OrderFillSurfaceRecord
  | PublicMarketLivenessSurfaceRecord
  | PrivateReadinessPreflightSurfaceRecord
  | PrivateReadinessPostureRecord
  | AccountPositionRiskMirrorSurfaceRecord
  | CandidateMaterializationAttemptRecord;

export interface CandidateSummaryReadModel {
  candidate_id: string;
  display_name: string;
  status: CandidateStatus;
  active_version_id: string;
  fixture_notice: FixtureNotice;
  latest_validation_state?: CandidateLatestValidationStateReadModel;
}

export interface PlaceholderSummary {
  ref: Ref;
  label: string;
  status: string;
  authority_status: string;
}

export type CandidateEvaluationTraceState = "none" | "linked" | "missing";

export type CandidateEvaluationErrorCode =
  | "evaluation_failed"
  | "evaluation_links_incomplete";

export interface CandidateEvaluationErrorState {
  code: CandidateEvaluationErrorCode;
  message: string;
}

export interface CandidateEvaluationLatestRunReadModel {
  run_id: string;
  status: EvaluationRunStatus;
  stage: StageBindingStage | null;
  profile: StageBindingProfile | null;
  execution_mode: EvaluationExecutionMode | null;
  trace_ref: Ref;
  authority_status: EvaluationAuthorityStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_state: CandidateEvaluationErrorState | null;
}

export interface CandidateEvaluationComparisonSetReadModel {
  comparison_set_id: string;
  stage_binding_ref: Ref;
  evaluation_run_refs: Ref[];
  comparability_status: EvaluationComparabilityStatus;
  comparability_reason: string;
  authority_status: "not_counted";
  created_at: string;
}

export interface CandidateEvaluationSealingDecisionReadModel {
  sealing_decision_id: string;
  evaluation_comparison_set_ref: Ref;
  evaluation_run_refs: Ref[];
  evidence_disposition: EvidenceDisposition;
  disposition_reason: EvidenceDispositionReason;
  authority_status: "not_counted" | "counted";
  created_at: string;
  sealed_at?: string;
}

export interface CandidateEvidenceClassificationReadModel {
  classification_id: string;
  classified_ref: Ref;
  classification_kind: EvidenceClassificationKind;
  classification_status: EvidenceClassificationStatus;
  classification_reason: EvidenceDispositionReason;
  authority_status: EvidenceClassificationAuthorityStatus;
  sealed_by_decision_ref?: Ref;
  created_at: string;
}

export interface CandidateEvaluationTraceReadModel {
  state: CandidateEvaluationTraceState;
  trace_ref: Ref | null;
  authority_label?: "provider_output_not_evidence";
  authority_status: "not_counted";
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
}

export interface CandidateCountedEvidenceReadModel {
  counted: boolean;
  evidence_disposition: EvidenceDisposition;
  disposition_reason: EvidenceDispositionReason;
  authority_status: "not_counted" | "counted";
  sealed_at?: string;
}

export interface CandidateEvaluationReadModel {
  has_runs: boolean;
  latest_run: CandidateEvaluationLatestRunReadModel | null;
  latest_comparison_set: CandidateEvaluationComparisonSetReadModel | null;
  latest_sealing_decision: CandidateEvaluationSealingDecisionReadModel | null;
  trace: CandidateEvaluationTraceReadModel;
  evidence_classifications: CandidateEvidenceClassificationReadModel[];
  counted_evidence: CandidateCountedEvidenceReadModel;
  error_state: CandidateEvaluationErrorState | null;
  run: PlaceholderSummary;
  comparison_set: PlaceholderSummary;
  sealing_decision: PlaceholderSummary;
}

export interface ReplayRunEvidenceReadModel {
  run_id: string;
  run_dir: string;
  candidate_id: string;
  runner_kind: string;
  status: string;
  run_status: string;
  scenario_accepted: number;
  scenario_total: number;
  provider_request_total: number;
  runner_command_total: number;
  artifact_digest: string;
  completed_at: string;
  authority_status: string;
}

export interface ReplayRunMetricReadModel {
  name: string;
  score: number;
  detail: string;
}

export interface ReplayRunCommandEvidenceReadModel {
  command: string[];
  exit_code: number | null;
  signal?: string;
  timed_out?: boolean;
  error_message?: string;
  stdout_preview: string;
  stderr_preview: string;
  started_at: string;
  completed_at: string;
}

export interface ReplayRunScenarioReadModel {
  scenario_id: string;
  runner_kind: string;
  sandbox_name?: string;
  status: string;
  run_status: string;
  score: number;
  risk_decision: string;
  summary: string;
  events_path: string;
  provider_request_count: number;
  runner_command_count: number;
  metrics: ReplayRunMetricReadModel[];
  runner_command_evidence: ReplayRunCommandEvidenceReadModel[];
}

export interface ReplayRunDetailReadModel extends ReplayRunEvidenceReadModel {
  score: number;
  risk_decision: string;
  scenario_ids: string[];
  output_dir: string;
  events_path: string;
  started_at: string;
  no_authority: {
    live_exchange: boolean;
    order_authority: boolean;
    credentials: boolean;
    paper_trading: boolean;
  };
  provenance: {
    promotion_id?: string;
    source_session_id?: string;
  };
  scenarios: ReplayRunScenarioReadModel[];
}

export type ReplayRunComparisonVerdict =
  | "improved"
  | "unchanged"
  | "regressed"
  | "incomparable";

export interface ReplayRunComparisonRunReadModel {
  run_id: string;
  status: string;
  run_status: string;
  score: number;
  risk_decision: string;
  scenario_accepted: number;
  scenario_total: number;
  provider_request_total: number;
  runner_command_total: number;
  completed_at: string;
  authority_status: string;
}

export interface ReplayRunComparisonReadModel {
  candidate_id: string;
  selected: ReplayRunComparisonRunReadModel;
  baseline: ReplayRunComparisonRunReadModel;
  baseline_selection: "explicit_baseline_run_id";
  deltas: {
    score: number;
    scenario_accepted: number;
    scenario_total: number;
    provider_request_total: number;
    runner_command_total: number;
  };
  risk_transition: string;
  verdict: ReplayRunComparisonVerdict;
  verdict_reason: string;
  authority_status: "not_live";
  validation_label: "comparison_not_authority";
  no_authority: {
    live_exchange: false;
    order_authority: false;
    credentials: false;
    paper_trading: false;
  };
}

export type ReplayRunValidationStateStatus =
  | "passes_replay_checks"
  | "human_review_required"
  | "validation_blocked"
  | "comparison_required";

export type CandidateLatestValidationStateStatus =
  | ReplayRunValidationStateStatus
  | "replay_required";

export interface ReplayRunValidationStateReadModel {
  candidate_id: string;
  selected_run_id: string;
  baseline_run_id?: string;
  comparison_verdict?: ReplayRunComparisonVerdict;
  validation_state: ReplayRunValidationStateStatus;
  reasons: string[];
  required_next_evidence: string[];
  authority_status: "not_live";
  validation_label: "validation_state_not_authority";
  no_authority: {
    live_exchange: false;
    order_authority: false;
    credentials: false;
    paper_trading: false;
  };
}

export interface CandidateLatestValidationStateReadModel {
  candidate_id: string;
  selected_run_id?: string;
  baseline_run_id?: string;
  comparison_verdict?: ReplayRunComparisonVerdict;
  validation_state: CandidateLatestValidationStateStatus;
  reasons: string[];
  required_next_evidence: string[];
  authority_status: "not_live";
  validation_label: "validation_state_not_authority";
  no_authority: {
    live_exchange: false;
    order_authority: false;
    credentials: false;
    paper_trading: false;
  };
}

export interface ReplayRuntimeOrderIntentDraftReadModel {
  order_intent_draft_id: string;
  intent_kind: OrderIntentDraftKind;
  market_scope: "external_trading_api_fixture";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderIntentDraftStatus;
  created_at: string;
  authority_status: OrderIntentDraftAuthorityStatus;
}

export interface ReplayRuntimeGatewayDecisionReadModel {
  gateway_decision_id: string;
  order_intent_draft_ref: Ref;
  decision_outcome: GatewayDecisionOutcome;
  decision_reason: GatewayDecisionReason;
  decided_at: string;
  authority_status: GatewayDecisionAuthorityStatus;
}

export interface ReplayRuntimeExecutionAttemptReadModel {
  execution_attempt_id: string;
  order_intent_draft_ref: Ref;
  gateway_decision_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "external_trading_api_fixture";
  status: ExecutionAttemptStatus;
  result_reason: GatewayDecisionReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionAttemptAuthorityStatus;
}

export interface ReplayRuntimeAuthorityReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  latest_order_intent_draft: ReplayRuntimeOrderIntentDraftReadModel | null;
  latest_gateway_decision: ReplayRuntimeGatewayDecisionReadModel | null;
  latest_execution_attempt: ReplayRuntimeExecutionAttemptReadModel | null;
  order_intent_draft: PlaceholderSummary;
  gateway_decision: PlaceholderSummary;
  execution_attempt: PlaceholderSummary;
}

export interface ReplayRuntimeControlCommandReadModel {
  command_id: string;
  action: RuntimeControlAction;
  requested_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  actor_kind: RuntimeControlActorKind;
  actor_ref?: Ref;
  reason: RuntimeControlCommandReason;
  requested_at: string;
  status: RuntimeControlCommandStatus;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface ReplayRuntimeControlDecisionReadModel {
  decision_id: string;
  command_ref: Ref;
  decision_outcome: RuntimeControlDecisionOutcome;
  decision_reason: RuntimeControlDecisionReason;
  decided_by_actor_kind: RuntimeControlActorKind;
  decided_by_actor_ref?: Ref;
  resulting_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  decided_at: string;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface ReplayRuntimeAuditEventReadModel {
  audit_event_id: string;
  event_kind: RuntimeAuditEventKind;
  command_ref?: Ref;
  decision_ref?: Ref;
  actor_kind?: RuntimeControlActorKind;
  actor_ref?: Ref;
  runtime_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
  message?: string;
  created_at: string;
  authority_status: "not_live" | "audit_only";
}

export interface ReplayRuntimeControlReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  latest_command: ReplayRuntimeControlCommandReadModel | null;
  latest_decision: ReplayRuntimeControlDecisionReadModel | null;
  latest_audit_event: ReplayRuntimeAuditEventReadModel | null;
  command: PlaceholderSummary;
  decision: PlaceholderSummary;
  audit_event: PlaceholderSummary;
}

export interface CandidateInspectReadModel extends CandidateSummaryReadModel {
  candidate_version: {
    candidate_version_id: string;
    version_label: string;
    provenance_refs: Ref[];
    materialization_attempt_ref?: Ref;
  };
  spec: {
    ref: Ref;
    summary: string;
    market: string;
    instrument: string;
    supported_stage_binding_profiles: string[];
  };
  program: {
    ref: Ref;
    summary: string;
    manifest: {
      ref: Ref;
      declared_runtime: string;
      declared_outputs: string[];
    };
    validation: PlaceholderSummary;
  };
  capability_package: {
    ref: Ref;
    summary: string;
    manifest: {
      ref: Ref;
      allowed_stages: string[];
      declared_permissions: string[];
      forbidden_contents: string[];
    };
    admission: PlaceholderSummary;
    grant: PlaceholderSummary;
    mount: PlaceholderSummary;
  };
  agent_provider: {
    agent_spec: PlaceholderSummary;
    agent_session: PlaceholderSummary;
    agent_run: PlaceholderSummary;
    agent_event: PlaceholderSummary;
    provider_readiness: PlaceholderSummary;
    provider_probe_attempt: PlaceholderSummary;
  };
  runtime: {
    ref: Ref;
    stage_binding_profile: string;
    runtime_lifecycle_status?: TradingSystemRuntimeLifecycleStatus;
    authority_status: string;
    placement: PlaceholderSummary;
    hands_environment: PlaceholderSummary;
    memory_surface: {
      ref: Ref;
      trust_class: string;
      access_mode: string;
      surface_version: string;
      visibility: string;
      quarantine_status: string;
      authority_status: string;
    };
    bounded_authority?: ReplayRuntimeAuthorityReadModel;
    runtime_control?: ReplayRuntimeControlReadModel;
  };
  trading_substrate?: TradingSubstrateReadModel;
  trace: PlaceholderSummary;
  evaluation: CandidateEvaluationReadModel;
  materialization_attempt?: CandidateMaterializationAttemptReadModel;
}

export interface CandidateIndexProjection {
  record_kind: "candidate_index_projection";
  version: 1;
  candidates: CandidateSummaryReadModel[];
}

export interface CandidateMaterializationAttemptReadModel {
  attempt_id: string;
  idempotency_key: string;
  provider_kind: ProviderKind;
  model: string;
  agent_run_ref: Ref;
  trace_ref: Ref;
  status: CandidateMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: CandidateMaterializationFailureReason;
  resulting_candidate_ref?: Ref;
  artifact_refs: Ref[];
  created_at: string;
  authority_label: "provider_output_not_evidence";
}

export interface CandidateMaterializationAttemptIndexProjection {
  record_kind: "candidate_materialization_attempt_index_projection";
  version: 1;
  attempts: CandidateMaterializationAttemptReadModel[];
}

export type CandidateMaterializationOutcome =
  | {
      status: "materialized";
      attempt: CandidateMaterializationAttemptReadModel;
      candidate: CandidateInspectReadModel;
    }
  | {
      status: "failed";
      attempt: CandidateMaterializationAttemptReadModel;
    };

export interface CandidateEvaluationRunInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  stage?: "backtest";
  execution_mode?: EvaluationExecutionMode;
  trace_ref?: Ref;
  evaluator_ref?: Ref;
  input_artifact_refs?: Ref[];
  provider_output_artifact_refs?: Ref[];
  debug_artifact_refs?: Ref[];
}

export interface EvidenceSealingDecisionInput {
  idempotency_key: string;
  evaluation_run_record_id: string;
  evidence_disposition: EvidenceDisposition;
  disposition_reason: EvidenceDispositionReason;
  classified_refs?: Ref[];
  sealed_at?: string;
}

export interface CandidateEvaluationRunOutcome {
  candidate_id: string;
  candidate_version_id: string;
  trace: TracePlaceholderRecord;
  stage_binding: StageBindingRecord;
  evaluation_run: EvaluationRunRecord;
  comparison_set: EvaluationComparisonSetRecord;
  sealing_decision: EvidenceSealingDecisionRecord;
  evidence_classifications: EvidenceClassificationRecord[];
}

export interface RuntimeInstanceLogReadModel {
  log_ref: Ref;
  lines: string[];
  captured_at: string;
  authority_status: "trace_only";
}

export interface RuntimeInstanceHeartbeatReadModel {
  heartbeat_ref: Ref;
  heartbeat_line: string;
  observed_at: string;
  authority_status: "trace_only";
}

export interface SandboxCommandEvidenceReadModel {
  command_evidence_ref: Ref;
  command: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  started_at: string;
  completed_at: string;
  authority_status: "trace_only";
}

export interface SandboxRuntimeInstanceReadModel {
  instance_id: string;
  adapter_kind: SandboxRuntimeAdapterKind;
  runnable_artifact_ref: Ref;
  runtime_ref?: Ref;
  runtime_placement_ref: Ref;
  lifecycle_status: SandboxRuntimeInstanceLifecycleStatus;
  sandbox_name: string;
  sandbox_ref?: Ref;
  created_at: string;
  started_at?: string;
  last_heartbeat_at?: string;
  stopped_at?: string;
  removed_at?: string;
  log_refs: Ref[];
  heartbeat_refs: Ref[];
  command_evidence_refs: Ref[];
  trace_ref?: Ref;
  authority_status: "not_live";
}

export interface SandboxRuntimeInstanceDetailReadModel extends SandboxRuntimeInstanceReadModel {
  logs: RuntimeInstanceLogReadModel[];
  heartbeats: RuntimeInstanceHeartbeatReadModel[];
  command_evidence: SandboxCommandEvidenceReadModel[];
}

export interface RuntimeInstanceIndexProjection {
  record_kind: "runtime_instance_index_projection";
  version: 1;
  runtime_instances: SandboxRuntimeInstanceReadModel[];
}

export interface StartRuntimeInstanceInput {
  idempotency_key: string;
  adapter_kind: SandboxRuntimeAdapterKind;
  runnable_artifact_id: string;
  runtime_id?: string;
  instance_id?: string;
  sandbox_name?: string;
  test_ticks?: number;
  interval_ms?: number;
  created_at?: string;
}

export interface StartRuntimeInstanceOutcome {
  runtime_instance: SandboxRuntimeInstanceDetailReadModel;
}

export interface StopRuntimeInstanceInput {
  instance_id: string;
  stopped_at?: string;
  removed_at?: string;
}

export interface RuntimeInstanceLogsOutcome {
  runtime_instance: SandboxRuntimeInstanceReadModel;
  logs: RuntimeInstanceLogReadModel[];
  heartbeats: RuntimeInstanceHeartbeatReadModel[];
  command_evidence: SandboxCommandEvidenceReadModel[];
}
