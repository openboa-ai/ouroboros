//! File-catalog transactions: immutable content, publication, references and retirement.
//! The catalog owns its binding checks and metadata receipts; it never grants Core authority.
use crate::{intent_lock, storage};
use anyhow::{Result, ensure};
use ouroboros_contracts::{
    RetirementPolicy, RetirementRecord, RetirementRequest, RetirementTarget,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Postgres, Row, Transaction};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Component, Path},
};
use storage::{BLOB_CHUNK_BYTES, BlobReader, BoundStore, PinnedBlob, StagedBlob};
use uuid::Uuid;

// Collection shares catalog transaction internals without exposing those internals to other workers.
#[path = "collection.rs"]
mod collection;
pub use collection::{CollectionPreparation, PreparedCollection};

pub struct CatalogWorker {
    pool: PgPool,
    store: BoundStore,
    handle_id: Uuid,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceRecord {
    pub workspace_id: Uuid,
    pub namespace_id: Uuid,
    pub work_id: Uuid,
    pub label: String,
    pub revision: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StoredBlob {
    pub object_id: Option<Uuid>,
    pub sha256: String,
    pub size: u64,
}
#[derive(Clone, Debug)]
pub struct PreparedUpload {
    pub staging_id: Uuid,
    pub object_id: Option<Uuid>,
    pub digest: String,
    pub size: u64,
    pub already_committed: bool,
    firm: Uuid,
    intent: Uuid,
    handle_id: Uuid,
    max_bytes: u64,
    original: (Uuid, Option<Uuid>, String, u64, bool),
}
impl CatalogWorker {
    pub async fn new(pool: PgPool, store: BoundStore) -> Result<Self> {
        let worker = Self {
            pool,
            store,
            handle_id: Uuid::new_v4(),
        };
        // The operating credential must not be able to replace its own storage identity.
        let can_mutate: bool = sqlx::query_scalar(
            "SELECT has_table_privilege(current_user,'public.storage_binding','INSERT,UPDATE,DELETE,TRUNCATE')"
        ).fetch_one(&worker.pool).await?;
        ensure!(
            !can_mutate,
            "catalog credential can modify its own storage binding"
        );
        let mut tx = worker.pool.begin().await?;
        worker
            .check_binding(&mut tx, worker.store.identity().firm_id)
            .await?;
        tx.commit().await?;
        Ok(worker)
    }
    pub async fn preflight(&self) -> Result<ouroboros_contracts::StorageClaim> {
        self.validate()?;
        let mut tx = self.pool.begin().await?;
        let binding = self.store.identity();
        self.check_binding(&mut tx, binding.firm_id).await?;
        tx.commit().await?;
        self.validate()?;
        Ok(ouroboros_contracts::StorageClaim {
            firm_id: binding.firm_id,
            store_id: binding.store_id,
            generation: binding.generation,
        })
    }
    pub fn validate(&self) -> Result<()> {
        self.store.validate()
    }
    pub fn validate_target(&self, firm: Uuid, store: Uuid, generation: Uuid) -> Result<()> {
        self.validate()?;
        let binding = self.store.identity();
        ensure!(
            binding.firm_id == firm
                && binding.store_id == store
                && binding.generation == generation,
            "catalog target does not match its admitted storage binding"
        );
        Ok(())
    }
    async fn check_binding(&self, tx: &mut Transaction<'_, Postgres>, firm: Uuid) -> Result<()> {
        self.validate()?;
        let binding = self.store.identity();
        ensure!(firm == binding.firm_id, "catalog firm mismatch");
        let matches: bool = sqlx::query_scalar("SELECT public.check_storage_binding($1,$2,$3)")
            .bind(firm)
            .bind(binding.store_id)
            .bind(binding.generation)
            .fetch_one(&mut **tx)
            .await?;
        if !matches {
            self.store.mark_restricted()?;
            anyhow::bail!("catalog database storage binding mismatch");
        }
        self.validate()
    }
    pub async fn migrate(pool: &PgPool) -> Result<()> {
        sqlx::migrate!("./migrations/catalog").run(pool).await?;
        Ok(())
    }
    fn workspace_record(
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        workspace: Uuid,
        label: &str,
    ) -> Result<WorkspaceRecord> {
        ensure!(
            [firm, intent, work, namespace, workspace]
                .iter()
                .all(|id| !id.is_nil()),
            "invalid workspace identity"
        );
        ensure!(
            !label.is_empty() && label.len() <= 128 && label.trim() == label,
            "invalid workspace label"
        );
        Ok(WorkspaceRecord {
            workspace_id: workspace,
            namespace_id: namespace,
            work_id: work,
            label: label.to_owned(),
            revision: 0,
        })
    }

    async fn creation_receipt(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        intent: Uuid,
        expected: &WorkspaceRecord,
    ) -> Result<bool> {
        let row = sqlx::query("SELECT workspace_id,namespace_id,work_id,label,revision FROM workspace_create_receipts WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm).bind(intent).fetch_optional(&mut **tx).await?;
        let Some(row) = row else { return Ok(false) };
        let actual = WorkspaceRecord {
            workspace_id: row.get("workspace_id"),
            namespace_id: row.get("namespace_id"),
            work_id: row.get("work_id"),
            label: row.get("label"),
            revision: row.get("revision"),
        };
        ensure!(
            actual == *expected,
            "workspace creation receipt identity conflict"
        );
        let initial: Value = sqlx::query_scalar("SELECT manifest FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=0")
            .bind(firm).bind(actual.workspace_id).fetch_one(&mut **tx).await?;
        ensure!(initial == json!({}), "workspace creation snapshot conflict");
        Ok(true)
    }

    /// Receipt observation is always the initial revision, even when the workspace has advanced.
    pub async fn workspace_creation_receipt(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        workspace: Uuid,
        label: &str,
    ) -> Result<Option<WorkspaceRecord>> {
        let expected = Self::workspace_record(firm, intent, work, namespace, workspace, label)?;
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        let exists = Self::creation_receipt(&mut tx, firm, intent, &expected).await?;
        tx.commit().await?;
        self.validate()?;
        Ok(exists.then_some(expected))
    }

    pub async fn create_workspace(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        workspace: Uuid,
        label: &str,
    ) -> Result<WorkspaceRecord> {
        let expected = Self::workspace_record(firm, intent, work, namespace, workspace, label)?;
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        intent_lock(&mut tx, intent).await?;
        if Self::creation_receipt(&mut tx, firm, intent, &expected).await? {
            tx.commit().await?;
            return Ok(expected);
        }
        sqlx::query("INSERT INTO workspaces(firm_id,id,revision,manifest,namespace_id,work_id,label,completed_at) VALUES($1,$2,0,'{}',$3,$4,$5,transaction_timestamp())")
            .bind(firm).bind(workspace).bind(namespace).bind(work).bind(label).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO workspace_snapshots(firm_id,workspace_id,revision,manifest,completed_at) VALUES($1,$2,0,'{}',transaction_timestamp())")
            .bind(firm).bind(workspace).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO workspace_create_receipts(firm_id,intent_id,workspace_id,namespace_id,work_id,label,revision) VALUES($1,$2,$3,$4,$5,$6,0)")
            .bind(firm).bind(intent).bind(workspace).bind(namespace).bind(work).bind(label).execute(&mut *tx).await?;
        self.validate()?;
        tx.commit().await?;
        self.validate()?;
        Ok(expected)
    }

    /// Catalog allocation metadata is immutable. This check grants no Core or namespace authority.
    pub async fn validate_workspace(
        &self,
        firm: Uuid,
        workspace: Uuid,
        work: Uuid,
        namespace: Uuid,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        let found: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM workspaces WHERE firm_id=$1 AND id=$2 AND work_id=$3 AND namespace_id=$4)")
            .bind(firm).bind(workspace).bind(work).bind(namespace).fetch_one(&mut *tx).await?;
        ensure!(found, "workspace allocation scope mismatch");
        tx.commit().await?;
        Ok(())
    }

    async fn lock_workspace(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        workspace: Uuid,
    ) -> Result<()> {
        sqlx::query("SELECT id FROM workspaces WHERE firm_id=$1 AND id=$2 FOR SHARE")
            .bind(firm)
            .bind(workspace)
            .fetch_one(&mut **tx)
            .await?;
        Ok(())
    }

    async fn lock_object(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        object: &StoredBlob,
    ) -> Result<()> {
        self.check_object(tx, firm, object, true).await
    }

    async fn check_object(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        object: &StoredBlob,
        usable: bool,
    ) -> Result<()> {
        let Some(id) = object.object_id else {
            return Ok(());
        };
        let row = sqlx::query("SELECT store_id,storage_generation,digest,size,state FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR SHARE")
            .bind(firm).bind(id).fetch_one(&mut **tx).await?;
        let binding = self.store.identity();
        ensure!(
            row.get::<Uuid, _>("store_id") == binding.store_id
                && row.get::<Uuid, _>("storage_generation") == binding.generation
                && row.get::<String, _>("digest") == object.sha256
                && u64::try_from(row.get::<i64, _>("size"))? == object.size
                && if usable {
                    row.get::<String, _>("state") == "verified"
                } else {
                    matches!(
                        row.get::<String, _>("state").as_str(),
                        "verified" | "deleting" | "deleted"
                    )
                },
            "stored object identity or state mismatch"
        );
        if !usable && row.get::<String, _>("state") != "verified" {
            self.check_collection_history(tx, firm, object, &row.get::<String, _>("state"))
                .await?;
        }
        Ok(())
    }

    fn retirement_record(
        intent: Uuid,
        request: &RetirementRequest,
        policy: &RetirementPolicy,
    ) -> Result<RetirementRecord> {
        ensure!(
            !intent.is_nil()
                && !policy.id.is_nil()
                && policy.revision > 0
                && policy.revision <= i64::MAX as u64
                && policy.min_retention_seconds <= i32::MAX as u64
                && request.policy_id == policy.id
                && request.policy_revision == policy.revision,
            "retirement policy identity conflict"
        );
        ensure!(
            !request.reason.is_empty()
                && request.reason.len() <= 1024
                && request.reason.trim() == request.reason
                && !request.reason.chars().any(char::is_control),
            "invalid retirement reason"
        );
        let allowed: BTreeSet<_> = policy.allowed.iter().map(String::as_str).collect();
        ensure!(
            !allowed.is_empty()
                && allowed.len() == policy.allowed.len()
                && allowed.iter().all(|kind| matches!(
                    *kind,
                    "upload" | "revision" | "workspace_close" | "collect"
                )),
            "invalid retirement policy actions"
        );
        let (kind, disposition) = match &request.target {
            RetirementTarget::Upload { upload_id } => {
                ensure!(!upload_id.is_nil(), "invalid upload retirement identity");
                ("upload", "upload_retired")
            }
            RetirementTarget::Revision {
                workspace_id,
                revision,
            } => {
                ensure!(
                    !workspace_id.is_nil() && *revision >= 0,
                    "invalid revision retirement identity"
                );
                ("revision", "revision_retired")
            }
            RetirementTarget::WorkspaceClose {
                workspace_id,
                expected_revision,
            } => {
                ensure!(
                    !workspace_id.is_nil() && *expected_revision >= 0,
                    "invalid workspace closure identity"
                );
                ("workspace_close", "workspace_closed")
            }
        };
        ensure!(
            allowed.contains(kind),
            "retirement policy does not allow this action"
        );
        Ok(RetirementRecord {
            intent_id: intent,
            target: request.target.clone(),
            policy_id: policy.id,
            policy_revision: policy.revision,
            disposition: disposition.into(),
        })
    }

    async fn check_release_lineage(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        release: Uuid,
        target: &RetirementTarget,
    ) -> Result<()> {
        let row = sqlx::query(
            "SELECT input,policy,record FROM catalog_retirements WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(release)
        .fetch_one(&mut **tx)
        .await?;
        let input: Value = row.get("input");
        let request: RetirementRequest = serde_json::from_value(input["request"].clone())?;
        let policy: RetirementPolicy = serde_json::from_value(row.get("policy"))?;
        let record = Self::retirement_record(release, &request, &policy)?;
        ensure!(
            json!(request.target) == json!(target)
                && row.get::<Value, _>("record") == json!(record),
            "retirement release lineage conflict"
        );
        Ok(())
    }

    async fn upload_metadata(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        intent: Uuid,
    ) -> Result<Option<StoredBlob>> {
        let row = sqlx::query("SELECT digest,size,object_id,retired_by FROM uploads WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm).bind(intent).fetch_optional(&mut **tx).await?;
        let Some(row) = row else { return Ok(None) };
        let object = StoredBlob {
            object_id: row.get("object_id"),
            sha256: row.get("digest"),
            size: u64::try_from(row.get::<i64, _>("size"))?,
        };
        self.check_object(tx, firm, &object, false).await?;
        if let Some(id) = object.object_id {
            let owner: Uuid = sqlx::query_scalar(
                "SELECT upload_intent_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2",
            )
            .bind(firm)
            .bind(id)
            .fetch_one(&mut **tx)
            .await?;
            ensure!(owner == intent, "upload object owner conflict");
            let release: Option<Uuid> = sqlx::query_scalar("SELECT released_by FROM upload_object_holds WHERE firm_id=$1 AND intent_id=$2 AND object_id=$3")
                .bind(firm).bind(intent).bind(id).fetch_one(&mut **tx).await?;
            ensure!(
                release == row.get::<Option<Uuid>, _>("retired_by"),
                "upload hold lineage conflict"
            );
            if let Some(release) = release {
                Self::check_release_lineage(
                    tx,
                    firm,
                    release,
                    &RetirementTarget::Upload { upload_id: intent },
                )
                .await?;
            }
        } else {
            ensure!(
                row.get::<Option<Uuid>, _>("retired_by").is_none(),
                "legacy upload cannot be retired"
            );
        }
        Ok(Some(object))
    }

    async fn check_revision_hold_lineage(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        workspace: Uuid,
        revision: i64,
        object: Uuid,
    ) -> Result<()> {
        let retired: Option<Uuid> = sqlx::query_scalar("SELECT retired_by FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3")
            .bind(firm).bind(workspace).bind(revision).fetch_one(&mut **tx).await?;
        let released: Option<Uuid> = sqlx::query_scalar("SELECT released_by FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 AND object_id=$4")
            .bind(firm).bind(workspace).bind(revision).bind(object).fetch_one(&mut **tx).await?;
        ensure!(retired == released, "revision hold lineage conflict");
        if let Some(release) = released {
            Self::check_release_lineage(
                tx,
                firm,
                release,
                &RetirementTarget::Revision {
                    workspace_id: workspace,
                    revision,
                },
            )
            .await?;
        }
        Ok(())
    }

    fn retirement_input(work: Uuid, namespace: Uuid, request: &RetirementRequest) -> Result<Value> {
        ensure!(
            !work.is_nil() && !namespace.is_nil(),
            "invalid retirement scope"
        );
        Ok(json!({"work_id":work,"namespace_id":namespace,"request":request}))
    }

    async fn require_workspace_scope(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        workspace: Uuid,
        work: Uuid,
        namespace: Uuid,
    ) -> Result<()> {
        let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM workspaces WHERE firm_id=$1 AND id=$2 AND work_id=$3 AND namespace_id=$4)")
            .bind(firm).bind(workspace).bind(work).bind(namespace).fetch_one(&mut **tx).await?;
        ensure!(valid, "workspace retirement scope mismatch");
        Ok(())
    }

    fn manifest_objects(manifest: &Value) -> Result<BTreeMap<Uuid, StoredBlob>> {
        let entries = manifest
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("invalid manifest"))?;
        ensure!(entries.len() <= 1000, "retirement manifest exceeds bound");
        let mut objects = BTreeMap::new();
        for value in entries.values() {
            let object: StoredBlob = serde_json::from_value(value.clone())?;
            let id = object
                .object_id
                .ok_or_else(|| anyhow::anyhow!("legacy content cannot be retired"))?;
            if let Some(prior) = objects.insert(id, object.clone()) {
                ensure!(prior == object, "manifest object identity conflict");
            }
        }
        Ok(objects)
    }

    async fn require_exact_revision_holds(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        workspace: Uuid,
        revision: i64,
        objects: &BTreeMap<Uuid, StoredBlob>,
    ) -> Result<()> {
        let actual: Vec<Uuid> = sqlx::query_scalar("SELECT object_id FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 ORDER BY object_id")
            .bind(firm).bind(workspace).bind(revision).fetch_all(&mut **tx).await?;
        ensure!(
            actual == objects.keys().copied().collect::<Vec<_>>(),
            "revision hold inventory conflict"
        );
        Ok(())
    }

    async fn retirement_effect(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        target: &RetirementTarget,
    ) -> Result<()> {
        match target {
            RetirementTarget::Upload { upload_id } => {
                let object = self
                    .upload_metadata(tx, firm, *upload_id)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("retired upload receipt missing"))?;
                ensure!(
                    object.object_id.is_some(),
                    "legacy upload cannot be retired"
                );
                let retired: Option<Uuid> = sqlx::query_scalar(
                    "SELECT retired_by FROM uploads WHERE firm_id=$1 AND intent_id=$2",
                )
                .bind(firm)
                .bind(upload_id)
                .fetch_one(&mut **tx)
                .await?;
                ensure!(
                    retired == Some(intent),
                    "upload retirement receipt conflict"
                );
            }
            RetirementTarget::Revision {
                workspace_id,
                revision,
            } => {
                Self::lock_workspace(tx, firm, *workspace_id).await?;
                Self::require_workspace_scope(tx, firm, *workspace_id, work, namespace).await?;
                let row = sqlx::query("SELECT manifest,retired_by FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3")
                    .bind(firm).bind(workspace_id).bind(revision).fetch_one(&mut **tx).await?;
                ensure!(
                    row.get::<Option<Uuid>, _>("retired_by") == Some(intent),
                    "revision retirement receipt conflict"
                );
                let objects = Self::manifest_objects(&row.get("manifest"))?;
                Self::require_exact_revision_holds(tx, firm, *workspace_id, *revision, &objects)
                    .await?;
                for (id, object) in objects {
                    self.check_object(tx, firm, &object, false).await?;
                    Self::check_revision_hold_lineage(tx, firm, *workspace_id, *revision, id)
                        .await?;
                }
            }
            RetirementTarget::WorkspaceClose {
                workspace_id,
                expected_revision,
            } => {
                Self::lock_workspace(tx, firm, *workspace_id).await?;
                Self::require_workspace_scope(tx, firm, *workspace_id, work, namespace).await?;
                let row = sqlx::query(
                    "SELECT revision,closed_by FROM workspaces WHERE firm_id=$1 AND id=$2",
                )
                .bind(firm)
                .bind(workspace_id)
                .fetch_one(&mut **tx)
                .await?;
                ensure!(
                    row.get::<i64, _>("revision") == *expected_revision
                        && row.get::<Option<Uuid>, _>("closed_by") == Some(intent),
                    "workspace closure receipt conflict"
                );
            }
        }
        Ok(())
    }

    /// Inspect the immutable retirement outcome; this never releases another hold or reads bytes.
    pub async fn retirement_receipt(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        request: &RetirementRequest,
        policy: &RetirementPolicy,
    ) -> Result<Option<RetirementRecord>> {
        let record = Self::retirement_record(intent, request, policy)?;
        let input = Self::retirement_input(work, namespace, request)?;
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        let row = sqlx::query(
            "SELECT input,policy,record FROM catalog_retirements WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        ensure!(
            row.get::<Value, _>("input") == input
                && row.get::<Value, _>("policy") == json!(policy)
                && row.get::<Value, _>("record") == json!(record),
            "retirement receipt identity conflict"
        );
        self.retirement_effect(&mut tx, firm, intent, work, namespace, &request.target)
            .await?;
        tx.commit().await?;
        Ok(Some(record))
    }

    /// Core must first admit the exact scope and install its durable pending-use barrier.
    /// This worker releases only the named ordinary reference, never an unrelated owner's hold.
    pub async fn retire_reference(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        request: &RetirementRequest,
        policy: &RetirementPolicy,
    ) -> Result<RetirementRecord> {
        let record = Self::retirement_record(intent, request, policy)?;
        let input = Self::retirement_input(work, namespace, request)?;
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        intent_lock(&mut tx, intent).await?;
        if let Some(row) = sqlx::query(
            "SELECT input,policy,record FROM catalog_retirements WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?
        {
            ensure!(
                row.get::<Value, _>("input") == input
                    && row.get::<Value, _>("policy") == json!(policy)
                    && row.get::<Value, _>("record") == json!(record),
                "retirement receipt identity conflict"
            );
            self.retirement_effect(&mut tx, firm, intent, work, namespace, &request.target)
                .await?;
            tx.commit().await?;
            return Ok(record);
        }
        match &request.target {
            RetirementTarget::Upload { upload_id } => {
                let object: Option<Uuid> = sqlx::query_scalar(
                    "SELECT object_id FROM uploads WHERE firm_id=$1 AND intent_id=$2",
                )
                .bind(firm)
                .bind(upload_id)
                .fetch_one(&mut *tx)
                .await?;
                let object =
                    object.ok_or_else(|| anyhow::anyhow!("legacy upload cannot be retired"))?;
                sqlx::query("SELECT object_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR UPDATE")
                    .bind(firm).bind(object).fetch_one(&mut *tx).await?;
                let stored = self
                    .upload_metadata(&mut tx, firm, *upload_id)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("upload receipt missing"))?;
                self.lock_object(&mut tx, firm, &stored).await?;
                Self::check_upload_hold(&mut tx, firm, *upload_id, &stored).await?;
                let old_enough: bool = sqlx::query_scalar("SELECT $3::bigint=0 OR (completed_at IS NOT NULL AND EXTRACT(EPOCH FROM clock_timestamp()-completed_at)>=$3::numeric) FROM uploads WHERE firm_id=$1 AND intent_id=$2")
                    .bind(firm).bind(upload_id).bind(policy.min_retention_seconds as i64).fetch_one(&mut *tx).await?;
                ensure!(old_enough, "upload retention age is not satisfied");
            }
            RetirementTarget::Revision {
                workspace_id,
                revision,
            } => {
                let row = sqlx::query("SELECT revision,closed_by FROM workspaces WHERE firm_id=$1 AND id=$2 FOR UPDATE")
                    .bind(firm).bind(workspace_id).fetch_one(&mut *tx).await?;
                Self::require_workspace_scope(&mut tx, firm, *workspace_id, work, namespace)
                    .await?;
                ensure!(
                    row.get::<i64, _>("revision") != *revision
                        || row.get::<Option<Uuid>, _>("closed_by").is_some(),
                    "active workspace head cannot be retired"
                );
                let snapshot = sqlx::query("SELECT manifest,retired_by,($4::bigint=0 OR (completed_at IS NOT NULL AND EXTRACT(EPOCH FROM clock_timestamp()-completed_at)>=$4::numeric)) AS old_enough FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3")
                    .bind(firm).bind(workspace_id).bind(revision).bind(policy.min_retention_seconds as i64).fetch_one(&mut *tx).await?;
                ensure!(
                    snapshot.get::<Option<Uuid>, _>("retired_by").is_none()
                        && snapshot.get::<bool, _>("old_enough"),
                    "revision already retired or retention age not satisfied"
                );
                let objects = Self::manifest_objects(&snapshot.get("manifest"))?;
                Self::require_exact_revision_holds(
                    &mut tx,
                    firm,
                    *workspace_id,
                    *revision,
                    &objects,
                )
                .await?;
                for (id, object) in objects {
                    sqlx::query("SELECT object_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR UPDATE")
                        .bind(firm).bind(id).fetch_one(&mut *tx).await?;
                    self.lock_object(&mut tx, firm, &object).await?;
                    Self::check_revision_hold_lineage(&mut tx, firm, *workspace_id, *revision, id)
                        .await?;
                }
            }
            RetirementTarget::WorkspaceClose {
                workspace_id,
                expected_revision,
            } => {
                // Closure age follows the fixed head's original effect, not the older allocation.
                let row = sqlx::query("SELECT w.revision,w.closed_by,($4::bigint=0 OR EXISTS(SELECT 1 FROM workspace_snapshots s WHERE s.firm_id=w.firm_id AND s.workspace_id=w.id AND s.revision=$3 AND s.completed_at IS NOT NULL AND EXTRACT(EPOCH FROM clock_timestamp()-s.completed_at)>=$4::numeric)) AS old_enough FROM workspaces w WHERE w.firm_id=$1 AND w.id=$2 FOR UPDATE")
                    .bind(firm).bind(workspace_id).bind(expected_revision).bind(policy.min_retention_seconds as i64).fetch_one(&mut *tx).await?;
                Self::require_workspace_scope(&mut tx, firm, *workspace_id, work, namespace)
                    .await?;
                ensure!(
                    row.get::<i64, _>("revision") == *expected_revision
                        && row.get::<Option<Uuid>, _>("closed_by").is_none()
                        && row.get::<bool, _>("old_enough"),
                    "workspace closure state or retention age conflict"
                );
            }
        }
        sqlx::query("INSERT INTO catalog_retirements(firm_id,intent_id,input,policy,record) VALUES($1,$2,$3,$4,$5)")
            .bind(firm).bind(intent).bind(input).bind(json!(policy)).bind(json!(record)).execute(&mut *tx).await?;
        match &request.target {
            RetirementTarget::Upload { upload_id } => {
                sqlx::query("UPDATE uploads SET retired_by=$3 WHERE firm_id=$1 AND intent_id=$2 AND retired_by IS NULL")
                    .bind(firm).bind(upload_id).bind(intent).execute(&mut *tx).await?;
                let changed = sqlx::query("UPDATE upload_object_holds SET released_by=$3 WHERE firm_id=$1 AND intent_id=$2 AND released_by IS NULL")
                    .bind(firm).bind(upload_id).bind(intent).execute(&mut *tx).await?;
                ensure!(changed.rows_affected() == 1, "upload hold release conflict");
            }
            RetirementTarget::Revision {
                workspace_id,
                revision,
            } => {
                sqlx::query("UPDATE workspace_snapshots SET retired_by=$4 WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 AND retired_by IS NULL")
                    .bind(firm).bind(workspace_id).bind(revision).bind(intent).execute(&mut *tx).await?;
                sqlx::query("UPDATE revision_object_holds SET released_by=$4 WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 AND released_by IS NULL")
                    .bind(firm).bind(workspace_id).bind(revision).bind(intent).execute(&mut *tx).await?;
            }
            RetirementTarget::WorkspaceClose { workspace_id, .. } => {
                sqlx::query("UPDATE workspaces SET closed_by=$3 WHERE firm_id=$1 AND id=$2 AND closed_by IS NULL")
                    .bind(firm).bind(workspace_id).bind(intent).execute(&mut *tx).await?;
            }
        }
        self.validate()?;
        tx.commit().await?;
        Ok(record)
    }

    fn pin_reference(&self, object: &StoredBlob, max: u64) -> Result<Option<PinnedBlob>> {
        object
            .object_id
            .map(|id| self.store.pin_object(id, &object.sha256, object.size, max))
            .transpose()
    }

    fn verify_reference(
        &self,
        object: &StoredBlob,
        pinned: Option<PinnedBlob>,
        max: u64,
    ) -> Result<BlobReader> {
        match (object.object_id, pinned) {
            (Some(_), Some(pinned)) => self.store.verify_pinned(pinned),
            (None, None) => self.store.open_blob(&object.sha256, Some(object.size), max),
            _ => anyhow::bail!("object pin identity mismatch"),
        }
    }
    /// Commit the staging inventory before a caller can create or receive any bytes.
    pub async fn prepare_upload(
        &self,
        firm: Uuid,
        intent: Uuid,
        digest: &str,
        size: u64,
        max_bytes: u64,
    ) -> Result<PreparedUpload> {
        ensure!(
            max_bytes > 0 && size <= max_bytes && size <= i64::MAX as u64,
            "upload exceeds admitted bound"
        );
        ensure!(
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "invalid content digest"
        );
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        intent_lock(&mut tx, intent).await?;
        let receipt = sqlx::query(
            "SELECT digest,size,object_id FROM uploads WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(row) = &receipt {
            ensure!(
                row.get::<String, _>("digest") == digest
                    && row.get::<i64, _>("size") == size as i64,
                "upload identity conflict"
            );
        }
        let binding = self.store.identity();
        let (staging_id, object_id) = if let Some(row) = sqlx::query("SELECT store_id,storage_generation,staging_id,object_id,digest,declared_size,state FROM upload_staging WHERE firm_id=$1 AND intent_id=$2")
            .bind(firm).bind(intent).fetch_optional(&mut *tx).await? {
            let state: String = row.get("state");
            ensure!(row.get::<Uuid,_>("store_id") == binding.store_id
                && row.get::<Uuid,_>("storage_generation") == binding.generation
                && row.get::<String,_>("digest") == digest && row.get::<i64,_>("declared_size") == size as i64
                && ((receipt.is_some() && state == "committed") || (receipt.is_none() && state == "prepared"))
                && receipt.as_ref().is_none_or(|r| r.get::<Option<Uuid>,_>("object_id") == row.get::<Option<Uuid>,_>("object_id")),
                "staging identity conflict");
            (row.get("staging_id"), row.get("object_id"))
        } else if let Some(row) = &receipt {
            ensure!(row.get::<Option<Uuid>,_>("object_id").is_none(), "object receipt lacks staging inventory");
            // A legacy receipt is observation-only. Do not mint a new staging/object lifetime.
            (Uuid::nil(), None)
        } else {
            let staging_id = Uuid::new_v4();
            sqlx::query("INSERT INTO blob_objects(firm_id,object_id,upload_intent_id,store_id,storage_generation,digest,size,state) VALUES($1,$2,$3,$4,$5,$6,$7,'prepared')")
                .bind(firm).bind(staging_id).bind(intent).bind(binding.store_id).bind(binding.generation)
                .bind(digest).bind(size as i64).execute(&mut *tx).await?;
            sqlx::query("INSERT INTO upload_staging(firm_id,intent_id,store_id,storage_generation,staging_id,digest,declared_size,state,object_id) VALUES($1,$2,$3,$4,$5,$6,$7,'prepared',$5)")
                .bind(firm).bind(intent).bind(binding.store_id).bind(binding.generation).bind(staging_id)
                .bind(digest).bind(size as i64)
                .execute(&mut *tx).await?;
            (staging_id, Some(staging_id))
        };
        if let Some(object) = object_id {
            let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM blob_objects WHERE firm_id=$1 AND object_id=$2 AND upload_intent_id=$3 AND store_id=$4 AND storage_generation=$5 AND digest=$6 AND size=$7 AND (($8::boolean AND state IN ('verified','deleting','deleted')) OR (NOT $8::boolean AND state='prepared')))")
                .bind(firm).bind(object).bind(intent).bind(binding.store_id).bind(binding.generation)
                .bind(digest).bind(size as i64).bind(receipt.is_some())
                .fetch_one(&mut *tx).await?;
            ensure!(valid, "prepared object identity conflict");
        }
        tx.commit().await?;
        if receipt.is_some() {
            ensure!(
                self.upload_reference(firm, intent, digest, size)
                    .await?
                    .is_some(),
                "upload receipt disappeared"
            );
        }
        self.validate()?;
        Ok(PreparedUpload {
            staging_id,
            object_id,
            digest: digest.to_owned(),
            size,
            already_committed: receipt.is_some(),
            firm,
            intent,
            handle_id: self.handle_id,
            max_bytes,
            original: (
                staging_id,
                object_id,
                digest.to_owned(),
                size,
                receipt.is_some(),
            ),
        })
    }

    fn check_prepared(&self, prepared: &PreparedUpload) -> Result<()> {
        self.validate()?;
        ensure!(
            prepared.handle_id == self.handle_id
                && prepared.original
                    == (
                        prepared.staging_id,
                        prepared.object_id,
                        prepared.digest.clone(),
                        prepared.size,
                        prepared.already_committed
                    ),
            "prepared upload does not belong to this catalog session"
        );
        Ok(())
    }

    pub async fn begin_upload(&self, prepared: &PreparedUpload) -> Result<StagedBlob> {
        self.check_prepared(prepared)?;
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, prepared.firm).await?;
        if let Some(object) = prepared.object_id {
            ensure!(
                object == prepared.staging_id,
                "prepared object does not match its staging lifetime"
            );
            sqlx::query(
                "SELECT object_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR SHARE",
            )
            .bind(prepared.firm)
            .bind(object)
            .fetch_one(&mut *tx)
            .await?;
        }
        self.check_staging(&mut tx, prepared).await?;
        if prepared.object_id.is_none() {
            ensure!(
                !prepared.staging_id.is_nil(),
                "legacy receipt cannot restart a byte transfer"
            );
            // Legacy generations are not eligible for retirement or collection. Their existing
            // verification also stays outside a metadata transaction.
            tx.commit().await?;
            return self.store.begin_staged_blob(
                prepared.staging_id,
                &prepared.digest,
                prepared.size,
                prepared.max_bytes,
            );
        }
        let mut staged = self.store.begin_staged_object_metadata(
            prepared.staging_id,
            &prepared.digest,
            prepared.size,
            prepared.max_bytes,
        )?;
        tx.commit().await?;
        // Expensive byte verification holds the exact physical FD, never a Catalog transaction.
        self.store.verify_staged_blob(&mut staged)?;
        Ok(staged)
    }

    pub fn write_upload_chunk(&self, staged: &mut StagedBlob, bytes: &[u8]) -> Result<()> {
        self.store.write_blob_chunk(staged, bytes)
    }

    async fn check_staging(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        prepared: &PreparedUpload,
    ) -> Result<()> {
        self.check_binding(tx, prepared.firm).await?;
        let binding = self.store.identity();
        let matches: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM upload_staging WHERE firm_id=$1 AND intent_id=$2 AND staging_id=$3 AND store_id=$4 AND storage_generation=$5 AND digest=$6 AND declared_size=$7 AND state IN ('prepared','committed') AND object_id IS NOT DISTINCT FROM $8::uuid)")
            .bind(prepared.firm).bind(prepared.intent).bind(prepared.staging_id).bind(binding.store_id)
            .bind(binding.generation).bind(&prepared.digest).bind(prepared.size as i64).bind(prepared.object_id)
            .fetch_one(&mut **tx).await?;
        ensure!(matches, "durable staging inventory changed");
        if let Some(object) = prepared.object_id {
            let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM blob_objects o JOIN upload_staging s ON (s.firm_id,s.object_id)=(o.firm_id,o.object_id) WHERE o.firm_id=$1 AND o.object_id=$2 AND o.upload_intent_id=$3 AND o.store_id=$4 AND o.storage_generation=$5 AND o.digest=$6 AND o.size=$7 AND ((o.state='prepared' AND s.state='prepared') OR (o.state='verified' AND s.state='committed' AND EXISTS(SELECT 1 FROM uploads u JOIN upload_object_holds h USING(firm_id,intent_id,object_id) WHERE u.firm_id=o.firm_id AND u.intent_id=o.upload_intent_id AND u.object_id=o.object_id AND h.released_by IS NULL))) AND NOT EXISTS(SELECT 1 FROM uploads u WHERE u.firm_id=o.firm_id AND u.intent_id=o.upload_intent_id AND u.retired_by IS NOT NULL))")
                .bind(prepared.firm).bind(object).bind(prepared.intent).bind(binding.store_id).bind(binding.generation)
                .bind(&prepared.digest).bind(prepared.size as i64).fetch_one(&mut **tx).await?;
            ensure!(valid, "durable object inventory changed");
        }
        Ok(())
    }

    /// The filesystem effect precedes its metadata transaction. A failed commit retains the
    /// installed bytes and staging inventory for explicit reconciliation, never a blind replay.
    pub async fn finish_upload(
        &self,
        firm: Uuid,
        intent: Uuid,
        prepared: &PreparedUpload,
        staged: StagedBlob,
    ) -> Result<String> {
        self.check_prepared(prepared)?;
        ensure!(
            prepared.firm == firm
                && prepared.intent == intent
                && staged.staging_id == prepared.staging_id
                && staged.digest == prepared.digest
                && staged.size == prepared.size,
            "upload completion identity conflict"
        );
        let mut tx = self.pool.begin().await?;
        self.check_staging(&mut tx, prepared).await?;
        tx.commit().await?;
        self.store.finish_staged_blob(staged)?;
        let mut tx = self.pool.begin().await?;
        self.check_staging(&mut tx, prepared).await?;
        intent_lock(&mut tx, intent).await?;
        if let Some(object) = prepared.object_id {
            sqlx::query(
                "SELECT object_id FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR UPDATE",
            )
            .bind(firm)
            .bind(object)
            .fetch_one(&mut *tx)
            .await?;
        }
        if let Some(row) = sqlx::query(
            "SELECT digest,size,object_id FROM uploads WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?
        {
            ensure!(
                row.get::<String, _>("digest") == prepared.digest
                    && row.get::<i64, _>("size") == prepared.size as i64
                    && row.get::<Option<Uuid>, _>("object_id") == prepared.object_id,
                "upload identity conflict"
            );
            if let Some(object) = prepared.object_id {
                let held: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM upload_object_holds h JOIN uploads u USING(firm_id,intent_id,object_id) WHERE h.firm_id=$1 AND h.intent_id=$2 AND h.object_id=$3 AND h.released_by IS NULL AND u.retired_by IS NULL)")
                    .bind(firm).bind(intent).bind(object).fetch_one(&mut *tx).await?;
                ensure!(held, "committed upload lacks its retained object hold");
            }
        } else {
            sqlx::query("INSERT INTO uploads(firm_id,intent_id,digest,size,object_id,completed_at) VALUES($1,$2,$3,$4,$5,transaction_timestamp())")
                .bind(firm)
                .bind(intent)
                .bind(&prepared.digest)
                .bind(prepared.size as i64)
                .bind(prepared.object_id)
                .execute(&mut *tx)
                .await?;
            if let Some(object) = prepared.object_id {
                let updated = sqlx::query("UPDATE blob_objects SET state='verified' WHERE firm_id=$1 AND object_id=$2 AND state='prepared'")
                    .bind(firm).bind(object).execute(&mut *tx).await?;
                ensure!(updated.rows_affected() == 1, "object commit state conflict");
                sqlx::query(
                    "INSERT INTO upload_object_holds(firm_id,intent_id,object_id) VALUES($1,$2,$3)",
                )
                .bind(firm)
                .bind(intent)
                .bind(object)
                .execute(&mut *tx)
                .await?;
            }
            let updated = sqlx::query("UPDATE upload_staging SET state='committed' WHERE firm_id=$1 AND intent_id=$2 AND staging_id=$3 AND state='prepared'")
                .bind(firm).bind(intent).bind(prepared.staging_id).execute(&mut *tx).await?;
            ensure!(
                updated.rows_affected() == 1,
                "staging commit identity conflict"
            );
        }
        self.validate()?;
        tx.commit().await?;
        self.validate()?;
        Ok(prepared.digest.clone())
    }

    /// Retained bounded text-era entry point. It verifies supplied bytes even for a replay;
    /// the binary HTTP path must likewise consume/hash its actual request body separately.
    pub async fn upload(
        &self,
        firm: Uuid,
        intent: Uuid,
        expected_digest: &str,
        bytes: &[u8],
        max_bytes: usize,
    ) -> Result<String> {
        ensure!(
            max_bytes > 0 && bytes.len() <= max_bytes,
            "upload exceeds admitted bound"
        );
        ensure!(
            format!("{:x}", Sha256::digest(bytes)) == expected_digest,
            "content mismatch"
        );
        let prepared = self
            .prepare_upload(
                firm,
                intent,
                expected_digest,
                bytes.len() as u64,
                max_bytes as u64,
            )
            .await?;
        if prepared.already_committed {
            return Ok(prepared.digest);
        }
        let mut staged = self.begin_upload(&prepared).await?;
        if staged.requires_transfer() {
            for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                self.write_upload_chunk(&mut staged, chunk)?;
            }
        }
        self.finish_upload(firm, intent, &prepared, staged).await
    }

    /// Observe the original committed effect, independently of current content availability.
    /// A valid retirement preserves this metadata; it never recreates bytes or an active hold.
    pub async fn upload_reference(
        &self,
        firm: Uuid,
        intent: Uuid,
        expected_digest: &str,
        expected_size: u64,
    ) -> Result<Option<StoredBlob>> {
        ensure!(
            expected_size <= i64::MAX as u64,
            "invalid upload receipt bound"
        );
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        let object = self.upload_metadata(&mut tx, firm, intent).await?;
        if let Some(object) = &object {
            ensure!(
                object.sha256 == expected_digest && object.size == expected_size,
                "upload receipt identity conflict"
            );
        }
        tx.commit().await?;
        Ok(object)
    }

    pub async fn upload_receipt(
        &self,
        firm: Uuid,
        intent: Uuid,
        digest: &str,
        size: u64,
    ) -> Result<Option<String>> {
        Ok(self
            .upload_reference(firm, intent, digest, size)
            .await?
            .map(|object| object.sha256))
    }

    async fn check_upload_hold(
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        intent: Uuid,
        object: &StoredBlob,
    ) -> Result<()> {
        if let Some(id) = object.object_id {
            let held: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM upload_object_holds h JOIN uploads u USING(firm_id,intent_id,object_id) WHERE h.firm_id=$1 AND h.intent_id=$2 AND h.object_id=$3 AND h.released_by IS NULL AND u.retired_by IS NULL)")
                .bind(firm).bind(intent).bind(id).fetch_one(&mut **tx).await?;
            ensure!(held, "upload receipt lacks its retained object hold");
        }
        Ok(())
    }

    async fn resolve_uploads(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        files: &BTreeMap<String, Uuid>,
        usable: bool,
    ) -> Result<Vec<(String, StoredBlob)>> {
        let mut resolved = Vec::with_capacity(files.len());
        for (path, upload) in files {
            let row = sqlx::query(
                "SELECT digest,size,object_id FROM uploads WHERE firm_id=$1 AND intent_id=$2",
            )
            .bind(firm)
            .bind(upload)
            .fetch_one(&mut **tx)
            .await?;
            let size = u64::try_from(row.get::<i64, _>("size"))?;
            resolved.push((
                path.clone(),
                StoredBlob {
                    object_id: row.get("object_id"),
                    sha256: row.get("digest"),
                    size,
                },
            ));
        }
        let ids: BTreeSet<_> = resolved
            .iter()
            .filter_map(|(_, object)| object.object_id)
            .collect();
        for id in ids {
            let object = &resolved
                .iter()
                .find(|(_, object)| object.object_id == Some(id))
                .expect("collected object")
                .1;
            self.check_object(tx, firm, object, usable).await?;
        }
        for (path, object) in &resolved {
            if usable {
                Self::check_upload_hold(tx, firm, files[path], object).await?;
            } else {
                ensure!(
                    self.upload_metadata(tx, firm, files[path]).await?.as_ref() == Some(object),
                    "publication upload identity conflict"
                );
            }
        }
        Ok(resolved)
    }

    /// Observe a publication without starting or retrying a filesystem or catalog mutation.
    pub async fn publication_receipt(
        &self,
        firm: Uuid,
        intent: Uuid,
        workspace: Uuid,
        expected_revision: i64,
        files: BTreeMap<String, Uuid>,
    ) -> Result<Option<i64>> {
        ensure!(
            expected_revision >= 0 && files.len() <= 1000,
            "invalid publication bound"
        );
        for path in files.keys() {
            validate_path(path)?;
        }
        let input =
            json!({"workspace_id":workspace,"expected_revision":expected_revision,"files":files});
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        Self::lock_workspace(&mut tx, firm, workspace).await?;
        let row = sqlx::query(
            "SELECT input,revision FROM publication_receipts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.commit().await?;
            return Ok(None);
        };
        ensure!(
            row.get::<Value, _>("input") == input,
            "publication receipt identity conflict"
        );
        let resolved = self.resolve_uploads(&mut tx, firm, &files, false).await?;
        let revision: i64 = row.get("revision");
        ensure!(
            expected_revision.checked_add(1) == Some(revision),
            "publication receipt revision conflict"
        );
        let manifest: Value = sqlx::query_scalar("SELECT manifest FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 UNION ALL SELECT manifest FROM workspaces WHERE firm_id=$1 AND id=$2 AND revision=$3 LIMIT 1")
            .bind(firm).bind(workspace).bind(revision).fetch_one(&mut *tx).await?;
        let expected_manifest: BTreeMap<_, _> = resolved
            .iter()
            .map(|(path, object)| {
                (
                    path.clone(),
                    if object.object_id.is_some() {
                        json!(object)
                    } else {
                        json!(object.sha256)
                    },
                )
            })
            .collect();
        ensure!(
            manifest == json!(expected_manifest),
            "publication snapshot identity conflict"
        );
        for object in resolved
            .iter()
            .filter_map(|(_, object)| object.object_id)
            .collect::<BTreeSet<_>>()
        {
            Self::check_revision_hold_lineage(&mut tx, firm, workspace, revision, object).await?;
        }
        let retired: Option<Option<Uuid>> = sqlx::query_scalar("SELECT retired_by FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3")
            .bind(firm).bind(workspace).bind(revision).fetch_optional(&mut *tx).await?;
        if let Some(Some(release)) = retired {
            Self::check_release_lineage(
                &mut tx,
                firm,
                release,
                &RetirementTarget::Revision {
                    workspace_id: workspace,
                    revision,
                },
            )
            .await?;
        }
        tx.commit().await?;
        self.validate()?;
        Ok(Some(row.get("revision")))
    }

    pub async fn open_file(
        &self,
        firm: Uuid,
        workspace: Uuid,
        revision: i64,
        path: &str,
        max_bytes: u64,
    ) -> Result<BlobReader> {
        validate_path(path)?;
        ensure!(revision >= 0 && max_bytes > 0, "invalid file read bound");
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        Self::lock_workspace(&mut tx, firm, workspace).await?;
        let retired: Option<Option<Uuid>> = sqlx::query_scalar("SELECT retired_by FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3")
            .bind(firm).bind(workspace).bind(revision).fetch_optional(&mut *tx).await?;
        ensure!(retired.flatten().is_none(), "revision is retired");
        let manifest: Value = sqlx::query_scalar("SELECT manifest FROM workspace_snapshots WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 UNION ALL SELECT manifest FROM workspaces WHERE firm_id=$1 AND id=$2 AND revision=$3 LIMIT 1")
            .bind(firm).bind(workspace).bind(revision).fetch_one(&mut *tx).await?;
        let value = manifest
            .get(path)
            .ok_or_else(|| anyhow::anyhow!("file not in snapshot"))?;
        let object = if let Some(digest) = value.as_str() {
            // Legacy manifests stay on their exact legacy address. New generation records with
            // the same digest cannot satisfy a missing historical upload receipt.
            let sizes: Vec<i64> = sqlx::query_scalar("SELECT DISTINCT size FROM uploads WHERE firm_id=$1 AND digest=$2 AND object_id IS NULL")
                .bind(firm).bind(digest).fetch_all(&mut *tx).await?;
            ensure!(
                sizes.len() == 1,
                "legacy snapshot lacks an unambiguous upload receipt"
            );
            StoredBlob {
                object_id: None,
                sha256: digest.to_owned(),
                size: u64::try_from(sizes[0])?,
            }
        } else {
            let object: StoredBlob = serde_json::from_value(value.clone())?;
            ensure!(
                object.object_id.is_some(),
                "snapshot has no exact object generation"
            );
            self.lock_object(&mut tx, firm, &object).await?;
            let held: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM revision_object_holds WHERE firm_id=$1 AND workspace_id=$2 AND revision=$3 AND object_id=$4 AND released_by IS NULL)")
                .bind(firm).bind(workspace).bind(revision).bind(object.object_id).fetch_one(&mut *tx).await?;
            ensure!(held, "snapshot lacks its retained object hold");
            object
        };
        ensure!(object.size <= max_bytes, "file exceeds admitted read bound");
        let pinned = self.pin_reference(&object, max_bytes)?;
        tx.commit().await?;
        self.verify_reference(&object, pinned, max_bytes)
    }

    pub fn read_file_chunk(&self, reader: &mut BlobReader, max: usize) -> Result<Vec<u8>> {
        self.store.read_blob_chunk(reader, max)
    }

    /// Existing UTF-8 interface stays explicitly bounded; arbitrary bytes use open_file/chunks.
    pub async fn read_file(
        &self,
        firm: Uuid,
        workspace: Uuid,
        revision: i64,
        path: &str,
    ) -> Result<String> {
        let mut reader = self
            .open_file(firm, workspace, revision, path, 65536)
            .await?;
        let mut bytes = Vec::new();
        loop {
            let chunk = self.read_file_chunk(&mut reader, BLOB_CHUNK_BYTES)?;
            if chunk.is_empty() {
                return Ok(String::from_utf8(bytes)?);
            }
            bytes.extend_from_slice(&chunk);
        }
    }

    pub async fn publish(
        &self,
        firm: Uuid,
        intent: Uuid,
        workspace: Uuid,
        expected_revision: i64,
        files: BTreeMap<String, Uuid>,
    ) -> Result<i64> {
        ensure!(
            expected_revision >= 0 && files.len() <= 1000,
            "invalid publication bound"
        );
        for path in files.keys() {
            validate_path(path)?;
        }
        if let Some(revision) = self
            .publication_receipt(firm, intent, workspace, expected_revision, files.clone())
            .await?
        {
            return Ok(revision);
        }
        let input =
            json!({"workspace_id":workspace,"expected_revision":expected_revision,"files":files});
        let mut lookup = self.pool.begin().await?;
        self.check_binding(&mut lookup, firm).await?;
        Self::lock_workspace(&mut lookup, firm, workspace).await?;
        let closed: Option<Uuid> =
            sqlx::query_scalar("SELECT closed_by FROM workspaces WHERE firm_id=$1 AND id=$2")
                .bind(firm)
                .bind(workspace)
                .fetch_one(&mut *lookup)
                .await?;
        ensure!(closed.is_none(), "workspace is closed for publication");
        let resolved = self
            .resolve_uploads(&mut lookup, firm, &files, true)
            .await?;
        let pinned = resolved
            .iter()
            .map(|(_, object)| self.pin_reference(object, object.size.max(1)))
            .collect::<Result<Vec<_>>>()?;
        lookup.commit().await?;
        for ((_, object), pin) in resolved.iter().zip(pinned) {
            self.verify_reference(object, pin, object.size.max(1))?;
        }
        let mut tx = self.pool.begin().await?;
        self.check_binding(&mut tx, firm).await?;
        intent_lock(&mut tx, intent).await?;
        let rev: i64 = sqlx::query_scalar(
            "SELECT revision FROM workspaces WHERE firm_id=$1 AND id=$2 FOR UPDATE",
        )
        .bind(firm)
        .bind(workspace)
        .fetch_one(&mut *tx)
        .await?;
        let closed: Option<Uuid> =
            sqlx::query_scalar("SELECT closed_by FROM workspaces WHERE firm_id=$1 AND id=$2")
                .bind(firm)
                .bind(workspace)
                .fetch_one(&mut *tx)
                .await?;
        ensure!(closed.is_none(), "workspace is closed for publication");
        ensure!(
            self.resolve_uploads(&mut tx, firm, &files, true).await? == resolved,
            "publication input receipts changed"
        );
        if let Some(row) = sqlx::query(
            "SELECT input,revision FROM publication_receipts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?
        {
            ensure!(
                row.get::<Value, _>("input") == input,
                "publication identity conflict"
            );
            tx.commit().await?;
            return Ok(row.get("revision"));
        }
        ensure!(rev == expected_revision, "workspace revision conflict");
        let next = rev
            .checked_add(1)
            .ok_or_else(|| anyhow::anyhow!("revision overflow"))?;
        let manifest: BTreeMap<_, _> = resolved
            .iter()
            .map(|(path, object)| {
                (
                    path.clone(),
                    if object.object_id.is_some() {
                        json!(object)
                    } else {
                        json!(object.sha256)
                    },
                )
            })
            .collect();
        sqlx::query("INSERT INTO workspace_snapshots(firm_id,workspace_id,revision,manifest) SELECT firm_id,id,revision,manifest FROM workspaces WHERE firm_id=$1 AND id=$2 ON CONFLICT DO NOTHING")
            .bind(firm).bind(workspace).execute(&mut *tx).await?;
        sqlx::query("UPDATE workspaces SET revision=$3,manifest=$4 WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(workspace)
            .bind(next)
            .bind(json!(manifest))
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO workspace_snapshots(firm_id,workspace_id,revision,manifest,completed_at) VALUES($1,$2,$3,$4,transaction_timestamp())")
            .bind(firm).bind(workspace).bind(next).bind(json!(manifest)).execute(&mut *tx).await?;
        let objects: BTreeSet<_> = resolved
            .iter()
            .filter_map(|(_, object)| object.object_id)
            .collect();
        for object in objects {
            sqlx::query("INSERT INTO revision_object_holds(firm_id,workspace_id,revision,object_id) VALUES($1,$2,$3,$4)")
                .bind(firm).bind(workspace).bind(next).bind(object).execute(&mut *tx).await?;
        }
        sqlx::query("INSERT INTO publication_receipts VALUES($1,$2,$3,$4,$5)")
            .bind(firm)
            .bind(intent)
            .bind(workspace)
            .bind(input)
            .bind(next)
            .execute(&mut *tx)
            .await?;
        self.validate()?;
        tx.commit().await?;
        self.validate()?;
        Ok(next)
    }
}

pub fn validate_path(value: &str) -> Result<()> {
    ensure!(
        !value.is_empty()
            && value.len() <= 1024
            && !value.contains(['\\', '\0'])
            && !value
                .split('/')
                .any(|s| s.is_empty() || s == "." || s == "..")
            && Path::new(value)
                .components()
                .all(|p| matches!(p, Component::Normal(_))),
        "invalid workspace-relative path"
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    #[test]
    fn paths_cannot_escape() {
        for path in [
            "../x",
            "/x",
            "x/../../y",
            "x\\y",
            "x//y",
            "./x",
            "x/./y",
            "",
        ] {
            assert!(super::validate_path(path).is_err(), "{path}");
        }
        assert!(super::validate_path("results/report.json").is_ok());
    }
}
