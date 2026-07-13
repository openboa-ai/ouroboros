import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  type ResearchGeneralizationOutcomeBlockResult,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { decideResearchGeneralizationProtocol } from
  "./research-generalization-protocol";
import { researchGeneralizationOutcomeId } from
  "./research-generalization-outcome";
import {
  decideResearchGeneralizationPolicyDecision,
  researchGeneralizationPolicyDecisionId,
  ResearchGeneralizationPolicyDecisionCoordinator,
  ResearchGeneralizationPolicyDecisionError,
  ResearchGeneralizationPolicyDecisionService
} from "./research-generalization-policy-decision";

describe("ResearchGeneralizationPolicyDecision application", () => {
  it("approves only an eligible supported prospective outcome", () => {
    const graph = generalizationGraph("supported");

    const decision = decideResearchGeneralizationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-20T00:00:01.000Z"
    });

    expect(decision.research_generalization_policy_decision_id).toBe(
      researchGeneralizationPolicyDecisionId(graph.outcome)
    );
    expect(decision).toMatchObject({
      protocol_ref: {
        id: graph.protocol.research_generalization_protocol_id
      },
      generalization_outcome_ref: {
        id: graph.outcome.research_generalization_outcome_id
      },
      target_allocation_policy_digest:
        graph.protocol.target_allocation_policy_digest,
      decision_status: "approved",
      decision_reason: "supported_cross_condition_adaptive_effect",
      effective_default_mode: "adaptive_default",
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_policy_only"
    });
    expect(decision.policy_decision_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it.each(["negative", "insufficient"] as const)(
    "records %s evidence as not approved without selecting static",
    (kind) => {
      const graph = generalizationGraph(kind);

      const decision = decideResearchGeneralizationPolicyDecision({
        ...graph,
        decidedAt: "2026-07-20T00:00:01.000Z"
      });

      expect(decision).toMatchObject({
        decision_status: "not_approved",
        decision_reason: "generalization_outcome_not_eligible",
        effective_default_mode: null
      });
      expect(JSON.stringify(decision)).not.toContain("static_control");
    }
  );

  it.each([
    ["protocol digest drift", (graph: DecisionGraph) => {
      graph.protocol.protocol_digest = digest("f");
    }],
    ["outcome protocol ref drift", (graph: DecisionGraph) => {
      graph.outcome.protocol_ref.id = "other-protocol";
      resealOutcome(graph.outcome);
    }],
    ["outcome protocol digest drift", (graph: DecisionGraph) => {
      graph.outcome.protocol_digest = digest("e");
      resealOutcome(graph.outcome);
    }],
    ["outcome target policy drift", (graph: DecisionGraph) => {
      graph.outcome.target_allocation_policy_digest = digest("d");
      resealOutcome(graph.outcome);
    }],
    ["outcome identity drift", (graph: DecisionGraph) => {
      graph.outcome.research_generalization_outcome_id = "other-outcome";
      resealOutcome(graph.outcome);
    }],
    ["statistic drift", (graph: DecisionGraph) => {
      graph.outcome.exact_sign_test_p_value = 0.5;
      resealOutcome(graph.outcome);
    }],
    ["pre-outcome decision", (graph: DecisionGraph) => {
      graph.decidedAt = graph.outcome.adjudicated_at;
    }]
  ])("rejects %s", (_label, mutate) => {
    const graph: DecisionGraph = {
      ...generalizationGraph("supported"),
      decidedAt: "2026-07-20T00:00:01.000Z"
    };
    mutate(graph);

    expect(() => decideResearchGeneralizationPolicyDecision(graph))
      .toThrow(ResearchGeneralizationPolicyDecisionError);
  });

  it("records once and replays without changing decision time", async () => {
    const graph = generalizationGraph("supported");
    const store = new GeneralizationPolicyDecisionStore(graph);
    const service = new ResearchGeneralizationPolicyDecisionService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:01.000Z"
    });

    const first = await service.decide(graph);
    await expect(service.decide(graph)).resolves.toEqual(first);
    expect(store.decisions).toEqual([first]);
  });

  it("accepts one exact concurrent winner with its original time", async () => {
    const graph = generalizationGraph("supported");
    const store = new GeneralizationPolicyDecisionStore(graph);
    const winner = decideResearchGeneralizationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-20T00:00:01.000Z"
    });
    store.concurrentWinner = winner;
    const service = new ResearchGeneralizationPolicyDecisionService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:02.000Z"
    });

    await expect(service.decide(graph)).resolves.toEqual(winner);
    expect(store.decisions).toEqual([winner]);
  });

  it("rejects absent source evidence and persistence substitution", async () => {
    const graph = generalizationGraph("supported");
    const missing = new GeneralizationPolicyDecisionStore(graph);
    missing.protocol = undefined;
    await expect(new ResearchGeneralizationPolicyDecisionService({
      store: missing as unknown as OuroborosStorePort
    }).decide(graph)).rejects.toMatchObject({
      code: "research_generalization_policy_decision_graph_invalid"
    });

    const substituted = new GeneralizationPolicyDecisionStore(graph);
    substituted.substitutePersistence = true;
    await expect(new ResearchGeneralizationPolicyDecisionService({
      store: substituted as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:01.000Z"
    }).decide(graph)).rejects.toMatchObject({
      code: "research_generalization_policy_decision_persistence_conflict"
    });
  });

  it.each([
    ["supported", "approved"],
    ["negative", "not_approved"],
    ["insufficient", "not_approved"]
  ] as const)("ensures %s outcomes symmetrically", async (kind, status) => {
    const graph = generalizationGraph(kind, `coordinator-${kind}`);
    const store = new GeneralizationPolicyDecisionCoordinatorStore([graph]);
    const coordinator = new ResearchGeneralizationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:01.000Z"
    });

    await expect(coordinator.ensureNextDecision()).resolves.toEqual({
      status: "ensured",
      decisionId:
        researchGeneralizationPolicyDecisionId(graph.outcome),
      generalizationOutcomeId:
        graph.outcome.research_generalization_outcome_id,
      decisionStatus: status
    });
    expect(store.decisions[0]).toMatchObject({
      decision_status: status,
      effective_default_mode: status === "approved"
        ? "adaptive_default"
        : null
    });
  });

  it("validates existing evidence and ensures only the oldest missing decision", async () => {
    const first = generalizationGraph("supported", "coordinator-first");
    const second = generalizationGraph("negative", "coordinator-second");
    second.outcome.adjudicated_at = "2026-07-20T00:00:00.001Z";
    resealOutcome(second.outcome);
    const firstDecision = decideResearchGeneralizationPolicyDecision({
      ...first,
      decidedAt: "2026-07-20T00:00:00.500Z"
    });
    const store = new GeneralizationPolicyDecisionCoordinatorStore([
      second,
      first
    ]);
    store.decisions.push(firstDecision);
    const coordinator = new ResearchGeneralizationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:01.000Z"
    });

    await expect(coordinator.ensureNextDecision()).resolves.toMatchObject({
      status: "ensured",
      generalizationOutcomeId:
        second.outcome.research_generalization_outcome_id,
      decisionStatus: "not_approved"
    });
    expect(store.recordCount).toBe(1);
    await expect(coordinator.ensureNextDecision()).resolves.toEqual({
      status: "up_to_date",
      generalizationOutcomeCount: 2
    });
  });

  it("orders equal-time decisions one millisecond after adjudication", async () => {
    const graph = generalizationGraph("supported", "coordinator-equal");
    const store = new GeneralizationPolicyDecisionCoordinatorStore([graph]);
    const coordinator = new ResearchGeneralizationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => graph.outcome.adjudicated_at
    });

    await coordinator.ensureNextDecision();

    expect(store.decisions[0]!.decided_at).toBe(
      "2026-07-20T00:00:00.001Z"
    );
  });

  it("fails closed for orphan decisions, duplicate refs, and clock regression", async () => {
    const graph = generalizationGraph("supported", "coordinator-invalid");
    const decision = decideResearchGeneralizationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-20T00:00:01.000Z"
    });
    const orphanStore = new GeneralizationPolicyDecisionCoordinatorStore([]);
    orphanStore.decisions.push(decision);
    await expect(new ResearchGeneralizationPolicyDecisionCoordinator({
      store: orphanStore as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_generalization_policy_decision_coordination_failed"
    });

    const duplicateStore = new GeneralizationPolicyDecisionCoordinatorStore([
      graph
    ]);
    duplicateStore.outcomes.push(structuredClone(graph.outcome));
    await expect(new ResearchGeneralizationPolicyDecisionCoordinator({
      store: duplicateStore as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_generalization_policy_decision_coordination_failed"
    });

    const regressed = new GeneralizationPolicyDecisionCoordinatorStore([
      graph
    ]);
    await expect(new ResearchGeneralizationPolicyDecisionCoordinator({
      store: regressed as unknown as OuroborosStorePort,
      now: () => "2026-07-19T23:59:59.999Z"
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_generalization_policy_decision_coordination_failed"
    });
    expect(regressed.decisions).toEqual([]);
  });

  it("fails closed when an existing decision conflicts with its outcome", async () => {
    const graph = generalizationGraph("supported", "coordinator-conflict");
    const conflicting = decideResearchGeneralizationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-20T00:00:01.000Z"
    });
    conflicting.decision_status = "not_approved";
    conflicting.decision_reason = "generalization_outcome_not_eligible";
    conflicting.effective_default_mode = null;
    resealDecision(conflicting);
    const store = new GeneralizationPolicyDecisionCoordinatorStore([graph]);
    store.decisions.push(conflicting);

    await expect(new ResearchGeneralizationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_generalization_policy_decision_coordination_failed"
    });
    expect(store.recordCount).toBe(0);
  });
});

type EvidenceKind = "supported" | "negative" | "insufficient";

interface DecisionGraph {
  protocol: ResearchGeneralizationProtocolRecord;
  outcome: ResearchGeneralizationOutcomeRecord;
  decidedAt: string;
}

class GeneralizationPolicyDecisionStore {
  protocol?: ResearchGeneralizationProtocolRecord;
  outcome?: ResearchGeneralizationOutcomeRecord;
  decisions: ResearchGeneralizationPolicyDecisionRecord[] = [];
  substitutePersistence = false;
  concurrentWinner?: ResearchGeneralizationPolicyDecisionRecord;

  constructor(graph: Omit<DecisionGraph, "decidedAt">) {
    this.protocol = structuredClone(graph.protocol);
    this.outcome = structuredClone(graph.outcome);
  }

  async getResearchGeneralizationProtocol(id: string) {
    return this.protocol?.research_generalization_protocol_id === id
      ? structuredClone(this.protocol)
      : undefined;
  }

  async getResearchGeneralizationOutcome(id: string) {
    return this.outcome?.research_generalization_outcome_id === id
      ? structuredClone(this.outcome)
      : undefined;
  }

  async getResearchGeneralizationPolicyDecision(id: string) {
    return structuredClone(this.decisions.find((decision) =>
      decision.research_generalization_policy_decision_id === id
    ));
  }

  async recordResearchGeneralizationPolicyDecision(
    decision: ResearchGeneralizationPolicyDecisionRecord
  ) {
    if (this.concurrentWinner) {
      this.decisions.push(structuredClone(this.concurrentWinner));
      this.concurrentWinner = undefined;
      throw new Error("concurrent winner");
    }
    const recorded = structuredClone(decision);
    if (this.substitutePersistence) recorded.decision_status = "not_approved";
    this.decisions.push(recorded);
    return structuredClone(recorded);
  }
}

class GeneralizationPolicyDecisionCoordinatorStore {
  protocols: ResearchGeneralizationProtocolRecord[];
  outcomes: ResearchGeneralizationOutcomeRecord[];
  decisions: ResearchGeneralizationPolicyDecisionRecord[] = [];
  recordCount = 0;

  constructor(graphs: Array<Omit<DecisionGraph, "decidedAt">>) {
    this.protocols = graphs.map((graph) => structuredClone(graph.protocol));
    this.outcomes = graphs.map((graph) => structuredClone(graph.outcome));
  }

  async listResearchGeneralizationProtocols() {
    return structuredClone(this.protocols);
  }

  async listResearchGeneralizationOutcomes() {
    return structuredClone(this.outcomes);
  }

  async listResearchGeneralizationPolicyDecisions() {
    return structuredClone(this.decisions);
  }

  async getResearchGeneralizationProtocol(id: string) {
    return structuredClone(this.protocols.find((protocol) =>
      protocol.research_generalization_protocol_id === id
    ));
  }

  async getResearchGeneralizationOutcome(id: string) {
    return structuredClone(this.outcomes.find((outcome) =>
      outcome.research_generalization_outcome_id === id
    ));
  }

  async getResearchGeneralizationPolicyDecision(id: string) {
    return structuredClone(this.decisions.find((decision) =>
      decision.research_generalization_policy_decision_id === id
    ));
  }

  async recordResearchGeneralizationPolicyDecision(
    decision: ResearchGeneralizationPolicyDecisionRecord
  ) {
    this.recordCount += 1;
    this.decisions.push(structuredClone(decision));
    return structuredClone(decision);
  }
}

function generalizationGraph(
  kind: EvidenceKind,
  token = `generalization-policy-${kind}`
): Omit<DecisionGraph, "decidedAt"> {
  const protocol = decideResearchGeneralizationProtocol({
    idempotencyKey: token,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    campaignPolicy: campaignPolicy(),
    committedAt: "2026-07-13T00:00:00.000Z"
  });
  const effects = kind === "supported"
    ? [1, 0.8, 0.6, 0.4, 0.2, 0.1]
    : kind === "negative"
      ? [1, 0.8, 0.6, 0.4, -0.1, -0.3]
      : [1, 0.8, 0.6, 0.4, 0.2, 0];
  return {
    protocol,
    outcome: outcomeFixture(protocol, effects)
  };
}

function outcomeFixture(
  protocol: ResearchGeneralizationProtocolRecord,
  effects: number[]
): ResearchGeneralizationOutcomeRecord {
  const baselineCharacters = ["1", "2", "3", "1", "2", "3"];
  const slotResults = protocol.study_slots.map((slot, index) => {
    const effect = effects[index]!;
    return {
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      planned_study_ref: { ...slot.study_ref },
      slot_status: "completed" as const,
      status_reason: "eligible_terminal_study" as const,
      study_ref: { ...slot.study_ref },
      study_digest: digest(String.fromCharCode(97 + index)),
      study_outcome_ref: {
        record_kind: "research_control_study_outcome",
        id: `${slot.study_ref.id}-outcome`
      },
      study_outcome_digest: digest(String(index)),
      baseline_snapshot_digest: digest(baselineCharacters[index]!),
      source_system_code_artifact_digest:
        digest(["6", "7", "8", "9", "a", "b"][index]!),
      observed_rate_difference: effect,
      study_effect_status: effect > 0
        ? "adaptive_positive" as const
        : effect < 0
          ? "static_positive" as const
          : "tied" as const
    };
  });
  const blockResults = (["long", "short", "flat"] as const).map(
    (block, index) => blockResult(block, slotResults.slice(index * 2, index * 2 + 2))
  ) as [
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult,
    ResearchGeneralizationOutcomeBlockResult
  ];
  const adaptivePositive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const tied = effects.length - adaptivePositive - staticPositive;
  const nonTied = adaptivePositive + staticPositive;
  const pValue = signPValue(adaptivePositive, staticPositive);
  const equalWeightMean = round6(blockResults.reduce(
    (sum, block) => sum + Number(block.mean_rate_difference),
    0
  ) / 3);
  const harmfulBlocks = blockResults.filter((block) =>
    Number(block.mean_rate_difference) <= 0
  ).map((block) => block.condition_block);
  const sufficient = nonTied === 6;
  const supported = sufficient && pValue <= 0.05 && equalWeightMean > 0 &&
    harmfulBlocks.length === 0;
  const inference = !sufficient
    ? "insufficient_generalization_evidence" as const
    : supported
      ? "generalization_supported" as const
      : "generalization_not_supported" as const;
  const outcome: ResearchGeneralizationOutcomeRecord = {
    record_kind: "research_generalization_outcome",
    version: 1,
    research_generalization_outcome_id:
      researchGeneralizationOutcomeId(protocol),
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: protocol.research_generalization_protocol_id
    },
    protocol_digest: protocol.protocol_digest,
    target_allocation_policy_digest:
      protocol.target_allocation_policy_digest,
    slot_results: slotResults,
    block_results: blockResults,
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: nonTied,
    tied_study_count: tied,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: adaptivePositive,
    static_positive_count: staticPositive,
    distinct_baseline_count: 3,
    equal_weight_mean_rate_difference: equalWeightMean,
    exact_sign_test_p_value: pValue,
    harmful_condition_blocks: harmfulBlocks,
    inference_status: inference,
    causal_scope:
      "pre_effect_market_condition_blocked_cross_baseline_study_effects",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_generalization_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_broad_research_allocation_policy"
      : inference === "generalization_not_supported"
        ? "retain_negative_generalization_evidence"
        : "complete_or_redesign_generalization_protocol",
    adjudicated_at: "2026-07-20T00:00:00.000Z",
    outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealOutcome(outcome);
  return outcome;
}

function blockResult(
  conditionBlock: "long" | "short" | "flat",
  slots: Array<{ observed_rate_difference: number; baseline_snapshot_digest: string }>
): ResearchGeneralizationOutcomeBlockResult {
  const effects = slots.map((slot) => slot.observed_rate_difference);
  const adaptive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const tied = effects.length - adaptive - staticPositive;
  const mean = round6(effects.reduce((sum, effect) => sum + effect, 0) /
    effects.length);
  return {
    condition_block: conditionBlock,
    planned_study_count: 2,
    completed_study_count: 2,
    non_tied_study_count: adaptive + staticPositive,
    tied_study_count: tied,
    missing_study_count: 0,
    ineligible_study_count: 0,
    adaptive_positive_count: adaptive,
    static_positive_count: staticPositive,
    distinct_baseline_count: new Set(slots.map((slot) =>
      slot.baseline_snapshot_digest
    )).size,
    mean_rate_difference: mean,
    block_status: mean > 0 ? "complete_positive" : "complete_non_positive"
  };
}

function boundPaperProtocolInput() {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("5"),
    paper_policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function campaignPolicy() {
  return {
    policy_version: "research_control_campaign_v1" as const,
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3 as const,
    concurrency_limit_per_arm: 2 as const,
    maximum_total_development_submissions_per_tick: 5 as const,
    arm_execution_policy: "concurrent_per_sequence" as const,
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order" as const,
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate" as const,
    required_future_evidence:
      "confirmed_comparison_research_release" as const
  };
}

function resealOutcome(outcome: ResearchGeneralizationOutcomeRecord): void {
  outcome.outcome_digest = exactDigest(
    researchGeneralizationOutcomeDigestInput(outcome)
  );
}

function resealDecision(
  decision: ResearchGeneralizationPolicyDecisionRecord
): void {
  decision.policy_decision_digest = exactDigest(
    researchGeneralizationPolicyDecisionDigestInput(decision)
  );
}

function exactDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function signPValue(positive: number, negative: number): number {
  const count = positive + negative;
  if (count === 0) return 1;
  const lower = Math.min(positive, negative);
  let combinations = 0;
  for (let index = 0; index <= lower; index += 1) {
    combinations += combination(count, index);
  }
  return round6(Math.min(1, 2 * combinations / 2 ** count));
}

function combination(count: number, selected: number): number {
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = result * (count - index + 1) / index;
  }
  return result;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
