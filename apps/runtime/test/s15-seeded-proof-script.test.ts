import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S15 seeded Codex SDX trading research proof script", () => {
  it("prints explicit seed, run, and seeded audit commands without invoking npm in print-only mode", async () => {
    const result = await runScript([
      "scripts/prove-trading-research-seeded-codex-sdx.mjs",
      "--print-only",
      "--session-id",
      "example",
      "--seed-artifact",
      "/tmp/seed"
    ]);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("S15 Seeded Codex SDX Trading research proof");
    expect(result.stdout).toContain("session_id=example");
    expect(result.stdout).toContain("seed_artifact=/tmp/seed");
    expect(result.stdout).toContain("seed_selector_command=<explicit seed-artifact>");
    expect(result.stdout).toContain("env OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home");
    expect(result.stdout).toContain("env OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes");
    expect(result.stdout).toContain("env OUROBOROS_SBX_COMMAND_TIMEOUT_MS=120000");
    expect(result.stdout).toContain(
      "run_command=npm run trading:research -- --agent codex --mode replay --iterations 2 --artifact-runner sdx --session-id example --artifact /tmp/seed"
    );
    expect(result.stdout).toContain(
      "audit_command=npm run audit:trading-research:seeded-stability -- --session-id example --seed-artifact /tmp/seed"
    );
    expect(result.stdout).toContain("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");
    expect(result.stdout).toContain("PROOF_RESULT print_only");
  });

  it("selects the best artifact before print-only output when no explicit seed is supplied", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s15-seeded-proof-"));
    try {
      const artifact = path.join(root, "passed", "iterations", "001", "kept-artifact");
      await mkdir(artifact, { recursive: true });
      await writeSession(root, "passed", makePassedNotebook("passed", artifact, "2026-05-13T13:30:00.000Z"));

      const result = await runScript([
        "scripts/prove-trading-research-seeded-codex-sdx.mjs",
        "--print-only",
        "--session-id",
        "selected",
        "--selection-root",
        root
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("seed_selector_command=");
      expect(result.stdout).toContain("scripts/trading-research-best-artifact.mjs --artifact-only --root");
      expect(result.stdout).toContain(`seed_artifact=${artifact}`);
      expect(result.stdout).toContain(`--session-id selected --artifact ${artifact}`);
      expect(result.stdout).toContain("PROOF_RESULT print_only");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runs seeded trading research first and audits the produced notebook second", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s15-seeded-proof-"));
    const fakeNpm = path.join(tempDir, "npm");
    const logPath = path.join(tempDir, "npm.log");
    const seedArtifact = path.join(tempDir, "seed");
    const runRoot = path.join(tempDir, "run-root");
    try {
      await writeFakeNpm(fakeNpm);

      const result = await runScript([
        "scripts/prove-trading-research-seeded-codex-sdx.mjs",
        "--session-id",
        "order-test",
        "--seed-artifact",
        seedArtifact,
        "--iterations",
        "3",
        "--model",
        "gpt-test",
        "--agent-timeout-ms",
        "10",
        "--program",
        "/tmp/program.md",
        "--run-root",
        runRoot,
        "--sbx-home",
        "/tmp/sbx-home",
        "--sdx-bin",
        "/tmp/sdx",
        "--command-timeout-ms",
        "7000",
        "--npm-bin",
        fakeNpm
      ], {
        FAKE_NPM_LOG: logPath
      });
      const calls = parseCallLog(await readFile(logPath, "utf8"));

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PROOF_RESULT passed");
      expect(calls).toHaveLength(2);
      expect(calls[0].argv).toEqual([
        "run",
        "trading:research",
        "--",
        "--agent",
        "codex",
        "--mode",
        "replay",
        "--iterations",
        "3",
        "--artifact-runner",
        "sdx",
        "--session-id",
        "order-test",
        "--artifact",
        seedArtifact,
        "--model",
        "gpt-test",
        "--agent-timeout-ms",
        "10",
        "--program",
        "/tmp/program.md",
        "--run-root",
        runRoot
      ]);
      expect(calls[1].argv).toEqual([
        "run",
        "audit:trading-research:seeded-stability",
        "--",
        "--notebook",
        path.join(runRoot, "notebook.json"),
        "--seed-artifact",
        seedArtifact
      ]);
      expect(calls[0].env).toEqual({
        OUROBOROS_SBX_HOME: "/tmp/sbx-home",
        OUROBOROS_SDX_BIN: "/tmp/sdx",
        OUROBOROS_SBX_COMMAND_TIMEOUT_MS: "7000"
      });
      expect(calls[1].env).toEqual(calls[0].env);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("stops before seeded audit when the trading research run fails", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s15-seeded-proof-"));
    const fakeNpm = path.join(tempDir, "npm");
    const logPath = path.join(tempDir, "npm.log");
    try {
      await writeFakeNpm(fakeNpm);

      const result = await runScript([
        "scripts/prove-trading-research-seeded-codex-sdx.mjs",
        "--session-id",
        "run-fails",
        "--seed-artifact",
        "/tmp/seed",
        "--npm-bin",
        fakeNpm
      ], {
        FAKE_NPM_LOG: logPath,
        FAKE_NPM_FAIL_TRADING_RESEARCH_CODE: "7"
      });
      const calls = parseCallLog(await readFile(logPath, "utf8"));

      expect(result.code, scriptOutput(result)).toBe(7);
      expect(calls).toHaveLength(1);
      expect(calls[0].argv).toContain("trading:research");
      expect(result.stdout).toContain("PROOF_RESULT failed_stage=run exit_code=7");
      expect(result.stdout).not.toContain("PROOF_RESULT passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm seeded proof command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["prove:trading-research:seeded-codex-sdx"])
      .toBe("node scripts/prove-trading-research-seeded-codex-sdx.mjs");
  });
});

async function writeFakeNpm(pathname: string): Promise<void> {
  await writeFile(pathname, `#!/usr/bin/env node
const fs = require("node:fs");
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify({
  argv,
  env: {
    OUROBOROS_SBX_HOME: process.env.OUROBOROS_SBX_HOME,
    OUROBOROS_SDX_BIN: process.env.OUROBOROS_SDX_BIN,
    OUROBOROS_SBX_COMMAND_TIMEOUT_MS: process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS
  }
}) + "\\n");
if (argv.includes("trading:research") && process.env.FAKE_NPM_FAIL_TRADING_RESEARCH_CODE) {
  process.exit(Number(process.env.FAKE_NPM_FAIL_TRADING_RESEARCH_CODE));
}
if (argv.includes("audit:trading-research:seeded-stability") && process.env.FAKE_NPM_FAIL_AUDIT_CODE) {
  process.exit(Number(process.env.FAKE_NPM_FAIL_AUDIT_CODE));
}
process.exit(0);
`, "utf8");
  await chmod(pathname, 0o755);
}

async function writeSession(root: string, sessionId: string, notebook: unknown): Promise<void> {
  const sessionDir = path.join(root, sessionId);
  await mkdir(sessionDir, { recursive: true });
  await writeFile(path.join(sessionDir, "notebook.json"), `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

function makePassedNotebook(sessionId: string, artifact: string, completedAt: string) {
  return {
    session_id: sessionId,
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: path.join(path.dirname(artifact), "program.md"),
    best_score: 1,
    best_artifact_dir: artifact,
    entries: [
      makeEntry(sessionId, 1, "keep", "edited", ["run.py"], completedAt),
      makeEntry(sessionId, 2, "discard", "no_change", [], "2026-05-13T13:31:00.000Z")
    ]
  };
}

function makeEntry(
  sessionId: string,
  iteration: number,
  decision: string,
  agentStatus: string,
  changedPaths: string[],
  completedAt: string
) {
  return {
    iteration,
    decision,
    score: 1,
    summary: "Accepted replay set.",
    agent_status: agentStatus,
    agent_summary: "Codex result.",
    agent_changed_paths: changedPaths,
    artifact_dir: `/tmp/${sessionId}/iterations/${String(iteration).padStart(3, "0")}/candidate`,
    events_path: `/tmp/${sessionId}/iterations/${String(iteration).padStart(3, "0")}/run/replay-set.json`,
    started_at: "2026-05-13T13:29:00.000Z",
    completed_at: completedAt,
    evaluation: {
      status: "accepted",
      score: 1,
      metrics: [],
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      risk_decision: "valid_order_request",
      scenario_results: [
        makeScenarioResult(sessionId, iteration, "trend_long"),
        makeScenarioResult(sessionId, iteration, "range_flat")
      ]
    }
  };
}

function makeScenarioResult(sessionId: string, iteration: number, scenarioId: string) {
  return {
    scenario_id: scenarioId,
    runner_kind: "docker_sandboxes_sbx",
    sandbox_name: `ouro-s15-${iteration}-${scenarioId}`,
    status: "accepted",
    run_status: "completed",
    score: 1,
    metrics: [],
    summary: "Accepted order request.",
    risk_decision: "valid_order_request",
    events_path: `/tmp/${sessionId}/iterations/${String(iteration).padStart(3, "0")}/run/${scenarioId}/events.jsonl`,
    provider_request_count: 3,
    runner_command_count: 5
  };
}

function parseCallLog(contents: string) {
  return contents.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function runScript(args: string[], env: Record<string, string | undefined> = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
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
