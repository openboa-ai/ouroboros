import type {
  ImportComparisonState,
  ImportDetailState,
  ImportSummaryState
} from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type ImportsPanelProps = {
  imports: ImportSummaryState[];
  selectedImportId: string | null;
  importDetail: ImportDetailState | null;
  importComparison: ImportComparisonState | null;
  onSelectImport: (importId: string) => void;
  onActivateImport: (importId: string) => void;
  onOpenWorkspaceDocument: (documentRef: string) => void;
};

export function ImportsPanel({
  imports,
  importComparison,
  selectedImportId,
  importDetail,
  onActivateImport,
  onOpenWorkspaceDocument,
  onSelectImport
}: ImportsPanelProps) {
  if (imports.length === 0) {
    return (
      <Card
        title="Imports"
        description="Sanitized bundles staged back into the workspace appear here once exports are imported."
      >
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm leading-6 text-ink-300">
          No staged imports yet. Create an export checkpoint, then stage the latest bundle back into
          the workspace.
        </div>
      </Card>
    );
  }

  const selected = imports.find((item) => item.id === selectedImportId) ?? imports[0] ?? null;

  return (
    <Card
      title="Imports"
      description="Live-centered sanitized bundles are staged inside the workspace so they can be inspected without mutating the active lane."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          {imports.map((item) => {
            const isSelected = item.id === selected?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectImport(item.id)}
                className={[
                  "grid w-full gap-3 rounded-2xl border p-4 text-left transition",
                  "lg:grid-cols-[1fr_auto]",
                  isSelected
                    ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-50">{item.policyId}</p>
                    <Badge tone={item.sanitized ? "positive" : "danger"}>
                      {item.sanitized ? "sanitized" : "unsafe"}
                    </Badge>
                  </div>
                  <p className="mt-2 break-all text-sm leading-6 text-ink-200">
                    {item.sourceBundleRef}
                  </p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.16em] text-ink-300">
                  <p>{item.importedAt}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selected && importDetail ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={importDetail.sanitized ? "positive" : "danger"}>
                {importDetail.sanitized ? "sanitized" : "unsafe"}
              </Badge>
              <Badge tone="neutral">{importDetail.policyId}</Badge>
              <Badge tone="warning">{importDetail.workspaceFileRefs.length} files</Badge>
            </div>

            <dl className="space-y-3 text-sm">
              <ImportRow label="Import manifest" value={importDetail.importRef} />
              <ImportRow label="Bundle manifest" value={importDetail.bundleRef} />
              <ImportRow label="Workspace root" value={importDetail.workspaceRef} />
              <ImportRow label="Checkpoint ref" value={importDetail.checkpointRef} />
            </dl>

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Activation preflight</h3>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={importDetail.preflight.status === "ready" ? "positive" : "danger"}>
                    {importDetail.preflight.status}
                  </Badge>
                  <Badge tone="neutral">{importDetail.preflight.checks.length} checks</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-200">{importDetail.preflight.summary}</p>
                <div className="mt-3 space-y-2">
                  {importDetail.preflight.checks.map((check) => (
                    <div
                      key={check.id}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            check.severity === "ok"
                              ? "positive"
                              : check.severity === "warning"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {check.severity}
                        </Badge>
                        <p className="text-sm font-medium text-ink-50">{check.label}</p>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-ink-300">{check.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => onActivateImport(importDetail.id)}
                disabled={importDetail.preflight.status !== "ready"}
              >
                Activate As Live
              </Button>
              <Button
                variant="ghost"
                onClick={() => onOpenWorkspaceDocument(importDetail.importRef)}
              >
                Open Import Manifest
              </Button>
            </div>

            {importComparison ? (
              <section className="space-y-2">
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                  Current Live vs Import
                </h3>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">{importComparison.changedCount} changed</Badge>
                    <Badge tone="positive">{importComparison.addedCount} added</Badge>
                    <Badge tone="danger">{importComparison.removedCount} removed</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink-200">{importComparison.summary}</p>
                  <div className="mt-3 space-y-2">
                    {importComparison.files.slice(0, 6).map((file) => (
                      <button
                        key={`${file.relativePath}-${file.status}`}
                        type="button"
                        onClick={() => onOpenWorkspaceDocument(file.targetRef ?? file.baseRef ?? importDetail.importRef)}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{file.status}</Badge>
                          <p className="text-sm font-medium text-ink-50">{file.relativePath}</p>
                        </div>
                        <p className="mt-2 break-all text-xs leading-5 text-ink-300">
                          {file.targetRef ?? file.baseRef}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Workspace files</h3>
              <div className="grid gap-2">
                {importDetail.workspaceFileRefs.slice(0, 8).map((pathRef) => (
                  <Button
                    key={pathRef}
                    variant="ghost"
                    className="justify-start overflow-hidden text-ellipsis whitespace-nowrap"
                    onClick={() => onOpenWorkspaceDocument(pathRef)}
                  >
                    {pathRef}
                  </Button>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ImportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-ink-50">{value}</dd>
    </div>
  );
}
