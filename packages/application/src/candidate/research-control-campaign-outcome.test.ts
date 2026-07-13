import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignPaperSlotOutcomeDigestInput,
  researchControlCampaignReportDigestInput,
  type ResearchControlCampaignArmReport,
  type ResearchControlCampaignOutcomeTerminalStatus,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { decideResearchControlCampaign } from "./research-control-campaign";
import { decideResearchControlCampaignPaperSchedule } from
  "./research-control-campaign-paper-schedule";
import { decideResearchControlCampaignPaperSlotOutcome } from
  "./research-control-campaign-paper-slot-outcome";
import {
  adjudicateResearchControlCampaignOutcome,
  type AdjudicateResearchControlCampaignOutcomeInput,
  ResearchControlCampaignOutcomeDecisionError,
  ResearchControlCampaignOutcomeService
} from "./research-control-campaign-outcome";

describe("ResearchControlCampaignOutcome application", () => {
  it("adjudicates exact slot outcomes without granting policy authority", () => {
    const fixture = outcomeFixture();

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(outcome).toMatchObject({
      schedule_ref: {
        id: fixture.input.schedule.research_control_campaign_paper_schedule_id
      },
      shared_evaluation_policy_status: "bound",
      shared_evaluation_policy_digest:
        fixture.input.campaign.paper_evaluation_protocol.protocol_status === "bound"
          ? fixture.input.campaign.paper_evaluation_protocol.protocol_digest
          : "unreachable",
      observed_rate_difference: 1,
      observed_result: "adaptive_rate_higher",
      causal_conclusion: "single_campaign_observation_only",
      policy_replacement_eligibility: "not_eligible",
      promotion_authority: false
    });
    expect(outcome.arms[0].metrics).toMatchObject({
      qualified_discovery_count: 1,
      source_not_improved_count: 0,
      qualified_discovery_rate: 1
    });
    expect(outcome.arms[1].metrics).toMatchObject({
      qualified_discovery_count: 0,
      source_not_improved_count: 1,
      qualified_discovery_rate: 0
    });
  });

  it.each([
    ["source_not_improved"],
    ["not_reproduced"],
    ["evidence_ineligible"],
    ["paper_slot_expired"]
  ] as const)("keeps %s in the precommitted denominator with zero credit", (status) => {
    const fixture = outcomeFixture({ adaptiveStatus: status });

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(outcome.arms[0].slot_results[0]).toMatchObject({
      terminal_status: status,
      discovery_credit: 0,
      paper_slot_outcome_ref: {
        record_kind: "research_control_campaign_paper_slot_outcome"
      }
    });
    expect(outcome.arms[0].metrics.slot_count).toBe(1);
    expect(outcome.arms[0].metrics.qualified_discovery_rate).toBe(0);
  });

  it("adjudicates an all-no-candidate schedule with its protocol still bound", () => {
    const fixture = outcomeFixture({
      adaptiveCandidate: false,
      staticCandidate: false
    });

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(outcome.shared_evaluation_policy_status).toBe("bound");
    expect(outcome.observed_result).toBe("rates_equal");
    expect(outcome.arms.map((arm) => arm.metrics)).toEqual([
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
  });

  it.each([
    ["missing candidate outcome", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].slotOutcomes = [];
    }],
    ["duplicate candidate outcome", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].slotOutcomes.push(
        structuredClone(fixture.input.arms[0].slotOutcomes[0]!)
      );
    }],
    ["cross-arm outcome substitution", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].slotOutcomes = [
        structuredClone(fixture.input.arms[1].slotOutcomes[0]!)
      ];
    }],
    ["schedule digest drift", (fixture: OutcomeFixture) => {
      fixture.input.schedule.schedule_digest = digest("f");
    }],
    ["slot outcome digest drift", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].slotOutcomes[0]!.slot_outcome_digest = digest("f");
    }],
    ["slot candidate drift", (fixture: OutcomeFixture) => {
      const outcome = fixture.input.arms[0].slotOutcomes[0]!;
      outcome.candidate_ref.id = "substituted-candidate";
      resealSlotOutcome(outcome);
    }],
    ["adjudication before terminal", (fixture: OutcomeFixture) => {
      fixture.input.adjudicatedAt = "2026-07-12T11:59:59.999Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const fixture = outcomeFixture();
    mutate(fixture);

    expect(() => adjudicateResearchControlCampaignOutcome(fixture.input))
      .toThrow(ResearchControlCampaignOutcomeDecisionError);
  });

  it("persists once and replays the exact aggregate", async () => {
    const fixture = outcomeFixture();
    const store = new OutcomeStoreDouble(fixture.input);
    let now = "2026-07-12T13:00:00.000Z";
    const service = new ResearchControlCampaignOutcomeService({
      store: store as unknown as OuroborosStorePort,
      now: () => now
    });

    const request = withoutAdjudicatedAt(fixture.input);
    const first = await service.adjudicate(request);
    now = "2026-07-13T13:00:00.000Z";
    const replay = await service.adjudicate(request);

    expect(replay).toEqual(first);
    expect(replay.adjudicated_at).toBe("2026-07-12T13:00:00.000Z");
    expect(store.outcomeWrites).toBe(1);
  });

  it("rejects an arm outcome absent from the store graph", async () => {
    const fixture = outcomeFixture();
    const store = new OutcomeStoreDouble(fixture.input);
    store.slotOutcomes.clear();
    const service = new ResearchControlCampaignOutcomeService({
      store: store as unknown as OuroborosStorePort,
      now: () => "2026-07-12T13:00:00.000Z"
    });

    await expect(service.adjudicate(withoutAdjudicatedAt(fixture.input)))
      .rejects.toMatchObject({
        code: "research_control_campaign_outcome_graph_invalid"
      });
    expect(store.outcomeWrites).toBe(0);
  });
});

interface OutcomeFixture {
  input: AdjudicateResearchControlCampaignOutcomeInput;
}

function outcomeFixture(options: {
  adaptiveCandidate?: boolean;
  staticCandidate?: boolean;
  adaptiveStatus?: ResearchControlCampaignOutcomeTerminalStatus;
  staticStatus?: ResearchControlCampaignOutcomeTerminalStatus;
} = {}): OutcomeFixture {
  const campaign = campaignFixture();
  const adaptiveCandidate = options.adaptiveCandidate ?? true;
  const staticCandidate = options.staticCandidate ?? true;
  const report = reportFixture(campaign, adaptiveCandidate, staticCandidate);
  const schedule = decideResearchControlCampaignPaperSchedule({
    campaign,
    report,
    committedAt: "2026-07-12T11:00:00.000Z"
  });
  const adaptive = adaptiveCandidate
    ? [slotOutcomeFixture(
        schedule,
        0,
        options.adaptiveStatus ?? "qualified_improvement"
      )]
    : [];
  const control = staticCandidate
    ? [slotOutcomeFixture(
        schedule,
        1,
        options.staticStatus ?? "source_not_improved"
      )]
    : [];
  return {
    input: {
      campaign,
      report,
      schedule,
      arms: [
        { armKind: "adaptive_treatment", slotOutcomes: adaptive },
        { armKind: "static_control", slotOutcomes: control }
      ],
      adjudicatedAt: "2026-07-12T13:00:00.000Z"
    }
  };
}

function campaignFixture(): ResearchControlCampaignRecord {
  return decideResearchControlCampaign({
    idempotencyKey: "outcome-slot-test",
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
    paperEvaluationProtocol: boundPaperProtocolInput(),
    tickCountPerArm: 1,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
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
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function reportFixture(
  campaign: ResearchControlCampaignRecord,
  adaptiveCandidate: boolean,
  staticCandidate: boolean
): ResearchControlCampaignReportRecord {
  const report: ResearchControlCampaignReportRecord = {
    record_kind: "research_control_campaign_report",
    version: 1,
    research_control_campaign_report_id: "research-control-report-slot-outcome",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: [
      reportArm(campaign, 0, adaptiveCandidate),
      reportArm(campaign, 1, staticCandidate)
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
    arm_intent_digest: digest(armIndex === 0 ? "7" : "8"),
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
        system_code_artifact_digest: digest(armIndex === 0 ? "9" : "a"),
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `${suffix}-admission`
        }
      } : { status: "no_admitted_candidate" as const })
    }],
    final_store_snapshot_digest: digest(armIndex === 0 ? "b" : "c"),
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

function slotOutcomeFixture(
  schedule: AdjudicateResearchControlCampaignOutcomeInput["schedule"],
  armIndex: 0 | 1,
  status: ResearchControlCampaignOutcomeTerminalStatus
): ResearchControlCampaignPaperSlotOutcomeRecord {
  const armKind = armIndex === 0 ? "adaptive_treatment" : "static_control";
  const evidence = status === "source_not_improved"
    ? {
        evidence_kind: "source_verdict" as const,
        source_comparison_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: schedule.arms[armIndex].slots[0]!.slot_status === "candidate_scheduled"
            ? schedule.arms[armIndex].slots[0]!.source_comparison_commitment_id
            : "unreachable"
        },
        source_comparison_digest: digest("d"),
        source_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `${armKind}-source-verdict`
        },
        source_verdict_digest: digest("e"),
        terminal_status: "source_not_improved" as const
      }
    : status === "paper_slot_expired"
    ? {
        evidence_kind: "source_slot_expired" as const,
        terminal_status: "paper_slot_expired" as const,
        expired_at: "2026-07-12T12:00:00.000Z"
      }
    : {
        evidence_kind: "confirmation_release" as const,
        confirmation_campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: `${armKind}-confirmation-campaign`
        },
        confirmation_campaign_digest: digest("d"),
        confirmation_outcome_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
          id: `${armKind}-confirmation-outcome`
        },
        confirmation_outcome_digest: digest("e"),
        research_release_ref: {
          record_kind: "paper_trading_comparison_research_release",
          id: `${armKind}-research-release`
        },
        research_release_digest: digest("f"),
        release_kind: status === "qualified_improvement"
          ? "confirmed_improvement" as const
          : status === "not_reproduced"
          ? "challenger_not_reproduced" as const
          : "comparison_evidence_ineligible" as const,
        terminal_status: status
      };
  return decideResearchControlCampaignPaperSlotOutcome({
    schedule,
    armKind,
    sequence: 1,
    terminalEvidence: evidence,
    terminalAt: "2026-07-12T12:00:00.000Z"
  });
}

function resealSlotOutcome(
  outcome: ResearchControlCampaignPaperSlotOutcomeRecord
): void {
  outcome.slot_outcome_digest = canonicalDigest(
    researchControlCampaignPaperSlotOutcomeDigestInput(outcome)
  );
}

function withoutAdjudicatedAt(
  input: AdjudicateResearchControlCampaignOutcomeInput
) {
  const { adjudicatedAt: _adjudicatedAt, ...request } = input;
  return request;
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

class OutcomeStoreDouble {
  readonly slotOutcomes = new Map<string, ResearchControlCampaignPaperSlotOutcomeRecord>();
  outcome?: ReturnType<typeof adjudicateResearchControlCampaignOutcome>;
  outcomeWrites = 0;

  constructor(private readonly source: AdjudicateResearchControlCampaignOutcomeInput) {
    for (const outcome of source.arms.flatMap((arm) => arm.slotOutcomes)) {
      this.slotOutcomes.set(
        outcome.research_control_campaign_paper_slot_outcome_id,
        outcome
      );
    }
  }

  async getResearchControlCampaign(id: string) {
    return id === this.source.campaign.research_control_campaign_id
      ? this.source.campaign
      : undefined;
  }

  async getResearchControlCampaignReport(id: string) {
    return id === this.source.report.research_control_campaign_report_id
      ? this.source.report
      : undefined;
  }

  async getResearchControlCampaignPaperSchedule(id: string) {
    return id === this.source.schedule.research_control_campaign_paper_schedule_id
      ? this.source.schedule
      : undefined;
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return this.slotOutcomes.get(id);
  }

  async getResearchControlCampaignOutcome() {
    return this.outcome;
  }

  async recordResearchControlCampaignOutcome(
    outcome: ReturnType<typeof adjudicateResearchControlCampaignOutcome>
  ) {
    this.outcomeWrites += 1;
    this.outcome = outcome;
    return outcome;
  }
}
