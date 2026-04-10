import type { DecisionEntry } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type DecisionFeedProps = {
  decisions: DecisionEntry[];
};

export function DecisionFeed({ decisions }: DecisionFeedProps) {
  return (
    <Card
      title="Decision Feed"
      description="Short decision reasons belong on the main dashboard; deeper reasoning stays in drill-downs."
    >
      <div className="space-y-4">
        {decisions.map((decision) => (
          <div
            key={decision.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink-50">{decision.headline}</p>
                <p className="mt-2 text-sm leading-6 text-ink-200">{decision.reason}</p>
              </div>
              <Badge tone={decision.tone}>{decision.kind}</Badge>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-ink-300">
              {decision.timestamp}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
