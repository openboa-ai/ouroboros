import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import {
  FileSystemRuntimeProcessOwnershipStore,
  LocalStore
} from "@ouroboros/local-store";
import type { RuntimeProcessOwnershipPort } from
  "@ouroboros/application/ports/runtime-process-ownership";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";
import {
  DeterministicSandboxAdapter,
  DockerSandboxesSbxSandboxAdapter,
  type SandboxAdapter,
  type SandboxAdapterStartInput,
  type SandboxAdapterStartResult
} from "@ouroboros/adapters/sandbox/adapter";

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

    const firstStop = await stopSandboxCommand(server, "sandbox-clock-a");
    expect(firstStop.statusCode).toBe(200);
    expect(firstStop.json().sandbox.lifecycle_status).toBe("stopped");

    const firstStopAgain = await stopSandboxCommand(server, "sandbox-clock-a");
    expect(firstStopAgain.statusCode).toBe(200);
    expect(firstStopAgain.json().sandbox.lifecycle_status).toBe("stopped");

    const secondStop = await stopSandboxCommand(server, "sandbox-clock-b");
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

  it("starts deterministic SystemCode as a long-running paper session when no test tick limit is supplied", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) {
      throw new Error("expected fixture SystemCode");
    }
    const adapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const started = await adapter.startArtifactInstance({
      artifact,
      instance_id: "sandbox-deterministic-long-running",
      sandbox_name: "ouro-deterministic-long-running",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-deterministic-long-running",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    try {
      expect(started.instance.lifecycle_status).toBe("running");
      expect(started.command_evidence[0]?.command).toEqual(expect.arrayContaining([
        "--log-file",
        "--heartbeat-file"
      ]));

      await sleep(30);
      const logs = await adapter.getArtifactInstanceLogs(started.instance);
      const logText = logs.logs?.flatMap((log) => log.lines).join("\n") ?? "";
      expect(logText).toContain("\"event\": \"order_request\"");
      expect(logText).toContain("\"event\": \"runtime_heartbeat\"");
      expect(logText).not.toContain("\"event\": \"runtime_stopped\"");
      expect(logs.heartbeats?.length).toBeGreaterThan(0);
      const heartbeatPayload = JSON.parse(logs.heartbeats?.[0]?.heartbeat_line ?? "{}");
      expect(heartbeatPayload.at).not.toBe("2026-05-21T00:00:00.000Z");
    } finally {
      const stopped = await adapter.stopArtifactInstance(started.instance);
      expect(stopped.lifecycle_status).toBe("stopped");
    }
  });

  it("keeps public sandbox.start finite when test tick limit is omitted", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const started = await startSandboxCommand(server, {
      idempotency_key: "sandbox-standalone-finite-default",
      sandbox_id: "sandbox-standalone-finite-default",
      sandbox_name: "ouro-standalone-finite-default",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 1
    });

    expect(started.statusCode).toBe(200);
    expect(started.json().sandbox.lifecycle_status).toBe("stopped");
    expect(started.json().sandbox.command_evidence[0]?.command).toEqual(expect.arrayContaining([
      "--ticks",
      "2"
    ]));
  });

  it("stops a legacy persisted-PID session after ownership-enabled adapter restart", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) {
      throw new Error("expected fixture SystemCode");
    }
    const adapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const started = await adapter.startArtifactInstance({
      artifact,
      instance_id: "sandbox-deterministic-pid-reap",
      sandbox_name: "ouro-deterministic-pid-reap",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-deterministic-pid-reap",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    try {
      expect(started.instance.lifecycle_status).toBe("running");
      const runningLogText = await waitForSandboxLog(adapter, started.instance, "runtime_heartbeat", 1_000);
      const legacyPid = Number((await readFile(
        sandboxPidFileForTest(started.instance.sandbox_id),
        "utf8"
      )).trim());
      const restartedAdapter = new DeterministicSandboxAdapter({
        commandTimeoutMs: 5_000,
        processOwnership: new FileSystemRuntimeProcessOwnershipStore(
          path.join(tmpDir, "runtime-process-ownership")
        ),
        hostId: "host-a"
      });
      await expect(restartedAdapter.getArtifactInstanceStatus(started.instance))
        .resolves.toMatchObject({ lifecycle_status: "running" });
      await expect(restartedAdapter.getArtifactInstanceLogs(started.instance))
        .resolves.toMatchObject({ lifecycle_status: "running" });
      const stopped = await restartedAdapter.stopArtifactInstance(started.instance);
      expect(stopped.lifecycle_status).toBe("stopped");
      expect(isPidAlive(legacyPid)).toBe(false);
      expect(runningLogText).toContain("runtime_heartbeat");
      expect(stopped.logs?.flatMap((log) => log.lines).join("\n")).toContain("runtime_stopped");
    } finally {
      await adapter.stopArtifactInstance(started.instance);
    }
  });

  it("adopts one exact owned Sandbox process across adapter restarts without duplicate effects", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) throw new Error("expected fixture SystemCode");
    const processOwnership = new FileSystemRuntimeProcessOwnershipStore(
      path.join(tmpDir, "runtime-process-ownership")
    );
    let delayActiveRead = false;
    const delayedProcessOwnership: RuntimeProcessOwnershipPort = {
      active: async (scope) => {
        if (delayActiveRead) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return processOwnership.active(scope);
      },
      inspect: (expected) => processOwnership.inspect(expected),
      claim: (input) => processOwnership.claim(input),
      reconcile: (input) => processOwnership.reconcile(input),
      close: (input) => processOwnership.close(input),
      terminate: (input) => processOwnership.terminate(input),
      history: (scope) => processOwnership.history(scope)
    };
    const options = {
      commandTimeoutMs: 5_000,
      processOwnership: delayedProcessOwnership,
      hostId: "host-a"
    };
    const input = {
      artifact,
      instance_id: "sandbox-owned-restart",
      sandbox_name: "ouro-owned-restart",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-owned-restart",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    } as const;
    const initialAdapter = new DeterministicSandboxAdapter(options);
    const started = await initialAdapter.startArtifactInstance(input);

    try {
      expect(started.instance.lifecycle_status).toBe("running");
      const firstHistory = await processOwnership.history({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: input.instance_id }
      });
      const firstPid = firstHistory.at(-1)?.owner.process_id;
      expect(firstPid).toBeTypeOf("number");
      expect(isPidAlive(firstPid!)).toBe(true);

      const restartedAdapter = new DeterministicSandboxAdapter(options);
      const concurrentObservations = await Promise.all([
        restartedAdapter.getArtifactInstanceStatus(started.instance),
        restartedAdapter.getArtifactInstanceStatus(started.instance),
        restartedAdapter.getArtifactInstanceLogs(started.instance),
        restartedAdapter.getArtifactInstanceLogs(started.instance)
      ]);
      expect(concurrentObservations).toHaveLength(4);
      for (const observation of concurrentObservations) {
        expect(observation.lifecycle_status).toBe("running");
      }
      const adopted = await restartedAdapter.startArtifactInstance(input);
      expect(adopted.instance.lifecycle_status).toBe("running");

      const adoptedHistory = await processOwnership.history({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: input.instance_id }
      });
      expect(adoptedHistory.at(-1)).toMatchObject({
        owner: { process_id: firstPid },
        ownership_status: "active",
        adoption_count: 1
      });
      expect(adoptedHistory).toHaveLength(2);
      expect(isPidAlive(firstPid!)).toBe(true);

      const mismatchedAdapter = new DeterministicSandboxAdapter(options);
      await expect(mismatchedAdapter.startArtifactInstance({
        ...input,
        interval_ms: 25
      })).rejects.toThrow("identity_mismatch");
      expect(isPidAlive(firstPid!)).toBe(true);

      delayActiveRead = true;
      const stopped = await initialAdapter.stopArtifactInstance(started.instance);
      expect(stopped.lifecycle_status).toBe("stopped");
      expect(isPidAlive(firstPid!)).toBe(false);
      expect((await processOwnership.history({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: input.instance_id }
      })).at(-1)).toMatchObject({
        ownership_status: "terminal",
        terminal_reason: "shutdown"
      });
    } finally {
      await initialAdapter.stopArtifactInstance(started.instance).catch(() => undefined);
    }
  });

  it("fails closed when the ownership gate is not consumed before startup timeout", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) throw new Error("expected fixture SystemCode");
    const processOwnership = new FileSystemRuntimeProcessOwnershipStore(
      path.join(tmpDir, "runtime-process-ownership")
    );
    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      processOwnership,
      hostId: "host-a",
      ownershipGateReleaseTimeoutMs: 0
    });
    const input = {
      artifact,
      instance_id: "sandbox-owned-gate-timeout",
      sandbox_name: "ouro-owned-gate-timeout",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-owned-gate-timeout",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    } as const;
    const scope = {
      process_kind: "candidate_sandbox" as const,
      subject_ref: { record_kind: "sandbox", id: input.instance_id }
    };

    try {
      await expect(adapter.startArtifactInstance(input)).rejects.toThrow(
        "sandbox_ownership_gate_consumption_timeout"
      );
      const history = await processOwnership.history(scope);
      const claimedPid = history[0]?.owner.process_id;
      expect(claimedPid).toBeTypeOf("number");
      expect(isPidAlive(claimedPid!)).toBe(false);
      expect(history.at(-1)).toMatchObject({ ownership_status: "terminal" });
      await expect(processOwnership.active(scope)).resolves.toBeUndefined();
    } finally {
      const active = await processOwnership.active(scope).catch(() => undefined);
      if (active) {
        await processOwnership.terminate({
          ownership: active,
          terminalReason: "timed_out",
          closedAt: new Date().toISOString()
        }).catch(() => undefined);
      }
    }
  });

  it("adopts a consumed ownership gate before the first heartbeat", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixtureArtifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!fixtureArtifact || fixtureArtifact.artifact_kind !== "python_file") {
      throw new Error("expected fixture SystemCode");
    }
    const delayedScriptPath = path.join(tmpDir, "sandbox-delayed-heartbeat.py");
    await writeFile(delayedScriptPath, delayedHeartbeatSandboxScript(2_000), "utf8");
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    const processOwnership = new FileSystemRuntimeProcessOwnershipStore(
      path.join(tmpDir, "runtime-process-ownership")
    );
    const adapterOptions = {
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [tmpDir],
      allowedCapabilityPolicyIds: [capabilityPolicyId],
      processOwnership,
      hostId: "host-a"
    } as const;
    const firstAdapter = new DeterministicSandboxAdapter(adapterOptions);
    const restartedAdapter = new DeterministicSandboxAdapter(adapterOptions);
    const input: SandboxAdapterStartInput = {
      artifact: {
        ...fixtureArtifact,
        system_code_id: "system-code-delayed-heartbeat",
        artifact_path: delayedScriptPath,
        artifact_digest: "sha256:delayed-heartbeat",
        entrypoint: ["python3", delayedScriptPath],
        capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
        created_at: "2026-05-21T00:00:00.000Z"
      },
      instance_id: "sandbox-owned-consumed-gate",
      sandbox_name: "ouro-owned-consumed-gate",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-owned-consumed-gate",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    };
    let started: SandboxAdapterStartResult | undefined;

    try {
      started = await firstAdapter.startArtifactInstance(input);
      expect(started.instance.lifecycle_status).toBe("running");
      expect(started.heartbeats).toHaveLength(0);

      const adopted = await restartedAdapter.startArtifactInstance(input);

      expect(adopted.instance.lifecycle_status).toBe("running");
      const active = await processOwnership.active({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: input.instance_id }
      });
      expect(active).toBeDefined();
      expect(isPidAlive(active!.owner.process_id)).toBe(true);
    } finally {
      if (started) {
        await firstAdapter.stopArtifactInstance(started.instance).catch(() => undefined);
      }
      const active = await processOwnership.active({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: input.instance_id }
      }).catch(() => undefined);
      if (active) {
        await processOwnership.terminate({
          ownership: active,
          terminalReason: "shutdown",
          closedAt: new Date().toISOString()
        }).catch(() => undefined);
      }
    }
  });

  it("reaps a legacy persisted-PID session before ownership-enabled replacement", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) {
      throw new Error("expected fixture SystemCode");
    }
    const legacyAdapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const processOwnership = new FileSystemRuntimeProcessOwnershipStore(
      path.join(tmpDir, "runtime-process-ownership")
    );
    const ownershipAdapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      processOwnership,
      hostId: "host-a"
    });
    const instanceId = "sandbox-deterministic-replaced-session";
    const pidFile = sandboxPidFileForTest(instanceId);
    const startInput = {
      artifact,
      instance_id: instanceId,
      sandbox_name: "ouro-deterministic-replaced-session",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-deterministic-replaced-session",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    } as const;
    const started = await legacyAdapter.startArtifactInstance(startInput);
    let activeInstance = started.instance;

    try {
      const firstPid = Number((await readFile(pidFile, "utf8")).trim());
      const replaced = await ownershipAdapter.startArtifactInstance(startInput);
      activeInstance = replaced.instance;
      const secondPid = (await processOwnership.history({
        process_kind: "candidate_sandbox",
        subject_ref: { record_kind: "sandbox", id: instanceId }
      })).at(-1)?.owner.process_id;

      expect(secondPid).not.toBe(firstPid);
      expect(isPidAlive(firstPid)).toBe(false);
      expect(secondPid).toBeTypeOf("number");
      expect(isPidAlive(secondPid!)).toBe(true);
    } finally {
      await ownershipAdapter.stopArtifactInstance(activeInstance).catch(() => undefined);
      await legacyAdapter.stopArtifactInstance(started.instance).catch(() => undefined);
    }
  });

  it("uses collision-resistant PID files for long sandbox ids with the same prefix", () => {
    const sharedPrefix = `sandbox-${"same-prefix-".repeat(8)}`;
    const first = sandboxPidFileForTest(`${sharedPrefix}first`);
    const second = sandboxPidFileForTest(`${sharedPrefix}second`);

    expect(path.basename(first)).not.toBe(path.basename(second));
  });

  it("isolates runtime files for long sandbox ids with the same prefix", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode(
      "fixture-system-code-clock-python-001"
    );
    if (!artifact) throw new Error("expected fixture SystemCode");
    const adapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const sharedPrefix = `sandbox-${"same-prefix-".repeat(8)}`;
    const firstId = `${sharedPrefix}first`;
    const secondId = `${sharedPrefix}second`;
    const first = await adapter.startArtifactInstance({
      artifact,
      instance_id: firstId,
      sandbox_name: "ouro-long-prefix-first",
      runtime_ref: { record_kind: "trading_run", id: "first-run" },
      sandbox_placement_id: "sandbox-placement-long-prefix-first",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });
    const second = await adapter.startArtifactInstance({
      artifact,
      instance_id: secondId,
      sandbox_name: "ouro-long-prefix-second",
      runtime_ref: { record_kind: "trading_run", id: "second-run" },
      sandbox_placement_id: "sandbox-placement-long-prefix-second",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    try {
      expect(first.logs?.[0]?.sandbox_log_id).not.toBe(
        second.logs?.[0]?.sandbox_log_id
      );
      expect(first.command_evidence[0]?.sandbox_command_evidence_id).not.toBe(
        second.command_evidence[0]?.sandbox_command_evidence_id
      );
      await sleep(30);
      const firstLogs = await adapter.getArtifactInstanceLogs(first.instance);
      const secondLogs = await adapter.getArtifactInstanceLogs(second.instance);
      const firstText = firstLogs.logs?.flatMap((log) => log.lines).join("\n") ?? "";
      const secondText = secondLogs.logs?.flatMap((log) => log.lines).join("\n") ?? "";

      expect(firstText).toContain(firstId);
      expect(firstText).not.toContain(secondId);
      expect(secondText).toContain(secondId);
      expect(secondText).not.toContain(firstId);
    } finally {
      await Promise.allSettled([
        adapter.stopArtifactInstance(first.instance),
        adapter.stopArtifactInstance(second.instance)
      ]);
    }
  });

  it("marks a generated long-running paper session as failed when it exits before startup logs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixtureArtifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!fixtureArtifact || fixtureArtifact.artifact_kind !== "python_file") {
      throw new Error("expected fixture SystemCode");
    }
    const crashPath = path.join(tmpDir, "crash-before-startup-log.py");
    await writeFile(crashPath, "raise RuntimeError('startup crash before jsonl')\n", "utf8");
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [tmpDir],
      allowedCapabilityPolicyIds: [capabilityPolicyId]
    });
    const instanceId = "sandbox-generated-startup-crash";
    const started = await adapter.startArtifactInstance({
      artifact: {
        ...fixtureArtifact,
        system_code_id: "system-code-generated-startup-crash",
        artifact_path: crashPath,
        artifact_digest: "sha256:generated-startup-crash",
        entrypoint: ["python3", crashPath],
        capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
        created_at: "2026-05-21T00:00:00.000Z"
      },
      instance_id: instanceId,
      sandbox_name: "ouro-generated-startup-crash",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-generated-startup-crash",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    expect(started.instance.lifecycle_status).toBe("failed");
    expect(started.instance.started_at).toBeUndefined();
    expect(started.command_evidence[0]?.exit_code).not.toBe(0);
    expect(started.logs).toHaveLength(0);
    await expect(readFile(
      sandboxPidFileForTest(instanceId),
      "utf8"
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("marks a deterministic long-running paper session as failed when spawn fails", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) {
      throw new Error("expected fixture SystemCode");
    }
    const adapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const instanceId = "sandbox-deterministic-spawn-failure";
    const started = await adapter.startArtifactInstance({
      artifact,
      instance_id: instanceId,
      sandbox_name: "ouro-deterministic-spawn-failure",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-deterministic-spawn-failure",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10,
      env: { PATH: "" } as never
    });

    expect(started.instance.lifecycle_status).toBe("failed");
    expect(started.instance.started_at).toBeUndefined();
    expect(started.command_evidence[0]?.exit_code).not.toBe(0);
    expect(started.command_evidence[0]?.stderr).toContain("spawn python3");
    await expect(readFile(
      sandboxPidFileForTest(instanceId),
      "utf8"
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not report an externally killed long-running paper session as running", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!artifact) {
      throw new Error("expected fixture SystemCode");
    }
    const adapter = new DeterministicSandboxAdapter({ commandTimeoutMs: 5_000 });
    const instanceId = "sandbox-deterministic-signal-exit";
    const started = await adapter.startArtifactInstance({
      artifact,
      instance_id: instanceId,
      sandbox_name: "ouro-deterministic-signal-exit",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-deterministic-signal-exit",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    try {
      expect(started.instance.lifecycle_status).toBe("running");
      const pid = Number((await readFile(
        sandboxPidFileForTest(instanceId),
        "utf8"
      )).trim());
      process.kill(pid, "SIGKILL");

      let lifecycleStatus = "running";
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const status = await adapter.getArtifactInstanceStatus(started.instance);
        lifecycleStatus = status.lifecycle_status ?? lifecycleStatus;
        if (lifecycleStatus !== "running") {
          break;
        }
        await sleep(25);
      }
      expect(lifecycleStatus).toBe("failed");
    } finally {
      await adapter.stopArtifactInstance(started.instance);
    }
  });

  it("terminates helper processes in the detached paper sandbox process group", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixtureArtifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!fixtureArtifact || fixtureArtifact.artifact_kind !== "python_file") {
      throw new Error("expected fixture SystemCode");
    }
    const helperPidFile = path.join(tmpDir, "sandbox-helper.pid");
    const helperScriptPath = path.join(tmpDir, "sandbox-with-helper.py");
    await writeFile(helperScriptPath, helperSpawningSandboxScript(helperPidFile), "utf8");
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [tmpDir],
      allowedCapabilityPolicyIds: [capabilityPolicyId]
    });
    const started = await adapter.startArtifactInstance({
      artifact: {
        ...fixtureArtifact,
        system_code_id: "system-code-generated-helper-process",
        artifact_path: helperScriptPath,
        artifact_digest: "sha256:generated-helper-process",
        entrypoint: ["python3", helperScriptPath],
        capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
        created_at: "2026-05-21T00:00:00.000Z"
      },
      instance_id: "sandbox-generated-helper-process",
      sandbox_name: "ouro-generated-helper-process",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-generated-helper-process",
      created_at: "2026-05-21T00:00:00.000Z",
      interval_ms: 10
    });

    try {
      expect(started.instance.lifecycle_status).toBe("running");
      const helperPid = Number((await waitForFile(helperPidFile, 1_000)).trim());
      expect(isPidAlive(helperPid)).toBe(true);

      const stopped = await adapter.stopArtifactInstance(started.instance);
      expect(stopped.lifecycle_status).toBe("stopped");

      for (let attempt = 0; attempt < 20 && isPidAlive(helperPid); attempt += 1) {
        await sleep(25);
      }
      expect(isPidAlive(helperPid)).toBe(false);
    } finally {
      await adapter.stopArtifactInstance(started.instance);
    }
  });

  it("executes fixture SystemCode when the runtime process starts from apps/runtime", async () => {
    const originalCwd = process.cwd();
    process.chdir(path.join(originalCwd, "apps/runtime"));
    try {
      const server = await buildServer({ store: new LocalStore(tmpDir) });
      const started = await startClockSandbox(server, {
        idempotency_key: "sandbox-system-code-runtime-cwd",
        sandbox_id: "sandbox-system-code-runtime-cwd",
        sandbox_name: "ouro-system-code-runtime-cwd",
        created_at: "2026-05-21T00:00:00.000Z",
        interval_ms: 1
      });

      expect(started.sandbox.lifecycle_status).toBe("stopped");
      expect(started.sandbox.command_evidence[0]).toMatchObject({
        exit_code: 0,
        command: expect.arrayContaining([
          "python3",
          "fixtures/trading-systems/clock.py"
        ])
      });
      expect(started.sandbox.logs[0].lines.join("\n")).toContain("order_request");
    } finally {
      process.chdir(originalCwd);
    }
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

    const response = await startSandboxCommand(server, {
      idempotency_key: "sandbox-reject-non-fixture",
      sandbox_id: "sandbox-reject-non-fixture",
      sandbox_name: "ouro-reject-non-fixture",
      system_code_id: "system-code-non-fixture-network-001",
      created_at: "2026-05-21T00:00:00.000Z"
    });

    expect(response.statusCode).toBe(200);
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

  it("executes allowed generated paper SystemCode with a relative entrypoint inside the arena artifact root", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const artifactDir = path.join(tmpDir, "candidate-arena-runs", "relative-entrypoint");
    const artifactPath = path.join(artifactDir, "run.py");
    const relativeEntrypoint = path.relative(process.cwd(), artifactPath);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, generatedPaperArtifact(), "utf8");
    await chmod(artifactPath, 0o755);

    await store.recordSystemCode({
      record_kind: "system_code",
      version: 1,
      system_code_id: "system-code-arena-relative-entrypoint",
      artifact_kind: "python_file",
      artifact_path: artifactPath,
      artifact_digest: `sha256:${createHash("sha256").update(await readFile(artifactPath)).digest("hex")}`,
      runtime_kind: "python",
      entrypoint: ["python3", relativeEntrypoint],
      declared_output_contract: {
        contract_kind: "opaque_runtime_boundary",
        declared_output_kinds: ["runtime_log", "runtime_heartbeat", "order_request"]
      },
      secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
      capability_policy_ref: { record_kind: "capability_policy", id: "candidate-arena-paper-system-code" },
      provenance_refs: [{ record_kind: "trace_placeholder", id: "trace-generated-relative-entrypoint" }],
      status: "registered",
      created_at: "2026-05-21T00:00:00.000Z",
      authority_status: "not_live"
    });
    const server = await buildServer({ store });

    const response = await startSandboxCommand(server, {
      idempotency_key: "sandbox-generated-relative-entrypoint",
      sandbox_id: "sandbox-generated-relative-entrypoint",
      sandbox_name: "ouro-generated-relative-entrypoint",
      system_code_id: "system-code-arena-relative-entrypoint",
      trading_run_id: "fixture-trading-run-001",
      test_ticks: 1,
      interval_ms: 1,
      created_at: "2026-05-21T00:00:00.000Z"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("stopped");
    expect(response.json().sandbox.lifecycle_status).toBe("stopped");
    expect(response.json().sandbox.logs[0].lines.join("\n")).toContain("\"event\": \"order_request\"");
    expect(response.json().sandbox.command_evidence[0]).toMatchObject({
      exit_code: 0,
      command: expect.arrayContaining(["python3", expect.stringContaining("relative-entrypoint/run.py")])
    });
  });

  it("executes a copied generated SystemCode from the arm artifact root", async () => {
    const sourceArtifactRoot = path.join(tmpDir, "source", "candidate-arena-runs");
    const armArtifactRoot = path.join(tmpDir, "arm", "candidate-arena-runs");
    const relativeArtifactPath = path.join("arena-tick-1", "candidate-1", "run.py");
    const sourceArtifactPath = path.join(sourceArtifactRoot, relativeArtifactPath);
    const armArtifactPath = path.join(armArtifactRoot, relativeArtifactPath);
    const source = generatedPaperArtifact();
    await mkdir(path.dirname(sourceArtifactPath), { recursive: true });
    await mkdir(path.dirname(armArtifactPath), { recursive: true });
    await writeFile(sourceArtifactPath, source, "utf8");
    await writeFile(armArtifactPath, source, "utf8");
    await chmod(armArtifactPath, 0o755);
    await rm(path.join(tmpDir, "source"), { recursive: true, force: true });
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [armArtifactRoot],
      allowedCapabilityPolicyIds: [capabilityPolicyId]
    });

    const started = await adapter.startArtifactInstance({
      artifact: {
        record_kind: "system_code",
        version: 1,
        system_code_id: "system-code-copied-arm-artifact",
        artifact_kind: "python_file",
        artifact_path: sourceArtifactPath,
        artifact_digest: `sha256:${createHash("sha256").update(source).digest("hex")}`,
        runtime_kind: "python",
        entrypoint: ["python3", sourceArtifactPath],
        declared_output_contract: {
          contract_kind: "opaque_runtime_boundary",
          declared_output_kinds: ["runtime_log", "runtime_heartbeat", "order_request"]
        },
        secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
        capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
        provenance_refs: [{ record_kind: "trace_placeholder", id: "trace-copied-arm" }],
        status: "registered",
        created_at: "2026-05-21T00:00:00.000Z",
        authority_status: "not_live"
      },
      instance_id: "sandbox-copied-arm-artifact",
      sandbox_name: "ouro-copied-arm-artifact",
      runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
      sandbox_placement_id: "sandbox-placement-copied-arm-artifact",
      created_at: "2026-05-21T00:00:00.000Z",
      test_ticks: 1,
      interval_ms: 1
    });

    expect(started.instance.lifecycle_status).toBe("stopped");
    expect(started.command_evidence[0]).toMatchObject({
      exit_code: 0,
      command: expect.arrayContaining(["python3", armArtifactPath])
    });
  });

  it("executes generated paper SystemCode stored under a relative runtime dev-store root", async () => {
    const runtimeCwd = path.join(tmpDir, "apps/runtime");
    const relativeStoreRoot = path.join(".ouroboros", "dev-store");
    const relativeArtifactPath = path.join(
      relativeStoreRoot,
      "candidate-arena-runs",
      "relative-runtime-store",
      "run.py"
    );
    const artifactPath = path.join(runtimeCwd, relativeArtifactPath);
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, generatedPaperArtifact(), "utf8");
    await chmod(artifactPath, 0o755);

    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [path.join(relativeStoreRoot, "candidate-arena-runs")],
      allowedCapabilityPolicyIds: [capabilityPolicyId]
    });
    const previousCwd = process.cwd();
    process.chdir(runtimeCwd);
    try {
      const started = await adapter.startArtifactInstance({
        artifact: {
          record_kind: "system_code",
          version: 1,
          system_code_id: "system-code-arena-relative-runtime-store",
          artifact_kind: "python_file",
          artifact_path: relativeArtifactPath,
          artifact_digest: `sha256:${createHash("sha256").update(await readFile(artifactPath)).digest("hex")}`,
          runtime_kind: "python",
          entrypoint: ["python3", relativeArtifactPath],
          declared_output_contract: {
            contract_kind: "opaque_runtime_boundary",
            declared_output_kinds: ["runtime_log", "runtime_heartbeat", "order_request"]
          },
          secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
          capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
          provenance_refs: [{ record_kind: "trace_placeholder", id: "trace-relative-runtime-store" }],
          status: "registered",
          created_at: "2026-05-21T00:00:00.000Z",
          authority_status: "not_live"
        },
        instance_id: "sandbox-generated-relative-runtime-store",
        sandbox_name: "ouro-generated-relative-runtime-store",
        runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
        sandbox_placement_id: "sandbox-placement-generated-relative-runtime-store",
        created_at: "2026-05-21T00:00:00.000Z",
        test_ticks: 1,
        interval_ms: 1
      });

      expect(started.instance.lifecycle_status).toBe("stopped");
      expect(started.logs[0]?.lines.join("\n")).toContain("\"event\": \"order_request\"");
      expect(started.command_evidence[0]).toMatchObject({
        exit_code: 0,
        command: expect.arrayContaining(["python3", expect.stringContaining("relative-runtime-store/run.py")])
      });
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("rejects generated paper SystemCode when a relative entrypoint only resolves from process cwd", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixtureArtifact = await store.getSystemCode("fixture-system-code-clock-python-001");
    if (!fixtureArtifact || fixtureArtifact.artifact_kind !== "python_file") {
      throw new Error("expected fixture SystemCode");
    }
    const artifactDir = path.join(tmpDir, "candidate-arena-runs", "cwd-only-entrypoint");
    const artifactPath = path.join(artifactDir, "run.py");
    const cwdOnlyEntrypoint = path.join("candidate-arena-runs", "cwd-only-entrypoint", "run.py");
    const capabilityPolicyId = "candidate-arena-paper-system-code";
    await mkdir(artifactDir, { recursive: true });
    await writeFile(artifactPath, generatedPaperArtifact(), "utf8");

    const adapter = new DeterministicSandboxAdapter({
      commandTimeoutMs: 5_000,
      allowedArtifactRoots: [tmpDir],
      allowedCapabilityPolicyIds: [capabilityPolicyId]
    });
    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const started = await adapter.startArtifactInstance({
        artifact: {
          ...fixtureArtifact,
          system_code_id: "system-code-arena-cwd-only-entrypoint",
          artifact_path: artifactPath,
          artifact_digest: `sha256:${createHash("sha256").update(await readFile(artifactPath)).digest("hex")}`,
          entrypoint: ["python3", cwdOnlyEntrypoint],
          capability_policy_ref: { record_kind: "capability_policy", id: capabilityPolicyId },
          created_at: "2026-05-21T00:00:00.000Z"
        },
        instance_id: "sandbox-generated-cwd-only-entrypoint",
        sandbox_name: "ouro-generated-cwd-only-entrypoint",
        runtime_ref: { record_kind: "trading_run", id: "fixture-trading-run-001" },
        sandbox_placement_id: "sandbox-placement-generated-cwd-only-entrypoint",
        created_at: "2026-05-21T00:00:00.000Z",
        test_ticks: 1,
        interval_ms: 1
      });

      expect(started.instance.lifecycle_status).toBe("failed");
      expect(started.command_evidence[0]).toMatchObject({
        exit_code: 2,
        command: [
          "deterministic_test",
          "reject-non-fixture-system-code",
          "system-code-arena-cwd-only-entrypoint"
        ]
      });
      expect(started.command_evidence[0]?.stderr).toContain(
        "deterministic_test only executes fixture SystemCode"
      );
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("rejects raw secret material in sandbox requests", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await startSandboxCommand(server, {
      idempotency_key: "sandbox-with-secret",
      raw_secret_values: {
        exchange_token: "do-not-store"
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
      const response = await startSandboxCommand(server, {
        idempotency_key: "sandbox-sbx-disabled",
        adapter_kind: "docker_sandboxes_sbx"
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
      const response = await startSandboxCommand(server, {
        idempotency_key: "sandbox-sdx-api-rejected",
        adapter_kind: "docker_sandboxes_sbx",
        sandbox_id: "sandbox-sdx-api-rejected",
        sandbox_name: "ouro-s5-clock-sdx-api-rejected",
        trading_run_id: "fixture-trading-run-001"
      });

      expect(response.statusCode).toBe(200);
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
      const start = await startSandboxCommand(server, {
        idempotency_key: "sandbox-real-adapter-evidence",
        adapter_kind: "docker_sandboxes_sbx",
        sandbox_id: "sandbox-real-adapter-evidence",
        sandbox_name: "ouro-s5-clock-real-adapter-evidence",
        trading_run_id: "fixture-trading-run-001",
        interval_ms: 1
      });
      expect(start.statusCode).toBe(200);
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
      expect(persisted?.command_evidence_refs).toHaveLength(20);
      const commandEvidenceIds = persisted?.command_evidence.map((evidence) => evidence.command_evidence_ref.id) ?? [];
      expect(new Set(commandEvidenceIds).size).toBe(commandEvidenceIds.length);
      expect(persisted?.command_evidence.filter((evidence) => evidence.command[1] === "version")).toHaveLength(5);
      expect(persisted?.command_evidence.filter((evidence) => (
        evidence.command[1] === "exec" &&
        evidence.command[3] === "cat" &&
        evidence.command[4]?.endsWith(".heartbeat.json")
      ))).toHaveLength(3);
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

  it("fails a real-adapter detached start when startup heartbeat evidence is missing", async () => {
    const fakeSbx = path.join(tmpDir, "sbx");
    const commandLog = path.join(tmpDir, "sbx-missing-heartbeat.log");
    await writeFile(fakeSbx, fakeSbxScript({
      commandLog,
      heartbeatMode: "missing",
      instanceId: "sandbox-real-adapter-missing-heartbeat"
    }), "utf8");
    await chmod(fakeSbx, 0o755);

    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    process.env.OUROBOROS_ENABLE_SBX_SANDBOX = "1";
    try {
      const server = await buildServer({
        store: new LocalStore(tmpDir),
        sandboxAdapters: {
          docker_sandboxes_sbx: new DockerSandboxesSbxSandboxAdapter({
            commandTimeoutMs: 5_000,
            sbxPath: fakeSbx,
            startupHeartbeatPollIntervalMs: 100,
            startupHeartbeatTimeoutMs: 1_000
          })
        }
      });
      const start = await startSandboxCommand(server, {
        idempotency_key: "sandbox-real-adapter-missing-heartbeat",
        adapter_kind: "docker_sandboxes_sbx",
        sandbox_id: "sandbox-real-adapter-missing-heartbeat",
        sandbox_name: "ouro-s5-clock-missing-heartbeat",
        trading_run_id: "fixture-trading-run-001",
        interval_ms: 1
      });

      expect(start.statusCode).toBe(200);
      expect(start.json().status).toBe("failed");
      expect(start.json().sandbox.lifecycle_status).toBe("failed");
      expect(start.json().sandbox.started_at).toBeUndefined();
      expect(start.json().sandbox.command_evidence.some((evidence: { command: string[] }) =>
        evidence.command[1] === "stop"
      )).toBe(true);
    } finally {
      restoreEnv("OUROBOROS_ENABLE_SBX_SANDBOX", previousEnable);
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
      getArtifactInstanceStatus: (instance) => baseAdapter.getArtifactInstanceStatus(instance),
      getArtifactInstanceLogs: (instance) => baseAdapter.getArtifactInstanceLogs(instance),
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
    const stop = await stopSandboxCommand(server, "sandbox-stop-fails");

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
      getArtifactInstanceStatus: async (instance) => {
        statusCallCount += 1;
        return await baseAdapter.getArtifactInstanceStatus(instance);
      },
      getArtifactInstanceLogs: async (instance) => {
        logCallCount += 1;
        return await baseAdapter.getArtifactInstanceLogs(instance);
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
    const stop = await stopSandboxCommand(server, "sandbox-stopped-terminal");
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
        await baseAdapter.stopArtifactInstance(result.instance);
        return {
          ...result,
          instance: {
            ...result.instance,
            lifecycle_status: "failed",
            started_at: undefined
          }
        };
      },
      getArtifactInstanceStatus: async (instance) => {
        statusCallCount += 1;
        return await baseAdapter.getArtifactInstanceStatus(instance);
      },
      getArtifactInstanceLogs: async (instance) => {
        logCallCount += 1;
        return await baseAdapter.getArtifactInstanceLogs(instance);
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

    const response = await startSandboxCommand(server, {
      idempotency_key: "sandbox-start-fails",
      sandbox_id: "sandbox-start-fails",
      sandbox_name: "ouro-s5-clock-start-fails",
      trading_run_id: "fixture-trading-run-001"
    });

    expect(response.statusCode).toBe(200);
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

    const stop = await stopSandboxCommand(server, "sandbox-start-fails");
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
  const response = await startSandboxCommand(server, {
    ...input,
    trading_run_id: "fixture-trading-run-001",
    test_ticks: 2,
    interval_ms: input.interval_ms ?? 1
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

async function startSandboxCommand(
  server: Awaited<ReturnType<typeof buildServer>>,
  payload: Record<string, unknown>
) {
  return commandResultResponse(await server.inject({
    method: "POST",
    url: "/api/commands",
    payload: {
      command_kind: "sandbox.start",
      payload
    }
  }));
}

async function stopSandboxCommand(
  server: Awaited<ReturnType<typeof buildServer>>,
  sandboxId: string
) {
  return commandResultResponse(await server.inject({
    method: "POST",
    url: "/api/commands",
    payload: {
      command_kind: "sandbox.stop",
      payload: {
        sandbox_id: sandboxId
      }
    }
  }));
}

function commandResultResponse(response: Awaited<ReturnType<Awaited<ReturnType<typeof buildServer>>["inject"]>>) {
  return {
    statusCode: response.statusCode,
    body: response.body,
    json: () => {
      const body = response.json();
      return body.result ?? body;
    }
  };
}

function generatedPaperArtifact(): string {
  return `#!/usr/bin/env python3
import argparse
import json


def emit(payload):
    print(json.dumps(payload, sort_keys=True), flush=True)


parser = argparse.ArgumentParser()
parser.add_argument("--instance-id", required=True)
parser.add_argument("--ticks", default="1")
parser.add_argument("--interval-ms", default="1")
parser.add_argument("--start-at", required=True)
parser.add_argument("--paper-order-request", default="valid")
args = parser.parse_args()

emit({
    "event": "runtime_heartbeat",
    "event_id": f"{args.instance_id}:heartbeat:0001",
    "instance_id": args.instance_id,
    "at": args.start_at,
})
emit({
    "event": "order_request",
    "event_id": f"{args.instance_id}:order-request:0001",
    "intent_kind": "place_order",
    "symbol": "BTCUSDT",
    "side": "buy",
    "order_type": "limit",
    "quantity": "0.001",
    "limit_price": "60000",
    "reason": "generated paper fixture order",
})
`;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath: string, timeoutMs: number): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const content = await readFile(filePath, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    });
    if (content !== undefined) {
      return content;
    }
    await sleep(10);
  }
  return await readFile(filePath, "utf8");
}

async function waitForSandboxLog(
  adapter: SandboxAdapter,
  instance: Parameters<SandboxAdapter["getArtifactInstanceLogs"]>[0],
  expectedText: string,
  timeoutMs: number
): Promise<string> {
  const startedAt = Date.now();
  let lastLogText = "";
  while (Date.now() - startedAt < timeoutMs) {
    const logs = await adapter.getArtifactInstanceLogs(instance);
    lastLogText = logs.logs?.flatMap((log) => log.lines).join("\n") ?? "";
    if (lastLogText.includes(expectedText)) {
      return lastLogText;
    }
    await sleep(10);
  }
  return lastLogText;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function sandboxPidFileForTest(instanceId: string): string {
  const digest = createHash("sha256").update(instanceId).digest("hex").slice(0, 12);
  return path.join(process.cwd(), ".ouroboros", "sandbox-pids", `${safeRuntimeIdForTest(instanceId)}-${digest}.pid`);
}

function safeRuntimeIdForTest(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "runtime";
}

function helperSpawningSandboxScript(helperPidFile: string): string {
  return `import argparse
import json
import pathlib
import subprocess
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument("--instance-id", required=True)
parser.add_argument("--interval-ms", required=True)
parser.add_argument("--log-file", required=True)
parser.add_argument("--heartbeat-file", required=True)
args, _ = parser.parse_known_args()

child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
pathlib.Path(${JSON.stringify(helperPidFile)}).write_text(str(child.pid), encoding="utf8")
event = {
    "event": "runtime_heartbeat",
    "instance_id": args.instance_id,
    "tick": 0,
    "at": "2026-05-21T00:00:00.000Z"
}
pathlib.Path(args.log_file).write_text(json.dumps(event) + "\\n", encoding="utf8")
pathlib.Path(args.heartbeat_file).write_text(json.dumps(event), encoding="utf8")
while True:
    time.sleep(1)
`;
}

function delayedHeartbeatSandboxScript(delayMs: number): string {
  return `import argparse
import json
import pathlib
import time

parser = argparse.ArgumentParser()
parser.add_argument("--instance-id", required=True)
parser.add_argument("--interval-ms", required=True)
parser.add_argument("--log-file", required=True)
parser.add_argument("--heartbeat-file", required=True)
args, _ = parser.parse_known_args()

time.sleep(${delayMs / 1_000})
event = {
    "event": "runtime_heartbeat",
    "instance_id": args.instance_id,
    "tick": 0,
    "at": "2026-05-21T00:00:00.000Z"
}
pathlib.Path(args.log_file).write_text(json.dumps(event) + "\\n", encoding="utf8")
pathlib.Path(args.heartbeat_file).write_text(json.dumps(event), encoding="utf8")
while True:
    time.sleep(1)
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

function fakeSbxScript(options: {
  commandLog?: string;
  heartbeatMode?: "missing" | "present";
  instanceId?: string;
} = {}): string {
  const commandLog = options.commandLog
    ? shellSingleQuote(options.commandLog)
    : "\"${SBX_FAKE_COMMAND_LOG}\"";
  const heartbeatMode = options.heartbeatMode
    ? shellSingleQuote(options.heartbeatMode)
    : "\"${SBX_FAKE_HEARTBEAT_MODE:-present}\"";
  const instanceId = options.instanceId
    ? shellSingleQuote(options.instanceId)
    : "\"${SBX_FAKE_INSTANCE_ID}\"";
  return `#!/bin/sh
set -eu
command_log=${commandLog}
heartbeat_mode=${heartbeatMode}
instance_id=${instanceId}
printf '%s\\n' "$*" >> "$command_log"
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
        printf '{"rules":[]}\n'
        ;;
      check)
        printf '{"decision":"deny"}\n'
        exit 1
        ;;
      log)
        printf '{"entries":[]}\n'
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
      if [ "$heartbeat_mode" = "missing" ]; then
        echo "missing heartbeat" >&2
        exit 1
      fi
      printf '{"event":"runtime_heartbeat","instance_id":"%s","tick":1,"at":"2026-05-10T00:00:00.000Z"}\\n' "$instance_id"
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

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
