use super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn append_operation(
        &self,
        kind: &str,
        scope: &str,
        summary: String,
        details: String,
        related_refs: Vec<String>,
    ) -> Result<OperationRecordFile, String> {
        let operation = OperationRecordFile {
            operation_id: uuid_v7_string(),
            kind: kind.into(),
            scope: scope.into(),
            status: "succeeded".into(),
            summary,
            details,
            created_at: now_label(),
            related_refs: related_refs
                .into_iter()
                .map(|reference| {
                    reference
                        .strip_prefix(&format!("{}/", self.display_path(&self.root)))
                        .map(str::to_string)
                        .unwrap_or(reference)
                })
                .collect(),
        };

        self.write_json_path(&self.operation_file_path(&operation.operation_id), &operation)?;

        let mut index = if self.operations_index_path().exists() {
            self.read_json_path::<OperationsIndexFile>(&self.operations_index_path())?
        } else {
            OperationsIndexFile { items: Vec::new() }
        };
        index.items.insert(0, operation.clone());
        self.write_json_path(&self.operations_index_path(), &index)?;

        Ok(operation)
    }
}
