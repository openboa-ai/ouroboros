#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod company_views;
use company_views::*;
use ouroboros_contracts::{OWNER_BINDING_HEADER, OwnerBinding};
use ouroboros_transport::TlsFiles;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};
use tauri::{Manager, State};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Profile {
    gateway_url: String,
    tls: TlsFiles,
    #[serde(default = "default_catalog_target")]
    catalog_target: String,
}
#[derive(Clone)]
struct Gateway {
    client: reqwest::Client,
    base: String,
    catalog_target: String,
    connection_generation: String,
    binding: Arc<OnceLock<OwnerBinding>>,
}
#[derive(Default)]
struct Connection(Mutex<Option<Gateway>>);
// Process-local freshness is separate from persisted environment/outbox identity.
fn next_connection_generation() -> String {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    format!(
        "{}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    )
}
impl Gateway {
    fn observed_binding(&self) -> Result<&OwnerBinding, String> {
        self.binding
            .get()
            .ok_or_else(|| "Verify the operating environment before using this connection.".into())
    }
    fn pin_conditions(&self, conditions: &Value) -> Result<(), String> {
        let binding: OwnerBinding = serde_json::from_value(conditions["owner_binding"].clone())
            .map_err(|_| "The server does not provide a verified environment binding.")?;
        if conditions["firm_id"] != json!(binding.firm_id)
            || conditions["principal_id"] != json!(binding.principal_id)
            || conditions["environment_id"] != json!(binding.environment_id)
        {
            return Err("The observed environment identity is inconsistent.".into());
        }
        let _ = self.binding.set(binding.clone());
        if self.observed_binding()? != &binding {
            return Err(
                "The operating environment changed. Reconnect explicitly to inspect it.".into(),
            );
        }
        Ok(())
    }
    fn bound_request(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<reqwest::RequestBuilder, String> {
        let encoded = serde_json::to_string(self.observed_binding()?)
            .map_err(|_| "Invalid environment binding.")?;
        Ok(request.header(OWNER_BINDING_HEADER, encoded))
    }
    fn check_scope_connection(&self, expected: Option<&str>, required: bool) -> Result<(), String> {
        match expected {
            Some(value) => self.check_connection(value),
            None if required => Err("An observed connection generation is required.".into()),
            None => Ok(()),
        }
    }
    fn check_connection(&self, expected: &str) -> Result<(), String> {
        if expected != self.connection_generation {
            return Err(
                "The connection changed. Refresh before acting or checking the retained request."
                    .into(),
            );
        }
        Ok(())
    }

    fn load(path: &std::path::Path) -> Result<Self, String> {
        let (mut p, root) = ouroboros_transport::config::load::<Profile>(path)
            .map_err(|_| "The connection profile could not be read.".to_string())?;
        p.tls
            .resolve_paths(&root)
            .map_err(|_| "Check the authentication material paths.".to_string())?;
        let url = reqwest::Url::parse(&p.gateway_url)
            .map_err(|_| "The Gateway address is invalid.".to_string())?;
        if url.scheme() != "https"
            || !url.username().is_empty()
            || url.password().is_some()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err("A fixed HTTPS Gateway address is required.".into());
        }
        target_identifier(&p.catalog_target)?;
        let client = ouroboros_transport::client(&p.tls)
            .map_err(|_| "Check the owner authentication material.".to_string())?;
        Ok(Self {
            client,
            base: p.gateway_url.trim_end_matches('/').into(),
            catalog_target: p.catalog_target,
            connection_generation: next_connection_generation(),
            binding: Arc::new(OnceLock::new()),
        })
    }
    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<Value>,
        key: Option<&str>,
    ) -> Result<Value, String> {
        let initial_conditions =
            method == reqwest::Method::GET && path == "/conditions" && self.binding.get().is_none();
        let mut r = self
            .client
            .request(method, format!("{}{path}", self.base))
            .timeout(std::time::Duration::from_secs(20));
        if !initial_conditions {
            r = self.bound_request(r)?;
        }
        if let Some(b) = body {
            r = r.json(&b);
        }
        if let Some(k) = key {
            if k.is_empty() || k.len() > 128 || !k.bytes().all(|b| b.is_ascii_graphic()) {
                return Err("The request reference is invalid.".into());
            }
            r = r.header("idempotency-key", k);
        }
        let mut response=r.send().await.map_err(|_|"Gateway response unavailable. The outcome is unknown; query the original request reference.".to_string())?;
        let status = response.status();
        if !status.is_success() {
            return Err(match status.as_u16() {
                401 | 403 => "The current identity or delegation does not allow access.",
                409 => "The environment or target revision changed. Reconnect or review the current record before acting.",
                404 => "The record is missing or outside the current access scope.",
                _ => "The server outcome is unknown. The original request reference is retained.",
            }
            .into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Response delivery was interrupted.".to_string())?
        {
            if bytes.len() + chunk.len() > 8 * 1024 * 1024 {
                return Err("The response exceeds the size limit.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        let value: Value = serde_json::from_slice(&bytes)
            .map_err(|_| "The server response format is unsupported.")?;
        if path == "/conditions" {
            self.pin_conditions(&value)?;
        }
        Ok(value)
    }
}
fn gateway(s: &State<Connection>) -> Result<Gateway, String> {
    s.0.lock()
        .map_err(|_| "The connection state is unavailable.")?
        .clone()
        .ok_or_else(|| "Connect an operating environment first.".into())
}
/// Explicit user reconnection; periodic refresh never resets a pinned server binding.
#[tauri::command]
async fn connect_saved_profile(
    app: tauri::AppHandle,
    s: State<'_, Connection>,
) -> Result<Value, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "The Mac settings location is unavailable.")?;
    let bytes = std::fs::read(dir.join("connection-reference.json"))
        .map_err(|_| "Select a connection profile first.")?;
    let path: PathBuf =
        serde_json::from_slice(&bytes).map_err(|_| "The saved profile reference is invalid.")?;
    let candidate = Gateway::load(&path)?;
    let conditions = candidate
        .request(reqwest::Method::GET, "/conditions", None, None)
        .await?;
    company_views::clear_all(&app);
    *s.0.lock()
        .map_err(|_| "The connection could not be retained.")? = Some(candidate);
    Ok(json!({"name":"Ouroboros","firm_id":conditions["firm_id"]}))
}

#[tauri::command]
async fn connect_profile(app: tauri::AppHandle, s: State<'_, Connection>) -> Result<Value, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Select an Ouroboros owner connection profile")
        .add_filter("Connection profile", &["json"])
        .pick_file()
        .await
        .ok_or_else(|| "Profile selection was cancelled.".to_string())?;
    let path = file.path().to_path_buf();
    let candidate = Gateway::load(&path)?;
    let conditions = candidate
        .request(reqwest::Method::GET, "/conditions", None, None)
        .await?;
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|_| "The Mac settings location is unavailable.")?;
    std::fs::create_dir_all(&dir).map_err(|_| "The connection reference could not be saved.")?;
    std::fs::write(
        dir.join("connection-reference.json"),
        serde_json::to_vec(&path).map_err(|_| "Invalid profile reference format")?,
    )
    .map_err(|_| "The connection reference could not be saved.")?;
    company_views::clear_all(&app);
    *s.0.lock()
        .map_err(|_| "The connection could not be retained.")? = Some(candidate);
    Ok(json!({"name":"Ouroboros","firm_id":conditions["firm_id"]}))
}
fn identifier(value: &str) -> Result<(), String> {
    if value.len() != 36
        || !value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
    {
        return Err("Invalid record reference.".into());
    }
    Ok(())
}
fn unavailable(error: String) -> Value {
    json!({"unavailable":true,"message":error})
}
fn default_catalog_target() -> String {
    "catalog".into()
}
fn target_identifier(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 128
        || !value.as_bytes()[0].is_ascii_alphanumeric()
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
    {
        return Err("Invalid Catalog target reference.".into());
    }
    Ok(())
}
fn artifact_path(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 1024
        || value.contains(['\\', '\0'])
        || value
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("Invalid published file path.".into());
    }
    Ok(())
}
fn request_reference(value: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > 128 || !value.bytes().all(|byte| byte.is_ascii_graphic()) {
        return Err("Invalid request reference.".into());
    }
    Ok(())
}
#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct CatalogScope {
    work_id: String,
    delegation_id: String,
    target_id: String,
    #[serde(default)]
    expected_environment_id: Option<String>,
    #[serde(default)]
    connection_generation: Option<String>,
}
impl CatalogScope {
    fn validate(&self) -> Result<(), String> {
        identifier(&self.work_id)?;
        identifier(&self.delegation_id)?;
        target_identifier(&self.target_id)
    }
    fn apply(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        request
            .header("x-ouro-work-id", &self.work_id)
            .header("x-ouro-delegation-id", &self.delegation_id)
            .header("x-ouro-resource-target", &self.target_id)
    }
}
impl Gateway {
    fn check_environment(&self, expected: Option<&str>, required: bool) -> Result<(), String> {
        let actual = self.observed_binding()?.environment_id.to_string();
        if expected.is_some_and(|value| value != actual) || (required && expected.is_none()) {
            return Err("The connection changed. Return to the original environment to inspect the retained request.".into());
        }
        Ok(())
    }
    fn url(&self, segments: &[&str], cursor: Option<&str>) -> Result<reqwest::Url, String> {
        let mut url = reqwest::Url::parse(&self.base).map_err(|_| "Invalid Gateway address")?;
        {
            let mut path = url
                .path_segments_mut()
                .map_err(|_| "Invalid Gateway address")?;
            path.clear();
            path.extend(segments);
        }
        if let Some(cursor) = cursor {
            if cursor.is_empty() || cursor.len() > 4096 {
                return Err("Invalid continuation reference.".into());
            }
            url.query_pairs_mut().append_pair("cursor", cursor);
        }
        Ok(url)
    }
    async fn scoped_json(
        &self,
        scope: &CatalogScope,
        method: reqwest::Method,
        segments: &[&str],
        cursor: Option<&str>,
        body: Option<Value>,
        key: Option<&str>,
        content: Option<Vec<u8>>,
    ) -> Result<Value, String> {
        scope.validate()?;
        self.check_environment(
            scope.expected_environment_id.as_deref(),
            method != reqwest::Method::GET,
        )?;
        self.check_scope_connection(
            scope.connection_generation.as_deref(),
            method != reqwest::Method::GET,
        )?;
        let mut request = scope
            .apply(self.client.request(method, self.url(segments, cursor)?))
            .timeout(std::time::Duration::from_secs(20));
        request = self.bound_request(request)?;
        if let Some(key) = key {
            request_reference(key)?;
            request = request.header("idempotency-key", key);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        if let Some(content) = content {
            request = request
                .header("content-type", "application/octet-stream")
                .body(content);
        }
        let mut response=request.send().await.map_err(|_|"Catalog outcome unknown. Retain the original key and inspect its receipt before another operation.")?;
        if !response.status().is_success() {
            return Err(match response.status().as_u16(){
            403=>"The current identity or Catalog scope does not allow access.",
            409=>"The Catalog revision or original request changed. Re-read the recorded publication and pending effects.",
            404=>"The requested Catalog record is not available.",
            _=>"Catalog outcome unknown. The original request reference must be retained.",
        }.into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Catalog reply interrupted; the effect may already exist.")?
        {
            if bytes.len().saturating_add(chunk.len()) > 2 * 1024 * 1024 {
                return Err("Catalog reply exceeds the limit.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&bytes).map_err(|_| "Catalog reply format is unsupported.".into())
    }
    async fn artifact_bytes(&self, artifact: &Artifact) -> Result<(Vec<u8>, String), String> {
        identifier(&artifact.workspace_id)?;
        artifact_path(&artifact.path)?;
        if artifact.revision < 0 {
            return Err("Invalid published revision.".into());
        }
        let scope = artifact.scope();
        scope.validate()?;
        self.check_environment(scope.expected_environment_id.as_deref(), false)?;
        self.check_scope_connection(scope.connection_generation.as_deref(), false)?;
        let revision = artifact.revision.to_string();
        let mut segments = vec![
            "workspaces",
            &artifact.workspace_id,
            "snapshots",
            &revision,
            "files",
        ];
        segments.extend(artifact.path.split('/'));
        let mut response = self
            .bound_request(scope.apply(self.client.get(self.url(&segments, None)?)))?
            .timeout(std::time::Duration::from_secs(20))
            .send()
            .await
            .map_err(|_| "Published file read is unavailable.")?;
        if !response.status().is_success() {
            return Err("Published revision is missing, retired, or outside current scope.".into());
        }
        let size = response
            .headers()
            .get("content-length")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|size| *size <= 8 * 1024 * 1024)
            .ok_or("Published file size was not verified.")?;
        let digest = response
            .headers()
            .get("x-ouro-content-sha256")
            .and_then(|value| value.to_str().ok())
            .filter(|value| valid_digest(value))
            .ok_or("Published file digest was not verified.")?
            .to_owned();
        let mut bytes = Vec::with_capacity(size);
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Published file delivery was interrupted.")?
        {
            if bytes.len().saturating_add(chunk.len()) > size {
                return Err("Published file exceeded its declared size.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        if bytes.len() != size || format!("{:x}", Sha256::digest(&bytes)) != digest {
            return Err("Published file verification failed.".into());
        }
        Ok((bytes, digest))
    }
}
fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
fn gateway_for_scope(s: &State<Connection>, scope: &CatalogScope) -> Result<Gateway, String> {
    let g = gateway(s)?;
    g.check_environment(scope.expected_environment_id.as_deref(), true)?;
    g.check_scope_connection(scope.connection_generation.as_deref(), true)?;
    Ok(g)
}

#[tauri::command]
async fn catalog_workspaces(
    s: State<'_, Connection>,
    scope: CatalogScope,
    cursor: Option<String>,
) -> Result<Value, String> {
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            reqwest::Method::GET,
            &["workspaces"],
            cursor.as_deref(),
            None,
            None,
            None,
        )
        .await
}
#[tauri::command]
async fn catalog_workspace(
    s: State<'_, Connection>,
    scope: CatalogScope,
    workspace_id: String,
) -> Result<Value, String> {
    identifier(&workspace_id)?;
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            reqwest::Method::GET,
            &["workspaces", &workspace_id],
            None,
            None,
            None,
            None,
        )
        .await
}
#[tauri::command]
fn prepare_catalog_upload(content: String) -> Result<Value, String> {
    if content.len() > 1024 * 1024 {
        return Err("Company configuration exceeds the document limit.".into());
    }
    Ok(json!({"size":content.len(),"sha256":format!("{:x}",Sha256::digest(content.as_bytes()))}))
}
#[tauri::command]
async fn catalog_upload(
    s: State<'_, Connection>,
    scope: CatalogScope,
    request_key: String,
    size: u64,
    sha256: String,
) -> Result<Value, String> {
    if size > 1024 * 1024 || !valid_digest(&sha256) {
        return Err("Invalid bounded document upload.".into());
    }
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            reqwest::Method::POST,
            &["uploads"],
            None,
            Some(json!({"size":size,"sha256":sha256})),
            Some(&request_key),
            None,
        )
        .await
}
#[tauri::command]
async fn catalog_upload_content(
    s: State<'_, Connection>,
    scope: CatalogScope,
    upload_id: String,
    content: String,
) -> Result<Value, String> {
    identifier(&upload_id)?;
    if content.len() > 1024 * 1024 {
        return Err("Company configuration exceeds the document limit.".into());
    }
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            reqwest::Method::PUT,
            &["uploads", &upload_id, "content"],
            None,
            None,
            None,
            Some(content.into_bytes()),
        )
        .await
}
#[tauri::command]
async fn catalog_publish(
    s: State<'_, Connection>,
    scope: CatalogScope,
    request_key: String,
    workspace_id: String,
    expected_revision: i64,
    files: std::collections::BTreeMap<String, String>,
) -> Result<Value, String> {
    identifier(&workspace_id)?;
    if expected_revision < 0 || files.len() > 128 {
        return Err("Invalid Catalog publication revision or manifest size.".into());
    }
    for (path, upload) in &files {
        artifact_path(path)?;
        identifier(upload)?;
    }
    // expected_revision belongs to Catalog. It is unrelated to Core authority_revision.
    gateway_for_scope(&s,&scope)?.scoped_json(&scope,reqwest::Method::POST,&["publications"],None,Some(json!({"workspace_id":workspace_id,"expected_revision":expected_revision,"files":files})),Some(&request_key),None).await
}
#[tauri::command]
async fn catalog_resource_receipt(
    s: State<'_, Connection>,
    scope: CatalogScope,
    intent_id: String,
    reconcile: bool,
) -> Result<Value, String> {
    identifier(&intent_id)?;
    let segments = if reconcile {
        vec!["resource-intents", &intent_id, "reconcile"]
    } else {
        vec!["resource-intents", &intent_id]
    };
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            if reconcile {
                reqwest::Method::POST
            } else {
                reqwest::Method::GET
            },
            &segments,
            None,
            None,
            None,
            None,
        )
        .await
}
#[tauri::command]
async fn read_artifact(s: State<'_, Connection>, artifact: Artifact) -> Result<Value, String> {
    let (bytes, sha256) = gateway_for_scope(&s, &artifact.scope())?
        .artifact_bytes(&artifact)
        .await?;
    if bytes.len() > 1024 * 1024 {
        return Err("The document is too large to preview.".into());
    }
    let content = String::from_utf8(bytes).map_err(|_| "This file requires a binary download.")?;
    Ok(
        json!({"workspace_id":artifact.workspace_id,"revision":artifact.revision,"path":artifact.path,
        "target_id":artifact.target_id,"size":content.len(),"sha256":sha256,"content":content}),
    )
}
#[tauri::command]
async fn notifications(
    s: State<'_, Connection>,
    expected_environment_id: String,
    connection_generation: String,
    cursor: Option<String>,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_environment(Some(&expected_environment_id), true)?;
    g.check_connection(&connection_generation)?;
    let url = g.url(&["notifications"], cursor.as_deref())?;
    let path = match url.query() {
        Some(query) => format!("{}?{}", url.path(), query),
        None => url.path().into(),
    };
    g.request(reqwest::Method::GET, &path, None, None).await
}
#[tauri::command]
async fn read_notifications(
    s: State<'_, Connection>,
    expected_environment_id: String,
    connection_generation: String,
    ids: Vec<String>,
) -> Result<Value, String> {
    if ids.is_empty()
        || ids.len() > 100
        || ids.iter().any(|id| {
            id.strip_prefix("event:")
                .and_then(|s| s.parse::<i64>().ok())
                .is_none_or(|sequence| sequence < 1)
        })
    {
        return Err("Choose up to 100 recorded notifications.".into());
    }
    let g = gateway(&s)?;
    g.check_environment(Some(&expected_environment_id), true)?;
    g.check_connection(&connection_generation)?;
    g.request(
        reqwest::Method::POST,
        "/notifications/read",
        Some(json!({"ids":ids})),
        None,
    )
    .await
}
async fn observe_workspaces(g: &Gateway, work: &Value) -> Value {
    let result:Result<Value,String>=async {
        let scope=CatalogScope {work_id:work["id"].as_str().ok_or("Missing work scope")?.into(),
            delegation_id:work["delegation_id"].as_str().ok_or("Missing work delegation")?.into(),target_id:g.catalog_target.clone(),expected_environment_id:None,connection_generation:None};
        let listed=g.scoped_json(&scope,reqwest::Method::GET,&["workspaces"],None,None,None,None).await?;
        let allocated=listed["items"].as_array().ok_or("Invalid workspace list")?;
        let mut items=Vec::new();
        for item in allocated.iter().take(10) {
            let id=item["workspace_id"].as_str().ok_or("Invalid workspace reference")?;identifier(id)?;
            let mut detail=g.scoped_json(&scope,reqwest::Method::GET,&["workspaces",id],None,None,None,None).await.unwrap_or_else(unavailable);
            if detail["unavailable"]==true {detail["workspace_id"]=json!(id);}
            detail["read_scope"]=json!({"work_id":scope.work_id,"delegation_id":scope.delegation_id,"target_id":scope.target_id});
            items.push(detail);
        }
        Ok(json!({"items":items,"next_cursor":listed["next_cursor"],"has_more":!listed["next_cursor"].is_null() || allocated.len()>10,
            "listed_in_page":allocated.len(),"target_id":scope.target_id,"authority_revision":listed["authority_revision"]}))
    }.await;
    result.unwrap_or_else(unavailable)
}

#[tauri::command]
async fn catalog_publication(
    s: State<'_, Connection>,
    scope: CatalogScope,
    workspace_id: String,
    intent_id: String,
) -> Result<Value, String> {
    identifier(&workspace_id)?;
    identifier(&intent_id)?;
    gateway_for_scope(&s, &scope)?
        .scoped_json(
            &scope,
            reqwest::Method::GET,
            &["workspaces", &workspace_id, "publications", &intent_id],
            None,
            None,
            None,
            None,
        )
        .await
}

#[tauri::command]
async fn company_snapshot(s: State<'_, Connection>) -> Result<Value, String> {
    let g = gateway(&s)?;
    let conditions = g
        .request(reqwest::Method::GET, "/conditions", None, None)
        .await?;
    let work = g.request(reqwest::Method::GET, "/work", None, None).await?;
    let mut observations = Vec::new();
    if let Some(items) = work["items"].as_array() {
        for w in items.iter().take(20) {
            let id = w["id"].as_str().ok_or("Invalid work response")?;
            identifier(id)?;
            let executions_path = format!("/work/{id}/executions");
            let activity_path = format!("/work/{id}/activity");
            let rooms_path = format!("/work/{id}/conversations");
            let services_path = format!("/work/{id}/service-continuations");
            let (executions, activity, rooms, workspaces, services) = tokio::join!(
                g.request(reqwest::Method::GET, &executions_path, None, None),
                g.request(reqwest::Method::GET, &activity_path, None, None),
                g.request(reqwest::Method::GET, &rooms_path, None, None),
                observe_workspaces(&g, w),
                g.request(reqwest::Method::GET, &services_path, None, None)
            );
            observations.push(json!({"work_id":id,"executions":executions.unwrap_or_else(unavailable),
                "activity":activity.unwrap_or_else(unavailable),"rooms":rooms.unwrap_or_else(unavailable),"workspaces":workspaces,"services":services.unwrap_or_else(unavailable)}));
        }
    }
    Ok(
        json!({"schema_version":2,"source":"gateway","conditions":conditions,"work":work,"observations":observations,
        "environment_id":g.observed_binding()?.environment_id,"server_generation":g.observed_binding()?.serving_generation,"connection_generation":g.connection_generation,"catalog_target":g.catalog_target,
        "coverage":"First work page; up to 20 work observations, 25 registered call continuations and 10 workspace details per work on the configured Catalog target. Continuation and unavailable fields preserve incomplete coverage."}),
    )
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ServiceStopRequest {
    connection_generation: String,
    root_intent_id: String,
    expected_execution_id: String,
    request_key: String,
}
impl ServiceStopRequest {
    fn validate(&self, g: &Gateway) -> Result<(), String> {
        g.check_connection(&self.connection_generation)?;
        identifier(&self.root_intent_id)?;
        identifier(&self.expected_execution_id)?;
        service_request_key(&self.request_key)
    }
}
fn service_request_key(key: &str) -> Result<(), String> {
    request_reference(key)?;
    if matches!(key, "." | "..")
        || !key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
    {
        return Err("Invalid service stop reference.".into());
    }
    Ok(())
}
#[tauri::command]
async fn inspect_service_continuation(
    s: State<'_, Connection>,
    root_intent_id: String,
    connection_generation: String,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&connection_generation)?;
    identifier(&root_intent_id)?;
    let url = g.url(&["service-continuations", &root_intent_id], None)?;
    g.request(reqwest::Method::GET, url.path(), None, None)
        .await
}
#[tauri::command]
async fn stop_service_continuation(
    s: State<'_, Connection>,
    request: ServiceStopRequest,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    request.validate(&g)?;
    let url = g.url(
        &["service-continuations", &request.root_intent_id, "stop"],
        None,
    )?;
    let builder = g
        .client
        .post(url)
        .timeout(std::time::Duration::from_secs(20))
        .header("idempotency-key", &request.request_key)
        .json(&json!({"expected_execution_id":request.expected_execution_id}));
    let mut response = g
        .bound_request(builder)?
        .send()
        .await
        .map_err(|_| "The stop outcome is unresolved. Check the original request.")?;
    let status = response.status().as_u16();
    if matches!(status, 400 | 401 | 403 | 404 | 409 | 422) {
        // A definitive refusal is distinct from transport loss or a server error. No raw body
        // reaches the WebView, and even a stale target must be reviewed before a new request.
        return Ok(
            json!({"outcome":"rejected","reason":if status==409 {"target_or_environment_changed"} else {"request_not_permitted"}}),
        );
    }
    if !response.status().is_success() {
        return Err("The stop outcome is unresolved. Check the original request.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The stop receipt delivery was interrupted.")?
    {
        if bytes.len() + chunk.len() > 64 * 1024 {
            return Err("The stop receipt exceeds the size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let receipt: Value =
        serde_json::from_slice(&bytes).map_err(|_| "The stop receipt could not be verified.")?;
    if receipt["root_intent_id"] != request.root_intent_id
        || receipt["execution_id"] != request.expected_execution_id
        || receipt["restriction_recorded"] != true
    {
        return Err("The stop receipt does not match the original request.".into());
    }
    Ok(json!({"outcome":"recorded","termination_confirmed":false}))
}
#[tauri::command]
async fn service_continuation_stop_request(
    s: State<'_, Connection>,
    root_intent_id: String,
    request_key: String,
    connection_generation: String,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&connection_generation)?;
    identifier(&root_intent_id)?;
    service_request_key(&request_key)?;
    let url = g.url(
        &[
            "service-continuations",
            &root_intent_id,
            "stop-requests",
            &request_key,
        ],
        None,
    )?;
    g.request(reqwest::Method::GET, url.path(), None, None)
        .await
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct CommandRequest {
    connection_generation: String,
    request_key: String,
    kind: String,
    target_id: String,
    expected_revision: i64,
}
#[tauri::command]
async fn company_command(
    s: State<'_, Connection>,
    request: CommandRequest,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&request.connection_generation)?;
    identifier(&request.target_id)?;
    let path = match request.kind.as_str() {
        "stop_execution" => format!("/executions/{}/stop", request.target_id),
        "revoke_delegation" => format!("/delegations/{}/revoke", request.target_id),
        _ => return Err("This action is not provided by the common control plane.".into()),
    };
    g.request(
        reqwest::Method::POST,
        &path,
        Some(json!({"expected_revision":request.expected_revision})),
        Some(&request.request_key),
    )
    .await
}
#[tauri::command]
async fn command_receipt(
    s: State<'_, Connection>,
    request_key: String,
    execution_id: Option<String>,
    operation: Option<String>,
    connection_generation: String,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&connection_generation)?;
    if let Some(operation) = operation {
        request_reference(&request_key)?;
        if operation.is_empty()
            || operation.len() > 128
            || !operation
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'_')
        {
            return Err("Invalid operation reference.".into());
        }
        let mut url = g.url(&["intents", "by-request-key"], None)?;
        url.query_pairs_mut()
            .append_pair("operation", &operation)
            .append_pair("request_key", &request_key);
        g.request(
            reqwest::Method::GET,
            &format!(
                "{}?{}",
                url.path(),
                url.query().ok_or("Missing request reference")?
            ),
            None,
            None,
        )
        .await
    } else if let Some(execution) = execution_id {
        identifier(&execution)?;
        request_reference(&request_key)?;
        let url = g.url(
            &["executions", &execution, "stop-requests", &request_key],
            None,
        )?;
        g.request(reqwest::Method::GET, url.path(), None, None)
            .await
    } else {
        // Compatibility for a caller already holding the actual intent ID.
        identifier(&request_key)?;
        g.request(
            reqwest::Method::GET,
            &format!("/intents/{request_key}"),
            None,
            None,
        )
        .await
    }
}

#[tauri::command]
async fn inspect_record(
    s: State<'_, Connection>,
    kind: String,
    id: String,
    connection_generation: String,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&connection_generation)?;
    identifier(&id)?;
    if !["work", "executions", "intents", "wakes"].contains(&kind.as_str()) {
        return Err("Unsupported record kind.".into());
    }
    g.request(reqwest::Method::GET, &format!("/{kind}/{id}"), None, None)
        .await
}
#[tauri::command]
async fn ceo_messages(
    s: State<'_, Connection>,
    room_id: String,
    cursor: Option<u64>,
    connection_generation: String,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&connection_generation)?;
    identifier(&room_id)?;
    g.request(
        reqwest::Method::GET,
        &format!(
            "/conversations/{room_id}/messages?cursor={}",
            cursor.unwrap_or(0)
        ),
        None,
        None,
    )
    .await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MessageRequest {
    connection_generation: String,
    room_id: String,
    delegation_id: String,
    text: String,
    request_key: String,
    reply_to: Option<String>,
}
#[tauri::command]
async fn ceo_message(s: State<'_, Connection>, request: MessageRequest) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&request.connection_generation)?;
    identifier(&request.room_id)?;
    identifier(&request.delegation_id)?;
    if let Some(ref reply) = request.reply_to {
        identifier(reply)?;
    }
    if request.text.trim().is_empty() || request.text.len() > 16000 {
        return Err("Check the message size.".into());
    }
    g.request(reqwest::Method::POST,&format!("/conversations/{}/messages",request.room_id),Some(json!({"delegation_id":request.delegation_id,"text":request.text,"reply_to":request.reply_to})),Some(&request.request_key)).await
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DeliveryRequest {
    connection_generation: String,
    room_id: String,
    message_id: String,
    delegation_id: String,
    execution_id: String,
    thread_id: String,
    turn_id: String,
    request_key: String,
}
#[tauri::command]
async fn deliver_message(
    s: State<'_, Connection>,
    request: DeliveryRequest,
) -> Result<Value, String> {
    let g = gateway(&s)?;
    g.check_connection(&request.connection_generation)?;
    for value in [
        &request.room_id,
        &request.message_id,
        &request.delegation_id,
        &request.execution_id,
    ] {
        identifier(value)?;
    }
    if request.thread_id.len() > 256 || request.turn_id.len() > 256 {
        return Err("Invalid native turn reference.".into());
    }
    g.request(reqwest::Method::POST,&format!("/conversations/{}/messages/{}/deliver",request.room_id,request.message_id),Some(json!({"delegation_id":request.delegation_id,"execution_id":request.execution_id,"thread_id":request.thread_id,"turn_id":request.turn_id})),Some(&request.request_key)).await
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Artifact {
    workspace_id: String,
    revision: i64,
    path: String,
    work_id: String,
    delegation_id: String,
    #[serde(default = "default_catalog_target")]
    target_id: String,
    #[serde(default)]
    expected_environment_id: Option<String>,
    #[serde(default)]
    connection_generation: Option<String>,
}
impl Artifact {
    fn scope(&self) -> CatalogScope {
        CatalogScope {
            work_id: self.work_id.clone(),
            delegation_id: self.delegation_id.clone(),
            target_id: self.target_id.clone(),
            expected_environment_id: self.expected_environment_id.clone(),
            connection_generation: self.connection_generation.clone(),
        }
    }
}
#[tauri::command]
async fn save_artifact(s: State<'_, Connection>, artifact: Artifact) -> Result<String, String> {
    let g = gateway_for_scope(&s, &artifact.scope())?;
    artifact.scope().validate()?;
    identifier(&artifact.workspace_id)?;
    artifact_path(&artifact.path)?;
    if artifact.revision < 0 {
        return Err("Invalid published revision.".into());
    }
    let filename = std::path::Path::new(&artifact.path)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?;
    // Ask for a destination before causing a governed file read or allocating bytes.
    let target = rfd::AsyncFileDialog::new()
        .set_title("Save published file")
        .set_file_name(filename)
        .save_file()
        .await
        .ok_or_else(|| "File saving was cancelled.".to_string())?;
    let (content, _) = g.artifact_bytes(&artifact).await?;
    target
        .write(&content)
        .await
        .map_err(|_| "The selected file could not be saved.".to_string())?;
    Ok("The selected published revision was verified and saved.".into())
}

fn valid_copy(filename: &str, content: &str) -> bool {
    !filename.is_empty()
        && filename.len() <= 120
        && !filename.contains(['/', '\\'])
        && !filename.chars().any(char::is_control)
        && (filename.ends_with(".json") || filename.ends_with(".md"))
        && content.len() <= 1024 * 1024
}
#[tauri::command]
async fn save_copy(filename: String, content: String) -> Result<String, String> {
    if !valid_copy(&filename, &content) {
        return Err("Unsupported file copy.".into());
    }
    let target = rfd::AsyncFileDialog::new()
        .set_title("Save file copy")
        .set_file_name(&filename)
        .save_file()
        .await
        .ok_or_else(|| "File saving was cancelled.".to_string())?;
    target
        .write(content.as_bytes())
        .await
        .map_err(|_| "The selected file could not be saved.".to_string())?;
    Ok(format!("Saved {}", filename))
}
fn main() {
    tauri::Builder::default()
        .manage(Connection::default())
        .manage(CompanyViews::default())
        .register_uri_scheme_protocol("company-ui", company_views::protocol)
        .setup(|app| {
            if let Ok(dir) = app.path().app_config_dir() {
                if let Ok(bytes) = std::fs::read(dir.join("connection-reference.json")) {
                    if let Ok(path) = serde_json::from_slice::<PathBuf>(&bytes) {
                        if let Ok(g) = Gateway::load(&path) {
                            if let Ok(mut s) = app.state::<Connection>().0.lock() {
                                *s = Some(g);
                            }
                        }
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect_saved_profile,
            catalog_publication,
            prepare_company_package,
            mount_company_view,
            position_company_view,
            release_company_package,
            close_company_view,
            company_view_request,
            connect_profile,
            company_snapshot,
            inspect_service_continuation,
            stop_service_continuation,
            service_continuation_stop_request,
            company_command,
            command_receipt,
            ceo_message,
            ceo_messages,
            save_artifact,
            save_copy,
            inspect_record,
            deliver_message,
            catalog_workspaces,
            catalog_workspace,
            prepare_catalog_upload,
            catalog_upload,
            catalog_upload_content,
            catalog_publish,
            catalog_resource_receipt,
            read_artifact,
            notifications,
            read_notifications
        ])
        .build(tauri::generate_context!())
        .expect("build Ouroboros Mac app")
        .run(|handle, event| {
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = handle.get_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        });
}

#[cfg(test)]
mod ui_file_tests {
    use super::*;
    #[test]
    fn service_stop_requires_exact_references_and_current_connection() {
        let g = Gateway {
            client: reqwest::Client::new(),
            base: "https://same.example".into(),
            catalog_target: "catalog".into(),
            connection_generation: next_connection_generation(),
            binding: Arc::new(OnceLock::new()),
        };
        let mut request = ServiceStopRequest {
            connection_generation: g.connection_generation.clone(),
            root_intent_id: "00000000-0000-4000-8000-000000000001".into(),
            expected_execution_id: "00000000-0000-4000-8000-000000000002".into(),
            request_key: "original-stop".into(),
        };
        assert!(request.validate(&g).is_ok());
        let url = g
            .url(
                &[
                    "service-continuations",
                    &request.root_intent_id,
                    "stop-requests",
                    &request.request_key,
                ],
                None,
            )
            .unwrap();
        assert_eq!(
            url.path(),
            "/service-continuations/00000000-0000-4000-8000-000000000001/stop-requests/original-stop"
        );
        request.connection_generation = next_connection_generation();
        assert!(request.validate(&g).is_err());
        request.connection_generation = g.connection_generation.clone();
        request.expected_execution_id = "latest".into();
        assert!(request.validate(&g).is_err());
        request.expected_execution_id = "00000000-0000-4000-8000-000000000002".into();
        request.request_key = "../other-request".into();
        assert!(request.validate(&g).is_err());
    }
    fn binding_fixture(n: u8) -> Value {
        let id = format!("00000000-0000-4000-8000-{n:012}");
        let binding =
            json!({"environment_id":id,"firm_id":id,"principal_id":id,"serving_generation":id});
        json!({"environment_id":id,"firm_id":id,"principal_id":id,"owner_binding":binding})
    }
    #[test]
    fn pinned_server_identity_cannot_be_replaced_by_a_later_conditions_response() {
        let g = Gateway {
            client: reqwest::Client::new(),
            base: "https://same.example".into(),
            catalog_target: "catalog".into(),
            connection_generation: next_connection_generation(),
            binding: Arc::new(OnceLock::new()),
        };
        assert!(g.bound_request(g.client.get(&g.base)).is_err());
        assert!(g.pin_conditions(&json!({"firm_id":"unknown"})).is_err());
        let original = binding_fixture(1);
        g.pin_conditions(&original).unwrap();
        for field in [
            "environment_id",
            "firm_id",
            "principal_id",
            "serving_generation",
        ] {
            let mut changed = original.clone();
            changed["owner_binding"][field] = binding_fixture(2)["owner_binding"][field].clone();
            if field != "serving_generation" {
                changed[field] = changed["owner_binding"][field].clone();
            }
            assert!(g.pin_conditions(&changed).is_err());
            assert_eq!(
                serde_json::to_value(g.observed_binding().unwrap()).unwrap(),
                original["owner_binding"]
            );
        }
        let request = g
            .bound_request(g.client.get(&g.base))
            .unwrap()
            .build()
            .unwrap();
        assert_eq!(
            serde_json::from_slice::<Value>(request.headers()[OWNER_BINDING_HEADER].as_bytes())
                .unwrap(),
            original["owner_binding"]
        );
        assert!(g.check_scope_connection(None, true).is_err());
    }
    #[test]
    fn commands_reject_a_reconnected_profile_even_at_the_same_address() {
        let original = Gateway {
            client: reqwest::Client::new(),
            base: "https://same.example".into(),
            catalog_target: "catalog".into(),
            connection_generation: next_connection_generation(),
            binding: Arc::new(OnceLock::new()),
        };
        let reconnected = Gateway {
            connection_generation: next_connection_generation(),
            ..original.clone()
        };
        assert!(
            original
                .check_connection(&original.connection_generation)
                .is_ok()
        );
        assert!(
            reconnected
                .check_connection(&original.connection_generation)
                .is_err()
        );
        assert!(reconnected.check_connection("").is_err());
    }
    #[test]
    fn catalog_mutations_stay_bound_to_the_observed_gateway() {
        let original = Gateway {
            client: reqwest::Client::new(),
            base: "https://original.example".into(),
            catalog_target: "catalog".into(),
            connection_generation: "original".into(),
            binding: Arc::new(OnceLock::new()),
        };
        let replacement = Gateway {
            base: "https://replacement.example".into(),
            binding: Arc::new(OnceLock::new()),
            ..original.clone()
        };
        original.pin_conditions(&binding_fixture(1)).unwrap();
        replacement.pin_conditions(&binding_fixture(2)).unwrap();
        let expected = original
            .observed_binding()
            .unwrap()
            .environment_id
            .to_string();
        assert!(original.check_environment(Some(&expected), true).is_ok());
        assert!(
            replacement
                .check_environment(Some(&expected), true)
                .is_err()
        );
        assert!(original.check_environment(None, true).is_err());
        assert!(original.check_environment(None, false).is_ok());
    }
    #[test]
    fn accepts_bounded_document_copies() {
        assert!(valid_copy("result.r12.json", "{}"));
        assert!(valid_copy("report.r8.md", "# Report"));
    }
    #[test]
    fn rejects_paths_and_unsupported_files() {
        for name in [
            "../result.json",
            "/tmp/result.json",
            "folder\\result.json",
            "payload.html",
            "",
            "nul\0.json",
        ] {
            assert!(!valid_copy(name, "{}"), "{}", name);
        }
    }
    #[test]
    fn rejects_oversized_payload() {
        assert!(!valid_copy("result.json", &"x".repeat(1024 * 1024 + 1)));
    }
}

#[cfg(test)]
mod gateway_fixture_tests {
    use super::*;
    /// Opt-in generated test identity only; normal builds never discover a credential.
    #[tokio::test]
    #[ignore = "requires an explicitly supplied disposable Gateway profile"]
    async fn observes_real_gateway_and_exact_catalog_bytes() {
        let path = std::env::var("OURO_MAC_FIXTURE_PROFILE").expect("explicit fixture profile");
        let gateway = Gateway::load(std::path::Path::new(&path)).expect("fixture profile");
        let conditions = gateway
            .request(reqwest::Method::GET, "/conditions", None, None)
            .await
            .expect("conditions");
        assert!(conditions["firm_id"].is_string());
        assert_eq!(conditions["runtime_ready"], false);
        let work = gateway
            .request(reqwest::Method::GET, "/work", None, None)
            .await
            .expect("work");
        let mut files_read = 0;
        for work in work["items"].as_array().expect("work items") {
            let id = work["id"].as_str().unwrap();
            for collection in ["executions", "activity", "conversations"] {
                match gateway
                    .request(
                        reqwest::Method::GET,
                        &format!("/work/{id}/{collection}"),
                        None,
                        None,
                    )
                    .await
                {
                    Ok(reply) => assert!(reply["items"].is_array()),
                    Err(error) => assert_eq!(
                        error, "The current identity or delegation does not allow access.",
                        "fixture may deny a collection without implying empty or healthy state"
                    ),
                }
            }
            let observed = observe_workspaces(&gateway, work).await;
            for workspace in observed["items"].as_array().expect("workspace collection") {
                let revision = workspace["publication_observation"]["latest_confirmed_publication"]
                    ["revision"]
                    .as_i64();
                if let Some(revision) = revision {
                    let files=workspace["publication_observation"]["latest_confirmed_publication"]["files"].as_array().unwrap();
                    for file in files.iter().filter(|f| f["path"] == "company-ui.json") {
                        let artifact = Artifact {
                            workspace_id: workspace["workspace_id"].as_str().unwrap().into(),
                            revision,
                            path: file["path"].as_str().unwrap().into(),
                            work_id: id.into(),
                            delegation_id: work["delegation_id"].as_str().unwrap().into(),
                            target_id: gateway.catalog_target.clone(),
                            expected_environment_id: None,
                            connection_generation: None,
                        };
                        let (bytes, digest) = gateway
                            .artifact_bytes(&artifact)
                            .await
                            .expect("exact published bytes");
                        let document: Value = serde_json::from_slice(&bytes).unwrap();
                        assert_eq!(document["companyId"], conditions["firm_id"]);
                        assert_eq!(document["schemaVersion"], 1);
                        assert_eq!(digest, format!("{:x}", Sha256::digest(&bytes)));
                        files_read += 1;
                    }
                }
            }
        }
        assert_eq!(
            files_read, 1,
            "read one exact company configuration through the actual native client"
        );
        println!("Native Gateway collection and verified Catalog byte read: PASS");
    }
}
