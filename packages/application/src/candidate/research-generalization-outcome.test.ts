import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlStudyDigestInput,
  researchControlStudyGeneralizationAssignmentDigestInput,
  researchControlStudyOutcomeDigestInput,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  decideResearchControlStudy,
  researchControlStudyId
} from "./research-control-study";
import {
  exactTwoSidedSignTestPValue,
  researchControlStudyOutcomeId
} from "./research-control-study-outcome";
import { decideResearchGeneralizationMarketCondition } from
  "./research-generalization-market-condition";
import { decideResearchGeneralizationProtocol } from
  "./research-generalization-protocol";
import {
  decideResearchGeneralizationOutcome,
  researchGeneralizationOutcomeId,
  ResearchGeneralizationOutcomeDecisionError,
  ResearchGeneralizationOutcomeService
} from "./research-generalization-outcome";

describe("ResearchGeneralizationOutcome application", () => {
  it("supports one complete positive pre-effect cross-baseline protocol", () => {
    const graph = graphFixture([1, 0.8, 0.6, 0.4, 0.2, 0.1]);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(outcome.research_generalization_outcome_id).toBe(
      researchGeneralizationOutcomeId(graph.protocol)
    );
    expect(outcome.slot_results).toHaveLength(6);
    expect(outcome.slot_results.every((slot) =>
      slot.slot_status === "completed"
    )).toBe(true);
    expect(outcome.block_results.map((block) => ({
      condition: block.condition_block,
      mean: block.mean_rate_difference,
      status: block.block_status
    }))).toEqual([
      { condition: "long", mean: 0.9, status: "complete_positive" },
      { condition: "short", mean: 0.5, status: "complete_positive" },
      { condition: "flat", mean: 0.15, status: "complete_positive" }
    ]);
    expect(outcome).toMatchObject({
      planned_study_count: 6,
      completed_study_count: 6,
      non_tied_study_count: 6,
      tied_study_count: 0,
      missing_study_count: 0,
      ineligible_study_count: 0,
      adaptive_positive_count: 6,
      static_positive_count: 0,
      distinct_baseline_count: 3,
      equal_weight_mean_rate_difference: 0.516667,
      exact_sign_test_p_value: 0.03125,
      harmful_condition_blocks: [],
      inference_status: "generalization_supported",
      causal_scope:
        "pre_effect_market_condition_blocked_cross_baseline_study_effects",
      policy_decision_eligibility:
        "eligible_for_separate_generalization_policy_decision",
      next_action: "review_broad_research_allocation_policy",
      evaluation_authority: "external_to_trading_systems",
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(outcome.outcome_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("uses equal precommitted block means and preserves a harmful block", () => {
    const graph = graphFixture([1, 0.8, 0.6, 0.4, -0.1, -0.3]);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(outcome.block_results.map((block) => block.mean_rate_difference))
      .toEqual([0.9, 0.5, -0.2]);
    expect(outcome.equal_weight_mean_rate_difference).toBe(0.4);
    expect(outcome.harmful_condition_blocks).toEqual(["flat"]);
    expect(outcome.inference_status).toBe("generalization_not_supported");
    expect(outcome.policy_decision_eligibility).toBe("not_eligible");
    expect(outcome.next_action).toBe("retain_negative_generalization_evidence");
  });

  it("keeps complete duplicate-baseline evidence insufficient", () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 1], {
      baselineCharacters: ["1", "1", "1", "1", "1", "1"]
    });
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(outcome.distinct_baseline_count).toBe(1);
    expect(outcome.inference_status)
      .toBe("insufficient_generalization_evidence");
    expect(outcome.next_action)
      .toBe("complete_or_redesign_generalization_protocol");
  });

  it("keeps ties in block means and declared denominators", () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 0]);
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(outcome.completed_study_count).toBe(6);
    expect(outcome.non_tied_study_count).toBe(5);
    expect(outcome.tied_study_count).toBe(1);
    expect(outcome.block_results[2]).toMatchObject({
      completed_study_count: 2,
      non_tied_study_count: 1,
      tied_study_count: 1,
      mean_rate_difference: 0.5
    });
    expect(outcome.inference_status)
      .toBe("insufficient_generalization_evidence");
  });

  it("closes missing slots only after the collection deadline", () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 1]);
    graph.studies.pop();
    graph.studyOutcomes.pop();

    expect(() => decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    })).toThrow(ResearchGeneralizationOutcomeDecisionError);

    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-10-11T00:00:00.000Z"
    });
    expect(outcome.slot_results[5]).toMatchObject({
      slot_status: "missing_study",
      status_reason: "planned_study_not_committed",
      study_ref: null,
      study_outcome_ref: null,
      observed_rate_difference: null
    });
    expect(outcome).toMatchObject({
      completed_study_count: 5,
      missing_study_count: 1,
      ineligible_study_count: 0,
      equal_weight_mean_rate_difference: null,
      inference_status: "insufficient_generalization_evidence"
    });
  });

  it("reports terminal protocol-mismatched evidence as ineligible", () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 1]);
    const study = graph.studies[1]!;
    study.generalization_assignment!.protocol_ref.id = "other-protocol";
    resealStudy(study);
    const outcome = graph.studyOutcomes[1]!;
    outcome.study_digest = study.study_digest;
    resealStudyOutcome(outcome);

    const result = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(result.slot_results[1]).toMatchObject({
      slot_status: "ineligible",
      status_reason: "protocol_assignment_mismatch",
      study_ref: {
        id: study.research_control_study_id
      },
      study_outcome_ref: {
        id: outcome.research_control_study_outcome_id
      }
    });
    expect(result.completed_study_count).toBe(5);
    expect(result.ineligible_study_count).toBe(1);
    expect(result.inference_status)
      .toBe("insufficient_generalization_evidence");
  });

  it("independently rejects a terminal study inside the global spacing bound", () => {
    const day = 86_400_000;
    const graph = graphFixture([1, 1, 1, 1, 1, 1], {
      commitmentOffsetsMs: [day, day + 3_600_000, 3 * day, 4 * day, 5 * day, 6 * day]
    });

    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    });

    expect(outcome.slot_results[1]).toMatchObject({
      slot_status: "ineligible",
      status_reason: "study_spacing_not_elapsed"
    });
    expect(outcome.inference_status)
      .toBe("insufficient_generalization_evidence");
  });

  it("replays exact output and rejects hidden or stale graph evidence", () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 1]);
    const input = {
      ...graph,
      adjudicatedAt: "2026-07-20T00:00:00.000Z"
    };

    expect(decideResearchGeneralizationOutcome(structuredClone(input)))
      .toEqual(decideResearchGeneralizationOutcome(input));

    const extra = structuredClone(input);
    extra.studies.push({
      ...structuredClone(extra.studies[0]!),
      research_control_study_id: researchControlStudyId("hidden-study"),
      idempotency_key: "hidden-study"
    });
    resealStudy(extra.studies.at(-1)!);
    expect(() => decideResearchGeneralizationOutcome(extra))
      .toThrow(ResearchGeneralizationOutcomeDecisionError);

    const stale = structuredClone(input);
    stale.studyOutcomes[0]!.study_digest = digest("f");
    resealStudyOutcome(stale.studyOutcomes[0]!);
    expect(() => decideResearchGeneralizationOutcome(stale))
      .toThrow(ResearchGeneralizationOutcomeDecisionError);
  });

  it("persists one exact outcome through the application service", async () => {
    const graph = graphFixture([1, 1, 1, 1, 1, 1]);
    const store = new OutcomeStore(graph);
    const service = new ResearchGeneralizationOutcomeService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-20T00:00:00.000Z"
    });

    const first = await service.adjudicate(graph);
    await expect(service.adjudicate(structuredClone(graph)))
      .resolves.toEqual(first);
    expect(store.generalizationOutcomes).toEqual([first]);

    await expect(service.adjudicate({
      protocol: store.protocol,
      studies: store.studies.slice(1),
      studyOutcomes: store.studyOutcomes.slice(1)
    })).rejects.toMatchObject({
      code: "research_generalization_outcome_graph_invalid"
    });

    store.studyOutcomes[0]!.mean_rate_difference = -1;
    await expect(service.adjudicate({
      protocol: store.protocol,
      studies: store.studies,
      studyOutcomes: store.studyOutcomes
    })).rejects.toMatchObject({
      code: "research_generalization_outcome_graph_invalid"
    });
  });
});

class OutcomeStore {
  readonly protocol: ResearchGeneralizationProtocolRecord;
  readonly studies: ResearchControlStudyRecord[];
  readonly studyOutcomes: ResearchControlStudyOutcomeRecord[];
  generalizationOutcomes: ResearchGeneralizationOutcomeRecord[] = [];

  constructor(graph: ReturnType<typeof graphFixture>) {
    this.protocol = structuredClone(graph.protocol);
    this.studies = structuredClone(graph.studies);
    this.studyOutcomes = structuredClone(graph.studyOutcomes);
  }

  root() { return "generalization-outcome"; }

  async getResearchGeneralizationProtocol(id: string) {
    return this.protocol.research_generalization_protocol_id === id
      ? structuredClone(this.protocol)
      : undefined;
  }

  async getResearchControlStudy(id: string) {
    return structuredClone(this.studies.find((study) =>
      study.research_control_study_id === id
    ));
  }

  async getResearchControlStudyOutcome(id: string) {
    return structuredClone(this.studyOutcomes.find((outcome) =>
      outcome.research_control_study_outcome_id === id
    ));
  }

  async getResearchGeneralizationOutcome(id: string) {
    return structuredClone(this.generalizationOutcomes.find((outcome) =>
      outcome.research_generalization_outcome_id === id
    ));
  }

  async recordResearchGeneralizationOutcome(
    outcome: ResearchGeneralizationOutcomeRecord
  ) {
    const existing = this.generalizationOutcomes.find((candidate) =>
      candidate.research_generalization_outcome_id ===
        outcome.research_generalization_outcome_id
    );
    if (!existing) this.generalizationOutcomes.push(structuredClone(outcome));
    return structuredClone(existing ?? outcome);
  }
}

function graphFixture(
  effects: number[],
  options: {
    baselineCharacters?: string[];
    commitmentOffsetsMs?: number[];
  } = {}
) {
  const protocol = protocolFixture();
  const baselineCharacters = options.baselineCharacters ?? [
    "1", "2", "3", "1", "2", "3"
  ];
  const studies = protocol.study_slots.map((_, index) => assignedStudy(
    protocol,
    index,
    baselineCharacters[index]!,
    options.commitmentOffsetsMs?.[index]
  ));
  return {
    protocol,
    studies,
    studyOutcomes: studies.map((study, index) =>
      studyOutcome(study, effects[index]!)
    )
  };
}

function protocolFixture(): ResearchGeneralizationProtocolRecord {
  return decideResearchGeneralizationProtocol({
    idempotencyKey: "generalization-outcome-protocol",
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
}

function assignedStudy(
  protocol: ResearchGeneralizationProtocolRecord,
  index: number,
  baselineCharacter: string,
  commitmentOffsetMs = (index + 1) * 86_400_000
): ResearchControlStudyRecord {
  const slot = protocol.study_slots[index]!;
  const committedAt = new Date(
    Date.parse(protocol.committed_at) + commitmentOffsetMs
  ).toISOString();
  const sourceArtifactDigest = digest(String.fromCharCode(97 + index));
  return decideResearchControlStudy({
    idempotencyKey: slot.study_idempotency_key,
    baselineSnapshotDigest: digest(baselineCharacter),
    condition: {
      source: {
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: `candidate-${index + 1}`
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: `candidate-version-${index + 1}`
        },
        system_code_ref: {
          record_kind: "system_code",
          id: `system-code-${index + 1}`
        },
        system_code_artifact_digest: sourceArtifactDigest,
        system_code_record_digest: digest("d"),
        research_artifact_protocol: "single_file_python_v1",
        research_artifact_closure_digest: digest("e")
      },
      research_agent: structuredClone(protocol.research_agent),
      paper_comparator: comparatorFixture(),
      paper_evaluation_protocol: structuredClone(
        protocol.paper_evaluation_protocol
      ),
      allocation_policy: structuredClone(protocol.target_allocation_policy),
      allocation_policy_digest: protocol.target_allocation_policy_digest,
      campaign_policy: structuredClone(protocol.campaign_policy)
    },
    replicationIdempotencyKeys: slot.replication_idempotency_keys,
    generalizationAssignment: {
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: protocol.research_generalization_protocol_id
      },
      protocol_digest: protocol.protocol_digest,
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      market_condition: marketCondition(slot.condition_block, committedAt),
      source_system_code_artifact_digest: sourceArtifactDigest
    },
    committedAt
  });
}

function studyOutcome(
  study: ResearchControlStudyRecord,
  effect: number
): ResearchControlStudyOutcomeRecord {
  const differences = Array.from({ length: 6 }, () => effect);
  const adaptivePositive = differences.filter((value) => value > 0).length;
  const staticPositive = differences.filter((value) => value < 0).length;
  const tied = differences.length - adaptivePositive - staticPositive;
  const nonTied = adaptivePositive + staticPositive;
  const mean = round6(effect);
  const pValue = exactTwoSidedSignTestPValue(
    adaptivePositive,
    staticPositive
  );
  const supported = nonTied >= 6 && adaptivePositive > staticPositive &&
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
    replication_results: study.replications.map((replication) => ({
      replication_index: replication.replication_index,
      campaign_ref: { ...replication.campaign_ref },
      campaign_digest: digest("a"),
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: `${replication.campaign_ref.id}-outcome`
      },
      campaign_outcome_digest: digest("b"),
      observed_rate_difference: effect
    })),
    planned_replication_count: 6,
    completed_replication_count: 6,
    adaptive_positive_count: adaptivePositive,
    static_positive_count: staticPositive,
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
    adjudicated_at: new Date(Date.parse(study.committed_at) + 3_600_000)
      .toISOString(),
    study_outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealStudyOutcome(outcome);
  return outcome;
}

function marketCondition(
  block: "long" | "short" | "flat",
  classifiedAt: string
) {
  const observedAt = Date.parse(classifiedAt) - 1_000;
  const end = Math.floor(observedAt / 60_000) * 60_000 - 1;
  const start = end + 1 - 30 * 60_000;
  const closes = block === "long"
    ? Array.from({ length: 30 }, (_, index) => 60_000 + index)
    : block === "short"
      ? Array.from({ length: 30 }, (_, index) => 60_030 - index)
      : Array.from({ length: 30 }, () => 60_000);
  return decideResearchGeneralizationMarketCondition({
    publicKlineWindow: {
      symbol: "BTCUSDT",
      interval: "1m",
      sample_count: 30,
      observed_at: new Date(observedAt).toISOString(),
      closed_window_end_at: new Date(end).toISOString(),
      source: {
        provider_kind: "binance_production_public_market_data",
        source_kind: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        endpoint: "/fapi/v1/klines",
        authority_status: "read_only"
      },
      klines: closes.map((close, index) => ({
        open_time: new Date(start + index * 60_000).toISOString(),
        close_time: new Date(start + (index + 1) * 60_000 - 1)
          .toISOString(),
        close_price: String(close)
      })),
      authority_status: "read_only"
    },
    classifiedAt
  });
}

function resealStudy(study: ResearchControlStudyRecord): void {
  if (study.generalization_assignment) {
    study.generalization_assignment.assignment_digest = exactDigest(
      researchControlStudyGeneralizationAssignmentDigestInput(
        study.generalization_assignment
      )
    );
  }
  study.study_digest = exactDigest(researchControlStudyDigestInput(study));
}

function resealStudyOutcome(outcome: ResearchControlStudyOutcomeRecord): void {
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
}

function comparatorFixture() {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: "promotion-fixture"
    },
    trading_promotion_digest: digest("6"),
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
      id: "paper-fixture"
    }
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

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}
