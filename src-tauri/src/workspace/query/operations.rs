use super::*;

impl WorkspaceRepository {
    pub fn load_operation_detail(
        &self,
        operation_id: &str,
    ) -> Result<OperationDetailState, String> {
        let operation_path = self.operation_file_path(operation_id);
        let operation = self.read_json_path::<OperationRecordFile>(&operation_path)?;
        let bootstrap = self.load_bootstrap_state()?;
        let related_refs = operation
            .related_refs
            .iter()
            .map(|reference| self.display_path(&self.root.join(reference)))
            .collect::<Vec<_>>();
        let mut related_documents = Vec::new();
        let mut unresolved_refs = Vec::new();

        for path_ref in &related_refs {
            if let Some(document) = bootstrap
                .document_catalog
                .iter()
                .find(|item| item.path_ref == *path_ref)
            {
                related_documents.push(OperationRelatedDocumentState {
                    path_ref: document.path_ref.clone(),
                    label: document.label.clone(),
                    description: document.description.clone(),
                    category: document.category.clone(),
                    resolved: true,
                });
            } else {
                unresolved_refs.push(path_ref.clone());
                related_documents.push(OperationRelatedDocumentState {
                    path_ref: path_ref.clone(),
                    label: path_leaf_label(path_ref),
                    description:
                        "Workspace reference captured by the service layer but not indexed in the current document catalog."
                            .into(),
                    category: "reference".into(),
                    resolved: false,
                });
            }
        }

        Ok(OperationDetailState {
            id: operation.operation_id,
            kind: operation.kind,
            scope: operation.scope,
            status: operation.status,
            summary: operation.summary,
            details: operation.details,
            created_at: operation.created_at,
            operation_ref: self.display_path(&operation_path),
            related_refs,
            related_documents,
            unresolved_refs,
        })
    }
}
