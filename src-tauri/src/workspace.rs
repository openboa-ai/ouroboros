use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::BTreeSet};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::models::{
    AssetInspectorState, BlobDetailState, BootstrapState, CheckpointComparisonFileState,
    CheckpointComparisonState, CheckpointDetailState, CheckpointSummary, CollectionDetailState,
    CollectionEntryState, CollectionSummaryState, DecisionEntry, EquityPoint, ExportBundleState,
    ExportInspectorState, ExposurePoint, ImportComparisonState, ImportDetailState, ImportSummaryState,
    IngestSourceEntryInput, IngestSourceEntryResult, ImportBundleState, LaneEventState,
    LiveContextState, LiveEvaluationSummaryState, LiveOrder, LivePosition, LiveSessionState,
    MetricCardData, OperationDetailState, OperationRelatedDocumentState, OperationSummaryState,
    PricePoint, ProviderStatus, StrategyActiveIndexState, StrategyIndexesState, TradingMode,
    WorkspaceCatalogEntryState, WorkspaceDocumentBacklinkState, WorkspaceDocumentState, WorkspaceIndexState,
    WorkspaceSearchResultState, WorkspaceSummary,
};
use crate::storage::{
    copy_missing_template_tree, copy_template_tree, copy_tree, list_relative_files, remove_path,
    FileWorkspaceStore,
};

#[derive(Clone)]
pub struct WorkspaceRepository {
    root: PathBuf,
    template_root: PathBuf,
}

impl WorkspaceRepository {
    pub fn new(root: PathBuf, template_root: PathBuf) -> Result<Self, String> {
        let repository = Self { root, template_root };
        repository.ensure_ready()?;
        Ok(repository)
    }

    pub fn default_root() -> PathBuf {
        std::env::var_os("AUTOKAIROS_WORKSPACE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../var/dev-workspace"))
    }

    pub fn default_template_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates/strategy-workspace")
    }

    pub fn load_bootstrap_state(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let strategy_path = self.root.join("strategy.json");
        let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
        let export_policy_path = self.resolve_ref(&strategy_path, &strategy.active.export_policy_ref);
        let checkpoints_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.checkpoints_ref);
        let collections_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.collections_ref);
        let imports_index_path = self.resolve_ref(&strategy_path, &strategy.indexes.imports_ref);
        let operations_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.operations_ref);

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&collections_index_path)?;
        let imports_index = if imports_index_path.exists() {
            self.read_json_path::<ImportsIndexFile>(&imports_index_path)?
        } else {
            ImportsIndexFile { items: Vec::new() }
        };
        let operations_index = if operations_index_path.exists() {
            self.read_json_path::<OperationsIndexFile>(&operations_index_path)?
        } else {
            OperationsIndexFile { items: Vec::new() }
        };

        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let memory_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref);
        let sessions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);
        let eval_summaries_path =
            self.resolve_ref(&live_lane_path, &live_lane.state_refs.eval_summaries_ref);

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let live_memory = self.read_json_path::<LiveMemoryFile>(&memory_path)?;
        let sessions = self.read_json_path::<SessionsIndexFile>(&sessions_path)?;
        let positions = self.read_json_path::<PositionsStateFile>(&positions_path)?;
        let orders = self.read_json_path::<OrdersStateFile>(&orders_path)?;
        let eval_summaries = self.read_json_path::<EvalSummariesFile>(&eval_summaries_path)?;
        let current_checkpoint_path = self.resolve_current_checkpoint_path(
            &strategy_path,
            &strategy.active.current_checkpoint_ref,
            &checkpoints_index,
        );
        let export_inventory = self.export_inventory(&checkpoints_index.items);
        let latest_export_bundle = self.latest_export_bundle(&checkpoints_index.items)?;
        let sessions_count = sessions.sessions.len();
        let document_catalog = self.build_document_catalog(
            &strategy_path,
            &live_lane_path,
            &export_policy_path,
            &current_checkpoint_path,
            &checkpoints_index_path,
            &collections_index_path,
            &collections_index,
            &imports_index_path,
            &imports_index,
            &operations_index_path,
            &operations_index,
            &sessions_path,
            &sessions,
            &eval_summaries_path,
            &eval_summaries,
            export_inventory.latest_ref.as_deref(),
        );

        Ok(BootstrapState {
            mode: live_lane.mode,
            automation_status: dashboard.automation_status,
            status_note: dashboard.status_note,
            workspace: WorkspaceSummary {
                artifact_id: strategy.artifact_id,
                slug: strategy.slug,
                live_lane_label: live_lane.label,
                current_checkpoint_alias: checkpoints_index.current.alias,
                export_policy_label: export_policy.policy_id.clone(),
            },
            asset_inspector: AssetInspectorState {
                workspace_root: self.display_path(&self.root),
                strategy_ref: self.display_path(&strategy_path),
                live_lane_ref: self.display_path(&live_lane_path),
                current_checkpoint_ref: self.display_path(&current_checkpoint_path),
                export_policy_ref: self.display_path(&export_policy_path),
                latest_export_bundle_ref: export_inventory.latest_ref,
                checkpoint_count: checkpoints_index.items.len(),
                export_count: export_inventory.count,
            },
            workspace_index: WorkspaceIndexState {
                schema_version: strategy.schema_version.clone(),
                active: StrategyActiveIndexState {
                    live_lane_ref: self.display_path(&live_lane_path),
                    current_checkpoint_ref: self.display_path(&current_checkpoint_path),
                    export_policy_ref: self.display_path(&export_policy_path),
                },
                indexes: StrategyIndexesState {
                    checkpoints_ref: self.display_path(&checkpoints_index_path),
                    collections_ref: self.display_path(&collections_index_path),
                    imports_ref: self.display_path(&imports_index_path),
                    operations_ref: self.display_path(&operations_index_path),
                    sessions_ref: self.display_path(&sessions_path),
                },
                collection_count: collections_index.items.len(),
                operation_count: operations_index.items.len(),
                session_count: sessions_count,
            },
            live_context: LiveContextState {
                memory_notes: live_memory
                    .notes
                    .into_iter()
                    .map(|note| note.summary)
                    .collect(),
                sessions: sessions
                    .sessions
                    .into_iter()
                    .map(|session| {
                        let session_id = session
                            .session_id
                            .clone()
                            .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
                        let label = session.label;
                        let started_at = session.started_at.unwrap_or_else(|| "UTC unknown".into());
                        let status = session.status.unwrap_or_else(|| "active".into());
                        let fallback_ref = format!("../sessions/items/{session_id}/session.json");
                        let path_ref = self.display_path(&self.resolve_optional_ref(
                            &sessions_path,
                            session.path_ref.as_deref(),
                            fallback_ref.as_str(),
                        ));

                        LiveSessionState {
                            id: session_id,
                            label,
                            started_at,
                            status,
                            path_ref,
                        }
                    })
                    .collect(),
                evaluation_summaries: eval_summaries
                    .summaries
                    .into_iter()
                    .map(|summary| {
                        let summary_id = summary
                            .summary_id
                            .clone()
                            .unwrap_or_else(|| format!("legacy-eval-{}", summary_position_hash(&summary)));
                        let headline = summary.headline.unwrap_or_else(|| "Evaluation summary".into());
                        let created_at = summary.created_at.unwrap_or_else(|| "UTC unknown".into());
                        let fallback_ref = format!("../eval-summaries/items/{summary_id}/summary.json");
                        let path_ref = self.display_path(&self.resolve_optional_ref(
                            &eval_summaries_path,
                            summary.path_ref.as_deref(),
                            fallback_ref.as_str(),
                        ));

                        LiveEvaluationSummaryState {
                            id: summary_id,
                            headline,
                            created_at,
                            path_ref,
                            evidence_refs: summary.evidence_refs,
                        }
                    })
                    .collect(),
                position_event_count: positions.events.len(),
                order_event_count: orders.events.len(),
            },
            export_inspector: ExportInspectorState {
                policy_id: export_policy.policy_id.clone(),
                description: export_policy.description.clone(),
                latest_bundle: latest_export_bundle,
            },
            providers: dashboard.providers,
            metrics: dashboard.metrics,
            price_series: dashboard.price_series,
            equity_series: dashboard.equity_series,
            exposure_series: dashboard.exposure_series,
            positions: positions.current,
            orders: orders.current,
            lane_events: lane_event_feed(&positions.events, &orders.events),
            decisions: decisions.decisions,
            checkpoints: checkpoints_index
                .items
                .into_iter()
                .map(|item| {
                    let checkpoint_id = item.checkpoint_id.clone();
                    let path_ref = self.display_path(&self.checkpoint_file_path(&checkpoint_id));
                    let export_bundle_ref = self.export_bundle_display_ref(&item);

                    CheckpointSummary {
                        id: checkpoint_id,
                        alias: item.alias,
                        r#type: item.r#type,
                        type_tone: item.type_tone,
                        summary: item.summary,
                        created_at: item.created_at,
                        performance: item.performance,
                        path_ref,
                        export_bundle_ref,
                    }
                })
                .collect(),
            collections: collections_index
                .items
                .into_iter()
                .map(|item| CollectionSummaryState {
                    id: item.collection_id.clone(),
                    kind: item.kind,
                    source_ref: item.source_ref,
                    time_bucket: item.time_bucket,
                    time_range_label: format!("{} -> {}", item.time_range.start, item.time_range.end),
                    entry_count: item.entry_count,
                    content_hash: item.content_hash,
                    collection_ref: self.display_path(&self.collection_file_path(&item.collection_id)),
                })
                .collect(),
            imports: imports_index
                .items
                .into_iter()
                .map(|item| {
                    let import_root = self.import_root_path(&item.import_id);
                    ImportSummaryState {
                        id: item.import_id,
                        imported_at: item.imported_at,
                        source_bundle_ref: item.source_bundle_ref,
                        import_ref: self.display_path(&import_root.join("import.json")),
                        workspace_ref: self.display_path(&import_root.join("workspace")),
                        checkpoint_ref: item.checkpoint_ref,
                        policy_id: item.policy_id,
                        sanitized: item.sanitized,
                    }
                })
                .collect(),
            operations: operations_index
                .items
                .into_iter()
                .map(|item| OperationSummaryState {
                    id: item.operation_id.clone(),
                    kind: item.kind,
                    scope: item.scope,
                    status: item.status,
                    summary: item.summary,
                    details: item.details,
                    created_at: item.created_at,
                    operation_ref: self.display_path(&self.operation_file_path(&item.operation_id)),
                    related_refs: item
                        .related_refs
                        .into_iter()
                        .map(|reference| self.display_path(&self.root.join(reference)))
                        .collect(),
                })
                .collect(),
            document_catalog,
        })
    }

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
                    id: entry.entry_id,
                    source_ref: entry.source_ref,
                    event_time: entry.event_time,
                    ingested_at: entry.ingested_at,
                    content_hash: entry.content_hash,
                    preview: entry.preview,
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

    pub fn ingest_source_entry(
        &self,
        input: IngestSourceEntryInput,
    ) -> Result<IngestSourceEntryResult, String> {
        let payload = input
            .body_text
            .clone()
            .or_else(|| input.preview.clone())
            .ok_or_else(|| "ingest source entry requires body_text or preview".to_string())?;
        let time_bucket = utc_hour_bucket(&input.event_time)?;

        let mut collections_index =
            self.read_json_path::<CollectionsIndexFile>(&self.root.join("indexes/collections.json"))?;
        let existing_index = collections_index
            .items
            .iter()
            .position(|item| {
                item.kind == input.kind
                    && item.source_ref == input.source_ref
                    && item.time_bucket == time_bucket
            });

        let (collection_id, created_collection) = match existing_index {
            Some(index) => (collections_index.items[index].collection_id.clone(), false),
            None => (uuid_v7_string(), true),
        };

        let collection_path = self.collection_file_path(&collection_id);
        let entry_shard_path = self.collection_entries_path(&collection_id);
        let mut entries = if entry_shard_path.exists() {
            self.read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?
        } else {
            Vec::new()
        };

        let blob_id = blob_id_for_contents(&payload);
        let blob_path = self.blob_path(&blob_id);
        FileWorkspaceStore::write_text_if_missing(&blob_path, &payload)?;

        let entry = CollectionEntryFile {
            entry_id: uuid_v7_string(),
            source_ref: input.source_ref.clone(),
            event_time: input.event_time.clone(),
            ingested_at: input.ingested_at.clone(),
            content_hash: blob_id.clone(),
            blob_ref: Some(blob_id.clone()),
            preview: input.preview.clone(),
        };
        entries.push(entry.clone());
        FileWorkspaceStore::write_ndjson_path(&entry_shard_path, &entries)?;

        let time_range = merge_time_range(entries.iter().map(|item| item.event_time.as_str()))?;
        let collection_content_hash = collection_entries_hash(&entries)?;
        let collection_record = CollectionRecordFile {
            collection_id: collection_id.clone(),
            kind: input.kind.clone(),
            source_ref: input.source_ref.clone(),
            time_bucket: time_bucket.clone(),
            time_range: time_range.clone(),
            entry_count: entries.len(),
            content_hash: collection_content_hash.clone(),
            entry_shard_ref: "./entries.ndjson".into(),
            notes: if created_collection {
                Some("Generated by workspace ingestion".into())
            } else {
                None
            },
        };
        self.write_json_path(&collection_path, &collection_record)?;

        let operation_source_ref = input.source_ref.clone();

        let index_item = CollectionIndexItemFile {
            collection_id: collection_id.clone(),
            kind: input.kind,
            source_ref: input.source_ref,
            time_bucket: time_bucket.clone(),
            time_range,
            entry_count: entries.len(),
            content_hash: collection_content_hash,
            path_ref: format!("./items/{collection_id}/collection.json"),
        };

        match existing_index {
            Some(index) => collections_index.items[index] = index_item,
            None => collections_index.items.push(index_item),
        }
        collections_index.items.sort_by(|left, right| {
            right
                .time_bucket
                .cmp(&left.time_bucket)
                .then_with(|| left.source_ref.cmp(&right.source_ref))
        });
        self.write_json_path(&self.root.join("indexes/collections.json"), &collections_index)?;
        self.append_operation(
            "ingest_source_entry",
            "workspace",
            format!(
                "Ingested {} source entry into collection {}.",
                operation_source_ref, collection_id
            ),
            "The service layer materialized a source-centered collection shard, persisted the entry NDJSON append log, and wrote an immutable blob for the entry body.".into(),
            vec![
                self.display_path(&collection_path),
                self.display_path(&entry_shard_path),
                self.display_path(&blob_path),
            ],
        )?;

        Ok(IngestSourceEntryResult {
            collection_id,
            collection_ref: self.display_path(&collection_path),
            entry_id: entry.entry_id,
            entry_shard_ref: self.display_path(&entry_shard_path),
            time_bucket,
            entry_count: entries.len(),
            blob_id: Some(blob_id),
            created_collection,
        })
    }

    pub fn import_export_bundle(&self, bundle_ref: &str) -> Result<ImportBundleState, String> {
        let source_bundle_path = self.resolve_import_bundle_ref(bundle_ref)?;
        let export_bundle = self.read_json_path::<ExportBundleFile>(&source_bundle_path)?;
        if !export_bundle.sanitized {
            return Err(format!(
                "refusing to import non-sanitized export bundle: {}",
                source_bundle_path.display()
            ));
        }

        let source_root = source_bundle_path
            .parent()
            .ok_or_else(|| format!("export bundle has no parent directory: {}", source_bundle_path.display()))?;
        let source_workspace = source_root.join("workspace");
        if !source_workspace.exists() {
            return Err(format!(
                "export bundle workspace is missing: {}",
                source_workspace.display()
            ));
        }

        let import_id = uuid_v7_string();
        let import_root = self.import_root_path(&import_id);
        let import_workspace = import_root.join("workspace");
        fs::create_dir_all(&import_root)
            .map_err(|error| format!("failed to create {}: {error}", import_root.display()))?;
        copy_tree(&source_workspace, &import_workspace, &PathBuf::new())?;

        let metadata = ImportRecordFile {
            import_id: import_id.clone(),
            imported_at: now_label(),
            source_bundle_ref: source_bundle_path.to_string_lossy().replace('\\', "/"),
            bundle_ref: "./bundle/export.json".into(),
            workspace_ref: "./workspace".into(),
            checkpoint_ref: export_bundle.checkpoint_ref.clone(),
            policy_id: export_bundle.policy_id.clone(),
            sanitized: export_bundle.sanitized,
        };
        self.write_json_path(&import_root.join("import.json"), &metadata)?;

        let bundle_destination = import_root.join("bundle");
        fs::create_dir_all(&bundle_destination)
            .map_err(|error| format!("failed to create {}: {error}", bundle_destination.display()))?;
        copy_tree(&source_bundle_path, &bundle_destination.join("export.json"), &PathBuf::from("export.json"))?;

        let mut imports_index = if self.imports_index_path().exists() {
            self.read_json_path::<ImportsIndexFile>(&self.imports_index_path())?
        } else {
            ImportsIndexFile { items: Vec::new() }
        };
        imports_index.items.insert(0, metadata.clone());
        self.write_json_path(&self.imports_index_path(), &imports_index)?;
        self.append_operation(
            "import_export_bundle",
            "workspace",
            format!(
                "Staged sanitized export bundle {} as import {}.",
                self.display_path(&source_bundle_path),
                import_id
            ),
            "The service layer copied a sanitized export bundle into the workspace imports area without mutating the active live lane.".into(),
            vec![
                self.display_path(&import_root.join("import.json")),
                self.display_path(&bundle_destination.join("export.json")),
                self.display_path(&import_workspace),
            ],
        )?;

        Ok(ImportBundleState {
            import_id,
            imported_at: metadata.imported_at,
            source_bundle_ref: self.display_path(&source_bundle_path),
            import_ref: self.display_path(&import_root.join("import.json")),
            workspace_ref: self.display_path(&import_workspace),
            checkpoint_ref: metadata.checkpoint_ref,
            policy_id: metadata.policy_id,
            sanitized: metadata.sanitized,
        })
    }

    pub fn activate_import_as_live(&self, import_id: &str) -> Result<BootstrapState, String> {
        let import_path = self.import_file_path(import_id);
        let import_record = self.read_json_path::<ImportRecordFile>(&import_path)?;
        let import_workspace = self.resolve_ref(&import_path, &import_record.workspace_ref);
        if !import_workspace.exists() {
            return Err(format!(
                "import workspace does not exist: {}",
                import_workspace.display()
            ));
        }

        self.create_checkpoint(
            "incident",
            format!("incident-import-activation-anchor-{}", short_alias_suffix()),
            format!(
                "Automatic pre-activation checkpoint created before activating import {}.",
                import_id
            ),
            "Rollback anchor for staged import activation".into(),
        )?;

        self.replace_workspace_from_root(&import_workspace)?;
        self.normalize_workspace()?;

        let activated_checkpoint = if let Some(checkpoint) =
            self.resolve_checkpoint_record_by_ref(&import_record.checkpoint_ref)?
        {
            self.set_current_checkpoint(&checkpoint)?;
            checkpoint
        } else {
            self.create_checkpoint(
                "incident",
                format!("incident-import-activation-{}", short_alias_suffix()),
                format!(
                    "Imported workspace {} became live without a locally resolvable checkpoint reference.",
                    import_id
                ),
                "Imported live workspace anchored locally after activation".into(),
            )?
        };

        self.record_import_activation_decision(
            import_id,
            &import_record.source_bundle_ref,
            &activated_checkpoint.alias,
        )?;
        self.append_operation(
            "activate_import_as_live",
            "live",
            format!(
                "Activated staged import {} as the current live workspace.",
                import_id
            ),
            "The service layer replaced live asset files with the staged import workspace, preserved service-owned roots, and re-anchored the active checkpoint without bypassing workspace invariants.".into(),
            vec![
                self.display_path(&import_path),
                self.display_path(&import_workspace),
                self.display_path(&self.root.join("strategy.json")),
                self.display_path(&self.checkpoint_file_path(&activated_checkpoint.checkpoint_id)),
            ],
        )?;

        self.load_bootstrap_state()
    }

    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let mut live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;

        live_lane.mode = TradingMode::Observer;
        dashboard.mode = TradingMode::Observer;
        dashboard.automation_status = "paused".into();
        dashboard.status_note = Some(
            "Global automation was paused through the service layer while preserving live context."
                .into(),
        );
        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: "Control".into(),
                tone: "warning".into(),
                headline: "Global automation paused".into(),
                reason: "The service layer switched the runtime into observer mode without exposing direct workspace mutation to the client.".into(),
                timestamp: now_label(),
            },
        );

        self.write_json_path(&live_lane_path, &live_lane)?;
        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        self.append_operation(
            "pause_global_automation",
            "live",
            "Global automation paused through the service layer.".into(),
            "The service boundary switched the live lane into observer mode without allowing direct client mutation of the workspace.".into(),
            vec![
                self.display_path(&live_lane_path),
                self.display_path(&dashboard_path),
                self.display_path(&decisions_path),
            ],
        )?;

        self.load_bootstrap_state()
    }

    pub fn flatten_all_positions(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);

        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let mut positions = self.read_json_path::<PositionsStateFile>(&positions_path)?;
        let mut orders = self.read_json_path::<OrdersStateFile>(&orders_path)?;

        dashboard.status_note =
            Some("Service-layer intervention flattened all live positions in the workspace.".into());
        for metric in dashboard.metrics.iter_mut() {
            if metric.label == "Risk Budget" {
                metric.value = "0%".into();
                metric.delta = "Reset after flatten-all intervention".into();
            }
            if metric.label == "Intervention Load" {
                metric.value = "2 incidents".into();
                metric.delta = "Includes the latest flatten-all incident checkpoint".into();
            }
        }

        positions.current.clear();
        positions.events.insert(
            0,
            LaneEvent {
                event_id: uuid_v7_string(),
                timestamp: now_label(),
                kind: "flatten-all".into(),
                summary: "All live positions were flattened through the service layer.".into(),
            },
        );
        orders.current.clear();
        orders.events.insert(
            0,
            LaneEvent {
                event_id: uuid_v7_string(),
                timestamp: now_label(),
                kind: "flatten-all".into(),
                summary: "All live orders were cleared after the flatten-all intervention.".into(),
            },
        );
        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: "Intervention".into(),
                tone: "warning".into(),
                headline: "All live positions flattened".into(),
                reason: "The service layer executed a flatten-all command and reset current positions and orders without bypassing the workspace contract.".into(),
                timestamp: now_label(),
            },
        );

        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        self.write_json_path(&positions_path, &positions)?;
        self.write_json_path(&orders_path, &orders)?;

        let checkpoint = self.create_checkpoint(
            "incident",
            "incident-flatten-all".into(),
            "Client-triggered flatten-all command captured as an incident checkpoint.".into(),
            "Live risk reset to flat".into(),
        )?;
        self.append_operation(
            "flatten_all_positions",
            "live",
            "Flatten-all intervention reset live positions and orders.".into(),
            "The service layer flattened current positions, cleared live orders, and captured an incident checkpoint for the intervention.".into(),
            vec![
                self.display_path(&dashboard_path),
                self.display_path(&decisions_path),
                self.display_path(&positions_path),
                self.display_path(&orders_path),
                self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
            ],
        )?;

        self.load_bootstrap_state()
    }

    pub fn create_export_checkpoint(&self) -> Result<BootstrapState, String> {
        let checkpoint = self.create_checkpoint(
            "export",
            format!("export-{}", short_alias_suffix()),
            "Fresh export checkpoint created before generating a sanitized live-centered bundle."
                .into(),
            "Export policy sanitized-live-centered".into(),
        )?;

        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let export_policy_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.export_policy_ref);

        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;

        dashboard.status_note = Some(
            "A fresh export checkpoint was created from the current live-centered asset."
                .into(),
        );
        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: "Export".into(),
                tone: "neutral".into(),
                headline: "Export checkpoint created".into(),
                reason: "The service layer created a fresh checkpoint before export so the client can share a stable live-centered asset instead of a drifting mutable state.".into(),
                timestamp: now_label(),
            },
        );

        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        self.create_export_bundle(&checkpoint, &export_policy.policy_id)?;
        self.append_operation(
            "create_export_checkpoint",
            "live",
            format!("Export checkpoint {} created for sanitized sharing.", checkpoint.alias),
            "The service layer created a fresh export checkpoint and materialized a live-centered sanitized export bundle.".into(),
            vec![
                self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
                self.display_path(&self.export_bundle_path(&checkpoint.checkpoint_id)),
                self.display_path(&export_policy_path),
            ],
        )?;

        self.load_bootstrap_state()
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        let target_checkpoint_path = self.checkpoint_file_path(checkpoint_id);
        let target_checkpoint = self.read_json_path::<CheckpointRecordFile>(&target_checkpoint_path)?;
        let target_alias = target_checkpoint.alias.clone();

        self.create_checkpoint(
            "incident",
            format!("incident-restore-anchor-{}", short_alias_suffix()),
            format!(
                "Automatic pre-restore checkpoint created before restoring {}.",
                target_alias
            ),
            "Rollback anchor for live workspace restore".into(),
        )?;

        let snapshot_root = self.checkpoint_snapshot_path(checkpoint_id);
        self.replace_workspace_from_root(&snapshot_root)?;
        self.normalize_workspace()?;
        self.set_current_checkpoint(&target_checkpoint)?;
        self.record_restore_decision(&target_alias)?;
        self.append_operation(
            "restore_checkpoint",
            "live",
            format!("Live workspace restored from checkpoint {}.", target_alias),
            "The service layer restored the selected checkpoint snapshot as the active live workspace and preserved the rollback anchor as an incident checkpoint.".into(),
            vec![
                self.display_path(&target_checkpoint_path),
                self.display_path(&self.root.join("strategy.json")),
            ],
        )?;

        self.load_bootstrap_state()
    }

    fn ensure_ready(&self) -> Result<(), String> {
        if self.root.join("strategy.json").exists() {
            copy_missing_template_tree(&self.template_root, &self.root)?;
            self.normalize_workspace()?;
            return Ok(());
        }

        copy_template_tree(&self.template_root, &self.root)?;
        self.normalize_workspace()?;
        Ok(())
    }

    fn normalize_workspace(&self) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        if !strategy_path.exists() {
            return Ok(());
        }

        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let checkpoints_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.checkpoints_ref);
        if !checkpoints_index_path.exists() {
            return Ok(());
        }

        let checkpoints_index = self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        let desired_ref = format!(
            "./checkpoints/items/{}/checkpoint.json",
            checkpoints_index.current.checkpoint_id
        );
        let desired_imports_ref = default_imports_ref();
        let desired_operations_ref = default_operations_ref();
        let mut strategy_dirty = false;
        if strategy.active.current_checkpoint_ref != desired_ref {
            strategy.active.current_checkpoint_ref = desired_ref;
            strategy_dirty = true;
        }
        if strategy.indexes.imports_ref != desired_imports_ref {
            strategy.indexes.imports_ref = desired_imports_ref;
            strategy_dirty = true;
        }
        if strategy.indexes.operations_ref != desired_operations_ref {
            strategy.indexes.operations_ref = desired_operations_ref;
            strategy_dirty = true;
        }
        if strategy_dirty {
            self.write_json_path(&strategy_path, &strategy)?;
        }

        for checkpoint in &checkpoints_index.items {
            let snapshot_root = self
                .root
                .join("checkpoints")
                .join("items")
                .join(&checkpoint.checkpoint_id)
                .join("workspace");
            if !snapshot_root.exists() {
                self.materialize_checkpoint_snapshot(checkpoint)?;
            }
        }

        self.materialize_live_context_documents()?;

        Ok(())
    }

    fn materialize_live_context_documents(&self) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        let strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let sessions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref);
        let eval_summaries_path =
            self.resolve_ref(&live_lane_path, &live_lane.state_refs.eval_summaries_ref);

        let mut sessions = self.read_json_path::<SessionsIndexFile>(&sessions_path)?;
        let mut sessions_dirty = false;
        for session in &mut sessions.sessions {
            let session_id = session
                .session_id
                .clone()
                .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
            let path_ref = session
                .path_ref
                .clone()
                .unwrap_or_else(|| format!("../sessions/items/{session_id}/session.json"));
            let started_at = session
                .started_at
                .clone()
                .unwrap_or_else(|| "UTC unknown".into());
            let status = session.status.clone().unwrap_or_else(|| "active".into());
            let session_path = self.resolve_ref(&sessions_path, &path_ref);
            let session_file = SessionDetailFile {
                session_id: session_id.clone(),
                label: session.label.clone(),
                started_at: started_at.clone(),
                status: status.clone(),
                scope: "live".into(),
                goal: "Keep the live trading context inspectable, exportable, and replayable.".into(),
                context_refs: vec![
                    "./live/live-lane.json".into(),
                    "./state/live-memory.json".into(),
                    "./state/positions.json".into(),
                    "./state/orders.json".into(),
                    "./state/eval-summaries.json".into(),
                ],
                notes: vec![
                    "Session records stay inside the workspace asset and are exposed through the service layer.".into(),
                    "These documents are part of the live trading context whenever they materially influence trading behavior.".into(),
                ],
            };

            if session.session_id.as_deref() != Some(&session_id) {
                session.session_id = Some(session_id.clone());
                sessions_dirty = true;
            }
            if session.started_at.as_deref() != Some(&started_at) {
                session.started_at = Some(started_at);
                sessions_dirty = true;
            }
            if session.status.as_deref() != Some(&status) {
                session.status = Some(status);
                sessions_dirty = true;
            }
            if session.path_ref.as_deref() != Some(path_ref.as_str()) {
                session.path_ref = Some(path_ref);
                sessions_dirty = true;
            }
            if !session_path.exists() {
                self.write_json_path(&session_path, &session_file)?;
            }
        }
        if sessions_dirty {
            self.write_json_path(&sessions_path, &sessions)?;
        }

        let mut eval_summaries = self.read_json_path::<EvalSummariesFile>(&eval_summaries_path)?;
        let mut eval_dirty = false;
        for summary in &mut eval_summaries.summaries {
            let summary_id = summary
                .summary_id
                .clone()
                .unwrap_or_else(|| format!("legacy-eval-{}", summary_position_hash(summary)));
            let headline = summary
                .headline
                .clone()
                .unwrap_or_else(|| "Evaluation summary".into());
            let created_at = summary
                .created_at
                .clone()
                .unwrap_or_else(|| "UTC unknown".into());
            let path_ref = summary
                .path_ref
                .clone()
                .unwrap_or_else(|| format!("../eval-summaries/items/{summary_id}/summary.json"));
            let summary_path = self.resolve_ref(&eval_summaries_path, &path_ref);
            let summary_file = EvalSummaryDetailFile {
                summary_id: summary_id.clone(),
                headline: headline.clone(),
                created_at: created_at.clone(),
                tone: "neutral".into(),
                decision: "inspect-live-evidence".into(),
                rationale: vec![
                    "Evaluation summaries remain part of the live trading context whenever they materially influence trade decisions.".into(),
                    "Raw evidence refs stay attached so the asset remains inspectable and replayable.".into(),
                ],
                evidence_refs: if summary.evidence_refs.is_empty() {
                    vec!["./checkpoints/index.json".into()]
                } else {
                    summary.evidence_refs.clone()
                },
            };

            if summary.summary_id.as_deref() != Some(&summary_id) {
                summary.summary_id = Some(summary_id);
                eval_dirty = true;
            }
            if summary.headline.as_deref() != Some(&headline) {
                summary.headline = Some(headline);
                eval_dirty = true;
            }
            if summary.created_at.as_deref() != Some(&created_at) {
                summary.created_at = Some(created_at);
                eval_dirty = true;
            }
            if summary.path_ref.as_deref() != Some(path_ref.as_str()) {
                summary.path_ref = Some(path_ref);
                eval_dirty = true;
            }
            if summary_path.exists() {
                continue;
            }
            self.write_json_path(&summary_path, &summary_file)?;
        }
        if eval_dirty {
            self.write_json_path(&eval_summaries_path, &eval_summaries)?;
        }

        Ok(())
    }

    fn update_active_checkpoint_ref(&self, checkpoint_id: &str) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        strategy.active.current_checkpoint_ref =
            format!("./checkpoints/items/{checkpoint_id}/checkpoint.json");
        self.write_json_path(&strategy_path, &strategy)
    }

    fn set_current_checkpoint(&self, checkpoint: &CheckpointRecordFile) -> Result<(), String> {
        let checkpoints_index_path = self.root.join("checkpoints/index.json");
        let mut index = self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        index.current = CheckpointPointerFile {
            checkpoint_id: checkpoint.checkpoint_id.clone(),
            alias: checkpoint.alias.clone(),
            r#type: checkpoint.r#type.clone(),
        };
        self.write_json_path(&checkpoints_index_path, &index)?;
        self.update_active_checkpoint_ref(&checkpoint.checkpoint_id)
    }

    fn create_checkpoint(
        &self,
        checkpoint_type: &str,
        alias: String,
        summary: String,
        performance: String,
    ) -> Result<CheckpointRecordFile, String> {
        let checkpoint_id = uuid_v7_string();
        let created_at = now_label();
        let checkpoint = CheckpointRecordFile {
            checkpoint_id: checkpoint_id.clone(),
            alias: alias.clone(),
            r#type: checkpoint_type.into(),
            type_tone: checkpoint_tone(checkpoint_type).into(),
            summary,
            created_at,
            performance,
            path_ref: format!("./items/{checkpoint_id}/checkpoint.json"),
        };

        self.materialize_checkpoint_snapshot(&checkpoint)?;

        let mut index =
            self.read_json_path::<CheckpointIndexFile>(&self.root.join("checkpoints/index.json"))?;
        index.items.insert(0, checkpoint.clone());
        self.write_json_path(&self.root.join("checkpoints/index.json"), &index)?;
        self.set_current_checkpoint(&checkpoint)?;

        Ok(checkpoint)
    }

    fn replace_workspace_from_root(&self, source_root: &Path) -> Result<(), String> {
        if !source_root.exists() {
            return Err(format!(
                "source workspace root does not exist: {}",
                source_root.display()
            ));
        }

        let temp_root = std::env::temp_dir().join(format!(
            "autokairos-workspace-mutation-{}",
            uuid_v7_string()
        ));
        let staged_source_root = temp_root.join("source");
        let staged_protected_root = temp_root.join("protected");

        let result = (|| {
            fs::create_dir_all(&temp_root)
                .map_err(|error| format!("failed to create {}: {error}", temp_root.display()))?;
            copy_tree(source_root, &staged_source_root, &PathBuf::new())?;

            for protected_ref in protected_workspace_root_refs() {
                let source = self.root.join(protected_ref);
                if !source.exists() {
                    continue;
                }

                copy_tree(
                    &source,
                    &staged_protected_root.join(protected_ref),
                    &PathBuf::new(),
                )?;
            }

            self.clear_workspace_root()?;
            fs::create_dir_all(&self.root)
                .map_err(|error| format!("failed to create {}: {error}", self.root.display()))?;

            for entry in fs::read_dir(&staged_source_root)
                .map_err(|error| format!("failed to read {}: {error}", staged_source_root.display()))?
            {
                let entry =
                    entry.map_err(|error| format!("failed to read staged source entry: {error}"))?;
                let name = entry.file_name();
                let destination = self.root.join(&name);
                let relative = PathBuf::from(&name);
                copy_tree(&entry.path(), &destination, &relative)?;
            }

            for protected_ref in protected_workspace_root_refs() {
                let staged = staged_protected_root.join(protected_ref);
                if !staged.exists() {
                    continue;
                }

                let destination = self.root.join(protected_ref);
                if destination.exists() {
                    remove_path(&destination)?;
                }

                copy_tree(&staged, &destination, &PathBuf::new())?;
            }

            Ok(())
        })();

        if temp_root.exists() {
            let _ = fs::remove_dir_all(&temp_root);
        }

        result
    }

    fn clear_workspace_root(&self) -> Result<(), String> {
        for entry in fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read workspace root: {error}"))?
        {
            let entry = entry.map_err(|error| format!("failed to read workspace entry: {error}"))?;
            let path = entry.path();

            remove_path(&path)?;
        }

        Ok(())
    }

    fn record_restore_decision(&self, checkpoint_alias: &str) -> Result<(), String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);

        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;

        dashboard.status_note = Some(format!(
            "Live workspace restored from checkpoint {} through the service layer.",
            checkpoint_alias
        ));
        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: "Restore".into(),
                tone: "warning".into(),
                headline: format!("Restored live workspace from {}", checkpoint_alias),
                reason: "The service layer reapplied the selected checkpoint snapshot as the active live workspace while preserving checkpoint and export history.".into(),
                timestamp: now_label(),
            },
        );

        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        Ok(())
    }

    fn record_import_activation_decision(
        &self,
        import_id: &str,
        source_bundle_ref: &str,
        checkpoint_alias: &str,
    ) -> Result<(), String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);

        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;

        dashboard.status_note = Some(format!(
            "Staged import {} is now live and anchored at checkpoint {}.",
            import_id, checkpoint_alias
        ));
        prepend_decision(
            &mut decisions.decisions,
            DecisionEntry {
                id: uuid_v7_string(),
                kind: "Import".into(),
                tone: "neutral".into(),
                headline: format!("Activated import {} as live", import_id),
                reason: format!(
                    "The service layer promoted the staged import sourced from {} into the live workspace while preserving local checkpoint and service history.",
                    source_bundle_ref
                ),
                timestamp: now_label(),
            },
        );

        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        Ok(())
    }

    fn materialize_checkpoint_snapshot(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Result<PathBuf, String> {
        let checkpoint_root = self
            .root
            .join("checkpoints")
            .join("items")
            .join(&checkpoint.checkpoint_id);
        let workspace_root = checkpoint_root.join("workspace");
        fs::create_dir_all(&workspace_root)
            .map_err(|error| format!("failed to create checkpoint directory: {error}"))?;

        for entry in fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read workspace root: {error}"))?
        {
            let entry = entry.map_err(|error| format!("failed to read workspace entry: {error}"))?;
            let name = entry.file_name();
            let relative = PathBuf::from(&name);
            copy_tree(&entry.path(), &workspace_root.join(name), &relative)?;
        }

        self.write_json_path(&checkpoint_root.join("checkpoint.json"), checkpoint)?;
        Ok(checkpoint_root)
    }

    fn create_export_bundle(
        &self,
        checkpoint: &CheckpointRecordFile,
        policy_id: &str,
    ) -> Result<(), String> {
        let checkpoint_workspace = self
            .root
            .join("checkpoints")
            .join("items")
            .join(&checkpoint.checkpoint_id)
            .join("workspace");
        let export_root = self
            .root
            .join("exports")
            .join("generated")
            .join(&checkpoint.checkpoint_id);
        let export_workspace = export_root.join("workspace");

        if export_root.exists() {
            fs::remove_dir_all(&export_root)
                .map_err(|error| format!("failed to reset export bundle: {error}"))?;
        }

        copy_tree(&checkpoint_workspace, &export_workspace, &PathBuf::new())?;
        let included_refs = list_relative_files(&export_workspace, "./workspace")?;
        self.write_json_path(
            &export_root.join("export.json"),
            &ExportBundleFile {
                export_id: checkpoint.checkpoint_id.clone(),
                checkpoint_ref: checkpoint.path_ref.clone(),
                policy_id: policy_id.into(),
                created_at: now_label(),
                sanitized: true,
                workspace_ref: "./workspace".into(),
                included_refs,
                excluded_paths: export_excluded_paths(),
            },
        )?;

        Ok(())
    }

    fn resolve_current_checkpoint_path(
        &self,
        strategy_path: &Path,
        current_checkpoint_ref: &str,
        checkpoints_index: &CheckpointIndexFile,
    ) -> PathBuf {
        let clean_reference = current_checkpoint_ref
            .split('#')
            .next()
            .unwrap_or(current_checkpoint_ref);
        if current_checkpoint_ref.contains("#current")
            || clean_reference.ends_with("checkpoints/index.json")
        {
            return self.checkpoint_file_path(&checkpoints_index.current.checkpoint_id);
        }

        self.resolve_ref(strategy_path, clean_reference)
    }

    fn export_inventory(&self, checkpoints: &[CheckpointRecordFile]) -> ExportInventory {
        let mut count = 0usize;
        let mut latest_ref = None;

        for checkpoint in checkpoints.iter().filter(|item| item.r#type == "export") {
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

    fn latest_export_bundle(
        &self,
        checkpoints: &[CheckpointRecordFile],
    ) -> Result<Option<ExportBundleState>, String> {
        for checkpoint in checkpoints.iter().filter(|item| item.r#type == "export") {
            if let Some(bundle) = self.load_export_bundle_for_checkpoint(checkpoint)? {
                return Ok(Some(bundle));
            }
        }

        Ok(None)
    }

    fn load_export_bundle_for_checkpoint(
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
            checkpoint_ref: self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
            workspace_ref: self.display_path(&workspace_path),
            bundle_ref: self.display_path(&export_path),
            included_refs,
            excluded_paths: export_bundle.excluded_paths,
            sanitized: export_bundle.sanitized,
        }))
    }

    fn export_bundle_display_ref(&self, checkpoint: &CheckpointRecordFile) -> Option<String> {
        if checkpoint.r#type != "export" {
            return None;
        }

        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        export_path.exists().then(|| self.display_path(&export_path))
    }

    fn checkpoint_file_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("checkpoint.json")
    }

    fn checkpoint_snapshot_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("workspace")
    }

    fn export_bundle_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("export.json")
    }

    fn imports_index_path(&self) -> PathBuf {
        self.root.join("imports").join("index.json")
    }

    fn operations_index_path(&self) -> PathBuf {
        self.root.join("operations").join("index.json")
    }

    fn operation_root_path(&self, operation_id: &str) -> PathBuf {
        self.root.join("operations").join("items").join(operation_id)
    }

    fn operation_file_path(&self, operation_id: &str) -> PathBuf {
        self.operation_root_path(operation_id).join("operation.json")
    }

    fn import_root_path(&self, import_id: &str) -> PathBuf {
        self.root.join("imports").join("items").join(import_id)
    }

    fn import_file_path(&self, import_id: &str) -> PathBuf {
        self.import_root_path(import_id).join("import.json")
    }

    fn collection_file_path(&self, collection_id: &str) -> PathBuf {
        self.root
            .join("collections")
            .join("items")
            .join(collection_id)
            .join("collection.json")
    }

    fn collection_entries_path(&self, collection_id: &str) -> PathBuf {
        self.root
            .join("collections")
            .join("items")
            .join(collection_id)
            .join("entries.ndjson")
    }

    fn export_workspace_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("workspace")
    }

    fn blob_path(&self, blob_id: &str) -> PathBuf {
        let (algorithm, digest) = blob_id
            .split_once(':')
            .unwrap_or(("sha256", blob_id));
        self.root.join("blobs").join(algorithm).join(format!("{digest}.txt"))
    }

    fn resolve_import_bundle_ref(&self, bundle_ref: &str) -> Result<PathBuf, String> {
        let candidate = PathBuf::from(bundle_ref);
        let path = if candidate.is_absolute() {
            candidate
        } else {
            self.project_root().join(bundle_ref)
        };
        path.canonicalize()
            .map_err(|error| format!("failed to resolve import bundle {}: {error}", path.display()))
    }

    fn resolve_workspace_document_ref(&self, document_ref: &str) -> Result<PathBuf, String> {
        let project_root = self.project_root();
        let candidate = project_root.join(document_ref);
        let canonical = candidate.canonicalize().map_err(|error| {
            format!(
                "failed to resolve workspace document {}: {error}",
                candidate.display()
            )
        })?;
        let root = self.root.canonicalize().map_err(|error| {
            format!("failed to resolve workspace root {}: {error}", self.root.display())
        })?;

        if !canonical.starts_with(&root) {
            return Err(format!(
                "document ref must stay inside workspace root: {}",
                document_ref
            ));
        }

        Ok(canonical)
    }

    fn display_path(&self, path: &Path) -> String {
        let project_root = self.project_root();
        path.strip_prefix(&project_root)
            .map(|relative| relative.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
    }

    fn list_display_files(&self, root: &Path) -> Result<Vec<String>, String> {
        let mut items = Vec::new();
        self.collect_display_files(root, &mut items)?;
        items.sort();
        Ok(items)
    }

    fn collect_display_files(&self, current: &Path, items: &mut Vec<String>) -> Result<(), String> {
        for entry in fs::read_dir(current)
            .map_err(|error| format!("failed to read {}: {error}", current.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let path = entry.path();
            if path.is_dir() {
                self.collect_display_files(&path, items)?;
                continue;
            }
            items.push(self.display_path(&path));
        }

        Ok(())
    }

    fn project_root(&self) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
    }

    fn resolve_ref(&self, base_file: &Path, reference: &str) -> PathBuf {
        let clean_reference = reference.split('#').next().unwrap_or(reference);
        let base_dir = base_file
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| self.root.clone());
        base_dir.join(clean_reference)
    }

    fn resolve_optional_ref(&self, base_file: &Path, reference: Option<&str>, fallback: &str) -> PathBuf {
        self.resolve_ref(base_file, reference.unwrap_or(fallback))
    }

    fn read_json_path<T: DeserializeOwned>(&self, path: &Path) -> Result<T, String> {
        FileWorkspaceStore::read_json_path(path)
    }

    fn read_ndjson_path<T: DeserializeOwned>(&self, path: &Path) -> Result<Vec<T>, String> {
        FileWorkspaceStore::read_ndjson_path(path)
    }

    fn write_json_path<T: Serialize>(&self, path: &Path, value: &T) -> Result<(), String> {
        FileWorkspaceStore::write_json_path(path, value)
    }

    fn build_document_catalog(
        &self,
        strategy_path: &Path,
        live_lane_path: &Path,
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
                description:
                    "Source-centered collection catalog materialized by UTC-hour shards.".into(),
                path_ref: self.display_path(collections_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "imports-index".into(),
                category: "index".into(),
                label: "imports index".into(),
                description: "Sanitized import staging catalog kept inside the workspace asset."
                    .into(),
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
                description: "Inspectable evaluation summaries that still link back to raw evidence refs.".into(),
                path_ref: self.display_path(eval_summaries_path),
            },
        ];

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
                description: "Copied sanitized export manifest staged alongside the imported workspace."
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

    fn collect_document_backlinks(
        &self,
        document_path: &Path,
        bootstrap: &BootstrapState,
    ) -> Vec<WorkspaceDocumentBacklinkState> {
        let target_ref = self.display_path(document_path);
        let target_path = canonicalize_or_clone(document_path);
        let mut seen = BTreeSet::new();
        let mut backlinks = Vec::new();

        let mut push_backlink = |label: String, path_ref: String, category: String, reason: String| {
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
                push_backlink(label, bootstrap.asset_inspector.strategy_ref.clone(), category, reason);
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

        if bootstrap
            .live_context
            .evaluation_summaries
            .iter()
            .any(|summary| self.document_ref_matches_target(&summary.path_ref, &target_ref, &target_path))
        {
            push_backlink(
                "eval summaries".into(),
                format!("{}/state/eval-summaries.json", self.display_path(&self.root)),
                "index".into(),
                "evaluation summary entry".into(),
            );
        }

        for operation in &bootstrap.operations {
            if self.document_ref_matches_target(&operation.operation_ref, &target_ref, &target_path) {
                push_backlink(
                    "operations index".into(),
                    bootstrap.workspace_index.indexes.operations_ref.clone(),
                    "index".into(),
                    "operation catalog entry".into(),
                );
            }
            if operation
                .related_refs
                .iter()
                .any(|reference| self.document_ref_matches_target(reference, &target_ref, &target_path))
            {
                push_backlink(
                    format!("{} · {}", operation.kind, operation.created_at),
                    operation.operation_ref.clone(),
                    "operation".into(),
                    "operation related ref".into(),
                );
            }
        }

        for document in &bootstrap.document_catalog {
            if !self.document_ref_matches_target(&document.path_ref, &target_ref, &target_path) {
                continue;
            }

            if document.id.starts_with("collection-") {
                push_backlink(
                    "collections index".into(),
                    bootstrap.workspace_index.indexes.collections_ref.clone(),
                    "index".into(),
                    if document.id.starts_with("collection-entries-") {
                        "collection entry shard".into()
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
            if bundle
                .included_refs
                .iter()
                .any(|reference| self.document_ref_matches_target(reference, &target_ref, &target_path))
            {
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

    fn document_ref_matches_target(
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

    fn compare_workspace_roots(
        &self,
        base_root: &Path,
        target_root: &Path,
    ) -> Result<WorkspaceDiffState, String> {
        let base_files = list_relative_files(base_root, ".")?;
        let target_files = list_relative_files(target_root, ".")?;
        let mut file_keys = BTreeSet::new();
        for file in &base_files {
            file_keys.insert(file.clone());
        }
        for file in &target_files {
            file_keys.insert(file.clone());
        }

        let mut files = Vec::new();
        let mut changed_count = 0;
        let mut added_count = 0;
        let mut removed_count = 0;

        for relative_path in file_keys {
            let relative = relative_path.trim_start_matches("./");
            let base_path = base_root.join(relative);
            let target_path = target_root.join(relative);
            let base_exists = base_path.exists();
            let target_exists = target_path.exists();

            let status = match (base_exists, target_exists) {
                (true, true) => {
                    let left = fs::read(&base_path)
                        .map_err(|error| format!("failed to read {}: {error}", base_path.display()))?;
                    let right = fs::read(&target_path).map_err(|error| {
                        format!("failed to read {}: {error}", target_path.display())
                    })?;
                    if left == right {
                        continue;
                    }
                    changed_count += 1;
                    "changed"
                }
                (true, false) => {
                    removed_count += 1;
                    "removed"
                }
                (false, true) => {
                    added_count += 1;
                    "added"
                }
                (false, false) => continue,
            };

            files.push(CheckpointComparisonFileState {
                relative_path: relative.into(),
                status: status.into(),
                base_ref: base_exists.then(|| self.display_path(&base_path)),
                target_ref: target_exists.then(|| self.display_path(&target_path)),
            });
        }

        Ok(WorkspaceDiffState {
            files,
            changed_count,
            added_count,
            removed_count,
        })
    }

    fn append_operation(
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

        self.write_json_path(
            &self.operation_file_path(&operation.operation_id),
            &operation,
        )?;

        let mut index = if self.operations_index_path().exists() {
            self.read_json_path::<OperationsIndexFile>(&self.operations_index_path())?
        } else {
            OperationsIndexFile { items: Vec::new() }
        };
        index.items.insert(0, operation.clone());
        self.write_json_path(&self.operations_index_path(), &index)?;

        Ok(operation)
    }

    fn resolve_checkpoint_record_by_ref(
        &self,
        checkpoint_ref: &str,
    ) -> Result<Option<CheckpointRecordFile>, String> {
        let Some(checkpoint_id) = checkpoint_id_from_ref(checkpoint_ref) else {
            return Ok(None);
        };
        let checkpoint_path = self.checkpoint_file_path(&checkpoint_id);
        if !checkpoint_path.exists() {
            return Ok(None);
        }

        self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)
            .map(Some)
    }
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyManifestFile {
    artifact_id: String,
    slug: String,
    schema_version: String,
    active: StrategyActiveRefsFile,
    indexes: StrategyIndexRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyActiveRefsFile {
    live_lane_ref: String,
    current_checkpoint_ref: String,
    export_policy_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyIndexRefsFile {
    checkpoints_ref: String,
    collections_ref: String,
    #[serde(default = "default_imports_ref")]
    imports_ref: String,
    #[serde(default = "default_operations_ref")]
    operations_ref: String,
    sessions_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveLaneFile {
    lane_id: String,
    label: String,
    mode: TradingMode,
    state_refs: LiveLaneRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveLaneRefsFile {
    dashboard_ref: String,
    decisions_ref: String,
    memory_ref: String,
    sessions_ref: String,
    positions_ref: String,
    orders_ref: String,
    eval_summaries_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStateFile {
    mode: TradingMode,
    automation_status: String,
    status_note: Option<String>,
    providers: Vec<ProviderStatus>,
    metrics: Vec<MetricCardData>,
    price_series: Vec<PricePoint>,
    equity_series: Vec<EquityPoint>,
    exposure_series: Vec<ExposurePoint>,
}

#[derive(Clone, Deserialize, Serialize)]
struct DecisionLogFile {
    decisions: Vec<DecisionEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
struct PositionsStateFile {
    current: Vec<LivePosition>,
    events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
struct OrdersStateFile {
    current: Vec<LiveOrder>,
    events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
struct LaneEvent {
    event_id: String,
    timestamp: String,
    kind: String,
    summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveMemoryFile {
    notes: Vec<LiveMemoryNote>,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveMemoryNote {
    summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct SessionsIndexFile {
    sessions: Vec<SessionRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionsIndexFile {
    items: Vec<CollectionIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct ImportsIndexFile {
    items: Vec<ImportRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct OperationsIndexFile {
    items: Vec<OperationRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct ImportRecordFile {
    import_id: String,
    imported_at: String,
    source_bundle_ref: String,
    bundle_ref: String,
    workspace_ref: String,
    checkpoint_ref: String,
    policy_id: String,
    sanitized: bool,
}

#[derive(Clone, Deserialize, Serialize)]
struct OperationRecordFile {
    operation_id: String,
    kind: String,
    scope: String,
    status: String,
    summary: String,
    details: String,
    created_at: String,
    #[serde(default)]
    related_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionIndexItemFile {
    collection_id: String,
    kind: String,
    source_ref: String,
    time_bucket: String,
    time_range: TimeRangeFile,
    entry_count: usize,
    content_hash: String,
    path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionRecordFile {
    collection_id: String,
    kind: String,
    source_ref: String,
    time_bucket: String,
    time_range: TimeRangeFile,
    entry_count: usize,
    content_hash: String,
    entry_shard_ref: String,
    notes: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionEntryFile {
    entry_id: String,
    source_ref: String,
    event_time: String,
    ingested_at: String,
    content_hash: String,
    blob_ref: Option<String>,
    preview: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct TimeRangeFile {
    start: String,
    end: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct SessionRecordFile {
    #[serde(default)]
    session_id: Option<String>,
    label: String,
    #[serde(default)]
    started_at: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(default)]
    path_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct EvalSummariesFile {
    summaries: Vec<EvalSummaryRecord>,
}

#[derive(Clone, Deserialize, Serialize)]
struct EvalSummaryRecord {
    #[serde(default)]
    summary_id: Option<String>,
    #[serde(default)]
    headline: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    path_ref: Option<String>,
    #[serde(default)]
    evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct SessionDetailFile {
    session_id: String,
    label: String,
    started_at: String,
    status: String,
    scope: String,
    goal: String,
    context_refs: Vec<String>,
    notes: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct EvalSummaryDetailFile {
    summary_id: String,
    headline: String,
    created_at: String,
    tone: String,
    decision: String,
    rationale: Vec<String>,
    evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct ExportPolicyFile {
    policy_id: String,
    description: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointIndexFile {
    current: CheckpointPointerFile,
    items: Vec<CheckpointRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointPointerFile {
    checkpoint_id: String,
    alias: String,
    r#type: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointRecordFile {
    checkpoint_id: String,
    alias: String,
    r#type: String,
    type_tone: String,
    summary: String,
    created_at: String,
    performance: String,
    path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct ExportBundleFile {
    export_id: String,
    checkpoint_ref: String,
    policy_id: String,
    created_at: String,
    sanitized: bool,
    #[serde(default)]
    workspace_ref: String,
    #[serde(default)]
    included_refs: Vec<String>,
    #[serde(default)]
    excluded_paths: Vec<String>,
}

struct ExportInventory {
    count: usize,
    latest_ref: Option<String>,
}

struct WorkspaceDiffState {
    files: Vec<CheckpointComparisonFileState>,
    changed_count: usize,
    added_count: usize,
    removed_count: usize,
}

fn prepend_decision(decisions: &mut Vec<DecisionEntry>, decision: DecisionEntry) {
    decisions.insert(0, decision);
}

fn lane_event_feed(position_events: &[LaneEvent], order_events: &[LaneEvent]) -> Vec<LaneEventState> {
    let mut items = position_events
        .iter()
        .map(|event| LaneEventState {
            id: event.event_id.clone(),
            scope: "positions".into(),
            kind: event.kind.clone(),
            summary: event.summary.clone(),
            timestamp: event.timestamp.clone(),
        })
        .chain(order_events.iter().map(|event| LaneEventState {
            id: event.event_id.clone(),
            scope: "orders".into(),
            kind: event.kind.clone(),
            summary: event.summary.clone(),
            timestamp: event.timestamp.clone(),
        }))
        .collect::<Vec<_>>();

    items.sort_by(|left, right| right.timestamp.cmp(&left.timestamp));
    items
}

fn checkpoint_tone(checkpoint_type: &str) -> &'static str {
    match checkpoint_type {
        "promotion" => "positive",
        "incident" => "danger",
        _ => "warning",
    }
}

fn export_excluded_paths() -> Vec<String> {
    vec![
        "./workspace/checkpoints".into(),
        "./workspace/exports/generated".into(),
        "./workspace/secrets".into(),
        "./workspace/credentials".into(),
    ]
}

fn protected_workspace_root_refs() -> &'static [&'static str] {
    &[
        "checkpoints",
        "imports",
        "operations",
        "exports/generated",
        "secrets",
        "credentials",
    ]
}

fn default_imports_ref() -> String {
    "./imports/index.json".into()
}

fn default_operations_ref() -> String {
    "./operations/index.json".into()
}

fn uuid_v7_string() -> String {
    Uuid::now_v7().to_string()
}

fn blob_id_for_contents(contents: &str) -> String {
    format!("sha256:{:x}", Sha256::digest(contents.as_bytes()))
}

fn collection_entries_hash(entries: &[CollectionEntryFile]) -> Result<String, String> {
    let mut body = String::new();
    for entry in entries {
        let line = serde_json::to_string(entry)
            .map_err(|error| format!("failed to serialize collection entry for hashing: {error}"))?;
        body.push_str(&line);
        body.push('\n');
    }
    Ok(blob_id_for_contents(&body))
}

fn utc_hour_bucket(event_time: &str) -> Result<String, String> {
    if event_time.len() < 13 {
        return Err(format!("event_time is too short for UTC hour bucketing: {event_time}"));
    }

    let prefix = &event_time[..13];
    if !event_time.contains('T') {
        return Err(format!("event_time must contain T separator: {event_time}"));
    }

    Ok(format!("{prefix}:00:00Z"))
}

fn merge_time_range<'a, I>(times: I) -> Result<TimeRangeFile, String>
where
    I: IntoIterator<Item = &'a str>,
{
    let mut iter = times.into_iter();
    let first = iter
        .next()
        .ok_or_else(|| "collection must contain at least one entry".to_string())?;
    let mut min = first.to_string();
    let mut max = first.to_string();

    for time in iter {
        if time < min.as_str() {
            min = time.to_string();
        }
        if time > max.as_str() {
            max = time.to_string();
        }
    }

    Ok(TimeRangeFile { start: min, end: max })
}

fn short_alias_suffix() -> String {
    Uuid::now_v7()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect()
}

fn now_label() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("UTC epoch {seconds}")
}

fn slugish_id(input: &str) -> String {
    let normalized = input
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
        .collect::<String>();
    normalized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn path_leaf_label(path_ref: &str) -> String {
    Path::new(path_ref)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path_ref)
        .to_string()
}

fn checkpoint_id_from_ref(reference: &str) -> Option<String> {
    let clean_reference = reference.split('#').next().unwrap_or(reference);
    Path::new(clean_reference)
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .map(str::to_string)
}

fn canonicalize_or_clone(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn search_excerpt(content: &str, query: &str) -> Option<String> {
    content
        .lines()
        .find(|line| line.to_lowercase().contains(query))
        .map(|line| line.trim().chars().take(180).collect::<String>())
        .filter(|line| !line.is_empty())
}

fn search_match_rank(kind: &str) -> u8 {
    match kind {
        "metadata" => 2,
        "content" => 1,
        _ => 0,
    }
}

fn summary_position_hash(summary: &EvalSummaryRecord) -> String {
    let seed = summary
        .headline
        .as_deref()
        .or_else(|| summary.evidence_refs.first().map(String::as_str))
        .unwrap_or("summary");
    slugish_id(seed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root() -> PathBuf {
        std::env::temp_dir().join(format!("autokairos-workspace-test-{}", uuid_v7_string()))
    }

    #[test]
    fn restore_checkpoint_replays_snapshot_without_losing_generated_exports() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let target_checkpoint_id = export_state
            .checkpoints
            .first()
            .map(|checkpoint| checkpoint.id.clone())
            .expect("new export checkpoint id");
        let target_alias = export_state
            .checkpoints
            .first()
            .map(|checkpoint| checkpoint.alias.clone())
            .expect("new export checkpoint alias");
        let export_bundle_ref = export_state
            .asset_inspector
            .latest_export_bundle_ref
            .clone()
            .expect("latest export bundle");
        let export_bundle_path = repo.project_root().join(&export_bundle_ref);
        assert!(export_bundle_path.exists(), "export bundle should exist before restore");
        let imported = repo
            .import_export_bundle(&export_bundle_ref)
            .expect("stage export as import");

        let flattened = repo.flatten_all_positions().expect("flatten");
        assert!(flattened.positions.is_empty(), "flatten should clear live positions");

        let restored = repo
            .restore_checkpoint(&target_checkpoint_id)
            .expect("restore checkpoint");
        assert_eq!(restored.workspace.current_checkpoint_alias, target_alias);
        assert!(
            restored
                .status_note
                .as_deref()
                .unwrap_or_default()
                .contains("restored from checkpoint"),
            "restore should leave a status note"
        );
        assert!(
            !restored.positions.is_empty(),
            "restoring the promotion snapshot should bring positions back"
        );
        assert!(
            export_bundle_path.exists(),
            "generated export bundles should survive restore"
        );
        assert_eq!(restored.imports.len(), 1, "restore should preserve imports");
        assert_eq!(restored.imports[0].id, imported.import_id);
        assert!(
            restored
                .operations
                .iter()
                .any(|operation| operation.kind == "import_export_bundle"),
            "restore should preserve operation history"
        );
        assert!(
            restored
                .operations
                .iter()
                .any(|operation| operation.kind == "restore_checkpoint"),
            "restore itself should be appended as a service operation"
        );

        let checkpoints_index = repo
            .read_json_path::<CheckpointIndexFile>(&root.join("checkpoints/index.json"))
            .expect("checkpoint index");
        assert_eq!(checkpoints_index.current.checkpoint_id, target_checkpoint_id);
        assert_eq!(checkpoints_index.current.alias, target_alias);
        assert!(
            checkpoints_index
                .items
                .first()
                .map(|item| item.alias.starts_with("incident-restore-anchor-"))
                .unwrap_or(false),
            "restore should prepend an incident rollback anchor"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn activate_import_as_live_replaces_live_state_without_losing_service_roots() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let baseline = repo.load_bootstrap_state().expect("baseline bootstrap");
        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let export_checkpoint = export_state
            .checkpoints
            .first()
            .cloned()
            .expect("export checkpoint summary");
        let export_bundle_ref = export_state
            .asset_inspector
            .latest_export_bundle_ref
            .clone()
            .expect("latest export bundle");
        let imported = repo
            .import_export_bundle(&export_bundle_ref)
            .expect("stage import");

        let flattened = repo.flatten_all_positions().expect("flatten");
        assert!(flattened.positions.is_empty(), "flatten should clear positions first");

        let activated = repo
            .activate_import_as_live(&imported.import_id)
            .expect("activate staged import");

        assert_eq!(
            activated.workspace.current_checkpoint_alias,
            export_checkpoint.alias,
            "activation should re-anchor to the imported checkpoint when it exists locally"
        );
        assert_eq!(
            serde_json::to_string(&activated.positions).expect("serialize activated positions"),
            serde_json::to_string(&baseline.positions).expect("serialize baseline positions"),
            "activating the staged import should restore the exported live positions"
        );
        assert_eq!(activated.imports.len(), 1, "staged import catalog should survive activation");
        assert_eq!(activated.imports[0].id, imported.import_id);
        assert!(
            activated
                .operations
                .iter()
                .any(|operation| operation.kind == "activate_import_as_live"),
            "activation should be recorded as a service operation"
        );
        assert!(
            activated
                .operations
                .iter()
                .any(|operation| operation.kind == "import_export_bundle"),
            "previous import staging history should survive activation"
        );
        assert!(
            activated
                .checkpoints
                .iter()
                .any(|checkpoint| checkpoint.alias.starts_with("incident-import-activation-anchor-")),
            "activation should preserve a rollback anchor"
        );

        let strategy = repo
            .read_json_path::<StrategyManifestFile>(&root.join("strategy.json"))
            .expect("strategy manifest");
        assert_eq!(
            strategy.active.current_checkpoint_ref,
            format!("./checkpoints/items/{}/checkpoint.json", export_checkpoint.id),
            "strategy.json should now point at the activated checkpoint"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ingest_source_entry_creates_collection_blob_and_index_entry() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let result = repo
            .ingest_source_entry(IngestSourceEntryInput {
                kind: "raw".into(),
                source_ref: "news:macro-wire:cpi".into(),
                event_time: "2026-04-10T12:14:55Z".into(),
                ingested_at: "2026-04-10T12:15:02Z".into(),
                preview: Some("US CPI cooled more than expected.".into()),
                body_text: Some("US CPI cooled more than expected across both headline and core prints.".into()),
            })
            .expect("ingest source entry");

        assert!(result.created_collection);
        assert_eq!(result.time_bucket, "2026-04-10T12:00:00Z");
        assert_eq!(result.entry_count, 1);

        let collection = repo
            .read_json_path::<CollectionRecordFile>(&repo.collection_file_path(&result.collection_id))
            .expect("collection record");
        assert_eq!(collection.entry_count, 1);
        assert_eq!(collection.source_ref, "news:macro-wire:cpi");

        let entries = repo
            .read_ndjson_path::<CollectionEntryFile>(&repo.collection_entries_path(&result.collection_id))
            .expect("entries shard");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].entry_id, result.entry_id);
        assert_eq!(
            entries[0].blob_ref.as_deref(),
            result.blob_id.as_deref()
        );

        let blob_path = repo.blob_path(result.blob_id.as_deref().expect("blob id"));
        assert!(blob_path.exists(), "blob should be persisted");

        let collections_index = repo
            .read_json_path::<CollectionsIndexFile>(&root.join("indexes/collections.json"))
            .expect("collections index");
        assert!(
            collections_index
                .items
                .iter()
                .any(|item| item.collection_id == result.collection_id),
            "new collection should be indexed"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ingest_source_entry_reuses_hour_bucket_and_blob_for_same_payload() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let first = repo
            .ingest_source_entry(IngestSourceEntryInput {
                kind: "raw".into(),
                source_ref: "news:macro-wire:cpi".into(),
                event_time: "2026-04-10T12:14:55Z".into(),
                ingested_at: "2026-04-10T12:15:02Z".into(),
                preview: Some("US CPI cooled more than expected.".into()),
                body_text: Some("US CPI cooled more than expected across both headline and core prints.".into()),
            })
            .expect("first ingest");
        let second = repo
            .ingest_source_entry(IngestSourceEntryInput {
                kind: "raw".into(),
                source_ref: "news:macro-wire:cpi".into(),
                event_time: "2026-04-10T12:44:05Z".into(),
                ingested_at: "2026-04-10T12:44:06Z".into(),
                preview: Some("US CPI cooled more than expected.".into()),
                body_text: Some("US CPI cooled more than expected across both headline and core prints.".into()),
            })
            .expect("second ingest");

        assert_eq!(first.collection_id, second.collection_id);
        assert_eq!(first.blob_id, second.blob_id);
        assert!(!second.created_collection);
        assert_eq!(second.entry_count, 2);

        let entries = repo
            .read_ndjson_path::<CollectionEntryFile>(&repo.collection_entries_path(&first.collection_id))
            .expect("entries shard");
        assert_eq!(entries.len(), 2);

        let blob_path = repo.blob_path(second.blob_id.as_deref().expect("blob id"));
        assert!(blob_path.exists(), "deduplicated blob should exist");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn import_export_bundle_stages_sanitized_bundle_without_mutating_live_workspace() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let export_bundle_ref = export_state
            .asset_inspector
            .latest_export_bundle_ref
            .clone()
            .expect("latest export bundle ref");
        let live_before = repo.load_bootstrap_state().expect("bootstrap before import");

        let imported = repo
            .import_export_bundle(&export_bundle_ref)
            .expect("import export bundle");

        let live_after = repo.load_bootstrap_state().expect("bootstrap after import");
        assert_eq!(live_before.workspace.artifact_id, live_after.workspace.artifact_id);
        assert_eq!(
            serde_json::to_string(&live_before.positions).expect("serialize positions before"),
            serde_json::to_string(&live_after.positions).expect("serialize positions after")
        );

        let import_metadata_path = root
            .join("imports")
            .join("items")
            .join(&imported.import_id)
            .join("import.json");
        assert!(import_metadata_path.exists(), "import metadata should be persisted");
        assert!(
            root.join("imports")
                .join("items")
                .join(&imported.import_id)
                .join("workspace")
                .join("strategy.json")
                .exists(),
            "imported workspace should be copied"
        );
        assert!(
            root.join("imports")
                .join("items")
                .join(&imported.import_id)
                .join("bundle")
                .join("export.json")
                .exists(),
            "imported export manifest should be copied"
        );

        let imports_index = repo
            .read_json_path::<ImportsIndexFile>(&root.join("imports/index.json"))
            .expect("imports index");
        assert_eq!(imports_index.items.len(), 1);
        assert_eq!(imports_index.items[0].import_id, imported.import_id);

        let bootstrap = repo.load_bootstrap_state().expect("bootstrap with imports");
        assert_eq!(bootstrap.imports.len(), 1);
        assert_eq!(bootstrap.imports[0].id, imported.import_id);
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|document| document.id == format!("import-{}", imported.import_id)),
            "document catalog should expose staged import manifests"
        );
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|document| document.id == format!("import-bundle-{}", imported.import_id)),
            "document catalog should expose staged import bundle manifests"
        );

        let import_detail = repo
            .load_import_detail(&imported.import_id)
            .expect("import detail");
        assert_eq!(import_detail.id, imported.import_id);
        assert!(
            import_detail
                .workspace_file_refs
                .iter()
                .any(|path| path.ends_with("strategy.json")),
            "staged import should expose workspace files for inspection"
        );
        let import_comparison = repo
            .compare_import(&imported.import_id)
            .expect("import comparison");
        assert_eq!(import_comparison.import_id, imported.import_id);
        assert!(
            import_comparison.summary.contains("current workspace"),
            "import comparison should describe the current workspace as the baseline"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn workspace_operations_are_recorded_for_service_mutations() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        repo.pause_global_automation().expect("pause");
        repo.ingest_source_entry(IngestSourceEntryInput {
            kind: "raw".into(),
            source_ref: "notes:operator:runtime".into(),
            event_time: "2026-04-10T15:01:00Z".into(),
            ingested_at: "2026-04-10T15:01:01Z".into(),
            preview: Some("Operator note".into()),
            body_text: Some("Operator note body".into()),
        })
        .expect("ingest");

        let operations_index = repo
            .read_json_path::<OperationsIndexFile>(&root.join("operations/index.json"))
            .expect("operations index");
        assert_eq!(operations_index.items.len(), 2);
        assert_eq!(operations_index.items[0].kind, "ingest_source_entry");
        assert_eq!(operations_index.items[1].kind, "pause_global_automation");

        let operation_path = repo.operation_file_path(&operations_index.items[0].operation_id);
        assert!(operation_path.exists(), "operation record should be materialized");

        let bootstrap = repo.load_bootstrap_state().expect("bootstrap with operations");
        assert_eq!(bootstrap.operations.len(), 2);
        assert_eq!(bootstrap.operations[0].kind, "ingest_source_entry");
        assert_eq!(bootstrap.workspace_index.operation_count, 2);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn load_operation_detail_resolves_catalog_documents() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        repo.pause_global_automation().expect("pause");
        let bootstrap = repo.load_bootstrap_state().expect("bootstrap");
        let operation = bootstrap.operations.first().expect("operation summary");
        let detail = repo
            .load_operation_detail(&operation.id)
            .expect("operation detail");

        assert_eq!(detail.id, operation.id);
        assert!(
            detail
                .related_documents
                .iter()
                .any(|document| document.path_ref.ends_with("live-lane.json")),
            "operation detail should resolve related workspace documents"
        );
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|document| document.id == format!("operation-{}", operation.id)),
            "document catalog should expose individual operation documents"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn search_workspace_matches_metadata_and_content() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let metadata_results = repo.search_workspace("live lane").expect("metadata search");
        assert!(
            metadata_results
                .iter()
                .any(|result| result.path_ref.ends_with("live/live-lane.json")),
            "metadata search should find the live lane document"
        );

        let content_results = repo
            .search_workspace("model cost and slippage")
            .expect("content search");
        assert!(
            content_results
                .iter()
                .any(|result| result.match_kind == "content"),
            "content search should surface excerpt-backed matches"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn load_workspace_document_reports_backlinks() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");
        let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

        let document = repo
            .load_workspace_document(&bootstrap.asset_inspector.live_lane_ref)
            .expect("workspace document");
        assert!(
            document
                .backlinks
                .iter()
                .any(|backlink| backlink.reason == "active.live_lane_ref"),
            "live lane document should report a backlink from strategy.json"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn normalize_workspace_materializes_session_and_eval_documents() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let legacy_sessions = serde_json::json!({
            "sessions": [
                {
                    "label": "legacy-live-session"
                }
            ]
        });
        let legacy_eval_summaries = serde_json::json!({
            "summaries": [
                {
                    "evidence_refs": ["../checkpoints/index.json#items[0]"]
                }
            ]
        });

        repo.write_json_path(&root.join("indexes/sessions.json"), &legacy_sessions)
            .expect("write legacy sessions");
        repo.write_json_path(&root.join("state/eval-summaries.json"), &legacy_eval_summaries)
            .expect("write legacy eval summaries");
        let _ = fs::remove_dir_all(root.join("sessions"));
        let _ = fs::remove_dir_all(root.join("eval-summaries"));

        repo.normalize_workspace().expect("normalize workspace");
        let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

        let sessions_index = repo
            .read_json_path::<SessionsIndexFile>(&root.join("indexes/sessions.json"))
            .expect("sessions index");
        let session = sessions_index.sessions.first().expect("session entry");
        let session_path = repo.resolve_ref(
            &root.join("indexes/sessions.json"),
            session.path_ref.as_deref().expect("session path ref"),
        );
        assert!(session_path.exists(), "session item should be materialized");
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|item| item.category == "session"),
            "session documents should appear in the service-owned catalog"
        );
        assert_eq!(bootstrap.live_context.sessions.len(), 1);

        let eval_index = repo
            .read_json_path::<EvalSummariesFile>(&root.join("state/eval-summaries.json"))
            .expect("eval summaries");
        let summary = eval_index.summaries.first().expect("eval summary");
        let summary_path = repo.resolve_ref(
            &root.join("state/eval-summaries.json"),
            summary.path_ref.as_deref().expect("summary path ref"),
        );
        assert!(summary_path.exists(), "eval summary item should be materialized");
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|item| item.category == "evaluation"),
            "evaluation summary documents should appear in the service-owned catalog"
        );
        assert_eq!(bootstrap.live_context.evaluation_summaries.len(), 1);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn compare_checkpoints_reports_workspace_differences() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let export_checkpoint_id = export_state
            .checkpoints
            .first()
            .map(|checkpoint| checkpoint.id.clone())
            .expect("export checkpoint id");

        let flattened = repo.flatten_all_positions().expect("flatten");
        let incident_checkpoint_id = flattened
            .checkpoints
            .first()
            .map(|checkpoint| checkpoint.id.clone())
            .expect("incident checkpoint id");

        let comparison = repo
            .compare_checkpoints(&export_checkpoint_id, &incident_checkpoint_id)
            .expect("compare checkpoints");

        assert!(comparison.compared_file_count > 0);
        assert!(
            comparison
                .files
                .iter()
                .any(|file| file.relative_path == "state/positions.json"),
            "positions.json should differ after flattening live positions"
        );
        assert!(
            comparison.changed_count >= 1,
            "at least one file should differ between export and incident checkpoints"
        );

        let _ = fs::remove_dir_all(&root);
    }
}
