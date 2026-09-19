//! Company continuation controls use Gateway identity; only Runtime can drive reconciliation.
use super::{
    App,
    context::{Failure, caller, key},
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use ouroboros_contracts::{ServiceContinuationRequest, ServiceContinuationStop};
use ouroboros_transport::Peer;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

pub(super) async fn list(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Query(q): Query<HashMap<String, String>>,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .work_service_continuations(caller(&a, p, &h)?, id, q.get("cursor").map(String::as_str))
            .await?,
    ))
}
pub(super) async fn stop_request(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((id, request_key)): Path<(Uuid, String)>,
    h: HeaderMap,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .service_continuation_stop_request(caller(&a, p, &h)?, id, &request_key)
            .await?,
    ))
}

pub(super) async fn register(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ServiceContinuationRequest>,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .register_service_continuation(caller(&a, p, &h)?, key(&h)?, r)
            .await?,
    ))
}
pub(super) async fn read(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .read_service_continuation(caller(&a, p, &h)?, id)
            .await?,
    ))
}
pub(super) async fn stop(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ServiceContinuationStop>,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .stop_service_continuation(caller(&a, p, &h)?, id, key(&h)?, r)
            .await?,
    ))
}
