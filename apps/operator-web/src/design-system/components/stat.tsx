import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorStat({
  label,
  value,
  detail,
  className
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <Card data-operator-ui="stat" size="sm" className={cn(OPERATOR_DESIGN_TOKENS.surface.stat, className)}>
      <CardContent className={OPERATOR_DESIGN_TOKENS.layout.statContent}>
        <span className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</span>
        <strong className={OPERATOR_DESIGN_TOKENS.typography.statValue}>{value}</strong>
        {detail && <span className={OPERATOR_DESIGN_TOKENS.typography.detail}>{detail}</span>}
      </CardContent>
    </Card>
  );
}
