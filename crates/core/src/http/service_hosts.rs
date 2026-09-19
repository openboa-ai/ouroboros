use super::{
    App,
    context::{Failure, caller, key},
};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use ouroboros_contracts::{Accepted, ServiceHostRequest};
use ouroboros_transport::Peer;
use serde_json::Value;
use uuid::Uuid;

pub(super) async fn admit(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ServiceHostRequest>,
) -> Result<(StatusCode, Json<Accepted>), Failure> {
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .admit_service_request(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn claim(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core.claim_service_request(caller(&a, p, &h)?).await?,
    ))
}
pub(super) async fn reply(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<Value>,
) -> Result<Json<Value>, Failure> {
    Ok(Json(
        a.core
            .reply_service_request(caller(&a, p, &h)?, id, r)
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
        a.core.read_service_request(caller(&a, p, &h)?, id).await?,
    ))
}
