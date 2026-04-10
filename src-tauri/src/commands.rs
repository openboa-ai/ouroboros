use tauri::State;

use crate::{
    models::{
        BlobDetailState, BootstrapState, CheckpointDetailState, CollectionDetailState,
        WorkspaceDocumentState,
    },
    state::AppState,
};

#[tauri::command]
pub fn get_bootstrap_state(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    state.snapshot()
}

#[tauri::command]
pub fn get_checkpoint_detail(
    checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<CheckpointDetailState, String> {
    state.checkpoint_detail(&checkpoint_id)
}

#[tauri::command]
pub fn get_collection_detail(
    collection_id: String,
    state: State<'_, AppState>,
) -> Result<CollectionDetailState, String> {
    state.collection_detail(&collection_id)
}

#[tauri::command]
pub fn get_blob_detail(
    blob_id: String,
    state: State<'_, AppState>,
) -> Result<BlobDetailState, String> {
    state.blob_detail(&blob_id)
}

#[tauri::command]
pub fn get_workspace_document(
    document_ref: String,
    state: State<'_, AppState>,
) -> Result<WorkspaceDocumentState, String> {
    state.workspace_document(&document_ref)
}

#[tauri::command]
pub fn pause_global_automation(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    state.pause_global_automation()
}

#[tauri::command]
pub fn flatten_all_positions(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    state.flatten_all_positions()
}

#[tauri::command]
pub fn create_export_checkpoint(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    state.create_export_checkpoint()
}

#[tauri::command]
pub fn restore_checkpoint(
    checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<BootstrapState, String> {
    state.restore_checkpoint(&checkpoint_id)
}
