use std::sync::Mutex;

use crate::{
    models::{
        BlobDetailState, BootstrapState, CheckpointDetailState, CollectionDetailState,
        WorkspaceDocumentState,
    },
    workspace::WorkspaceRepository,
};

pub struct AppState {
    workspace: Mutex<WorkspaceRepository>,
}

impl AppState {
    pub fn new_default() -> Result<Self, String> {
        let repository = WorkspaceRepository::new(
            WorkspaceRepository::default_root(),
            WorkspaceRepository::default_template_root(),
        )?;
        Ok(Self {
            workspace: Mutex::new(repository),
        })
    }

    pub fn snapshot(&self) -> Result<BootstrapState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .load_bootstrap_state()
    }

    pub fn checkpoint_detail(&self, checkpoint_id: &str) -> Result<CheckpointDetailState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .load_checkpoint_detail(checkpoint_id)
    }

    pub fn collection_detail(&self, collection_id: &str) -> Result<CollectionDetailState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .load_collection_detail(collection_id)
    }

    pub fn blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .load_blob_detail(blob_id)
    }

    pub fn workspace_document(
        &self,
        document_ref: &str,
    ) -> Result<WorkspaceDocumentState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .load_workspace_document(document_ref)
    }

    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .pause_global_automation()
    }

    pub fn flatten_all_positions(&self) -> Result<BootstrapState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .flatten_all_positions()
    }

    pub fn create_export_checkpoint(&self) -> Result<BootstrapState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .create_export_checkpoint()
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        self.workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?
            .restore_checkpoint(checkpoint_id)
    }
}
