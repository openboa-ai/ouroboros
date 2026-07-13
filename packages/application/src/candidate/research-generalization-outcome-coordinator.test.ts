import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlStudyOutcomeDigestInput,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { decideResearchControlStudy } from "./research-control-study";
import {
  exactTwoSidedSignTestPValue,
  researchControlStudyOutcomeId
} from "./research-control-study-outcome";
import { decideResearchGeneralizationMarketCondition } from
  "./research-generalization-market-condition";
import { decideResearchGeneralizationOutcome } from
  "./research-generalization-outcome";
import {
  ResearchGeneralizationOutcomeCoordinator
} from "./research-generalization-outcome-coordinator";
import { decideResearchGeneralizationProtocol } from
  "./research-generalization-protocol";

describe("ResearchGeneralizationOutcomeCoordinator", () => {
  it("is up to date without a protocol", async () => {
    const store = new CoordinatorStore();

    await expect(coordinator(store).ensureNextOutcome()).resolves.toEqual({
      status: "up_to_date",
      protocolCount: 0,
      outcomeCount: 0
    });
  });

  it("leaves an incomplete unexpired protocol open", async () => {
    const graph = graphFixture("open", "2026-07-13T00:00:00.000Z");
    const store = new CoordinatorStore({
      protocols: [graph.protocol],
      studies: graph.studies.slice(0, 1),
      studyOutcomes: graph.studyOutcomes.slice(0, 1)
    });

    await expect(coordinator(store).ensureNextOutcome()).resolves.toEqual({
      status: "up_to_date",
      protocolCount: 1,
      outcomeCount: 0
    });
    expect(store.generalizationOutcomes).toEqual([]);
  });

  it("reconciles at most one oldest complete protocol per call", async () => {
    const first = graphFixture("first", "2026-07-01T00:00:00.000Z");
    const second = graphFixture("second", "2026-07-02T00:00:00.000Z");
    const store = new CoordinatorStore({
      protocols: [second.protocol, first.protocol],
      studies: [...second.studies, ...first.studies],
      studyOutcomes: [...second.studyOutcomes, ...first.studyOutcomes]
    });
    const worker = coordinator(store, "2026-07-20T00:00:00.000Z");

    const firstResult = await worker.ensureNextOutcome();
    expect(firstResult).toMatchObject({
      status: "ensured",
      protocolId: first.protocol.research_generalization_protocol_id,
      inferenceStatus: "generalization_supported"
    });
    expect(store.generalizationOutcomes).toHaveLength(1);
    expect(store.generalizationOutcomes[0]!.adjudicated_at).toBe(
      latestOutcomeTime(first.studyOutcomes)
    );

    const secondResult = await worker.ensureNextOutcome();
    expect(secondResult).toMatchObject({
      status: "ensured",
      protocolId: second.protocol.research_generalization_protocol_id
    });
    expect(store.generalizationOutcomes).toHaveLength(2);
    await expect(worker.ensureNextOutcome()).resolves.toEqual({
      status: "up_to_date",
      protocolCount: 2,
      outcomeCount: 2
    });
  });

  it("closes an expired incomplete protocol at deterministic evidence time", async () => {
    const graph = graphFixture("expired", "2026-04-01T00:00:00.000Z");
    const store = new CoordinatorStore({
      protocols: [graph.protocol],
      studies: graph.studies.slice(0, 2),
      studyOutcomes: graph.studyOutcomes.slice(0, 2)
    });

    const result = await coordinator(
      store,
      graph.protocol.timing_policy.collection_deadline_at
    ).ensureNextOutcome();

    expect(result).toMatchObject({
      status: "ensured",
      protocolId: graph.protocol.research_generalization_protocol_id,
      inferenceStatus: "insufficient_generalization_evidence"
    });
    expect(store.generalizationOutcomes[0]).toMatchObject({
      adjudicated_at: graph.protocol.timing_policy.collection_deadline_at,
      completed_study_count: 2,
      missing_study_count: 4
    });
  });

  it("replays an existing exact outcome without publishing another", async () => {
    const graph = graphFixture("existing", "2026-07-01T00:00:00.000Z");
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: latestOutcomeTime(graph.studyOutcomes)
    });
    const store = new CoordinatorStore({
      protocols: [graph.protocol],
      studies: graph.studies,
      studyOutcomes: graph.studyOutcomes,
      generalizationOutcomes: [outcome]
    });

    await expect(coordinator(store).ensureNextOutcome()).resolves.toEqual({
      status: "up_to_date",
      protocolCount: 1,
      outcomeCount: 1
    });
    expect(store.recordCount).toBe(0);
  });

  it("fails closed on an outcome whose protocol graph is absent", async () => {
    const graph = graphFixture("orphan", "2026-07-01T00:00:00.000Z");
    const outcome = decideResearchGeneralizationOutcome({
      ...graph,
      adjudicatedAt: latestOutcomeTime(graph.studyOutcomes)
    });
    const store = new CoordinatorStore({
      generalizationOutcomes: [outcome]
    });

    await expect(coordinator(store).ensureNextOutcome()).rejects.toMatchObject({
      code: "research_generalization_outcome_coordination_failed"
    });
  });

  it("converges concurrent workers on deterministic outcome bytes", async () => {
    const graph = graphFixture("race", "2026-07-01T00:00:00.000Z");
    const store = new CoordinatorStore({
      protocols: [graph.protocol],
      studies: graph.studies,
      studyOutcomes: graph.studyOutcomes
    });

    const [left, right] = await Promise.all([
      coordinator(store, "2026-07-20T00:00:00.000Z").ensureNextOutcome(),
      coordinator(store, "2026-07-20T00:00:01.000Z").ensureNextOutcome()
    ]);

    expect(left).toEqual(right);
    expect(store.generalizationOutcomes).toHaveLength(1);
    expect(store.generalizationOutcomes[0]!.adjudicated_at).toBe(
      latestOutcomeTime(graph.studyOutcomes)
    );
  });
});

class CoordinatorStore {
  protocols: ResearchGeneralizationProtocolRecord[];
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  generalizationOutcomes: ResearchGeneralizationOutcomeRecord[];
  recordCount = 0;

  constructor(input: {
    protocols?: ResearchGeneralizationProtocolRecord[];
    studies?: ResearchControlStudyRecord[];
    studyOutcomes?: ResearchControlStudyOutcomeRecord[];
    generalizationOutcomes?: ResearchGeneralizationOutcomeRecord[];
  } = {}) {
    this.protocols = structuredClone(input.protocols ?? []);
    this.studies = structuredClone(input.studies ?? []);
    this.studyOutcomes = structuredClone(input.studyOutcomes ?? []);
    this.generalizationOutcomes = structuredClone(
      input.generalizationOutcomes ?? []
    );
  }

  root() { return "generalization-outcome-coordinator"; }

  async listResearchGeneralizationProtocols() {
    return structuredClone(this.protocols);
  }

  async listResearchControlStudies() {
    return structuredClone(this.studies);
  }

  async listResearchControlStudyOutcomes() {
    return structuredClone(this.studyOutcomes);
  }

  async listResearchGeneralizationOutcomes() {
    return structuredClone(this.generalizationOutcomes);
  }

  async getResearchGeneralizationProtocol(id: string) {
    return structuredClone(this.protocols.find((protocol) =>
      protocol.research_generalization_protocol_id === id
    ));
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
    this.recordCount += 1;
    await Promise.resolve();
    const existing = this.generalizationOutcomes.find((candidate) =>
      candidate.research_generalization_outcome_id ===
        outcome.research_generalization_outcome_id
    );
    if (!existing) this.generalizationOutcomes.push(structuredClone(outcome));
    return structuredClone(existing ?? outcome);
  }
}

function coordinator(
  store: CoordinatorStore,
  now = "2026-07-13T12:00:00.000Z"
) {
  return new ResearchGeneralizationOutcomeCoordinator({
    store: store as unknown as OuroborosStorePort,
    now: () => now
  });
}

function graphFixture(suffix: string, committedAt: string) {
  const protocol = decideResearchGeneralizationProtocol({
    idempotencyKey: `generalization-coordinator-${suffix}`,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    campaignPolicy: campaignPolicy(),
    committedAt
  });
  const baselines = ["1", "2", "3", "1", "2", "3"];
  const studies = protocol.study_slots.map((slot, index) => {
    const studyCommittedAt = new Date(
      Date.parse(committedAt) + (index + 1) * 86_400_000
    ).toISOString();
    const sourceDigest = digest(String.fromCharCode(97 + index));
    return decideResearchControlStudy({
      idempotencyKey: slot.study_idempotency_key,
      baselineSnapshotDigest: digest(baselines[index]!),
      condition: {
        source: sourceFixture(sourceDigest, `${suffix}-${index}`),
        research_agent: structuredClone(protocol.research_agent),
        paper_comparator: comparatorFixture(suffix),
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
        market_condition: marketCondition(
          slot.condition_block,
          studyCommittedAt
        ),
        source_system_code_artifact_digest: sourceDigest
      },
      committedAt: studyCommittedAt
    });
  });
  return {
    protocol,
    studies,
    studyOutcomes: studies.map((study) => studyOutcome(study, 1))
  };
}

function studyOutcome(
  study: ResearchControlStudyRecord,
  effect: number
): ResearchControlStudyOutcomeRecord {
  const adaptivePositive = effect > 0 ? 6 : 0;
  const staticPositive = effect < 0 ? 6 : 0;
  const tied = effect === 0 ? 6 : 0;
  const nonTied = adaptivePositive + staticPositive;
  const pValue = exactTwoSidedSignTestPValue(
    adaptivePositive,
    staticPositive
  );
  const supported = adaptivePositive === 6 && pValue <= 0.05;
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
    mean_rate_difference: effect,
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
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
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

function sourceFixture(artifactDigest: string, suffix: string) {
  return {
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `candidate-${suffix}`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `candidate-version-${suffix}`
    },
    system_code_ref: {
      record_kind: "system_code",
      id: `system-code-${suffix}`
    },
    system_code_artifact_digest: artifactDigest,
    system_code_record_digest: digest("d"),
    research_artifact_protocol: "single_file_python_v1" as const,
    research_artifact_closure_digest: digest("e")
  };
}

function comparatorFixture(suffix: string) {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: `promotion-${suffix}`
    },
    trading_promotion_digest: digest("6"),
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `champion-${suffix}`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `champion-version-${suffix}`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `paper-${suffix}`
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

function latestOutcomeTime(outcomes: ResearchControlStudyOutcomeRecord[]) {
  return outcomes.reduce((latest, outcome) =>
    outcome.adjudicated_at > latest ? outcome.adjudicated_at : latest,
  "1970-01-01T00:00:00.000Z");
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
