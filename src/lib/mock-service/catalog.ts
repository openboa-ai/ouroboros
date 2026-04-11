import type {
  CheckpointComparisonState,
  CollectionSummaryState,
  ImportComparisonState,
  ImportSummaryState,
  OperationSummaryState,
  WorkspaceCatalogEntry,
  WorkspaceDocumentState
} from "../service-contract";
import {
  collectionEntryPath,
  normalizeWorkspaceRef,
  operationPath,
  WORKSPACE_ROOT
} from "./paths";
import type {
  CollectionEntryRecord,
  MockWorkspaceStore
} from "./types";

function entryRecordsForCollection(
  store: MockWorkspaceStore,
  collectionId: string
): CollectionEntryRecord[] {
  return store.entriesByCollection[collectionId] ?? [];
}

export function buildCollections(store: MockWorkspaceStore): CollectionSummaryState[] {
  return store.collectionsState.items.map((item) => ({
    id: item.collection_id,
    kind: item.kind,
    sourceRef: item.source_ref,
    timeBucket: item.time_bucket,
    timeRangeLabel: `${item.time_range.start} -> ${item.time_range.end}`,
    entryCount: item.entry_count ?? 0,
    contentHash: item.content_hash,
    collectionRef: `${WORKSPACE_ROOT}/collections/items/${item.collection_id}/collection.json`
  }));
}

export function buildImports(store: MockWorkspaceStore): ImportSummaryState[] {
  return store.importsState.items.map((item) => ({
    id: item.import_id,
    importedAt: item.imported_at,
    sourceBundleRef: item.source_bundle_ref,
    importRef: `${WORKSPACE_ROOT}/imports/items/${item.import_id}/import.json`,
    workspaceRef: `${WORKSPACE_ROOT}/imports/items/${item.import_id}/workspace`,
    checkpointRef: item.checkpoint_ref,
    policyId: item.policy_id,
    sanitized: item.sanitized
  }));
}

export function buildOperations(store: MockWorkspaceStore): OperationSummaryState[] {
  return store.operationsState.items.map((item) => ({
    id: item.operation_id,
    kind: item.kind,
    scope: item.scope,
    status: item.status,
    summary: item.summary,
    details: item.details,
    createdAt: item.created_at,
    operationRef: operationPath(item.operation_id),
    relatedRefs: (item.related_refs ?? []).map(normalizeWorkspaceRef)
  }));
}

export function buildDocumentCatalog(
  store: MockWorkspaceStore,
  currentCheckpointRef: string,
  latestExportBundleRef?: string
): WorkspaceCatalogEntry[] {
  const items: WorkspaceCatalogEntry[] = [
    {
      id: "strategy",
      category: "entrypoint",
      label: "strategy.json",
      description: "Canonical workspace entrypoint for the live-centered asset.",
      pathRef: `${WORKSPACE_ROOT}/strategy.json`
    },
    {
      id: "live-lane",
      category: "active",
      label: "live lane",
      description: "Active live lane refs, state pointers, and runtime mode.",
      pathRef: `${WORKSPACE_ROOT}/live/live-lane.json`
    },
    {
      id: "live-dashboard",
      category: "active",
      label: "dashboard state",
      description: "Current dashboard-facing live state surfaced through the service boundary.",
      pathRef: `${WORKSPACE_ROOT}/state/dashboard.json`
    },
    {
      id: "live-decisions",
      category: "active",
      label: "decision log",
      description: "Recent live trading decisions and interventions that remain part of the exportable context.",
      pathRef: `${WORKSPACE_ROOT}/state/decisions.json`
    },
    {
      id: "live-memory",
      category: "active",
      label: "working memory",
      description: "Live working-memory notes currently shaping trading behavior.",
      pathRef: `${WORKSPACE_ROOT}/state/live-memory.json`
    },
    {
      id: "live-positions",
      category: "active",
      label: "positions state",
      description: "Current live positions plus event history for replay and audit.",
      pathRef: `${WORKSPACE_ROOT}/state/positions.json`
    },
    {
      id: "live-orders",
      category: "active",
      label: "orders state",
      description: "Current live orders plus event history for replay and audit.",
      pathRef: `${WORKSPACE_ROOT}/state/orders.json`
    },
    {
      id: "current-checkpoint",
      category: "checkpoint",
      label: "current checkpoint",
      description: "The authoritative checkpoint anchor for the current live-centered asset.",
      pathRef: currentCheckpointRef
    },
    {
      id: "export-policy",
      category: "export",
      label: "export policy",
      description: "Sanitization policy that governs export bundle generation.",
      pathRef: `${WORKSPACE_ROOT}/exports/policy.json`
    },
    {
      id: "checkpoints-index",
      category: "index",
      label: "checkpoint index",
      description: "Promotion, export, and incident history catalog.",
      pathRef: `${WORKSPACE_ROOT}/checkpoints/index.json`
    },
    {
      id: "collections-index",
      category: "index",
      label: "collections index",
      description: "Source-centered collection catalog materialized by UTC-hour shards.",
      pathRef: `${WORKSPACE_ROOT}/indexes/collections.json`
    },
    {
      id: "imports-index",
      category: "index",
      label: "imports index",
      description: "Sanitized import staging catalog kept inside the workspace asset.",
      pathRef: `${WORKSPACE_ROOT}/imports/index.json`
    },
    {
      id: "operations-index",
      category: "index",
      label: "operations index",
      description: "Durable workspace-wide service operation registry.",
      pathRef: `${WORKSPACE_ROOT}/operations/index.json`
    },
    {
      id: "sessions-index",
      category: "index",
      label: "sessions index",
      description: "Durable session references that shape current live context.",
      pathRef: `${WORKSPACE_ROOT}/indexes/sessions.json`
    },
    {
      id: "eval-summaries-index",
      category: "index",
      label: "eval summaries",
      description: "Inspectable evaluation summaries that still link back to raw evidence refs.",
      pathRef: `${WORKSPACE_ROOT}/state/eval-summaries.json`
    }
  ];

  items.push(
    ...store.sessionsState.sessions.map((session) => ({
      id: `session-${session.session_id}`,
      category: "session" as const,
      label: session.label,
      description: `Live session document (${session.status}) that remains part of the exportable trading context.`,
      pathRef: `${WORKSPACE_ROOT}/sessions/items/${session.session_id}/session.json`
    }))
  );

  items.push(
    ...store.evalSummariesState.summaries.map((summary) => ({
      id: `evaluation-${summary.summary_id}`,
      category: "evaluation" as const,
      label: summary.headline,
      description: "Live-lane evaluation evidence summary with refs back to raw supporting artifacts.",
      pathRef: `${WORKSPACE_ROOT}/eval-summaries/items/${summary.summary_id}/summary.json`
    }))
  );

  items.push(
    ...store.operationsState.items.map((operation) => ({
      id: `operation-${operation.operation_id}`,
      category: "operation" as const,
      label: `${operation.kind} · ${operation.created_at}`,
      description: operation.summary,
      pathRef: operationPath(operation.operation_id)
    }))
  );

  items.push(
    ...store.collectionsState.items.flatMap((collection) => [
      {
        id: `collection-${collection.collection_id}`,
        category: "collection" as const,
        label: `${collection.source_ref} · ${collection.time_bucket}`,
        description: `${collection.kind} collection with ${collection.entry_count ?? 0} entries.`,
        pathRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`
      },
      {
        id: `collection-entries-${collection.collection_id}`,
        category: "collection" as const,
        label: `${collection.source_ref} entry shard`,
        description: "Append-friendly NDJSON shard backing this source collection.",
        pathRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`
      }
    ])
  );

  items.push(
    ...store.collectionsState.items.flatMap((collection) =>
      entryRecordsForCollection(store, collection.collection_id).map((entry) => ({
        id: `entry-${entry.entry_id}`,
        category: "entry" as const,
        label: `${collection.source_ref} entry ${entry.event_time}`,
        description:
          entry.preview ?? "Source entry materialized as a first-class workspace document.",
        pathRef: collectionEntryPath(collection.collection_id, entry.entry_id)
      }))
    )
  );

  const blobEntries = new Map<string, WorkspaceCatalogEntry>();
  for (const collection of store.collectionsState.items) {
    for (const entry of entryRecordsForCollection(store, collection.collection_id)) {
      if (!entry.blob_ref || blobEntries.has(entry.blob_ref)) {
        continue;
      }

      blobEntries.set(entry.blob_ref, {
        id: `blob-${entry.blob_ref.replace(":", "-")}`,
        category: "blob",
        label: `${collection.source_ref} body ${entry.blob_ref.split(":")[1]?.slice(0, 12) ?? entry.blob_ref}`,
        description: entry.preview ?? "Immutable source body referenced by collection entries.",
        pathRef: `${WORKSPACE_ROOT}/blobs/${entry.blob_ref.replace(":", "/")}.txt`
      });
    }
  }
  items.push(...blobEntries.values());

  items.push(
    ...store.importsState.items.flatMap((item) => [
      {
        id: `import-${item.import_id}`,
        category: "import" as const,
        label: `import ${item.imported_at}`,
        description: `Sanitized import staged from bundle ${item.source_bundle_ref}.`,
        pathRef: `${WORKSPACE_ROOT}/imports/items/${item.import_id}/import.json`
      },
      {
        id: `import-bundle-${item.import_id}`,
        category: "import" as const,
        label: `import bundle ${item.import_id}`,
        description: "Copied sanitized export manifest staged alongside the imported workspace.",
        pathRef: `${WORKSPACE_ROOT}/imports/items/${item.import_id}/bundle/export.json`
      }
    ])
  );

  if (latestExportBundleRef) {
    items.push({
      id: "latest-export-bundle",
      category: "export",
      label: "latest export bundle",
      description: "Most recent sanitized export created from the live-centered workspace asset.",
      pathRef: latestExportBundleRef
    });
  }

  return items;
}

export function buildDocumentBacklinks(
  store: MockWorkspaceStore,
  state: {
    assetInspector: { strategyRef: string; liveLaneRef: string; currentCheckpointRef: string; exportPolicyRef: string };
    liveContext: {
      dashboardRef: string;
      decisionsRef: string;
      memoryRef: string;
      positionsRef: string;
      ordersRef: string;
      sessions: Array<{ pathRef: string }>;
      evaluationSummaries: Array<{ pathRef: string }>;
    };
    workspaceIndex: {
      indexes: {
        checkpointsRef: string;
        collectionsRef: string;
        importsRef: string;
        operationsRef: string;
        sessionsRef: string;
      };
    };
    operations: Array<{
      kind: string;
      createdAt: string;
      operationRef: string;
      relatedRefs: string[];
    }>;
    documentCatalog: WorkspaceCatalogEntry[];
    exportInspector: {
      latestBundle: {
        checkpointRef: string;
        bundleRef: string;
        includedRefs: string[];
      } | null;
    };
  },
  documentRef: string
): WorkspaceDocumentState["backlinks"] {
  const backlinks: WorkspaceDocumentState["backlinks"] = [];
  const seen = new Set<string>();

  const pushBacklink = (
    label: string,
    pathRef: string,
    category: WorkspaceDocumentState["backlinks"][number]["category"],
    reason: string
  ) => {
    const key = `${pathRef}|${reason}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    backlinks.push({ label, pathRef, category, reason });
  };

  if (state.assetInspector.liveLaneRef === documentRef) {
    pushBacklink("strategy.json", state.assetInspector.strategyRef, "entrypoint", "active.live_lane_ref");
  }

  const activeStateRefs = [
    [state.liveContext.dashboardRef, "state_refs.dashboard_ref"],
    [state.liveContext.decisionsRef, "state_refs.decisions_ref"],
    [state.liveContext.memoryRef, "state_refs.memory_ref"],
    [state.liveContext.positionsRef, "state_refs.positions_ref"],
    [state.liveContext.ordersRef, "state_refs.orders_ref"]
  ] as const;
  for (const [pathRef, reason] of activeStateRefs) {
    if (pathRef === documentRef) {
      pushBacklink("live lane", state.assetInspector.liveLaneRef, "active", reason);
    }
  }

  if (state.assetInspector.currentCheckpointRef === documentRef) {
    pushBacklink(
      "strategy.json",
      state.assetInspector.strategyRef,
      "entrypoint",
      "active.current_checkpoint_ref"
    );
  }
  if (state.assetInspector.exportPolicyRef === documentRef) {
    pushBacklink(
      "strategy.json",
      state.assetInspector.strategyRef,
      "entrypoint",
      "active.export_policy_ref"
    );
  }

  const indexRefs = [
    [state.workspaceIndex.indexes.checkpointsRef, "indexes.checkpoints_ref"],
    [state.workspaceIndex.indexes.collectionsRef, "indexes.collections_ref"],
    [state.workspaceIndex.indexes.importsRef, "indexes.imports_ref"],
    [state.workspaceIndex.indexes.operationsRef, "indexes.operations_ref"],
    [state.workspaceIndex.indexes.sessionsRef, "indexes.sessions_ref"]
  ] as const;
  for (const [pathRef, reason] of indexRefs) {
    if (pathRef === documentRef) {
      pushBacklink("strategy.json", state.assetInspector.strategyRef, "entrypoint", reason);
    }
  }

  if (state.liveContext.sessions.some((session) => session.pathRef === documentRef)) {
    pushBacklink(
      "sessions index",
      state.workspaceIndex.indexes.sessionsRef,
      "index",
      "session catalog entry"
    );
  }

  if (state.liveContext.evaluationSummaries.some((summary) => summary.pathRef === documentRef)) {
    pushBacklink(
      "eval summaries",
      `${WORKSPACE_ROOT}/state/eval-summaries.json`,
      "index",
      "evaluation summary entry"
    );
  }

  for (const operation of state.operations) {
    if (operation.operationRef === documentRef) {
      pushBacklink(
        "operations index",
        state.workspaceIndex.indexes.operationsRef,
        "index",
        "operation catalog entry"
      );
    }
    if (operation.relatedRefs.includes(documentRef)) {
      pushBacklink(
        `${operation.kind} · ${operation.createdAt}`,
        operation.operationRef,
        "operation",
        "operation related ref"
      );
    }
  }

  for (const document of state.documentCatalog) {
    if (document.pathRef !== documentRef) {
      continue;
    }

    if (document.id.startsWith("collection-") || document.category === "entry") {
      pushBacklink(
        "collections index",
        state.workspaceIndex.indexes.collectionsRef,
        "index",
        document.id.startsWith("collection-entries-")
          ? "collection entry shard"
          : document.category === "entry"
            ? "collection entry document"
            : "collection catalog entry"
      );
    }

    if (document.category === "entry") {
      for (const collection of store.collectionsState.items) {
        const entryShardRef = `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`;
        const linkedEntry = entryRecordsForCollection(store, collection.collection_id).find(
          (entry) => collectionEntryPath(collection.collection_id, entry.entry_id) === documentRef
        );
        if (!linkedEntry) {
          continue;
        }

        pushBacklink(
          `${collection.source_ref} · ${collection.time_bucket}`,
          `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`,
          "collection",
          "collection manifest owns entry document"
        );
        pushBacklink(
          `${collection.source_ref} entry shard`,
          entryShardRef,
          "collection",
          "entry shard materializes entry document"
        );
      }
    }

    if (document.category === "blob") {
      for (const collection of store.collectionsState.items) {
        const collectionRef = `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`;
        const entryShardRef = `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`;
        for (const entry of entryRecordsForCollection(store, collection.collection_id)) {
          if (
            !entry.blob_ref ||
            `${WORKSPACE_ROOT}/blobs/${entry.blob_ref.replace(":", "/")}.txt` !== documentRef
          ) {
            continue;
          }

          pushBacklink(
            `${collection.source_ref} · ${collection.time_bucket}`,
            collectionRef,
            "collection",
            "collection manifest references blob"
          );
          pushBacklink(
            `${collection.source_ref} entry shard`,
            entryShardRef,
            "collection",
            "entry shard references blob"
          );
          pushBacklink(
            `${collection.source_ref} entry ${entry.event_time}`,
            collectionEntryPath(collection.collection_id, entry.entry_id),
            "entry",
            "entry document references blob"
          );
        }
      }
    }

    if (document.id.startsWith("import-")) {
      pushBacklink(
        "imports index",
        state.workspaceIndex.indexes.importsRef,
        "index",
        document.id.startsWith("import-bundle-") ? "staged import bundle" : "import catalog entry"
      );
    }
  }

  const latestBundle = state.exportInspector.latestBundle;
  if (latestBundle?.bundleRef === documentRef) {
    pushBacklink("latest export checkpoint", latestBundle.checkpointRef, "checkpoint", "latest export bundle");
  }
  if (latestBundle?.includedRefs.includes(documentRef)) {
    pushBacklink("latest export bundle", latestBundle.bundleRef, "export", "sanitized export includes ref");
  }

  return backlinks;
}

export function compareWorkspaceRefs(
  baseRefs: string[],
  targetRefs: string[],
  baseRoot: string,
  targetRoot: string
): ImportComparisonState["files"] | CheckpointComparisonState["files"] {
  const toRelativeMap = (refs: string[], root: string) =>
    new Map(
      refs.map((pathRef) => [
        pathRef.startsWith(`${root}/`) ? pathRef.slice(root.length + 1) : pathRef,
        pathRef
      ])
    );

  const base = toRelativeMap(baseRefs, baseRoot);
  const target = toRelativeMap(targetRefs, targetRoot);
  const keys = Array.from(new Set([...base.keys(), ...target.keys()])).sort();

  return keys.flatMap((relativePath) => {
    const baseRef = base.get(relativePath);
    const targetRef = target.get(relativePath);
    if (baseRef && targetRef) {
      return [];
    }

    return [
      {
        relativePath,
        status: baseRef ? "removed" : "added",
        baseRef,
        targetRef
      }
    ];
  });
}
