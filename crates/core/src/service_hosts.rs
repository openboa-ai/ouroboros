//! Sequential, finite Company request hosting. Request selectors carry no authority.
use super::*;
use ouroboros_contracts::{ServiceHostPolicy, ServiceHostRequest, ServiceOperationPlan};
use sqlx::postgres::PgRow;

pub(super) fn host_policy(root: &PgRow) -> Result<Option<ServiceHostPolicy>> {
    let binding: Value = root.get("binding");
    let plan: ServiceOperationPlan =
        serde_json::from_value(binding["selection"]["operation"].clone())
            .map_err(|_| Error::Unavailable)?;
    if !plan.valid() {
        return Err(Error::Unavailable);
    }
    Ok(plan.host)
}

impl Core {
    /// Preserve the direct-root row shape, but obtain provenance from this request's intent.
    pub(super) async fn host_request_root(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        request: Uuid,
    ) -> Result<PgRow> {
        sqlx::query("SELECT q.intent_id AS root_intent_id,q.execution_id,q.invocation,q.input_fingerprint,i.state,h.activation_id,h.binding,i.principal_id,i.delegation_id,i.work_id,i.origin_instance_id,i.origin_generation FROM service_host_requests q JOIN service_calls h ON (h.firm_id,h.execution_id)=(q.firm_id,q.execution_id) JOIN intents i ON (i.firm_id,i.id)=(q.firm_id,q.intent_id) WHERE q.firm_id=$1 AND q.intent_id=$2")
            .bind(self.firm).bind(request).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)
    }

    async fn active_host(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<PgRow> {
        let root = self
            .service_root(tx, execution)
            .await?
            .ok_or(Error::Denied)?;
        if root.get::<Uuid, _>("execution_id") != execution || host_policy(&root)?.is_none() {
            return Err(Error::Denied);
        }
        let worker: String = sqlx::query_scalar("SELECT worker_id FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2 AND phase='released'")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        self.runtime_allowed(tx, execution, &worker).await?;
        self.check_adapter_invocation(tx, execution).await?;
        Ok(root)
    }

    pub(super) async fn host_caller_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        root: &PgRow,
        target: &str,
        operation: &str,
    ) -> Result<()> {
        let enabled: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM principals WHERE firm_id=$1 AND id=$2 AND enabled)",
        )
        .bind(self.firm)
        .bind(root.get::<Uuid, _>("principal_id"))
        .fetch_one(&mut **tx)
        .await?;
        if !enabled {
            return Err(Error::Denied);
        }
        self.service_caller_permission(tx, root, target, operation)
            .await
    }

    pub(super) async fn claimed_host_request(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        request: Uuid,
        unfinished: bool,
    ) -> Result<PgRow> {
        let bound = ctx.bound.as_ref().ok_or(Error::Denied)?;
        let root = self.host_request_root(tx, request).await?;
        if root.get::<Uuid, _>("execution_id") != bound.execution || host_policy(&root)?.is_none() {
            return Err(Error::Denied);
        }
        let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM service_host_claims c WHERE c.firm_id=$1 AND c.request_intent_id=$2 AND c.instance_id=$3 AND c.generation=$4) AND (NOT $5 OR NOT EXISTS(SELECT 1 FROM service_host_replies WHERE firm_id=$1 AND request_intent_id=$2))")
            .bind(self.firm).bind(request).bind(bound.instance).bind(bound.generation).bind(unfinished).fetch_one(&mut **tx).await?;
        if !valid {
            return Err(Error::Denied);
        }
        self.check_adapter_invocation(tx, bound.execution).await?;
        let binding: Value = root.get("binding");
        self.host_caller_permission(
            tx,
            &root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "adapter.invoke",
        )
        .await?;
        Ok(root)
    }

    pub async fn admit_service_request(
        &self,
        actor: Actor,
        execution: Uuid,
        key: &str,
        request: ServiceHostRequest,
    ) -> Result<Accepted> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let material = json!({"execution_id":execution,"request":request});
        // Replay does not consume a slot or depend on the continued life of this host.
        if let Some(old) = self
            .existing(&mut tx, &ctx, "service.request", key, &material)
            .await?
        {
            return Ok(old);
        }
        self.admission_open(&mut tx).await?;
        let root = self.active_host(&mut tx, execution).await?;
        let policy = host_policy(&root)?.ok_or(Error::Denied)?;
        let binding: Value = root.get("binding");
        if request.work_id != root.get::<Uuid, _>("work_id")
            || request.invocation.operation != binding["selection"]["operation"]["name"]
            || !request.invocation.input.is_object()
            || serde_json::to_vec(&request.invocation.input)
                .map_err(|_| Error::Invalid)?
                .len()
                > policy.max_input_bytes as usize
        {
            return Err(Error::Invalid);
        }
        self.actor_permission(
            &mut tx,
            &ctx,
            request.delegation_id,
            request.work_id,
            "adapter.invoke",
        )
        .await?;
        let slot = binding["service_slot"].as_str().ok_or(Error::Unavailable)?;
        self.resource_permission(
            &mut tx,
            ctx.principal,
            request.work_id,
            request.delegation_id,
            slot,
            "adapter.invoke",
        )
        .await?;
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM service_host_requests WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_one(&mut *tx)
        .await?;
        if count >= i64::from(policy.max_requests) {
            return Err(Error::Capacity);
        }
        let accepted = self
            .intent(
                &mut tx,
                ctx.principal,
                "service.request",
                key,
                material,
                (execution, Some(request.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, accepted.intent_id, Some(request.work_id))
            .await?;
        sqlx::query("INSERT INTO service_host_requests VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm)
            .bind(accepted.intent_id)
            .bind(execution)
            .bind((count + 1) as i32)
            .bind(json!(request.invocation))
            .bind(super::service_calls::fingerprint(&json!(
                request.invocation
            ))?)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            ctx.principal,
            "service.request_admitted",
            accepted.intent_id,
            json!({"work_id":request.work_id,"execution_id":execution,"ordinal":count+1}),
        )
        .await?;
        tx.commit().await?;
        Ok(accepted)
    }

    pub async fn claim_service_request(&self, actor: Actor) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.authenticated_actor_context(&mut tx, &actor).await?;
        let bound = ctx.bound.as_ref().ok_or(Error::Denied)?;
        self.active_host(&mut tx, bound.execution).await?;
        self.admission_open(&mut tx).await?;
        // A claimed request may have effects and cannot be skipped. An unclaimed request
        // whose caller has lost authority is durably restricted before selecting later work.
        let (request, root) = loop {
            let request: Option<Uuid> = sqlx::query_scalar("SELECT q.intent_id FROM service_host_requests q JOIN intents i ON (i.firm_id,i.id)=(q.firm_id,q.intent_id) WHERE q.firm_id=$1 AND q.execution_id=$2 AND i.state!='restricted' AND NOT EXISTS(SELECT 1 FROM service_host_replies r WHERE r.firm_id=q.firm_id AND r.request_intent_id=q.intent_id) ORDER BY q.ordinal LIMIT 1")
                .bind(self.firm).bind(bound.execution).fetch_optional(&mut *tx).await?;
            let Some(request) = request else {
                tx.commit().await?;
                return Ok(json!({"request":null}));
            };
            let root = self.host_request_root(&mut tx, request).await?;
            let binding: Value = root.get("binding");
            match self
                .host_caller_permission(
                    &mut tx,
                    &root,
                    binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
                    "adapter.invoke",
                )
                .await
            {
                Ok(()) => break (request, root),
                Err(Error::Denied) => {
                    let claimed: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM service_host_claims WHERE firm_id=$1 AND request_intent_id=$2)")
                        .bind(self.firm).bind(request).fetch_one(&mut *tx).await?;
                    if claimed {
                        return Err(Error::Denied);
                    }
                    sqlx::query("UPDATE intents SET state='restricted' WHERE firm_id=$1 AND id=$2 AND state='accepted'")
                        .bind(self.firm).bind(request).execute(&mut *tx).await?;
                    self.event(&mut tx, ctx.principal, "service.request_restricted", request,
                        json!({"work_id":bound.work,"execution_id":bound.execution,"never_claimed":true,"reason":"caller_authority_unavailable"})).await?;
                }
                Err(error) => return Err(error),
            }
        };
        let inserted = sqlx::query(
            "INSERT INTO service_host_claims VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        )
        .bind(self.firm)
        .bind(request)
        .bind(bound.instance)
        .bind(bound.generation)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if inserted == 1 {
            sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2 AND state='accepted'")
                .bind(self.firm).bind(request).execute(&mut *tx).await?;
            self.event(&mut tx, ctx.principal, "service.request_claimed", request,
                json!({"work_id":bound.work,"execution_id":bound.execution,"instance_id":bound.instance,"generation":bound.generation})).await?;
        }
        self.claimed_host_request(&mut tx, &ctx, request, true)
            .await?;
        let out = json!({"request":{"intent_id":request,"execution_id":bound.execution,
            "instance_id":bound.instance,"generation":bound.generation,"invocation":root.get::<Value,_>("invocation")}});
        tx.commit().await?;
        Ok(out)
    }

    pub async fn reply_service_request(
        &self,
        actor: Actor,
        request: Uuid,
        result: Value,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.authenticated_actor_context(&mut tx, &actor).await?;
        let root = self
            .claimed_host_request(&mut tx, &ctx, request, false)
            .await?;
        let policy = host_policy(&root)?.ok_or(Error::Denied)?;
        if !result.is_object()
            || serde_json::to_vec(&result)
                .map_err(|_| Error::Invalid)?
                .len()
                > policy.max_result_bytes as usize
        {
            return Err(Error::Invalid);
        }
        let binding: Value = root.get("binding");
        self.host_caller_permission(
            &mut tx,
            &root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "adapter.invoke",
        )
        .await?;
        if let Some(old) = sqlx::query_scalar::<_, Value>(
            "SELECT result FROM service_host_replies WHERE firm_id=$1 AND request_intent_id=$2",
        )
        .bind(self.firm)
        .bind(request)
        .fetch_optional(&mut *tx)
        .await?
        {
            if old != result {
                return Err(Error::Conflict);
            }
        } else {
            sqlx::query("INSERT INTO service_host_replies VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(request)
                .bind(&result)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(request)
                .execute(&mut *tx)
                .await?;
            self.event(&mut tx, ctx.principal, "service.request_replied", request,
                json!({"work_id":root.get::<Uuid,_>("work_id"),"execution_id":root.get::<Uuid,_>("execution_id"),"effects_settled":false})).await?;
        }
        let receipt = json!({"request_intent_id":request,"result_fingerprint":super::service_calls::fingerprint(&result)?,"recorded":true,"effects_settled":false});
        tx.commit().await?;
        Ok(receipt)
    }

    pub async fn read_service_request(&self, actor: Actor, request: Uuid) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let root = self.host_request_root(&mut tx, request).await?;
        if ctx.principal != root.get::<Uuid, _>("principal_id") {
            return Err(Error::NotFound);
        }
        self.observation_work(&mut tx, &ctx, root.get("work_id"))
            .await?;
        let binding: Value = root.get("binding");
        self.host_caller_permission(
            &mut tx,
            &root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "inspect",
        )
        .await?;
        let plan: ServiceOperationPlan =
            serde_json::from_value(binding["selection"]["operation"].clone())
                .map_err(|_| Error::Unavailable)?;
        for effect in &plan.effects {
            self.host_caller_permission(&mut tx, &root, &effect.target, "inspect")
                .await?;
        }
        let result: Option<Value> = sqlx::query_scalar(
            "SELECT result FROM service_host_replies WHERE firm_id=$1 AND request_intent_id=$2",
        )
        .bind(self.firm)
        .bind(request)
        .fetch_optional(&mut *tx)
        .await?;
        let claim: Option<Value> = sqlx::query_scalar("SELECT jsonb_build_object('instance_id',instance_id,'generation',generation) FROM service_host_claims WHERE firm_id=$1 AND request_intent_id=$2")
            .bind(self.firm).bind(request).fetch_optional(&mut *tx).await?;
        let effects = self
            .host_effect_observations(&mut tx, root.get("execution_id"), Some(request))
            .await?;
        Ok(
            json!({"request_intent_id":request,"execution_id":root.get::<Uuid,_>("execution_id"),
            "input_fingerprint":root.get::<String,_>("input_fingerprint"),"state":root.get::<String,_>("state"),"assignment":claim,
            "result_fingerprint":result.as_ref().map(super::service_calls::fingerprint).transpose()?,
            "result":result,"effects":effects,"effects_settled":false,"resubmitted":false,"source":"core_request_record"}),
        )
    }

    pub(super) async fn host_effect_observations(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        request: Option<Uuid>,
    ) -> Result<Vec<Value>> {
        Ok(sqlx::query_scalar("SELECT jsonb_build_object('request_intent_id',q.intent_id,'effect_slot',e.effect_slot,'intent_id',e.child_intent_id,'operation',i.operation,'state',i.state,'receipt_available',r.reply IS NOT NULL) FROM service_host_requests q JOIN service_host_effects e ON (e.firm_id,e.root_intent_id)=(q.firm_id,q.intent_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.child_intent_id) JOIN resource_calls r ON (r.firm_id,r.intent_id)=(e.firm_id,e.child_intent_id) WHERE q.firm_id=$1 AND q.execution_id=$2 AND ($3::uuid IS NULL OR q.intent_id=$3) ORDER BY q.ordinal,e.effect_slot")
            .bind(self.firm).bind(execution).bind(request).fetch_all(&mut **tx).await?)
    }

    pub(super) async fn host_request_observations(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<Vec<Value>> {
        Ok(sqlx::query_scalar("SELECT jsonb_build_object('request_intent_id',q.intent_id,'ordinal',q.ordinal,'state',i.state,'caller_principal_id',i.principal_id,'instance_id',c.instance_id,'generation',c.generation,'result_available',r.request_intent_id IS NOT NULL,'effects_settled',false) FROM service_host_requests q JOIN intents i ON (i.firm_id,i.id)=(q.firm_id,q.intent_id) LEFT JOIN service_host_claims c ON (c.firm_id,c.request_intent_id)=(q.firm_id,q.intent_id) LEFT JOIN service_host_replies r ON (r.firm_id,r.request_intent_id)=(q.firm_id,q.intent_id) WHERE q.firm_id=$1 AND q.execution_id=$2 ORDER BY q.ordinal")
            .bind(self.firm).bind(execution).fetch_all(&mut **tx).await?)
    }
}
