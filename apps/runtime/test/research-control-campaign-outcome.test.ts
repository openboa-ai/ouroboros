import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decideResearchControlCampaign
} from "@ouroboros/application/candidate/research-control-campaign";
import {
  decideResearchControlCampaignPaperSchedule
} from "@ouroboros/application/candidate/research-control-campaign-paper-schedule";
import {
  decideResearchControlCampaignPaperSlotOutcome
} from "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import {
  collectResearchControlCampaignOutcome,
  type ResearchControlCampaignOutcomeArmReader
} from "../src/candidate/arena/research-control-campaign";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-outcome-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ResearchControlCampaign outcome collector", () => {
  it("persists one all-slot terminal observation through the coordinator", async () => {
    const fixture = collectorFixture();
    let armOpenCount = 0;

    const result = await collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id,
      now: () => "2026-07-12T11:00:00.000Z",
      openArmStore: () => {
        armOpenCount += 1;
        return emptyArmReader();
      }
    });

    expect(researchControlCampaignOutcomeHasRuntimeShape(result.outcome))
      .toBe(true);
    expect(result.outcome.arms.map((arm) => arm.metrics)).toEqual([
      expect.objectContaining({
        slot_count: 1,
        no_admitted_candidate_count: 1,
        qualified_discovery_rate: 0
      }),
      expect.objectContaining({
        slot_count: 1,
        no_admitted_candidate_count: 1,
        qualified_discovery_rate: 0
      })
    ]);
    expect(result.outcome.observed_result).toBe("rates_equal");
    expect(result.outcome.shared_evaluation_policy_status).toBe("bound");
    expect(fixture.store.outcomeWrites).toBe(1);
    expect(armOpenCount).toBe(2);
  });

  it("replays a terminal outcome without opening either arm store", async () => {
    const fixture = collectorFixture();
    const input = {
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id,
      now: () => "2026-07-12T11:00:00.000Z",
      openArmStore: () => emptyArmReader()
    };
    const first = await collectResearchControlCampaignOutcome(input);

    const replay = await collectResearchControlCampaignOutcome({
      ...input,
      openArmStore: () => {
        throw new Error("arm_store_must_not_open");
      }
    });

    expect(replay.outcome).toEqual(first.outcome);
    expect(fixture.store.outcomeWrites).toBe(1);
  });

  it("rejects a reserved slot with no terminal slot outcome", async () => {
    const fixture = collectorFixture({ adaptiveCandidate: true });

    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id,
      openArmStore: () => emptyArmReader()
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_evidence_incomplete"
    });
    expect(fixture.store.outcomeWrites).toBe(0);
  });

  it("rejects multiple terminal outcomes for one reserved slot", async () => {
    const fixture = collectorFixture({ adaptiveCandidate: true });
    const slotOutcome = expiredSlotOutcome(fixture.schedule);

    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id,
      openArmStore: (_root, armKind) => armKind === "adaptive_treatment"
        ? armReaderWithSlotOutcomes([slotOutcome, slotOutcome])
        : emptyArmReader()
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_evidence_ambiguous"
    });
  });

  it("copies exact arm-local terminal outcomes before adjudication", async () => {
    const fixture = collectorFixture({ adaptiveCandidate: true });
    const slotOutcome = expiredSlotOutcome(fixture.schedule);

    const result = await collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id,
      now: () => "2026-07-12T10:42:00.000Z",
      openArmStore: (_root, armKind) => armKind === "adaptive_treatment"
        ? armReaderWithSlotOutcomes([slotOutcome])
        : emptyArmReader()
    });

    expect(result.outcome.arms[0]?.slot_results[0]).toMatchObject({
      terminal_status: "paper_slot_expired",
      paper_slot_outcome_ref: {
        id: slotOutcome.research_control_campaign_paper_slot_outcome_id
      },
      paper_slot_outcome_digest: slotOutcome.slot_outcome_digest,
      discovery_credit: 0
    });
    expect(fixture.store.slotOutcomeWrites).toBe(1);
    expect(await fixture.store.getResearchControlCampaignPaperSlotOutcome(
      slotOutcome.research_control_campaign_paper_slot_outcome_id
    )).toEqual(slotOutcome);
  });

  it("rejects missing and ambiguous campaign or report evidence", async () => {
    const fixture = collectorFixture();
    fixture.store.campaign = undefined;
    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_source_not_found"
    });

    fixture.store.campaign = fixture.campaign;
    fixture.store.reports.push(structuredClone(fixture.report));
    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_source_ambiguous"
    });
  });

  it("rejects missing and ambiguous paper schedule evidence", async () => {
    const fixture = collectorFixture();
    fixture.store.schedules = [];

    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_source_not_found"
    });

    fixture.store.schedules = [
      fixture.schedule,
      {
        ...structuredClone(fixture.schedule),
        research_control_campaign_paper_schedule_id: "ambiguous-schedule"
      }
    ];
    await expect(collectResearchControlCampaignOutcome({
      store: fixture.store as unknown as OuroborosStorePort,
      workspaceRoot: path.join(tmpDir, "workspace"),
      campaignId: fixture.campaign.research_control_campaign_id
    })).rejects.toMatchObject({
      code: "research_control_campaign_outcome_source_ambiguous"
    });
  });
});

function collectorFixture(options: { adaptiveCandidate?: boolean } = {}) {
  const campaign = campaignFixture();
  const report = reportFixture(campaign, options.adaptiveCandidate ?? false);
  const schedule = decideResearchControlCampaignPaperSchedule({
    campaign,
    report,
    committedAt: "2026-07-12T10:31:00.000Z"
  });
  const store = new CoordinatorStoreDouble(
    path.join(tmpDir, "coordinator"),
    campaign,
    report,
    schedule
  );
  return { campaign, report, schedule, store };
}

function campaignFixture(): ResearchControlCampaignRecord {
  return decideResearchControlCampaign({
    idempotencyKey: "runtime-outcome-collector",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 1,
      total_bytes: 1,
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
      id: "fixture",
      provider: "fixture",
      permission_policy: "fixture_only"
    },
    paperComparator: {
      comparator_status: "trading_review",
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
    },
    paperEvaluationProtocol: {
      protocol_status: "bound",
      comparison_policy: {
        policy_version: "paper-comparison-v1",
        comparison_mode: "champion_challenge",
        symbol: "BTCUSDT",
        interval_ms: 60_000,
        minimum_observation_count: 1,
        minimum_elapsed_ms: 60_000,
        maximum_observation_count: 1,
        maximum_elapsed_ms: 600_000,
        maximum_start_skew_ms: 5_000,
        maximum_provider_request_count_per_side: 100,
        maximum_retry_count_per_side: 2,
        primary_metric: "net_revenue_usdt",
        minimum_net_revenue_lift_usdt: 1,
        required_confirmation_count: 1,
        require_non_overlapping_windows: true,
        require_both_qualified: true,
        release_policy: "sealed_until_adjudication"
      },
      market_data_configuration_digest: digest("6"),
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
        policy_version: "research-control-paper-schedule-v1",
        source_start_order: "paired_by_sequence",
        maximum_active_source_pairs: 2,
        maximum_cross_arm_first_tick_skew_ms: 5_000,
        source_missed_start_policy: "slot_expired",
        confirmation_precommit_deadline_ms: 600_000
      }
    },
    tickCountPerArm: 1,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function reportFixture(
  campaign: ResearchControlCampaignRecord,
  adaptiveCandidate: boolean
): ResearchControlCampaignReportRecord {
  const report: ResearchControlCampaignReportRecord = {
    record_kind: "research_control_campaign_report",
    version: 1,
    research_control_campaign_report_id: "runtime-outcome-report-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: [
      reportArm(campaign, 0, adaptiveCandidate),
      reportArm(campaign, 1, false)
    ],
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
  report.report_digest = canonicalDigest(
    researchControlCampaignReportDigestInput(report)
  );
  return report;
}

function reportArm(
  campaign: ResearchControlCampaignRecord,
  armIndex: 0 | 1,
  hasCandidate: boolean
): ResearchControlCampaignReportRecord["arms"][number] {
  const arm = campaign.arms[armIndex];
  const prefix = armIndex === 0 ? "adaptive" : "static";
  const tickRef = {
    record_kind: "candidate_arena_tick",
    id: `${prefix}-tick-1`
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
      id: `${prefix}-allocation-1`
    }],
    diagnostics: {
      attempt_count: 3,
      admitted_candidate_count: hasCandidate ? 1 : 0,
      duplicate_count: 0,
      quarantined_count: 0,
      failed_count: hasCandidate ? 2 : 3,
      provider_request_total: 0,
      runner_command_total: 0,
      scenario_count: 0,
      elapsed_ms: 0
    },
    population_diversity: diversityFixture(arm.tick_ids[0]!, hasCandidate),
    paper_candidate_slots: [{
      sequence: 1,
      tick_ref: tickRef,
      ...(hasCandidate ? {
        status: "candidate_reserved" as const,
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: `${prefix}-candidate`
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: `${prefix}-version`
        },
        system_code_ref: {
          record_kind: "system_code",
          id: `${prefix}-code`
        },
        system_code_artifact_digest: digest("8"),
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `${prefix}-admission`
        }
      } : { status: "no_admitted_candidate" as const })
    }],
    final_store_snapshot_digest: digest(armIndex === 0 ? "9" : "a"),
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
  const assigned = {
    measurement_status: "measured" as const,
    sample_count: 3,
    unique_count: 3,
    entropy_bits: 1.584963,
    normalized_entropy: 1
  };
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 1,
    assigned_directions: assigned,
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
      assigned_directions: assigned,
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

function expiredSlotOutcome(
  schedule: ResearchControlCampaignPaperScheduleRecord
): ResearchControlCampaignPaperSlotOutcomeRecord {
  return decideResearchControlCampaignPaperSlotOutcome({
    schedule,
    armKind: "adaptive_treatment",
    sequence: 1,
    terminalEvidence: {
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired",
      expired_at: "2026-07-12T10:41:00.000Z"
    },
    terminalAt: "2026-07-12T10:41:00.000Z"
  });
}

function emptyArmReader(): ResearchControlCampaignOutcomeArmReader {
  return armReaderWithSlotOutcomes([]);
}

function armReaderWithSlotOutcomes(
  outcomes: ResearchControlCampaignPaperSlotOutcomeRecord[]
): ResearchControlCampaignOutcomeArmReader {
  return {
    async listResearchControlCampaignPaperSlotOutcomes() {
      return structuredClone(outcomes);
    }
  };
}

class CoordinatorStoreDouble {
  campaign: ResearchControlCampaignRecord | undefined;
  reports: ResearchControlCampaignReportRecord[];
  schedules: ResearchControlCampaignPaperScheduleRecord[];
  slotOutcomes = new Map<string, ResearchControlCampaignPaperSlotOutcomeRecord>();
  outcome: ResearchControlCampaignOutcomeRecord | undefined;
  slotOutcomeWrites = 0;
  outcomeWrites = 0;

  constructor(
    private readonly storeRoot: string,
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ) {
    this.campaign = campaign;
    this.reports = [report];
    this.schedules = [schedule];
  }

  root() {
    return this.storeRoot;
  }

  async getResearchControlCampaign(id: string) {
    return this.campaign?.research_control_campaign_id === id
      ? structuredClone(this.campaign)
      : undefined;
  }

  async listResearchControlCampaignReports() {
    return structuredClone(this.reports);
  }

  async getResearchControlCampaignReport(id: string) {
    return structuredClone(this.reports.find((report) =>
      report.research_control_campaign_report_id === id
    ));
  }

  async listResearchControlCampaignPaperSchedules() {
    return structuredClone(this.schedules);
  }

  async getResearchControlCampaignPaperSchedule(id: string) {
    return structuredClone(this.schedules.find((schedule) =>
      schedule.research_control_campaign_paper_schedule_id === id
    ));
  }

  async recordResearchControlCampaignPaperSlotOutcome(
    _outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    throw new Error("collector_must_not_use_arm_creation_path");
  }

  async replicateResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    this.slotOutcomeWrites += 1;
    const recorded = structuredClone(outcome);
    this.slotOutcomes.set(
      outcome.research_control_campaign_paper_slot_outcome_id,
      recorded
    );
    return structuredClone(recorded);
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return structuredClone(this.slotOutcomes.get(id));
  }

  async listResearchControlCampaignPaperSlotOutcomes(scheduleId?: string) {
    return structuredClone([...this.slotOutcomes.values()].filter((outcome) =>
      scheduleId === undefined || outcome.schedule_ref.id === scheduleId
    ));
  }

  async getResearchControlCampaignOutcome(id: string) {
    return this.outcome?.research_control_campaign_outcome_id === id
      ? structuredClone(this.outcome)
      : undefined;
  }

  async recordResearchControlCampaignOutcome(
    outcome: ResearchControlCampaignOutcomeRecord
  ) {
    this.outcomeWrites += 1;
    this.outcome = structuredClone(outcome);
    return structuredClone(outcome);
  }
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
