//! A managed launch helper is not the guard. Hold the actual guard's pidfd until closure.
use anyhow::{Context, Result, ensure};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{
    fs::File,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::fs::{MetadataExt, OpenOptionsExt},
    },
    path::{Path, PathBuf},
    process::Stdio,
    time::Duration,
};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
};

fn protected_executable(path: &Path) -> Result<()> {
    ensure!(
        path.is_absolute(),
        "absolute guard executable path required"
    );
    let resolved = std::fs::canonicalize(path)?;
    for candidate in [path, resolved.as_path()] {
        let info = std::fs::metadata(candidate)?;
        ensure!(
            info.is_file() && info.uid() == 0 && info.mode() & 0o022 == 0,
            "guard executable must be protected and root-owned"
        );
        for parent in candidate.ancestors().skip(1) {
            let info = std::fs::metadata(parent)?;
            ensure!(
                info.is_dir() && info.uid() == 0 && info.mode() & 0o022 == 0,
                "guard executable ancestor is writable or untrusted"
            );
        }
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ManagedConfig {
    pub systemd_run: PathBuf,
    pub systemctl: PathBuf,
    pub setpriv: PathBuf,
    pub memory_max_bytes: u64,
    pub tasks_max: u32,
}
impl ManagedConfig {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.memory_max_bytes > 0 && self.tasks_max > 0,
            "explicit guard-unit limits required"
        );
        for path in [&self.systemd_run, &self.systemctl, &self.setpriv] {
            protected_executable(path)?;
        }
        Ok(())
    }
}

pub enum Guard {
    Direct(Child),
    Managed {
        helper: Child,
        process: File,
        identity: ouroboros_contracts::BridgeIdentity,
        unit: String,
        receipt_identity: (u64, u64),
    },
}

fn exited(process: &File) -> Result<bool> {
    let mut descriptor = libc::pollfd {
        fd: process.as_raw_fd(),
        events: libc::POLLIN,
        revents: 0,
    };
    // SAFETY: poll receives one live pollfd and a zero timeout; the File owns the pidfd.
    let result = unsafe { libc::poll(&mut descriptor, 1, 0) };
    if result < 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    ensure!(
        descriptor.revents & (libc::POLLERR | libc::POLLNVAL) == 0,
        "guard process handle invalid"
    );
    Ok(descriptor.revents & (libc::POLLIN | libc::POLLHUP) != 0)
}

/// Read-only recovery observation. Never signal a process or reconstruct a capacity receipt.
pub fn observe_recorded(
    root: &Path,
    instance: uuid::Uuid,
    generation: uuid::Uuid,
    deadline: u64,
    uid: u32,
) -> Result<Value> {
    let bytes = match std::fs::read(root.join("guard-binding.json")) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(json!({"state":"not_recorded"}));
        }
        Err(error) => return Err(error.into()),
    };
    ensure!(bytes.len() <= 8192, "guard record exceeds bound");
    let record: Value = serde_json::from_slice(&bytes)?;
    if record["backend"] == "direct_child" {
        return Ok(json!({"state":"direct_child_unqualified"}));
    }
    ensure!(
        record["backend"] == "systemd"
            && record["instance_id"] == json!(instance)
            && record["generation"] == json!(generation)
            && record["deadline_boottime_ns"] == json!(deadline)
            && record["unit"] == format!("ouroboros-guard-{instance}.service"),
        "recorded guard binding mismatch"
    );
    let identity: ouroboros_contracts::BridgeIdentity =
        serde_json::from_value(record["identity"].clone())?;
    ensure!(
        identity.pid > 0 && identity.uid == uid,
        "recorded guard identity mismatch"
    );
    let state = observe_identity(&identity)?;
    Ok(
        json!({"state":state,"source":"runtime_kernel","recorded_identity":identity,
        "deadline_boottime_ns":deadline,"capacity_returned":false,"effects_settled":false}),
    )
}

pub fn observe_identity(identity: &ouroboros_contracts::BridgeIdentity) -> Result<&'static str> {
    let boot = std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?;
    Ok(if boot.trim() != identity.boot_id {
        "different_boot"
    } else {
        // SAFETY: opens a new pidfd; no signal is sent through this recovery handle.
        let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, identity.pid, 0) } as i32;
        if fd < 0 {
            let error = std::io::Error::last_os_error();
            ensure!(
                error.raw_os_error() == Some(libc::ESRCH),
                "recorded guard observation unavailable"
            );
            "gone"
        } else {
            let process = unsafe { File::from_raw_fd(fd) };
            if exited(&process)? {
                "gone"
            } else {
                let current = ouroboros_transport::linux_peer(identity.pid, identity.uid)?;
                if current != *identity {
                    "pid_reused"
                } else if exited(&process)? {
                    "gone"
                } else {
                    "running"
                }
            }
        }
    })
}

pub fn recover_closure(
    root: &Path,
    binding: &ouroboros_contracts::RuntimeBinding,
    guard: &Value,
) -> Result<Option<ouroboros_contracts::AllocationClosure>> {
    use std::io::Read;
    if !matches!(guard["state"].as_str(), Some("gone" | "pid_reused"))
        || !matches!(observe_identity(&binding.peer)?, "gone" | "pid_reused")
    {
        return Ok(None);
    }
    let Some(allocation) = &binding.allocation else {
        return Ok(None);
    };
    ensure!(
        std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?.trim()
            == allocation.boot_id.to_string(),
        "allocation closure belongs to another boot"
    );
    let record: Value = serde_json::from_slice(&std::fs::read(root.join("guard-binding.json"))?)?;
    if record.get("receipt_file").is_none() {
        return Ok(None);
    }
    let file = match std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(root.join("guard-closure.json"))
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let meta = file.metadata()?;
    ensure!(
        meta.is_file()
            && meta.uid() == 0
            && meta.nlink() == 1
            && meta.mode() & 0o077 == 0
            && record["receipt_file"]["device"] == json!(meta.dev())
            && record["receipt_file"]["inode"] == json!(meta.ino()),
        "guard receipt file identity mismatch"
    );
    if meta.len() == 0 {
        return Ok(None);
    }
    ensure!(meta.len() <= 4096, "guard receipt exceeds bound");
    let mut bytes = Vec::new();
    (&file).take(4097).read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() <= 4096 && bytes.ends_with(b"\n"),
        "incomplete guard receipt"
    );
    let closure: super::guard_handoff::Closure = serde_json::from_slice(&bytes)?;
    ensure!(
        closure.deadline_boottime_ns == binding.deadline_boottime_ns
            && closure.events_device == allocation.device
            && closure.events_inode == allocation.events_inode,
        "guard receipt allocation mismatch"
    );
    // Persist the original evidence before creating the Core return request, even if the
    // guard could not acknowledge its own final fsync before it exited.
    file.sync_all()?;
    Ok(Some(closure.state))
}

impl Guard {
    pub async fn managed(
        cfg: &ManagedConfig,
        executable: &Path,
        target: (&File, &File, &Path),
        uid: u32,
        deadline: u64,
        instance: uuid::Uuid,
    ) -> Result<Self> {
        cfg.validate()?;
        let (kill, events, root) = target;
        let receipt = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(root.join("guard-closure.json"))?;
        File::open(root)?.sync_all()?;
        let metadata = receipt.metadata()?;
        let receipt_identity = (metadata.dev(), metadata.ino());
        let (sender, receiver) = std::os::unix::net::UnixDatagram::pair()?;
        protected_executable(executable)?;
        ensure!(
            uid >= 100000,
            "qualified nonprivileged guard identity required"
        );
        let unit = format!("ouroboros-guard-{instance}.service");
        let mut command = Command::new(&cfg.systemd_run);
        command
            .args([
                "--quiet",
                "--pipe",
                "--wait",
                "--collect",
                "--service-type=exec",
            ])
            .arg(format!("--unit={unit}"))
            .args([
                "--property=Restart=no",
                "--property=NoNewPrivileges=yes",
                "--property=CapabilityBoundingSet=CAP_SETUID CAP_SETGID",
                "--property=ProtectSystem=strict",
                "--property=ProtectHome=read-only",
                "--property=PrivateNetwork=yes",
                "--property=ProtectControlGroups=yes",
                "--property=PrivateTmp=yes",
            ])
            .arg(format!("--property=MemoryMax={}", cfg.memory_max_bytes))
            .arg(format!("--property=TasksMax={}", cfg.tasks_max))
            .arg(&cfg.setpriv)
            .arg(format!("--reuid={uid}"))
            .arg(format!("--regid={uid}"))
            .args(["--clear-groups", "--no-new-privs"])
            .arg(executable)
            .arg("--receive")
            .arg(deadline.to_string())
            .env_clear()
            .stdin(Stdio::from(std::os::fd::OwnedFd::from(receiver)))
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        // Neither an error nor dropping Runtime may cancel the armed guard unit.
        let mut helper = command.spawn()?;
        super::guard_handoff::send(&sender, [kill, events, &receipt])?;
        let mut reader = BufReader::new(helper.stdout.take().context("guard readiness missing")?);
        let mut line = String::new();
        tokio::time::timeout(Duration::from_secs(3), reader.read_line(&mut line)).await??;
        ensure!(
            line.trim() == format!("armed {deadline}"),
            "managed guard failed readiness"
        );
        let output = tokio::time::timeout(
            Duration::from_secs(2),
            Command::new(&cfg.systemctl)
                .args(["show", &unit, "--property=MainPID", "--value"])
                .env_clear()
                .kill_on_drop(true)
                .output(),
        )
        .await??;
        ensure!(
            output.status.success() && output.stdout.len() < 32,
            "guard unit identity unavailable"
        );
        let pid: i32 = std::str::from_utf8(&output.stdout)?.trim().parse()?;
        ensure!(pid > 0, "guard unit has no live process");
        // SAFETY: pidfd_open returns a new descriptor or -1; ownership is taken only on success.
        let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) } as i32;
        ensure!(fd >= 0, "cannot pin guard process");
        let process = unsafe { File::from_raw_fd(fd) };
        ensure!(!exited(&process)?, "guard exited before binding");
        let identity = ouroboros_transport::linux_peer(pid, uid)?;
        let status = std::fs::read_to_string(format!("/proc/{pid}/status"))?;
        let field = |name: &str| -> Result<&str> {
            status
                .lines()
                .find_map(|line| line.strip_prefix(name))
                .context("guard process field missing")
        };
        let uids: Vec<_> = field("Uid:")?.split_whitespace().collect();
        ensure!(
            uids.len() == 4
                && uids
                    .iter()
                    .all(|value| value.parse::<u32>().ok() == Some(uid)),
            "guard UID mismatch"
        );
        ensure!(
            field("NoNewPrivs:")?.trim() == "1"
                && u64::from_str_radix(field("CapEff:")?.trim(), 16)? == 0,
            "guard privileges not dropped"
        );
        let group = std::fs::read_to_string(format!("/proc/{pid}/cgroup"))?;
        ensure!(
            group.lines().any(
                |line| line.strip_prefix("0::").is_some_and(
                    |value| Path::new(value).file_name() == Some(std::ffi::OsStr::new(&unit))
                )
            ) && group != std::fs::read_to_string("/proc/self/cgroup")?,
            "guard unit cgroup not independent"
        );
        ensure!(
            std::fs::read_link(format!("/proc/{pid}/exe"))? == std::fs::canonicalize(executable)?,
            "guard executable mismatch"
        );
        ensure!(
            !exited(&process)? && ouroboros_transport::linux_peer(pid, uid)? == identity,
            "guard changed during binding"
        );
        Ok(Self::Managed {
            helper,
            process,
            identity,
            unit,
            receipt_identity,
        })
    }

    pub fn observation(&self) -> Value {
        match self {
            Self::Direct(child) => {
                json!({"backend":"direct_child","pid":child.id(),"independent_service":false})
            }
            Self::Managed {
                identity,
                unit,
                receipt_identity,
                ..
            } => {
                json!({"backend":"systemd","identity":identity,"unit":unit,"independent_service":true,"receipt_file":{"device":receipt_identity.0,"inode":receipt_identity.1}})
            }
        }
    }

    pub fn is_alive(&mut self) -> Result<bool> {
        match self {
            Self::Direct(child) => Ok(child.try_wait()?.is_none()),
            Self::Managed {
                helper, process, ..
            } => {
                let alive = !exited(process)?;
                // A dead helper with a live guard is degraded supervision, never completed cleanup.
                ensure!(
                    !alive || helper.try_wait()?.is_none(),
                    "guard helper lost while actual guard remains live"
                );
                Ok(alive)
            }
        }
    }

    /// Caller must first prove payload closure; never call this as Drop or startup-error cleanup.
    pub async fn kill(&mut self) -> Result<()> {
        match self {
            Self::Direct(child) => {
                child.kill().await?;
            }
            Self::Managed {
                helper, process, ..
            } => {
                if !exited(process)? {
                    // SAFETY: pidfd targets this original process, not a potentially reused PID.
                    let result = unsafe {
                        libc::syscall(
                            libc::SYS_pidfd_send_signal,
                            process.as_raw_fd(),
                            libc::SIGUSR1,
                            std::ptr::null::<libc::siginfo_t>(),
                            0,
                        )
                    };
                    if result < 0 {
                        ensure!(exited(process)?, "actual guard termination failed");
                    }
                }
                tokio::time::timeout(Duration::from_secs(1), async {
                    while !exited(process)? {
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                    Ok::<_, anyhow::Error>(())
                })
                .await??;
                if helper.try_wait()?.is_none() {
                    helper.kill().await?;
                }
                helper.wait().await?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn recovery_observes_identity_without_signalling_or_returning_capacity() {
        let root = std::env::temp_dir().join(format!("guard-observation-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        let mut process = Command::new("/usr/bin/sleep").arg("20").spawn().unwrap();
        let instance = uuid::Uuid::new_v4();
        let generation = uuid::Uuid::new_v4();
        let uid = unsafe { libc::geteuid() };
        let identity = ouroboros_transport::linux_peer(process.id().unwrap() as i32, uid).unwrap();
        let mut record = json!({"backend":"systemd","unit":format!("ouroboros-guard-{instance}.service"),
            "instance_id":instance,"generation":generation,"deadline_boottime_ns":42,"identity":identity});
        let save = |value: &Value| {
            std::fs::write(
                root.join("guard-binding.json"),
                serde_json::to_vec(value).unwrap(),
            )
            .unwrap()
        };
        save(&record);
        let observed = observe_recorded(&root, instance, generation, 42, uid).unwrap();
        assert_eq!(observed["state"], "running");
        assert_eq!(observed["capacity_returned"], false);
        assert!(observe_recorded(&root, instance, uuid::Uuid::new_v4(), 42, uid).is_err());
        record["identity"]["start_ticks"] = json!(identity.start_ticks + 1);
        save(&record);
        assert_eq!(
            observe_recorded(&root, instance, generation, 42, uid).unwrap()["state"],
            "pid_reused"
        );
        assert!(process.try_wait().unwrap().is_none());
        record["identity"] = json!(identity);
        save(&record);
        process.kill().await.unwrap();
        process.wait().await.unwrap();
        assert_eq!(
            observe_recorded(&root, instance, generation, 42, uid).unwrap()["state"],
            "gone"
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[tokio::test]
    async fn helper_exit_is_not_guard_exit_and_pidfd_retirement_is_specific() {
        let mut actual = Command::new("/usr/bin/sleep").arg("20").spawn().unwrap();
        let mut other = Command::new("/usr/bin/sleep").arg("20").spawn().unwrap();
        let mut helper = Command::new("/usr/bin/true").spawn().unwrap();
        helper.wait().await.unwrap();
        let pid = actual.id().unwrap() as i32;
        // SAFETY: successful pidfd_open yields an owned descriptor for the spawned test child.
        let fd = unsafe { libc::syscall(libc::SYS_pidfd_open, pid, 0) } as i32;
        assert!(fd >= 0);
        let process = unsafe { File::from_raw_fd(fd) };
        let identity = ouroboros_transport::linux_peer(pid, unsafe { libc::geteuid() }).unwrap();
        let mut guard = Guard::Managed {
            helper,
            process,
            identity,
            unit: "test-only".into(),
            receipt_identity: (0, 0),
        };
        assert!(guard.is_alive().is_err());
        assert!(actual.try_wait().unwrap().is_none());
        guard.kill().await.unwrap();
        assert!(!actual.wait().await.unwrap().success());
        assert!(other.try_wait().unwrap().is_none());
        other.kill().await.unwrap();
    }
}
