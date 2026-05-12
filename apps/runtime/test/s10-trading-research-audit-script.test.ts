import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S10 trading research audit script", () => {
  it("passes a Codex-first sandbox sidecar completion notebook", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s10-audit-"));
    try {
      const notebookPath = path.join(tempDir, "notebook.json");
      await writeNotebook(notebookPath, makeNotebook());

      const result = await runScript(["scripts/audit-s10-trading-research.mjs", "--notebook", notebookPath]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("S10 Trading AAR completion audit");
      expect(result.stdout).toContain("session_id=s10-audit-fixture");
      expect(result.stdout).toContain("agent_provider=codex");
      expect(result.stdout).toContain("best_artifact_dir=/tmp/s10-audit-fixture/iterations/001/kept-artifact");
      expect(result.stdout).toContain("iteration 1: decision=keep score=1 agent_status=edited changed_paths=run.py");
      expect(result.stdout).toContain("iteration 2: decision=discard score=1 agent_status=no_change changed_paths=none");
      expect(result.stdout).toContain("trend_long: runner=docker_sandboxes_sbx run=completed status=accepted");
      expect(result.stdout).toContain("range_flat: runner=docker_sandboxes_sbx run=completed status=accepted");
      expect(result.stdout).toContain("PASS Codex-first sandbox sidecar completion evidence is complete");
      expect(result.stdout).toContain("AUDIT_RESULT passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects notebooks missing sandbox-local sidecar evidence", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s10-audit-"));
    try {
      const notebookPath = path.join(tempDir, "notebook.json");
      const notebook = makeNotebook();
      notebook.entries[0].evaluation.scenario_results[0].runner_command_evidence[2].command = [
        "/repo/scripts/sdx-docker-sandboxes",
        "exec",
        "sandbox",
        "python3 run.py"
      ];
      await writeNotebook(notebookPath, notebook);

      const result = await runScript(["scripts/audit-s10-trading-research.mjs", "--notebook", notebookPath]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("MISSING iteration 1 scenario trend_long sidecar command evidence");
      expect(result.stdout).toContain("MISSING iteration 1 scenario trend_long sandbox-local Trading API base URL evidence");
      expect(result.stdout).toContain("AUDIT_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm audit command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["audit:s10-trading-research"]).toBe("node scripts/audit-s10-trading-research.mjs");
  });
});

async function writeNotebook(notebookPath: string, notebook: unknown): Promise<void> {
  await writeFile(notebookPath, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
}

function makeNotebook() {
  return {
    session_id: "s10-audit-fixture",
    mode: "replay",
    agent: {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      permission_policy: "artifact_workspace_only"
    },
    program_path: "/tmp/s10-audit-fixture/program.md",
    best_score: 1,
    best_artifact_dir: "/tmp/s10-audit-fixture/iterations/001/kept-artifact",
    entries: [
      {
        iteration: 1,
        decision: "keep",
        score: 1,
        summary: "Accepted replay set.",
        agent_status: "edited",
        agent_summary: "Codex edited the trading system artifact workspace.",
        agent_changed_paths: ["run.py"],
        artifact_dir: "/tmp/s10-audit-fixture/iterations/001/candidate",
        events_path: "/tmp/s10-audit-fixture/iterations/001/run/replay-set.json",
        started_at: "2026-05-12T23:09:51.932Z",
        completed_at: "2026-05-12T23:10:53.125Z",
        evaluation: makeEvaluation()
      },
      {
        iteration: 2,
        decision: "discard",
        score: 1,
        summary: "Accepted replay set.",
        agent_status: "no_change",
        agent_summary: "Codex left the trading system artifact unchanged.",
        agent_changed_paths: [],
        artifact_dir: "/tmp/s10-audit-fixture/iterations/002/candidate",
        events_path: "/tmp/s10-audit-fixture/iterations/002/run/replay-set.json",
        started_at: "2026-05-12T23:10:54.932Z",
        completed_at: "2026-05-12T23:11:53.125Z",
        evaluation: makeEvaluation(2)
      }
    ]
  };
}

function makeEvaluation(iteration = 1) {
  return {
    status: "accepted",
    score: 1,
    metrics: [],
    summary: "Accepted replay set with average score 1.000 across 2 scenarios.",
    risk_decision: "valid_order_intent",
    scenario_results: [
      makeScenarioResult("trend_long", iteration, "01"),
      makeScenarioResult("range_flat", iteration, "02")
    ]
  };
}

function makeScenarioResult(scenarioId: string, iteration: number, suffix: string) {
  const sandboxName = `ouro-s10-test-${iteration}-${suffix}`;
  return {
    scenario_id: scenarioId,
    runner_kind: "docker_sandboxes_sbx",
    sandbox_name: sandboxName,
    status: "accepted",
    run_status: "completed",
    score: 1,
    metrics: [],
    summary: "Accepted order intent with score 1.000.",
    risk_decision: "valid_order_intent",
    events_path: `/tmp/s10-audit-fixture/iterations/${String(iteration).padStart(3, "0")}/run/${scenarioId}/events.jsonl`,
    provider_request_count: 3,
    runner_command_count: 5,
    runner_command_evidence: [
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "version"]),
      makeCommand(["/repo/scripts/sdx-docker-sandboxes", "create", "--name", sandboxName, "shell", "/repo"]),
      makeCommand([
        "/repo/scripts/sdx-docker-sandboxes",
        "exec",
        "-w",
        "/tmp/s10-audit-fixture/candidate",
        sandboxName,
        "sh",
        "-lc",
        `'python3' '/tmp/s10-audit-fixture/run/${scenarioId}/replay-provider-sidecar.py' '--scenario' '/tmp/scenario.json' & TRADING_API_BASE_URL='http://127.0.0.1:42100' 'python3' 'run.py'`
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
    started_at: "2026-05-12T23:10:16.219Z",
    completed_at: "2026-05-12T23:10:17.617Z"
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
