import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ArtifactLineageRecord,
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
  CandidateArenaResearchEfficiencyReadModel,
  CandidateArenaResearcherReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  ExperimentRunRecord,
  PaperTradingBoardBlockerDensityReadModel,
  PaperTradingBoardTrendReadModel,
  PaperTradingEvaluationRecord,
  PaperTradingMarketSnapshotSummary,
  PaperTradingObservationRecord,
  PaperTradingFailureKind,
  PaperTradingQualificationReason,
  PaperTradingQualificationStatus,
  Ref,
  ResearchDirectionKind,
  ResearchFindingRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import {
  FIXTURE_CANDIDATE_ID,
  type OuroborosStorePort
} from "../ports/store";
import { safeId } from "../safe-id";
import { readTradingSystemManifest } from "../trading/research/artifact-runner";
import type { TradingArtifactRunner } from "../trading/research/artifact-runner";
import { FixtureTradingResearchAgentAdapter } from "../trading/research/agent-adapters";
import { runTradingResearchLoop } from "../trading/research/run-trading-research";
import type { ReplayTradingApiProviderFactory } from "../trading/research/replay-set-runner";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  TradingEvaluationResult,
  TradingResearchNotebookEntry,
  TradingResearchAgentAdapter
} from "../trading/research/types";
import type { TradingResearchRuntimeAgent } from "../trading/research/runtime-config";
import {
  paperTradingQualificationBlockerGroups,
  type PaperTradingQualificationBlockerGroup
} from "../trading/paper/qualification-blockers";
import { classifyPaperTradingFailure } from "../trading/paper/failures";
import { paperTradingLearningSummary } from "../trading/paper/learning";
import { qualifyPaperTradingEvaluation } from "../trading/paper/qualification";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export const DEFAULT_ARENA_DIRECTIONS: ResearchDirectionKind[] = [
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "execution_cost_robustness"
];

const ZERO_PROFIT_LOSS: TradingProfitLossReadModel = {
  revenue_usdt: 0,
  cost_usdt: 0,
  net_revenue_usdt: 0,
  net_return_pct: 0
};
const arenaStoreMutationQueues = new WeakMap<OuroborosStorePort, Promise<unknown>>();

type ArenaAdaptiveDirectionFocus = {
  direction_kind: ResearchDirectionKind;
  source_direction_kind?: ResearchDirectionKind;
  focus_score: number;
  focus_reason: string;
  next_research_focus: string;
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

export interface RunCandidateArenaTickInput {
  store: OuroborosStorePort;
  sourceSystemId?: string;
  sourceCandidateVersionId?: string;
  directions?: ResearchDirectionKind[];
  tickId?: string;
  repoRoot?: string;
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
  const sourceSelection = await sourceCandidate(input.store, input.sourceSystemId, input.sourceCandidateVersionId);
  const directions = input.directions ?? await adaptiveDefaultArenaDirections(input.store);
  const tickId = input.tickId ?? `tick-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const createdCandidateIds: string[] = [];
  const directionResults: CandidateArenaTickDirectionResultReadModel[] = [];

  const settledDirections = await Promise.allSettled(
    directions.map(async (direction) => ({
      direction,
      created: await runArenaDirection({
        ...input,
        source: sourceSelection.candidate,
        direction,
        tickId
      })
    }))
  );

  for (let index = 0; index < settledDirections.length; index += 1) {
    const direction = directions[index]!;
    const settled = settledDirections[index]!;
    if (settled.status === "fulfilled") {
      const created = settled.value.created.candidate;
      createdCandidateIds.push(created.candidate_id);
      const profitLoss = created.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS;
      directionResults.push({
        direction_kind: direction,
        status: "created",
        agent_provider: input.researchAgent,
        candidate_id: created.candidate_id,
        finding: findingSummaryForProfitLoss(
          profitLoss,
          created.full_cycle_lineage?.evidence?.evaluation_status
        ),
        net_revenue_usdt: profitLoss.net_revenue_usdt,
        research_efficiency: settled.value.created.research_efficiency
      });
    } else {
      directionResults.push({
        direction_kind: direction,
        status: "failed",
        agent_provider: input.researchAgent,
        error: conciseError(settled.reason),
        finding: `${directionLabel(direction)} researcher failed before candidate materialization.`
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
    totalDirectionCount: directions.length
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

export async function buildCandidateArenaReadModel(
  store: OuroborosStorePort,
  runnerStatus: "running" | "stopped",
  tickCount: number
): Promise<CandidateArenaReadModel> {
  const candidates = await Promise.all(
    (await store.listCandidates()).map((candidate) => store.getCandidate(candidate.candidate_id))
  );
  const latestTicks = (await store.listCandidateArenaTicks())
    .slice(0, 10)
    .map(toCandidateArenaTickReadModel);
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
  const paperEvidenceCandidates = await arenaPaperEvidenceCandidates(store, arena);
  const paperTradingBoard = arenaPaperTradingBoardContext(paperEvidenceCandidates);
  return {
    ...arena,
    finding_clusters: arenaFindingClusters(paperEvidenceCandidates, paperTradingBoard)
  };
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
}): Promise<{
  candidate: CandidateInspectReadModel;
  research_efficiency: CandidateArenaResearchEfficiencyReadModel;
}> {
  const repoRoot = input.repoRoot ?? REPO_ROOT;
  const sessionId = `candidate-arena-${safeId(input.tickId)}-${safeId(input.direction)}`;
  const artifactSourceDir = await sourceResearchArtifactDir({
    store: input.store,
    source: input.source,
    repoRoot
  });
  const adapter = input.researchAgent === "fixture"
    ? new DirectionalFixtureTradingResearchAgentAdapter(input.direction)
    : input.agentFactory(input.researchAgent);
  const research = await runTradingResearchLoop({
    repo_root: repoRoot,
    artifact_source_dir: artifactSourceDir,
    run_root: path.join(input.store.root(), "candidate-arena-runs", sessionId),
    session_id: sessionId,
    iterations: 1,
    agent_adapter: adapter,
    artifact_runner: input.artifactRunner,
    replay_provider_factory: input.replayProviderFactory,
    arena_context: await arenaContext(input.store, input.direction)
  });
  const entry = research.entries.at(-1);
  if (!entry) {
    throw new Error("candidate_arena_missing_research_entry");
  }
  const researchEfficiency = researchEfficiencySummary(entry);
  const artifactDir = research.best_artifact_dir ?? entry.artifact_dir;
  const manifest = await readTradingSystemManifest(artifactDir);
  return withArenaStoreMutation(input.store, async () => {
    const systemCode = await recordArenaSystemCode({
      store: input.store,
      artifactDir,
      sessionId,
      manifestEntrypoint: manifest.entrypoint,
      agent: adapter.agent
    });
    const materialized = await input.store.materializeCandidate(arenaMaterializationInput({
      source: input.source,
      sourceSystemCodeRef: input.source.system_code?.ref,
      systemCode,
      evaluation: entry.evaluation,
      direction: input.direction,
      agent: adapter.agent,
      sessionId
    }));
    if (materialized.status !== "materialized") {
      throw new Error("candidate_arena_materialization_failed");
    }

    await recordArenaResearchRecords({
      store: input.store,
      candidate: materialized.candidate,
      source: input.source,
      direction: input.direction,
      evaluation: entry.evaluation,
      systemCode,
      sessionId
    });

    const candidate = await input.store.getCandidate(materialized.candidate.candidate_id);
    if (!candidate) {
      throw new Error("candidate_arena_projection_failed");
    }
    return {
      candidate,
      research_efficiency: researchEfficiency
    };
  });
}

async function withArenaStoreMutation<T>(store: OuroborosStorePort, task: () => Promise<T>): Promise<T> {
  const previous = arenaStoreMutationQueues.get(store) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  arenaStoreMutationQueues.set(store, current.catch(() => undefined));
  return current;
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
      ineligibleLatestPaperEvaluationCandidateIds(latestPaperEvaluations)
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
      .map(async (evaluation) => ({
        evaluation,
        candidate: await store.getCandidate(evaluation.candidate_ref.id)
      }))
  );
  return candidates
    .filter((entry): entry is {
      candidate: CandidateInspectReadModel;
      evaluation: PaperTradingEvaluationRecord;
    } =>
      Boolean(entry.candidate?.system_code?.ref) &&
      entry.candidate?.candidate_version.candidate_version_id === entry.evaluation.candidate_version_ref.id
    )
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

function ineligibleLatestPaperEvaluationCandidateIds(
  latestEvaluationByCandidate: Map<string, PaperTradingEvaluationRecord>
): Set<string> {
  return new Set(
    [...latestEvaluationByCandidate.values()]
      .filter((evaluation) => !isEligiblePaperTradingEvaluationSource(evaluation))
      .map((evaluation) => evaluation.candidate_ref.id)
  );
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

async function sourceResearchArtifactDir(input: {
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
  manifestEntrypoint: string[];
  agent: ManagedResearchAgent;
}): Promise<SystemCodeRecord & { artifact_kind: "python_file" }> {
  const entrypointPath = input.manifestEntrypoint[1] ?? "run.py";
  const artifactPath = path.resolve(input.artifactDir, entrypointPath);
  assertArenaEntrypointInsideArtifactDir(input.artifactDir, artifactPath);
  const digest = await fileDigest(artifactPath);
  return input.store.recordSystemCode({
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-arena-${safeId(input.sessionId)}-${digest.slice(0, 12)}`,
    artifact_kind: "python_file",
    artifact_path: artifactPath,
    artifact_digest: `sha256:${digest}`,
    runtime_kind: "python",
    entrypoint: ["python3", artifactPath],
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

function assertArenaEntrypointInsideArtifactDir(artifactDir: string, artifactPath: string): void {
  const resolvedArtifactDir = path.resolve(artifactDir);
  const relativePath = path.relative(resolvedArtifactDir, artifactPath);
  if (relativePath && (relativePath.startsWith("..") || path.isAbsolute(relativePath))) {
    throw new Error("candidate_arena_entrypoint_escapes_artifact_dir");
  }
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
  candidate: CandidateInspectReadModel;
  source: CandidateInspectReadModel;
  direction: ResearchDirectionKind;
  evaluation: TradingEvaluationResult;
  systemCode: SystemCodeRecord;
  sessionId: string;
}): Promise<void> {
  const suffix = safeId(input.sessionId);
  const now = new Date().toISOString();
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-run-${suffix}`,
    research_worker_ref: ref("research_worker", `research-worker-${safeId(input.direction)}`),
    research_direction_ref: ref("research_direction", `research-direction-${safeId(input.direction)}`),
    system_code_ref: ref("system_code", input.systemCode.system_code_id),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "candidate-arena-revenue-cost-v1"),
    trace_ref: ref("trace_placeholder", `trace-${suffix}`),
    submitted_at: now,
    status: "evaluated",
    authority_status: "not_live"
  };
  await input.store.recordExperimentRun(experiment);

  const metricRefs = input.evaluation.metrics.map((metric) =>
    ref("metric_snapshot", `metric-${suffix}-${safeId(metric.name)}`)
  );
  const result: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `trading-evaluation-result-${suffix}`,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    evaluator_ref: ref("external_evaluator", "candidate-arena-revenue-cost-evaluator-v1"),
    result_status: input.evaluation.status === "accepted" ? "accepted" : "disqualified",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: input.evaluation.score,
      oos_score: input.evaluation.score,
      drawdown_score: input.evaluation.profit_loss.net_revenue_usdt >= 0 ? 1 : 0,
      turnover_score: 1,
      cost_survival_score: input.evaluation.profit_loss.net_revenue_usdt >= 0 ? 1 : 0,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: metricRefs,
    evaluator_trace_ref: ref("trace_placeholder", `trace-evaluator-${suffix}`),
    ...(input.evaluation.status === "accepted" ? {} : { disqualification_reason: "unreproducible" as const }),
    completed_at: now,
    authority_status: "not_counted"
  };
  await input.store.recordTradingEvaluationResult(result);

  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `research-finding-${suffix}`,
    research_worker_ref: experiment.research_worker_ref,
    research_direction_ref: experiment.research_direction_ref,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref("trading_evaluation_result", result.trading_evaluation_result_id),
    finding_kind: input.evaluation.profit_loss.net_revenue_usdt >= 0 ? "positive_result" : "negative_result",
    summary: input.evaluation.profit_loss.net_revenue_usdt >= 0
      ? "Candidate produced non-negative net revenue after costs."
      : "Candidate remained executable but lost money after costs.",
    supporting_record_refs: [
      ref("trading_evaluation_result", result.trading_evaluation_result_id),
      ...metricRefs
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
    parent_system_code_ref: input.source.system_code?.ref,
    source_finding_refs: [ref("research_finding", finding.research_finding_id)],
    created_by_research_worker_ref: experiment.research_worker_ref,
    created_at: now,
    authority_status: "lineage_only"
  };
  await input.store.recordArtifactLineage(lineage);
}

async function arenaContext(store: OuroborosStorePort, direction: ResearchDirectionKind): Promise<string> {
  const arena = await buildCandidateArenaReadModel(store, "stopped", 0);
  const paperEvidenceCandidates = await arenaPaperEvidenceCandidates(store, arena);
  const paperTradingBoard = arenaPaperTradingBoardContext(paperEvidenceCandidates);
  const findingClusters = arenaFindingClusters(paperEvidenceCandidates, paperTradingBoard);
  return JSON.stringify({
    requested_direction: direction,
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
          candidate_id: result.candidate_id,
          net_revenue_usdt: result.net_revenue_usdt,
          ...result.research_efficiency
        })))
      .slice(0, 8),
    selected_paper_evidence: paperEvidenceCandidates
      .filter(({ candidate, paperEvaluation }) => candidate?.ledger?.has_activity || paperEvaluation)
      .map(({ entry, candidate, paperEvaluation, paperObservations }) => {
        const candidateId = candidate?.candidate_id ?? entry?.candidate_id;
        const paperBoardEntry = paperTradingBoard.find((boardEntry) => boardEntry.candidate_id === candidateId);
        const latestPaperFailureReason = paperObservations.at(-1)?.failure_reason ??
          paperEvaluation?.latest_failure_reason;
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
                qualificationReasons: paperBoardEntry.qualification_reasons,
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
          ledger_chain_complete: candidate?.ledger?.chain_complete ?? false,
          ledger_chain_count: candidate?.ledger?.chain_count ?? 0,
          latest_order_request_id: candidate?.ledger?.latest_order_request?.order_request_id,
          latest_order_request_side: candidate?.ledger?.latest_order_request?.side,
          latest_order_request_type: candidate?.ledger?.latest_order_request?.order_type,
          latest_gateway_outcome: candidate?.ledger?.latest_gateway_result?.decision_outcome,
          latest_execution_status: candidate?.ledger?.latest_execution_result?.status,
          trading_run_status: candidate?.trading_run?.lifecycle_status
            ?? candidate?.runtime.runtime_lifecycle_status
            ?? "recorded",
          authority_status: "not_live"
        };
    }),
    paper_trading_board: paperTradingBoard,
    adaptive_direction_focus: [
      ...arenaAdaptiveDirectionFocus(findingClusters),
      ...arenaResearchEfficiencyBudgetFocus(arena.latest_ticks)
    ],
    finding_clusters: findingClusters,
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

function arenaFindingClusters(
  candidates: Awaited<ReturnType<typeof arenaPaperEvidenceCandidates>>,
  paperTradingBoard: ReturnType<typeof arenaPaperTradingBoardContext>
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
    const blockerGroup = paperBoardEntry?.blocker_groups[0];
    const topBlocker = paperBoardEntry?.blocker_density.top_blocker ?? blockerGroup?.blockers[0];
    const paperLearning = paperBoardEntry && paperEvaluation
      ? paperTradingLearningSummary({
          rank: paperBoardEntry.rank,
          profitLoss: paperEvaluation.latest_score,
          observationCount: paperEvaluation.observation_count,
          qualificationStatus: paperBoardEntry.qualification_status,
          qualificationReasons: paperBoardEntry.qualification_reasons,
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

async function adaptiveDefaultArenaDirections(store: OuroborosStorePort): Promise<ResearchDirectionKind[]> {
  const arena = await buildCandidateArenaReadModel(store, "stopped", 0);
  const prioritizedDirections = arenaAdaptiveDirectionFocus(arena.finding_clusters)
    .map((entry) => entry.direction_kind);
  const budgetFocusDirections = arenaResearchEfficiencyBudgetFocus(arena.latest_ticks)
    .map((entry) => entry.direction_kind);
  const expensiveDirections = arenaResearchEfficiencyExpensiveDirections(arena.latest_ticks);
  const prioritized = uniqueDirections([
    ...prioritizedDirections,
    ...budgetFocusDirections
  ]);
  return [
    ...prioritized,
    ...DEFAULT_ARENA_DIRECTIONS.filter((direction) =>
      !prioritized.includes(direction) && !expensiveDirections.includes(direction)
    ),
    ...DEFAULT_ARENA_DIRECTIONS.filter((direction) =>
      !prioritized.includes(direction) && expensiveDirections.includes(direction)
    )
  ];
}

function arenaAdaptiveDirectionFocus(
  findingClusters: CandidateArenaFindingClusterReadModel[]
): ArenaAdaptiveDirectionFocus[] {
  const focusByDirection = new Map<ResearchDirectionKind, ArenaAdaptiveDirectionFocus>();

  for (const cluster of findingClusters) {
    const direction = adaptiveDirectionForCluster(cluster);
    const focus = adaptiveDirectionFocusFromCluster(direction, cluster);
    const existing = focusByDirection.get(direction);
    if (!existing) {
      focusByDirection.set(direction, focus);
      continue;
    }
    focusByDirection.set(direction, {
      ...existing,
      focus_score: existing.focus_score + focus.focus_score,
      focus_reason: [existing.focus_reason, focus.focus_reason].join(";"),
      next_research_focus: existing.focus_score >= focus.focus_score
        ? existing.next_research_focus
        : focus.next_research_focus
    });
  }

  return [...focusByDirection.values()]
    .sort((a, b) =>
      b.focus_score - a.focus_score ||
      DEFAULT_ARENA_DIRECTIONS.indexOf(a.direction_kind) - DEFAULT_ARENA_DIRECTIONS.indexOf(b.direction_kind)
    )
    .slice(0, DEFAULT_ARENA_DIRECTIONS.length);
}

function arenaResearchEfficiencyBudgetFocus(
  latestTicks: CandidateArenaTickReadModel[]
): ArenaAdaptiveDirectionFocus[] {
  return [...latestResearchEfficiencyByDirection(latestTicks).entries()]
    .map(([direction, efficiency]) => ({
      direction,
      efficiency,
      focusScore: researchEfficiencyBudgetFocusScore(efficiency)
    }))
    .filter((entry) => entry.focusScore > 0)
    .sort((a, b) =>
      b.focusScore - a.focusScore ||
      DEFAULT_ARENA_DIRECTIONS.indexOf(a.direction) - DEFAULT_ARENA_DIRECTIONS.indexOf(b.direction)
    )
    .map((entry) => ({
      direction_kind: entry.direction,
      focus_score: entry.focusScore,
      focus_reason: "research_efficiency_budget:low_cost_latency",
      next_research_focus: "Favor lower-cost ResearchDirection lanes while expensive lanes cool down.",
      authority_status: "not_promotion_authority"
    }));
}

function arenaResearchEfficiencyExpensiveDirections(
  latestTicks: CandidateArenaTickReadModel[]
): ResearchDirectionKind[] {
  return [...latestResearchEfficiencyByDirection(latestTicks).entries()]
    .filter(([, efficiency]) => researchEfficiencyBudgetFocusScore(efficiency) <= 0)
    .map(([direction]) => direction);
}

function latestResearchEfficiencyByDirection(
  latestTicks: CandidateArenaTickReadModel[]
): Map<ResearchDirectionKind, CandidateArenaResearchEfficiencyReadModel> {
  const latestByDirection = new Map<ResearchDirectionKind, CandidateArenaResearchEfficiencyReadModel>();
  for (const tick of latestTicks) {
    for (const result of tick.direction_results) {
      if (
        !result.research_efficiency ||
        !isDefaultArenaDirection(result.direction_kind) ||
        latestByDirection.has(result.direction_kind)
      ) {
        continue;
      }
      latestByDirection.set(result.direction_kind, result.research_efficiency);
    }
  }
  return latestByDirection;
}

function researchEfficiencyBudgetFocusScore(
  efficiency: CandidateArenaResearchEfficiencyReadModel
): number {
  const effortUnits = efficiency.provider_request_total +
    (efficiency.runner_command_total * 2) +
    efficiency.scenario_count +
    Math.ceil(efficiency.elapsed_ms / 1000);
  return 26 - effortUnits;
}

function uniqueDirections(directions: ResearchDirectionKind[]): ResearchDirectionKind[] {
  return directions.filter((direction, index) => directions.indexOf(direction) === index);
}

function isDefaultArenaDirection(direction: ResearchDirectionKind): boolean {
  return DEFAULT_ARENA_DIRECTIONS.includes(direction);
}

function adaptiveDirectionFocusFromCluster(
  direction: ResearchDirectionKind,
  cluster: CandidateArenaFindingClusterReadModel
): ArenaAdaptiveDirectionFocus {
  return {
    direction_kind: direction,
    source_direction_kind: cluster.direction_kind === direction ? undefined : cluster.direction_kind,
    focus_score: adaptiveDirectionFocusScore(cluster),
    focus_reason: [
      cluster.protocol_failure_kind,
      cluster.blocker_group_kind,
      cluster.top_blocker
    ].filter(Boolean).join(":") || "paper_finding_cluster",
    next_research_focus: adaptiveDirectionNextResearchFocus(cluster),
    authority_status: "not_promotion_authority"
  };
}

function adaptiveDirectionForCluster(
  cluster: CandidateArenaFindingClusterReadModel
): ResearchDirectionKind {
  if (
    cluster.protocol_failure_kind === "public_execution_evidence_gap" ||
    cluster.blocker_group_kind === "fill_provenance" ||
    cluster.protocol_failure_kind === "trading_system_protocol_error" ||
    cluster.protocol_failure_kind === "ledger_gap" ||
    cluster.protocol_failure_kind === "sandbox_or_runner_failure" ||
    cluster.protocol_failure_kind === "runner_health_loss"
  ) {
    return "execution_cost_robustness";
  }
  if (cluster.protocol_failure_kind === "risk_rejection") {
    return "funding_aware_risk";
  }
  if (
    cluster.protocol_failure_kind === "market_data_gap" ||
    cluster.blocker_group_kind === "market_provenance" ||
    cluster.market_regime === "volatile"
  ) {
    return "volatility_regime";
  }
  if (cluster.market_regime === "flat") {
    return "mean_reversion";
  }
  return cluster.direction_kind;
}

function adaptiveDirectionFocusScore(cluster: CandidateArenaFindingClusterReadModel): number {
  return (cluster.candidate_count * 10) +
    (cluster.protocol_failure_kind ? 20 : 0) +
    (cluster.blocker_group_kind ? 5 : 0) +
    (cluster.top_blocker ? 2 : 0) +
    (cluster.market_regime === "volatile" ? 3 : 0);
}

function adaptiveDirectionNextResearchFocus(cluster: CandidateArenaFindingClusterReadModel): string {
  if (cluster.protocol_failure_kind) {
    return nextResearchFocusForFailureKind(cluster.protocol_failure_kind);
  }
  return cluster.next_research_focus;
}

function nextResearchFocusForFailureKind(kind: PaperTradingFailureKind): string {
  switch (kind) {
    case "market_data_gap":
      return "Restore Gateway market data before continuing paper evidence.";
    case "public_execution_evidence_gap":
      return "Restore public execution evidence before trusting fills or paper score.";
    case "trading_system_protocol_error":
      return "Fix the TradingSystem paper event protocol before retrying observation.";
    case "risk_rejection":
      return "Review order sizing, side, and risk limits before continuing paper evidence.";
    case "sandbox_or_runner_failure":
      return "Repair or resume the runner before treating paper evidence as current.";
    case "runner_health_loss":
      return "Resume paper trading before review.";
    case "ledger_gap":
      return "Inspect order, Gateway, and execution records before trusting the observation.";
    case "authority_boundary_violation":
      return "Reject or repair the candidate before any further review.";
    case "unknown_failure":
      return "Inspect the raw failure reason and add a classifier if this recurs.";
  }
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
    .map(({ candidate, entry, paperEvaluation, paperObservations }) => {
      const latestObservation = paperObservations.at(-1);
      const latestMarketSnapshot = latestObservation?.market_snapshot;
      const latestPublicExecutionSnapshot = latestObservation?.public_execution_snapshot ??
        paperEvaluation?.latest_public_execution_snapshot;
      const qualification = qualifyPaperTradingEvaluation({
        evaluation: paperEvaluation!,
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

async function arenaPaperEvidenceCandidates(
  store: OuroborosStorePort,
  arena: CandidateArenaReadModel
): Promise<Array<{
  entry?: CandidateArenaReadModel["leaderboard"][number];
  candidate?: CandidateInspectReadModel;
  paperEvaluation?: Awaited<ReturnType<OuroborosStorePort["getLatestPaperTradingEvaluationForCandidate"]>>;
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
    if (candidate?.ledger?.has_activity || paperEvaluation) {
      candidateIds.add(summary.candidate_id);
    }
  }));

  return Promise.all([...candidateIds].map(async (candidateId) => {
    const candidate = await store.getCandidate(candidateId);
    const paperEvaluation = candidate
      ? await store.getLatestPaperTradingEvaluationForCandidate(candidate.candidate_id)
      : undefined;
    const paperObservations = paperEvaluation
      ? await store.listPaperTradingObservations(paperEvaluation.paper_trading_evaluation_id)
      : [];
    return {
      entry: entriesByCandidateId.get(candidateId),
      candidate,
      paperEvaluation,
      paperObservations
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
    status: latestResult?.status === "failed" ? "failed" : "active",
    authority_status: "research_only"
  };
}

function researchEfficiencySummary(entry: TradingResearchNotebookEntry): CandidateArenaResearchEfficiencyReadModel {
  const scenarioResults = entry.evaluation.scenario_results ?? [];
  return {
    provider_request_total: scenarioResults.reduce(
      (total, result) => total + result.provider_request_count,
      0
    ),
    runner_command_total: scenarioResults.reduce(
      (total, result) => total + result.runner_command_count,
      0
    ),
    scenario_count: scenarioResults.length,
    elapsed_ms: elapsedMs(entry.started_at, entry.completed_at),
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
  totalDirectionCount: number;
  createdCandidateIds: string[];
  directionResults: CandidateArenaTickDirectionResultReadModel[];
}): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${safeId(input.tickId)}`,
    tick_id: input.tickId,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    status: candidateArenaTickStatus(input.createdCandidateIds.length, input.totalDirectionCount),
    source_candidate: input.sourceCandidate,
    created_candidate_refs: input.createdCandidateIds.map((candidateId) =>
      ref("trading_system_candidate", candidateId)
    ),
    direction_results: input.directionResults,
    authority_status: "not_live"
  };
}

function toCandidateArenaTickReadModel(tick: CandidateArenaTickRecord): CandidateArenaTickReadModel {
  return {
    tick_id: tick.tick_id,
    started_at: tick.started_at,
    completed_at: tick.completed_at,
    status: tick.status,
    ...(tick.source_candidate ? { source_candidate: tick.source_candidate } : {}),
    created_candidate_ids: tick.created_candidate_refs.map((candidate) => candidate.id),
    direction_results: tick.direction_results,
    ...(tick.paper_trading_continuation
      ? { paper_trading_continuation: tick.paper_trading_continuation }
      : {}),
    authority_status: tick.authority_status
  };
}

function candidateArenaTickStatus(createdCount: number, totalDirectionCount: number): CandidateArenaTickStatus {
  if (createdCount === totalDirectionCount) {
    return "completed";
  }
  return createdCount > 0 ? "completed_with_errors" : "failed";
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

async function fileDigest(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
