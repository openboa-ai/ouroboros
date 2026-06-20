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
    <div data-operator-ui="field" className={cn(OPERATOR_DESIGN_TOKENS.surface.field, className)}>
      <dt className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</dt>
      <dd className={OPERATOR_DESIGN_TOKENS.typography.value}>{value}</dd>
    </div>
  );
}
