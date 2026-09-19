//! Resource admission uses forwarded actors; worker callbacks retain their own authenticated peer.
use super::{
    App,
    context::{Failure, resource_actor},
};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use ouroboros_core::{Actor, Error};
use ouroboros_transport::Peer;
use serde::Deserialize;
use uuid::Uuid;

pub(super) async fn resource_admit(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ResourceRequest>,
) -> Result<Json<ouroboros_contracts::ResourceAdmission>, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    Ok(Json(a.core.resource_admit(actor, r).await?))
}
pub(super) async fn program_input_admit(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(index): Path<u32>,
    h: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Json<ouroboros_contracts::ProgramInputAdmission>, Failure> {
    if !body.is_empty() {
        return Err(Failure(Error::Invalid));
    }
    let Actor::Instance(peer) = resource_actor(&a, p, &h)? else {
        return Err(Failure(Error::Denied));
    };
    Ok(Json(a.core.program_input_admit(peer, index).await?))
}
pub(super) async fn collection_advance(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(request): Json<ouroboros_contracts::CollectionAdvanceRequest>,
) -> Result<Json<ouroboros_contracts::CollectionAdvance>, Failure> {
    Ok(Json(
        a.core
            .collection_advance(resource_actor(&a, p, &h)?, id, request)
            .await?,
    ))
}
pub(super) async fn collection_claim(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, step)): Path<(Uuid, Uuid)>,
    Json(storage): Json<ouroboros_contracts::StorageClaim>,
) -> Result<Json<ouroboros_contracts::CollectionTicket>, Failure> {
    Ok(Json(
        a.core
            .collection_claim(id, step, &p.fingerprint, &storage)
            .await?,
    ))
}
pub(super) async fn collection_dispatch(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, step)): Path<(Uuid, Uuid)>,
    Json(storage): Json<ouroboros_contracts::StorageClaim>,
) -> Result<StatusCode, Failure> {
    a.core
        .collection_dispatch(id, step, &p.fingerprint, &storage)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct CollectionObservation {
    state: String,
}
pub(super) async fn collection_observe(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, step)): Path<(Uuid, Uuid)>,
    Json(observation): Json<CollectionObservation>,
) -> Result<StatusCode, Failure> {
    a.core
        .collection_step_observe(id, step, &p.fingerprint, &observation.state)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn resource_lookup(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<serde_json::Value>,
) -> Result<Json<ouroboros_contracts::ResourceAdmission>, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    let get = |k| {
        q.get(k)
            .and_then(|x| x.as_str())
            .and_then(|x| Uuid::parse_str(x).ok())
    };
    Ok(Json(
        a.core
            .resource_lookup(actor, id, get("work_id"), get("delegation_id"))
            .await?,
    ))
}
pub(super) async fn workspace_list(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(q): Json<ouroboros_contracts::WorkspaceQuery>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .list_workspaces(resource_actor(&a, p, &h)?, q)
            .await?,
    ))
}
pub(super) async fn workspace_read(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<ouroboros_contracts::WorkspaceQuery>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .read_workspace(resource_actor(&a, p, &h)?, id, q)
            .await?,
    ))
}
pub(super) async fn resource_upload_ready(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<serde_json::Value>,
) -> Result<StatusCode, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    let get = |k| {
        q.get(k)
            .and_then(|x| x.as_str())
            .and_then(|x| Uuid::parse_str(x).ok())
    };
    a.core
        .resource_upload_ready(
            actor,
            id,
            get("work_id"),
            get("delegation_id"),
            q["sha256"].as_str().ok_or(Failure(Error::Invalid))?,
            q["size"].as_u64().ok_or(Failure(Error::Invalid))?,
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn resource_claim(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Json(request): Json<ouroboros_contracts::ResourceClaimRequest>,
) -> Result<Json<ouroboros_contracts::ResourceTicket>, Failure> {
    Ok(Json(
        a.core
            .resource_claim(id, &p.fingerprint, request.storage.as_ref())
            .await?,
    ))
}
pub(super) async fn resource_transfer_access(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<serde_json::Value>,
) -> Result<StatusCode, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    let get = |key| {
        q.get(key)
            .and_then(serde_json::Value::as_str)
            .and_then(|s| Uuid::parse_str(s).ok())
    };
    a.core
        .resource_transfer_access(actor, id, get("work_id"), get("delegation_id"))
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn model_transfer_access(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<serde_json::Value>,
) -> Result<StatusCode, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    let get = |key| {
        q.get(key)
            .and_then(serde_json::Value::as_str)
            .and_then(|s| Uuid::parse_str(s).ok())
    };
    a.core
        .model_transfer_access(actor, id, get("work_id"), get("delegation_id"))
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn credential_transfer_access(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(q): Json<serde_json::Value>,
) -> Result<StatusCode, Failure> {
    let actor = resource_actor(&a, p, &h)?;
    let get = |key| {
        q.get(key)
            .and_then(serde_json::Value::as_str)
            .and_then(|s| Uuid::parse_str(s).ok())
    };
    a.core
        .credential_transfer_access(actor, id, get("work_id"), get("delegation_id"))
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn resource_complete(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Json(reply): Json<ouroboros_contracts::ResourceReply>,
) -> Result<StatusCode, Failure> {
    a.core.resource_complete(id, &p.fingerprint, reply).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub(super) async fn resource_live(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Json(request): Json<ouroboros_contracts::ResourceLiveRequest>,
) -> Result<StatusCode, Failure> {
    a.core.resource_live(id, &p.fingerprint, &request).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn company_receipt_recovery(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<ouroboros_contracts::CompanyRecoveryTicket>, Failure> {
    Ok(Json(
        a.core.company_receipt_recovery(id, &p.fingerprint).await?,
    ))
}
pub(super) async fn provider_receipt_recovery(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<ouroboros_contracts::ProviderRecoveryTicket>, Failure> {
    Ok(Json(
        a.core.provider_receipt_recovery(id, &p.fingerprint).await?,
    ))
}
pub(super) async fn credential_receipt_recovery(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<ouroboros_contracts::CredentialRecoveryTicket>, Failure> {
    Ok(Json(
        a.core
            .credential_receipt_recovery(id, &p.fingerprint)
            .await?,
    ))
}

pub(super) async fn resource_receipt_recovery(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    Json(storage): Json<ouroboros_contracts::StorageClaim>,
) -> Result<Json<ouroboros_contracts::ReceiptRecoveryTicket>, Failure> {
    Ok(Json(
        a.core
            .resource_receipt_recovery(id, &p.fingerprint, &storage)
            .await?,
    ))
}

pub(super) async fn workspace_publication(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, publication)): Path<(Uuid, Uuid)>,
    h: HeaderMap,
    Json(q): Json<ouroboros_contracts::WorkspaceQuery>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .read_workspace_publication(resource_actor(&a, p, &h)?, id, q, Some(publication))
            .await?,
    ))
}
