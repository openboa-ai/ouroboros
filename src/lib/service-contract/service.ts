import type { BootstrapState } from "./bootstrap";
import type {
  BlobDetailState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportBundleState,
  ImportComparisonState,
  ImportDetailState,
  IngestSourceEntryInput,
  IngestSourceEntryResult,
  OperationDetailState,
  WorkspaceDocumentState,
  WorkspaceSearchResultState,
} from "./workspace";

export interface WorkspaceService {
  getBootstrapState(): Promise<BootstrapState>;
  getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState>;
  getCheckpointComparison(
    baseCheckpointId: string,
    targetCheckpointId: string
  ): Promise<CheckpointComparisonState>;
  getCollectionDetail(collectionId: string): Promise<CollectionDetailState>;
  getImportDetail(importId: string): Promise<ImportDetailState>;
  getImportComparison(importId: string): Promise<ImportComparisonState>;
  getBlobDetail(blobId: string): Promise<BlobDetailState>;
  getOperationDetail(operationId: string): Promise<OperationDetailState>;
  getWorkspaceDocument(documentRef: string): Promise<WorkspaceDocumentState>;
  searchWorkspace(query: string): Promise<WorkspaceSearchResultState[]>;
  pauseGlobalAutomation(): Promise<BootstrapState>;
  flattenAllPositions(): Promise<BootstrapState>;
  createExportCheckpoint(): Promise<BootstrapState>;
  exportCheckpoint(checkpointId: string): Promise<BootstrapState>;
  restoreCheckpoint(checkpointId: string): Promise<BootstrapState>;
  activateImportAsLive(importId: string): Promise<BootstrapState>;
  ingestSourceEntry(input: IngestSourceEntryInput): Promise<IngestSourceEntryResult>;
  importExportBundle(bundleRef: string): Promise<ImportBundleState>;
}
