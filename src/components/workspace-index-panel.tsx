import type { WorkspaceIndexState } from "../lib/service-contract";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type WorkspaceIndexPanelProps = {
  workspaceIndex: WorkspaceIndexState;
  onOpenDocument: (documentId: string, pathRef: string) => void;
};

export function WorkspaceIndexPanel({
  workspaceIndex,
  onOpenDocument
}: WorkspaceIndexPanelProps) {
  return (
    <Card
      title="Workspace Index"
      description="strategy.json stays thin: active refs point at the live path, indexes point at the durable workspace registries."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">schema {workspaceIndex.schemaVersion}</Badge>
          <Badge tone="positive">{workspaceIndex.collectionCount} collections</Badge>
          <Badge tone="neutral">{workspaceIndex.operationCount} operations</Badge>
          <Badge tone="warning">{workspaceIndex.sessionCount} sessions</Badge>
        </div>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Active refs</h3>
          <dl className="space-y-3">
            <IndexRow
              label="Live lane"
              value={workspaceIndex.active.liveLaneRef}
              onOpen={() => onOpenDocument("index:live-lane", workspaceIndex.active.liveLaneRef)}
            />
            <IndexRow
              label="Current checkpoint"
              value={workspaceIndex.active.currentCheckpointRef}
              onOpen={() =>
                onOpenDocument("index:current-checkpoint", workspaceIndex.active.currentCheckpointRef)
              }
            />
            <IndexRow
              label="Export policy"
              value={workspaceIndex.active.exportPolicyRef}
              onOpen={() =>
                onOpenDocument("index:export-policy", workspaceIndex.active.exportPolicyRef)
              }
            />
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Indexes</h3>
          <dl className="space-y-3">
            <IndexRow
              label="Checkpoints"
              value={workspaceIndex.indexes.checkpointsRef}
              onOpen={() =>
                onOpenDocument("index:checkpoints", workspaceIndex.indexes.checkpointsRef)
              }
            />
            <IndexRow
              label="Collections"
              value={workspaceIndex.indexes.collectionsRef}
              onOpen={() =>
                onOpenDocument("index:collections", workspaceIndex.indexes.collectionsRef)
              }
            />
            <IndexRow
              label="Imports"
              value={workspaceIndex.indexes.importsRef}
              onOpen={() => onOpenDocument("index:imports", workspaceIndex.indexes.importsRef)}
            />
            <IndexRow
              label="Operations"
              value={workspaceIndex.indexes.operationsRef}
              onOpen={() =>
                onOpenDocument("index:operations", workspaceIndex.indexes.operationsRef)
              }
            />
            <IndexRow
              label="Sessions"
              value={workspaceIndex.indexes.sessionsRef}
              onOpen={() => onOpenDocument("index:sessions", workspaceIndex.indexes.sessionsRef)}
            />
          </dl>
        </section>
      </div>
    </Card>
  );
}

function IndexRow({
  label,
  value,
  onOpen
}: {
  label: string;
  value: string;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2">
        <Button
          variant="ghost"
          className="h-auto w-full justify-start break-all px-0 py-0 text-left text-sm leading-6 text-ink-50"
          onClick={onOpen}
        >
          {value}
        </Button>
      </dd>
    </div>
  );
}
