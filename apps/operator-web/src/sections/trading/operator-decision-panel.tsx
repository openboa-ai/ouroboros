import type { ReactNode } from "react";
import {
  OperatorCallout,
  OperatorPanel,
  OperatorResponsiveSplit,
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
      <OperatorResponsiveSplit breakpoint="md" actions={actions}>
        <OperatorCallout
          label="Recommended action"
          value={recommendedAction.value}
          className={recommendedAction.className}
        />
      </OperatorResponsiveSplit>
    </OperatorPanel>
  );
}
