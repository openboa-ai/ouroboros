//! Fixed runtime input materialization; no caller-selected work, target, or delegation.
use super::files::{binary_read, valid_digest};
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    http::{HeaderMap, Method, StatusCode, Uri},
    response::Response,
};
use ouroboros_contracts::ProgramInputAdmission;
use serde_json::json;

pub(super) fn execution_input_index(
    method: &Method,
    uri: &Uri,
    headers: &HeaderMap,
) -> Result<u32, StatusCode> {
    if method != Method::GET
        || uri.query().is_some()
        || uri.scheme().is_some()
        || uri.authority().is_some()
        || [
            "idempotency-key",
            "x-ouro-work-id",
            "x-ouro-delegation-id",
            "x-ouro-resource-target",
        ]
        .iter()
        .any(|name| headers.contains_key(*name))
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    let index = uri
        .path()
        .strip_prefix("/execution-inputs/")
        .ok_or(StatusCode::NOT_FOUND)?;
    let parsed = index.parse::<u32>().map_err(|_| StatusCode::BAD_REQUEST)?;
    if index != parsed.to_string() {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(parsed)
}

pub(super) async fn execution_input_read(
    a: &App,
    caller: ManagementCaller,
    index: u32,
) -> Result<Response, StatusCode> {
    if !caller.actor.is_instance() || !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let result = context(
        a.client
            .post(format!("{}/runtime/input-reads/{index}", a.core)),
        &caller.actor,
    )
    .body(Vec::new())
    .send()
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !result.status().is_success() {
        return Err(result.status());
    }
    let fixed: ProgramInputAdmission = result
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    let admitted = fixed.admission;
    let input = fixed.input;
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    if input.index != index
        || admitted.intent_id.is_nil()
        || admitted.operation != "file.read"
        || admitted.target != input.reference.target
        || !valid_digest(&input.sha256)
        || input.size > i64::MAX as u64
        || admitted.workspace.as_ref().is_none_or(|workspace| {
            workspace.workspace_id != input.reference.workspace_id
                || workspace.namespace_id != input.namespace_id
        })
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if admitted.state != "accepted" || admitted.reply.is_some() {
        // A materializer cannot replay a claimed/completed read by reusing its worker intent.
        return Err(StatusCode::CONFLICT);
    }
    let endpoint = a
        .workers
        .get(&admitted.target)
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let upstream = a
        .client
        .post(format!("{endpoint}/execute/{}", admitted.intent_id))
        .json(&json!({"content":null}))
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !upstream.status().is_success() {
        return Err(upstream.status());
    }
    if upstream
        .headers()
        .get("content-length")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        != Some(input.size)
        || upstream
            .headers()
            .get("x-ouro-content-sha256")
            .and_then(|value| value.to_str().ok())
            != Some(input.sha256.as_str())
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let snapshot = json!({"workspace_id":input.reference.workspace_id,
        "revision":input.reference.revision,"path":input.reference.file});
    // No caller-selected scope reaches lookup or live monitoring. Core permits these checks
    // only for the fixed input intent and the actual instance still materializing it.
    binary_read(
        a,
        caller,
        &HeaderMap::new(),
        admitted.intent_id,
        &admitted.target,
        &snapshot,
        upstream,
    )
    .await
}

#[cfg(test)]
mod program_input_tests {
    use super::super::{inner, is_resource};
    use super::*;
    use crate::identity::Actor;
    use axum::{body::Body, http::Request};
    #[cfg(target_os = "linux")]
    use {
        axum::{Router, body::to_bytes, extract::State, response::IntoResponse},
        ouroboros_contracts::{ResourceAdmission, ResourceReply},
        sha2::{Digest, Sha256},
        std::{
            sync::{Arc, Mutex},
            time::Duration,
        },
        uuid::Uuid,
    };

    #[test]
    fn bootstrap_read_accepts_only_a_canonical_index_without_caller_scope() {
        let headers = HeaderMap::new();
        assert_eq!(
            execution_input_index(
                &Method::GET,
                &"/execution-inputs/0".parse().unwrap(),
                &headers
            ),
            Ok(0)
        );
        for path in [
            "/execution-inputs/-1",
            "/execution-inputs/01",
            "/execution-inputs/+1",
            "/execution-inputs/1/extra",
            "/execution-inputs/../0",
            "/execution-inputs/4294967296",
            "/execution-inputs/0?target=other",
            "http://elsewhere/execution-inputs/0",
        ] {
            assert!(execution_input_index(&Method::GET, &path.parse().unwrap(), &headers).is_err());
        }
        let uri = "/execution-inputs/0".parse().unwrap();
        assert!(execution_input_index(&Method::POST, &uri, &headers).is_err());
        for name in [
            "idempotency-key",
            "x-ouro-work-id",
            "x-ouro-delegation-id",
            "x-ouro-resource-target",
        ] {
            let mut supplied = HeaderMap::new();
            supplied.insert(name, "caller-choice".parse().unwrap());
            assert_eq!(
                execution_input_index(&Method::GET, &uri, &supplied),
                Err(StatusCode::BAD_REQUEST)
            );
        }
        assert!(is_resource("/execution-inputs/0"));
        assert!(!is_resource("/execution-inputs-extra/0"));
    }

    #[tokio::test]
    async fn a_human_cannot_use_the_materializer_entry_point() {
        let caller = ManagementCaller {
            actor: Actor::Human("registered-human".into()),
            #[cfg(target_os = "linux")]
            peer: None,
        };
        let app = App {
            recovery: None,
            native_routes: Default::default(),
            client: reqwest::Client::new(),
            core: "http://unreachable.invalid".into(),
            workers: Default::default(),
        };
        let request = Request::builder()
            .uri("/execution-inputs/0")
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            inner(&app, caller, request).await.unwrap_err(),
            StatusCode::FORBIDDEN
        );
    }

    #[cfg(target_os = "linux")]
    mod instance {
        use super::*;
        use ouroboros_contracts::{
            BridgeIdentity, ProgramInput, ResolvedProgramInput, WorkspaceBinding,
        };

        #[derive(Clone, Copy)]
        enum Fault {
            None,
            DescriptorIndex,
            DescriptorHash,
            ReceiptSnapshot,
            Bytes,
            Access,
        }
        #[derive(Clone)]
        struct Fixture {
            intent: Uuid,
            input: ResolvedProgramInput,
            bytes: Vec<u8>,
            fault: Fault,
            calls: Arc<Mutex<Vec<(String, HeaderMap, serde_json::Value)>>>,
        }
        impl Fixture {
            fn snapshot(&self) -> serde_json::Value {
                json!({"workspace_id":self.input.reference.workspace_id,"revision":self.input.reference.revision,"path":self.input.reference.file})
            }
            fn admission(&self, completed: bool) -> ResourceAdmission {
                let mut snapshot = self.snapshot();
                if matches!(self.fault, Fault::ReceiptSnapshot) {
                    snapshot["path"] = json!("another.py");
                }
                ResourceAdmission {intent_id:self.intent,operation:"file.read".into(),target:self.input.reference.target.clone(),
                    state:if completed {"succeeded"} else {"accepted"}.into(),
                    reply:completed.then(||ResourceReply {status:200,content_type:"application/octet-stream".into(),body:String::new(),
                        receipt:json!({"source":"catalog","sha256":self.input.sha256,"size":self.input.size,"snapshot":snapshot})}),
                    upload:None,workspace:Some(WorkspaceBinding {workspace_id:self.input.reference.workspace_id,namespace_id:self.input.namespace_id})}
            }
        }
        struct Server(tokio::task::JoinHandle<()>);
        impl Drop for Server {
            fn drop(&mut self) {
                self.0.abort();
            }
        }
        async fn fixture(fault: Fault) -> (App, Fixture, Server) {
            async fn mock(State(f): State<Fixture>, request: Request<Body>) -> Response {
                let (parts, body) = request.into_parts();
                let bytes = to_bytes(body, 65536).await.unwrap();
                let input = if bytes.is_empty() {
                    json!(null)
                } else {
                    serde_json::from_slice(&bytes).unwrap()
                };
                let path = parts.uri.path().to_owned();
                f.calls
                    .lock()
                    .unwrap()
                    .push((path.clone(), parts.headers, input));
                if path == "/runtime/input-reads/0" {
                    let mut descriptor = f.input.clone();
                    if matches!(f.fault, Fault::DescriptorIndex) {
                        descriptor.index = 1;
                    }
                    if matches!(f.fault, Fault::DescriptorHash) {
                        descriptor.sha256 = "b".repeat(64);
                    }
                    return axum::Json(ProgramInputAdmission {
                        admission: f.admission(false),
                        input: descriptor,
                    })
                    .into_response();
                }
                if path == format!("/execute/{}", f.intent) {
                    let bytes = if matches!(f.fault, Fault::Bytes) {
                        vec![b'X'; f.bytes.len()]
                    } else {
                        f.bytes.clone()
                    };
                    return Response::builder()
                        .status(StatusCode::OK)
                        .header("content-type", "application/octet-stream")
                        .header("content-length", f.input.size.to_string())
                        .header("x-ouro-content-sha256", &f.input.sha256)
                        .header("x-ouro-intent-id", f.intent.to_string())
                        .body(Body::from(bytes))
                        .unwrap();
                }
                if path == format!("/resource/lookup/{}", f.intent) {
                    return axum::Json(f.admission(true)).into_response();
                }
                if path == format!("/resource/transfers/{}/access", f.intent) {
                    return if matches!(f.fault, Fault::Access) {
                        StatusCode::FORBIDDEN
                    } else {
                        StatusCode::NO_CONTENT
                    }
                    .into_response();
                }
                // The special bootstrap path cannot make ordinary resource admissions available.
                StatusCode::FORBIDDEN.into_response()
            }
            let bytes = b"print('contained fixture')\n".to_vec();
            let f = Fixture {
                intent: Uuid::new_v4(),
                input: ResolvedProgramInput {
                    index: 0,
                    reference: ProgramInput {
                        target: "company-files".into(),
                        workspace_id: Uuid::new_v4(),
                        revision: 3,
                        file: "scripts/task.py".into(),
                        destination: "task.py".into(),
                    },
                    namespace_id: Uuid::new_v4(),
                    upload_id: Uuid::new_v4(),
                    object_id: Uuid::new_v4(),
                    store_id: Uuid::new_v4(),
                    generation: Uuid::new_v4(),
                    sha256: format!("{:x}", Sha256::digest(&bytes)),
                    size: bytes.len() as u64,
                },
                bytes,
                fault,
                calls: Arc::new(Mutex::new(Vec::new())),
            };
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let endpoint = format!("http://{}", listener.local_addr().unwrap());
            let router = Router::new()
                .fallback(axum::routing::any(mock))
                .with_state(f.clone());
            let server = Server(tokio::spawn(async move {
                axum::serve(listener, router).await.unwrap();
            }));
            (
                App {
                    recovery: None,
                    native_routes: crate::NativeRoutes {
                        model: Some("company-files".into()),
                        mcp: None,
                    },
                    client: reqwest::Client::builder()
                        .no_proxy()
                        .retry(reqwest::retry::never())
                        .timeout(Duration::from_secs(2))
                        .build()
                        .unwrap(),
                    core: endpoint.clone(),
                    workers: [("company-files".into(), endpoint)].into_iter().collect(),
                },
                f,
                server,
            )
        }
        fn identity() -> BridgeIdentity {
            BridgeIdentity {
                pid: 101,
                uid: 1000,
                start_ticks: 700,
                boot_id: Uuid::new_v4().to_string(),
            }
        }
        fn caller(peer: BridgeIdentity) -> ManagementCaller {
            ManagementCaller {
                actor: Actor::Instance(peer),
                peer: None,
            }
        }
        fn request() -> Request<Body> {
            Request::builder()
                .uri("/execution-inputs/0")
                .header("x-ouro-client-fingerprint", "forged-human")
                .header("x-ouro-bridge-peer", "forged-peer")
                .body(Body::empty())
                .unwrap()
        }

        #[tokio::test]
        async fn fixed_input_uses_actual_peer_and_proven_binary_path_only() {
            let (app, f, _server) = fixture(Fault::None).await;
            let peer = identity();
            let result = inner(&app, caller(peer.clone()), request()).await.unwrap();
            assert_eq!(result.status(), StatusCode::OK);
            assert_eq!(
                result.headers()["x-ouro-content-sha256"].to_str().unwrap(),
                f.input.sha256.as_str()
            );
            assert_eq!(
                to_bytes(result.into_body(), 65536).await.unwrap().to_vec(),
                f.bytes
            );
            let calls = f.calls.lock().unwrap();
            assert_eq!(calls[0].0, "/runtime/input-reads/0");
            assert!(calls[0].2.is_null());
            assert!(
                !calls
                    .iter()
                    .any(|(path, _, _)| path == "/resource/admissions")
            );
            for (path, headers, body) in calls.iter() {
                for name in [
                    "x-ouro-client-fingerprint",
                    "x-ouro-work-id",
                    "x-ouro-delegation-id",
                    "x-ouro-resource-target",
                    "idempotency-key",
                ] {
                    assert!(!headers.contains_key(name));
                }
                if path.starts_with("/execute/") {
                    assert!(!headers.contains_key("x-ouro-bridge-peer"));
                    assert_eq!(body, &json!({"content":null}));
                } else {
                    assert_eq!(
                        serde_json::from_str::<BridgeIdentity>(
                            headers["x-ouro-bridge-peer"].to_str().unwrap()
                        )
                        .unwrap(),
                        peer
                    );
                }
                if path.starts_with("/resource/") {
                    assert_eq!(body, &json!({"work_id":null,"delegation_id":null}));
                }
            }
        }

        #[tokio::test]
        async fn bootstrap_read_denies_wrong_descriptor_receipt_authority_or_bytes() {
            for fault in [
                Fault::DescriptorIndex,
                Fault::DescriptorHash,
                Fault::ReceiptSnapshot,
                Fault::Bytes,
                Fault::Access,
            ] {
                let (app, _fixture, _server) = fixture(fault).await;
                let result = inner(&app, caller(identity()), request()).await;
                if matches!(fault, Fault::Bytes) {
                    assert!(to_bytes(result.unwrap().into_body(), 65536).await.is_err());
                } else {
                    let expected = if matches!(fault, Fault::Access) {
                        StatusCode::FORBIDDEN
                    } else {
                        StatusCode::SERVICE_UNAVAILABLE
                    };
                    assert_eq!(result.unwrap_err(), expected);
                }
            }
        }

        #[tokio::test]
        async fn bootstrap_read_body_and_caller_scope_cannot_select_other_inputs() {
            let (app, f, _server) = fixture(Fault::None).await;
            let mut with_body = request();
            *with_body.body_mut() = Body::from("{}");
            let mut with_scope = request();
            with_scope.headers_mut().insert(
                "x-ouro-work-id",
                Uuid::new_v4().to_string().parse().unwrap(),
            );
            for request in [with_body, with_scope] {
                assert_eq!(
                    inner(&app, caller(identity()), request).await.unwrap_err(),
                    StatusCode::BAD_REQUEST
                );
            }
            assert!(f.calls.lock().unwrap().is_empty());
            let request = Request::builder()
                .method("POST")
                .uri("/v1/responses")
                .body(Body::from("{}"))
                .unwrap();
            assert_eq!(
                inner(&app, caller(identity()), request).await.unwrap_err(),
                StatusCode::FORBIDDEN
            );
            assert!(
                f.calls
                    .lock()
                    .unwrap()
                    .iter()
                    .all(|(path, _, _)| path == "/resource/admissions")
            );
        }
    }
}
