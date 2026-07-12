import type {
  PrivateReadinessPolicyDecision,
  PrivateReadinessPolicyGateInput
} from "./private-readiness-policy";
import type { PrivateReadGateDecision } from "./private-read-gate";
import {
  isCandidateAdmissionDecisionConsistent,
  type CandidateAdmissionDecisionRecord,
  type CandidateAdmissionReason
} from "./candidate-admission-policy";

export * from "./private-read-gate";
export * from "./private-readiness-policy";
export * from "./candidate-admission-policy";

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

export type CandidateArenaDirectionResultStatus =
  | "created"
  | "duplicate"
  | "quarantined"
  | "failed";

export type CandidateArenaTickPaperTradingContinuationStatus = "started" | "failed";

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
  | "research_worker_failed"
  | "runtime_crash"
  | "risk_validation_failed"
  | "no_order_request"
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
  | "duplicate_result"
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

export interface SystemCodeArtifactClosureDigestEntry {
  relative_path: string;
  content_digest: string;
}

export function systemCodeArtifactClosureDigestInput(
  entries: SystemCodeArtifactClosureDigestEntry[]
): string {
  return JSON.stringify({
    closure_kind: "single_file_python_v1",
    entries: [...entries]
      .sort((left, right) => left.relative_path === right.relative_path
        ? 0
        : left.relative_path < right.relative_path ? -1 : 1)
      .map((entry) => ({
        relative_path: entry.relative_path,
        content_digest: entry.content_digest
      }))
  });
}

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

export interface ResearchPreflightCommitmentRecord extends BaseRecord {
  record_kind: "research_preflight_commitment";
  research_preflight_commitment_id: string;
  candidate_arena_tick_id: string;
  research_direction_ref: Ref;
  research_worker_ref: Ref;
  research_allocation_ref: Ref;
  research_allocation_digest: string;
  source_system_code_ref: Ref;
  source_artifact_digest: string;
  development_policy: {
    suite_version: "research_development_replay_v1";
    suite_digest: string;
    submission_limit: number;
    feedback_release: "aggregate_after_each_submission";
  };
  sealed_admission_policy: {
    suite_version: "research_sealed_admission_v1";
    generator_version: "research_scenario_generator_v1";
    rotation_commitment_digest: string;
    suite_digest: string;
    submission_limit: 1;
    feedback_release: "terminal_after_freeze";
  };
  committed_at: string;
  research_preflight_authority: true;
  admission_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
  commitment_digest: string;
}

export function researchPreflightCommitmentDigestInput(
  record: ResearchPreflightCommitmentRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_preflight_commitment_id: _id,
    commitment_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchPreflightCommitmentHasRuntimeShape(
  value: unknown
): value is ResearchPreflightCommitmentRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_preflight_commitment_id",
    "candidate_arena_tick_id",
    "research_direction_ref",
    "research_worker_ref",
    "research_allocation_ref",
    "research_allocation_digest",
    "source_system_code_ref",
    "source_artifact_digest",
    "development_policy",
    "sealed_admission_policy",
    "committed_at",
    "research_preflight_authority",
    "admission_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status",
    "commitment_digest"
  ]) || value.record_kind !== "research_preflight_commitment" ||
    value.version !== 1 ||
    !comparisonString(value.research_preflight_commitment_id) ||
    !comparisonString(value.candidate_arena_tick_id) ||
    !comparisonRef(value.research_direction_ref, "research_direction") ||
    !comparisonRef(value.research_worker_ref, "research_worker") ||
    !comparisonRef(
      value.research_allocation_ref,
      "candidate_arena_research_allocation"
    ) || !researchPreflightSha256Digest(value.research_allocation_digest) ||
    !comparisonRef(value.source_system_code_ref, "system_code") ||
    !researchPreflightSha256Digest(value.source_artifact_digest) ||
    !researchPreflightDevelopmentPolicyHasRuntimeShape(value.development_policy) ||
    !researchPreflightSealedPolicyHasRuntimeShape(value.sealed_admission_policy) ||
    !comparisonIso(value.committed_at) ||
    value.research_preflight_authority !== true ||
    value.admission_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live" ||
    !researchPreflightSha256Digest(value.commitment_digest)) {
    return false;
  }
  return value.development_policy.suite_digest !==
    value.sealed_admission_policy.suite_digest;
}

function researchPreflightDevelopmentPolicyHasRuntimeShape(
  value: unknown
): value is ResearchPreflightCommitmentRecord["development_policy"] {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "suite_version",
    "suite_digest",
    "submission_limit",
    "feedback_release"
  ]) && value.suite_version === "research_development_replay_v1" &&
    researchPreflightSha256Digest(value.suite_digest) &&
    comparisonPositive(value.submission_limit) &&
    value.submission_limit <= 2 &&
    value.feedback_release === "aggregate_after_each_submission";
}

function researchPreflightSealedPolicyHasRuntimeShape(
  value: unknown
): value is ResearchPreflightCommitmentRecord["sealed_admission_policy"] {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "suite_version",
    "generator_version",
    "rotation_commitment_digest",
    "suite_digest",
    "submission_limit",
    "feedback_release"
  ]) && value.suite_version === "research_sealed_admission_v1" &&
    value.generator_version === "research_scenario_generator_v1" &&
    researchPreflightSha256Digest(value.rotation_commitment_digest) &&
    researchPreflightSha256Digest(value.suite_digest) &&
    value.submission_limit === 1 &&
    value.feedback_release === "terminal_after_freeze";
}

function researchPreflightSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

export type PaperTradingHandoffConformanceRunnerKind =
  | "host_process"
  | "docker_sandboxes_sbx";

export type PaperTradingHandoffConformanceStatus = "passed" | "rejected";

export type PaperTradingHandoffConformanceReason =
  | "passed"
  | "runner_crash"
  | "execution_timed_out"
  | "provider_protocol_incomplete"
  | "provider_protocol_violation"
  | "provider_request_limit_exceeded"
  | "paper_decision_missing"
  | "paper_decision_ambiguous"
  | "paper_event_invalid"
  | "runtime_heartbeat_missing"
  | "runtime_stop_missing"
  | "instance_identity_mismatch"
  | "artifact_digest_mismatch"
  | "hidden_evaluator_field"
  | "candidate_self_report"
  | "private_or_live_authority";

export interface PaperTradingHandoffConformanceRecord extends BaseRecord {
  record_kind: "paper_trading_handoff_conformance";
  paper_trading_handoff_conformance_id: string;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  experiment_run_ref: Ref;
  trading_evaluation_task_ref: Ref;
  protocol_version: "paper_trading_event_protocol_v1";
  runner_kind: PaperTradingHandoffConformanceRunnerKind;
  status: PaperTradingHandoffConformanceStatus;
  reason: PaperTradingHandoffConformanceReason;
  provider_request_count: number;
  decision_event_kind?: "order_request" | "hold" | "no_action";
  heartbeat_count: number;
  runtime_stopped: boolean;
  started_at: string;
  completed_at: string;
  evidence_digest: string;
  research_preflight_authority: true;
  runnable_paper_handoff: boolean;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

const PAPER_TRADING_HANDOFF_CONFORMANCE_REJECTION_REASONS = new Set<
  PaperTradingHandoffConformanceReason
>([
  "runner_crash",
  "execution_timed_out",
  "provider_protocol_incomplete",
  "provider_protocol_violation",
  "provider_request_limit_exceeded",
  "paper_decision_missing",
  "paper_decision_ambiguous",
  "paper_event_invalid",
  "runtime_heartbeat_missing",
  "runtime_stop_missing",
  "instance_identity_mismatch",
  "artifact_digest_mismatch",
  "hidden_evaluator_field",
  "candidate_self_report",
  "private_or_live_authority"
]);

export function paperTradingHandoffConformanceDigestInput(
  record: PaperTradingHandoffConformanceRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    paper_trading_handoff_conformance_id: _id,
    evidence_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingHandoffConformanceHasRuntimeShape(
  value: unknown
): value is PaperTradingHandoffConformanceRecord {
  if (!comparisonObject(value)) {
    return false;
  }
  const requiredKeys = [
    "record_kind",
    "version",
    "paper_trading_handoff_conformance_id",
    "system_code_ref",
    "system_code_artifact_digest",
    "experiment_run_ref",
    "trading_evaluation_task_ref",
    "protocol_version",
    "runner_kind",
    "status",
    "reason",
    "provider_request_count",
    "heartbeat_count",
    "runtime_stopped",
    "started_at",
    "completed_at",
    "evidence_digest",
    "research_preflight_authority",
    "runnable_paper_handoff",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ];
  const expectedKeys = value.decision_event_kind === undefined
    ? requiredKeys
    : [...requiredKeys, "decision_event_kind"];
  if (!comparisonHasExactKeys(value, expectedKeys)) {
    return false;
  }
  if (
    value.record_kind !== "paper_trading_handoff_conformance" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_handoff_conformance_id) ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !comparisonDigest(value.system_code_artifact_digest) ||
    !comparisonRef(value.experiment_run_ref, "experiment_run") ||
    !comparisonRef(value.trading_evaluation_task_ref, "trading_evaluation_task") ||
    value.protocol_version !== "paper_trading_event_protocol_v1" ||
    (value.runner_kind !== "host_process" &&
      value.runner_kind !== "docker_sandboxes_sbx") ||
    (value.status !== "passed" && value.status !== "rejected") ||
    !comparisonString(value.reason) ||
    !comparisonNonNegative(value.provider_request_count) ||
    value.provider_request_count > 8 ||
    (value.decision_event_kind !== undefined &&
      value.decision_event_kind !== "order_request" &&
      value.decision_event_kind !== "hold" &&
      value.decision_event_kind !== "no_action") ||
    !comparisonNonNegative(value.heartbeat_count) ||
    typeof value.runtime_stopped !== "boolean" ||
    !comparisonIso(value.started_at) ||
    !comparisonIso(value.completed_at) ||
    Date.parse(value.completed_at) < Date.parse(value.started_at) ||
    !comparisonDigest(value.evidence_digest) ||
    value.research_preflight_authority !== true ||
    typeof value.runnable_paper_handoff !== "boolean" ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live"
  ) {
    return false;
  }
  if (value.status === "passed") {
    return value.reason === "passed" &&
      value.provider_request_count >= 3 &&
      value.decision_event_kind !== undefined &&
      value.heartbeat_count > 0 &&
      value.runtime_stopped === true &&
      value.runnable_paper_handoff === true;
  }
  return PAPER_TRADING_HANDOFF_CONFORMANCE_REJECTION_REASONS.has(
    value.reason as PaperTradingHandoffConformanceReason
  ) && value.runnable_paper_handoff === false;
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
  research_preflight_commitment_ref?: Ref;
  research_preflight_commitment_digest?: string;
  submitted_system_code_ref?: Ref;
  submitted_artifact_digest?: string;
  sealed_admission_suite_digest?: string;
  evaluation_phase?: "sealed_admission";
  submission_sequence?: 1;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
  quarantine_reason?: TradingEvaluationQuarantineReason;
  completed_at: string;
  authority_status: "not_counted" | "counted";
}

export function tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(
  value: unknown
): value is TradingEvaluationResultRecord {
  if (!comparisonObject(value)) return false;
  const keys = [
    "research_preflight_commitment_ref",
    "research_preflight_commitment_digest",
    "submitted_system_code_ref",
    "submitted_artifact_digest",
    "sealed_admission_suite_digest",
    "evaluation_phase",
    "submission_sequence"
  ] as const;
  const presentCount = keys.filter((key) => Object.hasOwn(value, key)).length;
  if (presentCount === 0) return true;
  return presentCount === keys.length &&
    comparisonRef(
      value.research_preflight_commitment_ref,
      "research_preflight_commitment"
    ) && researchPreflightSha256Digest(value.research_preflight_commitment_digest) &&
    comparisonRef(value.submitted_system_code_ref, "system_code") &&
    researchPreflightSha256Digest(value.submitted_artifact_digest) &&
    researchPreflightSha256Digest(value.sealed_admission_suite_digest) &&
    value.evaluation_phase === "sealed_admission" &&
    value.submission_sequence === 1;
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

export type PaperTradingEvidencePurpose = "research_feedback" | "qualification";

export type PaperTradingEvaluationInvalidationReason =
  | "commitment_missing"
  | "commitment_digest_mismatch"
  | "candidate_identity_mismatch"
  | "candidate_version_identity_mismatch"
  | "system_code_identity_mismatch"
  | "stored_artifact_digest_mismatch"
  | "resolved_artifact_digest_mismatch"
  | "runtime_identity_mismatch"
  | "provider_identity_mismatch"
  | "capability_policy_mismatch"
  | "secret_policy_mismatch"
  | "evaluation_policy_identity_mismatch"
  | "initial_account_identity_mismatch"
  | "paper_only_authority_violation";

export interface PaperTradingEvaluationRuntimeIdentity {
  artifact_kind: SystemCodeKind;
  runtime_kind: SystemCodeRuntimeKind;
  entrypoint: string[];
  artifact_runtime_contract_ref?: Ref;
}

export interface PaperTradingEvaluationProviderIdentity {
  runtime_provider_kind: "none" | "managed_agent";
  agent_profile_ref?: Ref;
  model?: string;
  provider_configuration_digest?: string;
  qualification_eligible: boolean;
  ineligibility_reason?: "provider_identity_unavailable";
}

export interface PaperTradingEvaluationPolicyIdentity {
  market_data_policy_version: string;
  gateway_policy_version: string;
  cost_policy_version: string;
  funding_policy_version: string;
  slippage_policy_version: string;
  fill_policy_version: string;
  risk_policy_version: string;
  paper_account_policy_version: string;
  decision_event_protocol_version: string;
  persistent_state_boundary_version: string;
}

export interface PaperTradingEvaluationDataIdentity {
  symbol: "BTCUSDT";
  market_data_port: "gateway_owned";
  allowed_market_data_source: PaperTradingMarketDataSourceKind;
  market_data_configuration_digest: string;
  private_exchange_access: "forbidden";
  live_order_access: "forbidden";
}

export interface PaperTradingEvaluationWindowPolicy {
  interval_ms: number;
  release_policy: "closed_observation" | "sealed_until_adjudication";
  eligibility_policy_version: string;
}

export interface PaperTradingEvaluationCommitmentRecord extends BaseRecord {
  record_kind: "paper_trading_evaluation_commitment";
  paper_trading_evaluation_commitment_id: string;
  evidence_purpose: PaperTradingEvidencePurpose;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  trading_run_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  resolved_artifact_digest: string;
  runtime_identity: PaperTradingEvaluationRuntimeIdentity;
  provider_identity: PaperTradingEvaluationProviderIdentity;
  capability_policy_ref: Ref;
  secret_policy_ref: Ref;
  policy_identity: PaperTradingEvaluationPolicyIdentity;
  data_identity: PaperTradingEvaluationDataIdentity;
  window_policy: PaperTradingEvaluationWindowPolicy;
  initial_account_snapshot: PaperTradingAccountSnapshot;
  committed_at: string;
  commitment_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonCandidateSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  candidate_version_digest: string;
  system_code_ref: Ref;
  system_code_record_digest: string;
  system_code_artifact_digest: string;
  candidate_admission_decision_ref: Ref;
  admission_decision_digest: string;
}

export interface PaperTradingComparisonSide extends PaperTradingComparisonCandidateSide {
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_commitment_digest: string;
  paper_trading_evaluation_commitment_record_digest: string;
  paper_trading_evaluation_ref: Ref;
  paper_trading_evaluation_record_digest: string;
}

export interface PaperTradingComparisonPolicy {
  policy_version: string;
  comparison_mode: "bootstrap" | "champion_challenge";
  symbol: "BTCUSDT";
  interval_ms: number;
  minimum_observation_count: number;
  minimum_elapsed_ms: number;
  maximum_observation_count: number;
  maximum_elapsed_ms: number;
  maximum_start_skew_ms: number;
  maximum_provider_request_count_per_side: number;
  maximum_retry_count_per_side: number;
  primary_metric: "net_revenue_usdt";
  minimum_net_revenue_lift_usdt: number;
  required_confirmation_count: number;
  require_non_overlapping_windows: true;
  require_both_qualified: true;
  release_policy: "sealed_until_adjudication";
}

export type PaperTradingComparisonChampionSelection =
  | { selection_kind: "bootstrap" }
  | {
      selection_kind: "trading_review";
      trading_promotion_ref: Ref;
      trading_promotion_digest: string;
      paper_trading_evaluation_ref: Ref;
      paper_trading_evaluation_record_digest: string;
      paper_trading_evaluation_commitment_ref: Ref;
      paper_trading_evaluation_commitment_record_digest: string;
      paper_trading_observation_chain_digest: string;
    };

export interface PaperTradingComparisonPreparationRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_preparation";
  paper_trading_comparison_preparation_id: string;
  paper_trading_comparison_commitment_id: string;
  champion: PaperTradingComparisonCandidateSide;
  challenger: PaperTradingComparisonCandidateSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  committed_at: string;
  preparation_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonCommitmentRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_commitment";
  paper_trading_comparison_commitment_id: string;
  preparation_ref: Ref;
  champion: PaperTradingComparisonSide;
  challenger: PaperTradingComparisonSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  committed_at: string;
  commitment_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonTickRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick";
  paper_trading_comparison_tick_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  sequence: number;
  previous_tick_ref?: Ref;
  previous_tick_digest?: string;
  market_data_configuration_digest: string;
  market_snapshot: PaperTradingMarketSnapshotSummary;
  public_execution_snapshot: PaperTradingPublicExecutionSnapshotSummary;
  observed_at: string;
  tick_digest: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonTickContext {
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  delivery_ref: Ref;
  delivery_digest: string;
}

export interface PaperTradingComparisonTickDeliveryRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick_delivery";
  paper_trading_comparison_tick_delivery_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  provider_request_count_at_delivery: number;
  endpoint: "GET /market/snapshot";
  delivered_at: string;
  delivery_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface PaperTradingComparisonTickAcknowledgementRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_tick_acknowledgement";
  paper_trading_comparison_tick_acknowledgement_id: string;
  delivery_ref: Ref;
  delivery_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  tick_ref: Ref;
  tick_digest: string;
  tick_sequence: number;
  provider_request_count_at_acknowledgement: number;
  endpoint: "POST /comparison/tick/ack";
  acknowledged_at: string;
  acknowledgement_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export type PaperTradingComparisonTickIOOperation =
  | "deliver_market_snapshot"
  | "acknowledge_tick";

export interface PaperTradingComparisonTickIOWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  tick_ref: Ref;
  tick_digest: string;
  operation: PaperTradingComparisonTickIOOperation;
}

export interface PaperTradingComparisonTickCaptureWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  previous_checkpoint_attempt_ref: Ref;
  previous_checkpoint_attempt_digest: string;
  previous_checkpoint_outcome_ref: Ref;
  previous_checkpoint_outcome_digest: string;
  operation: "capture_next_tick";
}

export interface PaperTradingComparisonActivationSide {
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_ref: Ref;
}

export interface PaperTradingComparisonActivationPolicy {
  policy_version: "paper-comparison-activation-v1";
  maximum_start_skew_ms: number;
  maximum_retry_count_per_side: number;
  maximum_provider_request_count_per_side: number;
  maximum_activation_elapsed_ms: 60_000;
  cleanup_timeout_ms: 10_000;
  require_both_running_before_observation: true;
  partial_start_policy: "stop_started_side_before_retry";
  restart_policy: "recover_both_or_stop_both";
  market_view_policy: "first_tick_then_contiguous_persisted_ticks";
}

export interface PaperTradingComparisonActivationRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation";
  paper_trading_comparison_activation_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  first_tick_ref: Ref;
  first_tick_digest: string;
  champion: PaperTradingComparisonActivationSide;
  challenger: PaperTradingComparisonActivationSide;
  market_data_configuration_digest: string;
  activation_policy: PaperTradingComparisonActivationPolicy;
  activation_scope: "qualification_pair";
  activation_status: "authorized";
  authorized_at: string;
  activation_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  private_exchange_access: "forbidden";
  credentials_access: "forbidden";
  authority_status: "not_live";
}

export interface PaperTradingComparisonActivationAttemptRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_attempt";
  paper_trading_comparison_activation_attempt_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  first_tick_ref: Ref;
  first_tick_digest: string;
  champion: PaperTradingComparisonActivationSide;
  challenger: PaperTradingComparisonActivationSide;
  activation_policy: PaperTradingComparisonActivationPolicy;
  attempt_sequence: number;
  retry_index: number;
  start_mode: "parallel";
  attempt_status: "starting";
  attempted_at: string;
  start_deadline_at: string;
  attempt_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export type PaperTradingComparisonActivationSideResultReason =
  | "symmetric_start"
  | "partial_start_cleanup"
  | "policy_cleanup"
  | "restart_cleanup"
  | "handoff_cleanup";

export type PaperTradingComparisonActivationSideResultOutcome =
  | "succeeded"
  | "failed"
  | "timed_out"
  | "not_running";

export interface PaperTradingComparisonActivationSideResultRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_side_result";
  paper_trading_comparison_activation_side_result_id: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  role: "champion" | "challenger";
  operation_sequence: number;
  operation: "start" | "stop";
  reason: PaperTradingComparisonActivationSideResultReason;
  outcome: PaperTradingComparisonActivationSideResultOutcome;
  trading_run_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  sandbox_ref?: Ref;
  runtime_lifecycle_status: TradingRunLifecycleStatus | "unknown";
  evaluation_status: PaperTradingEvaluationStatus | "unknown";
  provider_request_count: number;
  effect_started_at: string;
  effect_completed_at: string;
  stable_error_code?: string;
  side_result_digest: string;
  authority_status: "not_live";
}

export type PaperTradingComparisonActivationOutcomeStatus =
  | "both_running"
  | "stopped_cleanly"
  | "cleanup_required";

export type PaperTradingComparisonActivationOutcomeReason =
  | "started_within_policy"
  | "start_failed"
  | "start_timed_out"
  | "start_skew_exceeded"
  | "activation_elapsed_exceeded"
  | "provider_request_budget_exceeded"
  | "side_result_persistence_failed"
  | "cleanup_failed"
  | "restart_cleanup"
  | "handoff_cleanup";

export type PaperTradingComparisonActivationNextAction =
  | "capture_first_paired_checkpoint"
  | "retry_activation"
  | "recover_cleanup"
  | "checkpoint_handoff_complete";

export interface PaperTradingComparisonActivationOutcomeRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_activation_outcome";
  paper_trading_comparison_activation_outcome_id: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  outcome_sequence: number;
  previous_outcome_ref?: Ref;
  outcome_status: PaperTradingComparisonActivationOutcomeStatus;
  outcome_reason: PaperTradingComparisonActivationOutcomeReason;
  champion_latest_result_ref?: Ref;
  challenger_latest_result_ref?: Ref;
  next_action: PaperTradingComparisonActivationNextAction;
  completed_at: string;
  outcome_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface PaperTradingComparisonRuntimeWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  role: "champion" | "challenger";
  operation: "start" | "stop";
}

export interface PaperTradingComparisonCheckpointAttemptSide {
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  evaluation_record_digest: string;
  observation_chain_digest: string;
  provider_request_count_before: number;
}

export interface PaperTradingComparisonCheckpointAttemptRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_checkpoint_attempt";
  paper_trading_comparison_checkpoint_attempt_id: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  activation_outcome_ref: Ref;
  activation_outcome_digest: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  tick_ref: Ref;
  tick_digest: string;
  checkpoint_sequence: number;
  previous_checkpoint_outcome_ref?: Ref;
  previous_checkpoint_outcome_digest?: string;
  champion: PaperTradingComparisonCheckpointAttemptSide;
  challenger: PaperTradingComparisonCheckpointAttemptSide;
  attempted_at: string;
  checkpoint_deadline_at: string;
  attempt_status: "preparing";
  attempt_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface PaperTradingComparisonCheckpointSideEvidence {
  role: "champion" | "challenger";
  observation_ref: Ref;
  observation_record_digest: string;
  evaluation_record_digest: string;
  ledger_chain_refs: Ref[];
  observation_status: PaperTradingObservationStatus;
  consumed_event_count: number;
  provider_request_count_after: number;
  tick_acknowledgement_ref?: Ref;
  tick_acknowledgement_digest?: string;
}

export type PaperTradingComparisonCheckpointOutcomeStatus = "paired" | "incomplete";

export type PaperTradingComparisonCheckpointOutcomeReason =
  | "paired_checkpoint_recorded"
  | "side_preparation_failed"
  | "side_preparation_timed_out"
  | "provider_request_budget_exceeded"
  | "checkpoint_deadline_exceeded"
  | "paired_persistence_failed"
  | "restart_cleanup";

export type PaperTradingComparisonCheckpointNextAction =
  | "serve_and_acknowledge_current_tick"
  | "capture_next_tick"
  | "close_failed_comparison"
  | "recover_cleanup";

export interface PaperTradingComparisonCheckpointOutcomeRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_checkpoint_outcome";
  paper_trading_comparison_checkpoint_outcome_id: string;
  checkpoint_attempt_ref: Ref;
  checkpoint_attempt_digest: string;
  tick_ref: Ref;
  tick_digest: string;
  checkpoint_sequence: number;
  outcome_status: PaperTradingComparisonCheckpointOutcomeStatus;
  outcome_reason: PaperTradingComparisonCheckpointOutcomeReason;
  champion?: PaperTradingComparisonCheckpointSideEvidence;
  challenger?: PaperTradingComparisonCheckpointSideEvidence;
  stable_error_code?: string;
  next_action: PaperTradingComparisonCheckpointNextAction;
  completed_at: string;
  outcome_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface PaperTradingComparisonCheckpointWriteContext {
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  activation_outcome_ref: Ref;
  activation_outcome_digest: string;
  checkpoint_attempt_ref: Ref;
  checkpoint_attempt_digest: string;
  role: "champion" | "challenger";
  operation:
    | "advance_tick_view"
    | "refresh_sandbox_evidence"
    | "commit_paired_checkpoint";
}

export function paperTradingComparisonRuntimeControlIdempotencyKey(
  context: PaperTradingComparisonRuntimeWriteContext
): string {
  return [
    "paper-comparison-run-control",
    context.paper_trading_comparison_activation_attempt_ref.id,
    context.role,
    context.operation
  ].join(":");
}

export interface PaperTradingQualificationPolicy {
  minObservationCount: number;
  minElapsedMs: number;
  maxFailedObservationRatio: number;
  assessRunnerHealth: boolean;
}

export interface PaperTradingQualificationEvidenceInput {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
  commitmentDigestVerified: boolean;
}

export interface PaperTradingQualificationDecisionInput
  extends PaperTradingQualificationEvidenceInput {
  runnerActive: boolean;
  policy?: Partial<PaperTradingQualificationPolicy>;
}

export interface PaperTradingQualificationResult {
  qualification_status: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  evidence_window: PaperTradingEvidenceWindowReadModel;
}

export type PaperTradingComparisonQualificationStatus =
  | "qualified"
  | "not_qualified";

export type PaperTradingComparisonQualificationReason =
  | "comparison_window_not_stopped_cleanly"
  | "comparison_window_not_completed_normally"
  | "comparison_checkpoint_incomplete"
  | "comparison_minimum_observation_count_not_met"
  | "comparison_minimum_elapsed_not_met"
  | "champion_not_qualified"
  | "challenger_not_qualified"
  | "champion_ledger_incomplete"
  | "challenger_ledger_incomplete"
  | "champion_ledger_lineage_mismatch"
  | "challenger_ledger_lineage_mismatch";

export interface PaperTradingComparisonQualificationResult {
  comparison_id: string;
  activation_id: string;
  activation_attempt_id: string;
  qualification_status: PaperTradingComparisonQualificationStatus;
  qualification_reasons: PaperTradingComparisonQualificationReason[];
  checkpoint_count: number;
  champion: PaperTradingQualificationResult;
  challenger: PaperTradingQualificationResult;
  authority_status: "not_verdict";
}

export type PaperTradingComparisonVerdictOutcome =
  | "challenger_improved"
  | "challenger_not_improved"
  | "comparison_ineligible";

export interface PaperTradingComparisonVerdictSide {
  role: "champion" | "challenger";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref: Ref;
  paper_trading_evaluation_commitment_record_digest: string;
  paper_trading_evaluation_ref: Ref;
  paper_trading_evaluation_record_digest: string;
  paper_trading_observation_chain_digest: string;
  net_revenue_usdt?: number;
  cost_usdt?: number;
}

export interface PaperTradingComparisonVerdictMetric {
  metric_kind: "net_revenue_usdt";
  champion_value_usdt: number;
  challenger_value_usdt: number;
  observed_lift_usdt: number;
  minimum_lift_usdt: number;
}

export interface PaperTradingComparisonVerdictRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_verdict";
  paper_trading_comparison_verdict_id: string;
  paper_trading_comparison_commitment_ref: Ref;
  paper_trading_comparison_commitment_digest: string;
  paper_trading_comparison_activation_ref: Ref;
  paper_trading_comparison_activation_digest: string;
  paper_trading_comparison_activation_attempt_ref: Ref;
  paper_trading_comparison_activation_attempt_digest: string;
  final_activation_outcome_ref: Ref;
  final_activation_outcome_digest: string;
  latest_tick_ref: Ref;
  latest_tick_digest: string;
  checkpoint_outcome_refs: Ref[];
  checkpoint_outcome_digests: string[];
  pair_qualification: PaperTradingComparisonQualificationResult;
  pair_qualification_digest: string;
  champion: PaperTradingComparisonVerdictSide;
  challenger: PaperTradingComparisonVerdictSide;
  metric?: PaperTradingComparisonVerdictMetric;
  verdict_outcome: PaperTradingComparisonVerdictOutcome;
  window_started_at: string;
  window_ended_at: string;
  evaluator_policy_version: "paper-comparison-verdict-v1";
  evaluation_authority: "external_to_trading_systems";
  confirmation_disposition: "requires_precommitted_campaign" | "not_applicable";
  promotion_eligibility: "not_eligible";
  release_status: "sealed";
  next_action:
    | "precommit_confirmation_campaign"
    | "return_to_candidate_arena"
    | "repair_evidence_or_rerun_comparison";
  evaluated_at: string;
  verdict_digest: string;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface PaperTradingComparisonConfirmationSlot {
  slot_index: number;
  comparison_idempotency_key: string;
  paper_trading_comparison_preparation_id: string;
  paper_trading_comparison_commitment_id: string;
}

export interface PaperTradingComparisonConfirmationCampaignPolicy {
  policy_version: "paper-comparison-confirmation-v1";
  required_window_count: number;
  decision_rule: "all_reserved_windows_must_improve";
  slot_order_policy: "strict_sequence";
  non_overlap_policy: "strict";
  maximum_slot_start_delay_ms: number;
  missed_slot_policy: "campaign_not_confirmed";
}

export interface PaperTradingComparisonConfirmationCampaignRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_confirmation_campaign";
  paper_trading_comparison_confirmation_campaign_id: string;
  source_verdict_ref: Ref;
  source_verdict_digest: string;
  source_comparison_ref: Ref;
  source_comparison_digest: string;
  champion: PaperTradingComparisonCandidateSide;
  challenger: PaperTradingComparisonCandidateSide;
  champion_selection: PaperTradingComparisonChampionSelection;
  comparison_policy: PaperTradingComparisonPolicy;
  market_data_configuration_digest: string;
  paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
  campaign_policy: PaperTradingComparisonConfirmationCampaignPolicy;
  slots: PaperTradingComparisonConfirmationSlot[];
  committed_at: string;
  campaign_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_eligibility: "not_eligible";
  release_status: "sealed";
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export type PaperTradingComparisonConfirmationSlotResultStatus =
  | "challenger_improved"
  | "challenger_not_improved"
  | "comparison_ineligible"
  | "slot_expired";

export interface PaperTradingComparisonConfirmationSlotResult {
  slot_index: number;
  paper_trading_comparison_commitment_ref: Ref;
  status: PaperTradingComparisonConfirmationSlotResultStatus;
  verdict_ref?: Ref;
  verdict_digest?: string;
  window_started_at?: string;
  window_ended_at?: string;
}

export interface PaperTradingComparisonConfirmationCampaignOutcomeRecord
  extends BaseRecord {
  record_kind: "paper_trading_comparison_confirmation_campaign_outcome";
  paper_trading_comparison_confirmation_campaign_outcome_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  slot_results: PaperTradingComparisonConfirmationSlotResult[];
  improved_count: number;
  not_improved_count: number;
  ineligible_count: number;
  expired_count: number;
  campaign_outcome: "confirmed_improvement" | "not_confirmed";
  decision_rule: "all_reserved_windows_must_improve";
  promotion_eligibility: "eligible" | "not_eligible";
  release_status: "sealed";
  next_action: "review_for_trading_promotion" | "return_to_candidate_arena";
  evaluated_at: string;
  outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "not_live";
}

export type PaperTradingComparisonResearchReleaseKind =
  | "confirmed_improvement"
  | "challenger_not_reproduced"
  | "comparison_evidence_ineligible"
  | "campaign_slot_expired";

export interface PaperTradingComparisonResearchReleaseRecord extends BaseRecord {
  record_kind: "paper_trading_comparison_research_release";
  paper_trading_comparison_research_release_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  source_finding_ref: Ref;
  source_finding_record_digest: string;
  source_lineage_ref: Ref;
  source_lineage_record_digest: string;
  direction_kind: ResearchDirectionKind;
  release_kind: PaperTradingComparisonResearchReleaseKind;
  finding: ResearchFindingRecord;
  finding_record_digest: string;
  lineage: ArtifactLineageRecord;
  lineage_record_digest: string;
  next_research_focus: string;
  released_at: string;
  release_digest: string;
  research_visibility: "released_to_research";
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  live_exchange_authority: false;
  order_submission_authority: false;
  authority_status: "lineage_only";
}

export function paperTradingEvaluationCommitmentDigestInput(
  record: PaperTradingEvaluationCommitmentRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    paper_trading_evaluation_commitment_id: _id,
    committed_at: _committedAt,
    commitment_digest: _commitmentDigest,
    ...payload
  } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}

function canonicalPaperTradingCommitmentJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("paper_trading_commitment_non_canonical_value");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalPaperTradingCommitmentJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => {
      if (item === undefined) {
        throw new Error("paper_trading_commitment_non_canonical_value");
      }
      return `${JSON.stringify(key)}:${canonicalPaperTradingCommitmentJson(item)}`;
    }).join(",")}}`;
  }
  throw new Error("paper_trading_commitment_non_canonical_value");
}

export function paperTradingComparisonPersistedRecordDigestInput(value: unknown): string {
  return canonicalPaperTradingComparisonPersistedRecordJson(value, new Set<object>());
}

function canonicalPaperTradingComparisonPersistedRecordJson(
  value: unknown,
  ancestors: Set<object>
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (Number.isFinite(value)) return JSON.stringify(value);
    throw comparisonNonPersistable();
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw comparisonNonPersistable();
    ancestors.add(value);
    try {
      return `[${Array.from({ length: value.length }, (_, index) => {
        if (!Object.hasOwn(value, index) || value[index] === undefined) {
          throw comparisonNonPersistable();
        }
        return canonicalPaperTradingComparisonPersistedRecordJson(value[index], ancestors);
      }).join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }
  if (value && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null ||
      ancestors.has(value) || Reflect.ownKeys(value).some((key) => typeof key === "symbol")) {
      throw comparisonNonPersistable();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some((descriptor) => !descriptor.enumerable || !("value" in descriptor))) {
      throw comparisonNonPersistable();
    }
    ancestors.add(value);
    try {
      return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => `${JSON.stringify(key)}:${canonicalPaperTradingComparisonPersistedRecordJson(item, ancestors)}`)
        .join(",")}}`;
    } finally {
      ancestors.delete(value);
    }
  }
  throw comparisonNonPersistable();
}

function comparisonNonPersistable(): Error {
  return new Error("paper_trading_comparison_non_persistable_record");
}

export const paperTradingComparisonCandidateVersionDigestInput = (
  record: CandidateVersionRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);
export const paperTradingComparisonSystemCodeRecordDigestInput = (
  record: SystemCodeRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);
export const paperTradingComparisonAdmissionDecisionDigestInput = (
  record: CandidateAdmissionDecisionRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);
export const paperTradingComparisonTradingPromotionDigestInput = (
  record: TradingPromotionRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);
export const paperTradingComparisonEvaluationCommitmentRecordDigestInput = (
  record: PaperTradingEvaluationCommitmentRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);
export const paperTradingComparisonEvaluationRecordDigestInput = (
  record: PaperTradingEvaluationRecord
): string => paperTradingComparisonPersistedRecordDigestInput(record);

export function paperTradingComparisonObservationChainDigestInput(
  records: readonly PaperTradingObservationRecord[]
): string {
  return paperTradingComparisonPersistedRecordDigestInput([...records].sort((left, right) =>
    left.sequence - right.sequence ||
    left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)));
}

export function paperTradingComparisonCandidateVersionPairKey(leftId: string, rightId: string): string {
  return canonicalPaperTradingCommitmentJson(leftId <= rightId ? [leftId, rightId] : [rightId, leftId]);
}

export function paperTradingComparisonPreparationDigestInput(
  record: PaperTradingComparisonPreparationRecord
): string {
  const { record_kind: _kind, version: _version, paper_trading_comparison_preparation_id: _id,
    preparation_digest: _digest, ...payload } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}

export function paperTradingComparisonCommitmentDigestInput(
  record: PaperTradingComparisonCommitmentRecord
): string {
  const { record_kind: _kind, version: _version, paper_trading_comparison_commitment_id: _id,
    committed_at: _committedAt, commitment_digest: _digest, ...payload } = record;
  return canonicalPaperTradingCommitmentJson(payload);
}

export function paperTradingComparisonTickDigestInput(
  record: PaperTradingComparisonTickRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_tick_id: _id,
    tick_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonTickDeliveryDigestInput(
  record: PaperTradingComparisonTickDeliveryRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_tick_delivery_id: _id,
    delivery_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonTickAcknowledgementDigestInput(
  record: PaperTradingComparisonTickAcknowledgementRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_tick_acknowledgement_id: _id,
    acknowledgement_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonActivationPolicyFor(
  comparisonPolicy: PaperTradingComparisonPolicy
): PaperTradingComparisonActivationPolicy {
  return {
    policy_version: "paper-comparison-activation-v1",
    maximum_start_skew_ms: comparisonPolicy.maximum_start_skew_ms,
    maximum_retry_count_per_side: comparisonPolicy.maximum_retry_count_per_side,
    maximum_provider_request_count_per_side:
      comparisonPolicy.maximum_provider_request_count_per_side,
    maximum_activation_elapsed_ms: 60_000,
    cleanup_timeout_ms: 10_000,
    require_both_running_before_observation: true,
    partial_start_policy: "stop_started_side_before_retry",
    restart_policy: "recover_both_or_stop_both",
    market_view_policy: "first_tick_then_contiguous_persisted_ticks"
  };
}

export function paperTradingComparisonActivationDigestInput(
  record: PaperTradingComparisonActivationRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_activation_id: _id,
    authorized_at: _authorizedAt,
    activation_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonActivationAttemptDigestInput(
  record: PaperTradingComparisonActivationAttemptRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_activation_attempt_id: _id,
    attempt_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonActivationSideResultDigestInput(
  record: PaperTradingComparisonActivationSideResultRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_activation_side_result_id: _id,
    side_result_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonActivationOutcomeDigestInput(
  record: PaperTradingComparisonActivationOutcomeRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_activation_outcome_id: _id,
    outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonCheckpointAttemptDigestInput(
  record: PaperTradingComparisonCheckpointAttemptRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_checkpoint_attempt_id: _id,
    attempt_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonCheckpointOutcomeDigestInput(
  record: PaperTradingComparisonCheckpointOutcomeRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_checkpoint_outcome_id: _id,
    outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonQualificationResultDigestInput(
  result: PaperTradingComparisonQualificationResult
): string {
  return paperTradingComparisonPersistedRecordDigestInput(result);
}

export function paperTradingComparisonVerdictDigestInput(
  record: PaperTradingComparisonVerdictRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_verdict_id: _id,
    verdict_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonConfirmationCampaignDigestInput(
  record: PaperTradingComparisonConfirmationCampaignRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_confirmation_campaign_id: _id,
    campaign_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonConfirmationCampaignOutcomeDigestInput(
  record: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): string {
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_confirmation_campaign_outcome_id: _id,
    outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function paperTradingComparisonResearchReleaseDigestInput(
  record: PaperTradingComparisonResearchReleaseRecord
): string {
  if (!paperTradingComparisonResearchReleaseHasRuntimeShape(record)) {
    throw comparisonNonPersistable();
  }
  const {
    record_kind: _kind,
    version: _version,
    paper_trading_comparison_research_release_id: _id,
    release_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export const PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT: PaperTradingAccountSnapshot = {
  wallet_balance_usdt: "10000", available_balance_usdt: "10000", equity_usdt: "10000",
  realized_pnl_usdt: "0", unrealized_pnl_usdt: "0", fee_paid_usdt: "0",
  slippage_paid_usdt: "0", funding_paid_usdt: "0", margin_reserved_usdt: "0",
  position: { symbol: "BTCUSDT", quantity: "0", side: "flat", mark_price: "0", notional_usdt: "0" },
  open_order_count: 0, authority_status: "not_live"
};
export const PAPER_TRADING_COMPARISON_ZERO_SCORE: TradingProfitLossReadModel = {
  revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0
};

export function paperTradingComparisonRefsEqual(left: unknown, right: unknown): boolean {
  return comparisonRef(left) && comparisonRef(right) && left.record_kind === right.record_kind && left.id === right.id;
}

function comparisonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function comparisonHasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}
function comparisonString(value: unknown): value is string { return typeof value === "string" && value.length > 0; }
function comparisonRef(value: unknown, kind?: string): value is Ref {
  return comparisonObject(value) && comparisonString(value.record_kind) && comparisonString(value.id) &&
    (kind === undefined || value.record_kind === kind);
}
function comparisonIso(value: unknown): value is string {
  return comparisonString(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}
function comparisonPositive(value: unknown): value is number { return Number.isInteger(value) && Number(value) > 0; }
function comparisonNonNegative(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function comparisonFinite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function comparisonPositiveFinite(value: unknown): value is number {
  return comparisonFinite(value) && value > 0;
}
function comparisonNonNegativeFinite(value: unknown): value is number {
  return comparisonFinite(value) && value >= 0;
}
function comparisonDigest(value: unknown): value is string { return comparisonString(value); }
function comparisonPolicyIdentity(value: unknown): boolean {
  return comparisonObject(value) && ["market_data_policy_version", "gateway_policy_version", "cost_policy_version", "funding_policy_version", "slippage_policy_version", "fill_policy_version", "risk_policy_version", "paper_account_policy_version", "decision_event_protocol_version", "persistent_state_boundary_version"].every((key) => comparisonString(value[key]));
}

const PAPER_TRADING_COMPARISON_QUALIFICATION_REASONS = new Set<string>([
  "comparison_window_not_stopped_cleanly",
  "comparison_window_not_completed_normally",
  "comparison_checkpoint_incomplete",
  "comparison_minimum_observation_count_not_met",
  "comparison_minimum_elapsed_not_met",
  "champion_not_qualified",
  "challenger_not_qualified",
  "champion_ledger_incomplete",
  "challenger_ledger_incomplete",
  "champion_ledger_lineage_mismatch",
  "challenger_ledger_lineage_mismatch"
]);

const PAPER_TRADING_QUALIFICATION_REASONS = new Set<string>([
  "min_observation_count_not_met",
  "min_elapsed_ms_not_met",
  "runner_inactive_for_running_evaluation",
  "paper_observation_chain_incomplete",
  "paper_score_account_mismatch",
  "failed_observation_ratio_exceeded",
  "latest_market_snapshot_missing",
  "fill_public_execution_evidence_missing",
  "paper_evaluation_failed",
  "evidence_purpose_not_qualification",
  "provider_identity_not_qualification_eligible",
  "paper_evaluation_commitment_missing",
  "paper_evaluation_invalidated"
]);

function paperTradingQualificationResultHasRuntimeShape(
  value: unknown
): value is PaperTradingQualificationResult {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "qualification_status",
    "qualification_reasons",
    "evidence_window"
  ]) || ![
    "collecting_evidence",
    "qualified",
    "needs_resume",
    "blocked_by_quality",
    "paper_failed",
    "not_qualification_evidence"
  ].includes(value.qualification_status as string) ||
    !Array.isArray(value.qualification_reasons) ||
    value.qualification_reasons.some((reason) =>
      !PAPER_TRADING_QUALIFICATION_REASONS.has(reason as string)) ||
    new Set(value.qualification_reasons).size !== value.qualification_reasons.length ||
    !comparisonObject(value.evidence_window)) return false;
  const evidence = value.evidence_window;
  const evidenceKeys = [
    "observation_count",
    "elapsed_ms",
    "failed_observation_count",
    ...(evidence.first_observed_at !== undefined ? ["first_observed_at"] : []),
    ...(evidence.last_observed_at !== undefined ? ["last_observed_at"] : [])
  ];
  if (!comparisonHasExactKeys(evidence, evidenceKeys) ||
    !comparisonNonNegative(evidence.observation_count) ||
    !comparisonNonNegative(evidence.elapsed_ms) ||
    !comparisonNonNegative(evidence.failed_observation_count) ||
    Number(evidence.failed_observation_count) > Number(evidence.observation_count) ||
    (evidence.first_observed_at !== undefined && !comparisonIso(evidence.first_observed_at)) ||
    (evidence.last_observed_at !== undefined && !comparisonIso(evidence.last_observed_at)) ||
    (evidence.first_observed_at !== undefined && evidence.last_observed_at !== undefined &&
      Date.parse(evidence.last_observed_at as string) <
        Date.parse(evidence.first_observed_at as string))) return false;
  return value.qualification_status === "qualified"
    ? value.qualification_reasons.length === 0
    : value.qualification_reasons.length > 0;
}

export function paperTradingComparisonQualificationResultHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonQualificationResult {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "comparison_id",
    "activation_id",
    "activation_attempt_id",
    "qualification_status",
    "qualification_reasons",
    "checkpoint_count",
    "champion",
    "challenger",
    "authority_status"
  ]) || !comparisonString(value.comparison_id) ||
    !comparisonString(value.activation_id) ||
    !comparisonString(value.activation_attempt_id) ||
    (value.qualification_status !== "qualified" &&
      value.qualification_status !== "not_qualified") ||
    !Array.isArray(value.qualification_reasons) ||
    value.qualification_reasons.some((reason) =>
      !PAPER_TRADING_COMPARISON_QUALIFICATION_REASONS.has(reason as string)) ||
    new Set(value.qualification_reasons).size !== value.qualification_reasons.length ||
    !comparisonNonNegative(value.checkpoint_count) ||
    !paperTradingQualificationResultHasRuntimeShape(value.champion) ||
    !paperTradingQualificationResultHasRuntimeShape(value.challenger) ||
    value.authority_status !== "not_verdict") return false;
  return value.qualification_status === "qualified"
    ? value.qualification_reasons.length === 0 &&
      value.champion.qualification_status === "qualified" &&
      value.challenger.qualification_status === "qualified"
    : value.qualification_reasons.length > 0;
}

function paperTradingComparisonVerdictSideHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger",
  scored: boolean
): value is PaperTradingComparisonVerdictSide {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "role",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "trading_run_ref",
    "paper_trading_evaluation_commitment_ref",
    "paper_trading_evaluation_commitment_record_digest",
    "paper_trading_evaluation_ref",
    "paper_trading_evaluation_record_digest",
    "paper_trading_observation_chain_digest",
    ...(scored ? ["net_revenue_usdt", "cost_usdt"] : [])
  ]) || value.role !== role ||
    !comparisonRef(value.candidate_ref, "trading_system_candidate") ||
    !comparisonRef(value.candidate_version_ref, "candidate_version") ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !comparisonDigest(value.system_code_artifact_digest) ||
    !comparisonRef(value.trading_run_ref, "trading_run") ||
    !comparisonRef(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) || !comparisonDigest(value.paper_trading_evaluation_commitment_record_digest) ||
    !comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") ||
    !comparisonDigest(value.paper_trading_evaluation_record_digest) ||
    !comparisonDigest(value.paper_trading_observation_chain_digest)) return false;
  return !scored || comparisonFinite(value.net_revenue_usdt) &&
    comparisonNonNegativeFinite(value.cost_usdt);
}

function comparisonRound6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function paperTradingComparisonVerdictHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonVerdictRecord {
  if (!comparisonObject(value) ||
    !paperTradingComparisonQualificationResultHasRuntimeShape(value.pair_qualification)) {
    return false;
  }
  const scored = value.pair_qualification.qualification_status === "qualified";
  if (!comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "paper_trading_comparison_verdict_id",
    "paper_trading_comparison_commitment_ref",
    "paper_trading_comparison_commitment_digest",
    "paper_trading_comparison_activation_ref",
    "paper_trading_comparison_activation_digest",
    "paper_trading_comparison_activation_attempt_ref",
    "paper_trading_comparison_activation_attempt_digest",
    "final_activation_outcome_ref",
    "final_activation_outcome_digest",
    "latest_tick_ref",
    "latest_tick_digest",
    "checkpoint_outcome_refs",
    "checkpoint_outcome_digests",
    "pair_qualification",
    "pair_qualification_digest",
    "champion",
    "challenger",
    ...(scored ? ["metric"] : []),
    "verdict_outcome",
    "window_started_at",
    "window_ended_at",
    "evaluator_policy_version",
    "evaluation_authority",
    "confirmation_disposition",
    "promotion_eligibility",
    "release_status",
    "next_action",
    "evaluated_at",
    "verdict_digest",
    "live_exchange_authority",
    "order_submission_authority",
    "authority_status"
  ]) || value.record_kind !== "paper_trading_comparison_verdict" || value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_verdict_id) ||
    !comparisonRef(
      value.paper_trading_comparison_commitment_ref,
      "paper_trading_comparison_commitment"
    ) || !comparisonDigest(value.paper_trading_comparison_commitment_digest) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) || !comparisonDigest(value.paper_trading_comparison_activation_digest) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) || !comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) ||
    !comparisonRef(
      value.final_activation_outcome_ref,
      "paper_trading_comparison_activation_outcome"
    ) || !comparisonDigest(value.final_activation_outcome_digest) ||
    !comparisonRef(value.latest_tick_ref, "paper_trading_comparison_tick") ||
    !comparisonDigest(value.latest_tick_digest) ||
    !Array.isArray(value.checkpoint_outcome_refs) ||
    !Array.isArray(value.checkpoint_outcome_digests) ||
    value.checkpoint_outcome_refs.length !== value.checkpoint_outcome_digests.length ||
    value.checkpoint_outcome_refs.some((item) =>
      !comparisonRef(item, "paper_trading_comparison_checkpoint_outcome")) ||
    value.checkpoint_outcome_digests.some((item) => !comparisonDigest(item)) ||
    new Set(value.checkpoint_outcome_refs.map((item) => item.id)).size !==
      value.checkpoint_outcome_refs.length ||
    new Set(value.checkpoint_outcome_digests).size !==
      value.checkpoint_outcome_digests.length ||
    !comparisonDigest(value.pair_qualification_digest) ||
    value.pair_qualification.comparison_id !==
      value.paper_trading_comparison_commitment_ref.id ||
    value.pair_qualification.activation_id !==
      value.paper_trading_comparison_activation_ref.id ||
    value.pair_qualification.activation_attempt_id !==
      value.paper_trading_comparison_activation_attempt_ref.id ||
    !paperTradingComparisonVerdictSideHasRuntimeShape(value.champion, "champion", scored) ||
    !paperTradingComparisonVerdictSideHasRuntimeShape(value.challenger, "challenger", scored) ||
    value.champion.candidate_version_ref.id === value.challenger.candidate_version_ref.id ||
    value.champion.trading_run_ref.id === value.challenger.trading_run_ref.id ||
    !comparisonIso(value.window_started_at) || !comparisonIso(value.window_ended_at) ||
    Date.parse(value.window_ended_at as string) < Date.parse(value.window_started_at as string) ||
    !comparisonIso(value.evaluated_at) ||
    Date.parse(value.evaluated_at as string) < Date.parse(value.window_ended_at as string) ||
    value.evaluator_policy_version !== "paper-comparison-verdict-v1" ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_eligibility !== "not_eligible" ||
    value.release_status !== "sealed" ||
    !comparisonDigest(value.verdict_digest) ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false ||
    value.authority_status !== "not_live") return false;

  if (!scored) {
    return value.verdict_outcome === "comparison_ineligible" &&
      value.metric === undefined &&
      value.confirmation_disposition === "not_applicable" &&
      value.next_action === "repair_evidence_or_rerun_comparison";
  }
  if (!comparisonObject(value.metric) || !comparisonHasExactKeys(value.metric, [
    "metric_kind",
    "champion_value_usdt",
    "challenger_value_usdt",
    "observed_lift_usdt",
    "minimum_lift_usdt"
  ]) || value.metric.metric_kind !== "net_revenue_usdt" ||
    !comparisonFinite(value.metric.champion_value_usdt) ||
    !comparisonFinite(value.metric.challenger_value_usdt) ||
    !comparisonFinite(value.metric.observed_lift_usdt) ||
    !comparisonNonNegativeFinite(value.metric.minimum_lift_usdt) ||
    value.metric.champion_value_usdt !== value.champion.net_revenue_usdt ||
    value.metric.challenger_value_usdt !== value.challenger.net_revenue_usdt ||
    value.metric.observed_lift_usdt !== comparisonRound6(
      Number(value.metric.challenger_value_usdt) -
        Number(value.metric.champion_value_usdt)
    )) return false;
  const improved = Number(value.metric.observed_lift_usdt) > 0 &&
    Number(value.metric.observed_lift_usdt) >= Number(value.metric.minimum_lift_usdt);
  return improved
    ? value.verdict_outcome === "challenger_improved" &&
      value.confirmation_disposition === "requires_precommitted_campaign" &&
      value.next_action === "precommit_confirmation_campaign"
    : value.verdict_outcome === "challenger_not_improved" &&
      value.confirmation_disposition === "not_applicable" &&
      value.next_action === "return_to_candidate_arena";
}

function paperTradingComparisonConfirmationCampaignPolicyHasRuntimeShape(
  value: unknown,
  comparisonPolicy: PaperTradingComparisonPolicy
): value is PaperTradingComparisonConfirmationCampaignPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "required_window_count",
    "decision_rule",
    "slot_order_policy",
    "non_overlap_policy",
    "maximum_slot_start_delay_ms",
    "missed_slot_policy"
  ]) && value.policy_version === "paper-comparison-confirmation-v1" &&
    comparisonPositive(value.required_window_count) &&
    value.required_window_count === comparisonPolicy.required_confirmation_count &&
    value.decision_rule === "all_reserved_windows_must_improve" &&
    value.slot_order_policy === "strict_sequence" &&
    value.non_overlap_policy === "strict" &&
    comparisonPositive(value.maximum_slot_start_delay_ms) &&
    value.maximum_slot_start_delay_ms === comparisonPolicy.maximum_elapsed_ms &&
    value.missed_slot_policy === "campaign_not_confirmed";
}

function paperTradingComparisonConfirmationSlotHasRuntimeShape(
  value: unknown,
  campaignId: string,
  slotIndex: number
): value is PaperTradingComparisonConfirmationSlot {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "slot_index",
    "comparison_idempotency_key",
    "paper_trading_comparison_preparation_id",
    "paper_trading_comparison_commitment_id"
  ])) return false;
  return value.slot_index === slotIndex &&
    value.comparison_idempotency_key ===
      `paper-comparison-confirmation:${campaignId}:slot:${slotIndex}` &&
    typeof value.paper_trading_comparison_preparation_id === "string" &&
    /^paper-trading-comparison-preparation-[a-f0-9]{16}$/.test(
      value.paper_trading_comparison_preparation_id
    ) && typeof value.paper_trading_comparison_commitment_id === "string" &&
    /^paper-trading-comparison-[a-f0-9]{16}$/.test(
      value.paper_trading_comparison_commitment_id
    );
}

export function paperTradingComparisonConfirmationCampaignHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonConfirmationCampaignRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "paper_trading_comparison_confirmation_campaign_id",
    "source_verdict_ref",
    "source_verdict_digest",
    "source_comparison_ref",
    "source_comparison_digest",
    "champion",
    "challenger",
    "champion_selection",
    "comparison_policy",
    "market_data_configuration_digest",
    "paper_policy_identity",
    "campaign_policy",
    "slots",
    "committed_at",
    "campaign_digest",
    "evaluation_authority",
    "promotion_eligibility",
    "release_status",
    "live_exchange_authority",
    "order_submission_authority",
    "authority_status"
  ]) || value.record_kind !== "paper_trading_comparison_confirmation_campaign" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_confirmation_campaign_id) ||
    !comparisonRef(value.source_verdict_ref, "paper_trading_comparison_verdict") ||
    !comparisonDigest(value.source_verdict_digest) ||
    !comparisonRef(
      value.source_comparison_ref,
      "paper_trading_comparison_commitment"
    ) || !comparisonDigest(value.source_comparison_digest) ||
    !paperTradingComparisonCandidateSideHasRuntimeShape(value.champion, "champion") ||
    !paperTradingComparisonCandidateSideHasRuntimeShape(value.challenger, "challenger") ||
    value.champion.candidate_version_ref.id ===
      value.challenger.candidate_version_ref.id ||
    !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy) ||
    !paperTradingComparisonChampionSelectionHasRuntimeShape(
      value.champion_selection,
      value.comparison_policy.comparison_mode
    ) || !comparisonDigest(value.market_data_configuration_digest) ||
    !comparisonPolicyIdentity(value.paper_policy_identity) ||
    !paperTradingComparisonConfirmationCampaignPolicyHasRuntimeShape(
      value.campaign_policy,
      value.comparison_policy
    ) || !Array.isArray(value.slots) ||
    value.slots.length !== value.campaign_policy.required_window_count ||
    !comparisonIso(value.committed_at) || !comparisonDigest(value.campaign_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_eligibility !== "not_eligible" ||
    value.release_status !== "sealed" || value.live_exchange_authority !== false ||
    value.order_submission_authority !== false || value.authority_status !== "not_live") {
    return false;
  }
  const campaign = value as unknown as
    PaperTradingComparisonConfirmationCampaignRecord;
  const slots = campaign.slots;
  if (!slots.every((slot, index) =>
    paperTradingComparisonConfirmationSlotHasRuntimeShape(
      slot,
      campaign.paper_trading_comparison_confirmation_campaign_id,
      index + 1
    )) || slots.some((slot) =>
      slot.paper_trading_comparison_commitment_id === campaign.source_comparison_ref.id)) {
    return false;
  }
  return new Set(slots.map((slot) =>
    slot.paper_trading_comparison_preparation_id)).size === slots.length &&
    new Set(slots.map((slot) =>
      slot.paper_trading_comparison_commitment_id)).size === slots.length;
}

function paperTradingComparisonConfirmationSlotResultHasRuntimeShape(
  value: unknown,
  slotIndex: number
): value is PaperTradingComparisonConfirmationSlotResult {
  if (!comparisonObject(value)) return false;
  const expired = value.status === "slot_expired";
  if (!comparisonHasExactKeys(value, [
    "slot_index",
    "paper_trading_comparison_commitment_ref",
    "status",
    ...(!expired ? [
      "verdict_ref",
      "verdict_digest",
      "window_started_at",
      "window_ended_at"
    ] : [])
  ]) || value.slot_index !== slotIndex || !comparisonRef(
    value.paper_trading_comparison_commitment_ref,
    "paper_trading_comparison_commitment"
  )) return false;
  if (expired) return true;
  return [
    "challenger_improved",
    "challenger_not_improved",
    "comparison_ineligible"
  ].includes(value.status as string) &&
    comparisonRef(value.verdict_ref, "paper_trading_comparison_verdict") &&
    comparisonDigest(value.verdict_digest) &&
    comparisonIso(value.window_started_at) && comparisonIso(value.window_ended_at) &&
    Date.parse(value.window_ended_at) >= Date.parse(value.window_started_at);
}

export function paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "paper_trading_comparison_confirmation_campaign_outcome_id",
    "campaign_ref",
    "campaign_digest",
    "slot_results",
    "improved_count",
    "not_improved_count",
    "ineligible_count",
    "expired_count",
    "campaign_outcome",
    "decision_rule",
    "promotion_eligibility",
    "release_status",
    "next_action",
    "evaluated_at",
    "outcome_digest",
    "evaluation_authority",
    "live_exchange_authority",
    "order_submission_authority",
    "authority_status"
  ]) || value.record_kind !==
      "paper_trading_comparison_confirmation_campaign_outcome" ||
    value.version !== 1 ||
    !comparisonString(
      value.paper_trading_comparison_confirmation_campaign_outcome_id
    ) || !comparisonRef(
      value.campaign_ref,
      "paper_trading_comparison_confirmation_campaign"
    ) || !comparisonDigest(value.campaign_digest) ||
    !Array.isArray(value.slot_results) || value.slot_results.length === 0 ||
    !value.slot_results.every((result, index) =>
      paperTradingComparisonConfirmationSlotResultHasRuntimeShape(
        result,
        index + 1
      )) || !comparisonNonNegative(value.improved_count) ||
    !comparisonNonNegative(value.not_improved_count) ||
    !comparisonNonNegative(value.ineligible_count) ||
    !comparisonNonNegative(value.expired_count) ||
    value.decision_rule !== "all_reserved_windows_must_improve" ||
    value.release_status !== "sealed" || !comparisonIso(value.evaluated_at) ||
    !comparisonDigest(value.outcome_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false || value.authority_status !== "not_live") {
    return false;
  }
  const outcome = value as unknown as
    PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  const results = outcome.slot_results;
  if (new Set(results.map((result) =>
    result.paper_trading_comparison_commitment_ref.id)).size !== results.length ||
    new Set(results.flatMap((result) =>
      result.verdict_ref ? [result.verdict_ref.id] : [])).size !==
      results.filter((result) => result.verdict_ref !== undefined).length) {
    return false;
  }
  let previousWindowEndedAt: string | undefined;
  let expiredSeen = false;
  for (const result of results) {
    if (result.status === "slot_expired") {
      expiredSeen = true;
      continue;
    }
    if (expiredSeen || previousWindowEndedAt !== undefined &&
      Date.parse(result.window_started_at!) <= Date.parse(previousWindowEndedAt)) {
      return false;
    }
    previousWindowEndedAt = result.window_ended_at;
  }
  const improvedCount = results.filter((result) =>
    result.status === "challenger_improved").length;
  const notImprovedCount = results.filter((result) =>
    result.status === "challenger_not_improved").length;
  const ineligibleCount = results.filter((result) =>
    result.status === "comparison_ineligible").length;
  const expiredCount = results.filter((result) =>
    result.status === "slot_expired").length;
  if (outcome.improved_count !== improvedCount ||
    outcome.not_improved_count !== notImprovedCount ||
    outcome.ineligible_count !== ineligibleCount ||
    outcome.expired_count !== expiredCount ||
    improvedCount + notImprovedCount + ineligibleCount + expiredCount !==
      results.length || results.some((result) =>
        result.window_ended_at !== undefined &&
        Date.parse(outcome.evaluated_at) < Date.parse(result.window_ended_at))) {
    return false;
  }
  const confirmed = improvedCount === results.length;
  return confirmed
    ? outcome.campaign_outcome === "confirmed_improvement" &&
      outcome.promotion_eligibility === "eligible" &&
      outcome.next_action === "review_for_trading_promotion"
    : outcome.campaign_outcome === "not_confirmed" &&
      outcome.promotion_eligibility === "not_eligible" &&
      outcome.next_action === "return_to_candidate_arena";
}

const PAPER_TRADING_COMPARISON_RESEARCH_RELEASE_FINDING_KIND = {
  confirmed_improvement: "positive_result",
  challenger_not_reproduced: "negative_result",
  comparison_evidence_ineligible: "failure_analysis",
  campaign_slot_expired: "failure_analysis"
} as const satisfies Record<
  PaperTradingComparisonResearchReleaseKind,
  ResearchFindingKind
>;

const PAPER_TRADING_COMPARISON_RESEARCH_DIRECTION_KINDS = new Set<
  ResearchDirectionKind
>([
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "liquidation_aware_risk",
  "execution_cost_robustness",
  "other"
]);

function paperTradingComparisonReleasedFindingHasRuntimeShape(
  value: unknown,
  release: PaperTradingComparisonResearchReleaseRecord
): value is ResearchFindingRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_finding_id",
    "research_worker_ref",
    "research_direction_ref",
    "experiment_run_ref",
    "trading_evaluation_result_ref",
    "finding_kind",
    "summary",
    "supporting_record_refs",
    "created_at",
    "authority_status"
  ]) || value.record_kind !== "research_finding" || value.version !== 1 ||
    value.research_finding_id !==
      `${release.paper_trading_comparison_research_release_id}-finding` ||
    !comparisonRef(value.research_worker_ref, "research_worker") ||
    !comparisonRef(value.research_direction_ref, "research_direction") ||
    !comparisonRef(value.experiment_run_ref, "experiment_run") ||
    !comparisonRef(
      value.trading_evaluation_result_ref,
      "trading_evaluation_result"
    ) || value.finding_kind !==
      PAPER_TRADING_COMPARISON_RESEARCH_RELEASE_FINDING_KIND[
        release.release_kind
      ] || !comparisonString(value.summary) ||
    !Array.isArray(value.supporting_record_refs) ||
    value.supporting_record_refs.length < 3 ||
    !value.supporting_record_refs.every((ref) => comparisonRef(ref)) ||
    !paperTradingComparisonRefsEqual(
      value.supporting_record_refs[0],
      release.source_finding_ref
    ) || !paperTradingComparisonRefsEqual(
      value.supporting_record_refs[1],
      release.campaign_ref
    ) || !paperTradingComparisonRefsEqual(
      value.supporting_record_refs[2],
      release.campaign_outcome_ref
    ) || !value.supporting_record_refs.slice(3).every((ref) =>
      comparisonRef(ref, "paper_trading_comparison_verdict")) ||
    value.created_at !== release.released_at ||
    value.authority_status !== "research_trace_only") {
    return false;
  }
  const supportingRefs = value.supporting_record_refs as Ref[];
  return new Set(supportingRefs.map((ref) => `${ref.record_kind}:${ref.id}`)).size ===
    supportingRefs.length;
}

function paperTradingComparisonReleasedLineageHasRuntimeShape(
  value: unknown,
  release: PaperTradingComparisonResearchReleaseRecord
): value is ArtifactLineageRecord {
  if (!comparisonObject(value)) return false;
  const keys = [
    "record_kind",
    "version",
    "artifact_lineage_id",
    "child_system_code_ref",
    ...(value.parent_system_code_ref !== undefined
      ? ["parent_system_code_ref"]
      : []),
    "source_finding_refs",
    "created_by_research_worker_ref",
    "created_at",
    "authority_status"
  ];
  if (!comparisonHasExactKeys(value, keys) ||
    value.record_kind !== "artifact_lineage" || value.version !== 1 ||
    value.artifact_lineage_id !==
      `${release.paper_trading_comparison_research_release_id}-lineage` ||
    !paperTradingComparisonRefsEqual(
      value.child_system_code_ref,
      release.system_code_ref
    ) || value.parent_system_code_ref !== undefined &&
      !comparisonRef(value.parent_system_code_ref, "system_code") ||
    !Array.isArray(value.source_finding_refs) ||
    value.source_finding_refs.length < 2 ||
    !value.source_finding_refs.every((ref) =>
      comparisonRef(ref, "research_finding")) ||
    !comparisonRef(value.created_by_research_worker_ref, "research_worker") ||
    !paperTradingComparisonRefsEqual(
      value.created_by_research_worker_ref,
      release.finding.research_worker_ref
    ) || value.created_at !== release.released_at ||
    value.authority_status !== "lineage_only") {
    return false;
  }
  const sourceRefs = value.source_finding_refs as Ref[];
  return sourceRefs.some((ref) =>
    paperTradingComparisonRefsEqual(ref, release.source_finding_ref)) &&
    sourceRefs.some((ref) => paperTradingComparisonRefsEqual(ref, {
      record_kind: "research_finding",
      id: release.finding.research_finding_id
    })) && new Set(sourceRefs.map((ref) => `${ref.record_kind}:${ref.id}`)).size ===
      sourceRefs.length;
}

export function paperTradingComparisonResearchReleaseHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonResearchReleaseRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "paper_trading_comparison_research_release_id",
    "campaign_ref",
    "campaign_digest",
    "campaign_outcome_ref",
    "campaign_outcome_digest",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "source_finding_ref",
    "source_finding_record_digest",
    "source_lineage_ref",
    "source_lineage_record_digest",
    "direction_kind",
    "release_kind",
    "finding",
    "finding_record_digest",
    "lineage",
    "lineage_record_digest",
    "next_research_focus",
    "released_at",
    "release_digest",
    "research_visibility",
    "evaluation_authority",
    "promotion_authority",
    "live_exchange_authority",
    "order_submission_authority",
    "authority_status"
  ]) || value.record_kind !== "paper_trading_comparison_research_release" ||
    value.version !== 1 ||
    !comparisonRef(
      value.campaign_ref,
      "paper_trading_comparison_confirmation_campaign"
    ) || !comparisonDigest(value.campaign_digest) ||
    !comparisonRef(
      value.campaign_outcome_ref,
      "paper_trading_comparison_confirmation_campaign_outcome"
    ) || !comparisonDigest(value.campaign_outcome_digest) ||
    value.paper_trading_comparison_research_release_id !==
      `${value.campaign_outcome_ref.id}-research-release` ||
    !comparisonRef(value.candidate_ref, "trading_system_candidate") ||
    !comparisonRef(value.candidate_version_ref, "candidate_version") ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !comparisonDigest(value.system_code_artifact_digest) ||
    !comparisonRef(value.source_finding_ref, "research_finding") ||
    !comparisonDigest(value.source_finding_record_digest) ||
    !comparisonRef(value.source_lineage_ref, "artifact_lineage") ||
    !comparisonDigest(value.source_lineage_record_digest) ||
    !PAPER_TRADING_COMPARISON_RESEARCH_DIRECTION_KINDS.has(
      value.direction_kind as ResearchDirectionKind
    ) || !Object.hasOwn(
      PAPER_TRADING_COMPARISON_RESEARCH_RELEASE_FINDING_KIND,
      value.release_kind as PropertyKey
    ) || !comparisonDigest(value.finding_record_digest) ||
    !comparisonDigest(value.lineage_record_digest) ||
    !comparisonString(value.next_research_focus) ||
    !comparisonIso(value.released_at) || !comparisonDigest(value.release_digest) ||
    value.research_visibility !== "released_to_research" ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_authority !== false ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false ||
    value.authority_status !== "lineage_only") {
    return false;
  }
  const release = value as unknown as
    PaperTradingComparisonResearchReleaseRecord;
  return release.source_finding_ref.id !== release.finding.research_finding_id &&
    release.source_lineage_ref.id !== release.lineage.artifact_lineage_id &&
    paperTradingComparisonReleasedFindingHasRuntimeShape(
      release.finding,
      release
    ) && paperTradingComparisonReleasedLineageHasRuntimeShape(
      release.lineage,
      release
    );
}

export function paperTradingComparisonTradingPromotionHasRuntimeShape(value: unknown): value is TradingPromotionRecord {
  return comparisonObject(value) && value.record_kind === "trading_promotion" && value.version === 1 &&
    comparisonString(value.trading_promotion_id) && value.status === "promoted_for_trading_review" &&
    comparisonRef(value.candidate_ref, "trading_system_candidate") && comparisonRef(value.candidate_version_ref, "candidate_version") &&
    comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    comparisonObject(value.comparison_confirmation) &&
    value.comparison_confirmation.basis_kind === "paper_trading_comparison_confirmation" &&
    comparisonRef(
      value.comparison_confirmation.campaign_ref,
      "paper_trading_comparison_confirmation_campaign"
    ) && comparisonDigest(value.comparison_confirmation.campaign_digest) &&
    comparisonRef(
      value.comparison_confirmation.campaign_outcome_ref,
      "paper_trading_comparison_confirmation_campaign_outcome"
    ) && comparisonDigest(value.comparison_confirmation.campaign_outcome_digest) &&
    comparisonRef(
      value.comparison_confirmation.final_verdict_ref,
      "paper_trading_comparison_verdict"
    ) && comparisonDigest(value.comparison_confirmation.final_verdict_digest) &&
    comparisonIso(value.promoted_at) &&
    (value.promoted_by_command_ref === undefined || comparisonRef(value.promoted_by_command_ref)) && value.authority_status === "not_live";
}

export function paperTradingComparisonPolicyHasRuntimeShape(value: unknown): value is PaperTradingComparisonPolicy {
  return comparisonObject(value) && comparisonString(value.policy_version) &&
    (value.comparison_mode === "bootstrap" || value.comparison_mode === "champion_challenge") && value.symbol === "BTCUSDT" &&
    comparisonPositive(value.interval_ms) && comparisonPositive(value.minimum_observation_count) && comparisonPositive(value.minimum_elapsed_ms) &&
    comparisonPositive(value.maximum_observation_count) && comparisonPositive(value.maximum_elapsed_ms) && comparisonNonNegative(value.maximum_start_skew_ms) &&
    comparisonPositive(value.maximum_provider_request_count_per_side) && comparisonNonNegative(value.maximum_retry_count_per_side) &&
    value.minimum_observation_count <= value.maximum_observation_count && value.minimum_elapsed_ms <= value.maximum_elapsed_ms &&
    value.maximum_start_skew_ms <= value.maximum_elapsed_ms && value.primary_metric === "net_revenue_usdt" &&
    comparisonFinite(value.minimum_net_revenue_lift_usdt) && value.minimum_net_revenue_lift_usdt >= 0 && comparisonPositive(value.required_confirmation_count) &&
    value.require_non_overlapping_windows === true && value.require_both_qualified === true && value.release_policy === "sealed_until_adjudication";
}

export function paperTradingComparisonCandidateSideHasRuntimeShape(value: unknown, role: "champion" | "challenger"): value is PaperTradingComparisonCandidateSide {
  return comparisonObject(value) && value.role === role && comparisonRef(value.candidate_ref, "trading_system_candidate") &&
    comparisonRef(value.candidate_version_ref, "candidate_version") && comparisonDigest(value.candidate_version_digest) &&
    comparisonRef(value.system_code_ref, "system_code") && comparisonDigest(value.system_code_record_digest) &&
    comparisonDigest(value.system_code_artifact_digest) && comparisonRef(value.candidate_admission_decision_ref, "candidate_admission_decision") &&
    comparisonDigest(value.admission_decision_digest);
}

export function paperTradingComparisonSideHasRuntimeShape(value: unknown, role: "champion" | "challenger"): value is PaperTradingComparisonSide {
  if (!paperTradingComparisonCandidateSideHasRuntimeShape(value, role)) return false;
  const runtimeSide = value as PaperTradingComparisonSide;
  return comparisonRef(runtimeSide.trading_run_ref, "trading_run") &&
    comparisonRef(runtimeSide.paper_trading_evaluation_commitment_ref, "paper_trading_evaluation_commitment") && comparisonDigest(runtimeSide.paper_trading_evaluation_commitment_digest) &&
    comparisonDigest(runtimeSide.paper_trading_evaluation_commitment_record_digest) && comparisonRef(runtimeSide.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    comparisonDigest(runtimeSide.paper_trading_evaluation_record_digest);
}

export function paperTradingComparisonChampionSelectionHasRuntimeShape(value: unknown, mode: PaperTradingComparisonPolicy["comparison_mode"]): value is PaperTradingComparisonChampionSelection {
  if (!comparisonObject(value)) return false;
  if (mode === "bootstrap") return value.selection_kind === "bootstrap" && Object.keys(value).length === 1;
  return value.selection_kind === "trading_review" && comparisonRef(value.trading_promotion_ref, "trading_promotion") && comparisonDigest(value.trading_promotion_digest) &&
    comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") && comparisonDigest(value.paper_trading_evaluation_record_digest) &&
    comparisonRef(value.paper_trading_evaluation_commitment_ref, "paper_trading_evaluation_commitment") && comparisonDigest(value.paper_trading_evaluation_commitment_record_digest) && comparisonDigest(value.paper_trading_observation_chain_digest);
}

export function paperTradingComparisonPreparationHasRuntimeShape(value: unknown): value is PaperTradingComparisonPreparationRecord {
  if (!comparisonObject(value) || !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy)) return false;
  return value.record_kind === "paper_trading_comparison_preparation" && value.version === 1 && comparisonString(value.paper_trading_comparison_preparation_id) && comparisonString(value.paper_trading_comparison_commitment_id) &&
    paperTradingComparisonCandidateSideHasRuntimeShape(value.champion, "champion") && paperTradingComparisonCandidateSideHasRuntimeShape(value.challenger, "challenger") &&
    value.champion.candidate_version_ref.id !== value.challenger.candidate_version_ref.id && paperTradingComparisonChampionSelectionHasRuntimeShape(value.champion_selection, value.comparison_policy.comparison_mode) &&
    comparisonDigest(value.market_data_configuration_digest) && comparisonPolicyIdentity(value.paper_policy_identity) && comparisonIso(value.committed_at) && comparisonDigest(value.preparation_digest) && value.authority_status === "not_live";
}

export function paperTradingComparisonCommitmentHasRuntimeShape(value: unknown): value is PaperTradingComparisonCommitmentRecord {
  if (!comparisonObject(value) || !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy)) return false;
  return value.record_kind === "paper_trading_comparison_commitment" && value.version === 1 && comparisonString(value.paper_trading_comparison_commitment_id) && comparisonRef(value.preparation_ref, "paper_trading_comparison_preparation") &&
    paperTradingComparisonSideHasRuntimeShape(value.champion, "champion") && paperTradingComparisonSideHasRuntimeShape(value.challenger, "challenger") &&
    value.champion.candidate_version_ref.id !== value.challenger.candidate_version_ref.id && value.champion.trading_run_ref.id !== value.challenger.trading_run_ref.id &&
    paperTradingComparisonChampionSelectionHasRuntimeShape(value.champion_selection, value.comparison_policy.comparison_mode) && comparisonDigest(value.market_data_configuration_digest) && comparisonPolicyIdentity(value.paper_policy_identity) && comparisonIso(value.committed_at) && comparisonDigest(value.commitment_digest) && value.authority_status === "not_live";
}

export function paperTradingComparisonTickHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickRecord {
  if (
    !comparisonObject(value) ||
    !comparisonObject(value.market_snapshot) ||
    !comparisonObject(value.public_execution_snapshot)
  ) {
    return false;
  }
  const market = value.market_snapshot;
  const execution = value.public_execution_snapshot;
  const lineageValid = value.sequence === 1
    ? value.previous_tick_ref === undefined && value.previous_tick_digest === undefined
    : comparisonPositive(value.sequence) &&
      comparisonRef(value.previous_tick_ref, "paper_trading_comparison_tick") &&
      comparisonDigest(value.previous_tick_digest);
  return value.record_kind === "paper_trading_comparison_tick" &&
    value.version === 1 &&
    comparisonString(value.paper_trading_comparison_tick_id) &&
    comparisonRef(
      value.paper_trading_comparison_commitment_ref,
      "paper_trading_comparison_commitment"
    ) &&
    comparisonDigest(value.paper_trading_comparison_commitment_digest) &&
    lineageValid &&
    comparisonDigest(value.market_data_configuration_digest) &&
    comparisonMarketSnapshot(market) &&
    comparisonPositiveFinite(market.price) &&
    comparisonPositiveFinite(market.moving_average_fast) &&
    comparisonPositiveFinite(market.moving_average_slow) &&
    comparisonNonNegativeFinite(market.volatility) &&
    (market.expected_direction === "long" ||
      market.expected_direction === "short" ||
      market.expected_direction === "flat") &&
    comparisonMarketSourcePriority(market.source_priority) &&
    market.freshness === "fresh" &&
    typeof market.ws_connected === "boolean" &&
    typeof market.rest_fallback_used === "boolean" &&
    market.gap_detected === false &&
    comparisonPublicExecution(execution) &&
    comparisonMarketSourcePriority(execution.source_priority) &&
    execution.freshness === "fresh" &&
    typeof execution.ws_connected === "boolean" &&
    typeof execution.rest_fallback_used === "boolean" &&
    execution.gap_detected === false &&
    comparisonIso(value.observed_at) &&
    comparisonDigest(value.tick_digest) &&
    value.authority_status === "not_live";
}

export function paperTradingComparisonTickCaptureWriteContextHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickCaptureWriteContext {
  return comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "paper_trading_comparison_activation_ref",
      "paper_trading_comparison_activation_digest",
      "paper_trading_comparison_activation_attempt_ref",
      "paper_trading_comparison_activation_attempt_digest",
      "previous_checkpoint_attempt_ref",
      "previous_checkpoint_attempt_digest",
      "previous_checkpoint_outcome_ref",
      "previous_checkpoint_outcome_digest",
      "operation"
    ]) &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    comparisonRef(
      value.previous_checkpoint_attempt_ref,
      "paper_trading_comparison_checkpoint_attempt"
    ) &&
    comparisonDigest(value.previous_checkpoint_attempt_digest) &&
    comparisonRef(
      value.previous_checkpoint_outcome_ref,
      "paper_trading_comparison_checkpoint_outcome"
    ) &&
    comparisonDigest(value.previous_checkpoint_outcome_digest) &&
    value.operation === "capture_next_tick";
}

export function paperTradingComparisonTickContextHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickContext {
  return comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "tick_ref",
      "tick_digest",
      "tick_sequence",
      "delivery_ref",
      "delivery_digest"
    ]) &&
    comparisonRef(value.tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.tick_digest) &&
    comparisonPositive(value.tick_sequence) &&
    comparisonRef(value.delivery_ref, "paper_trading_comparison_tick_delivery") &&
    comparisonDigest(value.delivery_digest);
}

export function paperTradingComparisonTickDeliveryHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickDeliveryRecord {
  return comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "record_kind",
      "version",
      "paper_trading_comparison_tick_delivery_id",
      "paper_trading_comparison_activation_ref",
      "paper_trading_comparison_activation_digest",
      "paper_trading_comparison_activation_attempt_ref",
      "paper_trading_comparison_activation_attempt_digest",
      "role",
      "trading_run_ref",
      "tick_ref",
      "tick_digest",
      "tick_sequence",
      "provider_request_count_at_delivery",
      "endpoint",
      "delivered_at",
      "delivery_digest",
      "live_exchange_authority",
      "order_submission_authority",
      "authority_status"
    ]) &&
    value.record_kind === "paper_trading_comparison_tick_delivery" &&
    value.version === 1 &&
    comparisonString(value.paper_trading_comparison_tick_delivery_id) &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    (value.role === "champion" || value.role === "challenger") &&
    comparisonRef(value.trading_run_ref, "trading_run") &&
    comparisonRef(value.tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.tick_digest) &&
    comparisonPositive(value.tick_sequence) &&
    comparisonPositive(value.provider_request_count_at_delivery) &&
    value.endpoint === "GET /market/snapshot" &&
    comparisonIso(value.delivered_at) &&
    comparisonDigest(value.delivery_digest) &&
    value.live_exchange_authority === false &&
    value.order_submission_authority === false &&
    value.authority_status === "not_live";
}

export function paperTradingComparisonTickAcknowledgementHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickAcknowledgementRecord {
  return comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "record_kind",
      "version",
      "paper_trading_comparison_tick_acknowledgement_id",
      "delivery_ref",
      "delivery_digest",
      "paper_trading_comparison_activation_attempt_ref",
      "paper_trading_comparison_activation_attempt_digest",
      "role",
      "trading_run_ref",
      "tick_ref",
      "tick_digest",
      "tick_sequence",
      "provider_request_count_at_acknowledgement",
      "endpoint",
      "acknowledged_at",
      "acknowledgement_digest",
      "live_exchange_authority",
      "order_submission_authority",
      "authority_status"
    ]) &&
    value.record_kind === "paper_trading_comparison_tick_acknowledgement" &&
    value.version === 1 &&
    comparisonString(value.paper_trading_comparison_tick_acknowledgement_id) &&
    comparisonRef(value.delivery_ref, "paper_trading_comparison_tick_delivery") &&
    comparisonDigest(value.delivery_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    (value.role === "champion" || value.role === "challenger") &&
    comparisonRef(value.trading_run_ref, "trading_run") &&
    comparisonRef(value.tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.tick_digest) &&
    comparisonPositive(value.tick_sequence) &&
    comparisonPositive(value.provider_request_count_at_acknowledgement) &&
    value.endpoint === "POST /comparison/tick/ack" &&
    comparisonIso(value.acknowledged_at) &&
    comparisonDigest(value.acknowledgement_digest) &&
    value.live_exchange_authority === false &&
    value.order_submission_authority === false &&
    value.authority_status === "not_live";
}

export function paperTradingComparisonTickIOWriteContextHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonTickIOWriteContext {
  return comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "paper_trading_comparison_activation_ref",
      "paper_trading_comparison_activation_digest",
      "paper_trading_comparison_activation_attempt_ref",
      "paper_trading_comparison_activation_attempt_digest",
      "role",
      "trading_run_ref",
      "tick_ref",
      "tick_digest",
      "operation"
    ]) &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    (value.role === "champion" || value.role === "challenger") &&
    comparisonRef(value.trading_run_ref, "trading_run") &&
    comparisonRef(value.tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.tick_digest) &&
    (value.operation === "deliver_market_snapshot" ||
      value.operation === "acknowledge_tick");
}

export function paperTradingComparisonActivationSideHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger"
): value is PaperTradingComparisonActivationSide {
  return comparisonObject(value) &&
    value.role === role &&
    comparisonRef(value.trading_run_ref, "trading_run") &&
    comparisonRef(
      value.paper_trading_evaluation_commitment_ref,
      "paper_trading_evaluation_commitment"
    ) &&
    comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation");
}

export function paperTradingComparisonActivationPolicyHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonActivationPolicy {
  return comparisonObject(value) &&
    value.policy_version === "paper-comparison-activation-v1" &&
    comparisonNonNegative(value.maximum_start_skew_ms) &&
    comparisonNonNegative(value.maximum_retry_count_per_side) &&
    comparisonPositive(value.maximum_provider_request_count_per_side) &&
    value.maximum_activation_elapsed_ms === 60_000 &&
    value.cleanup_timeout_ms === 10_000 &&
    value.require_both_running_before_observation === true &&
    value.partial_start_policy === "stop_started_side_before_retry" &&
    value.restart_policy === "recover_both_or_stop_both" &&
    value.market_view_policy === "first_tick_then_contiguous_persisted_ticks";
}

export function paperTradingComparisonActivationHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonActivationRecord {
  if (
    !comparisonObject(value) ||
    !paperTradingComparisonActivationSideHasRuntimeShape(value.champion, "champion") ||
    !paperTradingComparisonActivationSideHasRuntimeShape(value.challenger, "challenger") ||
    !paperTradingComparisonActivationPolicyHasRuntimeShape(value.activation_policy)
  ) {
    return false;
  }
  const champion = value.champion;
  const challenger = value.challenger;
  return value.record_kind === "paper_trading_comparison_activation" &&
    value.version === 1 &&
    comparisonString(value.paper_trading_comparison_activation_id) &&
    comparisonRef(
      value.paper_trading_comparison_commitment_ref,
      "paper_trading_comparison_commitment"
    ) &&
    comparisonDigest(value.paper_trading_comparison_commitment_digest) &&
    comparisonRef(value.first_tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.first_tick_digest) &&
    champion.trading_run_ref.id !== challenger.trading_run_ref.id &&
    champion.paper_trading_evaluation_commitment_ref.id !==
      challenger.paper_trading_evaluation_commitment_ref.id &&
    champion.paper_trading_evaluation_ref.id !==
      challenger.paper_trading_evaluation_ref.id &&
    comparisonDigest(value.market_data_configuration_digest) &&
    value.activation_scope === "qualification_pair" &&
    value.activation_status === "authorized" &&
    comparisonIso(value.authorized_at) &&
    comparisonDigest(value.activation_digest) &&
    value.live_exchange_authority === false &&
    value.order_submission_authority === false &&
    value.private_exchange_access === "forbidden" &&
    value.credentials_access === "forbidden" &&
    value.authority_status === "not_live";
}

export function paperTradingComparisonActivationAttemptHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonActivationAttemptRecord {
  if (
    !comparisonObject(value) ||
    !paperTradingComparisonActivationSideHasRuntimeShape(value.champion, "champion") ||
    !paperTradingComparisonActivationSideHasRuntimeShape(value.challenger, "challenger") ||
    !paperTradingComparisonActivationPolicyHasRuntimeShape(value.activation_policy)
  ) {
    return false;
  }
  const champion = value.champion;
  const challenger = value.challenger;
  if (
    value.record_kind !== "paper_trading_comparison_activation_attempt" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_activation_attempt_id) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_activation_digest) ||
    !comparisonRef(
      value.paper_trading_comparison_commitment_ref,
      "paper_trading_comparison_commitment"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_commitment_digest) ||
    !comparisonRef(value.first_tick_ref, "paper_trading_comparison_tick") ||
    !comparisonDigest(value.first_tick_digest) ||
    !comparisonPositive(value.attempt_sequence) ||
    !comparisonNonNegative(value.retry_index) ||
    value.retry_index !== value.attempt_sequence - 1 ||
    value.retry_index > value.activation_policy.maximum_retry_count_per_side ||
    value.start_mode !== "parallel" ||
    value.attempt_status !== "starting" ||
    !comparisonIso(value.attempted_at) ||
    !comparisonIso(value.start_deadline_at) ||
    !comparisonDigest(value.attempt_digest) ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false ||
    value.authority_status !== "not_live"
  ) {
    return false;
  }
  return champion.trading_run_ref.id !== challenger.trading_run_ref.id &&
    champion.paper_trading_evaluation_commitment_ref.id !==
      challenger.paper_trading_evaluation_commitment_ref.id &&
    champion.paper_trading_evaluation_ref.id !==
      challenger.paper_trading_evaluation_ref.id &&
    Date.parse(value.start_deadline_at) ===
      Date.parse(value.attempted_at) + value.activation_policy.maximum_activation_elapsed_ms;
}

function comparisonTradingRunLifecycleStatus(
  value: unknown
): value is TradingRunLifecycleStatus {
  return comparisonString(value) && [
    "registered",
    "deployed",
    "starting",
    "running",
    "paused",
    "stopping",
    "stopped",
    "failed",
    "killed",
    "human_review_required",
    "fixture_placeholder"
  ].includes(value);
}

function comparisonPaperTradingEvaluationStatus(
  value: unknown
): value is PaperTradingEvaluationStatus {
  return comparisonString(value) && [
    "not_started",
    "running",
    "stopped",
    "failed",
    "invalidated"
  ].includes(value);
}

export function paperTradingComparisonActivationSideResultHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonActivationSideResultRecord {
  if (
    !comparisonObject(value) ||
    value.record_kind !== "paper_trading_comparison_activation_side_result" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_activation_side_result_id) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_activation_digest) ||
    (value.role !== "champion" && value.role !== "challenger") ||
    !comparisonPositive(value.operation_sequence) ||
    (value.operation !== "start" && value.operation !== "stop") ||
    ![
      "symmetric_start",
      "partial_start_cleanup",
      "policy_cleanup",
      "restart_cleanup",
      "handoff_cleanup"
    ].includes(value.reason as string) ||
    !["succeeded", "failed", "timed_out", "not_running"].includes(
      value.outcome as string
    ) ||
    !comparisonRef(value.trading_run_ref, "trading_run") ||
    !comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") ||
    (value.sandbox_ref !== undefined && !comparisonRef(value.sandbox_ref, "sandbox")) ||
    (value.runtime_lifecycle_status !== "unknown" &&
      !comparisonTradingRunLifecycleStatus(value.runtime_lifecycle_status)) ||
    (value.evaluation_status !== "unknown" &&
      !comparisonPaperTradingEvaluationStatus(value.evaluation_status)) ||
    !comparisonNonNegative(value.provider_request_count) ||
    !comparisonIso(value.effect_started_at) ||
    !comparisonIso(value.effect_completed_at) ||
    Date.parse(value.effect_completed_at) < Date.parse(value.effect_started_at) ||
    !comparisonDigest(value.side_result_digest) ||
    value.authority_status !== "not_live"
  ) {
    return false;
  }
  if (
    value.operation === "start" &&
      (value.operation_sequence !== 1 || value.reason !== "symmetric_start") ||
    value.operation === "stop" &&
      (value.operation_sequence < 2 || value.reason === "symmetric_start") ||
    value.outcome === "not_running" && value.operation !== "stop"
  ) {
    return false;
  }
  if (value.outcome === "failed" || value.outcome === "timed_out") {
    if (!comparisonString(value.stable_error_code)) return false;
  } else if (value.stable_error_code !== undefined) {
    return false;
  }
  if (value.operation === "start" && value.outcome === "succeeded") {
    return comparisonRef(value.sandbox_ref, "sandbox") &&
      value.runtime_lifecycle_status === "running" &&
      value.evaluation_status === "running";
  }
  if (value.operation === "stop" && value.outcome === "succeeded") {
    return value.runtime_lifecycle_status === "stopped" &&
      (value.evaluation_status === "stopped" || value.evaluation_status === "failed");
  }
  if (value.operation === "stop" && value.outcome === "not_running") {
    return (value.runtime_lifecycle_status === "registered" ||
        value.runtime_lifecycle_status === "stopped") &&
      (value.evaluation_status === "not_started" || value.evaluation_status === "stopped");
  }
  return true;
}

export function paperTradingComparisonActivationOutcomeHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonActivationOutcomeRecord {
  if (
    !comparisonObject(value) ||
    value.record_kind !== "paper_trading_comparison_activation_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_activation_outcome_id) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) ||
    !comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) ||
    !comparisonDigest(value.paper_trading_comparison_activation_digest) ||
    !comparisonPositive(value.outcome_sequence) ||
    !["both_running", "stopped_cleanly", "cleanup_required"].includes(
      value.outcome_status as string
    ) ||
    ![
      "started_within_policy",
      "start_failed",
      "start_timed_out",
      "start_skew_exceeded",
      "activation_elapsed_exceeded",
      "provider_request_budget_exceeded",
      "side_result_persistence_failed",
      "cleanup_failed",
      "restart_cleanup",
      "handoff_cleanup"
    ].includes(value.outcome_reason as string) ||
    (value.champion_latest_result_ref !== undefined &&
      !comparisonRef(
        value.champion_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      )) ||
    (value.challenger_latest_result_ref !== undefined &&
      !comparisonRef(
        value.challenger_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      )) ||
    ![
      "capture_first_paired_checkpoint",
      "retry_activation",
      "recover_cleanup",
      "checkpoint_handoff_complete"
    ].includes(value.next_action as string) ||
    !comparisonIso(value.completed_at) ||
    !comparisonDigest(value.outcome_digest) ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false ||
    value.authority_status !== "not_live" ||
    comparisonRef(
      value.champion_latest_result_ref,
      "paper_trading_comparison_activation_side_result"
    ) &&
      comparisonRef(
        value.challenger_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      ) &&
      value.champion_latest_result_ref.id === value.challenger_latest_result_ref.id
  ) {
    return false;
  }
  const previousOutcomeValid = value.outcome_sequence === 1
    ? value.previous_outcome_ref === undefined
    : comparisonRef(
        value.previous_outcome_ref,
        "paper_trading_comparison_activation_outcome"
      ) && value.previous_outcome_ref.id !==
        value.paper_trading_comparison_activation_outcome_id;
  if (!previousOutcomeValid) return false;
  if (value.outcome_status === "both_running") {
    return value.outcome_reason === "started_within_policy" &&
      comparisonRef(
        value.champion_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      ) &&
      comparisonRef(
        value.challenger_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      ) &&
      value.next_action === "capture_first_paired_checkpoint";
  }
  if (value.outcome_status === "stopped_cleanly") {
    return value.outcome_reason !== "started_within_policy" &&
      value.outcome_reason !== "cleanup_failed" &&
      comparisonRef(
        value.champion_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      ) &&
      comparisonRef(
        value.challenger_latest_result_ref,
        "paper_trading_comparison_activation_side_result"
      ) &&
      value.next_action === (value.outcome_reason === "handoff_cleanup"
        ? "checkpoint_handoff_complete"
        : "retry_activation");
  }
  return value.outcome_reason !== "started_within_policy" &&
    value.next_action === "recover_cleanup";
}

export function paperTradingComparisonRuntimeWriteContextHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonRuntimeWriteContext {
  return comparisonObject(value) &&
    Object.keys(value).length === 6 &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    (value.role === "champion" || value.role === "challenger") &&
    (value.operation === "start" || value.operation === "stop");
}

function paperTradingComparisonCheckpointAttemptSideHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger"
): value is PaperTradingComparisonCheckpointAttemptSide {
  return comparisonObject(value) &&
    value.role === role &&
    comparisonRef(value.trading_run_ref, "trading_run") &&
    comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") &&
    comparisonDigest(value.evaluation_record_digest) &&
    comparisonDigest(value.observation_chain_digest) &&
    comparisonNonNegative(value.provider_request_count_before);
}

export function paperTradingComparisonCheckpointAttemptHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonCheckpointAttemptRecord {
  if (
    !comparisonObject(value) ||
    !paperTradingComparisonCheckpointAttemptSideHasRuntimeShape(
      value.champion,
      "champion"
    ) ||
    !paperTradingComparisonCheckpointAttemptSideHasRuntimeShape(
      value.challenger,
      "challenger"
    )
  ) {
    return false;
  }
  const champion = value.champion;
  const challenger = value.challenger;
  const predecessorValid = value.checkpoint_sequence === 1
    ? value.previous_checkpoint_outcome_ref === undefined &&
      value.previous_checkpoint_outcome_digest === undefined
    : comparisonPositive(value.checkpoint_sequence) &&
      comparisonRef(
        value.previous_checkpoint_outcome_ref,
        "paper_trading_comparison_checkpoint_outcome"
      ) &&
      comparisonDigest(value.previous_checkpoint_outcome_digest);
  return value.record_kind === "paper_trading_comparison_checkpoint_attempt" &&
    value.version === 1 &&
    comparisonString(value.paper_trading_comparison_checkpoint_attempt_id) &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    comparisonRef(
      value.activation_outcome_ref,
      "paper_trading_comparison_activation_outcome"
    ) &&
    comparisonDigest(value.activation_outcome_digest) &&
    comparisonRef(
      value.paper_trading_comparison_commitment_ref,
      "paper_trading_comparison_commitment"
    ) &&
    comparisonDigest(value.paper_trading_comparison_commitment_digest) &&
    comparisonRef(value.tick_ref, "paper_trading_comparison_tick") &&
    comparisonDigest(value.tick_digest) &&
    predecessorValid &&
    champion.trading_run_ref.id !== challenger.trading_run_ref.id &&
    champion.paper_trading_evaluation_ref.id !==
      challenger.paper_trading_evaluation_ref.id &&
    comparisonIso(value.attempted_at) &&
    comparisonIso(value.checkpoint_deadline_at) &&
    Date.parse(value.checkpoint_deadline_at) > Date.parse(value.attempted_at) &&
    Date.parse(value.checkpoint_deadline_at) - Date.parse(value.attempted_at) <= 60_000 &&
    value.attempt_status === "preparing" &&
    comparisonDigest(value.attempt_digest) &&
    value.live_exchange_authority === false &&
    value.order_submission_authority === false &&
    value.authority_status === "not_live";
}

function paperTradingComparisonCheckpointSideEvidenceHasRuntimeShape(
  value: unknown,
  role: "champion" | "challenger",
  checkpointSequence: number
): value is PaperTradingComparisonCheckpointSideEvidence {
  if (!comparisonObject(value)) return false;
  const acknowledgementValid = checkpointSequence === 1
    ? value.tick_acknowledgement_ref === undefined &&
      value.tick_acknowledgement_digest === undefined
    : comparisonRef(
        value.tick_acknowledgement_ref,
        "paper_trading_comparison_tick_acknowledgement"
      ) && comparisonDigest(value.tick_acknowledgement_digest);
  return acknowledgementValid &&
    value.role === role &&
    comparisonRef(value.observation_ref, "paper_trading_observation") &&
    comparisonDigest(value.observation_record_digest) &&
    comparisonDigest(value.evaluation_record_digest) &&
    Array.isArray(value.ledger_chain_refs) &&
    value.ledger_chain_refs.every((item) => comparisonRef(item, "ledger_chain")) &&
    new Set(value.ledger_chain_refs.map((item) => item.id)).size ===
      value.ledger_chain_refs.length &&
    (value.observation_status === "recorded" ||
      value.observation_status === "no_order" ||
      value.observation_status === "failed") &&
    comparisonNonNegative(value.consumed_event_count) &&
    comparisonNonNegative(value.provider_request_count_after) &&
    (value.observation_status !== "no_order" || value.ledger_chain_refs.length === 0);
}

export function paperTradingComparisonCheckpointOutcomeHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonCheckpointOutcomeRecord {
  if (
    !comparisonObject(value) ||
    value.record_kind !== "paper_trading_comparison_checkpoint_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.paper_trading_comparison_checkpoint_outcome_id) ||
    !comparisonRef(
      value.checkpoint_attempt_ref,
      "paper_trading_comparison_checkpoint_attempt"
    ) ||
    !comparisonDigest(value.checkpoint_attempt_digest) ||
    !comparisonRef(value.tick_ref, "paper_trading_comparison_tick") ||
    !comparisonDigest(value.tick_digest) ||
    !comparisonPositive(value.checkpoint_sequence) ||
    (value.outcome_status !== "paired" && value.outcome_status !== "incomplete") ||
    ![
      "paired_checkpoint_recorded",
      "side_preparation_failed",
      "side_preparation_timed_out",
      "provider_request_budget_exceeded",
      "checkpoint_deadline_exceeded",
      "paired_persistence_failed",
      "restart_cleanup"
    ].includes(value.outcome_reason as string) ||
    ![
      "serve_and_acknowledge_current_tick",
      "capture_next_tick",
      "close_failed_comparison",
      "recover_cleanup"
    ].includes(value.next_action as string) ||
    !comparisonIso(value.completed_at) ||
    !comparisonDigest(value.outcome_digest) ||
    value.live_exchange_authority !== false ||
    value.order_submission_authority !== false ||
    value.authority_status !== "not_live"
  ) {
    return false;
  }
  if (value.outcome_status === "paired") {
    if (
      value.outcome_reason !== "paired_checkpoint_recorded" ||
      value.stable_error_code !== undefined ||
      !paperTradingComparisonCheckpointSideEvidenceHasRuntimeShape(
        value.champion,
        "champion",
        value.checkpoint_sequence
      ) ||
      !paperTradingComparisonCheckpointSideEvidenceHasRuntimeShape(
        value.challenger,
        "challenger",
        value.checkpoint_sequence
      ) ||
      value.champion.observation_ref.id === value.challenger.observation_ref.id ||
      value.checkpoint_sequence > 1 &&
        value.champion.tick_acknowledgement_ref!.id ===
          value.challenger.tick_acknowledgement_ref!.id
    ) {
      return false;
    }
    const hasFailedSide = value.champion.observation_status === "failed" ||
      value.challenger.observation_status === "failed";
    return value.next_action === (hasFailedSide
      ? "close_failed_comparison"
      : value.checkpoint_sequence === 1
        ? "serve_and_acknowledge_current_tick"
        : "capture_next_tick");
  }
  if (
    value.outcome_reason === "paired_checkpoint_recorded" ||
    value.champion !== undefined ||
    value.challenger !== undefined ||
    !comparisonString(value.stable_error_code)
  ) {
    return false;
  }
  const requiresRecovery = value.outcome_reason === "paired_persistence_failed" ||
    value.outcome_reason === "restart_cleanup";
  return value.next_action === (requiresRecovery
    ? "recover_cleanup"
    : "close_failed_comparison");
}

export function paperTradingComparisonCheckpointWriteContextHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonCheckpointWriteContext {
  return comparisonObject(value) &&
    Object.keys(value).length === 10 &&
    comparisonRef(
      value.paper_trading_comparison_activation_ref,
      "paper_trading_comparison_activation"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_digest) &&
    comparisonRef(
      value.paper_trading_comparison_activation_attempt_ref,
      "paper_trading_comparison_activation_attempt"
    ) &&
    comparisonDigest(value.paper_trading_comparison_activation_attempt_digest) &&
    comparisonRef(
      value.activation_outcome_ref,
      "paper_trading_comparison_activation_outcome"
    ) &&
    comparisonDigest(value.activation_outcome_digest) &&
    comparisonRef(
      value.checkpoint_attempt_ref,
      "paper_trading_comparison_checkpoint_attempt"
    ) &&
    comparisonDigest(value.checkpoint_attempt_digest) &&
    (value.role === "champion" || value.role === "challenger") &&
    (value.operation === "advance_tick_view" ||
      value.operation === "refresh_sandbox_evidence" ||
      value.operation === "commit_paired_checkpoint");
}

export interface PaperTradingEvaluationRecord extends BaseRecord {
  record_kind: "paper_trading_evaluation";
  paper_trading_evaluation_id: string;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  trading_run_ref: Ref;
  paper_trading_evaluation_commitment_ref?: Ref;
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
  invalidation_reason?: PaperTradingEvaluationInvalidationReason;
  latest_failure_reason?: string;
  authority_status: "not_live";
}

export function paperTradingComparisonBaselineEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluationRef: Ref
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationRef.id,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: { ...PAPER_TRADING_COMPARISON_ZERO_SCORE },
    paper_account_snapshot: {
      ...commitment.initial_account_snapshot,
      position: { ...commitment.initial_account_snapshot.position }
    },
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

export function paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
  value: unknown,
  baseline: PaperTradingEvaluationRecord,
  expectedStatus: "not_started" | "running" | "stopped"
): value is PaperTradingEvaluationRecord {
  if (
    !comparisonObject(value) ||
    !comparisonInertEvaluation(baseline) ||
    baseline.next_observation_at !== undefined ||
    baseline.latest_fill !== undefined ||
    baseline.latest_public_execution_snapshot !== undefined ||
    baseline.invalidation_reason !== undefined ||
    baseline.latest_failure_reason !== undefined
  ) {
    return false;
  }
  if (expectedStatus === "not_started") {
    return value.status === "not_started" && semanticEqual(value, baseline);
  }
  if (expectedStatus === "running") {
    if (
      value.status !== "running" ||
      !comparisonIso(value.next_observation_at) ||
      Date.parse(value.next_observation_at) <= Date.parse(baseline.started_at)
    ) {
      return false;
    }
    return semanticEqual(value, {
      ...baseline,
      status: "running",
      next_observation_at: value.next_observation_at
    });
  }
  if (
    value.status !== "stopped" ||
    !comparisonIso(value.stopped_at) ||
    Date.parse(value.stopped_at) < Date.parse(baseline.started_at)
  ) {
    return false;
  }
  return semanticEqual(value, {
    ...baseline,
    status: "stopped",
    stopped_at: value.stopped_at
  });
}

export interface PaperTradingObservationRecord extends BaseRecord {
  record_kind: "paper_trading_observation";
  paper_trading_observation_id: string;
  paper_trading_evaluation_ref: Ref;
  paper_trading_evaluation_commitment_ref?: Ref;
  paper_trading_comparison_tick_ref?: Ref;
  paper_trading_comparison_tick_digest?: string;
  paper_trading_comparison_tick_acknowledgement_ref?: Ref;
  paper_trading_comparison_tick_acknowledgement_digest?: string;
  paper_trading_comparison_checkpoint_attempt_ref?: Ref;
  paper_trading_comparison_checkpoint_attempt_digest?: string;
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

export interface PaperTradingComparisonLoadedSideRecords {
  candidate: CandidateInspectReadModel;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

export interface PaperTradingComparisonStoppedQualificationClosure {
  systemCode: SystemCodeRecord;
  admission: CandidateAdmissionDecisionRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
  promotion: TradingPromotionRecord;
  preparationCommittedAt: string;
}

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY: PaperTradingQualificationPolicy = {
  minObservationCount: 30,
  minElapsedMs: 30 * 60_000,
  maxFailedObservationRatio: 0.1,
  assessRunnerHealth: true
};

export function paperTradingEvidenceIntegrityReasons(input: PaperTradingQualificationEvidenceInput): PaperTradingQualificationReason[] {
  if (!input.commitment || !input.commitmentDigestVerified || !qualificationCommitmentMatches(input.commitment, input.evaluation)) return ["paper_evaluation_commitment_missing"];
  if (!qualificationObservationChain(input.evaluation, input.commitment, input.observations)) return ["paper_observation_chain_incomplete"];
  if (!qualificationAccounting(input.evaluation, input.commitment, input.observations)) return ["paper_score_account_mismatch"];
  return [];
}

export function decidePaperTradingQualification(input: PaperTradingQualificationDecisionInput): PaperTradingQualificationResult {
  const policy = { ...DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY, ...input.policy };
  const observations = [...input.observations].sort((left, right) => left.sequence - right.sequence);
  const failed = observations.filter((item) => item.status === "failed").length;
  const last = observations.at(-1);
  const started = Date.parse(input.evaluation.started_at);
  const ended = last ? Date.parse(last.observed_at) : Number.NaN;
  const elapsed = Number.isFinite(started) && Number.isFinite(ended) && ended >= started ? ended - started : 0;
  const evidence_window = { observation_count: input.evaluation.observation_count, elapsed_ms: elapsed, failed_observation_count: failed, first_observed_at: observations[0]?.observed_at, last_observed_at: last?.observed_at ?? input.evaluation.last_observed_at };
  const result = (qualification_status: PaperTradingQualificationStatus, qualification_reasons: PaperTradingQualificationReason[]): PaperTradingQualificationResult => ({ qualification_status, qualification_reasons, evidence_window });
  if (input.evaluation.status === "invalidated") return result("blocked_by_quality", ["paper_evaluation_invalidated"]);
  const commitment = input.commitment;
  if (!commitment || !input.commitmentDigestVerified || !qualificationCommitmentMatches(commitment, input.evaluation)) return result("not_qualification_evidence", ["paper_evaluation_commitment_missing"]);
  if (commitment.evidence_purpose !== "qualification") return result("not_qualification_evidence", ["evidence_purpose_not_qualification"]);
  if (!commitment.provider_identity.qualification_eligible) return result("not_qualification_evidence", ["provider_identity_not_qualification_eligible"]);
  if (input.evaluation.status === "failed") return result("paper_failed", ["paper_evaluation_failed"]);
  const integrity = paperTradingEvidenceIntegrityReasons(input);
  if (integrity.length) return result("blocked_by_quality", integrity);
  const quality: PaperTradingQualificationReason[] = [];
  if (policy.assessRunnerHealth && input.evaluation.status === "running" && !input.runnerActive) quality.push("runner_inactive_for_running_evaluation");
  if (input.evaluation.observation_count > 0 && failed / input.evaluation.observation_count > policy.maxFailedObservationRatio) quality.push("failed_observation_ratio_exceeded");
  if (input.evaluation.observation_count >= policy.minObservationCount && !observations.some((item) => item.market_snapshot !== undefined)) quality.push("latest_market_snapshot_missing");
  if (!qualificationFillsHaveEvidence(input.evaluation, observations)) quality.push("fill_public_execution_evidence_missing");
  if (quality.length) return result(quality.length === 1 && quality[0] === "runner_inactive_for_running_evaluation" ? "needs_resume" : "blocked_by_quality", quality);
  const collecting: PaperTradingQualificationReason[] = [];
  if (input.evaluation.observation_count < policy.minObservationCount) collecting.push("min_observation_count_not_met");
  if (elapsed < policy.minElapsedMs) collecting.push("min_elapsed_ms_not_met");
  return collecting.length ? result("collecting_evidence", collecting) : result("qualified", []);
}

function qualificationCommitmentMatches(commitment: PaperTradingEvaluationCommitmentRecord, evaluation: PaperTradingEvaluationRecord): boolean {
  return paperTradingComparisonRefsEqual(evaluation.paper_trading_evaluation_commitment_ref, { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id }) &&
    paperTradingComparisonRefsEqual(evaluation.candidate_ref, commitment.candidate_ref) && paperTradingComparisonRefsEqual(evaluation.candidate_version_ref, commitment.candidate_version_ref) && paperTradingComparisonRefsEqual(evaluation.trading_run_ref, commitment.trading_run_ref) &&
    evaluation.interval_ms === commitment.window_policy.interval_ms && commitment.authority_status === "not_live" && evaluation.authority_status === "not_live";
}

function qualificationObservationChain(evaluation: PaperTradingEvaluationRecord, commitment: PaperTradingEvaluationCommitmentRecord, observations: PaperTradingObservationRecord[]): boolean {
  return observations.length === evaluation.observation_count && [...observations].sort((left, right) => left.sequence - right.sequence).every((item, index) => item.sequence === index + 1 &&
    paperTradingComparisonRefsEqual(item.paper_trading_evaluation_ref, { record_kind: evaluation.record_kind, id: evaluation.paper_trading_evaluation_id }) &&
    paperTradingComparisonRefsEqual(item.paper_trading_evaluation_commitment_ref, evaluation.paper_trading_evaluation_commitment_ref) &&
    paperTradingComparisonRefsEqual(item.candidate_ref, commitment.candidate_ref) && paperTradingComparisonRefsEqual(item.candidate_version_ref, commitment.candidate_version_ref) && paperTradingComparisonRefsEqual(item.trading_run_ref, commitment.trading_run_ref));
}

function qualificationScore(account: PaperTradingAccountSnapshot, initialEquity: number): TradingProfitLossReadModel {
  const decimal = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const revenue = decimal(account.realized_pnl_usdt) + decimal(account.unrealized_pnl_usdt);
  const cost = decimal(account.fee_paid_usdt) + decimal(account.slippage_paid_usdt) + decimal(account.funding_paid_usdt);
  const net = decimal(account.equity_usdt) - initialEquity;
  return { revenue_usdt: round(revenue), cost_usdt: round(cost), net_revenue_usdt: round(net), net_return_pct: round(net / initialEquity * 100) };
}
function qualificationSameScore(left: TradingProfitLossReadModel, right: TradingProfitLossReadModel): boolean { return left.revenue_usdt === right.revenue_usdt && left.cost_usdt === right.cost_usdt && left.net_revenue_usdt === right.net_revenue_usdt && left.net_return_pct === right.net_return_pct; }
function qualificationAccounting(evaluation: PaperTradingEvaluationRecord, commitment: PaperTradingEvaluationCommitmentRecord, observations: PaperTradingObservationRecord[]): boolean {
  const initial = Number(commitment.initial_account_snapshot.equity_usdt);
  if (!Number.isFinite(initial) || initial <= 0 || !qualificationSameScore(qualificationScore(commitment.initial_account_snapshot, initial), PAPER_TRADING_COMPARISON_ZERO_SCORE)) return false;
  let prior = PAPER_TRADING_COMPARISON_ZERO_SCORE;
  let account = commitment.initial_account_snapshot;
  for (const item of [...observations].sort((left, right) => left.sequence - right.sequence)) {
    const current = item.cumulative_score;
    const delta = { revenue_usdt: Math.round((current.revenue_usdt - prior.revenue_usdt) * 1_000_000) / 1_000_000, cost_usdt: Math.round((current.cost_usdt - prior.cost_usdt) * 1_000_000) / 1_000_000, net_revenue_usdt: Math.round((current.net_revenue_usdt - prior.net_revenue_usdt) * 1_000_000) / 1_000_000, net_return_pct: Math.round((current.net_return_pct - prior.net_return_pct) * 1_000_000) / 1_000_000 };
    if (![...Object.values(item.score_delta), ...Object.values(current)].every(Number.isFinite) || !qualificationSameScore(item.score_delta, delta)) return false;
    if (item.paper_account_snapshot) { if (!qualificationSameScore(qualificationScore(item.paper_account_snapshot, initial), current)) return false; account = item.paper_account_snapshot; }
    else if (!qualificationSameScore(current, prior)) return false;
    prior = current;
  }
  return Boolean(evaluation.paper_account_snapshot) && qualificationSameScore(prior, evaluation.latest_score) && semanticEqual(account, evaluation.paper_account_snapshot);
}
function semanticEqual(left: unknown, right: unknown): boolean { try { return paperTradingComparisonPersistedRecordDigestInput(left) === paperTradingComparisonPersistedRecordDigestInput(right); } catch { return false; } }
function qualificationFillsHaveEvidence(evaluation: PaperTradingEvaluationRecord, observations: PaperTradingObservationRecord[]): boolean {
  const fills = [evaluation.latest_fill, ...observations.map((item) => item.latest_fill)].filter((item): item is PaperTradingFillSummary => Boolean(item));
  const snapshots = [evaluation.latest_public_execution_snapshot, ...observations.map((item) => item.public_execution_snapshot)].filter(Boolean);
  return fills.every((fill) => snapshots.some((snapshot) => {
    if (!fill.source_trade_id) return Boolean(snapshot!.book_ticker || snapshot!.agg_trades.length);
    return snapshot!.agg_trades.some((trade) => trade.trade_id === fill.source_trade_id) ||
      snapshot!.stream_marker === fill.source_trade_id ||
      fill.source_trade_id.startsWith(`${snapshot!.stream_marker}:`);
  }));
}

export function paperTradingComparisonSideRecordsHaveInertShape(value: unknown): value is PaperTradingComparisonLoadedSideRecords {
  if (!comparisonObject(value) || !comparisonObject(value.candidate) || !comparisonObject(value.candidateVersion) || !comparisonObject(value.admission) || !comparisonObject(value.run) || !comparisonObject(value.systemCode) || !comparisonObject(value.commitment) || !comparisonObject(value.evaluation) || !Array.isArray(value.observations)) return false;
  const candidate = value.candidate;
  const version = value.candidateVersion;
  const admission = value.admission;
  const run = value.run;
  const code = value.systemCode;
  const commitment = value.commitment;
  const evaluation = value.evaluation;
  if (!comparisonString(candidate.candidate_id) || !comparisonObject(candidate.runtime) || !comparisonObject(candidate.system_code) || !comparisonRef(candidate.runtime.ref, "trading_run") || !comparisonRef(candidate.system_code.ref, "system_code")) return false;
  if (version.record_kind !== "candidate_version" || version.version !== 1 || !comparisonString(version.candidate_version_id) || version.candidate_id !== candidate.candidate_id || !comparisonRef(version.runtime_ref, "trading_run") || !comparisonRef(version.system_code_ref, "system_code") || !Array.isArray(version.capability_package_refs) || !version.capability_package_refs.every((item) => comparisonRef(item, "capability_package"))) return false;
  if (run.record_kind !== "trading_run" || run.version !== 1 || !comparisonString(run.trading_run_id) || !comparisonRef(run.candidate_ref, "trading_system_candidate") || !comparisonRef(run.candidate_version_ref, "candidate_version") || !comparisonRef(run.system_code_ref, "system_code")) return false;
  if (!comparisonSystemCode(code) || !comparisonAdmission(admission) || !comparisonInertCommitment(commitment) || !comparisonInertEvaluation(evaluation)) return false;
  return paperTradingComparisonRefsEqual(candidate.runtime.ref, { record_kind: "trading_run", id: run.trading_run_id }) && paperTradingComparisonRefsEqual(candidate.system_code.ref, { record_kind: "system_code", id: code.system_code_id }) && version.runtime_ref.id !== run.trading_run_id && version.system_code_ref.id === code.system_code_id && admission.system_code_ref.id === code.system_code_id && admission.submitted_artifact_digest === code.artifact_digest && code.created_at <= admission.decided_at && commitment.candidate_ref.id === run.candidate_ref.id && commitment.candidate_version_ref.id === run.candidate_version_ref.id && commitment.trading_run_ref.id === run.trading_run_id && commitment.system_code_ref.id === code.system_code_id && evaluation.candidate_ref.id === commitment.candidate_ref.id && evaluation.candidate_version_ref.id === commitment.candidate_version_ref.id && evaluation.trading_run_ref.id === commitment.trading_run_ref.id && evaluation.paper_trading_evaluation_commitment_ref?.id === commitment.paper_trading_evaluation_commitment_id && evaluation.interval_ms === commitment.window_policy.interval_ms && value.observations.length === 0;
}

export function paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(value: unknown): value is PaperTradingComparisonStoppedQualificationClosure {
  if (!comparisonObject(value) || !comparisonSystemCode(value.systemCode) || !comparisonAdmission(value.admission) || !comparisonStoppedCommitment(value.commitment) || !comparisonStoppedEvaluation(value.evaluation) || !Array.isArray(value.observations) || !value.observations.every(comparisonStoppedObservation) || !paperTradingComparisonTradingPromotionHasRuntimeShape(value.promotion) || !comparisonIso(value.preparationCommittedAt)) return false;
  const { systemCode, admission, commitment, evaluation, promotion } = value;
  const observations = [...value.observations].sort((left, right) => left.sequence - right.sequence);
  if (admission.system_code_ref.id !== systemCode.system_code_id || admission.submitted_artifact_digest !== systemCode.artifact_digest || commitment.system_code_ref.id !== systemCode.system_code_id || commitment.system_code_artifact_digest !== systemCode.artifact_digest || !comparisonRuntimeIdentityMatchesSystemCode(commitment.runtime_identity, systemCode) || commitment.capability_policy_ref.id !== systemCode.capability_policy_ref.id || commitment.secret_policy_ref.id !== systemCode.secret_policy_ref.id) return false;
  if (evaluation.candidate_ref.id !== commitment.candidate_ref.id || evaluation.candidate_version_ref.id !== commitment.candidate_version_ref.id || evaluation.trading_run_ref.id !== commitment.trading_run_ref.id || evaluation.paper_trading_evaluation_commitment_ref?.id !== commitment.paper_trading_evaluation_commitment_id || evaluation.interval_ms !== commitment.window_policy.interval_ms || promotion.candidate_ref.id !== commitment.candidate_ref.id || promotion.candidate_version_ref.id !== commitment.candidate_version_ref.id || promotion.paper_trading_evaluation_ref.id !== evaluation.paper_trading_evaluation_id) return false;
  if (observations.length !== evaluation.observation_count || observations.some((item, index) => item.sequence !== index + 1 || item.paper_trading_evaluation_ref.id !== evaluation.paper_trading_evaluation_id || item.paper_trading_evaluation_commitment_ref?.id !== commitment.paper_trading_evaluation_commitment_id || item.candidate_ref.id !== commitment.candidate_ref.id || item.candidate_version_ref.id !== commitment.candidate_version_ref.id || item.trading_run_ref.id !== commitment.trading_run_ref.id || (index > 0 && item.observed_at < observations[index - 1]!.observed_at))) return false;
  const first = observations[0]?.observed_at ?? evaluation.started_at;
  const last = observations.at(-1)?.observed_at ?? evaluation.started_at;
  return systemCode.created_at <= admission.decided_at && admission.decided_at <= commitment.committed_at && commitment.committed_at <= evaluation.started_at && evaluation.started_at <= first && last <= evaluation.stopped_at! && evaluation.stopped_at! <= promotion.promoted_at && promotion.promoted_at <= value.preparationCommittedAt;
}

function comparisonSystemCode(value: unknown): value is SystemCodeRecord {
  return comparisonObject(value) && value.record_kind === "system_code" && value.version === 1 && comparisonString(value.system_code_id) && (value.artifact_kind === "python_file" ? value.runtime_kind === "python" && comparisonString(value.artifact_path) && value.image_ref === undefined : value.artifact_kind === "container_image" && value.runtime_kind === "container_image" && comparisonString(value.image_ref) && value.artifact_path === undefined) && comparisonString(value.artifact_digest) && Array.isArray(value.entrypoint) && value.entrypoint.length > 0 && value.entrypoint.every(comparisonString) && comparisonRef(value.capability_policy_ref, "capability_policy") && comparisonRef(value.secret_policy_ref, "secret_policy") && comparisonIso(value.created_at) && value.authority_status === "not_live";
}
function comparisonAdmission(value: unknown): value is CandidateAdmissionDecisionRecord {
  if (!comparisonObject(value) || value.record_kind !== "candidate_admission_decision" || value.version !== 1 || !comparisonString(value.candidate_admission_decision_id) || !comparisonRef(value.system_code_ref, "system_code") || !comparisonString(value.submitted_artifact_digest) || !comparisonIso(value.decided_at) || value.authority_status !== "not_live") return false;
  try { return isCandidateAdmissionDecisionConsistent(value as unknown as CandidateAdmissionDecisionRecord); } catch { return false; }
}
function comparisonAccount(value: unknown): value is PaperTradingAccountSnapshot {
  return comparisonObject(value) && ["wallet_balance_usdt", "available_balance_usdt", "equity_usdt", "realized_pnl_usdt", "unrealized_pnl_usdt", "fee_paid_usdt", "slippage_paid_usdt", "funding_paid_usdt", "margin_reserved_usdt"].every((key) => comparisonString(value[key])) && comparisonObject(value.position) && value.position.symbol === "BTCUSDT" && comparisonString(value.position.quantity) && ["long", "short", "flat"].includes(value.position.side as string) && comparisonString(value.position.mark_price) && comparisonString(value.position.notional_usdt) && comparisonNonNegative(value.open_order_count) && value.authority_status === "not_live";
}
function comparisonStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every(comparisonString); }
function comparisonOptionalRef(value: unknown): boolean { return value === undefined || comparisonRef(value); }
function comparisonOrder(value: unknown): boolean {
  return comparisonObject(value) && comparisonString(value.order_id) && comparisonString(value.event_id) &&
    (value.side === "buy" || value.side === "sell") && (value.order_type === "market" || value.order_type === "limit") &&
    comparisonString(value.quantity) && (value.limit_price === undefined || comparisonString(value.limit_price)) &&
    ["open", "partially_filled", "filled", "canceled", "rejected"].includes(value.status as string) &&
    comparisonString(value.cumulative_filled_quantity) && comparisonString(value.remaining_quantity) &&
    (value.average_fill_price === undefined || comparisonString(value.average_fill_price)) &&
    comparisonIso(value.created_at) && comparisonIso(value.updated_at) && comparisonOptionalRef(value.ledger_ref);
}
function comparisonFill(value: unknown): boolean {
  return value === undefined || comparisonObject(value) && comparisonString(value.fill_id) && comparisonString(value.order_id) &&
    (value.fill_status === "partially_filled" || value.fill_status === "filled") && comparisonString(value.fill_price) &&
    comparisonString(value.fill_quantity) && comparisonString(value.fee_usdt) && comparisonString(value.slippage_usdt) &&
    comparisonString(value.funding_usdt) && comparisonIso(value.trade_time) &&
    (value.source_trade_id === undefined || comparisonString(value.source_trade_id));
}
function comparisonMarketSnapshot(value: unknown): boolean {
  return value === undefined || comparisonObject(value) && value.symbol === "BTCUSDT" && comparisonFinite(value.price) &&
    (value.moving_average_fast === undefined || comparisonFinite(value.moving_average_fast)) &&
    (value.moving_average_slow === undefined || comparisonFinite(value.moving_average_slow)) &&
    (value.volatility === undefined || comparisonFinite(value.volatility)) &&
    (value.expected_direction === undefined || ["long", "short", "flat"].includes(value.expected_direction as string)) &&
    comparisonIso(value.observed_at) && comparisonMarketSource(value.source_kind) &&
    (value.source_priority === undefined || ["websocket_primary", "rest_fallback", "hybrid_recovered"].includes(value.source_priority as string)) &&
    (value.freshness === undefined || ["fresh", "stale", "recovering", "unavailable"].includes(value.freshness as string)) &&
    [value.ws_connected, value.rest_fallback_used, value.gap_detected].every((item) => item === undefined || typeof item === "boolean") &&
    (value.last_update_id === undefined || comparisonString(value.last_update_id)) &&
    (value.stream_marker === undefined || comparisonString(value.stream_marker)) && value.authority_status === "read_only";
}
function comparisonMarketSource(value: unknown): boolean { return ["binance_production_public_rest", "binance_production_public_websocket", "binance_production_public_hybrid", "binance_production_public_stream"].includes(value as string); }
function comparisonMarketSourcePriority(value: unknown): boolean {
  return ["websocket_primary", "rest_fallback", "hybrid_recovered"].includes(value as string);
}
function comparisonOrderBook(value: unknown): boolean {
  return value === undefined || comparisonObject(value) && value.symbol === "BTCUSDT" && comparisonIso(value.observed_at) && comparisonMarketSource(value.source_kind) &&
    ["not_started", "buffering", "synced", "recovering", "stale"].includes(value.sync_status as string) &&
    [value.last_update_id, value.previous_final_update_id, value.top_bid_price, value.top_bid_quantity, value.top_ask_price, value.top_ask_quantity].every((item) => item === undefined || comparisonString(item)) &&
    (value.depth_level_count === undefined || comparisonNonNegative(value.depth_level_count)) && typeof value.gap_detected === "boolean" && value.authority_status === "read_only";
}
function comparisonPublicExecution(value: unknown): boolean {
  if (value === undefined) return true;
  if (!comparisonObject(value) || value.symbol !== "BTCUSDT" || !comparisonIso(value.observed_at) || !comparisonMarketSource(value.source_kind) || !comparisonString(value.stream_marker) || !Array.isArray(value.agg_trades) || value.authority_status !== "read_only") return false;
  const ticker = value.book_ticker;
  return (ticker === undefined || comparisonObject(ticker) && comparisonString(ticker.bid_price) && comparisonString(ticker.bid_quantity) && comparisonString(ticker.ask_price) && comparisonString(ticker.ask_quantity) && (ticker.event_time === undefined || comparisonString(ticker.event_time))) &&
    value.agg_trades.every((trade) => comparisonObject(trade) && comparisonString(trade.trade_id) && comparisonString(trade.price) && comparisonString(trade.quantity) && comparisonString(trade.trade_time) && (trade.is_buyer_maker === undefined || typeof trade.is_buyer_maker === "boolean")) && comparisonOrderBook(value.order_book) &&
    (value.source_priority === undefined || ["websocket_primary", "rest_fallback", "hybrid_recovered"].includes(value.source_priority as string)) &&
    (value.freshness === undefined || ["fresh", "stale", "recovering", "unavailable"].includes(value.freshness as string)) &&
    [value.ws_connected, value.rest_fallback_used, value.gap_detected].every((item) => item === undefined || typeof item === "boolean") && (value.last_update_id === undefined || comparisonString(value.last_update_id));
}
function comparisonDecision(value: unknown): boolean {
  if (value === undefined) return true;
  if (!comparisonObject(value) || !["order_request", "hold", "no_action", "cancel_order", "error"].includes(value.decision_kind as string) || value.source_kind !== "trading_system_decision" || typeof value.reason !== "string" || !comparisonIso(value.observed_at) || value.authority_status !== "trace_only") return false;
  if (value.order_request === undefined) return value.decision_kind !== "order_request";
  return value.decision_kind === "order_request" && comparisonObject(value.order_request) && value.order_request.intent_kind === "place_order" && value.order_request.symbol === "BTCUSDT" && (value.order_request.side === "buy" || value.order_request.side === "sell") && (value.order_request.order_type === "market" || value.order_request.order_type === "limit") && comparisonString(value.order_request.quantity) && (value.order_request.limit_price === undefined || comparisonString(value.order_request.limit_price));
}
function comparisonRuntimeIdentityMatchesSystemCode(value: unknown, code: SystemCodeRecord): boolean {
  return comparisonObject(value) && value.artifact_kind === code.artifact_kind && value.runtime_kind === code.runtime_kind && semanticEqual(value.entrypoint, code.entrypoint) && ((value.artifact_runtime_contract_ref === undefined && code.artifact_runtime_contract_ref === undefined) || paperTradingComparisonRefsEqual(value.artifact_runtime_contract_ref, code.artifact_runtime_contract_ref));
}
function comparisonProvider(value: unknown): boolean {
  return comparisonObject(value) && typeof value.qualification_eligible === "boolean" && (value.runtime_provider_kind === "none" ? value.agent_profile_ref === undefined && value.model === undefined && value.provider_configuration_digest === undefined : value.runtime_provider_kind === "managed_agent" && comparisonRef(value.agent_profile_ref, "agent_profile") && comparisonString(value.model) && comparisonString(value.provider_configuration_digest));
}
function comparisonCommitmentBase(value: unknown, evidencePurpose?: PaperTradingEvidencePurpose): value is PaperTradingEvaluationCommitmentRecord {
  if (!comparisonObject(value) || !comparisonObject(value.runtime_identity) || !comparisonObject(value.data_identity) || !comparisonObject(value.window_policy)) return false;
  const runtime = value.runtime_identity;
  const runtimePair = runtime.artifact_kind === "python_file" ? runtime.runtime_kind === "python" : runtime.artifact_kind === "container_image" && runtime.runtime_kind === "container_image";
  return value.record_kind === "paper_trading_evaluation_commitment" && value.version === 1 && comparisonString(value.paper_trading_evaluation_commitment_id) && (evidencePurpose === undefined || value.evidence_purpose === evidencePurpose) && comparisonRef(value.candidate_ref, "trading_system_candidate") && comparisonRef(value.candidate_version_ref, "candidate_version") && comparisonRef(value.trading_run_ref, "trading_run") && comparisonRef(value.system_code_ref, "system_code") && comparisonString(value.system_code_artifact_digest) && comparisonString(value.resolved_artifact_digest) && runtimePair && comparisonStringArray(runtime.entrypoint) && runtime.entrypoint.length > 0 && (runtime.artifact_runtime_contract_ref === undefined || comparisonRef(runtime.artifact_runtime_contract_ref, "artifact_runtime_contract")) && comparisonProvider(value.provider_identity) && comparisonRef(value.capability_policy_ref, "capability_policy") && comparisonRef(value.secret_policy_ref, "secret_policy") && comparisonPolicyIdentity(value.policy_identity) && value.data_identity.symbol === "BTCUSDT" && value.data_identity.market_data_port === "gateway_owned" && comparisonMarketSource(value.data_identity.allowed_market_data_source) && comparisonString(value.data_identity.market_data_configuration_digest) && value.data_identity.private_exchange_access === "forbidden" && value.data_identity.live_order_access === "forbidden" && comparisonPositive(value.window_policy.interval_ms) && ["closed_observation", "sealed_until_adjudication"].includes(value.window_policy.release_policy as string) && comparisonString(value.window_policy.eligibility_policy_version) && comparisonAccount(value.initial_account_snapshot) && comparisonIso(value.committed_at) && comparisonString(value.commitment_digest) && value.authority_status === "not_live";
}
function comparisonInertCommitment(value: unknown): value is PaperTradingEvaluationCommitmentRecord { return comparisonCommitmentBase(value, "qualification") && value.window_policy.release_policy === "sealed_until_adjudication" && value.provider_identity.qualification_eligible === true && semanticEqual(value.initial_account_snapshot, PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT); }
function comparisonStoppedCommitment(value: unknown): value is PaperTradingEvaluationCommitmentRecord { return comparisonCommitmentBase(value, "qualification") && value.window_policy.release_policy === "sealed_until_adjudication" && value.provider_identity.qualification_eligible === true; }
function comparisonScore(value: unknown): value is TradingProfitLossReadModel { return comparisonObject(value) && ["revenue_usdt", "cost_usdt", "net_revenue_usdt", "net_return_pct"].every((key) => comparisonFinite(value[key])); }
function comparisonInertEvaluation(value: unknown): value is PaperTradingEvaluationRecord { return comparisonObject(value) && value.record_kind === "paper_trading_evaluation" && value.version === 1 && comparisonString(value.paper_trading_evaluation_id) && comparisonRef(value.candidate_ref, "trading_system_candidate") && comparisonRef(value.candidate_version_ref, "candidate_version") && comparisonRef(value.trading_run_ref, "trading_run") && comparisonRef(value.paper_trading_evaluation_commitment_ref, "paper_trading_evaluation_commitment") && value.status === "not_started" && comparisonPositive(value.interval_ms) && value.observation_count === 0 && comparisonIso(value.started_at) && comparisonScore(value.latest_score) && semanticEqual(value.latest_score, PAPER_TRADING_COMPARISON_ZERO_SCORE) && comparisonAccount(value.paper_account_snapshot) && semanticEqual(value.paper_account_snapshot, PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT) && Array.isArray(value.open_orders) && value.open_orders.length === 0 && Array.isArray(value.processed_trading_system_event_ids) && value.processed_trading_system_event_ids.length === 0 && Array.isArray(value.processed_public_trade_ids) && value.processed_public_trade_ids.length === 0 && value.last_observed_at === undefined && value.stopped_at === undefined && value.authority_status === "not_live"; }
function comparisonStoppedEvaluation(value: unknown): value is PaperTradingEvaluationRecord { return comparisonObject(value) && value.record_kind === "paper_trading_evaluation" && value.version === 1 && comparisonString(value.paper_trading_evaluation_id) && comparisonRef(value.candidate_ref, "trading_system_candidate") && comparisonRef(value.candidate_version_ref, "candidate_version") && comparisonRef(value.trading_run_ref, "trading_run") && comparisonRef(value.paper_trading_evaluation_commitment_ref, "paper_trading_evaluation_commitment") && value.status === "stopped" && comparisonPositive(value.interval_ms) && comparisonNonNegative(value.observation_count) && comparisonIso(value.started_at) && comparisonIso(value.last_observed_at) && value.next_observation_at === undefined && comparisonIso(value.stopped_at) && comparisonScore(value.latest_score) && comparisonAccount(value.paper_account_snapshot) && Array.isArray(value.open_orders) && value.open_orders.every(comparisonOrder) && comparisonFill(value.latest_fill) && comparisonStringArray(value.processed_trading_system_event_ids) && comparisonStringArray(value.processed_public_trade_ids) && comparisonPublicExecution(value.latest_public_execution_snapshot) && value.invalidation_reason === undefined && (value.latest_failure_reason === undefined || comparisonString(value.latest_failure_reason)) && value.authority_status === "not_live"; }
function comparisonStoppedObservation(value: unknown): value is PaperTradingObservationRecord { return comparisonObject(value) && value.record_kind === "paper_trading_observation" && value.version === 1 && comparisonString(value.paper_trading_observation_id) && comparisonRef(value.paper_trading_evaluation_ref, "paper_trading_evaluation") && comparisonRef(value.paper_trading_evaluation_commitment_ref, "paper_trading_evaluation_commitment") && comparisonRef(value.candidate_ref, "trading_system_candidate") && comparisonRef(value.candidate_version_ref, "candidate_version") && comparisonRef(value.trading_run_ref, "trading_run") && comparisonPositive(value.sequence) && ["recorded", "no_order", "failed"].includes(value.status as string) && comparisonIso(value.observed_at) && comparisonMarketSnapshot(value.market_snapshot) && comparisonPublicExecution(value.public_execution_snapshot) && comparisonDecision(value.decision) && comparisonOptionalRef(value.ledger_ref) && (value.paper_account_snapshot === undefined || comparisonAccount(value.paper_account_snapshot)) && (value.open_orders === undefined || Array.isArray(value.open_orders) && value.open_orders.every(comparisonOrder)) && comparisonFill(value.latest_fill) && (value.processed_trading_system_event_ids === undefined || comparisonStringArray(value.processed_trading_system_event_ids)) && (value.processed_public_trade_ids === undefined || comparisonStringArray(value.processed_public_trade_ids)) && comparisonScore(value.score_delta) && comparisonScore(value.cumulative_score) && (value.failure_reason === undefined || comparisonString(value.failure_reason)) && value.authority_status === "not_live"; }

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
  paper_evidence_purpose?: PaperTradingEvidencePurpose;
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

export type CandidateArenaResearchAllocationMode =
  | "adaptive_default"
  | "static_control"
  | "explicit";

export type CandidateArenaResearchSelectionKind =
  | "focus"
  | "exploration"
  | "static_control"
  | "explicit";

export interface CandidateArenaResearchAllocationPolicy {
  policy_kind: "bounded_adaptive_v1";
  default_direction_slot_count: 3;
  maximum_focus_direction_count: 2;
  minimum_exploration_direction_count: 1;
  concurrency_limit: 2;
  focus_experiment_budget: 2;
  exploration_experiment_budget: 1;
  explicit_experiment_budget: 1;
  maximum_total_experiment_budget: 5;
}

export const CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY = {
  policy_kind: "bounded_adaptive_v1",
  default_direction_slot_count: 3,
  maximum_focus_direction_count: 2,
  minimum_exploration_direction_count: 1,
  concurrency_limit: 2,
  focus_experiment_budget: 2,
  exploration_experiment_budget: 1,
  explicit_experiment_budget: 1,
  maximum_total_experiment_budget: 5
} as const satisfies CandidateArenaResearchAllocationPolicy;

export interface CandidateArenaResearchAllocationSignal {
  direction_kind: ResearchDirectionKind;
  finding_pressure_score: number;
  research_efficiency_score: number;
  recent_outcome_score: number;
  focus_score: number;
  completed_selection_count: number;
  last_completed_allocation_ref?: Ref;
  source_candidate_ids: string[];
  source_tick_ids: string[];
  reasons: string[];
}

export interface CandidateArenaResearchAllocationSelection {
  direction_kind: ResearchDirectionKind;
  selection_kind: CandidateArenaResearchSelectionKind;
  priority: number;
  experiment_budget: number;
  signal_score: number;
  reasons: string[];
}

export interface CandidateArenaResearchAllocationRecord extends BaseRecord {
  record_kind: "candidate_arena_research_allocation";
  candidate_arena_research_allocation_id: string;
  tick_id: string;
  allocation_mode: CandidateArenaResearchAllocationMode;
  policy: CandidateArenaResearchAllocationPolicy;
  source_tick_refs: Ref[];
  signal_snapshot: CandidateArenaResearchAllocationSignal[];
  selected_directions: CandidateArenaResearchAllocationSelection[];
  deferred_directions: ResearchDirectionKind[];
  allocated_at: string;
  allocation_digest: string;
  research_scheduling_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface CandidateArenaResearchAllocationReadModel {
  allocation_id: string;
  tick_id: string;
  allocation_mode: CandidateArenaResearchAllocationMode;
  policy: CandidateArenaResearchAllocationPolicy;
  selected_directions: CandidateArenaResearchAllocationSelection[];
  deferred_directions: ResearchDirectionKind[];
  allocated_at: string;
  research_scheduling_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

const CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS = [
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "execution_cost_robustness"
] as const satisfies readonly ResearchDirectionKind[];

const CANDIDATE_ARENA_RESEARCH_DIRECTIONS = new Set<ResearchDirectionKind>([
  ...CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS,
  "liquidation_aware_risk",
  "other"
]);

export function candidateArenaResearchAllocationDigestInput(
  record: CandidateArenaResearchAllocationRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    candidate_arena_research_allocation_id: _id,
    allocation_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function candidateArenaResearchAllocationHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "candidate_arena_research_allocation_id",
    "tick_id",
    "allocation_mode",
    "policy",
    "source_tick_refs",
    "signal_snapshot",
    "selected_directions",
    "deferred_directions",
    "allocated_at",
    "allocation_digest",
    "research_scheduling_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "candidate_arena_research_allocation" ||
    value.version !== 1 ||
    !comparisonString(value.candidate_arena_research_allocation_id) ||
    !comparisonString(value.tick_id) ||
    !candidateArenaResearchAllocationMode(value.allocation_mode) ||
    !candidateArenaResearchAllocationPolicyHasRuntimeShape(value.policy) ||
    !Array.isArray(value.source_tick_refs) ||
    value.source_tick_refs.some((item) =>
      !comparisonRef(item, "candidate_arena_tick")
    ) || !candidateArenaAllocationStringsUnique(
      value.source_tick_refs.map((item) => item.id)
    ) ||
    !Array.isArray(value.signal_snapshot) ||
    !value.signal_snapshot.every(candidateArenaResearchAllocationSignalHasRuntimeShape) ||
    !Array.isArray(value.selected_directions) ||
    !value.selected_directions.every(
      candidateArenaResearchAllocationSelectionHasRuntimeShape
    ) || !Array.isArray(value.deferred_directions) ||
    !value.deferred_directions.every(candidateArenaResearchDirection) ||
    !candidateArenaAllocationStringsUnique(value.deferred_directions) ||
    !comparisonIso(value.allocated_at) ||
    !comparisonDigest(value.allocation_digest) ||
    value.research_scheduling_authority !== true ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }

  const allocation = value as unknown as CandidateArenaResearchAllocationRecord;
  const selectedDirections = allocation.selected_directions.map(
    (selection) => selection.direction_kind
  );
  if (!candidateArenaAllocationStringsUnique(selectedDirections) ||
    allocation.selected_directions.some(
      (selection, index) => selection.priority !== index + 1
    ) || allocation.selected_directions.reduce(
      (total, selection) => total + selection.experiment_budget,
      0
    ) > allocation.policy.maximum_total_experiment_budget) {
    return false;
  }

  if (allocation.allocation_mode === "explicit") {
    const expectedDeferred = CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS.filter(
      (direction) => !selectedDirections.includes(direction)
    );
    return allocation.signal_snapshot.length === 0 &&
      allocation.source_tick_refs.length === 0 &&
      allocation.selected_directions.length >= 1 &&
      allocation.selected_directions.length <= 5 &&
      allocation.selected_directions.every((selection) =>
        selection.selection_kind === "explicit" &&
        selection.experiment_budget ===
          allocation.policy.explicit_experiment_budget &&
        selection.signal_score === 0
      ) && arraysEqual(allocation.deferred_directions, expectedDeferred);
  }

  if (!arraysEqual(
    allocation.signal_snapshot.map((signal) => signal.direction_kind),
    CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS
  )) {
    return false;
  }
  const combinedDefaultDirections = [
    ...selectedDirections,
    ...allocation.deferred_directions
  ];
  if (combinedDefaultDirections.length !==
      CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS.length ||
    !CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS.every((direction) =>
      combinedDefaultDirections.includes(direction)
    ) || !candidateArenaAllocationStringsUnique(combinedDefaultDirections)) {
    return false;
  }

  if (allocation.allocation_mode === "static_control") {
    return arraysEqual(
      selectedDirections,
      CANDIDATE_ARENA_DEFAULT_RESEARCH_DIRECTIONS.slice(0, 3)
    ) && allocation.selected_directions.every((selection, index) =>
      selection.selection_kind === "static_control" &&
      selection.experiment_budget === (index < 2 ? 2 : 1) &&
      selection.signal_score === 0
    );
  }

  const focusSelections = allocation.selected_directions.filter(
    (selection) => selection.selection_kind === "focus"
  );
  const explorationSelections = allocation.selected_directions.filter(
    (selection) => selection.selection_kind === "exploration"
  );
  return allocation.selected_directions.length ===
      allocation.policy.default_direction_slot_count &&
    focusSelections.length <= allocation.policy.maximum_focus_direction_count &&
    explorationSelections.length >=
      allocation.policy.minimum_exploration_direction_count &&
    focusSelections.every((selection) =>
      selection.experiment_budget === allocation.policy.focus_experiment_budget
    ) && explorationSelections.every((selection) =>
      selection.experiment_budget ===
        allocation.policy.exploration_experiment_budget
    ) && allocation.selected_directions.every((selection) =>
      selection.selection_kind === "focus" ||
      selection.selection_kind === "exploration"
    );
}

function candidateArenaResearchAllocationMode(
  value: unknown
): value is CandidateArenaResearchAllocationMode {
  return value === "adaptive_default" ||
    value === "static_control" ||
    value === "explicit";
}

function candidateArenaResearchAllocationPolicyHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_kind",
    "default_direction_slot_count",
    "maximum_focus_direction_count",
    "minimum_exploration_direction_count",
    "concurrency_limit",
    "focus_experiment_budget",
    "exploration_experiment_budget",
    "explicit_experiment_budget",
    "maximum_total_experiment_budget"
  ]) && Object.entries(CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY).every(
    ([key, expected]) => value[key] === expected
  );
}

function candidateArenaResearchAllocationSignalHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationSignal {
  const keys = [
    "direction_kind",
    "finding_pressure_score",
    "research_efficiency_score",
    "recent_outcome_score",
    "focus_score",
    "completed_selection_count",
    "source_candidate_ids",
    "source_tick_ids",
    "reasons"
  ];
  if (comparisonObject(value) && Object.hasOwn(
    value,
    "last_completed_allocation_ref"
  )) {
    keys.push("last_completed_allocation_ref");
  }
  return comparisonObject(value) && comparisonHasExactKeys(value, keys) &&
    candidateArenaResearchDirection(value.direction_kind) &&
    comparisonFinite(value.finding_pressure_score) &&
    comparisonFinite(value.research_efficiency_score) &&
    comparisonFinite(value.recent_outcome_score) &&
    comparisonFinite(value.focus_score) &&
    value.focus_score === value.finding_pressure_score +
      value.research_efficiency_score + value.recent_outcome_score &&
    comparisonNonNegative(value.completed_selection_count) &&
    (value.last_completed_allocation_ref === undefined || comparisonRef(
      value.last_completed_allocation_ref,
      "candidate_arena_research_allocation"
    )) && stringArray(value.source_candidate_ids) &&
    stringArray(value.source_tick_ids) && stringArray(value.reasons);
}

function candidateArenaResearchAllocationSelectionHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationSelection {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "direction_kind",
    "selection_kind",
    "priority",
    "experiment_budget",
    "signal_score",
    "reasons"
  ]) && candidateArenaResearchDirection(value.direction_kind) &&
    (value.selection_kind === "focus" ||
      value.selection_kind === "exploration" ||
      value.selection_kind === "static_control" ||
      value.selection_kind === "explicit") &&
    comparisonPositive(value.priority) &&
    comparisonPositive(value.experiment_budget) &&
    comparisonFinite(value.signal_score) &&
    stringArray(value.reasons) && value.reasons.length > 0;
}

function candidateArenaResearchDirection(
  value: unknown
): value is ResearchDirectionKind {
  return typeof value === "string" &&
    CANDIDATE_ARENA_RESEARCH_DIRECTIONS.has(value as ResearchDirectionKind);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(comparisonString) &&
    candidateArenaAllocationStringsUnique(value);
}

function candidateArenaAllocationStringsUnique(
  values: readonly string[]
): boolean {
  return new Set(values).size === values.length;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
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
  | "evidence_authority"
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
  admission_decision_id?: string;
  admission_reason?: CandidateAdmissionReason;
  net_revenue_usdt?: number;
  research_efficiency?: CandidateArenaResearchEfficiencyReadModel;
  paper_handoff_conformance?: {
    conformance_id: string;
    status: PaperTradingHandoffConformanceStatus;
    reason: PaperTradingHandoffConformanceReason;
    authority_status: "research_only";
  };
}

export interface CandidateArenaTickReadModel {
  tick_id: string;
  started_at: string;
  completed_at: string;
  status: CandidateArenaTickStatus;
  source_candidate?: CandidateArenaTickSourceReadModel;
  created_candidate_ids: string[];
  direction_results: CandidateArenaTickDirectionResultReadModel[];
  research_allocation?: CandidateArenaResearchAllocationReadModel;
  paper_trading_continuation?: CandidateArenaTickPaperTradingContinuationReadModel;
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
  research_allocation_ref?: Ref;
  research_allocation_digest?: string;
  paper_trading_continuation?: CandidateArenaTickPaperTradingContinuationReadModel;
  authority_status: "not_live";
}

export interface CandidateArenaTickPaperTradingContinuationReadModel {
  status: CandidateArenaTickPaperTradingContinuationStatus;
  command_kind: "trading_run.start";
  selected_candidate_id?: string;
  error?: string;
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
  | "failed"
  | "invalidated";

export type PaperTradingEvaluationFreezeStatus =
  | "committed"
  | "verified"
  | "invalidated";

export interface PaperTradingEvaluationReadModel {
  evaluation_kind: "paper_trading_evaluation";
  evaluation_id?: string;
  status: PaperTradingEvaluationStatus;
  evidence_purpose?: PaperTradingEvidencePurpose;
  commitment_id?: string;
  commitment_digest?: string;
  freeze_status?: PaperTradingEvaluationFreezeStatus;
  invalidation_reason?: PaperTradingEvaluationInvalidationReason;
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
  | "prospective_comparison_required"
  | "paper_failed"
  | "not_qualification_evidence"
  | "invalidated"
  | "not_evaluated";

export type PaperTradingQualificationStatus =
  | "collecting_evidence"
  | "qualified"
  | "needs_resume"
  | "blocked_by_quality"
  | "paper_failed"
  | "not_qualification_evidence";

export type PaperTradingQualificationReason =
  | "min_observation_count_not_met"
  | "min_elapsed_ms_not_met"
  | "runner_inactive_for_running_evaluation"
  | "paper_observation_chain_incomplete"
  | "paper_score_account_mismatch"
  | "failed_observation_ratio_exceeded"
  | "latest_market_snapshot_missing"
  | "fill_public_execution_evidence_missing"
  | "paper_evaluation_failed"
  | "evidence_purpose_not_qualification"
  | "provider_identity_not_qualification_eligible"
  | "paper_evaluation_commitment_missing"
  | "paper_evaluation_invalidated";

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
  evidence_purpose?: PaperTradingEvidencePurpose;
  commitment_id?: string;
  commitment_digest?: string;
  freeze_status?: PaperTradingEvaluationFreezeStatus;
  invalidation_reason?: PaperTradingEvaluationInvalidationReason;
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

export interface TradingPromotionComparisonConfirmation {
  basis_kind: "paper_trading_comparison_confirmation";
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  final_verdict_ref: Ref;
  final_verdict_digest: string;
}

export interface TradingPromotionComparisonConfirmationReadModel {
  campaign_id: string;
  campaign_outcome_id: string;
  final_verdict_id: string;
  required_window_count: number;
  improved_window_count: number;
  primary_metric: "net_revenue_usdt";
  minimum_net_revenue_lift_usdt: number;
  evaluated_at: string;
  evaluation_authority: "external_to_trading_systems";
  authority_status: "not_live";
}

export interface TradingPromotionRecord extends BaseRecord {
  record_kind: "trading_promotion";
  trading_promotion_id: string;
  status: "promoted_for_trading_review";
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  comparison_confirmation: TradingPromotionComparisonConfirmation;
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
  comparison_confirmation?: TradingPromotionComparisonConfirmationReadModel;
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
  | "evidence_authority"
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
    comparison_confirmation?: TradingPromotionComparisonConfirmationReadModel;
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
  comparison_confirmation?: TradingPromotionComparisonConfirmationReadModel;
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
  | ResearchPreflightCommitmentRecord
  | TradingEvaluationTaskRecord
  | TradingEvaluationResultRecord
  | PaperTradingHandoffConformanceRecord
  | CandidateAdmissionDecisionRecord
  | PaperTradingEvaluationCommitmentRecord
  | PaperTradingComparisonPreparationRecord
  | PaperTradingComparisonCommitmentRecord
  | PaperTradingComparisonTickRecord
  | PaperTradingComparisonTickDeliveryRecord
  | PaperTradingComparisonTickAcknowledgementRecord
  | PaperTradingComparisonActivationRecord
  | PaperTradingComparisonActivationAttemptRecord
  | PaperTradingComparisonActivationSideResultRecord
  | PaperTradingComparisonActivationOutcomeRecord
  | PaperTradingComparisonCheckpointAttemptRecord
  | PaperTradingComparisonCheckpointOutcomeRecord
  | PaperTradingEvaluationRecord
  | PaperTradingObservationRecord
  | CandidateArenaResearchAllocationRecord
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
