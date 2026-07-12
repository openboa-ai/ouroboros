import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchDirectionKind
} from "@ouroboros/domain";
import { LocalStore } from "../src/index";

describe("LocalStore CandidateArenaResearchAllocation", () => {
  let storeRoot: string;
  let store: LocalStore;

  beforeEach(async () => {
    storeRoot = await mkdtemp(path.join(os.tmpdir(), "ouroboros-allocation-"));
    store = new LocalStore(storeRoot);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(storeRoot, { recursive: true, force: true });
  });

  it("persists, replays, lists, and reloads append-only allocation intent", async () => {
    const first = allocationFixture("tick-1", "2026-07-12T10:00:00.000Z");
    const second = allocationFixture("tick-2", "2026-07-12T11:00:00.000Z");

    await expect(store.recordCandidateArenaResearchAllocation(first))
      .resolves.toEqual(first);
    await expect(store.recordCandidateArenaResearchAllocation(first))
      .resolves.toEqual(first);
    await expect(store.recordCandidateArenaResearchAllocation(second))
      .resolves.toEqual(second);
    await expect(store.getCandidateArenaResearchAllocation(
      first.candidate_arena_research_allocation_id
    )).resolves.toEqual(first);
    await expect(store.listCandidateArenaResearchAllocations())
      .resolves.toEqual([second, first]);

    const restarted = new LocalStore(storeRoot);
    await restarted.initialize();
    await expect(restarted.getCandidateArenaResearchAllocation(
      first.candidate_arena_research_allocation_id
    )).resolves.toEqual(first);
    await expect(restarted.listCandidateArenaResearchAllocations())
      .resolves.toEqual([second, first]);
  });

  it("rejects malformed, digest-drifted, and same-ID-mutated allocations", async () => {
    const allocation = allocationFixture();
    const malformed = structuredClone(allocation) as any;
    malformed.promotion_authority = true;
    await expect(store.recordCandidateArenaResearchAllocation(malformed))
      .rejects.toMatchObject({
        code: "invalid_candidate_arena_research_allocation_input"
      });

    const digestDrift = structuredClone(allocation);
    digestDrift.allocation_digest = "sha256:drift";
    await expect(store.recordCandidateArenaResearchAllocation(digestDrift))
      .rejects.toMatchObject({
        code: "candidate_arena_research_allocation_digest_mismatch"
      });

    await store.recordCandidateArenaResearchAllocation(allocation);
    const mutated = structuredClone(allocation);
    mutated.allocated_at = "2026-07-12T10:01:00.000Z";
    mutated.allocation_digest = allocationDigest(mutated);
    await expect(store.recordCandidateArenaResearchAllocation(mutated))
      .rejects.toMatchObject({
        code: "candidate_arena_research_allocation_conflict"
      });
  });

  it("accepts a completed tick whose failed results exactly match allocation order", async () => {
    const allocation = allocationFixture();
    await store.recordCandidateArenaResearchAllocation(allocation);
    const tick = tickFixture(allocation);

    await expect(store.recordCandidateArenaTick(tick)).resolves.toEqual(tick);
    await expect(store.listCandidateArenaTicks()).resolves.toEqual([tick]);
  });

  it.each([
    ["missing allocation", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      _tick: BoundCandidateArenaTickRecord
    ) => {}],
    ["allocation ref drift", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => { tick.research_allocation_ref.id = "missing-allocation"; }],
    ["allocation digest drift", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => { tick.research_allocation_digest = "sha256:drift"; }],
    ["allocation tick mismatch", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => { tick.tick_id = "different-tick"; }],
    ["omitted selected direction", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => { tick.direction_results.pop(); }],
    ["extra selected direction", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => {
      tick.direction_results.push({
        direction_kind: "funding_aware_risk",
        status: "failed",
        error: "funding_aware_risk failed"
      });
    }],
    ["selected direction order drift", async (
      _allocation: CandidateArenaResearchAllocationRecord,
      tick: BoundCandidateArenaTickRecord
    ) => { tick.direction_results.reverse(); }]
  ])("rejects tick graph with %s", async (label, mutate) => {
    const allocation = allocationFixture();
    if (label !== "missing allocation") {
      await store.recordCandidateArenaResearchAllocation(allocation);
    }
    const tick = tickFixture(allocation);
    await mutate(allocation, tick);

    await expect(store.recordCandidateArenaTick(tick)).rejects.toMatchObject({
      code: label === "missing allocation" || label === "allocation ref drift"
        ? "candidate_arena_research_allocation_reference_not_found"
        : "candidate_arena_research_allocation_tick_graph_mismatch"
    });
  });
});

type BoundCandidateArenaTickRecord = CandidateArenaTickRecord & {
  research_allocation_ref: { record_kind: string; id: string };
  research_allocation_digest: string;
};

function allocationFixture(
  tickId = "tick-1",
  allocatedAt = "2026-07-12T10:00:00.000Z"
): CandidateArenaResearchAllocationRecord {
  const directions: ResearchDirectionKind[] = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ];
  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id:
      `candidate-arena-research-allocation-${tickId}`,
    tick_id: tickId,
    allocation_mode: "adaptive_default",
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: directions.map((direction) => ({
      direction_kind: direction,
      finding_pressure_score: 0,
      research_efficiency_score: 0,
      recent_outcome_score: 0,
      focus_score: 0,
      completed_selection_count: 0,
      source_candidate_ids: [],
      source_tick_ids: [],
      reasons: []
    })),
    selected_directions: directions.slice(0, 3).map((direction, index) => ({
      direction_kind: direction,
      selection_kind: "exploration",
      priority: index + 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["exploration_floor"]
    })),
    deferred_directions: directions.slice(3),
    allocated_at: allocatedAt,
    allocation_digest: "pending",
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = allocationDigest(allocation);
  return allocation;
}

function tickFixture(
  allocation: CandidateArenaResearchAllocationRecord
): BoundCandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${allocation.tick_id}`,
    tick_id: allocation.tick_id,
    started_at: allocation.allocated_at,
    completed_at: "2026-07-12T10:02:00.000Z",
    status: "failed",
    created_candidate_refs: [],
    direction_results: allocation.selected_directions.map((selection) => ({
      direction_kind: selection.direction_kind,
      status: "failed",
      error: `${selection.direction_kind} failed`
    })),
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
}

function allocationDigest(
  allocation: CandidateArenaResearchAllocationRecord
): string {
  return "sha256:" + createHash("sha256")
    .update(candidateArenaResearchAllocationDigestInput(allocation))
    .digest("hex");
}
