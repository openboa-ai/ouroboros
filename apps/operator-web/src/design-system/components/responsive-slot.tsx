import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export function OperatorResponsiveSlot({
  children,
  className,
  visible,
  ...props
}: {
  children: ReactNode;
  className?: string;
  visible: "mobile" | "desktop";
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="responsive-slot"
      data-visible={visible}
      className={cn(
        visible === "mobile" ? OPERATOR_DESIGN_TOKENS.layout.mobileOnly : OPERATOR_DESIGN_TOKENS.layout.desktopOnly,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
