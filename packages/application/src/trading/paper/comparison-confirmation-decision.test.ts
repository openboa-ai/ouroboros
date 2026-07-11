import type {
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonConfirmationSlotResult,
  PaperTradingComparisonConfirmationSlotResultStatus
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import {
  decidePaperTradingComparisonConfirmationCampaign,
  PaperTradingComparisonConfirmationDecisionError
} from "./comparison-confirmation-decision";

describe("paper trading comparison confirmation decision", () => {
  it("confirms only when every reserved window improved", () => {
    expect(decidePaperTradingComparisonConfirmationCampaign({
      campaign: campaignFixture(),
      slotResults: slotResults([
        "challenger_improved",
        "challenger_improved"
      ])
    })).toEqual({
      improved_count: 2,
      not_improved_count: 0,
      ineligible_count: 0,
      expired_count: 0,
      campaign_outcome: "confirmed_improvement",
      promotion_eligibility: "eligible",
      next_action: "review_for_trading_promotion"
    });
  });

  it.each([
    ["not improved", ["challenger_improved", "challenger_not_improved"], {
      improved_count: 1,
      not_improved_count: 1,
      ineligible_count: 0,
      expired_count: 0
    }],
    ["ineligible", ["challenger_improved", "comparison_ineligible"], {
      improved_count: 1,
      not_improved_count: 0,
      ineligible_count: 1,
      expired_count: 0
    }],
    ["expired", ["challenger_improved", "slot_expired"], {
      improved_count: 1,
      not_improved_count: 0,
      ineligible_count: 0,
      expired_count: 1
    }]
  ] as const)("does not confirm a campaign with one %s slot", (
    _label,
    statuses,
    counts
  ) => {
    expect(decidePaperTradingComparisonConfirmationCampaign({
      campaign: campaignFixture(),
      slotResults: slotResults([...statuses])
    })).toEqual({
      ...counts,
      campaign_outcome: "not_confirmed",
      promotion_eligibility: "not_eligible",
      next_action: "return_to_candidate_arena"
    });
  });

  it.each([
    ["missing slot", (input: DecisionInput) => {
      input.slotResults.pop();
    }],
    ["reordered slots", (input: DecisionInput) => {
      input.slotResults.reverse();
    }],
    ["duplicate comparison", (input: DecisionInput) => {
      input.slotResults[1]!.paper_trading_comparison_commitment_ref = {
        ...input.slotResults[0]!.paper_trading_comparison_commitment_ref
      };
    }],
    ["foreign comparison", (input: DecisionInput) => {
      input.slotResults[1]!.paper_trading_comparison_commitment_ref.id =
        "paper-trading-comparison-ffffffffffffffff";
    }],
    ["source verdict reused", (input: DecisionInput) => {
      input.slotResults[0]!.verdict_ref!.id = input.campaign.source_verdict_ref.id;
    }],
    ["verdict-bearing expiry", (input: DecisionInput) => {
      input.slotResults[1]!.status = "slot_expired";
    }],
    ["verdict-less completed slot", (input: DecisionInput) => {
      delete input.slotResults[1]!.verdict_ref;
      delete input.slotResults[1]!.verdict_digest;
    }],
    ["overlapping window", (input: DecisionInput) => {
      input.slotResults[1]!.window_started_at =
        input.slotResults[0]!.window_ended_at;
    }],
    ["completed slot after expiry", (input: DecisionInput) => {
      input.slotResults[0] = expiredSlot(1);
    }],
    ["malformed campaign", (input: DecisionInput) => {
      input.campaign.promotion_eligibility = "eligible" as never;
    }]
  ])("rejects %s", (_label, mutate) => {
    const input: DecisionInput = {
      campaign: campaignFixture(),
      slotResults: slotResults([
        "challenger_improved",
        "challenger_improved"
      ])
    };
    mutate(input);

    expect(() => decidePaperTradingComparisonConfirmationCampaign(input))
      .toThrowError(PaperTradingComparisonConfirmationDecisionError);
    expect(() => decidePaperTradingComparisonConfirmationCampaign(input))
      .toThrowError(expect.objectContaining({
        code: "invalid_paper_trading_comparison_confirmation_decision_input"
      }));
  });

  it("is deterministic and does not mutate campaign evidence", () => {
    const input: DecisionInput = {
      campaign: campaignFixture(),
      slotResults: slotResults([
        "challenger_improved",
        "challenger_not_improved"
      ])
    };
    const before = structuredClone(input);

    const first = decidePaperTradingComparisonConfirmationCampaign(input);
    const second = decidePaperTradingComparisonConfirmationCampaign(input);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });
});

type DecisionInput = {
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  slotResults: PaperTradingComparisonConfirmationSlotResult[];
};

function slotResults(
  statuses: PaperTradingComparisonConfirmationSlotResultStatus[]
): PaperTradingComparisonConfirmationSlotResult[] {
  return statuses.map((status, index) => status === "slot_expired"
    ? expiredSlot(index + 1)
    : {
        slot_index: index + 1,
        paper_trading_comparison_commitment_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: `paper-trading-comparison-${index === 0
            ? "1111111111111111"
            : "2222222222222222"}`
        },
        status,
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `slot-verdict-${index + 1}`
        },
        verdict_digest: `sha256:slot-verdict-${index + 1}`,
        window_started_at: `2026-07-12T0${4 + index}:00:00.000Z`,
        window_ended_at: `2026-07-12T0${4 + index}:30:00.000Z`
      });
}

function expiredSlot(slotIndex: number): PaperTradingComparisonConfirmationSlotResult {
  return {
    slot_index: slotIndex,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `paper-trading-comparison-${slotIndex === 1
        ? "1111111111111111"
        : "2222222222222222"}`
    },
    status: "slot_expired"
  };
}

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
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "bootstrap",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 3,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 3,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 10,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
    },
    market_data_configuration_digest: "sha256:market-configuration",
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
