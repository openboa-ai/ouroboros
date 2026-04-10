import type { LiveContextState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type LiveContextPanelProps = {
  liveContext: LiveContextState;
};

export function LiveContextPanel({ liveContext }: LiveContextPanelProps) {
  return (
    <Card
      title="Live Context"
      description="Everything here is part of the live trading context and remains export-targetable."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="positive">{liveContext.positionEventCount} position events</Badge>
          <Badge tone="warning">{liveContext.orderEventCount} order events</Badge>
          <Badge tone="neutral">{liveContext.sessionLabels.length} live sessions</Badge>
        </div>

        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Working memory</h3>
          <div className="space-y-2">
            {liveContext.memoryNotes.map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-ink-50"
              >
                {note}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Session labels</h3>
          <div className="flex flex-wrap gap-2">
            {liveContext.sessionLabels.map((sessionLabel) => (
              <Badge key={sessionLabel} tone="neutral">
                {sessionLabel}
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Evaluation evidence refs</h3>
          <div className="space-y-2">
            {liveContext.evalEvidenceRefs.map((evidenceRef) => (
              <div
                key={evidenceRef}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-ink-200"
              >
                {evidenceRef}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
}
