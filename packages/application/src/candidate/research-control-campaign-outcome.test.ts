import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonResearchReleaseDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  type ArtifactLineageRecord,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonResearchReleaseKind,
  type PaperTradingComparisonResearchReleaseRecord,
  type ResearchControlCampaignArmReport,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchFindingKind,
  type ResearchFindingRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { decideResearchControlCampaign } from "./research-control-campaign";
import {
  type AdjudicateResearchControlCampaignOutcomeInput,
  ResearchControlCampaignOutcomeDecisionError,
  type ResearchControlCampaignOutcomeArmEvidence,
  ResearchControlCampaignOutcomeService,
  adjudicateResearchControlCampaignOutcome
} from "./research-control-campaign-outcome";

describe("ResearchControlCampaignOutcome application", () => {
  it("adjudicates prospective releases against one frozen Trading review comparator", () => {
    const fixture = outcomeFixture({
      adaptiveReleaseKind: "confirmed_improvement",
      staticReleaseKind: "challenger_not_reproduced"
    });

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(researchControlCampaignOutcomeHasRuntimeShape(outcome)).toBe(true);
    expect(outcome.arms.map((arm) => arm.metrics)).toEqual([
      {
        slot_count: 1,
        admitted_candidate_slot_count: 1,
        no_admitted_candidate_count: 0,
        qualified_discovery_count: 1,
        not_reproduced_count: 0,
        evidence_ineligible_count: 0,
        paper_slot_expired_count: 0,
        qualified_discovery_rate: 1
      },
      {
        slot_count: 1,
        admitted_candidate_slot_count: 1,
        no_admitted_candidate_count: 0,
        qualified_discovery_count: 0,
        not_reproduced_count: 1,
        evidence_ineligible_count: 0,
        paper_slot_expired_count: 0,
        qualified_discovery_rate: 0
      }
    ]);
    expect(outcome).toMatchObject({
      observed_rate_difference: 1,
      observed_result: "adaptive_rate_higher",
      causal_conclusion: "single_campaign_observation_only",
      policy_replacement_eligibility: "not_eligible",
      next_action: "accumulate_replicated_control_campaigns",
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
  });

  it.each([
    ["challenger_not_reproduced", "not_reproduced"],
    ["comparison_evidence_ineligible", "evidence_ineligible"],
    ["campaign_slot_expired", "paper_slot_expired"]
  ] as const)("maps %s into terminal status %s", (releaseKind, terminalStatus) => {
    const fixture = outcomeFixture({
      adaptiveReleaseKind: releaseKind,
      staticReleaseKind: releaseKind
    });

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(outcome.arms[0].slot_results[0]).toMatchObject({
      terminal_status: terminalStatus,
      release_kind: releaseKind,
      discovery_credit: 0
    });
    expect(outcome.observed_result).toBe("rates_equal");
  });

  it("counts every precommitted slot when no candidate was admitted", () => {
    const fixture = outcomeFixture({
      adaptiveCandidate: false,
      staticReleaseKind: "challenger_not_reproduced"
    });

    const outcome = adjudicateResearchControlCampaignOutcome(fixture.input);

    expect(outcome.arms[0]).toMatchObject({
      slot_results: [{
        sequence: 1,
        terminal_status: "no_admitted_candidate",
        discovery_credit: 0
      }],
      metrics: {
        slot_count: 1,
        admitted_candidate_slot_count: 0,
        no_admitted_candidate_count: 1,
        qualified_discovery_rate: 0
      }
    });
  });

  it.each([
    ["unavailable comparator", (fixture: OutcomeFixture) => {
      fixture.input.campaign.paper_comparator = {
        comparator_status: "unavailable",
        reason: "no_trading_promotion_at_commitment"
      };
    }],
    ["missing candidate closure", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].paperClosures = [];
    }],
    ["duplicate candidate closure", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].paperClosures.push(
        structuredClone(fixture.input.arms[0].paperClosures[0]!)
      );
    }],
    ["bootstrap comparison", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[0].paperClosures[0]!;
      closure.confirmationCampaign.comparison_policy.comparison_mode =
        "bootstrap";
      closure.confirmationCampaign.champion_selection = {
        selection_kind: "bootstrap"
      };
      resealClosure(closure);
    }],
    ["changed champion", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[0].paperClosures[0]!;
      closure.confirmationCampaign.champion.candidate_ref.id =
        "other-champion";
      resealClosure(closure);
    }],
    ["changed challenger", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[0].paperClosures[0]!;
      closure.confirmationCampaign.challenger.candidate_version_ref.id =
        "other-challenger-version";
      resealClosure(closure);
    }],
    ["policy drift between arms", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[1].paperClosures[0]!;
      closure.confirmationCampaign.comparison_policy.minimum_net_revenue_lift_usdt +=
        1;
      resealClosure(closure);
    }],
    ["release graph drift", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[0].paperClosures[0]!;
      closure.researchRelease.campaign_digest = digest("f");
      resealRelease(closure.researchRelease);
    }],
    ["release classification drift", (fixture: OutcomeFixture) => {
      const closure = fixture.input.arms[0].paperClosures[0]!;
      closure.researchRelease.release_kind = "challenger_not_reproduced";
      closure.researchRelease.finding.finding_kind = "negative_result";
      resealRelease(closure.researchRelease);
    }],
    ["campaign digest drift", (fixture: OutcomeFixture) => {
      fixture.input.arms[0].paperClosures[0]!
        .confirmationCampaign.campaign_digest = digest("f");
    }],
    ["adjudication before release", (fixture: OutcomeFixture) => {
      fixture.input.adjudicatedAt = "2026-07-12T12:30:00.000Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const fixture = outcomeFixture();
    mutate(fixture);

    expect(() => adjudicateResearchControlCampaignOutcome(fixture.input))
      .toThrow(ResearchControlCampaignOutcomeDecisionError);
  });

  it("persists once and replays the exact terminal outcome", async () => {
    const fixture = outcomeFixture();
    const store = new OutcomeStoreDouble(fixture.input.campaign, fixture.input.report);
    let now = "2026-07-12T14:00:00.000Z";
    const service = new ResearchControlCampaignOutcomeService({
      store: store as unknown as OuroborosStorePort,
      now: () => now
    });

    const first = await service.adjudicate({
      campaign: fixture.input.campaign,
      report: fixture.input.report,
      arms: fixture.input.arms
    });
    now = "2026-07-13T14:00:00.000Z";
    const replay = await service.adjudicate({
      campaign: fixture.input.campaign,
      report: fixture.input.report,
      arms: fixture.input.arms
    });

    expect(replay).toEqual(first);
    expect(store.outcomeWrites).toBe(1);
  });
});

type OutcomeFixture = ReturnType<typeof outcomeFixture>;

function outcomeFixture(options: {
  adaptiveCandidate?: boolean;
  adaptiveReleaseKind?: PaperTradingComparisonResearchReleaseKind;
  staticReleaseKind?: PaperTradingComparisonResearchReleaseKind;
} = {}) {
  const campaign = campaignFixture();
  const adaptiveCandidate = options.adaptiveCandidate ?? true;
  const report = reportFixture(campaign, adaptiveCandidate);
  const adaptiveClosure = adaptiveCandidate
    ? paperClosureFixture(
        campaign,
        report,
        0,
        options.adaptiveReleaseKind ?? "confirmed_improvement"
      )
    : undefined;
  const staticClosure = paperClosureFixture(
    campaign,
    report,
    1,
    options.staticReleaseKind ?? "challenger_not_reproduced"
  );
  const arms: [
    ResearchControlCampaignOutcomeArmEvidence,
    ResearchControlCampaignOutcomeArmEvidence
  ] = [
    {
      armKind: "adaptive_treatment",
      paperClosures: adaptiveClosure ? [adaptiveClosure] : []
    },
    {
      armKind: "static_control",
      paperClosures: [staticClosure]
    }
  ];
  const input: AdjudicateResearchControlCampaignOutcomeInput = {
    campaign,
    report,
    arms,
    adjudicatedAt: "2026-07-12T14:00:00.000Z"
  };
  return {
    input
  };
}

function campaignFixture(): ResearchControlCampaignRecord {
  return decideResearchControlCampaign({
    idempotencyKey: "outcome-test",
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
    research_control_campaign_report_id: "research-control-report-outcome-test",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: [
      reportArm(campaign, 0, adaptiveCandidate),
      reportArm(campaign, 1, true)
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
    population_diversity: diversityFixture(
      arm.tick_ids[0]!,
      hasCandidate
    ),
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
        system_code_artifact_digest: digest(armIndex === 0 ? "8" : "9"),
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
  const observed = hasCandidate ? {
    measurement_status: "insufficient_evidence" as const,
    sample_count: 1,
    unique_count: 1,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: 1,
    admitted_submission_count: 1,
    exact_behavior_duplicate_count: 0,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  } : {
    measurement_status: "insufficient_evidence" as const,
    sample_count: 0,
    unique_count: 0,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: 0,
    admitted_submission_count: 0,
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

function paperClosureFixture(
  controlCampaign: ResearchControlCampaignRecord,
  report: ResearchControlCampaignReportRecord,
  armIndex: 0 | 1,
  releaseKind: PaperTradingComparisonResearchReleaseKind
) {
  const slot = report.arms[armIndex].paper_candidate_slots[0]!;
  if (slot.status !== "candidate_reserved") throw new Error("candidate_required");
  const suffix = armIndex === 0 ? "adaptive" : "static";
  const confirmationCampaign = confirmationCampaignFixture(
    controlCampaign,
    slot,
    suffix
  );
  const confirmationOutcome = confirmationOutcomeFixture(
    confirmationCampaign,
    releaseKind
  );
  const researchRelease = researchReleaseFixture(
    confirmationCampaign,
    confirmationOutcome,
    releaseKind,
    suffix
  );
  return {
    sequence: 1,
    tickRef: { ...slot.tick_ref },
    confirmationCampaign,
    confirmationOutcome,
    researchRelease
  };
}

function confirmationCampaignFixture(
  controlCampaign: ResearchControlCampaignRecord,
  slot: Extract<
    ResearchControlCampaignArmReport["paper_candidate_slots"][number],
    { status: "candidate_reserved" }
  >,
  suffix: string
): PaperTradingComparisonConfirmationCampaignRecord {
  const comparator = controlCampaign.paper_comparator;
  if (comparator.comparator_status !== "trading_review") {
    throw new Error("comparator_required");
  }
  const campaignId = `confirmation-${suffix}`;
  const campaign: PaperTradingComparisonConfirmationCampaignRecord = {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: campaignId,
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: `${suffix}-source-verdict`
    },
    source_verdict_digest: digest("c"),
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `${suffix}-source-comparison`
    },
    source_comparison_digest: digest("d"),
    champion: comparisonSide(
      "champion",
      comparator.candidate_ref.id,
      comparator.candidate_version_ref.id,
      "champion-code",
      digest("e")
    ),
    challenger: comparisonSide(
      "challenger",
      slot.candidate_ref.id,
      slot.candidate_version_ref.id,
      slot.system_code_ref.id,
      slot.system_code_artifact_digest
    ),
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: { ...comparator.trading_promotion_ref },
      trading_promotion_digest: comparator.trading_promotion_digest,
      paper_trading_evaluation_ref: {
        ...comparator.paper_trading_evaluation_ref
      },
      paper_trading_evaluation_record_digest: digest("1"),
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "champion-evaluation-commitment"
      },
      paper_trading_evaluation_commitment_record_digest: digest("2"),
      paper_trading_observation_chain_digest: digest("3")
    },
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
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
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
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 1,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms: 600_000,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [{
      slot_index: 1,
      comparison_idempotency_key:
        `paper-comparison-confirmation:${campaignId}:slot:1`,
      paper_trading_comparison_preparation_id:
        `paper-trading-comparison-preparation-${suffix === "adaptive"
          ? "1111111111111111"
          : "2222222222222222"}`,
      paper_trading_comparison_commitment_id:
        `paper-trading-comparison-${suffix === "adaptive"
          ? "1111111111111111"
          : "2222222222222222"}`
    }],
    committed_at: "2026-07-12T11:00:00.000Z",
    campaign_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  campaign.campaign_digest = canonicalDigest(
    paperTradingComparisonConfirmationCampaignDigestInput(campaign)
  );
  return campaign;
}

function comparisonSide(
  role: "champion" | "challenger",
  candidateId: string,
  candidateVersionId: string,
  systemCodeId: string,
  artifactDigest: string
) {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: candidateId
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidateVersionId
    },
    candidate_version_digest: digest(role === "champion" ? "5" : "6"),
    system_code_ref: { record_kind: "system_code", id: systemCodeId },
    system_code_record_digest: digest(role === "champion" ? "7" : "8"),
    system_code_artifact_digest: artifactDigest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `${candidateId}-admission`
    },
    admission_decision_digest: digest(role === "champion" ? "9" : "a")
  } as const;
}

function confirmationOutcomeFixture(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  releaseKind: PaperTradingComparisonResearchReleaseKind
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const status = releaseKind === "confirmed_improvement"
    ? "challenger_improved"
    : releaseKind === "challenger_not_reproduced"
    ? "challenger_not_improved"
    : releaseKind === "comparison_evidence_ineligible"
    ? "comparison_ineligible"
    : "slot_expired";
  const confirmed = status === "challenger_improved";
  const outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord = {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      `${campaign.paper_trading_comparison_confirmation_campaign_id}-outcome`,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    slot_results: [{
      slot_index: 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: campaign.slots[0]!.paper_trading_comparison_commitment_id
      },
      status,
      ...(status === "slot_expired" ? {} : {
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `${campaign.paper_trading_comparison_confirmation_campaign_id}-verdict`
        },
        verdict_digest: digest("b"),
        window_started_at: "2026-07-12T11:30:00.000Z",
        window_ended_at: "2026-07-12T12:00:00.000Z"
      })
    }],
    improved_count: confirmed ? 1 : 0,
    not_improved_count: status === "challenger_not_improved" ? 1 : 0,
    ineligible_count: status === "comparison_ineligible" ? 1 : 0,
    expired_count: status === "slot_expired" ? 1 : 0,
    campaign_outcome: confirmed ? "confirmed_improvement" : "not_confirmed",
    decision_rule: "all_reserved_windows_must_improve",
    promotion_eligibility: confirmed ? "eligible" : "not_eligible",
    release_status: "sealed",
    next_action: confirmed
      ? "review_for_trading_promotion"
      : "return_to_candidate_arena",
    evaluated_at: "2026-07-12T12:30:00.000Z",
    outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  outcome.outcome_digest = canonicalDigest(
    paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)
  );
  return outcome;
}

function researchReleaseFixture(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  releaseKind: PaperTradingComparisonResearchReleaseKind,
  suffix: string
): PaperTradingComparisonResearchReleaseRecord {
  const releaseId =
    `${outcome.paper_trading_comparison_confirmation_campaign_outcome_id}` +
    "-research-release";
  const findingKind: ResearchFindingKind = releaseKind === "confirmed_improvement"
    ? "positive_result"
    : releaseKind === "challenger_not_reproduced"
    ? "negative_result"
    : "failure_analysis";
  const releasedAt = "2026-07-12T13:00:00.000Z";
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `${releaseId}-finding`,
    research_worker_ref: { record_kind: "research_worker", id: `${suffix}-worker` },
    research_direction_ref: {
      record_kind: "research_direction",
      id: `${suffix}-direction`
    },
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: `${suffix}-experiment`
    },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: `${suffix}-evaluation-result`
    },
    finding_kind: findingKind,
    summary: `Terminal release ${releaseKind}.`,
    supporting_record_refs: [
      { record_kind: "research_finding", id: `${suffix}-source-finding` },
      { ...outcome.campaign_ref },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
      },
      ...outcome.slot_results.flatMap((result) =>
        result.verdict_ref ? [{ ...result.verdict_ref }] : []
      )
    ],
    created_at: releasedAt,
    authority_status: "research_trace_only"
  };
  const lineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: `${releaseId}-lineage`,
    child_system_code_ref: { ...campaign.challenger.system_code_ref },
    parent_system_code_ref: {
      record_kind: "system_code",
      id: `${suffix}-parent-code`
    },
    source_finding_refs: [
      { record_kind: "research_finding", id: `${suffix}-source-finding` },
      { record_kind: "research_finding", id: finding.research_finding_id }
    ],
    created_by_research_worker_ref: { ...finding.research_worker_ref },
    created_at: releasedAt,
    authority_status: "lineage_only"
  };
  const release: PaperTradingComparisonResearchReleaseRecord = {
    record_kind: "paper_trading_comparison_research_release",
    version: 1,
    paper_trading_comparison_research_release_id: releaseId,
    campaign_ref: { ...outcome.campaign_ref },
    campaign_digest: campaign.campaign_digest,
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    },
    campaign_outcome_digest: outcome.outcome_digest,
    candidate_ref: { ...campaign.challenger.candidate_ref },
    candidate_version_ref: { ...campaign.challenger.candidate_version_ref },
    system_code_ref: { ...campaign.challenger.system_code_ref },
    system_code_artifact_digest:
      campaign.challenger.system_code_artifact_digest,
    source_finding_ref: {
      record_kind: "research_finding",
      id: `${suffix}-source-finding`
    },
    source_finding_record_digest: digest("c"),
    source_lineage_ref: {
      record_kind: "artifact_lineage",
      id: `${suffix}-source-lineage`
    },
    source_lineage_record_digest: digest("d"),
    direction_kind: "mean_reversion",
    release_kind: releaseKind,
    finding,
    finding_record_digest: digest("e"),
    lineage,
    lineage_record_digest: digest("f"),
    next_research_focus: "Generate the next controlled candidate population.",
    released_at: releasedAt,
    release_digest: digest("0"),
    research_visibility: "released_to_research",
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "lineage_only"
  };
  resealRelease(release);
  return release;
}

function resealClosure(closure: {
  confirmationCampaign: PaperTradingComparisonConfirmationCampaignRecord;
  confirmationOutcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  researchRelease: PaperTradingComparisonResearchReleaseRecord;
}) {
  closure.confirmationCampaign.campaign_digest = canonicalDigest(
    paperTradingComparisonConfirmationCampaignDigestInput(
      closure.confirmationCampaign
    )
  );
  closure.confirmationOutcome.campaign_digest =
    closure.confirmationCampaign.campaign_digest;
  closure.confirmationOutcome.outcome_digest = canonicalDigest(
    paperTradingComparisonConfirmationCampaignOutcomeDigestInput(
      closure.confirmationOutcome
    )
  );
  closure.researchRelease.campaign_digest =
    closure.confirmationCampaign.campaign_digest;
  closure.researchRelease.campaign_outcome_digest =
    closure.confirmationOutcome.outcome_digest;
  resealRelease(closure.researchRelease);
}

function resealRelease(release: PaperTradingComparisonResearchReleaseRecord) {
  release.release_digest = canonicalDigest(
    paperTradingComparisonResearchReleaseDigestInput(release)
  );
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

class OutcomeStoreDouble {
  private outcome?: ResearchControlCampaignOutcomeRecord;
  outcomeWrites = 0;

  constructor(
    private readonly campaign: ResearchControlCampaignRecord,
    private readonly report: ResearchControlCampaignReportRecord
  ) {}

  async getResearchControlCampaign(id: string) {
    return id === this.campaign.research_control_campaign_id
      ? structuredClone(this.campaign)
      : undefined;
  }

  async getResearchControlCampaignReport(id: string) {
    return id === this.report.research_control_campaign_report_id
      ? structuredClone(this.report)
      : undefined;
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
