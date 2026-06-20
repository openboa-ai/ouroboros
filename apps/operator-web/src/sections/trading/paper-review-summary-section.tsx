import { TradingMetricGrid, type TradingSummaryMetric } from "./trading-metrics";

export function PaperReviewSummarySection({
  metrics
}: {
  metrics: TradingSummaryMetric[];
}) {
  return (
    <TradingMetricGrid
      aria-label="Paper trading review summary"
      metrics={metrics}
      className="md:grid-cols-4"
    />
  );
}
