import type { ComponentProps, ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
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
    <Empty
      data-operator-ui="empty-state"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.emptyState, className)}
      {...props}
    >
      <EmptyHeader className={OPERATOR_DESIGN_TOKENS.layout.emptyStateContent}>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {(detail || children) && (
        <EmptyContent>
          {detail && <Badge variant="secondary">{detail}</Badge>}
          {children && (
            <div className="grid min-w-0 gap-1 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              {children}
            </div>
          )}
        </EmptyContent>
        )}
    </Empty>
  );
}
