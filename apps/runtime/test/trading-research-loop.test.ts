import { chmod, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter,
  NoopTradingResearchAgentAdapter
} from "../src/trading-research/agent-adapters";
import {
  DockerSandboxesSbxTradingArtifactRunner,
  readTradingSystemManifest,
  runTradingArtifact
} from "../src/trading-research/artifact-runner";
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
  delete process.env.SBX_FAKE_COMMAND_LOG;
  delete process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_LISTEN_HOST;
  delete process.env.OUROBOROS_TRADING_REPLAY_SANDBOX_HOST;
  delete process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_TRANSPORT;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Trading research research loop MVP", () => {
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
        risk_decision: "valid_order_request"
      }
    });
    expect(notebook.entries[0].events_path).toContain("replay-set.json");
    expect(notebook.entries[0].evaluation.scenario_results?.map((result) => result.scenario_id)).toEqual([
      "trend_long",
      "range_flat"
    ]);
    expect(notebook.entries[0].evaluation.scenario_results?.map((result) => result.runner_kind)).toEqual([
      "host_process",
      "host_process"
    ]);
    expect(notebook.entries[1]).toMatchObject({
      iteration: 2,
      decision: "discard",
      agent_status: "edited",
      evaluation: {
        status: "disqualified",
        risk_decision: "invalid_order_request"
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
      /proposal|materialization_attempt|lineage|orchestration_run|provider_result|trace_refs|sealed-replay|venue/i
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
      "order_request",
      "order_validation",
      "run_complete"
    ]);
    expect(evaluateTradingRun(run)).toMatchObject({
      status: "accepted",
      score: 0.85,
      risk_decision: "valid_order_request"
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
          event: "order_request",
          side: "hold",
          quantity: 0
        })
      ])
    );
    expect(evaluateTradingRun(run)).toMatchObject({
      status: "accepted",
      score: 1,
      risk_decision: "valid_order_request"
    });
  });

  it("exposes a sandbox provider URL without changing the host provider URL", async () => {
    const provider = await startReplayTradingApiProvider(defaultReplayTradingScenarioSet[0], {
      listen_host: "0.0.0.0",
      sandbox_host: "host.docker.internal"
    });
    try {
      expect(provider.base_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      expect(provider.sandbox_base_url).toMatch(/^http:\/\/host\.docker\.internal:\d+$/);

      const response = await fetch(`${provider.base_url}/market/snapshot`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        symbol: "BTCUSDT",
        expected_direction: "long"
      });
    } finally {
      await provider.close();
    }
  });

  it("runs replay scenarios through an explicit sbx artifact runner adapter", async () => {
    const fakeSbx = path.join(tmpDir, "sbx");
    const commandLog = path.join(tmpDir, "sbx-commands.log");
    await writeFile(fakeSbx, fakeSbxTradingScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "sbx-session"),
      session_id: "sbx-session",
      iterations: 1,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-s10-test"
      })
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      decision: "keep",
      score: 1,
      evaluation: {
        status: "accepted"
      }
    });
    const scenarioResults = result.entries[0].evaluation.scenario_results ?? [];
    expect(scenarioResults).toEqual([
      expect.objectContaining({
        scenario_id: "trend_long",
        runner_kind: "docker_sandboxes_sbx",
        provider_request_count: 3,
        runner_command_count: 5,
        runner_command_evidence: expect.arrayContaining([
          expect.objectContaining({
            command: expect.arrayContaining(["version"]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining(["create", "--name"]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining([expect.stringContaining("replay-provider-sidecar.py")]),
            exit_code: 0
          }),
          expect.objectContaining({
            command: expect.arrayContaining(["rm", "--force"]),
            exit_code: 0
          })
        ])
      }),
      expect.objectContaining({
        scenario_id: "range_flat",
        runner_kind: "docker_sandboxes_sbx",
        provider_request_count: 3,
        runner_command_count: 5,
        runner_command_evidence: expect.any(Array)
      })
    ]);
    expect(scenarioResults.every((result) => result.sandbox_name?.startsWith("ouro-s10-test-"))).toBe(true);

    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    expect(commands.filter((command) => command === "version")).toHaveLength(2);
    expect(commands.filter((command) => command.startsWith("create --name ouro-s10-test-"))).toHaveLength(2);
    expect(commands.filter((command) => command.startsWith("exec -d -w "))).toHaveLength(0);
    expect(commands.filter((command) => command.startsWith("exec -w "))).toHaveLength(2);
    expect(commands.filter((command) => command.startsWith("stop ouro-s10-test-"))).toHaveLength(2);
    expect(commands.filter((command) => command.startsWith("rm --force ouro-s10-test-"))).toHaveLength(2);
    expect(commands.join("\n")).toContain("TRADING_API_BASE_URL='http://127.0.0.1:");
    delete process.env.SBX_FAKE_COMMAND_LOG;
  });

  it("records sbx create failure command evidence in replay scenario results", async () => {
    const fakeSbx = path.join(tmpDir, "sbx-create-fails");
    const commandLog = path.join(tmpDir, "sbx-create-fails.log");
    await writeFile(fakeSbx, fakeSbxCreateFailureScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const result = await runTradingResearchLoop({
      run_root: path.join(tmpDir, "sbx-create-failed-session"),
      session_id: "sbx-create-failed-session",
      iterations: 1,
      agent_adapter: new FixtureTradingResearchAgentAdapter(),
      artifact_runner: new DockerSandboxesSbxTradingArtifactRunner({
        sbxPath: fakeSbx,
        workspacePath: tmpDir,
        sandboxNamePrefix: "ouro-s10-create-fails"
      })
    });

    expect(result.entries[0]).toMatchObject({
      decision: "crash",
      score: 0,
      evaluation: {
        status: "disqualified",
        risk_decision: "no_order_request"
      }
    });
    const scenarioResult = result.entries[0].evaluation.scenario_results?.[0];
    expect(scenarioResult).toMatchObject({
      scenario_id: "trend_long",
      run_status: "crashed",
      provider_request_count: 0,
      runner_command_count: 2,
      runner_command_evidence: [
        expect.objectContaining({
          command: [fakeSbx, "version"],
          exit_code: 0,
          stdout_preview: expect.stringContaining("Client Version:")
        }),
        expect.objectContaining({
          command: [fakeSbx, "create", "--name", scenarioResult?.sandbox_name, "shell", tmpDir],
          exit_code: 42,
          stderr_preview: "create failed: run-control unavailable\n"
        })
      ]
    });
    expect(await readFile(commandLog, "utf8")).toContain("create --name");
    delete process.env.SBX_FAKE_COMMAND_LOG;
  });

  it("builds a Codex-first artifact edit command without exposing provider proposal internals", async () => {
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

function fakeSbxTradingScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"

case "$1" in
  version)
    printf 'Client Version: fake-sbx\\nServer Version: fake-sbx\\n'
    ;;
  create)
    exit 0
    ;;
  exec)
    shift
    workdir=""
    if [ "\${1:-}" = "-w" ]; then
      workdir="$2"
      shift 2
    fi
    shift
    if [ "\${1:-}" = "env" ]; then
      shift
      while [ "$#" -gt 0 ]; do
        case "$1" in
          *=*)
            export "$1"
            shift
            ;;
          *)
            break
            ;;
        esac
      done
    fi
    cd "$workdir"
    "$@"
    ;;
  stop)
    exit 0
    ;;
  rm)
    exit 0
    ;;
  *)
    echo "unexpected sbx command: $*" >&2
    exit 64
    ;;
esac
`;
}

function fakeSbxCreateFailureScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"

case "$1" in
  version)
    printf 'Client Version: fake-sbx\\nServer Version: fake-sbx\\n'
    ;;
  create)
    echo 'create failed: run-control unavailable' >&2
    exit 42
    ;;
  *)
    echo "unexpected sbx command: $*" >&2
    exit 64
    ;;
esac
`;
}
