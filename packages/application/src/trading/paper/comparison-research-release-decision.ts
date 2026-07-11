import {
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonResearchReleaseKind,
  type ResearchFindingKind
} from "@ouroboros/domain";

export interface PaperTradingComparisonResearchReleaseDecision {
  release_kind: PaperTradingComparisonResearchReleaseKind;
  finding_kind: ResearchFindingKind;
  summary: string;
  next_research_focus: string;
}

export class PaperTradingComparisonResearchReleaseDecisionError extends Error {
  readonly code =
    "invalid_paper_trading_comparison_research_release_decision_input";

  constructor() {
    super("Paper comparison research release decision input is invalid.");
    this.name = "PaperTradingComparisonResearchReleaseDecisionError";
  }
}

export function decidePaperTradingComparisonResearchRelease(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): PaperTradingComparisonResearchReleaseDecision {
  if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome)) {
    throw new PaperTradingComparisonResearchReleaseDecisionError();
  }

  const classification = classify(outcome);
  return {
    ...classification,
    summary: `Paper comparison confirmation campaign ${outcome.campaign_ref.id}: ` +
      `improved=${outcome.improved_count}, ` +
      `not_improved=${outcome.not_improved_count}, ` +
      `ineligible=${outcome.ineligible_count}, ` +
      `expired=${outcome.expired_count}; ` +
      `release=${classification.release_kind}.`
  };
}

function classify(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): Omit<PaperTradingComparisonResearchReleaseDecision, "summary"> {
  if (outcome.campaign_outcome === "confirmed_improvement") {
    return {
      release_kind: "confirmed_improvement",
      finding_kind: "positive_result",
      next_research_focus:
        "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence."
    };
  }
  if (outcome.not_improved_count > 0) {
    return {
      release_kind: "challenger_not_reproduced",
      finding_kind: "negative_result",
      next_research_focus:
        "Explain non-reproduction, preserve the negative result, and generate differentiated candidates under new prospective evidence."
    };
  }
  if (outcome.ineligible_count > 0) {
    return {
      release_kind: "comparison_evidence_ineligible",
      finding_kind: "failure_analysis",
      next_research_focus:
        "Repair comparison evidence and protocol quality before making an economic interpretation."
    };
  }
  return {
    release_kind: "campaign_slot_expired",
    finding_kind: "failure_analysis",
    next_research_focus:
      "Repair campaign scheduling and recovery before making an economic interpretation."
  };
}
