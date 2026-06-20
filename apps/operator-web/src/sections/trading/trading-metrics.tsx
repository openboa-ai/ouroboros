import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS, OperatorStat } from "@/design-system";

export interface TradingSummaryMetric {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function TradingMetricGrid({
  metrics,
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  metrics: TradingSummaryMetric[];
  className?: string;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  return (
    <section
      data-operator-ui="trading-metric-grid"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.statGrid, className)}
      aria-label={ariaLabel}
      {...props}
    >
      {metrics.map((metric) => (
        <OperatorStat
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          className={metric.className}
        />
      ))}
    </section>
  );
}
