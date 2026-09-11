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
        Ok(summary(&row))
    }
}
