export type TradingMode = "observer" | "paper" | "live";

export type ProviderStatus = {
  name: "Codex" | "Claude Code";
  statusLabel: string;
  usageLabel: string;
};

export type MetricCardData = {
  label: string;
  value: string;
  delta: string;
  description: string;
  icon: "momentum" | "risk" | "leverage" | "up" | "down";
};

export type PricePoint = {
  label: string;
  btc: number;
  eth: number;
};

export type EquityPoint = {
  label: string;
  value: number;
};

export type ExposurePoint = {
  symbol: string;
  value: number;
};

export type LivePosition = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: string;
  entry: string;
  pnl: string;
  protectiveStop: string;
  contextTag: string;
};

export type LiveOrder = {
  id: string;
  symbol: string;
  kind: string;
  status: string;
  statusTone: "neutral" | "positive" | "warning" | "danger";
  summary: string;
};

export type DecisionEntry = {
  id: string;
  kind: string;
  tone: "positive" | "warning" | "neutral";
  headline: string;
  reason: string;
  timestamp: string;
};

export type CheckpointSummary = {
  id: string;
  alias: string;
  type: "promotion" | "export" | "incident";
  typeTone: "positive" | "warning" | "danger";
  summary: string;
  createdAt: string;
  performance: string;
  pathRef: string;
  exportBundleRef?: string;
};

export type CheckpointDetailState = {
  id: string;
  alias: string;
  type: "promotion" | "export" | "incident";
  typeTone: "positive" | "warning" | "danger";
  summary: string;
  createdAt: string;
  performance: string;
  checkpointRef: string;
  snapshotWorkspaceRef: string;
  workspaceFileRefs: string[];
  exportBundle: ExportBundleState | null;
};

export type WorkspaceSummary = {
  artifactId: string;
  slug: string;
  liveLaneLabel: string;
  currentCheckpointAlias: string;
  exportPolicyLabel: string;
};

export type AssetInspectorState = {
  workspaceRoot: string;
  strategyRef: string;
  liveLaneRef: string;
  currentCheckpointRef: string;
  exportPolicyRef: string;
  latestExportBundleRef?: string;
  checkpointCount: number;
  exportCount: number;
};

export type StrategyActiveIndexState = {
  liveLaneRef: string;
  currentCheckpointRef: string;
  exportPolicyRef: string;
};

export type StrategyIndexesState = {
  checkpointsRef: string;
  collectionsRef: string;
  sessionsRef: string;
};

export type WorkspaceIndexState = {
  schemaVersion: string;
  active: StrategyActiveIndexState;
  indexes: StrategyIndexesState;
  collectionCount: number;
  sessionCount: number;
};

export type LiveContextState = {
  memoryNotes: string[];
  sessionLabels: string[];
  evalEvidenceRefs: string[];
  positionEventCount: number;
  orderEventCount: number;
};

export type ExportBundleState = {
  exportId: string;
  createdAt: string;
  policyId: string;
  checkpointRef: string;
  workspaceRef: string;
  bundleRef: string;
  includedRefs: string[];
  excludedPaths: string[];
  sanitized: boolean;
};

export type ExportInspectorState = {
  policyId: string;
  description: string;
  latestBundle: ExportBundleState | null;
};

export type BootstrapState = {
  mode: TradingMode;
  automationStatus: "active" | "paused";
  statusNote?: string;
  workspace: WorkspaceSummary;
  assetInspector: AssetInspectorState;
  workspaceIndex: WorkspaceIndexState;
  liveContext: LiveContextState;
  exportInspector: ExportInspectorState;
  providers: ProviderStatus[];
  metrics: MetricCardData[];
  priceSeries: PricePoint[];
  equitySeries: EquityPoint[];
  exposureSeries: ExposurePoint[];
  positions: LivePosition[];
  orders: LiveOrder[];
  decisions: DecisionEntry[];
  checkpoints: CheckpointSummary[];
};

export interface WorkspaceService {
  getBootstrapState(): Promise<BootstrapState>;
  getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState>;
  pauseGlobalAutomation(): Promise<BootstrapState>;
  flattenAllPositions(): Promise<BootstrapState>;
  createExportCheckpoint(): Promise<BootstrapState>;
}
