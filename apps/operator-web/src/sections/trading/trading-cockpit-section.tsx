import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  OperatorContentSection,
  OperatorSectionHeader,
  OperatorSectionStack
} from "@/design-system";

export function TradingCockpitSection({
  candidateName,
  status,
  statusVariant,
  children
}: {
  candidateName: string;
  status: string;
  statusVariant: ComponentProps<typeof Badge>["variant"];
  children: ReactNode;
}) {
  return (
    <OperatorContentSection aria-label="Trading cockpit">
      <OperatorSectionHeader
        title="Trading cockpit"
        description={candidateName}
        actions={<Badge variant={statusVariant}>{status}</Badge>}
      />
      <OperatorSectionStack density="loose">{children}</OperatorSectionStack>
    </OperatorContentSection>
  );
}
