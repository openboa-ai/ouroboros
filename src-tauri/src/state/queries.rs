use super::*;
use crate::models::{
    BlobDetailState, BootstrapState, CheckpointComparisonState, CheckpointDetailState,
    CollectionDetailState, ImportComparisonState, ImportDetailState, OperationDetailState,
    WorkspaceDocumentState, WorkspaceSearchResultState,
};

impl AppState {
    pub fn snapshot(&self) -> Result<BootstrapState, String> {
        self.application.snapshot()
    }

    pub fn checkpoint_detail(&self, checkpoint_id: &str) -> Result<CheckpointDetailState, String> {
        self.application.checkpoint_detail(checkpoint_id)
    }

    pub fn checkpoint_comparison(
        &self,
        base_checkpoint_id: &str,
        target_checkpoint_id: &str,
    ) -> Result<CheckpointComparisonState, String> {
        self.application
            .checkpoint_comparison(base_checkpoint_id, target_checkpoint_id)
    }

    pub fn collection_detail(&self, collection_id: &str) -> Result<CollectionDetailState, String> {
        self.application.collection_detail(collection_id)
    }

    pub fn import_detail(&self, import_id: &str) -> Result<ImportDetailState, String> {
        self.application.import_detail(import_id)
    }

    pub fn import_comparison(&self, import_id: &str) -> Result<ImportComparisonState, String> {
        self.application.import_comparison(import_id)
    }

    pub fn blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        self.application.blob_detail(blob_id)
    }

    pub fn operation_detail(&self, operation_id: &str) -> Result<OperationDetailState, String> {
        self.application.operation_detail(operation_id)
    }

    pub fn workspace_document(&self, document_ref: &str) -> Result<WorkspaceDocumentState, String> {
        self.application.workspace_document(document_ref)
    }

    pub fn search_workspace(&self, query: &str) -> Result<Vec<WorkspaceSearchResultState>, String> {
        self.application.search_workspace(query)
    }
}
