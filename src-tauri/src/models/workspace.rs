use serde::{Deserialize, Serialize};

use super::{
    DecisionEntry, EquityPoint, ExposurePoint, LaneEventState, LiveOrder, LivePosition,
    MetricCardData, PricePoint, ProviderStatus, TradingMode,
};

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
pub struct CheckpointDetailState {
    pub id: String,
    pub alias: String,
    pub r#type: String,
    pub type_tone: String,
    pub summary: String,
    pub created_at: String,
    pub performance: String,
    pub checkpoint_ref: String,
    pub snapshot_workspace_ref: String,
    pub workspace_file_refs: Vec<String>,
    pub export_bundle: Option<ExportBundleState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointComparisonFileState {
    pub relative_path: String,
    pub status: String,
    pub base_ref: Option<String>,
    pub target_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointComparisonState {
    pub base_checkpoint_id: String,
    pub base_alias: String,
    pub target_checkpoint_id: String,
    pub target_alias: String,
    pub compared_file_count: usize,
    pub changed_count: usize,
    pub added_count: usize,
    pub removed_count: usize,
    pub summary: String,
    pub files: Vec<CheckpointComparisonFileState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSummaryState {
    pub id: String,
    pub kind: String,
    pub source_ref: String,
    pub time_bucket: String,
    pub time_range_label: String,
    pub entry_count: usize,
    pub content_hash: String,
    pub collection_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionEntryState {
    pub id: String,
    pub source_ref: String,
    pub event_time: String,
    pub ingested_at: String,
    pub content_hash: String,
    pub preview: Option<String>,
    pub entry_path_ref: String,
    pub blob_ref: Option<String>,
    pub blob_path_ref: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionDetailState {
    pub id: String,
    pub kind: String,
    pub source_ref: String,
    pub time_bucket: String,
    pub time_range_label: String,
    pub entry_count: usize,
    pub content_hash: String,
    pub collection_ref: String,
    pub entry_shard_ref: String,
    pub notes: Option<String>,
    pub entries: Vec<CollectionEntryState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummaryState {
    pub id: String,
    pub imported_at: String,
    pub source_bundle_ref: String,
    pub import_ref: String,
    pub workspace_ref: String,
    pub checkpoint_ref: String,
    pub policy_id: String,
    pub sanitized: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreflightCheckState {
    pub id: String,
    pub severity: String,
    pub label: String,
    pub detail: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreflightState {
    pub status: String,
    pub summary: String,
    pub checks: Vec<ImportPreflightCheckState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDetailState {
    pub id: String,
    pub imported_at: String,
    pub source_bundle_ref: String,
    pub import_ref: String,
    pub workspace_ref: String,
    pub checkpoint_ref: String,
    pub policy_id: String,
    pub sanitized: bool,
    pub bundle_ref: String,
    pub workspace_file_refs: Vec<String>,
    pub preflight: ImportPreflightState,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportComparisonState {
    pub import_id: String,
    pub source_bundle_ref: String,
    pub compared_file_count: usize,
    pub changed_count: usize,
    pub added_count: usize,
    pub removed_count: usize,
    pub summary: String,
    pub files: Vec<CheckpointComparisonFileState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlobDetailState {
    pub id: String,
    pub blob_path_ref: String,
    pub byte_length: usize,
    pub line_count: usize,
    pub content_text: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationRelatedDocumentState {
    pub path_ref: String,
    pub label: String,
    pub description: String,
    pub category: String,
    pub resolved: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationDetailState {
    pub id: String,
    pub kind: String,
    pub scope: String,
    pub status: String,
    pub summary: String,
    pub details: String,
    pub created_at: String,
    pub operation_ref: String,
    pub related_refs: Vec<String>,
    pub related_documents: Vec<OperationRelatedDocumentState>,
    pub unresolved_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDocumentBacklinkState {
    pub label: String,
    pub path_ref: String,
    pub category: String,
    pub reason: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDocumentState {
    pub path_ref: String,
    pub format: String,
    pub byte_length: usize,
    pub line_count: usize,
    pub content_text: String,
    pub backlinks: Vec<WorkspaceDocumentBacklinkState>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResultState {
    pub id: String,
    pub category: String,
    pub label: String,
    pub description: String,
    pub path_ref: String,
    pub match_kind: String,
    pub excerpt: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSourceEntryInput {
    pub kind: String,
    pub source_ref: String,
    pub event_time: String,
    pub ingested_at: String,
    pub preview: Option<String>,
    pub body_text: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestSourceEntryResult {
    pub collection_id: String,
    pub collection_ref: String,
    pub entry_id: String,
    pub entry_shard_ref: String,
    pub time_bucket: String,
    pub entry_count: usize,
    pub blob_id: Option<String>,
    pub created_collection: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBundleState {
    pub import_id: String,
    pub imported_at: String,
    pub source_bundle_ref: String,
    pub import_ref: String,
    pub workspace_ref: String,
    pub checkpoint_ref: String,
    pub policy_id: String,
    pub sanitized: bool,
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
    pub orchestrator_ref: String,
    pub live_lane_ref: String,
    pub current_checkpoint_ref: String,
    pub export_policy_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StrategyIndexesState {
    pub checkpoints_ref: String,
    pub agents_ref: String,
    pub environments_ref: String,
    pub collections_ref: String,
    pub imports_ref: String,
    pub operations_ref: String,
    pub sessions_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexState {
    pub schema_version: String,
    pub active: StrategyActiveIndexState,
    pub indexes: StrategyIndexesState,
    pub agent_count: usize,
    pub environment_count: usize,
    pub collection_count: usize,
    pub operation_count: usize,
    pub session_count: usize,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationSummaryState {
    pub id: String,
    pub kind: String,
    pub scope: String,
    pub status: String,
    pub summary: String,
    pub details: String,
    pub created_at: String,
    pub operation_ref: String,
    pub related_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCatalogEntryState {
    pub id: String,
    pub category: String,
    pub label: String,
    pub description: String,
    pub path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSessionState {
    pub id: String,
    pub label: String,
    pub started_at: String,
    pub status: String,
    pub path_ref: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveEvaluationSummaryState {
    pub id: String,
    pub headline: String,
    pub created_at: String,
    pub path_ref: String,
    pub evidence_refs: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveContextState {
    pub dashboard_ref: String,
    pub decisions_ref: String,
    pub memory_ref: String,
    pub positions_ref: String,
    pub orders_ref: String,
    pub memory_notes: Vec<String>,
    pub sessions: Vec<LiveSessionState>,
    pub evaluation_summaries: Vec<LiveEvaluationSummaryState>,
    pub position_event_count: usize,
    pub order_event_count: usize,
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
    pub lane_events: Vec<LaneEventState>,
    pub decisions: Vec<DecisionEntry>,
    pub checkpoints: Vec<CheckpointSummary>,
    pub collections: Vec<CollectionSummaryState>,
    pub imports: Vec<ImportSummaryState>,
    pub operations: Vec<OperationSummaryState>,
    pub document_catalog: Vec<WorkspaceCatalogEntryState>,
}
