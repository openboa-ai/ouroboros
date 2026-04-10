use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::{
    BootstrapState, CheckpointSummary, DecisionEntry, EquityPoint, ExposurePoint, LiveOrder,
    LivePosition, MetricCardData, PricePoint, ProviderStatus, TradingMode, WorkspaceSummary,
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

        let live_lane = self.read_json_path::<LiveLaneFile>(&live_lane_path)?;
        let export_policy = self.read_json_path::<ExportPolicyFile>(&export_policy_path)?;
        let checkpoints_index =
            self.read_json_path::<CheckpointIndexFile>(&checkpoints_index_path)?;

        let dashboard_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.dashboard_ref);
        let decisions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.decisions_ref);
        let positions_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.positions_ref);
        let orders_path = self.resolve_ref(&live_lane_path, &live_lane.state_refs.orders_ref);

        let dashboard = self.read_json_path::<DashboardStateFile>(&dashboard_path)?;
        let decisions = self.read_json_path::<DecisionLogFile>(&decisions_path)?;
        let positions = self.read_json_path::<PositionsStateFile>(&positions_path)?;
        let orders = self.read_json_path::<OrdersStateFile>(&orders_path)?;

        Ok(BootstrapState {
            mode: live_lane.mode,
            automation_status: dashboard.automation_status,
            status_note: dashboard.status_note,
            workspace: WorkspaceSummary {
                artifact_id: strategy.artifact_id,
                slug: strategy.slug,
                live_lane_label: live_lane.label,
                current_checkpoint_alias: checkpoints_index.current.alias,
                export_policy_label: export_policy.policy_id,
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
                .map(|item| CheckpointSummary {
                    id: item.checkpoint_id,
                    alias: item.alias,
                    r#type: item.r#type,
                    type_tone: item.type_tone,
                    summary: item.summary,
                    created_at: item.created_at,
                    performance: item.performance,
                })
                .collect(),
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
            return Ok(());
        }

        copy_tree(&self.template_root, &self.root, &PathBuf::new())?;
        Ok(())
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
        self.write_json_path(
            &export_root.join("export.json"),
            &ExportBundleFile {
                export_id: checkpoint.checkpoint_id.clone(),
                checkpoint_ref: checkpoint.path_ref.clone(),
                policy_id: policy_id.into(),
                created_at: now_label(),
                sanitized: true,
            },
        )?;

        Ok(())
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

fn should_skip_snapshot_path(relative: &Path) -> bool {
    relative == Path::new("checkpoints") || relative == Path::new("exports/generated")
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
