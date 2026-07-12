import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlCampaignArmIntentDigestInput,
  researchControlCampaignArmIntentHasRuntimeShape,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "./index";

describe("ResearchControlCampaign", () => {
  it("accepts one equal-bound pre-effect adaptive/static campaign", () => {
    expect(researchControlCampaignHasRuntimeShape(campaignFixture())).toBe(true);
  });

  it("accepts an exact pre-effect Trading review comparator", () => {
    const campaign = campaignFixture();
    campaign.paper_comparator = {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "trading-promotion-001"
      },
      trading_promotion_digest: digest("8"),
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
        id: "champion-paper-evaluation"
      }
    };

    expect(researchControlCampaignHasRuntimeShape(campaign)).toBe(true);
  });

  it("binds every causal campaign field into the digest input", () => {
    const baseline = campaignFixture();
    const digestInput = researchControlCampaignDigestInput(baseline);
    const mutations: Array<(value: ResearchControlCampaignRecord) => void> = [
      (value) => { value.baseline.snapshot_digest = digest("b"); },
      (value) => { value.source.system_code_artifact_digest = digest("c"); },
      (value) => { value.research_agent.model = "different-model"; },
      (value) => {
        value.paper_comparator = {
          comparator_status: "trading_review",
          trading_promotion_ref: {
            record_kind: "trading_promotion",
            id: "trading-promotion-001"
          },
          trading_promotion_digest: digest("8"),
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
            id: "champion-paper-evaluation"
          }
        };
      },
      (value) => { value.arms[0]!.tick_ids[0] = "different-tick"; },
      (value) => { value.policy.tick_count_per_arm = 2; },
      (value) => { value.committed_at = "2026-07-12T12:00:00.000Z"; },
      (value) => { value.promotion_authority = true as false; }
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(researchControlCampaignDigestInput(changed)).not.toBe(digestInput);
    }
  });

  it.each([
    ["extra winner field", (value: any) => { value.winner = "adaptive_treatment"; }],
    ["missing comparator", (value: any) => { delete value.paper_comparator; }],
    ["unknown comparator status", (value: any) => {
      value.paper_comparator.comparator_status = "select_later";
    }],
    ["unavailable comparator with promotion", (value: any) => {
      value.paper_comparator.trading_promotion_ref = {
        record_kind: "trading_promotion",
        id: "promotion-later"
      };
    }],
    ["malformed Trading review comparator", (value: any) => {
      value.paper_comparator = {
        comparator_status: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: "promotion-001"
        },
        trading_promotion_digest: "sha256:short",
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "champion"
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
    }],
    ["reversed arms", (value: any) => { value.arms.reverse(); }],
    ["unequal arm tick counts", (value: any) => { value.arms[1].tick_ids = []; }],
    ["duplicate cross-arm tick", (value: any) => {
      value.arms[1].tick_ids[0] = value.arms[0].tick_ids[0];
    }],
    ["duplicate arm intent id", (value: any) => {
      value.arms[1].research_control_campaign_arm_intent_id =
        value.arms[0].research_control_campaign_arm_intent_id;
    }],
    ["wrong treatment mode", (value: any) => {
      value.arms[0].allocation_mode = "static_control";
    }],
    ["explicit arm mode", (value: any) => {
      value.arms[1].allocation_mode = "explicit";
    }],
    ["zero ticks", (value: any) => { value.policy.tick_count_per_arm = 0; }],
    ["too many ticks", (value: any) => { value.policy.tick_count_per_arm = 6; }],
    ["unequal budget", (value: any) => {
      value.policy.maximum_total_development_submissions_per_tick = 4;
    }],
    ["allocation policy drift", (value: any) => {
      value.allocation_policy.concurrency_limit = 3;
    }],
    ["allocation digest missing", (value: any) => {
      value.allocation_policy_digest = "";
    }],
    ["unbounded file count", (value: any) => {
      value.policy.maximum_baseline_regular_file_count = 100_001;
    }],
    ["unbounded bytes", (value: any) => {
      value.policy.maximum_baseline_total_bytes = 1_000_000_001;
    }],
    ["slot count mismatch", (value: any) => {
      value.policy.paper_candidate_slot_count_per_arm = 2;
    }],
    ["noncanonical snapshot protocol", (value: any) => {
      value.baseline.protocol_version = "recursive-copy-v0";
    }],
    ["malformed snapshot digest", (value: any) => {
      value.baseline.snapshot_digest = "sha256:short";
    }],
    ["empty baseline", (value: any) => { value.baseline.regular_file_count = 0; }],
    ["agent identity drift", (value: any) => {
      value.research_agent.identity_digest = "sha256:short";
    }],
    ["invalid candidate ref", (value: any) => {
      value.source.candidate_ref.record_kind = "candidate_version";
    }],
    ["noncanonical time", (value: any) => {
      value.committed_at = "2026-07-12 10:00:00";
    }],
    ["promotion authority", (value: any) => { value.promotion_authority = true; }],
    ["order authority", (value: any) => { value.order_submission_authority = true; }],
    ["live authority", (value: any) => { value.live_exchange_authority = true; }]
  ])("rejects %s", (_label, mutate) => {
    const campaign = campaignFixture() as any;
    mutate(campaign);
    expect(researchControlCampaignHasRuntimeShape(campaign)).toBe(false);
  });
});

describe("ResearchControlCampaignArmIntent", () => {
  it("accepts an exact pre-effect treatment intent", () => {
    expect(researchControlCampaignArmIntentHasRuntimeShape(
      armIntentFixture("adaptive_treatment")
    )).toBe(true);
  });

  it("binds baseline, campaign, arm, ticks, and time into the digest input", () => {
    const baseline = armIntentFixture("adaptive_treatment");
    const digestInput = researchControlCampaignArmIntentDigestInput(baseline);
    const changed = structuredClone(baseline);
    changed.tick_ids[0] = "different-tick";

    expect(researchControlCampaignArmIntentDigestInput(changed)).not.toBe(
      digestInput
    );
  });

  it.each([
    ["extra store path", (value: any) => { value.store_root = "/tmp/arm"; }],
    ["wrong treatment mode", (value: any) => {
      value.allocation_mode = "static_control";
    }],
    ["duplicate tick", (value: any) => { value.tick_ids.push(value.tick_ids[0]); }],
    ["missing tick", (value: any) => { value.tick_ids = []; }],
    ["malformed baseline digest", (value: any) => {
      value.baseline_snapshot_digest = "sha256:short";
    }],
    ["malformed campaign digest", (value: any) => {
      value.campaign_digest = "sha256:short";
    }],
    ["research authority removed", (value: any) => {
      value.research_scheduling_authority = false;
    }],
    ["promotion authority", (value: any) => { value.promotion_authority = true; }]
  ])("rejects %s", (_label, mutate) => {
    const intent = armIntentFixture("adaptive_treatment") as any;
    mutate(intent);
    expect(researchControlCampaignArmIntentHasRuntimeShape(intent)).toBe(false);
  });
});

describe("ResearchControlCampaignReport", () => {
  it("accepts a terminal research-only report with an unadjudicated outcome", () => {
    expect(researchControlCampaignReportHasRuntimeShape(reportFixture())).toBe(true);
  });

  it("binds both diagnostics and reservations without admitting a winner", () => {
    const baseline = reportFixture();
    const digestInput = researchControlCampaignReportDigestInput(baseline);
    const changed = structuredClone(baseline);
    changed.arms[0]!.diagnostics.provider_request_total += 1;

    expect(researchControlCampaignReportDigestInput(changed)).not.toBe(
      digestInput
    );
  });

  it.each([
    ["extra winner field", (value: any) => { value.winner = "adaptive_treatment"; }],
    ["adjudicated result", (value: any) => {
      value.primary_outcome_status = "adaptive_improved";
    }],
    ["causal conclusion", (value: any) => {
      value.causal_conclusion = "adaptive_better";
    }],
    ["reversed arms", (value: any) => { value.arms.reverse(); }],
    ["duplicate arm intent", (value: any) => {
      value.arms[1].arm_intent_ref = value.arms[0].arm_intent_ref;
    }],
    ["wrong treatment mode", (value: any) => {
      value.arms[0].allocation_mode = "static_control";
    }],
    ["tick allocation length mismatch", (value: any) => {
      value.arms[0].allocation_refs = [];
    }],
    ["diagnostic total mismatch", (value: any) => {
      value.arms[0].diagnostics.failed_count = 0;
    }],
    ["attempt count above fixed slots", (value: any) => {
      value.arms[0].diagnostics.attempt_count = 4;
      value.arms[0].diagnostics.failed_count = 2;
    }],
    ["paper slot sequence mismatch", (value: any) => {
      value.arms[0].paper_candidate_slots[0].sequence = 2;
    }],
    ["paper slot tick mismatch", (value: any) => {
      value.arms[0].paper_candidate_slots[0].tick_ref.id = "other-tick";
    }],
    ["reserved count mismatch", (value: any) => {
      value.arms[0].diagnostics.admitted_candidate_count = 0;
    }],
    ["diversity tick mismatch", (value: any) => {
      value.arms[0].population_diversity.window_tick_count = 0;
    }],
    ["diversity attempts mismatch", (value: any) => {
      value.arms[0].population_diversity.assigned_directions.sample_count = 2;
    }],
    ["malformed final snapshot", (value: any) => {
      value.arms[0].final_store_snapshot_digest = "sha256:short";
    }],
    ["noncanonical completion time", (value: any) => {
      value.completed_at = "2026-07-12 11:00:00";
    }],
    ["promotion authority", (value: any) => { value.promotion_authority = true; }],
    ["order authority", (value: any) => { value.order_submission_authority = true; }],
    ["live authority", (value: any) => { value.live_exchange_authority = true; }]
  ])("rejects %s", (_label, mutate) => {
    const report = reportFixture() as any;
    mutate(report);
    expect(researchControlCampaignReportHasRuntimeShape(report)).toBe(false);
  });

  it("accepts an explicit no-candidate paper slot", () => {
    const report = reportFixture();
    const arm = report.arms[0]!;
    arm.paper_candidate_slots = [{
      sequence: 1,
      tick_ref: { ...arm.tick_refs[0]! },
      status: "no_admitted_candidate"
    }];
    arm.diagnostics.admitted_candidate_count = 0;
    arm.diagnostics.duplicate_count = 2;
    arm.population_diversity.observed_behaviors.admitted_submission_count = 0;
    arm.population_diversity.observed_behaviors.exact_behavior_duplicate_count = 2;
    arm.population_diversity.by_direction[0]!.admitted_submission_count = 0;
    arm.population_diversity.by_direction[0]!.exact_behavior_duplicate_count = 1;
    arm.population_diversity.tick_series[0]!.observed_behaviors
      .admitted_submission_count = 0;
    arm.population_diversity.tick_series[0]!.observed_behaviors
      .exact_behavior_duplicate_count = 2;

    expect(researchControlCampaignReportHasRuntimeShape(report)).toBe(true);
  });
});

function campaignFixture(): ResearchControlCampaignRecord {
  return {
    record_kind: "research_control_campaign",
    version: 1,
    research_control_campaign_id: "research-control-campaign-allocation-001",
    idempotency_key: "allocation-ablation-001",
    hypothesis:
      "adaptive_allocation_improves_prospective_qualified_discovery_yield",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("a"),
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
      system_code_ref: { record_kind: "system_code", id: "system-code-fixture" },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("b"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("7")
    },
    research_agent: {
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only",
      identity_digest: digest("c")
    },
    paper_comparator: {
      comparator_status: "unavailable",
      reason: "no_trading_promotion_at_commitment"
    },
    allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    allocation_policy_digest: digest("d"),
    arms: [
      {
        arm_kind: "adaptive_treatment",
        allocation_mode: "adaptive_default",
        research_control_campaign_arm_intent_id:
          "research-control-campaign-arm-intent-allocation-001-adaptive",
        tick_ids: ["research-control-allocation-001-adaptive-1"]
      },
      {
        arm_kind: "static_control",
        allocation_mode: "static_control",
        research_control_campaign_arm_intent_id:
          "research-control-campaign-arm-intent-allocation-001-static",
        tick_ids: ["research-control-allocation-001-static-1"]
      }
    ],
    policy: {
      policy_version: "research_control_campaign_v1",
      tick_count_per_arm: 1,
      worker_slot_count_per_tick: 3,
      concurrency_limit_per_arm: 2,
      maximum_total_development_submissions_per_tick: 5,
      arm_execution_policy: "concurrent_per_sequence",
      maximum_baseline_regular_file_count: 10_000,
      maximum_baseline_total_bytes: 1_000_000_000,
      paper_candidate_slot_count_per_arm: 1,
      paper_candidate_reservation_rule:
        "first_admitted_per_tick_in_allocation_order",
      primary_metric_kind:
        "prospective_qualified_candidate_discovery_rate",
      required_future_evidence:
        "confirmed_comparison_research_release"
    },
    committed_at: "2026-07-12T10:00:00.000Z",
    campaign_digest: digest("e"),
    research_scheduling_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function armIntentFixture(
  armKind: "adaptive_treatment" | "static_control"
): ResearchControlCampaignArmIntentRecord {
  const campaign = campaignFixture();
  const arm = campaign.arms.find((candidate) => candidate.arm_kind === armKind)!;
  return {
    record_kind: "research_control_campaign_arm_intent",
    version: 1,
    research_control_campaign_arm_intent_id:
      arm.research_control_campaign_arm_intent_id,
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arm_kind: arm.arm_kind,
    allocation_mode: arm.allocation_mode,
    baseline_snapshot_digest: campaign.baseline.snapshot_digest,
    tick_ids: [...arm.tick_ids],
    committed_at: "2026-07-12T10:00:01.000Z",
    intent_digest: digest(armKind === "adaptive_treatment" ? "f" : "1"),
    research_scheduling_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function reportFixture(): ResearchControlCampaignReportRecord {
  const campaign = campaignFixture();
  return {
    record_kind: "research_control_campaign_report",
    version: 1,
    research_control_campaign_report_id:
      "research-control-campaign-report-allocation-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: campaign.arms.map((arm, index) => ({
      arm_kind: arm.arm_kind,
      allocation_mode: arm.allocation_mode,
      arm_intent_ref: {
        record_kind: "research_control_campaign_arm_intent",
        id: arm.research_control_campaign_arm_intent_id
      },
      arm_intent_digest: digest(index === 0 ? "f" : "1"),
      tick_refs: arm.tick_ids.map((tickId) => ({
        record_kind: "candidate_arena_tick",
        id: `candidate-arena-tick-${tickId}`
      })),
      allocation_refs: arm.tick_ids.map((tickId) => ({
        record_kind: "candidate_arena_research_allocation",
        id: `candidate-arena-research-allocation-${tickId}`
      })),
      diagnostics: {
        attempt_count: 3,
        admitted_candidate_count: 1,
        duplicate_count: 1,
        quarantined_count: 0,
        failed_count: 1,
        provider_request_total: 12,
        runner_command_total: 6,
        scenario_count: 18,
        elapsed_ms: 400
      },
      population_diversity: diversityFixture(arm.tick_ids[0]!),
      paper_candidate_slots: [{
        sequence: 1,
        tick_ref: {
          record_kind: "candidate_arena_tick",
          id: `candidate-arena-tick-${arm.tick_ids[0]}`
        },
        status: "candidate_reserved",
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
        system_code_artifact_digest: digest(index === 0 ? "2" : "3"),
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `candidate-admission-${index + 1}`
        }
      }],
      final_store_snapshot_digest: digest(index === 0 ? "4" : "5"),
      completed_at: "2026-07-12T10:30:00.000Z",
      research_diagnostics_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    })) as ResearchControlCampaignReportRecord["arms"],
    primary_outcome_status: "unadjudicated",
    causal_conclusion: "not_available_from_research_phase",
    next_action: "schedule_prospective_paper_slots",
    completed_at: "2026-07-12T10:30:01.000Z",
    report_digest: digest("6"),
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function diversityFixture(tickId: string): ResearchPopulationDiversityReadModel {
  const assigned = {
    measurement_status: "measured" as const,
    sample_count: 3,
    unique_count: 3,
    entropy_bits: 1.584963,
    normalized_entropy: 1
  };
  const observed = {
    measurement_status: "measured" as const,
    sample_count: 2,
    unique_count: 1,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: 1,
    admitted_submission_count: 1,
    exact_behavior_duplicate_count: 1,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  };
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 1,
    assigned_directions: { ...assigned },
    observed_behaviors: { ...observed },
    by_direction: [
      {
        direction_kind: "trend_following",
        attempt_count: 1,
        observed_behavior_count: 1,
        unique_behavior_count: 1,
        admitted_submission_count: 1,
        exact_behavior_duplicate_count: 0
      },
      {
        direction_kind: "mean_reversion",
        attempt_count: 1,
        observed_behavior_count: 1,
        unique_behavior_count: 1,
        admitted_submission_count: 0,
        exact_behavior_duplicate_count: 1
      },
      {
        direction_kind: "volatility_regime",
        attempt_count: 1,
        observed_behavior_count: 0,
        unique_behavior_count: 0,
        admitted_submission_count: 0,
        exact_behavior_duplicate_count: 0
      }
    ],
    tick_series: [{
      tick_id: tickId,
      completed_at: "2026-07-12T10:20:00.000Z",
      assigned_directions: { ...assigned },
      observed_behaviors: { ...observed },
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    }],
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
