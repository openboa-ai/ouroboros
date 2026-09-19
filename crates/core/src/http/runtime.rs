//! Runtime callbacks use the configured Runtime peer, never caller-supplied management headers.
use super::{
    App,
    context::{Failure, runtime_caller},
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use ouroboros_core::Error;
use ouroboros_transport::Peer;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ServiceReconcile {
    profile_id: String,
}

pub(super) async fn service_reconcile(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Json(r): Json<ServiceReconcile>,
) -> Result<Json<serde_json::Value>, Failure> {
    let worker = runtime_caller(&a, p)?;
    if r.profile_id.is_empty() || r.profile_id.len() > 128 {
        return Err(Failure(Error::Invalid));
    }
    Ok(Json(
        a.core
            .poll_service_continuations(&worker, &r.profile_id)
            .await?,
    ))
}

pub(super) async fn runtime_pending(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, Failure> {
    runtime_caller(&a, p)?;
    let profile = q.get("profile").ok_or(Failure(Error::Invalid))?;
    Ok(Json(serde_json::json!(
        a.core.runtime_pending(profile).await?
    )))
}
pub(super) async fn runtime_claim(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<Json<ouroboros_contracts::RuntimeTicket>, Failure> {
    let worker = runtime_caller(&a, p)?;
    let context = claim_context(&headers)?;
    Ok(Json(
        a.core
            .runtime_claim_with_context(id, &worker, context.as_ref())
            .await?,
    ))
}
fn claim_context(
    headers: &HeaderMap,
) -> Result<Option<ouroboros_contracts::RuntimeClaimContext>, Failure> {
    let mut values = headers
        .get_all(ouroboros_contracts::RUNTIME_CLAIM_HEADER)
        .iter();
    let Some(value) = values.next() else {
        return Ok(None);
    };
    if values.next().is_some() || value.as_bytes().len() > 2048 {
        return Err(Failure(Error::Invalid));
    }
    serde_json::from_slice(value.as_bytes())
        .map(Some)
        .map_err(|_| Failure(Error::Invalid))
}
pub(super) async fn runtime_claim_observation(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<ouroboros_contracts::RuntimeClaimObservation>, Failure> {
    let worker = runtime_caller(&a, p)?;
    Ok(Json(a.core.runtime_claim_observation(id, &worker).await?))
}
pub(super) async fn runtime_permitted(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, Failure> {
    let worker = runtime_caller(&a, p)?;
    Ok(Json(a.core.runtime_permitted(id, &worker).await?))
}
pub(super) async fn runtime_history(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, Failure> {
    let worker = runtime_caller(&a, p)?;
    Ok(Json(a.core.runtime_history(id, &worker).await?))
}
pub(super) async fn native_pending(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Uuid>>, Failure> {
    Ok(Json(
        a.core.native_pending(id, &runtime_caller(&a, p)?).await?,
    ))
}
pub(super) async fn native_dispatch(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, action)): Path<(Uuid, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, Failure> {
    let worker = runtime_caller(&a, p)?;
    match action.as_str() {
        "claim" if body == serde_json::json!({}) => Ok(Json(
            serde_json::to_value(a.core.native_claim(id, &worker).await?)
                .map_err(|_| Failure(Error::Unavailable))?,
        )),
        "check" => {
            let attempt = body["attempt_id"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or(Failure(Error::Invalid))?;
            a.core.native_dispatch_check(id, &worker, attempt).await?;
            Ok(Json(serde_json::json!({"permitted":true})))
        }
        "ack" => {
            let ack = serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?;
            a.core.native_ack(id, &worker, &ack).await?;
            Ok(Json(serde_json::json!({"recorded":true})))
        }
        _ => Err(Failure(Error::Invalid)),
    }
}
pub(super) async fn runtime_change(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, action)): Path<(Uuid, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, Failure> {
    let worker = runtime_caller(&a, p)?;
    match action.as_str() {
        "bind" => {
            a.core
                .runtime_bind(
                    id,
                    &worker,
                    serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?,
                )
                .await?
        }
        "release" if body == serde_json::json!({}) => a.core.runtime_release(id, &worker).await?,
        "native-turn" => {
            let report: ouroboros_contracts::NativeTurnReport =
                serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?;
            a.core.runtime_native_turn(id, &worker, &report).await?;
        }
        "materialized" => {
            let receipt: ouroboros_contracts::MaterializationReceipt =
                serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?;
            a.core.runtime_materialized(id, &worker, &receipt).await?;
        }
        "program-result" => {
            let receipt: ouroboros_contracts::RuntimeProgramObservation =
                serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?;
            a.core
                .runtime_program_observation(id, &worker, &receipt)
                .await?;
        }
        "compute-return" => {
            let receipt: ouroboros_contracts::ComputeReturnReceipt =
                serde_json::from_value(body).map_err(|_| Failure(Error::Invalid))?;
            a.core.runtime_compute_return(id, &worker, &receipt).await?;
        }
        "terminated" if body == serde_json::json!({}) => {
            a.core.runtime_terminated(id, &worker).await?
        }
        _ => return Err(Failure(Error::Invalid)),
    }
    Ok(Json(serde_json::json!({"recorded":true})))
}
