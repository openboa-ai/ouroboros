//! Physical collection consumes explicit Core-issued steps; cancellation does not erase effects.
use super::admission::{complete, gateway_peer};
use super::catalog::{catalog_io, collection_context, collection_reply};
use super::{App, Worker};
use anyhow::{Context, Result, ensure};
use axum::{
    Extension, Json,
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use ouroboros_contracts::{CollectionBinding, CollectionStepResult, CollectionTicket};
use ouroboros_resources::{CatalogWorker, CollectionPreparation};
use ouroboros_transport::Peer;
use serde_json::json;
use std::sync::Arc;
use tokio::time::Instant;
use uuid::Uuid;

pub(super) async fn execute_collection(
    State(a): State<Arc<App>>,
    Extension(peer): Extension<Peer>,
    Path((intent, step)): Path<(Uuid, Uuid)>,
    body: Bytes,
) -> Result<Response, StatusCode> {
    gateway_peer(&a, &peer)?;
    if !body.is_empty() || intent.is_nil() || step.is_nil() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let result = collection_step(a, intent, step)
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    let status = if result.state == "busy" {
        StatusCode::ACCEPTED
    } else {
        StatusCode::OK
    };
    Ok((status, Json(result)).into_response())
}

async fn collection_step(a: Arc<App>, intent: Uuid, step: Uuid) -> Result<CollectionStepResult> {
    let started = Instant::now();
    let Worker::Catalog(worker) = &a.worker else {
        anyhow::bail!("only catalog workers serve collection steps");
    };
    let worker = worker.clone();
    let storage = worker.preflight().await?;
    // This claim consumes exactly the step issued by Core, never an ordinary resource claim.
    let ticket: CollectionTicket = a
        .client
        .post(format!(
            "{}/resource/collections/{intent}/steps/{step}/claim",
            a.core
        ))
        .json(&storage)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    ensure!(
        ticket.resource.intent_id == intent
            && ticket.step_id == step
            && ticket.resource.firm_id == storage.firm_id
            && ticket.binding.store_id == storage.store_id
            && ticket.binding.generation == storage.generation,
        "collection step claim mismatch"
    );
    let (namespace, request, limit) = collection_context(&ticket)?;
    worker.validate_target(storage.firm_id, storage.store_id, storage.generation)?;
    let deadline = started + limit;
    ensure!(
        Instant::now() < deadline,
        "collection step deadline reached"
    );
    let operation = async {
        let w = worker.clone();
        let t = ticket.clone();
        let r = request.clone();
        let prepared = catalog_io(async move {
            w.prepare_collection(
                t.resource.firm_id,
                intent,
                t.resource.work_id,
                namespace,
                &r,
                &t.binding,
                &t.policy,
            )
            .await
        })
        .await?;
        let record = match prepared {
            CollectionPreparation::Busy => {
                let result = a
                    .client
                    .post(format!(
                        "{}/resource/collections/{intent}/steps/{step}/observe",
                        a.core
                    ))
                    .json(&json!({"state":"busy"}))
                    .send()
                    .await?;
                ensure!(
                    result.status() == StatusCode::NO_CONTENT,
                    "collection busy observation rejected"
                );
                return Ok(CollectionStepResult {
                    intent_id: intent,
                    step_id: step,
                    state: "busy".into(),
                    reply: None,
                });
            }
            CollectionPreparation::Completed(record) => record,
            CollectionPreparation::Ready(prepared) => {
                let w = worker.clone();
                let callback_worker = worker.clone();
                let callback_app = a.clone();
                let binding = ticket.binding.clone();
                let firm = ticket.resource.firm_id;
                catalog_io(async move {
                    w.advance_collection(*prepared, move || async move {
                        collection_dispatch(
                            &callback_app,
                            &callback_worker,
                            intent,
                            step,
                            firm,
                            &binding,
                            deadline,
                        )
                        .await
                    })
                    .await
                })
                .await?
            }
        };
        ensure!(
            record.intent_id == intent
                && record.binding == ticket.binding
                && record.policy_id == ticket.policy.id
                && record.policy_revision == ticket.policy.revision
                && matches!(record.confirmation.as_str(), "removed" | "observed_absence"),
            "collection receipt differs from fixed target"
        );
        let result = collection_reply(intent, &record);
        complete(&a, intent, &result).await?;
        Ok(CollectionStepResult {
            intent_id: intent,
            step_id: step,
            state: "completed".into(),
            reply: Some(result),
        })
    };
    // Cancellation is not proof that a syscall stopped. Any already dispatched effect keeps
    // its marker and receipt; a future explicit step or receipt-only observation resolves it.
    tokio::time::timeout_at(deadline, operation)
        .await
        .context("collection step deadline reached")?
}

async fn collection_dispatch(
    a: &App,
    worker: &CatalogWorker,
    intent: Uuid,
    step: Uuid,
    firm: Uuid,
    binding: &CollectionBinding,
    deadline: Instant,
) -> Result<()> {
    ensure!(
        Instant::now() < deadline,
        "collection dispatch deadline reached"
    );
    let storage = worker.preflight().await?;
    ensure!(
        storage.firm_id == firm
            && storage.store_id == binding.store_id
            && storage.generation == binding.generation,
        "collection dispatch binding changed"
    );
    let result = tokio::time::timeout_at(
        deadline,
        a.client
            .post(format!(
                "{}/resource/collections/{intent}/steps/{step}/dispatch",
                a.core
            ))
            .json(&storage)
            .send(),
    )
    .await
    .context("collection dispatch deadline reached")??;
    ensure!(
        result.status() == StatusCode::NO_CONTENT && Instant::now() < deadline,
        "collection dispatch not authorized"
    );
    worker.validate_target(firm, binding.store_id, binding.generation)?;
    Ok(())
}
