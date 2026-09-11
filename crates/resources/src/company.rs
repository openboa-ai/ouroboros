//! Company-data transactions and their protected, same-commit effect receipts.
//! Callers authenticate dispatch and obtain current Core admission before using this worker.
use crate::intent_lock;
use anyhow::{Result, ensure};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct CompanyWorker {
    pool: PgPool,
}
impl CompanyWorker {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
    pub async fn migrate(pool: &PgPool) -> Result<()> {
        sqlx::migrate!("./migrations/company").run(pool).await?;
        Ok(())
    }
    pub async fn read_input(&self, firm: Uuid, id: Uuid) -> Result<Value> {
        sqlx::query_scalar("SELECT content FROM inputs WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| anyhow::anyhow!("input not found"))
    }
    /// Read only: missing, mismatched or damaged evidence never runs record_result.
    pub async fn observe_result(
        &self,
        ticket: &ouroboros_contracts::CompanyRecoveryTicket,
    ) -> Result<Option<Uuid>> {
        let row=sqlx::query("SELECT e.input,e.result_id,r.content FROM effect_receipts e JOIN results r ON (r.firm_id,r.id)=(e.firm_id,e.result_id) WHERE e.firm_id=$1 AND e.intent_id=$2")
            .bind(ticket.firm_id).bind(ticket.intent_id).fetch_optional(&self.pool).await?;
        let Some(row) = row else {
            return Ok(None);
        };
        ensure!(
            row.get::<Value, _>("input") == ticket.parameters
                && row.get::<Value, _>("content") == ticket.parameters,
            "company receipt binding mismatch"
        );
        Ok(Some(row.get("result_id")))
    }
    pub async fn record_result(&self, firm: Uuid, intent: Uuid, input: Value) -> Result<Uuid> {
        ensure!(
            serde_json::to_vec(&input)?.len() <= 65536,
            "fixture result exceeds bound"
        );
        let mut tx = self.pool.begin().await?;
        intent_lock(&mut tx, intent).await?;
        if let Some(row) = sqlx::query(
            "SELECT input,result_id FROM effect_receipts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(firm)
        .bind(intent)
        .fetch_optional(&mut *tx)
        .await?
        {
            ensure!(
                row.get::<Value, _>("input") == input,
                "request identity conflict"
            );
            return Ok(row.get("result_id"));
        }
        let result = Uuid::new_v4();
        sqlx::query("INSERT INTO results VALUES($1,$2,$3)")
            .bind(firm)
            .bind(result)
            .bind(&input)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO effect_receipts(firm_id,intent_id,input,result_id) VALUES($1,$2,$3,$4)",
        )
        .bind(firm)
        .bind(intent)
        .bind(input)
        .bind(result)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(result)
    }
}
