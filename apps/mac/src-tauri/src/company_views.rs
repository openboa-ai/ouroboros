//! Firm packages are verified data inputs to isolated WebViews, never product modules.
use super::*;
use std::{
    collections::BTreeMap,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
};
use tauri::{Emitter, Webview, WebviewUrl, webview::WebviewBuilder};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct PackageFile {
    pub path: String,
    pub sha256: String,
    pub mime: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub entry: String,
    #[serde(default)]
    pub sizes: Vec<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Binding {
    pub path: String,
    pub revision: i64,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Manifest {
    pub schema_version: u32,
    pub company_id: String,
    pub id: String,
    pub version: String,
    pub sdk_version: u32,
    pub name: String,
    pub files: Vec<PackageFile>,
    pub pages: Vec<Entry>,
    pub widgets: Vec<Entry>,
    #[serde(default)]
    pub bindings: BTreeMap<String, Binding>,
}
impl Manifest {
    fn validate(&self, company: &str) -> Result<(), String> {
        if self.schema_version != 1
            || self.sdk_version != 1
            || self.company_id != company
            || self.id.is_empty()
            || self.id.len() > 64
            || !self
                .id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
            || self.version.is_empty()
            || self.version.len() > 64
            || self.name.is_empty()
            || self.name.len() > 120
            || self.files.is_empty()
            || self.files.len() > 128
            || self.pages.len() > 24
            || self.widgets.len() > 32
            || self.bindings.len() > 32
        {
            return Err("Company package is incompatible.".into());
        }
        let mut paths = std::collections::BTreeSet::new();
        for file in &self.files {
            artifact_path(&file.path)?;
            if !file
                .path
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"/._-".contains(&b))
            {
                return Err("Package paths must be URL-safe.".into());
            }
            if !paths.insert(&file.path)
                || !valid_digest(&file.sha256)
                || !matches!(
                    file.mime.as_str(),
                    "text/html"
                        | "text/javascript"
                        | "text/css"
                        | "image/png"
                        | "image/svg+xml"
                        | "font/woff2"
                        | "font/ttf"
                )
            {
                return Err("Unsupported package file.".into());
            }
        }
        let mut ids = std::collections::BTreeSet::new();
        for (kind, entry) in self
            .pages
            .iter()
            .map(|x| ("page", x))
            .chain(self.widgets.iter().map(|x| ("widget", x)))
        {
            if entry.id.is_empty()
                || entry.id.len() > 128
                || !entry
                    .id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b))
                || entry.title.is_empty()
                || entry.title.len() > 120
                || !ids.insert((kind, &entry.id))
                || !self
                    .files
                    .iter()
                    .any(|f| f.path == entry.entry && f.mime == "text/html")
                || entry
                    .sizes
                    .iter()
                    .any(|s| !matches!(s.as_str(), "small" | "medium" | "wide"))
            {
                return Err("Invalid package entry.".into());
            }
        }
        for (id, b) in &self.bindings {
            artifact_path(&b.path)?;
            if id.is_empty() || id.len() > 80 || b.revision < 1 {
                return Err("Invalid data binding.".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone)]
struct Package {
    manifest: Manifest,
    artifact: Artifact,
    digest: String,
    firm: String,
    owner: String,
    authority: i64,
    files: BTreeMap<String, (String, Vec<u8>)>,
}
#[derive(Clone)]
struct Mounted {
    package: Arc<Package>,
    entry: String,
    requests: Arc<tokio::sync::Semaphore>,
}
#[derive(Default)]
pub struct CompanyViews {
    packages: Mutex<BTreeMap<String, Arc<Package>>>,
    mounted: Mutex<BTreeMap<String, Mounted>>,
    sequence: AtomicU64,
    generation: AtomicU64,
}
fn owner(view: &Webview) -> Result<(), String> {
    if view.label() == "main" {
        Ok(())
    } else {
        Err("Only the protected workspace can manage Company views.".into())
    }
}
async fn check(g: &Gateway, p: &Package) -> Result<(), String> {
    g.check_environment(p.artifact.expected_environment_id.as_deref(), true)?;
    g.check_scope_connection(p.artifact.connection_generation.as_deref(), true)?;
    let c = g
        .request(reqwest::Method::GET, "/conditions", None, None)
        .await?;
    if c["firm_id"].as_str() != Some(&p.firm)
        || c["principal_id"].as_str() != Some(&p.owner)
        || c["revision"].as_i64() != Some(p.authority)
    {
        return Err("Company view authority changed; refresh the protected workspace.".into());
    }
    let (_, digest) = g.artifact_bytes(&p.artifact).await?;
    if digest != p.digest {
        return Err("Company package publication changed.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn prepare_company_package(
    view: Webview,
    s: State<'_, Connection>,
    store: State<'_, CompanyViews>,
    artifact: Artifact,
    sha256: String,
    expected_company_id: String,
    expected_owner_id: String,
) -> Result<Value, String> {
    owner(&view)?;
    let generation = store.generation.load(Ordering::SeqCst);
    let g = gateway(&s)?;
    g.check_environment(artifact.expected_environment_id.as_deref(), true)?;
    g.check_scope_connection(artifact.connection_generation.as_deref(), true)?;
    if !valid_digest(&sha256) {
        return Err("A pinned package digest is required.".into());
    }
    let conditions = g
        .request(reqwest::Method::GET, "/conditions", None, None)
        .await?;
    let firm = conditions["firm_id"]
        .as_str()
        .ok_or("Company unavailable")?
        .to_string();
    let principal = conditions["principal_id"]
        .as_str()
        .ok_or("Owner unavailable")?
        .to_string();
    if firm != expected_company_id || principal != expected_owner_id {
        return Err("Company connection changed.".into());
    }
    let authority = conditions["revision"]
        .as_i64()
        .ok_or("Authority unavailable")?;
    let (bytes, digest) = g.artifact_bytes(&artifact).await?;
    if bytes.len() > 256 * 1024 || digest != sha256 {
        return Err("Package manifest verification failed.".into());
    }
    let manifest: Manifest =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid Company manifest")?;
    manifest.validate(&firm)?;
    let mut files = BTreeMap::new();
    let mut total = bytes.len();
    for f in &manifest.files {
        let reference = Artifact {
            path: f.path.clone(),
            ..artifact.clone()
        };
        let (bytes, hash) = g.artifact_bytes(&reference).await?;
        total += bytes.len();
        if hash != f.sha256 || total > 32 * 1024 * 1024 {
            return Err("Package assets failed verification or exceed 32 MiB.".into());
        }
        files.insert(f.path.clone(), (f.mime.clone(), bytes));
    }
    let p = Arc::new(Package {
        manifest: manifest.clone(),
        artifact,
        digest,
        firm,
        owner: principal,
        authority,
        files,
    });
    check(&g, &p).await?;
    let key = format!("package-{}", store.sequence.fetch_add(1, Ordering::Relaxed));
    let mut packages = store
        .packages
        .lock()
        .map_err(|_| "Package store unavailable")?;
    if packages.len() >= 32 {
        return Err("Company package limit reached. Release unused packages first.".into());
    }
    if generation != store.generation.load(Ordering::SeqCst) {
        return Err("Company connection changed.".into());
    }
    packages.insert(key.clone(), p);
    Ok(json!({"handle":key,"manifest":manifest,"verified":true}))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    visible: bool,
}
fn bounds(b: &Bounds, w: f64, h: f64) -> Result<(), String> {
    if [b.x, b.y, b.width, b.height].iter().any(|v| !v.is_finite())
        || b.x < 224.0
        || b.y < 64.0
        || b.width < 1.0
        || b.height < 1.0
        || b.x + b.width > w + 1.0
        || b.y + b.height > h + 1.0
    {
        return Err("Company surface must remain inside the content area.".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn mount_company_view(
    view: Webview,
    s: State<'_, Connection>,
    store: State<'_, CompanyViews>,
    handle: String,
    kind: String,
    entry: String,
    bounds: Bounds,
) -> Result<String, String> {
    owner(&view)?;
    let app = view.app_handle().clone();
    let generation = store.generation.load(Ordering::SeqCst);
    let package = store
        .packages
        .lock()
        .map_err(|_| "Package store unavailable")?
        .get(&handle)
        .cloned()
        .ok_or("Package not prepared")?;
    let entries = match kind.as_str() {
        "page" => &package.manifest.pages,
        "widget" => &package.manifest.widgets,
        _ => return Err("Invalid surface kind".into()),
    };
    let path = entries
        .iter()
        .find(|e| e.id == entry)
        .ok_or("Entry not found")?
        .entry
        .clone();
    check(&gateway(&s)?, &package).await?;
    if generation != store.generation.load(Ordering::SeqCst) {
        return Err("Company connection changed.".into());
    }
    let window = app
        .get_window("main")
        .ok_or("Workspace window unavailable")?;
    let size = window
        .inner_size()
        .map_err(|_| "Window size unavailable")?
        .to_logical::<f64>(
            window
                .scale_factor()
                .map_err(|_| "Window scale unavailable")?,
        );
    self::bounds(&bounds, size.width, size.height)?;
    let label = format!(
        "company-view-{}",
        store.sequence.fetch_add(1, Ordering::Relaxed)
    );
    let url = reqwest::Url::parse(&format!("company-ui://{label}/{path}"))
        .map_err(|_| "Invalid entry URL")?;
    let origin = label.clone();
    let init = "Object.defineProperty(window,'__OURO_COMPANY__',{value:Object.freeze({request:(request)=>window.__TAURI_INTERNALS__.invoke('company_view_request',{request})}),writable:false,configurable:false});";
    let builder = WebviewBuilder::new(&label, WebviewUrl::External(url))
        .incognito(true)
        .initialization_script(init)
        .on_navigation(move |url| {
            url.scheme() == "company-ui" && url.host_str() == Some(origin.as_str())
        })
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .on_download(|_, _| false);
    {
        let mut mounts = store.mounted.lock().map_err(|_| "View store unavailable")?;
        if mounts.len() >= 16 {
            return Err("Too many Company surfaces.".into());
        }
        mounts.insert(
            label.clone(),
            Mounted {
                package: package.clone(),
                entry,
                requests: Arc::new(tokio::sync::Semaphore::new(4)),
            },
        );
    }
    let built = window.add_child(
        builder,
        tauri::LogicalPosition::new(bounds.x, bounds.y),
        tauri::LogicalSize::new(bounds.width, bounds.height),
    );
    if built.is_err() {
        store
            .mounted
            .lock()
            .map_err(|_| "View store unavailable")?
            .remove(&label);
        return Err("Company surface could not be created.".into());
    }
    if !bounds.visible {
        let _ = built.unwrap().hide();
    }
    let monitored = label.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(15)).await;
            if app.get_webview(&monitored).is_none() {
                break;
            }
            let valid = match gateway(&app.state::<Connection>()) {
                Ok(g) => check(&g, &package).await.is_ok(),
                Err(_) => false,
            };
            if !valid {
                close(&app, &monitored);
                let _ = app.emit_to(
                    "main",
                    "company-view-unavailable",
                    json!({"view":monitored}),
                );
                break;
            }
        }
    });
    Ok(label)
}
fn close(app: &tauri::AppHandle, label: &str) {
    if let Ok(mut m) = app.state::<CompanyViews>().mounted.lock() {
        m.remove(label);
    }
    if let Some(v) = app.get_webview(label) {
        let _ = v.close();
    }
}
pub fn clear_all(app: &tauri::AppHandle) {
    let store = app.state::<CompanyViews>();
    store.generation.fetch_add(1, Ordering::SeqCst);
    if let Ok(mut packages) = store.packages.lock() {
        packages.clear();
    }
    let labels: Vec<String> = store
        .mounted
        .lock()
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default();
    for label in labels {
        close(app, &label);
        let _ = app.emit_to("main", "company-view-unavailable", json!({"view":label}));
    }
}
#[tauri::command]
pub fn position_company_view(
    view: Webview,
    app: tauri::AppHandle,
    label: String,
    bounds: Bounds,
) -> Result<(), String> {
    owner(&view)?;
    if !label.starts_with("company-view-") {
        return Err("Invalid Company view".into());
    }
    let v = app.get_webview(&label).ok_or("Company view unavailable")?;
    if !bounds.visible {
        return v.hide().map_err(|_| "Unable to hide surface".into());
    }
    let window = v.window();
    let size = window
        .inner_size()
        .map_err(|_| "Size unavailable")?
        .to_logical::<f64>(window.scale_factor().map_err(|_| "Scale unavailable")?);
    self::bounds(&bounds, size.width, size.height)?;
    v.set_position(tauri::LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|_| "Position unavailable")?;
    v.set_size(tauri::LogicalSize::new(bounds.width, bounds.height))
        .map_err(|_| "Size unavailable")?;
    v.show().map_err(|_| "Surface unavailable".into())
}
#[tauri::command]
pub fn release_company_package(
    view: Webview,
    app: tauri::AppHandle,
    store: State<'_, CompanyViews>,
    handle: String,
) -> Result<(), String> {
    owner(&view)?;
    let p = store
        .packages
        .lock()
        .map_err(|_| "Package store unavailable")?
        .remove(&handle);
    if let Some(p) = p {
        let labels: Vec<_> = store
            .mounted
            .lock()
            .map_err(|_| "View store unavailable")?
            .iter()
            .filter(|(_, m)| Arc::ptr_eq(&m.package, &p))
            .map(|(l, _)| l.clone())
            .collect();
        for l in labels {
            close(&app, &l);
        }
    }
    Ok(())
}
#[tauri::command]
pub fn close_company_view(
    view: Webview,
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    owner(&view)?;
    if !label.starts_with("company-view-") {
        return Err("Invalid Company view".into());
    }
    close(&app, &label);
    Ok(())
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Request {
    Context {},
    Query { binding: String },
    Open { binding: String },
    Discuss { binding: String },
}
#[tauri::command]
pub async fn company_view_request(
    view: Webview,
    app: tauri::AppHandle,
    s: State<'_, Connection>,
    store: State<'_, CompanyViews>,
    request: Request,
) -> Result<Value, String> {
    let mounted = store
        .mounted
        .lock()
        .map_err(|_| "View store unavailable")?
        .get(view.label())
        .cloned()
        .ok_or("This WebView has no Company binding")?;
    let _permit = mounted
        .requests
        .try_acquire()
        .map_err(|_| "Company query limit reached")?;
    let p = &mounted.package;
    let g = gateway(&s)?;
    check(&g, p).await?;
    let discuss = matches!(&request, Request::Discuss { .. });
    match request {
        Request::Context {} => Ok(
            json!({"companyId":p.firm,"moduleId":p.manifest.id,"version":p.manifest.version,"entry":mounted.entry}),
        ),
        Request::Query { binding } => {
            let b = p
                .manifest
                .bindings
                .get(&binding)
                .ok_or("Data binding not declared")?;
            let a = Artifact {
                path: b.path.clone(),
                revision: b.revision,
                ..p.artifact.clone()
            };
            let (bytes, digest) = g.artifact_bytes(&a).await?;
            if bytes.len() > 1024 * 1024 {
                return Err("Data exceeds 1 MiB".into());
            }
            let content: Value =
                serde_json::from_slice(&bytes).map_err(|_| "Binding is not JSON data")?;
            Ok(
                json!({"content":content,"sha256":digest,"workspace":a.workspace_id,"revision":a.revision,"path":a.path}),
            )
        }
        Request::Open { binding } | Request::Discuss { binding } => {
            let b = p
                .manifest
                .bindings
                .get(&binding)
                .ok_or("Data binding not declared")?;
            let a = Artifact {
                path: b.path.clone(),
                revision: b.revision,
                ..p.artifact.clone()
            };
            g.artifact_bytes(&a).await?;
            app.emit_to("main","company-view-reference",json!({"view":view.label(),"companyId":p.firm,"moduleId":p.manifest.id,"discuss":discuss,"artifact":a})).map_err(|_|"Workspace unavailable")?;
            Ok(json!({"delivered":true}))
        }
    }
}
pub fn protocol(
    ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let store = ctx.app_handle().state::<CompanyViews>();
    response(ctx.webview_label(), &store, request)
}
fn response(
    label: &str,
    store: &CompanyViews,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let denied = || {
        tauri::http::Response::builder()
            .status(403)
            .body(Vec::new())
            .unwrap()
    };
    if request.method() != tauri::http::Method::GET || request.uri().host() != Some(label) {
        return denied();
    }
    let Ok(m) = store.mounted.lock() else {
        return denied();
    };
    let Some(mount) = m.get(label) else {
        return denied();
    };
    let path = request.uri().path().trim_start_matches('/');
    let Some((mime, bytes)) = mount.package.files.get(path) else {
        return denied();
    };
    tauri::http::Response::builder().status(200)
  .header("Content-Type",mime).header("X-Content-Type-Options","nosniff").header("Cache-Control","no-store")
  .header("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'")
  .body(bytes.clone()).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn manifest() -> Manifest {
        serde_json::from_value(json!({"schemaVersion":1,"companyId":"company-a","id":"summary","version":"1.0.0","sdkVersion":1,"name":"Summary","files":[{"path":"index.html","sha256":"a".repeat(64),"mime":"text/html"}],"pages":[{"id":"summary","title":"Summary","entry":"index.html"}],"widgets":[],"bindings":{"report":{"path":"report.json","revision":1}}})).unwrap()
    }
    #[test]
    fn package_contract_rejects_cross_company_and_executable_escapes() {
        let p = manifest();
        assert!(p.validate("company-a").is_ok());
        assert!(p.validate("company-b").is_err());
        let mut q = p.clone();
        q.files[0].path = "../outside.js".into();
        assert!(q.validate("company-a").is_err());
        let mut q = p.clone();
        q.files[0].mime = "application/x-mach-binary".into();
        assert!(q.validate("company-a").is_err());
        let mut q = p.clone();
        q.sdk_version = 2;
        assert!(q.validate("company-a").is_err());
        let mut q = p.clone();
        q.files.push(q.files[0].clone());
        assert!(q.validate("company-a").is_err());
        let mut q = p.clone();
        q.pages[0].entry = "unpublished.html".into();
        assert!(q.validate("company-a").is_err());
        let mut q = p;
        q.bindings.get_mut("report").unwrap().path = "/etc/passwd".into();
        assert!(q.validate("company-a").is_err());
    }
    #[test]
    fn owner_area_is_not_a_company_surface() {
        assert!(
            bounds(
                &Bounds {
                    x: 256.,
                    y: 96.,
                    width: 700.,
                    height: 400.,
                    visible: true
                },
                1100.,
                720.
            )
            .is_ok()
        );
        for (x, y, w, h) in [
            (0., 0., 1100., 720.),
            (223., 96., 300., 100.),
            (256., 63., 300., 100.),
            (256., 96., f64::NAN, 100.),
            (256., 96., 1000., 100.),
        ] {
            assert!(
                bounds(
                    &Bounds {
                        x,
                        y,
                        width: w,
                        height: h,
                        visible: true
                    },
                    1100.,
                    720.
                )
                .is_err()
            );
        }
    }
    #[test]
    fn bridge_has_no_arbitrary_transport_or_mutation() {
        assert!(
            serde_json::from_value::<Request>(json!({"kind":"query","binding":"report"})).is_ok()
        );
        for value in [
            json!({"kind":"query","binding":"report","url":"https://evil.test"}),
            json!({"kind":"stopExecution","id":"123"}),
            json!({"kind":"context","companyId":"company-b"}),
        ] {
            assert!(serde_json::from_value::<Request>(value).is_err());
        }
    }
    #[test]
    fn assets_are_bound_to_calling_webview_and_exact_manifest() {
        let store = CompanyViews::default();
        let package = Arc::new(Package {
            manifest: manifest(),
            artifact: Artifact {
                workspace_id: "w".into(),
                revision: 1,
                path: "manifest.json".into(),
                work_id: "work".into(),
                delegation_id: "grant".into(),
                target_id: "catalog".into(),
                expected_environment_id: Some("env".into()),
                connection_generation: None,
            },
            digest: "a".repeat(64),
            firm: "company-a".into(),
            owner: "owner".into(),
            authority: 1,
            files: BTreeMap::from([(
                "index.html".into(),
                ("text/html".into(), b"<h1>synthetic</h1>".to_vec()),
            )]),
        });
        store.mounted.lock().unwrap().insert(
            "company-view-1".into(),
            Mounted {
                package,
                entry: "summary".into(),
                requests: Arc::new(tokio::sync::Semaphore::new(4)),
            },
        );
        let req = |path: &str| {
            tauri::http::Request::builder()
                .uri(path)
                .body(Vec::new())
                .unwrap()
        };
        let ok = response(
            "company-view-1",
            &store,
            req("company-ui://company-view-1/index.html"),
        );
        assert_eq!(ok.status(), 200);
        assert!(
            ok.headers()["content-security-policy"]
                .to_str()
                .unwrap()
                .contains("default-src 'none'")
        );
        for (label, url) in [
            ("main", "company-ui://company-view-1/index.html"),
            ("company-view-2", "company-ui://company-view-1/index.html"),
            ("company-view-1", "company-ui://company-view-1/private.json"),
            (
                "company-view-1",
                "company-ui://company-view-1/%2e%2e/private",
            ),
        ] {
            assert_eq!(response(label, &store, req(url)).status(), 403);
        }
        store.mounted.lock().unwrap().clear();
        assert_eq!(
            response(
                "company-view-1",
                &store,
                req("company-ui://company-view-1/index.html")
            )
            .status(),
            403
        );
    }
    #[test]
    fn company_capability_cannot_inherit_owner_commands() {
        let owner: Value =
            serde_json::from_str(include_str!("../capabilities/owner-console.json")).unwrap();
        let private: Value =
            serde_json::from_str(include_str!("../capabilities/company-view.json")).unwrap();
        assert!(owner.get("windows").is_none());
        assert_eq!(owner["webviews"], json!(["main"]));
        assert!(private.get("windows").is_none());
        assert_eq!(
            private["permissions"],
            json!(["allow-company-view-request"])
        );
    }
}
