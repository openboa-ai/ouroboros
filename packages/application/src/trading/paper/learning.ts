import type {
  PaperTradingFailureReadModel,
  PaperTradingLearningSummaryReadModel,
  PaperTradingQualificationReason,
  PaperTradingQualificationStatus,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import { paperTradingQualificationBlockerGroups } from "./qualification-blockers";

export function paperTradingLearningSummary(input: {
  rank?: number;
  profitLoss: TradingProfitLossReadModel;
  observationCount: number;
  qualificationStatus?: PaperTradingQualificationStatus;
  qualificationReasons: PaperTradingQualificationReason[];
  latestFailure?: PaperTradingFailureReadModel;
}): PaperTradingLearningSummaryReadModel {
  const firstBlockerGroup = paperTradingQualificationBlockerGroups(input.qualificationReasons)[0];
  const topBlocker = input.qualificationReasons[0];
  const qualificationStatus = input.qualificationStatus ?? "collecting_evidence";

  return {
    rank: input.rank,
    net_revenue_usdt: input.profitLoss.net_revenue_usdt,
    net_return_pct: input.profitLoss.net_return_pct,
    observation_count: input.observationCount,
    qualification_status: input.qualificationStatus,
    qualification_reasons: input.qualificationReasons,
    top_blocker: topBlocker,
    latest_failure_kind: input.latestFailure?.failure_kind,
    latest_failure_summary: input.latestFailure?.summary,
    summary: `${paperRankLabel(input.rank)}: ${input.profitLoss.net_revenue_usdt} net_revenue_usdt, ${input.profitLoss.net_return_pct} net_return_pct, ${input.observationCount} observations, ${qualificationStatus}.`,
    next_research_focus: firstBlockerGroup?.next_action ??
      input.latestFailure?.next_action ??
      nextResearchFocusForProfit(input.profitLoss.net_revenue_usdt),
    authority_status: "lineage_only"
  };
}

function paperRankLabel(rank: number | undefined): string {
  return rank ? `Paper board rank #${rank}` : "Paper board unranked";
}

function nextResearchFocusForProfit(netRevenueUsdt: number): string {
  return netRevenueUsdt >= 0
    ? "Preserve the profitable lineage and generate controlled variants under paper evidence."
    : "Treat the loss-making paper result as a negative finding and generate a differentiated candidate.";
}
