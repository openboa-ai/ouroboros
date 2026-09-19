//! Durable, finite recovery of one Company call. New compute, same root and effect slots.
//! Desired intent is not health; termination is not compute return or external settlement.
use super::*;
use ouroboros_contracts::{ServiceContinuationRequest, ServiceContinuationStop};
use sqlx::postgres::PgRow;

impl Core {
    pub async fn register_service_continuation(
        &self,
        actor: Actor,
        key: &str,
        request: ServiceContinuationRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if !request.valid() {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let root = self
            .service_root(&mut tx, request.execution_id)
            .await?
            .ok_or(Error::Denied)?;
        // Only the original submitter can attach continuation authority to its own call.
        if root.get::<Uuid, _>("execution_id") != request.execution_id
            || root.get::<Uuid, _>("principal_id") != ctx.principal
            || root.get::<Option<Uuid>, _>("origin_instance_id")
                != ctx.bound.as_ref().map(|b| b.instance)
            || root.get::<Option<Uuid>, _>("origin_generation")
                != ctx.bound.as_ref().map(|b| b.generation)
        {
            return Err(Error::Denied);
        }
        self.continuation_authority(&mut tx, &root).await?;
        let id: Uuid = root.get("root_intent_id");
        if let Some(old) = sqlx::query("SELECT root_intent_id,request,request_key FROM service_continuations WHERE firm_id=$1 AND (root_intent_id=$2 OR (issuer_id=$3 AND request_key=$4))")
            .bind(self.firm).bind(id).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Uuid,_>("root_intent_id") != id || old.get::<Value,_>("request") != json!(request) || old.get::<String,_>("request_key") != key { return Err(Error::Conflict); }
            return self.continuation_observation(&mut tx, id).await;
        }
        let ticket = self
            .program_ticket(&mut tx, request.execution_id, true)
            .await?
            .ok_or(Error::Denied)?;
        // Native agent continuation has a different terminal protocol; do not infer it from exit.
        if ticket.profile.native_codex {
            return Err(Error::Denied);
        }
        let worker: String = sqlx::query_scalar(
            "SELECT worker_id FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(request.execution_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Conflict)?;
        let profile: String = sqlx::query_scalar(
            "SELECT input->>'profile_id' FROM intents WHERE firm_id=$1 AND id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO service_continuations(firm_id,root_intent_id,issuer_id,request_key,request,worker_id,profile_id,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+make_interval(secs=>$8))")
            .bind(self.firm).bind(id).bind(ctx.principal).bind(key).bind(json!(request)).bind(worker).bind(profile).bind(f64::from(request.restart_window_seconds)).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            ctx.principal,
            "service.continuation_registered",
            id,
            json!({"work_id":root.get::<Uuid,_>("work_id"),"request":request}),
        )
        .await?;
        let out = self.continuation_observation(&mut tx, id).await?;
        tx.commit().await?;
        Ok(out)
    }

    async fn continuation_authority(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        root: &PgRow,
    ) -> Result<()> {
        let ctx = self.service_caller_context(tx, root).await?;
        let enabled: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM principals WHERE firm_id=$1 AND id=$2 AND enabled)",
        )
        .bind(self.firm)
        .bind(ctx.principal)
        .fetch_one(&mut **tx)
        .await?;
        if !enabled {
            return Err(Error::Denied);
        }
        self.actor_permission(
            tx,
            &ctx,
            root.get("delegation_id"),
            root.get("work_id"),
            "execution.start",
        )
        .await?;
        let binding: Value = root.get("binding");
        self.service_caller_permission(
            tx,
            root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "service.manage",
        )
        .await?;
        // Selection, qualification, caller authority, exact artifact and child targets stay current.
        let submission = Uuid::parse_str(
            binding["submission_id"]
                .as_str()
                .ok_or(Error::Unavailable)?,
        )
        .map_err(|_| Error::Unavailable)?;
        self.active_adapter(tx, submission, root.get("activation_id"))
            .await?;
        self.service_caller_permission(
            tx,
            root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "adapter.invoke",
        )
        .await?;
        self.check_service_binding(tx, root.get("execution_id"))
            .await
    }

    async fn continuation_registration(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
    ) -> Result<PgRow> {
        sqlx::query("SELECT l.*,c.execution_id AS original_execution_id,extract(epoch FROM l.expires_at)::bigint AS expires_at_seconds,l.expires_at>clock_timestamp() AS within_window,EXISTS(SELECT 1 FROM service_continuation_stops s WHERE (s.firm_id,s.root_intent_id)=(l.firm_id,l.root_intent_id)) AS stopped FROM service_continuations l JOIN service_calls c USING(firm_id,root_intent_id) WHERE l.firm_id=$1 AND l.root_intent_id=$2")
            .bind(self.firm).bind(id).fetch_optional(&mut **tx).await?.ok_or(Error::NotFound)
    }

    async fn continuation_current(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
    ) -> Result<PgRow> {
        sqlx::query("SELECT x.execution_id,x.ordinal,e.intent_id,e.stopped,e.terminated,i.state AS intent_state,r.phase,r.instance_id,r.generation,p.receipt AS program_result,COALESCE(e.terminated AND r.phase='terminated' AND c.units=z.units AND z.settled,false) AS returned,EXISTS(SELECT 1 FROM unstarted_cancellations u WHERE (u.firm_id,u.execution_id)=(e.firm_id,e.id)) AS never_dispatched,COALESCE(c.received_at+make_interval(secs=>(l.request->>'backoff_seconds')::double precision)<=clock_timestamp(),false) AS backoff_elapsed FROM service_execution_roots x JOIN executions e ON (e.firm_id,e.id)=(x.firm_id,x.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) JOIN service_continuations l ON (l.firm_id,l.root_intent_id)=(x.firm_id,x.root_intent_id) LEFT JOIN runtime_instances r ON (r.firm_id,r.execution_id)=(e.firm_id,e.id) LEFT JOIN compute_returns c ON (c.firm_id,c.execution_id)=(e.firm_id,e.id) LEFT JOIN reservations z ON (z.firm_id,z.intent_id)=(e.firm_id,e.intent_id) AND z.limit_id='compute' LEFT JOIN program_observations p ON (p.firm_id,p.execution_id)=(e.firm_id,e.id) WHERE x.firm_id=$1 AND x.root_intent_id=$2 ORDER BY x.ordinal DESC LIMIT 1")
            .bind(self.firm).bind(id).fetch_one(&mut **tx).await.map_err(Into::into)
    }

    async fn continuation_state(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        l: &PgRow,
        current: &PgRow,
    ) -> Result<&'static str> {
        let returned = current.get::<bool, _>("returned");
        if l.get::<bool, _>("stopped") {
            return Ok(if returned || current.get::<bool, _>("never_dispatched") {
                "stopped"
            } else {
                "stopping"
            });
        }
        if current.get::<bool, _>("stopped") {
            return Ok("execution_restricted");
        }
        let root = self
            .service_root(tx, l.get("original_execution_id"))
            .await?
            .ok_or(Error::Unavailable)?;
        match self.continuation_authority(tx, &root).await {
            Ok(()) => {}
            Err(Error::Denied | Error::Conflict) => return Ok("authority_blocked"),
            Err(e) => return Err(e),
        }
        if !current.get::<bool, _>("terminated") {
            return Ok("execution_pending_or_active");
        }
        if !returned {
            return Ok("compute_return_pending");
        }
        let unsettled: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND (r.instance_id=$3 OR EXISTS(SELECT 1 FROM service_effects s WHERE (s.firm_id,s.child_intent_id)=(r.firm_id,r.intent_id) AND s.root_intent_id=$2)) AND (i.state NOT IN ('succeeded','failed') OR r.reply IS NULL))")
            .bind(self.firm).bind(l.get::<Uuid,_>("root_intent_id")).bind(current.get::<Option<Uuid>,_>("instance_id")).fetch_one(&mut **tx).await?;
        if unsettled {
            return Ok("child_effect_unresolved");
        }
        if current
            .get::<Option<Value>, _>("program_result")
            .is_some_and(|v| v["exit_code"] == 0)
        {
            return Ok("program_completed");
        }
        // Binary response delivery is still instance-bound. Do not silently widen that boundary.
        let transfer: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM service_effects s JOIN resource_calls r ON (r.firm_id,r.intent_id)=(s.firm_id,s.child_intent_id) WHERE s.firm_id=$1 AND s.root_intent_id=$2 AND r.operation='file.read')")
            .bind(self.firm).bind(l.get::<Uuid,_>("root_intent_id")).fetch_one(&mut **tx).await?;
        if transfer {
            return Ok("transfer_recovery_required");
        }
        if !l.get::<bool, _>("within_window") {
            return Ok("restart_window_expired");
        }
        let request: ServiceContinuationRequest =
            serde_json::from_value(l.get("request")).map_err(|_| Error::Unavailable)?;
        if current.get::<i32, _>("ordinal") >= i32::from(request.max_restarts) {
            return Ok("restart_limit_reached");
        }
        if !current.get::<bool, _>("backoff_elapsed") {
            return Ok("restart_backoff");
        }
        Ok("restart_eligible")
    }

    pub(super) async fn continuation_observation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
    ) -> Result<Value> {
        let l = self.continuation_registration(tx, id).await?;
        let current = self.continuation_current(tx, id).await?;
        let state = self.continuation_state(tx, &l, &current).await?;
        let history: Vec<Value> = sqlx::query_scalar("SELECT jsonb_build_object('execution_id',x.execution_id,'ordinal',x.ordinal,'instance_id',r.instance_id,'generation',r.generation,'phase',r.phase,'terminated',e.terminated,'compute_returned',c.execution_id IS NOT NULL) FROM service_execution_roots x JOIN executions e ON (e.firm_id,e.id)=(x.firm_id,x.execution_id) LEFT JOIN runtime_instances r ON (r.firm_id,r.execution_id)=(x.firm_id,x.execution_id) LEFT JOIN compute_returns c ON (c.firm_id,c.execution_id)=(x.firm_id,x.execution_id) WHERE x.firm_id=$1 AND x.root_intent_id=$2 ORDER BY x.ordinal")
            .bind(self.firm).bind(id).fetch_all(&mut **tx).await?;
        let observation: Value = sqlx::query_scalar("SELECT jsonb_build_object('source','core_records','observed_at',clock_timestamp(),'authority_revision',revision,'environment_id',environment_id,'firm_id',id) FROM firms WHERE id=$1")
            .bind(self.firm).fetch_one(&mut **tx).await?;
        Ok(
            json!({"observation":observation,"root_intent_id":id,"desired":if l.get::<bool,_>("stopped") {"stopped"} else {"complete_original_call"},
            "state":state,"current_execution_id":current.get::<Uuid,_>("execution_id"),"restarts_used":current.get::<i32,_>("ordinal"),
            "policy":l.get::<Value,_>("request"),"restart_expires_at_seconds":l.get::<i64,_>("expires_at_seconds"),
            "worker_id":l.get::<String,_>("worker_id"),"profile_id":l.get::<String,_>("profile_id"),"history":history,
            "compute_returned":current.get::<bool,_>("returned"),"never_dispatched":current.get::<bool,_>("never_dispatched"),
            "health":"not_observed","work_success_confirmed":false,"effects_settled":false}),
        )
    }

    pub async fn read_service_continuation(&self, actor: Actor, id: Uuid) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let work: Uuid =
            sqlx::query_scalar("SELECT work_id FROM intents WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Error::NotFound)?;
        self.observation_work(&mut tx, &ctx, work).await?;
        self.owner_service_observation(&mut tx, &ctx, id).await
    }

    /// Idempotent even after response loss: the original root and immutable ordinal choose the key.
    pub async fn reconcile_service_continuation(&self, id: Uuid, worker: &str) -> Result<Value> {
        let mut tx = self.fence().await?;
        let l = self.continuation_registration(&mut tx, id).await?;
        if l.get::<String, _>("worker_id") != worker {
            return Err(Error::Denied);
        }
        let current = self.continuation_current(&mut tx, id).await?;
        if self.continuation_state(&mut tx, &l, &current).await? == "restart_eligible" {
            let root = self
                .service_root(&mut tx, l.get("original_execution_id"))
                .await?
                .ok_or(Error::Unavailable)?;
            let ctx = self.service_caller_context(&mut tx, &root).await?;
            let binding: Value = root.get("binding");
            let activation: Uuid = root.get("activation_id");
            let submission = Uuid::parse_str(
                binding["submission_id"]
                    .as_str()
                    .ok_or(Error::Unavailable)?,
            )
            .map_err(|_| Error::Unavailable)?;
            let (s, acceptance) = self.active_adapter(&mut tx, submission, activation).await?;
            let calls: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM adapter_invocations WHERE firm_id=$1 AND activation_id=$2",
            )
            .bind(self.firm)
            .bind(activation)
            .fetch_one(&mut *tx)
            .await?;
            if calls
                >= acceptance.get::<Value, _>("request")["max_calls"]
                    .as_i64()
                    .ok_or(Error::Unavailable)?
            {
                return Err(Error::Capacity);
            }
            let input: Value =
                sqlx::query_scalar("SELECT input FROM intents WHERE firm_id=$1 AND id=$2")
                    .bind(self.firm)
                    .bind(id)
                    .fetch_one(&mut *tx)
                    .await?;
            let request: ExecutionRequest =
                serde_json::from_value(input).map_err(|_| Error::Unavailable)?;
            let ordinal = current.get::<i32, _>("ordinal") + 1;
            let admitted = self
                .start_locked(
                    &mut tx,
                    &ctx,
                    &format!("service-restart:{}:{ordinal}", id.simple()),
                    request,
                )
                .await?;
            if admitted.replayed {
                return Err(Error::Conflict);
            }
            let ticket = self
                .program_ticket(&mut tx, admitted.resource_id, false)
                .await?
                .ok_or(Error::Denied)?;
            if json!(ticket) != s.get::<Value, _>("ticket") {
                return Err(Error::Conflict);
            }
            sqlx::query("INSERT INTO adapter_invocations VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(activation)
                .bind(admitted.resource_id)
                .execute(&mut *tx)
                .await?;
            sqlx::query("INSERT INTO service_restarts(firm_id,root_intent_id,ordinal,execution_id) VALUES($1,$2,$3,$4)")
                .bind(self.firm).bind(id).bind(ordinal).bind(admitted.resource_id).execute(&mut *tx).await?;
            self.event(&mut tx,ctx.principal,"service.execution_replaced",id,json!({"work_id":root.get::<Uuid,_>("work_id"),"execution_id":admitted.resource_id,"previous_execution_id":current.get::<Uuid,_>("execution_id"),"ordinal":ordinal,"root_preserved":true})).await?;
        }
        let out = self.continuation_observation(&mut tx, id).await?;
        tx.commit().await?;
        Ok(out)
    }

    /// Runtime only drives already registered continuations for its actual assigned worker/profile.
    pub async fn poll_service_continuations(&self, worker: &str, profile: &str) -> Result<Value> {
        let ids: Vec<Uuid> = sqlx::query_scalar("SELECT l.root_intent_id FROM service_continuations l LEFT JOIN service_continuation_checks c USING(firm_id,root_intent_id) WHERE l.firm_id=$1 AND l.worker_id=$2 AND l.profile_id=$3 AND NOT EXISTS(SELECT 1 FROM service_continuation_stops s WHERE (s.firm_id,s.root_intent_id)=(l.firm_id,l.root_intent_id)) ORDER BY c.checked_at NULLS FIRST,l.created_at,l.root_intent_id LIMIT 16")
            .bind(self.firm).bind(worker).bind(profile).fetch_all(&self.pool).await?;
        let mut results = Vec::new();
        for id in ids {
            sqlx::query("INSERT INTO service_continuation_checks(firm_id,root_intent_id) VALUES($1,$2) ON CONFLICT(firm_id,root_intent_id) DO UPDATE SET checked_at=clock_timestamp()")
                .bind(self.firm).bind(id).execute(&self.pool).await?;
            match self.reconcile_service_continuation(id, worker).await {
                Ok(out) => results.push(json!({"root_intent_id":id,"state":out["state"]})),
                Err(Error::Denied | Error::Conflict) => {
                    results.push(json!({"root_intent_id":id,"state":"admission_blocked"}))
                }
                Err(Error::Capacity) => {
                    results.push(json!({"root_intent_id":id,"state":"capacity_blocked"}))
                }
                Err(e) => return Err(e),
            }
        }
        Ok(json!({"checked":results}))
    }

    pub(super) async fn service_continuation_origin_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<bool> {
        let execution: Option<Uuid> = sqlx::query_scalar("SELECT x.execution_id FROM service_restarts x JOIN executions e ON (e.firm_id,e.id)=(x.firm_id,x.execution_id) WHERE x.firm_id=$1 AND e.intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?;
        let Some(execution) = execution else {
            return Ok(false);
        };
        let root = self
            .service_root(tx, execution)
            .await?
            .ok_or(Error::Denied)?;
        self.continuation_authority(tx, &root).await?;
        Ok(true)
    }

    pub(super) async fn service_continuation_claim_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        worker: &str,
    ) -> Result<()> {
        let execution: Uuid =
            sqlx::query_scalar("SELECT resource_id FROM intents WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(intent)
                .fetch_optional(&mut **tx)
                .await?
                .ok_or(Error::Denied)?;
        self.service_continuation_execution_allowed(tx, execution, worker)
            .await
    }

    pub(super) async fn service_continuation_execution_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        worker: &str,
    ) -> Result<()> {
        let l = sqlx::query("SELECT l.root_intent_id,l.worker_id FROM service_continuations l JOIN service_execution_roots x USING(firm_id,root_intent_id) WHERE x.firm_id=$1 AND x.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?;
        let Some(l) = l else {
            return Ok(());
        };
        if l.get::<String, _>("worker_id") != worker {
            return Err(Error::Denied);
        }
        self.service_continuation_fence(tx, execution).await
    }

    pub(super) async fn service_continuation_fence(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<()> {
        let id: Option<Uuid> = sqlx::query_scalar("SELECT l.root_intent_id FROM service_continuations l JOIN service_execution_roots x USING(firm_id,root_intent_id) WHERE x.firm_id=$1 AND x.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?;
        let Some(id) = id else {
            return Ok(());
        };
        let l = self.continuation_registration(tx, id).await?;
        let current = self.continuation_current(tx, id).await?;
        if l.get::<bool, _>("stopped") || current.get::<Uuid, _>("execution_id") != execution {
            return Err(Error::Denied);
        }
        let root = self
            .service_root(tx, execution)
            .await?
            .ok_or(Error::Denied)?;
        let binding: Value = root.get("binding");
        self.service_caller_permission(
            tx,
            &root,
            binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
            "service.manage",
        )
        .await
    }

    pub async fn stop_service_continuation(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        request: ServiceContinuationStop,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let l = self.continuation_registration(&mut tx, id).await?;
        let root = self
            .service_root(&mut tx, l.get("original_execution_id"))
            .await?
            .ok_or(Error::Unavailable)?;
        self.any_work_permission(&mut tx, &ctx, root.get("work_id"), "execution.stop")
            .await?;
        let fixed = json!({"root_intent_id":id,"request":request});
        if let Some(old) = sqlx::query("SELECT root_intent_id,request,receipt FROM service_continuation_stops WHERE firm_id=$1 AND issuer_id=$2 AND request_key=$3")
            .bind(self.firm).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request") != fixed { return Err(Error::Conflict); }
            return Ok(old.get("receipt"));
        }
        let current = self.continuation_current(&mut tx, id).await?;
        let execution: Uuid = current.get("execution_id");
        if request.expected_execution_id != execution || l.get::<bool, _>("stopped") {
            return Err(Error::Conflict);
        }
        // Unclaimed work uses the existing never-dispatched proof and ordinary return accounting.
        let cancellation = if current.get::<String, _>("intent_state") == "accepted"
            && current.get::<Option<Uuid>, _>("instance_id").is_none()
        {
            let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
                .bind(self.firm)
                .fetch_one(&mut *tx)
                .await?;
            Some(
                self.cancel_unstarted_locked(
                    &mut tx,
                    &ctx,
                    execution,
                    &format!("service-stop:{}", id.simple()),
                    revision,
                )
                .await?,
            )
        } else {
            None
        };
        sqlx::query("UPDATE executions SET stopped=true WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(execution)
            .execute(&mut *tx)
            .await?;
        let receipt = json!({"root_intent_id":id,"execution_id":execution,"restriction_recorded":true,"termination_confirmed":false,"unstarted_cancellation":cancellation,"effects_settled":false});
        sqlx::query("INSERT INTO service_continuation_stops VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm)
            .bind(id)
            .bind(ctx.principal)
            .bind(key)
            .bind(fixed)
            .bind(&receipt)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            ctx.principal,
            "service.continuation_stopped",
            id,
            json!({"work_id":root.get::<Uuid,_>("work_id"),"receipt":receipt}),
        )
        .await?;
        tx.commit().await?;
        Ok(receipt)
    }
}
