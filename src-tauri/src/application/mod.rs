use std::sync::Mutex;

use crate::workspace::WorkspaceRepository;

mod mutations;
mod queries;

pub struct WorkspaceApplication {
    workspace: Mutex<WorkspaceRepository>,
}

impl WorkspaceApplication {
    pub fn new_default() -> Result<Self, String> {
        let repository = WorkspaceRepository::new(
            WorkspaceRepository::default_root(),
            WorkspaceRepository::default_template_root(),
        )?;
        Ok(Self {
            workspace: Mutex::new(repository),
        })
    }

    fn with_workspace<T>(
        &self,
        operation: impl FnOnce(&WorkspaceRepository) -> Result<T, String>,
    ) -> Result<T, String> {
        let workspace = self
            .workspace
            .lock()
            .map_err(|_| "workspace lock poisoned".to_string())?;
        operation(&workspace)
    }
}
