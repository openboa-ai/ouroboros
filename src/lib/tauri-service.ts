import { invoke } from "@tauri-apps/api/core";
import type { BootstrapState, CheckpointDetailState, WorkspaceService } from "./service-contract";

class TauriWorkspaceService implements WorkspaceService {
  async getBootstrapState(): Promise<BootstrapState> {
    return invoke<BootstrapState>("get_bootstrap_state");
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    return invoke<CheckpointDetailState>("get_checkpoint_detail", { checkpointId });
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
