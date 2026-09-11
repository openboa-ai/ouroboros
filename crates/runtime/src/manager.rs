//! One admitted contained execution. Fixed Docker endpoint; private argv never runs on the host.
use super::docker_backend::{connect_docker, docker_binding};
pub use super::reconciliation::reconcile;
use super::reporting::{change, journal, record_return_ack, send_program_observation};
use anyhow::{Context, Result, ensure};
use bollard::{
    Docker, exec::StartExecResults, models::ExecConfig, query_parameters::CreateContainerOptions,
};
use futures_util::StreamExt;
use ouroboros_contracts::{AllocationClosure, ComputeReturnReceipt, RuntimeBinding, RuntimeTicket};
use ouroboros_transport::TlsFiles;
use serde::Deserialize;
use serde_json::json;
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::{
        fd::AsRawFd,
        unix::{
            fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
            process::CommandExt,
        },
    },
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};
use tokio::io::{AsyncBufReadExt, BufReader};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub core_url: String,
    pub tls: TlsFiles,
    pub profile_id: String,
    pub profile: super::Profile,
    #[serde(default)]
    pub program: Option<ouroboros_contracts::ProgramProfile>,
    pub ipc_root: PathBuf,
    pub gateway_socket: PathBuf,
    pub gateway_uid: u32,
    pub binary_dir: PathBuf,
    pub evidence_dir: PathBuf,
    pub bridge_uid: u32,
    pub guard_uid: u32,
    #[serde(default)]
    pub managed_guard: Option<super::guard_process::ManagedConfig>,
}
impl Config {
    pub fn resolve_paths(&mut self, root: &ouroboros_transport::config::ConfigRoot) -> Result<()> {
        root.resolve(&mut self.profile.docker_socket)?;
        root.resolve(&mut self.ipc_root)?;
        root.resolve(&mut self.gateway_socket)?;
        root.resolve(&mut self.binary_dir)?;
        root.resolve(&mut self.evidence_dir)?;
        if let Some(guard) = &mut self.managed_guard {
            root.resolve(&mut guard.systemd_run)?;
            root.resolve(&mut guard.systemctl)?;
            root.resolve(&mut guard.setpriv)?;
        }
        self.tls.resolve_paths(root)
    }
}
pub(super) fn supervisor_lock(root: &Path) -> Result<File> {
    let meta = std::fs::symlink_metadata(root)?;
    ensure!(
        meta.is_dir()
            && !meta.file_type().is_symlink()
            && meta.uid() == 0
            && meta.permissions().mode() & 0o077 == 0,
        "Runtime root must be private and outer-owned"
    );
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .mode(0o600)
        .open(root.join("supervisor.lock"))?;
    ensure!(
        unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
        "another Runtime owns this configured execution slot"
    );
    Ok(lock)
}
fn clock() -> Result<u64> {
    let mut t: libc::timespec = unsafe { std::mem::zeroed() };
    ensure!(
        unsafe { libc::clock_gettime(libc::CLOCK_BOOTTIME, &mut t) } == 0,
        "clock unavailable"
    );
    Ok((t.tv_sec as u64) * 1_000_000_000 + t.tv_nsec as u64)
}
fn inherit(command: &mut Command, fd: i32, guard_uid: Option<u32>) {
    // Only async-signal-safe calls in the fork/exec window. All other handles stay CLOEXEC.
    unsafe {
        command.pre_exec(move || {
            if libc::fcntl(fd, libc::F_SETFD, 0) == -1 {
                return Err(std::io::Error::last_os_error());
            }
            if let Some(uid) = guard_uid
                && (libc::setsid() == -1
                    || libc::setgroups(0, std::ptr::null()) == -1
                    || libc::setgid(uid) == -1
                    || libc::setuid(uid) == -1
                    || libc::prctl(libc::PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) == -1)
            {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
}
async fn ready(child: &mut tokio::process::Child, expected: &str) -> Result<()> {
    let stdout = child.stdout.take().context("missing readiness stream")?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    tokio::time::timeout(Duration::from_secs(3), reader.read_line(&mut line)).await??;
    ensure!(line.trim() == expected, "process failed readiness");
    Ok(())
}
pub async fn run(cfg: Config) -> Result<()> {
    let stop = super::shutdown::Stop::listen()?;
    let _slot = supervisor_lock(&cfg.evidence_dir)?;
    ensure!(
        run_one(&cfg, Duration::from_secs(30), &stop).await? || stop.requested(),
        "no admitted execution in bounded wait"
    );
    Ok(())
}

/// Own one execution slot across a finite series of independently admitted executions.
/// An error ends the worker; it never retries an ambiguous claim or invents work.
pub async fn serve(cfg: Config, max_executions: u16, idle_seconds: u16) -> Result<()> {
    ensure!(
        (1..=100).contains(&max_executions) && (1..=300).contains(&idle_seconds),
        "invalid worker bounds"
    );
    let _slot = supervisor_lock(&cfg.evidence_dir)?;
    let stop = super::shutdown::Stop::listen()?;
    let mut completed = 0;
    while completed < max_executions {
        if !run_one(&cfg, Duration::from_secs(u64::from(idle_seconds)), &stop).await? {
            println!(
                "{}",
                json!({"worker":if stop.requested() {"stop_requested"} else {"idle_limit_reached"},"completed_executions":completed})
            );
            return Ok(());
        }
        completed += 1;
    }
    println!(
        "{}",
        json!({"worker":"execution_limit_reached","completed_executions":completed})
    );
    Ok(())
}

async fn run_one(cfg: &Config, idle: Duration, stop: &super::shutdown::Stop) -> Result<bool> {
    ensure!(
        unsafe { libc::geteuid() } == 0,
        "Runtime requires the dedicated trusted Linux supervisor"
    );
    cfg.profile.validate()?;
    if let Some(guard) = &cfg.managed_guard {
        guard.validate()?;
    }
    ensure!(
        (matches!(cfg.profile_id.as_str(), "gateway-probe" | "codex-fixture")
            && cfg.program.is_none()
            || cfg.program.is_some()
                && !cfg.profile_id.is_empty()
                && !matches!(cfg.profile_id.as_str(), "gateway-probe" | "codex-fixture"))
            && cfg.bridge_uid >= 100000
            && cfg.guard_uid >= 100000
            && cfg.bridge_uid != cfg.guard_uid,
        "unqualified execution profile"
    );
    if let Some(program) = &cfg.program {
        super::program::validate_profile(&cfg.profile, program)?;
    }
    let url = reqwest::Url::parse(&cfg.core_url)?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none()
            && url.path() == "/",
        "fixed Core URL required"
    );
    ensure!(
        cfg.ipc_root.is_absolute()
            && cfg.gateway_socket.is_absolute()
            && cfg.binary_dir.is_absolute()
            && cfg.evidence_dir.is_absolute()
            && cfg.gateway_uid != 65532
            && cfg.gateway_uid != cfg.bridge_uid
            && cfg.gateway_uid != cfg.guard_uid,
        "fixed outer paths required"
    );
    let meta = std::fs::symlink_metadata(&cfg.evidence_dir)?;
    ensure!(
        meta.is_dir() && meta.uid() == 0 && meta.permissions().mode() & 0o077 == 0,
        "evidence root must be private to Runtime"
    );
    let client = ouroboros_transport::client(&cfg.tls)?;
    let base = cfg.core_url.trim_end_matches('/');
    let backend = docker_binding(cfg)?;
    let gateway =
        super::socket::SocketBinding::capture(&cfg.ipc_root, &cfg.gateway_socket, cfg.gateway_uid)?;
    backend.probe().await?;
    gateway.probe().await?;
    let docker = connect_docker(&backend)?;
    // No image pull, endpoint discovery, backend fallback or image-build capability.
    docker.inspect_image(&cfg.profile.image).await?;
    let end = tokio::time::Instant::now() + idle;
    let intent = loop {
        if stop.requested() {
            return Ok(false);
        }
        backend.ready()?;
        gateway.ready()?;
        let ids: Vec<uuid::Uuid> = client
            .get(format!("{base}/runtime/pending"))
            .query(&[("profile", &cfg.profile_id)])
            .timeout(Duration::from_secs(2))
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        if let Some(id) = ids.first() {
            break *id;
        }
        if tokio::time::Instant::now() >= end {
            return Ok(false);
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    };
    backend.probe().await?;
    gateway.probe().await?;
    if stop.requested() {
        return Ok(false);
    }
    // Do not cancel an in-flight claim: a lost response may already own a reservation.
    let ticket: RuntimeTicket = client
        .post(format!("{base}/runtime/claims/{intent}"))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    backend.ready()?;
    gateway.ready()?;
    ensure!(
        ticket.input.profile_id == cfg.profile_id
            && ticket.input.lifetime_seconds > 0
            && ticket.input.lifetime_seconds as u64 <= cfg.profile.lifetime_seconds,
        "admitted profile mismatch"
    );
    super::program::validate_ticket(&cfg.profile, cfg.program.as_ref(), &ticket)?;
    let root = cfg.evidence_dir.join(ticket.instance_id.to_string());
    std::fs::create_dir(&root)?;
    std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700))?;
    let name = format!("ouro-{}", ticket.instance_id.simple());
    journal(
        &root,
        "intent.json",
        &json!({"ticket":ticket,"container_name":name,"profile":cfg.profile,"program_profile":cfg.program}),
    )?;
    let body = super::docker_backend::container_spec(cfg, &ticket);
    let created = docker
        .create_container(
            Some(CreateContainerOptions {
                name: Some(name),
                ..Default::default()
            }),
            body,
        )
        .await?;
    let cid = created.id;
    journal(&root, "container.json", &json!({"container_id":cid}))?;
    let outcome = execute(
        (cfg, stop),
        &client,
        &docker,
        (&backend, &gateway),
        &ticket,
        &cid,
        &root,
    )
    .await;
    // Cleanup is containment, not effect settlement. A failed cleanup stays explicit in the journal.
    let killed = docker.kill_container(&cid, None).await;
    let actual = docker.inspect_container(&cid, None).await;
    let terminated = actual.as_ref().ok().is_some_and(|actual| {
        actual.id.as_deref() == Some(cid.as_str())
            && actual
                .config
                .as_ref()
                .and_then(|c| c.labels.as_ref())
                .and_then(|labels| labels.get("ouroboros.instance"))
                == Some(&ticket.instance_id.to_string())
            && actual.state.as_ref().and_then(|state| state.running) == Some(false)
    });
    journal(
        &root,
        "finish.json",
        &json!({"runtime_success":outcome.is_ok(),"kill_ack":killed.is_ok(),"terminated_observed":terminated,"effects_settled":false}),
    )?;
    if terminated {
        change(&client, base, ticket.execution_id, "terminated", json!({})).await?;
        let candidate_path = root.join("compute-return-candidate.json");
        match std::fs::read(&candidate_path) {
            Ok(bytes) => {
                let mut receipt: ComputeReturnReceipt = serde_json::from_slice(&bytes)?;
                ensure!(
                    receipt.instance_id == ticket.instance_id
                        && receipt.generation == ticket.generation
                        && receipt.binding.container_id == cid,
                    "return candidate identity mismatch"
                );
                receipt.container_terminated = true;
                // Save the exact request before sending. Response loss retains this for reconciliation.
                journal(&root, "compute-return.json", &json!(receipt))?;
                change(
                    &client,
                    base,
                    ticket.execution_id,
                    "compute-return",
                    json!(receipt),
                )
                .await?;
                record_return_ack(&root)?;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    ensure!(terminated, "actual termination remains unresolved");
    outcome?;
    println!(
        "{}",
        json!({"execution_id":ticket.execution_id,"instance_id":ticket.instance_id,"terminated":true,"effects_settled":false})
    );
    Ok(true)
}
async fn execute(
    runtime: (&Config, &super::shutdown::Stop),
    client: &reqwest::Client,
    docker: &Docker,
    bindings: (&super::socket::SocketBinding, &super::socket::SocketBinding),
    ticket: &RuntimeTicket,
    cid: &str,
    root: &Path,
) -> Result<()> {
    let (cfg, stop) = runtime;
    let (backend, gateway) = bindings;
    ensure!(
        !stop.requested(),
        "Runtime stop requested before payload start"
    );
    backend.probe().await?;
    gateway.probe().await?;
    let base = cfg.core_url.trim_end_matches('/');
    // Check current authority immediately before the externally effective start.
    client
        .get(format!("{base}/runtime/executions/{}", ticket.execution_id))
        .timeout(Duration::from_secs(2))
        .send()
        .await?
        .error_for_status()?;
    docker.start_container(cid, None).await?;
    let detail = docker.inspect_container(cid, None).await?;
    let pid = super::docker_backend::started_pid(cfg, &detail)?;
    let path = std::fs::read_to_string(format!("/proc/{pid}/cgroup"))?;
    let relative = path
        .strip_prefix("0::/")
        .context("cgroup v2 required")?
        .trim();
    ensure!(
        !relative.is_empty() && !relative.split('/').any(|p| p == ".."),
        "invalid cgroup"
    );
    let cgroup = Path::new("/sys/fs/cgroup").join(relative);
    let allocation = super::allocation::PinnedCgroup::capture(&cgroup)?;
    journal(
        root,
        "allocation.json",
        &json!({"instance_id":ticket.instance_id,"generation":ticket.generation,"cgroup":allocation.identity}),
    )?;
    let mut kill = allocation.kill_handle()?;
    let deadline = clock()?
        .checked_add((ticket.input.lifetime_seconds as u64) * 1_000_000_000)
        .context("deadline overflow")?;
    let mut guard = if let Some(config) = &cfg.managed_guard {
        super::guard_process::Guard::managed(
            config,
            &cfg.binary_dir.join("ouroboros-guard"),
            (&kill, &allocation.events_handle()?, root),
            cfg.guard_uid,
            deadline,
            ticket.instance_id,
        )
        .await?
    } else {
        let mut cmd = Command::new(cfg.binary_dir.join("ouroboros-guard"));
        cmd.args([kill.as_raw_fd().to_string(), deadline.to_string()])
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        inherit(&mut cmd, kill.as_raw_fd(), Some(cfg.guard_uid));
        let mut guard = tokio::process::Command::from(cmd).spawn()?;
        ready(&mut guard, &format!("armed {deadline}")).await?;
        super::guard_process::Guard::Direct(guard)
    };
    let mut guard_binding = guard.observation();
    guard_binding["instance_id"] = json!(ticket.instance_id);
    guard_binding["generation"] = json!(ticket.generation);
    guard_binding["deadline_boottime_ns"] = json!(deadline);
    journal(root, "guard-binding.json", &guard_binding)?;
    // kill_on_drop is deliberately not enabled: the guard survives supervisor failure.
    let ns = File::open(format!("/proc/{pid}/ns/net"))?;
    let mut cmd = Command::new(cfg.binary_dir.join("ouroboros-bridge"));
    cmd.args([
        ns.as_raw_fd().to_string(),
        cfg.ipc_root.to_string_lossy().into_owned(),
        cfg.gateway_socket.to_string_lossy().into_owned(),
        cfg.gateway_uid.to_string(),
        cfg.bridge_uid.to_string(),
        cfg.bridge_uid.to_string(),
        "18080".into(),
    ])
    .env_clear()
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::from(
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(root.join("bridge-launch.log"))?,
    ));
    inherit(&mut cmd, ns.as_raw_fd(), None);
    let mut command = tokio::process::Command::from(cmd);
    command.kill_on_drop(true);
    let mut bridge = command.spawn()?;
    ready(&mut bridge, "bridge_ready").await?;
    gateway.probe().await?;
    backend.ready()?;
    let bridge_pid = bridge.id().context("bridge PID lost")? as i32;
    let binding = RuntimeBinding {
        allocation: Some(allocation.identity.clone()),
        container_id: cid.into(),
        peer: ouroboros_transport::linux_peer(bridge_pid, cfg.bridge_uid)?,
        deadline_boottime_ns: deadline,
    };
    journal(root, "binding.json", &json!(binding))?;
    change(client, base, ticket.execution_id, "bind", json!(binding)).await?;
    if cfg.program.is_none() {
        change(client, base, ticket.execution_id, "release", json!({})).await?;
    }
    let activity = async {
        if cfg.program.is_some() {
            let program = async {
                let receipt = super::program::materialize(docker, cid, ticket).await?;
                journal(root, "materialization.json", &json!(receipt))?;
                change(
                    client,
                    base,
                    ticket.execution_id,
                    "materialized",
                    json!(receipt),
                )
                .await?;
                change(client, base, ticket.execution_id, "release", json!({})).await?;
                if cfg.program.as_ref().is_some_and(|p| p.native_codex) {
                    backend.ready()?;
                    gateway.ready()?;
                    client
                        .get(format!("{base}/runtime/executions/{}", ticket.execution_id))
                        .timeout(Duration::from_secs(1))
                        .send()
                        .await?
                        .error_for_status()?;
                    ensure!(clock()? < deadline, "native launch deadline elapsed");
                    return super::native_fixture::run(
                        docker,
                        cid,
                        root,
                        (client, base, ticket.execution_id),
                        Some(ticket),
                    )
                    .await;
                }
                super::program::run(docker, cid, root, ticket, || async {
                    backend.ready()?;
                    gateway.ready()?;
                    client
                        .get(format!("{base}/runtime/executions/{}", ticket.execution_id))
                        .timeout(Duration::from_secs(1))
                        .send()
                        .await?
                        .error_for_status()?;
                    ensure!(clock()? < deadline, "program launch deadline elapsed");
                    Ok(())
                })
                .await?;
                send_program_observation(client, base, root, ticket).await
            };
            tokio::pin!(program);
            tokio::select! {
                biased;
                result = supervise_program(client, base, ticket.execution_id, (backend, gateway), deadline, &mut bridge, &mut guard) => return result,
                result = &mut program => return result,
            }
        }
        if cfg.profile_id == "codex-fixture" {
            let native = super::native_fixture::run(
                docker,
                cid,
                root,
                (client, base, ticket.execution_id),
                None,
            );
            tokio::pin!(native);
            let mut interval = tokio::time::interval(Duration::from_millis(200));
            loop {
                tokio::select! {
                    result = &mut native => return result,
                    _ = interval.tick() => {
                        backend.ready()?;
                        gateway.ready()?;
                        client.get(format!("{base}/runtime/executions/{}",ticket.execution_id)).timeout(Duration::from_secs(1)).send().await?.error_for_status()?;
                        ensure!(clock()? < deadline && bridge.try_wait()?.is_none() && guard.is_alive()?, "native execution lost its containment lifetime");
                    }
                }
            }
        }
        // This fixed environment probe contains no provider credentials or client-supplied shell.
        let exec=docker.create_exec(cid,ExecConfig{attach_stdout:Some(true),attach_stderr:Some(true),cmd:Some(vec!["/bin/sh".into(),"-c".into(),"while :; do wget -T 1 -qO- http://127.0.0.1:18080/conditions || exit 23; echo; sleep 1; done".into()]),user:Some("65532:65532".into()),privileged:Some(false),..Default::default()}).await?;
        let StartExecResults::Attached { mut output, .. } =
            docker.start_exec(&exec.id, None).await?
        else {
            anyhow::bail!("probe stream not attached")
        };
        let mut evidence = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(root.join("probe.jsonl"))?;
        let mut bytes = 0;
        let mut interval = tokio::time::interval(Duration::from_millis(200));
        loop {
            tokio::select! {
                next=output.next()=>match next {Some(Ok(chunk))=>{let data=chunk.into_bytes();bytes+=data.len();ensure!(bytes<=65_536,"probe evidence bound exhausted");evidence.write_all(&data)?;evidence.sync_data()?;},Some(Err(_))=>anyhow::bail!("probe stream lost"),None=>break},
                _=interval.tick()=>{
                    backend.ready()?;
                    gateway.ready()?;
                    let permit=client.get(format!("{base}/runtime/executions/{}",ticket.execution_id)).timeout(Duration::from_secs(1)).send().await;
                    if permit.as_ref().is_err() || !permit?.status().is_success() || clock()?>=deadline || bridge.try_wait()?.is_some() || !guard.is_alive()?{break;}
                }
            }
        }
        Ok::<(), anyhow::Error>(())
    };
    let result = tokio::select! {
        biased;
        _ = stop.wait() => {
            journal(root, "stop-request.json", &json!({"source":"host_signal","effects_settled":false}))
                .and(Err(anyhow::anyhow!("Runtime stop requested; private activity interrupted")))
        }
        result = activity => result,
    };
    // The exact already-open cgroup handle cannot be redirected to a replacement container.
    kill.write_all(b"1")?;
    let bridge_terminated = matches!(
        tokio::time::timeout(Duration::from_secs(2), bridge.kill()).await,
        Ok(Ok(()))
    );
    let mut state = allocation.observe();
    for _ in 0..100 {
        if !matches!(state, Ok(super::allocation::State::Populated)) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
        state = allocation.observe();
    }
    let closure = match &state {
        Ok(super::allocation::State::Empty) => Some(AllocationClosure::Empty),
        Ok(super::allocation::State::Deactivated) => Some(AllocationClosure::Deactivated),
        _ => None,
    };
    // Retire the original owned deadline child only after its protected payload is gone.
    // Unknown/populated cgroups retain the independent deadline, even when bridge closure fails.
    let guard_terminated = if closure.is_some() && bridge_terminated {
        matches!(
            tokio::time::timeout(Duration::from_secs(2), guard.kill()).await,
            Ok(Ok(()))
        )
    } else {
        false
    };
    journal(
        root,
        "allocation-observation.json",
        &json!({
            "source":"runtime_kernel", "instance_id":ticket.instance_id,"generation":ticket.generation,
            "cgroup":allocation.identity, "state":state.ok(), "bridge":binding.peer,
            "bridge_terminated":bridge_terminated,"guard_terminated":guard_terminated,
            "capacity_returned":false,"effects_settled":false
        }),
    )?;
    if let Some(cgroup) = closure.filter(|_| bridge_terminated && guard_terminated) {
        let candidate = ComputeReturnReceipt {
            instance_id: ticket.instance_id,
            generation: ticket.generation,
            binding,
            cgroup,
            container_terminated: false,
            bridge_terminated,
            guard_terminated,
        };
        journal(root, "compute-return-candidate.json", &json!(candidate))?;
    }
    result
}

async fn supervise_program(
    client: &reqwest::Client,
    base: &str,
    execution: uuid::Uuid,
    bindings: (&super::socket::SocketBinding, &super::socket::SocketBinding),
    deadline: u64,
    bridge: &mut tokio::process::Child,
    guard: &mut super::guard_process::Guard,
) -> Result<()> {
    loop {
        bindings.0.ready()?;
        bindings.1.ready()?;
        client
            .get(format!("{base}/runtime/executions/{execution}"))
            .timeout(Duration::from_secs(1))
            .send()
            .await?
            .error_for_status()?;
        ensure!(
            clock()? < deadline && bridge.try_wait()?.is_none() && guard.is_alive()?,
            "program execution lost its containment lifetime"
        );
        // This independent future keeps control responsive even when private stdout is hot.
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}
