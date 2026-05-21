import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStore } from "@ouroboros/local-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";
import {
  DeterministicSandboxAdapter,
  type SandboxAdapter
} from "../src/sandboxes/sandbox-adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-sandboxes-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("sandbox API", () => {
  it("proves two opaque clock artifact instances have distinct lifecycle, logs, and persisted projections", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const first = await startClockSandbox(server, {
      idempotency_key: "sandbox-clock-a",
      sandbox_id: "sandbox-clock-a",
      sandbox_name: "ouro-s5-clock-a",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const second = await startClockSandbox(server, {
      idempotency_key: "sandbox-clock-b",
      sandbox_id: "sandbox-clock-b",
      sandbox_name: "ouro-s5-clock-b",
      created_at: "2026-05-10T00:00:10.000Z"
    });

    expect(first.sandbox.lifecycle_status).toBe("stopped");
    expect(second.sandbox.lifecycle_status).toBe("stopped");
    expect(first.sandbox.sandbox_id).not.toBe(second.sandbox.sandbox_id);
    expect(first.sandbox.sandbox_name).toBe("ouro-s5-clock-a");
    expect(second.sandbox.sandbox_name).toBe("ouro-s5-clock-b");
    expect(first.sandbox.sandbox_placement_ref.id).not.toBe(
      second.sandbox.sandbox_placement_ref.id
    );
    expect(first.sandbox.log_refs).toHaveLength(1);
    expect(second.sandbox.log_refs).toHaveLength(1);
    expect(first.sandbox.heartbeat_refs).toHaveLength(2);
    expect(second.sandbox.heartbeat_refs).toHaveLength(2);
    expect(first.sandbox.logs[0]?.lines.join("\n")).toContain("sandbox-clock-a");
    expect(second.sandbox.logs[0]?.lines.join("\n")).toContain("sandbox-clock-b");

    const firstStatus = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-clock-a"
    });
    expect(firstStatus.statusCode).toBe(200);
    expect(firstStatus.json().lifecycle_status).toBe("stopped");
    expect(firstStatus.json().sandbox_name).toBe("ouro-s5-clock-a");

    const firstLogs = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-clock-a/logs"
    });
    expect(firstLogs.statusCode).toBe(200);
    expect(firstLogs.json().sandbox.sandbox_id).toBe("sandbox-clock-a");
    expect(firstLogs.json().logs[0].lines.join("\n")).toContain("sandbox-clock-a");
    expect(firstLogs.json().heartbeats).toHaveLength(2);

    const list = await server.inject({
      method: "GET",
      url: "/api/sandboxes"
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().sandboxes.map((sandbox: { sandbox_id: string }) => sandbox.sandbox_id)).toEqual([
      "sandbox-clock-a",
      "sandbox-clock-b"
    ]);

    const firstStop = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-clock-a/stop"
    });
    expect(firstStop.statusCode).toBe(200);
    expect(firstStop.json().sandbox.lifecycle_status).toBe("stopped");

    const firstStopAgain = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-clock-a/stop"
    });
    expect(firstStopAgain.statusCode).toBe(200);
    expect(firstStopAgain.json().sandbox.lifecycle_status).toBe("stopped");

    const secondStop = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-clock-b/stop"
    });
    expect(secondStop.statusCode).toBe(200);
    expect(secondStop.json().sandbox.lifecycle_status).toBe("stopped");

    const rebuiltStore = new LocalStore(tmpDir);
    await rebuiltStore.rebuildProjections();
    const persistedFirst = await rebuiltStore.getSandbox("sandbox-clock-a");
    const persistedSecond = await rebuiltStore.getSandbox("sandbox-clock-b");
    expect(persistedFirst?.lifecycle_status).toBe("stopped");
    expect(persistedSecond?.lifecycle_status).toBe("stopped");
    expect(persistedFirst?.sandbox_name).toBe("ouro-s5-clock-a");
    expect(persistedSecond?.sandbox_name).toBe("ouro-s5-clock-b");
    expect(persistedFirst?.log_refs.length).toBeGreaterThanOrEqual(1);
    expect(persistedSecond?.log_refs.length).toBeGreaterThanOrEqual(1);
    expect(persistedFirst?.sandbox_placement_ref.id).not.toBe(persistedSecond?.sandbox_placement_ref.id);
  });

  it("executes fixture SystemCode through the deterministic Sandbox boundary", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const started = await startClockSandbox(server, {
      idempotency_key: "sandbox-system-code-execution",
      sandbox_id: "sandbox-system-code-execution",
      sandbox_name: "ouro-system-code-execution",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 1
    });

    const logPayloads = started.sandbox.logs[0].lines.map((line: string) => JSON.parse(line));
    expect(logPayloads.map((payload: { event: string }) => payload.event)).toEqual([
      "order_request",
      "runtime_heartbeat",
      "runtime_heartbeat",
      "runtime_stopped"
    ]);
    expect(logPayloads[0]).toMatchObject({
      event: "order_request",
      instance_id: "sandbox-system-code-execution",
      symbol: "BTCUSDT",
      quantity: "0.001",
      at: "2026-05-21T00:00:00.000Z"
    });
    expect(started.sandbox.command_evidence).toHaveLength(1);
    expect(started.sandbox.command_evidence[0]).toMatchObject({
      exit_code: 0,
      command: expect.arrayContaining([
        "python3",
        "fixtures/trading-systems/clock.py",
        "--instance-id",
        "sandbox-system-code-execution"
      ])
    });
    expect(started.sandbox.command_evidence[0].stdout).toContain("\"event\": \"order_request\"");
    expect(started.sandbox.command_evidence[0].stdout).not.toMatch(
      /secret|password|token|api[-_]?key|credential/i
    );
  });

  it("rejects non-fixture SystemCode in the deterministic Sandbox boundary", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixtureSystemCode = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!fixtureSystemCode || fixtureSystemCode.artifact_kind !== "python_file") {
      throw new Error("expected fixture SystemCode");
    }
    await store.recordSystemCode({
      ...fixtureSystemCode,
      system_code_id: "system-code-non-fixture-network-001",
      artifact_path: "fixtures/trading-systems/clock.py",
      artifact_digest: "sha256:non-fixture-network-artifact",
      entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
      created_at: "2026-05-21T00:00:00.000Z"
    });
    const server = await buildServer({ store });

    const response = await server.inject({
      method: "POST",
      url: "/api/sandboxes",
      payload: {
        idempotency_key: "sandbox-reject-non-fixture",
        sandbox_id: "sandbox-reject-non-fixture",
        sandbox_name: "ouro-reject-non-fixture",
        system_code_id: "system-code-non-fixture-network-001",
        created_at: "2026-05-21T00:00:00.000Z"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe("failed");
    expect(response.json().sandbox.lifecycle_status).toBe("failed");
    expect(response.json().sandbox.logs).toHaveLength(0);
    expect(response.json().sandbox.command_evidence[0]).toMatchObject({
      exit_code: 2,
      command: [
        "deterministic_test",
        "reject-non-fixture-system-code",
        "system-code-non-fixture-network-001"
      ]
    });
    expect(response.json().sandbox.command_evidence[0].stderr).toContain(
      "only executes fixture SystemCode"
    );
  });

  it("rejects raw secret material in sandbox requests", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await server.inject({
      method: "POST",
      url: "/api/sandboxes",
      payload: {
        idempotency_key: "sandbox-with-secret",
        raw_secret_values: {
          exchange_token: "do-not-store"
        }
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "sandbox_request_failed",
      reason: "raw_secret_material_rejected",
      detail: "$.raw_secret_values"
    });
  });

  it("keeps the real sbx adapter behind an explicit environment gate", async () => {
    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    const previousAdapter = process.env.OUROBOROS_SANDBOX_ADAPTER;
    delete process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    delete process.env.OUROBOROS_SANDBOX_ADAPTER;
    try {
      const server = await buildServer({ store: new LocalStore(tmpDir) });
      const response = await server.inject({
        method: "POST",
        url: "/api/sandboxes",
        payload: {
          idempotency_key: "sandbox-sbx-disabled",
          adapter_kind: "docker_sandboxes_sbx"
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        error: "sandbox_request_failed",
        reason: "docker_sandboxes_sbx_runtime_disabled"
      });
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_SANDBOX", previousEnable);
      restoreEnv("OUROBOROS_SANDBOX_ADAPTER", previousAdapter);
    }
  });

  it("persists failed lifecycle without creating a sandbox when the real adapter points at sdx", async () => {
    const fakeSdx = path.join(tmpDir, "sdx");
    const commandLog = path.join(tmpDir, "sdx-api-calls.log");
    await writeFile(fakeSdx, fakeSdxScript(), "utf8");
    await chmod(fakeSdx, 0o755);

    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    const previousSbxBin = process.env.OUROBOROS_SBX_BIN;
    const previousCommandLog = process.env.SBX_FAKE_COMMAND_LOG;
    process.env.OUROBOROS_ENABLE_SBX_SANDBOX = "1";
    process.env.OUROBOROS_SBX_BIN = fakeSdx;
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    try {
      const server = await buildServer({ store: new LocalStore(tmpDir) });
      const response = await server.inject({
        method: "POST",
        url: "/api/sandboxes",
        payload: {
          idempotency_key: "sandbox-sdx-api-rejected",
          adapter_kind: "docker_sandboxes_sbx",
          sandbox_id: "sandbox-sdx-api-rejected",
          sandbox_name: "ouro-s5-clock-sdx-api-rejected",
          trading_run_id: "fixture-trading-run-001"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().status).toBe("failed");
      expect(response.json().sandbox.lifecycle_status).toBe("failed");
      expect(response.json().sandbox.command_evidence).toHaveLength(1);
      expect(response.json().sandbox.command_evidence[0]).toMatchObject({
        command: [fakeSdx, "version"],
        stdout: "sdx 2.0 Starkit Developer eXtension\n"
      });
      expect(await readFile(commandLog, "utf8")).toBe("version\n");
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_SANDBOX", previousEnable);
      restoreEnv("OUROBOROS_SBX_BIN", previousSbxBin);
      restoreEnv("SBX_FAKE_COMMAND_LOG", previousCommandLog);
    }
  });

  it("preserves distinct command evidence for repeated real-adapter status and log reads", async () => {
    const fakeSbx = path.join(tmpDir, "sbx");
    const commandLog = path.join(tmpDir, "sbx-api-calls.log");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);

    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    const previousSbxBin = process.env.OUROBOROS_SBX_BIN;
    const previousCommandLog = process.env.SBX_FAKE_COMMAND_LOG;
    const previousInstanceId = process.env.SBX_FAKE_INSTANCE_ID;
    process.env.OUROBOROS_ENABLE_SBX_SANDBOX = "1";
    process.env.OUROBOROS_SBX_BIN = fakeSbx;
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-real-adapter-evidence";
    try {
      const store = new LocalStore(tmpDir);
      const server = await buildServer({ store });
      const start = await server.inject({
        method: "POST",
        url: "/api/sandboxes",
        payload: {
          idempotency_key: "sandbox-real-adapter-evidence",
          adapter_kind: "docker_sandboxes_sbx",
          sandbox_id: "sandbox-real-adapter-evidence",
          sandbox_name: "ouro-s5-clock-real-adapter-evidence",
          trading_run_id: "fixture-trading-run-001",
          interval_ms: 1
        }
      });
      expect(start.statusCode).toBe(201);
      expect(start.json().sandbox.lifecycle_status).toBe("running");

      for (let index = 0; index < 2; index += 1) {
        const status = await server.inject({
          method: "GET",
          url: "/api/sandboxes/sandbox-real-adapter-evidence"
        });
        expect(status.statusCode).toBe(200);

        const logs = await server.inject({
          method: "GET",
          url: "/api/sandboxes/sandbox-real-adapter-evidence/logs"
        });
        expect(logs.statusCode).toBe(200);
      }

      const persisted = await store.getSandbox("sandbox-real-adapter-evidence");
      expect(persisted?.command_evidence_refs).toHaveLength(11);
      const commandEvidenceIds = persisted?.command_evidence.map((evidence) => evidence.command_evidence_ref.id) ?? [];
      expect(new Set(commandEvidenceIds).size).toBe(commandEvidenceIds.length);
      expect(persisted?.command_evidence.filter((evidence) => evidence.command[1] === "version")).toHaveLength(5);
      expect(persisted?.command_evidence.filter((evidence) => (
        evidence.command[1] === "exec" &&
        evidence.command[3] === "cat" &&
        evidence.command[4]?.endsWith(".heartbeat.json")
      ))).toHaveLength(2);
      expect(persisted?.command_evidence.filter((evidence) => (
        evidence.command[1] === "exec" &&
        evidence.command[3] === "cat" &&
        evidence.command[4]?.endsWith(".jsonl")
      ))).toHaveLength(2);
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_SANDBOX", previousEnable);
      restoreEnv("OUROBOROS_SBX_BIN", previousSbxBin);
      restoreEnv("SBX_FAKE_COMMAND_LOG", previousCommandLog);
      restoreEnv("SBX_FAKE_INSTANCE_ID", previousInstanceId);
    }
  });

  it("persists failed lifecycle when a sandbox adapter cannot stop an instance", async () => {
    const baseAdapter = new DeterministicSandboxAdapter();
    const failingStopAdapter: SandboxAdapter = {
      kind: "deterministic_test",
      startArtifactInstance: async (input) => {
        const started = await baseAdapter.startArtifactInstance(input);
        return {
          ...started,
          instance: {
            ...started.instance,
            lifecycle_status: "running",
            stopped_at: undefined
          }
        };
      },
      getArtifactInstanceStatus: () => baseAdapter.getArtifactInstanceStatus(),
      getArtifactInstanceLogs: () => baseAdapter.getArtifactInstanceLogs(),
      stopArtifactInstance: async () => ({
        lifecycle_status: "failed"
      })
    };
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      sandboxAdapters: {
        deterministic_test: failingStopAdapter
      }
    });

    await startClockSandbox(server, {
      idempotency_key: "sandbox-stop-fails",
      sandbox_id: "sandbox-stop-fails",
      sandbox_name: "ouro-s5-clock-stop-fails",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const stop = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-stop-fails/stop"
    });

    expect(stop.statusCode).toBe(200);
    expect(stop.json().status).toBe("failed");
    expect(stop.json().sandbox.lifecycle_status).toBe("failed");
    expect(stop.json().sandbox.stopped_at).toBeUndefined();

    const rebuiltStore = new LocalStore(tmpDir);
    await rebuiltStore.rebuildProjections();
    const persisted = await rebuiltStore.getSandbox("sandbox-stop-fails");
    expect(persisted?.lifecycle_status).toBe("failed");
    expect(persisted?.stopped_at).toBeUndefined();
  });

  it("does not refresh stopped sandboxes through adapter status or log reads", async () => {
    const baseAdapter = new DeterministicSandboxAdapter();
    let statusCallCount = 0;
    let logCallCount = 0;
    const countingAdapter: SandboxAdapter = {
      kind: "deterministic_test",
      startArtifactInstance: (input) => baseAdapter.startArtifactInstance(input),
      getArtifactInstanceStatus: async () => {
        statusCallCount += 1;
        return await baseAdapter.getArtifactInstanceStatus();
      },
      getArtifactInstanceLogs: async () => {
        logCallCount += 1;
        return await baseAdapter.getArtifactInstanceLogs();
      },
      stopArtifactInstance: (instance) => baseAdapter.stopArtifactInstance(instance)
    };
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      sandboxAdapters: {
        deterministic_test: countingAdapter
      }
    });

    await startClockSandbox(server, {
      idempotency_key: "sandbox-stopped-terminal",
      sandbox_id: "sandbox-stopped-terminal",
      sandbox_name: "ouro-s5-clock-stopped-terminal",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const stop = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-stopped-terminal/stop"
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().sandbox.lifecycle_status).toBe("stopped");

    const status = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-stopped-terminal"
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().lifecycle_status).toBe("stopped");
    expect(statusCallCount).toBe(0);

    const logs = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-stopped-terminal/logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().sandbox.lifecycle_status).toBe("stopped");
    expect(logCallCount).toBe(0);
  });

  it("does not report started when a sandbox adapter returns failed start lifecycle", async () => {
    const baseAdapter = new DeterministicSandboxAdapter();
    let statusCallCount = 0;
    let stopCallCount = 0;
    let logCallCount = 0;
    const failingStartAdapter: SandboxAdapter = {
      kind: "deterministic_test",
      startArtifactInstance: async (input) => {
        const result = await baseAdapter.startArtifactInstance(input);
        return {
          ...result,
          instance: {
            ...result.instance,
            lifecycle_status: "failed",
            started_at: undefined
          }
        };
      },
      getArtifactInstanceStatus: async () => {
        statusCallCount += 1;
        return await baseAdapter.getArtifactInstanceStatus();
      },
      getArtifactInstanceLogs: async () => {
        logCallCount += 1;
        return await baseAdapter.getArtifactInstanceLogs();
      },
      stopArtifactInstance: async (instance) => {
        stopCallCount += 1;
        return await baseAdapter.stopArtifactInstance(instance);
      }
    };
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      sandboxAdapters: {
        deterministic_test: failingStartAdapter
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/sandboxes",
      payload: {
        idempotency_key: "sandbox-start-fails",
        sandbox_id: "sandbox-start-fails",
        sandbox_name: "ouro-s5-clock-start-fails",
        trading_run_id: "fixture-trading-run-001"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe("failed");
    expect(response.json().sandbox.lifecycle_status).toBe("failed");
    expect(response.json().sandbox.started_at).toBeUndefined();

    const status = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-start-fails"
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().lifecycle_status).toBe("failed");
    expect(statusCallCount).toBe(0);

    const stop = await server.inject({
      method: "POST",
      url: "/api/sandboxes/sandbox-start-fails/stop"
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().status).toBe("failed");
    expect(stop.json().sandbox.lifecycle_status).toBe("failed");
    expect(stopCallCount).toBe(0);

    const logs = await server.inject({
      method: "GET",
      url: "/api/sandboxes/sandbox-start-fails/logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().sandbox.lifecycle_status).toBe("failed");
    expect(logCallCount).toBe(0);
  });
});

async function startClockSandbox(
  server: Awaited<ReturnType<typeof buildServer>>,
  input: {
    idempotency_key: string;
    sandbox_id: string;
    sandbox_name: string;
    created_at: string;
    interval_ms?: number;
  }
) {
  const response = await server.inject({
    method: "POST",
    url: "/api/sandboxes",
    payload: {
      ...input,
      trading_run_id: "fixture-trading-run-001",
      test_ticks: 2,
      interval_ms: input.interval_ms ?? 1
    }
  });
  expect(response.statusCode).toBe(201);
  return response.json();
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
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

function fakeSbxScript(): string {
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
      printf '{"event":"runtime_heartbeat","instance_id":"%s","tick":1,"at":"2026-05-10T00:00:00.000Z"}\\n' "$SBX_FAKE_INSTANCE_ID"
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
