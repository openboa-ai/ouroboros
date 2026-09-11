//! HTTP request decoding and dispatch. Domain effects retain their own receipt/transaction boundaries.
use super::admission::{claim, gateway_peer};
use super::effects::execute_inner;
use super::files::download_file;
use super::provider::stream_provider;
use super::{App, Worker};
use anyhow::Result;
use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{post, put},
};
use ouroboros_transport::Peer;
use serde::Deserialize;
use std::{sync::Arc, time::Duration};
use tokio::time::Instant;
use uuid::Uuid;

pub(super) fn router(app: Arc<App>) -> Router {
    Router::new()
        .route("/execute/{id}", post(execute))
        .route(
            "/enrollments/{id}/secret",
            put(super::custody::enroll_credential),
        )
        .route(
            "/collections/{id}/steps/{step}/execute",
            post(super::collection::execute_collection),
        )
        .route("/uploads/{id}/content", put(super::files::upload_content))
        .route("/reconcile/{id}", post(super::recovery::reconcile))
        .layer(axum::extract::DefaultBodyLimit::max(65536 + 4096))
        .with_state(app)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Execute {
    content: Option<String>,
}
async fn execute(
    State(a): State<Arc<App>>,
    Extension(peer): Extension<Peer>,
    Path(intent): Path<Uuid>,
    Json(body): Json<Execute>,
) -> Result<Response, StatusCode> {
    gateway_peer(&a, &peer)?;
    if body.content.is_some() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let started = Instant::now();
    let ticket = claim(&a, intent).await.map_err(|_| {
        eprintln!("resource_execute phase=claim intent={intent}");
        StatusCode::SERVICE_UNAVAILABLE
    })?;
    if ticket.operation == "file.read" {
        return download_file(a, ticket, started)
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE);
    }
    if matches!(a.worker, Worker::Provider(_))
        && ticket.operation == "model.responses"
        && ticket.input["stream"] == true
    {
        return stream_provider(a, ticket).await;
    }
    if matches!(a.worker, Worker::Custody(_)) {
        return tokio::time::timeout(Duration::from_secs(10), execute_inner(&a, intent, &ticket))
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .map(|result| Json(result).into_response())
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE);
    }
    execute_inner(&a, intent, &ticket)
        .await
        .map(|result| Json(result).into_response())
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}
