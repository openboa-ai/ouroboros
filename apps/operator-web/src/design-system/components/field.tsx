import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorField({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card asChild size="sm" className={cn(OPERATOR_DESIGN_TOKENS.surface.field, className)}>
      <div data-operator-ui="field">
        <dt className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</dt>
        <dd className={OPERATOR_DESIGN_TOKENS.typography.value}>{value}</dd>
      </div>
    </Card>
  );
}
