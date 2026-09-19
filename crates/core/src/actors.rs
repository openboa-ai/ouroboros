use super::*;
use ouroboros_contracts::{BridgeIdentity, OwnerBinding};

/// Authentication material supplied only by the authenticated Gateway boundary.
#[derive(Clone)]
pub enum Actor {
    Human(Caller),
    BoundHuman(Caller, OwnerBinding),
    Instance(BridgeIdentity),
}
impl Actor {
    pub(super) fn human_fingerprint(&self) -> Option<&str> {
        match self {
            Self::Human(c) | Self::BoundHuman(c, _) => Some(c.fingerprint.as_str()),
            Self::Instance(_) => None,
        }
    }
}
impl From<&Caller> for Actor {
    fn from(value: &Caller) -> Self {
        Self::Human(value.clone())
    }
}
impl From<&Actor> for Actor {
    fn from(value: &Actor) -> Self {
        value.clone()
    }
}

pub(super) struct BoundActor {
    pub work: Uuid,
    pub grant: Uuid,
    pub execution: Uuid,
    pub instance: Uuid,
    pub generation: Uuid,
}
pub(super) struct ActorContext {
    pub principal: Uuid,
    pub bound: Option<BoundActor>,
}
impl ActorContext {
    pub fn realm(&self) -> String {
        match &self.bound {
            None => self.principal.to_string(),
            Some(b) => format!("{}/{}/{}", self.principal, b.instance, b.generation),
        }
    }
}

impl Core {
    pub(super) async fn actor_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &Actor,
    ) -> Result<ActorContext> {
        let ctx = self.authenticated_actor_context(tx, actor).await?;
        if let Some(bound) = &ctx.bound
            && self.is_service_execution(tx, bound.execution).await?
        {
            // Scoped service processing cannot escape into management/background work.
            return Err(Error::Denied);
        }
        Ok(ctx)
    }

    pub(super) async fn authenticated_actor_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &Actor,
    ) -> Result<ActorContext> {
        match actor {
            Actor::Human(c) | Actor::BoundHuman(c, _) => {
                let principal = self.authenticate(tx, c).await?;
                if let Actor::BoundHuman(_, expected) = actor {
                    let environment: Uuid =
                        sqlx::query_scalar("SELECT environment_id FROM firms WHERE id=$1")
                            .bind(self.firm)
                            .fetch_one(&mut **tx)
                            .await?;
                    if expected.environment_id != environment
                        || expected.firm_id != self.firm
                        || expected.principal_id != principal
                        || expected.serving_generation != self.serving_generation
                    {
                        return Err(Error::Conflict);
                    }
                }
                Ok(ActorContext {
                    principal,
                    bound: None,
                })
            }
            Actor::Instance(peer) => {
                let r=sqlx::query("SELECT execution_id,instance_id,generation,worker_id FROM runtime_instances WHERE firm_id=$1 AND binding->'peer'=$2 AND phase='released'")
                    .bind(self.firm).bind(json!(peer)).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
                let execution = r.get("execution_id");
                let (_, input) = self
                    .runtime_allowed(tx, execution, &r.get::<String, _>("worker_id"))
                    .await?;
                let principal = self.agent_grant(tx, &input).await?;
                Ok(ActorContext {
                    principal,
                    bound: Some(BoundActor {
                        work: input.work_id,
                        grant: input.agent_delegation_id.ok_or(Error::Denied)?,
                        execution,
                        instance: r.get("instance_id"),
                        generation: r.get("generation"),
                    }),
                })
            }
        }
    }

    pub(super) async fn work_descends(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        root: Uuid,
    ) -> Result<bool> {
        Ok(sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id FROM work WHERE firm_id=$1 AND id=$2 UNION SELECT w.id,w.parent_id FROM work w JOIN chain c ON w.id=c.parent_id WHERE w.firm_id=$1) SELECT EXISTS(SELECT 1 FROM chain WHERE id=$3)")
            .bind(self.firm).bind(work).bind(root).fetch_one(&mut **tx).await?)
    }
    pub(super) async fn grant_descends(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        grant: Uuid,
        root: Uuid,
    ) -> Result<bool> {
        Ok(sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.id,d.parent_id FROM delegations d JOIN chain c ON d.id=c.parent_id WHERE d.firm_id=$1) SELECT EXISTS(SELECT 1 FROM chain WHERE id=$3)")
            .bind(self.firm).bind(grant).bind(root).fetch_one(&mut **tx).await?)
    }
    pub(super) async fn grant_work_roots(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        grant: Uuid,
    ) -> Result<Vec<Uuid>> {
        Ok(sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id,work_root_id FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.id,d.parent_id,d.work_root_id FROM delegations d JOIN chain c ON d.id=c.parent_id WHERE d.firm_id=$1) SELECT DISTINCT work_root_id FROM chain WHERE work_root_id IS NOT NULL")
            .bind(self.firm).bind(grant).fetch_all(&mut **tx).await?)
    }
    pub(super) async fn grant_work_scope(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        grant: Uuid,
        work: Uuid,
    ) -> Result<()> {
        for root in self.grant_work_roots(tx, grant).await? {
            if !self.work_descends(tx, work, root).await? {
                return Err(Error::Denied);
            }
        }
        Ok(())
    }
    pub(super) async fn actor_roots(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
    ) -> Result<Vec<Uuid>> {
        if let Some(b) = &ctx.bound {
            return Ok(vec![b.work]);
        }
        Ok(sqlx::query_scalar("SELECT root_work_id FROM work_controls WHERE firm_id=$1 AND principal_id=$2 ORDER BY root_work_id")
            .bind(self.firm).bind(ctx.principal).fetch_all(&mut **tx).await?)
    }
    pub(super) async fn actor_work_scope(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        work: Uuid,
    ) -> Result<()> {
        for root in self.actor_roots(tx, ctx).await? {
            if self.work_descends(tx, work, root).await? {
                return Ok(());
            }
        }
        Err(Error::Denied)
    }
    pub(super) async fn actor_grant(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        grant: Uuid,
        action: &str,
    ) -> Result<()> {
        if ctx.bound.as_ref().is_some_and(|b| b.grant != grant) {
            return Err(Error::Denied);
        }
        self.authorize(tx, ctx.principal, grant, action).await
    }
    pub(super) async fn actor_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        grant: Uuid,
        work: Uuid,
        action: &str,
    ) -> Result<()> {
        self.actor_grant(tx, ctx, grant, action).await?;
        self.actor_work_scope(tx, ctx, work).await?;
        self.grant_work_scope(tx, grant, work).await
    }
    pub(super) async fn action_grants(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        action: &str,
    ) -> Result<Vec<Uuid>> {
        let candidates = if let Some(b) = &ctx.bound {
            vec![b.grant]
        } else {
            sqlx::query_scalar("SELECT id FROM delegations WHERE firm_id=$1 AND principal_id=$2 AND $3=ANY(actions) ORDER BY id")
                .bind(self.firm).bind(ctx.principal).bind(action).fetch_all(&mut **tx).await?
        };
        let mut grants = Vec::new();
        for d in candidates {
            match self.actor_grant(tx, ctx, d, action).await {
                Ok(()) => grants.push(d),
                Err(Error::Denied) => {}
                Err(e) => return Err(e),
            }
        }
        if grants.is_empty() {
            return Err(Error::Denied);
        }
        Ok(grants)
    }
    pub(super) async fn any_work_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        work: Uuid,
        action: &str,
    ) -> Result<Uuid> {
        self.actor_work_scope(tx, ctx, work).await?;
        for grant in self.action_grants(tx, ctx, action).await? {
            match self.grant_work_scope(tx, grant, work).await {
                Ok(()) => return Ok(grant),
                Err(Error::Denied) => {}
                Err(e) => return Err(e),
            }
        }
        Err(Error::Denied)
    }
    /// Intersect work roots with all ancestor constraints; never enumerate sibling grants for an instance.
    pub(super) async fn readable_roots(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
    ) -> Result<Vec<Uuid>> {
        let bases = self.actor_roots(tx, ctx).await?;
        let mut out = Vec::new();
        for grant in self.action_grants(tx, ctx, "inspect").await? {
            let constraints = self.grant_work_roots(tx, grant).await?;
            for base in &bases {
                let mut root = *base;
                let mut overlaps = true;
                for bound in &constraints {
                    if self.work_descends(tx, root, *bound).await? {
                        continue;
                    }
                    if self.work_descends(tx, *bound, root).await? {
                        root = *bound;
                    } else {
                        overlaps = false;
                        break;
                    }
                }
                if overlaps && !out.contains(&root) {
                    out.push(root);
                }
            }
        }
        Ok(out)
    }
    pub(super) async fn management_record(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        intent: Uuid,
        work: Option<Uuid>,
    ) -> Result<()> {
        sqlx::query("UPDATE intents SET work_id=$3,origin_instance_id=$4,origin_generation=$5 WHERE firm_id=$1 AND id=$2")
            .bind(self.firm).bind(intent).bind(work).bind(ctx.bound.as_ref().map(|b|b.instance)).bind(ctx.bound.as_ref().map(|b|b.generation)).execute(&mut **tx).await?;
        sqlx::query("UPDATE events SET work_id=$3,data=data||jsonb_build_object('origin_instance_id',$4::uuid,'origin_generation',$5::uuid) WHERE firm_id=$1 AND resource_id=$2 AND kind='intent.accepted'")
            .bind(self.firm).bind(intent).bind(work).bind(ctx.bound.as_ref().map(|b|b.instance)).bind(ctx.bound.as_ref().map(|b|b.generation)).execute(&mut **tx).await?;
        Ok(())
    }
    pub(super) async fn unscoped_inspect(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
    ) -> Result<bool> {
        if ctx.bound.is_some() {
            return Ok(false);
        }
        for grant in self.action_grants(tx, ctx, "inspect").await? {
            if self.grant_work_roots(tx, grant).await?.is_empty() {
                return Ok(true);
            }
        }
        Ok(false)
    }
    /// Recheck the submitting scope before dispatch/release, without making an already
    /// released child's lifetime depend on the continued existence of its submitter.
    pub(super) async fn execution_origin_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<()> {
        if self.service_continuation_origin_allowed(tx, intent).await?
            || self.wake_execution_allowed(tx, intent).await?
        {
            return Ok(());
        }
        self.management_origin_allowed(tx, intent, "execution.start")
            .await
    }
    pub(super) async fn management_origin_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        operation: &str,
    ) -> Result<()> {
        let row=sqlx::query("SELECT principal_id,delegation_id,work_id,origin_instance_id,origin_generation FROM intents WHERE firm_id=$1 AND id=$2 AND operation=$3")
            .bind(self.firm).bind(intent).bind(operation).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let principal = row.get("principal_id");
        let ctx = if let Some(instance) = row.get::<Option<Uuid>, _>("origin_instance_id") {
            let binding:Value=sqlx::query_scalar("SELECT binding FROM runtime_instances WHERE firm_id=$1 AND instance_id=$2 AND generation=$3 AND phase='released'")
                .bind(self.firm).bind(instance).bind(row.get::<Option<Uuid>,_>("origin_generation")).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            let peer =
                serde_json::from_value(binding["peer"].clone()).map_err(|_| Error::Unavailable)?;
            let ctx = self.actor_context(tx, &Actor::Instance(peer)).await?;
            if ctx.principal != principal {
                return Err(Error::Denied);
            }
            ctx
        } else {
            ActorContext {
                principal,
                bound: None,
            }
        };
        self.actor_permission(
            tx,
            &ctx,
            row.get("delegation_id"),
            row.get::<Option<Uuid>, _>("work_id").ok_or(Error::Denied)?,
            operation,
        )
        .await
    }
}
