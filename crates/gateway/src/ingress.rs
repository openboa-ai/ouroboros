//! Human mTLS and Runtime-verified instance ingress converge before route dispatch.
use crate::{
    App,
    identity::{Actor, ManagementCaller},
    management::management_forward,
    resources,
};
use axum::{
    Extension,
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
};
use ouroboros_transport::Peer;

pub(crate) async fn forward(
    State(a): State<App>,
    Extension(peer): Extension<Peer>,
    request: Request<Body>,
) -> Response {
    if let Some(gate) = &a.recovery
        && !gate.permits(
            &peer.fingerprint,
            request.method().as_str(),
            request.uri().path(),
            request.uri().query().is_some(),
        )
    {
        return (StatusCode::FORBIDDEN, "recovery inspection restriction").into_response();
    }
    dispatch(
        a,
        ManagementCaller {
            actor: Actor::Human(peer.fingerprint),
            #[cfg(target_os = "linux")]
            peer: None,
        },
        request,
    )
    .await
}

#[cfg(target_os = "linux")]
pub(crate) async fn instance_forward(
    State(a): State<App>,
    Extension(peer): Extension<ouroboros_transport::InstancePeer>,
    request: Request<Body>,
) -> Response {
    if !peer.alive() {
        return StatusCode::FORBIDDEN.into_response();
    }
    dispatch(
        a,
        ManagementCaller {
            actor: Actor::Instance(peer.identity.clone()),
            peer: Some(peer),
        },
        request,
    )
    .await
}

async fn dispatch(a: App, caller: ManagementCaller, request: Request<Body>) -> Response {
    if resources::is_resource(request.uri().path()) {
        resources::handle(a, caller, request).await
    } else {
        management_forward(a, caller, request).await
    }
}
