//! Core admission and completion transport. No local grant or authority is synthesized here.
use super::catalog::catalog_scope;
use super::{App, Worker, id};
use anyhow::{Result, ensure};
use axum::http::StatusCode;
use ouroboros_contracts::{ResourceLiveRequest, ResourceReply, ResourceTicket};
use ouroboros_transport::Peer;
use uuid::Uuid;

pub(super) fn gateway_peer(app: &App, peer: &Peer) -> Result<(), StatusCode> {
    if peer.fingerprint == app.gateway {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

pub(super) async fn claim(a: &App, intent: Uuid) -> Result<ResourceTicket> {
    let storage = match &a.worker {
        Worker::Catalog(worker) => Some(worker.preflight().await?),
        _ => None,
    };
    let t: ResourceTicket = a
        .client
        .post(format!("{}/resource/claims/{intent}", a.core))
        .json(&ouroboros_contracts::ResourceClaimRequest { storage })
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    ensure!(t.intent_id == intent, "claim mismatch");
    let cfg = &t.configuration;
    if let Worker::Catalog(worker) = &a.worker {
        catalog_scope(cfg)?;
        worker.validate_target(
            t.firm_id,
            id(cfg, "store_id")?,
            id(cfg, "storage_generation")?,
        )?;
        if t.operation == "file.upload" {
            ensure!(
                t.workspace.is_none(),
                "upload must not carry a workspace binding"
            );
        }
    }
    Ok(t)
}
pub(super) async fn complete(a: &App, intent: Uuid, result: &ResourceReply) -> Result<()> {
    a.client
        .post(format!("{}/resource/completions/{intent}", a.core))
        .json(result)
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}
pub(super) async fn operation_live(a: &App, ticket: &ResourceTicket) -> Result<()> {
    let storage = match &a.worker {
        Worker::Catalog(worker) => Some(worker.preflight().await?),
        _ => None,
    };
    let response = a
        .client
        .post(format!("{}/resource/live/{}", a.core, ticket.intent_id))
        .json(&ResourceLiveRequest {
            attempt_id: ticket.attempt_id,
            storage,
        })
        .send()
        .await?;
    ensure!(
        response.status() == StatusCode::NO_CONTENT,
        "operation no longer authorized"
    );
    Ok(())
}
