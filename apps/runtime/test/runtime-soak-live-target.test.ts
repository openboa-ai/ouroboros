import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStore } from "@ouroboros/local-store";
import {
  buildLiveRuntimeSoakSample,
  createLiveRuntimeSoakHarnessConfig,
  createLiveRuntimeSoakScenario,
  liveRuntimeSoakControlPlan,
  paperObservationStreams,
  parseLiveRuntimeSoakTargetConfig,
  recordLiveRuntimeSoakEffect,
  sandboxSamples
} from "../src/runtime-soak-live-target.js";
import {
  createLiveRuntimeSoakEnvironmentManifest,
  createLiveRuntimeSoakLaunchAgent,
  verifyLiveRuntimeSoakEnvironmentManifest
} from "../src/runtime-soak-live-preparation.js";
import { recoverProviderGeneratedCandidate } from
  "../src/runtime-soak-live-control.js";
import { runLiveRuntimeSoakTargetCommand } from
  "../src/run-runtime-soak-live-target.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("live RuntimeSoakTarget", () => {
  it("keeps the selected PaperTradingEvaluation running until exact 24-hour cleanup", () => {
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
      at_ms: 24 * 60 * 60 * 1_000
    });
    expect(scenario.duration_ms).toBeGreaterThan(24 * 60 * 60 * 1_000);
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
      raw_api_token: "must-not-be-accepted"
    })).toThrow(/target config/i);
    expect(() => parseLiveRuntimeSoakTargetConfig({
      ...config,
      authority: { ...config.authority, live_exchange_authority: true }
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
      ["sandbox-recovery", ["paper.restart", "sandbox.verify"]],
      ["gateway-unavailable", ["gateway.block", "gateway.verify"]],
      ["gateway-recovery", ["gateway.unblock", "market.verify"]],
      ["terminal-cleanup", ["paper.stop", "sandbox.stop", "runtime.stop"]]
    ]);
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
        auth_digest: digest("raw-auth-never-persisted"),
        profile_digest: digest("managed-profile")
      },
      sandbox: {
        command: "/opt/homebrew/bin/sbx",
        version: "sbx version: v0.35.0",
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
      provider: { status: "authenticated", profile: "codex" },
      sandbox: { adapter_kind: "docker_sandboxes_sbx" },
      public_market: {
        gateway_owner: "MarketDataPort",
        source_origin: "https://fapi.binance.com"
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
      auth_digest: digest("auth"),
      profile_digest: digest("profile")
    },
    sandbox: {
      command: config.sandbox.command,
      version: "sbx version: v0.35.0",
      diagnose_digest: digest("diagnose"),
      preflight_digest: digest("preflight")
    },
    publicMarketProbeDigest: digest("binance"),
    harnessConfigDigest: digest("harness"),
    launchAgentDigest: digest("launch")
  });
}
