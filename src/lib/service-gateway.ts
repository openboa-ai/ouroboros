import { mockWorkspaceService } from "./mock-service";
import type { WorkspaceService } from "./service-contract";
import { tauriWorkspaceService } from "./tauri-service";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const workspaceService: WorkspaceService = isTauriRuntime()
  ? tauriWorkspaceService
  : mockWorkspaceService;
