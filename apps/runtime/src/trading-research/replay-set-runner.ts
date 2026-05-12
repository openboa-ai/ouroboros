import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HostTradingArtifactRunner, type TradingArtifactRunner } from "./artifact-runner";
import { evaluateTradingRun } from "./evaluator";
import {
  defaultReplayTradingScenarioSet,
  type ReplayTradingApiProviderOptions,
  startReplayTradingApiProvider
} from "./replay-trading-api-provider";
import type {
  ReplayTradingScenario,
  TradingArtifactCommandEvidence,
  TradingArtifactCommandEvidenceSummary,
  TradingEvaluationResult,
  TradingScenarioEvaluationResult,
  TradingSystemManifest
} from "./types";

export interface TradingReplaySetRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  output_dir: string;
  scenarios?: ReplayTradingScenario[];
  artifact_runner?: TradingArtifactRunner;
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

  const artifactRunner = input.artifact_runner ?? new HostTradingArtifactRunner();
  await mkdir(input.output_dir, { recursive: true });
  const scenarioResults: TradingScenarioEvaluationResult[] = [];

  for (const scenario of scenarios) {
    const provider = await startReplayTradingApiProvider(
      scenario,
      replayProviderOptionsFor(artifactRunner.kind)
    );
    try {
      const run = await artifactRunner.run({
        artifact_dir: input.artifact_dir,
        manifest: input.manifest,
        provider,
        output_dir: path.join(input.output_dir, sanitizePathSegment(scenario.id))
      });
      const evaluation = evaluateTradingRun(run);
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
        events_path: run.events_path,
        provider_request_count: run.provider_requests.length,
        runner_command_count: run.command_evidence?.length ?? 0,
        runner_command_evidence: commandEvidenceSummaries(run.command_evidence)
      });
    } finally {
      await provider.close();
    }
  }

  const eventsPath = path.join(input.output_dir, "replay-set.json");
  const evaluation = aggregateScenarioResults(scenarioResults);
  await writeFile(
    eventsPath,
    `${JSON.stringify({
      scenario_results: scenarioResults,
      aggregate: {
        status: evaluation.status,
        score: evaluation.score,
        risk_decision: evaluation.risk_decision,
        summary: evaluation.summary
      }
    }, null, 2)}\n`,
    "utf8"
  );

  return {
    evaluation,
    scenario_results: scenarioResults,
    events_path: eventsPath
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
  const status = acceptedCount === scenarioCount ? "accepted" : "disqualified";
  const riskDecision = aggregateRiskDecision(scenarioResults);

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
      }
    ],
    summary: status === "accepted"
      ? `Accepted replay set with average score ${score.toFixed(3)} across ${scenarioCount} scenarios.`
      : `Rejected replay set with average score ${score.toFixed(3)} across ${scenarioCount} scenarios.`,
    risk_decision: riskDecision,
    scenario_results: scenarioResults
  };
}

function aggregateRiskDecision(
  scenarioResults: TradingScenarioEvaluationResult[]
): TradingEvaluationResult["risk_decision"] {
  if (scenarioResults.every((result) => result.risk_decision === "valid_order_intent")) {
    return "valid_order_intent";
  }
  if (scenarioResults.every((result) => result.risk_decision === "no_order_intent")) {
    return "no_order_intent";
  }
  return "invalid_order_intent";
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
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
