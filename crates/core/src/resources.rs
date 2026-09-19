use super::workspaces::namespace;
use super::*;
use ouroboros_contracts::{
    ResourceAdmission, ResourceReply, ResourceRequest, ResourceTicket, UploadDescriptor,
};
use sqlx::postgres::PgRow;

fn transfer_bounds(configuration: &Value) -> Result<(u64, u64)> {
    let bytes = configuration["max_file_bytes"]
        .as_u64()
        .filter(|n| *n > 0 && *n <= i64::MAX as u64)
        .ok_or(Error::Unavailable)?;
    let seconds = configuration["transfer_seconds"]
        .as_u64()
        .filter(|n| (1..=300).contains(n))
        .ok_or(Error::Unavailable)?;
    Ok((bytes, seconds))
}
fn valid_digest(digest: &str) -> bool {
    digest.len() == 64
        && digest
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn upload_descriptor(
    operation: &str,
    input: &Value,
    configuration: &Value,
) -> Result<Option<UploadDescriptor>> {
    if operation != "file.upload" {
        return Ok(None);
    }
    // Legacy metadata stays inspectable but does not acquire a fresh transfer window.
    let Ok((max, timeout_seconds)) = transfer_bounds(configuration) else {
        return Ok(None);
    };
    let size = input["size"]
        .as_u64()
        .filter(|n| *n <= max)
        .ok_or(Error::Unavailable)?;
    let sha256 = input["sha256"]
        .as_str()
        .filter(|v| valid_digest(v))
        .ok_or(Error::Unavailable)?
        .into();
    Ok(Some(UploadDescriptor {
        sha256,
        size,
        timeout_seconds,
    }))
}
impl Core {
    pub(super) async fn resource_actor(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &ResourceActor,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<(Uuid, Uuid, Uuid, Option<Uuid>)> {
        let ctx = self.actor_context(tx, actor).await?;
        let w = work
            .or_else(|| ctx.bound.as_ref().map(|b| b.work))
            .ok_or(Error::Invalid)?;
        let d = grant
            .or_else(|| ctx.bound.as_ref().map(|b| b.grant))
            .ok_or(Error::Invalid)?;
        self.actor_permission(tx, &ctx, d, w, "inspect").await?;
        Ok((ctx.principal, w, d, ctx.bound.as_ref().map(|b| b.instance)))
    }
    pub(super) async fn resource_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        work: Uuid,
        grant: Uuid,
        target: &str,
        op: &str,
    ) -> Result<()> {
        self.resource_permission_namespace(tx, p, work, grant, target, op, None)
            .await
    }
    #[allow(clippy::too_many_arguments)]
    pub(super) async fn resource_permission_namespace(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        work: Uuid,
        grant: Uuid,
        target: &str,
        op: &str,
        namespace: Option<Uuid>,
    ) -> Result<()> {
        self.authorize(tx, p, grant, op).await?;
        self.grant_work_scope(tx, grant, work).await?;
        let allowed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_scopes WHERE firm_id=$1 AND work_id=$2 AND delegation_id=$3 AND target_id=$4 AND $5=ANY(operations) AND namespace_id IS NOT DISTINCT FROM $6)").bind(self.firm).bind(work).bind(grant).bind(target).bind(op).bind(namespace).fetch_one(&mut **tx).await?;
        if !allowed {
            return Err(Error::Denied);
        }
        // Delegation attenuates target scope as well as actions. An internal server cannot
        // turn a parent's unrelated resource scope into authority over this target.
        let scoped: bool = sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.id,d.parent_id FROM delegations d JOIN chain c ON d.id=c.parent_id WHERE d.firm_id=$1) SELECT NOT EXISTS(SELECT 1 FROM chain c WHERE NOT EXISTS(SELECT 1 FROM resource_scopes s WHERE s.firm_id=$1 AND s.work_id=$3 AND s.delegation_id=c.id AND s.target_id=$4 AND $5=ANY(s.operations) AND s.namespace_id IS NOT DISTINCT FROM $6))")
            .bind(self.firm).bind(grant).bind(work).bind(target).bind(op).bind(namespace).fetch_one(&mut **tx).await?;
        if scoped { Ok(()) } else { Err(Error::Denied) }
    }
    pub async fn resource_admit(
        &self,
        actor: ResourceActor,
        mut request: ResourceRequest,
    ) -> Result<ResourceAdmission> {
        let mut tx = self.fence().await?;
        let ctx = self.authenticated_actor_context(&mut tx, &actor).await?;
        let effect = self
            .prepare_service_effect(&mut tx, &ctx, &mut request)
            .await?;
        let admitted = self
            .resource_admit_locked(&mut tx, &actor, &ctx, request)
            .await?;
        if let Some((root, slot, fingerprint)) = effect {
            // Core's firm fence serializes slot binding with the existing single reservation.
            let changed = sqlx::query(
                "INSERT INTO service_effects VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
            )
            .bind(self.firm)
            .bind(root)
            .bind(&slot)
            .bind(admitted.intent_id)
            .bind(&fingerprint)
            .execute(&mut *tx)
            .await?
            .rows_affected();
            let same: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM service_effects WHERE firm_id=$1 AND root_intent_id=$2 AND effect_slot=$3 AND child_intent_id=$4 AND input_fingerprint=$5)")
                .bind(self.firm).bind(root).bind(&slot).bind(admitted.intent_id).bind(&fingerprint)
                .fetch_one(&mut *tx).await?;
            if !same {
                return Err(Error::Conflict);
            }
            if changed == 1 {
                self.event(&mut tx, ctx.principal, "service.effect_bound", admitted.intent_id,
                    json!({"work_id":ctx.bound.as_ref().map(|b| b.work),"root_intent_id":root,"effect_slot":slot,"input_fingerprint":fingerprint})).await?;
            }
        }
        tx.commit().await?;
        Ok(admitted)
    }
    pub(super) async fn resource_admit_locked(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &ResourceActor,
        ctx: &ActorContext,
        request: ResourceRequest,
    ) -> Result<ResourceAdmission> {
        ouroboros_contracts::request_key(&request.request_key).map_err(|_| Error::Invalid)?;
        if !matches!(
            request.operation.as_str(),
            "workspace.create"
                | "file.read"
                | "file.upload"
                | "file.publish"
                | "file.retire"
                | "file.collect"
                | "db.read"
                | "db.write"
                | "model.responses"
                | "credential.enroll"
                | "credential.disable"
                | "mcp"
        ) {
            return Err(Error::Invalid);
        }
        if matches!(
            request.operation.as_str(),
            "credential.enroll" | "credential.disable"
        ) {
            // This is admission metadata, never the credential transfer body. Validate
            // before any intent/replay persistence so extra fields cannot enter history.
            let fields = request.input.as_object().ok_or(Error::Invalid)?;
            let identities: &[&str] = if request.operation == "credential.enroll" {
                &["credential_id", "enrollment_id"]
            } else {
                &["credential_id"]
            };
            if fields.len() != identities.len() + 1
                || !fields.contains_key("version")
                || !identities.iter().all(|key| fields.contains_key(*key))
            {
                return Err(Error::Invalid);
            }
            for &key in identities {
                let id = fields[key]
                    .as_str()
                    .and_then(|value| Uuid::parse_str(value).ok())
                    .filter(|id| !id.is_nil())
                    .ok_or(Error::Invalid)?;
                if fields[key].as_str() != Some(id.to_string().as_str()) {
                    return Err(Error::Invalid);
                }
            }
            fields["version"]
                .as_u64()
                .filter(|version| *version > 0 && *version <= i64::MAX as u64)
                .ok_or(Error::Invalid)?;
        }
        let work = request
            .work_id
            .or_else(|| ctx.bound.as_ref().map(|b| b.work))
            .ok_or(Error::Invalid)?;
        let grant = request
            .delegation_id
            .or_else(|| ctx.bound.as_ref().map(|b| b.grant))
            .ok_or(Error::Invalid)?;
        self.actor_permission(tx, ctx, grant, work, "inspect")
            .await?;
        let p = ctx.principal;
        let instance = ctx.bound.as_ref().map(|b| b.instance);
        let fixed = json!({"work_id":work,"target":request.target,"operation":request.operation,"input":request.input});
        let existing=sqlx::query("SELECT i.id,i.input,i.state,r.reply,r.delegation_id,r.instance_id,r.work_id,r.target_id,r.configuration FROM intents i JOIN resource_calls r ON (r.firm_id,r.intent_id)=(i.firm_id,i.id) WHERE i.firm_id=$1 AND i.principal_id=$2 AND i.operation=$3 AND i.request_key=$4")
            .bind(self.firm).bind(p).bind(&request.operation).bind(&request.request_key).fetch_optional(&mut **tx).await?;
        if let Some(r) = existing {
            let old_work = r.get("work_id");
            let old_target: String = r.get("target_id");
            self.actor_permission(tx, ctx, grant, old_work, "inspect")
                .await?;
            self.resource_permission_namespace(
                tx,
                p,
                old_work,
                grant,
                &old_target,
                "inspect",
                namespace(&r.get::<Value, _>("configuration"))?,
            )
            .await?;
            if r.get::<Value, _>("input") != fixed {
                return Err(Error::Conflict);
            }
            if r.get::<String, _>("state") == "accepted" {
                if r.get::<Uuid, _>("delegation_id") != grant
                    || r.get::<Option<Uuid>, _>("instance_id") != instance
                {
                    return Err(Error::Denied);
                }
                self.resource_permission_namespace(
                    tx,
                    p,
                    work,
                    grant,
                    &request.target,
                    &request.operation,
                    namespace(&r.get::<Value, _>("configuration"))?,
                )
                .await?;
            }
            let workspace = self
                .workspace_binding(
                    tx,
                    r.get("id"),
                    old_work,
                    &old_target,
                    &request.operation,
                    &request.input,
                    &r.get::<Value, _>("configuration"),
                    false,
                )
                .await?;
            return Ok(ResourceAdmission {
                workspace,
                upload: upload_descriptor(
                    &request.operation,
                    &request.input,
                    &r.get::<Value, _>("configuration"),
                )?,
                operation: request.operation,
                intent_id: r.get("id"),
                state: r.get("state"),
                target: request.target,
                reply: r
                    .get::<Option<Value>, _>("reply")
                    .map(serde_json::from_value)
                    .transpose()
                    .map_err(|_| Error::Unavailable)?,
            });
        }
        self.admission_open(tx).await?;
        let target =
            sqlx::query("SELECT * FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
                .bind(self.firm)
                .bind(&request.target)
                .fetch_optional(&mut **tx)
                .await?
                .ok_or(Error::Denied)?;
        if serde_json::to_vec(&request.input)
            .map_err(|_| Error::Invalid)?
            .len() as i64
            > target.get::<i64, _>("max_bytes")
        {
            return Err(Error::Invalid);
        }
        let configuration: Value = target.get("configuration");
        let ns = self
            .check_namespace(tx, &request.target, &configuration)
            .await?;
        if ns.is_some()
            && !matches!(
                request.operation.as_str(),
                "workspace.create"
                    | "file.read"
                    | "file.upload"
                    | "file.publish"
                    | "file.retire"
                    | "file.collect"
            )
        {
            return Err(Error::Denied);
        }
        self.resource_permission_namespace(
            tx,
            p,
            work,
            grant,
            &request.target,
            &request.operation,
            ns,
        )
        .await?;
        if request.operation == "workspace.create" && ns.is_none() {
            return Err(Error::Denied);
        }
        if request.operation != "workspace.create" {
            self.workspace_binding(
                tx,
                Uuid::nil(),
                work,
                &request.target,
                &request.operation,
                &request.input,
                &configuration,
                true,
            )
            .await?;
        }
        if ns.is_some() {
            self.reference_barriers(
                tx,
                work,
                &request.target,
                &request.operation,
                &request.input,
            )
            .await?;
        }
        let retirement = if request.operation == "file.retire" {
            Some(
                self.prepare_retirement(tx, work, &request.target, &configuration, &request.input)
                    .await?,
            )
        } else {
            None
        };
        let collection = if request.operation == "file.collect" {
            Some(
                self.prepare_collection(tx, work, &request.target, &configuration, &request.input)
                    .await?,
            )
        } else {
            None
        };
        let transfer = if matches!(request.operation.as_str(), "file.upload" | "file.read") {
            Some(transfer_bounds(&configuration)?)
        } else {
            None
        };
        let upload = if request.operation == "file.upload" {
            let fields = request.input.as_object().ok_or(Error::Invalid)?;
            if fields.len() != 2 || !fields.contains_key("size") || !fields.contains_key("sha256") {
                return Err(Error::Invalid);
            }
            let bytes = request
                .input
                .get("size")
                .and_then(Value::as_u64)
                .filter(|bytes| *bytes <= transfer.expect("upload bounds checked").0)
                .ok_or(Error::Invalid)? as i64;
            let digest = request
                .input
                .get("sha256")
                .and_then(Value::as_str)
                .filter(|digest| {
                    digest.len() == 64
                        && digest
                            .bytes()
                            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
                })
                .ok_or(Error::Invalid)?;
            let store = configuration["store_id"]
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
                .ok_or(Error::Unavailable)?;
            let generation = configuration["storage_generation"]
                .as_str()
                .and_then(|value| Uuid::parse_str(value).ok())
                .ok_or(Error::Unavailable)?;
            // The firm fence orders this with authority changes. The conditional
            // UPDATE also locks the shared store row; target aliases cannot each
            // spend a copy of the budget. Any later failure rolls this back.
            let reserved = sqlx::query("UPDATE storage_budgets SET committed_bytes=committed_bytes+$4 WHERE firm_id=$1 AND store_id=$2 AND generation=$3 AND $4<=capacity_bytes-committed_bytes")
                .bind(self.firm).bind(store).bind(generation).bind(bytes)
                .execute(&mut **tx).await?.rows_affected();
            if reserved != 1 {
                return Err(Error::Capacity);
            }
            Some((store, generation, bytes, digest))
        } else {
            None
        };
        if request.operation == "file.publish" {
            self.publication_order(tx, None, &configuration, &request.input)
                .await?;
            let uploads = request
                .input
                .get("files")
                .and_then(Value::as_object)
                .ok_or(Error::Invalid)?;
            for upload in uploads.values() {
                let id = Uuid::parse_str(upload.as_str().ok_or(Error::Invalid)?)
                    .map_err(|_| Error::Invalid)?;
                let ok:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.target_id=$4 AND r.operation='file.upload' AND i.state='succeeded' AND r.configuration->'namespace_id' IS NOT DISTINCT FROM $5 AND r.configuration->'store_id'=$6 AND r.configuration->'storage_generation'=$7)").bind(self.firm).bind(id).bind(work).bind(&request.target).bind(configuration.get("namespace_id")).bind(&configuration["store_id"]).bind(&configuration["storage_generation"]).fetch_one(&mut **tx).await?;
                if !ok {
                    return Err(Error::Denied);
                }
            }
        }
        let n=sqlx::query("UPDATE limits SET committed=committed+1 WHERE firm_id=$1 AND id='resource_calls' AND committed<capacity").bind(self.firm).execute(&mut **tx).await?.rows_affected();
        if n != 1 {
            return Err(Error::Capacity);
        }
        let intent = Uuid::new_v4();
        sqlx::query("INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,delegation_id,state) VALUES($1,$2,$3,$4,$5,$6,$2,$7,'accepted')").bind(self.firm).bind(intent).bind(p).bind(&request.operation).bind(&request.request_key).bind(fixed).bind(grant).execute(&mut **tx).await?;
        sqlx::query("INSERT INTO resource_calls VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)")
            .bind(self.firm)
            .bind(intent)
            .bind(work)
            .bind(grant)
            .bind(&request.target)
            .bind(instance)
            .bind(&request.operation)
            .bind(&configuration)
            .bind(target.get::<String, _>("worker_id"))
            .execute(&mut **tx)
            .await?;
        self.reserve_connection_call(tx, &request.target, work, &request.operation, intent)
            .await?;
        if let Some(retirement) = &retirement {
            self.save_retirement(tx, intent, work, &request.target, retirement)
                .await?;
        }
        let workspace = if request.operation == "workspace.create" {
            Some(
                self.allocate_workspace(
                    tx,
                    intent,
                    work,
                    &request.target,
                    &configuration,
                    &request.input,
                )
                .await?,
            )
        } else {
            self.workspace_binding(
                tx,
                intent,
                work,
                &request.target,
                &request.operation,
                &request.input,
                &configuration,
                true,
            )
            .await?
        };
        if let Some((_, seconds)) = transfer {
            let origin_fingerprint = actor.human_fingerprint();
            sqlx::query("INSERT INTO resource_transfers(firm_id,intent_id,expires_at,origin_fingerprint) VALUES($1,$2,clock_timestamp()+make_interval(secs=>$3),$4)")
                .bind(self.firm).bind(intent).bind(seconds as f64).bind(origin_fingerprint).execute(&mut **tx).await?;
        }
        if request.operation == "model.responses" && configuration.get("timeout_ms").is_some() {
            let ms = configuration["timeout_ms"]
                .as_u64()
                .filter(|v| (1..=30000).contains(v))
                .ok_or(Error::Invalid)?;
            let origin = actor.human_fingerprint();
            // Fixed delivery window includes bounded receipt/completion overhead, never a
            // renewable lease. No current stream may outlive this original admission window.
            sqlx::query("INSERT INTO resource_transfers(firm_id,intent_id,expires_at,origin_fingerprint) VALUES($1,$2,clock_timestamp()+make_interval(secs=>$3),$4)")
                .bind(self.firm).bind(intent).bind(ms as f64/1000.0+5.0).bind(origin).execute(&mut **tx).await?;
        }
        if request.operation == "credential.enroll" {
            let origin = actor.human_fingerprint();
            sqlx::query("INSERT INTO resource_transfers(firm_id,intent_id,expires_at,origin_fingerprint) VALUES($1,$2,clock_timestamp()+interval '5 minutes',$3)")
                .bind(self.firm).bind(intent).bind(origin).execute(&mut **tx).await?;
        }
        if let Some((store, generation, bytes, digest)) = upload {
            sqlx::query("INSERT INTO storage_allocations(firm_id,intent_id,store_id,generation,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(self.firm).bind(intent).bind(store).bind(generation).bind(bytes).bind(digest)
                .execute(&mut **tx).await?;
        }
        if let Some(collection) = &collection {
            self.save_collection(tx, intent, work, &request.target, collection)
                .await?;
        }
        sqlx::query("INSERT INTO reservations VALUES($1,$2,'resource_calls',1,false)")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut **tx)
            .await?;
        sqlx::query("INSERT INTO outbox VALUES($1,$2,false)")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut **tx)
            .await?;
        sqlx::query("UPDATE intents SET work_id=$3,origin_instance_id=$4,origin_generation=(SELECT generation FROM runtime_instances WHERE firm_id=$1 AND instance_id=$4) WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .bind(work)
            .bind(instance)
            .execute(&mut **tx)
            .await?;
        self.event(tx,p,"resource.accepted",intent,json!({"work_id":work,"instance_id":instance,"operation":request.operation,"target":request.target})).await?;
        Ok(ResourceAdmission {
            workspace,
            upload: upload_descriptor(&request.operation, &request.input, &configuration)?,
            operation: request.operation,
            intent_id: intent,
            state: "accepted".into(),
            target: request.target,
            reply: None,
        })
    }
    pub async fn resource_lookup(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<ResourceAdmission> {
        let mut tx = self.fence().await?;
        let (p, w, d, _) = self
            .resource_actor_for_intent(&mut tx, &actor, intent, work, grant)
            .await?;
        let row=sqlx::query("SELECT r.target_id,r.operation,r.reply,r.configuration,i.state,i.input FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3").bind(self.firm).bind(intent).bind(w).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let target: String = row.get("target_id");
        self.resource_permission_namespace(
            &mut tx,
            p,
            w,
            d,
            &target,
            "inspect",
            namespace(&row.get::<Value, _>("configuration"))?,
        )
        .await?;
        let workspace = self
            .workspace_binding(
                &mut tx,
                intent,
                w,
                &target,
                &row.get::<String, _>("operation"),
                &row.get::<Value, _>("input")["input"],
                &row.get::<Value, _>("configuration"),
                false,
            )
            .await?;
        Ok(ResourceAdmission {
            workspace,
            upload: upload_descriptor(
                &row.get::<String, _>("operation"),
                &row.get::<Value, _>("input")["input"],
                &row.get::<Value, _>("configuration"),
            )?,
            operation: row.get("operation"),
            intent_id: intent,
            state: row.get("state"),
            target,
            reply: row
                .get::<Option<Value>, _>("reply")
                .map(serde_json::from_value)
                .transpose()
                .map_err(|_| Error::Unavailable)?,
        })
    }
    pub async fn resource_upload_ready(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
        digest: &str,
        size: u64,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        let (p, w, d, instance) = self.resource_actor(&mut tx, &actor, work, grant).await?;
        let row=sqlx::query("SELECT i.principal_id,i.input,r.delegation_id,r.instance_id,r.target_id,r.configuration FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) JOIN storage_allocations s ON (s.firm_id,s.intent_id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.operation='file.upload' AND i.state='accepted' AND EXISTS(SELECT 1 FROM resource_transfers x WHERE x.firm_id=r.firm_id AND x.intent_id=r.intent_id AND x.expires_at>clock_timestamp()) AND to_jsonb(s.bytes)=i.input->'input'->'size' AND to_jsonb(s.sha256)=i.input->'input'->'sha256' AND to_jsonb(s.store_id)=r.configuration->'store_id' AND to_jsonb(s.generation)=r.configuration->'storage_generation'")
            .bind(self.firm).bind(intent).bind(w).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        if row.get::<Uuid, _>("principal_id") != p
            || row.get::<Uuid, _>("delegation_id") != d
            || row.get::<Option<Uuid>, _>("instance_id") != instance
        {
            return Err(Error::Denied);
        }
        self.check_transfer_origin(&mut tx, &actor, intent).await?;
        let input: Value = row.get("input");
        if input["input"]["sha256"].as_str() != Some(digest)
            || input["input"]["size"].as_u64() != Some(size)
        {
            return Err(Error::Conflict);
        }
        self.resource_permission_namespace(
            &mut tx,
            p,
            w,
            d,
            &row.get::<String, _>("target_id"),
            "file.upload",
            namespace(&row.get::<Value, _>("configuration"))?,
        )
        .await?;
        Ok(())
    }
    async fn check_transfer_origin(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &ResourceActor,
        intent: Uuid,
    ) -> Result<()> {
        let origin: Option<String> = sqlx::query_scalar("SELECT origin_fingerprint FROM resource_transfers WHERE firm_id=$1 AND intent_id=$2 AND expires_at>clock_timestamp()")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let actual = actor.human_fingerprint();
        if origin.as_deref() != actual {
            return Err(Error::Denied);
        }
        Ok(())
    }
    /// Gateway-side permission for remaining file bytes, including already buffered delivery.
    /// Worker live checks independently supply the worker's actual verified storage binding.
    pub async fn resource_transfer_access(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<()> {
        self.resource_delivery_access(actor, intent, work, grant, None)
            .await
    }
    pub async fn model_transfer_access(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<()> {
        self.resource_delivery_access(actor, intent, work, grant, Some("model.responses"))
            .await
    }
    pub async fn credential_transfer_access(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<()> {
        self.resource_delivery_access(actor, intent, work, grant, Some("credential.enroll"))
            .await
    }
    async fn resource_delivery_access(
        &self,
        actor: ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
        native_operation: Option<&str>,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        let (principal, work, grant, instance) = self
            .resource_actor_for_intent(&mut tx, &actor, intent, work, grant)
            .await?;
        self.check_transfer_origin(&mut tx, &actor, intent).await?;
        let record = sqlx::query(
            "SELECT worker_id,configuration FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        let cfg: Value = record.get("configuration");
        let parse = |key| {
            cfg[key]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or(Error::Unavailable)
        };
        let configured_binding = if native_operation.is_some() {
            None
        } else {
            Some(ouroboros_contracts::StorageClaim {
                firm_id: self.firm,
                store_id: parse("store_id")?,
                generation: parse("storage_generation")?,
            })
        };
        let row = self
            .check_resource_dispatch(
                &mut tx,
                intent,
                &record.get::<String, _>("worker_id"),
                configured_binding.as_ref(),
            )
            .await?;
        let op: String = row.get("operation");
        let state: String = row.get("state");
        if row.get::<Uuid, _>("principal_id") != principal
            || row.get::<Uuid, _>("work_id") != work
            || row.get::<Uuid, _>("delegation_id") != grant
            || row.get::<Option<Uuid>, _>("instance_id") != instance
            || !(if native_operation.is_some() {
                Some(op.as_str()) == native_operation
            } else {
                matches!(op.as_str(), "file.read" | "file.upload")
            })
            || !(matches!(state.as_str(), "accepted" | "claimed")
                || ((op == "file.read" || op == "model.responses") && state == "succeeded"))
        {
            return Err(Error::Denied);
        }
        tx.commit().await?;
        Ok(())
    }
    async fn check_resource_dispatch(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        worker: &str,
        storage: Option<&ouroboros_contracts::StorageClaim>,
    ) -> Result<PgRow> {
        self.admission_open(tx).await?;
        let r=sqlx::query("SELECT r.*,i.input,i.principal_id,i.state,t.active,t.configuration AS current_config,t.worker_id AS current_worker FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) JOIN resource_targets t ON (t.firm_id,t.id)=(r.firm_id,r.target_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3").bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if !r.get::<bool, _>("active")
            || r.get::<Value, _>("configuration") != r.get::<Value, _>("current_config")
            || r.get::<String, _>("current_worker") != worker
        {
            return Err(Error::Denied);
        }
        let p: Uuid = r.get("principal_id");
        let work: Uuid = r.get("work_id");
        let grant: Uuid = r.get("delegation_id");
        let target: String = r.get("target_id");
        let op: String = r.get("operation");
        if let Some((activation, _)) = self.connection_scope(tx, &target, work, &op).await? {
            let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM connection_call_slots WHERE firm_id=$1 AND intent_id=$2 AND activation_id=$3)")
                .bind(self.firm).bind(intent).bind(activation).fetch_one(&mut **tx).await?;
            if !valid {
                return Err(Error::Denied);
            }
        }
        let cfg: Value = r.get("configuration");
        let ns = self.check_namespace(tx, &target, &cfg).await?;
        if ns.is_some() {
            self.reference_barriers(tx, work, &target, &op, &r.get::<Value, _>("input")["input"])
                .await?;
        }
        if op == "file.retire" {
            let request: ouroboros_contracts::RetirementRequest =
                serde_json::from_value(r.get::<Value, _>("input")["input"].clone())
                    .map_err(|_| Error::Denied)?;
            self.check_program_retirement(tx, work, &target, &request)
                .await?;
            let expected = super::retirement::policy(&cfg)?;
            let fixed: Value = sqlx::query_scalar(
                "SELECT policy FROM resource_retirements WHERE firm_id=$1 AND intent_id=$2",
            )
            .bind(self.firm)
            .bind(intent)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(Error::Denied)?;
            if fixed != json!(expected) {
                return Err(Error::Denied);
            }
        }

        self.workspace_binding(
            tx,
            intent,
            work,
            &target,
            &op,
            &r.get::<Value, _>("input")["input"],
            &cfg,
            true,
        )
        .await?;
        if op.starts_with("file.") || op == "workspace.create" {
            let binding = storage.ok_or(Error::Denied)?;
            let cfg: Value = r.get("configuration");
            if binding.firm_id != self.firm
                || cfg["store_id"]
                    .as_str()
                    .and_then(|v| Uuid::parse_str(v).ok())
                    != Some(binding.store_id)
                || cfg["storage_generation"]
                    .as_str()
                    .and_then(|v| Uuid::parse_str(v).ok())
                    != Some(binding.generation)
            {
                return Err(Error::Denied);
            }
            if op == "file.upload" {
                let input: Value = r.get("input");
                let allocated: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM storage_allocations WHERE firm_id=$1 AND intent_id=$2 AND store_id=$3 AND generation=$4 AND to_jsonb(bytes)=$5 AND to_jsonb(sha256)=$6)")
                    .bind(self.firm).bind(intent).bind(binding.store_id).bind(binding.generation)
                    .bind(&input["input"]["size"]).bind(&input["input"]["sha256"])
                    .fetch_one(&mut **tx).await?;
                if !allocated {
                    return Err(Error::Denied);
                }
            }
        } else if storage.is_some() {
            return Err(Error::Denied);
        }
        let transfer = if matches!(
            op.as_str(),
            "file.read" | "file.upload" | "credential.enroll"
        ) {
            if op != "credential.enroll" {
                transfer_bounds(&r.get::<Value, _>("configuration"))?;
            }
            Some(sqlx::query("SELECT origin_fingerprint FROM resource_transfers WHERE firm_id=$1 AND intent_id=$2 AND expires_at>clock_timestamp()")
                .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?)
        } else {
            None
        };
        let enabled: bool =
            sqlx::query_scalar("SELECT enabled FROM principals WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(p)
                .fetch_one(&mut **tx)
                .await?;
        if !enabled {
            return Err(Error::Denied);
        }
        self.resource_permission_namespace(tx, p, work, grant, &target, &op, ns)
            .await?;
        let ctx = if let Some(instance) = r.get::<Option<Uuid>, _>("instance_id") {
            let binding:Value=sqlx::query_scalar("SELECT binding FROM runtime_instances WHERE firm_id=$1 AND instance_id=$2 AND phase IN ('released','materializing')").bind(self.firm).bind(instance).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            let peer =
                serde_json::from_value(binding["peer"].clone()).map_err(|_| Error::Unavailable)?;
            self.resource_context_for_intent(tx, &Actor::Instance(peer), intent)
                .await?
        } else if let Some(transfer) = &transfer {
            let fingerprint = transfer
                .get::<Option<String>, _>("origin_fingerprint")
                .ok_or(Error::Denied)?;
            self.actor_context(tx, &Actor::Human(Caller { fingerprint }))
                .await?
        } else {
            ActorContext {
                principal: p,
                bound: None,
            }
        };
        if ctx.principal != p {
            return Err(Error::Denied);
        }
        self.actor_permission(tx, &ctx, grant, work, &op).await?;
        self.check_service_child(tx, intent).await?;
        if op == "file.publish" {
            self.publication_order(tx, Some(intent), &cfg, &r.get::<Value, _>("input")["input"])
                .await?;
        }
        Ok(r)
    }

    /// Conflicts follow the physical workspace, not the submitting execution, target alias
    /// or current grant. A predecessor field cannot bypass an unresolved publication.
    async fn publication_order(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        current: Option<Uuid>,
        configuration: &Value,
        input: &Value,
    ) -> Result<()> {
        let identity = |value: &Value| value.as_str().and_then(|s| Uuid::parse_str(s).ok());
        let store = identity(&configuration["store_id"]).ok_or(Error::Unavailable)?;
        let generation =
            identity(&configuration["storage_generation"]).ok_or(Error::Unavailable)?;
        let workspace = identity(&input["workspace_id"]).ok_or(Error::Invalid)?;
        // The authority fence serializes admission and claim. For pre-existing queued
        // conflicts, the oldest accepted intent may proceed; any already dispatched or
        // uncertain peer must first be observed. This does not redispatch the current intent.
        let rows = sqlx::query("SELECT r.configuration,i.input FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.operation='file.publish' AND i.state<>'succeeded' AND i.id IS DISTINCT FROM $2 AND ($2::uuid IS NULL OR i.state<>'accepted' OR (i.created_at,i.id)<(SELECT created_at,id FROM intents WHERE firm_id=$1 AND id=$2))")
            .bind(self.firm).bind(current).fetch_all(&mut **tx).await?;
        for row in rows {
            let previous: Value = row.get("configuration");
            let previous_store = identity(&previous["store_id"]).ok_or(Error::Unavailable)?;
            let previous_generation =
                identity(&previous["storage_generation"]).ok_or(Error::Unavailable)?;
            if (previous_store, previous_generation) != (store, generation) {
                continue;
            }
            let prior: Value = row.get("input");
            let previous_workspace =
                identity(&prior["input"]["workspace_id"]).ok_or(Error::Unavailable)?;
            if previous_workspace == workspace {
                return Err(Error::Conflict);
            }
        }
        Ok(())
    }

    /// Current permission for one original claimed operation; never a new claim or retry.
    pub async fn resource_live(
        &self,
        intent: Uuid,
        worker: &str,
        request: &ouroboros_contracts::ResourceLiveRequest,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        let r = self
            .check_resource_dispatch(&mut tx, intent, worker, request.storage.as_ref())
            .await?;
        let op: String = r.get("operation");
        let state: String = r.get("state");
        if !matches!(
            op.as_str(),
            "file.read"
                | "file.upload"
                | "file.publish"
                | "file.retire"
                | "workspace.create"
                | "db.read"
                | "db.write"
                | "mcp"
                | "model.responses"
                | "credential.enroll"
                | "credential.disable"
        ) || !(state == "claimed" || (op == "file.read" && state == "succeeded"))
        {
            return Err(Error::Denied);
        }
        let attempt: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM attempts WHERE firm_id=$1 AND id=$2 AND intent_id=$3 AND worker_id=$4 AND state=$5)")
            .bind(self.firm).bind(request.attempt_id).bind(intent).bind(worker).bind(state).fetch_one(&mut *tx).await?;
        if !attempt {
            return Err(Error::Denied);
        }
        tx.commit().await?;
        Ok(())
    }
    pub async fn resource_claim(
        &self,
        intent: Uuid,
        worker: &str,
        storage: Option<&ouroboros_contracts::StorageClaim>,
    ) -> Result<ResourceTicket> {
        let mut tx = self.fence().await?;
        let r = self
            .check_resource_dispatch(&mut tx, intent, worker, storage)
            .await?;
        if r.get::<String, _>("operation") == "file.collect" {
            // A collection advances only through an explicitly authorized, one-use step.
            return Err(Error::Denied);
        }
        if r.get::<String, _>("state") != "accepted" {
            return Err(Error::Denied);
        }
        let p: Uuid = r.get("principal_id");
        let work: Uuid = r.get("work_id");
        let target: String = r.get("target_id");
        let op: String = r.get("operation");
        let attempt = Uuid::new_v4();
        sqlx::query("INSERT INTO attempts VALUES($1,$2,$3,$4,'claimed')")
            .bind(self.firm)
            .bind(attempt)
            .bind(intent)
            .bind(worker)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE outbox SET claimed=true WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            p,
            "resource.dispatch_claimed",
            intent,
            json!({"attempt_id":attempt,"work_id":work,"target":target}),
        )
        .await?;
        let input: Value = r.get("input");
        let config: Value = r.get("configuration");
        let workspace = self
            .workspace_binding(
                &mut tx,
                intent,
                work,
                &target,
                &op,
                &input["input"],
                &config,
                true,
            )
            .await?;
        tx.commit().await?;
        Ok(ResourceTicket {
            workspace,
            firm_id: self.firm,
            intent_id: intent,
            attempt_id: attempt,
            work_id: work,
            target,
            operation: op,
            input: input["input"].clone(),
            configuration: config,
        })
    }
    pub async fn resource_complete(
        &self,
        intent: Uuid,
        worker: &str,
        reply: ResourceReply,
    ) -> Result<()> {
        if !(200..300).contains(&reply.status)
            || reply.body.len() > 2_097_152
            || !matches!(
                reply.content_type.as_str(),
                "application/json"
                    | "text/event-stream"
                    | "text/plain"
                    | "application/octet-stream"
            )
            || serde_json::to_vec(&reply.receipt)
                .map_err(|_| Error::Invalid)?
                .len()
                > 65_536
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let r=sqlx::query("SELECT r.reply,r.operation,r.configuration,i.input,i.principal_id,i.state FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) JOIN attempts a ON (a.firm_id,a.intent_id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3 AND a.worker_id=$3").bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let operation: String = r.get("operation");
        if operation == "file.publish" {
            let input: Value = r.get("input");
            let revision = input["input"]["expected_revision"]
                .as_i64()
                .filter(|revision| *revision >= 0)
                .and_then(|revision| revision.checked_add(1))
                .ok_or(Error::Invalid)?;
            // A publication becomes the source for head selection and retention barriers.
            // A malformed worker success must not turn an unresolved effect into proof.
            if reply.content_type != "application/json"
                || serde_json::from_str::<Value>(&reply.body).map_err(|_| Error::Invalid)?
                    != json!({"intent_id":intent,"revision":revision})
                || reply.receipt
                    != json!({"source":"catalog","publication_receipt":intent,"revision":revision})
            {
                return Err(Error::Invalid);
            }
        }
        if operation == "file.read" || reply.content_type == "application/octet-stream" {
            let (max_bytes, _) = transfer_bounds(&r.get::<Value, _>("configuration"))?;
            if operation != "file.read"
                || reply.content_type != "application/octet-stream"
                || !reply.body.is_empty()
                || reply.receipt["source"] != "catalog"
                || !reply.receipt["sha256"].as_str().is_some_and(valid_digest)
                || reply.receipt["size"]
                    .as_u64()
                    .is_none_or(|size| size > max_bytes)
                || reply.receipt["snapshot"] != r.get::<Value, _>("input")["input"]
            {
                return Err(Error::Invalid);
            }
        }
        if operation == "workspace.create" {
            let allocation = sqlx::query(
                "SELECT * FROM workspace_allocations WHERE firm_id=$1 AND creation_intent_id=$2",
            )
            .bind(self.firm)
            .bind(intent)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
            let expected = json!({"intent_id":intent,"workspace_id":allocation.get::<Uuid,_>("id"),"namespace_id":allocation.get::<Uuid,_>("namespace_id"),"work_id":allocation.get::<Uuid,_>("work_id"),"label":allocation.get::<String,_>("label"),"revision":0});
            let expected_receipt = json!({"source":"catalog","workspace_creation_receipt":intent,"workspace_id":allocation.get::<Uuid,_>("id"),"namespace_id":allocation.get::<Uuid,_>("namespace_id"),"work_id":allocation.get::<Uuid,_>("work_id"),"label":allocation.get::<String,_>("label"),"revision":0});
            if reply.content_type != "application/json"
                || serde_json::from_str::<Value>(&reply.body).map_err(|_| Error::Invalid)?
                    != expected
                || reply.receipt != expected_receipt
            {
                return Err(Error::Invalid);
            }
        }
        let retirement = if operation == "file.retire" {
            let request: ouroboros_contracts::RetirementRequest =
                serde_json::from_value(r.get::<Value, _>("input")["input"].clone())
                    .map_err(|_| Error::Unavailable)?;
            let expected = super::retirement::record(intent, &request);
            if reply.content_type != "application/json"
                || serde_json::from_str::<Value>(&reply.body).map_err(|_| Error::Invalid)?
                    != json!(expected)
                || reply.receipt
                    != json!({"source":"catalog","retirement_receipt":intent,"record":expected})
            {
                return Err(Error::Invalid);
            }
            Some(request)
        } else {
            None
        };
        let collection = if operation == "file.collect" {
            let record: ouroboros_contracts::CollectionRecord =
                serde_json::from_str(&reply.body).map_err(|_| Error::Invalid)?;
            if reply.status != 200
                || reply.content_type != "application/json"
                || reply.receipt
                    != json!({"source":"catalog","collection_receipt":intent,"record":record})
            {
                return Err(Error::Invalid);
            }
            Some(record)
        } else {
            None
        };
        if let Some(old) = r.get::<Option<Value>, _>("reply") {
            return if old == json!(reply) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        if r.get::<String, _>("state") != "claimed" {
            return Err(Error::Denied);
        }
        if operation == "file.upload" {
            // An exact replay of stored history returned above creates no new authority.
            // New completion must bind every field to the original admitted upload.
            super::upload_completion::validate(
                intent,
                &r.get::<Value, _>("input")["input"],
                &reply,
            )?;
        }
        if let Some(record) = &collection {
            self.complete_collection(&mut tx, intent, record).await?;
        }
        sqlx::query("UPDATE resource_calls SET reply=$3,completed_at=clock_timestamp() WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm)
            .bind(intent)
            .bind(json!(reply))
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE attempts SET state='succeeded' WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        if let Some(request) = &retirement {
            self.complete_retirement(&mut tx, intent, request).await?;
        }
        if operation == "workspace.create" {
            let n=sqlx::query("UPDATE workspace_allocations SET state='active' WHERE firm_id=$1 AND creation_intent_id=$2 AND state='reserved'").bind(self.firm).bind(intent).execute(&mut *tx).await?.rows_affected();
            if n != 1 {
                return Err(Error::Unavailable);
            }
        }
        self.event(
            &mut tx,
            r.get("principal_id"),
            "resource.completed",
            intent,
            json!({"source":"resource_worker","operation":operation,"state":"succeeded"}),
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
}
