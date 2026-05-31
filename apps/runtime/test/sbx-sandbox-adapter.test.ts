import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createFixtureRecords, FIXTURE_SYSTEM_CODE_ID } from "@ouroboros/local-store";
import type { SystemCodeRecord } from "@ouroboros/domain";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DockerSandboxesSbxSandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-sbx-adapter-"));
});

afterEach(async () => {
  delete process.env.SBX_FAKE_COMMAND_LOG;
  delete process.env.SBX_FAKE_INSTANCE_ID;
  delete process.env.SBX_EXPECT_HOME;
  delete process.env.OUROBOROS_SDX_BIN;
  delete process.env.OUROBOROS_SBX_HOME;
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Docker Sandboxes sbx runtime adapter", () => {
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
    expect(start.command_evidence).toHaveLength(4);
    expect(start.command_evidence.map((evidence) => evidence.command.slice(1, 3))).toEqual([
      ["version"],
      ["create", "--name"],
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
    expect(stop.lifecycle_status).toBe("stopped");
    expect(stop.command_evidence?.map((evidence) => evidence.command[1])).toEqual([
      "version",
      "exec",
      "stop"
    ]);

    const commands = (await readFile(commandLog, "utf8")).trim().split("\n");
    expect(commands).toEqual([
      "version",
      "create --name ouro-s5-clock-fake shell .",
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
      "stop ouro-s5-clock-fake"
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
      "exec -d -w . ouro-s5-clock-home python3 fixtures/trading-systems/clock.py --instance-id sandbox-home-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-home-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-home-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-home cat /tmp/ouroboros-sandbox-home-sbx.heartbeat.json"
    ]);
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

  it("does not report stopped when sbx stop fails", async () => {
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

    expect(stop.lifecycle_status).toBe("failed");
    expect(stop.stopped_at).toBeUndefined();
    expect(stop.command_evidence?.map((evidence) => evidence.exit_code)).toEqual([0, 0, 43]);
    expect(stop.command_evidence?.[2]?.stderr).toBe("stop runtime failed\n");
    expect((await readFile(commandLog, "utf8")).trim().split("\n")).toEqual([
      "version",
      "create --name ouro-s5-clock-stop-failed shell .",
      "exec -d -w . ouro-s5-clock-stop-failed python3 fixtures/trading-systems/clock.py --instance-id sandbox-stop-failed-sbx --interval-ms 1 --log-file /tmp/ouroboros-sandbox-stop-failed-sbx.jsonl --heartbeat-file /tmp/ouroboros-sandbox-stop-failed-sbx.heartbeat.json --start-at 2026-05-10T00:00:00.000Z --paper-order-request valid",
      "exec ouro-s5-clock-stop-failed cat /tmp/ouroboros-sandbox-stop-failed-sbx.heartbeat.json",
      "version",
      "exec ouro-s5-clock-stop-failed pkill -TERM -f fixtures/trading-systems/clock.py",
      "stop ouro-s5-clock-stop-failed"
    ]);
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
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    ;;
  create)
    echo "created $4"
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
    echo "stopped $2"
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
  echo "Client Version:  v0.28.3 test"
  echo "Server Version:  v0.28.3 test"
  exit 0
fi
if [ "$1" = "create" ]; then
  echo "runtime unavailable" >&2
  exit 42
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
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    ;;
  create)
    echo "created $4"
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
  *)
    echo "unexpected $*" >&2
    exit 2
    ;;
esac
`;
}
