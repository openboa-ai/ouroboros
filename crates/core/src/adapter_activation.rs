//! Exact-material activation and bounded invocation through ordinary Runtime admission.
use super::*;
use ouroboros_contracts::{
    AdapterActivationRequest, AdapterInvocationRequest, AdapterStopRequest, ProgramTicket,
};
use sqlx::postgres::PgRow;

fn activated(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"submission_id":row.get::<Uuid,_>("submission_id"),
        "acceptance_id":row.get::<Uuid,_>("acceptance_id"),"state":"configuration_selected",
        "worker_readiness":"not_assessed","discovery":"current_authority_required"})
}
impl Core {
    async fn adapter_manager(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &Actor,
        s: &PgRow,
        work: Option<Uuid>,
        grant: Option<Uuid>,
        action: &str,
    ) -> Result<(Uuid, Uuid, Uuid)> {
        let actual: Uuid = s.get("work_id");
        let (p, w, d, _) = self
            .resource_actor(tx, actor, work.or(Some(actual)), grant)
            .await?;
        if w != actual {
            return Err(Error::Denied);
        }
        let target: String = s.get("target_id");
        self.resource_permission(tx, p, w, d, &target, action)
            .await?;
        let ticket: ProgramTicket =
            serde_json::from_value(s.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(tx, p, w, d, &target, &ticket)
            .await?;
        Ok((p, w, d))
    }
    async fn adapter_grant_current(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        w: Uuid,
        d: Uuid,
        target: &str,
        action: &str,
    ) -> Result<()> {
        let enabled: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM principals WHERE firm_id=$1 AND id=$2 AND enabled)",
        )
        .bind(self.firm)
        .bind(p)
        .fetch_one(&mut **tx)
        .await?;
        if !enabled {
            return Err(Error::Denied);
        }
        self.resource_permission(tx, p, w, d, target, action).await
    }
    async fn adapter_acceptance_current(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        a: &PgRow,
        s: &PgRow,
    ) -> Result<()> {
        let alive:bool=sqlx::query_scalar("SELECT expires_at>clock_timestamp() FROM adapter_acceptances WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(a.get::<Uuid,_>("id")).fetch_one(&mut **tx).await?;
        if !alive {
            return Err(Error::Denied);
        }
        self.adapter_grant_current(
            tx,
            a.get("acceptor_id"),
            s.get("work_id"),
            a.get("delegation_id"),
            &s.get::<String, _>("target_id"),
            "adapter.accept",
        )
        .await
    }
    pub async fn activate_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: AdapterActivationRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let s = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (p, w, d) = self
            .adapter_manager(
                &mut tx,
                &actor,
                &s,
                r.work_id,
                r.delegation_id,
                "adapter.activate",
            )
            .await?;
        let fixed = json!({"submission_id":id,"work_id":w,"acceptance_id":r.acceptance_id,"expected_activation_id":r.expected_activation_id});
        if let Some(old)=sqlx::query("SELECT * FROM adapter_activations WHERE firm_id=$1 AND activator_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let out=activated(&old);tx.commit().await?;return Ok(out);
        }
        let a = sqlx::query(
            "SELECT * FROM adapter_acceptances WHERE firm_id=$1 AND id=$2 AND submission_id=$3",
        )
        .bind(self.firm)
        .bind(r.acceptance_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        self.adapter_acceptance_current(&mut tx, &a, &s).await?;
        let target: String = s.get("target_id");
        let enabled: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active)",
        )
        .bind(self.firm)
        .bind(&target)
        .fetch_one(&mut *tx)
        .await?;
        if !enabled {
            return Err(Error::Denied);
        }

        let selected: Option<Uuid> = sqlx::query_scalar(
            "SELECT activation_id FROM active_adapters WHERE firm_id=$1 AND target_id=$2",
        )
        .bind(self.firm)
        .bind(&target)
        .fetch_optional(&mut *tx)
        .await?;
        if selected != r.expected_activation_id {
            return Err(Error::Conflict);
        }
        let used:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM adapter_activations WHERE firm_id=$1 AND acceptance_id=$2)")
            .bind(self.firm).bind(r.acceptance_id).fetch_one(&mut *tx).await?;
        if used {
            return Err(Error::Conflict);
        }
        let aid = Uuid::new_v4();
        let row = sqlx::query(
            "INSERT INTO adapter_activations VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        )
        .bind(self.firm)
        .bind(aid)
        .bind(id)
        .bind(r.acceptance_id)
        .bind(p)
        .bind(d)
        .bind(key)
        .bind(fixed)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO active_adapters VALUES($1,$2,$3) ON CONFLICT(firm_id,target_id) DO UPDATE SET activation_id=EXCLUDED.activation_id")
            .bind(self.firm).bind(&target).bind(aid).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "adapter.activated",
            aid,
            json!({"work_id":w,"submission_id":id,"target":target}),
        )
        .await?;
        let out = activated(&row);
        tx.commit().await?;
        Ok(out)
    }
    pub(super) async fn active_adapter(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        id: Uuid,
        activation: Uuid,
    ) -> Result<(PgRow, PgRow)> {
        let s = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(Error::Denied)?;
        let release=sqlx::query("SELECT a.* FROM adapter_activations a JOIN active_adapters t ON (t.firm_id,t.activation_id)=(a.firm_id,a.id) JOIN resource_targets rt ON(rt.firm_id,rt.id)=(t.firm_id,t.target_id) AND rt.active WHERE a.firm_id=$1 AND a.id=$2 AND a.submission_id=$3 AND t.target_id=$4 AND NOT EXISTS(SELECT 1 FROM adapter_stops x WHERE x.firm_id=a.firm_id AND x.activation_id=a.id)")
            .bind(self.firm).bind(activation).bind(id).bind(s.get::<String,_>("target_id"))
            .fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let a = sqlx::query("SELECT * FROM adapter_acceptances WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(release.get::<Uuid, _>("acceptance_id"))
            .fetch_one(&mut **tx)
            .await?;
        self.adapter_acceptance_current(tx, &a, &s).await?;
        self.adapter_grant_current(
            tx,
            release.get("activator_id"),
            s.get("work_id"),
            release.get("delegation_id"),
            &s.get::<String, _>("target_id"),
            "adapter.activate",
        )
        .await?;
        Ok((s, a))
    }
    pub async fn invoke_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: AdapterInvocationRequest,
    ) -> Result<Accepted> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut execution = r.execution;
        if key.starts_with("wake:")
            || key.starts_with("service-restart:")
            || execution.program.is_some()
            || execution.predecessor_execution_id.is_some()
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let (s, a) = self.active_adapter(&mut tx, id, r.activation_id).await?;
        if execution.work_id != s.get::<Uuid, _>("work_id")
            || execution.profile_id != s.get::<String, _>("profile_id")
        {
            return Err(Error::Denied);
        }
        self.resource_permission(
            &mut tx,
            ctx.principal,
            execution.work_id,
            execution.delegation_id,
            &s.get::<String, _>("target_id"),
            "adapter.invoke",
        )
        .await?;
        let ticket: ProgramTicket =
            serde_json::from_value(s.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(
            &mut tx,
            ctx.principal,
            execution.work_id,
            execution.delegation_id,
            &s.get::<String, _>("target_id"),
            &ticket,
        )
        .await?;
        let previous:Option<Uuid>=sqlx::query_scalar("SELECT resource_id FROM intents WHERE firm_id=$1 AND principal_id=$2 AND operation='execution.start' AND request_key=$3")
            .bind(self.firm).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await?;
        if let Some(previous) = previous {
            let linked:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM adapter_invocations WHERE firm_id=$1 AND execution_id=$2 AND activation_id=$3)")
                .bind(self.firm).bind(previous).bind(r.activation_id).fetch_one(&mut *tx).await?;
            if !linked {
                return Err(Error::Conflict);
            }
        } else {
            let count: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM adapter_invocations WHERE firm_id=$1 AND activation_id=$2",
            )
            .bind(self.firm)
            .bind(r.activation_id)
            .fetch_one(&mut *tx)
            .await?;
            let max = a.get::<Value, _>("request")["max_calls"]
                .as_i64()
                .ok_or(Error::Unavailable)?;
            if count >= max {
                return Err(Error::Capacity);
            }
        }
        let service_selection = self
            .prepare_service_invocation(&mut tx, &s, r.service.as_ref(), previous)
            .await?;
        execution.program =
            Some(serde_json::from_value(s.get("program")).map_err(|_| Error::Unavailable)?);
        let accepted = self.start_locked(&mut tx, &ctx, key, execution).await?;
        let actual = self
            .program_ticket(&mut tx, accepted.resource_id, false)
            .await?
            .ok_or(Error::Denied)?;
        if json!(actual) != json!(ticket) {
            return Err(Error::Conflict);
        }
        if previous.is_none() {
            sqlx::query("INSERT INTO adapter_invocations VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(r.activation_id)
                .bind(accepted.resource_id)
                .execute(&mut *tx)
                .await?;
            if let Some(selection) = service_selection {
                self.save_service_call(
                    &mut tx,
                    &accepted,
                    r.activation_id,
                    &s,
                    selection,
                    r.service.as_ref().ok_or(Error::Invalid)?,
                )
                .await?;
            }
            self.event(
                &mut tx,
                ctx.principal,
                "adapter.invoked",
                r.activation_id,
                json!({"work_id":s.get::<Uuid,_>("work_id"),"execution_id":accepted.resource_id}),
            )
            .await?;
        }
        tx.commit().await?;
        Ok(accepted)
    }
    pub(super) async fn check_adapter_invocation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<()> {
        let Some(v)=sqlx::query("SELECT v.activation_id,a.submission_id,i.principal_id,i.delegation_id,e.work_id FROM adapter_invocations v JOIN adapter_activations a ON (a.firm_id,a.id)=(v.firm_id,v.activation_id) JOIN executions e ON (e.firm_id,e.id)=(v.firm_id,v.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE v.firm_id=$1 AND v.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await? else {return Ok(());};
        let (s, _) = self
            .active_adapter(tx, v.get("submission_id"), v.get("activation_id"))
            .await?;
        self.adapter_grant_current(
            tx,
            v.get("principal_id"),
            v.get("work_id"),
            v.get("delegation_id"),
            &s.get::<String, _>("target_id"),
            "adapter.invoke",
        )
        .await?;
        self.service_continuation_fence(tx, execution).await?;
        self.check_service_binding(tx, execution).await
    }
    pub async fn stop_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: AdapterStopRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let s = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (p, w, _) = self
            .adapter_manager(
                &mut tx,
                &actor,
                &s,
                r.work_id,
                r.delegation_id,
                "adapter.stop",
            )
            .await?;
        let out = json!({"activation_id":r.activation_id,"state":"restriction_recorded","termination_confirmed":false});
        if let Some(old)=sqlx::query("SELECT x.activation_id,a.submission_id FROM adapter_stops x JOIN adapter_activations a ON(a.firm_id,a.id)=(x.firm_id,x.activation_id) WHERE x.firm_id=$1 AND x.issuer_id=$2 AND x.request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Uuid,_>("activation_id")!=r.activation_id || old.get::<Uuid,_>("submission_id")!=id {return Err(Error::Conflict);}
            tx.commit().await?;return Ok(out);
        }
        let current:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM active_adapters t JOIN adapter_activations a ON(t.firm_id,t.activation_id)=(a.firm_id,a.id) WHERE t.firm_id=$1 AND t.target_id=$2 AND a.id=$3 AND a.submission_id=$4 AND NOT EXISTS(SELECT 1 FROM adapter_stops x WHERE x.firm_id=a.firm_id AND x.activation_id=a.id))")
            .bind(self.firm).bind(s.get::<String,_>("target_id")).bind(r.activation_id).bind(id).fetch_one(&mut *tx).await?;
        if !current {
            return Err(Error::Conflict);
        }
        sqlx::query("INSERT INTO adapter_stops VALUES($1,$2,$3,$4)")
            .bind(self.firm)
            .bind(r.activation_id)
            .bind(p)
            .bind(key)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            p,
            "adapter.stopped",
            r.activation_id,
            json!({"work_id":w,"submission_id":id,"termination_confirmed":false}),
        )
        .await?;
        tx.commit().await?;
        Ok(out)
    }
}
