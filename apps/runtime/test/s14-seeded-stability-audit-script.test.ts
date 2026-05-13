import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S14 seeded Trading AAR stability audit script", () => {
  it("passes a no-change seeded stability notebook with seed digest evidence", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s14-seeded-audit-"));
    try {
      const seedArtifact = path.join(tempDir, "seed");
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      await writeArtifact(seedArtifact);
      await cp(seedArtifact, firstCandidate, { recursive: true });
      await cp(seedArtifact, bestArtifact, { recursive: true });
      const notebookPath = path.join(tempDir, "notebook.json");
      await writeNotebook(notebookPath, makeSeededNotebook({
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run")
      }));

      const result = await runScript([
        "scripts/audit-trading-research-seeded-stability.mjs",
        "--notebook",
        notebookPath,
        "--seed-artifact",
        seedArtifact
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading AAR seeded stability audit");
      expect(result.stdout).toContain("session_id=seeded-stability-fixture");
      expect(result.stdout).toContain("iteration 1: decision=keep score=1 agent_status=no_change changed_paths=none");
      expect(result.stdout).toContain("iteration 2: decision=discard score=1 agent_status=no_change changed_paths=none");
      expect(result.stdout).toContain("seed_candidate_digest_match=true");
      expect(result.stdout).toContain("seed_best_artifact_digest_match=true");
      expect(result.stdout).toContain("PASS seeded Codex SDX replay stability evidence is complete");
      expect(result.stdout).toContain("AUDIT_RESULT passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps the S10 completion audit stricter than seeded stability", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s14-seeded-audit-"));
    try {
      const seedArtifact = path.join(tempDir, "seed");
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      await writeArtifact(seedArtifact);
      await cp(seedArtifact, firstCandidate, { recursive: true });
      await cp(seedArtifact, bestArtifact, { recursive: true });
      const notebookPath = path.join(tempDir, "notebook.json");
      await writeNotebook(notebookPath, makeSeededNotebook({
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run")
      }));

      const result = await runScript(["scripts/audit-s10-trading-research.mjs", "--notebook", notebookPath]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("MISSING at least one kept Codex artifact edit with changed paths");
      expect(result.stdout).toContain("AUDIT_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects notebooks missing accepted scenario provider evidence", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s14-seeded-audit-"));
    try {
      const firstCandidate = path.join(tempDir, "run", "iterations", "001", "candidate");
      const bestArtifact = path.join(tempDir, "run", "iterations", "001", "kept-artifact");
      await writeArtifact(firstCandidate);
      await writeArtifact(bestArtifact);
      const notebook = makeSeededNotebook({
        firstCandidate,
        bestArtifact,
        runRoot: path.join(tempDir, "run")
      });
      notebook.entries[0].evaluation.scenario_results[0].provider_request_count = 0;
      notebook.entries[0].evaluation.scenario_results[0].runner_command_evidence[2].command = [
        "/repo/scripts/sdx-docker-sandboxes",
        "exec",
        "sandbox",
        "python3 run.py"
      ];
      const notebookPath = path.join(tempDir, "notebook.json");
      await writeNotebook(notebookPath, notebook);

      const result = await runScript([
        "scripts/audit-trading-research-seeded-stability.mjs",
        "--notebook",
        notebookPath
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("MISSING iteration 1 scenario trend_long provider_request_count >= 3");
      expect(result.stdout).toContain("MISSING iteration 1 scenario trend_long sidecar command evidence");
      expect(result.stdout).toContain("MISSING iteration 1 scenario trend_long sandbox-local Trading API base URL evidence");
      expect(result.stdout).toContain("AUDIT_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm seeded stability audit command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["audit:trading-research:seeded-stability"])
      .toBe("node scripts/audit-trading-research-seeded-stability.mjs");
  });
});

async function writeNotebook(notebookPath: string, notebook: unknown): Promise<void> {
  await writeFile(notebookPath, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

async function writeArtifact(artifactDir: string): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
    id: "seeded-stability-artifact",
    entrypoint: "run.py",
    editable_paths: ["run.py"]
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(artifactDir, "run.py"), "RISK_FRACTION = 0.02\n", "utf8");
}

function makeSeededNotebook(input: { firstCandidate: string; bestArtifact: string; runRoot: string }) {
  return {
    session_id: "seeded-stability-fixture",
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: "/tmp/seeded-stability/program.md",
    best_score: 1,
    best_artifact_dir: input.bestArtifact,
    entries: [
      makeEntry({
        iteration: 1,
        decision: "keep",
        artifactDir: input.firstCandidate,
        outputDir: path.join(input.runRoot, "iterations", "001", "run")
      }),
      makeEntry({
        iteration: 2,
        decision: "discard",
        artifactDir: path.join(input.runRoot, "iterations", "002", "candidate"),
        outputDir: path.join(input.runRoot, "iterations", "002", "run")
      })
    ]
  };
}

function makeEntry(input: { iteration: number; decision: string; artifactDir: string; outputDir: string }) {
  return {
    iteration: input.iteration,
    decision: input.decision,
    score: 1,
    summary: "Accepted replay set.",
    agent_status: "no_change",
    agent_summary: "Codex left the trading system artifact unchanged.",
    agent_changed_paths: [],
    artifact_dir: input.artifactDir,
    events_path: path.join(input.outputDir, "replay-set.json"),
    started_at: "2026-05-13T12:00:00.000Z",
    completed_at: `2026-05-13T12:0${input.iteration}:00.000Z`,
    evaluation: {
      status: "accepted",
      score: 1,
      metrics: [],
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      risk_decision: "valid_order_intent",
      scenario_results: [
        makeScenarioResult(input.outputDir, input.iteration, "trend_long", "01"),
        makeScenarioResult(input.outputDir, input.iteration, "range_flat", "02")
      ]
    }
  };
}

function makeScenarioResult(outputDir: string, iteration: number, scenarioId: string, suffix: string) {
  const sandboxName = `ouro-s14-${iteration}-${suffix}`;
  return {
    scenario_id: scenarioId,
    runner_kind: "docker_sandboxes_sbx",
    sandbox_name: sandboxName,
    status: "accepted",
    run_status: "completed",
    score: 1,
    metrics: [],
    summary: "Accepted order intent.",
    risk_decision: "valid_order_intent",
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
        "/tmp/seeded-stability/candidate",
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
    started_at: "2026-05-13T12:00:00.000Z",
    completed_at: "2026-05-13T12:00:01.000Z"
  };
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
