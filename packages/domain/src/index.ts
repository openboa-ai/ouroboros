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

export type ProviderKind = "codex_cli" | "claude_code" | "local_process" | "fixture_only";

export type AgentRunPurpose =
  | "candidate_generation"
  | "candidate_generation_placeholder"
  | "aar_artifact_proposal_generation";

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

export type RunnableArtifactKind = "python_file" | "container_image";

export type RunnableArtifactRuntimeKind = "python" | "container_image";

export type RunnableArtifactOutputKind =
  | "program_event"
  | "runtime_log"
  | "runtime_heartbeat"
  | "metric_snapshot"
  | "diagnostic_artifact"
  | "order_intent";

export type RunnableArtifactStatus = "registered" | "deprecated";

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

export type AarResearchDirectionKind =
  | "trend_following"
  | "mean_reversion"
  | "volatility_regime"
  | "funding_aware_risk"
  | "liquidation_aware_risk"
  | "execution_cost_robustness"
  | "other";

export type AarResearcherStatus = "active" | "retired";

export type AarExperimentStatus =
  | "submitted"
  | "evaluated"
  | "failed"
  | "discarded";

export type TradingEvaluationMarketScope = "binance_btc_perpetual_futures";

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

export type AarFindingKind =
  | "positive_result"
  | "negative_result"
  | "failure_analysis"
  | "anti_hacking_case"
  | "next_artifact_hint";

export type AarArtifactProposalStatus =
  | "proposed"
  | "materialized"
  | "discarded";

export type AarOrchestrationRunStatus =
  | "started"
  | "proposed"
  | "failed"
  | "discarded";

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

export type AarProposalProviderFailureReason =
  | "aar_proposal_provider_unavailable"
  | "aar_proposal_provider_failed"
  | "aar_proposal_provider_timeout"
  | "invalid_aar_proposal_request"
  | "no_eligible_aar_finding"
  | "unsupported_aar_proposal_task"
  | "unsupported_aar_proposal_provider";

export type AarProposalProviderOutputAuthorityStatus = "proposal_input_only";

export type AarProposalProviderReadinessStatus =
  | "active_verified"
  | "blocked_or_not_installed"
  | "candidate_unverified";

export type AarProposalMaterializationStatus = "materialized" | "failed";

export type AarProposalMaterializationFailureReason =
  | "provider_output_schema_invalid"
  | "provider_output_rejected"
  | "aar_proposal_source_finding_not_found"
  | AarProposalProviderFailureReason;

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
  active_runnable_artifact_ref?: Ref;
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

export interface AarResearchDirectionRecord extends BaseRecord {
  record_kind: "aar_research_direction";
  aar_research_direction_id: string;
  direction_kind: AarResearchDirectionKind;
  market_scope: TradingEvaluationMarketScope;
  prompt_seed: string;
  diversity_axis?: string;
  created_at: string;
  authority_status: "research_seed_only";
}

export interface AarResearcherRecord extends BaseRecord {
  record_kind: "aar_researcher";
  aar_researcher_id: string;
  display_name: string;
  model?: string;
  provider_kind?: ProviderKind;
  research_direction_ref: Ref;
  sandbox_policy_ref?: Ref;
  budget_policy_ref?: Ref;
  created_at: string;
  status: AarResearcherStatus;
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

export interface AarExperimentRecord extends BaseRecord {
  record_kind: "aar_experiment";
  aar_experiment_id: string;
  researcher_ref: Ref;
  research_direction_ref: Ref;
  runnable_artifact_ref: Ref;
  trading_evaluation_task_ref: Ref;
  sandbox_runtime_instance_ref?: Ref;
  runtime_trace_refs?: Ref[];
  trace_ref?: Ref;
  submitted_at: string;
  status: AarExperimentStatus;
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
  aar_experiment_ref: Ref;
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

export interface AarFindingRecord extends BaseRecord {
  record_kind: "aar_finding";
  aar_finding_id: string;
  researcher_ref: Ref;
  research_direction_ref: Ref;
  aar_experiment_ref: Ref;
  trading_evaluation_result_ref: Ref;
  finding_kind: AarFindingKind;
  summary: string;
  supporting_record_refs: Ref[];
  created_at: string;
  authority_status: "research_trace_only";
}

export interface AarArtifactLineageRecord extends BaseRecord {
  record_kind: "aar_artifact_lineage";
  aar_artifact_lineage_id: string;
  child_runnable_artifact_ref: Ref;
  parent_runnable_artifact_ref?: Ref;
  source_finding_refs: Ref[];
  created_by_researcher_ref?: Ref;
  created_at: string;
  authority_status: "lineage_only";
}

export interface AarArtifactProposalRecord extends BaseRecord {
  record_kind: "aar_artifact_proposal";
  aar_artifact_proposal_id: string;
  researcher_ref: Ref;
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
  status: AarArtifactProposalStatus;
  authority_status: "proposal_only";
}

export interface AarOrchestrationRunRecord extends BaseRecord {
  record_kind: "aar_orchestration_run";
  aar_orchestration_run_id: string;
  researcher_ref: Ref;
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
  status: AarOrchestrationRunStatus;
  authority_status: "research_only";
}

export interface AarProposalProviderAttribution {
  provider_kind: ProviderKind;
  model: string;
  invocation_surface: string;
}

export interface AarProposalProviderProbeResult extends AarProposalProviderAttribution {
  readiness_status: AarProposalProviderReadinessStatus;
  supported_purposes: Array<Extract<AgentRunPurpose, "aar_artifact_proposal_generation">>;
  version?: string;
  provider_readiness_ref?: Ref;
  provider_probe_attempt_ref?: Ref;
  failure_reason?: AarProposalProviderFailureReason;
}

export interface AarProposalProviderRequest {
  idempotency_key: string;
  task: TradingEvaluationTaskRecord;
  findings: AarFindingRecord[];
  existing_lineages?: AarArtifactLineageRecord[];
  existing_lineage_refs?: Ref[];
  parent_runnable_artifact_ref?: Ref;
  input_artifact_refs?: Ref[];
  requested_output_contract_ref?: Ref;
  agent_run_ref: Ref;
  trace_ref: Ref;
  created_at?: string;
}

export interface AarProposalProviderOutput {
  output_kind: "aar_artifact_proposal_input";
  trading_evaluation_task_ref: Ref;
  source_finding_refs: Ref[];
  anti_hacking_finding_refs?: Ref[];
  parent_runnable_artifact_ref?: Ref;
  proposal_summary: string;
  requested_change_summary: string;
  expected_improvement_summary?: string;
  proposed_artifact_refs: Ref[];
  output_authority_status: AarProposalProviderOutputAuthorityStatus;
}

export type AarProposalProviderResult =
  | {
      status: "succeeded";
      provider: AarProposalProviderAttribution;
      output: AarProposalProviderOutput;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: AarProposalProviderOutputAuthorityStatus;
    }
  | {
      status: "failed";
      provider: AarProposalProviderAttribution;
      failure_reason: AarProposalProviderFailureReason;
      agent_run_ref: Ref;
      agent_event_refs: Ref[];
      trace_ref: Ref;
      provider_output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      idempotency_key: string;
      authority_status: AarProposalProviderOutputAuthorityStatus;
    };

export interface AarProposalMaterializationInput {
  idempotency_key: string;
  provider_result: Extract<AarProposalProviderResult, { status: "succeeded" }>;
  artifact_path?: string;
  artifact_runtime_contract_ref?: Ref;
  secret_policy_ref?: Ref;
  capability_policy_ref?: Ref;
  created_at?: string;
}

export interface AarProposalProviderFailureInput {
  idempotency_key: string;
  provider_result: Extract<AarProposalProviderResult, { status: "failed" }>;
  created_at?: string;
}

export interface AarProposalMaterializationAttemptRecord extends BaseRecord {
  record_kind: "aar_proposal_materialization_attempt";
  aar_proposal_materialization_attempt_id: string;
  idempotency_key: string;
  provider: AarProposalProviderAttribution;
  agent_run_ref: Ref;
  agent_event_refs: Ref[];
  trace_ref: Ref;
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  status: AarProposalMaterializationStatus;
  validation_status: MaterializationValidationStatus;
  failure_reason?: AarProposalMaterializationFailureReason;
  output_artifact_proposal_ref?: Ref;
  output_runnable_artifact_ref?: Ref;
  output_lineage_ref?: Ref;
  created_at: string;
  authority_status: AarProposalProviderOutputAuthorityStatus;
}

export type AarProposalMaterializationOutcome =
  | {
      status: "materialized";
      attempt: AarProposalMaterializationAttemptRecord;
      proposal: AarArtifactProposalRecord;
      runnable_artifact: RunnableArtifactRecord;
      lineage: AarArtifactLineageRecord;
    }
  | {
      status: "failed";
      attempt: AarProposalMaterializationAttemptRecord;
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
  requested_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  actor_kind: RuntimeControlActorKind;
  actor_ref?: Ref;
  runtime_operating_policy_ref?: Ref;
  idempotency_key: string;
  reason: RuntimeControlCommandReason;
  reason_summary?: string;
  trace_ref?: Ref;
  related_order_intent_refs?: Ref[];
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
  resulting_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  trace_ref?: Ref;
  related_order_intent_refs?: Ref[];
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
  runtime_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  message?: string;
  trace_ref?: Ref;
  supporting_record_refs?: Ref[];
  related_order_intent_refs?: Ref[];
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
    requested_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
    actor_kind: RuntimeControlActorKind;
    actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    reason: RuntimeControlCommandReason;
    reason_summary?: string;
    trace_ref?: Ref;
    related_order_intent_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  decision: {
    decision_outcome: RuntimeControlDecisionOutcome;
    decision_reason: RuntimeControlDecisionReason;
    decided_by_actor_kind: RuntimeControlActorKind;
    decided_by_actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    resulting_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
    trace_ref?: Ref;
    related_order_intent_refs?: Ref[];
    related_gateway_decision_refs?: Ref[];
    related_execution_attempt_refs?: Ref[];
  };
  audit_event: {
    event_kind: RuntimeAuditEventKind;
    actor_kind?: RuntimeControlActorKind;
    actor_ref?: Ref;
    runtime_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
    message?: string;
    trace_ref?: Ref;
    supporting_record_refs?: Ref[];
    related_order_intent_refs?: Ref[];
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
  | ArtifactRuntimeContractRecord
  | RunnableArtifactRecord
  | AarResearchDirectionRecord
  | AarResearcherRecord
  | AarExperimentRecord
  | TradingEvaluationTaskRecord
  | TradingEvaluationResultRecord
  | AarFindingRecord
  | AarArtifactLineageRecord
  | AarArtifactProposalRecord
  | AarOrchestrationRunRecord
  | AarProposalMaterializationAttemptRecord
  | AgentSpecRecord
  | AgentSessionRecord
  | AgentRunRecord
  | AgentEventRecord
  | ProviderReadinessRecord
  | ProviderProbeAttemptRecord
  | TraderSystemRuntimeRecord
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

export interface CandidateRuntimeControlCommandReadModel {
  command_id: string;
  action: RuntimeControlAction;
  requested_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  actor_kind: RuntimeControlActorKind;
  actor_ref?: Ref;
  reason: RuntimeControlCommandReason;
  requested_at: string;
  status: RuntimeControlCommandStatus;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface CandidateRuntimeControlDecisionReadModel {
  decision_id: string;
  command_ref: Ref;
  decision_outcome: RuntimeControlDecisionOutcome;
  decision_reason: RuntimeControlDecisionReason;
  decided_by_actor_kind: RuntimeControlActorKind;
  decided_by_actor_ref?: Ref;
  resulting_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  decided_at: string;
  authority_status: RuntimeControlAuthorityStatus;
}

export interface CandidateRuntimeAuditEventReadModel {
  audit_event_id: string;
  event_kind: RuntimeAuditEventKind;
  command_ref?: Ref;
  decision_ref?: Ref;
  actor_kind?: RuntimeControlActorKind;
  actor_ref?: Ref;
  runtime_lifecycle_status?: TraderSystemRuntimeLifecycleStatus;
  message?: string;
  created_at: string;
  authority_status: "not_live" | "audit_only";
}

export interface CandidateRuntimeControlReadModel {
  has_activity: boolean;
  chain_complete: boolean;
  latest_command: CandidateRuntimeControlCommandReadModel | null;
  latest_decision: CandidateRuntimeControlDecisionReadModel | null;
  latest_audit_event: CandidateRuntimeAuditEventReadModel | null;
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
    runtime_control?: CandidateRuntimeControlReadModel;
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
