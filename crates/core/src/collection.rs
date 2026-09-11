use super::workspaces::{config_uuid, namespace};
use super::*;
use ouroboros_contracts::{
    CollectionAdvance, CollectionAdvanceRequest, CollectionBinding, CollectionRecord,
    CollectionRequest, CollectionTicket, ResourceReply, ResourceTicket, RetirementPolicy,
    StorageClaim,
};
use sqlx::postgres::PgRow;

pub(super) struct Admission {
    pub(super) request: CollectionRequest,
    pub(super) binding: CollectionBinding,
    pub(super) policy: RetirementPolicy,
    pub(super) namespace: Uuid,
}

fn step_bounds(cfg: &Value) -> Result<u64> {
    cfg["max_file_bytes"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= i64::MAX as u64)
        .ok_or(Error::Unavailable)?;
    cfg["transfer_seconds"]
        .as_u64()
        .filter(|v| (1..=300).contains(v))
        .ok_or(Error::Unavailable)
}

fn binding(row: &PgRow) -> Result<CollectionBinding> {
    serde_json::from_value(row.get("binding")).map_err(|_| Error::Unavailable)
}

fn policy(row: &PgRow) -> Result<RetirementPolicy> {
    serde_json::from_value(row.get("policy")).map_err(|_| Error::Unavailable)
}

impl Core {
    pub(super) async fn prepare_collection(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        cfg: &Value,
        input: &Value,
    ) -> Result<Admission> {
        let ns = self
            .check_namespace(tx, target, cfg)
            .await?
            .ok_or(Error::Denied)?;
        step_bounds(cfg)?;
        let request: CollectionRequest =
            serde_json::from_value(input.clone()).map_err(|_| Error::Invalid)?;
        let p = super::retirement::policy(cfg)?;
        if request.policy_id != p.id || request.policy_revision != p.revision {
            return Err(Error::Conflict);
        }
        if !p.allowed.iter().any(|v| v == "collect") {
            return Err(Error::Denied);
        }
        if request.upload_id.is_nil()
            || request.reason.is_empty()
            || request.reason.len() > 1024
            || request.reason.trim() != request.reason
            || request.reason.chars().any(char::is_control)
        {
            return Err(Error::Invalid);
        }
        let source = sqlx::query("SELECT r.configuration,r.reply,i.input,i.state,COALESCE(r.completed_at<=clock_timestamp()-make_interval(secs=>$5),false) AS old_enough FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.target_id=$4 AND r.operation='file.upload'")
            .bind(self.firm).bind(request.upload_id).bind(work).bind(target)
            .bind(p.min_retention_seconds as f64).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if source.get::<String, _>("state") != "succeeded" {
            return Err(Error::Conflict);
        }
        // A missing historical completion time cannot prove a positive retention age.
        // An explicitly configured zero interval, as for reference retirement, requires none.
        if p.min_retention_seconds > 0 && !source.get::<bool, _>("old_enough") {
            return Err(Error::Denied);
        }
        let original: Value = source.get("configuration");
        let store_id = config_uuid(cfg, "store_id")?;
        let generation = config_uuid(cfg, "storage_generation")?;
        if namespace(&original)? != Some(ns)
            || config_uuid(&original, "store_id")? != store_id
            || config_uuid(&original, "storage_generation")? != generation
        {
            return Err(Error::Denied);
        }
        let reply: ResourceReply = serde_json::from_value(
            source
                .get::<Option<Value>, _>("reply")
                .ok_or(Error::Denied)?,
        )
        .map_err(|_| Error::Denied)?;
        let original_input: Value = source.get("input");
        let object_id =
            super::upload_completion::validate(request.upload_id, &original_input["input"], &reply)
                .map_err(|_| Error::Denied)?
                .ok_or(Error::Denied)?;
        let sha256 = original_input["input"]["sha256"]
            .as_str()
            .ok_or(Error::Denied)?
            .to_owned();
        let size = original_input["input"]["size"]
            .as_u64()
            .ok_or(Error::Denied)?;
        let allocated: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM storage_allocations WHERE firm_id=$1 AND intent_id=$2 AND store_id=$3 AND generation=$4 AND bytes=$5 AND sha256=$6)")
            .bind(self.firm).bind(request.upload_id).bind(store_id).bind(generation)
            .bind(i64::try_from(size).map_err(|_| Error::Denied)?).bind(&sha256)
            .fetch_one(&mut **tx).await?;
        if !allocated {
            return Err(Error::Denied);
        }
        let retired: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_retirements r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.namespace_id=$4 AND r.kind='upload' AND r.material_id=$5 AND r.source_intent_id=$5 AND i.state='succeeded')")
            .bind(self.firm).bind(work).bind(target).bind(ns).bind(request.upload_id)
            .fetch_one(&mut **tx).await?;
        if !retired {
            return Err(Error::Conflict);
        }
        // Admission never dismisses an unresolved publication because its worker disappeared.
        let pending: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state<>'succeeded' AND EXISTS(SELECT 1 FROM jsonb_each(i.input->'input'->'files') f WHERE f.value=to_jsonb($4::uuid)))")
            .bind(self.firm).bind(work).bind(target).bind(request.upload_id).fetch_one(&mut **tx).await?;
        if pending {
            return Err(Error::Conflict);
        }
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM resource_collections WHERE firm_id=$1 AND upload_id=$2)",
        )
        .bind(self.firm)
        .bind(request.upload_id)
        .fetch_one(&mut **tx)
        .await?;
        if exists {
            return Err(Error::Conflict);
        }
        Ok(Admission {
            binding: CollectionBinding {
                upload_id: request.upload_id,
                object_id,
                store_id,
                generation,
                sha256,
                size,
            },
            request,
            policy: p,
            namespace: ns,
        })
    }

    pub(super) async fn save_collection(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        work: Uuid,
        target: &str,
        a: &Admission,
    ) -> Result<()> {
        sqlx::query("INSERT INTO resource_collections(firm_id,intent_id,work_id,target_id,namespace_id,upload_id,binding,policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(self.firm).bind(intent).bind(work).bind(target).bind(a.namespace)
            .bind(a.request.upload_id).bind(json!(a.binding)).bind(json!(a.policy))
            .execute(&mut **tx).await?;
        Ok(())
    }

    pub(super) async fn collection_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<(CollectionBinding, RetirementPolicy, Uuid)> {
        let row = sqlx::query("SELECT binding,policy,namespace_id FROM resource_collections WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        Ok((binding(&row)?, policy(&row)?, row.get("namespace_id")))
    }

    async fn collection_row(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<PgRow> {
        sqlx::query("SELECT c.*,r.configuration,r.worker_id,r.operation,i.state AS intent_state,i.input FROM resource_collections c JOIN resource_calls r ON(r.firm_id,r.intent_id)=(c.firm_id,c.intent_id) JOIN intents i ON(i.firm_id,i.id)=(c.firm_id,c.intent_id) WHERE c.firm_id=$1 AND c.intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)
    }

    async fn collection_active(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        row: &PgRow,
    ) -> Result<u64> {
        if row.get::<String, _>("operation") != "file.collect" {
            return Err(Error::Denied);
        }
        let cfg: Value = row.get("configuration");
        let target: String = row.get("target_id");
        let current = sqlx::query("SELECT configuration,worker_id FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
            .bind(self.firm).bind(&target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if current.get::<Value, _>("configuration") != cfg
            || current.get::<String, _>("worker_id") != row.get::<String, _>("worker_id")
            || self.check_namespace(tx, &target, &cfg).await? != Some(row.get("namespace_id"))
            || json!(super::retirement::policy(&cfg)?) != row.get::<Value, _>("policy")
        {
            return Err(Error::Denied);
        }
        let b = binding(row)?;
        if b.upload_id != row.get::<Uuid, _>("upload_id")
            || b.store_id != config_uuid(&cfg, "store_id")?
            || b.generation != config_uuid(&cfg, "storage_generation")?
        {
            return Err(Error::Denied);
        }
        step_bounds(&cfg)
    }

    async fn collection_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        row: &PgRow,
        grant: Uuid,
    ) -> Result<()> {
        let work: Uuid = row.get("work_id");
        let target: String = row.get("target_id");
        let ns: Uuid = row.get("namespace_id");
        for action in ["inspect", "file.collect"] {
            self.actor_permission(tx, ctx, grant, work, action).await?;
            self.resource_permission_namespace(
                tx,
                ctx.principal,
                work,
                grant,
                &target,
                action,
                Some(ns),
            )
            .await?;
        }
        Ok(())
    }

    pub async fn collection_advance(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        request: CollectionAdvanceRequest,
    ) -> Result<CollectionAdvance> {
        ouroboros_contracts::request_key(&request.request_key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        self.admission_open(&mut tx).await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let work = request
            .work_id
            .or_else(|| ctx.bound.as_ref().map(|b| b.work))
            .ok_or(Error::Invalid)?;
        let grant = request
            .delegation_id
            .or_else(|| ctx.bound.as_ref().map(|b| b.grant))
            .ok_or(Error::Invalid)?;
        self.actor_permission(&mut tx, &ctx, grant, work, "inspect")
            .await?;
        let row = self.collection_row(&mut tx, intent).await?;
        if row.get::<Uuid, _>("work_id") != work {
            return Err(Error::Denied);
        }
        self.collection_permission(&mut tx, &ctx, &row, grant)
            .await?;
        let seconds = self.collection_active(&mut tx, &row).await?;
        let realm = ctx.realm();
        let input = json!({"work_id":work,"delegation_id":grant});
        let target: String = row.get("target_id");
        if let Some(old) = sqlx::query("SELECT id,sequence,input,state FROM collection_steps WHERE firm_id=$1 AND collection_intent_id=$2 AND principal_id=$3 AND realm=$4 AND request_key=$5")
            .bind(self.firm).bind(intent).bind(ctx.principal).bind(&realm).bind(&request.request_key)
            .fetch_optional(&mut *tx).await? {
            if old.get::<Value, _>("input") != input { return Err(Error::Conflict); }
            let result = CollectionAdvance { intent_id:intent, step_id:old.get("id"), sequence:old.get("sequence"), target, state:old.get("state"), dispatch_allowed:false };
            tx.commit().await?;
            return Ok(result);
        }
        if row.get::<String, _>("state") != "pending"
            || !matches!(
                row.get::<String, _>("intent_state").as_str(),
                "accepted" | "claimed"
            )
        {
            return Err(Error::Conflict);
        }
        let sequence = row
            .get::<i64, _>("last_sequence")
            .checked_add(1)
            .ok_or(Error::Capacity)?;
        let charged = sqlx::query("UPDATE limits SET committed=committed+1 WHERE firm_id=$1 AND id='resource_calls' AND committed<capacity")
            .bind(self.firm).execute(&mut *tx).await?.rows_affected();
        if charged != 1 {
            return Err(Error::Capacity);
        }
        let reserved = sqlx::query("UPDATE reservations SET units=units+1 WHERE firm_id=$1 AND intent_id=$2 AND limit_id='resource_calls' AND NOT settled AND units<9223372036854775807")
            .bind(self.firm).bind(intent).execute(&mut *tx).await?.rows_affected();
        if reserved != 1 {
            return Err(Error::Unavailable);
        }
        let step = Uuid::new_v4();
        let fingerprint = match &actor {
            Actor::Human(c) => Some(c.fingerprint.as_str()),
            Actor::Instance(_) => None,
        };
        sqlx::query("INSERT INTO collection_steps(firm_id,id,collection_intent_id,sequence,principal_id,realm,delegation_id,instance_id,generation,fingerprint,request_key,input,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp()+make_interval(secs=>$13))")
            .bind(self.firm).bind(step).bind(intent).bind(sequence).bind(ctx.principal).bind(&realm).bind(grant)
            .bind(ctx.bound.as_ref().map(|b| b.instance)).bind(ctx.bound.as_ref().map(|b| b.generation))
            .bind(fingerprint).bind(&request.request_key).bind(input).bind(seconds as f64).execute(&mut *tx).await?;
        sqlx::query("UPDATE resource_collections SET current_step_id=$3,last_sequence=$4 WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm).bind(intent).bind(step).bind(sequence).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            ctx.principal,
            "resource.collection_advanced",
            intent,
            json!({"work_id":work,"target":target,"step_id":step,"sequence":sequence}),
        )
        .await?;
        tx.commit().await?;
        Ok(CollectionAdvance {
            intent_id: intent,
            step_id: step,
            sequence,
            target,
            state: "issued".into(),
            dispatch_allowed: true,
        })
    }

    async fn collection_step_authority(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        step: Uuid,
        worker: &str,
        storage: &StorageClaim,
        expected_state: &str,
    ) -> Result<(PgRow, PgRow)> {
        let row = self.collection_row(tx, intent).await?;
        if row.get::<String, _>("state") != "pending"
            || !matches!(
                row.get::<String, _>("intent_state").as_str(),
                "accepted" | "claimed"
            )
            || row.get::<Option<Uuid>, _>("current_step_id") != Some(step)
            || row.get::<String, _>("worker_id") != worker
        {
            return Err(Error::Denied);
        }
        self.collection_active(tx, &row).await?;
        let b = binding(&row)?;
        if storage.firm_id != self.firm
            || storage.store_id != b.store_id
            || storage.generation != b.generation
        {
            return Err(Error::Denied);
        }
        let s = sqlx::query("SELECT *,expires_at>clock_timestamp() AS unexpired FROM collection_steps WHERE firm_id=$1 AND id=$2 AND collection_intent_id=$3")
            .bind(self.firm).bind(step).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if s.get::<String, _>("state") != expected_state || !s.get::<bool, _>("unexpired") {
            return Err(Error::Denied);
        }
        let actor = if let Some(instance) = s.get::<Option<Uuid>, _>("instance_id") {
            let value: Value = sqlx::query_scalar("SELECT binding FROM runtime_instances WHERE firm_id=$1 AND instance_id=$2 AND generation=$3 AND phase='released'")
                .bind(self.firm).bind(instance).bind(s.get::<Option<Uuid>, _>("generation"))
                .fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            Actor::Instance(
                serde_json::from_value(value["peer"].clone()).map_err(|_| Error::Denied)?,
            )
        } else {
            Actor::Human(Caller {
                fingerprint: s
                    .get::<Option<String>, _>("fingerprint")
                    .ok_or(Error::Denied)?,
            })
        };
        let ctx = self.actor_context(tx, &actor).await?;
        if ctx.principal != s.get::<Uuid, _>("principal_id")
            || ctx.realm() != s.get::<String, _>("realm")
            || ctx.bound.as_ref().map(|b| b.instance) != s.get::<Option<Uuid>, _>("instance_id")
            || ctx.bound.as_ref().map(|b| b.generation) != s.get::<Option<Uuid>, _>("generation")
        {
            return Err(Error::Denied);
        }
        self.collection_permission(tx, &ctx, &row, s.get("delegation_id"))
            .await?;
        Ok((row, s))
    }

    pub async fn collection_claim(
        &self,
        intent: Uuid,
        step: Uuid,
        worker: &str,
        storage: &StorageClaim,
    ) -> Result<CollectionTicket> {
        let mut tx = self.fence().await?;
        self.admission_open(&mut tx).await?;
        let (row, s) = self
            .collection_step_authority(&mut tx, intent, step, worker, storage, "issued")
            .await?;
        let attempt = if row.get::<String, _>("intent_state") == "accepted" {
            let id = Uuid::new_v4();
            sqlx::query("INSERT INTO attempts(firm_id,id,intent_id,worker_id,state) VALUES($1,$2,$3,$4,'claimed')")
                .bind(self.firm).bind(id).bind(intent).bind(worker).execute(&mut *tx).await?;
            sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(intent)
                .execute(&mut *tx)
                .await?;
            let changed = sqlx::query(
                "UPDATE outbox SET claimed=true WHERE firm_id=$1 AND intent_id=$2 AND NOT claimed",
            )
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?
            .rows_affected();
            if changed != 1 {
                return Err(Error::Unavailable);
            }
            id
        } else {
            sqlx::query_scalar("SELECT id FROM attempts WHERE firm_id=$1 AND intent_id=$2 AND worker_id=$3 AND state='claimed'")
                .bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?
        };
        let changed = sqlx::query("UPDATE collection_steps SET state='claimed' WHERE firm_id=$1 AND id=$2 AND state='issued' AND expires_at>clock_timestamp()")
            .bind(self.firm)
            .bind(step)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        if changed != 1 {
            return Err(Error::Denied);
        }
        let work: Uuid = row.get("work_id");
        let target: String = row.get("target_id");
        let sequence: i64 = s.get("sequence");
        self.event(&mut tx, s.get("principal_id"), "resource.collection_claimed", intent,
            json!({"work_id":work,"target":target,"attempt_id":attempt,"step_id":step,"sequence":sequence})).await?;
        let input: Value = row.get("input");
        let ticket = CollectionTicket {
            resource: ResourceTicket {
                firm_id: self.firm,
                intent_id: intent,
                attempt_id: attempt,
                work_id: work,
                target,
                operation: "file.collect".into(),
                input: input["input"].clone(),
                configuration: row.get("configuration"),
                workspace: None,
            },
            step_id: step,
            sequence,
            binding: binding(&row)?,
            policy: policy(&row)?,
        };
        tx.commit().await?;
        Ok(ticket)
    }

    pub async fn collection_dispatch(
        &self,
        intent: Uuid,
        step: Uuid,
        worker: &str,
        storage: &StorageClaim,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        self.admission_open(&mut tx).await?;
        let (row, s) = self
            .collection_step_authority(&mut tx, intent, step, worker, storage, "claimed")
            .await?;
        if row.get::<String, _>("intent_state") != "claimed" {
            return Err(Error::Denied);
        }
        let assigned: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM attempts WHERE firm_id=$1 AND intent_id=$2 AND worker_id=$3 AND state='claimed')")
            .bind(self.firm).bind(intent).bind(worker).fetch_one(&mut *tx).await?;
        if !assigned {
            return Err(Error::Denied);
        }
        let changed = sqlx::query("UPDATE collection_steps SET state='dispatched' WHERE firm_id=$1 AND id=$2 AND state='claimed' AND expires_at>clock_timestamp()")
            .bind(self.firm)
            .bind(step)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        if changed != 1 {
            return Err(Error::Denied);
        }
        self.event(&mut tx, s.get("principal_id"), "resource.collection_dispatched", intent,
            json!({"work_id":row.get::<Uuid,_>("work_id"),"target":row.get::<String,_>("target_id"),"step_id":step,"sequence":s.get::<i64,_>("sequence")})).await?;
        tx.commit().await?;
        Ok(())
    }

    /// A busy observation records no physical permit and never refreshes its step.
    pub async fn collection_step_observe(
        &self,
        intent: Uuid,
        step: Uuid,
        worker: &str,
        state: &str,
    ) -> Result<()> {
        if state != "busy" {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row = self.collection_row(&mut tx, intent).await?;
        if row.get::<String, _>("worker_id") != worker {
            return Err(Error::Denied);
        }
        let assigned: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM attempts WHERE firm_id=$1 AND intent_id=$2 AND worker_id=$3)")
            .bind(self.firm).bind(intent).bind(worker).fetch_one(&mut *tx).await?;
        if !assigned {
            return Err(Error::Denied);
        }
        let s = sqlx::query("SELECT principal_id,state,sequence FROM collection_steps WHERE firm_id=$1 AND id=$2 AND collection_intent_id=$3")
            .bind(self.firm).bind(step).bind(intent).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        match s.get::<String, _>("state").as_str() {
            "busy" => {}
            "claimed" => {
                sqlx::query("UPDATE collection_steps SET state='busy' WHERE firm_id=$1 AND id=$2")
                    .bind(self.firm)
                    .bind(step)
                    .execute(&mut *tx)
                    .await?;
                self.event(&mut tx, s.get("principal_id"), "resource.collection_busy", intent,
                    json!({"work_id":row.get::<Uuid,_>("work_id"),"target":row.get::<String,_>("target_id"),"step_id":step,"sequence":s.get::<i64,_>("sequence")})).await?;
            }
            _ => return Err(Error::Denied),
        }
        tx.commit().await?;
        Ok(())
    }

    pub(super) async fn complete_collection(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        record: &CollectionRecord,
    ) -> Result<()> {
        let row = self.collection_row(tx, intent).await?;
        let b = binding(&row)?;
        let p = policy(&row)?;
        if record.intent_id != intent
            || record.binding != b
            || record.policy_id != p.id
            || record.policy_revision != p.revision
            || !matches!(record.confirmation.as_str(), "removed" | "observed_absence")
        {
            return Err(Error::Invalid);
        }
        let issued: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM collection_steps WHERE firm_id=$1 AND collection_intent_id=$2 AND state='dispatched')")
            .bind(self.firm).bind(intent).fetch_one(&mut **tx).await?;
        if !issued {
            return Err(Error::Denied);
        }
        let bytes = i64::try_from(b.size).map_err(|_| Error::Unavailable)?;
        let allocated: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM storage_allocations WHERE firm_id=$1 AND intent_id=$2 AND store_id=$3 AND generation=$4 AND bytes=$5 AND sha256=$6)")
            .bind(self.firm).bind(b.upload_id).bind(b.store_id).bind(b.generation).bind(bytes).bind(&b.sha256)
            .fetch_one(&mut **tx).await?;
        if !allocated {
            return Err(Error::Denied);
        }
        if let Some(old) = row.get::<Option<Value>, _>("record") {
            if old != json!(record) {
                return Err(Error::Conflict);
            }
            let released: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM storage_releases WHERE firm_id=$1 AND upload_intent_id=$2 AND collection_intent_id=$3 AND object_id=$4 AND store_id=$5 AND generation=$6 AND bytes=$7 AND record=$8)")
                .bind(self.firm).bind(b.upload_id).bind(intent).bind(b.object_id).bind(b.store_id).bind(b.generation).bind(bytes).bind(json!(record)).fetch_one(&mut **tx).await?;
            return if released {
                Ok(())
            } else {
                Err(Error::Unavailable)
            };
        }
        if row.get::<String, _>("state") != "pending"
            || row.get::<String, _>("intent_state") != "claimed"
        {
            return Err(Error::Denied);
        }
        let inserted = sqlx::query("INSERT INTO storage_releases(firm_id,upload_intent_id,collection_intent_id,object_id,store_id,generation,bytes,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING")
            .bind(self.firm).bind(b.upload_id).bind(intent).bind(b.object_id).bind(b.store_id).bind(b.generation).bind(bytes).bind(json!(record))
            .execute(&mut **tx).await?.rows_affected();
        if inserted != 1 {
            return Err(Error::Conflict);
        }
        let changed = sqlx::query("UPDATE storage_budgets SET committed_bytes=committed_bytes-$4 WHERE firm_id=$1 AND store_id=$2 AND generation=$3 AND committed_bytes>=$4")
            .bind(self.firm).bind(b.store_id).bind(b.generation).bind(bytes).execute(&mut **tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Unavailable);
        }
        sqlx::query("UPDATE resource_collections SET state='completed',record=$3 WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm).bind(intent).bind(json!(record)).execute(&mut **tx).await?;
        Ok(())
    }
}
