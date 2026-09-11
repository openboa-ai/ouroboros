//! Managed connection and adapter lifecycle requests, including the native MCP surface.
use super::{
    App,
    context::{Failure, caller, key},
};
use axum::{
    Extension, Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use ouroboros_transport::Peer;
use serde::Deserialize;
use uuid::Uuid;

pub(super) async fn adapter_submit(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterSubmissionRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .submit_adapter(caller(&a, p, &h)?, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn adapter_inspect(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<CandidateRead>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .inspect_adapter(caller(&a, p, &h)?, id, r.work_id, r.delegation_id)
            .await?,
    ))
}
pub(super) async fn managed_mcp(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((work, grant)): Path<(Uuid, Uuid)>,
    h: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Response, Failure> {
    let actor = caller(&a, p, &h)?;
    a.core.managed_mcp_scope(&actor, work, grant).await?;
    if h.get("content-type")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(';').next())
        != Some("application/json")
    {
        return Ok(StatusCode::UNSUPPORTED_MEDIA_TYPE.into_response());
    }
    let accept = h.get("accept").and_then(|v| v.to_str().ok()).unwrap_or("");
    if !["application/json", "text/event-stream"]
        .iter()
        .all(|t| accept.split(',').any(|v| v.trim() == *t))
    {
        return Ok(StatusCode::NOT_ACCEPTABLE.into_response());
    }
    if h.get("mcp-protocol-version")
        .is_some_and(|v| v != "2025-11-25")
    {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    }
    if body.len() > 65536 {
        return Ok(StatusCode::PAYLOAD_TOO_LARGE.into_response());
    }
    let input:serde_json::Value=match serde_json::from_slice(&body) {
        Ok(v)=>v,Err(_)=>return Ok(Json(serde_json::json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}})).into_response()),
    };
    if input["method"] != "initialize" && h.get("mcp-protocol-version").is_none() {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    }
    match a.core.managed_mcp(actor, work, grant, input).await? {
        Some(v) => Ok(Json(v).into_response()),
        None => Ok(StatusCode::ACCEPTED.into_response()),
    }
}
pub(super) async fn managed_mcp_get(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path((work, grant)): Path<(Uuid, Uuid)>,
    h: HeaderMap,
) -> Result<Response, Failure> {
    a.core
        .managed_mcp_scope(&caller(&a, p, &h)?, work, grant)
        .await?;
    Ok(StatusCode::METHOD_NOT_ALLOWED.into_response())
}
pub(super) async fn adapter_activate(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterActivationRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .activate_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn adapter_invoke(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterInvocationRequest>,
) -> Result<(StatusCode, Json<ouroboros_contracts::Accepted>), Failure> {
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .invoke_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn adapter_stop(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterStopRequest>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .stop_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
            .await?,
    ))
}
pub(super) async fn adapter_accept(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterAcceptanceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .accept_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn adapter_evaluate(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::AdapterEvaluationRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .evaluate_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn adapter_verify(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ExecutionRequest>,
) -> Result<(StatusCode, Json<ouroboros_contracts::Accepted>), Failure> {
    Ok((
        StatusCode::ACCEPTED,
        Json(
            a.core
                .verify_adapter(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn connection_propose(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    h: HeaderMap,
    Json(request): Json<ouroboros_contracts::ConnectionCandidateRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    let result = a
        .core
        .propose_connection(caller(&a, p, &h)?, key(&h)?, request)
        .await?;
    Ok((StatusCode::ACCEPTED, Json(result)))
}
pub(super) async fn connection_accept(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ConnectionAcceptanceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .accept_connection(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn connection_activate(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ConnectionActivationRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .activate_connection(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn connection_stop(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<ouroboros_contracts::ConnectionStopRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    Ok((
        StatusCode::CREATED,
        Json(
            a.core
                .stop_connection(caller(&a, p, &h)?, id, key(&h)?, r)
                .await?,
        ),
    ))
}
pub(super) async fn connection_status(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(r): Json<CandidateRead>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .connection_status(caller(&a, p, &h)?, id, r.work_id, r.delegation_id)
            .await?,
    ))
}
pub(super) async fn connection_review(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(request): Json<ouroboros_contracts::ConnectionReviewRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), Failure> {
    let result = a
        .core
        .review_connection(caller(&a, p, &h)?, id, key(&h)?, request)
        .await?;
    Ok((StatusCode::CREATED, Json(result)))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct CandidateRead {
    work_id: Option<Uuid>,
    delegation_id: Option<Uuid>,
}
pub(super) async fn connection_inspect(
    State(a): State<App>,
    Extension(p): Extension<Peer>,
    Path(id): Path<Uuid>,
    h: HeaderMap,
    Json(request): Json<CandidateRead>,
) -> Result<Json<serde_json::Value>, Failure> {
    Ok(Json(
        a.core
            .read_connection_candidate(
                caller(&a, p, &h)?,
                id,
                request.work_id,
                request.delegation_id,
            )
            .await?,
    ))
}
