import { OperatorMetricStrip } from "@/design-system";

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
  return <OperatorMetricStrip metrics={metrics} />;
}
