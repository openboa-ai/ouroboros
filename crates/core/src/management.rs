use super::*;

impl Core {
    pub async fn conditions(&self, caller: impl Into<Actor>) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        self.action_grants(&mut tx, &ctx, "inspect").await?;
        if let Some(b) = &ctx.bound {
            self.event(
                &mut tx,
                ctx.principal,
                "instance.conditions_read",
                b.execution,
                json!({"instance_id":b.instance,"source":"gateway_peer"}),
            )
            .await?;
        }
        let f =
            sqlx::query("SELECT revision,event_sequence,admission_paused FROM firms WHERE id=$1")
                .bind(self.firm)
                .fetch_one(&mut *tx)
                .await?;
        let candidates: Vec<Uuid> = if let Some(b) = &ctx.bound {
            vec![b.grant]
        } else {
            sqlx::query_scalar(
                "SELECT id FROM delegations WHERE firm_id=$1 AND principal_id=$2 ORDER BY id",
            )
            .bind(self.firm)
            .bind(ctx.principal)
            .fetch_all(&mut *tx)
            .await?
        };
        let mut grants = Vec::new();
        for d in candidates {
            let actions: Vec<String> =
                sqlx::query_scalar("SELECT actions FROM delegations WHERE firm_id=$1 AND id=$2")
                    .bind(self.firm)
                    .bind(d)
                    .fetch_one(&mut *tx)
                    .await?;
            for action in actions {
                match self.actor_grant(&mut tx, &ctx, d, &action).await {
                    Ok(()) => {
                        grants.push(d);
                        break;
                    }
                    Err(Error::Denied) => {}
                    Err(e) => return Err(e),
                }
            }
        }
        let limits =
            sqlx::query("SELECT id,capacity,committed FROM limits WHERE firm_id=$1 ORDER BY id")
                .bind(self.firm)
                .fetch_all(&mut *tx)
                .await?;
        let profiles: Vec<String> =
            sqlx::query_scalar("SELECT id FROM profiles WHERE firm_id=$1 AND active ORDER BY id")
                .bind(self.firm)
                .fetch_all(&mut *tx)
                .await?;
        let mut out = json!({"firm_id":self.firm,"principal_id":ctx.principal,"revision":f.get::<i64,_>("revision"),"cursor":format!("{}:{}:{}",ctx.realm(),f.get::<i64,_>("revision"),f.get::<i64,_>("event_sequence")),"delegations":grants,"profiles":profiles,"limits":limits.iter().map(|r|json!({"id":r.get::<String,_>("id"),"capacity":r.get::<i64,_>("capacity"),"committed":r.get::<i64,_>("committed")})).collect::<Vec<_>>(),"admission_paused":f.get::<bool,_>("admission_paused"),"runtime_ready":false,"unverified":["full_lifecycle","integrated_subscription"]});
        if let Some(b) = ctx.bound {
            out["work_id"] = json!(b.work);
            out["execution_id"] = json!(b.execution);
            out["instance_id"] = json!(b.instance);
            out["generation"] = json!(b.generation);
        }
        tx.commit().await?;
        Ok(out)
    }

    pub async fn list_work(&self, caller: impl Into<Actor>, cursor: Option<&str>) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let roots = self.readable_roots(&mut tx, &ctx).await?;
        let f =
            sqlx::query("SELECT revision,event_sequence,admission_paused FROM firms WHERE id=$1")
                .bind(self.firm)
                .fetch_one(&mut *tx)
                .await?;
        let revision: i64 = f.get("revision");
        let prefix = format!("{}:{revision}:", ctx.realm());
        let after = cursor
            .map(|c| {
                c.strip_prefix(&prefix)
                    .ok_or(Error::Conflict)
                    .and_then(|s| Uuid::parse_str(s).map_err(|_| Error::Invalid))
            })
            .transpose()?;
        let mut rows:Vec<Value>=sqlx::query_scalar("WITH RECURSIVE visible AS (SELECT id FROM work WHERE firm_id=$1 AND id=ANY($2) UNION SELECT w.id FROM work w JOIN visible v ON w.parent_id=v.id WHERE w.firm_id=$1) SELECT to_jsonb(w) FROM work w JOIN visible v ON w.id=v.id WHERE w.firm_id=$1 AND ($3::uuid IS NULL OR w.id>$3) ORDER BY w.id LIMIT 51")
            .bind(self.firm).bind(roots).bind(after).fetch_all(&mut *tx).await?;
        let next = if rows.len() > 50 {
            rows.truncate(50);
            Some(format!(
                "{prefix}{}",
                rows.last().ok_or(Error::Unavailable)?["id"]
                    .as_str()
                    .ok_or(Error::Unavailable)?
            ))
        } else {
            None
        };
        Ok(
            json!({"items":rows,"next_cursor":next,"cursor":format!("{prefix}{}",f.get::<i64,_>("event_sequence"))}),
        )
    }

    pub async fn read(&self, caller: impl Into<Actor>, kind: &str, id: Uuid) -> Result<Value> {
        self.read_scoped(caller.into(), kind, id, None).await
    }
    pub(super) async fn read_scoped(
        &self,
        caller: Actor,
        kind: &str,
        id: Uuid,
        scope: Option<(Uuid, Uuid)>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller).await?;
        self.action_grants(&mut tx, &ctx, "inspect").await?;
        if let Some((work, grant)) = scope {
            self.actor_permission(&mut tx, &ctx, grant, work, "inspect")
                .await?;
        }
        let row=match kind {
            "work"=>sqlx::query("SELECT id AS work_id,principal_id,to_jsonb(w) AS data FROM work w WHERE firm_id=$1 AND id=$2"),
            "executions"=>sqlx::query("SELECT e.work_id,i.principal_id,to_jsonb(e)||jsonb_build_object('state',i.state,'unstarted_cancellation',(SELECT c.receipt FROM unstarted_cancellations c WHERE (c.firm_id,c.execution_id)=(e.firm_id,e.id)),'native_turn',(SELECT jsonb_build_object('thread_id',n.thread_id,'turn_id',n.turn_id,'status',n.status) FROM native_turns n WHERE (n.firm_id,n.execution_id)=(e.firm_id,e.id) AND n.status='inProgress'),'program_observation',(SELECT jsonb_build_object('source','runtime_backend','receipt',p.receipt,'received_at',p.received_at,'effects_settled',false,'work_success_confirmed',false) FROM program_observations p WHERE (p.firm_id,p.execution_id)=(e.firm_id,e.id)),'compute_return',(SELECT jsonb_build_object('units',c.units,'received_at',c.received_at) FROM compute_returns c WHERE (c.firm_id,c.execution_id)=(e.firm_id,e.id))) AS data FROM executions e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE e.firm_id=$1 AND e.id=$2"),
            // Management visibility does not grant resource request/response body access.
            "intents"=>sqlx::query("SELECT work_id,principal_id,jsonb_build_object('id',id,'firm_id',firm_id,'principal_id',principal_id,'operation',operation,'resource_id',resource_id,'work_id',work_id,'delegation_id',delegation_id,'state',state,'created_at',created_at,'origin_instance_id',origin_instance_id,'origin_generation',origin_generation) AS data FROM intents WHERE firm_id=$1 AND id=$2"),
            _=>return Err(Error::Invalid),
        }.bind(self.firm).bind(id).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
        if let Some((work, _)) = scope
            && row.get::<Option<Uuid>, _>("work_id") != Some(work)
        {
            return Err(Error::Denied);
        }
        if let Some(work) = row.get::<Option<Uuid>, _>("work_id") {
            match self
                .any_work_permission(&mut tx, &ctx, work, "inspect")
                .await
            {
                Ok(_) => {}
                Err(Error::Denied) => return Err(Error::NotFound),
                Err(e) => return Err(e),
            }
        } else if row.get::<Uuid, _>("principal_id") != ctx.principal
            || !self.unscoped_inspect(&mut tx, &ctx).await?
        {
            return Err(Error::NotFound);
        }
        Ok(row.get("data"))
    }

    pub async fn restrict(
        &self,
        caller: impl Into<Actor>,
        key: &str,
        kind: &str,
        id: Uuid,
        revision: i64,
    ) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let p = ctx.principal;
        let op = match kind {
            "delegations" => "delegation.revoke",
            "executions" => "execution.stop",
            _ => return Err(Error::Invalid),
        };
        let input = json!({"id":id,"expected_revision":revision});
        if let Some(a) = self.existing(&mut tx, &ctx, op, key, &input).await? {
            return Ok(a);
        }
        let work = if kind == "executions" {
            let work =
                sqlx::query_scalar("SELECT work_id FROM executions WHERE firm_id=$1 AND id=$2")
                    .bind(self.firm)
                    .bind(id)
                    .fetch_optional(&mut *tx)
                    .await?
                    .ok_or(Error::NotFound)?;
            self.any_work_permission(&mut tx, &ctx, work, op).await?;
            Some(work)
        } else {
            self.revoke_permission(&mut tx, &ctx, id).await?
        };
        let current: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        if revision != current {
            return Err(Error::Conflict);
        }
        let query = if kind == "delegations" {
            "UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2"
        } else {
            "UPDATE executions SET stopped=true WHERE firm_id=$1 AND id=$2"
        };
        sqlx::query(query)
            .bind(self.firm)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE firms SET revision=revision+1 WHERE id=$1")
            .bind(self.firm)
            .execute(&mut *tx)
            .await?;
        let a = self.intent(&mut tx, p, op, key, input, (id, None)).await?;
        self.management_record(&mut tx, &ctx, a.intent_id, work)
            .await?;
        self.event(
            &mut tx,
            p,
            "restriction.accepted",
            id,
            json!({"operation":op,"applied":false,"remaining_effects":"unreconciled"}),
        )
        .await?;
        if kind == "delegations" {
            sqlx::query("UPDATE events SET work_id=$2 WHERE firm_id=$1 AND sequence=(SELECT event_sequence FROM firms WHERE id=$1)").bind(self.firm).bind(work).execute(&mut *tx).await?;
        }
        tx.commit().await?;
        Ok(a)
    }

    async fn revoke_permission(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        target: Uuid,
    ) -> Result<Option<Uuid>> {
        let owner: Uuid =
            sqlx::query_scalar("SELECT principal_id FROM delegations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(target)
                .fetch_optional(&mut **tx)
                .await?
                .ok_or(Error::NotFound)?;
        let constraints = self.grant_work_roots(tx, target).await?;
        let mut root = None;
        for c in constraints {
            match root {
                None => root = Some(c),
                Some(r) => {
                    if self.work_descends(tx, c, r).await? {
                        root = Some(c);
                    } else if !self.work_descends(tx, r, c).await? {
                        return Err(Error::Denied);
                    }
                }
            }
        }
        if let Some(b) = &ctx.bound {
            let root = root.ok_or(Error::Denied)?;
            if !self.grant_descends(tx, target, b.grant).await? {
                return Err(Error::Denied);
            }
            self.actor_permission(tx, ctx, b.grant, root, "delegation.revoke")
                .await?;
            return Ok(Some(root));
        }
        // A human controls their own delegation tree, not arbitrary grants seen in work records.
        let related:bool=sqlx::query_scalar("WITH RECURSIVE chain AS (SELECT id,parent_id,principal_id FROM delegations WHERE firm_id=$1 AND id=$2 UNION SELECT d.id,d.parent_id,d.principal_id FROM delegations d JOIN chain c ON d.id=c.parent_id WHERE d.firm_id=$1) SELECT EXISTS(SELECT 1 FROM chain WHERE principal_id=$3)")
            .bind(self.firm).bind(target).bind(ctx.principal).fetch_one(&mut **tx).await?;
        if owner != ctx.principal && !related {
            return Err(Error::Denied);
        }
        if let Some(root) = root {
            self.any_work_permission(tx, ctx, root, "delegation.revoke")
                .await?;
            return Ok(Some(root));
        }
        for d in self.action_grants(tx, ctx, "delegation.revoke").await? {
            if self.grant_work_roots(tx, d).await?.is_empty() {
                return Ok(None);
            }
        }
        Err(Error::Denied)
    }

    pub async fn events(&self, caller: impl Into<Actor>, cursor: &str) -> Result<Vec<StatusEvent>> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let roots = self.readable_roots(&mut tx, &ctx).await?;
        let bits: Vec<_> = cursor.split(':').collect();
        if bits.len() != 3 || bits[0] != ctx.realm() {
            return Err(Error::Conflict);
        }
        let revision = bits[1].parse::<i64>().map_err(|_| Error::Invalid)?;
        let after = bits[2].parse::<i64>().map_err(|_| Error::Invalid)?;
        let f =
            sqlx::query("SELECT revision,event_sequence,admission_paused FROM firms WHERE id=$1")
                .bind(self.firm)
                .fetch_one(&mut *tx)
                .await?;
        if revision != f.get::<i64, _>("revision")
            || after < 0
            || after > f.get::<i64, _>("event_sequence")
        {
            return Err(Error::Conflict);
        }
        let global = self.unscoped_inspect(&mut tx, &ctx).await?;
        let rows=sqlx::query("WITH RECURSIVE visible AS (SELECT id FROM work WHERE firm_id=$1 AND id=ANY($2) UNION SELECT w.id FROM work w JOIN visible v ON w.parent_id=v.id WHERE w.firm_id=$1) SELECT sequence,kind,resource_id,data||jsonb_build_object('principal_id',principal_id,'work_id',work_id,'received_at',received_at) AS data FROM events WHERE firm_id=$1 AND sequence>$3 AND (work_id IN(SELECT id FROM visible) OR ($4 AND work_id IS NULL AND principal_id=$5)) ORDER BY sequence LIMIT 100")
            .bind(self.firm).bind(roots).bind(after).bind(global).bind(ctx.principal).fetch_all(&mut *tx).await?;
        Ok(rows
            .iter()
            .map(|r| StatusEvent {
                sequence: r.get("sequence"),
                source: "core".into(),
                kind: r.get("kind"),
                resource_id: r.get("resource_id"),
                // Work visibility covers progress, not namespace-protected receipts or input.
                // Apply to historical events too: old writers embedded resource receipts.
                data: if r.get::<String, _>("kind").starts_with("resource.") {
                    let original: Value = r.get("data");
                    let mut projected = serde_json::Map::new();
                    for key in [
                        "principal_id",
                        "work_id",
                        "received_at",
                        "operation",
                        "target",
                        "instance_id",
                        "attempt_id",
                        "source",
                        "state",
                    ] {
                        if let Some(value) = original.get(key) {
                            projected.insert(key.into(), value.clone());
                        }
                    }
                    projected.insert("intent_id".into(), json!(r.get::<Uuid, _>("resource_id")));
                    Value::Object(projected)
                } else {
                    r.get("data")
                },
            })
            .collect())
    }
}
