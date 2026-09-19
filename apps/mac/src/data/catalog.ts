import { invoke } from "@tauri-apps/api/core";
import type { Material } from "@/features/library/model";
import { record, rows, str, type JsonRecord, type LiveSnapshot } from "./live";
export interface CatalogScope {
  work_id: string;
  delegation_id: string;
  target_id: string;
}
export interface PublishedDocument {
  workspace: string;
  revision: number;
  path: string;
  scope: CatalogScope;
  publication: JsonRecord;
  observation: JsonRecord;
}
export function publishedDocuments(
  snapshot: LiveSnapshot,
): PublishedDocument[] {
  const result: PublishedDocument[] = [];
  for (const o of snapshot.observations)
    for (const workspace of rows(record(o.workspaces).items)) {
      const observation = record(workspace.publication_observation),
        publication = record(observation.latest_confirmed_publication),
        scope = record(workspace.read_scope);
      if (publication.retirement_state === "confirmed") continue;
      for (const file of rows(publication.files))
        result.push({
          workspace: str(file.workspace_id),
          revision: Number(file.revision),
          path: str(file.path),
          scope: {
            work_id: str(scope.work_id),
            delegation_id: str(scope.delegation_id),
            target_id: str(scope.target_id),
          },
          publication,
          observation,
        });
    }
  return result;
}
export function liveMaterials(snapshot: LiveSnapshot): Material[] {
  return publishedDocuments(snapshot).map((f) => {
    const format = f.path.split(".").at(-1)?.toUpperCase() ?? "File",
      at = str(f.publication.confirmed_at, ""),
      author = str(f.publication.author_principal_id);
    return {
      id: `${f.workspace}:${f.revision}:${f.path}`,
      title: f.path.split("/").at(-1) ?? f.path,
      purpose: `Workspace ${f.workspace.slice(0, 8)}`,
      format,
      kind: ["JSON", "CSV"].includes(format) ? "data" : "reports",
      author: `Member ${author.slice(0, 8)}`,
      authorId: author,
      role: "Publisher",
      work: f.scope.work_id,
      workLabel: str(
        rows(snapshot.work.items).find((w) => w.id === f.scope.work_id)
          ?.purpose,
      ),
      revision: f.revision,
      path: f.path,
      time: at
        ? new Date(at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Not observed",
      date: at ? new Date(at).toLocaleDateString("en-GB") : "Not observed",
      workspace: f.workspace,
      delegationId: f.scope.delegation_id,
      targetId: f.scope.target_id,
    };
  });
}

/** Resolve one publication's immutable files, never substitute the latest manifest. */
export async function publicationDocuments(
  snapshot: LiveSnapshot,
  intentId: string,
  workId?: string,
): Promise<PublishedDocument[]> {
  const result: PublishedDocument[] = [];
  let unavailable = false;
  for (const o of snapshot.observations) {
    if (workId && o.work_id !== workId) continue;
    for (const workspace of rows(record(o.workspaces).items)) {
      const scope = record(workspace.read_scope);
      if (typeof workspace.workspace_id !== "string") continue;
      try {
        const detail = record(
          await invoke("catalog_publication", {
            workspaceId: workspace.workspace_id,
            intentId,
            scope: {
              work_id: scope.work_id,
              delegation_id: scope.delegation_id,
              target_id: scope.target_id,
              expected_environment_id: snapshot.environment_id,
              connection_generation: snapshot.connection_generation,
            },
          }),
        );
        const observation = record(detail.publication_observation),
          publication = record(observation.confirmed_publication);
        if (
          publication.intent_id !== intentId ||
          publication.retirement_state === "confirmed"
        )
          continue;
        for (const file of rows(publication.files)) {
          if (
            file.workspace_id !== workspace.workspace_id ||
            file.revision !== publication.revision
          )
            throw new Error("Publication reference mismatch.");
          result.push({
            workspace: str(file.workspace_id),
            revision: Number(file.revision),
            path: str(file.path),
            scope: {
              work_id: str(scope.work_id),
              delegation_id: str(scope.delegation_id),
              target_id: str(scope.target_id),
            },
            publication,
            observation,
          });
        }
      } catch {
        unavailable = true;
      }
    }
  }
  if (!result.length && unavailable)
    throw new Error("The original publication is currently unavailable.");
  return result;
}
