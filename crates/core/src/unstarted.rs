//! Explicit cancellation backed by the same serialization fence as Runtime claim.
use super::*;
impl Core {
    pub async fn cancel_unstarted(
        &self,
        actor: impl Into<Actor>,
        id: Uuid,
        key: &str,
        revision: i64,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        let row = sqlx::query("SELECT e.work_id,e.intent_id,i.state FROM executions e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE e.firm_id=$1 AND e.id=$2")
            .bind(self.firm).bind(id).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
        let work: Uuid = row.get("work_id");
        let grant = self
            .any_work_permission(&mut tx, &ctx, work, "execution.stop")
            .await?;
        let input = json!({"execution_id":id,"expected_revision":revision});
        if let Some(old)=sqlx::query("SELECT request,receipt FROM unstarted_cancellations WHERE firm_id=$1 AND issuer_id=$2 AND request_key=$3")
            .bind(self.firm).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await? {
            if old.get::<Value,_>("request")!=input {return Err(Error::Conflict);}
            return Ok(old.get("receipt"));
        }
        let current: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        if current != revision || row.get::<String, _>("state") != "accepted" {
            return Err(Error::Conflict);
        }
        let intent: Uuid = row.get("intent_id");
        let safe:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM outbox WHERE firm_id=$1 AND intent_id=$2 AND NOT claimed) AND NOT EXISTS(SELECT 1 FROM attempts WHERE firm_id=$1 AND intent_id=$2) AND NOT EXISTS(SELECT 1 FROM runtime_instances WHERE firm_id=$1 AND execution_id=$3)")
            .bind(self.firm).bind(intent).bind(id).fetch_one(&mut *tx).await?;
        if !safe {
            return Err(Error::Conflict);
        }
        let units:i64=sqlx::query_scalar("SELECT units FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute' AND NOT settled FOR UPDATE")
            .bind(self.firm).bind(intent).fetch_optional(&mut *tx).await?.ok_or(Error::Conflict)?;
        let changed=sqlx::query("UPDATE limits SET committed=committed-$2 WHERE firm_id=$1 AND id='compute' AND committed>=$2")
            .bind(self.firm).bind(units).execute(&mut *tx).await?;
        if changed.rows_affected() != 1 {
            return Err(Error::Unavailable);
        }
        sqlx::query("UPDATE reservations SET settled=true WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'").bind(self.firm).bind(intent).execute(&mut *tx).await?;
        sqlx::query("UPDATE executions SET stopped=true WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE intents SET state='restricted' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        // No instance could have read these inputs; the immutable admission remains in history.
        sqlx::query(
            "UPDATE execution_inputs SET retained=false WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE firms SET revision=revision+1 WHERE id=$1")
            .bind(self.firm)
            .execute(&mut *tx)
            .await?;
        let receipt = json!({"execution_id":id,"intent_id":intent,"source":"core_dispatch_record","issuer_id":ctx.principal,"delegation_id":grant,"origin_instance_id":ctx.bound.as_ref().map(|b|b.instance),"origin_generation":ctx.bound.as_ref().map(|b|b.generation),"never_dispatched":true,"released_compute_units":units,"work_success_confirmed":false});
        sqlx::query("INSERT INTO unstarted_cancellations VALUES($1,$2,$3,$4,$5,$6)")
            .bind(self.firm)
            .bind(id)
            .bind(ctx.principal)
            .bind(key)
            .bind(input)
            .bind(&receipt)
            .execute(&mut *tx)
            .await?;
        self.event(
            &mut tx,
            ctx.principal,
            "execution.cancelled_unstarted",
            id,
            json!({"work_id":work,"receipt":receipt}),
        )
        .await?;
        tx.commit().await?;
        Ok(receipt)
    }
}
