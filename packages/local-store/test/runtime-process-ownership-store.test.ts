import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeProcessOwnershipRecord } from "@ouroboros/domain";
import {
  FileSystemRuntimeProcessOwnershipStore,
  RuntimeProcessOwnershipStoreError,
  type RuntimeProcessOwnerLiveness
} from "../src/runtime-process-ownership-store";

describe("FileSystemRuntimeProcessOwnershipStore", () => {
  let root = "";
  let liveness: RuntimeProcessOwnerLiveness = "alive";
  const terminate = vi.fn(async () => undefined);

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-process-ownership-"));
    liveness = "alive";
    terminate.mockClear();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("adopts only an exact live process and persists the adoption transition", async () => {
    const store = processStore();
    const claimed = await store.claim(claimInput());

    const reconciled = await store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:01.000Z"
    });

    expect(reconciled).toMatchObject({
      status: "adopted",
      ownership: {
        runtime_process_ownership_id: claimed.runtime_process_ownership_id,
        adoption_count: 1,
        last_adopted_at: "2026-07-15T00:00:01.000Z"
      }
    });
    expect(await store.history(expectedIdentity())).toHaveLength(2);
    expect(terminate).not.toHaveBeenCalled();
  });

  it("never grants ownership for PID reuse, unknown liveness, identity drift, or corrupt metadata", async () => {
    const store = processStore();
    await store.claim(claimInput());

    liveness = "unknown";
    await expect(store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:01.000Z"
    })).resolves.toMatchObject({ status: "blocked", reason: "owner_liveness_unknown" });

    liveness = "alive";
    await expect(store.reconcile({
      expected: {
        ...expectedIdentity(),
        profile_digest: `sha256:${"b".repeat(64)}`
      },
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:02.000Z"
    })).resolves.toMatchObject({ status: "blocked", reason: "identity_mismatch" });

    liveness = "reused";
    await expect(store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:03.000Z"
    })).resolves.toMatchObject({
      status: "vacant",
      previous: { terminal_reason: "pid_reused" }
    });

    const replacement = await store.claim({
      ...claimInput(),
      processId: 202,
      sessionToken: "session-token-b",
      startedAt: "2026-07-15T00:00:04.000Z"
    });
    const [activeFile] = await readdir(path.join(root, "active"));
    if (!activeFile) throw new Error("active ownership file missing");
    const activePath = path.join(root, "active", activeFile);
    const persisted = JSON.parse(await readFile(activePath, "utf8")) as Record<string, unknown>;
    delete persisted.profile_digest;
    await writeFile(activePath, `${JSON.stringify(persisted)}\n`, "utf8");

    await expect(store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:05.000Z"
    })).resolves.toMatchObject({ status: "blocked", reason: "ownership_metadata_invalid" });
    expect(replacement.ownership_status).toBe("active");
    expect(terminate).not.toHaveBeenCalled();
  });

  it("terminates an exact stale owner before replacement and retains terminal evidence", async () => {
    const store = processStore();
    const claimed = await store.claim(claimInput());

    const reconciled = await store.reconcile({
      expected: {
        ...expectedIdentity(),
        runtime_ref: {
          record_kind: "research_preflight_commitment",
          id: "preflight-2"
        }
      },
      mode: "terminate",
      reconciledAt: "2026-07-15T00:00:01.000Z"
    });

    expect(reconciled).toMatchObject({
      status: "terminated",
      ownership: {
        runtime_process_ownership_id: claimed.runtime_process_ownership_id,
        ownership_status: "terminal",
        terminal_reason: "restart_terminated"
      }
    });
    expect(terminate).toHaveBeenCalledWith(claimed);
    expect(await store.history(expectedIdentity())).toEqual(expect.arrayContaining([
      expect.objectContaining({ terminal_reason: "restart_terminated" })
    ]));
  });

  it("waits for the owned process group before closing ownership", async () => {
    const helperPidFile = path.join(root, "stubborn-helper.pid");
    const owner = spawn(process.execPath, ["-e", stubbornProcessGroupScript(helperPidFile)], {
      detached: true,
      stdio: "ignore"
    });
    const ownerPid = owner.pid;
    if (ownerPid === undefined) throw new Error("owned process did not start");
    owner.unref();
    let helperPid: number | undefined;

    try {
      helperPid = Number(await waitForTextFile(helperPidFile, 1_000));
      expect(Number.isInteger(helperPid)).toBe(true);
      const store = new FileSystemRuntimeProcessOwnershipStore(root);
      const claimed = await store.claim({
        ...claimInput(),
        processId: ownerPid
      });

      await store.terminate({
        ownership: claimed,
        terminalReason: "shutdown",
        closedAt: "2026-07-15T00:00:01.000Z"
      });

      expect(isPidAlive(helperPid)).toBe(false);
      await expect(store.active(expectedIdentity())).resolves.toBeUndefined();
    } finally {
      signalForCleanup(-ownerPid);
      if (helperPid !== undefined) signalForCleanup(helperPid);
    }
  });

  it("reaps an orphaned owned process group before retiring the absent owner", async () => {
    const helperPidFile = path.join(root, "orphaned-helper.pid");
    const owner = spawn(process.execPath, ["-e", stubbornProcessGroupScript(helperPidFile)], {
      detached: true,
      stdio: "ignore"
    });
    const ownerPid = owner.pid;
    if (ownerPid === undefined) throw new Error("owned process did not start");
    owner.unref();
    let helperPid: number | undefined;

    try {
      helperPid = Number(await waitForTextFile(helperPidFile, 1_000));
      const store = new FileSystemRuntimeProcessOwnershipStore(root);
      await store.claim({ ...claimInput(), processId: ownerPid });
      process.kill(ownerPid, "SIGTERM");
      await waitForPidExit(ownerPid, 1_000);
      expect(isPidAlive(helperPid)).toBe(true);

      await expect(store.reconcile({
        expected: expectedIdentity(),
        mode: "adopt",
        reconciledAt: "2026-07-15T00:00:01.000Z"
      })).resolves.toMatchObject({
        status: "vacant",
        previous: { terminal_reason: "owner_absent" }
      });

      expect(isPidAlive(helperPid)).toBe(false);
    } finally {
      signalForCleanup(-ownerPid);
      if (helperPid !== undefined) signalForCleanup(helperPid);
    }
  });

  it("captures reconcile time after a queued transition acquires the lock", async () => {
    let releaseFirstInspection: () => void = () => {};
    const firstInspectionGate = new Promise<void>((resolve) => {
      releaseFirstInspection = resolve;
    });
    let markFirstInspectionStarted: () => void = () => {};
    const firstInspectionStarted = new Promise<void>((resolve) => {
      markFirstInspectionStarted = resolve;
    });
    let inspectionCount = 0;
    let lockAcquiredAt = "2026-07-15T00:00:02.000Z";
    const store = new FileSystemRuntimeProcessOwnershipStore(root, {
      inspectOwner: async () => {
        inspectionCount += 1;
        if (inspectionCount === 1) {
          markFirstInspectionStarted();
          await firstInspectionGate;
        }
        return "alive";
      },
      terminateOwner: terminate,
      resolveProcessStartMarker: async () => "process-start-a",
      now: () => lockAcquiredAt
    });
    await store.claim(claimInput());

    const adoption = store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:02.000Z"
    });
    await firstInspectionStarted;
    const termination = store.reconcile({
      expected: expectedIdentity(),
      mode: "terminate",
      reconciledAt: "2026-07-15T00:00:01.000Z"
    });
    lockAcquiredAt = "2026-07-15T00:00:03.000Z";
    releaseFirstInspection();

    await expect(adoption).resolves.toMatchObject({
      status: "adopted",
      ownership: { last_adopted_at: "2026-07-15T00:00:02.000Z" }
    });
    await expect(termination).resolves.toMatchObject({
      status: "terminated",
      ownership: {
        ownership_status: "terminal",
        closed_at: "2026-07-15T00:00:03.000Z",
        terminal_reason: "restart_terminated"
      }
    });
    expect(terminate).toHaveBeenCalledOnce();
    await expect(store.active(expectedIdentity())).resolves.toBeUndefined();
  });

  it("recovers one exact open owner from immutable history when the active pointer is missing", async () => {
    const store = processStore();
    const claimed = await store.claim(claimInput());
    const [activeFile] = await readdir(path.join(root, "active"));
    if (!activeFile) throw new Error("active ownership file missing");
    await rm(path.join(root, "active", activeFile));

    await expect(store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:01.000Z"
    })).resolves.toMatchObject({
      status: "adopted",
      ownership: {
        runtime_process_ownership_id: claimed.runtime_process_ownership_id,
        adoption_count: 1
      }
    });
    expect(await store.history(expectedIdentity())).toHaveLength(2);
  });

  it("rejects a second claim while the first exact owner remains live", async () => {
    const store = processStore();
    await store.claim(claimInput());

    await expect(store.claim({
      ...claimInput(),
      processId: 202,
      sessionToken: "session-token-b"
    })).rejects.toMatchObject({
      code: "runtime_process_ownership_held"
    } satisfies Partial<RuntimeProcessOwnershipStoreError>);
  });

  it("rejects another host before inspecting or retiring its active owner", async () => {
    const store = processStore();
    const claimed = await store.claim(claimInput());
    liveness = "absent";

    await expect(store.claim({
      ...claimInput(),
      expected: { ...expectedIdentity(), host_id: "host-b" },
      processId: 202,
      sessionToken: "session-token-b",
      startedAt: "2026-07-15T00:00:01.000Z"
    })).rejects.toMatchObject({
      code: "runtime_process_ownership_conflict"
    } satisfies Partial<RuntimeProcessOwnershipStoreError>);

    await expect(store.active(expectedIdentity())).resolves.toEqual(claimed);
    expect(terminate).not.toHaveBeenCalled();
  });

  it("does not publish active ownership when claimed history cannot be appended", async () => {
    const store = new FileSystemRuntimeProcessOwnershipStore(root, {
      inspectOwner: async () => "alive",
      terminateOwner: terminate,
      resolveProcessStartMarker: async () => {
        await writeFile(path.join(root, "history"), "not-a-directory", "utf8");
        return "process-start-a";
      }
    });

    await expect(store.claim(claimInput())).rejects.toBeDefined();

    await expect(readFile(activeOwnershipPath(root), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not let stale-lock observers delete a contender's fresh lock", async () => {
    const lockPath = runtimeProcessLockPath(root);
    await mkdir(path.dirname(lockPath), { recursive: true });
    await writeFile(lockPath, `${JSON.stringify({
      process_id: 2_147_483_647,
      process_start_marker: "stale-process",
      token: "stale-token"
    })}\n`, { mode: 0o600 });
    let releaseStaleObserver: () => void = () => {};
    const staleObserverGate = new Promise<void>((resolve) => {
      releaseStaleObserver = resolve;
    });
    let markStaleObserved: () => void = () => {};
    const staleObserved = new Promise<void>((resolve) => {
      markStaleObserved = resolve;
    });
    const laggingStore = new FileSystemRuntimeProcessOwnershipStore(root, {
      inspectOwner: async () => "alive",
      terminateOwner: terminate,
      resolveProcessStartMarker: async () => "process-start-a",
      beforeStaleLockRetirement: async () => {
        markStaleObserved();
        await staleObserverGate;
      },
      lockRetryMs: 1
    });
    let releaseFreshOwner: () => void = () => {};
    const freshOwnerGate = new Promise<void>((resolve) => {
      releaseFreshOwner = resolve;
    });
    let markFreshOwnerStarted: () => void = () => {};
    const freshOwnerStarted = new Promise<void>((resolve) => {
      markFreshOwnerStarted = resolve;
    });
    const freshStore = new FileSystemRuntimeProcessOwnershipStore(root, {
      inspectOwner: async () => "alive",
      terminateOwner: terminate,
      resolveProcessStartMarker: async () => {
        markFreshOwnerStarted();
        await freshOwnerGate;
        return "process-start-a";
      },
      lockRetryMs: 1
    });

    const laggingClaim = laggingStore.claim(claimInput());
    await staleObserved;
    const freshClaim = freshStore.claim(claimInput());
    await freshOwnerStarted;
    releaseStaleObserver();
    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseFreshOwner();
    const [laggingResult, freshResult] = await Promise.allSettled([laggingClaim, freshClaim]);

    expect(freshResult.status).toBe("fulfilled");
    expect(laggingResult.status).toBe("rejected");
    await expect(freshStore.active(expectedIdentity())).resolves.toMatchObject({
      ownership_status: "active",
      session_token: "session-token-a"
    });
  });

  it("finishes a terminal transition idempotently after a crash before active cleanup", async () => {
    const store = processStore();
    const claimed = await store.claim(claimInput());
    const [activeFile] = await readdir(path.join(root, "active"));
    if (!activeFile) throw new Error("active ownership file missing");
    const activePath = path.join(root, "active", activeFile);
    const activeBytes = await readFile(activePath);
    const terminal = await store.close({
      ownership: claimed,
      terminalReason: "owner_absent",
      closedAt: "2026-07-15T00:00:01.000Z"
    });
    await writeFile(activePath, activeBytes, { mode: 0o600 });
    liveness = "absent";

    await expect(store.reconcile({
      expected: expectedIdentity(),
      mode: "adopt",
      reconciledAt: "2026-07-15T00:00:02.000Z"
    })).resolves.toEqual({ status: "vacant", previous: terminal });
    expect(await store.active(expectedIdentity())).toBeUndefined();
    expect(await store.history(expectedIdentity())).toHaveLength(2);
  });

  function processStore() {
    return new FileSystemRuntimeProcessOwnershipStore(root, {
      inspectOwner: async (_ownership: RuntimeProcessOwnershipRecord) => liveness,
      terminateOwner: terminate,
      resolveProcessStartMarker: async (processId) =>
        processId === 101 ? "process-start-a" : "process-start-b",
      now: () => "2026-07-15T00:00:00.000Z"
    });
  }
});

function expectedIdentity() {
  return {
    process_kind: "research_provider" as const,
    subject_ref: { record_kind: "research_worker", id: "worker-1" },
    runtime_ref: {
      record_kind: "research_preflight_commitment",
      id: "preflight-1"
    },
    host_id: "host-a",
    executable: "/usr/local/bin/codex",
    profile_digest: `sha256:${"a".repeat(64)}`
  };
}

function stubbornProcessGroupScript(helperPidFile: string): string {
  const helperSource = [
    'const fs = require("node:fs");',
    'process.on("SIGTERM", () => {});',
    `fs.writeFileSync(${JSON.stringify(helperPidFile)}, String(process.pid));`,
    "setInterval(() => {}, 1_000);"
  ].join("\n");
  return [
    'const { spawn } = require("node:child_process");',
    `spawn(process.execPath, ["-e", ${JSON.stringify(helperSource)}], { stdio: "ignore" });`,
    'process.on("SIGTERM", () => process.exit(0));',
    "setInterval(() => {}, 1_000);"
  ].join("\n");
}

async function waitForTextFile(filePath: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await readFile(filePath, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${filePath}`);
}

async function waitForPidExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for pid ${pid}`);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function signalForCleanup(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function claimInput() {
  return {
    expected: expectedIdentity(),
    processId: 101,
    sessionToken: "session-token-a",
    startedAt: "2026-07-15T00:00:00.000Z"
  };
}

function runtimeProcessScopeKey(): string {
  return createHash("sha256").update([
    expectedIdentity().process_kind,
    expectedIdentity().subject_ref.record_kind,
    expectedIdentity().subject_ref.id
  ].join(":")).digest("hex");
}

function activeOwnershipPath(root: string): string {
  return path.join(root, "active", `${runtimeProcessScopeKey()}.json`);
}

function runtimeProcessLockPath(root: string): string {
  return path.join(root, "locks", `${runtimeProcessScopeKey()}.lock`);
}
