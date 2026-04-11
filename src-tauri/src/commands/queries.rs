use tauri::State;

use crate::{
    models::{
        BlobDetailState, BootstrapState, CheckpointComparisonState, CheckpointDetailState,
        CollectionDetailState, ImportComparisonState, ImportDetailState, OperationDetailState,
        WorkspaceDocumentState, WorkspaceSearchResultState,
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
pub fn get_checkpoint_comparison(
    base_checkpoint_id: String,
    target_checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<CheckpointComparisonState, String> {
    state.checkpoint_comparison(&base_checkpoint_id, &target_checkpoint_id)
}

#[tauri::command]
pub fn get_collection_detail(
    collection_id: String,
    state: State<'_, AppState>,
) -> Result<CollectionDetailState, String> {
    state.collection_detail(&collection_id)
}

#[tauri::command]
pub fn get_import_detail(
    import_id: String,
    state: State<'_, AppState>,
) -> Result<ImportDetailState, String> {
    state.import_detail(&import_id)
}

#[tauri::command]
pub fn get_import_comparison(
    import_id: String,
    state: State<'_, AppState>,
) -> Result<ImportComparisonState, String> {
    state.import_comparison(&import_id)
}

#[tauri::command]
pub fn get_blob_detail(
    blob_id: String,
    state: State<'_, AppState>,
) -> Result<BlobDetailState, String> {
    state.blob_detail(&blob_id)
}

#[tauri::command]
pub fn get_operation_detail(
    operation_id: String,
    state: State<'_, AppState>,
) -> Result<OperationDetailState, String> {
    state.operation_detail(&operation_id)
}

#[tauri::command]
pub fn get_workspace_document(
    document_ref: String,
    state: State<'_, AppState>,
) -> Result<WorkspaceDocumentState, String> {
    state.workspace_document(&document_ref)
}

#[tauri::command]
pub fn search_workspace(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<WorkspaceSearchResultState>, String> {
    state.search_workspace(&query)
}
