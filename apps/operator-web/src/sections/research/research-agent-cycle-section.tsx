import type { ComponentProps } from "react";
import {
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStatGrid,
  OperatorStatusBadge
} from "@/design-system";

export interface ResearchAgentCycleMetric {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export interface ResearchAgentCycleLineageField {
  label: string;
  value: string;
}

export function ResearchAgentCycleSection({
  title,
  description,
  badgeLabel,
  badgeVariant = "default",
  metrics,
  lineageFields
}: {
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant?: ComponentProps<typeof OperatorStatusBadge>["variant"];
  metrics: ResearchAgentCycleMetric[];
  lineageFields?: ResearchAgentCycleLineageField[];
}) {
  return (
    <OperatorPanel aria-label="Agent generated Trading System">
      <OperatorSectionHeader
        title={title}
        description={description}
        actions={<OperatorStatusBadge value={badgeLabel} variant={badgeVariant} />}
      />
      <OperatorStatGrid stats={metrics} aria-label="Agent generated Trading System metrics" />
      {lineageFields && (
        <OperatorFieldGrid density="dense" aria-label="Full-cycle lineage">
          {lineageFields.map((field) => (
            <OperatorField key={field.label} label={field.label} value={field.value} />
          ))}
        </OperatorFieldGrid>
      )}
    </OperatorPanel>
  );
}
