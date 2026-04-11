use super::super::policies::live as live_policies;
use super::super::*;

impl WorkspaceRepository {
    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        let strategy =
            self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(
            &self.root.join("strategy.json"),
            &strategy.active.live_lane_ref,
        );
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let transition = live_policies::pause_automation(live_lane, dashboard, decisions);

        self.write_json_path(&live_lane_path, &transition.live_lane)?;
        self.write_json_path(&dashboard_path, &transition.dashboard)?;
        self.write_json_path(&decisions_path, &transition.decisions)?;
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
        let strategy =
            self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(
            &self.root.join("strategy.json"),
            &strategy.active.live_lane_ref,
        );
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let positions = self.read_json_path::<PositionsStateFile>(&positions_path)?;
        let orders = self.read_json_path::<OrdersStateFile>(&orders_path)?;
        let transition =
            live_policies::flatten_all_live_state(dashboard, decisions, positions, orders);

        self.write_json_path(&dashboard_path, &transition.dashboard)?;
        self.write_json_path(&decisions_path, &transition.decisions)?;
        self.write_json_path(&positions_path, &transition.positions)?;
        self.write_json_path(&orders_path, &transition.orders)?;

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

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<BootstrapState, String> {
        let target_checkpoint_path = self.checkpoint_file_path(checkpoint_id);
        let target_checkpoint =
            self.read_json_path::<CheckpointRecordFile>(&target_checkpoint_path)?;
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
            "restore_checkpoint",
            "live",
            format!("Live workspace restored from checkpoint {}.", target_alias),
            "The service layer restored the selected checkpoint snapshot as the active live workspace and preserved the rollback anchor as an incident checkpoint.".into(),
            vec![
                self.display_path(&target_checkpoint_path),
                self.display_path(&self.root.join("strategy.json")),
                self.display_path(&live_lane_path),
                self.display_path(&dashboard_path),
                self.display_path(&decisions_path),
                self.display_path(&memory_path),
                self.display_path(&positions_path),
                self.display_path(&orders_path),
            ],
        )?;

        self.load_bootstrap_state()
    }
}
