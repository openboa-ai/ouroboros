import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignOutcomeDigestInput,
  type ResearchControlCampaignOutcomeArm,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { decideResearchControlCampaign } from
  "@ouroboros/application/candidate/research-control-campaign";
import {
  decideResearchControlStudy,
  researchControlStudyConditionFromCampaign
} from "@ouroboros/application/candidate/research-control-study";
import { decideResearchControlStudyOutcome } from
  "@ouroboros/application/candidate/research-control-study-outcome";
import {
  projectResearchControlStudyNextAction,
  ResearchControlStudyNextActionError,
  type ProjectResearchControlStudyNextActionInput
} from "../src/candidate/arena/research-control-study-next-action";

describe("ResearchControlStudy next action", () => {
  it("selects the first fresh campaign", () => {
    const fixture = studyFixture();

    expect(projectResearchControlStudyNextAction(emptyInput(fixture))).toEqual({
      action: "run_campaign",
      replicationIndex: 1,
      campaignId: fixture.study.replications[0]!.campaign_ref.id,
      campaignIdempotencyKey:
        fixture.study.replications[0]!.campaign_idempotency_key,
      resume: false
    });
  });

  it("resumes the first campaign without an outcome", () => {
    const fixture = studyFixture();
    const input = emptyInput(fixture);
    input.replications[0]!.campaign = fixture.replications[0]!.campaign;

    expect(projectResearchControlStudyNextAction(input)).toMatchObject({
      action: "run_campaign",
      replicationIndex: 1,
      resume: true
    });
  });

  it("moves to the next campaign only after an exact terminal prefix", () => {
    const fixture = studyFixture();
    const input = emptyInput(fixture);
    input.replications[0] = completeEvidence(fixture, 0);

    expect(projectResearchControlStudyNextAction(input)).toMatchObject({
      action: "run_campaign",
      replicationIndex: 2,
      campaignId: fixture.study.replications[1]!.campaign_ref.id,
      resume: false
    });
  });

  it("adjudicates only after every planned campaign outcome", () => {
    const fixture = studyFixture();
    const input = fullInput(fixture);

    expect(projectResearchControlStudyNextAction(input)).toEqual({
      action: "adjudicate_study"
    });
  });

  it("completes effect-free after the exact study outcome", () => {
    const fixture = studyFixture();
    const input = fullInput(fixture);
    input.studyOutcome = decideResearchControlStudyOutcome({
      study: fixture.study,
      replications: fixture.replications,
      adjudicatedAt: "2026-07-12T12:00:00.000Z"
    });

    expect(projectResearchControlStudyNextAction(input)).toEqual({
      action: "complete"
    });
  });

  it.each([
    ["study digest drift", (input: ProjectResearchControlStudyNextActionInput) => {
      input.study.study_digest = digest("f");
    }],
    ["evidence length drift", (input: ProjectResearchControlStudyNextActionInput) => {
      input.replications.pop();
    }],
    ["outcome without campaign", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      input.replications[0]!.outcome = fixture.replications[0]!.outcome;
    }],
    ["later campaign crossing an incomplete prefix", (
      input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture
    ) => {
      input.replications[1]!.campaign = fixture.replications[1]!.campaign;
    }],
    ["wrong planned campaign", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      input.replications[0]!.campaign = fixture.replications[1]!.campaign;
    }],
    ["baseline drift", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      const campaign = structuredClone(fixture.replications[0]!.campaign);
      campaign.baseline.snapshot_digest = digest("e");
      resealCampaign(campaign);
      input.replications[0]!.campaign = campaign;
    }],
    ["condition drift", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      const campaign = structuredClone(fixture.replications[0]!.campaign);
      campaign.research_agent.model = "drifted-model";
      resealCampaign(campaign);
      input.replications[0]!.campaign = campaign;
    }],
    ["pre-study campaign", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      const campaign = structuredClone(fixture.replications[0]!.campaign);
      campaign.committed_at = fixture.study.committed_at;
      resealCampaign(campaign);
      input.replications[0]!.campaign = campaign;
    }],
    ["outcome campaign digest drift", (
      input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture
    ) => {
      input.replications[0] = completeEvidence(fixture, 0);
      input.replications[0]!.outcome!.campaign_digest = digest("e");
      resealCampaignOutcome(input.replications[0]!.outcome!);
    }],
    ["outcome metric drift", (input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture) => {
      input.replications[0] = completeEvidence(fixture, 0);
      input.replications[0]!.outcome!.observed_rate_difference = 0;
      resealCampaignOutcome(input.replications[0]!.outcome!);
    }],
    ["study outcome before source closure", (
      input: ProjectResearchControlStudyNextActionInput,
      fixture: StudyFixture
    ) => {
      input.studyOutcome = decideResearchControlStudyOutcome({
        study: fixture.study,
        replications: fixture.replications,
        adjudicatedAt: "2026-07-12T12:00:00.000Z"
      });
    }]
  ])("rejects %s", (_label, mutate) => {
    const fixture = studyFixture();
    const input = emptyInput(fixture);
    mutate(input, fixture);

    expect(() => projectResearchControlStudyNextAction(input))
      .toThrow(ResearchControlStudyNextActionError);
  });
});

interface StudyFixture {
  study: ResearchControlStudyRecord;
  replications: Array<{
    campaign: ResearchControlCampaignRecord;
    outcome: ResearchControlCampaignOutcomeRecord;
  }>;
}

function studyFixture(): StudyFixture {
  const keys = Array.from({ length: 6 }, (_, index) =>
    `next-action-replication-${index + 1}`
  );
  const campaigns = keys.map(campaignFixture);
  const condition = researchControlStudyConditionFromCampaign(campaigns[0]!);
  const { condition_digest: _digest, ...conditionInput } = condition;
  const study = decideResearchControlStudy({
    idempotencyKey: "next-action-study",
    baselineSnapshotDigest: campaigns[0]!.baseline.snapshot_digest,
    condition: conditionInput,
    replicationIdempotencyKeys: keys,
    committedAt: "2026-07-12T09:00:00.000Z"
  });
  return {
    study,
    replications: campaigns.map((campaign) => ({
      campaign,
      outcome: campaignOutcome(campaign, 1)
    }))
  };
}

function emptyInput(
  fixture: StudyFixture
): ProjectResearchControlStudyNextActionInput {
  return {
    study: structuredClone(fixture.study),
    replications: fixture.study.replications.map((replication) => ({
      replicationIndex: replication.replication_index
    }))
  };
}

function fullInput(
  fixture: StudyFixture
): ProjectResearchControlStudyNextActionInput {
  return {
    study: structuredClone(fixture.study),
    replications: fixture.replications.map((_replication, index) =>
      completeEvidence(fixture, index)
    )
  };
}

function completeEvidence(fixture: StudyFixture, index: number) {
  const replication = fixture.replications[index]!;
  return {
    replicationIndex: index + 1,
    campaign: structuredClone(replication.campaign),
    outcome: structuredClone(replication.outcome)
  };
}

function campaignFixture(idempotencyKey: string): ResearchControlCampaignRecord {
  return decideResearchControlCampaign({
    idempotencyKey,
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
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
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function campaignOutcome(
  campaign: ResearchControlCampaignRecord,
  difference: number
): ResearchControlCampaignOutcomeRecord {
  const adaptiveCredit = difference > 0 ? 1 : 0;
  const staticCredit = difference < 0 ? 1 : 0;
  const outcome: ResearchControlCampaignOutcomeRecord = {
    record_kind: "research_control_campaign_outcome",
    version: 1,
    research_control_campaign_outcome_id:
      `${campaign.research_control_campaign_id}-outcome`,
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: `${campaign.research_control_campaign_id}-report`
    },
    report_digest: digest("6"),
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: `${campaign.research_control_campaign_id}-schedule`
    },
    schedule_digest: digest("7"),
    paper_comparator: structuredClone(campaign.paper_comparator) as never,
    shared_evaluation_policy_status: "bound",
    shared_evaluation_policy_digest:
      campaign.paper_evaluation_protocol.protocol_status === "bound"
        ? campaign.paper_evaluation_protocol.protocol_digest
        : digest("8"),
    arms: [
      campaignOutcomeArm(
        "adaptive_treatment",
        "adaptive_default",
        adaptiveCredit,
        campaign.research_control_campaign_id
      ),
      campaignOutcomeArm(
        "static_control",
        "static_control",
        staticCredit,
        campaign.research_control_campaign_id
      )
    ],
    observed_rate_difference: difference,
    observed_result: difference > 0
      ? "adaptive_rate_higher"
      : difference < 0
      ? "static_rate_higher"
      : "rates_equal",
    causal_conclusion: "single_campaign_observation_only",
    policy_replacement_eligibility: "not_eligible",
    next_action: "accumulate_replicated_control_campaigns",
    adjudicated_at: "2026-07-12T11:00:00.000Z",
    outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealCampaignOutcome(outcome);
  return outcome;
}

function campaignOutcomeArm(
  armKind: "adaptive_treatment" | "static_control",
  allocationMode: "adaptive_default" | "static_control",
  credit: number,
  token: string
): ResearchControlCampaignOutcomeArm {
  const tickRef = {
    record_kind: "candidate_arena_tick" as const,
    id: `${token}-${armKind}-tick`
  };
  const slot = credit === 1 ? {
    sequence: 1,
    tick_ref: tickRef,
    terminal_status: "qualified_improvement" as const,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${token}-${armKind}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${token}-${armKind}-version`
    },
    system_code_ref: {
      record_kind: "system_code",
      id: `${token}-${armKind}-code`
    },
    system_code_artifact_digest: digest("9"),
    paper_slot_outcome_ref: {
      record_kind: "research_control_campaign_paper_slot_outcome",
      id: `${token}-${armKind}-slot-outcome`
    },
    paper_slot_outcome_digest: digest("a"),
    discovery_credit: 1 as const
  } : {
    sequence: 1,
    tick_ref: tickRef,
    terminal_status: "no_admitted_candidate" as const,
    discovery_credit: 0 as const
  };
  return {
    arm_kind: armKind,
    allocation_mode: allocationMode,
    slot_results: [slot],
    metrics: {
      slot_count: 1,
      admitted_candidate_slot_count: credit,
      no_admitted_candidate_count: 1 - credit,
      qualified_discovery_count: credit,
      source_not_improved_count: 0,
      not_reproduced_count: 0,
      evidence_ineligible_count: 0,
      paper_slot_expired_count: 0,
      qualified_discovery_rate: credit
    }
  };
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

function resealCampaign(campaign: ResearchControlCampaignRecord): void {
  campaign.campaign_digest = exactDigest(
    researchControlCampaignDigestInput(campaign)
  );
}

function resealCampaignOutcome(outcome: ResearchControlCampaignOutcomeRecord) {
  outcome.outcome_digest = exactDigest(
    researchControlCampaignOutcomeDigestInput(outcome)
  );
}

function exactDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
