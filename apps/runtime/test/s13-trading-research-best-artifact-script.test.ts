import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S13 trading research best artifact selector", () => {
  it("selects the latest passing artifact and ignores newer blocked runs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s13-best-artifact-"));
    try {
      const olderArtifact = path.join(root, "older-pass", "iterations", "001", "kept-artifact");
      const latestArtifact = path.join(root, "latest-pass", "iterations", "001", "kept-artifact");
      await mkdir(olderArtifact, { recursive: true });
      await mkdir(latestArtifact, { recursive: true });
      await writeSession(root, "older-pass", makePassedNotebook("older-pass", olderArtifact, "2026-05-13T10:00:00.000Z"));
      await writeSession(root, "latest-pass", makePassedNotebook("latest-pass", latestArtifact, "2026-05-13T11:00:00.000Z"));
      await writeSession(root, "blocked-newer", makeBlockedNotebook("blocked-newer", "2026-05-13T12:00:00.000Z"));

      const result = await runScript(["scripts/trading-research-best-artifact.mjs", "--root", root]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading research best artifact");
      expect(result.stdout).toContain(`root=${root}`);
      expect(result.stdout).toContain("scanned_notebooks=3");
      expect(result.stdout).toContain("session_id=latest-pass");
      expect(result.stdout).toContain("best_score=1");
      expect(result.stdout).toContain(`best_artifact=${latestArtifact}`);
      expect(result.stdout).toContain(`notebook=${path.join(root, "latest-pass", "notebook.json")}`);
      expect(result.stdout).toContain("decisions=discard:1,keep:1");
      expect(result.stdout).toContain("scenarios=4/4 accepted");
      expect(result.stdout).toContain("provider_requests=12");
      expect(result.stdout).toContain("runner_commands=20");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints only the artifact path for scripting", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s13-best-artifact-"));
    try {
      const artifact = path.join(root, "passed", "iterations", "001", "kept-artifact");
      await mkdir(artifact, { recursive: true });
      await writeSession(root, "passed", makePassedNotebook("passed", artifact, "2026-05-13T11:00:00.000Z"));

      const result = await runScript([
        "scripts/trading-research-best-artifact.mjs",
        "--root",
        root,
        "--artifact-only"
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toBe(`${artifact}\n`);
      expect(result.stderr).toBe("");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints JSON for the selected artifact", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s13-best-artifact-"));
    try {
      const artifact = path.join(root, "passed", "iterations", "001", "kept-artifact");
      await mkdir(artifact, { recursive: true });
      await writeSession(root, "passed", makePassedNotebook("passed", artifact, "2026-05-13T11:00:00.000Z"));

      const result = await runScript(["scripts/trading-research-best-artifact.mjs", "--root", root, "--json"]);
      const parsed = JSON.parse(result.stdout);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(parsed).toMatchObject({
        root,
        scanned_notebooks: 1,
        session_id: "passed",
        best_score: 1,
        best_artifact_dir: artifact,
        notebook_path: path.join(root, "passed", "notebook.json"),
        scenario_accepted: 4,
        scenario_total: 4,
        provider_request_total: 12,
        runner_command_total: 20
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns nonzero when no passing artifact exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-s13-best-artifact-"));
    try {
      await writeSession(root, "blocked", makeBlockedNotebook("blocked", "2026-05-13T11:00:00.000Z"));

      const result = await runScript(["scripts/trading-research-best-artifact.mjs", "--root", root]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("NO_PASSING_TRADING_RESEARCH_BEST_ARTIFACT");
      expect(result.stdout).toContain("scanned_notebooks=1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("registers the npm best artifact command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["trading:research:best-artifact"])
      .toBe("node scripts/trading-research-best-artifact.mjs");
  });
});

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
      risk_decision: "valid_order_intent_draft",
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
    sandbox_name: `ouro-s13-${iteration}-${scenarioId}`,
    status: "accepted",
    run_status: "completed",
    score: 1,
    metrics: [],
    summary: "Accepted order intent draft.",
    risk_decision: "valid_order_intent_draft",
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
      {
        iteration: 1,
        decision: "crash",
        score: 0,
        summary: "Agent failed before artifact execution.",
        agent_status: "failed",
        agent_summary: "Codex failed before producing an artifact edit.",
        agent_failure_reason: "codex_environment_blocked",
        artifact_dir: `/tmp/${sessionId}/iterations/001/candidate`,
        events_path: `/tmp/${sessionId}/iterations/001/run/replay-set.json`,
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
          risk_decision: "no_order_intent_draft"
        }
      }
    ]
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
