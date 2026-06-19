import type { ComponentProps, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorEvidenceStack({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="evidence-stack"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.evidenceStack, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function OperatorEvidenceBlock({
  title,
  children,
  className,
  ...props
}: {
  title: string;
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <Card
      data-operator-ui="evidence-block"
      size="sm"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.evidenceBlock, className)}
      {...props}
    >
      <CardContent className={OPERATOR_DESIGN_TOKENS.layout.evidenceBlockContent}>
        <h4 className="text-sm font-semibold leading-snug tracking-normal text-foreground">{title}</h4>
        {children}
      </CardContent>
    </Card>
  );
}

type OperatorEvidenceTone = "neutral" | "counted" | "failed" | "sealed";

export function OperatorEvidenceStatus({
  label,
  value,
  detail,
  tone = "neutral",
  className,
  ...props
}: {
  label: string;
  value: string;
  detail: string;
  tone?: OperatorEvidenceTone;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <Card
      data-operator-ui="evidence-status"
      data-tone={tone}
      size="sm"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.evidenceStatus, evidenceStatusToneClass(tone), className)}
      {...props}
    >
      <CardContent className={OPERATOR_DESIGN_TOKENS.layout.evidenceStatusContent}>
        <span className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</span>
        <strong className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {value}
        </strong>
        <span className={OPERATOR_DESIGN_TOKENS.typography.detail}>{detail}</span>
      </CardContent>
    </Card>
  );
}

function evidenceStatusToneClass(tone: OperatorEvidenceTone): string {
  switch (tone) {
    case "counted":
      return "border-l-2 border-emerald-400/70 bg-emerald-500/8";
    case "failed":
      return "border-l-2 border-destructive/70 bg-destructive/8";
    case "sealed":
      return "border-l-2 border-primary/70 bg-primary/8";
    case "neutral":
      return "border-l-2 border-border/35 bg-muted/10";
  }
}

export function OperatorEvidenceRow({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="evidence-row"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.evidenceRow, className)}
      {...props}
    >
      {children}
    </div>
  );
}
