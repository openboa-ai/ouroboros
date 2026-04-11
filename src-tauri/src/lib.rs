mod commands;
mod models;
mod state;
mod storage;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = state::AppState::new_default()
        .expect("failed to initialize workspace-backed application state");

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::queries::get_bootstrap_state,
            commands::queries::get_checkpoint_detail,
            commands::queries::get_checkpoint_comparison,
            commands::queries::get_collection_detail,
            commands::queries::get_import_detail,
            commands::queries::get_import_comparison,
            commands::queries::get_blob_detail,
            commands::queries::get_operation_detail,
            commands::queries::get_workspace_document,
            commands::queries::search_workspace,
            commands::mutations::pause_global_automation,
            commands::mutations::flatten_all_positions,
            commands::mutations::create_export_checkpoint,
            commands::mutations::export_checkpoint,
            commands::mutations::restore_checkpoint,
            commands::mutations::activate_import_as_live,
            commands::mutations::ingest_source_entry,
            commands::mutations::import_export_bundle
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AutoKairos desktop shell");
}
