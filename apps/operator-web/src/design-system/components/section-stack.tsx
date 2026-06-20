import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorSectionStack({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="section-stack"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.section, className)}
      {...props}
    >
      {children}
    </div>
  );
}
