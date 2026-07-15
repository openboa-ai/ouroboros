import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
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

  it("persists a decision-backed allocation only against its exact approval", async () => {
    const decision = policyDecisionFixture();
    const decisionStore = new AllocationPolicyDecisionStore(storeRoot, decision);
    const allocation = allocationFixture();
    allocation.allocation_policy_basis = {
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: {
        record_kind: "research_allocation_policy_decision",
        id: decision.research_allocation_policy_decision_id
      },
      policy_decision_digest: decision.policy_decision_digest,
      study_outcome_ref: { ...decision.study_outcome_ref },
      study_outcome_digest: decision.study_outcome_digest
    };
    allocation.allocation_digest = allocationDigest(allocation);

    await expect(decisionStore.recordCandidateArenaResearchAllocation(
      allocation
    )).resolves.toEqual(allocation);
  });

  it("persists a broad-decision allocation only against its exact approval", async () => {
    const decision = generalizationPolicyDecisionFixture();
    const decisionStore = new AllocationPolicyDecisionStore(
      storeRoot,
      undefined,
      decision
    );
    const allocation = allocationFixture();
    allocation.allocation_policy_basis = {
      basis_kind: "research_generalization_policy_decision",
      policy_decision_ref: {
        record_kind: "research_generalization_policy_decision",
        id: decision.research_generalization_policy_decision_id
      },
      policy_decision_digest: decision.policy_decision_digest,
      generalization_outcome_ref: {
        ...decision.generalization_outcome_ref
      },
      generalization_outcome_digest:
        decision.generalization_outcome_digest
    };
    allocation.allocation_digest = allocationDigest(allocation);

    await expect(decisionStore.recordCandidateArenaResearchAllocation(
      allocation
    )).resolves.toEqual(allocation);
  });

  it.each([
    ["missing decision", () => undefined],
    ["decision digest drift", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      const changed = structuredClone(decision);
      changed.policy_decision_digest = `sha256:${"f".repeat(64)}`;
      return changed;
    }],
    ["not approved", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      const changed = structuredClone(decision);
      changed.decision_status = "not_approved";
      changed.decision_reason = "generalization_outcome_not_eligible";
      changed.effective_default_mode = null;
      changed.policy_decision_digest =
        generalizationPolicyDecisionDigest(changed);
      return changed;
    }],
    ["stale target policy", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      const changed = structuredClone(decision);
      changed.target_allocation_policy_digest = `sha256:${"e".repeat(64)}`;
      changed.policy_decision_digest =
        generalizationPolicyDecisionDigest(changed);
      return changed;
    }],
    ["wrong outcome", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      const changed = structuredClone(decision);
      changed.generalization_outcome_ref.id = "other-outcome";
      changed.policy_decision_digest =
        generalizationPolicyDecisionDigest(changed);
      return changed;
    }],
    ["future decision", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      const changed = structuredClone(decision);
      changed.decided_at = "2026-07-12T10:00:01.000Z";
      changed.policy_decision_digest =
        generalizationPolicyDecisionDigest(changed);
      return changed;
    }]
  ])("rejects a broad-decision allocation with %s", async (
    _label,
    mutate
  ) => {
    const sourceDecision = generalizationPolicyDecisionFixture();
    const storedDecision = mutate(sourceDecision);
    const decisionStore = new AllocationPolicyDecisionStore(
      storeRoot,
      undefined,
      storedDecision
    );
    const allocation = allocationFixture();
    allocation.allocation_policy_basis = {
      basis_kind: "research_generalization_policy_decision",
      policy_decision_ref: {
        record_kind: "research_generalization_policy_decision",
        id: sourceDecision.research_generalization_policy_decision_id
      },
      policy_decision_digest: sourceDecision.policy_decision_digest,
      generalization_outcome_ref: {
        ...sourceDecision.generalization_outcome_ref
      },
      generalization_outcome_digest:
        sourceDecision.generalization_outcome_digest
    };
    allocation.allocation_digest = allocationDigest(allocation);

    await expect(decisionStore.recordCandidateArenaResearchAllocation(
      allocation
    )).rejects.toMatchObject({
      code: storedDecision === undefined
        ? "candidate_arena_research_allocation_policy_decision_not_found"
        : "candidate_arena_research_allocation_policy_decision_mismatch"
    });
  });

  it.each([
    ["missing decision", (decision: ResearchAllocationPolicyDecisionRecord) =>
      undefined],
    ["decision digest drift", (decision: ResearchAllocationPolicyDecisionRecord) => {
      const changed = structuredClone(decision);
      changed.policy_decision_digest = `sha256:${"f".repeat(64)}`;
      return changed;
    }],
    ["not approved", (decision: ResearchAllocationPolicyDecisionRecord) => {
      const changed = structuredClone(decision);
      changed.decision_status = "not_approved";
      changed.decision_reason = "study_outcome_not_eligible";
      changed.effective_default_mode = null;
      changed.policy_decision_digest = policyDecisionDigest(changed);
      return changed;
    }],
    ["stale target policy", (decision: ResearchAllocationPolicyDecisionRecord) => {
      const changed = structuredClone(decision);
      changed.target_allocation_policy_digest = `sha256:${"e".repeat(64)}`;
      changed.policy_decision_digest = policyDecisionDigest(changed);
      return changed;
    }],
    ["future decision", (decision: ResearchAllocationPolicyDecisionRecord) => {
      const changed = structuredClone(decision);
      changed.decided_at = "2026-07-12T10:00:01.000Z";
      changed.policy_decision_digest = policyDecisionDigest(changed);
      return changed;
    }]
  ])("rejects a decision-backed allocation with %s", async (_label, mutate) => {
    const sourceDecision = policyDecisionFixture();
    const storedDecision = mutate(sourceDecision);
    const decisionStore = new AllocationPolicyDecisionStore(
      storeRoot,
      storedDecision
    );
    const allocation = allocationFixture();
    allocation.allocation_policy_basis = {
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: {
        record_kind: "research_allocation_policy_decision",
        id: sourceDecision.research_allocation_policy_decision_id
      },
      policy_decision_digest: sourceDecision.policy_decision_digest,
      study_outcome_ref: { ...sourceDecision.study_outcome_ref },
      study_outcome_digest: sourceDecision.study_outcome_digest
    };
    allocation.allocation_digest = allocationDigest(allocation);

    await expect(decisionStore.recordCandidateArenaResearchAllocation(
      allocation
    )).rejects.toMatchObject({
      code: storedDecision === undefined
        ? "candidate_arena_research_allocation_policy_decision_not_found"
        : "candidate_arena_research_allocation_policy_decision_mismatch"
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
    ["error", "unexpected failure"],
    ["net revenue", 12.5],
    ["paper handoff conformance", {
      conformance_id: "paper-handoff-conformance-no-submission",
      status: "passed",
      reason: "passed",
      authority_status: "research_only"
    }]
  ])("rejects no-submission results carrying contradictory %s evidence", async (
    _label,
    contradictoryValue
  ) => {
    const allocation = allocationFixture();
    await store.recordCandidateArenaResearchAllocation(allocation);
    const tick = tickFixture(allocation);
    const result = tick.direction_results[0] as any;
    result.status = "no_submission";
    result.finding = "ResearchWorker finished without selecting a submission.";
    delete result.error;
    if (_label === "error") result.error = contradictoryValue;
    if (_label === "net revenue") result.net_revenue_usdt = contradictoryValue;
    if (_label === "paper handoff conformance") {
      result.paper_handoff_conformance = contradictoryValue;
    }

    await expect(store.recordCandidateArenaTick(tick)).rejects.toMatchObject({
      code: "invalid_candidate_arena_tick_input"
    });
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
    allocation_policy_basis: { basis_kind: "repository_default" },
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

class AllocationPolicyDecisionStore extends LocalStore {
  constructor(
    root: string,
    private readonly decision?: ResearchAllocationPolicyDecisionRecord,
    private readonly generalizationDecision?:
      ResearchGeneralizationPolicyDecisionRecord
  ) {
    super(root);
  }

  override async getResearchAllocationPolicyDecision(
    decisionId: string
  ): Promise<ResearchAllocationPolicyDecisionRecord | undefined> {
    return this.decision?.research_allocation_policy_decision_id === decisionId
      ? structuredClone(this.decision)
      : undefined;
  }

  override async getResearchGeneralizationPolicyDecision(
    decisionId: string
  ): Promise<ResearchGeneralizationPolicyDecisionRecord | undefined> {
    return this.generalizationDecision
      ?.research_generalization_policy_decision_id === decisionId
      ? structuredClone(this.generalizationDecision)
      : undefined;
  }
}

function policyDecisionFixture(): ResearchAllocationPolicyDecisionRecord {
  const decision: ResearchAllocationPolicyDecisionRecord = {
    record_kind: "research_allocation_policy_decision",
    version: 1,
    research_allocation_policy_decision_id:
      "research-allocation-policy-decision-study-outcome",
    study_ref: {
      record_kind: "research_control_study",
      id: "research-control-study-allocation"
    },
    study_digest: `sha256:${"a".repeat(64)}`,
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: "research-control-study-outcome-allocation"
    },
    study_outcome_digest: `sha256:${"b".repeat(64)}`,
    target_allocation_policy_digest: exactDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      )
    ),
    decision_policy: {
      policy_version: "adaptive_supported_effect_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "adaptive_effect_supported",
      required_causal_scope: "same_baseline_stochastic_replication_only",
      required_policy_decision_eligibility:
        "eligible_for_separate_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: "approved",
    decision_reason: "supported_same_baseline_adaptive_effect",
    effective_default_mode: "adaptive_default",
    decided_at: "2026-07-12T09:59:59.999Z",
    policy_decision_digest: "pending",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  decision.policy_decision_digest = policyDecisionDigest(decision);
  return decision;
}

function policyDecisionDigest(
  decision: ResearchAllocationPolicyDecisionRecord
): string {
  return exactDigest(researchAllocationPolicyDecisionDigestInput(decision));
}

function generalizationPolicyDecisionFixture():
ResearchGeneralizationPolicyDecisionRecord {
  const decision: ResearchGeneralizationPolicyDecisionRecord = {
    record_kind: "research_generalization_policy_decision",
    version: 1,
    research_generalization_policy_decision_id:
      "research-generalization-policy-decision-outcome",
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: "research-generalization-protocol-allocation"
    },
    protocol_digest: `sha256:${"c".repeat(64)}`,
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: "research-generalization-outcome-allocation"
    },
    generalization_outcome_digest: `sha256:${"d".repeat(64)}`,
    target_allocation_policy_digest: exactDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      )
    ),
    decision_policy: {
      policy_version: "generalization_supported_adaptive_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "generalization_supported",
      required_causal_scope:
        "pre_effect_market_condition_blocked_cross_baseline_study_effects",
      required_policy_decision_eligibility:
        "eligible_for_separate_generalization_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: "approved",
    decision_reason: "supported_cross_condition_adaptive_effect",
    effective_default_mode: "adaptive_default",
    decided_at: "2026-07-12T09:59:59.999Z",
    policy_decision_digest: "pending",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  decision.policy_decision_digest =
    generalizationPolicyDecisionDigest(decision);
  return decision;
}

function generalizationPolicyDecisionDigest(
  decision: ResearchGeneralizationPolicyDecisionRecord
): string {
  return exactDigest(
    researchGeneralizationPolicyDecisionDigestInput(decision)
  );
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
