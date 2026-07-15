import {
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonConfirmationSlotResult
} from "@ouroboros/domain";

export interface PaperTradingComparisonConfirmationDecisionInput {
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  slotResults: PaperTradingComparisonConfirmationSlotResult[];
}

export interface PaperTradingComparisonConfirmationDecision {
  improved_count: number;
  not_improved_count: number;
  ineligible_count: number;
  expired_count: number;
  campaign_outcome: "confirmed_improvement" | "not_confirmed";
  promotion_eligibility: "eligible" | "not_eligible";
  next_action: "review_for_trading_promotion" | "return_to_candidate_arena";
}

export class PaperTradingComparisonConfirmationDecisionError extends Error {
  readonly code =
    "invalid_paper_trading_comparison_confirmation_decision_input";

  constructor() {
    super("Paper comparison confirmation decision input is invalid.");
    this.name = "PaperTradingComparisonConfirmationDecisionError";
  }
}

export function decidePaperTradingComparisonConfirmationCampaign(
  input: PaperTradingComparisonConfirmationDecisionInput
): PaperTradingComparisonConfirmationDecision {
  if (!input || typeof input !== "object" ||
    !paperTradingComparisonConfirmationCampaignHasRuntimeShape(input.campaign) ||
    !Array.isArray(input.slotResults) ||
    input.slotResults.length !== input.campaign.slots.length ||
    input.slotResults.some((result, index) => {
      const slot = input.campaign.slots[index];
      return !slot || result.slot_index !== slot.slot_index ||
        result.paper_trading_comparison_commitment_ref?.record_kind !==
          "paper_trading_comparison_commitment" ||
        result.paper_trading_comparison_commitment_ref.id !==
          slot.paper_trading_comparison_commitment_id ||
        result.verdict_ref?.id === input.campaign.source_verdict_ref.id;
    })) {
    throw new PaperTradingComparisonConfirmationDecisionError();
  }

  const counts = {
    improved_count: input.slotResults.filter((result) =>
      result.status === "challenger_improved").length,
    not_improved_count: input.slotResults.filter((result) =>
      result.status === "challenger_not_improved").length,
    ineligible_count: input.slotResults.filter((result) =>
      result.status === "comparison_ineligible").length,
    expired_count: input.slotResults.filter((result) =>
      result.status === "slot_expired").length
  };
  const confirmed = counts.improved_count === input.campaign.slots.length;
  const decision: PaperTradingComparisonConfirmationDecision = {
    ...counts,
    campaign_outcome: confirmed ? "confirmed_improvement" : "not_confirmed",
    promotion_eligibility: confirmed ? "eligible" : "not_eligible",
    next_action: confirmed
      ? "review_for_trading_promotion"
      : "return_to_candidate_arena"
  };
  const validationOutcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord = {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      `${input.campaign.paper_trading_comparison_confirmation_campaign_id}-decision-validation`,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: input.campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: input.campaign.campaign_digest,
    slot_results: input.slotResults,
    ...decision,
    decision_rule: "all_reserved_windows_must_improve",
    release_status: "sealed",
    evaluated_at: "9999-12-31T23:59:59.999Z",
    outcome_digest: "sha256:decision-validation",
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
    validationOutcome
  )) {
    throw new PaperTradingComparisonConfirmationDecisionError();
  }
  return decision;
}
