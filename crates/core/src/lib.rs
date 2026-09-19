mod environment;
mod unstarted;
use ouroboros_contracts::{Accepted, ExecutionRequest, IntentState, StatusEvent, WorkRequest};
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, Error>;
#[derive(Debug)]
pub enum Error {
    Denied,
    NotFound,
    Conflict,
    Capacity,
    Invalid,
    Unavailable,
}
impl From<sqlx::Error> for Error {
    fn from(_: sqlx::Error) -> Self {
        Self::Unavailable
    }
}
#[derive(Clone)]
pub struct Core {
    pool: PgPool,
    pub firm: Uuid,
    serving_generation: Uuid,
}
#[derive(Clone)]
pub struct Caller {
    pub fingerprint: String,
}
mod actors;
mod adapter_activation;
mod adapters;
mod collection;
mod compute_returns;
mod connection_activation;
mod connections;
mod conversations;
mod managed_mcp;
mod management;
mod native_control;
mod native_dispatch;
mod notifications;
mod owner_observations;
mod owner_services;
mod program;
mod receipt_recovery;
mod resources;
mod retirement;
mod runtime;
mod service_calls;
mod service_continuations;
mod service_hosts;
mod upload_completion;
mod wakes;
mod workspaces;
pub use actors::Actor;
use actors::ActorContext;
pub type ResourceActor = Actor;
impl Core {
    pub fn new(pool: PgPool, firm: Uuid) -> Self {
        Self {
            pool,
            firm,
            serving_generation: Uuid::new_v4(),
        }
    }
    pub async fn migrate(pool: &PgPool) -> anyhow::Result<()> {
        sqlx::migrate!("./migrations").run(pool).await?;
        Ok(())
    }
    async fn fence(&self) -> Result<Transaction<'_, Postgres>> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SET LOCAL lock_timeout='2s'")
            .execute(&mut *tx)
            .await?;
        sqlx::query("SET LOCAL statement_timeout='5s'")
            .execute(&mut *tx)
            .await?;
        let row = sqlx::query("SELECT id FROM firms WHERE id=$1 FOR UPDATE")
            .bind(self.firm)
            .fetch_optional(&mut *tx)
            .await?;
        if row.is_none() {
            return Err(Error::Unavailable);
        }
        Ok(tx)
    }
    async fn authenticate(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        caller: &Caller,
    ) -> Result<Uuid> {
        let p=sqlx::query_scalar("SELECT c.principal_id FROM credentials c JOIN principals p ON (p.firm_id,p.id)=(c.firm_id,c.principal_id) WHERE c.firm_id=$1 AND c.fingerprint=$2 AND c.enabled AND p.enabled AND p.kind='human' AND c.expires_at>clock_timestamp()")
            .bind(self.firm).bind(&caller.fingerprint).fetch_optional(&mut **tx).await?;
        p.ok_or(Error::Denied)
    }
    async fn authorize(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        principal: Uuid,
        delegation: Uuid,
        action: &str,
    ) -> Result<()> {
        // Recursion is bounded by UNION's deduplication; every ancestor must remain valid.
        let ok:bool=sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT * FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.* FROM delegations d JOIN chain c ON d.firm_id=c.firm_id AND d.id=c.parent_id) SELECT COALESCE(bool_and(NOT revoked AND expires_at>clock_timestamp() AND $4=ANY(actions)),false) AND COALESCE(bool_or(id=$2 AND principal_id=$3),false) AND COALESCE(bool_or(parent_id IS NULL),false) FROM chain")
            .bind(self.firm).bind(delegation).bind(principal).bind(action).fetch_one(&mut **tx).await?;
        if !ok {
            return Err(Error::Denied);
        }
        Ok(())
    }
    async fn event(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        kind: &str,
        id: Uuid,
        data: Value,
    ) -> Result<()> {
        let work: Option<Uuid> = if kind == "work.created" {
            Some(id)
        } else if kind.starts_with("runtime.")
            || kind.starts_with("instance.")
            || kind == "execution.cancelled_unstarted"
            || (kind == "restriction.accepted" && data["operation"] == "execution.stop")
        {
            sqlx::query_scalar("SELECT work_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_optional(&mut **tx)
                .await?
        } else if kind == "intent.accepted"
            || kind == "dispatch.claimed"
            || kind.starts_with("resource.")
            || kind == "service.effect_bound"
        {
            sqlx::query_scalar("SELECT work_id FROM intents WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_optional(&mut **tx)
                .await?
                .flatten()
        } else {
            None
        };
        let seq: i64 = sqlx::query_scalar(
            "UPDATE firms SET event_sequence=event_sequence+1 WHERE id=$1 RETURNING event_sequence",
        )
        .bind(self.firm)
        .fetch_one(&mut **tx)
        .await?;
        sqlx::query("INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data,work_id) VALUES($1,$2,$3,$4,$5,$6,$7)")
            .bind(self.firm).bind(seq).bind(p).bind(kind).bind(id).bind(data).bind(work).execute(&mut **tx).await?;
        Ok(())
    }
    async fn existing(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        op: &str,
        key: &str,
        input: &Value,
    ) -> Result<Option<Accepted>> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let r=sqlx::query("SELECT id,resource_id,state,input,work_id FROM intents WHERE firm_id=$1 AND principal_id=$2 AND operation=$3 AND request_key=$4")
            .bind(self.firm).bind(ctx.principal).bind(op).bind(key).fetch_optional(&mut **tx).await?;
        if let Some(r) = r {
            if let Some(work) = r.get::<Option<Uuid>, _>("work_id") {
                self.any_work_permission(tx, ctx, work, "inspect").await?;
            } else if !self.unscoped_inspect(tx, ctx).await? {
                return Err(Error::Denied);
            }
            if r.get::<Value, _>("input") != *input {
                return Err(Error::Conflict);
            }
            return Ok(Some(Accepted {
                intent_id: r.get("id"),
                resource_id: r.get("resource_id"),
                state: state(r.get("state"))?,
                replayed: true,
            }));
        }
        Ok(None)
    }
    async fn intent(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        p: Uuid,
        op: &str,
        key: &str,
        input: Value,
        target: (Uuid, Option<Uuid>),
    ) -> Result<Accepted> {
        let (resource, delegation) = target;
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,delegation_id,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'accepted')")
            .bind(self.firm).bind(id).bind(p).bind(op).bind(key).bind(input).bind(resource).bind(delegation).execute(&mut **tx).await?;
        self.event(
            tx,
            p,
            "intent.accepted",
            id,
            json!({"operation":op,"resource_id":resource}),
        )
        .await?;
        Ok(Accepted {
            intent_id: id,
            resource_id: resource,
            state: IntentState::Accepted,
            replayed: false,
        })
    }
    pub async fn create_work(
        &self,
        caller: impl Into<Actor>,
        key: &str,
        r: WorkRequest,
    ) -> Result<Accepted> {
        if r.purpose.trim().is_empty() || r.purpose.len() > 4096 {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let p = ctx.principal;
        let parent = r
            .parent_work_id
            .or_else(|| ctx.bound.as_ref().map(|b| b.work));
        let mut input = json!(r);
        if let Some(parent) = parent {
            input["parent_work_id"] = json!(parent);
        }
        if let Some(a) = self
            .existing(&mut tx, &ctx, "work.create", key, &input)
            .await?
        {
            return Ok(a);
        }
        self.actor_grant(&mut tx, &ctx, r.delegation_id, "work.create")
            .await?;
        if let Some(parent) = parent {
            self.actor_permission(&mut tx, &ctx, r.delegation_id, parent, "work.create")
                .await?;
        } else if !self
            .grant_work_roots(&mut tx, r.delegation_id)
            .await?
            .is_empty()
        {
            // A work-scoped grant cannot create a new unrelated root.
            return Err(Error::Denied);
        }
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO work(firm_id,id,principal_id,delegation_id,purpose,parent_id) VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm)
            .bind(id)
            .bind(p)
            .bind(r.delegation_id)
            .bind(r.purpose)
            .bind(parent)
            .execute(&mut *tx)
            .await?;
        if parent.is_none() {
            sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
                .bind(self.firm)
                .bind(id)
                .bind(p)
                .execute(&mut *tx)
                .await?;
        }
        let a = self
            .intent(
                &mut tx,
                p,
                "work.create",
                key,
                input,
                (id, Some(r.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, a.intent_id, Some(id))
            .await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(a.intent_id)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            p,
            "work.created",
            id,
            json!({"intent_id":a.intent_id}),
        )
        .await?;
        tx.commit().await?;
        Ok(Accepted {
            state: IntentState::Succeeded,
            ..a
        })
    }
    pub async fn start(
        &self,
        caller: impl Into<Actor>,
        key: &str,
        r: ExecutionRequest,
    ) -> Result<Accepted> {
        if key.starts_with("wake:") || key.starts_with("service-restart:") {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let accepted = self.start_locked(&mut tx, &ctx, key, r).await?;
        tx.commit().await?;
        Ok(accepted)
    }

    /// Shares the caller's authority fence with continuation occurrence admission.
    /// Does not commit: its caller must atomically persist any wake-to-intent binding.
    async fn start_locked(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        key: &str,
        r: ExecutionRequest,
    ) -> Result<Accepted> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if r.units <= 0 || r.lifetime_seconds <= 0 {
            return Err(Error::Invalid);
        }
        let input = json!(r);
        let p = ctx.principal;
        if let Some(a) = self
            .existing(tx, ctx, "execution.start", key, &input)
            .await?
        {
            return Ok(a);
        }
        self.admission_open(tx).await?;
        self.actor_permission(tx, ctx, r.delegation_id, r.work_id, "execution.start")
            .await?;
        if r.agent_delegation_id.is_some() {
            self.agent_grant(tx, &r).await?;
        }
        let profile=sqlx::query("SELECT max_units,max_lifetime_seconds FROM profiles WHERE firm_id=$1 AND id=$2 AND active").bind(self.firm).bind(&r.profile_id).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if r.units > profile.get::<i64, _>("max_units")
            || r.lifetime_seconds > profile.get::<i64, _>("max_lifetime_seconds")
        {
            return Err(Error::Denied);
        }
        let program = self.prepare_program(tx, ctx, &r).await?;
        if let Some(old) = r.predecessor_execution_id {
            let managed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM adapter_invocations WHERE firm_id=$1 AND execution_id=$2)")
                .bind(self.firm).bind(old).fetch_one(&mut **tx).await?;
            if managed {
                return Err(Error::Denied);
            }

            let safe:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM executions e JOIN compute_returns c ON (c.firm_id,c.execution_id)=(e.firm_id,e.id) JOIN reservations r ON (r.firm_id,r.intent_id)=(e.firm_id,e.intent_id) AND r.limit_id='compute' WHERE e.firm_id=$1 AND e.id=$2 AND e.work_id=$3 AND e.terminated AND r.settled AND r.units=c.units)")
                .bind(self.firm).bind(old).bind(r.work_id).fetch_one(&mut **tx).await?;
            if !safe {
                return Err(Error::Conflict);
            }
        }
        let limit = sqlx::query(
            "SELECT capacity,committed FROM limits WHERE firm_id=$1 AND id='compute' FOR UPDATE",
        )
        .bind(self.firm)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(Error::Denied)?;
        if r.units > limit.get::<i64, _>("capacity") - limit.get::<i64, _>("committed") {
            return Err(Error::Capacity);
        }
        let id = Uuid::new_v4();
        let a = self
            .intent(
                tx,
                p,
                "execution.start",
                key,
                input,
                (id, Some(r.delegation_id)),
            )
            .await?;
        self.management_record(tx, ctx, a.intent_id, Some(r.work_id))
            .await?;
        sqlx::query("INSERT INTO executions(firm_id,id,work_id,intent_id,predecessor_id) VALUES($1,$2,$3,$4,$5)").bind(self.firm).bind(id).bind(r.work_id).bind(a.intent_id).bind(r.predecessor_execution_id).execute(&mut **tx).await?;
        if let Some(program) = &program {
            self.save_program(tx, id, &r.profile_id, program).await?;
        }
        sqlx::query("UPDATE limits SET committed=committed+$2 WHERE firm_id=$1 AND id='compute'")
            .bind(self.firm)
            .bind(r.units)
            .execute(&mut **tx)
            .await?;
        sqlx::query(
            "INSERT INTO reservations(firm_id,intent_id,limit_id,units) VALUES($1,$2,'compute',$3)",
        )
        .bind(self.firm)
        .bind(a.intent_id)
        .bind(r.units)
        .execute(&mut **tx)
        .await?;
        sqlx::query("INSERT INTO outbox(firm_id,intent_id) VALUES($1,$2)")
            .bind(self.firm)
            .bind(a.intent_id)
            .execute(&mut **tx)
            .await?;
        Ok(a)
    }
    /// Only a separately authenticated dispatcher may invoke this interface; not a client route.
    pub async fn claim(&self, intent: Uuid, worker: &str) -> Result<Uuid> {
        let mut tx = self.fence().await?;
        self.service_continuation_claim_allowed(&mut tx, intent, worker)
            .await?;
        let id = self.claim_locked(&mut tx, intent, worker).await?;
        tx.commit().await?;
        Ok(id)
    }
    async fn claim_locked(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        worker: &str,
    ) -> Result<Uuid> {
        self.admission_open(tx).await?;
        let row=sqlx::query("SELECT i.*, e.stopped FROM intents i JOIN executions e ON (e.firm_id,e.intent_id)=(i.firm_id,i.id) WHERE i.firm_id=$1 AND i.id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::NotFound)?;
        if row.get::<String, _>("state") != "accepted" || row.get::<bool, _>("stopped") {
            return Err(Error::Denied);
        }
        self.execution_origin_allowed(tx, intent).await?;
        let p: Uuid = row.get("principal_id");
        self.authorize(tx, p, row.get("delegation_id"), "execution.start")
            .await?;
        let enabled: bool =
            sqlx::query_scalar("SELECT enabled FROM principals WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(p)
                .fetch_one(&mut **tx)
                .await?;
        let input: Value = row.get("input");
        let active: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM profiles WHERE firm_id=$1 AND id=$2 AND active)",
        )
        .bind(self.firm)
        .bind(input["profile_id"].as_str().ok_or(Error::Invalid)?)
        .fetch_one(&mut **tx)
        .await?;
        if !enabled || !active {
            return Err(Error::Denied);
        }
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO attempts VALUES($1,$2,$3,$4,'claimed')")
            .bind(self.firm)
            .bind(id)
            .bind(intent)
            .bind(worker)
            .execute(&mut **tx)
            .await?;
        sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut **tx)
            .await?;
        sqlx::query("UPDATE outbox SET claimed=true WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut **tx)
            .await?;
        self.event(tx, p, "dispatch.claimed", intent, json!({"attempt_id":id}))
            .await?;
        Ok(id)
    }
}
fn state(s: String) -> Result<IntentState> {
    serde_json::from_value(json!(s)).map_err(|_| Error::Unavailable)
}
