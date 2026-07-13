import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  type ResearchControlStudyRecord
} from "./index";

describe("ResearchControlStudy", () => {
  it("accepts one strict six-replication same-baseline study", () => {
    expect(researchControlStudyHasRuntimeShape(studyFixture())).toBe(true);
  });

  it("keeps condition and study digest inputs independent of identities", () => {
    const study = studyFixture();
    const changed = structuredClone(study);
    changed.research_control_study_id = "other-study";
    changed.study_digest = digest("f");
    expect(researchControlStudyDigestInput(changed)).toBe(
      researchControlStudyDigestInput(study)
    );
    const changedCondition = structuredClone(study.condition);
    changedCondition.condition_digest = digest("0");
    expect(researchControlStudyConditionDigestInput(changedCondition)).toBe(
      researchControlStudyConditionDigestInput(study.condition)
    );
  });

  it.each([
    ["five replications", (value: any) => { value.replications.pop(); }],
    ["thirty-one replications", (value: any) => {
      value.replications = Array.from({ length: 31 }, (_, index) => ({
        ...value.replications[0],
        replication_index: index + 1,
        campaign_idempotency_key: `replication-${index + 1}`,
        campaign_ref: {
          record_kind: "research_control_campaign",
          id: `campaign-${index + 1}`
        }
      }));
    }],
    ["noncontiguous index", (value: any) => {
      value.replications[2].replication_index = 4;
    }],
    ["duplicate campaign", (value: any) => {
      value.replications[1].campaign_ref.id =
        value.replications[0].campaign_ref.id;
    }],
    ["duplicate idempotency key", (value: any) => {
      value.replications[1].campaign_idempotency_key =
        value.replications[0].campaign_idempotency_key;
    }],
    ["mixed baseline", (value: any) => {
      value.replications[1].expected_baseline_snapshot_digest = digest("1");
    }],
    ["analysis alpha drift", (value: any) => {
      value.analysis_policy.alpha = 0.1;
    }],
    ["unavailable comparator", (value: any) => {
      value.condition.paper_comparator = {
        comparator_status: "unavailable",
        reason: "no_trading_promotion_at_commitment"
      };
    }],
    ["unavailable paper protocol", (value: any) => {
      value.condition.paper_evaluation_protocol = {
        protocol_status: "unavailable",
        reason: "paper_configuration_unavailable_at_commitment"
      };
    }],
    ["condition digest format drift", (value: any) => {
      value.condition.condition_digest = "sha256:short";
    }],
    ["study digest format drift", (value: any) => {
      value.study_digest = "sha256:short";
    }],
    ["extra field", (value: any) => { value.winner = "adaptive"; }],
    ["policy replacement authority", (value: any) => {
      value.policy_replacement_authority = true;
    }],
    ["promotion authority", (value: any) => {
      value.promotion_authority = true;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }]
  ])("rejects %s", (_label, mutate) => {
    const study = studyFixture() as any;
    mutate(study);
    expect(researchControlStudyHasRuntimeShape(study)).toBe(false);
  });
});

function studyFixture(): ResearchControlStudyRecord {
  const baseline = digest("a");
  return {
    record_kind: "research_control_study",
    version: 1,
    research_control_study_id: "research-control-study-001",
    idempotency_key: "study-001",
    hypothesis:
      "adaptive_allocation_improves_replicated_qualified_discovery_yield",
    baseline_policy: "same_frozen_snapshot",
    baseline_snapshot_digest: baseline,
    condition: {
      source: {
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "source-candidate"
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "source-version"
        },
        system_code_ref: {
          record_kind: "system_code",
          id: "source-system-code"
        },
        system_code_artifact_digest: "sha256:fixture-system-code-v1",
        system_code_record_digest: digest("b"),
        research_artifact_protocol: "single_file_python_v1",
        research_artifact_closure_digest: digest("c")
      },
      research_agent: {
        provider: "fixture",
        model: "scripted-fixture",
        permission_policy: "fixture_only",
        identity_digest: digest("d")
      },
      paper_comparator: tradingReviewComparator(),
      paper_evaluation_protocol: boundPaperProtocol(),
      allocation_policy: {
        ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      },
      allocation_policy_digest: digest("e"),
      campaign_policy: campaignPolicy(),
      condition_digest: digest("f")
    },
    replications: Array.from({ length: 6 }, (_, index) => ({
      replication_index: index + 1,
      campaign_idempotency_key: `study-001-replication-${index + 1}`,
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: `research-control-campaign-${index + 1}`
      },
      expected_baseline_snapshot_digest: baseline
    })),
    analysis_policy: {
      policy_version: "paired_exact_sign_test_v1",
      primary_estimand:
        "mean_adaptive_minus_static_qualified_discovery_rate",
      significance_method: "two_sided_exact_sign_test",
      alpha: 0.05,
      minimum_non_tied_replication_count: 6,
      tie_policy: "exclude_from_sign_test_include_in_mean",
      minimum_mean_rate_difference: 0
    },
    committed_at: "2026-07-12T09:00:00.000Z",
    study_digest: digest("9"),
    research_scheduling_authority: true,
    evaluation_authority: false,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function tradingReviewComparator() {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: "promotion-001"
    },
    trading_promotion_digest: digest("1"),
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

function boundPaperProtocol() {
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
    market_data_configuration_digest: digest("2"),
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
    },
    protocol_digest: digest("3")
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
