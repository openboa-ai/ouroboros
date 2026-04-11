import type {
  BlobDetailState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportComparisonState,
  ImportDetailState,
  OperationDetailState,
  WorkspaceDocumentState,
  WorkspaceSearchResultState
} from "../service-contract";
import {
  buildDocumentBacklinks,
  buildExportBundle,
  compareWorkspaceRefs
} from "./builders";
import { MockWorkspaceContext } from "./context";
import {
  checkpointPath,
  collectionEntryPath,
  CURRENT_WORKSPACE_FILE_REFS,
  exportBundlePath,
  operationPath,
  WORKSPACE_ROOT
} from "./paths";

export async function getCheckpointDetail(
  context: MockWorkspaceContext,
  checkpointId: string
): Promise<CheckpointDetailState> {
  const checkpoint =
    context.state.checkpoints.find((item) => item.id === checkpointId) ?? context.state.checkpoints[0];

  return {
    id: checkpoint.id,
    alias: checkpoint.alias,
    type: checkpoint.type,
    typeTone: checkpoint.typeTone,
    summary: checkpoint.summary,
    createdAt: checkpoint.createdAt,
    performance: checkpoint.performance,
    checkpointRef: checkpoint.pathRef,
    snapshotWorkspaceRef: `${WORKSPACE_ROOT}/checkpoints/items/${checkpoint.id}/workspace`,
    workspaceFileRefs: CURRENT_WORKSPACE_FILE_REFS.map((pathRef) =>
      pathRef.replace(WORKSPACE_ROOT, `${WORKSPACE_ROOT}/checkpoints/items/${checkpoint.id}/workspace`)
    ),
    exportBundle:
      checkpoint.type === "export" && checkpoint.exportBundleRef
        ? buildExportBundle(context.store, checkpoint)
        : null
  };
}

export async function getCheckpointComparison(
  context: MockWorkspaceContext,
  baseCheckpointId: string,
  targetCheckpointId: string
): Promise<CheckpointComparisonState> {
  const base = await getCheckpointDetail(context, baseCheckpointId);
  const target = await getCheckpointDetail(context, targetCheckpointId);
  const baseFiles = new Set(base.workspaceFileRefs);
  const targetFiles = new Set(target.workspaceFileRefs);
  const fileKeys = new Set<string>([...baseFiles, ...targetFiles]);
  const files: CheckpointComparisonState["files"] = [];
  let changedCount = 0;
  let addedCount = 0;
  let removedCount = 0;

  for (const fullRef of fileKeys) {
    const baseHas = baseFiles.has(fullRef);
    const targetHas = targetFiles.has(fullRef);
    const relativePath = fullRef
      .replace(`${base.snapshotWorkspaceRef}/`, "")
      .replace(`${target.snapshotWorkspaceRef}/`, "");

    let status: "added" | "removed" | "changed" | null = null;
    if (baseHas && targetHas) {
      const baseContent = context.resolveDocumentContent(fullRef);
      const targetRef = fullRef.replace(base.snapshotWorkspaceRef, target.snapshotWorkspaceRef);
      const targetContent = context.resolveDocumentContent(targetRef);
      if (baseContent !== targetContent) {
        status = "changed";
        changedCount += 1;
        files.push({ relativePath, status, baseRef: fullRef, targetRef });
      }
      continue;
    }
    if (baseHas) {
      status = "removed";
      removedCount += 1;
    } else if (targetHas) {
      status = "added";
      addedCount += 1;
    }

    if (status) {
      files.push({
        relativePath,
        status,
        baseRef: baseHas ? fullRef : undefined,
        targetRef: targetHas ? fullRef : undefined
      });
    }
  }

  return {
    baseCheckpointId: base.id,
    baseAlias: base.alias,
    targetCheckpointId: target.id,
    targetAlias: target.alias,
    comparedFileCount: files.length,
    changedCount,
    addedCount,
    removedCount,
    summary: `${changedCount} changed, ${addedCount} added, ${removedCount} removed between ${base.alias} and ${target.alias}.`,
    files
  };
}

export async function getCollectionDetail(
  context: MockWorkspaceContext,
  collectionId: string
): Promise<CollectionDetailState> {
  const collection =
    context.store.collectionsState.items.find((item) => item.collection_id === collectionId) ??
    context.store.collectionsState.items[0];
  const entries = context.store.entriesByCollection[collection.collection_id] ?? [];

  return {
    id: collection.collection_id,
    kind: collection.kind,
    sourceRef: collection.source_ref,
    timeBucket: collection.time_bucket,
    timeRangeLabel: `${collection.time_range.start} -> ${collection.time_range.end}`,
    entryCount: collection.entry_count ?? 0,
    contentHash: collection.content_hash,
    collectionRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`,
    entryShardRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`,
    notes:
      collection.source_ref === "binance-usdm:aggtrade:BTCUSDT"
        ? "Agg trades stay raw and source-centered. Market interpretation belongs in evaluation and session logs."
        : "Macro text is stored source-first. Symbol linkage and impact are deferred to agent logs.",
    entries: entries.map((entry) => ({
      id: entry.entry_id,
      sourceRef: entry.source_ref,
      eventTime: entry.event_time,
      ingestedAt: entry.ingested_at,
      contentHash: entry.content_hash,
      preview: entry.preview,
      entryPathRef: collectionEntryPath(collection.collection_id, entry.entry_id),
      blobRef: entry.blob_ref,
      blobPathRef: entry.blob_ref
        ? `${WORKSPACE_ROOT}/blobs/${entry.blob_ref.replace(":", "/")}.txt`
        : undefined
    }))
  };
}

export async function getImportDetail(
  context: MockWorkspaceContext,
  importId: string
): Promise<ImportDetailState> {
  const record = context.store.importsState.items.find((item) => item.import_id === importId);
  if (!record) {
    throw new Error(`unknown import: ${importId}`);
  }

  const workspaceRef = `${WORKSPACE_ROOT}/imports/items/${record.import_id}/workspace`;
  return {
    id: record.import_id,
    importedAt: record.imported_at,
    sourceBundleRef: record.source_bundle_ref,
    importRef: `${WORKSPACE_ROOT}/imports/items/${record.import_id}/import.json`,
    workspaceRef,
    checkpointRef: record.checkpoint_ref,
    policyId: record.policy_id,
    sanitized: record.sanitized,
    bundleRef: `${WORKSPACE_ROOT}/imports/items/${record.import_id}/bundle/export.json`,
    workspaceFileRefs: CURRENT_WORKSPACE_FILE_REFS.map((pathRef) =>
      pathRef.replace(WORKSPACE_ROOT, workspaceRef)
    ),
    preflight: context.buildImportPreflight(record)
  };
}

export async function getImportComparison(
  context: MockWorkspaceContext,
  importId: string
): Promise<ImportComparisonState> {
  const detail = await getImportDetail(context, importId);
  const files = compareWorkspaceRefs(
    CURRENT_WORKSPACE_FILE_REFS,
    detail.workspaceFileRefs,
    WORKSPACE_ROOT,
    detail.workspaceRef
  );
  const addedCount = files.filter((file) => file.status === "added").length;
  const removedCount = files.filter((file) => file.status === "removed").length;

  return {
    importId: detail.id,
    sourceBundleRef: detail.sourceBundleRef,
    comparedFileCount: files.length,
    changedCount: 0,
    addedCount,
    removedCount,
    summary: `${0} changed, ${addedCount} added, ${removedCount} removed between the current workspace and import ${detail.id}.`,
    files
  };
}

export async function getBlobDetail(
  context: MockWorkspaceContext,
  blobId: string
): Promise<BlobDetailState> {
  const contentText =
    context.store.blobContents[blobId] ?? "Blob content is unavailable in the mock service.";

  return {
    id: blobId,
    blobPathRef: `${WORKSPACE_ROOT}/blobs/${blobId.replace(":", "/")}.txt`,
    byteLength: new TextEncoder().encode(contentText).length,
    lineCount: contentText.split("\n").length,
    contentText
  };
}

export async function getOperationDetail(
  context: MockWorkspaceContext,
  operationId: string
): Promise<OperationDetailState> {
  const operation = context.store.operationsState.items.find((item) => item.operation_id === operationId);
  if (!operation) {
    throw new Error(`unknown operation: ${operationId}`);
  }

  const relatedRefs = (operation.related_refs ?? []).map((pathRef) =>
    pathRef.startsWith(WORKSPACE_ROOT) ? pathRef : `${WORKSPACE_ROOT}/${pathRef}`
  );
  const unresolvedRefs: string[] = [];
  const relatedDocuments = relatedRefs.map((pathRef) => {
    const document = context.state.documentCatalog.find((item) => item.pathRef === pathRef);
    if (document) {
      return {
        pathRef: document.pathRef,
        label: document.label,
        description: document.description,
        category: document.category,
        resolved: true
      };
    }

    unresolvedRefs.push(pathRef);
    return {
      pathRef,
      label: pathRef.split("/").pop() ?? pathRef,
      description:
        "Workspace reference captured by the service layer but not indexed in the current document catalog.",
      category: "reference",
      resolved: false
    };
  });

  return {
    id: operation.operation_id,
    kind: operation.kind,
    scope: operation.scope,
    status: operation.status,
    summary: operation.summary,
    details: operation.details,
    createdAt: operation.created_at,
    operationRef: operationPath(operation.operation_id),
    relatedRefs,
    relatedDocuments,
    unresolvedRefs
  };
}

export async function getWorkspaceDocument(
  context: MockWorkspaceContext,
  documentRef: string
): Promise<WorkspaceDocumentState> {
  const contentText = context.resolveDocumentContent(documentRef);
  const format = documentRef.endsWith(".ndjson")
    ? "ndjson"
    : documentRef.endsWith(".json")
      ? "json"
      : "text";

  return {
    pathRef: documentRef,
    format,
    byteLength: new TextEncoder().encode(contentText).length,
    lineCount: contentText.split("\n").length,
    contentText,
    backlinks: buildDocumentBacklinks(context.store, context.state, documentRef)
  };
}

export async function searchWorkspace(
  context: MockWorkspaceContext,
  query: string
): Promise<WorkspaceSearchResultState[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const results: WorkspaceSearchResultState[] = [];

  for (const document of context.state.documentCatalog) {
    const metadataHaystack = [
      document.label,
      document.description,
      document.pathRef,
      document.category
    ]
      .join(" ")
      .toLowerCase();
    if (metadataHaystack.includes(normalized)) {
      results.push({
        id: document.id,
        category: document.category,
        label: document.label,
        description: document.description,
        pathRef: document.pathRef,
        matchKind: "metadata"
      });
      continue;
    }

    const contentText = context.resolveDocumentContent(document.pathRef);
    const excerpt = contentText
      .split("\n")
      .find((line) => line.toLowerCase().includes(normalized))
      ?.trim()
      .slice(0, 180);
    if (!excerpt) {
      continue;
    }

    results.push({
      id: document.id,
      category: document.category,
      label: document.label,
      description: document.description,
      pathRef: document.pathRef,
      matchKind: "content",
      excerpt
    });
  }

  results.sort((left, right) => {
    const rank = (matchKind: "metadata" | "content") => (matchKind === "metadata" ? 2 : 1);
    return rank(right.matchKind) - rank(left.matchKind) || left.label.localeCompare(right.label);
  });

  return results.slice(0, 24);
}
