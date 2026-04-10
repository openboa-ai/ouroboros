import type {
  AssetInspectorState,
  BlobDetailState,
  BootstrapState,
  CollectionDetailState,
  CollectionSummaryState,
  CheckpointDetailState,
  CheckpointSummary,
  DecisionEntry,
  ExportBundleState,
  ExportInspectorState,
  LaneEventState,
  LiveContextState,
  WorkspaceDocumentState,
  WorkspaceIndexState,
  WorkspaceService
} from "./service-contract";
import type { LiveLaneState, StrategyManifest } from "./workspace-contract";
import checkpointIndexTemplate from "../../templates/strategy-workspace/checkpoints/index.json";
import exportPolicyTemplate from "../../templates/strategy-workspace/exports/policy.json";
import collectionsTemplate from "../../templates/strategy-workspace/indexes/collections.json";
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

const dashboardState = dashboardTemplate as Omit<
  BootstrapState,
  "workspace" | "positions" | "orders" | "decisions" | "checkpoints"
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
  sessions: Array<{ label: string }>;
};

const evalSummariesState = evalSummariesTemplate as {
  summaries: Array<{ evidence_refs?: string[] }>;
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

const entriesByCollection = {
  "019626b0-4d0a-7a72-9b4e-9d8e11d0f901": parseEntries(btcAggEntriesRaw),
  "019626b6-c73a-7fe6-b0a5-64ac631d5102": parseEntries(macroNewsEntriesRaw)
} satisfies Record<string, CollectionEntryRecord[]>;

const blobContents = {
  "sha256:cd36e47d463d9e2efe3e2030670ca7694a9f303a8837cad4e4e5135c427f945f": btcAggBlobOneRaw,
  "sha256:aef3c2aa9075dc26b7484d71d06d10c152f5310cd34d5eb2b3b3b6fa915e4b3c": btcAggBlobTwoRaw,
  "sha256:7bbdd0eec8d01854af7185348af542fb665987debe396f2ce2e88f4e35f8af0e": btcAggBlobThreeRaw,
  "sha256:2b0f06db4a1f0530763ad7aa5a10bc2e47017dcaf4f79f8fa0e6a5819d57081f": macroNewsBlobOneRaw,
  "sha256:e2d312f2f5767f7334ba8d3fa90fc2c9d66b2d05d4c77db8bc8d289d5fc5f7ec": macroNewsBlobTwoRaw
} satisfies Record<string, string>;
const DEFAULT_INCLUDED_REFS = [
  "./workspace/strategy.json",
  "./workspace/live/live-lane.json",
  "./workspace/state/dashboard.json",
  "./workspace/state/decisions.json",
  "./workspace/state/live-memory.json",
  "./workspace/state/orders.json",
  "./workspace/state/positions.json",
  "./workspace/state/eval-summaries.json",
  "./workspace/indexes/sessions.json"
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
      sessionsRef: `${WORKSPACE_ROOT}/indexes/sessions.json`
    },
    collectionCount: collectionsState.items.length,
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

function buildLiveContext(): LiveContextState {
  return {
    memoryNotes: liveMemoryState.notes.map((note) => note.summary),
    sessionLabels: sessionsState.sessions.map((session) => session.label),
    evalEvidenceRefs: evalSummariesState.summaries.flatMap((summary) => summary.evidence_refs ?? []),
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
    collections: buildCollections()
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
      timestamp: this.nowLabel()
    });
    this.syncDerivedState();

    return structuredClone(this.state);
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
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
          timestamp: this.nowLabel()
        },
        {
          id: this.nextId("lane-event"),
          scope: "orders",
          kind: "flatten-all",
          summary: "All live orders were cleared after the flatten-all intervention.",
          timestamp: this.nowLabel()
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
      timestamp: this.nowLabel()
    });

    this.prependCheckpoint({
      id: checkpointId,
      alias: "incident-flatten-all",
      type: "incident",
      typeTone: "danger",
      summary: "Client-triggered flatten-all command captured as an incident checkpoint.",
      createdAt: this.nowLabel(),
      performance: "Live risk reset to flat",
      pathRef: checkpointPath(checkpointId)
    });
    this.syncDerivedState();

    return structuredClone(this.state);
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
    const alias = `export-${new Date().toISOString().slice(11, 16).replace(":", "")}`;

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
      createdAt: this.nowLabel(),
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
      timestamp: this.nowLabel()
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
          createdAt: this.nowLabel(),
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
      timestamp: this.nowLabel()
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
      exportInspector: buildExportInspector(this.state.checkpoints)
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

    if (documentRef === `${WORKSPACE_ROOT}/strategy.json`) {
      return JSON.stringify(mockStrategyManifest, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/live/live-lane.json`) {
      return JSON.stringify(liveLane, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/exports/policy.json`) {
      return JSON.stringify(exportPolicyTemplate, null, 2);
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
      return JSON.stringify(collectionsTemplate, null, 2);
    }
    if (documentRef === `${WORKSPACE_ROOT}/indexes/sessions.json`) {
      return JSON.stringify(sessionsTemplate, null, 2);
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
