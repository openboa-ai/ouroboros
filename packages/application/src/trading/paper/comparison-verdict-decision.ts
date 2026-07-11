import {
  paperTradingComparisonQualificationResultHasRuntimeShape,
  type PaperTradingComparisonQualificationResult,
  type PaperTradingComparisonVerdictMetric,
  type PaperTradingComparisonVerdictOutcome,
  type TradingProfitLossReadModel
} from "@ouroboros/domain";

export interface PaperTradingComparisonVerdictDecisionInput {
  pairQualification: PaperTradingComparisonQualificationResult;
  minimumLiftUsdt: number;
  championScore?: TradingProfitLossReadModel;
  challengerScore?: TradingProfitLossReadModel;
}

export interface PaperTradingComparisonVerdictDecision {
  verdict_outcome: PaperTradingComparisonVerdictOutcome;
  champion?: { net_revenue_usdt: number; cost_usdt: number };
  challenger?: { net_revenue_usdt: number; cost_usdt: number };
  metric?: PaperTradingComparisonVerdictMetric;
  confirmation_disposition: "requires_precommitted_campaign" | "not_applicable";
  next_action:
    | "precommit_confirmation_campaign"
    | "return_to_candidate_arena"
    | "repair_evidence_or_rerun_comparison";
}

export class PaperTradingComparisonVerdictDecisionError extends Error {
  readonly code = "invalid_paper_trading_comparison_verdict_decision_input";

  constructor() {
    super("Paper comparison verdict decision input is invalid.");
    this.name = "PaperTradingComparisonVerdictDecisionError";
  }
}

export function decidePaperTradingComparisonVerdict(
  input: PaperTradingComparisonVerdictDecisionInput
): PaperTradingComparisonVerdictDecision {
  if (!input || typeof input !== "object" ||
    !paperTradingComparisonQualificationResultHasRuntimeShape(
      input.pairQualification
    ) || !Number.isFinite(input.minimumLiftUsdt) || input.minimumLiftUsdt < 0) {
    throw new PaperTradingComparisonVerdictDecisionError();
  }

  if (input.pairQualification.qualification_status === "not_qualified") {
    if (input.championScore !== undefined || input.challengerScore !== undefined) {
      throw new PaperTradingComparisonVerdictDecisionError();
    }
    return {
      verdict_outcome: "comparison_ineligible",
      confirmation_disposition: "not_applicable",
      next_action: "repair_evidence_or_rerun_comparison"
    };
  }

  if (!scoreIsValid(input.championScore) || !scoreIsValid(input.challengerScore)) {
    throw new PaperTradingComparisonVerdictDecisionError();
  }
  const champion = {
    net_revenue_usdt: round6(input.championScore.net_revenue_usdt),
    cost_usdt: round6(input.championScore.cost_usdt)
  };
  const challenger = {
    net_revenue_usdt: round6(input.challengerScore.net_revenue_usdt),
    cost_usdt: round6(input.challengerScore.cost_usdt)
  };
  const minimumLift = round6(input.minimumLiftUsdt);
  const observedLift = round6(
    challenger.net_revenue_usdt - champion.net_revenue_usdt
  );
  const improved = observedLift > 0 && observedLift >= minimumLift;
  return {
    verdict_outcome: improved
      ? "challenger_improved"
      : "challenger_not_improved",
    champion,
    challenger,
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: champion.net_revenue_usdt,
      challenger_value_usdt: challenger.net_revenue_usdt,
      observed_lift_usdt: observedLift,
      minimum_lift_usdt: minimumLift
    },
    confirmation_disposition: improved
      ? "requires_precommitted_campaign"
      : "not_applicable",
    next_action: improved
      ? "precommit_confirmation_campaign"
      : "return_to_candidate_arena"
  };
}

function scoreIsValid(
  value: TradingProfitLossReadModel | undefined
): value is TradingProfitLossReadModel {
  return Boolean(value) && [
    value!.revenue_usdt,
    value!.cost_usdt,
    value!.net_revenue_usdt,
    value!.net_return_pct
  ].every(Number.isFinite) && value!.cost_usdt >= 0 &&
    round6(value!.revenue_usdt - value!.cost_usdt) ===
      round6(value!.net_revenue_usdt);
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
