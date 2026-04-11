use std::collections::BTreeMap;
use std::path::PathBuf;

use super::*;
use crate::models::{
    AgentRuntimeState, EnvironmentRuntimeState, OrchestratorRuntimeState,
    OrchestratorTopologyRefsState, RuntimeTopologyState, RuntimeTopologyWorkspaceRefState,
};

struct BootstrapPaths {
    strategy_path: PathBuf,
    orchestrator_path: PathBuf,
    live_lane_path: PathBuf,
    runtime_status_path: PathBuf,
    export_policy_path: PathBuf,
    checkpoints_index_path: PathBuf,
    agents_index_path: PathBuf,
    environments_index_path: PathBuf,
    adapters_index_path: PathBuf,
    collections_index_path: PathBuf,
    evaluations_index_path: PathBuf,
    imports_index_path: PathBuf,
    operations_index_path: PathBuf,
    dashboard_path: PathBuf,
    decisions_path: PathBuf,
    memory_path: PathBuf,
    sessions_path: PathBuf,
    positions_path: PathBuf,
    orders_path: PathBuf,
    eval_summaries_path: PathBuf,
}

struct BootstrapFiles {
    strategy: StrategyManifestFile,
    orchestrator: OrchestratorFile,
    live_lane: LiveLaneFile,
    export_policy: ExportPolicyFile,
    checkpoints_index: CheckpointIndexFile,
    agents_index: AgentsIndexFile,
    environments_index: EnvironmentsIndexFile,
    adapters_index: AdaptersIndexFile,
    collections_index: CollectionsIndexFile,
    evaluations_index: EvaluationsIndexFile,
    imports_index: ImportsIndexFile,
    operations_index: OperationsIndexFile,
    runtime_status: RuntimeStatusFile,
    dashboard: DashboardStateFile,
    decisions: DecisionLogFile,
    live_memory: LiveMemoryFile,
    sessions: SessionsIndexFile,
    positions: PositionsStateFile,
    orders: OrdersStateFile,
    eval_summaries: EvalSummariesFile,
}

struct BootstrapContext {
    paths: BootstrapPaths,
    files: BootstrapFiles,
    current_checkpoint_path: PathBuf,
    export_inventory: ExportInventory,
    latest_export_bundle: Option<ExportBundleState>,
    document_catalog: Vec<WorkspaceCatalogEntryState>,
}

impl WorkspaceRepository {
    pub fn load_bootstrap_state(&self) -> Result<BootstrapState, String> {
        let context = self.load_bootstrap_context()?;
        Ok(self.build_bootstrap_state(context))
    }

    fn load_bootstrap_context(&self) -> Result<BootstrapContext, String> {
        let strategy_path = self.root.join("strategy.json");
        let strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let paths = self.resolve_bootstrap_paths(&strategy_path, &strategy)?;
        let files = self.load_bootstrap_files(strategy, &paths)?;
        let current_checkpoint_path = self.resolve_current_checkpoint_path(
            &paths.strategy_path,
            &files.strategy.active.current_checkpoint_ref,
            &files.checkpoints_index,
        );
        let export_inventory = self.export_inventory(&files.checkpoints_index.items);
        let latest_export_bundle = self.latest_export_bundle(&files.checkpoints_index.items)?;
        let document_catalog = self.build_document_catalog(
            &paths.strategy_path,
            &paths.orchestrator_path,
            &paths.live_lane_path,
            &paths.runtime_status_path,
            &paths.dashboard_path,
            &paths.decisions_path,
            &paths.memory_path,
            &paths.positions_path,
            &paths.orders_path,
            &paths.export_policy_path,
            &current_checkpoint_path,
            &paths.checkpoints_index_path,
            &paths.agents_index_path,
            &files.agents_index,
            &paths.environments_index_path,
            &files.environments_index,
            &paths.adapters_index_path,
            &files.adapters_index,
            &paths.collections_index_path,
            &files.collections_index,
            &paths.evaluations_index_path,
            &files.evaluations_index,
            &paths.imports_index_path,
            &files.imports_index,
            &paths.operations_index_path,
            &files.operations_index,
            &paths.sessions_path,
            &files.sessions,
            &paths.eval_summaries_path,
            &files.eval_summaries,
            export_inventory.latest_ref.as_deref(),
        );

        Ok(BootstrapContext {
            paths,
            files,
            current_checkpoint_path,
            export_inventory,
            latest_export_bundle,
            document_catalog,
        })
    }

    fn resolve_bootstrap_paths(
        &self,
        strategy_path: &Path,
        strategy: &StrategyManifestFile,
    ) -> Result<BootstrapPaths, String> {
        let live_lane_path = self.resolve_ref(strategy_path, &strategy.active.live_lane_ref);
        let orchestrator_path = self.resolve_ref(strategy_path, &strategy.active.orchestrator_ref);
        let export_policy_path =
            self.resolve_ref(strategy_path, &strategy.active.export_policy_ref);
        let checkpoints_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.checkpoints_ref);
        let agents_index_path = self.resolve_ref(strategy_path, &strategy.indexes.agents_ref);
        let environments_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.environments_ref);
        let adapters_index_path = self.resolve_ref(strategy_path, &strategy.indexes.adapters_ref);
        let collections_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.collections_ref);
        let evaluations_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.evaluations_ref);
        let imports_index_path = self.resolve_ref(strategy_path, &strategy.indexes.imports_ref);
        let operations_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.operations_ref);

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;

        Ok(BootstrapPaths {
            strategy_path: strategy_path.to_path_buf(),
            orchestrator_path,
            runtime_status_path: self
                .resolve_ref(&live_lane_path, &live_lane.state_refs.runtime_status_ref),
            dashboard_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref),
            decisions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref),
            memory_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref),
            sessions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref),
            positions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref),
            orders_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref),
            eval_summaries_path: self
                .resolve_ref(&live_lane_path, &live_lane.state_refs.eval_summaries_ref),
            live_lane_path,
            export_policy_path,
            checkpoints_index_path,
            agents_index_path,
            environments_index_path,
            adapters_index_path,
            collections_index_path,
            evaluations_index_path,
            imports_index_path,
            operations_index_path,
        })
    }

    fn load_bootstrap_files(
        &self,
        strategy: StrategyManifestFile,
        paths: &BootstrapPaths,
    ) -> Result<BootstrapFiles, String> {
        let orchestrator = self.read_json_path::<OrchestratorFile>(&paths.orchestrator_path)?;
        let live_lane = self.read_json_path::<LiveLaneFile>(&paths.live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&paths.export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&paths.checkpoints_index_path)?;
        let agents_index = self.read_json_path::<AgentsIndexFile>(&paths.agents_index_path)?;
        let environments_index =
            self.read_json_path::<EnvironmentsIndexFile>(&paths.environments_index_path)?;
        let adapters_index =
            self.read_json_path::<AdaptersIndexFile>(&paths.adapters_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&paths.collections_index_path)?;
        let evaluations_index = if paths.evaluations_index_path.exists() {
            self.read_json_path::<EvaluationsIndexFile>(&paths.evaluations_index_path)?
        } else {
            EvaluationsIndexFile { items: Vec::new() }
        };
        let imports_index = if paths.imports_index_path.exists() {
            self.read_json_path::<ImportsIndexFile>(&paths.imports_index_path)?
        } else {
            ImportsIndexFile { items: Vec::new() }
        };
        let operations_index = if paths.operations_index_path.exists() {
            self.read_json_path::<OperationsIndexFile>(&paths.operations_index_path)?
        } else {
            OperationsIndexFile { items: Vec::new() }
        };

        Ok(BootstrapFiles {
            strategy,
            orchestrator,
            live_lane,
            export_policy,
            checkpoints_index,
            agents_index,
            environments_index,
            adapters_index,
            collections_index,
            evaluations_index,
            imports_index,
            operations_index,
            runtime_status: self.read_json_path::<RuntimeStatusFile>(&paths.runtime_status_path)?,
            dashboard: self.read_json_path::<DashboardStateFile>(&paths.dashboard_path)?,
            decisions: self.read_json_path::<DecisionLogFile>(&paths.decisions_path)?,
            live_memory: self.read_json_path::<LiveMemoryFile>(&paths.memory_path)?,
            sessions: self.read_json_path::<SessionsIndexFile>(&paths.sessions_path)?,
            positions: self.read_json_path::<PositionsStateFile>(&paths.positions_path)?,
            orders: self.read_json_path::<OrdersStateFile>(&paths.orders_path)?,
            eval_summaries: self.read_json_path::<EvalSummariesFile>(&paths.eval_summaries_path)?,
        })
    }

    fn build_bootstrap_state(&self, context: BootstrapContext) -> BootstrapState {
        let workspace = self.build_workspace_summary(&context.files);
        let asset_inspector = self.build_asset_inspector_state(
            &context.paths,
            &context.files,
            &context.current_checkpoint_path,
            &context.export_inventory,
        );
        let workspace_index = self.build_workspace_index_state(
            &context.paths,
            &context.files,
            &context.current_checkpoint_path,
        );
        let runtime_topology = self.build_runtime_topology_state(&context.paths, &context.files);
        let live_context = self.build_live_context_state(&context.paths, &context.files);
        let export_inspector =
            self.build_export_inspector_state(&context.files, context.latest_export_bundle);
        let checkpoints = self.build_checkpoint_summaries(&context.files.checkpoints_index);
        let adapters = self.build_adapter_states(
            &context.paths.adapters_index_path,
            &context.files.adapters_index,
        );
        let collections = self.build_collection_summaries(&context.files.collections_index);
        let evaluation_runs = self.build_evaluation_run_summaries(&context.files.evaluations_index);
        let imports = self.build_import_summaries(&context.files.imports_index);
        let operations = self.build_operation_summaries(&context.files.operations_index);
        let lane_events = lane_event_feed(
            &context.files.positions.events,
            &context.files.orders.events,
        );

        let BootstrapContext {
            files,
            document_catalog,
            ..
        } = context;

        BootstrapState {
            mode: files.runtime_status.mode,
            automation_status: files.runtime_status.automation_status,
            status_note: files.runtime_status.status_note,
            workspace,
            asset_inspector,
            workspace_index,
            runtime_topology,
            live_context,
            export_inspector,
            adapters,
            providers: files.dashboard.providers,
            metrics: files.dashboard.metrics,
            price_series: files.dashboard.price_series,
            equity_series: files.dashboard.equity_series,
            exposure_series: files.dashboard.exposure_series,
            positions: files.positions.current,
            orders: files.orders.current,
            lane_events,
            decisions: files.decisions.decisions,
            checkpoints,
            collections,
            evaluation_runs,
            imports,
            operations,
            document_catalog,
        }
    }

    fn build_workspace_summary(&self, files: &BootstrapFiles) -> WorkspaceSummary {
        WorkspaceSummary {
            artifact_id: files.strategy.artifact_id.clone(),
            slug: files.strategy.slug.clone(),
            live_lane_label: files.live_lane.label.clone(),
            current_checkpoint_alias: files.checkpoints_index.current.alias.clone(),
            export_policy_label: files.export_policy.policy_id.clone(),
        }
    }

    fn build_asset_inspector_state(
        &self,
        paths: &BootstrapPaths,
        files: &BootstrapFiles,
        current_checkpoint_path: &Path,
        export_inventory: &ExportInventory,
    ) -> AssetInspectorState {
        AssetInspectorState {
            workspace_root: self.display_path(&self.root),
            strategy_ref: self.display_path(&paths.strategy_path),
            live_lane_ref: self.display_path(&paths.live_lane_path),
            current_checkpoint_ref: self.display_path(current_checkpoint_path),
            export_policy_ref: self.display_path(&paths.export_policy_path),
            latest_export_bundle_ref: export_inventory.latest_ref.clone(),
            checkpoint_count: files.checkpoints_index.items.len(),
            export_count: export_inventory.count,
        }
    }

    fn build_workspace_index_state(
        &self,
        paths: &BootstrapPaths,
        files: &BootstrapFiles,
        current_checkpoint_path: &Path,
    ) -> WorkspaceIndexState {
        WorkspaceIndexState {
            schema_version: files.strategy.schema_version.clone(),
            active: StrategyActiveIndexState {
                orchestrator_ref: self.display_path(&paths.orchestrator_path),
                live_lane_ref: self.display_path(&paths.live_lane_path),
                current_checkpoint_ref: self.display_path(current_checkpoint_path),
                export_policy_ref: self.display_path(&paths.export_policy_path),
            },
            indexes: StrategyIndexesState {
                checkpoints_ref: self.display_path(&paths.checkpoints_index_path),
                agents_ref: self.display_path(&paths.agents_index_path),
                environments_ref: self.display_path(&paths.environments_index_path),
                adapters_ref: self.display_path(&paths.adapters_index_path),
                collections_ref: self.display_path(&paths.collections_index_path),
                evaluations_ref: self.display_path(&paths.evaluations_index_path),
                imports_ref: self.display_path(&paths.imports_index_path),
                operations_ref: self.display_path(&paths.operations_index_path),
                sessions_ref: self.display_path(&paths.sessions_path),
            },
            agent_count: files.agents_index.agents.len(),
            environment_count: files.environments_index.environments.len(),
            adapter_count: files.adapters_index.adapters.len(),
            collection_count: files.collections_index.items.len(),
            evaluation_count: files.evaluations_index.items.len(),
            operation_count: files.operations_index.items.len(),
            session_count: files.sessions.sessions.len(),
        }
    }

    fn build_runtime_topology_state(
        &self,
        paths: &BootstrapPaths,
        files: &BootstrapFiles,
    ) -> RuntimeTopologyState {
        let environments: Vec<(String, EnvironmentRuntimeState)> = files
            .environments_index
            .environments
            .iter()
            .map(|environment| {
                let definition_path =
                    self.resolve_ref(&paths.environments_index_path, &environment.definition_ref);
                let record = self
                    .read_json_path::<EnvironmentRecordFile>(&definition_path)
                    .unwrap_or(EnvironmentRecordFile {
                        environment_id: environment.id.clone(),
                        name: environment.name.clone(),
                        kind: "unknown".into(),
                        capabilities: Vec::new(),
                        notes: None,
                    });
                let display_ref = self.display_path(&definition_path);
                let state = EnvironmentRuntimeState {
                    id: record.environment_id.clone(),
                    name: record.name,
                    kind: record.kind,
                    definition_ref: display_ref.clone(),
                    capabilities: record.capabilities,
                    notes: record.notes,
                };
                (display_ref, state)
            })
            .collect::<Vec<_>>();

        let environment_names = environments
            .iter()
            .map(|(path_ref, environment)| (path_ref.clone(), environment.name.clone()))
            .collect::<BTreeMap<_, _>>();

        let agents = files
            .agents_index
            .agents
            .iter()
            .map(|agent| {
                let definition_path =
                    self.resolve_ref(&paths.agents_index_path, &agent.definition_ref);
                let record = self
                    .read_json_path::<AgentRecordFile>(&definition_path)
                    .unwrap_or(AgentRecordFile {
                        agent_id: agent.id.clone(),
                        name: agent.name.clone(),
                        kind: agent.kind.clone(),
                        environment_ref: String::new(),
                        provider_policy: AgentProviderPolicyFile {
                            mode: agent.provider_mode.clone(),
                            preferred_providers: Vec::new(),
                        },
                        workspace_refs: serde_json::json!({}),
                    });
                let environment_path = self.resolve_ref(&definition_path, &record.environment_ref);
                let environment_ref = self.display_path(&environment_path);
                let mut workspace_refs = record
                    .workspace_refs
                    .as_object()
                    .into_iter()
                    .flat_map(|map| map.iter())
                    .filter_map(|(label, value)| {
                        value
                            .as_str()
                            .map(|path_ref| RuntimeTopologyWorkspaceRefState {
                                label: label.clone(),
                                path_ref: self
                                    .display_path(&self.resolve_ref(&definition_path, path_ref)),
                            })
                    })
                    .collect::<Vec<_>>();
                workspace_refs.sort_by(|left, right| left.label.cmp(&right.label));

                AgentRuntimeState {
                    id: record.agent_id,
                    name: record.name,
                    kind: record.kind,
                    definition_ref: self.display_path(&definition_path),
                    provider_mode: record.provider_policy.mode,
                    preferred_providers: record.provider_policy.preferred_providers,
                    environment_ref: environment_ref.clone(),
                    environment_name: environment_names
                        .get(&environment_ref)
                        .cloned()
                        .unwrap_or_else(|| "unknown".into()),
                    workspace_refs,
                }
            })
            .collect();

        RuntimeTopologyState {
            orchestrator: OrchestratorRuntimeState {
                id: files.orchestrator.orchestrator_id.clone(),
                name: files.orchestrator.name.clone(),
                mode: files.orchestrator.mode.clone(),
                path_ref: self.display_path(&paths.orchestrator_path),
                notes: files.orchestrator.notes.clone(),
                topology_refs: OrchestratorTopologyRefsState {
                    agents_ref: self.display_path(&self.resolve_ref(
                        &paths.orchestrator_path,
                        &files.orchestrator.topology_refs.agents_ref,
                    )),
                    environments_ref: self.display_path(&self.resolve_ref(
                        &paths.orchestrator_path,
                        &files.orchestrator.topology_refs.environments_ref,
                    )),
                    sessions_ref: self.display_path(&self.resolve_ref(
                        &paths.orchestrator_path,
                        &files.orchestrator.topology_refs.sessions_ref,
                    )),
                    live_lane_ref: self.display_path(&self.resolve_ref(
                        &paths.orchestrator_path,
                        &files.orchestrator.topology_refs.live_lane_ref,
                    )),
                },
            },
            agents,
            environments: environments
                .into_iter()
                .map(|(_, environment)| environment)
                .collect(),
        }
    }

    fn build_live_context_state(
        &self,
        paths: &BootstrapPaths,
        files: &BootstrapFiles,
    ) -> LiveContextState {
        LiveContextState {
            runtime_status_ref: self.display_path(&paths.runtime_status_path),
            dashboard_ref: self.display_path(&paths.dashboard_path),
            decisions_ref: self.display_path(&paths.decisions_path),
            memory_ref: self.display_path(&paths.memory_path),
            positions_ref: self.display_path(&paths.positions_path),
            orders_ref: self.display_path(&paths.orders_path),
            memory_notes: files
                .live_memory
                .notes
                .iter()
                .map(|note| note.summary.clone())
                .collect(),
            sessions: files
                .sessions
                .sessions
                .iter()
                .map(|session| {
                    let session_id = session.session_id.clone().unwrap_or_else(|| {
                        format!("legacy-session-{}", slugish_id(&session.label))
                    });
                    let fallback_ref = format!("../sessions/items/{session_id}/session.json");
                    let path_ref = self.display_path(&self.resolve_optional_ref(
                        &paths.sessions_path,
                        session.path_ref.as_deref(),
                        fallback_ref.as_str(),
                    ));

                    LiveSessionState {
                        id: session_id,
                        label: session.label.clone(),
                        started_at: session
                            .started_at
                            .clone()
                            .unwrap_or_else(|| "UTC unknown".into()),
                        status: session.status.clone().unwrap_or_else(|| "active".into()),
                        path_ref,
                    }
                })
                .collect(),
            evaluation_summaries: files
                .eval_summaries
                .summaries
                .iter()
                .map(|summary| {
                    let summary_id = summary.summary_id.clone().unwrap_or_else(|| {
                        format!("legacy-eval-{}", summary_position_hash(summary))
                    });
                    let fallback_ref = format!("../eval-summaries/items/{summary_id}/summary.json");
                    let path_ref = self.display_path(&self.resolve_optional_ref(
                        &paths.eval_summaries_path,
                        summary.path_ref.as_deref(),
                        fallback_ref.as_str(),
                    ));

                    LiveEvaluationSummaryState {
                        id: summary_id,
                        headline: summary
                            .headline
                            .clone()
                            .unwrap_or_else(|| "Evaluation summary".into()),
                        created_at: summary
                            .created_at
                            .clone()
                            .unwrap_or_else(|| "UTC unknown".into()),
                        path_ref,
                        evidence_refs: summary.evidence_refs.clone(),
                    }
                })
                .collect(),
            position_event_count: files.positions.events.len(),
            order_event_count: files.orders.events.len(),
        }
    }

    fn build_export_inspector_state(
        &self,
        files: &BootstrapFiles,
        latest_bundle: Option<ExportBundleState>,
    ) -> ExportInspectorState {
        ExportInspectorState {
            policy_id: files.export_policy.policy_id.clone(),
            description: files.export_policy.description.clone(),
            latest_bundle,
        }
    }

    fn build_checkpoint_summaries(
        &self,
        checkpoints: &CheckpointIndexFile,
    ) -> Vec<CheckpointSummary> {
        checkpoints
            .items
            .iter()
            .map(|item| {
                let checkpoint_id = item.checkpoint_id.clone();

                CheckpointSummary {
                    id: checkpoint_id.clone(),
                    alias: item.alias.clone(),
                    r#type: item.r#type.clone(),
                    type_tone: item.type_tone.clone(),
                    summary: item.summary.clone(),
                    created_at: item.created_at.clone(),
                    performance: item.performance.clone(),
                    path_ref: self.display_path(&self.checkpoint_file_path(&checkpoint_id)),
                    export_bundle_ref: self.export_bundle_display_ref(item),
                }
            })
            .collect()
    }

    fn build_collection_summaries(
        &self,
        collections: &CollectionsIndexFile,
    ) -> Vec<CollectionSummaryState> {
        collections
            .items
            .iter()
            .map(|item| CollectionSummaryState {
                id: item.collection_id.clone(),
                kind: item.kind.clone(),
                source_ref: item.source_ref.clone(),
                time_bucket: item.time_bucket.clone(),
                time_range_label: format!("{} -> {}", item.time_range.start, item.time_range.end),
                entry_count: item.entry_count,
                content_hash: item.content_hash.clone(),
                collection_ref: self.display_path(&self.collection_file_path(&item.collection_id)),
            })
            .collect()
    }

    fn build_adapter_states(
        &self,
        adapters_index_path: &Path,
        adapters: &AdaptersIndexFile,
    ) -> Vec<ExchangeAdapterState> {
        adapters
            .adapters
            .iter()
            .map(|item| {
                let definition_path = self.resolve_ref(adapters_index_path, &item.definition_ref);
                let record = self
                    .read_json_path::<AdapterRecordFile>(&definition_path)
                    .unwrap_or(AdapterRecordFile {
                        adapter_id: item.id.clone(),
                        name: item.name.clone(),
                        kind: "unknown".into(),
                        mode: "unknown".into(),
                        supports_live: false,
                        supports_paper: false,
                        supports_backtest: false,
                        capabilities: Vec::new(),
                        notes: None,
                    });

                ExchangeAdapterState {
                    id: record.adapter_id,
                    name: record.name,
                    kind: record.kind,
                    mode: record.mode,
                    definition_ref: self.display_path(&definition_path),
                    supports_live: record.supports_live,
                    supports_paper: record.supports_paper,
                    supports_backtest: record.supports_backtest,
                    capabilities: record.capabilities,
                    notes: record.notes,
                }
            })
            .collect()
    }

    fn build_evaluation_run_summaries(
        &self,
        evaluations: &EvaluationsIndexFile,
    ) -> Vec<EvaluationRunSummaryState> {
        evaluations
            .items
            .iter()
            .map(|item| EvaluationRunSummaryState {
                id: item.run_id.clone(),
                kind: item.kind.clone(),
                status: item.status.clone(),
                headline: item.headline.clone(),
                summary: item.summary.clone(),
                created_at: item.created_at.clone(),
                adapter_ref: item.adapter_ref.clone(),
                adapter_name: item.adapter_name.clone(),
                collection_refs: item.collection_refs.clone(),
                net_pnl: item.net_pnl,
                trade_count: item.trade_count,
                position_count: item.position_count,
                path_ref: self.display_path(
                    &self.resolve_ref(&self.evaluations_index_path(), &item.path_ref),
                ),
            })
            .collect()
    }

    fn build_import_summaries(&self, imports: &ImportsIndexFile) -> Vec<ImportSummaryState> {
        imports
            .items
            .iter()
            .map(|item| {
                let import_root = self.import_root_path(&item.import_id);

                ImportSummaryState {
                    id: item.import_id.clone(),
                    imported_at: item.imported_at.clone(),
                    source_bundle_ref: item.source_bundle_ref.clone(),
                    import_ref: self.display_path(&import_root.join("import.json")),
                    workspace_ref: self.display_path(&import_root.join("workspace")),
                    checkpoint_ref: item.checkpoint_ref.clone(),
                    policy_id: item.policy_id.clone(),
                    sanitized: item.sanitized,
                }
            })
            .collect()
    }

    fn build_operation_summaries(
        &self,
        operations: &OperationsIndexFile,
    ) -> Vec<OperationSummaryState> {
        operations
            .items
            .iter()
            .map(|item| OperationSummaryState {
                id: item.operation_id.clone(),
                kind: item.kind.clone(),
                scope: item.scope.clone(),
                status: item.status.clone(),
                summary: item.summary.clone(),
                details: item.details.clone(),
                created_at: item.created_at.clone(),
                operation_ref: self.display_path(&self.operation_file_path(&item.operation_id)),
                related_refs: item
                    .related_refs
                    .iter()
                    .map(|reference| self.display_path(&self.root.join(reference)))
                    .collect(),
            })
            .collect()
    }

    pub(super) fn resolve_current_checkpoint_path(
        &self,
        strategy_path: &Path,
        current_checkpoint_ref: &str,
        checkpoints_index: &CheckpointIndexFile,
    ) -> PathBuf {
        let clean_reference = current_checkpoint_ref
            .split('#')
            .next()
            .unwrap_or(current_checkpoint_ref);
        if current_checkpoint_ref.contains("#current")
            || clean_reference.ends_with("checkpoints/index.json")
        {
            return self.checkpoint_file_path(&checkpoints_index.current.checkpoint_id);
        }

        self.resolve_ref(strategy_path, clean_reference)
    }
}
