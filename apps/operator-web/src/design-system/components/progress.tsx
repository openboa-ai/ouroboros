import type { ComponentProps } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorProgress({
  className,
  ...props
}: ComponentProps<typeof Progress>) {
  return (
    <Progress
      data-operator-ui="progress"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.progressTrack, className)}
      {...props}
    />
  );
}
