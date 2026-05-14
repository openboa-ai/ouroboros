import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStore } from "@ouroboros/local-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";
import {
  DeterministicSandboxRuntimeAdapter,
  type SandboxRuntimeAdapter
} from "../src/runtime-instances/sandbox-runtime-adapter";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-instances-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime instance API", () => {
  it("proves two opaque clock artifact instances have distinct lifecycle, logs, and persisted projections", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const first = await startClockInstance(server, {
      idempotency_key: "runtime-instance-clock-a",
      instance_id: "sandbox-runtime-instance-clock-a",
      sandbox_name: "ouro-s5-clock-a",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const second = await startClockInstance(server, {
      idempotency_key: "runtime-instance-clock-b",
      instance_id: "sandbox-runtime-instance-clock-b",
      sandbox_name: "ouro-s5-clock-b",
      created_at: "2026-05-10T00:00:10.000Z"
    });

    expect(first.runtime_instance.lifecycle_status).toBe("running");
    expect(second.runtime_instance.lifecycle_status).toBe("running");
    expect(first.runtime_instance.instance_id).not.toBe(second.runtime_instance.instance_id);
    expect(first.runtime_instance.sandbox_name).toBe("ouro-s5-clock-a");
    expect(second.runtime_instance.sandbox_name).toBe("ouro-s5-clock-b");
    expect(first.runtime_instance.runtime_placement_ref.id).not.toBe(
      second.runtime_instance.runtime_placement_ref.id
    );
    expect(first.runtime_instance.log_refs).toHaveLength(1);
    expect(second.runtime_instance.log_refs).toHaveLength(1);
    expect(first.runtime_instance.heartbeat_refs).toHaveLength(2);
    expect(second.runtime_instance.heartbeat_refs).toHaveLength(2);
    expect(first.runtime_instance.logs[0]?.lines.join("\n")).toContain("sandbox-runtime-instance-clock-a");
    expect(second.runtime_instance.logs[0]?.lines.join("\n")).toContain("sandbox-runtime-instance-clock-b");

    const firstStatus = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-clock-a"
    });
    expect(firstStatus.statusCode).toBe(200);
    expect(firstStatus.json().lifecycle_status).toBe("running");
    expect(firstStatus.json().sandbox_name).toBe("ouro-s5-clock-a");

    const firstLogs = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-clock-a/logs"
    });
    expect(firstLogs.statusCode).toBe(200);
    expect(firstLogs.json().runtime_instance.instance_id).toBe("sandbox-runtime-instance-clock-a");
    expect(firstLogs.json().logs[0].lines.join("\n")).toContain("sandbox-runtime-instance-clock-a");
    expect(firstLogs.json().heartbeats).toHaveLength(2);

    const list = await server.inject({
      method: "GET",
      url: "/api/runtime-instances"
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().runtime_instances.map((instance: { instance_id: string }) => instance.instance_id)).toEqual([
      "sandbox-runtime-instance-clock-a",
      "sandbox-runtime-instance-clock-b"
    ]);

    const firstStop = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-clock-a/stop"
    });
    expect(firstStop.statusCode).toBe(200);
    expect(firstStop.json().runtime_instance.lifecycle_status).toBe("stopped");

    const firstStopAgain = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-clock-a/stop"
    });
    expect(firstStopAgain.statusCode).toBe(200);
    expect(firstStopAgain.json().runtime_instance.lifecycle_status).toBe("stopped");

    const secondStop = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-clock-b/stop"
    });
    expect(secondStop.statusCode).toBe(200);
    expect(secondStop.json().runtime_instance.lifecycle_status).toBe("stopped");

    const rebuiltStore = new LocalStore(tmpDir);
    await rebuiltStore.rebuildProjections();
    const persistedFirst = await rebuiltStore.getRuntimeInstance("sandbox-runtime-instance-clock-a");
    const persistedSecond = await rebuiltStore.getRuntimeInstance("sandbox-runtime-instance-clock-b");
    expect(persistedFirst?.lifecycle_status).toBe("stopped");
    expect(persistedSecond?.lifecycle_status).toBe("stopped");
    expect(persistedFirst?.sandbox_name).toBe("ouro-s5-clock-a");
    expect(persistedSecond?.sandbox_name).toBe("ouro-s5-clock-b");
    expect(persistedFirst?.log_refs.length).toBeGreaterThanOrEqual(2);
    expect(persistedSecond?.log_refs.length).toBeGreaterThanOrEqual(2);
    expect(persistedFirst?.runtime_placement_ref.id).not.toBe(persistedSecond?.runtime_placement_ref.id);
  });

  it("rejects raw secret material in runtime instance requests", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await server.inject({
      method: "POST",
      url: "/api/runtime-instances",
      payload: {
        idempotency_key: "runtime-instance-with-secret",
        raw_secret_values: {
          exchange_token: "do-not-store"
        }
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "runtime_instance_request_failed",
      reason: "raw_secret_material_rejected",
      detail: "$.raw_secret_values"
    });
  });

  it("keeps the real sbx adapter behind an explicit environment gate", async () => {
    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_RUNTIME;
    const previousAdapter = process.env.OUROBOROS_RUNTIME_INSTANCE_ADAPTER;
    delete process.env.OUROBOROS_ENABLE_SBX_RUNTIME;
    delete process.env.OUROBOROS_RUNTIME_INSTANCE_ADAPTER;
    try {
      const server = await buildServer({ store: new LocalStore(tmpDir) });
      const response = await server.inject({
        method: "POST",
        url: "/api/runtime-instances",
        payload: {
          idempotency_key: "runtime-instance-sbx-disabled",
          adapter_kind: "docker_sandboxes_sbx"
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        error: "runtime_instance_request_failed",
        reason: "docker_sandboxes_sbx_runtime_disabled"
      });
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_RUNTIME", previousEnable);
      restoreEnv("OUROBOROS_RUNTIME_INSTANCE_ADAPTER", previousAdapter);
    }
  });

  it("persists failed lifecycle without creating a sandbox when the real adapter points at sdx", async () => {
    const fakeSdx = path.join(tmpDir, "sdx");
    const commandLog = path.join(tmpDir, "sdx-api-calls.log");
    await writeFile(fakeSdx, fakeSdxScript(), "utf8");
    await chmod(fakeSdx, 0o755);

    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_RUNTIME;
    const previousSbxBin = process.env.OUROBOROS_SBX_BIN;
    const previousCommandLog = process.env.SBX_FAKE_COMMAND_LOG;
    process.env.OUROBOROS_ENABLE_SBX_RUNTIME = "1";
    process.env.OUROBOROS_SBX_BIN = fakeSdx;
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    try {
      const server = await buildServer({ store: new LocalStore(tmpDir) });
      const response = await server.inject({
        method: "POST",
        url: "/api/runtime-instances",
        payload: {
          idempotency_key: "runtime-instance-sdx-api-rejected",
          adapter_kind: "docker_sandboxes_sbx",
          instance_id: "sandbox-runtime-instance-sdx-api-rejected",
          sandbox_name: "ouro-s5-clock-sdx-api-rejected",
          runtime_id: "fixture-trading-system-runtime-001"
        }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().status).toBe("failed");
      expect(response.json().runtime_instance.lifecycle_status).toBe("failed");
      expect(response.json().runtime_instance.command_evidence).toHaveLength(1);
      expect(response.json().runtime_instance.command_evidence[0]).toMatchObject({
        command: [fakeSdx, "version"],
        stdout: "sdx 2.0 Starkit Developer eXtension\n"
      });
      expect(await readFile(commandLog, "utf8")).toBe("version\n");
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_RUNTIME", previousEnable);
      restoreEnv("OUROBOROS_SBX_BIN", previousSbxBin);
      restoreEnv("SBX_FAKE_COMMAND_LOG", previousCommandLog);
    }
  });

  it("preserves distinct command evidence for repeated real-adapter status and log reads", async () => {
    const fakeSbx = path.join(tmpDir, "sbx");
    const commandLog = path.join(tmpDir, "sbx-api-calls.log");
    await writeFile(fakeSbx, fakeSbxScript(), "utf8");
    await chmod(fakeSbx, 0o755);

    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_RUNTIME;
    const previousSbxBin = process.env.OUROBOROS_SBX_BIN;
    const previousCommandLog = process.env.SBX_FAKE_COMMAND_LOG;
    const previousInstanceId = process.env.SBX_FAKE_INSTANCE_ID;
    process.env.OUROBOROS_ENABLE_SBX_RUNTIME = "1";
    process.env.OUROBOROS_SBX_BIN = fakeSbx;
    process.env.SBX_FAKE_COMMAND_LOG = commandLog;
    process.env.SBX_FAKE_INSTANCE_ID = "sandbox-runtime-instance-real-adapter-evidence";
    try {
      const store = new LocalStore(tmpDir);
      const server = await buildServer({ store });
      const start = await server.inject({
        method: "POST",
        url: "/api/runtime-instances",
        payload: {
          idempotency_key: "runtime-instance-real-adapter-evidence",
          adapter_kind: "docker_sandboxes_sbx",
          instance_id: "sandbox-runtime-instance-real-adapter-evidence",
          sandbox_name: "ouro-s5-clock-real-adapter-evidence",
          runtime_id: "fixture-trading-system-runtime-001",
          interval_ms: 1
        }
      });
      expect(start.statusCode).toBe(201);
      expect(start.json().runtime_instance.lifecycle_status).toBe("running");

      for (let index = 0; index < 2; index += 1) {
        const status = await server.inject({
          method: "GET",
          url: "/api/runtime-instances/sandbox-runtime-instance-real-adapter-evidence"
        });
        expect(status.statusCode).toBe(200);

        const logs = await server.inject({
          method: "GET",
          url: "/api/runtime-instances/sandbox-runtime-instance-real-adapter-evidence/logs"
        });
        expect(logs.statusCode).toBe(200);
      }

      const persisted = await store.getRuntimeInstance("sandbox-runtime-instance-real-adapter-evidence");
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
      restoreEnv("OUROBOROS_ENABLE_SBX_RUNTIME", previousEnable);
      restoreEnv("OUROBOROS_SBX_BIN", previousSbxBin);
      restoreEnv("SBX_FAKE_COMMAND_LOG", previousCommandLog);
      restoreEnv("SBX_FAKE_INSTANCE_ID", previousInstanceId);
    }
  });

  it("persists failed lifecycle when a runtime adapter cannot stop an instance", async () => {
    const baseAdapter = new DeterministicSandboxRuntimeAdapter();
    const failingStopAdapter: SandboxRuntimeAdapter = {
      kind: "deterministic_test",
      startArtifactInstance: (input) => baseAdapter.startArtifactInstance(input),
      getArtifactInstanceStatus: () => baseAdapter.getArtifactInstanceStatus(),
      getArtifactInstanceLogs: () => baseAdapter.getArtifactInstanceLogs(),
      stopArtifactInstance: async () => ({
        lifecycle_status: "failed"
      })
    };
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      runtimeInstanceAdapters: {
        deterministic_test: failingStopAdapter
      }
    });

    await startClockInstance(server, {
      idempotency_key: "runtime-instance-stop-fails",
      instance_id: "sandbox-runtime-instance-stop-fails",
      sandbox_name: "ouro-s5-clock-stop-fails",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const stop = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-stop-fails/stop"
    });

    expect(stop.statusCode).toBe(200);
    expect(stop.json().status).toBe("failed");
    expect(stop.json().runtime_instance.lifecycle_status).toBe("failed");
    expect(stop.json().runtime_instance.stopped_at).toBeUndefined();

    const rebuiltStore = new LocalStore(tmpDir);
    await rebuiltStore.rebuildProjections();
    const persisted = await rebuiltStore.getRuntimeInstance("sandbox-runtime-instance-stop-fails");
    expect(persisted?.lifecycle_status).toBe("failed");
    expect(persisted?.stopped_at).toBeUndefined();
  });

  it("does not refresh stopped runtime instances through adapter status or log reads", async () => {
    const baseAdapter = new DeterministicSandboxRuntimeAdapter();
    let statusCallCount = 0;
    let logCallCount = 0;
    const countingAdapter: SandboxRuntimeAdapter = {
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
      runtimeInstanceAdapters: {
        deterministic_test: countingAdapter
      }
    });

    await startClockInstance(server, {
      idempotency_key: "runtime-instance-stopped-terminal",
      instance_id: "sandbox-runtime-instance-stopped-terminal",
      sandbox_name: "ouro-s5-clock-stopped-terminal",
      created_at: "2026-05-10T00:00:00.000Z"
    });
    const stop = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-stopped-terminal/stop"
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().runtime_instance.lifecycle_status).toBe("stopped");

    const status = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-stopped-terminal"
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().lifecycle_status).toBe("stopped");
    expect(statusCallCount).toBe(0);

    const logs = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-stopped-terminal/logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().runtime_instance.lifecycle_status).toBe("stopped");
    expect(logCallCount).toBe(0);
  });

  it("does not report started when a runtime adapter returns failed start lifecycle", async () => {
    const baseAdapter = new DeterministicSandboxRuntimeAdapter();
    let statusCallCount = 0;
    let stopCallCount = 0;
    let logCallCount = 0;
    const failingStartAdapter: SandboxRuntimeAdapter = {
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
      runtimeInstanceAdapters: {
        deterministic_test: failingStartAdapter
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/runtime-instances",
      payload: {
        idempotency_key: "runtime-instance-start-fails",
        instance_id: "sandbox-runtime-instance-start-fails",
        sandbox_name: "ouro-s5-clock-start-fails",
        runtime_id: "fixture-trading-system-runtime-001"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe("failed");
    expect(response.json().runtime_instance.lifecycle_status).toBe("failed");
    expect(response.json().runtime_instance.started_at).toBeUndefined();

    const status = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-start-fails"
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().lifecycle_status).toBe("failed");
    expect(statusCallCount).toBe(0);

    const stop = await server.inject({
      method: "POST",
      url: "/api/runtime-instances/sandbox-runtime-instance-start-fails/stop"
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().status).toBe("failed");
    expect(stop.json().runtime_instance.lifecycle_status).toBe("failed");
    expect(stopCallCount).toBe(0);

    const logs = await server.inject({
      method: "GET",
      url: "/api/runtime-instances/sandbox-runtime-instance-start-fails/logs"
    });
    expect(logs.statusCode).toBe(200);
    expect(logs.json().runtime_instance.lifecycle_status).toBe("failed");
    expect(logCallCount).toBe(0);
  });
});

async function startClockInstance(
  server: Awaited<ReturnType<typeof buildServer>>,
  input: {
    idempotency_key: string;
    instance_id: string;
    sandbox_name: string;
    created_at: string;
  }
) {
  const response = await server.inject({
    method: "POST",
    url: "/api/runtime-instances",
    payload: {
      ...input,
      runtime_id: "fixture-trading-system-runtime-001",
      test_ticks: 2,
      interval_ms: 1
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
