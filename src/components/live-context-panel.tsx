import type { LiveContextState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type LiveContextPanelProps = {
  liveContext: LiveContextState;
  onOpenDocument: (documentId: string, pathRef: string) => void;
};

export function LiveContextPanel({ liveContext, onOpenDocument }: LiveContextPanelProps) {
  return (
    <Card
      title="Live Context"
      description="Everything here is part of the live trading context and remains export-targetable."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="positive">{liveContext.positionEventCount} position events</Badge>
          <Badge tone="warning">{liveContext.orderEventCount} order events</Badge>
          <Badge tone="neutral">{liveContext.sessions.length} live sessions</Badge>
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
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Live sessions</h3>
          <div className="space-y-2">
            {liveContext.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenDocument(`session:${session.id}`, session.pathRef)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink-50">{session.label}</p>
                  <Badge tone="neutral">{session.status}</Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink-300">{session.startedAt}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Evaluation summaries</h3>
          <div className="space-y-2">
            {liveContext.evaluationSummaries.map((summary) => (
              <button
                key={summary.id}
                type="button"
                onClick={() => onOpenDocument(`evaluation:${summary.id}`, summary.pathRef)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <p className="text-sm font-medium text-ink-50">{summary.headline}</p>
                <p className="mt-1 text-xs leading-5 text-ink-300">{summary.createdAt}</p>
                <p className="mt-2 text-xs leading-5 text-ink-300">
                  {summary.evidenceRefs.length} evidence refs attached
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
}
