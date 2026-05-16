import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type {
  AgentEventRecord,
  AgentRunRecord,
  AgentSessionRecord,
  ExperimentRunRecord,
  ArtifactLineageRecord,
  ArtifactChangeProposalRecord,
  ResearchFindingRecord,
  ResearchOrchestrationRunRecord,
  ArtifactRuntimeContractRecord,
  BoundedRuntimeAuthorityInput,
  BoundedRuntimeAuthorityOutcome,
  AgentSpecRecord,
  ArtifactChangeProposalMaterializationAttemptRecord,
  ArtifactChangeProposalMaterializationFailureReason,
  ArtifactChangeProposalMaterializationInput,
  ArtifactChangeProposalMaterializationOutcome,
  ArtifactChangeProposalProviderAttribution,
  ArtifactChangeProposalProviderFailureInput,
  ArtifactChangeProposalProviderOutput,
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
  ReplayRuntimeAuthorityReadModel,
  ReplayRuntimeControlReadModel,
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
  ExecutionAttemptAuthorityStatus,
  ExecutionAttemptRecord,
  ExecutionAttemptStatus,
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
  GatewayDecisionRecord,
  GatewayDecisionAuthorityStatus,
  GatewayDecisionOutcome,
  GatewayDecisionReason,
  HandsEnvironmentRecord,
  OrderFillSurfaceReadModel,
  OrderFillSurfaceRecord,
  PrivateReadinessPreflightSurfaceReadModel,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  PublicMarketLivenessSurfaceRecord,
  TradingSubstrateInstrument,
  TradingSubstrateVenue,
  OrderIntentDraftRecord,
  PlaceholderSummary,
  ProgramManifestRecord,
  ProgramValidationRecord,
  ProviderKind,
  ProviderProbeAttemptRecord,
  ProviderReadinessRecord,
  Ref,
  RunnableArtifactRecord,
  RuntimeAuditEventKind,
  RuntimeAuditEventRecord,
  RuntimeHeartbeatRecord,
  RuntimeControlAction,
  RuntimeControlActorKind,
  RuntimeControlAuditInput,
  RuntimeControlAuditOutcome,
  RuntimeControlAuthorityStatus,
  RuntimeControlCommandReason,
  RuntimeControlCommandRecord,
  RuntimeControlDecisionOutcome,
  RuntimeControlDecisionReason,
  RuntimeControlDecisionRecord,
  RuntimeInstanceHeartbeatReadModel,
  RuntimeInstanceIndexProjection,
  RuntimeInstanceLogReadModel,
  RuntimeInstanceLogRecord,
  RuntimeInstanceLogsOutcome,
  RuntimeMemorySurfaceRecord,
  RuntimePlacementRecord,
  SandboxCommandEvidenceReadModel,
  SandboxCommandEvidenceRecord,
  SandboxRuntimeInstanceDetailReadModel,
  SandboxRuntimeInstanceReadModel,
  SandboxRuntimeInstanceRecord,
  StartRuntimeInstanceOutcome,
  StopRuntimeInstanceInput,
  StageBindingRecord,
  TracePlaceholderRecord,
  TradingSystemCandidateRecord,
  TradingEvaluationResultRecord,
  TradingSystemProgramRecord,
  TradingSystemRuntimeLifecycleStatus,
  TradingSystemRuntimeRecord,
  TradingSystemSpecRecord
} from "@ouroboros/domain";

export const DEFAULT_STORE_ROOT = ".ouroboros/dev-store";
export const FIXTURE_CANDIDATE_ID = "fixture-candidate-sealed-replay-001";
export const FIXTURE_RUNNABLE_ARTIFACT_ID = "fixture-runnable-artifact-clock-python-001";

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
  | "invalid_runtime_authority_input"
  | "invalid_runtime_control_input"
  | "invalid_runtime_instance_input"
  | "invalid_order_fill_surface_input"
  | "invalid_public_market_liveness_surface_input"
  | "invalid_private_readiness_preflight_surface_input"
  | "invalid_runnable_artifact_input"
  | "runtime_not_found"
  | "runtime_mismatch"
  | "runnable_artifact_not_found"
  | "runtime_instance_not_found"
  | "runtime_authority_reload_failed"
  | "runtime_control_reload_failed"
  | "runtime_instance_reload_failed"
  | "invalid_research_finding_input"
  | "invalid_artifact_lineage_input"
  | "invalid_artifact_change_proposal_input"
  | "invalid_research_orchestration_run_input"
  | "invalid_experiment_run_input"
  | "invalid_trading_evaluation_result_input"
  | "artifact_change_proposal_materialization_reload_failed"
  | "research_finding_not_found"
  | "artifact_change_proposal_not_found"
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
  | "runnable-artifacts"
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
  | "provider-readiness-records"
  | "provider-probe-attempts"
  | "trading-system-runtimes"
  | "runtime-placements"
  | "hands-environments"
  | "runtime-memory-surfaces"
  | "stage-bindings"
  | "traces"
  | "evaluation-runs"
  | "evaluation-comparison-sets"
  | "evidence-sealing-decisions"
  | "evidence-classifications"
  | "order-intent-drafts"
  | "gateway-decisions"
  | "execution-attempts"
  | "runtime-control-commands"
  | "runtime-control-decisions"
  | "runtime-audit-events"
  | "substrate-state-surfaces"
  | "sandbox-runtime-instances"
  | "runtime-instance-logs"
  | "runtime-heartbeats"
  | "sandbox-command-evidence"
  | "research-findings"
  | "artifact-lineages"
  | "artifact-change-proposals"
  | "artifact-change-proposal-materialization-attempts"
  | "research-orchestration-runs"
  | "experiment-runs"
  | "trading-evaluation-results";

interface FixtureItem {
  collection: Collection;
  id: string;
  record: FixtureRecord;
  itemDir?: "items" | "placeholders";
}

export interface RuntimeInstanceObservationInput {
  instance: SandboxRuntimeInstanceRecord;
  placement?: RuntimePlacementRecord;
  lifecycle_status?: SandboxRuntimeInstanceRecord["lifecycle_status"];
  stopped_at?: string;
  removed_at?: string;
  logs?: RuntimeInstanceLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
}

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
  runnableArtifact: FIXTURE_RUNNABLE_ARTIFACT_ID,
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
  runtime: "fixture-trading-system-runtime-001",
  placement: "fixture-runtime-placement-001",
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
  privateReadinessPreflightSurface: "fixture-binance-btcusdt-private-readiness-preflight-surface-001"
};

const fixtureEvaluationCreatedAt = "2026-05-05T00:00:00.000Z";

const binanceUsdsFuturesConnectorTransport = {
  transport_kind: "official_binance_connector",
  repository: "binance/binance-connector-js",
  package_name: "@binance/derivatives-trading-usds-futures",
  api_family: "derivatives_trading_usds_futures",
  supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
  production_base_url: "https://fapi.binance.com",
  testnet_base_url: "https://testnet.binancefuture.com",
  integration_role: "transport_only",
  authority_status: "not_live"
} as const;

export function createFixtureRecords(): FixtureItem[] {
  const artifactRuntimeContract: ArtifactRuntimeContractRecord = {
    record_kind: "artifact_runtime_contract",
    version: 1,
    artifact_runtime_contract_id: ids.artifactRuntimeContract,
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat"],
      event_envelope_ref: ref("program_event_contract", "opaque-clock-program-event-v1"),
      log_contract_ref: ref("runtime_log_contract", "opaque-clock-log-v1"),
      heartbeat_contract_ref: ref("runtime_heartbeat_contract", "opaque-clock-heartbeat-v1")
    },
    secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
    capability_policy_ref: ref("capability_policy", "capability-policy-clock-fixture-v1"),
    created_at: fixtureEvaluationCreatedAt,
    authority_status: "contract_only"
  };
  const runnableArtifact: RunnableArtifactRecord = {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: ids.runnableArtifact,
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
    active_runnable_artifact_ref: ref("runnable_artifact", ids.runnableArtifact)
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
    runtime_ref: ref("trading_system_runtime", ids.runtime),
    trace_placeholder_ref: ref("trace_placeholder", ids.trace),
    evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun),
    runnable_artifact_ref: ref("runnable_artifact", ids.runnableArtifact)
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
    declared_outputs: ["OrderIntentDraft placeholder", "Trace placeholder"]
  };
  const programValidation: ProgramValidationRecord = {
    record_kind: "program_validation_record",
    version: 1,
    program_validation_record_id: ids.programValidation,
    status: "fixture_placeholder",
    authority_status: "not_runnable"
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
  const runtime: TradingSystemRuntimeRecord = {
    record_kind: "trading_system_runtime",
    version: 1,
    trading_system_runtime_id: ids.runtime,
    stage_binding_profile: "paper",
    runtime_lifecycle_status: "fixture_placeholder",
    placement_ref: ref("runtime_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    memory_surface_ref: ref("runtime_memory_surface", ids.memorySurface),
    runnable_artifact_ref: ref("runnable_artifact", ids.runnableArtifact),
    authority_status: "not_live"
  };
  const placement: RuntimePlacementRecord = {
    record_kind: "runtime_placement",
    version: 1,
    runtime_placement_id: ids.placement,
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
    runtime_placement_ref: ref("runtime_placement", ids.placement),
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
    { collection: "runnable-artifacts", id: ids.runnableArtifact, record: runnableArtifact },
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
    { collection: "trading-system-runtimes", id: ids.runtime, record: runtime },
    { collection: "runtime-placements", id: ids.placement, record: placement },
    { collection: "hands-environments", id: ids.handsEnvironment, record: handsEnvironment },
    { collection: "runtime-memory-surfaces", id: ids.memorySurface, record: memorySurface },
    { collection: "traces", id: ids.trace, record: trace, itemDir: "placeholders" },
    { collection: "stage-bindings", id: ids.stageBinding, record: stageBinding },
    { collection: "evaluation-runs", id: ids.evaluationRun, record: evaluationRun },
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
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
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
        path.join(this.storeRoot, "read-models/candidates/items", `${candidate.candidate_id}.json`),
        readModel
      );
      await this.writeJson(
        path.join(this.storeRoot, "read-models/candidate-evaluations/items", `${candidate.candidate_id}.json`),
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
        path.join(this.storeRoot, "read-models/candidate-materialization-attempts/items", `${attempt.attempt_id}.json`),
        attempt
      );
    }

    const runtimeInstances = await this.readCollection<SandboxRuntimeInstanceRecord>(
      "sandbox-runtime-instances"
    );
    const runtimeInstanceReadModels = runtimeInstances
      .map(toSandboxRuntimeInstanceReadModel)
      .sort(compareRuntimeInstanceReadModels);
    const runtimeInstanceIndex: RuntimeInstanceIndexProjection = {
      record_kind: "runtime_instance_index_projection",
      version: 1,
      runtime_instances: runtimeInstanceReadModels
    };
    await this.writeJson(
      path.join(this.storeRoot, "read-models/runtime-instances/index.json"),
      runtimeInstanceIndex
    );
    for (const runtimeInstance of runtimeInstanceReadModels) {
      await this.writeJson(
        path.join(this.storeRoot, "read-models/runtime-instances/items", `${runtimeInstance.instance_id}.json`),
        await this.buildSandboxRuntimeInstanceDetailReadModel(runtimeInstance.instance_id)
      );
    }
  }

  async initialize(): Promise<void> {
    await this.seedFixture();
    await this.rebuildProjections();
  }

  async listCandidates(): Promise<CandidateSummaryReadModel[]> {
    const indexPath = path.join(this.storeRoot, "read-models/candidates/index.json");
    const index = await this.readJson<CandidateIndexProjection>(indexPath);
    return index.candidates;
  }

  async getCandidate(candidateId: string): Promise<CandidateInspectReadModel | undefined> {
    try {
      return await this.readJson<CandidateInspectReadModel>(
        path.join(this.storeRoot, "read-models/candidates/items", `${candidateId}.json`)
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
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

  async getRunnableArtifact(runnableArtifactId: string): Promise<RunnableArtifactRecord | undefined> {
    return this.readOptionalRecord<RunnableArtifactRecord>("runnable-artifacts", runnableArtifactId);
  }

  async recordRunnableArtifact(artifact: RunnableArtifactRecord): Promise<RunnableArtifactRecord> {
    if (!isRunnableArtifactRecord(artifact)) {
      throw new LocalStoreError(
        "invalid_runnable_artifact_input",
        "invalid runnable artifact input",
        { runnable_artifact_id: (artifact as Partial<RunnableArtifactRecord> | undefined)?.runnable_artifact_id }
      );
    }
    await this.writeJson(this.itemPath("runnable-artifacts", artifact.runnable_artifact_id), artifact);
    return artifact;
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
    runnableArtifactId: string
  ): Promise<ArtifactLineageRecord[]> {
    return (await this.listArtifactLineages()).filter(
      (lineage) =>
        lineage.child_runnable_artifact_ref.id === runnableArtifactId ||
        lineage.parent_runnable_artifact_ref?.id === runnableArtifactId
    );
  }

  async recordArtifactChangeProposal(
    proposal: ArtifactChangeProposalRecord
  ): Promise<ArtifactChangeProposalRecord> {
    if (!isArtifactChangeProposalRecord(proposal)) {
      throw new LocalStoreError(
        "invalid_artifact_change_proposal_input",
        "invalid artifact change proposal input",
        {
          artifact_change_proposal_id: (proposal as Partial<ArtifactChangeProposalRecord> | undefined)
            ?.artifact_change_proposal_id
        }
      );
    }
    await this.assertResearchFindingRefsExist(
      [...proposal.source_finding_refs, ...(proposal.anti_hacking_finding_refs ?? [])],
      proposal.artifact_change_proposal_id
    );
    await this.writeJson(
      this.itemPath("artifact-change-proposals", proposal.artifact_change_proposal_id),
      proposal
    );
    return proposal;
  }

  async listArtifactChangeProposals(): Promise<ArtifactChangeProposalRecord[]> {
    return (await this.readCollection<ArtifactChangeProposalRecord>("artifact-change-proposals"))
      .sort(compareArtifactChangeProposals);
  }

  async listArtifactChangeProposalsForFinding(researchFindingId: string): Promise<ArtifactChangeProposalRecord[]> {
    return (await this.listArtifactChangeProposals()).filter((proposal) =>
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
      const proposal = await this.readOptionalRecord<ArtifactChangeProposalRecord>(
        "artifact-change-proposals",
        run.output_artifact_proposal_ref.id
      );
      if (!proposal) {
        throw new LocalStoreError(
          "artifact_change_proposal_not_found",
          `artifact change proposal ${run.output_artifact_proposal_ref.id} not found`,
          {
            artifact_change_proposal_id: run.output_artifact_proposal_ref.id,
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

  async listArtifactChangeProposalMaterializationAttempts(): Promise<ArtifactChangeProposalMaterializationAttemptRecord[]> {
    return (await this.readCollection<ArtifactChangeProposalMaterializationAttemptRecord>(
      "artifact-change-proposal-materialization-attempts"
    )).sort(compareArtifactChangeProposalMaterializationAttempts);
  }

  async materializeArtifactChangeProposal(
    input: ArtifactChangeProposalMaterializationInput
  ): Promise<ArtifactChangeProposalMaterializationOutcome> {
    const existing = await this.findArtifactChangeProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toArtifactChangeProposalMaterializationOutcome(existing);
    }

    const validationFailure = validateArtifactChangeProposalMaterializationInput(input);
    if (validationFailure) {
      return this.recordArtifactChangeProposalMaterializationFailure(input, validationFailure);
    }

    const providerResult = input.provider_result;
    const output = providerResult.output;
    const sourceFindings: ResearchFindingRecord[] = [];
    for (const findingRef of output.source_finding_refs) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordArtifactChangeProposalMaterializationFailure(
          input,
          "artifact_change_proposal_source_finding_not_found"
        );
      }
      sourceFindings.push(finding);
    }

    for (const findingRef of output.anti_hacking_finding_refs ?? []) {
      const finding = await this.readOptionalRecord<ResearchFindingRecord>("research-findings", findingRef.id);
      if (!finding) {
        return this.recordArtifactChangeProposalMaterializationFailure(
          input,
          "artifact_change_proposal_source_finding_not_found"
        );
      }
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const suffix = stableSuffix(input.idempotency_key);
    const attemptId = `artifact-change-proposal-materialization-attempt-${suffix}`;
    const proposalRef = ref("artifact_change_proposal", `artifact-change-proposal-${suffix}`);
    const runnableArtifactRef = ref("runnable_artifact", `research-runnable-artifact-proposal-${suffix}`);
    const lineageRef = ref("artifact_lineage", `artifact-lineage-${suffix}`);
    const sourceFinding = sourceFindings[0];
    const artifactPath = input.artifact_path ?? "fixtures/trading-systems/clock.py";

    const attempt: ArtifactChangeProposalMaterializationAttemptRecord = {
      record_kind: "artifact_change_proposal_materialization_attempt",
      version: 1,
      artifact_change_proposal_materialization_attempt_id: attemptId,
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
      output_runnable_artifact_ref: runnableArtifactRef,
      output_lineage_ref: lineageRef,
      created_at: createdAt,
      authority_status: "proposal_input_only"
    };
    const proposal: ArtifactChangeProposalRecord = stripUndefined({
      record_kind: "artifact_change_proposal",
      version: 1,
      artifact_change_proposal_id: proposalRef.id,
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      trading_evaluation_task_ref: output.trading_evaluation_task_ref,
      proposed_runnable_artifact_ref: runnableArtifactRef,
      parent_runnable_artifact_ref: output.parent_runnable_artifact_ref,
      source_finding_refs: output.source_finding_refs,
      anti_hacking_finding_refs: output.anti_hacking_finding_refs,
      proposal_summary: output.proposal_summary,
      requested_change_summary: output.requested_change_summary,
      expected_improvement_summary: output.expected_improvement_summary,
      created_at: createdAt,
      status: "proposed",
      authority_status: "proposal_only"
    } satisfies ArtifactChangeProposalRecord);
    const runnableArtifact: RunnableArtifactRecord = {
      record_kind: "runnable_artifact",
      version: 1,
      runnable_artifact_id: runnableArtifactRef.id,
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
      capability_policy_ref: input.capability_policy_ref ?? ref("capability_policy", "provider-artifact-change-proposal"),
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
      child_runnable_artifact_ref: runnableArtifactRef,
      parent_runnable_artifact_ref: output.parent_runnable_artifact_ref,
      source_finding_refs: output.source_finding_refs,
      created_by_research_worker_ref: sourceFinding.research_worker_ref,
      created_at: createdAt,
      authority_status: "lineage_only"
    } satisfies ArtifactLineageRecord);

    await this.writeJson(this.itemPath("artifact-change-proposal-materialization-attempts", attemptId), attempt);
    await this.writeJson(this.itemPath("artifact-change-proposals", proposal.artifact_change_proposal_id), proposal);
    await this.writeJson(this.itemPath("runnable-artifacts", runnableArtifact.runnable_artifact_id), runnableArtifact);
    await this.writeJson(this.itemPath("artifact-lineages", lineage.artifact_lineage_id), lineage);

    return {
      status: "materialized",
      attempt,
      proposal,
      runnable_artifact: runnableArtifact,
      lineage
    };
  }

  async recordArtifactChangeProposalProviderFailure(
    input: ArtifactChangeProposalProviderFailureInput
  ): Promise<ArtifactChangeProposalMaterializationOutcome> {
    const existing = await this.findArtifactChangeProposalMaterializationAttemptByIdempotencyKey(
      input.idempotency_key
    );
    if (existing) {
      return this.toArtifactChangeProposalMaterializationOutcome(existing);
    }

    const providerResult = input.provider_result;
    const attemptId = `artifact-change-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const attempt: ArtifactChangeProposalMaterializationAttemptRecord = {
      record_kind: "artifact_change_proposal_materialization_attempt",
      version: 1,
      artifact_change_proposal_materialization_attempt_id: attemptId,
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

    await this.writeJson(this.itemPath("artifact-change-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  async listRuntimeInstances(): Promise<SandboxRuntimeInstanceReadModel[]> {
    try {
      const index = await this.readJson<RuntimeInstanceIndexProjection>(
        path.join(this.storeRoot, "read-models/runtime-instances/index.json")
      );
      return index.runtime_instances;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async getRuntimeInstance(
    instanceId: string
  ): Promise<SandboxRuntimeInstanceDetailReadModel | undefined> {
    try {
      return await this.readJson<SandboxRuntimeInstanceDetailReadModel>(
        path.join(this.storeRoot, "read-models/runtime-instances/items", `${instanceId}.json`)
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async recordRuntimeInstanceStart(
    input: RuntimeInstanceObservationInput
  ): Promise<StartRuntimeInstanceOutcome> {
    await this.assertRuntimeInstanceLinks(input.instance);
    await this.writeRuntimeInstanceObservations(input);
    await this.rebuildProjections();

    const runtimeInstance = await this.getRuntimeInstance(input.instance.sandbox_runtime_instance_id);
    if (!runtimeInstance) {
      throw new LocalStoreError(
        "runtime_instance_reload_failed",
        `runtime instance ${input.instance.sandbox_runtime_instance_id} was not reloaded after start`,
        { instance_id: input.instance.sandbox_runtime_instance_id }
      );
    }
    return { runtime_instance: runtimeInstance };
  }

  async recordRuntimeInstanceObservations(
    instanceId: string,
    observations: Omit<RuntimeInstanceObservationInput, "instance"> & {
      lifecycle_status?: SandboxRuntimeInstanceRecord["lifecycle_status"];
      last_heartbeat_at?: string;
    }
  ): Promise<RuntimeInstanceLogsOutcome> {
    const instance = await this.readOptionalRecord<SandboxRuntimeInstanceRecord>(
      "sandbox-runtime-instances",
      instanceId
    );
    if (!instance) {
      throw new LocalStoreError(
        "runtime_instance_not_found",
        `runtime instance ${instanceId} not found`,
        { instance_id: instanceId }
      );
    }

    const latestHeartbeatAt = observations.last_heartbeat_at
      ?? latestObservedAt(observations.heartbeats)
      ?? instance.last_heartbeat_at;
    const updatedInstance: SandboxRuntimeInstanceRecord = stripUndefined({
      ...instance,
      lifecycle_status: observations.lifecycle_status ?? instance.lifecycle_status,
      log_refs: appendUniqueRefs(instance.log_refs, refsForLogs(observations.logs)),
      heartbeat_refs: appendUniqueRefs(instance.heartbeat_refs, refsForHeartbeats(observations.heartbeats)),
      command_evidence_refs: appendUniqueRefs(
        instance.command_evidence_refs,
        refsForCommandEvidence(observations.command_evidence)
      ),
      last_heartbeat_at: latestHeartbeatAt
    } satisfies SandboxRuntimeInstanceRecord);

    await this.writeRuntimeInstanceObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const runtimeInstance = await this.getRuntimeInstance(instanceId);
    if (!runtimeInstance) {
      throw new LocalStoreError(
        "runtime_instance_reload_failed",
        `runtime instance ${instanceId} was not reloaded after observations`,
        { instance_id: instanceId }
      );
    }
    return {
      runtime_instance: runtimeInstance,
      logs: runtimeInstance.logs,
      heartbeats: runtimeInstance.heartbeats,
      command_evidence: runtimeInstance.command_evidence
    };
  }

  async stopRuntimeInstance(
    input: StopRuntimeInstanceInput,
    observations: Omit<RuntimeInstanceObservationInput, "instance"> = {}
  ): Promise<StartRuntimeInstanceOutcome> {
    const instance = await this.readOptionalRecord<SandboxRuntimeInstanceRecord>(
      "sandbox-runtime-instances",
      input.instance_id
    );
    if (!instance) {
      throw new LocalStoreError(
        "runtime_instance_not_found",
        `runtime instance ${input.instance_id} not found`,
        { instance_id: input.instance_id }
      );
    }

    const observedLifecycleStatus = observations.lifecycle_status;
    const lifecycleStatus = instance.lifecycle_status === "removed" || input.removed_at
      ? "removed"
      : observedLifecycleStatus ?? "stopped";
    const stoppedAt = lifecycleStatus === "stopped" || lifecycleStatus === "removed"
      ? instance.stopped_at ?? observations.stopped_at ?? input.stopped_at ?? new Date().toISOString()
      : instance.stopped_at ?? observations.stopped_at ?? input.stopped_at;
    const updatedInstance: SandboxRuntimeInstanceRecord = stripUndefined({
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
    } satisfies SandboxRuntimeInstanceRecord);

    await this.writeRuntimeInstanceObservations({
      ...observations,
      instance: updatedInstance
    });
    await this.rebuildProjections();

    const runtimeInstance = await this.getRuntimeInstance(input.instance_id);
    if (!runtimeInstance) {
      throw new LocalStoreError(
        "runtime_instance_reload_failed",
        `runtime instance ${input.instance_id} was not reloaded after stop`,
        { instance_id: input.instance_id }
      );
    }
    return { runtime_instance: runtimeInstance };
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

  async recordBoundedRuntimeAuthority(
    input: BoundedRuntimeAuthorityInput
  ): Promise<BoundedRuntimeAuthorityOutcome> {
    const validationFailure = validateBoundedRuntimeAuthorityInput(input);
    if (validationFailure) {
      throw new LocalStoreError(validationFailure, "invalid bounded runtime authority input");
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
    const runtime = await this.readOptionalRecord<TradingSystemRuntimeRecord>(
      "trading-system-runtimes",
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
      runtime.trading_system_runtime_id !== candidateVersion.runtime_ref.id ||
      (runtime.candidate_ref !== undefined && runtime.candidate_ref.id !== candidate.candidate_id) ||
      (
        runtime.candidate_version_ref !== undefined &&
        runtime.candidate_version_ref.id !== candidateVersion.candidate_version_id
      )
    ) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_system_runtime_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_system_runtime_id
        }
      );
    }

    const recordIds = boundedRuntimeAuthorityRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_system_runtime_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readBoundedRuntimeAuthorityOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_system_runtime_id,
      recordIds
    );
    if (existing) {
      return existing;
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const orderIntentRef = ref("order_intent_draft", recordIds.orderIntent);
    const gatewayDecisionRef = ref("gateway_decision", recordIds.gatewayDecision);
    const executionAttemptRef = ref("execution_attempt", recordIds.executionAttempt);
    const runtimeRef = ref("trading_system_runtime", runtime.trading_system_runtime_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const stageBindingId = runtime.stage_binding_ref?.id
      ?? `stage-binding-paper-${stableSuffix(runtime.trading_system_runtime_id)}`;
    const stageBindingRef = ref("stage_binding", stageBindingId);
    const existingStageBinding = await this.readOptionalRecord<StageBindingRecord>(
      "stage-bindings",
      stageBindingId
    );

    const orderIntent: OrderIntentDraftRecord = stripUndefined({
      record_kind: "order_intent_draft",
      version: 1,
      order_intent_draft_id: recordIds.orderIntent,
      runtime_ref: runtimeRef,
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: input.execution_attempt?.trace_ref ?? runtime.trace_ref,
      intent_kind: input.intent.intent_kind,
      market_scope: "external_trading_api_fixture",
      side: input.intent.side,
      order_type: input.intent.order_type,
      quantity: input.intent.quantity,
      limit_price: input.intent.limit_price,
      status: "proposed",
      created_at: createdAt,
      authority_status: "not_submitted"
    } satisfies OrderIntentDraftRecord);
    const gatewayDecisionAuthorityStatus = gatewayDecisionAuthorityStatusForOutcome(
      input.gateway_decision.decision_outcome
    );
    const gatewayDecision: GatewayDecisionRecord = stripUndefined({
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: recordIds.gatewayDecision,
      runtime_ref: runtimeRef,
      order_intent_draft_ref: orderIntentRef,
      decision_outcome: input.gateway_decision.decision_outcome,
      decision_reason: input.gateway_decision.decision_reason,
      decided_at: createdAt,
      policy_ref: input.gateway_decision.policy_ref,
      authority_status: gatewayDecisionAuthorityStatus
    } satisfies GatewayDecisionRecord);
    const executionAttemptStatus = input.execution_attempt?.status
      ?? executionAttemptStatusForDecision(input.gateway_decision.decision_outcome);
    const executionAttemptAuthorityStatus = executionAttemptAuthorityStatusForStatus(
      executionAttemptStatus,
      input.gateway_decision.decision_outcome
    );
    const executionAttempt: ExecutionAttemptRecord = stripUndefined({
      record_kind: "execution_attempt",
      version: 1,
      execution_attempt_id: recordIds.executionAttempt,
      runtime_ref: runtimeRef,
      order_intent_draft_ref: orderIntentRef,
      gateway_decision_ref: gatewayDecisionRef,
      stage: "paper",
      execution_mode: input.execution_attempt?.execution_mode ?? "host_local",
      venue_scope: "external_trading_api_fixture",
      trace_ref: input.execution_attempt?.trace_ref ?? runtime.trace_ref,
      status: executionAttemptStatus,
      result_reason: input.execution_attempt?.result_reason ?? input.gateway_decision.decision_reason,
      created_at: createdAt,
      completed_at: input.execution_attempt?.completed_at,
      authority_status: executionAttemptAuthorityStatus
    } satisfies ExecutionAttemptRecord);
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
          runtime_placement_ref: runtime.placement_ref,
          hands_environment_ref: runtime.hands_environment_ref,
          created_at: createdAt,
          authority_status: "not_live"
        } satisfies StageBindingRecord);
    const updatedRuntime: TradingSystemRuntimeRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: runtime.runtime_lifecycle_status ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      order_intent_draft_refs: appendUniqueRefs(runtime.order_intent_draft_refs, orderIntentRef),
      gateway_decision_refs: appendUniqueRefs(runtime.gateway_decision_refs, gatewayDecisionRef),
      execution_attempt_refs: appendUniqueRefs(runtime.execution_attempt_refs, executionAttemptRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingSystemRuntimeRecord);

    const records: FixtureItem[] = [
      ...(stageBinding
        ? [{ collection: "stage-bindings" as const, id: stageBinding.stage_binding_id, record: stageBinding }]
        : []),
      { collection: "order-intent-drafts", id: orderIntent.order_intent_draft_id, record: orderIntent },
      { collection: "gateway-decisions", id: gatewayDecision.gateway_decision_id, record: gatewayDecision },
      { collection: "execution-attempts", id: executionAttempt.execution_attempt_id, record: executionAttempt },
      { collection: "trading-system-runtimes", id: updatedRuntime.trading_system_runtime_id, record: updatedRuntime }
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.readBoundedRuntimeAuthorityOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_system_runtime_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "runtime_authority_reload_failed",
        `bounded runtime authority records were not reloaded after write`,
        { runtime_id: runtime.trading_system_runtime_id }
      );
    }
    return outcome;
  }

  async recordRuntimeControlAudit(
    input: RuntimeControlAuditInput
  ): Promise<RuntimeControlAuditOutcome> {
    const validationFailure = validateRuntimeControlAuditInput(input);
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
    const runtime = await this.readOptionalRecord<TradingSystemRuntimeRecord>(
      "trading-system-runtimes",
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
      runtime.trading_system_runtime_id !== candidateVersion.runtime_ref.id ||
      (runtime.candidate_ref !== undefined && runtime.candidate_ref.id !== candidate.candidate_id) ||
      (
        runtime.candidate_version_ref !== undefined &&
        runtime.candidate_version_ref.id !== candidateVersion.candidate_version_id
      )
    ) {
      throw new LocalStoreError(
        "runtime_mismatch",
        `runtime ${runtime.trading_system_runtime_id} is not bound to candidate version ${candidateVersion.candidate_version_id}`,
        {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidateVersion.candidate_version_id,
          candidate_version_runtime_id: candidateVersion.runtime_ref.id,
          runtime_id: runtime.trading_system_runtime_id
        }
      );
    }

    const recordIds = runtimeControlAuditRecordIds({
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidateVersion.candidate_version_id,
      runtime_id: runtime.trading_system_runtime_id,
      idempotency_key: input.idempotency_key
    });
    const existing = await this.readRuntimeControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_system_runtime_id,
      recordIds
    );
    if (existing) {
      return existing;
    }

    const createdAt = input.created_at ?? new Date().toISOString();
    const runtimeRef = ref("trading_system_runtime", runtime.trading_system_runtime_id);
    const candidateRef = ref("trading_system_candidate", candidate.candidate_id);
    const candidateVersionRef = ref("candidate_version", candidateVersion.candidate_version_id);
    const commandRef = ref("runtime_control_command", recordIds.command);
    const decisionRef = ref("runtime_control_decision", recordIds.decision);
    const auditEventRef = ref("runtime_audit_event", recordIds.auditEvent);
    const authorityStatus = runtimeControlAuthorityStatusForOutcome(
      input.decision.decision_outcome
    );
    const command: RuntimeControlCommandRecord = stripUndefined({
      record_kind: "runtime_control_command",
      version: 1,
      runtime_control_command_id: recordIds.command,
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
      related_order_intent_draft_refs: input.command.related_order_intent_draft_refs,
      related_gateway_decision_refs: input.command.related_gateway_decision_refs,
      related_execution_attempt_refs: input.command.related_execution_attempt_refs,
      requested_at: createdAt,
      status: "decided",
      authority_status: authorityStatus
    } satisfies RuntimeControlCommandRecord);
    const decision: RuntimeControlDecisionRecord = stripUndefined({
      record_kind: "runtime_control_decision",
      version: 1,
      runtime_control_decision_id: recordIds.decision,
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
      related_order_intent_draft_refs: input.decision.related_order_intent_draft_refs
        ?? input.command.related_order_intent_draft_refs,
      related_gateway_decision_refs: input.decision.related_gateway_decision_refs
        ?? input.command.related_gateway_decision_refs,
      related_execution_attempt_refs: input.decision.related_execution_attempt_refs
        ?? input.command.related_execution_attempt_refs,
      decided_at: createdAt,
      authority_status: authorityStatus
    } satisfies RuntimeControlDecisionRecord);
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
      related_order_intent_draft_refs: input.audit_event.related_order_intent_draft_refs
        ?? decision.related_order_intent_draft_refs,
      related_gateway_decision_refs: input.audit_event.related_gateway_decision_refs
        ?? decision.related_gateway_decision_refs,
      related_execution_attempt_refs: input.audit_event.related_execution_attempt_refs
        ?? decision.related_execution_attempt_refs,
      created_at: createdAt,
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord);
    const updatedRuntime: TradingSystemRuntimeRecord = stripUndefined({
      ...runtime,
      runtime_lifecycle_status: decision.resulting_lifecycle_status
        ?? runtime.runtime_lifecycle_status
        ?? "registered",
      candidate_ref: runtime.candidate_ref ?? candidateRef,
      candidate_version_ref: runtime.candidate_version_ref ?? candidateVersionRef,
      runtime_control_command_refs: appendUniqueRefs(runtime.runtime_control_command_refs, commandRef),
      runtime_control_decision_refs: appendUniqueRefs(runtime.runtime_control_decision_refs, decisionRef),
      runtime_audit_event_refs: appendUniqueRefs(runtime.runtime_audit_event_refs, auditEventRef),
      created_at: runtime.created_at ?? createdAt
    } satisfies TradingSystemRuntimeRecord);

    const records: FixtureItem[] = [
      { collection: "runtime-control-commands", id: command.runtime_control_command_id, record: command },
      { collection: "runtime-control-decisions", id: decision.runtime_control_decision_id, record: decision },
      { collection: "runtime-audit-events", id: auditEvent.runtime_audit_event_id, record: auditEvent },
      { collection: "trading-system-runtimes", id: updatedRuntime.trading_system_runtime_id, record: updatedRuntime }
    ];
    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
    await this.rebuildProjections();

    const outcome = await this.readRuntimeControlAuditOutcome(
      candidate.candidate_id,
      candidateVersion.candidate_version_id,
      runtime.trading_system_runtime_id,
      recordIds
    );
    if (!outcome) {
      throw new LocalStoreError(
        "runtime_control_reload_failed",
        `runtime control records were not reloaded after write`,
        { runtime_id: runtime.trading_system_runtime_id }
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
        path.join(this.storeRoot, "read-models/candidate-materialization-attempts/items", `${attemptId}.json`)
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
      runtime: `trading-system-runtime-${suffix}`,
      placement: `runtime-placement-${suffix}`,
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
      materialized_from_attempt_ref: attemptRef
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
      runtime_ref: ref("trading_system_runtime", idsForCandidate.runtime),
      trace_placeholder_ref: traceRef,
      evaluation_run_ref: ref("evaluation_run_record", idsForCandidate.evaluationRun),
      materialization_attempt_ref: attemptRef,
      agent_spec_ref: ref("agent_spec", idsForCandidate.agentSpec),
      agent_session_ref: ref("agent_session", idsForCandidate.agentSession),
      agent_run_ref: agentRunRef,
      agent_event_ref: ref("agent_event", input.provider.agent_event_id),
      provider_readiness_ref: providerReadinessRef,
      provider_probe_attempt_ref: ref("provider_probe_attempt", idsForCandidate.providerProbe)
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
          authority_status: "not_runnable"
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
        collection: "trading-system-runtimes",
        id: idsForCandidate.runtime,
        record: {
          record_kind: "trading_system_runtime",
          version: 1,
          trading_system_runtime_id: idsForCandidate.runtime,
          stage_binding_profile: "paper",
          runtime_lifecycle_status: "registered",
          candidate_ref: ref("trading_system_candidate", candidateId),
          candidate_version_ref: ref("candidate_version", idsForCandidate.version),
          placement_ref: ref("runtime_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          memory_surface_ref: ref("runtime_memory_surface", idsForCandidate.memorySurface),
          authority_status: "not_live"
        } satisfies TradingSystemRuntimeRecord
      },
      {
        collection: "runtime-placements",
        id: idsForCandidate.placement,
        record: {
          record_kind: "runtime_placement",
          version: 1,
          runtime_placement_id: idsForCandidate.placement,
          placement_kind: "fixture_local_placeholder",
          tooling_kind: "fixture_only",
          authority_status: "not_launched"
        } satisfies RuntimePlacementRecord
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
          runtime_placement_ref: ref("runtime_placement", idsForCandidate.placement),
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

  private async recordArtifactChangeProposalMaterializationFailure(
    input: ArtifactChangeProposalMaterializationInput,
    failureReason: ArtifactChangeProposalMaterializationFailureReason
  ): Promise<ArtifactChangeProposalMaterializationOutcome> {
    const attemptId = `artifact-change-proposal-materialization-attempt-${stableSuffix(input.idempotency_key)}`;
    const providerResult = input.provider_result;
    const attempt: ArtifactChangeProposalMaterializationAttemptRecord = {
      record_kind: "artifact_change_proposal_materialization_attempt",
      version: 1,
      artifact_change_proposal_materialization_attempt_id: attemptId,
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

    await this.writeJson(this.itemPath("artifact-change-proposal-materialization-attempts", attemptId), attempt);
    return {
      status: "failed",
      attempt
    };
  }

  private async findArtifactChangeProposalMaterializationAttemptByIdempotencyKey(
    idempotencyKey: string
  ): Promise<ArtifactChangeProposalMaterializationAttemptRecord | undefined> {
    const attempts = await this.readCollection<ArtifactChangeProposalMaterializationAttemptRecord>(
      "artifact-change-proposal-materialization-attempts"
    );
    return attempts.find((attempt) => attempt.idempotency_key === idempotencyKey);
  }

  private async toArtifactChangeProposalMaterializationOutcome(
    attempt: ArtifactChangeProposalMaterializationAttemptRecord
  ): Promise<ArtifactChangeProposalMaterializationOutcome> {
    if (attempt.status === "failed") {
      return {
        status: "failed",
        attempt
      };
    }

    if (
      !attempt.output_artifact_proposal_ref ||
      !attempt.output_runnable_artifact_ref ||
      !attempt.output_lineage_ref
    ) {
      throw new LocalStoreError(
        "artifact_change_proposal_materialization_reload_failed",
        `artifact change proposal materialization attempt ${attempt.artifact_change_proposal_materialization_attempt_id} has no output refs`,
        { attempt_id: attempt.artifact_change_proposal_materialization_attempt_id }
      );
    }

    const proposal = await this.readOptionalRecord<ArtifactChangeProposalRecord>(
      "artifact-change-proposals",
      attempt.output_artifact_proposal_ref.id
    );
    const runnableArtifact = await this.readOptionalRecord<RunnableArtifactRecord>(
      "runnable-artifacts",
      attempt.output_runnable_artifact_ref.id
    );
    const lineage = await this.readOptionalRecord<ArtifactLineageRecord>(
      "artifact-lineages",
      attempt.output_lineage_ref.id
    );
    if (!proposal || !runnableArtifact || !lineage) {
      throw new LocalStoreError(
        "artifact_change_proposal_materialization_reload_failed",
        `artifact change proposal materialization attempt ${attempt.artifact_change_proposal_materialization_attempt_id} was not reloaded`,
        { attempt_id: attempt.artifact_change_proposal_materialization_attempt_id }
      );
    }

    return {
      status: "materialized",
      attempt,
      proposal,
      runnable_artifact: runnableArtifact,
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
    const runtime = await this.readRecord<TradingSystemRuntimeRecord>(
      "trading-system-runtimes",
      version.runtime_ref.id
    );
    const placement = await this.readRecord<RuntimePlacementRecord>(
      "runtime-placements",
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

    return {
      ...this.toCandidateSummary(candidate),
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
        placement: placeholder(runtime.placement_ref, "Runtime placement", placement),
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
        bounded_authority: await this.buildReplayRuntimeAuthorityReadModel(runtime),
        runtime_control: await this.buildReplayRuntimeControlReadModel(runtime)
      },
      trading_substrate: {
        latest_order_fill_surface: await this.getLatestOrderFillSurface({
          venue: "binance_usd_m_futures",
          instrument: "BTCUSDT"
        }) ?? null,
        latest_public_market_liveness_surface: await this.getLatestPublicMarketLivenessSurface({
          venue: "binance_usd_m_futures",
          instrument: "BTCUSDT"
        }) ?? null,
        latest_private_readiness_preflight_surface: await this.getLatestPrivateReadinessPreflightSurface({
          venue: "binance_usd_m_futures",
          instrument: "BTCUSDT"
        }) ?? null
      },
      trace: placeholder(version.trace_placeholder_ref, "Trace placeholder", trace),
      evaluation,
      materialization_attempt: materializationAttempt
        ? toCandidateMaterializationAttemptReadModel(materializationAttempt)
        : undefined
    };
  }

  private async buildReplayRuntimeAuthorityReadModel(
    runtime: TradingSystemRuntimeRecord
  ): Promise<ReplayRuntimeAuthorityReadModel> {
    const runtimeId = runtime.trading_system_runtime_id;
    const orderIntents = (await this.readCollection<OrderIntentDraftRecord>("order-intent-drafts"))
      .filter((orderIntent) => orderIntent.runtime_ref.id === runtimeId)
      .sort(compareOrderIntentDrafts);
    const latestOrderIntentDraft = orderIntents.at(-1);
    if (!latestOrderIntentDraft) {
      return emptyReplayRuntimeAuthorityReadModel();
    }

    const gatewayDecisions = (await this.readCollection<GatewayDecisionRecord>("gateway-decisions"))
      .filter((gatewayDecision) => gatewayDecision.order_intent_draft_ref.id === latestOrderIntentDraft.order_intent_draft_id)
      .sort(compareGatewayDecisions);
    const latestGatewayDecision = gatewayDecisions.at(-1);
    const executionAttempts = latestGatewayDecision
      ? (await this.readCollection<ExecutionAttemptRecord>("execution-attempts"))
          .filter((executionAttempt) => (
            executionAttempt.gateway_decision_ref.id === latestGatewayDecision.gateway_decision_id
          ))
          .sort(compareExecutionAttempts)
      : [];
    const latestExecutionAttempt = executionAttempts.at(-1);

    return {
      has_activity: true,
      chain_complete: Boolean(latestGatewayDecision && latestExecutionAttempt),
      latest_order_intent_draft: toReplayRuntimeOrderIntentDraftReadModel(latestOrderIntentDraft),
      latest_gateway_decision: latestGatewayDecision
        ? toReplayRuntimeGatewayDecisionReadModel(latestGatewayDecision)
        : null,
      latest_execution_attempt: latestExecutionAttempt
        ? toReplayRuntimeExecutionAttemptReadModel(latestExecutionAttempt)
        : null,
      order_intent_draft: statusPlaceholder(
        ref(latestOrderIntentDraft.record_kind, latestOrderIntentDraft.order_intent_draft_id),
        "Order intent draft",
        latestOrderIntentDraft.status,
        latestOrderIntentDraft.authority_status
      ),
      gateway_decision: latestGatewayDecision
        ? statusPlaceholder(
            ref(latestGatewayDecision.record_kind, latestGatewayDecision.gateway_decision_id),
            "Gateway decision",
            latestGatewayDecision.decision_outcome,
            latestGatewayDecision.authority_status
          )
        : statusPlaceholder(
            ref("gateway_decision", "missing"),
            "Gateway decision",
            "missing",
            "not_live"
          ),
      execution_attempt: latestExecutionAttempt
        ? statusPlaceholder(
            ref(latestExecutionAttempt.record_kind, latestExecutionAttempt.execution_attempt_id),
            "Execution attempt",
            latestExecutionAttempt.status,
            latestExecutionAttempt.authority_status
          )
        : statusPlaceholder(
            ref("execution_attempt", "missing"),
            "Execution attempt",
            "missing",
            "not_submitted"
          )
    };
  }

  private async buildReplayRuntimeControlReadModel(
    runtime: TradingSystemRuntimeRecord
  ): Promise<ReplayRuntimeControlReadModel> {
    const runtimeId = runtime.trading_system_runtime_id;
    const commands = (await this.readCollection<RuntimeControlCommandRecord>("runtime-control-commands"))
      .filter((command) => command.runtime_ref.id === runtimeId)
      .sort(compareRuntimeControlCommands);
    const latestCommand = commands.at(-1);
    if (!latestCommand) {
      return emptyReplayRuntimeControlReadModel();
    }

    const decisions = (await this.readCollection<RuntimeControlDecisionRecord>("runtime-control-decisions"))
      .filter((decision) => decision.command_ref.id === latestCommand.runtime_control_command_id)
      .sort(compareRuntimeControlDecisions);
    const latestDecision = decisions.at(-1);
    const auditEvents = (await this.readCollection<RuntimeAuditEventRecord>("runtime-audit-events"))
      .filter((event) => (
        event.command_ref?.id === latestCommand.runtime_control_command_id ||
        (
          latestDecision !== undefined &&
          event.decision_ref?.id === latestDecision.runtime_control_decision_id
        )
      ))
      .sort(compareRuntimeAuditEvents);
    const latestAuditEvent = auditEvents.at(-1);

    return {
      has_activity: true,
      chain_complete: Boolean(latestDecision && latestAuditEvent),
      latest_command: toReplayRuntimeControlCommandReadModel(latestCommand),
      latest_decision: latestDecision
        ? toReplayRuntimeControlDecisionReadModel(latestDecision)
        : null,
      latest_audit_event: latestAuditEvent
        ? toReplayRuntimeAuditEventReadModel(latestAuditEvent)
        : null,
      command: statusPlaceholder(
        ref(latestCommand.record_kind, latestCommand.runtime_control_command_id),
        "Runtime control command",
        latestCommand.status,
        latestCommand.authority_status
      ),
      decision: latestDecision
        ? statusPlaceholder(
            ref(latestDecision.record_kind, latestDecision.runtime_control_decision_id),
            "Runtime control decision",
            latestDecision.decision_outcome,
            latestDecision.authority_status
          )
        : statusPlaceholder(
            ref("runtime_control_decision", "missing"),
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

  private async readBoundedRuntimeAuthorityOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: BoundedRuntimeAuthorityRecordIds
  ): Promise<BoundedRuntimeAuthorityOutcome | undefined> {
    const orderIntent = await this.readOptionalRecord<OrderIntentDraftRecord>(
      "order-intent-drafts",
      recordIds.orderIntent
    );
    const gatewayDecision = await this.readOptionalRecord<GatewayDecisionRecord>(
      "gateway-decisions",
      recordIds.gatewayDecision
    );
    const executionAttempt = await this.readOptionalRecord<ExecutionAttemptRecord>(
      "execution-attempts",
      recordIds.executionAttempt
    );
    if (!orderIntent || !gatewayDecision || !executionAttempt) {
      return undefined;
    }
    return {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      runtime_id: runtimeId,
      order_intent_draft: orderIntent,
      gateway_decision: gatewayDecision,
      execution_attempt: executionAttempt
    };
  }

  private async readRuntimeControlAuditOutcome(
    candidateId: string,
    candidateVersionId: string,
    runtimeId: string,
    recordIds: RuntimeControlAuditRecordIds
  ): Promise<RuntimeControlAuditOutcome | undefined> {
    const command = await this.readOptionalRecord<RuntimeControlCommandRecord>(
      "runtime-control-commands",
      recordIds.command
    );
    const decision = await this.readOptionalRecord<RuntimeControlDecisionRecord>(
      "runtime-control-decisions",
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

  private async assertRuntimeInstanceLinks(instance: SandboxRuntimeInstanceRecord): Promise<void> {
    const artifact = await this.readOptionalRecord<RunnableArtifactRecord>(
      "runnable-artifacts",
      instance.runnable_artifact_ref.id
    );
    if (!artifact) {
      throw new LocalStoreError(
        "runnable_artifact_not_found",
        `runnable artifact ${instance.runnable_artifact_ref.id} not found`,
        { runnable_artifact_id: instance.runnable_artifact_ref.id }
      );
    }

    if (instance.runtime_ref) {
      const runtime = await this.readOptionalRecord<TradingSystemRuntimeRecord>(
        "trading-system-runtimes",
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

  private async writeRuntimeInstanceObservations(
    input: RuntimeInstanceObservationInput
  ): Promise<void> {
    const records: FixtureItem[] = [
      ...(input.placement
        ? [{
            collection: "runtime-placements" as const,
            id: input.placement.runtime_placement_id,
            record: input.placement
          }]
        : []),
      { collection: "sandbox-runtime-instances", id: input.instance.sandbox_runtime_instance_id, record: input.instance },
      ...(input.logs ?? []).map((log) => ({
        collection: "runtime-instance-logs" as const,
        id: log.runtime_instance_log_id,
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
      const runtime = await this.readOptionalRecord<TradingSystemRuntimeRecord>(
        "trading-system-runtimes",
        input.instance.runtime_ref.id
      );
      if (runtime) {
        records.push({
          collection: "trading-system-runtimes",
          id: runtime.trading_system_runtime_id,
          record: stripUndefined({
            ...runtime,
            runtime_lifecycle_status: runtimeLifecycleForSandboxInstance(input.instance.lifecycle_status),
            placement_ref: input.instance.runtime_placement_ref,
            runnable_artifact_ref: input.instance.runnable_artifact_ref,
            sandbox_runtime_instance_ref: ref(
              input.instance.record_kind,
              input.instance.sandbox_runtime_instance_id
            ),
            created_at: runtime.created_at ?? input.instance.created_at
          } satisfies TradingSystemRuntimeRecord)
        });
      }
    }

    for (const item of records) {
      await this.writeJson(this.itemPath(item.collection, item.id, item.itemDir), item.record);
    }
  }

  private async buildSandboxRuntimeInstanceDetailReadModel(
    instanceId: string
  ): Promise<SandboxRuntimeInstanceDetailReadModel> {
    const instance = await this.readRecord<SandboxRuntimeInstanceRecord>(
      "sandbox-runtime-instances",
      instanceId
    );
    const logs = (await this.readCollection<RuntimeInstanceLogRecord>("runtime-instance-logs"))
      .filter((log) => log.sandbox_runtime_instance_ref.id === instanceId)
      .sort(compareRuntimeInstanceLogs)
      .map(toRuntimeInstanceLogReadModel);
    const heartbeats = (await this.readCollection<RuntimeHeartbeatRecord>("runtime-heartbeats"))
      .filter((heartbeat) => heartbeat.sandbox_runtime_instance_ref.id === instanceId)
      .sort(compareRuntimeHeartbeats)
      .map(toRuntimeInstanceHeartbeatReadModel);
    const commandEvidence = (await this.readCollection<SandboxCommandEvidenceRecord>("sandbox-command-evidence"))
      .filter((evidence) => evidence.sandbox_runtime_instance_ref?.id === instanceId)
      .sort(compareSandboxCommandEvidence)
      .map(toSandboxCommandEvidenceReadModel);

    return {
      ...toSandboxRuntimeInstanceReadModel(instance),
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
    return path.join(this.storeRoot, collection, itemDir, `${id}.json`);
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

function emptyReplayRuntimeAuthorityReadModel(): ReplayRuntimeAuthorityReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    latest_order_intent_draft: null,
    latest_gateway_decision: null,
    latest_execution_attempt: null,
    order_intent_draft: statusPlaceholder(
      ref("order_intent_draft", "none"),
      "Order intent draft",
      "not_submitted",
      "not_submitted"
    ),
    gateway_decision: statusPlaceholder(
      ref("gateway_decision", "none"),
      "Gateway decision",
      "not_evaluated",
      "not_live"
    ),
    execution_attempt: statusPlaceholder(
      ref("execution_attempt", "none"),
      "Execution attempt",
      "not_submitted",
      "not_submitted"
    )
  };
}

function emptyReplayRuntimeControlReadModel(): ReplayRuntimeControlReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    latest_command: null,
    latest_decision: null,
    latest_audit_event: null,
    command: statusPlaceholder(
      ref("runtime_control_command", "none"),
      "Runtime control command",
      "pending_decision",
      "not_live"
    ),
    decision: statusPlaceholder(
      ref("runtime_control_decision", "none"),
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

function toReplayRuntimeOrderIntentDraftReadModel(orderIntent: OrderIntentDraftRecord) {
  return {
    order_intent_draft_id: orderIntent.order_intent_draft_id,
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

function toReplayRuntimeGatewayDecisionReadModel(gatewayDecision: GatewayDecisionRecord) {
  return {
    gateway_decision_id: gatewayDecision.gateway_decision_id,
    order_intent_draft_ref: gatewayDecision.order_intent_draft_ref,
    decision_outcome: gatewayDecision.decision_outcome,
    decision_reason: gatewayDecision.decision_reason,
    decided_at: gatewayDecision.decided_at,
    authority_status: gatewayDecision.authority_status
  };
}

function toReplayRuntimeExecutionAttemptReadModel(executionAttempt: ExecutionAttemptRecord) {
  return {
    execution_attempt_id: executionAttempt.execution_attempt_id,
    order_intent_draft_ref: executionAttempt.order_intent_draft_ref,
    gateway_decision_ref: executionAttempt.gateway_decision_ref,
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

function toOrderFillSurfaceReadModel(surface: OrderFillSurfaceRecord): OrderFillSurfaceReadModel {
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

function toPublicMarketLivenessSurfaceReadModel(
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

function toPrivateReadinessPreflightSurfaceReadModel(
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

function formatSubstrateNoAuthority(noAuthority: OrderFillSurfaceRecord["no_authority"]): string {
  return [
    `live_exchange=${noAuthority.live_exchange}`,
    `order_submission=${noAuthority.order_submission}`,
    `credentials=${noAuthority.credentials}`
  ].join(", ");
}

function toReplayRuntimeControlCommandReadModel(command: RuntimeControlCommandRecord) {
  return {
    command_id: command.runtime_control_command_id,
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

function toReplayRuntimeControlDecisionReadModel(decision: RuntimeControlDecisionRecord) {
  return {
    decision_id: decision.runtime_control_decision_id,
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

function toReplayRuntimeAuditEventReadModel(auditEvent: RuntimeAuditEventRecord) {
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

function toSandboxRuntimeInstanceReadModel(
  instance: SandboxRuntimeInstanceRecord
): SandboxRuntimeInstanceReadModel {
  return {
    instance_id: instance.sandbox_runtime_instance_id,
    adapter_kind: instance.adapter_kind,
    runnable_artifact_ref: instance.runnable_artifact_ref,
    runtime_ref: instance.runtime_ref,
    runtime_placement_ref: instance.runtime_placement_ref,
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

function toRuntimeInstanceLogReadModel(log: RuntimeInstanceLogRecord): RuntimeInstanceLogReadModel {
  return {
    log_ref: ref(log.record_kind, log.runtime_instance_log_id),
    lines: log.lines,
    captured_at: log.captured_at,
    authority_status: log.authority_status
  };
}

function toRuntimeInstanceHeartbeatReadModel(
  heartbeat: RuntimeHeartbeatRecord
): RuntimeInstanceHeartbeatReadModel {
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

function refsForLogs(logs: RuntimeInstanceLogRecord[] | undefined): Ref[] {
  return (logs ?? []).map((log) => ref(log.record_kind, log.runtime_instance_log_id));
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
  lifecycleStatus: SandboxRuntimeInstanceRecord["lifecycle_status"]
): TradingSystemRuntimeLifecycleStatus {
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

function compareRuntimeInstanceReadModels(
  a: SandboxRuntimeInstanceReadModel,
  b: SandboxRuntimeInstanceReadModel
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  return timeCompare === 0 ? a.instance_id.localeCompare(b.instance_id) : timeCompare;
}

function compareRuntimeInstanceLogs(a: RuntimeInstanceLogRecord, b: RuntimeInstanceLogRecord): number {
  const timeCompare = a.captured_at.localeCompare(b.captured_at);
  return timeCompare === 0
    ? a.runtime_instance_log_id.localeCompare(b.runtime_instance_log_id)
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

function compareOrderIntentDrafts(a: OrderIntentDraftRecord, b: OrderIntentDraftRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.order_intent_draft_id.localeCompare(b.order_intent_draft_id);
}

function compareGatewayDecisions(a: GatewayDecisionRecord, b: GatewayDecisionRecord): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.gateway_decision_id.localeCompare(b.gateway_decision_id);
}

function compareExecutionAttempts(a: ExecutionAttemptRecord, b: ExecutionAttemptRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.execution_attempt_id.localeCompare(b.execution_attempt_id);
}

function compareOrderFillSurfaces(a: OrderFillSurfaceRecord, b: OrderFillSurfaceRecord): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.order_fill_surface_id.localeCompare(b.order_fill_surface_id);
}

function comparePublicMarketLivenessSurfaces(
  a: PublicMarketLivenessSurfaceRecord,
  b: PublicMarketLivenessSurfaceRecord
): number {
  const timeCompare = a.updated_at.localeCompare(b.updated_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.public_market_liveness_surface_id.localeCompare(b.public_market_liveness_surface_id);
}

function comparePrivateReadinessPreflightSurfaces(
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

function compareRuntimeControlCommands(
  a: RuntimeControlCommandRecord,
  b: RuntimeControlCommandRecord
): number {
  const timeCompare = a.requested_at.localeCompare(b.requested_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.runtime_control_command_id.localeCompare(b.runtime_control_command_id);
}

function compareRuntimeControlDecisions(
  a: RuntimeControlDecisionRecord,
  b: RuntimeControlDecisionRecord
): number {
  const timeCompare = a.decided_at.localeCompare(b.decided_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.runtime_control_decision_id.localeCompare(b.runtime_control_decision_id);
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

function compareResearchFindings(a: ResearchFindingRecord, b: ResearchFindingRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_finding_id.localeCompare(b.research_finding_id);
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

function compareArtifactChangeProposals(
  a: ArtifactChangeProposalRecord,
  b: ArtifactChangeProposalRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.artifact_change_proposal_id.localeCompare(b.artifact_change_proposal_id);
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

function compareArtifactChangeProposalMaterializationAttempts(
  a: ArtifactChangeProposalMaterializationAttemptRecord,
  b: ArtifactChangeProposalMaterializationAttemptRecord
): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.artifact_change_proposal_materialization_attempt_id.localeCompare(
    b.artifact_change_proposal_materialization_attempt_id
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

function validateBoundedRuntimeAuthorityInput(
  input: BoundedRuntimeAuthorityInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_runtime_authority_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id))
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    !raw.intent ||
    !isOrderIntentDraftKind(raw.intent.intent_kind) ||
    (raw.intent.side !== undefined && raw.intent.side !== "buy" && raw.intent.side !== "sell") ||
    (
      raw.intent.order_type !== undefined &&
      raw.intent.order_type !== "market" &&
      raw.intent.order_type !== "limit"
    ) ||
    (raw.intent.quantity !== undefined && !nonEmpty(raw.intent.quantity)) ||
    (raw.intent.limit_price !== undefined && !nonEmpty(raw.intent.limit_price))
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    !raw.gateway_decision ||
    !isGatewayDecisionOutcome(raw.gateway_decision.decision_outcome) ||
    !isGatewayDecisionReason(raw.gateway_decision.decision_reason) ||
    (
      raw.gateway_decision.policy_ref !== undefined &&
      !isRef(raw.gateway_decision.policy_ref)
    )
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    raw.execution_attempt?.execution_mode !== undefined &&
    !isEvaluationExecutionMode(raw.execution_attempt.execution_mode)
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    raw.execution_attempt?.status !== undefined &&
    !isExecutionAttemptStatus(raw.execution_attempt.status)
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    raw.execution_attempt?.result_reason !== undefined &&
    !isGatewayDecisionReason(raw.execution_attempt.result_reason)
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    raw.execution_attempt?.trace_ref !== undefined &&
    !isRef(raw.execution_attempt.trace_ref, "trace_placeholder")
  ) {
    return "invalid_runtime_authority_input";
  }
  if (
    (raw.execution_attempt?.completed_at !== undefined && !nonEmpty(raw.execution_attempt.completed_at)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_runtime_authority_input";
  }

  return undefined;
}

function validateRuntimeControlAuditInput(
  input: RuntimeControlAuditInput
): LocalStoreErrorCode | undefined {
  if (!input || typeof input !== "object") {
    return "invalid_runtime_control_input";
  }

  const raw = input;
  if (
    !nonEmpty(raw.idempotency_key) ||
    !nonEmpty(raw.candidate_id) ||
    (raw.candidate_version_id !== undefined && !nonEmpty(raw.candidate_version_id)) ||
    (raw.runtime_id !== undefined && !nonEmpty(raw.runtime_id)) ||
    (raw.created_at !== undefined && !nonEmpty(raw.created_at))
  ) {
    return "invalid_runtime_control_input";
  }

  if (
    !raw.command ||
    !isRuntimeControlAction(raw.command.action) ||
    !isRuntimeControlActorKind(raw.command.actor_kind) ||
    !isRuntimeControlCommandReason(raw.command.reason) ||
    (
      raw.command.requested_lifecycle_status !== undefined &&
      !isTradingSystemRuntimeLifecycleStatus(raw.command.requested_lifecycle_status)
    ) ||
    (raw.command.actor_ref !== undefined && !isRef(raw.command.actor_ref)) ||
    (
      raw.command.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.command.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (raw.command.reason_summary !== undefined && !nonEmpty(raw.command.reason_summary)) ||
    (raw.command.trace_ref !== undefined && !isRef(raw.command.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.command.related_order_intent_draft_refs) ||
    !isOptionalRefArray(raw.command.related_gateway_decision_refs) ||
    !isOptionalRefArray(raw.command.related_execution_attempt_refs)
  ) {
    return "invalid_runtime_control_input";
  }

  if (
    !raw.decision ||
    !isRuntimeControlDecisionOutcome(raw.decision.decision_outcome) ||
    !isRuntimeControlDecisionReason(raw.decision.decision_reason) ||
    !isRuntimeControlActorKind(raw.decision.decided_by_actor_kind) ||
    (raw.decision.decided_by_actor_ref !== undefined && !isRef(raw.decision.decided_by_actor_ref)) ||
    (
      raw.decision.runtime_operating_policy_ref !== undefined &&
      !isRef(raw.decision.runtime_operating_policy_ref, "runtime_operating_policy")
    ) ||
    (
      raw.decision.resulting_lifecycle_status !== undefined &&
      !isTradingSystemRuntimeLifecycleStatus(raw.decision.resulting_lifecycle_status)
    ) ||
    (raw.decision.trace_ref !== undefined && !isRef(raw.decision.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.decision.related_order_intent_draft_refs) ||
    !isOptionalRefArray(raw.decision.related_gateway_decision_refs) ||
    !isOptionalRefArray(raw.decision.related_execution_attempt_refs)
  ) {
    return "invalid_runtime_control_input";
  }

  if (
    !raw.audit_event ||
    !isRuntimeAuditEventKind(raw.audit_event.event_kind) ||
    (
      raw.audit_event.actor_kind !== undefined &&
      !isRuntimeControlActorKind(raw.audit_event.actor_kind)
    ) ||
    (raw.audit_event.actor_ref !== undefined && !isRef(raw.audit_event.actor_ref)) ||
    (
      raw.audit_event.runtime_lifecycle_status !== undefined &&
      !isTradingSystemRuntimeLifecycleStatus(raw.audit_event.runtime_lifecycle_status)
    ) ||
    (raw.audit_event.message !== undefined && !nonEmpty(raw.audit_event.message)) ||
    (raw.audit_event.trace_ref !== undefined && !isRef(raw.audit_event.trace_ref, "trace_placeholder")) ||
    !isOptionalRefArray(raw.audit_event.supporting_record_refs) ||
    !isOptionalRefArray(raw.audit_event.related_order_intent_draft_refs) ||
    !isOptionalRefArray(raw.audit_event.related_gateway_decision_refs) ||
    !isOptionalRefArray(raw.audit_event.related_execution_attempt_refs)
  ) {
    return "invalid_runtime_control_input";
  }

  return undefined;
}

function isEvidenceDisposition(value: unknown): value is EvidenceDisposition {
  return value === "not_counted" || value === "counted" || value === "quarantined_for_review";
}

function isEvidenceDispositionReason(value: unknown): value is EvidenceDispositionReason {
  return typeof value === "string" && evidenceDispositionReasons.has(value as EvidenceDispositionReason);
}

function isOrderIntentDraftKind(value: unknown): boolean {
  return value === "place_order" || value === "cancel_order" || value === "adjust_position";
}

function isGatewayDecisionOutcome(value: unknown): value is GatewayDecisionOutcome {
  return value === "allowed" || value === "rejected" || value === "clipped" || value === "dry_run_only";
}

function isGatewayDecisionReason(value: unknown): value is GatewayDecisionReason {
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

function isExecutionAttemptStatus(value: unknown): value is ExecutionAttemptStatus {
  return (
    value === "not_submitted" ||
    value === "dry_run_recorded" ||
    value === "blocked" ||
    value === "canceled" ||
    value === "failed"
  );
}

function isRuntimeControlAction(value: unknown): value is RuntimeControlAction {
  return (
    value === "inspect" ||
    value === "pause" ||
    value === "resume" ||
    value === "stop" ||
    value === "override" ||
    value === "kill" ||
    value === "handoff" ||
    value === "audit"
  );
}

function isRuntimeControlActorKind(value: unknown): value is RuntimeControlActorKind {
  return (
    value === "human_operator" ||
    value === "policy_engine" ||
    value === "external_handoff" ||
    value === "fixture_operator"
  );
}

function isRuntimeControlCommandReason(value: unknown): value is RuntimeControlCommandReason {
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

function isRuntimeControlDecisionOutcome(value: unknown): value is RuntimeControlDecisionOutcome {
  return (
    value === "allowed" ||
    value === "rejected" ||
    value === "dry_run_only" ||
    value === "no_live_authority"
  );
}

function isRuntimeControlDecisionReason(value: unknown): value is RuntimeControlDecisionReason {
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

function isTradingSystemRuntimeLifecycleStatus(
  value: unknown
): value is TradingSystemRuntimeLifecycleStatus {
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

function matchesOrderFillSurfaceQuery(
  surface: OrderFillSurfaceRecord,
  query: OrderFillSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

function matchesPublicMarketLivenessSurfaceQuery(
  surface: PublicMarketLivenessSurfaceRecord,
  query: PublicMarketLivenessSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

function matchesPrivateReadinessPreflightSurfaceQuery(
  surface: PrivateReadinessPreflightSurfaceRecord,
  query: PrivateReadinessPreflightSurfaceQueryInput
): boolean {
  return (
    (query.venue === undefined || surface.venue === query.venue) &&
    (query.instrument === undefined || surface.instrument === query.instrument)
  );
}

function isOrderFillSurfaceRecord(value: unknown): value is OrderFillSurfaceRecord {
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

function isPublicMarketLivenessSurfaceRecord(
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

function isPrivateReadinessPreflightSurfaceRecord(
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

function isPrivateReadinessPreflightGate(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<PrivateReadinessPreflightSurfaceRecord["credential_gate"]>;
  return (
    (raw.status === "not_configured" ||
      raw.status === "not_evaluated" ||
      raw.status === "not_approved" ||
      raw.status === "disabled") &&
    raw.enabled === false &&
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
    value === "fixture"
  );
}

function isRunnableArtifactRecord(value: unknown): value is RunnableArtifactRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<RunnableArtifactRecord>;
  return (
    raw.record_kind === "runnable_artifact" &&
    raw.version === 1 &&
    nonEmpty(raw.runnable_artifact_id) &&
    (raw.artifact_kind === "python_file" || raw.artifact_kind === "container_image") &&
    nonEmpty(raw.artifact_digest) &&
    (raw.artifact_ref === undefined || isRef(raw.artifact_ref)) &&
    (raw.artifact_runtime_contract_ref === undefined ||
      isRef(raw.artifact_runtime_contract_ref, "artifact_runtime_contract")) &&
    isRunnableArtifactRuntimeKind(raw.runtime_kind) &&
    Array.isArray(raw.entrypoint) &&
    raw.entrypoint.length > 0 &&
    raw.entrypoint.every((item) => nonEmpty(item)) &&
    isRunnableArtifactOutputContract(raw.declared_output_contract) &&
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

function isArtifactLineageRecord(value: unknown): value is ArtifactLineageRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ArtifactLineageRecord>;
  return (
    raw.record_kind === "artifact_lineage" &&
    raw.version === 1 &&
    nonEmpty(raw.artifact_lineage_id) &&
    isRef(raw.child_runnable_artifact_ref, "runnable_artifact") &&
    (raw.parent_runnable_artifact_ref === undefined ||
      isRef(raw.parent_runnable_artifact_ref, "runnable_artifact")) &&
    Array.isArray(raw.source_finding_refs) &&
    raw.source_finding_refs.length > 0 &&
    raw.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
    (raw.created_by_research_worker_ref === undefined ||
      isRef(raw.created_by_research_worker_ref, "research_worker")) &&
    nonEmpty(raw.created_at) &&
    raw.authority_status === "lineage_only"
  );
}

function isArtifactChangeProposalRecord(value: unknown): value is ArtifactChangeProposalRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const raw = value as Partial<ArtifactChangeProposalRecord>;
  return (
    raw.record_kind === "artifact_change_proposal" &&
    raw.version === 1 &&
    nonEmpty(raw.artifact_change_proposal_id) &&
    isRef(raw.research_worker_ref, "research_worker") &&
    isRef(raw.research_direction_ref, "research_direction") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    isRef(raw.proposed_runnable_artifact_ref, "runnable_artifact") &&
    (raw.parent_runnable_artifact_ref === undefined ||
      isRef(raw.parent_runnable_artifact_ref, "runnable_artifact")) &&
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
    isArtifactChangeProposalStatus(raw.status) &&
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
      isRef(raw.output_artifact_proposal_ref, "artifact_change_proposal")) &&
    (raw.output_runnable_artifact_ref === undefined ||
      isRef(raw.output_runnable_artifact_ref, "runnable_artifact")) &&
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
    isRef(raw.runnable_artifact_ref, "runnable_artifact") &&
    isRef(raw.trading_evaluation_task_ref, "trading_evaluation_task") &&
    (
      raw.sandbox_runtime_instance_ref === undefined ||
      isRef(raw.sandbox_runtime_instance_ref, "sandbox_runtime_instance")
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

function isArtifactChangeProposalStatus(value: unknown): boolean {
  return value === "proposed" || value === "materialized" || value === "discarded";
}

function isResearchOrchestrationRunStatus(value: unknown): boolean {
  return value === "started" || value === "proposed" || value === "failed" || value === "discarded";
}

function isExperimentRunStatus(value: unknown): boolean {
  return value === "submitted" || value === "evaluated" || value === "failed" || value === "discarded";
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

function isRunnableArtifactRuntimeKind(value: unknown): boolean {
  return value === "python" || value === "container_image";
}

function isRunnableArtifactOutputContract(value: unknown): boolean {
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
    raw.declared_output_kinds.every((item) => isRunnableArtifactOutputKind(item)) &&
    (raw.event_envelope_ref === undefined || isRef(raw.event_envelope_ref)) &&
    (raw.log_contract_ref === undefined || isRef(raw.log_contract_ref)) &&
    (raw.heartbeat_contract_ref === undefined || isRef(raw.heartbeat_contract_ref))
  );
}

function isRunnableArtifactOutputKind(value: unknown): boolean {
  return (
    value === "program_event" ||
    value === "runtime_log" ||
    value === "runtime_heartbeat" ||
    value === "metric_snapshot" ||
    value === "diagnostic_artifact" ||
    value === "order_intent_draft"
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

interface BoundedRuntimeAuthorityRecordIds {
  orderIntent: string;
  gatewayDecision: string;
  executionAttempt: string;
}

function boundedRuntimeAuthorityRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): BoundedRuntimeAuthorityRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    orderIntent: `order-intent-draft-${suffix}`,
    gatewayDecision: `gateway-decision-${suffix}`,
    executionAttempt: `execution-attempt-${suffix}`
  };
}

interface RuntimeControlAuditRecordIds {
  command: string;
  decision: string;
  auditEvent: string;
}

function runtimeControlAuditRecordIds(input: {
  candidate_id: string;
  candidate_version_id: string;
  runtime_id: string;
  idempotency_key: string;
}): RuntimeControlAuditRecordIds {
  const suffix = stableSuffix([
    input.candidate_id,
    input.candidate_version_id,
    input.runtime_id,
    input.idempotency_key
  ].join(":"));
  return {
    command: `runtime-control-command-${suffix}`,
    decision: `runtime-control-decision-${suffix}`,
    auditEvent: `runtime-audit-event-${suffix}`
  };
}

function runtimeControlAuthorityStatusForOutcome(
  outcome: RuntimeControlDecisionOutcome
): RuntimeControlAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  if (outcome === "no_live_authority") {
    return "not_live";
  }
  return "control_only";
}

function gatewayDecisionAuthorityStatusForOutcome(
  outcome: GatewayDecisionOutcome
): GatewayDecisionAuthorityStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_only";
  }
  return "not_live";
}

function executionAttemptStatusForDecision(outcome: GatewayDecisionOutcome): ExecutionAttemptStatus {
  if (outcome === "dry_run_only") {
    return "dry_run_recorded";
  }
  if (outcome === "rejected") {
    return "blocked";
  }
  return "not_submitted";
}

function executionAttemptAuthorityStatusForStatus(
  status: ExecutionAttemptStatus,
  outcome: GatewayDecisionOutcome
): ExecutionAttemptAuthorityStatus {
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

function validateArtifactChangeProposalMaterializationInput(
  input: ArtifactChangeProposalMaterializationInput
): ArtifactChangeProposalMaterializationFailureReason | undefined {
  if (!input || typeof input !== "object") {
    return "provider_output_schema_invalid";
  }

  const raw = input as Partial<ArtifactChangeProposalMaterializationInput>;
  const result = raw.provider_result as
    | Partial<ArtifactChangeProposalMaterializationInput["provider_result"]>
    | undefined;
  const provider = (result?.provider ?? {}) as Partial<ArtifactChangeProposalProviderAttribution>;
  const output = (result?.output ?? {}) as Partial<ArtifactChangeProposalProviderOutput>;

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
    output.output_kind !== "artifact_change_proposal_input" ||
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
      output.parent_runnable_artifact_ref !== undefined &&
      !isRef(output.parent_runnable_artifact_ref, "runnable_artifact")
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

  if (containsForbiddenArtifactChangeProposalProviderOutputKey(result)) {
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

  if (
    candidate.first_market_scope !== "external_trading_api_fixture" ||
    spec.market !== "ExternalTradingApiProvider" ||
    spec.instrument !== "generic trading instruments" ||
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

function containsForbiddenArtifactChangeProposalProviderOutputKey(value: unknown): boolean {
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
    return value.some(containsForbiddenArtifactChangeProposalProviderOutputKey);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const normalized = key.toLowerCase();
      return forbiddenKeys.has(normalized) || containsForbiddenArtifactChangeProposalProviderOutputKey(child);
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
