use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TradingMode {
    Observer,
    Paper,
    Live,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub name: String,
    pub status_label: String,
    pub usage_label: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricCardData {
    pub label: String,
    pub value: String,
    pub delta: String,
    pub description: String,
    pub icon: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PricePoint {
    pub label: String,
    pub btc: i64,
    pub eth: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EquityPoint {
    pub label: String,
    pub value: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposurePoint {
    pub symbol: String,
    pub value: i64,
}

#[derive(Clone, Serialize)]
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveOrder {
    pub id: String,
    pub symbol: String,
    pub kind: String,
    pub status: String,
    pub status_tone: String,
    pub summary: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionEntry {
    pub id: String,
    pub kind: String,
    pub tone: String,
    pub headline: String,
    pub reason: String,
    pub timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointSummary {
    pub id: String,
    pub alias: String,
    pub r#type: String,
    pub type_tone: String,
    pub summary: String,
    pub created_at: String,
    pub performance: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub artifact_id: String,
    pub slug: String,
    pub live_lane_label: String,
    pub current_checkpoint_alias: String,
    pub export_policy_label: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapState {
    pub mode: TradingMode,
    pub automation_status: String,
    pub status_note: Option<String>,
    pub workspace: WorkspaceSummary,
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
