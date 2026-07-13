import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../ports/store";
import type { ResearchControlStudyRecord } from "@ouroboros/domain";
import {
  decideResearchControlCampaign,
  researchControlCampaignId
} from "./research-control-campaign";
import {
  decideResearchControlStudy,
  researchControlStudyConditionFromCampaign,
  ResearchControlStudyDecisionError,
  ResearchControlStudyService,
  ResearchControlStudyServiceError
} from "./research-control-study";
import { decideResearchGeneralizationProtocol } from
  "./research-generalization-protocol";
import { decideResearchGeneralizationMarketCondition } from
  "./research-generalization-market-condition";

describe("ResearchControlStudy application", () => {
  it("precommits deterministic campaign identities and one exact condition", () => {
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const { condition_digest: _digest, ...conditionInput } = condition;
    const study = decideResearchControlStudy({
      idempotencyKey: "adaptive-study-001",
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: replicationKeys(),
      committedAt: "2026-07-12T09:00:00.000Z"
    });

    expect(study.replications).toHaveLength(6);
    expect(study.replications.map((entry, index) => ({
      index: entry.replication_index,
      id: entry.campaign_ref.id,
      baseline: entry.expected_baseline_snapshot_digest
    }))).toEqual(replicationKeys().map((key, index) => ({
      index: index + 1,
      id: researchControlCampaignId(key),
      baseline: campaign.baseline.snapshot_digest
    })));
    expect(study.condition).toEqual(condition);
  });

  it("projects the same condition across campaign identity and baseline changes", () => {
    const first = campaignFixture();
    const second = campaignFixture({
      idempotencyKey: "different-campaign",
      baselineDigest: digest("8")
    });

    expect(researchControlStudyConditionFromCampaign(second)).toEqual(
      researchControlStudyConditionFromCampaign(first)
    );
  });

  it("seals one exact optional generalization protocol assignment", () => {
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const protocol = generalizationProtocol(campaign);
    const slot = protocol.study_slots[0]!;
    const marketCondition = generalizationMarketCondition();
    const { condition_digest: _digest, ...conditionInput } = condition;
    const study = decideResearchControlStudy({
      idempotencyKey: slot.study_idempotency_key,
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
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
        market_condition: marketCondition,
        source_system_code_artifact_digest:
          campaign.source.system_code_artifact_digest
      },
      committedAt: "2026-07-12T09:00:00.000Z"
    });

    expect(study.research_control_study_id).toBe(slot.study_ref.id);
    expect(study.generalization_assignment).toMatchObject({
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: protocol.research_generalization_protocol_id
      },
      protocol_digest: protocol.protocol_digest,
      slot_index: 1,
      condition_block: "long",
      condition_block_study_index: 1,
      market_condition: marketCondition,
      source_system_code_artifact_digest:
        campaign.source.system_code_artifact_digest,
      assigned_at: "2026-07-12T09:00:00.000Z"
    });
    expect(study.generalization_assignment?.assignment_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("keeps historical same-baseline studies unassigned", () => {
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const { condition_digest: _digest, ...conditionInput } = condition;

    expect(decideResearchControlStudy({
      idempotencyKey: "historical-gate-one",
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: replicationKeys(),
      committedAt: "2026-07-12T09:00:00.000Z"
    })).not.toHaveProperty("generalization_assignment");
  });

  it.each([
    ["condition block drift", (assignment: any) => {
      assignment.condition_block = "short";
    }],
    ["source artifact drift", (assignment: any) => {
      assignment.source_system_code_artifact_digest = digest("9");
    }],
    ["classification after assignment", (assignment: any) => {
      assignment.market_condition.classified_at = "2026-07-12T09:00:01.000Z";
    }]
  ])("rejects generalization assignment %s", (_label, mutate) => {
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const protocol = generalizationProtocol(campaign);
    const slot = protocol.study_slots[0]!;
    const { condition_digest: _digest, ...conditionInput } = condition;
    const assignment = {
      protocol_ref: {
        record_kind: "research_generalization_protocol" as const,
        id: protocol.research_generalization_protocol_id
      },
      protocol_digest: protocol.protocol_digest,
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index,
      market_condition: generalizationMarketCondition(),
      source_system_code_artifact_digest:
        campaign.source.system_code_artifact_digest
    };
    mutate(assignment);

    expect(() => decideResearchControlStudy({
      idempotencyKey: slot.study_idempotency_key,
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: slot.replication_idempotency_keys,
      generalizationAssignment: assignment as never,
      committedAt: "2026-07-12T09:00:00.000Z"
    })).toThrow(ResearchControlStudyDecisionError);
  });

  it.each([
    ["duplicate replication keys", (input: any) => {
      input.replicationIdempotencyKeys[1] = input.replicationIdempotencyKeys[0];
    }],
    ["too few replication keys", (input: any) => {
      input.replicationIdempotencyKeys.pop();
    }],
    ["unbound protocol", (input: any) => {
      input.condition.paper_evaluation_protocol = {
        protocol_status: "unavailable",
        reason: "paper_configuration_unavailable_at_commitment"
      };
    }],
    ["invalid committed time", (input: any) => {
      input.committedAt = "2026-07-12 09:00:00";
    }]
  ])("rejects %s", (_label, mutate) => {
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const { condition_digest: _digest, ...conditionInput } = condition;
    const input = {
      idempotencyKey: "adaptive-study-001",
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: replicationKeys(),
      committedAt: "2026-07-12T09:00:00.000Z"
    };
    mutate(input);
    expect(() => decideResearchControlStudy(input as never))
      .toThrow(ResearchControlStudyDecisionError);
  });

  it("persists exact study once and rejects changed replay input", async () => {
    const store = new StudyStore();
    const campaign = campaignFixture();
    const condition = researchControlStudyConditionFromCampaign(campaign);
    const { condition_digest: _digest, ...conditionInput } = condition;
    const service = new ResearchControlStudyService({
      store: port(store),
      now: () => "2026-07-12T09:00:00.000Z"
    });
    const request = {
      idempotencyKey: "adaptive-study-001",
      baselineSnapshotDigest: campaign.baseline.snapshot_digest,
      condition: conditionInput,
      replicationIdempotencyKeys: replicationKeys()
    };

    const first = await service.commit(request);
    await expect(service.commit(request)).resolves.toEqual(first);
    await expect(service.commit({
      ...request,
      replicationIdempotencyKeys: [
        ...replicationKeys().slice(0, 5),
        "changed-replication"
      ]
    })).rejects.toMatchObject({
      code: "research_control_study_conflict"
    } satisfies Partial<ResearchControlStudyServiceError>);
    expect(store.studies).toEqual([first]);
  });
});

class StudyStore {
  studies: ResearchControlStudyRecord[] = [];

  root() { return "study"; }

  async getResearchControlStudy(id: string) {
    return structuredClone(this.studies.find((study) =>
      study.research_control_study_id === id
    ));
  }

  async recordResearchControlStudy(study: ResearchControlStudyRecord) {
    const existing = this.studies.find((candidate) =>
      candidate.research_control_study_id === study.research_control_study_id
    );
    if (!existing) this.studies.push(structuredClone(study));
    return structuredClone(existing ?? study);
  }
}

function campaignFixture(overrides: {
  idempotencyKey?: string;
  baselineDigest?: string;
} = {}) {
  return decideResearchControlCampaign({
    idempotencyKey: overrides.idempotencyKey ?? "campaign-template",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: overrides.baselineDigest ?? digest("1"),
      regular_file_count: 40,
      total_bytes: 40_000,
      exclusion_policy: "research_control_campaign_evidence_only"
    },
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "candidate-fixture"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "candidate-version-fixture"
      },
      system_code_ref: {
        record_kind: "system_code",
        id: "system-code-fixture"
      },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("2"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("3")
    },
    researchAgent: {
      id: "fixture",
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    paperComparator: tradingReviewComparator(),
    paperEvaluationProtocol: boundPaperProtocolInput(),
    tickCountPerArm: 1,
    maximumBaselineRegularFileCount: 10_000,
    maximumBaselineTotalBytes: 1_000_000_000,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function tradingReviewComparator() {
  return {
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

function replicationKeys(): string[] {
  return Array.from({ length: 6 }, (_, index) =>
    `adaptive-study-001-replication-${index + 1}`
  );
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function generalizationProtocol(campaign: ReturnType<typeof campaignFixture>) {
  const { identity_digest: _identityDigest, ...researchAgent } =
    campaign.research_agent;
  if (campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("expected bound protocol");
  }
  const { protocol_digest: _protocolDigest, ...paperEvaluationProtocol } =
    campaign.paper_evaluation_protocol;
  return decideResearchGeneralizationProtocol({
    idempotencyKey: "generalization-protocol",
    targetAllocationPolicy: campaign.allocation_policy,
    researchAgent,
    paperEvaluationProtocol,
    campaignPolicy: campaign.policy,
    committedAt: "2026-07-12T08:00:00.000Z"
  });
}

function generalizationMarketCondition() {
  const start = Date.parse("2026-07-12T08:00:00.000Z");
  return decideResearchGeneralizationMarketCondition({
    publicKlineWindow: {
      symbol: "BTCUSDT",
      interval: "1m",
      sample_count: 30,
      observed_at: "2026-07-12T08:30:30.000Z",
      closed_window_end_at: "2026-07-12T08:29:59.999Z",
      source: {
        provider_kind: "binance_production_public_market_data",
        source_kind: "binance_production_public_rest",
        rest_base_url: "https://fapi.binance.com",
        endpoint: "/fapi/v1/klines",
        authority_status: "read_only"
      },
      klines: Array.from({ length: 30 }, (_, index) => ({
        open_time: new Date(start + index * 60_000).toISOString(),
        close_time: new Date(start + (index + 1) * 60_000 - 1).toISOString(),
        close_price: String(60_000 + index)
      })),
      authority_status: "read_only"
    },
    classifiedAt: "2026-07-12T08:30:31.000Z"
  });
}

function port(store: StudyStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
