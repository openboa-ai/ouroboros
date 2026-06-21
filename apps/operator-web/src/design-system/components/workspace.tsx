import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorPanel } from "./panel";

export function OperatorWorkspacePanel({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof OperatorPanel>, "className" | "variant">) {
  return (
    <OperatorPanel
      data-operator-ui="workspace-panel"
      variant="elevated"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.workspacePanel, className)}
      {...props}
    >
      {children}
    </OperatorPanel>
  );
}

export function OperatorWorkspaceBody({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="workspace-body"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.workspaceBody, className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function OperatorWorkspaceSplit({
  children,
  inspector,
  inspectorLabel,
  className,
  ...props
}: {
  children: ReactNode;
  inspector: ReactNode;
  inspectorLabel: string;
  className?: string;
} & Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      data-operator-ui="workspace-split"
      className={cn(OPERATOR_DESIGN_TOKENS.layout.workspaceSplit, className)}
      {...props}
    >
      <div
        data-operator-ui="workspace-primary"
        className={OPERATOR_DESIGN_TOKENS.layout.workspacePrimary}
      >
        {children}
      </div>
      <aside
        data-operator-ui="workspace-inspector"
        aria-label={inspectorLabel}
        className={OPERATOR_DESIGN_TOKENS.layout.workspaceInspector}
      >
        {inspector}
      </aside>
    </div>
  );
}
