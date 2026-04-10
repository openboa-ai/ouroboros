import type { WorkspaceIndexState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type WorkspaceIndexPanelProps = {
  workspaceIndex: WorkspaceIndexState;
};

export function WorkspaceIndexPanel({ workspaceIndex }: WorkspaceIndexPanelProps) {
  return (
    <Card
      title="Workspace Index"
      description="strategy.json stays thin: active refs point at the live path, indexes point at the durable workspace registries."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">schema {workspaceIndex.schemaVersion}</Badge>
          <Badge tone="positive">{workspaceIndex.collectionCount} collections</Badge>
          <Badge tone="warning">{workspaceIndex.sessionCount} sessions</Badge>
        </div>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Active refs</h3>
          <dl className="space-y-3">
            <IndexRow label="Live lane" value={workspaceIndex.active.liveLaneRef} />
            <IndexRow
              label="Current checkpoint"
              value={workspaceIndex.active.currentCheckpointRef}
            />
            <IndexRow label="Export policy" value={workspaceIndex.active.exportPolicyRef} />
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Indexes</h3>
          <dl className="space-y-3">
            <IndexRow label="Checkpoints" value={workspaceIndex.indexes.checkpointsRef} />
            <IndexRow label="Collections" value={workspaceIndex.indexes.collectionsRef} />
            <IndexRow label="Sessions" value={workspaceIndex.indexes.sessionsRef} />
          </dl>
        </section>
      </div>
    </Card>
  );
}

function IndexRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-ink-50">{value}</dd>
    </div>
  );
}
