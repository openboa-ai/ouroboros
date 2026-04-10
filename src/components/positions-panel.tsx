import type { LaneEventState, LiveOrder, LivePosition } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type PositionsPanelProps = {
  positions: LivePosition[];
  orders: LiveOrder[];
  laneEvents: LaneEventState[];
};

export function PositionsPanel({ laneEvents, orders, positions }: PositionsPanelProps) {
  return (
    <div className="space-y-6">
      <Card title="Positions" description="Current state plus event-aware trading context.">
        <div className="space-y-3">
          {positions.map((position) => (
            <div
              key={position.symbol}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-ink-300">{position.symbol}</p>
                  <p className="mt-1 text-lg font-semibold text-ink-50">{position.side}</p>
                </div>
                <Badge tone={position.side === "LONG" ? "positive" : "warning"}>
                  {position.size}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-ink-200">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-300">Entry</p>
                  <p className="mt-1 text-ink-50">{position.entry}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-300">PnL</p>
                  <p className="mt-1 text-ink-50">{position.pnl}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-300">Protective stop</p>
                  <p className="mt-1 text-ink-50">{position.protectiveStop}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-300">Context</p>
                  <p className="mt-1 text-ink-50">{position.contextTag}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Orders" description="Authoritative current state plus event history behind the service layer.">
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-50">{order.symbol}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink-300">
                    {order.kind}
                  </p>
                </div>
                <Badge tone={order.statusTone}>{order.status}</Badge>
              </div>
              <p className="mt-3">{order.summary}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Lane Events" description="Live lane history is kept alongside current state and exposed through the service layer.">
        <div className="space-y-3">
          {laneEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-ink-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={event.scope === "positions" ? "positive" : "warning"}>
                    {event.scope}
                  </Badge>
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-300">{event.kind}</p>
                </div>
                <p className="text-xs uppercase tracking-[0.16em] text-ink-300">{event.timestamp}</p>
              </div>
              <p className="mt-3">{event.summary}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
