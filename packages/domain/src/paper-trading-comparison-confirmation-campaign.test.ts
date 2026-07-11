import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord
} from "./index";

describe("paper trading comparison confirmation campaign evidence", () => {
  it("accepts one precommitted two-slot campaign", () => {
    expect(paperTradingComparisonConfirmationCampaignHasRuntimeShape(
      campaignFixture()
    )).toBe(true);
  });

  it("accepts confirmed, mixed, and expired complete outcomes", () => {
    expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
      outcomeFixture(["challenger_improved", "challenger_improved"])
    )).toBe(true);
    expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
      outcomeFixture(["challenger_improved", "challenger_not_improved"])
    )).toBe(true);
    expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
      outcomeFixture(["challenger_improved", "slot_expired"])
    )).toBe(true);
  });

  it("uses canonical campaign and outcome digest payloads", () => {
    const campaign = campaignFixture();
    const outcome = outcomeFixture(["challenger_improved", "challenger_improved"]);
    const {
      record_kind: _campaignKind,
      version: _campaignVersion,
      paper_trading_comparison_confirmation_campaign_id: _campaignId,
      campaign_digest: _campaignDigest,
      ...campaignPayload
    } = campaign;
    const {
      record_kind: _outcomeKind,
      version: _outcomeVersion,
      paper_trading_comparison_confirmation_campaign_outcome_id: _outcomeId,
      outcome_digest: _outcomeDigest,
      ...outcomePayload
    } = outcome;

    expect(paperTradingComparisonConfirmationCampaignDigestInput(campaign)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(campaignPayload)
    );
    expect(paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(outcomePayload)
    );
  });

  it.each([
    ["source comparison reused as slot", (value: any) => {
      value.slots[0].paper_trading_comparison_commitment_id =
        value.source_comparison_ref.id;
    }],
    ["non-contiguous slot", (value: any) => {
      value.slots[1].slot_index = 3;
    }],
    ["non-canonical slot key", (value: any) => {
      value.slots[0].comparison_idempotency_key = "campaign slot 1";
    }],
    ["non-canonical preparation ID", (value: any) => {
      value.slots[0].paper_trading_comparison_preparation_id = "preparation-1";
    }],
    ["duplicate comparison ID", (value: any) => {
      value.slots[1].paper_trading_comparison_commitment_id =
        value.slots[0].paper_trading_comparison_commitment_id;
    }],
    ["slot count drift", (value: any) => {
      value.slots.pop();
    }],
    ["required count drift", (value: any) => {
      value.campaign_policy.required_window_count = 3;
    }],
    ["start delay drift", (value: any) => {
      value.campaign_policy.maximum_slot_start_delay_ms += 1;
    }],
    ["eligible commitment", (value: any) => {
      value.promotion_eligibility = "eligible";
    }],
    ["non-canonical commitment time", (value: any) => {
      value.committed_at = "2026-07-12 03:00:00";
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }]
  ])("rejects campaign %s", (_label, mutate) => {
    const campaign = campaignFixture() as any;
    mutate(campaign);

    expect(paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign))
      .toBe(false);
  });

  it.each([
    ["partial results", (value: any) => {
      value.slot_results.pop();
    }],
    ["reordered results", (value: any) => {
      value.slot_results.reverse();
    }],
    ["wrong counts", (value: any) => {
      value.improved_count += 1;
    }],
    ["confirmed mixed result", (value: any) => {
      value.slot_results[1].status = "challenger_not_improved";
    }],
    ["eligible not-confirmed result", (value: any) => {
      value.campaign_outcome = "not_confirmed";
      value.next_action = "return_to_candidate_arena";
    }],
    ["verdict-bearing expiry", (value: any) => {
      value.campaign_outcome = "not_confirmed";
      value.promotion_eligibility = "not_eligible";
      value.next_action = "return_to_candidate_arena";
      value.slot_results[1] = {
        ...value.slot_results[1],
        status: "slot_expired"
      };
      value.improved_count = 1;
      value.expired_count = 1;
    }],
    ["released evidence", (value: any) => {
      value.release_status = "released";
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }]
  ])("rejects outcome %s", (_label, mutate) => {
    const outcome = outcomeFixture([
      "challenger_improved",
      "challenger_improved"
    ]) as any;
    mutate(outcome);

    expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome))
      .toBe(false);
  });
});

function campaignFixture(): PaperTradingComparisonConfirmationCampaignRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: "confirmation-campaign-001",
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict-001"
    },
    source_verdict_digest: "sha256:source-verdict",
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "source-comparison-001"
    },
    source_comparison_digest: "sha256:source-comparison",
    champion: candidateSide("champion"),
    challenger: candidateSide("challenger"),
    champion_selection: { selection_kind: "bootstrap" },
    comparison_policy: comparisonPolicy(),
    market_data_configuration_digest: "sha256:market-configuration",
    paper_policy_identity: policyIdentity(),
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 2,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms: 600_000,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [1, 2].map((slotIndex) => ({
      slot_index: slotIndex,
      comparison_idempotency_key:
        `paper-comparison-confirmation:confirmation-campaign-001:slot:${slotIndex}`,
      paper_trading_comparison_preparation_id:
        `paper-trading-comparison-preparation-${slotIndex === 1
          ? "1111111111111111"
          : "2222222222222222"}`,
      paper_trading_comparison_commitment_id:
        `paper-trading-comparison-${slotIndex === 1
          ? "1111111111111111"
          : "2222222222222222"}`
    })),
    committed_at: "2026-07-12T03:00:00.000Z",
    campaign_digest: "sha256:campaign",
    evaluation_authority: "external_to_trading_systems",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function outcomeFixture(
  statuses: Array<
    | "challenger_improved"
    | "challenger_not_improved"
    | "comparison_ineligible"
    | "slot_expired"
  >
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const counts = {
    improved_count: statuses.filter((status) => status === "challenger_improved").length,
    not_improved_count: statuses.filter((status) =>
      status === "challenger_not_improved").length,
    ineligible_count: statuses.filter((status) =>
      status === "comparison_ineligible").length,
    expired_count: statuses.filter((status) => status === "slot_expired").length
  };
  const confirmed = counts.improved_count === statuses.length;
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      "confirmation-campaign-001-outcome",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "confirmation-campaign-001"
    },
    campaign_digest: "sha256:campaign",
    slot_results: statuses.map((status, index) => ({
      slot_index: index + 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: `paper-trading-comparison-${index === 0
          ? "1111111111111111"
          : "2222222222222222"}`
      },
      status,
      ...(status !== "slot_expired" ? {
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `slot-verdict-${index + 1}`
        },
        verdict_digest: `sha256:slot-verdict-${index + 1}`,
        window_started_at: `2026-07-12T0${4 + index}:00:00.000Z`,
        window_ended_at: `2026-07-12T0${4 + index}:30:00.000Z`
      } : {})
    })),
    ...counts,
    campaign_outcome: confirmed ? "confirmed_improvement" : "not_confirmed",
    decision_rule: "all_reserved_windows_must_improve",
    promotion_eligibility: confirmed ? "eligible" : "not_eligible",
    release_status: "sealed",
    next_action: confirmed
      ? "review_for_trading_promotion"
      : "return_to_candidate_arena",
    evaluated_at: "2026-07-12T07:00:00.000Z",
    outcome_digest: "sha256:campaign-outcome",
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function candidateSide(role: "champion" | "challenger") {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${role}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${role}-version`
    },
    candidate_version_digest: `sha256:${role}-version`,
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_record_digest: `sha256:${role}-code-record`,
    system_code_artifact_digest: `sha256:${role}-code-artifact`,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `${role}-admission`
    },
    admission_decision_digest: `sha256:${role}-admission`
  } as const;
}

function comparisonPolicy() {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: "bootstrap" as const,
    symbol: "BTCUSDT" as const,
    interval_ms: 60_000,
    minimum_observation_count: 3,
    minimum_elapsed_ms: 60_000,
    maximum_observation_count: 3,
    maximum_elapsed_ms: 600_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 100,
    maximum_retry_count_per_side: 3,
    primary_metric: "net_revenue_usdt" as const,
    minimum_net_revenue_lift_usdt: 10,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true as const,
    require_both_qualified: true as const,
    release_policy: "sealed_until_adjudication" as const
  };
}

function policyIdentity() {
  return {
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
  };
}
