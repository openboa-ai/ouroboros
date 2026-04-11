use super::*;

impl WorkspaceRepository {
    pub fn load_import_detail(&self, import_id: &str) -> Result<ImportDetailState, String> {
        let import_path = self.import_file_path(import_id);
        let import_record = self.read_json_path::<ImportRecordFile>(&import_path)?;
        let import_root = self.import_root_path(import_id);
        let bundle_path = self.resolve_ref(&import_path, &import_record.bundle_ref);
        let workspace_path = self.resolve_ref(&import_path, &import_record.workspace_ref);
        let preflight =
            self.build_import_preflight(&import_record, &import_path, &workspace_path)?;
        let workspace_file_refs = if workspace_path.exists() {
            self.list_display_files(&workspace_path)?
        } else {
            Vec::new()
        };

        Ok(ImportDetailState {
            id: import_record.import_id,
            imported_at: import_record.imported_at,
            source_bundle_ref: import_record.source_bundle_ref,
            import_ref: self.display_path(&import_root.join("import.json")),
            workspace_ref: self.display_path(&workspace_path),
            checkpoint_ref: import_record.checkpoint_ref,
            policy_id: import_record.policy_id,
            sanitized: import_record.sanitized,
            bundle_ref: self.display_path(&bundle_path),
            workspace_file_refs,
            preflight,
        })
    }

    pub fn compare_import(&self, import_id: &str) -> Result<ImportComparisonState, String> {
        let import_path = self.import_file_path(import_id);
        let import_record = self.read_json_path::<ImportRecordFile>(&import_path)?;
        let import_workspace = self.resolve_ref(&import_path, &import_record.workspace_ref);
        let comparison = self.compare_workspace_roots(&self.root, &import_workspace)?;

        Ok(ImportComparisonState {
            import_id: import_record.import_id,
            source_bundle_ref: import_record.source_bundle_ref,
            compared_file_count: comparison.files.len(),
            changed_count: comparison.changed_count,
            added_count: comparison.added_count,
            removed_count: comparison.removed_count,
            summary: format!(
                "{} changed, {} added, {} removed between the current workspace and import {}.",
                comparison.changed_count, comparison.added_count, comparison.removed_count, import_id
            ),
            files: comparison.files,
        })
    }
}
