import type { ComponentProps } from "react";
import {
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStatusBadge
} from "@/design-system";

export interface TradingReadbackField {
  label: string;
  value: string;
}

export function TradingPaperReadbackSection({
  badgeLabel,
  badgeVariant,
  fields
}: {
  badgeLabel: string;
  badgeVariant: ComponentProps<typeof OperatorStatusBadge>["variant"];
  fields: TradingReadbackField[];
}) {
  return (
    <OperatorPanel aria-label="Trading paper readback">
      <OperatorSectionHeader
        eyebrow="Paper readback"
        title="Trading review evidence"
        actions={<OperatorStatusBadge value={badgeLabel} variant={badgeVariant} />}
      />
      <OperatorFieldGrid density="dense">
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </OperatorFieldGrid>
    </OperatorPanel>
  );
}
