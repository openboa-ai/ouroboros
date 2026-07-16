import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FileSystemRuntimeSupervisorCheckpointStore,
  RuntimeSupervisorCheckpointStoreError
} from "../src/runtime-supervisor-checkpoint-store";

describe("FileSystemRuntimeSupervisorCheckpointStore", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map(async (root) => {
      const { rm } = await import("node:fs/promises");
      await rm(root, { recursive: true, force: true });
    }));
  });

  it("appends one immutable chain and reconstructs the latest checkpoint", async () => {
    const root = await temporaryRoot();
    const store = new FileSystemRuntimeSupervisorCheckpointStore(root);

    const recovering = await store.append(checkpoint("recovering"));
    const running = await store.append(
      checkpoint("running", "2026-07-16T00:00:01.000Z"),
      recovering.checkpoint_digest
    );

    expect(recovering).toMatchObject({
      record_kind: "runtime_supervisor_checkpoint",
      version: 1,
      sequence: 1,
      status: "recovering"
    });
    expect(running).toMatchObject({
      sequence: 2,
      previous_checkpoint_digest: recovering.checkpoint_digest,
      status: "running"
    });
    expect(running.checkpoint_digest).not.toBe(recovering.checkpoint_digest);
    expect(await new FileSystemRuntimeSupervisorCheckpointStore(root).latest())
      .toEqual(running);
    expect(await store.history()).toEqual([recovering, running]);
  });

  it("rejects a stale predecessor without publishing another checkpoint", async () => {
    const root = await temporaryRoot();
    const store = new FileSystemRuntimeSupervisorCheckpointStore(root);
    await store.append(checkpoint("recovering"));

    await expect(store.append(
      checkpoint("degraded", "2026-07-16T00:00:01.000Z"),
      digest("stale")
    )).rejects.toMatchObject({
      code: "runtime_supervisor_checkpoint_predecessor_conflict"
    });
    expect(await store.history()).toHaveLength(1);
  });

  it("fails closed when checkpoint bytes are corrupted", async () => {
    const root = await temporaryRoot();
    const store = new FileSystemRuntimeSupervisorCheckpointStore(root);
    await store.append(checkpoint("running"));
    const directory = path.join(root, "runtime-supervisor", "checkpoints");
    const [file] = await readdir(directory);
    await writeFile(path.join(directory, file!), "{\"status\":\"running\"}\n", "utf8");

    await expect(store.latest()).rejects.toBeInstanceOf(
      RuntimeSupervisorCheckpointStoreError
    );
    await expect(store.latest()).rejects.toMatchObject({
      code: "runtime_supervisor_checkpoint_metadata_invalid"
    });
  });

  it("does not let a dead writer lock block restart publication", async () => {
    const root = await temporaryRoot();
    await mkdir(
      path.join(root, "runtime-supervisor", "append.lock"),
      { recursive: true }
    );
    const store = new FileSystemRuntimeSupervisorCheckpointStore(root);

    await expect(store.append(checkpoint("running"))).resolves.toMatchObject({
      sequence: 1,
      status: "running"
    });
  });

  it("allows only one canonical sequence winner when writers race", async () => {
    const root = await temporaryRoot();
    const writers = [
      new FileSystemRuntimeSupervisorCheckpointStore(root),
      new FileSystemRuntimeSupervisorCheckpointStore(root)
    ];

    const results = await Promise.allSettled([
      writers[0]!.append(checkpoint("running")),
      writers[1]!.append(checkpoint("degraded"))
    ]);

    expect(results.filter((result) => result.status === "fulfilled"))
      .toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected"))
      .toHaveLength(1);
    expect(await writers[0]!.history()).toHaveLength(1);
  });

  async function temporaryRoot(): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouro-runtime-supervisor-store-"));
    roots.push(root);
    return root;
  }
});

function checkpoint(
  status: "recovering" | "running" | "degraded" | "blocked" | "stopped",
  recordedAt = "2026-07-16T00:00:00.000Z"
) {
  return {
    status,
    lanes: [
      lane("selected_paper", status),
      lane("candidate_arena", status),
      lane("research_control_study_scheduler", status)
    ],
    recorded_at: recordedAt
  } as const;
}

function lane(
  laneName:
    | "selected_paper"
    | "candidate_arena"
    | "research_control_study_scheduler",
  status: "recovering" | "running" | "degraded" | "blocked" | "stopped"
) {
  return {
    lane: laneName,
    desired: true,
    status,
    basis_digest: digest(`${laneName}-basis`),
    progress_digest: digest(`${laneName}-progress`),
    attempt_count: status === "degraded" || status === "blocked" ? 1 : 0,
    no_progress_count: status === "degraded" || status === "blocked" ? 1 : 0,
    ...(status === "degraded"
      ? { next_retry_at: "2026-07-16T00:00:05.000Z", reason_code: "transient" }
      : {}),
    ...(status === "blocked" ? { reason_code: "retry_exhausted" } : {})
  } as const;
}

function digest(value: string): string {
  return `sha256:${Buffer.from(value).toString("hex").padEnd(64, "0").slice(0, 64)}`;
}
