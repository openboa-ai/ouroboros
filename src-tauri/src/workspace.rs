use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

mod query;
mod mutations;
mod catalog;
mod operations;
mod bootstrap;
mod paths;
mod contracts;
mod helpers;

use contracts::*;
use helpers::*;

use crate::models::{
    AssetInspectorState, BlobDetailState, BootstrapState, CheckpointComparisonFileState,
    CheckpointComparisonState, CheckpointDetailState, CheckpointSummary, CollectionDetailState,
    CollectionEntryState, CollectionSummaryState, DecisionEntry, ExportBundleState,
    ExportInspectorState, ImportComparisonState, ImportDetailState,
    ImportPreflightCheckState, ImportPreflightState, ImportSummaryState, IngestSourceEntryInput,
    IngestSourceEntryResult, ImportBundleState, LiveContextState, LiveEvaluationSummaryState,
    LiveSessionState, OperationDetailState, OperationRelatedDocumentState, OperationSummaryState,
    StrategyActiveIndexState, StrategyIndexesState, TradingMode,
    WorkspaceCatalogEntryState, WorkspaceDocumentBacklinkState, WorkspaceDocumentState,
    WorkspaceIndexState, WorkspaceSearchResultState, WorkspaceSummary,
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

        let collections_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.collections_ref);
        if collections_index_path.exists() {
            self.normalize_collections_index_file(&collections_index_path)?;
            let mut collections_index =
                self.read_json_path::<CollectionsIndexFile>(&collections_index_path)?;
            let mut collections_dirty = false;
            for collection in &mut collections_index.items {
                let desired_path_ref =
                    format!("../collections/items/{}/collection.json", collection.collection_id);
                if collection.path_ref != desired_path_ref {
                    collection.path_ref = desired_path_ref;
                    collections_dirty = true;
                }
            }

            if collections_dirty {
                self.write_json_path(&collections_index_path, &collections_index)?;
            }

            self.materialize_collection_entry_documents_for_root(&self.root)?;
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

            let snapshot_collections_index_path = snapshot_root.join("indexes/collections.json");
            if snapshot_collections_index_path.exists() {
                self.normalize_collections_index_file(&snapshot_collections_index_path)?;
                self.materialize_collection_entry_documents_for_root(&snapshot_root)?;
            }
        }

        self.materialize_live_context_documents()?;

        Ok(())
    }

    fn materialize_collection_entry_documents_for_root(
        &self,
        workspace_root: &Path,
    ) -> Result<(), String> {
        let collections_index_path = workspace_root.join("indexes/collections.json");
        if !collections_index_path.exists() {
            return Ok(());
        }

        let collections_index =
            FileWorkspaceStore::read_json_path::<CollectionsIndexFile>(&collections_index_path)?;
        for collection in collections_index.items {
            let collection_path = workspace_root
                .join("collections")
                .join("items")
                .join(&collection.collection_id)
                .join("collection.json");
            if !collection_path.exists() {
                continue;
            }

            let collection_record =
                FileWorkspaceStore::read_json_path::<CollectionRecordFile>(&collection_path)?;
            let entry_shard_path = self.resolve_ref(&collection_path, &collection_record.entry_shard_ref);
            if !entry_shard_path.exists() {
                continue;
            }

            let entries = FileWorkspaceStore::read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?;
            self.materialize_collection_entry_documents_for_collection(
                &collection_path,
                &entry_shard_path,
                &collection_record,
                &entries,
            )?;
        }

        Ok(())
    }

    fn materialize_collection_entry_documents_for_collection(
        &self,
        collection_path: &Path,
        entry_shard_path: &Path,
        collection_record: &CollectionRecordFile,
        entries: &[CollectionEntryFile],
    ) -> Result<(), String> {
        let workspace_root = workspace_root_for_collection_path(collection_path)?;
        let collection_root = collection_path
            .parent()
            .ok_or_else(|| format!("collection path has no parent: {}", collection_path.display()))?;
        let entries_dir = collection_root.join("entries");
        fs::create_dir_all(&entries_dir)
            .map_err(|error| format!("failed to create {}: {error}", entries_dir.display()))?;

        let expected_ids = entries
            .iter()
            .map(|entry| entry.entry_id.as_str())
            .collect::<BTreeSet<_>>();

        for entry in entries {
            let entry_path = collection_entry_document_path_for_root(
                &workspace_root,
                &collection_record.collection_id,
                &entry.entry_id,
            );
            let entry_document = CollectionEntryDocumentFile {
                entry_id: entry.entry_id.clone(),
                collection_id: collection_record.collection_id.clone(),
                kind: collection_record.kind.clone(),
                source_ref: entry.source_ref.clone(),
                event_time: entry.event_time.clone(),
                ingested_at: entry.ingested_at.clone(),
                content_hash: entry.content_hash.clone(),
                preview: entry.preview.clone(),
                collection_ref: "../collection.json".into(),
                entry_shard_ref: "../entries.ndjson".into(),
                blob_ref: entry.blob_ref.clone(),
                blob_path_ref: entry
                    .blob_ref
                    .as_ref()
                    .map(|blob_ref| collection_entry_blob_path_ref(blob_ref)),
            };
            self.write_json_path(&entry_path, &entry_document)?;
        }

        for existing in fs::read_dir(&entries_dir)
            .map_err(|error| format!("failed to read {}: {error}", entries_dir.display()))?
        {
            let existing = existing.map_err(|error| format!("failed to read entry doc: {error}"))?;
            let path = existing.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }

            let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
                continue;
            };
            if expected_ids.contains(stem) {
                continue;
            }

            fs::remove_file(&path).map_err(|error| {
                format!("failed to remove stale entry doc {}: {error}", path.display())
            })?;
        }

        let _ = entry_shard_path;
        Ok(())
    }

    fn normalize_collections_index_file(&self, path: &Path) -> Result<(), String> {
        if !path.exists() {
            return Ok(());
        }

        let raw = fs::read_to_string(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        let collections_index = self.read_json_path::<CollectionsIndexFile>(path)?;
        let needs_rewrite = raw.contains("\"collections\"") || !raw.contains("\"items\"");

        if needs_rewrite {
            self.write_json_path(path, &collections_index)?;
        }

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
    fn import_preflight_blocks_activation_when_strategy_entrypoint_is_missing() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let export_bundle_ref = export_state
            .asset_inspector
            .latest_export_bundle_ref
            .clone()
            .expect("latest export bundle");
        let imported = repo
            .import_export_bundle(&export_bundle_ref)
            .expect("stage import");

        let import_workspace = repo.import_root_path(&imported.import_id).join("workspace");
        fs::remove_file(import_workspace.join("strategy.json")).expect("remove staged strategy");

        let import_detail = repo
            .load_import_detail(&imported.import_id)
            .expect("load staged import detail");
        assert_eq!(import_detail.preflight.status, "blocked");
        assert!(
            import_detail
                .preflight
                .checks
                .iter()
                .any(|check| check.id == "strategy-entrypoint" && check.severity == "blocked"),
            "preflight should flag the missing strategy entrypoint"
        );

        let error = match repo.activate_import_as_live(&imported.import_id) {
            Ok(_) => panic!("activation should fail when preflight is blocked"),
            Err(error) => error,
        };
        assert!(
            error.contains("failed activation preflight"),
            "activation should surface a preflight failure"
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
        let entry_document_path =
            repo.collection_entry_document_path(&result.collection_id, &result.entry_id);
        assert!(entry_document_path.exists(), "entry document should be materialized");

        let collection_detail = repo
            .load_collection_detail(&result.collection_id)
            .expect("collection detail");
        assert_eq!(
            collection_detail.entries[0].entry_path_ref,
            repo.display_path(&entry_document_path)
        );

        let bootstrap = repo.load_bootstrap_state().expect("bootstrap after ingest");
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|document| document.path_ref == repo.display_path(&entry_document_path) && document.category == "entry"),
            "entry document should be promoted into the workspace document catalog"
        );
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|document| document.path_ref == repo.display_path(&blob_path) && document.category == "blob"),
            "blob should be promoted into the workspace document catalog"
        );
        let entry_document = repo
            .load_workspace_document(&repo.display_path(&entry_document_path))
            .expect("entry document detail");
        assert!(
            entry_document
                .backlinks
                .iter()
                .any(|backlink| backlink.reason == "entry shard materializes entry document"),
            "entry document should backlink to the owning entry shard"
        );
        let blob_document = repo
            .load_workspace_document(&repo.display_path(&blob_path))
            .expect("blob document detail");
        assert!(
            blob_document
                .backlinks
                .iter()
                .any(|backlink| backlink.reason == "entry shard references blob"),
            "blob document should backlink to the owning entry shard"
        );
        assert!(
            blob_document
                .backlinks
                .iter()
                .any(|backlink| backlink.reason == "entry document references blob"),
            "blob document should backlink to the entry document as well"
        );

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
    fn export_checkpoint_materializes_bundle_for_existing_promotion_checkpoint() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        let initial = repo.load_bootstrap_state().expect("initial bootstrap");
        let promotion = initial
            .checkpoints
            .iter()
            .find(|checkpoint| checkpoint.r#type == "promotion")
            .expect("promotion checkpoint");

        let exported = repo
            .export_checkpoint(&promotion.id)
            .expect("export existing checkpoint");
        let exported_summary = exported
            .checkpoints
            .iter()
            .find(|checkpoint| checkpoint.id == promotion.id)
            .expect("exported checkpoint summary");

        assert!(
            exported_summary.export_bundle_ref.is_some(),
            "existing checkpoint should now advertise a sanitized export bundle"
        );
        assert_eq!(
            exported.asset_inspector.latest_export_bundle_ref,
            exported_summary.export_bundle_ref
        );
        assert!(
            repo.export_bundle_path(&promotion.id).exists(),
            "exporting an existing checkpoint should materialize the export bundle"
        );
        assert!(
            exported
                .operations
                .iter()
                .any(|operation| operation.kind == "export_checkpoint"),
            "exporting an existing checkpoint should append a workspace operation"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn export_checkpoint_excludes_protected_roots_from_sanitized_bundle() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

        fs::create_dir_all(root.join("secrets")).expect("create secrets dir");
        fs::create_dir_all(root.join("credentials")).expect("create credentials dir");
        fs::write(root.join("secrets/runtime.token"), "top-secret").expect("write secret");
        fs::write(root.join("credentials/binance.json"), "{\"api_key\":\"redacted\"}")
            .expect("write credential");

        let export_state = repo.create_export_checkpoint().expect("export checkpoint");
        let export_bundle_ref = export_state
            .asset_inspector
            .latest_export_bundle_ref
            .clone()
            .expect("latest export bundle ref");
        let export_bundle_path = repo.project_root().join(&export_bundle_ref);
        let export_bundle = repo
            .read_json_path::<ExportBundleFile>(&export_bundle_path)
            .expect("export bundle");
        let export_workspace = export_bundle_path
            .parent()
            .expect("export root")
            .join("workspace");

        for protected_root in [
            "checkpoints",
            "imports",
            "operations",
            "exports/generated",
            "secrets",
            "credentials",
        ] {
            assert!(
                !export_workspace.join(protected_root).exists(),
                "sanitized export should exclude protected root {protected_root}"
            );
        }

        assert!(
            export_bundle
                .excluded_paths
                .iter()
                .any(|path| path == "./workspace/imports"),
            "export manifest should declare imports as excluded"
        );
        assert!(
            export_bundle
                .excluded_paths
                .iter()
                .any(|path| path == "./workspace/operations"),
            "export manifest should declare operations as excluded"
        );
        assert!(
            export_bundle
                .included_refs
                .iter()
                .all(|path| !path.starts_with("./workspace/secrets") && !path.starts_with("./workspace/credentials")),
            "included refs should not leak secret-bearing roots"
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
        assert!(
            operations_index.items[0]
                .related_refs
                .iter()
                .any(|path| path.contains("/entries/") && path.ends_with(".json")),
            "ingest operation should retain the materialized entry document ref"
        );
        assert!(
            operations_index.items[1]
                .related_refs
                .iter()
                .any(|path| path.ends_with("state/dashboard.json")),
            "pause operation should retain the dashboard document ref"
        );
        assert!(
            operations_index.items[1]
                .related_refs
                .iter()
                .any(|path| path.ends_with("state/decisions.json")),
            "pause operation should retain the decision log ref"
        );

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
            detail
                .related_documents
                .iter()
                .any(|document| document.path_ref.ends_with("state/dashboard.json")),
            "operation detail should expose live dashboard state when it was mutated"
        );
        assert!(
            detail.unresolved_refs.is_empty(),
            "service-owned pause operation should resolve all related refs through the document catalog"
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
    fn load_bootstrap_state_promotes_live_state_documents_into_catalog() {
        let root = test_root();
        let template_root = WorkspaceRepository::default_template_root();
        let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");
        let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

        for (path_ref, expected_id) in [
            (&bootstrap.live_context.dashboard_ref, "live-dashboard"),
            (&bootstrap.live_context.decisions_ref, "live-decisions"),
            (&bootstrap.live_context.memory_ref, "live-memory"),
            (&bootstrap.live_context.positions_ref, "live-positions"),
            (&bootstrap.live_context.orders_ref, "live-orders"),
        ] {
            assert!(
                bootstrap
                    .document_catalog
                    .iter()
                    .any(|item| item.id == expected_id && item.path_ref == *path_ref),
                "{expected_id} should be promoted into the workspace document catalog"
            );

            let document = repo
                .load_workspace_document(path_ref)
                .expect("live state workspace document");
            assert!(
                document
                    .backlinks
                    .iter()
                    .any(|backlink| backlink.path_ref == bootstrap.asset_inspector.live_lane_ref),
                "{expected_id} should backlink to the live lane"
            );
        }

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
