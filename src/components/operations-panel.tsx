import type { OperationSummaryState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type OperationsPanelProps = {
  operations: OperationSummaryState[];
  onOpenWorkspaceDocument: (documentRef: string) => void;
};

export function OperationsPanel({
  operations,
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
        <div className="space-y-4">
          {operations.slice(0, 8).map((operation) => (
            <div
              key={operation.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={operation.scope === "live" ? "warning" : "neutral"}>
                  {operation.scope}
                </Badge>
                <Badge tone="positive">{operation.status}</Badge>
                <Badge tone="neutral">{operation.kind}</Badge>
                <span className="text-xs uppercase tracking-[0.16em] text-ink-300">
                  {operation.createdAt}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-ink-50">{operation.summary}</p>
              <p className="mt-2 text-sm leading-6 text-ink-200">{operation.details}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => onOpenWorkspaceDocument(operation.operationRef)}
                >
                  Open operation.json
                </Button>
                {operation.relatedRefs.slice(0, 3).map((pathRef) => (
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
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
