import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type {
  AgentEventRecord,
  AgentRunRecord,
  AgentSessionRecord,
  AgentSpecRecord,
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
  HandsEnvironmentRecord,
  PlaceholderSummary,
  ProgramManifestRecord,
  ProgramValidationRecord,
  ProviderProbeAttemptRecord,
  ProviderReadinessRecord,
  Ref,
  RuntimeMemorySurfaceRecord,
  RuntimePlacementRecord,
  StageBindingRecord,
  TracePlaceholderRecord,
  TraderSystemCandidateRecord,
  TraderSystemProgramRecord,
  TraderSystemRuntimeRecord,
  TraderSystemSpecRecord
} from "@ouroboros/domain";

export const DEFAULT_STORE_ROOT = ".ouroboros/dev-store";
export const FIXTURE_CANDIDATE_ID = "fixture-candidate-btc-perp-001";

export type LocalStoreErrorCode =
  | "invalid_evaluation_input"
  | "candidate_not_found"
  | "candidate_version_not_found"
  | "candidate_version_mismatch"
  | "unsupported_evaluation_stage"
  | "evaluation_run_incomplete"
  | "evaluation_run_not_found"
  | "evaluation_run_reload_failed"
  | "invalid_evidence_sealing_input";

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
  | "candidates"
  | "candidate-materialization-attempts"
  | "candidate-versions"
  | "trader-system-specs"
  | "trader-system-programs"
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
  | "trader-system-runtimes"
  | "runtime-placements"
  | "hands-environments"
  | "runtime-memory-surfaces"
  | "stage-bindings"
  | "traces"
  | "evaluation-runs"
  | "evaluation-comparison-sets"
  | "evidence-sealing-decisions"
  | "evidence-classifications";

interface FixtureItem {
  collection: Collection;
  id: string;
  record: FixtureRecord;
  itemDir?: "items" | "placeholders";
}

const fixtureNotice: FixtureNotice = {
  mode: "fixture_convenience_mode",
  label: "Fixture / convenience mode",
  statements: [
    "No provider has run.",
    "No trader-system program has executed.",
    "No package has been scanned, granted, or mounted for real.",
    "No evaluator has run and no evidence has counted.",
    "No promotion, live gate, marketplace, or runtime action authority exists."
  ]
};

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const ids = {
  candidate: FIXTURE_CANDIDATE_ID,
  version: "fixture-candidate-version-001",
  spec: "fixture-trader-system-spec-btc-perp-001",
  program: "fixture-trader-system-program-001",
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
  runtime: "fixture-trader-system-runtime-001",
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
  evidenceClassificationSealedDecision: "fixture-evidence-classification-sealed-decision-001"
};

const fixtureEvaluationCreatedAt = "2026-05-05T00:00:00.000Z";

export function createFixtureRecords(): FixtureItem[] {
  const candidate: TraderSystemCandidateRecord = {
    record_kind: "trader_system_candidate",
    version: 1,
    candidate_id: ids.candidate,
    display_name: "Fixture BTC perpetual trader-system candidate",
    status: "fixture_only",
    active_version_id: ids.version,
    provenance_refs: [
      ref("agent_run", ids.agentRun),
      ref("provider_readiness_record", ids.providerReadiness)
    ]
  };
  const candidateVersion: CandidateVersionRecord = {
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: ids.version,
    candidate_id: ids.candidate,
    version_label: "fixture-v1",
    spec_ref: ref("trader_system_spec", ids.spec),
    program_ref: ref("trader_system_program", ids.program),
    capability_package_refs: [ref("capability_package", ids.capabilityPackage)],
    runtime_ref: ref("trader_system_runtime", ids.runtime),
    trace_placeholder_ref: ref("trace_placeholder", ids.trace),
    evaluation_run_ref: ref("evaluation_run_record", ids.evaluationRun)
  };
  const spec: TraderSystemSpecRecord = {
    record_kind: "trader_system_spec",
    version: 1,
    trader_system_spec_id: ids.spec,
    summary: "BTC perpetual futures trader-system fixture spec for inspect-only bootstrap.",
    market: "Binance",
    instrument: "BTC perpetual futures",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  };
  const program: TraderSystemProgramRecord = {
    record_kind: "trader_system_program",
    version: 1,
    trader_system_program_id: ids.program,
    summary: "Agent-authored program placeholder; no code has executed.",
    manifest_ref: ref("program_manifest", ids.programManifest),
    validation_record_ref: ref("program_validation_record", ids.programValidation)
  };
  const programManifest: ProgramManifestRecord = {
    record_kind: "program_manifest",
    version: 1,
    program_manifest_id: ids.programManifest,
    declared_runtime: "fixture-sandbox-placeholder",
    declared_outputs: ["OrderIntent placeholder", "Trace placeholder"]
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
  const runtime: TraderSystemRuntimeRecord = {
    record_kind: "trader_system_runtime",
    version: 1,
    trader_system_runtime_id: ids.runtime,
    stage_binding_profile: "paper",
    placement_ref: ref("runtime_placement", ids.placement),
    hands_environment_ref: ref("hands_environment", ids.handsEnvironment),
    memory_surface_ref: ref("runtime_memory_surface", ids.memorySurface),
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
    candidate_ref: ref("trader_system_candidate", ids.candidate),
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
    candidate_ref: ref("trader_system_candidate", ids.candidate),
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
    candidate_ref: ref("trader_system_candidate", ids.candidate),
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
      candidate_ref: ref("trader_system_candidate", ids.candidate),
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
      candidate_ref: ref("trader_system_candidate", ids.candidate),
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
      candidate_ref: ref("trader_system_candidate", ids.candidate),
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
      candidate_ref: ref("trader_system_candidate", ids.candidate),
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
    { collection: "candidates", id: ids.candidate, record: candidate },
    { collection: "candidate-versions", id: ids.version, record: candidateVersion },
    { collection: "trader-system-specs", id: ids.spec, record: spec },
    { collection: "trader-system-programs", id: ids.program, record: program },
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
    { collection: "trader-system-runtimes", id: ids.runtime, record: runtime },
    { collection: "runtime-placements", id: ids.placement, record: placement },
    { collection: "hands-environments", id: ids.handsEnvironment, record: handsEnvironment },
    { collection: "runtime-memory-surfaces", id: ids.memorySurface, record: memorySurface },
    { collection: "traces", id: ids.trace, record: trace, itemDir: "placeholders" },
    { collection: "stage-bindings", id: ids.stageBinding, record: stageBinding },
    { collection: "evaluation-runs", id: ids.evaluationRun, record: evaluationRun },
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
    const candidates = await this.readCollection<TraderSystemCandidateRecord>("candidates");
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

  async listCandidateEvaluationRuns(candidateId: string): Promise<CandidateEvaluationRunOutcome[]> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const candidateRuns = evaluationRuns
      .filter((run) => run.candidate_ref.id === candidateId)
      .sort(compareEvaluationRuns);

    return Promise.all(
      candidateRuns.map((evaluationRun) => this.toCandidateEvaluationRunOutcome(evaluationRun))
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

    const candidate = await this.readOptionalRecord<TraderSystemCandidateRecord>(
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
      candidate_ref: ref("trader_system_candidate", candidate.candidate_id),
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
      candidate_ref: ref("trader_system_candidate", candidate.candidate_id),
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
      candidate_ref: ref("trader_system_candidate", candidate.candidate_id),
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
      spec: `trader-system-spec-${suffix}`,
      program: `trader-system-program-${suffix}`,
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
      runtime: `trader-system-runtime-${suffix}`,
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
      resulting_candidate_ref: ref("trader_system_candidate", candidateId),
      artifact_refs: input.artifact_refs,
      created_at: new Date().toISOString()
    };

    const candidate: TraderSystemCandidateRecord = {
      record_kind: "trader_system_candidate",
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
      spec_ref: ref("trader_system_spec", idsForCandidate.spec),
      program_ref: ref("trader_system_program", idsForCandidate.program),
      capability_package_refs: [ref("capability_package", idsForCandidate.capabilityPackage)],
      runtime_ref: ref("trader_system_runtime", idsForCandidate.runtime),
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
      candidateRef: ref("trader_system_candidate", candidateId),
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
        collection: "trader-system-specs",
        id: idsForCandidate.spec,
        record: {
          record_kind: "trader_system_spec",
          version: 1,
          trader_system_spec_id: idsForCandidate.spec,
          summary: input.spec.summary,
          market: input.spec.market,
          instrument: input.spec.instrument,
          supported_stage_binding_profiles: input.spec.supported_stage_binding_profiles
        } satisfies TraderSystemSpecRecord
      },
      {
        collection: "trader-system-programs",
        id: idsForCandidate.program,
        record: {
          record_kind: "trader_system_program",
          version: 1,
          trader_system_program_id: idsForCandidate.program,
          summary: input.program.summary,
          manifest_ref: ref("program_manifest", idsForCandidate.programManifest),
          validation_record_ref: ref("program_validation_record", idsForCandidate.programValidation)
        } satisfies TraderSystemProgramRecord
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
        collection: "trader-system-runtimes",
        id: idsForCandidate.runtime,
        record: {
          record_kind: "trader_system_runtime",
          version: 1,
          trader_system_runtime_id: idsForCandidate.runtime,
          stage_binding_profile: "paper",
          placement_ref: ref("runtime_placement", idsForCandidate.placement),
          hands_environment_ref: ref("hands_environment", idsForCandidate.handsEnvironment),
          memory_surface_ref: ref("runtime_memory_surface", idsForCandidate.memorySurface),
          authority_status: "not_live"
        } satisfies TraderSystemRuntimeRecord
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
          candidate_ref: ref("trader_system_candidate", candidateId),
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
          candidate_ref: ref("trader_system_candidate", candidateId),
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
          candidate_ref: ref("trader_system_candidate", candidateId),
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
    const candidate = await this.readRecord<TraderSystemCandidateRecord>("candidates", candidateId);
    const version = await this.readRecord<CandidateVersionRecord>(
      "candidate-versions",
      candidate.active_version_id
    );
    const spec = await this.readRecord<TraderSystemSpecRecord>("trader-system-specs", version.spec_ref.id);
    const program = await this.readRecord<TraderSystemProgramRecord>(
      "trader-system-programs",
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
    const runtime = await this.readRecord<TraderSystemRuntimeRecord>(
      "trader-system-runtimes",
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
        }
      },
      trace: placeholder(version.trace_placeholder_ref, "Trace placeholder", trace),
      evaluation,
      materialization_attempt: materializationAttempt
        ? toCandidateMaterializationAttemptReadModel(materializationAttempt)
        : undefined
    };
  }

  private async buildCandidateEvaluationReadModel(
    candidate: TraderSystemCandidateRecord,
    version: CandidateVersionRecord
  ): Promise<CandidateEvaluationReadModel> {
    const evaluationRuns = await this.readCollection<EvaluationRunRecord>("evaluation-runs");
    const candidateRuns = evaluationRuns
      .filter((run) => (
        run.candidate_ref.id === candidate.candidate_id &&
        run.candidate_version_ref.id === version.candidate_version_id
      ))
      .sort(compareEvaluationRuns);

    const latestRun = candidateRuns.at(-1);
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

  private toCandidateSummary(candidate: TraderSystemCandidateRecord): CandidateSummaryReadModel {
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
  legacyRunRef?: Ref
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
      legacyRunRef ?? ref("evaluation_run_record", "none"),
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
  const legacyRef = (comparisonSet as { evaluation_run_record_ref?: Ref }).evaluation_run_record_ref;
  return comparisonSet.evaluation_run_refs ?? (legacyRef ? [legacyRef] : []);
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

function isEvidenceDisposition(value: unknown): value is EvidenceDisposition {
  return value === "not_counted" || value === "counted" || value === "quarantined_for_review";
}

function isEvidenceDispositionReason(value: unknown): value is EvidenceDispositionReason {
  return typeof value === "string" && evidenceDispositionReasons.has(value as EvidenceDispositionReason);
}

function isOptionalRefArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => isRef(item)));
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
    candidate.first_market_scope !== "binance_btc_perpetual_futures" ||
    spec.market !== "Binance" ||
    spec.instrument !== "BTC perpetual futures" ||
    containsForbiddenMaterializationKey(input)
  ) {
    return "materialization_rejected";
  }

  return undefined;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
