use super::super::policies::exports as export_policies;
use super::super::*;

impl WorkspaceRepository {
    pub fn create_export_checkpoint(&self) -> Result<BootstrapState, String> {
        let checkpoint = self.create_checkpoint(
            "export",
            format!("export-{}", short_alias_suffix()),
            "Fresh export checkpoint created before generating a sanitized live-centered bundle."
                .into(),
            "Export policy sanitized-live-centered".into(),
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
        let export_policy_path = self.resolve_ref(
            &self.root.join("strategy.json"),
            &strategy.active.export_policy_ref,
        );

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;
        let transition = export_policies::mark_export_checkpoint_created(dashboard, decisions);

        self.write_json_path(&dashboard_path, &transition.dashboard)?;
        self.write_json_path(&decisions_path, &transition.decisions)?;
        self.create_export_bundle(&checkpoint, &export_policy.policy_id)?;
        self.append_operation(
            "create_export_checkpoint",
            "live",
            format!("Export checkpoint {} created for sanitized sharing.", checkpoint.alias),
            "The service layer created a fresh export checkpoint and materialized a live-centered sanitized export bundle.".into(),
            vec![
                self.display_path(&live_lane_path),
                self.display_path(&dashboard_path),
                self.display_path(&decisions_path),
                self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
                self.display_path(&self.export_bundle_path(&checkpoint.checkpoint_id)),
                self.display_path(&export_policy_path),
            ],
        )?;

        self.load_bootstrap_state()
    }

    pub fn export_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        let checkpoint_path = self.checkpoint_file_path(checkpoint_id);
        let checkpoint = self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)?;
        let strategy_path = self.root.join("strategy.json");
        let strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let export_policy_path =
            self.resolve_ref(&strategy_path, &strategy.active.export_policy_ref);
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;

        self.create_export_bundle(&checkpoint, &export_policy.policy_id)?;
        self.append_operation(
            "export_checkpoint",
            "workspace",
            format!(
                "Checkpoint {} exported as a sanitized bundle.",
                checkpoint.alias
            ),
            "The service layer materialized a sanitized export bundle from an existing checkpoint without mutating the current live lane.".into(),
            vec![
                self.display_path(&checkpoint_path),
                self.display_path(&self.export_bundle_path(&checkpoint.checkpoint_id)),
                self.display_path(&export_policy_path),
            ],
        )?;

        self.load_bootstrap_state()
    }
}
