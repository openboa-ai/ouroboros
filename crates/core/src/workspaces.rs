use super::*;
use ouroboros_contracts::{WorkspaceBinding, WorkspaceQuery};
use sqlx::postgres::PgRow;

pub(super) fn config_uuid(cfg: &Value, key: &str) -> Result<Uuid> {
    cfg[key]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or(Error::Unavailable)
}
/// A present but invalid namespace is never interpreted as legacy authority.
pub(super) fn namespace(cfg: &Value) -> Result<Option<Uuid>> {
    if cfg.get("namespace_id").is_none() {
        return Ok(None);
    }
    if cfg.get("workspace_id").is_some() {
        return Err(Error::Unavailable);
    }
    let id = config_uuid(cfg, "namespace_id")?;
    if id.is_nil() {
        return Err(Error::Unavailable);
    }
    Ok(Some(id))
}
fn summary(row: &PgRow) -> Value {
    json!({"workspace_id":row.get::<Uuid,_>("id"),"namespace_id":row.get::<Uuid,_>("namespace_id"),
        "work_id":row.get::<Uuid,_>("work_id"),"target_id":row.get::<String,_>("target_id"),
        "label":row.get::<String,_>("label"),"state":row.get::<String,_>("state"),
        "creation_intent_id":row.get::<Uuid,_>("creation_intent_id")})
}
impl Core {
    pub(super) async fn check_namespace(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        target: &str,
        cfg: &Value,
    ) -> Result<Option<Uuid>> {
        let Some(ns) = namespace(cfg)? else {
            // Removing configuration does not turn an allocated namespace back into a
            // legacy target or bypass its durable reference barriers.
            let registered: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM workspace_namespaces WHERE firm_id=$1 AND target_id=$2)",
            )
            .bind(self.firm)
            .bind(target)
            .fetch_one(&mut **tx)
            .await?;
            if registered {
                return Err(Error::Denied);
            }
            return Ok(None);
        };
        let ok:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM workspace_namespaces WHERE firm_id=$1 AND id=$2 AND target_id=$3 AND store_id=$4 AND storage_generation=$5)")
            .bind(self.firm).bind(ns).bind(target).bind(config_uuid(cfg,"store_id")?).bind(config_uuid(cfg,"storage_generation")?)
            .fetch_one(&mut **tx).await?;
        if !ok {
            return Err(Error::Denied);
        }
        Ok(Some(ns))
    }
    #[allow(clippy::too_many_arguments)]
    pub(super) async fn workspace_binding(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        work: Uuid,
        target: &str,
        op: &str,
        input: &Value,
        cfg: &Value,
        current: bool,
    ) -> Result<Option<WorkspaceBinding>> {
        let Some(ns) = namespace(cfg)? else {
            if op == "workspace.create" {
                return Err(Error::Denied);
            }
            return Ok(None);
        };
        if !matches!(
            op,
            "workspace.create" | "file.read" | "file.publish" | "file.retire"
        ) {
            return Ok(None);
        }
        let (selected_workspace, requires_active) = if op == "file.retire" {
            let request: ouroboros_contracts::RetirementRequest =
                serde_json::from_value(input.clone()).map_err(|_| Error::Invalid)?;
            match request.target {
                ouroboros_contracts::RetirementTarget::Upload { .. } => return Ok(None),
                ouroboros_contracts::RetirementTarget::Revision { workspace_id, .. } => {
                    (Some(workspace_id), false)
                }
                ouroboros_contracts::RetirementTarget::WorkspaceClose { workspace_id, .. } => {
                    (Some(workspace_id), true)
                }
            }
        } else {
            (None, op == "file.publish")
        };
        let row = if op == "workspace.create" {
            sqlx::query(
                "SELECT * FROM workspace_allocations WHERE firm_id=$1 AND creation_intent_id=$2",
            )
            .bind(self.firm)
            .bind(intent)
            .fetch_optional(&mut **tx)
            .await?
        } else {
            let id = selected_workspace
                .or_else(|| {
                    input["workspace_id"]
                        .as_str()
                        .and_then(|s| Uuid::parse_str(s).ok())
                })
                .ok_or(Error::Invalid)?;
            sqlx::query("SELECT * FROM workspace_allocations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_optional(&mut **tx)
                .await?
        }
        .ok_or(Error::Denied)?;
        if row.get::<Uuid, _>("work_id") != work
            || row.get::<String, _>("target_id") != target
            || row.get::<Uuid, _>("namespace_id") != ns
            || row.get::<Uuid, _>("store_id") != config_uuid(cfg, "store_id")?
            || row.get::<Uuid, _>("storage_generation") != config_uuid(cfg, "storage_generation")?
            || (current && requires_active && row.get::<String, _>("state") != "active")
            || (current
                && op == "file.read"
                && !matches!(row.get::<String, _>("state").as_str(), "active" | "closed"))
        {
            return Err(Error::Denied);
        }
        Ok(Some(WorkspaceBinding {
            workspace_id: row.get("id"),
            namespace_id: ns,
        }))
    }
    #[allow(clippy::too_many_arguments)]
    pub(super) async fn allocate_workspace(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        work: Uuid,
        target: &str,
        cfg: &Value,
        input: &Value,
    ) -> Result<WorkspaceBinding> {
        let ns = self
            .check_namespace(tx, target, cfg)
            .await?
            .ok_or(Error::Denied)?;
        let fields = input.as_object().ok_or(Error::Invalid)?;
        let label = input["label"]
            .as_str()
            .filter(|s| {
                !s.is_empty()
                    && s.len() <= 128
                    && s.trim() == *s
                    && !s.chars().any(char::is_control)
            })
            .ok_or(Error::Invalid)?;
        if fields.len() != 1 {
            return Err(Error::Invalid);
        }
        let changed=sqlx::query("UPDATE workspace_namespaces SET allocated=allocated+1 WHERE firm_id=$1 AND id=$2 AND allocated<capacity")
            .bind(self.firm).bind(ns).execute(&mut **tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Capacity);
        }
        let id = Uuid::new_v4();
        // The firm fence fixes the sequence of the resource.accepted event committed below.
        sqlx::query("INSERT INTO workspace_allocations(firm_id,id,creation_intent_id,work_id,target_id,namespace_id,store_id,storage_generation,label,state,created_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'reserved',(SELECT event_sequence+1 FROM firms WHERE id=$1))")
            .bind(self.firm).bind(id).bind(intent).bind(work).bind(target).bind(ns).bind(config_uuid(cfg,"store_id")?).bind(config_uuid(cfg,"storage_generation")?).bind(label).execute(&mut **tx).await?;
        Ok(WorkspaceBinding {
            workspace_id: id,
            namespace_id: ns,
        })
    }
    pub async fn list_workspaces(
        &self,
        actor: ResourceActor,
        query: WorkspaceQuery,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let (p, w, d, _) = self
            .resource_actor(&mut tx, &actor, query.work_id, query.delegation_id)
            .await?;
        let ns: Uuid = sqlx::query_scalar(
            "SELECT id FROM workspace_namespaces WHERE firm_id=$1 AND target_id=$2",
        )
        .bind(self.firm)
        .bind(&query.target_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        self.resource_permission_namespace(&mut tx, p, w, d, &query.target_id, "inspect", Some(ns))
            .await?;
        let ctx = self.actor_context(&mut tx, &actor).await?;
        let f = sqlx::query("SELECT revision,event_sequence FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        let revision: i64 = f.get("revision");
        let max:i64=sqlx::query_scalar("SELECT COALESCE(max(created_sequence),0) FROM workspace_allocations WHERE firm_id=$1 AND work_id=$2 AND namespace_id=$3").bind(self.firm).bind(w).bind(ns).fetch_one(&mut *tx).await?;
        let prefix = format!("{}:{revision}:{w}:{d}:{ns}:", ctx.realm());
        let (high, after) = if let Some(cursor) = query.cursor {
            let parts: Vec<_> = cursor
                .strip_prefix(&prefix)
                .ok_or(Error::Conflict)?
                .split(':')
                .collect();
            if parts.len() != 2 {
                return Err(Error::Invalid);
            }
            let high = parts[0].parse::<i64>().map_err(|_| Error::Invalid)?;
            let after = parts[1].parse::<i64>().map_err(|_| Error::Invalid)?;
            if after < 0 || high < after || high > max {
                return Err(Error::Conflict);
            }
            (high, after)
        } else {
            (max, 0)
        };
        let mut rows=sqlx::query("SELECT * FROM workspace_allocations WHERE firm_id=$1 AND work_id=$2 AND namespace_id=$3 AND target_id=$4 AND created_sequence>$5 AND created_sequence<=$6 ORDER BY created_sequence LIMIT 51")
            .bind(self.firm).bind(w).bind(ns).bind(&query.target_id).bind(after).bind(high).fetch_all(&mut *tx).await?;
        let more = rows.len() > 50;
        rows.truncate(50);
        let next = if more {
            rows.last()
                .map(|r| format!("{prefix}{high}:{}", r.get::<i64, _>("created_sequence")))
        } else {
            None
        };
        Ok(
            json!({"items":rows.iter().map(summary).collect::<Vec<_>>(),"next_cursor":next,"authority_revision":revision,"event_sequence":f.get::<i64,_>("event_sequence")}),
        )
    }
    pub async fn read_workspace(
        &self,
        actor: ResourceActor,
        id: Uuid,
        query: WorkspaceQuery,
    ) -> Result<Value> {
        self.read_workspace_publication(actor, id, query, None)
            .await
    }

    /// Historical lookup uses the current workspace permission and physical storage binding.
    pub async fn read_workspace_publication(
        &self,
        actor: ResourceActor,
        id: Uuid,
        query: WorkspaceQuery,
        publication: Option<Uuid>,
    ) -> Result<Value> {
        if query.cursor.is_some() {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let (p, w, d, _) = self
            .resource_actor(&mut tx, &actor, query.work_id, query.delegation_id)
            .await?;
        let row=sqlx::query("SELECT * FROM workspace_allocations WHERE firm_id=$1 AND id=$2 AND work_id=$3 AND target_id=$4").bind(self.firm).bind(id).bind(w).bind(&query.target_id).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        self.resource_permission_namespace(
            &mut tx,
            p,
            w,
            d,
            &query.target_id,
            "inspect",
            Some(row.get("namespace_id")),
        )
        .await?;
        let mut value = summary(&row);
        // Metadata discovery retains the exact existing work/target/namespace inspection boundary.
        value["publication_observation"] = self
            .workspace_publication_observation(&mut tx, &row, publication)
            .await?;
        Ok(value)
    }

    async fn workspace_publication_observation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        workspace: &PgRow,
        publication: Option<Uuid>,
    ) -> Result<Value> {
        let id: Uuid = workspace.get("id");
        let work: Uuid = workspace.get("work_id");
        let namespace: Uuid = workspace.get("namespace_id");
        let target: String = workspace.get("target_id");
        let store: Uuid = workspace.get("store_id");
        let generation: Uuid = workspace.get("storage_generation");
        let firm = sqlx::query(
            "SELECT revision,statement_timestamp()::text AS observed_at FROM firms WHERE id=$1",
        )
        .bind(self.firm)
        .fetch_one(&mut **tx)
        .await?;
        // This is the most recent Core-confirmed publication, not a direct Catalog head read.
        // Match the admitted physical storage generation as well as logical workspace ownership.
        let confirmed = sqlx::query(
            r#"
            SELECT r.intent_id,r.reply,r.completed_at::text AS confirmed_at,i.input,
                i.principal_id,i.origin_instance_id
            FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id)
            WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish'
                AND i.state='succeeded' AND r.reply IS NOT NULL
                AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid)
                AND r.configuration->'namespace_id'=to_jsonb($5::uuid)
                AND r.configuration->'store_id'=to_jsonb($6::uuid)
                AND r.configuration->'storage_generation'=to_jsonb($7::uuid)
            AND ($8::uuid IS NULL OR r.intent_id=$8)
            ORDER BY (r.reply->'receipt'->>'revision')::bigint DESC,r.intent_id DESC LIMIT 1
        "#,
        )
        .bind(self.firm)
        .bind(work)
        .bind(&target)
        .bind(id)
        .bind(namespace)
        .bind(store)
        .bind(generation)
        .bind(publication)
        .fetch_optional(&mut **tx)
        .await?;
        let latest = if let Some(record) = confirmed {
            let intent: Uuid = record.get("intent_id");
            let input: Value = record.get("input");
            let revision = input["input"]["expected_revision"]
                .as_i64()
                .filter(|v| *v >= 0)
                .and_then(|v| v.checked_add(1))
                .ok_or(Error::Unavailable)?;
            // Validate historical evidence too; a succeeded label alone is not a publication proof.
            let reply: ouroboros_contracts::ResourceReply =
                serde_json::from_value(record.get("reply")).map_err(|_| Error::Unavailable)?;
            if !(200..300).contains(&reply.status)
                || reply.content_type != "application/json"
                || serde_json::from_str::<Value>(&reply.body).map_err(|_| Error::Unavailable)?
                    != json!({"intent_id":intent,"revision":revision})
                || reply.receipt
                    != json!({"source":"catalog","publication_receipt":intent,"revision":revision})
            {
                return Err(Error::Unavailable);
            }
            let manifest = input["input"]["files"]
                .as_object()
                .ok_or(Error::Unavailable)?;
            let mut files = Vec::new();
            for (path, upload) in manifest.iter().take(128) {
                let upload = upload
                    .as_str()
                    .and_then(|value| Uuid::parse_str(value).ok())
                    .ok_or(Error::Unavailable)?;
                if path.is_empty()
                    || path.len() > 1024
                    || path.contains(['\\', '\0'])
                    || path
                        .split('/')
                        .any(|part| part.is_empty() || part == "." || part == "..")
                {
                    return Err(Error::Unavailable);
                }
                files.push(
                    json!({"workspace_id":id,"revision":revision,"path":path,"upload_id":upload,
                    "work_id":work,"target_id":target}),
                );
            }
            let retirement: Value = sqlx::query_scalar(r#"
                SELECT jsonb_build_object('confirmed',COALESCE(bool_or(i.state='succeeded'),false),
                    'pending',COALESCE(bool_or(i.state<>'succeeded'),false))
                FROM resource_retirements r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id)
                WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.namespace_id=$4
                    AND r.kind='revision' AND r.material_id=$5 AND r.material_revision=$6 AND r.source_intent_id=$7
            "#).bind(self.firm).bind(work).bind(&target).bind(namespace).bind(id).bind(revision).bind(intent)
                .fetch_one(&mut **tx).await?;
            let retirement_state = if retirement["confirmed"] == true {
                "confirmed"
            } else if retirement["pending"] == true {
                "pending"
            } else {
                "none_recorded"
            };
            json!({"intent_id":intent,"revision":revision,"confirmed_at":record.get::<Option<String>,_>("confirmed_at"),
                "author_principal_id":record.get::<Uuid,_>("principal_id"),"origin_instance_id":record.get::<Option<Uuid>,_>("origin_instance_id"),
                "files":files,"file_count":manifest.len(),"files_complete":manifest.len()<=128,"retirement_state":retirement_state})
        } else {
            Value::Null
        };
        let mut pending: Vec<Value> = sqlx::query_scalar(
            r#"
            SELECT jsonb_build_object('intent_id',r.intent_id,'state',i.state,
                'expected_revision',i.input->'input'->'expected_revision','created_at',i.created_at)
            FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id)
            WHERE r.firm_id=$1 AND r.work_id=$2 AND r.target_id=$3 AND r.operation='file.publish'
                AND i.state<>'succeeded' AND i.input->'input'->'workspace_id'=to_jsonb($4::uuid)
                AND r.configuration->'namespace_id'=to_jsonb($5::uuid)
                AND r.configuration->'store_id'=to_jsonb($6::uuid)
                AND r.configuration->'storage_generation'=to_jsonb($7::uuid)
            ORDER BY i.created_at,r.intent_id LIMIT 21
        "#,
        )
        .bind(self.firm)
        .bind(work)
        .bind(&target)
        .bind(id)
        .bind(namespace)
        .bind(store)
        .bind(generation)
        .fetch_all(&mut **tx)
        .await?;
        let has_pending = !pending.is_empty();
        let more = pending.len() > 20;
        pending.truncate(20);
        Ok(
            json!({"source":"core_publication_records","observed_at":firm.get::<String,_>("observed_at"),
            "authority_revision":firm.get::<i64,_>("revision"),
            "initial_revision":if workspace.get::<String,_>("state")=="reserved" {None} else {Some(0)},
            "latest_confirmed_publication":if publication.is_none() {latest.clone()} else {Value::Null},
            "confirmed_publication":latest,"requested_publication":publication,"has_pending_publication":has_pending,
            "pending_publications":pending,"pending_has_more":more}),
        )
    }
}
