//! Resource request admission, receipt recovery, and protocol-specific dispatch.
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    body::{Body, to_bytes},
    http::{HeaderMap, Method, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use collections::collection_advance;
use enrollment::enrollment_transfer;
use files::{binary_read, upload};
use inputs::{execution_input_index, execution_input_read};
use native::model_stream;
use ouroboros_contracts::{
    CollectionRequest, ResourceAdmission, ResourceReply, ResourceRequest, RetirementRequest,
};
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

mod access;
mod collections;
mod enrollment;
mod files;
mod inputs;
pub(crate) mod native;

fn service_effect_slot(headers: &HeaderMap) -> Result<Option<String>, StatusCode> {
    let name = ouroboros_contracts::SERVICE_EFFECT_SLOT_HEADER;
    if headers.get_all(name).iter().count() > 1 {
        return Err(StatusCode::BAD_REQUEST);
    }
    headers
        .get(name)
        .map(|value| {
            let slot = value.to_str().map_err(|_| StatusCode::BAD_REQUEST)?;
            if !ouroboros_contracts::service_slot_name(slot) {
                return Err(StatusCode::BAD_REQUEST);
            }
            Ok(slot.to_owned())
        })
        .transpose()
}

fn selected_target(headers: &HeaderMap) -> Result<&str, StatusCode> {
    selected_target_or(headers, "catalog")
}

fn selected_target_or<'a>(headers: &'a HeaderMap, default: &'a str) -> Result<&'a str, StatusCode> {
    if headers.get_all("x-ouro-resource-target").iter().count() > 1 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let target = headers
        .get("x-ouro-resource-target")
        .map(|value| value.to_str().map_err(|_| StatusCode::BAD_REQUEST))
        .transpose()?
        .unwrap_or(default);
    if target.is_empty()
        || target.len() > 128
        || !target.as_bytes()[0].is_ascii_alphanumeric()
        || !target
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
    {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(target)
}

fn workspace_cursor(method: &Method, uri: &Uri) -> Result<Option<String>, StatusCode> {
    let Some(query) = uri.query() else {
        return Ok(None);
    };
    if method != Method::GET || uri.path() != "/workspaces" || query.len() > 4096 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let mut parsed = reqwest::Url::parse("http://cursor.invalid/")
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    parsed.set_query(Some(query));
    let mut pairs = parsed.query_pairs();
    let Some((name, value)) = pairs.next() else {
        return Err(StatusCode::BAD_REQUEST);
    };
    if name != "cursor" || value.is_empty() || pairs.next().is_some() {
        return Err(StatusCode::BAD_REQUEST);
    }
    Ok(Some(value.into_owned()))
}

fn response(intent: Uuid, r: ResourceReply) -> Response {
    Response::builder()
        .status(r.status)
        .header("content-type", r.content_type)
        .header("x-ouro-intent-id", intent.to_string())
        .body(Body::from(r.body))
        .expect("validated resource response")
}

pub fn is_resource(path: &str) -> bool {
    matches!(
        path,
        "/workspaces" | "/retirements" | "/collections" | "/mcp"
    ) || [
        "/v1/responses",
        "/db/",
        "/workspaces/",
        "/uploads",
        "/credential-enrollments",
        "/credential-disables",
        "/publications",
        "/resource-intents/",
        "/execution-inputs/",
    ]
    .iter()
    .any(|p| path.starts_with(p))
}
pub async fn handle(a: App, caller: ManagementCaller, request: Request<Body>) -> Response {
    let result = tokio::select! {
        biased;
        _ = caller.ended() => Err(StatusCode::FORBIDDEN),
        result = inner(&a, caller.clone(), request) => result,
    };
    match result {
        Ok(r) => r,
        Err(s) => (s, "resource request denied or unresolved").into_response(),
    }
}
async fn inner(
    a: &App,
    caller: ManagementCaller,
    request: Request<Body>,
) -> Result<Response, StatusCode> {
    let actor = &caller.actor;
    let (parts, body) = request.into_parts();
    let cursor = workspace_cursor(&parts.method, &parts.uri)?;
    if parts
        .headers
        .get("origin")
        .is_some_and(|v| v != "http://127.0.0.1:18080")
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let path = parts.uri.path();
    let segments: Vec<_> = path.trim_matches('/').split('/').collect();
    if path.starts_with("/execution-inputs/") {
        if !actor.is_instance() {
            return Err(StatusCode::FORBIDDEN);
        }
        let index = execution_input_index(&parts.method, &parts.uri, &parts.headers)?;
        to_bytes(body, 0)
            .await
            .map_err(|_| StatusCode::BAD_REQUEST)?;
        if !caller.alive() {
            return Err(StatusCode::FORBIDDEN);
        }
        return execution_input_read(a, caller, index).await;
    }
    // File content never enters the JSON/body-buffer path below.
    if parts.method == axum::http::Method::PUT
        && matches!(segments.as_slice(), ["uploads", _, "content"])
    {
        let id = Uuid::parse_str(segments[1]).map_err(|_| StatusCode::BAD_REQUEST)?;
        return upload(a, caller, parts.headers, id, body).await;
    }
    if parts.method == Method::PUT
        && matches!(segments.as_slice(), ["credential-enrollments", _, "secret"])
    {
        let id = Uuid::parse_str(segments[1]).map_err(|_| StatusCode::BAD_REQUEST)?;
        return tokio::time::timeout(
            Duration::from_secs(15),
            enrollment_transfer(a, caller, parts.headers, id, body),
        )
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    }
    let data = to_bytes(body, 2_097_152)
        .await
        .map_err(|_| StatusCode::PAYLOAD_TOO_LARGE)?;
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let scope = actor.scope(&parts.headers);
    let work = scope.work_id;
    let grant = scope.delegation_id;
    if parts.method == Method::GET
        && matches!(
            segments.as_slice(),
            ["workspaces"] | ["workspaces", _] | ["workspaces", _, "publications", _]
        )
    {
        if !data.is_empty() {
            return Err(StatusCode::BAD_REQUEST);
        }
        let target = selected_target(&parts.headers)?;
        let endpoint = match segments.as_slice() {
            ["workspaces"] => format!("{}/resource/workspaces/list", a.core),
            ["workspaces", id, "publications", publication] => {
                let id = Uuid::parse_str(id).map_err(|_| StatusCode::BAD_REQUEST)?;
                let publication =
                    Uuid::parse_str(publication).map_err(|_| StatusCode::BAD_REQUEST)?;
                format!(
                    "{}/resource/workspaces/{id}/publications/{publication}",
                    a.core
                )
            }
            ["workspaces", id] => {
                let id = Uuid::parse_str(id).map_err(|_| StatusCode::BAD_REQUEST)?;
                format!("{}/resource/workspaces/{id}", a.core)
            }
            _ => unreachable!(),
        };
        let mut result = context(a.client.post(endpoint), actor)
            .json(&json!({
                "work_id": work,
                "delegation_id": grant,
                "target_id": target,
                "cursor": cursor,
            }))
            .send()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if !result.status().is_success() {
            return Err(result.status());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = result
            .chunk()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
        {
            if bytes.len().saturating_add(chunk.len()) > 2_097_152 {
                return Err(StatusCode::SERVICE_UNAVAILABLE);
            }
            bytes.extend_from_slice(&chunk);
        }
        let result: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if !caller.alive() {
            return Err(StatusCode::FORBIDDEN);
        }
        return Ok(axum::Json(result).into_response());
    }
    if parts.method == Method::POST
        && matches!(segments.as_slice(), ["resource-intents", _, "advance"])
    {
        if !data.is_empty() {
            return Err(StatusCode::BAD_REQUEST);
        }
        let id = Uuid::parse_str(segments[1]).map_err(|_| StatusCode::BAD_REQUEST)?;
        return collection_advance(a, &caller, &parts.headers, id).await;
    }
    let lookup = |id| access::lookup_request(a, &caller, &parts.headers, id);
    let read = parts.method == axum::http::Method::GET
        && segments.len() == 2
        && segments[0] == "resource-intents";
    let reconcile = parts.method == axum::http::Method::POST
        && segments.len() == 3
        && segments[0] == "resource-intents"
        && segments[2] == "reconcile";
    if reconcile && !data.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    let mut file_input = None;
    let admitted: ResourceAdmission = if read || reconcile {
        let id = Uuid::parse_str(segments[1]).map_err(|_| StatusCode::BAD_REQUEST)?;
        let r = lookup(id)
            .send()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if !r.status().is_success() {
            return Err(r.status());
        }
        r.json()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
    } else {
        let native = path == "/v1/responses" || path == "/mcp";
        let (target, operation, input) = match (parts.method.as_str(), segments.as_slice()) {
            ("POST", ["v1", "responses"]) => (
                a.native_routes.target("model.responses")?,
                "model.responses",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["mcp"]) => (
                a.native_routes.target("mcp")?,
                "mcp",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("GET", ["mcp"]) => return Err(StatusCode::METHOD_NOT_ALLOWED),
            ("POST", ["db", "queries"]) => (
                selected_target_or(&parts.headers, "company")?,
                "db.read",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["db", "transactions"]) => (
                selected_target_or(&parts.headers, "company")?,
                "db.write",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["credential-disables"]) => (
                selected_target(&parts.headers)?,
                "credential.disable",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["credential-enrollments"]) => (
                selected_target(&parts.headers)?,
                "credential.enroll",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["uploads"]) => (
                selected_target(&parts.headers)?,
                "file.upload",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["publications"]) => (
                selected_target(&parts.headers)?,
                "file.publish",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["collections"]) => (
                selected_target(&parts.headers)?,
                "file.collect",
                serde_json::to_value(
                    serde_json::from_slice::<CollectionRequest>(&data)
                        .map_err(|_| StatusCode::BAD_REQUEST)?,
                )
                .map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["retirements"]) => (
                selected_target(&parts.headers)?,
                "file.retire",
                serde_json::to_value(
                    serde_json::from_slice::<RetirementRequest>(&data)
                        .map_err(|_| StatusCode::BAD_REQUEST)?,
                )
                .map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            ("POST", ["workspaces"]) => (
                selected_target(&parts.headers)?,
                "workspace.create",
                serde_json::from_slice(&data).map_err(|_| StatusCode::BAD_REQUEST)?,
            ),
            (
                "GET",
                [
                    "workspaces",
                    workspace,
                    "snapshots",
                    revision,
                    "files",
                    tail @ ..,
                ],
            ) if !tail.is_empty() => (
                selected_target(&parts.headers)?,
                "file.read",
                json!({"workspace_id":Uuid::parse_str(workspace).map_err(|_|StatusCode::BAD_REQUEST)?,"revision":revision.parse::<i64>().map_err(|_|StatusCode::BAD_REQUEST)?,"path":tail.join("/")}),
            ),
            _ => return Err(StatusCode::NOT_FOUND),
        };
        let key = if native || parts.method == axum::http::Method::GET {
            Uuid::new_v4().to_string()
        } else {
            parts
                .headers
                .get("idempotency-key")
                .and_then(|v| v.to_str().ok())
                .ok_or(StatusCode::BAD_REQUEST)?
                .to_owned()
        };
        if matches!(
            operation,
            "file.collect" | "credential.enroll" | "credential.disable"
        ) {
            if parts.headers.get_all("idempotency-key").iter().count() != 1 {
                return Err(StatusCode::BAD_REQUEST);
            }
            ouroboros_contracts::request_key(&key).map_err(|_| StatusCode::BAD_REQUEST)?;
        }
        if operation == "file.read" {
            file_input = Some(input.clone());
        }
        let request = ResourceRequest {
            effect_slot: service_effect_slot(&parts.headers)?,
            target: target.into(),
            operation: operation.into(),
            request_key: key,
            input,
            work_id: work,
            delegation_id: grant,
        };
        let r = context(
            a.client.post(format!("{}/resource/admissions", a.core)),
            actor,
        )
        .json(&request)
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if !r.status().is_success() {
            return Err(r.status());
        }
        r.json()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
    };
    if read {
        return Ok((StatusCode::OK, axum::Json(admitted)).into_response());
    }
    if reconcile {
        if !matches!(
            admitted.operation.as_str(),
            "file.upload"
                | "file.publish"
                | "workspace.create"
                | "file.retire"
                | "file.collect"
                | "db.write"
                | "model.responses"
                | "credential.enroll"
                | "credential.disable"
        ) {
            return Err(StatusCode::CONFLICT);
        }
        let observed = if matches!(admitted.state.as_str(), "claimed" | "succeeded") {
            let endpoint = a
                .workers
                .get(&admitted.target)
                .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
            let result = a
                .client
                .post(format!("{endpoint}/reconcile/{}", admitted.intent_id))
                .body(Vec::new())
                .send()
                .await
                .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
            if result.status() == StatusCode::ACCEPTED {
                None
            } else if result.status().is_success() {
                Some(
                    result
                        .json::<ResourceReply>()
                        .await
                        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?,
                )
            } else {
                return Err(result.status());
            }
        } else if admitted.state == "accepted" {
            // Recovery cannot dispatch an accepted operation whose effect never started.
            None
        } else {
            return Err(StatusCode::CONFLICT);
        };
        // The original business grant may now be revoked. Delivery still requires the
        // caller's current, independently valid inspect authority after observation.
        let current = lookup(admitted.intent_id)
            .send()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if !current.status().is_success() {
            return Err(current.status());
        }
        let current: ResourceAdmission = current
            .json()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        // A cached Core success cannot substitute for the source receipt this request
        // attempted to verify. Concurrent completion or missing evidence requires retry
        // or investigation; neither is proof that receipt-only reconciliation succeeded.
        if !caller.alive() {
            return Err(StatusCode::FORBIDDEN);
        }
        if observed != current.reply {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        return match current.reply {
            Some(reply) => Ok(response(admitted.intent_id, reply)),
            None => Ok((StatusCode::ACCEPTED, axum::Json(current)).into_response()),
        };
    }
    if path == "/collections" {
        if admitted.operation != "file.collect" || !caller.alive() {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        // Admission and same-key replay only describe the fixed collection. Neither starts
        // a step, even when a previously completed collection has a receipt.
        return Ok((StatusCode::ACCEPTED, axum::Json(admitted)).into_response());
    }
    if path == "/credential-enrollments" {
        // Admission never forwards secret material or starts the management worker.
        return Ok((StatusCode::ACCEPTED, axum::Json(admitted)).into_response());
    }
    if let Some(reply) = admitted.reply {
        if admitted.operation == "file.read" {
            // Read intents never replay cached binary content from the protected Core DB.
            return Err(StatusCode::CONFLICT);
        }
        return Ok(response(admitted.intent_id, reply));
    }
    if parts.method == axum::http::Method::POST && path == "/uploads" {
        return Ok((StatusCode::ACCEPTED,axum::Json(json!({"upload_id":admitted.intent_id,"intent_id":admitted.intent_id,"state":admitted.state}))).into_response());
    }
    if admitted.operation == "db.write" && admitted.state == "claimed" {
        // A lost response must not strand a caller that knows only its stable key.
        // Core has revalidated current inspection scope and exact input. Return the
        // original identity, without dispatch, retry or a claim of effect completion.
        return Ok((StatusCode::ACCEPTED, axum::Json(admitted)).into_response());
    }
    if admitted.state != "accepted" {
        return Err(StatusCode::CONFLICT);
    }
    let endpoint = a
        .workers
        .get(&admitted.target)
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let result = a
        .client
        .post(format!("{endpoint}/execute/{}", admitted.intent_id))
        .json(&json!({"content":null}))
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !result.status().is_success() {
        return Err(result.status());
    }
    if admitted.operation == "model.responses"
        && result
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            == Some("text/event-stream")
    {
        return model_stream(a, &caller, &parts.headers, admitted.intent_id, result).await;
    }
    if admitted.operation == "file.read" {
        return binary_read(
            a,
            caller,
            &parts.headers,
            admitted.intent_id,
            &admitted.target,
            file_input.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?,
            result,
        )
        .await;
    }
    let reply: ResourceReply = result
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    // Effects are recorded even if a subsequent restriction prevents delivery of their content.
    let current = lookup(admitted.intent_id)
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !current.status().is_success() {
        return Err(current.status());
    }
    Ok(response(admitted.intent_id, reply))
}

#[cfg(test)]
mod workspace_tests {
    use super::*;
    use crate::identity::Actor;
    use axum::{Router, extract::State};
    use std::sync::{Arc, Mutex};

    #[test]
    fn effect_slot_is_one_bounded_name_and_never_a_caller_context() {
        let mut headers = HeaderMap::new();
        assert_eq!(service_effect_slot(&headers).unwrap(), None);
        let header = ouroboros_contracts::SERVICE_EFFECT_SLOT_HEADER;
        for invalid in ["", "*", "root:child", "a/b", "snapshot,write"] {
            headers.insert(header, invalid.parse().unwrap());
            assert_eq!(service_effect_slot(&headers), Err(StatusCode::BAD_REQUEST));
        }
        headers.insert(header, "snapshot".parse().unwrap());
        assert_eq!(
            service_effect_slot(&headers).unwrap(),
            Some("snapshot".into())
        );
        headers.append(header, "write".parse().unwrap());
        assert_eq!(service_effect_slot(&headers), Err(StatusCode::BAD_REQUEST));
    }

    #[tokio::test]
    async fn gateway_forwards_only_slot_and_its_authenticated_identity() {
        let (app, f, _server) = fixture_with_operation("db.read").await;
        let mut request = f.request(
            "POST",
            "/db/queries",
            "company-db",
            Body::from("{\"query\":\"read_input\"}"),
        );
        request.headers_mut().insert(
            ouroboros_contracts::SERVICE_EFFECT_SLOT_HEADER,
            "snapshot".parse().unwrap(),
        );
        request
            .headers_mut()
            .insert("x-ouro-effective-caller", "forged-owner".parse().unwrap());
        request.headers_mut().insert(
            "x-ouro-root-intent",
            Uuid::new_v4().to_string().parse().unwrap(),
        );
        inner(&app, caller(), request).await.unwrap();
        let calls = f.calls.lock().unwrap();
        let (path, headers, body) = &calls[0];
        assert_eq!(path, "/resource/admissions");
        assert_eq!(body["effect_slot"], "snapshot");
        assert_eq!(body["target"], "company-db");
        assert_eq!(headers["x-ouro-client-fingerprint"], "registered-human");
        assert!(!headers.contains_key("x-ouro-effective-caller"));
        assert!(!headers.contains_key("x-ouro-root-intent"));
        assert!(body.get("root_intent_id").is_none());
    }

    #[derive(Clone)]
    struct Fixture {
        operation: &'static str,
        initial_state: &'static str,
        intent: Uuid,
        workspace: Uuid,
        namespace: Uuid,
        work: Uuid,
        grant: Uuid,
        calls: Arc<Mutex<Vec<(String, HeaderMap, serde_json::Value)>>>,
    }
    impl Fixture {
        fn summary(&self) -> serde_json::Value {
            json!({"workspace_id":self.workspace,"namespace_id":self.namespace,
                "work_id":self.work,"target_id":"company-files","label":"Research output",
                "state":"active","creation_intent_id":self.intent})
        }
        fn reply(&self) -> ResourceReply {
            if self.operation == "file.retire" {
                return ResourceReply {
                    status: 200,
                    content_type: "application/json".into(),
                    body: json!({"intent_id":self.intent,"disposition":"retained"}).to_string(),
                    receipt: json!({"source":"catalog","intent_id":self.intent}),
                };
            }
            ResourceReply {
                status: 201,
                content_type: "application/json".into(),
                body: self.summary().to_string(),
                receipt: json!({"source":"catalog","workspace_id":self.workspace}),
            }
        }
        fn admission(&self, completed: bool) -> serde_json::Value {
            json!({"intent_id":self.intent,"operation":self.operation,"target":"company-files",
                "state":if completed {"succeeded"}else{self.initial_state},
                "reply":if completed {Some(self.reply())}else{None},
                "workspace":if self.operation == "workspace.create" {
                    Some(json!({"workspace_id":self.workspace,"namespace_id":self.namespace}))
                } else { None }})
        }
        fn request(&self, method: &str, path: &str, target: &str, body: Body) -> Request<Body> {
            Request::builder()
                .method(method)
                .uri(path)
                .header("x-ouro-work-id", self.work.to_string())
                .header("x-ouro-delegation-id", self.grant.to_string())
                .header("x-ouro-resource-target", target)
                .header("x-ouro-client-fingerprint", "caller-cannot-select-identity")
                .header("idempotency-key", "create-workspace")
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
    async fn fixture() -> (App, Fixture, Server) {
        fixture_with_operation("workspace.create").await
    }
    async fn fixture_with_operation(operation: &'static str) -> (App, Fixture, Server) {
        fixture_with_state(operation, "accepted").await
    }
    async fn fixture_with_state(
        operation: &'static str,
        initial_state: &'static str,
    ) -> (App, Fixture, Server) {
        async fn mock(State(f): State<Fixture>, request: Request<Body>) -> Response {
            let (parts, body) = request.into_parts();
            let data = to_bytes(body, 65536).await.unwrap();
            let input = if data.is_empty() {
                json!(null)
            } else {
                serde_json::from_slice(&data).unwrap()
            };
            let path = parts.uri.path().to_owned();
            f.calls
                .lock()
                .unwrap()
                .push((path.clone(), parts.headers, input));
            let result = if path == "/resource/admissions" {
                f.admission(false)
            } else if path == format!("/resource/lookup/{}", f.intent) {
                f.admission(true)
            } else if path == format!("/execute/{}", f.intent)
                || path == format!("/reconcile/{}", f.intent)
            {
                serde_json::to_value(f.reply()).unwrap()
            } else if path == "/resource/workspaces/list" {
                json!({"items":[f.summary()],"next_cursor":"next-opaque","authority_revision":7,"event_sequence":11})
            } else if path == format!("/resource/workspaces/{}", f.workspace)
                || path
                    == format!(
                        "/resource/workspaces/{}/publications/{}",
                        f.workspace, f.intent
                    )
            {
                f.summary()
            } else {
                return StatusCode::NOT_FOUND.into_response();
            };
            axum::Json(result).into_response()
        }
        let f = Fixture {
            operation,
            initial_state,
            intent: Uuid::new_v4(),
            workspace: Uuid::new_v4(),
            namespace: Uuid::new_v4(),
            work: Uuid::new_v4(),
            grant: Uuid::new_v4(),
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
        let a = App {
            recovery: None,
            native_routes: Default::default(),
            client: reqwest::Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(2))
                .build()
                .unwrap(),
            core: endpoint.clone(),
            workers: [("company-files".to_owned(), endpoint)]
                .into_iter()
                .collect(),
        };
        (a, f, server)
    }

    fn caller() -> ManagementCaller {
        ManagementCaller {
            actor: Actor::Human("registered-human".into()),
            #[cfg(target_os = "linux")]
            peer: None,
        }
    }

    #[test]
    fn file_target_requires_one_identifier_and_preserves_the_legacy_default() {
        let mut headers = HeaderMap::new();
        assert_eq!(selected_target(&headers).unwrap(), "catalog");
        for invalid in [
            "",
            "https://service",
            "../catalog",
            "catalog,company-files",
            " catalog",
            "a/b",
        ] {
            headers.insert("x-ouro-resource-target", invalid.parse().unwrap());
            assert_eq!(selected_target(&headers), Err(StatusCode::BAD_REQUEST));
        }
        headers.insert("x-ouro-resource-target", "company-files".parse().unwrap());
        assert_eq!(selected_target(&headers).unwrap(), "company-files");
        headers.append("x-ouro-resource-target", "catalog".parse().unwrap());
        assert_eq!(selected_target(&headers), Err(StatusCode::BAD_REQUEST));
    }

    #[tokio::test]
    async fn pending_db_replay_returns_identity_without_dispatch_or_reconciliation() {
        let (app, f, _server) = fixture_with_state("db.write", "claimed").await;
        for _ in 0..2 {
            let request = f.request(
                "POST",
                "/db/transactions",
                "company",
                Body::from(r#"{"operation":"record_result","parameters":{"marker":"retained"}}"#),
            );
            let result = inner(&app, caller(), request).await.unwrap();
            assert_eq!(result.status(), StatusCode::ACCEPTED);
            let value: serde_json::Value =
                serde_json::from_slice(&to_bytes(result.into_body(), 65536).await.unwrap())
                    .unwrap();
            assert_eq!(value["intent_id"], json!(f.intent));
            assert_eq!(value["state"], "claimed");
            assert!(value["reply"].is_null());
            assert!(value.get("result_id").is_none());
        }
        let calls = f.calls.lock().unwrap();
        assert_eq!(calls.len(), 2);
        assert!(
            calls
                .iter()
                .all(|(path, _, _)| path == "/resource/admissions")
        );
        assert!(
            calls
                .iter()
                .all(|(_, headers, _)| headers["x-ouro-client-fingerprint"] == "registered-human")
        );
    }

    #[tokio::test]
    async fn workspace_create_uses_registered_target_and_reconcile_uses_original_target() {
        let (app, f, _server) = fixture().await;
        let request = f.request(
            "POST",
            "/workspaces",
            "company-files",
            Body::from(r#"{"label":"Research output"}"#),
        );
        let result = inner(&app, caller(), request).await.unwrap();
        assert_eq!(result.status(), StatusCode::CREATED);
        let value: serde_json::Value =
            serde_json::from_slice(&to_bytes(result.into_body(), 65536).await.unwrap()).unwrap();
        assert_eq!(value, f.summary());
        let request = f.request(
            "POST",
            &format!("/resource-intents/{}/reconcile", f.intent),
            "different-unregistered-target",
            Body::empty(),
        );
        assert_eq!(
            inner(&app, caller(), request).await.unwrap().status(),
            StatusCode::CREATED
        );
        let calls = f.calls.lock().unwrap();
        let (_, headers, admission) = &calls[0];
        assert_eq!(headers["x-ouro-client-fingerprint"], "registered-human");
        assert!(!headers.contains_key("x-ouro-resource-target"));
        assert_eq!(admission["target"], "company-files");
        assert_eq!(admission["operation"], "workspace.create");
        assert_eq!(admission["input"], json!({"label":"Research output"}));
        assert_eq!(admission["work_id"], json!(f.work));
        assert!(
            calls
                .iter()
                .any(|(path, _, _)| path == &format!("/reconcile/{}", f.intent))
        );
    }

    #[tokio::test]
    async fn retirement_preserves_explicit_policy_and_recovers_from_original_target() {
        let (app, f, _server) = fixture_with_operation("file.retire").await;
        let input = json!({
            "target":{"kind":"workspace_close","workspace_id":f.workspace,"expected_revision":3},
            "reason":"The work no longer needs a writable workspace",
            "policy_id":Uuid::new_v4(),"policy_revision":4,
        });
        let request = f.request(
            "POST",
            "/retirements",
            "company-files",
            Body::from(input.to_string()),
        );
        assert_eq!(
            inner(&app, caller(), request).await.unwrap().status(),
            StatusCode::OK
        );
        let request = f.request(
            "POST",
            &format!("/resource-intents/{}/reconcile", f.intent),
            "different-unregistered-target",
            Body::empty(),
        );
        assert_eq!(
            inner(&app, caller(), request).await.unwrap().status(),
            StatusCode::OK
        );
        let calls = f.calls.lock().unwrap();
        let (_, headers, admission) = &calls[0];
        assert_eq!(admission["operation"], "file.retire");
        assert_eq!(admission["target"], "company-files");
        assert_eq!(admission["input"], input);
        assert_eq!(headers["x-ouro-client-fingerprint"], "registered-human");
        assert!(
            calls
                .iter()
                .any(|(path, _, _)| path == &format!("/reconcile/{}", f.intent))
        );
    }

    #[tokio::test]
    async fn retirement_rejects_ambiguous_selector_and_physical_delete_payloads() {
        let (app, f, _server) = fixture_with_operation("file.retire").await;
        let input = json!({"target":{"kind":"upload","upload_id":Uuid::new_v4()},
            "reason":"Superseded input","policy_id":Uuid::new_v4(),"policy_revision":1});
        let mut duplicate = f.request(
            "POST",
            "/retirements",
            "company-files",
            Body::from(input.to_string()),
        );
        duplicate
            .headers_mut()
            .append("x-ouro-resource-target", "other".parse().unwrap());
        assert_eq!(
            inner(&app, caller(), duplicate).await.unwrap_err(),
            StatusCode::BAD_REQUEST
        );
        for target in [
            json!({"kind":"path","path":"/data/file"}),
            json!({"kind":"upload","upload_id":Uuid::new_v4(),"sha256":"caller-cannot-select-bytes"}),
        ] {
            let mut invalid = input.clone();
            invalid["target"] = target;
            let request = f.request(
                "POST",
                "/retirements",
                "company-files",
                Body::from(invalid.to_string()),
            );
            assert_eq!(
                inner(&app, caller(), request).await.unwrap_err(),
                StatusCode::BAD_REQUEST
            );
        }
        assert!(f.calls.lock().unwrap().is_empty());
        assert!(is_resource("/retirements"));
        assert!(!is_resource("/retirements/delete"));
    }

    #[tokio::test]
    async fn historical_publication_forwards_exact_reference_and_current_scope() {
        let (app, f, _server) = fixture().await;
        let path = format!("/workspaces/{}/publications/{}", f.workspace, f.intent);
        let response = inner(
            &app,
            caller(),
            f.request("GET", &path, "company-files", Body::empty()),
        )
        .await
        .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let calls = f.calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(
            calls[0].0,
            format!(
                "/resource/workspaces/{}/publications/{}",
                f.workspace, f.intent
            )
        );
        assert_eq!(calls[0].1["x-ouro-client-fingerprint"], "registered-human");
        assert_eq!(
            calls[0].2,
            json!({"work_id":f.work,"delegation_id":f.grant,"target_id":"company-files","cursor":null})
        );
    }

    #[tokio::test]
    async fn workspace_list_and_show_preserve_authenticated_scope_and_opaque_cursor() {
        let (app, f, _server) = fixture().await;
        let list = f.request(
            "GET",
            "/workspaces?cursor=opaque%2B%2F%3D",
            "company-files",
            Body::empty(),
        );
        let result = inner(&app, caller(), list).await.unwrap();
        let page: serde_json::Value =
            serde_json::from_slice(&to_bytes(result.into_body(), 65536).await.unwrap()).unwrap();
        assert_eq!(page["items"], json!([f.summary()]));
        assert_eq!(page["next_cursor"], "next-opaque");
        assert_eq!(page["authority_revision"], 7);
        let show = f.request(
            "GET",
            &format!("/workspaces/{}", f.workspace),
            "company-files",
            Body::empty(),
        );
        assert_eq!(
            inner(&app, caller(), show).await.unwrap().status(),
            StatusCode::OK
        );
        let calls = f.calls.lock().unwrap();
        assert_eq!(calls[0].0, "/resource/workspaces/list");
        assert_eq!(
            calls[0].2,
            json!({"work_id":f.work,"delegation_id":f.grant,"target_id":"company-files","cursor":"opaque+/="})
        );
        assert_eq!(calls[1].2["cursor"], serde_json::Value::Null);
        for (_, headers, _) in calls.iter() {
            assert_eq!(headers["x-ouro-client-fingerprint"], "registered-human");
        }
    }

    #[test]
    fn cursor_cannot_smuggle_another_selector_or_reach_mutation_routes() {
        for uri in [
            "/workspaces?cursor=a&target_id=other",
            "/workspaces?cursor=a&cursor=b",
            "/workspaces?cursor=",
            "/uploads?cursor=a",
        ] {
            assert_eq!(
                workspace_cursor(&Method::GET, &uri.parse().unwrap()),
                Err(StatusCode::BAD_REQUEST)
            );
        }
        assert_eq!(
            workspace_cursor(&Method::POST, &"/workspaces?cursor=a".parse().unwrap()),
            Err(StatusCode::BAD_REQUEST)
        );
    }
}
