import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorActionRow } from "./action-row";

export function OperatorPage({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"article">, "className">) {
  return (
    <article
      data-operator-ui="page"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.page, className)}
      {...props}
    >
      {children}
    </article>
  );
}

export function OperatorPageHeader({
  eyebrow,
  title,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div data-operator-ui="page-header" className={cn(OPERATOR_DESIGN_TOKENS.layout.pageHeader, className)}>
      <div className={OPERATOR_DESIGN_TOKENS.layout.pageHeaderCopy}>
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <h2 className={OPERATOR_DESIGN_TOKENS.layout.pageHeaderTitle}>{title}</h2>
      </div>
      {actions && <OperatorActionRow>{actions}</OperatorActionRow>}
    </div>
  );
}
