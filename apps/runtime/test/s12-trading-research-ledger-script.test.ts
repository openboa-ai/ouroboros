import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S12 trading research ledger script", () => {
  it("prints passed and blocked local notebook runs distinctly", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s12-ledger-"));
    try {
      await writeSession(root, "passed-run", makePassedNotebook("passed-run", "2026-05-13T11:00:00.000Z"));
      await writeSession(root, "blocked-run", makeBlockedNotebook("blocked-run", "2026-05-13T11:01:00.000Z"));

      const result = await runScript(["scripts/trading-research-ledger.mjs", "--root", root, "--limit", "5"]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading AAR run ledger");
      expect(result.stdout).toContain(`root=${root}`);
      expect(result.stdout).toContain("runs=2");
      expect(result.stdout).toContain("run blocked-run status=blocked");
      expect(result.stdout).toContain("decisions=crash:2");
      expect(result.stdout).toContain("missing=best_score >= 1; best_artifact_dir");
      expect(result.stdout).toContain("run passed-run status=pass");
      expect(result.stdout).toContain("decisions=discard:1,keep:1");
      expect(result.stdout).toContain("runners=docker_sandboxes_sbx scenarios=4/4 accepted provider_requests=12 runner_commands=20");
      expect(result.stdout.indexOf("run blocked-run")).toBeLessThan(result.stdout.indexOf("run passed-run"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints parseable JSON with notebook and best artifact paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s12-ledger-"));
    try {
      await writeSession(root, "passed-run", makePassedNotebook("passed-run", "2026-05-13T11:00:00.000Z"));

      const result = await runScript(["scripts/trading-research-ledger.mjs", "--root", root, "--json"]);
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(parsed.root).toBe(root);
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0]).toMatchObject({
        session_id: "passed-run",
        status: "pass",
        agent_provider: "codex",
        mode: "replay",
        entry_count: 2,
        best_score: 1,
        scenario_accepted: 4,
        scenario_total: 4,
        provider_request_total: 12,
        runner_command_total: 20,
        notebook_path: path.join(root, "passed-run", "notebook.json"),
        best_artifact_dir: "/tmp/passed-run/iterations/001/kept-artifact"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("filters by completion status", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s12-ledger-"));
    try {
      await writeSession(root, "passed-run", makePassedNotebook("passed-run", "2026-05-13T11:00:00.000Z"));
      await writeSession(root, "blocked-run", makeBlockedNotebook("blocked-run", "2026-05-13T11:01:00.000Z"));

      const result = await runScript([
        "scripts/trading-research-ledger.mjs",
        "--root",
        root,
        "--status",
        "pass",
        "--json"
      ]);
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(parsed.runs.map((run: { session_id: string }) => run.session_id)).toEqual(["passed-run"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("registers the npm ledger command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["trading:research:ledger"]).toBe("node scripts/trading-research-ledger.mjs");
  });
});

async function writeSession(root: string, sessionId: string, notebook: unknown): Promise<void> {
  const sessionDir = path.join(root, sessionId);
  await mkdir(sessionDir, { recursive: true });
  await writeFile(path.join(sessionDir, "notebook.json"), `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

function makePassedNotebook(sessionId: string, completedAt: string) {
  return {
    session_id: sessionId,
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: `/tmp/${sessionId}/program.md`,
    best_score: 1,
    best_artifact_dir: `/tmp/${sessionId}/iterations/001/kept-artifact`,
    entries: [
      makeEntry(sessionId, 1, "keep", "edited", ["run.py"], completedAt),
      makeEntry(sessionId, 2, "discard", "no_change", [], "2026-05-13T11:02:00.000Z")
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
    started_at: "2026-05-13T10:59:00.000Z",
    completed_at: completedAt,
    evaluation: {
      status: "accepted",
      score: 1,
      metrics: [],
      summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
      risk_decision: "valid_order_intent",
      scenario_results: [
        makeScenarioResult(sessionId, iteration, "trend_long"),
        makeScenarioResult(sessionId, iteration, "range_flat")
      ]
    }
  };
}

function makeScenarioResult(sessionId: string, iteration: number, scenarioId: string) {
  const sandboxName = `ouro-s12-${iteration}-${scenarioId}`;
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
    events_path: `/tmp/${sessionId}/iterations/${String(iteration).padStart(3, "0")}/run/${scenarioId}/events.jsonl`,
    provider_request_count: 3,
    runner_command_count: 5
  };
}

function makeBlockedNotebook(sessionId: string, completedAt: string) {
  return {
    session_id: sessionId,
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: `/tmp/${sessionId}/program.md`,
    entries: [
      makeBlockedEntry(1, completedAt),
      makeBlockedEntry(2, "2026-05-13T11:02:00.000Z")
    ]
  };
}

function makeBlockedEntry(iteration: number, completedAt: string) {
  return {
    iteration,
    decision: "crash",
    score: 0,
    summary: "Agent failed before artifact execution.",
    agent_status: "failed",
    agent_summary: "Codex failed before producing an artifact edit.",
    agent_failure_reason: "codex_environment_blocked",
    artifact_dir: `/tmp/blocked/iterations/${String(iteration).padStart(3, "0")}/candidate`,
    events_path: `/tmp/blocked/iterations/${String(iteration).padStart(3, "0")}/run/replay-set.json`,
    started_at: "2026-05-13T10:59:00.000Z",
    completed_at: completedAt,
    evaluation: {
      status: "disqualified",
      score: 0,
      metrics: [
        {
          name: "agent_edit",
          score: 0,
          detail: "failed to initialize in-process app-server client: Operation not permitted"
        }
      ],
      summary: "Agent failed before artifact execution.",
      risk_decision: "no_order_intent"
    }
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
