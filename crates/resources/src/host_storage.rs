//! Read-only Mac host preflight. Observation neither enrolls storage nor grants service authority.
use anyhow::Result;
#[cfg(any(target_os = "macos", test))]
use anyhow::ensure;
use serde::Deserialize;
use serde_json::Value;
#[cfg(any(target_os = "macos", test))]
use serde_json::json;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub mount_path: PathBuf,
    pub expected_volume_uuid: Uuid,
    pub minimum_available_bytes: u64,
}
impl Config {
    pub fn resolve_paths(&mut self, root: &ouroboros_transport::config::ConfigRoot) -> Result<()> {
        root.resolve(&mut self.mount_path)
    }
}
#[cfg(any(target_os = "macos", test))]
fn evaluate(config: &Config, observed: &Value, available: u64) -> Result<Value> {
    ensure!(
        !config.expected_volume_uuid.is_nil() && config.minimum_available_bytes > 0,
        "explicit volume identity and capacity floor required"
    );
    let mut failures = Vec::new();
    if observed["MountPoint"].as_str() != config.mount_path.to_str() {
        failures.push("mount_mismatch");
    }
    if observed["VolumeUUID"]
        .as_str()
        .and_then(|s| Uuid::parse_str(s).ok())
        != Some(config.expected_volume_uuid)
    {
        failures.push("volume_identity_mismatch");
    }
    if observed["FilesystemType"] != "apfs" {
        failures.push("unqualified_filesystem");
    }
    if observed["FileVault"] != true || observed["Encryption"] != true {
        failures.push("encryption_unconfirmed");
    }
    if observed["GlobalPermissionsEnabled"] != true {
        failures.push("ownership_disabled_or_unknown");
    }
    if observed["WritableVolume"] != true || observed["WritableMedia"] != true {
        failures.push("not_writable");
    }
    if available < config.minimum_available_bytes {
        failures.push("insufficient_available_space");
    }
    Ok(
        json!({"ready":failures.is_empty(),"scope":"mac_host_volume_observation",
        "mount_path":config.mount_path,"expected_volume_uuid":config.expected_volume_uuid,
        "available_bytes":available,"minimum_available_bytes":config.minimum_available_bytes,
        "failures":failures,"authority_granted":false,"guest_storage_verified":false}),
    )
}

#[cfg(target_os = "macos")]
pub fn check(config: &Config) -> Result<Value> {
    use std::{
        ffi::CStr,
        fs::File,
        os::{fd::AsRawFd, unix::fs::MetadataExt},
        process::Stdio,
    };
    use tokio::{io::AsyncWriteExt, process::Command};
    ensure!(
        config.mount_path.is_absolute() && config.mount_path.canonicalize()? == config.mount_path,
        "exact mounted path required"
    );
    let directory = File::open(&config.mount_path)?;
    let before = directory.metadata()?;
    ensure!(before.is_dir(), "mount directory required");
    // SAFETY: statfs contains integer and fixed-array fields for which zero is valid.
    let mut fs: libc::statfs = unsafe { std::mem::zeroed() };
    ensure!(
        // SAFETY: directory remains open and fs is valid writable statfs storage.
        unsafe { libc::fstatfs(directory.as_raw_fd(), &mut fs) } == 0,
        "cannot observe mounted filesystem"
    );
    let mount_bytes: Vec<u8> = fs.f_mntonname.iter().map(|v| *v as u8).collect();
    let mount = CStr::from_bytes_until_nul(&mount_bytes)?.to_str()?;
    ensure!(
        Some(mount) == config.mount_path.to_str(),
        "path is not the filesystem mount root"
    );
    let available = fs
        .f_bavail
        .checked_mul(fs.f_bsize as u64)
        .ok_or_else(|| anyhow::anyhow!("capacity overflow"))?;
    async fn command(program: &str, args: &[&str], input: Option<Vec<u8>>) -> Result<Vec<u8>> {
        let mut child = Command::new(program)
            .args(args)
            .env_clear()
            .stdin(if input.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn()?;
        if let Some(bytes) = input {
            let mut stdin = child
                .stdin
                .take()
                .ok_or_else(|| anyhow::anyhow!("missing converter input"))?;
            stdin.write_all(&bytes).await?;
        }
        let output = child.wait_with_output().await?;
        ensure!(
            output.status.success() && output.stdout.len() <= 2 * 1024 * 1024,
            "host observation failed or exceeded bound"
        );
        Ok(output.stdout)
    }
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;
    let observed: Value = runtime.block_on(async {
        tokio::time::timeout(std::time::Duration::from_secs(10), async {
            let plist = command("/usr/sbin/diskutil", &["info", "-plist", mount], None).await?;
            let bytes = command(
                "/usr/bin/plutil",
                &["-convert", "json", "-o", "-", "-"],
                Some(plist),
            )
            .await?;
            Ok::<Value, anyhow::Error>(serde_json::from_slice(&bytes)?)
        })
        .await?
    })?;
    let after = std::fs::metadata(&config.mount_path)?;
    ensure!(
        before.dev() == after.dev()
            && before.ino() == after.ino()
            && config.mount_path.canonicalize()? == config.mount_path,
        "mount changed during observation"
    );
    evaluate(config, &observed, available)
}
#[cfg(not(target_os = "macos"))]
pub fn check(_: &Config) -> Result<Value> {
    anyhow::bail!("Mac host volume check requires macOS; guest store binding is a separate check")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unconfirmed_encryption_identity_ownership_and_capacity() {
        let config = Config {
            mount_path: "/Volumes/Example".into(),
            expected_volume_uuid: Uuid::new_v4(),
            minimum_available_bytes: 100,
        };
        let observed = json!({"MountPoint":config.mount_path,"VolumeUUID":config.expected_volume_uuid,"FilesystemType":"apfs",
            "FileVault":true,"Encryption":true,"GlobalPermissionsEnabled":true,"WritableVolume":true,"WritableMedia":true});
        assert_eq!(evaluate(&config, &observed, 100).unwrap()["ready"], true);
        for field in [
            "MountPoint",
            "VolumeUUID",
            "FilesystemType",
            "FileVault",
            "Encryption",
            "GlobalPermissionsEnabled",
            "WritableVolume",
            "WritableMedia",
        ] {
            let mut missing = observed.clone();
            missing.as_object_mut().unwrap().remove(field);
            assert_eq!(
                evaluate(&config, &missing, 100).unwrap()["ready"],
                false,
                "{field}"
            );
        }
        assert_eq!(evaluate(&config, &observed, 99).unwrap()["ready"], false);
        let mut wrong = observed;
        wrong["VolumeUUID"] = json!(Uuid::new_v4());
        assert_eq!(evaluate(&config, &wrong, 100).unwrap()["ready"], false);
    }
}
