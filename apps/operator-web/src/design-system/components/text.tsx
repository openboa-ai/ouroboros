import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

type OperatorDetailTextElement = "p" | "span";

export function OperatorDetailText({
  as: Element = "p",
  children,
  className,
  ...props
}: {
  as?: OperatorDetailTextElement;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"p"> & ComponentProps<"span">, "className" | "children">) {
  return (
    <Element
      data-operator-ui="detail-text"
      className={cn(OPERATOR_DESIGN_TOKENS.typography.detail, className)}
      {...props}
    >
      {children}
    </Element>
  );
}
