//! Reconcile original capacity under the same firm fence as admission and revocation.
use super::*;
use ouroboros_contracts::ComputeReturnReceipt;

impl Core {
    pub async fn runtime_compute_return(
        &self,
        execution: Uuid,
        worker: &str,
        receipt: &ComputeReturnReceipt,
    ) -> Result<()> {
        if !receipt.container_terminated
            || !receipt.bridge_terminated
            || !receipt.guard_terminated
            || receipt.binding.allocation.is_none()
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        // The original assigned observer retains only reconciliation authority after revocation.
        let row = sqlx::query("SELECT r.instance_id,r.generation,r.binding,r.phase,e.intent_id,e.terminated,i.principal_id FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.worker_id=$3")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        if row.get::<Uuid, _>("instance_id") != receipt.instance_id
            || row.get::<Uuid, _>("generation") != receipt.generation
            || row.get::<Option<Value>, _>("binding") != Some(json!(receipt.binding))
            || row.get::<String, _>("phase") != "terminated"
            || !row.get::<bool, _>("terminated")
        {
            return Err(Error::Conflict);
        }
        let previous: Option<Value> = sqlx::query_scalar(
            "SELECT receipt FROM compute_returns WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_optional(&mut *tx)
        .await?;
        if let Some(previous) = previous {
            return if previous == json!(receipt) {
                Ok(())
            } else {
                Err(Error::Conflict)
            };
        }
        let intent: Uuid = row.get("intent_id");
        let reservation = sqlx::query("SELECT units,settled FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute' FOR UPDATE")
            .bind(self.firm).bind(intent).fetch_optional(&mut *tx).await?.ok_or(Error::Conflict)?;
        if reservation.get::<bool, _>("settled") {
            return Err(Error::Conflict);
        }
        let units: i64 = reservation.get("units");
        let changed = sqlx::query("UPDATE limits SET committed=committed-$2 WHERE firm_id=$1 AND id='compute' AND committed >= $2")
            .bind(self.firm).bind(units).execute(&mut *tx).await?.rows_affected();
        if changed != 1 {
            return Err(Error::Conflict);
        }
        sqlx::query(
            "INSERT INTO compute_returns(firm_id,execution_id,receipt,units) VALUES($1,$2,$3,$4)",
        )
        .bind(self.firm)
        .bind(execution)
        .bind(json!(receipt))
        .bind(units)
        .execute(&mut *tx)
        .await?;
        sqlx::query("UPDATE reservations SET settled=true WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'")
            .bind(self.firm).bind(intent).execute(&mut *tx).await?;
        self.event(&mut tx,row.get("principal_id"),"runtime.compute_returned",execution,
            json!({"source":"runtime","instance_id":receipt.instance_id,"generation":receipt.generation,"units":units,"effects_settled":false,"work_success_confirmed":false})).await?;
        tx.commit().await?;
        Ok(())
    }
}
