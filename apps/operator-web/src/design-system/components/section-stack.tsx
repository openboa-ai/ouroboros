import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorSectionStack({
  children,
  density = "default",
  className,
  ...props
}: {
  children: ReactNode;
  density?: "default" | "loose";
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  const densityClass = density === "loose"
    ? OPERATOR_DESIGN_TOKENS.layout.contentStackLoose
    : OPERATOR_DESIGN_TOKENS.layout.contentStack;

  return (
    <div
      data-operator-ui="section-stack"
      data-density={density}
      className={cn(densityClass, className)}
      {...props}
    >
      {children}
    </div>
  );
}
