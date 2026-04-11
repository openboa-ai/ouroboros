use super::super::*;

impl WorkspaceRepository {
    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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
        let live_lane_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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
