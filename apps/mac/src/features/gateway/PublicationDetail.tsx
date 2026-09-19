import { useEffect, useState } from "react";
import type { DetailTarget } from "@/app/contracts";
import type { ScreenContext } from "@/app/Workspace";
import { publicationDocuments, type PublishedDocument } from "@/data/catalog";
import { str, type LiveSnapshot } from "@/data/live";
import { Facts, EmptyState } from "@/ui/components/patterns";
import { RecordLink } from "@/ui/components/RecordLink";
import { Button } from "@/ui/primitives/button";
export function PublicationDetail({
  snapshot,
  target,
  open,
}: {
  snapshot: LiveSnapshot;
  target: DetailTarget;
  open: ScreenContext["open"];
}) {
  // Changed observations hide old files; only this request may deliver its result.
  const [result, setResult] = useState<{
    snapshot: LiveSnapshot;
    intent: string | undefined;
    workId: unknown;
    files: PublishedDocument[];
    state: string;
  } | null>(null);
  const current =
    result?.snapshot === snapshot &&
    result.intent === target.id &&
    result.workId === target.workId
      ? result
      : null;
  const files = current?.files ?? [],
    state = current?.state ?? "loading";
  useEffect(() => {
    let active = true;
    void publicationDocuments(
      snapshot,
      target.id ?? "",
      typeof target.workId === "string" ? target.workId : undefined,
    )
      .then((files) => {
        if (active)
          setResult({
            snapshot,
            intent: target.id,
            workId: target.workId,
            files,
            state: "ready",
          });
      })
      .catch(() => {
        if (active)
          setResult({
            snapshot,
            intent: target.id,
            workId: target.workId,
            files: [],
            state: "unavailable",
          });
      });
    return () => {
      active = false;
    };
  }, [snapshot, target.id, target.workId]);
  return (
    <div className="inspector-content">
      <Facts
        rows={[
          ["Publication request", target.id ?? ""],
          ["Related work", str(target.workId)],
        ]}
      />
      {files.map((file) => (
        <RecordLink
          key={`${file.workspace}:${file.revision}:${file.path}`}
          title={file.path}
          meta={`Revision ${file.revision}`}
          onClick={() =>
            open({
              kind: "artifact",
              workspace: file.workspace,
              revision: file.revision,
              path: file.path,
              workId: file.scope.work_id,
              delegationId: file.scope.delegation_id,
              targetId: file.scope.target_id,
            })
          }
        />
      ))}
      {!files.length && (
        <EmptyState
          title={
            state === "loading"
              ? "Loading original publication"
              : state === "unavailable"
                ? "Publication unavailable"
                : "Publication not found in visible workspaces"
          }
          detail={
            state === "loading"
              ? "Checking the recorded publication reference."
              : "Current access and loaded workspace coverage apply. A newer revision is never substituted."
          }
        />
      )}
      {typeof target.workId === "string" && (
        <Button
          variant="secondary"
          onClick={() => open({ kind: "work", id: target.workId as string })}
        >
          Related work
        </Button>
      )}
    </div>
  );
}
