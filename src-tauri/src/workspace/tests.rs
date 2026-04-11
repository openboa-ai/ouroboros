use std::fs;

use super::*;
use crate::models::{ImportPreflightSeverity, ImportPreflightStatus, OrchestratorMode};

fn test_root() -> PathBuf {
    std::env::temp_dir().join(format!("autokairos-workspace-test-{}", uuid_v7_string()))
}

#[test]
fn bootstrap_surfaces_agent_and_environment_indexes() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

    assert!(bootstrap
        .workspace_index
        .active
        .orchestrator_ref
        .ends_with("/orchestrator/orchestrator.json"));
    assert!(bootstrap
        .workspace_index
        .indexes
        .agents_ref
        .ends_with("/agents/index.json"));
    assert!(bootstrap
        .workspace_index
        .indexes
        .environments_ref
        .ends_with("/environments/index.json"));
    assert!(bootstrap.workspace_index.agent_count >= 1);
    assert!(bootstrap.workspace_index.environment_count >= 1);
    assert_eq!(
        bootstrap.runtime_topology.orchestrator.mode,
        OrchestratorMode::ManagedAgent
    );
    assert!(bootstrap.runtime_topology.agents.len() >= 1);
    assert!(bootstrap.runtime_topology.environments.len() >= 1);
    assert!(bootstrap
        .runtime_topology
        .agents
        .iter()
        .all(|agent| !agent.environment_ref.is_empty()));
    assert!(bootstrap
        .document_catalog
        .iter()
        .any(|entry| entry.path_ref.ends_with("/orchestrator/orchestrator.json")));
    assert!(bootstrap
        .document_catalog
        .iter()
        .any(|entry| entry.category == "agent"));
    assert!(bootstrap
        .document_catalog
        .iter()
        .any(|entry| entry.category == "environment"));

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn restore_checkpoint_replays_snapshot_without_losing_generated_exports() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let target_checkpoint_id = export_state
        .checkpoints
        .first()
        .map(|checkpoint| checkpoint.id.clone())
        .expect("new export checkpoint id");
    let target_alias = export_state
        .checkpoints
        .first()
        .map(|checkpoint| checkpoint.alias.clone())
        .expect("new export checkpoint alias");
    let export_bundle_ref = export_state
        .asset_inspector
        .latest_export_bundle_ref
        .clone()
        .expect("latest export bundle");
    let export_bundle_path = repo.project_root().join(&export_bundle_ref);
    assert!(
        export_bundle_path.exists(),
        "export bundle should exist before restore"
    );
    let imported = repo
        .import_export_bundle(&export_bundle_ref)
        .expect("stage export as import");

    let flattened = repo.flatten_all_positions().expect("flatten");
    assert!(
        flattened.positions.is_empty(),
        "flatten should clear live positions"
    );

    let restored = repo
        .restore_checkpoint(&target_checkpoint_id)
        .expect("restore checkpoint");
    assert_eq!(restored.workspace.current_checkpoint_alias, target_alias);
    assert!(
        restored
            .status_note
            .as_deref()
            .unwrap_or_default()
            .contains("restored from checkpoint"),
        "restore should leave a status note"
    );
    assert!(
        !restored.positions.is_empty(),
        "restoring the promotion snapshot should bring positions back"
    );
    assert!(
        export_bundle_path.exists(),
        "generated export bundles should survive restore"
    );
    assert_eq!(restored.imports.len(), 1, "restore should preserve imports");
    assert_eq!(restored.imports[0].id, imported.import_id);
    assert!(
        restored
            .operations
            .iter()
            .any(|operation| operation.kind == "import_export_bundle"),
        "restore should preserve operation history"
    );
    assert!(
        restored
            .operations
            .iter()
            .any(|operation| operation.kind == "restore_checkpoint"),
        "restore itself should be appended as a service operation"
    );

    let checkpoints_index = repo
        .read_json_path::<CheckpointIndexFile>(&root.join("checkpoints/index.json"))
        .expect("checkpoint index");
    assert_eq!(
        checkpoints_index.current.checkpoint_id,
        target_checkpoint_id
    );
    assert_eq!(checkpoints_index.current.alias, target_alias);
    assert!(
        checkpoints_index
            .items
            .first()
            .map(|item| item.alias.starts_with("incident-restore-anchor-"))
            .unwrap_or(false),
        "restore should prepend an incident rollback anchor"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn activate_import_as_live_replaces_live_state_without_losing_service_roots() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let baseline = repo.load_bootstrap_state().expect("baseline bootstrap");
    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let export_checkpoint = export_state
        .checkpoints
        .first()
        .cloned()
        .expect("export checkpoint summary");
    let export_bundle_ref = export_state
        .asset_inspector
        .latest_export_bundle_ref
        .clone()
        .expect("latest export bundle");
    let imported = repo
        .import_export_bundle(&export_bundle_ref)
        .expect("stage import");

    let flattened = repo.flatten_all_positions().expect("flatten");
    assert!(
        flattened.positions.is_empty(),
        "flatten should clear positions first"
    );

    let activated = repo
        .activate_import_as_live(&imported.import_id)
        .expect("activate staged import");

    assert_eq!(
        activated.workspace.current_checkpoint_alias, export_checkpoint.alias,
        "activation should re-anchor to the imported checkpoint when it exists locally"
    );
    assert_eq!(
        serde_json::to_string(&activated.positions).expect("serialize activated positions"),
        serde_json::to_string(&baseline.positions).expect("serialize baseline positions"),
        "activating the staged import should restore the exported live positions"
    );
    assert_eq!(
        activated.imports.len(),
        1,
        "staged import catalog should survive activation"
    );
    assert_eq!(activated.imports[0].id, imported.import_id);
    assert!(
        activated
            .operations
            .iter()
            .any(|operation| operation.kind == "activate_import_as_live"),
        "activation should be recorded as a service operation"
    );
    assert!(
        activated
            .operations
            .iter()
            .any(|operation| operation.kind == "import_export_bundle"),
        "previous import staging history should survive activation"
    );
    assert!(
        activated.checkpoints.iter().any(|checkpoint| checkpoint
            .alias
            .starts_with("incident-import-activation-anchor-")),
        "activation should preserve a rollback anchor"
    );

    let strategy = repo
        .read_json_path::<StrategyManifestFile>(&root.join("strategy.json"))
        .expect("strategy manifest");
    assert_eq!(
        strategy.active.current_checkpoint_ref,
        format!(
            "./checkpoints/items/{}/checkpoint.json",
            export_checkpoint.id
        ),
        "strategy.json should now point at the activated checkpoint"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn import_preflight_blocks_activation_when_strategy_entrypoint_is_missing() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let export_bundle_ref = export_state
        .asset_inspector
        .latest_export_bundle_ref
        .clone()
        .expect("latest export bundle");
    let imported = repo
        .import_export_bundle(&export_bundle_ref)
        .expect("stage import");

    let import_workspace = repo.import_root_path(&imported.import_id).join("workspace");
    fs::remove_file(import_workspace.join("strategy.json")).expect("remove staged strategy");

    let import_detail = repo
        .load_import_detail(&imported.import_id)
        .expect("load staged import detail");
    assert_eq!(
        import_detail.preflight.status,
        ImportPreflightStatus::Blocked
    );
    assert!(
        import_detail
            .preflight
            .checks
            .iter()
            .any(|check| check.id == "strategy-entrypoint"
                && check.severity == ImportPreflightSeverity::Blocked),
        "preflight should flag the missing strategy entrypoint"
    );

    let error = match repo.activate_import_as_live(&imported.import_id) {
        Ok(_) => panic!("activation should fail when preflight is blocked"),
        Err(error) => error,
    };
    assert!(
        error.contains("failed activation preflight"),
        "activation should surface a preflight failure"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn ingest_source_entry_creates_collection_blob_and_index_entry() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let result = repo
        .ingest_source_entry(IngestSourceEntryInput {
            kind: "raw".into(),
            source_ref: "news:macro-wire:cpi".into(),
            event_time: "2026-04-10T12:14:55Z".into(),
            ingested_at: "2026-04-10T12:15:02Z".into(),
            preview: Some("US CPI cooled more than expected.".into()),
            body_text: Some(
                "US CPI cooled more than expected across both headline and core prints.".into(),
            ),
        })
        .expect("ingest source entry");

    assert!(result.created_collection);
    assert_eq!(result.time_bucket, "2026-04-10T12:00:00Z");
    assert_eq!(result.entry_count, 1);

    let collection = repo
        .read_json_path::<CollectionRecordFile>(&repo.collection_file_path(&result.collection_id))
        .expect("collection record");
    assert_eq!(collection.entry_count, 1);
    assert_eq!(collection.source_ref, "news:macro-wire:cpi");

    let entries = repo
        .read_ndjson_path::<CollectionEntryFile>(
            &repo.collection_entries_path(&result.collection_id),
        )
        .expect("entries shard");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].entry_id, result.entry_id);
    assert_eq!(entries[0].blob_ref.as_deref(), result.blob_id.as_deref());

    let blob_path = repo.blob_path(result.blob_id.as_deref().expect("blob id"));
    assert!(blob_path.exists(), "blob should be persisted");
    let entry_document_path =
        repo.collection_entry_document_path(&result.collection_id, &result.entry_id);
    assert!(
        entry_document_path.exists(),
        "entry document should be materialized"
    );

    let collection_detail = repo
        .load_collection_detail(&result.collection_id)
        .expect("collection detail");
    assert_eq!(
        collection_detail.entries[0].entry_path_ref,
        repo.display_path(&entry_document_path)
    );

    let bootstrap = repo.load_bootstrap_state().expect("bootstrap after ingest");
    assert!(
        bootstrap.document_catalog.iter().any(|document| {
            document.path_ref == repo.display_path(&entry_document_path)
                && document.category == "entry"
        }),
        "entry document should be promoted into the workspace document catalog"
    );
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(
                |document| document.path_ref == repo.display_path(&blob_path)
                    && document.category == "blob"
            ),
        "blob should be promoted into the workspace document catalog"
    );
    let entry_document = repo
        .load_workspace_document(&repo.display_path(&entry_document_path))
        .expect("entry document detail");
    assert!(
        entry_document
            .backlinks
            .iter()
            .any(|backlink| backlink.reason == "entry shard materializes entry document"),
        "entry document should backlink to the owning entry shard"
    );
    let blob_document = repo
        .load_workspace_document(&repo.display_path(&blob_path))
        .expect("blob document detail");
    assert!(
        blob_document
            .backlinks
            .iter()
            .any(|backlink| backlink.reason == "entry shard references blob"),
        "blob document should backlink to the owning entry shard"
    );
    assert!(
        blob_document
            .backlinks
            .iter()
            .any(|backlink| backlink.reason == "entry document references blob"),
        "blob document should backlink to the entry document as well"
    );

    let collections_index = repo
        .read_json_path::<CollectionsIndexFile>(&root.join("indexes/collections.json"))
        .expect("collections index");
    assert!(
        collections_index
            .items
            .iter()
            .any(|item| item.collection_id == result.collection_id),
        "new collection should be indexed"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn ingest_source_entry_reuses_hour_bucket_and_blob_for_same_payload() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let first = repo
        .ingest_source_entry(IngestSourceEntryInput {
            kind: "raw".into(),
            source_ref: "news:macro-wire:cpi".into(),
            event_time: "2026-04-10T12:14:55Z".into(),
            ingested_at: "2026-04-10T12:15:02Z".into(),
            preview: Some("US CPI cooled more than expected.".into()),
            body_text: Some(
                "US CPI cooled more than expected across both headline and core prints.".into(),
            ),
        })
        .expect("first ingest");
    let second = repo
        .ingest_source_entry(IngestSourceEntryInput {
            kind: "raw".into(),
            source_ref: "news:macro-wire:cpi".into(),
            event_time: "2026-04-10T12:44:05Z".into(),
            ingested_at: "2026-04-10T12:44:06Z".into(),
            preview: Some("US CPI cooled more than expected.".into()),
            body_text: Some(
                "US CPI cooled more than expected across both headline and core prints.".into(),
            ),
        })
        .expect("second ingest");

    assert_eq!(first.collection_id, second.collection_id);
    assert_eq!(first.blob_id, second.blob_id);
    assert!(!second.created_collection);
    assert_eq!(second.entry_count, 2);

    let entries = repo
        .read_ndjson_path::<CollectionEntryFile>(
            &repo.collection_entries_path(&first.collection_id),
        )
        .expect("entries shard");
    assert_eq!(entries.len(), 2);

    let blob_path = repo.blob_path(second.blob_id.as_deref().expect("blob id"));
    assert!(blob_path.exists(), "deduplicated blob should exist");

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn import_export_bundle_stages_sanitized_bundle_without_mutating_live_workspace() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let export_bundle_ref = export_state
        .asset_inspector
        .latest_export_bundle_ref
        .clone()
        .expect("latest export bundle ref");
    let live_before = repo
        .load_bootstrap_state()
        .expect("bootstrap before import");

    let imported = repo
        .import_export_bundle(&export_bundle_ref)
        .expect("import export bundle");

    let live_after = repo.load_bootstrap_state().expect("bootstrap after import");
    assert_eq!(
        live_before.workspace.artifact_id,
        live_after.workspace.artifact_id
    );
    assert_eq!(
        serde_json::to_string(&live_before.positions).expect("serialize positions before"),
        serde_json::to_string(&live_after.positions).expect("serialize positions after")
    );

    let import_metadata_path = root
        .join("imports")
        .join("items")
        .join(&imported.import_id)
        .join("import.json");
    assert!(
        import_metadata_path.exists(),
        "import metadata should be persisted"
    );
    assert!(
        root.join("imports")
            .join("items")
            .join(&imported.import_id)
            .join("workspace")
            .join("strategy.json")
            .exists(),
        "imported workspace should be copied"
    );
    assert!(
        root.join("imports")
            .join("items")
            .join(&imported.import_id)
            .join("bundle")
            .join("export.json")
            .exists(),
        "imported export manifest should be copied"
    );

    let imports_index = repo
        .read_json_path::<ImportsIndexFile>(&root.join("imports/index.json"))
        .expect("imports index");
    assert_eq!(imports_index.items.len(), 1);
    assert_eq!(imports_index.items[0].import_id, imported.import_id);

    let bootstrap = repo.load_bootstrap_state().expect("bootstrap with imports");
    assert_eq!(bootstrap.imports.len(), 1);
    assert_eq!(bootstrap.imports[0].id, imported.import_id);
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(|document| document.id == format!("import-{}", imported.import_id)),
        "document catalog should expose staged import manifests"
    );
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(|document| document.id == format!("import-bundle-{}", imported.import_id)),
        "document catalog should expose staged import bundle manifests"
    );

    let import_detail = repo
        .load_import_detail(&imported.import_id)
        .expect("import detail");
    assert_eq!(import_detail.id, imported.import_id);
    assert!(
        import_detail
            .workspace_file_refs
            .iter()
            .any(|path| path.ends_with("strategy.json")),
        "staged import should expose workspace files for inspection"
    );
    let import_comparison = repo
        .compare_import(&imported.import_id)
        .expect("import comparison");
    assert_eq!(import_comparison.import_id, imported.import_id);
    assert!(
        import_comparison.summary.contains("current workspace"),
        "import comparison should describe the current workspace as the baseline"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn export_checkpoint_materializes_bundle_for_existing_promotion_checkpoint() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let initial = repo.load_bootstrap_state().expect("initial bootstrap");
    let promotion = initial
        .checkpoints
        .iter()
        .find(|checkpoint| checkpoint.r#type == "promotion")
        .expect("promotion checkpoint");

    let exported = repo
        .export_checkpoint(&promotion.id)
        .expect("export existing checkpoint");
    let exported_summary = exported
        .checkpoints
        .iter()
        .find(|checkpoint| checkpoint.id == promotion.id)
        .expect("exported checkpoint summary");

    assert!(
        exported_summary.export_bundle_ref.is_some(),
        "existing checkpoint should now advertise a sanitized export bundle"
    );
    assert_eq!(
        exported.asset_inspector.latest_export_bundle_ref,
        exported_summary.export_bundle_ref
    );
    assert!(
        repo.export_bundle_path(&promotion.id).exists(),
        "exporting an existing checkpoint should materialize the export bundle"
    );
    assert!(
        exported
            .operations
            .iter()
            .any(|operation| operation.kind == "export_checkpoint"),
        "exporting an existing checkpoint should append a workspace operation"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn export_checkpoint_excludes_protected_roots_from_sanitized_bundle() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    fs::create_dir_all(root.join("secrets")).expect("create secrets dir");
    fs::create_dir_all(root.join("credentials")).expect("create credentials dir");
    fs::write(root.join("secrets/runtime.token"), "top-secret").expect("write secret");
    fs::write(
        root.join("credentials/binance.json"),
        "{\"api_key\":\"redacted\"}",
    )
    .expect("write credential");

    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let export_bundle_ref = export_state
        .asset_inspector
        .latest_export_bundle_ref
        .clone()
        .expect("latest export bundle ref");
    let export_bundle_path = repo.project_root().join(&export_bundle_ref);
    let export_bundle = repo
        .read_json_path::<ExportBundleFile>(&export_bundle_path)
        .expect("export bundle");
    let export_workspace = export_bundle_path
        .parent()
        .expect("export root")
        .join("workspace");

    for protected_root in [
        "checkpoints",
        "imports",
        "operations",
        "exports/generated",
        "secrets",
        "credentials",
    ] {
        assert!(
            !export_workspace.join(protected_root).exists(),
            "sanitized export should exclude protected root {protected_root}"
        );
    }

    assert!(
        export_bundle
            .excluded_paths
            .iter()
            .any(|path| path == "./workspace/imports"),
        "export manifest should declare imports as excluded"
    );
    assert!(
        export_bundle
            .excluded_paths
            .iter()
            .any(|path| path == "./workspace/operations"),
        "export manifest should declare operations as excluded"
    );
    assert!(
        export_bundle
            .included_refs
            .iter()
            .all(|path| !path.starts_with("./workspace/secrets")
                && !path.starts_with("./workspace/credentials")),
        "included refs should not leak secret-bearing roots"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn workspace_operations_are_recorded_for_service_mutations() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    repo.pause_global_automation().expect("pause");
    repo.ingest_source_entry(IngestSourceEntryInput {
        kind: "raw".into(),
        source_ref: "notes:operator:runtime".into(),
        event_time: "2026-04-10T15:01:00Z".into(),
        ingested_at: "2026-04-10T15:01:01Z".into(),
        preview: Some("Operator note".into()),
        body_text: Some("Operator note body".into()),
    })
    .expect("ingest");

    let operations_index = repo
        .read_json_path::<OperationsIndexFile>(&root.join("operations/index.json"))
        .expect("operations index");
    assert_eq!(operations_index.items.len(), 2);
    assert_eq!(operations_index.items[0].kind, "ingest_source_entry");
    assert_eq!(operations_index.items[1].kind, "pause_global_automation");
    assert!(
        operations_index.items[0]
            .related_refs
            .iter()
            .any(|path| path.contains("/entries/") && path.ends_with(".json")),
        "ingest operation should retain the materialized entry document ref"
    );
    assert!(
        operations_index.items[1]
            .related_refs
            .iter()
            .any(|path| path.ends_with("state/runtime-status.json")),
        "pause operation should retain the runtime status document ref"
    );
    assert!(
        operations_index.items[1]
            .related_refs
            .iter()
            .any(|path| path.ends_with("state/decisions.json")),
        "pause operation should retain the decision log ref"
    );

    let operation_path = repo.operation_file_path(&operations_index.items[0].operation_id);
    assert!(
        operation_path.exists(),
        "operation record should be materialized"
    );

    let bootstrap = repo
        .load_bootstrap_state()
        .expect("bootstrap with operations");
    assert_eq!(bootstrap.operations.len(), 2);
    assert_eq!(bootstrap.operations[0].kind, "ingest_source_entry");
    assert_eq!(bootstrap.workspace_index.operation_count, 2);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn load_operation_detail_resolves_catalog_documents() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    repo.pause_global_automation().expect("pause");
    let bootstrap = repo.load_bootstrap_state().expect("bootstrap");
    let operation = bootstrap.operations.first().expect("operation summary");
    let detail = repo
        .load_operation_detail(&operation.id)
        .expect("operation detail");

    assert_eq!(detail.id, operation.id);
    assert!(
        detail
            .related_documents
            .iter()
            .any(|document| document.path_ref.ends_with("live-lane.json")),
        "operation detail should resolve related workspace documents"
    );
    assert!(
        detail
            .related_documents
            .iter()
            .any(|document| document.path_ref.ends_with("state/runtime-status.json")),
        "operation detail should expose runtime status state when it was mutated"
    );
    assert!(
        detail.unresolved_refs.is_empty(),
        "service-owned pause operation should resolve all related refs through the document catalog"
    );
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(|document| document.id == format!("operation-{}", operation.id)),
        "document catalog should expose individual operation documents"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn search_workspace_matches_metadata_and_content() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let metadata_results = repo.search_workspace("live lane").expect("metadata search");
    assert!(
        metadata_results
            .iter()
            .any(|result| result.path_ref.ends_with("live/live-lane.json")),
        "metadata search should find the live lane document"
    );

    let content_results = repo
        .search_workspace("model cost and slippage")
        .expect("content search");
    assert!(
        content_results
            .iter()
            .any(|result| result.match_kind == "content"),
        "content search should surface excerpt-backed matches"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn load_workspace_document_reports_backlinks() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");
    let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

    let document = repo
        .load_workspace_document(&bootstrap.asset_inspector.live_lane_ref)
        .expect("workspace document");
    assert!(
        document
            .backlinks
            .iter()
            .any(|backlink| backlink.reason == "active.live_lane_ref"),
        "live lane document should report a backlink from strategy.json"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn load_bootstrap_state_promotes_live_state_documents_into_catalog() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");
    let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

    for (path_ref, expected_id) in [
        (
            &bootstrap.live_context.runtime_status_ref,
            "live-runtime-status",
        ),
        (&bootstrap.live_context.dashboard_ref, "live-dashboard"),
        (&bootstrap.live_context.decisions_ref, "live-decisions"),
        (&bootstrap.live_context.memory_ref, "live-memory"),
        (&bootstrap.live_context.positions_ref, "live-positions"),
        (&bootstrap.live_context.orders_ref, "live-orders"),
    ] {
        assert!(
            bootstrap
                .document_catalog
                .iter()
                .any(|item| item.id == expected_id && item.path_ref == *path_ref),
            "{expected_id} should be promoted into the workspace document catalog"
        );

        let document = repo
            .load_workspace_document(path_ref)
            .expect("live state workspace document");
        assert!(
            document
                .backlinks
                .iter()
                .any(|backlink| backlink.path_ref == bootstrap.asset_inspector.live_lane_ref),
            "{expected_id} should backlink to the live lane"
        );
    }

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn normalize_workspace_materializes_session_and_eval_documents() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let legacy_sessions = serde_json::json!({
        "sessions": [
            {
                "label": "legacy-live-session"
            }
        ]
    });
    let legacy_eval_summaries = serde_json::json!({
        "summaries": [
            {
                "evidence_refs": ["../checkpoints/index.json#items[0]"]
            }
        ]
    });

    repo.write_json_path(&root.join("indexes/sessions.json"), &legacy_sessions)
        .expect("write legacy sessions");
    repo.write_json_path(
        &root.join("state/eval-summaries.json"),
        &legacy_eval_summaries,
    )
    .expect("write legacy eval summaries");
    let _ = fs::remove_dir_all(root.join("sessions"));
    let _ = fs::remove_dir_all(root.join("eval-summaries"));

    repo.normalize_workspace().expect("normalize workspace");
    let bootstrap = repo.load_bootstrap_state().expect("bootstrap");

    let sessions_index = repo
        .read_json_path::<SessionsIndexFile>(&root.join("indexes/sessions.json"))
        .expect("sessions index");
    let session = sessions_index.sessions.first().expect("session entry");
    let session_path = repo.resolve_ref(
        &root.join("indexes/sessions.json"),
        session.path_ref.as_deref().expect("session path ref"),
    );
    assert!(session_path.exists(), "session item should be materialized");
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(|item| item.category == "session"),
        "session documents should appear in the service-owned catalog"
    );
    assert_eq!(bootstrap.live_context.sessions.len(), 1);

    let eval_index = repo
        .read_json_path::<EvalSummariesFile>(&root.join("state/eval-summaries.json"))
        .expect("eval summaries");
    let summary = eval_index.summaries.first().expect("eval summary");
    let summary_path = repo.resolve_ref(
        &root.join("state/eval-summaries.json"),
        summary.path_ref.as_deref().expect("summary path ref"),
    );
    assert!(
        summary_path.exists(),
        "eval summary item should be materialized"
    );
    assert!(
        bootstrap
            .document_catalog
            .iter()
            .any(|item| item.category == "evaluation"),
        "evaluation summary documents should appear in the service-owned catalog"
    );
    assert_eq!(bootstrap.live_context.evaluation_summaries.len(), 1);

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn compare_checkpoints_reports_workspace_differences() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let export_state = repo.create_export_checkpoint().expect("export checkpoint");
    let export_checkpoint_id = export_state
        .checkpoints
        .first()
        .map(|checkpoint| checkpoint.id.clone())
        .expect("export checkpoint id");

    let flattened = repo.flatten_all_positions().expect("flatten");
    let incident_checkpoint_id = flattened
        .checkpoints
        .first()
        .map(|checkpoint| checkpoint.id.clone())
        .expect("incident checkpoint id");

    let comparison = repo
        .compare_checkpoints(&export_checkpoint_id, &incident_checkpoint_id)
        .expect("compare checkpoints");

    assert!(comparison.compared_file_count > 0);
    assert!(
        comparison
            .files
            .iter()
            .any(|file| file.relative_path == "state/positions.json"),
        "positions.json should differ after flattening live positions"
    );
    assert!(
        comparison.changed_count >= 1,
        "at least one file should differ between export and incident checkpoints"
    );

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn evaluation_runs_are_persisted_and_queryable() {
    let root = test_root();
    let template_root = WorkspaceRepository::default_template_root();
    let repo = WorkspaceRepository::new(root.clone(), template_root).expect("workspace");

    let backtest = repo.run_backtest().expect("run backtest");
    let backtest_run = backtest
        .evaluation_runs
        .first()
        .cloned()
        .expect("backtest run summary");
    assert_eq!(backtest_run.kind, "backtest");
    assert!(
        backtest
            .operations
            .iter()
            .any(|operation| operation.kind == "run_backtest"),
        "backtest should be recorded as a workspace operation"
    );
    assert!(
        backtest
            .live_context
            .evaluation_summaries
            .first()
            .map(|summary| summary
                .evidence_refs
                .iter()
                .any(|item| item == &backtest_run.path_ref))
            .unwrap_or(false),
        "live eval summaries should carry evidence refs to the new run"
    );

    let backtest_detail = repo
        .load_evaluation_run_detail(&backtest_run.id)
        .expect("backtest detail");
    assert_eq!(backtest_detail.id, backtest_run.id);
    assert!(
        !backtest_detail.collection_refs.is_empty(),
        "backtest run should preserve collection refs for replay"
    );

    let paper = repo.run_paper_evaluation().expect("run paper evaluation");
    let paper_run = paper
        .evaluation_runs
        .first()
        .cloned()
        .expect("paper run summary");
    assert_eq!(paper_run.kind, "paper");
    assert!(
        paper
            .operations
            .iter()
            .any(|operation| operation.kind == "run_paper_evaluation"),
        "paper evaluation should be recorded as a workspace operation"
    );

    let evaluations_index = repo
        .read_json_path::<EvaluationsIndexFile>(&root.join("evaluations/index.json"))
        .expect("evaluations index");
    assert!(
        evaluations_index.items.len() >= 2,
        "backtest and paper runs should both be indexed"
    );
    assert_eq!(
        evaluations_index
            .items
            .first()
            .map(|item| item.kind.as_str()),
        Some("paper"),
        "latest evaluation should be the most recent paper run"
    );

    let paper_run_path = repo.evaluation_run_file_path(&paper_run.id);
    assert!(
        paper_run_path.exists(),
        "paper run file should be materialized"
    );

    let _ = fs::remove_dir_all(&root);
}
