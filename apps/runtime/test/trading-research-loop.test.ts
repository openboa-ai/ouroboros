import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter,
  NoopTradingResearchAgentAdapter
} from "../src/trading-research/agent-adapters";
import { readTradingSystemManifest, runTradingArtifact } from "../src/trading-research/artifact-runner";
import { evaluateTradingRun } from "../src/trading-research/evaluator";
import {
  defaultReplayTradingScenarioSet,
  startReplayTradingApiProvider
} from "../src/trading-research/replay-trading-api-provider";
import {
  readNotebook,
  runTradingResearchLoop
} from "../src/trading-research/run-trading-research";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-trading-research-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Trading AAR research loop MVP", () => {
  it("runs one artifact through replay provider, evaluator, keep, discard, and notebook output", async () => {
    const runRoot = path.join(tmpDir, "session");
    const result = await runTradingResearchLoop({
      run_root: runRoot,
      session_id: "test-session",
      iterations: 2,
      agent_adapter: new FixtureTradingResearchAgentAdapter()
    });

    expect(result.entries.map((entry) => entry.decision)).toEqual(["keep", "discard"]);
    expect(result.best_score).toBe(1);
    expect(result.best_artifact_dir).toContain("kept-artifact");

    const notebook = await readNotebook(result.notebook_path);
    expect(notebook.entries).toHaveLength(2);
    expect(notebook.entries[0]).toMatchObject({
      iteration: 1,
      decision: "keep",
      score: 1,
      agent_status: "edited",
      agent_changed_paths: ["run.py"],
      evaluation: {
        status: "accepted",
        risk_decision: "valid_order_intent"
      }
    });
    expect(notebook.entries[0].events_path).toContain("replay-set.json");
    expect(notebook.entries[0].evaluation.scenario_results?.map((result) => result.scenario_id)).toEqual([
      "trend_long",
      "range_flat"
    ]);
    expect(notebook.entries[1]).toMatchObject({
      iteration: 2,
      decision: "discard",
      agent_status: "edited",
      evaluation: {
        status: "disqualified",
        risk_decision: "invalid_order_intent"
      }
    });
    expect(notebook.entries[1].evaluation.scenario_results).toEqual([
      expect.objectContaining({
        scenario_id: "trend_long",
        status: "disqualified"
      }),
      expect.objectContaining({
        scenario_id: "range_flat",
        status: "accepted"
      })
    ]);
    const notebookSurface = JSON.stringify(notebook);
    expect(notebookSurface).toContain("provider_boundary");
    expect(notebookSurface).toContain("replay_set_average");
    expect(notebookSurface).not.toMatch(
      /proposal|materialization_attempt|lineage|orchestration_run|provider_result|trace_refs|btc-perp|binance/i
    );
  });

  it("proves the artifact uses the external TradingApiProvider boundary", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const manifest = await readTradingSystemManifest(artifactDir);
    const provider = await startReplayTradingApiProvider();
    const run = await runTradingArtifact({
      artifact_dir: artifactDir,
      manifest,
      provider,
      output_dir: path.join(tmpDir, "run")
    });
    await provider.close();

    expect(run.status).toBe("completed");
    expect(run.provider_requests.map((request) => request.path)).toEqual([
      "/market/snapshot",
      "/account/state",
      "/orders/validate"
    ]);
    expect(run.events.map((event) => event.event)).toEqual([
      "market_snapshot",
      "account_state",
      "order_intent",
      "order_validation",
      "run_complete"
    ]);
    expect(evaluateTradingRun(run)).toMatchObject({
      status: "accepted",
      score: 0.85,
      risk_decision: "valid_order_intent"
    });
  });

  it("scores flat replay scenarios as hold decisions instead of long-only behavior", async () => {
    const artifactDir = path.join(tmpDir, "artifact-flat");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    const manifest = await readTradingSystemManifest(artifactDir);
    const flatScenario = defaultReplayTradingScenarioSet.find((scenario) => scenario.id === "range_flat");
    expect(flatScenario).toBeDefined();
    const provider = await startReplayTradingApiProvider(flatScenario);
    const run = await runTradingArtifact({
      artifact_dir: artifactDir,
      manifest,
      provider,
      output_dir: path.join(tmpDir, "run-flat")
    });
    await provider.close();

    expect(run.status).toBe("completed");
    expect(run.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "order_intent",
          side: "hold",
          quantity: 0
        })
      ])
    );
    expect(evaluateTradingRun(run)).toMatchObject({
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_intent"
    });
  });

  it("builds a Codex-first artifact edit command without exposing legacy proposal internals", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    const calls: string[][] = [];
    const stdinPrompts: string[] = [];
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      model: "gpt-5.4-test",
      execFile: async (_file, args, options) => {
        calls.push(args);
        stdinPrompts.push(options?.stdin ?? "");
        const runPath = path.join(artifactDir, "run.py");
        const source = await readFile(runPath, "utf8");
        await writeFile(runPath, source.replace("RISK_FRACTION = 0.01", "RISK_FRACTION = 0.02"), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 1
    });

    expect(result.status).toBe("edited");
    expect(result.changed_paths).toEqual(["run.py"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        "exec",
        "-c",
        "model_reasoning_effort=\"low\"",
        "--cd",
        artifactDir,
        "--model",
        "gpt-5.4-test",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-"
      ])
    );
    const commandSurface = calls[0].join(" ");
    expect(commandSurface).not.toMatch(/proposal|materialization|lineage|orchestration/i);
    expect(stdinPrompts[0]).toContain("TradingApiProvider");
    expect(stdinPrompts[0]).not.toMatch(/proposal|materialization|lineage|orchestration/i);
    await expect(readFile(path.join(artifactDir, "run.py"), "utf8")).resolves.toContain(
      "RISK_FRACTION = 0.02"
    );
  });

  it("reports no_change when Codex exits without modifying editable artifact files", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"best_score\":1,\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      execFile: async () => ({ stdout: "no edits\n", stderr: "" })
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 2,
      previous_best_score: 1
    });

    expect(result).toMatchObject({
      status: "no_change",
      changed_paths: []
    });
  });

  it("classifies Codex environment blockers with command evidence", async () => {
    const artifactDir = path.join(tmpDir, "artifact");
    const notebookPath = path.join(tmpDir, "notebook.json");
    const programPath = path.join(tmpDir, "program.md");
    await cp(path.resolve("artifacts/trading-system"), artifactDir, { recursive: true });
    await writeFile(programPath, "Improve the trading system artifact.\n", "utf8");
    await writeFile(notebookPath, "{\"entries\":[]}\n", "utf8");

    const adapter = new CodexTradingResearchAgentAdapter({
      execFile: async () => {
        throw new Error("failed to initialize in-process app-server client: Operation not permitted");
      }
    });

    const result = await adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: artifactDir,
      program_path: programPath,
      notebook_path: notebookPath,
      iteration: 1
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "codex_environment_blocked",
      command: expect.arrayContaining(["exec", "--skip-git-repo-check", "-"])
    });
  });

  it("records a crash entry when the agent cannot edit before execution", async () => {
    const failingAdapter = new NoopTradingResearchAgentAdapter();
    Object.defineProperty(failingAdapter, "improveArtifact", {
      value: async () => ({
        status: "failed",
        summary: "agent unavailable",
        error: "codex unavailable"
      })
    });

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "failed-session"),
      session_id: "failed-session",
      iterations: 1,
      agent_adapter: failingAdapter
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        decision: "crash",
        score: 0,
        agent_status: "failed",
        summary: "codex unavailable"
      })
    ]);
  });
});
