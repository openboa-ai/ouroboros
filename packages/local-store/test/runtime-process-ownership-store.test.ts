import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
        processId === 101 ? "process-start-a" : "process-start-b"
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

function claimInput() {
  return {
    expected: expectedIdentity(),
    processId: 101,
    sessionToken: "session-token-a",
    startedAt: "2026-07-15T00:00:00.000Z"
  };
}
