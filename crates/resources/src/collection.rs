//! Bounded collection of exact, retired object generations. No path or age-based sweeper.
use super::*;
use ouroboros_contracts::{CollectionBinding, CollectionRecord, CollectionRequest};
use std::{future::Future, io};
use storage::{CollectionObjectIdentity, CollectionPin};

pub enum CollectionPreparation {
    Ready(Box<PreparedCollection>),
    Completed(CollectionRecord),
    Busy,
}

/// A process-local exclusive FD and its committed marker. It conveys no Core authority.
pub struct PreparedCollection {
    context: Context,
    pin: CollectionPin,
    handle_id: Uuid,
}

#[derive(Clone)]
struct Context {
    firm: Uuid,
    intent: Uuid,
    work: Uuid,
    namespace: Uuid,
    request: CollectionRequest,
    binding: CollectionBinding,
    policy: RetirementPolicy,
}

struct Marker {
    physical: CollectionObjectIdentity,
    state: String,
    record: Option<CollectionRecord>,
}

impl Context {
    #[allow(clippy::too_many_arguments)]
    fn new(
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        request: &CollectionRequest,
        binding: &CollectionBinding,
        policy: &RetirementPolicy,
    ) -> Result<Self> {
        ensure!(
            [
                firm,
                intent,
                work,
                namespace,
                request.upload_id,
                binding.object_id,
                binding.store_id,
                binding.generation,
                policy.id
            ]
            .iter()
            .all(|id| !id.is_nil()),
            "invalid collection identity"
        );
        ensure!(
            request.upload_id == binding.upload_id
                && binding.size <= i64::MAX as u64
                && binding.sha256.len() == 64
                && binding
                    .sha256
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
            "invalid collection object binding"
        );
        ensure!(
            !request.reason.is_empty()
                && request.reason.len() <= 1024
                && request.reason.trim() == request.reason
                && !request.reason.chars().any(char::is_control),
            "invalid collection reason"
        );
        let allowed: BTreeSet<_> = policy.allowed.iter().map(String::as_str).collect();
        ensure!(
            policy.revision > 0
                && policy.revision <= i64::MAX as u64
                && policy.min_retention_seconds <= i32::MAX as u64
                && request.policy_id == policy.id
                && request.policy_revision == policy.revision
                && allowed.len() == policy.allowed.len()
                && allowed.contains("collect")
                && allowed.iter().all(|kind| matches!(
                    *kind,
                    "upload" | "revision" | "workspace_close" | "collect"
                )),
            "collection policy conflict"
        );
        Ok(Self {
            firm,
            intent,
            work,
            namespace,
            request: request.clone(),
            binding: binding.clone(),
            policy: policy.clone(),
        })
    }

    fn input(&self) -> Value {
        json!({"work_id":self.work,"namespace_id":self.namespace,"request":self.request})
    }

    fn record(&self, confirmation: &str) -> CollectionRecord {
        CollectionRecord {
            intent_id: self.intent,
            binding: self.binding.clone(),
            policy_id: self.policy.id,
            policy_revision: self.policy.revision,
            confirmation: confirmation.into(),
        }
    }

    fn physical_matches(&self, physical: &CollectionObjectIdentity) -> bool {
        physical.object_id == self.binding.object_id
            && physical.sha256 == self.binding.sha256
            && physical.size == self.binding.size
    }
}

fn io_kind(error: &anyhow::Error, kind: io::ErrorKind) -> bool {
    error.chain().any(|cause| {
        cause
            .downcast_ref::<io::Error>()
            .is_some_and(|error| error.kind() == kind)
    })
}

impl CatalogWorker {
    async fn collection_transaction(&self, c: &Context) -> Result<Transaction<'_, Postgres>> {
        let mut tx = self.pool.begin().await?;
        // This local profile refuses oversized/unavailable reverse-reference validation.
        sqlx::query("SET LOCAL statement_timeout='5s'")
            .execute(&mut *tx)
            .await?;
        self.check_binding(&mut tx, c.firm).await?;
        let store = self.store.identity();
        ensure!(
            store.store_id == c.binding.store_id && store.generation == c.binding.generation,
            "collection store binding conflict"
        );
        intent_lock(&mut tx, c.intent).await?;
        let row = sqlx::query("SELECT upload_intent_id,store_id,storage_generation,digest,size FROM blob_objects WHERE firm_id=$1 AND object_id=$2 FOR UPDATE")
            .bind(c.firm).bind(c.binding.object_id).fetch_one(&mut *tx).await?;
        ensure!(
            row.get::<Uuid, _>("upload_intent_id") == c.binding.upload_id
                && row.get::<Uuid, _>("store_id") == c.binding.store_id
                && row.get::<Uuid, _>("storage_generation") == c.binding.generation
                && row.get::<String, _>("digest") == c.binding.sha256
                && row.get::<i64, _>("size") == c.binding.size as i64,
            "collection object inventory conflict"
        );
        Ok(tx)
    }

    async fn collection_marker(
        tx: &mut Transaction<'_, Postgres>,
        c: &Context,
    ) -> Result<Option<Marker>> {
        let row = sqlx::query(
            "SELECT * FROM catalog_collections WHERE firm_id=$1 AND (intent_id=$2 OR object_id=$3)",
        )
        .bind(c.firm)
        .bind(c.intent)
        .bind(c.binding.object_id)
        .fetch_all(&mut **tx)
        .await?;
        if row.is_empty() {
            return Ok(None);
        }
        ensure!(
            row.len() == 1,
            "collection identity has conflicting markers"
        );
        let row = &row[0];
        ensure!(
            row.get::<Uuid, _>("intent_id") == c.intent
                && row.get::<Uuid, _>("upload_id") == c.binding.upload_id
                && row.get::<Uuid, _>("object_id") == c.binding.object_id
                && row.get::<Value, _>("input") == c.input()
                && row.get::<Value, _>("binding") == json!(c.binding)
                && row.get::<Value, _>("policy") == json!(c.policy),
            "collection marker identity conflict"
        );
        let physical: CollectionObjectIdentity =
            serde_json::from_value(row.get("physical_identity"))?;
        ensure!(
            c.physical_matches(&physical),
            "collection physical marker conflict"
        );
        let state: String = row.get("state");
        let record = row
            .get::<Option<Value>, _>("record")
            .map(serde_json::from_value::<CollectionRecord>)
            .transpose()?;
        match &record {
            Some(record) => ensure!(
                state == "deleted"
                    && matches!(record.confirmation.as_str(), "removed" | "observed_absence")
                    && *record == c.record(&record.confirmation),
                "collection receipt identity conflict"
            ),
            None => ensure!(state == "deleting", "collection marker state conflict"),
        }
        let object = sqlx::query("SELECT state,upload_intent_id,store_id,storage_generation,digest,size FROM blob_objects WHERE firm_id=$1 AND object_id=$2")
            .bind(c.firm).bind(c.binding.object_id).fetch_one(&mut **tx).await?;
        ensure!(
            object.get::<String, _>("state") == state
                && object.get::<Uuid, _>("upload_intent_id") == c.binding.upload_id
                && object.get::<Uuid, _>("store_id") == c.binding.store_id
                && object.get::<Uuid, _>("storage_generation") == c.binding.generation
                && object.get::<String, _>("digest") == c.binding.sha256
                && object.get::<i64, _>("size") == c.binding.size as i64,
            "collection object/marker state conflict"
        );
        Ok(Some(Marker {
            physical,
            state,
            record,
        }))
    }

    async fn collection_eligible(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        c: &Context,
    ) -> Result<()> {
        let row = sqlx::query("SELECT u.object_id,u.digest,u.size,u.retired_by,h.released_by,($3::bigint=0 OR (u.completed_at IS NOT NULL AND EXTRACT(EPOCH FROM clock_timestamp()-u.completed_at)>=$3::numeric)) AS old_enough FROM uploads u JOIN upload_object_holds h USING(firm_id,intent_id,object_id) WHERE u.firm_id=$1 AND u.intent_id=$2")
            .bind(c.firm).bind(c.binding.upload_id).bind(c.policy.min_retention_seconds as i64).fetch_one(&mut **tx).await?;
        let retired: Option<Uuid> = row.get("retired_by");
        ensure!(
            row.get::<Option<Uuid>, _>("object_id") == Some(c.binding.object_id)
                && row.get::<String, _>("digest") == c.binding.sha256
                && row.get::<i64, _>("size") == c.binding.size as i64
                && retired.is_some()
                && retired == row.get::<Option<Uuid>, _>("released_by")
                && row.get::<bool, _>("old_enough"),
            "collection upload is still held or its retention is unresolved"
        );
        let release = retired.expect("checked retirement");
        Self::check_release_lineage(
            tx,
            c.firm,
            release,
            &RetirementTarget::Upload {
                upload_id: c.binding.upload_id,
            },
        )
        .await?;
        let release_input: Value = sqlx::query_scalar(
            "SELECT input FROM catalog_retirements WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(c.firm)
        .bind(release)
        .fetch_one(&mut **tx)
        .await?;
        ensure!(
            release_input["work_id"] == json!(c.work)
                && release_input["namespace_id"] == json!(c.namespace),
            "collection upload owner scope conflict"
        );

        let holds: Vec<(Uuid,i64,Option<Uuid>)> = sqlx::query_as("SELECT workspace_id,revision,released_by FROM revision_object_holds WHERE firm_id=$1 AND object_id=$2 ORDER BY workspace_id,revision LIMIT 1001")
            .bind(c.firm).bind(c.binding.object_id).fetch_all(&mut **tx).await?;
        ensure!(
            holds.len() <= 1000 && holds.iter().all(|(_, _, release)| release.is_some()),
            "collection has active or excessive retained revision holds"
        );
        // Existing hold rows alone cannot detect a missing hold after inconsistent metadata restore.
        let snapshots = sqlx::query("SELECT s.workspace_id,s.revision,s.manifest,s.retired_by FROM workspace_snapshots s WHERE s.firm_id=$1 AND EXISTS(SELECT 1 FROM jsonb_each(s.manifest) e WHERE (e.value->>'object_id')::uuid=$2) ORDER BY s.workspace_id,s.revision LIMIT 1001")
            .bind(c.firm).bind(c.binding.object_id).fetch_all(&mut **tx).await?;
        ensure!(
            snapshots.len() <= 1000 && snapshots.len() == holds.len(),
            "collection reverse-reference inventory conflict"
        );
        for (snapshot, (workspace, revision, release)) in snapshots.iter().zip(holds) {
            ensure!(
                snapshot.get::<Uuid, _>("workspace_id") == workspace
                    && snapshot.get::<i64, _>("revision") == revision
                    && snapshot.get::<Option<Uuid>, _>("retired_by") == release,
                "collection revision reference is unresolved"
            );
            let manifest: Value = snapshot.get("manifest");
            let entries = manifest
                .as_object()
                .ok_or_else(|| anyhow::anyhow!("invalid retained manifest"))?;
            ensure!(entries.len() <= 1000, "collection manifest exceeds bound");
            let mut matched = false;
            for value in entries.values() {
                if value
                    .get("object_id")
                    .and_then(Value::as_str)
                    .and_then(|id| Uuid::parse_str(id).ok())
                    == Some(c.binding.object_id)
                {
                    let object: StoredBlob = serde_json::from_value(value.clone())?;
                    ensure!(
                        object.sha256 == c.binding.sha256 && object.size == c.binding.size,
                        "collection manifest object identity conflict"
                    );
                    matched = true;
                }
            }
            ensure!(matched, "collection reverse reference has no exact object");
            Self::check_revision_hold_lineage(tx, c.firm, workspace, revision, c.binding.object_id)
                .await?;
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn prepare_collection(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        request: &CollectionRequest,
        binding: &CollectionBinding,
        policy: &RetirementPolicy,
    ) -> Result<CollectionPreparation> {
        let c = Context::new(firm, intent, work, namespace, request, binding, policy)?;
        let mut tx = self.collection_transaction(&c).await?;
        let marker = Self::collection_marker(&mut tx, &c).await?;
        if let Some(record) = marker.as_ref().and_then(|m| m.record.clone()) {
            tx.commit().await?;
            return Ok(CollectionPreparation::Completed(record));
        }
        let state: String =
            sqlx::query_scalar("SELECT state FROM blob_objects WHERE firm_id=$1 AND object_id=$2")
                .bind(firm)
                .bind(binding.object_id)
                .fetch_one(&mut *tx)
                .await?;
        ensure!(
            (marker.is_none() && state == "verified") || (marker.is_some() && state == "deleting"),
            "object is not eligible for collection preparation"
        );
        self.collection_eligible(&mut tx, &c).await?;
        let pin = self.store.pin_collection(
            binding.object_id,
            &binding.sha256,
            binding.size,
            binding.size.max(1),
        );
        let mut pin = match pin {
            Ok(pin) => pin,
            Err(error) if io_kind(&error, io::ErrorKind::WouldBlock) => {
                tx.commit().await?;
                return Ok(CollectionPreparation::Busy);
            }
            Err(error) if io_kind(&error, io::ErrorKind::NotFound) && marker.is_some() => {
                tx.commit().await?;
                let record = self
                    .collection_receipt(firm, intent, work, namespace, request, binding, policy)
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("collection absence remains unconfirmed"))?;
                return Ok(CollectionPreparation::Completed(record));
            }
            Err(error) => return Err(error),
        };
        if let Some(marker) = &marker {
            ensure!(
                marker.physical == *pin.identity(),
                "collection physical object was replaced"
            );
        }
        tx.commit().await?;
        self.store.verify_collection(&mut pin)?;
        // The same exclusive FD survives hashing and this second metadata transaction.
        let mut tx = self.collection_transaction(&c).await?;
        let marker = Self::collection_marker(&mut tx, &c).await?;
        if let Some(marker) = &marker {
            ensure!(
                marker.state == "deleting" && marker.physical == *pin.identity(),
                "collection marker changed while verifying"
            );
        }
        self.collection_eligible(&mut tx, &c).await?;
        if marker.is_none() {
            let changed = sqlx::query("UPDATE blob_objects SET state='deleting' WHERE firm_id=$1 AND object_id=$2 AND state='verified'")
                .bind(firm).bind(binding.object_id).execute(&mut *tx).await?;
            ensure!(
                changed.rows_affected() == 1,
                "collection marking state conflict"
            );
            sqlx::query("INSERT INTO catalog_collections(firm_id,intent_id,upload_id,object_id,input,binding,policy,physical_identity,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'deleting')")
                .bind(firm).bind(intent).bind(binding.upload_id).bind(binding.object_id).bind(c.input()).bind(json!(binding)).bind(json!(policy)).bind(json!(pin.identity())).execute(&mut *tx).await?;
        }
        self.validate()?;
        tx.commit().await?;
        Ok(CollectionPreparation::Ready(Box::new(PreparedCollection {
            context: c,
            pin,
            handle_id: self.handle_id,
        })))
    }

    pub async fn advance_collection<F, Fut>(
        &self,
        prepared: PreparedCollection,
        authorize: F,
    ) -> Result<CollectionRecord>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<()>>,
    {
        ensure!(
            prepared.handle_id == self.handle_id,
            "collection handle belongs to another worker"
        );
        let c = prepared.context;
        let mut tx = self.collection_transaction(&c).await?;
        let marker = Self::collection_marker(&mut tx, &c)
            .await?
            .ok_or_else(|| anyhow::anyhow!("collection marker missing"))?;
        if let Some(record) = marker.record {
            tx.commit().await?;
            return Ok(record);
        }
        ensure!(
            marker.physical == *prepared.pin.identity(),
            "collection handle/marker identity conflict"
        );
        self.collection_eligible(&mut tx, &c).await?;
        tx.commit().await?;
        // The callback must check the current Core step immediately before this destructive call.
        // No database transaction is held across the callback or filesystem synchronization.
        authorize().await?;
        self.store.remove_collection(prepared.pin)?;
        let mut tx = self.collection_transaction(&c).await?;
        let record = Self::finish_collection(&mut tx, &c, "removed").await?;
        tx.commit().await?;
        Ok(record)
    }

    async fn finish_collection(
        tx: &mut Transaction<'_, Postgres>,
        c: &Context,
        confirmation: &str,
    ) -> Result<CollectionRecord> {
        let marker = Self::collection_marker(tx, c)
            .await?
            .ok_or_else(|| anyhow::anyhow!("collection marker missing"))?;
        if let Some(record) = marker.record {
            return Ok(record);
        }
        let record = c.record(confirmation);
        let changed = sqlx::query("UPDATE blob_objects SET state='deleted' WHERE firm_id=$1 AND object_id=$2 AND state='deleting'")
            .bind(c.firm).bind(c.binding.object_id).execute(&mut **tx).await?;
        ensure!(
            changed.rows_affected() == 1,
            "collection completion state conflict"
        );
        let changed = sqlx::query("UPDATE catalog_collections SET state='deleted',record=$3,completed_at=clock_timestamp() WHERE firm_id=$1 AND intent_id=$2 AND state='deleting' AND record IS NULL")
            .bind(c.firm).bind(c.intent).bind(json!(record)).execute(&mut **tx).await?;
        ensure!(
            changed.rows_affected() == 1,
            "collection receipt commit conflict"
        );
        Ok(record)
    }

    /// Observe the first receipt, or reconcile verified absence under an existing durable marker.
    /// This path never establishes a marker, obtains deletion authority, or unlinks a file.
    #[allow(clippy::too_many_arguments)]
    pub async fn collection_receipt(
        &self,
        firm: Uuid,
        intent: Uuid,
        work: Uuid,
        namespace: Uuid,
        request: &CollectionRequest,
        binding: &CollectionBinding,
        policy: &RetirementPolicy,
    ) -> Result<Option<CollectionRecord>> {
        let c = Context::new(firm, intent, work, namespace, request, binding, policy)?;
        let mut tx = self.collection_transaction(&c).await?;
        let Some(marker) = Self::collection_marker(&mut tx, &c).await? else {
            tx.commit().await?;
            return Ok(None);
        };
        if let Some(record) = marker.record {
            tx.commit().await?;
            return Ok(Some(record));
        }
        self.collection_eligible(&mut tx, &c).await?;
        if !self.store.confirm_collection_absence(binding.object_id)? {
            tx.commit().await?;
            return Ok(None);
        }
        let record = Self::finish_collection(&mut tx, &c, "observed_absence").await?;
        tx.commit().await?;
        Ok(Some(record))
    }

    pub(super) async fn check_collection_history(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        firm: Uuid,
        object: &StoredBlob,
        state: &str,
    ) -> Result<()> {
        let object_id = object
            .object_id
            .ok_or_else(|| anyhow::anyhow!("legacy object has no collection history"))?;
        let row = sqlx::query("SELECT intent_id,input,binding,policy FROM catalog_collections WHERE firm_id=$1 AND object_id=$2")
            .bind(firm).bind(object_id).fetch_one(&mut **tx).await?;
        let input: Value = row.get("input");
        let request: CollectionRequest = serde_json::from_value(input["request"].clone())?;
        let binding: CollectionBinding = serde_json::from_value(row.get("binding"))?;
        let policy: RetirementPolicy = serde_json::from_value(row.get("policy"))?;
        let c = Context::new(
            firm,
            row.get("intent_id"),
            serde_json::from_value(input["work_id"].clone())?,
            serde_json::from_value(input["namespace_id"].clone())?,
            &request,
            &binding,
            &policy,
        )?;
        ensure!(
            binding.object_id == object_id
                && binding.sha256 == object.sha256
                && binding.size == object.size,
            "historical collection object conflict"
        );
        let marker = Self::collection_marker(tx, &c)
            .await?
            .ok_or_else(|| anyhow::anyhow!("historical collection marker missing"))?;
        ensure!(
            marker.state == state && (state != "deleted" || marker.record.is_some()),
            "historical collection receipt missing"
        );
        Ok(())
    }
}
