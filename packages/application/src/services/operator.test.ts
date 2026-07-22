import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@ouroboros/local-store";
import type { CandidateArenaRunner } from "../candidate/arena";
import { OperatorService } from "./operator";

describe("OperatorService autonomous Arena control", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-operator-service-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("does not resume from stale persisted start intent after an in-flight stop", async () => {
    const store = new LocalStore(root);
    await store.initialize();
    let running = true;
    const runner = {
      status: () => running ? "running" as const : "stopped" as const,
      ticks: () => 0,
      researchAgent: () => "fixture" as const,
      setTickContinuation: () => undefined,
      restoreTickCount: () => undefined,
      start: () => {
        running = true;
        return "started" as const;
      },
      stop: () => {
        running = false;
        return "stopped" as const;
      }
    } as unknown as CandidateArenaRunner;
    const service = new OperatorService({
      store,
      candidateArenaRunner: runner,
      paperEvidenceAdapter: {
        run: async () => {
          throw new Error("paper_evidence_not_expected");
        }
      }
    });
    await service.recordCommand({
      commandKind: "arena.start",
      status: "succeeded",
      requestedAt: "2026-07-22T10:00:00.000Z"
    });

    await service.executeCommand("arena.stop", undefined);
    expect(running).toBe(false);

    await expect(service.resumeAutonomousArenaLoop()).resolves.toBe(
      "not_requested"
    );
    expect(running).toBe(false);
  });
});
