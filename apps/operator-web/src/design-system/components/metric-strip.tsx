import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorStat } from "./stat";

export interface OperatorMetricStripItem {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function OperatorMetricStrip({
  metrics,
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  metrics: OperatorMetricStripItem[];
  className?: string;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  return (
    <section
      data-operator-ui="metric-strip"
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
