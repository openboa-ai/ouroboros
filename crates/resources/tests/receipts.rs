use ouroboros_contracts::{
    CollectionBinding, CollectionRecord, CollectionRequest, RetirementPolicy, RetirementRecord,
    RetirementRequest, RetirementTarget,
};
use ouroboros_resources::{
    CatalogWorker, CollectionPreparation, CompanyWorker, storage::BoundStore,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::{io::Write, os::fd::AsRawFd, path::Path};
use uuid::Uuid;
mod support;
// Test-owner-only deferred triggers fail actual PostgreSQL COMMIT. Runtime credentials have
// neither a failure-injection setting nor the authority to install these functions/triggers.
async fn reject_insert_at_commit(pool: &sqlx::PgPool, table: &str, intent: Uuid) -> String {
    assert!(
        [
            "upload_staging",
            "uploads",
            "publication_receipts",
            "workspace_create_receipts",
            "catalog_retirements",
            "catalog_collections"
        ]
        .contains(&table)
    );
    // Audited DDL: generated UUID identifier, typed UUID value, and allowlisted table.
    let name = format!("fixture_failure_{}", Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected disposable commit failure'; END $$")))
        .execute(pool).await.unwrap();
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE CONSTRAINT TRIGGER {name} AFTER INSERT ON {table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.intent_id='{intent}'::uuid) EXECUTE FUNCTION {name}()")))
        .execute(pool).await.unwrap();
    name
}
async fn remove_commit_failure(pool: &sqlx::PgPool, table: &str, name: &str) {
    // Cleanup accepts only the same finite table set and generated identifier spelling.
    assert!(
        [
            "upload_staging",
            "uploads",
            "publication_receipts",
            "workspace_create_receipts",
            "catalog_retirements",
            "catalog_collections"
        ]
        .contains(&table)
    );
    let suffix = name
        .strip_prefix("fixture_failure_")
        .expect("fixture trigger prefix");
    assert!(suffix.len() == 32 && suffix.bytes().all(|b| b.is_ascii_hexdigit()));
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "DROP TRIGGER {name} ON {table}"
    )))
    .execute(pool)
    .await
    .unwrap();
    sqlx::query(sqlx::AssertSqlSafe(format!("DROP FUNCTION {name}()")))
        .execute(pool)
        .await
        .unwrap();
}

// Uses the same protected, disposable store and restricted worker as the receipt suite.
// Owner-only mutations below simulate corrupted/missing evidence; they are not product APIs.
async fn retained_objects_and_workspaces(
    file: &CatalogWorker,
    catalog: &sqlx::PgPool,
    firm: Uuid,
    root: &Path,
) -> (Uuid, ouroboros_resources::WorkspaceRecord) {
    let creation = Uuid::new_v4();
    let work = Uuid::new_v4();
    let namespace = Uuid::new_v4();
    let workspace = Uuid::new_v4();
    assert!(
        file.workspace_creation_receipt(
            firm,
            creation,
            work,
            namespace,
            workspace,
            "retained files"
        )
        .await
        .unwrap()
        .is_none()
    );
    let (a, b) = tokio::join!(
        file.create_workspace(firm, creation, work, namespace, workspace, "retained files"),
        file.create_workspace(firm, creation, work, namespace, workspace, "retained files")
    );
    let created = a.unwrap();
    assert_eq!(created, b.unwrap());
    assert_eq!(created.revision, 0);
    file.validate_workspace(firm, workspace, work, namespace)
        .await
        .unwrap();
    assert!(
        file.validate_workspace(firm, workspace, Uuid::new_v4(), namespace)
            .await
            .is_err()
    );
    assert!(
        file.validate_workspace(firm, workspace, work, Uuid::new_v4())
            .await
            .is_err()
    );
    assert!(
        file.create_workspace(firm, creation, work, namespace, workspace, "changed label")
            .await
            .is_err()
    );
    assert!(
        file.create_workspace(
            firm,
            creation,
            work,
            namespace,
            Uuid::new_v4(),
            "retained files"
        )
        .await
        .is_err()
    );
    for label in ["", " padded", "trailing\n"] {
        assert!(
            file.create_workspace(firm, Uuid::new_v4(), work, namespace, Uuid::new_v4(), label)
                .await
                .is_err()
        );
    }
    let empty_revision: (i64, serde_json::Value) =
        sqlx::query_as("SELECT revision,manifest FROM workspaces WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(workspace)
            .fetch_one(catalog)
            .await
            .unwrap();
    assert_eq!(empty_revision, (0, json!({})));

    // A creation receipt cannot conceal inconsistent initial snapshot evidence or repair it.
    let corrupt_initial = json!({"unexpected.txt": "not an empty allocation"});
    sqlx::query("UPDATE workspace_snapshots SET manifest=$3 WHERE firm_id=$1 AND workspace_id=$2 AND revision=0")
        .bind(firm).bind(workspace).bind(&corrupt_initial).execute(catalog).await.unwrap();
    assert!(
        file.workspace_creation_receipt(
            firm,
            creation,
            work,
            namespace,
            workspace,
            "retained files"
        )
        .await
        .is_err()
    );
    assert!(
        file.create_workspace(firm, creation, work, namespace, workspace, "retained files")
            .await
            .is_err()
    );
    let unchanged: serde_json::Value = sqlx::query_scalar("SELECT manifest FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=0")
        .bind(firm).bind(workspace).fetch_one(catalog).await.unwrap();
    assert_eq!(unchanged, corrupt_initial);
    sqlx::query("UPDATE workspace_snapshots SET manifest='{}' WHERE firm_id=$1 AND workspace_id=$2 AND revision=0")
        .bind(firm).bind(workspace).execute(catalog).await.unwrap();
    assert_eq!(
        file.workspace_creation_receipt(
            firm,
            creation,
            work,
            namespace,
            workspace,
            "retained files"
        )
        .await
        .unwrap(),
        Some(created.clone())
    );

    let failed = Uuid::new_v4();
    let failed_workspace = Uuid::new_v4();
    let trigger = reject_insert_at_commit(catalog, "workspace_create_receipts", failed).await;
    assert!(
        file.create_workspace(
            firm,
            failed,
            work,
            namespace,
            failed_workspace,
            "atomic create"
        )
        .await
        .is_err()
    );
    let absent: (i64, i64) = sqlx::query_as("SELECT (SELECT count(*) FROM workspaces WHERE firm_id=$1 AND id=$2),(SELECT count(*) FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2)")
        .bind(firm).bind(failed_workspace).fetch_one(catalog).await.unwrap();
    assert_eq!(absent, (0, 0));
    assert!(
        file.workspace_creation_receipt(
            firm,
            failed,
            work,
            namespace,
            failed_workspace,
            "atomic create"
        )
        .await
        .unwrap()
        .is_none()
    );
    remove_commit_failure(catalog, "workspace_create_receipts", &trigger).await;

    let bytes = b"equal content has independent owned physical lifetimes";
    let digest = format!("{:x}", Sha256::digest(bytes));
    let upload_a = Uuid::new_v4();
    let upload_b = Uuid::new_v4();
    for upload in [upload_a, upload_b] {
        file.upload(firm, upload, &digest, bytes, 1024)
            .await
            .unwrap();
    }
    let object_a = file
        .upload_reference(firm, upload_a, &digest, bytes.len() as u64)
        .await
        .unwrap()
        .unwrap();
    let object_b = file
        .upload_reference(firm, upload_b, &digest, bytes.len() as u64)
        .await
        .unwrap()
        .unwrap();
    assert!(object_a.object_id.is_some() && object_b.object_id.is_some());
    assert_ne!(object_a.object_id, object_b.object_id);
    let id_a = object_a.object_id.unwrap();
    let id_b = object_b.object_id.unwrap();
    let path_a = root.join(format!("blob-{id_a}"));
    let path_b = root.join(format!("blob-{id_b}"));
    assert_eq!(std::fs::read(&path_a).unwrap(), bytes);
    assert_eq!(std::fs::read(&path_b).unwrap(), bytes);
    assert!(!root.join(&digest).exists());
    let inventory: (i64, i64, i64) = sqlx::query_as("SELECT (SELECT count(*) FROM blob_objects WHERE firm_id=$1 AND digest=$2 AND state='verified'),(SELECT sum(size)::bigint FROM blob_objects WHERE firm_id=$1 AND digest=$2),(SELECT count(*) FROM upload_object_holds h JOIN uploads u USING(firm_id,intent_id,object_id) WHERE u.firm_id=$1 AND u.digest=$2)")
        .bind(firm).bind(&digest).fetch_one(catalog).await.unwrap();
    assert_eq!(
        inventory,
        (2, (bytes.len() * 2) as i64, 2),
        "equal content retains two independently charged physical objects; Catalog does not rebate Core allocations"
    );
    file.upload(firm, upload_a, &digest, bytes, 1024)
        .await
        .unwrap();
    assert_eq!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .unwrap(),
        Some(object_a.clone())
    );

    let publication_a = Uuid::new_v4();
    let first_files = BTreeMap::from([
        ("a.txt".into(), upload_a),
        ("same-object.txt".into(), upload_a),
    ]);
    assert_eq!(
        file.publish(firm, publication_a, workspace, 0, first_files.clone())
            .await
            .unwrap(),
        1
    );
    let publication_b = Uuid::new_v4();
    assert_eq!(
        file.publish(
            firm,
            publication_b,
            workspace,
            1,
            BTreeMap::from([("a.txt".into(), upload_b)])
        )
        .await
        .unwrap(),
        2
    );
    let holds: Vec<(i64, Uuid)> = sqlx::query_as("SELECT revision,object_id FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 ORDER BY revision,object_id")
        .bind(firm).bind(workspace).fetch_all(catalog).await.unwrap();
    assert_eq!(
        holds,
        vec![(1, id_a), (2, id_b)],
        "the head's revision hold is distinct from the previous retained revision; repeated paths need only one hold"
    );
    let snapshots: Vec<(i64, serde_json::Value)> = sqlx::query_as("SELECT revision,manifest FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 ORDER BY revision")
        .bind(firm).bind(workspace).fetch_all(catalog).await.unwrap();
    assert_eq!(snapshots.len(), 3);
    assert_eq!(snapshots[1].1["a.txt"], json!(object_a));
    assert_eq!(snapshots[2].1["a.txt"], json!(object_b));
    assert_eq!(
        file.workspace_creation_receipt(
            firm,
            creation,
            work,
            namespace,
            workspace,
            "retained files"
        )
        .await
        .unwrap(),
        Some(created.clone()),
        "creation replay returns initial revision rather than current head"
    );

    // A live reader owns a shared physical lock while no Catalog transaction remains open.
    let mut reader = file
        .open_file(firm, workspace, 1, "a.txt", 1024)
        .await
        .unwrap();
    let fd = std::fs::OpenOptions::new()
        .read(true)
        .open(&path_a)
        .unwrap();
    assert_eq!(
        unsafe { libc::flock(fd.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        -1
    );
    let mut tx = catalog.begin().await.unwrap();
    sqlx::query("SET LOCAL lock_timeout='250ms'")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("SELECT object_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR UPDATE")
        .bind(firm)
        .bind(id_a)
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(file.read_file_chunk(&mut reader, 1024).unwrap(), bytes);
    drop(reader);
    assert_eq!(
        unsafe { libc::flock(fd.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) },
        0
    );
    assert_eq!(unsafe { libc::flock(fd.as_raw_fd(), libc::LOCK_UN) }, 0);

    // Reference loss is not repaired by observation. The other hold owner remains independent.
    sqlx::query(
        "DELETE FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=1",
    )
    .bind(firm)
    .bind(workspace)
    .execute(catalog)
    .await
    .unwrap();
    assert!(
        file.open_file(firm, workspace, 1, "a.txt", 1024)
            .await
            .is_err()
    );
    assert!(
        file.publication_receipt(firm, publication_a, workspace, 0, first_files.clone())
            .await
            .is_err()
    );
    assert!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .unwrap()
            .is_some()
    );
    sqlx::query("INSERT INTO revision_object_holds(firm_id,workspace_id,revision,object_id) VALUES($1,$2,1,$3)")
        .bind(firm)
        .bind(workspace)
        .bind(id_a)
        .execute(catalog)
        .await
        .unwrap();
    sqlx::query("DELETE FROM upload_object_holds WHERE firm_id=$1 AND intent_id=$2")
        .bind(firm)
        .bind(upload_a)
        .execute(catalog)
        .await
        .unwrap();
    assert!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .is_err()
    );
    assert_eq!(
        file.read_file(firm, workspace, 1, "a.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes
    );
    sqlx::query("INSERT INTO upload_object_holds(firm_id,intent_id,object_id) VALUES($1,$2,$3)")
        .bind(firm)
        .bind(upload_a)
        .bind(id_a)
        .execute(catalog)
        .await
        .unwrap();

    // Same digest at a legacy path or another object cannot satisfy a missing exact generation.
    let mut legacy = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(root.join(&digest))
        .unwrap();
    legacy.write_all(bytes).unwrap();
    legacy.sync_all().unwrap();
    drop(legacy);
    let displaced = root.join(format!("fixture-displaced-{id_a}"));
    std::fs::rename(&path_a, &displaced).unwrap();
    assert!(
        file.open_file(firm, workspace, 1, "a.txt", 1024)
            .await
            .is_err()
    );
    assert!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        file.read_file(firm, workspace, 2, "a.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes
    );
    std::fs::rename(displaced, &path_a).unwrap();

    let legacy_upload = Uuid::new_v4();
    let legacy_workspace = Uuid::new_v4();
    sqlx::query("INSERT INTO uploads(firm_id,intent_id,digest,size) VALUES($1,$2,$3,$4)")
        .bind(firm)
        .bind(legacy_upload)
        .bind(&digest)
        .bind(bytes.len() as i64)
        .execute(catalog)
        .await
        .unwrap();
    sqlx::query("INSERT INTO workspaces(firm_id,id,revision,manifest) VALUES($1,$2,0,$3)")
        .bind(firm)
        .bind(legacy_workspace)
        .bind(json!({"legacy.txt":digest}))
        .execute(catalog)
        .await
        .unwrap();
    assert_eq!(
        file.read_file(firm, legacy_workspace, 0, "legacy.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes
    );
    let legacy_reference = file
        .upload_reference(firm, legacy_upload, &digest, bytes.len() as u64)
        .await
        .unwrap()
        .unwrap();
    assert!(
        legacy_reference.object_id.is_none(),
        "legacy observation cannot adopt a new generation"
    );
    let legacy_stage_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM upload_staging WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm)
            .bind(legacy_upload)
            .fetch_one(catalog)
            .await
            .unwrap();
    file.upload(firm, legacy_upload, &digest, bytes, 1024)
        .await
        .unwrap();
    let legacy_stage_after: i64 =
        sqlx::query_scalar("SELECT count(*) FROM upload_staging WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm)
            .bind(legacy_upload)
            .fetch_one(catalog)
            .await
            .unwrap();
    assert_eq!((legacy_stage_count, legacy_stage_after), (0, 0));
    assert!(
        file.validate_workspace(firm, legacy_workspace, work, namespace)
            .await
            .is_err(),
        "legacy namespace cannot impersonate a newly allocated workspace"
    );
    (creation, created)
}

// Explicit policy governs ordinary references. The Core admission/barrier tests separately
// prove requester authority; this fixture exercises the restricted Catalog transaction boundary.
async fn reference_retirement(
    file: &CatalogWorker,
    catalog: &sqlx::PgPool,
    firm: Uuid,
    root: &Path,
) -> (
    Uuid,
    Uuid,
    RetirementRequest,
    RetirementPolicy,
    RetirementRecord,
) {
    let work = Uuid::new_v4();
    let namespace = Uuid::new_v4();
    let workspace = Uuid::new_v4();
    let creation = Uuid::new_v4();
    file.create_workspace(
        firm,
        creation,
        work,
        namespace,
        workspace,
        "retirement fixture",
    )
    .await
    .unwrap();
    let policy = RetirementPolicy {
        id: Uuid::new_v4(),
        revision: 1,
        min_retention_seconds: 0,
        allowed: vec!["upload".into(), "revision".into(), "workspace_close".into()],
    };
    let request = |target| RetirementRequest {
        target,
        reason: "fixture material is no longer needed".into(),
        policy_id: policy.id,
        policy_revision: policy.revision,
    };
    let upload_a = Uuid::new_v4();
    let upload_b = Uuid::new_v4();
    let bytes_a = b"retirement preserves the original effect";
    let bytes_b = b"closure retains historical readers";
    let digest_a = format!("{:x}", Sha256::digest(bytes_a));
    let digest_b = format!("{:x}", Sha256::digest(bytes_b));
    file.upload(firm, upload_a, &digest_a, bytes_a, 1024)
        .await
        .unwrap();
    file.upload(firm, upload_b, &digest_b, bytes_b, 1024)
        .await
        .unwrap();
    let stale = file
        .prepare_upload(firm, upload_a, &digest_a, bytes_a.len() as u64, 1024)
        .await
        .unwrap();
    let object_a = stale.object_id.unwrap();
    let files_a = BTreeMap::from([("result.txt".into(), upload_a)]);
    let files_b = BTreeMap::from([("result.txt".into(), upload_b)]);
    let publication_a = Uuid::new_v4();
    let publication_b = Uuid::new_v4();
    file.publish(firm, publication_a, workspace, 0, files_a.clone())
        .await
        .unwrap();
    file.publish(firm, publication_b, workspace, 1, files_b.clone())
        .await
        .unwrap();
    let original_times: (bool, bool, bool) = sqlx::query_as("SELECT (SELECT completed_at IS NOT NULL FROM workspaces WHERE firm_id=$1 AND id=$2),(SELECT completed_at IS NOT NULL FROM uploads WHERE firm_id=$1 AND intent_id=$3),(SELECT completed_at IS NOT NULL FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=2)")
        .bind(firm).bind(workspace).bind(upload_a).fetch_one(catalog).await.unwrap();
    assert_eq!(original_times, (true, true, true));
    let head_request = request(RetirementTarget::Revision {
        workspace_id: workspace,
        revision: 2,
    });
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &head_request,
            &policy
        )
        .await
        .is_err()
    );
    let upload_request = request(RetirementTarget::Upload {
        upload_id: upload_a,
    });
    let retirement_a = Uuid::new_v4();
    assert!(
        file.retirement_receipt(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        )
        .await
        .unwrap()
        .is_none()
    );

    // Unknown original age cannot become "old" when the migration or policy is installed.
    let mut aged_policy = policy.clone();
    aged_policy.min_retention_seconds = 3600;
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &upload_request,
            &aged_policy
        )
        .await
        .is_err()
    );
    sqlx::query("UPDATE uploads SET completed_at=NULL WHERE firm_id=$1 AND intent_id=$2")
        .bind(firm)
        .bind(upload_a)
        .execute(catalog)
        .await
        .unwrap();
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &upload_request,
            &aged_policy
        )
        .await
        .is_err()
    );
    let mut denied = policy.clone();
    denied.allowed = vec!["revision".into()];
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &upload_request,
            &denied
        )
        .await
        .is_err()
    );

    // Actual COMMIT failure cannot leave a tombstone, release, or successful receipt behind.
    let trigger = reject_insert_at_commit(catalog, "catalog_retirements", retirement_a).await;
    assert!(
        file.retire_reference(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        )
        .await
        .is_err()
    );
    let untouched: (Option<Uuid>, Option<Uuid>) = sqlx::query_as("SELECT u.retired_by,h.released_by FROM uploads u JOIN upload_object_holds h USING(firm_id,intent_id,object_id) WHERE u.firm_id=$1 AND u.intent_id=$2")
        .bind(firm).bind(upload_a).fetch_one(catalog).await.unwrap();
    assert_eq!(untouched, (None, None));
    assert!(
        file.retirement_receipt(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        )
        .await
        .unwrap()
        .is_none()
    );
    remove_commit_failure(catalog, "catalog_retirements", &trigger).await;
    let (a, b) = tokio::join!(
        file.retire_reference(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        ),
        file.retire_reference(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        )
    );
    let retired = a.unwrap();
    assert_eq!(retired, b.unwrap());
    assert_eq!(retired.disposition, "upload_retired");
    let mut changed = upload_request.clone();
    changed.reason = "different reason".into();
    assert!(
        file.retire_reference(firm, retirement_a, work, namespace, &changed, &policy)
            .await
            .is_err()
    );
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &upload_request,
            &policy
        )
        .await
        .is_err()
    );
    assert!(
        file.retirement_receipt(
            firm,
            retirement_a,
            Uuid::new_v4(),
            namespace,
            &upload_request,
            &policy
        )
        .await
        .is_err()
    );
    let holds: (Option<Uuid>, Option<Uuid>) = sqlx::query_as("SELECT (SELECT released_by FROM upload_object_holds WHERE firm_id=$1 AND intent_id=$2),(SELECT released_by FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$3 AND revision=1 AND object_id=$4)")
        .bind(firm).bind(upload_a).bind(workspace).bind(object_a).fetch_one(catalog).await.unwrap();
    assert_eq!(holds, (Some(retirement_a), None));
    assert_eq!(
        file.read_file(firm, workspace, 1, "result.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes_a
    );
    assert!(
        file.publish(firm, Uuid::new_v4(), workspace, 2, files_a.clone())
            .await
            .is_err()
    );
    assert!(file.begin_upload(&stale).await.is_err());

    // Missing bytes change current usability, not the original committed effect's history.
    let original_path = root.join(format!("blob-{object_a}"));
    let displaced = root.join(format!("fixture-retired-{object_a}"));
    std::fs::rename(&original_path, &displaced).unwrap();
    assert!(file.begin_upload(&stale).await.is_err());
    assert!(
        !original_path.exists(),
        "a stale PreparedUpload must not recreate the object's UUID"
    );
    assert!(
        file.upload_reference(firm, upload_a, &digest_a, bytes_a.len() as u64)
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        file.publication_receipt(firm, publication_a, workspace, 0, files_a.clone())
            .await
            .unwrap(),
        Some(1)
    );
    assert_eq!(
        file.retirement_receipt(
            firm,
            retirement_a,
            work,
            namespace,
            &upload_request,
            &policy
        )
        .await
        .unwrap(),
        Some(retired)
    );
    assert!(
        file.open_file(firm, workspace, 1, "result.txt", 1024)
            .await
            .is_err()
    );
    std::fs::rename(displaced, &original_path).unwrap();

    let revision_request = request(RetirementTarget::Revision {
        workspace_id: workspace,
        revision: 1,
    });
    let retirement_revision = Uuid::new_v4();
    // An unexpected retained object is not swept up by retiring the named manifest.
    let object_b: Uuid =
        sqlx::query_scalar("SELECT object_id FROM uploads WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm)
            .bind(upload_b)
            .fetch_one(catalog)
            .await
            .unwrap();
    sqlx::query("INSERT INTO revision_object_holds(firm_id,workspace_id,revision,object_id) VALUES($1,$2,1,$3)")
        .bind(firm).bind(workspace).bind(object_b).execute(catalog).await.unwrap();
    assert!(
        file.retire_reference(
            firm,
            retirement_revision,
            work,
            namespace,
            &revision_request,
            &policy
        )
        .await
        .is_err()
    );
    let unexpected: Option<Uuid> = sqlx::query_scalar("SELECT released_by FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(object_b).fetch_one(catalog).await.unwrap();
    assert!(unexpected.is_none());
    sqlx::query("DELETE FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(object_b).execute(catalog).await.unwrap();
    assert!(
        file.retire_reference(
            firm,
            retirement_revision,
            work,
            Uuid::new_v4(),
            &revision_request,
            &policy
        )
        .await
        .is_err()
    );
    file.retire_reference(
        firm,
        retirement_revision,
        work,
        namespace,
        &revision_request,
        &policy,
    )
    .await
    .unwrap();
    assert!(
        file.open_file(firm, workspace, 1, "result.txt", 1024)
            .await
            .is_err()
    );
    assert_eq!(
        file.publication_receipt(firm, publication_a, workspace, 0, files_a.clone())
            .await
            .unwrap(),
        Some(1)
    );
    assert_eq!(
        file.publish(firm, publication_a, workspace, 0, files_a.clone())
            .await
            .unwrap(),
        1,
        "effect replay does not recreate revision holds"
    );
    let release: Option<Uuid> = sqlx::query_scalar("SELECT released_by FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(object_a).fetch_one(catalog).await.unwrap();
    assert_eq!(release, Some(retirement_revision));
    // A valid FK to a different retirement does not establish the required release lineage.
    sqlx::query("UPDATE revision_object_holds SET released_by=$4 WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(object_a).bind(retirement_a).execute(catalog).await.unwrap();
    assert!(
        file.publication_receipt(firm, publication_a, workspace, 0, files_a.clone())
            .await
            .is_err()
    );
    sqlx::query("UPDATE revision_object_holds SET released_by=$4 WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(object_a).bind(retirement_revision).execute(catalog).await.unwrap();

    let mut close_request = request(RetirementTarget::WorkspaceClose {
        workspace_id: workspace,
        expected_revision: 2,
    });
    let close = Uuid::new_v4();
    assert!(
        file.retire_reference(
            firm,
            close,
            work,
            namespace,
            &request(RetirementTarget::WorkspaceClose {
                workspace_id: workspace,
                expected_revision: 1
            }),
            &policy
        )
        .await
        .is_err()
    );
    let mut close_policy = policy.clone();
    close_policy.id = Uuid::new_v4();
    close_policy.min_retention_seconds = 3600;
    close_request.policy_id = close_policy.id;
    // An old allocation does not make the new head old enough for closure.
    sqlx::query("UPDATE workspaces SET completed_at=clock_timestamp()-INTERVAL '2 hours' WHERE firm_id=$1 AND id=$2")
        .bind(firm).bind(workspace).execute(catalog).await.unwrap();
    assert!(
        file.retire_reference(firm, close, work, namespace, &close_request, &close_policy)
            .await
            .is_err()
    );
    assert!(
        file.retirement_receipt(firm, close, work, namespace, &close_request, &close_policy)
            .await
            .unwrap()
            .is_none()
    );
    sqlx::query("UPDATE workspace_snapshots SET completed_at=clock_timestamp()-INTERVAL '2 hours' WHERE firm_id=$1 AND workspace_id=$2 AND revision=2")
        .bind(firm).bind(workspace).execute(catalog).await.unwrap();
    let closed = file
        .retire_reference(firm, close, work, namespace, &close_request, &close_policy)
        .await
        .unwrap();
    assert_eq!(closed.disposition, "workspace_closed");
    assert_eq!(
        file.read_file(firm, workspace, 2, "result.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes_b
    );
    assert!(
        file.publish(firm, Uuid::new_v4(), workspace, 2, BTreeMap::new())
            .await
            .is_err()
    );
    let retained_head: i64 = sqlx::query_scalar("SELECT count(*) FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=2 AND released_by IS NULL")
        .bind(firm).bind(workspace).fetch_one(catalog).await.unwrap();
    assert_eq!(
        retained_head, 1,
        "workspace closure retains head content and changes no byte ownership"
    );
    file.retire_reference(
        firm,
        Uuid::new_v4(),
        work,
        namespace,
        &head_request,
        &policy,
    )
    .await
    .unwrap();
    assert!(
        file.open_file(firm, workspace, 2, "result.txt", 1024)
            .await
            .is_err()
    );
    assert_eq!(
        file.publication_receipt(firm, publication_b, workspace, 1, files_b)
            .await
            .unwrap(),
        Some(2)
    );
    let zero_request = request(RetirementTarget::Revision {
        workspace_id: workspace,
        revision: 0,
    });
    file.retire_reference(
        firm,
        Uuid::new_v4(),
        work,
        namespace,
        &zero_request,
        &policy,
    )
    .await
    .unwrap();
    assert!(
        file.workspace_creation_receipt(
            firm,
            creation,
            work,
            namespace,
            workspace,
            "retirement fixture"
        )
        .await
        .unwrap()
        .is_some()
    );
    let legacy_upload = Uuid::new_v4();
    sqlx::query("INSERT INTO uploads(firm_id,intent_id,digest,size) VALUES($1,$2,$3,$4)")
        .bind(firm)
        .bind(legacy_upload)
        .bind(&digest_a)
        .bind(bytes_a.len() as i64)
        .execute(catalog)
        .await
        .unwrap();
    assert!(
        file.retire_reference(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &request(RetirementTarget::Upload {
                upload_id: legacy_upload
            }),
            &policy
        )
        .await
        .is_err()
    );
    let object_rows: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM blob_objects WHERE firm_id=$1 AND object_id=$2 AND state='verified'",
    )
    .bind(firm)
    .bind(object_a)
    .fetch_one(catalog)
    .await
    .unwrap();
    assert_eq!(object_rows, 1);
    assert!(
        original_path.exists(),
        "logical retirement never deletes bytes"
    );
    (work, namespace, close_request, close_policy, closed)
}

async fn reject_collection_completion_at_commit(pool: &sqlx::PgPool, intent: Uuid) -> String {
    // Audited DDL: UUID-only identifier and typed intent; the target table is literal.
    let name = format!("fixture_failure_{}", Uuid::new_v4().simple());
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE FUNCTION {name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected disposable collection commit failure'; END $$")))
        .execute(pool).await.unwrap();
    sqlx::query(sqlx::AssertSqlSafe(format!("CREATE CONSTRAINT TRIGGER {name} AFTER UPDATE ON catalog_collections DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.intent_id='{intent}'::uuid AND NEW.state='deleted') EXECUTE FUNCTION {name}()")))
        .execute(pool).await.unwrap();
    name
}

async fn collection_binding(catalog: &sqlx::PgPool, firm: Uuid, upload: Uuid) -> CollectionBinding {
    use sqlx::Row;
    let row = sqlx::query("SELECT object_id,store_id,storage_generation,digest,size FROM blob_objects WHERE firm_id=$1 AND upload_intent_id=$2")
        .bind(firm).bind(upload).fetch_one(catalog).await.unwrap();
    CollectionBinding {
        upload_id: upload,
        object_id: row.get("object_id"),
        store_id: row.get("store_id"),
        generation: row.get("storage_generation"),
        sha256: row.get("digest"),
        size: row.get::<i64, _>("size") as u64,
    }
}

async fn reference_collection(
    file: &CatalogWorker,
    catalog: &sqlx::PgPool,
    firm: Uuid,
    root: &Path,
) -> (
    Uuid,
    Uuid,
    CollectionRequest,
    CollectionBinding,
    RetirementPolicy,
    CollectionRecord,
) {
    let work = Uuid::new_v4();
    let namespace = Uuid::new_v4();
    let workspace = Uuid::new_v4();
    file.create_workspace(
        firm,
        Uuid::new_v4(),
        work,
        namespace,
        workspace,
        "collection fixture",
    )
    .await
    .unwrap();
    let policy = RetirementPolicy {
        id: Uuid::new_v4(),
        revision: 1,
        min_retention_seconds: 0,
        allowed: vec![
            "upload".into(),
            "revision".into(),
            "workspace_close".into(),
            "collect".into(),
        ],
    };
    let retirement = |target| RetirementRequest {
        target,
        reason: "fixture retention satisfied".into(),
        policy_id: policy.id,
        policy_revision: policy.revision,
    };
    let request_for = |upload_id| CollectionRequest {
        upload_id,
        reason: "fixture physical collection".into(),
        policy_id: policy.id,
        policy_revision: policy.revision,
    };
    let bytes = b"the same digest does not identify a physical lifetime";
    let digest = format!("{:x}", Sha256::digest(bytes));
    let upload_a = Uuid::new_v4();
    let upload_b = Uuid::new_v4();
    file.upload(firm, upload_a, &digest, bytes, 1024)
        .await
        .unwrap();
    file.upload(firm, upload_b, &digest, bytes, 1024)
        .await
        .unwrap();
    let binding = collection_binding(catalog, firm, upload_a).await;
    let binding_b = collection_binding(catalog, firm, upload_b).await;
    assert_ne!(binding.object_id, binding_b.object_id);
    let files_a = BTreeMap::from([("retained.txt".into(), upload_a)]);
    let publication_a = Uuid::new_v4();
    file.publish(firm, publication_a, workspace, 0, files_a.clone())
        .await
        .unwrap();
    file.publish(
        firm,
        Uuid::new_v4(),
        workspace,
        1,
        BTreeMap::from([("retained.txt".into(), upload_b)]),
    )
    .await
    .unwrap();
    let reader = file
        .open_file(firm, workspace, 1, "retained.txt", 1024)
        .await
        .unwrap();
    let revision_release = Uuid::new_v4();
    file.retire_reference(
        firm,
        revision_release,
        work,
        namespace,
        &retirement(RetirementTarget::Revision {
            workspace_id: workspace,
            revision: 1,
        }),
        &policy,
    )
    .await
    .unwrap();
    file.retire_reference(
        firm,
        Uuid::new_v4(),
        work,
        namespace,
        &retirement(RetirementTarget::Upload {
            upload_id: upload_a,
        }),
        &policy,
    )
    .await
    .unwrap();
    let request = request_for(upload_a);
    let intent = Uuid::new_v4();
    assert!(matches!(
        file.prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .unwrap(),
        CollectionPreparation::Busy
    ));
    let markers: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM catalog_collections WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(firm)
    .bind(intent)
    .fetch_one(catalog)
    .await
    .unwrap();
    assert_eq!(
        markers, 0,
        "a reader conflict must not mark an object deleting"
    );
    drop(reader);

    // Reverse manifest validation detects a missing hold; absence of a row is not release.
    sqlx::query("DELETE FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=1 AND object_id=$3")
        .bind(firm).bind(workspace).bind(binding.object_id).execute(catalog).await.unwrap();
    assert!(
        file.prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .is_err()
    );
    sqlx::query("INSERT INTO revision_object_holds(firm_id,workspace_id,revision,object_id,released_by) VALUES($1,$2,1,$3,$4)")
        .bind(firm).bind(workspace).bind(binding.object_id).bind(revision_release).execute(catalog).await.unwrap();
    let path = root.join(format!("blob-{}", binding.object_id));
    let displaced = root.join(format!("fixture-unmarked-{}", binding.object_id));
    std::fs::rename(&path, &displaced).unwrap();
    assert!(
        file.prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .is_err()
    );
    assert!(
        file.collection_receipt(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .unwrap()
            .is_none()
    );
    std::fs::rename(displaced, &path).unwrap();

    // A failed deleting-marker COMMIT leaves the original object and no collection authority.
    let trigger = reject_insert_at_commit(catalog, "catalog_collections", intent).await;
    assert!(
        file.prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .is_err()
    );
    let state: String =
        sqlx::query_scalar("SELECT state FROM blob_objects WHERE firm_id=$1 AND object_id=$2")
            .bind(firm)
            .bind(binding.object_id)
            .fetch_one(catalog)
            .await
            .unwrap();
    assert_eq!(state, "verified");
    assert!(path.exists());
    remove_commit_failure(catalog, "catalog_collections", &trigger).await;
    let prepared = match file
        .prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
        .await
        .unwrap()
    {
        CollectionPreparation::Ready(prepared) => prepared,
        _ => panic!("expected a ready collection"),
    };
    assert!(
        file.advance_collection(*prepared, || async {
            anyhow::bail!("fixture current authority revoked")
        })
        .await
        .is_err()
    );
    assert!(
        path.exists(),
        "a committed marker does not waive fresh deletion authorization"
    );
    assert!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        file.publication_receipt(firm, publication_a, workspace, 0, files_a.clone())
            .await
            .unwrap(),
        Some(1)
    );
    assert!(
        file.collection_receipt(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .unwrap()
            .is_none()
    );

    // Physical removal can precede a failed receipt commit. Recovery confirms only marked absence.
    let prepared = match file
        .prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
        .await
        .unwrap()
    {
        CollectionPreparation::Ready(prepared) => prepared,
        _ => panic!("expected the same ready collection"),
    };
    let trigger = reject_collection_completion_at_commit(catalog, intent).await;
    let authorized = std::sync::atomic::AtomicBool::new(false);
    assert!(
        file.advance_collection(*prepared, || async {
            authorized.store(true, std::sync::atomic::Ordering::SeqCst);
            Ok(())
        })
        .await
        .is_err()
    );
    assert!(authorized.load(std::sync::atomic::Ordering::SeqCst));
    assert!(!path.exists());
    let pending: (String, Option<serde_json::Value>) = sqlx::query_as(
        "SELECT state,record FROM catalog_collections WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(firm)
    .bind(intent)
    .fetch_one(catalog)
    .await
    .unwrap();
    assert_eq!(pending, ("deleting".into(), None));
    remove_commit_failure(catalog, "catalog_collections", &trigger).await;
    let record = match file
        .prepare_collection(firm, intent, work, namespace, &request, &binding, &policy)
        .await
        .unwrap()
    {
        CollectionPreparation::Completed(record) => record,
        _ => panic!("marked absence must reconcile without another deletion handle"),
    };
    assert_eq!(record.confirmation, "observed_absence");
    assert_eq!(
        file.collection_receipt(firm, intent, work, namespace, &request, &binding, &policy)
            .await
            .unwrap(),
        Some(record.clone())
    );
    assert!(
        matches!(file.prepare_collection(firm,intent,work,namespace,&request,&binding,&policy).await.unwrap(),CollectionPreparation::Completed(existing) if existing==record)
    );
    assert!(
        file.upload_reference(firm, upload_a, &digest, bytes.len() as u64)
            .await
            .unwrap()
            .is_some()
    );
    assert_eq!(
        file.publication_receipt(firm, publication_a, workspace, 0, files_a)
            .await
            .unwrap(),
        Some(1)
    );
    assert_eq!(
        file.read_file(firm, workspace, 2, "retained.txt")
            .await
            .unwrap()
            .as_bytes(),
        bytes
    );
    assert!(
        root.join(format!("blob-{}", binding_b.object_id)).exists(),
        "the old collection cannot remove equal replacement content"
    );
    assert!(
        file.prepare_collection(
            firm,
            Uuid::new_v4(),
            work,
            namespace,
            &request,
            &binding,
            &policy
        )
        .await
        .is_err()
    );
    let mut changed_binding = binding.clone();
    changed_binding.object_id = binding_b.object_id;
    assert!(
        file.collection_receipt(
            firm,
            intent,
            work,
            namespace,
            &request,
            &changed_binding,
            &policy
        )
        .await
        .is_err()
    );

    // An unused independently retired upload exercises successful removal and stale-handle safety.
    let upload_c = Uuid::new_v4();
    file.upload(firm, upload_c, &digest, bytes, 1024)
        .await
        .unwrap();
    let binding_c = collection_binding(catalog, firm, upload_c).await;
    let stale = file
        .prepare_upload(firm, upload_c, &digest, bytes.len() as u64, 1024)
        .await
        .unwrap();
    file.retire_reference(
        firm,
        Uuid::new_v4(),
        work,
        namespace,
        &retirement(RetirementTarget::Upload {
            upload_id: upload_c,
        }),
        &policy,
    )
    .await
    .unwrap();
    let request_c = request_for(upload_c);
    let intent_c = Uuid::new_v4();
    let path_c = root.join(format!("blob-{}", binding_c.object_id));
    std::fs::write(&path_c, vec![b'x'; bytes.len()]).unwrap();
    assert!(
        file.prepare_collection(
            firm, intent_c, work, namespace, &request_c, &binding_c, &policy
        )
        .await
        .is_err()
    );
    assert!(
        file.collection_receipt(
            firm, intent_c, work, namespace, &request_c, &binding_c, &policy
        )
        .await
        .unwrap()
        .is_none()
    );
    std::fs::write(&path_c, bytes).unwrap();
    let prepared = match file
        .prepare_collection(
            firm, intent_c, work, namespace, &request_c, &binding_c, &policy,
        )
        .await
        .unwrap()
    {
        CollectionPreparation::Ready(prepared) => prepared,
        _ => panic!("expected valid fresh object collection"),
    };
    let removed = file
        .advance_collection(*prepared, || async { Ok(()) })
        .await
        .unwrap();
    assert_eq!(removed.confirmation, "removed");
    assert!(!path_c.exists());
    assert!(file.begin_upload(&stale).await.is_err());
    file.upload(firm, upload_c, &digest, bytes, 1024)
        .await
        .unwrap();
    assert!(
        !path_c.exists(),
        "historical upload replay must not resurrect deleted bytes"
    );
    assert_eq!(
        file.collection_receipt(
            firm, intent_c, work, namespace, &request_c, &binding_c, &policy
        )
        .await
        .unwrap(),
        Some(removed.clone())
    );
    let mut corrupt = json!(removed);
    corrupt["confirmation"] = json!("unproven");
    sqlx::query("UPDATE catalog_collections SET record=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(firm)
        .bind(intent_c)
        .bind(corrupt)
        .execute(catalog)
        .await
        .unwrap();
    assert!(
        file.upload_reference(firm, upload_c, &digest, bytes.len() as u64)
            .await
            .is_err()
    );
    sqlx::query("UPDATE catalog_collections SET record=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(firm)
        .bind(intent_c)
        .bind(json!(removed))
        .execute(catalog)
        .await
        .unwrap();
    (work, namespace, request, binding, policy, record)
}

#[tokio::test]
async fn company_effect_and_receipt_commit_once_across_replay() {
    let fixture = support::company_fixture().await;
    let company = fixture.owner.clone();
    let firm = fixture.firm;
    fixture
        .check(async move {
            let id = Uuid::new_v4();
            let worker = CompanyWorker::new(company.clone());
            sqlx::query("INSERT INTO inputs VALUES($1,$2,$3)")
                .bind(firm)
                .bind(id)
                .bind(json!({"input":42}))
                .execute(&company)
                .await
                .unwrap();
            assert_eq!(
                worker.read_input(firm, id).await.unwrap(),
                json!({"input":42})
            );
            assert!(worker.read_input(Uuid::new_v4(), id).await.is_err());
            let intent = Uuid::new_v4();
            let observation = ouroboros_contracts::CompanyRecoveryTicket {
                firm_id: firm,
                intent_id: intent,
                original_attempt_id: Uuid::new_v4(),
                parameters: json!({"answer":42}),
            };
            assert!(worker.observe_result(&observation).await.unwrap().is_none());
            let (a, b) = tokio::join!(
                worker.record_result(firm, intent, json!({"answer":42})),
                worker.record_result(firm, intent, json!({"answer":42}))
            );
            let result_id = a.unwrap();
            assert_eq!(result_id, b.unwrap());
            assert_eq!(
                worker.observe_result(&observation).await.unwrap(),
                Some(result_id)
            );
            let mut wrong = observation.clone();
            wrong.parameters = json!({"answer":43});
            assert!(worker.observe_result(&wrong).await.is_err());
            wrong.firm_id = Uuid::new_v4();
            assert!(worker.observe_result(&wrong).await.unwrap().is_none());
            assert!(
                worker
                    .record_result(firm, intent, json!({"answer":43}))
                    .await
                    .is_err()
            );
            let n: i64 = sqlx::query_scalar("SELECT count(*) FROM results WHERE firm_id=$1")
                .bind(firm)
                .fetch_one(&company)
                .await
                .unwrap();
            assert_eq!(n, 1);
        })
        .await;
}

#[tokio::test]
async fn upload_and_publication_recover_only_committed_receipts() {
    let fixture = support::Fixture::new(true).await;
    let catalog = fixture.owner.clone();
    let catalog_worker_pool = fixture.worker.clone();
    let firm = fixture.firm;
    let root = fixture.content.clone();
    let binding_file = fixture.binding_file.clone();
    fixture.check(async move {
    let file = CatalogWorker::new(
        catalog_worker_pool.clone(),
        BoundStore::open(&binding_file).unwrap(),
    )
    .await
    .unwrap();
    let failed_preparation = Uuid::new_v4();
    let preparation_bytes = b"must not write before staging commit";
    let preparation_digest = format!("{:x}", Sha256::digest(preparation_bytes));
    let trigger = reject_insert_at_commit(&catalog, "upload_staging", failed_preparation).await;
    assert!(
        file.upload(
            firm,
            failed_preparation,
            &preparation_digest,
            preparation_bytes,
            1024
        )
        .await
        .is_err()
    );
    assert!(!root.join(&preparation_digest).exists());
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 1); // Binding marker only.
    assert!(
        file.upload_receipt(
            firm,
            failed_preparation,
            &preparation_digest,
            preparation_bytes.len() as u64
        )
        .await
        .unwrap()
        .is_none()
    );
    let rows: i64 =
        sqlx::query_scalar("SELECT count(*) FROM upload_staging WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm)
            .bind(failed_preparation)
            .fetch_one(&catalog)
            .await
            .unwrap();
    assert_eq!(rows, 0);
    let objects: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM blob_objects WHERE firm_id=$1 AND upload_intent_id=$2",
    )
    .bind(firm)
    .bind(failed_preparation)
    .fetch_one(&catalog)
    .await
    .unwrap();
    assert_eq!(
        objects, 0,
        "staging preparation and object inventory roll back together"
    );
    remove_commit_failure(&catalog, "upload_staging", &trigger).await;

    let failed_receipt = Uuid::new_v4();
    let retained_bytes = b"installed content with failed catalog commit";
    let retained_digest = format!("{:x}", Sha256::digest(retained_bytes));
    let trigger = reject_insert_at_commit(&catalog, "uploads", failed_receipt).await;
    assert!(
        file.upload(firm, failed_receipt, &retained_digest, retained_bytes, 1024)
            .await
            .is_err()
    );
    let staging_before: (Uuid, String) = sqlx::query_as(
        "SELECT staging_id,state FROM upload_staging WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(firm)
    .bind(failed_receipt)
    .fetch_one(&catalog)
    .await
    .unwrap();
    assert_eq!(staging_before.1, "prepared");
    assert_eq!(
        std::fs::read(root.join(format!("blob-{}", staging_before.0))).unwrap(),
        retained_bytes
    );
    assert!(
        !root.join(&retained_digest).exists(),
        "new uploads never use a digest-only physical address"
    );
    let unfinished: (String, i64) = sqlx::query_as("SELECT state,(SELECT count(*) FROM upload_object_holds WHERE firm_id=$1 AND intent_id=$2) FROM blob_objects WHERE firm_id=$1 AND upload_intent_id=$2")
        .bind(firm).bind(failed_receipt).fetch_one(&catalog).await.unwrap();
    assert_eq!(
        unfinished,
        ("prepared".into(), 0),
        "failed COMMIT cannot verify an object or establish its hold"
    );
    assert!(
        file.upload_receipt(
            firm,
            failed_receipt,
            &retained_digest,
            retained_bytes.len() as u64
        )
        .await
        .unwrap()
        .is_none()
    );
    // Receipt lookup must not manufacture a receipt for the installed but uncommitted blob.
    let uploads: i64 =
        sqlx::query_scalar("SELECT count(*) FROM uploads WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm)
            .bind(failed_receipt)
            .fetch_one(&catalog)
            .await
            .unwrap();
    assert_eq!(uploads, 0);
    remove_commit_failure(&catalog, "uploads", &trigger).await;
    drop(file);
    let file = CatalogWorker::new(
        catalog_worker_pool.clone(),
        BoundStore::open(&binding_file).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(
        file.upload(firm, failed_receipt, &retained_digest, retained_bytes, 1024)
            .await
            .unwrap(),
        retained_digest
    );
    let staging_after: (Uuid, String) = sqlx::query_as(
        "SELECT staging_id,state FROM upload_staging WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(firm)
    .bind(failed_receipt)
    .fetch_one(&catalog)
    .await
    .unwrap();
    assert_eq!(staging_after, (staging_before.0, "committed".into()));
    let recovered = file
        .upload_reference(
            firm,
            failed_receipt,
            &retained_digest,
            retained_bytes.len() as u64,
        )
        .await
        .unwrap()
        .unwrap();
    assert_eq!(recovered.object_id, Some(staging_before.0));
    assert_eq!(
        file.upload_receipt(
            firm,
            failed_receipt,
            &retained_digest,
            retained_bytes.len() as u64
        )
        .await
        .unwrap(),
        Some(retained_digest.clone())
    );
    assert!(
        file.upload_receipt(
            firm,
            failed_receipt,
            &retained_digest,
            retained_bytes.len() as u64 + 1
        )
        .await
        .is_err()
    );
    let bytes = b"verified fixture result";
    let digest = format!("{:x}", Sha256::digest(bytes));
    let upload = Uuid::new_v4();
    file.upload(firm, upload, &digest, bytes, 1024)
        .await
        .unwrap();
    file.upload(firm, upload, &digest, bytes, 1024)
        .await
        .unwrap();
    assert!(
        file.upload(firm, upload, &digest, b"wrong bytes", 1024)
            .await
            .is_err()
    );
    let workspace = Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces(firm_id,id,revision,manifest) VALUES($1,$2,0,'{}'::jsonb)")
        .bind(firm)
        .bind(workspace)
        .execute(&catalog)
        .await
        .unwrap();
    let files = BTreeMap::from([("results/report.txt".into(), upload)]);
    let publication = Uuid::new_v4();
    let trigger = reject_insert_at_commit(&catalog, "publication_receipts", publication).await;
    assert!(
        file.publish(firm, publication, workspace, 0, files.clone())
            .await
            .is_err()
    );
    let rolled_back_revision: i64 =
        sqlx::query_scalar("SELECT revision FROM workspaces WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(workspace)
            .fetch_one(&catalog)
            .await
            .unwrap();
    assert_eq!(rolled_back_revision, 0);
    let rolled_back_holds: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2",
    )
    .bind(firm)
    .bind(workspace)
    .fetch_one(&catalog)
    .await
    .unwrap();
    assert_eq!(
        rolled_back_holds, 0,
        "failed publication COMMIT cannot leave retained revision holds"
    );
    assert!(
        file.publication_receipt(firm, publication, workspace, 0, files.clone())
            .await
            .unwrap()
            .is_none()
    );
    remove_commit_failure(&catalog, "publication_receipts", &trigger).await;
    assert_eq!(
        file.publish(firm, publication, workspace, 0, files.clone())
            .await
            .unwrap(),
        1
    );
    // Treat the previous acknowledgement as lost and instantiate a fresh resource worker.
    drop(file); // Single-writer custody must end before its successor opens the same binding.
    let fresh = CatalogWorker::new(
        catalog_worker_pool.clone(),
        BoundStore::open(&binding_file).unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(
        fresh
            .upload_receipt(firm, upload, &digest, bytes.len() as u64)
            .await
            .unwrap(),
        Some(digest.clone())
    );
    assert_eq!(
        fresh
            .publication_receipt(firm, publication, workspace, 0, files.clone())
            .await
            .unwrap(),
        Some(1)
    );
    assert!(
        fresh
            .publication_receipt(firm, publication, workspace, 1, files.clone())
            .await
            .is_err()
    );
    let receipt_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM publication_receipts WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(firm)
    .bind(publication)
    .fetch_one(&catalog)
    .await
    .unwrap();
    assert_eq!(receipt_count, 1);
    assert_eq!(
        fresh
            .publish(firm, publication, workspace, 0, files.clone())
            .await
            .unwrap(),
        1
    );
    assert!(
        fresh
            .publish(firm, Uuid::new_v4(), workspace, 0, files.clone())
            .await
            .is_err()
    );
    assert!(
        fresh
            .publish(
                firm,
                Uuid::new_v4(),
                workspace,
                1,
                BTreeMap::from([("../outside".into(), upload)])
            )
            .await
            .is_err()
    );
    let stored = fresh
        .upload_reference(firm, upload, &digest, bytes.len() as u64)
        .await
        .unwrap()
        .unwrap();
    std::fs::write(
        root.join(format!("blob-{}", stored.object_id.unwrap())),
        b"corrupt",
    )
    .unwrap();
    assert!(
        fresh
            .publish(firm, Uuid::new_v4(), workspace, 1, files)
            .await
            .is_err()
    );
    let revision: i64 =
        sqlx::query_scalar("SELECT revision FROM workspaces WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(workspace)
            .fetch_one(&catalog)
            .await
            .unwrap();
    assert_eq!(revision, 1);
    }).await;
}

#[tokio::test]
async fn retained_workspace_identity_survives_worker_replacement() {
    let fixture = support::Fixture::new(true).await;
    let catalog = fixture.owner.clone();
    let pool = fixture.worker.clone();
    let firm = fixture.firm;
    let root = fixture.content.clone();
    let binding = fixture.binding_file.clone();
    fixture
        .check(async move {
            let file = CatalogWorker::new(pool.clone(), BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            let created = retained_objects_and_workspaces(&file, &catalog, firm, &root).await;
            drop(file);
            let fresh = CatalogWorker::new(pool, BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            assert_eq!(
                fresh
                    .workspace_creation_receipt(
                        firm,
                        created.0,
                        created.1.work_id,
                        created.1.namespace_id,
                        created.1.workspace_id,
                        &created.1.label
                    )
                    .await
                    .unwrap(),
                Some(created.1)
            );
        })
        .await;
}

#[tokio::test]
async fn retirement_preserves_references_and_original_receipt() {
    let fixture = support::Fixture::new(true).await;
    let catalog = fixture.owner.clone();
    let pool = fixture.worker.clone();
    let firm = fixture.firm;
    let root = fixture.content.clone();
    let binding = fixture.binding_file.clone();
    fixture
        .check(async move {
            let file = CatalogWorker::new(pool.clone(), BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            let retirement = reference_retirement(&file, &catalog, firm, &root).await;
            drop(file);
            let fresh = CatalogWorker::new(pool, BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            assert_eq!(
                fresh
                    .retirement_receipt(
                        firm,
                        retirement.4.intent_id,
                        retirement.0,
                        retirement.1,
                        &retirement.2,
                        &retirement.3
                    )
                    .await
                    .unwrap(),
                Some(retirement.4)
            );
        })
        .await;
}

#[tokio::test]
async fn collection_recovers_original_effect_without_repeating_deletion() {
    let fixture = support::Fixture::new(true).await;
    let catalog = fixture.owner.clone();
    let pool = fixture.worker.clone();
    let firm = fixture.firm;
    let root = fixture.content.clone();
    let binding = fixture.binding_file.clone();
    fixture
        .check(async move {
            let file = CatalogWorker::new(pool.clone(), BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            let collection = reference_collection(&file, &catalog, firm, &root).await;
            drop(file);
            let fresh = CatalogWorker::new(pool, BoundStore::open(&binding).unwrap())
                .await
                .unwrap();
            assert_eq!(
                fresh
                    .collection_receipt(
                        firm,
                        collection.5.intent_id,
                        collection.0,
                        collection.1,
                        &collection.2,
                        &collection.3,
                        &collection.4
                    )
                    .await
                    .unwrap(),
                Some(collection.5)
            );
        })
        .await;
}

#[tokio::test]
async fn credential_use_preserves_custody_revocation_and_provider_receipts() {
    let fixture = support::Fixture::new(false).await;
    let owner = fixture.owner.clone();
    let role = fixture.worker_role().to_owned();
    let password = fixture.password.clone();
    let worker_url = fixture.worker_url.clone();
    let owner_url_file = fixture.owner_url_file.clone();
    fixture
        .check(async move {
            credential_custody(&owner, &role, &password, &worker_url, &owner_url_file).await;
        })
        .await;
}

async fn credential_custody(
    pool: &sqlx::PgPool,
    role: &str,
    password: &str,
    worker_url: &str,
    owner_url_file: &Path,
) {
    use ouroboros_resources::{
        credential_envelope::{Binding, EnvelopeKey},
        credential_store::CredentialStore,
    };
    use zeroize::Zeroizing;
    // Audited role DDL: the fixture's generated identifier is the only interpolation.
    let suffix = role
        .strip_prefix("ouro_worker_")
        .expect("fixture role prefix");
    assert!(suffix.len() == 32 && suffix.bytes().all(|b| b.is_ascii_hexdigit()));
    // Disposable owner-only fixture: custody tables are isolated from company tables in product.
    sqlx::raw_sql(include_str!("../migrations/custody/0001_custody.sql"))
        .execute(pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/custody/0002_immutable_versions.sql"
    ))
    .execute(pool)
    .await
    .unwrap();
    sqlx::raw_sql(include_str!("../migrations/custody/0003_use_claims.sql"))
        .execute(pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/custody/0004_provider_receipts.sql"
    ))
    .execute(pool)
    .await
    .unwrap();
    sqlx::raw_sql(include_str!("../migrations/custody/0005_consumer_lock.sql"))
        .execute(pool)
        .await
        .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/custody/0006_enrollment_receipts.sql"
    ))
    .execute(pool)
    .await
    .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/custody/0007_enrollment_attempt.sql"
    ))
    .execute(pool)
    .await
    .unwrap();
    sqlx::raw_sql(include_str!(
        "../migrations/custody/0008_disable_receipts.sql"
    ))
    .execute(pool)
    .await
    .unwrap();
    sqlx::raw_sql(sqlx::AssertSqlSafe(format!("GRANT USAGE ON SCHEMA public TO {role}; GRANT SELECT,INSERT ON credential_enrollments,credential_disables TO {role}; GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {role}; GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts TO {role}; GRANT INSERT(owner_id,attempt_id,ticket_sha256,reply) ON provider_receipts TO {role}; GRANT INSERT(owner_id,attempt_id,credential_id,version) ON credential_use_claims TO {role}; GRANT INSERT(owner_id,credential_id,version,envelope), UPDATE(disabled,disabled_at) ON credential_versions TO {role};")))
        .execute(pool).await.unwrap();
    let worker = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect_with(
            pool.connect_options()
                .as_ref()
                .clone()
                .username(role)
                .password(password),
        )
        .await
        .unwrap();
    assert!(
        CredentialStore::new(
            pool.clone(),
            EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap()
        )
        .await
        .is_err()
    );
    let binding = Binding {
        owner: Uuid::new_v4(),
        credential: Uuid::new_v4(),
        version: 1,
    };
    let store = CredentialStore::new(
        worker.clone(),
        EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    store
        .insert(binding, Zeroizing::new(b"synthetic-store-secret".to_vec()))
        .await
        .unwrap();
    assert!(
        store
            .insert(binding, Zeroizing::new(b"replacement".to_vec()))
            .await
            .is_err()
    );
    let enrolled = Binding {
        credential: Uuid::new_v4(),
        ..binding
    };
    let enrollment = Uuid::new_v4();
    let receipt = store
        .enroll(
            enrolled,
            enrollment,
            Zeroizing::new(b"synthetic-enrollment".to_vec()),
        )
        .await
        .unwrap();
    assert_eq!(
        store.enrollment(enrolled.owner, enrollment).await.unwrap(),
        Some(receipt.clone())
    );
    assert!(
        store
            .enrollment(Uuid::new_v4(), enrollment)
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .enroll(enrolled, enrollment, Zeroizing::new(b"changed".to_vec()))
            .await
            .is_err()
    );
    // A receipt collision must roll back the preceding version insert too.
    let conflicting = Binding {
        credential: Uuid::new_v4(),
        ..binding
    };
    assert!(
        store
            .enroll(
                conflicting,
                enrollment,
                Zeroizing::new(b"uncommitted".to_vec())
            )
            .await
            .is_err()
    );
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM credential_versions WHERE credential_id=$1)",
    )
    .bind(conflicting.credential)
    .fetch_one(pool)
    .await
    .unwrap();
    assert!(!exists);
    store.disable(enrolled).await.unwrap();
    assert!(
        store
            .enrollment(enrolled.owner, enrollment)
            .await
            .unwrap()
            .unwrap()
            .disabled
    );
    let serialized = serde_json::to_string(&receipt).unwrap();
    assert!(!serialized.contains("synthetic-enrollment"));
    assert!(!serialized.contains("envelope"));
    for query in [
        "DELETE FROM credential_enrollments",
        "UPDATE credential_enrollments SET version=2",
        "TRUNCATE credential_enrollments",
    ] {
        assert!(sqlx::query(query).execute(&worker).await.is_err());
    }
    let disabled_binding = Binding {
        credential: Uuid::new_v4(),
        ..binding
    };
    store
        .insert(
            disabled_binding,
            Zeroizing::new(b"synthetic-disable-bound".to_vec()),
        )
        .await
        .unwrap();
    let disable_ticket = ouroboros_contracts::CredentialDisableTicket {
        firm_id: binding.owner,
        intent_id: Uuid::new_v4(),
        original_attempt_id: Uuid::new_v4(),
        credential_id: disabled_binding.credential,
        version: 1,
    };
    let mut held = pool.begin().await.unwrap();
    let _: Option<Vec<u8>> = sqlx::query_scalar("SELECT public.lock_credential_version($1,$2,$3)")
        .bind(binding.owner)
        .bind(disabled_binding.credential)
        .bind(1_i64)
        .fetch_one(&mut *held)
        .await
        .unwrap();
    {
        let pending_disable = store.disable_admitted(&disable_ticket);
        tokio::pin!(pending_disable);
        tokio::select! {
            result=&mut pending_disable=>panic!("disable completed while existing use held its lock: {}",result.is_ok()),
            _=tokio::time::sleep(std::time::Duration::from_millis(100))=>{},
        }
        assert!(!store.disable_observed(&disable_ticket).await.unwrap());
        held.rollback().await.unwrap();
        pending_disable.await.unwrap();
    }
    assert!(store.disable_observed(&disable_ticket).await.unwrap());
    let mut wrong_attempt = disable_ticket.clone();
    wrong_attempt.original_attempt_id = Uuid::new_v4();
    assert!(!store.disable_observed(&wrong_attempt).await.unwrap());
    assert!(store.consume(disabled_binding, |_| Ok(())).await.is_err());
    // A colliding receipt cannot leave another credential disabled by a rolled-back update.
    let mut collision = disable_ticket.clone();
    collision.credential_id = binding.credential;
    assert!(store.disable_admitted(&collision).await.is_err());
    assert!(store.consume(binding, |_| Ok(())).await.is_ok());
    for query in [
        "UPDATE credential_disables SET version=2",
        "DELETE FROM credential_disables",
        "TRUNCATE credential_disables",
    ] {
        assert!(sqlx::query(query).execute(&worker).await.is_err());
    }
    // The actual sender's role cannot enroll/disable, even through direct SQL.
    assert!(
        CredentialStore::open_consumer(
            worker.clone(),
            EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap()
        )
        .await
        .is_err()
    );
    // The validated parent role plus a fixed suffix and a typed UUID password are SQL-safe.
    let consumer_role = format!("{role}_consumer");
    let consumer_password = Uuid::new_v4().to_string();
    sqlx::raw_sql(sqlx::AssertSqlSafe(format!("CREATE ROLE {consumer_role} LOGIN PASSWORD '{consumer_password}'; GRANT USAGE ON SCHEMA public TO {consumer_role}; GRANT SELECT ON credential_versions,credential_use_claims,provider_receipts TO {consumer_role}; GRANT INSERT(owner_id,attempt_id,credential_id,version) ON credential_use_claims TO {consumer_role}; GRANT INSERT(owner_id,attempt_id,ticket_sha256,reply) ON provider_receipts TO {consumer_role};"))).execute(pool).await.unwrap();
    let consumer_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect_with(
            pool.connect_options()
                .as_ref()
                .clone()
                .username(&consumer_role)
                .password(&consumer_password),
        )
        .await
        .unwrap();
    assert!(
        CredentialStore::open_consumer(
            consumer_pool.clone(),
            EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap()
        )
        .await
        .is_err()
    );
    sqlx::query(sqlx::AssertSqlSafe(format!("GRANT EXECUTE ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) TO {consumer_role}"))).execute(pool).await.unwrap();
    let consumer = CredentialStore::open_consumer(
        consumer_pool.clone(),
        EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    consumer
        .consume(binding, |value| {
            assert_eq!(value, b"synthetic-store-secret");
            Ok(())
        })
        .await
        .unwrap();
    assert!(
        consumer
            .insert(
                Binding {
                    version: 99,
                    ..binding
                },
                Zeroizing::new(b"unapproved".to_vec())
            )
            .await
            .is_err()
    );
    assert!(consumer.disable(binding).await.is_err());
    for statement in [
        "UPDATE credential_versions SET disabled=true,disabled_at=clock_timestamp()",
        "INSERT INTO credential_versions SELECT * FROM credential_versions",
        "DELETE FROM credential_versions",
        "CREATE TABLE public.unapproved(id int)",
    ] {
        assert!(
            sqlx::query(statement)
                .execute(&consumer_pool)
                .await
                .is_err()
        );
    }
    drop(consumer);
    consumer_pool.close().await;
    drop(store);
    let store = CredentialStore::new(
        worker.clone(),
        EnvelopeKey::new(Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    store
        .consume(binding, |value| {
            assert_eq!(value, b"synthetic-store-secret");
            Ok(())
        })
        .await
        .unwrap();
    let persisted: Vec<u8> =
        sqlx::query_scalar("SELECT envelope FROM credential_versions WHERE owner_id=$1 AND credential_id=$2 AND version=$3")
            .bind(binding.owner).bind(binding.credential).bind(binding.version as i64)
            .fetch_one(pool)
            .await
            .unwrap();
    assert!(
        !persisted
            .windows(b"synthetic-store-secret".len())
            .any(|v| v == b"synthetic-store-secret")
    );
    store.disable(binding).await.unwrap();
    store.disable(binding).await.unwrap();
    assert!(
        store
            .consume(binding, |_| -> Result<(), _> {
                panic!("disabled consumer")
            })
            .await
            .is_err()
    );
    assert!(
        store
            .insert(binding, Zeroizing::new(b"replacement".to_vec()))
            .await
            .is_err()
    );
    for statement in [
        "UPDATE credential_versions SET disabled=false,disabled_at=NULL",
        "UPDATE credential_versions SET envelope=decode('00','hex')",
        "DELETE FROM credential_versions",
        "TRUNCATE credential_versions",
        "ALTER TABLE credential_versions DISABLE TRIGGER credential_version_guard",
        "DROP TABLE credential_versions",
    ] {
        assert!(
            sqlx::query(statement).execute(&worker).await.is_err(),
            "forbidden operation succeeded"
        );
    }
    let next = Binding {
        version: 2,
        ..binding
    };
    store
        .insert(next, Zeroizing::new(b"new-version".to_vec()))
        .await
        .unwrap();
    store
        .consume(next, |v| {
            assert_eq!(v, b"new-version");
            Ok(())
        })
        .await
        .unwrap();
    custody_async_checks(&store, next, &worker).await;
    provider_denial_checks(&worker, binding).await;
    provider_https_checks(&worker, binding, worker_url, owner_url_file).await;
}

async fn custody_async_checks(
    store: &ouroboros_resources::credential_store::CredentialStore,
    binding: ouroboros_resources::credential_envelope::Binding,
    worker: &sqlx::PgPool,
) {
    use ouroboros_resources::credential_store::UseError;
    use std::time::Duration;
    let (entered, ready) = tokio::sync::oneshot::channel();
    let (release, wait) = tokio::sync::oneshot::channel();
    let attempt = Uuid::new_v4();
    let use_future = store.consume_async(
        binding,
        attempt,
        Duration::from_secs(5),
        |secret| async move {
            assert_eq!(&*secret, b"new-version");
            entered.send(()).unwrap();
            wait.await.unwrap();
            Ok(())
        },
    );
    let disable_future = async {
        ready.await.unwrap();
        let disable = store.disable(binding);
        tokio::pin!(disable);
        assert!(
            tokio::time::timeout(Duration::from_millis(50), &mut disable)
                .await
                .is_err()
        );
        release.send(()).unwrap();
        disable.await.unwrap();
    };
    let (used, ()) = tokio::join!(use_future, disable_future);
    used.unwrap();
    let reconnected = ouroboros_resources::credential_store::CredentialStore::new(
        worker.clone(),
        ouroboros_resources::credential_envelope::EnvelopeKey::new(zeroize::Zeroizing::new(
            [9; 32],
        ))
        .unwrap(),
    )
    .await
    .unwrap();
    assert!(
        reconnected
            .has_use_claim(binding.owner, attempt)
            .await
            .unwrap()
    );
    for statement in [
        "DELETE FROM credential_use_claims",
        "TRUNCATE credential_use_claims",
        "UPDATE credential_use_claims SET attempt_id=gen_random_uuid()",
    ] {
        assert!(sqlx::query(statement).execute(worker).await.is_err());
    }
    assert!(store.has_use_claim(binding.owner, attempt).await.unwrap());
    assert_eq!(
        store
            .consume_async(binding, attempt, Duration::from_secs(1), |_| async {
                panic!("replayed use");
                #[allow(unreachable_code)]
                Ok(())
            })
            .await,
        Err(UseError::AlreadyClaimed)
    );

    assert_eq!(
        store
            .consume_async(binding, Uuid::new_v4(), Duration::from_secs(1), |_| async {
                panic!("disabled async use");
                #[allow(unreachable_code)]
                Ok(())
            })
            .await,
        Err(UseError::NotStarted)
    );
    let timeout_binding = ouroboros_resources::credential_envelope::Binding {
        version: binding.version + 1,
        ..binding
    };
    store
        .insert(
            timeout_binding,
            zeroize::Zeroizing::new(b"timeout-fixture".to_vec()),
        )
        .await
        .unwrap();
    assert_eq!(
        store
            .consume_async(
                timeout_binding,
                Uuid::new_v4(),
                Duration::from_millis(50),
                |_secret| async {
                    std::future::pending::<
                        Result<(), ouroboros_resources::credential_envelope::CustodyError>,
                    >()
                    .await
                }
            )
            .await,
        Err(UseError::OutcomeUnresolved)
    );
    tokio::time::timeout(Duration::from_secs(2), store.disable(timeout_binding))
        .await
        .unwrap()
        .unwrap();
}

async fn provider_denial_checks(
    worker: &sqlx::PgPool,
    binding: ouroboros_resources::credential_envelope::Binding,
) {
    use ouroboros_resources::{
        credential_envelope::{CustodyError, EnvelopeKey},
        credential_store::CredentialStore,
        provider::{ProviderBinding, ProviderSender},
    };
    let store = CredentialStore::new(
        worker.clone(),
        EnvelopeKey::new(zeroize::Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    let active = ouroboros_resources::credential_envelope::Binding {
        version: 10,
        ..binding
    };
    store
        .insert(
            active,
            zeroize::Zeroizing::new(b"synthetic-bearer".to_vec()),
        )
        .await
        .unwrap();
    let config = ProviderBinding {
        target: "approved-model".into(),
        endpoint: "https://127.0.0.1:1/responses".into(),
        credential_id: active.credential,
        credential_version: 10,
        timeout_ms: 1000,
        max_response_bytes: 65536,
    };
    let sender = ProviderSender::new(config.clone(), store).unwrap();
    let mut ticket = ouroboros_contracts::ResourceTicket {
        firm_id: active.owner,
        intent_id: Uuid::new_v4(),
        attempt_id: Uuid::new_v4(),
        work_id: Uuid::new_v4(),
        target: config.target.clone(),
        operation: "model.responses".into(),
        input: json!({"model":"fixture","input":"hello"}),
        configuration: json!(config),
        workspace: None,
    };
    ticket.target = "unapproved".into();
    assert!(
        sender
            .execute(&ticket, || async {
                panic!("target substitution authorized");
                #[allow(unreachable_code)]
                Ok(())
            })
            .await
            .is_err()
    );
    ticket.target = config.target;
    let calls = std::sync::atomic::AtomicUsize::new(0);
    assert!(
        sender
            .execute(&ticket, || async {
                calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                Err(CustodyError)
            })
            .await
            .is_err()
    );
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    assert!(
        sender
            .execute(&ticket, || async {
                panic!("repeated attempt entered authorization");
                #[allow(unreachable_code)]
                Ok(())
            })
            .await
            .is_err()
    );
}

async fn provider_https_checks(
    worker: &sqlx::PgPool,
    binding: ouroboros_resources::credential_envelope::Binding,
    worker_url: &str,
    owner_url_file: &Path,
) {
    use ouroboros_resources::{
        credential_envelope::{Binding, EnvelopeKey},
        credential_store::CredentialStore,
        provider::{ProviderBinding, ProviderSender},
    };
    struct Child(std::process::Child);
    impl Drop for Child {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let root = std::path::PathBuf::from(
        std::env::var("OURO_TEST_TEMP_DIR")
            .expect("explicit private test scratch directory required"),
    )
    .canonicalize()
    .unwrap()
    .join(format!("ouro-provider-{}", Uuid::new_v4()));
    std::fs::DirBuilder::new()
        .mode(0o700)
        .create(&root)
        .unwrap();
    let script = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/integration/test-provider-https-fixture.py");
    let child = Child(
        std::process::Command::new("python3")
            .arg(script)
            .arg(&root)
            .env_clear()
            .env("PATH", "/usr/bin:/bin")
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap(),
    );
    for _ in 0..200 {
        if root.join("ready.json").is_file() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    let ready: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("ready.json")).unwrap()).unwrap();
    let store = CredentialStore::new(
        worker.clone(),
        EnvelopeKey::new(zeroize::Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    let active = Binding {
        version: 11,
        ..binding
    };
    store
        .insert(
            active,
            zeroize::Zeroizing::new(b"synthetic-bearer".to_vec()),
        )
        .await
        .unwrap();
    let config = ProviderBinding {
        target: "local-tls-fixture".into(),
        endpoint: ready["endpoint"].as_str().unwrap().into(),
        credential_id: active.credential,
        credential_version: 11,
        timeout_ms: 2000,
        max_response_bytes: 65536,
    };
    let cert = std::fs::read(root.join("cert.pem")).unwrap();
    let sender = ProviderSender::with_trust_root(config.clone(), store, Some(&cert)).unwrap();
    let mut ticket = ouroboros_contracts::ResourceTicket {
        firm_id: active.owner,
        intent_id: Uuid::new_v4(),
        attempt_id: Uuid::new_v4(),
        work_id: Uuid::new_v4(),
        target: config.target.clone(),
        operation: "model.responses".into(),
        input: json!({"model":"fixture-requested","reasoning":{"effort":"low"}}),
        configuration: json!(config),
        workspace: None,
    };
    let reply = sender.execute(&ticket, || async { Ok(()) }).await.unwrap();
    assert_eq!(reply.status, 200);
    assert!(!reply.body.contains("synthetic-bearer"));
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&reply.body).unwrap()["model"],
        "fixture-confirmed"
    );
    assert_eq!(reply.receipt["requested_model"], "fixture-requested");
    assert_eq!(
        reply.receipt["provider_observation"]["reported_model"],
        "fixture-confirmed"
    );
    assert_eq!(
        reply.receipt["provider_observation"]["usage"]["input_tokens"],
        1
    );
    assert_eq!(
        reply.receipt["provider_observation"]["usage"]["output_tokens"],
        2
    );
    assert!(reply.receipt["provider_observation"]["usage"]["total_tokens"].is_null());
    assert!(
        sender
            .execute(&ticket, || async {
                panic!("replay");
                #[allow(unreachable_code)]
                Ok(())
            })
            .await
            .is_err()
    );
    let recovered = sender
        .recover(&ticket, || async { Ok(()) })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(recovered.body, reply.body);
    let mut altered = ticket.clone();
    altered.input["model"] = json!("changed");
    assert!(sender.recover(&altered, || async { Ok(()) }).await.is_err());
    assert!(
        sender
            .recover(&ticket, || async {
                Err(ouroboros_resources::credential_envelope::CustodyError)
            })
            .await
            .is_err()
    );
    let saved_store = CredentialStore::new(
        worker.clone(),
        EnvelopeKey::new(zeroize::Zeroizing::new([9; 32])).unwrap(),
    )
    .await
    .unwrap();
    let replacement =
        ProviderSender::with_trust_root(config.clone(), saved_store, Some(&cert)).unwrap();
    assert_eq!(
        replacement
            .recover(&ticket, || async { Ok(()) })
            .await
            .unwrap()
            .unwrap()
            .receipt,
        reply.receipt
    );
    for statement in [
        "DELETE FROM provider_receipts",
        "TRUNCATE provider_receipts",
        "UPDATE provider_receipts SET reply='{}'",
    ] {
        assert!(sqlx::query(statement).execute(worker).await.is_err());
    }
    for mode in ["reflect", "error", "oversize", "redirect"] {
        ticket.attempt_id = Uuid::new_v4();
        ticket.input["fixture_mode"] = json!(mode);
        let error = sender
            .execute(&ticket, || async { Ok(()) })
            .await
            .err()
            .unwrap();
        assert!(!format!("{error:?}").contains("synthetic-bearer"));
    }
    let observed: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("observed.json")).unwrap()).unwrap();
    assert_eq!(observed["count"], 5);
    assert_eq!(observed["authorized"], true);
    assert_eq!(observed["path"], "/responses");
    // The provider waits for the consumer before sending its tail: buffering the complete
    // response cannot satisfy this handshake. Concatenated output must retain exact bytes.
    use ouroboros_resources::provider::ProviderFrame;
    let output = std::sync::Mutex::new(Vec::new());
    let head = std::sync::atomic::AtomicBool::new(false);
    ticket.attempt_id = Uuid::new_v4();
    ticket.input["fixture_mode"] = json!("stream");
    let streamed = sender
        .execute_stream(
            &ticket,
            || async { Ok(()) },
            |frame| {
                match frame {
                    ProviderFrame::Head {
                        status,
                        content_type,
                    } => {
                        assert_eq!(status, 200);
                        assert_eq!(content_type, "application/json");
                        head.store(true, std::sync::atomic::Ordering::SeqCst);
                    }
                    ProviderFrame::Data(bytes) => {
                        assert!(head.load(std::sync::atomic::Ordering::SeqCst));
                        output.lock().unwrap().extend(bytes);
                        std::fs::write(root.join("stream-release"), b"release").unwrap();
                    }
                }
                async { Ok(()) }
            },
        )
        .await
        .unwrap();
    assert_eq!(*output.lock().unwrap(), streamed.body.as_bytes());
    std::fs::remove_file(root.join("stream-release")).unwrap();
    // A blocked sink must not stop authorization polling or release an unresolved claim.
    let revoked = std::sync::atomic::AtomicBool::new(false);
    ticket.attempt_id = Uuid::new_v4();
    ticket.input["fixture_mode"] = json!("stream-blocked");
    let started = std::time::Instant::now();
    assert!(
        sender
            .execute_stream(
                &ticket,
                || async {
                    if revoked.load(std::sync::atomic::Ordering::SeqCst) {
                        Err(ouroboros_resources::credential_envelope::CustodyError)
                    } else {
                        Ok(())
                    }
                },
                |frame| {
                    let wait = matches!(frame, ProviderFrame::Data(_));
                    if wait {
                        revoked.store(true, std::sync::atomic::Ordering::SeqCst);
                    }
                    async move {
                        if wait {
                            std::future::pending::<()>().await;
                        }
                        Ok(())
                    }
                }
            )
            .await
            .is_err()
    );
    assert!(revoked.load(std::sync::atomic::Ordering::SeqCst));
    assert!(started.elapsed() < std::time::Duration::from_millis(1500));
    assert!(
        sender
            .recover(&ticket, || async { Ok(()) })
            .await
            .unwrap()
            .is_none()
    );
    std::fs::write(root.join("stream-release"), b"release").unwrap();
    std::fs::write(root.join("process-custody.url"), worker_url).unwrap();
    std::fs::write(root.join("process-key.bin"), [9u8; 32]).unwrap();
    use std::os::unix::fs::PermissionsExt;
    for file in ["process-custody.url", "process-key.bin"] {
        std::fs::set_permissions(root.join(file), std::fs::Permissions::from_mode(0o600)).unwrap();
    }
    let binary = std::path::PathBuf::from(
        std::env::var("OURO_TEST_BINARY_DIR")
            .expect("explicit prebuilt product binary directory required"),
    );
    assert!(binary.is_absolute() && binary.is_dir());
    std::fs::write(root.join("process-input.json"),json!({"binary":binary,"admin_url_file":owner_url_file,"firm":active.owner,"credential":active.credential}).to_string()).unwrap();
    let script = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/integration/test-provider-process.py");
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(90),
        tokio::process::Command::new("python3")
            .arg(script)
            .arg(&root)
            .env_clear()
            .env("PATH", "/usr/bin:/bin")
            .kill_on_drop(true)
            .output(),
    )
    .await
    .unwrap()
    .unwrap();
    std::fs::write(root.join("process-check.log"), &output.stderr).unwrap();
    assert!(
        output.status.success(),
        "provider process fixture failed; inspect retained local fixture log"
    );
    drop(child);
    std::fs::remove_dir_all(root).unwrap();
}
