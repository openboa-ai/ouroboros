import { invoke } from "@tauri-apps/api/core";
import type {
  BlobDetailState,
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
} from "./service-contract";

class TauriWorkspaceService implements WorkspaceService {
  async getBootstrapState(): Promise<BootstrapState> {
    return invoke<BootstrapState>("get_bootstrap_state");
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    return invoke<CheckpointDetailState>("get_checkpoint_detail", { checkpointId });
  }

  async getCheckpointComparison(
    baseCheckpointId: string,
    targetCheckpointId: string
  ): Promise<CheckpointComparisonState> {
    return invoke<CheckpointComparisonState>("get_checkpoint_comparison", {
      baseCheckpointId,
      targetCheckpointId
    });
  }

  async getCollectionDetail(collectionId: string): Promise<CollectionDetailState> {
    return invoke<CollectionDetailState>("get_collection_detail", { collectionId });
  }

  async getImportDetail(importId: string): Promise<ImportDetailState> {
    return invoke<ImportDetailState>("get_import_detail", { importId });
  }

  async getImportComparison(importId: string): Promise<ImportComparisonState> {
    return invoke<ImportComparisonState>("get_import_comparison", { importId });
  }

  async getBlobDetail(blobId: string): Promise<BlobDetailState> {
    return invoke<BlobDetailState>("get_blob_detail", { blobId });
  }

  async getOperationDetail(operationId: string): Promise<OperationDetailState> {
    return invoke<OperationDetailState>("get_operation_detail", { operationId });
  }

  async getWorkspaceDocument(documentRef: string): Promise<WorkspaceDocumentState> {
    return invoke<WorkspaceDocumentState>("get_workspace_document", { documentRef });
  }

  async searchWorkspace(query: string): Promise<WorkspaceSearchResultState[]> {
    return invoke<WorkspaceSearchResultState[]>("search_workspace", { query });
  }

  async pauseGlobalAutomation(): Promise<BootstrapState> {
    return invoke<BootstrapState>("pause_global_automation");
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    return invoke<BootstrapState>("flatten_all_positions");
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    return invoke<BootstrapState>("create_export_checkpoint");
  }

  async restoreCheckpoint(checkpointId: string): Promise<BootstrapState> {
    return invoke<BootstrapState>("restore_checkpoint", { checkpointId });
  }

  async activateImportAsLive(importId: string): Promise<BootstrapState> {
    return invoke<BootstrapState>("activate_import_as_live", { importId });
  }

  async ingestSourceEntry(input: IngestSourceEntryInput): Promise<IngestSourceEntryResult> {
    return invoke<IngestSourceEntryResult>("ingest_source_entry", { input });
  }

  async importExportBundle(bundleRef: string): Promise<ImportBundleState> {
    return invoke<ImportBundleState>("import_export_bundle", { bundleRef });
  }
}

export const tauriWorkspaceService = new TauriWorkspaceService();
