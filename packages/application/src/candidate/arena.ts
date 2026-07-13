import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ArtifactLineageRecord,
  CandidateAdmissionDecision,
  CandidateAdmissionDecisionRecord,
  CandidateArenaTickDirectionResultReadModel,
  CandidateArenaTickPaperTradingContinuationReadModel,
  CandidateArenaTickRecord,
  CandidateArenaTickReadModel,
  CandidateArenaTickSourceKind,
  CandidateArenaTickSourceReadModel,
  CandidateArenaTickStatus,
  CandidateArenaFindingClusterMarketRegime,
  CandidateArenaFindingClusterReadModel,
  CandidateArenaReadModel,
  CandidateArenaResearchAllocationMode,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaResearchAllocationSelection,
  CandidateArenaResearchEfficiencyReadModel,
  CandidateArenaResearchPreflightReadModel,
  CandidateArenaResearcherReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  ExperimentRunRecord,
  PaperTradingBoardBlockerDensityReadModel,
  PaperTradingBoardTrendReadModel,
  PaperTradingEvaluationRecord,
  PaperTradingMarketSnapshotSummary,
  PaperTradingObservationRecord,
  PaperTradingHandoffConformanceRecord,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingQualificationReason,
  PaperTradingQualificationStatus,
  Ref,
  ResearchDirectionRecord,
  ResearchBehaviorFingerprintRecord,
  ResearchDirectionKind,
  ResearchFindingRecord,
  ResearchPreflightCommitmentRecord,
  ResearchWorkerRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import {
  decideCandidateAdmission,
  deriveCandidateAdmissionResearchWorkerOutcome,
  paperTradingHandoffConformanceDigestInput,
  paperTradingComparisonResearchReleaseHasRuntimeShape
} from "@ouroboros/domain";
import {
  FIXTURE_CANDIDATE_ID,
  type OuroborosStorePort
} from "../ports/store";
import { safeId } from "../safe-id";
import {
  DEFAULT_ARENA_DIRECTIONS,
  CandidateArenaResearchAllocationService,
  candidateArenaAdaptiveDirectionFocus,
  candidateArenaResearchEfficiencyBudgetFocus,
  resolveCandidateArenaResearchAllocationPolicy,
  toCandidateArenaResearchAllocationReadModel
} from "./research-allocation";
import { buildResearchPopulationDiversity } from "./research-population-diversity";
import {
  buildResearchGeneralizationReadModel,
  ResearchGeneralizationReadModelError
} from "./research-generalization-read-model";
import {
  closeResearchWorkerCheckpoint,
  recoverIncompleteResearchWorkerCheckpoints,
  resolveResearchWorkerLifecycle
} from "./research-worker-lifecycle";
import { readTradingSystemManifest } from "../trading/research/artifact-runner";
import type { TradingArtifactRunner } from "../trading/research/artifact-runner";
import {
  assertSingleFileTradingArtifactClosure,
  sealSingleFileTradingArtifactClosure
} from "../trading/research/artifact-closure";
import { FixtureTradingResearchAgentAdapter } from "../trading/research/agent-adapters";
import { runTradingResearchLoop } from "../trading/research/run-trading-research";
import {
  buildResearchPreflightPlan,
  generateResearchPreflightEvaluatorSeed
} from "../trading/research/preflight-plan";
import {
  deriveResearchBehaviorFingerprint,
  ResearchBehaviorFingerprintUnavailableError
} from "../trading/research/behavior-fingerprint";
import type { ReplayTradingApiProviderFactory } from "../trading/research/replay-set-runner";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  TradingEvaluationResult,
  TradingResearchNotebookEntry,
  TradingResearchAgentAdapter,
  TradingSystemManifest
} from "../trading/research/types";
import type { TradingResearchRuntimeAgent } from "../trading/research/runtime-config";
import {
  paperTradingQualificationBlockerGroups,
  type PaperTradingQualificationBlockerGroup
} from "../trading/paper/qualification-blockers";
import { classifyPaperTradingFailure } from "../trading/paper/failures";
import { paperTradingLearningSummary } from "../trading/paper/learning";
import { paperTradingEvaluationCommitmentMatchesEvaluation } from "../trading/paper/commitment";
import {
  paperTradingEvidenceIntegrityReasons,
  qualifyPaperTradingEvaluation
} from "../trading/paper/qualification";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export { DEFAULT_ARENA_DIRECTIONS } from "./research-allocation";
export { recoverIncompleteResearchWorkerCheckpoints } from "./research-worker-lifecycle";

const ZERO_PROFIT_LOSS: TradingProfitLossReadModel = {
  revenue_usdt: 0,
  cost_usdt: 0,
  net_revenue_usdt: 0,
  net_return_pct: 0
};
const arenaStoreMutationQueues = new WeakMap<OuroborosStorePort, Promise<unknown>>();


type ArenaReleasedCampaignFinding = {
  release_id: string;
  candidate_id: string;
  direction_kind: ResearchDirectionKind;
  release_kind: PaperTradingComparisonResearchReleaseRecord["release_kind"];
  finding_kind: ResearchFindingRecord["finding_kind"];
  summary: string;
  next_research_focus: string;
  released_at: string;
  authority_status: "not_promotion_authority";
};

type PaperLoopLatencySummary = {
  expected_interval_ms: number;
  latest_observation_interval_ms?: number;
  latest_interval_lag_ms?: number;
  max_interval_lag_ms?: number;
  observed_interval_count: number;
  cadence_status: "on_cadence" | "lagging" | "insufficient_history";
  authority_status: "not_promotion_authority";
};

type ArenaDirectionRunOutcome =
  | {
      status: "created";
      candidate: CandidateInspectReadModel;
      admission: CandidateAdmissionDecisionRecord;
      conformance: PaperTradingHandoffConformanceRecord;
      research_efficiency: CandidateArenaResearchEfficiencyReadModel;
      research_preflight: CandidateArenaResearchPreflightReadModel;
    }
  | {
      status: "duplicate" | "quarantined";
      admission: CandidateAdmissionDecisionRecord;
      finding: ResearchFindingRecord;
      conformance?: PaperTradingHandoffConformanceRecord;
      research_efficiency: CandidateArenaResearchEfficiencyReadModel;
      research_preflight: CandidateArenaResearchPreflightReadModel;
    };

export interface RunCandidateArenaTickInput {
  store: OuroborosStorePort;
  sourceSystemId?: string;
  sourceCandidateVersionId?: string;
  directions?: ResearchDirectionKind[];
  researchAllocationMode?: Exclude<
    CandidateArenaResearchAllocationMode,
    "explicit"
  >;
  tickId?: string;
  now?: () => string;
  repoRoot?: string;
  sourceArtifactDir?: string;
  researchAgent: TradingResearchRuntimeAgent;
  agentFactory: (agent: TradingResearchRuntimeAgent) => TradingResearchAgentAdapter;
  artifactRunner?: TradingArtifactRunner;
  replayProviderFactory?: ReplayTradingApiProviderFactory;
}

export interface CandidateArenaTickOutcome {
  status: "completed";
  tick_id: string;
  created_candidate_count: number;
  created_candidate_ids: string[];
  arena: CandidateArenaReadModel;
}

export type CandidateArenaTickContinuation = (
  outcome: CandidateArenaTickOutcome
) =>
  | Promise<CandidateArenaTickPaperTradingContinuationReadModel | void>
  | CandidateArenaTickPaperTradingContinuationReadModel
  | void;

export class CandidateArenaRunner {
  private running = false;
  private tickCount = 0;
  private loopActive = false;
  private activeTick?: Promise<CandidateArenaTickOutcome>;
  private tickContinuation?: CandidateArenaTickContinuation;

  constructor(
    private input: Omit<RunCandidateArenaTickInput, "tickId">,
    private readonly intervalMs = 10_000
  ) {}

  status(): "running" | "stopped" {
    return this.running ? "running" : "stopped";
  }

  ticks(): number {
    return this.tickCount;
  }

  restoreTickCount(tickCount: number): void {
    this.tickCount = Math.max(this.tickCount, Math.max(0, Math.floor(tickCount)));
  }

  researchAgent(): TradingResearchRuntimeAgent {
    return this.input.researchAgent;
  }

  setResearchAgent(agent: TradingResearchRuntimeAgent): void {
    this.input = {
      ...this.input,
      researchAgent: agent
    };
  }

  setTickContinuation(continuation: CandidateArenaTickContinuation | undefined): void {
    this.tickContinuation = continuation;
  }

  start(): "started" | "already_running" {
    if (this.running) {
      return "already_running";
    }
    this.running = true;
    void this.tick().catch(() => undefined);
    this.loop();
    return "started";
  }

  stop(): "stopped" {
    this.running = false;
    this.tickContinuation = undefined;
    return "stopped";
  }

  async stopAndDrain(): Promise<"stopped"> {
    const status = this.stop();
    await this.activeTick?.catch(() => undefined);
    return status;
  }

  async tick(): Promise<CandidateArenaTickOutcome> {
    if (this.activeTick) {
      return this.activeTick;
    }
    this.tickCount += 1;
    this.activeTick = runCandidateArenaTick({
      ...this.input,
      tickId: `tick-${this.tickCount}`
    }, this.status(), this.tickCount)
      .then((outcome) => this.applyTickContinuation(outcome))
      .finally(() => {
        this.activeTick = undefined;
      });
    return this.activeTick;
  }

  private async applyTickContinuation(outcome: CandidateArenaTickOutcome): Promise<CandidateArenaTickOutcome> {
    const continuation = this.tickContinuation;
    if (!continuation || !this.running) {
      return outcome;
    }

    let continuationEvidence: CandidateArenaTickPaperTradingContinuationReadModel | undefined;
    try {
      continuationEvidence = (await continuation(outcome)) ?? undefined;
    } catch (error) {
      continuationEvidence = {
        status: "failed",
        command_kind: "trading_run.start",
        error: conciseError(error),
        authority_status: "not_live"
      };
    }

    if (!continuationEvidence) {
      return outcome;
    }

    try {
      await recordCandidateArenaTickPaperTradingContinuation(
        this.input.store,
        outcome.tick_id,
        continuationEvidence
      );
    } catch {
      return outcome;
    }

    return {
      ...outcome,
      arena: await buildCandidateArenaReadModel(this.input.store, this.status(), this.tickCount)
    };
  }

  private loop(): void {
    if (this.loopActive) {
      return;
    }
    this.loopActive = true;
    const schedule = () => {
      setTimeout(async () => {
        if (!this.running) {
          this.loopActive = false;
          return;
        }
        try {
          await this.tick();
        } finally {
          if (this.running) {
            schedule();
          } else {
            this.loopActive = false;
          }
        }
      }, this.intervalMs).unref();
    };
    schedule();
  }
}

export function candidateArenaRunnerTickCountFromTicks(
  ticks: Pick<CandidateArenaTickRecord, "tick_id">[]
): number {
  const highestNumericTickId = ticks.reduce((highest, tick) => {
    const match = /^tick-(\d+)$/.exec(tick.tick_id);
    if (!match) {
      return highest;
    }
    return Math.max(highest, Number(match[1] ?? 0));
  }, 0);
  return Math.max(ticks.length, highestNumericTickId);
}

export async function runCandidateArenaTick(
  input: RunCandidateArenaTickInput,
  runnerStatus: "running" | "stopped" = "stopped",
  tickCount = 0
): Promise<CandidateArenaTickOutcome> {
  const tickId = input.tickId ?? `tick-${Date.now()}`;
  const startedAt = candidateArenaNow(input.now);
  if (input.directions && input.researchAllocationMode) {
    throw new Error("candidate_arena_research_allocation_mode_conflict");
  }
  await withArenaStoreMutation(input.store, () =>
    recoverIncompleteResearchWorkerCheckpoints({
      store: input.store,
      recovered_at: startedAt
    })
  );
  const sourceSelection = await sourceCandidate(
    input.store,
    input.sourceSystemId,
    input.sourceCandidateVersionId
  );
  const priorArena = await buildCandidateArenaReadModel(
    input.store,
    "stopped",
    tickCount
  );
  const { allocationMode, allocationPolicyBasis } =
    await resolveCandidateArenaResearchAllocationPolicy({
      store: input.store,
      explicitDirections: input.directions,
      requestedAllocationMode: input.researchAllocationMode
    });
  const allocation = await withArenaStoreMutation(input.store, () =>
    new CandidateArenaResearchAllocationService({
      store: input.store,
      now: () => startedAt
    }).allocate({
      tickId,
      allocationMode,
      allocationPolicyBasis,
      explicitDirections: input.directions,
      findingClusters: priorArena.finding_clusters,
      latestTicks: priorArena.latest_ticks
    })
  );
  const selections = allocation.selected_directions;
  const createdCandidateIds: string[] = [];
  const directionResults: CandidateArenaTickDirectionResultReadModel[] = [];

  const settledDirections = await settleArenaSelections(
    selections,
    allocation.policy.concurrency_limit,
    async (selection) => ({
      selection,
      outcome: await runArenaDirection({
        ...input,
        source: sourceSelection.candidate,
        direction: selection.direction_kind,
        tickId,
        allocation,
        allocationSelection: selection
      })
    })
  );

  for (let index = 0; index < settledDirections.length; index += 1) {
    const direction = selections[index]!.direction_kind;
    const settled = settledDirections[index]!;
    if (settled.status === "fulfilled") {
      const directionOutcome = settled.value.outcome;
      if (directionOutcome.status === "created") {
        const created = directionOutcome.candidate;
        createdCandidateIds.push(created.candidate_id);
        const profitLoss = created.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS;
        directionResults.push({
          direction_kind: direction,
          status: "created",
          agent_provider: input.researchAgent,
          candidate_id: created.candidate_id,
          admission_decision_id:
            directionOutcome.admission.candidate_admission_decision_id,
          admission_reason: directionOutcome.admission.reason,
          paper_handoff_conformance:
            compactPaperHandoffConformance(directionOutcome.conformance),
          finding: findingSummaryForProfitLoss(
            profitLoss,
            created.full_cycle_lineage?.evidence?.evaluation_status
          ),
          net_revenue_usdt: profitLoss.net_revenue_usdt,
          research_efficiency: directionOutcome.research_efficiency,
          research_preflight: directionOutcome.research_preflight
        });
      } else {
        directionResults.push({
          direction_kind: direction,
          status: directionOutcome.status,
          agent_provider: input.researchAgent,
          finding: directionOutcome.finding.summary,
          admission_decision_id:
            directionOutcome.admission.candidate_admission_decision_id,
          admission_reason: directionOutcome.admission.reason,
          ...(directionOutcome.conformance
            ? {
                paper_handoff_conformance:
                  compactPaperHandoffConformance(directionOutcome.conformance)
              }
            : {}),
          research_efficiency: directionOutcome.research_efficiency,
          research_preflight: directionOutcome.research_preflight
        });
      }
    } else {
      const researchPreflight = await failedArenaResearchPreflightReadback(
        input.store,
        tickId,
        direction
      );
      directionResults.push({
        direction_kind: direction,
        status: "failed",
        agent_provider: input.researchAgent,
        error: conciseError(settled.reason),
        finding: `${directionLabel(direction)} researcher failed before candidate materialization.`,
        ...(researchPreflight ? { research_preflight: researchPreflight } : {})
      });
    }
  }

  await input.store.recordCandidateArenaTick(candidateArenaTickRecord({
    tickId,
    startedAt,
    completedAt: new Date().toISOString(),
    sourceCandidate: sourceSelection.source_candidate,
    createdCandidateIds,
    directionResults,
    allocation
  }));

  const arena = await buildCandidateArenaReadModel(input.store, runnerStatus, tickCount);
  return {
    status: "completed",
    tick_id: tickId,
    created_candidate_count: createdCandidateIds.length,
    created_candidate_ids: createdCandidateIds,
    arena
  };
}

async function settleArenaSelections<T>(
  selections: CandidateArenaResearchAllocationSelection[],
  concurrencyLimit: number,
  task: (selection: CandidateArenaResearchAllocationSelection) => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  const settled: PromiseSettledResult<T>[] = [];
  for (let index = 0; index < selections.length; index += concurrencyLimit) {
    settled.push(...await Promise.allSettled(
      selections.slice(index, index + concurrencyLimit).map(task)
    ));
  }
  return settled;
}

function candidateArenaNow(now: (() => string) | undefined): string {
  const value = now?.() ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error("candidate_arena_invalid_clock");
  }
  return value;
}

export async function buildCandidateArenaReadModel(
  store: OuroborosStorePort,
  runnerStatus: "running" | "stopped",
  tickCount: number,
  preloadedResearchReleases?: PaperTradingComparisonResearchReleaseRecord[]
): Promise<CandidateArenaReadModel> {
  const candidates = await Promise.all(
    (await store.listCandidates()).map((candidate) => store.getCandidate(candidate.candidate_id))
  );
  const tickRecords = await store.listCandidateArenaTicks();
  const latestTickRecords = [...tickRecords]
    .sort((left, right) =>
      right.completed_at.localeCompare(left.completed_at) ||
      right.tick_id.localeCompare(left.tick_id)
    )
    .slice(0, 10);
  const [
    directions,
    commitments,
    fingerprints,
    admissions,
    researchGeneralization
  ] = await Promise.all([
    typeof store.listResearchDirections === "function"
      ? store.listResearchDirections()
      : Promise.resolve([]),
    typeof store.listResearchPreflightCommitments === "function"
      ? store.listResearchPreflightCommitments()
      : Promise.resolve([]),
    typeof store.listResearchBehaviorFingerprints === "function"
      ? store.listResearchBehaviorFingerprints()
      : Promise.resolve([]),
    typeof store.listCandidateAdmissionDecisions === "function"
      ? store.listCandidateAdmissionDecisions()
      : Promise.resolve([]),
    arenaResearchGeneralization(store)
  ]);
  const allocationRecords = typeof store.listCandidateArenaResearchAllocations ===
      "function"
    ? await store.listCandidateArenaResearchAllocations()
    : [];
  const allocationsById = new Map(allocationRecords.map((allocation) => [
    allocation.candidate_arena_research_allocation_id,
    allocation
  ]));
  const latestTicks = latestTickRecords.map((tick) =>
    toCandidateArenaTickReadModel(
      tick,
      tick.research_allocation_ref
        ? allocationsById.get(tick.research_allocation_ref.id)
        : undefined
    )
  );
  const entries = candidates
    .filter((candidate): candidate is CandidateInspectReadModel => Boolean(candidate?.full_cycle_lineage?.evidence?.profit_loss))
    .map((candidate) => ({
      candidate,
      direction: candidate.full_cycle_lineage?.evidence?.direction_kind ?? "other",
      profitLoss: candidate.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS,
      status: evaluationStatus(candidate.full_cycle_lineage?.evidence?.evaluation_status)
    }))
    .sort((left, right) =>
      right.profitLoss.net_revenue_usdt - left.profitLoss.net_revenue_usdt ||
      right.profitLoss.net_return_pct - left.profitLoss.net_return_pct ||
      left.candidate.candidate_id.localeCompare(right.candidate.candidate_id)
    );

  const arena: CandidateArenaReadModel = {
    arena_kind: "candidate_arena",
    runner_status: runnerStatus,
    tick_count: tickCount,
    research_generalization: researchGeneralization,
    research_population_diversity: buildResearchPopulationDiversity({
      ticks: latestTickRecords,
      directions,
      commitments,
      fingerprints,
      admissions
    }),
    active_researchers: DEFAULT_ARENA_DIRECTIONS.map((direction) => arenaResearcher(direction, latestTicks)),
    leaderboard: entries.map((entry, index) => ({
      rank: index + 1,
      candidate_id: entry.candidate.candidate_id,
      display_name: entry.candidate.display_name,
      direction_kind: entry.direction,
      parent_candidate_id: entry.candidate.full_cycle_lineage?.source.trading_system_id,
      status: entry.status,
      profit_loss: entry.profitLoss,
      latest_finding: findingSummaryForProfitLoss(entry.profitLoss, entry.status),
      authority_status: "not_live"
    })),
    latest_candidates: entries.slice(0, 10).map((entry) => ({
      candidate_id: entry.candidate.candidate_id,
      display_name: entry.candidate.display_name,
      direction_kind: entry.direction,
      net_revenue_usdt: entry.profitLoss.net_revenue_usdt,
      authority_status: "not_live"
    })),
    latest_ticks: latestTicks,
    finding_clusters: [],
    live_disabled: true,
    authority_status: "not_live"
  };
  const researchReleases = preloadedResearchReleases ??
    await arenaPaperTradingComparisonResearchReleases(store);
  const paperEvidenceCandidates = await arenaPaperEvidenceCandidates(store, arena);
  const paperTradingBoard = arenaPaperTradingBoardContext(paperEvidenceCandidates);
  return {
    ...arena,
    finding_clusters: arenaFindingClusters(
      paperEvidenceCandidates,
      paperTradingBoard,
      researchReleases
    )
  };
}

async function arenaResearchGeneralization(
  store: OuroborosStorePort
): Promise<CandidateArenaReadModel["research_generalization"]> {
  const methods = [
    store.listResearchGeneralizationProtocols,
    store.listResearchControlStudies,
    store.listResearchControlStudyOutcomes,
    store.listResearchGeneralizationOutcomes
  ];
  const availableCount = methods.filter((method) =>
    typeof method === "function"
  ).length;
  if (availableCount === 0) {
    return buildResearchGeneralizationReadModel({
      protocols: [],
      studies: [],
      studyOutcomes: [],
      outcomes: []
    });
  }
  if (availableCount !== methods.length) {
    throw new ResearchGeneralizationReadModelError(
      "ResearchGeneralization store read methods must be available together."
    );
  }
  const [protocols, studies, studyOutcomes, outcomes] = await Promise.all([
    store.listResearchGeneralizationProtocols(),
    store.listResearchControlStudies(),
    store.listResearchControlStudyOutcomes(),
    store.listResearchGeneralizationOutcomes()
  ]);
  return buildResearchGeneralizationReadModel({
    protocols,
    studies,
    studyOutcomes,
    outcomes
  });
}

async function recordCandidateArenaTickPaperTradingContinuation(
  store: OuroborosStorePort,
  tickId: string,
  continuation: CandidateArenaTickPaperTradingContinuationReadModel
): Promise<void> {
  const tick = (await store.listCandidateArenaTicks())
    .find((entry) => entry.tick_id === tickId);
  if (!tick) {
    return;
  }
  await store.recordCandidateArenaTick({
    ...tick,
    paper_trading_continuation: continuation
  });
}

async function runArenaDirection(input: RunCandidateArenaTickInput & {
  source: CandidateInspectReadModel;
  direction: ResearchDirectionKind;
  tickId: string;
  allocation: CandidateArenaResearchAllocationRecord;
  allocationSelection: CandidateArenaResearchAllocationSelection;
}): Promise<ArenaDirectionRunOutcome> {
  const repoRoot = input.repoRoot ?? REPO_ROOT;
  const sessionId = `candidate-arena-${safeId(input.tickId)}-${safeId(input.direction)}`;
  const runRoot = path.join(input.store.root(), "candidate-arena-runs", sessionId);
  const seedDir = path.join(runRoot, "seed");
  const artifactSourceDir = input.sourceArtifactDir ??
    await resolveCandidateArenaSourceArtifactDir({
      store: input.store,
      source: input.source,
      repoRoot
    });
  await mkdir(runRoot, { recursive: true });
  await rm(seedDir, { recursive: true, force: true });
  await cp(artifactSourceDir, seedDir, { recursive: true });
  const sourceManifest = await readTradingSystemManifest(seedDir);
  assertCandidateArenaResearchManifest(sourceManifest);
  const sourceArtifact = await arenaEntrypointArtifact(seedDir, sourceManifest);
  const adapter = input.researchAgent === "fixture"
    ? new DirectionalFixtureTradingResearchAgentAdapter(input.direction)
    : input.agentFactory(input.researchAgent);
  const committedAt = candidateArenaNow(input.now);
  const preflight = await withArenaStoreMutation(input.store, async () => {
    const lifecycle = await resolveResearchWorkerLifecycle({
      store: input.store,
      direction_kind: input.direction,
      agent: adapter.agent,
      provider_kind: researchWorkerProviderKind(adapter.agent),
      candidate_arena_tick_id: input.tickId,
      created_at: committedAt
    });
    const sourceSystemCode = await recordArenaSourceSystemCode({
      store: input.store,
      source: input.source,
      artifact: sourceArtifact,
      sessionId,
      createdAt: committedAt
    });
    const plan = buildResearchPreflightPlan({
      candidate_arena_tick_id: input.tickId,
      research_direction_ref: ref(
        "research_direction",
        lifecycle.direction.research_direction_id
      ),
      research_worker_ref: ref(
        "research_worker",
        lifecycle.worker.research_worker_id
      ),
      research_allocation_ref: ref(
        "candidate_arena_research_allocation",
        input.allocation.candidate_arena_research_allocation_id
      ),
      research_allocation_digest: input.allocation.allocation_digest,
      source_system_code_ref: ref(
        "system_code",
        sourceSystemCode.system_code_id
      ),
      source_artifact_digest: sourceSystemCode.artifact_digest,
      development_submission_limit: input.allocationSelection.experiment_budget,
      committed_at: committedAt,
      evaluator_seed: generateResearchPreflightEvaluatorSeed()
    });
    await input.store.recordResearchPreflightCommitment(plan.commitment);
    return { ...lifecycle, sourceSystemCode, plan };
  });
  const closeCheckpoint = (failedReason: "execution_failed" | "restart_recovery") =>
    closeResearchWorkerCheckpoint({
      store: input.store,
      commitment: preflight.plan.commitment,
      direction: preflight.direction,
      worker: preflight.worker,
      notebook_path: preflight.notebook_path,
      failed_reason: failedReason,
      closed_at: new Date().toISOString()
    });
  try {
    const research = await runTradingResearchLoop({
      repo_root: repoRoot,
      artifact_source_dir: artifactSourceDir,
      run_root: runRoot,
      notebook_path: preflight.notebook_path,
      session_id: sessionId,
      iterations: input.allocationSelection.experiment_budget,
      agent_adapter: adapter,
      artifact_runner: input.artifactRunner,
      replay_provider_factory: input.replayProviderFactory,
      preflight_plan: preflight.plan,
      prior_checkpoint: preflight.prior_checkpoint,
      arena_context: await arenaContext(
        input.store,
        input.direction,
        input.allocation,
        input.allocationSelection
      )
    });
    const entry = [...research.entries].reverse().find((candidate) =>
      candidate.decision === "keep"
    ) ?? research.entries.at(-1);
    if (!entry) {
      throw new Error("candidate_arena_missing_research_entry");
    }
    const sealedAdmission = research.sealed_admission;
    const researchEfficiency = researchEfficiencySummary(
      research.entries,
      sealedAdmission
    );
    const researchPreflight = arenaResearchPreflightReadModel({
      commitment: preflight.plan.commitment,
      developmentSubmissionCount: research.entries.length,
      sealedAdmission
    });
    assertArenaResearchPreflightResult({
      commitment: preflight.plan.commitment,
      returnedCommitment: research.research_preflight_commitment,
      sealedAdmission
    });
    const artifactDir = research.submitted_artifact_dir ?? entry.artifact_dir;
    const manifest = await readTradingSystemManifest(artifactDir);
    assertCandidateArenaResearchManifest(manifest);
    await assertSingleFileTradingArtifactClosure(artifactDir, manifest);
    return await withArenaStoreMutation(input.store, async () => {
      const systemCode = await recordArenaSystemCode({
        store: input.store,
        artifactDir,
        sessionId,
        manifest,
        agent: adapter.agent
      });
      if (sealedAdmission && systemCode.artifact_digest !== sealedAdmission.artifact_digest) {
        throw new Error("candidate_arena_sealed_artifact_digest_mismatch");
      }
      const terminalEntry = sealedAdmission
        ? { ...entry, evaluation: sealedAdmission.evaluation }
        : entry;
      const researchRecords = await recordArenaResearchRecords({
        store: input.store,
        source: input.source,
        direction: input.direction,
        entry: terminalEntry,
        developmentEntry: entry,
        sourceSystemCode: preflight.sourceSystemCode,
        systemCode,
        sourceArtifactDigest: sourceArtifact.artifactDigest,
        sessionId,
        researchDirection: preflight.direction,
        researchWorker: preflight.worker,
        preflightCommitment: preflight.plan.commitment,
        sealedAdmission
      });
      if (!researchRecords.admission.runnable_paper_handoff) {
        await closeCheckpoint("execution_failed");
        return {
          status: researchRecords.admission.status === "duplicate"
            ? "duplicate"
            : "quarantined",
          admission: researchRecords.admission,
          finding: researchRecords.finding,
          conformance: researchRecords.conformance,
          research_efficiency: researchEfficiency,
          research_preflight: researchPreflight
        };
      }
      if (!researchRecords.conformance ||
        !sealedAdmission ||
        researchRecords.conformance.status !== "passed" ||
        !researchRecords.conformance.runnable_paper_handoff ||
        researchRecords.admission.paper_trading_handoff_conformance_ref?.id !==
          researchRecords.conformance.paper_trading_handoff_conformance_id ||
        researchRecords.admission.paper_trading_handoff_conformance_digest !==
          researchRecords.conformance.evidence_digest) {
        throw new Error("candidate_arena_paper_handoff_conformance_binding_invalid");
      }
      const materialized = await input.store.materializeCandidate(arenaMaterializationInput({
        source: input.source,
        sourceSystemCodeRef: ref(
          "system_code",
          preflight.sourceSystemCode.system_code_id
        ),
        systemCode,
        evaluation: entry.evaluation,
        direction: input.direction,
        agent: adapter.agent,
        sessionId
      }));
      if (materialized.status !== "materialized") {
        throw new Error("candidate_arena_materialization_failed");
      }

      const candidate = await input.store.getCandidate(materialized.candidate.candidate_id);
      if (!candidate) {
        throw new Error("candidate_arena_projection_failed");
      }
      await closeCheckpoint("execution_failed");
      return {
        status: "created",
        candidate,
        admission: researchRecords.admission,
        conformance: researchRecords.conformance,
        research_efficiency: researchEfficiency,
        research_preflight: researchPreflight
      };
    });
  } catch (error) {
    await withArenaStoreMutation(input.store, () =>
      closeCheckpoint("execution_failed")
    );
    throw error;
  }
}

async function withArenaStoreMutation<T>(store: OuroborosStorePort, task: () => Promise<T>): Promise<T> {
  const previous = arenaStoreMutationQueues.get(store) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  arenaStoreMutationQueues.set(store, current.catch(() => undefined));
  return current;
}

function researchWorkerProviderKind(
  agent: ManagedResearchAgent
): NonNullable<ResearchWorkerRecord["provider_kind"]> {
  if (agent.provider === "codex") return "codex_cli";
  if (agent.provider === "claude_code") return "claude_code";
  return "fixture_only";
}

function assertArenaResearchPreflightResult(input: {
  commitment: ResearchPreflightCommitmentRecord;
  returnedCommitment: ResearchPreflightCommitmentRecord;
  sealedAdmission: Awaited<ReturnType<typeof runTradingResearchLoop>>["sealed_admission"];
}): void {
  if (input.returnedCommitment.research_preflight_commitment_id !==
      input.commitment.research_preflight_commitment_id ||
    input.returnedCommitment.commitment_digest !== input.commitment.commitment_digest) {
    throw new Error("candidate_arena_research_preflight_commitment_mismatch");
  }
  if (!input.sealedAdmission) return;
  if (input.sealedAdmission.commitment_id !==
      input.commitment.research_preflight_commitment_id ||
    input.sealedAdmission.commitment_digest !== input.commitment.commitment_digest ||
    input.sealedAdmission.suite_digest !==
      input.commitment.sealed_admission_policy.suite_digest ||
    input.sealedAdmission.submission_sequence !== 1) {
    throw new Error("candidate_arena_sealed_admission_binding_mismatch");
  }
}

function arenaResearchPreflightReadModel(input: {
  commitment: ResearchPreflightCommitmentRecord;
  developmentSubmissionCount: number;
  sealedAdmission: Awaited<ReturnType<typeof runTradingResearchLoop>>["sealed_admission"];
}): CandidateArenaResearchPreflightReadModel {
  const status = input.sealedAdmission?.evaluation.status;
  return {
    commitment_id: input.commitment.research_preflight_commitment_id,
    development_submission_count: input.developmentSubmissionCount,
    sealed_terminal_status: status === "accepted"
      ? "accepted"
      : status === "disqualified" ? "rejected" : "not_run",
    reason: status === "accepted"
      ? "accepted"
      : status === "disqualified"
        ? "candidate_rejected"
        : "no_development_winner",
    authority_status: "not_promotion_authority"
  };
}

async function failedArenaResearchPreflightReadback(
  store: OuroborosStorePort,
  tickId: string,
  direction: ResearchDirectionKind
): Promise<CandidateArenaResearchPreflightReadModel | undefined> {
  const commitments = await store.listResearchPreflightCommitments();
  for (const commitment of commitments) {
    if (commitment.candidate_arena_tick_id !== tickId) continue;
    const persistedDirection = await store.getResearchDirection(
      commitment.research_direction_ref.id
    );
    if (persistedDirection?.direction_kind === direction) {
      const checkpoint = (await store.listResearchWorkerCheckpoints())
        .find((candidate) =>
          candidate.research_preflight_commitment_ref.id ===
            commitment.research_preflight_commitment_id
        );
      return {
        commitment_id: commitment.research_preflight_commitment_id,
        development_submission_count:
          checkpoint?.development_budget.recorded_submission_count ??
          await failedArenaDevelopmentSubmissionCount(store, tickId, direction),
        sealed_terminal_status: "not_run",
        reason: "execution_failed",
        authority_status: "not_promotion_authority"
      };
    }
  }
  return undefined;
}

async function failedArenaDevelopmentSubmissionCount(
  store: OuroborosStorePort,
  tickId: string,
  direction: ResearchDirectionKind
): Promise<number> {
  const sessionId = `candidate-arena-${safeId(tickId)}-${safeId(direction)}`;
  try {
    const notebook = JSON.parse(await readFile(path.join(
      store.root(),
      "candidate-arena-runs",
      sessionId,
      "notebook.json"
    ), "utf8")) as { entries?: unknown };
    return Array.isArray(notebook.entries)
      ? Math.min(notebook.entries.length, 2)
      : 0;
  } catch {
    return 0;
  }
}

class DirectionalFixtureTradingResearchAgentAdapter extends FixtureTradingResearchAgentAdapter {
  override readonly agent: ManagedResearchAgent;

  constructor(private readonly direction: ResearchDirectionKind) {
    super();
    this.agent = {
      id: `managed-agent-fixture-arena-${safeId(direction)}`,
      provider: "fixture",
      model: `scripted-arena-${direction}`,
      permission_policy: "fixture_only"
    };
  }

  override async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    await writeFile(runPath, editForDirection(source, this.direction), "utf8");
    return {
      status: "edited",
      summary: `Fixture arena researcher generated a ${this.direction} candidate.`,
      changed_paths: ["run.py"]
    };
  }
}

function editForDirection(source: string, direction: ResearchDirectionKind): string {
  let next = source;
  const directionDeclaration = `ARENA_RESEARCH_DIRECTION = "${direction}"`;
  next = /^ARENA_RESEARCH_DIRECTION = ".*"$/m.test(next)
    ? next.replace(/^ARENA_RESEARCH_DIRECTION = ".*"$/m, directionDeclaration)
    : `${next.trimEnd()}\n\n${directionDeclaration}\n`;
  const risk = direction === "volatility_regime" ? "0.005" : "0.02";
  next = next.replace(/RISK_FRACTION = [0-9.]+/, `RISK_FRACTION = ${risk}`);
  if (direction === "mean_reversion") {
    next = next.replace(/"side": "buy"/, `"side": "sell"`);
    next = next.replace(
      /"reason": "fast average is above slow average with bounded account risk"/,
      `"reason": "mean reversion candidate shorts the long trend replay with bounded risk"`
    );
  }
  if (direction === "funding_aware_risk") {
    next = next.replace(
      /if market\["moving_average_fast"\] <= market\["moving_average_slow"\]:/,
      `if True:`
    );
    next = next.replace(
      /"reason": "fast average is not above slow average"/,
      `"reason": "funding-aware candidate holds until net carry clears cost"`
    );
  }
  return next;
}

async function sourceCandidate(
  store: OuroborosStorePort,
  sourceSystemId?: string,
  sourceCandidateVersionId?: string
): Promise<{
  candidate: CandidateInspectReadModel;
  source_candidate: CandidateArenaTickSourceReadModel;
}> {
  if (!sourceSystemId && !sourceCandidateVersionId) {
    const latestPaperEvaluations = await latestPaperTradingEvaluationsByCandidate(store);
    const paperLeader = await latestPaperTradingEvaluationLeader(store, latestPaperEvaluations);
    if (paperLeader) {
      return {
        candidate: paperLeader.candidate,
        source_candidate: candidateArenaTickSource(
          paperLeader.candidate,
          "paper_trading_evaluation_leader",
          paperLeader.evaluation.latest_score
        )
      };
    }
    const leader = await latestEvaluatedArenaLeader(
      store,
      await ineligibleLatestPaperEvaluationCandidateIds(store, latestPaperEvaluations)
    );
    if (leader) {
      return {
        candidate: leader,
        source_candidate: candidateArenaTickSource(leader, "evaluated_arena_leader")
      };
    }
  }
  const sourceCandidateId = sourceSystemId ?? FIXTURE_CANDIDATE_ID;
  const source = await store.getCandidate(sourceCandidateId);
  if (!source) {
    throw new Error("candidate_arena_source_not_found");
  }
  if (sourceCandidateVersionId && source.candidate_version.candidate_version_id !== sourceCandidateVersionId) {
    throw new Error("candidate_arena_source_version_mismatch");
  }
  return {
    candidate: source,
    source_candidate: candidateArenaTickSource(
      source,
      sourceSystemId || sourceCandidateVersionId ? "explicit_candidate" : "fixture_seed"
    )
  };
}

function candidateArenaTickSource(
  candidate: CandidateInspectReadModel,
  sourceKind: CandidateArenaTickSourceKind,
  sourceProfitLoss?: TradingProfitLossReadModel
): CandidateArenaTickSourceReadModel {
  const profitLoss = sourceProfitLoss ?? candidate.full_cycle_lineage?.evidence?.profit_loss;
  return {
    source_kind: sourceKind,
    candidate_id: candidate.candidate_id,
    display_name: candidate.display_name,
    ...(profitLoss ? { net_revenue_usdt: profitLoss.net_revenue_usdt } : {}),
    authority_status: "not_live"
  };
}

async function latestPaperTradingEvaluationLeader(
  store: OuroborosStorePort,
  latestEvaluationByCandidate?: Map<string, PaperTradingEvaluationRecord>
): Promise<{ candidate: CandidateInspectReadModel; evaluation: PaperTradingEvaluationRecord } | undefined> {
  const latestEvaluations = latestEvaluationByCandidate ?? await latestPaperTradingEvaluationsByCandidate(store);
  const candidates = await Promise.all(
    [...latestEvaluations.values()]
      .filter(isEligiblePaperTradingEvaluationSource)
      .map(async (evaluation) => {
        const released = await releasedResearchFeedbackEvidence(store, evaluation);
        return released
          ? {
              evaluation,
              candidate: await store.getCandidate(evaluation.candidate_ref.id)
            }
          : undefined;
      })
  );
  return candidates
    .filter((entry): entry is {
      candidate: CandidateInspectReadModel;
      evaluation: PaperTradingEvaluationRecord;
    } => {
      if (!entry?.candidate?.system_code?.ref) {
        return false;
      }
      return entry.candidate.candidate_version.candidate_version_id ===
        entry.evaluation.candidate_version_ref.id;
    })
    .sort((left, right) =>
      right.evaluation.latest_score.net_revenue_usdt - left.evaluation.latest_score.net_revenue_usdt ||
      right.evaluation.latest_score.net_return_pct - left.evaluation.latest_score.net_return_pct ||
      right.evaluation.observation_count - left.evaluation.observation_count ||
      left.evaluation.candidate_ref.id.localeCompare(right.evaluation.candidate_ref.id) ||
      left.evaluation.paper_trading_evaluation_id.localeCompare(right.evaluation.paper_trading_evaluation_id)
    )[0];
}

async function latestPaperTradingEvaluationsByCandidate(
  store: OuroborosStorePort
): Promise<Map<string, PaperTradingEvaluationRecord>> {
  const latestEvaluationByCandidate = new Map<string, PaperTradingEvaluationRecord>();
  for (const evaluation of await store.listPaperTradingEvaluations()) {
    const previous = latestEvaluationByCandidate.get(evaluation.candidate_ref.id);
    if (!previous || comparePaperTradingEvaluationRecency(previous, evaluation) <= 0) {
      latestEvaluationByCandidate.set(evaluation.candidate_ref.id, evaluation);
    }
  }
  return latestEvaluationByCandidate;
}

function isEligiblePaperTradingEvaluationSource(evaluation: PaperTradingEvaluationRecord): boolean {
  return (evaluation.status === "running" || evaluation.status === "stopped") &&
    evaluation.observation_count > 0 &&
    !evaluation.latest_failure_reason;
}

async function ineligibleLatestPaperEvaluationCandidateIds(
  store: OuroborosStorePort,
  latestEvaluationByCandidate: Map<string, PaperTradingEvaluationRecord>
): Promise<Set<string>> {
  const eligibility = await Promise.all(
    [...latestEvaluationByCandidate.values()].map(async (evaluation) => ({
      candidateId: evaluation.candidate_ref.id,
      eligible: isEligiblePaperTradingEvaluationSource(evaluation) &&
        Boolean(await releasedResearchFeedbackEvidence(store, evaluation))
    }))
  );
  return new Set(eligibility
    .filter((entry) => !entry.eligible)
    .map((entry) => entry.candidateId));
}

function comparePaperTradingEvaluationRecency(
  left: PaperTradingEvaluationRecord,
  right: PaperTradingEvaluationRecord
): number {
  return left.started_at.localeCompare(right.started_at) ||
    left.paper_trading_evaluation_id.localeCompare(right.paper_trading_evaluation_id);
}

async function latestEvaluatedArenaLeader(
  store: OuroborosStorePort,
  excludedCandidateIds: Set<string> = new Set()
): Promise<CandidateInspectReadModel | undefined> {
  const candidates = await Promise.all(
    (await store.listCandidates()).map((candidate) => store.getCandidate(candidate.candidate_id))
  );
  return candidates
    .filter((candidate): candidate is CandidateInspectReadModel => {
      if (!candidate) {
        return false;
      }
      return Boolean(candidate.system_code?.ref && candidate.full_cycle_lineage?.evidence?.profit_loss) &&
        !excludedCandidateIds.has(candidate.candidate_id);
    })
    .sort((left, right) => {
      const leftProfitLoss = left.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS;
      const rightProfitLoss = right.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS;
      return rightProfitLoss.net_revenue_usdt - leftProfitLoss.net_revenue_usdt ||
        rightProfitLoss.net_return_pct - leftProfitLoss.net_return_pct ||
        left.candidate_id.localeCompare(right.candidate_id);
    })[0];
}

export async function resolveCandidateArenaSourceArtifactDir(input: {
  store: OuroborosStorePort;
  source: CandidateInspectReadModel;
  repoRoot: string;
}): Promise<string> {
  const systemCodeRef = input.source.system_code?.ref;
  if (!systemCodeRef) {
    throw new Error("candidate_arena_missing_source_system_code");
  }
  const systemCode = await input.store.getSystemCode(systemCodeRef.id);
  if (!systemCode || systemCode.artifact_kind !== "python_file") {
    throw new Error("candidate_arena_source_system_code_not_python");
  }
  const artifactPath = path.isAbsolute(systemCode.artifact_path)
    ? systemCode.artifact_path
    : path.join(input.repoRoot, systemCode.artifact_path);
  const artifactStat = await stat(artifactPath).catch(() => undefined);
  if (!artifactStat) {
    throw new Error("candidate_arena_source_artifact_not_found");
  }
  if (artifactStat.isDirectory()) {
    return artifactPath;
  }
  const artifactDir = path.dirname(artifactPath);
  if (systemCode.artifact_path === "fixtures/trading-systems/clock.py") {
    return path.join(input.repoRoot, "artifacts/trading-system");
  }
  return artifactDir;
}

async function recordArenaSystemCode(input: {
  store: OuroborosStorePort;
  artifactDir: string;
  sessionId: string;
  manifest: TradingSystemManifest;
  agent: ManagedResearchAgent;
}): Promise<SystemCodeRecord & { artifact_kind: "python_file" }> {
  const artifact = await arenaEntrypointArtifact(input.artifactDir, input.manifest);
  return input.store.recordSystemCode({
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-arena-${safeId(input.sessionId)}-${artifact.digest.slice(0, 12)}`,
    artifact_kind: "python_file",
    artifact_path: artifact.artifactPath,
    artifact_digest: artifact.artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", artifact.artifactPath],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "candidate-arena-paper-system-code" },
    provenance_refs: [
      { record_kind: "agent_run", id: `agent-run-${safeId(input.sessionId)}` },
      { record_kind: "trace_placeholder", id: `trace-${safeId(input.sessionId)}` }
    ],
    status: "registered",
    created_at: new Date().toISOString(),
    authority_status: "not_live"
  }) as Promise<SystemCodeRecord & { artifact_kind: "python_file" }>;
}

function assertCandidateArenaResearchManifest(
  manifest: unknown
): asserts manifest is TradingSystemManifest {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("candidate_arena_research_manifest_invalid");
  }
  const candidate = manifest as Partial<TradingSystemManifest>;
  const entrypoint = candidate.entrypoint;
  const editablePaths = candidate.editable_paths;
  if (typeof candidate.id !== "string" || candidate.id.length === 0 ||
    typeof candidate.name !== "string" || candidate.name.length === 0 ||
    !Array.isArray(entrypoint) || entrypoint.length !== 2 ||
    !entrypoint.every((part) => typeof part === "string") ||
    (entrypoint[0] !== "python" && entrypoint[0] !== "python3") ||
    !Array.isArray(editablePaths) ||
    !editablePaths.every((editablePath) => typeof editablePath === "string") ||
    candidate.api_contract !== "trading_api_provider_v1") {
    throw new Error("candidate_arena_research_manifest_invalid");
  }
  const entrypointPath = entrypoint[1]!;
  const normalizedEntrypointPath = path.normalize(entrypointPath);
  if (path.isAbsolute(entrypointPath) ||
    normalizedEntrypointPath === ".." ||
    normalizedEntrypointPath.startsWith(`..${path.sep}`)) {
    throw new Error("candidate_arena_entrypoint_escapes_artifact_dir");
  }
  if (!entrypointPath || editablePaths.length !== 1 || editablePaths[0] !== entrypointPath) {
    throw new Error("candidate_arena_research_manifest_invalid");
  }
}

async function recordArenaSourceSystemCode(input: {
  store: OuroborosStorePort;
  source: CandidateInspectReadModel;
  artifact: Awaited<ReturnType<typeof arenaEntrypointArtifact>>;
  sessionId: string;
  createdAt: string;
}): Promise<SystemCodeRecord & { artifact_kind: "python_file" }> {
  return input.store.recordSystemCode({
    record_kind: "system_code",
    version: 1,
    system_code_id: [
      "system-code-arena-source",
      safeId(input.sessionId),
      input.artifact.digest.slice(0, 12)
    ].join("-"),
    artifact_kind: "python_file",
    artifact_path: input.artifact.artifactPath,
    artifact_digest: input.artifact.artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", input.artifact.artifactPath],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-research-source"
    },
    provenance_refs: input.source.system_code?.ref ? [input.source.system_code.ref] : [],
    status: "registered",
    created_at: input.createdAt,
    authority_status: "not_live"
  }) as Promise<SystemCodeRecord & { artifact_kind: "python_file" }>;
}

async function arenaEntrypointArtifact(
  artifactDir: string,
  manifest: TradingSystemManifest
): Promise<{
  artifactPath: string;
  artifactDigest: string;
  digest: string;
}> {
  const sealed = await sealSingleFileTradingArtifactClosure(artifactDir, manifest);
  const artifactPath = path.resolve(artifactDir, sealed.entrypoint_relative_path);
  const digest = sealed.closure_digest.slice("sha256:".length);
  return {
    artifactPath,
    artifactDigest: sealed.closure_digest,
    digest
  };
}

function arenaMaterializationInput(input: {
  source: CandidateInspectReadModel;
  sourceSystemCodeRef?: Ref;
  systemCode: SystemCodeRecord;
  evaluation: TradingEvaluationResult;
  direction: ResearchDirectionKind;
  agent: ManagedResearchAgent;
  sessionId: string;
}): CandidateMaterializationInput {
  const suffix = safeId(input.sessionId);
  return {
    idempotency_key: [
      "candidate-arena-materialize",
      input.source.candidate_id,
      input.source.candidate_version.candidate_version_id,
      input.direction,
      suffix
    ].join(":"),
    provider: {
      provider_kind: input.agent.provider === "codex" ? "codex_cli" : "fixture_only",
      model: input.agent.model ?? input.agent.provider,
      invocation_surface: "candidate_arena",
      agent_run_id: `agent-run-${suffix}`,
      agent_event_id: `agent-event-${suffix}`,
      trace_id: `trace-${suffix}`,
      output_artifact_hash: input.systemCode.artifact_digest
    },
    candidate: {
      title: `Arena ${directionLabel(input.direction)} BTCUSDT Trading System`,
      system_summary: `${input.direction} candidate generated inside the Candidate Arena and ranked by net revenue after costs.`,
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: `BTCUSDT paper TradingSystem candidate for ${input.direction}.`,
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Arena-generated Python SystemCode using the TradingApiProvider boundary.",
      declared_runtime: "python",
      declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    capability_package: {
      summary: "Backtest and paper-only capability package for Candidate Arena SystemCode.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["external_trading_api_provider"],
      forbidden_contents: ["raw_secret_material", "live_order_submission", "private_account_read"]
    },
    artifact_refs: [{ record_kind: "system_code", id: input.systemCode.system_code_id }],
    system_code_ref: { record_kind: "system_code", id: input.systemCode.system_code_id },
    full_cycle_lineage: {
      source: {
        trading_system_id: input.source.candidate_id,
        candidate_version_id: input.source.candidate_version.candidate_version_id,
        system_code_ref: input.sourceSystemCodeRef
      },
      generated: {
        system_code_ref: { record_kind: "system_code", id: input.systemCode.system_code_id },
        artifact_digest: input.systemCode.artifact_digest,
        generated_by_agent: true
      },
      evaluation: {
        status: input.evaluation.status,
        score: input.evaluation.score,
        profit_loss: input.evaluation.profit_loss,
        direction_kind: input.direction
      }
    }
  };
}

async function recordArenaResearchRecords(input: {
  store: OuroborosStorePort;
  source: CandidateInspectReadModel;
  direction: ResearchDirectionKind;
  entry: TradingResearchNotebookEntry;
  developmentEntry: TradingResearchNotebookEntry;
  sourceSystemCode: SystemCodeRecord;
  systemCode: SystemCodeRecord;
  sourceArtifactDigest: string;
  sessionId: string;
  researchDirection: ResearchDirectionRecord;
  researchWorker: ResearchWorkerRecord;
  preflightCommitment: ResearchPreflightCommitmentRecord;
  sealedAdmission: Awaited<ReturnType<typeof runTradingResearchLoop>>["sealed_admission"];
}): Promise<{
  admission: CandidateAdmissionDecisionRecord;
  conformance?: PaperTradingHandoffConformanceRecord;
  finding: ResearchFindingRecord;
  result: TradingEvaluationResultRecord;
}> {
  const suffix = safeId(input.sessionId);
  const now = new Date(Math.max(
    Date.now(),
    Date.parse(input.preflightCommitment.committed_at)
  )).toISOString();
  const behaviorComparison = await arenaResearchBehaviorComparison({
    store: input.store,
    developmentEntry: input.developmentEntry,
    preflightCommitment: input.preflightCommitment,
    systemCode: input.systemCode,
    createdAt: now
  });
  const evaluation = input.entry.evaluation;
  const experimentStatus = input.entry.agent_status === "failed" || input.entry.decision === "crash"
    ? "failed" as const
    : "evaluated" as const;
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-run-${suffix}`,
    research_worker_ref: ref(
      "research_worker",
      input.researchWorker.research_worker_id
    ),
    research_direction_ref: ref(
      "research_direction",
      input.researchDirection.research_direction_id
    ),
    system_code_ref: ref("system_code", input.systemCode.system_code_id),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "candidate-arena-revenue-cost-v1"),
    trace_ref: ref("trace_placeholder", `trace-${suffix}`),
    submitted_at: input.entry.started_at,
    status: experimentStatus,
    authority_status: "not_live"
  };
  await input.store.recordExperimentRun(experiment);

  const conformance = arenaPaperHandoffConformance({
    entry: input.entry,
    experiment,
    systemCode: input.systemCode,
    suffix
  });
  if (input.entry.evaluation.status === "accepted" && !conformance) {
    throw new Error("candidate_arena_missing_paper_handoff_conformance");
  }

  const metricRefs = evaluation.metrics.map((metric) =>
    ref("metric_snapshot", `metric-${suffix}-${safeId(metric.name)}`)
  );
  const resultStatus = evaluation.status === "accepted" ? "accepted" as const : "disqualified" as const;
  const result: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `trading-evaluation-result-${suffix}`,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    evaluator_ref: ref("external_evaluator", "candidate-arena-revenue-cost-evaluator-v1"),
    result_status: resultStatus,
    evidence_disposition: resultStatus === "accepted"
      ? "not_counted"
      : "quarantined_for_review",
    score_summary: {
      total_score: evaluation.score,
      oos_score: evaluation.score,
      drawdown_score: evaluation.profit_loss.net_revenue_usdt >= 0 ? 1 : 0,
      turnover_score: 1,
      cost_survival_score: evaluation.profit_loss.net_revenue_usdt >= 0 ? 1 : 0,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: metricRefs,
    evaluator_trace_ref: ref("trace_placeholder", `trace-evaluator-${suffix}`),
    ...(input.sealedAdmission
      ? {
          research_preflight_commitment_ref: ref(
            "research_preflight_commitment",
            input.preflightCommitment.research_preflight_commitment_id
          ),
          research_preflight_commitment_digest:
            input.preflightCommitment.commitment_digest,
          submitted_system_code_ref: ref(
            "system_code",
            input.systemCode.system_code_id
          ),
          submitted_artifact_digest: input.systemCode.artifact_digest,
          sealed_admission_suite_digest:
            input.preflightCommitment.sealed_admission_policy.suite_digest,
          evaluation_phase: "sealed_admission" as const,
          submission_sequence: 1 as const
        }
      : {}),
    ...(resultStatus === "accepted"
      ? {}
      : { disqualification_reason: arenaDisqualificationReason(input.entry) }),
    completed_at: now,
    authority_status: "not_counted"
  };
  await input.store.recordTradingEvaluationResult(result);
  if (conformance) {
    await input.store.recordPaperTradingHandoffConformance(conformance);
  }

  const admissionInput = {
    research_worker_outcome: deriveCandidateAdmissionResearchWorkerOutcome({
      research_worker_failed: input.entry.agent_status === "failed",
      source_artifact_digest: input.sourceArtifactDigest,
      submitted_artifact_digest: input.systemCode.artifact_digest
    }),
    experiment_status: experimentStatus,
    evaluation_status: result.result_status,
    evidence_disposition: result.evidence_disposition,
    ...(conformance
      ? { paper_handoff_conformance_status: conformance.status }
      : {}),
    behavior_comparison_status: behaviorComparison.status
  } as const;
  const decision = decideCandidateAdmission(admissionInput);
  const findingContent = arenaFindingForAdmission(input.entry, decision);

  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `research-finding-${suffix}`,
    research_worker_ref: experiment.research_worker_ref,
    research_direction_ref: experiment.research_direction_ref,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref("trading_evaluation_result", result.trading_evaluation_result_id),
    finding_kind: findingContent.finding_kind,
    summary: findingContent.summary,
    supporting_record_refs: [
      ref("trading_evaluation_result", result.trading_evaluation_result_id),
      ...(conformance
        ? [ref(
            "paper_trading_handoff_conformance",
            conformance.paper_trading_handoff_conformance_id
          )]
        : []),
      ...metricRefs,
      ...(behaviorComparison.fingerprint
        ? [ref(
            "research_behavior_fingerprint",
            behaviorComparison.fingerprint.research_behavior_fingerprint_id
          )]
        : []),
      ...(behaviorComparison.matchingFingerprint
        ? [ref(
            "research_behavior_fingerprint",
            behaviorComparison.matchingFingerprint.research_behavior_fingerprint_id
          )]
        : [])
    ],
    created_at: now,
    authority_status: "research_trace_only"
  };
  await input.store.recordResearchFinding(finding);

  const lineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: `artifact-lineage-${suffix}`,
    child_system_code_ref: ref("system_code", input.systemCode.system_code_id),
    parent_system_code_ref: ref(
      "system_code",
      input.sourceSystemCode.system_code_id
    ),
    source_finding_refs: [ref("research_finding", finding.research_finding_id)],
    created_by_research_worker_ref: experiment.research_worker_ref,
    created_at: now,
    authority_status: "lineage_only"
  };
  await input.store.recordArtifactLineage(lineage);

  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `candidate-admission-decision-${suffix}`,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      input.preflightCommitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest:
      input.preflightCommitment.commitment_digest,
    source_system_code_ref: ref("system_code", input.sourceSystemCode.system_code_id),
    system_code_ref: ref("system_code", input.systemCode.system_code_id),
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      result.trading_evaluation_result_id
    ),
    research_finding_ref: ref("research_finding", finding.research_finding_id),
    source_artifact_digest: input.sourceArtifactDigest,
    submitted_artifact_digest: input.systemCode.artifact_digest,
    ...(conformance
      ? {
          paper_trading_handoff_conformance_ref: ref(
            "paper_trading_handoff_conformance",
            conformance.paper_trading_handoff_conformance_id
          ),
          paper_trading_handoff_conformance_digest: conformance.evidence_digest
        }
      : {}),
    ...(behaviorComparison.fingerprint
      ? {
          research_behavior_fingerprint_ref: ref(
            "research_behavior_fingerprint",
            behaviorComparison.fingerprint.research_behavior_fingerprint_id
          ),
          research_behavior_fingerprint_digest:
            behaviorComparison.fingerprint.fingerprint_digest
        }
      : {}),
    ...(behaviorComparison.matchingFingerprint
      ? {
          matching_research_behavior_fingerprint_ref: ref(
            "research_behavior_fingerprint",
            behaviorComparison.matchingFingerprint.research_behavior_fingerprint_id
          ),
          matching_research_behavior_fingerprint_digest:
            behaviorComparison.matchingFingerprint.fingerprint_digest
        }
      : {}),
    ...admissionInput,
    ...decision,
    decided_at: now
  };
  await input.store.recordCandidateAdmissionDecision(admission);
  return { admission, conformance, finding, result };
}

type ArenaResearchBehaviorComparison =
  | {
      status: "distinct";
      fingerprint: ResearchBehaviorFingerprintRecord;
      matchingFingerprint?: undefined;
    }
  | {
      status: "duplicate";
      fingerprint: ResearchBehaviorFingerprintRecord;
      matchingFingerprint: ResearchBehaviorFingerprintRecord;
    }
  | {
      status: "unavailable";
      fingerprint?: undefined;
      matchingFingerprint?: undefined;
    };

async function arenaResearchBehaviorComparison(input: {
  store: OuroborosStorePort;
  developmentEntry: TradingResearchNotebookEntry;
  preflightCommitment: ResearchPreflightCommitmentRecord;
  systemCode: SystemCodeRecord;
  createdAt: string;
}): Promise<ArenaResearchBehaviorComparison> {
  let fingerprint: ResearchBehaviorFingerprintRecord;
  try {
    fingerprint = deriveResearchBehaviorFingerprint({
      commitment: input.preflightCommitment,
      system_code_ref: ref("system_code", input.systemCode.system_code_id),
      system_code_artifact_digest: input.systemCode.artifact_digest,
      scenario_results: input.developmentEntry.evaluation.scenario_results ?? [],
      created_at: input.createdAt
    });
  } catch (error) {
    if (error instanceof ResearchBehaviorFingerprintUnavailableError) {
      return { status: "unavailable" };
    }
    throw error;
  }
  await input.store.recordResearchBehaviorFingerprint(fingerprint);
  const admittedFingerprintIds = new Set(
    (await input.store.listCandidateAdmissionDecisions())
      .filter((admission) => admission.status === "admitted")
      .map((admission) => admission.research_behavior_fingerprint_ref?.id)
      .filter((id): id is string => Boolean(id))
  );
  const matchingFingerprint = (await input.store.listResearchBehaviorFingerprints())
    .find((candidate) =>
      candidate.research_behavior_fingerprint_id !==
        fingerprint.research_behavior_fingerprint_id &&
      admittedFingerprintIds.has(candidate.research_behavior_fingerprint_id) &&
      sameResearchBehaviorFingerprintKey(candidate, fingerprint)
    );
  return matchingFingerprint
    ? { status: "duplicate", fingerprint, matchingFingerprint }
    : { status: "distinct", fingerprint };
}

function sameResearchBehaviorFingerprintKey(
  left: ResearchBehaviorFingerprintRecord,
  right: ResearchBehaviorFingerprintRecord
): boolean {
  return left.protocol_version === right.protocol_version &&
    left.development_suite_version === right.development_suite_version &&
    left.development_suite_digest === right.development_suite_digest &&
    left.fingerprint_digest === right.fingerprint_digest;
}

function arenaPaperHandoffConformance(input: {
  entry: TradingResearchNotebookEntry;
  experiment: ExperimentRunRecord;
  systemCode: SystemCodeRecord;
  suffix: string;
}): PaperTradingHandoffConformanceRecord | undefined {
  const evidence = input.entry.evaluation.paper_handoff_conformance;
  if (!evidence) return undefined;
  if (evidence.system_code_artifact_digest !== input.systemCode.artifact_digest) {
    throw new Error("candidate_arena_paper_handoff_artifact_digest_mismatch");
  }
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: `paper-handoff-conformance-${input.suffix}`,
    system_code_ref: ref("system_code", input.systemCode.system_code_id),
    system_code_artifact_digest: evidence.system_code_artifact_digest,
    experiment_run_ref: ref("experiment_run", input.experiment.experiment_run_id),
    trading_evaluation_task_ref: input.experiment.trading_evaluation_task_ref,
    protocol_version: evidence.protocol_version,
    runner_kind: evidence.runner_kind,
    status: evidence.status,
    reason: evidence.reason,
    provider_request_count: evidence.provider_request_count,
    ...(evidence.decision_event_kind === undefined
      ? {}
      : { decision_event_kind: evidence.decision_event_kind }),
    heartbeat_count: evidence.heartbeat_count,
    runtime_stopped: evidence.runtime_stopped,
    started_at: evidence.started_at,
    completed_at: evidence.completed_at,
    evidence_digest: "pending",
    research_preflight_authority: true,
    runnable_paper_handoff: evidence.runnable_paper_handoff,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.evidence_digest = `sha256:${createHash("sha256")
    .update(paperTradingHandoffConformanceDigestInput(record))
    .digest("hex")}`;
  return record;
}

function compactPaperHandoffConformance(
  record: PaperTradingHandoffConformanceRecord
): NonNullable<CandidateArenaTickDirectionResultReadModel["paper_handoff_conformance"]> {
  return {
    conformance_id: record.paper_trading_handoff_conformance_id,
    status: record.status,
    reason: record.reason,
    authority_status: "research_only"
  };
}

function arenaDisqualificationReason(
  entry: TradingResearchNotebookEntry
): NonNullable<TradingEvaluationResultRecord["disqualification_reason"]> {
  if (entry.evaluation.disqualification_reason) {
    return entry.evaluation.disqualification_reason;
  }
  if (entry.agent_status === "failed") {
    return "research_worker_failed";
  }
  if (entry.decision === "crash") {
    return "runtime_crash";
  }
  if (entry.evaluation.risk_decision === "invalid_order_request") {
    return "risk_validation_failed";
  }
  if (entry.evaluation.risk_decision === "no_order_request") {
    return "no_order_request";
  }
  return "unreproducible";
}

function arenaFindingForAdmission(
  entry: TradingResearchNotebookEntry,
  admission: CandidateAdmissionDecision
): Pick<ResearchFindingRecord, "finding_kind" | "summary"> {
  if (admission.reason === "research_worker_failed") {
    return {
      finding_kind: "failure_analysis",
      summary: `ResearchWorker failed before artifact execution: ${entry.summary}`
    };
  }
  if (admission.reason === "no_candidate_change") {
    return {
      finding_kind: "duplicate_result",
      summary: "ResearchWorker reported no candidate change; duplicate population entry rejected."
    };
  }
  if (admission.reason === "behavior_duplicate") {
    return {
      finding_kind: "duplicate_result",
      summary: "ResearchWorker produced behavior already admitted under the exact development protocol; duplicate population entry rejected."
    };
  }
  if (admission.reason === "behavior_fingerprint_unavailable") {
    return {
      finding_kind: "failure_analysis",
      summary: "Candidate behavior fingerprint was unavailable; admission quarantined before population materialization."
    };
  }
  if (admission.reason === "paper_handoff_conformance_failed") {
    return {
      finding_kind: "failure_analysis",
      summary: `Candidate failed PaperTradingHandoffConformance (${entry.evaluation.paper_handoff_conformance?.reason ?? "unknown"}).`
    };
  }
  if (isAntiHackingEvaluation(entry)) {
    return {
      finding_kind: "anti_hacking_case",
      summary: `Candidate violated the sealed ResearchPreflight boundary (${entry.evaluation.disqualification_reason}): ${entry.evaluation.summary}`
    };
  }
  if (admission.status === "quarantined") {
    return {
      finding_kind: "failure_analysis",
      summary: `Candidate was quarantined by ResearchPreflight: ${entry.evaluation.summary}`
    };
  }
  return entry.evaluation.profit_loss.net_revenue_usdt >= 0
    ? {
        finding_kind: "positive_result",
        summary: "Candidate produced non-negative net revenue after costs."
      }
    : {
        finding_kind: "negative_result",
        summary: "Candidate remained executable but lost money after costs."
      };
}

function isAntiHackingEvaluation(entry: TradingResearchNotebookEntry): boolean {
  return entry.evaluation.disqualification_reason === "data_leakage" ||
    entry.evaluation.disqualification_reason === "lookahead_leakage" ||
    entry.evaluation.disqualification_reason === "runtime_self_report_only";
}

async function arenaContext(
  store: OuroborosStorePort,
  direction: ResearchDirectionKind,
  allocation: CandidateArenaResearchAllocationRecord,
  allocationSelection: CandidateArenaResearchAllocationSelection
): Promise<string> {
  const researchReleases = await arenaPaperTradingComparisonResearchReleases(store);
  const arena = await buildCandidateArenaReadModel(
    store,
    "stopped",
    0,
    researchReleases
  );
  const paperEvidenceCandidates = await arenaPaperEvidenceCandidates(store, arena);
  const paperTradingBoard = arenaPaperTradingBoardContext(paperEvidenceCandidates);
  const findingClusters = arena.finding_clusters;
  return JSON.stringify({
    requested_direction: direction,
    current_research_allocation:
      toCandidateArenaResearchAllocationReadModel(allocation),
    current_research_selection: {
      ...allocationSelection,
      reasons: [...allocationSelection.reasons]
    },
    research_population_diversity: arena.research_population_diversity,
    task: "Submit a new TradingSystem candidate into the Candidate Arena. Rank target is revenue minus costs.",
    leaderboard: arena.leaderboard.slice(0, 8).map((entry) => ({
      rank: entry.rank,
      candidate_id: entry.candidate_id,
      direction_kind: entry.direction_kind,
      net_revenue_usdt: entry.profit_loss.net_revenue_usdt,
      net_return_pct: entry.profit_loss.net_return_pct
    })),
    negative_findings: arena.leaderboard
      .filter((entry) => entry.profit_loss.net_revenue_usdt < 0)
      .slice(0, 5)
      .map((entry) => ({
        candidate_id: entry.candidate_id,
        direction_kind: entry.direction_kind,
        net_revenue_usdt: entry.profit_loss.net_revenue_usdt,
        finding: entry.latest_finding
      })),
    latest_findings: arena.leaderboard
      .slice(0, 8)
      .map((entry) => ({
        candidate_id: entry.candidate_id,
        direction_kind: entry.direction_kind,
        net_revenue_usdt: entry.profit_loss.net_revenue_usdt,
        finding: entry.latest_finding
      })),
    latest_research_efficiency: arena.latest_ticks
      .flatMap((tick) => tick.direction_results
        .filter((result) => result.research_efficiency)
        .map((result) => ({
          tick_id: tick.tick_id,
          direction_kind: result.direction_kind,
          status: result.status,
          candidate_id: result.candidate_id,
          admission_decision_id: result.admission_decision_id,
          admission_reason: result.admission_reason,
          net_revenue_usdt: result.net_revenue_usdt,
          ...result.research_efficiency
        })))
      .slice(0, 8),
    selected_paper_evidence: paperEvidenceCandidates
      .filter(({ paperEvaluation }) => paperEvaluation)
      .map(({ entry, candidate, paperEvaluation, paperObservations }) => {
        const candidateId = candidate?.candidate_id ?? entry?.candidate_id;
        const paperBoardEntry = paperTradingBoard.find((boardEntry) => boardEntry.candidate_id === candidateId);
        const latestPaperFailureReason = paperObservations.at(-1)?.failure_reason ??
          paperEvaluation?.latest_failure_reason;
        const researchDiagnosticReasons = arenaResearchDiagnosticReasons(
          paperEvaluation,
          paperBoardEntry?.qualification_reasons ?? []
        );
        return {
          candidate_id: candidateId,
          direction_kind: entry?.direction_kind ??
            candidate?.full_cycle_lineage?.evidence?.direction_kind ??
            "paper_evidence",
          net_revenue_usdt: entry?.profit_loss.net_revenue_usdt ??
            paperEvaluation?.latest_score.net_revenue_usdt ??
            0,
          paper_trading_status: paperEvaluation?.status,
          paper_observation_count: paperEvaluation?.observation_count ?? 0,
          paper_loop_latency: paperLoopLatencySummary(paperEvaluation, paperObservations),
          paper_score: paperEvaluation?.latest_score,
          lineage: arenaPaperEvidenceLineage(candidate, entry),
          paper_board_learning: paperBoardEntry && paperEvaluation
            ? paperTradingLearningSummary({
                rank: paperBoardEntry.rank,
                profitLoss: paperEvaluation.latest_score,
                observationCount: paperEvaluation.observation_count,
                qualificationStatus: paperBoardEntry.qualification_status,
                qualificationReasons: researchDiagnosticReasons,
                latestFailure: classifyPaperTradingFailure(
                  paperObservations.at(-1)?.failure_reason ?? paperEvaluation.latest_failure_reason
                )
              })
            : undefined,
          latest_market_snapshot: paperObservations.at(-1)?.market_snapshot,
          latest_public_execution_snapshot: paperObservations.at(-1)?.public_execution_snapshot ??
            paperEvaluation?.latest_public_execution_snapshot,
          latest_paper_decision: paperObservations.at(-1)?.decision,
          latest_paper_account: paperObservations.at(-1)?.paper_account_snapshot ??
            paperEvaluation?.paper_account_snapshot,
          latest_open_orders: paperObservations.at(-1)?.open_orders ??
            paperEvaluation?.open_orders,
          latest_fill: paperObservations.at(-1)?.latest_fill ??
            paperEvaluation?.latest_fill,
          latest_paper_failure: latestPaperFailureReason,
          latest_paper_failure_classification: classifyPaperTradingFailure(latestPaperFailureReason),
          failed_observations: paperObservations
            .filter((observation) => observation.status === "failed")
            .slice(-3)
            .map((observation) => ({
              sequence: observation.sequence,
              observed_at: observation.observed_at,
              failure_reason: observation.failure_reason,
              failure: classifyPaperTradingFailure(observation.failure_reason)
            })),
          authority_status: "not_live"
        };
    }),
    paper_trading_board: paperTradingBoard,
    released_campaign_findings:
      arenaReleasedCampaignFindings(researchReleases),
    adaptive_direction_focus: [
      ...candidateArenaAdaptiveDirectionFocus(findingClusters),
      ...candidateArenaResearchEfficiencyBudgetFocus(arena.latest_ticks)
    ],
    finding_clusters: findingClusters,
    latest_candidate_admission_rejections: arena.latest_ticks
      .flatMap((tick) => tick.direction_results
        .filter((result) => result.status === "duplicate" || result.status === "quarantined")
        .map((result) => ({
          tick_id: tick.tick_id,
          direction_kind: result.direction_kind,
          status: result.status,
          admission_decision_id: result.admission_decision_id,
          admission_reason: result.admission_reason,
          finding: result.finding
        })))
      .slice(0, 8),
    latest_tick_failures: arena.latest_ticks
      .flatMap((tick) => tick.direction_results
        .filter((result) => result.status === "failed")
        .map((result) => ({
          tick_id: tick.tick_id,
          direction_kind: result.direction_kind,
          error: result.error
        })))
      .slice(0, 8)
  });
}

async function arenaPaperTradingComparisonResearchReleases(
  store: OuroborosStorePort
): Promise<PaperTradingComparisonResearchReleaseRecord[]> {
  if (typeof store.listPaperTradingComparisonResearchReleases !== "function") {
    return [];
  }
  const releases = await store.listPaperTradingComparisonResearchReleases();
  return Array.isArray(releases)
    ? uniquePaperTradingComparisonResearchReleases(releases)
    : [];
}

function uniquePaperTradingComparisonResearchReleases(
  releases: unknown[]
): PaperTradingComparisonResearchReleaseRecord[] {
  const byReleaseId = new Map<string, PaperTradingComparisonResearchReleaseRecord>();
  for (const release of releases) {
    if (!paperTradingComparisonResearchReleaseHasRuntimeShape(release) ||
      byReleaseId.has(
        release.paper_trading_comparison_research_release_id
      )) {
      continue;
    }
    byReleaseId.set(
      release.paper_trading_comparison_research_release_id,
      release
    );
  }
  return [...byReleaseId.values()].sort((left, right) =>
    right.released_at.localeCompare(left.released_at) ||
    left.paper_trading_comparison_research_release_id.localeCompare(
      right.paper_trading_comparison_research_release_id
    ));
}

function arenaReleasedCampaignFindings(
  releases: PaperTradingComparisonResearchReleaseRecord[]
): ArenaReleasedCampaignFinding[] {
  return uniquePaperTradingComparisonResearchReleases(releases)
    .slice(0, 8)
    .map((release) => ({
      release_id: release.paper_trading_comparison_research_release_id,
      candidate_id: release.candidate_ref.id,
      direction_kind: release.direction_kind,
      release_kind: release.release_kind,
      finding_kind: release.finding.finding_kind,
      summary: release.finding.summary,
      next_research_focus: release.next_research_focus,
      released_at: release.released_at,
      authority_status: "not_promotion_authority"
    }));
}

function arenaFindingClusters(
  candidates: Awaited<ReturnType<typeof arenaPaperEvidenceCandidates>>,
  paperTradingBoard: ReturnType<typeof arenaPaperTradingBoardContext>,
  researchReleases: PaperTradingComparisonResearchReleaseRecord[] = []
): CandidateArenaFindingClusterReadModel[] {
  const paperBoardByCandidateId = new Map(
    paperTradingBoard.flatMap((entry) => entry.candidate_id ? [[entry.candidate_id, entry]] : [])
  );
  const clusters = new Map<string, Omit<CandidateArenaFindingClusterReadModel, "candidate_count">>();

  for (const { entry, candidate, paperEvaluation, paperObservations } of candidates) {
    const candidateId = candidate?.candidate_id ?? entry?.candidate_id;
    if (!candidateId) {
      continue;
    }
    if (!paperEvaluation && paperObservations.length === 0) {
      continue;
    }

    const paperBoardEntry = paperBoardByCandidateId.get(candidateId);
    const latestObservation = paperObservations.at(-1);
    const latestFailure = classifyPaperTradingFailure(
      latestObservation?.failure_reason ?? paperEvaluation?.latest_failure_reason
    );
    const lineage = arenaPaperEvidenceLineage(candidate, entry);
    const directionKind = entry?.direction_kind ?? lineage.direction_kind ?? "other";
    const researchDiagnosticReasons = arenaResearchDiagnosticReasons(
      paperEvaluation,
      paperBoardEntry?.qualification_reasons ?? []
    );
    const blockerGroup = paperTradingQualificationBlockerGroups(researchDiagnosticReasons)[0];
    const topBlocker = researchDiagnosticReasons[0] ?? blockerGroup?.blockers[0];
    const paperLearning = paperBoardEntry && paperEvaluation
      ? paperTradingLearningSummary({
          rank: paperBoardEntry.rank,
          profitLoss: paperEvaluation.latest_score,
          observationCount: paperEvaluation.observation_count,
          qualificationStatus: paperBoardEntry.qualification_status,
          qualificationReasons: researchDiagnosticReasons,
          latestFailure
        })
      : undefined;
    const marketRegime = arenaMarketRegime(latestObservation?.market_snapshot);
    const clusterKey = [
      directionKind,
      topBlocker ?? "none",
      marketRegime,
      latestFailure?.failure_kind ?? "none"
    ].join("|");
    const existing = clusters.get(clusterKey);

    if (existing) {
      if (!existing.candidate_ids.includes(candidateId)) {
        existing.candidate_ids.push(candidateId);
      }
      continue;
    }

    clusters.set(clusterKey, {
      direction_kind: directionKind,
      top_blocker: topBlocker,
      blocker_group_kind: blockerGroup?.group_kind,
      market_regime: marketRegime,
      protocol_failure_kind: latestFailure?.failure_kind,
      candidate_ids: [candidateId],
      latest_finding: lineage.latest_finding,
      next_research_focus: paperLearning?.next_research_focus ??
        latestFailure?.next_action ??
        "Use the accumulated finding as next-generation context without promotion authority.",
      authority_status: "not_promotion_authority"
    });
  }

  for (const release of uniquePaperTradingComparisonResearchReleases(
    researchReleases
  )) {
    const clusterKey = [
      "released_campaign",
      release.direction_kind,
      release.release_kind,
      "unknown"
    ].join("|");
    const existing = clusters.get(clusterKey);
    if (existing) {
      if (!existing.candidate_ids.includes(release.candidate_ref.id)) {
        existing.candidate_ids.push(release.candidate_ref.id);
      }
      continue;
    }
    clusters.set(clusterKey, {
      direction_kind: release.direction_kind,
      market_regime: "unknown",
      candidate_ids: [release.candidate_ref.id],
      latest_finding: release.finding.summary,
      next_research_focus: release.next_research_focus,
      authority_status: "not_promotion_authority"
    });
  }

  return [...clusters.values()]
    .map((cluster) => ({
      ...cluster,
      candidate_ids: [...cluster.candidate_ids].sort(),
      candidate_count: cluster.candidate_ids.length
    }))
    .sort((a, b) =>
      b.candidate_count - a.candidate_count ||
      a.direction_kind.localeCompare(b.direction_kind) ||
      (a.top_blocker ?? "none").localeCompare(b.top_blocker ?? "none") ||
      a.market_regime.localeCompare(b.market_regime) ||
      (a.protocol_failure_kind ?? "none").localeCompare(b.protocol_failure_kind ?? "none")
    )
    .slice(0, 8);
}

function arenaResearchDiagnosticReasons(
  evaluation: PaperTradingEvaluationRecord | undefined,
  qualificationReasons: PaperTradingQualificationReason[]
): PaperTradingQualificationReason[] {
  if (evaluation?.status === "invalidated") {
    return ["paper_evaluation_invalidated"];
  }
  if (evaluation?.status === "failed") {
    return ["paper_evaluation_failed"];
  }
  return qualificationReasons.filter((reason) => reason !== "evidence_purpose_not_qualification");
}

function arenaMarketRegime(
  snapshot: PaperTradingMarketSnapshotSummary | undefined
): CandidateArenaFindingClusterMarketRegime {
  if (!snapshot) {
    return "unknown";
  }
  if (snapshot.expected_direction) {
    return snapshot.expected_direction;
  }
  if (
    typeof snapshot.moving_average_fast === "number" &&
    typeof snapshot.moving_average_slow === "number"
  ) {
    if (snapshot.moving_average_fast > snapshot.moving_average_slow) {
      return "long";
    }
    if (snapshot.moving_average_fast < snapshot.moving_average_slow) {
      return "short";
    }
    return "flat";
  }
  if (typeof snapshot.volatility === "number" && snapshot.volatility >= 0.02) {
    return "volatile";
  }
  return "unknown";
}

function arenaPaperEvidenceLineage(
  candidate: CandidateInspectReadModel | undefined,
  entry: CandidateArenaReadModel["leaderboard"][number] | undefined
): {
  lineage_status: "available" | "blocked" | "missing";
  direction_kind?: ResearchDirectionKind;
  parent_candidate_id?: string;
  parent_candidate_version_id?: string;
  generated_by_agent?: true;
  latest_finding?: string;
  evaluation_status?: string;
  evaluation_score?: number;
  authority_status: "lineage_only";
} {
  const lineage = candidate?.full_cycle_lineage;
  if (!lineage) {
    return {
      lineage_status: "missing",
      direction_kind: entry?.direction_kind,
      parent_candidate_id: entry?.parent_candidate_id,
      latest_finding: entry?.latest_finding,
      authority_status: "lineage_only"
    };
  }
  return {
    lineage_status: lineage.handoff_status === "blocked" ? "blocked" : "available",
    direction_kind: lineage.evidence?.direction_kind ?? entry?.direction_kind,
    parent_candidate_id: lineage.source.trading_system_id,
    parent_candidate_version_id: lineage.source.candidate_version_id,
    generated_by_agent: lineage.generated?.generated_by_agent,
    latest_finding: entry?.latest_finding,
    evaluation_status: lineage.evidence?.evaluation_status,
    evaluation_score: lineage.evidence?.evaluation_score,
    authority_status: "lineage_only"
  };
}

function arenaPaperTradingBoardContext(
  candidates: Awaited<ReturnType<typeof arenaPaperEvidenceCandidates>>
): Array<{
  rank: number;
  candidate_id: string | undefined;
  paper_trading_status: string;
  paper_runner_status: "unknown_at_tick_context" | "inactive";
  net_revenue_usdt: number;
  net_return_pct: number;
  observation_count: number;
  qualification_status: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  blocker_groups: PaperTradingQualificationBlockerGroup[];
  trend: PaperTradingBoardTrendReadModel;
  blocker_density: PaperTradingBoardBlockerDensityReadModel;
  evidence_window: {
    observation_count: number;
    elapsed_ms: number;
    failed_observation_count: number;
  };
  promotion_gate_status?: "paper_evidence_recorded" | "paper_failed" | "not_evaluated";
  market_data_source?: string;
  latest_public_execution_source?: string;
  latest_failure_reason?: string;
  authority_status: "not_live";
}> {
  return candidates
    .filter(({ paperEvaluation }) => paperEvaluation)
    .map(({ candidate, entry, paperEvaluation, paperCommitment, paperObservations }) => {
      const latestObservation = paperObservations.at(-1);
      const latestMarketSnapshot = latestObservation?.market_snapshot;
      const latestPublicExecutionSnapshot = latestObservation?.public_execution_snapshot ??
        paperEvaluation?.latest_public_execution_snapshot;
      const qualification = qualifyPaperTradingEvaluation({
        evaluation: paperEvaluation!,
        commitment: paperCommitment,
        observations: paperObservations,
        runnerActive: false,
        policy: {
          assessRunnerHealth: false
        }
      });
      return {
        rank: 0,
        candidate_id: candidate?.candidate_id ?? entry?.candidate_id,
        paper_trading_status: paperEvaluation?.status ?? "not_started",
        paper_runner_status: paperEvaluation?.status === "running"
          ? "unknown_at_tick_context" as const
          : "inactive" as const,
        net_revenue_usdt: paperEvaluation?.latest_score.net_revenue_usdt ?? 0,
        net_return_pct: paperEvaluation?.latest_score.net_return_pct ?? 0,
        observation_count: paperEvaluation?.observation_count ?? 0,
        qualification_status: qualification.qualification_status,
        qualification_reasons: qualification.qualification_reasons,
        blocker_groups: paperTradingQualificationBlockerGroups(qualification.qualification_reasons),
        trend: arenaPaperTradingBoardTrend(paperObservations, paperEvaluation?.latest_score ?? ZERO_PROFIT_LOSS),
        blocker_density: arenaPaperTradingBoardBlockerDensity(
          qualification.qualification_reasons,
          qualification.evidence_window
        ),
        evidence_window: qualification.evidence_window,
        promotion_gate_status: arenaPaperPromotionGateStatus(paperEvaluation),
        market_data_source: latestMarketSnapshot?.source_kind ?? latestPublicExecutionSnapshot?.source_kind,
        latest_public_execution_source: latestPublicExecutionSnapshot?.source_priority,
        latest_failure_reason: latestObservation?.failure_reason ?? paperEvaluation?.latest_failure_reason,
        authority_status: "not_live" as const
      };
    })
    .sort((a, b) =>
      b.net_revenue_usdt - a.net_revenue_usdt ||
      b.net_return_pct - a.net_return_pct ||
      b.observation_count - a.observation_count ||
      String(a.candidate_id).localeCompare(String(b.candidate_id))
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
    .slice(0, 8);
}

function arenaPaperTradingBoardTrend(
  observations: Awaited<ReturnType<OuroborosStorePort["listPaperTradingObservations"]>>,
  latestProfitLoss: TradingProfitLossReadModel
): PaperTradingBoardTrendReadModel {
  if (observations.length < 2) {
    return {
      direction: "insufficient_history",
      net_revenue_delta_usdt: 0,
      net_return_delta_pct: 0,
      observation_count_delta: 0,
      authority_status: "not_promotion_authority"
    };
  }
  const firstObservation = observations[0]!;
  const latestObservation = observations.at(-1)!;
  const firstProfitLoss = firstObservation.cumulative_score;
  const latestObservedProfitLoss = latestObservation.cumulative_score ?? latestProfitLoss;
  const netRevenueDelta = roundPaperBoardContextSignal(
    latestObservedProfitLoss.net_revenue_usdt - firstProfitLoss.net_revenue_usdt
  );
  const netReturnDelta = roundPaperBoardContextSignal(
    latestObservedProfitLoss.net_return_pct - firstProfitLoss.net_return_pct
  );
  return {
    direction: arenaPaperTrendDirection(netRevenueDelta),
    net_revenue_delta_usdt: netRevenueDelta,
    net_return_delta_pct: netReturnDelta,
    observation_count_delta: Math.max(0, latestObservation.sequence - firstObservation.sequence),
    authority_status: "not_promotion_authority"
  };
}

function arenaPaperTradingBoardBlockerDensity(
  qualificationReasons: PaperTradingQualificationReason[],
  evidenceWindow: {
    observation_count: number;
    failed_observation_count: number;
  }
): PaperTradingBoardBlockerDensityReadModel {
  const observationCount = Math.max(1, evidenceWindow.observation_count);
  return {
    blocker_count: qualificationReasons.length,
    blocker_density: roundPaperBoardContextSignal(qualificationReasons.length / observationCount),
    failed_observation_ratio: roundPaperBoardContextSignal(evidenceWindow.failed_observation_count / observationCount),
    top_blocker: qualificationReasons[0],
    authority_status: "not_promotion_authority"
  };
}

function arenaPaperTrendDirection(netRevenueDelta: number): PaperTradingBoardTrendReadModel["direction"] {
  if (netRevenueDelta > 0) {
    return "improving";
  }
  if (netRevenueDelta < 0) {
    return "declining";
  }
  return "flat";
}

function roundPaperBoardContextSignal(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function paperLoopLatencySummary(
  paperEvaluation: PaperTradingEvaluationRecord | undefined,
  paperObservations: Pick<
    PaperTradingObservationRecord,
    "paper_trading_observation_id" | "sequence" | "observed_at"
  >[]
): PaperLoopLatencySummary | undefined {
  const expectedIntervalMs = paperEvaluation?.interval_ms;
  if (
    !paperEvaluation ||
    typeof expectedIntervalMs !== "number" ||
    !Number.isFinite(expectedIntervalMs) ||
    expectedIntervalMs <= 0
  ) {
    return undefined;
  }

  const orderedObservations = [...paperObservations]
    .sort((left, right) =>
      left.sequence - right.sequence ||
      left.observed_at.localeCompare(right.observed_at) ||
      left.paper_trading_observation_id.localeCompare(right.paper_trading_observation_id)
    );
  const intervals: number[] = [];
  for (let index = 1; index < orderedObservations.length; index += 1) {
    const previous = orderedObservations[index - 1]!;
    const current = orderedObservations[index]!;
    const intervalMs = elapsedMs(previous.observed_at, current.observed_at);
    if (intervalMs > 0) {
      intervals.push(intervalMs);
    }
  }

  const expected = Math.max(0, Math.round(expectedIntervalMs));
  if (intervals.length === 0) {
    return {
      expected_interval_ms: expected,
      observed_interval_count: 0,
      cadence_status: "insufficient_history",
      authority_status: "not_promotion_authority"
    };
  }

  const intervalLags = intervals.map((interval) => Math.max(0, interval - expected));
  const latestObservationInterval = intervals.at(-1)!;
  const latestIntervalLag = intervalLags.at(-1)!;
  const maxIntervalLag = Math.max(...intervalLags);
  return {
    expected_interval_ms: expected,
    latest_observation_interval_ms: latestObservationInterval,
    latest_interval_lag_ms: latestIntervalLag,
    max_interval_lag_ms: maxIntervalLag,
    observed_interval_count: intervals.length,
    cadence_status: maxIntervalLag > 0 ? "lagging" : "on_cadence",
    authority_status: "not_promotion_authority"
  };
}

function arenaPaperPromotionGateStatus(
  evaluation: Awaited<ReturnType<OuroborosStorePort["getLatestPaperTradingEvaluationForCandidate"]>> | undefined
): "paper_evidence_recorded" | "paper_failed" | "not_evaluated" | undefined {
  if (!evaluation) {
    return "not_evaluated";
  }
  if (evaluation.status === "failed") {
    return "paper_failed";
  }
  if (evaluation.status === "running") {
    return undefined;
  }
  return evaluation.observation_count > 0 ? "paper_evidence_recorded" : "not_evaluated";
}

async function releasedResearchFeedbackEvidence(
  store: OuroborosStorePort,
  evaluation: PaperTradingEvaluationRecord
): Promise<{
  commitment: NonNullable<Awaited<ReturnType<OuroborosStorePort["getPaperTradingEvaluationCommitment"]>>>;
  observations: Awaited<ReturnType<OuroborosStorePort["listPaperTradingObservations"]>>;
} | undefined> {
  if (evaluation.status === "invalidated" || evaluation.observation_count <= 0) {
    return undefined;
  }
  const commitmentId = evaluation.paper_trading_evaluation_commitment_ref?.id;
  const commitment = commitmentId
    ? await store.getPaperTradingEvaluationCommitment(commitmentId)
    : undefined;
  if (
    !commitment ||
    !paperTradingEvaluationCommitmentMatchesEvaluation(commitment, evaluation) ||
    commitment.evidence_purpose !== "research_feedback" ||
    commitment.window_policy.release_policy !== "closed_observation"
  ) {
    return undefined;
  }
  const observations = await store.listPaperTradingObservations(
    evaluation.paper_trading_evaluation_id
  );
  return paperTradingEvidenceIntegrityReasons({ evaluation, commitment, observations }).length === 0
    ? { commitment, observations }
    : undefined;
}

async function arenaPaperEvidenceCandidates(
  store: OuroborosStorePort,
  arena: CandidateArenaReadModel
): Promise<Array<{
  entry?: CandidateArenaReadModel["leaderboard"][number];
  candidate?: CandidateInspectReadModel;
  paperEvaluation?: Awaited<ReturnType<OuroborosStorePort["getLatestPaperTradingEvaluationForCandidate"]>>;
  paperCommitment?: Awaited<ReturnType<OuroborosStorePort["getPaperTradingEvaluationCommitment"]>>;
  paperObservations: Awaited<ReturnType<OuroborosStorePort["listPaperTradingObservations"]>>;
}>> {
  const leaderboardEntries = arena.leaderboard.slice(0, 8);
  const entriesByCandidateId = new Map(leaderboardEntries.map((entry) => [entry.candidate_id, entry]));
  const candidateIds = new Set(leaderboardEntries.map((entry) => entry.candidate_id));
  const candidateSummaries = await store.listCandidates();

  await Promise.all(candidateSummaries.map(async (summary) => {
    if (candidateIds.has(summary.candidate_id)) {
      return;
    }
    const candidate = await store.getCandidate(summary.candidate_id);
    const paperEvaluation = await store.getLatestPaperTradingEvaluationForCandidate(summary.candidate_id);
    if (candidate && paperEvaluation) {
      candidateIds.add(summary.candidate_id);
    }
  }));

  return Promise.all([...candidateIds].map(async (candidateId) => {
    const candidate = await store.getCandidate(candidateId);
    const paperEvaluation = candidate
      ? await store.getLatestPaperTradingEvaluationForCandidate(candidate.candidate_id)
      : undefined;
    const released = paperEvaluation
      ? await releasedResearchFeedbackEvidence(store, paperEvaluation)
      : undefined;
    return {
      entry: entriesByCandidateId.get(candidateId),
      candidate,
      paperEvaluation: released ? paperEvaluation : undefined,
      paperCommitment: released?.commitment,
      paperObservations: released?.observations ?? []
    };
  }));
}

function evaluationStatus(value: string | undefined): "accepted" | "disqualified" {
  return value === "accepted" ? "accepted" : "disqualified";
}

function arenaResearcher(
  direction: ResearchDirectionKind,
  latestTicks: CandidateArenaTickReadModel[]
): CandidateArenaResearcherReadModel {
  const latestResult = latestTicks
    .flatMap((tick) => tick.direction_results)
    .find((result) => result.direction_kind === direction);
  return {
    researcher_id: `research-worker-${safeId(direction)}`,
    direction_kind: direction,
    status: latestResult?.status === "failed" ||
      latestResult?.admission_reason === "research_worker_failed"
      ? "failed"
      : "active",
    authority_status: "research_only"
  };
}

function researchEfficiencySummary(
  entries: TradingResearchNotebookEntry[],
  sealedAdmission: Awaited<ReturnType<typeof runTradingResearchLoop>>["sealed_admission"]
): CandidateArenaResearchEfficiencyReadModel {
  const developmentScenarioResults = entries.flatMap(
    (entry) => entry.evaluation.scenario_results ?? []
  );
  const sealedScenarioResults = sealedAdmission?.evaluation.scenario_results ?? [];
  const paperHandoff = sealedAdmission?.evaluation.paper_handoff_conformance;
  const development = {
    submission_count: entries.length,
    provider_request_total: developmentScenarioResults.reduce(
      (total, result) => total + result.provider_request_count,
      0
    ),
    runner_command_total: developmentScenarioResults.reduce(
      (total, result) => total + result.runner_command_count,
      0
    ),
    scenario_count: developmentScenarioResults.length,
    elapsed_ms: entries.reduce(
      (total, entry) => total + elapsedMs(entry.started_at, entry.completed_at),
      0
    )
  };
  const sealed = {
    submission_count: sealedAdmission ? 1 : 0,
    provider_request_total: sealedScenarioResults.reduce(
      (total, result) => total + result.provider_request_count,
      0
    ) + (paperHandoff?.provider_request_count ?? 0),
    runner_command_total: sealedScenarioResults.reduce(
      (total, result) => total + result.runner_command_count,
      0
    ),
    scenario_count: sealedScenarioResults.length,
    elapsed_ms: paperHandoff
      ? elapsedMs(paperHandoff.started_at, paperHandoff.completed_at)
      : 0
  };
  return {
    provider_request_total: development.provider_request_total,
    runner_command_total: development.runner_command_total,
    scenario_count: development.scenario_count,
    elapsed_ms: development.elapsed_ms,
    development,
    sealed_admission: sealed,
    authority_status: "not_promotion_authority"
  };
}

function elapsedMs(startedAt: string, completedAt: string): number {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return 0;
  }
  return completed - started;
}

function candidateArenaTickRecord(input: {
  tickId: string;
  startedAt: string;
  completedAt: string;
  sourceCandidate: CandidateArenaTickSourceReadModel;
  createdCandidateIds: string[];
  directionResults: CandidateArenaTickDirectionResultReadModel[];
  allocation: CandidateArenaResearchAllocationRecord;
}): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${safeId(input.tickId)}`,
    tick_id: input.tickId,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    status: candidateArenaTickStatus(input.directionResults),
    source_candidate: input.sourceCandidate,
    created_candidate_refs: input.createdCandidateIds.map((candidateId) =>
      ref("trading_system_candidate", candidateId)
    ),
    direction_results: input.directionResults,
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      input.allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: input.allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function toCandidateArenaTickReadModel(
  tick: CandidateArenaTickRecord,
  allocation?: CandidateArenaResearchAllocationRecord
): CandidateArenaTickReadModel {
  return {
    tick_id: tick.tick_id,
    started_at: tick.started_at,
    completed_at: tick.completed_at,
    status: tick.status,
    ...(tick.source_candidate ? { source_candidate: tick.source_candidate } : {}),
    created_candidate_ids: tick.created_candidate_refs.map((candidate) => candidate.id),
    direction_results: tick.direction_results,
    ...(allocation
      ? {
          research_allocation:
            toCandidateArenaResearchAllocationReadModel(allocation)
        }
      : {}),
    ...(tick.paper_trading_continuation
      ? { paper_trading_continuation: tick.paper_trading_continuation }
      : {}),
    authority_status: tick.authority_status
  };
}

function candidateArenaTickStatus(
  directionResults: CandidateArenaTickDirectionResultReadModel[]
): CandidateArenaTickStatus {
  const failedCount = directionResults.filter((result) => result.status === "failed").length;
  if (failedCount === 0) {
    return "completed";
  }
  return failedCount < directionResults.length ? "completed_with_errors" : "failed";
}

function findingSummaryForProfitLoss(
  profitLoss: TradingProfitLossReadModel,
  evaluationStatus?: string
): string {
  if (evaluationStatus && evaluationStatus !== "accepted") {
    return "Candidate was disqualified by evaluation guardrails.";
  }
  return profitLoss.net_revenue_usdt >= 0
    ? "Candidate produced non-negative net revenue after costs."
    : "Candidate remained executable but lost money after costs.";
}

function conciseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split("\n")[0] || error.name;
  }
  return String(error);
}

function directionLabel(direction: ResearchDirectionKind): string {
  return direction.replaceAll("_", " ");
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
