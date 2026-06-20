import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorPanel({
  children,
  variant = "muted",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "muted" | "elevated";
  className?: string;
} & Omit<ComponentProps<"section">, "className">) {
  return (
    <Card
      asChild
      data-operator-ui="panel"
      size="sm"
      className={cn(
        variant === "elevated" ? OPERATOR_DESIGN_TOKENS.surface.panel : OPERATOR_DESIGN_TOKENS.surface.panelMuted,
        OPERATOR_DESIGN_TOKENS.layout.panel,
        className
      )}
    >
      <section {...props}>{children}</section>
    </Card>
  );
}
