import type { ReactNode } from "react";
import { OPERATOR_DESIGN_TOKENS } from "../tokens";
import { OperatorPanel } from "./panel";
import { OperatorSectionHeader } from "./section-header";
import { OperatorStatusBadge } from "./status-badge";

export function OperatorInfoSection({
  title,
  summary,
  badge,
  defaultOpen: _defaultOpen = false,
  children
}: {
  title: string;
  summary?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <OperatorPanel data-operator-ui="info-section" aria-label={title}>
      <OperatorSectionHeader
        title={title}
        description={summary}
        actions={badge && <OperatorStatusBadge value={badge} />}
      />
      <div
        data-operator-ui="info-section-content"
        className={OPERATOR_DESIGN_TOKENS.layout.infoSectionContent}
      >
        {children}
      </div>
    </OperatorPanel>
  );
}
