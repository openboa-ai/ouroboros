use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::*;

impl WorkspaceRepository {
    pub(super) fn ensure_ready(&self) -> Result<(), String> {
        if self.root.join("strategy.json").exists() {
            copy_missing_template_tree(&self.template_root, &self.root)?;
            self.normalize_workspace()?;
            return Ok(());
        }

        copy_template_tree(&self.template_root, &self.root)?;
        self.normalize_workspace()?;
        Ok(())
    }

    pub(super) fn normalize_workspace(&self) -> Result<(), String> {
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

    pub(super) fn materialize_collection_entry_documents_for_root(
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
            let entry_shard_path =
                self.resolve_ref(&collection_path, &collection_record.entry_shard_ref);
            if !entry_shard_path.exists() {
                continue;
            }

            let entries =
                FileWorkspaceStore::read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?;
            self.materialize_collection_entry_documents_for_collection(
                &collection_path,
                &entry_shard_path,
                &collection_record,
                &entries,
            )?;
        }

        Ok(())
    }

    pub(super) fn materialize_collection_entry_documents_for_collection(
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

    pub(super) fn normalize_collections_index_file(&self, path: &Path) -> Result<(), String> {
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

    pub(super) fn materialize_live_context_documents(&self) -> Result<(), String> {
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

    pub(super) fn update_active_checkpoint_ref(&self, checkpoint_id: &str) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        strategy.active.current_checkpoint_ref =
            format!("./checkpoints/items/{checkpoint_id}/checkpoint.json");
        self.write_json_path(&strategy_path, &strategy)
    }

    pub(super) fn set_current_checkpoint(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Result<(), String> {
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

    pub(super) fn create_checkpoint(
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

    pub(super) fn replace_workspace_from_root(&self, source_root: &Path) -> Result<(), String> {
        if !source_root.exists() {
            return Err(format!(
                "source workspace root does not exist: {}",
                source_root.display()
            ));
        }

        let temp_root =
            std::env::temp_dir().join(format!("autokairos-workspace-mutation-{}", uuid_v7_string()));
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

    pub(super) fn clear_workspace_root(&self) -> Result<(), String> {
        for entry in fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read workspace root: {error}"))?
        {
            let entry = entry.map_err(|error| format!("failed to read workspace entry: {error}"))?;
            let path = entry.path();

            remove_path(&path)?;
        }

        Ok(())
    }

    pub(super) fn record_restore_decision(&self, checkpoint_alias: &str) -> Result<(), String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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

    pub(super) fn record_import_activation_decision(
        &self,
        import_id: &str,
        source_bundle_ref: &str,
        checkpoint_alias: &str,
    ) -> Result<(), String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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

    pub(super) fn materialize_checkpoint_snapshot(
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

    pub(super) fn create_export_bundle(
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
