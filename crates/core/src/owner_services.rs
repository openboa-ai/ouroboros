//! Fixed control-plane views of Company continuation and its qualified dependencies.
//! No payloads, configuration, secrets or authority are derived from these read-only projections.
use super::*;

impl Core {
    pub async fn work_service_continuations(
        &self,
        actor: impl Into<Actor>,
        work: Uuid,
        cursor: Option<&str>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.observation_work(&mut tx, &ctx, work).await?;
        let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        let prefix = format!("{}:{revision}:{work}:service-continuations:", ctx.realm());
        let after = super::owner_observations::continuation(cursor, &prefix)?
            .map(|tail| Uuid::parse_str(tail).map_err(|_| Error::Invalid))
            .transpose()?;
        let mut ids: Vec<Uuid> = sqlx::query_scalar("SELECT l.root_intent_id FROM service_continuations l JOIN intents i ON (i.firm_id,i.id)=(l.firm_id,l.root_intent_id) WHERE l.firm_id=$1 AND i.work_id=$2 AND ($3::uuid IS NULL OR l.root_intent_id>$3) ORDER BY l.root_intent_id LIMIT 26")
            .bind(self.firm).bind(work).bind(after).fetch_all(&mut *tx).await?;
        let has_more = ids.len() > 25;
        ids.truncate(25);
        let next_cursor = if has_more {
            Some(format!("{prefix}{}", ids.last().ok_or(Error::Unavailable)?))
        } else {
            None
        };
        let mut items = Vec::new();
        for id in ids {
            items.push(self.owner_service_observation(&mut tx, &ctx, id).await?);
        }
        let observed: String = sqlx::query_scalar("SELECT clock_timestamp()::text")
            .fetch_one(&mut *tx)
            .await?;
        Ok(
            json!({"schema_version":1,"source":"core_service_records","work_id":work,"items":items,
            "authority_revision":revision,"observed_at":observed,"next_cursor":next_cursor,"has_more":has_more,
            "coverage":"registered_call_continuations","health_assessed":false}),
        )
    }

    pub(super) async fn owner_service_observation(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        id: Uuid,
    ) -> Result<Value> {
        let original: Uuid = sqlx::query_scalar(
            "SELECT execution_id FROM service_calls WHERE firm_id=$1 AND root_intent_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(Error::NotFound)?;
        let root = self
            .service_root(tx, original)
            .await?
            .ok_or(Error::NotFound)?;
        let work: Uuid = root.get("work_id");
        let mut out = self.continuation_observation(tx, id).await?;
        let can_stop = match self
            .any_work_permission(tx, ctx, work, "execution.stop")
            .await
        {
            Ok(_) => out["desired"] != "stopped",
            Err(Error::Denied) => false,
            Err(error) => return Err(error),
        };
        let binding: Value = root.get("binding");
        let mut targets = Vec::new();
        // One entry per frozen target, with the operations that actually use it. Matching a
        // configuration is not a live probe and must never be presented as service health.
        for expected in binding["selection"]["targets"]
            .as_array()
            .ok_or(Error::Unavailable)?
        {
            let target = expected["target"].as_str().ok_or(Error::Unavailable)?;
            let current = sqlx::query("SELECT active,worker_id,configuration FROM resource_targets WHERE firm_id=$1 AND id=$2")
                .bind(self.firm).bind(target).fetch_optional(&mut **tx).await?;
            let selection = match &current {
                None => "not_registered",
                Some(row) if !row.get::<bool, _>("active") => "disabled",
                Some(row)
                    if json!(row.get::<String, _>("worker_id")) != expected["worker_id"]
                        || row.get::<Value, _>("configuration") != expected["configuration"] =>
                {
                    "selection_changed"
                }
                Some(_) => "selection_current",
            };
            let mut operations: Vec<String> = binding["selection"]["operation"]["effects"]
                .as_array()
                .ok_or(Error::Unavailable)?
                .iter()
                .filter(|effect| effect["target"] == target)
                .filter_map(|effect| effect["operation"].as_str().map(str::to_owned))
                .collect();
            if binding["service_slot"] == target {
                operations.push("adapter.invoke".into());
                operations.push("service.manage".into());
            }
            operations.sort();
            operations.dedup();
            let mut access = "permitted";
            for operation in &operations {
                match self
                    .service_caller_permission(tx, &root, target, operation)
                    .await
                {
                    Ok(()) => {}
                    Err(Error::Denied) => {
                        access = "restricted";
                        break;
                    }
                    Err(error) => return Err(error),
                }
            }
            targets.push(json!({"target":target,"operations":operations,"selection":selection,"caller_access":access,"health":"not_observed"}));
        }
        let execution = Uuid::parse_str(
            out["current_execution_id"]
                .as_str()
                .ok_or(Error::Unavailable)?,
        )
        .map_err(|_| Error::Unavailable)?;
        let inputs: Value = sqlx::query_scalar("SELECT jsonb_build_object('total',count(*),'retained',count(*) FILTER(WHERE retained),'scope','current_execution_inputs') FROM execution_inputs WHERE firm_id=$1 AND execution_id=$2")
            .bind(self.firm).bind(execution).fetch_one(&mut **tx).await?;
        let effects: Vec<Value> = sqlx::query_scalar("SELECT jsonb_build_object('slot',s.effect_slot,'intent_id',s.child_intent_id,'operation',i.operation,'state',i.state,'receipt_available',r.reply IS NOT NULL) FROM service_effects s JOIN intents i ON (i.firm_id,i.id)=(s.firm_id,s.child_intent_id) JOIN resource_calls r ON (r.firm_id,r.intent_id)=(s.firm_id,s.child_intent_id) WHERE s.firm_id=$1 AND s.root_intent_id=$2 ORDER BY s.effect_slot")
            .bind(self.firm).bind(id).fetch_all(&mut **tx).await?;
        let compute: Option<Value> = sqlx::query_scalar("SELECT jsonb_build_object('capacity',capacity,'committed',committed,'available',capacity-committed,'scope','firm_compute') FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(self.firm).fetch_optional(&mut **tx).await?;
        out["schema_version"] = json!(1);
        out["work_id"] = json!(work);
        out["operation"] = binding["selection"]["operation"]["name"].clone();
        out["target"] = binding["service_slot"].clone();
        out["can_stop"] = json!(can_stop);
        out["dependencies"] = json!({"targets":targets,"inputs":inputs});
        out["effects"] = json!(effects);
        // Firm-wide capacity is shown only to a caller whose current inspection scope allows it.
        out["compute"] = if self.unscoped_inspect(tx, ctx).await? {
            json!(compute)
        } else {
            Value::Null
        };
        Ok(out)
    }

    /// Outcome lookup is deliberately separate from stop. Missing is not permission to resubmit.
    pub async fn service_continuation_stop_request(
        &self,
        actor: impl Into<Actor>,
        id: Uuid,
        key: &str,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        let work:Uuid=sqlx::query_scalar("SELECT i.work_id FROM service_continuations c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.root_intent_id) WHERE c.firm_id=$1 AND c.root_intent_id=$2")
            .bind(self.firm).bind(id).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
        self.observation_work(&mut tx, &ctx, work).await?;
        let receipt:Option<Value>=sqlx::query_scalar("SELECT jsonb_build_object('root_intent_id',root_intent_id,'execution_id',request->'request'->'expected_execution_id','restriction_recorded',true) FROM service_continuation_stops WHERE firm_id=$1 AND root_intent_id=$2 AND issuer_id=$3 AND request_key=$4")
            .bind(self.firm).bind(id).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await?;
        Ok(
            json!({"source":"core_request_record","root_intent_id":id,"request_key":key,"recorded":receipt.is_some(),"receipt":receipt,"resubmitted":false}),
        )
    }
}
