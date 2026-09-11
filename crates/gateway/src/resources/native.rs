//! Explicit provider targets and native stream delivery under current access.
use super::access::{AccessMonitor, MonitoredStream};
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    body::Body,
    http::{HeaderMap, StatusCode},
    response::Response,
};
use futures_util::StreamExt;
use ouroboros_contracts::ResourceAdmission;
use serde::Deserialize;
use std::io;
use uuid::Uuid;

/// Deployment routing selects an existing managed target, never a credential or permission.
#[derive(Clone, Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct NativeRoutes {
    pub(crate) model: Option<String>,
    pub(crate) mcp: Option<String>,
}
impl NativeRoutes {
    pub(crate) fn validate(
        &self,
        workers: &std::collections::HashMap<String, String>,
    ) -> anyhow::Result<()> {
        for target in [&self.model, &self.mcp].into_iter().flatten() {
            anyhow::ensure!(
                !target.is_empty() && target.len() <= 256 && workers.contains_key(target),
                "native route requires a configured worker target"
            );
        }
        Ok(())
    }
    pub(crate) fn target(&self, operation: &str) -> Result<&str, StatusCode> {
        match operation {
            "model.responses" => self.model.as_deref(),
            "mcp" => self.mcp.as_deref(),
            _ => None,
        }
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)
    }
}

pub(super) async fn model_stream(
    a: &App,
    caller: &ManagementCaller,
    headers: &HeaderMap,
    id: Uuid,
    upstream: reqwest::Response,
) -> Result<Response, StatusCode> {
    if upstream.status() != StatusCode::OK
        || upstream
            .headers()
            .get("x-ouro-intent-id")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| Uuid::parse_str(v).ok())
            != Some(id)
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let monitor = AccessMonitor::start_kind(a, caller.clone(), headers, id, true).await?;
    let a = a.clone();
    let caller = caller.clone();
    let scope = caller.actor.scope(headers);
    let bytes = async_stream::try_stream! {
        let mut input=upstream.bytes_stream();let mut body=Vec::new();
        while let Some(chunk)=input.next().await {
            let chunk=chunk.map_err(|_|io::Error::other("model stream incomplete"))?;
            if body.len().saturating_add(chunk.len())>2097152 {Err(io::Error::other("model stream bound exceeded"))?;}
            body.extend_from_slice(&chunk);yield chunk;
        }
        // EOF alone cannot establish success: the worker must have persisted/completed the
        // matching result, and this reader must still be authorized when inspecting it.
        let current=context(a.client.post(format!("{}/resource/lookup/{id}",a.core)),&caller.actor)
            .json(&scope).send().await.map_err(|_|io::Error::other("model completion unavailable"))?;
        if !current.status().is_success() {Err(io::Error::other("model completion denied"))?;}
        let current:ResourceAdmission=current.json().await.map_err(|_|io::Error::other("model completion unavailable"))?;
        let reply=current.reply.ok_or_else(||io::Error::other("model completion absent"))?;
        if reply.status!=200 || reply.content_type!="text/event-stream" || reply.body.as_bytes()!=body {Err(io::Error::other("model completion mismatch"))?;}
    };
    let monitored = MonitoredStream::new(bytes, monitor);
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "text/event-stream")
        .header("x-ouro-intent-id", id.to_string())
        .body(Body::from_stream(monitored))
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}

#[cfg(test)]
mod native_route_tests {
    use super::*;
    #[test]
    fn routes_are_explicit_and_do_not_fall_back_to_fixture() {
        let workers = [("managed-model".into(), "https://worker.invalid".into())]
            .into_iter()
            .collect();
        let absent = NativeRoutes::default();
        absent.validate(&workers).unwrap();
        assert_eq!(
            absent.target("model.responses"),
            Err(StatusCode::SERVICE_UNAVAILABLE)
        );
        let routes: NativeRoutes =
            serde_json::from_value(serde_json::json!({"model":"managed-model"})).unwrap();
        routes.validate(&workers).unwrap();
        assert_eq!(routes.target("model.responses").unwrap(), "managed-model");
        assert!(routes.target("mcp").is_err());
        assert!(routes.target("arbitrary").is_err());
        let missing: NativeRoutes =
            serde_json::from_value(serde_json::json!({"model":"unregistered"})).unwrap();
        assert!(missing.validate(&workers).is_err());
        assert!(
            serde_json::from_value::<NativeRoutes>(
                serde_json::json!({"model":"managed-model", "secret":"forbidden"})
            )
            .is_err()
        );
    }
}

#[cfg(test)]
mod protocol_tests {
    use super::*;
    use crate::identity::Actor;
    use axum::{Router, body::to_bytes, extract::State, http::Request, response::IntoResponse};
    use ouroboros_contracts::{ResourceReply, ResourceRequest};
    use serde_json::json;
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };

    #[derive(Clone, Copy)]
    enum Fault {
        None,
        AccessDenied,
        MismatchedReceipt,
    }
    #[derive(Clone)]
    struct Fixture {
        intent: Uuid,
        operation: &'static str,
        payload: &'static str,
        fault: Fault,
        admission: Arc<Mutex<Option<(HeaderMap, ResourceRequest)>>>,
    }
    impl Fixture {
        fn reply(&self) -> ResourceReply {
            ResourceReply {
                status: 200,
                content_type: if self.operation == "model.responses" {
                    "text/event-stream"
                } else {
                    "application/json"
                }
                .into(),
                body: if matches!(self.fault, Fault::MismatchedReceipt) {
                    "different persisted result"
                } else {
                    self.payload
                }
                .into(),
                receipt: json!({"source":"synthetic-provider"}),
            }
        }
        fn admitted(&self, completed: bool) -> ResourceAdmission {
            ResourceAdmission {
                intent_id: self.intent,
                operation: self.operation.into(),
                target: "managed-provider".into(),
                state: if completed { "succeeded" } else { "accepted" }.into(),
                reply: completed.then(|| self.reply()),
                upload: None,
                workspace: None,
            }
        }
    }
    struct Server(tokio::task::JoinHandle<()>);
    impl Drop for Server {
        fn drop(&mut self) {
            self.0.abort();
        }
    }
    async fn fixture(operation: &'static str, fault: Fault) -> (App, Fixture, Server) {
        async fn serve(State(f): State<Fixture>, request: Request<Body>) -> Response {
            let (parts, body) = request.into_parts();
            if parts.uri.path() == "/resource/admissions" {
                let data = to_bytes(body, 65536).await.unwrap();
                *f.admission.lock().unwrap() =
                    Some((parts.headers, serde_json::from_slice(&data).unwrap()));
                return axum::Json(f.admitted(false)).into_response();
            }
            if parts.uri.path() == format!("/resource/lookup/{}", f.intent) {
                return axum::Json(f.admitted(true)).into_response();
            }
            if parts.uri.path() == format!("/resource/model-transfers/{}/access", f.intent) {
                return if matches!(f.fault, Fault::AccessDenied) {
                    StatusCode::FORBIDDEN
                } else {
                    StatusCode::NO_CONTENT
                }
                .into_response();
            }
            if parts.uri.path() == format!("/execute/{}", f.intent) {
                return if f.operation == "model.responses" {
                    Response::builder()
                        .status(200)
                        .header("content-type", "text/event-stream")
                        .header("x-ouro-intent-id", f.intent.to_string())
                        .body(Body::from(f.payload))
                        .unwrap()
                } else {
                    axum::Json(f.reply()).into_response()
                };
            }
            StatusCode::NOT_FOUND.into_response()
        }
        let f = Fixture {
            intent: Uuid::new_v4(),
            operation,
            fault,
            payload: if operation == "model.responses" {
                "event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"synthetic\",\"output\":[],\"future_field\":true}}\n\n"
            } else {
                "{\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"fixture\"}],\"_meta\":{\"future\":true}}}"
            },
            admission: Arc::new(Mutex::new(None)),
        };
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        let router = Router::new().fallback(serve).with_state(f.clone());
        let server = Server(tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        }));
        let app = App {
            recovery: None,
            native_routes: NativeRoutes {
                model: Some("managed-provider".into()),
                mcp: Some("managed-provider".into()),
            },
            client: reqwest::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap(),
            core: endpoint.clone(),
            workers: [("managed-provider".into(), endpoint)]
                .into_iter()
                .collect(),
        };
        (app, f, server)
    }
    async fn request(app: App, path: &str) -> Response {
        let caller = ManagementCaller {
            actor: Actor::Human("a".repeat(64)),
            #[cfg(target_os = "linux")]
            peer: None,
        };
        let request = Request::builder()
            .method("POST")
            .uri(path)
            .header("content-type", "application/json")
            .header("x-ouro-client-fingerprint", "forged")
            .header("x-ouro-bridge-peer", "forged")
            .header("authorization", "Bearer caller-value")
            .body(Body::from("{\"future_request_field\":true}"))
            .unwrap();
        super::super::handle(app, caller, request).await
    }
    #[tokio::test]
    async fn native_model_and_mcp_preserve_protocol_and_use_authenticated_context() {
        for (operation, path, content_type) in [
            ("model.responses", "/v1/responses", "text/event-stream"),
            ("mcp", "/mcp", "application/json"),
        ] {
            let (app, fixture, _server) = fixture(operation, Fault::None).await;
            let response = request(app, path).await;
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response.headers()["content-type"], content_type);
            assert_eq!(
                response.headers()["x-ouro-intent-id"],
                fixture.intent.to_string()
            );
            assert_eq!(
                to_bytes(response.into_body(), 65536).await.unwrap(),
                fixture.payload
            );
            let admission = fixture.admission.lock().unwrap();
            let (headers, admitted) = admission.as_ref().unwrap();
            assert_eq!(headers["x-ouro-client-fingerprint"], "a".repeat(64));
            assert!(!headers.contains_key("x-ouro-bridge-peer"));
            assert!(!headers.contains_key("authorization"));
            assert_eq!(admitted.target, "managed-provider");
            assert_eq!(admitted.operation, operation);
            assert_eq!(admitted.input, json!({"future_request_field":true}));
        }
    }
    #[tokio::test]
    async fn native_model_delivery_requires_current_access_and_matching_completion() {
        let (app, _, _server) = fixture("model.responses", Fault::AccessDenied).await;
        assert_eq!(
            request(app, "/v1/responses").await.status(),
            StatusCode::FORBIDDEN
        );
        let (app, _, _server) = fixture("model.responses", Fault::MismatchedReceipt).await;
        let response = request(app, "/v1/responses").await;
        assert_eq!(response.status(), StatusCode::OK);
        assert!(to_bytes(response.into_body(), 65536).await.is_err());
    }
}
