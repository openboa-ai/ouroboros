import type {
  CheckpointComparisonState,
  CheckpointDetailState,
  CheckpointSummary
} from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

type StrategyTimelineProps = {
  checkpoints: CheckpointSummary[];
  checkpointDetail: CheckpointDetailState | null;
  checkpointComparison: CheckpointComparisonState | null;
  selectedCheckpointId: string | null;
  onSelectCheckpoint: (checkpointId: string) => void;
  onExportCheckpoint: (checkpointId: string) => void;
  onRestoreCheckpoint: (checkpointId: string) => void;
  onOpenWorkspaceDocument: (documentRef: string) => void;
};

export function StrategyTimeline({
  checkpointComparison,
  checkpointDetail,
  checkpoints,
  onExportCheckpoint,
  onOpenWorkspaceDocument,
  onSelectCheckpoint,
  onRestoreCheckpoint,
  selectedCheckpointId
}: StrategyTimelineProps) {
  const selectedCheckpoint =
    checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? checkpoints[0] ?? null;

  return (
    <Card
      title="Checkpoint Timeline"
      description="Promotion, export, and incident checkpoints remain first-class addressable entities with drill-down refs."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <div className="space-y-4">
          {checkpoints.map((checkpoint) => {
            const selected = checkpoint.id === selectedCheckpoint?.id;
            return (
              <button
                key={checkpoint.id}
                type="button"
                onClick={() => onSelectCheckpoint(checkpoint.id)}
                className={[
                  "grid w-full gap-3 rounded-2xl border p-4 text-left transition",
                  "lg:grid-cols-[1fr_auto]",
                  selected
                    ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-50">{checkpoint.alias}</p>
                    <Badge tone={checkpoint.typeTone}>{checkpoint.type}</Badge>
                    {selected ? <Badge tone="positive">Selected</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-200">{checkpoint.summary}</p>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.16em] text-ink-300">
                  <p>{checkpoint.createdAt}</p>
                  <p className="mt-2">{checkpoint.performance}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selectedCheckpoint ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={selectedCheckpoint.typeTone}>{selectedCheckpoint.type}</Badge>
                <Badge tone="neutral">{selectedCheckpoint.alias}</Badge>
              </div>
              <p className="text-sm leading-6 text-ink-200">{selectedCheckpoint.summary}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="ghost" onClick={() => onExportCheckpoint(selectedCheckpoint.id)}>
                  {selectedCheckpoint.exportBundleRef ? "Refresh Export Bundle" : "Export This Checkpoint"}
                </Button>
                <Button variant="secondary" onClick={() => onRestoreCheckpoint(selectedCheckpoint.id)}>
                  Restore This Checkpoint
                </Button>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Performance</dt>
                <dd className="mt-1 text-ink-50">{selectedCheckpoint.performance}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Created</dt>
                <dd className="mt-1 text-ink-50">{selectedCheckpoint.createdAt}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Checkpoint ref</dt>
                <dd className="mt-1 break-all text-ink-50">{selectedCheckpoint.pathRef}</dd>
              </div>
              {checkpointDetail ? (
                <>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                      Snapshot workspace
                    </dt>
                    <dd className="mt-1 break-all text-ink-50">
                      {checkpointDetail.snapshotWorkspaceRef}
                    </dd>
                  </div>
                  <div>
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                      Snapshot files
                    </dt>
                    <dd className="mt-2 space-y-2">
                      {checkpointDetail.workspaceFileRefs.slice(0, 6).map((fileRef) => (
                        <button
                          key={fileRef}
                          type="button"
                          onClick={() => onOpenWorkspaceDocument(fileRef)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm leading-6 text-ink-50 transition hover:border-white/20 hover:bg-white/[0.05]"
                        >
                          {fileRef}
                        </button>
                      ))}
                      {checkpointDetail.workspaceFileRefs.length > 6 ? (
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-300">
                          +{checkpointDetail.workspaceFileRefs.length - 6} more files
                        </p>
                      ) : null}
                    </dd>
                  </div>
                </>
              ) : null}
              {selectedCheckpoint.exportBundleRef ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Export bundle</dt>
                  <dd className="mt-1 break-all text-ink-50">{selectedCheckpoint.exportBundleRef}</dd>
                </div>
              ) : null}
              {checkpointDetail?.exportBundle ? (
                <>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                      Bundle workspace
                    </dt>
                    <dd className="mt-1 break-all text-ink-50">
                      {checkpointDetail.exportBundle.workspaceRef}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                      Bundle includes
                    </dt>
                    <dd className="mt-2 space-y-2">
                      {checkpointDetail.exportBundle.includedRefs.slice(0, 4).map((includedRef) => (
                        <button
                          key={includedRef}
                          type="button"
                          onClick={() => onOpenWorkspaceDocument(includedRef)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm leading-6 text-ink-50 transition hover:border-white/20 hover:bg-white/[0.05]"
                        >
                          {includedRef}
                        </button>
                      ))}
                      {checkpointDetail.exportBundle.includedRefs.length > 4 ? (
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-300">
                          +{checkpointDetail.exportBundle.includedRefs.length - 4} more refs
                        </p>
                      ) : null}
                    </dd>
                  </div>
                </>
              ) : null}
              {checkpointComparison ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                    Compare vs current live checkpoint
                  </dt>
                  <dd className="mt-2 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="warning">{checkpointComparison.changedCount} changed</Badge>
                      <Badge tone="positive">{checkpointComparison.addedCount} added</Badge>
                      <Badge tone="danger">{checkpointComparison.removedCount} removed</Badge>
                    </div>
                    <p className="text-sm leading-6 text-ink-200">{checkpointComparison.summary}</p>
                    <div className="space-y-2">
                      {checkpointComparison.files.slice(0, 6).map((file) => (
                        <button
                          key={`${file.status}:${file.relativePath}`}
                          type="button"
                          onClick={() =>
                            onOpenWorkspaceDocument(file.targetRef ?? file.baseRef ?? "")
                          }
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-ink-50">{file.relativePath}</p>
                            <Badge
                              tone={
                                file.status === "added"
                                  ? "positive"
                                  : file.status === "removed"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {file.status}
                            </Badge>
                          </div>
                        </button>
                      ))}
                      {checkpointComparison.files.length > 6 ? (
                        <p className="text-xs uppercase tracking-[0.16em] text-ink-300">
                          +{checkpointComparison.files.length - 6} more changed files
                        </p>
                      ) : null}
                    </div>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
