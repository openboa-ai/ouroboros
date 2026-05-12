import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter
} from "./agent-adapters";
import { readTradingSystemManifest, runTradingArtifact } from "./artifact-runner";
import { evaluateTradingRun } from "./evaluator";
import { startReplayTradingApiProvider } from "./replay-trading-api-provider";
import type {
  TradingResearchAgentAdapter,
  TradingResearchLoopResult,
  TradingResearchMode,
  TradingResearchNotebook,
  TradingResearchNotebookEntry
} from "./types";

export interface RunTradingResearchLoopInput {
  iterations?: number;
  mode?: TradingResearchMode;
  agent_timeout_ms?: number;
  repo_root?: string;
  artifact_source_dir?: string;
  program_path?: string;
  run_root?: string;
  session_id?: string;
  agent_adapter?: TradingResearchAgentAdapter;
}

export async function runTradingResearchLoop(
  input: RunTradingResearchLoopInput = {}
): Promise<TradingResearchLoopResult> {
  const repoRoot = input.repo_root ?? process.cwd();
  const sessionId = input.session_id ?? timestampId(new Date());
  const runRoot = input.run_root ?? path.join(repoRoot, ".ouroboros/trading-research", sessionId);
  const artifactSourceDir = input.artifact_source_dir ?? path.join(repoRoot, "artifacts/trading-system");
  const programPath = input.program_path ?? path.join(repoRoot, "research/program.md");
  const iterations = input.iterations ?? 3;
  const mode = input.mode ?? "replay";
  const adapter = input.agent_adapter ?? new CodexTradingResearchAgentAdapter({
    timeout_ms: input.agent_timeout_ms
  });
  const notebookPath = path.join(runRoot, "notebook.json");
  const bestDir = path.join(runRoot, "best");
  const seedDir = path.join(runRoot, "seed");

  await mkdir(runRoot, { recursive: true });
  await rm(seedDir, { recursive: true, force: true });
  await cp(artifactSourceDir, seedDir, { recursive: true });
  await rm(bestDir, { recursive: true, force: true });
  await cp(seedDir, bestDir, { recursive: true });

  const notebook: TradingResearchNotebook = {
    session_id: sessionId,
    mode,
    agent: adapter.agent,
    program_path: programPath,
    entries: []
  };
  await writeNotebook(notebookPath, notebook);

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestArtifactDir: string | undefined;

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const startedAt = new Date().toISOString();
    const iterationDir = path.join(runRoot, "iterations", String(iteration).padStart(3, "0"));
    const candidateDir = path.join(iterationDir, "candidate");
    const outputDir = path.join(iterationDir, "run");
    await rm(candidateDir, { recursive: true, force: true });
    await cp(bestArtifactDir ?? bestDir, candidateDir, { recursive: true });

    const agentResult = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: candidateDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration,
      previous_best_score: Number.isFinite(bestScore) ? bestScore : undefined
    });
    if (agentResult.status === "failed") {
      const entry: TradingResearchNotebookEntry = {
        iteration,
        decision: "crash",
        score: 0,
        summary: agentResult.error ?? agentResult.summary,
        agent_summary: agentResult.summary,
        agent_failure_reason: agentResult.failure_reason,
        agent_command: agentResult.command,
        artifact_dir: candidateDir,
        events_path: path.join(outputDir, "events.jsonl"),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        evaluation: {
          status: "disqualified",
          score: 0,
          metrics: [
            {
              name: "agent_edit",
              score: 0,
              detail: agentResult.error ?? "agent edit failed"
            }
          ],
          summary: "Agent failed before artifact execution.",
          risk_decision: "no_order_intent"
        }
      };
      notebook.entries.push(entry);
      await writeNotebook(notebookPath, notebook);
      continue;
    }

    const provider = await startReplayTradingApiProvider();
    const manifest = await readTradingSystemManifest(candidateDir);
    const run = await runTradingArtifact({
      artifact_dir: candidateDir,
      manifest,
      provider,
      output_dir: outputDir
    });
    await provider.close();

    const evaluation = evaluateTradingRun(run);
    const decision = run.status === "crashed"
      ? "crash"
      : evaluation.score > bestScore
        ? "keep"
        : "discard";
    if (decision === "keep") {
      bestScore = evaluation.score;
      bestArtifactDir = path.join(iterationDir, "kept-artifact");
      await rm(bestArtifactDir, { recursive: true, force: true });
      await cp(candidateDir, bestArtifactDir, { recursive: true });
      await rm(bestDir, { recursive: true, force: true });
      await cp(bestArtifactDir, bestDir, { recursive: true });
    }

    const entry: TradingResearchNotebookEntry = {
      iteration,
      decision,
      score: evaluation.score,
      summary: evaluation.summary,
      agent_summary: agentResult.summary,
      agent_command: agentResult.command,
      artifact_dir: candidateDir,
      events_path: run.events_path,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      evaluation
    };
    notebook.entries.push(entry);
    notebook.best_score = Number.isFinite(bestScore) ? bestScore : undefined;
    notebook.best_artifact_dir = bestArtifactDir;
    await writeNotebook(notebookPath, notebook);
  }

  return {
    session_id: sessionId,
    run_root: runRoot,
    notebook_path: notebookPath,
    best_score: Number.isFinite(bestScore) ? bestScore : undefined,
    best_artifact_dir: bestArtifactDir,
    entries: notebook.entries
  };
}

async function writeNotebook(pathname: string, notebook: TradingResearchNotebook): Promise<void> {
  await mkdir(path.dirname(pathname), { recursive: true });
  await writeFile(pathname, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

function timestampId(date: Date): string {
  return date.toISOString().replace(/[^0-9]+/g, "").slice(0, 14);
}

function parseCliArgs(args: string[]): RunTradingResearchLoopInput & { agent?: string; model?: string } {
  const parsed: RunTradingResearchLoopInput & { agent?: string; model?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--iterations" && next) {
      parsed.iterations = Number(next);
      index += 1;
    } else if (arg === "--mode" && next) {
      parsed.mode = next as TradingResearchMode;
      index += 1;
    } else if (arg === "--agent" && next) {
      parsed.agent = next;
      index += 1;
    } else if (arg === "--model" && next) {
      parsed.model = next;
      index += 1;
    } else if (arg === "--agent-timeout-ms" && next) {
      parsed.agent_timeout_ms = Number(next);
      index += 1;
    } else if (arg === "--run-root" && next) {
      parsed.run_root = path.resolve(next);
      index += 1;
    } else if (arg === "--artifact" && next) {
      parsed.artifact_source_dir = path.resolve(next);
      index += 1;
    } else if (arg === "--program" && next) {
      parsed.program_path = path.resolve(next);
      index += 1;
    } else if (arg === "--session-id" && next) {
      parsed.session_id = next;
      index += 1;
    }
  }
  if (parsed.mode && parsed.mode !== "replay") {
    throw new Error("Only --mode replay is supported in the S10 MVP.");
  }
  if (parsed.agent === "fixture") {
    parsed.agent_adapter = new FixtureTradingResearchAgentAdapter();
  } else if (!parsed.agent || parsed.agent === "codex") {
    parsed.agent_adapter = new CodexTradingResearchAgentAdapter({
      model: parsed.model,
      timeout_ms: parsed.agent_timeout_ms
    });
  } else {
    throw new Error("Only --agent codex and --agent fixture are supported in the S10 MVP.");
  }
  return parsed;
}

async function main(): Promise<void> {
  const result = await runTradingResearchLoop(parseCliArgs(process.argv.slice(2)));
  for (const entry of result.entries) {
    console.log(
      `iteration ${entry.iteration}: score ${entry.score.toFixed(3)} ${entry.decision} ${entry.agent_summary}`
    );
  }
  console.log(`notebook: ${result.notebook_path}`);
  if (result.best_artifact_dir) {
    console.log(`best artifact: ${result.best_artifact_dir}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export async function readNotebook(pathname: string): Promise<TradingResearchNotebook> {
  return JSON.parse(await readFile(pathname, "utf8")) as TradingResearchNotebook;
}
