use std::collections::BTreeSet;
use std::path::Path;

use super::*;

impl WorkspaceRepository {
    pub(super) fn build_document_catalog(
        &self,
        strategy_path: &Path,
        live_lane_path: &Path,
        dashboard_path: &Path,
        decisions_path: &Path,
        memory_path: &Path,
        positions_path: &Path,
        orders_path: &Path,
        export_policy_path: &Path,
        current_checkpoint_path: &Path,
        checkpoints_index_path: &Path,
        collections_index_path: &Path,
        collections: &CollectionsIndexFile,
        imports_index_path: &Path,
        imports: &ImportsIndexFile,
        operations_index_path: &Path,
        operations: &OperationsIndexFile,
        sessions_path: &Path,
        sessions: &SessionsIndexFile,
        eval_summaries_path: &Path,
        eval_summaries: &EvalSummariesFile,
        latest_export_bundle_ref: Option<&str>,
    ) -> Vec<WorkspaceCatalogEntryState> {
        let mut items = vec![
            WorkspaceCatalogEntryState {
                id: "strategy".into(),
                category: "entrypoint".into(),
                label: "strategy.json".into(),
                description: "Canonical workspace entrypoint for the live-centered asset.".into(),
                path_ref: self.display_path(strategy_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-lane".into(),
                category: "active".into(),
                label: "live lane".into(),
                description: "Active live lane refs, state pointers, and runtime mode.".into(),
                path_ref: self.display_path(live_lane_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-dashboard".into(),
                category: "active".into(),
                label: "dashboard state".into(),
                description:
                    "Current dashboard-facing live state surfaced through the service boundary."
                        .into(),
                path_ref: self.display_path(dashboard_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-decisions".into(),
                category: "active".into(),
                label: "decision log".into(),
                description:
                    "Recent live trading decisions and interventions that remain part of the exportable context.".into(),
                path_ref: self.display_path(decisions_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-memory".into(),
                category: "active".into(),
                label: "working memory".into(),
                description: "Live working-memory notes currently shaping trading behavior.".into(),
                path_ref: self.display_path(memory_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-positions".into(),
                category: "active".into(),
                label: "positions state".into(),
                description: "Current live positions plus event history for replay and audit.".into(),
                path_ref: self.display_path(positions_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-orders".into(),
                category: "active".into(),
                label: "orders state".into(),
                description: "Current live orders plus event history for replay and audit.".into(),
                path_ref: self.display_path(orders_path),
            },
            WorkspaceCatalogEntryState {
                id: "current-checkpoint".into(),
                category: "checkpoint".into(),
                label: "current checkpoint".into(),
                description:
                    "The authoritative checkpoint anchor for the current live-centered asset."
                        .into(),
                path_ref: self.display_path(current_checkpoint_path),
            },
            WorkspaceCatalogEntryState {
                id: "export-policy".into(),
                category: "export".into(),
                label: "export policy".into(),
                description: "Sanitization policy that governs export bundle generation.".into(),
                path_ref: self.display_path(export_policy_path),
            },
            WorkspaceCatalogEntryState {
                id: "checkpoints-index".into(),
                category: "index".into(),
                label: "checkpoint index".into(),
                description: "Promotion, export, and incident history catalog.".into(),
                path_ref: self.display_path(checkpoints_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "collections-index".into(),
                category: "index".into(),
                label: "collections index".into(),
                description: "Source-centered collection catalog materialized by UTC-hour shards."
                    .into(),
                path_ref: self.display_path(collections_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "imports-index".into(),
                category: "index".into(),
                label: "imports index".into(),
                description:
                    "Sanitized import staging catalog kept inside the workspace asset.".into(),
                path_ref: self.display_path(imports_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "operations-index".into(),
                category: "index".into(),
                label: "operations index".into(),
                description: "Durable workspace-wide service operation registry.".into(),
                path_ref: self.display_path(operations_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "sessions-index".into(),
                category: "index".into(),
                label: "sessions index".into(),
                description: "Durable session references that shape current live context.".into(),
                path_ref: self.display_path(sessions_path),
            },
            WorkspaceCatalogEntryState {
                id: "eval-summaries-index".into(),
                category: "index".into(),
                label: "eval summaries".into(),
                description:
                    "Inspectable evaluation summaries that still link back to raw evidence refs."
                        .into(),
                path_ref: self.display_path(eval_summaries_path),
            },
        ];
        let mut indexed_blob_ids = BTreeSet::new();

        for session in &sessions.sessions {
            let session_id = session
                .session_id
                .clone()
                .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
            let session_path = self.resolve_optional_ref(
                sessions_path,
                session.path_ref.as_deref(),
                format!("../sessions/items/{session_id}/session.json").as_str(),
            );
            items.push(WorkspaceCatalogEntryState {
                id: format!("session-{session_id}"),
                category: "session".into(),
                label: session.label.clone(),
                description: format!(
                    "Live session document ({}) that remains part of the exportable trading context.",
                    session.status.clone().unwrap_or_else(|| "active".into())
                ),
                path_ref: self.display_path(&session_path),
            });
        }

        for summary in &eval_summaries.summaries {
            let summary_id = summary
                .summary_id
                .clone()
                .unwrap_or_else(|| format!("legacy-eval-{}", summary_position_hash(summary)));
            let summary_path = self.resolve_optional_ref(
                eval_summaries_path,
                summary.path_ref.as_deref(),
                format!("../eval-summaries/items/{summary_id}/summary.json").as_str(),
            );
            items.push(WorkspaceCatalogEntryState {
                id: format!("evaluation-{summary_id}"),
                category: "evaluation".into(),
                label: summary
                    .headline
                    .clone()
                    .unwrap_or_else(|| "evaluation summary".into()),
                description:
                    "Live-lane evaluation evidence summary with refs back to raw supporting artifacts."
                        .into(),
                path_ref: self.display_path(&summary_path),
            });
        }

        for operation in &operations.items {
            items.push(WorkspaceCatalogEntryState {
                id: format!("operation-{}", operation.operation_id),
                category: "operation".into(),
                label: format!("{} · {}", operation.kind, operation.created_at),
                description: operation.summary.clone(),
                path_ref: self.display_path(&self.operation_file_path(&operation.operation_id)),
            });
        }

        for collection in &collections.items {
            let collection_path = self.resolve_ref(collections_index_path, &collection.path_ref);
            let collection_record = self.read_json_path::<CollectionRecordFile>(&collection_path).ok();
            let entry_shard_path = collection_record
                .as_ref()
                .map(|record| self.resolve_ref(&collection_path, &record.entry_shard_ref));
            let entry_records = entry_shard_path
                .as_ref()
                .filter(|path| path.exists())
                .and_then(|path| self.read_ndjson_path::<CollectionEntryFile>(path).ok())
                .unwrap_or_default();

            items.push(WorkspaceCatalogEntryState {
                id: format!("collection-{}", collection.collection_id),
                category: "collection".into(),
                label: format!("{} · {}", collection.source_ref, collection.time_bucket),
                description: format!(
                    "{} collection with {} entries.",
                    collection.kind, collection.entry_count
                ),
                path_ref: self.display_path(&collection_path),
            });

            if let Some(entry_shard_path) = entry_shard_path {
                items.push(WorkspaceCatalogEntryState {
                    id: format!("collection-entries-{}", collection.collection_id),
                    category: "collection".into(),
                    label: format!("{} entry shard", collection.source_ref),
                    description: "Append-friendly NDJSON shard backing this source collection."
                        .into(),
                    path_ref: self.display_path(&entry_shard_path),
                });
            }

            for entry in entry_records {
                let entry_document_path =
                    self.collection_entry_document_path(&collection.collection_id, &entry.entry_id);
                items.push(WorkspaceCatalogEntryState {
                    id: format!("entry-{}", entry.entry_id),
                    category: "entry".into(),
                    label: format!("{} entry {}", collection.source_ref, entry.event_time),
                    description: entry.preview.clone().unwrap_or_else(|| {
                        "Source entry materialized as a first-class workspace document.".into()
                    }),
                    path_ref: self.display_path(&entry_document_path),
                });

                let Some(blob_ref) = entry.blob_ref else {
                    continue;
                };
                if !indexed_blob_ids.insert(blob_ref.clone()) {
                    continue;
                }

                items.push(WorkspaceCatalogEntryState {
                    id: format!("blob-{}", blob_ref.replace(':', "-")),
                    category: "blob".into(),
                    label: format!(
                        "{} body {}",
                        collection.source_ref,
                        short_blob_label(&blob_ref)
                    ),
                    description: entry.preview.unwrap_or_else(|| {
                        "Immutable source body referenced by collection entries.".into()
                    }),
                    path_ref: self.display_path(&self.blob_path(&blob_ref)),
                });
            }
        }

        for import in &imports.items {
            let import_path = self.import_file_path(&import.import_id);
            let bundle_path = self.resolve_ref(&import_path, &import.bundle_ref);

            items.push(WorkspaceCatalogEntryState {
                id: format!("import-{}", import.import_id),
                category: "import".into(),
                label: format!("import {}", import.imported_at),
                description: format!(
                    "Sanitized import staged from bundle {}.",
                    import.source_bundle_ref
                ),
                path_ref: self.display_path(&import_path),
            });

            items.push(WorkspaceCatalogEntryState {
                id: format!("import-bundle-{}", import.import_id),
                category: "import".into(),
                label: format!("import bundle {}", import.import_id),
                description:
                    "Copied sanitized export manifest staged alongside the imported workspace."
                        .into(),
                path_ref: self.display_path(&bundle_path),
            });
        }

        if let Some(latest_export_bundle_ref) = latest_export_bundle_ref {
            items.push(WorkspaceCatalogEntryState {
                id: "latest-export-bundle".into(),
                category: "export".into(),
                label: "latest export bundle".into(),
                description:
                    "Most recent sanitized export created from the live-centered workspace asset."
                        .into(),
                path_ref: latest_export_bundle_ref.into(),
            });
        }

        items
    }

    pub(super) fn collect_document_backlinks(
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
            (&bootstrap.live_context.dashboard_ref, "state_refs.dashboard_ref"),
            (&bootstrap.live_context.decisions_ref, "state_refs.decisions_ref"),
            (&bootstrap.live_context.memory_ref, "state_refs.memory_ref"),
            (&bootstrap.live_context.positions_ref, "state_refs.positions_ref"),
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
                bootstrap.workspace_index.indexes.collections_ref.clone(),
                "strategy.json".to_string(),
                "entrypoint".to_string(),
                "indexes.collections_ref".to_string(),
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

        if bootstrap.live_context.evaluation_summaries.iter().any(|summary| {
            self.document_ref_matches_target(&summary.path_ref, &target_ref, &target_path)
        }) {
            push_backlink(
                "eval summaries".into(),
                format!("{}/state/eval-summaries.json", self.display_path(&self.root)),
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
                let collection_path =
                    self.resolve_ref(&self.root.join("indexes/collections.json"), &collection.path_ref);
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
                    let entry_document_path =
                        self.collection_entry_document_path(&collection.collection_id, &entry.entry_id);
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

    pub(super) fn document_ref_matches_target(
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
