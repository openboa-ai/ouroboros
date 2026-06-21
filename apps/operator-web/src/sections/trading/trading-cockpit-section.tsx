import type { ComponentProps, ReactNode } from "react";
import {
  OperatorContentSection,
  OperatorSectionHeader,
  OperatorSectionStack,
  OperatorStatusBadge
} from "@/design-system";

export function TradingCockpitSection({
  candidateName,
  status,
  statusVariant,
  children
}: {
  candidateName: string;
  status: string;
  statusVariant: ComponentProps<typeof OperatorStatusBadge>["variant"];
  children: ReactNode;
}) {
  return (
    <OperatorContentSection aria-label="Trading cockpit">
      <OperatorSectionHeader
        title="Trading cockpit"
        description={candidateName}
        actions={<OperatorStatusBadge value={status} variant={statusVariant} />}
      />
      <OperatorSectionStack density="loose">{children}</OperatorSectionStack>
    </OperatorContentSection>
  );
}
