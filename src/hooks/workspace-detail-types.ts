import type {
  BlobDetailState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportComparisonState,
  ImportDetailState,
  OperationDetailState,
  WorkspaceDocumentState,
  WorkspaceSearchResultState
} from "../lib/service-contract";

export type WorkspaceDetailState = {
  selectedCheckpointDetail: CheckpointDetailState | null;
  selectedCheckpointComparison: CheckpointComparisonState | null;
  selectedCollectionDetail: CollectionDetailState | null;
  selectedImportDetail: ImportDetailState | null;
  selectedImportComparison: ImportComparisonState | null;
  selectedBlobDetail: BlobDetailState | null;
  selectedOperationDetail: OperationDetailState | null;
  selectedDocumentDetail: WorkspaceDocumentState | null;
  workspaceSearchResults: WorkspaceSearchResultState[] | null;
};

export type WorkspaceServiceAlert = {
  scope: string;
  message: string;
};
