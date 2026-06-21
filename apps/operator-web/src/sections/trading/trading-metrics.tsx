import type { ComponentProps } from "react";
import { OperatorMetricStrip } from "@/design-system";

export interface TradingSummaryMetric {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function TradingMetricGrid({
  metrics,
  density,
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  metrics: TradingSummaryMetric[];
  density?: "default" | "quartet";
  className?: string;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  return (
    <OperatorMetricStrip
      metrics={metrics}
      density={density}
      aria-label={ariaLabel}
      className={className}
      {...props}
    />
  );
}
