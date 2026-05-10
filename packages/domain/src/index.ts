export type FixtureMode = "fixture_convenience_mode";

export type NonAuthorityStatus =
  | "not_executed"
  | "not_probed"
  | "not_scanned"
  | "not_mounted"
  | "not_granted"
  | "not_counted"
  | "not_promoted"
  | "not_live";

export type ProviderKind = "codex_cli" | "local_process" | "fixture_only";

export type AgentRunPurpose = "candidate_generation" | "candidate_generation_placeholder";

export type AgentRunStatus = "succeeded" | "failed" | "rejected" | "fixture_placeholder";

export type CandidateStatus = "fixture_only" | "materialized";

export type CandidateMaterializationStatus = "materialized" | "failed";

export type StageBindingStage = "backtest" | "paper" | "live";

export type StageBindingProfile = "backtest" | "paper" | "live";

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

export type TraderSystemRuntimeLifecycleStatus =
  | "registered"
  | "deployed"
  | "starting"
  | "running"
  | "paused"
  | "stopping"
  | "stopped"
  | "failed"
  | "killed"
  | "review_required"
  | "fixture_placeholder";

export type RuntimeExecutionStage = "paper" | "live";

export type OrderIntentKind =
  | "place_order"
  | "cancel_order"
  | "adjust_position";

export type OrderIntentStatus = "proposed" | "withdrawn" | "expired" | "rejected";

export type OrderIntentAuthorityStatus = "not_submitted" | "trace_only";

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

export interface TraderSystemCandidateRecord extends BaseRecord {
  record_kind: "trader_system_candidate";
  candidate_id: string;
  display_name: string;
  status: CandidateStatus;
  active_version_id: string;
  provenance_refs: Ref[];
  title?: string;
  system_summary?: string;
  first_market_scope?: "binance_btc_perpetual_futures";
  candidate_status?: "materialized" | "handoff_ready" | "archived";
  evaluation_handoff_ready?: boolean;
  materialized_from_attempt_ref?: Ref;
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
}

export interface TraderSystemSpecRecord extends BaseRecord {
  record_kind: "trader_system_spec";
  trader_system_spec_id: string;
  summary: string;
  market: string;
  instrument: string;
  supported_stage_binding_profiles: Array<"backtest" | "paper" | "live">;
}

export interface TraderSystemProgramRecord extends BaseRecord {
  record_kind: "trader_system_program";
  trader_system_program_id: string;
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

export interface TraderSystemRuntimeRecord extends BaseRecord {
  record_kind: "trader_system_runtime";
  trader_system_runtime_id: string;
  stage_binding_profile: "paper";
  runtime_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  candidate_ref?: Ref;
  candidate_version_ref?: Ref;
  stage_binding_ref?: Ref;
  placement_ref: Ref;
  hands_environment_ref: Ref;
  memory_surface_ref: Ref;
  runtime_operating_policy_ref?: Ref;
  trace_ref?: Ref;
  order_intent_refs?: Ref[];
  gateway_decision_refs?: Ref[];
  execution_attempt_refs?: Ref[];
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

export interface BoundedRuntimeAuthorityInput {
  idempotency_key: string;
  candidate_id: string;
  candidate_version_id?: string;
  runtime_id?: string;
  intent: {
    intent_kind: OrderIntentKind;
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

export interface OrderIntentRecord extends BaseRecord {
  record_kind: "order_intent";
  order_intent_id: string;
  runtime_ref: Ref;
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  stage_binding_ref: Ref;
  trace_ref?: Ref;
  intent_kind: OrderIntentKind;
  market_scope: "binance_btc_perpetual_futures";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderIntentStatus;
  created_at: string;
  authority_status: OrderIntentAuthorityStatus;
}

export interface GatewayDecisionRecord extends BaseRecord {
  record_kind: "gateway_decision";
  gateway_decision_id: string;
  runtime_ref: Ref;
  order_intent_ref: Ref;
  decision_outcome: GatewayDecisionOutcome;
  decision_reason: GatewayDecisionReason;
  decided_at: string;
  policy_ref?: Ref;
  clipped_order_intent_ref?: Ref;
  authority_status: GatewayDecisionAuthorityStatus;
}

export interface ExecutionAttemptRecord extends BaseRecord {
  record_kind: "execution_attempt";
  execution_attempt_id: string;
  runtime_ref: Ref;
  order_intent_ref: Ref;
  gateway_decision_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "binance_btc_perpetual_futures";
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
  order_intent: OrderIntentRecord;
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
    first_market_scope: "binance_btc_perpetual_futures";
  };
  spec: {
    summary: string;
    market: "Binance";
    instrument: "BTC perpetual futures";
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
  | TraderSystemCandidateRecord
  | CandidateVersionRecord
  | TraderSystemSpecRecord
  | TraderSystemProgramRecord
  | ProgramManifestRecord
  | ProgramValidationRecord
  | CapabilityPackageRecord
  | CapabilityManifestRecord
  | CapabilityPackageAdmissionRecord
  | CapabilityGrantRecord
  | CapabilityMountRecord
  | AgentSpecRecord
  | AgentSessionRecord
  | AgentRunRecord
  | AgentEventRecord
  | ProviderReadinessRecord
  | ProviderProbeAttemptRecord
  | TraderSystemRuntimeRecord
  | RuntimePlacementRecord
  | HandsEnvironmentRecord
  | RuntimeMemorySurfaceRecord
  | TracePlaceholderRecord
  | StageBindingRecord
  | EvaluationRunRecord
  | EvaluationComparisonSetRecord
  | EvidenceSealingDecisionRecord
  | EvidenceClassificationRecord
  | OrderIntentRecord
  | GatewayDecisionRecord
  | ExecutionAttemptRecord
  | CandidateMaterializationAttemptRecord;

export interface CandidateSummaryReadModel {
  candidate_id: string;
  display_name: string;
  status: CandidateStatus;
  active_version_id: string;
  fixture_notice: FixtureNotice;
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

export interface CandidateRuntimeOrderIntentReadModel {
  order_intent_id: string;
  intent_kind: OrderIntentKind;
  market_scope: "binance_btc_perpetual_futures";
  side?: "buy" | "sell";
  order_type?: "market" | "limit";
  quantity?: string;
  limit_price?: string;
  status: OrderIntentStatus;
  created_at: string;
  authority_status: OrderIntentAuthorityStatus;
}

export interface CandidateRuntimeGatewayDecisionReadModel {
  gateway_decision_id: string;
  order_intent_ref: Ref;
  decision_outcome: GatewayDecisionOutcome;
  decision_reason: GatewayDecisionReason;
  decided_at: string;
  authority_status: GatewayDecisionAuthorityStatus;
}

export interface CandidateRuntimeExecutionAttemptReadModel {
  execution_attempt_id: string;
  order_intent_ref: Ref;
  gateway_decision_ref: Ref;
  stage: RuntimeExecutionStage;
  execution_mode: EvaluationExecutionMode;
  venue_scope: "binance_btc_perpetual_futures";
  status: ExecutionAttemptStatus;
  result_reason: GatewayDecisionReason;
  created_at: string;
  completed_at?: string;
  authority_status: ExecutionAttemptAuthorityStatus;
}

export interface CandidateRuntimeAuthorityReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  latest_order_intent: CandidateRuntimeOrderIntentReadModel | null;
  latest_gateway_decision: CandidateRuntimeGatewayDecisionReadModel | null;
  latest_execution_attempt: CandidateRuntimeExecutionAttemptReadModel | null;
  order_intent: PlaceholderSummary;
  gateway_decision: PlaceholderSummary;
  execution_attempt: PlaceholderSummary;
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
    runtime_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
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
    bounded_authority?: CandidateRuntimeAuthorityReadModel;
  };
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
