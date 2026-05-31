import type {
  AgentProfileId,
  AgentProfileRecord,
  ArtifactLineageRecord,
  CandidateArenaTickRecord,
  CandidateEvaluationRunOutcome,
  CandidateInspectReadModel,
  CandidateMaterializationFailureInput,
  CandidateMaterializationInput,
  CandidateMaterializationOutcome,
  CandidateSummaryReadModel,
  EvaluationExecutionMode,
  ExperimentRunRecord,
  ImprovementProposalRecord,
  OuroborosCommandRecord,
  Ref,
  ResearchOrchestrationRunRecord,
  ResearcherProviderSelectionRecord,
  ResearchFindingRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  LedgerInput,
  LedgerWriteOutcome,
  PublicMarketLivenessSurfaceRecord,
  PublicMarketLivenessSurfaceReadModel,
  RunControlAuditInput,
  RunControlAuditOutcome
} from "@ouroboros/domain";
import { createHash } from "node:crypto";

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
  recordSystemCode(systemCode: SystemCodeRecord): Promise<SystemCodeRecord>;
  getSystemCode(systemCodeId: string): Promise<SystemCodeRecord | undefined>;
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
  listOuroborosCommands(): Promise<OuroborosCommandRecord[]>;
  recordOuroborosCommand(command: OuroborosCommandRecord): Promise<OuroborosCommandRecord>;
  recordRunControlAudit(input: RunControlAuditInput): Promise<RunControlAuditOutcome>;
  recordPublicMarketLivenessSurface(surface: PublicMarketLivenessSurfaceRecord): Promise<PublicMarketLivenessSurfaceReadModel>;
  recordPaperTradingEvaluation(evaluation: PaperTradingEvaluationRecord): Promise<PaperTradingEvaluationRecord>;
  getLatestPaperTradingEvaluationForCandidate(candidateId: string): Promise<PaperTradingEvaluationRecord | undefined>;
  getLatestPaperTradingEvaluationForTradingRun(tradingRunId: string): Promise<PaperTradingEvaluationRecord | undefined>;
  recordPaperTradingObservation(
    observation: PaperTradingObservationRecord,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<PaperTradingObservationRecord>;
  listPaperTradingObservations(evaluationId: string): Promise<PaperTradingObservationRecord[]>;
  recordLedger(input: LedgerInput): Promise<LedgerWriteOutcome>;
}

function stableSuffix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
