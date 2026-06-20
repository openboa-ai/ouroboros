import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader
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
  badgeVariant: ComponentProps<typeof Badge>["variant"];
  fields: TradingReadbackField[];
}) {
  return (
    <OperatorPanel aria-label="Trading paper readback">
      <OperatorSectionHeader
        eyebrow="Paper readback"
        title="Trading review evidence"
        actions={<Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      />
      <OperatorFieldGrid density="dense">
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </OperatorFieldGrid>
    </OperatorPanel>
  );
}
