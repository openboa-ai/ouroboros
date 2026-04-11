import type {
  BootstrapState,
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
  WorkspaceService
} from "../service-contract";
import { MockWorkspaceContext } from "./context";
import {
  activateImportAsLive,
  createExportCheckpoint,
  exportCheckpoint,
  flattenAllPositions,
  importExportBundle,
  ingestSourceEntry,
  pauseGlobalAutomation,
  restoreCheckpoint
} from "./mutations";
import {
  getBlobDetail,
  getCheckpointComparison,
  getCheckpointDetail,
  getCollectionDetail,
  getImportComparison,
  getImportDetail,
  getOperationDetail,
  getWorkspaceDocument,
  searchWorkspace
} from "./queries";

export class MockWorkspaceService implements WorkspaceService {
  private readonly context = new MockWorkspaceContext();

  async getBootstrapState(): Promise<BootstrapState> {
    return this.context.snapshot();
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    return getCheckpointDetail(this.context, checkpointId);
  }

  async getCheckpointComparison(
    baseCheckpointId: string,
    targetCheckpointId: string
  ): Promise<CheckpointComparisonState> {
    return getCheckpointComparison(this.context, baseCheckpointId, targetCheckpointId);
  }

  async getCollectionDetail(collectionId: string): Promise<CollectionDetailState> {
    return getCollectionDetail(this.context, collectionId);
  }

  async getImportDetail(importId: string): Promise<ImportDetailState> {
    return getImportDetail(this.context, importId);
  }

  async getImportComparison(importId: string): Promise<ImportComparisonState> {
    return getImportComparison(this.context, importId);
  }

  async getBlobDetail(blobId: string) {
    return getBlobDetail(this.context, blobId);
  }

  async getOperationDetail(operationId: string): Promise<OperationDetailState> {
    return getOperationDetail(this.context, operationId);
  }

  async getWorkspaceDocument(documentRef: string): Promise<WorkspaceDocumentState> {
    return getWorkspaceDocument(this.context, documentRef);
  }

  async searchWorkspace(query: string): Promise<WorkspaceSearchResultState[]> {
    return searchWorkspace(this.context, query);
  }

  async pauseGlobalAutomation(): Promise<BootstrapState> {
    return pauseGlobalAutomation(this.context);
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    return flattenAllPositions(this.context);
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    return createExportCheckpoint(this.context);
  }

  async exportCheckpoint(checkpointId: string): Promise<BootstrapState> {
    return exportCheckpoint(this.context, checkpointId);
  }

  async restoreCheckpoint(checkpointId: string): Promise<BootstrapState> {
    return restoreCheckpoint(this.context, checkpointId);
  }

  async activateImportAsLive(importId: string): Promise<BootstrapState> {
    return activateImportAsLive(this.context, importId);
  }

  async ingestSourceEntry(input: IngestSourceEntryInput): Promise<IngestSourceEntryResult> {
    return ingestSourceEntry(this.context, input);
  }

  async importExportBundle(bundleRef: string): Promise<ImportBundleState> {
    return importExportBundle(this.context, bundleRef);
  }
}

export const mockWorkspaceService = new MockWorkspaceService();
