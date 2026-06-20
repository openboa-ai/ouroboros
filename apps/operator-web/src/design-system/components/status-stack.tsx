import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";

export interface OperatorStatusStackMessage {
  id: string;
  value: ReactNode;
  tone?: "error" | "info";
}

export function OperatorStatusStack({
  messages,
  className,
  ...props
}: {
  messages: OperatorStatusStackMessage[];
  className?: string;
} & Omit<ComponentProps<"div">, "className" | "children">) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <div
      data-operator-ui="status-stack"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.statusStack, className)}
      {...props}
    >
      {messages.map((message) => {
        const tone = message.tone ?? "info";
        return (
          <p
            data-operator-ui="status-message"
            data-tone={tone}
            className={tone === "error"
              ? OPERATOR_DESIGN_TOKENS.typography.statusError
              : OPERATOR_DESIGN_TOKENS.typography.statusInfo}
            key={message.id}
          >
            {message.value}
          </p>
        );
      })}
    </div>
  );
}
