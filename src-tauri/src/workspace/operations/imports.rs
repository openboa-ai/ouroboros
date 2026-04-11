use std::path::Path;

use super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn resolve_checkpoint_record_by_ref(
        &self,
        checkpoint_ref: &str,
    ) -> Result<Option<CheckpointRecordFile>, String> {
        let Some(checkpoint_id) = checkpoint_id_from_ref(checkpoint_ref) else {
            return Ok(None);
        };
        let checkpoint_path = self.checkpoint_file_path(&checkpoint_id);
        if !checkpoint_path.exists() {
            return Ok(None);
        }

        self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)
            .map(Some)
    }

    pub(in crate::workspace) fn build_import_preflight(
        &self,
        import_record: &ImportRecordFile,
        import_path: &Path,
        workspace_path: &Path,
    ) -> Result<ImportPreflightState, String> {
        let mut checks = Vec::new();

        let sanitized = import_record.sanitized;
        checks.push(ImportPreflightCheckState {
            id: "sanitized-bundle".into(),
            severity: if sanitized { "ok" } else { "blocked" }.into(),
            label: "Sanitized bundle".into(),
            detail: if sanitized {
                "Import bundle is marked sanitized and can be considered for live activation.".into()
            } else {
                "Import bundle is not sanitized and must never become live.".into()
            },
        });

        let workspace_exists = workspace_path.exists();
        checks.push(ImportPreflightCheckState {
            id: "workspace-root".into(),
            severity: if workspace_exists { "ok" } else { "blocked" }.into(),
            label: "Workspace root".into(),
            detail: if workspace_exists {
                format!("Staged workspace is present at {}.", self.display_path(workspace_path))
            } else {
                format!(
                    "Staged workspace is missing at {}.",
                    self.display_path(workspace_path)
                )
            },
        });

        if workspace_exists {
            let strategy_path = workspace_path.join("strategy.json");
            let strategy_exists = strategy_path.exists();
            checks.push(ImportPreflightCheckState {
                id: "strategy-entrypoint".into(),
                severity: if strategy_exists { "ok" } else { "blocked" }.into(),
                label: "strategy.json entrypoint".into(),
                detail: if strategy_exists {
                    format!(
                        "Import workspace exposes strategy entrypoint {}.",
                        self.display_path(&strategy_path)
                    )
                } else {
                    format!(
                        "Import workspace is missing strategy entrypoint {}.",
                        self.display_path(&strategy_path)
                    )
                },
            });

            if strategy_exists {
                let strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
                let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
                let export_policy_path =
                    self.resolve_ref(&strategy_path, &strategy.active.export_policy_ref);

                checks.push(ImportPreflightCheckState {
                    id: "live-lane-ref".into(),
                    severity: if live_lane_path.exists() { "ok" } else { "blocked" }.into(),
                    label: "Live lane ref".into(),
                    detail: if live_lane_path.exists() {
                        format!(
                            "Live lane file resolves to {}.",
                            self.display_path(&live_lane_path)
                        )
                    } else {
                        format!(
                            "Live lane ref points to missing file {}.",
                            self.display_path(&live_lane_path)
                        )
                    },
                });

                checks.push(ImportPreflightCheckState {
                    id: "export-policy-ref".into(),
                    severity: if export_policy_path.exists() { "ok" } else { "blocked" }.into(),
                    label: "Export policy ref".into(),
                    detail: if export_policy_path.exists() {
                        format!(
                            "Export policy resolves to {}.",
                            self.display_path(&export_policy_path)
                        )
                    } else {
                        format!(
                            "Export policy ref points to missing file {}.",
                            self.display_path(&export_policy_path)
                        )
                    },
                });

                if live_lane_path.exists() {
                    let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
                    for (check_id, label, path) in [
                        (
                            "dashboard-state",
                            "Dashboard state ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref),
                        ),
                        (
                            "decisions-state",
                            "Decision log ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref),
                        ),
                        (
                            "memory-state",
                            "Memory state ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref),
                        ),
                        (
                            "sessions-state",
                            "Sessions state ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref),
                        ),
                        (
                            "positions-state",
                            "Positions state ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref),
                        ),
                        (
                            "orders-state",
                            "Orders state ref",
                            self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref),
                        ),
                        (
                            "eval-summaries-state",
                            "Evaluation summaries ref",
                            self.resolve_ref(
                                &live_lane_path,
                                &live_lane.state_refs.eval_summaries_ref,
                            ),
                        ),
                    ] {
                        checks.push(ImportPreflightCheckState {
                            id: check_id.into(),
                            severity: if path.exists() { "ok" } else { "blocked" }.into(),
                            label: label.into(),
                            detail: if path.exists() {
                                format!("Required live state resolves to {}.", self.display_path(&path))
                            } else {
                                format!(
                                    "Required live state is missing at {}.",
                                    self.display_path(&path)
                                )
                            },
                        });
                    }
                }

                let checkpoint_status = match self
                    .resolve_checkpoint_record_by_ref(&import_record.checkpoint_ref)?
                {
                    Some(checkpoint) => (
                        "ok",
                        format!(
                            "Imported checkpoint ref resolves to local checkpoint {}.",
                            checkpoint.alias
                        ),
                    ),
                    None => (
                        "warning",
                        "Imported checkpoint ref does not resolve locally; activation will anchor a fresh local incident checkpoint.".into(),
                    ),
                };
                checks.push(ImportPreflightCheckState {
                    id: "checkpoint-ref".into(),
                    severity: checkpoint_status.0.into(),
                    label: "Checkpoint ref".into(),
                    detail: checkpoint_status.1,
                });
            }
        }

        let blocked_count = checks.iter().filter(|check| check.severity == "blocked").count();
        let warning_count = checks.iter().filter(|check| check.severity == "warning").count();
        let status = if blocked_count > 0 { "blocked" } else { "ready" };
        let summary = if blocked_count > 0 {
            format!(
                "{blocked_count} blocking issue(s) and {warning_count} warning(s) must be resolved before activation."
            )
        } else if warning_count > 0 {
            format!(
                "Activation is ready with {warning_count} warning(s); the service layer will compensate where possible."
            )
        } else {
            format!(
                "Activation is ready. Import manifest {} passed service-owned preflight.",
                self.display_path(import_path)
            )
        };

        Ok(ImportPreflightState {
            status: status.into(),
            summary,
            checks,
        })
    }
}
