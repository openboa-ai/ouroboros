use super::super::*;

pub(in crate::workspace) struct ExportCheckpointTransition {
    pub dashboard: DashboardStateFile,
    pub decisions: DecisionLogFile,
}

pub(in crate::workspace) fn excluded_paths() -> Vec<String> {
    vec![
        "./workspace/checkpoints".into(),
        "./workspace/imports".into(),
        "./workspace/operations".into(),
        "./workspace/exports/generated".into(),
        "./workspace/secrets".into(),
        "./workspace/credentials".into(),
    ]
}

pub(in crate::workspace) fn mark_export_checkpoint_created(
    mut dashboard: DashboardStateFile,
    mut decisions: DecisionLogFile,
) -> ExportCheckpointTransition {
    dashboard.status_note =
        Some("A fresh export checkpoint was created from the current live-centered asset.".into());
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

    ExportCheckpointTransition {
        dashboard,
        decisions,
    }
}

pub(in crate::workspace) fn build_export_bundle_file(
    checkpoint: &CheckpointRecordFile,
    policy_id: &str,
    included_refs: Vec<String>,
) -> ExportBundleFile {
    ExportBundleFile {
        export_id: checkpoint.checkpoint_id.clone(),
        checkpoint_ref: checkpoint.path_ref.clone(),
        policy_id: policy_id.into(),
        created_at: now_label(),
        sanitized: true,
        workspace_ref: "./workspace".into(),
        included_refs,
        excluded_paths: excluded_paths(),
    }
}
