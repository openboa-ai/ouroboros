//! Credential enrollment accepts protected bytes on a dedicated route; completion never contains them.
use super::admission::{claim, complete, gateway_peer};
use super::{App, Worker, id, reply};
use anyhow::{Context, Result, ensure};
use axum::{
    Extension, Json,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use futures_util::StreamExt;
use ouroboros_contracts::{ResourceLiveRequest, ResourceReply, ResourceTicket};
use ouroboros_transport::Peer;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use uuid::Uuid;

pub(super) fn disable_reply(
    ticket: &ouroboros_contracts::CredentialDisableTicket,
) -> ResourceReply {
    reply(
        json!({"credential_id":ticket.credential_id,"version":ticket.version,"state":"disabled"}),
        json!({"source":"credential_custody","operation":"credential.disable",
            "intent_id":ticket.intent_id,"attempt_id":ticket.original_attempt_id,
            "credential_id":ticket.credential_id,"version":ticket.version}),
    )
}

pub(super) fn enrollment_reply(
    selector: &ouroboros_contracts::EnrollmentRecoveryTicket,
) -> ResourceReply {
    // This is the immutable registration fact, not the version's later enabled/disabled state.
    reply(
        json!({"owner_id":selector.firm_id,"enrollment_id":selector.enrollment_id,
        "credential_id":selector.credential_id,"version":selector.version}),
        json!({"source":"credential_custody","enrollment_id":selector.enrollment_id,
            "credential_id":selector.credential_id,"version":selector.version,
            "intent_id":selector.intent_id,"attempt_id":selector.original_attempt_id}),
    )
}

// Raw bytes have a separate endpoint: never deserialize a credential into ResourceRequest,
// Execute, a JSON log, or a Core completion. Error responses are deliberately value-free.
async fn enrollment_secret(body: Body) -> Result<zeroize::Zeroizing<Vec<u8>>, StatusCode> {
    let mut body = body.into_data_stream();
    let mut secret = zeroize::Zeroizing::new(Vec::with_capacity(16384));
    let read = async {
        while let Some(chunk) = body.next().await {
            let chunk = chunk.map_err(|_| StatusCode::BAD_REQUEST)?;
            if secret.len().saturating_add(chunk.len()) > 16384 {
                return Err(StatusCode::PAYLOAD_TOO_LARGE);
            }
            secret.extend_from_slice(&chunk);
        }
        if secret.is_empty() {
            return Err(StatusCode::BAD_REQUEST);
        }
        Ok(())
    };
    tokio::time::timeout(Duration::from_secs(5), read)
        .await
        .map_err(|_| StatusCode::REQUEST_TIMEOUT)??;
    Ok(secret)
}

pub(super) async fn enroll_credential(
    State(a): State<Arc<App>>,
    Extension(peer): Extension<Peer>,
    Path(intent): Path<Uuid>,
    headers: HeaderMap,
    body: Body,
) -> Result<Json<ResourceReply>, StatusCode> {
    gateway_peer(&a, &peer)?;
    let Worker::Custody(store) = &a.worker else {
        return Err(StatusCode::NOT_FOUND);
    };
    if headers.get("content-type").and_then(|v| v.to_str().ok()) != Some("application/octet-stream")
        || headers.contains_key("content-encoding")
    {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    let secret = enrollment_secret(body).await?;
    let operation = async {
        let ticket = claim(&a, intent).await?;
        ensure!(
            ticket.operation == "credential.enroll" && ticket.workspace.is_none(),
            "not an enrollment claim"
        );
        let binding = ouroboros_resources::credential_envelope::Binding {
            owner: ticket.firm_id,
            credential: id(&ticket.input, "credential_id")?,
            version: ticket.input["version"]
                .as_u64()
                .context("invalid version")?,
        };
        let enrollment_id = id(&ticket.input, "enrollment_id")?;
        let current = a
            .client
            .post(format!("{}/resource/live/{intent}", a.core))
            .json(&ResourceLiveRequest {
                attempt_id: ticket.attempt_id,
                storage: None,
            })
            .send()
            .await?;
        ensure!(
            current.status() == StatusCode::NO_CONTENT,
            "enrollment no longer authorized"
        );
        store
            .enroll_admitted(binding, enrollment_id, (intent, ticket.attempt_id), secret)
            .await?;
        let selector = ouroboros_contracts::EnrollmentRecoveryTicket {
            firm_id: ticket.firm_id,
            intent_id: intent,
            original_attempt_id: ticket.attempt_id,
            enrollment_id,
            credential_id: binding.credential,
            version: binding.version,
        };
        let response = enrollment_reply(&selector);
        complete(&a, intent, &response).await?;
        Ok::<_, anyhow::Error>(response)
    };
    tokio::time::timeout(Duration::from_secs(10), operation)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
        .map(Json)
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}

pub(super) async fn disable(
    a: &App,
    store: &ouroboros_resources::credential_store::CredentialStore,
    intent: Uuid,
    t: &ResourceTicket,
) -> Result<ResourceReply> {
    let input = &t.input;
    let ticket = ouroboros_contracts::CredentialDisableTicket {
        firm_id: t.firm_id,
        intent_id: intent,
        original_attempt_id: t.attempt_id,
        credential_id: id(input, "credential_id")?,
        version: input["version"].as_u64().context("version required")?,
    };
    let current = a
        .client
        .post(format!("{}/resource/live/{intent}", a.core))
        .json(&ResourceLiveRequest {
            attempt_id: t.attempt_id,
            storage: None,
        })
        .send()
        .await?;
    ensure!(
        current.status() == StatusCode::NO_CONTENT,
        "disable no longer authorized"
    );
    store.disable_admitted(&ticket).await?;
    Ok(disable_reply(&ticket))
}
