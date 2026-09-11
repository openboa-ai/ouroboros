//! Retire only this server's pathname after a successful connection drain.
use anyhow::{Context, Result, ensure};
use std::{
    ffi::CString,
    fs::File,
    os::{
        fd::AsRawFd,
        unix::{
            ffi::OsStrExt,
            fs::{MetadataExt, OpenOptionsExt},
        },
    },
    path::Path,
};

pub(crate) struct OwnedSocket {
    parent: File,
    name: CString,
    device: u64,
    inode: u64,
}
impl OwnedSocket {
    pub(crate) fn capture(path: &Path) -> Result<Self> {
        let parent = File::options()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path.parent().context("socket parent required")?)?;
        let metadata = parent.metadata()?;
        ensure!(
            metadata.uid() == unsafe { libc::geteuid() } && metadata.mode() & 0o022 == 0,
            "socket directory must be owned by this service and not externally writable"
        );
        let name = CString::new(path.file_name().context("socket name required")?.as_bytes())?;
        let mut owned = Self {
            parent,
            name,
            device: 0,
            inode: 0,
        };
        let stat = owned.stat()?;
        ensure!(
            stat.st_mode & libc::S_IFMT == libc::S_IFSOCK
                && stat.st_uid == unsafe { libc::geteuid() },
            "bound pathname is not this service's socket"
        );
        owned.device = stat.st_dev;
        owned.inode = stat.st_ino;
        Ok(owned)
    }
    fn stat(&self) -> Result<libc::stat> {
        let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
        let result = unsafe {
            libc::fstatat(
                self.parent.as_raw_fd(),
                self.name.as_ptr(),
                stat.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if result != 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        Ok(unsafe { stat.assume_init() })
    }
    pub(crate) fn retire(self) -> Result<()> {
        let stat = self.stat()?;
        ensure!(
            stat.st_dev == self.device
                && stat.st_ino == self.inode
                && stat.st_mode & libc::S_IFMT == libc::S_IFSOCK
                && stat.st_uid == unsafe { libc::geteuid() },
            "socket pathname changed; preserved for recovery"
        );
        // The parent is held by FD and writable only by this trusted service identity/root.
        // Call only after listener closure and successful drain; never from Drop or startup.
        if unsafe { libc::unlinkat(self.parent.as_raw_fd(), self.name.as_ptr(), 0) } != 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        self.parent.sync_all()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::{fs::PermissionsExt, net::UnixListener};
    fn folder() -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!(
            "ouro-socket-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&p).unwrap();
        std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o700)).unwrap();
        p
    }
    #[test]
    fn normal_retirement_allows_rebinding() {
        let root = folder();
        let path = root.join("instance.sock");
        let listener = UnixListener::bind(&path).unwrap();
        let owned = OwnedSocket::capture(&path).unwrap();
        drop(listener);
        owned.retire().unwrap();
        assert!(!path.exists());
        drop(UnixListener::bind(&path).unwrap());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn changed_path_is_preserved_and_drop_does_not_unlink() {
        let root = folder();
        let path = root.join("instance.sock");
        let listener = UnixListener::bind(&path).unwrap();
        let owned = OwnedSocket::capture(&path).unwrap();
        std::fs::rename(&path, root.join("old.sock")).unwrap();
        std::fs::write(&path, b"replacement").unwrap();
        assert!(owned.retire().is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"replacement");
        let old = OwnedSocket::capture(&root.join("old.sock")).unwrap();
        drop(old);
        assert!(root.join("old.sock").exists());
        drop(listener);
        std::fs::remove_dir_all(root).unwrap();
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct SocketOwner {
    identity: ouroboros_contracts::BridgeIdentity,
    device: u64,
    inode: u64,
}

pub(crate) struct SocketLease {
    _lock: File,
    parent: File,
    owner_name: CString,
}
impl SocketLease {
    pub(crate) fn acquire(path: &Path) -> Result<Self> {
        let parent = File::options()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path.parent().context("socket parent required")?)?;
        let m = parent.metadata()?;
        ensure!(
            m.uid() == unsafe { libc::geteuid() } && m.mode() & 0o022 == 0,
            "socket directory ownership required"
        );
        let name = path.file_name().context("socket name required")?.as_bytes();
        let lock_name = CString::new([name, b".lock"].concat())?;
        let owner_name = CString::new([name, b".owner.json"].concat())?;
        let lock = Self::open(&parent, &lock_name, true)?;
        ensure!(
            unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } == 0,
            "socket lifecycle already owned"
        );
        Ok(Self {
            _lock: lock,
            parent,
            owner_name,
        })
    }
    fn open(parent: &File, name: &CString, create: bool) -> Result<File> {
        use std::os::fd::FromRawFd;
        let flags = libc::O_RDWR
            | libc::O_NOFOLLOW
            | libc::O_CLOEXEC
            | if create { libc::O_CREAT } else { 0 };
        let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags, 0o600) };
        if fd < 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        let file = unsafe { File::from_raw_fd(fd) };
        let m = file.metadata()?;
        ensure!(
            m.is_file()
                && m.uid() == unsafe { libc::geteuid() }
                && m.nlink() == 1
                && m.mode() & 0o077 == 0,
            "invalid socket lifecycle file"
        );
        Ok(file)
    }
    pub(crate) fn record(&self, socket: &OwnedSocket) -> Result<()> {
        use std::io::Write;
        ensure!(
            self.parent.metadata()?.ino() == socket.parent.metadata()?.ino()
                && self.parent.metadata()?.dev() == socket.parent.metadata()?.dev(),
            "socket directory changed"
        );
        let value = SocketOwner {
            identity: crate::linux_peer(std::process::id() as i32, unsafe { libc::geteuid() })?,
            device: socket.device,
            inode: socket.inode,
        };
        let mut file = Self::open(&self.parent, &self.owner_name, true)?;
        file.set_len(0)?;
        file.write_all(&serde_json::to_vec(&value)?)?;
        file.sync_all()?;
        self.parent.sync_all()?;
        Ok(())
    }
    pub(crate) async fn recover(&self, path: &Path) -> Result<()> {
        use std::io::Read;
        let file = Self::open(&self.parent, &self.owner_name, false)?;
        ensure!(
            file.metadata()?.len() <= 4096,
            "oversize socket owner record"
        );
        let mut bytes = Vec::new();
        file.take(4097).read_to_end(&mut bytes)?;
        let owner: SocketOwner = serde_json::from_slice(&bytes)?;
        ensure!(
            owner.identity.pid > 0 && owner.identity.uid == unsafe { libc::geteuid() },
            "invalid recorded socket owner"
        );
        let boot = std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?;
        if boot.trim() == owner.identity.boot_id
            && Path::new(&format!("/proc/{}", owner.identity.pid)).try_exists()?
        {
            let current = crate::linux_peer(owner.identity.pid, owner.identity.uid)?;
            ensure!(current != owner.identity, "recorded Gateway is still alive");
        }
        let socket = OwnedSocket::capture(path)?;
        ensure!(
            socket.device == owner.device && socket.inode == owner.inode,
            "socket differs from recorded owner"
        );
        match tokio::time::timeout(
            std::time::Duration::from_millis(500),
            tokio::net::UnixStream::connect(path),
        )
        .await
        {
            Ok(Err(error)) if error.kind() == std::io::ErrorKind::ConnectionRefused => {}
            _ => anyhow::bail!("socket liveness is active or uncertain"),
        }
        socket.retire()
    }
}

#[cfg(test)]
mod recovery_tests {
    use super::*;
    use std::os::unix::{fs::PermissionsExt, net::UnixListener};
    #[tokio::test]
    async fn recovery_rejects_live_owner_and_missing_or_corrupt_records() {
        let root = std::env::temp_dir().join(format!(
            "ouro-recovery-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        let path = root.join("instance.sock");
        let lease = SocketLease::acquire(&path).unwrap();
        assert!(SocketLease::acquire(&path).is_err());
        let listener = UnixListener::bind(&path).unwrap();
        assert!(lease.recover(&path).await.is_err());
        let owned = OwnedSocket::capture(&path).unwrap();
        lease.record(&owned).unwrap();
        drop(listener);
        assert!(lease.recover(&path).await.is_err()); // Current PID is alive even with a closed listener.
        assert!(path.exists());
        std::fs::write(root.join("instance.sock.owner.json"), b"{").unwrap();
        assert!(lease.recover(&path).await.is_err());
        assert!(path.exists());
        drop(owned);
        drop(lease);
        assert!(SocketLease::acquire(&path).is_ok());
        std::fs::remove_dir_all(root).unwrap();
    }
}
