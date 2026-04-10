import { invoke } from "@tauri-apps/api/core";
import type {
  BlobDetailState,
  BootstrapState,
  CheckpointDetailState,
  CollectionDetailState,
  WorkspaceService
} from "./service-contract";

class TauriWorkspaceService implements WorkspaceService {
  async getBootstrapState(): Promise<BootstrapState> {
    return invoke<BootstrapState>("get_bootstrap_state");
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    return invoke<CheckpointDetailState>("get_checkpoint_detail", { checkpointId });
  }

  async getCollectionDetail(collectionId: string): Promise<CollectionDetailState> {
    return invoke<CollectionDetailState>("get_collection_detail", { collectionId });
  }

  async getBlobDetail(blobId: string): Promise<BlobDetailState> {
    return invoke<BlobDetailState>("get_blob_detail", { blobId });
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
}

export const tauriWorkspaceService = new TauriWorkspaceService();
