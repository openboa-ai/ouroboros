use super::*;
use crate::models::{BootstrapState, ImportBundleState, IngestSourceEntryInput, IngestSourceEntryResult};

impl WorkspaceApplication {
    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.pause_global_automation())
    }

    pub fn flatten_all_positions(&self) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.flatten_all_positions())
    }

    pub fn create_export_checkpoint(&self) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.create_export_checkpoint())
    }

    pub fn export_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.export_checkpoint(checkpoint_id))
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.restore_checkpoint(checkpoint_id))
    }

    pub fn activate_import_as_live(&self, import_id: &str) -> Result<BootstrapState, String> {
        self.with_workspace(|workspace| workspace.activate_import_as_live(import_id))
    }

    pub fn ingest_source_entry(
        &self,
        input: IngestSourceEntryInput,
    ) -> Result<IngestSourceEntryResult, String> {
        self.with_workspace(|workspace| workspace.ingest_source_entry(input))
    }

    pub fn import_export_bundle(&self, bundle_ref: &str) -> Result<ImportBundleState, String> {
        self.with_workspace(|workspace| workspace.import_export_bundle(bundle_ref))
    }
}
