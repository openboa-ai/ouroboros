import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFixtureRecords, FIXTURE_SYSTEM_CODE_ID } from "@ouroboros/local-store";
import type { SystemCodeRecord } from "@ouroboros/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DockerSandboxesSbxSandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
import { CANDIDATE_NETWORK_DENY_PROBES } from
  "@ouroboros/application/trading/research/candidate-sandbox-network-policy";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-sbx-adapter-"));
});

afterEach(async () => {
  delete process.env.SBX_FAKE_COMMAND_LOG;
  delete process.env.SBX_FAKE_HEARTBEAT_AFTER;
  delete process.env.SBX_FAKE_HEARTBEAT_COUNTER;
  delete process.env.SBX_FAKE_FINITE_STOPPED;
  delete process.env.SBX_FAKE_INSTANCE_ID;
  delete process.env.SBX_FAKE_INHERITED_ALLOW_JSON;
  delete process.env.SBX_FAKE_REMOVE_FAIL;
  delete process.env.SBX_EXPECT_HOME;
  delete process.env.OUROBOROS_SDX_BIN;
  delete process.env.OUROBOROS_SBX_HOME;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Docker Sandboxes sbx runtime adapter", () => {
  it("rejects unsafe sbx sandbox names before invoking the sbx CLI", async () => {
    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: path.join(tmpDir, "missing-sbx"),
      workspacePath: "."
    });

    await expect(adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-unsafe-name",
      sandbox_name: "--help",
      sandbox_placement_id: "sandbox-placement-unsafe-name",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    })).rejects.toThrow("invalid_sbx_sandbox_name");
  });

  it("uses documented sbx commands and captures command evidence without raw secret material", async () => {
    const commandLog = path.join(tmpDir, "commands.log");
    const fakeSbx = path.join(tmpDir, "sbx");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-fake-sbx";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: "."
    });
    const artifact = clockArtifactFixture();
    const start = await adapter.startArtifactInstance({
      artifact,
      instance_id: "sandbox-fake-sbx",
      sandbox_name: "ouro-s5-clock-fake",
      sandbox_placement_id: "sandbox-placement-fake-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      test_ticks: 2,
      interval_ms: 1
    });

    expect(start.instance.adapter_kind).toBe("docker_sandboxes_sbx");
    expect(start.instance.lifecycle_status).toBe("running");
    expect(start.command_evidence).toHaveLength(12);
    expect(start.command_evidence.map((evidence) => evidence.command.slice(1, 3))).toEqual([
      ["version"],
      ["create", "--name"],
      ["policy", "ls"],
      ...CANDIDATE_NETWORK_DENY_PROBES.map(() => ["policy", "check"]),
      ["exec", "-d"],
      ["exec", "ouro-s5-clock-fake"]
    ]);
    expect(JSON.stringify(start.command_evidence)).not.toMatch(/secret|password|token|api[-_]?key|credential/i);

    const logs = await adapter.getArtifactInstanceLogs(start.instance);
    expect(logs.logs?.[0]?.lines[0]).toContain("sandbox-fake-sbx");
    expect(logs.heartbeats?.[0]?.heartbeat_line).toContain("runtime_heartbeat");
    const firstStatus = await adapter.getArtifactInstanceStatus(start.instance);
    const secondStatus = await adapter.getArtifactInstanceStatus(start.instance);
    expect(firstStatus.command_evidence?.[1]?.sandbox_command_evidence_id).not.toBe(
      secondStatus.command_evidence?.[1]?.sandbox_command_evidence_id
    );
    const secondLogs = await adapter.getArtifactInstanceLogs(start.instance);
    expect(logs.command_evidence?.[1]?.sandbox_command_evidence_id).not.toBe(
      secondLogs.command_evidence?.[1]?.sandbox_command_evidence_id
    );

    const stop = await adapter.stopArtifactInstance(start.instance);
    expect(stop.lifecycle_status).toBe("removed");
    expect(stop.command_evidence?.map((evidence) => evidence.command[1])).toEqual([
      "version",
      "exec",
      "stop",
      ...Array.from({ length: CANDIDATE_NETWORK_DENY_PROBES.length + 3 }, () =>
        "policy"
      ),
      "rm"
    ]);

    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    expect(commands).toEqual([
      "version",
      "create --name ouro-s5-clock-fake shell .",
      ...denyPolicyCommands("ouro-s5-clock-fake"),
      "exec -d -w . ouro-s5-clock-fake python3 fixtures/trading-systems/clock.py --instance-id sandbox-fake-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-fake-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-fake-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid --ticks 2",
      "exec ouro-s5-clock-fake cat /tmp/ouroboros-sandbox-fake-sbx.heartbeat.json",
      "version",
      "exec ouro-s5-clock-fake cat /tmp/ouroboros-sandbox-fake-sbx.jsonl",
      "version",
      "exec ouro-s5-clock-fake cat /tmp/ouroboros-sandbox-fake-sbx.heartbeat.json",
      "version",
      "exec ouro-s5-clock-fake cat /tmp/ouroboros-sandbox-fake-sbx.heartbeat.json",
      "version",
      "exec ouro-s5-clock-fake cat /tmp/ouroboros-sandbox-fake-sbx.jsonl",
      "version",
      "exec ouro-s5-clock-fake pkill -TERM -f fixtures/trading-systems/clock.py",
      "stop ouro-s5-clock-fake",
      ...terminalDenyPolicyCommands("ouro-s5-clock-fake"),
      "policy log ouro-s5-clock-fake --json --limit 100",
      "rm --force ouro-s5-clock-fake"
    ]);
  });

  it("waits under the startup timeout for a delayed first heartbeat", async () => {
    const commandLog = path.join(tmpDir, "slow-startup-commands.log");
    const heartbeatCounter = path.join(tmpDir, "slow-startup-heartbeat-count");
    const fakeSbx = path.join(tmpDir, "sbx-slow-startup");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_HEARTBEAT_AFTER = "3";
    process.env.SBX_FAKE_HEARTBEAT_COUNTER = heartbeatCounter;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      startupHeartbeatTimeoutMs: 1_000,
      startupHeartbeatPollIntervalMs: 1
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-slow-startup-sbx",
      sandbox_name: "ouro-s5-clock-slow-startup",
      sandbox_placement_id: "sandbox-placement-slow-startup-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("running");
    expect(start.heartbeats).toHaveLength(1);
    expect(start.command_evidence.map((evidence) => evidence.command.slice(1, 3))).toEqual([
      ["version"],
      ["create", "--name"],
      ["policy", "ls"],
      ...CANDIDATE_NETWORK_DENY_PROBES.map(() => ["policy", "check"]),
      ["exec", "-d"],
      ["exec", "ouro-s5-clock-slow-startup"],
      ["exec", "ouro-s5-clock-slow-startup"],
      ["exec", "ouro-s5-clock-slow-startup"]
    ]);
    expect((await readFile(heartbeatCounter, "utf8")).trim()).toBe("3");
  });

  it("treats a finite detached run that stops before heartbeat read as stopped", async () => {
    const commandLog = path.join(tmpDir, "finite-stopped-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-finite-stopped");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_FINITE_STOPPED = "1";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      startupHeartbeatTimeoutMs: 1_000,
      startupHeartbeatPollIntervalMs: 1
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-finite-stopped-sbx",
      sandbox_name: "ouro-s5-clock-finite-stopped",
      sandbox_placement_id: "sandbox-placement-finite-stopped-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      test_ticks: 2,
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("stopped");
    expect(start.instance.started_at).toBe("2026-05-10T00:00:00.000Z");
    expect(start.instance.stopped_at).toBe("2026-05-10T00:00:01.000Z");
    expect(start.heartbeats).toHaveLength(0);
    expect(start.logs[0]?.lines.some((line) => line.includes("\"runtime_stopped\""))).toBe(true);

    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    expect(commands).toEqual([
      "version",
      "create --name ouro-s5-clock-finite-stopped shell .",
      ...denyPolicyCommands("ouro-s5-clock-finite-stopped"),
      "exec -d -w . ouro-s5-clock-finite-stopped python3 fixtures/trading-systems/clock.py --instance-id sandbox-finite-stopped-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-finite-stopped-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-finite-stopped-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid --ticks 2",
      "exec ouro-s5-clock-finite-stopped cat /tmp/ouroboros-sandbox-finite-stopped-sbx.heartbeat.json",
      "exec ouro-s5-clock-finite-stopped cat /tmp/ouroboros-sandbox-finite-stopped-sbx.jsonl",
      ...terminalDenyPolicyCommands("ouro-s5-clock-finite-stopped"),
      "policy log ouro-s5-clock-finite-stopped --json --limit 100",
      "rm --force ouro-s5-clock-finite-stopped"
    ]);
  });

  it("persists failed lifecycle evidence when sbx create fails before detached exec", async () => {
    const commandLog = path.join(tmpDir, "failed-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-fail-create");
    await writeFile(fakeSbx, fakeSbxCreateFailureScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-failed-sbx",
      sandbox_name: "ouro-s5-clock-failed",
      sandbox_placement_id: "sandbox-placement-failed-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("failed");
    expect(start.instance.started_at).toBeUndefined();
    expect(start.instance.command_evidence_refs).toEqual([
      {
        record_kind: "sandbox_command_evidence",
        id: "sandbox-command-evidence-sandbox-failed-sbx-version"
      },
      {
        record_kind: "sandbox_command_evidence",
        id: "sandbox-command-evidence-sandbox-failed-sbx-create"
      }
    ]);
    expect(start.command_evidence).toHaveLength(2);
    expect(start.command_evidence[1]).toMatchObject({
      exit_code: 42,
      command: [fakeSbx, "create", "--name", "ouro-s5-clock-failed", "shell", "."],
      stderr: "runtime unavailable\n"
    });
    expect(await readFile(commandLog, "utf8")).toBe(
      "version\ncreate --name ouro-s5-clock-failed shell .\n"
    );
  });

  it("passes isolated sbx home to sbx child commands", async () => {
    const commandLog = path.join(tmpDir, "home-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-home");
    const sbxHome = path.join(tmpDir, "isolated-sbx-home");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_EXPECT_HOME = sbxHome;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      sbxHome,
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-home-sbx",
      sandbox_name: "ouro-s5-clock-home",
      sandbox_placement_id: "sandbox-placement-home-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("running");
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "create --name ouro-s5-clock-home shell .",
      ...denyPolicyCommands("ouro-s5-clock-home"),
      "exec -d -w . ouro-s5-clock-home python3 fixtures/trading-systems/clock.py --instance-id sandbox-home-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-home-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-home-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-home cat /tmp/ouroboros-sandbox-home-sbx.heartbeat.json"
    ]);
  });

  it("persists the exact Gateway rule lease and removes it after adapter restart", async () => {
    const commandLog = path.join(tmpDir, "network-policy-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-network-policy");
    const policyStatePath = path.join(tmpDir, "network-policy-leases");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-network-policy";
    process.env.SBX_FAKE_INHERITED_ALLOW_JSON = '["registry.npmjs.org:443"]';

    const startAdapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      networkPolicyStatePath: policyStatePath
    });
    const start = await startAdapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-network-policy",
      sandbox_name: "ouro-s5-network-policy",
      sandbox_placement_id: "sandbox-placement-network-policy",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1,
      env: {
        TRADING_API_BASE_URL: "http://host.docker.internal:4173"
      }
    });

    expect(start.instance.lifecycle_status).toBe("running");
    const startCommands = (await readFile(commandLog, "utf8")).trim().split("\n");
    const execIndex = startCommands.findIndex((command) => command.startsWith("exec -d "));
    expect(startCommands.findIndex((command) =>
      command === "policy deny network --sandbox ouro-s5-network-policy registry.npmjs.org:443"
    )).toBeGreaterThan(0);
    expect(startCommands.findIndex((command) =>
      command === "policy allow network --sandbox ouro-s5-network-policy localhost:4173"
    )).toBeGreaterThan(startCommands.findIndex((command) =>
      command === "policy deny network --sandbox ouro-s5-network-policy registry.npmjs.org:443"
    ));
    expect(startCommands.filter((command) => command.startsWith("policy check network ")))
      .toHaveLength(CANDIDATE_NETWORK_DENY_PROBES.length + 1);
    expect(startCommands.findIndex((command) =>
      command.startsWith("policy check network ")
    )).toBeLessThan(execIndex);
    expect(JSON.parse(await readFile(
      path.join(policyStatePath, "ouro-s5-network-policy.json"),
      "utf8"
    ))).toEqual({
      version: 2,
      sandbox_name: "ouro-s5-network-policy",
      allowed_resource: "localhost:4173",
      inherited_allowed_resources: ["registry.npmjs.org:443"],
      owned_allow_rule_ids: ["owned-allow"],
      owned_deny_rule_ids: ["owned-deny"]
    });

    const stopAdapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      networkPolicyStatePath: policyStatePath
    });
    const stop = await stopAdapter.stopArtifactInstance(start.instance);
    expect(stop).toMatchObject({
      lifecycle_status: "removed",
      removed_at: expect.any(String)
    });
    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    const stopIndex = commands.lastIndexOf("stop ouro-s5-network-policy");
    const allowCleanupIndex = commands.lastIndexOf(
      "policy rm network --sandbox ouro-s5-network-policy --id owned-allow"
    );
    const denyCleanupIndex = commands.lastIndexOf(
      "policy rm network --sandbox ouro-s5-network-policy --id owned-deny"
    );
    const removeIndex = commands.lastIndexOf(
      "rm --force ouro-s5-network-policy"
    );
    expect(stopIndex).toBeGreaterThan(0);
    expect(allowCleanupIndex).toBeGreaterThan(stopIndex);
    expect(denyCleanupIndex).toBeGreaterThan(allowCleanupIndex);
    expect(removeIndex).toBeGreaterThan(denyCleanupIndex);
    expect(commands.at(-1)).toBe("rm --force ouro-s5-network-policy");
  });

  it("migrates a v1 Gateway lease by resolving its scoped rule ID", async () => {
    const commandLog = path.join(tmpDir, "network-policy-v1-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-network-policy-v1");
    const policyStatePath = path.join(tmpDir, "network-policy-v1-leases");
    const sandboxName = "ouro-s5-network-policy-v1";
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await mkdir(policyStatePath, { recursive: true });
    await writeFile(`${commandLog}.policy.allow`, "localhost:4173\n", "utf8");
    await writeFile(path.join(policyStatePath, `${sandboxName}.json`), JSON.stringify({
      version: 1,
      sandbox_name: sandboxName,
      allowed_resource: "localhost:4173"
    }) + "\n", "utf8");
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-network-policy-v1";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      networkPolicyStatePath: policyStatePath
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-network-policy-v1",
      sandbox_name: sandboxName,
      sandbox_placement_id: "sandbox-placement-network-policy-v1",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1,
      env: {
        TRADING_API_BASE_URL: "http://host.docker.internal:4173"
      }
    });

    expect(start.instance.lifecycle_status).toBe("running");
    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    const migratedCleanup = commands.findIndex((command) =>
      command === `policy rm network --sandbox ${sandboxName} --id owned-allow`
    );
    const replacementAllow = commands.findIndex((command, index) =>
      index > migratedCleanup &&
      command === `policy allow network --sandbox ${sandboxName} localhost:4173`
    );
    expect(migratedCleanup).toBeGreaterThan(0);
    expect(replacementAllow).toBeGreaterThan(migratedCleanup);

    await adapter.stopArtifactInstance(start.instance);
  });

  it("accepts a Docker Sandboxes-compatible CLI even when it is aliased as sdx", async () => {
    const commandLog = path.join(tmpDir, "aliased-sdx-commands.log");
    const fakeAliasedSdx = path.join(tmpDir, "sdx");
    await writeFile(fakeAliasedSdx, fakeSbxScript(), "utf8");
    await chmod(fakeAliasedSdx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeAliasedSdx,
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-aliased-sdx",
      sandbox_name: "ouro-s5-clock-aliased-sdx",
      sandbox_placement_id: "sandbox-placement-aliased-sdx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("running");
    expect(start.command_evidence[0]).toMatchObject({
      command: [fakeAliasedSdx, "version"],
      stdout: expect.stringContaining("Client Version:")
    });
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "create --name ouro-s5-clock-aliased-sdx shell .",
      ...denyPolicyCommands("ouro-s5-clock-aliased-sdx"),
      "exec -d -w . ouro-s5-clock-aliased-sdx python3 fixtures/trading-systems/clock.py --instance-id sandbox-aliased-sdx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-aliased-sdx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-aliased-sdx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-aliased-sdx cat /tmp/ouroboros-sandbox-aliased-sdx.heartbeat.json"
    ]);
  });

  it("supports OUROBOROS_SDX_BIN as a compatibility alias when OUROBOROS_SBX_BIN is unset", async () => {
    const commandLog = path.join(tmpDir, "sdx-env-alias-commands.log");
    const fakeAliasedSdx = path.join(tmpDir, "sdx");
    await writeFile(fakeAliasedSdx, fakeSbxScript(), "utf8");
    await chmod(fakeAliasedSdx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.OUROBOROS_SDX_BIN = fakeAliasedSdx;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-sdx-env-alias",
      sandbox_name: "ouro-s5-clock-sdx-env-alias",
      sandbox_placement_id: "sandbox-placement-sdx-env-alias",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("running");
    expect(start.command_evidence[0]?.command).toEqual([fakeAliasedSdx, "version"]);
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "create --name ouro-s5-clock-sdx-env-alias shell .",
      ...denyPolicyCommands("ouro-s5-clock-sdx-env-alias"),
      "exec -d -w . ouro-s5-clock-sdx-env-alias python3 fixtures/trading-systems/clock.py --instance-id sandbox-sdx-env-alias --interval-ms 1 --log-file /tmp/ouroboros-sandbox-sdx-env-alias.jsonl --heartbeat-file /tmp/ouroboros-sandbox-sdx-env-alias.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-sdx-env-alias cat /tmp/ouroboros-sandbox-sdx-env-alias.heartbeat.json"
    ]);
  });

  it("resolves repo-local relative sdx aliases from the workspace path", async () => {
    const commandLog = path.join(tmpDir, "relative-sdx-env-alias-commands.log");
    const scriptsDir = path.join(tmpDir, "scripts");
    const fakeAliasedSdx = path.join(scriptsDir, "sdx-docker-sandboxes");
    await mkdir(scriptsDir);
    await writeFile(fakeAliasedSdx, fakeSbxScript(), "utf8");
    await chmod(fakeAliasedSdx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.OUROBOROS_SDX_BIN = "./scripts/sdx-docker-sandboxes";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      workspacePath: tmpDir
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-relative-sdx-env-alias",
      sandbox_name: "ouro-s5-clock-relative-sdx-env-alias",
      sandbox_placement_id: "sandbox-placement-relative-sdx-env-alias",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("running");
    expect(start.command_evidence[0]?.command).toEqual([fakeAliasedSdx, "version"]);
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      `create --name ouro-s5-clock-relative-sdx-env-alias shell ${tmpDir}`,
      ...denyPolicyCommands("ouro-s5-clock-relative-sdx-env-alias"),
      `exec -d -w ${tmpDir} ouro-s5-clock-relative-sdx-env-alias python3 fixtures/trading-systems/clock.py --instance-id sandbox-relative-sdx-env-alias --interval-ms 1 --log-file /tmp/ouroboros-sandbox-relative-sdx-env-alias.jsonl --heartbeat-file /tmp/ouroboros-sandbox-relative-sdx-env-alias.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid`,
      "exec ouro-s5-clock-relative-sdx-env-alias cat /tmp/ouroboros-sandbox-relative-sdx-env-alias.heartbeat.json"
    ]);
  });

  it("rejects non-Docker-Sandboxes sdx binaries before creating a sandbox", async () => {
    const commandLog = path.join(tmpDir, "sdx-commands.log");
    const fakeSdx = path.join(tmpDir, "sdx");
    await writeFile(fakeSdx, fakeSdxScript(), "utf8");
    await chmod(fakeSdx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSdx,
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-sdx-rejected",
      sandbox_name: "ouro-s5-clock-sdx-rejected",
      sandbox_placement_id: "sandbox-placement-sdx-rejected",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });

    expect(start.instance.lifecycle_status).toBe("failed");
    expect(start.instance.started_at).toBeUndefined();
    expect(start.command_evidence).toHaveLength(1);
    expect(start.command_evidence[0]).toMatchObject({
      exit_code: 0,
      command: [fakeSdx, "version"],
      stdout: "sdx 2.0 Starkit Developer eXtension\n"
    });
    expect(await readFile(commandLog, "utf8")).toBe("version\n");
  });

  it("rejects non-Docker-Sandboxes sdx binaries before status, log, or stop commands", async () => {
    const validCommandLog = path.join(tmpDir, "valid-commands.log");
    const sdxCommandLog = path.join(tmpDir, "sdx-operation-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-valid");
    const fakeSdx = path.join(tmpDir, "sdx-operations");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await writeFile(fakeSdx, fakeSdxScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    await chmod(fakeSdx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = validCommandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-sdx-operations";

    const startAdapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: "."
    });
    const start = await startAdapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-sdx-operations",
      sandbox_name: "ouro-s5-clock-sdx-operations",
      sandbox_placement_id: "sandbox-placement-sdx-operations",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });
    expect(start.instance.lifecycle_status).toBe("running");

    process.env.SBX_FAKE_COMMAND_LOG = sdxCommandLog;
    const sdxAdapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSdx,
      workspacePath: "."
    });
    const status = await sdxAdapter.getArtifactInstanceStatus(start.instance);
    const logs = await sdxAdapter.getArtifactInstanceLogs(start.instance);
    const stop = await sdxAdapter.stopArtifactInstance(start.instance);

    expect(status.lifecycle_status).toBe("failed");
    expect(logs.lifecycle_status).toBe("failed");
    expect(stop.lifecycle_status).toBe("failed");
    expect(status.command_evidence?.[0]?.command).toEqual([fakeSdx, "version"]);
    expect(logs.command_evidence?.[0]?.command).toEqual([fakeSdx, "version"]);
    expect(stop.command_evidence?.[0]?.command).toEqual([fakeSdx, "version"]);
    expect((await readFile(sdxCommandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "version",
      "version"
    ]);
  });

  it("force-removes the Sandbox before releasing policy when sbx stop fails", async () => {
    const commandLog = path.join(tmpDir, "stop-failed-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-fail-stop");
    await writeFile(fakeSbx, fakeSbxStopFailureScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-stop-failed-sbx";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: "."
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-stop-failed-sbx",
      sandbox_name: "ouro-s5-clock-stop-failed",
      sandbox_placement_id: "sandbox-placement-stop-failed-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });
    const stop = await adapter.stopArtifactInstance(start.instance);

    expect(stop.lifecycle_status).toBe("removed");
    expect(stop.stopped_at).toBeUndefined();
    expect(stop.command_evidence?.map((evidence) => evidence.exit_code)).toEqual([
      0,
      0,
      43,
      0,
      0,
      0,
      ...CANDIDATE_NETWORK_DENY_PROBES.map(() => 1),
      0
    ]);
    expect(stop.command_evidence?.[2]?.stderr).toBe("stop runtime failed\n");
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "create --name ouro-s5-clock-stop-failed shell .",
      ...denyPolicyCommands("ouro-s5-clock-stop-failed"),
      "exec -d -w . ouro-s5-clock-stop-failed python3 fixtures/trading-systems/clock.py --instance-id sandbox-stop-failed-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-stop-failed-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-stop-failed-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-stop-failed cat /tmp/ouroboros-sandbox-stop-failed-sbx.heartbeat.json",
      "version",
      "exec ouro-s5-clock-stop-failed pkill -TERM -f fixtures/trading-systems/clock.py",
      "stop ouro-s5-clock-stop-failed",
      "rm --force ouro-s5-clock-stop-failed",
      ...terminalDenyPolicyCommands("ouro-s5-clock-stop-failed"),
      "policy log ouro-s5-clock-stop-failed --json --limit 100"
    ]);
  });

  it("retains the deny-policy lease when stop and force removal both fail", async () => {
    const commandLog = path.join(tmpDir, "stop-remove-failed-commands.log");
    const fakeSbx = path.join(tmpDir, "sbx-fail-stop-remove");
    const policyStatePath = path.join(tmpDir, "network-policy-leases");
    const sandboxName = "ouro-s5-clock-stop-remove-failed";
    await writeFile(fakeSbx, fakeSbxStopFailureScript(), "utf8");
    await chmod(fakeSbx, 0o755);
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-stop-remove-failed-sbx";
    process.env.SBX_FAKE_REMOVE_FAIL = "1";

    const adapter = new DockerSandboxesSbxSandboxAdapter({
      sbxPath: fakeSbx,
      workspacePath: ".",
      networkPolicyStatePath: policyStatePath
    });
    const start = await adapter.startArtifactInstance({
      artifact: clockArtifactFixture(),
      instance_id: "sandbox-stop-remove-failed-sbx",
      sandbox_name: sandboxName,
      sandbox_placement_id: "sandbox-placement-stop-remove-failed-sbx",
      created_at: "2026-05-10T00:00:00.000Z",
      interval_ms: 1
    });
    await mkdir(policyStatePath, { recursive: true });
    const leasePath = path.join(policyStatePath, `${sandboxName}.json`);
    await writeFile(leasePath, JSON.stringify({
      version: 2,
      sandbox_name: sandboxName,
      inherited_allowed_resources: [],
      owned_allow_rule_ids: ["owned-allow"],
      owned_deny_rule_ids: ["owned-deny"]
    }) + "\n", "utf8");

    const stop = await adapter.stopArtifactInstance(start.instance);

    expect(stop.lifecycle_status).toBe("stopping");
    expect(stop.stopped_at).toBeUndefined();
    expect(stop.removed_at).toBeUndefined();
    expect(stop.command_evidence?.map((evidence) => evidence.exit_code))
      .toEqual([0, 0, 43, 44]);
    await expect(readFile(leasePath, "utf8")).resolves.toContain(
      '"owned_deny_rule_ids":["owned-deny"]'
    );
    expect((await readFile(commandLog, "utf8")).trim().split("\n").slice(-2))
      .toEqual([
        `stop ${sandboxName}`,
        `rm --force ${sandboxName}`
      ]);

    delete process.env.SBX_FAKE_REMOVE_FAIL;
    const retry = await adapter.stopArtifactInstance(start.instance);

    expect(retry.lifecycle_status).toBe("removed");
    expect(retry.stopped_at).toBeUndefined();
    expect(retry.removed_at).toBeDefined();
    await expect(readFile(leasePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

function clockArtifactFixture(): SystemCodeRecord {
  const artifact = createFixtureRecords()
    .map((item) => item.record)
    .find((record): record is SystemCodeRecord => (
      record.record_kind === "system_code" &&
      record.system_code_id === FIXTURE_SYSTEM_CODE_ID
    ));
  if (!artifact) {
    throw new Error("clock artifact fixture missing");
  }
  return artifact;
}

function denyPolicyCommands(sandboxName: string): string[] {
  return [
    `policy ls ${sandboxName} --json --type network --decision allow`,
    ...CANDIDATE_NETWORK_DENY_PROBES.map((target) =>
      `policy check network --sandbox ${sandboxName} --json ${target}`
    )
  ];
}

function terminalDenyPolicyCommands(sandboxName: string): string[] {
  return [
    `policy ls ${sandboxName} --json --type network --decision allow`,
    `policy ls ${sandboxName} --json --type network --decision deny`,
    ...CANDIDATE_NETWORK_DENY_PROBES.map((target) =>
      `policy check network --sandbox ${sandboxName} --json ${target}`
    )
  ];
}

function fakeSbxScript(): string {
  return `#!/bin/sh
set -eu
if [ -n "\${SBX_EXPECT_HOME:-}" ] && [ "\${HOME:-}" != "$SBX_EXPECT_HOME" ]; then
  echo "unexpected HOME: \${HOME:-}" >&2
  exit 66
fi
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"
case "$1" in
  version)
    echo "Client Version:  v0.35.0 test"
    echo "Server Version:  v0.35.0 test"
    ;;
  create)
    echo "created $4"
    ;;
	  policy)
	    case "$2" in
	      ls)
	        decision=""
	        for argument in "$@"; do decision="$argument"; done
	        printf '{"rules":['
	        separator=""
	        if [ "$decision" = "allow" ] && [ -n "\${SBX_FAKE_INHERITED_ALLOW_JSON:-}" ]; then
	          printf '{"id":"inherited-allow","decision":"allow","resources":%s,"status":"active","scope":"global"}' "$SBX_FAKE_INHERITED_ALLOW_JSON"
	          separator=","
	        fi
	        if [ "$decision" = "allow" ] && [ -f "$SBX_FAKE_COMMAND_LOG.policy.allow" ]; then
	          resource="$(cat "$SBX_FAKE_COMMAND_LOG.policy.allow")"
	          printf '%s{"id":"owned-allow","decision":"allow","resources":["%s"],"status":"active","scope":"sandbox:%s","sandbox_id":"%s"}' "$separator" "$resource" "$3" "$3"
	        fi
	        if [ "$decision" = "deny" ] && [ -f "$SBX_FAKE_COMMAND_LOG.policy.deny" ]; then
	          resources="$(cat "$SBX_FAKE_COMMAND_LOG.policy.deny")"
	          json_resources="$(printf '%s' "$resources" | sed 's/,/","/g')"
	          printf '{"id":"owned-deny","decision":"deny","resources":["%s"],"status":"active","scope":"sandbox:%s","sandbox_id":"%s"}' "$json_resources" "$3" "$3"
	        fi
	        printf ']}\\n'
	        ;;
	      allow)
	        resource=""
	        for argument in "$@"; do resource="$argument"; done
	        printf '%s\\n' "$resource" > "$SBX_FAKE_COMMAND_LOG.policy.allow"
	        ;;
	      deny)
	        resources=""
	        for argument in "$@"; do resources="$argument"; done
	        printf '%s\\n' "$resources" > "$SBX_FAKE_COMMAND_LOG.policy.deny"
	        ;;
	      check)
	        target=""
	        for argument in "$@"; do target="$argument"; done
	        if [ -f "$SBX_FAKE_COMMAND_LOG.policy.deny" ] && printf '%s' "$(cat "$SBX_FAKE_COMMAND_LOG.policy.deny")" | tr ',' '\\n' | grep -qx '\\*\\*'; then
	          printf '{"decision":"deny"}\\n'
	          exit 1
	        fi
	        if [ -f "$SBX_FAKE_COMMAND_LOG.policy.allow" ] && [ "$(cat "$SBX_FAKE_COMMAND_LOG.policy.allow")" = "$target" ]; then
	          printf '{"decision":"allow"}\\n'
	          exit 0
	        fi
        printf '{"decision":"deny"}\\n'
        exit 1
        ;;
	      log)
	        printf '{"entries":[]}\\n'
	        ;;
	      rm)
	        rule_id=""
	        while [ "$#" -gt 0 ]; do
	          if [ "$1" = "--id" ]; then
	            rule_id="$2"
	            break
	          fi
	          shift
	        done
	        case "$rule_id" in
	          owned-allow) rm -f "$SBX_FAKE_COMMAND_LOG.policy.allow" ;;
	          owned-deny) rm -f "$SBX_FAKE_COMMAND_LOG.policy.deny" ;;
	          *) exit 2 ;;
	        esac
	        ;;
      *)
        echo "unexpected policy command: $*" >&2
        exit 2
        ;;
    esac
    ;;
	  exec)
	    if [ "$2" = "-d" ]; then
	      echo "detached $3"
	    elif [ "$3" = "cat" ]; then
	      cat_path="$4"
	      if [ "\${SBX_FAKE_FINITE_STOPPED:-}" = "1" ]; then
	        cat_file="$(basename "$cat_path")"
	        cat_id="\${cat_file#ouroboros-}"
	        cat_id="\${cat_id%.heartbeat.json}"
	        cat_id="\${cat_id%.jsonl}"
	        case "$cat_path" in
	          *.heartbeat.json)
	            printf '{"event":"runtime_stopped","instance_id":"%s","tick":2,"at":"2026-05-10T00:00:01.000Z"}\\n' "$cat_id"
	            ;;
	          *.jsonl)
	            printf '{"event":"order_request","event_id":"%s:order-request:0001","instance_id":"%s"}\\n' "$cat_id" "$cat_id"
	            printf '{"event":"runtime_stopped","instance_id":"%s","tick":2,"at":"2026-05-10T00:00:01.000Z"}\\n' "$cat_id"
	            ;;
	        esac
	        exit 0
	      fi
	      heartbeat_after="\${SBX_FAKE_HEARTBEAT_AFTER:-1}"
	      heartbeat_counter="\${SBX_FAKE_HEARTBEAT_COUNTER:-}"
	      heartbeat_attempt=1
      if [ -n "$heartbeat_counter" ]; then
        if [ -f "$heartbeat_counter" ]; then
          heartbeat_attempt=$(( $(cat "$heartbeat_counter") + 1 ))
        fi
        printf '%s\\n' "$heartbeat_attempt" > "$heartbeat_counter"
      fi
      if [ "$heartbeat_attempt" -lt "$heartbeat_after" ]; then
        echo "heartbeat not ready" >&2
        exit 1
      fi
      heartbeat_path="$4"
      heartbeat_file="$(basename "$heartbeat_path")"
      heartbeat_id="\${heartbeat_file#ouroboros-}"
      heartbeat_id="\${heartbeat_id%.heartbeat.json}"
      heartbeat_id="\${heartbeat_id%.jsonl}"
      printf '{"event":"runtime_heartbeat","instance_id":"%s","tick":1,"at":"2026-05-10T00:00:00.000Z"}\\n' "$heartbeat_id"
    else
      echo "exec $2"
    fi
    ;;
  stop)
    echo "stopped $2"
    ;;
  rm)
    echo "removed $3"
    ;;
  *)
    echo "unexpected $*" >&2
    exit 2
    ;;
esac
`;
}

function fakeSbxCreateFailureScript(): string {
  return `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"
if [ "$1" = "version" ]; then
  echo "Client Version:  v0.35.0 test"
  echo "Server Version:  v0.35.0 test"
  exit 0
fi
if [ "$1" = "create" ]; then
  echo "runtime unavailable" >&2
  exit 42
fi
if [ "$1" = "rm" ]; then
  exit 0
fi
echo "unexpected $*" >&2
exit 2
`;
}

function fakeSdxScript(): string {
  return `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"
if [ "$1" = "version" ]; then
  echo "sdx 2.0 Starkit Developer eXtension"
  exit 0
fi
echo "unexpected $*" >&2
exit 2
`;
}

function fakeSbxStopFailureScript(): string {
  return `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$SBX_FAKE_COMMAND_LOG"
case "$1" in
  version)
    echo "Client Version:  v0.35.0 test"
    echo "Server Version:  v0.35.0 test"
    ;;
  create)
    echo "created $4"
    ;;
  policy)
    case "$2" in
      ls)
        printf '{"rules":[]}\\n'
        ;;
      check)
        printf '{"decision":"deny"}\\n'
        exit 1
        ;;
      log)
        printf '{"entries":[]}\\n'
        ;;
      *)
        exit 2
        ;;
    esac
    ;;
  exec)
    if [ "$2" = "-d" ]; then
      echo "detached $3"
    elif [ "$3" = "cat" ]; then
      heartbeat_path="$4"
      heartbeat_file="$(basename "$heartbeat_path")"
      heartbeat_id="\${heartbeat_file#ouroboros-}"
      heartbeat_id="\${heartbeat_id%.heartbeat.json}"
      heartbeat_id="\${heartbeat_id%.jsonl}"
      printf '{"event":"runtime_heartbeat","instance_id":"%s","tick":1,"at":"2026-05-10T00:00:00.000Z"}\\n' "$heartbeat_id"
    else
      echo "exec $2"
    fi
    ;;
  stop)
    echo "stop runtime failed" >&2
    exit 43
    ;;
  rm)
    if [ "\${SBX_FAKE_REMOVE_FAIL:-}" = "1" ]; then
      echo "remove failed" >&2
      exit 44
    fi
    exit 0
    ;;
  *)
    echo "unexpected $*" >&2
    exit 2
    ;;
esac
`;
}
