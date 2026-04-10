import { ArrowDownRight, ArrowUpRight, Gauge, Shield, Zap } from "lucide-react";
import type { MetricCardData } from "../lib/service-contract";
import { Card } from "./ui/card";

type DashboardGridProps = {
  metrics: MetricCardData[];
};

const iconMap = {
  momentum: Zap,
  risk: Shield,
  leverage: Gauge,
  up: ArrowUpRight,
  down: ArrowDownRight
} as const;

export function DashboardGrid({ metrics }: DashboardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.icon];

        return (
          <Card key={metric.label} title={metric.label} description={metric.description}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-semibold text-ink-50">{metric.value}</p>
                <p className="mt-2 text-sm text-ink-300">{metric.delta}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <Icon className="size-5 text-ink-50" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
