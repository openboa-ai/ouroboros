use serde::Deserialize;
use std::{
    env,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    ActivationPolicy, Manager, WebviewUrl, WebviewWindowBuilder,
};

const DEFAULT_RUNTIME_HOST: &str = "127.0.0.1";
const DEFAULT_RUNTIME_PORT: u16 = 4173;
const MAIN_WINDOW_LABEL: &str = "main";
const STATUS_TRAY_ID: &str = "ouroboros-runtime-status";
const STATUS_MENU_ID: &str = "ouroboros-runtime-status-label";
const OPEN_MENU_ID: &str = "ouroboros-open-operator";
const HIDE_MENU_ID: &str = "ouroboros-hide-operator";
const START_LOOP_MENU_ID: &str = "ouroboros-start-paper-research-loop";
const STOP_LOOP_MENU_ID: &str = "ouroboros-stop-paper-research-loop";
const RESTART_RUNTIME_MENU_ID: &str = "ouroboros-restart-runtime";
const QUIT_MENU_ID: &str = "ouroboros-quit-operator";
const REQUIRED_RUNTIME_CONTRACT_VERSION: &str = "paper-loop-continuation-v2";
const REQUIRED_LOOP_COMMAND_KINDS: &[&str] = &[
    "arena.start",
    "arena.stop",
    "arena.tick",
    "arena.cycle",
    "trading_run.start",
    "trading_run.observe",
];

#[derive(Clone)]
struct RuntimeProcess(Arc<Mutex<Option<Child>>>);

fn main() {
    let runtime_process = RuntimeProcess(Arc::new(Mutex::new(None)));
    let setup_process = runtime_process.clone();
    let tray_process = runtime_process.clone();
    let monitor_process = runtime_process.clone();
    let exit_process = runtime_process.clone();
    let shutdown_requested = Arc::new(AtomicBool::new(false));
    let monitor_shutdown_requested = shutdown_requested.clone();
    let tray_shutdown_requested = shutdown_requested.clone();
    let exit_shutdown_requested = shutdown_requested.clone();

    let app = tauri::Builder::default()
        .manage(runtime_process)
        .setup(move |app| {
            app.set_activation_policy(ActivationPolicy::Regular);
            let resource_dir = app.path().resource_dir().ok();
            install_runtime_status_tray(
                app,
                tray_process.clone(),
                resource_dir.clone(),
                tray_shutdown_requested.clone(),
            )?;
            if let Err(message) = start_runtime_if_needed(setup_process.clone(), resource_dir) {
                eprintln!("{message}");
            }
            ensure_main_window(app.handle())?;
            update_runtime_status_tray(app.handle());
            show_main_window(app.handle());
            start_runtime_status_monitor(
                app.handle().clone(),
                monitor_process.clone(),
                app.path().resource_dir().ok(),
                monitor_shutdown_requested.clone(),
            );
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Ouroboros operator desktop app");

    app.run(move |app_handle, event| match event {
        tauri::RunEvent::Ready => {
            show_main_window(app_handle);
            update_runtime_status_tray(app_handle);
        }
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            api.prevent_close();
            hide_window(app_handle, &label);
            update_runtime_status_tray(app_handle);
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows {
                show_main_window(app_handle);
            }
        }
        tauri::RunEvent::ExitRequested { .. } => {
            exit_shutdown_requested.store(true, Ordering::SeqCst);
        }
        tauri::RunEvent::Exit => {
            exit_shutdown_requested.store(true, Ordering::SeqCst);
            stop_runtime(exit_process.clone());
        }
        _ => {}
    });
}

fn ensure_main_window(app_handle: &tauri::AppHandle) -> tauri::Result<()> {
    if app_handle.get_webview_window(MAIN_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app_handle,
        MAIN_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Ouroboros Operator")
    .inner_size(1440.0, 960.0)
    .min_inner_size(1180.0, 760.0)
    .resizable(true)
    .focused(true)
    .visible(true)
    .build()?;

    Ok(())
}

fn install_runtime_status_tray(
    app: &mut tauri::App,
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
    shutdown_requested: Arc<AtomicBool>,
) -> tauri::Result<()> {
    let status = MenuItemBuilder::with_id(STATUS_MENU_ID, "Status is shown in the macOS menu bar")
        .enabled(false)
        .build(app)?;
    let open = MenuItemBuilder::with_id(OPEN_MENU_ID, "Open Operator").build(app)?;
    let hide = MenuItemBuilder::with_id(HIDE_MENU_ID, "Hide Window").build(app)?;
    let start_loop =
        MenuItemBuilder::with_id(START_LOOP_MENU_ID, "Start Paper/Research Loop").build(app)?;
    let stop_loop =
        MenuItemBuilder::with_id(STOP_LOOP_MENU_ID, "Stop Paper/Research Loop").build(app)?;
    let restart =
        MenuItemBuilder::with_id(RESTART_RUNTIME_MENU_ID, "Restart Runtime").build(app)?;
    let quit = MenuItemBuilder::with_id(QUIT_MENU_ID, "Quit Ouroboros").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&status)
        .separator()
        .item(&open)
        .item(&hide)
        .separator()
        .item(&start_loop)
        .item(&stop_loop)
        .item(&restart)
        .separator()
        .item(&quit)
        .build()?;

    let mut builder = TrayIconBuilder::with_id(STATUS_TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .title("Ouroboros START")
        .tooltip("Ouroboros runtime status: starting")
        .on_menu_event(move |app_handle, event| match event.id().as_ref() {
            OPEN_MENU_ID => show_main_window(app_handle),
            HIDE_MENU_ID => hide_window(app_handle, MAIN_WINDOW_LABEL),
            START_LOOP_MENU_ID => {
                if let Err(message) =
                    ensure_runtime_running(runtime_process.clone(), resource_dir.clone())
                {
                    eprintln!("operator_desktop_start_loop_blocked:{message}");
                    update_runtime_status_tray(app_handle);
                    return;
                }
                let host = runtime_host();
                let port = runtime_port();
                if let Err(message) = request_operator_command(&host, port, "arena.start") {
                    eprintln!("{message}");
                }
                update_runtime_status_tray(app_handle);
            }
            STOP_LOOP_MENU_ID => {
                let host = runtime_host();
                let port = runtime_port();
                if let Err(message) = request_operator_command(&host, port, "arena.stop") {
                    eprintln!("{message}");
                }
                update_runtime_status_tray(app_handle);
            }
            RESTART_RUNTIME_MENU_ID => {
                restart_runtime(app_handle, runtime_process.clone(), resource_dir.clone())
            }
            QUIT_MENU_ID => {
                shutdown_requested.store(true, Ordering::SeqCst);
                app_handle.exit(0);
            }
            STATUS_MENU_ID => update_runtime_status_tray(app_handle),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon).icon_as_template(true);
    }

    builder.build(app)?;
    Ok(())
}

fn start_runtime_status_monitor(
    app_handle: tauri::AppHandle,
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
    shutdown_requested: Arc<AtomicBool>,
) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(5));
        if shutdown_requested.load(Ordering::SeqCst) {
            break;
        }
        if let Err(message) = ensure_runtime_running(runtime_process.clone(), resource_dir.clone())
        {
            eprintln!("{message}");
        }
        update_runtime_status_tray(&app_handle);
    });
}

fn ensure_runtime_running(
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
) -> Result<(), String> {
    let host = runtime_host();
    let port = runtime_port();
    match runtime_compatibility(&host, port) {
        RuntimeCompatibility::Compatible => {
            reap_finished_runtime_child(&runtime_process);
            return Ok(());
        }
        RuntimeCompatibility::Unknown(message) if runtime_reachable(&host, port) => {
            eprintln!("operator_desktop_runtime_compatibility_unknown:{message}");
            reap_finished_runtime_child(&runtime_process);
            return Ok(());
        }
        RuntimeCompatibility::Unknown(_) | RuntimeCompatibility::Incompatible => {}
    }

    stop_runtime(runtime_process.clone());
    start_runtime_if_needed(runtime_process, resource_dir)
}

fn restart_runtime(
    app_handle: &tauri::AppHandle,
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
) {
    stop_runtime(runtime_process.clone());
    if let Err(message) = start_runtime_if_needed(runtime_process, resource_dir) {
        eprintln!("{message}");
    }
    update_runtime_status_tray(app_handle);
}

fn update_runtime_status_tray(app_handle: &tauri::AppHandle) {
    let host = runtime_host();
    let port = runtime_port();
    let runtime_status = current_runtime_status(&host, port);

    if let Some(tray) = app_handle.tray_by_id(STATUS_TRAY_ID) {
        let _ = tray.set_title(Some(runtime_status.menu_bar_title()));
        let _ = tray.set_tooltip(Some(runtime_status.tooltip(&host, port)));
    }
}

fn show_main_window(app_handle: &tauri::AppHandle) {
    let _ = ensure_main_window(app_handle);

    #[cfg(target_os = "macos")]
    {
        let _ = app_handle.set_activation_policy(ActivationPolicy::Regular);
        let _ = app_handle.show();
    }

    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_window(app_handle: &tauri::AppHandle, label: &str) {
    if let Some(window) = app_handle.get_webview_window(label) {
        let _ = window.hide();
    }
}

enum RuntimeStatus {
    LoopRunning(OperatorLoopStatus),
    RuntimeReady(Option<OperatorLoopStatus>),
    Incompatible(Vec<String>),
    Off,
}

enum RuntimeCompatibility {
    Compatible,
    Incompatible,
    Unknown(String),
}

impl RuntimeStatus {
    fn menu_bar_title(&self) -> &'static str {
        match self {
            Self::LoopRunning(_) => "Ouroboros LOOP",
            Self::RuntimeReady(_) => "Ouroboros RUN",
            Self::Incompatible(_) => "Ouroboros OLD",
            Self::Off => "Ouroboros OFF",
        }
    }

    fn tooltip(&self, host: &str, port: u16) -> String {
        match self {
            Self::LoopRunning(loop_status) => {
                format!(
                    "Paper/research loop: running; paper runner {}; observations {}; next {}; runtime http://{host}:{port}",
                    loop_status.paper_runner_label(),
                    loop_status.observation_count,
                    loop_status.next_observation_label()
                )
            }
            Self::RuntimeReady(Some(loop_status)) => {
                format!(
                    "Ouroboros runtime running; paper/research loop {}; paper runner {}; observations {}; runtime http://{host}:{port}",
                    loop_status.arena_runner_status,
                    loop_status.paper_runner_label(),
                    loop_status.observation_count
                )
            }
            Self::RuntimeReady(None) => {
                format!("Ouroboros runtime running; Operator read model unavailable at http://{host}:{port}")
            }
            Self::Incompatible(missing_commands) => {
                format!(
                    "Ouroboros runtime at http://{host}:{port} is older than this app; contract gaps: {}; restart the stale runtime before running the paper/research loop",
                    missing_commands.join(", ")
                )
            }
            Self::Off => format!("Ouroboros runtime status: off at http://{host}:{port}"),
        }
    }
}

#[derive(Debug)]
struct OperatorLoopStatus {
    arena_runner_status: String,
    paper_status: String,
    paper_runner_active: bool,
    observation_count: u64,
    next_observation_at: Option<String>,
    missing_required_commands: Vec<String>,
}

impl OperatorLoopStatus {
    fn paper_runner_label(&self) -> &'static str {
        if self.paper_runner_active {
            "active"
        } else if self.paper_status == "running" {
            "needs resume"
        } else {
            "inactive"
        }
    }

    fn next_observation_label(&self) -> &str {
        self.next_observation_at.as_deref().unwrap_or("unknown")
    }
}

#[derive(Deserialize)]
struct OperatorApiResponse {
    operator: OperatorApiReadModel,
}

#[derive(Deserialize)]
struct RuntimeHealthApiResponse {
    service: Option<String>,
    operator_loop_contract_version: Option<String>,
}

#[derive(Deserialize)]
struct OperatorApiReadModel {
    #[serde(default)]
    command_descriptors: Vec<OperatorCommandDescriptorApiReadModel>,
    candidate_arena: CandidateArenaApiReadModel,
    selected_paper_trading_evaluation: PaperTradingEvaluationApiReadModel,
}

#[derive(Deserialize)]
struct OperatorCommandDescriptorApiReadModel {
    command_kind: String,
}

#[derive(Deserialize)]
struct CandidateArenaApiReadModel {
    runner_status: String,
}

#[derive(Deserialize)]
struct PaperTradingEvaluationApiReadModel {
    status: String,
    runner_active: bool,
    observation_count: u64,
    next_observation_at: Option<String>,
}

fn current_runtime_status(host: &str, port: u16) -> RuntimeStatus {
    if !runtime_reachable(host, port) {
        return RuntimeStatus::Off;
    }

    match runtime_incompatibility_reasons(host, port) {
        Ok(reasons) if !reasons.is_empty() => {
            return RuntimeStatus::Incompatible(reasons);
        }
        _ => {}
    }

    match fetch_operator_loop_status(host, port) {
        Ok(loop_status) if !loop_status.missing_required_commands.is_empty() => {
            RuntimeStatus::Incompatible(loop_status.missing_required_commands)
        }
        Ok(loop_status) if loop_status.arena_runner_status == "running" => {
            RuntimeStatus::LoopRunning(loop_status)
        }
        Ok(loop_status) => RuntimeStatus::RuntimeReady(Some(loop_status)),
        Err(message) => {
            eprintln!("{message}");
            RuntimeStatus::RuntimeReady(None)
        }
    }
}

fn fetch_operator_loop_status(host: &str, port: u16) -> Result<OperatorLoopStatus, String> {
    let operator_token_header = operator_api_token_header();
    let response = request_runtime_http(
        host,
        port,
        &format!(
            "GET /api/operator HTTP/1.1\r\nHost: {host}:{port}\r\n{operator_token_header}Connection: close\r\n\r\n"
        ),
    )?;
    let body = http_response_body(&response)?;
    let parsed: OperatorApiResponse = serde_json::from_str(body)
        .map_err(|error| format!("operator_desktop_operator_read_parse_failed:{error}"))?;
    let missing_required_commands =
        missing_required_loop_commands(&parsed.operator.command_descriptors);
    Ok(OperatorLoopStatus {
        arena_runner_status: parsed.operator.candidate_arena.runner_status,
        paper_status: parsed.operator.selected_paper_trading_evaluation.status,
        paper_runner_active: parsed
            .operator
            .selected_paper_trading_evaluation
            .runner_active,
        observation_count: parsed
            .operator
            .selected_paper_trading_evaluation
            .observation_count,
        next_observation_at: parsed
            .operator
            .selected_paper_trading_evaluation
            .next_observation_at,
        missing_required_commands,
    })
}

fn runtime_compatible(host: &str, port: u16) -> bool {
    matches!(
        runtime_compatibility(host, port),
        RuntimeCompatibility::Compatible
    )
}

fn runtime_compatibility(host: &str, port: u16) -> RuntimeCompatibility {
    match runtime_incompatibility_reasons(host, port) {
        Ok(reasons) if reasons.is_empty() => RuntimeCompatibility::Compatible,
        Ok(_) => RuntimeCompatibility::Incompatible,
        Err(message) => RuntimeCompatibility::Unknown(message),
    }
}

fn runtime_incompatibility_reasons(host: &str, port: u16) -> Result<Vec<String>, String> {
    let mut reasons = Vec::new();
    let health = fetch_runtime_health(host, port)?;
    if health.service.as_deref() != Some("ouroboros-runtime") {
        reasons.push("service".to_string());
    }
    if health.operator_loop_contract_version.as_deref() != Some(REQUIRED_RUNTIME_CONTRACT_VERSION) {
        reasons.push("operator_loop_contract_version".to_string());
    }
    match fetch_operator_loop_status(host, port) {
        Ok(loop_status) => reasons.extend(loop_status.missing_required_commands),
        Err(error) if reasons.is_empty() => return Err(error),
        Err(_) => {}
    }
    Ok(reasons)
}

fn fetch_runtime_health(host: &str, port: u16) -> Result<RuntimeHealthApiResponse, String> {
    let response = request_runtime_http(
        host,
        port,
        &format!("GET /health HTTP/1.1\r\nHost: {host}:{port}\r\nConnection: close\r\n\r\n"),
    )?;
    let body = http_response_body(&response)?;
    serde_json::from_str(body)
        .map_err(|error| format!("operator_desktop_runtime_health_parse_failed:{error}"))
}

fn missing_required_loop_commands(
    command_descriptors: &[OperatorCommandDescriptorApiReadModel],
) -> Vec<String> {
    REQUIRED_LOOP_COMMAND_KINDS
        .iter()
        .filter(|required| {
            !command_descriptors
                .iter()
                .any(|descriptor| descriptor.command_kind == **required)
        })
        .map(|value| (*value).to_string())
        .collect()
}

fn request_operator_command(host: &str, port: u16, command_kind: &str) -> Result<(), String> {
    let body = format!(r#"{{"command_kind":"{command_kind}"}}"#);
    let operator_token_header = operator_api_token_header();
    let response = request_runtime_http(
        host,
        port,
        &format!(
            "POST /api/commands HTTP/1.1\r\nHost: {host}:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{operator_token_header}Connection: close\r\n\r\n{body}",
            body.len()
        ),
    )?;
    let _ = http_response_body(&response)?;
    Ok(())
}

fn operator_api_token_header() -> String {
    let Some(token) = env::var("OUROBOROS_OPERATOR_API_TOKEN")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    else {
        return String::new();
    };

    if token.contains('\r') || token.contains('\n') {
        return String::new();
    }

    format!("x-ouroboros-operator-token: {token}\r\n")
}

fn request_runtime_http(host: &str, port: u16, request: &str) -> Result<String, String> {
    let address = format!("{host}:{port}")
        .parse::<SocketAddr>()
        .map_err(|error| format!("operator_desktop_runtime_address_invalid:{error}"))?;
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(500))
        .map_err(|error| format!("operator_desktop_runtime_http_connect_failed:{error}"))?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("operator_desktop_runtime_http_write_failed:{error}"))?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| format!("operator_desktop_runtime_http_read_failed:{error}"))?;
    Ok(response)
}

fn http_response_body(response: &str) -> Result<&str, String> {
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "operator_desktop_runtime_http_response_invalid".to_string())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "operator_desktop_runtime_http_status_missing".to_string())?;
    if !(200..300).contains(&status) {
        return Err(format!("operator_desktop_runtime_http_status:{status}"));
    }
    Ok(body)
}

fn start_runtime_if_needed(
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
) -> Result<(), String> {
    let host = runtime_host();
    let port = runtime_port();
    match runtime_compatibility(&host, port) {
        RuntimeCompatibility::Compatible => return Ok(()),
        RuntimeCompatibility::Unknown(message) if runtime_reachable(&host, port) => {
            return Err(format!(
                "operator_desktop_runtime_compatibility_unknown:{message}"
            ));
        }
        RuntimeCompatibility::Unknown(_) | RuntimeCompatibility::Incompatible => {}
    }

    if runtime_reachable(&host, port) {
        stop_runtime(runtime_process.clone());
        if runtime_reachable(&host, port) {
            return Err(format!(
                "operator_desktop_runtime_incompatible_port_occupied:http://{host}:{port}"
            ));
        }
    }

    let runtime_url = format!("http://{host}:{port}");
    let runtime_command = runtime_command(resource_dir.as_deref());
    let mut command = Command::new(&runtime_command.program);
    command
        .args(&runtime_command.args)
        .env("HOST", &host)
        .env("PORT", port.to_string())
        .env("OUROBOROS_RUNTIME_URL", &runtime_url)
        .env("OUROBOROS_RUNTIME_REPO_ROOT", repo_root())
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    if let Some(current_dir) = runtime_command.current_dir {
        command.current_dir(current_dir);
    }
    let mut child = command.spawn().map_err(|error| {
        format!(
            "operator_desktop_runtime_spawn_failed:{}:{}",
            runtime_command.kind, error
        )
    })?;

    if !wait_for_compatible_runtime(&host, port, Duration::from_secs(15)) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!(
            "operator_desktop_runtime_unreachable_or_incompatible:{runtime_url}"
        ));
    }

    let mut guard = runtime_process
        .0
        .lock()
        .map_err(|_| "operator_desktop_runtime_process_lock_poisoned".to_string())?;
    *guard = Some(child);
    Ok(())
}

struct RuntimeCommand {
    kind: &'static str,
    program: PathBuf,
    args: Vec<String>,
    current_dir: Option<PathBuf>,
}

fn runtime_command(resource_dir: Option<&Path>) -> RuntimeCommand {
    if let Ok(runtime_bin) = env::var("OUROBOROS_RUNTIME_BIN") {
        return RuntimeCommand {
            kind: "env_runtime_bin",
            program: PathBuf::from(runtime_bin),
            args: Vec::new(),
            current_dir: None,
        };
    }

    if let Some(bundled_runtime) = bundled_runtime_executable(resource_dir) {
        return RuntimeCommand {
            kind: "bundled_runtime_sidecar",
            program: bundled_runtime,
            args: Vec::new(),
            current_dir: resource_dir.map(Path::to_path_buf),
        };
    }

    RuntimeCommand {
        kind: "source_checkout_tsx_runtime",
        program: source_checkout_tsx_program(),
        args: vec!["apps/runtime/src/main.ts".to_string()],
        current_dir: Some(repo_root()),
    }
}

fn source_checkout_tsx_program() -> PathBuf {
    let repo_root = repo_root();
    let local_tsx = repo_root
        .join("node_modules")
        .join(".bin")
        .join(if cfg!(windows) { "tsx.cmd" } else { "tsx" });

    if local_tsx.is_file() {
        local_tsx
    } else {
        PathBuf::from(if cfg!(windows) { "tsx.cmd" } else { "tsx" })
    }
}

fn bundled_runtime_executable(resource_dir: Option<&Path>) -> Option<PathBuf> {
    let resource_dir = resource_dir?;
    [
        resource_dir.join("runtime").join("ouroboros-runtime"),
        resource_dir
            .join("resources")
            .join("runtime")
            .join("ouroboros-runtime"),
    ]
    .into_iter()
    .find(|path| path.is_file())
}

fn stop_runtime(runtime_process: RuntimeProcess) {
    if let Ok(mut guard) = runtime_process.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn reap_finished_runtime_child(runtime_process: &RuntimeProcess) {
    if let Ok(mut guard) = runtime_process.0.lock() {
        let finished = guard
            .as_mut()
            .map(|child| matches!(child.try_wait(), Ok(Some(_))))
            .unwrap_or(false);
        if finished {
            *guard = None;
        }
    }
}

fn runtime_host() -> String {
    env::var("OUROBOROS_DESKTOP_RUNTIME_HOST").unwrap_or_else(|_| DEFAULT_RUNTIME_HOST.to_string())
}

fn runtime_port() -> u16 {
    env::var("OUROBOROS_DESKTOP_RUNTIME_PORT")
        .or_else(|_| env::var("PORT"))
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(DEFAULT_RUNTIME_PORT)
}

fn runtime_reachable(host: &str, port: u16) -> bool {
    let Ok(address) = format!("{host}:{port}").parse::<SocketAddr>() else {
        return false;
    };
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn wait_for_compatible_runtime(host: &str, port: u16, timeout: Duration) -> bool {
    let started_at = Instant::now();
    while started_at.elapsed() <= timeout {
        if runtime_compatible(host, port) {
            return true;
        }
        thread::sleep(Duration::from_millis(250));
    }
    false
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}
