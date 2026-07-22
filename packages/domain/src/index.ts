import type {
  PrivateReadinessPolicyDecision,
  PrivateReadinessPolicyGateInput
} from "./private-readiness-policy";
import type { PrivateReadGateDecision } from "./private-read-gate";
import {
  isCandidateAdmissionDecisionConsistent,
  type CandidateAdmissionBehaviorComparisonStatus,
  type CandidateAdmissionDecisionRecord,
  type CandidateAdmissionReason,
  type CandidateAdmissionResearchWorkerOutcome,
  type CandidateAdmissionStatus
} from "./candidate-admission-policy";
import {
  candidateEgressAttestationHasRuntimeShape,
  type CandidateEgressAttestation
} from "./candidate-egress-attestation";
import type { RuntimeSupervisorReadModel } from "./runtime-supervisor";

export * from "./private-read-gate";
export * from "./private-readiness-policy";
export * from "./candidate-admission-policy";
export * from "./candidate-egress-attestation";
export * from "./runtime-supervisor";

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

export const RESEARCH_DIRECTION_KINDS = [
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "liquidation_aware_risk",
  "execution_cost_robustness",
  "other"
] as const satisfies readonly ResearchDirectionKind[];

export type ResearchWorkerStatus = "active" | "failed" | "retired";

export type CandidateArenaTickStatus = "completed" | "completed_with_errors" | "failed";

export type CandidateArenaDirectionResultStatus =
  | "created"
  | "duplicate"
  | "quarantined"
  | "no_submission"
  | "failed";

export type CandidateArenaTickPaperTradingContinuationStatus =
  | "started"
  | "queued"
  | "failed";

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
  agent_profile_id?: string;
  research_direction_ref: Ref;
  sandbox_policy_ref?: Ref;
  budget_policy_ref?: Ref;
  workspace_key?: string;
  lifecycle_protocol?: "research_worker_checkpoint_v1";
  created_at: string;
  status: ResearchWorkerStatus;
  authority_status: "research_only";
}

export interface ResearchEvidenceArtifactRecord extends BaseRecord {
  record_kind: "research_evidence_artifact";
  research_evidence_artifact_id: string;
  source_kind: Exclude<
    ResearchEvidenceArtifactSourceKind,
    "live_result" | "live_trace"
  >;
  subject_ref: Ref;
  artifact_ref: Ref;
  source_digest: string;
  summary: string;
  supporting_record_refs: Ref[];
  captured_at: string;
  sanitization_policy: "research_evidence_sanitization_v1";
  sanitization_status: "sanitized";
  qualification_evidence_hidden: true;
  secrets_removed: true;
  host_paths_removed: true;
  truncated: boolean;
  artifact_digest: string;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface ResearchEvidenceBinding {
  evidence_artifact_ref: Ref & {
    record_kind: "research_evidence_artifact";
  };
  evidence_artifact_digest: string;
}

export interface ResearchPreflightMethodology {
  direction_kind: ResearchDirectionKind;
  hypothesis: string;
  method: string;
  source_candidate_id?: string;
  evidence_bindings: ResearchEvidenceBinding[];
}

export function researchEvidenceArtifactDigestInput(
  record: ResearchEvidenceArtifactRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_evidence_artifact_id: _id,
    artifact_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchEvidenceArtifactHasRuntimeShape(
  value: unknown
): value is ResearchEvidenceArtifactRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_evidence_artifact_id",
    "source_kind",
    "subject_ref",
    "artifact_ref",
    "source_digest",
    "summary",
    "supporting_record_refs",
    "captured_at",
    "sanitization_policy",
    "sanitization_status",
    "qualification_evidence_hidden",
    "secrets_removed",
    "host_paths_removed",
    "truncated",
    "artifact_digest",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ])) {
    return false;
  }
  return value.record_kind === "research_evidence_artifact" &&
    value.version === 1 &&
    comparisonString(value.research_evidence_artifact_id) &&
    researchEvidenceArtifactSourceKind(value.source_kind) &&
    comparisonRef(value.subject_ref) &&
    comparisonRef(value.artifact_ref) &&
    researchEvidenceArtifactRefMatchesSource(
      value.source_kind,
      value.artifact_ref
    ) &&
    comparisonDigest(value.source_digest) &&
    comparisonString(value.summary) &&
    value.summary.length <= 4_000 &&
    value.summary === sanitizeResearchEvidenceText(value.summary) &&
    Array.isArray(value.supporting_record_refs) &&
    value.supporting_record_refs.every((item) => comparisonRef(item)) &&
    researchRefsUnique(value.supporting_record_refs) &&
    comparisonIso(value.captured_at) &&
    value.sanitization_policy === "research_evidence_sanitization_v1" &&
    value.sanitization_status === "sanitized" &&
    value.qualification_evidence_hidden === true &&
    value.secrets_removed === true &&
    value.host_paths_removed === true &&
    typeof value.truncated === "boolean" &&
    comparisonDigest(value.artifact_digest) &&
    value.promotion_authority === false &&
    value.order_submission_authority === false &&
    value.live_exchange_authority === false &&
    value.authority_status === "research_only";
}

function researchEvidenceArtifactSourceKind(
  value: unknown
): value is ResearchEvidenceArtifactRecord["source_kind"] {
  return value === "arena_paper_result" || value === "arena_trace" ||
    value === "arena_failure" || value === "research_finding";
}

function researchEvidenceArtifactRefMatchesSource(
  sourceKind: unknown,
  value: unknown
): boolean {
  if (sourceKind === "arena_paper_result" || sourceKind === "arena_failure") {
    return comparisonRef(value, "paper_trading_evaluation");
  }
  if (sourceKind === "arena_trace") {
    return comparisonRef(value, "paper_trading_observation");
  }
  if (sourceKind === "research_finding") {
    return comparisonRef(value, "research_finding");
  }
  return false;
}

export function sanitizeResearchEvidenceText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(
      /-----BEGIN ([^-\r\n]+)-----[\s\S]*?-----END \1-----/g,
      "[redacted-key-material]"
    )
    .replace(
      /\b((?:Proxy-)?Authorization\s*:\s*)(?:Basic|Bearer)\s+[^\s,;]+/gi,
      "$1[redacted]"
    )
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi, "$1 [redacted]")
    .replace(/\b(?:https?|wss?|file):\/\/[^\s<>"']+/gi, "[external-url]")
    .replace(/(^|[^\\])\\\\(?!\\)[^\s<>"']+/g, "$1[private-path]")
    .replace(/\b[A-Za-z]:[\\\/](?![\\\/])[^\s<>"']+/g, "[private-path]")
    .replace(/(^|[^A-Za-z0-9._~\/-])\/(?!\/)[^\s<>"']+/g, "$1[private-path]")
    .replace(
      /(^|[^A-Za-z0-9_])(["']?(?:(?:[A-Za-z][A-Za-z0-9_-]*[_-])?(?:api[_-]?key|api[_-]?secret|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|credential))["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,}\]]+)/gi,
      "$1$2[redacted]"
    );
}

export function canonicalResearchEvidenceArtifactSummary(
  sourceKind: ResearchEvidenceArtifactRecord["source_kind"],
  source: ResearchFindingRecord | PaperTradingObservationRecord |
    PaperTradingEvaluationRecord
): string {
  if (sourceKind === "arena_paper_result" &&
    source.record_kind === "paper_trading_evaluation") {
    return sanitizeResearchEvidenceText([
      `Arena paper result: net ${source.latest_score.net_revenue_usdt} USDT`,
      `revenue ${source.latest_score.revenue_usdt} USDT`,
      `cost ${source.latest_score.cost_usdt} USDT`,
      `return ${source.latest_score.net_return_pct}%`,
      `observations ${source.observation_count}`,
      `status ${source.status}`
    ].join("; ") + ".");
  }
  if (sourceKind === "arena_failure" &&
    source.record_kind === "paper_trading_evaluation") {
    return sanitizeResearchEvidenceText(
      `Arena paper failure: status ${source.status}; ` +
        `observations ${source.observation_count}.`
    );
  }
  if (sourceKind === "arena_trace" &&
    source.record_kind === "paper_trading_observation") {
    return sanitizeResearchEvidenceText([
      `Paper observation ${source.sequence}`,
      `status ${source.status}`,
      `decision ${source.decision?.decision_kind ?? "none"}`,
      `net ${source.cumulative_score.net_revenue_usdt} USDT`,
      `cost ${source.cumulative_score.cost_usdt} USDT`,
      `return ${source.cumulative_score.net_return_pct}%`
    ].join("; ") + ".");
  }
  if (sourceKind === "research_finding" &&
    source.record_kind === "research_finding") {
    return sanitizeResearchEvidenceText(
      `${source.finding_kind} ResearchFinding recorded for its bound ` +
        "worker and direction."
    );
  }
  throw new Error("research_evidence_artifact_summary_source_mismatch");
}

export function researchPreflightMethodologyHasRuntimeShape(
  value: unknown
): value is ResearchPreflightMethodology {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "direction_kind",
    "hypothesis",
    "method",
    ...(value.source_candidate_id === undefined
      ? []
      : ["source_candidate_id"]),
    "evidence_bindings"
  ]) || !candidateArenaResearchDirection(value.direction_kind) ||
    !comparisonString(value.hypothesis) || value.hypothesis.length > 2_000 ||
    value.hypothesis !== sanitizeResearchEvidenceText(value.hypothesis) ||
    !comparisonString(value.method) || value.method.length > 2_000 ||
    value.method !== sanitizeResearchEvidenceText(value.method) ||
    (value.source_candidate_id !== undefined &&
      !comparisonString(value.source_candidate_id)) ||
    !Array.isArray(value.evidence_bindings) ||
    value.evidence_bindings.length > 24) {
    return false;
  }
  const bindings = value.evidence_bindings;
  return bindings.every((binding) =>
    comparisonObject(binding) && comparisonHasExactKeys(binding, [
      "evidence_artifact_ref",
      "evidence_artifact_digest"
    ]) && comparisonRef(
      binding.evidence_artifact_ref,
      "research_evidence_artifact"
    ) && comparisonDigest(binding.evidence_artifact_digest)
  ) && researchRefsUnique(bindings.map((binding) =>
    binding.evidence_artifact_ref
  ));
}

function researchRefsUnique(refs: unknown[]): boolean {
  const keys = refs.map((item) => {
    if (!comparisonObject(item)) return "";
    return `${String(item.record_kind)}:${String(item.id)}`;
  });
  return keys.every(Boolean) && new Set(keys).size === keys.length;
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

export type ResearchWorkerMemoryMode =
  | "released_memory"
  | "memory_masked";

export interface ResearchWorkerMemoryControlAssignment {
  study_ref: Ref;
  study_digest: string;
  pair_index: number;
  arm_kind:
    | "released_memory_treatment"
    | "memory_masked_control";
}

export type ResearchWorkerMemoryPriorCheckpoint =
  | {
      disposition: "included" | "masked";
      checkpoint_ref: Ref;
      checkpoint_digest: string;
    }
  | { disposition: "none_available" };

export interface ResearchWorkerMemoryPolicy {
  protocol_version: "research_worker_memory_v1";
  memory_mode: ResearchWorkerMemoryMode;
  memory_source_digest: string;
  available_memory_item_count: number;
  arena_context_digest: string;
  prior_checkpoint: ResearchWorkerMemoryPriorCheckpoint;
  control_assignment?: ResearchWorkerMemoryControlAssignment;
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
  memory_policy?: ResearchWorkerMemoryPolicy;
  methodology?: ResearchPreflightMethodology;
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

export interface ResearchBehaviorFingerprintDecision {
  symbol: "BTCUSDT";
  side: "buy" | "sell" | "hold";
  quantity: number;
  order_type: "market" | "limit" | "none";
}

export interface ResearchBehaviorFingerprintObservation {
  scenario_id: string;
  decision: ResearchBehaviorFingerprintDecision;
}

export interface ResearchBehaviorFingerprintRecord extends BaseRecord {
  record_kind: "research_behavior_fingerprint";
  research_behavior_fingerprint_id: string;
  research_preflight_commitment_ref: Ref;
  research_preflight_commitment_digest: string;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  protocol_version: "research_behavior_fingerprint_v1";
  development_suite_version: "research_development_replay_v1";
  development_suite_digest: string;
  observations: ResearchBehaviorFingerprintObservation[];
  observation_count: number;
  fingerprint_digest: string;
  created_at: string;
  duplicate_detection_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export type ResearchWorkerCheckpointTerminalStatus = "completed" | "failed_closed";

export type ResearchWorkerCheckpointTerminalReason =
  | "admission_recorded"
  | "finished_without_submission"
  | "execution_failed"
  | "restart_recovery";

export interface ResearchWorkerCheckpointNotebookEntry {
  sequence: number;
  candidate_arena_tick_id: string;
  iteration: number;
  decision: "keep" | "discard" | "crash";
  agent_status: "edited" | "no_change" | "failed";
  score: number;
  summary: string;
  evaluation_status: "accepted" | "disqualified";
  risk_decision: "valid_order_request" | "invalid_order_request" | "no_order_request";
  net_revenue_usdt: number;
}

export interface ResearchWorkerCheckpointNotebook {
  protocol_version: "research_worker_notebook_v1";
  total_entry_count: number;
  recent_entries: ResearchWorkerCheckpointNotebookEntry[];
}

export interface ResearchWorkerCheckpointRecord extends BaseRecord {
  record_kind: "research_worker_checkpoint";
  research_worker_checkpoint_id: string;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  candidate_arena_tick_id: string;
  research_preflight_commitment_ref: Ref;
  research_preflight_commitment_digest: string;
  workspace_key: string;
  previous_checkpoint_ref?: Ref;
  previous_checkpoint_digest?: string;
  development_budget: {
    submission_limit: number;
    recorded_submission_count: number;
    cumulative_committed_submission_limit: number;
    cumulative_recorded_submission_count: number;
    remaining_submission_authority: 0;
  };
  notebook: ResearchWorkerCheckpointNotebook;
  terminal_status: ResearchWorkerCheckpointTerminalStatus;
  terminal_reason: ResearchWorkerCheckpointTerminalReason;
  candidate_admission_decision_ref?: Ref;
  closed_at: string;
  checkpoint_digest: string;
  notebook_continuation_authority: true;
  evaluation_authority: false;
  admission_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export function researchWorkerCheckpointDigestInput(
  record: ResearchWorkerCheckpointRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput({
    research_worker_checkpoint_id: record.research_worker_checkpoint_id,
    research_worker_ref: record.research_worker_ref,
    research_direction_ref: record.research_direction_ref,
    candidate_arena_tick_id: record.candidate_arena_tick_id,
    research_preflight_commitment_ref: record.research_preflight_commitment_ref,
    research_preflight_commitment_digest: record.research_preflight_commitment_digest,
    workspace_key: record.workspace_key,
    ...(record.previous_checkpoint_ref
      ? {
          previous_checkpoint_ref: record.previous_checkpoint_ref,
          previous_checkpoint_digest: record.previous_checkpoint_digest
        }
      : {}),
    development_budget: record.development_budget,
    notebook: record.notebook,
    terminal_status: record.terminal_status,
    terminal_reason: record.terminal_reason,
    ...(record.candidate_admission_decision_ref
      ? { candidate_admission_decision_ref: record.candidate_admission_decision_ref }
      : {}),
    closed_at: record.closed_at,
    notebook_continuation_authority: record.notebook_continuation_authority,
    evaluation_authority: record.evaluation_authority,
    admission_authority: record.admission_authority,
    promotion_authority: record.promotion_authority,
    order_submission_authority: record.order_submission_authority,
    live_exchange_authority: record.live_exchange_authority,
    authority_status: record.authority_status
  });
}

export function researchWorkerCheckpointHasRuntimeShape(
  value: unknown
): value is ResearchWorkerCheckpointRecord {
  if (!comparisonObject(value)) return false;
  const hasPreviousRef = Object.hasOwn(value, "previous_checkpoint_ref");
  const hasPreviousDigest = Object.hasOwn(value, "previous_checkpoint_digest");
  const hasAdmissionRef = Object.hasOwn(value, "candidate_admission_decision_ref");
  if (hasPreviousRef !== hasPreviousDigest || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_worker_checkpoint_id",
    "research_worker_ref",
    "research_direction_ref",
    "candidate_arena_tick_id",
    "research_preflight_commitment_ref",
    "research_preflight_commitment_digest",
    "workspace_key",
    ...(hasPreviousRef ? ["previous_checkpoint_ref", "previous_checkpoint_digest"] : []),
    "development_budget",
    "notebook",
    "terminal_status",
    "terminal_reason",
    ...(hasAdmissionRef ? ["candidate_admission_decision_ref"] : []),
    "closed_at",
    "checkpoint_digest",
    "notebook_continuation_authority",
    "evaluation_authority",
    "admission_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ])) {
    return false;
  }
  if (value.record_kind !== "research_worker_checkpoint" || value.version !== 1 ||
    !comparisonString(value.research_worker_checkpoint_id) ||
    !comparisonRef(value.research_worker_ref, "research_worker") ||
    !comparisonRef(value.research_direction_ref, "research_direction") ||
    !comparisonString(value.candidate_arena_tick_id) ||
    !comparisonRef(value.research_preflight_commitment_ref, "research_preflight_commitment") ||
    !researchPreflightSha256Digest(value.research_preflight_commitment_digest) ||
    !researchWorkerWorkspaceKey(value.workspace_key) ||
    (hasPreviousRef && (
      !comparisonRef(value.previous_checkpoint_ref, "research_worker_checkpoint") ||
      !researchPreflightSha256Digest(value.previous_checkpoint_digest)
    )) || !researchWorkerCheckpointBudgetHasRuntimeShape(value.development_budget) ||
    !researchWorkerCheckpointNotebookHasRuntimeShape(value.notebook) ||
    value.notebook.total_entry_count !==
      value.development_budget.cumulative_recorded_submission_count ||
    !researchWorkerCheckpointTerminalHasRuntimeShape(value, hasAdmissionRef) ||
    !comparisonIso(value.closed_at) ||
    !researchPreflightSha256Digest(value.checkpoint_digest) ||
    value.notebook_continuation_authority !== true ||
    value.evaluation_authority !== false ||
    value.admission_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  return true;
}

function researchWorkerWorkspaceKey(value: unknown): value is string {
  return typeof value === "string" &&
    /^candidate-arena-workers\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value);
}

function researchWorkerCheckpointBudgetHasRuntimeShape(value: unknown): value is
  ResearchWorkerCheckpointRecord["development_budget"] {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "submission_limit",
    "recorded_submission_count",
    "cumulative_committed_submission_limit",
    "cumulative_recorded_submission_count",
    "remaining_submission_authority"
  ]) || !comparisonPositive(value.submission_limit) ||
    !comparisonNonNegative(value.recorded_submission_count) ||
    value.recorded_submission_count > value.submission_limit ||
    !comparisonPositive(value.cumulative_committed_submission_limit) ||
    value.cumulative_committed_submission_limit < value.submission_limit ||
    !comparisonNonNegative(value.cumulative_recorded_submission_count) ||
    value.cumulative_recorded_submission_count < value.recorded_submission_count ||
    value.cumulative_recorded_submission_count > value.cumulative_committed_submission_limit ||
    value.remaining_submission_authority !== 0) {
    return false;
  }
  return true;
}

function researchWorkerCheckpointNotebookHasRuntimeShape(value: unknown): value is
  ResearchWorkerCheckpointNotebook {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "protocol_version",
    "total_entry_count",
    "recent_entries"
  ]) || value.protocol_version !== "research_worker_notebook_v1" ||
    !comparisonNonNegative(value.total_entry_count) ||
    !Array.isArray(value.recent_entries) ||
    value.recent_entries.length !== Math.min(value.total_entry_count, 6)) {
    return false;
  }
  const firstSequence = value.total_entry_count - value.recent_entries.length + 1;
  return value.recent_entries.every((entry, index) =>
    researchWorkerCheckpointNotebookEntryHasRuntimeShape(entry) &&
    entry.sequence === firstSequence + index
  );
}

function researchWorkerCheckpointNotebookEntryHasRuntimeShape(
  value: unknown
): value is ResearchWorkerCheckpointNotebookEntry {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "sequence",
    "candidate_arena_tick_id",
    "iteration",
    "decision",
    "agent_status",
    "score",
    "summary",
    "evaluation_status",
    "risk_decision",
    "net_revenue_usdt"
  ]) && comparisonPositive(value.sequence) &&
    comparisonString(value.candidate_arena_tick_id) &&
    comparisonPositive(value.iteration) &&
    (value.decision === "keep" || value.decision === "discard" || value.decision === "crash") &&
    (value.agent_status === "edited" || value.agent_status === "no_change" ||
      value.agent_status === "failed") &&
    comparisonFinite(value.score) && comparisonString(value.summary) &&
    value.summary.length <= 500 &&
    (value.evaluation_status === "accepted" || value.evaluation_status === "disqualified") &&
    (value.risk_decision === "valid_order_request" ||
      value.risk_decision === "invalid_order_request" ||
      value.risk_decision === "no_order_request") &&
    comparisonFinite(value.net_revenue_usdt);
}

function researchWorkerCheckpointTerminalHasRuntimeShape(
  value: Record<string, unknown>,
  hasAdmissionRef: boolean
): boolean {
  if (value.terminal_status === "completed") {
    return value.terminal_reason === "admission_recorded"
      ? hasAdmissionRef &&
        comparisonRef(value.candidate_admission_decision_ref, "candidate_admission_decision")
      : value.terminal_reason === "finished_without_submission" && !hasAdmissionRef;
  }
  return value.terminal_status === "failed_closed" &&
    (value.terminal_reason === "execution_failed" || value.terminal_reason === "restart_recovery") &&
    !hasAdmissionRef;
}

export function researchBehaviorFingerprintDigestInput(
  record: ResearchBehaviorFingerprintRecord
): string {
  return paperTradingComparisonPersistedRecordDigestInput({
    protocol_version: record.protocol_version,
    development_suite_version: record.development_suite_version,
    development_suite_digest: record.development_suite_digest,
    observations: record.observations
  });
}

export function researchBehaviorFingerprintHasRuntimeShape(
  value: unknown
): value is ResearchBehaviorFingerprintRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_behavior_fingerprint_id",
    "research_preflight_commitment_ref",
    "research_preflight_commitment_digest",
    "system_code_ref",
    "system_code_artifact_digest",
    "protocol_version",
    "development_suite_version",
    "development_suite_digest",
    "observations",
    "observation_count",
    "fingerprint_digest",
    "created_at",
    "duplicate_detection_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_behavior_fingerprint" ||
    value.version !== 1 ||
    !comparisonString(value.research_behavior_fingerprint_id) ||
    !comparisonRef(
      value.research_preflight_commitment_ref,
      "research_preflight_commitment"
    ) || !researchPreflightSha256Digest(value.research_preflight_commitment_digest) ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !researchPreflightSha256Digest(value.system_code_artifact_digest) ||
    value.protocol_version !== "research_behavior_fingerprint_v1" ||
    value.development_suite_version !== "research_development_replay_v1" ||
    !researchPreflightSha256Digest(value.development_suite_digest) ||
    !Array.isArray(value.observations)) {
    return false;
  }
  const observations = value.observations;
  if (observations.length === 0 ||
    !observations.every(researchBehaviorFingerprintObservationHasRuntimeShape) ||
    !comparisonPositive(value.observation_count) ||
    value.observation_count !== observations.length ||
    !researchPreflightSha256Digest(value.fingerprint_digest) ||
    !comparisonIso(value.created_at) ||
    value.duplicate_detection_authority !== true ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  return observations.every((observation, index) =>
    index === 0 || observations[index - 1]!.scenario_id < observation.scenario_id
  );
}

function researchBehaviorFingerprintObservationHasRuntimeShape(
  value: unknown
): value is ResearchBehaviorFingerprintObservation {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "scenario_id",
    "decision"
  ]) && comparisonString(value.scenario_id) &&
    researchBehaviorFingerprintDecisionHasRuntimeShape(value.decision);
}

function researchBehaviorFingerprintDecisionHasRuntimeShape(
  value: unknown
): value is ResearchBehaviorFingerprintDecision {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "symbol",
    "side",
    "quantity",
    "order_type"
  ]) || value.symbol !== "BTCUSDT" ||
    !["buy", "sell", "hold"].includes(value.side as string) ||
    !comparisonNonNegativeFinite(value.quantity) ||
    !["market", "limit", "none"].includes(value.order_type as string)) {
    return false;
  }
  return value.side === "hold"
    ? value.order_type === "none" && Object.is(value.quantity, 0)
    : (value.order_type === "market" || value.order_type === "limit") &&
      value.quantity > 0;
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
  if (!comparisonObject(value)) return false;
  const hasMemoryPolicy = Object.hasOwn(value, "memory_policy");
  const hasMethodology = Object.hasOwn(value, "methodology");
  if (!comparisonHasExactKeys(value, [
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
    ...(hasMemoryPolicy ? ["memory_policy"] : []),
    ...(hasMethodology ? ["methodology"] : []),
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
    (hasMemoryPolicy && !researchWorkerMemoryPolicyHasRuntimeShape(
      value.memory_policy
    )) ||
    (hasMethodology && !researchPreflightMethodologyHasRuntimeShape(
      value.methodology
    )) ||
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

export function researchWorkerMemoryPolicyHasRuntimeShape(
  value: unknown
): value is ResearchWorkerMemoryPolicy {
  if (!comparisonObject(value)) return false;
  const hasAssignment = Object.hasOwn(value, "control_assignment");
  if (!comparisonHasExactKeys(value, [
    "protocol_version",
    "memory_mode",
    "memory_source_digest",
    "available_memory_item_count",
    "arena_context_digest",
    "prior_checkpoint",
    ...(hasAssignment ? ["control_assignment"] : [])
  ]) || value.protocol_version !== "research_worker_memory_v1" ||
    (value.memory_mode !== "released_memory" &&
      value.memory_mode !== "memory_masked") ||
    !researchPreflightSha256Digest(value.memory_source_digest) ||
    !comparisonNonNegative(value.available_memory_item_count) ||
    !Number.isInteger(value.available_memory_item_count) ||
    !researchPreflightSha256Digest(value.arena_context_digest) ||
    !researchWorkerMemoryPriorCheckpointHasRuntimeShape(
      value.prior_checkpoint,
      value.memory_mode
    ) || (hasAssignment && !researchWorkerMemoryControlAssignmentHasRuntimeShape(
      value.control_assignment,
      value.memory_mode
    ))) {
    return false;
  }
  return true;
}

function researchWorkerMemoryPriorCheckpointHasRuntimeShape(
  value: unknown,
  memoryMode: ResearchWorkerMemoryMode
): value is ResearchWorkerMemoryPriorCheckpoint {
  if (!comparisonObject(value) || typeof value.disposition !== "string") {
    return false;
  }
  if (value.disposition === "none_available") {
    return comparisonHasExactKeys(value, ["disposition"]);
  }
  return (memoryMode === "released_memory"
      ? value.disposition === "included"
      : value.disposition === "masked") && comparisonHasExactKeys(value, [
    "disposition",
    "checkpoint_ref",
    "checkpoint_digest"
  ]) && comparisonRef(value.checkpoint_ref, "research_worker_checkpoint") &&
    researchPreflightSha256Digest(value.checkpoint_digest);
}

function researchWorkerMemoryControlAssignmentHasRuntimeShape(
  value: unknown,
  memoryMode: ResearchWorkerMemoryMode
): value is ResearchWorkerMemoryControlAssignment {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "study_ref",
    "study_digest",
    "pair_index",
    "arm_kind"
  ]) || !comparisonRef(value.study_ref, "research_memory_control_study") ||
    !researchPreflightSha256Digest(value.study_digest) ||
    !comparisonPositive(value.pair_index) ||
    !Number.isInteger(value.pair_index) || value.pair_index > 30) {
    return false;
  }
  return memoryMode === "released_memory"
    ? value.arm_kind === "released_memory_treatment"
    : value.arm_kind === "memory_masked_control";
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

interface PaperTradingHandoffConformanceRecordFields {
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

export interface PaperTradingHandoffConformanceRecordV1 extends
  PaperTradingHandoffConformanceRecordFields {
  version: 1;
}

export interface PaperTradingHandoffConformanceRecordV2 extends
  Omit<PaperTradingHandoffConformanceRecordFields, "runner_kind"> {
  version: 2;
  runner_kind: "docker_sandboxes_sbx";
  candidate_egress_attestation: CandidateEgressAttestation;
}

export type PaperTradingHandoffConformanceRecord =
  | PaperTradingHandoffConformanceRecordV1
  | PaperTradingHandoffConformanceRecordV2;

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
  if (value.version === 2) {
    expectedKeys.push("candidate_egress_attestation");
  }
  if (!comparisonHasExactKeys(value, expectedKeys)) {
    return false;
  }
  if (
    value.record_kind !== "paper_trading_handoff_conformance" ||
    (value.version !== 1 && value.version !== 2) ||
    !comparisonString(value.paper_trading_handoff_conformance_id) ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !comparisonDigest(value.system_code_artifact_digest) ||
    !comparisonRef(value.experiment_run_ref, "experiment_run") ||
    !comparisonRef(value.trading_evaluation_task_ref, "trading_evaluation_task") ||
    value.protocol_version !== "paper_trading_event_protocol_v1" ||
    (value.version === 1 &&
      value.runner_kind !== "host_process" &&
      value.runner_kind !== "docker_sandboxes_sbx") ||
    (value.version === 2 &&
      (value.runner_kind !== "docker_sandboxes_sbx" ||
        !candidateEgressAttestationHasRuntimeShape(
          value.candidate_egress_attestation
        ))) ||
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
  selected_development_submission_sequence?: number;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
  quarantine_reason?: TradingEvaluationQuarantineReason;
  completed_at: string;
  authority_status: "not_counted" | "counted";
}

export function tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(
  value: unknown
): value is TradingEvaluationResultRecord {
  if (!comparisonObject(value)) return false;
  const linkageKeys = [
    "research_preflight_commitment_ref",
    "research_preflight_commitment_digest",
    "submitted_system_code_ref",
    "submitted_artifact_digest",
    "sealed_admission_suite_digest",
    "evaluation_phase",
    "submission_sequence"
  ] as const;
  const presentCount = linkageKeys.filter((key) => Object.hasOwn(value, key)).length;
  if (presentCount === 0) {
    return !Object.hasOwn(value, "selected_development_submission_sequence");
  }
  const selectedSequence = value.selected_development_submission_sequence;
  return presentCount === linkageKeys.length &&
    comparisonRef(
      value.research_preflight_commitment_ref,
      "research_preflight_commitment"
    ) && researchPreflightSha256Digest(value.research_preflight_commitment_digest) &&
    comparisonRef(value.submitted_system_code_ref, "system_code") &&
    researchPreflightSha256Digest(value.submitted_artifact_digest) &&
    researchPreflightSha256Digest(value.sealed_admission_suite_digest) &&
    value.evaluation_phase === "sealed_admission" &&
    value.submission_sequence === 1 &&
    (selectedSequence === undefined ||
      (Number.isInteger(selectedSequence) && Number(selectedSequence) >= 1));
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

export type PaperTradingEvaluationRuntimeCoordinationStatus =
  | "arena_capacity_deferred";

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

export interface PaperTradingComparisonWindowClosureEvidence {
  protocol_version: "paper_trading_comparison_window_closure_v1";
  requested_at: string;
  tick_count: number;
  checkpoint_attempt_count: number;
  paired_checkpoint_count: number;
  latest_tick_ref: Ref;
  latest_tick_observed_at: string;
  latest_checkpoint_attempt_ref?: Ref;
  latest_checkpoint_outcome_ref?: Ref;
}

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
  window_closure?: PaperTradingComparisonWindowClosureEvidence;
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
  | "comparison_frozen_window_boundary_not_reached"
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
  "comparison_frozen_window_boundary_not_reached",
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

export function paperTradingComparisonWindowClosureEvidenceHasRuntimeShape(
  value: unknown
): value is PaperTradingComparisonWindowClosureEvidence {
  if (!comparisonObject(value)) return false;
  const expectedKeys = [
    "protocol_version",
    "requested_at",
    "tick_count",
    "checkpoint_attempt_count",
    "paired_checkpoint_count",
    "latest_tick_ref",
    "latest_tick_observed_at",
    ...(value.latest_checkpoint_attempt_ref === undefined
      ? []
      : ["latest_checkpoint_attempt_ref"]),
    ...(value.latest_checkpoint_outcome_ref === undefined
      ? []
      : ["latest_checkpoint_outcome_ref"])
  ];
  if (!comparisonHasExactKeys(value, expectedKeys) ||
    value.protocol_version !== "paper_trading_comparison_window_closure_v1" ||
    !comparisonIso(value.requested_at) ||
    !comparisonPositive(value.tick_count) ||
    !comparisonNonNegative(value.checkpoint_attempt_count) ||
    !comparisonNonNegative(value.paired_checkpoint_count) ||
    value.checkpoint_attempt_count > value.tick_count ||
    value.paired_checkpoint_count > value.checkpoint_attempt_count ||
    !comparisonRef(value.latest_tick_ref, "paper_trading_comparison_tick") ||
    !comparisonIso(value.latest_tick_observed_at) ||
    Date.parse(value.latest_tick_observed_at) > Date.parse(value.requested_at)) {
    return false;
  }
  if (value.checkpoint_attempt_count === 0) {
    return value.latest_checkpoint_attempt_ref === undefined &&
      value.latest_checkpoint_outcome_ref === undefined;
  }
  if (!comparisonRef(
    value.latest_checkpoint_attempt_ref,
    "paper_trading_comparison_checkpoint_attempt"
  )) return false;
  if (value.latest_checkpoint_outcome_ref !== undefined &&
    !comparisonRef(
      value.latest_checkpoint_outcome_ref,
      "paper_trading_comparison_checkpoint_outcome"
    )) return false;
  return value.paired_checkpoint_count !== value.checkpoint_attempt_count ||
    value.latest_checkpoint_outcome_ref !== undefined;
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
    (value.window_closure !== undefined &&
      !paperTradingComparisonWindowClosureEvidenceHasRuntimeShape(
        value.window_closure
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
  if (value.window_closure !== undefined &&
    (value.outcome_status !== "stopped_cleanly" ||
      value.outcome_reason !== "handoff_cleanup" ||
      Date.parse(value.window_closure.requested_at) >
        Date.parse(value.completed_at))) return false;
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
  runtime_coordination_status?:
    PaperTradingEvaluationRuntimeCoordinationStatus;
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
  const roundedRevenue = round(revenue);
  const roundedCost = round(cost);
  const net = round(roundedRevenue - roundedCost);
  return { revenue_usdt: roundedRevenue, cost_usdt: roundedCost, net_revenue_usdt: net, net_return_pct: round(net / initialEquity * 100) };
}
function qualificationSameScore(left: TradingProfitLossReadModel, right: TradingProfitLossReadModel): boolean { return left.revenue_usdt === right.revenue_usdt && left.cost_usdt === right.cost_usdt && left.net_revenue_usdt === right.net_revenue_usdt && left.net_return_pct === right.net_return_pct; }
function qualificationAccountEquityReconciles(account: PaperTradingAccountSnapshot, initialEquity: number): boolean {
  const values = [account.equity_usdt, account.realized_pnl_usdt, account.unrealized_pnl_usdt, account.fee_paid_usdt, account.slippage_paid_usdt, account.funding_paid_usdt].map(Number);
  if (!values.every(Number.isFinite)) return false;
  const [equity, realized, unrealized, fee, slippage, funding] = values as [number, number, number, number, number, number];
  return Math.abs((equity - initialEquity) - (realized + unrealized - fee - slippage - funding)) <= 0.000001;
}
function qualificationAccounting(evaluation: PaperTradingEvaluationRecord, commitment: PaperTradingEvaluationCommitmentRecord, observations: PaperTradingObservationRecord[]): boolean {
  const initial = Number(commitment.initial_account_snapshot.equity_usdt);
  if (!Number.isFinite(initial) || initial <= 0 || !qualificationSameScore(qualificationScore(commitment.initial_account_snapshot, initial), PAPER_TRADING_COMPARISON_ZERO_SCORE) || !qualificationAccountEquityReconciles(commitment.initial_account_snapshot, initial)) return false;
  let prior = PAPER_TRADING_COMPARISON_ZERO_SCORE;
  let account = commitment.initial_account_snapshot;
  for (const item of [...observations].sort((left, right) => left.sequence - right.sequence)) {
    const current = item.cumulative_score;
    const delta = { revenue_usdt: Math.round((current.revenue_usdt - prior.revenue_usdt) * 1_000_000) / 1_000_000, cost_usdt: Math.round((current.cost_usdt - prior.cost_usdt) * 1_000_000) / 1_000_000, net_revenue_usdt: Math.round((current.net_revenue_usdt - prior.net_revenue_usdt) * 1_000_000) / 1_000_000, net_return_pct: Math.round((current.net_return_pct - prior.net_return_pct) * 1_000_000) / 1_000_000 };
    if (![...Object.values(item.score_delta), ...Object.values(current)].every(Number.isFinite) || !qualificationSameScore(item.score_delta, delta)) return false;
    if (item.paper_account_snapshot) { if (!qualificationSameScore(qualificationScore(item.paper_account_snapshot, initial), current) || !qualificationAccountEquityReconciles(item.paper_account_snapshot, initial)) return false; account = item.paper_account_snapshot; }
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
  workspace_key?: string;
  generation?: number;
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
  development?: CandidateArenaResearchEfficiencyPhaseReadModel;
  sealed_admission?: CandidateArenaResearchEfficiencyPhaseReadModel;
  authority_status: "not_promotion_authority";
}

export interface CandidateArenaResearchEfficiencyPhaseReadModel {
  submission_count: number;
  provider_request_total: number;
  runner_command_total: number;
  scenario_count: number;
  elapsed_ms: number;
}

export type ResearchDiversityMeasurementStatus =
  | "insufficient_evidence"
  | "measured"
  | "incomparable_suites";

export interface ResearchDiversityDistributionReadModel {
  measurement_status: ResearchDiversityMeasurementStatus;
  sample_count: number;
  unique_count?: number;
  entropy_bits?: number;
  normalized_entropy?: number;
}

export interface ResearchPopulationDiversityObservedBehaviorReadModel
  extends ResearchDiversityDistributionReadModel {
  cohort_count: number;
  admitted_submission_count: number;
  exact_behavior_duplicate_count: number;
  artifact_duplicate_count: number;
  unavailable_fingerprint_count: number;
}

export interface ResearchPopulationDiversityDirectionReadModel {
  direction_kind: ResearchDirectionKind;
  attempt_count: number;
  observed_behavior_count: number;
  unique_behavior_count?: number;
  admitted_submission_count: number;
  exact_behavior_duplicate_count: number;
}

export interface ResearchPopulationDiversityTickReadModel {
  tick_id: string;
  completed_at: string;
  assigned_directions: ResearchDiversityDistributionReadModel;
  observed_behaviors: ResearchPopulationDiversityObservedBehaviorReadModel;
  evaluation_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}

export interface ResearchPopulationDiversityReadModel {
  protocol_version: "research_population_diversity_v1";
  window_tick_count: number;
  assigned_directions: ResearchDiversityDistributionReadModel;
  observed_behaviors: ResearchPopulationDiversityObservedBehaviorReadModel;
  by_direction: ResearchPopulationDiversityDirectionReadModel[];
  tick_series: ResearchPopulationDiversityTickReadModel[];
  evaluation_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}

export function researchPopulationDiversityHasRuntimeShape(
  value: unknown
): value is ResearchPopulationDiversityReadModel {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "protocol_version",
    "window_tick_count",
    "assigned_directions",
    "observed_behaviors",
    "by_direction",
    "tick_series",
    "evaluation_authority",
    "promotion_authority",
    "authority_status"
  ]) || value.protocol_version !== "research_population_diversity_v1" ||
    !comparisonNonNegative(value.window_tick_count) || value.window_tick_count > 10 ||
    !researchDiversityComparableDistributionHasRuntimeShape(
      value.assigned_directions,
      RESEARCH_DIRECTION_KINDS.length
    ) || !researchDiversityObservedBehaviorHasRuntimeShape(value.observed_behaviors) ||
    !Array.isArray(value.by_direction) ||
    !Array.isArray(value.tick_series) ||
    value.evaluation_authority !== false ||
    value.promotion_authority !== false ||
    value.authority_status !== "not_promotion_authority") {
    return false;
  }

  const readModel = value as unknown as ResearchPopulationDiversityReadModel;
  const behaviorIsComparable =
    readModel.observed_behaviors.measurement_status !== "incomparable_suites";
  if (!readModel.by_direction.every((row) =>
    researchPopulationDiversityDirectionHasRuntimeShape(row, behaviorIsComparable)
  )) {
    return false;
  }
  const directionIndexes = readModel.by_direction.map((row) =>
    RESEARCH_DIRECTION_KINDS.indexOf(row.direction_kind)
  );
  if (directionIndexes.some((index, position) =>
    index < 0 || (position > 0 && directionIndexes[position - 1]! >= index)
  )) {
    return false;
  }

  if (readModel.tick_series.length !== readModel.window_tick_count ||
    !readModel.tick_series.every(researchPopulationDiversityTickHasRuntimeShape) ||
    new Set(readModel.tick_series.map((tick) => tick.tick_id)).size !==
      readModel.tick_series.length ||
    readModel.tick_series.some((tick, index) => {
      const previous = readModel.tick_series[index - 1];
      return Boolean(previous) && (
        previous.completed_at < tick.completed_at ||
        (previous.completed_at === tick.completed_at && previous.tick_id < tick.tick_id)
      );
    })) {
    return false;
  }

  const attemptCount = readModel.by_direction.reduce(
    (total, row) => total + row.attempt_count,
    0
  );
  const behaviorCount = readModel.by_direction.reduce(
    (total, row) => total + row.observed_behavior_count,
    0
  );
  const admittedCount = readModel.by_direction.reduce(
    (total, row) => total + row.admitted_submission_count,
    0
  );
  const duplicateCount = readModel.by_direction.reduce(
    (total, row) => total + row.exact_behavior_duplicate_count,
    0
  );
  const tickAttemptCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.assigned_directions.sample_count
  );
  const tickBehaviorCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.observed_behaviors.sample_count
  );
  const tickAdmittedCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.observed_behaviors.admitted_submission_count
  );
  const tickDuplicateCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.observed_behaviors.exact_behavior_duplicate_count
  );
  const tickArtifactDuplicateCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.observed_behaviors.artifact_duplicate_count
  );
  const tickUnavailableCount = sumResearchPopulationDiversityTicks(
    readModel.tick_series,
    (tick) => tick.observed_behaviors.unavailable_fingerprint_count
  );
  return attemptCount === readModel.assigned_directions.sample_count &&
    behaviorCount === readModel.observed_behaviors.sample_count &&
    admittedCount === readModel.observed_behaviors.admitted_submission_count &&
    duplicateCount === readModel.observed_behaviors.exact_behavior_duplicate_count &&
    readModel.observed_behaviors.artifact_duplicate_count <= attemptCount &&
    readModel.observed_behaviors.unavailable_fingerprint_count <= attemptCount &&
    admittedCount + duplicateCount +
      readModel.observed_behaviors.artifact_duplicate_count +
      readModel.observed_behaviors.unavailable_fingerprint_count <= attemptCount &&
    tickAttemptCount === attemptCount &&
    tickBehaviorCount === behaviorCount &&
    tickAdmittedCount === admittedCount &&
    tickDuplicateCount === duplicateCount &&
    tickArtifactDuplicateCount ===
      readModel.observed_behaviors.artifact_duplicate_count &&
    tickUnavailableCount === readModel.observed_behaviors.unavailable_fingerprint_count;
}

function researchPopulationDiversityTickHasRuntimeShape(
  value: unknown
): value is ResearchPopulationDiversityTickReadModel {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "tick_id",
    "completed_at",
    "assigned_directions",
    "observed_behaviors",
    "evaluation_authority",
    "promotion_authority",
    "authority_status"
  ]) || !comparisonString(value.tick_id) || !comparisonIso(value.completed_at) ||
    !researchDiversityComparableDistributionHasRuntimeShape(
      value.assigned_directions,
      RESEARCH_DIRECTION_KINDS.length
    ) || !researchDiversityObservedBehaviorHasRuntimeShape(value.observed_behaviors) ||
    value.evaluation_authority !== false || value.promotion_authority !== false ||
    value.authority_status !== "not_promotion_authority") {
    return false;
  }
  const tick = value as unknown as ResearchPopulationDiversityTickReadModel;
  const attemptCount = tick.assigned_directions.sample_count;
  const observed = tick.observed_behaviors;
  return observed.sample_count <= attemptCount &&
    observed.admitted_submission_count + observed.exact_behavior_duplicate_count +
      observed.artifact_duplicate_count + observed.unavailable_fingerprint_count <=
      attemptCount;
}

function sumResearchPopulationDiversityTicks(
  ticks: ResearchPopulationDiversityTickReadModel[],
  select: (tick: ResearchPopulationDiversityTickReadModel) => number
): number {
  return ticks.reduce((sum, tick) => sum + select(tick), 0);
}

function researchDiversityComparableDistributionHasRuntimeShape(
  value: unknown,
  maximumCategoryCount: number
): value is ResearchDiversityDistributionReadModel {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "measurement_status",
    "sample_count",
    "unique_count",
    "entropy_bits",
    "normalized_entropy"
  ]) || !comparisonNonNegative(value.sample_count) ||
    !comparisonNonNegative(value.unique_count) ||
    value.unique_count > Math.min(value.sample_count, maximumCategoryCount) ||
    !researchDiversityMetric(value.entropy_bits) ||
    !researchDiversityMetric(value.normalized_entropy) ||
    value.normalized_entropy > 1) {
    return false;
  }
  if (value.measurement_status === "insufficient_evidence") {
    return value.sample_count < 2 && value.unique_count === value.sample_count &&
      value.entropy_bits === 0 && value.normalized_entropy === 0;
  }
  if (value.measurement_status !== "measured" || value.sample_count < 2 ||
    value.unique_count < 1) {
    return false;
  }
  return value.entropy_bits <= Math.log2(value.unique_count) + 0.000001;
}

function researchDiversityObservedBehaviorHasRuntimeShape(
  value: unknown
): value is ResearchPopulationDiversityObservedBehaviorReadModel {
  if (!comparisonObject(value)) return false;
  const countKeys = [
    "cohort_count",
    "admitted_submission_count",
    "exact_behavior_duplicate_count",
    "artifact_duplicate_count",
    "unavailable_fingerprint_count"
  ];
  if (!countKeys.every((key) => comparisonNonNegative(value[key]))) return false;

  if (value.measurement_status === "incomparable_suites") {
    return comparisonHasExactKeys(value, [
      "measurement_status",
      "sample_count",
      ...countKeys
    ]) && comparisonNonNegative(value.sample_count) &&
      Number(value.cohort_count) > 1 &&
      Number(value.cohort_count) <= value.sample_count;
  }
  if (!comparisonHasExactKeys(value, [
    "measurement_status",
    "sample_count",
    "unique_count",
    "entropy_bits",
    "normalized_entropy",
    ...countKeys
  ]) || !researchDiversityComparableDistributionHasRuntimeShape({
    measurement_status: value.measurement_status,
    sample_count: value.sample_count,
    unique_count: value.unique_count,
    entropy_bits: value.entropy_bits,
    normalized_entropy: value.normalized_entropy
  }, Number.MAX_SAFE_INTEGER)) {
    return false;
  }
  return value.sample_count === 0
    ? value.cohort_count === 0
    : value.cohort_count === 1;
}

function researchPopulationDiversityDirectionHasRuntimeShape(
  value: unknown,
  requireUniqueBehaviorCount: boolean
): value is ResearchPopulationDiversityDirectionReadModel {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "direction_kind",
    "attempt_count",
    "observed_behavior_count",
    ...(requireUniqueBehaviorCount ? ["unique_behavior_count"] : []),
    "admitted_submission_count",
    "exact_behavior_duplicate_count"
  ]) || !candidateArenaResearchDirection(value.direction_kind)) {
    return false;
  }
  const counts = [
    value.attempt_count,
    value.observed_behavior_count,
    ...(requireUniqueBehaviorCount ? [value.unique_behavior_count] : []),
    value.admitted_submission_count,
    value.exact_behavior_duplicate_count
  ];
  if (!counts.every(comparisonNonNegative)) return false;
  const row = value as unknown as ResearchPopulationDiversityDirectionReadModel;
  if (row.attempt_count === 0 ||
    row.observed_behavior_count > row.attempt_count ||
    (requireUniqueBehaviorCount &&
      row.unique_behavior_count! > row.observed_behavior_count) ||
    row.admitted_submission_count > row.attempt_count ||
    row.exact_behavior_duplicate_count > row.attempt_count ||
    row.admitted_submission_count + row.exact_behavior_duplicate_count >
      row.attempt_count) {
    return false;
  }
  return true;
}

function researchDiversityMetric(value: unknown): value is number {
  return comparisonNonNegativeFinite(value) &&
    Math.round(value * 1_000_000) / 1_000_000 === value;
}

export interface CandidateArenaResearchPreflightReadModel {
  commitment_id: string;
  development_submission_count: number;
  sealed_terminal_status: "accepted" | "rejected" | "not_run";
  reason:
    | "accepted"
    | "candidate_rejected"
    | "no_development_winner"
    | "execution_failed";
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

export type CandidateArenaResearchAllocationPolicyBasis =
  | {
      basis_kind: "explicit_request";
    }
  | {
      basis_kind: "repository_default";
    }
  | {
      basis_kind: "research_allocation_policy_decision";
      policy_decision_ref: Ref;
      policy_decision_digest: string;
      study_outcome_ref: Ref;
      study_outcome_digest: string;
    }
  | {
      basis_kind: "research_generalization_policy_decision";
      policy_decision_ref: Ref;
      policy_decision_digest: string;
      generalization_outcome_ref: Ref;
      generalization_outcome_digest: string;
    };

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
  allocation_policy_basis: CandidateArenaResearchAllocationPolicyBasis;
  trigger?: ResearchTriggerReadModel;
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
  allocation_policy_basis: CandidateArenaResearchAllocationPolicyBasis;
  trigger?: ResearchTriggerReadModel;
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
  ...RESEARCH_DIRECTION_KINDS
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

export function researchTriggerHasRuntimeShape(
  value: unknown
): value is ResearchTriggerReadModel {
  if (!comparisonObject(value)) return false;
  const hasSource = Object.hasOwn(value, "source_ref");
  const hasEvidenceRef = Object.hasOwn(value, "evidence_artifact_ref");
  const hasEvidenceDigest = Object.hasOwn(value, "evidence_artifact_digest");
  if (!comparisonHasExactKeys(value, [
    "trigger_kind",
    "trigger_id",
    "goal",
    "triggered_at",
    ...(hasSource ? ["source_ref"] : []),
    ...(hasEvidenceRef ? ["evidence_artifact_ref"] : []),
    ...(hasEvidenceDigest ? ["evidence_artifact_digest"] : []),
    "authority_status"
  ]) || !["goal", "time", "arena_event", "live_event", "recovery"].includes(
    value.trigger_kind as string
  ) || !comparisonString(value.trigger_id) ||
    !comparisonString(value.goal) || value.goal.length > 1_000 ||
    value.goal !== sanitizeResearchEvidenceText(value.goal) ||
    !comparisonIso(value.triggered_at) ||
    (hasSource && !comparisonRef(value.source_ref)) ||
    (hasEvidenceRef && !comparisonRef(
      value.evidence_artifact_ref,
      "research_evidence_artifact"
    )) || (hasEvidenceDigest && !comparisonDigest(
      value.evidence_artifact_digest
    )) || hasEvidenceRef !== hasEvidenceDigest ||
    (hasEvidenceRef && !hasSource) ||
    value.authority_status !== "research_only") {
    return false;
  }
  return value.trigger_kind !== "arena_event" &&
      value.trigger_kind !== "live_event" ||
    hasSource && hasEvidenceRef && hasEvidenceDigest;
}

export function candidateArenaResearchAllocationHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationRecord {
  if (!comparisonObject(value)) return false;
  const hasTrigger = Object.hasOwn(value, "trigger");
  const trigger = hasTrigger && researchTriggerHasRuntimeShape(value.trigger)
    ? value.trigger
    : undefined;
  if (!comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "candidate_arena_research_allocation_id",
    "tick_id",
    "allocation_mode",
    "allocation_policy_basis",
    ...(hasTrigger ? ["trigger"] : []),
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
    !candidateArenaResearchAllocationPolicyBasisHasRuntimeShape(
      value.allocation_policy_basis
    ) ||
    (hasTrigger && !trigger) ||
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
    (trigger && Date.parse(trigger.triggered_at) >
      Date.parse(value.allocated_at)) ||
    !comparisonDigest(value.allocation_digest) ||
    value.research_scheduling_authority !== true ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }

  const allocation = value as unknown as CandidateArenaResearchAllocationRecord;
  if ((allocation.allocation_mode === "static_control" ||
      allocation.allocation_mode === "explicit") &&
    allocation.allocation_policy_basis.basis_kind !== "explicit_request") {
    return false;
  }
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

function candidateArenaResearchAllocationPolicyBasisHasRuntimeShape(
  value: unknown
): value is CandidateArenaResearchAllocationPolicyBasis {
  if (!comparisonObject(value)) return false;
  if (value.basis_kind === "explicit_request" ||
    value.basis_kind === "repository_default") {
    return comparisonHasExactKeys(value, ["basis_kind"]);
  }
  if (value.basis_kind === "research_allocation_policy_decision") {
    return comparisonHasExactKeys(value, [
      "basis_kind",
      "policy_decision_ref",
      "policy_decision_digest",
      "study_outcome_ref",
      "study_outcome_digest"
    ]) && comparisonRef(
      value.policy_decision_ref,
      "research_allocation_policy_decision"
    ) && researchControlCampaignSha256Digest(
      value.policy_decision_digest
    ) && comparisonRef(
      value.study_outcome_ref,
      "research_control_study_outcome"
    ) && researchControlCampaignSha256Digest(value.study_outcome_digest);
  }
  return value.basis_kind === "research_generalization_policy_decision" &&
    comparisonHasExactKeys(value, [
      "basis_kind",
      "policy_decision_ref",
      "policy_decision_digest",
      "generalization_outcome_ref",
      "generalization_outcome_digest"
    ]) && comparisonRef(
      value.policy_decision_ref,
      "research_generalization_policy_decision"
    ) && researchControlCampaignSha256Digest(
      value.policy_decision_digest
    ) && comparisonRef(
      value.generalization_outcome_ref,
      "research_generalization_outcome"
    ) && researchControlCampaignSha256Digest(
      value.generalization_outcome_digest
    );
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

export type ResearchControlCampaignArmKind =
  | "adaptive_treatment"
  | "static_control";

export interface ResearchExperimentBaselineSnapshot {
  protocol_version: "local_store_regular_files_v1";
  snapshot_digest: string;
  regular_file_count: number;
  total_bytes: number;
  exclusion_policy:
    | "research_control_campaign_evidence_only"
    | "research_experiment_evidence_only";
}

export interface ResearchExperimentSource {
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  system_code_record_digest: string;
  research_artifact_protocol: "single_file_python_v1";
  research_artifact_closure_digest: string;
}

export interface ResearchExperimentAgentIdentity {
  provider: AgentProfileProviderKind;
  model?: string;
  permission_policy: "artifact_workspace_only" | "fixture_only";
  identity_digest: string;
}

export type ResearchMemoryControlArmKind =
  | "released_memory_treatment"
  | "memory_masked_control";

export interface ResearchMemoryControlArmPlan {
  arm_kind: ResearchMemoryControlArmKind;
  memory_mode: ResearchWorkerMemoryMode;
  tick_id: string;
}

export interface ResearchMemoryControlPairPlan {
  pair_index: number;
  research_direction_ref: Ref;
  direction_kind: ResearchDirectionKind;
  released_memory_treatment: ResearchMemoryControlArmPlan;
  memory_masked_control: ResearchMemoryControlArmPlan;
}

export interface ResearchMemoryControlOpportunityProtocol {
  development_suite_version: "research_development_replay_v1";
  development_suite_digest: string;
  sealed_suite_version: "research_sealed_admission_v1";
  sealed_generator_version: "research_scenario_generator_v1";
  sealed_rotation_commitment_digest: string;
  sealed_suite_digest: string;
}

export interface ResearchMemoryControlStudyPolicy {
  policy_version: "research_memory_control_study_v1";
  pair_count: number;
  allocation_mode: "explicit";
  development_submission_limit_per_worker: 1;
  sealed_submission_limit_per_worker: 1;
  baseline_copy_policy: "fresh_verified_copy_per_arm";
  within_pair_start_policy: "concurrent_initial_sides";
  maximum_within_pair_start_skew_ms: 5_000;
  across_pair_execution_policy: "sequential";
  maximum_baseline_regular_file_count: number;
  maximum_baseline_total_bytes: number;
}

export interface ResearchMemoryControlStudyAnalysisPolicy {
  policy_version: "paired_exact_repeat_sign_test_v1";
  primary_estimand:
    "mean_masked_minus_released_memory_exact_repeat_indicator";
  significance_method: "two_sided_exact_sign_test";
  alpha: 0.05;
  minimum_non_tied_pair_count: 6;
  tie_policy: "exclude_from_sign_test_include_in_mean";
  ineligible_pair_policy: "retain_in_counts_exclude_from_inference";
  minimum_mean_paired_difference: 0;
}

export interface ResearchMemoryControlStudyRecord extends BaseRecord {
  record_kind: "research_memory_control_study";
  research_memory_control_study_id: string;
  idempotency_key: string;
  hypothesis: "released_memory_reduces_exact_behavior_repeats";
  baseline: ResearchExperimentBaselineSnapshot;
  source: ResearchExperimentSource;
  research_agent: ResearchExperimentAgentIdentity;
  research_agent_profile_id: string;
  opportunity_protocol: ResearchMemoryControlOpportunityProtocol;
  pair_plans: ResearchMemoryControlPairPlan[];
  policy: ResearchMemoryControlStudyPolicy;
  analysis_policy: ResearchMemoryControlStudyAnalysisPolicy;
  committed_at: string;
  study_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  memory_policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export type ResearchMemoryControlArmTerminalStatus =
  | "completed"
  | "no_submission"
  | "worker_failed"
  | "platform_failed"
  | "interrupted";

export type ResearchMemoryControlFailureKind =
  | "research_worker_failed"
  | "provider_failed"
  | "runner_failed"
  | "restart_interrupted"
  | "evidence_reconstruction_failed";

export interface ResearchMemoryControlResourceSummary {
  provider_request_total: number;
  runner_command_total: number;
  scenario_count: number;
  elapsed_ms: number;
}

export interface ResearchMemoryControlTickEvidence {
  tick_ref: Ref;
  tick_id: string;
  tick_digest: string;
  started_at: string;
  completed_at: string;
  tick_status: CandidateArenaTickStatus;
  direction_result_status: CandidateArenaDirectionResultStatus;
}

export interface ResearchMemoryControlPreflightEvidence {
  commitment_ref: Ref;
  commitment_digest: string;
  development_suite_version: "research_development_replay_v1";
  development_suite_digest: string;
  sealed_suite_version: "research_sealed_admission_v1";
  sealed_generator_version: "research_scenario_generator_v1";
  sealed_suite_digest: string;
  sealed_rotation_commitment_digest: string;
  memory_policy: ResearchWorkerMemoryPolicy;
}

export interface ResearchMemoryControlWorkerEvidence {
  worker_ref: Ref;
  agent_profile_id: string;
  provider_kind: ProviderKind;
  model: string;
}

export interface ResearchMemoryControlAllocationEvidence {
  allocation_ref: Ref;
  allocation_digest: string;
  allocation_mode: "explicit";
  allocation_policy_digest: string;
  direction_kind: ResearchDirectionKind;
  selection_kind: "explicit";
  experiment_budget: 1;
}

export interface ResearchMemoryControlAdmissionEvidence {
  decision_ref: Ref;
  decision_digest: string;
  status: CandidateAdmissionStatus;
  reason: CandidateAdmissionReason;
  research_worker_outcome: CandidateAdmissionResearchWorkerOutcome;
  behavior_comparison_status:
    | CandidateAdmissionBehaviorComparisonStatus
    | null;
  fingerprint_ref: Ref | null;
  fingerprint_digest: string | null;
  matching_fingerprint_ref: Ref | null;
  matching_fingerprint_digest: string | null;
}

export type ResearchMemoryControlPairIneligibilityReason =
  | "no_submission"
  | "worker_or_platform_failure"
  | "behavior_fingerprint_unavailable"
  | "malformed_evidence_graph"
  | "missing_memory_contrast"
  | "interrupted_or_unpaired_run";

export type ResearchMemoryControlObservation =
  | "exact_repeat"
  | "distinct_behavior"
  | "ineligible";

export interface ResearchMemoryControlArmResult {
  arm_kind: ResearchMemoryControlArmKind;
  memory_mode: ResearchWorkerMemoryMode;
  planned_tick_id: string;
  terminal_status: ResearchMemoryControlArmTerminalStatus;
  failure_kind: ResearchMemoryControlFailureKind | null;
  tick_evidence: ResearchMemoryControlTickEvidence | null;
  preflight_evidence: ResearchMemoryControlPreflightEvidence | null;
  worker_evidence: ResearchMemoryControlWorkerEvidence | null;
  allocation_evidence: ResearchMemoryControlAllocationEvidence | null;
  admission_evidence: ResearchMemoryControlAdmissionEvidence | null;
  resource_summary: ResearchMemoryControlResourceSummary | null;
  observation: ResearchMemoryControlObservation;
  exact_repeat_indicator: 0 | 1 | null;
  ineligibility_reason: ResearchMemoryControlPairIneligibilityReason | null;
}

export interface ResearchMemoryControlPairOutcomeRecord extends BaseRecord {
  record_kind: "research_memory_control_pair_outcome";
  research_memory_control_pair_outcome_id: string;
  study_ref: Ref;
  study_digest: string;
  pair_index: number;
  pair_plan_digest: string;
  research_direction_ref: Ref;
  direction_kind: ResearchDirectionKind;
  released_memory: ResearchMemoryControlArmResult;
  memory_masked: ResearchMemoryControlArmResult;
  eligibility_status: "eligible" | "ineligible";
  ineligibility_reason: ResearchMemoryControlPairIneligibilityReason | null;
  initial_start_skew_ms: number | null;
  paired_difference: -1 | 0 | 1 | null;
  terminal_at: string;
  pair_outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  memory_policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export interface ResearchMemoryControlStudyPairResult {
  pair_index: number;
  pair_outcome_ref: Ref;
  pair_outcome_digest: string;
  eligibility_status: "eligible" | "ineligible";
  ineligibility_reason: ResearchMemoryControlPairIneligibilityReason | null;
  paired_difference: -1 | 0 | 1 | null;
}

export interface ResearchMemoryControlStudyOutcomeRecord extends BaseRecord {
  record_kind: "research_memory_control_study_outcome";
  research_memory_control_study_outcome_id: string;
  study_ref: Ref;
  study_digest: string;
  pair_results: ResearchMemoryControlStudyPairResult[];
  planned_pair_count: number;
  completed_pair_count: number;
  eligible_pair_count: number;
  ineligible_pair_count: number;
  favorable_pair_count: number;
  unfavorable_pair_count: number;
  tied_pair_count: number;
  non_tied_pair_count: number;
  mean_paired_difference: number | null;
  exact_sign_test_p_value: number;
  inference_status:
    | "memory_effect_supported"
    | "memory_effect_not_supported"
    | "insufficient_memory_control_evidence";
  causal_scope: "same_baseline_paired_exact_repeat_effect_only";
  memory_policy_decision_eligibility: "not_eligible";
  next_action:
    | "review_memory_evidence_without_automatic_policy_change"
    | "retain_current_memory_policy_and_redesign_study";
  adjudicated_at: string;
  study_outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  memory_policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export type ResearchControlCampaignPaperComparator =
  | {
      comparator_status: "trading_review";
      trading_promotion_ref: Ref;
      trading_promotion_digest: string;
      candidate_ref: Ref;
      candidate_version_ref: Ref;
      paper_trading_evaluation_ref: Ref;
    }
  | {
      comparator_status: "unavailable";
      reason: "no_trading_promotion_at_commitment";
    };

export interface ResearchControlCampaignPaperSchedulePolicy {
  policy_version: "research-control-paper-schedule-v1";
  source_start_order: "paired_by_sequence";
  maximum_active_source_pairs: 2;
  maximum_cross_arm_first_tick_skew_ms: number;
  source_missed_start_policy: "slot_expired";
  confirmation_precommit_deadline_ms: number;
}

export type ResearchControlCampaignPaperEvaluationProtocol =
  | {
      protocol_status: "bound";
      comparison_policy: PaperTradingComparisonPolicy;
      market_data_configuration_digest: string;
      paper_policy_identity: PaperTradingEvaluationPolicyIdentity;
      schedule_policy: ResearchControlCampaignPaperSchedulePolicy;
      protocol_digest: string;
    }
  | {
      protocol_status: "unavailable";
      reason:
        | "no_trading_promotion_at_commitment"
        | "paper_configuration_unavailable_at_commitment";
    };

export interface ResearchControlCampaignArm {
  arm_kind: ResearchControlCampaignArmKind;
  allocation_mode: "adaptive_default" | "static_control";
  research_control_campaign_arm_intent_id: string;
  tick_ids: string[];
}

export interface ResearchControlCampaignPolicy {
  policy_version: "research_control_campaign_v1";
  tick_count_per_arm: number;
  worker_slot_count_per_tick: 3;
  concurrency_limit_per_arm: 2;
  maximum_total_development_submissions_per_tick: 5;
  arm_execution_policy: "concurrent_per_sequence";
  maximum_baseline_regular_file_count: number;
  maximum_baseline_total_bytes: number;
  paper_candidate_slot_count_per_arm: number;
  paper_candidate_reservation_rule:
    "first_admitted_per_tick_in_allocation_order";
  primary_metric_kind:
    "prospective_qualified_candidate_discovery_rate";
  required_future_evidence: "confirmed_comparison_research_release";
}

export interface ResearchControlCampaignRecord extends BaseRecord {
  record_kind: "research_control_campaign";
  research_control_campaign_id: string;
  idempotency_key: string;
  hypothesis:
    "adaptive_allocation_improves_prospective_qualified_discovery_yield";
  baseline: ResearchExperimentBaselineSnapshot;
  source: ResearchExperimentSource;
  research_agent: ResearchExperimentAgentIdentity;
  paper_comparator: ResearchControlCampaignPaperComparator;
  paper_evaluation_protocol: ResearchControlCampaignPaperEvaluationProtocol;
  allocation_policy: CandidateArenaResearchAllocationPolicy;
  allocation_policy_digest: string;
  arms: [ResearchControlCampaignArm, ResearchControlCampaignArm];
  policy: ResearchControlCampaignPolicy;
  committed_at: string;
  campaign_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface ResearchControlCampaignArmIntentRecord extends BaseRecord {
  record_kind: "research_control_campaign_arm_intent";
  research_control_campaign_arm_intent_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  arm_kind: ResearchControlCampaignArmKind;
  allocation_mode: "adaptive_default" | "static_control";
  baseline_snapshot_digest: string;
  tick_ids: string[];
  committed_at: string;
  intent_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface ResearchControlCampaignDiagnostics {
  attempt_count: number;
  admitted_candidate_count: number;
  duplicate_count: number;
  quarantined_count: number;
  failed_count: number;
  provider_request_total: number;
  runner_command_total: number;
  scenario_count: number;
  elapsed_ms: number;
}

interface ResearchControlCampaignPaperCandidateSlotBase {
  sequence: number;
  tick_ref: Ref;
}

export type ResearchControlCampaignPaperCandidateSlot =
  | (ResearchControlCampaignPaperCandidateSlotBase & {
      status: "candidate_reserved";
      candidate_ref: Ref;
      candidate_version_ref: Ref;
      system_code_ref: Ref;
      system_code_artifact_digest: string;
      admission_decision_ref: Ref;
    })
  | (ResearchControlCampaignPaperCandidateSlotBase & {
      status: "no_admitted_candidate";
    });

export interface ResearchControlCampaignArmReport {
  arm_kind: ResearchControlCampaignArmKind;
  allocation_mode: "adaptive_default" | "static_control";
  arm_intent_ref: Ref;
  arm_intent_digest: string;
  tick_refs: Ref[];
  allocation_refs: Ref[];
  diagnostics: ResearchControlCampaignDiagnostics;
  population_diversity: ResearchPopulationDiversityReadModel;
  paper_candidate_slots: ResearchControlCampaignPaperCandidateSlot[];
  final_store_snapshot_digest: string;
  completed_at: string;
  research_diagnostics_authority: false;
  promotion_authority: false;
  authority_status: "not_promotion_authority";
}

export interface ResearchControlCampaignReportRecord extends BaseRecord {
  record_kind: "research_control_campaign_report";
  research_control_campaign_report_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  arms: [ResearchControlCampaignArmReport, ResearchControlCampaignArmReport];
  primary_outcome_status: "unadjudicated";
  causal_conclusion: "not_available_from_research_phase";
  next_action: "schedule_prospective_paper_slots";
  completed_at: string;
  report_digest: string;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

interface ResearchControlCampaignPaperScheduleSlotBase {
  sequence: number;
  tick_ref: Ref;
}

export type ResearchControlCampaignPaperScheduleSlot =
  | (ResearchControlCampaignPaperScheduleSlotBase & {
      slot_status: "no_admitted_candidate";
    })
  | (ResearchControlCampaignPaperScheduleSlotBase & {
      slot_status: "candidate_scheduled";
      candidate_ref: Ref;
      candidate_version_ref: Ref;
      system_code_ref: Ref;
      system_code_artifact_digest: string;
      admission_decision_ref: Ref;
      source_comparison_idempotency_key: string;
      source_preparation_id: string;
      source_comparison_commitment_id: string;
      maximum_source_start_delay_ms: number;
    });

export interface ResearchControlCampaignPaperScheduleArm {
  arm_kind: ResearchControlCampaignArmKind;
  slots: ResearchControlCampaignPaperScheduleSlot[];
}

export interface ResearchControlCampaignPaperScheduleRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_schedule";
  research_control_campaign_paper_schedule_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  report_ref: Ref;
  report_digest: string;
  paper_comparator: Extract<
    ResearchControlCampaignPaperComparator,
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol_digest: string;
  arms: [
    ResearchControlCampaignPaperScheduleArm,
    ResearchControlCampaignPaperScheduleArm
  ];
  committed_at: string;
  schedule_digest: string;
  paper_evaluation_scheduling_authority: true;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export type ResearchControlCampaignPaperStartBatchStatus =
  | "single_ready"
  | "paired_ready"
  | "ineligible";

export interface ResearchControlCampaignPaperStartBatchSide {
  arm_kind: ResearchControlCampaignArmKind;
  source_comparison_ref: Ref;
  source_comparison_digest: string;
  first_tick_ref?: Ref;
  first_tick_digest?: string;
  first_tick_observed_at?: string;
}

export interface ResearchControlCampaignPaperStartBatchRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_start_batch";
  research_control_campaign_paper_start_batch_id: string;
  schedule_ref: Ref;
  schedule_digest: string;
  sequence: number;
  batch_status: ResearchControlCampaignPaperStartBatchStatus;
  sides: ResearchControlCampaignPaperStartBatchSide[];
  source_start_deadline_at: string;
  shared_market_snapshot_digest?: string;
  shared_public_execution_snapshot_digest?: string;
  ineligible_reason?:
    | "first_tick_incomplete"
    | "cross_arm_first_tick_mismatch"
    | "source_start_deadline_missed";
  evaluated_at: string;
  start_batch_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export type ResearchControlCampaignPaperSlotTerminalStatus =
  | "source_not_improved"
  | "qualified_improvement"
  | "not_reproduced"
  | "evidence_ineligible"
  | "paper_slot_expired";

export type ResearchControlCampaignPaperSlotTerminalEvidence =
  | {
      evidence_kind: "source_verdict";
      source_comparison_ref: Ref;
      source_comparison_digest: string;
      source_verdict_ref: Ref;
      source_verdict_digest: string;
      terminal_status: "source_not_improved" | "evidence_ineligible";
    }
  | {
      evidence_kind: "source_slot_expired";
      terminal_status: "paper_slot_expired";
      expired_at: string;
    }
  | {
      evidence_kind: "source_start_ineligible";
      start_batch_ref: Ref;
      start_batch_digest: string;
      terminal_status: "evidence_ineligible";
      reason:
        | "first_tick_incomplete"
        | "cross_arm_first_tick_mismatch"
        | "source_start_deadline_missed";
      persisted_first_tick_refs: Ref[];
      persisted_first_tick_digests: string[];
      evaluated_at: string;
    }
  | {
      evidence_kind: "confirmation_precommit_expired";
      source_comparison_ref: Ref;
      source_comparison_digest: string;
      source_verdict_ref: Ref;
      source_verdict_digest: string;
      terminal_status: "paper_slot_expired";
      expired_at: string;
    }
  | {
      evidence_kind: "confirmation_release";
      confirmation_campaign_ref: Ref;
      confirmation_campaign_digest: string;
      confirmation_outcome_ref: Ref;
      confirmation_outcome_digest: string;
      research_release_ref: Ref;
      research_release_digest: string;
      release_kind: PaperTradingComparisonResearchReleaseKind;
      terminal_status:
        | "qualified_improvement"
        | "not_reproduced"
        | "evidence_ineligible"
        | "paper_slot_expired";
    };

export interface ResearchControlCampaignPaperSlotOutcomeRecord extends BaseRecord {
  record_kind: "research_control_campaign_paper_slot_outcome";
  research_control_campaign_paper_slot_outcome_id: string;
  schedule_ref: Ref;
  schedule_digest: string;
  arm_kind: ResearchControlCampaignArmKind;
  sequence: number;
  tick_ref: Ref;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  system_code_artifact_digest: string;
  admission_decision_ref: Ref;
  source_comparison_idempotency_key: string;
  source_preparation_id: string;
  source_comparison_commitment_id: string;
  terminal_evidence: ResearchControlCampaignPaperSlotTerminalEvidence;
  terminal_at: string;
  slot_outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export type ResearchControlCampaignOutcomeTerminalStatus =
  | "source_not_improved"
  | "qualified_improvement"
  | "not_reproduced"
  | "evidence_ineligible"
  | "paper_slot_expired";

interface ResearchControlCampaignOutcomeSlotBase {
  sequence: number;
  tick_ref: Ref;
}

export type ResearchControlCampaignOutcomeSlotResult =
  | (ResearchControlCampaignOutcomeSlotBase & {
      terminal_status: "no_admitted_candidate";
      discovery_credit: 0;
    })
  | (ResearchControlCampaignOutcomeSlotBase & {
      terminal_status: ResearchControlCampaignOutcomeTerminalStatus;
      candidate_ref: Ref;
      candidate_version_ref: Ref;
      system_code_ref: Ref;
      system_code_artifact_digest: string;
      paper_slot_outcome_ref: Ref;
      paper_slot_outcome_digest: string;
      discovery_credit: 0 | 1;
    });

export interface ResearchControlCampaignOutcomeArmMetrics {
  slot_count: number;
  admitted_candidate_slot_count: number;
  no_admitted_candidate_count: number;
  qualified_discovery_count: number;
  source_not_improved_count: number;
  not_reproduced_count: number;
  evidence_ineligible_count: number;
  paper_slot_expired_count: number;
  qualified_discovery_rate: number;
}

export interface ResearchControlCampaignOutcomeArm {
  arm_kind: ResearchControlCampaignArmKind;
  allocation_mode: "adaptive_default" | "static_control";
  slot_results: ResearchControlCampaignOutcomeSlotResult[];
  metrics: ResearchControlCampaignOutcomeArmMetrics;
}

export interface ResearchControlCampaignOutcomeRecord extends BaseRecord {
  record_kind: "research_control_campaign_outcome";
  research_control_campaign_outcome_id: string;
  campaign_ref: Ref;
  campaign_digest: string;
  report_ref: Ref;
  report_digest: string;
  schedule_ref: Ref;
  schedule_digest: string;
  paper_comparator: Extract<
    ResearchControlCampaignPaperComparator,
    { comparator_status: "trading_review" }
  >;
  shared_evaluation_policy_status: "bound";
  shared_evaluation_policy_digest: string;
  arms: [
    ResearchControlCampaignOutcomeArm,
    ResearchControlCampaignOutcomeArm
  ];
  observed_rate_difference: number;
  observed_result:
    | "adaptive_rate_higher"
    | "rates_equal"
    | "static_rate_higher";
  causal_conclusion: "single_campaign_observation_only";
  policy_replacement_eligibility: "not_eligible";
  next_action: "accumulate_replicated_control_campaigns";
  adjudicated_at: string;
  outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export interface ResearchControlStudyCondition {
  source: ResearchExperimentSource;
  research_agent: ResearchExperimentAgentIdentity;
  paper_comparator: Extract<
    ResearchControlCampaignPaperComparator,
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  >;
  allocation_policy: CandidateArenaResearchAllocationPolicy;
  allocation_policy_digest: string;
  campaign_policy: ResearchControlCampaignPolicy;
  condition_digest: string;
}

export interface ResearchGeneralizationPublicKline {
  open_time: string;
  close_time: string;
  close_price: string;
}

export interface ResearchGeneralizationPublicMarketSource {
  provider_kind: "binance_production_public_market_data";
  source_kind: "binance_production_public_rest";
  rest_base_url: string;
  endpoint: "/fapi/v1/klines";
  authority_status: "read_only";
}

export interface ResearchGeneralizationPublicKlineWindowInput {
  symbol: "BTCUSDT";
  interval: "1m";
  sample_count: 30;
  observed_at: string;
  closed_window_end_at: string;
  source: ResearchGeneralizationPublicMarketSource;
  klines: ResearchGeneralizationPublicKline[];
  authority_status: "read_only";
}

export interface ResearchGeneralizationPublicKlineWindow
extends ResearchGeneralizationPublicKlineWindowInput {
  window_digest: string;
}

export interface ResearchGeneralizationMarketClassifierPolicy {
  policy_version: "btc_usdt_closed_kline_direction_v1";
  symbol: "BTCUSDT";
  interval: "1m";
  sample_count: 30;
  fast_mean_sample_count: 5;
  slow_mean_sample_count: 30;
  directional_gap_ratio_threshold: 0.00005;
  observation_boundary_rule: "last_fully_closed_minute_before_observation";
  missing_data_rule: "no_condition_block";
  classifier_digest: string;
}

export type ResearchGeneralizationMarketConditionBlock =
  | "long"
  | "short"
  | "flat";

export interface ResearchGeneralizationMarketCondition {
  classifier_policy: ResearchGeneralizationMarketClassifierPolicy;
  public_kline_window: ResearchGeneralizationPublicKlineWindow;
  fast_mean: number;
  slow_mean: number;
  directional_gap_ratio: number;
  condition_block: ResearchGeneralizationMarketConditionBlock;
  classified_at: string;
  classification_digest: string;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "public_evidence_only";
}

export interface ResearchGeneralizationProtocolConditionBlock {
  condition_block: ResearchGeneralizationMarketConditionBlock;
  required_study_count: 2;
}

export interface ResearchGeneralizationProtocolStudySlot {
  slot_index: number;
  condition_block: ResearchGeneralizationMarketConditionBlock;
  condition_block_study_index: number;
  study_idempotency_key: string;
  study_ref: Ref;
  replication_idempotency_keys: string[];
}

export interface ResearchGeneralizationProtocolTimingPolicy {
  policy_version: "research_generalization_timing_v1";
  minimum_study_commitment_interval_ms: 86_400_000;
  maximum_collection_duration_ms: 7_776_000_000;
  collection_deadline_at: string;
  expiry_policy: "close_with_missing_slots";
}

export interface ResearchGeneralizationProtocolStudyPolicy {
  policy_version: "research_generalization_study_v1";
  replication_count_per_study: 6;
  tick_count_per_arm: 1;
  maximum_baseline_regular_file_count: 10_000;
  maximum_baseline_total_bytes: 1_000_000_000;
  source_baseline_reuse_policy: "unique_within_condition_block";
}

export interface ResearchGeneralizationProtocolAnalysisPolicy {
  policy_version: "equal_block_exact_sign_test_v1";
  primary_estimand:
    "equal_block_mean_adaptive_minus_static_qualified_discovery_rate";
  block_weighting: "equal_precommitted_condition_blocks";
  significance_method: "two_sided_exact_sign_test";
  alpha: 0.05;
  minimum_terminal_study_count: 6;
  minimum_non_tied_study_count: 6;
  minimum_distinct_baseline_count: 3;
  tie_policy: "exclude_from_sign_test_include_in_mean";
  missing_block_policy: "insufficient_generalization_evidence";
  harmful_block_policy: "non_positive_block_blocks_support";
}

export interface ResearchGeneralizationProtocolRecord extends BaseRecord {
  record_kind: "research_generalization_protocol";
  research_generalization_protocol_id: string;
  idempotency_key: string;
  hypothesis:
    "adaptive_allocation_effect_generalizes_across_baselines_and_market_conditions";
  target_allocation_policy: CandidateArenaResearchAllocationPolicy;
  target_allocation_policy_digest: string;
  research_agent: ResearchExperimentAgentIdentity;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  >;
  campaign_policy: ResearchControlCampaignPolicy;
  market_classifier_policy: ResearchGeneralizationMarketClassifierPolicy;
  condition_blocks: [
    ResearchGeneralizationProtocolConditionBlock,
    ResearchGeneralizationProtocolConditionBlock,
    ResearchGeneralizationProtocolConditionBlock
  ];
  study_slots: ResearchGeneralizationProtocolStudySlot[];
  timing_policy: ResearchGeneralizationProtocolTimingPolicy;
  study_policy: ResearchGeneralizationProtocolStudyPolicy;
  analysis_policy: ResearchGeneralizationProtocolAnalysisPolicy;
  committed_at: string;
  protocol_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface ResearchControlStudyReplication {
  replication_index: number;
  campaign_idempotency_key: string;
  campaign_ref: Ref;
  expected_baseline_snapshot_digest: string;
}

export interface ResearchControlStudyAnalysisPolicy {
  policy_version: "paired_exact_sign_test_v1";
  primary_estimand:
    "mean_adaptive_minus_static_qualified_discovery_rate";
  significance_method: "two_sided_exact_sign_test";
  alpha: 0.05;
  minimum_non_tied_replication_count: 6;
  tie_policy: "exclude_from_sign_test_include_in_mean";
  minimum_mean_rate_difference: 0;
}

export interface ResearchControlStudyGeneralizationAssignment {
  protocol_ref: Ref;
  protocol_digest: string;
  slot_index: number;
  condition_block: ResearchGeneralizationMarketConditionBlock;
  condition_block_study_index: number;
  market_condition: ResearchGeneralizationMarketCondition;
  source_system_code_artifact_digest: string;
  assigned_at: string;
  assignment_digest: string;
}

export interface ResearchControlStudyRecord extends BaseRecord {
  record_kind: "research_control_study";
  research_control_study_id: string;
  idempotency_key: string;
  hypothesis:
    "adaptive_allocation_improves_replicated_qualified_discovery_yield";
  baseline_policy: "same_frozen_snapshot";
  baseline_snapshot_digest: string;
  condition: ResearchControlStudyCondition;
  replications: ResearchControlStudyReplication[];
  generalization_assignment?: ResearchControlStudyGeneralizationAssignment;
  analysis_policy: ResearchControlStudyAnalysisPolicy;
  committed_at: string;
  study_digest: string;
  research_scheduling_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_only";
}

export interface ResearchControlStudyExecutionLeaseOwner {
  server_instance_id: string;
  host_id: string;
  process_id: number;
  process_start_marker: string;
}

export interface ResearchControlStudyExecutionLeaseRecord extends BaseRecord {
  record_kind: "research_control_study_execution_lease";
  research_control_study_execution_lease_id: string;
  study_ref: Ref;
  study_digest: string;
  owner: ResearchControlStudyExecutionLeaseOwner;
  lease_token: string;
  fencing_token: number;
  lease_status: "active" | "released" | "expired";
  lease_duration_ms: number;
  acquired_at: string;
  renewed_at: string;
  expires_at: string;
  closed_at?: string;
  close_reason?:
    | "owner_released"
    | "expired_owner_absent"
    | "expired_fenced_takeover";
  lease_digest: string;
  runtime_coordination_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}

export type RuntimeProcessKind =
  | "research_provider"
  | "candidate_sandbox"
  | "runtime_supervisor";

export interface RuntimeProcessOwner {
  host_id: string;
  process_id: number;
  process_start_marker: string;
}

export type RuntimeProcessTerminalReason =
  | "completed"
  | "crashed"
  | "timed_out"
  | "shutdown"
  | "restart_terminated"
  | "owner_absent"
  | "pid_reused";

export interface RuntimeProcessOwnershipRecord extends BaseRecord {
  record_kind: "runtime_process_ownership";
  runtime_process_ownership_id: string;
  process_kind: RuntimeProcessKind;
  subject_ref: Ref;
  runtime_ref: Ref;
  owner: RuntimeProcessOwner;
  executable: string;
  profile_digest: string;
  session_token: string;
  ownership_status: "active" | "terminal";
  adoption_count: number;
  started_at: string;
  last_adopted_at?: string;
  closed_at?: string;
  terminal_reason?: RuntimeProcessTerminalReason;
  ownership_digest: string;
  runtime_coordination_authority: true;
  evaluation_authority: false;
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}

export class RuntimeProcessOwnershipDecisionError extends Error {
  readonly code = "invalid_runtime_process_ownership_input";

  constructor() {
    super("Invalid runtime process ownership input");
    this.name = "RuntimeProcessOwnershipDecisionError";
  }
}

export class ResearchControlStudyExecutionLeaseDecisionError extends Error {
  readonly code = "invalid_research_control_study_execution_lease_input";

  constructor() {
    super("Invalid ResearchControlStudy execution lease input");
    this.name = "ResearchControlStudyExecutionLeaseDecisionError";
  }
}

export interface ResearchControlStudyReplicationResult {
  replication_index: number;
  campaign_ref: Ref;
  campaign_digest: string;
  campaign_outcome_ref: Ref;
  campaign_outcome_digest: string;
  observed_rate_difference: number;
}

export interface ResearchControlStudyOutcomeRecord extends BaseRecord {
  record_kind: "research_control_study_outcome";
  research_control_study_outcome_id: string;
  study_ref: Ref;
  study_digest: string;
  replication_results: ResearchControlStudyReplicationResult[];
  planned_replication_count: number;
  completed_replication_count: number;
  adaptive_positive_count: number;
  static_positive_count: number;
  tied_count: number;
  non_tied_count: number;
  mean_rate_difference: number;
  exact_sign_test_p_value: number;
  inference_status:
    | "adaptive_effect_supported"
    | "adaptive_effect_not_supported"
    | "insufficient_non_tied_replications";
  causal_scope: "same_baseline_stochastic_replication_only";
  policy_decision_eligibility:
    | "eligible_for_separate_policy_decision"
    | "not_eligible";
  next_action:
    | "review_research_allocation_policy"
    | "accumulate_or_redesign_precommitted_study";
  adjudicated_at: string;
  study_outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export type ResearchGeneralizationOutcomeSlotStatus =
  | "completed"
  | "missing_study"
  | "missing_outcome"
  | "ineligible";

export type ResearchGeneralizationOutcomeSlotReason =
  | "eligible_terminal_study"
  | "planned_study_not_committed"
  | "study_outcome_not_terminal"
  | "protocol_assignment_mismatch"
  | "protocol_condition_mismatch"
  | "study_commitment_outside_protocol_window"
  | "study_spacing_not_elapsed"
  | "source_baseline_reused_within_condition_block";

export interface ResearchGeneralizationOutcomeSlotResult {
  slot_index: number;
  condition_block: ResearchGeneralizationMarketConditionBlock;
  condition_block_study_index: number;
  planned_study_ref: Ref;
  slot_status: ResearchGeneralizationOutcomeSlotStatus;
  status_reason: ResearchGeneralizationOutcomeSlotReason;
  study_ref: Ref | null;
  study_digest: string | null;
  study_outcome_ref: Ref | null;
  study_outcome_digest: string | null;
  baseline_snapshot_digest: string | null;
  source_system_code_artifact_digest: string | null;
  observed_rate_difference: number | null;
  study_effect_status:
    | "adaptive_positive"
    | "static_positive"
    | "tied"
    | null;
}

export interface ResearchGeneralizationOutcomeBlockResult {
  condition_block: ResearchGeneralizationMarketConditionBlock;
  planned_study_count: 2;
  completed_study_count: number;
  non_tied_study_count: number;
  tied_study_count: number;
  missing_study_count: number;
  ineligible_study_count: number;
  adaptive_positive_count: number;
  static_positive_count: number;
  distinct_baseline_count: number;
  mean_rate_difference: number | null;
  block_status:
    | "complete_positive"
    | "complete_non_positive"
    | "incomplete";
}

export interface ResearchGeneralizationOutcomeRecord extends BaseRecord {
  record_kind: "research_generalization_outcome";
  research_generalization_outcome_id: string;
  protocol_ref: Ref;
  protocol_digest: string;
  target_allocation_policy_digest: string;
  slot_results: ResearchGeneralizationOutcomeSlotResult[];
  block_results: [
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult
  ];
  planned_study_count: 6;
  completed_study_count: number;
  non_tied_study_count: number;
  tied_study_count: number;
  missing_study_count: number;
  ineligible_study_count: number;
  adaptive_positive_count: number;
  static_positive_count: number;
  distinct_baseline_count: number;
  equal_weight_mean_rate_difference: number | null;
  exact_sign_test_p_value: number;
  harmful_condition_blocks: ResearchGeneralizationMarketConditionBlock[];
  inference_status:
    | "generalization_supported"
    | "generalization_not_supported"
    | "insufficient_generalization_evidence";
  causal_scope:
    "pre_effect_market_condition_blocked_cross_baseline_study_effects";
  policy_decision_eligibility:
    | "eligible_for_separate_generalization_policy_decision"
    | "not_eligible";
  next_action:
    | "review_broad_research_allocation_policy"
    | "retain_negative_generalization_evidence"
    | "complete_or_redesign_generalization_protocol";
  adjudicated_at: string;
  outcome_digest: string;
  evaluation_authority: "external_to_trading_systems";
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export interface ResearchAllocationPolicyDecisionPolicy {
  policy_version: "adaptive_supported_effect_v1";
  target_allocation_mode: "adaptive_default";
  required_inference_status: "adaptive_effect_supported";
  required_causal_scope: "same_baseline_stochastic_replication_only";
  required_policy_decision_eligibility:
    "eligible_for_separate_policy_decision";
  application_scope: "future_uncontrolled_candidate_arena_ticks";
}

export interface ResearchAllocationPolicyDecisionRecord extends BaseRecord {
  record_kind: "research_allocation_policy_decision";
  research_allocation_policy_decision_id: string;
  study_ref: Ref;
  study_digest: string;
  study_outcome_ref: Ref;
  study_outcome_digest: string;
  target_allocation_policy_digest: string;
  decision_policy: ResearchAllocationPolicyDecisionPolicy;
  decision_status: "approved" | "not_approved";
  decision_reason:
    | "supported_same_baseline_adaptive_effect"
    | "study_outcome_not_eligible";
  effective_default_mode: "adaptive_default" | null;
  decided_at: string;
  policy_decision_digest: string;
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
}

export interface ResearchGeneralizationPolicyDecisionPolicy {
  policy_version: "generalization_supported_adaptive_v1";
  target_allocation_mode: "adaptive_default";
  required_inference_status: "generalization_supported";
  required_causal_scope:
    "pre_effect_market_condition_blocked_cross_baseline_study_effects";
  required_policy_decision_eligibility:
    "eligible_for_separate_generalization_policy_decision";
  application_scope: "future_uncontrolled_candidate_arena_ticks";
}

export interface ResearchGeneralizationPolicyDecisionRecord extends BaseRecord {
  record_kind: "research_generalization_policy_decision";
  research_generalization_policy_decision_id: string;
  protocol_ref: Ref;
  protocol_digest: string;
  generalization_outcome_ref: Ref;
  generalization_outcome_digest: string;
  target_allocation_policy_digest: string;
  decision_policy: ResearchGeneralizationPolicyDecisionPolicy;
  decision_status: "approved" | "not_approved";
  decision_reason:
    | "supported_cross_condition_adaptive_effect"
    | "generalization_outcome_not_eligible";
  effective_default_mode: "adaptive_default" | null;
  decided_at: string;
  policy_decision_digest: string;
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
}

export function researchControlCampaignDigestInput(
  record: ResearchControlCampaignRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_id: _id,
    campaign_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignPaperEvaluationProtocolDigestInput(
  protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  >
): string {
  const { protocol_digest: _digest, ...payload } = protocol;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignArmIntentDigestInput(
  record: ResearchControlCampaignArmIntentRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_arm_intent_id: _id,
    intent_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignReportDigestInput(
  record: ResearchControlCampaignReportRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_report_id: _id,
    report_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignPaperScheduleDigestInput(
  record: ResearchControlCampaignPaperScheduleRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_paper_schedule_id: _id,
    schedule_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignPaperStartBatchDigestInput(
  record: ResearchControlCampaignPaperStartBatchRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_paper_start_batch_id: _id,
    start_batch_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignPaperSlotOutcomeDigestInput(
  record: ResearchControlCampaignPaperSlotOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_paper_slot_outcome_id: _id,
    slot_outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlCampaignOutcomeDigestInput(
  record: ResearchControlCampaignOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_campaign_outcome_id: _id,
    outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlStudyConditionDigestInput(
  condition: ResearchControlStudyCondition
): string {
  const { condition_digest: _digest, ...payload } = condition;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationPublicKlineWindowDigestInput(
  window: ResearchGeneralizationPublicKlineWindow
): string {
  const { window_digest: _digest, ...payload } = window;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationMarketClassifierPolicyDigestInput(
  policy: ResearchGeneralizationMarketClassifierPolicy
): string {
  const { classifier_digest: _digest, ...payload } = policy;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationMarketConditionDigestInput(
  condition: ResearchGeneralizationMarketCondition
): string {
  const { classification_digest: _digest, ...payload } = condition;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationProtocolDigestInput(
  record: ResearchGeneralizationProtocolRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_generalization_protocol_id: _id,
    protocol_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlStudyGeneralizationAssignmentDigestInput(
  assignment: ResearchControlStudyGeneralizationAssignment
): string {
  const { assignment_digest: _digest, ...payload } = assignment;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlStudyDigestInput(
  record: ResearchControlStudyRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_study_id: _id,
    study_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchMemoryControlStudyDigestInput(
  record: ResearchMemoryControlStudyRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_memory_control_study_id: _id,
    study_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchMemoryControlPairOutcomeDigestInput(
  record: ResearchMemoryControlPairOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_memory_control_pair_outcome_id: _id,
    pair_outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchMemoryControlStudyOutcomeDigestInput(
  record: ResearchMemoryControlStudyOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_memory_control_study_outcome_id: _id,
    study_outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchControlStudyExecutionLeaseDigestInput(
  record: ResearchControlStudyExecutionLeaseRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_study_execution_lease_id: _id,
    lease_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function decideResearchControlStudyExecutionLease(input: {
  study: ResearchControlStudyRecord;
  owner: ResearchControlStudyExecutionLeaseOwner;
  leaseToken: string;
  fencingToken: number;
  leaseDurationMs: number;
  acquiredAt: string;
}): ResearchControlStudyExecutionLeaseRecord {
  try {
    if (!researchControlStudyHasRuntimeShape(input?.study) ||
      !researchControlStudyExecutionLeaseOwnerHasRuntimeShape(input?.owner) ||
      !researchControlStudyExecutionLeasePositiveInteger(input?.fencingToken) ||
      !researchControlStudyExecutionLeasePositiveInteger(
        input?.leaseDurationMs
      )) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    const leaseToken = researchControlStudyExecutionLeaseCanonicalString(
      input.leaseToken
    );
    const acquiredAt = researchControlStudyExecutionLeaseCanonicalTime(
      input.acquiredAt
    );
    const record: ResearchControlStudyExecutionLeaseRecord = {
      record_kind: "research_control_study_execution_lease",
      version: 1,
      research_control_study_execution_lease_id:
        researchControlStudyExecutionLeaseId(
          input.study.research_control_study_id,
          leaseToken
        ),
      study_ref: {
        record_kind: "research_control_study",
        id: input.study.research_control_study_id
      },
      study_digest: input.study.study_digest,
      owner: { ...input.owner },
      lease_token: leaseToken,
      fencing_token: input.fencingToken,
      lease_status: "active",
      lease_duration_ms: input.leaseDurationMs,
      acquired_at: acquiredAt,
      renewed_at: acquiredAt,
      expires_at: researchControlStudyExecutionLeaseExpiry(
        acquiredAt,
        input.leaseDurationMs
      ),
      lease_digest: researchControlStudyExecutionLeasePendingDigest(),
      runtime_coordination_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    };
    record.lease_digest = researchControlStudyExecutionLeaseExactDigest(record);
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(record)) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlStudyExecutionLeaseDecisionError) {
      throw error;
    }
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
}

export function renewResearchControlStudyExecutionLease(input: {
  lease: ResearchControlStudyExecutionLeaseRecord;
  renewedAt: string;
}): ResearchControlStudyExecutionLeaseRecord {
  try {
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(input?.lease) ||
      input.lease.lease_status !== "active") {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    const renewedAt = researchControlStudyExecutionLeaseCanonicalTime(
      input.renewedAt
    );
    if (Date.parse(renewedAt) <= Date.parse(input.lease.renewed_at) ||
      Date.parse(renewedAt) >= Date.parse(input.lease.expires_at)) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    const record: ResearchControlStudyExecutionLeaseRecord = {
      ...input.lease,
      study_ref: { ...input.lease.study_ref },
      owner: { ...input.lease.owner },
      renewed_at: renewedAt,
      expires_at: researchControlStudyExecutionLeaseExpiry(
        renewedAt,
        input.lease.lease_duration_ms
      ),
      lease_digest: researchControlStudyExecutionLeasePendingDigest()
    };
    record.lease_digest = researchControlStudyExecutionLeaseExactDigest(record);
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(record)) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlStudyExecutionLeaseDecisionError) {
      throw error;
    }
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
}

export function closeResearchControlStudyExecutionLease(input: {
  lease: ResearchControlStudyExecutionLeaseRecord;
  leaseStatus: "released" | "expired";
  closeReason?: "expired_owner_absent" | "expired_fenced_takeover";
  closedAt: string;
}): ResearchControlStudyExecutionLeaseRecord {
  try {
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(input?.lease) ||
      input.lease.lease_status !== "active" ||
      (input.leaseStatus !== "released" && input.leaseStatus !== "expired") ||
      (input.leaseStatus === "released" && input.closeReason !== undefined) ||
      (input.closeReason !== undefined &&
        input.closeReason !== "expired_owner_absent" &&
        input.closeReason !== "expired_fenced_takeover")) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    const closedAt = researchControlStudyExecutionLeaseCanonicalTime(
      input.closedAt
    );
    if (Date.parse(closedAt) < Date.parse(input.lease.renewed_at)) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    const record: ResearchControlStudyExecutionLeaseRecord = {
      ...input.lease,
      study_ref: { ...input.lease.study_ref },
      owner: { ...input.lease.owner },
      lease_status: input.leaseStatus,
      closed_at: closedAt,
      close_reason: input.leaseStatus === "released"
        ? "owner_released"
        : input.closeReason ?? "expired_owner_absent",
      lease_digest: researchControlStudyExecutionLeasePendingDigest()
    };
    record.lease_digest = researchControlStudyExecutionLeaseExactDigest(record);
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(record)) {
      throw researchControlStudyExecutionLeaseInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlStudyExecutionLeaseDecisionError) {
      throw error;
    }
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
}

export function runtimeProcessOwnershipDigestInput(
  record: RuntimeProcessOwnershipRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    runtime_process_ownership_id: _id,
    ownership_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function createRuntimeProcessOwnership(input: {
  processKind: RuntimeProcessKind;
  subjectRef: Ref;
  runtimeRef: Ref;
  owner: RuntimeProcessOwner;
  executable: string;
  profileDigest: string;
  sessionToken: string;
  startedAt: string;
}): RuntimeProcessOwnershipRecord {
  try {
    if (!runtimeProcessKind(input?.processKind) ||
      !runtimeProcessRef(input?.subjectRef) ||
      !runtimeProcessRef(input?.runtimeRef) ||
      !runtimeProcessOwnerHasRuntimeShape(input?.owner) ||
      !runtimeProcessCanonicalString(input?.executable) ||
      !runtimeProcessDigest(input?.profileDigest) ||
      !runtimeProcessCanonicalString(input?.sessionToken) ||
      !comparisonIso(input?.startedAt)) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    const record: RuntimeProcessOwnershipRecord = {
      record_kind: "runtime_process_ownership",
      version: 1,
      runtime_process_ownership_id: runtimeProcessOwnershipId(
        input.processKind,
        input.subjectRef,
        input.sessionToken
      ),
      process_kind: input.processKind,
      subject_ref: { ...input.subjectRef },
      runtime_ref: { ...input.runtimeRef },
      owner: { ...input.owner },
      executable: input.executable,
      profile_digest: input.profileDigest,
      session_token: input.sessionToken,
      ownership_status: "active",
      adoption_count: 0,
      started_at: input.startedAt,
      ownership_digest: runtimeProcessPendingDigest(),
      runtime_coordination_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    };
    record.ownership_digest = runtimeProcessOwnershipExactDigest(record);
    if (!runtimeProcessOwnershipHasRuntimeShape(record)) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof RuntimeProcessOwnershipDecisionError) throw error;
    throw runtimeProcessOwnershipInvalidDecision();
  }
}

export function adoptRuntimeProcessOwnership(input: {
  ownership: RuntimeProcessOwnershipRecord;
  adoptedAt: string;
}): RuntimeProcessOwnershipRecord {
  try {
    if (!runtimeProcessOwnershipHasRuntimeShape(input?.ownership) ||
      input.ownership.ownership_status !== "active" ||
      !comparisonIso(input?.adoptedAt) ||
      Date.parse(input.adoptedAt) < Date.parse(
        input.ownership.last_adopted_at ?? input.ownership.started_at
      )) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    const record: RuntimeProcessOwnershipRecord = {
      ...input.ownership,
      subject_ref: { ...input.ownership.subject_ref },
      runtime_ref: { ...input.ownership.runtime_ref },
      owner: { ...input.ownership.owner },
      adoption_count: input.ownership.adoption_count + 1,
      last_adopted_at: input.adoptedAt,
      ownership_digest: runtimeProcessPendingDigest()
    };
    record.ownership_digest = runtimeProcessOwnershipExactDigest(record);
    if (!runtimeProcessOwnershipHasRuntimeShape(record)) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof RuntimeProcessOwnershipDecisionError) throw error;
    throw runtimeProcessOwnershipInvalidDecision();
  }
}

export function closeRuntimeProcessOwnership(input: {
  ownership: RuntimeProcessOwnershipRecord;
  terminalReason: RuntimeProcessTerminalReason;
  closedAt: string;
}): RuntimeProcessOwnershipRecord {
  try {
    if (!runtimeProcessOwnershipHasRuntimeShape(input?.ownership) ||
      input.ownership.ownership_status !== "active" ||
      !runtimeProcessTerminalReason(input?.terminalReason) ||
      !comparisonIso(input?.closedAt) ||
      Date.parse(input.closedAt) < Date.parse(
        input.ownership.last_adopted_at ?? input.ownership.started_at
      )) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    const record: RuntimeProcessOwnershipRecord = {
      ...input.ownership,
      subject_ref: { ...input.ownership.subject_ref },
      runtime_ref: { ...input.ownership.runtime_ref },
      owner: { ...input.ownership.owner },
      ownership_status: "terminal",
      closed_at: input.closedAt,
      terminal_reason: input.terminalReason,
      ownership_digest: runtimeProcessPendingDigest()
    };
    record.ownership_digest = runtimeProcessOwnershipExactDigest(record);
    if (!runtimeProcessOwnershipHasRuntimeShape(record)) {
      throw runtimeProcessOwnershipInvalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof RuntimeProcessOwnershipDecisionError) throw error;
    throw runtimeProcessOwnershipInvalidDecision();
  }
}

export function runtimeProcessOwnershipHasRuntimeShape(
  value: unknown
): value is RuntimeProcessOwnershipRecord {
  if (!comparisonObject(value)) return false;
  const optionalKeys = [
    ...(value.last_adopted_at === undefined ? [] : ["last_adopted_at"]),
    ...(value.closed_at === undefined ? [] : ["closed_at"]),
    ...(value.terminal_reason === undefined ? [] : ["terminal_reason"])
  ];
  if (!comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "runtime_process_ownership_id",
    "process_kind",
    "subject_ref",
    "runtime_ref",
    "owner",
    "executable",
    "profile_digest",
    "session_token",
    "ownership_status",
    "adoption_count",
    "started_at",
    ...optionalKeys,
    "ownership_digest",
    "runtime_coordination_authority",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "runtime_process_ownership" || value.version !== 1 ||
    !runtimeProcessCanonicalString(value.runtime_process_ownership_id) ||
    !runtimeProcessKind(value.process_kind) || !runtimeProcessRef(value.subject_ref) ||
    !runtimeProcessRef(value.runtime_ref) ||
    !runtimeProcessOwnerHasRuntimeShape(value.owner) ||
    !runtimeProcessCanonicalString(value.executable) ||
    !runtimeProcessDigest(value.profile_digest) ||
    !runtimeProcessCanonicalString(value.session_token) ||
    (value.ownership_status !== "active" && value.ownership_status !== "terminal") ||
    !comparisonNonNegative(value.adoption_count) || !comparisonIso(value.started_at) ||
    (value.last_adopted_at !== undefined && !comparisonIso(value.last_adopted_at)) ||
    (value.closed_at !== undefined && !comparisonIso(value.closed_at)) ||
    (value.terminal_reason !== undefined &&
      !runtimeProcessTerminalReason(value.terminal_reason)) ||
    !runtimeProcessDigest(value.ownership_digest) ||
    value.runtime_coordination_authority !== true ||
    value.evaluation_authority !== false ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "runtime_coordination_only") {
    return false;
  }
  const ownership = value as unknown as RuntimeProcessOwnershipRecord;
  const active = ownership.ownership_status === "active";
  const adoptionConsistent = ownership.adoption_count === 0
    ? ownership.last_adopted_at === undefined
    : ownership.last_adopted_at !== undefined &&
      Date.parse(ownership.last_adopted_at) >= Date.parse(ownership.started_at);
  const terminalConsistent = active
    ? ownership.closed_at === undefined && ownership.terminal_reason === undefined
    : ownership.closed_at !== undefined && ownership.terminal_reason !== undefined &&
      Date.parse(ownership.closed_at) >= Date.parse(
        ownership.last_adopted_at ?? ownership.started_at
      );
  return adoptionConsistent && terminalConsistent &&
    ownership.runtime_process_ownership_id === runtimeProcessOwnershipId(
      ownership.process_kind,
      ownership.subject_ref,
      ownership.session_token
    ) && ownership.ownership_digest === runtimeProcessOwnershipExactDigest(ownership);
}

export function researchControlStudyOutcomeDigestInput(
  record: ResearchControlStudyOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_control_study_outcome_id: _id,
    study_outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationOutcomeDigestInput(
  record: ResearchGeneralizationOutcomeRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_generalization_outcome_id: _id,
    outcome_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchAllocationPolicyDecisionDigestInput(
  record: ResearchAllocationPolicyDecisionRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_allocation_policy_decision_id: _id,
    policy_decision_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationPolicyDecisionDigestInput(
  record: ResearchGeneralizationPolicyDecisionRecord
): string {
  const {
    record_kind: _recordKind,
    version: _version,
    research_generalization_policy_decision_id: _id,
    policy_decision_digest: _digest,
    ...payload
  } = record;
  return paperTradingComparisonPersistedRecordDigestInput(payload);
}

export function researchGeneralizationProtocolHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationProtocolRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_generalization_protocol_id",
    "idempotency_key",
    "hypothesis",
    "target_allocation_policy",
    "target_allocation_policy_digest",
    "research_agent",
    "paper_evaluation_protocol",
    "campaign_policy",
    "market_classifier_policy",
    "condition_blocks",
    "study_slots",
    "timing_policy",
    "study_policy",
    "analysis_policy",
    "committed_at",
    "protocol_digest",
    "research_scheduling_authority",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_generalization_protocol" ||
    value.version !== 1 ||
    !comparisonString(value.research_generalization_protocol_id) ||
    !comparisonString(value.idempotency_key) || value.hypothesis !==
      "adaptive_allocation_effect_generalizes_across_baselines_and_market_conditions" ||
    !candidateArenaResearchAllocationPolicyHasRuntimeShape(
      value.target_allocation_policy
    ) || !researchControlCampaignSha256Digest(
      value.target_allocation_policy_digest
    ) || !researchExperimentAgentHasRuntimeShape(value.research_agent) ||
    !researchControlCampaignPaperEvaluationProtocolHasRuntimeShape(
      value.paper_evaluation_protocol
    ) || value.paper_evaluation_protocol.protocol_status !== "bound" ||
    !researchControlCampaignPolicyHasRuntimeShape(value.campaign_policy) ||
    !researchGeneralizationMarketClassifierPolicyHasRuntimeShape(
      value.market_classifier_policy
    ) || !researchGeneralizationProtocolConditionBlocksHaveRuntimeShape(
      value.condition_blocks
    ) || !Array.isArray(value.study_slots) ||
    value.study_slots.length !== 6 ||
    !researchGeneralizationProtocolTimingPolicyHasRuntimeShape(
      value.timing_policy
    ) || !researchGeneralizationProtocolStudyPolicyHasRuntimeShape(
      value.study_policy
    ) || !researchGeneralizationProtocolAnalysisPolicyHasRuntimeShape(
      value.analysis_policy
    ) || !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.protocol_digest) ||
    value.research_scheduling_authority !== true ||
    value.evaluation_authority !== false ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  const protocol = value as unknown as ResearchGeneralizationProtocolRecord;
  if (Date.parse(protocol.timing_policy.collection_deadline_at) !==
      Date.parse(protocol.committed_at) +
        protocol.timing_policy.maximum_collection_duration_ms ||
    protocol.campaign_policy.tick_count_per_arm !==
      protocol.study_policy.tick_count_per_arm ||
    protocol.campaign_policy.maximum_baseline_regular_file_count !==
      protocol.study_policy.maximum_baseline_regular_file_count ||
    protocol.campaign_policy.maximum_baseline_total_bytes !==
      protocol.study_policy.maximum_baseline_total_bytes ||
    !protocol.study_slots.every((slot, index) =>
      researchGeneralizationProtocolStudySlotHasRuntimeShape(slot, index + 1)
    )) {
    return false;
  }
  return candidateArenaAllocationStringsUnique(
    protocol.study_slots.map((slot) => slot.study_idempotency_key)
  ) && candidateArenaAllocationStringsUnique(
    protocol.study_slots.map((slot) => slot.study_ref.id)
  ) && candidateArenaAllocationStringsUnique(
    protocol.study_slots.flatMap((slot) =>
      slot.replication_idempotency_keys
    )
  );
}

export function researchGeneralizationMarketConditionHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationMarketCondition {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "classifier_policy",
    "public_kline_window",
    "fast_mean",
    "slow_mean",
    "directional_gap_ratio",
    "condition_block",
    "classified_at",
    "classification_digest",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || !researchGeneralizationMarketClassifierPolicyHasRuntimeShape(
    value.classifier_policy
  ) || !researchGeneralizationPublicKlineWindowHasRuntimeShape(
    value.public_kline_window
  ) || !comparisonPositiveFinite(value.fast_mean) ||
    !comparisonPositiveFinite(value.slow_mean) ||
    !comparisonFinite(value.directional_gap_ratio) ||
    !["long", "short", "flat"].includes(String(value.condition_block)) ||
    !comparisonIso(value.classified_at) ||
    !researchControlCampaignSha256Digest(value.classification_digest) ||
    value.evaluation_authority !== false ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "public_evidence_only") {
    return false;
  }
  const condition = value as unknown as ResearchGeneralizationMarketCondition;
  if (Date.parse(condition.classified_at) <
      Date.parse(condition.public_kline_window.observed_at)) {
    return false;
  }
  const closes = condition.public_kline_window.klines.map((kline) =>
    Number(kline.close_price)
  );
  const fastMean = researchGeneralizationRoundFeature(
    closes.slice(-5).reduce((sum, close) => sum + close, 0) / 5
  );
  const slowMean = researchGeneralizationRoundFeature(
    closes.reduce((sum, close) => sum + close, 0) / 30
  );
  const gap = researchGeneralizationRoundFeature(
    (fastMean - slowMean) / slowMean
  );
  const expectedBlock: ResearchGeneralizationMarketConditionBlock =
    gap > 0.00005 ? "long" : gap < -0.00005 ? "short" : "flat";
  return condition.fast_mean === fastMean && condition.slow_mean === slowMean &&
    condition.directional_gap_ratio === gap &&
    condition.condition_block === expectedBlock;
}

export function researchMemoryControlStudyHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlStudyRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_memory_control_study_id",
    "idempotency_key",
    "hypothesis",
    "baseline",
    "source",
    "research_agent",
    "research_agent_profile_id",
    "opportunity_protocol",
    "pair_plans",
    "policy",
    "analysis_policy",
    "committed_at",
    "study_digest",
    "research_scheduling_authority",
    "evaluation_authority",
    "memory_policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_memory_control_study" ||
    value.version !== 1 || typeof value.research_memory_control_study_id !==
      "string" || !/^research-memory-control-study-[a-f0-9]{20}$/.test(
        value.research_memory_control_study_id
      ) || !comparisonString(value.idempotency_key) || value.hypothesis !==
      "released_memory_reduces_exact_behavior_repeats" ||
    !researchExperimentBaselineHasRuntimeShape(value.baseline) ||
    value.baseline.exclusion_policy !== "research_experiment_evidence_only" ||
    !researchExperimentSourceHasRuntimeShape(value.source) ||
    !researchExperimentAgentHasRuntimeShape(value.research_agent) ||
    !comparisonString(value.research_agent.model) ||
    !comparisonString(value.research_agent_profile_id) ||
    !researchMemoryControlOpportunityProtocolHasRuntimeShape(
      value.opportunity_protocol
    ) ||
    !Array.isArray(value.pair_plans) || value.pair_plans.length < 6 ||
    value.pair_plans.length > 30 ||
    !researchMemoryControlStudyPolicyHasRuntimeShape(
      value.policy,
      value.pair_plans.length
    ) || !researchMemoryControlStudyAnalysisPolicyHasRuntimeShape(
      value.analysis_policy
    ) || !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    value.research_scheduling_authority !== true ||
    value.evaluation_authority !== false ||
    value.memory_policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  const study = value as unknown as ResearchMemoryControlStudyRecord;
  if (study.baseline.regular_file_count >
      study.policy.maximum_baseline_regular_file_count ||
    study.baseline.total_bytes > study.policy.maximum_baseline_total_bytes ||
    !study.pair_plans.every((pair, index) =>
      researchMemoryControlPairPlanHasRuntimeShape(pair, index + 1)
    )) {
    return false;
  }
  const directions = study.pair_plans.map((pair) => pair.direction_kind);
  const tickIds = study.pair_plans.flatMap((pair) => [
    pair.released_memory_treatment.tick_id,
    pair.memory_masked_control.tick_id
  ]);
  return new Set(directions).size >= 2 &&
    candidateArenaAllocationStringsUnique(tickIds);
}

export function researchMemoryControlPairOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlPairOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_memory_control_pair_outcome_id",
    "study_ref",
    "study_digest",
    "pair_index",
    "pair_plan_digest",
    "research_direction_ref",
    "direction_kind",
    "released_memory",
    "memory_masked",
    "eligibility_status",
    "ineligibility_reason",
    "initial_start_skew_ms",
    "paired_difference",
    "terminal_at",
    "pair_outcome_digest",
    "evaluation_authority",
    "memory_policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_memory_control_pair_outcome" ||
    value.version !== 1 ||
    typeof value.research_memory_control_pair_outcome_id !== "string" ||
    !/^research-memory-control-pair-outcome-[a-f0-9]{20}$/.test(
      value.research_memory_control_pair_outcome_id
    ) || !comparisonRef(value.study_ref, "research_memory_control_study") ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    !comparisonPositive(value.pair_index) ||
    !Number.isInteger(value.pair_index) || value.pair_index > 30 ||
    !researchControlCampaignSha256Digest(value.pair_plan_digest) ||
    !comparisonRef(value.research_direction_ref, "research_direction") ||
    !researchDirectionKindHasRuntimeShape(value.direction_kind) ||
    !researchMemoryControlArmResultHasRuntimeShape(
      value.released_memory,
      "released_memory_treatment"
    ) || !researchMemoryControlArmResultHasRuntimeShape(
      value.memory_masked,
      "memory_masked_control"
    ) || !(value.initial_start_skew_ms === null || (
      comparisonNonNegative(value.initial_start_skew_ms) &&
      Number.isInteger(value.initial_start_skew_ms)
    )) || !comparisonIso(value.terminal_at) ||
    !researchControlCampaignSha256Digest(value.pair_outcome_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.memory_policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }
  const outcome = value as unknown as ResearchMemoryControlPairOutcomeRecord;
  if (!researchMemoryControlArmAssignmentMatches(
    outcome.released_memory,
    outcome,
    "released_memory_treatment"
  ) || !researchMemoryControlArmAssignmentMatches(
    outcome.memory_masked,
    outcome,
    "memory_masked_control"
  )) {
    return false;
  }
  const releasedIndicator = outcome.released_memory.exact_repeat_indicator;
  const maskedIndicator = outcome.memory_masked.exact_repeat_indicator;
  const expectedStartSkew = researchMemoryControlInitialStartSkew(outcome);
  if (outcome.initial_start_skew_ms !== expectedStartSkew) return false;
  if (outcome.eligibility_status === "eligible") {
    return outcome.ineligibility_reason === null &&
      (releasedIndicator === 0 || releasedIndicator === 1) &&
      (maskedIndicator === 0 || maskedIndicator === 1) &&
      outcome.released_memory.ineligibility_reason === null &&
      outcome.memory_masked.ineligibility_reason === null &&
      outcome.paired_difference === maskedIndicator - releasedIndicator &&
      expectedStartSkew !== null &&
      expectedStartSkew <= 5_000 &&
      researchMemoryControlPairedEvidenceMatches(outcome) &&
      researchMemoryControlMemoryContrastMatches(outcome);
  }
  return outcome.eligibility_status === "ineligible" &&
    researchMemoryControlIneligibilityReason(outcome.ineligibility_reason) &&
    outcome.paired_difference === null &&
    (outcome.released_memory.observation === "ineligible" ||
      outcome.memory_masked.observation === "ineligible") &&
    (outcome.released_memory.ineligibility_reason ===
      outcome.ineligibility_reason ||
      outcome.memory_masked.ineligibility_reason ===
        outcome.ineligibility_reason);
}

export function researchMemoryControlStudyOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlStudyOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_memory_control_study_outcome_id",
    "study_ref",
    "study_digest",
    "pair_results",
    "planned_pair_count",
    "completed_pair_count",
    "eligible_pair_count",
    "ineligible_pair_count",
    "favorable_pair_count",
    "unfavorable_pair_count",
    "tied_pair_count",
    "non_tied_pair_count",
    "mean_paired_difference",
    "exact_sign_test_p_value",
    "inference_status",
    "causal_scope",
    "memory_policy_decision_eligibility",
    "next_action",
    "adjudicated_at",
    "study_outcome_digest",
    "evaluation_authority",
    "memory_policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_memory_control_study_outcome" ||
    value.version !== 1 ||
    typeof value.research_memory_control_study_outcome_id !== "string" ||
    !/^research-memory-control-study-outcome-[a-f0-9]{20}$/.test(
      value.research_memory_control_study_outcome_id
    ) || !comparisonRef(value.study_ref, "research_memory_control_study") ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    !Array.isArray(value.pair_results) || value.pair_results.length < 6 ||
    value.pair_results.length > 30 ||
    !comparisonIso(value.adjudicated_at) ||
    !researchControlCampaignSha256Digest(value.study_outcome_digest) ||
    value.causal_scope !==
      "same_baseline_paired_exact_repeat_effect_only" ||
    value.memory_policy_decision_eligibility !== "not_eligible" ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.memory_policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }
  const outcome = value as unknown as ResearchMemoryControlStudyOutcomeRecord;
  if (!outcome.pair_results.every((pair, index) =>
    researchMemoryControlStudyPairResultHasRuntimeShape(pair, index + 1)
  ) || !candidateArenaAllocationStringsUnique(outcome.pair_results.map(
    (pair) => pair.pair_outcome_ref.id
  ))) {
    return false;
  }
  const eligible = outcome.pair_results.filter(
    (pair) => pair.eligibility_status === "eligible"
  );
  const differences = eligible.map((pair) => pair.paired_difference!);
  const favorable = differences.filter((difference) => difference > 0).length;
  const unfavorable = differences.filter((difference) => difference < 0).length;
  const tied = differences.length - favorable - unfavorable;
  const nonTied = favorable + unfavorable;
  const mean = differences.length === 0
    ? null
    : comparisonRound6(
        differences.reduce<number>((sum, difference) => sum + difference, 0) /
          differences.length
      );
  const pValue = researchControlStudyExactSignPValue(favorable, unfavorable);
  const supported = nonTied >= 6 && favorable > unfavorable &&
    pValue <= 0.05 && mean !== null && mean > 0;
  const inference = nonTied < 6
    ? "insufficient_memory_control_evidence"
    : supported
    ? "memory_effect_supported"
    : "memory_effect_not_supported";
  const nextAction = supported
    ? "review_memory_evidence_without_automatic_policy_change"
    : "retain_current_memory_policy_and_redesign_study";
  return outcome.planned_pair_count === outcome.pair_results.length &&
    outcome.completed_pair_count === outcome.pair_results.length &&
    outcome.eligible_pair_count === eligible.length &&
    outcome.ineligible_pair_count ===
      outcome.pair_results.length - eligible.length &&
    outcome.favorable_pair_count === favorable &&
    outcome.unfavorable_pair_count === unfavorable &&
    outcome.tied_pair_count === tied &&
    outcome.non_tied_pair_count === nonTied &&
    outcome.mean_paired_difference === mean &&
    outcome.exact_sign_test_p_value === pValue &&
    outcome.inference_status === inference && outcome.next_action === nextAction;
}

function researchMemoryControlOpportunityProtocolHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlOpportunityProtocol {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "development_suite_version",
    "development_suite_digest",
    "sealed_suite_version",
    "sealed_generator_version",
    "sealed_rotation_commitment_digest",
    "sealed_suite_digest"
  ]) && value.development_suite_version ===
      "research_development_replay_v1" &&
    researchControlCampaignSha256Digest(value.development_suite_digest) &&
    value.sealed_suite_version === "research_sealed_admission_v1" &&
    value.sealed_generator_version === "research_scenario_generator_v1" &&
    researchControlCampaignSha256Digest(
      value.sealed_rotation_commitment_digest
    ) && researchControlCampaignSha256Digest(value.sealed_suite_digest);
}

function researchMemoryControlStudyPolicyHasRuntimeShape(
  value: unknown,
  pairCount: number
): value is ResearchMemoryControlStudyPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "pair_count",
    "allocation_mode",
    "development_submission_limit_per_worker",
    "sealed_submission_limit_per_worker",
    "baseline_copy_policy",
    "within_pair_start_policy",
    "maximum_within_pair_start_skew_ms",
    "across_pair_execution_policy",
    "maximum_baseline_regular_file_count",
    "maximum_baseline_total_bytes"
  ]) && value.policy_version === "research_memory_control_study_v1" &&
    value.pair_count === pairCount && value.allocation_mode === "explicit" &&
    value.development_submission_limit_per_worker === 1 &&
    value.sealed_submission_limit_per_worker === 1 &&
    value.baseline_copy_policy === "fresh_verified_copy_per_arm" &&
    value.within_pair_start_policy === "concurrent_initial_sides" &&
    value.maximum_within_pair_start_skew_ms === 5_000 &&
    value.across_pair_execution_policy === "sequential" &&
    comparisonPositive(value.maximum_baseline_regular_file_count) &&
    Number.isInteger(value.maximum_baseline_regular_file_count) &&
    value.maximum_baseline_regular_file_count <= 100_000 &&
    comparisonPositive(value.maximum_baseline_total_bytes) &&
    Number.isInteger(value.maximum_baseline_total_bytes) &&
    value.maximum_baseline_total_bytes <= 1_000_000_000;
}

function researchMemoryControlStudyAnalysisPolicyHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlStudyAnalysisPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "primary_estimand",
    "significance_method",
    "alpha",
    "minimum_non_tied_pair_count",
    "tie_policy",
    "ineligible_pair_policy",
    "minimum_mean_paired_difference"
  ]) && value.policy_version === "paired_exact_repeat_sign_test_v1" &&
    value.primary_estimand ===
      "mean_masked_minus_released_memory_exact_repeat_indicator" &&
    value.significance_method === "two_sided_exact_sign_test" &&
    value.alpha === 0.05 && value.minimum_non_tied_pair_count === 6 &&
    value.tie_policy === "exclude_from_sign_test_include_in_mean" &&
    value.ineligible_pair_policy ===
      "retain_in_counts_exclude_from_inference" &&
    value.minimum_mean_paired_difference === 0;
}

function researchMemoryControlPairPlanHasRuntimeShape(
  value: unknown,
  pairIndex: number
): value is ResearchMemoryControlPairPlan {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "pair_index",
    "research_direction_ref",
    "direction_kind",
    "released_memory_treatment",
    "memory_masked_control"
  ]) && value.pair_index === pairIndex &&
    comparisonRef(value.research_direction_ref, "research_direction") &&
    researchDirectionKindHasRuntimeShape(value.direction_kind) &&
    researchMemoryControlArmPlanHasRuntimeShape(
      value.released_memory_treatment,
      "released_memory_treatment"
    ) && researchMemoryControlArmPlanHasRuntimeShape(
      value.memory_masked_control,
      "memory_masked_control"
    ) && value.released_memory_treatment.tick_id !==
      value.memory_masked_control.tick_id;
}

function researchMemoryControlArmPlanHasRuntimeShape(
  value: unknown,
  armKind: ResearchMemoryControlArmKind
): value is ResearchMemoryControlArmPlan {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "arm_kind",
    "memory_mode",
    "tick_id"
  ]) && value.arm_kind === armKind && comparisonString(value.tick_id) &&
    (armKind === "released_memory_treatment"
      ? value.memory_mode === "released_memory"
      : value.memory_mode === "memory_masked");
}

function researchMemoryControlArmResultHasRuntimeShape(
  value: unknown,
  armKind: ResearchMemoryControlArmKind
): value is ResearchMemoryControlArmResult {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "arm_kind",
    "memory_mode",
    "planned_tick_id",
    "terminal_status",
    "failure_kind",
    "tick_evidence",
    "preflight_evidence",
    "worker_evidence",
    "allocation_evidence",
    "admission_evidence",
    "resource_summary",
    "observation",
    "exact_repeat_indicator",
    "ineligibility_reason"
  ]) || value.arm_kind !== armKind || !comparisonString(value.planned_tick_id) ||
    ![
      "completed",
      "no_submission",
      "worker_failed",
      "platform_failed",
      "interrupted"
    ].includes(String(value.terminal_status)) ||
    (armKind === "released_memory_treatment"
      ? value.memory_mode !== "released_memory"
      : value.memory_mode !== "memory_masked") ||
    !researchMemoryControlFailureKindOrNull(value.failure_kind) ||
    !researchMemoryControlTickEvidenceHasRuntimeShape(
      value.tick_evidence,
      value.planned_tick_id
    ) || !researchMemoryControlPreflightEvidenceHasRuntimeShape(
      value.preflight_evidence,
      value.memory_mode as ResearchWorkerMemoryMode
    ) || !researchMemoryControlWorkerEvidenceHasRuntimeShape(
      value.worker_evidence
    ) || !researchMemoryControlAllocationEvidenceHasRuntimeShape(
      value.allocation_evidence
    ) || !researchMemoryControlAdmissionEvidenceHasRuntimeShape(
      value.admission_evidence
    ) || !researchMemoryControlResourceSummaryHasRuntimeShape(
      value.resource_summary
    )) {
    return false;
  }
  const arm = value as unknown as ResearchMemoryControlArmResult;
  const requiresFailure = arm.terminal_status === "worker_failed" ||
    arm.terminal_status === "platform_failed" ||
    arm.terminal_status === "interrupted";
  if (requiresFailure !== (arm.failure_kind !== null)) return false;
  if (arm.observation === "exact_repeat") {
    return arm.terminal_status === "completed" &&
      arm.exact_repeat_indicator === 1 && arm.ineligibility_reason === null &&
      researchMemoryControlCompletedEvidencePresent(arm) &&
      researchMemoryControlAdmissionClassifies(arm.admission_evidence, true);
  }
  if (arm.observation === "distinct_behavior") {
    return arm.terminal_status === "completed" &&
      arm.exact_repeat_indicator === 0 && arm.ineligibility_reason === null &&
      researchMemoryControlCompletedEvidencePresent(arm) &&
      researchMemoryControlAdmissionClassifies(arm.admission_evidence, false);
  }
  return arm.observation === "ineligible" &&
    arm.exact_repeat_indicator === null &&
    researchMemoryControlIneligibilityReason(arm.ineligibility_reason) &&
    researchMemoryControlIneligibleArmMatchesReason(arm);
}

function researchMemoryControlTickEvidenceHasRuntimeShape(
  value: unknown,
  plannedTickId: unknown
): value is ResearchMemoryControlTickEvidence | null {
  if (value === null) return true;
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "tick_ref",
    "tick_id",
    "tick_digest",
    "started_at",
    "completed_at",
    "tick_status",
    "direction_result_status"
  ]) && comparisonRef(value.tick_ref, "candidate_arena_tick") &&
    value.tick_id === plannedTickId &&
    researchControlCampaignSha256Digest(value.tick_digest) &&
    comparisonIso(value.started_at) && comparisonIso(value.completed_at) &&
    Date.parse(value.completed_at) >= Date.parse(value.started_at) &&
    ["completed", "completed_with_errors", "failed"].includes(
      String(value.tick_status)
    ) && [
      "created",
      "duplicate",
      "quarantined",
      "no_submission",
      "failed"
    ].includes(String(value.direction_result_status));
}

function researchMemoryControlPreflightEvidenceHasRuntimeShape(
  value: unknown,
  memoryMode: ResearchWorkerMemoryMode
): value is ResearchMemoryControlPreflightEvidence | null {
  return value === null || (comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "commitment_ref",
      "commitment_digest",
      "development_suite_version",
      "development_suite_digest",
      "sealed_suite_version",
      "sealed_generator_version",
      "sealed_suite_digest",
      "sealed_rotation_commitment_digest",
      "memory_policy"
    ]) && comparisonRef(
      value.commitment_ref,
      "research_preflight_commitment"
    ) && researchControlCampaignSha256Digest(value.commitment_digest) &&
    value.development_suite_version === "research_development_replay_v1" &&
    researchControlCampaignSha256Digest(value.development_suite_digest) &&
    value.sealed_suite_version === "research_sealed_admission_v1" &&
    value.sealed_generator_version === "research_scenario_generator_v1" &&
    researchControlCampaignSha256Digest(value.sealed_suite_digest) &&
    researchControlCampaignSha256Digest(
      value.sealed_rotation_commitment_digest
    ) &&
    researchWorkerMemoryPolicyHasRuntimeShape(value.memory_policy) &&
    value.memory_policy.memory_mode === memoryMode);
}

function researchMemoryControlWorkerEvidenceHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlWorkerEvidence | null {
  return value === null || (comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "worker_ref",
      "agent_profile_id",
      "provider_kind",
      "model"
    ]) && comparisonRef(value.worker_ref, "research_worker") &&
    comparisonString(value.agent_profile_id) && comparisonString(value.model) &&
    ["codex_cli", "claude_code", "local_process", "fixture_only"].includes(
      String(value.provider_kind)
    ));
}

function researchMemoryControlAllocationEvidenceHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlAllocationEvidence | null {
  return value === null || (comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "allocation_ref",
      "allocation_digest",
      "allocation_mode",
      "allocation_policy_digest",
      "direction_kind",
      "selection_kind",
      "experiment_budget"
    ]) && comparisonRef(
      value.allocation_ref,
      "candidate_arena_research_allocation"
    ) && researchControlCampaignSha256Digest(value.allocation_digest) &&
    value.allocation_mode === "explicit" &&
    researchControlCampaignSha256Digest(value.allocation_policy_digest) &&
    researchDirectionKindHasRuntimeShape(value.direction_kind) &&
    value.selection_kind === "explicit" && value.experiment_budget === 1);
}

function researchMemoryControlAdmissionEvidenceHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlAdmissionEvidence | null {
  if (value === null) return true;
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "decision_ref",
    "decision_digest",
    "status",
    "reason",
    "research_worker_outcome",
    "behavior_comparison_status",
    "fingerprint_ref",
    "fingerprint_digest",
    "matching_fingerprint_ref",
    "matching_fingerprint_digest"
  ]) || !comparisonRef(value.decision_ref, "candidate_admission_decision") ||
    !researchControlCampaignSha256Digest(value.decision_digest) ||
    !["admitted", "duplicate", "quarantined"].includes(
      String(value.status)
    ) || ![
      "evaluation_accepted",
      "research_worker_failed",
      "no_candidate_change",
      "experiment_failed",
      "evaluation_disqualified",
      "evaluation_quarantined",
      "evidence_already_counted",
      "evidence_quarantined",
      "paper_handoff_conformance_failed",
      "behavior_duplicate",
      "behavior_fingerprint_unavailable"
    ].includes(String(value.reason)) ||
    !["changed", "unchanged", "failed"].includes(
      String(value.research_worker_outcome)
    ) || !(value.behavior_comparison_status === null || [
      "distinct",
      "duplicate",
      "unavailable"
    ].includes(String(value.behavior_comparison_status)))) {
    return false;
  }
  const linked = [value.fingerprint_ref, value.fingerprint_digest];
  const matching = [
    value.matching_fingerprint_ref,
    value.matching_fingerprint_digest
  ];
  const fingerprintRef = value.fingerprint_ref as Ref | null;
  const fingerprintDigest = value.fingerprint_digest as string | null;
  const matchingFingerprintRef = value.matching_fingerprint_ref as Ref | null;
  const matchingFingerprintDigest =
    value.matching_fingerprint_digest as string | null;
  const linkedPresent = linked.every((item) => item !== null);
  const matchingPresent = matching.every((item) => item !== null);
  if (linked.some((item) => item === null) !==
      linked.every((item) => item === null) ||
    matching.some((item) => item === null) !==
      matching.every((item) => item === null) ||
    (linkedPresent && (!comparisonRef(
      value.fingerprint_ref,
      "research_behavior_fingerprint"
    ) || !researchControlCampaignSha256Digest(value.fingerprint_digest))) ||
    (matchingPresent && (!comparisonRef(
      value.matching_fingerprint_ref,
      "research_behavior_fingerprint"
    ) || !researchControlCampaignSha256Digest(
      value.matching_fingerprint_digest
    )))) {
    return false;
  }
  return value.behavior_comparison_status === "duplicate"
    ? linkedPresent && matchingPresent &&
      fingerprintRef!.id !== matchingFingerprintRef!.id &&
      fingerprintDigest === matchingFingerprintDigest
    : value.behavior_comparison_status === "distinct"
    ? linkedPresent && !matchingPresent
    : !linkedPresent && !matchingPresent;
}

function researchMemoryControlResourceSummaryHasRuntimeShape(
  value: unknown
): value is ResearchMemoryControlResourceSummary | null {
  return value === null || (comparisonObject(value) &&
    comparisonHasExactKeys(value, [
      "provider_request_total",
      "runner_command_total",
      "scenario_count",
      "elapsed_ms"
    ]) && [
      value.provider_request_total,
      value.runner_command_total,
      value.scenario_count,
      value.elapsed_ms
    ].every((item) => comparisonNonNegative(item) && Number.isInteger(item)));
}

function researchMemoryControlFailureKindOrNull(value: unknown): boolean {
  return value === null || [
    "research_worker_failed",
    "provider_failed",
    "runner_failed",
    "restart_interrupted",
    "evidence_reconstruction_failed"
  ].includes(String(value));
}

function researchMemoryControlIneligibilityReason(
  value: unknown
): value is ResearchMemoryControlPairIneligibilityReason {
  return [
    "no_submission",
    "worker_or_platform_failure",
    "behavior_fingerprint_unavailable",
    "malformed_evidence_graph",
    "missing_memory_contrast",
    "interrupted_or_unpaired_run"
  ].includes(String(value));
}

function researchMemoryControlAdmissionClassifies(
  admission: ResearchMemoryControlAdmissionEvidence | null,
  exactRepeat: boolean
): boolean {
  if (!admission) return false;
  if (exactRepeat) {
    return (admission.research_worker_outcome === "unchanged" &&
      admission.status === "duplicate" &&
      admission.reason === "no_candidate_change" &&
      admission.behavior_comparison_status === null) ||
      (admission.research_worker_outcome === "changed" &&
        admission.status === "duplicate" &&
        admission.reason === "behavior_duplicate" &&
        admission.behavior_comparison_status === "duplicate");
  }
  return admission.research_worker_outcome === "changed" &&
    admission.behavior_comparison_status === "distinct";
}

function researchMemoryControlArmAssignmentMatches(
  arm: ResearchMemoryControlArmResult,
  outcome: ResearchMemoryControlPairOutcomeRecord,
  armKind: ResearchMemoryControlArmKind
): boolean {
  const assignment = arm.preflight_evidence?.memory_policy.control_assignment;
  return !assignment || (
    assignment.study_ref.id === outcome.study_ref.id &&
    assignment.study_digest === outcome.study_digest &&
    assignment.pair_index === outcome.pair_index &&
    assignment.arm_kind === armKind
  );
}

function researchMemoryControlMemoryContrastMatches(
  outcome: ResearchMemoryControlPairOutcomeRecord
): boolean {
  const released = outcome.released_memory.preflight_evidence?.memory_policy;
  const masked = outcome.memory_masked.preflight_evidence?.memory_policy;
  return Boolean(released && masked && released.control_assignment &&
    masked.control_assignment && released.available_memory_item_count > 0 &&
    released.available_memory_item_count === masked.available_memory_item_count &&
    released.memory_source_digest === masked.memory_source_digest);
}

function researchMemoryControlCompletedEvidencePresent(
  arm: ResearchMemoryControlArmResult
): boolean {
  return arm.tick_evidence !== null && arm.preflight_evidence !== null &&
    arm.worker_evidence !== null && arm.allocation_evidence !== null &&
    arm.admission_evidence !== null && arm.resource_summary !== null;
}

function researchMemoryControlIneligibleArmMatchesReason(
  arm: ResearchMemoryControlArmResult
): boolean {
  switch (arm.ineligibility_reason) {
    case "no_submission":
      return arm.terminal_status === "no_submission" &&
        arm.failure_kind === null && arm.tick_evidence !== null &&
        arm.preflight_evidence !== null && arm.worker_evidence !== null &&
        arm.allocation_evidence !== null && arm.admission_evidence === null &&
        arm.resource_summary !== null;
    case "worker_or_platform_failure":
      return (arm.terminal_status === "worker_failed" ||
        arm.terminal_status === "platform_failed") &&
        arm.failure_kind !== null && arm.resource_summary !== null &&
        (researchMemoryControlBoundTerminalEvidencePresent(arm) ||
          (arm.terminal_status === "platform_failed" &&
            researchMemoryControlNoEffectTerminalEvidence(arm)));
    case "interrupted_or_unpaired_run":
      return arm.terminal_status === "interrupted" &&
        arm.failure_kind !== null && arm.resource_summary !== null &&
        (researchMemoryControlBoundTerminalEvidencePresent(arm) ||
          researchMemoryControlNoEffectTerminalEvidence(arm));
    case "behavior_fingerprint_unavailable":
      return arm.terminal_status === "completed" &&
        researchMemoryControlCompletedEvidencePresent(arm) &&
        arm.admission_evidence?.behavior_comparison_status === "unavailable";
    case "missing_memory_contrast":
      return arm.terminal_status === "completed" &&
        researchMemoryControlCompletedEvidencePresent(arm);
    case "malformed_evidence_graph":
      return true;
    default:
      return false;
  }
}

function researchMemoryControlBoundTerminalEvidencePresent(
  arm: ResearchMemoryControlArmResult
): boolean {
  return arm.preflight_evidence !== null && arm.worker_evidence !== null &&
    arm.allocation_evidence !== null;
}

function researchMemoryControlNoEffectTerminalEvidence(
  arm: ResearchMemoryControlArmResult
): boolean {
  const resource = arm.resource_summary;
  return arm.tick_evidence === null && arm.preflight_evidence === null &&
    arm.worker_evidence === null && arm.allocation_evidence === null &&
    arm.admission_evidence === null && resource !== null &&
    resource.provider_request_total === 0 &&
    resource.runner_command_total === 0 && resource.scenario_count === 0 &&
    resource.elapsed_ms === 0;
}

function researchMemoryControlInitialStartSkew(
  outcome: ResearchMemoryControlPairOutcomeRecord
): number | null {
  const releasedStartedAt = outcome.released_memory.tick_evidence?.started_at;
  const maskedStartedAt = outcome.memory_masked.tick_evidence?.started_at;
  return releasedStartedAt && maskedStartedAt
    ? Math.abs(Date.parse(releasedStartedAt) - Date.parse(maskedStartedAt))
    : null;
}

function researchMemoryControlPairedEvidenceMatches(
  outcome: ResearchMemoryControlPairOutcomeRecord
): boolean {
  const releasedWorker = outcome.released_memory.worker_evidence;
  const maskedWorker = outcome.memory_masked.worker_evidence;
  const releasedAllocation = outcome.released_memory.allocation_evidence;
  const maskedAllocation = outcome.memory_masked.allocation_evidence;
  const releasedPreflight = outcome.released_memory.preflight_evidence;
  const maskedPreflight = outcome.memory_masked.preflight_evidence;
  return Boolean(releasedWorker && maskedWorker && releasedAllocation &&
    maskedAllocation && releasedPreflight && maskedPreflight &&
    releasedWorker.worker_ref.id === maskedWorker.worker_ref.id &&
    releasedWorker.agent_profile_id === maskedWorker.agent_profile_id &&
    releasedWorker.provider_kind === maskedWorker.provider_kind &&
    releasedWorker.model === maskedWorker.model &&
    releasedAllocation.allocation_mode === maskedAllocation.allocation_mode &&
    releasedAllocation.allocation_policy_digest ===
      maskedAllocation.allocation_policy_digest &&
    releasedAllocation.direction_kind === outcome.direction_kind &&
    maskedAllocation.direction_kind === outcome.direction_kind &&
    releasedAllocation.selection_kind === maskedAllocation.selection_kind &&
    releasedAllocation.experiment_budget ===
      maskedAllocation.experiment_budget &&
    releasedPreflight.development_suite_version ===
      maskedPreflight.development_suite_version &&
    releasedPreflight.development_suite_digest ===
      maskedPreflight.development_suite_digest &&
    releasedPreflight.sealed_suite_version ===
      maskedPreflight.sealed_suite_version &&
    releasedPreflight.sealed_generator_version ===
      maskedPreflight.sealed_generator_version &&
    releasedPreflight.sealed_suite_digest ===
      maskedPreflight.sealed_suite_digest &&
    releasedPreflight.sealed_rotation_commitment_digest ===
      maskedPreflight.sealed_rotation_commitment_digest);
}

function researchMemoryControlStudyPairResultHasRuntimeShape(
  value: unknown,
  pairIndex: number
): value is ResearchMemoryControlStudyPairResult {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "pair_index",
    "pair_outcome_ref",
    "pair_outcome_digest",
    "eligibility_status",
    "ineligibility_reason",
    "paired_difference"
  ]) || value.pair_index !== pairIndex || !comparisonRef(
    value.pair_outcome_ref,
    "research_memory_control_pair_outcome"
  ) || !researchControlCampaignSha256Digest(value.pair_outcome_digest)) {
    return false;
  }
  return value.eligibility_status === "eligible"
    ? value.ineligibility_reason === null &&
      (value.paired_difference === -1 || value.paired_difference === 0 ||
        value.paired_difference === 1)
    : value.eligibility_status === "ineligible" &&
      researchMemoryControlIneligibilityReason(value.ineligibility_reason) &&
      value.paired_difference === null;
}

function researchDirectionKindHasRuntimeShape(
  value: unknown
): value is ResearchDirectionKind {
  return RESEARCH_DIRECTION_KINDS.includes(value as ResearchDirectionKind);
}

export function researchControlStudyHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyRecord {
  if (!comparisonObject(value)) return false;
  const hasGeneralizationAssignment = Object.prototype.hasOwnProperty.call(
    value,
    "generalization_assignment"
  );
  if (!comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_study_id",
    "idempotency_key",
    "hypothesis",
    "baseline_policy",
    "baseline_snapshot_digest",
    "condition",
    "replications",
    ...(hasGeneralizationAssignment ? ["generalization_assignment"] : []),
    "analysis_policy",
    "committed_at",
    "study_digest",
    "research_scheduling_authority",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_study" || value.version !== 1 ||
    !comparisonString(value.research_control_study_id) ||
    !comparisonString(value.idempotency_key) || value.hypothesis !==
      "adaptive_allocation_improves_replicated_qualified_discovery_yield" ||
    value.baseline_policy !== "same_frozen_snapshot" ||
    !researchControlCampaignSha256Digest(value.baseline_snapshot_digest) ||
    !researchControlStudyConditionHasRuntimeShape(value.condition) ||
    !Array.isArray(value.replications) || value.replications.length < 6 ||
    value.replications.length > 30 ||
    !researchControlStudyAnalysisPolicyHasRuntimeShape(value.analysis_policy) ||
    !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    value.research_scheduling_authority !== true ||
    value.evaluation_authority !== false ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  const study = value as unknown as ResearchControlStudyRecord;
  if (hasGeneralizationAssignment &&
    (!researchControlStudyGeneralizationAssignmentHasRuntimeShape(
      study.generalization_assignment
    ) || study.generalization_assignment.assigned_at !== study.committed_at ||
      study.generalization_assignment.source_system_code_artifact_digest !==
        study.condition.source.system_code_artifact_digest)) {
    return false;
  }
  if (!study.replications.every((replication, index) =>
    researchControlStudyReplicationHasRuntimeShape(
      replication,
      index + 1,
      study.baseline_snapshot_digest
    ))) {
    return false;
  }
  return candidateArenaAllocationStringsUnique(
    study.replications.map((entry) => entry.campaign_idempotency_key)
  ) && candidateArenaAllocationStringsUnique(
    study.replications.map((entry) => entry.campaign_ref.id)
  );
}

export function researchControlStudyExecutionLeaseHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyExecutionLeaseRecord {
  if (!comparisonObject(value) || ![
    "active",
    "released",
    "expired"
  ].includes(String(value.lease_status))) {
    return false;
  }
  const terminal = value.lease_status !== "active";
  const exactKeys = [
    "record_kind",
    "version",
    "research_control_study_execution_lease_id",
    "study_ref",
    "study_digest",
    "owner",
    "lease_token",
    "fencing_token",
    "lease_status",
    "lease_duration_ms",
    "acquired_at",
    "renewed_at",
    "expires_at",
    ...(terminal ? ["closed_at", "close_reason"] : []),
    "lease_digest",
    "runtime_coordination_authority",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ];
  if (!comparisonHasExactKeys(value, exactKeys) ||
    value.record_kind !== "research_control_study_execution_lease" ||
    value.version !== 1 ||
    typeof value.research_control_study_execution_lease_id !== "string" ||
    !/^research-control-study-execution-lease-[a-f0-9]{32}$/.test(
      value.research_control_study_execution_lease_id
    ) || !comparisonRef(value.study_ref, "research_control_study") ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    !researchControlStudyExecutionLeaseOwnerHasRuntimeShape(value.owner) ||
    !researchControlStudyExecutionLeaseCanonicalStringShape(value.lease_token) ||
    !researchControlStudyExecutionLeasePositiveInteger(value.fencing_token) ||
    !researchControlStudyExecutionLeasePositiveInteger(
      value.lease_duration_ms
    ) ||
    !comparisonIso(value.acquired_at) || !comparisonIso(value.renewed_at) ||
    !comparisonIso(value.expires_at) ||
    Date.parse(value.renewed_at) < Date.parse(value.acquired_at) ||
    value.runtime_coordination_authority !== true ||
    value.evaluation_authority !== false ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "runtime_coordination_only" ||
    !researchControlCampaignSha256Digest(value.lease_digest)) {
    return false;
  }
  const lease = value as unknown as ResearchControlStudyExecutionLeaseRecord;
  try {
    if (lease.expires_at !== researchControlStudyExecutionLeaseExpiry(
      lease.renewed_at,
      lease.lease_duration_ms
    ) || lease.research_control_study_execution_lease_id !==
      researchControlStudyExecutionLeaseId(lease.study_ref.id, lease.lease_token)) {
      return false;
    }
    if (lease.lease_status === "active") {
      if (lease.closed_at !== undefined || lease.close_reason !== undefined) return false;
    } else if (!comparisonIso(lease.closed_at) ||
      Date.parse(lease.closed_at) < Date.parse(lease.renewed_at) ||
      (lease.lease_status === "released"
        ? lease.close_reason !== "owner_released"
        : lease.close_reason !== "expired_owner_absent" &&
          lease.close_reason !== "expired_fenced_takeover")) {
      return false;
    }
    return lease.lease_digest ===
      researchControlStudyExecutionLeaseExactDigest(lease);
  } catch {
    return false;
  }
}

export function researchControlStudyOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_study_outcome_id",
    "study_ref",
    "study_digest",
    "replication_results",
    "planned_replication_count",
    "completed_replication_count",
    "adaptive_positive_count",
    "static_positive_count",
    "tied_count",
    "non_tied_count",
    "mean_rate_difference",
    "exact_sign_test_p_value",
    "inference_status",
    "causal_scope",
    "policy_decision_eligibility",
    "next_action",
    "adjudicated_at",
    "study_outcome_digest",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_study_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_study_outcome_id) ||
    !comparisonRef(value.study_ref, "research_control_study") ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    !Array.isArray(value.replication_results) ||
    value.replication_results.length < 6 ||
    value.replication_results.length > 30 ||
    !comparisonIso(value.adjudicated_at) ||
    !researchControlCampaignSha256Digest(value.study_outcome_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live" ||
    value.causal_scope !== "same_baseline_stochastic_replication_only") {
    return false;
  }
  const outcome = value as unknown as ResearchControlStudyOutcomeRecord;
  if (!outcome.replication_results.every((result, index) =>
    researchControlStudyReplicationResultHasRuntimeShape(result, index + 1)
  ) || !candidateArenaAllocationStringsUnique(
    outcome.replication_results.map((result) => result.campaign_ref.id)
  ) || !candidateArenaAllocationStringsUnique(
    outcome.replication_results.map((result) => result.campaign_outcome_ref.id)
  )) {
    return false;
  }
  const differences = outcome.replication_results.map(
    (result) => result.observed_rate_difference
  );
  const adaptivePositive = differences.filter((value) => value > 0).length;
  const staticPositive = differences.filter((value) => value < 0).length;
  const tied = differences.length - adaptivePositive - staticPositive;
  const nonTied = adaptivePositive + staticPositive;
  const mean = comparisonRound6(
    differences.reduce((sum, difference) => sum + difference, 0) /
      differences.length
  );
  const pValue = researchControlStudyExactSignPValue(
    adaptivePositive,
    staticPositive
  );
  const supported = nonTied >= 6 && adaptivePositive > staticPositive &&
    pValue <= 0.05 && mean > 0;
  const inference = nonTied < 6
    ? "insufficient_non_tied_replications"
    : supported
    ? "adaptive_effect_supported"
    : "adaptive_effect_not_supported";
  const eligibility = supported
    ? "eligible_for_separate_policy_decision"
    : "not_eligible";
  const nextAction = supported
    ? "review_research_allocation_policy"
    : "accumulate_or_redesign_precommitted_study";
  return outcome.planned_replication_count === differences.length &&
    outcome.completed_replication_count === differences.length &&
    outcome.adaptive_positive_count === adaptivePositive &&
    outcome.static_positive_count === staticPositive &&
    outcome.tied_count === tied && outcome.non_tied_count === nonTied &&
    outcome.mean_rate_difference === mean &&
    outcome.exact_sign_test_p_value === pValue &&
    outcome.inference_status === inference &&
    outcome.policy_decision_eligibility === eligibility &&
    outcome.next_action === nextAction;
}

export function researchGeneralizationOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_generalization_outcome_id",
    "protocol_ref",
    "protocol_digest",
    "target_allocation_policy_digest",
    "slot_results",
    "block_results",
    "planned_study_count",
    "completed_study_count",
    "non_tied_study_count",
    "tied_study_count",
    "missing_study_count",
    "ineligible_study_count",
    "adaptive_positive_count",
    "static_positive_count",
    "distinct_baseline_count",
    "equal_weight_mean_rate_difference",
    "exact_sign_test_p_value",
    "harmful_condition_blocks",
    "inference_status",
    "causal_scope",
    "policy_decision_eligibility",
    "next_action",
    "adjudicated_at",
    "outcome_digest",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_generalization_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.research_generalization_outcome_id) ||
    !comparisonRef(value.protocol_ref, "research_generalization_protocol") ||
    !researchControlCampaignSha256Digest(value.protocol_digest) ||
    !researchControlCampaignSha256Digest(
      value.target_allocation_policy_digest
    ) || !Array.isArray(value.slot_results) ||
    value.slot_results.length !== 6 || !Array.isArray(value.block_results) ||
    value.block_results.length !== 3 || value.planned_study_count !== 6 ||
    !comparisonIso(value.adjudicated_at) ||
    !researchControlCampaignSha256Digest(value.outcome_digest) ||
    value.causal_scope !==
      "pre_effect_market_condition_blocked_cross_baseline_study_effects" ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.policy_replacement_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }
  const outcome = value as unknown as ResearchGeneralizationOutcomeRecord;
  if (!outcome.slot_results.every((slot, index) =>
    researchGeneralizationOutcomeSlotHasRuntimeShape(slot, index + 1)
  ) || !outcome.block_results.every((block, index) =>
    researchGeneralizationOutcomeBlockHasRuntimeShape(block, index)
  )) {
    return false;
  }
  const completed = outcome.slot_results.filter((slot) =>
    slot.slot_status === "completed"
  );
  const missing = outcome.slot_results.filter((slot) =>
    slot.slot_status === "missing_study" ||
    slot.slot_status === "missing_outcome"
  );
  const ineligible = outcome.slot_results.filter((slot) =>
    slot.slot_status === "ineligible"
  );
  const effects = completed.map((slot) => slot.observed_rate_difference!);
  const adaptivePositive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const tied = effects.length - adaptivePositive - staticPositive;
  const nonTied = adaptivePositive + staticPositive;
  const distinctBaselines = new Set(completed.map((slot) =>
    slot.baseline_snapshot_digest!
  )).size;
  if (outcome.completed_study_count !== completed.length ||
    outcome.non_tied_study_count !== nonTied ||
    outcome.tied_study_count !== tied ||
    outcome.missing_study_count !== missing.length ||
    outcome.ineligible_study_count !== ineligible.length ||
    outcome.adaptive_positive_count !== adaptivePositive ||
    outcome.static_positive_count !== staticPositive ||
    outcome.distinct_baseline_count !== distinctBaselines ||
    outcome.exact_sign_test_p_value !== researchControlStudyExactSignPValue(
      adaptivePositive,
      staticPositive
    )) {
    return false;
  }
  const expectedBlocks = ["long", "short", "flat"] as const;
  for (let index = 0; index < expectedBlocks.length; index += 1) {
    const slots = outcome.slot_results.filter((slot) =>
      slot.condition_block === expectedBlocks[index]
    );
    if (!researchGeneralizationOutcomeBlockMatches(
      outcome.block_results[index]!,
      slots
    )) {
      return false;
    }
  }
  const completeBlockMeans = outcome.block_results.map((block) =>
    block.mean_rate_difference
  );
  const equalWeightMean = completeBlockMeans.every((mean) => mean !== null)
    ? comparisonRound6(
        completeBlockMeans.reduce((sum, mean) => sum + Number(mean), 0) / 3
      )
    : null;
  const harmfulBlocks = outcome.block_results.filter((block) =>
    block.mean_rate_difference !== null && block.mean_rate_difference <= 0
  ).map((block) => block.condition_block);
  const sufficient = completed.length === 6 && missing.length === 0 &&
    ineligible.length === 0 && nonTied === 6 && distinctBaselines >= 3 &&
    equalWeightMean !== null;
  const supported = sufficient &&
    outcome.exact_sign_test_p_value <= 0.05 && equalWeightMean > 0 &&
    harmfulBlocks.length === 0;
  const inference = !sufficient
    ? "insufficient_generalization_evidence" as const
    : supported
      ? "generalization_supported" as const
      : "generalization_not_supported" as const;
  const eligibility = supported
    ? "eligible_for_separate_generalization_policy_decision" as const
    : "not_eligible" as const;
  const nextAction = inference === "generalization_supported"
    ? "review_broad_research_allocation_policy" as const
    : inference === "generalization_not_supported"
      ? "retain_negative_generalization_evidence" as const
      : "complete_or_redesign_generalization_protocol" as const;
  return outcome.equal_weight_mean_rate_difference === equalWeightMean &&
    outcome.harmful_condition_blocks.length === harmfulBlocks.length &&
    outcome.harmful_condition_blocks.every((block, index) =>
      block === harmfulBlocks[index]
    ) && outcome.inference_status === inference &&
    outcome.policy_decision_eligibility === eligibility &&
    outcome.next_action === nextAction;
}

function researchGeneralizationOutcomeSlotHasRuntimeShape(
  value: unknown,
  slotIndex: number
): value is ResearchGeneralizationOutcomeSlotResult {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "slot_index",
    "condition_block",
    "condition_block_study_index",
    "planned_study_ref",
    "slot_status",
    "status_reason",
    "study_ref",
    "study_digest",
    "study_outcome_ref",
    "study_outcome_digest",
    "baseline_snapshot_digest",
    "source_system_code_artifact_digest",
    "observed_rate_difference",
    "study_effect_status"
  ]) || value.slot_index !== slotIndex ||
    !comparisonRef(value.planned_study_ref, "research_control_study")) {
    return false;
  }
  const expectedBlocks: ResearchGeneralizationMarketConditionBlock[] = [
    "long", "short", "flat"
  ];
  if (value.condition_block !== expectedBlocks[Math.floor((slotIndex - 1) / 2)] ||
    value.condition_block_study_index !== ((slotIndex - 1) % 2) + 1) {
    return false;
  }
  const slot = value as unknown as ResearchGeneralizationOutcomeSlotResult;
  const hasStudy = comparisonRef(slot.study_ref, "research_control_study") &&
    researchControlCampaignSha256Digest(slot.study_digest) &&
    researchControlCampaignSha256Digest(slot.baseline_snapshot_digest) &&
    comparisonString(slot.source_system_code_artifact_digest);
  const hasOutcome = comparisonRef(
    slot.study_outcome_ref,
    "research_control_study_outcome"
  ) && researchControlCampaignSha256Digest(slot.study_outcome_digest) &&
    comparisonFinite(slot.observed_rate_difference) && [
      "adaptive_positive", "static_positive", "tied"
    ].includes(String(slot.study_effect_status));
  if (slot.slot_status === "missing_study") {
    return slot.status_reason === "planned_study_not_committed" &&
      slot.study_ref === null && slot.study_digest === null &&
      slot.study_outcome_ref === null && slot.study_outcome_digest === null &&
      slot.baseline_snapshot_digest === null &&
      slot.source_system_code_artifact_digest === null &&
      slot.observed_rate_difference === null &&
      slot.study_effect_status === null;
  }
  if (slot.slot_status === "missing_outcome") {
    return slot.status_reason === "study_outcome_not_terminal" && hasStudy &&
      slot.study_ref!.id === slot.planned_study_ref.id &&
      slot.study_outcome_ref === null && slot.study_outcome_digest === null &&
      slot.observed_rate_difference === null &&
      slot.study_effect_status === null;
  }
  if (!hasStudy || !hasOutcome || slot.study_ref!.id !==
      slot.planned_study_ref.id || slot.study_effect_status !==
      (slot.observed_rate_difference! > 0
        ? "adaptive_positive"
        : slot.observed_rate_difference! < 0
          ? "static_positive"
          : "tied")) {
    return false;
  }
  if (slot.slot_status === "completed") {
    return slot.status_reason === "eligible_terminal_study";
  }
  return slot.slot_status === "ineligible" && [
    "protocol_assignment_mismatch",
    "protocol_condition_mismatch",
    "study_commitment_outside_protocol_window",
    "study_spacing_not_elapsed",
    "source_baseline_reused_within_condition_block"
  ].includes(slot.status_reason);
}

function researchGeneralizationOutcomeBlockHasRuntimeShape(
  value: unknown,
  blockIndex: number
): value is ResearchGeneralizationOutcomeBlockResult {
  const blocks: ResearchGeneralizationMarketConditionBlock[] = [
    "long", "short", "flat"
  ];
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "condition_block",
    "planned_study_count",
    "completed_study_count",
    "non_tied_study_count",
    "tied_study_count",
    "missing_study_count",
    "ineligible_study_count",
    "adaptive_positive_count",
    "static_positive_count",
    "distinct_baseline_count",
    "mean_rate_difference",
    "block_status"
  ]) && value.condition_block === blocks[blockIndex] &&
    value.planned_study_count === 2 && [
      "completed_study_count",
      "non_tied_study_count",
      "tied_study_count",
      "missing_study_count",
      "ineligible_study_count",
      "adaptive_positive_count",
      "static_positive_count",
      "distinct_baseline_count"
    ].every((key) => comparisonNonNegative(value[key])) &&
    (value.mean_rate_difference === null ||
      comparisonFinite(value.mean_rate_difference)) && [
      "complete_positive", "complete_non_positive", "incomplete"
    ].includes(String(value.block_status));
}

function researchGeneralizationOutcomeBlockMatches(
  block: ResearchGeneralizationOutcomeBlockResult,
  slots: ResearchGeneralizationOutcomeSlotResult[]
): boolean {
  const completed = slots.filter((slot) => slot.slot_status === "completed");
  const effects = completed.map((slot) => slot.observed_rate_difference!);
  const adaptivePositive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const tied = effects.length - adaptivePositive - staticPositive;
  const mean = completed.length === 2
    ? comparisonRound6(effects.reduce((sum, effect) => sum + effect, 0) / 2)
    : null;
  const status = mean === null
    ? "incomplete"
    : mean > 0
      ? "complete_positive"
      : "complete_non_positive";
  return slots.length === 2 && block.completed_study_count === completed.length &&
    block.non_tied_study_count === adaptivePositive + staticPositive &&
    block.tied_study_count === tied && block.missing_study_count ===
      slots.filter((slot) => slot.slot_status === "missing_study" ||
        slot.slot_status === "missing_outcome").length &&
    block.ineligible_study_count === slots.filter((slot) =>
      slot.slot_status === "ineligible"
    ).length && block.adaptive_positive_count === adaptivePositive &&
    block.static_positive_count === staticPositive &&
    block.distinct_baseline_count === new Set(completed.map((slot) =>
      slot.baseline_snapshot_digest!
    )).size && block.mean_rate_difference === mean &&
    block.block_status === status;
}

export function researchAllocationPolicyDecisionHasRuntimeShape(
  value: unknown
): value is ResearchAllocationPolicyDecisionRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_allocation_policy_decision_id",
    "study_ref",
    "study_digest",
    "study_outcome_ref",
    "study_outcome_digest",
    "target_allocation_policy_digest",
    "decision_policy",
    "decision_status",
    "decision_reason",
    "effective_default_mode",
    "decided_at",
    "policy_decision_digest",
    "research_policy_selection_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_allocation_policy_decision" ||
    value.version !== 1 ||
    !comparisonString(value.research_allocation_policy_decision_id) ||
    !comparisonRef(value.study_ref, "research_control_study") ||
    !researchControlCampaignSha256Digest(value.study_digest) ||
    !comparisonRef(
      value.study_outcome_ref,
      "research_control_study_outcome"
    ) || !researchControlCampaignSha256Digest(value.study_outcome_digest) ||
    !researchControlCampaignSha256Digest(
      value.target_allocation_policy_digest
    ) || !researchAllocationPolicyDecisionPolicyHasRuntimeShape(
      value.decision_policy
    ) || !comparisonIso(value.decided_at) ||
    !researchControlCampaignSha256Digest(value.policy_decision_digest) ||
    value.research_policy_selection_authority !== true ||
    value.evaluation_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_policy_only") {
    return false;
  }
  return value.decision_status === "approved"
    ? value.decision_reason === "supported_same_baseline_adaptive_effect" &&
      value.effective_default_mode === "adaptive_default"
    : value.decision_status === "not_approved" &&
      value.decision_reason === "study_outcome_not_eligible" &&
      value.effective_default_mode === null;
}

function researchAllocationPolicyDecisionPolicyHasRuntimeShape(
  value: unknown
): value is ResearchAllocationPolicyDecisionPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "target_allocation_mode",
    "required_inference_status",
    "required_causal_scope",
    "required_policy_decision_eligibility",
    "application_scope"
  ]) && value.policy_version === "adaptive_supported_effect_v1" &&
    value.target_allocation_mode === "adaptive_default" &&
    value.required_inference_status === "adaptive_effect_supported" &&
    value.required_causal_scope ===
      "same_baseline_stochastic_replication_only" &&
    value.required_policy_decision_eligibility ===
      "eligible_for_separate_policy_decision" &&
    value.application_scope === "future_uncontrolled_candidate_arena_ticks";
}

export function researchGeneralizationPolicyDecisionHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationPolicyDecisionRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_generalization_policy_decision_id",
    "protocol_ref",
    "protocol_digest",
    "generalization_outcome_ref",
    "generalization_outcome_digest",
    "target_allocation_policy_digest",
    "decision_policy",
    "decision_status",
    "decision_reason",
    "effective_default_mode",
    "decided_at",
    "policy_decision_digest",
    "research_policy_selection_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_generalization_policy_decision" ||
    value.version !== 1 ||
    !comparisonString(value.research_generalization_policy_decision_id) ||
    !comparisonRef(value.protocol_ref, "research_generalization_protocol") ||
    !researchControlCampaignSha256Digest(value.protocol_digest) ||
    !comparisonRef(
      value.generalization_outcome_ref,
      "research_generalization_outcome"
    ) || !researchControlCampaignSha256Digest(
      value.generalization_outcome_digest
    ) || !researchControlCampaignSha256Digest(
      value.target_allocation_policy_digest
    ) || !researchGeneralizationPolicyDecisionPolicyHasRuntimeShape(
      value.decision_policy
    ) || !comparisonIso(value.decided_at) ||
    !researchControlCampaignSha256Digest(value.policy_decision_digest) ||
    value.research_policy_selection_authority !== true ||
    value.evaluation_authority !== false ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_policy_only") {
    return false;
  }
  return value.decision_status === "approved"
    ? value.decision_reason ===
        "supported_cross_condition_adaptive_effect" &&
      value.effective_default_mode === "adaptive_default"
    : value.decision_status === "not_approved" &&
      value.decision_reason === "generalization_outcome_not_eligible" &&
      value.effective_default_mode === null;
}

function researchGeneralizationPolicyDecisionPolicyHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationPolicyDecisionPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "target_allocation_mode",
    "required_inference_status",
    "required_causal_scope",
    "required_policy_decision_eligibility",
    "application_scope"
  ]) && value.policy_version === "generalization_supported_adaptive_v1" &&
    value.target_allocation_mode === "adaptive_default" &&
    value.required_inference_status === "generalization_supported" &&
    value.required_causal_scope ===
      "pre_effect_market_condition_blocked_cross_baseline_study_effects" &&
    value.required_policy_decision_eligibility ===
      "eligible_for_separate_generalization_policy_decision" &&
    value.application_scope === "future_uncontrolled_candidate_arena_ticks";
}

function researchGeneralizationMarketClassifierPolicyHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationMarketClassifierPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "symbol",
    "interval",
    "sample_count",
    "fast_mean_sample_count",
    "slow_mean_sample_count",
    "directional_gap_ratio_threshold",
    "observation_boundary_rule",
    "missing_data_rule",
    "classifier_digest"
  ]) && value.policy_version === "btc_usdt_closed_kline_direction_v1" &&
    value.symbol === "BTCUSDT" && value.interval === "1m" &&
    value.sample_count === 30 && value.fast_mean_sample_count === 5 &&
    value.slow_mean_sample_count === 30 &&
    value.directional_gap_ratio_threshold === 0.00005 &&
    value.observation_boundary_rule ===
      "last_fully_closed_minute_before_observation" &&
    value.missing_data_rule === "no_condition_block" &&
    researchControlCampaignSha256Digest(value.classifier_digest);
}

function researchGeneralizationPublicKlineWindowHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationPublicKlineWindow {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "symbol",
    "interval",
    "sample_count",
    "observed_at",
    "closed_window_end_at",
    "source",
    "klines",
    "authority_status",
    "window_digest"
  ]) || value.symbol !== "BTCUSDT" || value.interval !== "1m" ||
    value.sample_count !== 30 || !comparisonIso(value.observed_at) ||
    !comparisonIso(value.closed_window_end_at) ||
    !researchGeneralizationPublicMarketSourceHasRuntimeShape(value.source) ||
    !Array.isArray(value.klines) || value.klines.length !== 30 ||
    value.authority_status !== "read_only" ||
    !researchControlCampaignSha256Digest(value.window_digest)) {
    return false;
  }
  const window = value as unknown as ResearchGeneralizationPublicKlineWindow;
  const observedEpoch = Date.parse(window.observed_at);
  const expectedEnd = Math.floor(observedEpoch / 60_000) * 60_000 - 1;
  if (Date.parse(window.closed_window_end_at) !== expectedEnd) return false;
  const firstOpen = expectedEnd + 1 - 30 * 60_000;
  return window.klines.every((kline, index) =>
    comparisonObject(kline) && comparisonHasExactKeys(kline, [
      "open_time",
      "close_time",
      "close_price"
    ]) && comparisonIso(kline.open_time) && comparisonIso(kline.close_time) &&
    typeof kline.close_price === "string" &&
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(kline.close_price) &&
    Number.isFinite(Number(kline.close_price)) &&
    Number(kline.close_price) > 0 &&
    Date.parse(kline.open_time) === firstOpen + index * 60_000 &&
    Date.parse(kline.close_time) === firstOpen + index * 60_000 + 59_999
  );
}

function researchGeneralizationPublicMarketSourceHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationPublicMarketSource {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "provider_kind",
    "source_kind",
    "rest_base_url",
    "endpoint",
    "authority_status"
  ]) && value.provider_kind === "binance_production_public_market_data" &&
    value.source_kind === "binance_production_public_rest" &&
    comparisonString(value.rest_base_url) &&
    value.endpoint === "/fapi/v1/klines" &&
    value.authority_status === "read_only";
}

function researchControlStudyGeneralizationAssignmentHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyGeneralizationAssignment {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "protocol_ref",
    "protocol_digest",
    "slot_index",
    "condition_block",
    "condition_block_study_index",
    "market_condition",
    "source_system_code_artifact_digest",
    "assigned_at",
    "assignment_digest"
  ]) || !comparisonRef(value.protocol_ref, "research_generalization_protocol") ||
    !researchControlCampaignSha256Digest(value.protocol_digest) ||
    !comparisonPositive(value.slot_index) || value.slot_index > 6 ||
    !["long", "short", "flat"].includes(String(value.condition_block)) ||
    !comparisonPositive(value.condition_block_study_index) ||
    value.condition_block_study_index > 2 ||
    !researchGeneralizationMarketConditionHasRuntimeShape(
      value.market_condition
    ) || !comparisonString(value.source_system_code_artifact_digest) ||
    !comparisonIso(value.assigned_at) ||
    !researchControlCampaignSha256Digest(value.assignment_digest)) {
    return false;
  }
  const assignment = value as unknown as
    ResearchControlStudyGeneralizationAssignment;
  const expectedBlocks: ResearchGeneralizationMarketConditionBlock[] = [
    "long",
    "short",
    "flat"
  ];
  const expectedBlock = expectedBlocks[Math.floor(
    (assignment.slot_index - 1) / 2
  )];
  return assignment.condition_block === expectedBlock &&
    assignment.condition_block_study_index ===
      ((assignment.slot_index - 1) % 2) + 1 &&
    assignment.market_condition.condition_block ===
      assignment.condition_block &&
    Date.parse(assignment.market_condition.classified_at) <=
      Date.parse(assignment.assigned_at);
}

function researchGeneralizationRoundFeature(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function researchGeneralizationProtocolConditionBlocksHaveRuntimeShape(
  value: unknown
): value is ResearchGeneralizationProtocolRecord["condition_blocks"] {
  const blocks: ResearchGeneralizationMarketConditionBlock[] = [
    "long",
    "short",
    "flat"
  ];
  return Array.isArray(value) && value.length === blocks.length &&
    value.every((block, index) =>
      comparisonObject(block) && comparisonHasExactKeys(block, [
        "condition_block",
        "required_study_count"
      ]) && block.condition_block === blocks[index] &&
      block.required_study_count === 2
    );
}

function researchGeneralizationProtocolStudySlotHasRuntimeShape(
  value: unknown,
  slotIndex: number
): value is ResearchGeneralizationProtocolStudySlot {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "slot_index",
    "condition_block",
    "condition_block_study_index",
    "study_idempotency_key",
    "study_ref",
    "replication_idempotency_keys"
  ]) || value.slot_index !== slotIndex ||
    !comparisonString(value.study_idempotency_key) ||
    !comparisonRef(value.study_ref, "research_control_study") ||
    !Array.isArray(value.replication_idempotency_keys) ||
    value.replication_idempotency_keys.length !== 6 ||
    !value.replication_idempotency_keys.every(comparisonString) ||
    !candidateArenaAllocationStringsUnique(
      value.replication_idempotency_keys as string[]
    )) {
    return false;
  }
  const blockIndex = Math.floor((slotIndex - 1) / 2);
  const expectedBlocks: ResearchGeneralizationMarketConditionBlock[] = [
    "long",
    "short",
    "flat"
  ];
  return value.condition_block === expectedBlocks[blockIndex] &&
    value.condition_block_study_index === ((slotIndex - 1) % 2) + 1;
}

function researchGeneralizationProtocolTimingPolicyHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationProtocolTimingPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "minimum_study_commitment_interval_ms",
    "maximum_collection_duration_ms",
    "collection_deadline_at",
    "expiry_policy"
  ]) && value.policy_version === "research_generalization_timing_v1" &&
    value.minimum_study_commitment_interval_ms === 86_400_000 &&
    value.maximum_collection_duration_ms === 7_776_000_000 &&
    comparisonIso(value.collection_deadline_at) &&
    value.expiry_policy === "close_with_missing_slots";
}

function researchGeneralizationProtocolStudyPolicyHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationProtocolStudyPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "replication_count_per_study",
    "tick_count_per_arm",
    "maximum_baseline_regular_file_count",
    "maximum_baseline_total_bytes",
    "source_baseline_reuse_policy"
  ]) && value.policy_version === "research_generalization_study_v1" &&
    value.replication_count_per_study === 6 &&
    value.tick_count_per_arm === 1 &&
    value.maximum_baseline_regular_file_count === 10_000 &&
    value.maximum_baseline_total_bytes === 1_000_000_000 &&
    value.source_baseline_reuse_policy === "unique_within_condition_block";
}

function researchGeneralizationProtocolAnalysisPolicyHasRuntimeShape(
  value: unknown
): value is ResearchGeneralizationProtocolAnalysisPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "primary_estimand",
    "block_weighting",
    "significance_method",
    "alpha",
    "minimum_terminal_study_count",
    "minimum_non_tied_study_count",
    "minimum_distinct_baseline_count",
    "tie_policy",
    "missing_block_policy",
    "harmful_block_policy"
  ]) && value.policy_version === "equal_block_exact_sign_test_v1" &&
    value.primary_estimand ===
      "equal_block_mean_adaptive_minus_static_qualified_discovery_rate" &&
    value.block_weighting === "equal_precommitted_condition_blocks" &&
    value.significance_method === "two_sided_exact_sign_test" &&
    value.alpha === 0.05 && value.minimum_terminal_study_count === 6 &&
    value.minimum_non_tied_study_count === 6 &&
    value.minimum_distinct_baseline_count === 3 &&
    value.tie_policy === "exclude_from_sign_test_include_in_mean" &&
    value.missing_block_policy === "insufficient_generalization_evidence" &&
    value.harmful_block_policy === "non_positive_block_blocks_support";
}

function researchControlStudyConditionHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyCondition {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "source",
    "research_agent",
    "paper_comparator",
    "paper_evaluation_protocol",
    "allocation_policy",
    "allocation_policy_digest",
    "campaign_policy",
    "condition_digest"
  ]) && researchExperimentSourceHasRuntimeShape(value.source) &&
    researchExperimentAgentHasRuntimeShape(value.research_agent) &&
    researchControlCampaignPaperComparatorHasRuntimeShape(
      value.paper_comparator
    ) && value.paper_comparator.comparator_status === "trading_review" &&
    researchControlCampaignPaperEvaluationProtocolHasRuntimeShape(
      value.paper_evaluation_protocol
    ) && value.paper_evaluation_protocol.protocol_status === "bound" &&
    candidateArenaResearchAllocationPolicyHasRuntimeShape(
      value.allocation_policy
    ) && researchControlCampaignSha256Digest(
      value.allocation_policy_digest
    ) && researchControlCampaignPolicyHasRuntimeShape(value.campaign_policy) &&
    researchControlCampaignSha256Digest(value.condition_digest);
}

function researchControlStudyReplicationHasRuntimeShape(
  value: unknown,
  replicationIndex: number,
  baselineSnapshotDigest: string
): value is ResearchControlStudyReplication {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "replication_index",
    "campaign_idempotency_key",
    "campaign_ref",
    "expected_baseline_snapshot_digest"
  ]) && value.replication_index === replicationIndex &&
    comparisonString(value.campaign_idempotency_key) &&
    comparisonRef(value.campaign_ref, "research_control_campaign") &&
    value.expected_baseline_snapshot_digest === baselineSnapshotDigest;
}

function researchControlStudyReplicationResultHasRuntimeShape(
  value: unknown,
  replicationIndex: number
): value is ResearchControlStudyReplicationResult {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "replication_index",
    "campaign_ref",
    "campaign_digest",
    "campaign_outcome_ref",
    "campaign_outcome_digest",
    "observed_rate_difference"
  ]) && value.replication_index === replicationIndex &&
    comparisonRef(value.campaign_ref, "research_control_campaign") &&
    researchControlCampaignSha256Digest(value.campaign_digest) &&
    comparisonRef(
      value.campaign_outcome_ref,
      "research_control_campaign_outcome"
    ) && researchControlCampaignSha256Digest(
      value.campaign_outcome_digest
    ) && comparisonFinite(value.observed_rate_difference) &&
    value.observed_rate_difference >= -1 &&
    value.observed_rate_difference <= 1 &&
    comparisonRound6(value.observed_rate_difference) ===
      value.observed_rate_difference;
}

function researchControlStudyExactSignPValue(
  adaptivePositive: number,
  staticPositive: number
): number {
  const count = adaptivePositive + staticPositive;
  if (count === 0) return 1;
  const lowerTail = Math.min(adaptivePositive, staticPositive);
  let combinations = 0;
  for (let index = 0; index <= lowerTail; index += 1) {
    combinations += researchControlStudyCombination(count, index);
  }
  return comparisonRound6(Math.min(1, 2 * combinations / 2 ** count));
}

function researchControlStudyCombination(count: number, selected: number): number {
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = result * (count - index + 1) / index;
  }
  return result;
}

function researchControlStudyAnalysisPolicyHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyAnalysisPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "primary_estimand",
    "significance_method",
    "alpha",
    "minimum_non_tied_replication_count",
    "tie_policy",
    "minimum_mean_rate_difference"
  ]) && value.policy_version === "paired_exact_sign_test_v1" &&
    value.primary_estimand ===
      "mean_adaptive_minus_static_qualified_discovery_rate" &&
    value.significance_method === "two_sided_exact_sign_test" &&
    value.alpha === 0.05 && value.minimum_non_tied_replication_count === 6 &&
    value.tie_policy === "exclude_from_sign_test_include_in_mean" &&
    value.minimum_mean_rate_difference === 0;
}

export function researchControlCampaignHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_id",
    "idempotency_key",
    "hypothesis",
    "baseline",
    "source",
    "research_agent",
    "paper_comparator",
    "paper_evaluation_protocol",
    "allocation_policy",
    "allocation_policy_digest",
    "arms",
    "policy",
    "committed_at",
    "campaign_digest",
    "research_scheduling_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign" || value.version !== 1 ||
    !comparisonString(value.research_control_campaign_id) ||
    !comparisonString(value.idempotency_key) ||
    value.hypothesis !==
      "adaptive_allocation_improves_prospective_qualified_discovery_yield" ||
    !researchExperimentBaselineHasRuntimeShape(value.baseline) ||
    value.baseline.exclusion_policy !==
      "research_control_campaign_evidence_only" ||
    !researchExperimentSourceHasRuntimeShape(value.source) ||
    !researchExperimentAgentHasRuntimeShape(value.research_agent) ||
    !researchControlCampaignPaperComparatorHasRuntimeShape(
      value.paper_comparator
    ) ||
    !researchControlCampaignPaperEvaluationProtocolHasRuntimeShape(
      value.paper_evaluation_protocol
    ) || !researchControlCampaignPaperProtocolMatchesComparator(
      value.paper_evaluation_protocol,
      value.paper_comparator
    ) ||
    !candidateArenaResearchAllocationPolicyHasRuntimeShape(
      value.allocation_policy
    ) || !researchControlCampaignSha256Digest(value.allocation_policy_digest) ||
    !Array.isArray(value.arms) || value.arms.length !== 2 ||
    !researchControlCampaignPolicyHasRuntimeShape(value.policy) ||
    !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.campaign_digest) ||
    value.research_scheduling_authority !== true ||
    value.evaluation_authority !== false || value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }

  const campaign = value as unknown as ResearchControlCampaignRecord;
  if (!researchControlCampaignArmHasRuntimeShape(
    campaign.arms[0],
    "adaptive_treatment",
    "adaptive_default",
    campaign.policy.tick_count_per_arm
  ) || !researchControlCampaignArmHasRuntimeShape(
    campaign.arms[1],
    "static_control",
    "static_control",
    campaign.policy.tick_count_per_arm
  ) || campaign.baseline.regular_file_count >
      campaign.policy.maximum_baseline_regular_file_count ||
    campaign.baseline.total_bytes >
      campaign.policy.maximum_baseline_total_bytes ||
    campaign.policy.paper_candidate_slot_count_per_arm !==
      campaign.policy.tick_count_per_arm) {
    return false;
  }
  const tickIds = campaign.arms.flatMap((arm) => arm.tick_ids);
  const intentIds = campaign.arms.map(
    (arm) => arm.research_control_campaign_arm_intent_id
  );
  return candidateArenaAllocationStringsUnique(tickIds) &&
    candidateArenaAllocationStringsUnique(intentIds);
}

export function researchControlCampaignArmIntentHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignArmIntentRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_arm_intent_id",
    "campaign_ref",
    "campaign_digest",
    "arm_kind",
    "allocation_mode",
    "baseline_snapshot_digest",
    "tick_ids",
    "committed_at",
    "intent_digest",
    "research_scheduling_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign_arm_intent" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_arm_intent_id) ||
    !comparisonRef(value.campaign_ref, "research_control_campaign") ||
    !researchControlCampaignSha256Digest(value.campaign_digest) ||
    !researchControlCampaignArmModeMatches(
      value.arm_kind,
      value.allocation_mode
    ) || !researchControlCampaignSha256Digest(value.baseline_snapshot_digest) ||
    !stringArray(value.tick_ids) || value.tick_ids.length < 1 ||
    value.tick_ids.length > 5 || !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.intent_digest) ||
    value.research_scheduling_authority !== true ||
    value.evaluation_authority !== false || value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  return true;
}

export function researchControlCampaignReportHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignReportRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_report_id",
    "campaign_ref",
    "campaign_digest",
    "arms",
    "primary_outcome_status",
    "causal_conclusion",
    "next_action",
    "completed_at",
    "report_digest",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign_report" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_report_id) ||
    !comparisonRef(value.campaign_ref, "research_control_campaign") ||
    !researchControlCampaignSha256Digest(value.campaign_digest) ||
    !Array.isArray(value.arms) || value.arms.length !== 2 ||
    value.primary_outcome_status !== "unadjudicated" ||
    value.causal_conclusion !== "not_available_from_research_phase" ||
    value.next_action !== "schedule_prospective_paper_slots" ||
    !comparisonIso(value.completed_at) ||
    !researchControlCampaignSha256Digest(value.report_digest) ||
    value.evaluation_authority !== false || value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "research_only") {
    return false;
  }
  const report = value as unknown as ResearchControlCampaignReportRecord;
  if (!researchControlCampaignArmReportHasRuntimeShape(
    report.arms[0],
    "adaptive_treatment",
    "adaptive_default"
  ) || !researchControlCampaignArmReportHasRuntimeShape(
    report.arms[1],
    "static_control",
    "static_control"
  ) || report.arms[0].tick_refs.length !== report.arms[1].tick_refs.length ||
    report.arms.some((arm) =>
      Date.parse(arm.completed_at) > Date.parse(report.completed_at)
    )) {
    return false;
  }
  const intentIds = report.arms.map((arm) => arm.arm_intent_ref.id);
  const tickIds = report.arms.flatMap((arm) => arm.tick_refs.map((ref) => ref.id));
  return candidateArenaAllocationStringsUnique(intentIds) &&
    candidateArenaAllocationStringsUnique(tickIds);
}

export function researchControlCampaignPaperScheduleHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperScheduleRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_paper_schedule_id",
    "campaign_ref",
    "campaign_digest",
    "report_ref",
    "report_digest",
    "paper_comparator",
    "paper_evaluation_protocol_digest",
    "arms",
    "committed_at",
    "schedule_digest",
    "paper_evaluation_scheduling_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign_paper_schedule" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_paper_schedule_id) ||
    !comparisonRef(value.campaign_ref, "research_control_campaign") ||
    !researchControlCampaignSha256Digest(value.campaign_digest) ||
    !comparisonRef(value.report_ref, "research_control_campaign_report") ||
    !researchControlCampaignSha256Digest(value.report_digest) ||
    !researchControlCampaignPaperComparatorHasRuntimeShape(
      value.paper_comparator
    ) || value.paper_comparator.comparator_status !== "trading_review" ||
    !researchControlCampaignSha256Digest(
      value.paper_evaluation_protocol_digest
    ) || !Array.isArray(value.arms) || value.arms.length !== 2 ||
    !comparisonIso(value.committed_at) ||
    !researchControlCampaignSha256Digest(value.schedule_digest) ||
    value.paper_evaluation_scheduling_authority !== true ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }

  const schedule = value as unknown as ResearchControlCampaignPaperScheduleRecord;
  if (!researchControlCampaignPaperScheduleArmHasRuntimeShape(
    schedule.arms[0],
    "adaptive_treatment"
  ) || !researchControlCampaignPaperScheduleArmHasRuntimeShape(
    schedule.arms[1],
    "static_control"
  ) || schedule.arms[0].slots.length !== schedule.arms[1].slots.length) {
    return false;
  }

  const slots = schedule.arms.flatMap((arm) => arm.slots);
  const candidateSlots = slots.filter(
    (slot): slot is Extract<
      ResearchControlCampaignPaperScheduleSlot,
      { slot_status: "candidate_scheduled" }
    > => slot.slot_status === "candidate_scheduled"
  );
  return candidateArenaAllocationStringsUnique(
    slots.map((slot) => slot.tick_ref.id)
  ) && candidateArenaAllocationStringsUnique(
    candidateSlots.map((slot) => slot.source_comparison_idempotency_key)
  ) && candidateArenaAllocationStringsUnique(
    candidateSlots.map((slot) => slot.source_preparation_id)
  ) && candidateArenaAllocationStringsUnique(
    candidateSlots.map((slot) => slot.source_comparison_commitment_id)
  ) && new Set(candidateSlots.map(
    (slot) => slot.maximum_source_start_delay_ms
  )).size <= 1;
}

export function researchControlCampaignPaperStartBatchHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperStartBatchRecord {
  if (!comparisonObject(value)) return false;
  const ready = value.batch_status === "single_ready" ||
    value.batch_status === "paired_ready";
  const exactKeys = [
    "record_kind",
    "version",
    "research_control_campaign_paper_start_batch_id",
    "schedule_ref",
    "schedule_digest",
    "sequence",
    "batch_status",
    "sides",
    "source_start_deadline_at",
    ...(ready ? [
      "shared_market_snapshot_digest",
      "shared_public_execution_snapshot_digest"
    ] : ["ineligible_reason"]),
    "evaluated_at",
    "start_batch_digest",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ];
  if (!comparisonHasExactKeys(value, exactKeys) ||
    value.record_kind !== "research_control_campaign_paper_start_batch" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_paper_start_batch_id) ||
    !comparisonRef(
      value.schedule_ref,
      "research_control_campaign_paper_schedule"
    ) || !researchControlCampaignSha256Digest(value.schedule_digest) ||
    !comparisonPositive(value.sequence) || value.sequence > 5 ||
    !Array.isArray(value.sides) || value.sides.length < 1 ||
    value.sides.length > 2 ||
    !comparisonIso(value.source_start_deadline_at) ||
    !comparisonIso(value.evaluated_at) ||
    !researchControlCampaignSha256Digest(value.start_batch_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }
  const batch = value as unknown as ResearchControlCampaignPaperStartBatchRecord;
  if (!batch.sides.every(
    researchControlCampaignPaperStartBatchSideHasRuntimeShape
  )) return false;
  const expectedArms = batch.sides.length === 1
    ? [batch.sides[0]!.arm_kind]
    : ["adaptive_treatment", "static_control"];
  if (!batch.sides.every((side, index) =>
    side.arm_kind === expectedArms[index]
  ) || !candidateArenaAllocationStringsUnique(
    batch.sides.map((side) => side.source_comparison_ref.id)
  )) return false;
  const completeSides = batch.sides.filter((side) => side.first_tick_ref);
  if (!candidateArenaAllocationStringsUnique(
    completeSides.map((side) => side.first_tick_ref!.id)
  )) return false;
  const evaluatedMs = Date.parse(batch.evaluated_at);
  const deadlineMs = Date.parse(batch.source_start_deadline_at);
  const latestTickMs = Math.max(...completeSides.map((side) =>
    Date.parse(side.first_tick_observed_at!)), Number.NEGATIVE_INFINITY);

  if (batch.batch_status === "single_ready" ||
    batch.batch_status === "paired_ready") {
    const expectedSideCount = batch.batch_status === "single_ready" ? 1 : 2;
    return batch.sides.length === expectedSideCount &&
      completeSides.length === expectedSideCount &&
      researchControlCampaignSha256Digest(
        batch.shared_market_snapshot_digest
      ) && researchControlCampaignSha256Digest(
        batch.shared_public_execution_snapshot_digest
      ) && latestTickMs <= deadlineMs && evaluatedMs >= latestTickMs;
  }
  if (batch.batch_status !== "ineligible") return false;
  if (batch.ineligible_reason === "first_tick_incomplete") {
    return completeSides.length < batch.sides.length && evaluatedMs >= deadlineMs &&
      evaluatedMs >= latestTickMs;
  }
  if (batch.ineligible_reason === "cross_arm_first_tick_mismatch") {
    return batch.sides.length === 2 && completeSides.length === 2 &&
      latestTickMs <= deadlineMs && evaluatedMs >= latestTickMs;
  }
  return batch.ineligible_reason === "source_start_deadline_missed" &&
    completeSides.length === batch.sides.length && latestTickMs > deadlineMs &&
    evaluatedMs >= latestTickMs;
}

export function researchControlCampaignPaperSlotOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperSlotOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_paper_slot_outcome_id",
    "schedule_ref",
    "schedule_digest",
    "arm_kind",
    "sequence",
    "tick_ref",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "admission_decision_ref",
    "source_comparison_idempotency_key",
    "source_preparation_id",
    "source_comparison_commitment_id",
    "terminal_evidence",
    "terminal_at",
    "slot_outcome_digest",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign_paper_slot_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_paper_slot_outcome_id) ||
    !comparisonRef(
      value.schedule_ref,
      "research_control_campaign_paper_schedule"
    ) || !researchControlCampaignSha256Digest(value.schedule_digest) ||
    !["adaptive_treatment", "static_control"].includes(
      value.arm_kind as string
    ) || !comparisonPositive(value.sequence) ||
    !comparisonRef(value.tick_ref, "candidate_arena_tick") ||
    !comparisonRef(value.candidate_ref, "trading_system_candidate") ||
    !comparisonRef(value.candidate_version_ref, "candidate_version") ||
    !comparisonRef(value.system_code_ref, "system_code") ||
    !researchControlCampaignSha256Digest(value.system_code_artifact_digest) ||
    !comparisonRef(value.admission_decision_ref, "candidate_admission_decision") ||
    !comparisonString(value.source_comparison_idempotency_key) ||
    !comparisonString(value.source_preparation_id) ||
    !comparisonString(value.source_comparison_commitment_id) ||
    !comparisonIso(value.terminal_at) ||
    !researchControlCampaignPaperSlotTerminalEvidenceHasRuntimeShape(
      value.terminal_evidence,
      value.terminal_at
    ) || !researchControlCampaignSha256Digest(value.slot_outcome_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }
  return true;
}

export function researchControlCampaignOutcomeHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignOutcomeRecord {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "record_kind",
    "version",
    "research_control_campaign_outcome_id",
    "campaign_ref",
    "campaign_digest",
    "report_ref",
    "report_digest",
    "schedule_ref",
    "schedule_digest",
    "paper_comparator",
    "shared_evaluation_policy_status",
    "shared_evaluation_policy_digest",
    "arms",
    "observed_rate_difference",
    "observed_result",
    "causal_conclusion",
    "policy_replacement_eligibility",
    "next_action",
    "adjudicated_at",
    "outcome_digest",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) || value.record_kind !== "research_control_campaign_outcome" ||
    value.version !== 1 ||
    !comparisonString(value.research_control_campaign_outcome_id) ||
    !researchControlCampaignOutcomeRef(
      value.campaign_ref,
      "research_control_campaign"
    ) || !researchControlCampaignSha256Digest(value.campaign_digest) ||
    !researchControlCampaignOutcomeRef(
      value.report_ref,
      "research_control_campaign_report"
    ) || !researchControlCampaignSha256Digest(value.report_digest) ||
    !researchControlCampaignOutcomeRef(
      value.schedule_ref,
      "research_control_campaign_paper_schedule"
    ) || !researchControlCampaignSha256Digest(value.schedule_digest) ||
    !researchControlCampaignPaperComparatorHasRuntimeShape(
      value.paper_comparator
    ) || value.paper_comparator.comparator_status !== "trading_review" ||
    value.shared_evaluation_policy_status !== "bound" ||
    !researchControlCampaignSha256Digest(
      value.shared_evaluation_policy_digest
    ) || !Array.isArray(value.arms) || value.arms.length !== 2 ||
    !comparisonFinite(value.observed_rate_difference) ||
    ![
      "adaptive_rate_higher",
      "rates_equal",
      "static_rate_higher"
    ].includes(value.observed_result as string) ||
    value.causal_conclusion !== "single_campaign_observation_only" ||
    value.policy_replacement_eligibility !== "not_eligible" ||
    value.next_action !== "accumulate_replicated_control_campaigns" ||
    !comparisonIso(value.adjudicated_at) ||
    !researchControlCampaignSha256Digest(value.outcome_digest) ||
    value.evaluation_authority !== "external_to_trading_systems" ||
    value.promotion_authority !== false ||
    value.order_submission_authority !== false ||
    value.live_exchange_authority !== false ||
    value.authority_status !== "not_live") {
    return false;
  }

  const outcome = value as unknown as ResearchControlCampaignOutcomeRecord;
  if (!researchControlCampaignOutcomeArmHasRuntimeShape(
    outcome.arms[0],
    "adaptive_treatment",
    "adaptive_default"
  ) || !researchControlCampaignOutcomeArmHasRuntimeShape(
    outcome.arms[1],
    "static_control",
    "static_control"
  ) || outcome.arms[0].metrics.slot_count !==
      outcome.arms[1].metrics.slot_count) {
    return false;
  }

  const adaptiveRate = outcome.arms[0].metrics.qualified_discovery_rate;
  const staticRate = outcome.arms[1].metrics.qualified_discovery_rate;
  const difference = comparisonRound6(adaptiveRate - staticRate);
  const expectedResult = difference > 0
    ? "adaptive_rate_higher"
    : difference < 0
    ? "static_rate_higher"
    : "rates_equal";
  if (outcome.observed_rate_difference !== difference ||
    outcome.observed_result !== expectedResult) {
    return false;
  }

  const slots = outcome.arms.flatMap((arm) => arm.slot_results);
  const paperSlots = slots.filter(
    (slot): slot is Extract<
      ResearchControlCampaignOutcomeSlotResult,
      { terminal_status: ResearchControlCampaignOutcomeTerminalStatus }
    > => slot.terminal_status !== "no_admitted_candidate"
  );
  return researchControlCampaignOutcomeRefsUnique(
    slots.map((slot) => slot.tick_ref)
  ) && researchControlCampaignOutcomeRefsUnique(
    paperSlots.map((slot) => slot.candidate_ref)
  ) && researchControlCampaignOutcomeRefsUnique(
    paperSlots.map((slot) => slot.candidate_version_ref)
  ) && researchControlCampaignOutcomeRefsUnique(
    paperSlots.map((slot) => slot.paper_slot_outcome_ref)
  );
}

function researchControlCampaignOutcomeArmHasRuntimeShape(
  value: unknown,
  armKind: ResearchControlCampaignArmKind,
  allocationMode: "adaptive_default" | "static_control"
): value is ResearchControlCampaignOutcomeArm {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "arm_kind",
    "allocation_mode",
    "slot_results",
    "metrics"
  ]) || value.arm_kind !== armKind || value.allocation_mode !== allocationMode ||
    !Array.isArray(value.slot_results) || value.slot_results.length < 1 ||
    value.slot_results.length > 5 || !value.slot_results.every(
      (slot, index) =>
        researchControlCampaignOutcomeSlotHasRuntimeShape(slot, index + 1)
    ) || !researchControlCampaignOutcomeMetricsHasRuntimeShape(
      value.metrics,
      value.slot_results as ResearchControlCampaignOutcomeSlotResult[]
    )) {
    return false;
  }
  return true;
}

function researchControlCampaignOutcomeSlotHasRuntimeShape(
  value: unknown,
  sequence: number
): value is ResearchControlCampaignOutcomeSlotResult {
  if (!comparisonObject(value) || value.terminal_status ===
      "no_admitted_candidate") {
    return comparisonObject(value) && comparisonHasExactKeys(value, [
      "sequence",
      "tick_ref",
      "terminal_status",
      "discovery_credit"
    ]) && value.sequence === sequence && researchControlCampaignOutcomeRef(
      value.tick_ref,
      "candidate_arena_tick"
    ) && value.terminal_status === "no_admitted_candidate" &&
      value.discovery_credit === 0;
  }

  if (!comparisonHasExactKeys(value, [
    "sequence",
    "tick_ref",
    "terminal_status",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "paper_slot_outcome_ref",
    "paper_slot_outcome_digest",
    "discovery_credit"
  ]) || value.sequence !== sequence || !researchControlCampaignOutcomeRef(
    value.tick_ref,
    "candidate_arena_tick"
  ) || !researchControlCampaignOutcomeRef(
    value.candidate_ref,
    "trading_system_candidate"
  ) || !researchControlCampaignOutcomeRef(
    value.candidate_version_ref,
    "candidate_version"
  ) || !researchControlCampaignOutcomeRef(
    value.system_code_ref,
    "system_code"
  ) || !researchControlCampaignSha256Digest(
    value.system_code_artifact_digest
  ) || !researchControlCampaignOutcomeRef(
    value.paper_slot_outcome_ref,
    "research_control_campaign_paper_slot_outcome"
  ) || !researchControlCampaignSha256Digest(
    value.paper_slot_outcome_digest
  )) {
    return false;
  }

  return [
    "source_not_improved",
    "qualified_improvement",
    "not_reproduced",
    "evidence_ineligible",
    "paper_slot_expired"
  ].includes(value.terminal_status as string) && value.discovery_credit ===
    (value.terminal_status === "qualified_improvement" ? 1 : 0);
}

function researchControlCampaignOutcomeMetricsHasRuntimeShape(
  value: unknown,
  slots: readonly ResearchControlCampaignOutcomeSlotResult[]
): value is ResearchControlCampaignOutcomeArmMetrics {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "slot_count",
    "admitted_candidate_slot_count",
    "no_admitted_candidate_count",
    "qualified_discovery_count",
    "source_not_improved_count",
    "not_reproduced_count",
    "evidence_ineligible_count",
    "paper_slot_expired_count",
    "qualified_discovery_rate"
  ]) || ![
    value.slot_count,
    value.admitted_candidate_slot_count,
    value.no_admitted_candidate_count,
    value.qualified_discovery_count,
    value.source_not_improved_count,
    value.not_reproduced_count,
    value.evidence_ineligible_count,
    value.paper_slot_expired_count
  ].every(comparisonNonNegative) ||
    !comparisonNonNegativeFinite(value.qualified_discovery_rate) ||
    value.qualified_discovery_rate > 1) {
    return false;
  }

  const metrics = value as unknown as ResearchControlCampaignOutcomeArmMetrics;
  const count = (status: ResearchControlCampaignOutcomeSlotResult["terminal_status"]) =>
    slots.filter((slot) => slot.terminal_status === status).length;
  const noCandidateCount = count("no_admitted_candidate");
  const qualifiedCount = count("qualified_improvement");
  const sourceNotImprovedCount = count("source_not_improved");
  const notReproducedCount = count("not_reproduced");
  const evidenceIneligibleCount = count("evidence_ineligible");
  const expiredCount = count("paper_slot_expired");
  return metrics.slot_count === slots.length &&
    metrics.admitted_candidate_slot_count === slots.length - noCandidateCount &&
    metrics.no_admitted_candidate_count === noCandidateCount &&
    metrics.qualified_discovery_count === qualifiedCount &&
    metrics.source_not_improved_count === sourceNotImprovedCount &&
    metrics.not_reproduced_count === notReproducedCount &&
    metrics.evidence_ineligible_count === evidenceIneligibleCount &&
    metrics.paper_slot_expired_count === expiredCount &&
    metrics.admitted_candidate_slot_count === qualifiedCount +
      sourceNotImprovedCount + notReproducedCount + evidenceIneligibleCount +
      expiredCount &&
    metrics.qualified_discovery_rate === comparisonRound6(
      qualifiedCount / slots.length
    );
}

function researchControlCampaignOutcomeRef(
  value: unknown,
  kind: string
): value is Ref {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "record_kind",
    "id"
  ]) && comparisonRef(value, kind);
}

function researchControlCampaignOutcomeRefsUnique(
  refs: readonly Ref[]
): boolean {
  return candidateArenaAllocationStringsUnique(
    refs.map((ref) => `${ref.record_kind}:${ref.id}`)
  );
}

function researchExperimentBaselineHasRuntimeShape(
  value: unknown
): value is ResearchExperimentBaselineSnapshot {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "protocol_version",
    "snapshot_digest",
    "regular_file_count",
    "total_bytes",
    "exclusion_policy"
  ]) && value.protocol_version === "local_store_regular_files_v1" &&
    researchControlCampaignSha256Digest(value.snapshot_digest) &&
    comparisonPositive(value.regular_file_count) &&
    comparisonPositive(value.total_bytes) &&
    (value.exclusion_policy === "research_control_campaign_evidence_only" ||
      value.exclusion_policy === "research_experiment_evidence_only");
}

function researchExperimentSourceHasRuntimeShape(
  value: unknown
): value is ResearchExperimentSource {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "system_code_record_digest",
    "research_artifact_protocol",
    "research_artifact_closure_digest"
  ]) && comparisonRef(value.candidate_ref, "trading_system_candidate") &&
    comparisonRef(value.candidate_version_ref, "candidate_version") &&
    comparisonRef(value.system_code_ref, "system_code") &&
    comparisonDigest(value.system_code_artifact_digest) &&
    researchControlCampaignSha256Digest(value.system_code_record_digest) &&
    value.research_artifact_protocol === "single_file_python_v1" &&
    researchControlCampaignSha256Digest(value.research_artifact_closure_digest);
}

function researchExperimentAgentHasRuntimeShape(
  value: unknown
): value is ResearchExperimentAgentIdentity {
  if (!comparisonObject(value)) return false;
  const keys = [
    "provider",
    ...(value.model !== undefined ? ["model"] : []),
    "permission_policy",
    "identity_digest"
  ];
  if (!comparisonHasExactKeys(value, keys) || ![
    "codex",
    "fixture",
    "claude_code"
  ].includes(value.provider as string) ||
    (value.model !== undefined && !comparisonString(value.model)) ||
    !researchControlCampaignSha256Digest(value.identity_digest)) {
    return false;
  }
  return value.provider === "fixture"
    ? value.permission_policy === "fixture_only"
    : value.permission_policy === "artifact_workspace_only";
}

function researchControlCampaignPaperComparatorHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperComparator {
  if (!comparisonObject(value)) return false;
  if (value.comparator_status === "unavailable") {
    return comparisonHasExactKeys(value, [
      "comparator_status",
      "reason"
    ]) && value.reason === "no_trading_promotion_at_commitment";
  }
  return value.comparator_status === "trading_review" &&
    comparisonHasExactKeys(value, [
      "comparator_status",
      "trading_promotion_ref",
      "trading_promotion_digest",
      "candidate_ref",
      "candidate_version_ref",
      "paper_trading_evaluation_ref"
    ]) && comparisonRef(value.trading_promotion_ref, "trading_promotion") &&
    researchControlCampaignSha256Digest(value.trading_promotion_digest) &&
    comparisonRef(value.candidate_ref, "trading_system_candidate") &&
    comparisonRef(value.candidate_version_ref, "candidate_version") &&
    comparisonRef(
      value.paper_trading_evaluation_ref,
      "paper_trading_evaluation"
    );
}

function researchControlCampaignPaperEvaluationProtocolHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperEvaluationProtocol {
  if (!comparisonObject(value)) return false;
  if (value.protocol_status === "unavailable") {
    return comparisonHasExactKeys(value, [
      "protocol_status",
      "reason"
    ]) && [
      "no_trading_promotion_at_commitment",
      "paper_configuration_unavailable_at_commitment"
    ].includes(value.reason as string);
  }
  if (value.protocol_status !== "bound" || !comparisonHasExactKeys(value, [
    "protocol_status",
    "comparison_policy",
    "market_data_configuration_digest",
    "paper_policy_identity",
    "schedule_policy",
    "protocol_digest"
  ]) || !paperTradingComparisonPolicyHasRuntimeShape(value.comparison_policy) ||
    value.comparison_policy.comparison_mode !== "champion_challenge" ||
    !researchControlCampaignSha256Digest(
      value.market_data_configuration_digest
    ) || !researchControlCampaignPaperPolicyIdentityHasRuntimeShape(
      value.paper_policy_identity
    ) || !researchControlCampaignPaperSchedulePolicyHasRuntimeShape(
      value.schedule_policy,
      value.comparison_policy
    ) || !researchControlCampaignSha256Digest(value.protocol_digest)) {
    return false;
  }
  return true;
}

function researchControlCampaignPaperPolicyIdentityHasRuntimeShape(
  value: unknown
): value is PaperTradingEvaluationPolicyIdentity {
  const keys = [
    "market_data_policy_version",
    "gateway_policy_version",
    "cost_policy_version",
    "funding_policy_version",
    "slippage_policy_version",
    "fill_policy_version",
    "risk_policy_version",
    "paper_account_policy_version",
    "decision_event_protocol_version",
    "persistent_state_boundary_version"
  ];
  return comparisonObject(value) && comparisonHasExactKeys(value, keys) &&
    keys.every((key) => comparisonString(value[key]));
}

function researchControlCampaignPaperSchedulePolicyHasRuntimeShape(
  value: unknown,
  comparisonPolicy: PaperTradingComparisonPolicy
): value is ResearchControlCampaignPaperSchedulePolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "source_start_order",
    "maximum_active_source_pairs",
    "maximum_cross_arm_first_tick_skew_ms",
    "source_missed_start_policy",
    "confirmation_precommit_deadline_ms"
  ]) && value.policy_version === "research-control-paper-schedule-v1" &&
    value.source_start_order === "paired_by_sequence" &&
    value.maximum_active_source_pairs === 2 &&
    comparisonNonNegative(value.maximum_cross_arm_first_tick_skew_ms) &&
    value.maximum_cross_arm_first_tick_skew_ms <=
      comparisonPolicy.maximum_start_skew_ms &&
    value.source_missed_start_policy === "slot_expired" &&
    value.confirmation_precommit_deadline_ms ===
      comparisonPolicy.maximum_elapsed_ms;
}

function researchControlCampaignPaperProtocolMatchesComparator(
  protocol: ResearchControlCampaignPaperEvaluationProtocol,
  comparator: ResearchControlCampaignPaperComparator
): boolean {
  if (comparator.comparator_status === "unavailable") {
    return protocol.protocol_status === "unavailable" &&
      protocol.reason === "no_trading_promotion_at_commitment";
  }
  return protocol.protocol_status === "bound" ||
    protocol.reason === "paper_configuration_unavailable_at_commitment";
}

function researchControlCampaignArmHasRuntimeShape(
  value: unknown,
  armKind: ResearchControlCampaignArmKind,
  allocationMode: "adaptive_default" | "static_control",
  tickCount: number
): value is ResearchControlCampaignArm {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "arm_kind",
    "allocation_mode",
    "research_control_campaign_arm_intent_id",
    "tick_ids"
  ]) && value.arm_kind === armKind && value.allocation_mode === allocationMode &&
    comparisonString(value.research_control_campaign_arm_intent_id) &&
    stringArray(value.tick_ids) && value.tick_ids.length === tickCount;
}

function researchControlCampaignPolicyHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPolicy {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "policy_version",
    "tick_count_per_arm",
    "worker_slot_count_per_tick",
    "concurrency_limit_per_arm",
    "maximum_total_development_submissions_per_tick",
    "arm_execution_policy",
    "maximum_baseline_regular_file_count",
    "maximum_baseline_total_bytes",
    "paper_candidate_slot_count_per_arm",
    "paper_candidate_reservation_rule",
    "primary_metric_kind",
    "required_future_evidence"
  ]) && value.policy_version === "research_control_campaign_v1" &&
    comparisonPositive(value.tick_count_per_arm) && value.tick_count_per_arm <= 5 &&
    value.worker_slot_count_per_tick === 3 &&
    value.concurrency_limit_per_arm === 2 &&
    value.maximum_total_development_submissions_per_tick === 5 &&
    value.arm_execution_policy === "concurrent_per_sequence" &&
    comparisonPositive(value.maximum_baseline_regular_file_count) &&
    value.maximum_baseline_regular_file_count <= 100_000 &&
    comparisonPositive(value.maximum_baseline_total_bytes) &&
    value.maximum_baseline_total_bytes <= 1_000_000_000 &&
    comparisonPositive(value.paper_candidate_slot_count_per_arm) &&
    value.paper_candidate_reservation_rule ===
      "first_admitted_per_tick_in_allocation_order" &&
    value.primary_metric_kind ===
      "prospective_qualified_candidate_discovery_rate" &&
    value.required_future_evidence ===
      "confirmed_comparison_research_release";
}

function researchControlCampaignArmModeMatches(
  armKind: unknown,
  allocationMode: unknown
): boolean {
  return armKind === "adaptive_treatment"
    ? allocationMode === "adaptive_default"
    : armKind === "static_control" && allocationMode === "static_control";
}

function researchControlCampaignDiagnosticsHasRuntimeShape(
  value: unknown,
  tickCount: number
): value is ResearchControlCampaignDiagnostics {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "attempt_count",
    "admitted_candidate_count",
    "duplicate_count",
    "quarantined_count",
    "failed_count",
    "provider_request_total",
    "runner_command_total",
    "scenario_count",
    "elapsed_ms"
  ]) || ![
    value.attempt_count,
    value.admitted_candidate_count,
    value.duplicate_count,
    value.quarantined_count,
    value.failed_count,
    value.provider_request_total,
    value.runner_command_total,
    value.scenario_count,
    value.elapsed_ms
  ].every(comparisonNonNegative)) {
    return false;
  }
  const diagnostics = value as unknown as ResearchControlCampaignDiagnostics;
  return diagnostics.attempt_count === tickCount * 3 &&
    diagnostics.attempt_count === diagnostics.admitted_candidate_count +
      diagnostics.duplicate_count + diagnostics.quarantined_count +
      diagnostics.failed_count;
}

function researchControlCampaignPaperCandidateSlotHasRuntimeShape(
  value: unknown,
  sequence: number,
  tickRef: Ref
): value is ResearchControlCampaignPaperCandidateSlot {
  if (!comparisonObject(value) || value.status === "no_admitted_candidate") {
    return comparisonObject(value) && comparisonHasExactKeys(value, [
      "sequence",
      "tick_ref",
      "status"
    ]) && value.sequence === sequence &&
      paperTradingComparisonRefsEqual(value.tick_ref, tickRef) &&
      value.status === "no_admitted_candidate";
  }
  return comparisonHasExactKeys(value, [
    "sequence",
    "tick_ref",
    "status",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "admission_decision_ref"
  ]) && value.sequence === sequence &&
    paperTradingComparisonRefsEqual(value.tick_ref, tickRef) &&
    value.status === "candidate_reserved" &&
    comparisonRef(value.candidate_ref, "trading_system_candidate") &&
    comparisonRef(value.candidate_version_ref, "candidate_version") &&
    comparisonRef(value.system_code_ref, "system_code") &&
    researchControlCampaignSha256Digest(value.system_code_artifact_digest) &&
    comparisonRef(value.admission_decision_ref, "candidate_admission_decision");
}

function researchControlCampaignPaperScheduleArmHasRuntimeShape(
  value: unknown,
  armKind: ResearchControlCampaignArmKind
): value is ResearchControlCampaignPaperScheduleArm {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "arm_kind",
    "slots"
  ]) && value.arm_kind === armKind && Array.isArray(value.slots) &&
    value.slots.length >= 1 && value.slots.length <= 5 &&
    value.slots.every((slot, index) =>
      researchControlCampaignPaperScheduleSlotHasRuntimeShape(slot, index + 1)
    );
}

function researchControlCampaignPaperScheduleSlotHasRuntimeShape(
  value: unknown,
  sequence: number
): value is ResearchControlCampaignPaperScheduleSlot {
  if (!comparisonObject(value) || value.slot_status === "no_admitted_candidate") {
    return comparisonObject(value) && comparisonHasExactKeys(value, [
      "sequence",
      "tick_ref",
      "slot_status"
    ]) && value.sequence === sequence &&
      comparisonRef(value.tick_ref, "candidate_arena_tick") &&
      value.slot_status === "no_admitted_candidate";
  }
  return comparisonHasExactKeys(value, [
    "sequence",
    "tick_ref",
    "slot_status",
    "candidate_ref",
    "candidate_version_ref",
    "system_code_ref",
    "system_code_artifact_digest",
    "admission_decision_ref",
    "source_comparison_idempotency_key",
    "source_preparation_id",
    "source_comparison_commitment_id",
    "maximum_source_start_delay_ms"
  ]) && value.sequence === sequence &&
    comparisonRef(value.tick_ref, "candidate_arena_tick") &&
    value.slot_status === "candidate_scheduled" &&
    comparisonRef(value.candidate_ref, "trading_system_candidate") &&
    comparisonRef(value.candidate_version_ref, "candidate_version") &&
    comparisonRef(value.system_code_ref, "system_code") &&
    researchControlCampaignSha256Digest(value.system_code_artifact_digest) &&
    comparisonRef(value.admission_decision_ref, "candidate_admission_decision") &&
    comparisonString(value.source_comparison_idempotency_key) &&
    comparisonString(value.source_preparation_id) &&
    comparisonString(value.source_comparison_commitment_id) &&
    comparisonPositive(value.maximum_source_start_delay_ms);
}

function researchControlCampaignPaperStartBatchSideHasRuntimeShape(
  value: unknown
): value is ResearchControlCampaignPaperStartBatchSide {
  if (!comparisonObject(value)) return false;
  const hasTick = value.first_tick_ref !== undefined ||
    value.first_tick_digest !== undefined ||
    value.first_tick_observed_at !== undefined;
  return comparisonHasExactKeys(value, [
    "arm_kind",
    "source_comparison_ref",
    "source_comparison_digest",
    ...(hasTick ? [
      "first_tick_ref",
      "first_tick_digest",
      "first_tick_observed_at"
    ] : [])
  ]) && ["adaptive_treatment", "static_control"].includes(
    value.arm_kind as string
  ) && comparisonRef(
    value.source_comparison_ref,
    "paper_trading_comparison_commitment"
  ) && researchControlCampaignSha256Digest(value.source_comparison_digest) &&
    (!hasTick || comparisonRef(
      value.first_tick_ref,
      "paper_trading_comparison_tick"
    ) && researchControlCampaignSha256Digest(value.first_tick_digest) &&
      comparisonIso(value.first_tick_observed_at));
}

function researchControlCampaignPaperSlotTerminalEvidenceHasRuntimeShape(
  value: unknown,
  terminalAt: string
): value is ResearchControlCampaignPaperSlotTerminalEvidence {
  if (!comparisonObject(value) || !comparisonString(value.evidence_kind)) {
    return false;
  }
  switch (value.evidence_kind) {
    case "source_verdict":
      return comparisonHasExactKeys(value, [
        "evidence_kind",
        "source_comparison_ref",
        "source_comparison_digest",
        "source_verdict_ref",
        "source_verdict_digest",
        "terminal_status"
      ]) && comparisonRef(
        value.source_comparison_ref,
        "paper_trading_comparison_commitment"
      ) && researchControlCampaignSha256Digest(
        value.source_comparison_digest
      ) && comparisonRef(
        value.source_verdict_ref,
        "paper_trading_comparison_verdict"
      ) && researchControlCampaignSha256Digest(value.source_verdict_digest) &&
        ["source_not_improved", "evidence_ineligible"].includes(
          value.terminal_status as string
        );
    case "source_slot_expired":
      return comparisonHasExactKeys(value, [
        "evidence_kind",
        "terminal_status",
        "expired_at"
      ]) && value.terminal_status === "paper_slot_expired" &&
        comparisonIso(value.expired_at) && value.expired_at === terminalAt;
    case "source_start_ineligible": {
      if (!comparisonHasExactKeys(value, [
        "evidence_kind",
        "start_batch_ref",
        "start_batch_digest",
        "terminal_status",
        "reason",
        "persisted_first_tick_refs",
        "persisted_first_tick_digests",
        "evaluated_at"
      ]) || value.terminal_status !== "evidence_ineligible" ||
        ![
          "first_tick_incomplete",
          "cross_arm_first_tick_mismatch",
          "source_start_deadline_missed"
        ].includes(value.reason as string) ||
        !comparisonRef(
          value.start_batch_ref,
          "research_control_campaign_paper_start_batch"
        ) || !researchControlCampaignSha256Digest(value.start_batch_digest) ||
        !Array.isArray(value.persisted_first_tick_refs) ||
        !Array.isArray(value.persisted_first_tick_digests) ||
        value.persisted_first_tick_refs.length !==
          value.persisted_first_tick_digests.length ||
        !value.persisted_first_tick_refs.every((ref) =>
          comparisonRef(ref, "paper_trading_comparison_tick")
        ) || !value.persisted_first_tick_digests.every(
          researchControlCampaignSha256Digest
        ) || !comparisonIso(value.evaluated_at) ||
        value.evaluated_at !== terminalAt) {
        return false;
      }
      const tickIds = (value.persisted_first_tick_refs as Ref[]).map(
        (ref) => ref.id
      );
      if (!candidateArenaAllocationStringsUnique(tickIds)) return false;
      if (value.reason === "first_tick_incomplete") return tickIds.length <= 1;
      if (value.reason === "cross_arm_first_tick_mismatch") {
        return tickIds.length === 2;
      }
      return tickIds.length >= 1 && tickIds.length <= 2;
    }
    case "confirmation_precommit_expired":
      return comparisonHasExactKeys(value, [
        "evidence_kind",
        "source_comparison_ref",
        "source_comparison_digest",
        "source_verdict_ref",
        "source_verdict_digest",
        "terminal_status",
        "expired_at"
      ]) && comparisonRef(
        value.source_comparison_ref,
        "paper_trading_comparison_commitment"
      ) && researchControlCampaignSha256Digest(
        value.source_comparison_digest
      ) && comparisonRef(
        value.source_verdict_ref,
        "paper_trading_comparison_verdict"
      ) && researchControlCampaignSha256Digest(value.source_verdict_digest) &&
        value.terminal_status === "paper_slot_expired" &&
        comparisonIso(value.expired_at) && value.expired_at === terminalAt;
    case "confirmation_release": {
      if (!comparisonHasExactKeys(value, [
        "evidence_kind",
        "confirmation_campaign_ref",
        "confirmation_campaign_digest",
        "confirmation_outcome_ref",
        "confirmation_outcome_digest",
        "research_release_ref",
        "research_release_digest",
        "release_kind",
        "terminal_status"
      ]) || !comparisonRef(
        value.confirmation_campaign_ref,
        "paper_trading_comparison_confirmation_campaign"
      ) || !researchControlCampaignSha256Digest(
        value.confirmation_campaign_digest
      ) || !comparisonRef(
        value.confirmation_outcome_ref,
        "paper_trading_comparison_confirmation_campaign_outcome"
      ) || !researchControlCampaignSha256Digest(
        value.confirmation_outcome_digest
      ) || !comparisonRef(
        value.research_release_ref,
        "paper_trading_comparison_research_release"
      ) || !researchControlCampaignSha256Digest(
        value.research_release_digest
      )) {
        return false;
      }
      const terminalByRelease: Record<
        PaperTradingComparisonResearchReleaseKind,
        Exclude<
          ResearchControlCampaignPaperSlotTerminalStatus,
          "source_not_improved"
        >
      > = {
        confirmed_improvement: "qualified_improvement",
        challenger_not_reproduced: "not_reproduced",
        comparison_evidence_ineligible: "evidence_ineligible",
        campaign_slot_expired: "paper_slot_expired"
      };
      return comparisonString(value.release_kind) &&
        value.release_kind in terminalByRelease &&
        value.terminal_status === terminalByRelease[
          value.release_kind as PaperTradingComparisonResearchReleaseKind
        ];
    }
    default:
      return false;
  }
}

function researchControlCampaignArmReportHasRuntimeShape(
  value: unknown,
  armKind: ResearchControlCampaignArmKind,
  allocationMode: "adaptive_default" | "static_control"
): value is ResearchControlCampaignArmReport {
  if (!comparisonObject(value) || !comparisonHasExactKeys(value, [
    "arm_kind",
    "allocation_mode",
    "arm_intent_ref",
    "arm_intent_digest",
    "tick_refs",
    "allocation_refs",
    "diagnostics",
    "population_diversity",
    "paper_candidate_slots",
    "final_store_snapshot_digest",
    "completed_at",
    "research_diagnostics_authority",
    "promotion_authority",
    "authority_status"
  ]) || value.arm_kind !== armKind || value.allocation_mode !== allocationMode ||
    !comparisonRef(
      value.arm_intent_ref,
      "research_control_campaign_arm_intent"
    ) || !researchControlCampaignSha256Digest(value.arm_intent_digest) ||
    !Array.isArray(value.tick_refs) || value.tick_refs.length < 1 ||
    value.tick_refs.length > 5 || value.tick_refs.some((candidate) =>
      !comparisonRef(candidate, "candidate_arena_tick")
    ) || !Array.isArray(value.allocation_refs) ||
    value.allocation_refs.length !== value.tick_refs.length ||
    value.allocation_refs.some((candidate) =>
      !comparisonRef(candidate, "candidate_arena_research_allocation")
    ) || !researchControlCampaignDiagnosticsHasRuntimeShape(
      value.diagnostics,
      value.tick_refs.length
    ) || !researchPopulationDiversityHasRuntimeShape(value.population_diversity) ||
    !Array.isArray(value.paper_candidate_slots) ||
    value.paper_candidate_slots.length !== value.tick_refs.length ||
    !researchControlCampaignSha256Digest(value.final_store_snapshot_digest) ||
    !comparisonIso(value.completed_at) ||
    value.research_diagnostics_authority !== false ||
    value.promotion_authority !== false ||
    value.authority_status !== "not_promotion_authority") {
    return false;
  }
  const arm = value as unknown as ResearchControlCampaignArmReport;
  if (!candidateArenaAllocationStringsUnique(arm.tick_refs.map((ref) => ref.id)) ||
    !candidateArenaAllocationStringsUnique(
      arm.allocation_refs.map((ref) => ref.id)
    ) || !arm.paper_candidate_slots.every((slot, index) =>
      researchControlCampaignPaperCandidateSlotHasRuntimeShape(
        slot,
        index + 1,
        arm.tick_refs[index]!
      )
    ) || arm.population_diversity.window_tick_count !== arm.tick_refs.length ||
    arm.population_diversity.assigned_directions.sample_count !==
      arm.diagnostics.attempt_count ||
    arm.population_diversity.observed_behaviors.admitted_submission_count !==
      arm.diagnostics.admitted_candidate_count ||
    arm.population_diversity.observed_behaviors.exact_behavior_duplicate_count +
      arm.population_diversity.observed_behaviors.artifact_duplicate_count >
        arm.diagnostics.duplicate_count ||
    arm.population_diversity.observed_behaviors.unavailable_fingerprint_count >
      arm.diagnostics.quarantined_count) {
    return false;
  }
  const reserved = arm.paper_candidate_slots.filter((slot) =>
    slot.status === "candidate_reserved"
  );
  return reserved.length <= arm.diagnostics.admitted_candidate_count &&
    candidateArenaAllocationStringsUnique(reserved.map((slot) =>
      slot.candidate_version_ref.id
    ));
}

function researchControlStudyExecutionLeaseOwnerHasRuntimeShape(
  value: unknown
): value is ResearchControlStudyExecutionLeaseOwner {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "server_instance_id",
    "host_id",
    "process_id",
    "process_start_marker"
  ]) && researchControlStudyExecutionLeaseCanonicalStringShape(
    value.server_instance_id
  ) && researchControlStudyExecutionLeaseCanonicalStringShape(value.host_id) &&
    researchControlStudyExecutionLeasePositiveInteger(value.process_id) &&
    researchControlStudyExecutionLeaseCanonicalStringShape(
      value.process_start_marker
    );
}

function runtimeProcessKind(value: unknown): value is RuntimeProcessKind {
  return value === "research_provider" || value === "candidate_sandbox" ||
    value === "runtime_supervisor";
}

function runtimeProcessTerminalReason(
  value: unknown
): value is RuntimeProcessTerminalReason {
  return value === "completed" || value === "crashed" ||
    value === "timed_out" || value === "shutdown" ||
    value === "restart_terminated" || value === "owner_absent" ||
    value === "pid_reused";
}

function runtimeProcessRef(value: unknown): value is Ref {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "record_kind",
    "id"
  ]) && comparisonRef(value) && runtimeProcessCanonicalString(value.record_kind) &&
    runtimeProcessCanonicalString(value.id);
}

function runtimeProcessOwnerHasRuntimeShape(
  value: unknown
): value is RuntimeProcessOwner {
  return comparisonObject(value) && comparisonHasExactKeys(value, [
    "host_id",
    "process_id",
    "process_start_marker"
  ]) && runtimeProcessCanonicalString(value.host_id) &&
    Number.isSafeInteger(value.process_id) && Number(value.process_id) > 0 &&
    runtimeProcessCanonicalString(value.process_start_marker);
}

function runtimeProcessCanonicalString(value: unknown): value is string {
  return comparisonString(value) && value.trim() === value;
}

function runtimeProcessDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function runtimeProcessOwnershipId(
  processKind: RuntimeProcessKind,
  subjectRef: Ref,
  sessionToken: string
): string {
  return `runtime-process-ownership-${researchControlStudyExecutionLeaseSha256Hex(
    `${processKind}:${subjectRef.record_kind}:${subjectRef.id}:${sessionToken}`
  ).slice(0, 32)}`;
}

function runtimeProcessOwnershipExactDigest(
  record: RuntimeProcessOwnershipRecord
): string {
  return `sha256:${researchControlStudyExecutionLeaseSha256Hex(
    runtimeProcessOwnershipDigestInput(record)
  )}`;
}

function runtimeProcessPendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function runtimeProcessOwnershipInvalidDecision():
  RuntimeProcessOwnershipDecisionError {
  return new RuntimeProcessOwnershipDecisionError();
}

function researchControlStudyExecutionLeaseCanonicalStringShape(
  value: unknown
): value is string {
  return comparisonString(value) && value.trim() === value;
}

function researchControlStudyExecutionLeasePositiveInteger(
  value: unknown
): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function researchControlStudyExecutionLeaseCanonicalString(
  value: unknown
): string {
  if (!researchControlStudyExecutionLeaseCanonicalStringShape(value)) {
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
  return value;
}

function researchControlStudyExecutionLeaseCanonicalTime(value: unknown): string {
  const text = researchControlStudyExecutionLeaseCanonicalString(value);
  if (!comparisonIso(text)) {
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
  return text;
}

function researchControlStudyExecutionLeaseExpiry(
  renewedAt: string,
  leaseDurationMs: number
): string {
  const expiry = Date.parse(renewedAt) + leaseDurationMs;
  if (!Number.isSafeInteger(expiry)) {
    throw researchControlStudyExecutionLeaseInvalidDecision();
  }
  return new Date(expiry).toISOString();
}

function researchControlStudyExecutionLeaseId(
  studyId: string,
  leaseToken: string
): string {
  return `research-control-study-execution-lease-${
    researchControlStudyExecutionLeaseSha256Hex(`${studyId}:${leaseToken}`)
      .slice(0, 32)
  }`;
}

function researchControlStudyExecutionLeaseExactDigest(
  record: ResearchControlStudyExecutionLeaseRecord
): string {
  return `sha256:${researchControlStudyExecutionLeaseSha256Hex(
    researchControlStudyExecutionLeaseDigestInput(record)
  )}`;
}

function researchControlStudyExecutionLeasePendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function researchControlStudyExecutionLeaseInvalidDecision():
  ResearchControlStudyExecutionLeaseDecisionError {
  return new ResearchControlStudyExecutionLeaseDecisionError();
}

const RESEARCH_CONTROL_STUDY_EXECUTION_LEASE_SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function researchControlStudyExecutionLeaseRotateRight(
  value: number,
  bits: number
): number {
  return (value >>> bits) | (value << (32 - bits));
}

function researchControlStudyExecutionLeaseSha256Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const hash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15]!;
      const right = words[index - 2]!;
      const sigma0 = researchControlStudyExecutionLeaseRotateRight(left, 7) ^
        researchControlStudyExecutionLeaseRotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = researchControlStudyExecutionLeaseRotateRight(right, 17) ^
        researchControlStudyExecutionLeaseRotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16]! + sigma0 + words[index - 7]! +
        sigma1) >>> 0;
    }
    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = researchControlStudyExecutionLeaseRotateRight(e, 6) ^
        researchControlStudyExecutionLeaseRotateRight(e, 11) ^
        researchControlStudyExecutionLeaseRotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sigma1 + choice +
        RESEARCH_CONTROL_STUDY_EXECUTION_LEASE_SHA256_CONSTANTS[index]! +
        words[index]!) >>> 0;
      const sigma0 = researchControlStudyExecutionLeaseRotateRight(a, 2) ^
        researchControlStudyExecutionLeaseRotateRight(a, 13) ^
        researchControlStudyExecutionLeaseRotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
}

function researchControlCampaignSha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
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
  research_preflight?: CandidateArenaResearchPreflightReadModel;
  paper_handoff_conformance?: {
    conformance_id: string;
    status: PaperTradingHandoffConformanceStatus;
    reason: PaperTradingHandoffConformanceReason;
    candidate_egress_attestation?: {
      attestation_id: string;
      verification_status: "verified";
      enforcement_result: "enforced";
      network_policy_digest: string;
      denial_summary: {
        required_probe_count: number;
        start_denied_probe_count: number;
        end_denied_probe_count: number;
        unexpected_allow_count: 0;
      };
      authority_status: "research_only";
    };
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

export type ResearchGeneralizationReadModelStatus =
  | "not_started"
  | "collecting"
  | "awaiting_outcome"
  | "closed";

export type ResearchGeneralizationActiveProtocolNextAction =
  | "collect_precommitted_studies"
  | "complete_assigned_studies"
  | "await_outcome_reconciliation";

export interface ResearchGeneralizationConditionBlockProgressReadModel {
  condition_block: ResearchGeneralizationMarketConditionBlock;
  planned_study_count: number;
  assigned_study_count: number;
  terminal_study_count: number;
}

export interface ResearchGeneralizationActiveProtocolReadModel {
  research_generalization_protocol_id: string;
  committed_at: string;
  collection_deadline_at: string;
  status: "collecting" | "awaiting_outcome";
  planned_study_count: number;
  assigned_study_count: number;
  terminal_study_count: number;
  condition_blocks: ResearchGeneralizationConditionBlockProgressReadModel[];
  next_action: ResearchGeneralizationActiveProtocolNextAction;
  authority_status: "research_only";
}

export interface ResearchGeneralizationLatestOutcomeReadModel {
  research_generalization_outcome_id: string;
  research_generalization_protocol_id: string;
  inference_status: ResearchGeneralizationOutcomeRecord["inference_status"];
  adjudicated_at: string;
  planned_study_count: number;
  completed_study_count: number;
  non_tied_study_count: number;
  tied_study_count: number;
  missing_study_count: number;
  ineligible_study_count: number;
  distinct_baseline_count: number;
  equal_weight_mean_rate_difference: number | null;
  exact_sign_test_p_value: number;
  harmful_condition_blocks: ResearchGeneralizationMarketConditionBlock[];
  policy_decision_eligibility:
    ResearchGeneralizationOutcomeRecord["policy_decision_eligibility"];
  next_action: ResearchGeneralizationOutcomeRecord["next_action"];
  policy_replacement_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "not_live";
}

export interface ResearchGeneralizationLatestPolicyDecisionReadModel {
  research_generalization_policy_decision_id: string;
  research_generalization_protocol_id: string;
  research_generalization_outcome_id: string;
  decision_status: ResearchGeneralizationPolicyDecisionRecord[
    "decision_status"
  ];
  decision_reason: ResearchGeneralizationPolicyDecisionRecord[
    "decision_reason"
  ];
  effective_default_mode: ResearchGeneralizationPolicyDecisionRecord[
    "effective_default_mode"
  ];
  decided_at: string;
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
}

export type ResearchGeneralizationPolicyApplicationStatus =
  | "awaiting_allocation"
  | "allocated"
  | "completed_tick";

export interface ResearchGeneralizationPolicyApplicationLatestAllocationReadModel {
  candidate_arena_research_allocation_id: string;
  tick_id: string;
  allocated_at: string;
  completed_at: string | null;
}

export interface ResearchGeneralizationPolicyApplicationReadModel {
  application_status: ResearchGeneralizationPolicyApplicationStatus;
  allocation_count: number;
  completed_tick_count: number;
  latest_allocation:
    ResearchGeneralizationPolicyApplicationLatestAllocationReadModel | null;
}

export interface ResearchGeneralizationEffectivePolicyDecisionReadModel {
  research_generalization_policy_decision_id: string;
  research_generalization_protocol_id: string;
  research_generalization_outcome_id: string;
  effective_default_mode: "adaptive_default";
  decided_at: string;
  application: ResearchGeneralizationPolicyApplicationReadModel;
  research_policy_selection_authority: true;
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  live_exchange_authority: false;
  authority_status: "research_policy_only";
}

export interface ResearchGeneralizationReadModel {
  status: ResearchGeneralizationReadModelStatus;
  protocol_count: number;
  outcome_count: number;
  active_protocol: ResearchGeneralizationActiveProtocolReadModel | null;
  latest_outcome: ResearchGeneralizationLatestOutcomeReadModel | null;
  latest_policy_decision:
    ResearchGeneralizationLatestPolicyDecisionReadModel | null;
  effective_policy_decision:
    ResearchGeneralizationEffectivePolicyDecisionReadModel | null;
  authority_status: "not_promotion_authority";
}

export interface CandidateArenaReadModel {
  arena_kind: "candidate_arena";
  runner_status: "running" | "stopped";
  tick_count: number;
  research_generalization: ResearchGeneralizationReadModel;
  research_population_diversity: ResearchPopulationDiversityReadModel;
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

export type ArenaOperationsLoopStatus =
  | "stopped"
  | "starting"
  | "running"
  | "degraded"
  | "stopping";

export type ArenaPaperSessionStatus =
  | "queued"
  | "starting"
  | "running"
  | "recovering"
  | "stopped"
  | "completed"
  | "failed"
  | "invalidated";

export type ArenaRankStatus =
  | "provisional_ranked"
  | "ranked"
  | "unranked";

export type ArenaComparabilityStatus =
  | "comparable"
  | "ineligible"
  | "incomparable";

export type ArenaUnrankedReason =
  | "paper_evaluation_not_started"
  | "comparison_cohort_missing"
  | "comparison_cohort_mismatch"
  | "common_observation_boundary_missing"
  | "evidence_purpose_not_rankable"
  | "paper_evaluation_invalidated"
  | "comparison_evidence_incomplete";

export interface ArenaComparisonCohortReadModel {
  cohort_id: string;
  symbol: "BTCUSDT";
  evidence_purpose: PaperTradingEvidencePurpose;
  market_opportunity_policy_digest: string;
  account_policy_digest: string;
  cost_policy_digest: string;
  risk_policy_digest: string;
  evaluation_policy_identity: PaperTradingEvaluationPolicyIdentity;
  evaluation_window_policy: PaperTradingEvaluationWindowPolicy;
  authority_status: "not_live";
}

export interface ArenaIsolationReadModel {
  isolation_id?: string;
  sandbox_status:
    | "not_started"
    | "starting"
    | "running"
    | "stopping"
    | "stopped"
    | "failed";
  workspace_identity?: string;
  network_policy_status: "not_required" | "pending" | "verified" | "failed";
  egress_attestation_status: "not_required" | "pending" | "verified" | "failed";
  authority_status: "not_live";
}

interface ArenaTradingSystemSummaryBaseReadModel {
  candidate_id: string;
  candidate_version_id: string;
  system_code_ref: Ref & { record_kind: "system_code" };
  display_name: string;
  direction_kind: ResearchDirectionKind;
  runner_status: PaperTradingBoardRunnerStatus;
  sandbox_status: ArenaIsolationReadModel["sandbox_status"];
  evaluation_id?: string;
  trading_run_id?: string;
  profit_loss?: TradingProfitLossReadModel;
  observation_count: number;
  failed_observation_count: number;
  queued_at: string;
  started_at?: string;
  last_observed_at?: string;
  next_observation_at?: string;
  stopped_at?: string;
  latest_failure?: PaperTradingFailureReadModel;
  latest_decision?: PaperTradingDecisionSummary;
  latest_fill?: PaperTradingFillSummary;
  authority_status: "not_live";
}

interface ArenaRankedTradingSystemSummaryBaseReadModel
  extends ArenaTradingSystemSummaryBaseReadModel {
  evaluation_id: string;
  trading_run_id: string;
  profit_loss: TradingProfitLossReadModel;
  rank: number;
  comparability_status: "comparable";
  unranked_reasons: [];
  comparison_cohort: ArenaComparisonCohortReadModel;
  comparison_sequence: number;
  comparison_cutoff_at: string;
}

export interface ArenaProvisionallyRankedTradingSystemSummaryReadModel
  extends ArenaRankedTradingSystemSummaryBaseReadModel {
  session_status: "running" | "recovering";
  rank_status: "provisional_ranked";
}

export interface ArenaFinallyRankedTradingSystemSummaryReadModel
  extends ArenaRankedTradingSystemSummaryBaseReadModel {
  session_status: "stopped" | "completed";
  rank_status: "ranked";
}

export type ArenaRankedTradingSystemSummaryReadModel =
  | ArenaProvisionallyRankedTradingSystemSummaryReadModel
  | ArenaFinallyRankedTradingSystemSummaryReadModel;

export interface ArenaComparableUnrankedTradingSystemSummaryReadModel
  extends ArenaTradingSystemSummaryBaseReadModel {
  session_status: ArenaPaperSessionStatus;
  rank_status: "unranked";
  rank?: never;
  comparability_status: "comparable";
  unranked_reasons: [ArenaUnrankedReason, ...ArenaUnrankedReason[]];
  comparison_cohort: ArenaComparisonCohortReadModel;
  comparison_sequence?: never;
  comparison_cutoff_at?: never;
}

export interface ArenaNonComparableUnrankedTradingSystemSummaryReadModel
  extends ArenaTradingSystemSummaryBaseReadModel {
  session_status: ArenaPaperSessionStatus;
  rank_status: "unranked";
  rank?: never;
  comparability_status: Exclude<ArenaComparabilityStatus, "comparable">;
  unranked_reasons: [ArenaUnrankedReason, ...ArenaUnrankedReason[]];
  comparison_cohort?: never;
  comparison_sequence?: never;
  comparison_cutoff_at?: never;
}

export type ArenaTradingSystemSummaryReadModel =
  | ArenaRankedTradingSystemSummaryReadModel
  | ArenaComparableUnrankedTradingSystemSummaryReadModel
  | ArenaNonComparableUnrankedTradingSystemSummaryReadModel;

export type ArenaTraceEventKind =
  | "lifecycle"
  | "market_observation"
  | "trading_system_decision"
  | "gateway_outcome"
  | "ledger_entry"
  | "recovery";

export interface ArenaTraceEventReadModel {
  sequence: number;
  occurred_at: string;
  event_kind: ArenaTraceEventKind;
  summary: string;
  sanitized: true;
  record_ref?: Ref;
  authority_status: "read_only";
}

export interface ArenaLogEntryReadModel {
  sequence: number;
  occurred_at: string;
  level: "debug" | "info" | "warn" | "error";
  source: "trading_system" | "sandbox" | "gateway" | "ledger" | "supervisor";
  message: string;
  sanitized: true;
  authority_status: "read_only";
}

export type ArenaTradingSystemDetailReadModel = ArenaTradingSystemSummaryReadModel & {
  candidate_admission_decision_ref: Ref & {
    record_kind: "candidate_admission_decision";
  };
  paper_trading_handoff_conformance_ref: Ref & {
    record_kind: "paper_trading_handoff_conformance";
  };
  isolation: ArenaIsolationReadModel;
  trading_system_manifest: {
    summary: string;
    declared_runtime?: string;
    declared_outputs: string[];
    allowed_stages: string[];
    declared_permissions: string[];
    forbidden_contents: string[];
  };
  lineage?: FullCycleLineageReadModel;
  latest_market_snapshot?: PaperTradingMarketSnapshotSummary;
  latest_decision?: PaperTradingDecisionSummary;
  paper_account_snapshot?: PaperTradingAccountSnapshot;
  open_orders: PaperTradingOrderSummary[];
  latest_fill?: PaperTradingFillSummary;
  trace_events: ArenaTraceEventReadModel[];
  log_entries: ArenaLogEntryReadModel[];
  artifact_refs: Ref[];
  trace_truncated: boolean;
  logs_truncated: boolean;
};

export interface ArenaOperationsReadModel {
  projection_kind: "arena_operations";
  loop_status: ArenaOperationsLoopStatus;
  capacity: {
    max_concurrent_sessions: number;
    active_session_count: number;
    queued_session_count: number;
  };
  systems: ArenaTradingSystemSummaryReadModel[];
  latest_system_id?: string;
  live_disabled: true;
  authority_status: "not_live";
}

export type ResearchOperationsLoopStatus =
  | "stopped"
  | "starting"
  | "running"
  | "degraded"
  | "stopping";

export type ResearchTriggerKind =
  | "goal"
  | "time"
  | "arena_event"
  | "live_event"
  | "recovery";

export type ResearchSessionStatus =
  | "queued"
  | "allocating"
  | "running"
  | "awaiting_selection"
  | "sealed_admission"
  | "admitted"
  | "duplicate"
  | "quarantined"
  | "finished_without_submission"
  | "failed_closed"
  | "recovering";

export interface ResearchTriggerReadModel {
  trigger_kind: ResearchTriggerKind;
  trigger_id: string;
  goal: string;
  triggered_at: string;
  source_ref?: Ref;
  evidence_artifact_ref?: Ref & {
    record_kind: "research_evidence_artifact";
  };
  evidence_artifact_digest?: string;
  authority_status: "research_only";
}

export type ResearchEvidenceArtifactSourceKind =
  | "arena_paper_result"
  | "arena_trace"
  | "arena_failure"
  | "research_finding"
  | "live_result"
  | "live_trace";

export interface ResearchEvidenceArtifactReadModel {
  evidence_artifact_id: string;
  source_kind: ResearchEvidenceArtifactSourceKind;
  subject_ref: Ref;
  artifact_ref: Ref;
  artifact_digest: string;
  captured_at: string;
  sanitization_status: "sanitized";
  qualification_evidence_hidden: true;
  authority_status: "research_only";
}

export interface ResearchMethodologyReadModel {
  direction_kind: ResearchDirectionKind;
  hypothesis: string;
  method: string;
  source_candidate_id?: string;
  evidence_artifact_ids: string[];
  authority_status: "research_only";
}

export interface ResearchSessionBudgetReadModel {
  max_experiment_count: number;
  completed_experiment_count: number;
  max_development_submission_count: number;
  development_submission_count: number;
  remaining_development_submission_count: number;
  authority_status: "research_only";
}

export interface ResearchSessionSummaryReadModel {
  research_work_item_id: string;
  research_allocation_id: string;
  research_worker_id?: string;
  research_worker_session_id?: string;
  commitment_id?: string;
  status: ResearchSessionStatus;
  trigger: ResearchTriggerReadModel;
  methodology: ResearchMethodologyReadModel;
  provider: AgentProfileProviderKind;
  model?: string;
  budget: ResearchSessionBudgetReadModel;
  started_at?: string;
  last_progress_at?: string;
  completed_at?: string;
  selected_submission_sequence?: number;
  admitted_candidate_id?: string;
  latest_progress_summary: string;
  authority_status: "research_only";
}

export interface ResearchDevelopmentSubmissionReadModel {
  submission_sequence: number;
  system_code_ref: Ref & { record_kind: "system_code" };
  system_code_digest: string;
  submitted_at: string;
  status: "evaluated" | "failed";
  selected: boolean;
  aggregate_feedback_summary?: string;
  authority_status: "research_only";
}

export interface ResearchSessionDetailReadModel
  extends ResearchSessionSummaryReadModel {
  evidence_inputs: ResearchEvidenceArtifactReadModel[];
  development_submissions: ResearchDevelopmentSubmissionReadModel[];
  selected_system_code_ref?: Ref & { record_kind: "system_code" };
  admission_decision_ref?: Ref & {
    record_kind: "candidate_admission_decision";
  };
  paper_handoff_conformance_ref?: Ref & {
    record_kind: "paper_trading_handoff_conformance";
  };
  notebook_summary: string[];
  log_entries: Array<{
    sequence: number;
    occurred_at: string;
    level: "debug" | "info" | "warn" | "error";
    source: "research_worker" | "provider" | "evaluator" | "supervisor";
    message: string;
    sanitized: true;
    authority_status: "read_only";
  }>;
  logs_truncated: boolean;
}

export interface ResearchOperationsReadModel {
  projection_kind: "research_operations";
  loop_status: ResearchOperationsLoopStatus;
  capacity: {
    max_concurrent_sessions: number;
    active_session_count: number;
    queued_session_count: number;
  };
  sessions: ResearchSessionSummaryReadModel[];
  latest_session_id?: string;
  authority_status: "research_only";
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
  runtime_supervisor: RuntimeSupervisorReadModel;
  candidate_arena: CandidateArenaReadModel;
  selected_candidate_id: string | null;
  selected_candidate: CandidateInspectReadModel | null;
  selected_paper_evidence: SelectedPaperEvidenceReadModel;
  selected_paper_trading_evaluation: PaperTradingEvaluationReadModel;
  paper_trading_board: PaperTradingBoardReadModel;
  arena_operations?: ArenaOperationsReadModel;
  research_operations?: ResearchOperationsReadModel;
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
  | ResearchEvidenceArtifactRecord
  | ExperimentRunRecord
  | ResearchPreflightCommitmentRecord
  | ResearchBehaviorFingerprintRecord
  | ResearchWorkerCheckpointRecord
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
  | ResearchControlCampaignRecord
  | ResearchControlCampaignArmIntentRecord
  | ResearchControlCampaignReportRecord
  | ResearchControlCampaignPaperScheduleRecord
  | ResearchControlCampaignPaperStartBatchRecord
  | ResearchControlCampaignPaperSlotOutcomeRecord
  | ResearchControlCampaignOutcomeRecord
  | ResearchControlStudyRecord
  | ResearchControlStudyOutcomeRecord
  | ResearchMemoryControlStudyRecord
  | ResearchMemoryControlPairOutcomeRecord
  | ResearchMemoryControlStudyOutcomeRecord
  | ResearchAllocationPolicyDecisionRecord
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
  workspace_key?: string;
  generation?: number;
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
