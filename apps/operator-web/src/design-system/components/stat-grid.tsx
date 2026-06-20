import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorStat } from "./stat";

export interface OperatorStatGridItem {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function OperatorStatGrid({
  stats,
  children,
  className,
  "aria-label": ariaLabel,
  ...props
}: {
  stats?: OperatorStatGridItem[];
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  return (
    <section
      data-operator-ui="stat-grid"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.statGrid, className)}
      aria-label={ariaLabel}
      {...props}
    >
      {stats
        ? stats.map((stat) => (
          <OperatorStat
            key={stat.label}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            className={stat.className}
          />
        ))
        : children}
    </section>
  );
}
