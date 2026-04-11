use crate::application::WorkspaceApplication;

mod mutations;
mod queries;

pub struct AppState {
    application: WorkspaceApplication,
}

impl AppState {
    pub fn new_default() -> Result<Self, String> {
        Ok(Self {
            application: WorkspaceApplication::new_default()?,
        })
    }
}
