//! Bounded verification acceptance and atomic configuration selection.
use super::*;
use ouroboros_contracts::{ConnectionAcceptanceRequest, ConnectionActivationRequest};
use sqlx::postgres::PgRow;

fn acceptance(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"candidate_id":row.get::<Uuid,_>("candidate_id"),
        "scope":row.get::<Value,_>("request"),"profile":"bounded-verification",
        "expires_at":row.get::<String,_>("deadline"),
        "operating_qualification":false})
}
impl Core {
    async fn connection_authority(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &Actor,
        candidate: &PgRow,
        work: Option<Uuid>,
        grant: Option<Uuid>,
        action: &str,
    ) -> Result<(Uuid, Uuid, Uuid)> {
        let expected: Uuid = candidate.get("work_id");
        let (p, w, d, _) = self
            .resource_actor(tx, actor, work.or(Some(expected)), grant)
            .await?;
        if w != expected {
            return Err(Error::Denied);
        }
        let target: String = candidate.get("target_id");
        self.resource_permission(tx, p, w, d, &target, action)
            .await?;
        if candidate
            .get::<Value, _>("proposed_configuration")
            .get("auth_module")
            .is_some()
            && matches!(action, "connection.accept" | "connection.activate")
        {
            let protected_action = if action == "connection.accept" {
                "auth-module.accept"
            } else {
                "auth-module.select"
            };
            self.resource_permission(tx, p, w, d, &target, protected_action)
                .await?;
        }
        self.resource_permission(tx, p, w, d, &target, "inspect")
            .await?;
        let source: String = sqlx::query_scalar(
            "SELECT target_id FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(candidate.get::<Uuid, _>("enrollment_intent_id"))
        .fetch_one(&mut **tx)
        .await?;
        self.resource_permission(tx, p, w, d, &source, "inspect")
            .await?;
        Ok((p, w, d))
    }
    pub async fn accept_connection(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: ConnectionAcceptanceRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if r.review_id.is_nil()
            || !(1..=100).contains(&r.max_calls)
            || !(1..=900).contains(&r.lifetime_seconds)
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let c = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (p, w, d) = self
            .connection_authority(
                &mut tx,
                &actor,
                &c,
                r.work_id,
                r.delegation_id,
                "connection.accept",
            )
            .await?;
        if p == c.get::<Uuid, _>("author_id") {
            return Err(Error::Denied);
        }
        let review = sqlx::query(
            "SELECT * FROM connection_reviews WHERE firm_id=$1 AND id=$2 AND candidate_id=$3",
        )
        .bind(self.firm)
        .bind(r.review_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        if review.get::<Uuid, _>("reviewer_id") == c.get::<Uuid, _>("author_id")
            || review.get::<Value, _>("request")["recommendation"] != "recommend"
        {
            return Err(Error::Denied);
        }
        // Acceptors must be able to inspect the cited records now; recommendation is not a test result.
        let evidence: Value = review.get("evidence");
        for e in evidence.as_array().ok_or(Error::Unavailable)? {
            let evidence_id = e["intent_id"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or(Error::Unavailable)?;
            let source = sqlx::query("SELECT r.target_id,r.configuration FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND i.state='succeeded'")
                .bind(self.firm).bind(evidence_id).bind(w).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
            self.resource_permission_namespace(
                &mut tx,
                p,
                w,
                d,
                &source.get::<String, _>("target_id"),
                "inspect",
                super::workspaces::namespace(&source.get::<Value, _>("configuration"))?,
            )
            .await?;
        }
        self.auth_module_evidence(&mut tx, &c, &review).await?;
        let fixed = json!({"candidate_id":id,"work_id":w,"review_id":r.review_id,
            "max_calls":r.max_calls,"lifetime_seconds":r.lifetime_seconds,"operation":"model.responses"});
        if let Some(old)=sqlx::query("SELECT *,expires_at::text AS deadline FROM connection_acceptances WHERE firm_id=$1 AND acceptor_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let out=acceptance(&old);tx.commit().await?;return Ok(out);
        }
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM connection_acceptances WHERE firm_id=$1 AND candidate_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 64 {
            return Err(Error::Capacity);
        }
        let aid = Uuid::new_v4();
        let row=sqlx::query("INSERT INTO connection_acceptances VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+make_interval(secs=>$9)) RETURNING *,expires_at::text AS deadline")
            .bind(self.firm).bind(aid).bind(id).bind(p).bind(d).bind(r.review_id).bind(key).bind(fixed).bind(f64::from(r.lifetime_seconds)).fetch_one(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "connection.accepted_for_verification",
            aid,
            json!({"candidate_id":id,"work_id":w}),
        )
        .await?;
        let out = acceptance(&row);
        tx.commit().await?;
        Ok(out)
    }
    pub async fn activate_connection(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: ConnectionActivationRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let c = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (p, w, d) = self
            .connection_authority(
                &mut tx,
                &actor,
                &c,
                r.work_id,
                r.delegation_id,
                "connection.activate",
            )
            .await?;
        let a = sqlx::query(
            "SELECT *,expires_at::text AS deadline FROM connection_acceptances WHERE firm_id=$1 AND id=$2 AND candidate_id=$3",
        )
        .bind(self.firm)
        .bind(r.acceptance_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        let fixed = json!({"candidate_id":id,"acceptance_id":r.acceptance_id,"work_id":w});
        // Replays observe the original transaction without extending its time or call scope.
        if let Some(old)=sqlx::query("SELECT id,request FROM connection_activations WHERE firm_id=$1 AND activator_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let out=json!({"id":old.get::<Uuid,_>("id"),"acceptance_id":r.acceptance_id,"state":"configuration_selected"});
            tx.commit().await?;return Ok(out);
        }
        self.check_connection_acceptance(&mut tx, &a, &c).await?;
        let used:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM connection_activations WHERE firm_id=$1 AND acceptance_id=$2)")
            .bind(self.firm).bind(r.acceptance_id).fetch_one(&mut *tx).await?;
        if used {
            return Err(Error::Conflict);
        }
        let target: String = c.get("target_id");
        let changed=sqlx::query("UPDATE resource_targets SET configuration=$3 WHERE firm_id=$1 AND id=$2 AND active AND configuration=$4 AND worker_id=$5")
            .bind(self.firm).bind(&target).bind(c.get::<Value,_>("proposed_configuration"))
            .bind(c.get::<Value,_>("base_configuration")).bind(c.get::<String,_>("worker_id"))
            .execute(&mut *tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Conflict);
        }
        let activation = Uuid::new_v4();
        sqlx::query("INSERT INTO connection_activations VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(self.firm)
            .bind(activation)
            .bind(r.acceptance_id)
            .bind(&target)
            .bind(p)
            .bind(d)
            .bind(key)
            .bind(fixed)
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO active_connections VALUES($1,$2,$3) ON CONFLICT(firm_id,target_id) DO UPDATE SET activation_id=excluded.activation_id")
            .bind(self.firm).bind(&target).bind(activation).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "connection.configuration_selected",
            activation,
            json!({"candidate_id":id,"acceptance_id":r.acceptance_id,"work_id":w}),
        )
        .await?;
        tx.commit().await?;
        Ok(
            json!({"id":activation,"acceptance_id":r.acceptance_id,"state":"configuration_selected"}),
        )
    }
    pub async fn stop_connection(
        &self,
        actor: Actor,
        id: Uuid,
        key: &str,
        r: ouroboros_contracts::ConnectionStopRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if r.activation_id.is_nil() {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let c = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (p, w, _) = self
            .connection_authority(
                &mut tx,
                &actor,
                &c,
                r.work_id,
                r.delegation_id,
                "connection.stop",
            )
            .await?;
        let fixed = json!({"candidate_id":id,"work_id":w,"activation_id":r.activation_id});
        if let Some(old)=sqlx::query("SELECT id,request FROM connection_stops WHERE firm_id=$1 AND principal_id=$2 AND request_key=$3")
            .bind(self.firm).bind(p).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let out=json!({"id":old.get::<Uuid,_>("id"),"activation_id":r.activation_id,"state":"restricted"});
            tx.commit().await?;return Ok(out);
        }
        let selected:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM active_connections n JOIN connection_activations x ON (x.firm_id,x.id)=(n.firm_id,n.activation_id) JOIN connection_acceptances a ON (a.firm_id,a.id)=(x.firm_id,x.acceptance_id) WHERE n.firm_id=$1 AND n.target_id=$2 AND x.id=$3 AND a.candidate_id=$4)")
            .bind(self.firm).bind(c.get::<String,_>("target_id")).bind(r.activation_id).bind(id).fetch_one(&mut *tx).await?;
        let stopped: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM connection_stops WHERE firm_id=$1 AND activation_id=$2)",
        )
        .bind(self.firm)
        .bind(r.activation_id)
        .fetch_one(&mut *tx)
        .await?;
        if !selected || stopped {
            return Err(Error::Conflict);
        }
        let stop = Uuid::new_v4();
        sqlx::query("INSERT INTO connection_stops(firm_id,id,activation_id,principal_id,request_key,request) VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm).bind(stop).bind(r.activation_id).bind(p).bind(key).bind(fixed).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            p,
            "connection.restricted",
            stop,
            json!({"work_id":w,"candidate_id":id,"activation_id":r.activation_id}),
        )
        .await?;
        tx.commit().await?;
        Ok(json!({"id":stop,"activation_id":r.activation_id,"state":"restricted"}))
    }
    pub async fn connection_status(
        &self,
        actor: Actor,
        id: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let c = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let (_, w, _) = self
            .connection_authority(&mut tx, &actor, &c, work, grant, "inspect")
            .await?;
        let target: String = c.get("target_id");
        let active: Option<Uuid> = sqlx::query_scalar(
            "SELECT activation_id FROM active_connections WHERE firm_id=$1 AND target_id=$2",
        )
        .bind(self.firm)
        .bind(&target)
        .fetch_optional(&mut *tx)
        .await?;
        let rows=sqlx::query("SELECT x.id,x.acceptance_id,a.request,a.expires_at::text AS deadline,a.expires_at<=clock_timestamp() AS expired,EXISTS(SELECT 1 FROM connection_stops s WHERE s.firm_id=x.firm_id AND s.activation_id=x.id) AS stopped FROM connection_activations x JOIN connection_acceptances a ON (a.firm_id,a.id)=(x.firm_id,x.acceptance_id) WHERE x.firm_id=$1 AND a.candidate_id=$2 ORDER BY x.id LIMIT 65")
            .bind(self.firm).bind(id).fetch_all(&mut *tx).await?;
        if rows.len() > 64 {
            return Err(Error::Unavailable);
        }
        let mut activations = Vec::new();
        for row in rows {
            let activation: Uuid = row.get("id");
            let selected = active == Some(activation);
            let stopped: bool = row.get("stopped");
            let expired: bool = row.get("expired");
            let counts=sqlx::query("SELECT count(*) AS used,count(*) FILTER(WHERE i.state='succeeded') AS succeeded,count(*) FILTER(WHERE i.state IN ('claimed','unresolved')) AS pending_effects FROM connection_call_slots s JOIN intents i ON (i.firm_id,i.id)=(s.firm_id,s.intent_id) WHERE s.firm_id=$1 AND s.activation_id=$2")
                .bind(self.firm).bind(activation).fetch_one(&mut *tx).await?;
            let used: i64 = counts.get("used");
            let max = row.get::<Value, _>("request")["max_calls"]
                .as_i64()
                .ok_or(Error::Unavailable)?;
            let permitted = if selected {
                match self
                    .connection_scope(&mut tx, &target, w, "model.responses")
                    .await
                {
                    Ok(Some((current, _))) => current == activation,
                    Err(Error::Denied) => false,
                    Ok(None) => false,
                    Err(e) => return Err(e),
                }
            } else {
                false
            };
            let state = if stopped {
                "stopped"
            } else if !selected {
                "replaced"
            } else if expired {
                "expired"
            } else if !permitted {
                "restricted"
            } else if used >= max {
                "exhausted"
            } else {
                "selected"
            };
            activations.push(json!({"id":activation,"acceptance_id":row.get::<Uuid,_>("acceptance_id"),
                "selected":selected,"state":state,"expires_at":row.get::<String,_>("deadline"),
                "max_calls":max,"admitted_calls":used,"remaining_admissions":(max-used).max(0),
                "succeeded_calls":counts.get::<i64,_>("succeeded"),"pending_effects":counts.get::<i64,_>("pending_effects"),
                "dispatch_policy_satisfied":permitted,"new_admission_policy_satisfied":permitted&&used<max}));
        }
        let out = json!({"candidate_id":id,"target":target,"work_id":w,"activations":activations,
            "source":"core_control","worker_readiness":"not_assessed","operating_qualification":false});
        tx.commit().await?;
        Ok(out)
    }
    async fn auth_module_evidence(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        candidate: &PgRow,
        review: &PgRow,
    ) -> Result<()> {
        let configuration: Value = candidate.get("proposed_configuration");
        let Some(module) = configuration.get("auth_module") else {
            return Ok(());
        };
        let author: Uuid = candidate.get("author_id");
        let reviewer: Uuid = review.get("reviewer_id");
        let evidence: Value = review.get("evidence");
        for reference in evidence.as_array().ok_or(Error::Denied)? {
            let Some(id) = reference["intent_id"]
                .as_str()
                .and_then(|v| Uuid::parse_str(v).ok())
            else {
                continue;
            };
            let Some(record) = sqlx::query("SELECT r.*,i.principal_id FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.operation='auth-module.verify' AND i.state='succeeded'")
                .bind(self.firm).bind(id).fetch_optional(&mut **tx).await? else { continue; };
            let receipt: Value = record.get("reply");
            if record.get::<Uuid, _>("principal_id") == reviewer
                && reviewer != author
                && record.get::<String, _>("worker_id") == candidate.get::<String, _>("worker_id")
                && record.get::<String, _>("target_id") == candidate.get::<String, _>("target_id")
                && record.get::<Uuid, _>("work_id") == candidate.get::<Uuid, _>("work_id")
                && receipt["receipt"]["source"] == "auth_module_verifier"
                && receipt["receipt"]["profile"] == "bounded-bearer-wasm-v1"
                && &receipt["receipt"]["module"] == module
                && receipt["receipt"]["vectors"] == 2
                && receipt["receipt"]["provider_calls"] == 0
            {
                self.resource_permission(
                    tx,
                    reviewer,
                    record.get("work_id"),
                    record.get("delegation_id"),
                    &record.get::<String, _>("target_id"),
                    "auth-module.verify",
                )
                .await?;
                return Ok(());
            }
        }
        Err(Error::Denied)
    }
    async fn check_connection_acceptance(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        a: &PgRow,
        c: &PgRow,
    ) -> Result<()> {
        let valid:bool=sqlx::query_scalar("SELECT expires_at>clock_timestamp() FROM connection_acceptances WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(a.get::<Uuid,_>("id")).fetch_one(&mut **tx).await?;
        let enabled: bool =
            sqlx::query_scalar("SELECT enabled FROM principals WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(a.get::<Uuid, _>("acceptor_id"))
                .fetch_one(&mut **tx)
                .await?;
        if !valid || !enabled {
            return Err(Error::Denied);
        }
        if c.get::<Value, _>("proposed_configuration")
            .get("auth_module")
            .is_some()
        {
            self.resource_permission(
                tx,
                a.get("acceptor_id"),
                c.get("work_id"),
                a.get("delegation_id"),
                &c.get::<String, _>("target_id"),
                "auth-module.accept",
            )
            .await?;
            let review = sqlx::query("SELECT * FROM connection_reviews WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(a.get::<Uuid, _>("review_id"))
                .fetch_one(&mut **tx)
                .await?;
            self.auth_module_evidence(tx, c, &review).await?;
        }
        self.resource_permission(
            tx,
            a.get("acceptor_id"),
            c.get("work_id"),
            a.get("delegation_id"),
            &c.get::<String, _>("target_id"),
            "connection.accept",
        )
        .await
    }
    /// Called under the same firm fence as admission/dispatch. None denotes a legacy fixed target.
    pub(super) async fn connection_scope(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        target: &str,
        work: Uuid,
        operation: &str,
    ) -> Result<Option<(Uuid, i64)>> {
        // Verification is a separately granted, secret-free operation, never business dispatch.
        if operation == "auth-module.verify" {
            return Ok(None);
        }
        let Some(active)=sqlx::query("SELECT x.* FROM active_connections n JOIN connection_activations x ON (x.firm_id,x.id)=(n.firm_id,n.activation_id) WHERE n.firm_id=$1 AND n.target_id=$2")
            .bind(self.firm).bind(target).fetch_optional(&mut **tx).await? else {return Ok(None);};
        let stopped: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM connection_stops WHERE firm_id=$1 AND activation_id=$2)",
        )
        .bind(self.firm)
        .bind(active.get::<Uuid, _>("id"))
        .fetch_one(&mut **tx)
        .await?;
        if stopped {
            return Err(Error::Denied);
        }
        let a = sqlx::query("SELECT *,expires_at::text AS deadline FROM connection_acceptances WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(active.get::<Uuid, _>("acceptance_id"))
            .fetch_one(&mut **tx)
            .await?;
        let c = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(a.get::<Uuid, _>("candidate_id"))
            .fetch_one(&mut **tx)
            .await?;
        if work != c.get::<Uuid, _>("work_id") || operation != "model.responses" {
            return Err(Error::Denied);
        }
        self.check_connection_acceptance(tx, &a, &c).await?;
        let enabled: bool =
            sqlx::query_scalar("SELECT enabled FROM principals WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(active.get::<Uuid, _>("activator_id"))
                .fetch_one(&mut **tx)
                .await?;
        if !enabled {
            return Err(Error::Denied);
        }
        self.resource_permission(
            tx,
            active.get("activator_id"),
            work,
            active.get("delegation_id"),
            target,
            "connection.activate",
        )
        .await?;
        if c.get::<Value, _>("proposed_configuration")
            .get("auth_module")
            .is_some()
        {
            self.resource_permission(
                tx,
                active.get("activator_id"),
                work,
                active.get("delegation_id"),
                target,
                "auth-module.select",
            )
            .await?;
        }
        let matches:bool=sqlx::query_scalar("SELECT configuration=$3 AND worker_id=$4 AND active FROM resource_targets WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(target).bind(c.get::<Value,_>("proposed_configuration")).bind(c.get::<String,_>("worker_id")).fetch_one(&mut **tx).await?;
        if !matches {
            return Err(Error::Denied);
        }
        let limit = a.get::<Value, _>("request")["max_calls"]
            .as_i64()
            .ok_or(Error::Unavailable)?;
        Ok(Some((active.get("id"), limit)))
    }
    pub(super) async fn reserve_connection_call(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        target: &str,
        work: Uuid,
        operation: &str,
        intent: Uuid,
    ) -> Result<()> {
        if let Some((active, limit)) = self.connection_scope(tx, target, work, operation).await? {
            let used: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM connection_call_slots WHERE firm_id=$1 AND activation_id=$2",
            )
            .bind(self.firm)
            .bind(active)
            .fetch_one(&mut **tx)
            .await?;
            if used >= limit {
                return Err(Error::Capacity);
            }
            sqlx::query("INSERT INTO connection_call_slots VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(intent)
                .bind(active)
                .execute(&mut **tx)
                .await?;
        }
        Ok(())
    }
}
