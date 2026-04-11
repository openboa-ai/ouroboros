use std::fs;
use std::path::{Path, PathBuf};

use super::super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn update_active_checkpoint_ref(&self, checkpoint_id: &str) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        strategy.active.current_checkpoint_ref =
            format!("./checkpoints/items/{checkpoint_id}/checkpoint.json");
        self.write_json_path(&strategy_path, &strategy)
    }

    pub(in crate::workspace) fn set_current_checkpoint(
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

    pub(in crate::workspace) fn create_checkpoint(
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

    pub(in crate::workspace) fn replace_workspace_from_root(&self, source_root: &Path) -> Result<(), String> {
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

    pub(in crate::workspace) fn clear_workspace_root(&self) -> Result<(), String> {
        for entry in fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read workspace root: {error}"))?
        {
            let entry = entry.map_err(|error| format!("failed to read workspace entry: {error}"))?;
            let path = entry.path();

            remove_path(&path)?;
        }

        Ok(())
    }

    pub(in crate::workspace) fn record_restore_decision(&self, checkpoint_alias: &str) -> Result<(), String> {
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

    pub(in crate::workspace) fn record_import_activation_decision(
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

    pub(in crate::workspace) fn materialize_checkpoint_snapshot(
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

    pub(in crate::workspace) fn create_export_bundle(
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
