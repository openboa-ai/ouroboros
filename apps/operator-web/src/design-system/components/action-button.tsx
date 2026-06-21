import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      data-operator-ui="button"
      className={cn(OPERATOR_DESIGN_TOKENS.surface.actionButton, className)}
      {...props}
    />
  );
}
