import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as processStartMarkerModule from "../src/process-start-marker";
import {
  ResearchOperationsProjectionService,
  materializeResearchOperationsProjectionCapsuleTrie,
  researchOperationsProjectionCapsuleHasIntegrity,
  researchOperationsProjectionCapsuleTrieDigest,
  researchOperationsProjectionCapsuleRouteHash
} from "@ouroboros/application";
import { ResearchOperationsProjectionCompatibilityError } from
  "@ouroboros/application/ports/store";
import type {
  CandidateArenaEvidenceProjection,
  ResearchOperationsProjectionCapsule,
  ResearchOperationsProjectionCapsuleTrieNode,
  ResearchOperationsProjectionIndexRecord
} from "@ouroboros/application/ports/store";
import { decideResearchMemoryControlStudy } from
  "../../application/src/candidate/research-memory-control-study";
import { researchWorkItemId } from
  "../../application/src/candidate/research-work-item";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  canonicalResearchEvidenceArtifactSummary,
  decideCandidateAdmission,
  paperTradingHandoffConformanceDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  researchEvidenceArtifactDigestInput,
  researchPreflightCommitmentDigestInput,
  researchWorkerCheckpointDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ExperimentRunRecord,
  type ArtifactLineageRecord,
  type PaperTradingHandoffConformanceRecord,
  type ResearchDirectionRecord,
  type ResearchEvidenceArtifactRecord,
  type ResearchFindingRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchSessionDetailReadModel,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

type OracleCase =
  | "admitted"
  | "duplicate"
  | "quarantined"
  | "finished_without_submission"
  | "execution_failed"
  | "restart_recovery";

describe("LocalStore ResearchOperationsProjectionService oracle", () => {
  it("publishes one sanitized bounded capsule per session", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-capsule-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await store.runResearchOperationsProjectionBatch(() =>
        persistBaseGraph(store, "sanitized-capsule")
      );
      const workItemId = researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const capsulePath = path.join(
        root,
        "read-models",
        "research-operations",
        "items",
        `${encodeURIComponent(workItemId)}.json`
      );
      const indexPath = path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      );
      const [capsule, index] = await Promise.all([
        readFile(capsulePath, "utf8"),
        readFile(indexPath, "utf8")
      ]);

      expect(Buffer.byteLength(capsule, "utf8")).toBeLessThanOrEqual(256 * 1024);
      expect(Buffer.byteLength(index, "utf8")).toBeLessThanOrEqual(256 * 1024);
      for (const privateValue of [
        "artifact_path",
        "entrypoint",
        "workspace_key",
        `/tmp/${graph.source.system_code_id}.py`,
        graph.worker.workspace_key!
      ]) {
        expect(capsule).not.toContain(privateValue);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("coalesces a logical Research graph mutation into one projection publish", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-batch-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const materialize = vi.spyOn(
        ResearchOperationsProjectionService.prototype,
        "materializeProjection"
      );

      await store.runResearchOperationsProjectionBatch(() =>
        persistBaseGraph(store, "batched-graph")
      );

      expect(materialize).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("caches the exact writeJson bytes when the caller mutates during the publication-lock wait", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-write-snapshot-"
    ));
    let heldLock: unknown;
    let restartedReader: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const privateStore = store as unknown as {
        acquireResearchOperationsProjectionPublicationLock(): Promise<unknown>;
        releaseResearchOperationsProjectionPublicationLock(
          owner: unknown
        ): Promise<void>;
        writeJson(filePath: string, value: unknown): Promise<void>;
        cachedResearchOperationsProjectionRecords<T>(
          collection: string
        ): T[];
      };
      const finding = standaloneFinding(
        "canonical-write-snapshot",
        "2026-07-29T00:00:00.000Z"
      ) as ResearchFindingRecord & { omitted_projection_note?: string };
      finding.omitted_projection_note = undefined;
      const initialSummary = finding.summary;
      const serializedSnapshot = `${JSON.stringify(finding, null, 2)}\n`;
      const expectedSnapshot = JSON.parse(
        serializedSnapshot
      ) as ResearchFindingRecord;
      const findingPath = path.join(
        root,
        "research-findings",
        "items",
        `${encodeURIComponent(finding.research_finding_id)}.json`
      );

      heldLock = await privateStore
        .acquireResearchOperationsProjectionPublicationLock();
      const write = privateStore.writeJson(findingPath, finding);
      await waitForCurrentProcessProjectionLockClaim(root);
      finding.summary = "Caller mutation must not enter the published snapshot.";
      await privateStore.releaseResearchOperationsProjectionPublicationLock(
        heldLock
      );
      heldLock = undefined;
      await write;

      expect(await readFile(findingPath, "utf8")).toBe(serializedSnapshot);
      const cached = privateStore
        .cachedResearchOperationsProjectionRecords<ResearchFindingRecord>(
          "research-findings"
        );
      const cachedFinding = cached.find((candidate) =>
        candidate.research_finding_id === finding.research_finding_id
      );
      expect(cachedFinding).toStrictEqual(expectedSnapshot);
      expect(cachedFinding?.summary).toBe(initialSummary);
      expect(Object.keys(cachedFinding ?? {})).not.toContain(
        "omitted_projection_note"
      );

      const restartedResultPath = path.join(root, "restarted-write-cache.json");
      restartedReader = spawnProjectionSourceCacheReader({
        root,
        collection: "research-findings",
        resultPath: restartedResultPath
      });
      await waitForChild(restartedReader);
      const restartedCache = await readJsonFile<ResearchFindingRecord[]>(
        restartedResultPath
      );
      expect(restartedCache.find((candidate) =>
        candidate.research_finding_id === finding.research_finding_id
      )).toStrictEqual(cachedFinding);
    } finally {
      if (heldLock !== undefined) {
        await (new LocalStore(root) as unknown as {
          releaseResearchOperationsProjectionPublicationLock(
            owner: unknown
          ): Promise<void>;
        }).releaseResearchOperationsProjectionPublicationLock(heldLock);
      }
      restartedReader?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("caches the exact create-only bytes when the caller mutates during the publication-lock wait", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-create-only-snapshot-"
    ));
    let heldLock: unknown;
    let restartedReader: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const privateStore = store as unknown as {
        acquireResearchOperationsProjectionPublicationLock(): Promise<unknown>;
        releaseResearchOperationsProjectionPublicationLock(
          owner: unknown
        ): Promise<void>;
        writeJsonCreateOnly(
          filePath: string,
          value: unknown
        ): Promise<"created" | "exists">;
        cachedResearchOperationsProjectionRecords<T>(
          collection: string
        ): T[];
      };
      const source = systemCode(
        "canonical-create-only-snapshot",
        digest("canonical-create-only-snapshot"),
        "2026-07-29T00:00:00.000Z"
      ) as SystemCodeRecord & { omitted_projection_note?: string };
      if (source.artifact_kind !== "python_file") {
        throw new Error("canonical_create_only_snapshot_must_be_python");
      }
      source.omitted_projection_note = undefined;
      const initialArtifactPath = source.artifact_path;
      const serializedSnapshot = `${JSON.stringify(source, null, 2)}\n`;
      const expectedSnapshot = JSON.parse(
        serializedSnapshot
      ) as SystemCodeRecord;
      const sourcePath = path.join(
        root,
        "system-codes",
        "items",
        `${encodeURIComponent(source.system_code_id)}.json`
      );

      heldLock = await privateStore
        .acquireResearchOperationsProjectionPublicationLock();
      const write = privateStore.writeJsonCreateOnly(sourcePath, source);
      await waitForCurrentProcessProjectionLockClaim(root);
      source.artifact_path = "/tmp/caller-mutation-must-not-persist.py";
      await privateStore.releaseResearchOperationsProjectionPublicationLock(
        heldLock
      );
      heldLock = undefined;
      await expect(write).resolves.toBe("created");

      expect(await readFile(sourcePath, "utf8")).toBe(serializedSnapshot);
      const cached = privateStore
        .cachedResearchOperationsProjectionRecords<SystemCodeRecord>(
          "system-codes"
        );
      const cachedSource = cached.find((candidate) =>
        candidate.system_code_id === source.system_code_id
      );
      expect(cachedSource).toStrictEqual(expectedSnapshot);
      if (cachedSource?.artifact_kind !== "python_file") {
        throw new Error("cached_create_only_snapshot_must_be_python");
      }
      expect(cachedSource.artifact_path).toBe(initialArtifactPath);
      expect(Object.keys(cachedSource ?? {})).not.toContain(
        "omitted_projection_note"
      );

      const restartedResultPath = path.join(
        root,
        "restarted-create-only-cache.json"
      );
      restartedReader = spawnProjectionSourceCacheReader({
        root,
        collection: "system-codes",
        resultPath: restartedResultPath
      });
      await waitForChild(restartedReader);
      const restartedCache = await readJsonFile<SystemCodeRecord[]>(
        restartedResultPath
      );
      expect(restartedCache.find((candidate) =>
        candidate.system_code_id === source.system_code_id
      )).toStrictEqual(cachedSource);
    } finally {
      if (heldLock !== undefined) {
        await (new LocalStore(root) as unknown as {
          releaseResearchOperationsProjectionPublicationLock(
            owner: unknown
          ): Promise<void>;
        }).releaseResearchOperationsProjectionPublicationLock(heldLock);
      }
      restartedReader?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("drains a live detached source operation before releasing the projection lock", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-live-descendant-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const finding = standaloneFinding(
        "live-detached-source",
        "2026-07-29T00:00:00.000Z"
      );
      const findingPath = path.join(
        root,
        "research-findings",
        "items",
        `${encodeURIComponent(finding.research_finding_id)}.json`
      );
      const privateStore = store as unknown as {
        captureResearchOperationsProjectionSourceSnapshot(
          filePath: string
        ): Promise<void>;
        releaseResearchOperationsProjectionPublicationLock(
          owner: unknown
        ): Promise<void>;
      };
      const captureSnapshot = privateStore
        .captureResearchOperationsProjectionSourceSnapshot.bind(store);
      const releaseProjectionLock = privateStore
        .releaseResearchOperationsProjectionPublicationLock.bind(store);
      let sourceSnapshotEntered!: () => void;
      const sourceSnapshotEnteredGate = new Promise<void>((resolve) => {
        sourceSnapshotEntered = resolve;
      });
      let releaseSourceSnapshot!: () => void;
      const sourceSnapshotGate = new Promise<void>((resolve) => {
        releaseSourceSnapshot = resolve;
      });
      let lockReleaseStarted!: () => void;
      const lockReleaseStartedGate = new Promise<void>((resolve) => {
        lockReleaseStarted = resolve;
      });
      let gateSnapshot = true;
      vi.spyOn(
        privateStore,
        "captureResearchOperationsProjectionSourceSnapshot"
      ).mockImplementation(async (filePath) => {
        await captureSnapshot(filePath);
        if (gateSnapshot && filePath === findingPath) {
          gateSnapshot = false;
          sourceSnapshotEntered();
          await sourceSnapshotGate;
        }
      });
      vi.spyOn(
        privateStore,
        "releaseResearchOperationsProjectionPublicationLock"
      ).mockImplementation(async (owner) => {
        lockReleaseStarted();
        await releaseProjectionLock(owner);
      });
      let detachedWrite!: Promise<ResearchFindingRecord>;

      const batch = store.runResearchOperationsProjectionBatch(async () => {
        detachedWrite = store.recordResearchFinding(finding);
        void detachedWrite.catch(() => undefined);
        await sourceSnapshotEnteredGate;
      });
      await sourceSnapshotEnteredGate;

      const releasedBeforeDescendant = await Promise.race([
        lockReleaseStartedGate.then(() => true),
        new Promise<false>((resolve) => setImmediate(() => resolve(false)))
      ]);
      expect(releasedBeforeDescendant).toBe(false);

      releaseSourceSnapshot();
      await expect(Promise.all([batch, detachedWrite])).resolves.toEqual([
        undefined,
        finding
      ]);
      await expect(readJsonFile<ResearchFindingRecord>(findingPath)).resolves
        .toEqual(finding);
      await expect(stoppedService(store).readOperations()).resolves.toMatchObject({
        availability: "available",
        recorded_session_count: 0
      });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("queues a stale descendant that starts after its batch scope closes", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-closed-descendant-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const first = allocationFixture("closed-descendant-first");
      const stale = allocationFixture("closed-descendant-stale");
      const stalePath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          stale.candidate_arena_research_allocation_id
        )}.json`
      );
      const privateStore = store as unknown as {
        captureResearchOperationsProjectionSourceSnapshot(
          filePath: string
        ): Promise<void>;
        flushResearchOperationsProjection(): Promise<void>;
      };
      const captureSnapshot = privateStore
        .captureResearchOperationsProjectionSourceSnapshot.bind(store);
      const flushProjection = privateStore
        .flushResearchOperationsProjection.bind(store);
      let staleSourceEntered!: () => void;
      const staleSourceEnteredGate = new Promise<void>((resolve) => {
        staleSourceEntered = resolve;
      });
      vi.spyOn(
        privateStore,
        "captureResearchOperationsProjectionSourceSnapshot"
      ).mockImplementation(async (filePath) => {
        if (filePath === stalePath) staleSourceEntered();
        await captureSnapshot(filePath);
      });
      let flushEntered!: () => void;
      const flushEnteredGate = new Promise<void>((resolve) => {
        flushEntered = resolve;
      });
      let releaseFlush!: () => void;
      const flushGate = new Promise<void>((resolve) => {
        releaseFlush = resolve;
      });
      let gateFlush = true;
      vi.spyOn(
        privateStore,
        "flushResearchOperationsProjection"
      ).mockImplementation(async () => {
        if (gateFlush) {
          gateFlush = false;
          flushEntered();
          await flushGate;
        }
        await flushProjection();
      });
      let startStale!: () => void;
      const staleStartGate = new Promise<void>((resolve) => {
        startStale = resolve;
      });
      let staleWrite!: Promise<CandidateArenaResearchAllocationRecord>;

      const batch = store.runResearchOperationsProjectionBatch(async () => {
        await store.recordCandidateArenaResearchAllocation(first);
        staleWrite = staleStartGate.then(() =>
          store.recordCandidateArenaResearchAllocation(stale)
        );
        void staleWrite.catch(() => undefined);
      });
      await flushEnteredGate;
      startStale();

      const enteredBeforeClosedBatchReleased = await Promise.race([
        staleSourceEnteredGate.then(() => true),
        new Promise<false>((resolve) => setImmediate(() => resolve(false)))
      ]);
      expect(enteredBeforeClosedBatchReleased).toBe(false);

      releaseFlush();
      await expect(Promise.all([batch, staleWrite])).resolves.toEqual([
        undefined,
        stale
      ]);
      await expect(stoppedService(store).readOperations()).resolves.toMatchObject({
        availability: "available",
        recorded_session_count: 2,
        projected_session_count: 2
      });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("aggregates independent task and live detached descendant failures", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-descendant-failures-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const invalidFinding = {
        ...standaloneFinding(
          "invalid-live-descendant",
          "2026-07-29T00:00:00.000Z"
        ),
        version: 2
      } as unknown as ResearchFindingRecord;
      const taskFailure = new Error("outer_batch_task_failed");
      let detachedFailure!: Promise<ResearchFindingRecord>;
      let caught: unknown;

      try {
        await store.runResearchOperationsProjectionBatch(async () => {
          detachedFailure = store.recordResearchFinding(invalidFinding);
          void detachedFailure.catch(() => undefined);
          throw taskFailure;
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      const failures = (caught as AggregateError).errors;
      expect(failures).toContain(taskFailure);
      expect(failures).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "invalid_research_finding_input" })
      ]));
      await expect(detachedFailure).rejects.toMatchObject({
        code: "invalid_research_finding_input"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls back a source after a projection publish failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-replay-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const allocation = allocationFixture("projection-replay");
      const privateStore = store as unknown as {
        writeJson(filePath: string, value: unknown): Promise<void>;
      };
      const originalWriteJson = privateStore.writeJson.bind(store);
      const writeJson = vi.spyOn(privateStore, "writeJson");
      let failIndexOnce = true;
      writeJson.mockImplementation(async (filePath, value) => {
        if (failIndexOnce && filePath === path.join(
          root,
          "read-models",
          "research-operations",
          "index.json"
        )) {
          failIndexOnce = false;
          throw new Error("projection_index_publish_failed");
        }
        await originalWriteJson(filePath, value);
      });

      await expect(store.runResearchOperationsProjectionBatch(() =>
        store.recordCandidateArenaResearchAllocation(allocation)
      )).rejects.toThrow("projection_index_publish_failed");
      await expect(stoppedService(store).readOperations()).resolves.toMatchObject({
        availability: "available",
        recorded_session_count: 0
      });
      await expect(readFile(path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          allocation.candidate_arena_research_allocation_id
        )}.json`
      ), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      writeJson.mockRestore();
      await expect(store.runResearchOperationsProjectionBatch(() =>
        store.recordCandidateArenaResearchAllocation(allocation)
      )).resolves.toEqual(allocation);
      await expect(stoppedService(store).readOperations()).resolves.toMatchObject({
        recorded_session_count: 1,
        projected_session_count: 1
      });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves a published source when the caller fails after projection publication", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-post-publish-failure-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const allocation = allocationFixture("post-publish-failure");

      await expect(store.runResearchOperationsProjectionBatch(async () => {
        await store.recordCandidateArenaResearchAllocation(allocation);
        throw new Error("caller_failed_after_source_write");
      })).rejects.toThrow("caller_failed_after_source_write");

      await expect(store.getCandidateArenaResearchAllocation(
        allocation.candidate_arena_research_allocation_id
      )).resolves.toEqual(allocation);
      await expect(stoppedService(store).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 1,
          projected_session_count: 1
        });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls back an acknowledged source rename and cold-initializes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-source-fail-"));
    let failCommittedWrite = false;
    const store = new LocalStore(root, {
      writeTransaction: {
        run: async (write) => {
          const result = await write();
          if (failCommittedWrite) {
            failCommittedWrite = false;
            throw new Error("source_transaction_failed_after_rename");
          }
          return result;
        }
      }
    });
    let initializer: ChildProcess | undefined;
    try {
      await store.initialize();
      const allocation = allocationFixture("source-fail-replay");
      failCommittedWrite = true;

      await expect(store.recordCandidateArenaResearchAllocation(allocation))
        .rejects.toThrow("source_transaction_failed_after_rename");
      await expect(readFile(path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          allocation.candidate_arena_research_allocation_id
        )}.json`
      ), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stoppedService(store).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 0
        });

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);

      await expect(store.recordCandidateArenaResearchAllocation(allocation))
        .resolves.toEqual(allocation);
      await expect(stoppedService(store).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 1
        });
    } finally {
      initializer?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps projection write-through active across same-root transaction wrappers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-transaction-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const guarded = store.withWriteTransaction({
        run: (write) => write()
      });

      const graph = await persistBaseGraph(guarded, "transaction-wrapper");

      await expect(stoppedService(store).readOperations()).resolves.toMatchObject({
        recorded_session_count: 1,
        projected_session_count: 1,
        sessions: [expect.objectContaining({
          research_allocation_id:
            graph.allocation.candidate_arena_research_allocation_id
        })]
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes overlapping same-root batches until each projection is readable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-overlap-"));
    try {
      const firstStore = new LocalStore(root);
      await firstStore.initialize();
      const secondStore = firstStore.withWriteTransaction({
        run: (write) => write()
      });
      let releaseFirst!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let firstWritten!: () => void;
      const firstWrittenGate = new Promise<void>((resolve) => {
        firstWritten = resolve;
      });
      let releaseSecond!: () => void;
      const secondGate = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      let secondStarted!: () => void;
      const secondStartedGate = new Promise<void>((resolve) => {
        secondStarted = resolve;
      });
      let secondTaskStarted = false;

      const firstBatch = firstStore.runResearchOperationsProjectionBatch(
        async () => {
          await firstStore.recordCandidateArenaResearchAllocation(
            allocationFixture("overlap-first")
          );
          firstWritten();
          await firstGate;
        }
      );
      await firstWrittenGate;
      const secondBatch = secondStore.runResearchOperationsProjectionBatch(
        async () => {
          secondTaskStarted = true;
          secondStarted();
          await secondGate;
          await secondStore.recordCandidateArenaResearchAllocation(
            allocationFixture("overlap-second")
          );
        }
      );
      await Promise.resolve();
      expect(secondTaskStarted).toBe(false);

      releaseFirst();
      await firstBatch;
      await expect(stoppedService(firstStore).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 1 });

      await secondStartedGate;
      releaseSecond();
      await secondBatch;
      await expect(stoppedService(secondStore).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 2 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("waits for an active projection batch before reading CandidateArena evidence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-arena-read-wait-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      let releaseBatch!: () => void;
      const batchGate = new Promise<void>((resolve) => {
        releaseBatch = resolve;
      });
      let sourceWritten!: () => void;
      const sourceWrittenGate = new Promise<void>((resolve) => {
        sourceWritten = resolve;
      });

      const batch = store.runResearchOperationsProjectionBatch(async () => {
        await store.recordCandidateArenaResearchAllocation(
          allocationFixture("arena-read-wait")
        );
        sourceWritten();
        await batchGate;
      });
      await sourceWrittenGate;

      let settled = false;
      const read = store.readCandidateArenaEvidenceProjection().then((value) => {
        settled = true;
        return value;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      releaseBatch();
      await batch;
      await expect(read).resolves.toMatchObject({
        availability: "available"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not treat a detached stale batch context as the active batch owner", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-arena-stale-batch-read-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      let releaseDetachedRead!: () => void;
      const detachedReadGate = new Promise<void>((resolve) => {
        releaseDetachedRead = resolve;
      });
      let detachedRead!: Promise<
        | { status: "fulfilled"; value: CandidateArenaEvidenceProjection }
        | { status: "rejected"; reason: unknown }
      >;

      await store.runResearchOperationsProjectionBatch(async () => {
        detachedRead = detachedReadGate.then(() =>
          store.readCandidateArenaEvidenceProjection()
        ).then(
          (value) => ({ status: "fulfilled" as const, value }),
          (reason) => ({ status: "rejected" as const, reason })
        );
      });

      let releaseSecondBatch!: () => void;
      const secondBatchGate = new Promise<void>((resolve) => {
        releaseSecondBatch = resolve;
      });
      let secondSourceWritten!: () => void;
      const secondSourceWrittenGate = new Promise<void>((resolve) => {
        secondSourceWritten = resolve;
      });
      const secondBatch = store.runResearchOperationsProjectionBatch(
        async () => {
          await store.recordCandidateArenaResearchAllocation(
            allocationFixture("stale-batch-read")
          );
          secondSourceWritten();
          await secondBatchGate;
        }
      );
      await secondSourceWrittenGate;

      let detachedReadSettled = false;
      void detachedRead.then(() => {
        detachedReadSettled = true;
      });
      releaseDetachedRead();
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
      expect(detachedReadSettled).toBe(false);

      releaseSecondBatch();
      await secondBatch;
      await expect(detachedRead).resolves.toMatchObject({
        status: "fulfilled",
        value: { availability: "available" }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps comparison writers and projection batches in one lock order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-lock-order-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const privateStore = store as unknown as {
        withComparisonEvidenceWriteTransaction<T>(
          task: () => Promise<T>
        ): Promise<T>;
      };
      let directStarted!: () => void;
      const directStartedGate = new Promise<void>((resolve) => {
        directStarted = resolve;
      });
      let releaseDirect!: () => void;
      const directGate = new Promise<void>((resolve) => {
        releaseDirect = resolve;
      });
      let batchStarted!: () => void;
      const batchStartedGate = new Promise<void>((resolve) => {
        batchStarted = resolve;
      });

      const directWrite = privateStore.withComparisonEvidenceWriteTransaction(
        async () => {
          directStarted();
          await directGate;
          await store.recordCandidateArenaResearchAllocation(
            allocationFixture("lock-order-direct")
          );
        }
      );
      await directStartedGate;
      const batchWrite = store.runResearchOperationsProjectionBatch(async () => {
        batchStarted();
        await privateStore.withComparisonEvidenceWriteTransaction(async () => {
          await store.recordCandidateArenaResearchAllocation(
            allocationFixture("lock-order-batch")
          );
        });
      });

      await Promise.race([
        batchStartedGate,
        new Promise<void>((resolve) => setTimeout(resolve, 75))
      ]);
      releaseDirect();

      await expect(withTimeout(
        Promise.all([directWrite, batchWrite]),
        1_000,
        "comparison_projection_lock_order_deadlock"
      )).resolves.toBeDefined();
      await expect(stoppedService(store).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 2 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps same-root transaction wrappers in the shared lock order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-wrapper-order-"));
    try {
      const batchStore = new LocalStore(root);
      await batchStore.initialize();
      const directStore = batchStore.withWriteTransaction({
        run: (write) => write()
      });
      const privateDirectStore = directStore as unknown as {
        withComparisonEvidenceWriteTransaction<T>(
          task: () => Promise<T>
        ): Promise<T>;
      };
      let directStarted!: () => void;
      const directStartedGate = new Promise<void>((resolve) => {
        directStarted = resolve;
      });
      let releaseDirect!: () => void;
      const directGate = new Promise<void>((resolve) => {
        releaseDirect = resolve;
      });
      let batchStarted!: () => void;
      const batchStartedGate = new Promise<void>((resolve) => {
        batchStarted = resolve;
      });

      const directWrite = privateDirectStore
        .withComparisonEvidenceWriteTransaction(async () => {
          directStarted();
          await directGate;
          await directStore.recordCandidateArenaResearchAllocation(
            allocationFixture("wrapper-order-direct")
          );
        });
      await directStartedGate;
      const batchWrite = batchStore.runResearchOperationsProjectionBatch(
        async () => {
          batchStarted();
          await privateDirectStore.withComparisonEvidenceWriteTransaction(
            async () => {
              await directStore.recordCandidateArenaResearchAllocation(
                allocationFixture("wrapper-order-batch")
              );
            }
          );
        }
      );

      await Promise.race([
        batchStartedGate,
        new Promise<void>((resolve) => setTimeout(resolve, 75))
      ]);
      releaseDirect();

      await expect(withTimeout(
        Promise.all([directWrite, batchWrite]),
        1_000,
        "same_root_wrapper_lock_order_deadlock"
      )).resolves.toBeDefined();
      await expect(stoppedService(batchStore).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 2 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deduplicates source cache entries across relative and absolute root aliases", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-alias-"));
    const relativeRoot = path.relative(process.cwd(), root);
    try {
      const relativeStore = new LocalStore(relativeRoot);
      await relativeStore.initialize();
      const allocation = allocationFixture("root-alias");
      await relativeStore.recordCandidateArenaResearchAllocation(allocation);

      const absoluteStore = new LocalStore(root);
      await absoluteStore.recordCandidateArenaResearchAllocation(allocation);

      await expect(stoppedService(absoluteStore).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 1,
          projected_session_count: 1
        });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes stale initialized writers across processes before index publication", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-process-"));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-process-control-"
    ));
    const childReady = path.join(controlRoot, "child-ready");
    const childStart = path.join(controlRoot, "child-start");
    const childSourceWritten = path.join(controlRoot, "child-source-written");
    const childRelease = path.join(controlRoot, "child-release");
    let child: ChildProcess | undefined;
    try {
      const parentStore = new LocalStore(root);
      await parentStore.initialize();
      const childAllocation = allocationFixture("process-child");
      const parentAllocation = allocationFixture("process-parent");
      child = spawnProjectionWriter({
        root,
        allocation: childAllocation,
        readyPath: childReady,
        startPath: childStart,
        sourceWrittenPath: childSourceWritten,
        releasePath: childRelease
      });
      await waitForFile(childReady, child);
      await writeFile(childStart, "start\n", "utf8");
      await waitForFile(childSourceWritten, child);

      let parentSettled = false;
      const parentWrite = parentStore
        .recordCandidateArenaResearchAllocation(parentAllocation)
        .then((value) => {
          parentSettled = true;
          return value;
        });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const settledWhileChildHeldPublication = parentSettled;

      await writeFile(childRelease, "release\n", "utf8");
      await Promise.all([parentWrite, waitForChild(child)]);
      const index = JSON.parse(await readFile(path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      ), "utf8")) as { recorded_session_count: number };

      expect(settledWhileChildHeldPublication).toBe(false);
      expect(index.recorded_session_count).toBe(2);
    } finally {
      child?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("keeps the source generation stable while initialized processes alternate reads", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-process-readers-"
    ));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-process-readers-control-"
    ));
    const childReady = path.join(controlRoot, "child-ready");
    const firstRead = path.join(controlRoot, "first-read");
    const firstDone = path.join(controlRoot, "first-done");
    const secondRead = path.join(controlRoot, "second-read");
    const secondDone = path.join(controlRoot, "second-done");
    const generationPath = path.join(
      root,
      ".locks",
      "research-operations-projection-generation.json"
    );
    let child: ChildProcess | undefined;
    try {
      child = spawnInitializedProjectionReader({
        root,
        readyPath: childReady,
        reads: [
          { startPath: firstRead, donePath: firstDone },
          { startPath: secondRead, donePath: secondDone }
        ]
      });
      await waitForFile(childReady, child);
      const parentStore = new LocalStore(root);
      await parentStore.initialize();
      await parentStore.recordCandidateArenaResearchAllocation(
        allocationFixture("process-reader-catch-up")
      );
      const baselineGeneration = (await readJsonFile<{ generation: string }>(
        generationPath
      )).generation;

      await writeFile(firstRead, "read\n", "utf8");
      await waitForFile(firstDone, child);
      await expect(readJsonFile<{ recorded_session_count: number }>(firstDone))
        .resolves.toEqual({ recorded_session_count: 1 });
      expect((await readJsonFile<{ generation: string }>(generationPath))
        .generation).toBe(baselineGeneration);

      await expect(parentStore.readResearchOperationsProjectionWindow({
        session_limit: 100
      })).resolves.toMatchObject({
        index: { recorded_session_count: 1 }
      });
      expect((await readJsonFile<{ generation: string }>(generationPath))
        .generation).toBe(baselineGeneration);

      await writeFile(secondRead, "read\n", "utf8");
      await waitForFile(secondDone, child);
      await waitForChild(child);
      await expect(readJsonFile<{ recorded_session_count: number }>(secondDone))
        .resolves.toEqual({ recorded_session_count: 1 });
      expect((await readJsonFile<{ generation: string }>(generationPath))
        .generation).toBe(baselineGeneration);
    } finally {
      child?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("keeps generation stable across a no-op second-process initialize without rescanning an existing reader", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-noop-initialize-"
    ));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-noop-initialize-control-"
    ));
    const readerReady = path.join(controlRoot, "reader-ready");
    const readerStart = path.join(controlRoot, "reader-start");
    const readerResult = path.join(controlRoot, "reader-result.json");
    const generationPath = path.join(
      root,
      ".locks",
      "research-operations-projection-generation.json"
    );
    let reader: ChildProcess | undefined;
    let initializer: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      await store.recordCandidateArenaResearchAllocation(
        allocationFixture("noop-initialize-existing")
      );
      reader = spawnInitializedProjectionRefreshProbe({
        root,
        readyPath: readerReady,
        startPath: readerStart,
        resultPath: readerResult
      });
      await waitForFile(readerReady, reader);
      const baselineGeneration = (await readJsonFile<{ generation: string }>(
        generationPath
      )).generation;

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);

      expect((await readJsonFile<{ generation: string }>(generationPath))
        .generation).toBe(baselineGeneration);
      await writeFile(readerStart, "read\n", "utf8");
      await waitForFile(readerResult, reader);
      await waitForChild(reader);
      await expect(readJsonFile<{
        recorded_session_count: number;
        source_cache_refresh_count: number;
      }>(readerResult)).resolves.toEqual({
        recorded_session_count: 1,
        source_cache_refresh_count: 0
      });
    } finally {
      reader?.kill("SIGKILL");
      initializer?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("advances generation once for concurrent first source mutations", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-first-mutation-generation-"
    ));
    try {
      const store = new LocalStore(root);
      const privateStore = store as unknown as {
        advanceResearchOperationsProjectionSourceGeneration(): Promise<string>;
      };
      const advanceGeneration = vi.spyOn(
        privateStore,
        "advanceResearchOperationsProjectionSourceGeneration"
      );

      await store.runResearchOperationsProjectionBatch(() => Promise.all([
        store.recordResearchFinding(standaloneFinding(
          "concurrent-first-generation-a",
          "2026-07-29T00:00:00.000Z"
        )),
        store.recordResearchFinding(standaloneFinding(
          "concurrent-first-generation-b",
          "2026-07-29T00:00:01.000Z"
        ))
      ]));

      expect(advanceGeneration).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("holds the cross-process publication lock through source rollback", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-process-rollback-"
    ));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-process-rollback-control-"
    ));
    const childStarted = path.join(controlRoot, "child-started");
    let child: ChildProcess | undefined;
    let releaseRollback: (() => void) | undefined;
    let parentWrite: Promise<
      | { status: "fulfilled" }
      | { status: "rejected"; reason: unknown }
    > | undefined;
    try {
      let failParentSource = false;
      const parentStore = new LocalStore(root, {
        writeTransaction: {
          run: async (write) => {
            const result = await write();
            if (failParentSource) {
              failParentSource = false;
              throw new Error("parent_source_failed_after_rename");
            }
            return result;
          }
        }
      });
      await parentStore.initialize();
      const parentAllocation = allocationFixture("process-rollback-parent");
      const childAllocation = allocationFixture("process-rollback-child");
      const allocationPath = (
        allocation: CandidateArenaResearchAllocationRecord
      ) => path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          allocation.candidate_arena_research_allocation_id
        )}.json`
      );
      const privateStore = parentStore as unknown as {
        restoreResearchOperationsProjectionSourceSnapshots(
          snapshots: Map<string, string | undefined>
        ): Promise<void>;
      };
      const restoreSnapshots = privateStore
        .restoreResearchOperationsProjectionSourceSnapshots.bind(parentStore);
      let rollbackEntered!: () => void;
      const rollbackEnteredGate = new Promise<void>((resolve) => {
        rollbackEntered = resolve;
      });
      const rollbackGate = new Promise<void>((resolve) => {
        releaseRollback = resolve;
      });
      vi.spyOn(
        privateStore,
        "restoreResearchOperationsProjectionSourceSnapshots"
      ).mockImplementation(async (snapshots) => {
        rollbackEntered();
        await rollbackGate;
        await restoreSnapshots(snapshots);
      });

      failParentSource = true;
      parentWrite = parentStore
        .recordCandidateArenaResearchAllocation(parentAllocation)
        .then(
          () => ({ status: "fulfilled" as const }),
          (reason) => ({ status: "rejected" as const, reason })
        );
      await rollbackEnteredGate;
      child = spawnUninitializedProjectionWriter(
        root,
        childAllocation,
        childStarted
      );
      await waitForFile(childStarted, child);
      await waitForProjectionLockClaim(root, child);

      await expect(readJsonFile<CandidateArenaResearchAllocationRecord>(
        allocationPath(parentAllocation)
      )).resolves.toEqual(parentAllocation);
      await expect(readFile(allocationPath(childAllocation), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });

      const releaseHeldRollback = releaseRollback;
      if (releaseHeldRollback === undefined) {
        throw new Error("rollback gate was not initialized");
      }
      releaseHeldRollback();
      releaseRollback = undefined;
      const [parentOutcome] = await Promise.all([
        parentWrite,
        waitForChild(child)
      ]);
      expect(parentOutcome).toMatchObject({
        status: "rejected",
        reason: expect.objectContaining({
          message: "parent_source_failed_after_rename"
        })
      });
      await expect(readFile(allocationPath(parentAllocation), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
      await expect(readJsonFile<CandidateArenaResearchAllocationRecord>(
        allocationPath(childAllocation)
      )).resolves.toEqual(childAllocation);
      const index = await readJsonFile<{ recorded_session_count: number }>(
        path.join(root, "read-models", "research-operations", "index.json")
      );
      expect(index.recorded_session_count).toBe(1);
    } finally {
      releaseRollback?.();
      child?.kill("SIGKILL");
      await parentWrite?.catch(() => undefined);
      vi.restoreAllMocks();
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("bootstraps projection write-through for an uninitialized process writer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-uninitialized-"));
    let child: ChildProcess | undefined;
    try {
      const initializedStore = new LocalStore(root);
      await initializedStore.initialize();
      child = spawnUninitializedProjectionWriter(
        root,
        allocationFixture("uninitialized-process")
      );

      await waitForChild(child);

      await expect(stoppedService(initializedStore).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 1,
          projected_session_count: 1
        });
    } finally {
      child?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("serializes conflicting same-ID SystemCode validation across processes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-system-code-race-"));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-system-code-race-control-"
    ));
    const firstReady = path.join(controlRoot, "first-ready");
    const secondReady = path.join(controlRoot, "second-ready");
    const secondStarted = path.join(controlRoot, "second-started");
    const firstRelease = path.join(controlRoot, "first-release");
    const secondRelease = path.join(controlRoot, "second-release");
    const firstResult = path.join(controlRoot, "first-result.json");
    const secondResult = path.join(controlRoot, "second-result.json");
    let first: ChildProcess | undefined;
    let second: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const firstSystemCode = systemCode(
        "cross-process-system-code",
        digest("cross-process-system-code-first"),
        "2026-07-28T00:00:00.000Z"
      );
      const secondSystemCode = {
        ...firstSystemCode,
        artifact_digest: digest("cross-process-system-code-second")
      };
      first = spawnConflictingSystemCodeWriter({
        root,
        systemCode: firstSystemCode,
        readyPath: firstReady,
        releasePath: firstRelease,
        resultPath: firstResult
      });
      await waitForFile(firstReady, first);
      second = spawnConflictingSystemCodeWriter({
        root,
        systemCode: secondSystemCode,
        startedPath: secondStarted,
        readyPath: secondReady,
        releasePath: secondRelease,
        resultPath: secondResult
      });
      await waitForFile(secondStarted, second);
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      let secondSawAbsenceBeforeFirstCommitted = true;
      try {
        await access(secondReady);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        secondSawAbsenceBeforeFirstCommitted = false;
      }

      await writeFile(firstRelease, "release\n", "utf8");
      await waitForFile(firstResult, first);
      await waitForChild(first);
      if (secondSawAbsenceBeforeFirstCommitted) {
        await writeFile(secondRelease, "release\n", "utf8");
      }
      await waitForFile(secondResult, second);
      await waitForChild(second);

      const [firstOutcome, secondOutcome] = await Promise.all([
        readJsonFile<ProjectionWriterOutcome>(firstResult),
        readJsonFile<ProjectionWriterOutcome>(secondResult)
      ]);
      expect(secondSawAbsenceBeforeFirstCommitted).toBe(false);
      expect(firstOutcome).toEqual({ status: "recorded" });
      expect(secondOutcome).toMatchObject({
        status: "rejected",
        code: "authority_evidence_identity_conflict"
      });
      await expect(store.getSystemCode(firstSystemCode.system_code_id))
        .resolves.toEqual(firstSystemCode);
    } finally {
      first?.kill("SIGKILL");
      second?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("serializes reset behind an active cross-process projection writer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-reset-"));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-reset-control-"
    ));
    const childReady = path.join(controlRoot, "child-ready");
    const childStart = path.join(controlRoot, "child-start");
    const childSourceWritten = path.join(controlRoot, "child-source-written");
    const childRelease = path.join(controlRoot, "child-release");
    let child: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      child = spawnProjectionWriter({
        root,
        allocation: allocationFixture("reset-child"),
        readyPath: childReady,
        startPath: childStart,
        sourceWrittenPath: childSourceWritten,
        releasePath: childRelease
      });
      await waitForFile(childReady, child);
      await writeFile(childStart, "start\n", "utf8");
      await waitForFile(childSourceWritten, child);

      let resetSettled = false;
      const reset = store.reset().then(() => {
        resetSettled = true;
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const settledWhileChildHeldPublication = resetSettled;

      await writeFile(childRelease, "release\n", "utf8");
      await Promise.all([reset, waitForChild(child)]);
      const restarted = new LocalStore(root);
      await restarted.initialize();

      expect(settledWhileChildHeldPublication).toBe(false);
      await expect(stoppedService(restarted).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 0 });
    } finally {
      child?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("repairs a corrupt projection generation marker during reset", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-generation-reset-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const generationPath = path.join(
        root,
        ".locks",
        "research-operations-projection-generation.json"
      );
      await writeFile(generationPath, "{corrupt\n", "utf8");

      await expect(store.reset()).resolves.toBeUndefined();
      const repairedGeneration = JSON.parse(
        await readFile(generationPath, "utf8")
      ) as { record_kind: string; version: number; generation: string };
      expect(repairedGeneration).toMatchObject({
        record_kind: "research_operations_projection_source_generation",
        version: 1,
        generation: expect.any(String)
      });

      await store.initialize();
      await expect(stoppedService(store).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 0 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reclaims stale projection lock and generation debris", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-lock-debris-"));
    try {
      const lockRoot = path.join(
        root,
        ".locks",
        "research-operations-projection-publication"
      );
      const orphanedClaim = path.join(lockRoot, "claim-interrupted");
      const ownerlessTransition = path.join(lockRoot, "transition");
      const generationTemp = path.join(
        root,
        ".locks",
        "research-operations-projection-generation.json.99999999.dead.tmp"
      );
      await Promise.all([
        mkdir(orphanedClaim, { recursive: true }),
        mkdir(ownerlessTransition, { recursive: true }),
        mkdir(path.dirname(generationTemp), { recursive: true })
      ]);
      await Promise.all([
        writeFile(path.join(orphanedClaim, "owner.json"), "{partial\n", "utf8"),
        writeFile(generationTemp, "partial\n", "utf8")
      ]);
      const staleAt = new Date(Date.now() - 60_000);
      await Promise.all([
        utimes(orphanedClaim, staleAt, staleAt),
        utimes(path.join(orphanedClaim, "owner.json"), staleAt, staleAt)
      ]);

      const store = new LocalStore(root);
      await store.initialize();

      await expect(readFile(path.join(orphanedClaim, "owner.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(path.join(ownerlessTransition, "owner.json"), "utf8"))
        .rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(generationTemp, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves a live ownerless claim when its start marker is unavailable", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-live-claim-"));
    const marker = vi.spyOn(processStartMarkerModule, "processStartMarker")
      .mockResolvedValue(undefined);
    try {
      const liveClaim = path.join(
        root,
        ".locks",
        "research-operations-projection-publication",
        `claim-${process.pid}-${"0".repeat(16)}-` +
          "00000000-0000-4000-8000-000000000000"
      );
      await mkdir(liveClaim, { recursive: true });

      const store = new LocalStore(root);
      await store.initialize();

      await expect(access(liveClaim)).resolves.toBeUndefined();
    } finally {
      marker.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recreates deleted capsules when a stale writer replays after external reset", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-reset-replay-"));
    let child: ChildProcess | undefined;
    try {
      const staleStore = new LocalStore(root);
      await staleStore.initialize();
      const allocation = allocationFixture("external-reset-replay");
      await staleStore.recordCandidateArenaResearchAllocation(allocation);
      const workItemId = researchWorkItemId({
        research_allocation_id:
          allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const capsulePath = path.join(
        root,
        "read-models",
        "research-operations",
        "items",
        `${encodeURIComponent(workItemId)}.json`
      );

      child = spawnProjectionReset(root);
      await waitForChild(child);
      await expect(readFile(capsulePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      await expect(staleStore.recordCandidateArenaResearchAllocation(allocation))
        .resolves.toEqual(allocation);
      await expect(readFile(capsulePath, "utf8")).resolves.toContain(workItemId);
      await expect(stoppedService(staleStore).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 1,
          projected_session_count: 1
        });
    } finally {
      child?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("repairs missing and corrupt derived files on rebuild and cold restart", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-derived-repair-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const existing = allocationFixture("derived-repair-existing");
      await store.recordCandidateArenaResearchAllocation(existing);
      const workItemId = researchWorkItemId({
        research_allocation_id:
          existing.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const routePrefix = researchOperationsProjectionCapsuleRouteHash(
        workItemId
      ).slice(0, 2);
      const projectionRoot = path.join(
        root,
        "read-models",
        "research-operations"
      );
      const capsulePath = path.join(
        projectionRoot,
        "items",
        `${encodeURIComponent(workItemId)}.json`
      );
      const trieNodePath = path.join(
        projectionRoot,
        "trie",
        `${routePrefix}.json`
      );
      const [canonicalCapsule, canonicalTrieNode] = await Promise.all([
        readFile(capsulePath, "utf8"),
        readFile(trieNodePath, "utf8")
      ]);
      let next: CandidateArenaResearchAllocationRecord | undefined;
      for (let index = 0; index < 1_000; index += 1) {
        const candidate = allocationFixture(`derived-repair-next-${index}`);
        const candidateWorkItemId = researchWorkItemId({
          research_allocation_id:
            candidate.candidate_arena_research_allocation_id,
          direction_kind: "trend_following"
        });
        if (!researchOperationsProjectionCapsuleRouteHash(candidateWorkItemId)
          .startsWith(routePrefix)) {
          next = candidate;
          break;
        }
      }
      expect(next).toBeDefined();

      await Promise.all([
        rm(capsulePath, { force: true }),
        writeFile(trieNodePath, "{}\n", "utf8")
      ]);
      await store.recordCandidateArenaResearchAllocation(next!);

      await expect(readFile(capsulePath, "utf8")).resolves
        .toBe(canonicalCapsule);
      await expect(readFile(trieNodePath, "utf8")).resolves
        .toBe(canonicalTrieNode);

      await Promise.all([
        writeFile(capsulePath, "{}\n", "utf8"),
        rm(trieNodePath, { force: true })
      ]);
      const restarted = new LocalStore(root);
      await restarted.initialize();

      await expect(readFile(capsulePath, "utf8")).resolves
        .toBe(canonicalCapsule);
      await expect(readFile(trieNodePath, "utf8")).resolves
        .toBe(canonicalTrieNode);
      await expect(stoppedService(restarted).readSessionDetail(workItemId))
        .resolves.toMatchObject({ research_work_item_id: workItemId });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recovers a killed cross-process writer from its pre-write generation fence", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-killed-"));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-killed-control-"
    ));
    const childReady = path.join(controlRoot, "child-ready");
    const childStart = path.join(controlRoot, "child-start");
    const childSourceWritten = path.join(controlRoot, "child-source-written");
    const childRelease = path.join(controlRoot, "child-release");
    let child: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      child = spawnProjectionWriter({
        root,
        allocation: allocationFixture("killed-child"),
        readyPath: childReady,
        startPath: childStart,
        sourceWrittenPath: childSourceWritten,
        releasePath: childRelease
      });
      await waitForFile(childReady, child);
      await writeFile(childStart, "start\n", "utf8");
      await waitForFile(childSourceWritten, child);

      const childExit = waitForAnyChildExit(child);
      child.kill("SIGKILL");
      await childExit;
      await store.recordCandidateArenaResearchAllocation(
        allocationFixture("killed-parent")
      );

      const index = JSON.parse(await readFile(path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      ), "utf8")) as { recorded_session_count: number };
      expect(index.recorded_session_count).toBe(2);
    } finally {
      child?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("rebuilds a missing index after a writer dies immediately after invalidation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-invalidation-kill-"));
    const controlRoot = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-invalidation-kill-control-"
    ));
    const invalidatedPath = path.join(controlRoot, "index-invalidated");
    const releasePath = path.join(controlRoot, "release");
    let invalidatingWriter: ChildProcess | undefined;
    let freshWriter: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      await store.recordCandidateArenaResearchAllocation(
        allocationFixture("invalidation-existing")
      );
      invalidatingWriter = spawnProjectionInvalidatingWriter({
        root,
        allocation: allocationFixture("invalidation-killed"),
        invalidatedPath,
        releasePath
      });
      await waitForFile(invalidatedPath, invalidatingWriter);
      await expect(readFile(path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      ), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      const invalidatingExit = waitForAnyChildExit(invalidatingWriter);
      invalidatingWriter.kill("SIGKILL");
      await invalidatingExit;
      freshWriter = spawnUninitializedProjectionWriter(
        root,
        allocationFixture("invalidation-fresh")
      );
      await waitForChild(freshWriter);

      const index = await readJsonFile<{ recorded_session_count: number }>(
        path.join(root, "read-models", "research-operations", "index.json")
      );
      expect(index.recorded_session_count).toBe(2);
      await expect(stoppedService(new LocalStore(root)).readOperations())
        .resolves.toMatchObject({
          availability: "available",
          recorded_session_count: 2,
          projected_session_count: 2
        });
    } finally {
      invalidatingWriter?.kill("SIGKILL");
      freshWriter?.kill("SIGKILL");
      await Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(controlRoot, { recursive: true, force: true })
      ]);
    }
  }, 20_000);

  it("rejects an allocation whose persisted serialization crosses the byte bound", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-size-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const allocation = allocationFixture("oversized-source");
      allocation.selected_directions[0]!.reasons = ["seed"];
      allocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(allocation)
      );
      const maximumBytes = 256 * 1024;
      const initialSerializedBytes = Buffer.byteLength(
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      );
      allocation.selected_directions[0]!.reasons[0] += "x".repeat(
        maximumBytes + 1 - initialSerializedBytes
      );
      allocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(allocation)
      );
      const compactBytes = Buffer.byteLength(JSON.stringify(allocation), "utf8");
      const persistedBytes = Buffer.byteLength(
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      );
      const sourcePath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          allocation.candidate_arena_research_allocation_id
        )}.json`
      );
      expect(compactBytes).toBeLessThanOrEqual(maximumBytes);
      expect(persistedBytes).toBe(maximumBytes + 1);

      await expect(store.recordCandidateArenaResearchAllocation(allocation))
        .rejects.toMatchObject({
          code: "research_operations_projection_source_record_too_large",
          details: {
            collection: "candidate-arena-research-allocations",
            serialized_bytes: maximumBytes + 1
          }
        });
      await expect(readFile(sourcePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(stoppedService(restarted).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 0
        });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an oversized non-root projection source before a cold restart", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-non-root-source-size-"
    ));
    let initializer: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const direction: ResearchDirectionRecord = {
        record_kind: "research_direction",
        version: 1,
        research_direction_id: "serialized-source-over-bound",
        direction_kind: "trend_following",
        market_scope: "external_trading_api_fixture",
        prompt_seed: "seed",
        created_at: "2026-07-29T00:00:00.000Z",
        authority_status: "research_seed_only"
      };
      const maximumBytes = 256 * 1024;
      const initialSerializedBytes = Buffer.byteLength(
        `${JSON.stringify(direction, null, 2)}\n`,
        "utf8"
      );
      direction.prompt_seed += "x".repeat(
        maximumBytes + 1 - initialSerializedBytes
      );
      const compactBytes = Buffer.byteLength(JSON.stringify(direction), "utf8");
      const persistedBytes = Buffer.byteLength(
        `${JSON.stringify(direction, null, 2)}\n`,
        "utf8"
      );
      const sourcePath = path.join(
        root,
        "research-directions",
        "items",
        `${encodeURIComponent(direction.research_direction_id)}.json`
      );
      expect(compactBytes).toBeLessThanOrEqual(maximumBytes);
      expect(persistedBytes).toBe(maximumBytes + 1);

      await expect(store.recordResearchDirection(direction)).rejects.toMatchObject({
        code: "research_operations_projection_source_record_too_large",
        details: {
          collection: "research-directions",
          serialized_bytes: maximumBytes + 1
        }
      });
      await expect(readFile(sourcePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);
      await expect(stoppedService(new LocalStore(root)).readOperations())
        .resolves.toMatchObject({
          availability: "available",
          recorded_session_count: 0
        });
    } finally {
      initializer?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("rejects an oversized create-only projection source before publication", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-create-only-source-size-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const source = systemCode(
        "serialized-create-only-over-bound",
        digest("serialized-create-only-over-bound"),
        "2026-07-29T00:00:00.000Z"
      );
      if (source.artifact_kind !== "python_file") {
        throw new Error("serialized_create_only_fixture_not_python");
      }
      const maximumBytes = 256 * 1024;
      const initialSerializedBytes = Buffer.byteLength(
        `${JSON.stringify(source, null, 2)}\n`,
        "utf8"
      );
      source.artifact_path += "x".repeat(
        maximumBytes + 1 - initialSerializedBytes
      );
      const compactBytes = Buffer.byteLength(JSON.stringify(source), "utf8");
      const persistedBytes = Buffer.byteLength(
        `${JSON.stringify(source, null, 2)}\n`,
        "utf8"
      );
      const sourcePath = path.join(
        root,
        "system-codes",
        "items",
        `${encodeURIComponent(source.system_code_id)}.json`
      );
      expect(compactBytes).toBeLessThanOrEqual(maximumBytes);
      expect(persistedBytes).toBe(maximumBytes + 1);

      await expect(store.recordSystemCode(source)).rejects.toMatchObject({
        code: "research_operations_projection_source_record_too_large",
        details: {
          collection: "system-codes",
          serialized_bytes: maximumBytes + 1
        }
      });
      await expect(readFile(sourcePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(stoppedService(restarted).readOperations()).resolves
        .toMatchObject({
          availability: "available",
          recorded_session_count: 0
        });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists and cold-reloads non-root sources at and below the byte bound", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-source-exact-size-"
    ));
    let initializer: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const maximumBytes = 256 * 1024;
      const directions = [maximumBytes - 1, maximumBytes].map((targetBytes) => {
        const direction: ResearchDirectionRecord = {
          record_kind: "research_direction",
          version: 1,
          research_direction_id: `serialized-source-bound-${targetBytes}`,
          direction_kind: "trend_following",
          market_scope: "external_trading_api_fixture",
          prompt_seed: "seed",
          created_at: "2026-07-29T00:00:00.000Z",
          authority_status: "research_seed_only"
        };
        const initialSerializedBytes = Buffer.byteLength(
          `${JSON.stringify(direction, null, 2)}\n`,
          "utf8"
        );
        direction.prompt_seed += "x".repeat(targetBytes - initialSerializedBytes);
        return { direction, targetBytes };
      });
      for (const { direction, targetBytes } of directions) {
        const persisted = `${JSON.stringify(direction, null, 2)}\n`;
        const sourcePath = path.join(
          root,
          "research-directions",
          "items",
          `${encodeURIComponent(direction.research_direction_id)}.json`
        );
        expect(Buffer.byteLength(persisted, "utf8")).toBe(targetBytes);
        await expect(store.recordResearchDirection(direction)).resolves
          .toEqual(direction);
        await expect(readFile(sourcePath, "utf8")).resolves.toBe(persisted);
      }

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);
      for (const { direction } of directions) {
        await expect(new LocalStore(root).getResearchDirection(
          direction.research_direction_id
        )).resolves.toEqual(direction);
      }
    } finally {
      initializer?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("isolates an origin-compatible oversized source from cold initialization", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-cold-source-size-"
    ));
    try {
      const allocation = allocationFixture("oversized-cold-source");
      allocation.selected_directions[0]!.reasons = ["x".repeat(300 * 1024)];
      allocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(allocation)
      );
      const sourceDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      const sourcePath = path.join(
        sourceDir,
        `${encodeURIComponent(
          allocation.candidate_arena_research_allocation_id
        )}.json`
      );
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        sourcePath,
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      );
      const store = new LocalStore(root);
      const readJson = vi.spyOn(
        store as unknown as { readJson(filePath: string): Promise<unknown> },
        "readJson"
      );

      await expect(store.initialize()).resolves.toBeUndefined();
      expect(readJson.mock.calls.some(([filePath]) => filePath === sourcePath))
        .toBe(false);
      await expect(store.listCandidateArenaResearchAllocations()).resolves
        .toEqual(expect.arrayContaining([
          expect.objectContaining({
            candidate_arena_research_allocation_id:
              allocation.candidate_arena_research_allocation_id
          })
        ]));
      for (const read of [
        () => store.readResearchOperationsProjectionWindow({
          session_limit: 100
        }),
        () => store.readCandidateArenaEvidenceProjection()
      ]) {
        const error = await read().catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(
          ResearchOperationsProjectionCompatibilityError
        );
        expect(error).toMatchObject({
          message: "research_operations_projection_compatibility_blocked",
          reason: "legacy_source_oversized"
        });
      }

      const postUpgradeDirection: ResearchDirectionRecord = {
        record_kind: "research_direction",
        version: 1,
        research_direction_id: "post-legacy-upgrade-direction",
        direction_kind: "trend_following",
        market_scope: "external_trading_api_fixture",
        prompt_seed: "Bounded writes remain durable while projection migration is pending.",
        created_at: "2026-07-29T00:00:00.000Z",
        authority_status: "research_seed_only"
      };
      await expect(store.recordResearchDirection(postUpgradeDirection))
        .resolves.toEqual(postUpgradeDirection);
      await expect(store.getResearchDirection(
        postUpgradeDirection.research_direction_id
      )).resolves.toEqual(postUpgradeDirection);
      await expect(store.readResearchOperationsProjectionWindow({
        session_limit: 100
      })).rejects.toMatchObject({
        message: "research_operations_projection_compatibility_blocked",
        reason: "legacy_source_oversized"
      });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a non-object raw projection source container on cold start", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-cold-source-container-"
    ));
    try {
      const sourceDir = path.join(root, "research-workers", "items");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(path.join(sourceDir, "array.json"), "[]\n", "utf8");

      await expect(new LocalStore(root).initialize()).rejects.toMatchObject({
        code: "research_operations_projection_source_record_invalid",
        details: { collection: "research-workers" }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a raw projection source whose record kind does not match its collection", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-cold-source-record-kind-"
    ));
    try {
      const sourceDir = path.join(root, "research-workers", "items");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(path.join(sourceDir, "wrong-kind.json"), `${JSON.stringify({
        record_kind: "research_direction",
        version: 1
      })}\n`, "utf8");

      await expect(new LocalStore(root).initialize()).rejects.toMatchObject({
        code: "research_operations_projection_source_record_invalid",
        details: { collection: "research-workers" }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects oversized Finding and Lineage sources before a cold initialize", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-source-bounds-"));
    let initializer: ChildProcess | undefined;
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const finding = standaloneFinding(
        "oversized-finding",
        "2026-07-28T00:01:00.000Z"
      );
      finding.supporting_record_refs = Array.from({ length: 101 }, (_, index) =>
        ref("research_evidence_artifact", `support-${index}`)
      );
      const findingPath = path.join(
        root,
        "research-findings",
        "items",
        `${encodeURIComponent(finding.research_finding_id)}.json`
      );

      await expect(store.recordResearchFinding(finding)).rejects.toMatchObject({
        code: "research_operations_projection_source_record_too_large"
      });
      await expect(readFile(findingPath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      const sourceFindings = Array.from({ length: 101 }, (_, index) =>
        standaloneFinding(
          `lineage-source-${index}`,
          `2026-07-28T00:${String(index % 60).padStart(2, "0")}:00.000Z`
        )
      );
      await store.runResearchOperationsProjectionBatch(async () => {
        for (const sourceFinding of sourceFindings) {
          await store.recordResearchFinding(sourceFinding);
        }
      });
      const childSystemCode = systemCode(
        "oversized-lineage-child",
        digest("oversized-lineage-child"),
        "2026-07-28T01:00:00.000Z"
      );
      await store.recordSystemCode(childSystemCode);
      const lineage: ArtifactLineageRecord = {
        record_kind: "artifact_lineage",
        version: 1,
        artifact_lineage_id: "oversized-lineage",
        child_system_code_ref: ref(
          "system_code",
          childSystemCode.system_code_id
        ),
        source_finding_refs: sourceFindings.map((sourceFinding) =>
          ref("research_finding", sourceFinding.research_finding_id)
        ),
        created_at: "2026-07-28T01:00:01.000Z",
        authority_status: "lineage_only"
      };
      const lineagePath = path.join(
        root,
        "artifact-lineages",
        "items",
        `${encodeURIComponent(lineage.artifact_lineage_id)}.json`
      );

      await expect(store.recordArtifactLineage(lineage)).rejects.toMatchObject({
        code: "research_operations_projection_source_record_too_large"
      });
      await expect(readFile(lineagePath, "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);
      const index = await readJsonFile<{ recorded_session_count: number }>(
        path.join(root, "read-models", "research-operations", "index.json")
      );
      expect(index.recorded_session_count).toBe(0);
    } finally {
      initializer?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("serializes same-root cache refresh with a concurrent source write", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-refresh-"));
    try {
      const writer = new LocalStore(root);
      await writer.initialize();
      const existing = allocationFixture("refresh-existing");
      await writer.runResearchOperationsProjectionBatch(() =>
        writer.recordCandidateArenaResearchAllocation(existing)
      );
      const reloader = new LocalStore(root);
      const privateReloader = reloader as unknown as {
        readBoundedResearchOperationsProjectionSourceJson(
          filePath: string,
          collection: string
        ): Promise<Record<string, unknown>>;
      };
      const originalReadSource = privateReloader
        .readBoundedResearchOperationsProjectionSourceJson.bind(reloader);
      let releaseRefresh!: () => void;
      const refreshGate = new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
      let refreshBlocked!: () => void;
      const refreshBlockedGate = new Promise<void>((resolve) => {
        refreshBlocked = resolve;
      });
      let blocked = false;
      vi.spyOn(
        privateReloader,
        "readBoundedResearchOperationsProjectionSourceJson"
      ).mockImplementation(
        async (filePath, collection) => {
          if (!blocked && filePath === path.join(
            root,
            "candidate-arena-research-allocations",
            "items",
            `${encodeURIComponent(
              existing.candidate_arena_research_allocation_id
            )}.json`
          )) {
            blocked = true;
            refreshBlocked();
            await refreshGate;
          }
          return originalReadSource(filePath, collection);
        }
      );

      const initialize = reloader.initialize();
      await refreshBlockedGate;
      let writeFinished = false;
      const concurrent = allocationFixture("refresh-concurrent");
      const write = writer.recordCandidateArenaResearchAllocation(concurrent)
        .then((value) => {
          writeFinished = true;
          return value;
        });
      await Promise.resolve();
      expect(writeFinished).toBe(false);

      releaseRefresh();
      await Promise.all([initialize, write]);
      await expect(stoppedService(reloader).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 2 });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes a first initialization refresh with a same-root source write", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-first-refresh-"));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      const existing = allocationFixture("first-refresh-existing");
      await writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            existing.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(existing, null, 2)}\n`,
        "utf8"
      );
      const initializer = new LocalStore(root);
      const privateInitializer = initializer as unknown as {
        readBoundedResearchOperationsProjectionSourceJson(
          filePath: string,
          collection: string
        ): Promise<Record<string, unknown>>;
      };
      const originalReadSource = privateInitializer
        .readBoundedResearchOperationsProjectionSourceJson.bind(initializer);
      let releaseRefresh!: () => void;
      const refreshGate = new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
      let refreshBlocked!: () => void;
      const refreshBlockedGate = new Promise<void>((resolve) => {
        refreshBlocked = resolve;
      });
      let blocked = false;
      vi.spyOn(
        privateInitializer,
        "readBoundedResearchOperationsProjectionSourceJson"
      ).mockImplementation(
        async (filePath, collection) => {
          if (!blocked && filePath.startsWith(allocationDir)) {
            blocked = true;
            refreshBlocked();
            await refreshGate;
          }
          return originalReadSource(filePath, collection);
        }
      );

      const initialize = initializer.initialize();
      await refreshBlockedGate;
      const writer = new LocalStore(root);
      let writeFinished = false;
      const concurrent = allocationFixture("first-refresh-concurrent");
      const write = writer.recordCandidateArenaResearchAllocation(concurrent)
        .then((value) => {
          writeFinished = true;
          return value;
        });
      await Promise.resolve();
      expect(writeFinished).toBe(false);

      releaseRefresh();
      await Promise.all([initialize, write]);
      await expect(stoppedService(initializer).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 2 });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes the stale index before a cold capsule replay begins", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-cold-fence-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      await store.runResearchOperationsProjectionBatch(() =>
        store.recordCandidateArenaResearchAllocation(
          allocationFixture("cold-fence")
        )
      );
      const privateStore = store as unknown as {
        researchOperationsProjectionCoordinator: {
          initialized: boolean;
          readable: boolean;
          dirty: boolean;
        };
      };
      privateStore.researchOperationsProjectionCoordinator.initialized = false;
      privateStore.researchOperationsProjectionCoordinator.readable = false;
      privateStore.researchOperationsProjectionCoordinator.dirty = false;

      const restarted = new LocalStore(root);
      const privateRestarted = restarted as unknown as {
        writeJson(filePath: string, value: unknown): Promise<void>;
      };
      const originalWriteJson = privateRestarted.writeJson.bind(restarted);
      let releaseCapsule!: () => void;
      const capsuleGate = new Promise<void>((resolve) => {
        releaseCapsule = resolve;
      });
      let capsuleBlocked!: () => void;
      const capsuleBlockedGate = new Promise<void>((resolve) => {
        capsuleBlocked = resolve;
      });
      let blocked = false;
      vi.spyOn(privateRestarted, "writeJson").mockImplementation(
        async (filePath, value) => {
          if (!blocked && filePath.startsWith(path.join(
            root,
            "read-models",
            "research-operations",
            "items"
          ))) {
            blocked = true;
            capsuleBlocked();
            await capsuleGate;
          }
          await originalWriteJson(filePath, value);
        }
      );

      const initialize = restarted.initialize();
      await capsuleBlockedGate;
      await expect(readFile(path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      ), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      releaseCapsule();
      await initialize;
      await expect(stoppedService(restarted).readOperations()).resolves
        .toMatchObject({ recorded_session_count: 1 });
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not parse unrelated historical records during summary or detail refresh", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-window-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "bounded-window");
      const unrelatedExperiment: ExperimentRunRecord = {
        record_kind: "experiment_run",
        version: 1,
        experiment_run_id: "experiment-unrelated-history",
        research_worker_ref: ref("research_worker", graph.worker.research_worker_id),
        research_direction_ref: ref(
          "research_direction",
          graph.direction.research_direction_id
        ),
        system_code_ref: ref("system_code", graph.source.system_code_id),
        trading_evaluation_task_ref: ref(
          "trading_evaluation_task",
          "unrelated-history-task"
        ),
        trace_ref: ref("trace_placeholder", "unrelated-history-trace"),
        submitted_at: "2026-07-23T00:00:02.000Z",
        status: "evaluated",
        authority_status: "not_live"
      };
      await store.recordExperimentRun(unrelatedExperiment);
      const unrelatedPath = path.join(
        root,
        "experiment-runs",
        "items",
        `${unrelatedExperiment.experiment_run_id}.json`
      );
      const readJson = vi.spyOn(
        store as unknown as {
          readJson(filePath: string): Promise<unknown>;
        },
        "readJson"
      );
      const service = stoppedService(store);

      const operations = await service.readOperations();
      await service.readSessionDetail(researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      }));

      expect(operations).toMatchObject({
        recorded_session_count: 1,
        projected_session_count: 1,
        omitted_session_count: 0
      });
      expect(readJson.mock.calls.some(([filePath]) =>
        filePath === unrelatedPath
      )).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns an exact miss when a Bloom false positive has no trie entry", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-bloom-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await store.runResearchOperationsProjectionBatch(() =>
        persistBaseGraph(store, "bloom-false-positive")
      );
      const existingId = researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const rootPrefix = researchOperationsProjectionCapsuleRouteHash(existingId)
        .slice(0, 2);
      let absentId = "";
      for (let index = 0; index < 10_000; index += 1) {
        const candidate = `research-session-v1-absent-${index}`;
        if (researchOperationsProjectionCapsuleRouteHash(candidate)
          .startsWith(rootPrefix)) {
          absentId = candidate;
          break;
        }
      }
      expect(absentId).not.toBe("");
      const indexPath = path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      );
      const projectionIndex = JSON.parse(
        await readFile(indexPath, "utf8")
      ) as Record<string, unknown> & {
        projection_digest: string;
        session_membership: { encoded_bits: string };
      };
      projectionIndex.session_membership.encoded_bits = Buffer.alloc(
        32_768 / 8,
        0xff
      ).toString("base64");
      const { projection_digest: _digest, ...indexInput } = projectionIndex;
      projectionIndex.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(
        indexPath,
        `${JSON.stringify(projectionIndex, null, 2)}\n`,
        "utf8"
      );

      await expect(stoppedService(store).readSessionDetail(absentId))
        .resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a resealed head reference that is absent from the committed trie", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-stale-head-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      await store.recordCandidateArenaResearchAllocation(
        allocationFixture("stale-head")
      );
      const indexPath = path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      );
      const projectionIndex = await readJsonFile<
        ResearchOperationsProjectionIndexRecord
      >(indexPath);
      projectionIndex.head_session_refs[0]!.research_work_item_id =
        `research-session-v1-${"f".repeat(64)}`;
      const { projection_digest: _digest, ...indexInput } = projectionIndex;
      projectionIndex.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(
        indexPath,
        `${JSON.stringify(projectionIndex, null, 2)}\n`,
        "utf8"
      );

      await expect(stoppedService(store).readOperations()).rejects.toThrow(
        "research_operations_projection_capsule_unbound"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("traverses a branched trie for an off-page exact read and fails closed on child damage", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-trie-branch-"));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      const targetRootPrefix = "00";
      const allocations = collidingAllocationFixtures(
        "trie-branch",
        targetRootPrefix,
        120
      );
      await Promise.all(allocations.map((allocation) => writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            allocation.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      )));

      const store = new LocalStore(root);
      await store.initialize();
      const indexPath = path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      );
      const projectionIndex = await readJsonFile<Record<string, unknown> & {
        head_session_refs: Array<{ research_work_item_id: string }>;
        projection_digest: string;
        session_membership: { encoded_bits: string };
      }>(indexPath);
      const headIds = new Set(projectionIndex.head_session_refs.map((reference) =>
        reference.research_work_item_id
      ));
      const targetWorkItemId = allocations.map((allocation) =>
        researchWorkItemId({
          research_allocation_id:
            allocation.candidate_arena_research_allocation_id,
          direction_kind: "trend_following"
        })
      ).find((id) => !headIds.has(id));
      expect(targetWorkItemId).toBeDefined();
      const targetRouteHash = researchOperationsProjectionCapsuleRouteHash(
        targetWorkItemId!
      );
      const trieDir = path.join(
        root,
        "read-models",
        "research-operations",
        "trie"
      );
      const rootNodePath = path.join(
        trieDir,
        `${targetRouteHash.slice(0, 2)}.json`
      );
      const rootNode = await readJsonFile<ResearchOperationsProjectionCapsuleTrieNode>(
        rootNodePath
      );
      expect(rootNode.node_kind).toBe("branch");
      if (rootNode.node_kind !== "branch") {
        throw new Error("expected branched projection trie root");
      }
      const childRef = rootNode.children.find((child) =>
        child.prefix === targetRouteHash.slice(0, 4)
      );
      expect(childRef).toBeDefined();
      const childPath = path.join(trieDir, `${childRef!.prefix}.json`);
      const childText = await readFile(childPath, "utf8");
      for (const entry of await readdir(trieDir)) {
        if (!entry.endsWith(".json")) continue;
        expect(Buffer.byteLength(
          await readFile(path.join(trieDir, entry), "utf8"),
          "utf8"
        )).toBeLessThanOrEqual(256 * 1024);
      }

      projectionIndex.session_membership.encoded_bits = Buffer.alloc(
        32_768 / 8,
        0
      ).toString("base64");
      const { projection_digest: _digest, ...indexInput } = projectionIndex;
      projectionIndex.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(
        indexPath,
        `${JSON.stringify(projectionIndex, null, 2)}\n`,
        "utf8"
      );
      const readProjectionJson = vi.spyOn(
        store as unknown as {
          readBoundedResearchOperationsProjectionJson(
            filePath: string,
            tooLargeError: string
          ): Promise<unknown>;
        },
        "readBoundedResearchOperationsProjectionJson"
      );

      await expect(stoppedService(store).readSessionDetail(targetWorkItemId!))
        .resolves.toMatchObject({
          research_work_item_id: targetWorkItemId
        });
      expect(readProjectionJson.mock.calls.map(([filePath]) => filePath)).toEqual([
        indexPath,
        rootNodePath,
        childPath,
        path.join(
          root,
          "read-models",
          "research-operations",
          "items",
          `${encodeURIComponent(targetWorkItemId!)}.json`
        ),
        indexPath
      ]);

      await rm(childPath, { force: true });
      await expect(stoppedService(store).readSessionDetail(targetWorkItemId!))
        .rejects.toThrow(
          "research_operations_projection_capsule_trie_node_missing"
        );
      const corruptChild = JSON.parse(childText) as Record<string, unknown> & {
        subtree_entry_count: number;
      };
      corruptChild.subtree_entry_count += 1;
      await writeFile(
        childPath,
        `${JSON.stringify(corruptChild, null, 2)}\n`,
        "utf8"
      );
      await expect(stoppedService(store).readSessionDetail(targetWorkItemId!))
        .rejects.toThrow(
          "research_operations_projection_capsule_trie_node_invalid"
        );
    } finally {
      vi.restoreAllMocks();
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects oversized projection index, trie node, and capsule files before parsing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-read-bound-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await store.runResearchOperationsProjectionBatch(() =>
        persistBaseGraph(store, "read-bound")
      );
      const workItemId = researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const projectionRoot = path.join(
        root,
        "read-models",
        "research-operations"
      );
      const indexPath = path.join(projectionRoot, "index.json");
      const trieNodePath = path.join(
        projectionRoot,
        "trie",
        `${researchOperationsProjectionCapsuleRouteHash(workItemId)
          .slice(0, 2)}.json`
      );
      const capsulePath = path.join(
        projectionRoot,
        "items",
        `${encodeURIComponent(workItemId)}.json`
      );
      const [indexText, trieNodeText, capsuleText] = await Promise.all([
        readFile(indexPath, "utf8"),
        readFile(trieNodePath, "utf8"),
        readFile(capsulePath, "utf8")
      ]);
      const oversized = "x".repeat(256 * 1024 + 1);
      const readExact = () => store.readResearchOperationsProjectionWindow({
        session_limit: 0,
        exact_research_work_item_id: workItemId
      });

      await writeFile(indexPath, oversized, "utf8");
      await expect(readExact()).rejects.toThrow(
        "research_operations_projection_index_too_large"
      );
      await writeFile(indexPath, indexText, "utf8");

      await writeFile(trieNodePath, oversized, "utf8");
      await expect(readExact()).rejects.toThrow(
        "research_operations_projection_capsule_trie_node_too_large"
      );
      await writeFile(trieNodePath, trieNodeText, "utf8");

      await writeFile(capsulePath, oversized, "utf8");
      await expect(readExact()).rejects.toThrow(
        "research_operations_projection_capsule_too_large"
      );
      await writeFile(capsulePath, capsuleText, "utf8");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls back a partial leaf-to-branch publication before cold restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-trie-fault-"));
    let initializer: ChildProcess | undefined;
    try {
      const collidingAllocations = collidingAllocationFixtures(
        "trie-transition",
        "00",
        120
      );
      const capsuleInputs = collidingAllocations.map((allocation) => {
        const id = researchWorkItemId({
          research_allocation_id:
            allocation.candidate_arena_research_allocation_id,
          direction_kind: "trend_following"
        });
        return {
          research_work_item_id: id,
          capsule_digest: digest(`trie-transition-${id}`)
        } as ResearchOperationsProjectionCapsule;
      });
      let transitionCount = 0;
      for (let count = 2; count <= capsuleInputs.length; count += 1) {
        const trie = materializeResearchOperationsProjectionCapsuleTrie(
          capsuleInputs.slice(0, count)
        );
        if (trie.nodes.find((node) => node.prefix === "00")?.node_kind ===
          "branch") {
          transitionCount = count;
          break;
        }
      }
      expect(transitionCount).toBeGreaterThan(1);
      const initialAllocations = collidingAllocations.slice(
        0,
        transitionCount - 1
      );
      const transitionAllocation = collidingAllocations[transitionCount - 1]!;
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      await Promise.all(initialAllocations.map((allocation) => writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            allocation.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      )));

      const store = new LocalStore(root);
      await store.initialize();
      const projectionRoot = path.join(
        root,
        "read-models",
        "research-operations"
      );
      const trieDir = path.join(projectionRoot, "trie");
      const rootNodePath = path.join(trieDir, "00.json");
      const indexPath = path.join(projectionRoot, "index.json");
      await expect(readJsonFile<ResearchOperationsProjectionCapsuleTrieNode>(
        rootNodePath
      )).resolves.toMatchObject({
        node_kind: "leaf",
        subtree_entry_count: initialAllocations.length
      });
      const privateStore = store as unknown as {
        writeJson(filePath: string, value: unknown): Promise<void>;
      };
      const originalWriteJson = privateStore.writeJson.bind(store);
      const writeJson = vi.spyOn(privateStore, "writeJson");
      const trieNodesPublishedBeforeFault: string[] = [];
      let failTransitionIndex = true;
      writeJson.mockImplementation(async (filePath, value) => {
        if (failTransitionIndex && filePath === indexPath) {
          failTransitionIndex = false;
          throw new Error("trie_transition_index_publish_failed");
        }
        await originalWriteJson(filePath, value);
        if (failTransitionIndex && filePath.startsWith(`${trieDir}${path.sep}`)) {
          trieNodesPublishedBeforeFault.push(filePath);
        }
      });

      await expect(store.recordCandidateArenaResearchAllocation(
        transitionAllocation
      )).rejects.toThrow("trie_transition_index_publish_failed");
      writeJson.mockRestore();
      expect(trieNodesPublishedBeforeFault.length).toBeGreaterThan(1);
      expect(trieNodesPublishedBeforeFault.at(-1)).toBe(rootNodePath);
      await expect(readFile(path.join(
        allocationDir,
        `${encodeURIComponent(
          transitionAllocation.candidate_arena_research_allocation_id
        )}.json`
      ), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readJsonFile<{ recorded_session_count: number }>(indexPath))
        .resolves.toMatchObject({
          recorded_session_count: initialAllocations.length
        });
      await expect(readJsonFile<ResearchOperationsProjectionCapsuleTrieNode>(
        rootNodePath
      )).resolves.toMatchObject({
        node_kind: "leaf",
        subtree_entry_count: initialAllocations.length
      });
      expect((await readdir(trieDir)).filter((entry) => entry.endsWith(".json")))
        .toEqual(["00.json"]);

      initializer = spawnProjectionInitializer(root);
      await waitForChild(initializer);
      const initialWorkItemId = researchWorkItemId({
        research_allocation_id:
          initialAllocations[0]!.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const headWindow = await store.readResearchOperationsProjectionWindow({
        session_limit: 100
      });
      const exactWindow = await store.readResearchOperationsProjectionWindow({
        session_limit: 0,
        exact_research_work_item_id: initialWorkItemId
      });
      expect(exactWindow.capsules).toEqual([
        headWindow.capsules.find((capsule) =>
          capsule.research_work_item_id === initialWorkItemId
        )
      ]);

      await expect(store.recordCandidateArenaResearchAllocation(
        transitionAllocation
      )).resolves.toEqual(transitionAllocation);
      const [transitionIndex, transitionRoot] = await Promise.all([
        readJsonFile<{
          recorded_session_count: number;
          capsule_trie_root_refs: Array<{
            prefix: string;
            subtree_entry_count: number;
          }>;
        }>(indexPath),
        readJsonFile<ResearchOperationsProjectionCapsuleTrieNode>(rootNodePath)
      ]);
      expect(transitionIndex.recorded_session_count).toBe(transitionCount);
      expect(transitionIndex.capsule_trie_root_refs).toEqual([
        expect.objectContaining({
          prefix: "00",
          subtree_entry_count: transitionCount
        })
      ]);
      expect(transitionRoot).toMatchObject({
        node_kind: "branch",
        subtree_entry_count: transitionCount
      });
      if (transitionRoot.node_kind !== "branch") {
        throw new Error("expected branch after transition retry");
      }
      expect(new Set((await readdir(trieDir))
        .filter((entry) => entry.endsWith(".json"))))
        .toEqual(new Set([
          "00.json",
          ...transitionRoot.children.map((child) => `${child.prefix}.json`)
        ]));
    } finally {
      vi.restoreAllMocks();
      initializer?.kill("SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("reads a fixed 100-session window and one exact capsule after cold restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-year-"));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      const tickDir = path.join(root, "candidate-arena-ticks", "items");
      await Promise.all([
        mkdir(allocationDir, { recursive: true }),
        mkdir(tickDir, { recursive: true })
      ]);
      const allocations = Array.from({ length: 365 }, (_, index) => {
        const allocation = allocationFixture(
          `year-${String(index).padStart(3, "0")}`
        );
        if (index === 0) {
          allocation.selected_directions.push(
            {
              direction_kind: "mean_reversion",
              selection_kind: "explicit",
              priority: 2,
              experiment_budget: 1,
              signal_score: 0,
              reasons: ["test_explicit_direction"]
            },
            {
              direction_kind: "volatility_regime",
              selection_kind: "explicit",
              priority: 3,
              experiment_budget: 1,
              signal_score: 0,
              reasons: ["test_explicit_direction"]
            }
          );
          allocation.deferred_directions = [
            "funding_aware_risk",
            "execution_cost_robustness"
          ];
        }
        allocation.allocated_at = new Date(
          Date.parse("2026-01-01T00:00:00.000Z") + index * 86_400_000
        ).toISOString();
        allocation.allocation_digest = digest(
          candidateArenaResearchAllocationDigestInput(allocation)
        );
        return allocation;
      });
      for (const allocation of allocations) {
        await writeFile(
          path.join(
            allocationDir,
            `${encodeURIComponent(
              allocation.candidate_arena_research_allocation_id
            )}.json`
          ),
          `${JSON.stringify(allocation, null, 2)}\n`,
          "utf8"
        );
      }
      for (const allocation of allocations.slice(1)) {
        const tick = tickFixture(allocation, {
          direction_kind: "trend_following",
          status: "no_submission",
          finding: "Research finished without a selection."
        });
        tick.started_at = allocation.allocated_at;
        tick.completed_at = new Date(
          Date.parse(allocation.allocated_at) + 1_000
        ).toISOString();
        await writeFile(
          path.join(
            tickDir,
            `${encodeURIComponent(tick.candidate_arena_tick_id)}.json`
          ),
          `${JSON.stringify(tick, null, 2)}\n`,
          "utf8"
        );
      }
      const restarted = new LocalStore(root);
      await restarted.initialize();
      const readJson = vi.spyOn(
        restarted as unknown as {
          readJson(filePath: string): Promise<unknown>;
        },
        "readJson"
      );
      const readProjectionJson = vi.spyOn(
        restarted as unknown as {
          readBoundedResearchOperationsProjectionJson(
            filePath: string,
            tooLargeError: string
          ): Promise<unknown>;
        },
        "readBoundedResearchOperationsProjectionJson"
      );
      const service = stoppedService(restarted);

      const operations = await service.readOperations();

      expect(operations).toMatchObject({
        loop_status: "degraded",
        recorded_session_count: 367,
        projected_session_count: 100,
        omitted_session_count: 267,
        sessions_truncated: true
      });
      const stoppedTrieReads = readProjectionJson.mock.calls.filter(
        ([filePath]) => filePath.startsWith(path.join(
          root,
          "read-models",
          "research-operations",
          "trie"
        ))
      );
      expect(stoppedTrieReads.length).toBeGreaterThan(0);
      expect(stoppedTrieReads.length).toBeLessThanOrEqual(100 * 32);
      expect(new Set(stoppedTrieReads.map(([filePath]) => filePath)).size)
        .toBe(stoppedTrieReads.length);
      expect(readProjectionJson.mock.calls).toHaveLength(
        102 + stoppedTrieReads.length
      );
      expect(readProjectionJson.mock.calls.every(([filePath]) =>
        filePath.startsWith(path.join(root, "read-models", "research-operations"))
      )).toBe(true);

      readJson.mockClear();
      readProjectionJson.mockClear();
      const activeAllocation = allocations[0]!;
      const activeWorkItemId = researchWorkItemId({
        research_allocation_id:
          activeAllocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      const runningService = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "running",
          tick_count: 365,
          completed_tick_count: 364,
          active_tick: true,
          active_tick_id: activeAllocation.tick_id,
          active_research_work_items: [{
            identity_kind: "derived_projection",
            research_work_item_id: activeWorkItemId,
            research_allocation_id:
              activeAllocation.candidate_arena_research_allocation_id,
            direction_kind: "trend_following",
            phase: "allocating"
          }],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });
      const runningOperations = await runningService.readOperations();

      expect(runningOperations).toMatchObject({
        loop_status: "running",
        capacity: {
          active_session_count: 1,
          queued_session_count: 2
        },
        recorded_session_count: 367,
        projected_session_count: 100,
        omitted_session_count: 267
      });
      expect(runningOperations.sessions.some((session) =>
        session.research_work_item_id === activeWorkItemId
      )).toBe(false);
      const activeAllocationWorkItemIds = activeAllocation.selected_directions.map(
        (selection) => researchWorkItemId({
          research_allocation_id:
            activeAllocation.candidate_arena_research_allocation_id,
          direction_kind: selection.direction_kind
        })
      );
      const trieReads = readProjectionJson.mock.calls.filter(([filePath]) =>
        filePath.startsWith(path.join(
          root,
          "read-models",
          "research-operations",
          "trie"
        ))
      );
      expect(trieReads.length).toBeGreaterThan(0);
      expect(trieReads.length).toBeLessThanOrEqual(
        (100 + activeAllocationWorkItemIds.length) * 32
      );
      expect(new Set(trieReads.map(([filePath]) => filePath)).size)
        .toBe(trieReads.length);
      expect(readProjectionJson.mock.calls).toHaveLength(105 + trieReads.length);
      expect(readProjectionJson.mock.calls.every(([filePath]) =>
        filePath.startsWith(path.join(root, "read-models", "research-operations"))
      )).toBe(true);

      const terminalContinuationService = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "running",
          tick_count: 365,
          completed_tick_count: 365,
          active_tick: true,
          active_tick_id: allocations.at(-1)!.tick_id,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });
      await expect(terminalContinuationService.readOperations()).resolves
        .toMatchObject({
          capacity: {
            active_session_count: 0,
            queued_session_count: 0
          }
        });

      readJson.mockClear();
      readProjectionJson.mockClear();
      const exact = await service.readSessionDetail(researchWorkItemId({
        research_allocation_id:
          allocations[0]!.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      }));

      expect(exact).toMatchObject({
        research_allocation_id:
          allocations[0]!.candidate_arena_research_allocation_id,
        status: "recovering"
      });
      const exactTrieReads = readProjectionJson.mock.calls.filter(
        ([filePath]) => filePath.startsWith(path.join(
          root,
          "read-models",
          "research-operations",
          "trie"
        ))
      );
      expect(exactTrieReads.length).toBeGreaterThan(0);
      expect(exactTrieReads.length).toBeLessThanOrEqual(32);
      expect(readProjectionJson.mock.calls).toHaveLength(
        3 + exactTrieReads.length
      );
      expect(readProjectionJson.mock.calls.every(([filePath]) =>
        filePath.startsWith(path.join(root, "read-models", "research-operations"))
      )).toBe(true);

      const nextAllocation = allocationFixture("year-new");
      nextAllocation.allocated_at = "2027-01-01T00:00:00.000Z";
      nextAllocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(nextAllocation)
      );
      const nextAllocationPath = path.join(
        allocationDir,
        `${encodeURIComponent(
          nextAllocation.candidate_arena_research_allocation_id
        )}.json`
      );
      const writeJson = vi.spyOn(
        restarted as unknown as {
          writeJson(filePath: string, value: unknown): Promise<void>;
        },
        "writeJson"
      );
      const materialize = vi.spyOn(
        ResearchOperationsProjectionService.prototype,
        "materializeProjection"
      );
      readJson.mockClear();
      readProjectionJson.mockClear();

      await restarted.runResearchOperationsProjectionBatch(() =>
        restarted.recordCandidateArenaResearchAllocation(nextAllocation)
      );

      expect(materialize).toHaveBeenCalledTimes(1);
      expect(readJson.mock.calls.filter(([filePath]) =>
        (filePath.startsWith(allocationDir) || filePath.startsWith(tickDir)) &&
        filePath !== nextAllocationPath
      )).toEqual([]);
      expect(writeJson.mock.calls.map(([filePath]) => filePath)).toEqual([
        nextAllocationPath,
        path.join(
          root,
          "read-models",
          "research-operations",
          "items",
          `${encodeURIComponent(researchWorkItemId({
            research_allocation_id:
              nextAllocation.candidate_arena_research_allocation_id,
            direction_kind: "trend_following"
          }))}.json`
        ),
        path.join(
          root,
          "read-models",
          "research-operations",
          "trie",
          `${researchOperationsProjectionCapsuleRouteHash(researchWorkItemId({
            research_allocation_id:
              nextAllocation.candidate_arena_research_allocation_id,
            direction_kind: "trend_following"
          })).slice(0, 2)}.json`
        ),
        path.join(root, "read-models", "research-operations", "index.json")
      ]);
      writeJson.mockRestore();
      materialize.mockRestore();

      await rm(path.join(
        root,
        "read-models",
        "research-operations",
        "items",
        `${encodeURIComponent(activeWorkItemId)}.json`
      ), { force: true });
      await expect(runningService.readOperations()).rejects.toThrow(
        "research_operations_projection_capsule_missing"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a resealed off-page graph-conflict aggregate not derived from sources", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-off-page-aggregate-"
    ));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      const allocations = Array.from({ length: 101 }, (_, index) =>
        allocationFixture(`off-page-aggregate-${String(index).padStart(3, "0")}`)
      );
      await Promise.all(allocations.map((allocation) => writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            allocation.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      )));
      const store = new LocalStore(root);
      await store.initialize();
      const indexPath = path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      );
      const index = await readJsonFile<ResearchOperationsProjectionIndexRecord>(
        indexPath
      );
      expect(index).toMatchObject({
        recorded_session_count: 101,
        graph_conflict_count: 0,
        incomplete_without_conflict_count: 101
      });
      index.graph_conflict_count = 1;
      index.incomplete_without_conflict_count = 100;
      const { projection_digest: _projectionDigest, ...indexInput } = index;
      index.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

      await expect(stoppedService(store).readOperations()).rejects.toThrow(
        "research_operations_projection_source_mismatch"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a coordinated reseal of an off-page capsule tick identity", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-off-page-capsule-"
    ));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      const allocations = Array.from({ length: 101 }, (_, index) =>
        allocationFixture(`off-page-capsule-${String(index).padStart(3, "0")}`)
      );
      await Promise.all(allocations.map((allocation) => writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            allocation.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      )));
      const store = new LocalStore(root);
      await store.initialize();
      const projectionRoot = path.join(
        root,
        "read-models",
        "research-operations"
      );
      const indexPath = path.join(projectionRoot, "index.json");
      const index = await readJsonFile<ResearchOperationsProjectionIndexRecord>(
        indexPath
      );
      const headIds = new Set(index.head_session_refs.map((reference) =>
        reference.research_work_item_id
      ));
      const capsuleFiles = (await readdir(path.join(projectionRoot, "items")))
        .filter((entry) => entry.endsWith(".json"));
      const capsules = await Promise.all(capsuleFiles.map((entry) =>
        readJsonFile<ResearchOperationsProjectionCapsule>(path.join(
          projectionRoot,
          "items",
          entry
        ))
      ));
      const forged = capsules.find((capsule) =>
        !headIds.has(capsule.research_work_item_id)
      );
      expect(forged).toBeDefined();
      forged!.runtime_identity.tick_id = "tick-forged-off-page";
      forged!.inactive_detail.tick_id = "tick-forged-off-page";
      forged!.active_queued_detail.tick_id = "tick-forged-off-page";
      const { capsule_digest: _capsuleDigest, ...capsuleInput } = forged!;
      forged!.capsule_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(capsuleInput)
      );
      expect(researchOperationsProjectionCapsuleHasIntegrity(forged!)).toBe(true);

      const trie = materializeResearchOperationsProjectionCapsuleTrie(capsules);
      await Promise.all([
        writeFile(
          path.join(
            projectionRoot,
            "items",
            `${encodeURIComponent(forged!.research_work_item_id)}.json`
          ),
          `${JSON.stringify(forged, null, 2)}\n`,
          "utf8"
        ),
        ...trie.nodes.map((node) => writeFile(
          path.join(projectionRoot, "trie", `${node.prefix}.json`),
          `${JSON.stringify(node, null, 2)}\n`,
          "utf8"
        ))
      ]);
      index.capsule_trie_root_refs = trie.root_refs;
      index.capsule_set_digest = researchOperationsProjectionCapsuleTrieDigest(
        trie.root_refs
      );
      const { projection_digest: _projectionDigest, ...indexInput } = index;
      index.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

      await expect(stoppedService(store).readSessionDetail(
        forged!.research_work_item_id
      )).rejects.toThrow("research_operations_projection_source_mismatch");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects resealed allocation, commitment, and conflict fields not derived from sources", async () => {
    const mutations: Array<{
      label: string;
      mutate(
        capsule: ResearchOperationsProjectionCapsule,
        index: ResearchOperationsProjectionIndexRecord
      ): void;
    }> = [
      {
        label: "allocation-capacity",
        mutate: (capsule) => {
          capsule.runtime_identity.concurrency_limit += 1;
        }
      },
      {
        label: "commitment-identity",
        mutate: (capsule) => {
          const commitmentId = "research-preflight-forged-source-binding";
          capsule.runtime_identity.commitment_id = commitmentId;
          for (const detail of [
            capsule.inactive_detail,
            capsule.active_queued_detail
          ]) {
            detail.commitment_id = commitmentId;
            const event = detail.lifecycle_events.find((candidate) =>
              candidate.event_kind === "commitment"
            );
            expect(event).toBeDefined();
            event!.source_ref.id = commitmentId;
          }
        }
      },
      {
        label: "graph-conflict",
        mutate: (capsule, index) => {
          capsule.graph_conflict = true;
          for (const detail of [
            capsule.inactive_detail,
            capsule.active_queued_detail
          ]) {
            detail.degraded_reasons.push("admission_graph_conflict");
          }
          index.graph_conflict_count = 1;
          index.incomplete_without_conflict_count = 0;
        }
      }
    ];

    for (const mutation of mutations) {
      const root = await mkdtemp(path.join(
        os.tmpdir(),
        `ouroboros-research-source-binding-${mutation.label}-`
      ));
      try {
        const store = new LocalStore(root);
        await store.initialize();
        await persistBaseGraph(store, `source-binding-${mutation.label}`);
        const projectionRoot = path.join(
          root,
          "read-models",
          "research-operations"
        );
        const indexPath = path.join(projectionRoot, "index.json");
        const index = await readJsonFile<ResearchOperationsProjectionIndexRecord>(
          indexPath
        );
        expect(index.head_session_refs).toHaveLength(1);
        const workItemId = index.head_session_refs[0]!.research_work_item_id;
        const capsulePath = path.join(
          projectionRoot,
          "items",
          `${encodeURIComponent(workItemId)}.json`
        );
        const capsule = await readJsonFile<ResearchOperationsProjectionCapsule>(
          capsulePath
        );

        mutation.mutate(capsule, index);
        const { capsule_digest: _capsuleDigest, ...capsuleInput } = capsule;
        capsule.capsule_digest = digest(
          paperTradingComparisonPersistedRecordDigestInput(capsuleInput)
        );
        expect(
          researchOperationsProjectionCapsuleHasIntegrity(capsule),
          mutation.label
        ).toBe(true);
        const trie = materializeResearchOperationsProjectionCapsuleTrie([
          capsule
        ]);
        index.head_session_refs[0]!.capsule_digest = capsule.capsule_digest;
        index.capsule_trie_root_refs = trie.root_refs;
        index.capsule_set_digest = researchOperationsProjectionCapsuleTrieDigest(
          trie.root_refs
        );
        const { projection_digest: _projectionDigest, ...indexInput } = index;
        index.projection_digest = digest(
          paperTradingComparisonPersistedRecordDigestInput(indexInput)
        );
        await Promise.all([
          writeFile(capsulePath, `${JSON.stringify(capsule, null, 2)}\n`, "utf8"),
          ...trie.nodes.map((node) => writeFile(
            path.join(projectionRoot, "trie", `${node.prefix}.json`),
            `${JSON.stringify(node, null, 2)}\n`,
            "utf8"
          )),
          writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8")
        ]);

        await expect(stoppedService(store).readSessionDetail(workItemId))
          .rejects.toThrow("research_operations_projection_source_mismatch");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("binds an exact active session when its open tick is omitted from the bounded root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-open-bound-"));
    try {
      const allocationDir = path.join(
        root,
        "candidate-arena-research-allocations",
        "items"
      );
      await mkdir(allocationDir, { recursive: true });
      const allocations = Array.from({ length: 1_501 }, (_, index) => {
        const allocation = allocationFixture(
          `open-${String(index).padStart(4, "0")}`
        );
        if (index === 0) {
          allocation.selected_directions = [
            allocation.selected_directions[0]!,
            {
              ...allocation.selected_directions[0]!,
              direction_kind: "mean_reversion",
              priority: 2
            },
            {
              ...allocation.selected_directions[0]!,
              direction_kind: "volatility_regime",
              priority: 3
            }
          ];
          allocation.deferred_directions = [
            "funding_aware_risk",
            "execution_cost_robustness"
          ];
        }
        allocation.allocated_at = new Date(
          Date.parse("2026-01-01T00:00:00.000Z") + index * 1_000
        ).toISOString();
        allocation.allocation_digest = digest(
          candidateArenaResearchAllocationDigestInput(allocation)
        );
        return allocation;
      });
      await Promise.all(allocations.map((allocation) => writeFile(
        path.join(
          allocationDir,
          `${encodeURIComponent(
            allocation.candidate_arena_research_allocation_id
          )}.json`
        ),
        `${JSON.stringify(allocation, null, 2)}\n`,
        "utf8"
      )));
      const restarted = new LocalStore(root);
      await restarted.initialize();
      const index = JSON.parse(await readFile(path.join(
        root,
        "read-models",
        "research-operations",
        "index.json"
      ), "utf8")) as {
        open_tick_session_refs: Array<{ tick_id: string }>;
        open_tick_session_count: number;
        projected_open_tick_session_count: number;
        omitted_open_tick_session_count: number;
        open_tick_sessions_truncated: boolean;
      };
      const activeAllocation = allocations[0]!;
      const activeWorkItemId = researchWorkItemId({
        research_allocation_id:
          activeAllocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      });
      expect(index).toMatchObject({
        open_tick_session_count: 1_503,
        projected_open_tick_session_count: 100,
        omitted_open_tick_session_count: 1_403,
        open_tick_sessions_truncated: true
      });
      expect(index.open_tick_session_refs.some((reference) =>
        reference.tick_id === activeAllocation.tick_id
      )).toBe(false);

      const runningService = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "running",
          tick_count: 1_501,
          completed_tick_count: 0,
          active_tick: true,
          active_tick_id: activeAllocation.tick_id,
          active_research_work_items: [{
            identity_kind: "derived_projection",
            research_work_item_id: activeWorkItemId,
            research_allocation_id:
              activeAllocation.candidate_arena_research_allocation_id,
            direction_kind: "trend_following",
            phase: "allocating"
          }],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      await expect(runningService.readOperations()).resolves.toMatchObject({
        availability: "available",
        recorded_session_count: 1_503,
        capacity: {
          active_session_count: 1,
          queued_session_count: 2
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("rejects active tick siblings with conflicting allocation capacity provenance", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-research-active-sibling-provenance-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const allocation = allocationFixture("active-sibling-provenance");
      allocation.selected_directions.push({
        ...allocation.selected_directions[0]!,
        direction_kind: "mean_reversion",
        priority: 2
      });
      allocation.deferred_directions = allocation.deferred_directions.filter(
        (direction) => direction !== "mean_reversion"
      );
      allocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(allocation)
      );
      await store.recordCandidateArenaResearchAllocation(allocation);

      const projectionRoot = path.join(
        root,
        "read-models",
        "research-operations"
      );
      const workItemIds = allocation.selected_directions.map((selection) =>
        researchWorkItemId({
          research_allocation_id:
            allocation.candidate_arena_research_allocation_id,
          direction_kind: selection.direction_kind
        })
      ).sort();
      const capsules = await Promise.all(workItemIds.map((workItemId) =>
        readJsonFile<ResearchOperationsProjectionCapsule>(path.join(
          projectionRoot,
          "items",
          `${encodeURIComponent(workItemId)}.json`
        ))
      ));
      const forged = capsules[1]!;
      forged.runtime_identity.concurrency_limit += 1;
      const { capsule_digest: _capsuleDigest, ...capsuleInput } = forged;
      forged.capsule_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(capsuleInput)
      );

      const trie = materializeResearchOperationsProjectionCapsuleTrie(capsules);
      await Promise.all([
        writeFile(
          path.join(
            projectionRoot,
            "items",
            `${encodeURIComponent(forged.research_work_item_id)}.json`
          ),
          `${JSON.stringify(forged, null, 2)}\n`,
          "utf8"
        ),
        ...trie.nodes.map((node) => writeFile(
          path.join(projectionRoot, "trie", `${node.prefix}.json`),
          `${JSON.stringify(node, null, 2)}\n`,
          "utf8"
        ))
      ]);
      const indexPath = path.join(projectionRoot, "index.json");
      const index = await readJsonFile<ResearchOperationsProjectionIndexRecord>(
        indexPath
      );
      const capsuleDigests = new Map(capsules.map((capsule) => [
        capsule.research_work_item_id,
        capsule.capsule_digest
      ]));
      for (const reference of index.head_session_refs) {
        reference.capsule_digest = capsuleDigests.get(
          reference.research_work_item_id
        )!;
      }
      index.capsule_trie_root_refs = trie.root_refs;
      index.capsule_set_digest = researchOperationsProjectionCapsuleTrieDigest(
        trie.root_refs
      );
      const { projection_digest: _projectionDigest, ...indexInput } = index;
      index.projection_digest = digest(
        paperTradingComparisonPersistedRecordDigestInput(indexInput)
      );
      await writeFile(
        indexPath,
        `${JSON.stringify(index, null, 2)}\n`,
        "utf8"
      );

      const runningService = new ResearchOperationsProjectionService({
        store,
        runnerHealth: () => ({
          status: "running",
          tick_count: 1,
          completed_tick_count: 0,
          active_tick: true,
          active_tick_id: allocation.tick_id,
          active_research_work_items: [{
            identity_kind: "derived_projection",
            research_work_item_id: workItemIds[0]!,
            research_allocation_id:
              allocation.candidate_arena_research_allocation_id,
            direction_kind: allocation.selected_directions[0]!.direction_kind,
            phase: "allocating"
          }],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      await expect(runningService.readOperations()).rejects.toThrow(
        "research_operations_projection_active_tick_siblings_mismatch"
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart-projects every canonical terminal graph written by LocalStore", async () => {
    const cases: Array<{
      kind: OracleCase;
      expectedStatus: string;
      expectedBasis: string;
      expectsTick: boolean;
    }> = [
      {
        kind: "admitted",
        expectedStatus: "admitted",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "duplicate",
        expectedStatus: "duplicate",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "quarantined",
        expectedStatus: "quarantined",
        expectedBasis: "candidate_admission_decision",
        expectsTick: true
      },
      {
        kind: "finished_without_submission",
        expectedStatus: "finished_without_submission",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: true
      },
      {
        kind: "execution_failed",
        expectedStatus: "failed_closed",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: true
      },
      {
        kind: "restart_recovery",
        expectedStatus: "failed_closed",
        expectedBasis: "research_worker_checkpoint",
        expectsTick: false
      }
    ];

    for (const testCase of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-research-operations-"));
      try {
        const store = new LocalStore(root);
        await store.initialize();
        const graph = await persistBaseGraph(store, testCase.kind);
        if (testCase.kind === "admitted" || testCase.kind === "duplicate" ||
          testCase.kind === "quarantined") {
          await persistAdmissionClosure(store, graph, testCase.kind);
        } else {
          await persistNonAdmissionClosure(store, graph, testCase.kind);
        }

        const restarted = new LocalStore(root);
        await restarted.initialize();
        const service = new ResearchOperationsProjectionService({
          store: restarted,
          runnerHealth: () => ({
            status: "stopped",
            tick_count: testCase.expectsTick ? 1 : 0,
            completed_tick_count: testCase.expectsTick ? 1 : 0,
            active_tick: false,
            active_research_work_items: [],
            consecutive_failure_count: 0,
            runtime_coordination_authority: true,
            evaluation_authority: false,
            promotion_authority: false,
            order_submission_authority: false,
            live_exchange_authority: false,
            authority_status: "runtime_coordination_only"
          })
        });

        const operations = await service.readOperations();
        expect(operations.sessions, testCase.kind).toHaveLength(1);
        expect(operations.sessions[0], testCase.kind).toMatchObject({
          status: testCase.expectedStatus,
          status_basis: { basis_kind: testCase.expectedBasis }
        });
        const detail = await service.readSessionDetail(
          operations.sessions[0]!.research_work_item_id
        );
        expectTerminalAuthorityMatrix(detail, testCase.kind);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("rejects a distinct admission ID rebinding one commitment and Evaluation after restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-restart-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-restart-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);

      const restarted = new LocalStore(root);
      await expect(restarted.recordCandidateAdmissionDecision(
        structuredClone(admission)
      )).resolves.toEqual(admission);
      const rebound = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-restart-second-owner"
      };

      await expect(restarted.recordCandidateAdmissionDecision(rebound)).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id: rebound.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          research_preflight_commitment_id:
            graph.commitment.research_preflight_commitment_id,
          trading_evaluation_result_id: admission.trading_evaluation_result_ref.id
        }
      });
      await expect(restarted.listCandidateAdmissionDecisions()).resolves.toEqual([admission]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a distinct admission ID sharing only the Evaluation identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-evaluation-owner-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-evaluation-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);

      const legacyEvaluationOwner = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-evaluation-second-owner",
        research_preflight_commitment_ref: undefined,
        research_preflight_commitment_digest: undefined
      };

      await expect(new LocalStore(root).recordCandidateAdmissionDecision(
        legacyEvaluationOwner
      )).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id:
            legacyEvaluationOwner.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          trading_evaluation_result_id: admission.trading_evaluation_result_ref.id
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a distinct admission ID sharing only the commitment identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-commitment-owner-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-commitment-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted", {
        prepareOnly: true
      });
      await store.recordCandidateAdmissionDecision(admission);
      const alternateEvaluationId = "evaluation-admitted-commitment-owner";
      const alternateFindingId = "finding-admitted-commitment-owner";
      const persistedEvaluation = JSON.parse(await readFile(path.join(
        root,
        "trading-evaluation-results",
        "items",
        `${admission.trading_evaluation_result_ref.id}.json`
      ), "utf8")) as TradingEvaluationResultRecord;
      const alternateEvaluation = {
        ...persistedEvaluation,
        trading_evaluation_result_id: alternateEvaluationId
      };
      await writeFile(
        path.join(
          root,
          "trading-evaluation-results",
          "items",
          `${alternateEvaluationId}.json`
        ),
        `${JSON.stringify(alternateEvaluation, null, 2)}\n`,
        "utf8"
      );
      const persistedFinding = JSON.parse(await readFile(path.join(
        root,
        "research-findings",
        "items",
        `${admission.research_finding_ref.id}.json`
      ), "utf8")) as ResearchFindingRecord;
      const alternateFinding: ResearchFindingRecord = {
        ...persistedFinding,
        research_finding_id: alternateFindingId,
        trading_evaluation_result_ref: ref(
          "trading_evaluation_result",
          alternateEvaluationId
        ),
        supporting_record_refs: persistedFinding.supporting_record_refs.map((supportingRef) =>
          supportingRef.record_kind === "trading_evaluation_result"
            ? ref("trading_evaluation_result", alternateEvaluationId)
            : supportingRef
        )
      };
      await writeFile(
        path.join(root, "research-findings", "items", `${alternateFindingId}.json`),
        `${JSON.stringify(alternateFinding, null, 2)}\n`,
        "utf8"
      );
      const commitmentOwner = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-commitment-second-owner",
        trading_evaluation_result_ref: ref(
          "trading_evaluation_result",
          alternateEvaluationId
        ),
        research_finding_ref: ref("research_finding", alternateFindingId)
      };

      await expect(new LocalStore(root).recordCandidateAdmissionDecision(
        commitmentOwner
      )).rejects.toMatchObject({
        code: "candidate_admission_graph_conflict",
        details: {
          candidate_admission_decision_id:
            commitmentOwner.candidate_admission_decision_id,
          conflicting_candidate_admission_decision_id:
            admission.candidate_admission_decision_id,
          research_preflight_commitment_id:
            graph.commitment.research_preflight_commitment_id,
          trading_evaluation_result_id: alternateEvaluationId
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("admits only one distinct ID when separate LocalStore writers race for one graph", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-race-"));
    try {
      const preparationStore = new LocalStore(root);
      await preparationStore.initialize();
      const graph = await persistBaseGraph(preparationStore, "admission-race-owner");
      const first = await persistAdmissionClosure(
        preparationStore,
        graph,
        "admitted",
        { prepareOnly: true }
      );
      const second = {
        ...structuredClone(first),
        candidate_admission_decision_id: "admission-race-second-owner"
      };
      const firstWriter = new LocalStore(root);
      const secondWriter = new LocalStore(root);

      const results = await Promise.allSettled([
        firstWriter.recordCandidateAdmissionDecision(first),
        secondWriter.recordCandidateAdmissionDecision(second)
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toMatchObject({
        code: "candidate_admission_graph_conflict"
      });
      const persisted = await new LocalStore(root).listCandidateAdmissionDecisions();
      expect(persisted).toHaveLength(1);
      expect([
        first.candidate_admission_decision_id,
        second.candidate_admission_decision_id
      ]).toContain(persisted[0]!.candidate_admission_decision_id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart-projects legacy duplicate admission owners as an explicit graph conflict", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-admission-legacy-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "admission-legacy-owner");
      const admission = await persistAdmissionClosure(store, graph, "admitted");
      const legacyDuplicate = {
        ...structuredClone(admission),
        candidate_admission_decision_id: "admission-legacy-second-owner"
      };
      await writeFile(
        path.join(
          root,
          "candidate-admission-decisions",
          "items",
          `${legacyDuplicate.candidate_admission_decision_id}.json`
        ),
        `${JSON.stringify(legacyDuplicate, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(restarted.listCandidateAdmissionDecisions()).resolves.toHaveLength(2);
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );

      expect(detail).toMatchObject({
        status: "recovering",
        projection_health: "degraded",
        selected_artifact_availability: "unavailable",
        degraded_reasons: expect.arrayContaining([
          "admission_graph_conflict",
          "selected_artifact_unavailable",
          "terminal_admission_unavailable",
          "inactive_incomplete_graph"
        ])
      });
      expect(detail?.terminal_graph).not.toHaveProperty("admission");
      expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart-projects a memory-control duplicate with a distinct source closure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-memory-control-operations-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const { graph, study } = await persistMemoryControlBaseGraph(store);
      expect(graph.source.artifact_digest).not.toBe(
        study.source.research_artifact_closure_digest
      );
      await persistAdmissionClosure(store, graph, "duplicate");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]).toMatchObject({
        status: "duplicate",
        status_basis: { basis_kind: "candidate_admission_decision" }
      });
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expectTerminalAuthorityMatrix(detail, "duplicate");
      expect(detail?.terminal_graph).toMatchObject({
        selected_sealed_evaluation: {
          trading_evaluation_result_ref: { id: "evaluation-duplicate" }
        },
        admission: {
          candidate_admission_decision_ref: { id: "admission-duplicate" },
          status: "duplicate"
        },
        finding: {
          research_finding_ref: { id: "finding-duplicate" }
        }
      });
      expect(detail?.lifecycle_events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event_kind: "checkpoint" }),
        expect.objectContaining({ event_kind: "tick" })
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a persisted Evaluation corrupted to predate commitment", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-evaluation-corruption-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "corrupt-evaluation-chronology");
      await persistAdmissionClosure(store, graph, "admitted");
      const evaluationPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        "evaluation-admitted.json"
      );
      const persisted = JSON.parse(await readFile(evaluationPath, "utf8")) as
        TradingEvaluationResultRecord;
      persisted.completed_at = "2026-07-23T00:00:00.999Z";
      expect(Date.parse(persisted.completed_at)).toBeLessThan(
        Date.parse(graph.commitment.committed_at)
      );
      await writeFile(evaluationPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]!.status).not.toBe("admitted");
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expect(detail?.budget.completed_experiment_count).toBe(1);
      expectNoTerminalAuthority(detail, "unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a valid terminal beside a second raw Evaluation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-evaluation-ambiguity-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "duplicate-evaluation-corruption");
      await persistAdmissionClosure(store, graph, "admitted");
      const validPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        "evaluation-admitted.json"
      );
      const sibling = JSON.parse(await readFile(validPath, "utf8")) as
        TradingEvaluationResultRecord;
      sibling.trading_evaluation_result_id = "evaluation-admitted-raw-sibling";
      sibling.submitted_artifact_digest = "malformed-second-terminal";
      sibling.completed_at = "2026-07-23T00:00:00.999Z";
      const siblingPath = path.join(
        root,
        "trading-evaluation-results",
        "items",
        `${encodeURIComponent(sibling.trading_evaluation_result_id)}.json`
      );
      await writeFile(siblingPath, `${JSON.stringify(sibling, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const service = new ResearchOperationsProjectionService({
        store: restarted,
        runnerHealth: () => ({
          status: "stopped",
          tick_count: 1,
          completed_tick_count: 1,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        })
      });

      const operations = await service.readOperations();
      expect(operations.sessions).toHaveLength(1);
      expect(operations.sessions[0]).toMatchObject({
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      expect(operations.sessions[0]!.status).not.toBe("admitted");
      const detail = await service.readSessionDetail(
        operations.sessions[0]!.research_work_item_id
      );
      expect(detail?.budget.completed_experiment_count).toBe(1);
      expectNoTerminalAuthority(detail, "unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses every allocation whose persisted origin ID is duplicated", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-allocation-origin-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "duplicate-allocation-origin");
      await persistAdmissionClosure(store, graph, "admitted");
      const allocationPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(graph.allocation.candidate_arena_research_allocation_id)}.json`
      );
      const copiedPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        "copied-allocation-origin.json"
      );
      await writeFile(copiedPath, await readFile(allocationPath, "utf8"), "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      expect(await restarted.listCandidateArenaResearchAllocations()).toHaveLength(2);
      const service = stoppedService(restarted);

      await expect(service.readOperations()).resolves.toMatchObject({ sessions: [] });
      await expect(service.readSessionDetail(researchWorkItemId({
        research_allocation_id:
          graph.allocation.candidate_arena_research_allocation_id,
        direction_kind: "trend_following"
      }))).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses both Arena-event allocations that claim one canonical evidence digest", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-arena-event-evidence-ownership-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const findings = [
        standaloneFinding("arena-event-first", "2026-07-22T23:59:58.000Z"),
        standaloneFinding("arena-event-second", "2026-07-22T23:59:59.000Z")
      ];
      await Promise.all(findings.map((finding) =>
        store.recordResearchFinding(finding)
      ));
      const evidence = findings.map(findingEvidenceArtifact);
      await Promise.all(evidence.map((artifact) =>
        store.recordResearchEvidenceArtifact(artifact)
      ));
      const allocations = [
        allocationFixture("arena-event-first"),
        allocationFixture("arena-event-second")
      ];
      allocations.forEach((allocation, index) => {
        const artifact = evidence[index]!;
        allocation.trigger = {
          trigger_kind: "arena_event",
          trigger_id: `arena-event-trigger-${index + 1}`,
          goal: "Respond to one exact sanitized Arena event.",
          triggered_at: allocation.allocated_at,
          source_ref: { ...artifact.artifact_ref },
          evidence_artifact_ref: ref(
            "research_evidence_artifact",
            artifact.research_evidence_artifact_id
          ) as {
            record_kind: "research_evidence_artifact";
            id: string;
          },
          evidence_artifact_digest: artifact.artifact_digest,
          authority_status: "research_only"
        };
        allocation.allocation_digest = digest(
          candidateArenaResearchAllocationDigestInput(allocation)
        );
      });
      for (const allocation of allocations) {
        await store.recordCandidateArenaResearchAllocation(allocation);
      }
      expect((await stoppedService(store).readOperations()).sessions).toHaveLength(2);

      const aliasedEvidence = structuredClone(evidence[0]!);
      aliasedEvidence.research_evidence_artifact_id =
        evidence[1]!.research_evidence_artifact_id;
      const secondEvidencePath = path.join(
        root,
        "research-evidence-artifacts",
        "items",
        `${encodeURIComponent(aliasedEvidence.research_evidence_artifact_id)}.json`
      );
      await writeFile(
        secondEvidencePath,
        `${JSON.stringify(aliasedEvidence, null, 2)}\n`,
        "utf8"
      );

      const secondAllocation = allocations[1]!;
      secondAllocation.trigger!.source_ref = {
        ...aliasedEvidence.artifact_ref
      };
      secondAllocation.trigger!.evidence_artifact_digest =
        aliasedEvidence.artifact_digest;
      secondAllocation.allocation_digest = digest(
        candidateArenaResearchAllocationDigestInput(secondAllocation)
      );
      const secondAllocationPath = path.join(
        root,
        "candidate-arena-research-allocations",
        "items",
        `${encodeURIComponent(
          secondAllocation.candidate_arena_research_allocation_id
        )}.json`
      );
      await writeFile(
        secondAllocationPath,
        `${JSON.stringify(secondAllocation, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      const reloadedEvidence = await restarted.listResearchEvidenceArtifacts();
      expect(reloadedEvidence).toHaveLength(2);
      expect(new Set(reloadedEvidence.map((artifact) =>
        artifact.artifact_digest)).size).toBe(1);
      const reloadedAllocations =
        await restarted.listCandidateArenaResearchAllocations();
      expect(reloadedAllocations).toHaveLength(2);
      expect(new Set(reloadedAllocations.map((allocation) =>
        allocation.trigger?.evidence_artifact_digest)).size).toBe(1);

      const service = stoppedService(restarted);
      const operations = await service.readOperations();
      expect(operations.sessions).toEqual([]);
      expect(operations).not.toHaveProperty("latest_session_id");
      for (const allocation of allocations) {
        await expect(service.readSessionDetail(researchWorkItemId({
          research_allocation_id:
            allocation.candidate_arena_research_allocation_id,
          direction_kind: "trend_following"
        }))).resolves.toBeUndefined();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart fails both commitment owners closed when sealed material is reused", async () => {
    for (const field of ["rotation_commitment_digest", "suite_digest"] as const) {
      const root = await mkdtemp(path.join(os.tmpdir(), `ouroboros-sealed-${field}-`));
      try {
        const store = new LocalStore(root);
        await store.initialize();
        const original = await persistBaseGraph(store, `sealed-original-${field}`);
        await persistAdmissionClosure(store, original, "admitted");
        const sibling = await persistBaseGraph(store, `sealed-sibling-${field}`);
        const baseline = await stoppedService(store).readOperations();
        expect(baseline.sessions.find((session) => session.research_allocation_id ===
          original.allocation.candidate_arena_research_allocation_id)?.status).toBe("admitted");
        const siblingPath = path.join(
          root,
          "research-preflight-commitments",
          "items",
          `${encodeURIComponent(sibling.commitment.research_preflight_commitment_id)}.json`
        );
        const persisted = JSON.parse(await readFile(siblingPath, "utf8")) as
          ResearchPreflightCommitmentRecord;
        persisted.sealed_admission_policy[field] =
          original.commitment.sealed_admission_policy[field];
        persisted.commitment_digest = digest(
          researchPreflightCommitmentDigestInput(persisted)
        );
        await writeFile(siblingPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

        const restarted = new LocalStore(root);
        await restarted.initialize();
        const commitments = await restarted.listResearchPreflightCommitments();
        expect(commitments).toHaveLength(2);
        expect(new Set(commitments.map((entry) =>
          entry.research_preflight_commitment_id)).size).toBe(2);
        expect(new Set(commitments.map((entry) => entry.research_allocation_ref.id)).size)
          .toBe(2);
        expect(new Set(commitments.map((entry) =>
          entry.sealed_admission_policy[field])).size).toBe(1);
        const operations = await stoppedService(restarted).readOperations();
        expect(operations.sessions).toHaveLength(2);
        for (const allocation of [original.allocation, sibling.allocation]) {
          const row = operations.sessions.find((session) =>
            session.research_allocation_id ===
              allocation.candidate_arena_research_allocation_id
          );
          expect(row, field).toMatchObject({
            status: "recovering",
            status_basis: { basis_kind: "incomplete_persisted_graph" },
            projection_health: "degraded",
            degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
          });
          const selectedArtifactAvailability =
            allocation.candidate_arena_research_allocation_id ===
              original.allocation.candidate_arena_research_allocation_id
            ? "unavailable"
            : "not_selected";
          expectNoTerminalAuthority(await stoppedService(restarted).readSessionDetail(
            row!.research_work_item_id
          ), selectedArtifactAvailability);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("restart suppresses a descendant terminal when its prior checkpoint has two raw owners", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-checkpoint-ownership-"));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const prior = await persistBaseGraph(store, "checkpoint-prior");
      await persistNonAdmissionClosure(store, prior, "finished_without_submission");
      const priorCheckpoint = (await store.listResearchWorkerCheckpoints()).find((candidate) =>
        candidate.research_preflight_commitment_ref.id ===
          prior.commitment.research_preflight_commitment_id
      )!;
      const currentAllocation = allocationFixture("z-checkpoint-current");
      const currentSource = systemCode(
        "source-code-z-checkpoint-current",
        digest("source-z-checkpoint-current"),
        "2026-07-23T00:00:00.000Z"
      );
      const currentCommitment = structuredClone(prior.commitment);
      currentCommitment.research_preflight_commitment_id =
        "research-preflight-z-checkpoint-current";
      currentCommitment.candidate_arena_tick_id = currentAllocation.tick_id;
      currentCommitment.research_allocation_ref = ref(
        "candidate_arena_research_allocation",
        currentAllocation.candidate_arena_research_allocation_id
      );
      currentCommitment.research_allocation_digest = currentAllocation.allocation_digest;
      currentCommitment.source_system_code_ref = ref(
        "system_code",
        currentSource.system_code_id
      );
      currentCommitment.source_artifact_digest = currentSource.artifact_digest;
      currentCommitment.development_policy.suite_digest =
        digest("development-z-checkpoint-current");
      currentCommitment.sealed_admission_policy.rotation_commitment_digest =
        digest("rotation-z-checkpoint-current");
      currentCommitment.sealed_admission_policy.suite_digest =
        digest("sealed-z-checkpoint-current");
      currentCommitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(currentCommitment)
      );
      const current: BaseGraph = {
        allocation: currentAllocation,
        direction: prior.direction,
        worker: prior.worker,
        source: currentSource,
        commitment: currentCommitment
      };
      await store.recordCandidateArenaResearchAllocation(currentAllocation);
      await store.recordSystemCode(currentSource);
      await store.recordResearchPreflightCommitment(currentCommitment);
      await persistAdmissionClosure(store, current, "admitted", {
        priorCheckpoint
      });
      const baseline = await stoppedService(store).readOperations();
      expect(baseline.sessions.find((session) => session.research_allocation_id ===
        currentAllocation.candidate_arena_research_allocation_id)?.status).toBe("admitted");

      const duplicate = structuredClone(priorCheckpoint);
      duplicate.research_worker_checkpoint_id =
        `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
      duplicate.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(duplicate));
      const duplicatePath = path.join(
        root,
        "research-worker-checkpoints",
        "items",
        `${encodeURIComponent(duplicate.research_worker_checkpoint_id)}.json`
      );
      await writeFile(duplicatePath, `${JSON.stringify(duplicate, null, 2)}\n`, "utf8");

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(restarted.listResearchWorkerCheckpoints()).rejects
        .toMatchObject({
          code: "research_worker_checkpoint_reload_failed",
          details: {
            duplicate_commitment_ids: [
              prior.commitment.research_preflight_commitment_id
            ]
          }
        });
      const operations = await stoppedService(restarted).readOperations();
      const currentRow = operations.sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(currentRow).toMatchObject({
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      const detail = await stoppedService(restarted).readSessionDetail(
        currentRow!.research_work_item_id
      );
      expectNoTerminalAuthority(detail, "unavailable");
      expect(detail?.submission_history_availability).toBe("unavailable_until_checkpoint");
      expect(detail?.development_submissions).toEqual([]);
      expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
        expect.arrayContaining(["evaluation", "checkpoint", "handoff_conformance", "admission"])
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects raw duplicate checkpoint identities before lifecycle recovery", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-checkpoint-identity-ownership-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const graph = await persistBaseGraph(store, "checkpoint-identity-owner");
      const checkpoint = checkpointFixture(graph, {
        terminalReason: "finished_without_submission"
      });
      await store.recordResearchWorkerCheckpoint(checkpoint);
      const duplicatePath = path.join(
        root,
        "research-worker-checkpoints",
        "items",
        "raw-alias-for-checkpoint.json"
      );
      await writeFile(
        duplicatePath,
        `${JSON.stringify(checkpoint, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(restarted.listResearchWorkerCheckpoints()).rejects
        .toMatchObject({
          code: "research_worker_checkpoint_reload_failed",
          details: {
            duplicate_checkpoint_ids: [
              checkpoint.research_worker_checkpoint_id
            ],
            duplicate_commitment_ids: [
              checkpoint.research_preflight_commitment_ref.id
            ]
          }
        });
      await expect(restarted.getResearchWorkerCheckpoint(
        checkpoint.research_worker_checkpoint_id
      )).rejects.toMatchObject({
        code: "research_worker_checkpoint_reload_failed"
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restart suppresses a memory descendant for duplicate prior checkpoints without a current checkpoint", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-memory-prior-no-current-checkpoint-"
    ));
    try {
      const store = new LocalStore(root);
      await store.initialize();
      const prior = await persistBaseGraph(store, "memory-prior-no-current");
      const priorCheckpoint = checkpointFixture(prior, {
        terminalReason: "finished_without_submission"
      });
      priorCheckpoint.closed_at = "2026-07-23T00:00:01.500Z";
      priorCheckpoint.checkpoint_digest = digest(
        researchWorkerCheckpointDigestInput(priorCheckpoint)
      );
      await store.recordResearchWorkerCheckpoint(priorCheckpoint);

      const currentAllocation = allocationFixture("z-memory-current-no-checkpoint");
      const currentSource = systemCode(
        "source-code-z-memory-current-no-checkpoint",
        digest("source-z-memory-current-no-checkpoint"),
        "2026-07-23T00:00:00.000Z"
      );
      const currentCommitment = structuredClone(prior.commitment);
      currentCommitment.research_preflight_commitment_id =
        "research-preflight-z-memory-current-no-checkpoint";
      currentCommitment.candidate_arena_tick_id = currentAllocation.tick_id;
      currentCommitment.research_allocation_ref = ref(
        "candidate_arena_research_allocation",
        currentAllocation.candidate_arena_research_allocation_id
      );
      currentCommitment.research_allocation_digest =
        currentAllocation.allocation_digest;
      currentCommitment.source_system_code_ref = ref(
        "system_code",
        currentSource.system_code_id
      );
      currentCommitment.source_artifact_digest = currentSource.artifact_digest;
      currentCommitment.development_policy.suite_digest =
        digest("development-z-memory-current-no-checkpoint");
      currentCommitment.sealed_admission_policy.rotation_commitment_digest =
        digest("rotation-z-memory-current-no-checkpoint");
      currentCommitment.sealed_admission_policy.suite_digest =
        digest("sealed-z-memory-current-no-checkpoint");
      currentCommitment.memory_policy = {
        protocol_version: "research_worker_memory_v1",
        memory_mode: "released_memory",
        memory_source_digest: digest("memory-z-current-source"),
        available_memory_item_count: 1,
        arena_context_digest: digest("memory-z-current-context"),
        prior_checkpoint: {
          disposition: "included",
          checkpoint_ref: ref(
            "research_worker_checkpoint",
            priorCheckpoint.research_worker_checkpoint_id
          ),
          checkpoint_digest: priorCheckpoint.checkpoint_digest
        }
      };
      currentCommitment.committed_at = priorCheckpoint.closed_at;
      currentCommitment.commitment_digest = digest(
        researchPreflightCommitmentDigestInput(currentCommitment)
      );
      const current: BaseGraph = {
        allocation: currentAllocation,
        direction: prior.direction,
        worker: prior.worker,
        source: currentSource,
        commitment: currentCommitment
      };
      await store.recordCandidateArenaResearchAllocation(currentAllocation);
      await store.recordSystemCode(currentSource);
      await store.recordResearchPreflightCommitment(currentCommitment);
      await persistAdmissionClosure(store, current, "admitted", {
        recordCheckpoint: false
      });

      const cleanService = stoppedService(store);
      const cleanRow = (await cleanService.readOperations()).sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(cleanRow).toMatchObject({ status: "admitted" });
      const cleanDetail = await cleanService.readSessionDetail(
        cleanRow!.research_work_item_id
      );
      expect(cleanDetail).toMatchObject({
        submission_history_availability: "unavailable_until_checkpoint",
        selected_artifact_availability: "available"
      });
      expect(cleanDetail?.lifecycle_events.map((event) => event.event_kind))
        .not.toContain("checkpoint");

      const duplicate = structuredClone(priorCheckpoint);
      duplicate.research_worker_checkpoint_id =
        `zz-duplicate-${priorCheckpoint.research_worker_checkpoint_id}`;
      duplicate.checkpoint_digest = digest(
        researchWorkerCheckpointDigestInput(duplicate)
      );
      const duplicatePath = path.join(
        root,
        "research-worker-checkpoints",
        "items",
        `${encodeURIComponent(duplicate.research_worker_checkpoint_id)}.json`
      );
      await writeFile(
        duplicatePath,
        `${JSON.stringify(duplicate, null, 2)}\n`,
        "utf8"
      );

      const restarted = new LocalStore(root);
      await restarted.initialize();
      await expect(restarted.listResearchWorkerCheckpoints()).rejects
        .toMatchObject({
          code: "research_worker_checkpoint_reload_failed",
          details: {
            duplicate_commitment_ids: [
              prior.commitment.research_preflight_commitment_id
            ]
          }
        });
      const restartedService = stoppedService(restarted);
      const currentRow = (await restartedService.readOperations()).sessions.find((session) =>
        session.research_allocation_id ===
          currentAllocation.candidate_arena_research_allocation_id
      );
      expect(currentRow).toMatchObject({
        status_basis: { basis_kind: "incomplete_persisted_graph" },
        projection_health: "degraded",
        degraded_reasons: expect.arrayContaining(["inactive_incomplete_graph"])
      });
      const detail = await restartedService.readSessionDetail(
        currentRow!.research_work_item_id
      );
      expectNoTerminalAuthority(detail, "unavailable");
      expect(detail).toMatchObject({
        degraded_reasons: expect.arrayContaining(["selected_artifact_unavailable"]),
        submission_history_availability: "unavailable_until_checkpoint",
        development_submissions: []
      });
      expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
        expect.arrayContaining([
          "evaluation",
          "checkpoint",
          "handoff_conformance",
          "admission"
        ])
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

const projectionWriterOutput = new WeakMap<ChildProcess, {
  stdout: string[];
  stderr: string[];
}>();

type ProjectionWriterOutcome =
  | { status: "recorded" }
  | { status: "rejected"; code?: string; message?: string };

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function waitForCurrentProcessProjectionLockClaim(
  root: string,
  timeoutMs = 10_000
): Promise<void> {
  const lockRoot = path.join(
    root,
    ".locks",
    "research-operations-projection-publication"
  );
  const claimPrefix = `claim-${process.pid}-`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await readdir(lockRoot)).some((entry) =>
        entry.startsWith(claimPrefix)
      )) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("LocalStore did not wait on the projection publication lock");
}

function spawnProjectionSourceCacheReader(input: {
  root: string;
  collection: string;
  resultPath: string;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const store = new LocalStore(${JSON.stringify(input.root)});`,
    "await store.initialize();",
    `const records = store.cachedResearchOperationsProjectionRecords(${JSON.stringify(
      input.collection
    )});`,
    `await writeFile(${JSON.stringify(
      input.resultPath
    )}, JSON.stringify(records), "utf8");`
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnUninitializedProjectionWriter(
  root: string,
  allocation: CandidateArenaResearchAllocationRecord,
  startedPath?: string
): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const root = ${JSON.stringify(root)};`,
    `const allocation = JSON.parse(Buffer.from(${JSON.stringify(
      Buffer.from(JSON.stringify(allocation), "utf8").toString("base64")
    )}, "base64").toString("utf8"));`,
    `const startedPath = ${JSON.stringify(startedPath)};`,
    "const store = new LocalStore(root);",
    "if (startedPath) await writeFile(startedPath, \"started\\n\", \"utf8\");",
    "await store.recordCandidateArenaResearchAllocation(allocation);"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnProjectionInitializer(root: string): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const store = new LocalStore(${JSON.stringify(root)});`,
    "await store.initialize();"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnInitializedProjectionReader(input: {
  root: string;
  readyPath: string;
  reads: Array<{ startPath: string; donePath: string }>;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { access, writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const root = ${JSON.stringify(input.root)};`,
    `const readyPath = ${JSON.stringify(input.readyPath)};`,
    `const reads = ${JSON.stringify(input.reads)};`,
    "const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));",
    "const waitFor = async (target) => { for (;;) { try { await access(target); return; } catch (error) { if (error?.code !== \"ENOENT\") throw error; } await delay(5); } };",
    "const store = new LocalStore(root);",
    "await store.initialize();",
    "await writeFile(readyPath, \"ready\\n\", \"utf8\");",
    "for (const read of reads) { await waitFor(read.startPath); const window = await store.readResearchOperationsProjectionWindow({ session_limit: 100 }); await writeFile(read.donePath, JSON.stringify({ recorded_session_count: window.index.recorded_session_count }), \"utf8\"); }"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnInitializedProjectionRefreshProbe(input: {
  root: string;
  readyPath: string;
  startPath: string;
  resultPath: string;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { access, writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const store = new LocalStore(${JSON.stringify(input.root)});`,
    "await store.initialize();",
    "const refresh = store.refreshResearchOperationsProjectionSourceCache.bind(store);",
    "let sourceCacheRefreshCount = 0;",
    "store.refreshResearchOperationsProjectionSourceCache = async () => { sourceCacheRefreshCount += 1; await refresh(); };",
    `await writeFile(${JSON.stringify(input.readyPath)}, "ready\\n", "utf8");`,
    `for (;;) { try { await access(${JSON.stringify(
      input.startPath
    )}); break; } catch (error) { if (error?.code !== "ENOENT") throw error; await new Promise((resolve) => setTimeout(resolve, 5)); } }`,
    "const window = await store.readResearchOperationsProjectionWindow({ session_limit: 100 });",
    `await writeFile(${JSON.stringify(input.resultPath)}, JSON.stringify({ recorded_session_count: window.index.recorded_session_count, source_cache_refresh_count: sourceCacheRefreshCount }), "utf8");`
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnProjectionReset(root: string): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const store = new LocalStore(${JSON.stringify(root)});`,
    "await store.reset();"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnConflictingSystemCodeWriter(input: {
  root: string;
  systemCode: SystemCodeRecord;
  startedPath?: string;
  readyPath: string;
  releasePath: string;
  resultPath: string;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { access, writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const root = ${JSON.stringify(input.root)};`,
    `const systemCode = JSON.parse(Buffer.from(${JSON.stringify(
      Buffer.from(JSON.stringify(input.systemCode), "utf8").toString("base64")
    )}, "base64").toString("utf8"));`,
    `const readyPath = ${JSON.stringify(input.readyPath)};`,
    `const startedPath = ${JSON.stringify(input.startedPath)};`,
    `const releasePath = ${JSON.stringify(input.releasePath)};`,
    `const resultPath = ${JSON.stringify(input.resultPath)};`,
    "const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));",
    "const waitFor = async (target) => { for (;;) { try { await access(target); return; } catch (error) { if (error?.code !== \"ENOENT\") throw error; } await delay(5); } };",
    "const store = new LocalStore(root);",
    "if (startedPath) await writeFile(startedPath, \"started\\n\", \"utf8\");",
    "const assertIdentity = store.assertExactAuthorityIdentity.bind(store);",
    "store.assertExactAuthorityIdentity = async (identityInput) => { const identity = await assertIdentity(identityInput); await writeFile(readyPath, identity + \"\\n\", \"utf8\"); await waitFor(releasePath); return identity; };",
    "let outcome;",
    "try { await store.recordSystemCode(systemCode); outcome = { status: \"recorded\" }; } catch (error) { outcome = { status: \"rejected\", code: error?.code, message: error?.message }; }",
    "await writeFile(resultPath, JSON.stringify(outcome), \"utf8\");"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnProjectionInvalidatingWriter(input: {
  root: string;
  allocation: CandidateArenaResearchAllocationRecord;
  invalidatedPath: string;
  releasePath: string;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { access, writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const root = ${JSON.stringify(input.root)};`,
    `const allocation = JSON.parse(Buffer.from(${JSON.stringify(
      Buffer.from(JSON.stringify(input.allocation), "utf8").toString("base64")
    )}, "base64").toString("utf8"));`,
    `const invalidatedPath = ${JSON.stringify(input.invalidatedPath)};`,
    `const releasePath = ${JSON.stringify(input.releasePath)};`,
    "const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));",
    "const waitFor = async (target) => { for (;;) { try { await access(target); return; } catch (error) { if (error?.code !== \"ENOENT\") throw error; } await delay(5); } };",
    "const store = new LocalStore(root);",
    "await store.initialize();",
    "const invalidate = store.invalidateResearchOperationsProjectionIndex.bind(store);",
    "let intercept = true;",
    "store.invalidateResearchOperationsProjectionIndex = async () => { await invalidate(); if (intercept) { intercept = false; await writeFile(invalidatedPath, \"invalidated\\n\", \"utf8\"); await waitFor(releasePath); } };",
    "await store.recordCandidateArenaResearchAllocation(allocation);"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnProjectionWriter(input: {
  root: string;
  allocation: CandidateArenaResearchAllocationRecord;
  readyPath: string;
  startPath: string;
  sourceWrittenPath: string;
  releasePath: string;
}): ChildProcess {
  const localStoreUrl = new URL("../src/index.ts", import.meta.url).href;
  const source = [
    'import { access, writeFile } from "node:fs/promises";',
    `const { LocalStore } = await import(${JSON.stringify(localStoreUrl)});`,
    `const root = ${JSON.stringify(input.root)};`,
    `const allocation = JSON.parse(Buffer.from(${JSON.stringify(
      Buffer.from(JSON.stringify(input.allocation), "utf8").toString("base64")
    )}, "base64").toString("utf8"));`,
    `const readyPath = ${JSON.stringify(input.readyPath)};`,
    `const startPath = ${JSON.stringify(input.startPath)};`,
    `const sourceWrittenPath = ${JSON.stringify(input.sourceWrittenPath)};`,
    `const releasePath = ${JSON.stringify(input.releasePath)};`,
    "const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));",
    "const waitFor = async (target) => { for (;;) { try { await access(target); return; } catch (error) { if (error?.code !== \"ENOENT\") throw error; } await delay(5); } };",
    "let gateNextPublish = false;",
    "const store = new LocalStore(root, { writeTransaction: { run: async (write) => { const result = await write(); if (gateNextPublish) { gateNextPublish = false; await writeFile(sourceWrittenPath, \"written\\n\", \"utf8\"); await waitFor(releasePath); } return result; } } });",
    "await store.initialize();",
    "await writeFile(readyPath, \"ready\\n\", \"utf8\");",
    "await waitFor(startPath);",
    "gateNextPublish = true;",
    "await store.recordCandidateArenaResearchAllocation(allocation);"
  ].join("\n");
  return spawnTrackedProjectionWriter(source);
}

function spawnTrackedProjectionWriter(source: string): ChildProcess {
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    "--input-type=module",
    "-e",
    source
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = { stdout: [] as string[], stderr: [] as string[] };
  projectionWriterOutput.set(child, output);
  child.stdout?.on("data", (chunk: Buffer | string) => {
    output.stdout.push(String(chunk));
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    output.stderr.push(String(chunk));
  });
  return child;
}

async function waitForProjectionLockClaim(
  root: string,
  child: ChildProcess,
  timeoutMs = 10_000
): Promise<void> {
  if (child.pid === undefined) {
    throw new Error("projection writer has no process id");
  }
  const lockRoot = path.join(
    root,
    ".locks",
    "research-operations-projection-publication"
  );
  const claimPrefix = `claim-${child.pid}-`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await readdir(lockRoot)).some((entry) =>
        entry.startsWith(claimPrefix)
      )) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (child.exitCode !== null) {
      throw projectionWriterError(child, "before waiting on the publication lock");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw projectionWriterError(child, "before claiming the publication lock");
}

async function waitForFile(
  filePath: string,
  child: ChildProcess,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await readFile(filePath, "utf8");
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (child.exitCode !== null) {
      throw projectionWriterError(child, "before publishing its signal");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw projectionWriterError(child, `before ${filePath} was published`);
}

function waitForChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) {
    return child.exitCode === 0
      ? Promise.resolve()
      : Promise.reject(projectionWriterError(child, "with a failure"));
  }
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(projectionWriterError(
        child,
        `with code ${String(code)} and signal ${String(signal)}`
      ));
    });
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function waitForAnyChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => resolve());
  });
}

function projectionWriterError(child: ChildProcess, reason: string): Error {
  const output = projectionWriterOutput.get(child);
  return new Error([
    `projection writer exited ${reason}`,
    output?.stdout.join("") ?? "",
    output?.stderr.join("") ?? ""
  ].filter(Boolean).join("\n"));
}

function stoppedService(store: LocalStore): ResearchOperationsProjectionService {
  return new ResearchOperationsProjectionService({
    store,
    runnerHealth: () => ({
      status: "stopped",
      tick_count: 1,
      completed_tick_count: 1,
      active_tick: false,
      active_research_work_items: [],
      consecutive_failure_count: 0,
      runtime_coordination_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    })
  });
}

function expectNoTerminalAuthority(
  detail: ResearchSessionDetailReadModel | undefined,
  selectedArtifactAvailability: "not_selected" | "unavailable" = "not_selected"
): void {
  expect(detail).toBeDefined();
  expect(detail).toMatchObject({
    selected_artifact_availability: selectedArtifactAvailability
  });
  expect(detail?.status).not.toBe("admitted");
  expect(detail).not.toHaveProperty("selected_submission_sequence");
  expect(detail).not.toHaveProperty("selected_system_code_ref");
  expect(detail).not.toHaveProperty("selected_system_code_artifact_digest");
  expect(detail).not.toHaveProperty("admission_decision_ref");
  expect(detail).not.toHaveProperty("paper_handoff_conformance_ref");
  expect(detail).not.toHaveProperty("admitted_candidate_id");
  for (const submission of detail?.development_submissions ?? []) {
    expect(submission.selected).toBe(false);
    expect(submission).not.toHaveProperty("selected_system_code_ref");
    expect(submission).not.toHaveProperty("selected_system_code_artifact_digest");
  }
  expect(detail?.terminal_graph).not.toHaveProperty("selected_sealed_evaluation");
  expect(detail?.terminal_graph).not.toHaveProperty("admission");
  expect(detail?.terminal_graph).not.toHaveProperty("finding");
  expect(detail?.terminal_graph).not.toHaveProperty("artifact_lineage");
  expect(detail?.terminal_graph).not.toHaveProperty("paper_handoff_conformance");
  expect(detail?.terminal_graph).not.toHaveProperty("admitted_arena_handoff");
  expect(detail?.lifecycle_events.map((event) => event.event_kind)).not.toEqual(
    expect.arrayContaining(["evaluation", "handoff_conformance", "admission"])
  );
}

function expectTerminalAuthorityMatrix(
  detail: ResearchSessionDetailReadModel | undefined,
  kind: OracleCase
): void {
  expect(detail, kind).toBeDefined();
  expect(detail?.provider_logs_availability, kind).toBe("not_persisted");
  expect(detail?.terminal_graph, kind).not.toHaveProperty("artifact_lineage");
  expect(detail?.submission_history_availability, kind).toBe("checkpoint_summary");
  const lifecycle = detail?.lifecycle_events.map((event) => event.event_kind);
  const isAdmission = kind === "admitted" || kind === "duplicate" ||
    kind === "quarantined";
  if (isAdmission) {
    expect(detail?.budget.completed_experiment_count, kind).toBe(1);
    expect(detail, kind).toMatchObject({
      selected_artifact_availability: "available",
      recorded_submission_count: 1,
      projected_submission_count: 1,
      omitted_submission_count: 0,
      submission_history_truncated: false,
      terminal_graph: {
        selected_sealed_evaluation: {},
        admission: {},
        finding: {}
      }
    });
    expect(detail?.development_submissions, kind).toHaveLength(1);
    expect(lifecycle, kind).toEqual(kind === "admitted"
      ? [
          "allocation",
          "commitment",
          "evaluation",
          "handoff_conformance",
          "admission",
          "checkpoint",
          "tick"
        ]
      : [
          "allocation",
          "commitment",
          "evaluation",
          "admission",
          "checkpoint",
          "tick"
        ]);
    if (kind === "admitted") {
      expect(detail, kind).toHaveProperty("admitted_candidate_id");
      expect(detail, kind).toHaveProperty("paper_handoff_conformance_ref");
      expect(detail?.terminal_graph, kind).toHaveProperty(
        "paper_handoff_conformance"
      );
      expect(detail?.terminal_graph, kind).toHaveProperty(
        "admitted_arena_handoff"
      );
    } else {
      expect(detail, kind).not.toHaveProperty("admitted_candidate_id");
      expect(detail, kind).not.toHaveProperty("paper_handoff_conformance_ref");
      expect(detail?.terminal_graph, kind).not.toHaveProperty(
        "paper_handoff_conformance"
      );
      expect(detail?.terminal_graph, kind).not.toHaveProperty(
        "admitted_arena_handoff"
      );
    }
    return;
  }

  expectNoTerminalAuthority(detail);
  expect(detail, kind).toMatchObject({
    recorded_submission_count: 0,
    projected_submission_count: 0,
    omitted_submission_count: 0,
    submission_history_truncated: false
  });
  expect(detail?.development_submissions, kind).toEqual([]);
  expect(lifecycle, kind).toEqual(kind === "restart_recovery"
    ? ["allocation", "commitment", "checkpoint"]
    : ["allocation", "commitment", "checkpoint", "tick"]);
}

interface BaseGraph {
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
  commitment: ResearchPreflightCommitmentRecord;
}

async function persistBaseGraph(store: LocalStore, suffix: string): Promise<BaseGraph> {
  const safeSuffix = suffix.replaceAll("_", "-");
  const allocation = allocationFixture(suffix);
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: `research-direction-${suffix}`,
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore robust trend behavior without prescribing an implementation.",
    created_at: "2026-07-23T00:00:00.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: `research-worker-${safeSuffix}`,
    display_name: `ResearchWorker ${suffix}`,
    model: "fixture",
    provider_kind: "fixture_only",
    agent_profile_id: `managed-agent-${safeSuffix}`,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    workspace_key: `candidate-arena-workers/research-worker-${safeSuffix}`,
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-23T00:00:00.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const source = systemCode(`source-code-${suffix}`, digest(`source-${suffix}`),
    "2026-07-23T00:00:00.000Z");
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `research-preflight-${suffix}`,
    candidate_arena_tick_id: allocation.tick_id,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    research_worker_ref: ref("research_worker", worker.research_worker_id),
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: ref("system_code", source.system_code_id),
    source_artifact_digest: source.artifact_digest,
    methodology: {
      direction_kind: "trend_following",
      hypothesis: "A bounded trend candidate may improve robust behavior.",
      method: "Use the fixed development replay before sealed admission.",
      evidence_bindings: []
    },
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: digest(`development-${suffix}`),
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${suffix}`),
      suite_digest: digest(`sealed-${suffix}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-23T00:00:01.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchDirection(direction);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  await store.recordResearchPreflightCommitment(commitment);
  return { allocation, direction, worker, source, commitment };
}

async function persistMemoryControlBaseGraph(store: LocalStore): Promise<{
  graph: BaseGraph;
  study: ResearchMemoryControlStudyRecord;
}> {
  const source = systemCode(
    "source-code-memory-control",
    digest("memory-control-system-code-artifact"),
    "2026-07-22T23:59:58.000Z"
  );
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: "research-direction-memory-control",
    direction_kind: "trend_following",
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Measure released memory without changing candidate authority.",
    created_at: "2026-07-22T23:59:58.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: "research-worker-memory-control",
    display_name: "ResearchWorker memory control",
    model: "gpt-test",
    provider_kind: "codex_cli",
    agent_profile_id: "memory-control-agent",
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    workspace_key: "candidate-arena-workers/research-worker-memory-control",
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-22T23:59:58.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const study = decideResearchMemoryControlStudy({
    idempotencyKey: "research-operations-memory-control-admission",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("memory-control-baseline"),
      regular_file_count: 1,
      total_bytes: 1,
      exclusion_policy: "research_experiment_evidence_only"
    },
    source: {
      candidate_ref: ref("trading_system_candidate", "memory-control-source-candidate"),
      candidate_version_ref: ref("candidate_version", "memory-control-source-version"),
      system_code_ref: ref("system_code", source.system_code_id),
      system_code_artifact_digest: source.artifact_digest,
      system_code_record_digest: digest(
        paperTradingComparisonSystemCodeRecordDigestInput(source)
      ),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("memory-control-research-artifact-closure")
    },
    researchAgent: {
      id: worker.agent_profile_id!,
      provider: "codex",
      model: worker.model!,
      permission_policy: "artifact_workspace_only"
    },
    opportunityProtocol: {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("memory-control-development"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("memory-control-rotation"),
      sealed_suite_digest: digest("memory-control-sealed")
    },
    directions: Array.from({ length: 6 }, (_, index) => index % 2 === 0 ? {
      research_direction_id: direction.research_direction_id,
      direction_kind: "trend_following" as const
    } : {
      research_direction_id: "research-direction-memory-control-mean",
      direction_kind: "mean_reversion" as const
    }),
    committedAt: "2026-07-22T23:59:59.000Z"
  });
  const arm = study.pair_plans[0]!.released_memory_treatment;
  const allocation = allocationFixture("memory-control-admitted");
  allocation.tick_id = arm.tick_id;
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  const commitment: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: "research-preflight-memory-control-admitted",
    candidate_arena_tick_id: arm.tick_id,
    research_direction_ref: ref("research_direction", direction.research_direction_id),
    research_worker_ref: ref("research_worker", worker.research_worker_id),
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: ref("system_code", source.system_code_id),
    source_artifact_digest: study.source.research_artifact_closure_digest,
    methodology: {
      direction_kind: "trend_following",
      hypothesis: "Released memory may reduce exact behavioral repeats.",
      method: "Use the exact precommitted memory-control opportunity.",
      evidence_bindings: []
    },
    development_policy: {
      suite_version: study.opportunity_protocol.development_suite_version,
      suite_digest: study.opportunity_protocol.development_suite_digest,
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: study.opportunity_protocol.sealed_suite_version,
      generator_version: study.opportunity_protocol.sealed_generator_version,
      rotation_commitment_digest:
        study.opportunity_protocol.sealed_rotation_commitment_digest,
      suite_digest: study.opportunity_protocol.sealed_suite_digest,
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    memory_policy: {
      protocol_version: "research_worker_memory_v1",
      memory_mode: arm.memory_mode,
      memory_source_digest: digest("memory-control-source-memory"),
      available_memory_item_count: 1,
      arena_context_digest: digest("memory-control-arena-context"),
      prior_checkpoint: { disposition: "none_available" },
      control_assignment: {
        study_ref: ref(
          "research_memory_control_study",
          study.research_memory_control_study_id
        ),
        study_digest: study.study_digest,
        pair_index: 1,
        arm_kind: arm.arm_kind
      }
    },
    committed_at: "2026-07-23T00:00:01.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("pending")
  };
  commitment.commitment_digest = digest(researchPreflightCommitmentDigestInput(commitment));

  await store.recordResearchMemoryControlStudy(study);
  await store.recordResearchDirection(direction);
  await store.recordResearchWorker(worker);
  await store.recordSystemCode(source);
  await store.recordCandidateArenaResearchAllocation(allocation);
  await store.recordResearchPreflightCommitment(commitment);
  return { graph: { allocation, direction, worker, source, commitment }, study };
}

async function persistAdmissionClosure(
  store: LocalStore,
  graph: BaseGraph,
  kind: "admitted" | "duplicate" | "quarantined",
  options: {
    priorCheckpoint?: ResearchWorkerCheckpointRecord;
    recordCheckpoint?: boolean;
    prepareOnly?: boolean;
  } = {}
): Promise<CandidateAdmissionDecisionRecord> {
  const selected = systemCode(
    `selected-code-${kind}`,
    kind === "duplicate"
      ? graph.commitment.source_artifact_digest
      : digest(`selected-${kind}`),
    "2026-07-23T00:00:04.000Z"
  );
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-${kind}`,
    research_worker_ref: { ...graph.commitment.research_worker_ref },
    research_direction_ref: { ...graph.commitment.research_direction_ref },
    system_code_ref: ref("system_code", selected.system_code_id),
    trading_evaluation_task_ref: ref("trading_evaluation_task", `task-${kind}`),
    trace_ref: ref("trace_placeholder", `experiment-trace-${kind}`),
    submitted_at: "2026-07-23T00:00:02.100Z",
    status: kind === "quarantined" ? "failed" : "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-${kind}`,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: ref("external_evaluator", `evaluator-${kind}`),
    result_status: kind === "quarantined" ? "disqualified" : "accepted",
    evidence_disposition: kind === "quarantined" ? "quarantined_for_review" : "not_counted",
    score_summary: {
      total_score: kind === "quarantined" ? 0 : 1,
      oos_score: 1,
      drawdown_score: 1,
      turnover_score: 1,
      cost_survival_score: 1,
      reproducibility_score: 1,
      complexity_penalty: 0
    },
    metric_refs: [],
    evaluator_trace_ref: ref("trace_placeholder", `evaluator-trace-${kind}`),
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    submitted_system_code_ref: ref("system_code", selected.system_code_id),
    submitted_artifact_digest: selected.artifact_digest,
    sealed_admission_suite_digest: graph.commitment.sealed_admission_policy.suite_digest,
    evaluation_phase: "sealed_admission",
    submission_sequence: 1,
    selected_development_submission_sequence: 1,
    ...(kind === "quarantined" ? { disqualification_reason: "research_worker_failed" } : {}),
    completed_at: "2026-07-23T00:00:04.000Z",
    authority_status: "not_counted"
  };
  const conformance = kind === "admitted"
    ? conformanceFixture(selected, experiment)
    : undefined;
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${kind}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    finding_kind: kind === "admitted" ? "positive_result" :
      kind === "duplicate" ? "duplicate_result" : "failure_analysis",
    summary: `Canonical ${kind} Finding.`,
    supporting_record_refs: [ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    )],
    created_at: "2026-07-23T00:00:04.100Z",
    authority_status: "research_trace_only"
  };
  const admissionInput = kind === "admitted" ? {
    research_worker_outcome: "changed" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const,
    paper_handoff_conformance_status: "passed" as const
  } : kind === "duplicate" ? {
    research_worker_outcome: "unchanged" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const
  } : {
    research_worker_outcome: "failed" as const,
    experiment_status: "failed" as const,
    evaluation_status: "disqualified" as const,
    evidence_disposition: "quarantined_for_review" as const
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-${kind}`,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    source_system_code_ref: ref("system_code", graph.source.system_code_id),
    system_code_ref: ref("system_code", selected.system_code_id),
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      evaluation.trading_evaluation_result_id
    ),
    research_finding_ref: ref("research_finding", finding.research_finding_id),
    source_artifact_digest: graph.commitment.source_artifact_digest,
    submitted_artifact_digest: selected.artifact_digest,
    ...admissionInput,
    ...decideCandidateAdmission(admissionInput),
    ...(conformance ? {
      paper_trading_handoff_conformance_ref: ref(
        "paper_trading_handoff_conformance",
        conformance.paper_trading_handoff_conformance_id
      ),
      paper_trading_handoff_conformance_digest: conformance.evidence_digest
    } : {}),
    decided_at: "2026-07-23T00:00:05.000Z",
    authority_status: "not_live"
  };
  await store.recordSystemCode(selected);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  if (conformance) await store.recordPaperTradingHandoffConformance(conformance);
  await store.recordResearchFinding(finding);
  if (options.prepareOnly) return admission;
  await store.recordCandidateAdmissionDecision(admission);
  const admittedCandidateId = kind === "admitted"
    ? await materializeAdmittedCandidate(store, graph, selected)
    : undefined;
  if (options.recordCheckpoint !== false) {
    await store.recordResearchWorkerCheckpoint(checkpointFixture(graph, {
      terminalReason: "admission_recorded",
      admission,
      evaluation,
      priorCheckpoint: options.priorCheckpoint
    }));
  }
  await store.recordCandidateArenaTick(tickFixture(graph.allocation, {
    direction_kind: "trend_following",
    status: kind === "admitted" ? "created" : kind,
    ...(kind === "admitted" ? { candidate_id: admittedCandidateId! } : {
      finding: finding.summary
    }),
    admission_decision_id: admission.candidate_admission_decision_id,
    admission_reason: admission.reason,
    ...(kind === "admitted" && conformance ? {
      research_preflight: {
        commitment_id: graph.commitment.research_preflight_commitment_id,
        development_submission_count: 1,
        sealed_terminal_status: "accepted",
        reason: "accepted",
        authority_status: "not_promotion_authority"
      },
      paper_handoff_conformance: {
        conformance_id: conformance.paper_trading_handoff_conformance_id,
        status: conformance.status,
        reason: conformance.reason,
        authority_status: "research_only"
      }
    } : {})
  }));
  return admission;
}

async function materializeAdmittedCandidate(
  store: LocalStore,
  graph: BaseGraph,
  selected: SystemCodeRecord
): Promise<string> {
  const selectedSystemCodeRef = ref("system_code", selected.system_code_id);
  const outcome = await store.materializeCandidate({
    idempotency_key: `research-operations-${graph.allocation.tick_id}`,
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-test",
      invocation_surface: "local-store-research-operations-oracle",
      agent_run_id: `materialization-agent-run-${graph.allocation.tick_id}`,
      agent_event_id: `materialization-agent-event-${graph.allocation.tick_id}`,
      trace_id: `materialization-trace-${graph.allocation.tick_id}`,
      output_artifact_hash: selected.artifact_digest
    },
    candidate: {
      title: `Materialized ${graph.allocation.tick_id}`,
      system_summary: "Canonical admitted CandidateArena materialization fixture.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Bounded trend-following research candidate.",
      market: "ExternalTradingApiProvider",
      instrument: "generic trading instruments",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Exact selected SystemCode emitted by the ResearchWorker.",
      declared_runtime: "python-sandbox-placeholder",
      declared_outputs: ["OrderRequest"]
    },
    capability_package: {
      summary: "Public-market research-only capability package.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars"],
      forbidden_contents: ["exchange_credentials", "live_order_authority"]
    },
    artifact_refs: [selectedSystemCodeRef],
    system_code_ref: selectedSystemCodeRef,
    full_cycle_lineage: {
      source: {
        trading_system_id: `source-${graph.allocation.tick_id}`,
        candidate_version_id: `source-version-${graph.allocation.tick_id}`,
        system_code_ref: { ...graph.commitment.source_system_code_ref }
      },
      generated: {
        system_code_ref: selectedSystemCodeRef,
        artifact_digest: selected.artifact_digest,
        generated_by_agent: true
      },
      evaluation: {
        status: "accepted",
        score: 1,
        direction_kind: "trend_following"
      }
    }
  });
  if (outcome.status !== "materialized") {
    throw new Error("expected admitted LocalStore candidate materialization");
  }
  return outcome.candidate.candidate_id;
}

async function persistNonAdmissionClosure(
  store: LocalStore,
  graph: BaseGraph,
  kind: "finished_without_submission" | "execution_failed" | "restart_recovery"
): Promise<void> {
  await store.recordResearchWorkerCheckpoint(checkpointFixture(graph, {
    terminalReason: kind
  }));
  if (kind === "restart_recovery") return;
  await store.recordCandidateArenaTick(tickFixture(graph.allocation, kind ===
    "finished_without_submission" ? {
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "ResearchWorker finished without selecting a submission."
    } : {
      direction_kind: "trend_following",
      status: "failed",
      error: "Research execution failed closed."
    }));
}

function allocationFixture(suffix: string): CandidateArenaResearchAllocationRecord {
  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `allocation-${suffix}`,
    tick_id: `tick-${suffix}`,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: "trend_following",
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["test_explicit_direction"]
    }],
    deferred_directions: [
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ],
    allocated_at: "2026-07-23T00:00:00.000Z",
    allocation_digest: digest("pending"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = digest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  return allocation;
}

function collidingAllocationFixtures(
  label: string,
  rootPrefix: string,
  count: number
): CandidateArenaResearchAllocationRecord[] {
  const suffixes: string[] = [];
  for (let index = 0; suffixes.length < count && index < 100_000; index += 1) {
    const suffix = `${label}-${index}`;
    const workItemId = researchWorkItemId({
      research_allocation_id: `allocation-${suffix}`,
      direction_kind: "trend_following"
    });
    if (researchOperationsProjectionCapsuleRouteHash(workItemId)
      .startsWith(rootPrefix)) {
      suffixes.push(suffix);
    }
  }
  if (suffixes.length !== count) {
    throw new Error(`could not derive ${count} ${rootPrefix} trie collisions`);
  }
  return suffixes.map(allocationFixture);
}

function checkpointFixture(
  graph: BaseGraph,
  input: {
    terminalReason: ResearchWorkerCheckpointRecord["terminal_reason"];
    admission?: CandidateAdmissionDecisionRecord;
    evaluation?: TradingEvaluationResultRecord;
    priorCheckpoint?: ResearchWorkerCheckpointRecord;
  }
): ResearchWorkerCheckpointRecord {
  const completed = input.terminalReason === "admission_recorded" ||
    input.terminalReason === "finished_without_submission";
  const hasSubmission = input.admission !== undefined;
  const previousCommitted = input.priorCheckpoint
    ?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = input.priorCheckpoint
    ?.development_budget.cumulative_recorded_submission_count ?? 0;
  const currentEntries: ResearchWorkerCheckpointRecord["notebook"]["recent_entries"] =
    hasSubmission ? [{
      sequence: previousRecorded + 1,
      candidate_arena_tick_id: graph.commitment.candidate_arena_tick_id,
      iteration: 1,
      decision: input.admission?.status === "quarantined" ? "crash" : "keep",
      agent_status: input.admission?.status === "quarantined" ? "failed" : "edited",
      score: input.admission?.status === "admitted" ? 1 : 0,
      summary: `Canonical ${input.admission?.status} development submission.`,
      evaluation_status: input.evaluation?.result_status === "accepted"
        ? "accepted"
        : "disqualified",
      risk_decision: input.admission?.status === "admitted"
        ? "valid_order_request"
        : "no_order_request",
      net_revenue_usdt: input.admission?.status === "admitted" ? 1 : 0
    }] : [];
  const record: ResearchWorkerCheckpointRecord = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id: `checkpoint-${graph.allocation.tick_id}`,
    research_worker_ref: { ...graph.commitment.research_worker_ref },
    research_direction_ref: { ...graph.commitment.research_direction_ref },
    candidate_arena_tick_id: graph.commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: ref(
      "research_preflight_commitment",
      graph.commitment.research_preflight_commitment_id
    ),
    research_preflight_commitment_digest: graph.commitment.commitment_digest,
    workspace_key: graph.worker.workspace_key!,
    ...(input.priorCheckpoint ? {
      previous_checkpoint_ref: ref(
        "research_worker_checkpoint",
        input.priorCheckpoint.research_worker_checkpoint_id
      ),
      previous_checkpoint_digest: input.priorCheckpoint.checkpoint_digest
    } : {}),
    development_budget: {
      submission_limit: 1,
      recorded_submission_count: hasSubmission ? 1 : 0,
      cumulative_committed_submission_limit: previousCommitted + 1,
      cumulative_recorded_submission_count: previousRecorded + (hasSubmission ? 1 : 0),
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: previousRecorded + (hasSubmission ? 1 : 0),
      recent_entries: [
        ...(input.priorCheckpoint?.notebook.recent_entries ?? []),
        ...currentEntries
      ]
    },
    terminal_status: completed ? "completed" : "failed_closed",
    terminal_reason: input.terminalReason,
    ...(input.admission ? {
      candidate_admission_decision_ref: ref(
        "candidate_admission_decision",
        input.admission.candidate_admission_decision_id
      )
    } : {}),
    closed_at: "2026-07-23T00:00:06.000Z",
    checkpoint_digest: digest("pending"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.checkpoint_digest = digest(researchWorkerCheckpointDigestInput(record));
  return record;
}

function tickFixture(
  allocation: CandidateArenaResearchAllocationRecord,
  result: CandidateArenaTickDirectionResultReadModel
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-${allocation.tick_id}`,
    tick_id: allocation.tick_id,
    started_at: allocation.allocated_at,
    completed_at: "2026-07-23T00:00:07.000Z",
    status: result.status === "failed" ? "failed" : "completed",
    created_candidate_refs: result.candidate_id
      ? [ref("trading_system_candidate", result.candidate_id)]
      : [],
    direction_results: [result],
    research_allocation_ref: ref(
      "candidate_arena_research_allocation",
      allocation.candidate_arena_research_allocation_id
    ),
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function conformanceFixture(
  systemCode: SystemCodeRecord,
  experiment: ExperimentRunRecord
): PaperTradingHandoffConformanceRecord {
  const record: PaperTradingHandoffConformanceRecord = {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: "conformance-admitted",
    system_code_ref: ref("system_code", systemCode.system_code_id),
    system_code_artifact_digest: systemCode.artifact_digest,
    experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "order_request",
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: "2026-07-23T00:00:03.100Z",
    completed_at: "2026-07-23T00:00:04.000Z",
    evidence_digest: digest("pending"),
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  record.evidence_digest = digest(paperTradingHandoffConformanceDigestInput(record));
  return record;
}

function systemCode(id: string, artifactDigest: string, createdAt: string): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: id,
    artifact_kind: "python_file",
    artifact_path: `/tmp/${id}.py`,
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", `/tmp/${id}.py`],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request"]
    },
    secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
    capability_policy_ref: ref("capability_policy", "research-only"),
    provenance_refs: [],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function standaloneFinding(
  suffix: string,
  createdAt: string
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-${suffix}`,
    research_worker_ref: ref("research_worker", `worker-${suffix}`),
    research_direction_ref: ref("research_direction", `direction-${suffix}`),
    experiment_run_ref: ref("experiment_run", `experiment-${suffix}`),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      `evaluation-${suffix}`
    ),
    finding_kind: "failure_analysis",
    summary: `Canonical standalone ${suffix} Finding.`,
    supporting_record_refs: [],
    created_at: createdAt,
    authority_status: "research_trace_only"
  };
}

function findingEvidenceArtifact(
  finding: ResearchFindingRecord
): ResearchEvidenceArtifactRecord {
  const record: ResearchEvidenceArtifactRecord = {
    record_kind: "research_evidence_artifact",
    version: 1,
    research_evidence_artifact_id:
      `research-evidence-${finding.research_finding_id}`,
    source_kind: "research_finding",
    subject_ref: { ...finding.research_worker_ref },
    artifact_ref: ref("research_finding", finding.research_finding_id),
    source_digest: digest(
      paperTradingComparisonPersistedRecordDigestInput(finding)
    ),
    summary: canonicalResearchEvidenceArtifactSummary(
      "research_finding",
      finding
    ),
    supporting_record_refs: structuredClone(finding.supporting_record_refs),
    captured_at: finding.created_at,
    sanitization_policy: "research_evidence_sanitization_v1",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    secrets_removed: true,
    host_paths_removed: true,
    truncated: false,
    artifact_digest: digest("pending"),
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.artifact_digest = digest(researchEvidenceArtifactDigestInput(record));
  return record;
}

function ref(record_kind: string, id: string): { record_kind: string; id: string } {
  return { record_kind, id };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
