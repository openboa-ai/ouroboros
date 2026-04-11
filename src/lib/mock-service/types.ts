import type {
  AssetInspectorState,
  BootstrapState,
  CheckpointSummary,
  CollectionSummaryState,
  DecisionEntry,
  ExportInspectorState,
  ImportSummaryState,
  LaneEventState,
  LiveContextState,
  OperationSummaryState,
  WorkspaceCatalogEntry,
  WorkspaceIndexState
} from "../service-contract";
import type {
  BlobId,
  CheckpointIndex,
  CollectionRecord,
  LiveLaneState,
  StrategyManifest
} from "../workspace-contract";

export type CollectionEntryRecord = {
  entry_id: string;
  source_ref: string;
  event_time: string;
  ingested_at: string;
  content_hash: string;
  blob_ref?: string;
  preview?: string;
};

export type LaneEventRecord = {
  event_id: string;
  timestamp: string;
  kind: string;
  summary: string;
};

export type ExportPolicyRecord = {
  policy_id: string;
  description: string;
};

export type ImportRecord = {
  import_id: string;
  imported_at: string;
  source_bundle_ref: string;
  bundle_ref: string;
  workspace_ref: string;
  checkpoint_ref: string;
  policy_id: string;
  sanitized: boolean;
};

export type OperationRecord = {
  operation_id: string;
  kind: string;
  scope: "live" | "workspace";
  status: "succeeded";
  summary: string;
  details: string;
  created_at: string;
  related_refs?: string[];
};

export type SessionRecord = {
  session_id: string;
  label: string;
  started_at: string;
  status: string;
  path_ref: string;
};

export type EvalSummaryRecord = {
  summary_id: string;
  headline: string;
  created_at: string;
  path_ref: string;
  evidence_refs?: string[];
};

export type DecisionsState = {
  decisions: DecisionEntry[];
};

export type OrdersState = {
  current: BootstrapState["orders"];
  events: LaneEventRecord[];
};

export type PositionsState = {
  current: BootstrapState["positions"];
  events: LaneEventRecord[];
};

export type LiveMemoryState = {
  notes: Array<{ summary: string }>;
};

export type SessionsState = {
  sessions: SessionRecord[];
};

export type EvalSummariesState = {
  summaries: EvalSummaryRecord[];
};

export type AgentIndexItem = {
  id: string;
  kind: string;
  name: string;
  provider_mode: string;
  definition_ref: string;
};

export type EnvironmentIndexItem = {
  id: string;
  name: string;
  definition_ref: string;
};

export type AgentsIndexState = {
  agents: AgentIndexItem[];
};

export type EnvironmentsIndexState = {
  environments: EnvironmentIndexItem[];
};

export type ImportsState = {
  items: ImportRecord[];
};

export type OperationsState = {
  items: OperationRecord[];
};

export type CollectionsState = {
  items: CollectionRecord[];
};

export type CheckpointIndexSeed = CheckpointIndex;

export type DashboardSeedState = Omit<
  BootstrapState,
  | "assetInspector"
  | "workspaceIndex"
  | "liveContext"
  | "exportInspector"
  | "workspace"
  | "positions"
  | "orders"
  | "laneEvents"
  | "decisions"
  | "checkpoints"
  | "collections"
  | "imports"
  | "operations"
  | "documentCatalog"
>;

export type MockWorkspaceStore = {
  strategyManifest: StrategyManifest;
  liveLane: LiveLaneState;
  checkpointIndexSeed: CheckpointIndexSeed;
  exportPolicy: ExportPolicyRecord;
  collectionsState: CollectionsState;
  importsState: ImportsState;
  operationsState: OperationsState;
  dashboardSeedState: DashboardSeedState;
  decisionsState: DecisionsState;
  ordersState: OrdersState;
  positionsState: PositionsState;
  liveMemoryState: LiveMemoryState;
  sessionsState: SessionsState;
  evalSummariesState: EvalSummariesState;
  agentsIndex: AgentsIndexState;
  environmentsIndex: EnvironmentsIndexState;
  entriesByCollection: Record<string, CollectionEntryRecord[]>;
  blobContents: Record<BlobId | string, string>;
};

export type MockDerivedState = {
  checkpoints: CheckpointSummary[];
  currentCheckpointRef: string;
  assetInspector: AssetInspectorState;
  workspaceIndex: WorkspaceIndexState;
  liveContext: LiveContextState;
  exportInspector: ExportInspectorState;
  collections: CollectionSummaryState[];
  imports: ImportSummaryState[];
  operations: OperationSummaryState[];
  documentCatalog: WorkspaceCatalogEntry[];
  laneEvents: LaneEventState[];
};
