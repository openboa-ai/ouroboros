import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorTabBadge({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"span">, "className">) {
  return (
    <Badge
      variant="secondary"
      data-operator-ui="tab-badge"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.tabBadge, className)}
      {...props}
    >
      {children}
    </Badge>
  );
}
