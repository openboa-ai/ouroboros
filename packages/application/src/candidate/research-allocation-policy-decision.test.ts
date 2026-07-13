import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlStudyOutcomeDigestInput,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { resolveCandidateArenaResearchAllocationPolicy } from
  "./research-allocation";
import { decideResearchControlStudy } from "./research-control-study";
import { researchControlStudyOutcomeId } from
  "./research-control-study-outcome";
import {
  decideResearchAllocationPolicyDecision,
  ResearchAllocationPolicyDecisionError,
  ResearchAllocationPolicyDecisionCoordinator,
  ResearchAllocationPolicyDecisionService
} from "./research-allocation-policy-decision";

describe("ResearchAllocationPolicyDecision application", () => {
  it("approves only an eligible supported adaptive outcome", () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1]);

    const decision = decideResearchAllocationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });

    expect(decision).toMatchObject({
      decision_status: "approved",
      decision_reason: "supported_same_baseline_adaptive_effect",
      effective_default_mode: "adaptive_default",
      target_allocation_policy_digest:
        graph.study.condition.allocation_policy_digest,
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
  });

  it.each([
    [[-1, -1, -1, -1, -1, -1]],
    [[1, 1, 1, 1, 1, 0]],
    [[0, 0, 0, 0, 0, 0]]
  ])("records %j as not approved without selecting static", (differences) => {
    const graph = studyGraph(differences);

    const decision = decideResearchAllocationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });

    expect(decision).toMatchObject({
      decision_status: "not_approved",
      decision_reason: "study_outcome_not_eligible",
      effective_default_mode: null
    });
    expect(JSON.stringify(decision)).not.toContain("static_control");
  });

  it.each([
    ["study digest drift", (graph: StudyGraph) => {
      graph.study.study_digest = digest("f");
    }],
    ["outcome study ref drift", (graph: StudyGraph) => {
      graph.outcome.study_ref.id = "other-study";
      resealOutcome(graph.outcome);
    }],
    ["outcome study digest drift", (graph: StudyGraph) => {
      graph.outcome.study_digest = digest("e");
      resealOutcome(graph.outcome);
    }],
    ["planned campaign substitution", (graph: StudyGraph) => {
      graph.outcome.replication_results[0]!.campaign_ref.id = "other-campaign";
      resealOutcome(graph.outcome);
    }],
    ["statistic drift", (graph: StudyGraph) => {
      graph.outcome.exact_sign_test_p_value = 0.5;
      resealOutcome(graph.outcome);
    }],
    ["pre-outcome decision", (graph: StudyGraph) => {
      graph.decidedAt = "2026-07-12T11:59:59.999Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const graph: StudyGraph = {
      ...studyGraph([1, 1, 1, 1, 1, 1]),
      decidedAt: "2026-07-12T13:00:00.000Z"
    };
    mutate(graph);

    expect(() => decideResearchAllocationPolicyDecision(graph))
      .toThrow(ResearchAllocationPolicyDecisionError);
  });

  it("records once and replays without changing decision time", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1]);
    const store = new PolicyDecisionStore(graph);
    const service = new ResearchAllocationPolicyDecisionService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    const first = await service.decide(graph);
    await expect(service.decide(graph)).resolves.toEqual(first);
    expect(store.decisions).toEqual([first]);
  });

  it("accepts an exact concurrent winner with its original decision time", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1]);
    const store = new PolicyDecisionStore(graph);
    const winner = decideResearchAllocationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });
    store.concurrentWinner = winner;
    const service = new ResearchAllocationPolicyDecisionService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:01.000Z"
    });

    await expect(service.decide(graph)).resolves.toEqual(winner);
    expect(store.decisions).toEqual([winner]);
  });

  it("rejects missing source graph and persistence substitution", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1]);
    const missing = new PolicyDecisionStore(graph);
    missing.study = undefined;
    const missingService = new ResearchAllocationPolicyDecisionService({
      store: missing as unknown as OuroborosStorePort
    });
    await expect(missingService.decide(graph)).rejects.toMatchObject({
      code: "research_allocation_policy_decision_graph_invalid"
    });

    const substituted = new PolicyDecisionStore(graph);
    substituted.substitutePersistence = true;
    const substitutedService = new ResearchAllocationPolicyDecisionService({
      store: substituted as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });
    await expect(substitutedService.decide(graph)).rejects.toMatchObject({
      code: "research_allocation_policy_decision_persistence_conflict"
    });
  });

  it("reports an empty terminal outcome set as up to date", async () => {
    const store = new PolicyDecisionCoordinatorStore([]);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    await expect(coordinator.ensureNextDecision()).resolves.toEqual({
      status: "up_to_date",
      terminalOutcomeCount: 0
    });
    expect(store.recordCount).toBe(0);
  });

  it.each([
    ["supported", [1, 1, 1, 1, 1, 1], "approved"],
    ["unsupported", [-1, -1, -1, -1, -1, -1], "not_approved"],
    ["underpowered", [1, 1, 1, 1, 1, 0], "not_approved"]
  ] as const)("ensures a %s terminal outcome symmetrically", async (
    token,
    differences,
    decisionStatus
  ) => {
    const graph = studyGraph([...differences], `coordinator-${token}`);
    const store = new PolicyDecisionCoordinatorStore([graph]);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    const result = await coordinator.ensureNextDecision();

    expect(result).toEqual({
      status: "ensured",
      decisionId:
        store.decisions[0]!.research_allocation_policy_decision_id,
      studyOutcomeId: graph.outcome.research_control_study_outcome_id,
      decisionStatus
    });
    expect(store.decisions).toHaveLength(1);
    expect(store.decisions[0]).toMatchObject({
      decision_status: decisionStatus,
      effective_default_mode: decisionStatus === "approved"
        ? "adaptive_default"
        : null,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
  });

  it("validates existing evidence and ensures only the oldest missing decision", async () => {
    const first = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-first");
    const second = studyGraph([-1, -1, -1, -1, -1, -1], "coordinator-second");
    second.outcome.adjudicated_at = "2026-07-12T12:00:01.000Z";
    resealOutcome(second.outcome);
    const firstDecision = decideResearchAllocationPolicyDecision({
      ...first,
      decidedAt: "2026-07-12T12:30:00.000Z"
    });
    const store = new PolicyDecisionCoordinatorStore([second, first]);
    store.decisions.push(firstDecision);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    await expect(coordinator.ensureNextDecision()).resolves.toMatchObject({
      status: "ensured",
      studyOutcomeId: second.outcome.research_control_study_outcome_id,
      decisionStatus: "not_approved"
    });
    expect(store.recordCount).toBe(1);
    expect(store.decisions).toHaveLength(2);
    await expect(coordinator.ensureNextDecision()).resolves.toEqual({
      status: "up_to_date",
      terminalOutcomeCount: 2
    });
    expect(store.recordCount).toBe(1);
  });

  it("creates at most one oldest missing decision per call", async () => {
    const first = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-bounded-first");
    const second = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-bounded-second");
    second.outcome.adjudicated_at = "2026-07-12T12:00:01.000Z";
    resealOutcome(second.outcome);
    const store = new PolicyDecisionCoordinatorStore([second, first]);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    await expect(coordinator.ensureNextDecision()).resolves.toMatchObject({
      status: "ensured",
      studyOutcomeId: first.outcome.research_control_study_outcome_id
    });
    expect(store.decisions).toHaveLength(1);
    await expect(coordinator.ensureNextDecision()).resolves.toMatchObject({
      status: "ensured",
      studyOutcomeId: second.outcome.research_control_study_outcome_id
    });
    expect(store.decisions).toHaveLength(2);
  });

  it("orders an immediate decision strictly after the study outcome", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-equal-clock");
    const store = new PolicyDecisionCoordinatorStore([graph]);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => graph.outcome.adjudicated_at
    });

    await coordinator.ensureNextDecision();

    expect(store.decisions[0]!.decided_at).toBe(
      "2026-07-12T12:00:00.001Z"
    );
  });

  it("fails closed for orphan decisions, missing studies, and clock regression", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-invalid");
    const decision = decideResearchAllocationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });
    const orphanStore = new PolicyDecisionCoordinatorStore([]);
    orphanStore.decisions.push(decision);
    await expect(new ResearchAllocationPolicyDecisionCoordinator({
      store: orphanStore as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_allocation_policy_decision_coordination_failed"
    });

    const missingStudyStore = new PolicyDecisionCoordinatorStore([graph]);
    missingStudyStore.studies = [];
    await expect(new ResearchAllocationPolicyDecisionCoordinator({
      store: missingStudyStore as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_allocation_policy_decision_coordination_failed"
    });

    const regressedClockStore = new PolicyDecisionCoordinatorStore([graph]);
    await expect(new ResearchAllocationPolicyDecisionCoordinator({
      store: regressedClockStore as unknown as OuroborosStorePort,
      now: () => "2026-07-12T11:59:59.999Z"
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_allocation_policy_decision_coordination_failed"
    });
    expect(regressedClockStore.decisions).toEqual([]);
  });

  it("fails closed for an existing decision that conflicts with its outcome", async () => {
    const graph = studyGraph([1, 1, 1, 1, 1, 1], "coordinator-conflict");
    const conflicting = decideResearchAllocationPolicyDecision({
      ...graph,
      decidedAt: "2026-07-12T13:00:00.000Z"
    });
    conflicting.decision_status = "not_approved";
    conflicting.decision_reason = "study_outcome_not_eligible";
    conflicting.effective_default_mode = null;
    resealDecision(conflicting);
    const store = new PolicyDecisionCoordinatorStore([graph]);
    store.decisions.push(conflicting);

    await expect(new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort
    }).ensureNextDecision()).rejects.toMatchObject({
      code: "research_allocation_policy_decision_coordination_failed"
    });
    expect(store.recordCount).toBe(0);
  });

  it("makes an ensured approval available to uncontrolled allocation", async () => {
    const graph = studyGraph(
      [1, 1, 1, 1, 1, 1],
      "coordinator-allocation"
    );
    const store = new PolicyDecisionCoordinatorStore([graph]);
    const coordinator = new ResearchAllocationPolicyDecisionCoordinator({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    await coordinator.ensureNextDecision();
    const decision = store.decisions[0]!;

    await expect(resolveCandidateArenaResearchAllocationPolicy({
      store: store as unknown as OuroborosStorePort
    })).resolves.toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: {
        basis_kind: "research_allocation_policy_decision",
        policy_decision_ref: {
          record_kind: "research_allocation_policy_decision",
          id: decision.research_allocation_policy_decision_id
        },
        policy_decision_digest: decision.policy_decision_digest,
        study_outcome_ref: { ...decision.study_outcome_ref },
        study_outcome_digest: decision.study_outcome_digest
      }
    });
  });
});

interface StudyGraph {
  study: ResearchControlStudyRecord;
  outcome: ResearchControlStudyOutcomeRecord;
  decidedAt: string;
}

class PolicyDecisionStore {
  study?: ResearchControlStudyRecord;
  outcome?: ResearchControlStudyOutcomeRecord;
  decisions: ResearchAllocationPolicyDecisionRecord[] = [];
  substitutePersistence = false;
  concurrentWinner?: ResearchAllocationPolicyDecisionRecord;

  constructor(graph: Omit<StudyGraph, "decidedAt">) {
    this.study = structuredClone(graph.study);
    this.outcome = structuredClone(graph.outcome);
  }

  async getResearchControlStudy(id: string) {
    return this.study?.research_control_study_id === id
      ? structuredClone(this.study)
      : undefined;
  }

  async getResearchControlStudyOutcome(id: string) {
    return this.outcome?.research_control_study_outcome_id === id
      ? structuredClone(this.outcome)
      : undefined;
  }

  async getResearchAllocationPolicyDecision(id: string) {
    return structuredClone(this.decisions.find((decision) =>
      decision.research_allocation_policy_decision_id === id
    ));
  }

  async recordResearchAllocationPolicyDecision(
    decision: ResearchAllocationPolicyDecisionRecord
  ) {
    if (this.concurrentWinner) {
      this.decisions.push(structuredClone(this.concurrentWinner));
      this.concurrentWinner = undefined;
      throw Object.assign(new Error("concurrent policy decision winner"), {
        code: "research_allocation_policy_decision_conflict"
      });
    }
    const recorded = structuredClone(decision);
    if (this.substitutePersistence) recorded.decision_status = "not_approved";
    this.decisions.push(recorded);
    return structuredClone(recorded);
  }
}

class PolicyDecisionCoordinatorStore {
  studies: ResearchControlStudyRecord[];
  outcomes: ResearchControlStudyOutcomeRecord[];
  decisions: ResearchAllocationPolicyDecisionRecord[] = [];
  recordCount = 0;

  constructor(graphs: Array<Omit<StudyGraph, "decidedAt">>) {
    this.studies = graphs.map((graph) => structuredClone(graph.study));
    this.outcomes = graphs.map((graph) => structuredClone(graph.outcome));
  }

  async listResearchControlStudies() {
    return structuredClone(this.studies);
  }

  async listResearchControlStudyOutcomes() {
    return structuredClone(this.outcomes);
  }

  async listResearchAllocationPolicyDecisions() {
    return structuredClone(this.decisions);
  }

  async listResearchGeneralizationPolicyDecisions() {
    return [];
  }

  async getResearchControlStudy(id: string) {
    return structuredClone(this.studies.find((study) =>
      study.research_control_study_id === id
    ));
  }

  async getResearchControlStudyOutcome(id: string) {
    return structuredClone(this.outcomes.find((outcome) =>
      outcome.research_control_study_outcome_id === id
    ));
  }

  async getResearchAllocationPolicyDecision(id: string) {
    return structuredClone(this.decisions.find((decision) =>
      decision.research_allocation_policy_decision_id === id
    ));
  }

  async recordResearchAllocationPolicyDecision(
    decision: ResearchAllocationPolicyDecisionRecord
  ) {
    this.recordCount += 1;
    this.decisions.push(structuredClone(decision));
    return structuredClone(decision);
  }
}

function studyGraph(
  differences: number[],
  token = "policy-decision"
): Omit<StudyGraph, "decidedAt"> {
  const condition = studyCondition();
  const study = decideResearchControlStudy({
    idempotencyKey: `${token}-study`,
    baselineSnapshotDigest: digest("1"),
    condition,
    replicationIdempotencyKeys: differences.map((_, index) =>
      `${token}-replication-${index + 1}`
    ),
    committedAt: "2026-07-12T09:00:00.000Z"
  });
  const positive = differences.filter((value) => value > 0).length;
  const negative = differences.filter((value) => value < 0).length;
  const tied = differences.length - positive - negative;
  const nonTied = positive + negative;
  const mean = round6(differences.reduce((sum, value) => sum + value, 0) /
    differences.length);
  const pValue = signPValue(positive, negative);
  const supported = nonTied >= 6 && positive > negative &&
    pValue <= 0.05 && mean > 0;
  const outcome: ResearchControlStudyOutcomeRecord = {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id: researchControlStudyOutcomeId(study),
    study_ref: {
      record_kind: "research_control_study",
      id: study.research_control_study_id
    },
    study_digest: study.study_digest,
    replication_results: differences.map((difference, index) => ({
      replication_index: index + 1,
      campaign_ref: { ...study.replications[index]!.campaign_ref },
      campaign_digest: digest(String((index % 8) + 2)),
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: `${study.replications[index]!.campaign_ref.id}-outcome`
      },
      campaign_outcome_digest: digest(String((index % 8) + 2)),
      observed_rate_difference: difference
    })),
    planned_replication_count: differences.length,
    completed_replication_count: differences.length,
    adaptive_positive_count: positive,
    static_positive_count: negative,
    tied_count: tied,
    non_tied_count: nonTied,
    mean_rate_difference: mean,
    exact_sign_test_p_value: pValue,
    inference_status: nonTied < 6
      ? "insufficient_non_tied_replications"
      : supported
      ? "adaptive_effect_supported"
      : "adaptive_effect_not_supported",
    causal_scope: "same_baseline_stochastic_replication_only",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_research_allocation_policy"
      : "accumulate_or_redesign_precommitted_study",
    adjudicated_at: "2026-07-12T12:00:00.000Z",
    study_outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealOutcome(outcome);
  return { study, outcome };
}

function studyCondition() {
  const protocol = boundPaperProtocol();
  return {
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate" as const,
        id: "source-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version" as const,
        id: "source-version"
      },
      system_code_ref: {
        record_kind: "system_code" as const,
        id: "source-system-code"
      },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("b"),
      research_artifact_protocol: "single_file_python_v1" as const,
      research_artifact_closure_digest: digest("c")
    },
    research_agent: {
      provider: "fixture" as const,
      model: "scripted-fixture",
      permission_policy: "fixture_only" as const,
      identity_digest: digest("d")
    },
    paper_comparator: {
      comparator_status: "trading_review" as const,
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "promotion-001"
      },
      trading_promotion_digest: digest("4"),
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "champion-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "champion-version"
      },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "champion-evaluation"
      }
    },
    paper_evaluation_protocol: protocol,
    allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    allocation_policy_digest: exactDigest(
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
    ),
    campaign_policy: {
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
    }
  };
}

function boundPaperProtocol() {
  const protocol = {
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
    market_data_configuration_digest: digest("2"),
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
    },
    protocol_digest: digest("0")
  };
  protocol.protocol_digest = exactDigest(
    researchControlCampaignPaperEvaluationProtocolDigestInput(protocol)
  );
  return protocol;
}

function resealOutcome(outcome: ResearchControlStudyOutcomeRecord): void {
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
}

function resealDecision(
  decision: ResearchAllocationPolicyDecisionRecord
): void {
  decision.policy_decision_digest = exactDigest(
    researchAllocationPolicyDecisionDigestInput(decision)
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
