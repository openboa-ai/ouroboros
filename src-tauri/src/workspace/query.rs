use std::fs;

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

    pub fn load_collection_detail(
        &self,
        collection_id: &str,
    ) -> Result<CollectionDetailState, String> {
        let collection_path = self.collection_file_path(collection_id);
        let collection = self.read_json_path::<CollectionRecordFile>(&collection_path)?;
        let entry_shard_path = self.resolve_ref(&collection_path, &collection.entry_shard_ref);
        let entries = self.read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?;

        Ok(CollectionDetailState {
            id: collection.collection_id.clone(),
            kind: collection.kind,
            source_ref: collection.source_ref,
            time_bucket: collection.time_bucket,
            time_range_label: format!("{} -> {}", collection.time_range.start, collection.time_range.end),
            entry_count: collection.entry_count,
            content_hash: collection.content_hash,
            collection_ref: self.display_path(&collection_path),
            entry_shard_ref: self.display_path(&entry_shard_path),
            notes: collection.notes,
            entries: entries
                .into_iter()
                .map(|entry| CollectionEntryState {
                    id: entry.entry_id.clone(),
                    source_ref: entry.source_ref,
                    event_time: entry.event_time,
                    ingested_at: entry.ingested_at,
                    content_hash: entry.content_hash,
                    preview: entry.preview,
                    entry_path_ref: self.display_path(&self.collection_entry_document_path(
                        &collection.collection_id,
                        &entry.entry_id,
                    )),
                    blob_ref: entry.blob_ref.clone(),
                    blob_path_ref: entry
                        .blob_ref
                        .as_ref()
                        .map(|blob_ref| self.display_path(&self.blob_path(blob_ref))),
                })
                .collect(),
        })
    }

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

    pub fn load_blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        let blob_path = self.blob_path(blob_id);
        let content_text = fs::read_to_string(&blob_path)
            .map_err(|error| format!("failed to read {}: {error}", blob_path.display()))?;

        Ok(BlobDetailState {
            id: blob_id.to_string(),
            blob_path_ref: self.display_path(&blob_path),
            byte_length: content_text.as_bytes().len(),
            line_count: content_text.lines().count(),
            content_text,
        })
    }

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
