import type {
  AssetInspectorState,
  BootstrapState,
  CheckpointSummary,
  CollectionSummaryState,
  DecisionEntry,
  EvaluationRunSummaryState,
  ExchangeAdapterState,
  ExportInspectorState,
  ImportSummaryState,
  LaneEventState,
  LiveContextState,
  OperationSummaryState,
  RuntimeTopologyState,
  WorkspaceCatalogEntry,
  WorkspaceIndexState
} from "../service-contract";
import type {
  AgentDefinition,
  AgentsIndex,
  AdapterDefinition,
  AdaptersIndex,
  BlobId,
  CheckpointIndex,
  CollectionRecord,
  EnvironmentDefinition,
  EnvironmentsIndex,
  LiveLaneState,
  OrchestratorRecord,
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

export type AdapterRecord = AdapterDefinition;

export type EvaluationRunRecord = {
  run_id: string;
  kind: string;
  status: string;
  headline: string;
  summary: string;
  created_at: string;
  adapter_ref: string;
  adapter_name: string;
  collection_refs: string[];
  gross_pnl: number;
  fee_cost: number;
  slippage_cost: number;
  model_cost: number;
  net_pnl: number;
  trade_count: number;
  position_count: number;
  path_ref: string;
  equity_curve: BootstrapState["equitySeries"];
  trades: Array<{
    symbol: string;
    side: string;
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    net_pnl: number;
  }>;
  notes: string[];
};

export type EvaluationsState = {
  items: EvaluationRunRecord[];
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
  | "mode"
  | "automationStatus"
  | "statusNote"
  | "assetInspector"
  | "workspaceIndex"
  | "runtimeTopology"
  | "liveContext"
  | "exportInspector"
  | "workspace"
  | "adapters"
  | "positions"
  | "orders"
  | "laneEvents"
  | "decisions"
  | "checkpoints"
  | "collections"
  | "evaluationRuns"
  | "imports"
  | "operations"
  | "documentCatalog"
>;

export type RuntimeStatusSeedState = Pick<
  BootstrapState,
  "mode" | "automationStatus" | "statusNote"
>;

export type MockWorkspaceStore = {
  strategyManifest: StrategyManifest;
  orchestrator: OrchestratorRecord;
  liveLane: LiveLaneState;
  checkpointIndexSeed: CheckpointIndexSeed;
  exportPolicy: ExportPolicyRecord;
  collectionsState: CollectionsState;
  importsState: ImportsState;
  operationsState: OperationsState;
  runtimeStatusState: RuntimeStatusSeedState;
  dashboardSeedState: DashboardSeedState;
  decisionsState: DecisionsState;
  ordersState: OrdersState;
  positionsState: PositionsState;
  liveMemoryState: LiveMemoryState;
  sessionsState: SessionsState;
  evalSummariesState: EvalSummariesState;
  agentsIndex: AgentsIndex;
  environmentsIndex: EnvironmentsIndex;
  adaptersIndex: AdaptersIndex;
  evaluationsState: EvaluationsState;
  agentDefinitions: Record<string, AgentDefinition>;
  environmentDefinitions: Record<string, EnvironmentDefinition>;
  adapterDefinitions: Record<string, AdapterRecord>;
  entriesByCollection: Record<string, CollectionEntryRecord[]>;
  blobContents: Record<BlobId | string, string>;
};

export type MockDerivedState = {
  checkpoints: CheckpointSummary[];
  currentCheckpointRef: string;
  assetInspector: AssetInspectorState;
  workspaceIndex: WorkspaceIndexState;
  runtimeTopology: RuntimeTopologyState;
  liveContext: LiveContextState;
  exportInspector: ExportInspectorState;
  adapters: ExchangeAdapterState[];
  collections: CollectionSummaryState[];
  evaluationRuns: EvaluationRunSummaryState[];
  imports: ImportSummaryState[];
  operations: OperationSummaryState[];
  documentCatalog: WorkspaceCatalogEntry[];
  laneEvents: LaneEventState[];
};
