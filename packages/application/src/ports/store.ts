import type {
  AgentProfileId,
  AgentProfileRecord,
  ArtifactLineageRecord,
  CandidateAdmissionDecisionRecord,
  CandidateArenaReadModel,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaTickRecord,
  CandidateEvaluationRunOutcome,
  CandidateInspectReadModel,
  CandidateMaterializationFailureInput,
  CandidateMaterializationInput,
  CandidateMaterializationOutcome,
  CandidateSummaryReadModel,
  CandidateVersionRecord,
  EvaluationExecutionMode,
  ExperimentRunRecord,
  ImprovementProposalRecord,
  OuroborosCommandRecord,
  Ref,
  ResearchOrchestrationRunRecord,
  ResearchBehaviorFingerprintRecord,
  ResearchDirectionRecord,
  ResearchEvidenceArtifactRecord,
  ResearchEvidenceArtifactReadModel,
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperStartBatchRecord,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord,
  ResearchControlStudyRecord,
  ResearchControlStudyOutcomeRecord,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchGeneralizationProtocolRecord,
  ResearchAllocationPolicyDecisionRecord,
  ResearchMemoryControlPairOutcomeRecord,
  ResearchMemoryControlStudyOutcomeRecord,
  ResearchMemoryControlStudyRecord,
  ResearchPreflightCommitmentRecord,
  ResearchSessionDetailReadModel,
  ResearchDirectionKind,
  ResearcherProviderSelectionRecord,
  ResearchFindingRecord,
  ResearchWorkerRecord,
  ResearchWorkerCheckpointRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingPromotionRecord,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingEvidencePurpose,
  PaperTradingObservationRecord,
  PaperTradingHandoffConformanceRecord,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonTickCaptureWriteContext,
  PaperTradingComparisonTickAcknowledgementRecord,
  PaperTradingComparisonTickDeliveryRecord,
  PaperTradingComparisonTickIOWriteContext,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationSideResultRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonCheckpointAttemptRecord,
  PaperTradingComparisonCheckpointOutcomeRecord,
  PaperTradingComparisonCheckpointWriteContext,
  PaperTradingComparisonRuntimeWriteContext,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonVerdictRecord,
  LedgerInput,
  LedgerWriteOutcome,
  PublicMarketLivenessSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  RunControlAuditInput,
  RunControlAuditOutcome,
  SandboxDetailReadModel,
  SandboxLogsOutcome,
  SandboxRecord,
  StartSandboxOutcome,
  StopSandboxInput,
  TradingRunRecord
} from "@ouroboros/domain";
import type { SandboxStartResult, SandboxAdapterObservationResult } from "./sandbox";
import type { DecideResearchMemoryControlPairOutcomeInput } from
  "../candidate/research-memory-control-study-outcome";
import { createHash } from "node:crypto";

export type SandboxStartPersistenceInput = Omit<SandboxStartResult, "placement"> & {
  placement?: SandboxStartResult["placement"];
};

export interface PreparedPaperTradingComparisonCheckpointSide {
  role: "champion" | "challenger";
  ledger_inputs: LedgerInput[];
  ledger_outcomes: LedgerWriteOutcome[];
  observation: PaperTradingObservationRecord;
  evaluation: PaperTradingEvaluationRecord;
  consumed_event_count: number;
  provider_request_count_after: number;
  preparation_digest: string;
}

export interface RecordPaperTradingComparisonPairedCheckpointInput {
  attempt: PaperTradingComparisonCheckpointAttemptRecord;
  outcome: PaperTradingComparisonCheckpointOutcomeRecord;
  champion: PreparedPaperTradingComparisonCheckpointSide;
  challenger: PreparedPaperTradingComparisonCheckpointSide;
}

export interface PaperTradingComparisonWindowClosureGraphSnapshot {
  activation_attempt: PaperTradingComparisonActivationAttemptRecord;
  activation_outcomes: PaperTradingComparisonActivationOutcomeRecord[];
  ticks: PaperTradingComparisonTickRecord[];
  checkpoint_attempts: PaperTradingComparisonCheckpointAttemptRecord[];
  checkpoint_outcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
}

export interface ResearchMemoryControlPairOutcomePersistenceInput {
  outcome: ResearchMemoryControlPairOutcomeRecord;
  source_graph: DecideResearchMemoryControlPairOutcomeInput;
}

export type ResearchOperationsProjectionCompatibilityReason =
  "legacy_source_oversized";

export class ResearchOperationsProjectionCompatibilityError extends Error {
  readonly name = "ResearchOperationsProjectionCompatibilityError";

  constructor(
    readonly reason: ResearchOperationsProjectionCompatibilityReason
  ) {
    super("research_operations_projection_compatibility_blocked");
  }
}

export type CandidateArenaEvidenceProjection =
  | {
      availability: "available";
      latest_ticks: CandidateArenaReadModel["latest_ticks"];
      terminal_tick_ids: string[];
      research_population_diversity:
        CandidateArenaReadModel["research_population_diversity"];
      research_generalization: CandidateArenaReadModel["research_generalization"];
      projection_digest: string;
    }
  | {
      availability: "unavailable";
      projection_digest: string;
    };

export interface ResearchOperationsProjectionRuntimeIdentity {
  research_work_item_id: string;
  research_allocation_id: string;
  tick_id: string;
  tick_research_work_item_ids: string[];
  direction_kind: ResearchDirectionKind;
  commitment_id?: string;
  concurrency_limit: number;
}

export interface ResearchOperationsProjectionCapsule {
  record_kind: "research_operations_projection_capsule";
  version: 1;
  research_work_item_id: string;
  runtime_identity: ResearchOperationsProjectionRuntimeIdentity;
  inactive_detail: ResearchSessionDetailReadModel;
  active_queued_detail: ResearchSessionDetailReadModel;
  graph_conflict: boolean;
  terminal_evidence_present: boolean;
  capsule_digest: string;
  authority_status: "read_only";
}

export interface ResearchOperationsProjectionHeadRef {
  research_work_item_id: string;
  allocated_at: string;
  capsule_digest: string;
}

export interface ResearchOperationsProjectionOpenTickRef {
  tick_id: string;
  research_work_item_ids: string[];
}

export interface ResearchOperationsProjectionCapsuleTrieLeafEntry {
  research_work_item_id: string;
  capsule_digest: string;
}

interface ResearchOperationsProjectionCapsuleTrieNodeBase {
  record_kind: "research_operations_projection_capsule_trie_node";
  version: 1;
  prefix: string;
  subtree_entry_count: number;
  node_digest: string;
  authority_status: "read_only";
}

export type ResearchOperationsProjectionCapsuleTrieNode =
  | (ResearchOperationsProjectionCapsuleTrieNodeBase & {
      node_kind: "leaf";
      entries: ResearchOperationsProjectionCapsuleTrieLeafEntry[];
    })
  | (ResearchOperationsProjectionCapsuleTrieNodeBase & {
      node_kind: "branch";
      children: ResearchOperationsProjectionCapsuleTrieNodeRef[];
    });

export interface ResearchOperationsProjectionCapsuleTrieNodeRef {
  prefix: string;
  subtree_entry_count: number;
  node_digest: string;
}

type CandidateArenaEvidenceProjectionPayload =
  CandidateArenaEvidenceProjection extends infer Projection
    ? Projection extends CandidateArenaEvidenceProjection
      ? Omit<Projection, "projection_digest">
      : never
    : never;

export interface ResearchOperationsProjectionIndexRecord {
  record_kind: "research_operations_projection_index";
  version: 1;
  head_session_refs: ResearchOperationsProjectionHeadRef[];
  open_tick_session_refs: ResearchOperationsProjectionOpenTickRef[];
  open_tick_session_count: number;
  projected_open_tick_session_count: number;
  omitted_open_tick_session_count: number;
  open_tick_sessions_truncated: boolean;
  capsule_trie_root_refs: ResearchOperationsProjectionCapsuleTrieNodeRef[];
  recorded_session_count: number;
  graph_conflict_count: number;
  incomplete_without_conflict_count: number;
  capsule_set_digest: string;
  session_membership: {
    algorithm: "sha256_bloom_v1";
    bit_count: number;
    hash_count: number;
    encoded_bits: string;
    member_count: number;
  };
  candidate_arena_evidence: CandidateArenaEvidenceProjectionPayload;
  projection_digest: string;
  authority_status: "read_only";
}

export interface ResearchOperationsProjectionWindow {
  index: ResearchOperationsProjectionIndexRecord;
  capsules: ResearchOperationsProjectionCapsule[];
}

export interface ReadResearchOperationsProjectionWindowInput {
  session_limit: number;
  active_tick_id?: string;
  active_research_work_item_ids?: string[];
  exact_research_work_item_id?: string;
  expected_projection_digest?: string;
}

export const FIXTURE_CANDIDATE_ID = "fixture-candidate-sealed-replay-001";
export const FIXTURE_SYSTEM_CODE_ID = "fixture-system-code-clock-python-001";

export interface StoreErrorLike extends Error {
  code: string;
  details?: Record<string, unknown>;
}

export function isStoreErrorLike(error: unknown): error is StoreErrorLike {
  return error instanceof Error && typeof (error as { code?: unknown }).code === "string";
}

export interface CandidateEvaluationRunIdentityInput {
  candidate_id: string;
  candidate_version_id: string;
  idempotency_key: string;
}

export function candidateEvaluationRunRecordId(input: CandidateEvaluationRunIdentityInput): string {
  return `evaluation-run-${stableSuffix(`${input.candidate_id}:${input.candidate_version_id}:${input.idempotency_key}`)}`;
}

export interface OuroborosStorePort {
  // Store implementations expose many projection-specific methods while the
  // application layer is being moved onto focused ports. Keep this structural
  // escape hatch inside the port boundary instead of importing LocalStore.
  [method: string]: any;
  root(): string;
  getCandidate(candidateId: string): Promise<CandidateInspectReadModel | undefined>;
  getCandidateForTradingRun(tradingRunId: string): Promise<CandidateInspectReadModel | undefined>;
  getTradingRun(tradingRunId: string): Promise<TradingRunRecord | undefined>;
  createPaperTradingRun(input: {
    idempotency_key: string;
    candidate_id: string;
    candidate_version_id: string;
    evidence_purpose: PaperTradingEvidencePurpose;
    created_at?: string;
  }): Promise<TradingRunRecord>;
  listTradingRunsForCandidateVersion(candidateVersionId: string): Promise<TradingRunRecord[]>;
  listCandidates(): Promise<CandidateSummaryReadModel[]>;
  materializeCandidate(input: CandidateMaterializationInput): Promise<CandidateMaterializationOutcome>;
  recordCandidateMaterializationFailure(input: CandidateMaterializationFailureInput): Promise<CandidateMaterializationOutcome>;
  getCandidateEvaluationRun(evaluationRunId: string): Promise<CandidateEvaluationRunOutcome | undefined>;
  createEvaluationRunForCandidate(input: {
    idempotency_key: string;
    candidate_id: string;
    candidate_version_id: string;
    stage: "backtest";
    execution_mode?: EvaluationExecutionMode;
    trace_ref: Ref;
    evaluator_ref: Ref;
    provider_output_artifact_refs: Ref[];
    debug_artifact_refs: Ref[];
  }): Promise<CandidateEvaluationRunOutcome>;
  recordCandidateArenaTick(tick: CandidateArenaTickRecord): Promise<CandidateArenaTickRecord>;
  listCandidateArenaTicks(): Promise<CandidateArenaTickRecord[]>;
  recordCandidateArenaResearchAllocation(
    allocation: CandidateArenaResearchAllocationRecord
  ): Promise<CandidateArenaResearchAllocationRecord>;
  getCandidateArenaResearchAllocation(
    allocationId: string
  ): Promise<CandidateArenaResearchAllocationRecord | undefined>;
  listCandidateArenaResearchAllocations(): Promise<
    CandidateArenaResearchAllocationRecord[]
  >;
  readResearchOperationsProjectionWindow?(
    input: ReadResearchOperationsProjectionWindowInput
  ): Promise<ResearchOperationsProjectionWindow>;
  readCandidateArenaEvidenceProjection?(): Promise<CandidateArenaEvidenceProjection>;
  runResearchOperationsProjectionBatch?<T>(task: () => Promise<T>): Promise<T>;
  recordResearchControlCampaign(
    campaign: ResearchControlCampaignRecord
  ): Promise<ResearchControlCampaignRecord>;
  getResearchControlCampaign(
    campaignId: string
  ): Promise<ResearchControlCampaignRecord | undefined>;
  listResearchControlCampaigns(): Promise<ResearchControlCampaignRecord[]>;
  recordResearchControlCampaignArmIntent(
    intent: ResearchControlCampaignArmIntentRecord
  ): Promise<ResearchControlCampaignArmIntentRecord>;
  getResearchControlCampaignArmIntent(
    intentId: string
  ): Promise<ResearchControlCampaignArmIntentRecord | undefined>;
  listResearchControlCampaignArmIntents(): Promise<
    ResearchControlCampaignArmIntentRecord[]
  >;
  recordResearchControlCampaignReport(
    report: ResearchControlCampaignReportRecord
  ): Promise<ResearchControlCampaignReportRecord>;
  getResearchControlCampaignReport(
    reportId: string
  ): Promise<ResearchControlCampaignReportRecord | undefined>;
  listResearchControlCampaignReports(): Promise<
    ResearchControlCampaignReportRecord[]
  >;
  recordResearchControlCampaignPaperSchedule(
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<ResearchControlCampaignPaperScheduleRecord>;
  getResearchControlCampaignPaperSchedule(
    scheduleId: string
  ): Promise<ResearchControlCampaignPaperScheduleRecord | undefined>;
  listResearchControlCampaignPaperSchedules(): Promise<
    ResearchControlCampaignPaperScheduleRecord[]
  >;
  recordResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<ResearchControlCampaignPaperStartBatchRecord>;
  replicateResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<ResearchControlCampaignPaperStartBatchRecord>;
  getResearchControlCampaignPaperStartBatch(
    batchId: string
  ): Promise<ResearchControlCampaignPaperStartBatchRecord | undefined>;
  listResearchControlCampaignPaperStartBatches(
    scheduleId?: string
  ): Promise<ResearchControlCampaignPaperStartBatchRecord[]>;
  recordResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord>;
  replicateResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord>;
  getResearchControlCampaignPaperSlotOutcome(
    outcomeId: string
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord | undefined>;
  listResearchControlCampaignPaperSlotOutcomes(
    scheduleId?: string
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord[]>;
  recordResearchControlCampaignOutcome(
    outcome: ResearchControlCampaignOutcomeRecord
  ): Promise<ResearchControlCampaignOutcomeRecord>;
  getResearchControlCampaignOutcome(
    outcomeId: string
  ): Promise<ResearchControlCampaignOutcomeRecord | undefined>;
  listResearchControlCampaignOutcomes(): Promise<
    ResearchControlCampaignOutcomeRecord[]
  >;
  recordResearchControlStudy(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyRecord>;
  getResearchControlStudy(
    studyId: string
  ): Promise<ResearchControlStudyRecord | undefined>;
  listResearchControlStudies(): Promise<ResearchControlStudyRecord[]>;
  recordResearchControlStudyOutcome(
    outcome: ResearchControlStudyOutcomeRecord
  ): Promise<ResearchControlStudyOutcomeRecord>;
  getResearchControlStudyOutcome(
    outcomeId: string
  ): Promise<ResearchControlStudyOutcomeRecord | undefined>;
  listResearchControlStudyOutcomes(): Promise<
    ResearchControlStudyOutcomeRecord[]
  >;
  recordResearchMemoryControlStudy(
    study: ResearchMemoryControlStudyRecord
  ): Promise<ResearchMemoryControlStudyRecord>;
  getResearchMemoryControlStudy(
    studyId: string
  ): Promise<ResearchMemoryControlStudyRecord | undefined>;
  listResearchMemoryControlStudies(): Promise<
    ResearchMemoryControlStudyRecord[]
  >;
  recordResearchMemoryControlPairOutcome(
    input: ResearchMemoryControlPairOutcomePersistenceInput
  ): Promise<ResearchMemoryControlPairOutcomeRecord>;
  getResearchMemoryControlPairOutcome(
    outcomeId: string
  ): Promise<ResearchMemoryControlPairOutcomeRecord | undefined>;
  listResearchMemoryControlPairOutcomes(
    studyId?: string
  ): Promise<ResearchMemoryControlPairOutcomeRecord[]>;
  recordResearchMemoryControlStudyOutcome(
    outcome: ResearchMemoryControlStudyOutcomeRecord
  ): Promise<ResearchMemoryControlStudyOutcomeRecord>;
  getResearchMemoryControlStudyOutcome(
    outcomeId: string
  ): Promise<ResearchMemoryControlStudyOutcomeRecord | undefined>;
  listResearchMemoryControlStudyOutcomes(): Promise<
    ResearchMemoryControlStudyOutcomeRecord[]
  >;
  recordResearchGeneralizationProtocol(
    protocol: ResearchGeneralizationProtocolRecord
  ): Promise<ResearchGeneralizationProtocolRecord>;
  getResearchGeneralizationProtocol(
    protocolId: string
  ): Promise<ResearchGeneralizationProtocolRecord | undefined>;
  listResearchGeneralizationProtocols(): Promise<
    ResearchGeneralizationProtocolRecord[]
  >;
  recordResearchGeneralizationOutcome(
    outcome: ResearchGeneralizationOutcomeRecord
  ): Promise<ResearchGeneralizationOutcomeRecord>;
  getResearchGeneralizationOutcome(
    outcomeId: string
  ): Promise<ResearchGeneralizationOutcomeRecord | undefined>;
  listResearchGeneralizationOutcomes(): Promise<
    ResearchGeneralizationOutcomeRecord[]
  >;
  recordResearchGeneralizationPolicyDecision(
    decision: ResearchGeneralizationPolicyDecisionRecord
  ): Promise<ResearchGeneralizationPolicyDecisionRecord>;
  getResearchGeneralizationPolicyDecision(
    decisionId: string
  ): Promise<ResearchGeneralizationPolicyDecisionRecord | undefined>;
  listResearchGeneralizationPolicyDecisions(): Promise<
    ResearchGeneralizationPolicyDecisionRecord[]
  >;
  recordResearchAllocationPolicyDecision(
    decision: ResearchAllocationPolicyDecisionRecord
  ): Promise<ResearchAllocationPolicyDecisionRecord>;
  getResearchAllocationPolicyDecision(
    decisionId: string
  ): Promise<ResearchAllocationPolicyDecisionRecord | undefined>;
  listResearchAllocationPolicyDecisions(): Promise<
    ResearchAllocationPolicyDecisionRecord[]
  >;
  recordResearchDirection(
    direction: ResearchDirectionRecord
  ): Promise<ResearchDirectionRecord>;
  getResearchDirection(
    directionId: string
  ): Promise<ResearchDirectionRecord | undefined>;
  listResearchDirections(): Promise<ResearchDirectionRecord[]>;
  recordResearchWorker(worker: ResearchWorkerRecord): Promise<ResearchWorkerRecord>;
  getResearchWorker(workerId: string): Promise<ResearchWorkerRecord | undefined>;
  listResearchWorkers(): Promise<ResearchWorkerRecord[]>;
  recordResearchEvidenceArtifact(
    artifact: ResearchEvidenceArtifactRecord
  ): Promise<ResearchEvidenceArtifactRecord>;
  getResearchEvidenceArtifact(
    artifactId: string
  ): Promise<ResearchEvidenceArtifactRecord | undefined>;
  listResearchEvidenceArtifacts(): Promise<ResearchEvidenceArtifactRecord[]>;
  recordResearchPreflightCommitment(
    commitment: ResearchPreflightCommitmentRecord
  ): Promise<ResearchPreflightCommitmentRecord>;
  getResearchPreflightCommitment(
    commitmentId: string
  ): Promise<ResearchPreflightCommitmentRecord | undefined>;
  listResearchPreflightCommitments(): Promise<ResearchPreflightCommitmentRecord[]>;
  recordResearchWorkerCheckpoint(
    checkpoint: ResearchWorkerCheckpointRecord
  ): Promise<ResearchWorkerCheckpointRecord>;
  getResearchWorkerCheckpoint(
    checkpointId: string
  ): Promise<ResearchWorkerCheckpointRecord | undefined>;
  listResearchWorkerCheckpoints(): Promise<ResearchWorkerCheckpointRecord[]>;
  recordResearchBehaviorFingerprint(
    fingerprint: ResearchBehaviorFingerprintRecord
  ): Promise<ResearchBehaviorFingerprintRecord>;
  getResearchBehaviorFingerprint(
    fingerprintId: string
  ): Promise<ResearchBehaviorFingerprintRecord | undefined>;
  listResearchBehaviorFingerprints(): Promise<ResearchBehaviorFingerprintRecord[]>;
  recordSystemCode(systemCode: SystemCodeRecord): Promise<SystemCodeRecord>;
  getSystemCode(systemCodeId: string): Promise<SystemCodeRecord | undefined>;
  getExperimentRun(experimentRunId: string): Promise<ExperimentRunRecord | undefined>;
  listExperimentRuns(): Promise<ExperimentRunRecord[]>;
  getTradingEvaluationResult(
    evaluationResultId: string
  ): Promise<TradingEvaluationResultRecord | undefined>;
  listTradingEvaluationResults(): Promise<TradingEvaluationResultRecord[]>;
  recordPaperTradingHandoffConformance(
    record: PaperTradingHandoffConformanceRecord
  ): Promise<PaperTradingHandoffConformanceRecord>;
  getPaperTradingHandoffConformance(
    conformanceId: string
  ): Promise<PaperTradingHandoffConformanceRecord | undefined>;
  listPaperTradingHandoffConformances(): Promise<PaperTradingHandoffConformanceRecord[]>;
  recordCandidateAdmissionDecision(
    record: CandidateAdmissionDecisionRecord
  ): Promise<CandidateAdmissionDecisionRecord>;
  getCandidateAdmissionDecision(
    decisionId: string
  ): Promise<CandidateAdmissionDecisionRecord | undefined>;
  getCandidateVersion(
    candidateVersionId: string
  ): Promise<CandidateVersionRecord | undefined>;
  listCandidateAdmissionDecisions(): Promise<CandidateAdmissionDecisionRecord[]>;
  recordExperimentRun(record: ExperimentRunRecord): Promise<ExperimentRunRecord>;
  recordTradingEvaluationResult(record: TradingEvaluationResultRecord): Promise<TradingEvaluationResultRecord>;
  recordResearchFinding(record: ResearchFindingRecord): Promise<ResearchFindingRecord>;
  recordArtifactLineage(record: ArtifactLineageRecord): Promise<ArtifactLineageRecord>;
  listResearchFindings(): Promise<ResearchFindingRecord[]>;
  listArtifactLineages(): Promise<ArtifactLineageRecord[]>;
  materializeImprovementProposal(input: any): Promise<
    | {
        status: "materialized";
        proposal: ImprovementProposalRecord;
        system_code: SystemCodeRecord;
        lineage: ArtifactLineageRecord;
      }
    | {
        status: "failed";
        attempt: { failure_reason?: string };
      }
  >;
  recordImprovementProposalProviderFailure(input: any): Promise<unknown>;
  recordResearchOrchestrationRun(record: ResearchOrchestrationRunRecord): Promise<ResearchOrchestrationRunRecord>;
  listAgentProfiles(): Promise<AgentProfileRecord[]>;
  getAgentProfile(profileId: AgentProfileId): Promise<AgentProfileRecord | undefined>;
  recordAgentProfile(profile: AgentProfileRecord): Promise<AgentProfileRecord>;
  getResearcherProviderSelection(): Promise<ResearcherProviderSelectionRecord | undefined>;
  recordResearcherProviderSelection(selection: ResearcherProviderSelectionRecord): Promise<ResearcherProviderSelectionRecord>;
  getLatestTradingPromotion(): Promise<TradingPromotionRecord | undefined>;
  getTradingPromotion(promotionId: string): Promise<TradingPromotionRecord | undefined>;
  recordTradingPromotion(promotion: TradingPromotionRecord): Promise<TradingPromotionRecord>;
  listOuroborosCommands(): Promise<OuroborosCommandRecord[]>;
  recordOuroborosCommand(command: OuroborosCommandRecord): Promise<OuroborosCommandRecord>;
  recordRunControlAudit(
    input: RunControlAuditInput,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<RunControlAuditOutcome>;
  recordPublicMarketLivenessSurface(surface: PublicMarketLivenessSurfaceRecord): Promise<PublicMarketLivenessSurfaceReadModel>;
  getSandbox(sandboxId: string): Promise<SandboxDetailReadModel | undefined>;
  recordSandboxStart(input: SandboxStartResult): Promise<StartSandboxOutcome>;
  recordSandboxStart(
    input: SandboxStartPersistenceInput,
    authority: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome>;
  recordSandboxObservations(
    sandboxId: string,
    observations: Omit<SandboxAdapterObservationResult, "instance"> & {
      lifecycle_status?: SandboxRecord["lifecycle_status"];
      last_heartbeat_at?: string;
    },
    authority?: PaperTradingComparisonCheckpointWriteContext
  ): Promise<SandboxLogsOutcome>;
  stopSandbox(
    input: StopSandboxInput,
    observations?: SandboxAdapterObservationResult,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<StartSandboxOutcome>;
  recordPaperTradingEvaluationCommitment(
    commitment: PaperTradingEvaluationCommitmentRecord
  ): Promise<PaperTradingEvaluationCommitmentRecord>;
  getPaperTradingEvaluationCommitment(
    commitmentId: string
  ): Promise<PaperTradingEvaluationCommitmentRecord | undefined>;
  listPaperTradingEvaluationCommitments(): Promise<PaperTradingEvaluationCommitmentRecord[]>;
  recordPaperTradingEvaluation(
    evaluation: PaperTradingEvaluationRecord,
    authority?: PaperTradingComparisonRuntimeWriteContext
  ): Promise<PaperTradingEvaluationRecord>;
  getPaperTradingEvaluation(
    evaluationId: string
  ): Promise<PaperTradingEvaluationRecord | undefined>;
  listPaperTradingEvaluations(): Promise<PaperTradingEvaluationRecord[]>;
  getLatestPaperTradingEvaluationForCandidate(candidateId: string): Promise<PaperTradingEvaluationRecord | undefined>;
  getLatestPaperTradingEvaluationForTradingRun(tradingRunId: string): Promise<PaperTradingEvaluationRecord | undefined>;
  recordPaperTradingObservation(
    observation: PaperTradingObservationRecord,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingObservationRecord>;
  listPaperTradingObservations(evaluationId: string): Promise<PaperTradingObservationRecord[]>;
  reservePaperTradingComparisonPreparation(
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<PaperTradingComparisonPreparationRecord>;
  getPaperTradingComparisonPreparation(
    preparationId: string
  ): Promise<PaperTradingComparisonPreparationRecord | undefined>;
  listPaperTradingComparisonPreparations(): Promise<PaperTradingComparisonPreparationRecord[]>;
  recordPaperTradingComparisonCommitment(
    commitment: PaperTradingComparisonCommitmentRecord
  ): Promise<PaperTradingComparisonCommitmentRecord>;
  getPaperTradingComparisonCommitment(
    comparisonId: string
  ): Promise<PaperTradingComparisonCommitmentRecord | undefined>;
  listPaperTradingComparisonCommitments(): Promise<PaperTradingComparisonCommitmentRecord[]>;
  recordPaperTradingComparisonTick(
    tick: PaperTradingComparisonTickRecord,
    authority?: PaperTradingComparisonTickCaptureWriteContext
  ): Promise<PaperTradingComparisonTickRecord>;
  getPaperTradingComparisonTick(
    tickId: string
  ): Promise<PaperTradingComparisonTickRecord | undefined>;
  listPaperTradingComparisonTicks(
    comparisonId: string
  ): Promise<PaperTradingComparisonTickRecord[]>;
  recordPaperTradingComparisonTickDelivery(
    delivery: PaperTradingComparisonTickDeliveryRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickDeliveryRecord>;
  getPaperTradingComparisonTickDelivery(
    deliveryId: string
  ): Promise<PaperTradingComparisonTickDeliveryRecord | undefined>;
  listPaperTradingComparisonTickDeliveries(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonTickDeliveryRecord[]>;
  recordPaperTradingComparisonTickAcknowledgement(
    acknowledgement: PaperTradingComparisonTickAcknowledgementRecord,
    authority: PaperTradingComparisonTickIOWriteContext
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord>;
  getPaperTradingComparisonTickAcknowledgement(
    acknowledgementId: string
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord | undefined>;
  listPaperTradingComparisonTickAcknowledgements(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonTickAcknowledgementRecord[]>;
  recordPaperTradingComparisonActivation(
    activation: PaperTradingComparisonActivationRecord
  ): Promise<PaperTradingComparisonActivationRecord>;
  getPaperTradingComparisonActivation(
    activationId: string
  ): Promise<PaperTradingComparisonActivationRecord | undefined>;
  listPaperTradingComparisonActivations(
    comparisonId: string
  ): Promise<PaperTradingComparisonActivationRecord[]>;
  recordPaperTradingComparisonActivationAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<PaperTradingComparisonActivationAttemptRecord>;
  getPaperTradingComparisonActivationAttempt(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationAttemptRecord | undefined>;
  listPaperTradingComparisonActivationAttempts(
    activationId: string
  ): Promise<PaperTradingComparisonActivationAttemptRecord[]>;
  recordPaperTradingComparisonActivationSideResult(
    result: PaperTradingComparisonActivationSideResultRecord
  ): Promise<PaperTradingComparisonActivationSideResultRecord>;
  getPaperTradingComparisonActivationSideResult(
    resultId: string
  ): Promise<PaperTradingComparisonActivationSideResultRecord | undefined>;
  listPaperTradingComparisonActivationSideResults(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationSideResultRecord[]>;
  recordPaperTradingComparisonActivationOutcome(
    outcome: PaperTradingComparisonActivationOutcomeRecord
  ): Promise<PaperTradingComparisonActivationOutcomeRecord>;
  getPaperTradingComparisonActivationOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonActivationOutcomeRecord | undefined>;
  listPaperTradingComparisonActivationOutcomes(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationOutcomeRecord[]>;
  recordPaperTradingComparisonCheckpointAttempt(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord>;
  getPaperTradingComparisonCheckpointAttempt(
    attemptId: string
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord | undefined>;
  listPaperTradingComparisonCheckpointAttempts(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonCheckpointAttemptRecord[]>;
  recordPaperTradingComparisonCheckpointOutcome(
    outcome: PaperTradingComparisonCheckpointOutcomeRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
  getPaperTradingComparisonCheckpointOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord | undefined>;
  listPaperTradingComparisonCheckpointOutcomes(
    checkpointAttemptId: string
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord[]>;
  /** Linearizes one durable graph read with all paper-comparison evidence writes. */
  snapshotPaperTradingComparisonWindowClosureGraph(
    activationAttemptId: string
  ): Promise<PaperTradingComparisonWindowClosureGraphSnapshot>;
  previewLedger(input: LedgerInput): Promise<LedgerWriteOutcome>;
  recordPaperTradingComparisonPairedCheckpoint(
    input: RecordPaperTradingComparisonPairedCheckpointInput
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord>;
  recoverPaperTradingComparisonCheckpointTransactions(): Promise<
    PaperTradingComparisonCheckpointOutcomeRecord[]
  >;
  recordPaperTradingComparisonVerdict(
    verdict: PaperTradingComparisonVerdictRecord
  ): Promise<PaperTradingComparisonVerdictRecord>;
  getPaperTradingComparisonVerdict(
    verdictId: string
  ): Promise<PaperTradingComparisonVerdictRecord | undefined>;
  listPaperTradingComparisonVerdicts(
    comparisonId?: string
  ): Promise<PaperTradingComparisonVerdictRecord[]>;
  recordPaperTradingComparisonConfirmationCampaign(
    campaign: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord>;
  getPaperTradingComparisonConfirmationCampaign(
    campaignId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord | undefined>;
  listPaperTradingComparisonConfirmationCampaigns(): Promise<
    PaperTradingComparisonConfirmationCampaignRecord[]
  >;
  recordPaperTradingComparisonConfirmationCampaignOutcome(
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord>;
  getPaperTradingComparisonConfirmationCampaignOutcome(
    outcomeId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord | undefined>;
  listPaperTradingComparisonConfirmationCampaignOutcomes(
    campaignId?: string
  ): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord[]>;
  recordPaperTradingComparisonResearchRelease(
    release: PaperTradingComparisonResearchReleaseRecord
  ): Promise<PaperTradingComparisonResearchReleaseRecord>;
  getPaperTradingComparisonResearchRelease(
    releaseId: string
  ): Promise<PaperTradingComparisonResearchReleaseRecord | undefined>;
  listPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  >;
  recoverPaperTradingComparisonResearchReleases(): Promise<
    PaperTradingComparisonResearchReleaseRecord[]
  >;
  recordLedger(input: LedgerInput): Promise<LedgerWriteOutcome>;
}

function stableSuffix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
