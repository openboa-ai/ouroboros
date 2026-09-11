//! Receipt-only recovery. Missing evidence is unresolved, never permission to replay an effect.
use super::admission::{complete, gateway_peer};
use super::catalog::{
    catalog_io, collection_reply, retirement_reply, upload_reply, validate_collection_policy,
    validate_retirement_policy, workspace_reply,
};
use super::custody::{disable_reply, enrollment_reply};
use super::{App, Worker, reply};
use anyhow::{Context, Result, ensure};
use axum::{
    Extension, Json,
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use ouroboros_contracts::{ReceiptRecoveryTicket, ReceiptSelector, ResourceReply};
use ouroboros_transport::Peer;
use serde_json::json;
use std::{sync::Arc, time::Duration};
use uuid::Uuid;

pub(super) async fn reconcile(
    State(a): State<Arc<App>>,
    Extension(peer): Extension<Peer>,
    Path(intent): Path<Uuid>,
    body: Bytes,
) -> Result<Response, StatusCode> {
    gateway_peer(&a, &peer)?;
    if !body.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    match reconcile_inner(&a, intent)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
    {
        Some(result) => Ok(Json(result).into_response()),
        None => Ok((
            StatusCode::ACCEPTED,
            Json(json!({"intent_id":intent,"state":"unresolved","observation":"receipt_absent"})),
        )
            .into_response()),
    }
}
async fn reconcile_inner(a: &App, intent: Uuid) -> Result<Option<ResourceReply>> {
    if let Worker::Company(worker) = &a.worker {
        let ticket: ouroboros_contracts::CompanyRecoveryTicket = a
            .client
            .post(format!("{}/resource/company-recovery/{intent}", a.core))
            .header(reqwest::header::CONTENT_LENGTH, "0")
            .body(Vec::new())
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        ensure!(
            ticket.intent_id == intent && !ticket.original_attempt_id.is_nil(),
            "company observation binding mismatch"
        );
        let Some(result) = worker.observe_result(&ticket).await? else {
            return Ok(None);
        };
        let response = reply(
            json!({"intent_id":intent,"result_id":result}),
            json!({"source":"company_db","effect_receipt":intent,"result_id":result}),
        );
        complete(a, intent, &response).await?;
        return Ok(Some(response));
    }
    if let Worker::Custody(store) = &a.worker {
        let operation = async {
            let selector: ouroboros_contracts::CredentialRecoveryTicket = a
                .client
                .post(format!("{}/resource/credential-recovery/{intent}", a.core))
                .send()
                .await?
                .error_for_status()?
                .json()
                .await?;
            let response = match selector {
                ouroboros_contracts::CredentialRecoveryTicket::Enrollment(selector) => {
                    ensure!(
                        selector.intent_id == intent,
                        "enrollment observation mismatch"
                    );
                    if !store.enrollment_observed(&selector).await? {
                        return Ok(None);
                    }
                    enrollment_reply(&selector)
                }
                ouroboros_contracts::CredentialRecoveryTicket::Disable(selector) => {
                    ensure!(selector.intent_id == intent, "disable observation mismatch");
                    if !store.disable_observed(&selector).await? {
                        return Ok(None);
                    }
                    disable_reply(&selector)
                }
            };
            complete(a, intent, &response).await?;
            Ok::<_, anyhow::Error>(Some(response))
        };
        return tokio::time::timeout(Duration::from_secs(5), operation)
            .await
            .context("enrollment observation unavailable")?;
    }
    if let Worker::Provider(worker) = &a.worker {
        let selector: ouroboros_contracts::ProviderRecoveryTicket = a
            .client
            .post(format!("{}/resource/provider-recovery/{intent}", a.core))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        ensure!(
            selector.intent_id == intent,
            "provider observation binding mismatch"
        );
        let result = worker.observe(&selector).await?;
        if let Some(ref reply) = result {
            complete(a, intent, reply).await?;
        }
        return Ok(result);
    }
    let Worker::Catalog(worker) = &a.worker else {
        anyhow::bail!("only catalog receipts support observation recovery");
    };
    let storage = worker.preflight().await?;
    let ticket: ReceiptRecoveryTicket = a
        .client
        .post(format!("{}/resource/receipt-recovery/{intent}", a.core))
        .json(&storage)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    ensure!(
        ticket.intent_id == intent
            && ticket.firm_id == storage.firm_id
            && ticket.storage.firm_id == storage.firm_id
            && ticket.storage.store_id == storage.store_id
            && ticket.storage.generation == storage.generation,
        "receipt observation binding mismatch"
    );
    worker.validate_target(storage.firm_id, storage.store_id, storage.generation)?;
    // These APIs only inspect committed effect metadata. Historical receipt recovery does not
    // assert that retired content remains available and cannot release another reference,
    // rerun an upload/publication or finish an abandoned staging row.
    let result = match ticket.selector {
        ReceiptSelector::Collection {
            work_id,
            namespace_id,
            request,
            binding,
            policy,
        } => {
            validate_collection_policy(&request, &policy)?;
            ensure!(
                binding.store_id == storage.store_id && binding.generation == storage.generation,
                "collection observation storage mismatch"
            );
            let worker = worker.clone();
            let firm = ticket.firm_id;
            catalog_io(async move {
                worker
                    .collection_receipt(
                        firm,
                        intent,
                        work_id,
                        namespace_id,
                        &request,
                        &binding,
                        &policy,
                    )
                    .await
            })
            .await?
            .map(|record| collection_reply(intent, &record))
        }
        ReceiptSelector::Retirement {
            work_id,
            namespace_id,
            request,
            policy,
        } => {
            validate_retirement_policy(&request, &policy)?;
            worker
                .retirement_receipt(
                    ticket.firm_id,
                    intent,
                    work_id,
                    namespace_id,
                    &request,
                    &policy,
                )
                .await?
                .map(|record| retirement_reply(intent, &record))
        }
        ReceiptSelector::Upload { sha256, size } => worker
            .upload_reference(ticket.firm_id, intent, &sha256, size)
            .await?
            // The reference supplies object identity only when the committed receipt owns it.
            .map(|blob| upload_reply(intent, &blob)),
        ReceiptSelector::WorkspaceCreation {
            workspace_id,
            namespace_id,
            work_id,
            label,
        } => worker
            .workspace_creation_receipt(
                ticket.firm_id,
                intent,
                work_id,
                namespace_id,
                workspace_id,
                &label,
            )
            .await?
            .map(|record| workspace_reply(intent, &record)),
        ReceiptSelector::Publication {
            workspace_id,
            expected_revision,
            files,
        } => worker
            .publication_receipt(
                ticket.firm_id,
                intent,
                workspace_id,
                expected_revision,
                files,
            )
            .await?
            .map(|revision| {
                reply(
                    json!({"intent_id":intent,"revision":revision}),
                    json!({"source":"catalog","publication_receipt":intent,"revision":revision}),
                )
            }),
    };
    if let Some(ref result) = result {
        complete(a, intent, result).await?;
    }
    Ok(result)
}
