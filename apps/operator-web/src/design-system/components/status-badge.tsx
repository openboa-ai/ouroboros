import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const DEFAULT_BADGE_VALUES = new Set([
  "accepted",
  "available",
  "chain_complete",
  "complete",
  "ready",
  "running",
  "succeeded"
]);

const OUTLINE_BADGE_TOKENS = new Set([
  "incomplete",
  "pending",
  "planned",
  "required",
  "review"
]);

const DESTRUCTIVE_BADGE_TOKENS = new Set([
  "blocked",
  "breach",
  "failed",
  "invalid",
  "rejected"
]);

export function operatorBadgeVariant(value: string): BadgeVariant {
  const normalized = normalizeStatusValue(value);
  const tokens = statusTokens(normalized);
  if (tokens.some((token) => DESTRUCTIVE_BADGE_TOKENS.has(token))) {
    return "destructive";
  }
  if (DEFAULT_BADGE_VALUES.has(normalized)) {
    return "default";
  }
  if (tokens.some((token) => OUTLINE_BADGE_TOKENS.has(token))) {
    return "outline";
  }
  return "secondary";
}

export function OperatorStatusBadge({
  value,
  children,
  className,
  multiline = false,
  variant,
  ...props
}: {
  value: string;
  children?: ReactNode;
  className?: string;
  multiline?: boolean;
  variant?: NonNullable<ComponentProps<typeof Badge>["variant"]>;
} & Omit<ComponentProps<typeof Badge>, "children" | "className" | "variant">) {
  return (
    <Badge
      data-operator-ui="status-badge"
      data-multiline={multiline ? "true" : undefined}
      className={cn(
        OPERATOR_DESIGN_TOKENS.radius.badge,
        multiline && OPERATOR_DESIGN_TOKENS.layout.statusBadgeMultiline,
        className
      )}
      variant={variant ?? operatorBadgeVariant(value)}
      {...props}
    >
      {children ?? value}
    </Badge>
  );
}

function normalizeStatusValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function statusTokens(normalizedValue: string): string[] {
  return normalizedValue.split("_").filter(Boolean);
}
