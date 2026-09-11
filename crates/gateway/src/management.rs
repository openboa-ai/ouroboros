//! Explicit public management allowlist and Core forwarding.
use crate::{
    App,
    identity::{Actor, ManagementCaller},
};
use axum::{
    body::{Body, to_bytes},
    http::{HeaderMap, Method, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
};

fn management_route(method: &Method, uri: &Uri) -> bool {
    // Exact connected routes only: prefix matching would expose future internal Core handlers.
    if uri.scheme().is_some() || uri.authority().is_some() {
        return false;
    }
    let segments: Vec<_> = uri.path().split('/').collect();
    let query_allowed = method == Method::GET
        && (matches!(uri.path(), "/work" | "/events")
            || matches!(segments.as_slice(), ["", "conversations", _, "messages"]));
    if let Some(query) = uri.query()
        && (!query_allowed
            || query.len() > 4096
            || !query.starts_with("cursor=")
            || query.len() == "cursor=".len()
            || query.contains('&'))
    {
        return false;
    }
    match (method.as_str(), segments.as_slice()) {
        ("POST", ["", "environment", "admission"]) => true,
        ("GET", ["", "environment", "status", grant]) => uuid::Uuid::parse_str(grant).is_ok(),
        ("GET" | "POST", ["", "mcp", "work", work, "delegation", grant]) => {
            uuid::Uuid::parse_str(work).is_ok() && uuid::Uuid::parse_str(grant).is_ok()
        }
        (
            "POST",
            [
                "",
                "conversations",
                conversation,
                "messages",
                message,
                "deliver",
            ],
        ) => uuid::Uuid::parse_str(conversation).is_ok() && uuid::Uuid::parse_str(message).is_ok(),
        ("GET", ["", "conditions" | "work" | "events"])
        | (
            "POST",
            [
                "",
                "work"
                | "executions"
                | "wakes"
                | "conversations"
                | "connection-candidates"
                | "adapter-submissions",
            ],
        ) => true,
        ("GET", ["", "work" | "executions" | "intents" | "wakes", id])
        | (
            "POST",
            [
                "",
                "executions",
                id,
                "stop" | "native-controls" | "cancel-unstarted",
            ],
        )
        | ("GET" | "POST", ["", "conversations", id, "messages"])
        | ("POST", ["", "conversations", id, "participants"])
        | ("GET", ["", "work", id, "conversations"])
        | (
            "POST",
            [
                "",
                "connection-candidates",
                id,
                "inspect" | "reviews" | "acceptances" | "activate" | "status" | "stop",
            ],
        )
        | (
            "POST",
            [
                "",
                "adapter-submissions",
                id,
                "inspect"
                | "verification-executions"
                | "evaluations"
                | "acceptances"
                | "activate"
                | "invocations"
                | "stop",
            ],
        )
        | ("POST", ["", "wakes", id, "cancel"])
        | ("POST", ["", "delegations", id, "revoke"]) => uuid::Uuid::parse_str(id).is_ok(),
        _ => false,
    }
}

fn management_headers(actor: &Actor, incoming: &HeaderMap) -> Result<HeaderMap, StatusCode> {
    if incoming
        .get("origin")
        .is_some_and(|origin| origin != "http://127.0.0.1:18080")
    {
        return Err(StatusCode::FORBIDDEN);
    }
    // Build a new map. No caller-provided identity, authorization, forwarding or resource scope
    // header may cross this management boundary as trusted Core context.
    let mut headers = HeaderMap::new();
    let (name, value) = match actor {
        Actor::Human(fingerprint) => ("x-ouro-client-fingerprint", fingerprint.clone()),
        #[cfg(target_os = "linux")]
        Actor::Instance(peer) => (
            "x-ouro-bridge-peer",
            serde_json::to_string(peer).map_err(|_| StatusCode::FORBIDDEN)?,
        ),
    };
    headers.insert(name, value.parse().map_err(|_| StatusCode::FORBIDDEN)?);
    for name in [
        "content-type",
        "idempotency-key",
        "last-event-id",
        "accept",
        "mcp-protocol-version",
    ] {
        if incoming.get_all(name).iter().count() > 1 {
            return Err(StatusCode::BAD_REQUEST);
        }
        if let Some(value) = incoming.get(name) {
            headers.insert(name, value.clone());
        }
    }
    Ok(headers)
}

pub(crate) async fn management_forward(
    a: App,
    caller: ManagementCaller,
    request: Request<Body>,
) -> Response {
    if !caller.alive() {
        return StatusCode::FORBIDDEN.into_response();
    }
    let (parts, body) = request.into_parts();
    if !management_route(&parts.method, &parts.uri) {
        return (StatusCode::SERVICE_UNAVAILABLE, "capability not connected").into_response();
    }
    if parts.uri.path().starts_with("/mcp/") && parts.headers.contains_key("origin") {
        return StatusCode::FORBIDDEN.into_response();
    }
    let headers = match management_headers(&caller.actor, &parts.headers) {
        Ok(headers) => headers,
        Err(status) => return status.into_response(),
    };
    let body = tokio::select! {
        biased;
        _ = caller.ended() => return StatusCode::FORBIDDEN.into_response(),
        result = to_bytes(body, 64 * 1024) => match result {
            Ok(body) => body,
            Err(_) => return StatusCode::PAYLOAD_TOO_LARGE.into_response(),
        },
    };
    // A peer may exit while delivering a request body, even when its original socket survives.
    if !caller.alive() {
        return StatusCode::FORBIDDEN.into_response();
    }
    let path = parts
        .uri
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");
    let request = a
        .client
        .request(parts.method, format!("{}{path}", a.core))
        .headers(headers)
        .body(body);
    if !caller.alive() {
        return StatusCode::FORBIDDEN.into_response();
    }
    let result = tokio::select! {
        biased;
        // Transmission may already have caused an effect; loss of the caller is not a denial.
        _ = caller.ended() => return (
            StatusCode::SERVICE_UNAVAILABLE,
            "caller ended during dispatch; mutation outcome may be unresolved",
        ).into_response(),
        result = request.send() => result,
    };
    match result {
        Ok(mut upstream) => {
            let mut reply = Response::builder().status(upstream.status());
            if let Some(value) = upstream.headers().get("content-type") {
                reply = reply.header("content-type", value);
            }
            let stream = async_stream::stream! {
                loop {
                    let next = tokio::select! {
                        biased;
                        _ = caller.ended() => break,
                        next = upstream.chunk() => next,
                    };
                    // This also ends an idle SSE stream without waiting for another Core event.
                    if !caller.alive() {
                        break;
                    }
                    match next {
                        Ok(Some(chunk)) => yield Ok::<_, reqwest::Error>(chunk),
                        Ok(None) => break,
                        Err(error) => { yield Err(error); break; }
                    }
                }
            };
            reply
                .body(Body::from_stream(stream))
                .expect("valid response")
        }
        Err(_) => (
            StatusCode::SERVICE_UNAVAILABLE,
            "control dependency unavailable; mutation outcome may be unresolved",
        )
            .into_response(),
    }
}

#[cfg(test)]
mod management_tests {
    use super::*;
    use crate::resources;

    #[test]
    fn managed_mcp_is_not_the_native_resource_prefix() {
        let work = uuid::Uuid::new_v4();
        let grant = uuid::Uuid::new_v4();
        let path = format!("/mcp/work/{work}/delegation/{grant}");
        assert!(!resources::is_resource(&path));
        assert!(resources::is_resource("/mcp"));
        assert!(management_route(&Method::POST, &path.parse().unwrap()));
        assert!(management_route(&Method::GET, &path.parse().unwrap()));
        assert!(!management_route(&Method::DELETE, &path.parse().unwrap()));
    }
    #[test]
    fn management_routes_allow_only_connected_methods_and_targets() {
        let id = "00000000-0000-4000-8000-000000000001";
        for (method, path) in [
            ("GET", "/conditions".to_owned()),
            ("GET", "/work".to_owned()),
            ("GET", "/work?cursor=opaque%2Fcursor%3D".to_owned()),
            ("POST", "/work".to_owned()),
            ("POST", "/executions".to_owned()),
            ("POST", "/wakes".to_owned()),
            ("POST", "/conversations".to_owned()),
            ("GET", format!("/work/{id}/conversations")),
            ("POST", format!("/conversations/{id}/messages/{id}/deliver")),
            ("POST", format!("/conversations/{id}/messages")),
            ("GET", format!("/conversations/{id}/messages?cursor=0")),
            ("GET", format!("/wakes/{id}")),
            ("POST", format!("/wakes/{id}/cancel")),
            ("GET", format!("/work/{id}")),
            ("GET", format!("/executions/{id}")),
            ("GET", format!("/intents/{id}")),
            ("POST", format!("/executions/{id}/stop")),
            ("POST", format!("/executions/{id}/cancel-unstarted")),
            ("POST", format!("/executions/{id}/native-controls")),
            ("POST", format!("/delegations/{id}/revoke")),
            ("GET", "/events".to_owned()),
            ("GET", "/events?cursor=opaque%3A1".to_owned()),
        ] {
            assert!(
                management_route(&method.parse().unwrap(), &path.parse().unwrap()),
                "{method} {path} must be connected"
            );
        }
        for (method, path) in [
            ("POST", "/conditions"),
            ("DELETE", "/work"),
            ("GET", "/work/"),
            ("GET", "/work/internal"),
            ("GET", "/work/../runtime/pending"),
            ("GET", "/work/%2e%2e/runtime/pending"),
            ("GET", "/conditions?cursor=1"),
            ("POST", "/work?cursor=1"),
            ("GET", "/work?cursor=1&cursor=2"),
            ("GET", "/work?target=https://example.invalid"),
            ("GET", "/work?cursor="),
            ("POST", "/events"),
            ("GET", "/runtime/pending"),
            ("POST", "/resource/admissions"),
            ("GET", "https://example.invalid/work"),
            ("GET", "//example.invalid/work"),
        ] {
            assert!(
                !management_route(&method.parse().unwrap(), &path.parse().unwrap()),
                "{method} {path} must be refused"
            );
        }
        assert!(!management_route(
            &Method::POST,
            &format!("/executions/{id}/grant").parse().unwrap()
        ));
    }

    fn spoofed_headers() -> HeaderMap {
        let mut incoming = HeaderMap::new();
        for (name, value) in [
            ("x-ouro-client-fingerprint", "forged-human"),
            ("x-ouro-bridge-peer", "forged-instance"),
            ("x-ouro-work-id", "forged-work"),
            ("x-ouro-delegation-id", "forged-grant"),
            ("authorization", "Bearer untrusted"),
            ("forwarded", "for=forged"),
            ("content-type", "application/json"),
            ("idempotency-key", "existing-request"),
            ("last-event-id", "opaque-cursor"),
        ] {
            incoming.insert(name, value.parse().unwrap());
        }
        incoming
    }

    #[test]
    fn human_management_context_is_rebuilt_without_forwarded_identity() {
        let outgoing =
            management_headers(&Actor::Human("a".repeat(64)), &spoofed_headers()).unwrap();
        assert_eq!(outgoing.len(), 4);
        assert_eq!(outgoing["x-ouro-client-fingerprint"], "a".repeat(64));
        assert_eq!(outgoing["idempotency-key"], "existing-request");
        assert_eq!(outgoing["last-event-id"], "opaque-cursor");
        assert!(!outgoing.contains_key("x-ouro-bridge-peer"));
        assert!(!outgoing.contains_key("authorization"));
        assert!(!outgoing.contains_key("x-ouro-work-id"));
        assert!(!outgoing.contains_key("x-ouro-delegation-id"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn instance_management_context_uses_only_the_verified_peer_identity() {
        let identity = ouroboros_contracts::BridgeIdentity {
            pid: 42,
            uid: 65532,
            start_ticks: 7,
            boot_id: "00000000-0000-4000-8000-000000000001".into(),
        };
        let outgoing =
            management_headers(&Actor::Instance(identity.clone()), &spoofed_headers()).unwrap();
        assert_eq!(outgoing.len(), 4);
        assert!(!outgoing.contains_key("x-ouro-client-fingerprint"));
        assert_eq!(
            serde_json::from_slice::<ouroboros_contracts::BridgeIdentity>(
                outgoing["x-ouro-bridge-peer"].as_bytes()
            )
            .unwrap(),
            identity
        );
    }

    #[test]
    fn management_rejects_foreign_origins_and_ambiguous_request_keys() {
        let actor = Actor::Human("a".repeat(64));
        let mut incoming = HeaderMap::new();
        incoming.insert("origin", "https://example.invalid".parse().unwrap());
        assert_eq!(
            management_headers(&actor, &incoming),
            Err(StatusCode::FORBIDDEN)
        );
        incoming.clear();
        incoming.append("idempotency-key", "first".parse().unwrap());
        incoming.append("idempotency-key", "second".parse().unwrap());
        assert_eq!(
            management_headers(&actor, &incoming),
            Err(StatusCode::BAD_REQUEST)
        );
    }
}
