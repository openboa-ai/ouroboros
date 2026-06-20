import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorCallout({
  label,
  value,
  className
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Alert
      data-operator-ui="callout"
      role="note"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.callout, className)}
    >
      <AlertTitle className={OPERATOR_DESIGN_TOKENS.typography.label}>{label}</AlertTitle>
      <AlertDescription className={OPERATOR_DESIGN_TOKENS.typography.calloutValue}>
        {value}
      </AlertDescription>
    </Alert>
  );
}
