import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runTradingArtifact } from "./artifact-runner";
import { evaluateTradingRun } from "./evaluator";
import {
  defaultReplayTradingScenarioSet,
  startReplayTradingApiProvider
} from "./replay-trading-api-provider";
import type {
  ReplayTradingScenario,
  TradingEvaluationResult,
  TradingScenarioEvaluationResult,
  TradingSystemManifest
} from "./types";

export interface TradingReplaySetRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  output_dir: string;
  scenarios?: ReplayTradingScenario[];
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

  await mkdir(input.output_dir, { recursive: true });
  const scenarioResults: TradingScenarioEvaluationResult[] = [];

  for (const scenario of scenarios) {
    const provider = await startReplayTradingApiProvider(scenario);
    try {
      const run = await runTradingArtifact({
        artifact_dir: input.artifact_dir,
        manifest: input.manifest,
        provider,
        output_dir: path.join(input.output_dir, sanitizePathSegment(scenario.id))
      });
      const evaluation = evaluateTradingRun(run);
      scenarioResults.push({
        scenario_id: scenario.id,
        status: evaluation.status,
        run_status: run.status,
        score: evaluation.score,
        metrics: evaluation.metrics,
        summary: evaluation.summary,
        risk_decision: evaluation.risk_decision,
        events_path: run.events_path,
        provider_request_count: run.provider_requests.length
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

function roundScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 1_000) / 1_000;
}
