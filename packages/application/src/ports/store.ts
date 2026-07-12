import type {
  AgentProfileId,
  AgentProfileRecord,
  ArtifactLineageRecord,
  CandidateAdmissionDecisionRecord,
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
  ResearchControlCampaignArmIntentRecord,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord,
  ResearchPreflightCommitmentRecord,
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
  recordResearchControlCampaignOutcome(
    outcome: ResearchControlCampaignOutcomeRecord
  ): Promise<ResearchControlCampaignOutcomeRecord>;
  getResearchControlCampaignOutcome(
    outcomeId: string
  ): Promise<ResearchControlCampaignOutcomeRecord | undefined>;
  listResearchControlCampaignOutcomes(): Promise<
    ResearchControlCampaignOutcomeRecord[]
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
  getTradingEvaluationResult(
    evaluationResultId: string
  ): Promise<TradingEvaluationResultRecord | undefined>;
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
