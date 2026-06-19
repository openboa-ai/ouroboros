import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorActionRow } from "./action-row";

export function OperatorSectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div data-operator-ui="section-header" className={cn(OPERATOR_DESIGN_TOKENS.layout.sectionHeader, className)}>
      <div className={OPERATOR_DESIGN_TOKENS.layout.sectionHeaderCopy}>
        {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
        <h3 className={OPERATOR_DESIGN_TOKENS.layout.sectionTitle}>{title}</h3>
        {description && <p className={OPERATOR_DESIGN_TOKENS.typography.detail}>{description}</p>}
      </div>
      {actions && <OperatorActionRow className="sm:justify-end">{actions}</OperatorActionRow>}
    </div>
  );
}
