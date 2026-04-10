import { invoke } from "@tauri-apps/api/core";
import type { BootstrapState, WorkspaceService } from "./service-contract";

class TauriWorkspaceService implements WorkspaceService {
  async getBootstrapState(): Promise<BootstrapState> {
    return invoke<BootstrapState>("get_bootstrap_state");
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
