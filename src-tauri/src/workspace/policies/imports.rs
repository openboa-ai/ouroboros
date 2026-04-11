use std::path::{Path, PathBuf};

use super::super::*;

pub(in crate::workspace) fn build_import_preflight(
    repo: &WorkspaceRepository,
    import_record: &ImportRecordFile,
    import_path: &Path,
    workspace_path: &Path,
) -> Result<ImportPreflightState, String> {
    let mut builder = ImportPreflightBuilder::new(repo, import_path);

    builder.push(
        "sanitized-bundle",
        if import_record.sanitized {
            "ok"
        } else {
            "blocked"
        },
        "Sanitized bundle",
        if import_record.sanitized {
            "Import bundle is marked sanitized and can be considered for live activation.".into()
        } else {
            "Import bundle is not sanitized and must never become live.".into()
        },
    );

    let workspace_exists = workspace_path.exists();
    builder.push_path_check(
        "workspace-root",
        "Workspace root",
        workspace_path,
        workspace_exists,
        "Staged workspace is present",
        "Staged workspace is missing",
    );

    if !workspace_exists {
        return Ok(builder.finish());
    }

    let strategy_path = workspace_path.join("strategy.json");
    let strategy_exists = strategy_path.exists();
    builder.push_path_check(
        "strategy-entrypoint",
        "strategy.json entrypoint",
        &strategy_path,
        strategy_exists,
        "Import workspace exposes strategy entrypoint",
        "Import workspace is missing strategy entrypoint",
    );

    if !strategy_exists {
        return Ok(builder.finish());
    }

    let strategy = repo.read_json_path::<StrategyManifestFile>(&strategy_path)?;
    let targets = ImportActivationTargets::from_strategy(repo, &strategy_path, &strategy)?;

    builder.push_path_check(
        "orchestrator-ref",
        "Orchestrator ref",
        &targets.orchestrator_path,
        targets.orchestrator_path.exists(),
        "Orchestrator resolves to",
        "Orchestrator ref points to missing file",
    );
    builder.push_path_check(
        "live-lane-ref",
        "Live lane ref",
        &targets.live_lane_path,
        targets.live_lane_path.exists(),
        "Live lane file resolves to",
        "Live lane ref points to missing file",
    );
    builder.push_path_check(
        "export-policy-ref",
        "Export policy ref",
        &targets.export_policy_path,
        targets.export_policy_path.exists(),
        "Export policy resolves to",
        "Export policy ref points to missing file",
    );
    builder.push_path_check(
        "agents-index-ref",
        "Agents index ref",
        &targets.agents_index_path,
        targets.agents_index_path.exists(),
        "Agents index resolves to",
        "Agents index ref points to missing file",
    );
    builder.push_path_check(
        "environments-index-ref",
        "Environments index ref",
        &targets.environments_index_path,
        targets.environments_index_path.exists(),
        "Environments index resolves to",
        "Environments index ref points to missing file",
    );

    if targets.live_lane_path.exists() {
        let live_lane = repo.read_json_path::<LiveLaneFile>(&targets.live_lane_path)?;
        for (check_id, label, path) in [
            (
                "dashboard-state",
                "Dashboard state ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.dashboard_ref),
            ),
            (
                "decisions-state",
                "Decision log ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.decisions_ref),
            ),
            (
                "memory-state",
                "Memory state ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.memory_ref),
            ),
            (
                "sessions-state",
                "Sessions state ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.sessions_ref),
            ),
            (
                "positions-state",
                "Positions state ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.positions_ref),
            ),
            (
                "orders-state",
                "Orders state ref",
                repo.resolve_ref(&targets.live_lane_path, &live_lane.state_refs.orders_ref),
            ),
            (
                "eval-summaries-state",
                "Evaluation summaries ref",
                repo.resolve_ref(
                    &targets.live_lane_path,
                    &live_lane.state_refs.eval_summaries_ref,
                ),
            ),
        ] {
            builder.push_path_check(
                check_id,
                label,
                &path,
                path.exists(),
                "Required live state resolves to",
                "Required live state is missing at",
            );
        }
    }

    if targets.orchestrator_path.exists() {
        let orchestrator = repo.read_json_path::<OrchestratorFile>(&targets.orchestrator_path)?;
        for (check_id, label, path) in [
            (
                "orchestrator-agents-ref",
                "Orchestrator agents ref",
                repo.resolve_ref(
                    &targets.orchestrator_path,
                    &orchestrator.topology_refs.agents_ref,
                ),
            ),
            (
                "orchestrator-environments-ref",
                "Orchestrator environments ref",
                repo.resolve_ref(
                    &targets.orchestrator_path,
                    &orchestrator.topology_refs.environments_ref,
                ),
            ),
            (
                "orchestrator-sessions-ref",
                "Orchestrator sessions ref",
                repo.resolve_ref(
                    &targets.orchestrator_path,
                    &orchestrator.topology_refs.sessions_ref,
                ),
            ),
            (
                "orchestrator-live-lane-ref",
                "Orchestrator live lane ref",
                repo.resolve_ref(
                    &targets.orchestrator_path,
                    &orchestrator.topology_refs.live_lane_ref,
                ),
            ),
        ] {
            builder.push_path_check(
                check_id,
                label,
                &path,
                path.exists(),
                "Orchestrator topology ref resolves to",
                "Orchestrator topology ref points to missing file",
            );
        }
    }

    if targets.agents_index_path.exists() {
        let agents_index = repo.read_json_path::<AgentsIndexFile>(&targets.agents_index_path)?;
        let missing_agent_defs = agents_index
            .agents
            .iter()
            .filter(|agent| {
                !repo
                    .resolve_ref(&targets.agents_index_path, &agent.definition_ref)
                    .exists()
            })
            .count();
        builder.push(
            "agent-definitions",
            if missing_agent_defs == 0 {
                "ok"
            } else {
                "blocked"
            },
            "Agent definitions",
            if missing_agent_defs == 0 {
                format!(
                    "All {} managed-agent definitions resolve from the agents index.",
                    agents_index.agents.len()
                )
            } else {
                format!("{missing_agent_defs} managed-agent definition ref(s) are missing.")
            },
        );

        let invalid_agent_environments = agents_index
            .agents
            .iter()
            .filter_map(|agent| {
                let agent_path =
                    repo.resolve_ref(&targets.agents_index_path, &agent.definition_ref);
                let agent_record = repo.read_json_path::<AgentRecordFile>(&agent_path).ok()?;
                let environment_path = repo.resolve_ref(&agent_path, &agent_record.environment_ref);
                (!environment_path.exists()).then_some(agent_record.name)
            })
            .count();
        builder.push(
            "agent-environment-links",
            if invalid_agent_environments == 0 { "ok" } else { "blocked" },
            "Agent environment links",
            if invalid_agent_environments == 0 {
                "Every managed-agent definition resolves its environment ref.".into()
            } else {
                format!(
                    "{invalid_agent_environments} managed-agent definition(s) point to missing environment refs."
                )
            },
        );
    }

    if targets.environments_index_path.exists() {
        let environments_index =
            repo.read_json_path::<EnvironmentsIndexFile>(&targets.environments_index_path)?;
        let missing_environment_defs = environments_index
            .environments
            .iter()
            .filter(|environment| {
                !repo
                    .resolve_ref(
                        &targets.environments_index_path,
                        &environment.definition_ref,
                    )
                    .exists()
            })
            .count();
        builder.push(
            "environment-definitions",
            if missing_environment_defs == 0 {
                "ok"
            } else {
                "blocked"
            },
            "Environment definitions",
            if missing_environment_defs == 0 {
                format!(
                    "All {} environment definitions resolve from the environments index.",
                    environments_index.environments.len()
                )
            } else {
                format!("{missing_environment_defs} environment definition ref(s) are missing.")
            },
        );
    }

    match repo.resolve_checkpoint_record_by_ref(&import_record.checkpoint_ref)? {
        Some(checkpoint) => builder.push(
            "checkpoint-ref",
            "ok",
            "Checkpoint ref",
            format!(
                "Imported checkpoint ref resolves to local checkpoint {}.",
                checkpoint.alias
            ),
        ),
        None => builder.push(
            "checkpoint-ref",
            "warning",
            "Checkpoint ref",
            "Imported checkpoint ref does not resolve locally; activation will anchor a fresh local incident checkpoint.".into(),
        ),
    }

    Ok(builder.finish())
}

struct ImportActivationTargets {
    orchestrator_path: PathBuf,
    live_lane_path: PathBuf,
    export_policy_path: PathBuf,
    agents_index_path: PathBuf,
    environments_index_path: PathBuf,
}

impl ImportActivationTargets {
    fn from_strategy(
        repo: &WorkspaceRepository,
        strategy_path: &Path,
        strategy: &StrategyManifestFile,
    ) -> Result<Self, String> {
        Ok(Self {
            orchestrator_path: repo.resolve_ref(strategy_path, &strategy.active.orchestrator_ref),
            live_lane_path: repo.resolve_ref(strategy_path, &strategy.active.live_lane_ref),
            export_policy_path: repo.resolve_ref(strategy_path, &strategy.active.export_policy_ref),
            agents_index_path: repo.resolve_ref(strategy_path, &strategy.indexes.agents_ref),
            environments_index_path: repo
                .resolve_ref(strategy_path, &strategy.indexes.environments_ref),
        })
    }
}

struct ImportPreflightBuilder<'a> {
    repo: &'a WorkspaceRepository,
    import_path: &'a Path,
    checks: Vec<ImportPreflightCheckState>,
}

impl<'a> ImportPreflightBuilder<'a> {
    fn new(repo: &'a WorkspaceRepository, import_path: &'a Path) -> Self {
        Self {
            repo,
            import_path,
            checks: Vec::new(),
        }
    }

    fn push(&mut self, id: &str, severity: &str, label: &str, detail: String) {
        self.checks.push(ImportPreflightCheckState {
            id: id.into(),
            severity: severity.into(),
            label: label.into(),
            detail,
        });
    }

    fn push_path_check(
        &mut self,
        id: &str,
        label: &str,
        path: &Path,
        exists: bool,
        ok_prefix: &str,
        blocked_prefix: &str,
    ) {
        let detail = if exists {
            format!("{ok_prefix} {}.", self.repo.display_path(path))
        } else {
            format!("{blocked_prefix} {}.", self.repo.display_path(path))
        };
        self.push(id, if exists { "ok" } else { "blocked" }, label, detail);
    }

    fn finish(self) -> ImportPreflightState {
        let blocked_count = self
            .checks
            .iter()
            .filter(|check| check.severity == "blocked")
            .count();
        let warning_count = self
            .checks
            .iter()
            .filter(|check| check.severity == "warning")
            .count();
        let status = if blocked_count > 0 {
            "blocked"
        } else {
            "ready"
        };
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
                self.repo.display_path(self.import_path)
            )
        };

        ImportPreflightState {
            status: status.into(),
            summary,
            checks: self.checks,
        }
    }
}
