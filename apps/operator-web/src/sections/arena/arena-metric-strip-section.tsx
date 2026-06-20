import {
  OPERATOR_DESIGN_TOKENS,
  OperatorStat
} from "@/design-system";

export interface ArenaMetricStripItem {
  label: string;
  value: string;
  detail: string;
}

export function ArenaMetricStripSection({
  metrics
}: {
  metrics: ArenaMetricStripItem[];
}) {
  return (
    <div data-operator-ui="metric-strip" className={OPERATOR_DESIGN_TOKENS.layout.statGrid}>
      {metrics.map((metric) => (
        <OperatorStat
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
        />
      ))}
    </div>
  );
}
