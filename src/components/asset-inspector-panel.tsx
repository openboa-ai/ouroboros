import type { AssetInspectorState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type AssetInspectorPanelProps = {
  assetInspector: AssetInspectorState;
};

const refRows: Array<{ key: keyof AssetInspectorState; label: string }> = [
  { key: "workspaceRoot", label: "Workspace root" },
  { key: "strategyRef", label: "Strategy entrypoint" },
  { key: "liveLaneRef", label: "Live lane" },
  { key: "currentCheckpointRef", label: "Current checkpoint" },
  { key: "exportPolicyRef", label: "Export policy" }
];

export function AssetInspectorPanel({ assetInspector }: AssetInspectorPanelProps) {
  return (
    <Card
      title="Asset Inspector"
      description="The client renders workspace refs, but mutations still flow through the service boundary."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{assetInspector.checkpointCount} checkpoints</Badge>
          <Badge tone="warning">{assetInspector.exportCount} exports</Badge>
          {assetInspector.latestExportBundleRef ? (
            <Badge tone="positive">Latest export ready</Badge>
          ) : (
            <Badge tone="neutral">No generated export yet</Badge>
          )}
        </div>

        <dl className="space-y-3">
          {refRows.map(({ key, label }) => (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
              <dd className="mt-2 break-all text-sm leading-6 text-ink-50">
                {assetInspector[key] as string}
              </dd>
            </div>
          ))}
          {assetInspector.latestExportBundleRef ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Latest export bundle</dt>
              <dd className="mt-2 break-all text-sm leading-6 text-ink-50">
                {assetInspector.latestExportBundleRef}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </Card>
  );
}
