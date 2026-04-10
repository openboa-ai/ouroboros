use tauri::State;

use crate::{models::BootstrapState, state::AppState};

#[tauri::command]
pub fn get_bootstrap_state(state: State<'_, AppState>) -> Result<BootstrapState, String> {
    state.snapshot()
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
