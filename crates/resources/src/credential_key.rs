//! Explicit Linux worker bootstrap input. No discovery, key generation or private-facing API.
use crate::credential_envelope::{CustodyError, EnvelopeKey};
use std::path::Path;

/// A deployment-owned regular file containing exactly 32 raw bytes. The immediate directory
/// must be private to the worker. Traversal uses directory FDs and never follows symlinks.
/// This does not establish separation from the ciphertext database or from host administration.
pub fn load_key(path: &Path) -> Result<EnvelopeKey, CustodyError> {
    #[cfg(target_os = "linux")]
    {
        linux::load(path)
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = path;
        Err(CustodyError)
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use std::{
        ffi::CString,
        fs::File,
        io::Read,
        os::{
            fd::{AsRawFd, FromRawFd},
            unix::{ffi::OsStrExt, fs::MetadataExt},
        },
        path::Component,
    };
    use zeroize::Zeroizing;

    fn open(parent: &File, name: &std::ffi::OsStr, directory: bool) -> Result<File, CustodyError> {
        let name = CString::new(name.as_bytes()).map_err(|_| CustodyError)?;
        let flags = libc::O_RDONLY
            | libc::O_CLOEXEC
            | libc::O_NOFOLLOW
            | libc::O_NONBLOCK
            | if directory { libc::O_DIRECTORY } else { 0 };
        let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), flags) };
        if fd < 0 {
            return Err(CustodyError);
        }
        Ok(unsafe { File::from_raw_fd(fd) })
    }
    pub(super) fn load(path: &Path) -> Result<EnvelopeKey, CustodyError> {
        if !path.is_absolute() {
            return Err(CustodyError);
        }
        let parts = path.components().collect::<Vec<_>>();
        if parts.len() < 3
            || !matches!(parts[0], Component::RootDir)
            || parts[1..]
                .iter()
                .any(|p| !matches!(p, Component::Normal(_)))
        {
            return Err(CustodyError);
        }
        let uid = unsafe { libc::geteuid() };
        let mut parent = File::open("/").map_err(|_| CustodyError)?;
        for component in &parts[1..parts.len() - 1] {
            let Component::Normal(name) = component else {
                return Err(CustodyError);
            };
            parent = open(&parent, name, true)?;
            let meta = parent.metadata().map_err(|_| CustodyError)?;
            // Root-owned sticky staging ancestors cannot rename this worker's next directory.
            let sticky_root = meta.uid() == 0 && meta.mode() & libc::S_ISVTX != 0;
            if (meta.uid() != 0 && meta.uid() != uid) || (meta.mode() & 0o022 != 0 && !sticky_root)
            {
                return Err(CustodyError);
            }
        }
        let dir = parent.metadata().map_err(|_| CustodyError)?;
        if dir.uid() != uid || dir.mode() & 0o077 != 0 {
            return Err(CustodyError);
        }
        let Component::Normal(name) = parts[parts.len() - 1] else {
            return Err(CustodyError);
        };
        let mut file = open(&parent, name, false)?;
        let meta = file.metadata().map_err(|_| CustodyError)?;
        if !meta.is_file()
            || meta.uid() != uid
            || meta.mode() & 0o077 != 0
            || meta.nlink() != 1
            || meta.len() != 32
        {
            return Err(CustodyError);
        }
        let mut bytes = Zeroizing::new([0u8; 32]);
        file.read_exact(&mut *bytes).map_err(|_| CustodyError)?;
        let mut extra = Zeroizing::new([0u8; 1]);
        if file.read(&mut *extra).map_err(|_| CustodyError)? != 0 {
            return Err(CustodyError);
        }
        let after = file.metadata().map_err(|_| CustodyError)?;
        if after.len() != 32
            || after.mode() != meta.mode()
            || after.uid() != meta.uid()
            || after.nlink() != 1
            || after.mtime() != meta.mtime()
            || after.mtime_nsec() != meta.mtime_nsec()
            || after.ctime() != meta.ctime()
            || after.ctime_nsec() != meta.ctime_nsec()
        {
            return Err(CustodyError);
        }
        EnvelopeKey::new(bytes)
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::os::unix::fs::{PermissionsExt, symlink};
    #[test]
    fn explicit_private_key_rejects_unsafe_inputs() {
        let root = std::env::temp_dir()
            .canonicalize()
            .unwrap()
            .join(format!("ouro-key-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        let key = root.join("key");
        std::fs::write(&key, [8u8; 32]).unwrap();
        std::fs::set_permissions(&key, std::fs::Permissions::from_mode(0o600)).unwrap();
        assert!(load_key(&key).is_ok());
        let alias = root.join("alias");
        symlink(&key, &alias).unwrap();
        assert!(load_key(&alias).is_err());
        std::fs::remove_file(alias).unwrap();
        let link = root.join("hardlink");
        std::fs::hard_link(&key, &link).unwrap();
        assert!(load_key(&key).is_err());
        std::fs::remove_file(link).unwrap();
        std::fs::set_permissions(&key, std::fs::Permissions::from_mode(0o640)).unwrap();
        assert!(load_key(&key).is_err());
        std::fs::set_permissions(&key, std::fs::Permissions::from_mode(0o600)).unwrap();
        for n in [0, 31, 33] {
            std::fs::write(&key, vec![8u8; n]).unwrap();
            assert!(load_key(&key).is_err());
        }
        std::fs::write(&key, [8u8; 32]).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o755)).unwrap();
        assert!(load_key(&key).is_err());
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        assert!(load_key(Path::new("key")).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
