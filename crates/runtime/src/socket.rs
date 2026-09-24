//! A configured Linux socket is bound to its inode, not to a replaceable pathname.
use anyhow::{Context, Result, ensure};
use std::{
    fs::{File, OpenOptions},
    os::{
        fd::{AsRawFd, FromRawFd, OwnedFd},
        unix::fs::{FileTypeExt, MetadataExt, OpenOptionsExt},
    },
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

#[derive(Debug, PartialEq, Eq)]
struct Identity {
    device: u64,
    inode: u64,
    uid: u32,
    gid: u32,
    mode: u32,
}
impl Identity {
    fn of(meta: &std::fs::Metadata) -> Self {
        Self {
            device: meta.dev(),
            inode: meta.ino(),
            uid: meta.uid(),
            gid: meta.gid(),
            mode: meta.mode(),
        }
    }
}
struct Entry {
    path: PathBuf,
    file: File,
    identity: Identity,
}
struct PeerLifetime {
    identity: ouroboros_contracts::BridgeIdentity,
    lifetime: OwnedFd,
}
impl PeerLifetime {
    fn check(&self) -> Result<()> {
        let mut event = libc::pollfd {
            fd: self.lifetime.as_raw_fd(),
            events: libc::POLLIN,
            revents: 0,
        };
        ensure!(
            // SAFETY: the pointer refers to the stated number of initialized pollfd records, alive for this call.
            (unsafe { libc::poll(&mut event, 1, 0) }) == 0
                && ouroboros_transport::linux_peer(self.identity.pid, self.identity.uid)?
                    == self.identity,
            "upstream service lifetime ended"
        );
        Ok(())
    }
}
impl Entry {
    fn open(path: &Path) -> Result<Self> {
        let file = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_PATH | libc::O_NOFOLLOW | libc::O_CLOEXEC)
            .open(path)?;
        let identity = Identity::of(&file.metadata()?);
        ensure!(
            Identity::of(&std::fs::symlink_metadata(path)?) == identity,
            "path changed while binding"
        );
        Ok(Self {
            path: path.into(),
            file,
            identity,
        })
    }
    fn check(&self) -> Result<()> {
        ensure!(
            Identity::of(&std::fs::symlink_metadata(&self.path)?) == self.identity
                && Identity::of(&self.file.metadata()?) == self.identity,
            "protected socket path changed"
        );
        Ok(())
    }
}

/// Protected aliases are resolved once; every connection uses the pinned socket FD.
/// Keeping O_PATH handles open prevents inode reuse from masquerading as the old binding.
pub struct SocketBinding {
    supplied_root: PathBuf,
    supplied_socket: PathBuf,
    root: PathBuf,
    entries: Vec<Entry>,
    socket: Entry,
    uid: u32,
    peer: Mutex<Option<PeerLifetime>>,
    probed: AtomicBool,
}
impl SocketBinding {
    pub fn capture(root: &Path, socket: &Path, uid: u32) -> Result<Self> {
        ensure!(
            root.is_absolute() && socket.is_absolute(),
            "absolute IPC and socket paths required"
        );
        let canonical_root = std::fs::canonicalize(root)?;
        let canonical_socket = std::fs::canonicalize(socket)?;
        ensure!(
            canonical_socket.starts_with(&canonical_root) && canonical_socket != canonical_root,
            "socket is outside the configured IPC root"
        );
        let parent = canonical_socket.parent().context("socket parent missing")?;
        let mut ancestors: Vec<_> = parent.ancestors().collect();
        ancestors.reverse();
        let mut entries = Vec::new();
        // Validate the supplied alias chain too. Canonicalizing alone could hide an alias in an
        // untrusted directory even when its present destination is a protected service root.
        let mut supplied_ancestors: Vec<_> = socket
            .parent()
            .context("socket parent missing")?
            .ancestors()
            .collect();
        supplied_ancestors.reverse();
        for path in supplied_ancestors {
            let entry = Entry::open(path)?;
            let meta = entry.file.metadata()?;
            let sticky_ancestor = path != root
                && root.starts_with(path)
                && meta.uid() == 0
                && meta.mode() & libc::S_ISVTX != 0;
            ensure!(
                (meta.uid() == 0 || meta.uid() == uid)
                    && (meta.file_type().is_symlink()
                        || (meta.is_dir() && (meta.mode() & 0o022 == 0 || sticky_ancestor))),
                "unprotected supplied socket ancestor"
            );
            entries.push(entry);
        }
        for path in ancestors {
            let entry = Entry::open(path)?;
            let meta = entry.file.metadata()?;
            // A system temporary ancestor can be sticky, but the configured protected root cannot.
            let sticky_ancestor = canonical_root != path
                && canonical_root.starts_with(path)
                && meta.uid() == 0
                && meta.mode() & libc::S_ISVTX != 0;
            ensure!(
                meta.is_dir()
                    && (meta.uid() == 0 || meta.uid() == uid)
                    && (meta.mode() & 0o022 == 0 || sticky_ancestor),
                "unprotected IPC ancestor"
            );
            entries.push(entry);
        }
        let bound = Entry::open(&canonical_socket)?;
        let meta = bound.file.metadata()?;
        ensure!(
            meta.file_type().is_socket() && meta.uid() == uid,
            "unexpected socket type or owner"
        );
        let result = Self {
            supplied_root: root.into(),
            supplied_socket: socket.into(),
            root: canonical_root,
            entries,
            socket: bound,
            uid,
            peer: Mutex::new(None),
            probed: AtomicBool::new(false),
        };
        result.check()?;
        Ok(result)
    }
    pub fn check(&self) -> Result<()> {
        ensure!(
            std::fs::canonicalize(&self.supplied_root)? == self.root
                && std::fs::canonicalize(&self.supplied_socket)? == self.socket.path,
            "configured socket alias changed"
        );
        for entry in &self.entries {
            entry.check()?;
        }
        self.socket.check()?;
        if let Some(peer) = self
            .peer
            .lock()
            .map_err(|_| anyhow::anyhow!("peer binding unavailable"))?
            .as_ref()
        {
            peer.check()?;
        }
        Ok(())
    }
    /// A pathname binding alone is not readiness: establish an actual bounded kernel connection.
    /// No application request or delegated effect is submitted by this probe.
    pub async fn probe(&self) -> Result<()> {
        let result = async {
            self.check()?;
            let stream = tokio::time::timeout(
                std::time::Duration::from_secs(2),
                tokio::net::UnixStream::connect(self.address()),
            )
            .await
            .context("upstream readiness deadline exceeded")??;
            self.observe_peer(&stream)?;
            drop(stream);
            self.probed.store(true, Ordering::Release);
            self.ready()
        }
        .await;
        if result.is_err() {
            self.probed.store(false, Ordering::Release);
        }
        result
    }
    pub fn ready(&self) -> Result<()> {
        self.check()?;
        ensure!(
            self.probed.load(Ordering::Acquire),
            "upstream readiness probe has not succeeded"
        );
        ensure!(
            self.peer
                .lock()
                .map_err(|_| anyhow::anyhow!("peer binding unavailable"))?
                .is_some(),
            "upstream service has not been observed"
        );
        Ok(())
    }
    /// Linux pathname Unix connect resolves the O_PATH descriptor to the original socket inode.
    pub fn address(&self) -> PathBuf {
        PathBuf::from(format!("/proc/self/fd/{}", self.socket.file.as_raw_fd()))
    }
    pub fn observe_peer(&self, stream: &tokio::net::UnixStream) -> Result<()> {
        self.check()?;
        let credentials = stream.peer_cred()?;
        ensure!(
            credentials.uid() == self.uid,
            "unexpected upstream service owner"
        );
        let identity = ouroboros_transport::linux_peer(
            credentials.pid().context("upstream PID unavailable")?,
            self.uid,
        )?;
        let mut raw = -1_i32;
        let mut size = std::mem::size_of::<i32>() as libc::socklen_t;
        // SAFETY: the socket stays open and the value/length pointers refer to writable storage sized for this option.
        let outcome = unsafe {
            libc::getsockopt(
                stream.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_PEERPIDFD,
                (&mut raw as *mut i32).cast(),
                &mut size,
            )
        };
        ensure!(
            outcome == 0 && raw >= 0,
            "upstream lifetime descriptor unavailable"
        );
        // SAFETY: SO_PEERPIDFD succeeded and returned a new nonnegative descriptor; ownership transfers once.
        let lifetime = unsafe { OwnedFd::from_raw_fd(raw) };
        let mut existing = self
            .peer
            .lock()
            .map_err(|_| anyhow::anyhow!("peer binding unavailable"))?;
        if let Some(peer) = existing.as_ref() {
            peer.check()?;
            ensure!(
                peer.identity == identity,
                "upstream service instance changed"
            );
        } else {
            let peer = PeerLifetime { identity, lifetime };
            peer.check()?;
            *existing = Some(peer);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::{
        fs::{DirBuilderExt, PermissionsExt, symlink},
        net::{UnixListener, UnixStream},
    };
    struct Fixture {
        root: PathBuf,
    }
    impl Fixture {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("ouro-socket-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
            Self { root }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }
    #[test]
    fn alternate_socket_is_pinned_and_replacement_is_rejected() {
        let f = Fixture::new();
        let path = f.root.join("alternate.sock");
        let old = UnixListener::bind(&path).unwrap();
        // SAFETY: geteuid has no pointer arguments and only observes process identity.
        let binding = SocketBinding::capture(&f.root, &path, unsafe { libc::geteuid() }).unwrap();
        let first = UnixStream::connect(binding.address()).unwrap();
        let _accepted = old.accept().unwrap();
        drop(first);
        std::fs::remove_file(&path).unwrap();
        let replacement = UnixListener::bind(&path).unwrap();
        replacement.set_nonblocking(true).unwrap();
        assert!(binding.check().is_err());
        // Even a caller omitting revalidation cannot be redirected to the replacement listener.
        let retry = UnixStream::connect(binding.address());
        assert!(replacement.accept().is_err());
        drop(retry);
    }
    #[test]
    fn unsafe_roots_wrong_owner_and_non_sockets_are_denied() {
        let f = Fixture::new();
        let path = f.root.join("test.sock");
        let _listener = UnixListener::bind(&path).unwrap();
        // SAFETY: geteuid has no pointer arguments and only observes process identity.
        let uid = unsafe { libc::geteuid() };
        assert!(SocketBinding::capture(&f.root, &path, uid.wrapping_add(1)).is_err());
        let ordinary = f.root.join("ordinary");
        std::fs::write(&ordinary, b"not a socket").unwrap();
        assert!(SocketBinding::capture(&f.root, &ordinary, uid).is_err());
        std::fs::set_permissions(&f.root, std::fs::Permissions::from_mode(0o777)).unwrap();
        assert!(SocketBinding::capture(&f.root, &path, uid).is_err());
    }
    #[test]
    fn alias_retarget_and_parent_replacement_are_detected() {
        let f = Fixture::new();
        let a = f.root.join("a");
        let b = f.root.join("b");
        std::fs::DirBuilder::new().mode(0o700).create(&a).unwrap();
        std::fs::DirBuilder::new().mode(0o700).create(&b).unwrap();
        let _a = UnixListener::bind(a.join("socket")).unwrap();
        let _b = UnixListener::bind(b.join("socket")).unwrap();
        let alias = f.root.join("alias");
        symlink(&a, &alias).unwrap();
        let bound =
            // SAFETY: geteuid has no pointer arguments and only observes process identity.
            SocketBinding::capture(&f.root, &alias.join("socket"), unsafe { libc::geteuid() })
                .unwrap();
        std::fs::remove_file(&alias).unwrap();
        symlink(&b, &alias).unwrap();
        assert!(bound.check().is_err());
        let direct =
            // SAFETY: geteuid has no pointer arguments and only observes process identity.
            SocketBinding::capture(&f.root, &a.join("socket"), unsafe { libc::geteuid() }).unwrap();
        std::fs::rename(&a, f.root.join("retired-a")).unwrap();
        std::fs::DirBuilder::new().mode(0o700).create(&a).unwrap();
        let _replacement = UnixListener::bind(a.join("socket")).unwrap();
        assert!(direct.check().is_err());
    }
    #[tokio::test]
    async fn actual_upstream_peer_is_bound_to_its_kernel_lifetime() {
        let f = Fixture::new();
        let path = f.root.join("peer.sock");
        let _listener = UnixListener::bind(&path).unwrap();
        let mut binding =
            // SAFETY: geteuid has no pointer arguments and only observes process identity.
            SocketBinding::capture(&f.root, &path, unsafe { libc::geteuid() }).unwrap();
        let first = tokio::net::UnixStream::connect(binding.address())
            .await
            .unwrap();
        binding.observe_peer(&first).unwrap();
        binding.check().unwrap();
        let second = tokio::net::UnixStream::connect(binding.address())
            .await
            .unwrap();
        binding.observe_peer(&second).unwrap();
        binding.uid = binding.uid.wrapping_add(1);
        assert!(binding.observe_peer(&second).is_err());
    }
    #[tokio::test]
    async fn leftover_socket_without_listener_is_not_ready() {
        let f = Fixture::new();
        let path = f.root.join("dead.sock");
        let listener = UnixListener::bind(&path).unwrap();
        drop(listener);
        // SAFETY: geteuid has no pointer arguments and only observes process identity.
        let binding = SocketBinding::capture(&f.root, &path, unsafe { libc::geteuid() }).unwrap();
        assert!(binding.ready().is_err());
        assert!(binding.probe().await.is_err());
        assert!(binding.ready().is_err());
    }
    #[tokio::test]
    async fn readiness_requires_probe_and_listener_loss_rejects_new_probe() {
        let f = Fixture::new();
        let path = f.root.join("ready.sock");
        let listener = UnixListener::bind(&path).unwrap();
        // SAFETY: geteuid has no pointer arguments and only observes process identity.
        let binding = SocketBinding::capture(&f.root, &path, unsafe { libc::geteuid() }).unwrap();
        assert!(binding.ready().is_err());
        binding.probe().await.unwrap();
        binding.ready().unwrap();
        drop(listener);
        assert!(binding.probe().await.is_err());
        assert!(binding.ready().is_err());
    }
}
