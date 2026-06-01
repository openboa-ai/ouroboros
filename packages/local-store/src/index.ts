import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  comparePrivateReadinessPostures,
  isCompletePrivateReadinessPostureRecord,
  isPrivateReadinessPostureRecord,
  isPrivateReadinessPostureWriteInput,
  matchesPrivateReadinessPostureQuery,
  toPrivateReadinessPostureReadModel
} from "./private-readiness-postures";
import type { PrivateReadinessPostureQueryInput } from "./private-readiness-postures";
import { createBinanceBtcusdtTradingSubstrateFixtureItems } from "./trading-substrate-fixtures";
import { buildLatestBinanceBtcusdtTradingSubstrateProjection } from "./trading-substrate-projection";
import {
  compareAccountPositionRiskMirrorSurfaces,
  compareOrderFillSurfaces,
  comparePrivateReadinessPreflightSurfaces,
  comparePublicMarketLivenessSurfaces,
  isAccountPositionRiskMirrorSurfaceRecord,
  isOrderFillSurfaceRecord,
  isPrivateReadinessPreflightSurfaceRecord,
  isPublicMarketLivenessSurfaceRecord,
  matchesAccountPositionRiskMirrorSurfaceQuery,
  matchesOrderFillSurfaceQuery,
  matchesPrivateReadinessPreflightSurfaceQuery,
  matchesPublicMarketLivenessSurfaceQuery,
  toAccountPositionRiskMirrorSurfaceReadModel,
  toOrderFillSurfaceReadModel,
  toPrivateReadinessPreflightSurfaceReadModel,
  toPublicMarketLivenessSurfaceReadModel
} from "./trading-substrate-surfaces";
import type {
  AccountPositionRiskMirrorSurfaceQueryInput,
  OrderFillSurfaceQueryInput,
  PrivateReadinessPreflightSurfaceQueryInput,
  PublicMarketLivenessSurfaceQueryInput
} from "./trading-substrate-surfaces";
import {
  buildImprovementReadModel,
  buildLedgerReadModel
} from "@ouroboros/domain";
export type { PrivateReadinessPostureQueryInput } from "./private-readiness-postures";
export type {
  AccountPositionRiskMirrorSurfaceQueryInput,
  OrderFillSurfaceQueryInput,
  PrivateReadinessPreflightSurfaceQueryInput,
  PublicMarketLivenessSurfaceQueryInput
} from "./trading-substrate-surfaces";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  AccountPositionRiskMirrorSurfaceRecord,
  ImprovementReadModel,
  AgentEventRecord,
  AgentProfileRecord,
  AgentRunRecord,
  AgentSessionRecord,
  ExperimentRunRecord,
  ArtifactLineageRecord,
  ImprovementProposalRecord,
  ResearchFindingRecord,
  ResearchOrchestrationRunRecord,
  ArtifactRuntimeContractRecord,
  AgentSpecRecord,
  ImprovementProposalMaterializationAttemptRecord,
  ImprovementProposalMaterializationFailureReason,
  ImprovementProposalMaterializationInput,
  ImprovementProposalMaterializationOutcome,
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderFailureInput,
  ImprovementProposalProviderOutput,
  CandidateMaterializationAttemptIndexProjection,
  CandidateMaterializationAttemptReadModel,
  CandidateMaterializationAttemptRecord,
  CandidateMaterializationFailureInput,
  CandidateMaterializationFailureReason,
  CandidateMaterializationInput,
  CandidateMaterializationOutcome,
  CandidateIndexProjection,
  CandidateEvaluationErrorState,
  CandidateEvaluationReadModel,
  CandidateArenaTickRecord,
  LedgerInput,
  LedgerSourceChainReadModel,
  LedgerSourceRecordsReadModel,
  LedgerReadModel,
  LedgerWriteOutcome,
  RunControlReadModel,
  CandidateInspectReadModel,
  CandidateSummaryReadModel,
  CandidateEvaluationRunInput,
  CandidateEvaluationRunOutcome,
  CandidateVersionRecord,
  CapabilityGrantRecord,
  CapabilityManifestRecord,
  CapabilityMountRecord,
  CapabilityPackageAdmissionRecord,
  CapabilityPackageRecord,
  EvaluationComparisonSetRecord,
  ExecutionResultAuthorityStatus,
  ExecutionResultRecord,
  ExecutionResultStatus,
  EvidenceClassificationKind,
  EvidenceClassificationRecord,
  EvidenceClassificationStatus,
  EvidenceDisposition,
  EvidenceDispositionReason,
  EvidenceSealingDecisionInput,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  FixtureNotice,
  FixtureRecord,
  GatewayResultRecord,
  GatewayResultAuthorityStatus,
  GatewayResultOutcome,
  GatewayResultReason,
  HandsEnvironmentRecord,
  OrderFillSurfaceReadModel,
  OuroborosCommandRecord,
  OrderFillSurfaceRecord,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPostureRecord,
  ResearcherProviderSelectionRecord,
  PrivateReadinessPostureWriteInput,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord,
  OrderRequestRecord,
  PlaceholderSummary,
  ProgramManifestRecord,
  ProgramValidationRecord,
  ProviderKind,
  ProviderProbeAttemptRecord,
  ProviderReadinessRecord,
  Ref,
  SystemCodeRecord,
  RuntimeAuditEventKind,
  RuntimeAuditEventRecord,
  RuntimeHeartbeatRecord,
  RunControlAction,
  RunControlActorKind,
  RunControlAuditInput,
  RunControlAuditOutcome,
  RunControlAuthorityStatus,
  RunControlCommandReason,
  RunControlCommandRecord,
  RunControlDecisionOutcome,
  RunControlDecisionReason,
  RunControlDecisionRecord,
  SandboxHeartbeatReadModel,
  SandboxIndexProjection,
  SandboxLogReadModel,
  SandboxLogRecord,
  SandboxLogsOutcome,
  RuntimeMemorySurfaceRecord,
  SandboxPlacementRecord,
  SandboxCommandEvidenceReadModel,
  SandboxCommandEvidenceRecord,
  SandboxRecord,
  SandboxDetailReadModel,
  SandboxReadModel,
  StartSandboxOutcome,
  StopSandboxInput,
  StageBindingRecord,
  TracePlaceholderRecord,
  TradingSystemCandidateRecord,
  TradingEvaluationResultRecord,
  TradingSystemProgramRecord,
  TradingRunTranscriptItemReadModel,
  TradingRunTranscriptReadModel,
  TradingRunLifecycleStatus,
  TradingRunRecord,
  TradingSystemSpecRecord
} from "@ouroboros/domain";

export const DEFAULT_STORE_ROOT = ".ouroboros/dev-store";
export const FIXTURE_CANDIDATE_ID = "fixture-candidate-sealed-replay-001";
export const FIXTURE_SYSTEM_CODE_ID = "fixture-system-code-clock-python-001";

export type LocalStoreErrorCode =
  | "invalid_evaluation_input"
  | "candidate_not_found"
  | "candidate_version_not_found"
  | "candidate_version_mismatch"
  | "unsupported_evaluation_stage"
  | "evaluation_run_incomplete"
  | "evaluation_run_not_found"
  | "evaluation_run_reload_failed"
  | "invalid_evidence_sealing_input"
  | "invalid_ledger_input"
  | "invalid_run_control_input"
  | "invalid_sandbox_input"
  | "invalid_order_fill_surface_input"
  | "invalid_public_market_liveness_surface_input"
  | "invalid_private_readiness_preflight_surface_input"
  | "invalid_private_readiness_posture_input"
  | "invalid_account_position_risk_mirror_surface_input"
  | "invalid_system_code_input"
  | "runtime_not_found"
  | "runtime_mismatch"
  | "system_code_not_found"
  | "sandbox_not_found"
  | "ledger_reload_failed"
  | "run_control_reload_failed"
  | "sandbox_reload_failed"
  | "invalid_research_finding_input"
  | "invalid_artifact_lineage_input"
  | "invalid_improvement_proposal_input"
  | "invalid_research_orchestration_run_input"
  | "invalid_experiment_run_input"
  | "invalid_trading_evaluation_result_input"
  | "invalid_candidate_arena_tick_input"
  | "improvement_proposal_materialization_reload_failed"
  | "research_finding_not_found"
  | "improvement_proposal_not_found"
  | "artifact_lineage_not_found";

export class LocalStoreError extends Error {
  readonly code: LocalStoreErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: LocalStoreErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "LocalStoreError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface CandidateEvaluationRunIdentityInput {
  candidate_id: string;
  candidate_version_id: string;
  idempotency_key: string;
}

export function candidateEvaluationRunRecordId(input: CandidateEvaluationRunIdentityInput): string {
  return `evaluation-run-${stableSuffix(`${input.candidate_id}:${input.candidate_version_id}:${input.idempotency_key}`)}`;
}

type Collection =
  | "artifact-runtime-contracts"
  | "system-codes"
  | "candidates"
  | "candidate-materialization-attempts"
  | "candidate-versions"
  | "trading-system-specs"
  | "trading-system-programs"
  | "program-manifests"
  | "program-validations"
  | "capability-packages"
  | "capability-manifests"
  | "capability-admissions"
  | "capability-grants"
  | "capability-mounts"
  | "agent-specs"
  | "agent-sessions"
  | "agent-runs"
  | "agent-events"
  | "agent-profiles"
  | "researcher-provider-selections"
  | "ouroboros-commands"
  | "provider-readiness-records"
  | "provider-probe-attempts"
  | "trading-runs"
  | "sandbox-placements"
  | "hands-environments"
  | "runtime-memory-surfaces"
  | "stage-bindings"
  | "traces"
  | "evaluation-runs"
  | "evaluation-comparison-sets"
  | "evidence-sealing-decisions"
  | "evidence-classifications"
  | "order-requests"
  | "gateway-results"
  | "execution-results"
  | "run-control-commands"
  | "run-control-decisions"
  | "runtime-audit-events"
  | "paper-trading-evaluations"
  | "paper-trading-observations"
  | "substrate-state-surfaces"
  | "private-readiness-postures"
  | "sandboxes"
  | "sandbox-logs"
  | "runtime-heartbeats"
  | "sandbox-command-evidence"
  | "research-findings"
  | "artifact-lineages"
  | "improvement-proposals"
  | "improvement-proposal-materialization-attempts"
  | "research-orchestration-runs"
  | "experiment-runs"
  | "candidate-arena-ticks"
  | "trading-evaluation-results";

interface FixtureItem {
  collection: Collection;
  id: string;
  record: FixtureRecord;
  itemDir?: "items" | "placeholders";
}

export interface SandboxObservationInput {
  instance: SandboxRecord;
  placement?: SandboxPlacementRecord;
  lifecycle_status?: SandboxRecord["lifecycle_status"];
  stopped_at?: string;
  removed_at?: string;
  logs?: SandboxLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
}

const fixtureNotice: FixtureNotice = {
  mode: "fixture_convenience_mode",
  label: "Fixture / convenience mode",
  statements: [
    "No provider has run.",
    "No trading-system program has executed.",
    "No package has been scanned, granted, or mounted for real.",
    "No evaluator has run and no evidence has counted.",
    "No promotion, live gate, marketplace, or runtime action authority exists."
  ]
};

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const ids = {
  candidate: FIXTURE_CANDIDATE_ID,
  version: "fixture-candidate-version-001",
  artifactRuntimeContract: "fixture-artifact-runtime-contract-clock-python-001",
  systemCode: FIXTURE_SYSTEM_CODE_ID,
  spec: "fixture-trading-system-spec-sealed-replay-001",
  program: "fixture-trading-system-program-001",
  programManifest: "fixture-program-manifest-001",
  programValidation: "fixture-program-validation-001",
  capabilityPackage: "fixture-capability-package-001",
  capabilityManifest: "fixture-capability-manifest-001",
  capabilityAdmission: "fixture-capability-admission-001",
  capabilityGrant: "fixture-capability-grant-001",
  capabilityMount: "fixture-capability-mount-001",
  agentSpec: "fixture-agent-spec-001",
  agentSession: "fixture-agent-session-001",
  agentRun: "fixture-agent-run-001",
  agentEvent: "fixture-agent-event-001",
  providerReadiness: "fixture-provider-readiness-001",
  providerProbe: "fixture-provider-probe-001",
  runtime: "fixture-trading-run-001",
  placement: "fixture-sandbox-placement-001",
  handsEnvironment: "fixture-hands-environment-001",
  memorySurface: "fixture-runtime-memory-surface-001",
  trace: "fixture-trace-placeholder-001",
  stageBinding: "fixture-stage-binding-backtest-001",
  evaluationRun: "fixture-evaluation-run-001",
  evaluationComparisonSet: "fixture-evaluation-comparison-set-001",
  evidenceSealingDecision: "fixture-evidence-sealing-decision-001",
  evidenceClassificationTrace: "fixture-evidence-classification-trace-001",
  evidenceClassificationCandidate: "fixture-evidence-classification-candidate-001",
  evidenceClassificationNonCounted: "fixture-evidence-classification-non-counted-001",
  evidenceClassificationSealedDecision: "fixture-evidence-classification-sealed-decision-001",
  orderFillSurface: "fixture-binance-btcusdt-order-fill-surface-001",
  publicMarketLivenessSurface: "fixture-binance-btcusdt-public-market-liveness-surface-001",
  privateReadinessPreflightSurface: "fixture-binance-btcusdt-private-readiness-preflight-surface-001",
  privateReadinessPosture: "fixture-binance-btcusdt-private-readiness-posture-001",
  accountPositionRiskMirrorSurface: "fixture-binance-btcusdt-account-position-risk-mirror-surface-001"
};

const fixtureEvaluationCreatedAt = "2026-05-05T00:00:00.000Z";

export function createFixtureRecords(): FixtureItem[] {
  const artifactRuntimeContract: ArtifactRuntimeContractRecord = {
    record_kind: "artifact_runtime_contract",
    version: 1,
    artifact_runtime_contract_id: ids.artifactRuntimeContract,
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "order_request"],
      event_envelope_ref: ref("program_event_contract", "opaque-clock-program-event-v1"),
      log_contract_ref: ref("runtime_log_contract", "opaque-clock-log-v1"),
      heartbeat_contract_ref: ref("runtime_heartbeat_contract", "opaque-clock-heartbeat-v1")
    },
    secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
    capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "contract_only"
  };
  const systemCode: SystemCodeRecord = {
    record_kind: "system_code",
    version: 1,
    system_code_id: ids.systemCode,
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:fixture-clock-python-artifact-v1",
    artifact_runtime_contract_ref: ref(
      "artifact_runtime_contract",
      artifactRuntimeContract.artifact_runtime_contract_id
    ),
    runtime_kind: artifactRuntimeContract.runtime_kind,
    entrypoint: artifactRuntimeContract.entrypoint,
    declared_output_contract: artifactRuntimeContract.declared_output_contract,
    secret_policy_ref: artifactRuntimeContract.secret_policy_ref,
    capability_policy_ref: artifactRuntimeContract.capability_policy_ref,
    provenance_refs: [ref("agent_run", ids.agentRun)],
    status: "registered",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_live"
  };
  const candidate: TradingSystemCandidateRecord = {
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: ids.candidate,
    display_name: "Fixture generic trading-system candidate",
    status: "fixture_only",
    active_version_id: ids.version,
    provenance_refs: [
      ref("agent_run", ids.agentRun),
      ref("provider_readiness_record", ids.providerReadiness)
    ],
    active_system_code_ref: ref("system_code", ids.systemCode)
  };
  const candidateVersion: CandidateVersionRecord = {
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: ids.version,
    candidate_id: ids.candidate,
    version_label: "fixture-v1",
    spec_ref: ref("trading_system_spec", ids.spec),
    program_ref: ref("trading_system_program", ids.program),
    capability_package_refs: [ref("capability_package", ids.capabilityPackage)],
    runtime_ref: ref("trading_run", ids.runtime),
    trace_placeholder_ref: ref("trace_placeholder", ids.trace),
    evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
    system_code_ref: ref("system_code", ids.systemCode)
  };
  const spec: TradingSystemSpecRecord = {
    record_kind: "trading_system_spec",
    version: 1,
    trading_system_spec_id: ids.spec,
    summary: "generic trading instruments trading-system fixture spec for inspect-only bootstrap.",
    market: "ExternalTradingApiProvider",
    instrument: "generic trading instruments",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  };
  const program: TradingSystemProgramRecord = {
    record_kind: "trading_system_program",
    version: 1,
    trading_system_program_id: ids.program,
    summary: "Agent-authored program placeholder; no code has executed.",
    manifest_ref: ref("program_manifest", ids.programManifest),
    validation_record_ref: ref("program_validation_record", ids.programValidation)
  };
  const programManifest: ProgramManifestRecord = {
    record_kind: "program_manifest",
    version: 1,
    program_manifest_id: ids.programManifest,
    declared_runtime: "fixture-sandbox-placeholder",
    declared_outputs: ["OrderRequest placeholder", "Trace placeholder"]
  };
  const programValidation: ProgramValidationRecord = {
    record_kind: "program_validation_record",
    version: 1,
    program_validation_record_id: ids.programValidation,
    status: "fixture_placeholder",
    authority_status: "not_executable"
  };
  const capabilityPackage: CapabilityPackageRecord = {
    record_kind: "capability_package",
    version: 1,
    capability_package_id: ids.capabilityPackage,
    summary: "Inspect-only capability package placeholder.",
    manifest_ref: ref("capability_manifest", ids.capabilityManifest),
    admission_record_ref: ref("capability_package_admission_record", ids.capabilityAdmission),
    grant_ref: ref("capability_grant", ids.capabilityGrant),
    mount_record_ref: ref("capability_mount_record", ids.capabilityMount)
  };
  const capabilityManifest: CapabilityManifestRecord = {
    record_kind: "capability_manifest",
    version: 1,
    capability_manifest_id: ids.capabilityManifest,
    allowed_stages: ["backtest", "paper"],
    declared_permissions: ["read_fixture_market_context"],
    forbidden_contents: ["exchange_credentials", "live_order_authority"]
  };
  const capabilityAdmission: CapabilityPackageAdmissionRecord = {
    record_kind: "capability_package_admission_record",
    version: 1,
    capability_package_admission_record_id: ids.capabilityAdmission,
    status: "fixture_placeholder",
    authority_status: "not_scanned"
  };
  const capabilityGrant: CapabilityGrantRecord = {
    record_kind: "capability_grant",
    version: 1,
    capability_grant_id: ids.capabilityGrant,
    status: "fixture_placeholder",
    authority_status: "not_granted"
  };
  const capabilityMount: CapabilityMountRecord = {
    record_kind: "capability_mount_record",
    version: 1,
    capability_mount_record_id: ids.capabilityMount,
    status: "fixture_placeholder",
    authority_status: "not_mounted"
  };
  const agentSpec: AgentSpecRecord = {
    record_kind: "agent_spec",
    version: 1,
    agent_spec_id: ids.agentSpec,
    purpose: "candidate_generation_placeholder",
    provider_kind: "fixture_only"
  };
  const agentSession: AgentSessionRecord = {
    record_kind: "agent_session",
    version: 1,
    agent_session_id: ids.agentSession,
    agent_spec_ref: ref("agent_spec", ids.agentSpec),
    authority_status: "not_executed"
  };
  const agentRun: AgentRunRecord = {
    record_kind: "agent_run",
    version: 1,
    agent_run_id: ids.agentRun,
    agent_session_ref: ref("agent_session", ids.agentSession),
    purpose: "candidate_generation_placeholder",
    authority_status: "not_executed"
  };
  const agentEvent: AgentEventRecord = {
    record_kind: "agent_event",
    version: 1,
    agent_event_id: ids.agentEvent,
    agent_run_ref: ref("agent_run", ids.agentRun),
    status: "fixture_placeholder"
  };
  const providerReadiness: ProviderReadinessRecord = {
    record_kind: "provider_readiness_record",
    version: 1,
    provider_readiness_record_id: ids.providerReadiness,
    provider_kind: "fixture_only",
    authority_status: "not_ready"
  };
  const providerProbe: ProviderProbeAttemptRecord = {
    record_kind: "provider_probe_attempt",
    version: 1,
    provider_probe_attempt_id: ids.providerProbe,
    provider_readiness_record_ref: ref("provider_readiness_record", ids.providerReadiness),
    authority_status: "not_probed"
  };
  const runtime: TradingRunRecord = {
    record_kind: "trading_run",
    version: 1,
    trading_run_id: ids.runtime,
    stage_binding_profile: "paper",
    runtime_lifecycle_status: "fixture_placeholder",
    placement_ref: ref("sandbox_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    memory_surface_ref: ref("runtime_memory_surface", ids.memorySurface),
    system_code_ref: ref("system_code", ids.systemCode),
    authority_status: "not_live"
  };
  const placement: SandboxPlacementRecord = {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: ids.placement,
    placement_kind: "fixture_local_placeholder",
    tooling_kind: "fixture_only",
    authority_status: "not_launched"
  };
  const handsEnvironment: HandsEnvironmentRecord = {
    record_kind: "hands_environment",
    version: 1,
    hands_environment_id: ids.handsEnvironment,
    environment_kind: "fixture_no_tools",
    authority_status: "not_mounted"
  };
  const memorySurface: RuntimeMemorySurfaceRecord = {
    record_kind: "runtime_memory_surface",
    version: 1,
    runtime_memory_surface_id: ids.memorySurface,
    trust_class: "fixture_context",
    access_mode: "read_only",
    surface_version: "fixture-v1",
    visibility: "operator_visible",
    quarantine_status: "not_quarantined",
    authority_status: "not_evidence"
  };
  const trace: TracePlaceholderRecord = {
    record_kind: "trace_placeholder",
    version: 1,
    trace_id: ids.trace,
    authority_status: "not_counted"
  };
  const stageBinding: StageBindingRecord = {
    record_kind: "stage_binding",
    version: 1,
    stage_binding_id: ids.stageBinding,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage: "backtest",
    profile: "backtest",
    execution_mode: "host_local",
    sandbox_placement_ref: ref("sandbox_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_live"
  };
  const evaluationRun: EvaluationRunRecord = {
    record_kind: "evaluation_run_record",
    version: 1,
    evaluation_run_record_id: ids.evaluationRun,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage_binding_ref: ref("stage_binding", ids.stageBinding),
    trace_ref: ref("trace_placeholder", ids.trace),
    status: "created",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const comparisonSet: EvaluationComparisonSetRecord = {
    record_kind: "evaluation_comparison_set",
    version: 1,
    evaluation_comparison_set_id: ids.evaluationComparisonSet,
    candidate_ref: ref("trading_system_candidate", ids.candidate),
    candidate_version_ref: ref("candidate_version", ids.version),
    stage_binding_ref: ref("stage_binding", ids.stageBinding),
    evaluation_run_refs: [ref("evaluation_run_record", ids.evaluationRun)],
    comparability_status: "not_evaluated",
    comparability_reason: "no_external_evaluator",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const sealingDecision: EvidenceSealingDecisionRecord = {
    record_kind: "evidence_sealing_decision",
    version: 1,
    evidence_sealing_decision_id: ids.evidenceSealingDecision,
    evaluation_comparison_set_ref: ref("evaluation_comparison_set", ids.evaluationComparisonSet),
    evaluation_run_refs: [ref("evaluation_run_record", ids.evaluationRun)],
    evidence_disposition: "not_counted",
    disposition_reason: "no_external_evaluator",
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "not_counted"
  };
  const evidenceClassifications: EvidenceClassificationRecord[] = [
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationTrace,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("trace_placeholder", ids.trace),
      classification_kind: "trace_debug_material",
      classification_status: "trace_only",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationCandidate,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evaluation_run_record", ids.evaluationRun),
      classification_kind: "candidate_evidence",
      classification_status: "candidate",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationNonCounted,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evaluation_run_record", ids.evaluationRun),
      classification_kind: "non_counted_evidence",
      classification_status: "not_counted",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      sealed_by_decision_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      authority_status: "not_counted"
    },
    {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: ids.evidenceClassificationSealedDecision,
      candidate_ref: ref("trading_system_candidate", ids.candidate),
      candidate_version_ref: ref("candidate_version", ids.version),
      evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
      classified_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      classification_kind: "sealed_decision",
      classification_status: "sealed",
      classification_reason: "no_external_evaluator",
      created_at: fixtureEvaluationCreatedAt,
      sealed_by_decision_ref: ref("evidence_sealing_decision", ids.evidenceSealingDecision),
      authority_status: "not_counted"
    }
  ];

  return [
    { collection: "artifact-runtime-contracts", id: ids.artifactRuntimeContract, record: artifactRuntimeContract },
    { collection: "system-codes", id: ids.systemCode, record: systemCode },
    { collection: "candidates", id: ids.candidate, record: candidate },
    { collection: "candidate-versions", id: ids.version, record: candidateVersion },
    { collection: "trading-system-specs", id: ids.spec, record: spec },
    { collection: "trading-system-programs", id: ids.program, record: program },
    { collection: "program-manifests", id: ids.programManifest, record: programManifest },
    { collection: "program-validations", id: ids.programValidation, record: programValidation },
    { collection: "capability-packages", id: ids.capabilityPackage, record: capabilityPackage },
    { collection: "capability-manifests", id: ids.capabilityManifest, record: capabilityManifest },
    { collection: "capability-admissions", id: ids.capabilityAdmission, record: capabilityAdmission },
    { collection: "capability-grants", id: ids.capabilityGrant, record: capabilityGrant },
    { collection: "capability-mounts", id: ids.capabilityMount, record: capabilityMount },
    { collection: "agent-specs", id: ids.agentSpec, record: agentSpec },
    { collection: "agent-sessions", id: ids.agentSession, record: agentSession },
    { collection: "agent-runs", id: ids.agentRun, record: agentRun },
    { collection: "agent-events", id: ids.agentEvent, record: agentEvent },
    { collection: "provider-readiness-records", id: ids.providerReadiness, record: providerReadiness },
    { collection: "provider-probe-attempts", id: ids.providerProbe, record: providerProbe },
    { collection: "trading-runs", id: ids.runtime, record: runtime },
    { collection: "sandbox-placements", id: ids.placement, record: placement },
    { collection: "hands-environments", id: ids.handsEnvironment, record: handsEnvironment },
    { collection: "runtime-memory-surfaces", id: ids.memorySurface, record: memorySurface },
    { collection: "traces", id: ids.trace, record: trace, itemDir: "placeholders" },
    { collection: "stage-bindings", id: ids.stageBinding, record: stageBinding },
    { collection: "evaluation-runs", id: ids.evaluationRun, record: evaluationRun },
    ...createBinanceBtcusdtTradingSubstrateFixtureItems({
      ids: {
        orderFillSurface: ids.orderFillSurface,
        publicMarketLivenessSurface: ids.publicMarketLivenessSurface,
        privateReadinessPreflightSurface: ids.privateReadinessPreflightSurface,
        privateReadinessPosture: ids.privateReadinessPosture,
        accountPositionRiskMirrorSurface: ids.accountPositionRiskMirrorSurface,
        runtime: ids.runtime,
        candidate: ids.candidate,
        stageBinding: ids.stageBinding
      },
      ref
    }),
    { collection: "evaluation-comparison-sets", id: ids.evaluationComparisonSet, record: comparisonSet },
    { collection: "evidence-sealing-decisions", id: ids.evidenceSealingDecision, record: sealingDecision },
    ...evidenceClassifications.map((classification) => ({
      collection: "evidence-classifications" as const,
      id: classification.evidence_classification_id,
      record: classification
    }))
  ];
}

export class LocalStore {
  constructor(private readonly storeRoot = process.env.OUROBOROS_STORE_ROOT ?? DEFAULT_STORE_ROOT) {}

  root(): string {
    return this.storeRoot;
  }

  async reset(): Promise<void> {
    await rm(this.storeRoot, { recursive: true, force: true });
  }

  async seedFixture(): Promise<void> {
    for (const item of createFixtureRecords()) {
      const targetPath = this.itemPath(item.collection, item.id, item.itemDir);
      if (await pathExists(targetPath)) {
        continue;
      }
      await this.writeJson(targetPath, item.record);
    }
  }

  async rebuildProjections(): Promise<void> {
    const candidates = await this.readCollection<TradingSystemCandidateRecord>("candidates");
    const summaries = candidates
      .map((candidate) => this.toCandidateSummary(candidate))
      .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));

    const index: CandidateIndexProjection = {
      record_kind: "candidate_index_projection",
      version: 1,
      candidates: summaries
    };
    await this.writeJson(this.collectionIndexPath("candidates"), index);
    await this.writeJson(path.join(this.storeRoot, "read-models/candidates/index.json"), index);

    for (const candidate of candidates) {
      const readModel = await this.buildCandidateInspectReadModel(candidate.candidate_id);
      await this.writeJson(
        path.join(this.storeRoot, "read-models/candidates/items", storeJsonFileName(candidate.candidate_id)),
        readModel
      );
      await this.writeJson(
        path.join(this.storeRoot, "read-models/candidate-evaluations/items", storeJsonFileName(candidate.candidate_id)),
        readModel.evaluation
      );
    }

    const attempts = await this.readCollection<CandidateMaterializationAttemptRecord>(
      "candidate-materialization-attempts"
    );
    const attemptReadModels = attempts
      .map(toCandidateMaterializationAttemptReadModel)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const attemptIndex: CandidateMaterializationAttemptIndexProjection = {
      record_kind: "candidate_materialization_attempt_index_projection",
      version: 1,
      attempts: attemptReadModels
    };
    await this.writeJson(
      path.join(this.storeRoot, "read-models/candidate-materialization-attempts/index.json"),
      attemptIndex
    );
    for (const attempt of attemptReadModels) {
      await this.writeJson(
        path.join(
          this.storeRoot,
          "read-models/candidate-materialization-attempts/items",
          storeJsonFileName(attempt.attempt_id)
        ),
        attempt
      );
    }

    const sandboxes = await this.readCollection<SandboxRecord>(
      "sandboxes"
    );
    const sandboxReadModels = sandboxes
      .map(toSandboxReadModel)
      .sort(compareSandboxReadModels);
    const sandboxIndex: SandboxIndexProjection = {
      record_kind: "sandbox_index_projection",
      version: 1,
      sandboxes: sandboxReadModels
    };
    await this.writeJson(
      path.join(this.storeRoot, "read-models/sandboxes/index.json"),
      sandboxIndex
    );
    for (const sandbox of sandboxReadModels) {
      const sandboxDetail = await this.buildSandboxDetailReadModel(sandbox.sandbox_id);
      await this.writeJson(
        path.join(this.storeRoot, "read-models/sandboxes/items", storeJsonFileName(sandbox.sandbox_id)),
        sandboxDetail
      );
    }
  }

  async initialize(): Promise<void> {
    await this.seedFixture();
    await this.rebuildProjections();
  }

  async listCandidates(): Promise<CandidateSummaryReadModel[]> {
    const indexPath = path.join(this.storeRoot, "read-models/candidates/index.json");
    try {
      const index = await this.readJson<CandidateIndexProjection>(indexPath);
      return index.candidates;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await this.rebuildProjections();
    try {
      const index = await this.readJson<CandidateIndexProjection>(indexPath);
      return index.candidates;
    } catch (error) {
      if (isMissingFileError(error)) {
        return [];
      }
      throw error;
    }
  }

  async getCandidate(candidateId: string): Promise<CandidateInspectReadModel | undefined> {
    try {
      return await this.readJson<CandidateInspectReadModel>(
        path.join(this.storeRoot, "read-models/candidates/items", storeJsonFileName(candidateId))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async getTradingRun(tradingRunId: string): Promise<TradingRunRecord | undefined> {
    return this.readOptionalRecord<TradingRunRecord>("trading-runs", tradingRunId);
  }

  async getCandidateForTradingRun(tradingRunId: string): Promise<CandidateInspectReadModel | undefined> {
    const versions = await this.readCollection<CandidateVersionRecord>("candidate-versions");
    const version = versions.find((candidateVersion) => candidateVersion.runtime_ref.id === tradingRunId);
    return version ? this.getCandidate(version.candidate_id) : undefined;
  }

  async recordOrderFillSurface(surface: OrderFillSurfaceRecord): Promise<OrderFillSurfaceReadModel> {
    if (!isOrderFillSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_order_fill_surface_input",
        "invalid order-fill substrate surface input",
        { order_fill_surface_id: (surface as Partial<OrderFillSurfaceRecord> | undefined)?.order_fill_surface_id }
      );
    }
    await this.writeJson(
      this.itemPath("substrate-state-surfaces", surface.order_fill_surface_id),
      surface
    );
    await this.rebuildProjections();
    return toOrderFillSurfaceReadModel(surface);
  }

  async listOrderFillSurfaces(
    query: OrderFillSurfaceQueryInput = {}
  ): Promise<OrderFillSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isOrderFillSurfaceRecord)
      .filter((surface) => matchesOrderFillSurfaceQuery(surface, query))
      .sort(compareOrderFillSurfaces)
      .map(toOrderFillSurfaceReadModel);
  }

  async getLatestOrderFillSurface(
    query: OrderFillSurfaceQueryInput = {}
  ): Promise<OrderFillSurfaceReadModel | undefined> {
    return (await this.listOrderFillSurfaces(query)).at(-1);
  }

  async recordPublicMarketLivenessSurface(
    surface: PublicMarketLivenessSurfaceRecord
  ): Promise<PublicMarketLivenessSurfaceReadModel> {
    if (!isPublicMarketLivenessSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_public_market_liveness_surface_input",
        "invalid public market liveness substrate surface input",
        {
          public_market_liveness_surface_id:
            (surface as Partial<PublicMarketLivenessSurfaceRecord> | undefined)
              ?.public_market_liveness_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath("substrate-state-surfaces", surface.public_market_liveness_surface_id),
      surface
    );
    await this.rebuildProjections();
    return toPublicMarketLivenessSurfaceReadModel(surface);
  }

  async listPublicMarketLivenessSurfaces(
    query: PublicMarketLivenessSurfaceQueryInput = {}
  ): Promise<PublicMarketLivenessSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isPublicMarketLivenessSurfaceRecord)
      .filter((surface) => matchesPublicMarketLivenessSurfaceQuery(surface, query))
      .sort(comparePublicMarketLivenessSurfaces)
      .map(toPublicMarketLivenessSurfaceReadModel);
  }

  async getLatestPublicMarketLivenessSurface(
    query: PublicMarketLivenessSurfaceQueryInput = {}
  ): Promise<PublicMarketLivenessSurfaceReadModel | undefined> {
    return (await this.listPublicMarketLivenessSurfaces(query)).at(-1);
  }

  async recordPrivateReadinessPreflightSurface(
    surface: PrivateReadinessPreflightSurfaceRecord
  ): Promise<PrivateReadinessPreflightSurfaceReadModel> {
    if (!isPrivateReadinessPreflightSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_private_readiness_preflight_surface_input",
        "invalid private-readiness preflight substrate surface input",
        {
          private_readiness_preflight_surface_id:
            (surface as Partial<PrivateReadinessPreflightSurfaceRecord> | undefined)
              ?.private_readiness_preflight_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath(
        "substrate-state-surfaces",
        surface.private_readiness_preflight_surface_id
      ),
      surface
    );
    await this.rebuildProjections();
    return toPrivateReadinessPreflightSurfaceReadModel(surface);
  }

  async listPrivateReadinessPreflightSurfaces(
    query: PrivateReadinessPreflightSurfaceQueryInput = {}
  ): Promise<PrivateReadinessPreflightSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isPrivateReadinessPreflightSurfaceRecord)
      .filter((surface) => matchesPrivateReadinessPreflightSurfaceQuery(surface, query))
      .sort(comparePrivateReadinessPreflightSurfaces)
      .map(toPrivateReadinessPreflightSurfaceReadModel);
  }

  async getLatestPrivateReadinessPreflightSurface(
    query: PrivateReadinessPreflightSurfaceQueryInput = {}
  ): Promise<PrivateReadinessPreflightSurfaceReadModel | undefined> {
    return (await this.listPrivateReadinessPreflightSurfaces(query)).at(-1);
  }

  async recordPrivateReadinessPosture(
    posture: PrivateReadinessPostureRecord
  ): Promise<PrivateReadinessPostureReadModel> {
    if (!isCompletePrivateReadinessPostureRecord(posture)) {
      throw new LocalStoreError(
        "invalid_private_readiness_posture_input",
        "invalid private-readiness posture input",
        {
          private_readiness_posture_id:
            (posture as Partial<PrivateReadinessPostureRecord> | undefined)
              ?.private_readiness_posture_id
        }
      );
    }
    await this.writeJson(
      this.itemPath("private-readiness-postures", posture.private_readiness_posture_id),
      posture
    );
    await this.rebuildProjections();
    return toPrivateReadinessPostureReadModel(posture);
  }

  async recordLocalPrivateReadinessPosture(
    input: PrivateReadinessPostureWriteInput
  ): Promise<PrivateReadinessPostureReadModel> {
    if (!isPrivateReadinessPostureWriteInput(input)) {
      throw new LocalStoreError(
        "invalid_private_readiness_posture_input",
        "invalid private-readiness posture write input",
        {
          idempotency_key: (input as Partial<PrivateReadinessPostureWriteInput> | undefined)
            ?.idempotency_key
        }
      );
    }

    const postureId = privateReadinessPostureRecordId(input.idempotency_key);
    const existing = await this.readOptionalRecord<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      postureId
    );
    if (existing && isPrivateReadinessPostureRecord(existing)) {
      return toPrivateReadinessPostureReadModel(existing);
    }

    const observedAt = input.observed_at ?? new Date().toISOString();
    const posture: PrivateReadinessPostureRecord = stripUndefined({
      record_kind: "private_readiness_posture",
      version: 1,
      private_readiness_posture_id: postureId,
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      operator_approval_gate: input.operator_approval_gate,
      jurisdiction_risk_gate: input.jurisdiction_risk_gate,
      live_binding_gate: input.live_binding_gate,
      secret_handling_gate: input.secret_handling_gate,
      stop_behavior_gate: input.stop_behavior_gate,
      secret_reference_configured: input.secret_reference_configured,
      secret_reference_ref: input.secret_reference_ref,
      raw_secret_material_present: false,
      source_timestamp: observedAt,
      observed_at: observedAt,
      updated_at: observedAt,
      source_kind: "local_config",
      source_ref: input.source_ref ?? ref("local_config", postureId),
      fixture_backed: false,
      simulated: true,
      no_authority: {
        live_exchange: false,
        order_submission: false,
        credentials: false
      },
      authority_status: "not_live"
    } satisfies PrivateReadinessPostureRecord);

    return this.recordPrivateReadinessPosture(posture);
  }

  async listPrivateReadinessPostures(
    query: PrivateReadinessPostureQueryInput = {}
  ): Promise<PrivateReadinessPostureReadModel[]> {
    return (await this.readCollection<FixtureRecord>("private-readiness-postures"))
      .filter(isPrivateReadinessPostureRecord)
      .filter((posture) => matchesPrivateReadinessPostureQuery(posture, query))
      .sort(comparePrivateReadinessPostures)
      .map(toPrivateReadinessPostureReadModel);
  }

  async getLatestPrivateReadinessPosture(
    query: PrivateReadinessPostureQueryInput = {}
  ): Promise<PrivateReadinessPostureReadModel | undefined> {
    return (await this.listPrivateReadinessPostures(query)).at(-1);
  }

  async recordAccountPositionRiskMirrorSurface(
    surface: AccountPositionRiskMirrorSurfaceRecord
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel> {
    if (!isAccountPositionRiskMirrorSurfaceRecord(surface)) {
      throw new LocalStoreError(
        "invalid_account_position_risk_mirror_surface_input",
        "invalid account-position-risk mirror substrate surface input",
        {
          account_position_risk_mirror_surface_id:
            (surface as Partial<AccountPositionRiskMirrorSurfaceRecord> | undefined)
              ?.account_position_risk_mirror_surface_id
        }
      );
    }
    await this.writeJson(
      this.itemPath(
        "substrate-state-surfaces",
        surface.account_position_risk_mirror_surface_id
      ),
      surface
    );
    await this.rebuildProjections();
    return toAccountPositionRiskMirrorSurfaceReadModel(surface);
  }

  async listAccountPositionRiskMirrorSurfaces(
    query: AccountPositionRiskMirrorSurfaceQueryInput = {}
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel[]> {
    return (await this.readCollection<FixtureRecord>("substrate-state-surfaces"))
      .filter(isAccountPositionRiskMirrorSurfaceRecord)
      .filter((surface) => matchesAccountPositionRiskMirrorSurfaceQuery(surface, query))
      .sort(compareAccountPositionRiskMirrorSurfaces)
      .map(toAccountPositionRiskMirrorSurfaceReadModel);
  }

  async getLatestAccountPositionRiskMirrorSurface(
    query: AccountPositionRiskMirrorSurfaceQueryInput = {}
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel | undefined> {
    return (await this.listAccountPositionRiskMirrorSurfaces(query)).at(-1);
  }

  async getCandidateEvaluationRun(
    evaluationRunRecordId: string
  ): Promise<CandidateEvaluationRunOutcome | undefined> {
    const evaluationRun = await this.readOptionalRecord<EvaluationRunRecord>(
      "evaluation-runs",
      evaluationRunRecordId
    );
    if (!evaluationRun) {
      return undefined;
    }
    return this.toCandidateEvaluationRunOutcome(evaluationRun);
  }

  async getSystemCode(systemCodeId: string): Promise<SystemCodeRecord | undefined> {
    return this.readOptionalRecord<SystemCodeRecord>("system-codes", systemCodeId);
  }

  async recordSystemCode(systemCode: SystemCodeRecord): Promise<SystemCodeRecord> {
    if (!isSystemCodeRecord(systemCode)) {
      throw new LocalStoreError(
        "invalid_system_code_input",
        "invalid system code input",
        { system_code_id: (systemCode as Partial<SystemCodeRecord> | undefined)?.system_code_id }
      );
    }
    await this.writeJson(this.itemPath("system-codes", systemCode.system_code_id), systemCode);
    return systemCode;
  }

  async recordResearchFinding(finding: ResearchFindingRecord): Promise<ResearchFindingRecord> {
    if (!isResearchFindingRecord(finding)) {
      throw new LocalStoreError(
        "invalid_research_finding_input",
        "invalid automated research finding input",
        { research_finding_id: (finding as Partial<ResearchFindingRecord> | undefined)?.research_finding_id }
      );
    }
    await this.writeJson(this.itemPath("research-findings", finding.research_finding_id), finding);
    return finding;
  }

  async listResearchFindings(): Promise<ResearchFindingRecord[]> {
    return (await this.readCollection<ResearchFindingRecord>("research-findings")).sort(compareResearchFindings);
  }

  async listResearchFindingsForExperiment(researchExperimentId: string): Promise<ResearchFindingRecord[]> {
    return (await this.listResearchFindings()).filter(
      (finding) => finding.experiment_run_ref.id === researchExperimentId
    );
  }

  async recordCandidateArenaTick(tick: CandidateArenaTickRecord): Promise<CandidateArenaTickRecord> {
    if (!isCandidateArenaTickRecord(tick)) {
      throw new LocalStoreError(
        "invalid_candidate_arena_tick_input",
        "invalid Candidate Arena tick input",
        { candidate_arena_tick_id: (tick as Partial<CandidateArenaTickRecord> | undefined)?.candidate_arena_tick_id }
      );
    }
    await this.writeJson(this.itemPath("candidate-arena-ticks", tick.candidate_arena_tick_id), tick);
    return tick;
  }

  async listCandidateArenaTicks(): Promise<CandidateArenaTickRecord[]> {
    return (await this.readCollection<CandidateArenaTickRecord>("candidate-arena-ticks"))
      .sort(compareCandidateArenaTicks);
  }

  async recordAgentProfile(profile: AgentProfileRecord): Promise<AgentProfileRecord> {
    await this.writeJson(this.itemPath("agent-profiles", profile.agent_profile_id), profile);
    return profile;
  }

  async getAgentProfile(profileId: string): Promise<AgentProfileRecord | undefined> {
    return this.readOptionalRecord<AgentProfileRecord>("agent-profiles", profileId);
  }

  async listAgentProfiles(): Promise<AgentProfileRecord[]> {
    return (await this.readCollection<AgentProfileRecord>("agent-profiles"))
      .sort((a, b) => a.agent_profile_id.localeCompare(b.agent_profile_id));
  }

  async recordResearcherProviderSelection(
    selection: ResearcherProviderSelectionRecord
  ): Promise<ResearcherProviderSelectionRecord> {
    await this.writeJson(
      this.itemPath("researcher-provider-selections", selection.researcher_provider_selection_id),
      selection
    );
    return selection;
  }

  async getResearcherProviderSelection(): Promise<ResearcherProviderSelectionRecord | undefined> {
    return this.readOptionalRecord<ResearcherProviderSelectionRecord>("researcher-provider-selections", "researcher");
  }

  async recordOuroborosCommand(command: OuroborosCommandRecord): Promise<OuroborosCommandRecord> {
    await this.writeJson(this.itemPath("ouroboros-commands", command.ouroboros_command_id), command);
    return command;
  }

  async listOuroborosCommands(): Promise<OuroborosCommandRecord[]> {
    return (await this.readCollection<OuroborosCommandRecord>("ouroboros-commands"))
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  }

  async recordArtifactLineage(
    lineage: ArtifactLineageRecord
  ): Promise<ArtifactLineageRecord> {
    if (!isArtifactLineageRecord(lineage)) {
      throw new LocalStoreError(
        "invalid_artifact_lineage_input",
        "invalid artifact change lineage input",
        {
          artifact_lineage_id: (lineage as Partial<ArtifactLineageRecord> | undefined)
            ?.artifact_lineage_id
        }
      );
    }
    await this.assertArtifactLineageLinks(lineage);
    await this.writeJson(this.itemPath("artifact-lineages", lineage.artifact_lineage_id), lineage);
    return lineage;
  }

  async listArtifactLineages(): Promise<ArtifactLineageRecord[]> {
    return (await this.readCollection<ArtifactLineageRecord>("artifact-lineages"))
      .sort(compareArtifactLineages);
  }

  async listArtifactLineagesForArtifact(
    systemCodeId: string
  ): Promise<ArtifactLineageRecord[]> {
    return (await this.listArtifactLineages()).filter(
      (lineage) =>
        lineage.child_system_code_ref.id === systemCodeId ||
        lineage.parent_system_code_ref?.id === systemCodeId
    );
  }

  async recordImprovementProposal(
    proposal: ImprovementProposalRecord
  ): Promise<ImprovementProposalRecord> {
    if (!isImprovementProposalRecord(proposal)) {
      throw new LocalStoreError(
        "invalid_improvement_proposal_input",
        "invalid improvement proposal input",
        {
          improvement_proposal_id: (proposal as Partial<ImprovementProposalRecord> | undefined)
            ?.improvement_proposal_id
        }
      );
    }
    await this.assertResearchFindingRefsExist(
      [...proposal.source_finding_refs, ...(proposal.anti_hacking_finding_refs ?? [])],
      proposal.improvement_proposal_id
    );
    await this.writeJson(
      this.itemPath("improvement-proposals", proposal.improvement_proposal_id),
      proposal
    );
    return proposal;
  }

  async listImprovementProposals(): Promise<ImprovementProposalRecord[]> {
    return (await this.readCollection<ImprovementProposalRecord>("improvement-proposals"))
      .sort(compareImprovementProposals);
  }

  async listImprovementProposalsForFinding(researchFindingId: string): Promise<ImprovementProposalRecord[]> {
    return (await this.listImprovementProposals()).filter((proposal) =>
      proposal.source_finding_refs.some((findingRef) => findingRef.id === researchFindingId) ||
      (proposal.anti_hacking_finding_refs ?? []).some((findingRef) => findingRef.id === researchFindingId)
    );
  }

  async recordResearchOrchestrationRun(
    run: ResearchOrchestrationRunRecord
  ): Promise<ResearchOrchestrationRunRecord> {
    if (!isResearchOrchestrationRunRecord(run)) {
      throw new LocalStoreError(
        "invalid_research_orchestration_run_input",
        "invalid automated research orchestration run input",
        {
          research_orchestration_run_id: (run as Partial<ResearchOrchestrationRunRecord> | undefined)
            ?.research_orchestration_run_id
        }
      );
    }
    await this.assertResearchFindingRefsExist(run.input_finding_refs, run.research_orchestration_run_id);
    if (run.output_artifact_proposal_ref) {
      const proposal = await this.readOptionalRecord<ImprovementProposalRecord>(
        "improvement-proposals",
        run.output_artifact_proposal_ref.id
      );
      if (!proposal) {
        throw new LocalStoreError(
          "improvement_proposal_not_found",
          `improvement proposal ${run.output_artifact_proposal_ref.id} not found`,
          {
            improvement_proposal_id: run.output_artifact_proposal_ref.id,
            research_orchestration_run_id: run.research_orchestration_run_id
          }
        );
      }
    }
    for (const lineageRef of run.input_lineage_refs ?? []) {
      const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
        "artifact-lineages",
        lineageRef.id
      );
      if (!lineage) {
        throw new LocalStoreError(
          "artifact_lineage_not_found",
          `artifact change lineage ${lineageRef.id} not found`,
          {
            artifact_lineage_id: lineageRef.id,
            research_orchestration_run_id: run.research_orchestration_run_id
          }
        );
      }
    }
    await this.writeJson(this.itemPath("research-orchestration-runs", run.research_orchestration_run_id), run);
    return run;
  }

  async listResearchOrchestrationRuns(): Promise<ResearchOrchestrationRunRecord[]> {
    return (await this.readCollection<ResearchOrchestrationRunRecord>("research-orchestration-runs"))
      .sort(compareResearchOrchestrationRuns);
  }

  async recordExperimentRun(experiment: ExperimentRunRecord): Promise<ExperimentRunRecord> {
    if (!isExperimentRunRecord(experiment)) {
      throw new LocalStoreError(
        "invalid_experiment_run_input",
        "invalid automated research experiment record",
        { experiment_run_id: (experiment as Partial<ExperimentRunRecord> | undefined)?.experiment_run_id }
      );
    }
    await this.writeJson(this.itemPath("experiment-runs", experiment.experiment_run_id), experiment);
    return experiment;
  }

  async listExperimentRuns(): Promise<ExperimentRunRecord[]> {
    return (await this.readCollection<ExperimentRunRecord>("experiment-runs"))
      .sort(compareExperimentRuns);
  }

  async recordTradingEvaluationResult(
    result: TradingEvaluationResultRecord
  ): Promise<TradingEvaluationResultRecord> {
    if (!isTradingEvaluationResultRecord(result)) {
      throw new LocalStoreError(
        "invalid_trading_evaluation_result_input",
        "invalid trading evaluation result record",
        {
          trading_evaluation_result_id:
            (result as Partial<TradingEvaluationResultRecord> | undefined)?.trading_evaluation_result_id
        }
      );
    }
    await this.writeJson(
      this.itemPath("trading-evaluation-results", result.trading_evaluation_result_id),
      result
    );
    return result;
  }

  async listTradingEvaluationResults(): Promise<TradingEvaluationResultRecord[]> {
    return (await this.readCollection<TradingEvaluationResultRecord>("trading-evaluation-results"))
      .sort(compareTradingEvaluationResults);
  }

  async listImprovementProposalMaterializationAttempts(): Promise<ImprovementProposalMaterializationAttemptRecord[]> {
    return (await this.readCollection<ImprovementProposalMaterializationAttemptRecord>(
      "improvement-proposal-materialization-attempts"
    )).sort(compareImprovementProposalMaterializationAttempts);
  }

  async materializeImprovementProposal(
    input: ImprovementProposalMaterializationInput
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const existing = await this.findImprovementProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toImprovementProposalMaterializationOutcome(existing);
    }

    const validationFailure = validateImprovementProposalMaterializationInput(input);
    if (validationFailure) {
      return this.recordImprovementProposalMaterializationFailure(input, validationFailure);
    }

    const providerResult = input.provider_result;
    const output = providerResult.output;
    const sourceFindings: ResearchFindingRecord[] = [];
    for (const findingRef of output.source_finding_refs) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordImprovementProposalMaterializationFailure(
          input,
          "improvement_proposal_source_finding_not_found"
        );
      }
      sourceFindings.push(finding);
    }

    for (const findingRef of output.anti_hacking_finding_refs ?? []) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordImprovementProposalMaterializationFailure(
          input,
          "improvement_proposal_source_finding_not_found"
        );
      }
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const suffix = stableSuffix(input.idempotency_key);
    const attemptId = `improvement-proposal-materialization-attempt-${suffix}`;
    const proposalRef = ref("improvement_proposal", `improvement-proposal-${suffix}`);
    const systemCodeRef = ref("system_code", `research-system-code-proposal-${suffix}`);
    const lineageRef = ref("artifact_lineage", `artifact-lineage-${suffix}`);
    const sourceFinding = sourceFindings[0];
    const artifactPath = input.artifact_path ?? "fixtures/trading-systems/clock.py";

    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "materialized",
      validation_status: "accepted",
      output_artifact_proposal_ref: proposalRef,
      output_system_code_ref: systemCodeRef,
      output_lineage_ref: lineageRef,
      created_at: createdAt,
      authority_status: "proposal_input_only"
    };
    const proposal: ImprovementProposalRecord = stripUndefined({
      record_kind: "improvement_proposal",
      version: 1,
      improvement_proposal_id: proposalRef.id,
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      trading_evaluation_task_ref: output.trading_evaluation_task_ref,
      proposed_system_code_ref: systemCodeRef,
      parent_system_code_ref: output.parent_system_code_ref,
      source_finding_refs: output.source_finding_refs,
      anti_hacking_finding_refs: output.anti_hacking_finding_refs,
      proposal_summary: output.proposal_summary,
      requested_change_summary: output.requested_change_summary,
      expected_improvement_summary: output.expected_improvement_summary,
      created_at: createdAt,
      status: "proposed",
      authority_status: "proposal_only"
    } satisfies ImprovementProposalRecord);
    const systemCode: SystemCodeRecord = {
      record_kind: "system_code",
      version: 1,
      system_code_id: systemCodeRef.id,
      artifact_kind: "python_file",
      artifact_path: artifactPath,
      artifact_digest: `sha256:${createHash("sha256").update(input.idempotency_key).digest("hex")}`,
      runtime_kind: "python",
      entrypoint: ["python", artifactPath],
      declared_output_contract: {
        contract_kind: "opaque_runtime_boundary",
        declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
      },
      artifact_runtime_contract_ref: input.artifact_runtime_contract_ref,
      secret_policy_ref: input.secret_policy_ref ?? ref("secret_policy", "no-raw-secrets"),
      capability_policy_ref: input.capability_policy_ref ?? ref("capability_policy", "provider-improvement-proposal"),
      provenance_refs: [
        proposalRef,
        providerResult.agent_run_ref,
        providerResult.trace_ref,
        ...output.source_finding_refs
      ],
      status: "registered",
      created_at: createdAt,
      authority_status: "not_live"
    };
    const lineage: ArtifactLineageRecord = stripUndefined({
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: lineageRef.id,
      child_system_code_ref: systemCodeRef,
      parent_system_code_ref: output.parent_system_code_ref,
      source_finding_refs: output.source_finding_refs,
      created_by_research_worker_ref: sourceFinding.research_worker_ref,
      created_at: createdAt,
      authority_status: "lineage_only"
    } satisfies ArtifactLineageRecord);

    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    await this.writeJson(this.itemPath("improvement-proposals", proposal.improvement_proposal_id), proposal);
    await this.writeJson(this.itemPath("system-codes", systemCode.system_code_id), systemCode);
    await this.writeJson(this.itemPath("artifact-lineages", lineage.artifact_lineage_id), lineage);

    return {
      status: "materialized",
      attempt,
      proposal,
      system_code: systemCode,
      lineage
    };
  }

  async recordImprovementProposalProviderFailure(
    input: ImprovementProposalProviderFailureInput
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const existing = await this.findImprovementProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toImprovementProposalMaterializationOutcome(existing);
    }

    const providerResult = input.provider_result;
    const attemptId = `improvement-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "failed",
      validation_status: "rejected",
      failure_reason: providerResult.failure_reason,
      created_at: input.created_at ?? new Date().toISOString(),
      authority_status: "proposal_input_only"
    };

    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  async listSandboxes(): Promise<SandboxReadModel[]> {
    try {
      const index = await this.readJson<SandboxIndexProjection>(
        path.join(this.storeRoot, "read-models/sandboxes/index.json")
      );
      return index.sandboxes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async getSandbox(sandboxId: string): Promise<SandboxDetailReadModel | undefined> {
    try {
      return await this.readJson<SandboxDetailReadModel>(
        path.join(this.storeRoot, "read-models/sandboxes/items", storeJsonFileName(sandboxId))
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async recordSandboxStart(
    input: SandboxObservationInput
  ): Promise<StartSandboxOutcome> {
    await this.assertSandboxLinks(input.instance);
    await this.writeSandboxObservations(input);
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(input.instance.sandbox_id);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${input.instance.sandbox_id} was not reloaded after start`,
        { sandbox_id: input.instance.sandbox_id }
      );
    }
    return { sandbox };
  }

  async recordSandboxObservations(
    sandboxId: string,
    observations: Omit<SandboxObservationInput, "instance"> & {
      lifecycle_status?: SandboxRecord["lifecycle_status"];
      last_heartbeat_at?: string;
    }
  ): Promise<SandboxLogsOutcome> {
    const instance = await this.readOptionalRecord<SandboxRecord>(
      "sandboxes",
      sandboxId
    );
    if (!instance) {
      throw new LocalStoreError(
        "sandbox_not_found",
        `sandbox ${sandboxId} not found`,
        { sandbox_id: sandboxId }
      );
    }

    const latestHeartbeatAt = observations.last_heartbeat_at
      ?? latestObservedAt(observations.heartbeats)
      ?? instance.last_heartbeat_at;
    const updatedInstance: SandboxRecord = stripUndefined({
      ...instance,
      lifecycle_status: observations.lifecycle_status ?? instance.lifecycle_status,
      log_refs: appendUniqueRefs(instance.log_refs, refsForLogs(observations.logs)),
      heartbeat_refs: appendUniqueRefs(instance.heartbeat_refs, refsForHeartbeats(observations.heartbeats)),
      command_evidence_refs: appendUniqueRefs(
        instance.command_evidence_refs,
        refsForCommandEvidence(observations.command_evidence)
      ),
      last_heartbeat_at: latestHeartbeatAt
    } satisfies SandboxRecord);

    await this.writeSandboxObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(sandboxId);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${sandboxId} was not reloaded after observations`,
        { sandbox_id: sandboxId }
      );
    }
    return {
      sandbox,
      logs: sandbox.logs,
      heartbeats: sandbox.heartbeats,
      command_evidence: sandbox.command_evidence
    };
  }

  async stopSandbox(
    input: StopSandboxInput,
    observations: Omit<SandboxObservationInput, "instance"> = {}
  ): Promise<StartSandboxOutcome> {
    const instance = await this.readOptionalRecord<SandboxRecord>(
      "sandboxes",
      input.sandbox_id
    );
    if (!instance) {
      throw new LocalStoreError(
        "sandbox_not_found",
        `sandbox ${input.sandbox_id} not found`,
        { sandbox_id: input.sandbox_id }
      );
    }

    const observedLifecycleStatus = observations.lifecycle_status;
    const lifecycleStatus = instance.lifecycle_status === "removed" || input.removed_at
      ? "removed"
      : observedLifecycleStatus ?? "stopped";
    const stoppedAt = lifecycleStatus === "stopped" || lifecycleStatus === "removed"
      ? instance.stopped_at ?? observations.stopped_at ?? input.stopped_at ?? new Date().toISOString()
      : instance.stopped_at ?? observations.stopped_at ?? input.stopped_at;
    const updatedInstance: SandboxRecord = stripUndefined({
      ...instance,
      lifecycle_status: lifecycleStatus,
      stopped_at: stoppedAt,
      removed_at: input.removed_at ?? instance.removed_at,
      log_refs: appendUniqueRefs(instance.log_refs, refsForLogs(observations.logs)),
      heartbeat_refs: appendUniqueRefs(instance.heartbeat_refs, refsForHeartbeats(observations.heartbeats)),
      command_evidence_refs: appendUniqueRefs(
        instance.command_evidence_refs,
        refsForCommandEvidence(observations.command_evidence)
      ),
      last_heartbeat_at: latestObservedAt(observations.heartbeats) ?? instance.last_heartbeat_at
    } satisfies SandboxRecord);

    await this.writeSandboxObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const sandbox = await this.getSandbox(input.sandbox_id);
    if (!sandbox) {
      throw new LocalStoreError(
        "sandbox_reload_failed",
        `sandbox ${input.sandbox_id} was not reloaded after stop`,
        { sandbox_id: input.sandbox_id }
      );
    }
    return { sandbox };
  }

  async listCandidateEvaluationRuns(candidateId: string): Promise<CandidateEvaluationRunOutcome[]> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const replayRuns = evaluationRuns
      .filter((run) => run.candidate_ref.id === candidateId)
      .sort(compareEvaluationRuns);

    return Promise.all(
      replayRuns.map((evaluationRun) => this.toCandidateEvaluationRunOutcome(evaluationRun))
    );
  }

  async createEvaluationRunForCandidate(
    input: CandidateEvaluationRunInput
  ): Promise<CandidateEvaluationRunOutcome> {
    const validationFailure = validateCandidateEvaluationRunInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid candidate evaluation run input");
    }

    const stage = input.stage ?? "backtest";
    if (stage !== "backtest") {
      throw new LocalStoreError(
        "unsupported_evaluation_stage",
        `unsupported evaluation stage ${String(stage)}`,
        { stage }
      );
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const evaluationRunId = candidateEvaluationRunRecordId({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersionId,
      idempotency_key: input.idempotency_key
    });
    const suffix = evaluationRunId.replace(/^evaluation-run-/, "");
    const existing = await this.getCandidateEvaluationRun(evaluationRunId);
    if (existing) {
      return existing;
    }

    const traceRef = input.trace_ref ?? ref("trace_placeholder", `evaluation-trace-${suffix}`);
    const createdAt = new Date().toISOString();
    const stageBindingId = `stage-binding-backtest-${suffix}`;
    const comparisonSetId = `evaluation-comparison-set-${suffix}`;
    const sealingDecisionId = `evidence-sealing-decision-${suffix}`;
    const hasProviderOutput = (input.provider_output_artifact_refs?.length ?? 0) > 0;
    const unsealedReason = hasProviderOutput || input.evaluator_ref
      ? "provider_output_trace_only"
      : "no_external_evaluator";

    const trace: TracePlaceholderRecord = stripUndefined({
      record_kind: "trace_placeholder",
      version: 1,
      trace_id: traceRef.id,
      input_artifact_refs: input.input_artifact_refs,
      provider_output_artifact_refs: input.provider_output_artifact_refs,
      debug_artifact_refs: input.debug_artifact_refs,
      captured_at: createdAt,
      authority_label: "provider_output_not_evidence",
      authority_status: "not_counted"
    } satisfies TracePlaceholderRecord);
    const stageBinding: StageBindingRecord = {
      record_kind: "stage_binding",
      version: 1,
      stage_binding_id: stageBindingId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage: "backtest",
      profile: "backtest",
      execution_mode: input.execution_mode ?? "host_local",
      created_at: createdAt,
      authority_status: "not_live"
    };
    const evaluationRun: EvaluationRunRecord = stripUndefined({
      record_kind: "evaluation_run_record",
      version: 1,
      evaluation_run_record_id: evaluationRunId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage_binding_ref: ref("stage_binding", stageBinding.stage_binding_id),
      trace_ref: traceRef,
      evaluator_ref: input.evaluator_ref,
      status: "created",
      created_at: createdAt,
      authority_status: "not_counted"
    } satisfies EvaluationRunRecord);
    const comparisonSet: EvaluationComparisonSetRecord = {
      record_kind: "evaluation_comparison_set",
      version: 1,
      evaluation_comparison_set_id: comparisonSetId,
      candidate_ref: ref("trading_system_candidate", candidate.candidate_id),
      candidate_version_ref: ref("candidate_version", candidateVersion.candidate_version_id),
      stage_binding_ref: ref("stage_binding", stageBinding.stage_binding_id),
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      comparability_status: "not_evaluated",
      comparability_reason: unsealedReason,
      created_at: createdAt,
      authority_status: "not_counted"
    };
    const sealingDecision: EvidenceSealingDecisionRecord = {
      record_kind: "evidence_sealing_decision",
      version: 1,
      evidence_sealing_decision_id: sealingDecisionId,
      evaluation_comparison_set_ref: ref(
        "evaluation_comparison_set",
        comparisonSet.evaluation_comparison_set_id
      ),
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      evidence_disposition: "not_counted",
      disposition_reason: unsealedReason,
      created_at: createdAt,
      authority_status: "not_counted"
    };
    const evidenceClassifications = defaultEvidenceClassificationRecords({
      candidateRef: evaluationRun.candidate_ref,
      candidateVersionRef: evaluationRun.candidate_version_ref,
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      traceRef: evaluationRun.trace_ref,
      sealingDecisionRef: ref("evidence_sealing_decision", sealingDecision.evidence_sealing_decision_id),
      reason: unsealedReason,
      createdAt
    });

    const records: FixtureItem[] = [
      { collection: "traces", id: trace.trace_id, itemDir: "placeholders", record: trace },
      { collection: "stage-bindings", id: stageBinding.stage_binding_id, record: stageBinding },
      { collection: "evaluation-runs", id: evaluationRun.evaluation_run_record_id, record: evaluationRun },
      {
        collection: "evaluation-comparison-sets",
        id: comparisonSet.evaluation_comparison_set_id,
        record: comparisonSet
      },
      {
        collection: "evidence-sealing-decisions",
        id: sealingDecision.evidence_sealing_decision_id,
        record: sealingDecision
      },
      ...evidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.getCandidateEvaluationRun(evaluationRun.evaluation_run_record_id);
    if (!outcome) {
      throw new LocalStoreError(
        "evaluation_run_reload_failed",
        `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after write`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }
    return outcome;
  }

  async sealEvaluationRunEvidence(
    input: EvidenceSealingDecisionInput
  ): Promise<CandidateEvaluationRunOutcome> {
    const validationFailure = validateEvidenceSealingDecisionInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid evidence sealing input");
    }

    const evaluationRun = await this.readOptionalRecord<EvaluationRunRecord>(
      "evaluation-runs",
      input.evaluation_run_record_id
    );
    if (!evaluationRun) {
      throw new LocalStoreError(
        "evaluation_run_not_found",
        `evaluation run ${input.evaluation_run_record_id} not found`,
        { evaluation_run_record_id: input.evaluation_run_record_id }
      );
    }

    const comparisonSet = await this.findEvaluationComparisonSetForRun(
      evaluationRun.evaluation_run_record_id
    );
    if (!comparisonSet) {
      throw new LocalStoreError(
        "evaluation_run_incomplete",
        `evaluation run ${evaluationRun.evaluation_run_record_id} has no comparison set`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }

    const sealingDecisionId = evidenceSealingDecisionRecordId({
      evaluation_run_record_id: evaluationRun.evaluation_run_record_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readOptionalRecord<EvidenceSealingDecisionRecord>(
      "evidence-sealing-decisions",
      sealingDecisionId
    );
    if (existing) {
      const existingOutcome = await this.getCandidateEvaluationRun(
        evaluationRun.evaluation_run_record_id
      );
      if (!existingOutcome) {
        throw new LocalStoreError(
          "evaluation_run_reload_failed",
          `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after sealing`,
          { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
        );
      }
      return existingOutcome;
    }

    const createdAt = new Date().toISOString();
    const sealedAt = input.sealed_at ?? createdAt;
    const sealingDecision = evidenceSealingDecisionRecord({
      evidenceSealingDecisionId: sealingDecisionId,
      comparisonSetRef: ref(
        "evaluation_comparison_set",
        comparisonSet.evaluation_comparison_set_id
      ),
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      evidenceDisposition: input.evidence_disposition,
      dispositionReason: input.disposition_reason,
      createdAt,
      sealedAt
    });
    const classifiedRefs = input.classified_refs?.length
      ? input.classified_refs
      : [evaluationRun.trace_ref];
    const evidenceClassifications = sealedEvidenceClassificationRecords({
      candidateRef: evaluationRun.candidate_ref,
      candidateVersionRef: evaluationRun.candidate_version_ref,
      evaluationRunRef: ref("evaluation_run_record", evaluationRun.evaluation_run_record_id),
      sealingDecisionRef: ref("evidence_sealing_decision", sealingDecision.evidence_sealing_decision_id),
      evidenceDisposition: sealingDecision.evidence_disposition,
      reason: sealingDecision.disposition_reason,
      classifiedRefs,
      createdAt
    });

    const records: FixtureItem[] = [
      {
        collection: "evidence-sealing-decisions",
        id: sealingDecision.evidence_sealing_decision_id,
        record: sealingDecision
      },
      ...evidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.getCandidateEvaluationRun(evaluationRun.evaluation_run_record_id);
    if (!outcome) {
      throw new LocalStoreError(
        "evaluation_run_reload_failed",
        `evaluation run ${evaluationRun.evaluation_run_record_id} was not reloaded after sealing`,
        { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
      );
    }
    return outcome;
  }

  async recordLedger(
    input: LedgerInput
  ): Promise<LedgerWriteOutcome> {
    const validationFailure = validateLedgerInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid ledger input");
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const runtimeId = input.runtime_id ?? candidateVersion.runtime_ref.id;
    const runtime = await this.readOptionalRecord<TradingRunRecord>(
      "trading-runs",
      runtimeId
    );
    if (!runtime) {
      throw new LocalStoreError(
        "runtime_not_found",
        `runtime ${runtimeId} not found`,
        { runtime_id: runtimeId }
      );
    }
    if (
      runtime.trading_run_id !== candidateVersion.runtime_ref.id ||
      (runtime.candidate_ref !== undefined && runtime.candidate_ref.id !== candidate.candidate_id) ||
      (
        runtime.candidate_version_ref !== undefined &&
        runtime.candidate_version_ref.id !== candidateVersion.candidate_version_id
      )
    ) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_run_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_run_id
        }
      );
    }

    const recordIds = ledgerRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_run_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readLedgerWriteOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (existing) {
      return existing;
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const orderIntentRef = ref("order_request", recordIds.orderIntent);
    const gatewayDecisionRef = ref("gateway_result", recordIds.gatewayDecision);
    const executionAttemptRef = ref("execution_result", recordIds.executionAttempt);
    const runtimeRef = ref("trading_run", runtime.trading_run_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const stageBindingId = runtime.stage_binding_ref?.id
      ?? `stage-binding-paper-${stableSuffix(runtime.trading_run_id)}`;
    const stageBindingRef = ref("stage_binding", stageBindingId);
    const existingStageBinding = await this.readOptionalRecord<StageBindingRecord>(
      "stage-bindings",
      stageBindingId
    );

    const orderIntent: OrderRequestRecord = stripUndefined({
      record_kind: "order_request",
      version: 1,
      order_request_id: recordIds.orderIntent,
      runtime_ref: runtimeRef,
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: input.execution_result?.trace_ref ?? runtime.trace_ref,
      intent_kind: input.intent.intent_kind,
      market_scope: "external_trading_api_fixture",
      side: input.intent.side,
      order_type: input.intent.order_type,
      quantity: input.intent.quantity,
      limit_price: input.intent.limit_price,
      status: "proposed",
      created_at: createdAt,
      authority_status: "not_submitted"
    } satisfies OrderRequestRecord);
    const gatewayDecisionAuthorityStatus = gatewayDecisionAuthorityStatusForOutcome(
      input.gateway_result.decision_outcome
    );
    const gatewayDecision: GatewayResultRecord = stripUndefined({
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: recordIds.gatewayDecision,
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      decision_outcome: input.gateway_result.decision_outcome,
      decision_reason: input.gateway_result.decision_reason,
      decided_at: createdAt,
      policy_ref: input.gateway_result.policy_ref,
      authority_status: gatewayDecisionAuthorityStatus
    } satisfies GatewayResultRecord);
    const executionAttemptStatus = input.execution_result?.status
      ?? executionAttemptStatusForDecision(input.gateway_result.decision_outcome);
    const executionAttemptAuthorityStatus = executionAttemptAuthorityStatusForStatus(
      executionAttemptStatus,
      input.gateway_result.decision_outcome
    );
    const executionAttempt: ExecutionResultRecord = stripUndefined({
      record_kind: "execution_result",
      version: 1,
      execution_result_id: recordIds.executionAttempt,
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      gateway_result_ref: gatewayDecisionRef,
      stage: "paper",
      execution_mode: input.execution_result?.execution_mode ?? "host_local",
      venue_scope: "external_trading_api_fixture",
      trace_ref: input.execution_result?.trace_ref ?? runtime.trace_ref,
      status: executionAttemptStatus,
      result_reason: input.execution_result?.result_reason ?? input.gateway_result.decision_reason,
      created_at: createdAt,
      completed_at: input.execution_result?.completed_at,
      authority_status: executionAttemptAuthorityStatus
    } satisfies ExecutionResultRecord);
    const stageBinding: StageBindingRecord | undefined = existingStageBinding
      ? undefined
      : stripUndefined({
          record_kind: "stage_binding",
          version: 1,
          stage_binding_id: stageBindingId,
          candidate_ref: candidateRef,
          candidate_version_ref: candidateVersionRef,
          stage: "paper",
          profile: "paper",
          execution_mode: executionAttempt.execution_mode,
          sandbox_placement_ref: runtime.placement_ref,
          hands_environment_ref: runtime.hands_environment_ref,
          created_at: createdAt,
          authority_status: "not_live"
        } satisfies StageBindingRecord);
    const updatedRuntime: TradingRunRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: runtime.runtime_lifecycle_status ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      order_request_refs: appendUniqueRefs(runtime.order_request_refs, orderIntentRef),
      gateway_result_refs: appendUniqueRefs(runtime.gateway_result_refs, gatewayDecisionRef),
      execution_result_refs: appendUniqueRefs(runtime.execution_result_refs, executionAttemptRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingRunRecord);

    const records: FixtureItem[] = [
      ...(stageBinding
        ? [{ collection: "stage-bindings" as const, id: stageBinding.stage_binding_id, record: stageBinding }]
        : []),
      { collection: "order-requests", id: orderIntent.order_request_id, record: orderIntent },
      { collection: "gateway-results", id: gatewayDecision.gateway_result_id, record: gatewayDecision },
      { collection: "execution-results", id: executionAttempt.execution_result_id, record: executionAttempt },
      { collection: "trading-runs", id: updatedRuntime.trading_run_id, record: updatedRuntime }
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.readLedgerWriteOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "ledger_reload_failed",
        `ledger records were not reloaded after write`,
        { runtime_id: runtime.trading_run_id }
      );
    }
    return outcome;
  }

  async recordPaperTradingEvaluation(
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingEvaluationRecord> {
    await this.writeJson(
      this.itemPath("paper-trading-evaluations", evaluation.paper_trading_evaluation_id),
      evaluation
    );
    return evaluation;
  }

  async getPaperTradingEvaluation(
    evaluationId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return this.readOptionalRecord<PaperTradingEvaluationRecord>(
      "paper-trading-evaluations",
      evaluationId
    );
  }

  async listPaperTradingEvaluations(): Promise<PaperTradingEvaluationRecord[]> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .sort(comparePaperTradingEvaluations);
  }

  async getLatestPaperTradingEvaluationForCandidate(
    candidateId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return (await this.listPaperTradingEvaluationsForCandidate(candidateId)).at(-1);
  }

  async getLatestPaperTradingEvaluationForTradingRun(
    tradingRunId: string
  ): Promise<PaperTradingEvaluationRecord | undefined> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .filter((evaluation) => evaluation.trading_run_ref.id === tradingRunId)
      .sort(comparePaperTradingEvaluations)
      .at(-1);
  }

  async listPaperTradingEvaluationsForCandidate(
    candidateId: string
  ): Promise<PaperTradingEvaluationRecord[]> {
    return (await this.readCollection<PaperTradingEvaluationRecord>("paper-trading-evaluations"))
      .filter((evaluation) => evaluation.candidate_ref.id === candidateId)
      .sort(comparePaperTradingEvaluations);
  }

  async recordPaperTradingObservation(
    observation: PaperTradingObservationRecord,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingObservationRecord> {
    await this.writeJson(
      this.itemPath("paper-trading-observations", observation.paper_trading_observation_id),
      observation
    );
    await this.recordPaperTradingEvaluation(evaluation);
    return observation;
  }

  async listPaperTradingObservations(
    evaluationId: string
  ): Promise<PaperTradingObservationRecord[]> {
    return (await this.readCollection<PaperTradingObservationRecord>("paper-trading-observations"))
      .filter((observation) => observation.paper_trading_evaluation_ref.id === evaluationId)
      .sort(comparePaperTradingObservations);
  }

  async recordRunControlAudit(
    input: RunControlAuditInput
  ): Promise<RunControlAuditOutcome> {
    const validationFailure = validateRunControlAuditInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid runtime control input");
    }

    const candidate = await this.readOptionalRecord<TradingSystemCandidateRecord>(
      "candidates",
      input.candidate_id
    );
    if (!candidate) {
      throw new LocalStoreError(
        "candidate_not_found",
        `candidate ${input.candidate_id} not found`,
        { candidate_id: input.candidate_id }
      );
    }

    const candidateVersionId = input.candidate_version_id ?? candidate.active_version_id;
    const candidateVersion = await this.readOptionalRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidateVersionId
    );
    if (!candidateVersion) {
      throw new LocalStoreError(
        "candidate_version_not_found",
        `candidate version ${candidateVersionId} not found`,
        { candidate_id: candidate.candidate_id, candidate_version_id: candidateVersionId }
      );
    }
    if (candidateVersion.candidate_id !== candidate.candidate_id) {
      throw new LocalStoreError(
        "candidate_version_mismatch",
        `candidate version ${candidateVersionId} does not belong to candidate ${candidate.candidate_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersionId,
          actual_candidate_id: candidateVersion.candidate_id
        }
      );
    }

    const runtimeId = input.runtime_id ?? candidateVersion.runtime_ref.id;
    const runtime = await this.readOptionalRecord<TradingRunRecord>(
      "trading-runs",
      runtimeId
    );
    if (!runtime) {
      throw new LocalStoreError(
        "runtime_not_found",
        `runtime ${runtimeId} not found`,
        { runtime_id: runtimeId }
      );
    }
    if (
      runtime.trading_run_id !== candidateVersion.runtime_ref.id ||
      (runtime.candidate_ref !== undefined && runtime.candidate_ref.id !== candidate.candidate_id) ||
      (
        runtime.candidate_version_ref !== undefined &&
        runtime.candidate_version_ref.id !== candidateVersion.candidate_version_id
      )
    ) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_run_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_run_id
        }
      );
    }

    const recordIds = runtimeControlAuditRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_run_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readRunControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (existing) {
      return existing;
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const runtimeRef = ref("trading_run", runtime.trading_run_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const commandRef = ref("run_control_command", recordIds.command);
    const decisionRef = ref("run_control_decision", recordIds.decision);
    const auditEventRef = ref("runtime_audit_event", recordIds.auditEvent);
    const authorityStatus = runtimeControlAuthorityStatusForOutcome(
      input.decision.decision_outcome
    );
    const command: RunControlCommandRecord = stripUndefined({
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: recordIds.command,
      runtime_ref: runtimeRef,
      action: input.command.action,
      requested_lifecycle_status: input.command.requested_lifecycle_status,
      actor_kind: input.command.actor_kind,
      actor_ref: input.command.actor_ref,
      runtime_operating_policy_ref: input.command.runtime_operating_policy_ref,
      idempotency_key: input.idempotency_key,
      reason: input.command.reason,
      reason_summary: input.command.reason_summary,
      trace_ref: input.command.trace_ref ?? runtime.trace_ref,
      related_order_request_refs: input.command.related_order_request_refs,
      related_gateway_result_refs: input.command.related_gateway_result_refs,
      related_execution_result_refs: input.command.related_execution_result_refs,
      requested_at: createdAt,
      status: "decided",
      authority_status: authorityStatus
    } satisfies RunControlCommandRecord);
    const decision: RunControlDecisionRecord = stripUndefined({
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: recordIds.decision,
      runtime_ref: runtimeRef,
      command_ref: commandRef,
      decision_outcome: input.decision.decision_outcome,
      decision_reason: input.decision.decision_reason,
      decided_by_actor_kind: input.decision.decided_by_actor_kind,
      decided_by_actor_ref: input.decision.decided_by_actor_ref,
      runtime_operating_policy_ref: input.decision.runtime_operating_policy_ref
        ?? input.command.runtime_operating_policy_ref,
      resulting_lifecycle_status: input.decision.resulting_lifecycle_status,
      trace_ref: input.decision.trace_ref ?? input.command.trace_ref ?? runtime.trace_ref,
      related_order_request_refs: input.decision.related_order_request_refs
        ?? input.command.related_order_request_refs,
      related_gateway_result_refs: input.decision.related_gateway_result_refs
        ?? input.command.related_gateway_result_refs,
      related_execution_result_refs: input.decision.related_execution_result_refs
        ?? input.command.related_execution_result_refs,
      decided_at: createdAt,
      authority_status: authorityStatus
    } satisfies RunControlDecisionRecord);
    const auditEvent: RuntimeAuditEventRecord = stripUndefined({
      record_kind: "runtime_audit_event",
      version: 1,
      runtime_audit_event_id: recordIds.auditEvent,
      runtime_ref: runtimeRef,
      event_kind: input.audit_event.event_kind,
      command_ref: commandRef,
      decision_ref: decisionRef,
      actor_kind: input.audit_event.actor_kind ?? input.command.actor_kind,
      actor_ref: input.audit_event.actor_ref ?? input.command.actor_ref,
      runtime_lifecycle_status: input.audit_event.runtime_lifecycle_status
        ?? input.decision.resulting_lifecycle_status,
      message: input.audit_event.message,
      trace_ref: input.audit_event.trace_ref
        ?? input.decision.trace_ref
        ?? input.command.trace_ref
        ?? runtime.trace_ref,
      supporting_record_refs: input.audit_event.supporting_record_refs
        ?? [commandRef, decisionRef],
      related_order_request_refs: input.audit_event.related_order_request_refs
        ?? decision.related_order_request_refs,
      related_gateway_result_refs: input.audit_event.related_gateway_result_refs
        ?? decision.related_gateway_result_refs,
      related_execution_result_refs: input.audit_event.related_execution_result_refs
        ?? decision.related_execution_result_refs,
      created_at: createdAt,
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord);
    const updatedRuntime: TradingRunRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: decision.resulting_lifecycle_status
        ?? runtime.runtime_lifecycle_status
        ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      run_control_command_refs: appendUniqueRefs(runtime.run_control_command_refs, commandRef),
      run_control_decision_refs: appendUniqueRefs(runtime.run_control_decision_refs, decisionRef),
      runtime_audit_event_refs: appendUniqueRefs(runtime.runtime_audit_event_refs, auditEventRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingRunRecord);

    const records: FixtureItem[] = [
      { collection: "run-control-commands", id: command.run_control_command_id, record: command },
      { collection: "run-control-decisions", id: decision.run_control_decision_id, record: decision },
      { collection: "runtime-audit-events", id: auditEvent.runtime_audit_event_id, record: auditEvent },
      { collection: "trading-runs", id: updatedRuntime.trading_run_id, record: updatedRuntime }
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.readRunControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_run_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "run_control_reload_failed",
        `runtime control records were not reloaded after write`,
        { runtime_id: runtime.trading_run_id }
      );
    }
    return outcome;
  }

  async listCandidateMaterializationAttempts(): Promise<CandidateMaterializationAttemptReadModel[]> {
    try {
      const index = await this.readJson<CandidateMaterializationAttemptIndexProjection>(
        path.join(this.storeRoot, "read-models/candidate-materialization-attempts/index.json")
      );
      return index.attempts;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async getCandidateMaterializationAttempt(
    attemptId: string
  ): Promise<CandidateMaterializationAttemptReadModel | undefined> {
    try {
      return await this.readJson<CandidateMaterializationAttemptReadModel>(
        path.join(
          this.storeRoot,
          "read-models/candidate-materialization-attempts/items",
          storeJsonFileName(attemptId)
        )
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async materializeCandidate(input: CandidateMaterializationInput): Promise<CandidateMaterializationOutcome> {
    const existing = await this.findMaterializationAttemptByIdempotencyKey(input.idempotency_key);
    if (existing) {
      return this.toMaterializationOutcome(existing);
    }

    const validationFailure = validateCandidateMaterializationInput(input);
    if (validationFailure) {
      return this.recordCandidateMaterializationFailure({
        idempotency_key: input.idempotency_key,
        provider_kind: input.provider.provider_kind,
        model: input.provider.model,
        agent_run_id: input.provider.agent_run_id,
        trace_id: input.provider.trace_id,
        failure_reason: validationFailure,
        artifact_refs: input.artifact_refs
      });
    }

    const suffix = stableSuffix(input.idempotency_key);
    const candidateId = `candidate-${suffix}`;
    const idsForCandidate = {
      attempt: `candidate-materialization-attempt-${suffix}`,
      candidate: candidateId,
      version: `candidate-version-${suffix}`,
      spec: `trading-system-spec-${suffix}`,
      program: `trading-system-program-${suffix}`,
      programManifest: `program-manifest-${suffix}`,
      programValidation: `program-validation-${suffix}`,
      capabilityPackage: `capability-package-${suffix}`,
      capabilityManifest: `capability-manifest-${suffix}`,
      capabilityAdmission: `capability-admission-${suffix}`,
      capabilityGrant: `capability-grant-${suffix}`,
      capabilityMount: `capability-mount-${suffix}`,
      agentSpec: `agent-spec-${suffix}`,
      agentSession: `agent-session-${suffix}`,
      providerReadiness: `provider-readiness-${suffix}`,
      providerProbe: `provider-probe-${suffix}`,
      runtime: `trading-run-${suffix}`,
      placement: `sandbox-placement-${suffix}`,
      handsEnvironment: `hands-environment-${suffix}`,
      memorySurface: `runtime-memory-surface-${suffix}`,
      stageBinding: `stage-binding-backtest-${suffix}`,
      evaluationRun: `evaluation-run-${suffix}`,
      evaluationComparisonSet: `evaluation-comparison-set-${suffix}`,
      evidenceSealingDecision: `evidence-sealing-decision-${suffix}`
    };

    const attemptRef = ref("candidate_materialization_attempt", idsForCandidate.attempt);
    const agentRunRef = ref("agent_run", input.provider.agent_run_id);
    const traceRef = ref("trace_placeholder", input.provider.trace_id);
    const providerReadinessRef = ref("provider_readiness_record", idsForCandidate.providerReadiness);
    const systemCodeRef = input.system_code_ref;

    const attempt: CandidateMaterializationAttemptRecord = {
      record_kind: "candidate_materialization_attempt",
      version: 1,
      candidate_materialization_attempt_id: idsForCandidate.attempt,
      idempotency_key: input.idempotency_key,
      provider_kind: input.provider.provider_kind,
      model: input.provider.model,
      agent_run_ref: agentRunRef,
      trace_ref: traceRef,
      status: "materialized",
      validation_status: "accepted",
      resulting_candidate_ref: ref("trading_system_candidate", candidateId),
      artifact_refs: input.artifact_refs,
      ...(input.full_cycle_lineage ? { full_cycle_lineage: input.full_cycle_lineage } : {}),
      created_at: new Date().toISOString()
    };

    const candidate: TradingSystemCandidateRecord = {
      record_kind: "trading_system_candidate",
      version: 1,
      candidate_id: candidateId,
      display_name: input.candidate.title,
      status: "materialized",
      active_version_id: idsForCandidate.version,
      provenance_refs: [agentRunRef, providerReadinessRef, attemptRef],
      title: input.candidate.title,
      system_summary: input.candidate.system_summary,
      first_market_scope: input.candidate.first_market_scope,
      candidate_status: "handoff_ready",
      evaluation_handoff_ready: true,
      materialized_from_attempt_ref: attemptRef,
      active_system_code_ref: systemCodeRef
    };
    const candidateVersion: CandidateVersionRecord = {
      record_kind: "candidate_version",
      version: 1,
      candidate_version_id: idsForCandidate.version,
      candidate_id: candidateId,
      version_label: "materialized-v1",
      spec_ref: ref("trading_system_spec", idsForCandidate.spec),
      program_ref: ref("trading_system_program", idsForCandidate.program),
      capability_package_refs: [ref("capability_package", idsForCandidate.capabilityPackage)],
      runtime_ref: ref("trading_run", idsForCandidate.runtime),
      trace_placeholder_ref: traceRef,
      evaluation_run_ref: ref("evaluation_run_record", idsForCandidate.evaluationRun),
      materialization_attempt_ref: attemptRef,
      agent_spec_ref: ref("agent_spec", idsForCandidate.agentSpec),
      agent_session_ref: ref("agent_session", idsForCandidate.agentSession),
      agent_run_ref: agentRunRef,
      agent_event_ref: ref("agent_event", input.provider.agent_event_id),
      provider_readiness_ref: providerReadinessRef,
      provider_probe_attempt_ref: ref("provider_probe_attempt", idsForCandidate.providerProbe),
      system_code_ref: systemCodeRef
    };
    const materializedEvaluationRunRef = ref("evaluation_run_record", idsForCandidate.evaluationRun);
    const materializedSealingDecisionRef = ref(
      "evidence_sealing_decision",
      idsForCandidate.evidenceSealingDecision
    );
    const materializedEvidenceClassifications = defaultEvidenceClassificationRecords({
      candidateRef: ref("trading_system_candidate", candidateId),
      candidateVersionRef: ref("candidate_version", idsForCandidate.version),
      evaluationRunRef: materializedEvaluationRunRef,
      traceRef,
      sealingDecisionRef: materializedSealingDecisionRef,
      reason: "no_external_evaluator",
      createdAt: attempt.created_at
    });

    const records: FixtureItem[] = [
      { collection: "candidate-materialization-attempts", id: idsForCandidate.attempt, record: attempt },
      { collection: "candidates", id: candidateId, record: candidate },
      { collection: "candidate-versions", id: idsForCandidate.version, record: candidateVersion },
      {
        collection: "trading-system-specs",
        id: idsForCandidate.spec,
        record: {
          record_kind: "trading_system_spec",
          version: 1,
          trading_system_spec_id: idsForCandidate.spec,
          summary: input.spec.summary,
          market: input.spec.market,
          instrument: input.spec.instrument,
          supported_stage_binding_profiles: input.spec.supported_stage_binding_profiles
        } satisfies TradingSystemSpecRecord
      },
      {
        collection: "trading-system-programs",
        id: idsForCandidate.program,
        record: {
          record_kind: "trading_system_program",
          version: 1,
          trading_system_program_id: idsForCandidate.program,
          summary: input.program.summary,
          manifest_ref: ref("program_manifest", idsForCandidate.programManifest),
          validation_record_ref: ref("program_validation_record", idsForCandidate.programValidation)
        } satisfies TradingSystemProgramRecord
      },
      {
        collection: "program-manifests",
        id: idsForCandidate.programManifest,
        record: {
          record_kind: "program_manifest",
          version: 1,
          program_manifest_id: idsForCandidate.programManifest,
          declared_runtime: input.program.declared_runtime,
          declared_outputs: input.program.declared_outputs
        } satisfies ProgramManifestRecord
      },
      {
        collection: "program-validations",
        id: idsForCandidate.programValidation,
        record: {
          record_kind: "program_validation_record",
          version: 1,
          program_validation_record_id: idsForCandidate.programValidation,
          status: "fixture_placeholder",
          authority_status: "not_executable"
        } satisfies ProgramValidationRecord
      },
      {
        collection: "capability-packages",
        id: idsForCandidate.capabilityPackage,
        record: {
          record_kind: "capability_package",
          version: 1,
          capability_package_id: idsForCandidate.capabilityPackage,
          summary: input.capability_package.summary,
          manifest_ref: ref("capability_manifest", idsForCandidate.capabilityManifest),
          admission_record_ref: ref("capability_package_admission_record", idsForCandidate.capabilityAdmission),
          grant_ref: ref("capability_grant", idsForCandidate.capabilityGrant),
          mount_record_ref: ref("capability_mount_record", idsForCandidate.capabilityMount)
        } satisfies CapabilityPackageRecord
      },
      {
        collection: "capability-manifests",
        id: idsForCandidate.capabilityManifest,
        record: {
          record_kind: "capability_manifest",
          version: 1,
          capability_manifest_id: idsForCandidate.capabilityManifest,
          allowed_stages: input.capability_package.allowed_stages,
          declared_permissions: input.capability_package.declared_permissions,
          forbidden_contents: input.capability_package.forbidden_contents
        } satisfies CapabilityManifestRecord
      },
      {
        collection: "capability-admissions",
        id: idsForCandidate.capabilityAdmission,
        record: {
          record_kind: "capability_package_admission_record",
          version: 1,
          capability_package_admission_record_id: idsForCandidate.capabilityAdmission,
          status: "fixture_placeholder",
          authority_status: "not_scanned"
        } satisfies CapabilityPackageAdmissionRecord
      },
      {
        collection: "capability-grants",
        id: idsForCandidate.capabilityGrant,
        record: {
          record_kind: "capability_grant",
          version: 1,
          capability_grant_id: idsForCandidate.capabilityGrant,
          status: "fixture_placeholder",
          authority_status: "not_granted"
        } satisfies CapabilityGrantRecord
      },
      {
        collection: "capability-mounts",
        id: idsForCandidate.capabilityMount,
        record: {
          record_kind: "capability_mount_record",
          version: 1,
          capability_mount_record_id: idsForCandidate.capabilityMount,
          status: "fixture_placeholder",
          authority_status: "not_mounted"
        } satisfies CapabilityMountRecord
      },
      {
        collection: "agent-specs",
        id: idsForCandidate.agentSpec,
        record: {
          record_kind: "agent_spec",
          version: 1,
          agent_spec_id: idsForCandidate.agentSpec,
          purpose: "candidate_generation",
          provider_kind: input.provider.provider_kind,
          model: input.provider.model
        } satisfies AgentSpecRecord
      },
      {
        collection: "agent-sessions",
        id: idsForCandidate.agentSession,
        record: {
          record_kind: "agent_session",
          version: 1,
          agent_session_id: idsForCandidate.agentSession,
          agent_spec_ref: ref("agent_spec", idsForCandidate.agentSpec),
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          authority_status: "trace_only"
        } satisfies AgentSessionRecord
      },
      {
        collection: "agent-runs",
        id: input.provider.agent_run_id,
        record: {
          record_kind: "agent_run",
          version: 1,
          agent_run_id: input.provider.agent_run_id,
          agent_session_ref: ref("agent_session", idsForCandidate.agentSession),
          purpose: "candidate_generation",
          status: "succeeded",
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          trace_ref: traceRef,
          authority_status: "trace_only"
        } satisfies AgentRunRecord
      },
      {
        collection: "agent-events",
        id: input.provider.agent_event_id,
        record: {
          record_kind: "agent_event",
          version: 1,
          agent_event_id: input.provider.agent_event_id,
          agent_run_ref: agentRunRef,
          status: "provider_output_captured"
        } satisfies AgentEventRecord
      },
      {
        collection: "provider-readiness-records",
        id: idsForCandidate.providerReadiness,
        record: {
          record_kind: "provider_readiness_record",
          version: 1,
          provider_readiness_record_id: idsForCandidate.providerReadiness,
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          invocation_surface: input.provider.invocation_surface,
          readiness_status: "active_verified",
          authority_status: "readiness_only"
        } satisfies ProviderReadinessRecord
      },
      {
        collection: "provider-probe-attempts",
        id: idsForCandidate.providerProbe,
        record: {
          record_kind: "provider_probe_attempt",
          version: 1,
          provider_probe_attempt_id: idsForCandidate.providerProbe,
          provider_readiness_record_ref: providerReadinessRef,
          provider_kind: input.provider.provider_kind,
          model: input.provider.model,
          result: "succeeded",
          authority_status: "probe_trace_only"
        } satisfies ProviderProbeAttemptRecord
      },
      {
        collection: "trading-runs",
        id: idsForCandidate.runtime,
        record: {
          record_kind: "trading_run",
          version: 1,
          trading_run_id: idsForCandidate.runtime,
          stage_binding_profile: "paper",
          runtime_lifecycle_status: "registered",
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          placement_ref: ref("sandbox_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          memory_surface_ref: ref("runtime_memory_surface", idsForCandidate.memorySurface),
          authority_status: "not_live"
        } satisfies TradingRunRecord
      },
      {
        collection: "sandbox-placements",
        id: idsForCandidate.placement,
        record: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: idsForCandidate.placement,
          placement_kind: "fixture_local_placeholder",
          tooling_kind: "fixture_only",
          authority_status: "not_launched"
        } satisfies SandboxPlacementRecord
      },
      {
        collection: "hands-environments",
        id: idsForCandidate.handsEnvironment,
        record: {
          record_kind: "hands_environment",
          version: 1,
          hands_environment_id: idsForCandidate.handsEnvironment,
          environment_kind: "fixture_no_tools",
          authority_status: "not_mounted"
        } satisfies HandsEnvironmentRecord
      },
      {
        collection: "runtime-memory-surfaces",
        id: idsForCandidate.memorySurface,
        record: {
          record_kind: "runtime_memory_surface",
          version: 1,
          runtime_memory_surface_id: idsForCandidate.memorySurface,
          trust_class: "fixture_context",
          access_mode: "read_only",
          surface_version: "materialized-v1",
          visibility: "operator_visible",
          quarantine_status: "not_quarantined",
          authority_status: "not_evidence"
        } satisfies RuntimeMemorySurfaceRecord
      },
      {
        collection: "traces",
        id: input.provider.trace_id,
        itemDir: "placeholders",
        record: {
          record_kind: "trace_placeholder",
          version: 1,
          trace_id: input.provider.trace_id,
          authority_status: "not_counted"
        } satisfies TracePlaceholderRecord
      },
      {
        collection: "stage-bindings",
        id: idsForCandidate.stageBinding,
        record: {
          record_kind: "stage_binding",
          version: 1,
          stage_binding_id: idsForCandidate.stageBinding,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage: "backtest",
          profile: "backtest",
          execution_mode: "host_local",
          sandbox_placement_ref: ref("sandbox_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          created_at: attempt.created_at,
          authority_status: "not_live"
        } satisfies StageBindingRecord
      },
      {
        collection: "evaluation-runs",
        id: idsForCandidate.evaluationRun,
        record: {
          record_kind: "evaluation_run_record",
          version: 1,
          evaluation_run_record_id: idsForCandidate.evaluationRun,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage_binding_ref: ref("stage_binding", idsForCandidate.stageBinding),
          trace_ref: traceRef,
          status: "created",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvaluationRunRecord
      },
      {
        collection: "evaluation-comparison-sets",
        id: idsForCandidate.evaluationComparisonSet,
        record: {
          record_kind: "evaluation_comparison_set",
          version: 1,
          evaluation_comparison_set_id: idsForCandidate.evaluationComparisonSet,
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          stage_binding_ref: ref("stage_binding", idsForCandidate.stageBinding),
          evaluation_run_refs: [ref("evaluation_run_record", idsForCandidate.evaluationRun)],
          comparability_status: "not_evaluated",
          comparability_reason: "no_external_evaluator",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvaluationComparisonSetRecord
      },
      {
        collection: "evidence-sealing-decisions",
        id: idsForCandidate.evidenceSealingDecision,
        record: {
          record_kind: "evidence_sealing_decision",
          version: 1,
          evidence_sealing_decision_id: idsForCandidate.evidenceSealingDecision,
          evaluation_comparison_set_ref: ref("evaluation_comparison_set", idsForCandidate.evaluationComparisonSet),
          evaluation_run_refs: [ref("evaluation_run_record", idsForCandidate.evaluationRun)],
          evidence_disposition: "not_counted",
          disposition_reason: "no_external_evaluator",
          created_at: attempt.created_at,
          authority_status: "not_counted"
        } satisfies EvidenceSealingDecisionRecord
      },
      ...materializedEvidenceClassifications.map((classification) => ({
        collection: "evidence-classifications" as const,
        id: classification.evidence_classification_id,
        record: classification
      }))
    ];

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const attemptReadModel = await this.getCandidateMaterializationAttempt(idsForCandidate.attempt);
    const candidateReadModel = await this.getCandidate(candidateId);
    if (!attemptReadModel || !candidateReadModel) {
      throw new Error("candidate materialization projection failed");
    }
    return {
      status: "materialized",
      attempt: attemptReadModel,
      candidate: candidateReadModel
    };
  }

  async recordCandidateMaterializationFailure(
    failure: CandidateMaterializationFailureInput
  ): Promise<CandidateMaterializationOutcome> {
    const existing = await this.findMaterializationAttemptByIdempotencyKey(failure.idempotency_key);
    if (existing) {
      return this.toMaterializationOutcome(existing);
    }

    const attemptId = `candidate-materialization-attempt-${stableSuffix(failure.idempotency_key)}`;
    const attempt: CandidateMaterializationAttemptRecord = {
      record_kind: "candidate_materialization_attempt",
      version: 1,
      candidate_materialization_attempt_id: attemptId,
      idempotency_key: failure.idempotency_key,
      provider_kind: failure.provider_kind,
      model: failure.model,
      agent_run_ref: ref("agent_run", failure.agent_run_id),
      trace_ref: ref("trace_placeholder", failure.trace_id),
      status: "failed",
      validation_status: "rejected",
      failure_reason: failure.failure_reason,
      artifact_refs: failure.artifact_refs,
      created_at: new Date().toISOString()
    };
    await this.writeJson(this.itemPath("candidate-materialization-attempts", attemptId), attempt);
    await this.rebuildProjections();

    const readModel = await this.getCandidateMaterializationAttempt(attemptId);
    if (!readModel) {
      throw new Error("candidate materialization failure projection failed");
    }
    return {
      status: "failed",
      attempt: readModel
    };
  }

  private async recordImprovementProposalMaterializationFailure(
    input: ImprovementProposalMaterializationInput,
    failureReason: ImprovementProposalMaterializationFailureReason
  ): Promise<ImprovementProposalMaterializationOutcome> {
    const attemptId = `improvement-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const providerResult = input.provider_result;
    const attempt: ImprovementProposalMaterializationAttemptRecord = {
      record_kind: "improvement_proposal_materialization_attempt",
      version: 1,
      improvement_proposal_materialization_attempt_id: attemptId,
      idempotency_key: input.idempotency_key,
      provider: providerResult.provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "failed",
      validation_status: "rejected",
      failure_reason: failureReason,
      created_at: input.created_at ?? new Date().toISOString(),
      authority_status: "proposal_input_only"
    };

    await this.writeJson(this.itemPath("improvement-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  private async findImprovementProposalMaterializationAttemptByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ImprovementProposalMaterializationAttemptRecord | undefined> {
    const attempts = await this.readCollection<ImprovementProposalMaterializationAttemptRecord>(
      "improvement-proposal-materialization-attempts"
    );
    return attempts.find((attempt) => attempt.idempotency_key === idempotencyKey);
  }

  private async toImprovementProposalMaterializationOutcome(
    attempt: ImprovementProposalMaterializationAttemptRecord
  ): Promise<ImprovementProposalMaterializationOutcome> {
    if (attempt.status === "failed") {
      return {
        status: "failed",
        attempt
      };
    }

    if (
      !attempt.output_artifact_proposal_ref ||
      !attempt.output_system_code_ref ||
      !attempt.output_lineage_ref
    ) {
      throw new LocalStoreError(
        "improvement_proposal_materialization_reload_failed",
        `improvement proposal materialization attempt ${attempt.improvement_proposal_materialization_attempt_id} has no output refs`,
        { attempt_id: attempt.improvement_proposal_materialization_attempt_id }
      );
    }

    const proposal = await this.readOptionalRecord<ImprovementProposalRecord>(
      "improvement-proposals",
      attempt.output_artifact_proposal_ref.id
    );
    const systemCode = await this.readOptionalRecord<SystemCodeRecord>(
      "system-codes",
      attempt.output_system_code_ref.id
    );
    const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
      "artifact-lineages",
      attempt.output_lineage_ref.id
    );
    if (!proposal || !systemCode || !lineage) {
      throw new LocalStoreError(
        "improvement_proposal_materialization_reload_failed",
        `improvement proposal materialization attempt ${attempt.improvement_proposal_materialization_attempt_id} was not reloaded`,
        { attempt_id: attempt.improvement_proposal_materialization_attempt_id }
      );
    }

    return {
      status: "materialized",
      attempt,
      proposal,
      system_code: systemCode,
      lineage
    };
  }

  private async findMaterializationAttemptByIdempotencyKey(
    idempotencyKey: string
  ): Promise<CandidateMaterializationAttemptRecord | undefined> {
    const attempts = await this.readCollection<CandidateMaterializationAttemptRecord>(
      "candidate-materialization-attempts"
    );
    return attempts.find((attempt) => attempt.idempotency_key === idempotencyKey);
  }

  private async toMaterializationOutcome(
    attempt: CandidateMaterializationAttemptRecord
  ): Promise<CandidateMaterializationOutcome> {
    const attemptReadModel = toCandidateMaterializationAttemptReadModel(attempt);
    if (attempt.status === "materialized" && attempt.resulting_candidate_ref) {
      const candidate = await this.getCandidate(attempt.resulting_candidate_ref.id);
      if (!candidate) {
        throw new Error(`materialized candidate missing for attempt ${attempt.candidate_materialization_attempt_id}`);
      }
      return {
        status: "materialized",
        attempt: attemptReadModel,
        candidate
      };
    }
    return {
      status: "failed",
      attempt: attemptReadModel
    };
  }

  private async toCandidateEvaluationRunOutcome(
    evaluationRun: EvaluationRunRecord
  ): Promise<CandidateEvaluationRunOutcome> {
    try {
      const trace = await this.readRecord<TracePlaceholderRecord>(
        "traces",
        evaluationRun.trace_ref.id,
        "placeholders"
      );
      const stageBinding = await this.readRecord<StageBindingRecord>(
        "stage-bindings",
        evaluationRun.stage_binding_ref.id
      );
      const comparisonSet = await this.evaluationComparisonSetForRun(
        evaluationRun.evaluation_run_record_id
      );
      const sealingDecision = await this.evidenceSealingDecisionForComparisonSet(
        comparisonSet.evaluation_comparison_set_id
      );
      const evidenceClassifications = await this.listEvidenceClassificationsForEvaluationRun(
        evaluationRun.evaluation_run_record_id
      );

      return {
        candidate_id: evaluationRun.candidate_ref.id,
        candidate_version_id: evaluationRun.candidate_version_ref.id,
        trace,
        stage_binding: stageBinding,
        evaluation_run: evaluationRun,
        comparison_set: comparisonSet,
        sealing_decision: sealingDecision,
        evidence_classifications: evidenceClassifications
      };
    } catch (error) {
      if (isMissingFileError(error) || isMissingEvaluationLinkError(error)) {
        throw new LocalStoreError(
          "evaluation_run_incomplete",
          `evaluation run ${evaluationRun.evaluation_run_record_id} has incomplete linked records`,
          { evaluation_run_record_id: evaluationRun.evaluation_run_record_id }
        );
      }
      throw error;
    }
  }

  private async buildCandidateInspectReadModel(candidateId: string): Promise<CandidateInspectReadModel> {
    const candidate = await this.readRecord<TradingSystemCandidateRecord>("candidates", candidateId);
    const version = await this.readRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidate.active_version_id
    );
    const spec = await this.readRecord<TradingSystemSpecRecord>("trading-system-specs", version.spec_ref.id);
    const program = await this.readRecord<TradingSystemProgramRecord>(
      "trading-system-programs",
      version.program_ref.id
    );
    const programManifest = await this.readRecord<ProgramManifestRecord>(
      "program-manifests",
      program.manifest_ref.id
    );
    const programValidation = await this.readRecord<ProgramValidationRecord>(
      "program-validations",
      program.validation_record_ref.id
    );
    const capabilityPackage = await this.readRecord<CapabilityPackageRecord>(
      "capability-packages",
      version.capability_package_refs[0]?.id ?? ""
    );
    const capabilityManifest = await this.readRecord<CapabilityManifestRecord>(
      "capability-manifests",
      capabilityPackage.manifest_ref.id
    );
    const capabilityAdmission = await this.readRecord<CapabilityPackageAdmissionRecord>(
      "capability-admissions",
      capabilityPackage.admission_record_ref.id
    );
    const capabilityGrant = await this.readRecord<CapabilityGrantRecord>(
      "capability-grants",
      capabilityPackage.grant_ref.id
    );
    const capabilityMount = await this.readRecord<CapabilityMountRecord>(
      "capability-mounts",
      capabilityPackage.mount_record_ref.id
    );
    const agentSpecRef = version.agent_spec_ref ?? ref("agent_spec", ids.agentSpec);
    const agentSessionRef = version.agent_session_ref ?? ref("agent_session", ids.agentSession);
    const agentRunRef = version.agent_run_ref ?? ref("agent_run", ids.agentRun);
    const agentEventRef = version.agent_event_ref ?? ref("agent_event", ids.agentEvent);
    const providerReadinessRef =
      version.provider_readiness_ref ?? ref("provider_readiness_record", ids.providerReadiness);
    const providerProbeAttemptRef =
      version.provider_probe_attempt_ref ?? ref("provider_probe_attempt", ids.providerProbe);
    const agentSpec = await this.readRecord<AgentSpecRecord>("agent-specs", agentSpecRef.id);
    const agentSession = await this.readRecord<AgentSessionRecord>("agent-sessions", agentSessionRef.id);
    const agentRun = await this.readRecord<AgentRunRecord>("agent-runs", agentRunRef.id);
    const agentEvent = await this.readRecord<AgentEventRecord>("agent-events", agentEventRef.id);
    const providerReadiness = await this.readRecord<ProviderReadinessRecord>(
      "provider-readiness-records",
      providerReadinessRef.id
    );
    const providerProbe = await this.readRecord<ProviderProbeAttemptRecord>(
      "provider-probe-attempts",
      providerProbeAttemptRef.id
    );
    const runtime = await this.readRecord<TradingRunRecord>(
      "trading-runs",
      version.runtime_ref.id
    );
    const placement = await this.readRecord<SandboxPlacementRecord>(
      "sandbox-placements",
      runtime.placement_ref.id
    );
    const handsEnvironment = await this.readRecord<HandsEnvironmentRecord>(
      "hands-environments",
      runtime.hands_environment_ref.id
    );
    const memorySurface = await this.readRecord<RuntimeMemorySurfaceRecord>(
      "runtime-memory-surfaces",
      runtime.memory_surface_ref.id
    );
    const trace = await this.readRecord<TracePlaceholderRecord>(
      "traces",
      version.trace_placeholder_ref.id,
      "placeholders"
    );
    const evaluation = await this.buildCandidateEvaluationReadModel(candidate, version);
    const materializationAttempt = version.materialization_attempt_ref
      ? await this.readRecord<CandidateMaterializationAttemptRecord>(
          "candidate-materialization-attempts",
          version.materialization_attempt_ref.id
        )
      : undefined;
    const latestTradingSubstrate = await buildLatestBinanceBtcusdtTradingSubstrateProjection(this);
    const ledgerSource = await this.buildLedgerSourceRecordsReadModel(runtime);
    const improvement = await this.buildImprovementReadModel(candidate, version);
    const ledger = buildLedgerReadModel(ledgerSource);
    const fullCycleLineage = buildFullCycleLineageReadModel({
      candidate,
      version,
      materializationAttempt,
      runtime,
      ledger
    });
    const runControl = await this.buildRunControlReadModel(runtime);
    const sandbox = runtime.sandbox_ref
      ? await this.buildSandboxDetailReadModel(runtime.sandbox_ref.id)
      : undefined;
    const transcript = await this.buildTradingRunTranscriptReadModel(
      runtime,
      ledger,
      sandbox
    );

    return {
      ...this.toCandidateSummary(candidate),
      trading_system: {
        system_id: candidate.candidate_id,
        version_id: version.candidate_version_id,
        ref: ref(candidate.record_kind, candidate.candidate_id),
        status: candidate.status,
        summary: candidate.system_summary ?? candidate.display_name
      },
      system_code: {
        ref: version.system_code_ref ?? candidate.active_system_code_ref,
        summary: program.summary,
        declared_runtime: programManifest.declared_runtime,
        declared_outputs: programManifest.declared_outputs
      },
      trading_run: {
        ref: version.runtime_ref,
        stage: runtime.stage_binding_profile,
        lifecycle_status: runtime.runtime_lifecycle_status,
        authority_status: runtime.authority_status
      },
      ledger,
      improvement,
      candidate_version: {
        candidate_version_id: version.candidate_version_id,
        version_label: version.version_label,
        provenance_refs: candidate.provenance_refs,
        materialization_attempt_ref: version.materialization_attempt_ref
      },
      spec: {
        ref: version.spec_ref,
        summary: spec.summary,
        market: spec.market,
        instrument: spec.instrument,
        supported_stage_binding_profiles: spec.supported_stage_binding_profiles
      },
      program: {
        ref: version.program_ref,
        summary: program.summary,
        manifest: {
          ref: program.manifest_ref,
          declared_runtime: programManifest.declared_runtime,
          declared_outputs: programManifest.declared_outputs
        },
        validation: placeholder(program.validation_record_ref, "Program validation", programValidation)
      },
      capability_package: {
        ref: version.capability_package_refs[0],
        summary: capabilityPackage.summary,
        manifest: {
          ref: capabilityPackage.manifest_ref,
          allowed_stages: capabilityManifest.allowed_stages,
          declared_permissions: capabilityManifest.declared_permissions,
          forbidden_contents: capabilityManifest.forbidden_contents
        },
        admission: placeholder(capabilityPackage.admission_record_ref, "Capability admission", capabilityAdmission),
        grant: placeholder(capabilityPackage.grant_ref, "Capability grant", capabilityGrant),
        mount: placeholder(capabilityPackage.mount_record_ref, "Capability mount", capabilityMount)
      },
      agent_provider: {
        agent_spec: placeholder(ref(agentSpec.record_kind, agentSpec.agent_spec_id), "Agent spec", agentSpec),
        agent_session: placeholder(ref(agentSession.record_kind, agentSession.agent_session_id), "Agent session", agentSession),
        agent_run: placeholder(ref(agentRun.record_kind, agentRun.agent_run_id), "Agent run", agentRun),
        agent_event: placeholder(ref(agentEvent.record_kind, agentEvent.agent_event_id), "Agent event", agentEvent),
        provider_readiness: placeholder(ref(providerReadiness.record_kind, providerReadiness.provider_readiness_record_id), "Provider readiness", providerReadiness),
        provider_probe_attempt: placeholder(ref(providerProbe.record_kind, providerProbe.provider_probe_attempt_id), "Provider probe", providerProbe)
      },
      runtime: {
        ref: version.runtime_ref,
        stage_binding_profile: runtime.stage_binding_profile,
        runtime_lifecycle_status: runtime.runtime_lifecycle_status,
        authority_status: runtime.authority_status,
        placement: placeholder(runtime.placement_ref, "Sandbox placement", placement),
        hands_environment: placeholder(runtime.hands_environment_ref, "Hands environment", handsEnvironment),
        memory_surface: {
          ref: runtime.memory_surface_ref,
          trust_class: memorySurface.trust_class,
          access_mode: memorySurface.access_mode,
          surface_version: memorySurface.surface_version,
          visibility: memorySurface.visibility,
          quarantine_status: memorySurface.quarantine_status,
          authority_status: memorySurface.authority_status
        },
        ledger: ledgerSource,
        run_control: runControl,
        sandbox,
        transcript
      },
      trading_substrate: latestTradingSubstrate,
      trace: placeholder(version.trace_placeholder_ref, "Trace placeholder", trace),
      evaluation,
      materialization_attempt: materializationAttempt
        ? toCandidateMaterializationAttemptReadModel(materializationAttempt)
        : undefined,
      full_cycle_lineage: fullCycleLineage
    };
  }

  private async buildImprovementReadModel(
    candidate: TradingSystemCandidateRecord,
    version: CandidateVersionRecord
  ): Promise<ImprovementReadModel> {
    const activeSystemCodeId = version.system_code_ref?.id ?? candidate.active_system_code_ref?.id;
    const allProposals = await this.listImprovementProposals();
    const proposals = activeSystemCodeId
      ? allProposals.filter((proposal) =>
          proposal.parent_system_code_ref?.id === activeSystemCodeId ||
          proposal.proposed_system_code_ref.id === activeSystemCodeId
        )
      : allProposals;
    const proposalIds = new Set(proposals.map((proposal) => proposal.improvement_proposal_id));
    const proposedArtifactIds = new Set(proposals.map((proposal) => proposal.proposed_system_code_ref.id));
    const sourceFindingIds = new Set(
      proposals.flatMap((proposal) => [
        ...proposal.source_finding_refs,
        ...(proposal.anti_hacking_finding_refs ?? [])
      ]).map((findingRef) => findingRef.id)
    );
    const findings = (await this.listResearchFindings()).filter((finding) =>
      sourceFindingIds.has(finding.research_finding_id)
    );
    const materializationAttempts = (await this.listImprovementProposalMaterializationAttempts())
      .filter((attempt) =>
        attempt.output_artifact_proposal_ref !== undefined &&
        proposalIds.has(attempt.output_artifact_proposal_ref.id)
      );
    const orchestrationRuns = (await this.listResearchOrchestrationRuns())
      .filter((run) =>
        run.output_artifact_proposal_ref !== undefined &&
        proposalIds.has(run.output_artifact_proposal_ref.id)
      );
    const experiments = (await this.listExperimentRuns()).filter((experiment) =>
      proposedArtifactIds.has(experiment.system_code_ref?.id ?? "")
    );
    const experimentIds = new Set(experiments.map((experiment) => experiment.experiment_run_id));
    const tradingEvaluationResults = (await this.listTradingEvaluationResults()).filter((result) =>
      experimentIds.has(result.experiment_run_ref.id)
    );

    return buildImprovementReadModel({
      research_findings: findings,
      improvement_proposals: proposals,
      materialization_attempts: materializationAttempts,
      research_orchestration_runs: orchestrationRuns,
      experiment_runs: experiments,
      trading_evaluation_results: tradingEvaluationResults
    });
  }

  private async buildLedgerSourceRecordsReadModel(
    runtime: TradingRunRecord
  ): Promise<LedgerSourceRecordsReadModel> {
    const runtimeId = runtime.trading_run_id;
    const orderRequests = (await this.readCollection<OrderRequestRecord>("order-requests"))
      .filter((orderIntent) => orderIntent.runtime_ref.id === runtimeId)
      .sort(compareOrderRequests);
    if (!orderRequests.length) {
      return emptyLedgerSourceRecordsReadModel();
    }

    const gatewayResults = await this.readCollection<GatewayResultRecord>("gateway-results");
    const executionResults = await this.readCollection<ExecutionResultRecord>("execution-results");
    const chains = orderRequests
      .map((orderRequest) => ledgerSourceChainForOrderRequest({
        orderRequest,
        gatewayResults,
        executionResults
      }))
      .sort(compareLedgerSourceChains)
      .reverse();
    const latestChain = chains[0];
    const latestOrderRequest = latestChain.order_request;
    const latestGatewayResult = latestChain.gateway_result;
    const latestExecutionResult = latestChain.execution_result;

    return {
      has_activity: true,
      chain_complete: latestChain.chain_complete,
      chain_count: chains.length,
      chains,
      latest_order_request: latestOrderRequest,
      latest_gateway_result: latestGatewayResult,
      latest_execution_result: latestExecutionResult,
      order_request: statusPlaceholder(
        ref("order_request", latestOrderRequest.order_request_id),
        "Order request",
        latestOrderRequest.status,
        latestOrderRequest.authority_status
      ),
      gateway_result: latestGatewayResult
        ? statusPlaceholder(
            ref("gateway_result", latestGatewayResult.gateway_result_id),
            "Gateway result",
            latestGatewayResult.decision_outcome,
            latestGatewayResult.authority_status
          )
        : statusPlaceholder(
            ref("gateway_result", "missing"),
            "Gateway result",
            "missing",
            "not_live"
          ),
      execution_result: latestExecutionResult
        ? statusPlaceholder(
            ref("execution_result", latestExecutionResult.execution_result_id),
            "Execution result",
            latestExecutionResult.status,
            latestExecutionResult.authority_status
          )
        : statusPlaceholder(
            ref("execution_result", "missing"),
            "Execution result",
            "missing",
            "not_submitted"
          )
    };
  }

  private async buildRunControlReadModel(
    runtime: TradingRunRecord
  ): Promise<RunControlReadModel> {
    const runtimeId = runtime.trading_run_id;
    const commands = (await this.readCollection<RunControlCommandRecord>("run-control-commands"))
      .filter((command) => command.runtime_ref.id === runtimeId)
      .sort(compareRunControlCommands);
    const latestCommand = commands.at(-1);
    if (!latestCommand) {
      return emptyRunControlReadModel();
    }

    const decisions = (await this.readCollection<RunControlDecisionRecord>("run-control-decisions"))
      .filter((decision) => decision.command_ref.id === latestCommand.run_control_command_id)
      .sort(compareRunControlDecisions);
    const latestDecision = decisions.at(-1);
    const auditEvents = (await this.readCollection<RuntimeAuditEventRecord>("runtime-audit-events"))
      .filter((event) => (
        event.command_ref?.id === latestCommand.run_control_command_id ||
        (
          latestDecision !== undefined &&
          event.decision_ref?.id === latestDecision.run_control_decision_id
        )
      ))
      .sort(compareRuntimeAuditEvents);
    const latestAuditEvent = auditEvents.at(-1);

    return {
      has_activity: true,
      chain_complete: Boolean(latestDecision && latestAuditEvent),
      latest_command: toRunControlCommandReadModel(latestCommand),
      latest_decision: latestDecision
        ? toRunControlDecisionReadModel(latestDecision)
        : null,
      latest_audit_event: latestAuditEvent
        ? toRunControlAuditEventReadModel(latestAuditEvent)
        : null,
      command: statusPlaceholder(
        ref(latestCommand.record_kind, latestCommand.run_control_command_id),
        "Runtime control command",
        latestCommand.status,
        latestCommand.authority_status
      ),
      decision: latestDecision
        ? statusPlaceholder(
            ref(latestDecision.record_kind, latestDecision.run_control_decision_id),
            "Runtime control decision",
            latestDecision.decision_outcome,
            latestDecision.authority_status
          )
        : statusPlaceholder(
            ref("run_control_decision", "missing"),
            "Runtime control decision",
            "missing",
            "not_live"
          ),
      audit_event: latestAuditEvent
        ? statusPlaceholder(
            ref(latestAuditEvent.record_kind, latestAuditEvent.runtime_audit_event_id),
            "Runtime audit event",
            latestAuditEvent.event_kind,
            latestAuditEvent.authority_status
          )
        : statusPlaceholder(
            ref("runtime_audit_event", "missing"),
            "Runtime audit event",
            "missing",
            "not_live"
          )
    };
  }

  private async buildTradingRunTranscriptReadModel(
    runtime: TradingRunRecord,
    ledger: LedgerReadModel,
    sandbox?: SandboxDetailReadModel
  ): Promise<TradingRunTranscriptReadModel> {
    const runtimeId = runtime.trading_run_id;
    const commands = (await this.readCollection<RunControlCommandRecord>("run-control-commands"))
      .filter((command) => command.runtime_ref.id === runtimeId)
      .sort(compareRunControlCommands);
    const commandIds = new Set(commands.map((command) => command.run_control_command_id));
    const decisions = (await this.readCollection<RunControlDecisionRecord>("run-control-decisions"))
      .filter((decision) => commandIds.has(decision.command_ref.id))
      .sort(compareRunControlDecisions);
    const decisionIds = new Set(decisions.map((decision) => decision.run_control_decision_id));
    const auditEvents = (await this.readCollection<RuntimeAuditEventRecord>("runtime-audit-events"))
      .filter((event) => (
        (event.command_ref ? commandIds.has(event.command_ref.id) : false) ||
        (event.decision_ref ? decisionIds.has(event.decision_ref.id) : false)
      ))
      .sort(compareRuntimeAuditEvents);

    const items: TradingRunTranscriptItemReadModel[] = [];
    for (const command of commands) {
      items.push({
        item_id: `run-control-command:${command.run_control_command_id}`,
        item_kind: "run_control_command",
        occurred_at: command.requested_at,
        label: "Run Control command",
        summary: `${command.action} / ${command.requested_lifecycle_status ?? "unchanged"}`,
        ref: ref(command.record_kind, command.run_control_command_id),
        authority_status: command.authority_status,
        lifecycle_status: command.requested_lifecycle_status
      });
    }
    for (const decision of decisions) {
      items.push({
        item_id: `run-control-decision:${decision.run_control_decision_id}`,
        item_kind: "run_control_decision",
        occurred_at: decision.decided_at,
        label: "Run Control decision",
        summary: `${decision.decision_outcome} / ${decision.resulting_lifecycle_status ?? "unchanged"}`,
        ref: ref(decision.record_kind, decision.run_control_decision_id),
        authority_status: decision.authority_status,
        lifecycle_status: decision.resulting_lifecycle_status
      });
    }
    for (const auditEvent of auditEvents) {
      items.push({
        item_id: `run-control-audit:${auditEvent.runtime_audit_event_id}`,
        item_kind: "run_control_audit",
        occurred_at: auditEvent.created_at,
        label: "Run Control audit",
        summary: auditEvent.message ?? auditEvent.event_kind,
        ref: ref(auditEvent.record_kind, auditEvent.runtime_audit_event_id),
        authority_status: auditEvent.authority_status,
        lifecycle_status: auditEvent.runtime_lifecycle_status
      });
    }

    if (sandbox) {
      items.push({
        item_id: `sandbox-lifecycle:${sandbox.sandbox_id}`,
        item_kind: "sandbox_lifecycle",
        occurred_at: sandbox.stopped_at ?? sandbox.last_heartbeat_at ?? sandbox.started_at ?? sandbox.created_at,
        label: "Sandbox lifecycle",
        summary: `${sandbox.lifecycle_status} / ${sandbox.adapter_kind}`,
        ref: ref("sandbox", sandbox.sandbox_id),
        authority_status: sandbox.authority_status
      });
      for (const heartbeat of sandbox.heartbeats) {
        items.push({
          item_id: `sandbox-heartbeat:${heartbeat.heartbeat_ref.id}`,
          item_kind: "sandbox_heartbeat",
          occurred_at: heartbeat.observed_at,
          label: "Sandbox heartbeat",
          summary: heartbeat.heartbeat_line,
          ref: heartbeat.heartbeat_ref,
          authority_status: heartbeat.authority_status
        });
      }
      for (const log of sandbox.logs) {
        for (const orderRequestEvent of sandboxOrderRequestEvents(log)) {
          items.push({
            item_id: `sandbox-order-request:${log.log_ref.id}:${orderRequestEvent.index}`,
            item_kind: "sandbox_order_request",
            occurred_at: orderRequestEvent.at ?? log.captured_at,
            label: "Sandbox order request",
            summary: `${orderRequestEvent.symbol ?? "BTCUSDT"} ${orderRequestEvent.side ?? "none"} / ${orderRequestEvent.order_type ?? "none"} / ${orderRequestEvent.quantity ?? "none"} @ ${orderRequestEvent.limit_price ?? "none"}`,
            ref: log.log_ref,
            authority_status: log.authority_status
          });
        }
        items.push({
          item_id: `sandbox-log:${log.log_ref.id}`,
          item_kind: "sandbox_log",
          occurred_at: log.captured_at,
          label: "Sandbox log",
          summary: log.lines.join(" / ") || "log captured",
          ref: log.log_ref,
          authority_status: log.authority_status
        });
      }
    }

    if (ledger.latest_order_request) {
      const orderRequest = ledger.latest_order_request;
      items.push({
        item_id: `order-request:${orderRequest.order_request_id}`,
        item_kind: "order_request",
        occurred_at: orderRequest.created_at,
        label: "Order request",
        summary: `${orderRequest.side ?? "none"} / ${orderRequest.order_type ?? "none"} / ${orderRequest.quantity ?? "none"} @ ${orderRequest.limit_price ?? "none"}`,
        ref: ref("order_request", orderRequest.order_request_id),
        authority_status: orderRequest.authority_status
      });
    }
    if (ledger.latest_gateway_result) {
      const gatewayResult = ledger.latest_gateway_result;
      items.push({
        item_id: `gateway-result:${gatewayResult.gateway_result_id}`,
        item_kind: "gateway_result",
        occurred_at: gatewayResult.decided_at,
        label: "Gateway result",
        summary: `${gatewayResult.decision_outcome} / ${gatewayResult.decision_reason}`,
        ref: ref("gateway_result", gatewayResult.gateway_result_id),
        authority_status: gatewayResult.authority_status
      });
    }
    if (ledger.latest_execution_result) {
      const executionResult = ledger.latest_execution_result;
      items.push({
        item_id: `execution-result:${executionResult.execution_result_id}`,
        item_kind: "execution_result",
        occurred_at: executionResult.completed_at ?? executionResult.created_at,
        label: "Execution result",
        summary: `${executionResult.status} / ${executionResult.result_reason}`,
        ref: ref("execution_result", executionResult.execution_result_id),
        authority_status: executionResult.authority_status
      });
    }

    const sortedItems = items.sort(compareTradingRunTranscriptItems);
    return {
      transcript_kind: "trading_run_transcript",
      has_activity: sortedItems.length > 0,
      item_count: sortedItems.length,
      latest_item: sortedItems.at(-1) ?? null,
      items: sortedItems,
      authority_status: "not_live",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      }
    };
  }

  private async readLedgerWriteOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: LedgerRecordIds
  ): Promise<LedgerWriteOutcome | undefined> {
    const orderIntent = await this.readOptionalRecord<OrderRequestRecord>(
      "order-requests",
      recordIds.orderIntent
    );
    const gatewayDecision = await this.readOptionalRecord<GatewayResultRecord>(
      "gateway-results",
      recordIds.gatewayDecision
    );
    const executionAttempt = await this.readOptionalRecord<ExecutionResultRecord>(
      "execution-results",
      recordIds.executionAttempt
    );
    if (!orderIntent || !gatewayDecision || !executionAttempt) {
      return undefined;
    }
    return {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      runtime_id: runtimeId,
      order_request: orderIntent,
      gateway_result: gatewayDecision,
      execution_result: executionAttempt
    };
  }

  private async readRunControlAuditOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: RunControlAuditRecordIds
  ): Promise<RunControlAuditOutcome | undefined> {
    const command = await this.readOptionalRecord<RunControlCommandRecord>(
      "run-control-commands",
      recordIds.command
    );
    const decision = await this.readOptionalRecord<RunControlDecisionRecord>(
      "run-control-decisions",
      recordIds.decision
    );
    const auditEvent = await this.readOptionalRecord<RuntimeAuditEventRecord>(
      "runtime-audit-events",
      recordIds.auditEvent
    );
    if (!command || !decision || !auditEvent) {
      return undefined;
    }
    return {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      runtime_id: runtimeId,
      command,
      decision,
      audit_event: auditEvent
    };
  }

  private async buildCandidateEvaluationReadModel(
    candidate: TradingSystemCandidateRecord,
    version: CandidateVersionRecord
  ): Promise<CandidateEvaluationReadModel> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const replayRuns = evaluationRuns
      .filter((run) => (
        run.candidate_ref.id === candidate.candidate_id &&
        run.candidate_version_ref.id === version.candidate_version_id
      ))
      .sort(compareEvaluationRuns);

    const latestRun = replayRuns.at(-1);
    if (!latestRun) {
      return emptyCandidateEvaluationReadModel(version.evaluation_run_ref);
    }

    const stageBinding = await this.readOptionalRecord<StageBindingRecord>(
      "stage-bindings",
      latestRun.stage_binding_ref.id
    );
    const trace = await this.readOptionalRecord<TracePlaceholderRecord>(
      "traces",
      latestRun.trace_ref.id,
      "placeholders"
    );
    const comparisonSet = await this.findEvaluationComparisonSetForRun(
      latestRun.evaluation_run_record_id
    );
    const sealingDecision = comparisonSet
      ? await this.findEvidenceSealingDecisionForComparisonSet(
          comparisonSet.evaluation_comparison_set_id
        )
      : undefined;
    const evidenceClassifications = await this.listEvidenceClassificationsForEvaluationRun(
      latestRun.evaluation_run_record_id
    );
    const errorState = candidateEvaluationErrorState(
      latestRun,
      Boolean(stageBinding && trace && comparisonSet && sealingDecision)
    );

    return {
      has_runs: true,
      latest_run: {
        run_id: latestRun.evaluation_run_record_id,
        status: latestRun.status,
        stage: stageBinding?.stage ?? null,
        profile: stageBinding?.profile ?? null,
        execution_mode: stageBinding?.execution_mode ?? null,
        trace_ref: latestRun.trace_ref,
        authority_status: latestRun.authority_status,
        created_at: latestRun.created_at,
        started_at: latestRun.started_at,
        completed_at: latestRun.completed_at,
        error_state: errorState
      },
      latest_comparison_set: comparisonSet
        ? {
            comparison_set_id: comparisonSet.evaluation_comparison_set_id,
            stage_binding_ref: comparisonSet.stage_binding_ref,
            evaluation_run_refs: evaluationRunRefsForComparisonSet(comparisonSet),
            comparability_status: comparisonSet.comparability_status,
            comparability_reason: comparisonSet.comparability_reason,
            authority_status: comparisonSet.authority_status,
            created_at: comparisonSet.created_at
          }
        : null,
      latest_sealing_decision: sealingDecision
        ? {
            sealing_decision_id: sealingDecision.evidence_sealing_decision_id,
            evaluation_comparison_set_ref: sealingDecision.evaluation_comparison_set_ref,
            evaluation_run_refs: sealingDecision.evaluation_run_refs,
            evidence_disposition: sealingDecision.evidence_disposition,
            disposition_reason: sealingDecision.disposition_reason,
            authority_status: sealingDecision.authority_status,
            created_at: sealingDecision.created_at,
            sealed_at: sealingDecision.sealed_at
          }
        : null,
      trace: trace
        ? {
            state: "linked",
            trace_ref: latestRun.trace_ref,
            authority_label: trace.authority_label,
            authority_status: trace.authority_status,
            provider_output_artifact_refs: trace.provider_output_artifact_refs ?? [],
            debug_artifact_refs: trace.debug_artifact_refs ?? []
          }
        : {
            state: "missing",
            trace_ref: latestRun.trace_ref,
            authority_status: "not_counted",
            provider_output_artifact_refs: [],
            debug_artifact_refs: []
          },
      evidence_classifications: evidenceClassifications.map(toEvidenceClassificationReadModel),
      counted_evidence: sealingDecision
        ? {
            counted: (
              sealingDecision.evidence_disposition === "counted" &&
              sealingDecision.authority_status === "counted"
            ),
            evidence_disposition: sealingDecision.evidence_disposition,
            disposition_reason: sealingDecision.disposition_reason,
            authority_status: sealingDecision.authority_status,
            sealed_at: sealingDecision.sealed_at
          }
        : {
            counted: false,
            evidence_disposition: "not_counted",
            disposition_reason: "evaluation_links_incomplete",
            authority_status: "not_counted"
          },
      error_state: errorState,
      run: statusPlaceholder(
        ref(latestRun.record_kind, latestRun.evaluation_run_record_id),
        "Evaluation run",
        latestRun.status,
        latestRun.authority_status
      ),
      comparison_set: comparisonSet
        ? statusPlaceholder(
            ref(comparisonSet.record_kind, comparisonSet.evaluation_comparison_set_id),
            "Evaluation comparison set",
            comparisonSet.comparability_status,
            comparisonSet.authority_status
          )
        : statusPlaceholder(
            ref("evaluation_comparison_set", "missing"),
            "Evaluation comparison set",
            "missing",
            "not_counted"
          ),
      sealing_decision: sealingDecision
        ? statusPlaceholder(
            ref(sealingDecision.record_kind, sealingDecision.evidence_sealing_decision_id),
            "Evidence sealing decision",
            sealingDecision.evidence_disposition,
            sealingDecision.authority_status
          )
        : statusPlaceholder(
            ref("evidence_sealing_decision", "missing"),
            "Evidence sealing decision",
            "missing",
            "not_counted"
          )
    };
  }

  private async evaluationComparisonSetForRun(
    evaluationRunRecordId: string
  ): Promise<EvaluationComparisonSetRecord> {
    const comparisonSet = await this.findEvaluationComparisonSetForRun(evaluationRunRecordId);
    if (!comparisonSet) {
      throw new Error(`evaluation comparison set missing for evaluation run ${evaluationRunRecordId}`);
    }
    return comparisonSet;
  }

  private async findEvaluationComparisonSetForRun(
    evaluationRunRecordId: string
  ): Promise<EvaluationComparisonSetRecord | undefined> {
    const comparisonSets = await this.readCollection<EvaluationComparisonSetRecord>("evaluation-comparison-sets");
    return comparisonSets.find(
      (set) => comparisonSetIncludesRun(set, evaluationRunRecordId)
    );
  }

  private async evidenceSealingDecisionForComparisonSet(
    comparisonSetId: string
  ): Promise<EvidenceSealingDecisionRecord> {
    const sealingDecision = await this.findEvidenceSealingDecisionForComparisonSet(comparisonSetId);
    if (!sealingDecision) {
      throw new Error(`evidence sealing decision missing for evaluation comparison set ${comparisonSetId}`);
    }
    return sealingDecision;
  }

  private async findEvidenceSealingDecisionForComparisonSet(
    comparisonSetId: string
  ): Promise<EvidenceSealingDecisionRecord | undefined> {
    const sealingDecisions = await this.readCollection<EvidenceSealingDecisionRecord>("evidence-sealing-decisions");
    return sealingDecisions
      .filter((decision) => decision.evaluation_comparison_set_ref.id === comparisonSetId)
      .sort(compareEvidenceSealingDecisions)
      .at(-1);
  }

  private async listEvidenceClassificationsForEvaluationRun(
    evaluationRunRecordId: string
  ): Promise<EvidenceClassificationRecord[]> {
    const classifications = await this.readCollection<EvidenceClassificationRecord>("evidence-classifications");
    return classifications
      .filter((classification) => classification.evaluation_run_ref.id === evaluationRunRecordId)
      .sort(compareEvidenceClassifications);
  }

  private async assertSandboxLinks(instance: SandboxRecord): Promise<void> {
    const artifact = await this.readOptionalRecord<SystemCodeRecord>(
      "system-codes",
      instance.system_code_ref.id
    );
    if (!artifact) {
      throw new LocalStoreError(
        "system_code_not_found",
        `system code ${instance.system_code_ref.id} not found`,
        { system_code_id: instance.system_code_ref.id }
      );
    }

    if (instance.runtime_ref) {
      const runtime = await this.readOptionalRecord<TradingRunRecord>(
        "trading-runs",
        instance.runtime_ref.id
      );
      if (!runtime) {
        throw new LocalStoreError(
          "runtime_not_found",
          `runtime ${instance.runtime_ref.id} not found`,
          { runtime_id: instance.runtime_ref.id }
        );
      }
    }
  }

  private async assertArtifactLineageLinks(lineage: ArtifactLineageRecord): Promise<void> {
    await this.assertResearchFindingRefsExist(lineage.source_finding_refs, lineage.artifact_lineage_id);
  }

  private async assertResearchFindingRefsExist(findingRefs: Ref[], ownerId: string): Promise<void> {
    for (const findingRef of findingRefs) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        throw new LocalStoreError(
          "research_finding_not_found",
          `automated research finding ${findingRef.id} not found`,
          { research_finding_id: findingRef.id, owner_id: ownerId }
        );
      }
    }
  }

  private async writeSandboxObservations(
    input: SandboxObservationInput
  ): Promise<void> {
    const records: FixtureItem[] = [
      ...(input.placement
        ? [{
            collection: "sandbox-placements" as const,
            id: input.placement.sandbox_placement_id,
            record: input.placement
          }]
        : []),
      { collection: "sandboxes", id: input.instance.sandbox_id, record: input.instance },
      ...(input.logs ?? []).map((log) => ({
        collection: "sandbox-logs" as const,
        id: log.sandbox_log_id,
        record: log
      })),
      ...(input.heartbeats ?? []).map((heartbeat) => ({
        collection: "runtime-heartbeats" as const,
        id: heartbeat.runtime_heartbeat_id,
        record: heartbeat
      })),
      ...(input.command_evidence ?? []).map((evidence) => ({
        collection: "sandbox-command-evidence" as const,
        id: evidence.sandbox_command_evidence_id,
        record: evidence
      }))
    ];

    if (input.instance.runtime_ref) {
      const runtime = await this.readOptionalRecord<TradingRunRecord>(
        "trading-runs",
        input.instance.runtime_ref.id
      );
      if (runtime) {
        records.push({
          collection: "trading-runs",
          id: runtime.trading_run_id,
          record: stripUndefined({
            ...runtime,
            runtime_lifecycle_status: runtimeLifecycleForSandboxInstance(input.instance.lifecycle_status),
            placement_ref: input.instance.sandbox_placement_ref,
            system_code_ref: input.instance.system_code_ref,
            sandbox_ref: ref(
              input.instance.record_kind,
              input.instance.sandbox_id
            ),
            created_at: runtime.created_at ?? input.instance.created_at
          } satisfies TradingRunRecord)
        });
      }
    }

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
  }

  private async buildSandboxDetailReadModel(
    sandboxId: string
  ): Promise<SandboxDetailReadModel> {
    const instance = await this.readRecord<SandboxRecord>(
      "sandboxes",
      sandboxId
    );
    const logs = (await this.readCollection<SandboxLogRecord>("sandbox-logs"))
      .filter((log) => log.sandbox_ref?.id === sandboxId)
      .sort(compareSandboxLogs)
      .map(toSandboxLogReadModel);
    const heartbeats = (await this.readCollection<RuntimeHeartbeatRecord>("runtime-heartbeats"))
      .filter((heartbeat) => heartbeat.sandbox_ref?.id === sandboxId)
      .sort(compareRuntimeHeartbeats)
      .map(toSandboxHeartbeatReadModel);
    const commandEvidence = (await this.readCollection<SandboxCommandEvidenceRecord>("sandbox-command-evidence"))
      .filter((evidence) => evidence.sandbox_ref?.id === sandboxId)
      .sort(compareSandboxCommandEvidence)
      .map(toSandboxCommandEvidenceReadModel);

    return {
      ...toSandboxReadModel(instance),
      logs,
      heartbeats,
      command_evidence: commandEvidence
    };
  }

  private toCandidateSummary(candidate: TradingSystemCandidateRecord): CandidateSummaryReadModel {
    return {
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      status: candidate.status,
      active_version_id: candidate.active_version_id,
      fixture_notice: fixtureNotice
    };
  }

  private itemPath(collection: Collection, id: string, itemDir: "items" | "placeholders" = "items"): string {
    return path.join(this.storeRoot, collection, itemDir, storeJsonFileName(id));
  }

  private collectionIndexPath(collection: Collection): string {
    return path.join(this.storeRoot, collection, "index.json");
  }

  private async readRecord<T>(collection: Collection, id: string, itemDir: "items" | "placeholders" = "items"): Promise<T> {
    return this.readJson<T>(this.itemPath(collection, id, itemDir));
  }

  private async readOptionalRecord<T>(
    collection: Collection,
    id: string,
    itemDir: "items" | "placeholders" = "items"
  ): Promise<T | undefined> {
    try {
      return await this.readRecord<T>(collection, id, itemDir);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async readCollection<T>(collection: Collection): Promise<T[]> {
    const dir = path.join(this.storeRoot, collection, "items");
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
    const jsonFiles = entries.filter((entry) => entry.endsWith(".json")).sort();
    return Promise.all(jsonFiles.map((entry) => this.readJson<T>(path.join(dir, entry))));
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  }

  private async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    // LocalStore writes validated records to encoded paths under storeRoot.
    // codeql[js/http-to-file-access]
    await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tmpPath, filePath);
  }
}

function placeholder(
  refValue: Ref,
  label: string,
  record: object
): PlaceholderSummary {
  const fields = record as { status?: unknown; authority_status?: unknown };
  return {
    ref: refValue,
    label,
    status: String(fields.status ?? "fixture_placeholder"),
    authority_status: String(fields.authority_status ?? "not_executed")
  };
}

function statusPlaceholder(
  refValue: Ref,
  label: string,
  status: string,
  authorityStatus: string
): PlaceholderSummary {
  return {
    ref: refValue,
    label,
    status,
    authority_status: authorityStatus
  };
}

function emptyCandidateEvaluationReadModel(
  evaluationRunRef?: Ref
): CandidateEvaluationReadModel {
  return {
    has_runs: false,
    latest_run: null,
    latest_comparison_set: null,
    latest_sealing_decision: null,
    trace: {
      state: "none",
      trace_ref: null,
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_evaluation_runs",
      authority_status: "not_counted"
    },
    error_state: null,
    run: statusPlaceholder(
      evaluationRunRef ?? ref("evaluation_run_record", "none"),
      "Evaluation run",
      "not_evaluated",
      "not_counted"
    ),
    comparison_set: statusPlaceholder(
      ref("evaluation_comparison_set", "none"),
      "Evaluation comparison set",
      "not_evaluated",
      "not_counted"
    ),
    sealing_decision: statusPlaceholder(
      ref("evidence_sealing_decision", "none"),
      "Evidence sealing decision",
      "not_counted",
      "not_counted"
    )
  };
}

function emptyLedgerSourceRecordsReadModel(): LedgerSourceRecordsReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: statusPlaceholder(
      ref("order_request", "none"),
      "Order request",
      "not_submitted",
      "not_submitted"
    ),
    gateway_result: statusPlaceholder(
      ref("gateway_result", "none"),
      "Gateway result",
      "not_evaluated",
      "not_live"
    ),
    execution_result: statusPlaceholder(
      ref("execution_result", "none"),
      "Execution result",
      "not_submitted",
      "not_submitted"
    )
  };
}

function ledgerSourceChainForOrderRequest(input: {
  orderRequest: OrderRequestRecord;
  gatewayResults: GatewayResultRecord[];
  executionResults: ExecutionResultRecord[];
}): LedgerSourceChainReadModel {
  const gatewayResult = input.gatewayResults
    .filter((candidate) => candidate.order_request_ref.id === input.orderRequest.order_request_id)
    .sort(compareGatewayResults)
    .at(-1);
  const executionResult = gatewayResult
    ? input.executionResults
        .filter((candidate) => candidate.gateway_result_ref.id === gatewayResult.gateway_result_id)
        .sort(compareExecutionResults)
        .at(-1)
    : undefined;
  return {
    chain_id: input.orderRequest.order_request_id,
    chain_complete: Boolean(gatewayResult && executionResult),
    occurred_at: executionResult?.completed_at
      ?? executionResult?.created_at
      ?? gatewayResult?.decided_at
      ?? input.orderRequest.created_at,
    order_request: toLedgerSourceOrderRequestReadModel(input.orderRequest),
    gateway_result: gatewayResult
      ? toLedgerSourceGatewayResultReadModel(gatewayResult)
      : null,
    execution_result: executionResult
      ? toLedgerSourceExecutionResultReadModel(executionResult)
      : null,
    authority_status: "not_live"
  };
}

function compareLedgerSourceChains(
  a: LedgerSourceChainReadModel,
  b: LedgerSourceChainReadModel
): number {
  const timeCompare = a.order_request.created_at.localeCompare(b.order_request.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.chain_id.localeCompare(b.chain_id);
}

function emptyRunControlReadModel(): RunControlReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    latest_command: null,
    latest_decision: null,
    latest_audit_event: null,
    command: statusPlaceholder(
      ref("run_control_command", "none"),
      "Runtime control command",
      "pending_decision",
      "not_live"
    ),
    decision: statusPlaceholder(
      ref("run_control_decision", "none"),
      "Runtime control decision",
      "not_evaluated",
      "not_live"
    ),
    audit_event: statusPlaceholder(
      ref("runtime_audit_event", "none"),
      "Runtime audit event",
      "not_recorded",
      "not_live"
    )
  };
}

function toLedgerSourceOrderRequestReadModel(orderIntent: OrderRequestRecord) {
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

function toLedgerSourceGatewayResultReadModel(gatewayDecision: GatewayResultRecord) {
  return {
    gateway_result_id: gatewayDecision.gateway_result_id,
    order_request_ref: gatewayDecision.order_request_ref,
    decision_outcome: gatewayDecision.decision_outcome,
    decision_reason: gatewayDecision.decision_reason,
    decided_at: gatewayDecision.decided_at,
    authority_status: gatewayDecision.authority_status
  };
}

function toLedgerSourceExecutionResultReadModel(executionAttempt: ExecutionResultRecord) {
  return {
    execution_result_id: executionAttempt.execution_result_id,
    order_request_ref: executionAttempt.order_request_ref,
    gateway_result_ref: executionAttempt.gateway_result_ref,
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

function toRunControlCommandReadModel(command: RunControlCommandRecord) {
  return {
    command_id: command.run_control_command_id,
    action: command.action,
    requested_lifecycle_status: command.requested_lifecycle_status,
    actor_kind: command.actor_kind,
    actor_ref: command.actor_ref,
    reason: command.reason,
    requested_at: command.requested_at,
    status: command.status,
    authority_status: command.authority_status
  };
}

function toRunControlDecisionReadModel(decision: RunControlDecisionRecord) {
  return {
    decision_id: decision.run_control_decision_id,
    command_ref: decision.command_ref,
    decision_outcome: decision.decision_outcome,
    decision_reason: decision.decision_reason,
    decided_by_actor_kind: decision.decided_by_actor_kind,
    decided_by_actor_ref: decision.decided_by_actor_ref,
    resulting_lifecycle_status: decision.resulting_lifecycle_status,
    decided_at: decision.decided_at,
    authority_status: decision.authority_status
  };
}

function toRunControlAuditEventReadModel(auditEvent: RuntimeAuditEventRecord) {
  return {
    audit_event_id: auditEvent.runtime_audit_event_id,
    event_kind: auditEvent.event_kind,
    command_ref: auditEvent.command_ref,
    decision_ref: auditEvent.decision_ref,
    actor_kind: auditEvent.actor_kind,
    actor_ref: auditEvent.actor_ref,
    runtime_lifecycle_status: auditEvent.runtime_lifecycle_status,
    message: auditEvent.message,
    created_at: auditEvent.created_at,
    authority_status: auditEvent.authority_status
  };
}

function candidateEvaluationErrorState(
  evaluationRun: EvaluationRunRecord,
  linkedRecordsComplete: boolean
): CandidateEvaluationErrorState | null {
  if (evaluationRun.status === "failed") {
    return {
      code: "evaluation_failed",
      message: "evaluation run failed"
    };
  }
  if (!linkedRecordsComplete) {
    return {
      code: "evaluation_links_incomplete",
      message: "evaluation run has incomplete linked records"
    };
  }
  return null;
}

function toSandboxReadModel(
  instance: SandboxRecord
): SandboxReadModel {
  return {
    sandbox_id: instance.sandbox_id,
    adapter_kind: instance.adapter_kind,
    system_code_ref: instance.system_code_ref,
    runtime_ref: instance.runtime_ref,
    sandbox_placement_ref: instance.sandbox_placement_ref,
    lifecycle_status: instance.lifecycle_status,
    sandbox_name: instance.sandbox_name,
    sandbox_ref: instance.sandbox_ref,
    created_at: instance.created_at,
    started_at: instance.started_at,
    last_heartbeat_at: instance.last_heartbeat_at,
    stopped_at: instance.stopped_at,
    removed_at: instance.removed_at,
    log_refs: instance.log_refs,
    heartbeat_refs: instance.heartbeat_refs,
    command_evidence_refs: instance.command_evidence_refs ?? [],
    trace_ref: instance.trace_ref,
    authority_status: instance.authority_status
  };
}

function toSandboxLogReadModel(log: SandboxLogRecord): SandboxLogReadModel {
  return {
    log_ref: ref(log.record_kind, log.sandbox_log_id),
    lines: log.lines,
    captured_at: log.captured_at,
    authority_status: log.authority_status
  };
}

function toSandboxHeartbeatReadModel(
  heartbeat: RuntimeHeartbeatRecord
): SandboxHeartbeatReadModel {
  return {
    heartbeat_ref: ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id),
    heartbeat_line: heartbeat.heartbeat_line,
    observed_at: heartbeat.observed_at,
    authority_status: heartbeat.authority_status
  };
}

function toSandboxCommandEvidenceReadModel(
  evidence: SandboxCommandEvidenceRecord
): SandboxCommandEvidenceReadModel {
  return {
    command_evidence_ref: ref(evidence.record_kind, evidence.sandbox_command_evidence_id),
    command: evidence.command,
    exit_code: evidence.exit_code,
    stdout: evidence.stdout,
    stderr: evidence.stderr,
    started_at: evidence.started_at,
    completed_at: evidence.completed_at,
    authority_status: evidence.authority_status
  };
}

function refsForLogs(logs: SandboxLogRecord[] | undefined): Ref[] {
  return (logs ?? []).map((log) => ref(log.record_kind, log.sandbox_log_id));
}

function refsForHeartbeats(heartbeats: RuntimeHeartbeatRecord[] | undefined): Ref[] {
  return (heartbeats ?? []).map((heartbeat) => ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id));
}

function refsForCommandEvidence(evidence: SandboxCommandEvidenceRecord[] | undefined): Ref[] {
  return (evidence ?? []).map((item) => ref(item.record_kind, item.sandbox_command_evidence_id));
}

function latestObservedAt(heartbeats: RuntimeHeartbeatRecord[] | undefined): string | undefined {
  return (heartbeats ?? [])
    .map((heartbeat) => heartbeat.observed_at)
    .sort()
    .at(-1);
}

function runtimeLifecycleForSandboxInstance(
  lifecycleStatus: SandboxRecord["lifecycle_status"]
): TradingRunLifecycleStatus {
  switch (lifecycleStatus) {
    case "starting":
      return "starting";
    case "running":
      return "running";
    case "stopping":
      return "stopping";
    case "stopped":
    case "removed":
      return "stopped";
    case "failed":
      return "failed";
    case "requested":
    case "created":
      return "registered";
  }
}

function compareSandboxReadModels(
  a: SandboxReadModel,
  b: SandboxReadModel
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  return timeCompare === 0 ? a.sandbox_id.localeCompare(b.sandbox_id) : timeCompare;
}

function compareSandboxLogs(a: SandboxLogRecord, b: SandboxLogRecord): number {
  const timeCompare = a.captured_at.localeCompare(b.captured_at);
  return timeCompare === 0
    ? a.sandbox_log_id.localeCompare(b.sandbox_log_id)
    : timeCompare;
}

function compareRuntimeHeartbeats(a: RuntimeHeartbeatRecord, b: RuntimeHeartbeatRecord): number {
  const timeCompare = a.observed_at.localeCompare(b.observed_at);
  return timeCompare === 0
    ? a.runtime_heartbeat_id.localeCompare(b.runtime_heartbeat_id)
    : timeCompare;
}

function compareSandboxCommandEvidence(
  a: SandboxCommandEvidenceRecord,
  b: SandboxCommandEvidenceRecord
): number {
  const timeCompare = a.started_at.localeCompare(b.started_at);
  return timeCompare === 0
    ? a.sandbox_command_evidence_id.localeCompare(b.sandbox_command_evidence_id)
    : timeCompare;
}

function compareEvaluationRuns(a: EvaluationRunRecord, b: EvaluationRunRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evaluation_run_record_id.localeCompare(b.evaluation_run_record_id);
}

function compareEvidenceSealingDecisions(
  a: EvidenceSealingDecisionRecord,
  b: EvidenceSealingDecisionRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evidence_sealing_decision_id.localeCompare(b.evidence_sealing_decision_id);
}

function compareEvidenceClassifications(
  a: EvidenceClassificationRecord,
  b: EvidenceClassificationRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.evidence_classification_id.localeCompare(b.evidence_classification_id);
}

function compareOrderRequests(a: OrderRequestRecord, b: OrderRequestRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.order_request_id.localeCompare(b.order_request_id);
}

function compareGatewayResults(a: GatewayResultRecord, b: GatewayResultRecord): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.gateway_result_id.localeCompare(b.gateway_result_id);
}

function compareExecutionResults(a: ExecutionResultRecord, b: ExecutionResultRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.execution_result_id.localeCompare(b.execution_result_id);
}

function compareRunControlCommands(
  a: RunControlCommandRecord,
  b: RunControlCommandRecord
): number {
  const timeCompare = a.requested_at.localeCompare(b.requested_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.run_control_command_id.localeCompare(b.run_control_command_id);
}

function compareRunControlDecisions(
  a: RunControlDecisionRecord,
  b: RunControlDecisionRecord
): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.run_control_decision_id.localeCompare(b.run_control_decision_id);
}

function compareRuntimeAuditEvents(
  a: RuntimeAuditEventRecord,
  b: RuntimeAuditEventRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.runtime_audit_event_id.localeCompare(b.runtime_audit_event_id);
}

function compareTradingRunTranscriptItems(
  a: TradingRunTranscriptItemReadModel,
  b: TradingRunTranscriptItemReadModel
): number {
  const timeCompare = a.occurred_at.localeCompare(b.occurred_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  const kindCompare = transcriptItemKindOrder(a) - transcriptItemKindOrder(b);
  if (kindCompare !== 0) {
    return kindCompare;
  }
  return a.item_id.localeCompare(b.item_id);
}

function transcriptItemKindOrder(item: TradingRunTranscriptItemReadModel): number {
  const order: Record<TradingRunTranscriptItemReadModel["item_kind"], number> = {
    run_control_command: 10,
    run_control_decision: 20,
    run_control_audit: 30,
    sandbox_lifecycle: 40,
    sandbox_heartbeat: 50,
    sandbox_log: 60,
    sandbox_order_request: 70,
    order_request: 80,
    gateway_result: 90,
    execution_result: 100
  };
  return order[item.item_kind];
}

interface SandboxOrderRequestEvent {
  index: number;
  symbol?: string;
  side?: string;
  order_type?: string;
  quantity?: string;
  limit_price?: string;
  at?: string;
}

function sandboxOrderRequestEvents(
  log: SandboxDetailReadModel["logs"][number]
): SandboxOrderRequestEvent[] {
  return log.lines.flatMap((line, index) => {
    const event = parseSandboxOrderRequestEvent(line);
    if (!event) {
      return [];
    }
    return [{ ...event, index: index + 1 }];
  });
}

function parseSandboxOrderRequestEvent(line: string): Omit<SandboxOrderRequestEvent, "index"> | undefined {
  try {
    const value = JSON.parse(line) as Record<string, unknown>;
    if (value.event !== "order_request") {
      return undefined;
    }
    return {
      symbol: typeof value.symbol === "string" ? value.symbol : undefined,
      side: typeof value.side === "string" ? value.side : undefined,
      order_type: typeof value.order_type === "string" ? value.order_type : undefined,
      quantity: typeof value.quantity === "string" ? value.quantity : undefined,
      limit_price: typeof value.limit_price === "string" ? value.limit_price : undefined,
      at: typeof value.at === "string" ? value.at : undefined
    };
  } catch {
    return undefined;
  }
}

function compareResearchFindings(a: ResearchFindingRecord, b: ResearchFindingRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_finding_id.localeCompare(b.research_finding_id);
}

function compareCandidateArenaTicks(a: CandidateArenaTickRecord, b: CandidateArenaTickRecord): number {
  const timeCompare = b.completed_at.localeCompare(a.completed_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return b.candidate_arena_tick_id.localeCompare(a.candidate_arena_tick_id);
}

function compareArtifactLineages(
  a: ArtifactLineageRecord,
  b: ArtifactLineageRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.artifact_lineage_id.localeCompare(b.artifact_lineage_id);
}

function compareImprovementProposals(
  a: ImprovementProposalRecord,
  b: ImprovementProposalRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.improvement_proposal_id.localeCompare(b.improvement_proposal_id);
}

function compareResearchOrchestrationRuns(
  a: ResearchOrchestrationRunRecord,
  b: ResearchOrchestrationRunRecord
): number {
  const timeCompare = a.started_at.localeCompare(b.started_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_orchestration_run_id.localeCompare(b.research_orchestration_run_id);
}

function compareExperimentRuns(a: ExperimentRunRecord, b: ExperimentRunRecord): number {
  const timeCompare = a.submitted_at.localeCompare(b.submitted_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.experiment_run_id.localeCompare(b.experiment_run_id);
}

function compareTradingEvaluationResults(
  a: TradingEvaluationResultRecord,
  b: TradingEvaluationResultRecord
): number {
  const timeCompare = a.completed_at.localeCompare(b.completed_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.trading_evaluation_result_id.localeCompare(b.trading_evaluation_result_id);
}

function compareImprovementProposalMaterializationAttempts(
  a: ImprovementProposalMaterializationAttemptRecord,
  b: ImprovementProposalMaterializationAttemptRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.improvement_proposal_materialization_attempt_id.localeCompare(
    b.improvement_proposal_materialization_attempt_id
  );
}

function comparisonSetIncludesRun(
  comparisonSet: EvaluationComparisonSetRecord,
  evaluationRunRecordId: string
): boolean {
  return evaluationRunRefsForComparisonSet(comparisonSet).some(
    (runRef) => runRef.id === evaluationRunRecordId
  );
}

function evaluationRunRefsForComparisonSet(
  comparisonSet: EvaluationComparisonSetRecord
): Ref[] {
  return comparisonSet.evaluation_run_refs ?? [];
}

function defaultEvidenceClassificationRecords(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  traceRef: Ref;
  sealingDecisionRef: Ref;
  reason: EvidenceDispositionReason;
  createdAt: string;
}): EvidenceClassificationRecord[] {
  return [
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.traceRef,
      classificationKind: "trace_debug_material",
      classificationStatus: "trace_only",
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.evaluationRunRef,
      classificationKind: "candidate_evidence",
      classificationStatus: "candidate",
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.evaluationRunRef,
      classificationKind: "non_counted_evidence",
      classificationStatus: "not_counted",
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus: "not_counted"
    }),
    evidenceClassificationRecord({
      ...input,
      classifiedRef: input.sealingDecisionRef,
      classificationKind: "sealed_decision",
      classificationStatus: "sealed",
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus: "not_counted"
    })
  ];
}

function sealedEvidenceClassificationRecords(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  sealingDecisionRef: Ref;
  evidenceDisposition: EvidenceDisposition;
  reason: EvidenceDispositionReason;
  classifiedRefs: Ref[];
  createdAt: string;
}): EvidenceClassificationRecord[] {
  const classificationKind = evidenceClassificationKindForDisposition(input.evidenceDisposition);
  const classificationStatus = evidenceClassificationStatusForDisposition(input.evidenceDisposition);
  const authorityStatus = input.evidenceDisposition === "counted" ? "counted" : "not_counted";
  const evidenceClassifications = input.classifiedRefs.map((classifiedRef) => (
    evidenceClassificationRecord({
      candidateRef: input.candidateRef,
      candidateVersionRef: input.candidateVersionRef,
      evaluationRunRef: input.evaluationRunRef,
      sealingDecisionRef: input.sealingDecisionRef,
      classifiedRef,
      classificationKind,
      classificationStatus,
      reason: input.reason,
      createdAt: input.createdAt,
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus
    })
  ));

  return [
    ...evidenceClassifications,
    evidenceClassificationRecord({
      candidateRef: input.candidateRef,
      candidateVersionRef: input.candidateVersionRef,
      evaluationRunRef: input.evaluationRunRef,
      sealingDecisionRef: input.sealingDecisionRef,
      classifiedRef: input.sealingDecisionRef,
      classificationKind: "sealed_decision",
      classificationStatus: "sealed",
      reason: input.reason,
      createdAt: input.createdAt,
      sealedByDecisionRef: input.sealingDecisionRef,
      authorityStatus
    })
  ];
}

function evidenceClassificationRecord(input: {
  candidateRef: Ref;
  candidateVersionRef: Ref;
  evaluationRunRef: Ref;
  sealingDecisionRef: Ref;
  classifiedRef: Ref;
  classificationKind: EvidenceClassificationKind;
  classificationStatus: EvidenceClassificationStatus;
  reason: EvidenceDispositionReason;
  createdAt: string;
  sealedByDecisionRef?: Ref;
  authorityStatus: "not_counted" | "counted";
}): EvidenceClassificationRecord {
  return stripUndefined({
    record_kind: "evidence_classification",
    version: 1,
    evidence_classification_id: evidenceClassificationRecordId({
      evaluation_run_record_id: input.evaluationRunRef.id,
      classification_kind: input.classificationKind,
      classified_ref: input.classifiedRef,
      reason: input.reason,
      sealing_decision_id: input.sealingDecisionRef.id
    }),
    candidate_ref: input.candidateRef,
    candidate_version_ref: input.candidateVersionRef,
    evaluation_run_ref: input.evaluationRunRef,
    classified_ref: input.classifiedRef,
    classification_kind: input.classificationKind,
    classification_status: input.classificationStatus,
    classification_reason: input.reason,
    created_at: input.createdAt,
    sealed_by_decision_ref: input.sealedByDecisionRef,
    authority_status: input.authorityStatus
  } satisfies EvidenceClassificationRecord);
}

function evidenceClassificationKindForDisposition(
  disposition: EvidenceDisposition
): EvidenceClassificationKind {
  if (disposition === "counted") {
    return "counted_evidence";
  }
  if (disposition === "quarantined_for_review") {
    return "rejected_evidence";
  }
  return "non_counted_evidence";
}

function evidenceClassificationStatusForDisposition(
  disposition: EvidenceDisposition
): EvidenceClassificationStatus {
  if (disposition === "counted") {
    return "counted";
  }
  if (disposition === "quarantined_for_review") {
    return "rejected";
  }
  return "not_counted";
}

function evidenceSealingDecisionRecord(input: {
  evidenceSealingDecisionId: string;
  comparisonSetRef: Ref;
  evaluationRunRef: Ref;
  evidenceDisposition: EvidenceDisposition;
  dispositionReason: EvidenceDispositionReason;
  createdAt: string;
  sealedAt: string;
}): EvidenceSealingDecisionRecord {
  const base = {
    record_kind: "evidence_sealing_decision" as const,
    version: 1 as const,
    evidence_sealing_decision_id: input.evidenceSealingDecisionId,
    evaluation_comparison_set_ref: input.comparisonSetRef,
    evaluation_run_refs: [input.evaluationRunRef],
    evidence_disposition: input.evidenceDisposition,
    disposition_reason: input.dispositionReason,
    created_at: input.createdAt,
    sealed_at: input.sealedAt
  };
  if (input.evidenceDisposition === "counted") {
    return {
      ...base,
      evidence_disposition: "counted",
      authority_status: "counted"
    };
  }
  return {
    ...base,
    evidence_disposition: input.evidenceDisposition,
    authority_status: "not_counted"
  };
}

function toEvidenceClassificationReadModel(
  classification: EvidenceClassificationRecord
) {
  return {
    classification_id: classification.evidence_classification_id,
    classified_ref: classification.classified_ref,
    classification_kind: classification.classification_kind,
    classification_status: classification.classification_status,
    classification_reason: classification.classification_reason,
    authority_status: classification.authority_status,
    sealed_by_decision_ref: classification.sealed_by_decision_ref,
    created_at: classification.created_at
  };
}

function toCandidateMaterializationAttemptReadModel(
  attempt: CandidateMaterializationAttemptRecord
): CandidateMaterializationAttemptReadModel {
  return {
    attempt_id: attempt.candidate_materialization_attempt_id,
    idempotency_key: attempt.idempotency_key,
    provider_kind: attempt.provider_kind,
    model: attempt.model,
    agent_run_ref: attempt.agent_run_ref,
    trace_ref: attempt.trace_ref,
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    resulting_candidate_ref: attempt.resulting_candidate_ref,
    artifact_refs: attempt.artifact_refs,
    created_at: attempt.created_at,
    authority_label: "provider_output_not_evidence"
  };
}

function buildFullCycleLineageReadModel(input: {
  candidate: TradingSystemCandidateRecord;
  version: CandidateVersionRecord;
  materializationAttempt?: CandidateMaterializationAttemptRecord;
  runtime: TradingRunRecord;
  ledger: LedgerReadModel;
}): CandidateInspectReadModel["full_cycle_lineage"] {
  const persisted = input.materializationAttempt?.full_cycle_lineage;
  if (!persisted) {
    return undefined;
  }

  return {
    handoff_status: "runnable",
    source: persisted.source,
    generated: persisted.generated,
    materialized: {
      trading_system_id: input.candidate.candidate_id,
      candidate_version_id: input.version.candidate_version_id,
      system_code_ref: input.version.system_code_ref ?? input.candidate.active_system_code_ref
    },
    evidence: {
      evaluation_status: persisted.evaluation.status,
      evaluation_score: persisted.evaluation.score,
      ...(persisted.evaluation.profit_loss ? { profit_loss: persisted.evaluation.profit_loss } : {}),
      ...(persisted.evaluation.direction_kind ? { direction_kind: persisted.evaluation.direction_kind } : {}),
      trading_run_id: input.runtime.trading_run_id,
      gateway_result_outcome: input.ledger.latest_gateway_result?.decision_outcome ?? "missing",
      ledger_chain_complete: input.ledger.chain_complete
    }
  };
}

function validateCandidateEvaluationRunInput(
  input: CandidateEvaluationRunInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_evaluation_input";
  }

  const raw = input as CandidateEvaluationRunInput & { stage?: unknown };
  if (!nonEmpty(raw.idempotency_key) || !nonEmpty(raw.candidate_id)) {
    return "invalid_evaluation_input";
  }
  if (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) {
    return "invalid_evaluation_input";
  }
  if (raw.stage !== undefined && raw.stage !== "backtest") {
    return "unsupported_evaluation_stage";
  }
  if (raw.trace_ref !== undefined && !isRef(raw.trace_ref, "trace_placeholder")) {
    return "invalid_evaluation_input";
  }
  if (raw.evaluator_ref !== undefined && !isRef(raw.evaluator_ref)) {
    return "invalid_evaluation_input";
  }
  if (
    !isOptionalRefArray(raw.input_artifact_refs) ||
    !isOptionalRefArray(raw.provider_output_artifact_refs) ||
    !isOptionalRefArray(raw.debug_artifact_refs)
  ) {
    return "invalid_evaluation_input";
  }

  return undefined;
}

const evidenceDispositionReasons = new Set<EvidenceDispositionReason>([
  "fixture_only",
  "no_external_evaluator",
  "provider_output_trace_only",
  "non_comparable",
  "partial_trace",
  "method_not_authoritative",
  "container_or_sandbox_legitimacy_insufficient",
  "sealed_counted_fixture_only_allowed_by_test",
  "no_evaluation_runs",
  "evaluation_links_incomplete"
]);

function validateEvidenceSealingDecisionInput(
  input: EvidenceSealingDecisionInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_evidence_sealing_input";
  }

  const raw = input as EvidenceSealingDecisionInput & {
    evidence_disposition?: unknown;
    disposition_reason?: unknown;
  };
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.evaluation_run_record_id) ||
    !isEvidenceDisposition(raw.evidence_disposition) ||
    !isEvidenceDispositionReason(raw.disposition_reason)
  ) {
    return "invalid_evidence_sealing_input";
  }
  if (raw.evidence_disposition === "counted" && raw.disposition_reason !== "sealed_counted_fixture_only_allowed_by_test") {
    return "invalid_evidence_sealing_input";
  }
  if (!isOptionalRefArray(raw.classified_refs)) {
    return "invalid_evidence_sealing_input";
  }
  if (raw.sealed_at !== undefined && !nonEmpty(raw.sealed_at)) {
    return "invalid_evidence_sealing_input";
  }
  return undefined;
}

function validateLedgerInput(
  input: LedgerInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_ledger_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id))
  ) {
    return "invalid_ledger_input";
  }
  if (
    !raw.intent ||
    !isOrderRequestKind(raw.intent.intent_kind) ||
    (raw.intent.side !== undefined && raw.intent.side !== "buy" && raw.intent.side !== "sell") ||
    (
      raw.intent.order_type !== undefined &&
      raw.intent.order_type !== "market" &&
      raw.intent.order_type !== "limit"
    ) ||
    (raw.intent.quantity !== undefined && !nonEmpty(raw.intent.quantity)) ||
    (raw.intent.limit_price !== undefined && !nonEmpty(raw.intent.limit_price))
  ) {
    return "invalid_ledger_input";
  }
  if (
    !raw.gateway_result ||
    !isGatewayResultOutcome(raw.gateway_result.decision_outcome) ||
    !isGatewayResultReason(raw.gateway_result.decision_reason) ||
    (
      raw.gateway_result.policy_ref !== undefined &&
      !isRef(raw.gateway_result.policy_ref)
    )
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.execution_mode !== undefined &&
    !isEvaluationExecutionMode(raw.execution_result.execution_mode)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.status !== undefined &&
    !isExecutionResultStatus(raw.execution_result.status)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.result_reason !== undefined &&
    !isGatewayResultReason(raw.execution_result.result_reason)
  ) {
    return "invalid_ledger_input";
  }
  if (
    raw.execution_result?.trace_ref !== undefined &&
    !isRef(raw.execution_result.trace_ref, "trace_placeholder")
  ) {
    return "invalid_ledger_input";
  }
  if (
    (raw.execution_result?.completed_at !== undefined && !nonEmpty(raw.execution_result.completed_at)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_ledger_input";
  }

  return undefined;
}

function validateRunControlAuditInput(
  input: RunControlAuditInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_run_control_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.command ||
    !isRunControlAction(raw.command.action) ||
    !isRunControlActorKind(raw.command.actor_kind) ||
    !isRunControlCommandReason(raw.command.reason) ||
    (
      raw.command.requested_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.command.requested_lifecycle_status)
    ) ||
    (raw.command.actor_ref !== undefined && !isRef(raw.command.actor_ref)) ||
    (
      raw.command.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.command.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (raw.command.reason_summary !== undefined && !nonEmpty(raw.command.reason_summary)) ||
    (raw.command.trace_ref !== undefined && !isRef(raw.command.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.command.related_order_request_refs) ||
    !isOptionalRefArray(raw.command.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.command.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.decision ||
    !isRunControlDecisionOutcome(raw.decision.decision_outcome) ||
    !isRunControlDecisionReason(raw.decision.decision_reason) ||
    !isRunControlActorKind(raw.decision.decided_by_actor_kind) ||
    (raw.decision.decided_by_actor_ref !== undefined && !isRef(raw.decision.decided_by_actor_ref)) ||
    (
      raw.decision.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.decision.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (
      raw.decision.resulting_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.decision.resulting_lifecycle_status)
    ) ||
    (raw.decision.trace_ref !== undefined && !isRef(raw.decision.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.decision.related_order_request_refs) ||
    !isOptionalRefArray(raw.decision.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.decision.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  if (
    !raw.audit_event ||
    !isRuntimeAuditEventKind(raw.audit_event.event_kind) ||
    (
      raw.audit_event.actor_kind !== undefined &&
      !isRunControlActorKind(raw.audit_event.actor_kind)
    ) ||
    (raw.audit_event.actor_ref !== undefined && !isRef(raw.audit_event.actor_ref)) ||
    (
      raw.audit_event.runtime_lifecycle_status !== undefined &&
      !isTradingRunLifecycleStatus(raw.audit_event.runtime_lifecycle_status)
    ) ||
    (raw.audit_event.message !== undefined && !nonEmpty(raw.audit_event.message)) ||
    (raw.audit_event.trace_ref !== undefined && !isRef(raw.audit_event.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.audit_event.supporting_record_refs) ||
    !isOptionalRefArray(raw.audit_event.related_order_request_refs) ||
    !isOptionalRefArray(raw.audit_event.related_gateway_result_refs) ||
    !isOptionalRefArray(raw.audit_event.related_execution_result_refs)
  ) {
    return "invalid_run_control_input";
  }

  return undefined;
}

function isEvidenceDisposition(value: unknown): value is EvidenceDisposition {
  return value === "not_counted" || value === "counted" || value === "quarantined_for_review";
}

function isEvidenceDispositionReason(value: unknown): value is EvidenceDispositionReason {
  return typeof value === "string" && evidenceDispositionReasons.has(value as EvidenceDispositionReason);
}

function isOrderRequestKind(value: unknown): boolean {
  return value === "place_order" || value === "cancel_order" || value === "adjust_position";
}

function isGatewayResultOutcome(value: unknown): value is GatewayResultOutcome {
  return value === "allowed" || value === "rejected" || value === "clipped" || value === "dry_run_only";
}

function isGatewayResultReason(value: unknown): value is GatewayResultReason {
  return (
    value === "paper_stage_only" ||
    value === "dry_run_allowed" ||
    value === "no_live_authority" ||
    value === "risk_limit_exceeded" ||
    value === "operator_hold" ||
    value === "fixture_only"
  );
}

function isEvaluationExecutionMode(value: unknown): boolean {
  return value === "host_local" || value === "containerized_local" || value === "containerized_remote";
}

function isExecutionResultStatus(value: unknown): value is ExecutionResultStatus {
  return (
    value === "not_submitted" ||
    value === "dry_run_recorded" ||
    value === "blocked" ||
    value === "canceled" ||
    value === "failed"
  );
}

function isRunControlAction(value: unknown): value is RunControlAction {
  return (
    value === "inspect" ||
    value === "start" ||
    value === "pause" ||
    value === "resume" ||
    value === "stop" ||
    value === "override" ||
    value === "kill" ||
    value === "handoff" ||
    value === "audit"
  );
}

function isRunControlActorKind(value: unknown): value is RunControlActorKind {
  return (
    value === "human_operator" ||
    value === "policy_engine" ||
    value === "external_handoff" ||
    value === "fixture_operator"
  );
}

function isRunControlCommandReason(value: unknown): value is RunControlCommandReason {
  return (
    value === "operator_request" ||
    value === "inspection_request" ||
    value === "manual_override" ||
    value === "safety_intervention" ||
    value === "handoff_requested" ||
    value === "audit_request" ||
    value === "fixture_only"
  );
}

function isRunControlDecisionOutcome(value: unknown): value is RunControlDecisionOutcome {
  return (
    value === "allowed" ||
    value === "rejected" ||
    value === "dry_run_only" ||
    value === "no_live_authority"
  );
}

function isRunControlDecisionReason(value: unknown): value is RunControlDecisionReason {
  return (
    value === "policy_allows_control" ||
    value === "policy_rejected_control" ||
    value === "no_live_authority" ||
    value === "runtime_lifecycle_incompatible" ||
    value === "operator_hold" ||
    value === "manual_override_allowed" ||
    value === "safety_kill_allowed" ||
    value === "fixture_only"
  );
}

function isRuntimeAuditEventKind(value: unknown): value is RuntimeAuditEventKind {
  return (
    value === "control_command_recorded" ||
    value === "control_decision_recorded" ||
    value === "runtime_lifecycle_transitioned" ||
    value === "runtime_inspection_recorded" ||
    value === "control_override_recorded" ||
    value === "control_kill_recorded" ||
    value === "operator_handoff_recorded" ||
    value === "audit_snapshot_recorded"
  );
}

function isTradingRunLifecycleStatus(
  value: unknown
): value is TradingRunLifecycleStatus {
  return (
    value === "registered" ||
    value === "deployed" ||
    value === "starting" ||
    value === "running" ||
    value === "paused" ||
    value === "stopping" ||
    value === "stopped" ||
    value === "failed" ||
    value === "killed" ||
    value === "human_review_required" ||
    value === "fixture_placeholder"
  );
}

function isSystemCodeRecord(value: unknown): value is SystemCodeRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<SystemCodeRecord>;
  return (
    raw.record_kind === "system_code" &&
    raw.version === 1 &&
    nonEmpty(raw.system_code_id) &&
    (raw.artifact_kind === "python_file" || raw.artifact_kind === "container_image") &&
    nonEmpty(raw.artifact_digest) &&
    (raw.artifact_ref === undefined || isRef(raw.artifact_ref)) &&
    (raw.artifact_runtime_contract_ref === undefined ||
      isRef(raw.artifact_runtime_contract_ref, "artifact_runtime_contract")) &&
    isSystemCodeRuntimeKind(raw.runtime_kind) &&
    Array.isArray(raw.entrypoint) &&
    raw.entrypoint.length > 0 &&
    raw.entrypoint.every((item) => nonEmpty(item)) &&
    isSystemCodeOutputContract(raw.declared_output_contract) &&
    isRef(raw.secret_policy_ref, "secret_policy") &&
    isRef(raw.capability_policy_ref, "capability_policy") &&
    Array.isArray(raw.provenance_refs) &&
    raw.provenance_refs.every((item) => isRef(item)) &&
    raw.status === "registered" &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "not_live" &&
    (
      (raw.artifact_kind === "python_file" && nonEmpty(raw.artifact_path)) ||
      (raw.artifact_kind === "container_image" && nonEmpty(raw.image_ref))
    )
  );
}

function isResearchFindingRecord(value: unknown): value is ResearchFindingRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ResearchFindingRecord>;
  return (
    raw.record_kind === "research_finding" &&
    raw.version === 1 &&
    nonEmpty(raw.research_finding_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.experiment_run_ref, "experiment_run") &&
    isRef(raw.trading_evaluation_result_ref, "trading_evaluation_result") &&
    isResearchFindingKind(raw.finding_kind) &&
    nonEmpty(raw.summary) &&
    Array.isArray(raw.supporting_record_refs) &&
    raw.supporting_record_refs.every((item) => isRef(item)) &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "research_trace_only"
  );
}

function isCandidateArenaTickRecord(value: unknown): value is CandidateArenaTickRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<CandidateArenaTickRecord>;
  return (
    raw.record_kind === "candidate_arena_tick" &&
    raw.version === 1 &&
    nonEmpty(raw.candidate_arena_tick_id) &&
    nonEmpty(raw.tick_id) &&
    nonEmpty(raw.started_at) &&
    nonEmpty(raw.completed_at) &&
    isCandidateArenaTickStatus(raw.status) &&
    Array.isArray(raw.created_candidate_refs) &&
    raw.created_candidate_refs.every((item) => isRef(item, "trading_system_candidate")) &&
    Array.isArray(raw.direction_results) &&
    raw.direction_results.every(isCandidateArenaTickDirectionResult) &&
    raw.authority_status === "not_live"
  );
}

function isArtifactLineageRecord(value: unknown): value is ArtifactLineageRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ArtifactLineageRecord>;
  return (
    raw.record_kind === "artifact_lineage" &&
    raw.version === 1 &&
    nonEmpty(raw.artifact_lineage_id) &&
    isRef(raw.child_system_code_ref, "system_code") &&
    (raw.parent_system_code_ref === undefined ||
      isRef(raw.parent_system_code_ref, "system_code")) &&
    Array.isArray(raw.source_finding_refs) &&
    raw.source_finding_refs.length > 0 &&
    raw.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (raw.created_by_research_worker_ref === undefined ||
      isRef(raw.created_by_research_worker_ref, "research_worker")) &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "lineage_only"
  );
}

function isImprovementProposalRecord(value: unknown): value is ImprovementProposalRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ImprovementProposalRecord>;
  return (
    raw.record_kind === "improvement_proposal" &&
    raw.version === 1 &&
    nonEmpty(raw.improvement_proposal_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    isRef(raw.proposed_system_code_ref, "system_code") &&
    (raw.parent_system_code_ref === undefined ||
      isRef(raw.parent_system_code_ref, "system_code")) &&
    Array.isArray(raw.source_finding_refs) &&
    raw.source_finding_refs.length > 0 &&
    raw.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (
      raw.anti_hacking_finding_refs === undefined ||
      (
        Array.isArray(raw.anti_hacking_finding_refs) &&
        raw.anti_hacking_finding_refs.every((item) => isRef(item, "research_finding"))
      )
    ) &&
    nonEmpty(raw.proposal_summary) &&
    nonEmpty(raw.requested_change_summary) &&
    (raw.expected_improvement_summary === undefined || nonEmpty(raw.expected_improvement_summary)) &&
    nonEmpty(raw.created_at) &&
    isImprovementProposalStatus(raw.status) &&
    raw.authority_status === "proposal_only"
  );
}

function isResearchOrchestrationRunRecord(value: unknown): value is ResearchOrchestrationRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ResearchOrchestrationRunRecord>;
  return (
    raw.record_kind === "research_orchestration_run" &&
    raw.version === 1 &&
    nonEmpty(raw.research_orchestration_run_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    Array.isArray(raw.input_finding_refs) &&
    raw.input_finding_refs.length > 0 &&
    raw.input_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (
      raw.input_lineage_refs === undefined ||
      (
        Array.isArray(raw.input_lineage_refs) &&
        raw.input_lineage_refs.every((item) => isRef(item, "artifact_lineage"))
      )
    ) &&
    (raw.output_artifact_proposal_ref === undefined ||
      isRef(raw.output_artifact_proposal_ref, "improvement_proposal")) &&
    (raw.output_system_code_ref === undefined ||
      isRef(raw.output_system_code_ref, "system_code")) &&
    (raw.output_lineage_ref === undefined || isRef(raw.output_lineage_ref, "artifact_lineage")) &&
    (raw.trace_ref === undefined || isRef(raw.trace_ref, "trace_placeholder")) &&
    nonEmpty(raw.started_at) &&
    (raw.completed_at === undefined || nonEmpty(raw.completed_at)) &&
    isResearchOrchestrationRunStatus(raw.status) &&
    raw.authority_status === "research_only"
  );
}

function isExperimentRunRecord(value: unknown): value is ExperimentRunRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ExperimentRunRecord>;
  return (
    raw.record_kind === "experiment_run" &&
    raw.version === 1 &&
    nonEmpty(raw.experiment_run_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.system_code_ref, "system_code") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    (
      raw.sandbox_ref === undefined ||
      isRef(raw.sandbox_ref, "sandbox")
    ) &&
    (
      raw.runtime_trace_refs === undefined ||
      (
        Array.isArray(raw.runtime_trace_refs) &&
        raw.runtime_trace_refs.every((item) => isRef(item))
      )
    ) &&
    (raw.trace_ref === undefined || isRef(raw.trace_ref, "trace_placeholder")) &&
    nonEmpty(raw.submitted_at) &&
    isExperimentRunStatus(raw.status) &&
    raw.authority_status === "not_live"
  );
}

function isTradingEvaluationResultRecord(value: unknown): value is TradingEvaluationResultRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<TradingEvaluationResultRecord>;
  return (
    raw.record_kind === "trading_evaluation_result" &&
    raw.version === 1 &&
    nonEmpty(raw.trading_evaluation_result_id) &&
    isRef(raw.experiment_run_ref, "experiment_run") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    isRef(raw.evaluator_ref, "external_evaluator") &&
    isTradingEvaluationResultStatus(raw.result_status) &&
    isEvidenceDisposition(raw.evidence_disposition) &&
    isTradingEvaluationScoreSummary(raw.score_summary) &&
    Array.isArray(raw.metric_refs) &&
    raw.metric_refs.every((item) => isRef(item, "metric_snapshot")) &&
    isRef(raw.evaluator_trace_ref, "trace_placeholder") &&
    (
      raw.disqualification_reason === undefined ||
      isTradingEvaluationDisqualificationReason(raw.disqualification_reason)
    ) &&
    (
      raw.quarantine_reason === undefined ||
      isTradingEvaluationQuarantineReason(raw.quarantine_reason)
    ) &&
    nonEmpty(raw.completed_at) &&
    (raw.authority_status === "not_counted" || raw.authority_status === "counted")
  );
}

function isResearchFindingKind(value: unknown): boolean {
  return (
    value === "positive_result" ||
    value === "negative_result" ||
    value === "failure_analysis" ||
    value === "anti_hacking_case" ||
    value === "next_artifact_hint"
  );
}

function isImprovementProposalStatus(value: unknown): boolean {
  return value === "proposed" || value === "materialized" || value === "discarded";
}

function isResearchOrchestrationRunStatus(value: unknown): boolean {
  return value === "started" || value === "proposed" || value === "failed" || value === "discarded";
}

function isExperimentRunStatus(value: unknown): boolean {
  return value === "submitted" || value === "evaluated" || value === "failed" || value === "discarded";
}

function isCandidateArenaTickStatus(value: unknown): boolean {
  return value === "completed" || value === "completed_with_errors" || value === "failed";
}

function isCandidateArenaDirectionResultStatus(value: unknown): boolean {
  return value === "created" || value === "failed";
}

function isCandidateArenaResearchDirection(value: unknown): boolean {
  return (
    value === "trend_following" ||
    value === "mean_reversion" ||
    value === "volatility_regime" ||
    value === "funding_aware_risk" ||
    value === "liquidation_aware_risk" ||
    value === "execution_cost_robustness" ||
    value === "other"
  );
}

function isCandidateArenaTickDirectionResult(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    direction_kind?: unknown;
    status?: unknown;
    candidate_id?: unknown;
    finding?: unknown;
    error?: unknown;
    net_revenue_usdt?: unknown;
  };
  const hasCandidateId = raw.candidate_id === undefined || nonEmpty(raw.candidate_id);
  const hasFinding = raw.finding === undefined || nonEmpty(raw.finding);
  const hasError = raw.error === undefined || nonEmpty(raw.error);
  const hasNetRevenue = raw.net_revenue_usdt === undefined ||
    (typeof raw.net_revenue_usdt === "number" && Number.isFinite(raw.net_revenue_usdt));
  return (
    isCandidateArenaResearchDirection(raw.direction_kind) &&
    isCandidateArenaDirectionResultStatus(raw.status) &&
    hasCandidateId &&
    hasFinding &&
    hasError &&
    hasNetRevenue &&
    (
      raw.status === "created"
        ? nonEmpty(raw.candidate_id)
        : nonEmpty(raw.error)
    )
  );
}

function isTradingEvaluationResultStatus(value: unknown): boolean {
  return value === "accepted" || value === "quarantined_for_review" || value === "disqualified";
}

function isTradingEvaluationScoreSummary(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return [
    "total_score",
    "oos_score",
    "drawdown_score",
    "turnover_score",
    "cost_survival_score",
    "reproducibility_score",
    "complexity_penalty"
  ].every((key) => typeof raw[key] === "number" && Number.isFinite(raw[key]));
}

function isTradingEvaluationDisqualificationReason(value: unknown): boolean {
  return (
    value === "lookahead_leakage" ||
    value === "data_leakage" ||
    value === "survivorship_bias" ||
    value === "cost_model_bypass" ||
    value === "funding_ignored" ||
    value === "liquidation_ignored" ||
    value === "seed_cherry_pick" ||
    value === "oos_overfit" ||
    value === "unreproducible" ||
    value === "runtime_self_report_only"
  );
}

function isTradingEvaluationQuarantineReason(value: unknown): boolean {
  return (
    value === "metric_instability" ||
    value === "insufficient_oos_coverage" ||
    value === "excessive_complexity" ||
    value === "manual_review_required" ||
    value === "partial_trace"
  );
}

function isSystemCodeRuntimeKind(value: unknown): boolean {
  return value === "python" || value === "container_image";
}

function isSystemCodeOutputContract(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as {
    contract_kind?: unknown;
    declared_output_kinds?: unknown;
    event_envelope_ref?: unknown;
    log_contract_ref?: unknown;
    heartbeat_contract_ref?: unknown;
  };
  return (
    raw.contract_kind === "opaque_runtime_boundary" &&
    Array.isArray(raw.declared_output_kinds) &&
    raw.declared_output_kinds.length > 0 &&
    raw.declared_output_kinds.every((item) => isSystemCodeOutputKind(item)) &&
    (raw.event_envelope_ref === undefined || isRef(raw.event_envelope_ref)) &&
    (raw.log_contract_ref === undefined || isRef(raw.log_contract_ref)) &&
    (raw.heartbeat_contract_ref === undefined || isRef(raw.heartbeat_contract_ref))
  );
}

function isSystemCodeOutputKind(value: unknown): boolean {
  return (
    value === "program_event" ||
    value === "runtime_log" ||
    value === "runtime_heartbeat" ||
    value === "metric_snapshot" ||
    value === "diagnostic_artifact" ||
    value === "order_request"
  );
}

function isOptionalRefArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => isRef(item)));
}

function isRequiredRefArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isRef(item));
}

function isRef(value: unknown, recordKind?: string): value is Ref {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Ref>;
  return (
    nonEmpty(candidate.record_kind) &&
    nonEmpty(candidate.id) &&
    (recordKind === undefined || candidate.record_kind === recordKind)
  );
}

function isMissingFileError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isMissingEvaluationLinkError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.startsWith("evaluation comparison set missing") ||
    error.message.startsWith("evidence sealing decision missing")
  );
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => child !== undefined)
  ) as T;
}

function stableSuffix(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function comparePaperTradingEvaluations(
  a: PaperTradingEvaluationRecord,
  b: PaperTradingEvaluationRecord
): number {
  return a.started_at.localeCompare(b.started_at) ||
    a.paper_trading_evaluation_id.localeCompare(b.paper_trading_evaluation_id);
}

function comparePaperTradingObservations(
  a: PaperTradingObservationRecord,
  b: PaperTradingObservationRecord
): number {
  return a.sequence - b.sequence ||
    a.observed_at.localeCompare(b.observed_at) ||
    a.paper_trading_observation_id.localeCompare(b.paper_trading_observation_id);
}

function storeJsonFileName(id: string): string {
  return `${encodeURIComponent(id)}.json`;
}

interface LedgerRecordIds {
  orderIntent: string;
  gatewayDecision: string;
  executionAttempt: string;
}

function ledgerRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): LedgerRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    orderIntent: `order-request-${suffix}`,
    gatewayDecision: `gateway-result-${suffix}`,
    executionAttempt: `execution-result-${suffix}`
  };
}

interface RunControlAuditRecordIds {
  command: string;
  decision: string;
  auditEvent: string;
}

function runtimeControlAuditRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): RunControlAuditRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    command: `run-control-command-${suffix}`,
    decision: `run-control-decision-${suffix}`,
    auditEvent: `runtime-audit-event-${suffix}`
  };
}

function privateReadinessPostureRecordId(idempotencyKey: string): string {
  return `local-binance-btcusdt-private-readiness-posture-${stableSuffix(idempotencyKey)}`;
}

function runtimeControlAuthorityStatusForOutcome(
  outcome: RunControlDecisionOutcome
): RunControlAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  if (outcome === "no_live_authority") {
    return "not_live";
  }
  return "control_only";
}

function gatewayDecisionAuthorityStatusForOutcome(
  outcome: GatewayResultOutcome
): GatewayResultAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  return "not_live";
}

function executionAttemptStatusForDecision(outcome: GatewayResultOutcome): ExecutionResultStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_recorded";
  }
  if (outcome === "rejected") {
    return "blocked";
  }
  return "not_submitted";
}

function executionAttemptAuthorityStatusForStatus(
  status: ExecutionResultStatus,
  outcome: GatewayResultOutcome
): ExecutionResultAuthorityStatus {
  if (status === "dry_run_recorded" || outcome === "dry_run_only") {
    return "dry_run_only";
  }
  if (status === "not_submitted" || status === "blocked") {
    return "not_submitted";
  }
  return "not_live";
}

function appendUniqueRefs(existing: Ref[] | undefined, next: Ref | Ref[] | undefined): Ref[] {
  let refs = existing ?? [];
  const nextRefs = Array.isArray(next) ? next : next ? [next] : [];
  for (const nextRef of nextRefs) {
    if (!refs.some((candidate) => candidate.record_kind === nextRef.record_kind && candidate.id === nextRef.id)) {
      refs = [...refs, nextRef];
    }
  }
  return refs;
}

function evidenceSealingDecisionRecordId(input: {
  evaluation_run_record_id: string;
  idempotency_key: string;
}): string {
  return `evidence-sealing-decision-${stableSuffix(`${input.evaluation_run_record_id}:${input.idempotency_key}`)}`;
}

function evidenceClassificationRecordId(input: {
  evaluation_run_record_id: string;
  classification_kind: EvidenceClassificationKind;
  classified_ref: Ref;
  reason: EvidenceDispositionReason;
  sealing_decision_id: string;
}): string {
  return `evidence-classification-${stableSuffix([
    input.evaluation_run_record_id,
    input.classification_kind,
    input.classified_ref.record_kind,
    input.classified_ref.id,
    input.reason,
    input.sealing_decision_id
  ].join(":"))}`;
}

function validateImprovementProposalMaterializationInput(
  input: ImprovementProposalMaterializationInput
): ImprovementProposalMaterializationFailureReason | undefined {
  if (!input || typeof input !== "object") {
    return "provider_output_schema_invalid";
  }

  const raw = input as Partial<ImprovementProposalMaterializationInput>;
  const result = raw.provider_result as
    | Partial<ImprovementProposalMaterializationInput["provider_result"]>
    | undefined;
  const provider = (result?.provider ?? {}) as Partial<ImprovementProposalProviderAttribution>;
  const output = (result?.output ?? {}) as Partial<ImprovementProposalProviderOutput>;

  if (
    !nonEmpty(raw.idempotency_key) ||
    result?.status !== "succeeded" ||
    !isProviderKind(provider.provider_kind) ||
    !nonEmpty(provider.model) ||
    !nonEmpty(provider.invocation_surface) ||
    !isRef(result.agent_run_ref, "agent_run") ||
    !Array.isArray(result.agent_event_refs) ||
    result.agent_event_refs.length === 0 ||
    !result.agent_event_refs.every((item) => isRef(item, "agent_event")) ||
    !isRef(result.trace_ref, "trace_placeholder") ||
    !isRequiredRefArray(result.provider_output_artifact_refs) ||
    !isRequiredRefArray(result.debug_artifact_refs) ||
    !nonEmpty(result.idempotency_key) ||
    result.authority_status !== "proposal_input_only" ||
    output.output_kind !== "improvement_proposal_input" ||
    !isRef(output.trading_evaluation_task_ref, "trading_evaluation_task") ||
    !Array.isArray(output.source_finding_refs) ||
    output.source_finding_refs.length === 0 ||
    !output.source_finding_refs.every((item) => isRef(item, "research_finding")) ||
    (
      output.anti_hacking_finding_refs !== undefined &&
      (
        !Array.isArray(output.anti_hacking_finding_refs) ||
        !output.anti_hacking_finding_refs.every((item) => isRef(item, "research_finding"))
      )
    ) ||
    (
      output.parent_system_code_ref !== undefined &&
      !isRef(output.parent_system_code_ref, "system_code")
    ) ||
    !nonEmpty(output.proposal_summary) ||
    !nonEmpty(output.requested_change_summary) ||
    (
      output.expected_improvement_summary !== undefined &&
      !nonEmpty(output.expected_improvement_summary)
    ) ||
    !Array.isArray(output.proposed_artifact_refs) ||
    output.proposed_artifact_refs.length === 0 ||
    !output.proposed_artifact_refs.every((item) => isRef(item)) ||
    output.output_authority_status !== "proposal_input_only" ||
    (raw.artifact_path !== undefined && !nonEmpty(raw.artifact_path)) ||
    (
      raw.artifact_runtime_contract_ref !== undefined &&
      !isRef(raw.artifact_runtime_contract_ref, "artifact_runtime_contract")
    ) ||
    (raw.secret_policy_ref !== undefined && !isRef(raw.secret_policy_ref, "secret_policy")) ||
    (
      raw.capability_policy_ref !== undefined &&
      !isRef(raw.capability_policy_ref, "capability_policy")
    ) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "provider_output_schema_invalid";
  }

  if (containsForbiddenImprovementProposalProviderOutputKey(result)) {
    return "provider_output_rejected";
  }

  return undefined;
}

function validateCandidateMaterializationInput(
  input: CandidateMaterializationInput
): CandidateMaterializationFailureReason | undefined {
  if (!input || typeof input !== "object") {
    return "schema_invalid";
  }

  const candidateInput = input as Partial<CandidateMaterializationInput>;
  const provider = (candidateInput.provider ?? {}) as Partial<CandidateMaterializationInput["provider"]>;
  const candidate = (candidateInput.candidate ?? {}) as Partial<CandidateMaterializationInput["candidate"]>;
  const spec = (candidateInput.spec ?? {}) as Partial<CandidateMaterializationInput["spec"]>;
  const program = (candidateInput.program ?? {}) as Partial<CandidateMaterializationInput["program"]>;
  const capabilityPackage = (candidateInput.capability_package ?? {}) as Partial<CandidateMaterializationInput["capability_package"]>;

  if (
    !nonEmpty(candidateInput.idempotency_key) ||
    !nonEmpty(provider.agent_run_id) ||
    !nonEmpty(provider.agent_event_id) ||
    !nonEmpty(provider.trace_id) ||
    !nonEmpty(provider.output_artifact_hash) ||
    !nonEmpty(candidate.title) ||
    !nonEmpty(candidate.system_summary) ||
    !nonEmpty(spec.summary) ||
    !nonEmpty(program.summary) ||
    !nonEmpty(program.declared_runtime) ||
    !Array.isArray(program.declared_outputs) ||
    program.declared_outputs.length === 0 ||
    !nonEmpty(capabilityPackage.summary)
  ) {
    return "schema_invalid";
  }

  const supportedSpec = (
    spec.market === "ExternalTradingApiProvider" &&
    spec.instrument === "generic trading instruments"
  ) || (
    spec.market === "Binance USD-M Futures" &&
    spec.instrument === "BTCUSDT"
  );

  if (
    candidate.first_market_scope !== "external_trading_api_fixture" ||
    !supportedSpec ||
    (candidateInput.system_code_ref !== undefined && !isRef(candidateInput.system_code_ref, "system_code")) ||
    containsForbiddenMaterializationKey(input)
  ) {
    return "materialization_rejected";
  }

  return undefined;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isProviderKind(value: unknown): value is ProviderKind {
  return (
    value === "codex_cli" ||
    value === "claude_code" ||
    value === "local_process" ||
    value === "fixture_only"
  );
}

function containsForbiddenImprovementProposalProviderOutputKey(value: unknown): boolean {
  const forbiddenKeys = new Set([
    "evidence",
    "evidence_record",
    "counted_evidence",
    "promotion",
    "promotion_decision",
    "live_approval",
    "exchange_credentials",
    "provider_api_key",
    "gateway_signing_material",
    "direct_exchange_order",
    "paper_order_authority",
    "live_order_authority",
    "strategy_internals",
    "strategy_schema",
    "venue_adapter",
    "venue_adapter_assumptions"
  ]);

  if (Array.isArray(value)) {
    return value.some(containsForbiddenImprovementProposalProviderOutputKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalized = key.toLowerCase();
      return forbiddenKeys.has(normalized) || containsForbiddenImprovementProposalProviderOutputKey(child);
    });
  }
  return false;
}

function containsForbiddenMaterializationKey(value: unknown): boolean {
  const forbiddenKeys = new Set([
    "evidence",
    "evidence_record",
    "promotion",
    "promotion_decision",
    "live_approval",
    "exchange_credentials",
    "provider_api_key",
    "gateway_signing_material",
    "direct_exchange_order"
  ]);

  if (Array.isArray(value)) {
    return value.some(containsForbiddenMaterializationKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalized = key.toLowerCase();
      return forbiddenKeys.has(normalized) || containsForbiddenMaterializationKey(child);
    });
  }
  return false;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
