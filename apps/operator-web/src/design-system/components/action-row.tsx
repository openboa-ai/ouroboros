import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorActionRow({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="action-row"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.actionRow, className)}
      {...props}
    >
      {children}
    </div>
  );
}
