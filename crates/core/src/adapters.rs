//! Submitted code stays on the existing retained, secretless Runtime path.
use super::*;
use ouroboros_contracts::{AdapterSubmissionRequest, ProgramRequest, ProgramTicket};
use sqlx::postgres::PgRow;
fn submission(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"work_id":row.get::<Uuid,_>("work_id"),
        "target":row.get::<String,_>("target_id"),"registrant_id":row.get::<Uuid,_>("registrant_id"),
        "source_requester_id":row.get::<Uuid,_>("source_requester_id"),
        "source_execution_id":row.get::<Uuid,_>("source_execution_id"),
        "origin_instance_id":row.get::<Option<Uuid>,_>("origin_instance_id"),
        "origin_generation":row.get::<Option<Uuid>,_>("origin_generation"),
        "profile_id":row.get::<String,_>("profile_id"),"program":row.get::<Value,_>("program"),
        "ticket":row.get::<Value,_>("ticket"),"state":"submitted","tool_exposed":false})
}
impl Core {
    pub(super) async fn adapter_read_authority(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        w: Uuid,
        d: Uuid,
        target: &str,
        ticket: &ProgramTicket,
    ) -> Result<()> {
        self.resource_permission(tx, p, w, d, target, "inspect")
            .await?;
        for input in &ticket.inputs {
            for action in ["inspect", "file.read"] {
                self.resource_permission_namespace(
                    tx,
                    p,
                    w,
                    d,
                    &input.reference.target,
                    action,
                    Some(input.namespace_id),
                )
                .await?;
            }
        }
        Ok(())
    }
    pub async fn submit_adapter(
        &self,
        actor: Actor,
        key: &str,
        r: AdapterSubmissionRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if r.source_execution_id.is_nil() || r.target.is_empty() || r.target.len() > 128 {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let (p, w, d, instance) = self
            .resource_actor(&mut tx, &actor, r.work_id, r.delegation_id)
            .await?;
        self.resource_permission(&mut tx, p, w, d, &r.target, "adapter.submit")
            .await?;
        let fixed =
            json!({"work_id":w,"target":r.target,"source_execution_id":r.source_execution_id});
        if let Some(old)=sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND registrant_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let ticket:ProgramTicket=serde_json::from_value(old.get("ticket")).map_err(|_|Error::Unavailable)?;
            self.adapter_read_authority(&mut tx,p,w,d,&r.target,&ticket).await?;
            let out=submission(&old);tx.commit().await?;return Ok(out);
        }
        let source=sqlx::query("SELECT i.principal_id,p.profile_id,p.request FROM execution_programs p JOIN executions e ON (e.firm_id,e.id)=(p.firm_id,p.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE p.firm_id=$1 AND p.execution_id=$2 AND e.work_id=$3")
            .bind(self.firm).bind(r.source_execution_id).bind(w).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let ticket = self
            .program_ticket(&mut tx, r.source_execution_id, false)
            .await?
            .ok_or(Error::Denied)?;
        if ticket.profile.native_codex || ticket.inputs.is_empty() {
            return Err(Error::Invalid);
        }
        self.adapter_read_authority(&mut tx, p, w, d, &r.target, &ticket)
            .await?;
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM adapter_submissions WHERE firm_id=$1 AND target_id=$2",
        )
        .bind(self.firm)
        .bind(&r.target)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 128 {
            return Err(Error::Capacity);
        }
        let id = Uuid::new_v4();
        let row=sqlx::query("INSERT INTO adapter_submissions VALUES($1,$2,$3,$4,$5,$6,$7,$8,(SELECT generation FROM runtime_instances WHERE firm_id=$1 AND instance_id=$8),$9,$10,$11,$12,$13) RETURNING *")
            .bind(self.firm).bind(id).bind(w).bind(&r.target).bind(p).bind(source.get::<Uuid,_>("principal_id"))
            .bind(r.source_execution_id).bind(instance).bind(key).bind(fixed).bind(source.get::<String,_>("profile_id"))
            .bind(source.get::<Value,_>("request")).bind(json!(ticket)).fetch_one(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "adapter.submitted",
            id,
            json!({"work_id":w,"target":r.target,"source_execution_id":r.source_execution_id}),
        )
        .await?;
        let out = submission(&row);
        tx.commit().await?;
        Ok(out)
    }
    pub async fn inspect_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let actual: Uuid = row.get("work_id");
        let (p, w, d, _) = self
            .resource_actor(&mut tx, &actor, work.or(Some(actual)), grant)
            .await?;
        if w != actual {
            return Err(Error::Denied);
        }
        let ticket: ProgramTicket =
            serde_json::from_value(row.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(
            &mut tx,
            p,
            w,
            d,
            &row.get::<String, _>("target_id"),
            &ticket,
        )
        .await?;
        let mut out = submission(&row);
        let evaluations=sqlx::query("SELECT *,to_jsonb(recorded_at) AS recorded_time FROM adapter_evaluations WHERE firm_id=$1 AND submission_id=$2 ORDER BY recorded_at,id LIMIT 64")
            .bind(self.firm).bind(id).fetch_all(&mut *tx).await?;
        let acceptances=sqlx::query("SELECT *,to_jsonb(expires_at) AS deadline FROM adapter_acceptances WHERE firm_id=$1 AND submission_id=$2 ORDER BY expires_at,id LIMIT 64")
            .bind(self.firm).bind(id).fetch_all(&mut *tx).await?;
        // Empty historical submissions keep their original projection; these lists are bounded.
        if !evaluations.is_empty() {
            out["evaluations"] = json!(evaluations.iter().map(evaluation).collect::<Vec<_>>());
        }
        if !acceptances.is_empty() {
            out["acceptances"] = json!(
                acceptances
                    .iter()
                    .map(adapter_acceptance)
                    .collect::<Vec<_>>()
            );
        }
        let activations:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',a.id,'acceptance_id',a.acceptance_id,'selected',EXISTS(SELECT 1 FROM active_adapters x WHERE x.firm_id=a.firm_id AND x.activation_id=a.id),'stop_recorded',EXISTS(SELECT 1 FROM adapter_stops x WHERE x.firm_id=a.firm_id AND x.activation_id=a.id),'expired',c.expires_at<=clock_timestamp(),'admitted_calls',(SELECT count(*) FROM adapter_invocations x WHERE x.firm_id=a.firm_id AND x.activation_id=a.id),'max_calls',c.request->'max_calls','current_authority','checked_on_use','worker_readiness','not_assessed') FROM adapter_activations a JOIN adapter_acceptances c ON(c.firm_id,c.id)=(a.firm_id,a.acceptance_id) WHERE a.firm_id=$1 AND a.submission_id=$2 ORDER BY a.id LIMIT 64")
            .bind(self.firm).bind(id).fetch_all(&mut *tx).await?;
        if !activations.is_empty() {
            out["activations"] = json!(activations);
        }
        tx.commit().await?;
        Ok(out)
    }
    pub async fn evaluate_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: ouroboros_contracts::AdapterEvaluationRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if !["supported", "unsupported", "inconclusive"].contains(&r.conclusion.as_str())
            || [&r.criteria, &r.rationale, &r.limitations]
                .iter()
                .any(|v| v.trim().is_empty() || v.len() > 4096)
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let actual: Uuid = row.get("work_id");
        let (p, w, d, _) = self
            .resource_actor(&mut tx, &actor, r.work_id.or(Some(actual)), r.delegation_id)
            .await?;
        if w != actual
            || [
                row.get::<Uuid, _>("registrant_id"),
                row.get::<Uuid, _>("source_requester_id"),
            ]
            .contains(&p)
        {
            return Err(Error::Denied);
        }
        let target: String = row.get("target_id");
        self.resource_permission(&mut tx, p, w, d, &target, "adapter.evaluate")
            .await?;
        let ticket: ProgramTicket =
            serde_json::from_value(row.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(&mut tx, p, w, d, &target, &ticket)
            .await?;
        // Read retained evidence under current inspection; revoked execution authority does not erase it.
        let observation: Value = sqlx::query_scalar("SELECT o.receipt FROM adapter_verifications v JOIN program_observations o ON (o.firm_id,o.execution_id)=(v.firm_id,v.execution_id) WHERE v.firm_id=$1 AND v.submission_id=$2 AND v.execution_id=$3")
            .bind(self.firm).bind(id).bind(r.verification_execution_id)
            .fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let fixed = json!({"submission_id":id,"work_id":w,"verification_execution_id":r.verification_execution_id,
            "conclusion":r.conclusion,"criteria":r.criteria,"rationale":r.rationale,"limitations":r.limitations});
        if let Some(old) = sqlx::query("SELECT *,to_jsonb(recorded_at) AS recorded_time FROM adapter_evaluations WHERE firm_id=$1 AND evaluator_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request") != fixed { return Err(Error::Conflict); }
            let out = evaluation(&old); tx.commit().await?; return Ok(out);
        }
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM adapter_evaluations WHERE firm_id=$1 AND submission_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 64 {
            return Err(Error::Capacity);
        }
        let evaluation_id = Uuid::new_v4();
        let saved = sqlx::query("INSERT INTO adapter_evaluations(firm_id,id,submission_id,evaluator_id,request_key,request,verification_execution_id,observation) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *,to_jsonb(recorded_at) AS recorded_time")
            .bind(self.firm).bind(evaluation_id).bind(id).bind(p).bind(key).bind(fixed)
            .bind(r.verification_execution_id).bind(observation).fetch_one(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "adapter.evaluated",
            evaluation_id,
            json!({"work_id":w,"submission_id":id,"conclusion":r.conclusion,"tool_exposed":false}),
        )
        .await?;
        let out = evaluation(&saved);
        tx.commit().await?;
        Ok(out)
    }
    pub async fn accept_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: ouroboros_contracts::AdapterAcceptanceRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if !(1..=100).contains(&r.max_calls)
            || !(1..=900).contains(&r.lifetime_seconds)
            || [&r.rationale, &r.independence_basis]
                .iter()
                .any(|s| s.trim().is_empty() || s.len() > 4096)
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let actual: Uuid = row.get("work_id");
        let (p, w, d, _) = self
            .resource_actor(&mut tx, &actor, r.work_id.or(Some(actual)), r.delegation_id)
            .await?;
        if actual != w
            || [
                row.get::<Uuid, _>("registrant_id"),
                row.get::<Uuid, _>("source_requester_id"),
            ]
            .contains(&p)
        {
            return Err(Error::Denied);
        }
        let target: String = row.get("target_id");
        self.resource_permission(&mut tx, p, w, d, &target, "adapter.accept")
            .await?;
        let ticket: ProgramTicket =
            serde_json::from_value(row.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(&mut tx, p, w, d, &target, &ticket)
            .await?;
        let review = sqlx::query(
            "SELECT * FROM adapter_evaluations WHERE firm_id=$1 AND id=$2 AND submission_id=$3",
        )
        .bind(self.firm)
        .bind(r.evaluation_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        if review.get::<Value, _>("request")["conclusion"] != "supported" {
            return Err(Error::Denied);
        }
        // The immutable evaluation already binds this exact submission and complete observation.
        // Acceptor rationale addresses its criteria/limitations; no exit-code auto-acceptance.
        let fixed = json!({"submission_id":id,"evaluation_id":r.evaluation_id,"work_id":w,
            "operation":"adapter.invoke","max_calls":r.max_calls,"lifetime_seconds":r.lifetime_seconds,
            "rationale":r.rationale,"independence_basis":r.independence_basis});
        if let Some(old)=sqlx::query("SELECT *,to_jsonb(expires_at) AS deadline FROM adapter_acceptances WHERE firm_id=$1 AND acceptor_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let out=adapter_acceptance(&old);tx.commit().await?;return Ok(out);
        }
        let current:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM program_profiles WHERE firm_id=$1 AND profile_id=$2 AND active AND profile=$3)")
            .bind(self.firm).bind(row.get::<String,_>("profile_id")).bind(json!(ticket.profile)).fetch_one(&mut *tx).await?;
        if !current {
            return Err(Error::Denied);
        }
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM adapter_acceptances WHERE firm_id=$1 AND submission_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 64 {
            return Err(Error::Capacity);
        }
        let aid = Uuid::new_v4();
        let saved=sqlx::query("INSERT INTO adapter_acceptances VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+make_interval(secs=>$9)) RETURNING *,to_jsonb(expires_at) AS deadline")
            .bind(self.firm).bind(aid).bind(id).bind(p).bind(d).bind(r.evaluation_id).bind(key).bind(fixed)
            .bind(f64::from(r.lifetime_seconds)).fetch_one(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "adapter.acceptance_recorded",
            aid,
            json!({"work_id":w,"submission_id":id,"tool_exposed":false}),
        )
        .await?;
        let out = adapter_acceptance(&saved);
        tx.commit().await?;
        Ok(out)
    }
    pub(super) async fn check_adapter_verification(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<()> {
        let Some(row)=sqlx::query("SELECT s.target_id,e.work_id,i.principal_id,i.delegation_id,p.enabled FROM adapter_verifications v JOIN adapter_submissions s ON (s.firm_id,s.id)=(v.firm_id,v.submission_id) JOIN executions e ON (e.firm_id,e.id)=(v.firm_id,v.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) JOIN principals p ON (p.firm_id,p.id)=(i.firm_id,i.principal_id) WHERE v.firm_id=$1 AND v.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await? else {return Ok(());};
        if !row.get::<bool, _>("enabled") {
            return Err(Error::Denied);
        }
        self.resource_permission(
            tx,
            row.get("principal_id"),
            row.get("work_id"),
            row.get("delegation_id"),
            &row.get::<String, _>("target_id"),
            "adapter.verify",
        )
        .await
    }
    pub async fn verify_adapter(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        mut r: ExecutionRequest,
    ) -> Result<Accepted> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if key.starts_with("wake:") || r.program.is_some() || r.predecessor_execution_id.is_some() {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        self.actor_permission(&mut tx, &ctx, r.delegation_id, r.work_id, "inspect")
            .await?;
        let row = sqlx::query(
            "SELECT * FROM adapter_submissions WHERE firm_id=$1 AND id=$2 AND work_id=$3",
        )
        .bind(self.firm)
        .bind(id)
        .bind(r.work_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        if [
            row.get::<Uuid, _>("registrant_id"),
            row.get::<Uuid, _>("source_requester_id"),
        ]
        .contains(&ctx.principal)
            || r.profile_id != row.get::<String, _>("profile_id")
        {
            return Err(Error::Denied);
        }
        let target: String = row.get("target_id");
        self.resource_permission(
            &mut tx,
            ctx.principal,
            r.work_id,
            r.delegation_id,
            &target,
            "adapter.verify",
        )
        .await?;
        let ticket: ProgramTicket =
            serde_json::from_value(row.get("ticket")).map_err(|_| Error::Unavailable)?;
        self.adapter_read_authority(
            &mut tx,
            ctx.principal,
            r.work_id,
            r.delegation_id,
            &target,
            &ticket,
        )
        .await?;
        let current:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM program_profiles WHERE firm_id=$1 AND profile_id=$2 AND active AND profile=$3)")
            .bind(self.firm).bind(&r.profile_id).bind(json!(ticket.profile)).fetch_one(&mut *tx).await?;
        if !current {
            return Err(Error::Denied);
        }
        let program: ProgramRequest =
            serde_json::from_value(row.get("program")).map_err(|_| Error::Unavailable)?;
        r.program = Some(program);
        let previous:Option<Uuid>=sqlx::query_scalar("SELECT resource_id FROM intents WHERE firm_id=$1 AND principal_id=$2 AND operation='execution.start' AND request_key=$3")
            .bind(self.firm).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await?;
        if let Some(execution) = previous {
            let linked:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM adapter_verifications WHERE firm_id=$1 AND execution_id=$2 AND submission_id=$3)")
                .bind(self.firm).bind(execution).bind(id).fetch_one(&mut *tx).await?;
            if !linked {
                return Err(Error::Conflict);
            }
        }

        // The same admission performs current input/agent checks, compute reservation and outbox.
        let accepted = self.start_locked(&mut tx, &ctx, key, r).await?;
        let actual = self
            .program_ticket(&mut tx, accepted.resource_id, false)
            .await?
            .ok_or(Error::Denied)?;
        if json!(actual) != json!(ticket) {
            return Err(Error::Conflict);
        }
        let existing: Option<Uuid> = sqlx::query_scalar(
            "SELECT submission_id FROM adapter_verifications WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(accepted.resource_id)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(previous) = existing {
            if previous != id {
                return Err(Error::Conflict);
            }
        } else {
            sqlx::query("INSERT INTO adapter_verifications VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(id)
                .bind(accepted.resource_id)
                .execute(&mut *tx)
                .await?;
            self.event(
                &mut tx,
                ctx.principal,
                "adapter.verification_requested",
                id,
                json!({"work_id":row.get::<Uuid,_>("work_id"),"execution_id":accepted.resource_id}),
            )
            .await?;
        }
        tx.commit().await?;
        Ok(accepted)
    }
}

fn evaluation(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"evaluator_id":row.get::<Uuid,_>("evaluator_id"),
        "assessment":row.get::<Value,_>("request"),"runtime_observation":row.get::<Value,_>("observation"),
        "recorded_at":row.get::<Value,_>("recorded_time"),
        "source":"principal_assessment","independence_confirmed":false,"tool_exposed":false,"operating_acceptance":false})
}

fn adapter_acceptance(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"acceptor_id":row.get::<Uuid,_>("acceptor_id"),
        "scope":row.get::<Value,_>("request"),"expires_at":row.get::<Value,_>("deadline"),
        "state":"acceptance_recorded","activation_required":true,"tool_exposed":false,
        "independence_source":"acceptor_assessment","operating_qualification":false})
}
