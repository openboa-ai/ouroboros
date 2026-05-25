import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ArtifactLineageRecord,
  CandidateArenaTickDirectionResultReadModel,
  CandidateArenaTickRecord,
  CandidateArenaTickReadModel,
  CandidateArenaTickStatus,
  CandidateArenaReadModel,
  CandidateArenaResearcherReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  ExperimentRunRecord,
  Ref,
  ResearchDirectionKind,
  ResearchFindingRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import { FIXTURE_CANDIDATE_ID } from "@ouroboros/local-store";
import { safeId } from "./safe-id";
import { readTradingSystemManifest } from "./trading-research/artifact-runner";
import { FixtureTradingResearchAgentAdapter } from "./trading-research/agent-adapters";
import { runTradingResearchLoop } from "./trading-research/run-trading-research";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  TradingEvaluationResult,
  TradingResearchAgentAdapter
} from "./trading-research/types";
import type { TradingResearchRuntimeAgent } from "./trading-research/runtime-config";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

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

export interface RunCandidateArenaTickInput {
  store: LocalStore;
  sourceSystemId?: string;
  sourceCandidateVersionId?: string;
  directions?: ResearchDirectionKind[];
  tickId?: string;
  repoRoot?: string;
  researchAgent: TradingResearchRuntimeAgent;
  agentFactory: (agent: TradingResearchRuntimeAgent) => TradingResearchAgentAdapter;
}

export interface CandidateArenaTickOutcome {
  status: "completed";
  tick_id: string;
  created_candidate_count: number;
  created_candidate_ids: string[];
  arena: CandidateArenaReadModel;
}

export class CandidateArenaRunner {
  private running = false;
  private tickCount = 0;
  private loopActive = false;
  private activeTick?: Promise<CandidateArenaTickOutcome>;

  constructor(
    private readonly input: Omit<RunCandidateArenaTickInput, "tickId">,
    private readonly intervalMs = 10_000
  ) {}

  status(): "running" | "stopped" {
    return this.running ? "running" : "stopped";
  }

  ticks(): number {
    return this.tickCount;
  }

  start(): "started" | "already_running" {
    if (this.running) {
      return "already_running";
    }
    this.running = true;
    this.loop();
    return "started";
  }

  stop(): "stopped" {
    this.running = false;
    return "stopped";
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
      .finally(() => {
        this.activeTick = undefined;
      });
    return this.activeTick;
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

export async function runCandidateArenaTick(
  input: RunCandidateArenaTickInput,
  runnerStatus: "running" | "stopped" = "stopped",
  tickCount = 0
): Promise<CandidateArenaTickOutcome> {
  const source = await sourceCandidate(input.store, input.sourceSystemId, input.sourceCandidateVersionId);
  const directions = input.directions ?? DEFAULT_ARENA_DIRECTIONS;
  const tickId = input.tickId ?? `tick-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const createdCandidateIds: string[] = [];
  const directionResults: CandidateArenaTickDirectionResultReadModel[] = [];

  for (const direction of directions) {
    try {
      const created = await runArenaDirection({
        ...input,
        source,
        direction,
        tickId
      });
      createdCandidateIds.push(created.candidate_id);
      const profitLoss = created.full_cycle_lineage?.evidence?.profit_loss ?? ZERO_PROFIT_LOSS;
      directionResults.push({
        direction_kind: direction,
        status: "created",
        candidate_id: created.candidate_id,
        finding: findingSummaryForProfitLoss(
          profitLoss,
          created.full_cycle_lineage?.evidence?.evaluation_status
        ),
        net_revenue_usdt: profitLoss.net_revenue_usdt
      });
    } catch (error) {
      directionResults.push({
        direction_kind: direction,
        status: "failed",
        error: conciseError(error),
        finding: `${directionLabel(direction)} researcher failed before candidate materialization.`
      });
    }
  }

  await input.store.recordCandidateArenaTick(candidateArenaTickRecord({
    tickId,
    startedAt,
    completedAt: new Date().toISOString(),
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
  store: LocalStore,
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

  return {
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
    live_disabled: true,
    authority_status: "not_live"
  };
}

async function runArenaDirection(input: RunCandidateArenaTickInput & {
  source: CandidateInspectReadModel;
  direction: ResearchDirectionKind;
  tickId: string;
}): Promise<CandidateInspectReadModel> {
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
    arena_context: await arenaContext(input.store, input.direction)
  });
  const entry = research.entries.at(-1);
  if (!entry) {
    throw new Error("candidate_arena_missing_research_entry");
  }
  const artifactDir = research.best_artifact_dir ?? entry.artifact_dir;
  const manifest = await readTradingSystemManifest(artifactDir);
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
  return candidate;
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
  store: LocalStore,
  sourceSystemId = FIXTURE_CANDIDATE_ID,
  sourceCandidateVersionId?: string
): Promise<CandidateInspectReadModel> {
  const source = await store.getCandidate(sourceSystemId);
  if (!source) {
    throw new Error("candidate_arena_source_not_found");
  }
  if (sourceCandidateVersionId && source.candidate_version.candidate_version_id !== sourceCandidateVersionId) {
    throw new Error("candidate_arena_source_version_mismatch");
  }
  return source;
}

async function sourceResearchArtifactDir(input: {
  store: LocalStore;
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
  store: LocalStore;
  artifactDir: string;
  sessionId: string;
  manifestEntrypoint: string[];
  agent: ManagedResearchAgent;
}): Promise<SystemCodeRecord & { artifact_kind: "python_file" }> {
  const entrypointPath = input.manifestEntrypoint[1] ?? "run.py";
  const artifactPath = path.join(input.artifactDir, entrypointPath);
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
  store: LocalStore;
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

async function arenaContext(store: LocalStore, direction: ResearchDirectionKind): Promise<string> {
  const arena = await buildCandidateArenaReadModel(store, "stopped", 0);
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

function candidateArenaTickRecord(input: {
  tickId: string;
  startedAt: string;
  completedAt: string;
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
    created_candidate_ids: tick.created_candidate_refs.map((candidate) => candidate.id),
    direction_results: tick.direction_results,
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
