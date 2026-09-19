//! Scoped Company calls reuse qualified adapters, execution authority and resource reservations.
//! A service instance may observe and use its declared resource slots, not start background work.
use super::*;
use ouroboros_contracts::{ResourceRequest, ServiceInvocation, ServiceOperationPlan};
use sha2::{Digest, Sha256};
use sqlx::postgres::PgRow;

pub(super) fn fingerprint(value: &Value) -> Result<String> {
    fn canonical(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let ordered: std::collections::BTreeMap<_, _> = map.iter().collect();
                Value::Object(
                    ordered
                        .into_iter()
                        .map(|(k, v)| (k.clone(), canonical(v)))
                        .collect(),
                )
            }
            Value::Array(values) => Value::Array(values.iter().map(canonical).collect()),
            value => value.clone(),
        }
    }
    let bytes = serde_json::to_vec(&canonical(value)).map_err(|_| Error::Invalid)?;
    Ok(Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

impl Core {
    pub(super) async fn is_service_execution(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<bool> {
        Ok(sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM service_execution_roots WHERE firm_id=$1 AND execution_id=$2)",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_one(&mut **tx)
        .await?)
    }

    /// Only observation/resource entry points may use this context. Management uses actor_context.
    pub(super) async fn observation_actor(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &Actor,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<(ActorContext, Uuid, Uuid)> {
        let ctx = self.authenticated_actor_context(tx, actor).await?;
        let work = work
            .or_else(|| ctx.bound.as_ref().map(|b| b.work))
            .ok_or(Error::Invalid)?;
        let grant = grant
            .or_else(|| ctx.bound.as_ref().map(|b| b.grant))
            .ok_or(Error::Invalid)?;
        self.actor_permission(tx, &ctx, grant, work, "inspect")
            .await?;
        Ok((ctx, work, grant))
    }

    pub(super) async fn service_root(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<Option<PgRow>> {
        Ok(sqlx::query("SELECT c.*,i.principal_id,i.delegation_id,i.work_id,i.origin_instance_id,i.origin_generation FROM service_execution_roots x JOIN service_calls c ON (c.firm_id,c.root_intent_id)=(x.firm_id,x.root_intent_id) JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.root_intent_id) WHERE x.firm_id=$1 AND x.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?)
    }

    /// Capture registered target configurations at submission so qualification covers those bindings.
    pub(super) async fn capture_service_plan(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        work: Uuid,
        grant: Uuid,
        target: &str,
        plan: &ServiceOperationPlan,
    ) -> Result<Value> {
        if !plan.valid() || serde_json::to_vec(plan).map_err(|_| Error::Invalid)?.len() > 65_536 {
            return Err(Error::Invalid);
        }
        let mut targets = std::collections::BTreeSet::from([target]);
        targets.extend(plan.effects.iter().map(|effect| effect.target.as_str()));
        let mut bindings = Vec::new();
        for target in targets {
            let row = sqlx::query("SELECT configuration,worker_id FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
                .bind(self.firm).bind(target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            let configuration: Value = row.get("configuration");
            self.resource_permission_namespace(
                tx,
                ctx.principal,
                work,
                grant,
                target,
                "inspect",
                super::workspaces::namespace(&configuration)?,
            )
            .await?;
            bindings.push(json!({"target":target,"configuration":configuration,"worker_id":row.get::<String,_>("worker_id")}));
        }
        Ok(json!({"operation":plan,"targets":bindings}))
    }

    async fn service_targets_current(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        selection: &Value,
    ) -> Result<()> {
        for fixed in selection["targets"].as_array().ok_or(Error::Unavailable)? {
            let row = sqlx::query("SELECT configuration,worker_id FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
                .bind(self.firm).bind(fixed["target"].as_str().ok_or(Error::Unavailable)?)
                .fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            if row.get::<Value, _>("configuration") != fixed["configuration"]
                || json!(row.get::<String, _>("worker_id")) != fixed["worker_id"]
            {
                return Err(Error::Conflict);
            }
        }
        Ok(())
    }

    pub(super) async fn prepare_service_invocation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        submission: &PgRow,
        invocation: Option<&ServiceInvocation>,
        previous: Option<Uuid>,
    ) -> Result<Option<Value>> {
        let request: Value = submission.get("request");
        let selection = request.get("service");
        match (selection, invocation) {
            (None, None) => Ok(None),
            (Some(selection), Some(invocation)) => {
                let plan: ServiceOperationPlan =
                    serde_json::from_value(selection["operation"].clone())
                        .map_err(|_| Error::Unavailable)?;
                if invocation.operation != plan.name
                    || !invocation.input.is_object()
                    || serde_json::to_vec(&invocation.input)
                        .map_err(|_| Error::Invalid)?
                        .len()
                        > 65_536
                {
                    return Err(Error::Invalid);
                }
                if let Some(execution) = previous {
                    let old = self
                        .service_root(tx, execution)
                        .await?
                        .ok_or(Error::Conflict)?;
                    if old.get::<Value, _>("invocation") != json!(invocation) {
                        return Err(Error::Conflict);
                    }
                }
                self.service_targets_current(tx, selection).await?;
                Ok(Some(selection.clone()))
            }
            _ => Err(Error::Invalid),
        }
    }

    pub(super) async fn save_service_call(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        accepted: &Accepted,
        activation: Uuid,
        submission: &PgRow,
        selection: Value,
        invocation: &ServiceInvocation,
    ) -> Result<()> {
        let environment: Uuid = sqlx::query_scalar("SELECT environment_id FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut **tx)
            .await?;
        let binding = json!({"environment_id":environment,"firm_id":self.firm,
            "service_slot":submission.get::<String,_>("target_id"),"activation_id":activation,
            "submission_id":submission.get::<Uuid,_>("id"),
            "program_digest":fingerprint(&submission.get::<Value,_>("ticket"))?,
            "operation_digest":fingerprint(&selection)?,"selection":selection});
        sqlx::query("INSERT INTO service_calls VALUES($1,$2,$3,$4,$5,$6,$7)")
            .bind(self.firm)
            .bind(accepted.intent_id)
            .bind(accepted.resource_id)
            .bind(activation)
            .bind(binding)
            .bind(json!(invocation))
            .bind(fingerprint(&json!(invocation))?)
            .execute(&mut **tx)
            .await?;
        Ok(())
    }

    pub(super) async fn check_service_binding(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
    ) -> Result<()> {
        if let Some(root) = self.service_root(tx, execution).await? {
            let binding: Value = root.get("binding");
            let environment: Uuid =
                sqlx::query_scalar("SELECT environment_id FROM firms WHERE id=$1")
                    .bind(self.firm)
                    .fetch_one(&mut **tx)
                    .await?;
            if binding["environment_id"] != json!(environment)
                || binding["firm_id"] != json!(self.firm)
            {
                return Err(Error::Conflict);
            }
            self.service_targets_current(tx, &binding["selection"])
                .await?;
        }
        Ok(())
    }

    /// Return canonical root/slot metadata. Only the actual instance determines the root.
    pub(super) async fn prepare_service_effect(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        request: &mut ResourceRequest,
    ) -> Result<Option<(Uuid, String, String)>> {
        let root = match &ctx.bound {
            Some(bound) => self.service_root(tx, bound.execution).await?,
            None => None,
        };
        let Some(root) = root else {
            if request.effect_slot.is_some() || request.request_key.starts_with("service:") {
                return Err(Error::Denied);
            }
            return Ok(None);
        };
        let bound = ctx.bound.as_ref().ok_or(Error::Denied)?;
        if request.work_id.is_some_and(|work| work != bound.work)
            || request
                .delegation_id
                .is_some_and(|grant| grant != bound.grant)
        {
            return Err(Error::Denied);
        }
        let slot = request.effect_slot.as_ref().ok_or(Error::Denied)?;
        let binding: Value = root.get("binding");
        let plan: ServiceOperationPlan =
            serde_json::from_value(binding["selection"]["operation"].clone())
                .map_err(|_| Error::Unavailable)?;
        let effect = plan
            .effects
            .iter()
            .find(|effect| &effect.slot == slot)
            .ok_or(Error::Denied)?;
        if request.target != effect.target
            || request.operation != effect.operation
            || serde_json::to_vec(&request.input)
                .map_err(|_| Error::Invalid)?
                .len()
                > effect.max_input_bytes as usize
            || !effect
                .input_equals
                .iter()
                .all(|(key, value)| request.input.get(key) == Some(value))
        {
            return Err(Error::Denied);
        }
        self.service_caller_permission(tx, &root, &request.target, &request.operation)
            .await?;
        let root_id: Uuid = root.get("root_intent_id");
        let material = json!({"work_id":bound.work,"target":request.target,"operation":request.operation,"input":request.input});
        let digest = fingerprint(&material)?;
        if let Some(previous) = sqlx::query_scalar::<_,String>("SELECT input_fingerprint FROM service_effects WHERE firm_id=$1 AND root_intent_id=$2 AND effect_slot=$3")
            .bind(self.firm).bind(root_id).bind(slot).fetch_optional(&mut **tx).await?
            && previous != digest { return Err(Error::Conflict); }
        request.request_key = format!("service:{}:{slot}", root_id.simple());
        Ok(Some((root_id, slot.clone(), digest)))
    }

    pub(super) async fn service_caller_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        root: &PgRow,
    ) -> Result<ActorContext> {
        let principal = root.get("principal_id");
        let bound = if let Some(instance) = root.get::<Option<Uuid>, _>("origin_instance_id") {
            // Authority continues through the original grant/work; caller process exit alone
            // does not create a replacement origin or revive its privileges.
            let origin = sqlx::query("SELECT r.execution_id,e.work_id,(i.input->>'agent_delegation_id')::uuid AS grant FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE r.firm_id=$1 AND r.instance_id=$2 AND r.generation=$3")
                .bind(self.firm).bind(instance).bind(root.get::<Option<Uuid>,_>("origin_generation"))
                .fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            Some(super::actors::BoundActor {
                work: origin.get("work_id"),
                grant: origin.get("grant"),
                execution: origin.get("execution_id"),
                instance,
                generation: root
                    .get::<Option<Uuid>, _>("origin_generation")
                    .ok_or(Error::Denied)?,
            })
        } else {
            None
        };
        Ok(ActorContext { principal, bound })
    }

    pub(super) async fn service_caller_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        root: &PgRow,
        target: &str,
        operation: &str,
    ) -> Result<()> {
        let ctx = self.service_caller_context(tx, root).await?;
        self.actor_permission(
            tx,
            &ctx,
            root.get("delegation_id"),
            root.get("work_id"),
            operation,
        )
        .await?;
        let binding: Value = root.get("binding");
        let target_binding = binding["selection"]["targets"]
            .as_array()
            .ok_or(Error::Unavailable)?
            .iter()
            .find(|fixed| fixed["target"] == target)
            .ok_or(Error::Denied)?;
        self.resource_permission_namespace(
            tx,
            root.get("principal_id"),
            root.get("work_id"),
            root.get("delegation_id"),
            target,
            operation,
            super::workspaces::namespace(&target_binding["configuration"])?,
        )
        .await
    }

    /// Receipts and dispatch may use only this root's child or its exact admitted program input.
    pub(super) async fn service_intent_scope(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        intent: Uuid,
    ) -> Result<()> {
        let Some(bound) = &ctx.bound else {
            return Ok(());
        };
        let Some(root) = self.service_root(tx, bound.execution).await? else {
            return Ok(());
        };
        let linked: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM service_effects WHERE firm_id=$1 AND root_intent_id=$2 AND child_intent_id=$3) OR EXISTS(SELECT 1 FROM execution_inputs WHERE firm_id=$1 AND execution_id=$4 AND read_intent_id=$3 AND read_instance_id=$5 AND read_generation=$6 AND retained)")
            .bind(self.firm).bind(root.get::<Uuid,_>("root_intent_id")).bind(intent).bind(bound.execution).bind(bound.instance).bind(bound.generation)
            .fetch_one(&mut **tx).await?;
        if !linked {
            return Err(Error::Denied);
        }
        if let Some(target) = sqlx::query_scalar::<_,String>("SELECT r.target_id FROM service_effects e JOIN resource_calls r ON (r.firm_id,r.intent_id)=(e.firm_id,e.child_intent_id) WHERE e.firm_id=$1 AND e.root_intent_id=$2 AND e.child_intent_id=$3")
            .bind(self.firm).bind(root.get::<Uuid,_>("root_intent_id")).bind(intent).fetch_optional(&mut **tx).await? {
            self.service_caller_permission(tx, &root, &target, "inspect").await?;
        }
        Ok(())
    }

    pub(super) async fn check_service_child(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<()> {
        let child = sqlx::query("SELECT ri.execution_id,r.target_id,r.operation FROM service_effects e JOIN resource_calls r ON (r.firm_id,r.intent_id)=(e.firm_id,e.child_intent_id) JOIN runtime_instances ri ON (ri.firm_id,ri.instance_id)=(r.firm_id,r.instance_id) WHERE e.firm_id=$1 AND e.child_intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?;
        if let Some(child) = child {
            let execution = child.get("execution_id");
            self.check_adapter_invocation(tx, execution).await?;
            let root = self
                .service_root(tx, execution)
                .await?
                .ok_or(Error::Denied)?;
            self.service_caller_permission(
                tx,
                &root,
                &child.get::<String, _>("target_id"),
                &child.get::<String, _>("operation"),
            )
            .await?;
        }
        Ok(())
    }

    /// Metadata does not substitute for resource receipt access or external settlement.
    pub(super) async fn service_observation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        include_input: bool,
    ) -> Result<Option<Value>> {
        let Some(root) = self.service_root(tx, execution).await? else {
            return Ok(None);
        };
        let assignment: Option<Value> = sqlx::query_scalar("SELECT jsonb_build_object('instance_id',r.instance_id,'generation',r.generation,'worker_id',r.worker_id,'attempt_id',r.attempt_id,'phase',r.phase,'service_principal_id',d.principal_id,'service_delegation_id',d.id) FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) JOIN delegations d ON d.firm_id=i.firm_id AND d.id=(i.input->>'agent_delegation_id')::uuid WHERE r.firm_id=$1 AND r.execution_id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?;
        let effects: Vec<Value> = sqlx::query_scalar("SELECT jsonb_build_object('effect_slot',e.effect_slot,'intent_id',e.child_intent_id,'input_fingerprint',e.input_fingerprint,'operation',i.operation,'state',i.state,'worker_id',r.worker_id,'attempt_id',a.id,'receipt_available',r.reply IS NOT NULL) FROM service_effects e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.child_intent_id) JOIN resource_calls r ON (r.firm_id,r.intent_id)=(e.firm_id,e.child_intent_id) LEFT JOIN attempts a ON (a.firm_id,a.intent_id)=(e.firm_id,e.child_intent_id) WHERE e.firm_id=$1 AND e.root_intent_id=$2 ORDER BY e.effect_slot")
            .bind(self.firm).bind(root.get::<Uuid,_>("root_intent_id")).fetch_all(&mut **tx).await?;
        let mut out = json!({"root_intent_id":root.get::<Uuid,_>("root_intent_id"),"execution_id":execution,
            "binding":root.get::<Value,_>("binding"),"effective_caller":{"principal_id":root.get::<Uuid,_>("principal_id"),"work_id":root.get::<Uuid,_>("work_id"),"delegation_id":root.get::<Uuid,_>("delegation_id"),"instance_id":root.get::<Option<Uuid>,_>("origin_instance_id"),"generation":root.get::<Option<Uuid>,_>("origin_generation")},
            "assignment":assignment,"input_fingerprint":root.get::<String,_>("input_fingerprint"),"effects":effects,"effects_settled":false});
        // Target configuration is protected admission material, not display/agent data.
        out["binding"]
            .as_object_mut()
            .ok_or(Error::Unavailable)?
            .remove("selection");
        if include_input {
            let binding: Value = root.get("binding");
            self.service_caller_permission(
                tx,
                &root,
                binding["service_slot"].as_str().ok_or(Error::Unavailable)?,
                "inspect",
            )
            .await?;
            out["invocation"] = root.get("invocation");
            out["operation_plan"] =
                root.get::<Value, _>("binding")["selection"]["operation"].clone();
        }
        Ok(Some(out))
    }
}
