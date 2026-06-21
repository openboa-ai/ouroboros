import type { ComponentProps } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export type OperatorChartConfig = ChartConfig;

export const OperatorChartTooltip = ChartTooltip;
export const OperatorChartTooltipContent = ChartTooltipContent;

export function OperatorChartFrame({
  className,
  ...props
}: ComponentProps<typeof ChartContainer>) {
  return (
    <ChartContainer
      data-operator-ui="chart-frame"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.chartFrame, className)}
      {...props}
    />
  );
}

export function OperatorChartCaption({
  label,
  detail,
  className,
  ...props
}: {
  label: string;
  detail: string;
} & Omit<ComponentProps<"div">, "children" | "className"> & {
    className?: string;
  }) {
  return (
    <div
      data-operator-ui="chart-caption"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.chartCaption, className)}
      {...props}
    >
      <strong className={OPERATOR_DESIGN_TOKENS.typography.chartCaptionLabel}>
        {label}
      </strong>
      <span className={OPERATOR_DESIGN_TOKENS.typography.chartCaptionDetail}>
        {detail}
      </span>
    </div>
  );
}
