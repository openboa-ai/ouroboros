use tauri::State;

use crate::{
    models::{BootstrapState, ImportBundleState, IngestSourceEntryInput, IngestSourceEntryResult},
    state::AppState,
};

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
pub fn export_checkpoint(
    checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<BootstrapState, String> {
    state.export_checkpoint(&checkpoint_id)
}

#[tauri::command]
pub fn restore_checkpoint(
    checkpoint_id: String,
    state: State<'_, AppState>,
) -> Result<BootstrapState, String> {
    state.restore_checkpoint(&checkpoint_id)
}

#[tauri::command]
pub fn activate_import_as_live(
    import_id: String,
    state: State<'_, AppState>,
) -> Result<BootstrapState, String> {
    state.activate_import_as_live(&import_id)
}

#[tauri::command]
pub fn ingest_source_entry(
    input: IngestSourceEntryInput,
    state: State<'_, AppState>,
) -> Result<IngestSourceEntryResult, String> {
    state.ingest_source_entry(input)
}

#[tauri::command]
pub fn import_export_bundle(
    bundle_ref: String,
    state: State<'_, AppState>,
) -> Result<ImportBundleState, String> {
    state.import_export_bundle(&bundle_ref)
}
