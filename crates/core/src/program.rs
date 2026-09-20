//! Retained program inputs and the narrow pre-release materialization capability.
use super::actors::BoundActor;
use super::workspaces::{config_uuid, namespace};
use super::*;
use ouroboros_contracts::{
    BridgeIdentity, MaterializationReceipt, MaterializedInput, ProgramInput, ProgramInputAdmission,
    ProgramProfile, ProgramRequest, ProgramTicket, ResolvedProgramInput, ResourceReply,
    ResourceRequest, program_manifest_digest,
};

struct ResolvedInput {
    input: ResolvedProgramInput,
    source: Uuid,
    configuration: Value,
    worker: String,
}
pub(super) struct ProgramAdmission {
    request: ProgramRequest,
    ticket: ProgramTicket,
    sources: Vec<ResolvedInput>,
}

fn file_input(reference: &ProgramInput) -> Value {
    json!({"workspace_id":reference.workspace_id,"revision":reference.revision,"path":reference.file})
}

fn expected_materialization(
    instance: Uuid,
    generation: Uuid,
    ticket: &ProgramTicket,
) -> MaterializationReceipt {
    MaterializationReceipt {
        instance_id: instance,
        generation,
        manifest_digest: ticket.manifest_digest.clone(),
        files: ticket
            .inputs
            .iter()
            .map(|input| MaterializedInput {
                index: input.index,
                sha256: input.sha256.clone(),
                size: input.size,
            })
            .collect(),
    }
}

impl Core {
    async fn resolve_program_input(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        index: u32,
        reference: &ProgramInput,
    ) -> Result<ResolvedInput> {
        let target = sqlx::query("SELECT configuration,worker_id FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
            .bind(self.firm).bind(&reference.target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let configuration: Value = target.get("configuration");
        let ns = self
            .check_namespace(tx, &reference.target, &configuration)
            .await?
            .ok_or(Error::Denied)?;
        let selected = file_input(reference);
        self.workspace_binding(
            tx,
            Uuid::nil(),
            work,
            &reference.target,
            "file.read",
            &selected,
            &configuration,
            true,
        )
        .await?;
        self.reference_barriers(tx, work, &reference.target, "file.read", &selected)
            .await?;
        let sources = sqlx::query("SELECT r.intent_id,r.configuration,r.reply,i.input FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state='succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid) AND r.reply->'receipt'->'revision'=to_jsonb($5::bigint)")
            .bind(self.firm).bind(work).bind(&reference.target).bind(reference.workspace_id).bind(reference.revision)
            .fetch_all(&mut **tx).await?;
        if sources.len() != 1 {
            return Err(Error::Denied);
        }
        let source = &sources[0];
        let source_id: Uuid = source.get("intent_id");
        let original_cfg: Value = source.get("configuration");
        let store = config_uuid(&configuration, "store_id")?;
        let generation = config_uuid(&configuration, "storage_generation")?;
        if namespace(&original_cfg)? != Some(ns)
            || config_uuid(&original_cfg, "store_id")? != store
            || config_uuid(&original_cfg, "storage_generation")? != generation
        {
            return Err(Error::Denied);
        }
        let publication: ResourceReply = serde_json::from_value(
            source
                .get::<Option<Value>, _>("reply")
                .ok_or(Error::Denied)?,
        )
        .map_err(|_| Error::Denied)?;
        let original: Value = source.get("input");
        if !(200..300).contains(&publication.status)
            || publication.content_type != "application/json"
            || serde_json::from_str::<Value>(&publication.body).map_err(|_| Error::Denied)?
                != json!({"intent_id":source_id,"revision":reference.revision})
            || publication.receipt
                != json!({"source":"catalog","publication_receipt":source_id,"revision":reference.revision})
            || original["input"]["expected_revision"]
                .as_i64()
                .and_then(|n| n.checked_add(1))
                != Some(reference.revision)
        {
            return Err(Error::Denied);
        }
        let upload = original["input"]["files"][&reference.file]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or(Error::Denied)?;
        let row = sqlx::query("SELECT r.configuration,r.reply,i.input FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.target_id=$4 AND r.operation='file.upload' AND i.state='succeeded'")
            .bind(self.firm).bind(upload).bind(work).bind(&reference.target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let upload_cfg: Value = row.get("configuration");
        if namespace(&upload_cfg)? != Some(ns)
            || config_uuid(&upload_cfg, "store_id")? != store
            || config_uuid(&upload_cfg, "storage_generation")? != generation
        {
            return Err(Error::Denied);
        }
        let input: Value = row.get("input");
        let reply: ResourceReply =
            serde_json::from_value(row.get::<Option<Value>, _>("reply").ok_or(Error::Denied)?)
                .map_err(|_| Error::Denied)?;
        let object = super::upload_completion::validate(upload, &input["input"], &reply)
            .map_err(|_| Error::Denied)?
            .ok_or(Error::Denied)?;
        let size = input["input"]["size"].as_u64().ok_or(Error::Denied)?;
        let digest = input["input"]["sha256"]
            .as_str()
            .ok_or(Error::Denied)?
            .to_owned();
        let allocated: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM storage_allocations WHERE firm_id=$1 AND intent_id=$2 AND store_id=$3 AND generation=$4 AND bytes=$5 AND sha256=$6)")
            .bind(self.firm).bind(upload).bind(store).bind(generation).bind(size as i64).bind(&digest).fetch_one(&mut **tx).await?;
        if !allocated {
            return Err(Error::Denied);
        }
        let max = configuration["max_file_bytes"]
            .as_u64()
            .filter(|n| *n > 0 && *n <= i64::MAX as u64)
            .ok_or(Error::Unavailable)?;
        configuration["transfer_seconds"]
            .as_u64()
            .filter(|n| (1..=300).contains(n))
            .ok_or(Error::Unavailable)?;
        if size > max {
            return Err(Error::Denied);
        }
        Ok(ResolvedInput {
            input: ResolvedProgramInput {
                index,
                reference: reference.clone(),
                namespace_id: ns,
                upload_id: upload,
                object_id: object,
                store_id: store,
                generation,
                sha256: digest,
                size,
            },
            source: source_id,
            configuration,
            worker: target.get("worker_id"),
        })
    }

    pub(super) async fn prepare_program(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        request: &ExecutionRequest,
    ) -> Result<Option<ProgramAdmission>> {
        let configured = sqlx::query(
            "SELECT profile,active FROM program_profiles WHERE firm_id=$1 AND profile_id=$2",
        )
        .bind(self.firm)
        .bind(&request.profile_id)
        .fetch_optional(&mut **tx)
        .await?;
        let Some(program) = &request.program else {
            return if configured.is_some() {
                Err(Error::Denied)
            } else {
                Ok(None)
            };
        };
        let configured = configured.ok_or(Error::Denied)?;
        if !configured.get::<bool, _>("active") {
            return Err(Error::Denied);
        }
        let profile: ProgramProfile =
            serde_json::from_value(configured.get("profile")).map_err(|_| Error::Unavailable)?;
        program.validate(&profile).map_err(|_| Error::Invalid)?;
        if request.units != profile.compute_units
            || request.lifetime_seconds <= 0
            || request.lifetime_seconds as u64 > profile.lifetime_seconds
        {
            return Err(Error::Denied);
        }
        if let Some(native) = &program.native {
            match (&native.resume, request.predecessor_execution_id) {
                (Some(resume), Some(previous)) => {
                    let valid: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM native_turns n JOIN executions e ON (e.firm_id,e.id)=(n.firm_id,n.execution_id) JOIN execution_programs p ON (p.firm_id,p.execution_id)=(e.firm_id,e.id) WHERE n.firm_id=$1 AND e.id=$2 AND e.work_id=$3 AND n.thread_id=$4 AND n.status IN ('completed','interrupted','failed') AND p.profile->>'image'=$5 AND p.profile->'native_codex'='true'::jsonb)")
                        .bind(self.firm).bind(previous).bind(request.work_id).bind(resume.thread_id.to_string()).bind(&profile.image).fetch_one(&mut **tx).await?;
                    if !valid {
                        return Err(Error::Denied);
                    }
                }
                (None, None) => {}
                _ => return Err(Error::Invalid),
            }
        }
        let agent = self.agent_grant(tx, request).await?;
        let grant = request.agent_delegation_id.ok_or(Error::Denied)?;
        let mut sources = Vec::new();
        let mut total = 0u64;
        for (index, input) in program.inputs.iter().enumerate() {
            let resolved = self
                .resolve_program_input(tx, request.work_id, index as u32, input)
                .await?;
            for action in ["inspect", "file.read"] {
                self.actor_permission(tx, ctx, request.delegation_id, request.work_id, action)
                    .await?;
                self.resource_permission_namespace(
                    tx,
                    ctx.principal,
                    request.work_id,
                    request.delegation_id,
                    &input.target,
                    action,
                    Some(resolved.input.namespace_id),
                )
                .await?;
                self.resource_permission_namespace(
                    tx,
                    agent,
                    request.work_id,
                    grant,
                    &input.target,
                    action,
                    Some(resolved.input.namespace_id),
                )
                .await?;
            }
            total = total
                .checked_add(resolved.input.size)
                .ok_or(Error::Denied)?;
            if resolved.input.size > profile.max_file_bytes || total > profile.max_input_bytes {
                return Err(Error::Denied);
            }
            sources.push(resolved);
        }
        let inputs: Vec<_> = sources.iter().map(|s| s.input.clone()).collect();
        let digest = program_manifest_digest(&profile, &inputs).map_err(|_| Error::Unavailable)?;
        Ok(Some(ProgramAdmission {
            request: program.clone(),
            ticket: ProgramTicket {
                profile,
                manifest_digest: digest,
                inputs,
            },
            sources,
        }))
    }

    pub(super) async fn save_program(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        profile_id: &str,
        a: &ProgramAdmission,
    ) -> Result<()> {
        sqlx::query("INSERT INTO execution_programs(firm_id,execution_id,profile_id,profile,request,manifest_digest) VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm).bind(execution).bind(profile_id).bind(json!(a.ticket.profile)).bind(json!(a.request)).bind(&a.ticket.manifest_digest)
            .execute(&mut **tx).await?;
        for source in &a.sources {
            let input = &source.input;
            sqlx::query("INSERT INTO execution_inputs(firm_id,execution_id,input_index,source_intent_id,target_id,namespace_id,workspace_id,revision,resolved,configuration,worker_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
                .bind(self.firm).bind(execution).bind(input.index as i32).bind(source.source).bind(&input.reference.target)
                .bind(input.namespace_id).bind(input.reference.workspace_id).bind(input.reference.revision).bind(json!(input))
                .bind(&source.configuration).bind(&source.worker).execute(&mut **tx).await?;
        }
        Ok(())
    }

    pub(super) async fn program_ticket(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        current: bool,
    ) -> Result<Option<ProgramTicket>> {
        if current {
            self.check_adapter_verification(tx, execution).await?;
            self.check_adapter_invocation(tx, execution).await?;
        }
        let row = sqlx::query("SELECT p.*,i.input FROM executions e JOIN intents i ON(i.firm_id,i.id)=(e.firm_id,e.intent_id) LEFT JOIN execution_programs p ON(p.firm_id,p.execution_id)=(e.firm_id,e.id) WHERE e.firm_id=$1 AND e.id=$2")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let request: ExecutionRequest =
            serde_json::from_value(row.get("input")).map_err(|_| Error::Unavailable)?;
        if row.get::<Option<Uuid>, _>("execution_id").is_none() {
            if request.program.is_some() {
                return Err(Error::Denied);
            }
            let registered: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM program_profiles WHERE firm_id=$1 AND profile_id=$2)",
            )
            .bind(self.firm)
            .bind(&request.profile_id)
            .fetch_one(&mut **tx)
            .await?;
            return if current && registered {
                Err(Error::Denied)
            } else {
                Ok(None)
            };
        }
        let profile: ProgramProfile =
            serde_json::from_value(row.get("profile")).map_err(|_| Error::Unavailable)?;
        let program: ProgramRequest =
            serde_json::from_value(row.get("request")).map_err(|_| Error::Unavailable)?;
        program.validate(&profile).map_err(|_| Error::Unavailable)?;
        if request.program.as_ref() != Some(&program)
            || request.profile_id != row.get::<String, _>("profile_id")
            || request.units != profile.compute_units
            || request.lifetime_seconds <= 0
            || request.lifetime_seconds as u64 > profile.lifetime_seconds
        {
            return Err(Error::Denied);
        }
        let agent = if current {
            let active: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM program_profiles p JOIN profiles f ON(f.firm_id,f.id)=(p.firm_id,p.profile_id) WHERE p.firm_id=$1 AND p.profile_id=$2 AND p.active AND f.active AND p.profile=$3 AND f.max_units>=$4 AND f.max_lifetime_seconds>=$5)")
                .bind(self.firm).bind(&request.profile_id).bind(json!(profile)).bind(request.units).bind(request.lifetime_seconds)
                .fetch_one(&mut **tx).await?;
            if !active {
                return Err(Error::Denied);
            }
            Some(self.agent_grant(tx, &request).await?)
        } else {
            None
        };
        let stored = sqlx::query("SELECT * FROM execution_inputs WHERE firm_id=$1 AND execution_id=$2 ORDER BY input_index")
            .bind(self.firm).bind(execution).fetch_all(&mut **tx).await?;
        if stored.len() != program.inputs.len() {
            return Err(Error::Denied);
        }
        let mut inputs = Vec::new();
        let mut total = 0u64;
        for (index, row) in stored.iter().enumerate() {
            let input: ResolvedProgramInput =
                serde_json::from_value(row.get("resolved")).map_err(|_| Error::Unavailable)?;
            if row.get::<i32, _>("input_index") != index as i32
                || input.index != index as u32
                || input.reference != program.inputs[index]
                || !row.get::<bool, _>("retained")
                || input.reference.target != row.get::<String, _>("target_id")
                || input.namespace_id != row.get::<Uuid, _>("namespace_id")
                || input.reference.workspace_id != row.get::<Uuid, _>("workspace_id")
                || input.reference.revision != row.get::<i64, _>("revision")
            {
                return Err(Error::Denied);
            }
            total = total.checked_add(input.size).ok_or(Error::Denied)?;
            if input.size > profile.max_file_bytes || total > profile.max_input_bytes {
                return Err(Error::Denied);
            }
            if let Some(agent) = agent {
                let fresh = self
                    .resolve_program_input(tx, request.work_id, index as u32, &input.reference)
                    .await?;
                if fresh.input != input
                    || fresh.source != row.get::<Uuid, _>("source_intent_id")
                    || fresh.configuration != row.get::<Value, _>("configuration")
                    || fresh.worker != row.get::<String, _>("worker_id")
                {
                    return Err(Error::Denied);
                }
                for action in ["inspect", "file.read"] {
                    self.resource_permission_namespace(
                        tx,
                        agent,
                        request.work_id,
                        request.agent_delegation_id.ok_or(Error::Denied)?,
                        &input.reference.target,
                        action,
                        Some(input.namespace_id),
                    )
                    .await?;
                }
            }
            inputs.push(input);
        }
        let manifest_digest: String = row.get("manifest_digest");
        if program_manifest_digest(&profile, &inputs).map_err(|_| Error::Unavailable)?
            != manifest_digest
        {
            return Err(Error::Denied);
        }
        Ok(Some(ProgramTicket {
            profile,
            manifest_digest,
            inputs,
        }))
    }

    /// This context is not accepted by ordinary actor authentication or management routes.
    async fn materializing_context(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        peer: &BridgeIdentity,
    ) -> Result<ActorContext> {
        let row = sqlx::query("SELECT execution_id,instance_id,generation,worker_id FROM runtime_instances WHERE firm_id=$1 AND binding->'peer'=$2 AND phase='materializing'")
            .bind(self.firm).bind(json!(peer)).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let execution = row.get("execution_id");
        let (_, request) = self
            .runtime_allowed(tx, execution, &row.get::<String, _>("worker_id"))
            .await?;
        let start: Uuid =
            sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(execution)
                .fetch_one(&mut **tx)
                .await?;
        self.execution_origin_allowed(tx, start).await?;
        self.program_ticket(tx, execution, true)
            .await?
            .ok_or(Error::Denied)?;
        Ok(ActorContext {
            principal: self.agent_grant(tx, &request).await?,
            bound: Some(BoundActor {
                work: request.work_id,
                grant: request.agent_delegation_id.ok_or(Error::Denied)?,
                execution,
                instance: row.get("instance_id"),
                generation: row.get("generation"),
            }),
        })
    }

    async fn registered_input_read(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        intent: Uuid,
    ) -> Result<()> {
        let b = ctx.bound.as_ref().ok_or(Error::Denied)?;
        let row = sqlx::query("SELECT e.resolved,e.configuration,e.worker_id,r.operation,r.work_id,r.delegation_id,r.instance_id,r.target_id,r.configuration AS actual_configuration,r.worker_id AS actual_worker,i.input,i.principal_id,i.origin_generation FROM execution_inputs e JOIN resource_calls r ON(r.firm_id,r.intent_id)=(e.firm_id,e.read_intent_id) JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE e.firm_id=$1 AND e.execution_id=$2 AND e.read_intent_id=$3 AND e.read_instance_id=$4 AND e.read_generation=$5 AND e.retained")
            .bind(self.firm).bind(b.execution).bind(intent).bind(b.instance).bind(b.generation)
            .fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let input: ResolvedProgramInput =
            serde_json::from_value(row.get("resolved")).map_err(|_| Error::Unavailable)?;
        if row.get::<String, _>("operation") != "file.read"
            || row.get::<Uuid, _>("work_id") != b.work
            || row.get::<Uuid, _>("delegation_id") != b.grant
            || row.get::<Uuid, _>("principal_id") != ctx.principal
            || row.get::<Option<Uuid>, _>("instance_id") != Some(b.instance)
            || row.get::<Option<Uuid>, _>("origin_generation") != Some(b.generation)
            || row.get::<String, _>("target_id") != input.reference.target
            || row.get::<Value, _>("configuration") != row.get::<Value, _>("actual_configuration")
            || row.get::<String, _>("worker_id") != row.get::<String, _>("actual_worker")
            || row.get::<Value, _>("input")
                != json!({"work_id":b.work,"target":input.reference.target,"operation":"file.read","input":file_input(&input.reference)})
        {
            return Err(Error::Denied);
        }
        Ok(())
    }

    pub(super) async fn resource_context_for_intent(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &ResourceActor,
        intent: Uuid,
    ) -> Result<ActorContext> {
        match self.authenticated_actor_context(tx, actor).await {
            Ok(ctx) => {
                self.service_intent_scope(tx, &ctx, intent).await?;
                Ok(ctx)
            }
            Err(Error::Denied) => {
                let Actor::Instance(peer) = actor else {
                    return Err(Error::Denied);
                };
                let ctx = self.materializing_context(tx, peer).await?;
                self.registered_input_read(tx, &ctx, intent).await?;
                Ok(ctx)
            }
            Err(error) => Err(error),
        }
    }

    pub(super) async fn resource_actor_for_intent(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        actor: &ResourceActor,
        intent: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<(Uuid, Uuid, Uuid, Option<Uuid>)> {
        let ctx = self.resource_context_for_intent(tx, actor, intent).await?;
        let work = work
            .or_else(|| ctx.bound.as_ref().map(|b| b.work))
            .ok_or(Error::Invalid)?;
        let grant = grant
            .or_else(|| ctx.bound.as_ref().map(|b| b.grant))
            .ok_or(Error::Invalid)?;
        self.actor_permission(tx, &ctx, grant, work, "inspect")
            .await?;
        Ok((
            ctx.principal,
            work,
            grant,
            ctx.bound.as_ref().map(|b| b.instance),
        ))
    }

    pub async fn program_input_admit(
        &self,
        peer: BridgeIdentity,
        index: u32,
    ) -> Result<ProgramInputAdmission> {
        let mut tx = self.fence().await?;
        let ctx = self.materializing_context(&mut tx, &peer).await?;
        let b = ctx.bound.as_ref().ok_or(Error::Denied)?;
        let ticket = self
            .program_ticket(&mut tx, b.execution, true)
            .await?
            .ok_or(Error::Denied)?;
        let input = ticket
            .inputs
            .get(index as usize)
            .filter(|i| i.index == index)
            .ok_or(Error::Denied)?
            .clone();
        let request = ResourceRequest {
            service_request_id: None,
            effect_slot: None,
            target: input.reference.target.clone(),
            operation: "file.read".into(),
            request_key: format!(
                "input:{}:{}:{index}",
                b.instance.simple(),
                b.generation.simple()
            ),
            input: file_input(&input.reference),
            work_id: Some(b.work),
            delegation_id: Some(b.grant),
        };
        let admission = self
            .resource_admit_locked(&mut tx, &Actor::Instance(peer), &ctx, request)
            .await?;
        let changed = sqlx::query("UPDATE execution_inputs SET read_intent_id=$4,read_instance_id=$5,read_generation=$6 WHERE firm_id=$1 AND execution_id=$2 AND input_index=$3 AND retained AND (read_intent_id IS NULL OR (read_intent_id=$4 AND read_instance_id=$5 AND read_generation=$6))")
            .bind(self.firm).bind(b.execution).bind(index as i32).bind(admission.intent_id).bind(b.instance).bind(b.generation)
            .execute(&mut *tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Denied);
        }
        self.registered_input_read(&mut tx, &ctx, admission.intent_id)
            .await?;
        tx.commit().await?;
        Ok(ProgramInputAdmission { admission, input })
    }

    pub async fn runtime_materialized(
        &self,
        execution: Uuid,
        worker: &str,
        receipt: &MaterializationReceipt,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT instance_id,generation,binding,phase FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2 AND worker_id=$3 AND phase IN ('materializing','released')")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let (_, request) = self.runtime_allowed(&mut tx, execution, worker).await?;
        let intent: Uuid =
            sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(execution)
                .fetch_one(&mut *tx)
                .await?;
        self.execution_origin_allowed(&mut tx, intent).await?;
        let ticket = self
            .program_ticket(&mut tx, execution, true)
            .await?
            .ok_or(Error::Denied)?;
        let expected =
            expected_materialization(row.get("instance_id"), row.get("generation"), &ticket);
        if receipt != &expected {
            return Err(Error::Conflict);
        }
        let prior: Option<Value> = sqlx::query_scalar(
            "SELECT materialization FROM execution_programs WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_one(&mut *tx)
        .await?;
        if let Some(old) = prior {
            return if old == json!(receipt) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        if row.get::<String, _>("phase") != "materializing" {
            return Err(Error::Denied);
        }
        let binding: Value = row.get("binding");
        let peer = serde_json::from_value(binding["peer"].clone()).map_err(|_| Error::Denied)?;
        let ctx = self.materializing_context(&mut tx, &peer).await?;
        for input in &ticket.inputs {
            let read: Uuid = sqlx::query_scalar("SELECT read_intent_id FROM execution_inputs WHERE firm_id=$1 AND execution_id=$2 AND input_index=$3 AND read_intent_id IS NOT NULL")
                .bind(self.firm).bind(execution).bind(input.index as i32).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
            self.registered_input_read(&mut tx, &ctx, read).await?;
            let row = sqlx::query("SELECT r.reply,i.state FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2")
                .bind(self.firm).bind(read).fetch_one(&mut *tx).await?;
            let reply: ResourceReply =
                serde_json::from_value(row.get::<Option<Value>, _>("reply").ok_or(Error::Denied)?)
                    .map_err(|_| Error::Denied)?;
            if row.get::<String, _>("state") != "succeeded"
                || reply.status != 200
                || reply.content_type != "application/octet-stream"
                || !reply.body.is_empty()
                || reply.receipt
                    != json!({"source":"catalog","stage":"prepared","sha256":input.sha256,"size":input.size,"snapshot":file_input(&input.reference)})
            {
                return Err(Error::Denied);
            }
        }
        sqlx::query("UPDATE execution_programs SET materialization=$3 WHERE firm_id=$1 AND execution_id=$2 AND materialization IS NULL")
            .bind(self.firm).bind(execution).bind(json!(receipt)).execute(&mut *tx).await?;
        let principal = self.agent_grant(&mut tx, &request).await?;
        self.event(&mut tx, principal, "runtime.inputs_materialized", execution,
            json!({"instance_id":receipt.instance_id,"generation":receipt.generation,"source":"runtime","manifest_digest":receipt.manifest_digest})).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn runtime_program_observation(
        &self,
        execution: Uuid,
        worker: &str,
        receipt: &ouroboros_contracts::RuntimeProgramObservation,
    ) -> Result<()> {
        let digest = |s: &str| {
            s.len() == 64
                && s.bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        };
        if ![
            &receipt.manifest_digest,
            &receipt.exec_id,
            &receipt.stdout_sha256,
            &receipt.stderr_sha256,
        ]
        .iter()
        .all(|s| digest(s))
            || !(0..=255).contains(&receipt.exit_code)
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT r.instance_id,r.generation,r.phase,p.profile,p.manifest_digest,p.materialization,i.principal_id FROM runtime_instances r JOIN execution_programs p ON (p.firm_id,p.execution_id)=(r.firm_id,r.execution_id) JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.worker_id=$3")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let profile: ProgramProfile =
            serde_json::from_value(row.get("profile")).map_err(|_| Error::Unavailable)?;
        if row.get::<Uuid, _>("instance_id") != receipt.instance_id
            || row.get::<Uuid, _>("generation") != receipt.generation
            || !matches!(
                row.get::<String, _>("phase").as_str(),
                "released" | "terminated"
            )
            || row.get::<Option<Value>, _>("materialization").is_none()
            || row.get::<String, _>("manifest_digest") != receipt.manifest_digest
            || profile.native_codex
            || receipt
                .stdout_bytes
                .checked_add(receipt.stderr_bytes)
                .is_none_or(|n| n > profile.max_output_bytes)
        {
            return Err(Error::Denied);
        }
        let old: Option<Value> = sqlx::query_scalar(
            "SELECT receipt FROM program_observations WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(old) = old {
            return if old == json!(receipt) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        sqlx::query(
            "INSERT INTO program_observations(firm_id,execution_id,receipt) VALUES($1,$2,$3)",
        )
        .bind(self.firm)
        .bind(execution)
        .bind(json!(receipt))
        .execute(&mut *tx)
        .await?;
        self.event(&mut tx,row.get("principal_id"),"runtime.program_observed",execution,
            json!({"source":"runtime_backend","instance_id":receipt.instance_id,"generation":receipt.generation,
                "exit_code":receipt.exit_code,"effects_settled":false,"work_success_confirmed":false})).await?;
        tx.commit().await?;
        Ok(())
    }

    pub(super) async fn program_materialization_ready(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        execution: Uuid,
        ticket: &ProgramTicket,
    ) -> Result<()> {
        let row = sqlx::query("SELECT r.instance_id,r.generation,p.materialization FROM runtime_instances r JOIN execution_programs p ON(p.firm_id,p.execution_id)=(r.firm_id,r.execution_id) WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.phase='materializing'")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        let receipt: MaterializationReceipt = serde_json::from_value(
            row.get::<Option<Value>, _>("materialization")
                .ok_or(Error::Denied)?,
        )
        .map_err(|_| Error::Denied)?;
        if receipt
            != expected_materialization(row.get("instance_id"), row.get("generation"), ticket)
        {
            return Err(Error::Denied);
        }
        Ok(())
    }
}
