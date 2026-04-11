use super::*;
use crate::models::{
    BlobDetailState, BootstrapState, CheckpointComparisonState, CheckpointDetailState,
    CollectionDetailState, ImportComparisonState, ImportDetailState, OperationDetailState,
    WorkspaceDocumentState, WorkspaceSearchResultState,
};

impl AppState {
    pub fn snapshot(&self) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.load_bootstrap_state())
    }

    pub fn checkpoint_detail(&self, checkpoint_id: &str) -> Result<CheckpointDetailState, String> {
        self.with_workspace(|workspace| workspace.load_checkpoint_detail(checkpoint_id))
    }

    pub fn checkpoint_comparison(
        &self,
        base_checkpoint_id: &str,
        target_checkpoint_id: &str,
    ) -> Result<CheckpointComparisonState, String> {
        self.with_workspace(|workspace| {
            workspace.compare_checkpoints(base_checkpoint_id, target_checkpoint_id)
        })
    }

    pub fn collection_detail(&self, collection_id: &str) -> Result<CollectionDetailState, String> {
        self.with_workspace(|workspace| workspace.load_collection_detail(collection_id))
    }

    pub fn import_detail(&self, import_id: &str) -> Result<ImportDetailState, String> {
        self.with_workspace(|workspace| workspace.load_import_detail(import_id))
    }

    pub fn import_comparison(&self, import_id: &str) -> Result<ImportComparisonState, String> {
        self.with_workspace(|workspace| workspace.compare_import(import_id))
    }

    pub fn blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        self.with_workspace(|workspace| workspace.load_blob_detail(blob_id))
    }

    pub fn operation_detail(&self, operation_id: &str) -> Result<OperationDetailState, String> {
        self.with_workspace(|workspace| workspace.load_operation_detail(operation_id))
    }

    pub fn workspace_document(
        &self,
        document_ref: &str,
    ) -> Result<WorkspaceDocumentState, String> {
        self.with_workspace(|workspace| workspace.load_workspace_document(document_ref))
    }

    pub fn search_workspace(&self, query: &str) -> Result<Vec<WorkspaceSearchResultState>, String> {
        self.with_workspace(|workspace| workspace.search_workspace(query))
    }
}
