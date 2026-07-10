import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DockerSandboxesSbxTradingArtifactRunner, type TradingArtifactRunner } from "./artifact-runner";
import { evaluateTradingRun } from "./evaluator";
import {
  defaultReplayTradingScenarioSet,
  type ReplayTradingApiProviderOptions,
  startReplayTradingApiProvider,
  toReplayTradingCandidateInput
} from "./replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  ReplayTradingScenario,
  TradingArtifactCommandEvidence,
  TradingArtifactCommandEvidenceSummary,
  TradingEvaluationResult,
  TradingProfitLoss,
  TradingScenarioEvaluationResult,
  TradingSystemManifest
} from "./types";

export type ReplayTradingApiProviderFactory = (
  input: ReplayTradingCandidateInput,
  options: ReplayTradingApiProviderOptions
) => Promise<ReplayTradingApiProviderSession>;

export interface TradingReplaySetRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  output_dir: string;
  scenarios?: ReplayTradingScenario[];
  artifact_runner?: TradingArtifactRunner;
  replay_provider_factory?: ReplayTradingApiProviderFactory;
}

export interface TradingReplaySetRunnerResult {
  evaluation: TradingEvaluationResult;
  scenario_results: TradingScenarioEvaluationResult[];
  events_path: string;
}

export async function runTradingReplaySet(
  input: TradingReplaySetRunnerInput
): Promise<TradingReplaySetRunnerResult> {
  const scenarios = input.scenarios ?? defaultReplayTradingScenarioSet;
  if (scenarios.length === 0) {
    throw new Error("Replay scenario set must include at least one scenario");
  }

  const artifactRunner = input.artifact_runner ?? new DockerSandboxesSbxTradingArtifactRunner();
  const outputRoot = safeAbsoluteRoot(input.output_dir);
  await mkdir(outputRoot, { recursive: true });
  const scenarioResults: TradingScenarioEvaluationResult[] = [];

  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    const scenarioSlot = `scenario-${String(scenarioIndex + 1).padStart(3, "0")}`;
    const scenarioOutputDir = resolvePathInsideRoot(outputRoot, [scenarioSlot], "scenario_output_dir");
    const provider = await (input.replay_provider_factory ?? startReplayTradingApiProvider)(
      toReplayTradingCandidateInput(scenario),
      replayProviderOptionsFor(artifactRunner.kind)
    );
    try {
      const run = await artifactRunner.run({
        artifact_dir: input.artifact_dir,
        manifest: input.manifest,
        provider,
        output_dir: scenarioOutputDir
      });
      const evaluation = evaluateTradingRun(run, scenario);
      scenarioResults.push({
        scenario_id: scenario.id,
        runner_kind: run.runner_kind,
        sandbox_name: run.sandbox_name,
        status: evaluation.status,
        run_status: run.status,
        score: evaluation.score,
        metrics: evaluation.metrics,
        summary: evaluation.summary,
        risk_decision: evaluation.risk_decision,
        profit_loss: evaluation.profit_loss,
        disqualification_reason: evaluation.disqualification_reason,
        events_path: run.events_path,
        provider_request_count: run.provider_requests.length,
        runner_command_count: run.command_evidence?.length ?? 0,
        runner_command_evidence: commandEvidenceSummaries(run.command_evidence),
        candidate_events: run.events.map((event) => ({ ...event })),
        provider_requests: run.provider_requests.map((request) => ({ ...request }))
      });
    } finally {
      try {
        await provider.close();
      } finally {
        await rm(scenarioOutputDir, { recursive: true, force: true });
      }
    }
  }

  const eventsPath = resolvePathInsideRoot(outputRoot, ["replay-set.json"], "replay_set_events");
  const evaluation = aggregateScenarioResults(scenarioResults);
  await writeFile(
    eventsPath,
    `${JSON.stringify({
      aggregate: toResearchPreflightFeedback(evaluation)
    }, null, 2)}\n`,
    "utf8"
  );

  return {
    evaluation,
    scenario_results: scenarioResults,
    events_path: eventsPath
  };
}

export function toResearchPreflightFeedback(
  evaluation: TradingEvaluationResult
): TradingEvaluationResult {
  return {
    status: evaluation.status,
    score: evaluation.score,
    metrics: evaluation.metrics.map((metric) => ({ ...metric })),
    summary: evaluation.summary,
    risk_decision: evaluation.risk_decision,
    profit_loss: { ...evaluation.profit_loss },
    ...(evaluation.disqualification_reason === undefined
      ? {}
      : { disqualification_reason: evaluation.disqualification_reason })
  };
}

function aggregateScenarioResults(
  scenarioResults: TradingScenarioEvaluationResult[]
): TradingEvaluationResult {
  const scenarioCount = scenarioResults.length;
  const acceptedCount = scenarioResults.filter((result) => result.status === "accepted").length;
  const score = roundScore(
    scenarioResults.reduce((total, result) => total + result.score, 0) / scenarioCount
  );
  const profitLoss = aggregateProfitLoss(scenarioResults.map((result) => result.profit_loss));
  const status = acceptedCount === scenarioCount ? "accepted" : "disqualified";
  const riskDecision = aggregateRiskDecision(scenarioResults);
  const providerBoundaryScore = aggregateMetricScore(scenarioResults, "provider_boundary");

  return {
    status,
    score,
    metrics: [
      {
        name: "replay_set_average",
        score,
        detail: `average score across ${scenarioCount} replay scenarios`
      },
      {
        name: "scenario_acceptance",
        score: roundScore(acceptedCount / scenarioCount),
        detail: `${acceptedCount}/${scenarioCount} replay scenarios accepted`
      },
      {
        name: "provider_boundary",
        score: providerBoundaryScore,
        detail: `aggregate external provider protocol score across ${scenarioCount} replay scenarios`
      },
      {
        name: "net_revenue",
        score: profitLoss.net_revenue_usdt > 0 ? 1 : 0,
        detail: `aggregate net revenue ${profitLoss.net_revenue_usdt.toFixed(6)} USDT after costs`
      }
    ],
    summary: status === "accepted"
      ? `Accepted replay set with net revenue ${profitLoss.net_revenue_usdt.toFixed(6)} USDT after costs across ${scenarioCount} scenarios.`
      : `Rejected replay set with net revenue ${profitLoss.net_revenue_usdt.toFixed(6)} USDT after costs across ${scenarioCount} scenarios.`,
    risk_decision: riskDecision,
    profit_loss: profitLoss,
    ...(status === "accepted"
      ? {}
      : {
          disqualification_reason: aggregateDisqualificationReason(scenarioResults)
        }),
    scenario_results: scenarioResults
  };
}

function aggregateMetricScore(
  scenarioResults: TradingScenarioEvaluationResult[],
  metricName: string
): number {
  const total = scenarioResults.reduce((sum, result) =>
    sum + (result.metrics.find((metric) => metric.name === metricName)?.score ?? 0), 0
  );
  return roundScore(total / scenarioResults.length);
}

function aggregateDisqualificationReason(
  scenarioResults: TradingScenarioEvaluationResult[]
): NonNullable<TradingEvaluationResult["disqualification_reason"]> {
  const reasons = scenarioResults
    .filter((result) => result.status === "disqualified")
    .map((result) => result.disqualification_reason)
    .filter((reason): reason is NonNullable<typeof reason> => reason !== undefined);
  return reasons.find(isBoundaryIntegrityReason) ?? reasons[0] ?? "unreproducible";
}

function isBoundaryIntegrityReason(
  reason: NonNullable<TradingEvaluationResult["disqualification_reason"]>
): boolean {
  return reason === "data_leakage" ||
    reason === "lookahead_leakage" ||
    reason === "runtime_self_report_only";
}

function aggregateProfitLoss(items: TradingProfitLoss[]): TradingProfitLoss {
  const total = items.reduce(
    (acc, item) => ({
      revenue_usdt: acc.revenue_usdt + item.revenue_usdt,
      cost_usdt: acc.cost_usdt + item.cost_usdt,
      net_revenue_usdt: acc.net_revenue_usdt + item.net_revenue_usdt,
      net_return_pct: acc.net_return_pct + item.net_return_pct
    }),
    {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    }
  );
  return {
    revenue_usdt: roundProfit(total.revenue_usdt),
    cost_usdt: roundProfit(total.cost_usdt),
    net_revenue_usdt: roundProfit(total.net_revenue_usdt),
    net_return_pct: roundProfit(total.net_return_pct)
  };
}

function aggregateRiskDecision(
  scenarioResults: TradingScenarioEvaluationResult[]
): TradingEvaluationResult["risk_decision"] {
  if (scenarioResults.every((result) => result.risk_decision === "valid_order_request")) {
    return "valid_order_request";
  }
  if (scenarioResults.every((result) => result.risk_decision === "no_order_request")) {
    return "no_order_request";
  }
  return "invalid_order_request";
}

function safeAbsoluteRoot(rootPath: string): string {
  return path.resolve(rootPath);
}

function resolvePathInsideRoot(rootPath: string, segments: string[], label: string): string {
  const safeRoot = safeAbsoluteRoot(rootPath);
  const resolved = path.resolve(safeRoot, ...segments);
  const rootPrefix = safeRoot.endsWith(path.sep) ? safeRoot : `${safeRoot}${path.sep}`;
  if (resolved !== safeRoot && !resolved.startsWith(rootPrefix)) {
    throw new Error(`${label} must stay under its configured root`);
  }
  return resolved;
}

function commandEvidenceSummaries(
  evidence: TradingArtifactCommandEvidence[] | undefined
): TradingArtifactCommandEvidenceSummary[] | undefined {
  if (!evidence?.length) {
    return undefined;
  }
  return evidence.map((item) => ({
    command: item.command,
    exit_code: item.exit_code,
    signal: item.signal,
    timed_out: item.timed_out,
    error_message: item.error_message,
    stdout_preview: preview(item.stdout),
    stderr_preview: preview(item.stderr),
    started_at: item.started_at,
    completed_at: item.completed_at
  }));
}

function preview(value: string): string {
  return value.length <= 2_000 ? value : `${value.slice(0, 2_000)}...[truncated]`;
}

function roundScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 1_000) / 1_000;
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function replayProviderOptionsFor(
  artifactRunnerKind: TradingArtifactRunner["kind"]
): ReplayTradingApiProviderOptions {
  if (artifactRunnerKind !== "docker_sandboxes_sbx") {
    return {};
  }
  if (process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_TRANSPORT !== "host_url") {
    return {};
  }
  return {
    listen_host: process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_LISTEN_HOST ?? "0.0.0.0",
    sandbox_host: process.env.OUROBOROS_TRADING_REPLAY_SANDBOX_HOST ?? "host.docker.internal"
  };
}
