use super::*;
use ouroboros_contracts::AdmissionControlRequest;

impl Core {
    pub async fn environment_status(
        &self,
        actor: impl Into<Actor>,
        delegation: Uuid,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.actor_grant(&mut tx, &ctx, delegation, "environment.admission")
            .await?;
        if !self.grant_work_roots(&mut tx, delegation).await?.is_empty() {
            return Err(Error::Denied);
        }
        // One statement provides a consistent database snapshot. Counts are retained records,
        // not a liveness probe, external-effect settlement or a cross-store backup barrier.
        let result: Value = sqlx::query_scalar(r#"
            SELECT jsonb_build_object(
                'firm_id', f.id, 'revision', f.revision, 'event_cursor', f.event_sequence,
                'admission_paused', f.admission_paused, 'source', 'core_records',
                'observed_at', statement_timestamp(), 'drain_confirmed', false, 'backup_ready', false,
                'executions_without_instance', (SELECT count(*) FROM executions WHERE firm_id=f.id AND instance_id IS NULL AND NOT terminated),
                'instances_without_termination', (SELECT count(*) FROM executions WHERE firm_id=f.id AND instance_id IS NOT NULL AND NOT terminated),
                'runtime_records_without_termination', (SELECT count(*) FROM runtime_instances WHERE firm_id=f.id AND phase <> 'terminated'),
                'unclaimed_dispatch_records', (SELECT count(*) FROM outbox WHERE firm_id=f.id AND NOT claimed),
                'resource_calls_without_reply', (SELECT count(*) FROM resource_calls WHERE firm_id=f.id AND reply IS NULL),
                'service_requests_without_reply', (SELECT count(*) FROM service_host_requests q WHERE q.firm_id=f.id AND NOT EXISTS(SELECT 1 FROM service_host_replies r WHERE r.firm_id=q.firm_id AND r.request_intent_id=q.intent_id)),
                'dispatched_resources_without_reply', (SELECT count(*) FROM resource_calls r WHERE r.firm_id=f.id AND r.reply IS NULL AND EXISTS (SELECT 1 FROM attempts a WHERE a.firm_id=r.firm_id AND a.intent_id=r.intent_id)),
                'unsettled_reservation_records', (SELECT count(*) FROM reservations WHERE firm_id=f.id AND NOT settled)
            ) FROM firms f WHERE f.id=$1
        "#).bind(self.firm).fetch_one(&mut *tx).await?;
        tx.commit().await?;
        Ok(result)
    }

    pub(super) async fn admission_open(&self, tx: &mut Transaction<'_, Postgres>) -> Result<()> {
        let paused: bool = sqlx::query_scalar("SELECT admission_paused FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut **tx)
            .await?;
        if paused {
            return Err(Error::Denied);
        }
        Ok(())
    }

    pub async fn set_admission(
        &self,
        actor: impl Into<Actor>,
        key: &str,
        request: AdmissionControlRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(key).map_err(|_| Error::Invalid)?;
        if request.expected_revision < 0
            || request.reason.trim().is_empty()
            || request.reason.len() > 4096
            || request.reason.contains('\0')
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &actor.into()).await?;
        self.actor_grant(
            &mut tx,
            &ctx,
            request.delegation_id,
            "environment.admission",
        )
        .await?;
        if !self
            .grant_work_roots(&mut tx, request.delegation_id)
            .await?
            .is_empty()
        {
            return Err(Error::Denied);
        }
        let input = json!(request);
        let old=sqlx::query("SELECT input,receipt FROM environment_admission_changes WHERE firm_id=$1 AND principal_id=$2 AND request_key=$3")
            .bind(self.firm).bind(ctx.principal).bind(key).fetch_optional(&mut *tx).await?;
        if let Some(old) = old {
            if old.get::<Value, _>("input") != input {
                return Err(Error::Conflict);
            }
            return Ok(old.get("receipt"));
        }
        let row = sqlx::query("SELECT revision,admission_paused FROM firms WHERE id=$1")
            .bind(self.firm)
            .fetch_one(&mut *tx)
            .await?;
        let revision: i64 = row.get("revision");
        if revision != request.expected_revision {
            return Err(Error::Conflict);
        }
        let next = revision.checked_add(1).ok_or(Error::Unavailable)?;
        let id = Uuid::new_v4();
        let receipt = json!({"id":id,"revision":next,"previous_paused":row.get::<bool,_>("admission_paused"),
            "admission_paused":request.paused,"reason":request.reason,"principal_id":ctx.principal,
            "origin_instance_id":ctx.bound.as_ref().map(|b|b.instance),"origin_generation":ctx.bound.as_ref().map(|b|b.generation),
            "drain_confirmed":false,"backup_ready":false});
        sqlx::query("UPDATE firms SET admission_paused=$2,revision=$3 WHERE id=$1")
            .bind(self.firm)
            .bind(request.paused)
            .bind(next)
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO environment_admission_changes VALUES($1,$2,$3,$4,$5,$6)")
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
            "environment.admission_changed",
            id,
            receipt.clone(),
        )
        .await?;
        tx.commit().await?;
        Ok(receipt)
    }
}
