import { createHash } from "node:crypto";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlStudyOutcomeDigestInput,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import {
  decideResearchControlStudy,
  type ResearchControlStudyConditionInput
} from "@ouroboros/application/candidate/research-control-study";
import { researchControlStudyOutcomeId } from
  "@ouroboros/application/candidate/research-control-study-outcome";

export function researchControlStudyFixture(input: {
  suffix: string;
  committedAt?: string;
}): ResearchControlStudyRecord {
  const baseline = digest("a");
  const policy = { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY };
  return decideResearchControlStudy({
    idempotencyKey: `process-study-${input.suffix}`,
    baselineSnapshotDigest: baseline,
    condition: {
      source: {
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "process-source-candidate"
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "process-source-version"
        },
        system_code_ref: {
          record_kind: "system_code",
          id: "process-source-system-code"
        },
        system_code_artifact_digest: "sha256:fixture-system-code-v1",
        system_code_record_digest: digest("b"),
        research_artifact_protocol: "single_file_python_v1",
        research_artifact_closure_digest: digest("c")
      },
      research_agent: {
        provider: "fixture",
        model: "process-fixture",
        permission_policy: "fixture_only",
        identity_digest: digest("d")
      },
      paper_comparator: {
        comparator_status: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: "process-promotion"
        },
        trading_promotion_digest: digest("1"),
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "process-champion"
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: "process-champion-version"
        },
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "process-champion-evaluation"
        }
      },
      paper_evaluation_protocol: boundPaperProtocol(),
      allocation_policy: policy,
      allocation_policy_digest: exactDigest(
        paperTradingComparisonPersistedRecordDigestInput(policy)
      ),
      campaign_policy: campaignPolicy()
    } satisfies ResearchControlStudyConditionInput,
    replicationIdempotencyKeys: Array.from({ length: 6 }, (_, index) =>
      `process-study-${input.suffix}-replication-${index + 1}`
    ),
    committedAt: input.committedAt ?? "2026-07-12T09:00:00.000Z"
  });
}

export function researchControlStudyOutcomeFixture(input: {
  study: ResearchControlStudyRecord;
  adjudicatedAt?: string;
}): ResearchControlStudyOutcomeRecord {
  const outcome: ResearchControlStudyOutcomeRecord = {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id:
      researchControlStudyOutcomeId(input.study),
    study_ref: {
      record_kind: "research_control_study",
      id: input.study.research_control_study_id
    },
    study_digest: input.study.study_digest,
    replication_results: input.study.replications.map((replication, index) => ({
      replication_index: replication.replication_index,
      campaign_ref: { ...replication.campaign_ref },
      campaign_digest: digest(String((index % 8) + 1)),
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: `${replication.campaign_ref.id}-outcome`
      },
      campaign_outcome_digest: digest(String((index % 8) + 1)),
      observed_rate_difference: 0
    })),
    planned_replication_count: input.study.replications.length,
    completed_replication_count: input.study.replications.length,
    adaptive_positive_count: 0,
    static_positive_count: 0,
    tied_count: input.study.replications.length,
    non_tied_count: 0,
    mean_rate_difference: 0,
    exact_sign_test_p_value: 1,
    inference_status: "insufficient_non_tied_replications",
    causal_scope: "same_baseline_stochastic_replication_only",
    policy_decision_eligibility: "not_eligible",
    next_action: "accumulate_or_redesign_precommitted_study",
    adjudicated_at: input.adjudicatedAt ?? "2026-07-12T12:00:00.000Z",
    study_outcome_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealResearchControlStudyOutcome(outcome);
  return outcome;
}

export function resealResearchControlStudyOutcome(
  outcome: ResearchControlStudyOutcomeRecord
): void {
  outcome.study_outcome_digest = exactDigest(
    researchControlStudyOutcomeDigestInput(outcome)
  );
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

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
