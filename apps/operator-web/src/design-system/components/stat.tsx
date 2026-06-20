import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</CardTitle>
      </CardHeader>
      <CardContent className={OPERATOR_DESIGN_TOKENS.layout.statContent}>
        <strong className={OPERATOR_DESIGN_TOKENS.typography.statValue}>{value}</strong>
        {detail && <span className={OPERATOR_DESIGN_TOKENS.typography.detail}>{detail}</span>}
      </CardContent>
    </Card>
  );
}
