use super::super::*;

pub(in crate::workspace) struct PauseAutomationTransition {
    pub live_lane: LiveLaneFile,
    pub runtime_status: RuntimeStatusFile,
    pub decisions: DecisionLogFile,
}

pub(in crate::workspace) struct DecisionUpdateTransition {
    pub runtime_status: RuntimeStatusFile,
    pub decisions: DecisionLogFile,
}

pub(in crate::workspace) fn pause_automation(
    live_lane: LiveLaneFile,
    mut runtime_status: RuntimeStatusFile,
    mut decisions: DecisionLogFile,
) -> PauseAutomationTransition {
    runtime_status.mode = TradingMode::Observer;
    runtime_status.automation_status = AutomationStatus::Paused;
    runtime_status.status_note = Some(
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

    PauseAutomationTransition {
        live_lane,
        runtime_status,
        decisions,
    }
}

pub(in crate::workspace) fn mark_restore_checkpoint(
    mut runtime_status: RuntimeStatusFile,
    mut decisions: DecisionLogFile,
    checkpoint_alias: &str,
) -> DecisionUpdateTransition {
    runtime_status.status_note = Some(format!(
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

    DecisionUpdateTransition {
        runtime_status,
        decisions,
    }
}

pub(in crate::workspace) fn mark_import_activation(
    mut runtime_status: RuntimeStatusFile,
    mut decisions: DecisionLogFile,
    import_id: &str,
    source_bundle_ref: &str,
    checkpoint_alias: &str,
) -> DecisionUpdateTransition {
    runtime_status.status_note = Some(format!(
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

    DecisionUpdateTransition {
        runtime_status,
        decisions,
    }
}

pub(in crate::workspace) struct FlattenAllTransition {
    pub runtime_status: RuntimeStatusFile,
    pub dashboard: DashboardStateFile,
    pub decisions: DecisionLogFile,
    pub positions: PositionsStateFile,
    pub orders: OrdersStateFile,
}

pub(in crate::workspace) fn flatten_all_live_state(
    mut runtime_status: RuntimeStatusFile,
    mut dashboard: DashboardStateFile,
    mut decisions: DecisionLogFile,
    mut positions: PositionsStateFile,
    mut orders: OrdersStateFile,
) -> FlattenAllTransition {
    runtime_status.automation_status = AutomationStatus::Intervention;
    runtime_status.status_note =
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

    FlattenAllTransition {
        runtime_status,
        dashboard,
        decisions,
        positions,
        orders,
    }
}
