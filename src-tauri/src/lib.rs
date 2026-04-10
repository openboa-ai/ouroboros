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
            commands::get_bootstrap_state,
            commands::get_checkpoint_detail,
            commands::get_checkpoint_comparison,
            commands::get_collection_detail,
            commands::get_import_detail,
            commands::get_import_comparison,
            commands::get_blob_detail,
            commands::get_operation_detail,
            commands::get_workspace_document,
            commands::search_workspace,
            commands::pause_global_automation,
            commands::flatten_all_positions,
            commands::create_export_checkpoint,
            commands::restore_checkpoint,
            commands::activate_import_as_live,
            commands::ingest_source_entry,
            commands::import_export_bundle
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AutoKairos desktop shell");
}
