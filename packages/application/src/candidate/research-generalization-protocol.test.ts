import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  decideResearchGeneralizationProtocol,
  ResearchGeneralizationProtocolDecisionError,
  ResearchGeneralizationProtocolService,
  ResearchGeneralizationProtocolServiceError,
  researchGeneralizationProtocolId
} from "./research-generalization-protocol";
import { researchControlStudyId } from "./research-control-study";

describe("ResearchGeneralizationProtocol application", () => {
  it("precommits six exact condition-blocked studies and their campaigns", () => {
    const protocol = decideResearchGeneralizationProtocol(input());

    expect(protocol.research_generalization_protocol_id).toBe(
      researchGeneralizationProtocolId("adaptive-generalization-v1")
    );
    expect(protocol.condition_blocks).toEqual([
      { condition_block: "long", required_study_count: 2 },
      { condition_block: "short", required_study_count: 2 },
      { condition_block: "flat", required_study_count: 2 }
    ]);
    expect(protocol.study_slots).toHaveLength(6);
    expect(protocol.study_slots.map((slot) => ({
      slot: slot.slot_index,
      block: slot.condition_block,
      blockIndex: slot.condition_block_study_index,
      study: slot.study_ref.id,
      replications: slot.replication_idempotency_keys.length
    }))).toEqual([
      expectedSlot(1, "long", 1),
      expectedSlot(2, "long", 2),
      expectedSlot(3, "short", 1),
      expectedSlot(4, "short", 2),
      expectedSlot(5, "flat", 1),
      expectedSlot(6, "flat", 2)
    ]);
    expect(protocol.study_slots[0]?.replication_idempotency_keys).toEqual(
      Array.from({ length: 6 }, (_, index) =>
        "adaptive-generalization-v1:long:1:replication:" + (index + 1)
      )
    );
  });

  it("freezes timing, resource, analysis, and authority limits", () => {
    const protocol = decideResearchGeneralizationProtocol(input());

    expect(protocol.timing_policy).toEqual({
      policy_version: "research_generalization_timing_v1",
      minimum_study_commitment_interval_ms: 86_400_000,
      maximum_collection_duration_ms: 7_776_000_000,
      collection_deadline_at: "2026-10-11T00:00:00.000Z",
      expiry_policy: "close_with_missing_slots"
    });
    expect(protocol.study_policy).toEqual({
      policy_version: "research_generalization_study_v1",
      replication_count_per_study: 6,
      tick_count_per_arm: 1,
      maximum_baseline_regular_file_count: 10_000,
      maximum_baseline_total_bytes: 1_000_000_000,
      source_baseline_reuse_policy: "unique_within_condition_block"
    });
    expect(protocol.analysis_policy).toEqual({
      policy_version: "equal_block_exact_sign_test_v1",
      primary_estimand:
        "equal_block_mean_adaptive_minus_static_qualified_discovery_rate",
      block_weighting: "equal_precommitted_condition_blocks",
      significance_method: "two_sided_exact_sign_test",
      alpha: 0.05,
      minimum_terminal_study_count: 6,
      minimum_non_tied_study_count: 6,
      minimum_distinct_baseline_count: 3,
      tie_policy: "exclude_from_sign_test_include_in_mean",
      missing_block_policy: "insufficient_generalization_evidence",
      harmful_block_policy: "non_positive_block_blocks_support"
    });
    expect(protocol).toMatchObject({
      research_scheduling_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    });
  });

  it("replays byte-exact protocol identity and digests", () => {
    const request = input();
    const first = decideResearchGeneralizationProtocol(request);
    const replay = decideResearchGeneralizationProtocol(
      structuredClone(request)
    );

    expect(replay).toEqual(first);
    expect(first.target_allocation_policy_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.research_agent.identity_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.paper_evaluation_protocol.protocol_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.protocol_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it.each([
    ["blank key", (value: any) => {
      value.idempotencyKey = " ";
    }],
    ["invalid time", (value: any) => {
      value.committedAt = "2026-07-13 00:00:00";
    }],
    ["unsupported provider permission", (value: any) => {
      value.researchAgent.permission_policy = "full_access";
    }],
    ["unbound paper protocol", (value: any) => {
      value.paperEvaluationProtocol = {
        protocol_status: "unavailable",
        reason: "paper_configuration_unavailable_at_commitment"
      };
    }],
    ["changed campaign bounds", (value: any) => {
      value.campaignPolicy.tick_count_per_arm = 2;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = input();
    mutate(value);
    expect(() => decideResearchGeneralizationProtocol(value as never))
      .toThrow(ResearchGeneralizationProtocolDecisionError);
  });

  it("persists once and rejects a changed replay", async () => {
    const store = new ProtocolStore();
    const service = new ResearchGeneralizationProtocolService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-13T00:00:00.000Z"
    });
    const request = requestInput();

    const first = await service.commit(request);
    await expect(service.commit(request)).resolves.toEqual(first);
    await expect(service.commit({
      ...request,
      researchAgent: {
        ...request.researchAgent,
        model: "different-model"
      }
    })).rejects.toMatchObject({
      code: "research_generalization_protocol_conflict"
    } satisfies Partial<ResearchGeneralizationProtocolServiceError>);
    expect(store.protocols).toEqual([first]);
  });
});

class ProtocolStore {
  protocols: ResearchGeneralizationProtocolRecord[] = [];

  root() { return "protocol"; }

  async getResearchGeneralizationProtocol(id: string) {
    return structuredClone(this.protocols.find((protocol) =>
      protocol.research_generalization_protocol_id === id
    ));
  }

  async recordResearchGeneralizationProtocol(
    protocol: ResearchGeneralizationProtocolRecord
  ) {
    const existing = this.protocols.find((candidate) =>
      candidate.research_generalization_protocol_id ===
        protocol.research_generalization_protocol_id
    );
    if (!existing) this.protocols.push(structuredClone(protocol));
    return structuredClone(existing ?? protocol);
  }
}

function expectedSlot(
  slot: number,
  block: "long" | "short" | "flat",
  blockIndex: number
) {
  const key = `adaptive-generalization-v1:${block}:${blockIndex}`;
  return {
    slot,
    block,
    blockIndex,
    study: researchControlStudyId(key),
    replications: 6
  };
}

function input() {
  return {
    ...requestInput(),
    committedAt: "2026-07-13T00:00:00.000Z"
  };
}

function requestInput() {
  return {
    idempotencyKey: "adaptive-generalization-v1",
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent: {
      provider: "fixture" as const,
      model: "scripted-fixture",
      permission_policy: "fixture_only" as const
    },
    paperEvaluationProtocol: boundPaperProtocolInput(),
    campaignPolicy: campaignPolicy()
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

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
