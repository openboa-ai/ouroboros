//! Fixed-endpoint Docker translation and verification. Preparing a specification never grants execution.
use super::manager::Config;
use anyhow::{Context, Result, ensure};
use bollard::{
    ClientVersion, Docker,
    models::{
        ContainerCreateBody, ContainerInspectResponse, HealthConfig, HostConfig,
        HostConfigLogConfig, RestartPolicy, RestartPolicyNameEnum,
    },
};
use ouroboros_contracts::RuntimeTicket;
use std::collections::HashMap;
pub(super) fn docker_binding(cfg: &Config) -> Result<super::socket::SocketBinding> {
    let path = &cfg.profile.docker_socket;
    super::socket::SocketBinding::capture(
        path.parent().context("Docker socket parent required")?,
        path,
        0,
    )
}
pub(super) fn connect_docker(binding: &super::socket::SocketBinding) -> Result<Docker> {
    binding.ready()?;
    Ok(Docker::connect_with_unix(
        binding
            .address()
            .to_str()
            .context("invalid bound Docker address")?,
        3,
        &ClientVersion {
            major_version: 1,
            minor_version: 52,
        },
    )?)
}

pub(super) fn container_spec(cfg: &Config, ticket: &RuntimeTicket) -> ContainerCreateBody {
    let mut labels = HashMap::new();
    labels.insert("ouroboros.instance".into(), ticket.instance_id.to_string());
    ContainerCreateBody {
        image: Some(cfg.profile.image.clone()),
        user: Some("65532:65532".into()),
        entrypoint: Some(vec!["/bin/sleep".into()]),
        cmd: Some(vec![if cfg.program.is_some() {
            (ticket.input.lifetime_seconds as u64 + 30).to_string()
        } else {
            "120".into()
        }]),
        labels: Some(labels),
        // An image's healthcheck must never execute private code during trusted preparation.
        healthcheck: cfg.program.as_ref().map(|_| HealthConfig {
            test: Some(vec!["NONE".into()]),
            ..Default::default()
        }),
        host_config: Some(HostConfig {
            network_mode: Some("none".into()),
            readonly_rootfs: Some(true),
            cap_drop: Some(vec!["ALL".into()]),
            security_opt: Some(vec!["no-new-privileges:true".into()]),
            memory: Some(cfg.profile.memory_bytes),
            memory_swap: Some(cfg.profile.memory_bytes),
            nano_cpus: Some(cfg.profile.nano_cpus),
            pids_limit: Some(cfg.profile.pids_limit),
            restart_policy: cfg.program.as_ref().map(|_| RestartPolicy {
                name: Some(RestartPolicyNameEnum::NO),
                maximum_retry_count: Some(0),
            }),
            tmpfs: if let Some(program) = &cfg.program {
                Some(super::program::spaces(program))
            } else if cfg.profile_id == "codex-fixture" {
                Some(
                    [
                        (
                            "/workspace".into(),
                            "rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=0700".into(),
                        ),
                        (
                            "/home/agent".into(),
                            "rw,nosuid,nodev,size=32m,uid=65532,gid=65532,mode=0700".into(),
                        ),
                        ("/tmp".into(), "rw,nosuid,nodev,size=16m,mode=1777".into()),
                    ]
                    .into(),
                )
            } else {
                None
            },
            log_config: Some(HostConfigLogConfig {
                typ: Some("none".into()),
                config: None,
            }),
            ..Default::default()
        }),
        ..Default::default()
    }
}

/// Verify the observed backend allocation before any private payload is released.
pub(super) fn started_pid(cfg: &Config, detail: &ContainerInspectResponse) -> Result<i64> {
    let pid = detail
        .state
        .as_ref()
        .and_then(|s| s.pid)
        .context("missing instance PID")?;
    let host = detail
        .host_config
        .as_ref()
        .context("missing host profile")?;
    ensure!(
        host.network_mode.as_deref() == Some("none")
            && host.readonly_rootfs == Some(true)
            && detail
                .mounts
                .as_ref()
                .is_none_or(|m| m.iter().all(|mount| (cfg.profile_id == "codex-fixture"
                    || cfg.program.is_some())
                    && mount.typ.as_deref() == Some("tmpfs")
                    && matches!(
                        mount.destination.as_deref(),
                        Some("/workspace" | "/home/agent" | "/tmp")
                    ))),
        "unexpected containment"
    );
    if let Some(program) = &cfg.program {
        ensure!(
            host.memory == Some(program.memory_bytes)
                && host.memory_swap == Some(program.memory_bytes)
                && host.nano_cpus == Some(program.nano_cpus)
                && host.pids_limit == Some(program.pids_limit)
                && host.privileged == Some(false)
                && host
                    .cap_drop
                    .as_ref()
                    .is_some_and(|caps| caps.len() == 1 && caps[0] == "ALL")
                && host
                    .security_opt
                    .as_ref()
                    .is_some_and(|options| options.iter().any(|v| v == "no-new-privileges:true"))
                && host.tmpfs.as_ref() == Some(&super::program::spaces(program))
                && host
                    .restart_policy
                    .as_ref()
                    .is_some_and(|p| p.name == Some(RestartPolicyNameEnum::NO))
                && detail.config.as_ref().and_then(|c| c.user.as_deref()) == Some("65532:65532"),
            "actual program allocation differs from its activated profile"
        );
    }
    Ok(pid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::DirBuilderExt;
    use std::{path::PathBuf, time::Duration};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    struct FixtureRoot(PathBuf);
    impl Drop for FixtureRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Adapter/protocol fixture only: no Docker daemon, provisioning or production identity.
    #[tokio::test]
    async fn injected_unix_socket_carries_actual_bollard_ping() {
        let root = FixtureRoot(std::env::temp_dir().join(format!("b-{}", uuid::Uuid::new_v4())));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&root.0)
            .unwrap();
        let socket = root.0.join("engine.sock");
        let listener = tokio::net::UnixListener::bind(&socket).unwrap();
        // The fixture uses its existing test UID. Production docker_binding still requires UID 0.
        // SAFETY: geteuid has no pointer arguments and only observes process identity.
        let binding = super::super::socket::SocketBinding::capture(&root.0, &socket, unsafe {
            libc::geteuid()
        })
        .unwrap();
        let exercise = async {
            let server = async {
                let mut probes = 0;
                for _ in 0..2 {
                    let (mut stream, _) = listener.accept().await?;
                    let mut header = Vec::new();
                    let mut buffer = [0_u8; 1024];
                    while !header.ends_with(b"\r\n\r\n") {
                        let n = stream.read(&mut buffer).await?;
                        if n == 0 {
                            break;
                        }
                        header.extend_from_slice(&buffer[..n]);
                        ensure!(header.len() <= 8192, "fixture request exceeds bound");
                    }
                    if header.is_empty() {
                        probes += 1;
                        continue;
                    }
                    ensure!(
                        header.starts_with(b"GET /_ping HTTP/1.1\r\n"),
                        "unexpected Bollard wire request"
                    );
                    stream
                        .write_all(
                            b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
                        )
                        .await?;
                    stream.shutdown().await?;
                    ensure!(
                        probes == 1,
                        "readiness probe was not independently observed"
                    );
                    return Ok::<(), anyhow::Error>(());
                }
                anyhow::bail!("no Bollard ping reached the configured socket")
            };
            let client = async {
                binding.probe().await?;
                let docker = connect_docker(&binding)?;
                ensure!(docker.ping().await? == "OK", "unexpected ping response");
                Ok::<(), anyhow::Error>(())
            };
            tokio::try_join!(server, client)?;
            Ok::<(), anyhow::Error>(())
        };
        tokio::time::timeout(Duration::from_secs(10), exercise)
            .await
            .expect("Bollard fixture deadline")
            .unwrap();
    }
}
