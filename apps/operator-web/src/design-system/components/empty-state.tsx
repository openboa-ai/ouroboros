import type { ComponentProps, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorEmptyState({
  title,
  description,
  detail,
  children,
  className,
  ...props
}: {
  title: string;
  description?: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <Card
      data-operator-ui="empty-state"
      size="sm"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.emptyState, className)}
      {...props}
    >
      <CardContent className={OPERATOR_DESIGN_TOKENS.layout.emptyStateContent}>
        <strong className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {title}
        </strong>
        {description && <span className={OPERATOR_DESIGN_TOKENS.typography.detail}>{description}</span>}
        {detail && <span className={OPERATOR_DESIGN_TOKENS.typography.detail}>{detail}</span>}
        {children && (
          <div className="grid min-w-0 gap-1 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
