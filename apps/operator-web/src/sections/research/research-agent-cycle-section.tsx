import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStat
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
  badgeVariant?: ComponentProps<typeof Badge>["variant"];
  metrics: ResearchAgentCycleMetric[];
  lineageFields?: ResearchAgentCycleLineageField[];
}) {
  return (
    <OperatorPanel aria-label="Agent generated Trading System">
      <OperatorSectionHeader
        title={title}
        description={description}
        actions={<Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      />
      <section
        data-operator-ui="research-agent-cycle-metrics"
        className={OPERATOR_DESIGN_TOKENS.layout.statGrid}
        aria-label="Agent generated Trading System metrics"
      >
        {metrics.map((metric) => (
          <OperatorStat
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            className={metric.className}
          />
        ))}
      </section>
      {lineageFields && (
        <dl
          data-operator-ui="research-agent-cycle-lineage"
          className={OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid}
          aria-label="Full-cycle lineage"
        >
          {lineageFields.map((field) => (
            <OperatorField key={field.label} label={field.label} value={field.value} />
          ))}
        </dl>
      )}
    </OperatorPanel>
  );
}
