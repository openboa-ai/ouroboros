import { useState } from "react";
import type { BootstrapState, WorkspaceCatalogEntry } from "../lib/service-contract";
import { useWorkspaceActions } from "./use-workspace-actions";
import { useWorkspaceBootstrap } from "./use-workspace-bootstrap";
import { useWorkspaceDetails } from "./use-workspace-details";
import { useWorkspaceSelectionState } from "./use-workspace-selection-state";

export function useWorkspaceController() {
  const [state, setState] = useState<BootstrapState | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  const {
    selections,
    detailRefreshVersion,
    detailResetVersion,
    selectedDocumentRef,
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedEvaluationRunId,
    setSelectedImportId,
    setSelectedOperationId,
    setSelectedBlobId,
    setWorkspaceSearchQuery,
    openWorkspaceDocument,
    selectDocument,
    applyNextState
  } = useWorkspaceSelectionState({
    setState,
    setLastSyncedAt
  });

  const { loadBootstrapState, refreshWorkspace } = useWorkspaceBootstrap({
    applyNextState,
    setBootstrapError,
    setCommandStatus
  });

  const { detailState, serviceAlerts } = useWorkspaceDetails({
    state,
    selectedCheckpointId: selections.selectedCheckpointId,
    selectedCollectionId: selections.selectedCollectionId,
    selectedEvaluationRunId: selections.selectedEvaluationRunId,
    selectedImportId: selections.selectedImportId,
    selectedBlobId: selections.selectedBlobId,
    selectedOperationId: selections.selectedOperationId,
    selectedDocumentRef,
    workspaceSearchQuery: selections.workspaceSearchQuery,
    detailRefreshVersion,
    detailResetVersion,
    setSelectedBlobId
  });

  const actions = useWorkspaceActions({
    state,
    setCommandStatus,
    applyNextState
  });

  return {
    state,
    bootstrapError,
    commandStatus,
    lastSyncedAt,
    serviceAlerts,
    selections,
    detailState: {
      ...detailState
    },
    workspaceDocuments: (state?.documentCatalog ?? []) as WorkspaceCatalogEntry[],
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedEvaluationRunId,
    setSelectedImportId,
    setSelectedOperationId,
    setSelectedBlobId,
    setWorkspaceSearchQuery,
    loadBootstrapState,
    refreshWorkspace,
    openWorkspaceDocument,
    selectDocument,
    ...actions
  };
}

export type WorkspaceControllerViewModel = ReturnType<typeof useWorkspaceController>;
