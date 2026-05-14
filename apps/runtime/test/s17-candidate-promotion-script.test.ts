import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S17 Trading research candidate promotion scripts", () => {
  it("promotes a no-change seeded stability proof into a local TradingSystemCandidate", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s17-promotion-"));
    try {
      const seedArtifact = path.join(tempDir, "seed");
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      const notebookPath = path.join(tempDir, "run", "notebook.json");
      const candidateRoot = path.join(tempDir, "candidates");
      await writeArtifact(seedArtifact);
      await cp(seedArtifact, firstCandidate, { recursive: true });
      await cp(seedArtifact, bestArtifact, { recursive: true });
      await writeNotebook(notebookPath, makeNotebook({
        sessionId: "seeded-proof",
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run"),
        edited: false
      }));

      const result = await runScript([
        "scripts/trading-research-promote-candidate.mjs",
        "--notebook",
        notebookPath,
        "--gate",
        "seeded-stability",
        "--seed-artifact",
        seedArtifact,
        "--candidate-root",
        candidateRoot,
        "--candidate-id",
        "candidate-seeded-proof"
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading research candidate promotion");
      expect(result.stdout).toContain("candidate_id=candidate-seeded-proof");
      expect(result.stdout).toContain("gate=seeded-stability");
      expect(result.stdout).toContain("completion_status=incomplete");
      expect(result.stdout).toContain("seeded_stability_status=pass");
      expect(result.stdout).toContain("PROMOTION_RESULT promoted");
      expect(result.stdout).toContain("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");

      const candidateDir = path.join(candidateRoot, "candidate-seeded-proof");
      const candidate = JSON.parse(await readFile(path.join(candidateDir, "candidate.json"), "utf8"));
      const promotion = JSON.parse(await readFile(path.join(candidateDir, "promotion.json"), "utf8"));
      const artifact = JSON.parse(await readFile(path.join(candidateDir, "runnable-artifact.json"), "utf8"));
      const copiedRun = await readFile(path.join(candidateDir, "artifact", "run.py"), "utf8");

      expect(candidate).toMatchObject({
        record_kind: "trading_system_candidate",
        candidate_id: "candidate-seeded-proof",
        status: "materialized",
        candidate_status: "handoff_ready",
        evaluation_handoff_ready: true,
        authority_status: "not_live"
      });
      expect(promotion).toMatchObject({
        record_kind: "trading_research_candidate_promotion",
        gate: "seeded-stability",
        gate_status: {
          completion_status: "incomplete",
          seeded_stability_status: "pass",
          completion_missing: ["kept edited artifact"],
          seeded_stability_missing: []
        },
        evidence_disposition: "not_counted",
        authority_status: "not_live"
      });
      expect(promotion.no_authority).toEqual({
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      });
      expect(artifact).toMatchObject({
        record_kind: "runnable_artifact",
        artifact_kind: "python_file",
        runtime_kind: "python",
        entrypoint: ["python3", "run.py"],
        authority_status: "not_live"
      });
      expect(artifact.artifact_digest).toMatch(/^sha256:/);
      expect(copiedRun).toContain("RISK_FRACTION = 0.02");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not let a no-change seeded proof pass the strict completion gate", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s17-promotion-"));
    try {
      const seedArtifact = path.join(tempDir, "seed");
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      const notebookPath = path.join(tempDir, "run", "notebook.json");
      await writeArtifact(seedArtifact);
      await cp(seedArtifact, firstCandidate, { recursive: true });
      await cp(seedArtifact, bestArtifact, { recursive: true });
      await writeNotebook(notebookPath, makeNotebook({
        sessionId: "seeded-proof",
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run"),
        edited: false
      }));

      const result = await runScript([
        "scripts/trading-research-promote-candidate.mjs",
        "--notebook",
        notebookPath,
        "--gate",
        "completion",
        "--candidate-root",
        path.join(tempDir, "candidates")
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("gate=completion");
      expect(result.stdout).toContain("gate_status=incomplete");
      expect(result.stdout).toContain("MISSING kept edited artifact");
      expect(result.stdout).toContain("PROMOTION_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("promotes an edited strict completion proof through the completion gate", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s17-promotion-"));
    try {
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      const notebookPath = path.join(tempDir, "run", "notebook.json");
      const candidateRoot = path.join(tempDir, "candidates");
      await writeArtifact(firstCandidate);
      await cp(firstCandidate, bestArtifact, { recursive: true });
      await writeNotebook(notebookPath, makeNotebook({
        sessionId: "edited-proof",
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run"),
        edited: true
      }));

      const result = await runScript([
        "scripts/trading-research-promote-candidate.mjs",
        "--notebook",
        notebookPath,
        "--gate",
        "completion",
        "--candidate-root",
        candidateRoot,
        "--candidate-id",
        "candidate-edited-proof"
      ]);
      const promotion = JSON.parse(await readFile(
        path.join(candidateRoot, "candidate-edited-proof", "promotion.json"),
        "utf8"
      ));

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("completion_status=pass");
      expect(result.stdout).toContain("seeded_stability_status=incomplete");
      expect(promotion.gate).toBe("completion");
      expect(promotion.gate_status.completion_missing).toEqual([]);
      expect(promotion.gate_status.seeded_stability_missing).toContain("seed_artifact required for seeded-stability promotion");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("lists promoted candidates in the candidate ledger", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s17-ledger-"));
    try {
      await writePromotedCandidate(tempDir, "candidate-newer", "seeded-stability", "seeded-proof", "2026-05-13T14:00:00.000Z");
      await writePromotedCandidate(tempDir, "candidate-older", "completion", "edited-proof", "2026-05-13T13:00:00.000Z");

      const result = await runScript([
        "scripts/trading-candidate-ledger.mjs",
        "--root",
        tempDir,
        "--limit",
        "2"
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading candidate ledger");
      expect(result.stdout).toContain("candidates=2");
      expect(result.stdout).toContain("candidate candidate-newer gate=seeded-stability source_session=seeded-proof authority=not_live");
      expect(result.stdout).toContain("completion_status=incomplete seeded_stability_status=pass artifact_digest=sha256:candidate-newer");
      expect(result.stdout.indexOf("candidate candidate-newer")).toBeLessThan(result.stdout.indexOf("candidate candidate-older"));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm promotion and candidate ledger commands", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["trading:research:promote-candidate"])
      .toBe("node scripts/trading-research-promote-candidate.mjs");
    expect(packageJson.scripts["trading:candidate:ledger"])
      .toBe("node scripts/trading-candidate-ledger.mjs");
  });
});

async function writeNotebook(notebookPath: string, notebook: unknown): Promise<void> {
  await mkdir(path.dirname(notebookPath), { recursive: true });
  await writeFile(notebookPath, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

async function writeArtifact(artifactDir: string): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
    id: "trading-system-mvp",
    name: "Minimal Trading System MVP",
    entrypoint: ["python3", "run.py"],
    editable_paths: ["run.py"],
    api_contract: "trading_api_provider_v1"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(artifactDir, "run.py"), "RISK_FRACTION = 0.02\n", "utf8");
}

function makeNotebook(input: {
  sessionId: string;
  firstCandidate: string;
  bestArtifact: string;
  runRoot: string;
  edited: boolean;
}) {
  return {
    session_id: input.sessionId,
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: path.join(input.runRoot, "program.md"),
    best_score: 1,
    best_artifact_dir: input.bestArtifact,
    entries: [
      makeEntry({
        sessionId: input.sessionId,
        iteration: 1,
        decision: "keep",
        agentStatus: input.edited ? "edited" : "no_change",
        changedPaths: input.edited ? ["run.py"] : [],
        artifactDir: input.firstCandidate,
        outputDir: path.join(input.runRoot, "iterations", "001", "run")
      }),
      makeEntry({
        sessionId: input.sessionId,
        iteration: 2,
        decision: "discard",
        agentStatus: "no_change",
        changedPaths: [],
        artifactDir: path.join(input.runRoot, "iterations", "002", "candidate"),
        outputDir: path.join(input.runRoot, "iterations", "002", "run")
      })
    ]
  };
}

function makeEntry(input: {
  sessionId: string;
  iteration: number;
  decision: string;
  agentStatus: string;
  changedPaths: string[];
  artifactDir: string;
  outputDir: string;
}) {
  return {
    iteration: input.iteration,
    decision: input.decision,
    score: 1,
    summary: "Accepted replay set.",
    agent_status: input.agentStatus,
    agent_summary: input.agentStatus === "edited"
      ? "Codex edited the trading system artifact workspace."
      : "Codex left the trading system artifact unchanged.",
    agent_changed_paths: input.changedPaths,
    artifact_dir: input.artifactDir,
    events_path: path.join(input.outputDir, "replay-set.json"),
    started_at: "2026-05-13T13:59:00.000Z",
    completed_at: `2026-05-13T14:0${input.iteration}:00.000Z`,
    evaluation: {
      status: "accepted",
      score: 1,
      metrics: [],
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      risk_decision: "valid_order_intent_draft",
      scenario_results: [
        makeScenarioResult(input.outputDir, input.iteration, "trend_long", "01"),
        makeScenarioResult(input.outputDir, input.iteration, "range_flat", "02")
      ]
    }
  };
}

function makeScenarioResult(outputDir: string, iteration: number, scenarioId: string, suffix: string) {
  const sandboxName = `ouro-s17-${iteration}-${suffix}`;
  return {
    scenario_id: scenarioId,
    runner_kind: "docker_sandboxes_sbx",
    sandbox_name: sandboxName,
    status: "accepted",
    run_status: "completed",
    score: 1,
    metrics: [],
    summary: "Accepted order intent draft.",
    risk_decision: "valid_order_intent_draft",
    events_path: path.join(outputDir, scenarioId, "events.jsonl"),
    provider_request_count: 3,
    runner_command_count: 5,
    runner_command_evidence: [
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "version"]),
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "create", "--name", sandboxName, "shell", "/repo"]),
      makeCommand([
        "/repo/scripts/sdx-docker-sandboxes",
        "exec",
        "-w",
        "/tmp/seeded/candidate",
        sandboxName,
        "sh",
        "-lc",
        `'python3' '${path.join(outputDir, scenarioId, "replay-provider-sidecar.py")}' '--scenario' '/tmp/scenario.json' & TRADING_API_BASE_URL='http://127.0.0.1:42100' 'python3' 'run.py'`
      ]),
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "stop", sandboxName]),
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "rm", "--force", sandboxName])
    ]
  };
}

function makeCommand(command: string[]) {
  return {
    command,
    exit_code: 0,
    timed_out: false,
    stdout_preview: "",
    stderr_preview: "",
    started_at: "2026-05-13T14:00:00.000Z",
    completed_at: "2026-05-13T14:00:01.000Z"
  };
}

async function writePromotedCandidate(
  root: string,
  candidateId: string,
  gate: string,
  sourceSessionId: string,
  promotedAt: string
): Promise<void> {
  const candidateDir = path.join(root, candidateId);
  await mkdir(candidateDir, { recursive: true });
  await writeFile(path.join(candidateDir, "candidate.json"), `${JSON.stringify({
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: candidateId,
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "promotion.json"), `${JSON.stringify({
    record_kind: "trading_research_candidate_promotion",
    version: 1,
    gate,
    source: { session_id: sourceSessionId },
    gate_status: {
      completion_status: gate === "completion" ? "pass" : "incomplete",
      seeded_stability_status: "pass"
    },
    artifact_digest: `sha256:${candidateId}`,
    promoted_at: promotedAt,
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
}

function runScript(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
