import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  candidateArenaResearchAllocationDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  type ArtifactLineageRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchFindingRecord
} from "@ouroboros/domain";
import type {
  CandidateArenaEvidenceProjection,
  OuroborosStorePort,
  ResearchOperationsProjectionCapsule,
  ResearchOperationsProjectionCapsuleTrieNode,
  ResearchOperationsProjectionIndexRecord
} from "../ports/store";
import {
  buildCandidateArenaReadModel,
  CandidateArenaRunner,
  type CandidateArenaTickOutcome,
  loadCandidateArenaEvidenceSnapshot,
  projectCandidateArenaTickReadModel,
  runCandidateArenaTick,
  withArenaStoreSnapshotMutation
} from "./arena";
import { buildResearchGeneralizationReadModel } from
  "./research-generalization-read-model";
import { buildResearchPopulationDiversity } from
  "./research-population-diversity";
import {
  projectResearchOperationsOpenTickSessions,
  materializeResearchOperationsProjectionCapsuleTrie,
  researchOperationsProjectionCapsuleHasIntegrity,
  researchOperationsProjectionCapsuleTrieDigest,
  researchOperationsProjectionCapsuleTrieHasIntegrity,
  researchOperationsProjectionCapsuleTrieNodeHasIntegrity,
  researchOperationsProjectionIndexHasIntegrity,
  researchOperationsProjectionSourceRecordHasBoundedShape,
  ResearchOperationsProjectionService
} from "../services/research-operations";

const EMPTY_PROJECTION = {
  availability: "available",
  latest_ticks: [],
  terminal_tick_ids: [],
  research_population_diversity: buildResearchPopulationDiversity({
    ticks: [],
    directions: [],
    commitments: [],
    fingerprints: [],
    admissions: []
  }),
  research_generalization: buildResearchGeneralizationReadModel({
    protocols: [],
    studies: [],
    studyOutcomes: [],
    outcomes: [],
    decisions: [],
    allocations: [],
    ticks: []
  }),
  projection_digest: `sha256:${"0".repeat(64)}`
} satisfies CandidateArenaEvidenceProjection;

describe("CandidateArena compact evidence projection", () => {
  it("uses the compact projection without reading raw research evidence lists", async () => {
    const rawRead = async (): Promise<never> => {
      throw new Error("raw_candidate_arena_evidence_read");
    };
    const store = emptyArenaStore({
      readCandidateArenaEvidenceProjection: async () => EMPTY_PROJECTION,
      listCandidateArenaResearchAllocations: rawRead,
      listCandidateArenaTicks: rawRead,
      listResearchDirections: rawRead,
      listResearchPreflightCommitments: rawRead,
      listResearchBehaviorFingerprints: rawRead,
      listCandidateAdmissionDecisions: rawRead,
      listResearchGeneralizationProtocols: rawRead,
      listResearchControlStudies: rawRead,
      listResearchControlStudyOutcomes: rawRead,
      listResearchGeneralizationOutcomes: rawRead,
      listResearchGeneralizationPolicyDecisions: rawRead
    });

    const arena = await buildCandidateArenaReadModel(store, "stopped", 7);

    expect(arena.research_population_diversity).toEqual(
      EMPTY_PROJECTION.research_population_diversity
    );
    expect(arena.research_generalization).toEqual(
      EMPTY_PROJECTION.research_generalization
    );
  });

  it("matches the legacy raw-list read model for the same evidence", async () => {
    const tick: CandidateArenaTickRecord = {
      record_kind: "candidate_arena_tick",
      version: 1,
      candidate_arena_tick_id: "candidate-arena-tick-projection-parity",
      tick_id: "tick-projection-parity",
      started_at: "2026-07-28T00:00:00.000Z",
      completed_at: "2026-07-28T00:00:01.000Z",
      status: "completed",
      created_candidate_refs: [],
      direction_results: [],
      authority_status: "not_live"
    };
    const projectedTick = projectCandidateArenaTickReadModel(tick);
    const projection: CandidateArenaEvidenceProjection = {
      ...EMPTY_PROJECTION,
      latest_ticks: [projectedTick],
      terminal_tick_ids: [],
      research_population_diversity: buildResearchPopulationDiversity({
        ticks: [tick],
        directions: [],
        commitments: [],
        fingerprints: [],
        admissions: []
      }),
      research_generalization: buildResearchGeneralizationReadModel({
        protocols: [],
        studies: [],
        studyOutcomes: [],
        outcomes: [],
        decisions: [],
        allocations: [],
        ticks: [tick]
      })
    };
    const legacy = await buildCandidateArenaReadModel(
      emptyArenaStore({ listCandidateArenaTicks: async () => [tick] }),
      "running",
      11
    );
    const compact = await buildCandidateArenaReadModel(
      emptyArenaStore({
        readCandidateArenaEvidenceProjection: async () => projection
      }),
      "running",
      11
    );

    expect(compact).toEqual(legacy);
    expect(compact.latest_ticks.map((entry) => entry.tick_id)).toEqual([
      tick.tick_id
    ]);
  });

  it("fails closed when the compact projection read fails", async () => {
    let rawReadCount = 0;
    const rawRead = async () => {
      rawReadCount += 1;
      return [];
    };
    const store = emptyArenaStore({
      readCandidateArenaEvidenceProjection: async () => {
        throw new Error("candidate_arena_projection_invalid");
      },
      listCandidateArenaResearchAllocations: rawRead,
      listCandidateArenaTicks: rawRead
    });

    await expect(loadCandidateArenaEvidenceSnapshot(store)).rejects.toThrow(
      "candidate_arena_projection_invalid"
    );
    expect(rawReadCount).toBe(0);
  });

  it("does not accept a structurally spoofed compatibility error", async () => {
    let rawReadCount = 0;
    const spoofed = Object.assign(
      new Error("research_operations_projection_compatibility_blocked"),
      { reason: "legacy_source_oversized" }
    );
    const store = emptyArenaStore({
      readCandidateArenaEvidenceProjection: async () => {
        throw spoofed;
      },
      listCandidateArenaResearchAllocations: async () => {
        rawReadCount += 1;
        return [];
      },
      listCandidateArenaTicks: async () => {
        rawReadCount += 1;
        return [];
      }
    });

    await expect(loadCandidateArenaEvidenceSnapshot(store)).rejects.toBe(
      spoofed
    );
    expect(rawReadCount).toBe(0);
  });

  it("fails closed when compact Arena evidence is unavailable", async () => {
    const store = emptyArenaStore({
      readCandidateArenaEvidenceProjection: async () => ({
        availability: "unavailable",
        projection_digest: `sha256:${"f".repeat(64)}`
      })
    });

    await expect(loadCandidateArenaEvidenceSnapshot(store)).rejects.toThrow(
      "candidate_arena_evidence_projection_unavailable"
    );
  });

  it("runs queued Arena mutation closures inside a projection batch", async () => {
    const events: string[] = [];
    const store = {
      runResearchOperationsProjectionBatch: async <T>(
        task: () => Promise<T>
      ) => {
        events.push("batch");
        return task();
      },
      listResearchWorkerCheckpoints: async () => {
        events.push("mutation");
        throw new Error("stop_after_first_mutation");
      }
    } as unknown as OuroborosStorePort;

    await expect(runCandidateArenaTick({
      store,
      researchAgent: "fixture",
      agentFactory: () => ({}) as never,
      now: () => "2026-07-28T00:00:00.000Z"
    })).rejects.toThrow("stop_after_first_mutation");

    expect(events).toEqual(["batch", "mutation"]);
  });

  it("preloads Arena context before projection-relevant writes dirty the batch", async () => {
    const events: string[] = [];
    let dirty = false;
    const store = emptyArenaStore({
      runResearchOperationsProjectionBatch: async <T>(
        task: () => Promise<T>
      ) => {
        events.push("batch");
        try {
          return await task();
        } finally {
          dirty = false;
          events.push("flush");
        }
      },
      readCandidateArenaEvidenceProjection: async () => {
        events.push(`projection:${dirty ? "dirty" : "clean"}`);
        if (dirty) throw new Error("candidate_arena_projection_dirty");
        return EMPTY_PROJECTION;
      },
      recordResearchPreflightCommitment: async (commitment) => {
        dirty = true;
        events.push("write");
        return commitment;
      }
    });

    const result = await withArenaStoreSnapshotMutation(
      store,
      () => buildCandidateArenaReadModel(store, "stopped", 0),
      async (arena) => {
        await store.recordResearchPreflightCommitment({} as never);
        await expect(buildCandidateArenaReadModel(store, "stopped", 0))
          .rejects.toThrow("candidate_arena_projection_dirty");
        events.push(`snapshot:${arena.tick_count}`);
        return arena.tick_count;
      }
    );

    expect(result).toBe(0);
    expect(events).toEqual([
      "batch",
      "projection:clean",
      "write",
      "projection:dirty",
      "snapshot:0",
      "flush"
    ]);
  });

  it("propagates continuation persistence failures instead of reporting a healthy tick", async () => {
    const tick = tickRecord(
      "continuation-persistence",
      "2026-07-28T00:00:01.000Z"
    );
    let persistAttempts = 0;
    const runner = new CandidateArenaRunner({
      store: emptyArenaStore({
        listCandidateArenaTicks: async () => [tick],
        recordCandidateArenaTick: async () => {
          persistAttempts += 1;
          throw new Error("continuation_persist_failed");
        }
      }),
      researchAgent: "fixture",
      agentFactory: () => ({}) as never
    });
    runner.setTickContinuation(() => ({
      status: "failed",
      command_kind: "trading_run.start",
      error: "paper continuation failed",
      authority_status: "not_live"
    }));
    const internal = runner as unknown as {
      running: boolean;
      applyTickContinuation: (
        outcome: CandidateArenaTickOutcome
      ) => Promise<CandidateArenaTickOutcome>;
    };
    internal.running = true;
    const outcome: CandidateArenaTickOutcome = {
      status: "completed",
      tick_id: tick.tick_id,
      created_candidate_count: 0,
      created_candidate_ids: [],
      arena: {} as CandidateArenaTickOutcome["arena"]
    };

    await expect(internal.applyTickContinuation(outcome)).rejects.toThrow(
      "continuation_persist_failed"
    );
    expect(persistAttempts).toBe(1);
  });

  it("sanitizes private paths, tokens, and oversized failure text", async () => {
    const marker = "private-projection-owner";
    const secret = "projection-secret-token";
    const rawFailure = [
      `provider failed at /Users/${marker}/research/session.json`,
      `OPENAI_API_KEY=${secret}`,
      "x".repeat(20_000)
    ].join(" ");
    const tick = tickRecord("privacy", "2026-07-28T00:00:00.000Z", {
      status: "failed",
      direction_results: [{
        direction_kind: "trend_following",
        status: "failed",
        error: rawFailure
      }]
    });

    const projected = projectCandidateArenaTickReadModel(tick);
    const serialized = JSON.stringify(projected);

    expect(projected.direction_results[0]?.error?.length).toBeLessThanOrEqual(256);
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("/Users/");
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaTicks: async () => [tick]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();
    expect(researchOperationsProjectionIndexHasIntegrity(materialized.index))
      .toBe(true);
  });

  it("truncates the compact latest-tick window to ten with legacy parity", async () => {
    const ticks = Array.from({ length: 12 }, (_, index) => tickRecord(
      `window-${index}`,
      new Date(Date.UTC(2026, 6, 28, 0, 0, index)).toISOString()
    ));
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaTicks: async () => ticks
      }),
      runnerHealth: stoppedRunnerHealth
    });

    const materialized = await projectionService.materializeProjection();
    expect(researchOperationsProjectionIndexHasIntegrity(materialized.index))
      .toBe(true);
    expect(materialized.index.candidate_arena_evidence.availability).toBe(
      "available"
    );
    if (materialized.index.candidate_arena_evidence.availability !==
      "available") {
      throw new Error("projection_unavailable");
    }
    const compactTicks = materialized.index.candidate_arena_evidence.latest_ticks;
    const legacy = await buildCandidateArenaReadModel(
      emptyArenaStore({ listCandidateArenaTicks: async () => ticks }),
      "stopped",
      12
    );

    expect(compactTicks).toEqual(legacy.latest_ticks);
    expect(compactTicks).toHaveLength(10);
    expect(compactTicks.map((tick) => tick.tick_id)).toEqual(
      ticks.slice().reverse().slice(0, 10).map((tick) => tick.tick_id)
    );
    expect(materialized.index.candidate_arena_evidence.terminal_tick_ids)
      .toEqual([]);
  });

  it("marks only a uniquely bound canonical allocation and tick as terminal", async () => {
    const allocation = explicitAllocation("canonical-terminal", [
      "trend_following"
    ]);
    const tick = allocationTick(allocation);
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation],
        listCandidateArenaTicks: async () => [tick]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();

    expect(materialized.index.candidate_arena_evidence.availability).toBe(
      "available"
    );
    if (materialized.index.candidate_arena_evidence.availability !==
      "available") throw new Error("projection_unavailable");
    expect(materialized.index.candidate_arena_evidence.terminal_tick_ids)
      .toEqual([tick.tick_id]);
    expect(materialized.index.candidate_arena_evidence.latest_ticks[0]
      ?.research_allocation?.allocation_id).toBe(
      allocation.candidate_arena_research_allocation_id
    );
  });

  it.each([
    {
      name: "a noncanonical allocation digest",
      mutate: (
        allocation: CandidateArenaResearchAllocationRecord,
        _tick: CandidateArenaTickRecord
      ) => {
        allocation.allocation_digest = `sha256:${"f".repeat(64)}`;
      }
    },
    {
      name: "a mismatched tick allocation digest",
      mutate: (
        _allocation: CandidateArenaResearchAllocationRecord,
        tick: CandidateArenaTickRecord
      ) => {
        tick.research_allocation_digest = `sha256:${"e".repeat(64)}`;
      }
    },
    {
      name: "a mismatched tick direction binding",
      mutate: (
        _allocation: CandidateArenaResearchAllocationRecord,
        tick: CandidateArenaTickRecord
      ) => {
        tick.direction_results[0]!.direction_kind = "mean_reversion";
      }
    }
  ])("fails compact evidence closed for $name", async ({ mutate }) => {
    const allocation = explicitAllocation("corrupt-graph", [
      "trend_following"
    ]);
    const tick = allocationTick(allocation);
    mutate(allocation, tick);

    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation],
        listCandidateArenaTicks: async () => [tick]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();

    expect(materialized.index.candidate_arena_evidence).toEqual({
      availability: "unavailable"
    });
  });

  it("fails compact evidence closed for duplicate allocations and ticks", async () => {
    const allocation = explicitAllocation("duplicate-graph", [
      "trend_following"
    ]);
    const tick = allocationTick(allocation);

    for (const overrides of [
      {
        listCandidateArenaResearchAllocations: async () => [
          allocation,
          structuredClone(allocation)
        ],
        listCandidateArenaTicks: async () => [tick]
      },
      {
        listCandidateArenaResearchAllocations: async () => [allocation],
        listCandidateArenaTicks: async () => [tick, structuredClone(tick)]
      }
    ]) {
      const materialized = await new ResearchOperationsProjectionService({
        store: emptyResearchProjectionStore(overrides),
        runnerHealth: stoppedRunnerHealth
      }).materializeProjection();
      expect(materialized.index.candidate_arena_evidence).toEqual({
        availability: "unavailable"
      });
    }
  });

  it("rejects a forged nested authority field even after the index is resealed", async () => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(true);
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const forgedGeneralization = structuredClone(index);
    if (forgedGeneralization.candidate_arena_evidence.availability !==
      "available") throw new Error("projection_unavailable");
    (forgedGeneralization.candidate_arena_evidence.research_generalization as {
      authority_status: string;
      injected?: boolean;
    }).authority_status = "research_policy_only";
    (forgedGeneralization.candidate_arena_evidence.research_generalization as {
      injected?: boolean;
    }).injected = true;
    resealIndex(forgedGeneralization);

    const forgedDiversity = structuredClone(index);
    if (forgedDiversity.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    (forgedDiversity.candidate_arena_evidence.research_population_diversity as {
      promotion_authority: boolean;
    }).promotion_authority = true;
    resealIndex(forgedDiversity);

    const conformanceIndex = structuredClone(index);
    if (conformanceIndex.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const conformanceTick = projectCandidateArenaTickReadModel(tickRecord(
      "conformance",
      "2026-07-28T00:00:00.000Z",
      {
        direction_results: [{
          direction_kind: "trend_following",
          status: "quarantined",
          finding: "Paper handoff was rejected.",
          admission_decision_id: "admission-conformance",
          admission_reason: "paper_handoff_conformance_failed",
          paper_handoff_conformance: {
            conformance_id: "conformance-safe",
            status: "rejected",
            reason: "runner_crash",
            authority_status: "research_only"
          }
        }]
      }
    ));
    conformanceIndex.candidate_arena_evidence.latest_ticks = [conformanceTick];
    conformanceIndex.candidate_arena_evidence.terminal_tick_ids = [];
    resealIndex(conformanceIndex);
    expect(researchOperationsProjectionIndexHasIntegrity(conformanceIndex))
      .toBe(true);
    conformanceTick.direction_results[0]!.paper_handoff_conformance!.reason =
      "/Users/private-owner/session token=private" as "runner_crash";
    resealIndex(conformanceIndex);
    const unsafeSource = tickRecord(
      "unsafe-conformance",
      "2026-07-28T00:00:00.000Z",
      {
        direction_results: [{
          direction_kind: "trend_following",
          status: "quarantined",
          finding: "Paper handoff was rejected.",
          admission_decision_id: "admission-unsafe-conformance",
          admission_reason: "paper_handoff_conformance_failed",
          paper_handoff_conformance: {
            conformance_id: "conformance-unsafe",
            status: "rejected",
            reason: "/Users/private-owner/session token=private" as
              "runner_crash",
            authority_status: "research_only"
          }
        }]
      }
    );

    expect(researchOperationsProjectionIndexHasIntegrity(forgedGeneralization))
      .toBe(false);
    expect(researchOperationsProjectionIndexHasIntegrity(forgedDiversity))
      .toBe(false);
    expect(researchOperationsProjectionIndexHasIntegrity(conformanceIndex))
      .toBe(false);
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(unsafeSource))
      .toBe(false);
  });

  it.each([
    ["passed", "runner_crash"],
    ["rejected", "passed"]
  ] as const)("rejects inconsistent projected conformance %s/%s", (
    status,
    reason
  ) => {
    const tick = tickRecord(
      `conformance-${status}-${reason}`,
      "2026-07-28T00:00:01.000Z",
      {
        direction_results: [{
          direction_kind: "trend_following",
          status: "created",
          candidate_id: "candidate-conformance",
          paper_handoff_conformance: {
            conformance_id: "conformance-inconsistent",
            status,
            reason,
            authority_status: "research_only"
          }
        }]
      }
    );

    expect(() => projectCandidateArenaTickReadModel(tick)).toThrow(
      "candidate_arena_projection_source_invalid"
    );
  });

  it("rejects a created source bound to rejected admission and handoff", () => {
    const { tick, allocation } = boundCreatedTickRecord(
      "contradictory-created-source"
    );
    tick.direction_results[0]!.admission_reason =
      "paper_handoff_conformance_failed";
    tick.direction_results[0]!.paper_handoff_conformance = {
      conformance_id: "conformance-contradictory-created-source",
      status: "rejected",
      reason: "runner_crash",
      authority_status: "research_only"
    };

    expect(() => projectCandidateArenaTickReadModel(tick, allocation)).toThrow(
      "candidate_arena_projection_source_invalid"
    );
  });

  it("rejects a created source missing admission and handoff evidence", () => {
    const { tick, allocation } = boundCreatedTickRecord(
      "missing-created-source-authority"
    );
    delete tick.direction_results[0]!.admission_decision_id;
    delete tick.direction_results[0]!.admission_reason;
    delete tick.direction_results[0]!.paper_handoff_conformance;

    expect(() => projectCandidateArenaTickReadModel(tick, allocation)).toThrow(
      "candidate_arena_projection_source_invalid"
    );
  });

  it("preserves an authority-free legacy unbound created tick", async () => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const projectedTick = projectCandidateArenaTickReadModel(
      legacyCreatedTickRecord("legacy-unbound")
    );
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [];
    resealIndex(index);

    expect(projectedTick.research_allocation).toBeUndefined();
    expect(projectedTick.direction_results[0]!.status)
      .toBe("legacy_unverified");
    expect(projectedTick.direction_results[0]!.admission_decision_id)
      .toBeUndefined();
    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(true);

    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);
    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it("rejects a legacy unbound created source carrying rejected authority", () => {
    const tick = legacyCreatedTickRecord("legacy-unbound-rejected");
    tick.direction_results[0]!.admission_decision_id =
      "admission-legacy-unbound-rejected";
    tick.direction_results[0]!.admission_reason =
      "paper_handoff_conformance_failed";
    tick.direction_results[0]!.paper_handoff_conformance = {
      conformance_id: "conformance-legacy-unbound-rejected",
      status: "rejected",
      reason: "runner_crash",
      authority_status: "research_only"
    };

    expect(() => projectCandidateArenaTickReadModel(tick)).toThrow(
      "candidate_arena_projection_source_invalid"
    );
  });

  it.each([
    {
      name: "created with allocation and all authority evidence removed",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        delete tick.research_allocation;
        delete tick.direction_results[0]!.admission_decision_id;
        delete tick.direction_results[0]!.admission_reason;
        delete tick.direction_results[0]!.paper_handoff_conformance;
      }
    },
    {
      name: "admitted created with its allocation binding removed",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        delete tick.research_allocation;
      }
    },
    {
      name: "created with missing admission and handoff",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        delete tick.direction_results[0]!.admission_decision_id;
        delete tick.direction_results[0]!.admission_reason;
        delete tick.direction_results[0]!.paper_handoff_conformance;
      }
    },
    {
      name: "created with rejected admission and handoff",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.direction_results[0]!.admission_reason =
          "paper_handoff_conformance_failed";
        tick.direction_results[0]!.paper_handoff_conformance = {
          conformance_id: "conformance-resealed-authority",
          status: "rejected",
          reason: "runner_crash",
          authority_status: "research_only"
        };
      }
    },
    {
      name: "legacy-unbound created with rejected authority",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        delete tick.research_allocation;
        tick.direction_results[0]!.admission_reason =
          "paper_handoff_conformance_failed";
        tick.direction_results[0]!.paper_handoff_conformance = {
          conformance_id: "conformance-resealed-legacy-unbound",
          status: "rejected",
          reason: "runner_crash",
          authority_status: "research_only"
        };
      }
    },
    {
      name: "handoff-failed quarantine with passed handoff",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.created_candidate_ids = [];
        tick.direction_results[0]!.status = "quarantined";
        delete tick.direction_results[0]!.candidate_id;
        tick.direction_results[0]!.admission_reason =
          "paper_handoff_conformance_failed";
      }
    },
    {
      name: "evaluation quarantine with unrelated passed handoff",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.created_candidate_ids = [];
        tick.direction_results[0]!.status = "quarantined";
        delete tick.direction_results[0]!.candidate_id;
        tick.direction_results[0]!.admission_reason = "evaluation_quarantined";
      }
    },
    {
      name: "created candidate ref mismatch",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.created_candidate_ids = ["candidate-other"];
      }
    },
    {
      name: "tick status inconsistent with its direction results",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.status = "completed_with_errors";
      }
    },
    {
      name: "allocation direction inconsistent with its result",
      mutate: (tick: ReturnType<typeof projectCandidateArenaTickReadModel>) => {
        tick.research_allocation!.selected_directions[0]!.direction_kind =
          "mean_reversion";
      }
    }
  ])("rejects resealed compact authority contradiction: $name", async ({
    mutate
  }) => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const { tick, allocation } = boundCreatedTickRecord("resealed-authority");
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    mutate(projectedTick);
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it("rejects a resealed bound candidate claimed by multiple directions", async () => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const { tick, allocation } = boundTwoCreatedTickRecord(
      "resealed-duplicate-candidate"
    );
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    projectedTick.direction_results[1]!.candidate_id =
      projectedTick.direction_results[0]!.candidate_id;
    projectedTick.created_candidate_ids = [
      projectedTick.direction_results[0]!.candidate_id!
    ];
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it("rejects a resealed allocation and direction result mutated together", async () => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const { tick, allocation } = boundCreatedTickRecord(
      "resealed-combined-allocation"
    );
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    projectedTick.research_allocation!.selected_directions[0]!.direction_kind =
      "other";
    projectedTick.direction_results[0]!.direction_kind = "other";
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it.each([
    {
      name: "evidence without its source",
      mutate: (trigger: NonNullable<NonNullable<
        ReturnType<typeof projectCandidateArenaTickReadModel>["research_allocation"]
      >["trigger"]>) => {
        trigger.trigger_kind = "goal";
        delete trigger.source_ref;
      }
    },
    {
      name: "an Arena event without evidence",
      mutate: (trigger: NonNullable<NonNullable<
        ReturnType<typeof projectCandidateArenaTickReadModel>["research_allocation"]
      >["trigger"]>) => {
        delete trigger.evidence_artifact_ref;
        delete trigger.evidence_artifact_digest;
      }
    },
    {
      name: "a live event without its source",
      mutate: (trigger: NonNullable<NonNullable<
        ReturnType<typeof projectCandidateArenaTickReadModel>["research_allocation"]
      >["trigger"]>) => {
        trigger.trigger_kind = "live_event";
        delete trigger.source_ref;
      }
    },
    {
      name: "a trigger after allocation",
      mutate: (trigger: NonNullable<NonNullable<
        ReturnType<typeof projectCandidateArenaTickReadModel>["research_allocation"]
      >["trigger"]>) => {
        trigger.triggered_at = "2026-07-28T00:00:01.000Z";
      }
    }
  ])("rejects a resealed compact trigger with $name", async ({ mutate }) => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const { tick, allocation } = boundCreatedTickRecord(
      "resealed-trigger-authority"
    );
    allocation.trigger = {
      trigger_kind: "arena_event",
      trigger_id: "trigger-resealed-trigger-authority",
      goal: "Run one evidence-bound Arena cycle.",
      triggered_at: allocation.allocated_at,
      source_ref: {
        record_kind: "research_finding",
        id: "finding-resealed-trigger-authority"
      },
      evidence_artifact_ref: {
        record_kind: "research_evidence_artifact",
        id: "evidence-resealed-trigger-authority"
      },
      evidence_artifact_digest: `sha256:${"7".repeat(64)}`,
      authority_status: "research_only"
    };
    resealAllocation(allocation);
    tick.research_allocation_digest = allocation.allocation_digest;
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    mutate(projectedTick.research_allocation!.trigger!);
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it("accepts compact passed handoff evidence rejected by a later gate", async () => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const { tick, allocation } = boundCreatedTickRecord(
      "later-gate-quarantine"
    );
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    projectedTick.created_candidate_ids = [];
    projectedTick.direction_results[0]!.status = "quarantined";
    delete projectedTick.direction_results[0]!.candidate_id;
    projectedTick.direction_results[0]!.admission_reason =
      "behavior_fingerprint_unavailable";
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(true);
  });

  it("rejects noncanonical egress denial counts at source and after reseal", async () => {
    const { tick, allocation } = boundCreatedTickRecord("egress-denial-counts");
    const requiredProbeCount = CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS.length;
    tick.direction_results[0]!.paper_handoff_conformance!
      .candidate_egress_attestation = {
        attestation_id: "attestation-egress-denial-counts",
        verification_status: "verified",
        enforcement_result: "enforced",
        network_policy_digest: `sha256:${"1".repeat(64)}`,
        denial_summary: {
          required_probe_count: requiredProbeCount,
          start_denied_probe_count: requiredProbeCount,
          end_denied_probe_count: requiredProbeCount,
          unexpected_allow_count: 0
        },
        authority_status: "research_only"
      };
    const forgedSource = structuredClone(tick);
    const forgedSourceDenial = forgedSource.direction_results[0]!
      .paper_handoff_conformance!.candidate_egress_attestation!.denial_summary;
    forgedSourceDenial.required_probe_count -= 1;
    forgedSourceDenial.start_denied_probe_count -= 1;
    forgedSourceDenial.end_denied_probe_count -= 1;

    expect(() => projectCandidateArenaTickReadModel(
      forgedSource,
      allocation
    )).toThrow("candidate_arena_projection_source_invalid");

    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const projectedTick = projectCandidateArenaTickReadModel(tick, allocation);
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    const projectedDenial = projectedTick.direction_results[0]!
      .paper_handoff_conformance!.candidate_egress_attestation!.denial_summary;
    projectedDenial.required_probe_count -= 1;
    projectedDenial.start_denied_probe_count -= 1;
    projectedDenial.end_denied_probe_count -= 1;
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it.each([
    ["passed", "runner_crash"],
    ["rejected", "passed"]
  ] as const)("rejects resealed compact conformance %s/%s", async (
    status,
    reason
  ) => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const projectedTick = projectCandidateArenaTickReadModel(tickRecord(
      `resealed-conformance-${status}-${reason}`,
      "2026-07-28T00:00:01.000Z",
      {
        direction_results: [{
          direction_kind: "trend_following",
          status: "quarantined",
          finding: "Paper handoff was rejected.",
          admission_decision_id: "admission-resealed-conformance",
          admission_reason: "paper_handoff_conformance_failed",
          paper_handoff_conformance: {
            conformance_id: "conformance-resealed",
            status: "rejected",
            reason: "runner_crash",
            authority_status: "research_only"
          }
        }]
      }
    ));
    projectedTick.direction_results[0]!.paper_handoff_conformance = {
      ...projectedTick.direction_results[0]!.paper_handoff_conformance!,
      status,
      reason
    };
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [projectedTick.tick_id];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it.each([
    "failure(/Users/private-owner/key)",
    ["failure -----", "BEGIN ", "PRIVATE", " KEY----- pem-secret -----", "END ",
      "PRIVATE", " KEY-----"].join("")
  ])("rejects resealed compact private text %s", async (unsafeText) => {
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    });
    const { index } = await projectionService.materializeProjection();
    if (index.candidate_arena_evidence.availability !== "available") {
      throw new Error("projection_unavailable");
    }
    const projectedTick = projectCandidateArenaTickReadModel(tickRecord(
      "resealed-private-text",
      "2026-07-28T00:00:01.000Z",
      {
        status: "failed",
        direction_results: [{
          direction_kind: "trend_following",
          status: "failed",
          error: "Research provider failed safely."
        }]
      }
    ));
    projectedTick.direction_results[0]!.error = unsafeText;
    index.candidate_arena_evidence.latest_ticks = [projectedTick];
    index.candidate_arena_evidence.terminal_tick_ids = [];
    resealIndex(index);

    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(false);
  });

  it("keeps the root open-session set bounded across more than 1,500 sessions", async () => {
    const capsules = Array.from({ length: 1_600 }, (_, index) => ({
      research_work_item_id: `work-${index.toString().padStart(4, "0")}`,
      capsule_digest: projectionDigest({ index }),
      runtime_identity: { tick_id: `tick-${index.toString().padStart(4, "0")}` },
      terminal_evidence_present: false
    })) as unknown as ResearchOperationsProjectionCapsule[];

    const projected = projectResearchOperationsOpenTickSessions(capsules);

    expect(projected.open_tick_session_count).toBe(1_600);
    expect(projected.projected_open_tick_session_count).toBe(100);
    expect(projected.omitted_open_tick_session_count).toBe(1_500);
    expect(projected.open_tick_sessions_truncated).toBe(true);
    expect(projected.open_tick_session_refs).toHaveLength(100);
    expect(Buffer.byteLength(JSON.stringify(projected), "utf8"))
      .toBeLessThan(256 * 1024);
    const base = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore(),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();
    const ids = capsules.map((capsule) => capsule.research_work_item_id);
    const trie = materializeResearchOperationsProjectionCapsuleTrie(capsules);
    const index: ResearchOperationsProjectionIndexRecord = {
      ...base.index,
      ...projected,
      head_session_refs: capsules.slice(0, 100).map((capsule, index) => ({
        research_work_item_id: capsule.research_work_item_id,
        allocated_at: new Date(
          Date.parse("2026-07-28T00:00:00.000Z") + index
        ).toISOString(),
        capsule_digest: capsule.capsule_digest
      })),
      capsule_trie_root_refs: trie.root_refs,
      recorded_session_count: ids.length,
      incomplete_without_conflict_count: ids.length,
      capsule_set_digest: researchOperationsProjectionCapsuleTrieDigest(
        trie.root_refs
      ),
      session_membership: sessionMembership(ids),
      projection_digest: ""
    };
    const { projection_digest: _digest, ...payload } = index;
    index.projection_digest = projectionDigest(payload);

    expect(Buffer.byteLength(JSON.stringify(index), "utf8"))
      .toBeLessThan(256 * 1024);
    expect(researchOperationsProjectionIndexHasIntegrity(index)).toBe(true);
  });

  it("seals every capsule to the complete sorted sibling set for its tick", async () => {
    const allocation = explicitAllocation("siblings", [
      "trend_following",
      "mean_reversion"
    ]);
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();
    const ids = materialized.capsules
      .map((capsule) => capsule.research_work_item_id)
      .sort();

    expect(ids).toHaveLength(2);
    for (const capsule of materialized.capsules) {
      expect(capsule.runtime_identity.tick_research_work_item_ids).toEqual(ids);
      expect(researchOperationsProjectionCapsuleHasIntegrity(capsule)).toBe(true);
    }

    const forged = structuredClone(materialized.capsules[0]!);
    forged.runtime_identity.tick_research_work_item_ids = ids.filter(
      (id) => id !== forged.research_work_item_id
    );
    const { capsule_digest: _digest, ...payload } = forged;
    forged.capsule_digest = projectionDigest(payload);
    expect(researchOperationsProjectionCapsuleHasIntegrity(forged)).toBe(false);
  });

  it("rejects resealed nested index refs and membership metadata", async () => {
    const allocation = explicitAllocation("nested-index-integrity", [
      "trend_following"
    ]);
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();

    const mutations: Array<(
      index: ResearchOperationsProjectionIndexRecord
    ) => void> = [
      (index) => {
        (index.head_session_refs[0] as unknown as Record<string, unknown>)
          .injected = true;
      },
      (index) => {
        index.head_session_refs[0]!.research_work_item_id = " ../unsafe ";
      },
      (index) => {
        (index.open_tick_session_refs[0] as unknown as Record<string, unknown>)
          .injected = true;
      },
      (index) => {
        index.open_tick_session_refs[0]!.tick_id = "../unsafe";
      },
      (index) => {
        index.open_tick_session_refs[0]!.research_work_item_ids[0] =
          "../unsafe";
      },
      (index) => {
        (index.session_membership as unknown as Record<string, unknown>)
          .injected = true;
      },
      (index) => {
        index.head_session_refs = [];
      }
    ];

    for (const mutate of mutations) {
      const forged = structuredClone(materialized.index);
      mutate(forged);
      resealIndex(forged);
      expect(researchOperationsProjectionIndexHasIntegrity(forged)).toBe(false);
    }
  });

  it.each([
    {
      name: "an unknown nested detail field",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          (detail as unknown as Record<string, unknown>)
            .unexpected_authority = true;
        }
      }
    },
    {
      name: "private text in an active detail",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          detail.latest_progress_summary =
            "/Users/private-owner/session OPENAI_API_KEY=private-token";
        }
      }
    },
    {
      name: "provider fields while provider evidence is unavailable",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          Object.assign(detail, {
            model: "private-provider-model",
            model_truncated: false
          });
        }
      }
    },
    {
      name: "an unsanitized available provider model",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          Object.assign(detail, {
            provider_availability: "available",
            provider: "codex_cli",
            model: "failure(/Users/private-owner/model)",
            model_truncated: false
          });
        }
      }
    },
    {
      name: "live or order authority in a terminal graph",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          Object.assign(detail.terminal_graph, {
            order_submission_authority: true,
            live_exchange_authority: true
          });
        }
      }
    },
    {
      name: "an inconsistent selected-artifact union",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          Object.assign(detail, {
            selected_artifact_availability: "not_selected",
            selected_submission_sequence: 1
          });
        }
      }
    },
    {
      name: "passed conformance with a rejection reason",
      mutate: (capsule: ResearchOperationsProjectionCapsule) => {
        for (const detail of [
          capsule.inactive_detail,
          capsule.active_queued_detail
        ]) {
          detail.paper_handoff_conformance_ref = {
            record_kind: "paper_trading_handoff_conformance",
            id: "conformance-invalid-pair"
          };
          detail.terminal_graph.paper_handoff_conformance = {
            paper_trading_handoff_conformance_ref: {
              record_kind: "paper_trading_handoff_conformance",
              id: "conformance-invalid-pair"
            },
            status: "passed",
            reason: "runner_crash",
            completed_at: "2026-07-28T00:00:01.000Z",
            evidence_digest: `sha256:${"a".repeat(64)}`,
            authority_status: "read_only"
          };
        }
      }
    }
  ])("rejects a resealed capsule containing $name", async ({ mutate }) => {
    const allocation = explicitAllocation("capsule-detail-integrity", [
      "trend_following"
    ]);
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();
    const capsule = structuredClone(materialized.capsules[0]!);

    mutate(capsule);
    resealCapsule(capsule);

    expect(researchOperationsProjectionCapsuleHasIntegrity(capsule)).toBe(false);
  });

  it("rejects a resealed capsule whose evidence subject has the wrong role", async () => {
    const allocation = explicitAllocation("capsule-evidence-role", [
      "trend_following"
    ]);
    const materialized = await new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaResearchAllocations: async () => [allocation]
      }),
      runnerHealth: stoppedRunnerHealth
    }).materializeProjection();
    const capsule = structuredClone(materialized.capsules[0]!);
    type ProjectedEvidence = ResearchOperationsProjectionCapsule[
      "inactive_detail"
    ]["evidence_inputs"][number];
    const evidence: ProjectedEvidence = {
      evidence_artifact_id: "evidence-role-check",
      source_kind: "research_finding",
      subject_ref: {
        record_kind: "research_worker",
        id: "worker-role-check"
      },
      artifact_ref: {
        record_kind: "research_finding",
        id: "finding-role-check"
      },
      artifact_digest: `sha256:${"a".repeat(64)}`,
      summary: "Sanitized research finding.",
      truncated: false,
      captured_at: "2026-07-28T00:00:01.000Z",
      sanitization_status: "sanitized",
      qualification_evidence_hidden: true,
      authority_status: "research_only"
    };
    for (const detail of [
      capsule.inactive_detail,
      capsule.active_queued_detail
    ]) {
      detail.evidence_inputs = [structuredClone(evidence)];
    }
    resealCapsule(capsule);
    expect(researchOperationsProjectionCapsuleHasIntegrity(capsule)).toBe(true);

    for (const detail of [
      capsule.inactive_detail,
      capsule.active_queued_detail
    ]) {
      detail.evidence_inputs[0]!.subject_ref = {
        record_kind: "research_finding",
        id: "finding-role-check"
      };
    }
    resealCapsule(capsule);

    expect(researchOperationsProjectionCapsuleHasIntegrity(capsule)).toBe(false);
  });

  it("splits a concentrated first-byte capsule set into a bounded Merkle radix trie", () => {
    const targetPrefix = "00";
    const capsules: ResearchOperationsProjectionCapsule[] = [];
    for (let index = 0; capsules.length < 180; index += 1) {
      const researchWorkItemId = `concentrated-${index}`;
      if (createHash("sha256").update(researchWorkItemId).digest("hex")
        .slice(0, 2) !== targetPrefix) continue;
      capsules.push({
        research_work_item_id: researchWorkItemId,
        capsule_digest: projectionDigest({ researchWorkItemId })
      } as ResearchOperationsProjectionCapsule);
    }

    const trie = materializeResearchOperationsProjectionCapsuleTrie(capsules);
    const root = trie.nodes.find((node) => node.prefix === targetPrefix);

    expect(trie.root_refs).toHaveLength(1);
    expect(root?.node_kind).toBe("branch");
    expect(trie.nodes.length).toBeGreaterThan(1);
    expect(trie.nodes.every((node) =>
      Buffer.byteLength(`${JSON.stringify(node, null, 2)}\n`, "utf8") <=
        256 * 1024
    )).toBe(true);
    expect(trie.nodes.every(
      researchOperationsProjectionCapsuleTrieNodeHasIntegrity
    )).toBe(true);
    expect(researchOperationsProjectionCapsuleTrieHasIntegrity(
      trie.root_refs,
      trie.nodes,
      capsules
    )).toBe(true);
    expect(materializeResearchOperationsProjectionCapsuleTrie(
      [...capsules].reverse()
    )).toEqual(trie);
  });

  it("rejects a resealed trie branch whose child leaves its hash prefix", () => {
    const capsules: ResearchOperationsProjectionCapsule[] = [];
    for (let index = 0; capsules.length < 180; index += 1) {
      const researchWorkItemId = `tamper-concentrated-${index}`;
      if (createHash("sha256").update(researchWorkItemId).digest("hex")
        .slice(0, 2) !== "00") continue;
      capsules.push({
        research_work_item_id: researchWorkItemId,
        capsule_digest: projectionDigest({ researchWorkItemId })
      } as ResearchOperationsProjectionCapsule);
    }
    const trie = materializeResearchOperationsProjectionCapsuleTrie(capsules);
    const branch = structuredClone(trie.nodes.find((node) =>
      node.prefix === "00"
    )) as ResearchOperationsProjectionCapsuleTrieNode;
    if (branch.node_kind !== "branch") throw new Error("expected_branch");
    branch.children[0]!.prefix = "ff";
    resealTrieNode(branch);

    expect(researchOperationsProjectionCapsuleTrieNodeHasIntegrity(branch))
      .toBe(false);
  });

  it("rejects an oversized source record before persistence", () => {
    const tick = tickRecord("oversized", "2026-07-28T00:00:00.000Z", {
      status: "failed",
      direction_results: [{
        direction_kind: "trend_following",
        status: "failed",
        error: "x".repeat(300_000)
      }]
    });

    expect(researchOperationsProjectionSourceRecordHasBoundedShape(tick))
      .toBe(false);
  });

  it("rejects source arrays that cannot be represented without silent slicing", () => {
    const oversizedTick = tickRecord(
      "oversized-array",
      "2026-07-28T00:00:01.000Z",
      {
        created_candidate_refs: Array.from({ length: 11 }, (_, index) => ({
          record_kind: "trading_system_candidate" as const,
          id: `candidate-${index}`
        }))
      }
    );
    const allocation = explicitAllocation("oversized-reasons", [
      "trend_following"
    ]);
    allocation.selected_directions[0]!.reasons = Array.from(
      { length: 11 },
      (_, index) => `reason-${index}`
    );
    resealAllocation(allocation);
    const boundTick = allocationTick(allocation);

    expect(() => projectCandidateArenaTickReadModel(oversizedTick)).toThrow(
      "candidate_arena_projection_source_invalid"
    );
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(oversizedTick))
      .toBe(false);
    expect(() => projectCandidateArenaTickReadModel(boundTick, allocation))
      .toThrow("candidate_arena_projection_source_invalid");
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(allocation))
      .toBe(false);
  });

  it("bounds Finding and Lineage references before canonical persistence", () => {
    const finding: ResearchFindingRecord = {
      record_kind: "research_finding",
      version: 1,
      research_finding_id: "finding-ref-bound",
      research_worker_ref: {
        record_kind: "research_worker",
        id: "worker-ref-bound"
      },
      research_direction_ref: {
        record_kind: "research_direction",
        id: "direction-ref-bound"
      },
      experiment_run_ref: {
        record_kind: "experiment_run",
        id: "experiment-ref-bound"
      },
      trading_evaluation_result_ref: {
        record_kind: "trading_evaluation_result",
        id: "evaluation-ref-bound"
      },
      finding_kind: "failure_analysis",
      summary: "Bounded projection source.",
      supporting_record_refs: Array.from({ length: 101 }, (_, index) => ({
        record_kind: "metric_snapshot",
        id: `metric-${index}`
      })),
      created_at: "2026-07-28T00:00:01.000Z",
      authority_status: "research_trace_only"
    };
    const lineage: ArtifactLineageRecord = {
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: "lineage-ref-bound",
      child_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-ref-bound"
      },
      source_finding_refs: Array.from({ length: 101 }, (_, index) => ({
        record_kind: "research_finding",
        id: `finding-${index}`
      })),
      created_at: "2026-07-28T00:00:01.000Z",
      authority_status: "lineage_only"
    };

    expect(researchOperationsProjectionSourceRecordHasBoundedShape(finding))
      .toBe(false);
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(lineage))
      .toBe(false);
    finding.supporting_record_refs.pop();
    lineage.source_finding_refs.pop();
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(finding))
      .toBe(true);
    expect(researchOperationsProjectionSourceRecordHasBoundedShape(lineage))
      .toBe(true);
  });

  it("continues a terminal active tick with zero Research work", async () => {
    const tick = tickRecord("terminal-active", "2026-07-28T00:00:00.000Z");
    const projectionService = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        listCandidateArenaTicks: async () => [tick]
      }),
      runnerHealth: stoppedRunnerHealth
    });
    const materialized = await projectionService.materializeProjection();
    if (materialized.index.candidate_arena_evidence.availability !==
      "available") {
      throw new Error("projection_unavailable");
    }
    const arenaEvidence: CandidateArenaEvidenceProjection = {
      ...materialized.index.candidate_arena_evidence,
      projection_digest: materialized.index.projection_digest
    };
    const reader = new ResearchOperationsProjectionService({
      store: emptyResearchProjectionStore({
        readResearchOperationsProjectionWindow: async (input) => {
          expect(input.active_tick_id).toBe(tick.tick_id);
          expect(input.active_research_work_item_ids).toEqual([]);
          return { index: materialized.index, capsules: [] };
        }
      }),
      runnerHealth: () => ({
        ...stoppedRunnerHealth(),
        status: "running",
        active_tick: true,
        active_tick_id: tick.tick_id
      })
    });

    const operations = await reader.readOperations(arenaEvidence);

    expect(operations.availability).toBe("available");
    expect(operations.capacity.active_session_count).toBe(0);
    expect(operations.capacity.queued_session_count).toBe(0);
  });
});

function tickRecord(
  token: string,
  completedAt: string,
  overrides: Partial<CandidateArenaTickRecord> = {}
): CandidateArenaTickRecord {
  const startedAt = new Date(Date.parse(completedAt) - 1_000).toISOString();
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${token}`,
    tick_id: `tick-${token}`,
    started_at: startedAt,
    completed_at: completedAt,
    status: "completed",
    created_candidate_refs: [],
    direction_results: [],
    authority_status: "not_live",
    ...overrides
  };
}

function createdTickRecordWithAuthority(token: string): CandidateArenaTickRecord {
  const candidateId = `candidate-${token}`;
  return tickRecord(token, "2026-07-28T00:00:01.000Z", {
    created_candidate_refs: [{
      record_kind: "trading_system_candidate",
      id: candidateId
    }],
    direction_results: [{
      direction_kind: "trend_following",
      status: "created",
      candidate_id: candidateId,
      finding: "Candidate admitted with exact paper handoff evidence.",
      admission_decision_id: `admission-${token}`,
      admission_reason: "evaluation_accepted",
      research_preflight: {
        commitment_id: `commitment-${token}`,
        development_submission_count: 1,
        sealed_terminal_status: "accepted",
        reason: "accepted",
        authority_status: "not_promotion_authority"
      },
      paper_handoff_conformance: {
        conformance_id: `conformance-${token}`,
        status: "passed",
        reason: "passed",
        authority_status: "research_only"
      }
    }]
  });
}

function boundCreatedTickRecord(token: string): {
  tick: CandidateArenaTickRecord;
  allocation: CandidateArenaResearchAllocationRecord;
} {
  const allocation = explicitAllocation(token, ["trend_following"]);
  const tick = createdTickRecordWithAuthority(token);
  tick.research_allocation_ref = {
    record_kind: "candidate_arena_research_allocation",
    id: allocation.candidate_arena_research_allocation_id
  };
  tick.research_allocation_digest = allocation.allocation_digest;
  return { tick, allocation };
}

function boundTwoCreatedTickRecord(token: string): {
  tick: CandidateArenaTickRecord;
  allocation: CandidateArenaResearchAllocationRecord;
} {
  const allocation = explicitAllocation(token, [
    "trend_following",
    "mean_reversion"
  ]);
  const tick = createdTickRecordWithAuthority(token);
  const secondCandidateId = `candidate-${token}-mean-reversion`;
  tick.created_candidate_refs.push({
    record_kind: "trading_system_candidate",
    id: secondCandidateId
  });
  tick.direction_results.push({
    ...structuredClone(tick.direction_results[0]!),
    direction_kind: "mean_reversion",
    candidate_id: secondCandidateId,
    admission_decision_id: `admission-${token}-mean-reversion`,
    research_preflight: {
      ...tick.direction_results[0]!.research_preflight!,
      commitment_id: `commitment-${token}-mean-reversion`
    },
    paper_handoff_conformance: {
      ...tick.direction_results[0]!.paper_handoff_conformance!,
      conformance_id: `conformance-${token}-mean-reversion`
    }
  });
  tick.research_allocation_ref = {
    record_kind: "candidate_arena_research_allocation",
    id: allocation.candidate_arena_research_allocation_id
  };
  tick.research_allocation_digest = allocation.allocation_digest;
  return { tick, allocation };
}

function legacyCreatedTickRecord(token: string): CandidateArenaTickRecord {
  const candidateId = `candidate-${token}`;
  return tickRecord(token, "2026-07-28T00:00:01.000Z", {
    created_candidate_refs: [{
      record_kind: "trading_system_candidate",
      id: candidateId
    }],
    direction_results: [{
      direction_kind: "trend_following",
      status: "created",
      candidate_id: candidateId,
      finding: "Legacy candidate predates allocation-bound admission evidence."
    }]
  });
}

function explicitAllocation(
  token: string,
  directions: Array<"trend_following" | "mean_reversion">
): CandidateArenaResearchAllocationRecord {
  const selected = directions.map((direction, index) => ({
    direction_kind: direction,
    selection_kind: "explicit" as const,
    priority: index + 1,
    experiment_budget: 1,
    signal_score: 0,
    reasons: ["Explicit test direction."]
  }));
  const selectedSet = new Set<string>(directions);
  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id: `allocation-${token}`,
    tick_id: `tick-${token}`,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: selected,
    deferred_directions: [
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ].filter((direction) => !selectedSet.has(direction)) as
      CandidateArenaResearchAllocationRecord["deferred_directions"],
    allocated_at: "2026-07-28T00:00:00.000Z",
    allocation_digest: `sha256:${"0".repeat(64)}`,
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  resealAllocation(allocation);
  return allocation;
}

function resealAllocation(
  allocation: CandidateArenaResearchAllocationRecord
): void {
  allocation.allocation_digest = `sha256:${createHash("sha256")
    .update(candidateArenaResearchAllocationDigestInput(allocation))
    .digest("hex")}`;
}

function allocationTick(
  allocation: CandidateArenaResearchAllocationRecord
): CandidateArenaTickRecord {
  return tickRecord(
    allocation.tick_id.replace(/^tick-/, ""),
    "2026-07-28T00:00:02.000Z",
    {
      direction_results: allocation.selected_directions.map((selection) => ({
        direction_kind: selection.direction_kind,
        status: "no_submission",
        finding: "No development submission was selected."
      })),
      research_allocation_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: allocation.candidate_arena_research_allocation_id
      },
      research_allocation_digest: allocation.allocation_digest
    }
  );
}

function stoppedRunnerHealth() {
  return {
    status: "stopped" as const,
    tick_count: 0,
    completed_tick_count: 0,
    active_tick: false,
    active_research_work_items: [],
    consecutive_failure_count: 0,
    runtime_coordination_authority: true as const,
    evaluation_authority: false as const,
    promotion_authority: false as const,
    order_submission_authority: false as const,
    live_exchange_authority: false as const,
    authority_status: "runtime_coordination_only" as const
  };
}

function projectionDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}

function resealIndex(index: ResearchOperationsProjectionIndexRecord): void {
  const { projection_digest: _digest, ...payload } = index;
  index.projection_digest = projectionDigest(payload);
}

function resealCapsule(capsule: ResearchOperationsProjectionCapsule): void {
  const { capsule_digest: _digest, ...payload } = capsule;
  capsule.capsule_digest = projectionDigest(payload);
}

function resealTrieNode(
  node: ResearchOperationsProjectionCapsuleTrieNode
): void {
  const { node_digest: _digest, ...payload } = node;
  node.node_digest = projectionDigest(payload);
}

function sessionMembership(ids: string[]):
  ResearchOperationsProjectionIndexRecord["session_membership"] {
  const bitCount = 32_768;
  const hashCount = 7;
  const bits = Buffer.alloc(bitCount / 8);
  for (const id of ids) {
    const hash = createHash("sha256").update(id).digest();
    for (let index = 0; index < hashCount; index += 1) {
      const position = hash.readUInt32BE(index * 4) % bitCount;
      bits[position >> 3] |= 1 << (position & 7);
    }
  }
  return {
    algorithm: "sha256_bloom_v1",
    bit_count: bitCount,
    hash_count: hashCount,
    encoded_bits: bits.toString("base64"),
    member_count: ids.length
  };
}

function emptyArenaStore(
  overrides: Partial<OuroborosStorePort> = {}
): OuroborosStorePort {
  return {
    root: () => "/tmp/candidate-arena-projection-test",
    listCandidates: async () => [],
    getCandidate: async () => undefined,
    listCandidateArenaResearchAllocations: async () => [],
    listCandidateArenaTicks: async () => [],
    listResearchDirections: async () => [],
    listResearchPreflightCommitments: async () => [],
    listResearchBehaviorFingerprints: async () => [],
    listCandidateAdmissionDecisions: async () => [],
    listResearchGeneralizationProtocols: async () => [],
    listResearchControlStudies: async () => [],
    listResearchControlStudyOutcomes: async () => [],
    listResearchGeneralizationOutcomes: async () => [],
    listResearchGeneralizationPolicyDecisions: async () => [],
    ...overrides
  } as unknown as OuroborosStorePort;
}

function emptyResearchProjectionStore(
  overrides: Partial<OuroborosStorePort> = {}
): OuroborosStorePort {
  return emptyArenaStore({
    listResearchWorkers: async () => [],
    listResearchEvidenceArtifacts: async () => [],
    listResearchWorkerCheckpoints: async () => [],
    listTradingEvaluationResults: async () => [],
    listExperimentRuns: async () => [],
    listPaperTradingHandoffConformances: async () => [],
    listResearchFindings: async () => [],
    listArtifactLineages: async () => [],
    listResearchAllocationPolicyDecisions: async () => [],
    listResearchMemoryControlStudies: async () => [],
    getSystemCode: async () => undefined,
    ...overrides
  });
}
