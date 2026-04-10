use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TradingMode {
    Observer,
    Paper,
    Live,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub name: String,
    pub status_label: String,
    pub usage_label: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricCardData {
    pub label: String,
    pub value: String,
    pub delta: String,
    pub description: String,
    pub icon: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PricePoint {
    pub label: String,
    pub btc: i64,
    pub eth: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityPoint {
    pub label: String,
    pub value: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposurePoint {
    pub symbol: String,
    pub value: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LivePosition {
    pub symbol: String,
    pub side: String,
    pub size: String,
    pub entry: String,
    pub pnl: String,
    pub protective_stop: String,
    pub context_tag: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveOrder {
    pub id: String,
    pub symbol: String,
    pub kind: String,
    pub status: String,
    pub status_tone: String,
    pub summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionEntry {
    pub id: String,
    pub kind: String,
    pub tone: String,
    pub headline: String,
    pub reason: String,
    pub timestamp: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointSummary {
    pub id: String,
    pub alias: String,
    pub r#type: String,
    pub type_tone: String,
    pub summary: String,
    pub created_at: String,
    pub performance: String,
    pub path_ref: String,
    pub export_bundle_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub artifact_id: String,
    pub slug: String,
    pub live_lane_label: String,
    pub current_checkpoint_alias: String,
    pub export_policy_label: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInspectorState {
    pub workspace_root: String,
    pub strategy_ref: String,
    pub live_lane_ref: String,
    pub current_checkpoint_ref: String,
    pub export_policy_ref: String,
    pub latest_export_bundle_ref: Option<String>,
    pub checkpoint_count: usize,
    pub export_count: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyActiveIndexState {
    pub live_lane_ref: String,
    pub current_checkpoint_ref: String,
    pub export_policy_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyIndexesState {
    pub checkpoints_ref: String,
    pub collections_ref: String,
    pub sessions_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexState {
    pub schema_version: String,
    pub active: StrategyActiveIndexState,
    pub indexes: StrategyIndexesState,
    pub collection_count: usize,
    pub session_count: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveContextState {
    pub memory_notes: Vec<String>,
    pub session_labels: Vec<String>,
    pub eval_evidence_refs: Vec<String>,
    pub position_event_count: usize,
    pub order_event_count: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBundleState {
    pub export_id: String,
    pub created_at: String,
    pub policy_id: String,
    pub checkpoint_ref: String,
    pub workspace_ref: String,
    pub bundle_ref: String,
    pub included_refs: Vec<String>,
    pub excluded_paths: Vec<String>,
    pub sanitized: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportInspectorState {
    pub policy_id: String,
    pub description: String,
    pub latest_bundle: Option<ExportBundleState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapState {
    pub mode: TradingMode,
    pub automation_status: String,
    pub status_note: Option<String>,
    pub workspace: WorkspaceSummary,
    pub asset_inspector: AssetInspectorState,
    pub workspace_index: WorkspaceIndexState,
    pub live_context: LiveContextState,
    pub export_inspector: ExportInspectorState,
    pub providers: Vec<ProviderStatus>,
    pub metrics: Vec<MetricCardData>,
    pub price_series: Vec<PricePoint>,
    pub equity_series: Vec<EquityPoint>,
    pub exposure_series: Vec<ExposurePoint>,
    pub positions: Vec<LivePosition>,
    pub orders: Vec<LiveOrder>,
    pub decisions: Vec<DecisionEntry>,
    pub checkpoints: Vec<CheckpointSummary>,
}
