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
  | "improvement_proposal_generation";

export type AgentRunStatus = "succeeded" | "failed" | "rejected" | "fixture_placeholder";

export type CandidateStatus = "fixture_only" | "materialized";

export type CandidateMaterializationStatus = "materialized" | "failed";

export type StageBindingStage = "backtest" | "paper" | "live";

export type StageBindingProfile = "backtest" | "paper" | "live";

export type TradingRuntimeEnvironment = "paper" | "live";

export type TradingSystemExecutionMode = "backtest" | "paper" | "live";

export type TradingSystemExecutionModeSupportStatus = "available" | "planned" | "disabled";

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
  | "live_requires_gateway"
  | "live_disabled";

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

export type SandboxPlacementKind =
  | EvaluationExecutionMode
  | "provider_managed"
  | "endpoint_backed"
  | "fixture_local_placeholder";

export type SandboxPlacementToolingKind =
  | "host_process"
  | "docker_compose"
  | "docker_sandbox"
  | "remote_container"
  | "provider_session"
  | "http_endpoint"
  | "fixture_only";

export type SystemCodeKind = "python_file" | "container_image";

export type SystemCodeRuntimeKind = "python" | "container_image";

export type SystemCodeOutputKind =
  | "program_event"
  | "runtime_log"
  | "runtime_heartbeat"
  | "metric_snapshot"
  | "diagnostic_artifact"
  | "order_request";

export type SystemCodeStatus = "registered";

export type SandboxLifecycleStatus =
  | "requested"
  | "created"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | "removed";

export type SandboxAdapterKind = "deterministic_test" | "docker_sandboxes_sbx";

export type ResearchDirectionKind =
  | "trend_following"
  | "mean_reversion"
  | "volatility_regime"
  | "funding_aware_risk"
  | "liquidation_aware_risk"
  | "execution_cost_robustness"
  | "other";

export type ResearchWorkerStatus = "active" | "failed" | "retired";

export type CandidateArenaTickStatus = "completed" | "completed_with_errors" | "failed";

export type CandidateArenaDirectionResultStatus = "created" | "failed";

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

export type ImprovementProposalStatus =
  | "proposed"
  | "materialized"
  | "discarded";

export type ResearchOrchestrationRunStatus =
  | "started"
  | "proposed"
  | "failed"
  | "discarded";

export type TradingRunLifecycleStatus =
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

export type RunControlAction =
  | "inspect"
  | "start"
  | "pause"
  | "resume"
  | "stop"
  | "override"
  | "kill"
  | "handoff"
  | "audit";

export type RunControlCommandStatus =
  | "pending_decision"
  | "decided"
  | "canceled"
  | "superseded";

export type RunControlCommandReason =
  | "operator_request"
  | "inspection_request"
  | "manual_override"
  | "safety_intervention"
  | "handoff_requested"
  | "audit_request"
  | "fixture_only";

export type RunControlDecisionOutcome =
  | "allowed"
  | "rejected"
  | "dry_run_only"
  | "no_live_authority";

export type RunControlDecisionReason =
  | "policy_allows_control"
  | "policy_rejected_control"
  | "no_live_authority"
  | "runtime_lifecycle_incompatible"
  | "operator_hold"
  | "manual_override_allowed"
  | "safety_kill_allowed"
  | "fixture_only";

export type RunControlActorKind =
  | "human_operator"
  | "policy_engine"
  | "external_handoff"
  | "fixture_operator";

export type RunControlAuthorityStatus =
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

export type OrderRequestKind =
  | "place_order"
  | "cancel_order"
  | "adjust_position";

export type OrderRequestStatus = "proposed" | "withdrawn" | "expired" | "rejected";

export type OrderRequestAuthorityStatus = "not_submitted" | "trace_only";

export type GatewayResultOutcome =
  | "allowed"
  | "rejected"
  | "clipped"
  | "dry_run_only";

export type GatewayResultReason =
  | "paper_stage_only"
  | "dry_run_allowed"
  | "no_live_authority"
  | "risk_limit_exceeded"
  | "operator_hold"
  | "fixture_only";

export type GatewayResultAuthorityStatus = "not_live" | "dry_run_only";

export type ExecutionResultStatus =
  | "not_submitted"
  | "dry_run_recorded"
  | "blocked"
  | "canceled"
  | "failed";

export type ExecutionResultAuthorityStatus =
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

export type ImprovementProposalProviderFailureReason =
  | "improvement_proposal_provider_unavailable"
  | "improvement_proposal_provider_failed"
  | "improvement_proposal_provider_timeout"
  | "invalid_improvement_proposal_request"
  | "no_eligible_research_finding"
  | "unsupported_improvement_proposal_task"
  | "unsupported_improvement_proposal_provider";

export type ImprovementProposalProviderOutputAuthorityStatus = "proposal_input_only";

export type ImprovementProposalProviderReadinessStatus =
  | "active_verified"
  | "blocked_or_not_installed"
  | "candidate_unverified";

export type ImprovementProposalMaterializationStatus = "materialized" | "failed";

export type ImprovementProposalMaterializationFailureReason =
  | "provider_output_schema_invalid"
  | "provider_output_rejected"
  | "improvement_proposal_source_finding_not_found"
  | ImprovementProposalProviderFailureReason;

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

export type TradingGatewayExchangeEnvironment = "unbound" | "testnet" | "mainnet" | "custom";

export type TradingGatewayEnvironmentSource =
  | "environment_variables"
  | "runtime_binding_policy";

export type TradingGatewayCredentialScope = "none" | "runtime_selected";

export type TradingGatewayEnvironmentStatus = "configured" | "blocked";

export interface TradingGatewayEnvironmentReadModel {
  environment_kind: "trading_gateway_environment";
  venue: TradingSubstrateVenue;
  instrument: TradingSubstrateInstrument;
  product_category: TradingSubstrateProductCategory;
  runtime_environment: TradingRuntimeEnvironment;
  runtime_environment_source: "mlp_policy";
  exchange_environment: TradingGatewayExchangeEnvironment;
  exchange_environment_source: TradingGatewayEnvironmentSource;
  rest_base_url: string | null;
  credential_scope: TradingGatewayCredentialScope;
  credential_source: "not_required" | "environment_variables";
  api_key_configured: boolean;
  api_secret_configured: boolean;
  configuration_status: TradingGatewayEnvironmentStatus;
  configuration_reason: string;
  authority_status: "not_live";
  live_exchange_authority: false;
  order_submission_authority: false;
  live_disabled_reason: "live_gateway_not_enabled_in_mlp";
  runtime_bindings: {
    paper: {
      status: "enabled";
      market_data_source: "binance_production_public_rest";
      rest_base_url: "https://fapi.binance.com";
      account_provider: "fake_paper_account";
      executor: "fake_paper_order_executor";
      ledger: "fake_ledger";
      live_exchange_authority: false;
      order_submission_authority: false;
      authority_status: "dry_run_only";
    };
    live: {
      status: "disabled";
      disabled_reason: "live_gateway_not_enabled_in_mlp";
      market_data_source: "binance_production_public_rest";
      rest_base_url: "https://fapi.binance.com";
      account_provider: "live_account";
      executor: "live_order_executor";
      ledger: "ledger";
      live_exchange_authority: false;
      order_submission_authority: false;
      authority_status: "not_live";
    };
  };
  env_var_names: {
    rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL";
    api_key: "OUROBOROS_BINANCE_API_KEY";
    api_secret: "OUROBOROS_BINANCE_API_SECRET";
  };
  warnings: string[];
}

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
  | "binance_production_public_rest"
  | "binance_production_public_websocket"
  | "binance_production_public_hybrid"
  | "binance_production_public_stream"
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
  testnet_base_url: "https://demo-fapi.binance.com";
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
  | "order_request"
  | "gateway_result"
  | "execution_result";

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
    tracking_chain: ["order_request", "gateway_result", "execution_result"],
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
  active_system_code_ref?: Ref;
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
  system_code_ref?: Ref;
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
  authority_status: "not_executable";
}

export interface SystemCodeOutputContract {
  contract_kind: "opaque_runtime_boundary";
  declared_output_kinds: SystemCodeOutputKind[];
  event_envelope_ref?: Ref;
  log_contract_ref?: Ref;
  heartbeat_contract_ref?: Ref;
}

export interface SystemCodeRuntimeContract {
  runtime_kind: SystemCodeRuntimeKind;
  entrypoint: string[];
  declared_output_contract: SystemCodeOutputContract;
  secret_policy_ref: Ref;
  capability_policy_ref: Ref;
}

export interface ArtifactRuntimeContractRecord
  extends BaseRecord,
    SystemCodeRuntimeContract {
  record_kind: "artifact_runtime_contract";
  artifact_runtime_contract_id: string;
  created_at: string;
  authority_status: "contract_only";
}

interface SystemCodeBaseRecord
  extends BaseRecord,
    SystemCodeRuntimeContract {
  record_kind: "system_code";
  system_code_id: string;
  artifact_kind: SystemCodeKind;
  artifact_digest: string;
  artifact_ref?: Ref;
  artifact_runtime_contract_ref?: Ref;
  provenance_refs: Ref[];
  status: SystemCodeStatus;
  created_at: string;
  authority_status: "not_live";
}

export type SystemCodeRecord =
  | (SystemCodeBaseRecord & {
      artifact_kind: "python_file";
      artifact_path: string;
    })
  | (SystemCodeBaseRecord & {
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
  system_code_ref: Ref;
  trading_evaluation_task_ref: Ref;
  sandbox_ref?: Ref;
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

export interface TradingProfitLossReadModel {
  revenue_usdt: number;
  cost_usdt: number;
  net_revenue_usdt: number;
  net_return_pct: number;
}

export type PaperTradingMarketDataSourceKind =
  | "binance_production_public_rest"
  | "binance_production_public_websocket"
  | "binance_production_public_hybrid"
  | "binance_production_public_stream";

export type PaperTradingMarketDataSourcePriority =
  | "websocket_primary"
  | "rest_fallback"
  | "hybrid_recovered";

export type PaperTradingMarketDataFreshness =
  | "fresh"
  | "stale"
  | "recovering"
  | "unavailable";

export interface PaperTradingOrderBookSummary {
  symbol: "BTCUSDT";
  observed_at: string;
  source_kind: PaperTradingMarketDataSourceKind;
  sync_status: "not_started" | "buffering" | "synced" | "recovering" | "stale";
  last_update_id?: string;
  previous_final_update_id?: string;
  top_bid_price?: string;
  top_bid_quantity?: string;
  top_ask_price?: string;
  top_ask_quantity?: string;
  depth_level_count?: number;
  gap_detected: boolean;
  authority_status: "read_only";
}

export interface PaperTradingMarketSnapshotSummary {
  symbol: "BTCUSDT";
  price: number;
  moving_average_fast?: number;
  moving_average_slow?: number;
  volatility?: number;
  expected_direction?: "long" | "short" | "flat";
  observed_at: string;
  source_kind: PaperTradingMarketDataSourceKind;
  source_priority?: PaperTradingMarketDataSourcePriority;
  freshness?: PaperTradingMarketDataFreshness;
  ws_connected?: boolean;
  rest_fallback_used?: boolean;
  gap_detected?: boolean;
  last_update_id?: string;
  stream_marker?: string;
  authority_status: "read_only";
}

export interface PaperTradingPublicExecutionSnapshotSummary {
  symbol: "BTCUSDT";
  observed_at: string;
  source_kind: PaperTradingMarketDataSourceKind;
  source_priority?: PaperTradingMarketDataSourcePriority;
  freshness?: PaperTradingMarketDataFreshness;
  ws_connected?: boolean;
  rest_fallback_used?: boolean;
  gap_detected?: boolean;
  last_update_id?: string;
  stream_marker: string;
  book_ticker?: {
    bid_price: string;
    bid_quantity: string;
    ask_price: string;
    ask_quantity: string;
    event_time?: string;
  };
  agg_trades: Array<{
    trade_id: string;
    price: string;
    quantity: string;
    trade_time: string;
    is_buyer_maker?: boolean;
  }>;
  order_book?: PaperTradingOrderBookSummary;
  authority_status: "read_only";
}

export type PaperTradingOrderStatus =
  | "open"
  | "partially_filled"
  | "filled"
  | "canceled"
  | "rejected";

export interface PaperTradingOrderSummary {
  order_id: string;
  event_id: string;
  side: "buy" | "sell";
  order_type: "market" | "limit";
  quantity: string;
  limit_price?: string;
  status: PaperTradingOrderStatus;
  cumulative_filled_quantity: string;
  remaining_quantity: string;
  average_fill_price?: string;
  created_at: string;
  updated_at: string;
  ledger_ref?: Ref;
}

export interface PaperTradingFillSummary {
  fill_id: string;
  order_id: string;
  fill_status: "partially_filled" | "filled";
  fill_price: string;
  fill_quantity: string;
  fee_usdt: string;
  slippage_usdt: string;
  funding_usdt: string;
  trade_time: string;
  source_trade_id?: string;
}

export interface PaperTradingAccountSnapshot {
  wallet_balance_usdt: string;
  available_balance_usdt: string;
  equity_usdt: string;
  realized_pnl_usdt: string;
  unrealized_pnl_usdt: string;
  fee_paid_usdt: string;
  slippage_paid_usdt: string;
  funding_paid_usdt: string;
  margin_reserved_usdt: string;
  position: {
    symbol: "BTCUSDT";
    quantity: string;
    side: "long" | "short" | "flat";
    average_entry_price?: string;
    mark_price: string;
    notional_usdt: string;
  };
  open_order_count: number;
  authority_status: "not_live";
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

export type PaperTradingObservationStatus = "recorded" | "no_order" | "failed";

export type PaperTradingDecisionKind = "order_request" | "hold" | "no_action" | "cancel_order" | "error";

export interface PaperTradingDecisionOrderRequestSummary {
  intent_kind: "place_order";
  symbol: "BTCUSDT";
  side: "buy" | "sell";
  order_type: "market" | "limit";
  quantity: string;
  limit_price?: string;
}

export interface PaperTradingDecisionSummary {
  decision_kind: PaperTradingDecisionKind;
  source_kind: "trading_system_decision";
  reason: string;
  observed_at: string;
  order_request?: PaperTradingDecisionOrderRequestSummary;
  authority_status: "trace_only";
}

export interface PaperTradingEvaluationRecord extends BaseRecord {
  record_kind: "paper_trading_evaluation";
  paper_trading_evaluation_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  trading_run_ref: Ref;
  status: PaperTradingEvaluationStatus;
  interval_ms: number;
  observation_count: number;
  started_at: string;
  last_observed_at?: string;
  next_observation_at?: string;
  stopped_at?: string;
  latest_score: TradingProfitLossReadModel;
  paper_account_snapshot?: PaperTradingAccountSnapshot;
  open_orders?: PaperTradingOrderSummary[];
  latest_fill?: PaperTradingFillSummary;
  processed_trading_system_event_ids?: string[];
  processed_public_trade_ids?: string[];
  latest_public_execution_snapshot?: PaperTradingPublicExecutionSnapshotSummary;
  latest_failure_reason?: string;
  authority_status: "not_live";
}

export interface PaperTradingObservationRecord extends BaseRecord {
  record_kind: "paper_trading_observation";
  paper_trading_observation_id: string;
  paper_trading_evaluation_ref: Ref;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  trading_run_ref: Ref;
  sequence: number;
  status: PaperTradingObservationStatus;
  observed_at: string;
  market_snapshot?: PaperTradingMarketSnapshotSummary;
  public_execution_snapshot?: PaperTradingPublicExecutionSnapshotSummary;
  decision?: PaperTradingDecisionSummary;
  ledger_ref?: Ref;
  paper_account_snapshot?: PaperTradingAccountSnapshot;
  open_orders?: PaperTradingOrderSummary[];
  latest_fill?: PaperTradingFillSummary;
  processed_trading_system_event_ids?: string[];
  processed_public_trade_ids?: string[];
  score_delta: TradingProfitLossReadModel;
  cumulative_score: TradingProfitLossReadModel;
  failure_reason?: string;
  authority_status: "not_live";
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
  child_system_code_ref: Ref;
  parent_system_code_ref?: Ref;
  source_finding_refs: Ref[];
  created_by_research_worker_ref?: Ref;
  created_at: string;
  authority_status: "lineage_only";
}

export interface ImprovementProposalRecord extends BaseRecord {
  record_kind: "improvement_proposal";
  improvement_proposal_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  trading_evaluation_task_ref: Ref;
  proposed_system_code_ref: Ref;
  parent_system_code_ref?: Ref;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs?: Ref[];
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  created_at: string;
  status: ImprovementProposalStatus;
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
  output_system_code_ref?: Ref;
  output_lineage_ref?: Ref;
  trace_ref?: Ref;
  started_at: string;
  completed_at?: string;
  status: ResearchOrchestrationRunStatus;
  authority_status: "research_only";
}

export interface ImprovementProposalProviderAttribution {
  provider_kind: ProviderKind;
  model: string;
  invocation_surface: string;
}

export interface ImprovementProposalProviderProbeResult extends ImprovementProposalProviderAttribution {
  readiness_status: ImprovementProposalProviderReadinessStatus;
  supported_purposes: Array<Extract<AgentRunPurpose, "improvement_proposal_generation">>;
  version?: string;
  provider_readiness_ref?: Ref;
  provider_probe_attempt_ref?: Ref;
  failure_reason?: ImprovementProposalProviderFailureReason;
}

export interface ImprovementProposalProviderRequest {
  idempotency_key: string;
  task: TradingEvaluationTaskRecord;
  findings: ResearchFindingRecord[];
  existing_lineages?: ArtifactLineageRecord[];
  existing_lineage_refs?: Ref[];
  parent_system_code_ref?: Ref;
  input_artifact_refs?: Ref[];
  requested_output_contract_ref?: Ref;
  agent_run_ref: Ref;
  trace_ref: Ref;
  created_at?: string;
}

export interface ImprovementProposalProviderOutput {
  output_kind: "improvement_proposal_input";
  trading_evaluation_task_ref: Ref;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs?: Ref[];
  parent_system_code_ref?: Ref;
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  proposed_artifact_refs: Ref[];
  output_authority_status: ImprovementProposalProviderOutputAuthorityStatus;
}

export type ImprovementProposalProviderResult =
  | {
      status: "succeeded";
      provider: ImprovementProposalProviderAttribution;
      output: ImprovementProposalProviderOutput;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: ImprovementProposalProviderOutputAuthorityStatus;
    }
  | {
      status: "failed";
      provider: ImprovementProposalProviderAttribution;
      failure_reason: ImprovementProposalProviderFailureReason;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: ImprovementProposalProviderOutputAuthorityStatus;
    };

export interface ImprovementProposalMaterializationInput {
  idempotency_key: string;
  provider_result: Extract<ImprovementProposalProviderResult, { status: "succeeded" }>;
  artifact_path?: string;
  artifact_runtime_contract_ref?: Ref;
  secret_policy_ref?: Ref;
  capability_policy_ref?: Ref;
  created_at?: string;
}

export interface ImprovementProposalProviderFailureInput {
  idempotency_key: string;
  provider_result: Extract<ImprovementProposalProviderResult, { status: "failed" }>;
  created_at?: string;
}

export interface ImprovementProposalMaterializationAttemptRecord extends BaseRecord {
  record_kind: "improvement_proposal_materialization_attempt";
  improvement_proposal_materialization_attempt_id: string;
  idempotency_key: string;
  provider: ImprovementProposalProviderAttribution;
  agent_run_ref: Ref;
  agent_event_refs: Ref[];
  trace_ref: Ref;
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  status: ImprovementProposalMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: ImprovementProposalMaterializationFailureReason;
  output_artifact_proposal_ref?: Ref;
  output_system_code_ref?: Ref;
  output_lineage_ref?: Ref;
  created_at: string;
  authority_status: ImprovementProposalProviderOutputAuthorityStatus;
}

export type ImprovementProposalMaterializationOutcome =
  | {
      status: "materialized";
      attempt: ImprovementProposalMaterializationAttemptRecord;
      proposal: ImprovementProposalRecord;
      system_code: SystemCodeRecord;
      lineage: ArtifactLineageRecord;
    }
  | {
      status: "failed";
      attempt: ImprovementProposalMaterializationAttemptRecord;
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

export interface TradingRunRecord extends BaseRecord {
  record_kind: "trading_run";
  trading_run_id: string;
  stage_binding_profile: "paper";
  runtime_lifecycle_status?: TradingRunLifecycleStatus;
  candidate_ref?: Ref;
  candidate_version_ref?: Ref;
  stage_binding_ref?: Ref;
  placement_ref: Ref;
  hands_environment_ref: Ref;
  memory_surface_ref: Ref;
  runtime_operating_policy_ref?: Ref;
  trace_ref?: Ref;
  order_request_refs?: Ref[];
  gateway_result_refs?: Ref[];
  execution_result_refs?: Ref[];
  run_control_command_refs?: Ref[];
  run_control_decision_refs?: Ref[];
  runtime_audit_event_refs?: Ref[];
  system_code_ref?: Ref;
  sandbox_ref?: Ref;
  created_at?: string;
  authority_status: "not_live";
}

export interface SandboxPlacementRecord extends BaseRecord {
  record_kind: "sandbox_placement";
  sandbox_placement_id: string;
  placement_kind: SandboxPlacementKind;
  tooling_kind?: SandboxPlacementToolingKind;
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

export interface SandboxRecord extends BaseRecord {
  record_kind: "sandbox";
  sandbox_id: string;
  adapter_kind: SandboxAdapterKind;
  system_code_ref: Ref;
  runtime_ref?: Ref;
  sandbox_placement_ref: Ref;
  lifecycle_status: SandboxLifecycleStatus;
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

export interface SandboxLogRecord extends BaseRecord {
  record_kind: "sandbox_log";
  sandbox_log_id: string;
  sandbox_ref: Ref;
  lines: string[];
  captured_at: string;
  authority_status: "trace_only";
}

export interface RuntimeHeartbeatRecord extends BaseRecord {
  record_kind: "runtime_heartbeat";
  runtime_heartbeat_id: string;
  sandbox_ref: Ref;
  heartbeat_line: string;
  observed_at: string;
  authority_status: "trace_only";
}

export interface SandboxCommandEvidenceRecord extends BaseRecord {
  record_kind: "sandbox_command_evidence";
  sandbox_command_evidence_id: string;
  sandbox_ref?: Ref;
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
  sandbox_placement_ref?: Ref;
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

export interface RunControlCommandRecord extends BaseRecord {
  record_kind: "run_control_command";
  run_control_command_id: string;
  runtime_ref: Ref;
  action: RunControlAction;
  requested_lifecycle_status?: TradingRunLifecycleStatus;
  actor_kind: RunControlActorKind;
  actor_ref?: Ref;
  runtime_operating_policy_ref?: Ref;
  idempotency_key: string;
  reason: RunControlCommandReason;
  reason_summary?: string;
  trace_ref?: Ref;
  related_order_request_refs?: Ref[];
  related_gateway_result_refs?: Ref[];
  related_execution_result_refs?: Ref[];
  requested_at: string;
  status: RunControlCommandStatus;
  authority_status: RunControlAuthorityStatus;
}

export interface RunControlDecisionRecord extends BaseRecord {
  record_kind: "run_control_decision";
  run_control_decision_id: string;
  runtime_ref: Ref;
  command_ref: Ref;
  decision_outcome: RunControlDecisionOutcome;
  decision_reason: RunControlDecisionReason;
  decided_by_actor_kind: RunControlActorKind;
  decided_by_actor_ref?: Ref;
  runtime_operating_policy_ref?: Ref;
  resulting_lifecycle_status?: TradingRunLifecycleStatus;
  trace_ref?: Ref;
  related_order_request_refs?: Ref[];
  related_gateway_result_refs?: Ref[];
  related_execution_result_refs?: Ref[];
  decided_at: string;
  authority_status: RunControlAuthorityStatus;
}

export interface RuntimeAuditEventRecord extends BaseRecord {
  record_kind: "runtime_audit_event";
  runtime_audit_event_id: string;
  runtime_ref: Ref;
  event_kind: RuntimeAuditEventKind;
  command_ref?: Ref;
  decision_ref?: Ref;
  actor_kind?: RunControlActorKind;
  actor_ref?: Ref;
  runtime_lifecycle_status?: TradingRunLifecycleStatus;
  message?: string;
  trace_ref?: Ref;
  supporting_record_refs?: Ref[];
  related_order_request_refs?: Ref[];
  related_gateway_result_refs?: Ref[];
  related_execution_result_refs?: Ref[];
  created_at: string;
  authority_status: "not_live" | "audit_only";
}

export interface RunControlAuditInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  runtime_id?: string;
  command: {
    action: RunControlAction;
    requested_lifecycle_status?: TradingRunLifecycleStatus;
    actor_kind: RunControlActorKind;
    actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    reason: RunControlCommandReason;
    reason_summary?: string;
    trace_ref?: Ref;
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  decision: {
    decision_outcome: RunControlDecisionOutcome;
    decision_reason: RunControlDecisionReason;
    decided_by_actor_kind: RunControlActorKind;
    decided_by_actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    resulting_lifecycle_status?: TradingRunLifecycleStatus;
    trace_ref?: Ref;
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  audit_event: {
    event_kind: RuntimeAuditEventKind;
    actor_kind?: RunControlActorKind;
    actor_ref?: Ref;
    runtime_lifecycle_status?: TradingRunLifecycleStatus;
    message?: string;
    trace_ref?: Ref;
    supporting_record_refs?: Ref[];
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  created_at?: string;
}

export interface RunControlAuditOutcome {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  command: RunControlCommandRecord;
  decision: RunControlDecisionRecord;
  audit_event: RuntimeAuditEventRecord;
}

export interface LedgerInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  runtime_id?: string;
  intent: {
    intent_kind: OrderRequestKind;
    side?: "buy" | "sell";
    order_type?: "market" | "limit";
    quantity?: string;
    limit_price?: string;
  };
  gateway_result: {
    decision_outcome: GatewayResultOutcome;
    decision_reason: GatewayResultReason;
    policy_ref?: Ref;
  };
  execution_result?: {
    execution_mode?: EvaluationExecutionMode;
    status?: ExecutionResultStatus;
    result_reason?: GatewayResultReason;
    trace_ref?: Ref;
    completed_at?: string;
  };
  created_at?: string;
}

export interface OrderRequestRecord extends BaseRecord {
  record_kind: "order_request";
  order_request_id: string;
  runtime_ref: Ref;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage_binding_ref: Ref;
  trace_ref?: Ref;
  intent_kind: OrderRequestKind;
  market_scope: "external_trading_api_fixture";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderRequestStatus;
  created_at: string;
  authority_status: OrderRequestAuthorityStatus;
}

export interface GatewayResultRecord extends BaseRecord {
  record_kind: "gateway_result";
  gateway_result_id: string;
  runtime_ref: Ref;
  order_request_ref: Ref;
  decision_outcome: GatewayResultOutcome;
  decision_reason: GatewayResultReason;
  decided_at: string;
  policy_ref?: Ref;
  clipped_order_request_ref?: Ref;
  authority_status: GatewayResultAuthorityStatus;
}

export interface ExecutionResultRecord extends BaseRecord {
  record_kind: "execution_result";
  execution_result_id: string;
  runtime_ref: Ref;
  order_request_ref: Ref;
  gateway_result_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "external_trading_api_fixture";
  trace_ref?: Ref;
  status: ExecutionResultStatus;
  result_reason: GatewayResultReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionResultAuthorityStatus;
}

export interface LedgerWriteOutcome {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  order_request: OrderRequestRecord;
  gateway_result: GatewayResultRecord;
  execution_result: ExecutionResultRecord;
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
    market: "ExternalTradingApiProvider" | "Binance USD-M Futures";
    instrument: "generic trading instruments" | "BTCUSDT";
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
  system_code_ref?: Ref;
  full_cycle_lineage?: CandidateMaterializationFullCycleLineageInput;
}

export interface CandidateMaterializationFullCycleLineageInput {
  source: {
    trading_system_id: string;
    candidate_version_id: string;
    system_code_ref?: Ref;
  };
  generated: {
    system_code_ref: Ref;
    artifact_digest: string;
    generated_by_agent: true;
  };
  evaluation: {
    status: string;
    score: number;
    profit_loss?: TradingProfitLossReadModel;
    direction_kind?: ResearchDirectionKind;
  };
}

export interface CandidateArenaResearcherReadModel {
  researcher_id: string;
  direction_kind: ResearchDirectionKind;
  status: ResearchWorkerStatus;
  agent_provider?: AgentProfileProviderKind;
  agent_model?: string;
  authority_status: "research_only";
}

export interface CandidateArenaLeaderboardEntryReadModel {
  rank: number;
  candidate_id: string;
  display_name: string;
  direction_kind: ResearchDirectionKind;
  parent_candidate_id?: string;
  status: TradingEvaluationResultStatus;
  profit_loss: TradingProfitLossReadModel;
  latest_finding: string;
  authority_status: "not_live";
}

export interface CandidateArenaLatestCandidateReadModel {
  candidate_id: string;
  display_name: string;
  direction_kind: ResearchDirectionKind;
  net_revenue_usdt: number;
  authority_status: "not_live";
}

export interface CandidateArenaResearchEfficiencyReadModel {
  provider_request_total: number;
  runner_command_total: number;
  scenario_count: number;
  elapsed_ms: number;
  authority_status: "not_promotion_authority";
}

export type CandidateArenaTickSourceKind =
  | "fixture_seed"
  | "evaluated_arena_leader"
  | "paper_trading_evaluation_leader"
  | "explicit_candidate";

export interface CandidateArenaTickSourceReadModel {
  source_kind: CandidateArenaTickSourceKind;
  candidate_id: string;
  display_name: string;
  net_revenue_usdt?: number;
  authority_status: "not_live";
}

export type CandidateArenaFindingClusterMarketRegime =
  | "long"
  | "short"
  | "flat"
  | "volatile"
  | "unknown";

export type CandidateArenaFindingClusterBlockerGroupKind =
  | "evidence_window"
  | "runner_health"
  | "observation_quality"
  | "market_provenance"
  | "fill_provenance";

export interface CandidateArenaFindingClusterReadModel {
  direction_kind: ResearchDirectionKind;
  top_blocker?: PaperTradingQualificationReason;
  blocker_group_kind?: CandidateArenaFindingClusterBlockerGroupKind;
  market_regime: CandidateArenaFindingClusterMarketRegime;
  protocol_failure_kind?: PaperTradingFailureKind;
  candidate_count: number;
  candidate_ids: string[];
  latest_finding?: string;
  next_research_focus: string;
  authority_status: "not_promotion_authority";
}

export interface CandidateArenaTickDirectionResultReadModel {
  direction_kind: ResearchDirectionKind;
  status: CandidateArenaDirectionResultStatus;
  agent_provider?: AgentProfileProviderKind;
  agent_model?: string;
  candidate_id?: string;
  finding?: string;
  error?: string;
  net_revenue_usdt?: number;
  research_efficiency?: CandidateArenaResearchEfficiencyReadModel;
}

export interface CandidateArenaTickReadModel {
  tick_id: string;
  started_at: string;
  completed_at: string;
  status: CandidateArenaTickStatus;
  source_candidate?: CandidateArenaTickSourceReadModel;
  created_candidate_ids: string[];
  direction_results: CandidateArenaTickDirectionResultReadModel[];
  authority_status: "not_live";
}

export interface CandidateArenaTickRecord extends BaseRecord {
  record_kind: "candidate_arena_tick";
  candidate_arena_tick_id: string;
  tick_id: string;
  started_at: string;
  completed_at: string;
  status: CandidateArenaTickStatus;
  source_candidate?: CandidateArenaTickSourceReadModel;
  created_candidate_refs: Ref[];
  direction_results: CandidateArenaTickDirectionResultReadModel[];
  authority_status: "not_live";
}

export interface CandidateArenaReadModel {
  arena_kind: "candidate_arena";
  runner_status: "running" | "stopped";
  tick_count: number;
  active_researchers: CandidateArenaResearcherReadModel[];
  leaderboard: CandidateArenaLeaderboardEntryReadModel[];
  latest_candidates: CandidateArenaLatestCandidateReadModel[];
  latest_ticks: CandidateArenaTickReadModel[];
  finding_clusters: CandidateArenaFindingClusterReadModel[];
  live_disabled: true;
  authority_status: "not_live";
}

export type AgentProfileProviderKind = "codex" | "fixture" | "claude_code";
export type AgentProfileId = AgentProfileProviderKind;
export type AgentProfileStatus =
  | "not_configured"
  | "configured"
  | "login_required"
  | "authenticated"
  | "unavailable"
  | "unsupported";

export interface AgentProfileRecord extends BaseRecord {
  record_kind: "agent_profile";
  agent_profile_id: AgentProfileId;
  provider: AgentProfileProviderKind;
  managed_home: string;
  managed_provider_home: string;
  status: AgentProfileStatus;
  provider_version?: string;
  failure_reason?: string;
  updated_at: string;
  authority_status: "no_trading_authority";
}

export interface AgentProfileReadModel {
  profile_id: AgentProfileId;
  label: string;
  provider: AgentProfileProviderKind;
  status: AgentProfileStatus;
  managed_home: string;
  managed_provider_home: string;
  version?: string;
  failure_reason?: string;
  authority_status: "no_trading_authority";
}

export interface ResearcherProviderSelectionRecord extends BaseRecord {
  record_kind: "researcher_provider_selection";
  researcher_provider_selection_id: "researcher";
  selected_provider: AgentProfileProviderKind;
  updated_at: string;
  authority_status: "research_only";
}

export interface ResearcherProviderReadModel {
  selected_provider: AgentProfileProviderKind;
  available_providers: AgentProfileProviderKind[];
  authority_status: "research_only";
}

export type OuroborosCommandKind =
  | "arena.status"
  | "arena.start"
  | "arena.stop"
  | "arena.tick"
  | "arena.cycle"
  | "candidate.select"
  | "trading_candidate.promote"
  | "candidate.paper_evidence.run"
  | "candidate.evaluation.run"
  | "candidate.replay.run"
  | "trading_run.start"
  | "trading_run.observe"
  | "trading_run.stop"
  | "run_control.record"
  | "private_readiness_posture.record"
  | "sandbox.start"
  | "sandbox.stop"
  | "agent_provider.status"
  | "agent_provider.setup"
  | "agent_provider.login.start"
  | "agent_provider.probe"
  | "researcher.provider.select";

export type OuroborosCommandGroup =
  | "arena"
  | "candidate"
  | "trading_candidate"
  | "trading_run"
  | "run_control"
  | "trading_substrate"
  | "sandbox"
  | "agent_provider"
  | "researcher";

export type OuroborosCommandAvailability =
  | "controller"
  | "local_cli_required";

export interface OuroborosCommandDescriptor {
  command_kind: OuroborosCommandKind;
  group: OuroborosCommandGroup;
  label: string;
  availability: OuroborosCommandAvailability;
  requires_candidate_id: boolean;
  authority_status: "not_live" | "research_only" | "no_trading_authority";
}

export const OUROBOROS_COMMAND_KINDS = [
  "arena.status",
  "arena.start",
  "arena.stop",
  "arena.tick",
  "arena.cycle",
  "candidate.select",
  "trading_candidate.promote",
  "candidate.paper_evidence.run",
  "candidate.evaluation.run",
  "candidate.replay.run",
  "trading_run.start",
  "trading_run.observe",
  "trading_run.stop",
  "run_control.record",
  "private_readiness_posture.record",
  "sandbox.start",
  "sandbox.stop",
  "agent_provider.status",
  "agent_provider.setup",
  "agent_provider.login.start",
  "agent_provider.probe",
  "researcher.provider.select"
] as const satisfies readonly OuroborosCommandKind[];

export const OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS = [
  "arena.status",
  "arena.start",
  "arena.stop",
  "arena.tick",
  "arena.cycle",
  "candidate.select",
  "trading_candidate.promote",
  "trading_run.start",
  "trading_run.observe",
  "trading_run.stop",
  "agent_provider.status",
  "agent_provider.setup",
  "agent_provider.login.start",
  "agent_provider.probe",
  "researcher.provider.select"
] as const satisfies readonly OuroborosCommandKind[];

export type OuroborosProductLoopCommandKind =
  typeof OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS[number];

export const OUROBOROS_COMMAND_DESCRIPTORS = [
  {
    command_kind: "arena.status",
    group: "arena",
    label: "Read arena status",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "arena.start",
    group: "arena",
    label: "Start arena loop",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "arena.stop",
    group: "arena",
    label: "Stop arena loop",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "arena.tick",
    group: "arena",
    label: "Run one research tick",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "arena.cycle",
    group: "arena",
    label: "Run autonomous paper cycle",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "candidate.select",
    group: "candidate",
    label: "Select candidate",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "trading_candidate.promote",
    group: "trading_candidate",
    label: "Promote candidate to Trading review",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "candidate.paper_evidence.run",
    group: "candidate",
    label: "Run selected paper evidence readback",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "candidate.evaluation.run",
    group: "candidate",
    label: "Run candidate evaluation",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "candidate.replay.run",
    group: "candidate",
    label: "Run candidate replay",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "trading_run.start",
    group: "trading_run",
    label: "Start paper trading run",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "trading_run.observe",
    group: "trading_run",
    label: "Observe trading run",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "trading_run.stop",
    group: "trading_run",
    label: "Stop trading run",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "run_control.record",
    group: "run_control",
    label: "Record run control",
    availability: "controller",
    requires_candidate_id: true,
    authority_status: "not_live"
  },
  {
    command_kind: "private_readiness_posture.record",
    group: "trading_substrate",
    label: "Record private readiness posture",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "sandbox.start",
    group: "sandbox",
    label: "Start sandbox",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "sandbox.stop",
    group: "sandbox",
    label: "Stop sandbox",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "not_live"
  },
  {
    command_kind: "agent_provider.status",
    group: "agent_provider",
    label: "Read agent provider status",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "no_trading_authority"
  },
  {
    command_kind: "agent_provider.setup",
    group: "agent_provider",
    label: "Set up managed agent provider",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "no_trading_authority"
  },
  {
    command_kind: "agent_provider.login.start",
    group: "agent_provider",
    label: "Start managed agent login",
    availability: "local_cli_required",
    requires_candidate_id: false,
    authority_status: "no_trading_authority"
  },
  {
    command_kind: "agent_provider.probe",
    group: "agent_provider",
    label: "Probe managed agent provider",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "no_trading_authority"
  },
  {
    command_kind: "researcher.provider.select",
    group: "researcher",
    label: "Select researcher provider",
    availability: "controller",
    requires_candidate_id: false,
    authority_status: "research_only"
  }
] as const satisfies readonly OuroborosCommandDescriptor[];

export const OUROBOROS_COMMAND_REGISTRY = Object.fromEntries(
  OUROBOROS_COMMAND_DESCRIPTORS.map((descriptor) => [descriptor.command_kind, descriptor])
) as Record<OuroborosCommandKind, OuroborosCommandDescriptor>;

export function isOuroborosCommandKind(value: unknown): value is OuroborosCommandKind {
  return typeof value === "string"
    && value in OUROBOROS_COMMAND_REGISTRY;
}

export function getOuroborosCommandDescriptor(
  commandKind: OuroborosCommandKind
): OuroborosCommandDescriptor {
  return OUROBOROS_COMMAND_REGISTRY[commandKind];
}

export type OuroborosCommandStatus = "succeeded" | "failed";

export interface OuroborosCommandRequest {
  command_kind: OuroborosCommandKind;
  request_id?: string;
  payload?: Record<string, unknown>;
}

export interface OuroborosCommandReadModel {
  command_id: string;
  command_kind: OuroborosCommandKind;
  request_id?: string;
  status: OuroborosCommandStatus;
  requested_at: string;
  completed_at: string;
  error?: string;
  summary?: string;
  authority_status: "not_live";
}

export interface OuroborosCommandRemediationReadModel {
  group: string;
  surface: string;
  remediation: string;
  authority_status: "not_live";
}

export function commandRemediation(
  command: OuroborosCommandReadModel
): OuroborosCommandRemediationReadModel | undefined {
  if (command.status !== "failed") {
    return undefined;
  }

  switch (command.command_kind) {
    case "trading_candidate.promote":
      return {
        group: "Trading review promotion",
        surface: "Trading review packet, Paper Board",
        remediation: "Review the Trading review packet blockers and Paper Board qualification before retrying promotion.",
        authority_status: "not_live"
      };
    case "trading_run.start":
    case "trading_run.observe":
    case "trading_run.stop":
      return {
        group: "Paper trading run",
        surface: "Selected candidate, Trading review runner",
        remediation: "Review the selected PaperTradingEvaluation runner state and latest paper failure before retrying the paper command.",
        authority_status: "not_live"
      };
    case "candidate.paper_evidence.run":
      return {
        group: "Paper evidence",
        surface: "Selected candidate, Ledger evidence",
        remediation: "Review the selected candidate paper failure and Ledger chain before retrying paper evidence.",
        authority_status: "not_live"
      };
    case "agent_provider.status":
    case "agent_provider.setup":
    case "agent_provider.login.start":
    case "agent_provider.probe":
    case "researcher.provider.select":
      return {
        group: "Agent provider",
        surface: "Agent provider status",
        remediation: "Review Agent providers and complete setup, login, or probe before running research.",
        authority_status: "not_live"
      };
    case "arena.status":
    case "arena.start":
    case "arena.stop":
    case "arena.tick":
    case "arena.cycle":
      return {
        group: "Candidate Arena",
        surface: "Candidate Arena cockpit, Latest ticks",
        remediation: "Review Candidate Arena runner state, latest ticks, provider status, and research failures before retrying the arena command.",
        authority_status: "not_live"
      };
    case "candidate.select":
      return {
        group: "Candidate selection",
        surface: "Selected candidate",
        remediation: "Review the Candidate Arena leaderboard and selected candidate evidence before retrying selection.",
        authority_status: "not_live"
      };
  }
}

export interface OuroborosCommandRecord extends BaseRecord {
  record_kind: "ouroboros_command";
  ouroboros_command_id: string;
  command_kind: OuroborosCommandKind;
  request_id?: string;
  status: OuroborosCommandStatus;
  requested_at: string;
  completed_at: string;
  error?: string;
  summary?: string;
  authority_status: "not_live";
}

export type SelectedPaperEvidenceStatus =
  | "not_run"
  | "running"
  | "ledger_chain_complete"
  | "failed";

export interface SelectedPaperEvidenceReadModel {
  status: SelectedPaperEvidenceStatus;
  ledger_chain_complete: boolean;
  ledger_chain_count?: number;
  latest_order_request_id?: string;
  latest_gateway_outcome?: string;
  latest_execution_status?: string;
  trading_run_status?: string;
  failure_reason?: string;
  authority_status: "not_live";
}

export type PaperTradingEvaluationStatus =
  | "not_started"
  | "running"
  | "stopped"
  | "failed";

export interface PaperTradingEvaluationReadModel {
  evaluation_kind: "paper_trading_evaluation";
  evaluation_id?: string;
  status: PaperTradingEvaluationStatus;
  candidate_id?: string;
  candidate_version_id?: string;
  trading_run_id?: string;
  trading_run_status?: TradingRunLifecycleStatus;
  runner_active: boolean;
  interval_ms?: number;
  observation_count: number;
  started_at?: string;
  last_observed_at?: string;
  next_observation_at?: string;
  stopped_at?: string;
  ledger_chain_complete: boolean;
  profit_loss: TradingProfitLossReadModel;
  latest_market_snapshot?: PaperTradingMarketSnapshotSummary;
  latest_public_execution_snapshot?: PaperTradingPublicExecutionSnapshotSummary;
  latest_decision?: PaperTradingDecisionSummary;
  paper_account_snapshot?: PaperTradingAccountSnapshot;
  open_orders?: PaperTradingOrderSummary[];
  latest_fill?: PaperTradingFillSummary;
  latest_order_request_id?: string;
  latest_gateway_outcome?: string;
  latest_execution_status?: string;
  latest_failure_reason?: string;
  latest_failure?: PaperTradingFailureReadModel;
  market_data_source: PaperTradingMarketDataSourceKind;
  account_provider: "fake_paper_account";
  executor: "fake_paper_order_executor";
  score_source: "paper_trading_engine";
  authority_status: "not_live";
}

export type PaperTradingBoardRunnerStatus =
  | "active"
  | "needs_resume"
  | "inactive";

export type PaperTradingPromotionGateStatus =
  | "collecting_paper_evidence"
  | "needs_resume"
  | "paper_evidence_recorded"
  | "paper_failed"
  | "not_evaluated";

export type PaperTradingQualificationStatus =
  | "collecting_evidence"
  | "qualified"
  | "needs_resume"
  | "blocked_by_quality"
  | "paper_failed";

export type PaperTradingQualificationReason =
  | "min_observation_count_not_met"
  | "min_elapsed_ms_not_met"
  | "runner_inactive_for_running_evaluation"
  | "failed_observation_ratio_exceeded"
  | "latest_market_snapshot_missing"
  | "fill_public_execution_evidence_missing"
  | "paper_evaluation_failed";

export interface PaperTradingLearningSummaryReadModel {
  rank?: number;
  net_revenue_usdt: number;
  net_return_pct: number;
  observation_count: number;
  qualification_status?: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  top_blocker?: PaperTradingQualificationReason;
  latest_failure_kind?: PaperTradingFailureKind;
  latest_failure_summary?: string;
  summary: string;
  next_research_focus: string;
  authority_status: "lineage_only";
}

export type PaperTradingFailureKind =
  | "market_data_gap"
  | "public_execution_evidence_gap"
  | "trading_system_protocol_error"
  | "risk_rejection"
  | "sandbox_or_runner_failure"
  | "runner_health_loss"
  | "ledger_gap"
  | "authority_boundary_violation"
  | "unknown_failure";

export interface PaperTradingFailureReadModel {
  failure_kind: PaperTradingFailureKind;
  reason: string;
  summary: string;
  next_action: string;
  authority_status: "not_live";
}

export interface PaperTradingEvidenceWindowReadModel {
  observation_count: number;
  elapsed_ms: number;
  failed_observation_count: number;
  first_observed_at?: string;
  last_observed_at?: string;
}

export interface PaperTradingRiskSummaryReadModel {
  open_order_count: number;
  account?: {
    equity_usdt: string;
    available_balance_usdt: string;
    wallet_balance_usdt: string;
    margin_reserved_usdt: string;
    authority_status: "not_live";
  };
  position?: {
    symbol: "BTCUSDT";
    side: "long" | "short" | "flat";
    quantity: string;
    notional_usdt: string;
    average_entry_price?: string;
    mark_price: string;
    authority_status: "not_live";
  };
  latest_fill_status?: PaperTradingFillSummary["fill_status"];
  latest_failure_reason?: string;
  latest_failure?: PaperTradingFailureReadModel;
}

export type PaperTradingBoardTrendDirection =
  | "improving"
  | "declining"
  | "flat"
  | "insufficient_history";

export interface PaperTradingBoardTrendReadModel {
  direction: PaperTradingBoardTrendDirection;
  net_revenue_delta_usdt: number;
  net_return_delta_pct: number;
  observation_count_delta: number;
  authority_status: "not_promotion_authority";
}

export interface PaperTradingBoardBlockerDensityReadModel {
  blocker_count: number;
  blocker_density: number;
  failed_observation_ratio: number;
  top_blocker?: PaperTradingQualificationReason;
  authority_status: "not_promotion_authority";
}

export interface PaperTradingBoardEntryReadModel {
  rank: number;
  candidate_id: string;
  display_name: string;
  evaluation_id: string;
  status: PaperTradingEvaluationStatus;
  runner_status: PaperTradingBoardRunnerStatus;
  promotion_gate_status: PaperTradingPromotionGateStatus;
  qualification_status: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  evidence_window: PaperTradingEvidenceWindowReadModel;
  risk_summary: PaperTradingRiskSummaryReadModel;
  trend: PaperTradingBoardTrendReadModel;
  blocker_density: PaperTradingBoardBlockerDensityReadModel;
  observation_count: number;
  trading_run_id: string;
  last_observed_at?: string;
  next_observation_at?: string;
  profit_loss: TradingProfitLossReadModel;
  market_data_source: PaperTradingMarketDataSourceKind;
  latest_public_execution_source?: PaperTradingMarketDataSourcePriority;
  latest_fill_status?: PaperTradingFillSummary["fill_status"];
  open_order_count: number;
  latest_failure_reason?: string;
  latest_failure?: PaperTradingFailureReadModel;
  authority_status: "not_live";
}

export interface PaperTradingBoardReadModel {
  board_kind: "paper_trading_board";
  primary_rank_metric: "net_revenue_usdt";
  secondary_rank_metric: "net_return_pct";
  evaluation_authority: "continuous_paper_trading";
  entries: PaperTradingBoardEntryReadModel[];
  live_disabled: true;
  authority_status: "not_live";
}

export type TradingPromotionStatus =
  | "not_promoted"
  | "promoted_for_trading_review";

export type TradingPromotionReadinessStatus =
  | "paper_required"
  | "collecting_paper_evidence"
  | "needs_resume"
  | "blocked_by_quality"
  | "ready_to_promote"
  | "promoted_for_trading_review";

export interface TradingPromotionRecord extends BaseRecord {
  record_kind: "trading_promotion";
  trading_promotion_id: string;
  status: "promoted_for_trading_review";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  promoted_at: string;
  promoted_by_command_ref?: Ref;
  authority_status: "not_live";
}

export interface TradingPromotionReadModel {
  promotion_kind: "trading_promotion";
  status: TradingPromotionStatus;
  readiness_status: TradingPromotionReadinessStatus;
  candidate_id?: string;
  candidate_version_id?: string;
  display_name?: string;
  promoted_at?: string;
  paper_trading_evaluation_id?: string;
  paper_qualification_status?: PaperTradingQualificationStatus;
  paper_qualification_reasons: PaperTradingQualificationReason[];
  paper_evidence_window?: PaperTradingEvidenceWindowReadModel;
  paper_profit_loss?: TradingProfitLossReadModel;
  runner_status?: PaperTradingBoardRunnerStatus;
  latest_failure_reason?: string;
  next_action: string;
  live_disabled_reason: "mlp_paper_only";
  authority_status: "not_live";
}

export type TradingReviewPacketSeverity =
  | "ready"
  | "collecting"
  | "needs_resume"
  | "blocked"
  | "failed"
  | "mismatch";

export type TradingReviewPacketBlocker =
  | PaperTradingQualificationReason
  | "arena_selection_mismatch"
  | "paper_required";

export type TradingReviewPacketBlockerGroupKind =
  | "evidence_window"
  | "runner_health"
  | "observation_quality"
  | "market_provenance"
  | "fill_provenance"
  | "selection";

export interface TradingReviewPacketBlockerGroup {
  group_kind: TradingReviewPacketBlockerGroupKind;
  severity: TradingReviewPacketSeverity;
  blockers: TradingReviewPacketBlocker[];
  summary: string;
  next_action: string;
}

export type TradingReviewPacketLedgerEvidenceStatus =
  | "not_observed"
  | "no_order_checkpoint"
  | "complete_chain"
  | "incomplete_chain";

export interface TradingReviewPacketRunnerReadModel {
  runner_status?: PaperTradingBoardRunnerStatus;
  runner_active: boolean;
  trading_run_status?: TradingRunLifecycleStatus;
  last_observed_at?: string;
  next_observation_at?: string;
  authority_status: "not_live";
}

export interface TradingReviewPacketLedgerReadModel {
  evidence_status: TradingReviewPacketLedgerEvidenceStatus;
  ledger_chain_complete: boolean;
  latest_order_request_id?: string;
  latest_gateway_outcome?: string;
  latest_execution_status?: string;
  latest_decision_kind?: PaperTradingDecisionKind;
  authority_status: "not_live";
}

export type TradingReviewPacketLineageStatus =
  | "available"
  | "blocked"
  | "missing";

export interface TradingReviewPacketLineageReadModel {
  lineage_status: TradingReviewPacketLineageStatus;
  direction_kind?: ResearchDirectionKind;
  parent_candidate_id?: string;
  parent_candidate_version_id?: string;
  source_system_code_ref?: Ref;
  generated_system_code_ref?: Ref;
  generated_artifact_digest?: string;
  generated_by_agent?: true;
  materialized_candidate_id?: string;
  materialized_candidate_version_id?: string;
  latest_finding?: string;
  evaluation_status?: string;
  evaluation_score?: number;
  profit_loss?: TradingProfitLossReadModel;
  paper_board_learning?: PaperTradingLearningSummaryReadModel;
  authority_status: "lineage_only";
}

export interface TradingReviewPacketReadModel {
  packet_kind: "trading_review_packet";
  verdict: {
    readiness_status: TradingPromotionReadinessStatus;
    qualification_status?: PaperTradingQualificationStatus;
    severity: TradingReviewPacketSeverity;
    top_blocker?: TradingReviewPacketBlocker;
  };
  subject: {
    candidate_id?: string;
    candidate_version_id?: string;
    display_name?: string;
    paper_trading_evaluation_id?: string;
    promoted_at?: string;
    selected_candidate_id: string | null;
    selected_matches_trading_review: boolean;
  };
  performance: {
    rank?: number;
    primary_rank_metric: "net_revenue_usdt";
    secondary_rank_metric: "net_return_pct";
    profit_loss?: TradingProfitLossReadModel;
  };
  evidence_quality: {
    evidence_window?: PaperTradingEvidenceWindowReadModel;
    qualification_reasons: PaperTradingQualificationReason[];
    blocker_groups: TradingReviewPacketBlockerGroup[];
  };
  provenance: {
    market_data_source?: PaperTradingMarketDataSourceKind;
    latest_public_execution_source?: PaperTradingMarketDataSourcePriority;
    latest_public_execution_freshness?: PaperTradingMarketDataFreshness;
    latest_public_execution_ws_connected?: boolean;
    latest_public_execution_rest_fallback_used?: boolean;
    latest_public_execution_stream_marker?: string;
    latest_fill_status?: PaperTradingFillSummary["fill_status"];
    order_book?: {
      sync_status: PaperTradingOrderBookSummary["sync_status"];
      last_update_id?: string;
      previous_final_update_id?: string;
      gap_detected: boolean;
      depth_level_count?: number;
      authority_status: "read_only";
    };
  };
  risk: PaperTradingRiskSummaryReadModel;
  runner: TradingReviewPacketRunnerReadModel;
  ledger: TradingReviewPacketLedgerReadModel;
  lineage: TradingReviewPacketLineageReadModel;
  authority: {
    authority_status: "not_live";
    live_disabled_reason: "mlp_paper_only";
    no_authority: {
      live_exchange_authority: false;
      private_read_authority: false;
      order_submission_authority: false;
      credentials: false;
    };
  };
  next_action: string;
}

export interface TradingReviewReadModel {
  review_kind: "trading_review";
  status: TradingPromotionStatus;
  readiness_status: TradingPromotionReadinessStatus;
  active_candidate_id?: string;
  active_candidate_version_id?: string;
  display_name?: string;
  promoted_at?: string;
  paper_trading_evaluation_id?: string;
  paper_qualification_status?: PaperTradingQualificationStatus;
  paper_qualification_reasons: PaperTradingQualificationReason[];
  paper_evidence_window?: PaperTradingEvidenceWindowReadModel;
  paper_profit_loss?: TradingProfitLossReadModel;
  paper_trading_evaluation: PaperTradingEvaluationReadModel;
  paper_board_entry?: PaperTradingBoardEntryReadModel;
  runner_status?: PaperTradingBoardRunnerStatus;
  latest_failure_reason?: string;
  selected_candidate_id: string | null;
  selected_matches_trading_review: boolean;
  review_packet: TradingReviewPacketReadModel;
  next_action: string;
  live_disabled_reason: "mlp_paper_only";
  authority_status: "not_live";
}

export type TradingFirstViewportRecommendationTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

export interface TradingFirstViewportRecommendationReadModel {
  label: "Recommended action";
  value: string;
  detail: string;
  tone: TradingFirstViewportRecommendationTone;
  authority_status: "read_only";
}

export interface TradingFirstViewportRecommendationInput {
  trading_review_packet?: TradingReviewPacketReadModel;
  compatibility?: {
    risk_status?: AccountPositionRiskMirrorRiskStatus;
    runtime_lifecycle_status?: TradingRunLifecycleStatus;
    has_improvement_proposal?: boolean;
    improvement_proposal_id?: string;
    has_ledger_evidence?: boolean;
    has_replay_evidence?: boolean;
  };
}

export function buildTradingFirstViewportRecommendation(
  input: TradingFirstViewportRecommendationInput
): TradingFirstViewportRecommendationReadModel {
  const packet = input.trading_review_packet;
  if (packet) {
    return {
      label: "Recommended action",
      value: packet.next_action,
      detail: tradingReviewPacketRecommendationDetail(packet),
      tone: tradingReviewPacketRecommendationTone(packet),
      authority_status: "read_only"
    };
  }

  const compatibility = input.compatibility;
  if (compatibility?.risk_status === "breach") {
    return {
      label: "Recommended action",
      value: "Stop and inspect",
      detail: "Risk status is breach; stop the Trading Run before considering another cycle.",
      tone: "danger",
      authority_status: "read_only"
    };
  }

  if (
    compatibility?.runtime_lifecycle_status === "running" &&
    compatibility.risk_status === "watch"
  ) {
    return {
      label: "Recommended action",
      value: "Observe risk",
      detail: "The Trading Run is active and risk is on watch; inspect position and Ledger before another cycle.",
      tone: "warning",
      authority_status: "read_only"
    };
  }

  if (compatibility?.has_improvement_proposal) {
    const proposalDetail = compatibility.improvement_proposal_id
      ? `Improvement produced ${compatibility.improvement_proposal_id}; review the handoff and start the next paper cycle.`
      : "Improvement produced a change proposal; review the handoff and start the next paper cycle.";
    return {
      label: "Recommended action",
      value: "Run next cycle",
      detail: proposalDetail,
      tone: "good",
      authority_status: "read_only"
    };
  }

  if (compatibility?.has_ledger_evidence) {
    return {
      label: "Recommended action",
      value: "Evaluate then improve",
      detail: "A request/result chain exists; use the outcome to judge whether the next System Code is better.",
      tone: "good",
      authority_status: "read_only"
    };
  }

  if (compatibility?.has_replay_evidence) {
    return {
      label: "Recommended action",
      value: "Create improvement",
      detail: "Evaluation evidence exists; produce an Improvement output before starting another run.",
      tone: "warning",
      authority_status: "read_only"
    };
  }

  return {
    label: "Recommended action",
    value: "Run first cycle",
    detail: "No complete request/result chain is visible yet; run the fixture paper cycle to create decision evidence.",
    tone: "warning",
    authority_status: "read_only"
  };
}

function tradingReviewPacketRecommendationDetail(
  packet: TradingReviewPacketReadModel
): string {
  return [
    `${packet.verdict.severity} / ${packet.verdict.top_blocker ?? "none"}`,
    packet.runner.runner_status ? `runner ${packet.runner.runner_status}` : undefined,
    packet.subject.selected_matches_trading_review ? undefined : "selected target mismatch"
  ].filter(Boolean).join(" / ");
}

function tradingReviewPacketRecommendationTone(
  packet: TradingReviewPacketReadModel
): TradingFirstViewportRecommendationTone {
  if (packet.verdict.severity === "ready") {
    return "good";
  }
  if (
    packet.verdict.severity === "blocked" ||
    packet.verdict.severity === "failed" ||
    packet.verdict.severity === "mismatch"
  ) {
    return "danger";
  }
  return "warning";
}

export interface OperatorReadModel {
  operator_kind: "ouroboros_operator";
  command_descriptors: readonly OuroborosCommandDescriptor[];
  candidate_arena: CandidateArenaReadModel;
  selected_candidate_id: string | null;
  selected_candidate: CandidateInspectReadModel | null;
  selected_paper_evidence: SelectedPaperEvidenceReadModel;
  selected_paper_trading_evaluation: PaperTradingEvaluationReadModel;
  paper_trading_board: PaperTradingBoardReadModel;
  trading_promotion?: TradingPromotionReadModel;
  trading_review: TradingReviewReadModel;
  researcher_provider: ResearcherProviderReadModel;
  agent_profiles: AgentProfileReadModel[];
  latest_commands: OuroborosCommandReadModel[];
  live_disabled: true;
  authority_status: "not_live";
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
  full_cycle_lineage?: CandidateMaterializationFullCycleLineageInput;
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
  | SystemCodeRecord
  | ResearchDirectionRecord
  | ResearchWorkerRecord
  | ExperimentRunRecord
  | TradingEvaluationTaskRecord
  | TradingEvaluationResultRecord
  | PaperTradingEvaluationRecord
  | PaperTradingObservationRecord
  | CandidateArenaTickRecord
  | AgentProfileRecord
  | ResearcherProviderSelectionRecord
  | OuroborosCommandRecord
  | ResearchFindingRecord
  | ArtifactLineageRecord
  | ImprovementProposalRecord
  | ResearchOrchestrationRunRecord
  | ImprovementProposalMaterializationAttemptRecord
  | AgentSpecRecord
  | AgentSessionRecord
  | AgentRunRecord
  | AgentEventRecord
  | ProviderReadinessRecord
  | ProviderProbeAttemptRecord
  | TradingRunRecord
  | SandboxPlacementRecord
  | SandboxRecord
  | SandboxLogRecord
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
  | RunControlCommandRecord
  | RunControlDecisionRecord
  | RuntimeAuditEventRecord
  | OrderRequestRecord
  | GatewayResultRecord
  | ExecutionResultRecord
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

export interface LedgerSourceOrderRequestReadModel {
  order_request_id: string;
  intent_kind: OrderRequestKind;
  market_scope: "external_trading_api_fixture";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderRequestStatus;
  created_at: string;
  authority_status: OrderRequestAuthorityStatus;
}

export interface LedgerSourceGatewayResultReadModel {
  gateway_result_id: string;
  order_request_ref: Ref;
  decision_outcome: GatewayResultOutcome;
  decision_reason: GatewayResultReason;
  decided_at: string;
  authority_status: GatewayResultAuthorityStatus;
}

export interface LedgerSourceExecutionResultReadModel {
  execution_result_id: string;
  order_request_ref: Ref;
  gateway_result_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "external_trading_api_fixture";
  status: ExecutionResultStatus;
  result_reason: GatewayResultReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionResultAuthorityStatus;
}

export interface LedgerSourceRecordsReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  chain_count: number;
  chains: LedgerSourceChainReadModel[];
  latest_order_request: LedgerSourceOrderRequestReadModel | null;
  latest_gateway_result: LedgerSourceGatewayResultReadModel | null;
  latest_execution_result: LedgerSourceExecutionResultReadModel | null;
  order_request: PlaceholderSummary;
  gateway_result: PlaceholderSummary;
  execution_result: PlaceholderSummary;
}

export interface LedgerSourceChainReadModel {
  chain_id: string;
  chain_complete: boolean;
  occurred_at: string;
  order_request: LedgerSourceOrderRequestReadModel;
  gateway_result: LedgerSourceGatewayResultReadModel | null;
  execution_result: LedgerSourceExecutionResultReadModel | null;
  authority_status: "not_live";
}

export interface ImprovementSourceFindingReadModel {
  finding_id: string;
  finding_kind: ResearchFindingKind;
  summary: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  created_at: string;
  authority_status: "research_trace_only";
}

export interface ImprovementProposalReadModel {
  proposal_id: string;
  proposed_system_code_ref: Ref;
  parent_system_code_ref?: Ref;
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs: Ref[];
  status: ImprovementProposalStatus;
  created_at: string;
  authority_status: "proposal_only";
}

export interface ImprovementMaterializationAttemptReadModel {
  attempt_id: string;
  provider: ImprovementProposalProviderAttribution;
  status: ImprovementProposalMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: ImprovementProposalMaterializationFailureReason;
  output_artifact_proposal_ref?: Ref;
  output_system_code_ref?: Ref;
  output_lineage_ref?: Ref;
  created_at: string;
  authority_status: ImprovementProposalProviderOutputAuthorityStatus;
}

export interface ImprovementOrchestrationRunReadModel {
  run_id: string;
  input_finding_refs: Ref[];
  input_lineage_refs: Ref[];
  output_artifact_proposal_ref?: Ref;
  output_system_code_ref?: Ref;
  output_lineage_ref?: Ref;
  trace_ref?: Ref;
  status: ResearchOrchestrationRunStatus;
  started_at: string;
  completed_at?: string;
  authority_status: "research_only";
}

export interface ImprovementExperimentReadModel {
  experiment_id: string;
  system_code_ref: Ref;
  sandbox_ref?: Ref;
  runtime_trace_refs: Ref[];
  trace_ref?: Ref;
  status: ExperimentRunStatus;
  submitted_at: string;
  authority_status: "not_live";
}

export interface ImprovementEvaluationResultReadModel {
  result_id: string;
  experiment_run_ref: Ref;
  result_status: TradingEvaluationResultStatus;
  evidence_disposition: EvidenceDisposition;
  total_score: number;
  evaluator_trace_ref: Ref;
  completed_at: string;
  authority_status: "not_counted" | "counted";
}

export interface ImprovementReadModel {
  improvement_kind: "improvement";
  source_model: "automated_alignment_researcher";
  has_activity: boolean;
  proposal_chain_complete: boolean;
  evaluation_chain_complete: boolean;
  chain_complete: boolean;
  latest_source_finding: ImprovementSourceFindingReadModel | null;
  latest_change_proposal: ImprovementProposalReadModel | null;
  latest_materialization: ImprovementMaterializationAttemptReadModel | null;
  latest_research_run: ImprovementOrchestrationRunReadModel | null;
  latest_experiment: ImprovementExperimentReadModel | null;
  latest_evaluation_result: ImprovementEvaluationResultReadModel | null;
  evidence: {
    status: "missing" | "not_sealed";
    reason: "evaluation_required" | "evidence_sealing_not_run";
    authority_status: "not_counted";
  };
  promotion: {
    status: "not_promoted";
    reason: "promotion_requires_sealed_evidence";
    authority_status: "not_live";
  };
  no_authority: {
    live_exchange: false;
    order_authority: false;
    credentials: false;
    promotion: false;
  };
}

export interface ImprovementReadModelInput {
  research_findings?: ResearchFindingRecord[];
  improvement_proposals?: ImprovementProposalRecord[];
  materialization_attempts?: ImprovementProposalMaterializationAttemptRecord[];
  research_orchestration_runs?: ResearchOrchestrationRunRecord[];
  experiment_runs?: ExperimentRunRecord[];
  trading_evaluation_results?: TradingEvaluationResultRecord[];
}

export function buildImprovementReadModel(
  input: ImprovementReadModelInput = {}
): ImprovementReadModel {
  const findings = input.research_findings ?? [];
  const proposals = input.improvement_proposals ?? [];
  const materializationAttempts = input.materialization_attempts ?? [];
  const orchestrationRuns = input.research_orchestration_runs ?? [];
  const experiments = input.experiment_runs ?? [];
  const evaluationResults = input.trading_evaluation_results ?? [];

  const latestProposal = latestByTime(
    proposals,
    (proposal) => proposal.created_at,
    (proposal) => proposal.improvement_proposal_id
  );
  const sourceFinding = latestProposal
    ? findingForProposal(findings, latestProposal)
    : latestByTime(
        findings.filter((finding) =>
          finding.finding_kind === "next_artifact_hint" || finding.finding_kind === "positive_result"
        ),
        (finding) => finding.created_at,
        (finding) => finding.research_finding_id
      );
  const materializationAttempt = latestProposal
    ? latestByTime(
        materializationAttempts.filter((attempt) =>
          attempt.output_artifact_proposal_ref?.id === latestProposal.improvement_proposal_id
        ),
        (attempt) => attempt.created_at,
        (attempt) => attempt.improvement_proposal_materialization_attempt_id
      )
    : latestByTime(
        materializationAttempts,
        (attempt) => attempt.created_at,
        (attempt) => attempt.improvement_proposal_materialization_attempt_id
      );
  const orchestrationRun = latestProposal
    ? latestByTime(
        orchestrationRuns.filter((run) =>
          run.output_artifact_proposal_ref?.id === latestProposal.improvement_proposal_id
        ),
        (run) => run.completed_at ?? run.started_at,
        (run) => run.research_orchestration_run_id
      )
    : latestByTime(
        orchestrationRuns,
        (run) => run.completed_at ?? run.started_at,
        (run) => run.research_orchestration_run_id
      );
  const experiment = latestProposal
    ? latestByTime(
        experiments.filter((item) =>
          item.system_code_ref.id === latestProposal.proposed_system_code_ref.id
        ),
        (item) => item.submitted_at,
        (item) => item.experiment_run_id
      )
    : latestByTime(
        experiments,
        (item) => item.submitted_at,
        (item) => item.experiment_run_id
      );
  const evaluationResult = experiment
    ? latestByTime(
        evaluationResults.filter((result) =>
          result.experiment_run_ref.id === experiment.experiment_run_id
        ),
        (result) => result.completed_at,
        (result) => result.trading_evaluation_result_id
      )
    : latestByTime(
        evaluationResults,
        (result) => result.completed_at,
        (result) => result.trading_evaluation_result_id
      );
  const hasActivity = Boolean(
    findings.length ||
    proposals.length ||
    materializationAttempts.length ||
    orchestrationRuns.length ||
    experiments.length ||
    evaluationResults.length
  );
  const evaluationChainComplete = Boolean(latestProposal && experiment && evaluationResult);

  return {
    improvement_kind: "improvement",
    source_model: "automated_alignment_researcher",
    has_activity: hasActivity,
    proposal_chain_complete: Boolean(latestProposal && materializationAttempt && orchestrationRun),
    evaluation_chain_complete: evaluationChainComplete,
    chain_complete: evaluationChainComplete,
    latest_source_finding: sourceFinding ? toImprovementSourceFindingReadModel(sourceFinding) : null,
    latest_change_proposal: latestProposal
      ? toImprovementProposalReadModel(latestProposal)
      : null,
    latest_materialization: materializationAttempt
      ? toImprovementMaterializationAttemptReadModel(materializationAttempt)
      : null,
    latest_research_run: orchestrationRun
      ? toImprovementOrchestrationRunReadModel(orchestrationRun)
      : null,
    latest_experiment: experiment ? toImprovementExperimentReadModel(experiment) : null,
    latest_evaluation_result: evaluationResult
      ? toImprovementEvaluationResultReadModel(evaluationResult)
      : null,
    evidence: evaluationResult
      ? {
          status: "not_sealed",
          reason: "evidence_sealing_not_run",
          authority_status: "not_counted"
        }
      : {
          status: "missing",
          reason: "evaluation_required",
          authority_status: "not_counted"
        },
    promotion: {
      status: "not_promoted",
      reason: "promotion_requires_sealed_evidence",
      authority_status: "not_live"
    },
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      promotion: false
    }
  };
}

function findingForProposal(
  findings: ResearchFindingRecord[],
  proposal: ImprovementProposalRecord
): ResearchFindingRecord | undefined {
  const sourceIds = new Set(proposal.source_finding_refs.map((findingRef) => findingRef.id));
  return latestByTime(
    findings.filter((finding) => sourceIds.has(finding.research_finding_id)),
    (finding) => finding.created_at,
    (finding) => finding.research_finding_id
  );
}

function toImprovementSourceFindingReadModel(
  finding: ResearchFindingRecord
): ImprovementSourceFindingReadModel {
  return {
    finding_id: finding.research_finding_id,
    finding_kind: finding.finding_kind,
    summary: finding.summary,
    research_worker_ref: finding.research_worker_ref,
    research_direction_ref: finding.research_direction_ref,
    created_at: finding.created_at,
    authority_status: finding.authority_status
  };
}

function toImprovementProposalReadModel(
  proposal: ImprovementProposalRecord
): ImprovementProposalReadModel {
  return {
    proposal_id: proposal.improvement_proposal_id,
    proposed_system_code_ref: proposal.proposed_system_code_ref,
    parent_system_code_ref: proposal.parent_system_code_ref,
    proposal_summary: proposal.proposal_summary,
    requested_change_summary: proposal.requested_change_summary,
    expected_improvement_summary: proposal.expected_improvement_summary,
    source_finding_refs: proposal.source_finding_refs,
    anti_hacking_finding_refs: proposal.anti_hacking_finding_refs ?? [],
    status: proposal.status,
    created_at: proposal.created_at,
    authority_status: proposal.authority_status
  };
}

function toImprovementMaterializationAttemptReadModel(
  attempt: ImprovementProposalMaterializationAttemptRecord
): ImprovementMaterializationAttemptReadModel {
  return {
    attempt_id: attempt.improvement_proposal_materialization_attempt_id,
    provider: attempt.provider,
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    output_artifact_proposal_ref: attempt.output_artifact_proposal_ref,
    output_system_code_ref: attempt.output_system_code_ref,
    output_lineage_ref: attempt.output_lineage_ref,
    created_at: attempt.created_at,
    authority_status: attempt.authority_status
  };
}

function toImprovementOrchestrationRunReadModel(
  run: ResearchOrchestrationRunRecord
): ImprovementOrchestrationRunReadModel {
  return {
    run_id: run.research_orchestration_run_id,
    input_finding_refs: run.input_finding_refs,
    input_lineage_refs: run.input_lineage_refs ?? [],
    output_artifact_proposal_ref: run.output_artifact_proposal_ref,
    output_system_code_ref: run.output_system_code_ref,
    output_lineage_ref: run.output_lineage_ref,
    trace_ref: run.trace_ref,
    status: run.status,
    started_at: run.started_at,
    completed_at: run.completed_at,
    authority_status: run.authority_status
  };
}

function toImprovementExperimentReadModel(
  experiment: ExperimentRunRecord
): ImprovementExperimentReadModel {
  return {
    experiment_id: experiment.experiment_run_id,
    system_code_ref: experiment.system_code_ref,
    sandbox_ref: experiment.sandbox_ref,
    runtime_trace_refs: experiment.runtime_trace_refs ?? [],
    trace_ref: experiment.trace_ref,
    status: experiment.status,
    submitted_at: experiment.submitted_at,
    authority_status: experiment.authority_status
  };
}

function toImprovementEvaluationResultReadModel(
  result: TradingEvaluationResultRecord
): ImprovementEvaluationResultReadModel {
  return {
    result_id: result.trading_evaluation_result_id,
    experiment_run_ref: result.experiment_run_ref,
    result_status: result.result_status,
    evidence_disposition: result.evidence_disposition,
    total_score: result.score_summary.total_score,
    evaluator_trace_ref: result.evaluator_trace_ref,
    completed_at: result.completed_at,
    authority_status: result.authority_status
  };
}

function latestByTime<T>(
  values: T[],
  timeOf: (value: T) => string,
  idOf: (value: T) => string
): T | undefined {
  return [...values].sort((a, b) => {
    const timeCompare = timeOf(a).localeCompare(timeOf(b));
    if (timeCompare !== 0) {
      return timeCompare;
    }
    return idOf(a).localeCompare(idOf(b));
  }).at(-1);
}

export interface OrderRequestReadModel {
  order_request_id: string;
  intent_kind: OrderRequestKind;
  market_scope: "external_trading_api_fixture";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderRequestStatus;
  created_at: string;
  authority_status: OrderRequestAuthorityStatus;
}

export interface GatewayResultReadModel {
  gateway_result_id: string;
  order_request_ref: Ref;
  decision_outcome: GatewayResultOutcome;
  decision_reason: GatewayResultReason;
  decided_at: string;
  authority_status: GatewayResultAuthorityStatus;
}

export interface ExecutionResultReadModel {
  execution_result_id: string;
  order_request_ref: Ref;
  gateway_result_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "external_trading_api_fixture";
  status: ExecutionResultStatus;
  result_reason: GatewayResultReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionResultAuthorityStatus;
}

export interface LedgerReadModel {
  ledger_kind: "ledger";
  has_activity: boolean;
  chain_complete: boolean;
  chain_count: number;
  chains: LedgerChainReadModel[];
  latest_order_request: OrderRequestReadModel | null;
  latest_gateway_result: GatewayResultReadModel | null;
  latest_execution_result: ExecutionResultReadModel | null;
  order_request: PlaceholderSummary;
  gateway_result: PlaceholderSummary;
  execution_result: PlaceholderSummary;
  authority_status: "not_live";
  no_authority: {
    live_exchange_authority: false;
    private_read_authority: false;
    order_submission_authority: false;
    credentials: false;
  };
  source_record_kinds: ["order_request", "gateway_result", "execution_result"];
}

export interface LedgerChainReadModel {
  chain_id: string;
  chain_complete: boolean;
  occurred_at: string;
  order_request: OrderRequestReadModel;
  gateway_result: GatewayResultReadModel | null;
  execution_result: ExecutionResultReadModel | null;
  authority_status: "not_live";
}

export function buildLedgerReadModel(
  source: LedgerSourceRecordsReadModel
): LedgerReadModel {
  return {
    ledger_kind: "ledger",
    has_activity: source.has_activity,
    chain_complete: source.chain_complete,
    chain_count: source.chain_count,
    chains: source.chains.map(toLedgerChainReadModel),
    latest_order_request: source.latest_order_request
      ? toOrderRequestReadModel(source.latest_order_request)
      : null,
    latest_gateway_result: source.latest_gateway_result
      ? toGatewayResultReadModel(source.latest_gateway_result)
      : null,
    latest_execution_result: source.latest_execution_result
      ? toExecutionResultReadModel(source.latest_execution_result)
      : null,
    order_request: {
      ...source.order_request,
      ref: canonicalRef(source.order_request.ref, "order_request"),
      label: "Order request"
    },
    gateway_result: {
      ...source.gateway_result,
      ref: canonicalRef(source.gateway_result.ref, "gateway_result"),
      label: "Gateway result"
    },
    execution_result: {
      ...source.execution_result,
      ref: canonicalRef(source.execution_result.ref, "execution_result"),
      label: "Execution result"
    },
    authority_status: "not_live",
    no_authority: {
      live_exchange_authority: false,
      private_read_authority: false,
      order_submission_authority: false,
      credentials: false
    },
    source_record_kinds: ["order_request", "gateway_result", "execution_result"]
  };
}

function toLedgerChainReadModel(
  chain: LedgerSourceChainReadModel
): LedgerChainReadModel {
  return {
    chain_id: chain.chain_id,
    chain_complete: chain.chain_complete,
    occurred_at: chain.occurred_at,
    order_request: toOrderRequestReadModel(chain.order_request),
    gateway_result: chain.gateway_result
      ? toGatewayResultReadModel(chain.gateway_result)
      : null,
    execution_result: chain.execution_result
      ? toExecutionResultReadModel(chain.execution_result)
      : null,
    authority_status: chain.authority_status
  };
}

function toOrderRequestReadModel(
  orderIntent: LedgerSourceOrderRequestReadModel
): OrderRequestReadModel {
  return {
    order_request_id: orderIntent.order_request_id,
    intent_kind: orderIntent.intent_kind,
    market_scope: orderIntent.market_scope,
    side: orderIntent.side,
    order_type: orderIntent.order_type,
    quantity: orderIntent.quantity,
    limit_price: orderIntent.limit_price,
    status: orderIntent.status,
    created_at: orderIntent.created_at,
    authority_status: orderIntent.authority_status
  };
}

function toGatewayResultReadModel(
  gatewayDecision: LedgerSourceGatewayResultReadModel
): GatewayResultReadModel {
  return {
    gateway_result_id: gatewayDecision.gateway_result_id,
    order_request_ref: canonicalRef(gatewayDecision.order_request_ref, "order_request"),
    decision_outcome: gatewayDecision.decision_outcome,
    decision_reason: gatewayDecision.decision_reason,
    decided_at: gatewayDecision.decided_at,
    authority_status: gatewayDecision.authority_status
  };
}

function toExecutionResultReadModel(
  executionAttempt: LedgerSourceExecutionResultReadModel
): ExecutionResultReadModel {
  return {
    execution_result_id: executionAttempt.execution_result_id,
    order_request_ref: canonicalRef(executionAttempt.order_request_ref, "order_request"),
    gateway_result_ref: canonicalRef(executionAttempt.gateway_result_ref, "gateway_result"),
    stage: executionAttempt.stage,
    execution_mode: executionAttempt.execution_mode,
    venue_scope: executionAttempt.venue_scope,
    status: executionAttempt.status,
    result_reason: executionAttempt.result_reason,
    created_at: executionAttempt.created_at,
    completed_at: executionAttempt.completed_at,
    authority_status: executionAttempt.authority_status
  };
}

function canonicalRef(refValue: Ref, recordKind: string): Ref {
  return {
    record_kind: recordKind,
    id: canonicalRecordId(refValue)
  };
}

function canonicalRecordId(refValue: Ref): string {
  if (refValue.record_kind === "order_request") {
    return canonicalId(refValue.id, "order-request", "order-request");
  }
  if (refValue.record_kind === "gateway_result") {
    return canonicalId(refValue.id, "gateway-result", "gateway-result");
  }
  if (refValue.record_kind === "execution_result") {
    return canonicalId(refValue.id, "execution-result", "execution-result");
  }
  return refValue.id;
}

function canonicalId(value: string, oldPrefix: string, newPrefix: string): string {
  return value.startsWith(oldPrefix) ? `${newPrefix}${value.slice(oldPrefix.length)}` : value;
}

export interface RunControlCommandReadModel {
  command_id: string;
  action: RunControlAction;
  requested_lifecycle_status?: TradingRunLifecycleStatus;
  actor_kind: RunControlActorKind;
  actor_ref?: Ref;
  reason: RunControlCommandReason;
  requested_at: string;
  status: RunControlCommandStatus;
  authority_status: RunControlAuthorityStatus;
}

export interface RunControlDecisionReadModel {
  decision_id: string;
  command_ref: Ref;
  decision_outcome: RunControlDecisionOutcome;
  decision_reason: RunControlDecisionReason;
  decided_by_actor_kind: RunControlActorKind;
  decided_by_actor_ref?: Ref;
  resulting_lifecycle_status?: TradingRunLifecycleStatus;
  decided_at: string;
  authority_status: RunControlAuthorityStatus;
}

export interface RunControlAuditEventReadModel {
  audit_event_id: string;
  event_kind: RuntimeAuditEventKind;
  command_ref?: Ref;
  decision_ref?: Ref;
  actor_kind?: RunControlActorKind;
  actor_ref?: Ref;
  runtime_lifecycle_status?: TradingRunLifecycleStatus;
  message?: string;
  created_at: string;
  authority_status: "not_live" | "audit_only";
}

export interface RunControlReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  latest_command: RunControlCommandReadModel | null;
  latest_decision: RunControlDecisionReadModel | null;
  latest_audit_event: RunControlAuditEventReadModel | null;
  command: PlaceholderSummary;
  decision: PlaceholderSummary;
  audit_event: PlaceholderSummary;
}

export interface FullCycleLineageReadModel {
  handoff_status: "runnable" | "blocked";
  source: {
    trading_system_id: string;
    candidate_version_id: string;
    system_code_ref?: Ref;
  };
  generated?: {
    system_code_ref: Ref;
    artifact_digest: string;
    generated_by_agent: true;
  };
  materialized?: {
    trading_system_id: string;
    candidate_version_id: string;
    system_code_ref?: Ref;
  };
  evidence?: {
    evaluation_status: string;
    evaluation_score: number;
    profit_loss?: TradingProfitLossReadModel;
    direction_kind?: ResearchDirectionKind;
    trading_run_id: string;
    gateway_result_outcome: string;
    ledger_chain_complete: boolean;
  };
  blocked_stage?: string;
  blocked_reason?: string;
}

export type TradingRunTranscriptItemKind =
  | "run_control_command"
  | "run_control_decision"
  | "run_control_audit"
  | "sandbox_lifecycle"
  | "sandbox_heartbeat"
  | "sandbox_log"
  | "sandbox_order_request"
  | "order_request"
  | "gateway_result"
  | "execution_result";

export interface TradingRunTranscriptItemReadModel {
  item_id: string;
  item_kind: TradingRunTranscriptItemKind;
  occurred_at: string;
  label: string;
  summary: string;
  ref?: Ref;
  authority_status: string;
  lifecycle_status?: TradingRunLifecycleStatus;
}

export interface TradingRunTranscriptReadModel {
  transcript_kind: "trading_run_transcript";
  has_activity: boolean;
  item_count: number;
  latest_item: TradingRunTranscriptItemReadModel | null;
  items: TradingRunTranscriptItemReadModel[];
  authority_status: "not_live";
  no_authority: {
    live_exchange_authority: false;
    private_read_authority: false;
    order_submission_authority: false;
    credentials: false;
  };
}

export interface CandidateInspectReadModel extends CandidateSummaryReadModel {
  trading_system?: {
    system_id: string;
    version_id: string;
    ref: Ref;
    status: CandidateStatus;
    summary: string;
  };
  system_code?: {
    ref?: Ref;
    summary: string;
    declared_runtime?: string;
    declared_outputs: string[];
  };
  trading_run?: {
    ref: Ref;
    stage: string;
    lifecycle_status?: TradingRunLifecycleStatus;
    authority_status: string;
  };
  ledger?: LedgerReadModel;
  improvement?: ImprovementReadModel;
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
    runtime_lifecycle_status?: TradingRunLifecycleStatus;
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
    ledger?: LedgerSourceRecordsReadModel;
    run_control?: RunControlReadModel;
    sandbox?: SandboxDetailReadModel;
    transcript?: TradingRunTranscriptReadModel;
  };
  trading_substrate?: TradingSubstrateReadModel;
  trace: PlaceholderSummary;
  evaluation: CandidateEvaluationReadModel;
  materialization_attempt?: CandidateMaterializationAttemptReadModel;
  full_cycle_lineage?: FullCycleLineageReadModel;
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

export interface SandboxLogReadModel {
  log_ref: Ref;
  lines: string[];
  captured_at: string;
  authority_status: "trace_only";
}

export interface SandboxHeartbeatReadModel {
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

export interface SandboxReadModel {
  sandbox_id: string;
  adapter_kind: SandboxAdapterKind;
  system_code_ref: Ref;
  runtime_ref?: Ref;
  sandbox_placement_ref: Ref;
  lifecycle_status: SandboxLifecycleStatus;
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

export interface SandboxDetailReadModel extends SandboxReadModel {
  logs: SandboxLogReadModel[];
  heartbeats: SandboxHeartbeatReadModel[];
  command_evidence: SandboxCommandEvidenceReadModel[];
}

export interface SandboxIndexProjection {
  record_kind: "sandbox_index_projection";
  version: 1;
  sandboxes: SandboxReadModel[];
}

export interface StartSandboxInput {
  idempotency_key: string;
  adapter_kind: SandboxAdapterKind;
  system_code_id: string;
  trading_run_id?: string;
  sandbox_id?: string;
  sandbox_name?: string;
  test_ticks?: number;
  interval_ms?: number;
  created_at?: string;
}

export interface StartSandboxOutcome {
  sandbox: SandboxDetailReadModel;
}

export interface StopSandboxInput {
  sandbox_id: string;
  stopped_at?: string;
  removed_at?: string;
}

export interface SandboxLogsOutcome {
  sandbox: SandboxReadModel;
  logs: SandboxLogReadModel[];
  heartbeats: SandboxHeartbeatReadModel[];
  command_evidence: SandboxCommandEvidenceReadModel[];
}
