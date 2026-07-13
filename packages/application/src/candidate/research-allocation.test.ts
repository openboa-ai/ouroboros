import { createHash } from "node:crypto";
import type {
  CandidateArenaFindingClusterReadModel,
  CandidateArenaResearchAllocationPolicyBasis,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaTickDirectionResultReadModel,
  CandidateArenaTickReadModel,
  ResearchAllocationPolicyDecisionRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchDirectionKind
} from "@ouroboros/domain";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionDigestInput
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../ports/store";
import {
  CandidateArenaResearchAllocationDecisionError,
  CandidateArenaResearchAllocationService,
  DEFAULT_ARENA_DIRECTIONS,
  decideCandidateArenaResearchAllocation,
  resolveCandidateArenaResearchAllocationPolicy,
  selectEffectiveResearchGeneralizationPolicyDecision
} from "./research-allocation";

describe("decideCandidateArenaResearchAllocation", () => {
  it("fills a no-signal default allocation entirely through exploration", () => {
    const allocation = decide({ tickId: "tick-1" });

    expect(allocation.selected_directions).toEqual([
      explorationSelection("trend_following", 1),
      explorationSelection("mean_reversion", 2),
      explorationSelection("volatility_regime", 3)
    ]);
    expect(allocation.deferred_directions).toEqual([
      "funding_aware_risk",
      "execution_cost_robustness"
    ]);
    expect(allocation.signal_snapshot.map((signal) => ({
      direction_kind: signal.direction_kind,
      focus_score: signal.focus_score,
      completed_selection_count: signal.completed_selection_count
    }))).toEqual(DEFAULT_ARENA_DIRECTIONS.map((direction) => ({
      direction_kind: direction,
      focus_score: 0,
      completed_selection_count: 0
    })));
  });

  it("uses only completed allocation history to cover never-run directions", () => {
    const first = decide({ tickId: "tick-1" });
    const second = decide({
      tickId: "tick-2",
      priorAllocations: [first],
      completedTickIds: ["tick-1"]
    });

    expect(second.selected_directions.map((selection) =>
      selection.direction_kind
    )).toEqual([
      "funding_aware_risk",
      "execution_cost_robustness",
      "trend_following"
    ]);
    expect(second.selected_directions.every((selection) =>
      selection.selection_kind === "exploration"
    )).toBe(true);
  });

  it("does not consume exploration coverage from an orphan allocation", () => {
    const orphan = decide({ tickId: "orphan-tick" });
    const next = decide({
      tickId: "tick-2",
      priorAllocations: [orphan],
      completedTickIds: []
    });

    expect(next.selected_directions.map((selection) =>
      selection.direction_kind
    )).toEqual([
      "trend_following",
      "mean_reversion",
      "volatility_regime"
    ]);
  });

  it("focuses execution robustness from public-execution failure pressure", () => {
    const allocation = decide({
      tickId: "tick-2",
      findingClusters: [publicExecutionFailureCluster()]
    });

    expect(allocation.selected_directions[0]).toEqual({
      direction_kind: "execution_cost_robustness",
      selection_kind: "focus",
      priority: 1,
      experiment_budget: 2,
      signal_score: 37,
      reasons: [
        "public_execution_evidence_gap:observation_quality:paper_evaluation_failed"
      ]
    });
    expect(allocation.selected_directions.slice(1).every((selection) =>
      selection.selection_kind === "exploration"
    )).toBe(true);
  });

  it("focuses a low-cost lane without removing an expensive lane from exploration", () => {
    const allocation = decide({
      tickId: "tick-2",
      latestTicks: [efficiencyTick()]
    });

    expect(allocation.selected_directions[0]).toEqual({
      direction_kind: "mean_reversion",
      selection_kind: "focus",
      priority: 1,
      experiment_budget: 2,
      signal_score: 21,
      reasons: ["research_efficiency_budget:low_cost_latency"]
    });
    expect(allocation.selected_directions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: "trend_following",
        selection_kind: "exploration"
      })
    ]));
  });

  it("applies stable recent duplicate, quarantine, no-submission, and failure adjustments", () => {
    const allocation = decide({
      tickId: "tick-2",
      latestTicks: [tickWithResults([
        directionResult("trend_following", "duplicate"),
        directionResult("mean_reversion", "quarantined"),
        directionResult("volatility_regime", "failed"),
        directionResult("funding_aware_risk", "no_submission")
      ])]
    });
    const scores = Object.fromEntries(allocation.signal_snapshot.map((signal) => [
      signal.direction_kind,
      signal.recent_outcome_score
    ]));

    expect(scores).toMatchObject({
      trend_following: -15,
      mean_reversion: -30,
      volatility_regime: -10,
      funding_aware_risk: -5
    });
  });

  it("caps positive pressure at two focus lanes and preserves exploration", () => {
    const allocation = decide({
      tickId: "tick-2",
      findingClusters: DEFAULT_ARENA_DIRECTIONS.map((direction, index) => ({
        direction_kind: direction,
        market_regime: "unknown" as const,
        candidate_count: 5 - index,
        candidate_ids: [`candidate-${index + 1}`],
        next_research_focus: `Research ${direction}.`,
        authority_status: "not_promotion_authority" as const
      }))
    });

    expect(allocation.selected_directions.map((selection) =>
      selection.selection_kind
    )).toEqual(["focus", "focus", "exploration"]);
    expect(allocation.selected_directions.reduce(
      (total, selection) => total + selection.experiment_budget,
      0
    )).toBe(5);
    expect(allocation.policy.concurrency_limit).toBe(2);
  });

  it("provides an equal-bound static control that ignores evidence", () => {
    const allocation = decide({
      tickId: "tick-2",
      allocationMode: "static_control",
      findingClusters: [publicExecutionFailureCluster()]
    });

    expect(allocation.selected_directions).toEqual([
      staticSelection("trend_following", 1, 2),
      staticSelection("mean_reversion", 2, 2),
      staticSelection("volatility_regime", 3, 1)
    ]);
    expect(allocation.selected_directions.reduce(
      (total, selection) => total + selection.experiment_budget,
      0
    )).toBe(5);
    expect(allocation.policy.concurrency_limit).toBe(2);
  });

  it("seals the exact policy-selection basis into the allocation", () => {
    const allocationPolicyBasis = approvedPolicyBasis();
    const allocation = decide({
      tickId: "policy-backed-tick",
      allocationPolicyBasis
    });

    expect(allocation.allocation_policy_basis).toEqual(allocationPolicyBasis);
    expect(allocation.allocation_policy_basis).not.toBe(allocationPolicyBasis);
  });

  it.each([
    ["static repository default", "static_control", {
      basis_kind: "repository_default"
    }],
    ["explicit policy decision", "explicit", approvedPolicyBasis()]
  ])("rejects incompatible %s basis", (_label, allocationMode, basis) => {
    expect(() => decide({
      tickId: "incompatible-basis",
      allocationMode: allocationMode as "static_control" | "explicit",
      allocationPolicyBasis: basis as CandidateArenaResearchAllocationPolicyBasis,
      explicitDirections: allocationMode === "explicit"
        ? ["trend_following"]
        : undefined
    })).toThrowError(CandidateArenaResearchAllocationDecisionError);
  });

  it("proves an equal-bound adaptive versus static selection ablation", () => {
    const adaptive = decide({
      tickId: "adaptive-tick",
      findingClusters: [publicExecutionFailureCluster()],
      latestTicks: [efficiencyTick()]
    });
    const control = decide({
      tickId: "control-tick",
      allocationMode: "static_control",
      findingClusters: [publicExecutionFailureCluster()],
      latestTicks: [efficiencyTick()]
    });
    const totalBudget = (allocation: CandidateArenaResearchAllocationRecord) =>
      allocation.selected_directions.reduce(
        (total, selection) => total + selection.experiment_budget,
        0
      );

    expect(adaptive.selected_directions).toHaveLength(3);
    expect(control.selected_directions).toHaveLength(3);
    expect(adaptive.policy.concurrency_limit).toBe(2);
    expect(control.policy.concurrency_limit).toBe(2);
    expect(totalBudget(adaptive)).toBe(5);
    expect(totalBudget(control)).toBe(5);
    expect(adaptive.selected_directions.map((selection) =>
      selection.direction_kind
    )).toContain("execution_cost_robustness");
    expect(control.selected_directions.map((selection) =>
      selection.direction_kind
    )).toEqual([
      "trend_following",
      "mean_reversion",
      "volatility_regime"
    ]);
  });

  it("preserves an exploration floor and covers every direction under persistent focus", () => {
    const priorAllocations: CandidateArenaResearchAllocationRecord[] = [];
    const completedTickIds: string[] = [];
    const selected = new Set<ResearchDirectionKind>();

    for (let index = 1; index <= 3; index += 1) {
      const allocation = decide({
        tickId: `focused-tick-${index}`,
        findingClusters: [publicExecutionFailureCluster()],
        priorAllocations,
        completedTickIds
      });
      expect(allocation.selected_directions.filter((selection) =>
        selection.selection_kind === "exploration"
      ).length).toBeGreaterThanOrEqual(1);
      allocation.selected_directions.forEach((selection) =>
        selected.add(selection.direction_kind)
      );
      priorAllocations.push(allocation);
      completedTickIds.push(allocation.tick_id);
    }

    expect(selected).toEqual(new Set(DEFAULT_ARENA_DIRECTIONS));
  });

  it("preserves bounded explicit direction order", () => {
    const allocation = decide({
      tickId: "tick-explicit",
      allocationMode: "explicit",
      explicitDirections: ["other", "mean_reversion"]
    });

    expect(allocation.signal_snapshot).toEqual([]);
    expect(allocation.source_tick_refs).toEqual([]);
    expect(allocation.selected_directions).toEqual([
      explicitSelection("other", 1),
      explicitSelection("mean_reversion", 2)
    ]);
  });

  it.each([
    ["empty", []],
    ["duplicate", ["trend_following", "trend_following"]],
    ["oversized", [
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "liquidation_aware_risk",
      "execution_cost_robustness"
    ]]
  ])("rejects %s explicit directions", (_label, directions) => {
    expect(() => decide({
      tickId: "tick-explicit",
      allocationMode: "explicit",
      explicitDirections: directions as ResearchDirectionKind[]
    })).toThrowError(CandidateArenaResearchAllocationDecisionError);
  });

  it("does not mutate decision inputs", () => {
    const findingClusters = [publicExecutionFailureCluster()];
    const latestTicks = [efficiencyTick()];
    const priorAllocations = [decide({ tickId: "tick-1" })];
    const snapshot = structuredClone({
      findingClusters,
      latestTicks,
      priorAllocations
    });

    decide({
      tickId: "tick-2",
      findingClusters,
      latestTicks,
      priorAllocations,
      completedTickIds: ["tick-1"]
    });

    expect({ findingClusters, latestTicks, priorAllocations }).toEqual(snapshot);
  });

  it("selects the applicable broad approval independently of latest history", () => {
    const approved = generalizationPolicyDecisionFixture(
      "approved",
      "2026-07-12T08:00:00.000Z"
    );
    const newerNegative = generalizationPolicyDecisionFixture(
      "newer-negative",
      "2026-07-12T10:00:00.000Z"
    );
    newerNegative.decision_status = "not_approved";
    newerNegative.decision_reason = "generalization_outcome_not_eligible";
    newerNegative.effective_default_mode = null;
    resealGeneralizationPolicyDecision(newerNegative);

    expect(selectEffectiveResearchGeneralizationPolicyDecision([
      newerNegative,
      approved
    ])).toEqual(approved);
  });

  it("filters invalid broad decisions and resolves equal-time order", () => {
    const alpha = generalizationPolicyDecisionFixture(
      "alpha",
      "2026-07-12T09:00:00.000Z"
    );
    const zeta = generalizationPolicyDecisionFixture(
      "zeta",
      "2026-07-12T09:00:00.000Z"
    );
    const wrongPolicy = generalizationPolicyDecisionFixture(
      "wrong-policy",
      "2026-07-12T10:00:00.000Z"
    );
    wrongPolicy.target_allocation_policy_digest = `sha256:${"e".repeat(64)}`;
    resealGeneralizationPolicyDecision(wrongPolicy);

    expect(selectEffectiveResearchGeneralizationPolicyDecision([
      alpha,
      wrongPolicy,
      { record_kind: "research_generalization_policy_decision" } as
        ResearchGeneralizationPolicyDecisionRecord,
      zeta
    ])).toEqual(zeta);
  });

  it("returns no effective broad decision when every outcome is not approved", () => {
    const negative = generalizationPolicyDecisionFixture(
      "negative",
      "2026-07-12T09:00:00.000Z"
    );
    negative.decision_status = "not_approved";
    negative.decision_reason = "generalization_outcome_not_eligible";
    negative.effective_default_mode = null;
    resealGeneralizationPolicyDecision(negative);

    expect(selectEffectiveResearchGeneralizationPolicyDecision([negative]))
      .toBeUndefined();
  });

  it.each([
    ["directions", ["trend_following"], undefined, "explicit"],
    ["static mode", undefined, "static_control", "static_control"],
    ["adaptive mode", undefined, "adaptive_default", "adaptive_default"]
  ])("gives explicit %s precedence without reading policy decisions", async (
    _label,
    explicitDirections,
    requestedAllocationMode,
    expectedMode
  ) => {
    const calls: string[] = [];
    const resolved = await resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([], calls),
      explicitDirections: explicitDirections as ResearchDirectionKind[] | undefined,
      requestedAllocationMode: requestedAllocationMode as
        "static_control" | "adaptive_default" | undefined
    });

    expect(resolved).toEqual({
      allocationMode: expectedMode,
      allocationPolicyBasis: { basis_kind: "explicit_request" }
    });
    expect(calls).toEqual([]);
  });

  it("resolves an uncontrolled tick from the latest applicable approval", async () => {
    const earlier = policyDecisionFixture(
      "earlier",
      "2026-07-12T08:00:00.000Z"
    );
    const latest = policyDecisionFixture(
      "latest",
      "2026-07-12T09:00:00.000Z"
    );

    await expect(resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([latest, earlier])
    })).resolves.toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: {
        basis_kind: "research_allocation_policy_decision",
        policy_decision_ref: {
          record_kind: "research_allocation_policy_decision",
          id: latest.research_allocation_policy_decision_id
        },
        policy_decision_digest: latest.policy_decision_digest,
        study_outcome_ref: { ...latest.study_outcome_ref },
        study_outcome_digest: latest.study_outcome_digest
      }
    });
  });

  it("prefers a broad generalization approval over a later same-baseline approval", async () => {
    const sameBaseline = policyDecisionFixture(
      "same-baseline",
      "2026-07-12T10:00:00.000Z"
    );
    const broad = generalizationPolicyDecisionFixture(
      "broad",
      "2026-07-12T09:00:00.000Z"
    );

    await expect(resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([sameBaseline], [], [broad])
    })).resolves.toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: {
        basis_kind: "research_generalization_policy_decision",
        policy_decision_ref: {
          record_kind: "research_generalization_policy_decision",
          id: broad.research_generalization_policy_decision_id
        },
        policy_decision_digest: broad.policy_decision_digest,
        generalization_outcome_ref: {
          ...broad.generalization_outcome_ref
        },
        generalization_outcome_digest:
          broad.generalization_outcome_digest
      }
    });
  });

  it("selects the deterministically latest applicable broad approval", async () => {
    const alpha = generalizationPolicyDecisionFixture(
      "alpha",
      "2026-07-12T09:00:00.000Z"
    );
    const zeta = generalizationPolicyDecisionFixture(
      "zeta",
      "2026-07-12T09:00:00.000Z"
    );

    const resolved = await resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([], [], [zeta, alpha])
    });

    expect(resolved.allocationPolicyBasis).toMatchObject({
      basis_kind: "research_generalization_policy_decision",
      policy_decision_ref: {
        id: zeta.research_generalization_policy_decision_id
      }
    });
  });

  it("ignores invalid broad evidence and preserves same-baseline fallback", async () => {
    const fallback = policyDecisionFixture(
      "fallback",
      "2026-07-12T08:00:00.000Z"
    );
    const notApproved = generalizationPolicyDecisionFixture(
      "not-approved",
      "2026-07-12T09:00:00.000Z"
    );
    notApproved.decision_status = "not_approved";
    notApproved.decision_reason = "generalization_outcome_not_eligible";
    notApproved.effective_default_mode = null;
    resealGeneralizationPolicyDecision(notApproved);
    const wrongPolicy = generalizationPolicyDecisionFixture(
      "wrong-policy",
      "2026-07-12T10:00:00.000Z"
    );
    wrongPolicy.target_allocation_policy_digest = `sha256:${"e".repeat(64)}`;
    resealGeneralizationPolicyDecision(wrongPolicy);

    const resolved = await resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([fallback], [], [
        notApproved,
        wrongPolicy,
        { record_kind: "research_generalization_policy_decision" } as
          ResearchGeneralizationPolicyDecisionRecord
      ])
    });

    expect(resolved.allocationPolicyBasis).toMatchObject({
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: {
        id: fallback.research_allocation_policy_decision_id
      }
    });
  });

  it("falls back without treating unsupported or stale evidence as static", async () => {
    const unsupported = policyDecisionFixture(
      "unsupported",
      "2026-07-12T09:00:00.000Z"
    );
    unsupported.decision_status = "not_approved";
    unsupported.decision_reason = "study_outcome_not_eligible";
    unsupported.effective_default_mode = null;
    resealPolicyDecision(unsupported);
    const stale = policyDecisionFixture(
      "stale",
      "2026-07-12T10:00:00.000Z"
    );
    stale.target_allocation_policy_digest = `sha256:${"e".repeat(64)}`;
    resealPolicyDecision(stale);

    await expect(resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([
        unsupported,
        stale,
        { record_kind: "research_allocation_policy_decision" } as
          ResearchAllocationPolicyDecisionRecord
      ])
    })).resolves.toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: { basis_kind: "repository_default" }
    });
  });

  it("does not let a later inapplicable decision shadow an earlier approval", async () => {
    const approved = policyDecisionFixture(
      "approved",
      "2026-07-12T08:00:00.000Z"
    );
    const laterStale = policyDecisionFixture(
      "later-stale",
      "2026-07-12T10:00:00.000Z"
    );
    laterStale.target_allocation_policy_digest = `sha256:${"d".repeat(64)}`;
    resealPolicyDecision(laterStale);

    const resolved = await resolveCandidateArenaResearchAllocationPolicy({
      store: policyDecisionStore([approved, laterStale])
    });

    expect(resolved.allocationPolicyBasis).toMatchObject({
      basis_kind: "research_allocation_policy_decision",
      policy_decision_ref: {
        id: approved.research_allocation_policy_decision_id
      }
    });
  });

  it("persists through only the research-allocation Store surface", async () => {
    const calls: string[] = [];
    let recorded: CandidateArenaResearchAllocationRecord | undefined;
    const forbidden = [
      "materializeCandidate",
      "recordPaperTradingEvaluation",
      "recordPaperTradingObservation",
      "recordTradingPromotion",
      "recordLedger",
      "startComparisonSide",
      "submitOrder",
      "readPrivateAccount"
    ];
    const store = {
      async getCandidateArenaResearchAllocation() {
        calls.push("getCandidateArenaResearchAllocation");
        return recorded;
      },
      async listCandidateArenaResearchAllocations() {
        calls.push("listCandidateArenaResearchAllocations");
        return recorded ? [recorded] : [];
      },
      async listCandidateArenaTicks() {
        calls.push("listCandidateArenaTicks");
        return [];
      },
      async recordCandidateArenaResearchAllocation(
        allocation: CandidateArenaResearchAllocationRecord
      ) {
        calls.push("recordCandidateArenaResearchAllocation");
        recorded = structuredClone(allocation);
        return structuredClone(allocation);
      },
      ...Object.fromEntries(forbidden.map((method) => [method, async () => {
        calls.push(method);
        throw new Error(`${method} must not be called`);
      }]))
    } as unknown as OuroborosStorePort;
    const service = new CandidateArenaResearchAllocationService({
      store,
      now: () => "2026-07-12T10:00:00.000Z"
    });

    const allocation = await service.allocate({
      tickId: "service-tick",
      allocationMode: "adaptive_default",
      allocationPolicyBasis: { basis_kind: "repository_default" },
      findingClusters: [publicExecutionFailureCluster()],
      latestTicks: []
    });

    expect(calls).toEqual([
      "getCandidateArenaResearchAllocation",
      "listCandidateArenaResearchAllocations",
      "listCandidateArenaTicks",
      "recordCandidateArenaResearchAllocation"
    ]);
    expect(calls).not.toEqual(expect.arrayContaining(forbidden));
    expect(allocation).toMatchObject({
      allocation_policy_basis: { basis_kind: "repository_default" },
      research_scheduling_authority: true,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    });
  });
});

function decide(input: {
  tickId: string;
  allocationMode?: "adaptive_default" | "static_control" | "explicit";
  allocationPolicyBasis?: CandidateArenaResearchAllocationPolicyBasis;
  explicitDirections?: ResearchDirectionKind[];
  findingClusters?: CandidateArenaFindingClusterReadModel[];
  latestTicks?: CandidateArenaTickReadModel[];
  priorAllocations?: CandidateArenaResearchAllocationRecord[];
  completedTickIds?: string[];
}): CandidateArenaResearchAllocationRecord {
  return decideCandidateArenaResearchAllocation({
    tickId: input.tickId,
    allocatedAt: "2026-07-12T10:00:00.000Z",
    allocationMode: input.allocationMode ?? "adaptive_default",
    allocationPolicyBasis: input.allocationPolicyBasis ?? (
      input.allocationMode === "static_control" ||
      input.allocationMode === "explicit"
        ? { basis_kind: "explicit_request" }
        : { basis_kind: "repository_default" }
    ),
    explicitDirections: input.explicitDirections,
    findingClusters: input.findingClusters ?? [],
    latestTicks: input.latestTicks ?? [],
    priorAllocations: input.priorAllocations ?? [],
    completedTickIds: input.completedTickIds ?? []
  });
}

function approvedPolicyBasis(): CandidateArenaResearchAllocationPolicyBasis {
  return {
    basis_kind: "research_allocation_policy_decision",
    policy_decision_ref: {
      record_kind: "research_allocation_policy_decision",
      id: "research-allocation-policy-decision-study-outcome"
    },
    policy_decision_digest: `sha256:${"a".repeat(64)}`,
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: "research-control-study-outcome-study"
    },
    study_outcome_digest: `sha256:${"b".repeat(64)}`
  };
}

function policyDecisionStore(
  decisions: ResearchAllocationPolicyDecisionRecord[],
  calls: string[] = [],
  generalizationDecisions: ResearchGeneralizationPolicyDecisionRecord[] = []
): OuroborosStorePort {
  return {
    async listResearchGeneralizationPolicyDecisions() {
      calls.push("listResearchGeneralizationPolicyDecisions");
      return structuredClone(generalizationDecisions);
    },
    async listResearchAllocationPolicyDecisions() {
      calls.push("listResearchAllocationPolicyDecisions");
      return structuredClone(decisions);
    }
  } as unknown as OuroborosStorePort;
}

function policyDecisionFixture(
  suffix: string,
  decidedAt: string
): ResearchAllocationPolicyDecisionRecord {
  const decision: ResearchAllocationPolicyDecisionRecord = {
    record_kind: "research_allocation_policy_decision",
    version: 1,
    research_allocation_policy_decision_id:
      `research-allocation-policy-decision-${suffix}`,
    study_ref: {
      record_kind: "research_control_study",
      id: `research-control-study-${suffix}`
    },
    study_digest: `sha256:${"a".repeat(64)}`,
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: `research-control-study-outcome-${suffix}`
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
    decided_at: decidedAt,
    policy_decision_digest: "pending",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  resealPolicyDecision(decision);
  return decision;
}

function resealPolicyDecision(
  decision: ResearchAllocationPolicyDecisionRecord
): void {
  decision.policy_decision_digest = exactDigest(
    researchAllocationPolicyDecisionDigestInput(decision)
  );
}

function generalizationPolicyDecisionFixture(
  suffix: string,
  decidedAt: string
): ResearchGeneralizationPolicyDecisionRecord {
  const decision: ResearchGeneralizationPolicyDecisionRecord = {
    record_kind: "research_generalization_policy_decision",
    version: 1,
    research_generalization_policy_decision_id:
      `research-generalization-policy-decision-${suffix}`,
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: `research-generalization-protocol-${suffix}`
    },
    protocol_digest: `sha256:${"c".repeat(64)}`,
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: `research-generalization-outcome-${suffix}`
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
    decided_at: decidedAt,
    policy_decision_digest: "pending",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  resealGeneralizationPolicyDecision(decision);
  return decision;
}

function resealGeneralizationPolicyDecision(
  decision: ResearchGeneralizationPolicyDecisionRecord
): void {
  decision.policy_decision_digest = exactDigest(
    researchGeneralizationPolicyDecisionDigestInput(decision)
  );
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function publicExecutionFailureCluster(): CandidateArenaFindingClusterReadModel {
  return {
    direction_kind: "trend_following",
    top_blocker: "paper_evaluation_failed",
    blocker_group_kind: "observation_quality",
    market_regime: "unknown",
    protocol_failure_kind: "public_execution_evidence_gap",
    candidate_count: 1,
    candidate_ids: ["candidate-001"],
    latest_finding: "Public execution evidence was unavailable.",
    next_research_focus: "Restore public execution evidence.",
    authority_status: "not_promotion_authority"
  };
}

function efficiencyTick(): CandidateArenaTickReadModel {
  return tickWithResults([
    {
      ...directionResult("trend_following", "created"),
      candidate_id: "candidate-trend",
      research_efficiency: {
        provider_request_total: 48,
        runner_command_total: 12,
        scenario_count: 4,
        elapsed_ms: 120_000,
        authority_status: "not_promotion_authority"
      }
    },
    {
      ...directionResult("mean_reversion", "created"),
      candidate_id: "candidate-mean",
      research_efficiency: {
        provider_request_total: 2,
        runner_command_total: 0,
        scenario_count: 2,
        elapsed_ms: 1_000,
        authority_status: "not_promotion_authority"
      }
    }
  ]);
}

function tickWithResults(
  directionResults: CandidateArenaTickDirectionResultReadModel[]
): CandidateArenaTickReadModel {
  return {
    tick_id: "tick-1",
    started_at: "2026-07-12T09:00:00.000Z",
    completed_at: "2026-07-12T09:01:00.000Z",
    status: directionResults.some((result) => result.status === "failed")
      ? "completed_with_errors"
      : "completed",
    created_candidate_ids: directionResults.flatMap((result) =>
      result.candidate_id ? [result.candidate_id] : []
    ),
    direction_results: directionResults,
    authority_status: "not_live"
  };
}

function directionResult(
  directionKind: ResearchDirectionKind,
  status: CandidateArenaTickDirectionResultReadModel["status"]
): CandidateArenaTickDirectionResultReadModel {
  if (status === "failed") {
    return {
      direction_kind: directionKind,
      status,
      error: `${directionKind} failed`
    };
  }
  if (status === "created") {
    return {
      direction_kind: directionKind,
      status,
      candidate_id: `candidate-${directionKind}`
    };
  }
  return {
    direction_kind: directionKind,
    status,
    finding: `${directionKind} ${status}`,
    admission_decision_id: `admission-${directionKind}`,
    admission_reason: status === "duplicate"
      ? "no_candidate_change"
      : "evaluation_disqualified"
  };
}

function explorationSelection(
  directionKind: ResearchDirectionKind,
  priority: number
): CandidateArenaResearchAllocationRecord["selected_directions"][number] {
  return {
    direction_kind: directionKind,
    selection_kind: "exploration",
    priority,
    experiment_budget: 1,
    signal_score: 0,
    reasons: ["exploration_floor"]
  };
}

function staticSelection(
  directionKind: ResearchDirectionKind,
  priority: number,
  experimentBudget: number
): CandidateArenaResearchAllocationRecord["selected_directions"][number] {
  return {
    direction_kind: directionKind,
    selection_kind: "static_control",
    priority,
    experiment_budget: experimentBudget,
    signal_score: 0,
    reasons: ["static_control"]
  };
}

function explicitSelection(
  directionKind: ResearchDirectionKind,
  priority: number
): CandidateArenaResearchAllocationRecord["selected_directions"][number] {
  return {
    direction_kind: directionKind,
    selection_kind: "explicit",
    priority,
    experiment_budget: 1,
    signal_score: 0,
    reasons: ["explicit_direction"]
  };
}
