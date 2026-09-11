use super::*;
use ouroboros_contracts::{WakeCancelRequest, WakeRequest};

impl Core {
    pub async fn register_wake(
        &self,
        caller: impl Into<Actor>,
        key: &str,
        request: WakeRequest,
    ) -> Result<Accepted> {
        let execution = &request.execution;
        if request.due_at_seconds <= 0
            || request.expires_at_seconds <= request.due_at_seconds
            || execution.units <= 0
            || execution.lifetime_seconds <= 0
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let input = json!(request);
        if let Some(old) = self
            .existing(&mut tx, &ctx, "wake.register", key, &input)
            .await?
        {
            return Ok(old);
        }
        for action in ["wake.register", "execution.start"] {
            self.actor_permission(
                &mut tx,
                &ctx,
                execution.delegation_id,
                execution.work_id,
                action,
            )
            .await?;
        }
        let timely: bool =
            sqlx::query_scalar("SELECT $1::bigint > extract(epoch FROM clock_timestamp())")
                .bind(request.due_at_seconds)
                .fetch_one(&mut *tx)
                .await?;
        if !timely {
            return Err(Error::Invalid);
        }
        if execution.agent_delegation_id.is_some() {
            self.agent_grant(&mut tx, execution).await?;
        }
        let permitted: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM profiles WHERE firm_id=$1 AND id=$2 AND active AND max_units >= $3 AND max_lifetime_seconds >= $4)")
            .bind(self.firm).bind(&execution.profile_id).bind(execution.units).bind(execution.lifetime_seconds).fetch_one(&mut *tx).await?;
        if !permitted {
            return Err(Error::Denied);
        }
        // Check candidate inputs now; admission must resolve and authorize them again.
        // No execution input hold or capacity is acquired by this registration.
        self.prepare_program(&mut tx, &ctx, execution).await?;
        if let Some(old) = execution.predecessor_execution_id {
            let same_work: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM executions WHERE firm_id=$1 AND id=$2 AND work_id=$3)",
            )
            .bind(self.firm)
            .bind(old)
            .bind(execution.work_id)
            .fetch_one(&mut *tx)
            .await?;
            if !same_work {
                return Err(Error::Denied);
            }
        }
        let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM wake_registrations w WHERE firm_id=$1 AND work_id=$2 AND NOT cancelled AND expires_at_seconds>extract(epoch FROM clock_timestamp()) AND NOT EXISTS(SELECT 1 FROM wake_occurrences o WHERE o.firm_id=w.firm_id AND o.wake_id=w.id)")
            .bind(self.firm).bind(execution.work_id).fetch_one(&mut *tx).await?;
        if pending >= 16 {
            return Err(Error::Capacity);
        }
        let id = Uuid::new_v4();
        let mut accepted = self
            .intent(
                &mut tx,
                ctx.principal,
                "wake.register",
                key,
                input,
                (id, Some(execution.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, accepted.intent_id, Some(execution.work_id))
            .await?;
        sqlx::query("INSERT INTO wake_registrations(firm_id,id,intent_id,work_id,principal_id,delegation_id,due_at_seconds,expires_at_seconds,execution_request) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)")
            .bind(self.firm).bind(id).bind(accepted.intent_id).bind(execution.work_id).bind(ctx.principal).bind(execution.delegation_id)
            .bind(request.due_at_seconds).bind(request.expires_at_seconds).bind(json!(execution)).execute(&mut *tx).await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(accepted.intent_id)
            .execute(&mut *tx)
            .await?;
        let origin = ctx.bound.as_ref().map(|b| json!({"work":b.work,"grant":b.grant,"execution":b.execution,"instance":b.instance,"generation":b.generation}));
        sqlx::query("UPDATE wake_registrations SET continuation_enabled=true,origin_context=$3 WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(id).bind(origin).execute(&mut *tx).await?;
        accepted.state = IntentState::Succeeded;
        tx.commit().await?;
        Ok(accepted)
    }

    pub async fn wake(&self, caller: impl Into<Actor>, id: Uuid) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let row = sqlx::query("SELECT w.*,expires_at_seconds<=extract(epoch FROM clock_timestamp()) AS expired,(SELECT execution_intent_id FROM wake_occurrences o WHERE o.firm_id=w.firm_id AND o.wake_id=w.id) AS execution_intent_id FROM wake_registrations w WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(id).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
        self.any_work_permission(&mut tx, &ctx, row.get("work_id"), "inspect")
            .await?;
        Ok(
            json!({"id":id,"work_id":row.get::<Uuid,_>("work_id"),"registration_intent_id":row.get::<Uuid,_>("intent_id"),
            "due_at_seconds":row.get::<i64,_>("due_at_seconds"),"expires_at_seconds":row.get::<i64,_>("expires_at_seconds"),
            "execution_intent_id":row.get::<Option<Uuid>,_>("execution_intent_id"),"cancelled":row.get::<bool,_>("cancelled"),"expired":row.get::<bool,_>("expired"),"execution":row.get::<Value,_>("execution_request")}),
        )
    }

    pub async fn cancel_wake(
        &self,
        caller: impl Into<Actor>,
        id: Uuid,
        key: &str,
        request: WakeCancelRequest,
    ) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let input = json!({"wake_id":id,"request":request});
        if let Some(old) = self
            .existing(&mut tx, &ctx, "wake.cancel", key, &input)
            .await?
        {
            return Ok(old);
        }
        let work: Uuid =
            sqlx::query_scalar("SELECT work_id FROM wake_registrations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Error::NotFound)?;
        self.actor_permission(&mut tx, &ctx, request.delegation_id, work, "wake.cancel")
            .await?;
        let mut accepted = self
            .intent(
                &mut tx,
                ctx.principal,
                "wake.cancel",
                key,
                input,
                (id, Some(request.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, accepted.intent_id, Some(work))
            .await?;
        sqlx::query("UPDATE wake_registrations SET cancelled=true WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(accepted.intent_id)
            .execute(&mut *tx)
            .await?;
        accepted.state = IntentState::Succeeded;
        tx.commit().await?;
        Ok(accepted)
    }
}

impl Core {
    async fn continuation_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
    ) -> Result<(ActorContext, ExecutionRequest)> {
        let row=sqlx::query("SELECT w.* FROM wake_registrations w JOIN principals p ON (p.firm_id,p.id)=(w.firm_id,w.principal_id) WHERE w.firm_id=$1 AND w.id=$2 AND w.continuation_enabled AND NOT w.cancelled AND w.expires_at_seconds>extract(epoch FROM clock_timestamp()) AND p.enabled")
            .bind(self.firm).bind(id).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let request: ExecutionRequest =
            serde_json::from_value(row.get("execution_request")).map_err(|_| Error::Unavailable)?;
        let origin: Option<Value> = row.get("origin_context");
        let bound = origin
            .map(|v| -> Result<super::actors::BoundActor> {
                let id = |name: &str| {
                    serde_json::from_value(v[name].clone()).map_err(|_| Error::Unavailable)
                };
                Ok(super::actors::BoundActor {
                    work: id("work")?,
                    grant: id("grant")?,
                    execution: id("execution")?,
                    instance: id("instance")?,
                    generation: id("generation")?,
                })
            })
            .transpose()?;
        let ctx = ActorContext {
            principal: row.get("principal_id"),
            bound,
        };
        if request.work_id != row.get::<Uuid, _>("work_id")
            || request.delegation_id != row.get::<Uuid, _>("delegation_id")
        {
            return Err(Error::Unavailable);
        }
        for action in ["wake.register", "execution.start"] {
            self.actor_permission(tx, &ctx, request.delegation_id, request.work_id, action)
                .await?;
        }
        Ok((ctx, request))
    }

    /// Called only by Core's scheduler, never through a caller-selected HTTP identity.
    pub async fn deliver_wake(&self, id: Uuid) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let (ctx, request) = self.continuation_context(&mut tx, id).await?;
        let due:bool=sqlx::query_scalar("SELECT due_at_seconds<=extract(epoch FROM clock_timestamp()) FROM wake_registrations WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(id).fetch_one(&mut *tx).await?;
        if !due {
            return Err(Error::Conflict);
        }
        if let Some(intent) = sqlx::query_scalar::<_, Uuid>(
            "SELECT execution_intent_id FROM wake_occurrences WHERE firm_id=$1 AND wake_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        {
            let row =
                sqlx::query("SELECT resource_id,state FROM intents WHERE firm_id=$1 AND id=$2")
                    .bind(self.firm)
                    .bind(intent)
                    .fetch_one(&mut *tx)
                    .await?;
            return Ok(Accepted {
                intent_id: intent,
                resource_id: row.get("resource_id"),
                state: state(row.get("state"))?,
                replayed: true,
            });
        }
        let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM executions WHERE firm_id=$1 AND work_id=$2 AND NOT terminated)")
            .bind(self.firm).bind(request.work_id).fetch_one(&mut *tx).await?;
        if active {
            return Err(Error::Conflict);
        }
        let accepted = self
            .start_locked(&mut tx, &ctx, &format!("wake:{id}"), request)
            .await?;
        if accepted.replayed {
            return Err(Error::Conflict);
        }
        sqlx::query(
            "INSERT INTO wake_occurrences(firm_id,wake_id,execution_intent_id) VALUES($1,$2,$3)",
        )
        .bind(self.firm)
        .bind(id)
        .bind(accepted.intent_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(accepted)
    }

    pub(super) async fn wake_execution_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<bool> {
        let wake: Option<Uuid> = sqlx::query_scalar(
            "SELECT wake_id FROM wake_occurrences WHERE firm_id=$1 AND execution_intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_optional(&mut **tx)
        .await?;
        let Some(wake) = wake else {
            return Ok(false);
        };
        let (ctx, request) = self.continuation_context(tx, wake).await?;
        let valid:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM intents WHERE firm_id=$1 AND id=$2 AND principal_id=$3 AND operation='execution.start' AND input=$4)")
            .bind(self.firm).bind(intent).bind(ctx.principal).bind(json!(request)).fetch_one(&mut **tx).await?;
        if !valid {
            return Err(Error::Denied);
        }
        Ok(true)
    }

    /// Bounded, fair candidate polling. Denied/capacity-limited candidates remain inspectable.
    pub async fn poll_wakes(&self) -> Result<()> {
        let ids:Vec<Uuid>=sqlx::query_scalar("SELECT w.id FROM wake_registrations w WHERE firm_id=$1 AND continuation_enabled AND NOT cancelled AND due_at_seconds<=extract(epoch FROM clock_timestamp()) AND expires_at_seconds>extract(epoch FROM clock_timestamp()) AND NOT EXISTS(SELECT 1 FROM wake_occurrences o WHERE o.firm_id=w.firm_id AND o.wake_id=w.id) ORDER BY last_checked_at NULLS FIRST,due_at_seconds,id LIMIT 16")
            .bind(self.firm).fetch_all(&self.pool).await?;
        for id in ids {
            sqlx::query("UPDATE wake_registrations SET last_checked_at=clock_timestamp() WHERE firm_id=$1 AND id=$2")
                .bind(self.firm).bind(id).execute(&self.pool).await?;
            match self.deliver_wake(id).await {
                Ok(_) | Err(Error::Denied | Error::Conflict | Error::Capacity) => {}
                Err(error) => return Err(error),
            }
        }
        Ok(())
    }
}
