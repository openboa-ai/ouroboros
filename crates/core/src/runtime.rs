//! Runtime authority stays in Core. Service authentication is enforced by the HTTP boundary.
use super::*;
use ouroboros_contracts::{BridgeIdentity, RuntimeBinding, RuntimeTicket};
impl Core {
    pub(super) async fn agent_grant(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        input: &ExecutionRequest,
    ) -> Result<Uuid> {
        let grant = input.agent_delegation_id.ok_or(Error::Denied)?;
        let p: Option<Uuid> = sqlx::query_scalar("SELECT d.principal_id FROM delegations d JOIN principals p ON (p.firm_id,p.id)=(d.firm_id,d.principal_id) WHERE d.firm_id=$1 AND d.id=$2 AND p.kind='agent' AND p.enabled")
            .bind(self.firm).bind(grant).fetch_optional(&mut **tx).await?;
        let p = p.ok_or(Error::Denied)?;
        let linked: bool = sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.id,d.parent_id FROM delegations d JOIN chain c ON d.id=c.parent_id WHERE d.firm_id=$1) SELECT EXISTS(SELECT 1 FROM chain WHERE id=$3)")
            .bind(self.firm).bind(grant).bind(input.delegation_id).fetch_one(&mut **tx).await?;
        if !linked {
            return Err(Error::Denied);
        }
        self.grant_work_scope(tx, grant, input.work_id).await?;
        self.authorize(tx, p, grant, "inspect").await?;
        self.authorize(tx, p, grant, "execution.start").await?;
        Ok(p)
    }
    pub async fn runtime_pending(&self, profile: &str) -> Result<Vec<Uuid>> {
        Ok(sqlx::query_scalar("SELECT i.id FROM intents i JOIN outbox o ON (o.firm_id,o.intent_id)=(i.firm_id,i.id) JOIN executions e ON (e.firm_id,e.intent_id)=(i.firm_id,i.id) WHERE i.firm_id=$1 AND i.state='accepted' AND NOT o.claimed AND NOT e.stopped AND i.input->>'profile_id'=$2 AND i.input->>'agent_delegation_id' IS NOT NULL ORDER BY i.created_at LIMIT 8")
            .bind(self.firm).bind(profile).fetch_all(&self.pool).await?)
    }
    /// A claimed start cannot be reclaimed after response loss; reconcile the original record.
    pub async fn runtime_claim(&self, intent: Uuid, worker: &str) -> Result<RuntimeTicket> {
        let mut tx = self.fence().await?;
        let attempt = self.claim_locked(&mut tx, intent, worker).await?;
        let row = sqlx::query(
            "SELECT input,resource_id,principal_id FROM intents WHERE firm_id=$1 AND id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_one(&mut *tx)
        .await?;
        let input: ExecutionRequest =
            serde_json::from_value(row.get("input")).map_err(|_| Error::Invalid)?;
        let owner: Uuid = row.get("principal_id");
        self.authorize(&mut tx, owner, input.delegation_id, "execution.start")
            .await?;
        self.agent_grant(&mut tx, &input).await?;
        let program = self
            .program_ticket(&mut tx, row.get("resource_id"), true)
            .await?;
        let ticket = RuntimeTicket {
            execution_id: row.get("resource_id"),
            intent_id: intent,
            attempt_id: attempt,
            instance_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            input,
            program,
        };
        sqlx::query("INSERT INTO runtime_instances VALUES($1,$2,$3,$4,$5,$6,'preparing',NULL,clock_timestamp()+make_interval(secs=>$7))")
            .bind(self.firm).bind(ticket.execution_id).bind(attempt).bind(worker).bind(ticket.instance_id).bind(ticket.generation).bind(ticket.input.lifetime_seconds as f64).execute(&mut *tx).await?;
        self.event(
            &mut tx,
            owner,
            "runtime.preparing",
            ticket.execution_id,
            json!({"attempt_id":attempt}),
        )
        .await?;
        tx.commit().await?;
        Ok(ticket)
    }
    pub(super) async fn runtime_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        worker: &str,
    ) -> Result<(Uuid, ExecutionRequest)> {
        let row=sqlx::query("SELECT i.id AS intent_id,i.principal_id,i.input FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) JOIN principals p ON (p.firm_id,p.id)=(i.firm_id,i.principal_id) JOIN profiles f ON f.firm_id=i.firm_id AND f.id=i.input->>'profile_id' WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.worker_id=$3 AND r.deadline_at>clock_timestamp() AND r.phase!='terminated' AND NOT e.stopped AND NOT e.terminated AND p.enabled AND f.active")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        self.wake_execution_allowed(tx, row.get("intent_id"))
            .await?;
        let owner: Uuid = row.get("principal_id");
        let input: ExecutionRequest =
            serde_json::from_value(row.get("input")).map_err(|_| Error::Invalid)?;
        self.authorize(tx, owner, input.delegation_id, "execution.start")
            .await?;
        self.grant_work_scope(tx, input.delegation_id, input.work_id)
            .await?;
        self.agent_grant(tx, &input).await?;
        self.program_ticket(tx, execution, true).await?;
        Ok((owner, input))
    }
    pub async fn runtime_bind(
        &self,
        execution: Uuid,
        worker: &str,
        binding: RuntimeBinding,
    ) -> Result<()> {
        let allocation = binding.allocation.as_ref().ok_or(Error::Invalid)?;
        if allocation.boot_id.is_nil()
            || allocation.device == 0
            || allocation.inode == 0
            || allocation.events_inode == 0
            || allocation.boot_id.to_string() != binding.peer.boot_id
            || binding.container_id.len() != 64
            || !binding.container_id.bytes().all(|b| b.is_ascii_hexdigit())
            || binding.peer.pid <= 0
            || binding.peer.uid < 100000
            || binding.peer.start_ticks == 0
            || Uuid::parse_str(&binding.peer.boot_id).is_err()
            || binding.deadline_boottime_ns == 0
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let (owner, _) = self.runtime_allowed(&mut tx, execution, worker).await?;
        let row=sqlx::query("SELECT phase,binding,instance_id,generation FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2").bind(self.firm).bind(execution).fetch_one(&mut *tx).await?;
        if row.get::<String, _>("phase") != "preparing" {
            return if row.get::<Option<Value>, _>("binding") == Some(json!(binding)) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        let phase = if self
            .program_ticket(&mut tx, execution, true)
            .await?
            .is_some()
        {
            "materializing"
        } else {
            "bound"
        };
        sqlx::query(
            "UPDATE runtime_instances SET binding=$3,phase=$4 WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .bind(json!(binding))
        .bind(phase)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE executions SET instance_id=$3,generation=$4 WHERE firm_id=$1 AND id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .bind(row.get::<Uuid, _>("instance_id"))
        .bind(row.get::<Uuid, _>("generation"))
        .execute(&mut *tx)
        .await?;
        self.event(&mut tx,owner,"runtime.bound",execution,json!({"instance_id":row.get::<Uuid,_>("instance_id"),"source":"runtime","container_id":binding.container_id})).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn runtime_release(&self, execution: Uuid, worker: &str) -> Result<()> {
        let mut tx = self.fence().await?;
        self.admission_open(&mut tx).await?;
        let (owner, input) = self.runtime_allowed(&mut tx, execution, worker).await?;
        let intent: Uuid =
            sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(execution)
                .fetch_one(&mut *tx)
                .await?;
        self.execution_origin_allowed(&mut tx, intent).await?;
        // Historical bindings remain readable for stop/reconciliation, never upgraded
        // into a new private-release permit without the original allocation evidence.
        let binding: Option<Value> = sqlx::query_scalar(
            "SELECT binding FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_one(&mut *tx)
        .await?;
        let binding: RuntimeBinding =
            serde_json::from_value(binding.ok_or(Error::Denied)?).map_err(|_| Error::Denied)?;
        if binding.allocation.is_none() {
            return Err(Error::Denied);
        }

        let program = self.program_ticket(&mut tx, execution, true).await?;
        if let Some(program) = &program {
            self.program_materialization_ready(&mut tx, execution, program)
                .await?;
        } else if input.profile_id == "codex-fixture" {
            let principal = self.agent_grant(&mut tx, &input).await?;
            self.resource_permission(
                &mut tx,
                principal,
                input.work_id,
                input.agent_delegation_id.ok_or(Error::Denied)?,
                "catalog",
                "file.read",
            )
            .await?;
            let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_targets WHERE firm_id=$1 AND id='catalog' AND active AND configuration ? 'workspace_id')").bind(self.firm).fetch_one(&mut *tx).await?;
            if !active {
                return Err(Error::Denied);
            }
        }
        let required_phase = if program.is_some() {
            "materializing"
        } else {
            "bound"
        };
        let changed=sqlx::query("UPDATE runtime_instances SET phase='released' WHERE firm_id=$1 AND execution_id=$2 AND phase=$3").bind(self.firm).bind(execution).bind(required_phase).execute(&mut *tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Conflict);
        }
        self.event(
            &mut tx,
            owner,
            "runtime.release_authorized",
            execution,
            json!({"source":"core","running_confirmed":false}),
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn runtime_permitted(&self, execution: Uuid, worker: &str) -> Result<Value> {
        let mut tx = self.fence().await?;
        self.admission_open(&mut tx).await?;
        self.runtime_allowed(&mut tx, execution, worker).await?;
        Ok(json!({"permitted":true}))
    }
    /// Assigned observer only: old binding lookup is not a new execution permit.
    pub async fn runtime_history(&self, execution: Uuid, worker: &str) -> Result<Value> {
        sqlx::query_scalar("SELECT jsonb_build_object('execution_id',execution_id,'instance_id',instance_id,'generation',generation,'phase',phase,'binding',binding,'compute_return',(SELECT receipt FROM compute_returns c WHERE (c.firm_id,c.execution_id)=(runtime_instances.firm_id,runtime_instances.execution_id))) FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2 AND worker_id=$3")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&self.pool).await?.ok_or(Error::Denied)
    }
    pub async fn runtime_terminated(&self, execution: Uuid, worker: &str) -> Result<()> {
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT i.principal_id,r.phase FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.worker_id=$3").bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        if row.get::<String, _>("phase") == "terminated" {
            return Ok(());
        }
        sqlx::query(
            "UPDATE runtime_instances SET phase='terminated' WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE executions SET terminated=true WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(execution)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            row.get("principal_id"),
            "runtime.terminated",
            execution,
            json!({"source":"runtime","reservation_settled":false}),
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn instance_conditions(&self, peer: BridgeIdentity) -> Result<Value> {
        self.conditions(Actor::Instance(peer)).await
    }
}
