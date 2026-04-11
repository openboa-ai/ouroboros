import { startTransition, useEffect, useRef, useState } from "react";
import type { BootstrapState, WorkspaceCatalogEntry } from "../lib/service-contract";
import { workspaceService } from "../lib/service-gateway";
import type { ApplyNextStateOptions } from "./workspace-controller-types";
import { useWorkspaceActions } from "./use-workspace-actions";
import { useWorkspaceDetails } from "./use-workspace-details";

export function useWorkspaceController() {
  const refreshInFlightRef = useRef(false);
  const [state, setState] = useState<BootstrapState | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
  const [detailResetVersion, setDetailResetVersion] = useState(0);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentRef, setSelectedDocumentRef] = useState<string | null>(null);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  function applyNextState(
    nextState: BootstrapState,
    options?: ApplyNextStateOptions
  ) {
    const preserveDetailState = options?.preserveDetailState ?? false;
    const nextCheckpointId =
      options?.selectedCheckpointId ??
      nextState.checkpoints.find(
        (checkpoint) => checkpoint.pathRef === nextState.assetInspector.currentCheckpointRef
      )?.id ??
      nextState.checkpoints[0]?.id ??
      null;
    const nextCollectionId =
      options?.selectedCollectionId ??
      nextState.collections.find((collection) => collection.id === selectedCollectionId)?.id ??
      nextState.collections[0]?.id ??
      null;
    const nextImportId =
      options?.selectedImportId ??
      nextState.imports.find((item) => item.id === selectedImportId)?.id ??
      nextState.imports[0]?.id ??
      null;
    const nextOperationId =
      options?.selectedOperationId ??
      nextState.operations.find((item) => item.id === selectedOperationId)?.id ??
      nextState.operations[0]?.id ??
      null;
    const nextDocumentId = options?.selectedDocumentId ?? "strategy";
    const nextDocumentRef = options?.selectedDocumentRef ?? nextState.assetInspector.strategyRef;
    const collectionChanged = nextCollectionId !== selectedCollectionId;

    startTransition(() => {
      setState(nextState);
      setLastSyncedAt(new Date().toISOString());
      if (preserveDetailState) {
        setDetailRefreshVersion((current) => current + 1);
      } else {
        setDetailResetVersion((current) => current + 1);
      }
      setSelectedCheckpointId(nextCheckpointId);
      setSelectedCollectionId(nextCollectionId);
      setSelectedImportId(nextImportId);
      if (!preserveDetailState || collectionChanged) {
        setSelectedBlobId(null);
      }
      setSelectedOperationId(nextOperationId);
      setSelectedDocumentId(nextDocumentId);
      setSelectedDocumentRef(nextDocumentRef);
    });
  }

  async function loadBootstrapState() {
    setBootstrapError(null);
    try {
      const nextState = await workspaceService.getBootstrapState();
      applyNextState(nextState);
    } catch (error) {
      setBootstrapError(`Failed to boot workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function refreshWorkspace(options?: { silent?: boolean }) {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const nextState = await workspaceService.getBootstrapState();
      setBootstrapError(null);
      applyNextState(nextState, {
        preserveDetailState: true
      });
      if (!options?.silent) {
        setCommandStatus("Workspace refreshed through the service layer.");
      }
    } catch (error) {
      if (!options?.silent) {
        setCommandStatus(
          `Workspace refresh failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      setBootstrapError(
        (current) =>
          current ??
          `Failed to refresh workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      refreshInFlightRef.current = false;
    }
  }

  function openWorkspaceDocument(documentId: string, pathRef: string) {
    setSelectedDocumentId(documentId);
    setSelectedDocumentRef(pathRef);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextState = await workspaceService.getBootstrapState();
        if (cancelled) {
          return;
        }

        setBootstrapError(null);
        applyNextState(nextState);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootstrapError(
          `Failed to boot workspace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshWorkspace({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const { detailState, serviceAlerts } = useWorkspaceDetails({
    state,
    selectedCheckpointId,
    selectedCollectionId,
    selectedImportId,
    selectedBlobId,
    selectedOperationId,
    selectedDocumentRef,
    workspaceSearchQuery,
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
    selections: {
      selectedCheckpointId,
      selectedCollectionId,
      selectedImportId,
      selectedOperationId,
      selectedDocumentId,
      selectedBlobId,
      workspaceSearchQuery
    },
    detailState: {
      ...detailState
    },
    workspaceDocuments: (state?.documentCatalog ?? []) as WorkspaceCatalogEntry[],
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedImportId,
    setSelectedOperationId,
    setSelectedBlobId,
    setWorkspaceSearchQuery,
    loadBootstrapState,
    refreshWorkspace,
    openWorkspaceDocument,
    selectDocument(documentId: string, pathRef: string) {
      setSelectedDocumentId(documentId);
      setSelectedDocumentRef(pathRef);
    },
    ...actions
  };
}
