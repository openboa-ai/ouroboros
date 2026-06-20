import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export interface TradingReviewPacketField {
  label: string;
  value: string;
}

export function TradingReviewPacketSection({
  severity,
  severityVariant,
  fields
}: {
  severity: string;
  severityVariant: ComponentProps<typeof Badge>["variant"];
  fields: TradingReviewPacketField[];
}) {
  return (
    <OperatorPanel aria-label="Trading review packet">
      <OperatorSectionHeader
        eyebrow="Review packet"
        title="Trading review packet"
        description="Structured evidence for the active Trading review target. This packet is read-only and keeps live authority disabled."
        actions={<Badge variant={severityVariant}>{severity}</Badge>}
      />
      <dl className={OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid}>
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </dl>
    </OperatorPanel>
  );
}
