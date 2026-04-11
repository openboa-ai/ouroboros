use super::*;

impl WorkspaceRepository {
    pub fn load_checkpoint_detail(
        &self,
        checkpoint_id: &str,
    ) -> Result<CheckpointDetailState, String> {
        let checkpoint_path = self.checkpoint_file_path(checkpoint_id);
        let checkpoint = self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)?;
        let snapshot_workspace = self.checkpoint_snapshot_path(checkpoint_id);
        let workspace_file_refs = if snapshot_workspace.exists() {
            self.list_display_files(&snapshot_workspace)?
        } else {
            Vec::new()
        };
        let export_bundle = if checkpoint.r#type == "export" {
            self.load_export_bundle_for_checkpoint(&checkpoint)?
        } else {
            None
        };

        Ok(CheckpointDetailState {
            id: checkpoint.checkpoint_id.clone(),
            alias: checkpoint.alias,
            r#type: checkpoint.r#type,
            type_tone: checkpoint.type_tone,
            summary: checkpoint.summary,
            created_at: checkpoint.created_at,
            performance: checkpoint.performance,
            checkpoint_ref: self.display_path(&checkpoint_path),
            snapshot_workspace_ref: self.display_path(&snapshot_workspace),
            workspace_file_refs,
            export_bundle,
        })
    }

    pub fn compare_checkpoints(
        &self,
        base_checkpoint_id: &str,
        target_checkpoint_id: &str,
    ) -> Result<CheckpointComparisonState, String> {
        let base_checkpoint_path = self.checkpoint_file_path(base_checkpoint_id);
        let target_checkpoint_path = self.checkpoint_file_path(target_checkpoint_id);
        let base_checkpoint = self.read_json_path::<CheckpointRecordFile>(&base_checkpoint_path)?;
        let target_checkpoint =
            self.read_json_path::<CheckpointRecordFile>(&target_checkpoint_path)?;
        let base_root = self.checkpoint_snapshot_path(base_checkpoint_id);
        let target_root = self.checkpoint_snapshot_path(target_checkpoint_id);
        let comparison = self.compare_workspace_roots(&base_root, &target_root)?;

        Ok(CheckpointComparisonState {
            base_checkpoint_id: base_checkpoint.checkpoint_id,
            base_alias: base_checkpoint.alias,
            target_checkpoint_id: target_checkpoint.checkpoint_id,
            target_alias: target_checkpoint.alias,
            compared_file_count: comparison.files.len(),
            changed_count: comparison.changed_count,
            added_count: comparison.added_count,
            removed_count: comparison.removed_count,
            summary: format!(
                "{} changed, {} added, {} removed between {} and {}.",
                comparison.changed_count,
                comparison.added_count,
                comparison.removed_count,
                base_checkpoint_id,
                target_checkpoint_id
            ),
            files: comparison.files,
        })
    }
}
