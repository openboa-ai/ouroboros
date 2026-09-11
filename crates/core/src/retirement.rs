use super::workspaces::namespace;
use super::*;
use ouroboros_contracts::{
    RetirementPolicy, RetirementRecord, RetirementRequest, RetirementTarget,
};

pub(super) fn policy(cfg: &Value) -> Result<RetirementPolicy> {
    let p: RetirementPolicy =
        serde_json::from_value(cfg.get("retirement_policy").cloned().ok_or(Error::Denied)?)
            .map_err(|_| Error::Unavailable)?;
    if p.id.is_nil()
        || p.revision == 0
        || p.revision > i64::MAX as u64
        || p.min_retention_seconds > i32::MAX as u64
        || p.allowed.len() > 4
        || p.allowed.iter().any(|s| {
            !matches!(
                s.as_str(),
                "upload" | "revision" | "workspace_close" | "collect"
            )
        })
        || p.allowed
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
            .len()
            != p.allowed.len()
    {
        return Err(Error::Unavailable);
    }
    Ok(p)
}
pub(super) fn kind(target: &RetirementTarget) -> &'static str {
    match target {
        RetirementTarget::Upload { .. } => "upload",
        RetirementTarget::Revision { .. } => "revision",
        RetirementTarget::WorkspaceClose { .. } => "workspace_close",
    }
}
pub(super) fn record(intent: Uuid, request: &RetirementRequest) -> RetirementRecord {
    RetirementRecord {
        intent_id: intent,
        target: request.target.clone(),
        policy_id: request.policy_id,
        policy_revision: request.policy_revision,
        disposition: match request.target {
            RetirementTarget::Upload { .. } => "upload_retired",
            RetirementTarget::Revision { .. } => "revision_retired",
            RetirementTarget::WorkspaceClose { .. } => "workspace_closed",
        }
        .into(),
    }
}
pub(super) struct Admission {
    pub request: RetirementRequest,
    policy: RetirementPolicy,
    namespace: Uuid,
    source: Uuid,
    material: Uuid,
    revision: Option<i64>,
}
impl Core {
    /// Admission and dispatch use the same firm authority fence as retained-input creation.
    /// Ending an execution does not release its exact published input references.
    pub(super) async fn program_revision_barrier(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        workspace: Uuid,
        revision: i64,
    ) -> Result<()> {
        let retained: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM execution_inputs x JOIN executions e ON (e.firm_id,e.id)=(x.firm_id,x.execution_id) WHERE x.firm_id=$1 AND e.work_id=$2 AND x.target_id=$3 AND x.workspace_id=$4 AND x.revision=$5 AND x.retained)",
        )
        .bind(self.firm)
        .bind(work)
        .bind(target)
        .bind(workspace)
        .bind(revision)
        .fetch_one(&mut **tx)
        .await?;
        if retained {
            Err(Error::Conflict)
        } else {
            Ok(())
        }
    }
    pub(super) async fn check_program_retirement(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        request: &RetirementRequest,
    ) -> Result<()> {
        if let RetirementTarget::Revision {
            workspace_id,
            revision,
        } = request.target
        {
            self.program_revision_barrier(tx, work, target, workspace_id, revision)
                .await?;
        }
        // Closing a workspace preserves its snapshots and these retained references.
        Ok(())
    }
    #[allow(clippy::too_many_arguments)]
    pub(super) async fn prepare_retirement(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        cfg: &Value,
        input: &Value,
    ) -> Result<Admission> {
        let ns = namespace(cfg)?.ok_or(Error::Denied)?;
        let request: RetirementRequest =
            serde_json::from_value(input.clone()).map_err(|_| Error::Invalid)?;
        let p = policy(cfg)?;
        if request.policy_id != p.id || request.policy_revision != p.revision {
            return Err(Error::Conflict);
        }
        if !p.allowed.iter().any(|s| s == kind(&request.target)) {
            return Err(Error::Denied);
        }
        if request.reason.is_empty()
            || request.reason.len() > 1024
            || request.reason.trim() != request.reason
            || request.reason.chars().any(char::is_control)
        {
            return Err(Error::Invalid);
        }
        let (material, revision, source, workspace) = match request.target {
            RetirementTarget::Upload { upload_id } => {
                let row=sqlx::query("SELECT r.configuration,r.reply,i.state,i.input FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.target_id=$4 AND r.operation='file.upload'")
                    .bind(self.firm).bind(upload_id).bind(work).bind(target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
                let original: Value = row.get("configuration");
                if row.get::<String, _>("state") != "succeeded" {
                    return Err(Error::Conflict);
                }
                if namespace(&original)? != Some(ns)
                    || original["store_id"] != cfg["store_id"]
                    || original["storage_generation"] != cfg["storage_generation"]
                {
                    return Err(Error::Denied);
                }
                let reply: Value = row
                    .get::<Option<Value>, _>("reply")
                    .ok_or(Error::Unavailable)?;
                let reply: ouroboros_contracts::ResourceReply =
                    serde_json::from_value(reply).map_err(|_| Error::Denied)?;
                let input: Value = row.get("input");
                if super::upload_completion::validate(upload_id, &input["input"], &reply)
                    .map_err(|_| Error::Denied)?
                    .is_none()
                {
                    return Err(Error::Denied);
                }
                let pending:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state<>'succeeded' AND EXISTS(SELECT 1 FROM jsonb_each(i.input->'input'->'files') f WHERE f.value=to_jsonb($4::uuid)))")
                    .bind(self.firm).bind(work).bind(target).bind(upload_id).fetch_one(&mut **tx).await?;
                if pending {
                    return Err(Error::Conflict);
                }
                (upload_id, None, upload_id, None)
            }
            RetirementTarget::Revision {
                workspace_id,
                revision,
            } => {
                if revision < 0 {
                    return Err(Error::Invalid);
                }
                let source = self
                    .revision_source(tx, work, target, workspace_id, revision)
                    .await?;
                (workspace_id, Some(revision), source, Some(workspace_id))
            }
            RetirementTarget::WorkspaceClose {
                workspace_id,
                expected_revision,
            } => {
                if expected_revision < 0 {
                    return Err(Error::Invalid);
                }
                let source = self
                    .revision_source(tx, work, target, workspace_id, expected_revision)
                    .await?;
                (workspace_id, None, source, Some(workspace_id))
            }
        };
        let source_cfg:Value=sqlx::query_scalar("SELECT configuration FROM resource_calls WHERE firm_id=$1 AND intent_id=$2 AND work_id=$3 AND target_id=$4")
            .bind(self.firm).bind(source).bind(work).bind(target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        if namespace(&source_cfg)? != Some(ns)
            || source_cfg["store_id"] != cfg["store_id"]
            || source_cfg["storage_generation"] != cfg["storage_generation"]
        {
            return Err(Error::Denied);
        }
        self.check_program_retirement(tx, work, target, &request)
            .await?;
        if let Some(ws) = workspace {
            let pending:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state<>'succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid))")
                .bind(self.firm).bind(work).bind(target).bind(ws).fetch_one(&mut **tx).await?;
            if pending {
                return Err(Error::Conflict);
            }
            if let RetirementTarget::WorkspaceClose {
                expected_revision, ..
            } = request.target
            {
                let head:i64=sqlx::query_scalar("SELECT COALESCE(max((r.reply->'receipt'->>'revision')::bigint),0) FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state='succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid)")
                    .bind(self.firm).bind(work).bind(target).bind(ws).fetch_one(&mut **tx).await?;
                if expected_revision != head {
                    return Err(Error::Conflict);
                }
            }
            // A current head keeps its ordinary reference until explicitly closed or replaced.
            if let RetirementTarget::Revision { revision, .. } = request.target {
                let closed:bool=sqlx::query_scalar("SELECT state='closed' FROM workspace_allocations WHERE firm_id=$1 AND id=$2 AND work_id=$3 AND target_id=$4 AND namespace_id=$5")
                    .bind(self.firm).bind(ws).bind(work).bind(target).bind(ns).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
                if !closed {
                    let newer:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state='succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid) AND (r.reply->'receipt'->>'revision')::bigint>$5)")
                        .bind(self.firm).bind(work).bind(target).bind(ws).bind(revision).fetch_one(&mut **tx).await?;
                    if !newer {
                        return Err(Error::Conflict);
                    }
                }
            }
        }
        if p.min_retention_seconds > 0 {
            let old_enough:bool=sqlx::query_scalar("SELECT COALESCE(completed_at<=clock_timestamp()-make_interval(secs=>$3),false) FROM resource_calls WHERE firm_id=$1 AND intent_id=$2")
                .bind(self.firm).bind(source).bind(p.min_retention_seconds as f64).fetch_one(&mut **tx).await?;
            if !old_enough {
                return Err(Error::Denied);
            }
        }
        let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_retirements WHERE firm_id=$1 AND work_id=$2 AND target_id=$3 AND namespace_id=$4 AND kind=$5 AND material_id=$6 AND material_revision IS NOT DISTINCT FROM $7)")
            .bind(self.firm).bind(work).bind(target).bind(ns).bind(kind(&request.target)).bind(material).bind(revision).fetch_one(&mut **tx).await?;
        if exists {
            return Err(Error::Conflict);
        }
        Ok(Admission {
            request,
            policy: p,
            namespace: ns,
            source,
            material,
            revision,
        })
    }
    async fn revision_source(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        workspace: Uuid,
        revision: i64,
    ) -> Result<Uuid> {
        if revision == 0 {
            sqlx::query_scalar("SELECT w.creation_intent_id FROM workspace_allocations w JOIN intents i ON(i.firm_id,i.id)=(w.firm_id,w.creation_intent_id) WHERE w.firm_id=$1 AND w.id=$2 AND w.work_id=$3 AND w.target_id=$4 AND i.state='succeeded'")
                .bind(self.firm).bind(workspace).bind(work).bind(target).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)
        } else {
            let sources:Vec<Uuid>=sqlx::query_scalar("SELECT r.intent_id FROM resource_calls r JOIN intents i ON(i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish' AND i.state='succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid) AND r.reply->'receipt'->'revision'=to_jsonb($5::bigint)")
                .bind(self.firm).bind(work).bind(target).bind(workspace).bind(revision).fetch_all(&mut **tx).await?;
            if sources.len() != 1 {
                return Err(Error::Denied);
            }
            Ok(sources[0])
        }
    }
    pub(super) async fn save_retirement(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        work: Uuid,
        target: &str,
        a: &Admission,
    ) -> Result<()> {
        sqlx::query("INSERT INTO resource_retirements(firm_id,intent_id,work_id,target_id,namespace_id,kind,material_id,material_revision,source_intent_id,policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)")
            .bind(self.firm).bind(intent).bind(work).bind(target).bind(a.namespace).bind(kind(&a.request.target)).bind(a.material).bind(a.revision).bind(a.source).bind(json!(a.policy)).execute(&mut **tx).await?;
        Ok(())
    }
    pub(super) async fn reference_barriers(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        work: Uuid,
        target: &str,
        op: &str,
        input: &Value,
    ) -> Result<()> {
        if !matches!(op, "file.read" | "file.publish") {
            return Ok(());
        }
        let workspace = input["workspace_id"]
            .as_str()
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or(Error::Invalid)?;
        let blocked: bool = if op == "file.read" {
            let revision = input["revision"].as_i64().ok_or(Error::Invalid)?;
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_retirements WHERE firm_id=$1 AND work_id=$2 AND target_id=$3 AND kind='revision' AND material_id=$4 AND material_revision=$5)")
                .bind(self.firm).bind(work).bind(target).bind(workspace).bind(revision).fetch_one(&mut **tx).await?
        } else {
            let files: std::collections::BTreeMap<String, Uuid> =
                serde_json::from_value(input["files"].clone()).map_err(|_| Error::Invalid)?;
            let ids: Vec<Uuid> = files.into_values().collect();
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM resource_retirements WHERE firm_id=$1 AND work_id=$2 AND target_id=$3 AND ((kind='workspace_close' AND material_id=$4) OR (kind='upload' AND material_id=ANY($5))))")
                .bind(self.firm).bind(work).bind(target).bind(workspace).bind(ids).fetch_one(&mut **tx).await?
        };
        if blocked { Err(Error::Denied) } else { Ok(()) }
    }
    pub(super) async fn complete_retirement(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        request: &RetirementRequest,
    ) -> Result<()> {
        if let RetirementTarget::WorkspaceClose { workspace_id, .. } = request.target {
            let namespace:Uuid=sqlx::query_scalar("SELECT namespace_id FROM resource_retirements WHERE firm_id=$1 AND intent_id=$2 AND kind='workspace_close' AND material_id=$3")
                .bind(self.firm).bind(intent).bind(workspace_id).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
            let changed=sqlx::query("UPDATE workspace_allocations SET state='closed' WHERE firm_id=$1 AND id=$2 AND state='active'").bind(self.firm).bind(workspace_id).execute(&mut **tx).await?.rows_affected();
            if changed != 1 {
                return Err(Error::Conflict);
            }
            sqlx::query("INSERT INTO workspace_releases(firm_id,workspace_id,retirement_intent_id,namespace_id) VALUES($1,$2,$3,$4)").bind(self.firm).bind(workspace_id).bind(intent).bind(namespace).execute(&mut **tx).await?;
            let changed=sqlx::query("UPDATE workspace_namespaces SET allocated=allocated-1 WHERE firm_id=$1 AND id=$2 AND allocated>0").bind(self.firm).bind(namespace).execute(&mut **tx).await?.rows_affected();
            if changed != 1 {
                return Err(Error::Unavailable);
            }
        }
        Ok(())
    }
}
