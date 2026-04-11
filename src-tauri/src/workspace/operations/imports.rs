use std::path::Path;

use super::super::policies::imports as import_policies;
use super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn resolve_checkpoint_record_by_ref(
        &self,
        checkpoint_ref: &str,
    ) -> Result<Option<CheckpointRecordFile>, String> {
        let Some(checkpoint_id) = checkpoint_id_from_ref(checkpoint_ref) else {
            return Ok(None);
        };
        let checkpoint_path = self.checkpoint_file_path(&checkpoint_id);
        if !checkpoint_path.exists() {
            return Ok(None);
        }

        self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)
            .map(Some)
    }

    pub(in crate::workspace) fn build_import_preflight(
        &self,
        import_record: &ImportRecordFile,
        import_path: &Path,
        workspace_path: &Path,
    ) -> Result<ImportPreflightState, String> {
        import_policies::build_import_preflight(self, import_record, import_path, workspace_path)
    }
}
