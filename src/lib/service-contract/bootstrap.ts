import type {
  DecisionEntry,
  EquityPoint,
  ExposurePoint,
  LaneEventState,
  LiveOrder,
  LivePosition,
  MetricCardData,
  PricePoint,
  ProviderStatus,
  TradingMode,
} from "./common";
import type {
  AssetInspectorState,
  CheckpointSummary,
  CollectionSummaryState,
  ExportInspectorState,
  ImportSummaryState,
  LiveContextState,
  OperationSummaryState,
  WorkspaceCatalogEntry,
  WorkspaceIndexState,
  WorkspaceSummary,
} from "./workspace";

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
  laneEvents: LaneEventState[];
  decisions: DecisionEntry[];
  checkpoints: CheckpointSummary[];
  collections: CollectionSummaryState[];
  imports: ImportSummaryState[];
  operations: OperationSummaryState[];
  documentCatalog: WorkspaceCatalogEntry[];
};
