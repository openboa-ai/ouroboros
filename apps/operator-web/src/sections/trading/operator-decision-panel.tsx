import type { ReactNode } from "react";
import {
  OperatorActionRow,
  OperatorCallout,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export function OperatorDecisionPanel({
  workspaceLabel,
  detail,
  badges,
  recommendedAction,
  actions
}: {
  workspaceLabel: string;
  detail: string;
  badges: ReactNode;
  recommendedAction: {
    value: string;
    className?: string;
  };
  actions?: ReactNode;
}) {
  return (
    <OperatorPanel variant="elevated" aria-label="Operator decision bar">
      <OperatorSectionHeader
        eyebrow={workspaceLabel}
        title="Trading"
        description={`Paper Trading review cockpit. Live exchange authority remains disabled in this MLP. ${detail}`}
        actions={badges}
      />
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <OperatorCallout
          label="Recommended action"
          value={recommendedAction.value}
          className={recommendedAction.className}
        />
        {actions && <OperatorActionRow>{actions}</OperatorActionRow>}
      </div>
    </OperatorPanel>
  );
}
