import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorContentSection({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"section">, "className">) {
  return (
    <section
      data-operator-ui="content-section"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.contentSection, className)}
      {...props}
    >
      {children}
    </section>
  );
}
