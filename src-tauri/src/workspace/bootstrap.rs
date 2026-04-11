use std::path::Path;

use super::*;

impl WorkspaceRepository {
    pub fn load_bootstrap_state(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let strategy_path = self.root.join("strategy.json");
        let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
        let export_policy_path = self.resolve_ref(&strategy_path, &strategy.active.export_policy_ref);
        let checkpoints_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.checkpoints_ref);
        let collections_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.collections_ref);
        let imports_index_path = self.resolve_ref(&strategy_path, &strategy.indexes.imports_ref);
        let operations_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.operations_ref);

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&collections_index_path)?;
        let imports_index = if imports_index_path.exists() {
            self.read_json_path::<ImportsIndexFile>(&imports_index_path)?
        } else {
            ImportsIndexFile { items: Vec::new() }
        };
        let operations_index = if operations_index_path.exists() {
            self.read_json_path::<OperationsIndexFile>(&operations_index_path)?
        } else {
            OperationsIndexFile { items: Vec::new() }
        };

        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let memory_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.memory_ref);
        let sessions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.sessions_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);
        let eval_summaries_path =
            self.resolve_ref(&live_lane_path, &live_lane.state_refs.eval_summaries_ref);

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let live_memory = self.read_json_path::<LiveMemoryFile>(&memory_path)?;
        let sessions = self.read_json_path::<SessionsIndexFile>(&sessions_path)?;
        let positions = self.read_json_path::<PositionsStateFile>(&positions_path)?;
        let orders = self.read_json_path::<OrdersStateFile>(&orders_path)?;
        let eval_summaries = self.read_json_path::<EvalSummariesFile>(&eval_summaries_path)?;
        let current_checkpoint_path = self.resolve_current_checkpoint_path(
            &strategy_path,
            &strategy.active.current_checkpoint_ref,
            &checkpoints_index,
        );
        let export_inventory = self.export_inventory(&checkpoints_index.items);
        let latest_export_bundle = self.latest_export_bundle(&checkpoints_index.items)?;
        let sessions_count = sessions.sessions.len();
        let document_catalog = self.build_document_catalog(
            &strategy_path,
            &live_lane_path,
            &dashboard_path,
            &decisions_path,
            &memory_path,
            &positions_path,
            &orders_path,
            &export_policy_path,
            &current_checkpoint_path,
            &checkpoints_index_path,
            &collections_index_path,
            &collections_index,
            &imports_index_path,
            &imports_index,
            &operations_index_path,
            &operations_index,
            &sessions_path,
            &sessions,
            &eval_summaries_path,
            &eval_summaries,
            export_inventory.latest_ref.as_deref(),
        );

        Ok(BootstrapState {
            mode: live_lane.mode,
            automation_status: dashboard.automation_status,
            status_note: dashboard.status_note,
            workspace: WorkspaceSummary {
                artifact_id: strategy.artifact_id,
                slug: strategy.slug,
                live_lane_label: live_lane.label,
                current_checkpoint_alias: checkpoints_index.current.alias,
                export_policy_label: export_policy.policy_id.clone(),
            },
            asset_inspector: AssetInspectorState {
                workspace_root: self.display_path(&self.root),
                strategy_ref: self.display_path(&strategy_path),
                live_lane_ref: self.display_path(&live_lane_path),
                current_checkpoint_ref: self.display_path(&current_checkpoint_path),
                export_policy_ref: self.display_path(&export_policy_path),
                latest_export_bundle_ref: export_inventory.latest_ref,
                checkpoint_count: checkpoints_index.items.len(),
                export_count: export_inventory.count,
            },
            workspace_index: WorkspaceIndexState {
                schema_version: strategy.schema_version.clone(),
                active: StrategyActiveIndexState {
                    live_lane_ref: self.display_path(&live_lane_path),
                    current_checkpoint_ref: self.display_path(&current_checkpoint_path),
                    export_policy_ref: self.display_path(&export_policy_path),
                },
                indexes: StrategyIndexesState {
                    checkpoints_ref: self.display_path(&checkpoints_index_path),
                    collections_ref: self.display_path(&collections_index_path),
                    imports_ref: self.display_path(&imports_index_path),
                    operations_ref: self.display_path(&operations_index_path),
                    sessions_ref: self.display_path(&sessions_path),
                },
                collection_count: collections_index.items.len(),
                operation_count: operations_index.items.len(),
                session_count: sessions_count,
            },
            live_context: LiveContextState {
                dashboard_ref: self.display_path(&dashboard_path),
                decisions_ref: self.display_path(&decisions_path),
                memory_ref: self.display_path(&memory_path),
                positions_ref: self.display_path(&positions_path),
                orders_ref: self.display_path(&orders_path),
                memory_notes: live_memory
                    .notes
                    .into_iter()
                    .map(|note| note.summary)
                    .collect(),
                sessions: sessions
                    .sessions
                    .into_iter()
                    .map(|session| {
                        let session_id = session
                            .session_id
                            .clone()
                            .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
                        let label = session.label;
                        let started_at = session.started_at.unwrap_or_else(|| "UTC unknown".into());
                        let status = session.status.unwrap_or_else(|| "active".into());
                        let fallback_ref = format!("../sessions/items/{session_id}/session.json");
                        let path_ref = self.display_path(&self.resolve_optional_ref(
                            &sessions_path,
                            session.path_ref.as_deref(),
                            fallback_ref.as_str(),
                        ));

                        LiveSessionState {
                            id: session_id,
                            label,
                            started_at,
                            status,
                            path_ref,
                        }
                    })
                    .collect(),
                evaluation_summaries: eval_summaries
                    .summaries
                    .into_iter()
                    .map(|summary| {
                        let summary_id = summary
                            .summary_id
                            .clone()
                            .unwrap_or_else(|| format!("legacy-eval-{}", summary_position_hash(&summary)));
                        let headline = summary.headline.unwrap_or_else(|| "Evaluation summary".into());
                        let created_at = summary.created_at.unwrap_or_else(|| "UTC unknown".into());
                        let fallback_ref = format!("../eval-summaries/items/{summary_id}/summary.json");
                        let path_ref = self.display_path(&self.resolve_optional_ref(
                            &eval_summaries_path,
                            summary.path_ref.as_deref(),
                            fallback_ref.as_str(),
                        ));

                        LiveEvaluationSummaryState {
                            id: summary_id,
                            headline,
                            created_at,
                            path_ref,
                            evidence_refs: summary.evidence_refs,
                        }
                    })
                    .collect(),
                position_event_count: positions.events.len(),
                order_event_count: orders.events.len(),
            },
            export_inspector: ExportInspectorState {
                policy_id: export_policy.policy_id.clone(),
                description: export_policy.description.clone(),
                latest_bundle: latest_export_bundle,
            },
            providers: dashboard.providers,
            metrics: dashboard.metrics,
            price_series: dashboard.price_series,
            equity_series: dashboard.equity_series,
            exposure_series: dashboard.exposure_series,
            positions: positions.current,
            orders: orders.current,
            lane_events: lane_event_feed(&positions.events, &orders.events),
            decisions: decisions.decisions,
            checkpoints: checkpoints_index
                .items
                .into_iter()
                .map(|item| {
                    let checkpoint_id = item.checkpoint_id.clone();
                    let path_ref = self.display_path(&self.checkpoint_file_path(&checkpoint_id));
                    let export_bundle_ref = self.export_bundle_display_ref(&item);

                    CheckpointSummary {
                        id: checkpoint_id,
                        alias: item.alias,
                        r#type: item.r#type,
                        type_tone: item.type_tone,
                        summary: item.summary,
                        created_at: item.created_at,
                        performance: item.performance,
                        path_ref,
                        export_bundle_ref,
                    }
                })
                .collect(),
            collections: collections_index
                .items
                .into_iter()
                .map(|item| CollectionSummaryState {
                    id: item.collection_id.clone(),
                    kind: item.kind,
                    source_ref: item.source_ref,
                    time_bucket: item.time_bucket,
                    time_range_label: format!("{} -> {}", item.time_range.start, item.time_range.end),
                    entry_count: item.entry_count,
                    content_hash: item.content_hash,
                    collection_ref: self.display_path(&self.collection_file_path(&item.collection_id)),
                })
                .collect(),
            imports: imports_index
                .items
                .into_iter()
                .map(|item| {
                    let import_root = self.import_root_path(&item.import_id);
                    ImportSummaryState {
                        id: item.import_id,
                        imported_at: item.imported_at,
                        source_bundle_ref: item.source_bundle_ref,
                        import_ref: self.display_path(&import_root.join("import.json")),
                        workspace_ref: self.display_path(&import_root.join("workspace")),
                        checkpoint_ref: item.checkpoint_ref,
                        policy_id: item.policy_id,
                        sanitized: item.sanitized,
                    }
                })
                .collect(),
            operations: operations_index
                .items
                .into_iter()
                .map(|item| OperationSummaryState {
                    id: item.operation_id.clone(),
                    kind: item.kind,
                    scope: item.scope,
                    status: item.status,
                    summary: item.summary,
                    details: item.details,
                    created_at: item.created_at,
                    operation_ref: self.display_path(&self.operation_file_path(&item.operation_id)),
                    related_refs: item
                        .related_refs
                        .into_iter()
                        .map(|reference| self.display_path(&self.root.join(reference)))
                        .collect(),
                })
                .collect(),
            document_catalog,
        })
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

    pub(super) fn export_inventory(&self, checkpoints: &[CheckpointRecordFile]) -> ExportInventory {
        let mut count = 0usize;
        let mut latest_ref = None;

        for checkpoint in checkpoints {
            let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
            if export_path.exists() {
                count += 1;
                if latest_ref.is_none() {
                    latest_ref = Some(self.display_path(&export_path));
                }
            }
        }

        ExportInventory { count, latest_ref }
    }

    pub(super) fn latest_export_bundle(
        &self,
        checkpoints: &[CheckpointRecordFile],
    ) -> Result<Option<ExportBundleState>, String> {
        for checkpoint in checkpoints {
            if let Some(bundle) = self.load_export_bundle_for_checkpoint(checkpoint)? {
                return Ok(Some(bundle));
            }
        }

        Ok(None)
    }

    pub(super) fn load_export_bundle_for_checkpoint(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Result<Option<ExportBundleState>, String> {
        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        if !export_path.exists() {
            return Ok(None);
        }

        let export_bundle = self.read_json_path::<ExportBundleFile>(&export_path)?;
        let workspace_path = self.export_workspace_path(&checkpoint.checkpoint_id);
        let included_refs = if export_bundle.included_refs.is_empty() && workspace_path.exists() {
            self.list_display_files(&workspace_path)?
        } else {
            export_bundle
                .included_refs
                .iter()
                .map(|reference| {
                    let relative = reference
                        .strip_prefix("./workspace/")
                        .or_else(|| reference.strip_prefix("./workspace"))
                        .unwrap_or(reference);
                    self.display_path(&workspace_path.join(relative))
                })
                .collect()
        };

        Ok(Some(ExportBundleState {
            export_id: export_bundle.export_id,
            created_at: export_bundle.created_at,
            policy_id: export_bundle.policy_id,
            checkpoint_ref: self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
            workspace_ref: self.display_path(&workspace_path),
            bundle_ref: self.display_path(&export_path),
            included_refs,
            excluded_paths: export_bundle.excluded_paths,
            sanitized: export_bundle.sanitized,
        }))
    }

    pub(super) fn export_bundle_display_ref(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Option<String> {
        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        export_path.exists().then(|| self.display_path(&export_path))
    }
}
