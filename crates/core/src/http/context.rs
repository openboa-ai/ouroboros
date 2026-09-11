//! Authenticated transport context only; delegation decisions remain in Core transactions.
use super::App;
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use ouroboros_contracts::ApiError;
use ouroboros_core::{Actor, Caller, Error, ResourceActor};
use ouroboros_transport::Peer;

pub(super) struct Failure(pub(super) Error);
impl From<Error> for Failure {
    fn from(e: Error) -> Self {
        Self(e)
    }
}
impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        let (s, c) = match self.0 {
            Error::Denied => (StatusCode::FORBIDDEN, "denied"),
            Error::Conflict => (StatusCode::CONFLICT, "conflict"),
            Error::Capacity => (StatusCode::TOO_MANY_REQUESTS, "capacity"),
            Error::Invalid => (StatusCode::BAD_REQUEST, "invalid"),
            Error::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            Error::Unavailable => (StatusCode::SERVICE_UNAVAILABLE, "unavailable"),
        };
        (
            s,
            Json(ApiError {
                code: c.into(),
                message: c.into(),
            }),
        )
            .into_response()
    }
}
pub(super) fn caller(app: &App, peer: Peer, h: &HeaderMap) -> Result<Actor, Failure> {
    if peer.fingerprint != app.gateway {
        return Err(Failure(Error::Denied));
    }
    if h.contains_key("x-ouro-bridge-peer") {
        if h.contains_key("x-ouro-client-fingerprint")
            || h.get_all("x-ouro-bridge-peer").iter().count() != 1
        {
            return Err(Failure(Error::Denied));
        }
        return Ok(Actor::Instance(
            serde_json::from_slice(h["x-ouro-bridge-peer"].as_bytes())
                .map_err(|_| Failure(Error::Invalid))?,
        ));
    }
    if h.get_all("x-ouro-client-fingerprint").iter().count() != 1 {
        return Err(Failure(Error::Denied));
    }
    let f = h
        .get("x-ouro-client-fingerprint")
        .and_then(|s| s.to_str().ok())
        .ok_or(Failure(Error::Denied))?;
    if f.len() != 64 || !f.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(Failure(Error::Denied));
    }
    Ok(Actor::Human(Caller {
        fingerprint: f.into(),
    }))
}
pub(super) fn key(h: &HeaderMap) -> Result<&str, Failure> {
    h.get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .ok_or(Failure(Error::Invalid))
}

pub(super) fn resource_actor(a: &App, p: Peer, h: &HeaderMap) -> Result<ResourceActor, Failure> {
    caller(a, p, h)
}

pub(super) fn runtime_caller(a: &App, p: Peer) -> Result<String, Failure> {
    if a.runtime.as_deref() != Some(p.fingerprint.as_str()) {
        return Err(Failure(Error::Denied));
    }
    Ok(p.fingerprint)
}

pub(super) async fn recovery_boundary(
    State(app): State<App>,
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    if let Some(gate) = &app.recovery {
        let headers = request.headers();
        let trusted_gateway = request
            .extensions()
            .get::<Peer>()
            .is_some_and(|p| p.fingerprint == app.gateway);
        let human = headers
            .get("x-ouro-client-fingerprint")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if !trusted_gateway
            || headers.contains_key("x-ouro-bridge-peer")
            || headers.get_all("x-ouro-client-fingerprint").iter().count() != 1
            || !gate.permits(
                human,
                request.method().as_str(),
                request.uri().path(),
                request.uri().query().is_some(),
            )
        {
            return (StatusCode::FORBIDDEN, "recovery inspection restriction").into_response();
        }
    }
    next.run(request).await
}
