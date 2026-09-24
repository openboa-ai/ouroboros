//! Original cgroup observations. These records alone never return capacity or settle effects.
use anyhow::{Result, ensure};
use serde::Serialize;
use std::{
    ffi::CString,
    fs::{File, OpenOptions},
    io,
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::fs::{FileExt, MetadataExt, OpenOptionsExt},
    },
    path::Path,
};

pub use ouroboros_contracts::AllocationIdentity as Identity;
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Populated,
    Empty,
    Deactivated,
}
pub struct PinnedCgroup {
    directory: File,
    events: File,
    pub identity: Identity,
}

fn cgroup_filesystem(file: &File) -> Result<()> {
    let mut fs = std::mem::MaybeUninit::<libc::statfs>::uninit();
    // SAFETY: fstatfs writes the provided statfs for this live owned descriptor.
    ensure!(
        // SAFETY: the descriptor remains open and the output pointer refers to writable statfs storage.
        unsafe { libc::fstatfs(file.as_raw_fd(), fs.as_mut_ptr()) } == 0,
        "cgroup filesystem unavailable"
    );
    // SAFETY: the preceding successful stat syscall initialized the entire returned record.
    let fs = unsafe { fs.assume_init() };
    ensure!(fs.f_type == 0x63677270, "cgroup v2 filesystem required");
    Ok(())
}
fn populated(bytes: &[u8]) -> Result<State> {
    ensure!(bytes.len() < 4096, "cgroup events exceed bound");
    let text = std::str::from_utf8(bytes)?;
    let mut value = None;
    for line in text.lines() {
        let fields: Vec<_> = line.split_whitespace().collect();
        ensure!(fields.len() == 2, "malformed cgroup events");
        if fields[0] == "populated" {
            ensure!(value.is_none(), "ambiguous cgroup population");
            value = Some(match fields[1] {
                "0" => State::Empty,
                "1" => State::Populated,
                _ => anyhow::bail!("invalid cgroup population"),
            });
        }
    }
    value.ok_or_else(|| anyhow::anyhow!("missing cgroup population"))
}
impl PinnedCgroup {
    pub fn capture(path: &Path) -> Result<Self> {
        let directory = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path)?;
        cgroup_filesystem(&directory)?;
        let name = CString::new("cgroup.events")?;
        // SAFETY: the directory and constant NUL-terminated name remain alive for openat.
        let fd = unsafe {
            libc::openat(
                directory.as_raw_fd(),
                name.as_ptr(),
                libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            )
        };
        if fd < 0 {
            return Err(io::Error::last_os_error().into());
        }
        // SAFETY: openat returned a new descriptor, whose ownership is transferred once.
        let events = unsafe { File::from_raw_fd(fd) };
        cgroup_filesystem(&events)?;
        let d = directory.metadata()?;
        let e = events.metadata()?;
        ensure!(
            d.is_dir() && e.is_file() && d.dev() == e.dev(),
            "cgroup identity mismatch"
        );
        let boot_id = std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?
            .trim()
            .parse()?;
        let identity = Identity {
            boot_id,
            device: d.dev(),
            inode: d.ino(),
            events_inode: e.ino(),
        };
        let this = Self {
            directory,
            events,
            identity,
        };
        ensure!(
            this.observe()? == State::Populated,
            "capture requires original live allocation"
        );
        Ok(this)
    }
    pub fn observe(&self) -> Result<State> {
        let d = self.directory.metadata()?;
        let e = self.events.metadata()?;
        ensure!(
            (d.dev(), d.ino(), e.ino())
                == (
                    self.identity.device,
                    self.identity.inode,
                    self.identity.events_inode
                ),
            "pinned allocation identity changed"
        );
        let mut bytes = [0; 4096];
        match self.events.read_at(&mut bytes, 0) {
            Ok(n) => populated(&bytes[..n]),
            // This is the originally opened and initially live base cgroup.events node,
            // not a missing pathname or a replacement file. Retain this distinct fact;
            // a future return protocol must also require exact backend/helper closure.
            Err(error) if error.raw_os_error() == Some(libc::ENODEV) => Ok(State::Deactivated),
            Err(error) => Err(error.into()),
        }
    }
    pub fn events_handle(&self) -> Result<File> {
        Ok(self.events.try_clone()?)
    }
    pub fn kill_handle(&self) -> Result<File> {
        let name = CString::new("cgroup.kill")?;
        // SAFETY: the original directory and fixed C string are live; take ownership on success.
        let fd = unsafe {
            libc::openat(
                self.directory.as_raw_fd(),
                name.as_ptr(),
                libc::O_WRONLY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            )
        };
        if fd < 0 {
            return Err(io::Error::last_os_error().into());
        }
        // SAFETY: the preceding syscall returned a new nonnegative descriptor; ownership transfers to File once.
        let file = unsafe { File::from_raw_fd(fd) };
        cgroup_filesystem(&file)?;
        Ok(file)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn population_is_explicit_and_unambiguous() {
        assert_eq!(
            populated(b"populated 1\nfrozen 0\n").unwrap(),
            State::Populated
        );
        assert_eq!(populated(b"populated 0\nfrozen 0\n").unwrap(), State::Empty);
        for bytes in [
            &b""[..],
            b"frozen 0\n",
            b"populated 0\npopulated 1\n",
            b"populated 2\n",
            b"populated 0 extra\n",
        ] {
            assert!(populated(bytes).is_err());
        }
        assert!(populated(&[b'a'; 4096]).is_err());
    }
    #[test]
    fn ordinary_directory_cannot_become_kernel_evidence() {
        let p = std::env::temp_dir().join(format!("allocation-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&p).unwrap();
        std::fs::write(p.join("cgroup.events"), b"populated 1\n").unwrap();
        assert!(PinnedCgroup::capture(&p).is_err());
        std::fs::remove_dir_all(p).unwrap();
    }
}
