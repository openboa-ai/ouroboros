import type { ExportInspectorState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type ExportInspectorPanelProps = {
  exportInspector: ExportInspectorState;
};

export function ExportInspectorPanel({ exportInspector }: ExportInspectorPanelProps) {
  const latestBundle = exportInspector.latestBundle;

  return (
    <Card
      title="Export Inspector"
      description="Exports are generated from checkpoints. The client sees the sanitized bundle metadata instead of walking the workspace directly."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">{exportInspector.policyId}</Badge>
          {latestBundle ? (
            <Badge tone="positive">latest bundle ready</Badge>
          ) : (
            <Badge tone="neutral">no generated bundle yet</Badge>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Policy description</p>
          <p className="mt-2 text-sm leading-6 text-ink-50">{exportInspector.description}</p>
        </div>

        {latestBundle ? (
          <div className="space-y-4">
            <dl className="space-y-3">
              <ExportRow label="Bundle ref" value={latestBundle.bundleRef} />
              <ExportRow label="Workspace ref" value={latestBundle.workspaceRef} />
              <ExportRow label="Checkpoint ref" value={latestBundle.checkpointRef} />
              <ExportRow label="Created" value={latestBundle.createdAt} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                Included refs
              </h3>
              <div className="space-y-2">
                {latestBundle.includedRefs.map((includedRef) => (
                  <div
                    key={includedRef}
                    className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-ink-200"
                  >
                    {includedRef}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                Excluded paths
              </h3>
              <div className="flex flex-wrap gap-2">
                {latestBundle.excludedPaths.map((excludedPath) => (
                  <Badge key={excludedPath} tone="neutral">
                    {excludedPath}
                  </Badge>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ExportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-ink-50">{value}</dd>
    </div>
  );
}
