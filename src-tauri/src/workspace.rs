use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{
    AssetInspectorState, BlobDetailState, BootstrapState, CheckpointDetailState, CheckpointSummary,
    CollectionDetailState, CollectionEntryState, CollectionSummaryState, DecisionEntry, EquityPoint,
    ExportBundleState, ExportInspectorState, ExposurePoint, LiveContextState, LiveOrder,
    LivePosition, MetricCardData, PricePoint, ProviderStatus, StrategyActiveIndexState,
    StrategyIndexesState, TradingMode, WorkspaceIndexState, WorkspaceSummary,
};

#[derive(Clone)]
pub struct WorkspaceRepository {
    root: PathBuf,
    template_root: PathBuf,
}

impl WorkspaceRepository {
    pub fn new(root: PathBuf, template_root: PathBuf) -> Result<Self, String> {
        let repository = Self { root, template_root };
        repository.ensure_ready()?;
        Ok(repository)
    }

    pub fn default_root() -> PathBuf {
        std::env::var_os("AUTOKAIROS_WORKSPACE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../var/dev-workspace"))
    }

    pub fn default_template_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates/strategy-workspace")
    }

    pub fn load_bootstrap_state(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let strategy_path = self.root.join("strategy.json");
        let live_lane_path = self.resolve_ref(&strategy_path, &strategy.active.live_lane_ref);
        let export_policy_path = self.resolve_ref(&strategy_path, &strategy.active.export_policy_ref);
        let checkpoints_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.checkpoints_ref);
        let collections_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.collections_ref);

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        let collections_index =
            self.read_json_path::<CollectionsIndexFile>(&collections_index_path)?;

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
                    sessions_ref: self.display_path(&sessions_path),
                },
                collection_count: collections_index.items.len(),
                session_count: sessions_count,
            },
            live_context: LiveContextState {
                memory_notes: live_memory
                    .notes
                    .into_iter()
                    .map(|note| note.summary)
                    .collect(),
                session_labels: sessions
                    .sessions
                    .into_iter()
                    .map(|session| session.label)
                    .collect(),
                eval_evidence_refs: eval_summaries
                    .summaries
                    .into_iter()
                    .flat_map(|summary| summary.evidence_refs)
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
        })
    }

    pub fn load_checkpoint_detail(
        &self,
        checkpoint_id: &str,
    ) -> Result<CheckpointDetailState, String> {
        let checkpoint_path = self.checkpoint_file_path(checkpoint_id);
        let checkpoint = self.read_json_path::<CheckpointRecordFile>(&checkpoint_path)?;
        let snapshot_workspace = self
            .root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("workspace");
        let workspace_file_refs = if snapshot_workspace.exists() {
            list_relative_files(&snapshot_workspace, "./workspace")?
        } else {
            Vec::new()
        };
        let export_bundle = if checkpoint.r#type == "export" {
            self.load_export_bundle_for_checkpoint(&checkpoint)?
        } else {
            None
        };

        Ok(CheckpointDetailState {
            id: checkpoint.checkpoint_id.clone(),
            alias: checkpoint.alias,
            r#type: checkpoint.r#type,
            type_tone: checkpoint.type_tone,
            summary: checkpoint.summary,
            created_at: checkpoint.created_at,
            performance: checkpoint.performance,
            checkpoint_ref: self.display_path(&checkpoint_path),
            snapshot_workspace_ref: self.display_path(&snapshot_workspace),
            workspace_file_refs,
            export_bundle,
        })
    }

    pub fn load_collection_detail(
        &self,
        collection_id: &str,
    ) -> Result<CollectionDetailState, String> {
        let collection_path = self.collection_file_path(collection_id);
        let collection = self.read_json_path::<CollectionRecordFile>(&collection_path)?;
        let entry_shard_path = self.resolve_ref(&collection_path, &collection.entry_shard_ref);
        let entries = self.read_ndjson_path::<CollectionEntryFile>(&entry_shard_path)?;

        Ok(CollectionDetailState {
            id: collection.collection_id.clone(),
            kind: collection.kind,
            source_ref: collection.source_ref,
            time_bucket: collection.time_bucket,
            time_range_label: format!("{} -> {}", collection.time_range.start, collection.time_range.end),
            entry_count: collection.entry_count,
            content_hash: collection.content_hash,
            collection_ref: self.display_path(&collection_path),
            entry_shard_ref: self.display_path(&entry_shard_path),
            notes: collection.notes,
            entries: entries
                .into_iter()
                .map(|entry| CollectionEntryState {
                    id: entry.entry_id,
                    source_ref: entry.source_ref,
                    event_time: entry.event_time,
                    ingested_at: entry.ingested_at,
                    content_hash: entry.content_hash,
                    preview: entry.preview,
                    blob_ref: entry.blob_ref.clone(),
                    blob_path_ref: entry
                        .blob_ref
                        .as_ref()
                        .map(|blob_ref| self.display_path(&self.blob_path(blob_ref))),
                })
                .collect(),
        })
    }

    pub fn load_blob_detail(&self, blob_id: &str) -> Result<BlobDetailState, String> {
        let blob_path = self.blob_path(blob_id);
        let content_text = fs::read_to_string(&blob_path)
            .map_err(|error| format!("failed to read {}: {error}", blob_path.display()))?;

        Ok(BlobDetailState {
            id: blob_id.to_string(),
            blob_path_ref: self.display_path(&blob_path),
            byte_length: content_text.as_bytes().len(),
            line_count: content_text.lines().count(),
            content_text,
        })
    }

    pub fn pause_global_automation(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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

        self.load_bootstrap_state()
    }

    pub fn flatten_all_positions(&self) -> Result<BootstrapState, String> {
        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
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

        self.create_checkpoint(
            "incident",
            "incident-flatten-all".into(),
            "Client-triggered flatten-all command captured as an incident checkpoint.".into(),
            "Live risk reset to flat".into(),
        )?;

        self.load_bootstrap_state()
    }

    pub fn create_export_checkpoint(&self) -> Result<BootstrapState, String> {
        let checkpoint = self.create_checkpoint(
            "export",
            format!("export-{}", short_alias_suffix()),
            "Fresh export checkpoint created before generating a sanitized live-centered bundle."
                .into(),
            "Export policy sanitized-live-centered".into(),
        )?;

        let strategy = self.read_json_path::<StrategyManifestFile>(&self.root.join("strategy.json"))?;
        let live_lane_path = self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.live_lane_ref);
        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let export_policy_path =
            self.resolve_ref(&self.root.join("strategy.json"), &strategy.active.export_policy_ref);

        let mut dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let mut decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;

        dashboard.status_note = Some(
            "A fresh export checkpoint was created from the current live-centered asset."
                .into(),
        );
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

        self.write_json_path(&dashboard_path, &dashboard)?;
        self.write_json_path(&decisions_path, &decisions)?;
        self.create_export_bundle(&checkpoint, &export_policy.policy_id)?;

        self.load_bootstrap_state()
    }

    fn ensure_ready(&self) -> Result<(), String> {
        if self.root.join("strategy.json").exists() {
            copy_missing_tree(&self.template_root, &self.root, &PathBuf::new())?;
            self.normalize_workspace()?;
            return Ok(());
        }

        copy_tree(&self.template_root, &self.root, &PathBuf::new())?;
        self.normalize_workspace()?;
        Ok(())
    }

    fn normalize_workspace(&self) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        if !strategy_path.exists() {
            return Ok(());
        }

        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        let checkpoints_index_path =
            self.resolve_ref(&strategy_path, &strategy.indexes.checkpoints_ref);
        if !checkpoints_index_path.exists() {
            return Ok(());
        }

        let checkpoints_index = self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;
        let desired_ref = format!(
            "./checkpoints/items/{}/checkpoint.json",
            checkpoints_index.current.checkpoint_id
        );
        if strategy.active.current_checkpoint_ref != desired_ref {
            strategy.active.current_checkpoint_ref = desired_ref;
            self.write_json_path(&strategy_path, &strategy)?;
        }

        Ok(())
    }

    fn update_active_checkpoint_ref(&self, checkpoint_id: &str) -> Result<(), String> {
        let strategy_path = self.root.join("strategy.json");
        let mut strategy = self.read_json_path::<StrategyManifestFile>(&strategy_path)?;
        strategy.active.current_checkpoint_ref =
            format!("./checkpoints/items/{checkpoint_id}/checkpoint.json");
        self.write_json_path(&strategy_path, &strategy)
    }

    fn create_checkpoint(
        &self,
        checkpoint_type: &str,
        alias: String,
        summary: String,
        performance: String,
    ) -> Result<CheckpointRecordFile, String> {
        let checkpoint_id = uuid_v7_string();
        let created_at = now_label();
        let checkpoint = CheckpointRecordFile {
            checkpoint_id: checkpoint_id.clone(),
            alias: alias.clone(),
            r#type: checkpoint_type.into(),
            type_tone: checkpoint_tone(checkpoint_type).into(),
            summary,
            created_at,
            performance,
            path_ref: format!("./items/{checkpoint_id}/checkpoint.json"),
        };

        self.materialize_checkpoint_snapshot(&checkpoint)?;

        let mut index = self.read_json_path::<CheckpointIndexFile>(&self.root.join("checkpoints/index.json"))?;
        index.current = CheckpointPointerFile {
            checkpoint_id: checkpoint_id.clone(),
            alias,
            r#type: checkpoint_type.into(),
        };
        index.items.insert(0, checkpoint.clone());
        self.write_json_path(&self.root.join("checkpoints/index.json"), &index)?;
        self.update_active_checkpoint_ref(&checkpoint_id)?;

        Ok(checkpoint)
    }

    fn materialize_checkpoint_snapshot(
        &self,
        checkpoint: &CheckpointRecordFile,
    ) -> Result<PathBuf, String> {
        let checkpoint_root = self
            .root
            .join("checkpoints")
            .join("items")
            .join(&checkpoint.checkpoint_id);
        let workspace_root = checkpoint_root.join("workspace");
        fs::create_dir_all(&workspace_root)
            .map_err(|error| format!("failed to create checkpoint directory: {error}"))?;

        for entry in fs::read_dir(&self.root)
            .map_err(|error| format!("failed to read workspace root: {error}"))?
        {
            let entry = entry.map_err(|error| format!("failed to read workspace entry: {error}"))?;
            let name = entry.file_name();
            let relative = PathBuf::from(&name);
            if should_skip_snapshot_path(&relative) {
                continue;
            }
            copy_tree(&entry.path(), &workspace_root.join(name), &relative)?;
        }

        self.write_json_path(&checkpoint_root.join("checkpoint.json"), checkpoint)?;
        Ok(checkpoint_root)
    }

    fn create_export_bundle(
        &self,
        checkpoint: &CheckpointRecordFile,
        policy_id: &str,
    ) -> Result<(), String> {
        let checkpoint_workspace = self
            .root
            .join("checkpoints")
            .join("items")
            .join(&checkpoint.checkpoint_id)
            .join("workspace");
        let export_root = self
            .root
            .join("exports")
            .join("generated")
            .join(&checkpoint.checkpoint_id);
        let export_workspace = export_root.join("workspace");

        if export_root.exists() {
            fs::remove_dir_all(&export_root)
                .map_err(|error| format!("failed to reset export bundle: {error}"))?;
        }

        copy_tree(&checkpoint_workspace, &export_workspace, &PathBuf::new())?;
        let included_refs = list_relative_files(&export_workspace, "./workspace")?;
        self.write_json_path(
            &export_root.join("export.json"),
            &ExportBundleFile {
                export_id: checkpoint.checkpoint_id.clone(),
                checkpoint_ref: checkpoint.path_ref.clone(),
                policy_id: policy_id.into(),
                created_at: now_label(),
                sanitized: true,
                workspace_ref: "./workspace".into(),
                included_refs,
                excluded_paths: export_excluded_paths(),
            },
        )?;

        Ok(())
    }

    fn resolve_current_checkpoint_path(
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

    fn export_inventory(&self, checkpoints: &[CheckpointRecordFile]) -> ExportInventory {
        let mut count = 0usize;
        let mut latest_ref = None;

        for checkpoint in checkpoints.iter().filter(|item| item.r#type == "export") {
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

    fn latest_export_bundle(
        &self,
        checkpoints: &[CheckpointRecordFile],
    ) -> Result<Option<ExportBundleState>, String> {
        for checkpoint in checkpoints.iter().filter(|item| item.r#type == "export") {
            if let Some(bundle) = self.load_export_bundle_for_checkpoint(checkpoint)? {
                return Ok(Some(bundle));
            }
        }

        Ok(None)
    }

    fn load_export_bundle_for_checkpoint(
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
            list_relative_files(&workspace_path, "./workspace")?
        } else {
            export_bundle.included_refs.clone()
        };

        Ok(Some(ExportBundleState {
            export_id: export_bundle.export_id,
            created_at: export_bundle.created_at,
            policy_id: export_bundle.policy_id,
            checkpoint_ref: self.display_path(&self.checkpoint_file_path(&checkpoint.checkpoint_id)),
            workspace_ref: if export_bundle.workspace_ref.is_empty() {
                self.display_path(&workspace_path)
            } else {
                export_bundle.workspace_ref
            },
            bundle_ref: self.display_path(&export_path),
            included_refs,
            excluded_paths: export_bundle.excluded_paths,
            sanitized: export_bundle.sanitized,
        }))
    }

    fn export_bundle_display_ref(&self, checkpoint: &CheckpointRecordFile) -> Option<String> {
        if checkpoint.r#type != "export" {
            return None;
        }

        let export_path = self.export_bundle_path(&checkpoint.checkpoint_id);
        export_path.exists().then(|| self.display_path(&export_path))
    }

    fn checkpoint_file_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("checkpoints")
            .join("items")
            .join(checkpoint_id)
            .join("checkpoint.json")
    }

    fn export_bundle_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("export.json")
    }

    fn collection_file_path(&self, collection_id: &str) -> PathBuf {
        self.root
            .join("collections")
            .join("items")
            .join(collection_id)
            .join("collection.json")
    }

    fn export_workspace_path(&self, checkpoint_id: &str) -> PathBuf {
        self.root
            .join("exports")
            .join("generated")
            .join(checkpoint_id)
            .join("workspace")
    }

    fn blob_path(&self, blob_id: &str) -> PathBuf {
        let (algorithm, digest) = blob_id
            .split_once(':')
            .unwrap_or(("sha256", blob_id));
        self.root.join("blobs").join(algorithm).join(format!("{digest}.txt"))
    }

    fn display_path(&self, path: &Path) -> String {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        path.strip_prefix(&project_root)
            .map(|relative| relative.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
    }

    fn resolve_ref(&self, base_file: &Path, reference: &str) -> PathBuf {
        let clean_reference = reference.split('#').next().unwrap_or(reference);
        let base_dir = base_file
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| self.root.clone());
        base_dir.join(clean_reference)
    }

    fn read_json_path<T: DeserializeOwned>(&self, path: &Path) -> Result<T, String> {
        let bytes =
            fs::read(path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        serde_json::from_slice(&bytes)
            .map_err(|error| format!("failed to parse {}: {error}", path.display()))
    }

    fn read_ndjson_path<T: DeserializeOwned>(&self, path: &Path) -> Result<Vec<T>, String> {
        let contents =
            fs::read_to_string(path).map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        contents
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                serde_json::from_str::<T>(line)
                    .map_err(|error| format!("failed to parse NDJSON line in {}: {error}", path.display()))
            })
            .collect()
    }

    fn write_json_path<T: Serialize>(&self, path: &Path, value: &T) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
        }
        let bytes = serde_json::to_vec_pretty(value)
            .map_err(|error| format!("failed to serialize {}: {error}", path.display()))?;
        fs::write(path, bytes)
            .map_err(|error| format!("failed to write {}: {error}", path.display()))
    }
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyManifestFile {
    artifact_id: String,
    slug: String,
    schema_version: String,
    active: StrategyActiveRefsFile,
    indexes: StrategyIndexRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyActiveRefsFile {
    live_lane_ref: String,
    current_checkpoint_ref: String,
    export_policy_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct StrategyIndexRefsFile {
    checkpoints_ref: String,
    collections_ref: String,
    sessions_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveLaneFile {
    lane_id: String,
    label: String,
    mode: TradingMode,
    state_refs: LiveLaneRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveLaneRefsFile {
    dashboard_ref: String,
    decisions_ref: String,
    memory_ref: String,
    sessions_ref: String,
    positions_ref: String,
    orders_ref: String,
    eval_summaries_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStateFile {
    mode: TradingMode,
    automation_status: String,
    status_note: Option<String>,
    providers: Vec<ProviderStatus>,
    metrics: Vec<MetricCardData>,
    price_series: Vec<PricePoint>,
    equity_series: Vec<EquityPoint>,
    exposure_series: Vec<ExposurePoint>,
}

#[derive(Clone, Deserialize, Serialize)]
struct DecisionLogFile {
    decisions: Vec<DecisionEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
struct PositionsStateFile {
    current: Vec<LivePosition>,
    events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
struct OrdersStateFile {
    current: Vec<LiveOrder>,
    events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
struct LaneEvent {
    event_id: String,
    timestamp: String,
    kind: String,
    summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveMemoryFile {
    notes: Vec<LiveMemoryNote>,
}

#[derive(Clone, Deserialize, Serialize)]
struct LiveMemoryNote {
    summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct SessionsIndexFile {
    sessions: Vec<SessionRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionsIndexFile {
    items: Vec<CollectionIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionIndexItemFile {
    collection_id: String,
    kind: String,
    source_ref: String,
    time_bucket: String,
    time_range: TimeRangeFile,
    entry_count: usize,
    content_hash: String,
    path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionRecordFile {
    collection_id: String,
    kind: String,
    source_ref: String,
    time_bucket: String,
    time_range: TimeRangeFile,
    entry_count: usize,
    content_hash: String,
    entry_shard_ref: String,
    notes: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CollectionEntryFile {
    entry_id: String,
    source_ref: String,
    event_time: String,
    ingested_at: String,
    content_hash: String,
    blob_ref: Option<String>,
    preview: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct TimeRangeFile {
    start: String,
    end: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct SessionRecordFile {
    label: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct EvalSummariesFile {
    summaries: Vec<EvalSummaryRecord>,
}

#[derive(Clone, Deserialize, Serialize)]
struct EvalSummaryRecord {
    #[serde(default)]
    evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
struct ExportPolicyFile {
    policy_id: String,
    description: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointIndexFile {
    current: CheckpointPointerFile,
    items: Vec<CheckpointRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointPointerFile {
    checkpoint_id: String,
    alias: String,
    r#type: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct CheckpointRecordFile {
    checkpoint_id: String,
    alias: String,
    r#type: String,
    type_tone: String,
    summary: String,
    created_at: String,
    performance: String,
    path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct ExportBundleFile {
    export_id: String,
    checkpoint_ref: String,
    policy_id: String,
    created_at: String,
    sanitized: bool,
    #[serde(default)]
    workspace_ref: String,
    #[serde(default)]
    included_refs: Vec<String>,
    #[serde(default)]
    excluded_paths: Vec<String>,
}

struct ExportInventory {
    count: usize,
    latest_ref: Option<String>,
}

fn prepend_decision(decisions: &mut Vec<DecisionEntry>, decision: DecisionEntry) {
    decisions.insert(0, decision);
}

fn checkpoint_tone(checkpoint_type: &str) -> &'static str {
    match checkpoint_type {
        "promotion" => "positive",
        "incident" => "danger",
        _ => "warning",
    }
}

fn export_excluded_paths() -> Vec<String> {
    vec![
        "./workspace/checkpoints".into(),
        "./workspace/exports/generated".into(),
        "./workspace/secrets".into(),
        "./workspace/credentials".into(),
    ]
}

fn should_skip_snapshot_path(relative: &Path) -> bool {
    relative == Path::new("checkpoints") || relative == Path::new("exports/generated")
}

fn list_relative_files(root: &Path, prefix: &str) -> Result<Vec<String>, String> {
    let mut items = Vec::new();
    collect_relative_files(root, root, prefix, &mut items)?;
    items.sort();
    Ok(items)
}

fn collect_relative_files(
    root: &Path,
    current: &Path,
    prefix: &str,
    items: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|error| format!("failed to read {}: {error}", current.display()))?
    {
        let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_relative_files(root, &path, prefix, items)?;
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .map_err(|error| format!("failed to relativize {}: {error}", path.display()))?;
        let relative = relative.to_string_lossy().replace('\\', "/");
        items.push(format!("{prefix}/{relative}"));
    }

    Ok(())
}

fn copy_tree(source: &Path, destination: &Path, relative: &Path) -> Result<(), String> {
    if should_skip_snapshot_path(relative) {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let name = entry.file_name();
            let child_relative = if relative.as_os_str().is_empty() {
                PathBuf::from(&name)
            } else {
                relative.join(&name)
            };
            copy_tree(&entry.path(), &destination.join(name), &child_relative)?;
        }
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

fn copy_missing_tree(source: &Path, destination: &Path, relative: &Path) -> Result<(), String> {
    if should_skip_snapshot_path(relative) {
        return Ok(());
    }

    if source.is_dir() {
        fs::create_dir_all(destination)
            .map_err(|error| format!("failed to create {}: {error}", destination.display()))?;
        for entry in fs::read_dir(source)
            .map_err(|error| format!("failed to read {}: {error}", source.display()))?
        {
            let entry = entry.map_err(|error| format!("failed to read entry: {error}"))?;
            let name = entry.file_name();
            let child_relative = if relative.as_os_str().is_empty() {
                PathBuf::from(&name)
            } else {
                relative.join(&name)
            };
            copy_missing_tree(&entry.path(), &destination.join(name), &child_relative)?;
        }
        return Ok(());
    }

    if destination.exists() {
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    fs::copy(source, destination).map_err(|error| {
        format!(
            "failed to copy {} to {}: {error}",
            source.display(),
            destination.display()
        )
    })?;
    Ok(())
}

fn uuid_v7_string() -> String {
    Uuid::now_v7().to_string()
}

fn short_alias_suffix() -> String {
    Uuid::now_v7()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect()
}

fn now_label() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("UTC epoch {seconds}")
}
