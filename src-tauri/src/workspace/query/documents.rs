use std::fs;

use super::*;

impl WorkspaceRepository {
    pub fn load_workspace_document(
        &self,
        document_ref: &str,
    ) -> Result<WorkspaceDocumentState, String> {
        let document_path = self.resolve_workspace_document_ref(document_ref)?;
        let content_text = fs::read_to_string(&document_path)
            .map_err(|error| format!("failed to read {}: {error}", document_path.display()))?;
        let bootstrap = self.load_bootstrap_state()?;
        let format = match document_path.extension().and_then(|ext| ext.to_str()) {
            Some("json") => "json",
            Some("ndjson") => "ndjson",
            _ => "text",
        };

        Ok(WorkspaceDocumentState {
            path_ref: self.display_path(&document_path),
            format: format.to_string(),
            byte_length: content_text.as_bytes().len(),
            line_count: content_text.lines().count(),
            content_text,
            backlinks: self.collect_document_backlinks(&document_path, &bootstrap),
        })
    }
}
