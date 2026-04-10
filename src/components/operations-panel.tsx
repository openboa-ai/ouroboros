import type { OperationDetailState, OperationSummaryState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type OperationsPanelProps = {
  operations: OperationSummaryState[];
  selectedOperationId: string | null;
  operationDetail: OperationDetailState | null;
  onSelectOperation: (operationId: string) => void;
  onOpenWorkspaceDocument: (documentRef: string) => void;
};

export function OperationsPanel({
  operations,
  selectedOperationId,
  operationDetail,
  onSelectOperation,
  onOpenWorkspaceDocument
}: OperationsPanelProps) {
  return (
    <Card
      title="Operation History"
      description="Durable service-layer audit trail for live and workspace mutations."
    >
      {operations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm leading-6 text-ink-300">
          No workspace operations recorded yet. Service-triggered mutations will append durable
          records here.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-3">
            {operations.slice(0, 10).map((operation) => {
              const isSelected = operation.id === (selectedOperationId ?? operations[0]?.id);

              return (
                <button
                  key={operation.id}
                  type="button"
                  onClick={() => onSelectOperation(operation.id)}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isSelected
                      ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={operation.scope === "live" ? "warning" : "neutral"}>
                      {operation.scope}
                    </Badge>
                    <Badge tone="positive">{operation.status}</Badge>
                    <Badge tone="neutral">{operation.kind}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink-50">{operation.summary}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-300">
                    {operation.createdAt}
                  </p>
                </button>
              );
            })}
          </div>

          {operationDetail ? (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={operationDetail.scope === "live" ? "warning" : "neutral"}>
                  {operationDetail.scope}
                </Badge>
                <Badge tone="positive">{operationDetail.status}</Badge>
                <Badge tone="neutral">{operationDetail.kind}</Badge>
                <span className="text-xs uppercase tracking-[0.16em] text-ink-300">
                  {operationDetail.createdAt}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-50">{operationDetail.summary}</p>
                <p className="mt-2 text-sm leading-6 text-ink-200">{operationDetail.details}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => onOpenWorkspaceDocument(operationDetail.operationRef)}
                >
                  Open operation.json
                </Button>
                <Badge tone="neutral">
                  {operationDetail.relatedDocuments.length} related refs
                </Badge>
                {operationDetail.unresolvedRefs.length > 0 ? (
                  <Badge tone="warning">
                    {operationDetail.unresolvedRefs.length} unresolved
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                {operationDetail.relatedDocuments.map((document) => (
                  <div
                    key={document.pathRef}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={document.resolved ? "neutral" : "warning"}>
                        {document.category}
                      </Badge>
                      {!document.resolved ? <Badge tone="warning">unresolved</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-ink-50">{document.label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-300">{document.description}</p>
                    <Button
                      variant="ghost"
                      className="mt-3 justify-start overflow-hidden text-ellipsis whitespace-nowrap"
                      onClick={() => onOpenWorkspaceDocument(document.pathRef)}
                    >
                      {document.pathRef}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm leading-6 text-ink-300">
              Select an operation to inspect the durable service-layer audit record and linked
              workspace documents.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
