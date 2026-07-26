import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  candidateArenaTickHasRuntimeShape,
  candidateEgressAttestationIdForConformance,
  isCandidateAdmissionDecisionConsistent,
  paperTradingHandoffConformanceDigestInput,
  paperTradingHandoffConformanceHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchBehaviorFingerprintHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchEvidenceArtifactDigestInput,
  researchEvidenceArtifactHasRuntimeShape,
  researchAllocationPolicyDecisionDigestInput,
  researchAllocationPolicyDecisionHasRuntimeShape,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationOutcomeHasRuntimeShape,
  researchGeneralizationMarketClassifierPolicyDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionHasRuntimeShape,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationProtocolHasRuntimeShape,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyHasRuntimeShape,
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  researchWorkerCheckpointDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  sanitizeResearchEvidenceText,
  tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape,
  verifyCandidateEgressAttestation,
  type ArtifactLineageRecord,
  type CandidateAdmissionDecisionRecord,
  type CandidateInspectReadModel,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaResearchAllocationSelection,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ExperimentRunRecord,
  type PaperTradingHandoffConformanceRecord,
  type Ref,
  type ResearchDevelopmentSubmissionReadModel,
  type ResearchDirectionKind,
  type ResearchDirectionRecord,
  type ResearchEvidenceArtifactReadModel,
  type ResearchEvidenceArtifactRecord,
  type ResearchFindingRecord,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchLifecycleEventReadModel,
  type ResearchOperationsReadModel,
  type ResearchSessionDegradedReason,
  type ResearchSessionDetailReadModel,
  type ResearchSessionStatusBasisReadModel,
  type ResearchSessionSummaryReadModel,
  type ResearchSessionTerminalGraphReadModel,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import type {
  CandidateArenaEvidenceSnapshot,
  CandidateArenaRunnerHealthReadModel
} from "../candidate/arena";
import { decideResearchAllocationPolicyDecision } from
  "../candidate/research-allocation-policy-decision";
import { researchControlCampaignId } from
  "../candidate/research-control-campaign";
import { researchControlStudyId } from "../candidate/research-control-study";
import { researchGeneralizationProtocolId } from
  "../candidate/research-generalization-protocol";
import { decideResearchGeneralizationPolicyDecision } from
  "../candidate/research-generalization-policy-decision";
import { researchMemoryControlStudyId } from
  "../candidate/research-memory-control-study";
import {
  researchWorkItemId,
  type CandidateArenaActiveResearchWorkItemReadModel
} from "../candidate/research-work-item";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";

const TEXT_LIMIT = 500;
const HISTORY_LIMIT = 100;
export const RESEARCH_OPERATIONS_SESSION_LIMIT = 100;

type ResearchOperationsStore = Pick<
  OuroborosStorePort,
  | "listCandidateArenaResearchAllocations"
  | "listCandidateArenaTicks"
  | "listResearchPreflightCommitments"
  | "listResearchWorkers"
  | "listResearchDirections"
  | "listResearchEvidenceArtifacts"
  | "listResearchBehaviorFingerprints"
  | "listResearchWorkerCheckpoints"
  | "listTradingEvaluationResults"
  | "listExperimentRuns"
  | "listCandidateAdmissionDecisions"
  | "listPaperTradingHandoffConformances"
  | "listResearchFindings"
  | "listArtifactLineages"
  | "listResearchAllocationPolicyDecisions"
  | "listResearchGeneralizationPolicyDecisions"
  | "listResearchControlStudies"
  | "listResearchControlStudyOutcomes"
  | "listResearchGeneralizationProtocols"
  | "listResearchGeneralizationOutcomes"
  | "listResearchMemoryControlStudies"
  | "getCandidate"
  | "getSystemCode"
>;

export interface ResearchOperationsProjectionServiceOptions {
  store: ResearchOperationsStore;
  runnerHealth(): CandidateArenaRunnerHealthReadModel;
}

export function unavailableResearchOperationsReadModel(
  health: CandidateArenaRunnerHealthReadModel,
  arenaEvidence: CandidateArenaEvidenceSnapshot
): ResearchOperationsReadModel {
  const activeAllocation = arenaEvidence.allocations.find((allocation) =>
    allocationHasCanonicalRuntimeShape(allocation) &&
    allocation.tick_id === health.active_tick_id
  );
  return {
    projection_kind: "research_operations",
    availability: "unavailable",
    loop_status: "degraded",
    capacity: {
      max_concurrent_sessions: activeAllocation?.policy.concurrency_limit ??
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.concurrency_limit,
      active_session_count: health.active_research_work_items.length,
      queued_session_count: 0
    },
    sessions: [],
    recorded_session_count: 0,
    projected_session_count: 0,
    omitted_session_count: 0,
    sessions_truncated: false,
    authority_status: "research_only"
  };
}

interface LoadedGraph {
  health: CandidateArenaRunnerHealthReadModel;
  allocations: CandidateArenaResearchAllocationRecord[];
  ticks: CandidateArenaTickRecord[];
  commitments: ResearchPreflightCommitmentRecord[];
  workers: ResearchWorkerRecord[];
  directions: ResearchDirectionRecord[];
  evidence: ResearchEvidenceArtifactRecord[];
  fingerprints: ResearchBehaviorFingerprintRecord[];
  checkpoints: ResearchWorkerCheckpointRecord[];
  evaluations: TradingEvaluationResultRecord[];
  experiments: ExperimentRunRecord[];
  admissions: CandidateAdmissionDecisionRecord[];
  conformances: PaperTradingHandoffConformanceRecord[];
  findings: ResearchFindingRecord[];
  lineages: ArtifactLineageRecord[];
  allocationPolicyDecisions: ResearchAllocationPolicyDecisionRecord[];
  generalizationPolicyDecisions: ResearchGeneralizationPolicyDecisionRecord[];
  controlStudies: ResearchControlStudyRecord[];
  controlStudyOutcomes: ResearchControlStudyOutcomeRecord[];
  generalizationProtocols: ResearchGeneralizationProtocolRecord[];
  generalizationOutcomes: ResearchGeneralizationOutcomeRecord[];
  memoryControlStudies: ResearchMemoryControlStudyRecord[];
  systemCodes: Map<string, SystemCodeRecord | undefined>;
  candidates: Map<string, CandidateInspectReadModel | undefined>;
}

interface SessionSource {
  allocation: CandidateArenaResearchAllocationRecord;
  selection: CandidateArenaResearchAllocationSelection;
  workItemId: string;
  commitment?: ResearchPreflightCommitmentRecord;
  commitmentAmbiguous: boolean;
  direction?: ResearchDirectionRecord;
  worker?: ResearchWorkerRecord;
  checkpoint?: ResearchWorkerCheckpointRecord;
  checkpointAmbiguous: boolean;
  tick?: CandidateArenaTickRecord;
  tickResult?: CandidateArenaTickDirectionResultReadModel;
  runtime?: CandidateArenaActiveResearchWorkItemReadModel;
  evaluation?: TradingEvaluationResultRecord;
  experiment?: ExperimentRunRecord;
  admission?: CandidateAdmissionDecisionRecord;
  conformance?: PaperTradingHandoffConformanceRecord;
  finding?: ResearchFindingRecord;
  lineage?: ArtifactLineageRecord;
  selectedSystemCode?: SystemCodeRecord;
  selectedArtifactExact: boolean;
  selectedArtifactExpected: boolean;
  evaluationChainAmbiguous: boolean;
  evaluationGraphConflict: boolean;
  tickAmbiguous: boolean;
  admissionGraphConflict: boolean;
  admissionIntegrityConflict: boolean;
  terminalGraphComplete: boolean;
  evidenceInputs: ResearchEvidenceArtifactReadModel[];
  latestEvidenceSummary?: string;
  triggerEvidenceExact: boolean;
  missingEvidence: boolean;
}

interface ValidatedSourceClosure {
  sourceSystemCodeId: string;
  sourceSystemCodeArtifactDigest: string;
  sourceArtifactClosureDigest: string;
}

interface CheckpointValidationIndex {
  checkpointsByCommitmentId: Map<string, ResearchWorkerCheckpointRecord[]>;
  checkpointsById: Map<string, ResearchWorkerCheckpointRecord[]>;
  commitmentsByWorkerId: Map<string, ResearchPreflightCommitmentRecord[]>;
  commitmentPositions: WeakMap<ResearchPreflightCommitmentRecord, number>;
  admissionsById: Map<string, CandidateAdmissionDecisionRecord[]>;
  validationMemo: Map<string, boolean>;
}

interface SessionSeed {
  allocation: CandidateArenaResearchAllocationRecord;
  selection: CandidateArenaResearchAllocationSelection;
  workItemId: string;
}

interface CandidateClaim {
  tick: CandidateArenaTickRecord;
  result: CandidateArenaTickDirectionResultReadModel;
}

interface ResearchOperationsProjectionIndex {
  allocationsById: Map<string, CandidateArenaResearchAllocationRecord[]>;
  arenaEventAllocationsByEvidenceDigest: Map<
    string,
    CandidateArenaResearchAllocationRecord[]
  >;
  commitmentsByAllocationId: Map<string, ResearchPreflightCommitmentRecord[]>;
  commitmentsById: Map<string, ResearchPreflightCommitmentRecord[]>;
  commitmentsByRotationDigest: Map<string, ResearchPreflightCommitmentRecord[]>;
  commitmentsBySuiteDigest: Map<string, ResearchPreflightCommitmentRecord[]>;
  ticksByAllocationKey: Map<string, CandidateArenaTickRecord[]>;
  ticksById: Map<string, CandidateArenaTickRecord[]>;
  candidateClaimsById: Map<string, CandidateClaim[]>;
  runtimesByWorkItemId: Map<string, CandidateArenaActiveResearchWorkItemReadModel[]>;
  evaluationsByCommitmentId: Map<string, TradingEvaluationResultRecord[]>;
  evaluationsById: Map<string, TradingEvaluationResultRecord[]>;
  admissionsByEvaluationId: Map<string, CandidateAdmissionDecisionRecord[]>;
  admissionsById: Map<string, CandidateAdmissionDecisionRecord[]>;
  admissionsByFingerprintId: Map<string, CandidateAdmissionDecisionRecord[]>;
  lineagesBySystemCodeId: Map<string, ArtifactLineageRecord[]>;
  fingerprintsById: Map<string, ResearchBehaviorFingerprintRecord[]>;
  fingerprintsByBehaviorKey: Map<string, ResearchBehaviorFingerprintRecord[]>;
  allocationPolicyDecisionsById: Map<string, ResearchAllocationPolicyDecisionRecord[]>;
  allocationPolicyDecisionsByOutcomeId: Map<string, ResearchAllocationPolicyDecisionRecord[]>;
  generalizationPolicyDecisionsById: Map<
    string,
    ResearchGeneralizationPolicyDecisionRecord[]
  >;
  generalizationPolicyDecisionsByOutcomeId: Map<
    string,
    ResearchGeneralizationPolicyDecisionRecord[]
  >;
  controlStudiesById: Map<string, ResearchControlStudyRecord[]>;
  controlStudyOutcomesById: Map<string, ResearchControlStudyOutcomeRecord[]>;
  controlStudyOutcomesByStudyId: Map<string, ResearchControlStudyOutcomeRecord[]>;
  generalizationProtocolsById: Map<string, ResearchGeneralizationProtocolRecord[]>;
  generalizationOutcomesById: Map<string, ResearchGeneralizationOutcomeRecord[]>;
  generalizationOutcomesByProtocolId: Map<string, ResearchGeneralizationOutcomeRecord[]>;
  memoryControlStudiesById: Map<string, ResearchMemoryControlStudyRecord[]>;
  findingsById: Map<string, ResearchFindingRecord[]>;
  directions: Map<string, ResearchDirectionRecord>;
  workers: Map<string, ResearchWorkerRecord>;
  evidence: Map<string, ResearchEvidenceArtifactRecord>;
  experiments: Map<string, ExperimentRunRecord>;
  conformances: Map<string, PaperTradingHandoffConformanceRecord>;
  findings: Map<string, ResearchFindingRecord>;
  checkpointIndex: CheckpointValidationIndex;
  canonicalFingerprintMemo: Map<string, ResearchBehaviorFingerprintRecord | null>;
}

export class ResearchOperationsProjectionService {
  constructor(private readonly options: ResearchOperationsProjectionServiceOptions) {}

  async readOperations(
    arenaEvidence?: CandidateArenaEvidenceSnapshot
  ): Promise<ResearchOperationsReadModel> {
    const graph = await this.load(arenaEvidence);
    const index = createResearchOperationsProjectionIndex(graph);
    const recordedSeeds = this.sessionSeeds(graph, index)
      .sort((left, right) => compareSessionSeeds(left, right, index));
    const projectedSeeds = recordedSeeds.slice(0, RESEARCH_OPERATIONS_SESSION_LIMIT);
    await Promise.all([
      this.loadSystemCodes(graph, index, projectedSeeds),
      this.loadCandidates(graph, index, projectedSeeds)
    ]);
    const sessions = this.sources(graph, index, projectedSeeds)
      .map((source) => projectSummary(source, graph.health))
      .sort(compareSessions);
    const capacity = sessionCapacity(recordedSeeds, graph, index);
    const activeAllocation = graph.allocations.find((allocation) =>
      allocationHasCanonicalRuntimeShape(allocation) &&
      allocation.tick_id === graph.health.active_tick_id
    );
    const hasInactiveRecovery = sessions.some((entry) => entry.status === "recovering") ||
      recordedSeeds.slice(RESEARCH_OPERATIONS_SESSION_LIMIT).some((seed) =>
        sessionSeedRequiresRecovery(seed, graph, index)
      );
    const hasActiveRuntimeFailure = capacity.hasActiveRuntimeFailure || sessions.some((entry) =>
      entry.status === "failed_closed" &&
      entry.status_basis.basis_kind === "runtime_research_work_item"
    );
    const loopStatus = graph.health.status === "running"
      ? graph.health.consecutive_failure_count > 0 || hasInactiveRecovery || hasActiveRuntimeFailure
        ? "degraded"
        : "running"
      : graph.health.active_tick
        ? "stopping"
        : hasInactiveRecovery ? "degraded" : "stopped";
    const omittedSessionCount = recordedSeeds.length - sessions.length;
    return {
      projection_kind: "research_operations",
      availability: "available",
      loop_status: loopStatus,
      capacity: {
        max_concurrent_sessions: activeAllocation?.policy.concurrency_limit ??
          CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.concurrency_limit,
        active_session_count: capacity.activeCount,
        queued_session_count: capacity.queuedCount
      },
      sessions,
      recorded_session_count: recordedSeeds.length,
      projected_session_count: sessions.length,
      omitted_session_count: recordedSeeds.length - sessions.length,
      sessions_truncated: omittedSessionCount > 0,
      ...(sessions[0]
        ? { latest_session_id: sessions[0].research_work_item_id }
        : {}),
      authority_status: "research_only"
    };
  }

  async readSessionDetail(
    requestedWorkItemId: string
  ): Promise<ResearchSessionDetailReadModel | undefined> {
    const allocations = await this.options.store.listCandidateArenaResearchAllocations();
    if (!rawSessionSeeds(allocations, requestedWorkItemId).length) return undefined;
    const graph = await this.load(undefined, allocations);
    const index = createResearchOperationsProjectionIndex(graph);
    const seeds = this.sessionSeeds(graph, index, requestedWorkItemId);
    if (seeds.length !== 1) return undefined;
    await Promise.all([
      this.loadSystemCodes(graph, index, seeds),
      this.loadCandidates(graph, index, seeds)
    ]);
    const sources = this.sources(graph, index, seeds);
    return sources.length === 1 ? projectDetail(sources[0]!, graph.health) : undefined;
  }

  private async load(
    arenaEvidence?: CandidateArenaEvidenceSnapshot,
    suppliedAllocations?: CandidateArenaResearchAllocationRecord[]
  ): Promise<LoadedGraph> {
    const health = this.options.runnerHealth();
    const allocations = suppliedAllocations ?? arenaEvidence?.allocations ??
      await this.options.store.listCandidateArenaResearchAllocations();
    const [
      ticks,
      commitments,
      workers,
      directions,
      evidence,
      fingerprints,
      checkpoints,
      evaluations,
      experiments,
      admissions,
      conformances,
      findings,
      lineages,
      allocationPolicyDecisions,
      generalizationPolicyDecisions,
      controlStudies,
      controlStudyOutcomes,
      generalizationProtocols,
      generalizationOutcomes,
      memoryControlStudies
    ] = await Promise.all([
      arenaEvidence?.ticks ?? this.options.store.listCandidateArenaTicks(),
      this.options.store.listResearchPreflightCommitments(),
      this.options.store.listResearchWorkers(),
      this.options.store.listResearchDirections(),
      this.options.store.listResearchEvidenceArtifacts(),
      this.options.store.listResearchBehaviorFingerprints(),
      this.options.store.listResearchWorkerCheckpoints(),
      this.options.store.listTradingEvaluationResults(),
      this.options.store.listExperimentRuns(),
      this.options.store.listCandidateAdmissionDecisions(),
      this.options.store.listPaperTradingHandoffConformances(),
      this.options.store.listResearchFindings(),
      this.options.store.listArtifactLineages(),
      this.options.store.listResearchAllocationPolicyDecisions(),
      this.options.store.listResearchGeneralizationPolicyDecisions(),
      this.options.store.listResearchControlStudies(),
      this.options.store.listResearchControlStudyOutcomes(),
      this.options.store.listResearchGeneralizationProtocols(),
      this.options.store.listResearchGeneralizationOutcomes(),
      this.options.store.listResearchMemoryControlStudies()
    ]);
    return {
      health,
      allocations,
      ticks,
      commitments,
      workers,
      directions,
      evidence,
      fingerprints,
      checkpoints,
      evaluations,
      experiments,
      admissions,
      conformances,
      findings,
      lineages,
      allocationPolicyDecisions,
      generalizationPolicyDecisions,
      controlStudies,
      controlStudyOutcomes,
      generalizationProtocols,
      generalizationOutcomes,
      memoryControlStudies,
      systemCodes: new Map(),
      candidates: new Map()
    };
  }

  private sessionSeeds(
    graph: LoadedGraph,
    index: ResearchOperationsProjectionIndex,
    requestedWorkItemId?: string
  ): SessionSeed[] {
    return rawSessionSeeds(graph.allocations, requestedWorkItemId)
      .filter(({ allocation }) =>
        allocationHasUniqueRawOrigin(allocation, index) &&
        allocationMatchesPolicyProvenance(allocation, index)
      );
  }

  private sources(
    graph: LoadedGraph,
    index: ResearchOperationsProjectionIndex,
    seeds: SessionSeed[]
  ): SessionSource[] {
    return seeds.map(({ allocation, selection, workItemId }) =>
      buildSource({ allocation, selection, workItemId, graph, index })
    );
  }

  private async loadSystemCodes(
    graph: LoadedGraph,
    index: ResearchOperationsProjectionIndex,
    seeds: SessionSeed[]
  ): Promise<void> {
    const ids = systemCodeIdsForSessionSeeds(seeds, index);
    graph.systemCodes = new Map(await Promise.all(ids.map(async (id) => [
      id,
      await this.options.store.getSystemCode(id)
    ] as const)));
  }

  private async loadCandidates(
    graph: LoadedGraph,
    index: ResearchOperationsProjectionIndex,
    seeds: SessionSeed[]
  ): Promise<void> {
    const ids = candidateIdsForSessionSeeds(seeds, index);
    graph.candidates = new Map(await Promise.all(ids.map(async (id) => [
      id,
      await this.options.store.getCandidate(id)
    ] as const)));
  }
}

function buildSource(input: {
  allocation: CandidateArenaResearchAllocationRecord;
  selection: CandidateArenaResearchAllocationSelection;
  workItemId: string;
  graph: LoadedGraph;
  index: ResearchOperationsProjectionIndex;
}): SessionSource {
  const { allocation, selection, graph, index, workItemId } = input;
  const rawCommitmentCandidates = commitmentCandidatesForSeed(input, index);
  const commitmentCandidate = rawCommitmentCandidates.length === 1 &&
    commitmentHasUniqueRawOwnership(rawCommitmentCandidates[0]!, index)
    ? rawCommitmentCandidates[0]
    : undefined;
  const commitmentMatch = commitmentCandidate ? (() => {
    const candidate = commitmentCandidate;
    const direction = exactRef(candidate.research_direction_ref, "research_direction")
      ? index.directions.get(candidate.research_direction_ref.id)
      : undefined;
    const worker = exactRef(candidate.research_worker_ref, "research_worker")
      ? index.workers.get(candidate.research_worker_ref.id)
      : undefined;
    const sourceSystemCode = exactRef(candidate.source_system_code_ref, "system_code")
      ? graph.systemCodes.get(candidate.source_system_code_ref.id)
      : undefined;
    const sourceClosure = validatedCommitmentSourceClosure({
      commitment: candidate,
      allocation,
      selection,
      direction,
      worker,
      sourceSystemCode,
      projectionIndex: index,
      evidence: index.evidence,
      checkpointIndex: index.checkpointIndex
    });
    return sourceClosure ? { commitment: candidate, sourceClosure } : undefined;
  })() : undefined;
  const rawCommitmentConflict = rawCommitmentCandidates.length > 0 &&
    commitmentMatch === undefined;
  const commitment = commitmentMatch?.commitment;
  const sourceClosure = commitmentMatch?.sourceClosure;
  const direction = commitment
    ? index.directions.get(commitment.research_direction_ref.id)
    : undefined;
  const workerCandidate = commitment
    ? index.workers.get(commitment.research_worker_ref.id)
    : undefined;
  const worker = workerRecordMatches(workerCandidate, direction)
    ? workerCandidate
    : undefined;
  const rawTickCandidates = index.ticksByAllocationKey.get(
    tickAllocationKey(allocation.tick_id, allocation.candidate_arena_research_allocation_id)
  ) ?? [];
  const tick = rawTickCandidates.length === 1 &&
    tickHasUniqueRawIdentity(rawTickCandidates[0]!, index) &&
    tickMatchesAllocation(rawTickCandidates[0]!, allocation, commitment)
    ? rawTickCandidates[0]
    : undefined;
  const tickConflict = rawTickCandidates.length > 0 && tick === undefined;
  const tickResults = tick?.direction_results.filter((candidate) =>
    candidate.direction_kind === selection.direction_kind
  ) ?? [];
  const tickResult = tickResults.length === 1 ? tickResults[0] : undefined;
  const runtimeCandidates = (index.runtimesByWorkItemId.get(workItemId) ?? []).filter((candidate) =>
    candidate.research_work_item_id === workItemId &&
    candidate.research_allocation_id === allocation.candidate_arena_research_allocation_id &&
    candidate.direction_kind === selection.direction_kind
  );
  const runtime = runtimeCandidates.length === 1 ? runtimeCandidates[0] : undefined;
  const rawCheckpointCandidates = commitment
    ? index.checkpointIndex.checkpointsByCommitmentId.get(
        commitment.research_preflight_commitment_id
      ) ?? []
    : [];
  const validCheckpoint = commitment && worker && direction &&
    rawCheckpointCandidates.length === 1 && checkpointMatches(rawCheckpointCandidates[0]!, {
      commitment,
      worker,
      direction,
      index: index.checkpointIndex
    }) ? rawCheckpointCandidates[0] : undefined;
  const checkpointConflict = rawCheckpointCandidates.length > 0 && !validCheckpoint;
  const checkpoint = validCheckpoint;
  const rawCommitmentEvaluations = commitment
    ? index.evaluationsByCommitmentId.get(
        commitment.research_preflight_commitment_id
      ) ?? []
    : [];
  const evaluationGraphConflict = rawCommitmentEvaluations.some((candidate) => {
    const id = candidate?.trading_evaluation_result_id;
    return typeof id !== "string" || (index.evaluationsById.get(id)?.length ?? 0) !== 1;
  });
  const evaluationCanProject = Boolean(
    commitment && sourceClosure && worker && direction &&
    !checkpointConflict && !evaluationGraphConflict
  );
  const evaluationChains = evaluationCanProject &&
    rawCommitmentEvaluations.length === 1 && commitment &&
    sourceClosure && worker && direction
    ? rawCommitmentEvaluations.flatMap((candidate) => {
        const experimentCandidate = exactRef(candidate.experiment_run_ref, "experiment_run")
          ? index.experiments.get(candidate.experiment_run_ref.id)
          : undefined;
        const systemCodeCandidate = exactRef(candidate.submitted_system_code_ref, "system_code")
          ? graph.systemCodes.get(candidate.submitted_system_code_ref.id)
          : undefined;
        return evaluationChainMatches({
          commitment,
          sourceClosure,
          worker,
          direction,
          evaluation: candidate,
          experiment: experimentCandidate,
          selectedSystemCode: systemCodeCandidate
        }) ? [{
          evaluation: candidate,
          experiment: experimentCandidate!,
          selectedSystemCode: systemCodeCandidate!
        }] : [];
      })
    : [];
  const evaluationChain = evaluationChains.length === 1 ? evaluationChains[0] : undefined;
  const evaluationChainConflict = evaluationGraphConflict || evaluationCanProject &&
    rawCommitmentEvaluations.length > 0 && evaluationChains.length !== 1;
  const terminalSelectionExpected = checkpoint?.terminal_reason === "admission_recorded" ||
    tickResult?.status === "created" || tickResult?.status === "duplicate" ||
    tickResult?.status === "quarantined";
  const selectedArtifactExpected = terminalSelectionExpected || Boolean(
    commitment && sourceClosure && worker && direction &&
    rawCommitmentEvaluations.length > 0
  );
  const evaluation = evaluationChain?.evaluation;
  const experiment = evaluationChain?.experiment;
  const selectedSystemCode = evaluationChain?.selectedSystemCode;
  const rawAdmissionCandidates = evaluation
    ? index.admissionsByEvaluationId.get(evaluation.trading_evaluation_result_id) ?? []
    : [];
  const admissionGraphConflict = rawAdmissionCandidates.length > 1 ||
    rawAdmissionCandidates.some((candidate) => {
      const id = candidate?.candidate_admission_decision_id;
      return typeof id !== "string" || (index.admissionsById.get(id)?.length ?? 0) !== 1;
    });
  const admissionCandidates = commitment && sourceClosure && evaluation && experiment &&
    selectedSystemCode && !admissionGraphConflict
    ? rawAdmissionCandidates.flatMap((candidate) => {
        const conformanceCandidate = exactRef(
          candidate.paper_trading_handoff_conformance_ref,
          "paper_trading_handoff_conformance"
          ) ? index.conformances.get(
            candidate.paper_trading_handoff_conformance_ref.id
          ) : undefined;
        const conformance = conformanceCandidate && conformanceMatches(
          conformanceCandidate,
          candidate,
          evaluation,
          experiment,
          selectedSystemCode,
          graph.conformances
        ) ? conformanceCandidate : undefined;
        return admissionGraphMatches(candidate, {
          commitment,
          sourceClosure,
          evaluation,
          experiment,
          selectedSystemCode,
          conformance
        }) ? [{ admission: candidate, conformance }] : [];
      })
    : [];
  const admissionGraph = admissionCandidates.length === 1 ? admissionCandidates[0] : undefined;
  const admissionCandidate = admissionGraph?.admission;
  const validConformance = admissionGraph?.conformance;
  const findingCandidate = admissionCandidate && exactRef(
    admissionCandidate.research_finding_ref,
    "research_finding"
  ) ? index.findings.get(admissionCandidate.research_finding_ref.id) : undefined;
  const validFinding = findingCandidate && commitment && evaluation && experiment && worker &&
    direction && findingMatches(findingCandidate, {
      commitment,
      evaluation,
      experiment,
      worker,
      direction
    })
    ? findingCandidate
    : undefined;
  const behaviorComparisonRequired = admissionCandidate?.behavior_comparison_status ===
    "distinct" || admissionCandidate?.behavior_comparison_status === "duplicate";
  const behaviorComparisonExact = !behaviorComparisonRequired || Boolean(
    admissionCandidate && validFinding && commitment && evaluation && selectedSystemCode &&
    behaviorComparisonMatches({
      admission: admissionCandidate,
      finding: validFinding,
      commitment,
      evaluation,
      selectedSystemCode,
      graph,
      index
    })
  );
  const admissionIntegrityConflict = admissionGraphConflict ||
    behaviorComparisonRequired && !behaviorComparisonExact;
  const admission = admissionCandidate && validFinding && behaviorComparisonExact
    ? admissionCandidate
    : undefined;
  const conformance = admission ? validConformance : undefined;
  const selectedArtifactExact = selectedGraphMatches({
    commitment,
    sourceClosure,
    worker,
    direction,
    evaluation,
    experiment,
    admission,
    conformance,
    selectedSystemCode,
    knownConformances: graph.conformances
  });
  const lineageCandidates = selectedArtifactExact && selectedSystemCode && validFinding && worker &&
    commitment
    ? (index.lineagesBySystemCodeId.get(selectedSystemCode.system_code_id) ?? [])
      .filter((candidate) => lineageMatches(
        candidate,
        selectedSystemCode,
        validFinding,
        worker,
        commitment
      ))
    : [];
  const lineage = lineageCandidates.length === 1 ? lineageCandidates[0] : undefined;
  const candidateMaterializationExact = selectedArtifactExact && selectedSystemCode &&
    tick && tickResult?.status === "created" && safeIdentifier(tickResult.candidate_id)
    ? candidateMaterializationMatches({
        candidate: graph.candidates.get(tickResult.candidate_id),
        candidateId: tickResult.candidate_id,
        selectedSystemCode,
        tick,
        tickResult,
        index
      })
    : false;
  const terminalGraphComplete = Boolean(
    selectedArtifactExact && validFinding && !checkpointConflict &&
    (!checkpoint || checkpointAdmissionAgrees(checkpoint, admission, tickResult)) &&
    evaluation?.result_status === "accepted" &&
    evaluation.evidence_disposition === "not_counted" &&
    admission?.status === "admitted" &&
    admission.reason === "evaluation_accepted" &&
    validConformance?.status === "passed" &&
    validConformance.reason === "passed" &&
    candidateMaterializationExact &&
    terminalTickCandidateMatches(
      tick,
      tickResult,
      admission,
      commitment,
      evaluation,
      validConformance,
      checkpoint
    )
  );
  const evidenceInputs: ResearchEvidenceArtifactReadModel[] = [];
  let missingEvidence = false;
  for (const binding of commitment?.methodology?.evidence_bindings ?? []) {
    const record = exactRef(binding.evidence_artifact_ref, "research_evidence_artifact")
      ? index.evidence.get(binding.evidence_artifact_ref.id)
      : undefined;
    if (!record || !validDigest(binding.evidence_artifact_digest) ||
      !validDigest(record.artifact_digest) ||
      record.artifact_digest !== binding.evidence_artifact_digest ||
      record.sanitization_status !== "sanitized" ||
      Date.parse(record.captured_at) > Date.parse(commitment!.committed_at)) {
      missingEvidence = true;
      continue;
    }
    const evidenceSummary = bounded(record.summary);
    evidenceInputs.push({
      evidence_artifact_id: record.research_evidence_artifact_id,
      source_kind: record.source_kind,
      subject_ref: copyRef(record.subject_ref),
      artifact_ref: copyRef(record.artifact_ref),
      artifact_digest: record.artifact_digest,
      summary: evidenceSummary.value,
      truncated: record.truncated || evidenceSummary.truncated,
      captured_at: record.captured_at,
      sanitization_status: "sanitized",
      qualification_evidence_hidden: true,
      authority_status: "research_only"
    });
  }
  const latestEvidenceRecord = (commitment?.methodology?.evidence_bindings ?? [])
    .map((binding) => {
      const record = index.evidence.get(binding.evidence_artifact_ref.id);
      return record?.artifact_digest === binding.evidence_artifact_digest &&
        record.sanitization_status === "sanitized" ? record : undefined;
    })
    .filter((candidate): candidate is ResearchEvidenceArtifactRecord => Boolean(candidate))
    .sort((left, right) => right.captured_at.localeCompare(left.captured_at))[0];
  return {
    allocation,
    selection,
    workItemId,
    commitment,
    commitmentAmbiguous: rawCommitmentConflict,
    direction,
    worker,
    checkpoint,
    checkpointAmbiguous: checkpointConflict,
    tick,
    tickResult,
    tickAmbiguous: tickConflict,
    runtime,
    evaluation,
    experiment,
    admission,
    conformance,
    finding: admission ? validFinding : undefined,
    lineage,
    selectedSystemCode,
    selectedArtifactExact,
    selectedArtifactExpected,
    evaluationChainAmbiguous: evaluationChainConflict,
    evaluationGraphConflict,
    admissionGraphConflict,
    admissionIntegrityConflict,
    terminalGraphComplete,
    evidenceInputs,
    ...(latestEvidenceRecord ? {
      latestEvidenceSummary: latestEvidenceRecord.summary
    } : {}),
    triggerEvidenceExact: triggerEvidenceMatches(allocation.trigger, index.evidence),
    missingEvidence: missingEvidence || Boolean(
      commitment?.methodology?.evidence_bindings.length && evidenceInputs.length === 0
    )
  };
}

function projectSummary(
  source: SessionSource,
  health: CandidateArenaRunnerHealthReadModel
): ResearchSessionSummaryReadModel {
  const degraded = degradedReasons(source);
  const resolution = resolveStatus(source, health, degraded);
  const trigger = validTrigger(source.allocation.trigger)
    ? source.allocation.trigger
    : undefined;
  const methodology = source.commitment?.methodology;
  const submissionCount = source.checkpoint?.development_budget.recorded_submission_count ?? 0;
  const maxSubmissions = source.commitment?.development_policy.submission_limit ??
    source.selection.experiment_budget;
  const tickExperimentCount = source.commitment &&
    source.tickResult?.research_preflight?.commitment_id ===
      source.commitment.research_preflight_commitment_id &&
    source.tickResult.research_preflight.development_submission_count <=
      source.selection.experiment_budget
    ? source.tickResult.research_preflight.development_submission_count
    : undefined;
  // Checkpoint and terminal-tick counts cover the full bounded development loop.
  // A lone legacy sealed ExperimentRun proves only one completed experiment.
  const completedExperimentCount = source.checkpoint
    ?.development_budget.recorded_submission_count ??
    tickExperimentCount ?? (source.experiment?.status === "evaluated" ? 1 : 0);
  const latestProgress = terminalProgress(source, resolution.status) ??
    source.latestEvidenceSummary ??
    (
      resolution.status === "running" ? "Research work is running." :
      resolution.status === "allocating" ? "Research work is allocating." :
      resolution.status === "queued" ? "Research work is queued." :
      "Research work requires recovery."
    );
  const latestProgressText = bounded(latestProgress);
  const triggerGoal = trigger ? bounded(trigger.goal) : undefined;
  const methodologyHypothesis = methodology
    ? bounded(methodology.hypothesis)
    : undefined;
  const methodologyMethod = methodology ? bounded(methodology.method) : undefined;
  const providerModel = source.worker?.model
    ? bounded(source.worker.model)
    : undefined;
  return {
    identity_kind: "derived_projection",
    research_work_item_id: source.workItemId,
    research_allocation_id: source.allocation.candidate_arena_research_allocation_id,
    direction_kind: source.selection.direction_kind,
    ...(source.worker ? { research_worker_id: source.worker.research_worker_id } : {}),
    ...(source.commitment ? {
      commitment_id: source.commitment.research_preflight_commitment_id
    } : {}),
    status: resolution.status,
    status_basis: resolution.basis,
    projection_health: degraded.length === 0 ? "complete" : "degraded",
    degraded_reasons: degraded,
    budget: {
      max_experiment_count: source.selection.experiment_budget,
      completed_experiment_count: completedExperimentCount,
      max_development_submission_count: maxSubmissions,
      development_submission_count: submissionCount,
      remaining_development_submission_count: Math.max(0, maxSubmissions - submissionCount),
      authority_status: "research_only"
    },
    allocated_at: source.allocation.allocated_at,
    ...(source.commitment ? { started_at: source.commitment.committed_at } : {}),
    last_progress_at: latestProgressAt(source),
    ...(terminalCompletedAt(source, resolution.status)
      ? { completed_at: terminalCompletedAt(source, resolution.status) }
      : {}),
    ...(source.evaluation?.selected_development_submission_sequence !== undefined
      ? { selected_submission_sequence: source.evaluation.selected_development_submission_sequence }
      : {}),
    ...(source.terminalGraphComplete && source.tickResult?.candidate_id
      ? { admitted_candidate_id: source.tickResult.candidate_id }
      : {}),
    latest_progress_summary: latestProgressText.value,
    latest_progress_summary_truncated: latestProgressText.truncated,
    ...(trigger ? {
      trigger_availability: "available" as const,
      trigger: {
        trigger_kind: trigger.trigger_kind,
        trigger_id: trigger.trigger_id,
        goal: triggerGoal!.value,
        goal_truncated: triggerGoal!.truncated,
        triggered_at: trigger.triggered_at,
        ...(privacySafeEvidenceRef(trigger.source_ref)
          ? { source_ref: copyRef(trigger.source_ref) }
          : {}),
        ...(source.triggerEvidenceExact &&
          exactRef(trigger.evidence_artifact_ref, "research_evidence_artifact") &&
          validDigest(trigger.evidence_artifact_digest)
          ? {
              evidence_artifact_ref: copyRef(trigger.evidence_artifact_ref) as Ref & {
                record_kind: "research_evidence_artifact";
              },
              evidence_artifact_digest: trigger.evidence_artifact_digest
            }
          : {}),
        authority_status: "research_only"
      }
    } : { trigger_availability: "unavailable" as const }),
    ...(methodology && source.direction ? {
      methodology_availability: "available" as const,
      methodology: {
        direction_kind: source.direction.direction_kind,
        hypothesis: methodologyHypothesis!.value,
        hypothesis_truncated: methodologyHypothesis!.truncated,
        method: methodologyMethod!.value,
        method_truncated: methodologyMethod!.truncated,
        ...(methodology.source_candidate_id
          ? { source_candidate_id: methodology.source_candidate_id }
          : {}),
        evidence_artifact_ids: source.evidenceInputs.map((entry) =>
          entry.evidence_artifact_id
        ),
        authority_status: "research_only"
      }
    } : { methodology_availability: "unavailable" as const }),
    ...(source.worker?.provider_kind ? {
      provider_availability: "available" as const,
      provider: source.worker.provider_kind,
      ...(providerModel ? {
        model: providerModel.value,
        model_truncated: providerModel.truncated
      } : {})
    } : { provider_availability: "unavailable" as const }),
    authority_status: "research_only"
  };
}

function projectDetail(
  source: SessionSource,
  health: CandidateArenaRunnerHealthReadModel
): ResearchSessionDetailReadModel {
  const summary = projectSummary(source, health);
  const { selected_submission_sequence: _summarySelection, ...summaryWithoutSelection } = summary;
  const currentEntries = (source.checkpoint?.notebook.recent_entries ?? [])
    .filter((candidate) => candidate.candidate_arena_tick_id === source.commitment?.candidate_arena_tick_id)
    .sort((left, right) => left.iteration - right.iteration || left.sequence - right.sequence)
    .slice(-HISTORY_LIMIT);
  const selectedSequence = source.evaluation?.selected_development_submission_sequence;
  const submissions: ResearchDevelopmentSubmissionReadModel[] = currentEntries.map((candidate) => {
    const selected = candidate.iteration === selectedSequence && source.selectedArtifactExact &&
      source.selectedSystemCode !== undefined;
    const submissionSummary = bounded(candidate.summary);
    const base = {
      submission_sequence: candidate.iteration,
      decision: candidate.decision,
      agent_status: candidate.agent_status,
      evaluation_status: candidate.evaluation_status,
      risk_decision: candidate.risk_decision,
      net_revenue_usdt: candidate.net_revenue_usdt,
      summary: submissionSummary.value,
      summary_truncated: submissionSummary.truncated,
      authority_status: "research_only" as const
    };
    return selected ? {
      ...base,
      selected: true,
      artifact_availability: "selected_system_code_available",
      selected_system_code_ref: {
        record_kind: "system_code",
        id: source.selectedSystemCode!.system_code_id
      },
      selected_system_code_artifact_digest: source.selectedSystemCode!.artifact_digest
    } : {
      ...base,
      selected: false,
      artifact_availability: "not_persisted"
    };
  });
  const recorded = source.checkpoint?.development_budget.recorded_submission_count;
  const selectionProjection = selectedSequence === undefined
    ? source.selectedArtifactExpected
      ? { selected_artifact_availability: "unavailable" as const }
      : { selected_artifact_availability: "not_selected" as const }
    : source.selectedArtifactExact && source.selectedSystemCode
      ? {
          selected_artifact_availability: "available" as const,
          selected_submission_sequence: selectedSequence,
          selected_system_code_ref: {
            record_kind: "system_code" as const,
            id: source.selectedSystemCode.system_code_id
          },
          selected_system_code_artifact_digest: source.selectedSystemCode.artifact_digest
        }
      : {
          selected_artifact_availability: "unavailable" as const,
          selected_submission_sequence: selectedSequence
        };
  return {
    ...summaryWithoutSelection,
    evidence_inputs: source.evidenceInputs,
    development_submissions: submissions,
    ...(source.admission ? {
      admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: source.admission.candidate_admission_decision_id
      }
    } : {}),
    ...(source.conformance ? {
      paper_handoff_conformance_ref: {
        record_kind: "paper_trading_handoff_conformance",
        id: source.conformance.paper_trading_handoff_conformance_id
      }
    } : {}),
    notebook_summary: submissions.map((entry) => entry.summary),
    notebook_summary_truncated: submissions.some((entry) =>
      entry.summary_truncated
    ),
    lifecycle_events: lifecycleEvents(source),
    provider_logs_availability: "not_persisted",
    terminal_graph: terminalGraph(source),
    ...(recorded === undefined ? {
      submission_history_availability: "unavailable_until_checkpoint" as const
    } : {
      submission_history_availability: "checkpoint_summary" as const,
      recorded_submission_count: recorded,
      projected_submission_count: submissions.length,
      omitted_submission_count: Math.max(0, recorded - submissions.length),
      submission_history_truncated: recorded > submissions.length
    }),
    ...selectionProjection
  };
}

function terminalGraph(source: SessionSource): ResearchSessionTerminalGraphReadModel {
  const selectedEvaluation = source.evaluation && source.experiment ? {
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result" as const,
      id: source.evaluation.trading_evaluation_result_id
    },
    experiment_run_ref: {
      record_kind: "experiment_run" as const,
      id: source.experiment.experiment_run_id
    },
    evaluation_phase: "sealed_admission" as const,
    result_status: source.evaluation.result_status,
    evidence_disposition: source.evaluation.evidence_disposition,
    completed_at: source.evaluation.completed_at,
    authority_status: "read_only" as const
  } : undefined;
  const admission = source.admission ? {
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision" as const,
      id: source.admission.candidate_admission_decision_id
    },
    status: source.admission.status,
    reason: source.admission.reason,
    decided_at: source.admission.decided_at,
    authority_status: "read_only" as const
  } : undefined;
  const conformance = source.conformance ? {
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance" as const,
      id: source.conformance.paper_trading_handoff_conformance_id
    },
    status: source.conformance.status,
    reason: source.conformance.reason,
    completed_at: source.conformance.completed_at,
    evidence_digest: source.conformance.evidence_digest,
    authority_status: "read_only" as const
  } : undefined;
  const findingSummary = source.finding ? bounded(source.finding.summary) : undefined;
  const finding = source.finding ? {
    research_finding_ref: {
      record_kind: "research_finding" as const,
      id: source.finding.research_finding_id
    },
    finding_kind: source.finding.finding_kind,
    summary: findingSummary!.value,
    summary_truncated: findingSummary!.truncated,
    supporting_record_refs: source.finding.supporting_record_refs
      .filter(validRef)
      .map(copyRef),
    created_at: source.finding.created_at,
    sanitized: true as const,
    authority_status: "read_only" as const
  } : undefined;
  const lineage = source.lineage ? {
    artifact_lineage_ref: {
      record_kind: "artifact_lineage" as const,
      id: source.lineage.artifact_lineage_id
    },
    child_system_code_ref: {
      record_kind: "system_code" as const,
      id: source.lineage.child_system_code_ref.id
    },
    ...(exactRef(source.lineage.parent_system_code_ref, "system_code") ? {
      parent_system_code_ref: {
        record_kind: "system_code" as const,
        id: source.lineage.parent_system_code_ref!.id
      }
    } : {}),
    source_finding_refs: source.lineage.source_finding_refs
      .filter((candidate) => exactRef(candidate, "research_finding"))
      .map((candidate) => ({
        record_kind: "research_finding" as const,
        id: candidate.id
      })),
    ...(exactRef(source.lineage.created_by_research_worker_ref, "research_worker") ? {
      created_by_research_worker_ref: {
        record_kind: "research_worker" as const,
        id: source.lineage.created_by_research_worker_ref!.id
      }
    } : {}),
    created_at: source.lineage.created_at,
    authority_status: "read_only" as const
  } : undefined;
  if (source.terminalGraphComplete && selectedEvaluation && admission && conformance &&
    source.tick && source.tickResult?.candidate_id &&
    selectedEvaluation.result_status === "accepted" &&
    selectedEvaluation.evidence_disposition === "not_counted" &&
    admission.status === "admitted" && admission.reason === "evaluation_accepted" &&
    conformance.status === "passed" && conformance.reason === "passed") {
    return {
      selected_sealed_evaluation: {
        ...selectedEvaluation,
        result_status: "accepted",
        evidence_disposition: "not_counted"
      },
      admission: {
        ...admission,
        status: "admitted",
        reason: "evaluation_accepted"
      },
      paper_handoff_conformance: {
        ...conformance,
        status: "passed",
        reason: "passed"
      },
      ...(finding ? { finding } : {}),
      ...(lineage ? { artifact_lineage: lineage } : {}),
      admitted_arena_handoff: {
        candidate_arena_tick_ref: {
          record_kind: "candidate_arena_tick",
          id: source.tick.candidate_arena_tick_id
        },
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: source.tickResult.candidate_id
        },
        direction_kind: source.selection.direction_kind,
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: source.admission!.candidate_admission_decision_id
        },
        completed_at: source.tick.completed_at,
        authority_status: "read_only"
      },
      authority_status: "read_only"
    };
  }
  return {
    ...(selectedEvaluation ? { selected_sealed_evaluation: selectedEvaluation } : {}),
    ...(admission ? { admission } : {}),
    ...(conformance ? { paper_handoff_conformance: conformance } : {}),
    ...(finding ? { finding } : {}),
    ...(lineage ? { artifact_lineage: lineage } : {}),
    authority_status: "read_only"
  };
}

function lifecycleEvents(source: SessionSource): ResearchLifecycleEventReadModel[] {
  const pending: Array<Omit<ResearchLifecycleEventReadModel, "sequence">> = [{
    occurred_at: source.allocation.allocated_at,
    event_kind: "allocation",
    summary: "Research direction allocated.",
    summary_truncated: false,
    source_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: source.allocation.candidate_arena_research_allocation_id
    },
    sanitized: true,
    authority_status: "read_only"
  }];
  if (source.commitment) pending.push({
    occurred_at: source.commitment.committed_at,
    event_kind: "commitment",
    summary: "Research preflight committed.",
    summary_truncated: false,
    source_ref: {
      record_kind: "research_preflight_commitment",
      id: source.commitment.research_preflight_commitment_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  if (source.evaluation) pending.push({
    occurred_at: source.evaluation.completed_at,
    event_kind: "evaluation",
    ...lifecycleSummary(`Sealed evaluation ${source.evaluation.result_status}.`),
    source_ref: {
      record_kind: "trading_evaluation_result",
      id: source.evaluation.trading_evaluation_result_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  if (source.conformance) pending.push({
    occurred_at: source.conformance.completed_at,
    event_kind: "handoff_conformance",
    ...lifecycleSummary(`Paper handoff conformance ${source.conformance.status}.`),
    source_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: source.conformance.paper_trading_handoff_conformance_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  if (source.admission) pending.push({
    occurred_at: source.admission.decided_at,
    event_kind: "admission",
    ...lifecycleSummary(`Candidate admission ${source.admission.status}.`),
    source_ref: {
      record_kind: "candidate_admission_decision",
      id: source.admission.candidate_admission_decision_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  if (source.checkpoint) pending.push({
    occurred_at: source.checkpoint.closed_at,
    event_kind: "checkpoint",
    ...lifecycleSummary(`Research checkpoint ${source.checkpoint.terminal_reason}.`),
    source_ref: {
      record_kind: "research_worker_checkpoint",
      id: source.checkpoint.research_worker_checkpoint_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  if (source.tick) pending.push({
    occurred_at: source.tick.completed_at,
    event_kind: "tick",
    ...lifecycleSummary(`Candidate Arena tick ${source.tick.status}.`),
    source_ref: {
      record_kind: "candidate_arena_tick",
      id: source.tick.candidate_arena_tick_id
    },
    sanitized: true,
    authority_status: "read_only"
  });
  return pending
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at) ||
      left.event_kind.localeCompare(right.event_kind))
    .slice(-HISTORY_LIMIT)
    .map((event, index) => ({ ...event, sequence: index + 1 }));
}

function resolveStatus(
  source: SessionSource,
  health: CandidateArenaRunnerHealthReadModel,
  degraded: ResearchSessionDegradedReason[]
): {
  status: ResearchSessionSummaryReadModel["status"];
  basis: ResearchSessionStatusBasisReadModel;
} {
  if (source.commitmentAmbiguous) {
    return status("recovering", "incomplete_persisted_graph");
  }
  if (source.checkpointAmbiguous) {
    return status("failed_closed", "incomplete_persisted_graph");
  }
  if (source.evaluationChainAmbiguous || source.admissionIntegrityConflict) {
    return status("recovering", "incomplete_persisted_graph");
  }
  const admissionCheckpointAgrees = !source.checkpoint || checkpointAdmissionAgrees(
    source.checkpoint,
    source.admission,
    source.tickResult
  );
  if (source.admission && admissionCheckpointAgrees) {
    return status(source.admission.status, "candidate_admission_decision", {
      record_kind: "candidate_admission_decision",
      id: source.admission.candidate_admission_decision_id
    });
  }
  if (source.checkpoint) {
    if (source.checkpoint.terminal_reason === "finished_without_submission") {
      return status("finished_without_submission", "research_worker_checkpoint", {
        record_kind: "research_worker_checkpoint",
        id: source.checkpoint.research_worker_checkpoint_id
      });
    }
    if (source.checkpoint.terminal_reason === "admission_recorded") {
      addReason(degraded, "terminal_admission_unavailable");
    }
    return status("failed_closed", "research_worker_checkpoint", {
      record_kind: "research_worker_checkpoint",
      id: source.checkpoint.research_worker_checkpoint_id
    });
  }
  if (source.tickAmbiguous) {
    return status("recovering", "incomplete_persisted_graph");
  }
  if (source.tickResult && source.tick) {
    if (source.tickResult.status === "no_submission") {
      return status("finished_without_submission", "candidate_arena_tick", {
        record_kind: "candidate_arena_tick",
        id: source.tick.candidate_arena_tick_id
      });
    }
    if (source.tickResult.status === "created" || source.tickResult.status === "duplicate" ||
      source.tickResult.status === "quarantined") {
      addReason(degraded, "terminal_admission_unavailable");
    }
    return status("failed_closed", "candidate_arena_tick", {
      record_kind: "candidate_arena_tick",
      id: source.tick.candidate_arena_tick_id
    });
  }
  if (source.runtime && health.active_tick_id === source.allocation.tick_id) {
    if (source.runtime.phase === "failed_closed_pending_tick") {
      return status("failed_closed", "runtime_research_work_item");
    }
    if (source.runtime.phase === "running" && source.commitment &&
      source.runtime.commitment_id === source.commitment.research_preflight_commitment_id) {
      return status("running", "runtime_research_work_item", {
        record_kind: "research_preflight_commitment",
        id: source.commitment.research_preflight_commitment_id
      });
    }
    return status("allocating", "runtime_research_work_item");
  }
  if (health.active_tick_id === source.allocation.tick_id) {
    return status("queued", "active_tick_queue", {
      record_kind: "candidate_arena_research_allocation",
      id: source.allocation.candidate_arena_research_allocation_id
    });
  }
  addReason(degraded, "inactive_incomplete_graph");
  return status("recovering", "incomplete_persisted_graph");
}

function status(
  value: ResearchSessionSummaryReadModel["status"],
  basisKind: ResearchSessionStatusBasisReadModel["basis_kind"],
  sourceRef?: Ref
): {
  status: ResearchSessionSummaryReadModel["status"];
  basis: ResearchSessionStatusBasisReadModel;
} {
  return {
    status: value,
    basis: {
      basis_kind: basisKind,
      ...(sourceRef ? { source_ref: sourceRef } : {}),
      authority_status: "read_only"
    }
  };
}

function degradedReasons(source: SessionSource): ResearchSessionDegradedReason[] {
  const reasons: ResearchSessionDegradedReason[] = [];
  if (!validTrigger(source.allocation.trigger)) addReason(reasons, "trigger_unavailable");
  if (!source.commitment?.methodology || !source.direction) {
    addReason(reasons, "methodology_unavailable");
  }
  if (!source.worker) addReason(reasons, "worker_unavailable");
  if (!source.worker?.provider_kind) addReason(reasons, "provider_unavailable");
  if (source.missingEvidence || (source.commitment?.methodology?.evidence_bindings.length ?? 0) >
    source.evidenceInputs.length) {
    addReason(reasons, "evidence_artifact_unavailable");
  }
  if (source.allocation.trigger?.evidence_artifact_ref && !source.triggerEvidenceExact) {
    addReason(reasons, "evidence_artifact_unavailable");
  }
  if (source.selectedArtifactExpected &&
    !source.selectedArtifactExact) {
    addReason(reasons, "selected_artifact_unavailable");
  }
  if (source.admissionGraphConflict) {
    addReason(reasons, "admission_graph_conflict");
  }
  if (source.evaluationGraphConflict) {
    addReason(reasons, "evaluation_graph_conflict");
  }
  if (source.commitmentAmbiguous || source.checkpointAmbiguous ||
    source.tickAmbiguous || source.evaluationChainAmbiguous ||
    source.admissionIntegrityConflict) {
    addReason(reasons, "inactive_incomplete_graph");
  }
  if (source.admissionIntegrityConflict) {
    addReason(reasons, "terminal_admission_unavailable");
  }
  if (source.admission?.status === "admitted" && !source.terminalGraphComplete) {
    addReason(reasons, "terminal_admission_unavailable");
  }
  if (source.admission && (
    exactRef(source.admission.research_finding_ref, "research_finding") && !source.finding ||
    exactRef(
      source.admission.paper_trading_handoff_conformance_ref,
      "paper_trading_handoff_conformance"
    ) && !source.conformance
  )) {
    addReason(reasons, "terminal_admission_unavailable");
  }
  return reasons;
}

function selectedGraphMatches(input: {
  commitment?: ResearchPreflightCommitmentRecord;
  sourceClosure?: ValidatedSourceClosure;
  worker?: ResearchWorkerRecord;
  direction?: ResearchDirectionRecord;
  evaluation?: TradingEvaluationResultRecord;
  experiment?: ExperimentRunRecord;
  admission?: CandidateAdmissionDecisionRecord;
  conformance?: PaperTradingHandoffConformanceRecord;
  selectedSystemCode?: SystemCodeRecord;
  knownConformances?: PaperTradingHandoffConformanceRecord[];
}): boolean {
  const {
    commitment,
    sourceClosure,
    worker,
    direction,
    evaluation,
    experiment,
    admission,
    conformance,
    selectedSystemCode,
    knownConformances
  } = input;
  return Boolean(commitment && sourceClosure && worker && direction && evaluation &&
    experiment && admission && selectedSystemCode &&
    evaluationChainMatches({
      commitment,
      sourceClosure,
      worker,
      direction,
      evaluation,
      experiment,
      selectedSystemCode
    }) && admissionGraphMatches(admission, {
      commitment,
      sourceClosure,
      evaluation,
      experiment,
      selectedSystemCode,
      conformance
    }) && (admission.paper_trading_handoff_conformance_ref
      ? Boolean(conformance && conformanceMatches(
          conformance,
          admission,
          evaluation,
          experiment,
          selectedSystemCode,
          knownConformances
        ))
      : conformance === undefined));
}

function allocationHasCanonicalRuntimeShape(
  allocation: CandidateArenaResearchAllocationRecord
): boolean {
  return candidateArenaResearchAllocationHasRuntimeShape(allocation) &&
    safeIdentifier(allocation.candidate_arena_research_allocation_id) &&
    allocation.allocation_digest === canonicalDigest(
      candidateArenaResearchAllocationDigestInput(allocation)
    );
}

function allocationHasUniqueRawOrigin(
  allocation: CandidateArenaResearchAllocationRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const id = allocation?.candidate_arena_research_allocation_id;
  if (typeof id !== "string" || (index.allocationsById.get(id)?.length ?? 0) !== 1) {
    return false;
  }
  const trigger = allocation?.trigger;
  if (trigger?.trigger_kind !== "arena_event") return true;
  const evidenceDigest = trigger.evidence_artifact_digest;
  return typeof evidenceDigest === "string" &&
    (index.arenaEventAllocationsByEvidenceDigest.get(evidenceDigest)?.length ?? 0) === 1;
}

function allocationMatchesPolicyProvenance(
  allocation: CandidateArenaResearchAllocationRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  if (!allocationHasCanonicalRuntimeShape(allocation)) return false;
  const basis = allocation.allocation_policy_basis;
  const policyDigest = canonicalDigest(
    paperTradingComparisonPersistedRecordDigestInput(allocation.policy)
  );
  if (basis.basis_kind === "research_allocation_policy_decision") {
    const matches = index.allocationPolicyDecisionsById.get(
      basis.policy_decision_ref.id
    ) ?? [];
    const outcomeOwners = index.allocationPolicyDecisionsByOutcomeId.get(
      basis.study_outcome_ref.id
    ) ?? [];
    const decision = matches.length === 1 ? matches[0] : undefined;
    return Boolean(decision && outcomeOwners.length === 1 &&
      outcomeOwners[0] === decision &&
      researchAllocationPolicyDecisionHasRuntimeShape(decision) &&
      decision.policy_decision_digest === canonicalDigest(
        researchAllocationPolicyDecisionDigestInput(decision)
      ) && decision.policy_decision_digest === basis.policy_decision_digest &&
      decision.study_outcome_ref.id === basis.study_outcome_ref.id &&
      decision.study_outcome_digest === basis.study_outcome_digest &&
      decision.decision_status === "approved" &&
      decision.effective_default_mode === allocation.allocation_mode &&
      decision.decision_policy.target_allocation_mode === allocation.allocation_mode &&
      decision.target_allocation_policy_digest === policyDigest &&
      Date.parse(decision.decided_at) < Date.parse(allocation.allocated_at) &&
      allocationDecisionMatchesSourceGraph(decision, index));
  }
  if (basis.basis_kind === "research_generalization_policy_decision") {
    const matches = index.generalizationPolicyDecisionsById.get(
      basis.policy_decision_ref.id
    ) ?? [];
    const outcomeOwners = index.generalizationPolicyDecisionsByOutcomeId.get(
      basis.generalization_outcome_ref.id
    ) ?? [];
    const decision = matches.length === 1 ? matches[0] : undefined;
    return Boolean(decision && outcomeOwners.length === 1 &&
      outcomeOwners[0] === decision &&
      researchGeneralizationPolicyDecisionHasRuntimeShape(decision) &&
      decision.policy_decision_digest === canonicalDigest(
        researchGeneralizationPolicyDecisionDigestInput(decision)
      ) && decision.policy_decision_digest === basis.policy_decision_digest &&
      decision.generalization_outcome_ref.id === basis.generalization_outcome_ref.id &&
      decision.generalization_outcome_digest === basis.generalization_outcome_digest &&
      decision.decision_status === "approved" &&
      decision.effective_default_mode === allocation.allocation_mode &&
      decision.decision_policy.target_allocation_mode === allocation.allocation_mode &&
      decision.target_allocation_policy_digest === policyDigest &&
      Date.parse(decision.decided_at) < Date.parse(allocation.allocated_at) &&
      generalizationDecisionMatchesSourceGraph(decision, index));
  }
  return true;
}

function allocationDecisionMatchesSourceGraph(
  decision: ResearchAllocationPolicyDecisionRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const studies = index.controlStudiesById.get(decision.study_ref.id) ?? [];
  const outcomes = index.controlStudyOutcomesById.get(decision.study_outcome_ref.id) ?? [];
  const studyOutcomeOwners = index.controlStudyOutcomesByStudyId.get(decision.study_ref.id) ?? [];
  const study = studies.length === 1 ? studies[0] : undefined;
  const outcome = outcomes.length === 1 ? outcomes[0] : undefined;
  if (!study || !outcome || studyOutcomeOwners.length !== 1 ||
    studyOutcomeOwners[0] !== outcome || !researchControlStudyHasRuntimeShape(study) ||
    study.research_control_study_id !== researchControlStudyId(study.idempotency_key) ||
    !study.replications.every((replication) =>
      replication.campaign_ref.id ===
        researchControlCampaignId(replication.campaign_idempotency_key)
    ) ||
    study.condition.condition_digest !== canonicalDigest(
      researchControlStudyConditionDigestInput(study.condition)
    ) || study.study_digest !== canonicalDigest(researchControlStudyDigestInput(study)) ||
    study.condition.allocation_policy_digest !== canonicalDigest(
      paperTradingComparisonPersistedRecordDigestInput(study.condition.allocation_policy)
    ) || !researchControlStudyOutcomeHasRuntimeShape(outcome) ||
    outcome.study_outcome_digest !== canonicalDigest(
      researchControlStudyOutcomeDigestInput(outcome)
    )) {
    return false;
  }
  try {
    return isDeepStrictEqual(decision, decideResearchAllocationPolicyDecision({
      study,
      outcome,
      decidedAt: decision.decided_at
    }));
  } catch {
    return false;
  }
}

function generalizationDecisionMatchesSourceGraph(
  decision: ResearchGeneralizationPolicyDecisionRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const protocols = index.generalizationProtocolsById.get(decision.protocol_ref.id) ?? [];
  const outcomes = index.generalizationOutcomesById.get(
    decision.generalization_outcome_ref.id
  ) ?? [];
  const protocolOutcomeOwners = index.generalizationOutcomesByProtocolId.get(
    decision.protocol_ref.id
  ) ?? [];
  const protocol = protocols.length === 1 ? protocols[0] : undefined;
  const outcome = outcomes.length === 1 ? outcomes[0] : undefined;
  if (!protocol || !outcome || protocolOutcomeOwners.length !== 1 ||
    protocolOutcomeOwners[0] !== outcome ||
    !researchGeneralizationProtocolHasRuntimeShape(protocol) ||
    protocol.research_generalization_protocol_id !==
      researchGeneralizationProtocolId(protocol.idempotency_key) ||
    protocol.paper_evaluation_protocol.protocol_digest !== canonicalDigest(
      researchControlCampaignPaperEvaluationProtocolDigestInput(
        protocol.paper_evaluation_protocol
      )
    ) ||
    protocol.market_classifier_policy.classifier_digest !== canonicalDigest(
      researchGeneralizationMarketClassifierPolicyDigestInput(
        protocol.market_classifier_policy
      )
    ) ||
    !protocol.study_slots.every((slot) =>
      slot.study_ref.id === researchControlStudyId(slot.study_idempotency_key) &&
      slot.replication_idempotency_keys.length === 6 &&
      slot.replication_idempotency_keys.every((key, index) =>
        key === `${slot.study_idempotency_key}:replication:${index + 1}`
      )
    ) ||
    protocol.protocol_digest !== canonicalDigest(
      researchGeneralizationProtocolDigestInput(protocol)
    ) || protocol.target_allocation_policy_digest !== canonicalDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        protocol.target_allocation_policy
      )
    ) || !researchGeneralizationOutcomeHasRuntimeShape(outcome) ||
    outcome.outcome_digest !== canonicalDigest(
      researchGeneralizationOutcomeDigestInput(outcome)
    ) || outcome.slot_results.length !== protocol.study_slots.length ||
    !outcome.slot_results.every((result, index) => {
      const slot = protocol.study_slots[index];
      return slot !== undefined &&
        exactSameRef(result.planned_study_ref, slot.study_ref) &&
        (result.study_ref == null ||
          exactSameRef(result.study_ref, slot.study_ref));
    })) {
    return false;
  }
  try {
    return isDeepStrictEqual(decision, decideResearchGeneralizationPolicyDecision({
      protocol,
      outcome,
      decidedAt: decision.decided_at
    }));
  } catch {
    return false;
  }
}

function commitmentHasCanonicalRuntimeShape(
  commitment: ResearchPreflightCommitmentRecord
): boolean {
  return researchPreflightCommitmentHasRuntimeShape(commitment) &&
    safeIdentifier(commitment.research_preflight_commitment_id) &&
    commitment.commitment_digest === canonicalDigest(
      researchPreflightCommitmentDigestInput(commitment)
    );
}

function commitmentHasUniqueRawOwnership(
  commitment: ResearchPreflightCommitmentRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const commitmentId = commitment?.research_preflight_commitment_id;
  const rotationDigest = commitment?.sealed_admission_policy?.rotation_commitment_digest;
  const suiteDigest = commitment?.sealed_admission_policy?.suite_digest;
  return typeof commitmentId === "string" && typeof rotationDigest === "string" &&
    typeof suiteDigest === "string" &&
    (index.commitmentsById.get(commitmentId)?.length ?? 0) === 1 &&
    (index.commitmentsByRotationDigest.get(rotationDigest)?.length ?? 0) === 1 &&
    (index.commitmentsBySuiteDigest.get(suiteDigest)?.length ?? 0) === 1;
}

function rawCommitmentTargetsSelection(
  commitment: ResearchPreflightCommitmentRecord,
  allocation: CandidateArenaResearchAllocationRecord,
  selection: CandidateArenaResearchAllocationSelection,
  directions: Map<string, ResearchDirectionRecord>
): boolean {
  if (commitment?.research_allocation_ref?.id !==
      allocation.candidate_arena_research_allocation_id ||
    commitment?.candidate_arena_tick_id !== allocation.tick_id) {
    return false;
  }
  const directionId = commitment?.research_direction_ref?.id;
  return typeof directionId === "string" &&
    directions.get(directionId)?.direction_kind === selection.direction_kind;
}

function validatedCommitmentSourceClosure(input: {
  commitment: ResearchPreflightCommitmentRecord;
  allocation: CandidateArenaResearchAllocationRecord;
  selection: CandidateArenaResearchAllocationSelection;
  direction?: ResearchDirectionRecord;
  worker?: ResearchWorkerRecord;
  sourceSystemCode?: SystemCodeRecord;
  projectionIndex: ResearchOperationsProjectionIndex;
  evidence: Map<string, ResearchEvidenceArtifactRecord>;
  checkpointIndex: CheckpointValidationIndex;
}): ValidatedSourceClosure | undefined {
  const {
    commitment,
    allocation,
    selection,
    direction,
    worker,
    sourceSystemCode,
    projectionIndex,
    evidence,
    checkpointIndex
  } = input;
  if (!commitmentHasCanonicalRuntimeShape(commitment) ||
    !exactRef(commitment.research_allocation_ref,
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id) ||
    commitment.research_allocation_digest !== allocation.allocation_digest ||
    commitment.candidate_arena_tick_id !== allocation.tick_id ||
    !directionRecordMatches(direction, selection.direction_kind) ||
    !workerRecordMatches(worker, direction) ||
    !systemCodeHasRuntimeShape(sourceSystemCode) ||
    selection.experiment_budget !== commitment.development_policy.submission_limit ||
    !exactRef(commitment.source_system_code_ref, "system_code",
      sourceSystemCode.system_code_id) ||
    Date.parse(commitment.committed_at) < Date.parse(allocation.allocated_at) ||
    Date.parse(commitment.committed_at) < Date.parse(direction.created_at) ||
    Date.parse(commitment.committed_at) < Date.parse(worker.created_at) ||
    Date.parse(commitment.committed_at) < Date.parse(sourceSystemCode.created_at) ||
    commitment.methodology &&
      (commitment.methodology.direction_kind !== direction.direction_kind ||
        commitment.methodology.source_candidate_id !== undefined &&
        !safeIdentifier(commitment.methodology.source_candidate_id))) {
    return undefined;
  }
  const methodology = commitment.methodology;
  if (methodology) {
    const boundEvidence = methodology.evidence_bindings.map((binding) =>
      exactRef(binding.evidence_artifact_ref, "research_evidence_artifact")
        ? evidence.get(binding.evidence_artifact_ref.id)
        : undefined
    );
    if (boundEvidence.some((artifact, index) => !artifact ||
      artifact.artifact_digest !== methodology.evidence_bindings[index]!
        .evidence_artifact_digest ||
      Date.parse(artifact.captured_at) > Date.parse(commitment.committed_at))) {
      return undefined;
    }
    const triggerEvidence = allocation.trigger?.evidence_artifact_ref;
    const triggerDigest = allocation.trigger?.evidence_artifact_digest;
    if (Boolean(triggerEvidence) !== Boolean(triggerDigest) || triggerEvidence &&
      !methodology.evidence_bindings.some((binding) =>
        exactSameRef(binding.evidence_artifact_ref, triggerEvidence) &&
        binding.evidence_artifact_digest === triggerDigest)) {
      return undefined;
    }
  } else if (allocation.trigger) {
    return undefined;
  }

  const sourceClosure = validatedSourceClosure({
    commitment,
    allocation,
    direction,
    worker,
    sourceSystemCode,
    projectionIndex
  });
  if (!sourceClosure) return undefined;

  const memoryPrior = commitment.memory_policy?.prior_checkpoint;
  if (!memoryPrior) return sourceClosure;
  const workerCommitments = checkpointIndex.commitmentsByWorkerId.get(
    worker.research_worker_id
  ) ?? [];
  const position = checkpointIndex.commitmentPositions.get(commitment);
  if (position === undefined) return undefined;
  const expectedPriorCommitment = position > 0 ? workerCommitments[position - 1] : undefined;
  if (memoryPrior.disposition === "none_available") {
    return expectedPriorCommitment === undefined ? sourceClosure : undefined;
  }
  const rawPriorCheckpoints = expectedPriorCommitment
    ? checkpointIndex.checkpointsByCommitmentId.get(
        expectedPriorCommitment.research_preflight_commitment_id
      ) ?? []
    : [];
  const priorCheckpoint = expectedPriorCommitment &&
    rawPriorCheckpoints.length === 1 &&
    checkpointMatches(rawPriorCheckpoints[0]!, {
      commitment: expectedPriorCommitment,
      worker,
      direction,
      index: checkpointIndex
    })
    ? rawPriorCheckpoints[0]
    : undefined;
  return expectedPriorCommitment && priorCheckpoint &&
    exactRef(memoryPrior.checkpoint_ref, "research_worker_checkpoint",
      priorCheckpoint.research_worker_checkpoint_id) &&
    memoryPrior.checkpoint_digest === priorCheckpoint.checkpoint_digest &&
    exactRef(priorCheckpoint.research_worker_ref, "research_worker",
      worker.research_worker_id) &&
    exactRef(priorCheckpoint.research_direction_ref, "research_direction",
      direction.research_direction_id) &&
    exactRef(priorCheckpoint.research_preflight_commitment_ref,
      "research_preflight_commitment",
      expectedPriorCommitment.research_preflight_commitment_id) &&
    Date.parse(priorCheckpoint.closed_at) <= Date.parse(commitment.committed_at)
    ? sourceClosure
    : undefined;
}

function validatedSourceClosure(input: {
  commitment: ResearchPreflightCommitmentRecord;
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  sourceSystemCode: SystemCodeRecord;
  projectionIndex: ResearchOperationsProjectionIndex;
}): ValidatedSourceClosure | undefined {
  const {
    commitment,
    allocation,
    direction,
    worker,
    sourceSystemCode,
    projectionIndex
  } = input;
  const assignment = commitment.memory_policy?.control_assignment;
  if (!assignment) {
    return commitment.source_artifact_digest === sourceSystemCode.artifact_digest
      ? {
          sourceSystemCodeId: sourceSystemCode.system_code_id,
          sourceSystemCodeArtifactDigest: sourceSystemCode.artifact_digest,
          sourceArtifactClosureDigest: sourceSystemCode.artifact_digest
        }
      : undefined;
  }
  const matches = projectionIndex.memoryControlStudiesById.get(assignment.study_ref.id) ?? [];
  const study = matches.length === 1 ? matches[0] : undefined;
  if (!study || !researchMemoryControlStudyHasRuntimeShape(study) ||
    study.research_memory_control_study_id !==
      researchMemoryControlStudyId(study.idempotency_key) ||
    study.study_digest !== canonicalDigest(researchMemoryControlStudyDigestInput(study))) {
    return undefined;
  }
  const pair = study.pair_plans[assignment.pair_index - 1];
  const arm = pair && assignment.arm_kind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair?.memory_masked_control;
  const selection = allocation.selected_directions[0];
  const expectedProviderKind = study.research_agent.provider === "codex"
    ? "codex_cli"
    : study.research_agent.provider === "claude_code"
      ? "claude_code"
      : "fixture_only";
  const matchesAssignment = assignment.study_ref.record_kind ===
    "research_memory_control_study" &&
    assignment.study_digest === study.study_digest && pair !== undefined &&
    pair.pair_index === assignment.pair_index && arm !== undefined &&
    arm.arm_kind === assignment.arm_kind &&
    arm.memory_mode === commitment.memory_policy?.memory_mode &&
    arm.tick_id === commitment.candidate_arena_tick_id &&
    pair.research_direction_ref.id === direction.research_direction_id &&
    pair.direction_kind === direction.direction_kind &&
    worker.agent_profile_id === study.research_agent_profile_id &&
    worker.provider_kind === expectedProviderKind && worker.model === study.research_agent.model &&
    allocation.allocation_mode === "explicit" &&
    allocation.allocation_policy_basis.basis_kind === "explicit_request" &&
    allocation.selected_directions.length === 1 && selection !== undefined &&
    selection.direction_kind === pair.direction_kind && selection.selection_kind === "explicit" &&
    selection.experiment_budget === 1 &&
    sourceSystemCode.system_code_id === study.source.system_code_ref.id &&
    sourceSystemCode.artifact_digest === study.source.system_code_artifact_digest &&
    study.source.system_code_record_digest === canonicalDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(sourceSystemCode)
    ) &&
    commitment.source_artifact_digest === study.source.research_artifact_closure_digest &&
    commitment.development_policy.suite_version ===
      study.opportunity_protocol.development_suite_version &&
    commitment.development_policy.suite_digest ===
      study.opportunity_protocol.development_suite_digest &&
    commitment.sealed_admission_policy.suite_version ===
      study.opportunity_protocol.sealed_suite_version &&
    commitment.sealed_admission_policy.generator_version ===
      study.opportunity_protocol.sealed_generator_version &&
    commitment.sealed_admission_policy.rotation_commitment_digest ===
      study.opportunity_protocol.sealed_rotation_commitment_digest &&
    commitment.sealed_admission_policy.suite_digest ===
      study.opportunity_protocol.sealed_suite_digest &&
    commitment.memory_policy.available_memory_item_count > 0 &&
    Date.parse(allocation.allocated_at) > Date.parse(study.committed_at) &&
    Date.parse(commitment.committed_at) > Date.parse(study.committed_at);
  return matchesAssignment ? {
    sourceSystemCodeId: sourceSystemCode.system_code_id,
    sourceSystemCodeArtifactDigest: sourceSystemCode.artifact_digest,
    sourceArtifactClosureDigest: study.source.research_artifact_closure_digest
  } : undefined;
}

function directionRecordMatches(
  direction: ResearchDirectionRecord | undefined,
  kind: ResearchDirectionKind
): direction is ResearchDirectionRecord {
  return Boolean(direction && direction.record_kind === "research_direction" &&
    direction.version === 1 && safeIdentifier(direction.research_direction_id) &&
    direction.direction_kind === kind &&
    direction.market_scope === "external_trading_api_fixture" &&
    typeof direction.prompt_seed === "string" && safeIsoTimestamp(direction.created_at) &&
    direction.authority_status === "research_seed_only");
}

function workerRecordMatches(
  worker: ResearchWorkerRecord | undefined,
  direction: ResearchDirectionRecord | undefined
): worker is ResearchWorkerRecord {
  return Boolean(worker && direction && worker.record_kind === "research_worker" &&
    worker.version === 1 && safeIdentifier(worker.research_worker_id) &&
    typeof worker.display_name === "string" &&
    (worker.model === undefined || typeof worker.model === "string") &&
    (worker.provider_kind === undefined || [
      "codex_cli", "claude_code", "local_process", "fixture_only"
    ].includes(worker.provider_kind)) &&
    exactRef(worker.research_direction_ref, "research_direction", direction.research_direction_id) &&
    ["active", "failed", "retired"].includes(worker.status) &&
    safeIsoTimestamp(worker.created_at) && worker.authority_status === "research_only");
}

function systemCodeHasRuntimeShape(systemCode: SystemCodeRecord | undefined): systemCode is SystemCodeRecord {
  if (!systemCode) return false;
  const baseKeys = [
    "record_kind", "version", "system_code_id", "artifact_kind", "artifact_digest",
    ...(systemCode?.artifact_ref === undefined ? [] : ["artifact_ref"]),
    ...(systemCode?.artifact_runtime_contract_ref === undefined
      ? []
      : ["artifact_runtime_contract_ref"]),
    "runtime_kind", "entrypoint", "declared_output_contract", "secret_policy_ref",
    "capability_policy_ref", "provenance_refs", "status", "created_at", "authority_status"
  ];
  if (!hasExactKeys(systemCode, [
    ...baseKeys,
    systemCode.artifact_kind === "python_file" ? "artifact_path" : "image_ref"
  ]) || systemCode.record_kind !== "system_code" || systemCode.version !== 1 ||
    !safeIdentifier(systemCode.system_code_id) || !validDigest(systemCode.artifact_digest) ||
    systemCode.status !== "registered" || !safeIsoTimestamp(systemCode.created_at) ||
    (systemCode.artifact_ref !== undefined && !validRef(systemCode.artifact_ref)) ||
    (systemCode.artifact_runtime_contract_ref !== undefined && !exactRef(
      systemCode.artifact_runtime_contract_ref,
      "artifact_runtime_contract"
    )) || !Array.isArray(systemCode.entrypoint) || systemCode.entrypoint.length === 0 ||
    !systemCode.entrypoint.every(runtimeString) ||
    !systemCodeOutputContractHasRuntimeShape(systemCode.declared_output_contract) ||
    !exactRef(systemCode.secret_policy_ref, "secret_policy") ||
    !exactRef(systemCode.capability_policy_ref, "capability_policy") ||
    !Array.isArray(systemCode.provenance_refs) ||
    !systemCode.provenance_refs.every(validRef) ||
    systemCode.authority_status !== "not_live") {
    return false;
  }
  return systemCode.artifact_kind === "python_file"
    ? systemCode.runtime_kind === "python" && runtimeString(systemCode.artifact_path)
    : systemCode.artifact_kind === "container_image" &&
      systemCode.runtime_kind === "container_image" && runtimeString(systemCode.image_ref);
}

function systemCodeOutputContractHasRuntimeShape(
  contract: SystemCodeRecord["declared_output_contract"] | undefined
): boolean {
  if (!contract || contract.contract_kind !== "opaque_runtime_boundary" ||
    !hasExactKeys(contract, [
      "contract_kind",
      "declared_output_kinds",
      ...(contract.event_envelope_ref === undefined ? [] : ["event_envelope_ref"]),
      ...(contract.log_contract_ref === undefined ? [] : ["log_contract_ref"]),
      ...(contract.heartbeat_contract_ref === undefined ? [] : ["heartbeat_contract_ref"])
    ]) ||
    !Array.isArray(contract.declared_output_kinds) ||
    contract.declared_output_kinds.length === 0 ||
    !contract.declared_output_kinds.every((kind) => [
      "program_event",
      "runtime_log",
      "runtime_heartbeat",
      "metric_snapshot",
      "diagnostic_artifact",
      "order_request"
    ].includes(kind)) || new Set(contract.declared_output_kinds).size !==
      contract.declared_output_kinds.length) {
    return false;
  }
  return (contract.event_envelope_ref === undefined || exactRef(
    contract.event_envelope_ref,
    "program_event_contract"
  )) && (contract.log_contract_ref === undefined || exactRef(
    contract.log_contract_ref,
    "runtime_log_contract"
  )) && (contract.heartbeat_contract_ref === undefined || exactRef(
    contract.heartbeat_contract_ref,
    "runtime_heartbeat_contract"
  ));
}

function evaluationChainMatches(input: {
  commitment: ResearchPreflightCommitmentRecord;
  sourceClosure: ValidatedSourceClosure;
  worker: ResearchWorkerRecord;
  direction: ResearchDirectionRecord;
  evaluation: TradingEvaluationResultRecord;
  experiment?: ExperimentRunRecord;
  selectedSystemCode?: SystemCodeRecord;
}): boolean {
  const {
    commitment,
    sourceClosure,
    worker,
    direction,
    evaluation,
    experiment,
    selectedSystemCode
  } = input;
  const selectedSequence = evaluation.selected_development_submission_sequence;
  return commitmentHasCanonicalRuntimeShape(commitment) &&
    exactRef(commitment.source_system_code_ref, "system_code",
      sourceClosure.sourceSystemCodeId) &&
    commitment.source_artifact_digest === sourceClosure.sourceArtifactClosureDigest &&
    workerRecordMatches(worker, direction) &&
    experimentHasRuntimeShape(experiment) &&
      ["evaluated", "failed"].includes(experiment.status) &&
      Date.parse(experiment.submitted_at) >= Date.parse(commitment.committed_at) &&
      exactRef(experiment.research_worker_ref, "research_worker", worker.research_worker_id) &&
      exactRef(experiment.research_direction_ref, "research_direction",
        direction.research_direction_id) &&
      exactRef(experiment.system_code_ref, "system_code", selectedSystemCode?.system_code_id) &&
      exactRef(experiment.trading_evaluation_task_ref, "trading_evaluation_task") &&
    systemCodeHasRuntimeShape(selectedSystemCode) &&
    evaluationHasRuntimeShape(evaluation) &&
    Date.parse(selectedSystemCode.created_at) >= Date.parse(commitment.committed_at) &&
    Date.parse(selectedSystemCode.created_at) <= Date.parse(evaluation.completed_at) &&
    Date.parse(evaluation.completed_at) >= Date.parse(experiment.submitted_at) &&
    Date.parse(evaluation.completed_at) >= Date.parse(commitment.committed_at) &&
    evaluation.evaluation_phase === "sealed_admission" &&
    evaluation.submission_sequence === 1 && Number.isInteger(selectedSequence) &&
    selectedSequence! >= 1 && selectedSequence! <= commitment.development_policy.submission_limit &&
    exactRef(evaluation.research_preflight_commitment_ref,
      "research_preflight_commitment", commitment.research_preflight_commitment_id) &&
    validDigest(evaluation.research_preflight_commitment_digest) &&
    evaluation.research_preflight_commitment_digest === commitment.commitment_digest &&
    exactRef(evaluation.experiment_run_ref, "experiment_run", experiment!.experiment_run_id) &&
    exactSameRef(evaluation.trading_evaluation_task_ref,
      experiment!.trading_evaluation_task_ref) &&
    exactRef(evaluation.submitted_system_code_ref, "system_code",
      selectedSystemCode!.system_code_id) &&
    validDigest(evaluation.submitted_artifact_digest) &&
    evaluation.submitted_artifact_digest === selectedSystemCode!.artifact_digest &&
    validDigest(evaluation.sealed_admission_suite_digest) &&
    evaluation.sealed_admission_suite_digest === commitment.sealed_admission_policy.suite_digest;
}

function experimentHasRuntimeShape(
  experiment: ExperimentRunRecord | undefined
): experiment is ExperimentRunRecord {
  if (!experiment || !hasExactKeys(experiment, [
    "record_kind", "version", "experiment_run_id", "research_worker_ref",
    "research_direction_ref", "system_code_ref", "trading_evaluation_task_ref",
    ...(experiment.sandbox_ref === undefined ? [] : ["sandbox_ref"]),
    ...(experiment.runtime_trace_refs === undefined ? [] : ["runtime_trace_refs"]),
    ...(experiment.trace_ref === undefined ? [] : ["trace_ref"]),
    "submitted_at", "status", "authority_status"
  ])) return false;
  return experiment.record_kind === "experiment_run" && experiment.version === 1 &&
    safeIdentifier(experiment.experiment_run_id) &&
    exactRef(experiment.research_worker_ref, "research_worker") &&
    exactRef(experiment.research_direction_ref, "research_direction") &&
    exactRef(experiment.system_code_ref, "system_code") &&
    exactRef(experiment.trading_evaluation_task_ref, "trading_evaluation_task") &&
    (experiment.sandbox_ref === undefined || exactRef(experiment.sandbox_ref, "sandbox")) &&
    (experiment.runtime_trace_refs === undefined ||
      Array.isArray(experiment.runtime_trace_refs) &&
      experiment.runtime_trace_refs.every(validRef)) &&
    (experiment.trace_ref === undefined || exactRef(experiment.trace_ref, "trace_placeholder")) &&
    safeIsoTimestamp(experiment.submitted_at) &&
    ["submitted", "evaluated", "failed", "discarded"].includes(experiment.status) &&
    experiment.authority_status === "not_live";
}

function evaluationHasRuntimeShape(evaluation: TradingEvaluationResultRecord): boolean {
  if (!hasExactKeys(evaluation, [
    "record_kind", "version", "trading_evaluation_result_id", "experiment_run_ref",
    "trading_evaluation_task_ref", "evaluator_ref", "result_status", "evidence_disposition",
    "score_summary", "metric_refs", "evaluator_trace_ref",
    "research_preflight_commitment_ref", "research_preflight_commitment_digest",
    "submitted_system_code_ref", "submitted_artifact_digest", "sealed_admission_suite_digest",
    "evaluation_phase", "submission_sequence", "selected_development_submission_sequence",
    ...(evaluation.disqualification_reason === undefined ? [] : ["disqualification_reason"]),
    ...(evaluation.quarantine_reason === undefined ? [] : ["quarantine_reason"]),
    "completed_at", "authority_status"
  ])) return false;
  return evaluation.record_kind === "trading_evaluation_result" && evaluation.version === 1 &&
    safeIdentifier(evaluation.trading_evaluation_result_id) &&
    exactRef(evaluation.experiment_run_ref, "experiment_run") &&
    exactRef(evaluation.trading_evaluation_task_ref, "trading_evaluation_task") &&
    exactRef(evaluation.evaluator_ref, "external_evaluator") &&
    ["accepted", "quarantined_for_review", "disqualified"].includes(evaluation.result_status) &&
    ["not_counted", "counted", "quarantined_for_review"].includes(
      evaluation.evidence_disposition
    ) && evaluationScoreHasRuntimeShape(evaluation.score_summary) &&
    Array.isArray(evaluation.metric_refs) && evaluation.metric_refs.every((candidate) =>
      exactRef(candidate, "metric_snapshot")) &&
    exactRef(evaluation.evaluator_trace_ref, "trace_placeholder") &&
    tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(evaluation) &&
    (evaluation.disqualification_reason === undefined || [
      "lookahead_leakage", "data_leakage", "survivorship_bias", "cost_model_bypass",
      "funding_ignored", "liquidation_ignored", "seed_cherry_pick", "oos_overfit",
      "unreproducible", "research_worker_failed", "runtime_crash",
      "risk_validation_failed", "no_order_request", "runtime_self_report_only"
    ].includes(evaluation.disqualification_reason)) &&
    (evaluation.quarantine_reason === undefined || [
      "metric_instability", "insufficient_oos_coverage", "excessive_complexity",
      "manual_review_required", "partial_trace"
    ].includes(evaluation.quarantine_reason)) && safeIsoTimestamp(evaluation.completed_at) &&
    ["not_counted", "counted"].includes(evaluation.authority_status);
}

function evaluationScoreHasRuntimeShape(
  score: TradingEvaluationResultRecord["score_summary"]
): boolean {
  return hasExactKeys(score, [
    "total_score", "oos_score", "drawdown_score", "turnover_score",
    "cost_survival_score", "reproducibility_score", "complexity_penalty"
  ]) && Object.values(score).every((value) => typeof value === "number" && Number.isFinite(value));
}

function admissionGraphMatches(
  admission: CandidateAdmissionDecisionRecord,
  input: {
    commitment: ResearchPreflightCommitmentRecord;
    sourceClosure: ValidatedSourceClosure;
    evaluation: TradingEvaluationResultRecord;
    experiment: ExperimentRunRecord;
    selectedSystemCode: SystemCodeRecord;
    conformance?: PaperTradingHandoffConformanceRecord;
  }
): boolean {
  let policyConsistent = false;
  try {
    policyConsistent = isCandidateAdmissionDecisionConsistent(admission);
  } catch {
    policyConsistent = false;
  }
  const conformanceFieldCount = [
    admission.paper_handoff_conformance_status,
    admission.paper_trading_handoff_conformance_ref,
    admission.paper_trading_handoff_conformance_digest
  ].filter((value) => value !== undefined).length;
  const conformanceLinkIsValid = conformanceFieldCount === 0
    ? admission.status !== "admitted" && input.conformance === undefined
    : conformanceFieldCount === 3 &&
      ["passed", "rejected"].includes(admission.paper_handoff_conformance_status!) &&
      exactRef(admission.paper_trading_handoff_conformance_ref,
        "paper_trading_handoff_conformance") &&
      validDigest(admission.paper_trading_handoff_conformance_digest) &&
      input.conformance !== undefined && exactRef(
        admission.paper_trading_handoff_conformance_ref,
        "paper_trading_handoff_conformance",
        input.conformance.paper_trading_handoff_conformance_id
      ) && admission.paper_trading_handoff_conformance_digest ===
        input.conformance.evidence_digest;
  const chronologyIsValid = Date.parse(admission.decided_at) >=
    Date.parse(input.commitment.committed_at) && Date.parse(admission.decided_at) >=
    Date.parse(input.evaluation.completed_at) && (input.conformance === undefined ||
      Date.parse(admission.decided_at) >= Date.parse(input.conformance.completed_at));
  return admission.record_kind === "candidate_admission_decision" && admission.version === 1 &&
    safeIdentifier(admission.candidate_admission_decision_id) && policyConsistent &&
    chronologyIsValid &&
    exactRef(admission.research_preflight_commitment_ref,
      "research_preflight_commitment", input.commitment.research_preflight_commitment_id) &&
    validDigest(admission.research_preflight_commitment_digest) &&
    admission.research_preflight_commitment_digest === input.commitment.commitment_digest &&
    exactRef(admission.source_system_code_ref, "system_code",
      input.sourceClosure.sourceSystemCodeId) &&
    validDigest(admission.source_artifact_digest) &&
    admission.source_artifact_digest === input.commitment.source_artifact_digest &&
    admission.source_artifact_digest === input.sourceClosure.sourceArtifactClosureDigest &&
    exactRef(admission.system_code_ref, "system_code", input.selectedSystemCode.system_code_id) &&
    validDigest(admission.submitted_artifact_digest) &&
    admission.submitted_artifact_digest === input.selectedSystemCode.artifact_digest &&
    exactRef(admission.experiment_run_ref, "experiment_run", input.experiment.experiment_run_id) &&
    admission.experiment_status === input.experiment.status &&
    exactRef(admission.trading_evaluation_result_ref, "trading_evaluation_result",
      input.evaluation.trading_evaluation_result_id) &&
    admission.evaluation_status === input.evaluation.result_status &&
    admission.evidence_disposition === input.evaluation.evidence_disposition &&
    exactRef(admission.research_finding_ref, "research_finding") &&
    conformanceLinkIsValid &&
    safeIsoTimestamp(admission.decided_at);
}

function behaviorComparisonMatches(input: {
  admission: CandidateAdmissionDecisionRecord;
  finding: ResearchFindingRecord;
  commitment: ResearchPreflightCommitmentRecord;
  evaluation: TradingEvaluationResultRecord;
  selectedSystemCode: SystemCodeRecord;
  graph: LoadedGraph;
  index: ResearchOperationsProjectionIndex;
}): boolean {
  const {
    admission,
    finding,
    commitment,
    evaluation,
    selectedSystemCode,
    graph,
    index
  } = input;
  if ((admission.behavior_comparison_status !== "distinct" &&
      admission.behavior_comparison_status !== "duplicate") ||
    !exactRef(
      admission.research_behavior_fingerprint_ref,
      "research_behavior_fingerprint"
    ) || !validDigest(admission.research_behavior_fingerprint_digest)) {
    return false;
  }
  const current = canonicalBehaviorFingerprint(
    admission.research_behavior_fingerprint_ref.id,
    graph,
    index
  );
  if (!current ||
    current.fingerprint_digest !== admission.research_behavior_fingerprint_digest ||
    !exactRef(
      current.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || current.research_preflight_commitment_digest !==
      commitment.commitment_digest ||
    !exactRef(
      current.system_code_ref,
      "system_code",
      selectedSystemCode.system_code_id
    ) || current.system_code_artifact_digest !== selectedSystemCode.artifact_digest ||
    current.development_suite_version !== commitment.development_policy.suite_version ||
    current.development_suite_digest !== commitment.development_policy.suite_digest ||
    Date.parse(current.created_at) > Date.parse(admission.decided_at) ||
    !finding.supporting_record_refs.some((candidate) =>
      exactRef(
        candidate,
        "research_behavior_fingerprint",
        current.research_behavior_fingerprint_id
      )
    ) || !exactRef(
      evaluation.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || evaluation.research_preflight_commitment_digest !== commitment.commitment_digest ||
    !exactRef(
      evaluation.submitted_system_code_ref,
      "system_code",
      selectedSystemCode.system_code_id
    ) || evaluation.submitted_artifact_digest !== selectedSystemCode.artifact_digest ||
    evaluation.sealed_admission_suite_digest !==
      commitment.sealed_admission_policy.suite_digest ||
    evaluation.evaluation_phase !== "sealed_admission" ||
    evaluation.submission_sequence !== 1) {
    return false;
  }

  const priorOwnerExists = (fingerprint: ResearchBehaviorFingerprintRecord) =>
    (index.admissionsByFingerprintId.get(
      fingerprint.research_behavior_fingerprint_id
    ) ?? []).some((candidate) =>
      candidate.candidate_admission_decision_id !==
        admission.candidate_admission_decision_id &&
      behaviorFingerprintAdmissionOwner(candidate, fingerprint, index) &&
      Date.parse(candidate.decided_at) <= Date.parse(admission.decided_at)
    );
  if (admission.behavior_comparison_status === "distinct") {
    return !(index.fingerprintsByBehaviorKey.get(behaviorFingerprintKey(current)) ?? [])
      .filter((candidate) => hasCandidateDistinctFingerprintOwner(candidate, index))
      .some((candidate) => {
      const fingerprint = canonicalBehaviorFingerprint(
        candidate.research_behavior_fingerprint_id,
        graph,
        index
      );
      return Boolean(fingerprint &&
        fingerprint.research_behavior_fingerprint_id !==
          current.research_behavior_fingerprint_id &&
        sameBehaviorFingerprintKey(fingerprint, current) &&
        Date.parse(fingerprint.created_at) <= Date.parse(current.created_at) &&
        priorOwnerExists(fingerprint));
    });
  }

  if (!exactRef(
    admission.matching_research_behavior_fingerprint_ref,
    "research_behavior_fingerprint"
  ) || admission.matching_research_behavior_fingerprint_ref.id ===
      current.research_behavior_fingerprint_id ||
    admission.matching_research_behavior_fingerprint_digest !==
      current.fingerprint_digest) {
    return false;
  }
  const matching = canonicalBehaviorFingerprint(
    admission.matching_research_behavior_fingerprint_ref.id,
    graph,
    index
  );
  return Boolean(matching &&
    matching.fingerprint_digest ===
      admission.matching_research_behavior_fingerprint_digest &&
    sameBehaviorFingerprintKey(matching, current) &&
    Date.parse(matching.created_at) <= Date.parse(current.created_at) &&
    priorOwnerExists(matching));
}

function canonicalBehaviorFingerprint(
  id: string,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): ResearchBehaviorFingerprintRecord | undefined {
  if (index.canonicalFingerprintMemo.has(id)) {
    return index.canonicalFingerprintMemo.get(id) ?? undefined;
  }
  const records = index.fingerprintsById.get(id) ?? [];
  const fingerprint = records.length === 1 ? records[0] : undefined;
  if (!fingerprint ||
    !researchBehaviorFingerprintHasRuntimeShape(fingerprint) ||
    fingerprint.fingerprint_digest !== canonicalDigest(
      researchBehaviorFingerprintDigestInput(fingerprint)
    )) {
    index.canonicalFingerprintMemo.set(id, null);
    return undefined;
  }
  const commitments = index.commitmentsById.get(
    fingerprint.research_preflight_commitment_ref.id
  ) ?? [];
  const commitment = commitments.length === 1 ? commitments[0] : undefined;
  const systemCode = graph.systemCodes.get(fingerprint.system_code_ref.id);
  const result = commitment && commitmentHasCanonicalRuntimeShape(commitment) &&
    fingerprint.research_preflight_commitment_digest === commitment.commitment_digest &&
    systemCodeHasRuntimeShape(systemCode) &&
    fingerprint.system_code_artifact_digest === systemCode.artifact_digest &&
    fingerprint.development_suite_version ===
      commitment.development_policy.suite_version &&
    fingerprint.development_suite_digest === commitment.development_policy.suite_digest &&
    Date.parse(fingerprint.created_at) >= Date.parse(commitment.committed_at) &&
    Date.parse(fingerprint.created_at) >= Date.parse(systemCode.created_at)
    ? fingerprint
    : undefined;
  index.canonicalFingerprintMemo.set(id, result ?? null);
  return result;
}

function behaviorFingerprintAdmissionOwner(
  admission: CandidateAdmissionDecisionRecord,
  fingerprint: ResearchBehaviorFingerprintRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  let policyConsistent = false;
  try {
    policyConsistent = isCandidateAdmissionDecisionConsistent(admission);
  } catch {
    policyConsistent = false;
  }
  const admissionId = admission?.candidate_admission_decision_id;
  if (typeof admissionId !== "string" ||
    (index.admissionsById.get(admissionId)?.length ?? 0) !== 1) {
    return false;
  }
  const findings = index.findingsById.get(admission.research_finding_ref?.id) ?? [];
  const finding = findings.length === 1 ? findings[0] : undefined;
  const evaluations = index.evaluationsById.get(
    admission.trading_evaluation_result_ref?.id
  ) ?? [];
  const evaluation = evaluations.length === 1 ? evaluations[0] : undefined;
  return admission.status === "admitted" &&
    admission.reason === "evaluation_accepted" &&
    admission.behavior_comparison_status === "distinct" &&
    policyConsistent &&
    exactRef(
      admission.research_behavior_fingerprint_ref,
      "research_behavior_fingerprint",
      fingerprint.research_behavior_fingerprint_id
    ) && admission.research_behavior_fingerprint_digest ===
      fingerprint.fingerprint_digest &&
    exactRef(admission.system_code_ref, "system_code", fingerprint.system_code_ref.id) &&
    admission.submitted_artifact_digest === fingerprint.system_code_artifact_digest &&
    exactRef(
      admission.research_preflight_commitment_ref,
      "research_preflight_commitment",
      fingerprint.research_preflight_commitment_ref.id
    ) && admission.research_preflight_commitment_digest ===
      fingerprint.research_preflight_commitment_digest &&
    Date.parse(admission.decided_at) >= Date.parse(fingerprint.created_at) &&
    Boolean(finding && findingHasRuntimeShape(finding) &&
      finding.supporting_record_refs.some((candidate) =>
        exactRef(
          candidate,
          "research_behavior_fingerprint",
          fingerprint.research_behavior_fingerprint_id
        )
      )) &&
    Boolean(evaluation && evaluationHasRuntimeShape(evaluation) &&
      exactRef(
        evaluation.research_preflight_commitment_ref,
        "research_preflight_commitment",
        fingerprint.research_preflight_commitment_ref.id
      ) && evaluation.research_preflight_commitment_digest ===
        fingerprint.research_preflight_commitment_digest &&
      exactRef(
        evaluation.submitted_system_code_ref,
        "system_code",
        fingerprint.system_code_ref.id
      ) && evaluation.submitted_artifact_digest ===
        fingerprint.system_code_artifact_digest &&
      Date.parse(evaluation.completed_at) <= Date.parse(admission.decided_at));
}

function sameBehaviorFingerprintKey(
  left: ResearchBehaviorFingerprintRecord,
  right: ResearchBehaviorFingerprintRecord
): boolean {
  return behaviorFingerprintKey(left) === behaviorFingerprintKey(right);
}

function behaviorFingerprintKey(
  fingerprint: ResearchBehaviorFingerprintRecord
): string {
  return JSON.stringify([
    fingerprint?.protocol_version,
    fingerprint?.development_suite_version,
    fingerprint?.development_suite_digest,
    fingerprint?.fingerprint_digest
  ]);
}

function rawBehaviorFingerprintKey(
  fingerprint: ResearchBehaviorFingerprintRecord
): string | undefined {
  return typeof fingerprint?.protocol_version === "string" &&
    typeof fingerprint?.development_suite_version === "string" &&
    typeof fingerprint?.development_suite_digest === "string" &&
    typeof fingerprint?.fingerprint_digest === "string"
    ? behaviorFingerprintKey(fingerprint)
    : undefined;
}

function conformanceHasRuntimeShape(
  conformance: PaperTradingHandoffConformanceRecord,
  knownConformances: PaperTradingHandoffConformanceRecord[] = []
): boolean {
  if (!paperTradingHandoffConformanceHasRuntimeShape(conformance) ||
    !safeIdentifier(conformance.paper_trading_handoff_conformance_id) ||
    conformance.evidence_digest !== canonicalDigest(
      paperTradingHandoffConformanceDigestInput(conformance)
    )) {
    return false;
  }
  return conformance.version === 1 || verifyCandidateEgressAttestation({
    attestation: conformance.candidate_egress_attestation,
    expected: {
      attestation_id: candidateEgressAttestationIdForConformance(
        conformance.paper_trading_handoff_conformance_id
      ),
      system_code_ref: conformance.system_code_ref,
      system_code_artifact_digest: conformance.system_code_artifact_digest,
      execution_ref: conformance.experiment_run_ref,
      sandbox_name: conformance.candidate_egress_attestation.sandbox.sandbox_name,
      sandbox_implementation_version:
        conformance.candidate_egress_attestation.sandbox.implementation_version,
      conformance_started_at: conformance.started_at,
      conformance_completed_at: conformance.completed_at
    },
    consumed_attestation_digests: knownConformances.flatMap((candidate) =>
      candidate.paper_trading_handoff_conformance_id !==
          conformance.paper_trading_handoff_conformance_id &&
        paperTradingHandoffConformanceHasRuntimeShape(candidate) &&
        candidate.version === 2
        ? [candidate.candidate_egress_attestation.attestation_digest]
        : []
    ),
    sha256: canonicalDigest
  }).status === "verified";
}

function findingHasRuntimeShape(finding: ResearchFindingRecord): boolean {
  return finding.record_kind === "research_finding" && finding.version === 1 &&
    safeIdentifier(finding.research_finding_id) &&
    exactRef(finding.research_worker_ref, "research_worker") &&
    exactRef(finding.research_direction_ref, "research_direction") &&
    exactRef(finding.experiment_run_ref, "experiment_run") &&
    exactRef(finding.trading_evaluation_result_ref, "trading_evaluation_result") &&
    [
      "positive_result", "negative_result", "failure_analysis", "anti_hacking_case",
      "duplicate_result", "next_artifact_hint"
    ].includes(finding.finding_kind) && typeof finding.summary === "string" &&
    Array.isArray(finding.supporting_record_refs) &&
    finding.supporting_record_refs.every(validRef) &&
    refsAreUnique(finding.supporting_record_refs) && safeIsoTimestamp(finding.created_at) &&
    finding.authority_status === "research_trace_only";
}

function lineageHasRuntimeShape(lineage: ArtifactLineageRecord): boolean {
  return lineage.record_kind === "artifact_lineage" && lineage.version === 1 &&
    safeIdentifier(lineage.artifact_lineage_id) &&
    exactRef(lineage.child_system_code_ref, "system_code") &&
    (!lineage.parent_system_code_ref || exactRef(lineage.parent_system_code_ref, "system_code")) &&
    Array.isArray(lineage.source_finding_refs) && lineage.source_finding_refs.length > 0 &&
    lineage.source_finding_refs.every((candidate) => exactRef(candidate, "research_finding")) &&
    refsAreUnique(lineage.source_finding_refs) &&
    (!lineage.created_by_research_worker_ref ||
      exactRef(lineage.created_by_research_worker_ref, "research_worker")) &&
    safeIsoTimestamp(lineage.created_at) && lineage.authority_status === "lineage_only";
}

function tickMatchesAllocation(
  tick: CandidateArenaTickRecord,
  allocation: CandidateArenaResearchAllocationRecord,
  commitment?: ResearchPreflightCommitmentRecord
): boolean {
  return candidateArenaTickHasRuntimeShape(tick) &&
    tick.tick_id === allocation.tick_id &&
    exactRef(tick.research_allocation_ref, "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id) &&
    tick.research_allocation_digest === allocation.allocation_digest &&
    !(Date.parse(tick.started_at) < Date.parse(allocation.allocated_at)) &&
    (!commitment || Date.parse(tick.started_at) <= Date.parse(commitment.committed_at)) &&
    (!commitment || Date.parse(tick.completed_at) >= Date.parse(commitment.committed_at)) &&
    tick.direction_results.length === allocation.selected_directions.length &&
    tick.direction_results.every((result, index) =>
      result.direction_kind === allocation.selected_directions[index]?.direction_kind
    );
}

function tickHasUniqueRawIdentity(
  tick: CandidateArenaTickRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const id = tick?.candidate_arena_tick_id;
  return safeIdentifier(id) && (index.ticksById.get(id)?.length ?? 0) === 1;
}

function checkpointMatches(
  checkpoint: ResearchWorkerCheckpointRecord,
  input: {
    commitment: ResearchPreflightCommitmentRecord;
    worker: ResearchWorkerRecord;
    direction: ResearchDirectionRecord;
    index: CheckpointValidationIndex;
  }
): boolean {
  const { commitment, worker, direction, index } = input;
  const pending: Array<{
    checkpoint: ResearchWorkerCheckpointRecord;
    commitment: ResearchPreflightCommitmentRecord;
    priorCheckpoint: ResearchWorkerCheckpointRecord;
  }> = [];
  let currentCheckpoint = checkpoint;
  let currentCommitment = commitment;
  let result: boolean;

  while (true) {
    const memoKey = checkpointValidationMemoKey(
      currentCheckpoint,
      currentCommitment,
      worker,
      direction
    );
    const memoized = index.validationMemo.get(memoKey);
    if (memoized !== undefined) {
      result = memoized;
      break;
    }
    if (!checkpointLocallyMatches(currentCheckpoint, {
      commitment: currentCommitment,
      worker,
      direction,
      index
    })) {
      index.validationMemo.set(memoKey, false);
      result = false;
      break;
    }

    const workerCommitments = index.commitmentsByWorkerId.get(
      worker.research_worker_id
    ) ?? [];
    const position = index.commitmentPositions.get(currentCommitment);
    if (position === undefined || workerCommitments[position] !== currentCommitment) {
      index.validationMemo.set(memoKey, false);
      result = false;
      break;
    }
    const priorCommitment = position > 0 ? workerCommitments[position - 1] : undefined;
    if (!priorCommitment) {
      result = checkpointContinuityMatches(currentCheckpoint);
      index.validationMemo.set(memoKey, result);
      break;
    }
    const priorCandidates = index.checkpointsByCommitmentId.get(
      priorCommitment.research_preflight_commitment_id
    ) ?? [];
    if (priorCandidates.length !== 1) {
      index.validationMemo.set(memoKey, false);
      result = false;
      break;
    }
    const priorCheckpoint = priorCandidates[0]!;
    pending.push({
      checkpoint: currentCheckpoint,
      commitment: currentCommitment,
      priorCheckpoint
    });
    currentCheckpoint = priorCheckpoint;
    currentCommitment = priorCommitment;
  }

  while (pending.length > 0) {
    const frame = pending.pop()!;
    result = result && checkpointContinuityMatches(
      frame.checkpoint,
      frame.priorCheckpoint
    );
    index.validationMemo.set(checkpointValidationMemoKey(
      frame.checkpoint,
      frame.commitment,
      worker,
      direction
    ), result);
  }
  return result;
}

function checkpointLocallyMatches(
  checkpoint: ResearchWorkerCheckpointRecord,
  input: {
    commitment: ResearchPreflightCommitmentRecord;
    worker: ResearchWorkerRecord;
    direction: ResearchDirectionRecord;
    index: CheckpointValidationIndex;
  }
): boolean {
  const { commitment, worker, direction, index } = input;
  const rawCommitmentOwners = index.checkpointsByCommitmentId.get(
    commitment.research_preflight_commitment_id
  ) ?? [];
  const rawIdOwners = index.checkpointsById.get(
    checkpoint.research_worker_checkpoint_id
  ) ?? [];
  if (rawCommitmentOwners.length !== 1 || rawCommitmentOwners[0] !== checkpoint ||
    rawIdOwners.length !== 1 || !researchWorkerCheckpointHasRuntimeShape(checkpoint) ||
    !safeIdentifier(checkpoint.research_worker_checkpoint_id) ||
    checkpoint.checkpoint_digest !== canonicalDigest(
      researchWorkerCheckpointDigestInput(checkpoint)
    ) || worker.lifecycle_protocol !== "research_worker_checkpoint_v1" ||
    !worker.agent_profile_id || !worker.workspace_key ||
    worker.workspace_key !== `candidate-arena-workers/${worker.research_worker_id}` ||
    worker.workspace_key !== checkpoint.workspace_key ||
    !exactRef(worker.research_direction_ref, "research_direction",
      direction.research_direction_id) ||
    !exactRef(commitment.research_worker_ref, "research_worker",
      worker.research_worker_id) ||
    !exactRef(commitment.research_direction_ref, "research_direction",
      direction.research_direction_id) ||
    commitment.development_policy.submission_limit !==
      checkpoint.development_budget.submission_limit ||
    Date.parse(checkpoint.closed_at) < Date.parse(commitment.committed_at) ||
    !exactRef(
      checkpoint.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || checkpoint.research_preflight_commitment_digest !== commitment.commitment_digest ||
    checkpoint.candidate_arena_tick_id !== commitment.candidate_arena_tick_id ||
    !exactSameRef(checkpoint.research_worker_ref, commitment.research_worker_ref) ||
    !exactSameRef(checkpoint.research_direction_ref, commitment.research_direction_ref)) {
    return false;
  }
  if (checkpoint.candidate_admission_decision_ref) {
    const admissions = (index.admissionsById.get(
      checkpoint.candidate_admission_decision_ref.id
    ) ?? []).filter((candidate) =>
      exactRef(candidate.research_preflight_commitment_ref,
        "research_preflight_commitment", commitment.research_preflight_commitment_id) &&
      candidate.research_preflight_commitment_digest === commitment.commitment_digest &&
      Date.parse(checkpoint.closed_at) >= Date.parse(candidate.decided_at)
    );
    if (admissions.length !== 1) return false;
  }
  return true;
}

function checkpointContinuityMatches(
  checkpoint: ResearchWorkerCheckpointRecord,
  priorCheckpoint?: ResearchWorkerCheckpointRecord
): boolean {
  const previousMatches = priorCheckpoint
    ? exactRef(checkpoint.previous_checkpoint_ref, "research_worker_checkpoint",
        priorCheckpoint.research_worker_checkpoint_id) &&
      checkpoint.previous_checkpoint_digest === priorCheckpoint.checkpoint_digest
    : checkpoint.previous_checkpoint_ref === undefined &&
      checkpoint.previous_checkpoint_digest === undefined;
  if (!previousMatches || priorCheckpoint &&
      Date.parse(checkpoint.closed_at) < Date.parse(priorCheckpoint.closed_at)) {
    return false;
  }

  const previousCommitted = priorCheckpoint
    ?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = priorCheckpoint
    ?.development_budget.cumulative_recorded_submission_count ?? 0;
  if (checkpoint.development_budget.cumulative_committed_submission_limit !==
      previousCommitted + checkpoint.development_budget.submission_limit ||
    checkpoint.development_budget.cumulative_recorded_submission_count !==
      previousRecorded + checkpoint.development_budget.recorded_submission_count) {
    return false;
  }
  const firstRetainedSequence = checkpoint.notebook.total_entry_count -
    checkpoint.notebook.recent_entries.length + 1;
  const retainedPriorEntries = priorCheckpoint?.notebook.recent_entries.filter((entry) =>
    entry.sequence >= firstRetainedSequence && entry.sequence <= previousRecorded
  ) ?? [];
  const checkpointPriorEntries = checkpoint.notebook.recent_entries.filter((entry) =>
    entry.sequence <= previousRecorded
  );
  const currentEntries = checkpoint.notebook.recent_entries.filter((entry) =>
    entry.sequence > previousRecorded
  );
  if (JSON.stringify(retainedPriorEntries) !== JSON.stringify(checkpointPriorEntries) ||
    currentEntries.length !== checkpoint.development_budget.recorded_submission_count ||
    !currentEntries.every((entry, index) =>
      entry.candidate_arena_tick_id === checkpoint.candidate_arena_tick_id &&
      entry.iteration === index + 1)) {
    return false;
  }
  return true;
}

function checkpointValidationMemoKey(
  checkpoint: ResearchWorkerCheckpointRecord,
  commitment: ResearchPreflightCommitmentRecord,
  worker: ResearchWorkerRecord,
  direction: ResearchDirectionRecord
): string {
  return JSON.stringify([
    checkpoint.research_worker_checkpoint_id,
    checkpoint.checkpoint_digest,
    commitment.research_preflight_commitment_id,
    commitment.commitment_digest,
    worker.research_worker_id,
    direction.research_direction_id
  ]);
}

function checkpointAdmissionAgrees(
  checkpoint: ResearchWorkerCheckpointRecord,
  admission: CandidateAdmissionDecisionRecord | undefined,
  tickResult: CandidateArenaTickDirectionResultReadModel | undefined
): boolean {
  if (!admission || checkpoint.terminal_status !== "completed" ||
    checkpoint.terminal_reason !== "admission_recorded" || !exactRef(
      checkpoint.candidate_admission_decision_ref,
      "candidate_admission_decision",
      admission.candidate_admission_decision_id
    )) {
    return false;
  }
  const checkpointResult = checkpoint.terminal_direction_result;
  if (checkpointResult && !terminalDirectionResultMatchesAdmission(
    checkpointResult,
    admission
  )) {
    return false;
  }
  if (tickResult && !terminalDirectionResultMatchesAdmission(tickResult, admission)) {
    return false;
  }
  if (checkpointResult && tickResult && !isDeepStrictEqual(checkpointResult, tickResult)) {
    return false;
  }
  return Boolean(checkpointResult || tickResult);
}

function terminalDirectionResultMatchesAdmission(
  result: CandidateArenaTickDirectionResultReadModel,
  admission: CandidateAdmissionDecisionRecord
): boolean {
  if (result.admission_decision_id !== admission.candidate_admission_decision_id ||
    result.admission_reason !== admission.reason) {
    return false;
  }
  return admission.status === "admitted"
    ? result.status === "created"
    : result.status === admission.status;
}

function conformanceMatches(
  conformance: PaperTradingHandoffConformanceRecord,
  admission: CandidateAdmissionDecisionRecord,
  evaluation: TradingEvaluationResultRecord,
  experiment: ExperimentRunRecord,
  systemCode: SystemCodeRecord,
  knownConformances: PaperTradingHandoffConformanceRecord[] = []
): boolean {
  return conformanceHasRuntimeShape(conformance, knownConformances) &&
    Date.parse(conformance.started_at) >= Date.parse(experiment.submitted_at) &&
    Date.parse(conformance.completed_at) <= Date.parse(systemCode.created_at) &&
    Date.parse(systemCode.created_at) <= Date.parse(evaluation.completed_at) &&
    !(admission.status === "admitted" && conformance.version === 1 &&
      conformance.runner_kind === "docker_sandboxes_sbx") &&
    admission.paper_handoff_conformance_status === conformance.status &&
    validDigest(admission.paper_trading_handoff_conformance_digest) &&
    admission.paper_trading_handoff_conformance_digest === conformance.evidence_digest &&
    exactRef(admission.paper_trading_handoff_conformance_ref,
      "paper_trading_handoff_conformance", conformance.paper_trading_handoff_conformance_id) &&
    exactRef(conformance.experiment_run_ref, "experiment_run", experiment.experiment_run_id) &&
    exactSameRef(conformance.trading_evaluation_task_ref, evaluation.trading_evaluation_task_ref) &&
    exactSameRef(conformance.trading_evaluation_task_ref, experiment.trading_evaluation_task_ref) &&
    exactRef(conformance.system_code_ref, "system_code", systemCode.system_code_id) &&
    validDigest(conformance.system_code_artifact_digest) &&
    conformance.system_code_artifact_digest === systemCode.artifact_digest;
}

function findingMatches(
  finding: ResearchFindingRecord,
  input: {
    commitment: ResearchPreflightCommitmentRecord;
    evaluation: TradingEvaluationResultRecord;
    experiment: ExperimentRunRecord;
    worker: ResearchWorkerRecord;
    direction: ResearchDirectionRecord;
  }
): boolean {
  return findingHasRuntimeShape(finding) &&
    exactRef(finding.research_worker_ref, "research_worker", input.worker.research_worker_id) &&
    exactRef(finding.research_direction_ref, "research_direction",
      input.direction.research_direction_id) &&
    exactRef(finding.experiment_run_ref, "experiment_run", input.experiment.experiment_run_id) &&
    exactRef(finding.trading_evaluation_result_ref, "trading_evaluation_result",
      input.evaluation.trading_evaluation_result_id) &&
    Date.parse(finding.created_at) >= Date.parse(input.evaluation.completed_at);
}

function lineageMatches(
  lineage: ArtifactLineageRecord,
  systemCode: SystemCodeRecord,
  finding: ResearchFindingRecord,
  worker: ResearchWorkerRecord,
  commitment: ResearchPreflightCommitmentRecord
): boolean {
  return lineageHasRuntimeShape(lineage) &&
    exactRef(lineage.child_system_code_ref, "system_code", systemCode.system_code_id) &&
    (!lineage.parent_system_code_ref || exactSameRef(
      lineage.parent_system_code_ref,
      commitment.source_system_code_ref
    )) &&
    lineage.source_finding_refs.some((candidate) => exactRef(
      candidate,
      "research_finding",
      finding.research_finding_id
    )) && (!lineage.created_by_research_worker_ref || exactRef(
      lineage.created_by_research_worker_ref,
      "research_worker",
      worker.research_worker_id
    )) && Date.parse(lineage.created_at) >= Date.parse(finding.created_at) &&
    Date.parse(lineage.created_at) >= Date.parse(systemCode.created_at);
}

function candidateMaterializationMatches(input: {
  candidate: CandidateInspectReadModel | undefined;
  candidateId: string;
  selectedSystemCode: SystemCodeRecord;
  tick: CandidateArenaTickRecord;
  tickResult: CandidateArenaTickDirectionResultReadModel;
  index: ResearchOperationsProjectionIndex;
}): boolean {
  const {
    candidate,
    candidateId,
    selectedSystemCode,
    tick,
    tickResult,
    index
  } = input;
  const claims = index.candidateClaimsById.get(candidateId) ?? [];
  if (claims.length !== 1 || claims[0]!.tick !== tick ||
    claims[0]!.result !== tickResult || !candidate) {
    return false;
  }
  const tradingSystem = candidate.trading_system;
  const systemCodeRef = candidate.system_code?.ref;
  const version = candidate.candidate_version;
  const attempt = candidate.materialization_attempt;
  const lineage = candidate.full_cycle_lineage;
  const generated = lineage?.generated;
  const materialized = lineage?.materialized;
  if (!safeIdentifier(candidate.active_version_id) || !tradingSystem || !version ||
    !attempt || !lineage || !generated || !materialized) {
    return false;
  }
  return candidate.candidate_id === candidateId && candidate.status === "materialized" &&
    tradingSystem.system_id === candidateId &&
    tradingSystem.version_id === candidate.active_version_id &&
    exactRef(tradingSystem.ref, "trading_system_candidate", candidateId) &&
    tradingSystem.status === "materialized" &&
    exactRef(systemCodeRef, "system_code", selectedSystemCode.system_code_id) &&
    version.candidate_version_id === candidate.active_version_id &&
    exactRef(
      version.materialization_attempt_ref,
      "candidate_materialization_attempt",
      attempt.attempt_id
    ) && attempt.status === "materialized" &&
    attempt.validation_status === "accepted" &&
    exactRef(attempt.resulting_candidate_ref, "trading_system_candidate", candidateId) &&
    Array.isArray(attempt.artifact_refs) && attempt.artifact_refs.length > 0 &&
    attempt.artifact_refs.every(validRef) && refsAreUnique(attempt.artifact_refs) &&
    attempt.artifact_refs.some((candidateRef) => exactRef(
      candidateRef,
      "system_code",
      selectedSystemCode.system_code_id
    )) && lineage.handoff_status === "runnable" &&
    exactRef(generated.system_code_ref, "system_code", selectedSystemCode.system_code_id) &&
    validDigest(generated.artifact_digest) &&
    generated.artifact_digest === selectedSystemCode.artifact_digest &&
    generated.generated_by_agent === true &&
    materialized.trading_system_id === candidateId &&
    materialized.candidate_version_id === candidate.active_version_id &&
    exactRef(
      materialized.system_code_ref,
      "system_code",
      selectedSystemCode.system_code_id
    );
}

function terminalTickCandidateMatches(
  tick: CandidateArenaTickRecord | undefined,
  result: CandidateArenaTickDirectionResultReadModel | undefined,
  admission: CandidateAdmissionDecisionRecord | undefined,
  commitment: ResearchPreflightCommitmentRecord | undefined,
  evaluation: TradingEvaluationResultRecord | undefined,
  conformance: PaperTradingHandoffConformanceRecord | undefined,
  checkpoint: ResearchWorkerCheckpointRecord | undefined
): boolean {
  const compact = result?.paper_handoff_conformance;
  const compactAttestationMatches = conformance?.version === 2
    ? Boolean(compact?.candidate_egress_attestation &&
      compact.candidate_egress_attestation.attestation_id ===
        conformance.candidate_egress_attestation.attestation_id &&
      compact.candidate_egress_attestation.verification_status === "verified" &&
      compact.candidate_egress_attestation.enforcement_result === "enforced" &&
      compact.candidate_egress_attestation.network_policy_digest ===
        conformance.candidate_egress_attestation.network_policy_digest &&
      compact.candidate_egress_attestation.denial_summary.required_probe_count ===
        conformance.candidate_egress_attestation.denial_summary.required_probe_count &&
      compact.candidate_egress_attestation.denial_summary.start_denied_probe_count ===
        conformance.candidate_egress_attestation.denial_summary.start_denied_probe_count &&
      compact.candidate_egress_attestation.denial_summary.end_denied_probe_count ===
        conformance.candidate_egress_attestation.denial_summary.end_denied_probe_count &&
      compact.candidate_egress_attestation.denial_summary.unexpected_allow_count === 0 &&
      compact.candidate_egress_attestation.denial_summary.unexpected_allow_count ===
        conformance.candidate_egress_attestation.denial_summary.unexpected_allow_count &&
      compact.candidate_egress_attestation.authority_status === "research_only")
    : compact?.candidate_egress_attestation === undefined;
  return Boolean(tick && result?.status === "created" && safeIdentifier(result.candidate_id) &&
    admission && commitment && evaluation && conformance &&
    Date.parse(tick.started_at) <= Date.parse(commitment.committed_at) &&
    Date.parse(tick.completed_at) >= Date.parse(evaluation.completed_at) &&
    Date.parse(tick.completed_at) >= Date.parse(conformance.completed_at) &&
    Date.parse(tick.completed_at) >= Date.parse(admission.decided_at) &&
    (!checkpoint || Date.parse(tick.completed_at) >= Date.parse(checkpoint.closed_at)) &&
    result.admission_decision_id === admission.candidate_admission_decision_id &&
    result.admission_reason === admission.reason &&
    result.research_preflight?.commitment_id === commitment.research_preflight_commitment_id &&
    Number.isInteger(result.research_preflight.development_submission_count) &&
    result.research_preflight.development_submission_count >=
      evaluation.selected_development_submission_sequence! &&
    result.research_preflight.sealed_terminal_status === "accepted" &&
    result.research_preflight.reason === "accepted" &&
    result.research_preflight.authority_status === "not_promotion_authority" &&
    result.paper_handoff_conformance?.conformance_id ===
      conformance.paper_trading_handoff_conformance_id &&
    result.paper_handoff_conformance.status === conformance.status &&
    result.paper_handoff_conformance.reason === conformance.reason &&
    result.paper_handoff_conformance.authority_status === "research_only" &&
    compactAttestationMatches &&
    tick.created_candidate_refs.some((candidate) => exactRef(
      candidate,
      "trading_system_candidate",
      result.candidate_id
    )));
}

function latestProgressAt(source: SessionSource): string {
  return [
    source.allocation.allocated_at,
    source.commitment?.committed_at,
    source.evaluation?.completed_at,
    source.conformance?.completed_at,
    source.admission?.decided_at,
    source.checkpoint?.closed_at,
    source.tick?.completed_at
  ].filter((candidate): candidate is string => typeof candidate === "string")
    .sort()
    .at(-1)!;
}

function terminalCompletedAt(
  source: SessionSource,
  statusValue: ResearchSessionSummaryReadModel["status"]
): string | undefined {
  if (["queued", "allocating", "running", "recovering"].includes(statusValue)) {
    return undefined;
  }
  return [
    source.tick?.completed_at,
    source.checkpoint?.closed_at,
    source.admission?.decided_at
  ].filter((candidate): candidate is string => typeof candidate === "string")
    .sort()
    .at(-1);
}

function terminalProgress(
  source: SessionSource,
  statusValue: ResearchSessionSummaryReadModel["status"]
): string | undefined {
  if (statusValue === "admitted") return "Candidate admission recorded.";
  if (statusValue === "duplicate") return "Exact duplicate admission recorded.";
  if (statusValue === "quarantined") return "Candidate quarantined by external admission.";
  if (statusValue === "finished_without_submission") {
    return "Research finished without a selected submission.";
  }
  if (statusValue === "failed_closed") {
    return source.checkpoint?.terminal_reason === "restart_recovery"
      ? "Research failed closed during restart recovery."
      : "Research failed closed.";
  }
  return undefined;
}

function compareSessions(
  left: ResearchSessionSummaryReadModel,
  right: ResearchSessionSummaryReadModel
): number {
  return (right.allocated_at ?? "").localeCompare(left.allocated_at ?? "") ||
    left.research_allocation_id.localeCompare(right.research_allocation_id) ||
    left.direction_kind.localeCompare(right.direction_kind);
}

function bounded(value: string): { value: string; truncated: boolean } {
  const sanitized = sanitizeResearchEvidenceText(value);
  return {
    value: sanitized.slice(0, TEXT_LIMIT),
    truncated: sanitized.length > TEXT_LIMIT
  };
}

function lifecycleSummary(
  value: string
): Pick<ResearchLifecycleEventReadModel, "summary" | "summary_truncated"> {
  const text = bounded(value);
  return {
    summary: text.value,
    summary_truncated: text.truncated
  };
}

function exactSameRef(left: Ref | undefined, right: Ref | undefined): boolean {
  return Boolean(left && right && left.record_kind === right.record_kind && left.id === right.id);
}

function exactRef(value: unknown, kind: string, id?: string): value is Ref {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { record_kind?: unknown; id?: unknown };
  return candidate.record_kind === kind && safeIdentifier(candidate.id) &&
    (id === undefined || candidate.id === id);
}

function validRef(value: unknown): value is Ref {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { record_kind?: unknown; id?: unknown };
  return safeIdentifier(candidate.record_kind) && safeIdentifier(candidate.id);
}

function copyRef(value: Ref): Ref {
  return { record_kind: value.record_kind, id: value.id };
}

function rawSessionSeeds(
  allocations: CandidateArenaResearchAllocationRecord[],
  requestedWorkItemId?: string
): SessionSeed[] {
  const result: SessionSeed[] = [];
  for (const allocation of allocations) {
    const allocationId = allocation?.candidate_arena_research_allocation_id;
    if (!safeIdentifier(allocationId) || !Array.isArray(allocation?.selected_directions)) {
      continue;
    }
    for (const selection of allocation.selected_directions) {
      if (typeof selection?.direction_kind !== "string") continue;
      const workItemId = researchWorkItemId({
        research_allocation_id: allocationId,
        direction_kind: selection.direction_kind
      });
      if (requestedWorkItemId === undefined || requestedWorkItemId === workItemId) {
        result.push({ allocation, selection, workItemId });
      }
    }
  }
  return result;
}

function commitmentCandidatesForSeed(
  seed: Pick<SessionSeed, "allocation" | "selection">,
  index: ResearchOperationsProjectionIndex
): ResearchPreflightCommitmentRecord[] {
  return (index.commitmentsByAllocationId.get(
    seed.allocation.candidate_arena_research_allocation_id
  ) ?? []).filter((candidate) => rawCommitmentTargetsSelection(
    candidate,
    seed.allocation,
    seed.selection,
    index.directions
  ));
}

function candidateIdsForSessionSeeds(
  seeds: SessionSeed[],
  index: ResearchOperationsProjectionIndex
): string[] {
  const result = new Set<string>();
  for (const seed of seeds) {
    const ticks = tickCandidatesForSeed(seed, index);
    if (ticks.length !== 1 || !tickHasUniqueRawIdentity(ticks[0]!, index) ||
      !tickMatchesAllocation(ticks[0]!, seed.allocation)) {
      continue;
    }
    const directionResults = ticks[0]!.direction_results.filter((candidate) =>
      candidate.direction_kind === seed.selection.direction_kind
    );
    const candidateId = directionResults.length === 1 &&
      directionResults[0]!.status === "created" &&
      safeIdentifier(directionResults[0]!.candidate_id) &&
      ticks[0]!.created_candidate_refs.some((candidate) => exactRef(
        candidate,
        "trading_system_candidate",
        directionResults[0]!.candidate_id
      ))
      ? directionResults[0]!.candidate_id
      : undefined;
    if (candidateId) result.add(candidateId);
  }
  return [...result].sort();
}

function systemCodeIdsForSessionSeeds(
  seeds: SessionSeed[],
  index: ResearchOperationsProjectionIndex
): string[] {
  const result = new Set<string>();
  const behaviorFingerprintIds = new Set<string>();
  const distinctComparisonFingerprintIds = new Set<string>();
  for (const seed of seeds) {
    for (const commitment of commitmentCandidatesForSeed(seed, index)) {
      addExactSystemCodeId(result, commitment?.source_system_code_ref);
      const commitmentId = commitment?.research_preflight_commitment_id;
      if (typeof commitmentId !== "string") continue;
      for (const evaluation of index.evaluationsByCommitmentId.get(commitmentId) ?? []) {
        addExactSystemCodeId(result, evaluation?.submitted_system_code_ref);
        const evaluationId = evaluation?.trading_evaluation_result_id;
        if (typeof evaluationId !== "string") continue;
        for (const admission of index.admissionsByEvaluationId.get(evaluationId) ?? []) {
          if (admission?.behavior_comparison_status !== "distinct" &&
            admission?.behavior_comparison_status !== "duplicate") {
            continue;
          }
          addExactFingerprintId(
            behaviorFingerprintIds,
            admission.research_behavior_fingerprint_ref
          );
          if (admission.behavior_comparison_status === "distinct") {
            addExactFingerprintId(
              distinctComparisonFingerprintIds,
              admission.research_behavior_fingerprint_ref
            );
          }
          addExactFingerprintId(
            behaviorFingerprintIds,
            admission.matching_research_behavior_fingerprint_ref
          );
        }
      }
    }
  }

  for (const fingerprintId of behaviorFingerprintIds) {
    for (const referenced of index.fingerprintsById.get(fingerprintId) ?? []) {
      addExactSystemCodeId(result, referenced?.system_code_ref);
      const key = rawBehaviorFingerprintKey(referenced);
      if (!key || !distinctComparisonFingerprintIds.has(fingerprintId)) continue;
      for (const comparable of index.fingerprintsByBehaviorKey.get(key) ?? []) {
        if (hasCandidateDistinctFingerprintOwner(comparable, index)) {
          addExactSystemCodeId(result, comparable?.system_code_ref);
        }
      }
    }
  }
  return [...result].sort();
}

function addExactSystemCodeId(result: Set<string>, value: unknown): void {
  if (exactRef(value, "system_code")) result.add(value.id);
}

function addExactFingerprintId(result: Set<string>, value: unknown): void {
  if (exactRef(value, "research_behavior_fingerprint")) result.add(value.id);
}

function hasCandidateDistinctFingerprintOwner(
  fingerprint: ResearchBehaviorFingerprintRecord,
  index: ResearchOperationsProjectionIndex
): boolean {
  const fingerprintId = fingerprint?.research_behavior_fingerprint_id;
  return typeof fingerprintId === "string" &&
    (index.admissionsByFingerprintId.get(fingerprintId) ?? []).some((admission) =>
      admission?.behavior_comparison_status === "distinct" &&
      admission?.status === "admitted" && admission?.reason === "evaluation_accepted"
    );
}

function compareSessionSeeds(
  left: SessionSeed,
  right: SessionSeed,
  index: ResearchOperationsProjectionIndex
): number {
  return sessionSeedProgressAt(right, index).localeCompare(sessionSeedProgressAt(left, index)) ||
    left.allocation.candidate_arena_research_allocation_id.localeCompare(
      right.allocation.candidate_arena_research_allocation_id
    ) || left.selection.direction_kind.localeCompare(right.selection.direction_kind);
}

function sessionSeedProgressAt(
  seed: SessionSeed,
  _index: ResearchOperationsProjectionIndex
): string {
  // Allocation is the newest lifecycle timestamp whose complete authority
  // closure is available before bounded SystemCode loading. Keep the page
  // boundary and the final session order on this same trusted chronology so a
  // malformed off-page artifact graph cannot displace a canonical allocation.
  return seed.allocation.allocated_at;
}

function canonicalCommitmentForSeed(
  seed: SessionSeed,
  index: ResearchOperationsProjectionIndex
): ResearchPreflightCommitmentRecord | undefined {
  const commitments = commitmentCandidatesForSeed(seed, index);
  const commitment = commitments.length === 1 &&
    commitmentHasUniqueRawOwnership(commitments[0]!, index)
    ? commitments[0]
    : undefined;
  if (!commitment || !commitmentHasCanonicalRuntimeShape(commitment) ||
    !exactRef(
      commitment.research_allocation_ref,
      "candidate_arena_research_allocation",
      seed.allocation.candidate_arena_research_allocation_id
    ) || commitment.research_allocation_digest !== seed.allocation.allocation_digest ||
    commitment.candidate_arena_tick_id !== seed.allocation.tick_id ||
    commitment.development_policy.submission_limit !== seed.selection.experiment_budget) {
    return undefined;
  }
  const direction = exactRef(commitment.research_direction_ref, "research_direction")
    ? index.directions.get(commitment.research_direction_ref.id)
    : undefined;
  const worker = exactRef(commitment.research_worker_ref, "research_worker")
    ? index.workers.get(commitment.research_worker_ref.id)
    : undefined;
  return directionRecordMatches(direction, seed.selection.direction_kind) &&
    workerRecordMatches(worker, direction) &&
    Date.parse(commitment.committed_at) >= Date.parse(seed.allocation.allocated_at) &&
    Date.parse(commitment.committed_at) >= Date.parse(direction.created_at) &&
    Date.parse(commitment.committed_at) >= Date.parse(worker.created_at)
    ? commitment
    : undefined;
}

function canonicalCheckpointForSeed(
  seed: SessionSeed,
  commitment: ResearchPreflightCommitmentRecord,
  index: ResearchOperationsProjectionIndex
): ResearchWorkerCheckpointRecord | undefined {
  const checkpoints = index.checkpointIndex.checkpointsByCommitmentId.get(
    commitment.research_preflight_commitment_id
  ) ?? [];
  const direction = index.directions.get(commitment.research_direction_ref.id);
  const worker = index.workers.get(commitment.research_worker_ref.id);
  return checkpoints.length === 1 && direction && worker &&
    direction.direction_kind === seed.selection.direction_kind &&
    checkpointMatches(checkpoints[0]!, {
      commitment,
      worker,
      direction,
      index: index.checkpointIndex
    })
    ? checkpoints[0]
    : undefined;
}

function canonicalTickForSeed(
  seed: SessionSeed,
  commitment: ResearchPreflightCommitmentRecord | undefined,
  index: ResearchOperationsProjectionIndex
): CandidateArenaTickRecord | undefined {
  const ticks = tickCandidatesForSeed(seed, index);
  const tick = ticks.length === 1 && tickHasUniqueRawIdentity(ticks[0]!, index) &&
    tickMatchesAllocation(ticks[0]!, seed.allocation, commitment)
    ? ticks[0]
    : undefined;
  return tick && tick.direction_results.filter((result) =>
    result.direction_kind === seed.selection.direction_kind
  ).length === 1
    ? tick
    : undefined;
}

function tickCandidatesForSeed(
  seed: SessionSeed,
  index: ResearchOperationsProjectionIndex
): CandidateArenaTickRecord[] {
  return index.ticksByAllocationKey.get(tickAllocationKey(
    seed.allocation.tick_id,
    seed.allocation.candidate_arena_research_allocation_id
  )) ?? [];
}

function matchingRuntimeCandidates(
  seed: SessionSeed,
  index: ResearchOperationsProjectionIndex
): CandidateArenaActiveResearchWorkItemReadModel[] {
  return (index.runtimesByWorkItemId.get(seed.workItemId) ?? []).filter((candidate) =>
    candidate.research_allocation_id ===
      seed.allocation.candidate_arena_research_allocation_id &&
    candidate.direction_kind === seed.selection.direction_kind
  );
}

function sessionCapacity(
  seeds: SessionSeed[],
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): { activeCount: number; queuedCount: number; hasActiveRuntimeFailure: boolean } {
  let activeCount = 0;
  let queuedCount = 0;
  let hasActiveRuntimeFailure = false;
  for (const seed of seeds) {
    if (seed.allocation.tick_id !== graph.health.active_tick_id ||
      sessionSeedHasTerminalEvidence(seed, index)) {
      continue;
    }
    const runtimes = matchingRuntimeCandidates(seed, index);
    if (runtimes.length !== 1) {
      queuedCount += 1;
    } else if (runtimes[0]!.phase === "failed_closed_pending_tick") {
      hasActiveRuntimeFailure = true;
    } else {
      activeCount += 1;
    }
  }
  return { activeCount, queuedCount, hasActiveRuntimeFailure };
}

function sessionSeedRequiresRecovery(
  seed: SessionSeed,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): boolean {
  if (sessionSeedHasGraphConflict(seed, index)) return true;
  return seed.allocation.tick_id !== graph.health.active_tick_id &&
    !sessionSeedHasTerminalEvidence(seed, index);
}

function sessionSeedHasGraphConflict(
  seed: SessionSeed,
  index: ResearchOperationsProjectionIndex
): boolean {
  const commitments = commitmentCandidatesForSeed(seed, index);
  const commitment = canonicalCommitmentForSeed(seed, index);
  if (commitments.length > 0 && !commitment) {
    return true;
  }
  const ticks = tickCandidatesForSeed(seed, index);
  const tick = canonicalTickForSeed(seed, commitment, index);
  if (ticks.length > 0 && !tick) {
    return true;
  }
  if (!commitment) return false;
  const checkpoints = index.checkpointIndex.checkpointsByCommitmentId.get(
    commitment.research_preflight_commitment_id
  ) ?? [];
  const checkpoint = canonicalCheckpointForSeed(seed, commitment, index);
  if (checkpoints.length > 0 && !checkpoint) {
    return true;
  }
  const commitmentId = commitment.research_preflight_commitment_id;
  const evaluations = index.evaluationsByCommitmentId.get(commitmentId) ?? [];
  const tickResult = tick?.direction_results.find((candidate) =>
    candidate.direction_kind === seed.selection.direction_kind
  );
  const terminalAdmissionExpected = checkpoint?.terminal_reason === "admission_recorded" ||
    tickResult?.status === "created" || tickResult?.status === "duplicate" ||
    tickResult?.status === "quarantined";
  if (evaluations.length === 0) return terminalAdmissionExpected;
  if (evaluations.length !== 1) return true;
  return evaluations.some((evaluation) => {
    const evaluationId = evaluation?.trading_evaluation_result_id;
    if (typeof evaluationId !== "string" ||
      (index.evaluationsById.get(evaluationId)?.length ?? 0) !== 1) {
      return true;
    }
    const experiment = exactRef(evaluation.experiment_run_ref, "experiment_run")
      ? index.experiments.get(evaluation.experiment_run_ref.id)
      : undefined;
    if (!evaluationHasRuntimeShape(evaluation) || !experimentHasRuntimeShape(experiment) ||
      !["evaluated", "failed"].includes(experiment.status) ||
      Date.parse(experiment.submitted_at) < Date.parse(commitment.committed_at) ||
      Date.parse(evaluation.completed_at) < Date.parse(experiment.submitted_at) ||
      exactRef(
        experiment.research_worker_ref,
        "research_worker",
        commitment.research_worker_ref.id
      ) === false || exactRef(
        experiment.research_direction_ref,
        "research_direction",
        commitment.research_direction_ref.id
      ) === false || !exactSameRef(
        experiment.system_code_ref,
        evaluation.submitted_system_code_ref
      ) || !exactSameRef(
        experiment.trading_evaluation_task_ref,
        evaluation.trading_evaluation_task_ref
      ) || !exactRef(
        evaluation.research_preflight_commitment_ref,
        "research_preflight_commitment",
        commitmentId
      ) || evaluation.research_preflight_commitment_digest !==
        commitment.commitment_digest || evaluation.sealed_admission_suite_digest !==
        commitment.sealed_admission_policy.suite_digest ||
      evaluation.evaluation_phase !== "sealed_admission" ||
      evaluation.submission_sequence !== 1 ||
      !Number.isInteger(evaluation.selected_development_submission_sequence) ||
      evaluation.selected_development_submission_sequence! < 1 ||
      evaluation.selected_development_submission_sequence! >
        commitment.development_policy.submission_limit) {
      return true;
    }
    const admissions = index.admissionsByEvaluationId.get(evaluationId) ?? [];
    if (admissions.length !== 1) return true;
    const admission = admissions[0]!;
    const admissionId = admission?.candidate_admission_decision_id;
    let policyConsistent = false;
    try {
      policyConsistent = isCandidateAdmissionDecisionConsistent(admission);
    } catch {
      policyConsistent = false;
    }
    if (typeof admissionId !== "string" ||
      (index.admissionsById.get(admissionId)?.length ?? 0) !== 1 ||
      admission.record_kind !== "candidate_admission_decision" || admission.version !== 1 ||
      !policyConsistent || !safeIsoTimestamp(admission.decided_at) ||
      Date.parse(admission.decided_at) < Date.parse(evaluation.completed_at) ||
      !exactRef(
        admission.research_preflight_commitment_ref,
        "research_preflight_commitment",
        commitmentId
      ) || admission.research_preflight_commitment_digest !== commitment.commitment_digest ||
      !exactSameRef(admission.source_system_code_ref, commitment.source_system_code_ref) ||
      admission.source_artifact_digest !== commitment.source_artifact_digest ||
      !exactSameRef(admission.system_code_ref, evaluation.submitted_system_code_ref) ||
      admission.submitted_artifact_digest !== evaluation.submitted_artifact_digest ||
      !exactRef(admission.experiment_run_ref, "experiment_run", experiment.experiment_run_id) ||
      admission.experiment_status !== experiment.status || !exactRef(
        admission.trading_evaluation_result_ref,
        "trading_evaluation_result",
        evaluationId
      ) || admission.evaluation_status !== evaluation.result_status ||
      admission.evidence_disposition !== evaluation.evidence_disposition ||
      !exactRef(admission.research_finding_ref, "research_finding") ||
      admission.authority_status !== "not_live") {
      return true;
    }
    if (tickResult && !terminalDirectionResultMatchesAdmission(tickResult, admission)) {
      return true;
    }
    const conformanceFields = [
      admission.paper_handoff_conformance_status,
      admission.paper_trading_handoff_conformance_ref,
      admission.paper_trading_handoff_conformance_digest
    ].filter((candidate) => candidate !== undefined).length;
    if (conformanceFields === 0) return admission.status === "admitted";
    if (conformanceFields !== 3 || !exactRef(
      admission.paper_trading_handoff_conformance_ref,
      "paper_trading_handoff_conformance"
    )) {
      return true;
    }
    const conformance = index.conformances.get(
      admission.paper_trading_handoff_conformance_ref.id
    );
    return !conformance || !conformanceHasRuntimeShape(
      conformance,
      [...index.conformances.values()]
    ) || admission.paper_handoff_conformance_status !== conformance.status ||
      admission.paper_trading_handoff_conformance_digest !== conformance.evidence_digest ||
      Date.parse(conformance.started_at) < Date.parse(experiment.submitted_at) ||
      Date.parse(conformance.completed_at) > Date.parse(evaluation.completed_at) ||
      Date.parse(admission.decided_at) < Date.parse(conformance.completed_at) ||
      !exactSameRef(conformance.system_code_ref, evaluation.submitted_system_code_ref) ||
      conformance.system_code_artifact_digest !== evaluation.submitted_artifact_digest ||
      !exactRef(conformance.experiment_run_ref, "experiment_run", experiment.experiment_run_id) ||
      !exactSameRef(
        conformance.trading_evaluation_task_ref,
        experiment.trading_evaluation_task_ref
      );
  });
}

function sessionSeedHasTerminalEvidence(
  seed: SessionSeed,
  index: ResearchOperationsProjectionIndex
): boolean {
  const commitment = canonicalCommitmentForSeed(seed, index);
  const tick = canonicalTickForSeed(seed, commitment, index);
  if (!commitment) return Boolean(tick);
  return Boolean(
    canonicalCheckpointForSeed(seed, commitment, index) || tick
  );
}

function tickAllocationKey(tickId: string, allocationId: string): string {
  return JSON.stringify([tickId, allocationId]);
}

function createResearchOperationsProjectionIndex(
  graph: LoadedGraph
): ResearchOperationsProjectionIndex {
  return {
    allocationsById: groupedIndex(
      graph.allocations,
      (allocation) => allocation?.candidate_arena_research_allocation_id
    ),
    arenaEventAllocationsByEvidenceDigest: groupedIndex(
      graph.allocations.filter((allocation) =>
        allocation?.trigger?.trigger_kind === "arena_event"
      ),
      (allocation) => allocation?.trigger?.evidence_artifact_digest
    ),
    commitmentsByAllocationId: groupedIndex(
      graph.commitments,
      (commitment) => commitment?.research_allocation_ref?.id
    ),
    commitmentsById: groupedIndex(
      graph.commitments,
      (commitment) => commitment?.research_preflight_commitment_id
    ),
    commitmentsByRotationDigest: groupedIndex(
      graph.commitments,
      (commitment) => commitment?.sealed_admission_policy?.rotation_commitment_digest
    ),
    commitmentsBySuiteDigest: groupedIndex(
      graph.commitments,
      (commitment) => commitment?.sealed_admission_policy?.suite_digest
    ),
    ticksByAllocationKey: groupedIndex(graph.ticks, (tick) => {
      const tickId = tick?.tick_id;
      const allocationId = tick?.research_allocation_ref?.id;
      return typeof tickId === "string" && typeof allocationId === "string"
        ? tickAllocationKey(tickId, allocationId)
        : undefined;
    }),
    ticksById: groupedIndex(
      graph.ticks,
      (tick) => tick?.candidate_arena_tick_id
    ),
    candidateClaimsById: candidateClaimIndex(graph.ticks),
    runtimesByWorkItemId: groupedIndex(
      graph.health.active_research_work_items,
      (runtime) => runtime?.research_work_item_id
    ),
    evaluationsByCommitmentId: groupedIndex(
      graph.evaluations,
      (evaluation) => evaluation?.research_preflight_commitment_ref?.id
    ),
    evaluationsById: groupedIndex(
      graph.evaluations,
      (evaluation) => evaluation?.trading_evaluation_result_id
    ),
    admissionsByEvaluationId: groupedIndex(
      graph.admissions,
      (admission) => admission?.trading_evaluation_result_ref?.id
    ),
    admissionsById: groupedIndex(
      graph.admissions,
      (admission) => admission?.candidate_admission_decision_id
    ),
    admissionsByFingerprintId: groupedIndex(
      graph.admissions,
      (admission) => admission?.research_behavior_fingerprint_ref?.id
    ),
    lineagesBySystemCodeId: groupedIndex(
      graph.lineages,
      (lineage) => lineage?.child_system_code_ref?.id
    ),
    fingerprintsById: groupedIndex(
      graph.fingerprints,
      (fingerprint) => fingerprint?.research_behavior_fingerprint_id
    ),
    fingerprintsByBehaviorKey: groupedIndex(
      graph.fingerprints,
      rawBehaviorFingerprintKey
    ),
    allocationPolicyDecisionsById: groupedIndex(
      graph.allocationPolicyDecisions,
      (decision) => decision?.research_allocation_policy_decision_id
    ),
    allocationPolicyDecisionsByOutcomeId: groupedIndex(
      graph.allocationPolicyDecisions,
      (decision) => decision?.study_outcome_ref?.id
    ),
    generalizationPolicyDecisionsById: groupedIndex(
      graph.generalizationPolicyDecisions,
      (decision) => decision?.research_generalization_policy_decision_id
    ),
    generalizationPolicyDecisionsByOutcomeId: groupedIndex(
      graph.generalizationPolicyDecisions,
      (decision) => decision?.generalization_outcome_ref?.id
    ),
    controlStudiesById: groupedIndex(
      graph.controlStudies,
      (study) => study?.research_control_study_id
    ),
    controlStudyOutcomesById: groupedIndex(
      graph.controlStudyOutcomes,
      (outcome) => outcome?.research_control_study_outcome_id
    ),
    controlStudyOutcomesByStudyId: groupedIndex(
      graph.controlStudyOutcomes,
      (outcome) => outcome?.study_ref?.id
    ),
    generalizationProtocolsById: groupedIndex(
      graph.generalizationProtocols,
      (protocol) => protocol?.research_generalization_protocol_id
    ),
    generalizationOutcomesById: groupedIndex(
      graph.generalizationOutcomes,
      (outcome) => outcome?.research_generalization_outcome_id
    ),
    generalizationOutcomesByProtocolId: groupedIndex(
      graph.generalizationOutcomes,
      (outcome) => outcome?.protocol_ref?.id
    ),
    memoryControlStudiesById: groupedIndex(
      graph.memoryControlStudies,
      (study) => study?.research_memory_control_study_id
    ),
    findingsById: groupedIndex(
      graph.findings,
      (finding) => finding?.research_finding_id
    ),
    directions: uniqueIndex(
      graph.directions,
      (direction) => direction?.research_direction_id
    ),
    workers: uniqueIndex(
      graph.workers,
      (worker) => worker?.research_worker_id
    ),
    evidence: canonicalEvidenceIndex(graph.evidence),
    experiments: uniqueIndex(
      graph.experiments,
      (experiment) => experiment?.experiment_run_id
    ),
    conformances: uniqueIndex(
      graph.conformances,
      (conformance) => conformance?.paper_trading_handoff_conformance_id
    ),
    findings: uniqueIndex(
      graph.findings,
      (finding) => finding?.research_finding_id
    ),
    checkpointIndex: createCheckpointValidationIndex(graph),
    canonicalFingerprintMemo: new Map()
  };
}

function uniqueIndex<T>(values: T[], id: (value: T) => unknown): Map<string, T> {
  const result = new Map<string, T>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const key = id(value);
    if (typeof key !== "string") continue;
    if (result.has(key)) {
      duplicates.add(key);
    } else {
      result.set(key, value);
    }
  }
  for (const key of duplicates) result.delete(key);
  return result;
}

function createCheckpointValidationIndex(graph: LoadedGraph): CheckpointValidationIndex {
  const checkpointsByCommitmentId = groupedIndex(
    graph.checkpoints,
    (checkpoint) => checkpoint?.research_preflight_commitment_ref?.id
  );
  const checkpointsById = groupedIndex(
    graph.checkpoints,
    (checkpoint) => checkpoint?.research_worker_checkpoint_id
  );
  const admissionsById = groupedIndex(
    graph.admissions,
    (admission) => admission?.candidate_admission_decision_id
  );
  const commitmentsByWorkerId = groupedIndex(
    graph.commitments.filter(commitmentHasCanonicalRuntimeShape),
    (commitment) => exactRef(commitment.research_worker_ref, "research_worker")
      ? commitment.research_worker_ref.id
      : undefined
  );
  const commitmentPositions = new WeakMap<ResearchPreflightCommitmentRecord, number>();
  for (const commitments of commitmentsByWorkerId.values()) {
    commitments.sort((left, right) => left.committed_at.localeCompare(right.committed_at) ||
      left.research_preflight_commitment_id.localeCompare(
        right.research_preflight_commitment_id
      ));
    commitments.forEach((commitment, position) => {
      commitmentPositions.set(commitment, position);
    });
  }
  return {
    checkpointsByCommitmentId,
    checkpointsById,
    commitmentsByWorkerId,
    commitmentPositions,
    admissionsById,
    validationMemo: new Map()
  };
}

function groupedIndex<T>(
  values: T[],
  id: (value: T) => unknown
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const key = id(value);
    if (typeof key !== "string") continue;
    const group = result.get(key);
    if (group) {
      group.push(value);
    } else {
      result.set(key, [value]);
    }
  }
  return result;
}

function candidateClaimIndex(
  ticks: CandidateArenaTickRecord[]
): Map<string, CandidateClaim[]> {
  const result = new Map<string, CandidateClaim[]>();
  for (const tick of ticks) {
    if (!Array.isArray(tick?.direction_results)) continue;
    for (const candidate of tick.direction_results) {
      if (candidate?.status !== "created" || !safeIdentifier(candidate.candidate_id)) {
        continue;
      }
      const claim = { tick, result: candidate };
      const claims = result.get(candidate.candidate_id);
      if (claims) {
        claims.push(claim);
      } else {
        result.set(candidate.candidate_id, [claim]);
      }
    }
  }
  return result;
}

function canonicalEvidenceIndex(
  values: ResearchEvidenceArtifactRecord[]
): Map<string, ResearchEvidenceArtifactRecord> {
  const byId = groupedIndex(
    values,
    (record) => record?.research_evidence_artifact_id
  );
  const byArtifactDigest = groupedIndex(
    values,
    (record) => record?.artifact_digest
  );
  const bySourceIdentity = groupedIndex(values, (record) => {
    const sourceKind = record?.source_kind;
    const artifactKind = record?.artifact_ref?.record_kind;
    const artifactId = record?.artifact_ref?.id;
    const sourceDigest = record?.source_digest;
    return typeof sourceKind === "string" && typeof artifactKind === "string" &&
      typeof artifactId === "string" && typeof sourceDigest === "string"
      ? JSON.stringify([sourceKind, artifactKind, artifactId, sourceDigest])
      : undefined;
  });
  const accepted = values.filter((record) =>
    researchEvidenceArtifactHasRuntimeShape(record) &&
    safeIdentifier(record.research_evidence_artifact_id) &&
    privacySafeEvidenceRef(record.subject_ref) &&
    privacySafeEvidenceRef(record.artifact_ref) &&
    record.artifact_digest === canonicalDigest(
      researchEvidenceArtifactDigestInput(record)
    ) &&
    (byId.get(record.research_evidence_artifact_id)?.length ?? 0) === 1 &&
    (byArtifactDigest.get(record.artifact_digest)?.length ?? 0) === 1 &&
    (bySourceIdentity.get(JSON.stringify([
      record.source_kind,
      record.artifact_ref.record_kind,
      record.artifact_ref.id,
      record.source_digest
    ]))?.length ?? 0) === 1
  );
  return new Map(accepted.map((record) => [
    record.research_evidence_artifact_id,
    record
  ]));
}

function addReason(
  reasons: ResearchSessionDegradedReason[],
  reason: ResearchSessionDegradedReason
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= TEXT_LIMIT &&
    safeId(value, { maxLength: TEXT_LIMIT }) === value;
}

function privacySafeEvidenceRef(value: unknown): value is Ref {
  return validRef(value) && safeId(value.id, { maxLength: TEXT_LIMIT }) === value.id;
}

function runtimeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2_000 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function hasExactKeys(value: unknown, expected: string[]): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  return actual.length === canonicalExpected.length && actual.every((key, index) =>
    key === canonicalExpected[index]
  );
}

function canonicalDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= TEXT_LIMIT &&
    !/[\u0000-\u001f\u007f]/.test(value) && Number.isFinite(Date.parse(value));
}

function refsAreUnique(values: Ref[]): boolean {
  const keys = values.map((value) => `${value.record_kind}:${value.id}`);
  return new Set(keys).size === keys.length;
}

function validTrigger(
  value: CandidateArenaResearchAllocationRecord["trigger"]
): value is NonNullable<CandidateArenaResearchAllocationRecord["trigger"]> {
  return Boolean(value && safeIdentifier(value.trigger_id) &&
    typeof value.goal === "string" && Number.isFinite(Date.parse(value.triggered_at)));
}

function triggerEvidenceMatches(
  trigger: CandidateArenaResearchAllocationRecord["trigger"],
  evidence: Map<string, ResearchEvidenceArtifactRecord>
): boolean {
  if (!trigger?.evidence_artifact_ref && !trigger?.evidence_artifact_digest) return true;
  if (!exactRef(trigger.evidence_artifact_ref, "research_evidence_artifact") ||
    !validDigest(trigger.evidence_artifact_digest)) return false;
  const record = evidence.get(trigger.evidence_artifact_ref.id);
  return Boolean(record && record.sanitization_status === "sanitized" &&
    record.artifact_digest === trigger.evidence_artifact_digest &&
    exactSameRef(record.artifact_ref, trigger.source_ref) &&
    Date.parse(record.captured_at) <= Date.parse(trigger.triggered_at));
}
