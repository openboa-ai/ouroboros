//! Scope-limited owner observations. These projections never return protected inputs or receipts.
use super::*;

pub(super) fn continuation<'a>(cursor: Option<&'a str>, prefix: &str) -> Result<Option<&'a str>> {
    cursor
        .map(|value| {
            value
                .strip_prefix(prefix)
                .filter(|tail| !tail.is_empty())
                .ok_or(Error::Conflict)
        })
        .transpose()
}

impl Core {
    /// Resolve an original request without dispatch. Visibility is evaluated again now;
    /// request keys are namespaced by the authenticated principal and operation.
    pub async fn intent_by_request_key(
        &self,
        actor: impl Into<Actor>,
        operation: &str,
        key: &str,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if operation.is_empty()
            || operation.len() > 128
            || !operation
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'_')
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.action_grants(&mut tx, &ctx, "inspect").await?;
        let row = sqlx::query(
            r#"
            SELECT work_id, jsonb_build_object('id',id,'intent_id',id,'resource_id',resource_id,
                'work_id',work_id,'operation',operation,'state',state,
                'expected_revision',input->'expected_revision','created_at',created_at) AS data
            FROM intents WHERE firm_id=$1 AND principal_id=$2 AND operation=$3 AND request_key=$4
        "#,
        )
        .bind(self.firm)
        .bind(ctx.principal)
        .bind(operation)
        .bind(key)
        .fetch_optional(&mut *tx)
        .await?;
        let intent = if let Some(row) = row {
            if let Some(work) = row.get::<Option<Uuid>, _>("work_id") {
                self.observation_work(&mut tx, &ctx, work).await?;
            } else if !self.unscoped_inspect(&mut tx, &ctx).await? {
                return Err(Error::NotFound);
            }
            Some(row.get::<Value, _>("data"))
        } else {
            None
        };
        Ok(json!({"recorded":intent.is_some(),"intent":intent,
            "source":"core_request_record","resubmitted":false}))
    }

    /// Observe one caller's original stop request without replaying or resubmitting it.
    pub async fn execution_stop_request(
        &self,
        actor: impl Into<Actor>,
        execution: Uuid,
        key: &str,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        let work: Uuid =
            sqlx::query_scalar("SELECT work_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(execution)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Error::NotFound)?;
        self.observation_work(&mut tx, &ctx, work).await?;
        let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        let found:Option<Value>=sqlx::query_scalar(r#"
            SELECT jsonb_build_object('id',id,'intent_id',id,'resource_id',resource_id,'work_id',work_id,
                'operation',operation,'state',state,'expected_revision',input->'expected_revision','created_at',created_at)
            FROM intents WHERE firm_id=$1 AND principal_id=$2 AND work_id=$3
                AND operation='execution.stop' AND resource_id=$4 AND request_key=$5
        "#).bind(self.firm).bind(ctx.principal).bind(work).bind(execution).bind(key).fetch_optional(&mut *tx).await?;
        Ok(
            json!({"recorded":found.is_some(),"intent":found,"execution_id":execution,"work_id":work,
            "authority_revision":revision,"source":"core_request_record","resubmitted":false}),
        )
    }

    pub(super) async fn observation_work(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        work: Uuid,
    ) -> Result<()> {
        match self.any_work_permission(tx, ctx, work, "inspect").await {
            Ok(_) => {}
            Err(Error::Denied) => return Err(Error::NotFound),
            Err(error) => return Err(error),
        }
        let exists: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM work WHERE firm_id=$1 AND id=$2)")
                .bind(self.firm)
                .bind(work)
                .fetch_one(&mut **tx)
                .await?;
        if !exists {
            return Err(Error::NotFound);
        }
        Ok(())
    }

    pub async fn work_executions(
        &self,
        actor: impl Into<Actor>,
        work: Uuid,
        cursor: Option<&str>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.observation_work(&mut tx, &ctx, work).await?;
        let firm = sqlx::query("SELECT revision,event_sequence,statement_timestamp()::text AS observed_at FROM firms WHERE id=$1")
            .bind(self.firm).fetch_one(&mut *tx).await?;
        let revision: i64 = firm.get("revision");
        let prefix = format!("{}:{revision}:{work}:executions:", ctx.realm());
        let after = continuation(cursor, &prefix)?
            .map(|value| Uuid::parse_str(value).map_err(|_| Error::Invalid))
            .transpose()?;
        let can_stop = match self
            .any_work_permission(&mut tx, &ctx, work, "execution.stop")
            .await
        {
            Ok(_) => true,
            Err(Error::Denied) => false,
            Err(error) => return Err(error),
        };
        // Execution mechanics come from the admitted profile snapshot, never the current profile.
        // Runtime binding, command input, environment, native transcript and resource receipts stay private.
        let mut items: Vec<Value> = sqlx::query_scalar(r#"
            SELECT jsonb_build_object(
                'id',e.id,'work_id',e.work_id,'intent_id',e.intent_id,
                'predecessor_id',e.predecessor_id,'instance_id',e.instance_id,'generation',e.generation,
                'initiating_principal_id',i.principal_id,'agent_principal_id',agent.id,
                'agent_enabled',agent.enabled,'agent_delegation_id',d.id,
                'profile_id',i.input->>'profile_id','native_model',p.profile->>'native_model',
                'created_at',i.created_at,'state',i.state,'stopped',e.stopped,'terminated',e.terminated,
                'can_stop',($4 AND NOT e.stopped AND NOT e.terminated),
                'native_turn',(SELECT jsonb_build_object('thread_id',n.thread_id,'turn_id',n.turn_id,'status',n.status)
                    FROM native_turns n WHERE (n.firm_id,n.execution_id)=(e.firm_id,e.id) AND n.status='inProgress'),
                'runtime',(SELECT jsonb_build_object('source','core_runtime_record','worker_id',r.worker_id,
                    'phase',r.phase,'deadline_at',r.deadline_at,'liveness_confirmed',false)
                    FROM runtime_instances r WHERE (r.firm_id,r.execution_id)=(e.firm_id,e.id)),
                'program_observation',(SELECT jsonb_build_object('source','runtime_backend','received_at',o.received_at,
                    'work_success_confirmed',false,'effects_settled',false)
                    FROM program_observations o WHERE (o.firm_id,o.execution_id)=(e.firm_id,e.id)),
                'compute_return',(SELECT jsonb_build_object('units',c.units,'received_at',c.received_at)
                    FROM compute_returns c WHERE (c.firm_id,c.execution_id)=(e.firm_id,e.id)),
                'last_observed_at',(SELECT max(v.received_at) FROM events v
                    WHERE v.firm_id=e.firm_id AND v.resource_id=e.id
                    AND (v.kind LIKE 'runtime.%' OR v.kind LIKE 'instance.%' OR v.kind='native.turn_observed'))
            )
            FROM executions e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id)
            LEFT JOIN delegations d ON d.firm_id=e.firm_id AND d.id::text=i.input->>'agent_delegation_id'
            LEFT JOIN principals agent ON (agent.firm_id,agent.id)=(d.firm_id,d.principal_id) AND agent.kind='agent'
            LEFT JOIN execution_programs p ON (p.firm_id,p.execution_id)=(e.firm_id,e.id)
            WHERE e.firm_id=$1 AND e.work_id=$2 AND ($3::uuid IS NULL OR e.id>$3)
            ORDER BY e.id LIMIT 51
        "#).bind(self.firm).bind(work).bind(after).bind(can_stop).fetch_all(&mut *tx).await?;
        let has_more = items.len() > 50;
        items.truncate(50);
        let next = if has_more {
            Some(format!(
                "{prefix}{}",
                items
                    .last()
                    .and_then(|v| v["id"].as_str())
                    .ok_or(Error::Unavailable)?
            ))
        } else {
            None
        };
        Ok(
            json!({"work_id":work,"items":items,"next_cursor":next,"has_more":has_more,
            "authority_revision":revision,"source":"core_records","observed_at":firm.get::<String,_>("observed_at"),
            "event_cursor":format!("{}:{revision}:{}",ctx.realm(),firm.get::<i64,_>("event_sequence"))}),
        )
    }

    pub async fn work_activity(
        &self,
        actor: impl Into<Actor>,
        work: Uuid,
        cursor: Option<&str>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.observation_work(&mut tx, &ctx, work).await?;
        let firm = sqlx::query("SELECT revision,event_sequence,statement_timestamp()::text AS observed_at FROM firms WHERE id=$1")
            .bind(self.firm).fetch_one(&mut *tx).await?;
        let revision: i64 = firm.get("revision");
        let high: i64 = firm.get("event_sequence");
        let prefix = format!("{}:{revision}:{work}:activity:", ctx.realm());
        let after = continuation(cursor, &prefix)?
            .map(|value| value.parse::<i64>().map_err(|_| Error::Invalid))
            .transpose()?
            .unwrap_or(0);
        if after < 0 || after > high {
            return Err(Error::Conflict);
        }
        // Historical native.turn_observed events lack work_id. Recover only that exact event kind
        // through its recorded execution; never widen visibility to arbitrary unscoped events.
        // All data fields are explicitly selected. No input/output/body/receipt/text is exposed.
        let mut items: Vec<Value> = sqlx::query_scalar(r#"
            SELECT jsonb_build_object(
                'sequence',v.sequence,'source','core','kind',v.kind,'resource_id',v.resource_id,
                'work_id',$2::uuid,'principal_id',v.principal_id,'received_at',v.received_at,
                'operation',v.data->>'operation','state',v.data->>'state','target',v.data->>'target',
                'instance_id',v.data->>'instance_id','thread_id',v.data->>'thread_id',
                'turn_id',v.data->>'turn_id','status',v.data->>'status'
            ) FROM events v
            WHERE v.firm_id=$1 AND v.sequence>$3 AND v.sequence<=$4
                AND (v.work_id=$2 OR (v.work_id IS NULL AND v.kind='native.turn_observed' AND EXISTS(
                    SELECT 1 FROM executions e WHERE e.firm_id=v.firm_id AND e.id=v.resource_id AND e.work_id=$2)))
            ORDER BY v.sequence LIMIT 101
        "#).bind(self.firm).bind(work).bind(after).bind(high).fetch_all(&mut *tx).await?;
        let has_more = items.len() > 100;
        items.truncate(100);
        let last = if has_more {
            items
                .last()
                .and_then(|v| v["sequence"].as_i64())
                .ok_or(Error::Unavailable)?
        } else {
            high
        };
        let cursor = format!("{prefix}{last}");
        Ok(json!({"work_id":work,"items":items,"cursor":cursor,
            "next_cursor":if has_more {Some(cursor.clone())} else {None},"has_more":has_more,
            "authority_revision":revision,"snapshot_sequence":high,"source":"core_event_metadata",
            "observed_at":firm.get::<String,_>("observed_at"),"native_transcript_available":false}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn continuation_is_bound_to_actor_revision_work_and_projection() {
        let prefix = "actor:7:work:activity:";
        assert_eq!(continuation(None, prefix).unwrap(), None);
        assert_eq!(
            continuation(Some("actor:7:work:activity:42"), prefix).unwrap(),
            Some("42")
        );
        for stale in [
            "other:7:work:activity:42",
            "actor:6:work:activity:42",
            "actor:7:other:activity:42",
            "actor:7:work:executions:42",
            "actor:7:work:activity:",
        ] {
            assert!(matches!(
                continuation(Some(stale), prefix),
                Err(Error::Conflict)
            ));
        }
    }
}
