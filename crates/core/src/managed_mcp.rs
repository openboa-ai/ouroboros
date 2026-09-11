//! Stateless managed MCP operations; dispatch delegates to the ordinary adapter contract.
use super::*;
use ouroboros_contracts::{AdapterInvocationRequest, ProgramTicket};
use serde::Deserialize;

const VERSION: &str = "2025-11-25";
fn rpc_error(id: Value, code: i64, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}
fn content(value: Value, failed: bool) -> Value {
    json!({"content":[{"type":"text","text":value.to_string()}],"structuredContent":value,"isError":failed})
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InvokeArgs {
    request_key: String,
    agent_delegation_id: Uuid,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReadArgs {
    execution_id: Uuid,
}

impl Core {
    pub async fn managed_mcp_scope(&self, actor: &Actor, work: Uuid, grant: Uuid) -> Result<()> {
        let mut tx = self.fence().await?;
        self.resource_actor(&mut tx, actor, Some(work), Some(grant))
            .await?;
        tx.commit().await?;
        Ok(())
    }
    async fn managed_tools(
        &self,
        actor: &Actor,
        work: Uuid,
        grant: Uuid,
        cursor: Option<Uuid>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let (p, _, _, instance) = self
            .resource_actor(&mut tx, actor, Some(work), Some(grant))
            .await?;
        let rows=sqlx::query("SELECT a.id,a.submission_id FROM active_adapters t JOIN adapter_activations a ON(a.firm_id,a.id)=(t.firm_id,t.activation_id) JOIN adapter_submissions s ON(s.firm_id,s.id)=(a.firm_id,a.submission_id) WHERE t.firm_id=$1 AND s.work_id=$2 AND ($3::uuid IS NULL OR a.id>$3) ORDER BY a.id LIMIT 65")
            .bind(self.firm).bind(work).bind(cursor).fetch_all(&mut *tx).await?;
        let mut tools = Vec::new();
        if cursor.is_none() {
            tools.push(json!({"name":"execution_get","description":"Inspect an execution in this work. Process exit and admission do not establish work success.","inputSchema":{"type":"object","properties":{"execution_id":{"type":"string","format":"uuid"}},"required":["execution_id"],"additionalProperties":false}}));
        }
        if cursor.is_none() && instance.is_some() {
            tools.push(json!({"name":"execution_self","description":"Inspect this authenticated runtime instance's own company execution. No caller-supplied identity is trusted.","inputSchema":{"type":"object","properties":{},"additionalProperties":false}}));
        }
        for row in rows.iter().take(64) {
            let activation: Uuid = row.get("id");
            let eligible = async {
                let (s, _) = self
                    .active_adapter(&mut tx, row.get("submission_id"), activation)
                    .await?;
                self.resource_permission(
                    &mut tx,
                    p,
                    work,
                    grant,
                    &s.get::<String, _>("target_id"),
                    "adapter.invoke",
                )
                .await?;
                let ticket: ProgramTicket =
                    serde_json::from_value(s.get("ticket")).map_err(|_| Error::Unavailable)?;
                self.adapter_read_authority(
                    &mut tx,
                    p,
                    work,
                    grant,
                    &s.get::<String, _>("target_id"),
                    &ticket,
                )
                .await?;
                Ok::<(), Error>(())
            }
            .await;
            match eligible {
                Ok(()) => {}
                Err(Error::Denied) => continue,
                Err(e) => return Err(e),
            }
            tools.push(json!({"name":format!("invoke_{}",activation.simple()),
                "description":"Submit the exact approved code and inputs as a new bounded isolated execution. Returns admission only, not completed output. Use execution_get for observations. Reuse request_key only to reconcile the same invocation; provide an authorized child agent delegation. Current permissions and limits are rechecked on use.",
                "inputSchema":{"type":"object","properties":{"request_key":{"type":"string","minLength":1,"maxLength":128},"agent_delegation_id":{"type":"string","format":"uuid"}},"required":["request_key","agent_delegation_id"],"additionalProperties":false}}));
        }
        let mut out = json!({"tools":tools});
        if rows.len() > 64 {
            out["nextCursor"] = json!(rows[63].get::<Uuid, _>("id"));
        }
        tx.commit().await?;
        Ok(out)
    }
    async fn managed_call(
        &self,
        actor: Actor,
        work: Uuid,
        grant: Uuid,
        name: &str,
        args: Value,
    ) -> Result<Value> {
        if name == "execution_self" {
            if !args.as_object().is_some_and(|v| v.is_empty()) {
                return Err(Error::Invalid);
            }
            let mut tx = self.fence().await?;
            let ctx = self.actor_context(&mut tx, &actor).await?;
            let execution = ctx.bound.as_ref().ok_or(Error::Denied)?.execution;
            tx.commit().await?;
            return self
                .read_scoped(actor, "executions", execution, Some((work, grant)))
                .await;
        }
        if name == "execution_get" {
            let r: ReadArgs = serde_json::from_value(args).map_err(|_| Error::Invalid)?;
            let value = self
                .read_scoped(actor, "executions", r.execution_id, Some((work, grant)))
                .await?;
            if value["work_id"] != json!(work) {
                return Err(Error::Denied);
            }
            return Ok(value);
        }
        let activation = Uuid::parse_str(name.strip_prefix("invoke_").ok_or(Error::Invalid)?)
            .map_err(|_| Error::Invalid)?;
        if name != format!("invoke_{}", activation.simple()) {
            return Err(Error::Invalid);
        }
        let args: InvokeArgs = serde_json::from_value(args).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        // Resolve exact material here; invoke_adapter repeats all authority checks atomically with admission.
        let submission: Uuid = sqlx::query_scalar(
            "SELECT submission_id FROM adapter_activations WHERE firm_id=$1 AND id=$2",
        )
        .bind(self.firm)
        .bind(activation)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        let (s, _) = self.active_adapter(&mut tx, submission, activation).await?;
        let ticket: ProgramTicket =
            serde_json::from_value(s.get("ticket")).map_err(|_| Error::Unavailable)?;
        let execution = ExecutionRequest {
            work_id: work,
            delegation_id: grant,
            profile_id: s.get("profile_id"),
            units: ticket.profile.compute_units,
            lifetime_seconds: i64::try_from(ticket.profile.lifetime_seconds)
                .map_err(|_| Error::Unavailable)?,
            predecessor_execution_id: None,
            agent_delegation_id: Some(args.agent_delegation_id),
            program: None,
        };
        tx.commit().await?;
        let accepted = self
            .invoke_adapter(
                actor,
                submission,
                &args.request_key,
                AdapterInvocationRequest {
                    activation_id: activation,
                    execution,
                },
            )
            .await?;
        Ok(json!({"admission":accepted,"completion":"not_confirmed"}))
    }
    pub async fn managed_mcp(
        &self,
        actor: Actor,
        work: Uuid,
        grant: Uuid,
        input: Value,
    ) -> Result<Option<Value>> {
        self.managed_mcp_scope(&actor, work, grant).await?;
        let id = input.get("id").cloned().unwrap_or(Value::Null);
        if !input.is_object()
            || input["jsonrpc"] != "2.0"
            || !input["method"].is_string()
            || input
                .as_object()
                .unwrap()
                .keys()
                .any(|k| !["jsonrpc", "id", "method", "params"].contains(&k.as_str()))
            || (input.get("id").is_some()
                && !(id.is_string() || id.as_i64().is_some() || id.as_u64().is_some()))
        {
            return Ok(Some(rpc_error(Value::Null, -32600, "Invalid Request")));
        }
        let method = input["method"].as_str().unwrap();
        if input.get("id").is_none() {
            // There is no in-flight MCP request after a JSON admission response. Cancelling a
            // protocol request never silently stops a separately admitted execution.
            return if ["notifications/initialized", "notifications/cancelled"].contains(&method) {
                Ok(None)
            } else {
                Err(Error::Invalid)
            };
        }
        let params = input.get("params").cloned().unwrap_or(json!({}));
        if !params.is_object() {
            return Ok(Some(rpc_error(id, -32602, "Invalid params")));
        }
        let result = match method {
            "initialize" => {
                if !params["protocolVersion"].is_string()
                    || !params["capabilities"].is_object()
                    || !params["clientInfo"]["name"].is_string()
                    || !params["clientInfo"]["version"].is_string()
                {
                    return Ok(Some(rpc_error(id, -32602, "Invalid initialization")));
                }
                json!({"protocolVersion":VERSION,"capabilities":{"tools":{}},"serverInfo":{"name":"ouroboros-managed","version":env!("CARGO_PKG_VERSION")}})
            }
            "ping" => json!({}),
            "tools/list" => {
                let cursor = match params.get("cursor") {
                    None => None,
                    Some(v) => match v.as_str().and_then(|s| Uuid::parse_str(s).ok()) {
                        Some(v) => Some(v),
                        None => return Ok(Some(rpc_error(id, -32602, "Invalid cursor"))),
                    },
                };
                self.managed_tools(&actor, work, grant, cursor).await?
            }
            "tools/call" => {
                let Some(name) = params["name"].as_str() else {
                    return Ok(Some(rpc_error(id, -32602, "Tool name required")));
                };
                if !["execution_get", "execution_self"].contains(&name)
                    && !name.starts_with("invoke_")
                {
                    return Ok(Some(rpc_error(id, -32602, "Unknown tool")));
                }
                match self
                    .managed_call(
                        actor,
                        work,
                        grant,
                        name,
                        params.get("arguments").cloned().unwrap_or(json!({})),
                    )
                    .await
                {
                    Ok(value) => content(value, false),
                    Err(e) => content(
                        json!({"error":match e {Error::Denied|Error::NotFound=>"not_authorized_or_not_available",Error::Capacity=>"capacity_exhausted",Error::Conflict=>"request_conflict",Error::Invalid=>"invalid_arguments",Error::Unavailable=>"dependency_unavailable_outcome_may_be_unresolved"}}),
                        true,
                    ),
                }
            }
            _ => return Ok(Some(rpc_error(id, -32601, "Method not found"))),
        };
        Ok(Some(json!({"jsonrpc":"2.0","id":id,"result":result})))
    }
}
