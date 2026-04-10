mod commands;
mod models;
mod state;
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
            commands::get_collection_detail,
            commands::get_blob_detail,
            commands::get_workspace_document,
            commands::pause_global_automation,
            commands::flatten_all_positions,
            commands::create_export_checkpoint,
            commands::restore_checkpoint
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AutoKairos desktop shell");
}
