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
  density = "default",
  "aria-label": ariaLabel,
  className,
  ...props
}: {
  metrics: OperatorMetricStripItem[];
  density?: "default" | "quartet";
  className?: string;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  const densityClass = density === "quartet"
    ? OPERATOR_DESIGN_TOKENS.layout.metricStripQuartet
    : OPERATOR_DESIGN_TOKENS.layout.statGrid;

  return (
    <section
      data-operator-ui="metric-strip"
      data-density={density}
      className={cn(densityClass, className)}
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
