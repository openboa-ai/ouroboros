import type {
  CandidateArenaFindingClusterReadModel,
  CandidateArenaResearchAllocationRecord,
  CandidateArenaTickDirectionResultReadModel,
  CandidateArenaTickReadModel,
  ResearchDirectionKind
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../ports/store";
import {
  CandidateArenaResearchAllocationDecisionError,
  CandidateArenaResearchAllocationService,
  DEFAULT_ARENA_DIRECTIONS,
  decideCandidateArenaResearchAllocation
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

  it("applies stable recent duplicate, quarantine, and failure adjustments", () => {
    const allocation = decide({
      tickId: "tick-2",
      latestTicks: [tickWithResults([
        directionResult("trend_following", "duplicate"),
        directionResult("mean_reversion", "quarantined"),
        directionResult("volatility_regime", "failed")
      ])]
    });
    const scores = Object.fromEntries(allocation.signal_snapshot.map((signal) => [
      signal.direction_kind,
      signal.recent_outcome_score
    ]));

    expect(scores).toMatchObject({
      trend_following: -15,
      mean_reversion: -30,
      volatility_regime: -10
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
    explicitDirections: input.explicitDirections,
    findingClusters: input.findingClusters ?? [],
    latestTicks: input.latestTicks ?? [],
    priorAllocations: input.priorAllocations ?? [],
    completedTickIds: input.completedTickIds ?? []
  });
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
