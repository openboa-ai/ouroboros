import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

type OperatorDetailTextElement = "p" | "span";
type OperatorInlineTextElement = "div" | "span";
type OperatorValueTextElement = "strong" | "span";

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

export function OperatorTextStack({
  as: Element = "span",
  children,
  className,
  ...props
}: {
  as?: OperatorInlineTextElement;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div"> & ComponentProps<"span">, "className" | "children">) {
  return (
    <Element
      data-operator-ui="text-stack"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.textStack, className)}
      {...props}
    >
      {children}
    </Element>
  );
}

export function OperatorInlineMeta({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"span">, "className" | "children">) {
  return (
    <span
      data-operator-ui="inline-meta"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.inlineMeta, OPERATOR_DESIGN_TOKENS.typography.meta, className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function OperatorValueText({
  as: Element = "strong",
  children,
  className,
  ...props
}: {
  as?: OperatorValueTextElement;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"strong"> & ComponentProps<"span">, "className" | "children">) {
  return (
    <Element
      data-operator-ui="value-text"
      className={cn(OPERATOR_DESIGN_TOKENS.typography.value, className)}
      {...props}
    >
      {children}
    </Element>
  );
}
