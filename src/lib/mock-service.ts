import type {
  AssetInspectorState,
  BlobDetailState,
  BootstrapState,
  CheckpointComparisonState,
  CollectionDetailState,
  CollectionSummaryState,
  CheckpointDetailState,
  CheckpointSummary,
  DecisionEntry,
  ExportBundleState,
  ExportInspectorState,
  ImportBundleState,
  ImportDetailState,
  ImportSummaryState,
  IngestSourceEntryInput,
  IngestSourceEntryResult,
  LaneEventState,
  LiveContextState,
  OperationSummaryState,
  WorkspaceCatalogEntry,
  WorkspaceDocumentState,
  WorkspaceIndexState,
  WorkspaceService
} from "./service-contract";
import type { LiveLaneState, StrategyManifest } from "./workspace-contract";
import checkpointIndexTemplate from "../../templates/strategy-workspace/checkpoints/index.json";
import exportPolicyTemplate from "../../templates/strategy-workspace/exports/policy.json";
import collectionsTemplate from "../../templates/strategy-workspace/indexes/collections.json";
import importsTemplate from "../../templates/strategy-workspace/imports/index.json";
import operationsTemplate from "../../templates/strategy-workspace/operations/index.json";
import btcAggEntriesRaw from "../../templates/strategy-workspace/collections/items/019626b0-4d0a-7a72-9b4e-9d8e11d0f901/entries.ndjson?raw";
import macroNewsEntriesRaw from "../../templates/strategy-workspace/collections/items/019626b6-c73a-7fe6-b0a5-64ac631d5102/entries.ndjson?raw";
import btcAggBlobOneRaw from "../../templates/strategy-workspace/blobs/sha256/cd36e47d463d9e2efe3e2030670ca7694a9f303a8837cad4e4e5135c427f945f.txt?raw";
import btcAggBlobTwoRaw from "../../templates/strategy-workspace/blobs/sha256/aef3c2aa9075dc26b7484d71d06d10c152f5310cd34d5eb2b3b3b6fa915e4b3c.txt?raw";
import btcAggBlobThreeRaw from "../../templates/strategy-workspace/blobs/sha256/7bbdd0eec8d01854af7185348af542fb665987debe396f2ce2e88f4e35f8af0e.txt?raw";
import macroNewsBlobOneRaw from "../../templates/strategy-workspace/blobs/sha256/2b0f06db4a1f0530763ad7aa5a10bc2e47017dcaf4f79f8fa0e6a5819d57081f.txt?raw";
import macroNewsBlobTwoRaw from "../../templates/strategy-workspace/blobs/sha256/e2d312f2f5767f7334ba8d3fa90fc2c9d66b2d05d4c77db8bc8d289d5fc5f7ec.txt?raw";
import liveLaneTemplate from "../../templates/strategy-workspace/live/live-lane.json";
import strategyTemplate from "../../templates/strategy-workspace/strategy.json";
import dashboardTemplate from "../../templates/strategy-workspace/state/dashboard.json";
import decisionsTemplate from "../../templates/strategy-workspace/state/decisions.json";
import evalSummariesTemplate from "../../templates/strategy-workspace/state/eval-summaries.json";
import liveMemoryTemplate from "../../templates/strategy-workspace/state/live-memory.json";
import ordersTemplate from "../../templates/strategy-workspace/state/orders.json";
import positionsTemplate from "../../templates/strategy-workspace/state/positions.json";
import sessionsTemplate from "../../templates/strategy-workspace/indexes/sessions.json";

export const mockStrategyManifest = strategyTemplate as StrategyManifest;
const liveLane = liveLaneTemplate as LiveLaneState;

const checkpointIndex = checkpointIndexTemplate as {
  current: {
    checkpoint_id: string;
    alias: string;
    type: "promotion" | "export" | "incident";
  };
  items: Array<{
    checkpoint_id: string;
    alias: string;
    type: "promotion" | "export" | "incident";
    type_tone?: "positive" | "warning" | "danger";
    summary?: string;
    created_at?: string;
    performance?: string;
    path_ref?: string;
  }>;
};

const exportPolicy = exportPolicyTemplate as {
  policy_id: string;
  description: string;
};

const collectionsState = collectionsTemplate as {
  items: Array<{
    collection_id: string;
    kind: "raw" | "canonical";
    source_ref: string;
    time_bucket: string;
    time_range: { start: string; end: string };
    entry_count: number;
    content_hash: string;
    path_ref: string;
  }>;
};

const importsState = structuredClone(
  importsTemplate as {
    items: Array<{
      import_id: string;
      imported_at: string;
      source_bundle_ref: string;
      bundle_ref: string;
      workspace_ref: string;
      checkpoint_ref: string;
      policy_id: string;
      sanitized: boolean;
    }>;
  }
);

const operationsState = structuredClone(
  operationsTemplate as {
    items: Array<{
      operation_id: string;
      kind: string;
      scope: "live" | "workspace";
      status: "succeeded";
      summary: string;
      details: string;
      created_at: string;
      related_refs?: string[];
    }>;
  }
);

const dashboardState = dashboardTemplate as Omit<
  BootstrapState,
  "workspace" | "positions" | "orders" | "decisions" | "checkpoints" | "imports" | "operations"
>;

const decisionsState = decisionsTemplate as {
  decisions: DecisionEntry[];
};

const ordersState = ordersTemplate as {
  current: BootstrapState["orders"];
  events: LaneEventRecord[];
};

const positionsState = positionsTemplate as {
  current: BootstrapState["positions"];
  events: LaneEventRecord[];
};

const liveMemoryState = liveMemoryTemplate as {
  notes: Array<{ summary: string }>;
};

const sessionsState = sessionsTemplate as {
  sessions: Array<{
    session_id: string;
    label: string;
    started_at: string;
    status: string;
    path_ref: string;
  }>;
};

const evalSummariesState = evalSummariesTemplate as {
  summaries: Array<{
    summary_id: string;
    headline: string;
    created_at: string;
    path_ref: string;
    evidence_refs?: string[];
  }>;
};

const WORKSPACE_ROOT = "var/dev-workspace";
const DEFAULT_EXCLUDED_PATHS = [
  "./workspace/checkpoints",
  "./workspace/exports/generated",
  "./workspace/secrets",
  "./workspace/credentials"
];

type CollectionEntryRecord = {
  entry_id: string;
  source_ref: string;
  event_time: string;
  ingested_at: string;
  content_hash: string;
  blob_ref?: string;
  preview?: string;
};

type LaneEventRecord = {
  event_id: string;
  timestamp: string;
  kind: string;
  summary: string;
};

const entriesByCollection: Record<string, CollectionEntryRecord[]> = {
  "019626b0-4d0a-7a72-9b4e-9d8e11d0f901": parseEntries(btcAggEntriesRaw),
  "019626b6-c73a-7fe6-b0a5-64ac631d5102": parseEntries(macroNewsEntriesRaw)
};

const blobContents: Record<string, string> = {
  "sha256:cd36e47d463d9e2efe3e2030670ca7694a9f303a8837cad4e4e5135c427f945f": btcAggBlobOneRaw,
  "sha256:aef3c2aa9075dc26b7484d71d06d10c152f5310cd34d5eb2b3b3b6fa915e4b3c": btcAggBlobTwoRaw,
  "sha256:7bbdd0eec8d01854af7185348af542fb665987debe396f2ce2e88f4e35f8af0e": btcAggBlobThreeRaw,
  "sha256:2b0f06db4a1f0530763ad7aa5a10bc2e47017dcaf4f79f8fa0e6a5819d57081f": macroNewsBlobOneRaw,
  "sha256:e2d312f2f5767f7334ba8d3fa90fc2c9d66b2d05d4c77db8bc8d289d5fc5f7ec": macroNewsBlobTwoRaw
};
const DEFAULT_INCLUDED_REFS = [
  "./workspace/strategy.json",
  "./workspace/live/live-lane.json",
  "./workspace/state/dashboard.json",
  "./workspace/state/decisions.json",
  "./workspace/state/live-memory.json",
  "./workspace/state/orders.json",
  "./workspace/state/positions.json",
  "./workspace/state/eval-summaries.json",
  "./workspace/indexes/sessions.json",
  "./workspace/sessions/items/01962740-2f14-7f37-a9a5-1d3c5d9f1a01/session.json",
  "./workspace/eval-summaries/items/0196274f-40c8-73be-9f42-f5cf61951b44/summary.json"
];

function buildLaneEvents(): LaneEventState[] {
  return [
    ...positionsState.events.map((event) => ({
      id: event.event_id,
      scope: "positions" as const,
      kind: event.kind,
      summary: event.summary,
      timestamp: event.timestamp
    })),
    ...ordersState.events.map((event) => ({
      id: event.event_id,
      scope: "orders" as const,
      kind: event.kind,
      summary: event.summary,
      timestamp: event.timestamp
    }))
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

function checkpointPath(checkpointId: string) {
  return `${WORKSPACE_ROOT}/checkpoints/items/${checkpointId}/checkpoint.json`;
}

function exportBundlePath(checkpointId: string) {
  return `${WORKSPACE_ROOT}/exports/generated/${checkpointId}/export.json`;
}

function operationPath(operationId: string) {
  return `${WORKSPACE_ROOT}/operations/items/${operationId}/operation.json`;
}

function buildAssetInspector(
  checkpoints: CheckpointSummary[],
  currentCheckpointRef: string
): AssetInspectorState {
  const latestExport = checkpoints.find(
    (checkpoint) => checkpoint.type === "export" && checkpoint.exportBundleRef
  );

  return {
    workspaceRoot: WORKSPACE_ROOT,
    strategyRef: `${WORKSPACE_ROOT}/strategy.json`,
    liveLaneRef: `${WORKSPACE_ROOT}/live/live-lane.json`,
    currentCheckpointRef,
    exportPolicyRef: `${WORKSPACE_ROOT}/exports/policy.json`,
    latestExportBundleRef: latestExport?.exportBundleRef,
    checkpointCount: checkpoints.length,
    exportCount: checkpoints.filter((checkpoint) => checkpoint.type === "export").length
  };
}

function buildWorkspaceIndex(currentCheckpointRef: string): WorkspaceIndexState {
  return {
    schemaVersion: mockStrategyManifest.schema_version,
    active: {
      liveLaneRef: `${WORKSPACE_ROOT}/live/live-lane.json`,
      currentCheckpointRef,
      exportPolicyRef: `${WORKSPACE_ROOT}/exports/policy.json`
    },
    indexes: {
      checkpointsRef: `${WORKSPACE_ROOT}/checkpoints/index.json`,
      collectionsRef: `${WORKSPACE_ROOT}/indexes/collections.json`,
      importsRef: `${WORKSPACE_ROOT}/imports/index.json`,
      operationsRef: `${WORKSPACE_ROOT}/operations/index.json`,
      sessionsRef: `${WORKSPACE_ROOT}/indexes/sessions.json`
    },
    collectionCount: collectionsState.items.length,
    operationCount: operationsState.items.length,
    sessionCount: sessionsState.sessions.length
  };
}

function buildCollections(): CollectionSummaryState[] {
  return collectionsState.items.map((item) => ({
    id: item.collection_id,
    kind: item.kind,
    sourceRef: item.source_ref,
    timeBucket: item.time_bucket,
    timeRangeLabel: `${item.time_range.start} -> ${item.time_range.end}`,
    entryCount: item.entry_count,
    contentHash: item.content_hash,
    collectionRef: `${WORKSPACE_ROOT}/collections/items/${item.collection_id}/collection.json`
  }));
}

function buildImports(): ImportSummaryState[] {
  return importsState.items.map((item) => ({
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

function buildOperations(): OperationSummaryState[] {
  return operationsState.items.map((item) => ({
    id: item.operation_id,
    kind: item.kind,
    scope: item.scope,
    status: item.status,
    summary: item.summary,
    details: item.details,
    createdAt: item.created_at,
    operationRef: operationPath(item.operation_id),
    relatedRefs: (item.related_refs ?? []).map((path) =>
      path.startsWith(WORKSPACE_ROOT) ? path : `${WORKSPACE_ROOT}/${path}`
    )
  }));
}

function buildLiveContext(): LiveContextState {
  return {
    memoryNotes: liveMemoryState.notes.map((note) => note.summary),
    sessions: sessionsState.sessions.map((session) => ({
      id: session.session_id,
      label: session.label,
      startedAt: session.started_at,
      status: session.status,
      pathRef: `${WORKSPACE_ROOT}/sessions/items/${session.session_id}/session.json`
    })),
    evaluationSummaries: evalSummariesState.summaries.map((summary) => ({
      id: summary.summary_id,
      headline: summary.headline,
      createdAt: summary.created_at,
      pathRef: `${WORKSPACE_ROOT}/eval-summaries/items/${summary.summary_id}/summary.json`,
      evidenceRefs: summary.evidence_refs ?? []
    })),
    positionEventCount: positionsState.events.length,
    orderEventCount: ordersState.events.length
  };
}

function buildExportBundle(checkpoint: CheckpointSummary): ExportBundleState {
  const workspaceRef = `${WORKSPACE_ROOT}/exports/generated/${checkpoint.id}/workspace`;
  return {
    exportId: checkpoint.id,
    createdAt: checkpoint.createdAt,
    policyId: exportPolicy.policy_id,
    checkpointRef: checkpoint.pathRef,
    workspaceRef,
    bundleRef: exportBundlePath(checkpoint.id),
    includedRefs: DEFAULT_INCLUDED_REFS.map((path) => path.replace("./workspace", workspaceRef)),
    excludedPaths: DEFAULT_EXCLUDED_PATHS,
    sanitized: true
  };
}

function buildExportInspector(checkpoints: CheckpointSummary[]): ExportInspectorState {
  const latestExport = checkpoints.find(
    (checkpoint) => checkpoint.type === "export" && checkpoint.exportBundleRef
  );

  return {
    policyId: exportPolicy.policy_id,
    description: exportPolicy.description,
    latestBundle: latestExport ? buildExportBundle(latestExport) : null
  };
}

function buildDocumentCatalog(
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
    ...sessionsState.sessions.map((session) => ({
      id: `session-${session.session_id}`,
      category: "session" as const,
      label: session.label,
      description: `Live session document (${session.status}) that remains part of the exportable trading context.`,
      pathRef: `${WORKSPACE_ROOT}/sessions/items/${session.session_id}/session.json`
    }))
  );

  items.push(
    ...evalSummariesState.summaries.map((summary) => ({
      id: `evaluation-${summary.summary_id}`,
      category: "evaluation" as const,
      label: summary.headline,
      description: "Live-lane evaluation evidence summary with refs back to raw supporting artifacts.",
      pathRef: `${WORKSPACE_ROOT}/eval-summaries/items/${summary.summary_id}/summary.json`
    }))
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

function toUtcHourBucket(eventTime: string) {
  return `${eventTime.slice(0, 13)}:00:00Z`;
}

function mockBlobIdFromText(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function buildTemplateBootstrapState(): BootstrapState {
  const checkpoints = checkpointIndex.items.map((item) => ({
    id: item.checkpoint_id,
    alias: item.alias,
    type: item.type,
    typeTone: item.type_tone ?? "warning",
    summary: item.summary ?? "Checkpoint captured.",
    createdAt: item.created_at ?? "UTC unknown",
    performance: item.performance ?? "No summary",
    pathRef: item.path_ref ? checkpointPath(item.checkpoint_id) : checkpointPath(item.checkpoint_id),
    exportBundleRef: undefined
  }));
  const currentCheckpointRef = checkpointPath(checkpointIndex.current.checkpoint_id);

  return {
    ...dashboardState,
    workspace: {
      artifactId: mockStrategyManifest.artifact_id,
      slug: mockStrategyManifest.slug,
      liveLaneLabel: liveLane.label,
      currentCheckpointAlias: checkpointIndex.current.alias,
      exportPolicyLabel: exportPolicy.policy_id
    },
    assetInspector: buildAssetInspector(checkpoints, currentCheckpointRef),
    workspaceIndex: buildWorkspaceIndex(currentCheckpointRef),
    liveContext: buildLiveContext(),
    exportInspector: buildExportInspector(checkpoints),
    positions: positionsState.current,
    orders: ordersState.current,
    laneEvents: buildLaneEvents(),
    decisions: decisionsState.decisions,
    checkpoints,
    collections: buildCollections(),
    imports: buildImports(),
    operations: buildOperations(),
    documentCatalog: buildDocumentCatalog(
      currentCheckpointRef,
      buildExportInspector(checkpoints).latestBundle?.bundleRef
    )
  };
}

const bootstrapState: BootstrapState = buildTemplateBootstrapState();

class MockWorkspaceService implements WorkspaceService {
  private state: BootstrapState = structuredClone(bootstrapState);

  async getBootstrapState(): Promise<BootstrapState> {
    return structuredClone(this.state);
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    const checkpoint =
      this.state.checkpoints.find((item) => item.id === checkpointId) ?? this.state.checkpoints[0];

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
      workspaceFileRefs: DEFAULT_INCLUDED_REFS.map((path) =>
        path.replace("./workspace", `${WORKSPACE_ROOT}/checkpoints/items/${checkpoint.id}/workspace`)
      ),
      exportBundle:
        checkpoint.type === "export" && checkpoint.exportBundleRef ? buildExportBundle(checkpoint) : null
    };
  }

  async getCheckpointComparison(
    baseCheckpointId: string,
    targetCheckpointId: string
  ): Promise<CheckpointComparisonState> {
    const base = await this.getCheckpointDetail(baseCheckpointId);
    const target = await this.getCheckpointDetail(targetCheckpointId);
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
        const baseContent = this.resolveDocumentContent(fullRef);
        const targetRef = fullRef.replace(base.snapshotWorkspaceRef, target.snapshotWorkspaceRef);
        const targetContent = this.resolveDocumentContent(targetRef);
        if (baseContent !== targetContent) {
          status = "changed";
          changedCount += 1;
          files.push({
            relativePath,
            status,
            baseRef: fullRef,
            targetRef
          });
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

  async getCollectionDetail(collectionId: string): Promise<CollectionDetailState> {
    const collection =
      collectionsState.items.find((item) => item.collection_id === collectionId) ??
      collectionsState.items[0];
    const entries =
      entriesByCollection[collection.collection_id as keyof typeof entriesByCollection] ?? [];

    return {
      id: collection.collection_id,
      kind: collection.kind,
      sourceRef: collection.source_ref,
      timeBucket: collection.time_bucket,
      timeRangeLabel: `${collection.time_range.start} -> ${collection.time_range.end}`,
      entryCount: collection.entry_count,
      contentHash: collection.content_hash,
      collectionRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`,
      entryShardRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`,
      notes:
        collection.source_ref === "binance-usdm:aggtrade:BTCUSDT"
          ? "Agg trades stay raw and source-centered. Market interpretation belongs in evaluation and session logs."
          : "Macro text is stored source-first. Symbol linkage and impact are deferred to agent logs.",
      entries: entries.map((entry: CollectionEntryRecord) => ({
        id: entry.entry_id,
        sourceRef: entry.source_ref,
        eventTime: entry.event_time,
        ingestedAt: entry.ingested_at,
        contentHash: entry.content_hash,
        preview: entry.preview,
        blobRef: entry.blob_ref,
        blobPathRef: entry.blob_ref
          ? `${WORKSPACE_ROOT}/blobs/${entry.blob_ref.replace(":", "/")}.txt`
          : undefined
      }))
    };
  }

  async getImportDetail(importId: string): Promise<ImportDetailState> {
    const record = importsState.items.find((item) => item.import_id === importId);
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
      workspaceFileRefs: DEFAULT_INCLUDED_REFS.map((path) => path.replace("./workspace", workspaceRef))
    };
  }

  async getBlobDetail(blobId: string): Promise<BlobDetailState> {
    const contentText =
      blobContents[blobId as keyof typeof blobContents] ?? "Blob content is unavailable in the mock service.";

    return {
      id: blobId,
      blobPathRef: `${WORKSPACE_ROOT}/blobs/${blobId.replace(":", "/")}.txt`,
      byteLength: new TextEncoder().encode(contentText).length,
      lineCount: contentText.split("\n").length,
      contentText
    };
  }

  async getWorkspaceDocument(documentRef: string): Promise<WorkspaceDocumentState> {
    const contentText = this.resolveDocumentContent(documentRef);
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
      contentText
    };
  }

  async pauseGlobalAutomation(): Promise<BootstrapState> {
    const timestamp = this.nowLabel();
    this.state = {
      ...this.state,
      mode: "observer",
      automationStatus: "paused",
      statusNote: "Global automation was paused through the service boundary."
    };
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Control",
      tone: "warning",
      headline: "Global automation paused",
      reason:
        "The service layer accepted a pause command, switched the client to observer mode, and preserved the live-centered workspace context for inspection.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "pause_global_automation",
      scope: "live",
      status: "succeeded",
      summary: "Global automation paused through the service layer.",
      details:
        "The client requested a pause and the service boundary switched the live lane into observer mode while preserving workspace inspection state.",
      created_at: timestamp,
      related_refs: ["live/live-lane.json", "state/dashboard.json", "state/decisions.json"]
    });
    this.syncDerivedState();

    return structuredClone(this.state);
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
    const timestamp = this.nowLabel();
    this.state = {
      ...this.state,
      statusNote: "Service-layer intervention flattened all live positions in the mock runtime.",
      positions: [],
      orders: [],
      laneEvents: [
        {
          id: this.nextId("lane-event"),
          scope: "positions",
          kind: "flatten-all",
          summary: "All live positions were flattened through the service layer.",
          timestamp
        },
        {
          id: this.nextId("lane-event"),
          scope: "orders",
          kind: "flatten-all",
          summary: "All live orders were cleared after the flatten-all intervention.",
          timestamp
        },
        ...this.state.laneEvents
      ],
      metrics: this.state.metrics.map((metric) =>
        metric.label === "Risk Budget"
          ? {
              ...metric,
              value: "0%",
              delta: "Reset after flatten-all intervention"
            }
          : metric
      )
    };

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Intervention",
      tone: "warning",
      headline: "All live positions flattened",
      reason:
        "The service layer executed a mock flatten-all intervention and reset current positions and orders without bypassing the workspace contract.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "flatten_all_positions",
      scope: "live",
      status: "succeeded",
      summary: "Flatten-all intervention reset live positions and orders.",
      details:
        "The service boundary flattened current positions, cleared orders, and captured an incident checkpoint for the intervention.",
      created_at: timestamp,
      related_refs: [
        "state/dashboard.json",
        "state/positions.json",
        "state/orders.json",
        "state/decisions.json",
        checkpointPath(checkpointId)
      ]
    });

    this.prependCheckpoint({
      id: checkpointId,
      alias: "incident-flatten-all",
      type: "incident",
      typeTone: "danger",
      summary: "Client-triggered flatten-all command captured as an incident checkpoint.",
      createdAt: timestamp,
      performance: "Live risk reset to flat",
      pathRef: checkpointPath(checkpointId)
    });
    this.syncDerivedState();

    return structuredClone(this.state);
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
    const alias = `export-${new Date().toISOString().slice(11, 16).replace(":", "")}`;
    const timestamp = this.nowLabel();

    this.state = {
      ...this.state,
      statusNote: "A fresh export checkpoint was created from the current live-centered asset."
    };

    this.prependCheckpoint({
      id: checkpointId,
      alias,
      type: "export",
      typeTone: "warning",
      summary: "Fresh export checkpoint created before generating a sanitized live-centered bundle.",
      createdAt: timestamp,
      performance: "Export policy sanitized-live-centered",
      pathRef: checkpointPath(checkpointId),
      exportBundleRef: exportBundlePath(checkpointId)
    });

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Export",
      tone: "neutral",
      headline: "Export checkpoint created",
      reason:
        "The service layer created a fresh checkpoint before export so the client can share a stable live-centered asset instead of a drifting mutable state.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "create_export_checkpoint",
      scope: "live",
      status: "succeeded",
      summary: `Export checkpoint ${alias} created for sanitized sharing.`,
      details:
        "The service layer created a fresh export checkpoint and materialized a sanitized bundle from the live-centered workspace state.",
      created_at: timestamp,
      related_refs: [checkpointPath(checkpointId), exportBundlePath(checkpointId), "exports/policy.json"]
    });
    this.syncDerivedState();

    return structuredClone(this.state);
  }

  async restoreCheckpoint(checkpointId: string): Promise<BootstrapState> {
    const target = this.state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!target) {
      throw new Error(`unknown checkpoint: ${checkpointId}`);
    }

    const anchorId = crypto.randomUUID();
    const timestamp = this.nowLabel();
    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: target.alias
      },
      statusNote: `Live workspace restored from checkpoint ${target.alias}.`,
      laneEvents: this.state.laneEvents,
      checkpoints: [
        {
          id: anchorId,
          alias: `incident-restore-anchor-${anchorId.slice(0, 8)}`,
          type: "incident",
          typeTone: "danger",
          summary: `Automatic pre-restore checkpoint created before restoring ${target.alias}.`,
          createdAt: timestamp,
          performance: "Rollback anchor for live workspace restore",
          pathRef: checkpointPath(anchorId)
        },
        ...this.state.checkpoints
      ]
    };

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Restore",
      tone: "warning",
      headline: `Restored live workspace from ${target.alias}`,
      reason:
        "The service layer reapplied the selected checkpoint snapshot as the active live workspace while preserving checkpoint and export history.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "restore_checkpoint",
      scope: "live",
      status: "succeeded",
      summary: `Live workspace restored from checkpoint ${target.alias}.`,
      details:
        "The service layer restored the selected checkpoint snapshot as the active live workspace and preserved the rollback anchor as an incident checkpoint.",
      created_at: timestamp,
      related_refs: [target.pathRef, checkpointPath(anchorId), "strategy.json", "state/decisions.json"]
    });

    this.state = {
      ...this.state,
      assetInspector: {
        ...this.state.assetInspector,
        currentCheckpointRef: target.pathRef,
        checkpointCount: this.state.checkpoints.length
      }
    };
    this.syncDerivedState(target.pathRef, target.alias);

    return structuredClone(this.state);
  }

  async ingestSourceEntry(input: IngestSourceEntryInput): Promise<IngestSourceEntryResult> {
    const payload = input.bodyText ?? input.preview;
    if (!payload) {
      throw new Error("Mock ingest requires bodyText or preview");
    }

    const timeBucket = toUtcHourBucket(input.eventTime);
    const existing = collectionsState.items.find(
      (item) =>
        item.kind === input.kind &&
        item.source_ref === input.sourceRef &&
        item.time_bucket === timeBucket
    );
    const collectionId = existing?.collection_id ?? `mock-${crypto.randomUUID()}`;
    const createdCollection = !existing;
    const blobId = mockBlobIdFromText(payload);

    if (!blobContents[blobId]) {
      blobContents[blobId] = payload;
    }

    if (!entriesByCollection[collectionId]) {
      entriesByCollection[collectionId] = [];
    }

    const entry = {
      entry_id: crypto.randomUUID(),
      source_ref: input.sourceRef,
      event_time: input.eventTime,
      ingested_at: input.ingestedAt,
      content_hash: blobId,
      blob_ref: blobId,
      preview: input.preview
    };
    entriesByCollection[collectionId].push(entry);

    const nextTimeRange = {
      start: entriesByCollection[collectionId][0]?.event_time ?? input.eventTime,
      end: entriesByCollection[collectionId][entriesByCollection[collectionId].length - 1]?.event_time ?? input.eventTime
    };

    if (existing) {
      existing.entry_count = entriesByCollection[collectionId].length;
      existing.content_hash = blobId;
      existing.time_range = nextTimeRange;
    } else {
      collectionsState.items.unshift({
        collection_id: collectionId,
        kind: input.kind,
        source_ref: input.sourceRef,
        time_bucket: timeBucket,
        time_range: nextTimeRange,
        entry_count: 1,
        content_hash: blobId,
        path_ref: `./items/${collectionId}/collection.json`
      });
    }

    this.state.collections = buildCollections();
    this.state.workspaceIndex.collectionCount = collectionsState.items.length;
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "ingest_source_entry",
      scope: "workspace",
      status: "succeeded",
      summary: `Ingested ${input.sourceRef} into collection ${collectionId}.`,
      details:
        "The service layer materialized a source-centered collection shard, appended an entry NDJSON record, and persisted an immutable blob for the entry body.",
      created_at: this.nowLabel(),
      related_refs: [
        `collections/items/${collectionId}/collection.json`,
        `collections/items/${collectionId}/entries.ndjson`,
        `blobs/${blobId.replace(":", "/")}.txt`
      ]
    });

    return {
      collectionId,
      collectionRef: `${WORKSPACE_ROOT}/collections/items/${collectionId}/collection.json`,
      entryId: entry.entry_id,
      entryShardRef: `${WORKSPACE_ROOT}/collections/items/${collectionId}/entries.ndjson`,
      timeBucket,
      entryCount: entriesByCollection[collectionId].length,
      blobId,
      createdCollection
    };
  }

  async importExportBundle(bundleRef: string): Promise<ImportBundleState> {
    const importId = crypto.randomUUID();
    const importedAt = this.nowLabel();
    const record = {
      import_id: importId,
      imported_at: importedAt,
      source_bundle_ref: bundleRef,
      bundle_ref: "./bundle/export.json",
      workspace_ref: "./workspace",
      checkpoint_ref: this.state.assetInspector.currentCheckpointRef,
      policy_id: exportPolicy.policy_id,
      sanitized: true
    };

    importsState.items.unshift(record);
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Import",
      tone: "neutral",
      headline: "Sanitized export staged as import",
      reason:
        "The service layer staged a sanitized export bundle into the workspace imports area without mutating the active live workspace.",
      timestamp: importedAt
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "import_export_bundle",
      scope: "workspace",
      status: "succeeded",
      summary: `Staged sanitized export bundle as import ${importId}.`,
      details:
        "The service layer copied a sanitized export bundle into the workspace imports area without mutating the active live lane.",
      created_at: importedAt,
      related_refs: [
        `imports/items/${importId}/import.json`,
        `imports/items/${importId}/bundle/export.json`,
        `imports/items/${importId}/workspace`
      ]
    });
    this.syncDerivedState();

    return {
      importId,
      importedAt,
      sourceBundleRef: bundleRef,
      importRef: `${WORKSPACE_ROOT}/imports/items/${importId}/import.json`,
      workspaceRef: `${WORKSPACE_ROOT}/imports/items/${importId}/workspace`,
      checkpointRef: record.checkpoint_ref,
      policyId: record.policy_id,
      sanitized: record.sanitized
    };
  }

  private prependCheckpoint(checkpoint: CheckpointSummary) {
    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: checkpoint.alias
      },
      assetInspector: {
        ...this.state.assetInspector,
        currentCheckpointRef: checkpoint.pathRef,
        latestExportBundleRef:
          checkpoint.type === "export"
            ? checkpoint.exportBundleRef ?? this.state.assetInspector.latestExportBundleRef
            : this.state.assetInspector.latestExportBundleRef,
        checkpointCount: this.state.assetInspector.checkpointCount + 1,
        exportCount:
          checkpoint.type === "export"
            ? this.state.assetInspector.exportCount + 1
            : this.state.assetInspector.exportCount
      },
      checkpoints: [checkpoint, ...this.state.checkpoints]
    };
  }

  private prependDecision(decision: DecisionEntry) {
    this.state = {
      ...this.state,
      decisions: [decision, ...this.state.decisions]
    };
  }

  private prependOperation(operation: {
    operation_id: string;
    kind: string;
    scope: "live" | "workspace";
    status: "succeeded";
    summary: string;
    details: string;
    created_at: string;
    related_refs?: string[];
  }) {
    operationsState.items.unshift(operation);
    this.state = {
      ...this.state,
      operations: buildOperations()
    };
  }

  private syncDerivedState(currentCheckpointRef?: string, currentCheckpointAlias?: string) {
    const resolvedCheckpointRef =
      currentCheckpointRef ?? this.state.checkpoints[0]?.pathRef ?? checkpointPath(checkpointIndex.current.checkpoint_id);
    const resolvedCheckpointAlias =
      currentCheckpointAlias ?? this.state.workspace.currentCheckpointAlias ?? checkpointIndex.current.alias;

    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: resolvedCheckpointAlias
      },
      assetInspector: buildAssetInspector(this.state.checkpoints, resolvedCheckpointRef),
      workspaceIndex: buildWorkspaceIndex(resolvedCheckpointRef),
      exportInspector: buildExportInspector(this.state.checkpoints),
      collections: buildCollections(),
      imports: buildImports(),
      operations: buildOperations(),
      documentCatalog: buildDocumentCatalog(
        resolvedCheckpointRef,
        buildExportInspector(this.state.checkpoints).latestBundle?.bundleRef
      )
    };
  }

  private nextId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  private nowLabel() {
    return `UTC ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  }

  private resolveDocumentContent(documentRef: string): string {
    const checkpointWorkspaceMatch = documentRef.match(
      /var\/dev-workspace\/checkpoints\/items\/([^/]+)\/workspace\/(.+)$/
    );
    if (checkpointWorkspaceMatch) {
      return this.resolveDocumentContent(`${WORKSPACE_ROOT}/${checkpointWorkspaceMatch[2]}`);
    }

    const exportWorkspaceMatch = documentRef.match(
      /var\/dev-workspace\/exports\/generated\/([^/]+)\/workspace\/(.+)$/
    );
    if (exportWorkspaceMatch) {
      return this.resolveDocumentContent(`${WORKSPACE_ROOT}/${exportWorkspaceMatch[2]}`);
    }

    const importWorkspaceMatch = documentRef.match(
      /var\/dev-workspace\/imports\/items\/([^/]+)\/workspace\/(.+)$/
    );
    if (importWorkspaceMatch) {
      return this.resolveDocumentContent(`${WORKSPACE_ROOT}/${importWorkspaceMatch[2]}`);
    }

    if (documentRef === `${WORKSPACE_ROOT}/strategy.json`) {
      return JSON.stringify(mockStrategyManifest, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/live/live-lane.json`) {
      return JSON.stringify(liveLane, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/exports/policy.json`) {
      return JSON.stringify(exportPolicyTemplate, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/imports/index.json`) {
      return JSON.stringify(importsState, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/operations/index.json`) {
      return JSON.stringify(operationsState, null, 2);
    }
    const operationMatch = documentRef.match(/var\/dev-workspace\/operations\/items\/([^/]+)\/operation\.json$/);
    if (operationMatch) {
      const operation = operationsState.items.find((item) => item.operation_id === operationMatch[1]);
      if (operation) {
        return JSON.stringify(operation, null, 2);
      }
    }
    if (documentRef === `${WORKSPACE_ROOT}/checkpoints/index.json`) {
      return JSON.stringify(
        {
          current: {
            checkpoint_id: this.state.checkpoints[0]?.id ?? checkpointIndex.current.checkpoint_id,
            alias: this.state.checkpoints[0]?.alias ?? checkpointIndex.current.alias,
            type: this.state.checkpoints[0]?.type ?? checkpointIndex.current.type
          },
          items: this.state.checkpoints.map((checkpoint) => ({
            checkpoint_id: checkpoint.id,
            alias: checkpoint.alias,
            type: checkpoint.type,
            type_tone: checkpoint.typeTone,
            summary: checkpoint.summary,
            created_at: checkpoint.createdAt,
            performance: checkpoint.performance,
            path_ref: checkpoint.pathRef
          }))
        },
        null,
        2
      );
    }
    if (documentRef === `${WORKSPACE_ROOT}/indexes/collections.json`) {
      return JSON.stringify({ items: collectionsState.items }, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/indexes/sessions.json`) {
      return JSON.stringify(sessionsState, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/state/eval-summaries.json`) {
      return JSON.stringify(evalSummariesState, null, 2);
    }

    const sessionMatch = documentRef.match(/sessions\/items\/([^/]+)\/session\.json$/);
    if (sessionMatch) {
      const session = sessionsState.sessions.find((item) => item.session_id === sessionMatch[1]);
      if (session) {
        return JSON.stringify(
          {
            session_id: session.session_id,
            label: session.label,
            started_at: session.started_at,
            status: session.status,
            scope: "live",
            goal: "Keep the live trading context inspectable, exportable, and replayable.",
            context_refs: [
              "./live/live-lane.json",
              "./state/live-memory.json",
              "./state/positions.json",
              "./state/orders.json",
              "./state/eval-summaries.json"
            ],
            notes: [
              "Session records stay inside the workspace asset and are exposed through the service layer.",
              "These documents are part of the live trading context whenever they materially influence trading behavior."
            ]
          },
          null,
          2
        );
      }
    }

    const evalSummaryMatch = documentRef.match(/eval-summaries\/items\/([^/]+)\/summary\.json$/);
    if (evalSummaryMatch) {
      const summary = evalSummariesState.summaries.find(
        (item) => item.summary_id === evalSummaryMatch[1]
      );
      if (summary) {
        return JSON.stringify(
          {
            summary_id: summary.summary_id,
            headline: summary.headline,
            created_at: summary.created_at,
            tone: "positive",
            decision: "keep-current-live-checkpoint",
            rationale: [
              "Recent paper candidates improved gross PnL but lost the edge once model cost and slippage were applied.",
              "Forced intervention frequency remained lower on the current live checkpoint than on the latest rejected candidates."
            ],
            evidence_refs: summary.evidence_refs ?? []
          },
          null,
          2
        );
      }
    }

    const checkpointMatch = documentRef.match(/checkpoints\/items\/([^/]+)\/checkpoint\.json$/);
    if (checkpointMatch) {
      const checkpoint = this.state.checkpoints.find((item) => item.id === checkpointMatch[1]);
      if (checkpoint) {
        return JSON.stringify(
          {
            checkpoint_id: checkpoint.id,
            alias: checkpoint.alias,
            type: checkpoint.type,
            type_tone: checkpoint.typeTone,
            summary: checkpoint.summary,
            created_at: checkpoint.createdAt,
            performance: checkpoint.performance,
            path_ref: checkpoint.pathRef
          },
          null,
          2
        );
      }
    }

    const exportMatch = documentRef.match(/exports\/generated\/([^/]+)\/export\.json$/);
    if (exportMatch) {
      const checkpoint = this.state.checkpoints.find((item) => item.id === exportMatch[1]);
      if (checkpoint) {
        return JSON.stringify(buildExportBundle(checkpoint), null, 2);
      }
    }

    const importManifestMatch = documentRef.match(/imports\/items\/([^/]+)\/import\.json$/);
    if (importManifestMatch) {
      const imported = importsState.items.find((item) => item.import_id === importManifestMatch[1]);
      if (imported) {
        return JSON.stringify(imported, null, 2);
      }
    }

    const importBundleMatch = documentRef.match(/imports\/items\/([^/]+)\/bundle\/export\.json$/);
    if (importBundleMatch) {
      const imported = importsState.items.find((item) => item.import_id === importBundleMatch[1]);
      if (imported) {
        const matchingCheckpoint = this.state.checkpoints.find(
          (checkpoint) => checkpoint.pathRef === imported.checkpoint_ref
        );
        if (matchingCheckpoint) {
          return JSON.stringify(buildExportBundle(matchingCheckpoint), null, 2);
        }
      }
    }

    const collectionMatch = documentRef.match(/collections\/items\/([^/]+)\/collection\.json$/);
    if (collectionMatch) {
      const collection =
        collectionsState.items.find((item) => item.collection_id === collectionMatch[1]) ??
        collectionsState.items[0];
      return JSON.stringify(
        {
          ...collection,
          entry_shard_ref: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`,
          notes:
            collection.source_ref === "binance-usdm:aggtrade:BTCUSDT"
              ? "Agg trades stay raw and source-centered. Market interpretation belongs in evaluation and session logs."
              : "Macro text is stored source-first. Symbol linkage and impact are deferred to agent logs."
        },
        null,
        2
      );
    }

    const shardMatch = documentRef.match(/collections\/items\/([^/]+)\/entries\.ndjson$/);
    if (shardMatch) {
      return (
        entriesByCollection[shardMatch[1] as keyof typeof entriesByCollection]
          ?.map((entry) => JSON.stringify(entry))
          .join("\n") ?? ""
      );
    }

    const blobMatch = documentRef.match(/blobs\/sha256\/([a-f0-9]+)\.txt$/);
    if (blobMatch) {
      const blobId = `sha256:${blobMatch[1]}` as keyof typeof blobContents;
      return blobContents[blobId] ?? "Blob content is unavailable in the mock service.";
    }

    return JSON.stringify({ unsupportedRef: documentRef }, null, 2);
  }
}

export const mockWorkspaceService = new MockWorkspaceService();

function parseEntries(raw: string): CollectionEntryRecord[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CollectionEntryRecord);
}
