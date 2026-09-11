//! Ciphertext persistence for a dedicated custody database. No client authorization API.
use crate::credential_envelope::{Binding, CustodyError, EnvelopeKey};
use sqlx::{PgPool, Row};
use zeroize::Zeroizing;

/// Management observation contains identity and status only, never ciphertext or secret hashes.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct EnrollmentReceipt {
    pub owner_id: uuid::Uuid,
    pub enrollment_id: uuid::Uuid,
    pub credential_id: uuid::Uuid,
    pub version: u64,
    pub disabled: bool,
}

pub struct CredentialStore {
    pool: PgPool,
    key: EnvelopeKey,
    management: bool,
}
impl CredentialStore {
    pub async fn new(pool: PgPool, key: EnvelopeKey) -> Result<Self, CustodyError> {
        Self::open(pool, key, true).await
    }
    /// Production senders can read/use existing versions, never enroll or disable them.
    pub async fn open_consumer(pool: PgPool, key: EnvelopeKey) -> Result<Self, CustodyError> {
        Self::open(pool, key, false).await
    }
    async fn open(pool: PgPool, key: EnvelopeKey, management: bool) -> Result<Self, CustodyError> {
        let safe: bool = sqlx::query_scalar(
            "SELECT NOT (r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls)
             AND NOT pg_has_role(current_user,c.relowner,'MEMBER')
             AND NOT has_schema_privilege(current_user,n.oid,'CREATE')
             AND NOT has_table_privilege(current_user,c.oid,'DELETE')
             AND NOT has_table_privilege(current_user,c.oid,'TRUNCATE')
             AND NOT has_column_privilege(current_user,c.oid,'envelope','UPDATE')
             AND NOT has_column_privilege(current_user,c.oid,'owner_id','UPDATE')
             AND NOT has_column_privilege(current_user,c.oid,'credential_id','UPDATE')
             AND NOT has_column_privilege(current_user,c.oid,'version','UPDATE')
             AND NOT has_column_privilege(current_user,c.oid,'created_at','UPDATE')
             AND NOT has_table_privilege(current_user,'credential_use_claims','UPDATE')
             AND NOT has_table_privilege(current_user,'credential_use_claims','DELETE')
             AND NOT has_table_privilege(current_user,'credential_use_claims','TRUNCATE')
             AND NOT has_table_privilege(current_user,'provider_receipts','UPDATE')
             AND NOT has_table_privilege(current_user,'provider_receipts','DELETE')
             AND NOT has_table_privilege(current_user,'provider_receipts','TRUNCATE')
             AND has_table_privilege(current_user,'provider_receipts','SELECT')
             AND has_column_privilege(current_user,'provider_receipts','reply','INSERT')
             AND has_table_privilege(current_user,'credential_use_claims','SELECT')
             AND has_column_privilege(current_user,'credential_use_claims','attempt_id','INSERT')
             AND has_table_privilege(current_user,c.oid,'SELECT')
             AND has_function_privilege(current_user,'public.lock_credential_version(uuid,uuid,bigint)','EXECUTE')
             AND NOT has_any_column_privilege(current_user,'credential_enrollments','UPDATE')
             AND NOT has_table_privilege(current_user,'credential_enrollments','DELETE,TRUNCATE')
             AND NOT has_any_column_privilege(current_user,'credential_disables','UPDATE')
             AND NOT has_table_privilege(current_user,'credential_disables','DELETE,TRUNCATE')
             AND CASE WHEN $1 THEN
                 has_table_privilege(current_user,'credential_disables','SELECT')
                 AND has_table_privilege(current_user,'credential_disables','INSERT') AND
                 has_table_privilege(current_user,'credential_enrollments','SELECT')
                 AND has_column_privilege(current_user,'credential_enrollments','enrollment_id','INSERT')
                 AND has_column_privilege(current_user,c.oid,'envelope','INSERT')
                 AND has_column_privilege(current_user,c.oid,'disabled','UPDATE')
                 AND has_column_privilege(current_user,c.oid,'disabled_at','UPDATE')
             ELSE NOT has_any_column_privilege(current_user,'credential_disables','INSERT')
                 AND NOT has_any_column_privilege(current_user,'credential_enrollments','INSERT')
                 AND NOT has_any_column_privilege(current_user,c.oid,'INSERT')
                 AND NOT has_any_column_privilege(current_user,c.oid,'UPDATE') END
             FROM pg_roles r, pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE r.rolname=current_user AND c.oid='credential_versions'::regclass",
        )
        .bind(management)
        .fetch_one(&pool)
        .await
        .map_err(|_| CustodyError)?;
        if !safe {
            return Err(CustodyError);
        }
        Ok(Self {
            pool,
            key,
            management,
        })
    }
    /// Explicit deployment migration, using a different credential from the operating worker.
    pub async fn migrate(pool: &PgPool) -> Result<(), CustodyError> {
        sqlx::migrate!("./migrations/custody")
            .run(pool)
            .await
            .map_err(|_| CustodyError)?;
        Ok(())
    }
    /// Inserts one immutable version. Duplicate identity never overwrites or re-enables it.
    /// An uncertain commit requires metadata reconciliation, not a new version by default.
    pub async fn insert(
        &self,
        binding: Binding,
        secret: Zeroizing<Vec<u8>>,
    ) -> Result<(), CustodyError> {
        if !self.management {
            return Err(CustodyError);
        }
        let version = i64::try_from(binding.version).map_err(|_| CustodyError)?;
        let envelope = self.key.seal(binding, secret)?;
        sqlx::query("INSERT INTO credential_versions(owner_id,credential_id,version,envelope) VALUES($1,$2,$3,$4)")
            .bind(binding.owner).bind(binding.credential).bind(version).bind(envelope)
            .execute(&self.pool).await.map_err(|_| CustodyError)?;
        Ok(())
    }
    /// Register an encrypted version and a durable management receipt in one transaction.
    /// Any duplicate returns an error: observation, not resubmission with a new ID, resolves
    /// lost acknowledgements. This never accepts a changed secret as an idempotent replay.
    pub async fn enroll(
        &self,
        binding: Binding,
        enrollment_id: uuid::Uuid,
        secret: Zeroizing<Vec<u8>>,
    ) -> Result<EnrollmentReceipt, CustodyError> {
        tokio::time::timeout(
            std::time::Duration::from_secs(5),
            self.enroll_inner(binding, enrollment_id, None, secret),
        )
        .await
        .map_err(|_| CustodyError)?
    }
    /// The admitted effect and receipt share the original Core intent/attempt identity.
    pub async fn enroll_admitted(
        &self,
        binding: Binding,
        enrollment_id: uuid::Uuid,
        dispatch: (uuid::Uuid, uuid::Uuid),
        secret: Zeroizing<Vec<u8>>,
    ) -> Result<EnrollmentReceipt, CustodyError> {
        if dispatch.0.is_nil() || dispatch.1.is_nil() {
            return Err(CustodyError);
        }
        tokio::time::timeout(
            std::time::Duration::from_secs(5),
            self.enroll_inner(binding, enrollment_id, Some(dispatch), secret),
        )
        .await
        .map_err(|_| CustodyError)?
    }
    /// Receipt-only observation. Missing evidence neither starts nor retries enrollment.
    pub async fn enrollment_observed(
        &self,
        selector: &ouroboros_contracts::EnrollmentRecoveryTicket,
    ) -> Result<bool, CustodyError> {
        if !self.management {
            return Err(CustodyError);
        }
        let version = i64::try_from(selector.version).map_err(|_| CustodyError)?;
        tokio::time::timeout(std::time::Duration::from_secs(2),
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM credential_enrollments WHERE owner_id=$1 AND enrollment_id=$2 AND credential_id=$3 AND version=$4 AND intent_id=$5 AND attempt_id=$6)")
            .bind(selector.firm_id).bind(selector.enrollment_id).bind(selector.credential_id)
            .bind(version).bind(selector.intent_id).bind(selector.original_attempt_id).fetch_one(&self.pool))
            .await.map_err(|_|CustodyError)?.map_err(|_|CustodyError)
    }
    async fn enroll_inner(
        &self,
        binding: Binding,
        enrollment_id: uuid::Uuid,
        dispatch: Option<(uuid::Uuid, uuid::Uuid)>,
        secret: Zeroizing<Vec<u8>>,
    ) -> Result<EnrollmentReceipt, CustodyError> {
        if !self.management || enrollment_id.is_nil() {
            return Err(CustodyError);
        }
        let version = i64::try_from(binding.version).map_err(|_| CustodyError)?;
        let envelope = self.key.seal(binding, secret)?;
        let mut tx = self.pool.begin().await.map_err(|_| CustodyError)?;
        sqlx::query("INSERT INTO credential_versions(owner_id,credential_id,version,envelope) VALUES($1,$2,$3,$4)")
            .bind(binding.owner).bind(binding.credential).bind(version).bind(envelope).execute(&mut *tx).await.map_err(|_|CustodyError)?;
        sqlx::query("INSERT INTO credential_enrollments(owner_id,enrollment_id,credential_id,version,intent_id,attempt_id) VALUES($1,$2,$3,$4,$5,$6)")
            .bind(binding.owner).bind(enrollment_id).bind(binding.credential).bind(version).bind(dispatch.map(|d|d.0)).bind(dispatch.map(|d|d.1)).execute(&mut *tx).await.map_err(|_|CustodyError)?;
        tx.commit().await.map_err(|_| CustodyError)?;
        Ok(EnrollmentReceipt {
            owner_id: binding.owner,
            enrollment_id,
            credential_id: binding.credential,
            version: binding.version,
            disabled: false,
        })
    }
    /// Requires trusted management authorization before invocation. It grants no use rights.
    pub async fn enrollment(
        &self,
        owner: uuid::Uuid,
        enrollment: uuid::Uuid,
    ) -> Result<Option<EnrollmentReceipt>, CustodyError> {
        if !self.management || owner.is_nil() || enrollment.is_nil() {
            return Err(CustodyError);
        }
        let row=sqlx::query("SELECT e.credential_id,e.version,v.disabled FROM credential_enrollments e JOIN credential_versions v USING(owner_id,credential_id,version) WHERE e.owner_id=$1 AND e.enrollment_id=$2")
            .bind(owner).bind(enrollment).fetch_optional(&self.pool).await.map_err(|_|CustodyError)?;
        row.map(|r| {
            Ok(EnrollmentReceipt {
                owner_id: owner,
                enrollment_id: enrollment,
                credential_id: r.get("credential_id"),
                version: u64::try_from(r.get::<i64, _>("version")).map_err(|_| CustodyError)?,
                disabled: r.get("disabled"),
            })
        })
        .transpose()
    }

    /// Commit an irreversible disabled state and the exact dispatch receipt together.
    /// Existing shared use locks must finish first; timeout leaves the result unresolved.
    pub async fn disable_admitted(
        &self,
        ticket: &ouroboros_contracts::CredentialDisableTicket,
    ) -> Result<(), CustodyError> {
        if !self.management
            || ticket.firm_id.is_nil()
            || ticket.intent_id.is_nil()
            || ticket.original_attempt_id.is_nil()
            || ticket.credential_id.is_nil()
            || ticket.version == 0
        {
            return Err(CustodyError);
        }
        let version = i64::try_from(ticket.version).map_err(|_| CustodyError)?;
        let operation = async {
            let mut tx = self.pool.begin().await.map_err(|_| CustodyError)?;
            let updated=sqlx::query("UPDATE credential_versions SET disabled=true,disabled_at=COALESCE(disabled_at,clock_timestamp()) WHERE owner_id=$1 AND credential_id=$2 AND version=$3")
                .bind(ticket.firm_id).bind(ticket.credential_id).bind(version).execute(&mut *tx).await.map_err(|_|CustodyError)?;
            if updated.rows_affected() != 1 {
                return Err(CustodyError);
            }
            sqlx::query("INSERT INTO credential_disables(owner_id,intent_id,attempt_id,credential_id,version) VALUES($1,$2,$3,$4,$5)")
                .bind(ticket.firm_id).bind(ticket.intent_id).bind(ticket.original_attempt_id)
                .bind(ticket.credential_id).bind(version).execute(&mut *tx).await.map_err(|_|CustodyError)?;
            tx.commit().await.map_err(|_| CustodyError)
        };
        tokio::time::timeout(std::time::Duration::from_secs(5), operation)
            .await
            .map_err(|_| CustodyError)?
    }
    pub async fn disable_observed(
        &self,
        ticket: &ouroboros_contracts::CredentialDisableTicket,
    ) -> Result<bool, CustodyError> {
        if !self.management {
            return Err(CustodyError);
        }
        let version = i64::try_from(ticket.version).map_err(|_| CustodyError)?;
        tokio::time::timeout(std::time::Duration::from_secs(2),
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM credential_disables WHERE owner_id=$1 AND intent_id=$2 AND attempt_id=$3 AND credential_id=$4 AND version=$5)")
            .bind(ticket.firm_id).bind(ticket.intent_id).bind(ticket.original_attempt_id)
            .bind(ticket.credential_id).bind(version).fetch_one(&self.pool))
            .await.map_err(|_|CustodyError)?.map_err(|_|CustodyError)
    }

    /// Irreversible for this version through this interface. Does not cancel prior effects.
    pub async fn disable(&self, binding: Binding) -> Result<(), CustodyError> {
        if !self.management {
            return Err(CustodyError);
        }
        let version = i64::try_from(binding.version).map_err(|_| CustodyError)?;
        let result=sqlx::query("UPDATE credential_versions SET disabled=true, disabled_at=COALESCE(disabled_at,clock_timestamp()) WHERE owner_id=$1 AND credential_id=$2 AND version=$3")
            .bind(binding.owner).bind(binding.credential).bind(version).execute(&self.pool).await.map_err(|_| CustodyError)?;
        if result.rows_affected() != 1 {
            return Err(CustodyError);
        }
        Ok(())
    }
    /// Bounded trusted asynchronous use. It is not an authorization API. The supplied
    /// operation must recheck Core dispatch authority and may not spawn detached secret users.
    /// Once invoked, timeout/error/commit loss is conservatively an unresolved external outcome.
    pub async fn consume_async<T, F>(
        &self,
        binding: Binding,
        attempt: uuid::Uuid,
        budget: std::time::Duration,
        operation: impl FnOnce(Zeroizing<Vec<u8>>) -> F,
    ) -> Result<T, UseError>
    where
        F: std::future::Future<Output = Result<T, CustodyError>>,
    {
        if attempt.is_nil() || budget.is_zero() || budget > std::time::Duration::from_secs(30) {
            return Err(UseError::NotStarted);
        }
        // The authoritative caller supplies its existing attempt ID. A committed claim is
        // never cleared on timeout or restart, even if the callback did not run.
        let version = i64::try_from(binding.version).map_err(|_| UseError::NotStarted)?;
        let deadline = tokio::time::Instant::now() + budget;
        let claim=tokio::time::timeout_at(deadline,sqlx::query(
            "INSERT INTO credential_use_claims(owner_id,attempt_id,credential_id,version) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,attempt_id) DO NOTHING"
        ).bind(binding.owner).bind(attempt).bind(binding.credential).bind(version).execute(&self.pool)).await;
        match claim {
            Ok(Ok(result)) if result.rows_affected() == 1 => {}
            Ok(Ok(_)) => return Err(UseError::AlreadyClaimed),
            _ => return Err(UseError::OutcomeUnresolved),
        }
        let mut started = false;
        let outcome = tokio::time::timeout_at(deadline, async {
            let version = i64::try_from(binding.version).map_err(|_| CustodyError)?;
            let mut tx = self.pool.begin().await.map_err(|_| CustodyError)?;
            let envelope: Option<Vec<u8>> =
                sqlx::query_scalar("SELECT public.lock_credential_version($1,$2,$3)")
                    .bind(binding.owner)
                    .bind(binding.credential)
                    .bind(version)
                    .fetch_one(&mut *tx)
                    .await
                    .map_err(|_| CustodyError)?;
            let secret = self
                .key
                .consume(binding, &envelope.ok_or(CustodyError)?, |value| {
                    Ok(Zeroizing::new(value.to_vec()))
                })?;
            started = true;
            let result = operation(secret).await?;
            tx.commit().await.map_err(|_| CustodyError)?;
            Ok::<T, CustodyError>(result)
        })
        .await;
        match outcome {
            Ok(Ok(value)) => Ok(value),
            _ if started => Err(UseError::OutcomeUnresolved),
            _ => Err(UseError::NotStarted),
        }
    }

    pub(crate) async fn save_provider_reply(
        &self,
        ticket: &ouroboros_contracts::ResourceTicket,
        reply: &ouroboros_contracts::ResourceReply,
    ) -> Result<(), CustodyError> {
        let digest = ticket_digest(ticket)?;
        let value = serde_json::to_value(reply).map_err(|_| CustodyError)?;
        let bytes = serde_json::to_vec(&value).map_err(|_| CustodyError)?;
        if bytes.len() > 16777216 {
            return Err(CustodyError);
        }
        tokio::time::timeout(std::time::Duration::from_secs(2),sqlx::query(
            "INSERT INTO provider_receipts(owner_id,attempt_id,ticket_sha256,reply) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,attempt_id) DO NOTHING"
        ).bind(ticket.firm_id).bind(ticket.attempt_id).bind(digest).bind(&value).execute(&self.pool)).await.map_err(|_|CustodyError)?.map_err(|_|CustodyError)?;
        let stored = self.provider_reply(ticket).await?.ok_or(CustodyError)?;
        if serde_json::to_value(stored).map_err(|_| CustodyError)? != value {
            return Err(CustodyError);
        }
        Ok(())
    }
    pub(crate) async fn provider_reply(
        &self,
        ticket: &ouroboros_contracts::ResourceTicket,
    ) -> Result<Option<ouroboros_contracts::ResourceReply>, CustodyError> {
        let selector = ticket
            .provider_recovery_selector()
            .map_err(|_| CustodyError)?;
        self.provider_observation(&selector).await
    }
    pub(crate) async fn provider_observation(
        &self,
        ticket: &ouroboros_contracts::ProviderRecoveryTicket,
    ) -> Result<Option<ouroboros_contracts::ResourceReply>, CustodyError> {
        let row=tokio::time::timeout(std::time::Duration::from_secs(2),sqlx::query("SELECT ticket_sha256,reply FROM provider_receipts WHERE owner_id=$1 AND attempt_id=$2")
            .bind(ticket.firm_id).bind(ticket.original_attempt_id).fetch_optional(&self.pool)).await.map_err(|_|CustodyError)?.map_err(|_|CustodyError)?;
        let Some(row) = row else { return Ok(None) };
        if row.get::<String, _>("ticket_sha256") != ticket.ticket_sha256 {
            return Err(CustodyError);
        }
        serde_json::from_value(row.get("reply"))
            .map(Some)
            .map_err(|_| CustodyError)
    }

    /// Retained claim existence is evidence of possible dispatch, never a success receipt.
    pub async fn has_use_claim(
        &self,
        owner: uuid::Uuid,
        attempt: uuid::Uuid,
    ) -> Result<bool, CustodyError> {
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM credential_use_claims WHERE owner_id=$1 AND attempt_id=$2)")
            .bind(owner).bind(attempt).fetch_one(&self.pool).await.map_err(|_|CustodyError)
    }

    /// A trusted synchronous consumer runs under the version's shared row lock. Disable waits
    /// for existing consumers; after disable commits, subsequent consumers cannot run.
    /// This is not Core admission and not a lock held across future asynchronous HTTP dispatch.
    pub async fn consume<T>(
        &self,
        binding: Binding,
        operation: impl FnOnce(&[u8]) -> Result<T, CustodyError>,
    ) -> Result<T, CustodyError> {
        let version = i64::try_from(binding.version).map_err(|_| CustodyError)?;
        let mut tx = self.pool.begin().await.map_err(|_| CustodyError)?;
        let envelope: Option<Vec<u8>> =
            sqlx::query_scalar("SELECT public.lock_credential_version($1,$2,$3)")
                .bind(binding.owner)
                .bind(binding.credential)
                .bind(version)
                .fetch_one(&mut *tx)
                .await
                .map_err(|_| CustodyError)?;
        let result = self
            .key
            .consume(binding, &envelope.ok_or(CustodyError)?, operation)?;
        tx.commit().await.map_err(|_| CustodyError)?;
        Ok(result)
    }
}

/// No secret-bearing upstream errors or retry directive is returned.
#[derive(Debug, PartialEq, Eq)]
pub enum UseError {
    AlreadyClaimed,
    NotStarted,
    OutcomeUnresolved,
}

fn ticket_digest(ticket: &ouroboros_contracts::ResourceTicket) -> Result<String, CustodyError> {
    Ok(ticket
        .provider_recovery_selector()
        .map_err(|_| CustodyError)?
        .ticket_sha256)
}
