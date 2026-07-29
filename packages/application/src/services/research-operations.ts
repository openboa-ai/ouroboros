import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  candidateArenaTickAuthorityGraphHasRuntimeShape,
  candidateArenaTickHasRuntimeShape,
  candidateEgressAttestationIdForConformance,
  deriveCandidateArenaTickStatus,
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
  researchPopulationDiversityHasRuntimeShape,
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
  type CandidateArenaTickProjectedDirectionResultReadModel,
  type CandidateArenaTickReadModel,
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
  type ResearchGeneralizationReadModel,
  type ResearchLifecycleEventReadModel,
  type ResearchOperationsReadModel,
  type ResearchSessionDegradedReason,
  type ResearchSessionDetailReadModel,
  type ResearchSessionStatusBasisReadModel,
  type ResearchSessionSummaryReadModel,
  type ResearchSessionSummaryWireReadModel,
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
import { projectCandidateArenaTickReadModel } from "../candidate/arena";
import {
  buildResearchGeneralizationReadModel,
  ResearchGeneralizationReadModelError
} from
  "../candidate/research-generalization-read-model";
import {
  buildResearchPopulationDiversity,
  ResearchPopulationDiversityEvidenceError
} from
  "../candidate/research-population-diversity";
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
import type {
  OuroborosStorePort,
  ResearchOperationsProjectionCapsule,
  ResearchOperationsProjectionCapsuleTrieNode,
  ResearchOperationsProjectionCapsuleTrieNodeRef,
  ResearchOperationsProjectionIndexRecord,
  ResearchOperationsProjectionWindow
} from "../ports/store";
import { safeId } from "../safe-id";

const TEXT_LIMIT = 500;
const HISTORY_LIMIT = 100;
export const RESEARCH_OPERATIONS_SESSION_LIMIT = 100;
const RESEARCH_OPERATIONS_CAPSULE_MAX_BYTES = 256 * 1024;
const RESEARCH_OPERATIONS_CAPSULE_TRIE_LEAF_MAX_BYTES = 16 * 1024;
const RESEARCH_OPERATIONS_CAPSULE_TRIE_NODE_MAX_BYTES = 256 * 1024;
const RESEARCH_OPERATIONS_INDEX_MAX_BYTES = 256 * 1024;
export const RESEARCH_OPERATIONS_SOURCE_RECORD_MAX_BYTES = 256 * 1024;
const RESEARCH_OPERATIONS_OPEN_SESSION_LIMIT = 100;
const SESSION_MEMBERSHIP_BIT_COUNT = 32_768;
const SESSION_MEMBERSHIP_HASH_COUNT = 7;

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
  | "readResearchOperationsProjectionWindow"
>;

export interface ResearchOperationsProjectionServiceOptions {
  store: ResearchOperationsStore;
  runnerHealth(): CandidateArenaRunnerHealthReadModel;
}

export function unavailableResearchOperationsReadModel(
  health: CandidateArenaRunnerHealthReadModel,
  _arenaEvidence: CandidateArenaEvidenceSnapshot
): ResearchOperationsReadModel {
  return {
    projection_kind: "research_operations",
    availability: "unavailable",
    loop_status: "degraded",
    capacity: {
      max_concurrent_sessions:
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
  candidateMaterializationExact: boolean;
  evaluationChainAmbiguous: boolean;
  evaluationGraphConflict: boolean;
  tickAmbiguous: boolean;
  admissionGraphConflict: boolean;
  admissionIntegrityConflict: boolean;
  terminalAdmissionConflict: boolean;
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
  admissionsByCommitmentId: Map<string, CandidateAdmissionDecisionRecord[]>;
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
    if (typeof this.options.store.readResearchOperationsProjectionWindow ===
      "function") {
      return this.readMaterializedOperations(arenaEvidence);
    }
    return this.readOperationsFromGraph(arenaEvidence);
  }

  private async readOperationsFromGraph(
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
      .map((source) => summaryForWire(projectSummary(source, graph.health)))
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
    if (typeof this.options.store.readResearchOperationsProjectionWindow ===
      "function") {
      return this.readMaterializedSessionDetail(requestedWorkItemId);
    }
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

  async materializeProjection(
    arenaEvidence?: CandidateArenaEvidenceSnapshot
  ): Promise<{
    index: ResearchOperationsProjectionIndexRecord;
    capsules: ResearchOperationsProjectionCapsule[];
    capsule_trie_nodes: ResearchOperationsProjectionCapsuleTrieNode[];
  }> {
    const graph = await this.load(arenaEvidence);
    const projectionIndex = createResearchOperationsProjectionIndex(graph);
    const seeds = this.sessionSeeds(graph, projectionIndex)
      .sort((left, right) => compareSessionSeeds(left, right, projectionIndex));
    await Promise.all([
      this.loadSystemCodes(graph, projectionIndex, seeds),
      this.loadCandidates(graph, projectionIndex, seeds)
    ]);
    const sources = this.sources(graph, projectionIndex, seeds);
    const tickResearchWorkItemIds = new Map<string, string[]>();
    for (const seed of seeds) {
      const ids = tickResearchWorkItemIds.get(seed.allocation.tick_id) ?? [];
      if (!ids.includes(seed.workItemId)) ids.push(seed.workItemId);
      tickResearchWorkItemIds.set(seed.allocation.tick_id, ids);
    }
    for (const ids of tickResearchWorkItemIds.values()) ids.sort();
    const capsules = sources.map((source, position) => {
      const seed = seeds[position]!;
      const { runtime: _runtime, ...materializedSource } = source;
      const inactiveHealth = materializationHealth();
      const activeHealth = materializationHealth(seed.allocation.tick_id);
      const inactiveDetail = projectDetail(materializedSource, inactiveHealth);
      const activeQueuedDetail = projectDetail(materializedSource, activeHealth);
      return sealResearchOperationsProjectionCapsule({
        record_kind: "research_operations_projection_capsule",
        version: 1,
        research_work_item_id: seed.workItemId,
        runtime_identity: {
          research_work_item_id: seed.workItemId,
          research_allocation_id:
            seed.allocation.candidate_arena_research_allocation_id,
          tick_id: seed.allocation.tick_id,
          tick_research_work_item_ids: [
            ...(tickResearchWorkItemIds.get(seed.allocation.tick_id) ?? [])
          ],
          direction_kind: seed.selection.direction_kind,
          ...(source.commitment
            ? {
                commitment_id:
                  source.commitment.research_preflight_commitment_id
              }
            : {}),
          concurrency_limit: seed.allocation.policy.concurrency_limit
        },
        inactive_detail: inactiveDetail,
        active_queued_detail: activeQueuedDetail,
        graph_conflict: sessionSeedHasGraphConflict(seed, projectionIndex),
        // Only terminal evidence admitted into the exact projected detail may
        // close the materialized session. A raw checkpoint behind an invalid
        // commitment closure must remain recoverable rather than becoming
        // terminal through the seed-only pre-load index.
        terminal_evidence_present: inactiveDetail.lifecycle_events.some(
          (event) => event.event_kind === "checkpoint" || event.event_kind === "tick"
        ),
        authority_status: "read_only"
      });
    });
    const candidateArenaEvidence = materializeCandidateArenaEvidence(
      graph,
      projectionIndex
    );
    const capsuleTrie = materializeResearchOperationsProjectionCapsuleTrie(
      capsules
    );
    const graphConflictCount = capsules.filter((capsule) =>
      capsule.graph_conflict
    ).length;
    const incompleteWithoutConflictCount = capsules.filter((capsule) =>
      !capsule.graph_conflict && !capsule.terminal_evidence_present
    ).length;
    const openTickProjection = projectResearchOperationsOpenTickSessions(
      capsules
    );
    const index = sealResearchOperationsProjectionIndex({
      record_kind: "research_operations_projection_index",
      version: 1,
      head_session_refs: capsules
        .slice(0, RESEARCH_OPERATIONS_SESSION_LIMIT)
        .map((capsule) => ({
          research_work_item_id: capsule.research_work_item_id,
          allocated_at: capsule.inactive_detail.allocated_at!,
          capsule_digest: capsule.capsule_digest
        })),
      ...openTickProjection,
      capsule_trie_root_refs: capsuleTrie.root_refs,
      recorded_session_count: capsules.length,
      graph_conflict_count: graphConflictCount,
      incomplete_without_conflict_count: incompleteWithoutConflictCount,
      capsule_set_digest: researchOperationsProjectionCapsuleTrieDigest(
        capsuleTrie.root_refs
      ),
      session_membership: createSessionMembership(capsules.map((capsule) =>
        capsule.research_work_item_id
      )),
      candidate_arena_evidence: candidateArenaEvidence,
      authority_status: "read_only"
    });
    return { index, capsules, capsule_trie_nodes: capsuleTrie.nodes };
  }

  private async readMaterializedOperations(
    arenaEvidence?: CandidateArenaEvidenceSnapshot
  ): Promise<ResearchOperationsReadModel> {
    const health = this.options.runnerHealth();
    const activeWorkItemIds = new Set(
      health.active_research_work_items.map((item) => item.research_work_item_id)
    );
    const window = await this.options.store.readResearchOperationsProjectionWindow!({
      session_limit: RESEARCH_OPERATIONS_SESSION_LIMIT,
      ...(health.active_tick_id ? { active_tick_id: health.active_tick_id } : {}),
      active_research_work_item_ids: [...activeWorkItemIds],
      ...(arenaEvidence?.projection_digest
        ? { expected_projection_digest: arenaEvidence.projection_digest }
        : {})
    });
    assertResearchOperationsProjectionWindow(window);
    const capsulesById = new Map(window.capsules.map((capsule) => [
      capsule.research_work_item_id,
      capsule
    ]));
    const headCapsules = window.index.head_session_refs.map((reference) => {
      const capsule = capsulesById.get(reference.research_work_item_id);
      if (!capsule || capsule.capsule_digest !== reference.capsule_digest ||
        capsule.inactive_detail.allocated_at !== reference.allocated_at) {
        throw new Error("research_operations_projection_head_mismatch");
      }
      return capsule;
    });
    const sessions = headCapsules
      .map((capsule) => summaryFromDetail(materializedDetail(capsule, health)))
      .sort(compareSessions);
    const activeCapsules = [...capsulesById.values()].filter((capsule) =>
      capsule.runtime_identity.tick_id === health.active_tick_id
    );
    const capacity = materializedSessionCapacity(activeCapsules, health);
    const activeIncompleteWithoutConflictCount = activeCapsules.filter((capsule) =>
      !capsule.graph_conflict && !capsule.terminal_evidence_present
    ).length;
    const hasInactiveRecovery = window.index.graph_conflict_count > 0 ||
      window.index.incomplete_without_conflict_count >
        activeIncompleteWithoutConflictCount ||
      sessions.some((entry) => entry.status === "recovering");
    const hasActiveRuntimeFailure = capacity.hasActiveRuntimeFailure ||
      sessions.some((entry) =>
        entry.status === "failed_closed" &&
        entry.status_basis.basis_kind === "runtime_research_work_item"
      );
    const loopStatus = health.status === "running"
      ? health.consecutive_failure_count > 0 || hasInactiveRecovery ||
          hasActiveRuntimeFailure
        ? "degraded"
        : "running"
      : health.active_tick
        ? "stopping"
        : hasInactiveRecovery ? "degraded" : "stopped";
    const activeConcurrencyLimit = activeCapsules[0]
      ?.runtime_identity.concurrency_limit;
    const omittedSessionCount = window.index.recorded_session_count - sessions.length;
    if (omittedSessionCount < 0) {
      throw new Error("research_operations_projection_count_mismatch");
    }
    return {
      projection_kind: "research_operations",
      availability: "available",
      loop_status: loopStatus,
      capacity: {
        max_concurrent_sessions: activeConcurrencyLimit ??
          CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.concurrency_limit,
        active_session_count: capacity.activeCount,
        queued_session_count: capacity.queuedCount
      },
      sessions,
      recorded_session_count: window.index.recorded_session_count,
      projected_session_count: sessions.length,
      omitted_session_count: omittedSessionCount,
      sessions_truncated: omittedSessionCount > 0,
      ...(sessions[0]
        ? { latest_session_id: sessions[0].research_work_item_id }
        : {}),
      authority_status: "research_only"
    };
  }

  private async readMaterializedSessionDetail(
    requestedWorkItemId: string
  ): Promise<ResearchSessionDetailReadModel | undefined> {
    const window = await this.options.store.readResearchOperationsProjectionWindow!({
      session_limit: 0,
      exact_research_work_item_id: requestedWorkItemId
    });
    assertResearchOperationsProjectionWindow(window);
    const matching = window.capsules.filter((capsule) =>
      capsule.research_work_item_id === requestedWorkItemId
    );
    if (matching.length === 0) return undefined;
    if (matching.length !== 1) {
      throw new Error("research_operations_projection_detail_ambiguous");
    }
    const health = this.options.runnerHealth();
    return materializedDetail(matching[0]!, health);
  }

  private async load(
    arenaEvidence?: CandidateArenaEvidenceSnapshot,
    suppliedAllocations?: CandidateArenaResearchAllocationRecord[]
  ): Promise<LoadedGraph> {
    const health = this.options.runnerHealth();
    const rawArenaEvidence = arenaEvidence?.availability === undefined
      ? arenaEvidence
      : undefined;
    const allocations = suppliedAllocations ?? rawArenaEvidence?.allocations ??
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
      rawArenaEvidence?.ticks ?? this.options.store.listCandidateArenaTicks(),
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

function projectionDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}

function persistedProjectionBytes(value: unknown): number {
  return Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function projectResearchOperationsOpenTickSessions(
  capsules: ResearchOperationsProjectionCapsule[]
): Pick<
  ResearchOperationsProjectionIndexRecord,
  | "open_tick_session_refs"
  | "open_tick_session_count"
  | "projected_open_tick_session_count"
  | "omitted_open_tick_session_count"
  | "open_tick_sessions_truncated"
> {
  const openByTick = new Map<string, string[]>();
  for (const capsule of capsules) {
    if (capsule.terminal_evidence_present) continue;
    const ids = openByTick.get(capsule.runtime_identity.tick_id) ?? [];
    ids.push(capsule.research_work_item_id);
    openByTick.set(capsule.runtime_identity.tick_id, ids);
  }
  const openTickSessionCount = [...openByTick.values()].reduce(
    (total, ids) => total + ids.length,
    0
  );
  const projected = new Map<string, string[]>();
  let projectedOpenTickSessionCount = 0;
  for (const [tickId, ids] of openByTick) {
    if (projectedOpenTickSessionCount + ids.length >
      RESEARCH_OPERATIONS_OPEN_SESSION_LIMIT) {
      continue;
    }
    projected.set(tickId, [...ids].sort());
    projectedOpenTickSessionCount += ids.length;
  }
  const omittedOpenTickSessionCount = openTickSessionCount -
    projectedOpenTickSessionCount;
  return {
    open_tick_session_refs: [...projected]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tick_id, research_work_item_ids]) => ({
        tick_id,
        research_work_item_ids
      })),
    open_tick_session_count: openTickSessionCount,
    projected_open_tick_session_count: projectedOpenTickSessionCount,
    omitted_open_tick_session_count: omittedOpenTickSessionCount,
    open_tick_sessions_truncated: omittedOpenTickSessionCount > 0
  };
}

export function researchOperationsProjectionSourceRecordHasBoundedShape(
  record:
    | CandidateArenaResearchAllocationRecord
    | CandidateArenaTickRecord
    | ResearchFindingRecord
    | ArtifactLineageRecord
): boolean {
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(record), "utf8");
  } catch {
    return false;
  }
  if (bytes > RESEARCH_OPERATIONS_SOURCE_RECORD_MAX_BYTES) return false;
  if (record?.record_kind === "candidate_arena_research_allocation") {
    return candidateArenaResearchAllocationHasRuntimeShape(record) &&
      record.selected_directions.length <= 10 &&
      record.deferred_directions.length <= 10 &&
      record.selected_directions.every((selection) =>
        selection.reasons.length <= 10
      ) &&
      projectionIdentifier(record.candidate_arena_research_allocation_id) &&
      projectionIdentifier(record.tick_id) &&
      record.source_tick_refs.every((reference) =>
        projectionRef(reference, "candidate_arena_tick")
      ) && (!record.trigger || projectionIdentifier(record.trigger.trigger_id) &&
        (!record.trigger.source_ref || projectionRef(record.trigger.source_ref)) &&
        (!record.trigger.evidence_artifact_ref || projectionRef(
          record.trigger.evidence_artifact_ref,
          "research_evidence_artifact"
        )));
  }
  if (record?.record_kind === "candidate_arena_tick") {
    return candidateArenaTickHasRuntimeShape(record) &&
      record.created_candidate_refs.length <= 10 &&
      record.direction_results.length <= 10 &&
      projectionIdentifier(record.candidate_arena_tick_id) &&
      projectionIdentifier(record.tick_id) &&
      record.created_candidate_refs.every((reference) =>
        projectionRef(reference, "trading_system_candidate")
      ) && (!record.research_allocation_ref || projectionRef(
        record.research_allocation_ref,
        "candidate_arena_research_allocation"
      )) && record.direction_results.every((result) =>
        result.paper_handoff_conformance === undefined ||
        candidateArenaPaperHandoffReason(
          result.paper_handoff_conformance.reason
        )
      );
  }
  if (record?.record_kind === "research_finding") {
    return findingHasRuntimeShape(record);
  }
  return record?.record_kind === "artifact_lineage" &&
    lineageHasRuntimeShape(record);
}

export function researchOperationsProjectionCapsuleRouteHash(
  researchWorkItemId: string
): string {
  return createHash("sha256").update(researchWorkItemId).digest("hex");
}

export function materializeResearchOperationsProjectionCapsuleTrie(
  capsules: ResearchOperationsProjectionCapsule[]
): {
  root_refs: ResearchOperationsProjectionCapsuleTrieNodeRef[];
  nodes: ResearchOperationsProjectionCapsuleTrieNode[];
} {
  const entriesByRoot = new Map<string, Array<{
    research_work_item_id: string;
    capsule_digest: string;
  }>>();
  for (const capsule of capsules) {
    if (!projectionIdentifier(capsule.research_work_item_id) ||
      !validDigest(capsule.capsule_digest)) {
      throw new Error("research_operations_projection_capsule_trie_entry_invalid");
    }
    const rootPrefix = researchOperationsProjectionCapsuleRouteHash(
      capsule.research_work_item_id
    ).slice(0, 2);
    const entries = entriesByRoot.get(rootPrefix) ?? [];
    entries.push({
      research_work_item_id: capsule.research_work_item_id,
      capsule_digest: capsule.capsule_digest
    });
    entriesByRoot.set(rootPrefix, entries);
  }
  const nodes: ResearchOperationsProjectionCapsuleTrieNode[] = [];
  const roots = [...entriesByRoot]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([prefix, entries]) => buildResearchOperationsProjectionCapsuleTrieNode(
      prefix,
      entries,
      nodes
    ));
  const result = {
    root_refs: roots.map((node) => ({
      prefix: node.prefix,
      subtree_entry_count: node.subtree_entry_count,
      node_digest: node.node_digest
    })),
    nodes: nodes.sort((left, right) =>
      left.prefix.localeCompare(right.prefix) ||
      left.node_kind.localeCompare(right.node_kind)
    )
  };
  if (!researchOperationsProjectionCapsuleTrieHasIntegrity(
    result.root_refs,
    result.nodes,
    capsules
  )) {
    throw new Error("research_operations_projection_capsule_trie_invalid");
  }
  return result;
}

function buildResearchOperationsProjectionCapsuleTrieNode(
  prefix: string,
  unsortedEntries: Array<{
    research_work_item_id: string;
    capsule_digest: string;
  }>,
  nodes: ResearchOperationsProjectionCapsuleTrieNode[]
): ResearchOperationsProjectionCapsuleTrieNode {
  const entries = [...unsortedEntries].sort((left, right) =>
    left.research_work_item_id.localeCompare(right.research_work_item_id)
  );
  const leafInput = {
    record_kind: "research_operations_projection_capsule_trie_node" as const,
    version: 1 as const,
    node_kind: "leaf" as const,
    prefix,
    subtree_entry_count: entries.length,
    entries,
    authority_status: "read_only" as const
  };
  const leafBytes = persistedProjectionBytes({
    ...leafInput,
    node_digest: projectionDigest(leafInput)
  });
  if (leafBytes <= RESEARCH_OPERATIONS_CAPSULE_TRIE_LEAF_MAX_BYTES ||
    prefix.length === 64) {
    if (leafBytes > RESEARCH_OPERATIONS_CAPSULE_TRIE_NODE_MAX_BYTES) {
      throw new Error("research_operations_projection_capsule_trie_hash_collision");
    }
    const leaf = sealResearchOperationsProjectionCapsuleTrieNode(leafInput);
    nodes.push(leaf);
    return leaf;
  }
  const entriesByChild = new Map<string, typeof entries>();
  for (const entry of entries) {
    const routeHash = researchOperationsProjectionCapsuleRouteHash(
      entry.research_work_item_id
    );
    const childPrefix = routeHash.slice(0, prefix.length + 2);
    const childEntries = entriesByChild.get(childPrefix) ?? [];
    childEntries.push(entry);
    entriesByChild.set(childPrefix, childEntries);
  }
  const children = [...entriesByChild]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([childPrefix, childEntries]) =>
      buildResearchOperationsProjectionCapsuleTrieNode(
        childPrefix,
        childEntries,
        nodes
      )
    );
  const branch = sealResearchOperationsProjectionCapsuleTrieNode({
    record_kind: "research_operations_projection_capsule_trie_node",
    version: 1,
    node_kind: "branch",
    prefix,
    children: children.map((child) => ({
      prefix: child.prefix,
      subtree_entry_count: child.subtree_entry_count,
      node_digest: child.node_digest
    })),
    subtree_entry_count: children.reduce(
      (total, child) => total + child.subtree_entry_count,
      0
    ),
    authority_status: "read_only"
  });
  nodes.push(branch);
  return branch;
}

function sealResearchOperationsProjectionCapsuleTrieNode(
  input:
    | Omit<
        Extract<
          ResearchOperationsProjectionCapsuleTrieNode,
          { node_kind: "leaf" }
        >,
        "node_digest"
      >
    | Omit<
        Extract<
          ResearchOperationsProjectionCapsuleTrieNode,
          { node_kind: "branch" }
        >,
        "node_digest"
      >
): ResearchOperationsProjectionCapsuleTrieNode {
  const node = {
    ...input,
    node_digest: projectionDigest(input)
  } as ResearchOperationsProjectionCapsuleTrieNode;
  if (persistedProjectionBytes(node) >
    RESEARCH_OPERATIONS_CAPSULE_TRIE_NODE_MAX_BYTES) {
    throw new Error("research_operations_projection_capsule_trie_node_too_large");
  }
  return node;
}

export function researchOperationsProjectionCapsuleTrieNodeHasIntegrity(
  node: ResearchOperationsProjectionCapsuleTrieNode
): boolean {
  if (!node || node.record_kind !==
      "research_operations_projection_capsule_trie_node" || node.version !== 1 ||
    node.authority_status !== "read_only" ||
    !/^(?:[0-9a-f]{2}){1,32}$/.test(node.prefix) ||
    persistedProjectionBytes(node) >
      RESEARCH_OPERATIONS_CAPSULE_TRIE_NODE_MAX_BYTES ||
    !validDigest(node.node_digest)) {
    return false;
  }
  if (node.node_kind === "leaf") {
    if (!hasExactKeys(node, [
      "record_kind",
      "version",
      "node_kind",
      "prefix",
      "subtree_entry_count",
      "entries",
      "node_digest",
      "authority_status"
    ]) || !positiveSafeInteger(node.subtree_entry_count) ||
      !Array.isArray(node.entries) || node.entries.length === 0 ||
      node.subtree_entry_count !== node.entries.length ||
      (node.prefix.length < 64 && persistedProjectionBytes(node) >
        RESEARCH_OPERATIONS_CAPSULE_TRIE_LEAF_MAX_BYTES)) {
      return false;
    }
    let previous = "";
    for (const entry of node.entries) {
      if (!hasExactKeys(entry, [
        "research_work_item_id",
        "capsule_digest"
      ]) || !projectionIdentifier(entry.research_work_item_id) ||
        entry.research_work_item_id <= previous ||
        !researchOperationsProjectionCapsuleRouteHash(
          entry.research_work_item_id
        ).startsWith(node.prefix) || !validDigest(entry.capsule_digest)) {
        return false;
      }
      previous = entry.research_work_item_id;
    }
  } else if (node.node_kind === "branch") {
    if (!hasExactKeys(node, [
      "record_kind",
      "version",
      "node_kind",
      "prefix",
      "subtree_entry_count",
      "children",
      "node_digest",
      "authority_status"
    ]) || node.prefix.length >= 64 ||
      !positiveSafeInteger(node.subtree_entry_count) ||
      !Array.isArray(node.children) ||
      node.children.length === 0 || node.children.length > 256) {
      return false;
    }
    let previous = "";
    for (const child of node.children) {
      if (!hasExactKeys(child, [
        "prefix",
        "subtree_entry_count",
        "node_digest"
      ]) ||
        !/^(?:[0-9a-f]{2}){2,32}$/.test(child.prefix) ||
        child.prefix.length !== node.prefix.length + 2 ||
        !child.prefix.startsWith(node.prefix) || child.prefix <= previous ||
        !positiveSafeInteger(child.subtree_entry_count) ||
        !validDigest(child.node_digest)) {
        return false;
      }
      previous = child.prefix;
    }
    if (node.subtree_entry_count !== node.children.reduce(
      (total, child) => total + child.subtree_entry_count,
      0
    )) return false;
  } else {
    return false;
  }
  const { node_digest: _digest, ...input } = node;
  return node.node_digest === projectionDigest(input);
}

export function researchOperationsProjectionCapsuleTrieHasIntegrity(
  rootRefs: ResearchOperationsProjectionCapsuleTrieNodeRef[],
  nodes: ResearchOperationsProjectionCapsuleTrieNode[],
  capsules: ResearchOperationsProjectionCapsule[]
): boolean {
  if (!Array.isArray(rootRefs) || rootRefs.length > 256 ||
    !Array.isArray(nodes) || !Array.isArray(capsules)) {
    return false;
  }
  const nodesByPrefix = new Map<string, ResearchOperationsProjectionCapsuleTrieNode>();
  for (const node of nodes) {
    if (!researchOperationsProjectionCapsuleTrieNodeHasIntegrity(node) ||
      nodesByPrefix.has(node.prefix)) {
      return false;
    }
    nodesByPrefix.set(node.prefix, node);
  }
  let previousRoot = "";
  const pending: string[] = [];
  for (const rootRef of rootRefs) {
    if (!hasExactKeys(rootRef, [
      "prefix",
      "subtree_entry_count",
      "node_digest"
    ]) ||
      !/^[0-9a-f]{2}$/.test(rootRef.prefix) ||
      rootRef.prefix <= previousRoot ||
      !positiveSafeInteger(rootRef.subtree_entry_count) ||
      !validDigest(rootRef.node_digest)) {
      return false;
    }
    const root = nodesByPrefix.get(rootRef.prefix);
    if (!root || root.node_digest !== rootRef.node_digest ||
      root.subtree_entry_count !== rootRef.subtree_entry_count) return false;
    pending.push(root.prefix);
    previousRoot = rootRef.prefix;
  }
  const reached = new Set<string>();
  const projectedEntries = new Map<string, string>();
  while (pending.length > 0) {
    const prefix = pending.pop()!;
    if (reached.has(prefix)) return false;
    reached.add(prefix);
    const node = nodesByPrefix.get(prefix);
    if (!node) return false;
    if (node.node_kind === "branch") {
      for (const childRef of node.children) {
        const child = nodesByPrefix.get(childRef.prefix);
        if (!child || child.node_digest !== childRef.node_digest ||
          child.subtree_entry_count !== childRef.subtree_entry_count) return false;
        pending.push(child.prefix);
      }
    } else {
      for (const entry of node.entries) {
        if (projectedEntries.has(entry.research_work_item_id)) return false;
        projectedEntries.set(
          entry.research_work_item_id,
          entry.capsule_digest
        );
      }
    }
  }
  if (reached.size !== nodes.length || projectedEntries.size !== capsules.length) {
    return false;
  }
  const expectedEntries = new Map<string, string>();
  for (const capsule of capsules) {
    if (!projectionIdentifier(capsule.research_work_item_id) ||
      !validDigest(capsule.capsule_digest) ||
      expectedEntries.has(capsule.research_work_item_id)) {
      return false;
    }
    expectedEntries.set(capsule.research_work_item_id, capsule.capsule_digest);
  }
  return [...expectedEntries].every(([id, digest]) =>
    projectedEntries.get(id) === digest
  ) && rootRefs.reduce((total, reference) =>
    total + reference.subtree_entry_count,
    0
  ) === capsules.length;
}

export function researchOperationsProjectionCapsuleTrieDigest(
  rootRefs: ResearchOperationsProjectionCapsuleTrieNodeRef[]
): string {
  return projectionDigest({
    algorithm: "sha256_byte_radix_merkle_v1",
    root_refs: rootRefs
  });
}

function sealResearchOperationsProjectionCapsule(
  input: Omit<ResearchOperationsProjectionCapsule, "capsule_digest">
): ResearchOperationsProjectionCapsule {
  const capsule = {
    ...input,
    capsule_digest: projectionDigest(input)
  };
  if (persistedProjectionBytes(capsule) >
    RESEARCH_OPERATIONS_CAPSULE_MAX_BYTES) {
    throw new Error("research_operations_projection_capsule_too_large");
  }
  if (!researchOperationsProjectionCapsuleHasIntegrity(capsule)) {
    throw new Error("research_operations_projection_capsule_invalid");
  }
  return capsule;
}

function sealResearchOperationsProjectionIndex(
  input: Omit<ResearchOperationsProjectionIndexRecord, "projection_digest">
): ResearchOperationsProjectionIndexRecord {
  const index = {
    ...input,
    projection_digest: projectionDigest(input)
  };
  if (persistedProjectionBytes(index) >
    RESEARCH_OPERATIONS_INDEX_MAX_BYTES) {
    throw new Error("research_operations_projection_index_too_large");
  }
  if (!researchOperationsProjectionIndexHasIntegrity(index)) {
    throw new Error("research_operations_projection_index_invalid");
  }
  return index;
}

export function researchOperationsProjectionCapsuleHasIntegrity(
  capsule: ResearchOperationsProjectionCapsule
): boolean {
  const hasCommitment = capsule?.runtime_identity?.commitment_id !== undefined;
  if (!capsule ||
    !researchSessionDetailHasProjectionShape(capsule.inactive_detail) ||
    !researchSessionDetailHasProjectionShape(capsule.active_queued_detail)) {
    return false;
  }
  if (!hasExactKeys(capsule, [
    "record_kind",
    "version",
    "research_work_item_id",
    "runtime_identity",
    "inactive_detail",
    "active_queued_detail",
    "graph_conflict",
    "terminal_evidence_present",
    "authority_status",
    "capsule_digest"
  ]) || !hasExactKeys(capsule.runtime_identity, [
    "research_work_item_id",
    "research_allocation_id",
    "tick_id",
    "tick_research_work_item_ids",
    "direction_kind",
    ...(hasCommitment ? ["commitment_id"] : []),
    "concurrency_limit"
  ]) || capsule.record_kind !==
      "research_operations_projection_capsule" || capsule.version !== 1 ||
    capsule.authority_status !== "read_only" ||
    !projectionIdentifier(capsule.research_work_item_id) ||
    capsule.research_work_item_id !==
      capsule.runtime_identity?.research_work_item_id ||
    capsule.research_work_item_id !==
      capsule.inactive_detail?.research_work_item_id ||
    capsule.research_work_item_id !==
      capsule.active_queued_detail?.research_work_item_id ||
    capsule.runtime_identity.research_allocation_id !==
      capsule.inactive_detail.research_allocation_id ||
    capsule.runtime_identity.research_allocation_id !==
      capsule.active_queued_detail.research_allocation_id ||
    capsule.runtime_identity.tick_id !== capsule.inactive_detail.tick_id ||
    capsule.runtime_identity.tick_id !== capsule.active_queued_detail.tick_id ||
    capsule.runtime_identity.direction_kind !==
      capsule.inactive_detail.direction_kind ||
    capsule.runtime_identity.direction_kind !==
      capsule.active_queued_detail.direction_kind ||
    !projectionIdentifier(capsule.runtime_identity.research_allocation_id) ||
    !projectionIdentifier(capsule.runtime_identity.tick_id) ||
    !researchDirectionKind(capsule.runtime_identity.direction_kind) ||
    capsule.research_work_item_id !== researchWorkItemId({
      research_allocation_id:
        capsule.runtime_identity.research_allocation_id,
      direction_kind: capsule.runtime_identity.direction_kind
    }) ||
    hasCommitment && !projectionIdentifier(
      capsule.runtime_identity.commitment_id
    ) || (capsule.runtime_identity.commitment_id === undefined) !==
      (capsule.inactive_detail.commitment_id === undefined) ||
    capsule.runtime_identity.commitment_id !==
      capsule.inactive_detail.commitment_id ||
    capsule.runtime_identity.commitment_id !==
      capsule.active_queued_detail.commitment_id ||
    !boundedUniqueProjectionIdentifiers(
      capsule.runtime_identity.tick_research_work_item_ids,
      RESEARCH_OPERATIONS_SESSION_LIMIT
    ) || capsule.runtime_identity.tick_research_work_item_ids.length === 0 ||
    !capsule.runtime_identity.tick_research_work_item_ids.includes(
      capsule.research_work_item_id
    ) || capsule.runtime_identity.tick_research_work_item_ids.some(
      (id, index, ids) => index > 0 && ids[index - 1]! >= id
    ) ||
    !Number.isSafeInteger(capsule.runtime_identity.concurrency_limit) ||
    capsule.runtime_identity.concurrency_limit < 1 ||
    capsule.runtime_identity.concurrency_limit >
      RESEARCH_OPERATIONS_SESSION_LIMIT ||
    typeof capsule.graph_conflict !== "boolean" ||
    typeof capsule.terminal_evidence_present !== "boolean" ||
    !researchSessionDetailsShareImmutableProjection(
      capsule.inactive_detail,
      capsule.active_queued_detail
    ) ||
    capsule.terminal_evidence_present !==
      capsule.inactive_detail.lifecycle_events.some((event) =>
        event.event_kind === "checkpoint" || event.event_kind === "tick"
      ) ||
    capsule.graph_conflict && [
      capsule.inactive_detail,
      capsule.active_queued_detail
    ].some((detail) => detail.projection_health !== "degraded" ||
      detail.degraded_reasons.length === 0) ||
    typeof capsule.capsule_digest !== "string" ||
    persistedProjectionBytes(capsule) >
      RESEARCH_OPERATIONS_CAPSULE_MAX_BYTES) {
    return false;
  }
  const { capsule_digest: _digest, ...input } = capsule;
  return capsule.capsule_digest === projectionDigest(input);
}

function researchSessionDetailHasProjectionShape(
  value: unknown
): value is ResearchSessionDetailReadModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const detail = value as ResearchSessionDetailReadModel;
  const optionalBaseKeys = [
    "research_worker_id",
    "commitment_id",
    "allocated_at",
    "started_at",
    "last_progress_at",
    "completed_at",
    "selected_submission_sequence",
    "admitted_candidate_id"
  ].filter((key) => key in detail);
  const projectionKeys = [
    ...(detail.trigger_availability === "available" ? ["trigger"] : []),
    ...(detail.methodology_availability === "available" ? ["methodology"] : []),
    ...(detail.provider_availability === "available" ? ["provider"] : []),
    ...("model" in detail ? ["model"] : []),
    ...("model_truncated" in detail ? ["model_truncated"] : [])
  ];
  const optionalDetailKeys = [
    "admission_decision_ref",
    "paper_handoff_conformance_ref"
  ].filter((key) => key in detail);
  const historyKeys = detail.submission_history_availability ===
      "checkpoint_summary"
    ? [
        "recorded_submission_count",
        "projected_submission_count",
        "omitted_submission_count",
        "submission_history_truncated"
      ]
    : [];
  const selectedArtifactKeys = detail.selected_artifact_availability ===
      "available"
    ? ["selected_system_code_ref", "selected_system_code_artifact_digest"]
    : [];
  const expectedKeys = [...new Set([
    "identity_kind",
    "research_work_item_id",
    "research_allocation_id",
    "tick_id",
    "direction_kind",
    ...optionalBaseKeys,
    "status",
    "status_basis",
    "projection_health",
    "degraded_reasons",
    "budget",
    "latest_progress_summary",
    "latest_progress_summary_truncated",
    "trigger_availability",
    "methodology_availability",
    "provider_availability",
    ...projectionKeys,
    "authority_status",
    "evidence_inputs",
    "development_submissions",
    ...optionalDetailKeys,
    "notebook_summary",
    "notebook_summary_truncated",
    "lifecycle_events",
    "provider_logs_availability",
    "terminal_graph",
    "submission_history_availability",
    ...historyKeys,
    "selected_artifact_availability",
    ...selectedArtifactKeys
  ])];
  if (!hasExactKeys(detail, expectedKeys) ||
    !researchSessionSummaryHasProjectionShape(detail) ||
    !Array.isArray(detail.evidence_inputs) ||
    detail.evidence_inputs.length > 24 ||
    !detail.evidence_inputs.every(researchEvidenceInputHasProjectionShape) ||
    new Set(detail.evidence_inputs.map((entry) => entry.evidence_artifact_id))
      .size !== detail.evidence_inputs.length ||
    !Array.isArray(detail.development_submissions) ||
    detail.development_submissions.length > HISTORY_LIMIT ||
    !detail.development_submissions.every(
      researchDevelopmentSubmissionHasProjectionShape
    ) ||
    new Set(detail.development_submissions.map((entry) =>
      entry.submission_sequence
    )).size !== detail.development_submissions.length ||
    detail.development_submissions.some((entry, index, entries) =>
      index > 0 && entries[index - 1]!.submission_sequence >=
        entry.submission_sequence
    ) ||
    (detail.admission_decision_ref !== undefined && !projectionRef(
      detail.admission_decision_ref,
      "candidate_admission_decision"
    )) || (detail.paper_handoff_conformance_ref !== undefined && !projectionRef(
      detail.paper_handoff_conformance_ref,
      "paper_trading_handoff_conformance"
    )) || !Array.isArray(detail.notebook_summary) ||
    detail.notebook_summary.length > HISTORY_LIMIT ||
    !detail.notebook_summary.every((summary) =>
      projectionSanitizedText(summary, TEXT_LIMIT)
    ) || !isDeepStrictEqual(
      detail.notebook_summary,
      detail.development_submissions.map((entry) => entry.summary)
    ) || typeof detail.notebook_summary_truncated !== "boolean" ||
    detail.notebook_summary_truncated !== detail.development_submissions.some(
      (entry) => entry.summary_truncated
    ) || !Array.isArray(detail.lifecycle_events) ||
    detail.lifecycle_events.length === 0 ||
    detail.lifecycle_events.length > HISTORY_LIMIT ||
    !detail.lifecycle_events.every((event, index) =>
      researchLifecycleEventHasProjectionShape(event, index + 1)
    ) || detail.lifecycle_events.some((event, index, events) => {
      const previous = events[index - 1];
      return Boolean(previous) && (previous!.occurred_at > event.occurred_at ||
        previous!.occurred_at === event.occurred_at &&
          previous!.event_kind >= event.event_kind);
    }) || new Set(detail.lifecycle_events.map((event) => event.event_kind)).size !==
      detail.lifecycle_events.length ||
    detail.provider_logs_availability !== "not_persisted" ||
    !researchTerminalGraphHasProjectionShape(detail.terminal_graph) ||
    !researchSubmissionHistoryHasProjectionShape(detail) ||
    !researchSelectedArtifactHasProjectionShape(detail)) {
    return false;
  }
  const terminalAdmission = detail.terminal_graph.admission;
  const terminalConformance = detail.terminal_graph.paper_handoff_conformance;
  if ((detail.admission_decision_ref === undefined) !==
      (terminalAdmission === undefined) || terminalAdmission &&
    detail.admission_decision_ref!.id !==
      terminalAdmission.candidate_admission_decision_ref.id ||
    (detail.paper_handoff_conformance_ref === undefined) !==
      (terminalConformance === undefined) || terminalConformance &&
    detail.paper_handoff_conformance_ref!.id !==
      terminalConformance.paper_trading_handoff_conformance_ref.id) {
    return false;
  }
  if (!researchSessionAuthorityBindingsHaveProjectionShape(detail)) {
    return false;
  }
  if ((detail.selected_artifact_availability === "unavailable") !==
      detail.degraded_reasons.includes("selected_artifact_unavailable") ||
    detail.terminal_graph.admission?.status === "admitted" &&
      detail.terminal_graph.admitted_arena_handoff === undefined &&
      !detail.degraded_reasons.includes("terminal_admission_unavailable")) {
    return false;
  }
  const allocationEvent = detail.lifecycle_events.find((event) =>
    event.event_kind === "allocation"
  );
  const commitmentEvent = detail.lifecycle_events.find((event) =>
    event.event_kind === "commitment"
  );
  const handoff = detail.terminal_graph.admitted_arena_handoff;
  if (!allocationEvent ||
    allocationEvent.source_ref.id !== detail.research_allocation_id ||
    allocationEvent.occurred_at !== detail.allocated_at ||
    (detail.commitment_id === undefined) !== (commitmentEvent === undefined) ||
    commitmentEvent !== undefined && (
      commitmentEvent.source_ref.id !== detail.commitment_id ||
      commitmentEvent.occurred_at !== detail.started_at
    ) || detail.last_progress_at !== detail.lifecycle_events.at(-1)!.occurred_at ||
    detail.methodology_availability === "available" && !isDeepStrictEqual(
      detail.methodology.evidence_artifact_ids,
      detail.evidence_inputs.map((entry) => entry.evidence_artifact_id)
    ) || detail.development_submissions.some((submission) =>
      submission.submission_sequence >
        detail.budget.max_development_submission_count
    ) || detail.development_submissions.length >
      detail.budget.development_submission_count ||
    (detail.admitted_candidate_id === undefined) !== (handoff === undefined) ||
    handoff !== undefined && (
      handoff.candidate_ref.id !== detail.admitted_candidate_id ||
      handoff.direction_kind !== detail.direction_kind ||
      handoff.completed_at !== detail.completed_at
    ) || detail.terminal_graph.artifact_lineage !== undefined && (
      detail.selected_artifact_availability !== "available" ||
      detail.terminal_graph.artifact_lineage.child_system_code_ref.id !==
        detail.selected_system_code_ref.id
    )) {
    return false;
  }
  return true;
}

function researchSessionSummaryHasProjectionShape(
  summary: ResearchSessionSummaryReadModel
): boolean {
  const statusValues: ResearchSessionSummaryReadModel["status"][] = [
    "queued",
    "allocating",
    "running",
    "admitted",
    "duplicate",
    "quarantined",
    "finished_without_submission",
    "failed_closed",
    "recovering"
  ];
  const degradedReasons: ResearchSessionDegradedReason[] = [
    "trigger_unavailable",
    "methodology_unavailable",
    "provider_unavailable",
    "worker_unavailable",
    "evidence_artifact_unavailable",
    "selected_artifact_unavailable",
    "evaluation_graph_conflict",
    "admission_graph_conflict",
    "terminal_admission_unavailable",
    "inactive_incomplete_graph"
  ];
  if (summary.identity_kind !== "derived_projection" ||
    !projectionIdentifier(summary.research_work_item_id) ||
    !projectionIdentifier(summary.research_allocation_id) ||
    !projectionIdentifier(summary.tick_id) ||
    !researchDirectionKind(summary.direction_kind) ||
    (summary.research_worker_id !== undefined && !projectionIdentifier(
      summary.research_worker_id
    )) || (summary.commitment_id !== undefined && !projectionIdentifier(
      summary.commitment_id
    )) || !statusValues.includes(summary.status) ||
    !researchSessionStatusBasisHasProjectionShape(
      summary.status_basis,
      summary.status
    ) || !["complete", "degraded"].includes(summary.projection_health) ||
    !Array.isArray(summary.degraded_reasons) ||
    summary.degraded_reasons.length > degradedReasons.length ||
    !summary.degraded_reasons.every((reason) => degradedReasons.includes(reason)) ||
    new Set(summary.degraded_reasons).size !== summary.degraded_reasons.length ||
    (summary.projection_health === "complete") !==
      (summary.degraded_reasons.length === 0) ||
    !researchSessionBudgetHasProjectionShape(summary.budget) || [
      summary.allocated_at,
      summary.started_at,
      summary.last_progress_at,
      summary.completed_at
    ].some((timestamp) => timestamp !== undefined && !projectionIso(timestamp)) ||
    (summary.selected_submission_sequence !== undefined &&
      !positiveSafeInteger(summary.selected_submission_sequence)) ||
    (summary.admitted_candidate_id !== undefined && !projectionIdentifier(
      summary.admitted_candidate_id
    )) || !projectionSanitizedText(summary.latest_progress_summary, TEXT_LIMIT) ||
    typeof summary.latest_progress_summary_truncated !== "boolean" ||
    summary.authority_status !== "research_only" ||
    !researchTriggerProjectionHasShape(summary) ||
    !researchMethodologyProjectionHasShape(summary) ||
    !researchProviderProjectionHasShape(summary)) {
    return false;
  }
  const hasReason = (reason: ResearchSessionDegradedReason): boolean =>
    summary.degraded_reasons.includes(reason);
  if ((summary.trigger_availability === "unavailable") !==
      hasReason("trigger_unavailable") ||
    (summary.methodology_availability === "unavailable") !==
      hasReason("methodology_unavailable") ||
    (summary.provider_availability === "unavailable") !==
      hasReason("provider_unavailable") ||
    (summary.research_worker_id === undefined) !==
      hasReason("worker_unavailable") ||
    summary.status_basis.basis_kind === "incomplete_persisted_graph" &&
      !hasReason("inactive_incomplete_graph")) {
    return false;
  }
  return summary.allocated_at !== undefined &&
    summary.last_progress_at !== undefined;
}

function researchSessionDetailsShareImmutableProjection(
  inactive: ResearchSessionDetailReadModel,
  active: ResearchSessionDetailReadModel
): boolean {
  const stripRuntimeStatus = (detail: ResearchSessionDetailReadModel) => {
    const {
      status: _status,
      status_basis: _basis,
      projection_health: _health,
      degraded_reasons: _reasons,
      latest_progress_summary: _progress,
      latest_progress_summary_truncated: _progressTruncated,
      ...immutable
    } = detail;
    return immutable;
  };
  return isDeepStrictEqual(stripRuntimeStatus(inactive), stripRuntimeStatus(active));
}

function researchSessionStatusBasisHasProjectionShape(
  basis: ResearchSessionStatusBasisReadModel,
  statusValue: ResearchSessionSummaryReadModel["status"]
): boolean {
  const hasSource = basis?.source_ref !== undefined;
  if (!hasExactKeys(basis, [
    "basis_kind",
    ...(hasSource ? ["source_ref"] : []),
    "authority_status"
  ]) || basis.authority_status !== "read_only") return false;
  const sourceMatches = (recordKind: string, required: boolean): boolean =>
    required === hasSource && (!required || projectionRef(
      basis.source_ref,
      recordKind
    ));
  if (basis.basis_kind === "candidate_admission_decision") {
    return ["admitted", "duplicate", "quarantined"].includes(statusValue) &&
      sourceMatches("candidate_admission_decision", true);
  }
  if (basis.basis_kind === "research_worker_checkpoint") {
    return ["finished_without_submission", "failed_closed"].includes(
      statusValue
    ) && sourceMatches("research_worker_checkpoint", true);
  }
  if (basis.basis_kind === "candidate_arena_tick") {
    return ["finished_without_submission", "failed_closed"].includes(
      statusValue
    ) && sourceMatches("candidate_arena_tick", true);
  }
  if (basis.basis_kind === "runtime_research_work_item") {
    return ["allocating", "running", "failed_closed"].includes(statusValue) &&
      (statusValue === "running"
        ? sourceMatches("research_preflight_commitment", true)
        : !hasSource || projectionRef(
            basis.source_ref,
            "research_preflight_commitment"
          ));
  }
  if (basis.basis_kind === "active_tick_queue") {
    return statusValue === "queued" && sourceMatches(
      "candidate_arena_research_allocation",
      true
    );
  }
  return basis.basis_kind === "incomplete_persisted_graph" &&
    ["recovering", "failed_closed"].includes(statusValue) && !hasSource;
}

function researchSessionBudgetHasProjectionShape(
  budget: ResearchSessionSummaryReadModel["budget"]
): boolean {
  return hasExactKeys(budget, [
    "max_experiment_count",
    "completed_experiment_count",
    "max_development_submission_count",
    "development_submission_count",
    "remaining_development_submission_count",
    "authority_status"
  ]) && positiveSafeInteger(budget.max_experiment_count) &&
    nonNegativeSafeInteger(budget.completed_experiment_count) &&
    budget.completed_experiment_count <= budget.max_experiment_count &&
    positiveSafeInteger(budget.max_development_submission_count) &&
    nonNegativeSafeInteger(budget.development_submission_count) &&
    budget.development_submission_count <=
      budget.max_development_submission_count &&
    nonNegativeSafeInteger(budget.remaining_development_submission_count) &&
    budget.remaining_development_submission_count ===
      budget.max_development_submission_count -
        budget.development_submission_count &&
    budget.authority_status === "research_only";
}

function researchTriggerProjectionHasShape(
  summary: ResearchSessionSummaryReadModel
): boolean {
  if (summary.trigger_availability === "unavailable") return true;
  if (summary.trigger_availability !== "available") return false;
  const trigger = summary.trigger;
  const hasSource = trigger.source_ref !== undefined;
  const hasEvidenceRef = trigger.evidence_artifact_ref !== undefined;
  const hasEvidenceDigest = trigger.evidence_artifact_digest !== undefined;
  const eventRequiresEvidence = trigger.trigger_kind === "arena_event" ||
    trigger.trigger_kind === "live_event";
  return hasEvidenceRef === hasEvidenceDigest &&
    (!hasEvidenceRef || hasSource) &&
    (!eventRequiresEvidence || hasSource && hasEvidenceRef) &&
    hasExactKeys(trigger, [
    "trigger_kind",
    "trigger_id",
    "goal",
    "goal_truncated",
    "triggered_at",
    ...(hasSource ? ["source_ref"] : []),
    ...(hasEvidenceRef
      ? ["evidence_artifact_ref", "evidence_artifact_digest"]
      : []),
    "authority_status"
  ]) && ["goal", "time", "arena_event", "live_event", "recovery"].includes(
    trigger.trigger_kind
  ) && projectionIdentifier(trigger.trigger_id) &&
    projectionSanitizedText(trigger.goal, TEXT_LIMIT) &&
    typeof trigger.goal_truncated === "boolean" &&
    projectionIso(trigger.triggered_at) && projectionIso(summary.allocated_at) &&
    Date.parse(trigger.triggered_at) <= Date.parse(summary.allocated_at) &&
    (!hasSource || projectionRef(
      trigger.source_ref!
    )) && (!hasEvidenceRef || projectionRef(
      trigger.evidence_artifact_ref!,
      "research_evidence_artifact"
    ) && validDigest(trigger.evidence_artifact_digest)) &&
    trigger.authority_status === "research_only";
}

function researchMethodologyProjectionHasShape(
  summary: ResearchSessionSummaryReadModel
): boolean {
  if (summary.methodology_availability === "unavailable") return true;
  if (summary.methodology_availability !== "available") return false;
  const methodology = summary.methodology;
  const hasSourceCandidate = methodology.source_candidate_id !== undefined;
  return hasExactKeys(methodology, [
    "direction_kind",
    "hypothesis",
    "hypothesis_truncated",
    "method",
    "method_truncated",
    ...(hasSourceCandidate ? ["source_candidate_id"] : []),
    "evidence_artifact_ids",
    "authority_status"
  ]) && methodology.direction_kind === summary.direction_kind &&
    projectionSanitizedText(methodology.hypothesis, TEXT_LIMIT) &&
    typeof methodology.hypothesis_truncated === "boolean" &&
    projectionSanitizedText(methodology.method, TEXT_LIMIT) &&
    typeof methodology.method_truncated === "boolean" &&
    (!hasSourceCandidate || projectionIdentifier(
      methodology.source_candidate_id!
    )) && boundedUniqueProjectionIdentifiers(
      methodology.evidence_artifact_ids,
      24
    ) && methodology.authority_status === "research_only";
}

function researchProviderProjectionHasShape(
  summary: ResearchSessionSummaryReadModel
): boolean {
  if (summary.provider_availability === "unavailable") {
    return !("provider" in summary) && !("model" in summary) &&
      !("model_truncated" in summary);
  }
  if (summary.provider_availability !== "available" || ![
    "codex_cli",
    "claude_code",
    "local_process",
    "fixture_only"
  ].includes(summary.provider)) return false;
  const hasModel = summary.model !== undefined;
  const hasModelTruncated = summary.model_truncated !== undefined;
  return hasModel === hasModelTruncated && (!hasModel ||
    projectionSanitizedText(summary.model!, TEXT_LIMIT) &&
    typeof summary.model_truncated === "boolean");
}

function projectionSanitizedText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit &&
    sanitizeResearchEvidenceText(value) === value;
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function researchEvidenceInputHasProjectionShape(
  evidence: ResearchEvidenceArtifactReadModel
): boolean {
  if (!hasExactKeys(evidence, [
    "evidence_artifact_id",
    "source_kind",
    "subject_ref",
    "artifact_ref",
    "artifact_digest",
    "summary",
    "truncated",
    "captured_at",
    "sanitization_status",
    "qualification_evidence_hidden",
    "authority_status"
  ]) || !projectionIdentifier(evidence.evidence_artifact_id) || ![
    "arena_paper_result",
    "arena_trace",
    "arena_failure",
    "research_finding"
  ].includes(evidence.source_kind) || !projectionRef(evidence.subject_ref) ||
    !projectionRef(evidence.artifact_ref) || !validDigest(
      evidence.artifact_digest
    ) || !projectionSanitizedText(evidence.summary, TEXT_LIMIT) ||
    typeof evidence.truncated !== "boolean" ||
    !projectionIso(evidence.captured_at) ||
    evidence.sanitization_status !== "sanitized" ||
    evidence.qualification_evidence_hidden !== true ||
    evidence.authority_status !== "research_only" ||
    !researchEvidenceRolesMatchSource(evidence)) {
    return false;
  }
  return true;
}

function researchEvidenceRolesMatchSource(evidence: {
  source_kind: ResearchEvidenceArtifactReadModel["source_kind"];
  subject_ref: Ref;
  artifact_ref: Ref;
}): boolean {
  if (evidence.source_kind === "arena_paper_result" ||
    evidence.source_kind === "arena_failure") {
    return evidence.subject_ref.record_kind === "trading_system_candidate" &&
      evidence.artifact_ref.record_kind === "paper_trading_evaluation";
  }
  if (evidence.source_kind === "arena_trace") {
    return evidence.subject_ref.record_kind === "trading_system_candidate" &&
      evidence.artifact_ref.record_kind === "paper_trading_observation";
  }
  return evidence.source_kind === "research_finding" &&
    evidence.subject_ref.record_kind === "research_worker" &&
    evidence.artifact_ref.record_kind === "research_finding";
}

function researchDevelopmentSubmissionHasProjectionShape(
  submission: ResearchDevelopmentSubmissionReadModel
): boolean {
  const selected = submission.selected === true;
  if (!hasExactKeys(submission, [
    "submission_sequence",
    "decision",
    "agent_status",
    "evaluation_status",
    "risk_decision",
    "net_revenue_usdt",
    "summary",
    "summary_truncated",
    "selected",
    "artifact_availability",
    ...(selected
      ? ["selected_system_code_ref", "selected_system_code_artifact_digest"]
      : []),
    "authority_status"
  ]) || !positiveSafeInteger(submission.submission_sequence) ||
    !["keep", "discard", "crash"].includes(submission.decision) ||
    !["edited", "no_change", "failed"].includes(submission.agent_status) ||
    !["accepted", "disqualified"].includes(submission.evaluation_status) ||
    ![
      "valid_order_request",
      "invalid_order_request",
      "no_order_request"
    ].includes(submission.risk_decision) ||
    !Number.isFinite(submission.net_revenue_usdt) ||
    !projectionSanitizedText(submission.summary, TEXT_LIMIT) ||
    typeof submission.summary_truncated !== "boolean" ||
    submission.authority_status !== "research_only") return false;
  return selected
    ? submission.artifact_availability === "selected_system_code_available" &&
      projectionRef(submission.selected_system_code_ref, "system_code") &&
      validDigest(submission.selected_system_code_artifact_digest)
    : submission.selected === false &&
      submission.artifact_availability === "not_persisted";
}

function researchLifecycleEventHasProjectionShape(
  event: ResearchLifecycleEventReadModel,
  expectedSequence: number
): boolean {
  const sourceKindByEvent: Record<
    ResearchLifecycleEventReadModel["event_kind"],
    string
  > = {
    allocation: "candidate_arena_research_allocation",
    commitment: "research_preflight_commitment",
    evaluation: "trading_evaluation_result",
    checkpoint: "research_worker_checkpoint",
    tick: "candidate_arena_tick",
    admission: "candidate_admission_decision",
    handoff_conformance: "paper_trading_handoff_conformance"
  };
  return hasExactKeys(event, [
    "sequence",
    "occurred_at",
    "event_kind",
    "summary",
    "summary_truncated",
    "source_ref",
    "sanitized",
    "authority_status"
  ]) && event.sequence === expectedSequence &&
    Object.hasOwn(sourceKindByEvent, event.event_kind) &&
    projectionIso(event.occurred_at) &&
    projectionSanitizedText(event.summary, TEXT_LIMIT) &&
    typeof event.summary_truncated === "boolean" &&
    projectionRef(event.source_ref, sourceKindByEvent[event.event_kind]) &&
    event.sanitized === true && event.authority_status === "read_only";
}

function researchSubmissionHistoryHasProjectionShape(
  detail: ResearchSessionDetailReadModel
): boolean {
  if (detail.submission_history_availability ===
      "unavailable_until_checkpoint") {
    return detail.development_submissions.length === 0 &&
      detail.budget.development_submission_count === 0;
  }
  return detail.submission_history_availability === "checkpoint_summary" &&
    nonNegativeSafeInteger(detail.recorded_submission_count) &&
    nonNegativeSafeInteger(detail.projected_submission_count) &&
    nonNegativeSafeInteger(detail.omitted_submission_count) &&
    detail.projected_submission_count ===
      detail.development_submissions.length &&
    detail.recorded_submission_count ===
      detail.budget.development_submission_count &&
    detail.recorded_submission_count >= detail.projected_submission_count &&
    detail.omitted_submission_count === detail.recorded_submission_count -
      detail.projected_submission_count &&
    detail.submission_history_truncated ===
      (detail.omitted_submission_count > 0);
}

function researchSelectedArtifactHasProjectionShape(
  detail: ResearchSessionDetailReadModel
): boolean {
  if (detail.selected_submission_sequence !== undefined && (
    detail.selected_submission_sequence >
      detail.budget.max_development_submission_count ||
    detail.submission_history_availability === "checkpoint_summary" &&
      detail.selected_submission_sequence > detail.recorded_submission_count
  ) || detail.submission_history_availability === "checkpoint_summary" &&
    detail.development_submissions.some((submission) =>
      submission.submission_sequence > detail.recorded_submission_count
    )) {
    return false;
  }
  const selectedSubmissions = detail.development_submissions.filter(
    (submission) => submission.selected
  );
  if (selectedSubmissions.length > 1) return false;
  if (detail.selected_artifact_availability === "available") {
    if (!positiveSafeInteger(detail.selected_submission_sequence) ||
      !projectionRef(detail.selected_system_code_ref, "system_code") ||
      !validDigest(detail.selected_system_code_artifact_digest)) return false;
    const selected = selectedSubmissions[0];
    return !selected || selected.submission_sequence ===
      detail.selected_submission_sequence &&
      selected.selected_system_code_ref.id === detail.selected_system_code_ref.id &&
      selected.selected_system_code_artifact_digest ===
        detail.selected_system_code_artifact_digest;
  }
  if (selectedSubmissions.length !== 0) return false;
  if (detail.selected_artifact_availability === "not_selected") {
    return detail.selected_submission_sequence === undefined;
  }
  return detail.selected_artifact_availability === "unavailable" &&
    (detail.selected_submission_sequence === undefined ||
      positiveSafeInteger(detail.selected_submission_sequence));
}

function researchSessionAuthorityBindingsHaveProjectionShape(
  detail: ResearchSessionDetailReadModel
): boolean {
  const graph = detail.terminal_graph;
  const events = new Map(detail.lifecycle_events.map((event) => [
    event.event_kind,
    event
  ]));
  const allocationEvent = events.get("allocation");
  const latestTerminalEventAt = ["tick", "checkpoint", "admission"]
    .map((eventKind) => events.get(
      eventKind as ResearchLifecycleEventReadModel["event_kind"]
    )?.occurred_at)
    .filter((timestamp): timestamp is string => timestamp !== undefined)
    .sort()
    .at(-1);
  const expectedCompletedAt = [
    "queued",
    "allocating",
    "running",
    "recovering"
  ].includes(detail.status) ? undefined : latestTerminalEventAt;
  if (detail.lifecycle_events[0]?.event_kind !== "allocation" ||
    allocationEvent?.occurred_at !== detail.allocated_at ||
    detail.started_at !== undefined &&
      Date.parse(detail.started_at) < Date.parse(detail.allocated_at!) ||
    detail.completed_at !== expectedCompletedAt) {
    return false;
  }
  const exactEvent = (
    eventKind: ResearchLifecycleEventReadModel["event_kind"],
    expectedId: string,
    expectedAt?: string
  ): boolean => {
    const event = events.get(eventKind);
    return event?.source_ref.id === expectedId &&
      (expectedAt === undefined || event.occurred_at === expectedAt);
  };
  const evaluation = graph.selected_sealed_evaluation;
  const admission = graph.admission;
  const conformance = graph.paper_handoff_conformance;
  if ((evaluation === undefined) !== !events.has("evaluation") || evaluation &&
      !exactEvent(
        "evaluation",
        evaluation.trading_evaluation_result_ref.id,
        evaluation.completed_at
      ) || (admission === undefined) !== !events.has("admission") || admission &&
      !exactEvent(
        "admission",
        admission.candidate_admission_decision_ref.id,
        admission.decided_at
      ) || (conformance === undefined) !== !events.has("handoff_conformance") ||
    conformance && !exactEvent(
      "handoff_conformance",
      conformance.paper_trading_handoff_conformance_ref.id,
      conformance.completed_at
    )) {
    return false;
  }
  const basis = detail.status_basis;
  if (basis.basis_kind === "candidate_admission_decision") {
    if (!admission || detail.status !== admission.status ||
      basis.source_ref?.id !== admission.candidate_admission_decision_ref.id ||
      !exactEvent("admission", basis.source_ref.id)) return false;
  } else if (basis.basis_kind === "research_worker_checkpoint") {
    if (!basis.source_ref || !exactEvent(
      "checkpoint",
      basis.source_ref.id
    )) return false;
  } else if (basis.basis_kind === "candidate_arena_tick") {
    if (!basis.source_ref || !exactEvent(
      "tick",
      basis.source_ref.id
    )) return false;
  } else if (basis.basis_kind === "active_tick_queue") {
    if (basis.source_ref?.id !== detail.research_allocation_id ||
      !exactEvent("allocation", detail.research_allocation_id)) return false;
  } else if (basis.basis_kind === "runtime_research_work_item") {
    if (detail.status === "running") {
      if (!detail.commitment_id || basis.source_ref?.id !== detail.commitment_id ||
        !exactEvent("commitment", detail.commitment_id)) return false;
    } else if (basis.source_ref !== undefined) {
      return false;
    }
  }
  if (detail.trigger_availability === "available" &&
    detail.trigger.evidence_artifact_ref) {
    const evidence = detail.evidence_inputs.filter((entry) =>
      entry.evidence_artifact_id === detail.trigger.evidence_artifact_ref!.id
    );
    if (evidence.length !== 1 || evidence[0]!.artifact_digest !==
        detail.trigger.evidence_artifact_digest ||
      Date.parse(evidence[0]!.captured_at) >
        Date.parse(detail.trigger.triggered_at) ||
      detail.trigger.source_ref !== undefined && !exactSameRef(
        evidence[0]!.artifact_ref,
        detail.trigger.source_ref
      )) return false;
  }
  const handoff = graph.admitted_arena_handoff;
  return handoff === undefined ||
    detail.selected_artifact_availability === "available" &&
    graph.finding !== undefined &&
    exactEvent(
      "tick",
      handoff.candidate_arena_tick_ref.id,
      handoff.completed_at
    );
}

function researchTerminalGraphHasProjectionShape(
  graph: ResearchSessionTerminalGraphReadModel
): boolean {
  const hasEvaluation = graph?.selected_sealed_evaluation !== undefined;
  const hasAdmission = graph?.admission !== undefined;
  const hasConformance = graph?.paper_handoff_conformance !== undefined;
  const hasFinding = graph?.finding !== undefined;
  const hasLineage = graph?.artifact_lineage !== undefined;
  const hasHandoff = graph?.admitted_arena_handoff !== undefined;
  if (!hasExactKeys(graph, [
    ...(hasEvaluation ? ["selected_sealed_evaluation"] : []),
    ...(hasAdmission ? ["admission"] : []),
    ...(hasConformance ? ["paper_handoff_conformance"] : []),
    ...(hasFinding ? ["finding"] : []),
    ...(hasLineage ? ["artifact_lineage"] : []),
    ...(hasHandoff ? ["admitted_arena_handoff"] : []),
    "authority_status"
  ]) || graph.authority_status !== "read_only" ||
    (hasEvaluation && !researchSelectedEvaluationHasProjectionShape(
      graph.selected_sealed_evaluation!
    )) || (hasAdmission && !researchAdmissionHasProjectionShape(
      graph.admission!
    )) || (hasConformance && !researchConformanceHasProjectionShape(
      graph.paper_handoff_conformance!
    )) || (hasFinding && !researchFindingReadModelHasProjectionShape(
      graph.finding!
    )) || (hasLineage && !researchLineageReadModelHasProjectionShape(
      graph.artifact_lineage!
    )) || (hasHandoff && !researchAdmittedHandoffHasProjectionShape(
      graph.admitted_arena_handoff!
    ))) return false;
  if (hasLineage) {
    if (!hasFinding || !graph.artifact_lineage!.source_finding_refs.some(
      (reference) => reference.id === graph.finding!.research_finding_ref.id
    )) return false;
  }
  if (!hasHandoff) return true;
  return hasEvaluation && hasAdmission && hasConformance && hasFinding &&
    graph.selected_sealed_evaluation!.result_status === "accepted" &&
    graph.selected_sealed_evaluation!.evidence_disposition === "not_counted" &&
    graph.admission!.status === "admitted" &&
    graph.admission!.reason === "evaluation_accepted" &&
    graph.paper_handoff_conformance!.status === "passed" &&
    graph.paper_handoff_conformance!.reason === "passed" &&
    graph.admitted_arena_handoff!.candidate_admission_decision_ref.id ===
      graph.admission!.candidate_admission_decision_ref.id;
}

function researchSelectedEvaluationHasProjectionShape(
  evaluation: NonNullable<
    ResearchSessionTerminalGraphReadModel["selected_sealed_evaluation"]
  >
): boolean {
  return hasExactKeys(evaluation, [
    "trading_evaluation_result_ref",
    "experiment_run_ref",
    "evaluation_phase",
    "result_status",
    "evidence_disposition",
    "completed_at",
    "authority_status"
  ]) && projectionRef(
    evaluation.trading_evaluation_result_ref,
    "trading_evaluation_result"
  ) && projectionRef(evaluation.experiment_run_ref, "experiment_run") &&
    evaluation.evaluation_phase === "sealed_admission" && [
      "accepted",
      "quarantined_for_review",
      "disqualified"
    ].includes(evaluation.result_status) && [
      "not_counted",
      "counted",
      "quarantined_for_review"
    ].includes(evaluation.evidence_disposition) &&
    projectionIso(evaluation.completed_at) &&
    evaluation.authority_status === "read_only";
}

function researchAdmissionHasProjectionShape(
  admission: NonNullable<ResearchSessionTerminalGraphReadModel["admission"]>
): boolean {
  if (!hasExactKeys(admission, [
    "candidate_admission_decision_ref",
    "status",
    "reason",
    "decided_at",
    "authority_status"
  ]) || !projectionRef(
    admission.candidate_admission_decision_ref,
    "candidate_admission_decision"
  ) || !projectionIso(admission.decided_at) ||
    admission.authority_status !== "read_only") return false;
  if (admission.status === "admitted") {
    return admission.reason === "evaluation_accepted";
  }
  if (admission.status === "duplicate") {
    return ["no_candidate_change", "behavior_duplicate"].includes(
      admission.reason
    );
  }
  return admission.status === "quarantined" && [
    "research_worker_failed",
    "experiment_failed",
    "evaluation_disqualified",
    "evaluation_quarantined",
    "evidence_already_counted",
    "evidence_quarantined",
    "paper_handoff_conformance_failed",
    "behavior_fingerprint_unavailable"
  ].includes(admission.reason);
}

function researchConformanceHasProjectionShape(
  conformance: NonNullable<
    ResearchSessionTerminalGraphReadModel["paper_handoff_conformance"]
  >
): boolean {
  return hasExactKeys(conformance, [
    "paper_trading_handoff_conformance_ref",
    "status",
    "reason",
    "completed_at",
    "evidence_digest",
    "authority_status"
  ]) && projectionRef(
    conformance.paper_trading_handoff_conformance_ref,
    "paper_trading_handoff_conformance"
  ) && (conformance.status === "passed") === (conformance.reason === "passed") &&
    candidateArenaPaperHandoffReason(conformance.reason) &&
    projectionIso(conformance.completed_at) &&
    validDigest(conformance.evidence_digest) &&
    conformance.authority_status === "read_only";
}

function researchFindingReadModelHasProjectionShape(
  finding: NonNullable<ResearchSessionTerminalGraphReadModel["finding"]>
): boolean {
  return hasExactKeys(finding, [
    "research_finding_ref",
    "finding_kind",
    "summary",
    "summary_truncated",
    "supporting_record_refs",
    "created_at",
    "sanitized",
    "authority_status"
  ]) && projectionRef(finding.research_finding_ref, "research_finding") && [
    "positive_result",
    "negative_result",
    "failure_analysis",
    "anti_hacking_case",
    "duplicate_result",
    "next_artifact_hint"
  ].includes(finding.finding_kind) &&
    projectionSanitizedText(finding.summary, TEXT_LIMIT) &&
    typeof finding.summary_truncated === "boolean" &&
    Array.isArray(finding.supporting_record_refs) &&
    finding.supporting_record_refs.length <= HISTORY_LIMIT &&
    finding.supporting_record_refs.every((reference) => projectionRef(reference)) &&
    refsAreUnique(finding.supporting_record_refs) &&
    projectionIso(finding.created_at) && finding.sanitized === true &&
    finding.authority_status === "read_only";
}

function researchLineageReadModelHasProjectionShape(
  lineage: NonNullable<
    ResearchSessionTerminalGraphReadModel["artifact_lineage"]
  >
): boolean {
  const hasParent = lineage.parent_system_code_ref !== undefined;
  const hasWorker = lineage.created_by_research_worker_ref !== undefined;
  return hasExactKeys(lineage, [
    "artifact_lineage_ref",
    "child_system_code_ref",
    ...(hasParent ? ["parent_system_code_ref"] : []),
    "source_finding_refs",
    ...(hasWorker ? ["created_by_research_worker_ref"] : []),
    "created_at",
    "authority_status"
  ]) && projectionRef(lineage.artifact_lineage_ref, "artifact_lineage") &&
    projectionRef(lineage.child_system_code_ref, "system_code") &&
    (!hasParent || projectionRef(lineage.parent_system_code_ref!, "system_code")) &&
    Array.isArray(lineage.source_finding_refs) &&
    lineage.source_finding_refs.length > 0 &&
    lineage.source_finding_refs.length <= HISTORY_LIMIT &&
    lineage.source_finding_refs.every((reference) => projectionRef(
      reference,
      "research_finding"
    )) && refsAreUnique(lineage.source_finding_refs) &&
    (!hasWorker || projectionRef(
      lineage.created_by_research_worker_ref!,
      "research_worker"
    )) && projectionIso(lineage.created_at) &&
    lineage.authority_status === "read_only";
}

function researchAdmittedHandoffHasProjectionShape(
  handoff: NonNullable<
    ResearchSessionTerminalGraphReadModel["admitted_arena_handoff"]
  >
): boolean {
  return hasExactKeys(handoff, [
    "candidate_arena_tick_ref",
    "candidate_ref",
    "direction_kind",
    "candidate_admission_decision_ref",
    "completed_at",
    "authority_status"
  ]) && projectionRef(handoff.candidate_arena_tick_ref, "candidate_arena_tick") &&
    projectionRef(handoff.candidate_ref, "trading_system_candidate") &&
    researchDirectionKind(handoff.direction_kind) && projectionRef(
      handoff.candidate_admission_decision_ref,
      "candidate_admission_decision"
    ) && projectionIso(handoff.completed_at) &&
    handoff.authority_status === "read_only";
}

export function researchOperationsProjectionIndexHasIntegrity(
  index: ResearchOperationsProjectionIndexRecord
): boolean {
  if (!hasExactKeys(index, [
    "record_kind",
    "version",
    "head_session_refs",
    "open_tick_session_refs",
    "open_tick_session_count",
    "projected_open_tick_session_count",
    "omitted_open_tick_session_count",
    "open_tick_sessions_truncated",
    "capsule_trie_root_refs",
    "recorded_session_count",
    "graph_conflict_count",
    "incomplete_without_conflict_count",
    "capsule_set_digest",
    "session_membership",
    "candidate_arena_evidence",
    "projection_digest",
    "authority_status"
  ]) || index.record_kind !== "research_operations_projection_index" ||
    index.version !== 1 || index.authority_status !== "read_only" ||
    !Array.isArray(index.head_session_refs) ||
    index.head_session_refs.length > RESEARCH_OPERATIONS_SESSION_LIMIT ||
    !Array.isArray(index.open_tick_session_refs) ||
    index.open_tick_session_refs.length > RESEARCH_OPERATIONS_OPEN_SESSION_LIMIT ||
    !Number.isSafeInteger(index.open_tick_session_count) ||
    index.open_tick_session_count < 0 ||
    index.open_tick_session_count > index.recorded_session_count ||
    !Number.isSafeInteger(index.projected_open_tick_session_count) ||
    index.projected_open_tick_session_count < 0 ||
    index.projected_open_tick_session_count >
      RESEARCH_OPERATIONS_OPEN_SESSION_LIMIT ||
    !Number.isSafeInteger(index.omitted_open_tick_session_count) ||
    index.omitted_open_tick_session_count < 0 ||
    index.projected_open_tick_session_count +
      index.omitted_open_tick_session_count !== index.open_tick_session_count ||
    index.open_tick_sessions_truncated !==
      (index.omitted_open_tick_session_count > 0) ||
    !Array.isArray(index.capsule_trie_root_refs) ||
    index.capsule_trie_root_refs.length > 256 ||
    !Number.isSafeInteger(index.recorded_session_count) ||
    index.recorded_session_count < 0 ||
    index.head_session_refs.length !== Math.min(
      index.recorded_session_count,
      RESEARCH_OPERATIONS_SESSION_LIMIT
    ) ||
    !Number.isSafeInteger(index.graph_conflict_count) ||
    index.graph_conflict_count < 0 ||
    !Number.isSafeInteger(index.incomplete_without_conflict_count) ||
    index.incomplete_without_conflict_count < 0 ||
    index.graph_conflict_count + index.incomplete_without_conflict_count >
      index.recorded_session_count ||
    !validDigest(index.capsule_set_digest) ||
    !sessionMembershipHasIntegrity(
      index.session_membership,
      index.recorded_session_count
    ) || !candidateArenaEvidenceHasProjectionShape(
      index.candidate_arena_evidence
    ) ||
    persistedProjectionBytes(index) >
      RESEARCH_OPERATIONS_INDEX_MAX_BYTES ||
    typeof index.projection_digest !== "string") {
    return false;
  }
  const seen = new Set<string>();
  for (const reference of index.head_session_refs) {
    if (!hasExactKeys(reference, [
      "research_work_item_id",
      "allocated_at",
      "capsule_digest"
    ]) || !projectionIdentifier(reference.research_work_item_id) ||
      !safeIsoTimestamp(reference.allocated_at) ||
      !validDigest(reference.capsule_digest) ||
      seen.has(reference.research_work_item_id)) {
      return false;
    }
    seen.add(reference.research_work_item_id);
  }
  const openTickIds = new Set<string>();
  const openWorkItemIds = new Set<string>();
  let projectedOpenTickSessionCount = 0;
  for (const reference of index.open_tick_session_refs) {
    if (!hasExactKeys(reference, [
      "tick_id",
      "research_work_item_ids"
    ]) || !projectionIdentifier(reference.tick_id) ||
      !Array.isArray(reference.research_work_item_ids) ||
      reference.research_work_item_ids.length === 0 ||
      openTickIds.has(reference.tick_id)) {
      return false;
    }
    openTickIds.add(reference.tick_id);
    for (const workItemId of reference.research_work_item_ids) {
      if (!projectionIdentifier(workItemId) ||
        openWorkItemIds.has(workItemId)) {
        return false;
      }
      openWorkItemIds.add(workItemId);
      projectedOpenTickSessionCount += 1;
    }
  }
  if (projectedOpenTickSessionCount !==
    index.projected_open_tick_session_count) {
    return false;
  }
  let previousRootPrefix = "";
  let rootedSessionCount = 0;
  for (const reference of index.capsule_trie_root_refs) {
    if (!hasExactKeys(reference, [
      "prefix",
      "subtree_entry_count",
      "node_digest"
    ]) ||
      !/^[0-9a-f]{2}$/.test(reference.prefix) ||
      reference.prefix <= previousRootPrefix ||
      !positiveSafeInteger(reference.subtree_entry_count) ||
      !validDigest(reference.node_digest)) {
      return false;
    }
    rootedSessionCount += reference.subtree_entry_count;
    previousRootPrefix = reference.prefix;
  }
  if (rootedSessionCount !== index.recorded_session_count ||
    index.capsule_set_digest !== researchOperationsProjectionCapsuleTrieDigest(
      index.capsule_trie_root_refs
    )) return false;
  const { projection_digest: _digest, ...input } = index;
  return index.projection_digest === projectionDigest(input);
}

function assertResearchOperationsProjectionWindow(
  window: ResearchOperationsProjectionWindow
): void {
  if (!window || !researchOperationsProjectionIndexHasIntegrity(window.index) ||
    !Array.isArray(window.capsules) ||
    window.capsules.some((capsule) =>
      !researchOperationsProjectionCapsuleHasIntegrity(capsule)
    ) || new Set(window.capsules.map((capsule) =>
      capsule.research_work_item_id
    )).size !== window.capsules.length) {
    throw new Error("research_operations_projection_window_invalid");
  }
}

function materializedDetail(
  capsule: ResearchOperationsProjectionCapsule,
  health: CandidateArenaRunnerHealthReadModel
): ResearchSessionDetailReadModel {
  if (capsule.runtime_identity.tick_id !== health.active_tick_id) {
    return capsule.inactive_detail;
  }
  const base = capsule.active_queued_detail;
  if (capsule.terminal_evidence_present || capsule.graph_conflict ||
    !["queued", "allocating", "running"].includes(base.status)) {
    return base;
  }
  const runtimeCandidates = health.active_research_work_items.filter((candidate) =>
    candidate.research_work_item_id === capsule.research_work_item_id &&
    candidate.research_allocation_id ===
      capsule.runtime_identity.research_allocation_id &&
    candidate.direction_kind === capsule.runtime_identity.direction_kind
  );
  if (runtimeCandidates.length !== 1) return base;
  const runtime = runtimeCandidates[0]!;
  if (runtime.phase === "failed_closed_pending_tick") {
    return {
      ...base,
      status: "failed_closed",
      status_basis: {
        basis_kind: "runtime_research_work_item",
        authority_status: "read_only"
      },
      latest_progress_summary: "Research failed closed.",
      latest_progress_summary_truncated: false
    };
  }
  const running = runtime.phase === "running" &&
    capsule.runtime_identity.commitment_id !== undefined &&
    runtime.commitment_id === capsule.runtime_identity.commitment_id;
  return {
    ...base,
    status: running ? "running" : "allocating",
    status_basis: {
      basis_kind: "runtime_research_work_item",
      ...(running
        ? {
            source_ref: {
              record_kind: "research_preflight_commitment",
              id: capsule.runtime_identity.commitment_id!
            }
          }
        : {}),
      authority_status: "read_only"
    },
    latest_progress_summary: running
      ? "Research work is running."
      : "Research work is allocating.",
    latest_progress_summary_truncated: false
  };
}

function materializedSessionCapacity(
  capsules: ResearchOperationsProjectionCapsule[],
  health: CandidateArenaRunnerHealthReadModel
): { activeCount: number; queuedCount: number; hasActiveRuntimeFailure: boolean } {
  let activeCount = 0;
  let queuedCount = 0;
  let hasActiveRuntimeFailure = false;
  for (const capsule of capsules) {
    if (capsule.terminal_evidence_present) continue;
    const runtimes = health.active_research_work_items.filter((candidate) =>
      candidate.research_work_item_id === capsule.research_work_item_id &&
      candidate.research_allocation_id ===
        capsule.runtime_identity.research_allocation_id &&
      candidate.direction_kind === capsule.runtime_identity.direction_kind
    );
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

function summaryFromDetail(
  detail: ResearchSessionDetailReadModel
): ResearchSessionSummaryWireReadModel {
  const summary: ResearchSessionSummaryReadModel = {
    identity_kind: detail.identity_kind,
    research_work_item_id: detail.research_work_item_id,
    research_allocation_id: detail.research_allocation_id,
    tick_id: detail.tick_id,
    direction_kind: detail.direction_kind,
    ...(detail.research_worker_id !== undefined
      ? { research_worker_id: detail.research_worker_id }
      : {}),
    ...(detail.commitment_id !== undefined
      ? { commitment_id: detail.commitment_id }
      : {}),
    status: detail.status,
    status_basis: detail.status_basis,
    projection_health: detail.projection_health,
    degraded_reasons: detail.degraded_reasons,
    budget: detail.budget,
    ...(detail.allocated_at !== undefined
      ? { allocated_at: detail.allocated_at }
      : {}),
    ...(detail.started_at !== undefined ? { started_at: detail.started_at } : {}),
    ...(detail.last_progress_at !== undefined
      ? { last_progress_at: detail.last_progress_at }
      : {}),
    ...(detail.completed_at !== undefined
      ? { completed_at: detail.completed_at }
      : {}),
    ...(detail.selected_submission_sequence !== undefined
      ? { selected_submission_sequence: detail.selected_submission_sequence }
      : {}),
    ...(detail.admitted_candidate_id !== undefined
      ? { admitted_candidate_id: detail.admitted_candidate_id }
      : {}),
    latest_progress_summary: detail.latest_progress_summary,
    latest_progress_summary_truncated:
      detail.latest_progress_summary_truncated,
    ...(detail.trigger_availability === "available"
      ? {
          trigger_availability: "available" as const,
          trigger: detail.trigger
        }
      : { trigger_availability: "unavailable" as const }),
    ...(detail.methodology_availability === "available"
      ? {
          methodology_availability: "available" as const,
          methodology: detail.methodology
        }
      : { methodology_availability: "unavailable" as const }),
    ...(detail.provider_availability === "available"
      ? {
          provider_availability: "available" as const,
          provider: detail.provider,
          ...(detail.model !== undefined
            ? {
                model: detail.model,
                model_truncated: detail.model_truncated!
              }
            : {})
        }
      : { provider_availability: "unavailable" as const }),
    authority_status: "research_only"
  };
  return summaryForWire(summary);
}

function summaryForWire(
  summary: ResearchSessionSummaryReadModel
): ResearchSessionSummaryWireReadModel {
  const {
    trigger: _trigger,
    methodology: _methodology,
    provider: _provider,
    model: _model,
    model_truncated: _modelTruncated,
    ...base
  } = summary;
  return {
    ...base,
    ...(summary.trigger_availability === "available"
      ? { trigger_availability: "available" as const, trigger: summary.trigger }
      : {
          trigger_availability: "unavailable" as const,
          trigger: {
            compatibility_kind: "research_summary_v1_unavailable" as const,
            trigger_kind: "unavailable" as const,
            trigger_id: "unavailable" as const,
            goal: "Research trigger unavailable." as const,
            goal_truncated: false as const,
            triggered_at: "" as const,
            authority_status: "research_only" as const
          }
        }),
    ...(summary.methodology_availability === "available"
      ? {
          methodology_availability: "available" as const,
          methodology: summary.methodology
        }
      : {
          methodology_availability: "unavailable" as const,
          methodology: {
            compatibility_kind: "research_summary_v1_unavailable" as const,
            direction_kind: summary.direction_kind,
            hypothesis: "Research methodology unavailable." as const,
            hypothesis_truncated: false as const,
            method: "Research methodology unavailable." as const,
            method_truncated: false as const,
            evidence_artifact_ids: [],
            authority_status: "research_only" as const
          }
        }),
    ...(summary.provider_availability === "available"
      ? {
          provider_availability: "available" as const,
          provider: summary.provider,
          ...(summary.model !== undefined
            ? {
                model: summary.model,
                model_truncated: summary.model_truncated!
              }
            : {})
        }
      : {
          provider_availability: "unavailable" as const,
          provider: "unavailable" as const
        })
  };
}

function materializationHealth(
  activeTickId?: string
): CandidateArenaRunnerHealthReadModel {
  return {
    status: activeTickId ? "running" : "stopped",
    tick_count: 0,
    completed_tick_count: 0,
    active_tick: activeTickId !== undefined,
    ...(activeTickId ? { active_tick_id: activeTickId } : {}),
    active_research_work_items: [],
    consecutive_failure_count: 0,
    runtime_coordination_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
  };
}

function createSessionMembership(ids: string[]):
  ResearchOperationsProjectionIndexRecord["session_membership"] {
  const bits = Buffer.alloc(SESSION_MEMBERSHIP_BIT_COUNT / 8);
  for (const id of ids) {
    for (const position of sessionMembershipPositions(id)) {
      bits[position >> 3] |= 1 << (position & 7);
    }
  }
  return {
    algorithm: "sha256_bloom_v1",
    bit_count: SESSION_MEMBERSHIP_BIT_COUNT,
    hash_count: SESSION_MEMBERSHIP_HASH_COUNT,
    encoded_bits: bits.toString("base64"),
    member_count: ids.length
  };
}

export function researchOperationsProjectionMayContainSession(
  index: ResearchOperationsProjectionIndexRecord,
  researchWorkItemId: string
): boolean {
  if (!researchOperationsProjectionIndexHasIntegrity(index)) return true;
  const bits = Buffer.from(index.session_membership.encoded_bits, "base64");
  return sessionMembershipPositions(researchWorkItemId).every((position) =>
    (bits[position >> 3]! & (1 << (position & 7))) !== 0
  );
}

function sessionMembershipPositions(id: string): number[] {
  const hash = createHash("sha256").update(id).digest();
  return Array.from({ length: SESSION_MEMBERSHIP_HASH_COUNT }, (_, index) =>
    hash.readUInt32BE(index * 4) % SESSION_MEMBERSHIP_BIT_COUNT
  );
}

function sessionMembershipHasIntegrity(
  membership: ResearchOperationsProjectionIndexRecord["session_membership"],
  recordedSessionCount: number
): boolean {
  if (!hasExactKeys(membership, [
    "algorithm",
    "bit_count",
    "hash_count",
    "encoded_bits",
    "member_count"
  ]) || membership.algorithm !== "sha256_bloom_v1" ||
    membership.bit_count !== SESSION_MEMBERSHIP_BIT_COUNT ||
    membership.hash_count !== SESSION_MEMBERSHIP_HASH_COUNT ||
    membership.member_count !== recordedSessionCount ||
    typeof membership.encoded_bits !== "string") {
    return false;
  }
  const bits = Buffer.from(membership.encoded_bits, "base64");
  return bits.length === SESSION_MEMBERSHIP_BIT_COUNT / 8 &&
    bits.toString("base64") === membership.encoded_bits;
}

function materializeCandidateArenaEvidence(
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): ResearchOperationsProjectionIndexRecord["candidate_arena_evidence"] {
  try {
    const allocationTickIds = new Set<string>();
    for (const allocation of graph.allocations) {
      if (!allocationHasUniqueRawOrigin(allocation, index) ||
        !allocationMatchesPolicyProvenance(allocation, index) ||
        allocationTickIds.has(allocation.tick_id)) {
        throw new Error("candidate_arena_projection_allocation_graph_invalid");
      }
      allocationTickIds.add(allocation.tick_id);
    }
    const tickIds = new Set<string>();
    const canonicalBoundTicks = new Set<CandidateArenaTickRecord>();
    for (const tick of graph.ticks) {
      if (!candidateArenaTickHasRuntimeShape(tick) ||
        !tickHasUniqueRawIdentity(tick, index) || tickIds.has(tick.tick_id)) {
        throw new Error("candidate_arena_projection_tick_graph_invalid");
      }
      tickIds.add(tick.tick_id);
      const hasAllocationRef = tick.research_allocation_ref !== undefined;
      const hasAllocationDigest = tick.research_allocation_digest !== undefined;
      if (hasAllocationRef !== hasAllocationDigest) {
        throw new Error("candidate_arena_projection_tick_graph_invalid");
      }
      if (!hasAllocationRef) {
        continue;
      }
      const allocationMatches = index.allocationsById.get(
        tick.research_allocation_ref!.id
      ) ?? [];
      const allocation = allocationMatches.length === 1
        ? allocationMatches[0]
        : undefined;
      if (!allocation || !tickMatchesAllocation(tick, allocation) ||
        (index.ticksByAllocationKey.get(tickAllocationKey(
          tick.tick_id,
          allocation.candidate_arena_research_allocation_id
        ))?.length ?? 0) !== 1) {
        throw new Error("candidate_arena_projection_tick_graph_invalid");
      }
      canonicalBoundTicks.add(tick);
    }
    const ticks = [...graph.ticks]
      .sort((left, right) =>
        right.completed_at.localeCompare(left.completed_at) ||
        right.tick_id.localeCompare(left.tick_id)
      )
      .slice(0, 10);
    if (ticks.some((tick) =>
      canonicalBoundTicks.has(tick) &&
      !boundAuthorityResultsHaveCanonicalGraph(tick, graph, index)
    )) {
      throw new Error("candidate_arena_projection_created_graph_invalid");
    }
    const latestTicks = ticks.map((tick) =>
      projectCandidateArenaTickReadModel(
        tick,
        tick.research_allocation_ref
          ? index.allocationsById.get(tick.research_allocation_ref.id)?.[0]
          : undefined
      )
    );
    return {
      availability: "available",
      latest_ticks: latestTicks,
      terminal_tick_ids: ticks
        .filter((tick) => canonicalBoundTicks.has(tick))
        .map((tick) => tick.tick_id),
      research_population_diversity: buildResearchPopulationDiversity({
        ticks: graph.ticks,
        directions: graph.directions,
        commitments: graph.commitments,
        fingerprints: graph.fingerprints,
        admissions: graph.admissions
      }),
      research_generalization: buildResearchGeneralizationReadModel({
        protocols: graph.generalizationProtocols,
        studies: graph.controlStudies,
        studyOutcomes: graph.controlStudyOutcomes,
        outcomes: graph.generalizationOutcomes,
        decisions: graph.generalizationPolicyDecisions,
        allocations: graph.allocations,
        ticks: graph.ticks
      })
    };
  } catch (error) {
    if (error instanceof ResearchPopulationDiversityEvidenceError ||
      error instanceof ResearchGeneralizationReadModelError ||
      error instanceof Error && error.message.startsWith(
        "candidate_arena_projection_"
      )) {
      return { availability: "unavailable" };
    }
    throw error;
  }
}

function boundAuthorityResultsHaveCanonicalGraph(
  tick: CandidateArenaTickRecord,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): boolean {
  return tick.direction_results.every((result) => {
    if (![
      "created",
      "duplicate",
      "quarantined"
    ].includes(result.status)) return true;
    return boundAuthorityResultHasCanonicalGraph(
      tick,
      result,
      graph,
      index
    );
  });
}

function boundAuthorityResultHasCanonicalGraph(
  tick: CandidateArenaTickRecord,
  result: CandidateArenaTickDirectionResultReadModel,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): boolean {
  const commitmentId = result.research_preflight?.commitment_id;
  const commitmentMatches = typeof commitmentId === "string"
    ? index.commitmentsById.get(commitmentId) ?? []
    : [];
  const commitment = commitmentMatches.length === 1
    ? commitmentMatches[0]
    : undefined;
  const direction = commitment && exactRef(
    commitment.research_direction_ref,
    "research_direction"
  ) ? index.directions.get(commitment.research_direction_ref.id) : undefined;
  if (!commitment || !commitmentHasCanonicalRuntimeShape(commitment) ||
    commitment.candidate_arena_tick_id !== tick.tick_id ||
    !exactRef(
      commitment.research_allocation_ref,
      "candidate_arena_research_allocation",
      tick.research_allocation_ref!.id
    ) || direction?.direction_kind !== result.direction_kind) {
    return false;
  }

  const admissionMatches = typeof result.admission_decision_id === "string"
    ? index.admissionsById.get(result.admission_decision_id) ?? []
    : [];
  const admission = admissionMatches.length === 1
    ? admissionMatches[0]
    : undefined;
  let policyConsistent = false;
  try {
    policyConsistent = Boolean(
      admission && isCandidateAdmissionDecisionConsistent(admission)
    );
  } catch {
    policyConsistent = false;
  }
  if (!admission || !policyConsistent ||
    !terminalDirectionResultMatchesAdmission(result, admission) ||
    !exactRef(
      admission.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || admission.research_preflight_commitment_digest !==
      commitment.commitment_digest || !exactSameRef(
        admission.source_system_code_ref,
        commitment.source_system_code_ref
      ) || admission.source_artifact_digest !==
        commitment.source_artifact_digest) {
    return false;
  }

  const evaluationMatches = index.evaluationsById.get(
    admission.trading_evaluation_result_ref.id
  ) ?? [];
  const evaluation = evaluationMatches.length === 1
    ? evaluationMatches[0]
    : undefined;
  const experiment = evaluation && exactRef(
    evaluation.experiment_run_ref,
    "experiment_run"
  ) ? index.experiments.get(evaluation.experiment_run_ref.id) : undefined;
  const selectedSystemCode = evaluation && exactRef(
    evaluation.submitted_system_code_ref,
    "system_code"
  ) ? graph.systemCodes.get(evaluation.submitted_system_code_ref.id) : undefined;
  const admissionSystemCode = exactRef(admission.system_code_ref, "system_code")
    ? graph.systemCodes.get(admission.system_code_ref.id)
    : undefined;
  const findingMatches = index.findingsById.get(
    admission.research_finding_ref.id
  ) ?? [];
  const finding = findingMatches.length === 1 ? findingMatches[0] : undefined;
  const linkedEvaluation = evaluation !== undefined &&
    evaluationHasRuntimeShape(evaluation) &&
    evaluationHasAuthorityLinkageShape(evaluation);
  const unsealedFailureEvaluation = evaluation !== undefined &&
    unsealedFailureEvaluationHasRuntimeShape(evaluation) &&
    result.status === "quarantined" && admission.status === "quarantined" &&
    result.research_preflight?.sealed_terminal_status === "not_run" &&
    result.paper_handoff_conformance === undefined &&
    ((admission.reason === "research_worker_failed" &&
      evaluation.disqualification_reason === "research_worker_failed") ||
      (admission.reason === "experiment_failed" &&
        evaluation.disqualification_reason === "runtime_crash") ||
      (admission.reason === "evaluation_disqualified" &&
        evaluation.disqualification_reason !== undefined)) &&
    evaluation.result_status === "disqualified" &&
    evaluation.evidence_disposition === "quarantined_for_review" && [
      evaluation.research_preflight_commitment_ref,
      evaluation.research_preflight_commitment_digest,
      evaluation.submitted_system_code_ref,
      evaluation.submitted_artifact_digest,
      evaluation.sealed_admission_suite_digest,
      evaluation.evaluation_phase,
      evaluation.submission_sequence,
      evaluation.selected_development_submission_sequence
    ].every((value) => value === undefined) &&
    systemCodeHasRuntimeShape(admissionSystemCode) &&
    exactSameRef(admission.system_code_ref, experiment?.system_code_ref) &&
    admission.submitted_artifact_digest === admissionSystemCode.artifact_digest;
  if (!evaluation || !linkedEvaluation && !unsealedFailureEvaluation ||
    !experimentHasRuntimeShape(experiment) ||
    !finding || !findingHasRuntimeShape(finding) ||
    linkedEvaluation && (!exactRef(
      evaluation.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || evaluation.research_preflight_commitment_digest !==
      commitment.commitment_digest || evaluation.sealed_admission_suite_digest !==
        commitment.sealed_admission_policy.suite_digest) || !exactRef(
          admission.trading_evaluation_result_ref,
          "trading_evaluation_result",
          evaluation.trading_evaluation_result_id
        ) || admission.evaluation_status !== evaluation.result_status ||
    admission.evidence_disposition !== evaluation.evidence_disposition ||
    !exactRef(
      admission.experiment_run_ref,
      "experiment_run",
      experiment.experiment_run_id
    ) || admission.experiment_status !== experiment.status ||
    linkedEvaluation && !exactSameRef(
      experiment.system_code_ref,
      evaluation.submitted_system_code_ref
    ) ||
    !exactSameRef(
      experiment.trading_evaluation_task_ref,
      evaluation.trading_evaluation_task_ref
    ) || linkedEvaluation && (!exactSameRef(admission.system_code_ref,
      evaluation.submitted_system_code_ref) || admission.submitted_artifact_digest !==
      evaluation.submitted_artifact_digest) || !exactSameRef(
        experiment.research_worker_ref,
        commitment.research_worker_ref
      ) || !exactSameRef(
        experiment.research_direction_ref,
        commitment.research_direction_ref
      ) || Date.parse(evaluation.completed_at) < Date.parse(experiment.submitted_at) ||
    Date.parse(evaluation.completed_at) < Date.parse(commitment.committed_at) ||
    Date.parse(admission.decided_at) < Date.parse(evaluation.completed_at) ||
    !exactSameRef(
        finding.research_worker_ref,
        commitment.research_worker_ref
      ) || !exactSameRef(
        finding.research_direction_ref,
        commitment.research_direction_ref
      ) || !exactSameRef(finding.experiment_run_ref,
      admission.experiment_run_ref) || !exactSameRef(
        finding.trading_evaluation_result_ref,
      admission.trading_evaluation_result_ref
      ) || result.status !== "created" && result.finding !== finding.summary) {
    return false;
  }

  const hasBehaviorFingerprint =
    admission.research_behavior_fingerprint_ref !== undefined ||
    admission.research_behavior_fingerprint_digest !== undefined ||
    admission.matching_research_behavior_fingerprint_ref !== undefined ||
    admission.matching_research_behavior_fingerprint_digest !== undefined;
  const fingerprintSystemCode = linkedEvaluation
    ? selectedSystemCode
    : unsealedFailureEvaluation ? admissionSystemCode : undefined;
  if (result.status !== "quarantined" && (
    !evaluationHasRuntimeShape(evaluation) ||
    !systemCodeHasRuntimeShape(selectedSystemCode) ||
    evaluation.submitted_artifact_digest !== selectedSystemCode.artifact_digest ||
    !boundAdmissionBehaviorFingerprintHasCanonicalGraph(
      admission,
      commitment,
      selectedSystemCode,
      graph,
      index
    )
  ) || result.status === "quarantined" && hasBehaviorFingerprint && (
    !systemCodeHasRuntimeShape(fingerprintSystemCode) ||
    !boundAdmissionBehaviorFingerprintHasCanonicalGraph(
      admission,
      commitment,
      fingerprintSystemCode,
      graph,
      index
    )
  )) {
    return false;
  }

  if (result.status === "created" && (
    admission.status !== "admitted" || admission.reason !== "evaluation_accepted" ||
    evaluation.result_status !== "accepted" ||
    evaluation.evidence_disposition !== "not_counted" ||
    !safeIdentifier(result.candidate_id) ||
    !systemCodeHasRuntimeShape(selectedSystemCode) ||
    !candidateMaterializationMatches({
      candidate: graph.candidates.get(result.candidate_id),
      candidateId: result.candidate_id,
      selectedSystemCode,
      tick,
      tickResult: result,
      index
    })
  )) {
    return false;
  }

  const conformanceFields = [
    admission.paper_handoff_conformance_status,
    admission.paper_trading_handoff_conformance_ref,
    admission.paper_trading_handoff_conformance_digest
  ].filter((value) => value !== undefined).length;
  if (!result.paper_handoff_conformance) {
    return conformanceFields === 0;
  }
  const conformance = index.conformances.get(
    result.paper_handoff_conformance.conformance_id
  );
  const conformanceMatches = conformanceFields === 3 && conformance !== undefined &&
    conformanceHasRuntimeShape(conformance, graph.conformances) &&
    compactConformanceMatchesCanonical(
      result.paper_handoff_conformance,
      conformance
    ) && admission.paper_handoff_conformance_status === conformance.status &&
    exactRef(
      admission.paper_trading_handoff_conformance_ref,
      "paper_trading_handoff_conformance",
      conformance.paper_trading_handoff_conformance_id
    ) && admission.paper_trading_handoff_conformance_digest ===
      conformance.evidence_digest && exactSameRef(
        conformance.system_code_ref,
        evaluation.submitted_system_code_ref
      ) && conformance.system_code_artifact_digest ===
      evaluation.submitted_artifact_digest && exactSameRef(
        conformance.experiment_run_ref,
        evaluation.experiment_run_ref
      ) && exactSameRef(
        conformance.trading_evaluation_task_ref,
      evaluation.trading_evaluation_task_ref
      );
  return conformanceMatches;
}

function boundAdmissionBehaviorFingerprintHasCanonicalGraph(
  admission: CandidateAdmissionDecisionRecord,
  commitment: ResearchPreflightCommitmentRecord,
  selectedSystemCode: SystemCodeRecord,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): boolean {
  const currentRef = admission.research_behavior_fingerprint_ref;
  const currentDigest = admission.research_behavior_fingerprint_digest;
  if (currentRef === undefined || currentDigest === undefined) {
    return currentRef === undefined && currentDigest === undefined &&
      admission.matching_research_behavior_fingerprint_ref === undefined &&
      admission.matching_research_behavior_fingerprint_digest === undefined;
  }
  const currentMatches = index.fingerprintsById.get(currentRef.id) ?? [];
  const current = currentMatches.length === 1 ? currentMatches[0] : undefined;
  if (!current || !researchBehaviorFingerprintHasRuntimeShape(current) ||
    current.fingerprint_digest !== canonicalDigest(
      researchBehaviorFingerprintDigestInput(current)
    ) || current.fingerprint_digest !== currentDigest || !exactRef(
      current.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) || current.research_preflight_commitment_digest !==
      commitment.commitment_digest || !exactRef(
        current.system_code_ref,
        "system_code",
        selectedSystemCode.system_code_id
      ) || current.system_code_artifact_digest !==
      selectedSystemCode.artifact_digest || current.development_suite_version !==
      commitment.development_policy.suite_version ||
    current.development_suite_digest !== commitment.development_policy.suite_digest) {
    return false;
  }
  const matchingRef = admission.matching_research_behavior_fingerprint_ref;
  const matchingDigest = admission.matching_research_behavior_fingerprint_digest;
  if (matchingRef === undefined || matchingDigest === undefined) {
    return matchingRef === undefined && matchingDigest === undefined;
  }
  const matchingRecords = index.fingerprintsById.get(matchingRef.id) ?? [];
  const matching = matchingRecords.length === 1 ? matchingRecords[0] : undefined;
  return matching !== undefined && matching !== current &&
    boundBehaviorFingerprintHasCanonicalSourceGraph(matching, graph, index) &&
    matching.fingerprint_digest === matchingDigest &&
    sameBehaviorFingerprintKey(matching, current);
}

function boundBehaviorFingerprintHasCanonicalSourceGraph(
  fingerprint: ResearchBehaviorFingerprintRecord,
  graph: LoadedGraph,
  index: ResearchOperationsProjectionIndex
): boolean {
  if (!researchBehaviorFingerprintHasRuntimeShape(fingerprint) ||
    fingerprint.fingerprint_digest !== canonicalDigest(
      researchBehaviorFingerprintDigestInput(fingerprint)
    )) {
    return false;
  }
  const commitmentMatches = index.commitmentsById.get(
    fingerprint.research_preflight_commitment_ref.id
  ) ?? [];
  const commitment = commitmentMatches.length === 1
    ? commitmentMatches[0]
    : undefined;
  const systemCode = graph.systemCodes.get(fingerprint.system_code_ref.id);
  return commitment !== undefined &&
    commitmentHasCanonicalRuntimeShape(commitment) &&
    systemCodeHasRuntimeShape(systemCode) && exactRef(
      fingerprint.research_preflight_commitment_ref,
      "research_preflight_commitment",
      commitment.research_preflight_commitment_id
    ) && fingerprint.research_preflight_commitment_digest ===
      commitment.commitment_digest && exactRef(
        fingerprint.system_code_ref,
        "system_code",
        systemCode.system_code_id
      ) && fingerprint.system_code_artifact_digest ===
      systemCode.artifact_digest && fingerprint.development_suite_version ===
      commitment.development_policy.suite_version &&
    fingerprint.development_suite_digest ===
      commitment.development_policy.suite_digest;
}

function compactConformanceMatchesCanonical(
  compact: CandidateArenaTickDirectionResultReadModel["paper_handoff_conformance"],
  conformance: PaperTradingHandoffConformanceRecord | undefined
): boolean {
  if (!compact || !conformance) return compact === undefined && conformance === undefined;
  const compactAttestation = compact.candidate_egress_attestation;
  const attestationMatches = conformance.version === 2
    ? Boolean(compactAttestation &&
      compactAttestation.attestation_id ===
        conformance.candidate_egress_attestation.attestation_id &&
      compactAttestation.verification_status === "verified" &&
      compactAttestation.enforcement_result === "enforced" &&
      compactAttestation.network_policy_digest ===
        conformance.candidate_egress_attestation.network_policy_digest &&
      isDeepStrictEqual(
        compactAttestation.denial_summary,
        conformance.candidate_egress_attestation.denial_summary
      ) && compactAttestation.authority_status === "research_only")
    : compactAttestation === undefined;
  return compact.conformance_id ===
      conformance.paper_trading_handoff_conformance_id &&
    compact.status === conformance.status && compact.reason === conformance.reason &&
    compact.authority_status === "research_only" && attestationMatches;
}

function candidateArenaEvidenceHasProjectionShape(
  value: ResearchOperationsProjectionIndexRecord["candidate_arena_evidence"]
): boolean {
  if (!value || !["available", "unavailable"].includes(value.availability)) {
    return false;
  }
  if (value.availability === "unavailable") {
    return hasExactKeys(value, ["availability"]);
  }
  if (!hasExactKeys(value, [
    "availability",
    "latest_ticks",
    "terminal_tick_ids",
    "research_population_diversity",
    "research_generalization"
  ]) || !Array.isArray(value.latest_ticks) || value.latest_ticks.length > 10 ||
    !value.latest_ticks.every(candidateArenaTickReadModelHasProjectionShape) ||
    value.latest_ticks.some((tick, index) => {
      const previous = value.latest_ticks[index - 1];
      return Boolean(previous) && (
        previous!.completed_at < tick.completed_at ||
        previous!.completed_at === tick.completed_at &&
          previous!.tick_id < tick.tick_id
      );
    }) || new Set(value.latest_ticks.map((tick) => tick.tick_id)).size !==
      value.latest_ticks.length || !Array.isArray(value.terminal_tick_ids) ||
    value.terminal_tick_ids.length > value.latest_ticks.length ||
    new Set(value.terminal_tick_ids).size !== value.terminal_tick_ids.length ||
    !isDeepStrictEqual(
      value.terminal_tick_ids,
      value.latest_ticks
        .filter((tick) => tick.research_allocation !== undefined)
        .map((tick) => tick.tick_id)
    ) || !researchPopulationDiversityHasRuntimeShape(
      value.research_population_diversity
    ) || !researchGeneralizationReadModelHasProjectionShape(
      value.research_generalization
    )) {
    return false;
  }
  return true;
}

function candidateArenaTickReadModelHasProjectionShape(
  tick: CandidateArenaTickReadModel
): boolean {
  const hasSource = tick.source_candidate !== undefined;
  const hasAllocation = tick.research_allocation !== undefined;
  const hasContinuation = tick.paper_trading_continuation !== undefined;
  return hasExactKeys(tick, [
    "tick_id",
    "started_at",
    "completed_at",
    "status",
    ...(hasSource ? ["source_candidate"] : []),
    "created_candidate_ids",
    "direction_results",
    ...(hasAllocation ? ["research_allocation"] : []),
    ...(hasContinuation ? ["paper_trading_continuation"] : []),
    "authority_status"
  ]) && projectionIdentifier(tick.tick_id) && projectionIso(tick.started_at) &&
    projectionIso(tick.completed_at) &&
    Date.parse(tick.completed_at) >= Date.parse(tick.started_at) &&
    ["completed", "completed_with_errors", "failed"].includes(tick.status) &&
    (!hasSource || candidateArenaTickSourceHasProjectionShape(
      tick.source_candidate!
    )) && boundedUniqueProjectionIdentifiers(tick.created_candidate_ids, 10) &&
    Array.isArray(tick.direction_results) && tick.direction_results.length <= 10 &&
    tick.direction_results.every(candidateArenaDirectionResultHasProjectionShape) &&
    candidateArenaTickAuthorityGraphHasRuntimeShape(tick) &&
    candidateArenaTickStatusMatchesProjection(tick) &&
    candidateArenaAllocationMatchesProjectedDirections(tick) &&
    (!hasAllocation || candidateArenaAllocationHasProjectionShape(
      tick.research_allocation!,
      tick.tick_id
    )) && (!hasContinuation || candidateArenaContinuationHasProjectionShape(
      tick.paper_trading_continuation!
    )) && tick.authority_status === "not_live";
}

function candidateArenaTickStatusMatchesProjection(
  tick: CandidateArenaTickReadModel
): boolean {
  return tick.status === deriveCandidateArenaTickStatus(
    tick.direction_results
  );
}

function candidateArenaAllocationMatchesProjectedDirections(
  tick: CandidateArenaTickReadModel
): boolean {
  const allocation = tick.research_allocation;
  return allocation === undefined ||
    allocation.selected_directions.length === tick.direction_results.length &&
    tick.direction_results.every((result, index) =>
      result.direction_kind ===
        allocation.selected_directions[index]?.direction_kind
    );
}

function candidateArenaTickSourceHasProjectionShape(
  source: NonNullable<CandidateArenaTickReadModel["source_candidate"]>
): boolean {
  const hasRevenue = source.net_revenue_usdt !== undefined;
  return hasExactKeys(source, [
    "source_kind",
    "candidate_id",
    "display_name",
    ...(hasRevenue ? ["net_revenue_usdt"] : []),
    "authority_status"
  ]) && [
    "fixture_seed",
    "evaluated_arena_leader",
    "paper_trading_evaluation_leader",
    "explicit_candidate"
  ].includes(source.source_kind) && projectionIdentifier(source.candidate_id) &&
    projectionText(source.display_name, 256) &&
    (!hasRevenue || Number.isFinite(source.net_revenue_usdt)) &&
    source.authority_status === "not_live";
}

function candidateArenaDirectionResultHasProjectionShape(
  result: CandidateArenaTickProjectedDirectionResultReadModel
): boolean {
  const optionalKeys = [
    "agent_provider",
    "agent_model",
    "candidate_id",
    "finding",
    "error",
    "admission_decision_id",
    "admission_reason",
    "net_revenue_usdt",
    "research_efficiency",
    "research_preflight",
    "paper_handoff_conformance"
  ].filter((key) => Object.hasOwn(result, key));
  if (!hasExactKeys(result, ["direction_kind", "status", ...optionalKeys]) ||
    !researchDirectionKind(result.direction_kind) || ![
      "created",
      "duplicate",
      "quarantined",
      "no_submission",
      "failed",
      "legacy_unverified"
    ].includes(result.status) || result.agent_provider !== undefined && ![
      "codex",
      "fixture",
      "claude_code"
    ].includes(result.agent_provider) || result.agent_model !== undefined &&
      !projectionText(result.agent_model, 256) || result.candidate_id !== undefined &&
      !projectionIdentifier(result.candidate_id) || result.finding !== undefined &&
      !projectionText(result.finding, 256) || result.error !== undefined &&
      !projectionText(result.error, 256) || result.admission_decision_id !== undefined &&
      !projectionIdentifier(result.admission_decision_id) ||
    result.admission_reason !== undefined && ![
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
    ].includes(result.admission_reason) || result.net_revenue_usdt !== undefined &&
      !Number.isFinite(result.net_revenue_usdt) ||
    result.research_efficiency !== undefined &&
      !candidateArenaResearchEfficiencyHasProjectionShape(
        result.research_efficiency
      ) || result.research_preflight !== undefined &&
      !candidateArenaResearchPreflightHasProjectionShape(
        result.research_preflight
      ) || result.paper_handoff_conformance !== undefined &&
      !candidateArenaConformanceHasProjectionShape(
        result.paper_handoff_conformance
      )) {
    return false;
  }
  if (result.status === "legacy_unverified") {
    const hasEfficiency = result.research_efficiency !== undefined;
    return hasExactKeys(result, [
      "direction_kind",
      "status",
      "candidate_id",
      "finding",
      ...(hasEfficiency ? ["research_efficiency"] : [])
    ]) && result.candidate_id !== undefined && result.finding !== undefined;
  }
  if (result.status === "created") return result.candidate_id !== undefined;
  if (result.status === "failed") return result.error !== undefined;
  if (result.status === "no_submission") {
    return result.finding !== undefined && result.candidate_id === undefined &&
      result.error === undefined && result.admission_decision_id === undefined &&
      result.admission_reason === undefined &&
      result.paper_handoff_conformance === undefined;
  }
  return result.finding !== undefined &&
    result.admission_decision_id !== undefined &&
    result.admission_reason !== undefined;
}

function candidateArenaResearchEfficiencyHasProjectionShape(
  efficiency: NonNullable<
    CandidateArenaTickDirectionResultReadModel["research_efficiency"]
  >
): boolean {
  const hasDevelopment = efficiency.development !== undefined;
  const hasSealed = efficiency.sealed_admission !== undefined;
  return hasExactKeys(efficiency, [
    "provider_request_total",
    "runner_command_total",
    "scenario_count",
    "elapsed_ms",
    ...(hasDevelopment ? ["development"] : []),
    ...(hasSealed ? ["sealed_admission"] : []),
    "authority_status"
  ]) && [
    efficiency.provider_request_total,
    efficiency.runner_command_total,
    efficiency.scenario_count,
    efficiency.elapsed_ms
  ].every(nonNegativeSafeInteger) && (!hasDevelopment ||
    candidateArenaResearchEfficiencyPhaseHasProjectionShape(
      efficiency.development!
    )) && (!hasSealed ||
    candidateArenaResearchEfficiencyPhaseHasProjectionShape(
      efficiency.sealed_admission!
    )) && efficiency.authority_status === "not_promotion_authority";
}

function candidateArenaResearchEfficiencyPhaseHasProjectionShape(
  phase: NonNullable<
    CandidateArenaTickDirectionResultReadModel["research_efficiency"]
  >["development"]
): boolean {
  return hasExactKeys(phase, [
    "submission_count",
    "provider_request_total",
    "runner_command_total",
    "scenario_count",
    "elapsed_ms"
  ]) && [
    phase?.submission_count,
    phase?.provider_request_total,
    phase?.runner_command_total,
    phase?.scenario_count,
    phase?.elapsed_ms
  ].every(nonNegativeSafeInteger);
}

function candidateArenaResearchPreflightHasProjectionShape(
  preflight: NonNullable<
    CandidateArenaTickDirectionResultReadModel["research_preflight"]
  >
): boolean {
  return hasExactKeys(preflight, [
    "commitment_id",
    "development_submission_count",
    "sealed_terminal_status",
    "reason",
    "authority_status"
  ]) && projectionIdentifier(preflight.commitment_id) &&
    nonNegativeSafeInteger(preflight.development_submission_count) &&
    preflight.development_submission_count <= 2 &&
    (preflight.sealed_terminal_status === "accepted"
      ? preflight.reason === "accepted"
      : preflight.sealed_terminal_status === "rejected"
        ? preflight.reason === "candidate_rejected"
        : preflight.sealed_terminal_status === "not_run" &&
          ["no_development_winner", "execution_failed"].includes(
            preflight.reason
          )) && preflight.authority_status === "not_promotion_authority";
}

function candidateArenaConformanceHasProjectionShape(
  conformance: NonNullable<
    CandidateArenaTickDirectionResultReadModel["paper_handoff_conformance"]
  >
): boolean {
  const hasAttestation = conformance.candidate_egress_attestation !== undefined;
  return hasExactKeys(conformance, [
    "conformance_id",
    "status",
    "reason",
    ...(hasAttestation ? ["candidate_egress_attestation"] : []),
    "authority_status"
  ]) && projectionIdentifier(conformance.conformance_id) &&
    ["passed", "rejected"].includes(conformance.status) &&
    candidateArenaPaperHandoffReason(conformance.reason) &&
    (conformance.status === "passed") === (conformance.reason === "passed") &&
    (!hasAttestation || candidateArenaAttestationHasProjectionShape(
      conformance.candidate_egress_attestation!
    )) && conformance.authority_status === "research_only";
}

function candidateArenaAttestationHasProjectionShape(
  attestation: NonNullable<NonNullable<
    CandidateArenaTickDirectionResultReadModel["paper_handoff_conformance"]
  >["candidate_egress_attestation"]>
): boolean {
  const denial = attestation.denial_summary;
  return hasExactKeys(attestation, [
    "attestation_id",
    "verification_status",
    "enforcement_result",
    "network_policy_digest",
    "denial_summary",
    "authority_status"
  ]) && projectionIdentifier(attestation.attestation_id) &&
    attestation.verification_status === "verified" &&
    attestation.enforcement_result === "enforced" &&
    validDigest(attestation.network_policy_digest) && hasExactKeys(denial, [
      "required_probe_count",
      "start_denied_probe_count",
      "end_denied_probe_count",
      "unexpected_allow_count"
    ]) && [
      denial.required_probe_count,
      denial.start_denied_probe_count,
      denial.end_denied_probe_count
    ].every((count) =>
      count === CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length
    ) && denial.unexpected_allow_count === 0 &&
    attestation.authority_status === "research_only";
}

function candidateArenaAllocationHasProjectionShape(
  allocation: NonNullable<CandidateArenaTickReadModel["research_allocation"]>,
  tickId: string
): boolean {
  const hasTrigger = allocation.trigger !== undefined;
  if (!(hasExactKeys(allocation, [
    "allocation_id",
    "tick_id",
    "allocation_mode",
    "allocation_policy_basis",
    ...(hasTrigger ? ["trigger"] : []),
    "policy",
    "selected_directions",
    "deferred_directions",
    "allocated_at",
    "research_scheduling_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) && projectionIdentifier(allocation.allocation_id) &&
    allocation.tick_id === tickId &&
    ["adaptive_default", "static_control", "explicit"].includes(
      allocation.allocation_mode
    ) && candidateArenaAllocationBasisHasProjectionShape(
      allocation.allocation_policy_basis
    ) && (!hasTrigger || candidateArenaTriggerHasProjectionShape(
      allocation.trigger!
    )) && isDeepStrictEqual(
      allocation.policy,
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
    ) && Array.isArray(allocation.selected_directions) &&
    allocation.selected_directions.length <= 5 &&
    allocation.selected_directions.every((selection) =>
      hasExactKeys(selection, [
        "direction_kind",
        "selection_kind",
        "priority",
        "experiment_budget",
        "signal_score",
        "reasons"
      ]) && researchDirectionKind(selection.direction_kind) && [
        "focus",
        "exploration",
        "static_control",
        "explicit"
      ].includes(selection.selection_kind) &&
      positiveSafeInteger(selection.priority) &&
      positiveSafeInteger(selection.experiment_budget) &&
      Number.isFinite(selection.signal_score) && Array.isArray(selection.reasons) &&
      selection.reasons.length > 0 && selection.reasons.length <= 10 &&
      new Set(selection.reasons).size === selection.reasons.length &&
      selection.reasons.every((reason) =>
        projectionText(reason, 256)
      )
    ) && Array.isArray(allocation.deferred_directions) &&
    allocation.deferred_directions.length <= 7 &&
    allocation.deferred_directions.every(researchDirectionKind) &&
    projectionIso(allocation.allocated_at) &&
    (!hasTrigger || Date.parse(allocation.trigger!.triggered_at) <=
      Date.parse(allocation.allocated_at)) &&
    allocation.research_scheduling_authority === true &&
    allocation.promotion_authority === false &&
    allocation.order_submission_authority === false &&
    allocation.live_exchange_authority === false &&
    allocation.authority_status === "research_only")) {
    return false;
  }

  const selectedDirections = allocation.selected_directions.map(
    (selection) => selection.direction_kind
  );
  const totalExperimentBudget = allocation.selected_directions.reduce(
    (total, selection) => total + selection.experiment_budget,
    0
  );
  if (new Set(selectedDirections).size !== selectedDirections.length ||
    allocation.selected_directions.some(
      (selection, index) => selection.priority !== index + 1
    ) || totalExperimentBudget <= 0 || totalExperimentBudget >
      allocation.policy.maximum_total_experiment_budget) {
    return false;
  }

  const defaultDirections = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ] as const satisfies readonly ResearchDirectionKind[];
  if (allocation.allocation_mode === "explicit") {
    const expectedDeferred = defaultDirections.filter(
      (direction) => !selectedDirections.includes(direction)
    );
    return allocation.allocation_policy_basis.basis_kind === "explicit_request" &&
      allocation.selected_directions.length >= 1 &&
      allocation.selected_directions.every((selection) =>
        selection.selection_kind === "explicit" &&
        selection.experiment_budget ===
          allocation.policy.explicit_experiment_budget &&
        selection.signal_score === 0
      ) && isDeepStrictEqual(allocation.deferred_directions, expectedDeferred);
  }

  const combinedDefaultDirections = [
    ...selectedDirections,
    ...allocation.deferred_directions
  ];
  if (combinedDefaultDirections.length !== defaultDirections.length ||
    new Set(combinedDefaultDirections).size !== combinedDefaultDirections.length ||
    !defaultDirections.every((direction) =>
      combinedDefaultDirections.includes(direction)
    )) {
    return false;
  }

  if (allocation.allocation_mode === "static_control") {
    return allocation.allocation_policy_basis.basis_kind === "explicit_request" &&
      isDeepStrictEqual(selectedDirections, defaultDirections.slice(0, 3)) &&
      allocation.selected_directions.every((selection, index) =>
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

function candidateArenaAllocationBasisHasProjectionShape(
  basis: NonNullable<
    CandidateArenaTickReadModel["research_allocation"]
  >["allocation_policy_basis"]
): boolean {
  if (basis.basis_kind === "explicit_request" ||
    basis.basis_kind === "repository_default") {
    return hasExactKeys(basis, ["basis_kind"]);
  }
  if (basis.basis_kind === "research_allocation_policy_decision") {
    return hasExactKeys(basis, [
      "basis_kind",
      "policy_decision_ref",
      "policy_decision_digest",
      "study_outcome_ref",
      "study_outcome_digest"
    ]) && projectionRef(basis.policy_decision_ref,
      "research_allocation_policy_decision") &&
      validDigest(basis.policy_decision_digest) &&
      projectionRef(basis.study_outcome_ref, "research_control_study_outcome") &&
      validDigest(basis.study_outcome_digest);
  }
  return basis.basis_kind === "research_generalization_policy_decision" &&
    hasExactKeys(basis, [
      "basis_kind",
      "policy_decision_ref",
      "policy_decision_digest",
      "generalization_outcome_ref",
      "generalization_outcome_digest"
    ]) && projectionRef(basis.policy_decision_ref,
      "research_generalization_policy_decision") &&
    validDigest(basis.policy_decision_digest) &&
    projectionRef(basis.generalization_outcome_ref,
      "research_generalization_outcome") &&
    validDigest(basis.generalization_outcome_digest);
}

function candidateArenaTriggerHasProjectionShape(
  trigger: NonNullable<NonNullable<
    CandidateArenaTickReadModel["research_allocation"]
  >["trigger"]>
): boolean {
  const hasSource = trigger.source_ref !== undefined;
  const hasEvidenceRef = trigger.evidence_artifact_ref !== undefined;
  const hasEvidenceDigest = trigger.evidence_artifact_digest !== undefined;
  const eventRequiresEvidence = trigger.trigger_kind === "arena_event" ||
    trigger.trigger_kind === "live_event";
  return hasExactKeys(trigger, [
    "trigger_kind",
    "trigger_id",
    "goal",
    "triggered_at",
    ...(hasSource ? ["source_ref"] : []),
    ...(hasEvidenceRef
      ? ["evidence_artifact_ref", "evidence_artifact_digest"]
      : []),
    "authority_status"
  ]) && ["goal", "time", "arena_event", "live_event", "recovery"].includes(
    trigger.trigger_kind
  ) && projectionIdentifier(trigger.trigger_id) && projectionText(
    trigger.goal,
    500
  ) && projectionIso(trigger.triggered_at) && (!hasSource ||
    projectionRef(trigger.source_ref!)) && hasEvidenceRef === hasEvidenceDigest &&
    (!hasEvidenceRef || hasSource) && (!eventRequiresEvidence ||
      hasSource && hasEvidenceRef) && (!hasEvidenceRef ||
    projectionRef(trigger.evidence_artifact_ref!, "research_evidence_artifact") &&
    validDigest(trigger.evidence_artifact_digest)) &&
    trigger.authority_status === "research_only";
}

function candidateArenaContinuationHasProjectionShape(
  continuation: NonNullable<
    CandidateArenaTickReadModel["paper_trading_continuation"]
  >
): boolean {
  const hasCandidate = continuation.selected_candidate_id !== undefined;
  const hasError = continuation.error !== undefined;
  return hasExactKeys(continuation, [
    "status",
    "command_kind",
    ...(hasCandidate ? ["selected_candidate_id"] : []),
    ...(hasError ? ["error"] : []),
    "authority_status"
  ]) && ["started", "queued", "failed"].includes(continuation.status) &&
    continuation.command_kind === "trading_run.start" &&
    (!hasCandidate || projectionIdentifier(continuation.selected_candidate_id!)) &&
    (!hasError || projectionText(continuation.error!, 256)) &&
    continuation.authority_status === "not_live";
}

function researchGeneralizationReadModelHasProjectionShape(
  readModel: ResearchGeneralizationReadModel
): boolean {
  return hasExactKeys(readModel, [
    "status",
    "protocol_count",
    "outcome_count",
    "active_protocol",
    "latest_outcome",
    "latest_policy_decision",
    "effective_policy_decision",
    "authority_status"
  ]) && ["not_started", "collecting", "awaiting_outcome", "closed"].includes(
    readModel.status
  ) && nonNegativeSafeInteger(readModel.protocol_count) &&
    nonNegativeSafeInteger(readModel.outcome_count) &&
    (readModel.active_protocol === null ||
      researchGeneralizationActiveProtocolHasProjectionShape(
        readModel.active_protocol
      )) && (readModel.latest_outcome === null ||
      researchGeneralizationLatestOutcomeHasProjectionShape(
        readModel.latest_outcome
      )) && (readModel.latest_policy_decision === null ||
      researchGeneralizationLatestPolicyDecisionHasProjectionShape(
        readModel.latest_policy_decision
      )) && (readModel.effective_policy_decision === null ||
      researchGeneralizationEffectiveDecisionHasProjectionShape(
        readModel.effective_policy_decision
      )) && readModel.authority_status === "not_promotion_authority";
}

function researchGeneralizationActiveProtocolHasProjectionShape(
  protocol: NonNullable<ResearchGeneralizationReadModel["active_protocol"]>
): boolean {
  return hasExactKeys(protocol, [
    "research_generalization_protocol_id",
    "committed_at",
    "collection_deadline_at",
    "status",
    "planned_study_count",
    "assigned_study_count",
    "terminal_study_count",
    "condition_blocks",
    "next_action",
    "authority_status"
  ]) && projectionIdentifier(protocol.research_generalization_protocol_id) &&
    projectionIso(protocol.committed_at) &&
    projectionIso(protocol.collection_deadline_at) &&
    ["collecting", "awaiting_outcome"].includes(protocol.status) && [
      protocol.planned_study_count,
      protocol.assigned_study_count,
      protocol.terminal_study_count
    ].every(nonNegativeSafeInteger) && protocol.assigned_study_count <=
      protocol.planned_study_count && protocol.terminal_study_count <=
      protocol.assigned_study_count && Array.isArray(protocol.condition_blocks) &&
    protocol.condition_blocks.length === 3 &&
    protocol.condition_blocks.every((block) => hasExactKeys(block, [
      "condition_block",
      "planned_study_count",
      "assigned_study_count",
      "terminal_study_count"
    ]) && marketConditionBlock(block.condition_block) && [
      block.planned_study_count,
      block.assigned_study_count,
      block.terminal_study_count
    ].every(nonNegativeSafeInteger) && block.assigned_study_count <=
      block.planned_study_count && block.terminal_study_count <=
      block.assigned_study_count) && [
      "collect_precommitted_studies",
      "complete_assigned_studies",
      "await_outcome_reconciliation"
    ].includes(protocol.next_action) && protocol.authority_status === "research_only";
}

function researchGeneralizationLatestOutcomeHasProjectionShape(
  outcome: NonNullable<ResearchGeneralizationReadModel["latest_outcome"]>
): boolean {
  return hasExactKeys(outcome, [
    "research_generalization_outcome_id",
    "research_generalization_protocol_id",
    "inference_status",
    "adjudicated_at",
    "planned_study_count",
    "completed_study_count",
    "non_tied_study_count",
    "tied_study_count",
    "missing_study_count",
    "ineligible_study_count",
    "distinct_baseline_count",
    "equal_weight_mean_rate_difference",
    "exact_sign_test_p_value",
    "harmful_condition_blocks",
    "policy_decision_eligibility",
    "next_action",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) && projectionIdentifier(outcome.research_generalization_outcome_id) &&
    projectionIdentifier(outcome.research_generalization_protocol_id) && [
      "generalization_supported",
      "generalization_not_supported",
      "insufficient_generalization_evidence"
    ].includes(outcome.inference_status) && projectionIso(outcome.adjudicated_at) && [
      outcome.planned_study_count,
      outcome.completed_study_count,
      outcome.non_tied_study_count,
      outcome.tied_study_count,
      outcome.missing_study_count,
      outcome.ineligible_study_count,
      outcome.distinct_baseline_count
    ].every(nonNegativeSafeInteger) &&
    (outcome.equal_weight_mean_rate_difference === null ||
      Number.isFinite(outcome.equal_weight_mean_rate_difference)) &&
    Number.isFinite(outcome.exact_sign_test_p_value) &&
    outcome.exact_sign_test_p_value >= 0 &&
    outcome.exact_sign_test_p_value <= 1 &&
    Array.isArray(outcome.harmful_condition_blocks) &&
    outcome.harmful_condition_blocks.length <= 3 &&
    outcome.harmful_condition_blocks.every(marketConditionBlock) &&
    new Set(outcome.harmful_condition_blocks).size ===
      outcome.harmful_condition_blocks.length && [
      "eligible_for_separate_generalization_policy_decision",
      "not_eligible"
    ].includes(outcome.policy_decision_eligibility) && [
      "review_broad_research_allocation_policy",
      "retain_negative_generalization_evidence",
      "complete_or_redesign_generalization_protocol"
    ].includes(outcome.next_action) &&
    outcome.policy_replacement_authority === false &&
    outcome.promotion_authority === false &&
    outcome.order_submission_authority === false &&
    outcome.live_exchange_authority === false &&
    outcome.authority_status === "not_live";
}

function researchGeneralizationLatestPolicyDecisionHasProjectionShape(
  decision: NonNullable<
    ResearchGeneralizationReadModel["latest_policy_decision"]
  >
): boolean {
  return hasExactKeys(decision, [
    "research_generalization_policy_decision_id",
    "research_generalization_protocol_id",
    "research_generalization_outcome_id",
    "decision_status",
    "decision_reason",
    "effective_default_mode",
    "decided_at",
    "research_policy_selection_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) && projectionIdentifier(
    decision.research_generalization_policy_decision_id
  ) && projectionIdentifier(decision.research_generalization_protocol_id) &&
    projectionIdentifier(decision.research_generalization_outcome_id) &&
    (decision.decision_status === "approved"
      ? decision.decision_reason ===
          "supported_cross_condition_adaptive_effect" &&
        decision.effective_default_mode === "adaptive_default"
      : decision.decision_status === "not_approved" &&
        decision.decision_reason === "generalization_outcome_not_eligible" &&
        decision.effective_default_mode === null) &&
    projectionIso(decision.decided_at) &&
    decision.research_policy_selection_authority === true &&
    decision.evaluation_authority === false &&
    decision.promotion_authority === false &&
    decision.order_submission_authority === false &&
    decision.live_exchange_authority === false &&
    decision.authority_status === "research_policy_only";
}

function researchGeneralizationEffectiveDecisionHasProjectionShape(
  decision: NonNullable<
    ResearchGeneralizationReadModel["effective_policy_decision"]
  >
): boolean {
  return hasExactKeys(decision, [
    "research_generalization_policy_decision_id",
    "research_generalization_protocol_id",
    "research_generalization_outcome_id",
    "effective_default_mode",
    "decided_at",
    "application",
    "research_policy_selection_authority",
    "evaluation_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ]) && projectionIdentifier(
    decision.research_generalization_policy_decision_id
  ) && projectionIdentifier(decision.research_generalization_protocol_id) &&
    projectionIdentifier(decision.research_generalization_outcome_id) &&
    decision.effective_default_mode === "adaptive_default" &&
    projectionIso(decision.decided_at) &&
    researchGeneralizationApplicationHasProjectionShape(decision.application) &&
    decision.research_policy_selection_authority === true &&
    decision.evaluation_authority === false &&
    decision.promotion_authority === false &&
    decision.order_submission_authority === false &&
    decision.live_exchange_authority === false &&
    decision.authority_status === "research_policy_only";
}

function researchGeneralizationApplicationHasProjectionShape(
  application: NonNullable<
    ResearchGeneralizationReadModel["effective_policy_decision"]
  >["application"]
): boolean {
  return hasExactKeys(application, [
    "application_status",
    "allocation_count",
    "completed_tick_count",
    "latest_allocation"
  ]) && ["awaiting_allocation", "allocated", "completed_tick"].includes(
    application.application_status
  ) && nonNegativeSafeInteger(application.allocation_count) &&
    nonNegativeSafeInteger(application.completed_tick_count) &&
    application.completed_tick_count <= application.allocation_count &&
    (application.latest_allocation === null || hasExactKeys(
      application.latest_allocation,
      [
        "candidate_arena_research_allocation_id",
        "tick_id",
        "allocated_at",
        "completed_at"
      ]
    ) && projectionIdentifier(
      application.latest_allocation.candidate_arena_research_allocation_id
    ) && projectionIdentifier(application.latest_allocation.tick_id) &&
      projectionIso(application.latest_allocation.allocated_at) &&
      (application.latest_allocation.completed_at === null ||
        projectionIso(application.latest_allocation.completed_at)));
}

function projectionIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value) &&
    safeId(value, { maxLength: 200 }) === value;
}

function projectionRef(value: unknown, recordKind?: string): value is Ref {
  return hasExactKeys(value, ["record_kind", "id"]) &&
    projectionIdentifier((value as Ref).record_kind) &&
    projectionIdentifier((value as Ref).id) &&
    (recordKind === undefined || (value as Ref).record_kind === recordKind);
}

function projectionText(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= limit &&
    sanitizeResearchEvidenceText(value) === value;
}

function projectionIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function boundedUniqueProjectionIdentifiers(
  values: unknown,
  limit: number
): values is string[] {
  return Array.isArray(values) && values.length <= limit &&
    values.every(projectionIdentifier) && new Set(values).size === values.length;
}

function researchDirectionKind(value: unknown): value is ResearchDirectionKind {
  return [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "liquidation_aware_risk",
    "execution_cost_robustness",
    "other"
  ].includes(value as ResearchDirectionKind);
}

function marketConditionBlock(value: unknown): value is "long" | "short" | "flat" {
  return value === "long" || value === "short" || value === "flat";
}

function candidateArenaPaperHandoffReason(
  value: unknown
): value is NonNullable<
  CandidateArenaTickDirectionResultReadModel["paper_handoff_conformance"]
>["reason"] {
  return [
    "passed",
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
  ].includes(value as string);
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
  const terminalAdmissionConflict = Boolean(
    admissionCandidate && checkpoint?.terminal_status === "failed_closed" &&
    !checkpointAdmissionAgrees(
      checkpoint,
      admissionCandidate,
      tickResult
    )
  );
  const admissionIntegrityConflict = admissionGraphConflict ||
    behaviorComparisonRequired && !behaviorComparisonExact;
  const admission = admissionCandidate && validFinding && behaviorComparisonExact &&
    !terminalAdmissionConflict
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
  const appendEvidenceInput = (record: ResearchEvidenceArtifactRecord): void => {
    if (evidenceInputs.some((entry) => entry.evidence_artifact_id ===
      record.research_evidence_artifact_id)) return;
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
  };
  const triggerEvidenceExact = triggerEvidenceMatches(
    allocation.trigger,
    index.evidence
  );
  if (triggerEvidenceExact && allocation.trigger?.evidence_artifact_ref) {
    const triggerEvidence = index.evidence.get(
      allocation.trigger.evidence_artifact_ref.id
    );
    if (triggerEvidence) appendEvidenceInput(triggerEvidence);
  }
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
    appendEvidenceInput(record);
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
    candidateMaterializationExact,
    evaluationChainAmbiguous: evaluationChainConflict,
    evaluationGraphConflict,
    admissionGraphConflict,
    admissionIntegrityConflict,
    terminalAdmissionConflict,
    terminalGraphComplete,
    evidenceInputs,
    ...(latestEvidenceRecord ? {
      latestEvidenceSummary: latestEvidenceRecord.summary
    } : {}),
    triggerEvidenceExact,
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
    tick_id: source.allocation.tick_id,
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
        evidence_artifact_ids: source.evidenceInputs
          .filter((entry) => methodology.evidence_bindings.some((binding) =>
            binding.evidence_artifact_ref.id === entry.evidence_artifact_id
          ))
          .map((entry) => entry.evidence_artifact_id),
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
    .sort((left, right) => left.iteration - right.iteration || left.sequence - right.sequence);
  if (currentEntries.length > HISTORY_LIMIT) {
    throw new Error("research_operations_projection_submission_history_unbounded");
  }
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
  if (pending.length > HISTORY_LIMIT) {
    throw new Error("research_operations_projection_lifecycle_history_unbounded");
  }
  return pending
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at) ||
      left.event_kind.localeCompare(right.event_kind))
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
  if (source.terminalAdmissionConflict) {
    addReason(reasons, "admission_graph_conflict");
    addReason(reasons, "inactive_incomplete_graph");
    addReason(reasons, "terminal_admission_unavailable");
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
  return evaluationBaseHasRuntimeShape(evaluation) &&
    tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(evaluation);
}

function unsealedFailureEvaluationHasRuntimeShape(
  evaluation: TradingEvaluationResultRecord
): boolean {
  if (!hasExactKeys(evaluation, [
    "record_kind", "version", "trading_evaluation_result_id", "experiment_run_ref",
    "trading_evaluation_task_ref", "evaluator_ref", "result_status", "evidence_disposition",
    "score_summary", "metric_refs", "evaluator_trace_ref",
    ...(evaluation.disqualification_reason === undefined ? [] : ["disqualification_reason"]),
    ...(evaluation.quarantine_reason === undefined ? [] : ["quarantine_reason"]),
    "completed_at", "authority_status"
  ])) return false;
  return evaluationBaseHasRuntimeShape(evaluation) &&
    tradingEvaluationResultResearchPreflightLinkageHasRuntimeShape(evaluation);
}

function evaluationBaseHasRuntimeShape(
  evaluation: TradingEvaluationResultRecord
): boolean {
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
      exactRef(candidate, "metric_snapshot")) && refsAreUnique(evaluation.metric_refs) &&
    exactRef(evaluation.evaluator_trace_ref, "trace_placeholder") &&
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

function evaluationHasAuthorityLinkageShape(
  evaluation: TradingEvaluationResultRecord
): boolean {
  return evaluation?.record_kind === "trading_evaluation_result" &&
    evaluation.version === 1 &&
    safeIdentifier(evaluation.trading_evaluation_result_id) &&
    exactRef(evaluation.experiment_run_ref, "experiment_run") &&
    exactRef(evaluation.trading_evaluation_task_ref, "trading_evaluation_task") &&
    exactRef(evaluation.research_preflight_commitment_ref,
      "research_preflight_commitment") &&
    validDigest(evaluation.research_preflight_commitment_digest) &&
    exactRef(evaluation.submitted_system_code_ref, "system_code") &&
    validDigest(evaluation.submitted_artifact_digest) &&
    validDigest(evaluation.sealed_admission_suite_digest) &&
    evaluation.evaluation_phase === "sealed_admission" &&
    evaluation.submission_sequence === 1 &&
    Number.isInteger(evaluation.selected_development_submission_sequence) &&
    safeIsoTimestamp(evaluation.completed_at) &&
    ["accepted", "quarantined_for_review", "disqualified"].includes(
      evaluation.result_status
    ) && ["not_counted", "counted", "quarantined_for_review"].includes(
      evaluation.evidence_disposition
    ) && ["not_counted", "counted"].includes(evaluation.authority_status);
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
    finding.supporting_record_refs.length <= HISTORY_LIMIT &&
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
    lineage.source_finding_refs.length <= HISTORY_LIMIT &&
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
  left: Pick<
    ResearchSessionSummaryReadModel,
    "allocated_at" | "research_allocation_id" | "direction_kind"
  >,
  right: Pick<
    ResearchSessionSummaryReadModel,
    "allocated_at" | "research_allocation_id" | "direction_kind"
  >
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
      for (const admission of index.admissionsByCommitmentId.get(
        commitmentId
      ) ?? []) {
        addExactSystemCodeId(result, admission?.system_code_ref);
      }
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
    admissionsByCommitmentId: groupedIndex(
      graph.admissions,
      (admission) => admission?.research_preflight_commitment_ref?.id
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
    researchEvidenceRolesMatchSource(record) &&
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
