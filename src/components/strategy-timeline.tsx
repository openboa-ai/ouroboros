import type { CheckpointSummary } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type StrategyTimelineProps = {
  checkpoints: CheckpointSummary[];
};

export function StrategyTimeline({ checkpoints }: StrategyTimelineProps) {
  return (
    <Card
      title="Checkpoint Timeline"
      description="Promotion, export, and incident checkpoints remain first-class addressable entities."
    >
      <div className="space-y-4">
        {checkpoints.map((checkpoint) => (
          <div
            key={checkpoint.id}
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink-50">{checkpoint.alias}</p>
                <Badge tone={checkpoint.typeTone}>{checkpoint.type}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-200">{checkpoint.summary}</p>
            </div>
            <div className="text-right text-xs uppercase tracking-[0.16em] text-ink-300">
              <p>{checkpoint.createdAt}</p>
              <p className="mt-2">{checkpoint.performance}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
