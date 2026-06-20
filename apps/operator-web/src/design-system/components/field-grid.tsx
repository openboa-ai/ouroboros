import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorFieldGrid({
  children,
  density = "default",
  className,
  ...props
}: {
  children: ReactNode;
  density?: "default" | "dense" | "compact";
  className?: string;
} & Omit<ComponentProps<"dl">, "className">) {
  const densityClass = density === "dense"
    ? OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid
    : density === "compact"
      ? OPERATOR_DESIGN_TOKENS.layout.compactFieldGrid
      : OPERATOR_DESIGN_TOKENS.layout.fieldGrid;

  return (
    <dl
      data-operator-ui="field-grid"
      data-density={density}
      className={cn(densityClass, className)}
      {...props}
    >
      {children}
    </dl>
  );
}
