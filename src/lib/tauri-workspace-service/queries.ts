import type {
  BlobDetailState,
  BootstrapState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportComparisonState,
  ImportDetailState,
  OperationDetailState,
  WorkspaceDocumentState,
  WorkspaceSearchResultState,
} from "../service-contract";
import { invoke } from "./invoke";

export const tauriQueryTransport = {
  getBootstrapState() {
    return invoke<BootstrapState>("get_bootstrap_state");
  },
  getCheckpointDetail(checkpointId: string) {
    return invoke<CheckpointDetailState>("get_checkpoint_detail", { checkpointId });
  },
  getCheckpointComparison(baseCheckpointId: string, targetCheckpointId: string) {
    return invoke<CheckpointComparisonState>("get_checkpoint_comparison", {
      baseCheckpointId,
      targetCheckpointId,
    });
  },
  getCollectionDetail(collectionId: string) {
    return invoke<CollectionDetailState>("get_collection_detail", { collectionId });
  },
  getImportDetail(importId: string) {
    return invoke<ImportDetailState>("get_import_detail", { importId });
  },
  getImportComparison(importId: string) {
    return invoke<ImportComparisonState>("get_import_comparison", { importId });
  },
  getBlobDetail(blobId: string) {
    return invoke<BlobDetailState>("get_blob_detail", { blobId });
  },
  getOperationDetail(operationId: string) {
    return invoke<OperationDetailState>("get_operation_detail", { operationId });
  },
  getWorkspaceDocument(documentRef: string) {
    return invoke<WorkspaceDocumentState>("get_workspace_document", { documentRef });
  },
  searchWorkspace(query: string) {
    return invoke<WorkspaceSearchResultState[]>("search_workspace", { query });
  },
};
