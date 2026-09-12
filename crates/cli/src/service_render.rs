//! Pure deployment rendering and validation. Installation and lifecycle commands consume its reviewed digest.
use anyhow::{Result, ensure};
use serde::Deserialize;
use std::path::{Component, Path, PathBuf};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Service {
    pub(crate) role: Role,
    binary_directory: PathBuf,
    pub(crate) config: PathBuf,
    uid: u32,
    gid: u32,
    writable_directories: Vec<PathBuf>,
    memory_max_bytes: u64,
    tasks_max: u32,
    stop_timeout_seconds: u32,
    #[serde(default)]
    worker: Option<Worker>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Worker {
    max_executions: u16,
    idle_timeout_seconds: u16,
    lifetime_seconds: u32,
}

#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Role {
    Core,
    Gateway,
    Resources,
    Runtime,
}

fn path(value: &Path) -> Result<&str> {
    let text = value
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("UTF-8 path required"))?;
    ensure!(
        value.is_absolute() && value != Path::new("/") && text.len() <= 4096,
        "explicit non-root absolute path required"
    );
    ensure!(
        value
            .components()
            .all(|c| matches!(c, Component::RootDir | Component::Normal(_)))
            && !text.split('/').any(|part| matches!(part, "." | "..")),
        "normalized path required"
    );
    // This first host profile rejects unit specifiers, expansions, escapes and whitespace.
    // It never interprets a caller-provided shell fragment or systemd directive.
    ensure!(
        text.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/._-".contains(&b)),
        "unsupported character in deployment path"
    );
    Ok(text)
}

pub(crate) fn render(service: &Service) -> Result<String> {
    let runtime = service.role == Role::Runtime;
    ensure!(
        if runtime {
            service.uid == 0 && service.gid == 0
        } else {
            service.uid != 0 && service.gid != 0
        },
        "role requires its explicit host identity"
    );
    ensure!(
        runtime == service.worker.is_some(),
        "only Runtime requires bounded worker settings"
    );
    let worker_args = if let Some(worker) = &service.worker {
        ensure!(
            (1..=100).contains(&worker.max_executions)
                && (1..=300).contains(&worker.idle_timeout_seconds)
                && (1..=86400).contains(&worker.lifetime_seconds),
            "invalid Runtime worker bounds"
        );
        format!(
            " --require-managed-guard --max-executions {} --idle-timeout-seconds {}",
            worker.max_executions, worker.idle_timeout_seconds
        )
    } else {
        String::new()
    };
    ensure!(
        service.memory_max_bytes > 0 && service.tasks_max > 0,
        "explicit resource limits required"
    );
    ensure!(
        (6..=300).contains(&service.stop_timeout_seconds),
        "stop timeout must allow the five-second transport drain"
    );
    ensure!(
        service.writable_directories.len() <= 16,
        "too many writable roots"
    );
    let binary = service.binary_directory.join(match service.role {
        Role::Core => "ouroboros-core",
        Role::Gateway => "ouroboros-gateway",
        Role::Resources => "ouroboros-resources",
        Role::Runtime => "ouroboros-runtime",
    });
    let executable = path(&binary)?;
    let config = path(&service.config)?;
    let mut writable = Vec::new();
    for directory in &service.writable_directories {
        let entry = path(directory)?;
        ensure!(
            !binary.starts_with(directory) && !service.config.starts_with(directory),
            "service cannot write its executable or launch configuration"
        );
        ensure!(!writable.contains(&entry), "duplicate writable root");
        writable.push(entry);
    }
    let writes = if writable.is_empty() {
        String::new()
    } else {
        format!("ReadWritePaths={}\n", writable.join(" "))
    };
    let capabilities = if runtime {
        "CAP_SYS_ADMIN CAP_SYS_PTRACE CAP_SETUID CAP_SETGID CAP_DAC_OVERRIDE CAP_KILL"
    } else {
        ""
    };
    // systemd v255 drops SETUID during explicit-user seccomp setup unless retained ambiently.
    // The bridge clears it by changing to its nonzero UID before serving private traffic.
    let ambient = if runtime { "CAP_SETUID" } else { "" };
    let kill_mode = if runtime { "mixed" } else { "control-group" };
    let protect_cgroups = if runtime { "no" } else { "yes" };
    let lifetime = service
        .worker
        .as_ref()
        .map(|w| format!("RuntimeMaxSec={}s\n", w.lifetime_seconds))
        .unwrap_or_default();
    Ok(format!(
        "[Unit]\nDescription=Ouroboros protected outer service\n\n[Service]\nType=exec\nUser={}\nGroup={}\nSupplementaryGroups=\nExecStart=/usr/bin/env -i PATH=/usr/bin:/bin {} --config {}{worker_args}\nRestart=no\nKillMode={kill_mode}\nKillSignal=SIGTERM\nSendSIGKILL=yes\nTimeoutStopSec={}s\nUMask=0077\nNoNewPrivileges=yes\nCapabilityBoundingSet={capabilities}\nAmbientCapabilities={ambient}\nProtectSystem=strict\nProtectHome=read-only\nPrivateTmp=yes\nProtectKernelTunables=yes\nProtectKernelModules=yes\nProtectControlGroups={protect_cgroups}\nRestrictSUIDSGID=yes\nRestrictRealtime=yes\nLockPersonality=yes\nMemoryMax={}\nTasksMax={}\nStandardOutput=journal\nStandardError=journal\n{lifetime}{}",
        service.uid,
        service.gid,
        executable,
        config,
        service.stop_timeout_seconds,
        service.memory_max_bytes,
        service.tasks_max,
        writes
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Bundle {
    pub(crate) services: Vec<Entry>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Entry {
    pub(crate) name: String,
    pub(crate) service: Service,
}
pub(crate) fn render_bundle(mut bundle: Bundle) -> Result<serde_json::Value> {
    use sha2::{Digest, Sha256};
    ensure!(
        (4..=32).contains(&bundle.services.len()),
        "bounded complete service inventory required"
    );
    let count = |role: Role| {
        bundle
            .services
            .iter()
            .filter(|e| e.service.role == role)
            .count()
    };
    ensure!(
        count(Role::Core) == 1
            && count(Role::Gateway) == 1
            && count(Role::Resources) > 0
            && count(Role::Runtime) > 0,
        "one Core/Gateway and explicit Resources/Runtime required"
    );
    let mut names = std::collections::HashSet::new();
    let mut identities = std::collections::HashSet::new();
    for entry in &bundle.services {
        let stem = entry
            .name
            .strip_suffix(".service")
            .ok_or_else(|| anyhow::anyhow!("service suffix required"))?;
        ensure!(
            stem.starts_with("ouroboros-")
                && stem.len() > 10
                && stem.len() <= 120
                && stem
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
                && names.insert(&entry.name),
            "invalid or duplicate unit name"
        );
        if entry.service.role != Role::Runtime {
            ensure!(
                identities.insert(entry.service.uid),
                "service credentials require distinct non-root UIDs"
            );
        }
        render(&entry.service)?;
        for root in &entry.service.writable_directories {
            for other in &bundle.services {
                ensure!(
                    !other.service.config.starts_with(root)
                        && !other.service.binary_directory.starts_with(root)
                        && !other
                            .service
                            .binary_directory
                            .join(match other.service.role {
                                Role::Core => "ouroboros-core",
                                Role::Gateway => "ouroboros-gateway",
                                Role::Resources => "ouroboros-resources",
                                Role::Runtime => "ouroboros-runtime",
                            })
                            .starts_with(root),
                    "writable root contains another service launch input"
                );
                if entry.name != other.name {
                    ensure!(
                        other
                            .service
                            .writable_directories
                            .iter()
                            .all(|p| !p.starts_with(root) && !root.starts_with(p)),
                        "overlapping service writable roots"
                    );
                }
            }
        }
    }
    bundle.services.sort_by_key(|e| {
        (
            match e.service.role {
                Role::Core => 0,
                Role::Resources => 1,
                Role::Gateway => 2,
                Role::Runtime => 3,
            },
            e.name.clone(),
        )
    });
    let start: Vec<_> = bundle.services.iter().map(|e| e.name.clone()).collect();
    let mut stop = start.clone();
    stop.reverse();
    let units=bundle.services.iter().map(|entry| {
        let content=render(&entry.service)?;
        Ok(serde_json::json!({"name":entry.name,"sha256":hex::encode(Sha256::digest(content.as_bytes())),"content":content}))
    }).collect::<Result<Vec<_>>>()?;
    let mut report = serde_json::json!({"status":"rendered_only","start_order":start,"stop_order":stop,"units":units,
        "authority_granted":false,"installed":false,"storage_verified":false,"readiness_verified":false});
    let hash = hex::encode(Sha256::digest(serde_json::to_vec(&report)?));
    report["bundle_sha256"] = serde_json::json!(hash);
    Ok(report)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn spec() -> Service {
        serde_json::from_value(serde_json::json!({"role":"gateway","binary_directory":"/opt/outer/release",
            "config":"/etc/outer/gateway.json","uid":12001,"gid":12001,"writable_directories":["/run/outer/gateway"],
            "memory_max_bytes":134217728,"tasks_max":32,"stop_timeout_seconds":10})).unwrap()
    }
    fn bundle() -> Bundle {
        let mut services = Vec::new();
        for (name, role, uid) in [
            ("runtime", Role::Runtime, 0),
            ("gateway", Role::Gateway, 12002),
            ("core", Role::Core, 12001),
            ("catalog", Role::Resources, 12003),
        ] {
            let mut service = spec();
            service.role = role;
            service.uid = uid;
            service.gid = uid;
            service.config = format!("/etc/outer/{name}.json").into();
            service.writable_directories = vec![format!("/run/outer/{name}").into()];
            if uid == 0 {
                service.worker = Some(Worker {
                    max_executions: 2,
                    idle_timeout_seconds: 30,
                    lifetime_seconds: 300,
                });
            }
            services.push(Entry {
                name: format!("ouroboros-{name}.service"),
                service,
            });
        }
        Bundle { services }
    }
    #[test]
    fn bundle_orders_exact_units_without_installation() {
        let result = render_bundle(bundle()).unwrap();
        assert_eq!(
            result["start_order"],
            serde_json::json!([
                "ouroboros-core.service",
                "ouroboros-catalog.service",
                "ouroboros-gateway.service",
                "ouroboros-runtime.service"
            ])
        );
        assert_eq!(result["stop_order"][0], "ouroboros-runtime.service");
        assert_eq!(result["installed"], false);
    }
    #[test]
    fn bundle_rejects_cross_service_write_and_identity_collisions() {
        let mut value = bundle();
        value.services[0].service.writable_directories = vec!["/etc/outer".into()];
        assert!(render_bundle(value).is_err());
        let mut value = bundle();
        value.services[2].service.uid = 12002;
        assert!(render_bundle(value).is_err());
        let mut value = bundle();
        value.services[1].name = value.services[0].name.clone();
        assert!(render_bundle(value).is_err());
        let mut value = bundle();
        value.services[0].service.writable_directories = vec!["/run/outer".into()];
        assert!(render_bundle(value).is_err());
    }
    #[test]
    fn output_never_enables_or_restarts_and_keeps_explicit_identity() {
        let unit = render(&spec()).unwrap();
        assert!(unit.contains("User=12001\n") && unit.contains("Restart=no\n"));
        assert!(
            unit.contains("KillMode=control-group\n") && unit.contains("NoNewPrivileges=yes\n")
        );
        assert!(
            !unit.contains("[Install]")
                && !unit.contains("ExecStopPost")
                && !unit.contains("/bin/sh")
        );
    }
    #[test]
    fn refuses_unit_expansion_and_writable_launch_inputs() {
        for location in [
            "/etc/outer/%n.json",
            "/etc/outer/$NAME",
            "/etc/outer/config\nUser=0",
            "/etc/../config",
            "/",
        ] {
            let mut value = spec();
            value.config = location.into();
            assert!(render(&value).is_err());
        }
        for directory in ["/", "/etc", "/opt/outer"] {
            let mut value = spec();
            value.writable_directories = vec![directory.into()];
            assert!(render(&value).is_err());
        }
    }
    #[test]
    fn refuses_privileged_runtime_or_unbounded_profile() {
        let mut value = spec();
        value.uid = 0;
        assert!(render(&value).is_err());
        value = spec();
        value.stop_timeout_seconds = 5;
        assert!(render(&value).is_err());
        value = spec();
        value.tasks_max = 0;
        assert!(render(&value).is_err());
        value = spec();
        value.role = Role::Runtime;
        assert!(render(&value).is_err());
        value.uid = 0;
        value.gid = 0;
        assert!(render(&value).is_err());
        value.worker = Some(Worker {
            max_executions: 2,
            idle_timeout_seconds: 30,
            lifetime_seconds: 300,
        });
        let unit = render(&value).unwrap();
        assert!(unit.contains("KillMode=mixed\n") && unit.contains("--require-managed-guard"));
        assert!(unit.contains("RuntimeMaxSec=300s\n") && unit.contains("Restart=no\n"));
        value.role = Role::Gateway;
        assert!(render(&value).is_err());
    }
}
