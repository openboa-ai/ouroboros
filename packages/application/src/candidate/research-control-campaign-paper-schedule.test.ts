import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignReportDigestInput,
  type ResearchControlCampaignArmReport,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { paperTradingComparisonIdsForIdempotencyKey } from
  "../trading/paper/comparison-identity";
import { decideResearchControlCampaign } from "./research-control-campaign";
import {
  decideResearchControlCampaignPaperSchedule,
  ResearchControlCampaignPaperScheduleDecisionError,
  ResearchControlCampaignPaperScheduleService,
  ResearchControlCampaignPaperScheduleServiceError
} from "./research-control-campaign-paper-schedule";

describe("ResearchControlCampaignPaperSchedule application", () => {
  it("derives exact source identities and mirrors report slot variants", () => {
    const { campaign, report } = graphFixture();
    const schedule = decideResearchControlCampaignPaperSchedule({
      campaign,
      report,
      committedAt: "2026-07-12T11:00:00.000Z"
    });
    const adaptive = schedule.arms[0].slots[0]!;
    const control = schedule.arms[1].slots[0]!;
    if (adaptive.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_slot");
    }
    const key = `research-control-paper:${campaign.research_control_campaign_id}` +
      ":adaptive:slot:1:source";

    expect(adaptive).toMatchObject({
      sequence: 1,
      slot_status: "candidate_scheduled",
      source_comparison_idempotency_key: key,
      ...sourceIds(key),
      maximum_source_start_delay_ms: 600_000
    });
    expect(control).toEqual({
      sequence: 1,
      tick_ref: report.arms[1].paper_candidate_slots[0]!.tick_ref,
      slot_status: "no_admitted_candidate"
    });
    expect(schedule.paper_comparator).toEqual(campaign.paper_comparator);
    expect(schedule.paper_evaluation_protocol_digest).toBe(
      campaign.paper_evaluation_protocol.protocol_status === "bound"
        ? campaign.paper_evaluation_protocol.protocol_digest
        : "unreachable"
    );
  });

  it("rejects an unavailable paper protocol", () => {
    const { campaign, report } = graphFixture();
    campaign.paper_comparator = {
      comparator_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    };
    campaign.paper_evaluation_protocol = {
      protocol_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    };
    resealCampaign(campaign);
    relinkReport(report, campaign);

    expect(() => decideResearchControlCampaignPaperSchedule({
      campaign,
      report,
      committedAt: "2026-07-12T11:00:00.000Z"
    })).toThrow(ResearchControlCampaignPaperScheduleDecisionError);
  });

  it("rejects a bound protocol digest drift even with a resealed campaign", () => {
    const { campaign, report } = graphFixture();
    if (campaign.paper_evaluation_protocol.protocol_status !== "bound") {
      throw new Error("fixture_expected_bound_protocol");
    }
    campaign.paper_evaluation_protocol.protocol_digest = digest("f");
    resealCampaign(campaign);
    relinkReport(report, campaign);

    expect(() => decideResearchControlCampaignPaperSchedule({
      campaign,
      report,
      committedAt: "2026-07-12T11:00:00.000Z"
    })).toThrow(ResearchControlCampaignPaperScheduleDecisionError);
  });

  it.each([
    ["report/campaign ref mismatch", (campaign: ResearchControlCampaignRecord,
      report: ResearchControlCampaignReportRecord) => {
      report.campaign_ref.id = "other-campaign";
      resealReport(report);
    }],
    ["report before campaign", (campaign: ResearchControlCampaignRecord,
      report: ResearchControlCampaignReportRecord) => {
      report.arms[0].completed_at = "2026-07-12T09:20:00.000Z";
      report.arms[1].completed_at = "2026-07-12T09:20:00.000Z";
      report.completed_at = "2026-07-12T09:30:00.000Z";
      resealReport(report);
    }],
    ["schedule before report", (_campaign: ResearchControlCampaignRecord,
      _report: ResearchControlCampaignReportRecord, input: { committedAt: string }) => {
      input.committedAt = "2026-07-12T10:29:59.999Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const { campaign, report } = graphFixture();
    const input = { committedAt: "2026-07-12T11:00:00.000Z" };
    mutate(campaign, report, input);

    expect(() => decideResearchControlCampaignPaperSchedule({
      campaign,
      report,
      committedAt: input.committedAt
    })).toThrow(ResearchControlCampaignPaperScheduleDecisionError);
  });

  it("persists once and replays the original schedule clock", async () => {
    const { campaign, report } = graphFixture();
    const store = new ScheduleStoreDouble(campaign, report);
    let now = "2026-07-12T11:00:00.000Z";
    const service = new ResearchControlCampaignPaperScheduleService({
      store: store as unknown as OuroborosStorePort,
      now: () => now
    });

    const first = await service.commit({ campaign, report });
    now = "2026-07-13T11:00:00.000Z";
    const replay = await service.commit({ campaign, report });

    expect(replay).toEqual(first);
    expect(replay.committed_at).toBe("2026-07-12T11:00:00.000Z");
    expect(store.scheduleWrites).toBe(1);
  });

  it.each([
    ["candidate substitution", (report: ResearchControlCampaignReportRecord) => {
      const slot = report.arms[0].paper_candidate_slots[0]!;
      if (slot.status !== "candidate_reserved") throw new Error("candidate_required");
      slot.candidate_ref.id = "substituted-candidate";
    }],
    ["changed admission", (report: ResearchControlCampaignReportRecord) => {
      const slot = report.arms[0].paper_candidate_slots[0]!;
      if (slot.status !== "candidate_reserved") throw new Error("candidate_required");
      slot.admission_decision_ref.id = "substituted-admission";
    }]
  ])("rejects %s outside the stored report graph", async (_label, mutate) => {
    const { campaign, report } = graphFixture();
    const store = new ScheduleStoreDouble(campaign, report);
    const changed = structuredClone(report);
    mutate(changed);
    resealReport(changed);
    const service = new ResearchControlCampaignPaperScheduleService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T11:00:00.000Z"
    });

    await expect(service.commit({ campaign, report: changed })).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_graph_invalid"
    } satisfies Partial<ResearchControlCampaignPaperScheduleServiceError>);
    expect(store.scheduleWrites).toBe(0);
  });

  it("rejects a store that changes the decided schedule", async () => {
    const { campaign, report } = graphFixture();
    const store = new ScheduleStoreDouble(campaign, report);
    store.changeRecordedSchedule = true;
    const service = new ResearchControlCampaignPaperScheduleService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T11:00:00.000Z"
    });

    await expect(service.commit({ campaign, report })).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_persistence_conflict"
    } satisfies Partial<ResearchControlCampaignPaperScheduleServiceError>);
  });
});

function graphFixture(): {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
} {
  const campaign = decideResearchControlCampaign({
    idempotencyKey: "paper-schedule-test",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 1,
      total_bytes: 10,
      exclusion_policy: "research_control_campaign_evidence_only"
    },
    source: {
      candidate_ref: { record_kind: "trading_system_candidate", id: "source" },
      candidate_version_ref: { record_kind: "candidate_version", id: "source-v1" },
      system_code_ref: { record_kind: "system_code", id: "source-code" },
      system_code_artifact_digest: digest("2"),
      system_code_record_digest: digest("3"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("4")
    },
    researchAgent: {
      id: "fixture-research-agent",
      provider: "fixture",
      permission_policy: "fixture_only"
    },
    paperComparator: tradingReviewComparator(),
    paperEvaluationProtocol: boundPaperProtocolInput(),
    tickCountPerArm: 1,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
  return { campaign, report: reportFixture(campaign) };
}

function reportFixture(
  campaign: ResearchControlCampaignRecord
): ResearchControlCampaignReportRecord {
  const report: ResearchControlCampaignReportRecord = {
    record_kind: "research_control_campaign_report",
    version: 1,
    research_control_campaign_report_id: "research-control-report-schedule-test",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: [reportArm(campaign, 0, true), reportArm(campaign, 1, false)],
    primary_outcome_status: "unadjudicated",
    causal_conclusion: "not_available_from_research_phase",
    next_action: "schedule_prospective_paper_slots",
    completed_at: "2026-07-12T10:30:00.000Z",
    report_digest: digest("0"),
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  resealReport(report);
  return report;
}

function reportArm(
  campaign: ResearchControlCampaignRecord,
  armIndex: 0 | 1,
  hasCandidate: boolean
): ResearchControlCampaignArmReport {
  const arm = campaign.arms[armIndex];
  const suffix = armIndex === 0 ? "adaptive" : "static";
  const tickRef = {
    record_kind: "candidate_arena_tick",
    id: `${suffix}-tick-1`
  };
  return {
    arm_kind: arm.arm_kind,
    allocation_mode: arm.allocation_mode,
    arm_intent_ref: {
      record_kind: "research_control_campaign_arm_intent",
      id: arm.research_control_campaign_arm_intent_id
    },
    arm_intent_digest: digest(armIndex === 0 ? "6" : "7"),
    tick_refs: [tickRef],
    allocation_refs: [{
      record_kind: "candidate_arena_research_allocation",
      id: `${suffix}-allocation-1`
    }],
    diagnostics: {
      attempt_count: 3,
      admitted_candidate_count: hasCandidate ? 1 : 0,
      duplicate_count: 0,
      quarantined_count: 0,
      failed_count: hasCandidate ? 2 : 3,
      provider_request_total: 3,
      runner_command_total: 3,
      scenario_count: 3,
      elapsed_ms: 300
    },
    population_diversity: diversityFixture(arm.tick_ids[0]!, hasCandidate),
    paper_candidate_slots: [{
      sequence: 1,
      tick_ref: tickRef,
      ...(hasCandidate ? {
        status: "candidate_reserved" as const,
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: `${suffix}-candidate`
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: `${suffix}-version`
        },
        system_code_ref: {
          record_kind: "system_code",
          id: `${suffix}-code`
        },
        system_code_artifact_digest: digest("8"),
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `${suffix}-admission`
        }
      } : { status: "no_admitted_candidate" as const })
    }],
    final_store_snapshot_digest: digest(armIndex === 0 ? "a" : "b"),
    completed_at: "2026-07-12T10:20:00.000Z",
    research_diagnostics_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function diversityFixture(
  tickId: string,
  hasCandidate: boolean
): ResearchPopulationDiversityReadModel {
  const observed = {
    measurement_status: "insufficient_evidence" as const,
    sample_count: hasCandidate ? 1 : 0,
    unique_count: hasCandidate ? 1 : 0,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: hasCandidate ? 1 : 0,
    admitted_submission_count: hasCandidate ? 1 : 0,
    exact_behavior_duplicate_count: 0,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  };
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 1,
    assigned_directions: {
      measurement_status: "measured",
      sample_count: 3,
      unique_count: 3,
      entropy_bits: 1.584963,
      normalized_entropy: 1
    },
    observed_behaviors: observed,
    by_direction: [
      {
        direction_kind: "trend_following",
        attempt_count: 1,
        observed_behavior_count: hasCandidate ? 1 : 0,
        unique_behavior_count: hasCandidate ? 1 : 0,
        admitted_submission_count: hasCandidate ? 1 : 0,
        exact_behavior_duplicate_count: 0
      },
      ...(["mean_reversion", "volatility_regime"] as const).map(
        (direction_kind) => ({
          direction_kind,
          attempt_count: 1,
          observed_behavior_count: 0,
          unique_behavior_count: 0,
          admitted_submission_count: 0,
          exact_behavior_duplicate_count: 0
        })
      )
    ],
    tick_series: [{
      tick_id: tickId,
      completed_at: "2026-07-12T10:20:00.000Z",
      assigned_directions: {
        measurement_status: "measured",
        sample_count: 3,
        unique_count: 3,
        entropy_bits: 1.584963,
        normalized_entropy: 1
      },
      observed_behaviors: observed,
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    }],
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function tradingReviewComparator() {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: "promotion-001"
    },
    trading_promotion_digest: digest("5"),
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
      minimum_observation_count: 1,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 1,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("4"),
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

function sourceIds(key: string) {
  const ids = paperTradingComparisonIdsForIdempotencyKey(key);
  return {
    source_preparation_id: ids.preparation_id,
    source_comparison_commitment_id: ids.comparison_commitment_id
  };
}

function relinkReport(
  report: ResearchControlCampaignReportRecord,
  campaign: ResearchControlCampaignRecord
): void {
  report.campaign_ref.id = campaign.research_control_campaign_id;
  report.campaign_digest = campaign.campaign_digest;
  resealReport(report);
}

function resealCampaign(campaign: ResearchControlCampaignRecord): void {
  campaign.campaign_digest = canonicalDigest(
    researchControlCampaignDigestInput(campaign)
  );
}

function resealReport(report: ResearchControlCampaignReportRecord): void {
  report.report_digest = canonicalDigest(
    researchControlCampaignReportDigestInput(report)
  );
}

function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(
    typeof value === "string"
      ? value
      : paperTradingComparisonPersistedRecordDigestInput(value)
  ).digest("hex")}`;
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

class ScheduleStoreDouble {
  readonly schedules = new Map<string, ResearchControlCampaignPaperScheduleRecord>();
  scheduleWrites = 0;
  changeRecordedSchedule = false;

  constructor(
    private readonly campaign: ResearchControlCampaignRecord,
    private readonly report: ResearchControlCampaignReportRecord
  ) {}

  async getResearchControlCampaign(id: string) {
    return id === this.campaign.research_control_campaign_id
      ? this.campaign
      : undefined;
  }

  async getResearchControlCampaignReport(id: string) {
    return id === this.report.research_control_campaign_report_id
      ? this.report
      : undefined;
  }

  async getResearchControlCampaignPaperSchedule(id: string) {
    return this.schedules.get(id);
  }

  async recordResearchControlCampaignPaperSchedule(
    schedule: ResearchControlCampaignPaperScheduleRecord
  ) {
    this.scheduleWrites += 1;
    const recorded = structuredClone(schedule);
    if (this.changeRecordedSchedule) {
      recorded.committed_at = "2026-07-12T11:00:01.000Z";
    }
    this.schedules.set(
      schedule.research_control_campaign_paper_schedule_id,
      recorded
    );
    return recorded;
  }
}
