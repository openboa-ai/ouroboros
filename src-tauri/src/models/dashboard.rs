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
pub struct LaneEventState {
    pub id: String,
    pub scope: String,
    pub kind: String,
    pub summary: String,
    pub timestamp: String,
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
