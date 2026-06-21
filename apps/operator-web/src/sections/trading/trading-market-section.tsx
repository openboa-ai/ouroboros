import type { ComponentProps, ReactNode } from "react";
import { OperatorPanel, OperatorSectionHeader, OperatorStatusBadge } from "@/design-system";
import { TradingMetricGrid, type TradingSummaryMetric } from "./trading-metrics";

export function TradingMarketSection({
  description,
  status,
  statusVariant,
  children,
  metrics
}: {
  description: string;
  status: string;
  statusVariant: ComponentProps<typeof OperatorStatusBadge>["variant"];
  children: ReactNode;
  metrics: TradingSummaryMetric[];
}) {
  return (
    <OperatorPanel aria-label="BTCUSDT futures chart">
      <OperatorSectionHeader
        title="BTCUSDT futures chart"
        description={description}
        actions={<OperatorStatusBadge value={status} variant={statusVariant} />}
      />
      {children}
      <TradingMetricGrid
        aria-label="BTCUSDT market metrics"
        metrics={metrics}
        className="md:grid-cols-4"
      />
    </OperatorPanel>
  );
}
