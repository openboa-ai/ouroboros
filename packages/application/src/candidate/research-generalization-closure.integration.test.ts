import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlStudyOutcomeDigestInput,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  CandidateArenaResearchAllocationService,
  resolveCandidateArenaResearchAllocationPolicy
} from "./research-allocation";
import {
  exactTwoSidedSignTestPValue,
  researchControlStudyOutcomeId
} from "./research-control-study-outcome";
import { ResearchControlStudyService } from "./research-control-study";
import { decideResearchGeneralizationMarketCondition } from
  "./research-generalization-market-condition";
import { ResearchGeneralizationOutcomeService } from
  "./research-generalization-outcome";
import { ResearchGeneralizationPolicyDecisionService } from
  "./research-generalization-policy-decision";
import { ResearchGeneralizationProtocolService } from
  "./research-generalization-protocol";
import { buildResearchGeneralizationReadModel } from
  "./research-generalization-read-model";

describe("ResearchGeneralization contract closure", () => {
  it("proves supported policy application through a completed tick", async () => {
    const closure = await runClosure("supported");
    const basis = closure.allocation.allocation_policy_basis;
    if (basis.basis_kind !== "research_generalization_policy_decision") {
      throw new Error("expected generalized policy basis");
    }

    expect(closure.protocol.research_agent.provider).toBe("fixture");
    expect(closure.outcome).toMatchObject({
      inference_status: "generalization_supported",
      completed_study_count: 6,
      non_tied_study_count: 6,
      harmful_condition_blocks: [],
      policy_decision_eligibility:
        "eligible_for_separate_generalization_policy_decision"
    });
    expect(closure.decision).toMatchObject({
      decision_status: "approved",
      effective_default_mode: "adaptive_default",
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_policy_only"
    });
    expect(closure.resolved).toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: {
        basis_kind: "research_generalization_policy_decision",
        policy_decision_ref: {
          record_kind: "research_generalization_policy_decision",
          id: closure.decision
            .research_generalization_policy_decision_id
        },
        policy_decision_digest: closure.decision.policy_decision_digest,
        generalization_outcome_ref: {
          record_kind: "research_generalization_outcome",
          id: closure.outcome.research_generalization_outcome_id
        },
        generalization_outcome_digest: closure.outcome.outcome_digest
      }
    });
    expect(basis.policy_decision_ref.id).toBe(
      closure.decision.research_generalization_policy_decision_id
    );
    expect(basis.generalization_outcome_ref.id).toBe(
      closure.outcome.research_generalization_outcome_id
    );
    expect(closure.projection.effective_policy_decision).toEqual({
      research_generalization_policy_decision_id:
        closure.decision.research_generalization_policy_decision_id,
      research_generalization_protocol_id:
        closure.protocol.research_generalization_protocol_id,
      research_generalization_outcome_id:
        closure.outcome.research_generalization_outcome_id,
      effective_default_mode: "adaptive_default",
      decided_at: closure.decision.decided_at,
      application: {
        application_status: "completed_tick",
        allocation_count: 1,
        completed_tick_count: 1,
        latest_allocation: {
          candidate_arena_research_allocation_id:
            closure.allocation.candidate_arena_research_allocation_id,
          tick_id: closure.tick.tick_id,
          allocated_at: closure.allocation.allocated_at,
          completed_at: closure.tick.completed_at
        }
      },
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_policy_only"
    });
    expect(closure.allocation).toMatchObject({
      research_scheduling_authority: true,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    });
    expect(closure.tick.authority_status).toBe("not_live");

    const replayStore = closure.store.reopen();
    const replay = buildResearchGeneralizationReadModel({
      protocols: (await replayStore.listResearchGeneralizationProtocols())
        .reverse(),
      studies: (await replayStore.listResearchControlStudies()).reverse(),
      studyOutcomes: (await replayStore.listResearchControlStudyOutcomes())
        .reverse(),
      outcomes: (await replayStore.listResearchGeneralizationOutcomes())
        .reverse(),
      decisions: (await replayStore
        .listResearchGeneralizationPolicyDecisions()).reverse(),
      allocations: (await replayStore
        .listCandidateArenaResearchAllocations()).reverse(),
      ticks: (await replayStore.listCandidateArenaTicks()).reverse()
    });
    expect(replay).toEqual(closure.projection);
  });

  it("keeps a harmful block negative without inferring static policy", async () => {
    const closure = await runClosure("harmful_block");

    expect(closure.outcome).toMatchObject({
      inference_status: "generalization_not_supported",
      harmful_condition_blocks: ["flat"],
      policy_decision_eligibility: "not_eligible",
      next_action: "retain_negative_generalization_evidence"
    });
    expect(closure.decision).toMatchObject({
      decision_status: "not_approved",
      effective_default_mode: null
    });
    expect(JSON.stringify(closure.decision)).not.toContain("static_control");
    expect(closure.resolved).toEqual({
      allocationMode: "adaptive_default",
      allocationPolicyBasis: { basis_kind: "repository_default" }
    });
    expect(closure.allocation).toMatchObject({
      allocation_mode: "adaptive_default",
      allocation_policy_basis: { basis_kind: "repository_default" }
    });
    expect(closure.projection.latest_policy_decision).toMatchObject({
      research_generalization_policy_decision_id:
        closure.decision.research_generalization_policy_decision_id,
      decision_status: "not_approved",
      effective_default_mode: null
    });
    expect(closure.projection.effective_policy_decision).toBeNull();
    expect(JSON.stringify(closure.projection)).not.toContain("static_control");
  });
});

type ClosureKind = "supported" | "harmful_block";

async function runClosure(kind: ClosureKind) {
  let store = new RestartStableClosureStore();
  const port = () => store as unknown as OuroborosStorePort;
  const protocol = await new ResearchGeneralizationProtocolService({
    store: port(),
    now: () => "2026-07-13T00:00:00.000Z"
  }).commit({
    idempotencyKey: `generalization-closure-${kind}`,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture",
      model: "deterministic-contract-proof",
      permission_policy: "fixture_only"
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    campaignPolicy: campaignPolicy()
  });
  const effects = kind === "supported"
    ? [1, 0.8, 0.6, 0.4, 0.2, 0.1]
    : [1, 0.8, 0.6, 0.4, -0.1, -0.3];
  const baselineCharacters = ["1", "2", "3", "1", "2", "3"];
  const studies: ResearchControlStudyRecord[] = [];
  const studyOutcomes: ResearchControlStudyOutcomeRecord[] = [];
  for (let index = 0; index < protocol.study_slots.length; index += 1) {
    const committedAt = new Date(
      Date.parse(protocol.committed_at) + (index + 1) * 86_400_000
    ).toISOString();
    const study = await new ResearchControlStudyService({
      store: port(),
      now: () => committedAt
    }).commit(studyCommitRequest(
      protocol,
      index,
      baselineCharacters[index]!
    ));
    const studyOutcome = terminalStudyOutcome(study, effects[index]!);
    await store.recordResearchControlStudyOutcome(studyOutcome);
    studies.push(study);
    studyOutcomes.push(studyOutcome);
  }

  store = store.reopen();
  const outcome = await new ResearchGeneralizationOutcomeService({
    store: port(),
    now: () => "2026-07-20T00:00:00.000Z"
  }).adjudicate({ protocol, studies, studyOutcomes });

  store = store.reopen();
  const decision = await new ResearchGeneralizationPolicyDecisionService({
    store: port(),
    now: () => "2026-07-20T00:00:01.000Z"
  }).decide({ protocol, outcome });

  store = store.reopen();
  const resolved = await resolveCandidateArenaResearchAllocationPolicy({
    store: port()
  });
  const allocation = await new CandidateArenaResearchAllocationService({
    store: port(),
    now: () => "2026-07-20T00:00:02.000Z"
  }).allocate({
    tickId: `generalization-closure-${kind}-tick`,
    ...resolved,
    findingClusters: [],
    latestTicks: []
  });
  const tick = completedTick(allocation);
  await store.recordCandidateArenaTick(tick);

  store = store.reopen();
  const projection = buildResearchGeneralizationReadModel({
    protocols: await store.listResearchGeneralizationProtocols(),
    studies: await store.listResearchControlStudies(),
    studyOutcomes: await store.listResearchControlStudyOutcomes(),
    outcomes: await store.listResearchGeneralizationOutcomes(),
    decisions: await store.listResearchGeneralizationPolicyDecisions(),
    allocations: await store.listCandidateArenaResearchAllocations(),
    ticks: await store.listCandidateArenaTicks()
  });
  return {
    store,
    protocol,
    studies,
    studyOutcomes,
    outcome,
    decision,
    resolved,
    allocation,
    tick,
    projection
  };
}

function studyCommitRequest(
  protocol: ResearchGeneralizationProtocolRecord,
  index: number,
  baselineCharacter: string
) {
  const slot = protocol.study_slots[index]!;
  const committedAt = new Date(
    Date.parse(protocol.committed_at) + (index + 1) * 86_400_000
  ).toISOString();
  const sourceArtifactDigest = digest(String.fromCharCode(97 + index));
  return {
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
        research_artifact_protocol: "single_file_python_v1" as const,
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
    replicationIdempotencyKeys: [...slot.replication_idempotency_keys],
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
    }
  };
}

function terminalStudyOutcome(
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
    inference_status: supported
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

function completedTick(
  allocation: CandidateArenaResearchAllocationRecord
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${allocation.tick_id}`,
    tick_id: allocation.tick_id,
    started_at: "2026-07-20T00:00:03.000Z",
    completed_at: "2026-07-20T00:00:04.000Z",
    status: "completed",
    created_candidate_refs: [],
    direction_results: [],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
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

interface ClosureStoreState {
  protocols: ResearchGeneralizationProtocolRecord[];
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  outcomes: ResearchGeneralizationOutcomeRecord[];
  decisions: ResearchGeneralizationPolicyDecisionRecord[];
  allocations: CandidateArenaResearchAllocationRecord[];
  ticks: CandidateArenaTickRecord[];
}

class RestartStableClosureStore {
  private readonly state: ClosureStoreState;

  constructor(state?: ClosureStoreState) {
    this.state = structuredClone(state ?? {
      protocols: [],
      studies: [],
      studyOutcomes: [],
      outcomes: [],
      decisions: [],
      allocations: [],
      ticks: []
    });
  }

  root() { return "research-generalization-closure"; }

  reopen() { return new RestartStableClosureStore(this.state); }

  async listResearchGeneralizationProtocols() {
    return structuredClone(this.state.protocols);
  }

  async getResearchGeneralizationProtocol(id: string) {
    return cloneFound(this.state.protocols.find((record) =>
      record.research_generalization_protocol_id === id
    ));
  }

  async recordResearchGeneralizationProtocol(
    record: ResearchGeneralizationProtocolRecord
  ) {
    return recordOnce(
      this.state.protocols,
      record,
      (candidate) => candidate.research_generalization_protocol_id
    );
  }

  async listResearchControlStudies() {
    return structuredClone(this.state.studies);
  }

  async getResearchControlStudy(id: string) {
    return cloneFound(this.state.studies.find((record) =>
      record.research_control_study_id === id
    ));
  }

  async recordResearchControlStudy(record: ResearchControlStudyRecord) {
    return recordOnce(
      this.state.studies,
      record,
      (candidate) => candidate.research_control_study_id
    );
  }

  async listResearchControlStudyOutcomes() {
    return structuredClone(this.state.studyOutcomes);
  }

  async getResearchControlStudyOutcome(id: string) {
    return cloneFound(this.state.studyOutcomes.find((record) =>
      record.research_control_study_outcome_id === id
    ));
  }

  async recordResearchControlStudyOutcome(
    record: ResearchControlStudyOutcomeRecord
  ) {
    return recordOnce(
      this.state.studyOutcomes,
      record,
      (candidate) => candidate.research_control_study_outcome_id
    );
  }

  async listResearchGeneralizationOutcomes() {
    return structuredClone(this.state.outcomes);
  }

  async getResearchGeneralizationOutcome(id: string) {
    return cloneFound(this.state.outcomes.find((record) =>
      record.research_generalization_outcome_id === id
    ));
  }

  async recordResearchGeneralizationOutcome(
    record: ResearchGeneralizationOutcomeRecord
  ) {
    return recordOnce(
      this.state.outcomes,
      record,
      (candidate) => candidate.research_generalization_outcome_id
    );
  }

  async listResearchGeneralizationPolicyDecisions() {
    return structuredClone(this.state.decisions);
  }

  async getResearchGeneralizationPolicyDecision(id: string) {
    return cloneFound(this.state.decisions.find((record) =>
      record.research_generalization_policy_decision_id === id
    ));
  }

  async recordResearchGeneralizationPolicyDecision(
    record: ResearchGeneralizationPolicyDecisionRecord
  ) {
    return recordOnce(
      this.state.decisions,
      record,
      (candidate) =>
        candidate.research_generalization_policy_decision_id
    );
  }

  async listResearchAllocationPolicyDecisions(): Promise<
    ResearchAllocationPolicyDecisionRecord[]
  > {
    return [];
  }

  async listCandidateArenaResearchAllocations() {
    return structuredClone(this.state.allocations);
  }

  async getCandidateArenaResearchAllocation(id: string) {
    return cloneFound(this.state.allocations.find((record) =>
      record.candidate_arena_research_allocation_id === id
    ));
  }

  async recordCandidateArenaResearchAllocation(
    record: CandidateArenaResearchAllocationRecord
  ) {
    return recordOnce(
      this.state.allocations,
      record,
      (candidate) => candidate.candidate_arena_research_allocation_id
    );
  }

  async listCandidateArenaTicks() {
    return structuredClone(this.state.ticks);
  }

  async recordCandidateArenaTick(record: CandidateArenaTickRecord) {
    return recordOnce(
      this.state.ticks,
      record,
      (candidate) => candidate.candidate_arena_tick_id
    );
  }
}

function recordOnce<T>(
  records: T[],
  record: T,
  identity: (value: T) => string
): T {
  const existing = records.find((candidate) =>
    identity(candidate) === identity(record)
  );
  if (!existing) records.push(structuredClone(record));
  return structuredClone(existing ?? record);
}

function cloneFound<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
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
