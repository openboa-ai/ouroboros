use super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn export_inventory(
        &self,
        checkpoints: &[CheckpointRecordFile],
    ) -> ExportInventory {
        let mut count = 0usize;
        let mut latest_ref = None;

        for checkpoint in checkpoints {
            let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
            if export_path.exists() {
                count += 1;
                if latest_ref.is_none() {
                    latest_ref = Some(self.display_path(&export_path));
                }
            }
        }

        ExportInventory { count, latest_ref }
    }

    pub(in crate::workspace) fn latest_export_bundle(
        &self,
        checkpoints: &[CheckpointRecordFile],
    ) -> Result<Option<ExportBundleState>, String> {
        for checkpoint in checkpoints {
            if let Some(bundle) = self.load_export_bundle_for_checkpoint(checkpoint)? {
                return Ok(Some(bundle));
            }
        }

        Ok(None)
    }

    pub(in crate::workspace) fn load_export_bundle_for_checkpoint(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Result<Option<ExportBundleState>, String> {
        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        if !export_path.exists() {
            return Ok(None);
        }

        let export_bundle = self.read_json_path::<ExportBundleFile>(&export_path)?;
        let workspace_path = self.export_workspace_path(&checkpoint.checkpoint_id);
        let included_refs = if export_bundle.included_refs.is_empty() && workspace_path.exists() {
            self.list_display_files(&workspace_path)?
        } else {
            export_bundle
                .included_refs
                .iter()
                .map(|reference| {
                    let relative = reference
                        .strip_prefix("./workspace/")
                        .or_else(|| reference.strip_prefix("./workspace"))
                        .unwrap_or(reference);
                    self.display_path(&workspace_path.join(relative))
                })
                .collect()
        };

        Ok(Some(ExportBundleState {
            export_id: export_bundle.export_id,
            created_at: export_bundle.created_at,
            policy_id: export_bundle.policy_id,
            checkpoint_ref: self
                .display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
            workspace_ref: self.display_path(&workspace_path),
            bundle_ref: self.display_path(&export_path),
            included_refs,
            excluded_paths: export_bundle.excluded_paths,
            sanitized: export_bundle.sanitized,
        }))
    }

    pub(in crate::workspace) fn export_bundle_display_ref(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Option<String> {
        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        export_path
            .exists()
            .then(|| self.display_path(&export_path))
    }
}
