import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo } from "react";
import type {
  BootstrapState,
  CollectionDetailState,
  EvaluationRunDetailState
} from "../lib/service-contract";
import { workspaceService } from "../lib/service-gateway";
import { useServiceResource } from "./use-service-resource";
import type { WorkspaceDetailState, WorkspaceServiceAlert } from "./workspace-detail-types";

type UseWorkspaceDetailsParams = {
  state: BootstrapState | null;
  selectedCheckpointId: string | null;
  selectedCollectionId: string | null;
  selectedEvaluationRunId: string | null;
  selectedImportId: string | null;
  selectedBlobId: string | null;
  selectedOperationId: string | null;
  selectedDocumentRef: string | null;
  workspaceSearchQuery: string;
  detailRefreshVersion: number;
  detailResetVersion: number;
  setSelectedBlobId: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceDetails({
  state,
  selectedCheckpointId,
  selectedCollectionId,
  selectedEvaluationRunId,
  selectedImportId,
  selectedBlobId,
  selectedOperationId,
  selectedDocumentRef,
  workspaceSearchQuery,
  detailRefreshVersion,
  detailResetVersion,
  setSelectedBlobId
}: UseWorkspaceDetailsParams) {
  const resetSeed = detailResetVersion;
  const currentCheckpoint =
    state?.checkpoints.find(
      (checkpoint) => checkpoint.pathRef === state.workspaceIndex.active.currentCheckpointRef
    ) ?? state?.checkpoints[0] ?? null;

  const checkpointDetail = useServiceResource({
    enabled: Boolean(selectedCheckpointId),
    loader: () => workspaceService.getCheckpointDetail(selectedCheckpointId as string),
    deps: [selectedCheckpointId, detailRefreshVersion, resetSeed]
  });

  const checkpointComparison = useServiceResource({
    enabled:
      Boolean(currentCheckpoint) &&
      Boolean(selectedCheckpointId) &&
      currentCheckpoint?.id !== selectedCheckpointId,
    loader: () =>
      workspaceService.getCheckpointComparison(currentCheckpoint!.id, selectedCheckpointId as string),
    deps: [currentCheckpoint?.id, selectedCheckpointId, detailRefreshVersion, resetSeed]
  });

  const collectionDetail = useServiceResource<CollectionDetailState>({
    enabled: Boolean(selectedCollectionId),
    loader: () => workspaceService.getCollectionDetail(selectedCollectionId as string),
    deps: [selectedCollectionId, detailRefreshVersion, resetSeed]
  });

  const evaluationRunDetail = useServiceResource<EvaluationRunDetailState>({
    enabled: Boolean(selectedEvaluationRunId),
    loader: () => workspaceService.getEvaluationRunDetail(selectedEvaluationRunId as string),
    deps: [selectedEvaluationRunId, detailRefreshVersion, resetSeed]
  });

  const importDetail = useServiceResource({
    enabled: Boolean(selectedImportId),
    loader: () => workspaceService.getImportDetail(selectedImportId as string),
    deps: [selectedImportId, detailRefreshVersion, resetSeed]
  });

  const importComparison = useServiceResource({
    enabled: Boolean(selectedImportId),
    loader: () => workspaceService.getImportComparison(selectedImportId as string),
    deps: [selectedImportId, detailRefreshVersion, resetSeed]
  });

  useEffect(() => {
    const nextBlobId = collectionDetail.value?.entries.find((entry) => entry.blobRef)?.blobRef ?? null;
    setSelectedBlobId((current) => (current === nextBlobId ? current : nextBlobId));
  }, [collectionDetail.value, setSelectedBlobId]);

  const blobDetail = useServiceResource({
    enabled: Boolean(selectedBlobId),
    loader: () => workspaceService.getBlobDetail(selectedBlobId as string),
    deps: [selectedBlobId, detailRefreshVersion, resetSeed]
  });

  const operationDetail = useServiceResource({
    enabled: Boolean(selectedOperationId),
    loader: () => workspaceService.getOperationDetail(selectedOperationId as string),
    deps: [selectedOperationId, detailRefreshVersion, resetSeed]
  });

  const documentDetail = useServiceResource({
    enabled: Boolean(selectedDocumentRef),
    loader: () => workspaceService.getWorkspaceDocument(selectedDocumentRef as string),
    deps: [selectedDocumentRef, detailRefreshVersion, resetSeed]
  });

  const normalizedSearchQuery = workspaceSearchQuery.trim();
  const workspaceSearch = useServiceResource({
    enabled: normalizedSearchQuery.length > 0,
    loader: () => workspaceService.searchWorkspace(normalizedSearchQuery),
    deps: [normalizedSearchQuery, detailRefreshVersion, resetSeed]
  });

  const serviceAlerts = useMemo<WorkspaceServiceAlert[]>(
    () => {
      const alertEntries: Array<[string, string | null]> = [
        ["checkpoint", checkpointDetail.error],
        ["checkpointComparison", checkpointComparison.error],
        ["collection", collectionDetail.error],
        ["evaluation", evaluationRunDetail.error],
        ["import", importDetail.error],
        ["importComparison", importComparison.error],
        ["blob", blobDetail.error],
        ["operation", operationDetail.error],
        ["document", documentDetail.error],
        ["search", workspaceSearch.error]
      ];

      return alertEntries
        .filter(([, message]) => Boolean(message))
        .map(([scope, message]) => ({
          scope,
          message: message as string
        }));
    },
    [
      checkpointDetail.error,
      checkpointComparison.error,
      collectionDetail.error,
      evaluationRunDetail.error,
      importDetail.error,
      importComparison.error,
      blobDetail.error,
      operationDetail.error,
      documentDetail.error,
      workspaceSearch.error
    ]
  );

  const detailState: WorkspaceDetailState = useMemo(
    () => ({
      selectedCheckpointDetail: checkpointDetail.value,
      selectedCheckpointComparison: checkpointComparison.value,
      selectedCollectionDetail: collectionDetail.value,
      selectedEvaluationRunDetail: evaluationRunDetail.value,
      selectedImportDetail: importDetail.value,
      selectedImportComparison: importComparison.value,
      selectedBlobDetail: blobDetail.value,
      selectedOperationDetail: operationDetail.value,
      selectedDocumentDetail: documentDetail.value,
      workspaceSearchResults: workspaceSearch.value
    }),
    [
      checkpointDetail.value,
      checkpointComparison.value,
      collectionDetail.value,
      evaluationRunDetail.value,
      importDetail.value,
      importComparison.value,
      blobDetail.value,
      operationDetail.value,
      documentDetail.value,
      workspaceSearch.value
    ]
  );

  return {
    detailState,
    serviceAlerts
  };
}
