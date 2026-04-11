export type WorkspaceCatalogCategory =
  | "entrypoint"
  | "active"
  | "index"
  | "export"
  | "operation"
  | "checkpoint"
  | "collection"
  | "entry"
  | "import"
  | "blob"
  | "session"
  | "evaluation";

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

export type CheckpointComparisonFileState = {
  relativePath: string;
  status: "added" | "removed" | "changed";
  baseRef?: string;
  targetRef?: string;
};

export type CheckpointComparisonState = {
  baseCheckpointId: string;
  baseAlias: string;
  targetCheckpointId: string;
  targetAlias: string;
  comparedFileCount: number;
  changedCount: number;
  addedCount: number;
  removedCount: number;
  summary: string;
  files: CheckpointComparisonFileState[];
};

export type CollectionSummaryState = {
  id: string;
  kind: "raw" | "canonical";
  sourceRef: string;
  timeBucket: string;
  timeRangeLabel: string;
  entryCount: number;
  contentHash: string;
  collectionRef: string;
};

export type CollectionEntryState = {
  id: string;
  sourceRef: string;
  eventTime: string;
  ingestedAt: string;
  contentHash: string;
  preview?: string;
  entryPathRef: string;
  blobRef?: string;
  blobPathRef?: string;
};

export type CollectionDetailState = {
  id: string;
  kind: "raw" | "canonical";
  sourceRef: string;
  timeBucket: string;
  timeRangeLabel: string;
  entryCount: number;
  contentHash: string;
  collectionRef: string;
  entryShardRef: string;
  notes?: string;
  entries: CollectionEntryState[];
};

export type BlobDetailState = {
  id: string;
  blobPathRef: string;
  byteLength: number;
  lineCount: number;
  contentText: string;
};

export type WorkspaceDocumentBacklinkState = {
  label: string;
  pathRef: string;
  category: WorkspaceCatalogCategory | "reference";
  reason: string;
};

export type WorkspaceDocumentState = {
  pathRef: string;
  format: "json" | "ndjson" | "text";
  byteLength: number;
  lineCount: number;
  contentText: string;
  backlinks: WorkspaceDocumentBacklinkState[];
};

export type WorkspaceCatalogEntry = {
  id: string;
  category: WorkspaceCatalogCategory;
  label: string;
  description: string;
  pathRef: string;
};

export type WorkspaceSearchResultState = {
  id: string;
  category: WorkspaceCatalogEntry["category"];
  label: string;
  description: string;
  pathRef: string;
  matchKind: "metadata" | "content";
  excerpt?: string;
};

export type ImportSummaryState = {
  id: string;
  importedAt: string;
  sourceBundleRef: string;
  importRef: string;
  workspaceRef: string;
  checkpointRef: string;
  policyId: string;
  sanitized: boolean;
};

export type ImportPreflightCheckState = {
  id: string;
  severity: "ok" | "warning" | "blocked";
  label: string;
  detail: string;
};

export type ImportPreflightState = {
  status: "ready" | "blocked";
  summary: string;
  checks: ImportPreflightCheckState[];
};

export type ImportDetailState = ImportSummaryState & {
  bundleRef: string;
  workspaceFileRefs: string[];
  preflight: ImportPreflightState;
};

export type ImportComparisonState = {
  importId: string;
  sourceBundleRef: string;
  comparedFileCount: number;
  changedCount: number;
  addedCount: number;
  removedCount: number;
  summary: string;
  files: CheckpointComparisonFileState[];
};

export type IngestSourceEntryInput = {
  kind: "raw" | "canonical";
  sourceRef: string;
  eventTime: string;
  ingestedAt: string;
  preview?: string;
  bodyText?: string;
};

export type IngestSourceEntryResult = {
  collectionId: string;
  collectionRef: string;
  entryId: string;
  entryShardRef: string;
  timeBucket: string;
  entryCount: number;
  blobId?: string;
  createdCollection: boolean;
};

export type ImportBundleState = {
  importId: string;
  importedAt: string;
  sourceBundleRef: string;
  importRef: string;
  workspaceRef: string;
  checkpointRef: string;
  policyId: string;
  sanitized: boolean;
};

export type OperationSummaryState = {
  id: string;
  kind: string;
  scope: "live" | "workspace";
  status: "succeeded";
  summary: string;
  details: string;
  createdAt: string;
  operationRef: string;
  relatedRefs: string[];
};

export type OperationRelatedDocumentState = {
  pathRef: string;
  label: string;
  description: string;
  category: string;
  resolved: boolean;
};

export type OperationDetailState = {
  id: string;
  kind: string;
  scope: "live" | "workspace";
  status: "succeeded";
  summary: string;
  details: string;
  createdAt: string;
  operationRef: string;
  relatedRefs: string[];
  relatedDocuments: OperationRelatedDocumentState[];
  unresolvedRefs: string[];
};

export type LiveSessionState = {
  id: string;
  label: string;
  startedAt: string;
  status: string;
  pathRef: string;
};

export type LiveEvaluationSummaryState = {
  id: string;
  headline: string;
  createdAt: string;
  pathRef: string;
  evidenceRefs: string[];
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
  importsRef: string;
  operationsRef: string;
  sessionsRef: string;
};

export type WorkspaceIndexState = {
  schemaVersion: string;
  active: StrategyActiveIndexState;
  indexes: StrategyIndexesState;
  collectionCount: number;
  operationCount: number;
  sessionCount: number;
};

export type LiveContextState = {
  dashboardRef: string;
  decisionsRef: string;
  memoryRef: string;
  positionsRef: string;
  ordersRef: string;
  memoryNotes: string[];
  sessions: LiveSessionState[];
  evaluationSummaries: LiveEvaluationSummaryState[];
  positionEventCount: number;
  orderEventCount: number;
};

export type ExportInspectorState = {
  policyId: string;
  description: string;
  latestBundle: ExportBundleState | null;
};
