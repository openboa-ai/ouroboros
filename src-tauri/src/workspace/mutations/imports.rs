use std::fs;
use std::path::PathBuf;

use super::super::*;

impl WorkspaceRepository {
    pub fn import_export_bundle(&self, bundle_ref: &str) -> Result<ImportBundleState, String> {
        let source_bundle_path = self.resolve_import_bundle_ref(bundle_ref)?;
        let export_bundle = self.read_json_path::<ExportBundleFile>(&source_bundle_path)?;
        if !export_bundle.sanitized {
            return Err(format!(
                "refusing to import non-sanitized export bundle: {}",
                source_bundle_path.display()
            ));
        }

        let source_root = source_bundle_path.parent().ok_or_else(|| {
            format!(
                "export bundle has no parent directory: {}",
                source_bundle_path.display()
            )
        })?;
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
        fs::create_dir_all(&bundle_destination).map_err(|error| {
            format!("failed to create {}: {error}", bundle_destination.display())
        })?;
        copy_tree(
            &source_bundle_path,
            &bundle_destination.join("export.json"),
            &PathBuf::from("export.json"),
        )?;

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
        let preflight =
            self.build_import_preflight(&import_record, &import_path, &import_workspace)?;
        if preflight.status != "ready" {
            return Err(format!(
                "import {} failed activation preflight: {}",
                import_id, preflight.summary
            ));
        }
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
        let strategy =
            self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(
            &self.root.join("strategy.json"),
            &strategy.active.live_lane_ref,
        );
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let memory_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);
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
                self.display_path(&live_lane_path),
                self.display_path(&dashboard_path),
                self.display_path(&decisions_path),
                self.display_path(&memory_path),
                self.display_path(&positions_path),
                self.display_path(&orders_path),
                self.display_path(&self.checkpoint_file_path(&activated_checkpoint.checkpoint_id)),
            ],
        )?;

        self.load_bootstrap_state()
    }
}
