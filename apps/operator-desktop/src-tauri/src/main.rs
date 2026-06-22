use std::{
    env,
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
    Manager,
};

const DEFAULT_RUNTIME_HOST: &str = "127.0.0.1";
const DEFAULT_RUNTIME_PORT: u16 = 4173;
const MAIN_WINDOW_LABEL: &str = "main";
const STATUS_TRAY_ID: &str = "ouroboros-runtime-status";
const STATUS_MENU_ID: &str = "ouroboros-runtime-status-label";
const OPEN_MENU_ID: &str = "ouroboros-open-operator";
const HIDE_MENU_ID: &str = "ouroboros-hide-operator";
const RESTART_RUNTIME_MENU_ID: &str = "ouroboros-restart-runtime";
const QUIT_MENU_ID: &str = "ouroboros-quit-operator";

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
            update_runtime_status_tray(app.handle());
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
    let restart =
        MenuItemBuilder::with_id(RESTART_RUNTIME_MENU_ID, "Restart Runtime").build(app)?;
    let quit = MenuItemBuilder::with_id(QUIT_MENU_ID, "Quit Ouroboros").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&status)
        .separator()
        .item(&open)
        .item(&hide)
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
        ensure_runtime_running(runtime_process.clone(), resource_dir.clone());
        update_runtime_status_tray(&app_handle);
    });
}

fn ensure_runtime_running(runtime_process: RuntimeProcess, resource_dir: Option<PathBuf>) {
    let host = runtime_host();
    let port = runtime_port();
    if runtime_reachable(&host, port) {
        reap_finished_runtime_child(&runtime_process);
        return;
    }

    stop_runtime(runtime_process.clone());
    if let Err(message) = start_runtime_if_needed(runtime_process, resource_dir) {
        eprintln!("{message}");
    }
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
    let runtime_status = if runtime_reachable(&host, port) {
        RuntimeStatus::Running
    } else {
        RuntimeStatus::Off
    };

    if let Some(tray) = app_handle.tray_by_id(STATUS_TRAY_ID) {
        let _ = tray.set_title(Some(runtime_status.menu_bar_title()));
        let _ = tray.set_tooltip(Some(runtime_status.tooltip(&host, port)));
    }
}

fn show_main_window(app_handle: &tauri::AppHandle) {
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
    Running,
    Off,
}

impl RuntimeStatus {
    fn menu_bar_title(&self) -> &'static str {
        match self {
            Self::Running => "Ouroboros RUN",
            Self::Off => "Ouroboros OFF",
        }
    }

    fn tooltip(&self, host: &str, port: u16) -> String {
        match self {
            Self::Running => {
                format!("Ouroboros runtime status: running at http://{host}:{port}")
            }
            Self::Off => format!("Ouroboros runtime status: off at http://{host}:{port}"),
        }
    }
}

fn start_runtime_if_needed(
    runtime_process: RuntimeProcess,
    resource_dir: Option<PathBuf>,
) -> Result<(), String> {
    let host = runtime_host();
    let port = runtime_port();
    if runtime_reachable(&host, port) {
        return Ok(());
    }

    let runtime_url = format!("http://{host}:{port}");
    let runtime_command = runtime_command(resource_dir.as_deref());
    let mut command = Command::new(&runtime_command.program);
    command
        .args(&runtime_command.args)
        .env("HOST", &host)
        .env("PORT", port.to_string())
        .env("OUROBOROS_RUNTIME_URL", &runtime_url)
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

    if !wait_for_runtime(&host, port, Duration::from_secs(15)) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!(
            "operator_desktop_runtime_unreachable:{runtime_url}"
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

fn wait_for_runtime(host: &str, port: u16, timeout: Duration) -> bool {
    let started_at = Instant::now();
    while started_at.elapsed() <= timeout {
        if runtime_reachable(host, port) {
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
