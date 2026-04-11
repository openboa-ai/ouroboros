import type {
  AutomationStatus,
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
  RuntimeTopologyState,
  WorkspaceCatalogEntry,
  WorkspaceIndexState,
  WorkspaceSummary,
} from "./workspace";

export type BootstrapState = {
  mode: TradingMode;
  automationStatus: AutomationStatus;
  statusNote?: string;
  workspace: WorkspaceSummary;
  assetInspector: AssetInspectorState;
  workspaceIndex: WorkspaceIndexState;
  runtimeTopology: RuntimeTopologyState;
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
