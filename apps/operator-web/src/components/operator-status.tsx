import type { ComponentProps } from "react";
import { AlertCircle, CheckCircle2, Circle, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/operator-format";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

const SUCCESS_TERMS = ["active", "admitted", "authenticated", "completed", "configured", "passed", "qualified", "ready", "running", "succeeded"];
const WARNING_TERMS = ["allocating", "awaiting", "collecting", "degraded", "needs_resume", "pending", "provisional", "queued", "recovering", "starting", "stopping", "waiting"];
const DESTRUCTIVE_TERMS = ["blocked", "failed", "failed_closed", "invalidated", "quarantined"];
const OUTLINE_TERMS = ["disabled", "inactive", "missing", "unavailable", "unauthenticated", "unconfigured", "unknown", "unranked", "unsupported"];

export function statusVariant(status: string): BadgeVariant {
  const normalized = status.trim().toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);

  if (tokens.includes("no") || tokens.includes("not")) {
    return "outline";
  }
  if (DESTRUCTIVE_TERMS.some((term) => matchesStatusTerm(normalized, term))) {
    return "destructive";
  }
  if (OUTLINE_TERMS.some((term) => matchesStatusTerm(normalized, term))) {
    return "outline";
  }
  if (WARNING_TERMS.some((term) => matchesStatusTerm(normalized, term))) {
    return "warning";
  }
  if (SUCCESS_TERMS.some((term) => matchesStatusTerm(normalized, term))) {
    return "success";
  }
  return "secondary";
}

function matchesStatusTerm(status: string, term: string): boolean {
  return status === term ||
    status.startsWith(`${term}_`) ||
    status.endsWith(`_${term}`) ||
    status.includes(`_${term}_`);
}

export function StatusBadge({
  status,
  label
}: {
  status: string;
  label?: string;
}) {
  const variant = statusVariant(status);
  const Icon = variant === "success"
    ? CheckCircle2
    : variant === "warning"
      ? Clock3
      : variant === "destructive"
        ? AlertCircle
        : Circle;

  return (
    <Badge variant={variant} title={formatStatus(status)}>
      <Icon aria-hidden="true" />
      {label ?? formatStatus(status)}
    </Badge>
  );
}
