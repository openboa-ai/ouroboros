import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CodexTradingResearchAgentAdapter } from "./agent-adapters";
import {
  DockerSandboxesSbxTradingArtifactRunner,
  HostTradingArtifactRunner,
  readTradingSystemManifest,
  type TradingArtifactRunner
} from "./artifact-runner";
import {
  runTradingDevelopmentReplaySet,
  runTradingSealedAdmission,
  toResearchPreflightFeedback
} from "./replay-set-runner";
import type { ReplayTradingApiProviderFactory } from "./replay-set-runner";
import { sealSingleFileTradingArtifactClosure } from "./artifact-closure";
import {
  buildResearchPreflightPlan,
  generateResearchPreflightEvaluatorSeed,
  type ResearchPreflightPlanHandle
} from "./preflight-plan";
import {
  createTradingResearchAgentAdapter,
  loadTradingResearchRuntimeConfig,
  type TradingResearchReasoningEffort,
  type TradingResearchRuntimeAgent
} from "./runtime-config";
import type {
  TradingArtifactRunnerKind,
  TradingResearchAgentAdapter,
  TradingResearchLoopResult,
  TradingResearchMode,
  TradingResearchNotebook,
  TradingResearchNotebookEntry
} from "./types";

const ZERO_PROFIT_LOSS = {
  revenue_usdt: 0,
  cost_usdt: 0,
  net_revenue_usdt: 0,
  net_return_pct: 0
};

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
  artifact_runner?: TradingArtifactRunner;
  artifact_runner_kind?: TradingArtifactRunnerKind;
  replay_provider_factory?: ReplayTradingApiProviderFactory;
  arena_context?: string;
  preflight_plan?: ResearchPreflightPlanHandle;
}

export async function runTradingResearchLoop(
  input: RunTradingResearchLoopInput = {}
): Promise<TradingResearchLoopResult> {
  const repoRoot = input.repo_root ?? process.cwd();
  const sessionId = input.session_id ?? timestampId(new Date());
  const runRoot = input.run_root ?? path.join(repoRoot, ".ouroboros/trading-research", sessionId);
  const artifactSourceDir = input.artifact_source_dir ?? path.join(repoRoot, "artifacts/trading-system");
  const programPath = input.program_path ?? path.join(repoRoot, "research/program.md");
  const iterations = input.iterations ?? 2;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 2) {
    throw new Error("research_preflight_development_budget_invalid");
  }
  const mode = input.mode ?? "replay";
  const adapter = input.agent_adapter ?? new CodexTradingResearchAgentAdapter({
    timeout_ms: input.agent_timeout_ms
  });
  const artifactRunner = input.artifact_runner ?? artifactRunnerFor(input.artifact_runner_kind);
  const notebookPath = path.join(runRoot, "notebook.json");
  const bestDir = path.join(runRoot, "best");
  const seedDir = path.join(runRoot, "seed");

  await mkdir(runRoot, { recursive: true });
  await rm(seedDir, { recursive: true, force: true });
  await cp(artifactSourceDir, seedDir, { recursive: true });
  const frozenManifest = await readTradingSystemManifest(seedDir);
  const sealedSource = await sealSingleFileTradingArtifactClosure(seedDir, frozenManifest);
  const preflightPlan = input.preflight_plan ?? buildStandalonePreflightPlan({
    sessionId,
    iterations,
    sourceArtifactDigest: sealedSource.closure_digest
  });
  assertPreflightPlanMatches(preflightPlan, iterations, sealedSource.closure_digest);
  const developmentSuite = preflightPlan.evaluatorDevelopmentSuite();
  if (developmentSuite.suite_digest !==
    preflightPlan.commitment.development_policy.suite_digest) {
    throw new Error("research_preflight_development_suite_mismatch");
  }
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
      previous_best_score: Number.isFinite(bestScore) ? bestScore : undefined,
      arena_context: input.arena_context
    });
    if (agentResult.status === "failed") {
      const entry: TradingResearchNotebookEntry = {
        iteration,
        decision: "crash",
        score: 0,
        summary: agentResult.error ?? agentResult.summary,
        agent_status: agentResult.status,
        agent_summary: agentResult.summary,
        agent_changed_paths: agentResult.changed_paths,
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
          risk_decision: "no_order_request",
          profit_loss: ZERO_PROFIT_LOSS
        }
      };
      notebook.entries.push(entry);
      await writeNotebook(notebookPath, notebook);
      continue;
    }

    const replaySet = await runTradingDevelopmentReplaySet({
      artifact_dir: candidateDir,
      manifest: frozenManifest,
      output_dir: outputDir,
      scenarios: developmentSuite.scenarios,
      artifact_runner: artifactRunner,
      replay_provider_factory: input.replay_provider_factory
    });

    const evaluation = replaySet.evaluation;
    const crashed = replaySet.scenario_results.some((result) => result.run_status === "crashed");
    const decision = crashed
      ? "crash"
      : evaluation.status === "accepted" && evaluation.score > bestScore
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
      agent_status: agentResult.status,
      agent_summary: agentResult.summary,
      agent_changed_paths: agentResult.changed_paths,
      agent_command: agentResult.command,
      artifact_dir: candidateDir,
      events_path: replaySet.events_path,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      evaluation
    };
    notebook.entries.push(entry);
    notebook.best_score = Number.isFinite(bestScore) ? bestScore : undefined;
    notebook.best_artifact_dir = bestArtifactDir;
    await writeNotebook(notebookPath, notebook);
  }

  let submittedArtifactDir: string | undefined;
  let submittedArtifactDigest: string | undefined;
  let sealedAdmission: TradingResearchLoopResult["sealed_admission"];
  if (bestArtifactDir) {
    submittedArtifactDir = path.join(runRoot, "submitted-artifact");
    await rm(submittedArtifactDir, { recursive: true, force: true });
    await cp(bestArtifactDir, submittedArtifactDir, { recursive: true });
    const submittedArtifact = await sealSingleFileTradingArtifactClosure(
      submittedArtifactDir,
      frozenManifest
    );
    submittedArtifactDigest = submittedArtifact.closure_digest;
    const sealedSuite = preflightPlan.claimSealedAdmissionSuite();
    if (sealedSuite.suite_digest !==
      preflightPlan.commitment.sealed_admission_policy.suite_digest) {
      throw new Error("research_preflight_sealed_suite_mismatch");
    }
    const sealed = await runTradingSealedAdmission({
      artifact_dir: submittedArtifactDir,
      manifest: frozenManifest,
      output_dir: path.join(runRoot, "sealed-admission"),
      scenarios: sealedSuite.scenarios,
      artifact_runner: artifactRunner,
      replay_provider_factory: input.replay_provider_factory
    });
    const conformanceDigest = sealed.evaluation.paper_handoff_conformance
      ?.system_code_artifact_digest;
    if (conformanceDigest !== undefined && conformanceDigest !== submittedArtifactDigest) {
      throw new Error("research_preflight_sealed_artifact_mismatch");
    }
    sealedAdmission = {
      commitment_id: preflightPlan.commitment.research_preflight_commitment_id,
      commitment_digest: preflightPlan.commitment.commitment_digest,
      suite_digest: sealedSuite.suite_digest,
      submission_sequence: 1,
      artifact_digest: submittedArtifactDigest,
      events_path: sealed.events_path,
      evaluation: sealed.evaluation
    };
  }

  return {
    session_id: sessionId,
    run_root: runRoot,
    notebook_path: notebookPath,
    research_preflight_commitment: preflightPlan.commitment,
    best_score: Number.isFinite(bestScore) ? bestScore : undefined,
    best_artifact_dir: bestArtifactDir,
    submitted_artifact_dir: submittedArtifactDir,
    submitted_artifact_digest: submittedArtifactDigest,
    sealed_admission: sealedAdmission,
    entries: notebook.entries
  };
}

function buildStandalonePreflightPlan(input: {
  sessionId: string;
  iterations: number;
  sourceArtifactDigest: string;
}): ResearchPreflightPlanHandle {
  const allocationDigest = sha256(`standalone-allocation:${input.sessionId}:${input.iterations}`);
  return buildResearchPreflightPlan({
    candidate_arena_tick_id: `standalone-${input.sessionId}`,
    research_direction_ref: {
      record_kind: "research_direction",
      id: `standalone-direction-${input.sessionId}`
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: `standalone-worker-${input.sessionId}`
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: `standalone-allocation-${input.sessionId}`
    },
    research_allocation_digest: allocationDigest,
    source_system_code_ref: {
      record_kind: "system_code",
      id: `standalone-source-system-code-${input.sessionId}`
    },
    source_artifact_digest: input.sourceArtifactDigest,
    development_submission_limit: input.iterations,
    committed_at: new Date().toISOString(),
    evaluator_seed: generateResearchPreflightEvaluatorSeed()
  });
}

function assertPreflightPlanMatches(
  plan: ResearchPreflightPlanHandle,
  iterations: number,
  sourceArtifactDigest: string
): void {
  plan.assertSealedAdmissionUnclaimed();
  if (plan.commitment.development_policy.submission_limit !== iterations ||
    plan.commitment.source_artifact_digest !== sourceArtifactDigest) {
    throw new Error("research_preflight_plan_binding_mismatch");
  }
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function writeNotebook(pathname: string, notebook: TradingResearchNotebook): Promise<void> {
  await mkdir(path.dirname(pathname), { recursive: true });
  const researchWorkerNotebook: TradingResearchNotebook = {
    ...notebook,
    agent: { ...notebook.agent },
    entries: notebook.entries.map((entry) => ({
      ...entry,
      evaluation: toResearchPreflightFeedback(entry.evaluation)
    }))
  };
  await writeFile(pathname, `${JSON.stringify(researchWorkerNotebook, null, 2)}\n`, "utf8");
}

function timestampId(date: Date): string {
  return date.toISOString().replace(/[^0-9]+/g, "").slice(0, 14);
}

function artifactRunnerFor(kind: TradingArtifactRunnerKind | undefined): TradingArtifactRunner | undefined {
  if (!kind || kind === "docker_sandboxes_sbx") {
    return new DockerSandboxesSbxTradingArtifactRunner();
  }
  if (kind === "host_process") {
    return new HostTradingArtifactRunner();
  }
  return undefined;
}

function parseCliArgs(args: string[]): RunTradingResearchLoopInput & {
  agent?: TradingResearchRuntimeAgent;
  agent_command?: string;
  model?: string;
  reasoning_effort?: TradingResearchReasoningEffort;
} {
  const config = loadTradingResearchRuntimeConfig(process.env, { iterations: 2 });
  const parsed: RunTradingResearchLoopInput & {
    agent?: TradingResearchRuntimeAgent;
    agent_command?: string;
    model?: string;
    reasoning_effort?: TradingResearchReasoningEffort;
  } = {
    iterations: config.iterations
  };
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
      parsed.agent = parseTradingResearchAgent(next);
      index += 1;
    } else if (arg === "--model" && next) {
      parsed.model = next;
      index += 1;
    } else if (arg === "--agent-command" && next) {
      parsed.agent_command = next;
      index += 1;
    } else if (arg === "--reasoning-effort" && next) {
      parsed.reasoning_effort = parseReasoningEffort(next);
      index += 1;
    } else if (arg === "--agent-timeout-ms" && next) {
      parsed.agent_timeout_ms = Number(next);
      index += 1;
    } else if (arg === "--artifact-runner" && next) {
      parsed.artifact_runner_kind = parseArtifactRunnerKind(next);
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
  parsed.agent_adapter = createTradingResearchAgentAdapter({
    ...config,
    default_agent: parsed.agent ?? config.default_agent,
    codex: {
      ...config.codex,
      command: parsed.agent_command ?? config.codex.command,
      model: parsed.model ?? config.codex.model,
      timeout_ms: parsed.agent_timeout_ms ?? config.codex.timeout_ms,
      reasoning_effort: parsed.reasoning_effort ?? config.codex.reasoning_effort
    }
  }, parsed.agent ?? config.default_agent);
  return parsed;
}

function parseTradingResearchAgent(value: string): TradingResearchRuntimeAgent {
  if (value === "codex" || value === "fixture") {
    return value;
  }
  throw new Error("Only --agent codex and --agent fixture are supported in the S10 MVP.");
}

function parseReasoningEffort(value: string): TradingResearchReasoningEffort {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  throw new Error("Only --reasoning-effort low, medium, high, and xhigh are supported.");
}

function parseArtifactRunnerKind(value: string): TradingArtifactRunnerKind {
  if (value === "host" || value === "host_process") {
    return "host_process";
  }
  if (value === "sbx" || value === "sdx" || value === "docker_sandboxes_sbx") {
    return "docker_sandboxes_sbx";
  }
  throw new Error("Only --artifact-runner host and --artifact-runner sbx are supported in the S10 MVP.");
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
