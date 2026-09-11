use super::*;
use ouroboros_contracts::{NativeControlRequest, NativeInstruction, NativeTurnReport};
fn identity(thread: &str, turn: &str) -> bool {
    [thread, turn]
        .iter()
        .all(|id| !id.is_empty() && id.len() <= 512 && !id.chars().any(char::is_control))
}
impl Core {
    pub async fn runtime_native_turn(
        &self,
        execution: Uuid,
        worker: &str,
        report: &NativeTurnReport,
    ) -> Result<()> {
        if !identity(&report.thread_id, &report.turn_id)
            || !matches!(
                report.status.as_str(),
                "inProgress" | "completed" | "interrupted" | "failed"
            )
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT i.principal_id,r.phase FROM runtime_instances r JOIN executions e ON (e.firm_id,e.id)=(r.firm_id,r.execution_id) JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE r.firm_id=$1 AND r.execution_id=$2 AND r.worker_id=$3")
            .bind(self.firm).bind(execution).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let old:Option<String>=sqlx::query_scalar("SELECT status FROM native_turns WHERE firm_id=$1 AND execution_id=$2 AND thread_id=$3 AND turn_id=$4")
            .bind(self.firm).bind(execution).bind(&report.thread_id).bind(&report.turn_id).fetch_optional(&mut *tx).await?;
        if old.as_deref() == Some(report.status.as_str()) {
            return Ok(());
        }
        if let Some(old) = old {
            if old != "inProgress" || report.status == "inProgress" {
                return Err(Error::Conflict);
            }
            sqlx::query("UPDATE native_turns SET status=$5 WHERE firm_id=$1 AND execution_id=$2 AND thread_id=$3 AND turn_id=$4")
                .bind(self.firm).bind(execution).bind(&report.thread_id).bind(&report.turn_id).bind(&report.status).execute(&mut *tx).await?;
        } else {
            if report.status != "inProgress" || row.get::<String, _>("phase") != "released" {
                return Err(Error::Conflict);
            }
            self.runtime_allowed(&mut tx, execution, worker).await?;
            let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM native_turns WHERE firm_id=$1 AND execution_id=$2 AND status='inProgress')")
                .bind(self.firm).bind(execution).fetch_one(&mut *tx).await?;
            if active {
                return Err(Error::Conflict);
            }
            sqlx::query("INSERT INTO native_turns VALUES($1,$2,$3,$4,$5)")
                .bind(self.firm)
                .bind(execution)
                .bind(&report.thread_id)
                .bind(&report.turn_id)
                .bind(&report.status)
                .execute(&mut *tx)
                .await?;
        }
        self.event(&mut tx,row.get("principal_id"),"native.turn_observed",execution,json!({"source":"native_runtime","thread_id":report.thread_id,"turn_id":report.turn_id,"status":report.status})).await?;
        tx.commit().await?;
        Ok(())
    }
    pub async fn native_control(
        &self,
        caller: impl Into<Actor>,
        execution: Uuid,
        key: &str,
        request: NativeControlRequest,
    ) -> Result<Accepted> {
        if key.starts_with("conversation:") {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let accepted = self
            .native_control_locked(&mut tx, &ctx, execution, key, request)
            .await?;
        tx.commit().await?;
        Ok(accepted)
    }
    pub(super) async fn native_control_locked(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        execution: Uuid,
        key: &str,
        request: NativeControlRequest,
    ) -> Result<Accepted> {
        if !identity(&request.thread_id, &request.turn_id) {
            return Err(Error::Invalid);
        }
        let operation = match &request.instruction {
            NativeInstruction::Steer { text } => {
                if text.is_empty() || text.len() > 65536 || text.contains('\0') {
                    return Err(Error::Invalid);
                }
                "execution.steer"
            }
            NativeInstruction::Interrupt => "execution.interrupt",
        };
        let input = json!({"execution_id":execution,"request":request});
        if let Some(existing) = self.existing(tx, ctx, operation, key, &input).await? {
            return Ok(existing);
        }
        let work:Uuid=sqlx::query_scalar("SELECT work_id FROM executions WHERE firm_id=$1 AND id=$2 AND NOT stopped AND NOT terminated")
            .bind(self.firm).bind(execution).fetch_optional(&mut **tx).await?.ok_or(Error::Denied)?;
        self.actor_permission(tx, ctx, request.delegation_id, work, operation)
            .await?;
        let active:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM native_turns n JOIN runtime_instances r USING(firm_id,execution_id) WHERE n.firm_id=$1 AND n.execution_id=$2 AND n.thread_id=$3 AND n.turn_id=$4 AND n.status='inProgress' AND r.phase='released' AND r.deadline_at>clock_timestamp())")
            .bind(self.firm).bind(execution).bind(&request.thread_id).bind(&request.turn_id).fetch_one(&mut **tx).await?;
        if !active {
            return Err(Error::Conflict);
        }
        let worker: String = sqlx::query_scalar(
            "SELECT worker_id FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.firm)
        .bind(execution)
        .fetch_one(&mut **tx)
        .await?;
        self.runtime_allowed(tx, execution, &worker).await?;

        let count:i64=sqlx::query_scalar("SELECT count(*) FROM native_controls c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.intent_id) WHERE c.firm_id=$1 AND c.execution_id=$2 AND i.state IN ('accepted','claimed','unresolved')")
            .bind(self.firm).bind(execution).fetch_one(&mut **tx).await?;
        if count >= 16 {
            return Err(Error::Capacity);
        }
        let accepted = self
            .intent(
                tx,
                ctx.principal,
                operation,
                key,
                input,
                (execution, Some(request.delegation_id)),
            )
            .await?;
        self.management_record(tx, ctx, accepted.intent_id, Some(work))
            .await?;
        sqlx::query("INSERT INTO native_controls VALUES($1,$2,$3,$4,$5)")
            .bind(self.firm)
            .bind(accepted.intent_id)
            .bind(execution)
            .bind(&request.thread_id)
            .bind(&request.turn_id)
            .execute(&mut **tx)
            .await?;
        Ok(accepted)
    }
}
