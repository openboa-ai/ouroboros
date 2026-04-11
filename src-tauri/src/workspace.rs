use std::path::PathBuf;

mod bootstrap;
mod catalog;
mod contracts;
mod helpers;
mod lifecycle;
mod mutations;
mod operations;
mod paths;
mod policies;
mod query;

use contracts::*;
use helpers::*;

use crate::models::{
    AssetInspectorState, BlobDetailState, BootstrapState, CheckpointComparisonFileState,
    CheckpointComparisonState, CheckpointDetailState, CheckpointSummary, CollectionDetailState,
    CollectionEntryState, CollectionSummaryState, DecisionEntry, ExportBundleState,
    ExportInspectorState, ImportBundleState, ImportComparisonState, ImportDetailState,
    ImportPreflightCheckState, ImportPreflightState, ImportSummaryState, IngestSourceEntryInput,
    IngestSourceEntryResult, LiveContextState, LiveEvaluationSummaryState, LiveSessionState,
    OperationDetailState, OperationRelatedDocumentState, OperationSummaryState,
    StrategyActiveIndexState, StrategyIndexesState, TradingMode, WorkspaceCatalogEntryState,
    WorkspaceDocumentBacklinkState, WorkspaceDocumentState, WorkspaceIndexState,
    WorkspaceSearchResultState, WorkspaceSummary,
};
use crate::storage::{
    copy_missing_template_tree, copy_template_tree, copy_tree, list_relative_files, remove_path,
    FileWorkspaceStore,
};

#[derive(Clone)]
pub struct WorkspaceRepository {
    root: PathBuf,
    template_root: PathBuf,
}

impl WorkspaceRepository {
    pub fn new(root: PathBuf, template_root: PathBuf) -> Result<Self, String> {
        let repository = Self {
            root,
            template_root,
        };
        repository.ensure_ready()?;
        Ok(repository)
    }

    pub fn default_root() -> PathBuf {
        std::env::var_os("AUTOKAIROS_WORKSPACE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../var/dev-workspace")
            })
    }

    pub fn default_template_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates/strategy-workspace")
    }
}

#[cfg(test)]
mod tests;
