//! Runtime preparation is not admission. A Core-approved, qualified profile is required before payload release.
pub mod auth_module;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod claim_journal;
pub mod command;
#[cfg(target_os = "linux")]
mod shutdown;
pub mod worker;
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Profile {
    pub image: String,
    pub docker_socket: PathBuf,
    pub memory_bytes: i64,
    pub nano_cpus: i64,
    pub pids_limit: i64,
    pub lifetime_seconds: u64,
}
impl Profile {
    pub fn validate(&self) -> Result<()> {
        let digest = self
            .image
            .strip_prefix("sha256:")
            .or_else(|| self.image.rsplit_once("@sha256:").map(|(_, d)| d))
            .ok_or_else(|| anyhow::anyhow!("image digest required"))?;
        ensure!(
            digest.len() == 64 && digest.bytes().all(|b| b.is_ascii_hexdigit()),
            "invalid image digest"
        );
        ensure!(
            self.docker_socket.is_absolute()
                && self.docker_socket.components().all(|part| matches!(
                    part,
                    std::path::Component::RootDir | std::path::Component::Normal(_)
                )),
            "explicit absolute Docker Unix socket required"
        );
        ensure!(
            self.memory_bytes > 0
                && self.nano_cpus > 0
                && self.pids_limit > 0
                && self.lifetime_seconds > 0,
            "explicit finite resource bounds required"
        );
        Ok(())
    }
}
/// Methods exposed by the outer lifecycle adapter. Authentication/configuration methods are excluded.
pub fn native_method_allowed(method: &str) -> bool {
    matches!(
        method,
        "initialize"
            | "initialized"
            | "thread/start"
            | "thread/read"
            | "thread/resume"
            | "turn/start"
            | "turn/steer"
            | "turn/interrupt"
    )
}
#[cfg(target_os = "linux")]
pub mod allocation;
#[cfg(target_os = "linux")]
mod docker_backend;
#[cfg(target_os = "linux")]
pub mod guard_handoff;
#[cfg(target_os = "linux")]
pub mod guard_process;
#[cfg(target_os = "linux")]
pub mod manager;
pub mod materialize;
pub mod native;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod native_checkpoint;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod native_fixture;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod native_receipts;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod program;
#[cfg(target_os = "linux")]
mod reconciliation;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod reporting;
#[cfg(target_os = "linux")]
pub mod socket;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn no_native_auth_or_arbitrary_method() {
        for m in [
            "account/login/start",
            "account/chatgptAuthTokens/refresh",
            "config/write",
            "exec",
            "unknown",
        ] {
            assert!(!native_method_allowed(m));
        }
        assert!(native_method_allowed("turn/interrupt"));
    }
    #[test]
    fn explicit_profile_only() {
        let mut p = Profile {
            image: format!("image@sha256:{}", "a".repeat(64)),
            docker_socket: "/var/run/docker.sock".into(),
            memory_bytes: 64 * 1024 * 1024,
            nano_cpus: 1_000_000_000,
            pids_limit: 32,
            lifetime_seconds: 10,
        };
        assert!(p.validate().is_ok());
        p.image = "image:latest".into();
        assert!(p.validate().is_err());
        p.image = format!("image@sha256:{}", "a".repeat(64));
        p.docker_socket = "/run/isolated-engine/engine.sock".into();
        assert!(p.validate().is_ok());
        p.docker_socket = "relative/docker.sock".into();
        assert!(p.validate().is_err());
        p.docker_socket = "/run/../docker.sock".into();
        assert!(p.validate().is_err());
    }
}
