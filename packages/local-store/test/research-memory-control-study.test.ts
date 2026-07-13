import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  researchMemoryControlPairOutcomeDigestInput,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyOutcomeDigestInput,
  researchPreflightCommitmentDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchWorkerCheckpointDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ResearchDirectionRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchMemoryControlArmKind,
  type ResearchMemoryControlPairOutcomeRecord,
  type ResearchMemoryControlStudyOutcomeRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord,
  type SystemCodeRecord
} from "@ouroboros/domain";
import {
  decideResearchMemoryControlStudy
} from "@ouroboros/application/candidate/research-memory-control-study";
import {
  decideResearchMemoryControlPairOutcome,
  decideResearchMemoryControlStudyOutcome,
  type DecideResearchMemoryControlPairOutcomeInput
} from "@ouroboros/application/candidate/research-memory-control-study-outcome";
import type { ResearchMemoryControlPairOutcomePersistenceInput } from
  "@ouroboros/application/ports/store";
import { LocalStore } from "../src/index";

describe("LocalStore ResearchMemoryControlStudy graph", () => {
  let root: string;
  let store: LocalStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-memory-study-"));
    store = new LocalStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("appends, reloads, orders, and exactly replays studies", async () => {
    const later = studyFixture("study-b", "2026-07-13T05:00:01.000Z");
    const earlier = studyFixture("study-a", "2026-07-13T05:00:00.000Z");

    await expect(store.recordResearchMemoryControlStudy(later))
      .resolves.toEqual(later);
    await expect(store.recordResearchMemoryControlStudy(earlier))
      .resolves.toEqual(earlier);
    await expect(store.recordResearchMemoryControlStudy(earlier))
      .resolves.toEqual(earlier);
    await expect(store.getResearchMemoryControlStudy(
      earlier.research_memory_control_study_id
    )).resolves.toEqual(earlier);
    await expect(store.listResearchMemoryControlStudies())
      .resolves.toEqual([earlier, later]);
  });

  it("publishes one exact study across independent store instances", async () => {
    const sharedRoot = path.join(root, "exact-study-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const study = studyFixture("exact-study-race");

    await expect(Promise.all([
      left.recordResearchMemoryControlStudy(study),
      right.recordResearchMemoryControlStudy(structuredClone(study))
    ])).resolves.toEqual([study, study]);
    await expect(left.listResearchMemoryControlStudies())
      .resolves.toEqual([study]);
  });

  it("publishes one winner for conflicting cross-instance study bytes", async () => {
    const sharedRoot = path.join(root, "conflicting-study-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const first = studyFixture(
      "conflicting-study-race",
      "2026-07-13T05:00:00.000Z"
    );
    const second = studyFixture(
      "conflicting-study-race",
      "2026-07-13T05:00:01.000Z"
    );

    const settled = await Promise.allSettled([
      left.recordResearchMemoryControlStudy(first),
      right.recordResearchMemoryControlStudy(second)
    ]);
    expect(settled.filter((item) => item.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected"))
      .toMatchObject([{
        reason: { code: "research_memory_control_study_conflict" }
      }]);
    const persisted = await left.listResearchMemoryControlStudies();
    expect(persisted).toHaveLength(1);
    expect([first, second]).toContainEqual(persisted[0]);
  });

  it("rejects study digest drift, conflicts, and corrupt persisted bytes", async () => {
    const study = studyFixture();
    const digestDrift = structuredClone(study);
    digestDrift.opportunity_protocol.sealed_suite_digest = digest("9");
    await expect(store.recordResearchMemoryControlStudy(digestDrift))
      .rejects.toMatchObject({
        code: "research_memory_control_study_digest_mismatch"
      });

    await store.recordResearchMemoryControlStudy(study);
    const conflict = structuredClone(study);
    conflict.committed_at = "2026-07-13T05:00:01.000Z";
    resealStudy(conflict);
    await expect(store.recordResearchMemoryControlStudy(conflict))
      .rejects.toMatchObject({ code: "research_memory_control_study_conflict" });

    const items = path.join(root, "research-memory-control-studies", "items");
    await mkdir(items, { recursive: true });
    await writeFile(path.join(items, "corrupt.json"), JSON.stringify({
      record_kind: "research_memory_control_study",
      research_memory_control_study_id: "corrupt"
    }));
    await expect(store.listResearchMemoryControlStudies())
      .rejects.toMatchObject({
        code: "research_memory_control_study_reload_failed"
      });
  });

  it("rejects study publication after a planned allocation effect", async () => {
    const study = studyFixture();
    const allocation = allocationFixture(
      study,
      1,
      "released_memory_treatment"
    );
    await store.recordCandidateArenaResearchAllocation(allocation);

    await expect(store.recordResearchMemoryControlStudy(study))
      .rejects.toMatchObject({
        code: "research_memory_control_study_effect_already_exists"
      });
  });

  it("serializes study publication against a cross-instance allocation", async () => {
    const sharedRoot = path.join(root, "study-allocation-race");
    const studyStore = new LocalStore(sharedRoot);
    const allocationStore = new LocalStore(sharedRoot);
    await studyStore.initialize();
    await allocationStore.initialize();
    const study = studyFixture("study-allocation-race");
    const allocation = allocationFixture(
      study,
      1,
      "released_memory_treatment"
    );
    let releaseScan!: () => void;
    const scanBlocked = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    let scanCompleted!: () => void;
    const scanned = new Promise<void>((resolve) => {
      scanCompleted = resolve;
    });
    const mutableStore = studyStore as any;
    const originalScan = mutableStore
      .assertResearchMemoryControlStudyPrecedesEffects.bind(studyStore);
    mutableStore.assertResearchMemoryControlStudyPrecedesEffects = async (
      value: ResearchMemoryControlStudyRecord
    ) => {
      await originalScan(value);
      scanCompleted();
      await scanBlocked;
    };

    const studyWrite = studyStore.recordResearchMemoryControlStudy(study);
    await scanned;
    let allocationSettled = false;
    const allocationWrite = allocationStore
      .recordCandidateArenaResearchAllocation(allocation)
      .finally(() => {
        allocationSettled = true;
      });
    await waitForTestTurn();
    expect(allocationSettled).toBe(false);

    releaseScan();
    await expect(studyWrite).resolves.toEqual(study);
    await expect(allocationWrite).resolves.toEqual(allocation);
  });

  it("publishes only complete lock claims and ignores interrupted preparations", async () => {
    const caseRoot = path.join(root, "atomic-lock-claim");
    const lockRoot = path.join(
      caseRoot,
      ".locks",
      "research-memory-control-publication"
    );
    const interruptedClaim = path.join(lockRoot, "claim-interrupted");
    await mkdir(interruptedClaim, { recursive: true });
    await writeFile(
      path.join(interruptedClaim, "owner.json"),
      "{\"token\":\"partial"
    );
    const caseStore = new LocalStore(caseRoot);
    await caseStore.initialize();
    const study = studyFixture("atomic-lock-claim");

    await expect(caseStore.recordResearchMemoryControlStudy(study))
      .resolves.toEqual(study);
  });

  it("recovers a complete stale owner and fails closed on partial active state", async () => {
    const staleRoot = path.join(root, "stale-lock-owner");
    const staleActive = path.join(
      staleRoot,
      ".locks",
      "research-memory-control-publication",
      "active"
    );
    await mkdir(staleActive, { recursive: true });
    await writeFile(path.join(staleActive, "owner.json"), JSON.stringify({
      token: "stale-owner",
      pid: 99_999_999,
      acquired_at: "2026-07-13T04:00:00.000Z"
    }));
    const staleStore = new LocalStore(staleRoot);
    await staleStore.initialize();
    const staleStudy = studyFixture("stale-lock-owner");
    await expect(staleStore.recordResearchMemoryControlStudy(staleStudy))
      .resolves.toEqual(staleStudy);

    const retiredRoot = path.join(root, "ownerless-retirement");
    await mkdir(path.join(
      retiredRoot,
      ".locks",
      "research-memory-control-publication",
      "retiring-orphaned"
    ), { recursive: true });
    const retiredStore = new LocalStore(retiredRoot);
    await retiredStore.initialize();
    const retiredStudy = studyFixture("ownerless-retirement");
    await expect(retiredStore.recordResearchMemoryControlStudy(retiredStudy))
      .resolves.toEqual(retiredStudy);

    const corruptRoot = path.join(root, "partial-active-owner");
    const corruptActive = path.join(
      corruptRoot,
      ".locks",
      "research-memory-control-publication",
      "active"
    );
    await mkdir(corruptActive, { recursive: true });
    await writeFile(path.join(corruptActive, "owner.json"), "{\"token\":");
    const corruptStore = new LocalStore(corruptRoot);
    await corruptStore.initialize();
    await expect(corruptStore.recordResearchMemoryControlStudy(
      studyFixture("partial-active-owner")
    )).rejects.toMatchObject({
      code: "research_memory_control_publication_lock_corrupt"
    });
  });

  it("fails closed when the tick effect collection is corrupt", async () => {
    const study = studyFixture();
    const items = path.join(root, "candidate-arena-ticks", "items");
    await mkdir(items, { recursive: true });
    await writeFile(path.join(items, "corrupt.json"), JSON.stringify({
      record_kind: "candidate_arena_tick",
      candidate_arena_tick_id: "corrupt"
    }));

    await expect(store.recordResearchMemoryControlStudy(study))
      .rejects.toMatchObject({
        code: "research_memory_control_study_effect_graph_corrupt"
      });
  });

  it("appends, reloads, orders, and exactly replays pair outcomes", async () => {
    const study = studyFixture();
    const first = pairOutcomeFixture(study, 1);
    const second = pairOutcomeFixture(study, 2);
    await store.recordResearchMemoryControlStudy(study);

    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, second)
    ))
      .resolves.toEqual(second);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, first)
    ))
      .resolves.toEqual(first);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, first)
    ))
      .resolves.toEqual(first);
    await expect(store.getResearchMemoryControlPairOutcome(
      first.research_memory_control_pair_outcome_id
    )).resolves.toEqual(first);
    await expect(store.listResearchMemoryControlPairOutcomes(
      study.research_memory_control_study_id
    )).resolves.toEqual([first, second]);
  });

  it("publishes one pair winner across independent store instances", async () => {
    const sharedRoot = path.join(root, "pair-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const study = studyFixture("pair-race");
    const exact = pairPersistenceInput(study, pairOutcomeFixture(study, 1));
    await left.recordResearchMemoryControlStudy(study);

    await expect(Promise.all([
      left.recordResearchMemoryControlPairOutcome(exact),
      right.recordResearchMemoryControlPairOutcome(structuredClone(exact))
    ])).resolves.toEqual([exact.outcome, exact.outcome]);

    const changedSource = pairSourceGraphFixture(study, 2);
    changedSource.terminalAt = "2026-07-13T05:20:00.000Z";
    const first = {
      outcome: decideResearchMemoryControlPairOutcome(
        pairSourceGraphFixture(study, 2)
      ),
      source_graph: pairSourceGraphFixture(study, 2)
    };
    const second = {
      outcome: decideResearchMemoryControlPairOutcome(changedSource),
      source_graph: changedSource
    };
    const settled = await Promise.allSettled([
      left.recordResearchMemoryControlPairOutcome(first),
      right.recordResearchMemoryControlPairOutcome(second)
    ]);
    expect(settled.filter((item) => item.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected"))
      .toMatchObject([{
        reason: {
          code: "research_memory_control_pair_outcome_source_graph_mismatch"
        }
      }]);
  });

  it("rejects pair digest, study graph, memory contrast, and conflicts", async () => {
    const study = studyFixture();
    await store.recordResearchMemoryControlStudy(study);

    const digestDrift = pairOutcomeFixture(study, 1);
    digestDrift.terminal_at = "2026-07-13T05:30:00.000Z";
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, digestDrift)
    ))
      .rejects.toMatchObject({
        code: "research_memory_control_pair_outcome_digest_mismatch"
      });

    const graphDrift = pairOutcomeFixture(study, 1);
    graphDrift.study_digest = digest("9");
    graphDrift.released_memory.preflight_evidence!.memory_policy
      .control_assignment!.study_digest = digest("9");
    graphDrift.memory_masked.preflight_evidence!.memory_policy
      .control_assignment!.study_digest = digest("9");
    resealPair(graphDrift);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, graphDrift)
    ))
      .rejects.toMatchObject({
        code: "research_memory_control_pair_outcome_reference_mismatch"
      });

    const memoryDrift = pairOutcomeFixture(study, 1);
    memoryDrift.memory_masked.preflight_evidence!.memory_policy
      .memory_source_digest = digest("9");
    resealPair(memoryDrift);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, memoryDrift)
    ))
      .rejects.toMatchObject({
        code: "invalid_research_memory_control_pair_outcome_input"
      });

    const exact = pairOutcomeFixture(study, 1);
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, exact)
    );
    const conflict = structuredClone(exact);
    conflict.terminal_at = "2026-07-13T05:30:00.000Z";
    resealPair(conflict);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, conflict)
    ))
      .rejects.toMatchObject({
        code: "research_memory_control_pair_outcome_conflict"
      });
  });

  it("rejects pair evidence refs that differ from the source graph", async () => {
    const study = studyFixture();
    await store.recordResearchMemoryControlStudy(study);
    const forged = pairOutcomeFixture(study, 1);
    forged.released_memory.tick_evidence!.tick_ref.id = "forged-tick";
    forged.released_memory.tick_evidence!.tick_digest = digest("forged-tick");
    forged.released_memory.preflight_evidence!.commitment_ref.id =
      "forged-preflight";
    forged.released_memory.preflight_evidence!.commitment_digest =
      digest("forged-preflight");
    resealPair(forged);

    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, forged)
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_source_graph_mismatch"
    });
  });

  it("requires exact source graphs on eligible and malformed replays", async () => {
    const study = studyFixture();
    await store.recordResearchMemoryControlStudy(study);

    const eligible = pairOutcomeFixture(study, 1);
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, eligible)
    );
    const eligibleDrift = pairSourceGraphFixture(study, 1);
    eligibleDrift.terminalAt = "2026-07-13T05:30:00.000Z";
    await expect(store.recordResearchMemoryControlPairOutcome({
      outcome: eligible,
      source_graph: eligibleDrift
    })).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_source_graph_mismatch"
    });

    const malformedSource = pairSourceGraphFixture(study, 2);
    delete malformedSource.releasedMemory.preflight;
    const malformed = decideResearchMemoryControlPairOutcome(malformedSource);
    expect(malformed).toMatchObject({
      eligibility_status: "ineligible",
      ineligibility_reason: "malformed_evidence_graph"
    });
    await store.recordResearchMemoryControlPairOutcome({
      outcome: malformed,
      source_graph: malformedSource
    });
    await expect(store.recordResearchMemoryControlPairOutcome({
      outcome: malformed,
      source_graph: pairSourceGraphFixture(study, 2)
    })).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_source_graph_mismatch"
    });

    const forgedMalformed = structuredClone(malformed);
    forgedMalformed.released_memory.worker_evidence!.model = "forged-model";
    resealPair(forgedMalformed);
    await writeFile(path.join(
      root,
      "research-memory-control-pair-outcomes",
      "items",
      `${forgedMalformed.research_memory_control_pair_outcome_id}.json`
    ), `${JSON.stringify(forgedMalformed, null, 2)}\n`);
    await expect(store.getResearchMemoryControlPairOutcome(
      forgedMalformed.research_memory_control_pair_outcome_id
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_reload_failed"
    });
  });

  it("requires the append-only source graph sidecar on reload", async () => {
    const study = studyFixture();
    const pair = pairOutcomeFixture(study, 1);
    await store.recordResearchMemoryControlStudy(study);
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, pair)
    );
    const sourceDir = path.join(
      root,
      "research-memory-control-pair-outcomes",
      "source-graphs"
    );
    const [sourceFile] = await readdir(sourceDir);
    await rm(path.join(sourceDir, sourceFile!));

    await expect(store.getResearchMemoryControlPairOutcome(
      pair.research_memory_control_pair_outcome_id
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_reload_failed"
    });
  });

  it("recovers orphan source graphs into discoverable pair outcomes", async () => {
    const study = studyFixture();
    const first = pairOutcomeFixture(study, 1);
    const second = pairOutcomeFixture(study, 2);
    await store.recordResearchMemoryControlStudy(study);
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, first)
    );
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, second)
    );
    const itemDir = path.join(
      root,
      "research-memory-control-pair-outcomes",
      "items"
    );
    await rm(path.join(
      itemDir,
      `${first.research_memory_control_pair_outcome_id}.json`
    ));
    await rm(path.join(
      itemDir,
      `${second.research_memory_control_pair_outcome_id}.json`
    ));

    await expect(store.getResearchMemoryControlPairOutcome(
      first.research_memory_control_pair_outcome_id
    )).resolves.toEqual(first);
    await expect(store.listResearchMemoryControlPairOutcomes(
      study.research_memory_control_study_id
    )).resolves.toEqual([first, second]);
    await expect(readdir(itemDir)).resolves.toHaveLength(2);
  });

  it("rejects pair outcome without its exact study", async () => {
    const study = studyFixture();
    const pair = pairOutcomeFixture(study, 1);
    await expect(store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, pair)
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_reference_not_found"
    });
  });

  it("fails closed when a persisted pair's study graph drifts", async () => {
    const study = studyFixture();
    const pair = pairOutcomeFixture(study, 1);
    await store.recordResearchMemoryControlStudy(study);
    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, pair)
    );

    const changedStudy = structuredClone(study);
    changedStudy.committed_at = "2026-07-13T05:00:01.000Z";
    resealStudy(changedStudy);
    await writeFile(path.join(
      root,
      "research-memory-control-studies",
      "items",
      `${study.research_memory_control_study_id}.json`
    ), `${JSON.stringify(changedStudy, null, 2)}\n`);

    await expect(store.getResearchMemoryControlPairOutcome(
      pair.research_memory_control_pair_outcome_id
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_reference_mismatch"
    });
  });

  it("appends one all-pairs outcome only after every exact pair", async () => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((plan) =>
      pairOutcomeFixture(study, plan.pair_index)
    );
    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });
    await store.recordResearchMemoryControlStudy(study);
    for (const pair of pairs) {
      await store.recordResearchMemoryControlPairOutcome(
        pairPersistenceInput(study, pair)
      );
    }

    await expect(store.recordResearchMemoryControlStudyOutcome(outcome))
      .resolves.toEqual(outcome);
    await expect(store.recordResearchMemoryControlStudyOutcome(outcome))
      .resolves.toEqual(outcome);
    await expect(store.getResearchMemoryControlStudyOutcome(
      outcome.research_memory_control_study_outcome_id
    )).resolves.toEqual(outcome);
    await expect(store.listResearchMemoryControlStudyOutcomes())
      .resolves.toEqual([outcome]);
  });

  it("publishes one study outcome winner across independent instances", async () => {
    const sharedRoot = path.join(root, "study-outcome-race");
    const left = new LocalStore(sharedRoot);
    const right = new LocalStore(sharedRoot);
    await left.initialize();
    await right.initialize();
    const study = studyFixture("study-outcome-race");
    const pairs = study.pair_plans.map((plan) =>
      pairOutcomeFixture(study, plan.pair_index)
    );
    await left.recordResearchMemoryControlStudy(study);
    for (const pair of pairs) {
      await left.recordResearchMemoryControlPairOutcome(
        pairPersistenceInput(study, pair)
      );
    }
    const first = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });
    const second = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:01.000Z"
    });

    const settled = await Promise.allSettled([
      left.recordResearchMemoryControlStudyOutcome(first),
      right.recordResearchMemoryControlStudyOutcome(second)
    ]);
    expect(settled.filter((item) => item.status === "fulfilled"))
      .toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected"))
      .toMatchObject([{
        reason: { code: "research_memory_control_study_outcome_conflict" }
      }]);
  });

  it("rejects missing, omitted, reordered, and conflicting study outcomes", async () => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((plan) =>
      pairOutcomeFixture(study, plan.pair_index)
    );
    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });
    await store.recordResearchMemoryControlStudy(study);
    for (const pair of pairs.slice(0, -1)) {
      await store.recordResearchMemoryControlPairOutcome(
        pairPersistenceInput(study, pair)
      );
    }
    await expect(store.recordResearchMemoryControlStudyOutcome(outcome))
      .rejects.toMatchObject({
        code: "research_memory_control_study_outcome_reference_not_found"
      });

    await store.recordResearchMemoryControlPairOutcome(
      pairPersistenceInput(study, pairs.at(-1)!)
    );
    const omitted = structuredClone(outcome) as any;
    omitted.pair_results.pop();
    await expect(store.recordResearchMemoryControlStudyOutcome(omitted))
      .rejects.toMatchObject({
        code: "invalid_research_memory_control_study_outcome_input"
      });

    const reordered = structuredClone(outcome) as any;
    [reordered.pair_results[0], reordered.pair_results[1]] =
      [reordered.pair_results[1], reordered.pair_results[0]];
    await expect(store.recordResearchMemoryControlStudyOutcome(reordered))
      .rejects.toMatchObject({
        code: "invalid_research_memory_control_study_outcome_input"
      });

    await store.recordResearchMemoryControlStudyOutcome(outcome);
    const conflict = structuredClone(outcome);
    conflict.adjudicated_at = "2026-07-13T06:00:01.000Z";
    resealStudyOutcome(conflict);
    await expect(store.recordResearchMemoryControlStudyOutcome(conflict))
      .rejects.toMatchObject({
      code: "research_memory_control_study_outcome_conflict"
    });
  });

  it("fails closed when a persisted study outcome's pair graph drifts", async () => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((plan) =>
      pairOutcomeFixture(study, plan.pair_index)
    );
    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });
    await store.recordResearchMemoryControlStudy(study);
    for (const pair of pairs) {
      await store.recordResearchMemoryControlPairOutcome(
        pairPersistenceInput(study, pair)
      );
    }
    await store.recordResearchMemoryControlStudyOutcome(outcome);

    const changedPair = structuredClone(pairs[0]!);
    changedPair.terminal_at = "2026-07-13T05:30:00.000Z";
    resealPair(changedPair);
    await writeFile(path.join(
      root,
      "research-memory-control-pair-outcomes",
      "items",
      `${changedPair.research_memory_control_pair_outcome_id}.json`
    ), `${JSON.stringify(changedPair, null, 2)}\n`);

    await expect(store.getResearchMemoryControlStudyOutcome(
      outcome.research_memory_control_study_outcome_id
    )).rejects.toMatchObject({
      code: "research_memory_control_pair_outcome_reload_failed"
    });
  });

  it("rejects every widened study, pair, and outcome authority field", async () => {
    const study = studyFixture();
    for (const [field, value] of [
      ["evaluation_authority", true],
      ["research_scheduling_authority", false],
      ["memory_policy_replacement_authority", true],
      ["promotion_authority", true],
      ["order_submission_authority", true],
      ["live_exchange_authority", true],
      ["authority_status", "not_live"]
    ] as const) {
      const widened = structuredClone(study) as any;
      widened[field] = value;
      await expect(store.recordResearchMemoryControlStudy(widened))
        .rejects.toMatchObject({
        code: "invalid_research_memory_control_study_input"
      });
    }

    await store.recordResearchMemoryControlStudy(study);
    const pair = pairOutcomeFixture(study, 1);
    for (const [field, value] of [
      ["evaluation_authority", "trading_system_self_evaluation"],
      ["memory_policy_replacement_authority", true],
      ["promotion_authority", true],
      ["order_submission_authority", true],
      ["live_exchange_authority", true],
      ["authority_status", "research_only"]
    ] as const) {
      const widened = structuredClone(pair) as any;
      widened[field] = value;
      await expect(store.recordResearchMemoryControlPairOutcome(
        pairPersistenceInput(study, widened)
      )).rejects.toMatchObject({
        code: "invalid_research_memory_control_pair_outcome_input"
      });
    }

    const allPairs = study.pair_plans.map((plan) =>
      pairOutcomeFixture(study, plan.pair_index)
    );
    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: allPairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });
    for (const [field, value] of [
      ["evaluation_authority", "trading_system_self_evaluation"],
      ["memory_policy_replacement_authority", true],
      ["promotion_authority", true],
      ["order_submission_authority", true],
      ["live_exchange_authority", true],
      ["authority_status", "research_only"]
    ] as const) {
      const widened = structuredClone(outcome) as any;
      widened[field] = value;
      await expect(store.recordResearchMemoryControlStudyOutcome(widened))
        .rejects.toMatchObject({
        code: "invalid_research_memory_control_study_outcome_input"
      });
    }
  });

  it("requires the exact replicated study before an assigned preflight", async () => {
    const study = studyFixture();
    const support = await persistArmSupport(store, study, 1,
      "released_memory_treatment");
    const commitment = preflightFixture(study, 1,
      "released_memory_treatment", support);

    await expect(store.recordResearchPreflightCommitment(commitment))
      .rejects.toMatchObject({
        code: "research_preflight_memory_control_study_not_found"
      });
  });

  it.each([
    ["pair index", (record: ResearchPreflightCommitmentRecord) => {
      record.memory_policy!.control_assignment!.pair_index = 2;
    }, "research_preflight_memory_control_study_mismatch"],
    ["mode swap", (record: ResearchPreflightCommitmentRecord) => {
      record.memory_policy!.memory_mode = "memory_masked";
    }, "invalid_research_preflight_commitment_input"],
    ["arm swap", (record: ResearchPreflightCommitmentRecord) => {
      record.memory_policy!.control_assignment!.arm_kind =
        "memory_masked_control";
    }, "invalid_research_preflight_commitment_input"],
    ["study digest", (record: ResearchPreflightCommitmentRecord) => {
      record.memory_policy!.control_assignment!.study_digest = digest("9");
    }, "research_preflight_memory_control_study_mismatch"],
    ["unplanned tick", (record: ResearchPreflightCommitmentRecord) => {
      record.candidate_arena_tick_id = "unplanned-memory-control-tick";
    }, "research_preflight_commitment_graph_mismatch"],
    ["source artifact", (record: ResearchPreflightCommitmentRecord) => {
      record.source_artifact_digest = digest("forged-source");
    }, "research_preflight_memory_control_study_mismatch"]
  ] as const)("rejects assigned preflight %s drift", async (
    _label,
    mutate,
    expectedCode
  ) => {
    const caseRoot = path.join(root, `assignment-${_label.replace(" ", "-")}`);
    const caseStore = new LocalStore(caseRoot);
    await caseStore.initialize();
    const study = studyFixture();
    await caseStore.recordResearchMemoryControlStudy(study);
    const support = await persistArmSupport(caseStore, study, 1,
      "released_memory_treatment");
    const commitment = preflightFixture(study, 1,
      "released_memory_treatment", support);
    mutate(commitment);
    resealPreflight(commitment);

    await expect(caseStore.recordResearchPreflightCommitment(commitment))
      .rejects.toMatchObject({
        code: expectedCode
      });
  });

  it("accepts one exact study-assigned preflight", async () => {
    const study = studyFixture();
    await store.recordResearchMemoryControlStudy(study);
    const support = await persistArmSupport(store, study, 1,
      "released_memory_treatment");
    const commitment = preflightFixture(study, 1,
      "released_memory_treatment", support);

    await expect(store.recordResearchPreflightCommitment(commitment))
      .resolves.toEqual(commitment);
  });
});

function studyFixture(
  idempotencyKey = "memory-store-study",
  committedAt = "2026-07-13T05:00:00.000Z"
): ResearchMemoryControlStudyRecord {
  return decideResearchMemoryControlStudy({
    idempotencyKey,
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 10,
      total_bytes: 1_000,
      exclusion_policy: "research_experiment_evidence_only"
    },
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "source-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "source-version"
      },
      system_code_ref: { record_kind: "system_code", id: "source-code" },
      system_code_artifact_digest: digest("2"),
      system_code_record_digest: digest("3"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("4")
    },
    researchAgent: {
      id: "fixture-memory-agent",
      provider: "fixture",
      model: "fixture-memory-model",
      permission_policy: "fixture_only"
    },
    opportunityProtocol: {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("a"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("b"),
      sealed_suite_digest: digest("c")
    },
    directions: Array.from({ length: 6 }, (_, index) => ({
      research_direction_id: index % 2 === 0
        ? "direction-trend"
        : "direction-mean",
      direction_kind: index % 2 === 0
        ? "trend_following" as const
        : "mean_reversion" as const
    })),
    committedAt
  });
}

function pairOutcomeFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number
): ResearchMemoryControlPairOutcomeRecord {
  return decideResearchMemoryControlPairOutcome(
    pairSourceGraphFixture(study, pairIndex)
  );
}

function pairPersistenceInput(
  study: ResearchMemoryControlStudyRecord,
  outcome: ResearchMemoryControlPairOutcomeRecord
): ResearchMemoryControlPairOutcomePersistenceInput {
  return {
    outcome,
    source_graph: pairSourceGraphFixture(study, outcome.pair_index)
  };
}

function pairSourceGraphFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number
): DecideResearchMemoryControlPairOutcomeInput {
  return {
    study,
    pairIndex,
    releasedMemory: armSourceGraphFixture(
      study,
      pairIndex,
      "released_memory_treatment",
      "distinct"
    ),
    memoryMasked: armSourceGraphFixture(
      study,
      pairIndex,
      "memory_masked_control",
      "unchanged"
    ),
    terminalAt:
      `2026-07-13T05:${String(pairIndex).padStart(2, "0")}:00.000Z`
  };
}

function armSourceGraphFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind,
  observation: "distinct" | "unchanged"
): DecideResearchMemoryControlPairOutcomeInput["releasedMemory"] {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const support = supportFixture(study, pairIndex, armKind);
  const preflight = preflightFixture(
    study,
    pairIndex,
    armKind,
    support
  );
  const admission = admissionSourceFixture(preflight, observation);
  const fingerprint = observation === "distinct"
    ? fingerprintSourceFixture(preflight, admission)
    : undefined;
  const checkpoint = checkpointSourceFixture(
    preflight,
    support.worker,
    admission
  );
  const tick = tickSourceFixture(
    pairIndex,
    pair.direction_kind,
    plan.tick_id,
    preflight,
    observation,
    admission
  );
  return {
    armKind,
    terminalStatus: "completed",
    tick,
    preflight,
    checkpoint,
    researchWorker: support.worker,
    allocation: support.allocation,
    admission,
    ...(fingerprint ? { fingerprint } : {}),
    resourceSummary: {
      provider_request_total: 1,
      runner_command_total: 2,
      scenario_count: 3,
      elapsed_ms: 4
    }
  };
}

function admissionSourceFixture(
  preflight: ResearchPreflightCommitmentRecord,
  observation: "distinct" | "unchanged"
): CandidateAdmissionDecisionRecord {
  const unchanged = observation === "unchanged";
  const sourceDigest = preflight.source_artifact_digest;
  const submittedDigest = unchanged ? sourceDigest : digest(
    `${preflight.research_preflight_commitment_id}-submitted`
  );
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id:
      `${preflight.research_preflight_commitment_id}-admission`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    source_system_code_ref: { ...preflight.source_system_code_ref },
    system_code_ref: {
      record_kind: "system_code",
      id: `${preflight.research_preflight_commitment_id}-system-code`
    },
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: `${preflight.research_preflight_commitment_id}-experiment`
    },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: `${preflight.research_preflight_commitment_id}-evaluation`
    },
    research_finding_ref: {
      record_kind: "research_finding",
      id: `${preflight.research_preflight_commitment_id}-finding`
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: submittedDigest,
    research_worker_outcome: unchanged ? "unchanged" : "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    ...(unchanged ? {} : {
      behavior_comparison_status: "distinct" as const,
      research_behavior_fingerprint_ref: {
        record_kind: "research_behavior_fingerprint" as const,
        id: `${preflight.research_preflight_commitment_id}-fingerprint`
      },
      research_behavior_fingerprint_digest: digest("0")
    }),
    status: unchanged ? "duplicate" : "admitted",
    reason: unchanged ? "no_candidate_change" : "evaluation_accepted",
    runnable_paper_handoff: !unchanged,
    decided_at: "2026-07-13T05:00:45.000Z",
    authority_status: "not_live"
  };
}

function checkpointSourceFixture(
  preflight: ResearchPreflightCommitmentRecord,
  worker: ResearchWorkerRecord,
  admission: CandidateAdmissionDecisionRecord
): ResearchWorkerCheckpointRecord {
  const record: ResearchWorkerCheckpointRecord = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id:
      `${preflight.research_preflight_commitment_id}-checkpoint`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: worker.research_worker_id
    },
    research_direction_ref: { ...preflight.research_direction_ref },
    candidate_arena_tick_id: preflight.candidate_arena_tick_id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    workspace_key: worker.workspace_key!,
    development_budget: {
      submission_limit: 1,
      recorded_submission_count: 1,
      cumulative_committed_submission_limit: 1,
      cumulative_recorded_submission_count: 1,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: 1,
      recent_entries: [{
        sequence: 1,
        candidate_arena_tick_id: preflight.candidate_arena_tick_id,
        iteration: 1,
        decision: "keep",
        agent_status: admission.research_worker_outcome === "unchanged"
          ? "no_change"
          : "edited",
        score: 1,
        summary: "Bounded LocalStore memory-control checkpoint fixture.",
        evaluation_status: "accepted",
        risk_decision: "no_order_request",
        net_revenue_usdt: 0
      }]
    },
    terminal_status: "completed",
    terminal_reason: "admission_recorded",
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: admission.candidate_admission_decision_id
    },
    closed_at: admission.decided_at,
    checkpoint_digest: digest("pending-checkpoint"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.checkpoint_digest = exactDigest(
    researchWorkerCheckpointDigestInput(record)
  );
  return record;
}

function fingerprintSourceFixture(
  preflight: ResearchPreflightCommitmentRecord,
  admission: CandidateAdmissionDecisionRecord
): ResearchBehaviorFingerprintRecord {
  const record: ResearchBehaviorFingerprintRecord = {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id:
      admission.research_behavior_fingerprint_ref!.id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    system_code_ref: { ...admission.system_code_ref },
    system_code_artifact_digest: admission.submitted_artifact_digest,
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: preflight.development_policy.suite_version,
    development_suite_digest: preflight.development_policy.suite_digest,
    observations: [{
      scenario_id: "scenario-001",
      decision: {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 0,
        order_type: "none"
      }
    }],
    observation_count: 1,
    fingerprint_digest: digest("0"),
    created_at: "2026-07-13T05:00:40.000Z",
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.fingerprint_digest = exactDigest(
    researchBehaviorFingerprintDigestInput(record)
  );
  admission.research_behavior_fingerprint_digest = record.fingerprint_digest;
  return record;
}

function tickSourceFixture(
  pairIndex: number,
  directionKind: ResearchMemoryControlStudyRecord["pair_plans"][number]["direction_kind"],
  tickId: string,
  preflight: ResearchPreflightCommitmentRecord,
  observation: "distinct" | "unchanged",
  admission: CandidateAdmissionDecisionRecord
): CandidateArenaTickRecord {
  const status = observation === "distinct" ? "created" : "duplicate";
  const result: CandidateArenaTickDirectionResultReadModel = {
    direction_kind: directionKind,
    status,
    agent_provider: "fixture",
    admission_decision_id: admission.candidate_admission_decision_id,
    admission_reason: admission.reason,
    research_efficiency: {
      provider_request_total: 1,
      runner_command_total: 2,
      scenario_count: 3,
      elapsed_ms: 4,
      authority_status: "not_promotion_authority"
    },
    research_preflight: {
      commitment_id: preflight.research_preflight_commitment_id,
      development_submission_count: 1,
      sealed_terminal_status: status === "created" ? "accepted" : "rejected",
      reason: status === "created" ? "accepted" : "candidate_rejected",
      authority_status: "not_promotion_authority"
    }
  };
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${pairIndex}-${tickId}`,
    tick_id: tickId,
    started_at: "2026-07-13T05:00:30.000Z",
    completed_at: "2026-07-13T05:00:50.000Z",
    status: "completed",
    created_candidate_refs: status === "created" ? [{
      record_kind: "trading_system_candidate",
      id: `${tickId}-candidate`
    }] : [],
    direction_results: [result],
    research_allocation_ref: { ...preflight.research_allocation_ref },
    research_allocation_digest: preflight.research_allocation_digest,
    authority_status: "not_live"
  };
}

async function persistArmSupport(
  store: LocalStore,
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind
): Promise<{
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
}> {
  const support = supportFixture(study, pairIndex, armKind);
  await store.recordResearchDirection(support.direction);
  await store.recordResearchWorker(support.worker);
  await store.recordSystemCode(support.source);
  await store.recordCandidateArenaResearchAllocation(support.allocation);
  return support;
}

function supportFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind
): {
  allocation: CandidateArenaResearchAllocationRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  source: SystemCodeRecord;
} {
  const pair = study.pair_plans[pairIndex - 1]!;
  const direction: ResearchDirectionRecord = {
    record_kind: "research_direction",
    version: 1,
    research_direction_id: pair.research_direction_ref.id,
    direction_kind: pair.direction_kind,
    market_scope: "external_trading_api_fixture",
    prompt_seed: "Explore one bounded memory-study direction.",
    created_at: "2026-07-13T05:00:10.000Z",
    authority_status: "research_seed_only"
  };
  const worker: ResearchWorkerRecord = {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: `worker-${pair.direction_kind.replaceAll("_", "-")}`,
    display_name: `${pair.direction_kind} memory worker`,
    model: study.research_agent.model!,
    provider_kind: "fixture_only",
    agent_profile_id: study.research_agent_profile_id,
    research_direction_ref: {
      record_kind: "research_direction",
      id: direction.research_direction_id
    },
    workspace_key: `candidate-arena-workers/worker-${
      pair.direction_kind.replaceAll("_", "-")
    }`,
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-13T05:00:10.000Z",
    status: "active",
    authority_status: "research_only"
  };
  const allocation = allocationFixture(study, pairIndex, armKind);
  const source = systemCodeFixture(
    study.source.system_code_ref.id,
    study.source.system_code_artifact_digest
  );
  return { allocation, direction, worker, source };
}

function allocationFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind
): CandidateArenaResearchAllocationRecord {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const defaults = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ] as const;
  const record: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `${plan.tick_id}-allocation`,
    tick_id: plan.tick_id,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: pair.direction_kind,
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["memory_control_study"]
    }],
    deferred_directions: defaults.filter(
      (direction) => direction !== pair.direction_kind
    ),
    allocated_at: "2026-07-13T05:00:20.000Z",
    allocation_digest: digest("0"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.allocation_digest = exactDigest(
    candidateArenaResearchAllocationDigestInput(record)
  );
  return record;
}

function preflightFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind,
  support: Awaited<ReturnType<typeof persistArmSupport>>
): ResearchPreflightCommitmentRecord {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const record: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: `${plan.tick_id}-preflight`,
    candidate_arena_tick_id: plan.tick_id,
    research_direction_ref: {
      record_kind: "research_direction",
      id: support.direction.research_direction_id
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: support.worker.research_worker_id
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: support.allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: support.allocation.allocation_digest,
    source_system_code_ref: {
      record_kind: "system_code",
      id: support.source.system_code_id
    },
    source_artifact_digest: study.source.research_artifact_closure_digest,
    memory_policy: {
      protocol_version: "research_worker_memory_v1",
      memory_mode: plan.memory_mode,
      memory_source_digest: digest("7"),
      available_memory_item_count: 3,
      arena_context_digest: armKind === "released_memory_treatment"
        ? digest("8")
        : digest("9"),
      prior_checkpoint: { disposition: "none_available" },
      control_assignment: {
        study_ref: {
          record_kind: "research_memory_control_study",
          id: study.research_memory_control_study_id
        },
        study_digest: study.study_digest,
        pair_index: pairIndex,
        arm_kind: armKind
      }
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
    committed_at: "2026-07-13T05:00:30.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("0")
  };
  resealPreflight(record);
  return record;
}

function systemCodeFixture(id: string, artifactDigest: string): SystemCodeRecord {
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
      declared_output_kinds: ["program_event"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "research-only"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-13T05:00:10.000Z",
    authority_status: "not_live"
  };
}

function resealStudy(study: ResearchMemoryControlStudyRecord): void {
  study.study_digest = exactDigest(researchMemoryControlStudyDigestInput(study));
}

function resealPair(pair: ResearchMemoryControlPairOutcomeRecord): void {
  pair.pair_outcome_digest = exactDigest(
    researchMemoryControlPairOutcomeDigestInput(pair)
  );
}

function resealStudyOutcome(
  outcome: ResearchMemoryControlStudyOutcomeRecord
): void {
  outcome.study_outcome_digest = exactDigest(
    researchMemoryControlStudyOutcomeDigestInput(outcome)
  );
}

function resealPreflight(commitment: ResearchPreflightCommitmentRecord): void {
  commitment.commitment_digest = exactDigest(
    researchPreflightCommitmentDigestInput(commitment)
  );
}

function digest(value: string): string {
  return exactDigest(value);
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function waitForTestTurn(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 25));
}
