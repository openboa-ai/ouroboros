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
      size="sm"
      className={cn(
        variant === "elevated" ? OPERATOR_DESIGN_TOKENS.surface.panel : OPERATOR_DESIGN_TOKENS.surface.panelMuted,
        "grid min-w-0 content-start grid-cols-[minmax(0,1fr)] gap-3 p-3",
        className
      )}
    >
      <section data-operator-ui="panel" {...props}>
        {children}
      </section>
    </Card>
  );
}
