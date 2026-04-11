use std::collections::BTreeSet;
use std::path::Path;

use super::super::*;

impl WorkspaceRepository {
    pub(in crate::workspace) fn build_document_catalog(
        &self,
        strategy_path: &Path,
        orchestrator_path: &Path,
        live_lane_path: &Path,
        dashboard_path: &Path,
        decisions_path: &Path,
        memory_path: &Path,
        positions_path: &Path,
        orders_path: &Path,
        export_policy_path: &Path,
        current_checkpoint_path: &Path,
        checkpoints_index_path: &Path,
        agents_index_path: &Path,
        agents: &AgentsIndexFile,
        environments_index_path: &Path,
        environments: &EnvironmentsIndexFile,
        collections_index_path: &Path,
        collections: &CollectionsIndexFile,
        imports_index_path: &Path,
        imports: &ImportsIndexFile,
        operations_index_path: &Path,
        operations: &OperationsIndexFile,
        sessions_path: &Path,
        sessions: &SessionsIndexFile,
        eval_summaries_path: &Path,
        eval_summaries: &EvalSummariesFile,
        latest_export_bundle_ref: Option<&str>,
    ) -> Vec<WorkspaceCatalogEntryState> {
        let mut items = vec![
            WorkspaceCatalogEntryState {
                id: "strategy".into(),
                category: "entrypoint".into(),
                label: "strategy.json".into(),
                description: "Canonical workspace entrypoint for the live-centered asset.".into(),
                path_ref: self.display_path(strategy_path),
            },
            WorkspaceCatalogEntryState {
                id: "orchestrator".into(),
                category: "active".into(),
                label: "orchestrator".into(),
                description:
                    "Managed-agent orchestrator that binds the active topology to the live workspace asset."
                        .into(),
                path_ref: self.display_path(orchestrator_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-lane".into(),
                category: "active".into(),
                label: "live lane".into(),
                description: "Active live lane refs, state pointers, and runtime mode.".into(),
                path_ref: self.display_path(live_lane_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-dashboard".into(),
                category: "active".into(),
                label: "dashboard state".into(),
                description:
                    "Current dashboard-facing live state surfaced through the service boundary."
                        .into(),
                path_ref: self.display_path(dashboard_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-decisions".into(),
                category: "active".into(),
                label: "decision log".into(),
                description:
                    "Recent live trading decisions and interventions that remain part of the exportable context.".into(),
                path_ref: self.display_path(decisions_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-memory".into(),
                category: "active".into(),
                label: "working memory".into(),
                description: "Live working-memory notes currently shaping trading behavior.".into(),
                path_ref: self.display_path(memory_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-positions".into(),
                category: "active".into(),
                label: "positions state".into(),
                description: "Current live positions plus event history for replay and audit.".into(),
                path_ref: self.display_path(positions_path),
            },
            WorkspaceCatalogEntryState {
                id: "live-orders".into(),
                category: "active".into(),
                label: "orders state".into(),
                description: "Current live orders plus event history for replay and audit.".into(),
                path_ref: self.display_path(orders_path),
            },
            WorkspaceCatalogEntryState {
                id: "current-checkpoint".into(),
                category: "checkpoint".into(),
                label: "current checkpoint".into(),
                description:
                    "The authoritative checkpoint anchor for the current live-centered asset."
                        .into(),
                path_ref: self.display_path(current_checkpoint_path),
            },
            WorkspaceCatalogEntryState {
                id: "export-policy".into(),
                category: "export".into(),
                label: "export policy".into(),
                description: "Sanitization policy that governs export bundle generation.".into(),
                path_ref: self.display_path(export_policy_path),
            },
            WorkspaceCatalogEntryState {
                id: "checkpoints-index".into(),
                category: "index".into(),
                label: "checkpoint index".into(),
                description: "Promotion, export, and incident history catalog.".into(),
                path_ref: self.display_path(checkpoints_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "agents-index".into(),
                category: "index".into(),
                label: "agents index".into(),
                description:
                    "Managed-agent topology catalog for orchestrator-owned agent definitions."
                        .into(),
                path_ref: self.display_path(agents_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "environments-index".into(),
                category: "index".into(),
                label: "environments index".into(),
                description:
                    "Managed-agent environment catalog referenced by workspace agents.".into(),
                path_ref: self.display_path(environments_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "collections-index".into(),
                category: "index".into(),
                label: "collections index".into(),
                description: "Source-centered collection catalog materialized by UTC-hour shards."
                    .into(),
                path_ref: self.display_path(collections_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "imports-index".into(),
                category: "index".into(),
                label: "imports index".into(),
                description:
                    "Sanitized import staging catalog kept inside the workspace asset.".into(),
                path_ref: self.display_path(imports_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "operations-index".into(),
                category: "index".into(),
                label: "operations index".into(),
                description: "Durable workspace-wide service operation registry.".into(),
                path_ref: self.display_path(operations_index_path),
            },
            WorkspaceCatalogEntryState {
                id: "sessions-index".into(),
                category: "index".into(),
                label: "sessions index".into(),
                description: "Durable session references that shape current live context.".into(),
                path_ref: self.display_path(sessions_path),
            },
            WorkspaceCatalogEntryState {
                id: "eval-summaries-index".into(),
                category: "index".into(),
                label: "eval summaries".into(),
                description:
                    "Inspectable evaluation summaries that still link back to raw evidence refs."
                        .into(),
                path_ref: self.display_path(eval_summaries_path),
            },
        ];
        let mut indexed_blob_ids = BTreeSet::new();

        for agent in &agents.agents {
            let agent_path = self.resolve_ref(agents_index_path, &agent.definition_ref);
            let agent_record = self.read_json_path::<AgentRecordFile>(&agent_path).ok();
            items.push(WorkspaceCatalogEntryState {
                id: format!("agent-{}", agent.id),
                category: "agent".into(),
                label: agent_record
                    .as_ref()
                    .map(|record| record.name.clone())
                    .unwrap_or_else(|| agent.name.clone()),
                description: agent_record
                    .as_ref()
                    .map(|record| {
                        format!(
                            "{} agent with {} provider mode across {} preferred provider(s).",
                            record.kind,
                            record.provider_policy.mode,
                            record.provider_policy.preferred_providers.len()
                        )
                    })
                    .unwrap_or_else(|| {
                        format!(
                            "{} agent with {} provider policy.",
                            agent.kind, agent.provider_mode
                        )
                    }),
                path_ref: self.display_path(&agent_path),
            });
        }

        for environment in &environments.environments {
            let environment_path =
                self.resolve_ref(environments_index_path, &environment.definition_ref);
            let environment_record = self
                .read_json_path::<EnvironmentRecordFile>(&environment_path)
                .ok();
            items.push(WorkspaceCatalogEntryState {
                id: format!("environment-{}", environment.id),
                category: "environment".into(),
                label: environment_record
                    .as_ref()
                    .map(|record| record.name.clone())
                    .unwrap_or_else(|| environment.name.clone()),
                description: environment_record
                    .as_ref()
                    .map(|record| {
                        format!(
                            "{} environment with {} capability declaration(s).",
                            record.kind,
                            record.capabilities.len()
                        )
                    })
                    .unwrap_or_else(|| {
                        "Managed-agent environment definition referenced by workspace agents."
                            .into()
                    }),
                path_ref: self.display_path(&environment_path),
            });
        }

        for session in &sessions.sessions {
            let session_id = session
                .session_id
                .clone()
                .unwrap_or_else(|| format!("legacy-session-{}", slugish_id(&session.label)));
            let session_path = self.resolve_optional_ref(
                sessions_path,
                session.path_ref.as_deref(),
                format!("../sessions/items/{session_id}/session.json").as_str(),
            );
            items.push(WorkspaceCatalogEntryState {
                id: format!("session-{session_id}"),
                category: "session".into(),
                label: session.label.clone(),
                description: format!(
                    "Live session document ({}) that remains part of the exportable trading context.",
                    session.status.clone().unwrap_or_else(|| "active".into())
                ),
                path_ref: self.display_path(&session_path),
            });
        }

        for summary in &eval_summaries.summaries {
            let summary_id = summary
                .summary_id
                .clone()
                .unwrap_or_else(|| format!("legacy-eval-{}", summary_position_hash(summary)));
            let summary_path = self.resolve_optional_ref(
                eval_summaries_path,
                summary.path_ref.as_deref(),
                format!("../eval-summaries/items/{summary_id}/summary.json").as_str(),
            );
            items.push(WorkspaceCatalogEntryState {
                id: format!("evaluation-{summary_id}"),
                category: "evaluation".into(),
                label: summary
                    .headline
                    .clone()
                    .unwrap_or_else(|| "evaluation summary".into()),
                description:
                    "Live-lane evaluation evidence summary with refs back to raw supporting artifacts."
                        .into(),
                path_ref: self.display_path(&summary_path),
            });
        }

        for operation in &operations.items {
            items.push(WorkspaceCatalogEntryState {
                id: format!("operation-{}", operation.operation_id),
                category: "operation".into(),
                label: format!("{} · {}", operation.kind, operation.created_at),
                description: operation.summary.clone(),
                path_ref: self.display_path(&self.operation_file_path(&operation.operation_id)),
            });
        }

        for collection in &collections.items {
            let collection_path = self.resolve_ref(collections_index_path, &collection.path_ref);
            let collection_record = self
                .read_json_path::<CollectionRecordFile>(&collection_path)
                .ok();
            let entry_shard_path = collection_record
                .as_ref()
                .map(|record| self.resolve_ref(&collection_path, &record.entry_shard_ref));
            let entry_records = entry_shard_path
                .as_ref()
                .filter(|path| path.exists())
                .and_then(|path| self.read_ndjson_path::<CollectionEntryFile>(path).ok())
                .unwrap_or_default();

            items.push(WorkspaceCatalogEntryState {
                id: format!("collection-{}", collection.collection_id),
                category: "collection".into(),
                label: format!("{} · {}", collection.source_ref, collection.time_bucket),
                description: format!(
                    "{} collection with {} entries.",
                    collection.kind, collection.entry_count
                ),
                path_ref: self.display_path(&collection_path),
            });

            if let Some(entry_shard_path) = entry_shard_path {
                items.push(WorkspaceCatalogEntryState {
                    id: format!("collection-entries-{}", collection.collection_id),
                    category: "collection".into(),
                    label: format!("{} entry shard", collection.source_ref),
                    description: "Append-friendly NDJSON shard backing this source collection."
                        .into(),
                    path_ref: self.display_path(&entry_shard_path),
                });
            }

            for entry in entry_records {
                let entry_document_path =
                    self.collection_entry_document_path(&collection.collection_id, &entry.entry_id);
                items.push(WorkspaceCatalogEntryState {
                    id: format!("entry-{}", entry.entry_id),
                    category: "entry".into(),
                    label: format!("{} entry {}", collection.source_ref, entry.event_time),
                    description: entry.preview.clone().unwrap_or_else(|| {
                        "Source entry materialized as a first-class workspace document.".into()
                    }),
                    path_ref: self.display_path(&entry_document_path),
                });

                let Some(blob_ref) = entry.blob_ref else {
                    continue;
                };
                if !indexed_blob_ids.insert(blob_ref.clone()) {
                    continue;
                }

                items.push(WorkspaceCatalogEntryState {
                    id: format!("blob-{}", blob_ref.replace(':', "-")),
                    category: "blob".into(),
                    label: format!(
                        "{} body {}",
                        collection.source_ref,
                        short_blob_label(&blob_ref)
                    ),
                    description: entry.preview.unwrap_or_else(|| {
                        "Immutable source body referenced by collection entries.".into()
                    }),
                    path_ref: self.display_path(&self.blob_path(&blob_ref)),
                });
            }
        }

        for import in &imports.items {
            let import_path = self.import_file_path(&import.import_id);
            let bundle_path = self.resolve_ref(&import_path, &import.bundle_ref);

            items.push(WorkspaceCatalogEntryState {
                id: format!("import-{}", import.import_id),
                category: "import".into(),
                label: format!("import {}", import.imported_at),
                description: format!(
                    "Sanitized import staged from bundle {}.",
                    import.source_bundle_ref
                ),
                path_ref: self.display_path(&import_path),
            });

            items.push(WorkspaceCatalogEntryState {
                id: format!("import-bundle-{}", import.import_id),
                category: "import".into(),
                label: format!("import bundle {}", import.import_id),
                description:
                    "Copied sanitized export manifest staged alongside the imported workspace."
                        .into(),
                path_ref: self.display_path(&bundle_path),
            });
        }

        if let Some(latest_export_bundle_ref) = latest_export_bundle_ref {
            items.push(WorkspaceCatalogEntryState {
                id: "latest-export-bundle".into(),
                category: "export".into(),
                label: "latest export bundle".into(),
                description:
                    "Most recent sanitized export created from the live-centered workspace asset."
                        .into(),
                path_ref: latest_export_bundle_ref.into(),
            });
        }

        items
    }
}
