use serde::{Deserialize, Serialize};

use crate::models::{
    AutomationStatus, CheckpointComparisonFileState, DecisionEntry, EquityPoint, ExposurePoint,
    LiveOrder, LivePosition, MetricCardData, OperationStatus, OrchestratorMode, PricePoint,
    ProviderStatus, TradingMode,
};

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct StrategyManifestFile {
    pub artifact_id: String,
    pub slug: String,
    pub schema_version: String,
    pub active: StrategyActiveRefsFile,
    pub indexes: StrategyIndexRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct StrategyActiveRefsFile {
    #[serde(default = "super::default_orchestrator_ref")]
    pub orchestrator_ref: String,
    pub live_lane_ref: String,
    pub current_checkpoint_ref: String,
    pub export_policy_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct StrategyIndexRefsFile {
    pub checkpoints_ref: String,
    #[serde(default = "super::default_agents_ref")]
    pub agents_ref: String,
    #[serde(default = "super::default_environments_ref")]
    pub environments_ref: String,
    #[serde(default = "super::default_adapters_ref")]
    pub adapters_ref: String,
    pub collections_ref: String,
    #[serde(default = "super::default_evaluations_ref")]
    pub evaluations_ref: String,
    #[serde(default = "super::default_imports_ref")]
    pub imports_ref: String,
    #[serde(default = "super::default_operations_ref")]
    pub operations_ref: String,
    pub sessions_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct LiveLaneFile {
    pub lane_id: String,
    pub label: String,
    pub state_refs: LiveLaneRefsFile,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct OrchestratorFile {
    pub orchestrator_id: String,
    pub name: String,
    pub mode: OrchestratorMode,
    pub topology_refs: OrchestratorTopologyRefsFile,
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct OrchestratorTopologyRefsFile {
    pub agents_ref: String,
    pub environments_ref: String,
    pub sessions_ref: String,
    pub live_lane_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct LiveLaneRefsFile {
    #[serde(default = "super::default_runtime_status_ref")]
    pub runtime_status_ref: String,
    #[serde(default = "super::default_dashboard_ref")]
    pub dashboard_ref: String,
    #[serde(default = "super::default_decisions_ref")]
    pub decisions_ref: String,
    #[serde(default = "super::default_live_memory_ref")]
    pub memory_ref: String,
    #[serde(default = "super::default_sessions_ref")]
    pub sessions_ref: String,
    #[serde(default = "super::default_positions_ref")]
    pub positions_ref: String,
    #[serde(default = "super::default_orders_ref")]
    pub orders_ref: String,
    #[serde(default = "super::default_eval_summaries_state_ref")]
    pub eval_summaries_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RuntimeStatusFile {
    pub mode: TradingMode,
    pub automation_status: AutomationStatus,
    pub status_note: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct DashboardStateFile {
    pub providers: Vec<ProviderStatus>,
    pub metrics: Vec<MetricCardData>,
    pub price_series: Vec<PricePoint>,
    pub equity_series: Vec<EquityPoint>,
    pub exposure_series: Vec<ExposurePoint>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct DecisionLogFile {
    pub decisions: Vec<DecisionEntry>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct PositionsStateFile {
    pub current: Vec<LivePosition>,
    pub events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct OrdersStateFile {
    pub current: Vec<LiveOrder>,
    pub events: Vec<LaneEvent>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct LaneEvent {
    pub event_id: String,
    pub timestamp: String,
    pub kind: String,
    pub summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct LiveMemoryFile {
    pub notes: Vec<LiveMemoryNote>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct LiveMemoryNote {
    pub summary: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct SessionsIndexFile {
    pub sessions: Vec<SessionRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CollectionsIndexFile {
    #[serde(default, alias = "collections")]
    pub items: Vec<CollectionIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AgentsIndexFile {
    pub agents: Vec<AgentIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AgentIndexItemFile {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub provider_mode: String,
    pub definition_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AgentRecordFile {
    pub agent_id: String,
    pub name: String,
    pub kind: String,
    pub environment_ref: String,
    pub provider_policy: AgentProviderPolicyFile,
    pub workspace_refs: serde_json::Value,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AgentProviderPolicyFile {
    pub mode: String,
    #[serde(default)]
    pub preferred_providers: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EnvironmentsIndexFile {
    pub environments: Vec<EnvironmentIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EnvironmentIndexItemFile {
    pub id: String,
    pub name: String,
    pub definition_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EnvironmentRecordFile {
    pub environment_id: String,
    pub name: String,
    pub kind: String,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AdaptersIndexFile {
    pub adapters: Vec<AdapterIndexItemFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AdapterIndexItemFile {
    pub id: String,
    pub name: String,
    pub definition_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct AdapterRecordFile {
    pub adapter_id: String,
    pub name: String,
    pub kind: String,
    pub mode: String,
    pub supports_live: bool,
    pub supports_paper: bool,
    pub supports_backtest: bool,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct ImportsIndexFile {
    pub items: Vec<ImportRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct EvaluationsIndexFile {
    pub items: Vec<EvaluationRunSummaryFile>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct EvaluationRunSummaryFile {
    pub run_id: String,
    pub kind: String,
    pub status: String,
    pub headline: String,
    pub summary: String,
    pub created_at: String,
    pub adapter_ref: String,
    pub adapter_name: String,
    #[serde(default)]
    pub collection_refs: Vec<String>,
    pub net_pnl: f64,
    pub trade_count: usize,
    pub position_count: usize,
    pub path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct EvaluationTradeFile {
    pub symbol: String,
    pub side: String,
    pub entry_time: String,
    pub exit_time: String,
    pub entry_price: f64,
    pub exit_price: f64,
    pub net_pnl: f64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct EvaluationRunFile {
    pub run_id: String,
    pub kind: String,
    pub status: String,
    pub headline: String,
    pub summary: String,
    pub created_at: String,
    pub adapter_ref: String,
    pub adapter_name: String,
    #[serde(default)]
    pub collection_refs: Vec<String>,
    pub gross_pnl: f64,
    pub fee_cost: f64,
    pub slippage_cost: f64,
    pub model_cost: f64,
    pub net_pnl: f64,
    pub trade_count: usize,
    pub position_count: usize,
    pub path_ref: String,
    #[serde(default)]
    pub equity_curve: Vec<EquityPoint>,
    #[serde(default)]
    pub trades: Vec<EvaluationTradeFile>,
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct OperationsIndexFile {
    pub items: Vec<OperationRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct ImportRecordFile {
    pub import_id: String,
    pub imported_at: String,
    pub source_bundle_ref: String,
    pub bundle_ref: String,
    pub workspace_ref: String,
    pub checkpoint_ref: String,
    pub policy_id: String,
    pub sanitized: bool,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct OperationRecordFile {
    pub operation_id: String,
    pub kind: String,
    pub scope: String,
    pub status: OperationStatus,
    pub summary: String,
    pub details: String,
    pub created_at: String,
    #[serde(default)]
    pub related_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CollectionIndexItemFile {
    pub collection_id: String,
    pub kind: String,
    pub source_ref: String,
    pub time_bucket: String,
    pub time_range: TimeRangeFile,
    pub entry_count: usize,
    pub content_hash: String,
    pub path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CollectionRecordFile {
    pub collection_id: String,
    pub kind: String,
    pub source_ref: String,
    pub time_bucket: String,
    pub time_range: TimeRangeFile,
    pub entry_count: usize,
    pub content_hash: String,
    pub entry_shard_ref: String,
    pub notes: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CollectionEntryFile {
    pub entry_id: String,
    pub source_ref: String,
    pub event_time: String,
    pub ingested_at: String,
    pub content_hash: String,
    pub blob_ref: Option<String>,
    pub preview: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CollectionEntryDocumentFile {
    pub entry_id: String,
    pub collection_id: String,
    pub kind: String,
    pub source_ref: String,
    pub event_time: String,
    pub ingested_at: String,
    pub content_hash: String,
    pub preview: Option<String>,
    pub collection_ref: String,
    pub entry_shard_ref: String,
    pub blob_ref: Option<String>,
    pub blob_path_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct TimeRangeFile {
    pub start: String,
    pub end: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct SessionRecordFile {
    #[serde(default)]
    pub session_id: Option<String>,
    pub label: String,
    #[serde(default)]
    pub started_at: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub path_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EvalSummariesFile {
    pub summaries: Vec<EvalSummaryRecord>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EvalSummaryRecord {
    #[serde(default)]
    pub summary_id: Option<String>,
    #[serde(default)]
    pub headline: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub path_ref: Option<String>,
    #[serde(default)]
    pub evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct SessionDetailFile {
    pub session_id: String,
    pub label: String,
    pub started_at: String,
    pub status: String,
    pub scope: String,
    pub goal: String,
    pub context_refs: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct EvalSummaryDetailFile {
    pub summary_id: String,
    pub headline: String,
    pub created_at: String,
    pub tone: String,
    pub decision: String,
    pub rationale: Vec<String>,
    pub evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct ExportPolicyFile {
    pub policy_id: String,
    pub description: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CheckpointIndexFile {
    pub current: CheckpointPointerFile,
    pub items: Vec<CheckpointRecordFile>,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CheckpointPointerFile {
    pub checkpoint_id: String,
    pub alias: String,
    pub r#type: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct CheckpointRecordFile {
    pub checkpoint_id: String,
    pub alias: String,
    pub r#type: String,
    pub type_tone: String,
    pub summary: String,
    pub created_at: String,
    pub performance: String,
    pub path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
pub(super) struct ExportBundleFile {
    pub export_id: String,
    pub checkpoint_ref: String,
    pub policy_id: String,
    pub created_at: String,
    pub sanitized: bool,
    #[serde(default)]
    pub workspace_ref: String,
    #[serde(default)]
    pub included_refs: Vec<String>,
    #[serde(default)]
    pub excluded_paths: Vec<String>,
}

pub(super) struct ExportInventory {
    pub count: usize,
    pub latest_ref: Option<String>,
}

pub(super) struct WorkspaceDiffState {
    pub files: Vec<CheckpointComparisonFileState>,
    pub changed_count: usize,
    pub added_count: usize,
    pub removed_count: usize,
}
