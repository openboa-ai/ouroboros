use super::*;
use ouroboros_contracts::{ReceiptRecoveryTicket, ReceiptSelector, StorageClaim};

fn identity(value: &Value) -> Result<Uuid> {
    value
        .as_str()
        .and_then(|v| Uuid::parse_str(v).ok())
        .ok_or(Error::Unavailable)
}

impl Core {
    /// Reconstruct an observation selector from retained admission and the sole original
    /// attempt. This deliberately does not require the old execution grant to remain live.
    /// Only the original authenticated worker can obtain it; Gateway checks current readers.
    pub async fn provider_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
    ) -> Result<ouroboros_contracts::ProviderRecoveryTicket> {
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT r.work_id,r.target_id,r.operation,r.configuration,i.input,i.state FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3")
            .bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let state: String = row.get("state");
        if row.get::<String, _>("operation") != "model.responses"
            || !matches!(state.as_str(), "claimed" | "succeeded")
        {
            return Err(Error::Denied);
        }
        let attempts = sqlx::query(
            "SELECT id,worker_id,state FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_all(&mut *tx)
        .await?;
        if attempts.len() != 1
            || attempts[0].get::<String, _>("worker_id") != worker
            || attempts[0].get::<String, _>("state") != state
        {
            return Err(Error::Denied);
        }
        let ticket = ouroboros_contracts::ResourceTicket {
            firm_id: self.firm,
            intent_id: intent,
            attempt_id: attempts[0].get("id"),
            work_id: row.get("work_id"),
            target: row.get("target_id"),
            operation: row.get("operation"),
            input: row.get::<Value, _>("input")["input"].clone(),
            configuration: row.get("configuration"),
            workspace: None,
        };
        let selector = ticket
            .provider_recovery_selector()
            .map_err(|_| Error::Unavailable)?;
        tx.commit().await?;
        Ok(selector)
    }

    pub async fn credential_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
    ) -> Result<ouroboros_contracts::CredentialRecoveryTicket> {
        let operation:Option<String>=sqlx::query_scalar("SELECT operation FROM resource_calls WHERE firm_id=$1 AND intent_id=$2 AND worker_id=$3")
            .bind(self.firm).bind(intent).bind(worker).fetch_optional(&self.pool).await?;
        use ouroboros_contracts::CredentialRecoveryTicket;
        match operation.as_deref() {
            Some("credential.enroll") => Ok(CredentialRecoveryTicket::Enrollment(
                self.enrollment_receipt_recovery(intent, worker).await?,
            )),
            Some("credential.disable") => Ok(CredentialRecoveryTicket::Disable(
                self.disable_receipt_recovery(intent, worker).await?,
            )),
            _ => Err(Error::Denied),
        }
    }

    /// Original dispatch only, even after revocation; never authorization to register again.
    pub async fn enrollment_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
    ) -> Result<ouroboros_contracts::EnrollmentRecoveryTicket> {
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT i.input,i.state FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3 AND r.operation='credential.enroll'")
            .bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let state: String = row.get("state");
        if !matches!(state.as_str(), "claimed" | "succeeded") {
            return Err(Error::Denied);
        }
        let attempts = sqlx::query(
            "SELECT id,worker_id,state FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_all(&mut *tx)
        .await?;
        if attempts.len() != 1
            || attempts[0].get::<String, _>("worker_id") != worker
            || attempts[0].get::<String, _>("state") != state
        {
            return Err(Error::Denied);
        }
        let input: Value = row.get("input");
        let input = &input["input"];
        let selector = ouroboros_contracts::EnrollmentRecoveryTicket {
            firm_id: self.firm,
            intent_id: intent,
            original_attempt_id: attempts[0].get("id"),
            enrollment_id: identity(&input["enrollment_id"])?,
            credential_id: identity(&input["credential_id"])?,
            version: input["version"].as_u64().ok_or(Error::Unavailable)?,
        };
        tx.commit().await?;
        Ok(selector)
    }

    /// Original dispatch only, even after revocation; never authorization to register again.
    pub async fn disable_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
    ) -> Result<ouroboros_contracts::CredentialDisableTicket> {
        let mut tx = self.fence().await?;
        let row=sqlx::query("SELECT i.input,i.state FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3 AND r.operation='credential.disable'")
            .bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let state: String = row.get("state");
        if !matches!(state.as_str(), "claimed" | "succeeded") {
            return Err(Error::Denied);
        }
        let attempts = sqlx::query(
            "SELECT id,worker_id,state FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_all(&mut *tx)
        .await?;
        if attempts.len() != 1
            || attempts[0].get::<String, _>("worker_id") != worker
            || attempts[0].get::<String, _>("state") != state
        {
            return Err(Error::Denied);
        }
        let input: Value = row.get("input");
        let input = &input["input"];
        let selector = ouroboros_contracts::CredentialDisableTicket {
            firm_id: self.firm,
            intent_id: intent,
            original_attempt_id: attempts[0].get("id"),
            credential_id: identity(&input["credential_id"])?,
            version: input["version"].as_u64().ok_or(Error::Unavailable)?,
        };
        tx.commit().await?;
        Ok(selector)
    }

    /// Observe an existing storage obligation using its original authenticated worker.
    /// Revocation blocks new effects, not evidence of an effect that was already dispatched.
    /// This method creates no attempt, reservation, outbox entry, or replacement authority.
    pub async fn resource_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
        storage: &StorageClaim,
    ) -> Result<ReceiptRecoveryTicket> {
        let mut tx = self.fence().await?;
        let row = sqlx::query(
            "SELECT r.operation,r.configuration,r.work_id,r.target_id,i.input,i.state FROM resource_calls r \
             JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) \
             WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3",
        )
        .bind(self.firm)
        .bind(intent)
        .bind(worker)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(Error::Denied)?;
        let state: String = row.get("state");
        if !matches!(state.as_str(), "claimed" | "succeeded") {
            return Err(Error::Denied);
        }
        let operation: String = row.get("operation");
        if !matches!(
            operation.as_str(),
            "workspace.create" | "file.upload" | "file.publish" | "file.retire" | "file.collect"
        ) {
            return Err(Error::Denied);
        }
        let configuration: Value = row.get("configuration");
        if storage.firm_id != self.firm
            || identity(&configuration["store_id"])? != storage.store_id
            || identity(&configuration["storage_generation"])? != storage.generation
        {
            return Err(Error::Denied);
        }
        // A future retry implementation must not silently make this observation ambiguous.
        let attempts = sqlx::query(
            "SELECT id,worker_id,state FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_all(&mut *tx)
        .await?;
        if attempts.len() != 1
            || attempts[0].get::<String, _>("worker_id") != worker
            || attempts[0].get::<String, _>("state") != state
        {
            return Err(Error::Denied);
        }
        let input: Value = row.get("input");
        let input = &input["input"];
        let binding = self
            .workspace_binding(
                &mut tx,
                intent,
                row.get("work_id"),
                &row.get::<String, _>("target_id"),
                &operation,
                input,
                &configuration,
                false,
            )
            .await?;
        let selector = match operation.as_str() {
            "file.collect" => {
                let (binding, policy, namespace_id) =
                    self.collection_context(&mut tx, intent).await?;
                ReceiptSelector::Collection {
                    work_id: row.get("work_id"),
                    namespace_id,
                    request: serde_json::from_value(input.clone())
                        .map_err(|_| Error::Unavailable)?,
                    binding,
                    policy,
                }
            }
            "file.retire" => ReceiptSelector::Retirement {
                work_id: row.get("work_id"),
                namespace_id: super::workspaces::namespace(&configuration)?.ok_or(Error::Denied)?,
                request: serde_json::from_value(input.clone()).map_err(|_| Error::Unavailable)?,
                policy: super::retirement::policy(&configuration)?,
            },
            "workspace.create" => {
                let binding = binding.ok_or(Error::Denied)?;
                ReceiptSelector::WorkspaceCreation {
                    workspace_id: binding.workspace_id,
                    namespace_id: binding.namespace_id,
                    work_id: row.get("work_id"),
                    label: input["label"].as_str().ok_or(Error::Unavailable)?.into(),
                }
            }
            "file.upload" => ReceiptSelector::Upload {
                sha256: input["sha256"].as_str().ok_or(Error::Unavailable)?.into(),
                size: input["size"].as_u64().ok_or(Error::Unavailable)?,
            },
            "file.publish" => {
                let workspace_id = match binding {
                    Some(binding) => binding.workspace_id,
                    None => identity(&configuration["workspace_id"])?,
                };
                if identity(&input["workspace_id"])? != workspace_id {
                    return Err(Error::Denied);
                }
                ReceiptSelector::Publication {
                    workspace_id,
                    expected_revision: input["expected_revision"]
                        .as_i64()
                        .ok_or(Error::Unavailable)?,
                    files: serde_json::from_value(input["files"].clone())
                        .map_err(|_| Error::Unavailable)?,
                }
            }
            _ => return Err(Error::Denied),
        };
        let ticket = ReceiptRecoveryTicket {
            firm_id: self.firm,
            intent_id: intent,
            original_attempt_id: attempts[0].get("id"),
            storage: storage.clone(),
            selector,
        };
        tx.commit().await?;
        Ok(ticket)
    }
}

impl Core {
    pub async fn company_receipt_recovery(
        &self,
        intent: Uuid,
        worker: &str,
    ) -> Result<ouroboros_contracts::CompanyRecoveryTicket> {
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT i.input,i.state FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.worker_id=$3 AND r.operation='db.write'")
            .bind(self.firm).bind(intent).bind(worker).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let state: String = row.get("state");
        if !matches!(state.as_str(), "claimed" | "succeeded") {
            return Err(Error::Denied);
        }
        let attempts = sqlx::query(
            "SELECT id,worker_id,state FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(intent)
        .fetch_all(&mut *tx)
        .await?;
        if attempts.len() != 1
            || attempts[0].get::<String, _>("worker_id") != worker
            || attempts[0].get::<String, _>("state") != state
        {
            return Err(Error::Denied);
        }
        let input: Value = row.get("input");
        if input["input"]["operation"] != "record_result" {
            return Err(Error::Denied);
        }
        let ticket = ouroboros_contracts::CompanyRecoveryTicket {
            firm_id: self.firm,
            intent_id: intent,
            original_attempt_id: attempts[0].get("id"),
            parameters: input["input"]["parameters"].clone(),
        };
        tx.commit().await?;
        Ok(ticket)
    }
}
