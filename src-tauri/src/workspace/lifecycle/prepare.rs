use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use super::super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn ensure_ready(&self) -> Result<(), String> {
        if self.root.join("strategy.json").exists() {
            copy_missing_template_tree(&self.template_root, &self.root)?;
            self.normalize_workspace()?;
            return Ok(());
        }

        copy_template_tree(&self.template_root, &self.root)?;
        self.normalize_workspace()?;
        Ok(())
    }

    pub(in crate::workspace) fn normalize_workspace(&self) -> Result<(), String> {
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
        let desired_orchestrator_ref = default_orchestrator_ref();
        let desired_agents_ref = default_agents_ref();
        let desired_environments_ref = default_environments_ref();
        let desired_imports_ref = default_imports_ref();
        let desired_operations_ref = default_operations_ref();
        let mut strategy_dirty = false;
        if strategy.active.current_checkpoint_ref != desired_ref {
            strategy.active.current_checkpoint_ref = desired_ref;
            strategy_dirty = true;
        }
        if strategy.active.orchestrator_ref != desired_orchestrator_ref {
            strategy.active.orchestrator_ref = desired_orchestrator_ref;
            strategy_dirty = true;
        }
        if strategy.indexes.agents_ref != desired_agents_ref {
            strategy.indexes.agents_ref = desired_agents_ref;
            strategy_dirty = true;
        }
        if strategy.indexes.environments_ref != desired_environments_ref {
            strategy.indexes.environments_ref = desired_environments_ref;
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

        self.normalize_managed_agent_documents(&strategy_path, &strategy)?;
        self.normalize_orchestrator_document(&strategy_path, &strategy)?;

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

    pub(in crate::workspace) fn normalize_orchestrator_document(
        &self,
        strategy_path: &Path,
        strategy: &StrategyManifestFile,
    ) -> Result<(), String> {
        let orchestrator_path =
            self.resolve_ref(strategy_path, &strategy.active.orchestrator_ref);
        if !orchestrator_path.exists() {
            return Ok(());
        }

        let mut orchestrator = self.read_json_path::<OrchestratorFile>(&orchestrator_path)?;
        let mut dirty = false;
        let expected_refs = [
            ("agents_ref", "../agents/index.json"),
            ("environments_ref", "../environments/index.json"),
            ("sessions_ref", "../indexes/sessions.json"),
            ("live_lane_ref", "../live/live-lane.json"),
        ];

        for (key, expected_ref) in expected_refs {
            let current_ref = match key {
                "agents_ref" => &mut orchestrator.topology_refs.agents_ref,
                "environments_ref" => &mut orchestrator.topology_refs.environments_ref,
                "sessions_ref" => &mut orchestrator.topology_refs.sessions_ref,
                "live_lane_ref" => &mut orchestrator.topology_refs.live_lane_ref,
                _ => continue,
            };
            if current_ref != expected_ref {
                *current_ref = expected_ref.into();
                dirty = true;
            }
        }

        if dirty {
            self.write_json_path(&orchestrator_path, &orchestrator)?;
        }

        Ok(())
    }

    pub(in crate::workspace) fn normalize_managed_agent_documents(
        &self,
        strategy_path: &Path,
        strategy: &StrategyManifestFile,
    ) -> Result<(), String> {
        let agents_index_path = self.resolve_ref(strategy_path, &strategy.indexes.agents_ref);
        let environments_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.environments_ref);
        if !agents_index_path.exists() || !environments_index_path.exists() {
            return Ok(());
        }

        let environments_index =
            self.read_json_path::<EnvironmentsIndexFile>(&environments_index_path)?;
        let environment_ids = environments_index
            .environments
            .iter()
            .map(|environment| environment.id.as_str())
            .collect::<BTreeSet<_>>();
        let agents_index = self.read_json_path::<AgentsIndexFile>(&agents_index_path)?;

        for agent in &agents_index.agents {
            let agent_path = self.resolve_ref(&agents_index_path, &agent.definition_ref);
            if !agent_path.exists() {
                continue;
            }

            let mut agent_record = self.read_json_path::<AgentRecordFile>(&agent_path)?;
            let mut dirty = false;

            if let Some(environment_id) = environment_id_from_ref(&agent_record.environment_ref) {
                let desired_environment_ref = format!(
                    "../../../environments/items/{environment_id}/environment.json"
                );
                if environment_ids.contains(environment_id.as_str())
                    && agent_record.environment_ref != desired_environment_ref
                {
                    agent_record.environment_ref = desired_environment_ref;
                    dirty = true;
                }
            }

            let expected_workspace_refs = [
                ("live_lane_ref", "../../../live/live-lane.json"),
                ("sessions_ref", "../../../indexes/sessions.json"),
                ("eval_summaries_ref", "../../../state/eval-summaries.json"),
                ("collections_ref", "../../../indexes/collections.json"),
            ];

            if let Some(workspace_refs) = agent_record.workspace_refs.as_object_mut() {
                for (key, expected_ref) in expected_workspace_refs {
                    let Some(current) = workspace_refs.get_mut(key) else {
                        continue;
                    };
                    if current.as_str() == Some(expected_ref) {
                        continue;
                    }
                    *current = serde_json::Value::String(expected_ref.into());
                    dirty = true;
                }
            }

            if dirty {
                self.write_json_path(&agent_path, &agent_record)?;
            }
        }

        Ok(())
    }

    pub(in crate::workspace) fn materialize_collection_entry_documents_for_root(
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

    pub(in crate::workspace) fn materialize_collection_entry_documents_for_collection(
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

    pub(in crate::workspace) fn normalize_collections_index_file(&self, path: &Path) -> Result<(), String> {
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

    pub(in crate::workspace) fn materialize_live_context_documents(&self) -> Result<(), String> {
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
}

fn environment_id_from_ref(reference: &str) -> Option<String> {
    let clean_reference = reference.split('#').next().unwrap_or(reference);
    Path::new(clean_reference)
        .parent()
        .and_then(Path::file_name)
        .and_then(|value| value.to_str())
        .map(str::to_string)
}
