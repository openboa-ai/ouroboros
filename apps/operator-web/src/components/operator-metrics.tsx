import { cn } from "@/lib/utils";

export interface OperatorMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}

export function OperatorMetricStrip({
  metrics,
  className
}: {
  metrics: OperatorMetric[];
  className?: string;
}) {
  return (
    <dl className={cn(
      "grid divide-y border-y bg-muted/20 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4",
      className
    )}>
      {metrics.map((metric) => (
        <div className="min-w-0 px-4 py-3" key={metric.label}>
          <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
          <dd className={cn(
            "mt-1 break-words text-lg leading-snug font-semibold tabular-nums [overflow-wrap:anywhere]",
            metric.tone === "positive" && "text-success",
            metric.tone === "negative" && "text-destructive",
            metric.tone === "warning" && "text-warning-foreground dark:text-warning"
          )}>
            {metric.value}
          </dd>
          {metric.detail ? (
            <dd className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{metric.detail}</dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
