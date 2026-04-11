import type { ExportInspectorState } from "../lib/service-contract";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type ExportInspectorPanelProps = {
  exportInspector: ExportInspectorState;
  onOpenDocument: (documentId: string, pathRef: string) => void;
};

export function ExportInspectorPanel({
  exportInspector,
  onOpenDocument
}: ExportInspectorPanelProps) {
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
              <ExportRow
                label="Bundle ref"
                value={latestBundle.bundleRef}
                onOpen={() => onOpenDocument("export:bundle", latestBundle.bundleRef)}
              />
              <ExportRow
                label="Workspace ref"
                value={latestBundle.workspaceRef}
                onOpen={() => onOpenDocument("export:workspace", latestBundle.workspaceRef)}
              />
              <ExportRow
                label="Checkpoint ref"
                value={latestBundle.checkpointRef}
                onOpen={() =>
                  onOpenDocument("export:checkpoint", latestBundle.checkpointRef)
                }
              />
              <ExportRow label="Created" value={latestBundle.createdAt} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                Included refs
              </h3>
              <div className="space-y-2">
                {latestBundle.includedRefs.map((includedRef) => (
                  <button
                    key={includedRef}
                    type="button"
                    onClick={() => onOpenDocument(`export:included:${includedRef}`, includedRef)}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm leading-6 text-ink-200 transition hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    {includedRef}
                  </button>
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

function ExportRow({
  label,
  value,
  onOpen
}: {
  label: string;
  value: string;
  onOpen?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2">
        {onOpen ? (
          <Button
            variant="ghost"
            className="h-auto w-full justify-start break-all px-0 py-0 text-left text-sm leading-6 text-ink-50"
            onClick={onOpen}
          >
            {value}
          </Button>
        ) : (
          <p className="break-all text-sm leading-6 text-ink-50">{value}</p>
        )}
      </dd>
    </div>
  );
}
