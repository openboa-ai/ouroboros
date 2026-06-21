import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorActionRow } from "./action-row";

type ResponsiveSplitBreakpoint = "md" | "lg";
type ResponsiveSplitAlign = "center" | "start";

export function OperatorResponsiveSplit({
  children,
  actions,
  breakpoint = "md",
  align = "center",
  className,
  ...props
}: {
  children: ReactNode;
  actions?: ReactNode;
  breakpoint?: ResponsiveSplitBreakpoint;
  align?: ResponsiveSplitAlign;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  const splitClass = breakpoint === "lg"
    ? OPERATOR_DESIGN_TOKENS.layout.responsiveSplitLg
    : OPERATOR_DESIGN_TOKENS.layout.responsiveSplitMd;
  const alignClass = breakpoint === "lg"
    ? align === "start"
      ? OPERATOR_DESIGN_TOKENS.layout.responsiveSplitAlignStartLg
      : OPERATOR_DESIGN_TOKENS.layout.responsiveSplitAlignCenterLg
    : align === "start"
      ? OPERATOR_DESIGN_TOKENS.layout.responsiveSplitAlignStartMd
      : OPERATOR_DESIGN_TOKENS.layout.responsiveSplitAlignCenterMd;
  const actionClass = breakpoint === "lg"
    ? OPERATOR_DESIGN_TOKENS.layout.responsiveSplitActionsLg
    : OPERATOR_DESIGN_TOKENS.layout.responsiveSplitActionsMd;

  return (
    <div
      data-operator-ui="responsive-split"
      data-breakpoint={breakpoint}
      data-align={align}
      className={cn(splitClass, alignClass, className)}
      {...props}
    >
      <div className={OPERATOR_DESIGN_TOKENS.layout.responsiveSplitContent}>{children}</div>
      {actions && <OperatorActionRow className={actionClass}>{actions}</OperatorActionRow>}
    </div>
  );
}
