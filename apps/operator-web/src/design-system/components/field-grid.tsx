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
  density?: "default" | "dense";
  className?: string;
} & Omit<ComponentProps<"dl">, "className">) {
  return (
    <dl
      data-operator-ui="field-grid"
      data-density={density}
      className={cn(
        density === "dense" ? OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid : OPERATOR_DESIGN_TOKENS.layout.fieldGrid,
        className
      )}
      {...props}
    >
      {children}
    </dl>
  );
}
