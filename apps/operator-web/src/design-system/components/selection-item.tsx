import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorSelectionItem({
  active,
  title,
  detail,
  meta,
  children,
  className,
  ...props
}: {
  active?: boolean;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof Button>, "className" | "children" | "variant">) {
  return (
    <Button
      {...props}
      data-operator-ui="selection-item"
      data-active={active ? "true" : "false"}
      aria-pressed={active}
      className={cn(
        OPERATOR_DESIGN_TOKENS.surface.selectionItem,
        active ? OPERATOR_DESIGN_TOKENS.surface.selectionItemActive : OPERATOR_DESIGN_TOKENS.surface.selectionItemIdle,
        className
      )}
      variant="ghost"
    >
      <span className={OPERATOR_DESIGN_TOKENS.typography.value}>{title}</span>
      {detail && <small className={OPERATOR_DESIGN_TOKENS.typography.detail}>{detail}</small>}
      {meta && <small className={OPERATOR_DESIGN_TOKENS.typography.detail}>{meta}</small>}
      {children}
    </Button>
  );
}
