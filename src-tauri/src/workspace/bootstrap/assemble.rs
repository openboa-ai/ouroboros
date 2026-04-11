use std::path::PathBuf;

use super::*;

struct BootstrapPaths {
    strategy_path: PathBuf,
    orchestrator_path: PathBuf,
    live_lane_path: PathBuf,
    export_policy_path: PathBuf,
    checkpoints_index_path: PathBuf,
    agents_index_path: PathBuf,
    environments_index_path: PathBuf,
    collections_index_path: PathBuf,
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
    live_lane: LiveLaneFile,
    export_policy: ExportPolicyFile,
    checkpoints_index: CheckpointIndexFile,
    agents_index: AgentsIndexFile,
    environments_index: EnvironmentsIndexFile,
    collections_index: CollectionsIndexFile,
    imports_index: ImportsIndexFile,
    operations_index: OperationsIndexFile,
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
            &paths.collections_index_path,
            &files.collections_index,
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
        let orchestrator_path =
            self.resolve_ref(strategy_path, &strategy.active.orchestrator_ref);
        let export_policy_path = self.resolve_ref(strategy_path, &strategy.active.export_policy_ref);
        let checkpoints_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.checkpoints_ref);
        let agents_index_path = self.resolve_ref(strategy_path, &strategy.indexes.agents_ref);
        let environments_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.environments_ref);
        let collections_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.collections_ref);
        let imports_index_path = self.resolve_ref(strategy_path, &strategy.indexes.imports_ref);
        let operations_index_path =
            self.resolve_ref(strategy_path, &strategy.indexes.operations_ref);

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;

        Ok(BootstrapPaths {
            strategy_path: strategy_path.to_path_buf(),
            orchestrator_path,
            dashboard_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref),
            decisions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref),
            memory_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref),
            sessions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref),
            positions_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref),
            orders_path: self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref),
            eval_summaries_path: self.resolve_ref(
                &live_lane_path,
                &live_lane.state_refs.eval_summaries_ref,
            ),
            live_lane_path,
            export_policy_path,
            checkpoints_index_path,
            agents_index_path,
            environments_index_path,
            collections_index_path,
            imports_index_path,
            operations_index_path,
        })
    }

    fn load_bootstrap_files(
        &self,
        strategy: StrategyManifestFile,
        paths: &BootstrapPaths,
    ) -> Result<BootstrapFiles, String> {
        let _orchestrator = self.read_json_path::<OrchestratorFile>(&paths.orchestrator_path)?;
        let live_lane = self.read_json_path::<LiveLaneFile>(&paths.live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&paths.export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&paths.checkpoints_index_path)?;
        let agents_index = self.read_json_path::<AgentsIndexFile>(&paths.agents_index_path)?;
        let environments_index =
            self.read_json_path::<EnvironmentsIndexFile>(&paths.environments_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&paths.collections_index_path)?;
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
            live_lane,
            export_policy,
            checkpoints_index,
            agents_index,
            environments_index,
            collections_index,
            imports_index,
            operations_index,
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
        let live_context = self.build_live_context_state(&context.paths, &context.files);
        let export_inspector =
            self.build_export_inspector_state(&context.files, context.latest_export_bundle);
        let checkpoints = self.build_checkpoint_summaries(&context.files.checkpoints_index);
        let collections = self.build_collection_summaries(&context.files.collections_index);
        let imports = self.build_import_summaries(&context.files.imports_index);
        let operations = self.build_operation_summaries(&context.files.operations_index);
        let lane_events =
            lane_event_feed(&context.files.positions.events, &context.files.orders.events);

        let BootstrapContext {
            files,
            document_catalog,
            ..
        } = context;

        BootstrapState {
            mode: files.live_lane.mode,
            automation_status: files.dashboard.automation_status,
            status_note: files.dashboard.status_note,
            workspace,
            asset_inspector,
            workspace_index,
            live_context,
            export_inspector,
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
                collections_ref: self.display_path(&paths.collections_index_path),
                imports_ref: self.display_path(&paths.imports_index_path),
                operations_ref: self.display_path(&paths.operations_index_path),
                sessions_ref: self.display_path(&paths.sessions_path),
            },
            agent_count: files.agents_index.agents.len(),
            environment_count: files.environments_index.environments.len(),
            collection_count: files.collections_index.items.len(),
            operation_count: files.operations_index.items.len(),
            session_count: files.sessions.sessions.len(),
        }
    }

    fn build_live_context_state(
        &self,
        paths: &BootstrapPaths,
        files: &BootstrapFiles,
    ) -> LiveContextState {
        LiveContextState {
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
                    let session_id = session
                        .session_id
                        .clone()
                        .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
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
