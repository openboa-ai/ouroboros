import { startTransition, useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BootstrapState } from "../lib/service-contract";
import type { ApplyNextStateFn, ApplyNextStateOptions } from "./workspace-controller-types";

type UseWorkspaceSelectionStateParams = {
  setState: Dispatch<SetStateAction<BootstrapState | null>>;
  setLastSyncedAt: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceSelectionState({
  setState,
  setLastSyncedAt
}: UseWorkspaceSelectionStateParams) {
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

  const applyNextState = useCallback<ApplyNextStateFn>(
    (nextState: BootstrapState, options?: ApplyNextStateOptions) => {
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
    },
    [
      selectedCollectionId,
      selectedImportId,
      selectedOperationId,
      setLastSyncedAt,
      setState
    ]
  );

  const openWorkspaceDocument = useCallback((documentId: string, pathRef: string) => {
    setSelectedDocumentId(documentId);
    setSelectedDocumentRef(pathRef);
  }, []);

  return {
    selections: {
      selectedCheckpointId,
      selectedCollectionId,
      selectedImportId,
      selectedOperationId,
      selectedDocumentId,
      selectedBlobId,
      workspaceSearchQuery
    },
    detailRefreshVersion,
    detailResetVersion,
    selectedDocumentRef,
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedImportId,
    setSelectedOperationId,
    setSelectedBlobId,
    setWorkspaceSearchQuery,
    openWorkspaceDocument,
    selectDocument: openWorkspaceDocument,
    applyNextState
  };
}
