//! Explicit collection-step approval, dispatch, and receipt reconciliation.
use super::{access::lookup_current, response};
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use ouroboros_contracts::{CollectionAdvance, CollectionAdvanceRequest, CollectionStepResult};
use serde_json::json;
use uuid::Uuid;

pub(super) async fn collection_advance(
    a: &App,
    caller: &ManagementCaller,
    headers: &HeaderMap,
    intent: Uuid,
) -> Result<Response, StatusCode> {
    if headers.get_all("idempotency-key").iter().count() != 1 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let key = headers["idempotency-key"]
        .to_str()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    ouroboros_contracts::request_key(key).map_err(|_| StatusCode::BAD_REQUEST)?;
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let scope = caller.actor.scope(headers);
    let result = context(
        a.client
            .post(format!("{}/resource/collections/{intent}/advance", a.core)),
        &caller.actor,
    )
    .json(&CollectionAdvanceRequest {
        request_key: key.to_owned(),
        work_id: scope.work_id,
        delegation_id: scope.delegation_id,
    })
    .send()
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !result.status().is_success() {
        return Err(result.status());
    }
    let advance: CollectionAdvance = result
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    let current = lookup_current(a, caller, headers, intent).await?;
    if advance.intent_id != intent
        || advance.step_id.is_nil()
        || advance.sequence <= 0
        || current.operation != "file.collect"
        || advance.target != current.target
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    if !advance.dispatch_allowed {
        // A repeated key can inspect its durable step, but cannot claim or resend it.
        return Ok((
            StatusCode::ACCEPTED,
            axum::Json(json!({
                "advance": advance, "step": null, "current": current,
            })),
        )
            .into_response());
    }
    let endpoint = a
        .workers
        .get(&advance.target)
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let result = a
        .client
        .post(format!(
            "{endpoint}/collections/{intent}/steps/{}/execute",
            advance.step_id
        ))
        .body(Vec::new())
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !result.status().is_success() {
        return Err(result.status());
    }
    let step: CollectionStepResult = result
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    let current = lookup_current(a, caller, headers, intent).await?;
    if step.intent_id != intent
        || step.step_id != advance.step_id
        || current.operation != "file.collect"
        || current.target != advance.target
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    match (step.state.as_str(), step.reply.as_ref()) {
        ("completed", Some(reply))
            if current.state == "succeeded" && current.reply.as_ref() == Some(reply) =>
        {
            Ok(response(intent, reply.clone()))
        }
        ("busy", None) => Ok((
            StatusCode::ACCEPTED,
            axum::Json(json!({
                "advance": advance, "step": step, "current": current,
            })),
        )
            .into_response()),
        _ => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

#[cfg(test)]
mod collection_tests {
    use super::super::{inner, is_resource};
    use super::*;
    use crate::identity::Actor;
    use axum::{
        Router,
        body::{Body, to_bytes},
        extract::State,
        http::Request,
    };
    use ouroboros_contracts::ResourceReply;
    use std::{
        sync::{
            Arc, Mutex,
            atomic::{AtomicBool, Ordering},
        },
        time::Duration,
    };

    #[derive(Clone, Copy)]
    enum Outcome {
        Busy,
        Completed,
        MismatchedReply,
        ReadRevoked,
    }

    #[derive(Clone)]
    struct Fixture {
        intent: Uuid,
        step: Uuid,
        work: Uuid,
        grant: Uuid,
        outcome: Outcome,
        cached: bool,
        issued: Arc<AtomicBool>,
        executed: Arc<AtomicBool>,
        calls: Arc<Mutex<Vec<(String, HeaderMap, serde_json::Value)>>>,
    }
    impl Fixture {
        fn reply(&self) -> ResourceReply {
            ResourceReply {
                status: 200,
                content_type: "application/json".into(),
                body: json!({"intent_id":self.intent,"confirmation":"removed"}).to_string(),
                receipt: json!({"source":"catalog","collection_receipt":self.intent}),
            }
        }
        fn admission(&self) -> serde_json::Value {
            let completed = self.cached
                || (self.executed.load(Ordering::SeqCst) && !matches!(self.outcome, Outcome::Busy));
            json!({"intent_id":self.intent,"target":"company-files","operation":"file.collect",
                "state": if completed { "succeeded" } else if self.issued.load(Ordering::SeqCst) { "claimed" } else { "accepted" },
                "reply":if completed {Some(self.reply())} else {None}})
        }
        fn request(&self, path: &str, body: Body) -> Request<Body> {
            Request::builder()
                .method("POST")
                .uri(path)
                .header("idempotency-key", "one-explicit-step")
                .header("x-ouro-work-id", self.work.to_string())
                .header("x-ouro-delegation-id", self.grant.to_string())
                .header("x-ouro-resource-target", "company-files")
                .header("x-ouro-client-fingerprint", "forged-human")
                .header("x-ouro-bridge-peer", "forged-instance")
                .body(body)
                .unwrap()
        }
    }
    struct Server(tokio::task::JoinHandle<()>);
    impl Drop for Server {
        fn drop(&mut self) {
            self.0.abort();
        }
    }

    async fn fixture(outcome: Outcome, cached: bool) -> (App, Fixture, Server) {
        async fn mock(State(f): State<Fixture>, request: Request<Body>) -> Response {
            let (parts, body) = request.into_parts();
            let data = to_bytes(body, 65536).await.unwrap();
            let input: serde_json::Value = if data.is_empty() {
                json!(null)
            } else {
                serde_json::from_slice(&data).unwrap()
            };
            let path = parts.uri.path().to_owned();
            f.calls
                .lock()
                .unwrap()
                .push((path.clone(), parts.headers, input));
            if path == "/resource/admissions" {
                return axum::Json(f.admission()).into_response();
            }
            if path == format!("/resource/lookup/{}", f.intent) {
                if f.executed.load(Ordering::SeqCst) && matches!(f.outcome, Outcome::ReadRevoked) {
                    return StatusCode::FORBIDDEN.into_response();
                }
                return axum::Json(f.admission()).into_response();
            }
            if path == format!("/resource/collections/{}/advance", f.intent) {
                let replay = f.issued.swap(true, Ordering::SeqCst);
                return axum::Json(CollectionAdvance {
                    intent_id: f.intent,
                    step_id: f.step,
                    sequence: 1,
                    target: "company-files".into(),
                    state: if replay { "busy" } else { "issued" }.into(),
                    dispatch_allowed: !replay,
                })
                .into_response();
            }
            if path == format!("/collections/{}/steps/{}/execute", f.intent, f.step) {
                f.executed.store(true, Ordering::SeqCst);
                let busy = matches!(f.outcome, Outcome::Busy);
                let mut reply = f.reply();
                if matches!(f.outcome, Outcome::MismatchedReply) {
                    reply.body = "unverified bytes".into();
                }
                return (
                    if busy {
                        StatusCode::ACCEPTED
                    } else {
                        StatusCode::OK
                    },
                    axum::Json(CollectionStepResult {
                        intent_id: f.intent,
                        step_id: f.step,
                        state: if busy { "busy" } else { "completed" }.into(),
                        reply: if busy { None } else { Some(reply) },
                    }),
                )
                    .into_response();
            }
            if path == format!("/reconcile/{}", f.intent) {
                return axum::Json(f.reply()).into_response();
            }
            StatusCode::NOT_FOUND.into_response()
        }
        let f = Fixture {
            intent: Uuid::new_v4(),
            step: Uuid::new_v4(),
            work: Uuid::new_v4(),
            grant: Uuid::new_v4(),
            outcome,
            cached,
            issued: Arc::new(AtomicBool::new(false)),
            executed: Arc::new(AtomicBool::new(false)),
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
        let app = App {
            recovery: None,
            native_routes: Default::default(),
            client: reqwest::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap(),
            core: endpoint.clone(),
            workers: [("company-files".into(), endpoint)].into_iter().collect(),
        };
        (app, f, server)
    }
    fn human() -> ManagementCaller {
        ManagementCaller {
            actor: Actor::Human("registered-human".into()),
            #[cfg(target_os = "linux")]
            peer: None,
        }
    }
    fn proposal() -> serde_json::Value {
        json!({"upload_id":Uuid::new_v4(),"reason":"Retired data is no longer held",
            "policy_id":Uuid::new_v4(),"policy_revision":1})
    }

    #[tokio::test]
    async fn admission_and_cached_replay_never_execute_collection() {
        for cached in [false, true] {
            let (app, f, _server) = fixture(Outcome::Completed, cached).await;
            let input = proposal();
            for _ in 0..2 {
                let request = f.request("/collections", Body::from(input.to_string()));
                assert_eq!(
                    inner(&app, human(), request).await.unwrap().status(),
                    StatusCode::ACCEPTED
                );
            }
            let calls = f.calls.lock().unwrap();
            assert!(
                calls
                    .iter()
                    .all(|(path, _, body)| path == "/resource/admissions"
                        && body["operation"] == "file.collect")
            );
            assert!(!f.executed.load(Ordering::SeqCst));
        }
    }

    #[tokio::test]
    async fn busy_and_same_step_replay_are_metadata_with_one_worker_call() {
        let (app, f, _server) = fixture(Outcome::Busy, false).await;
        let path = format!("/resource-intents/{}/advance", f.intent);
        for replay in [false, true] {
            let mut request = f.request(&path, Body::empty());
            request.headers_mut().insert(
                "x-ouro-resource-target",
                "caller-cannot-route-worker".parse().unwrap(),
            );
            let result = inner(&app, human(), request).await.unwrap();
            assert_eq!(result.status(), StatusCode::ACCEPTED);
            let body: serde_json::Value =
                serde_json::from_slice(&to_bytes(result.into_body(), 65536).await.unwrap())
                    .unwrap();
            assert_eq!(body["advance"]["dispatch_allowed"], !replay);
            if replay {
                assert!(body["step"].is_null());
            } else {
                assert_eq!(body["step"]["state"], "busy");
                assert!(body["step"]["reply"].is_null());
            }
        }
        let calls = f.calls.lock().unwrap();
        let worker_path = format!("/collections/{}/steps/{}/execute", f.intent, f.step);
        assert_eq!(
            calls
                .iter()
                .filter(|(path, _, _)| path == &worker_path)
                .count(),
            1
        );
        for (path, headers, body) in calls.iter() {
            assert!(!headers.contains_key("x-ouro-resource-target"));
            assert!(!headers.contains_key("x-ouro-bridge-peer"));
            if path.starts_with("/resource/") {
                assert_eq!(headers["x-ouro-client-fingerprint"], "registered-human");
            }
            if path.ends_with("/advance") {
                assert_eq!(
                    body,
                    &json!({"request_key":"one-explicit-step","work_id":f.work,"delegation_id":f.grant})
                );
            }
            if path == &worker_path {
                assert!(!headers.contains_key("x-ouro-client-fingerprint"));
                assert!(body.is_null());
            }
        }
    }

    #[tokio::test]
    async fn final_delivery_requires_current_read_authority_and_exact_core_receipt() {
        for (outcome, expected) in [
            (Outcome::Completed, StatusCode::OK),
            (Outcome::MismatchedReply, StatusCode::SERVICE_UNAVAILABLE),
            (Outcome::ReadRevoked, StatusCode::FORBIDDEN),
        ] {
            let (app, f, _server) = fixture(outcome, false).await;
            let request = f.request(
                &format!("/resource-intents/{}/advance", f.intent),
                Body::empty(),
            );
            let result = inner(&app, human(), request).await;
            assert_eq!(
                result
                    .map(|response| response.status())
                    .unwrap_or_else(|status| status),
                expected
            );
            assert!(f.executed.load(Ordering::SeqCst));
        }
    }

    #[tokio::test]
    async fn collection_reconcile_only_observes_original_target() {
        let (app, f, _server) = fixture(Outcome::Completed, true).await;
        let mut request = f.request(
            &format!("/resource-intents/{}/reconcile", f.intent),
            Body::empty(),
        );
        request
            .headers_mut()
            .insert("x-ouro-resource-target", "wrong-target".parse().unwrap());
        assert_eq!(
            inner(&app, human(), request).await.unwrap().status(),
            StatusCode::OK
        );
        assert!(!f.executed.load(Ordering::SeqCst));
        let calls = f.calls.lock().unwrap();
        assert!(
            calls
                .iter()
                .any(|(path, _, _)| path == &format!("/reconcile/{}", f.intent))
        );
        assert!(
            calls
                .iter()
                .all(|(path, _, _)| !path.ends_with("/advance") && !path.ends_with("/execute"))
        );
    }

    #[tokio::test]
    async fn advance_rejects_body_duplicate_or_missing_key_and_collection_rejects_physical_selector()
     {
        let (app, f, _server) = fixture(Outcome::Busy, false).await;
        let path = format!("/resource-intents/{}/advance", f.intent);
        let mut missing = f.request(&path, Body::empty());
        missing.headers_mut().remove("idempotency-key");
        let mut duplicate = f.request(&path, Body::empty());
        duplicate
            .headers_mut()
            .append("idempotency-key", "another".parse().unwrap());
        let body = f.request(&path, Body::from("{}"));
        let mut invalid = proposal();
        invalid["object_id"] = json!(Uuid::new_v4());
        let physical = f.request("/collections", Body::from(invalid.to_string()));
        let mut duplicate_collection =
            f.request("/collections", Body::from(proposal().to_string()));
        duplicate_collection
            .headers_mut()
            .append("idempotency-key", "another".parse().unwrap());
        for request in [missing, duplicate, body, physical, duplicate_collection] {
            assert_eq!(
                inner(&app, human(), request).await.unwrap_err(),
                StatusCode::BAD_REQUEST
            );
        }
        assert!(f.calls.lock().unwrap().is_empty());
        assert!(is_resource("/collections"));
        assert!(!is_resource("/collections/delete"));
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn instance_advance_uses_registered_peer_and_implicit_work_scope() {
        let (app, f, _server) = fixture(Outcome::Busy, false).await;
        let identity = ouroboros_contracts::BridgeIdentity {
            pid: 101,
            uid: 1000,
            start_ticks: 77,
            boot_id: Uuid::new_v4().to_string(),
        };
        let caller = ManagementCaller {
            actor: Actor::Instance(identity.clone()),
            peer: None,
        };
        let request = f.request(
            &format!("/resource-intents/{}/advance", f.intent),
            Body::empty(),
        );
        assert_eq!(
            inner(&app, caller, request).await.unwrap().status(),
            StatusCode::ACCEPTED
        );
        let calls = f.calls.lock().unwrap();
        let (_, headers, body) = calls
            .iter()
            .find(|(path, _, _)| path.ends_with("/advance"))
            .unwrap();
        assert!(!headers.contains_key("x-ouro-client-fingerprint"));
        assert_eq!(
            serde_json::from_str::<ouroboros_contracts::BridgeIdentity>(
                headers["x-ouro-bridge-peer"].to_str().unwrap()
            )
            .unwrap(),
            identity
        );
        assert!(body["work_id"].is_null());
        assert!(body["delegation_id"].is_null());
    }
}
