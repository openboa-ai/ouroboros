import type {
  AssetInspectorState,
  BootstrapState,
  CheckpointDetailState,
  CheckpointSummary,
  DecisionEntry,
  ExportBundleState,
  ExportInspectorState,
  LiveContextState,
  WorkspaceIndexState,
  WorkspaceService
} from "./service-contract";
import type { LiveLaneState, StrategyManifest } from "./workspace-contract";
import checkpointIndexTemplate from "../../templates/strategy-workspace/checkpoints/index.json";
import exportPolicyTemplate from "../../templates/strategy-workspace/exports/policy.json";
import collectionsTemplate from "../../templates/strategy-workspace/indexes/collections.json";
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
  collections: Array<unknown>;
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
  events: Array<{ event_id: string }>;
};

const positionsState = positionsTemplate as {
  current: BootstrapState["positions"];
  events: Array<{ event_id: string }>;
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
    collectionCount: collectionsState.collections.length,
    sessionCount: sessionsState.sessions.length
  };
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
  return {
    exportId: checkpoint.id,
    createdAt: checkpoint.createdAt,
    policyId: exportPolicy.policy_id,
    checkpointRef: checkpoint.pathRef,
    workspaceRef: "./workspace",
    bundleRef: exportBundlePath(checkpoint.id),
    includedRefs: DEFAULT_INCLUDED_REFS,
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
    decisions: decisionsState.decisions,
    checkpoints
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

  private syncDerivedState() {
    const currentCheckpointRef = this.state.checkpoints[0]?.pathRef ?? checkpointPath(checkpointIndex.current.checkpoint_id);

    this.state = {
      ...this.state,
      assetInspector: buildAssetInspector(this.state.checkpoints, currentCheckpointRef),
      workspaceIndex: buildWorkspaceIndex(currentCheckpointRef),
      exportInspector: buildExportInspector(this.state.checkpoints)
    };
  }

  private nextId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  private nowLabel() {
    return `UTC ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  }
}

export const mockWorkspaceService = new MockWorkspaceService();
