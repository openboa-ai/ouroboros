use std::collections::BTreeSet;
use std::path::Path;

use super::super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn collect_document_backlinks(
        &self,
        document_path: &Path,
        bootstrap: &BootstrapState,
    ) -> Vec<WorkspaceDocumentBacklinkState> {
        let target_ref = self.display_path(document_path);
        let target_path = canonicalize_or_clone(document_path);
        let mut seen = BTreeSet::new();
        let mut backlinks = Vec::new();

        let mut push_backlink =
            |label: String, path_ref: String, category: String, reason: String| {
                let key = format!("{path_ref}|{reason}");
                if seen.insert(key) {
                    backlinks.push(WorkspaceDocumentBacklinkState {
                        label,
                        path_ref,
                        category,
                        reason,
                    });
                }
            };

        if self.document_ref_matches_target(
            &bootstrap.workspace_index.active.orchestrator_ref,
            &target_ref,
            &target_path,
        ) {
            push_backlink(
                "strategy.json".into(),
                bootstrap.asset_inspector.strategy_ref.clone(),
                "entrypoint".into(),
                "active.orchestrator_ref".into(),
            );
        }
        if self.document_ref_matches_target(
            &bootstrap.asset_inspector.live_lane_ref,
            &target_ref,
            &target_path,
        ) {
            push_backlink(
                "strategy.json".into(),
                bootstrap.asset_inspector.strategy_ref.clone(),
                "entrypoint".into(),
                "active.live_lane_ref".into(),
            );
        }
        for (path_ref, reason) in [
            (
                &bootstrap.live_context.runtime_status_ref,
                "state_refs.runtime_status_ref",
            ),
            (
                &bootstrap.live_context.dashboard_ref,
                "state_refs.dashboard_ref",
            ),
            (
                &bootstrap.live_context.decisions_ref,
                "state_refs.decisions_ref",
            ),
            (&bootstrap.live_context.memory_ref, "state_refs.memory_ref"),
            (
                &bootstrap.live_context.positions_ref,
                "state_refs.positions_ref",
            ),
            (&bootstrap.live_context.orders_ref, "state_refs.orders_ref"),
        ] {
            if self.document_ref_matches_target(path_ref, &target_ref, &target_path) {
                push_backlink(
                    "live lane".into(),
                    bootstrap.asset_inspector.live_lane_ref.clone(),
                    "active".into(),
                    reason.into(),
                );
            }
        }
        if self.document_ref_matches_target(
            &bootstrap.asset_inspector.current_checkpoint_ref,
            &target_ref,
            &target_path,
        ) {
            push_backlink(
                "strategy.json".into(),
                bootstrap.asset_inspector.strategy_ref.clone(),
                "entrypoint".into(),
                "active.current_checkpoint_ref".into(),
            );
        }
        if self.document_ref_matches_target(
            &bootstrap.asset_inspector.export_policy_ref,
            &target_ref,
            &target_path,
        ) {
            push_backlink(
                "strategy.json".into(),
                bootstrap.asset_inspector.strategy_ref.clone(),
                "entrypoint".into(),
                "active.export_policy_ref".into(),
            );
        }

        let index_refs = [
            (
                bootstrap.workspace_index.indexes.checkpoints_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.checkpoints_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.agents_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.agents_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.environments_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.environments_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.adapters_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.adapters_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.collections_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.collections_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.evaluations_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.evaluations_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.imports_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.imports_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.operations_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.operations_ref".to_string(),
            ),
            (
                bootstrap.workspace_index.indexes.sessions_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.sessions_ref".to_string(),
            ),
        ];
        for (path_ref, label, category, reason) in index_refs {
            if self.document_ref_matches_target(&path_ref, &target_ref, &target_path) {
                push_backlink(
                    label,
                    bootstrap.asset_inspector.strategy_ref.clone(),
                    category,
                    reason,
                );
            }
        }

        for session in &bootstrap.live_context.sessions {
            if self.document_ref_matches_target(&session.path_ref, &target_ref, &target_path) {
                push_backlink(
                    "sessions index".into(),
                    bootstrap.workspace_index.indexes.sessions_ref.clone(),
                    "index".into(),
                    "session catalog entry".into(),
                );
            }
        }

        for document in &bootstrap.document_catalog {
            if document.category == "agent"
                && self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path)
            {
                push_backlink(
                    "agents index".into(),
                    bootstrap.workspace_index.indexes.agents_ref.clone(),
                    "index".into(),
                    "agent catalog entry".into(),
                );
            }
            if document.category == "environment"
                && self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path)
            {
                push_backlink(
                    "environments index".into(),
                    bootstrap.workspace_index.indexes.environments_ref.clone(),
                    "index".into(),
                    "environment catalog entry".into(),
                );
            }
            if document.category == "adapter"
                && self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path)
            {
                push_backlink(
                    "adapters index".into(),
                    bootstrap.workspace_index.indexes.adapters_ref.clone(),
                    "index".into(),
                    "adapter catalog entry".into(),
                );
            }
            if document.id.starts_with("evaluation-run-")
                && self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path)
            {
                push_backlink(
                    "evaluations index".into(),
                    bootstrap.workspace_index.indexes.evaluations_ref.clone(),
                    "index".into(),
                    "evaluation run catalog entry".into(),
                );
            }
        }

        if bootstrap
            .live_context
            .evaluation_summaries
            .iter()
            .any(|summary| {
                self.document_ref_matches_target(&summary.path_ref, &target_ref, &target_path)
            })
        {
            push_backlink(
                "eval summaries".into(),
                format!(
                    "{}/state/eval-summaries.json",
                    self.display_path(&self.root)
                ),
                "index".into(),
                "evaluation summary entry".into(),
            );
        }

        for operation in &bootstrap.operations {
            if self.document_ref_matches_target(&operation.operation_ref, &target_ref, &target_path)
            {
                push_backlink(
                    "operations index".into(),
                    bootstrap.workspace_index.indexes.operations_ref.clone(),
                    "index".into(),
                    "operation catalog entry".into(),
                );
            }
            if operation.related_refs.iter().any(|reference| {
                self.document_ref_matches_target(reference, &target_ref, &target_path)
            }) {
                push_backlink(
                    format!("{} · {}", operation.kind, operation.created_at),
                    operation.operation_ref.clone(),
                    "operation".into(),
                    "operation related ref".into(),
                );
            }
        }

        if let Ok(collections_index) =
            self.read_json_path::<CollectionsIndexFile>(&self.root.join("indexes/collections.json"))
        {
            for collection in &collections_index.items {
                let collection_path = self.resolve_ref(
                    &self.root.join("indexes/collections.json"),
                    &collection.path_ref,
                );
                let Ok(collection_record) =
                    self.read_json_path::<CollectionRecordFile>(&collection_path)
                else {
                    continue;
                };
                let entry_shard_path =
                    self.resolve_ref(&collection_path, &collection_record.entry_shard_ref);
                let Ok(entries) = self.read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)
                else {
                    continue;
                };

                for entry in entries {
                    let entry_document_path = self
                        .collection_entry_document_path(&collection.collection_id, &entry.entry_id);
                    if paths_match(&entry_document_path, &target_path) {
                        push_backlink(
                            format!("{} · {}", collection.source_ref, collection.time_bucket),
                            self.display_path(&collection_path),
                            "collection".into(),
                            "collection manifest owns entry document".into(),
                        );
                        push_backlink(
                            format!("{} entry shard", collection.source_ref),
                            self.display_path(&entry_shard_path),
                            "collection".into(),
                            "entry shard materializes entry document".into(),
                        );
                    }

                    let Some(blob_ref) = entry.blob_ref else {
                        continue;
                    };
                    let blob_path = self.blob_path(&blob_ref);
                    if !paths_match(&blob_path, &target_path) {
                        continue;
                    }

                    push_backlink(
                        format!("{} · {}", collection.source_ref, collection.time_bucket),
                        self.display_path(&collection_path),
                        "collection".into(),
                        "collection manifest references blob".into(),
                    );
                    push_backlink(
                        format!("{} entry shard", collection.source_ref),
                        self.display_path(&entry_shard_path),
                        "collection".into(),
                        "entry shard references blob".into(),
                    );
                    push_backlink(
                        format!("{} entry {}", collection.source_ref, entry.event_time),
                        self.display_path(&entry_document_path),
                        "entry".into(),
                        "entry document references blob".into(),
                    );
                }
            }
        }

        for document in &bootstrap.document_catalog {
            if !self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path) {
                continue;
            }

            if document.id.starts_with("collection-") || document.category == "entry" {
                push_backlink(
                    "collections index".into(),
                    bootstrap.workspace_index.indexes.collections_ref.clone(),
                    "index".into(),
                    if document.id.starts_with("collection-entries-") {
                        "collection entry shard".into()
                    } else if document.category == "entry" {
                        "collection entry document".into()
                    } else {
                        "collection catalog entry".into()
                    },
                );
            }

            if document.id.starts_with("import-") {
                push_backlink(
                    "imports index".into(),
                    bootstrap.workspace_index.indexes.imports_ref.clone(),
                    "index".into(),
                    if document.id.starts_with("import-bundle-") {
                        "staged import bundle".into()
                    } else {
                        "import catalog entry".into()
                    },
                );
            }
        }

        if let Some(bundle) = &bootstrap.export_inspector.latest_bundle {
            if self.document_ref_matches_target(&bundle.bundle_ref, &target_ref, &target_path) {
                push_backlink(
                    "latest export checkpoint".into(),
                    bundle.checkpoint_ref.clone(),
                    "checkpoint".into(),
                    "latest export bundle".into(),
                );
            }
            if bundle.included_refs.iter().any(|reference| {
                self.document_ref_matches_target(reference, &target_ref, &target_path)
            }) {
                push_backlink(
                    "latest export bundle".into(),
                    bundle.bundle_ref.clone(),
                    "export".into(),
                    "sanitized export includes ref".into(),
                );
            }
        }

        backlinks
    }

    pub(in crate::workspace) fn document_ref_matches_target(
        &self,
        reference: &str,
        target_display_ref: &str,
        target_path: &Path,
    ) -> bool {
        if reference == target_display_ref {
            return true;
        }

        self.resolve_workspace_document_ref(reference)
            .map(|path| canonicalize_or_clone(&path) == target_path)
            .unwrap_or(false)
    }
}
