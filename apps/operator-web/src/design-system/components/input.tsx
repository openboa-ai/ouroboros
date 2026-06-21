import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return (
    <Input
      data-operator-ui="input"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.input, className)}
      {...props}
    />
  );
}
