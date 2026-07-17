import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { probeAgentProfile, setupAgentProfile } from
  "@ouroboros/application/agent/profiles";
import { classifyPaperTradingFailure } from
  "@ouroboros/application/trading/paper/failures";
import type { LedgerChainReadModel } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  buildLiveRuntimeSoakSample,
  createLiveRuntimeSoakHarnessConfig,
  createLiveRuntimeSoakScenario,
  liveProviderRecoveryTimeoutMs,
  liveRuntimeSoakControlPlan,
  liveRuntimeSoakSandboxEnvironment,
  liveRuntimeSoakSelectedSandboxResource,
  expectedSelectedSandboxStatus,
  paperObservationStreams,
  parseLiveRuntimeSoakTargetConfig,
  recordLiveRuntimeSoakEffect,
  runtimeSoakLedgerChain,
  sandboxSamples
} from "../src/runtime-soak-live-target.js";
import {
  createLiveRuntimeSoakEnvironmentManifest,
  createLiveRuntimeSoakLaunchAgent,
  digestRuntimeSoakExecutable,
  inspectCleanRuntimeSoakRepository,
  readRestrictedAuth,
  verifyLiveRuntimeSoakEnvironmentManifest
} from "../src/runtime-soak-live-preparation.js";
import {
  applyLiveRuntimeSoakSandboxHome,
  LIVE_RUNTIME_SOAK_GATEWAY_FAILURE_REASON,
  liveRuntimeSoakAgentProfileExecFile,
  reconcileRuntimeOwnershipRecords,
  recoverProviderGeneratedCandidate,
  requestLiveRuntimeApi,
  restartLiveRuntimeSoakPaper,
  runtimeOwnershipRecordsReleased,
  runOwnedSandboxNames,
  stopRuntimeProcessGroup
} from
  "../src/runtime-soak-live-control.js";
import {
  executeFrozenLiveRuntimeSoakControl,
  liveRuntimeSoakLaunchCompletion,
  runLiveRuntimeSoakTargetCommand,
  runtimeSoakLogMessage
} from
  "../src/run-runtime-soak-live-target.js";

const temporaryRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("live RuntimeSoakTarget", () => {
  it("keeps the selected PaperTradingEvaluation running until exact 2-hour cleanup", () => {
    const scenario = createLiveRuntimeSoakScenario("runtime-soak-live-001");

    expect(scenario.actions.map((action) => action.kind)).toEqual([
      "clean_restart",
      "crash",
      "recovery",
      "delayed_cleanup",
      "recovery",
      "provider_loss",
      "recovery",
      "sandbox_loss",
      "recovery",
      "gateway_unavailable",
      "recovery",
      "terminal_cleanup"
    ]);
    expect(scenario.actions.at(-1)).toMatchObject({
      kind: "terminal_cleanup",
      at_ms: 2 * 60 * 60 * 1_000
    });
    expect(scenario.duration_ms - scenario.actions.at(-1)!.at_ms)
      .toBeGreaterThanOrEqual(11 * 60 * 1_000);
  });

  it("keeps incomplete Ledger sample markers contiguous", () => {
    const chain = runtimeSoakLedgerChain({
      chain_id: "ledger-chain-incomplete",
      chain_complete: false,
      occurred_at: "2026-07-16T12:00:00.000Z",
      order_request: {
        order_request_id: "order-request-incomplete",
        intent_kind: "place_order",
        market_scope: "external_trading_api_fixture",
        side: "buy",
        order_type: "market",
        quantity: "0.001",
        status: "proposed",
        created_at: "2026-07-16T12:00:00.000Z",
        authority_status: "not_submitted"
      },
      gateway_result: null,
      execution_result: null,
      authority_status: "not_live"
    } satisfies LedgerChainReadModel);

    expect(chain.entries.map((entry) => entry.sequence)).toEqual([1, 2]);
  });

  it("propagates a failed harness classification to the launch process", () => {
    expect(liveRuntimeSoakLaunchCompletion("runtime-soak-live-001", {
      exitCode: 1,
      result: { classification: "target_failed" }
    })).toEqual({
      exitCode: 1,
      output: {
        run_id: "runtime-soak-live-001",
        status: "completed",
        classification: "target_failed"
      }
    });
  });

  it("binds provider and Sandbox probes to the configured commands", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-provider-"));
    temporaryRoots.push(root);
    const store = new LocalStore(path.join(root, "store"));
    await store.initialize();
    await setupAgentProfile({ store, profileId: "codex" });
    const commands: string[] = [];

    await probeAgentProfile({
      store,
      profileId: "codex",
      command: "/configured/codex",
      async execFile(file, args) {
        commands.push([file, ...args].join(" "));
        return { stdout: args[0] === "--version" ? "codex-cli configured\n" : "", stderr: "" };
      }
    });

    expect(commands).toEqual([
      "/configured/codex --version",
      "/configured/codex login status"
    ]);
    expect(liveRuntimeSoakSandboxEnvironment(
      "/configured/sbx",
      "/isolated/sbx-home",
      { PATH: "/usr/bin", OUROBOROS_SBX_BIN: "/stale/sbx", HOME: "/stale/home" }
    )).toMatchObject({
      PATH: "/usr/bin",
      HOME: "/isolated/sbx-home",
      OUROBOROS_SBX_BIN: "/configured/sbx",
      OUROBOROS_SBX_HOME: "/isolated/sbx-home"
    });
    expect(liveRuntimeSoakSandboxEnvironment(
      "/configured/sbx",
      undefined,
      {
        PATH: "/usr/bin",
        HOME: "/operator/home",
        OUROBOROS_SBX_HOME: "/stale/sbx-home"
      }
    )).toEqual({
      PATH: "/usr/bin",
      HOME: "/operator/home",
      OUROBOROS_SBX_BIN: "/configured/sbx"
    });
  });

  it("binds runtime profile probes to the configured provider executable", async () => {
    const commands: string[] = [];
    const execute = liveRuntimeSoakAgentProfileExecFile(
      "/configured/codex",
      async (file, args) => {
        commands.push([file, ...args].join(" "));
        return { stdout: "", stderr: "" };
      }
    );

    await execute("codex", ["--version"]);
    await execute("claude", ["--version"]);

    expect(commands).toEqual([
      "/configured/codex --version",
      "claude --version"
    ]);
  });

  it("verifies frozen bindings before every effectful control", async () => {
    const calls: string[] = [];

    await executeFrozenLiveRuntimeSoakControl({
      verify: async () => { calls.push("verify"); },
      execute: async () => { calls.push("execute"); }
    });
    expect(calls).toEqual(["verify", "execute"]);

    calls.length = 0;
    await expect(executeFrozenLiveRuntimeSoakControl({
      verify: async () => {
        calls.push("verify");
        throw new Error("frozen binding changed");
      },
      execute: async () => { calls.push("execute"); }
    })).rejects.toThrow(/frozen binding changed/i);
    expect(calls).toEqual(["verify"]);
  });

  it("models intentional Gateway loss as a restartable terminal paper interval", () => {
    expect(classifyPaperTradingFailure(LIVE_RUNTIME_SOAK_GATEWAY_FAILURE_REASON))
      .toMatchObject({ failure_kind: "market_data_gap" });
    expect(expectedSelectedSandboxStatus([
      { effect_id: "provider-recovery", occurrence_count: 1 },
      { effect_id: "gateway-unavailable", occurrence_count: 1 }
    ])).toBe("terminal");
    expect(expectedSelectedSandboxStatus([
      { effect_id: "provider-recovery", occurrence_count: 1 },
      { effect_id: "gateway-unavailable", occurrence_count: 1 },
      { effect_id: "gateway-recovery", occurrence_count: 1 }
    ])).toBe("active");
  });

  it("rejects repository changes made after the frozen commit", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-repo-"));
    temporaryRoots.push(root);
    await execFileAsync("git", ["init", "--quiet"], { cwd: root });
    await writeFile(path.join(root, "tracked.txt"), "frozen\n", "utf8");
    await execFileAsync("git", ["add", "tracked.txt"], { cwd: root });
    await execFileAsync("git", [
      "-c", "user.name=Ouroboros Test",
      "-c", "user.email=ouroboros@example.invalid",
      "commit", "--quiet", "-m", "frozen"
    ], { cwd: root });

    await expect(inspectCleanRuntimeSoakRepository(root)).resolves.toMatchObject({
      commit: expect.stringMatching(/^[a-f0-9]{40}$/),
      tree: expect.stringMatching(/^[a-f0-9]{40}$/)
    });
    await writeFile(path.join(root, "tracked.txt"), "dirty\n", "utf8");
    await expect(inspectCleanRuntimeSoakRepository(root)).rejects.toThrow(/clean frozen/i);
  });

  it("removes an ambient Sandbox home from the live runtime", () => {
    const environment = { OUROBOROS_SBX_HOME: "/stale/sbx-home" };

    applyLiveRuntimeSoakSandboxHome(undefined, environment);

    expect(environment).toEqual({});
  });

  it("accepts only an authority-free, secretless, public target config", () => {
    const config = targetConfig();

    expect(parseLiveRuntimeSoakTargetConfig(config)).toEqual(config);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      gateway: { ...config.gateway, source_origin: "https://demo-fapi.binance.com" }
    })).toThrow(/target config/i);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      gateway: { ...config.gateway, sandbox_host: "127.0.0.1" }
    })).toThrow(/target config/i);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      raw_api_token: "must-not-be-accepted"
    })).toThrow(/target config/i);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      authority: { ...config.authority, live_exchange_authority: true }
    })).toThrow(/target config/i);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      runtime: { ...config.runtime, port: 80 }
    })).toThrow(/target config/i);
  });

  it("preserves explicit no-order continuity without synthesizing decisions", () => {
    expect(paperObservationStreams([
      {
        paper_trading_evaluation_ref: { id: "evaluation-1" },
        sequence: 1,
        status: "no_order"
      },
      {
        paper_trading_evaluation_ref: { id: "evaluation-1" },
        sequence: 2,
        status: "recorded",
        decision: { decision_kind: "order_request" }
      },
      {
        paper_trading_evaluation_ref: { id: "evaluation-1" },
        sequence: 3,
        status: "failed",
        decision: { decision_kind: "error" }
      }
    ])).toEqual([{
      stream_id: "evaluation-1",
      entries: [
        { sequence: 1, emitted_order_request_count: 0, no_order_recorded: true },
        { sequence: 2, emitted_order_request_count: 1, no_order_recorded: false },
        { sequence: 3, emitted_order_request_count: 0, no_order_recorded: true }
      ]
    }]);
  });

  it("requires passed v2 handoff evidence for active generated Sandboxes", () => {
    const sandboxes = [{
      sandbox_id: "sandbox-generated",
      system_code_ref: { id: "system-code-generated" },
      lifecycle_status: "running"
    }];

    expect(sandboxSamples(sandboxes, [{
      version: 2,
      system_code_ref: { id: "system-code-generated" },
      status: "passed",
      runnable_paper_handoff: true,
      candidate_egress_attestation: {}
    }])).toEqual([{
      sandbox_id: "sandbox-generated",
      provider_generated: true,
      lifecycle_status: "running",
      egress_attestation_version: 2,
      egress_attestation_status: "verified"
    }]);
    expect(sandboxSamples(sandboxes, [])).toEqual([{
      sandbox_id: "sandbox-generated",
      provider_generated: true,
      lifecycle_status: "running",
      egress_attestation_status: "missing"
    }]);
  });

  it("binds shell-free controls and rebuilds one create-only cumulative sample", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-target-"));
    temporaryRoots.push(root);
    const config = targetConfig(root);
    const store = new LocalStore(config.store_root);
    await store.initialize();
    const harness = createLiveRuntimeSoakHarnessConfig(
      config,
      "/repo/apps/runtime/src/run-runtime-soak-live-target.ts",
      "/repo/node_modules/tsx/dist/cli.mjs"
    );

    expect(Object.keys(harness.controls)).toHaveLength(harness.scenario.actions.length);
    expect(new Set(Object.values(harness.controls).map((command) =>
      JSON.stringify(command.argv)
    ))).toHaveLength(1);
    await recordLiveRuntimeSoakEffect(config, "runtime-clean-restart");
    await expect(recordLiveRuntimeSoakEffect(config, "runtime-clean-restart"))
      .rejects.toThrow(/already exists/i);
    await expect(buildLiveRuntimeSoakSample(config)).resolves.toMatchObject({
      effects: [{ effect_id: "runtime-clean-restart", occurrence_count: 1 }],
      ownership: [],
      paper_observations: [],
      resources: [
        { resource_id: "ouroboros-runtime", status: "terminal" }
      ]
    });
  });

  it("maps every scheduled action to one bounded external operation plan", () => {
    const scenario = createLiveRuntimeSoakScenario("runtime-soak-live-001");
    const config = targetConfig();
    const harness = createLiveRuntimeSoakHarnessConfig(
      config,
      "/repo/run-runtime-soak-live-target.ts",
      "/repo/tsx.mjs"
    );

    expect(scenario.actions.map((action) => [
      action.action_id,
      liveRuntimeSoakControlPlan(action)
    ])).toEqual([
      [
        "runtime-clean-restart",
        ["runtime.start", "runtime.stop", "runtime.start", "provider.bind"]
      ],
      ["runtime-crash", ["runtime.kill"]],
      ["runtime-recovery", ["runtime.start", "supervisor.verify"]],
      ["cleanup-delayed", ["sandbox.fixture.start", "sandbox.external.stop"]],
      ["cleanup-recovery", ["sandbox.refresh", "sandbox.stop"]],
      ["provider-loss", ["arena.tick", "provider.kill", "ownership.verify"]],
      ["provider-recovery", ["arena.tick", "paper.start", "egress.verify"]],
      ["sandbox-loss", ["sandbox.generated.remove", "sandbox.refresh"]],
      ["sandbox-recovery", ["paper.stop", "sandbox.reset", "paper.start", "sandbox.verify"]],
      ["gateway-unavailable", [
        "gateway.block", "gateway.verify", "paper.failure.verify", "sandbox.stop.verify"
      ]],
      ["gateway-recovery", [
        "gateway.unblock", "market.verify", "paper.stop", "sandbox.reset",
        "paper.start", "sandbox.verify"
      ]],
      ["terminal-cleanup", [
        "paper.stop", "sandbox.stop", "runtime.stop", "sandbox.run-owned.cleanup"
      ]]
    ]);
    expect(harness.controls["runtime-clean-restart"]?.timeout_ms).toBe(600_000);
    expect(liveProviderRecoveryTimeoutMs(config.provider.timeout_ms)).toBe(
      config.provider.timeout_ms * 3 + 300_000
    );
    expect(harness.controls["provider-recovery"]?.timeout_ms).toBe(
      liveProviderRecoveryTimeoutMs(config.provider.timeout_ms) + 600_000
    );
  });

  it("keeps provider recovery bounded while preserving failed arena attempts", async () => {
    const attempted: number[] = [];
    const candidates = [undefined, undefined, "candidate-provider-003"];

    await expect(recoverProviderGeneratedCandidate(async () => {
      attempted.push(attempted.length + 1);
      return candidates.shift();
    }, 3)).resolves.toBe("candidate-provider-003");
    expect(attempted).toEqual([1, 2, 3]);

    let exhausted = 0;
    await expect(recoverProviderGeneratedCandidate(async () => {
      exhausted += 1;
      return undefined;
    }, 3)).rejects.toThrow(/3 bounded attempts/i);
    expect(exhausted).toBe(3);
  });

  it("force-stops the exact runtime process group when graceful shutdown stalls", async () => {
    const signals: string[] = [];
    const waits: number[] = [];

    await stopRuntimeProcessGroup(42, "SIGTERM", {
      signalProcessGroup(signal) {
        signals.push(signal);
      },
      async waitUntilStopped(timeoutMs) {
        waits.push(timeoutMs);
        if (waits.length === 1) throw new Error("graceful timeout");
      }
    });

    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(waits).toEqual([30_000, 10_000]);
  });

  it("waits for terminated runtime ownership to become stale or vacant", async () => {
    const inspect = async (status: string) => ({ status });

    await expect(runtimeOwnershipRecordsReleased(
      ["stale", "owned"],
      inspect
    )).resolves.toBe(false);
    await expect(runtimeOwnershipRecordsReleased(
      ["stale", "vacant"],
      inspect
    )).resolves.toBe(true);
  });

  it("treats an already-dead runtime process group as stopped", async () => {
    const waits: number[] = [];

    await stopRuntimeProcessGroup(42, "SIGKILL", {
      signalProcessGroup() {
        throw Object.assign(new Error("already dead"), { code: "ESRCH" });
      },
      async waitUntilStopped(timeoutMs) {
        waits.push(timeoutMs);
      }
    });

    expect(waits).toEqual([10_000]);
  });

  it("reconciles stale runtime ownership and rejects a blocked cleanup", async () => {
    const reconciled: string[] = [];

    await reconcileRuntimeOwnershipRecords(["stale-runtime-owner"], async (record) => {
      reconciled.push(record);
      return { status: "vacant" };
    });

    expect(reconciled).toEqual(["stale-runtime-owner"]);
    await expect(reconcileRuntimeOwnershipRecords(
      ["unknown-runtime-owner"],
      async () => ({ status: "blocked" })
    )).rejects.toThrow(/ownership reconciliation failed/i);
  });

  it("selects only exact run-owned sbx sandboxes for terminal cleanup", () => {
    const runRoot = "/tmp/ouro-runtime-soak/run-001";

    expect(runOwnedSandboxNames({
      sandboxes: [
        {
          name: "ouro-run-owned",
          workspaces: [`${runRoot}/store/candidate-arena/scenario-001`]
        },
        {
          name: "ouro-sibling-run",
          workspaces: ["/tmp/ouro-runtime-soak/run-001-other/store"]
        },
        {
          name: "hydra-unrelated",
          workspaces: ["/tmp/hydra/workspace"]
        }
      ]
    }, runRoot)).toEqual(["ouro-run-owned"]);

    expect(() => runOwnedSandboxNames({
      sandboxes: [{ name: "../unsafe", workspaces: [`${runRoot}/store`] }]
    }, runRoot)).toThrow(/sandbox list/i);

    expect(runOwnedSandboxNames({
      sandboxes: [
        { name: "ouro-recorded", status: "running", workspaces: ["/repo"] },
        { name: "ouro-unrelated", status: "running", workspaces: ["/repo"] }
      ]
    }, runRoot, ["ouro-recorded"])).toEqual(["ouro-recorded"]);
  });

  it("requires selected paper Sandbox state from both LocalStore and the sbx daemon", () => {
    const input = {
      systemCodeId: "system-code-provider-generated",
      expectedStatus: "active" as const,
      sandboxes: [{
        sandbox_id: "sandbox-selected-paper",
        sandbox_name: "ouro-selected-paper",
        system_code_ref: { id: "system-code-provider-generated" },
        lifecycle_status: "running"
      }]
    };

    expect(liveRuntimeSoakSelectedSandboxResource({
      ...input,
      daemonSandboxes: []
    })).toMatchObject({
      resource_id: "sandbox-selected-paper",
      resource_kind: "selected_paper_sandbox",
      status: "terminal",
      expected_status: "active"
    });
    expect(liveRuntimeSoakSelectedSandboxResource({
      ...input,
      daemonSandboxes: [{ name: "ouro-selected-paper", status: "running", workspaces: ["/repo"] }]
    })).toMatchObject({ status: "active", expected_status: "active" });

    expect(liveRuntimeSoakSelectedSandboxResource({
      ...input,
      sandboxes: [
        {
          ...input.sandboxes[0]!,
          sandbox_id: "sandbox-stale-paper",
          sandbox_name: "ouro-stale-paper",
          lifecycle_status: "removed"
        },
        input.sandboxes[0]!
      ],
      daemonSandboxes: [{ name: "ouro-selected-paper", status: "running", workspaces: ["/repo"] }]
    })).toMatchObject({
      resource_id: "sandbox-selected-paper",
      status: "active",
      expected_status: "active"
    });
  });

  it("stops the stale paper session before starting Sandbox recovery", async () => {
    const calls: string[] = [];

    await restartLiveRuntimeSoakPaper({
      tradingRunId: "trading-run-selected",
      candidateId: "candidate-selected",
      stop: async (tradingRunId) => { calls.push(`stop:${tradingRunId}`); },
      resetSandbox: async () => { calls.push("reset"); },
      start: async (candidateId) => { calls.push(`start:${candidateId}`); },
      waitForVerified: async () => { calls.push("verify"); }
    });

    expect(calls).toEqual([
      "stop:trading-run-selected",
      "reset",
      "start:candidate-selected",
      "verify"
    ]);
  });

  it("keeps long-running runtime controls on an explicit bounded HTTP transport", async () => {
    let authorization: string | undefined;
    const apiServer = createServer((request, response) => {
      authorization = request.headers.authorization;
      setTimeout(() => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "succeeded" }));
      }, 40);
    });
    await new Promise<void>((resolve, reject) => {
      apiServer.once("error", reject);
      apiServer.listen(0, "127.0.0.1", resolve);
    });
    const address = apiServer.address() as AddressInfo;

    try {
      await expect(requestLiveRuntimeApi(
        `http://127.0.0.1:${address.port}`,
        "/api/commands",
        "operator-token",
        { method: "POST", body: { command_kind: "arena.tick" }, timeout_ms: 1_000 }
      )).resolves.toEqual({
        ok: true,
        status: 200,
        body: { status: "succeeded" }
      });
      expect(authorization).toBe("Bearer operator-token");
      await expect(requestLiveRuntimeApi(
        "http://192.0.2.1:43190",
        "/api/commands",
        "operator-token"
      )).rejects.toThrow(/loopback/i);
    } finally {
      await new Promise<void>((resolve, reject) => apiServer.close((error) => {
        if (error) reject(error);
        else resolve();
      }));
    }
  });

  it("reads restricted auth through one non-following handle and bounds log lines", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-auth-"));
    temporaryRoots.push(root);
    const authFile = path.join(root, "auth.json");
    const authLink = path.join(root, "auth-link.json");
    await writeFile(authFile, "{\"token\":\"test\"}\n", { mode: 0o600 });
    await chmod(authFile, 0o600);
    await symlink(authFile, authLink);

    await expect(readRestrictedAuth(authFile)).resolves.toEqual(
      Buffer.from("{\"token\":\"test\"}\n")
    );
    await expect(readRestrictedAuth(authLink)).rejects.toThrow();
    expect(runtimeSoakLogMessage(new Error("failed\nforged\rline\u0000")))
      .toBe("failed forged line ");
  });

  it("binds frozen toolchains to non-followed executable bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-toolchain-"));
    temporaryRoots.push(root);
    const executable = path.join(root, "tool");
    const executableLink = path.join(root, "tool-link");
    await writeFile(executable, "toolchain-v1\n", { mode: 0o700 });
    await chmod(executable, 0o700);
    await symlink(executable, executableLink);

    await expect(digestRuntimeSoakExecutable(executable))
      .resolves.toBe(digest("toolchain-v1\n"));
    await expect(digestRuntimeSoakExecutable(executableLink)).rejects.toThrow();
  });

  it("freezes a secretless environment manifest and crash-only launch agent", () => {
    const config = targetConfig();
    const manifest = createLiveRuntimeSoakEnvironmentManifest({
      config,
      frozenAt: "2026-07-16T12:00:00.000Z",
      repositoryCommit: "a".repeat(40),
      repositoryTree: "b".repeat(40),
      host: {
        hostname: "soak-host",
        platform: "darwin",
        architecture: "arm64",
        node_version: "v24.0.0"
      },
      provider: {
        command: "/opt/homebrew/bin/codex",
        version: "codex-cli 0.144.2",
        executable_digest: digest("codex-executable"),
        auth_digest: digest("raw-auth-never-persisted"),
        profile_digest: digest("managed-profile")
      },
      nodeExecutableDigest: digest("node-executable"),
      tsxCliDigest: digest("tsx-cli"),
      sandbox: {
        command: "/opt/homebrew/bin/sbx",
        version: "sbx version: v0.35.0",
        executable_digest: digest("sbx-executable"),
        diagnose_digest: digest("diagnose"),
        preflight_digest: digest("preflight")
      },
      publicMarketProbeDigest: digest("binance-time"),
      harnessConfigDigest: digest("harness-config"),
      launchAgentDigest: digest("launch-agent")
    });

    expect(manifest).toMatchObject({
      record_kind: "runtime_soak_environment_manifest",
      run_id: config.run_id,
      repository: { clean: true, commit: "a".repeat(40) },
      provider: {
        status: "authenticated",
        profile: "codex",
        executable_digest: digest("codex-executable")
      },
      sandbox: {
        adapter_kind: "docker_sandboxes_sbx",
        executable_digest: digest("sbx-executable")
      },
      public_market: {
        gateway_owner: "MarketDataPort",
        source_origin: "https://fapi.binance.com",
        sandbox_gateway_host: "host.docker.internal"
      },
      target: {
        node_executable_digest: digest("node-executable"),
        tsx_cli_digest: digest("tsx-cli")
      },
      authority: config.authority
    });
    expect(manifest.manifest_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(manifest)).not.toContain("raw-auth-never-persisted");
    expect(verifyLiveRuntimeSoakEnvironmentManifest(config, manifest)).toEqual(manifest);
    expect(() => verifyLiveRuntimeSoakEnvironmentManifest({
      ...config,
      runtime: { ...config.runtime, port: config.runtime.port + 1 }
    }, manifest)).toThrow(/manifest/i);

    const launchAgent = createLiveRuntimeSoakLaunchAgent({
      label: "ai.openboa.ouroboros.soak.test",
      repoRoot: "/repo",
      nodePath: "/usr/local/bin/node",
      tsxCli: "/repo/node_modules/tsx/dist/cli.mjs",
      entrypoint: "/repo/apps/runtime/src/run-runtime-soak-live-target.ts",
      targetConfigPath: "/run/config/target.json",
      stdoutPath: "/run/logs/harness.stdout.log",
      stderrPath: "/run/logs/harness.stderr.log",
      home: "/Users/operator",
      pathEnvironment: "/opt/homebrew/bin:/usr/bin:/bin"
    });
    expect(launchAgent).toContain("<key>RunAtLoad</key><true/>");
    expect(launchAgent).toContain("<key>SuccessfulExit</key><false/>");
    expect(launchAgent).toContain("<string>launch</string>");
    expect(launchAgent).not.toContain("auth.json");
  });

  it("probes only a manifest-bound config and requires harness action metadata", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-live-soak-cli-"));
    temporaryRoots.push(root);
    const config = targetConfig(root);
    await new LocalStore(config.store_root).initialize();
    await mkdir(path.join(root, "config"), { recursive: true });
    const configPath = path.join(root, "config", "target.json");
    const manifest = environmentManifest(config);
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(path.join(root, "environment-manifest.json"), JSON.stringify(manifest));
    const output: string[] = [];

    await expect(runLiveRuntimeSoakTargetCommand(
      ["probe", "--config", configPath],
      { stdout: (line) => output.push(line) },
      {}
    )).resolves.toEqual({ exitCode: 0 });
    expect(JSON.parse(output[0]!)).toMatchObject({ version: 1, effects: [] });
    await expect(runLiveRuntimeSoakTargetCommand(
      ["control", "--config", configPath],
      { stdout: () => undefined },
      {}
    )).rejects.toThrow(/action metadata/i);
  });

  it("rejects a privileged runtime port before live preparation", async () => {
    await expect(runLiveRuntimeSoakTargetCommand([
      "prepare",
      "--run-id", "runtime-soak-live-privileged-port",
      "--runtime-port", "80",
      "--auth-source", "/missing/auth.json"
    ], { stdout: () => undefined }, {})).rejects.toThrow(/preparation input/i);
  });
});

function targetConfig(root = "/run") {
  return {
    version: 1 as const,
    run_id: "runtime-soak-live-001",
    repo_root: "/repo",
    run_root: root,
    store_root: path.join(root, "store"),
    report_root: path.join(root, "report"),
    state_root: path.join(root, "state"),
    runtime: {
      host: "127.0.0.1" as const,
      port: 43173,
      token_file: path.join(root, "secrets/operator-token"),
      log_file: path.join(root, "logs/runtime.log")
    },
    gateway: {
      source_origin: "https://fapi.binance.com" as const,
      sandbox_host: "host.docker.internal" as const,
      gate_file: path.join(root, "state/gateway-unavailable")
    },
    provider: {
      kind: "codex" as const,
      profile: "codex" as const,
      command: "/usr/bin/codex",
      reasoning_effort: "low" as const,
      timeout_ms: 180_000
    },
    sandbox: {
      adapter_kind: "docker_sandboxes_sbx" as const,
      command: "/usr/bin/sbx"
    },
    authority: {
      evaluation_authority: false as const,
      promotion_authority: false as const,
      order_submission_authority: false as const,
      private_exchange_authority: false as const,
      live_exchange_authority: false as const,
      authority_status: "operational_test_only" as const
    }
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function environmentManifest(config: ReturnType<typeof targetConfig>) {
  return createLiveRuntimeSoakEnvironmentManifest({
    config,
    frozenAt: "2026-07-16T12:00:00.000Z",
    repositoryCommit: "a".repeat(40),
    repositoryTree: "b".repeat(40),
    host: {
      hostname: "soak-host",
      platform: "darwin",
      architecture: "arm64",
      node_version: "v24.0.0"
    },
    provider: {
      command: config.provider.command,
      version: "codex-cli 0.144.2",
      executable_digest: digest("codex-executable"),
      auth_digest: digest("auth"),
      profile_digest: digest("profile")
    },
    nodeExecutableDigest: digest("node-executable"),
    tsxCliDigest: digest("tsx-cli"),
    sandbox: {
      command: config.sandbox.command,
      version: "sbx version: v0.35.0",
      executable_digest: digest("sbx-executable"),
      diagnose_digest: digest("diagnose"),
      preflight_digest: digest("preflight")
    },
    publicMarketProbeDigest: digest("binance"),
    harnessConfigDigest: digest("harness"),
    launchAgentDigest: digest("launch")
  });
}
