//! Explicit infrastructure file installation. Application authority and service activation stay separate.
use anyhow::Result;
use serde_json::Value;
use std::path::Path;

#[cfg(target_os = "linux")]
mod native {
    use super::*;
    use anyhow::ensure;
    use serde_json::json;
    use std::{
        ffi::CString,
        fs::{File, OpenOptions},
        io::{Read, Write},
        os::{
            fd::{AsRawFd, FromRawFd},
            unix::fs::{MetadataExt, OpenOptionsExt},
        },
    };
    fn identity(file: &File) -> Result<Value> {
        let m = file.metadata()?;
        Ok(json!({"device":m.dev(),"inode":m.ino()}))
    }
    fn directory(path: &Path) -> Result<File> {
        ensure!(
            path.is_absolute() && path != Path::new("/") && path.canonicalize()? == path,
            "exact protected directory required"
        );
        for ancestor in path.ancestors() {
            let m = std::fs::symlink_metadata(ancestor)?;
            ensure!(
                m.is_dir() && m.uid() == 0 && m.mode() & 0o022 == 0,
                "unprotected installation ancestor"
            );
        }
        Ok(OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path)?)
    }
    fn read(parent: &File, name: &str, limit: usize) -> Result<Option<(File, Vec<u8>)>> {
        let name = CString::new(name)?;
        let fd = unsafe {
            libc::openat(
                parent.as_raw_fd(),
                name.as_ptr(),
                libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK,
            )
        };
        if fd < 0 {
            let e = std::io::Error::last_os_error();
            if e.raw_os_error() == Some(libc::ENOENT) {
                return Ok(None);
            }
            return Err(e.into());
        }
        let mut file = unsafe { File::from_raw_fd(fd) };
        let m = file.metadata()?;
        ensure!(
            m.is_file() && m.uid() == 0 && m.mode() & 0o022 == 0 && m.len() <= limit as u64,
            "unprotected or oversized installation file"
        );
        let mut bytes = Vec::new();
        (&mut file).take(limit as u64 + 1).read_to_end(&mut bytes)?;
        ensure!(bytes.len() <= limit, "installation file changed size");
        Ok(Some((file, bytes)))
    }
    fn create(parent: &File, name: &str, bytes: &[u8], mode: u32) -> Result<File> {
        let name = CString::new(name)?;
        let fd = unsafe {
            libc::openat(
                parent.as_raw_fd(),
                name.as_ptr(),
                libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC,
                mode,
            )
        };
        ensure!(fd >= 0, "installation entry exists or cannot be created");
        let mut file = unsafe { File::from_raw_fd(fd) };
        file.write_all(bytes)?;
        file.sync_all()?;
        parent.sync_all()?;
        Ok(file)
    }
    fn record(parent: &File, name: &str, expected: &Value, existing_allowed: bool) -> Result<()> {
        let bytes = serde_json::to_vec(expected)?;
        if let Some((file, observed)) = read(parent, name, 1024 * 1024)? {
            ensure!(
                existing_allowed
                    && file.metadata()?.nlink() == 1
                    && file.metadata()?.mode() & 0o077 == 0
                    && observed == bytes,
                "installation record mismatch or collision"
            );
            file.sync_all()?;
            parent.sync_all()?;
        } else {
            create(parent, name, &bytes, 0o600)?;
        }
        Ok(())
    }
    fn content(parent: &File, name: &str, expected: &[u8]) -> Result<Option<File>> {
        let Some((file, bytes)) = read(parent, name, expected.len())? else {
            return Ok(None);
        };
        ensure!(
            bytes == expected,
            "unit content mismatch; retained for review"
        );
        Ok(Some(file))
    }
    /// Holds the installation lock while its caller observes or applies the verified files.
    pub struct Verified {
        _target: File,
        custody: File,
    }
    impl Verified {
        pub fn read_event(&self, name: &str) -> Result<Option<Value>> {
            ensure!(
                name.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b)),
                "invalid event name"
            );
            let Some((file, bytes)) = read(&self.custody, name, 65536)? else {
                return Ok(None);
            };
            ensure!(
                file.metadata()?.nlink() == 1 && file.metadata()?.mode() & 0o077 == 0,
                "unprotected operation record"
            );
            Ok(Some(serde_json::from_slice(&bytes)?))
        }
        pub fn event(&self, name: &str, value: &Value) -> Result<()> {
            ensure!(
                name.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b)),
                "invalid event name"
            );
            create(&self.custody, name, &serde_json::to_vec(value)?, 0o600)?;
            Ok(())
        }
    }
    pub fn verify_completed(
        report: &Value,
        destination: &Path,
        receipts: &Path,
        reviewed: &str,
    ) -> Result<Verified> {
        ensure!(
            unsafe { libc::geteuid() } == 0,
            "trusted Linux host owner required"
        );
        ensure!(
            report["bundle_sha256"] == reviewed && reviewed.len() == 64,
            "reviewed bundle mismatch"
        );
        let target = directory(destination)?;
        let custody = directory(receipts)?;
        ensure!(
            identity(&target)? != identity(&custody)?,
            "distinct receipt directory required"
        );
        ensure!(
            unsafe { libc::flock(target.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "installation is busy"
        );
        let matches = |name: &str, expected: Value| -> Result<()> {
            let (file, bytes) = read(&custody, name, 1024 * 1024)?
                .ok_or_else(|| anyhow::anyhow!("complete installation evidence missing"))?;
            ensure!(
                file.metadata()?.nlink() == 1
                    && file.metadata()?.mode() & 0o077 == 0
                    && serde_json::from_slice::<Value>(&bytes)? == expected,
                "installation evidence mismatch"
            );
            Ok(())
        };
        matches(
            &format!("install-{reviewed}.json"),
            json!({"bundle":report,"destination":destination,
            "destination_identity":identity(&target)?,"receipt_identity":identity(&custody)?,"status":"prepared_not_complete"}),
        )?;
        let units = report["units"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("unit inventory missing"))?;
        matches(
            &format!("install-{reviewed}.complete.json"),
            json!({"status":"installed_not_started","bundle_sha256":reviewed,"unit_count":units.len(),"reload_required":true,"authority_granted":false}),
        )?;
        for unit in units {
            let name = unit["name"].as_str().unwrap();
            let file = content(&target, name, unit["content"].as_str().unwrap().as_bytes())?
                .ok_or_else(|| anyhow::anyhow!("installed unit missing"))?;
            ensure!(
                file.metadata()?.nlink() == 1
                    && read(&target, &format!(".{name}.{reviewed}.pending"), 65536)?.is_none(),
                "unexpected installation links"
            );
            let expected = json!({"unit":name,"sha256":unit["sha256"],"file":identity(&file)?});
            matches(
                &format!("install-{reviewed}.{name}.stage.json"),
                expected.clone(),
            )?;
            matches(&format!("install-{reviewed}.{name}.json"), expected)?;
        }
        ensure!(
            identity(&directory(destination)?)? == identity(&target)?
                && identity(&directory(receipts)?)? == identity(&custody)?,
            "installation path changed"
        );
        Ok(Verified {
            _target: target,
            custody,
        })
    }
    pub fn install(
        report: &Value,
        destination: &Path,
        receipts: &Path,
        reviewed: &str,
        resume: bool,
    ) -> Result<Value> {
        ensure!(
            unsafe { libc::geteuid() } == 0,
            "installation requires the trusted host owner"
        );
        ensure!(
            reviewed.len() == 64
                && reviewed
                    .bytes()
                    .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
                && report["bundle_sha256"] == reviewed,
            "reviewed bundle digest mismatch"
        );
        let target = directory(destination)?;
        let custody = directory(receipts)?;
        ensure!(
            identity(&target)? != identity(&custody)?,
            "separate receipt directory required"
        );
        ensure!(
            unsafe { libc::flock(target.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "another installer owns the target"
        );
        let units = report["units"]
            .as_array()
            .ok_or_else(|| anyhow::anyhow!("unit inventory missing"))?;
        let plan_name = format!("install-{reviewed}.json");
        let plan = json!({"bundle":report,"destination":destination,"destination_identity":identity(&target)?,
            "receipt_identity":identity(&custody)?,"status":"prepared_not_complete"});
        if resume {
            ensure!(
                read(&custody, &plan_name, 1024 * 1024)?.is_some(),
                "resume requires the original installation plan"
            );
        } else {
            for unit in units {
                ensure!(
                    read(&target, unit["name"].as_str().unwrap(), 65536)?.is_none(),
                    "unit destination exists"
                );
            }
        }
        record(&custody, &plan_name, &plan, resume)?;
        let complete_name = format!("install-{reviewed}.complete.json");
        let already_complete = read(&custody, &complete_name, 65536)?.is_some();
        for unit in units {
            let name = unit["name"].as_str().unwrap();
            let bytes = unit["content"].as_str().unwrap().as_bytes();
            let pending = format!(".{name}.{reviewed}.pending");
            let stage_name = format!("install-{reviewed}.{name}.stage.json");
            let saved_stage = read(&custody, &stage_name, 65536)?;
            let installed = content(&target, name, bytes)?;
            let staging = content(&target, &pending, bytes)?;
            let saved_final = read(&custody, &format!("install-{reviewed}.{name}.json"), 65536)?;
            ensure!(
                saved_final.is_none() || (saved_stage.is_some() && installed.is_some()),
                "completed unit lost its original stage or installed file"
            );
            ensure!(
                !already_complete
                    || (saved_final.is_some()
                        && staging.is_none()
                        && installed
                            .as_ref()
                            .is_some_and(|f| f.metadata().is_ok_and(|m| m.nlink() == 1))),
                "completed installation has missing or unexpected entries"
            );
            let staged_identity = if let Some((stage_file, encoded)) = saved_stage {
                ensure!(
                    resume
                        && stage_file.metadata()?.nlink() == 1
                        && stage_file.metadata()?.mode() & 0o077 == 0,
                    "invalid stage receipt"
                );
                let saved: Value = serde_json::from_slice(&encoded)?;
                let original = installed
                    .as_ref()
                    .or(staging.as_ref())
                    .ok_or_else(|| anyhow::anyhow!("original staged file is missing"))?;
                let expected =
                    json!({"unit":name,"sha256":unit["sha256"],"file":identity(original)?});
                ensure!(saved == expected, "staged file identity mismatch");
                stage_file.sync_all()?;
                custody.sync_all()?;
                identity(original)?
            } else {
                ensure!(
                    installed.is_none(),
                    "installed file lacks original stage evidence"
                );
                let file = match staging {
                    Some(file) => file,
                    None => create(&target, &pending, bytes, 0o644)?,
                };
                ensure!(file.metadata()?.nlink() == 1, "unexpected staging link");
                file.sync_all()?;
                target.sync_all()?;
                let id = identity(&file)?;
                record(
                    &custody,
                    &stage_name,
                    &json!({"unit":name,"sha256":unit["sha256"],"file":id}),
                    false,
                )?;
                id
            };
            if installed.is_none() {
                let src = CString::new(pending.as_str())?;
                let dst = CString::new(name)?;
                ensure!(
                    unsafe {
                        libc::linkat(
                            target.as_raw_fd(),
                            src.as_ptr(),
                            target.as_raw_fd(),
                            dst.as_ptr(),
                            0,
                        )
                    } == 0,
                    "unit publication collision"
                );
                target.sync_all()?;
            }
            let file = content(&target, name, bytes)?
                .ok_or_else(|| anyhow::anyhow!("published unit missing"))?;
            ensure!(
                identity(&file)? == staged_identity,
                "published unit identity mismatch"
            );
            if let Some(left) = content(&target, &pending, bytes)? {
                ensure!(
                    identity(&left)? == staged_identity && file.metadata()?.nlink() == 2,
                    "unexpected pending link"
                );
                let src = CString::new(pending)?;
                ensure!(
                    unsafe { libc::unlinkat(target.as_raw_fd(), src.as_ptr(), 0) } == 0,
                    "pending link retirement unresolved"
                );
                target.sync_all()?;
            }
            ensure!(file.metadata()?.nlink() == 1, "unexpected installed link");
            file.sync_all()?;
            target.sync_all()?;
            record(
                &custody,
                &format!("install-{reviewed}.{name}.json"),
                &json!({"unit":name,"sha256":unit["sha256"],"file":staged_identity}),
                resume,
            )?;
        }
        ensure!(
            identity(&directory(destination)?)? == identity(&target)?
                && identity(&directory(receipts)?)? == identity(&custody)?,
            "installation directory changed before completion"
        );
        let outcome = json!({"status":"installed_not_started","bundle_sha256":reviewed,"unit_count":units.len(),"reload_required":true,"authority_granted":false});
        record(
            &custody,
            &format!("install-{reviewed}.complete.json"),
            &outcome,
            resume,
        )?;
        Ok(outcome)
    }
}
#[cfg(target_os = "linux")]
pub use native::{install, verify_completed};
#[cfg(not(target_os = "linux"))]
pub fn install(_: &Value, _: &Path, _: &Path, _: &str, _: bool) -> Result<Value> {
    anyhow::bail!("unit installation requires the qualified Linux host")
}
