use super::*;

impl WorkspaceRepository {
    pub fn search_workspace(&self, query: &str) -> Result<Vec<WorkspaceSearchResultState>, String> {
        let normalized = query.trim().to_lowercase();
        if normalized.is_empty() {
            return Ok(Vec::new());
        }

        let bootstrap = self.load_bootstrap_state()?;
        let mut results = Vec::new();

        for document in bootstrap.document_catalog {
            let metadata_haystack = [
                document.label.as_str(),
                document.description.as_str(),
                document.path_ref.as_str(),
                document.category.as_str(),
            ]
            .join(" ")
            .to_lowercase();

            if metadata_haystack.contains(&normalized) {
                results.push(WorkspaceSearchResultState {
                    id: document.id,
                    category: document.category,
                    label: document.label,
                    description: document.description,
                    path_ref: document.path_ref,
                    match_kind: "metadata".into(),
                    excerpt: None,
                });
                continue;
            }

            if let Ok(document_state) = self.load_workspace_document(&document.path_ref) {
                if let Some(excerpt) = search_excerpt(&document_state.content_text, &normalized) {
                    results.push(WorkspaceSearchResultState {
                        id: document.id,
                        category: document.category,
                        label: document.label,
                        description: document.description,
                        path_ref: document.path_ref,
                        match_kind: "content".into(),
                        excerpt: Some(excerpt),
                    });
                }
            }
        }

        results.sort_by(|left, right| {
            search_match_rank(&right.match_kind)
                .cmp(&search_match_rank(&left.match_kind))
                .then_with(|| left.label.cmp(&right.label))
        });
        results.truncate(24);

        Ok(results)
    }
}
