//! Fixed host for a separately executed, capability-free authentication module.
use crate::credential_envelope::CustodyError;
use ouroboros_contracts::auth_module::{AuthModulePackage, AuthModuleSelection, MAX_TOKEN_BYTES};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, process::Stdio, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use zeroize::Zeroizing;

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AuthModuleHost {
    /// Deployment-owned Runtime binary, never a package or caller supplied executable.
    pub worker_executable: PathBuf,
    pub package_directory: PathBuf,
}
impl AuthModuleHost {
    pub fn validate(&self) -> Result<(), CustodyError> {
        if !self.worker_executable.is_absolute() || !self.package_directory.is_absolute() {
            return Err(CustodyError);
        }
        Ok(())
    }
    /// No secrets or authority are stored in a package. The digest is checked on every load.
    fn package(&self, selected: &AuthModuleSelection) -> Result<Vec<u8>, CustodyError> {
        self.validate()?;
        selected.validate().map_err(|_| CustodyError)?;
        let path = self
            .package_directory
            .join(format!("{}.json", selected.wasm_sha256));
        let bytes =
            ouroboros_transport::config::read_regular(&path, 140_000).map_err(|_| CustodyError)?;
        let package: AuthModulePackage =
            serde_json::from_slice(&bytes).map_err(|_| CustodyError)?;
        if package.selection != *selected {
            return Err(CustodyError);
        }
        package.decode().map_err(|_| CustodyError)?;
        Ok(bytes)
    }
    pub async fn authenticate(
        &self,
        selected: &AuthModuleSelection,
        secret: &[u8],
    ) -> Result<Zeroizing<Vec<u8>>, CustodyError> {
        if secret.is_empty()
            || secret.len() > MAX_TOKEN_BYTES
            || !secret.iter().all(u8::is_ascii_graphic)
        {
            return Err(CustodyError);
        }
        let package = self.package(selected)?;
        let mut command = tokio::process::Command::new(&self.worker_executable);
        command
            .arg("worker")
            .env_clear()
            .current_dir("/")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        // The interpreter exposes no imports, including process creation, files or sockets.
        // Bound its outer process too; module bytes and secrets never appear in argv/env/files.
        // SAFETY: the post-fork closure uses stack data and synchronous setrlimit calls
        // only; it does not allocate, acquire locks or access shared Rust state.
        // Each rlimit pointer stays valid for its call.
        unsafe {
            command.pre_exec(|| {
                for (resource, value) in [
                    (libc::RLIMIT_CORE, 0),
                    (libc::RLIMIT_CPU, 2),
                    (libc::RLIMIT_NOFILE, 32),
                ] {
                    let limit = libc::rlimit {
                        rlim_cur: value,
                        rlim_max: value,
                    };
                    if libc::setrlimit(resource, &limit) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                }
                #[cfg(target_os = "linux")]
                {
                    let memory = libc::rlimit {
                        rlim_cur: 256 * 1024 * 1024,
                        rlim_max: 256 * 1024 * 1024,
                    };
                    if libc::setrlimit(libc::RLIMIT_AS, &memory) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                }
                Ok(())
            });
        }
        let mut child = command.spawn().map_err(|_| CustodyError)?;
        let mut input = child.stdin.take().ok_or(CustodyError)?;
        let mut output = child.stdout.take().ok_or(CustodyError)?;
        let result = tokio::time::timeout(Duration::from_secs(2), async {
            input
                .write_all(&(package.len() as u32).to_be_bytes())
                .await
                .map_err(|_| CustodyError)?;
            input.write_all(&package).await.map_err(|_| CustodyError)?;
            let mut ready = [0; 6];
            output
                .read_exact(&mut ready)
                .await
                .map_err(|_| CustodyError)?;
            if &ready != b"READY\n" {
                return Err(CustodyError);
            }
            input
                .write_all(&(secret.len() as u32).to_be_bytes())
                .await
                .map_err(|_| CustodyError)?;
            input.write_all(secret).await.map_err(|_| CustodyError)?;
            input.shutdown().await.map_err(|_| CustodyError)?;
            let size = output.read_u32().await.map_err(|_| CustodyError)? as usize;
            if size != secret.len() + 7 {
                return Err(CustodyError);
            }
            let mut bytes = Zeroizing::new(vec![0; size]);
            output
                .read_exact(&mut bytes)
                .await
                .map_err(|_| CustodyError)?;
            if !bytes.starts_with(b"Bearer ") || bytes[7..] != *secret {
                return Err(CustodyError);
            }
            let mut extra = [0; 1];
            if output.read(&mut extra).await.map_err(|_| CustodyError)? != 0 {
                return Err(CustodyError);
            }
            if !child.wait().await.map_err(|_| CustodyError)?.success() {
                return Err(CustodyError);
            }
            Ok(bytes)
        })
        .await;
        // Reap on every observed failure. A cancelled outer future still kills the child;
        // its durable custody claim remains unresolved and is never automatically reused.
        match result {
            Ok(Ok(bytes)) => Ok(bytes),
            _ => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                Err(CustodyError)
            }
        }
    }
    /// Fixed verifier vectors, independent of package-selected output and real credentials.
    pub async fn verify(&self, selected: &AuthModuleSelection) -> Result<(), CustodyError> {
        for token in ["fixture-a_A.123".to_string(), "Z".repeat(MAX_TOKEN_BYTES)] {
            self.authenticate(selected, token.as_bytes()).await?;
        }
        Ok(())
    }
}
