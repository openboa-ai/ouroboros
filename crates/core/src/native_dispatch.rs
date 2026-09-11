use super::*;
use ouroboros_contracts::{NativeControlAck, NativeControlRequest, NativeControlTicket};
impl Core {
    pub async fn native_pending(&self, execution: Uuid, worker: &str) -> Result<Vec<Uuid>> {
        let mut tx = self.fence().await?;
        self.runtime_allowed(&mut tx, execution, worker).await?;
        Ok(sqlx::query_scalar("SELECT c.intent_id FROM native_controls c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.intent_id) WHERE c.firm_id=$1 AND c.execution_id=$2 AND i.state='accepted' ORDER BY i.created_at,i.id LIMIT 16")
            .bind(self.firm).bind(execution).fetch_all(&mut *tx).await?)
    }
    async fn native_dispatch_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
        worker: &str,
    ) -> Result<Uuid> {
        let row=sqlx::query("SELECT c.execution_id,c.thread_id,c.turn_id,i.operation FROM native_controls c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.intent_id) WHERE c.firm_id=$1 AND c.intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        self.conversation_delivery_allowed(tx, intent).await?;
        let execution = row.get("execution_id");
        self.runtime_allowed(tx, execution, worker).await?;
        self.management_origin_allowed(tx, intent, &row.get::<String, _>("operation"))
            .await?;
        let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM native_turns WHERE firm_id=$1 AND execution_id=$2 AND thread_id=$3 AND turn_id=$4 AND status='inProgress')")
            .bind(self.firm).bind(execution).bind(row.get::<String,_>("thread_id")).bind(row.get::<String,_>("turn_id")).fetch_one(&mut **tx).await?;
        if !active {
            return Err(Error::Conflict);
        }
        Ok(execution)
    }
    pub async fn native_claim(&self, intent: Uuid, worker: &str) -> Result<NativeControlTicket> {
        let mut tx = self.fence().await?;
        let execution = self
            .native_dispatch_allowed(&mut tx, intent, worker)
            .await?;
        let row=sqlx::query("SELECT i.state,i.input,r.instance_id,r.generation FROM intents i JOIN runtime_instances r ON r.firm_id=i.firm_id AND r.execution_id=i.resource_id WHERE i.firm_id=$1 AND i.id=$2")
            .bind(self.firm).bind(intent).fetch_one(&mut *tx).await?;
        if row.get::<String, _>("state") != "accepted" {
            return Err(Error::Conflict);
        }
        let input: Value = row.get("input");
        let request: NativeControlRequest =
            serde_json::from_value(input["request"].clone()).map_err(|_| Error::Unavailable)?;
        let attempt = Uuid::new_v4();
        sqlx::query("INSERT INTO attempts VALUES($1,$2,$3,$4,'claimed')")
            .bind(self.firm)
            .bind(attempt)
            .bind(intent)
            .bind(worker)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .execute(&mut *tx)
            .await?;
        let ticket = NativeControlTicket {
            intent_id: intent,
            attempt_id: attempt,
            execution_id: execution,
            instance_id: row.get("instance_id"),
            generation: row.get("generation"),
            request,
        };
        tx.commit().await?;
        Ok(ticket)
    }
    pub async fn native_dispatch_check(
        &self,
        intent: Uuid,
        worker: &str,
        attempt: Uuid,
    ) -> Result<()> {
        let mut tx = self.fence().await?;
        self.native_dispatch_allowed(&mut tx, intent, worker)
            .await?;
        let claimed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM attempts a JOIN intents i ON (i.firm_id,i.id)=(a.firm_id,a.intent_id) WHERE a.firm_id=$1 AND a.intent_id=$2 AND a.id=$3 AND a.worker_id=$4 AND a.state='claimed' AND i.state='claimed')")
            .bind(self.firm).bind(intent).bind(attempt).bind(worker).fetch_one(&mut *tx).await?;
        if !claimed {
            return Err(Error::Conflict);
        }
        Ok(())
    }
    pub async fn native_ack(
        &self,
        intent: Uuid,
        worker: &str,
        ack: &NativeControlAck,
    ) -> Result<()> {
        if ack.native_request_id == 0 {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT i.principal_id FROM native_controls c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.intent_id) JOIN attempts a ON (a.firm_id,a.intent_id)=(i.firm_id,i.id) WHERE c.firm_id=$1 AND c.intent_id=$2 AND a.id=$3 AND a.worker_id=$4")
            .bind(self.firm).bind(intent).bind(ack.attempt_id).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let old: Option<Value> = sqlx::query_scalar(
            "SELECT receipt FROM native_control_acks WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(old) = old {
            return if old == json!(ack) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        sqlx::query("INSERT INTO native_control_acks VALUES($1,$2,$3)")
            .bind(self.firm)
            .bind(intent)
            .bind(json!(ack))
            .execute(&mut *tx)
            .await?;
        let state = if ack.accepted {
            "succeeded"
        } else {
            "restricted"
        };
        sqlx::query("UPDATE intents SET state=$3 WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(intent)
            .bind(state)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE attempts SET state=$3 WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(ack.attempt_id)
            .bind(state)
            .execute(&mut *tx)
            .await?;
        self.event(&mut tx,row.get("principal_id"),"native.control_acknowledged",intent,json!({"source":"native_runtime","accepted":ack.accepted,"turn_completion_confirmed":false})).await?;
        tx.commit().await?;
        Ok(())
    }
}
