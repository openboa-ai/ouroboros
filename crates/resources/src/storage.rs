//! Explicit local-store preparation and pinned, directory-relative runtime access.
//!
//! This binds a local mount/session and physical directory. It is not APFS volume enrollment,
//! rollback freshness, sovereign authority, or proof of a complete storage lifecycle. Startup
//! never creates/adopts storage. The descriptor must remain outside the private store root.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct StorageBinding {
    pub schema_version: u32,
    pub root: PathBuf,
    pub owner_uid: u32,
    pub device: u64,
    pub root_inode: u64,
    /// Native fstatfs fsid bytes, lowercase hexadecimal. Not a persistent volume UUID.
    pub filesystem_id: String,
    /// Measured external restriction-anchor custody; moving a descriptor cannot clear a latch.
    pub registration_root: PathBuf,
    pub registration_device: u64,
    pub registration_inode: u64,
    pub registration_filesystem_id: String,
    pub firm_id: Uuid,
    pub store_id: Uuid,
    pub generation: Uuid,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrepareConfig {
    pub root: PathBuf,
    pub binding_file: PathBuf,
    pub owner_uid: u32,
    pub firm_id: Uuid,
    pub store_id: Uuid,
    pub generation: Uuid,
}
impl PrepareConfig {
    pub fn resolve_paths(&mut self, base: &ouroboros_transport::config::ConfigRoot) -> Result<()> {
        base.resolve(&mut self.root)?;
        base.resolve(&mut self.binding_file)
    }
}

/// Physical identity observed under a collection pin. Serialization conveys no deletion authority.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct CollectionObjectIdentity {
    pub object_id: Uuid,
    pub device: u64,
    pub inode: u64,
    pub sha256: String,
    pub size: u64,
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub use native::{BlobReader, BoundStore, CollectionPin, PinnedBlob, StagedBlob, prepare};

/// Upper bound for one in-memory transfer buffer, independently of the admitted file size.
pub const BLOB_CHUNK_BYTES: usize = 64 * 1024;

#[cfg(any(target_os = "macos", target_os = "linux"))]
mod native {
    use super::*;
    use anyhow::Context;
    use sha2::{Digest, Sha256};
    use std::{
        ffi::{CStr, CString, OsStr},
        fs::{File, Metadata},
        io::{Read, Seek, SeekFrom, Write},
        os::{
            fd::{AsRawFd, FromRawFd, IntoRawFd, RawFd},
            unix::{ffi::OsStrExt, fs::MetadataExt},
        },
        path::Component,
        sync::{
            Mutex,
            atomic::{AtomicBool, Ordering},
        },
    };

    const MARKER: &str = ".ouroboros-store.json";
    const MAX_BINDING_BYTES: usize = 16 * 1024;

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct NodeIdentity {
        device: u64,
        inode: u64,
        uid: u32,
    }
    impl NodeIdentity {
        fn of(meta: &Metadata) -> Self {
            Self {
                device: meta.dev(),
                inode: meta.ino(),
                uid: meta.uid(),
            }
        }
    }
    struct Chain {
        path: PathBuf,
        nodes: Vec<File>,
        identities: Vec<NodeIdentity>,
    }
    impl Chain {
        fn open(path: &Path, uid: u32, private_leaf: bool) -> Result<Self> {
            require_absolute(path)?;
            let mut nodes = vec![open_at(
                libc::AT_FDCWD,
                OsStr::new("/"),
                directory_flags(),
                0,
            )?];
            for component in path.components().skip(1) {
                let Component::Normal(name) = component else {
                    anyhow::bail!("noncanonical storage path")
                };
                let next = open_at(
                    nodes.last().unwrap().as_raw_fd(),
                    name,
                    directory_flags(),
                    0,
                )?;
                nodes.push(next);
            }
            let mut identities = Vec::with_capacity(nodes.len());
            for (i, node) in nodes.iter().enumerate() {
                let meta = node.metadata()?;
                protect_directory(&meta, uid, private_leaf && i + 1 == nodes.len())?;
                identities.push(NodeIdentity::of(&meta));
            }
            Ok(Self {
                path: path.to_owned(),
                nodes,
                identities,
            })
        }
        fn leaf(&self) -> &File {
            self.nodes.last().unwrap()
        }
        fn recheck(&self, uid: u32, private_leaf: bool) -> Result<()> {
            let current = Self::open(&self.path, uid, private_leaf)?;
            ensure!(
                current.identities == self.identities,
                "storage path identity changed"
            );
            for (i, fd) in self.nodes.iter().enumerate() {
                let meta = fd.metadata()?;
                protect_directory(&meta, uid, private_leaf && i + 1 == self.nodes.len())?;
                ensure!(
                    NodeIdentity::of(&meta) == self.identities[i],
                    "pinned directory identity changed"
                );
            }
            Ok(())
        }
    }

    /// Holds the exclusive writer lock and all original directory handles until dropped.
    pub struct BoundStore {
        binding: StorageBinding,
        root: Chain,
        descriptor_parent: Chain,
        descriptor_name: CString,
        restriction_name: CString,
        descriptor_identity: NodeIdentity,
        marker_identity: NodeIdentity,
        restricted: AtomicBool,
        operations: Mutex<()>,
        handle_id: Uuid,
    }

    /// The catalog selects this address from durable metadata. A digest verifies bytes; it
    /// never identifies a UUID object or serves as a fallback for a missing object path.
    enum BlobAddress {
        LegacyDigest(String),
        Object(Uuid),
    }
    impl BlobAddress {
        fn name(&self) -> String {
            match self {
                Self::LegacyDigest(digest) => digest.clone(),
                Self::Object(id) => format!("blob-{id}"),
            }
        }
    }

    /// Owns one nonblocking, exclusively locked staging/installed file. Dropping a failed
    /// transfer preserves its bytes and durable catalog inventory; it never removes a file.
    pub struct StagedBlob {
        pub(crate) staging_id: Uuid,
        pub(crate) digest: String,
        pub(crate) size: u64,
        handle_id: Uuid,
        file: File,
        identity: NodeIdentity,
        written: u64,
        hasher: Sha256,
        transfer: bool,
        failed: bool,
        address: BlobAddress,
        original: (Uuid, String, u64),
    }
    impl StagedBlob {
        /// A prior staging/install cannot receive more bytes. Metadata-only callers must
        /// verify that recovered content before treating it as complete.
        pub fn requires_transfer(&self) -> bool {
            self.transfer
        }
        fn context_matches(&self) -> bool {
            self.staging_id == self.original.0
                && self.digest == self.original.1
                && self.size == self.original.2
                && match &self.address {
                    BlobAddress::LegacyDigest(digest) => digest == &self.original.1,
                    BlobAddress::Object(id) => id == &self.original.0,
                }
        }
    }

    /// A verified, pinned immutable file. The descriptor and its integrity observations are
    /// private; callers can read only bounded chunks through the currently bound store.
    pub struct BlobReader {
        pub digest: String,
        pub size: u64,
        handle_id: Uuid,
        file: File,
        verified_metadata: Metadata,
        verified_digest: String,
        position: u64,
        address: BlobAddress,
    }

    /// The shared file lock and exact inode are acquired while the catalog holds its metadata
    /// lock. This type deliberately exposes no bytes until verification after that commit.
    pub struct PinnedBlob {
        handle_id: Uuid,
        file: File,
        metadata: Metadata,
        address: BlobAddress,
        digest: String,
        size: u64,
    }

    /// One exclusively locked UUID object in this exact store session. The pin cannot be
    /// constructed or modified from a serialized identity, nor used before byte verification.
    pub struct CollectionPin {
        handle_id: Uuid,
        file: File,
        metadata: Metadata,
        identity: CollectionObjectIdentity,
        verified: bool,
        failed: bool,
    }
    impl CollectionPin {
        pub fn identity(&self) -> &CollectionObjectIdentity {
            &self.identity
        }
    }

    impl BoundStore {
        pub fn open(binding_file: &Path) -> Result<Self> {
            // SAFETY: geteuid takes no pointer arguments and only observes process identity.
            let uid = unsafe { libc::geteuid() };
            let (parent, name) = split_file(binding_file)?;
            let descriptor_parent = Chain::open(parent, uid, true)?;
            let descriptor = open_at(descriptor_parent.leaf().as_raw_fd(), name, read_flags(), 0)?;
            let descriptor_meta = descriptor.metadata()?;
            protect_file(&descriptor_meta, uid, false)?;
            let bytes = bounded_read(descriptor, MAX_BINDING_BYTES)?;
            let binding: StorageBinding = parse_binding(&bytes)?;
            validate_binding(&binding, uid)?;
            check_registration(&descriptor_parent, &binding)?;
            let restriction_name = restriction_name(binding.store_id, binding.generation)?;
            let anchor = descriptor_parent.leaf().try_clone()?;
            ensure!(
                !exists_at(
                    anchor.as_raw_fd(),
                    OsStr::from_bytes(restriction_name.as_bytes())
                )?,
                "store is durably restricted"
            );
            let opened = Self::open_inner(
                binding_file,
                name,
                binding,
                descriptor_meta,
                descriptor_parent,
                restriction_name.clone(),
            );
            if let Err(error) = &opened {
                // A competing opener is not evidence of identity loss and must not poison
                // the already-running writer's next operation.
                if error.downcast_ref::<WriterBusy>().is_none() {
                    persist_restriction(&anchor, &restriction_name).context(
                        "store opening failed and durable restriction could not be recorded",
                    )?;
                }
            }
            opened
        }
        fn open_inner(
            binding_file: &Path,
            name: &OsStr,
            binding: StorageBinding,
            descriptor_meta: Metadata,
            descriptor_parent: Chain,
            restriction_name: CString,
        ) -> Result<Self> {
            let uid = binding.owner_uid;
            let root = Chain::open(&binding.root, uid, true)?;
            ensure_outside(&root, &descriptor_parent, binding_file)?;
            check_physical(root.leaf(), &binding)?;
            lock(root.leaf())?;
            check_physical(root.leaf(), &binding)?;
            let marker = open_at(root.leaf().as_raw_fd(), OsStr::new(MARKER), read_flags(), 0)?;
            let marker_meta = marker.metadata()?;
            protect_file(&marker_meta, uid, true)?;
            ensure!(
                parse_binding(&bounded_read(marker, MAX_BINDING_BYTES)?)? == binding,
                "store marker mismatch"
            );
            let store = Self {
                binding,
                root,
                descriptor_parent,
                descriptor_name: cstring(name)?,
                restriction_name,
                descriptor_identity: NodeIdentity::of(&descriptor_meta),
                marker_identity: NodeIdentity::of(&marker_meta),
                restricted: AtomicBool::new(false),
                operations: Mutex::new(()),
                handle_id: Uuid::new_v4(),
            };
            store.validate()?;
            Ok(store)
        }

        pub fn identity(&self) -> &StorageBinding {
            &self.binding
        }

        /// Record a worker-observed catalog registration mismatch. This restriction-only
        /// external anchor cannot activate storage or grant authority.
        pub fn mark_restricted(&self) -> Result<()> {
            self.restricted.store(true, Ordering::Release);
            persist_restriction(self.descriptor_parent.leaf(), &self.restriction_name)
        }

        /// A failed identity/protection check latches restriction for this handle's lifetime.
        pub fn validate(&self) -> Result<()> {
            ensure!(
                !self.restricted.load(Ordering::Acquire),
                "store is restricted"
            );
            let checked = self.validate_inner();
            if checked.is_err() {
                self.mark_restricted().context(
                    "store validation failed and durable restriction could not be recorded",
                )?;
            }
            checked
        }
        fn validate_inner(&self) -> Result<()> {
            self.root.recheck(self.binding.owner_uid, true)?;
            self.descriptor_parent
                .recheck(self.binding.owner_uid, true)?;
            check_registration(&self.descriptor_parent, &self.binding)?;
            ensure!(
                !exists_at(
                    self.descriptor_parent.leaf().as_raw_fd(),
                    OsStr::from_bytes(self.restriction_name.as_bytes())
                )?,
                "store is durably restricted"
            );
            check_physical(self.root.leaf(), &self.binding)?;
            let descriptor = open_cstr(
                self.descriptor_parent.leaf().as_raw_fd(),
                &self.descriptor_name,
                read_flags(),
                0,
            )?;
            let meta = descriptor.metadata()?;
            protect_file(&meta, self.binding.owner_uid, false)?;
            ensure!(
                NodeIdentity::of(&meta) == self.descriptor_identity,
                "binding file identity changed"
            );
            ensure!(
                parse_binding(&bounded_read(descriptor, MAX_BINDING_BYTES)?)? == self.binding,
                "binding file changed"
            );
            let marker = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(MARKER),
                read_flags(),
                0,
            )?;
            let meta = marker.metadata()?;
            protect_file(&meta, self.binding.owner_uid, true)?;
            ensure!(
                NodeIdentity::of(&meta) == self.marker_identity,
                "marker identity changed"
            );
            ensure!(
                parse_binding(&bounded_read(marker, MAX_BINDING_BYTES)?)? == self.binding,
                "marker changed"
            );
            Ok(())
        }

        pub fn read_blob(&self, digest: &str, max_bytes: usize) -> Result<Vec<u8>> {
            let mut reader = self.open_blob(digest, None, max_bytes as u64)?;
            let mut bytes = Vec::new();
            loop {
                let chunk = self.read_blob_chunk(&mut reader, BLOB_CHUNK_BYTES)?;
                if chunk.is_empty() {
                    return Ok(bytes);
                }
                bytes.extend_from_slice(&chunk);
            }
        }

        /// The lookup transaction must end before this bounded-memory integrity scan starts.
        pub fn open_blob(&self, digest: &str, size: Option<u64>, max: u64) -> Result<BlobReader> {
            check_digest(digest)?;
            ensure!(max > 0, "positive content bound required");
            self.validate()?;
            let mut file = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(digest),
                read_flags(),
                0,
            )?;
            let meta = file.metadata()?;
            protect_file(&meta, self.binding.owner_uid, true)?;
            ensure!(
                meta.len() <= max && size.is_none_or(|value| value == meta.len()),
                "stored content size mismatch"
            );
            verify_file(&mut file, digest, meta.len())?;
            ensure!(
                same_version(&meta, &file.metadata()?),
                "content changed during verification"
            );
            self.validate()?;
            Ok(BlobReader {
                digest: digest.to_owned(),
                size: meta.len(),
                file,
                handle_id: self.handle_id,
                verified_metadata: meta,
                verified_digest: digest.to_owned(),
                position: 0,
                address: BlobAddress::LegacyDigest(digest.to_owned()),
            })
        }

        /// Pin a UUID object without reading content. The caller retains its catalog lock
        /// through this call, then commits before verify_pinned performs the integrity scan.
        pub fn pin_object(
            &self,
            object_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<PinnedBlob> {
            check_digest(digest)?;
            ensure!(
                !object_id.is_nil() && max > 0 && size <= max && size <= i64::MAX as u64,
                "invalid object read bound"
            );
            self.validate()?;
            let address = BlobAddress::Object(object_id);
            let file = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(&address.name()),
                read_flags(),
                0,
            )?;
            shared_lock(&file)?;
            let metadata = file.metadata()?;
            protect_file(&metadata, self.binding.owner_uid, true)?;
            ensure!(metadata.len() == size, "object recorded size mismatch");
            self.check_blob_name(&address, &metadata)?;
            self.validate()?;
            Ok(PinnedBlob {
                handle_id: self.handle_id,
                file,
                metadata,
                address,
                digest: digest.to_owned(),
                size,
            })
        }

        pub fn verify_pinned(&self, mut pinned: PinnedBlob) -> Result<BlobReader> {
            ensure!(
                pinned.handle_id == self.handle_id,
                "pin belongs to another store session"
            );
            self.validate()?;
            let metadata = pinned.file.metadata()?;
            protect_file(&metadata, self.binding.owner_uid, true)?;
            ensure!(
                same_version(&pinned.metadata, &metadata),
                "pinned object changed before verification"
            );
            self.check_blob_name(&pinned.address, &metadata)?;
            verify_file(&mut pinned.file, &pinned.digest, pinned.size)?;
            ensure!(
                same_version(&pinned.metadata, &pinned.file.metadata()?),
                "pinned object changed during verification"
            );
            self.validate()?;
            Ok(BlobReader {
                digest: pinned.digest.clone(),
                size: pinned.size,
                handle_id: self.handle_id,
                file: pinned.file,
                verified_metadata: pinned.metadata,
                verified_digest: pinned.digest,
                position: 0,
                address: pinned.address,
            })
        }

        /// Acquire only metadata and a nonblocking exclusive file lock while Catalog holds
        /// the object row. Catalog verifies outside that transaction and must commit a marker before removal;
        /// this primitive neither establishes that marker nor grants authority to delete.
        pub fn pin_collection(
            &self,
            object_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<CollectionPin> {
            check_digest(digest)?;
            ensure!(
                !object_id.is_nil() && max > 0 && size <= max && size <= i64::MAX as u64,
                "invalid collection object bound"
            );
            self.validate()?;
            let address = BlobAddress::Object(object_id);
            let file = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(&address.name()),
                read_flags(),
                0,
            )?;
            // An ordinary live reader/writer is a retryable conflict, not storage corruption.
            // SAFETY: file retains ownership of a live descriptor throughout the synchronous flock call.
            if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
                // Preserve WouldBlock in the anyhow chain so Catalog never classifies a
                // changed identity or corrupt metadata as an ordinary lock conflict.
                return Err(std::io::Error::last_os_error().into());
            }
            let metadata = file.metadata()?;
            protect_file(&metadata, self.binding.owner_uid, true)?;
            ensure!(metadata.len() == size, "collection object size mismatch");
            self.check_blob_name(&address, &metadata)?;
            self.validate()?;
            Ok(CollectionPin {
                handle_id: self.handle_id,
                file,
                identity: CollectionObjectIdentity {
                    object_id,
                    device: metadata.dev(),
                    inode: metadata.ino(),
                    sha256: digest.to_owned(),
                    size,
                },
                metadata,
                verified: false,
                failed: false,
            })
        }

        fn check_collection_pin(&self, pin: &CollectionPin) -> Result<()> {
            ensure!(
                pin.handle_id == self.handle_id && !pin.failed,
                "collection pin is invalid for this store session"
            );
            self.validate()?;
            let metadata = pin.file.metadata()?;
            protect_file(&metadata, self.binding.owner_uid, true)?;
            ensure!(
                !pin.identity.object_id.is_nil()
                    && metadata.dev() == pin.identity.device
                    && metadata.ino() == pin.identity.inode
                    && metadata.len() == pin.identity.size
                    && same_version(&pin.metadata, &metadata),
                "collection object changed since it was pinned"
            );
            let current = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(&BlobAddress::Object(pin.identity.object_id).name()),
                read_flags(),
                0,
            )?;
            let current_metadata = current.metadata()?;
            protect_file(&current_metadata, self.binding.owner_uid, true)?;
            ensure!(
                same_version(&pin.metadata, &current_metadata),
                "collection name or metadata differs from the pinned object"
            );
            self.validate()
        }

        /// Hash only after the Catalog transaction ends. Any failed check permanently
        /// invalidates this pin, even if a caller subsequently repairs or restores the file.
        pub fn verify_collection(&self, pin: &mut CollectionPin) -> Result<()> {
            let result = (|| {
                self.check_collection_pin(pin)?;
                verify_file(&mut pin.file, &pin.identity.sha256, pin.identity.size)?;
                self.check_collection_pin(pin)?;
                Ok(())
            })();
            if result.is_ok() {
                pin.verified = true;
            } else {
                pin.failed = true;
                pin.verified = false;
            }
            result
        }

        /// Remove only this verified UUID object's final name. The caller must already own
        /// its durable deletion marker and current Core claim. No path/digest fallback exists.
        pub fn remove_collection(&self, pin: CollectionPin) -> Result<()> {
            self.remove_collection_inner(
                pin,
                #[cfg(test)]
                false,
            )
        }

        fn remove_collection_inner(
            &self,
            pin: CollectionPin,
            #[cfg(test)] fail_after_unlink: bool,
        ) -> Result<()> {
            ensure!(
                pin.verified && !pin.failed,
                "collection pin was not verified"
            );
            let _guard = self
                .operations
                .lock()
                .map_err(|_| anyhow::anyhow!("store is restricted"))?;
            self.check_collection_pin(&pin)?;
            let object_id = pin.identity.object_id;
            let name = CString::new(BlobAddress::Object(object_id).name())?;
            // The single-writer store and namespace mutex serialize cooperating mutations.
            // A process that can bypass this custody is outside this local storage boundary.
            ensure!(
                // SAFETY: the root descriptor is borrowed and name is a live NUL-terminated CString.
                unsafe { libc::unlinkat(self.root.leaf().as_raw_fd(), name.as_ptr(), 0) } == 0,
                "collection object unlink failed: {}",
                std::io::Error::last_os_error()
            );
            drop(pin.file);
            #[cfg(test)]
            if fail_after_unlink {
                return Err(std::io::Error::from_raw_os_error(libc::EIO).into());
            }
            self.root.leaf().sync_all()?;
            self.validate()?;
            ensure!(
                !self.collection_object_present(object_id)?,
                "collection object is still present"
            );
            self.validate()
        }

        fn collection_object_present(&self, object_id: Uuid) -> Result<bool> {
            let address = BlobAddress::Object(object_id);
            let name = address.name();
            if !exists_at(self.root.leaf().as_raw_fd(), OsStr::new(&name))? {
                return Ok(false);
            }
            let file = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(&name),
                read_flags(),
                0,
            )?;
            let metadata = file.metadata()?;
            protect_file(&metadata, self.binding.owner_uid, true)?;
            self.check_blob_name(&address, &metadata)?;
            Ok(true)
        }

        /// Observe a single UUID final name without removing or creating anything. Only a
        /// Catalog with an existing deletion marker may interpret this as recovery evidence;
        /// absence alone neither proves a prior deletion nor returns storage capacity.
        pub fn confirm_collection_absence(&self, object_id: Uuid) -> Result<bool> {
            ensure!(!object_id.is_nil(), "invalid collection object identity");
            let _guard = self
                .operations
                .lock()
                .map_err(|_| anyhow::anyhow!("store is restricted"))?;
            self.validate()?;
            let first_present = self.collection_object_present(object_id)?;
            self.root.leaf().sync_all()?;
            let second_present = self.collection_object_present(object_id)?;
            self.validate()?;
            Ok(!first_present && !second_present)
        }

        pub fn open_object(
            &self,
            object_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<BlobReader> {
            self.verify_pinned(self.pin_object(object_id, digest, size, max)?)
        }

        fn check_blob_name(&self, address: &BlobAddress, metadata: &Metadata) -> Result<()> {
            let current = open_at(
                self.root.leaf().as_raw_fd(),
                OsStr::new(&address.name()),
                read_flags(),
                0,
            )?;
            ensure!(
                same_node(metadata, &current.metadata()?),
                "blob name no longer identifies its pinned inode"
            );
            Ok(())
        }

        pub fn read_blob_chunk(&self, reader: &mut BlobReader, max: usize) -> Result<Vec<u8>> {
            ensure!(max > 0 && max <= BLOB_CHUNK_BYTES, "invalid chunk bound");
            ensure!(
                reader.handle_id == self.handle_id,
                "reader belongs to another store session"
            );
            ensure!(
                reader.size == reader.verified_metadata.len()
                    && reader.digest == reader.verified_digest,
                "reader metadata was changed"
            );
            self.validate()?;
            let meta = reader.file.metadata()?;
            protect_file(&meta, self.binding.owner_uid, true)?;
            ensure!(
                same_version(&reader.verified_metadata, &meta),
                "verified content changed"
            );
            self.check_blob_name(&reader.address, &meta)?;
            let count = usize::try_from((reader.size - reader.position).min(max as u64))?;
            let mut bytes = vec![0; count];
            // An interrupted read may advance the FD before returning an error. Retrying
            // this reader must resume at the last successfully delivered offset.
            reader.file.seek(SeekFrom::Start(reader.position))?;
            reader.file.read_exact(&mut bytes)?;
            ensure!(
                same_version(&reader.verified_metadata, &reader.file.metadata()?),
                "content changed while reading"
            );
            self.validate()?;
            reader.position += count as u64;
            Ok(bytes)
        }

        /// The catalog must commit this staging identity before begin. The file-scoped lock
        /// spans the stream, but no store mutex or database transaction does.
        pub fn begin_staged_blob(
            &self,
            staging_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<StagedBlob> {
            let mut staged = self.begin_staged_at_metadata(
                staging_id,
                digest,
                size,
                max,
                BlobAddress::LegacyDigest(digest.to_owned()),
            )?;
            self.verify_staged_blob(&mut staged)?;
            Ok(staged)
        }

        /// A new upload's object ID is its already-inventoried staging ID. Separate uploads
        /// never share a final name, even if their bytes and digest are identical.
        pub fn begin_staged_object(
            &self,
            staging_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<StagedBlob> {
            let mut staged = self.begin_staged_object_metadata(staging_id, digest, size, max)?;
            self.verify_staged_blob(&mut staged)?;
            Ok(staged)
        }

        /// Pin/create the exact inventoried object while Catalog holds its row lock. This
        /// step checks metadata and owns the exclusive FD lock but never scans prior bytes.
        pub(crate) fn begin_staged_object_metadata(
            &self,
            staging_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
        ) -> Result<StagedBlob> {
            self.begin_staged_at_metadata(
                staging_id,
                digest,
                size,
                max,
                BlobAddress::Object(staging_id),
            )
        }

        fn begin_staged_at_metadata(
            &self,
            staging_id: Uuid,
            digest: &str,
            size: u64,
            max: u64,
            address: BlobAddress,
        ) -> Result<StagedBlob> {
            check_digest(digest)?;
            ensure!(
                !staging_id.is_nil() && max > 0 && size <= max && size <= i64::MAX as u64,
                "invalid upload bound"
            );
            let _guard = self
                .operations
                .lock()
                .map_err(|_| anyhow::anyhow!("store is restricted"))?;
            self.validate()?;
            let directory = self.root.leaf().as_raw_fd();
            let staging = CString::new(format!(".staging-{staging_id}"))?;
            let has_staging = exists_at(directory, OsStr::from_bytes(staging.as_bytes()))?;
            let final_name = address.name();
            let installed = exists_at(directory, OsStr::new(&final_name))?;
            let transfer = !has_staging && !installed;
            let file = if has_staging {
                open_cstr(directory, &staging, read_flags(), 0)?
            } else if installed {
                open_at(directory, OsStr::new(&final_name), read_flags(), 0)?
            } else {
                open_cstr(
                    directory,
                    &staging,
                    (create_flags() & !libc::O_WRONLY) | libc::O_RDWR,
                    0o600,
                )?
            };
            // Another stream still owns this exact inode. Do not inspect/complete its content.
            lock(&file)?;
            let meta = file.metadata()?;
            if installed && has_staging {
                let destination = open_at(directory, OsStr::new(&final_name), read_flags(), 0)?;
                ensure!(
                    same_node(&meta, &destination.metadata()?) && meta.nlink() == 2,
                    "unresolved staging installation identity"
                );
                protect_staging(&meta, self.binding.owner_uid, 2)?;
            } else {
                protect_file(&meta, self.binding.owner_uid, true)?;
            }
            // The file lock now owns the selected inode. Verification and stream waiting
            // must not hold the store-wide namespace mutation mutex.
            drop(_guard);
            if transfer {
                self.root.leaf().sync_all()?;
            }
            self.validate()?;
            Ok(StagedBlob {
                staging_id,
                digest: digest.to_owned(),
                size,
                handle_id: self.handle_id,
                identity: NodeIdentity::of(&meta),
                file,
                written: if transfer { 0 } else { size },
                hasher: Sha256::new(),
                transfer,
                failed: false,
                address,
                original: (staging_id, digest.to_owned(), size),
            })
        }

        /// Verify recovered bytes after Catalog has committed its metadata lookup. Fresh
        /// transfers have no recovered payload to scan; neither kind may change its binding.
        pub(crate) fn verify_staged_blob(&self, staged: &mut StagedBlob) -> Result<()> {
            let result = (|| {
                self.check_staged_identity(staged)?;
                if !staged.transfer {
                    // An incomplete prior transfer stays read-only and cannot be resumed,
                    // appended, reset or mistaken for a verified immutable installation.
                    verify_file(&mut staged.file, &staged.digest, staged.size)?;
                    self.check_staged_identity(staged)?;
                }
                Ok(())
            })();
            if result.is_err() {
                staged.failed = true;
            }
            result
        }

        fn check_staged_identity(&self, staged: &StagedBlob) -> Result<()> {
            ensure!(
                !staged.failed && staged.handle_id == self.handle_id && staged.context_matches(),
                "staging handle does not match this store session"
            );
            self.validate()?;
            let metadata = staged.file.metadata()?;
            ensure!(
                NodeIdentity::of(&metadata) == staged.identity,
                "staging file identity changed"
            );
            let directory = self.root.leaf().as_raw_fd();
            let staging_name = format!(".staging-{}", staged.staging_id);
            let final_name = staged.address.name();
            let has_staging = exists_at(directory, OsStr::new(&staging_name))?;
            let installed = exists_at(directory, OsStr::new(&final_name))?;
            ensure!(
                has_staging || installed,
                "staged content address is missing"
            );
            if has_staging {
                self.check_staging_name(staged)?;
            }
            if installed {
                let file = open_at(directory, OsStr::new(&final_name), read_flags(), 0)?;
                ensure!(
                    NodeIdentity::of(&file.metadata()?) == staged.identity,
                    "installed content address changed"
                );
            }
            if has_staging && installed {
                ensure!(
                    !staged.transfer,
                    "active transfer was installed unexpectedly"
                );
                protect_staging(&metadata, self.binding.owner_uid, 2)?;
            } else {
                protect_file(&metadata, self.binding.owner_uid, true)?;
            }
            if staged.transfer {
                ensure!(
                    has_staging && !installed && metadata.len() == staged.written,
                    "active staging address or size changed"
                );
            }
            self.validate()
        }

        pub fn write_blob_chunk(&self, staged: &mut StagedBlob, bytes: &[u8]) -> Result<()> {
            let result = (|| {
                ensure!(
                    !staged.failed
                        && staged.transfer
                        && staged.handle_id == self.handle_id
                        && staged.context_matches(),
                    "staging handle is not writable in this store session"
                );
                ensure!(
                    bytes.len() <= BLOB_CHUNK_BYTES,
                    "upload chunk exceeds bound"
                );
                let next = staged
                    .written
                    .checked_add(bytes.len() as u64)
                    .ok_or_else(|| anyhow::anyhow!("upload size overflow"))?;
                ensure!(next <= staged.size, "upload exceeds declared size");
                self.validate()?;
                let meta = staged.file.metadata()?;
                protect_file(&meta, self.binding.owner_uid, true)?;
                ensure!(
                    NodeIdentity::of(&meta) == staged.identity && meta.len() == staged.written,
                    "staging file identity or size changed"
                );
                self.check_staging_name(staged)?;
                staged.file.write_all(bytes)?;
                staged.hasher.update(bytes);
                staged.written = next;
                self.validate()
            })();
            if result.is_err() {
                // write_all may have performed a partial write. Never reuse a failed session.
                staged.failed = true;
            }
            result
        }

        fn check_staging_name(&self, staged: &StagedBlob) -> Result<()> {
            let name = CString::new(format!(".staging-{}", staged.staging_id))?;
            let file = open_cstr(self.root.leaf().as_raw_fd(), &name, read_flags(), 0)?;
            ensure!(
                NodeIdentity::of(&file.metadata()?) == staged.identity,
                "staging name no longer identifies its pinned file"
            );
            Ok(())
        }

        pub fn finish_staged_blob(&self, staged: StagedBlob) -> Result<()> {
            self.finish_staged_blob_inner(
                staged,
                #[cfg(test)]
                None,
            )
        }

        fn finish_staged_blob_inner(
            &self,
            mut staged: StagedBlob,
            #[cfg(test)] fault: Option<WriteFault>,
        ) -> Result<()> {
            ensure!(
                !staged.failed
                    && staged.handle_id == self.handle_id
                    && staged.context_matches()
                    && staged.written == staged.size,
                "incomplete or mismatched staging session"
            );
            if staged.transfer {
                ensure!(
                    hex::encode(staged.hasher.clone().finalize()) == staged.digest,
                    "upload content digest mismatch"
                );
            }
            self.validate()?;
            staged.file.sync_all()?;
            #[cfg(test)]
            injected_fault(fault, WriteFault::FileSynced)?;
            // Re-read actual disk bytes, rather than treating the incoming hash as disk proof.
            verify_file(&mut staged.file, &staged.digest, staged.size)?;
            let _guard = self
                .operations
                .lock()
                .map_err(|_| anyhow::anyhow!("store is restricted"))?;
            self.validate()?;
            let directory = self.root.leaf().as_raw_fd();
            let staging = CString::new(format!(".staging-{}", staged.staging_id))?;
            let stage_exists = exists_at(directory, OsStr::from_bytes(staging.as_bytes()))?;
            let final_name = staged.address.name();
            let destination = cstring(OsStr::new(&final_name))?;
            let installed = exists_at(directory, OsStr::new(&final_name))?;
            if stage_exists {
                self.check_staging_name(&staged)?;
                if installed {
                    let file = open_cstr(directory, &destination, read_flags(), 0)?;
                    ensure!(
                        NodeIdentity::of(&file.metadata()?) == staged.identity,
                        "unresolved other staging inode remains inventoried"
                    );
                    protect_staging(&staged.file.metadata()?, self.binding.owner_uid, 2)?;
                } else {
                    protect_file(&staged.file.metadata()?, self.binding.owner_uid, true)?;
                    ensure!(
                        // SAFETY: both names are live CStrings and directory stays borrowed for this call.
                        unsafe {
                            libc::linkat(
                                directory,
                                staging.as_ptr(),
                                directory,
                                destination.as_ptr(),
                                0,
                            )
                        } == 0,
                        "immutable content installation failed: {}",
                        std::io::Error::last_os_error()
                    );
                }
                #[cfg(test)]
                injected_fault(fault, WriteFault::Installed)?;
                unlink(directory, &staging)?;
                #[cfg(test)]
                injected_fault(fault, WriteFault::StagingUnlinked)?;
            } else {
                ensure!(installed, "staging and installed content are missing");
                let file = open_cstr(directory, &destination, read_flags(), 0)?;
                ensure!(
                    NodeIdentity::of(&file.metadata()?) == staged.identity,
                    "installed content identity changed"
                );
            }
            protect_file(&staged.file.metadata()?, self.binding.owner_uid, true)?;
            self.root.leaf().sync_all()?;
            #[cfg(test)]
            injected_fault(fault, WriteFault::DirectorySynced)?;
            self.validate()
        }

        #[cfg(test)]
        fn ensure_blob(&self, digest: &str, bytes: &[u8]) -> Result<()> {
            self.ensure_staged_blob(Uuid::new_v4(), digest, bytes)
        }

        /// Compatibility wrapper; binary callers should keep only one bounded chunk in memory.
        pub fn ensure_staged_blob(
            &self,
            staging_id: Uuid,
            digest: &str,
            bytes: &[u8],
        ) -> Result<()> {
            self.ensure_staged_blob_inner(
                staging_id,
                digest,
                bytes,
                #[cfg(test)]
                None,
            )
        }

        fn ensure_staged_blob_inner(
            &self,
            staging_id: Uuid,
            digest: &str,
            bytes: &[u8],
            #[cfg(test)] fault: Option<WriteFault>,
        ) -> Result<()> {
            ensure!(hash(bytes) == digest, "content digest mismatch");
            let mut staged = self.begin_staged_blob(
                staging_id,
                digest,
                bytes.len() as u64,
                bytes.len().max(1) as u64,
            )?;
            if staged.requires_transfer() {
                #[cfg(test)]
                injected_fault(fault, WriteFault::Created)?;
                #[cfg(test)]
                if fault == Some(WriteFault::PartialWrite) {
                    self.write_blob_chunk(&mut staged, &bytes[..bytes.len() / 2])?;
                    return Err(std::io::Error::from_raw_os_error(libc::ENOSPC).into());
                }
                for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                    self.write_blob_chunk(&mut staged, chunk)?;
                }
                #[cfg(test)]
                injected_fault(fault, WriteFault::Written)?;
            }
            self.finish_staged_blob_inner(
                staged,
                #[cfg(test)]
                fault,
            )
        }
    }

    fn same_node(a: &Metadata, b: &Metadata) -> bool {
        a.is_file() && b.is_file() && NodeIdentity::of(a) == NodeIdentity::of(b)
    }
    fn same_version(a: &Metadata, b: &Metadata) -> bool {
        same_node(a, b)
            && a.len() == b.len()
            && a.mtime() == b.mtime()
            && a.mtime_nsec() == b.mtime_nsec()
            && a.ctime() == b.ctime()
            && a.ctime_nsec() == b.ctime_nsec()
    }
    fn protect_staging(meta: &Metadata, uid: u32, links: u64) -> Result<()> {
        ensure!(
            meta.is_file()
                && meta.nlink() == links
                && meta.uid() == uid
                && meta.mode() & 0o077 == 0,
            "staging ownership, permissions or link count changed"
        );
        Ok(())
    }
    fn verify_file(file: &mut File, digest: &str, size: u64) -> Result<()> {
        let before = file.metadata()?;
        ensure!(
            before.is_file() && before.len() == size,
            "incomplete staging or content size mismatch"
        );
        file.seek(SeekFrom::Start(0))?;
        let mut hasher = Sha256::new();
        let mut bytes = [0; BLOB_CHUNK_BYTES];
        let mut read = 0u64;
        loop {
            let count = file.read(&mut bytes)?;
            if count == 0 {
                break;
            }
            read = read
                .checked_add(count as u64)
                .ok_or_else(|| anyhow::anyhow!("content size overflow"))?;
            ensure!(read <= size, "content exceeds recorded size");
            hasher.update(&bytes[..count]);
        }
        ensure!(
            read == size && hex::encode(hasher.finalize()) == digest,
            "durable content missing or corrupt"
        );
        ensure!(
            same_version(&before, &file.metadata()?),
            "content changed during verification"
        );
        file.seek(SeekFrom::Start(0))?;
        Ok(())
    }

    /// Explicit fixture maintenance only: no directory creation, discovery, formatting, DB
    /// changes, repair, or adoption of a nonempty directory. Physical fields are measured here.
    pub fn prepare(config: &PrepareConfig) -> Result<StorageBinding> {
        // SAFETY: geteuid takes no pointer arguments and only observes process identity.
        let uid = unsafe { libc::geteuid() };
        ensure!(
            config.owner_uid == uid,
            "prepare must run as the explicit store owner"
        );
        ensure!(
            !config.firm_id.is_nil() && !config.store_id.is_nil() && !config.generation.is_nil(),
            "explicit nonnil storage identifiers required"
        );
        let root = Chain::open(&config.root, uid, true)?;
        let (parent, name) = split_file(&config.binding_file)?;
        let descriptor_parent = Chain::open(parent, uid, true)?;
        ensure_outside(&root, &descriptor_parent, &config.binding_file)?;
        ensure!(
            !exists_at(descriptor_parent.leaf().as_raw_fd(), name)?,
            "binding file already exists"
        );
        let restriction_name = restriction_name(config.store_id, config.generation)?;
        ensure!(
            !exists_at(
                descriptor_parent.leaf().as_raw_fd(),
                OsStr::from_bytes(restriction_name.as_bytes())
            )?,
            "store is durably restricted"
        );
        lock(root.leaf())?;
        require_empty(root.leaf())?;
        let meta = root.leaf().metadata()?;
        let binding = StorageBinding {
            schema_version: 1,
            root: config.root.clone(),
            owner_uid: uid,
            device: meta.dev(),
            root_inode: meta.ino(),
            filesystem_id: filesystem_id(root.leaf())?,
            registration_root: descriptor_parent.path.clone(),
            registration_device: descriptor_parent.leaf().metadata()?.dev(),
            registration_inode: descriptor_parent.leaf().metadata()?.ino(),
            registration_filesystem_id: filesystem_id(descriptor_parent.leaf())?,
            firm_id: config.firm_id,
            store_id: config.store_id,
            generation: config.generation,
        };
        root.recheck(uid, true)?;
        descriptor_parent.recheck(uid, true)?;
        let bytes = serde_json::to_vec_pretty(&binding)?;
        ensure!(bytes.len() <= MAX_BINDING_BYTES, "binding exceeds bound");
        // A failed partial prepare stays fail-closed for explicit maintenance; never silently
        // remove, overwrite or adopt an existing marker/descriptor on a retry.
        let mut marker = open_at(
            root.leaf().as_raw_fd(),
            OsStr::new(MARKER),
            create_flags(),
            0o600,
        )?;
        marker.write_all(&bytes)?;
        marker.sync_all()?;
        root.leaf().sync_all()?;
        let mut descriptor = open_at(
            descriptor_parent.leaf().as_raw_fd(),
            name,
            create_flags(),
            0o600,
        )?;
        descriptor.write_all(&bytes)?;
        descriptor.sync_all()?;
        descriptor_parent.leaf().sync_all()?;
        root.recheck(uid, true)?;
        descriptor_parent.recheck(uid, true)?;
        check_physical(root.leaf(), &binding)?;
        Ok(binding)
    }

    fn validate_binding(binding: &StorageBinding, uid: u32) -> Result<()> {
        ensure!(
            binding.schema_version == 1 && binding.owner_uid == uid,
            "unsupported storage binding or owner"
        );
        ensure!(
            !binding.firm_id.is_nil() && !binding.store_id.is_nil() && !binding.generation.is_nil(),
            "invalid storage identity"
        );
        ensure!(
            binding.filesystem_id.len() == 16
                && binding
                    .filesystem_id
                    .bytes()
                    .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v)),
            "invalid filesystem identity"
        );
        require_absolute(&binding.registration_root)?;
        require_absolute(&binding.root)
    }
    fn parse_binding(bytes: &[u8]) -> Result<StorageBinding> {
        // Typed serde rejects duplicate known fields as well as unknown fields.
        serde_json::from_slice(bytes)
            .map_err(|_| anyhow::anyhow!("invalid storage binding structure"))
    }
    fn require_absolute(path: &Path) -> Result<()> {
        ensure!(
            path.is_absolute()
                && path
                    .components()
                    .all(|c| matches!(c, Component::RootDir | Component::Normal(_))),
            "explicit canonical absolute storage path required"
        );
        let normalized: PathBuf = path.components().collect();
        ensure!(
            normalized.as_os_str() == path.as_os_str(),
            "canonical storage path required"
        );
        Ok(())
    }
    fn split_file(path: &Path) -> Result<(&Path, &OsStr)> {
        require_absolute(path)?;
        Ok((
            path.parent().context("binding parent required")?,
            path.file_name().context("binding filename required")?,
        ))
    }
    fn protect_directory(meta: &Metadata, uid: u32, private: bool) -> Result<()> {
        ensure!(meta.is_dir(), "storage directory required");
        if private {
            ensure!(
                meta.uid() == uid && meta.mode() & 0o777 == 0o700,
                "private store ownership or permissions unsafe"
            );
        } else {
            ensure!(
                meta.uid() == uid || meta.uid() == 0,
                "storage ancestor owner unsafe"
            );
            ensure!(
                meta.mode() & 0o022 == 0 || (meta.uid() == 0 && meta.mode() & 0o1000 != 0),
                "storage ancestor permissions unsafe"
            );
        }
        Ok(())
    }
    fn protect_file(meta: &Metadata, uid: u32, private: bool) -> Result<()> {
        ensure!(
            meta.is_file() && meta.nlink() == 1,
            "single-link regular storage file required"
        );
        if private {
            ensure!(
                meta.uid() == uid && meta.mode() & 0o077 == 0,
                "private storage file ownership or permissions unsafe"
            );
        } else {
            ensure!(
                (meta.uid() == uid || meta.uid() == 0) && meta.mode() & 0o022 == 0,
                "binding protection unsafe"
            );
        }
        Ok(())
    }
    fn check_physical(root: &File, binding: &StorageBinding) -> Result<()> {
        let meta = root.metadata()?;
        protect_directory(&meta, binding.owner_uid, true)?;
        ensure!(
            meta.dev() == binding.device
                && meta.ino() == binding.root_inode
                && filesystem_id(root)? == binding.filesystem_id,
            "physical store identity mismatch"
        );
        Ok(())
    }
    fn ensure_outside(root: &Chain, descriptor_parent: &Chain, descriptor: &Path) -> Result<()> {
        ensure!(
            !descriptor.starts_with(&root.path),
            "binding must remain outside store root"
        );
        ensure!(
            !descriptor_parent
                .identities
                .contains(root.identities.last().unwrap()),
            "binding cannot reside within store root"
        );
        Ok(())
    }
    fn check_registration(parent: &Chain, binding: &StorageBinding) -> Result<()> {
        let meta = parent.leaf().metadata()?;
        ensure!(
            parent.path == binding.registration_root
                && meta.dev() == binding.registration_device
                && meta.ino() == binding.registration_inode
                && filesystem_id(parent.leaf())? == binding.registration_filesystem_id,
            "external storage registration identity mismatch"
        );
        Ok(())
    }
    fn directory_flags() -> i32 {
        libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK
    }
    fn read_flags() -> i32 {
        libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_CLOEXEC | libc::O_NONBLOCK
    }
    fn create_flags() -> i32 {
        libc::O_WRONLY
            | libc::O_CREAT
            | libc::O_EXCL
            | libc::O_NOFOLLOW
            | libc::O_CLOEXEC
            | libc::O_NONBLOCK
    }
    fn cstring(name: &OsStr) -> Result<CString> {
        CString::new(name.as_bytes()).map_err(|_| anyhow::anyhow!("invalid storage name"))
    }
    fn open_at(directory: RawFd, name: &OsStr, flags: i32, mode: libc::mode_t) -> Result<File> {
        open_cstr(directory, &cstring(name)?, flags, mode)
    }
    fn open_cstr(directory: RawFd, name: &CStr, flags: i32, mode: libc::mode_t) -> Result<File> {
        // SAFETY: name is a borrowed NUL-terminated CStr; the kernel validates the descriptor and flags.
        let fd = unsafe { libc::openat(directory, name.as_ptr(), flags, mode as libc::c_uint) };
        if fd < 0 {
            return Err(std::io::Error::last_os_error()).context("storage entry unavailable");
        }
        // SAFETY: openat returned a new nonnegative descriptor; File becomes its sole owner.
        Ok(unsafe { File::from_raw_fd(fd) })
    }
    fn exists_at(directory: RawFd, name: &OsStr) -> Result<bool> {
        let name = cstring(name)?;
        let mut meta = std::mem::MaybeUninit::<libc::stat>::uninit();
        // SAFETY: name is NUL-terminated and meta provides writable aligned stat storage.
        if unsafe {
            libc::fstatat(
                directory,
                name.as_ptr(),
                meta.as_mut_ptr(),
                libc::AT_SYMLINK_NOFOLLOW,
            )
        } == 0
        {
            return Ok(true);
        }
        let error = std::io::Error::last_os_error();
        if error.kind() == std::io::ErrorKind::NotFound {
            Ok(false)
        } else {
            Err(error.into())
        }
    }
    fn lock(directory: &File) -> Result<()> {
        // SAFETY: directory retains its live descriptor for this synchronous flock call.
        if unsafe { libc::flock(directory.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            let error = std::io::Error::last_os_error();
            if error
                .raw_os_error()
                .is_some_and(|code| code == libc::EAGAIN || code == libc::EWOULDBLOCK)
            {
                return Err(WriterBusy.into());
            }
            return Err(error.into());
        }
        Ok(())
    }
    fn shared_lock(file: &File) -> Result<()> {
        // SAFETY: file retains ownership of a live descriptor throughout the synchronous flock call.
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_SH | libc::LOCK_NB) } != 0 {
            return Err(std::io::Error::last_os_error().into());
        }
        Ok(())
    }
    #[derive(Debug)]
    struct WriterBusy;
    impl std::fmt::Display for WriterBusy {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("store writer lock unavailable")
        }
    }
    impl std::error::Error for WriterBusy {}
    fn restriction_name(store_id: Uuid, generation: Uuid) -> Result<CString> {
        Ok(CString::new(format!(
            ".ouroboros-restricted-{store_id}-{generation}"
        ))?)
    }
    fn filesystem_id(file: &File) -> Result<String> {
        let mut value = std::mem::MaybeUninit::<libc::statfs>::uninit();
        ensure!(
            // SAFETY: file stays open and value provides aligned writable statfs storage.
            unsafe { libc::fstatfs(file.as_raw_fd(), value.as_mut_ptr()) } == 0,
            "filesystem identity unavailable"
        );
        // SAFETY: the successful fstatfs call above initialized value.
        let value = unsafe { value.assume_init() };
        // libc's macOS/BSD and Linux fsid_t are repr(C) two i32s (8 bytes, no padding).
        // Capture only that initialized field, never struct padding or a display mount path.
        ensure!(
            std::mem::size_of_val(&value.f_fsid) == 8,
            "unsupported filesystem identity layout"
        );
        let bytes =
            // SAFETY: f_fsid is an initialized pair of i32s on supported targets, with no padding; value outlives the borrowed eight bytes.
            unsafe { std::slice::from_raw_parts(std::ptr::addr_of!(value.f_fsid).cast::<u8>(), 8) };
        Ok(bytes.iter().map(|v| format!("{v:02x}")).collect())
    }
    fn bounded_read(mut file: File, max: usize) -> Result<Vec<u8>> {
        let meta = file.metadata()?;
        ensure!(
            meta.is_file() && meta.len() <= u64::try_from(max)?,
            "regular storage file exceeds bound"
        );
        file.seek(SeekFrom::Start(0))?;
        let mut bytes = Vec::new();
        file.take(u64::try_from(max)?.saturating_add(1))
            .read_to_end(&mut bytes)?;
        ensure!(bytes.len() <= max, "storage file exceeds bound");
        Ok(bytes)
    }
    fn check_digest(digest: &str) -> Result<()> {
        ensure!(
            digest.len() == 64
                && digest
                    .bytes()
                    .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)),
            "invalid content digest"
        );
        Ok(())
    }
    fn hash(bytes: &[u8]) -> String {
        hex::encode(Sha256::digest(bytes))
    }
    fn unlink(directory: RawFd, name: &CStr) -> Result<()> {
        ensure!(
            // SAFETY: name is a live NUL-terminated CStr; the kernel validates the directory descriptor.
            unsafe { libc::unlinkat(directory, name.as_ptr(), 0) } == 0,
            "storage staging cleanup failed"
        );
        Ok(())
    }
    fn persist_restriction(directory: &File, name: &CStr) -> Result<()> {
        if exists_at(directory.as_raw_fd(), OsStr::from_bytes(name.to_bytes()))? {
            return directory.sync_all().map_err(Into::into);
        }
        let mut file = match open_cstr(directory.as_raw_fd(), name, create_flags(), 0o600) {
            Ok(file) => file,
            Err(error) => {
                if exists_at(directory.as_raw_fd(), OsStr::from_bytes(name.to_bytes()))? {
                    directory.sync_all()?;
                    return Ok(());
                }
                return Err(error);
            }
        };
        file.write_all(b"{\"status\":\"restricted\"}\n")?;
        file.sync_all()?;
        directory.sync_all()?;
        Ok(())
    }
    #[cfg(test)]
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    enum WriteFault {
        Created,
        PartialWrite,
        Written,
        FileSynced,
        Installed,
        StagingUnlinked,
        DirectorySynced,
    }
    #[cfg(test)]
    fn injected_fault(fault: Option<WriteFault>, current: WriteFault) -> Result<()> {
        if fault == Some(current) {
            // Synthetic syscall failures, not proof of physical media exhaustion/durability.
            return Err(std::io::Error::from_raw_os_error(libc::EIO).into());
        }
        Ok(())
    }
    fn require_empty(directory: &File) -> Result<()> {
        let fd =
            open_at(directory.as_raw_fd(), OsStr::new("."), directory_flags(), 0)?.into_raw_fd();
        // SAFETY: fd is a newly owned directory descriptor; ownership passes to DIR only on success.
        let stream = unsafe { libc::fdopendir(fd) };
        if stream.is_null() {
            // SAFETY: failed fdopendir did not take ownership; close the still-owned fd once.
            unsafe {
                libc::close(fd);
            }
            anyhow::bail!("storage directory inspection unavailable");
        }
        struct Stream(*mut libc::DIR);
        impl Drop for Stream {
            fn drop(&mut self) {
                // SAFETY: Stream uniquely owns the nonnull DIR and closes it exactly once.
                unsafe {
                    libc::closedir(self.0);
                }
            }
        }
        let stream = Stream(stream);
        loop {
            // Distinguish EOF from failure; a failed enumeration must not certify emptiness.
            #[cfg(target_os = "macos")]
            // SAFETY: __error returns this thread's writable errno pointer.
            unsafe {
                *libc::__error() = 0;
            }
            #[cfg(target_os = "linux")]
            // SAFETY: __errno_location returns this thread's writable errno pointer.
            unsafe {
                *libc::__errno_location() = 0;
            }
            // SAFETY: stream owns a live DIR used only by this thread and remains open for enumeration.
            let entry = unsafe { libc::readdir(stream.0) };
            if entry.is_null() {
                ensure!(
                    std::io::Error::last_os_error().raw_os_error() == Some(0),
                    "storage directory inspection failed"
                );
                return Ok(());
            }
            // SAFETY: entry was checked nonnull; readdir supplies a NUL-terminated d_name, read before the next readdir or closedir.
            let name = unsafe { CStr::from_ptr((*entry).d_name.as_ptr()) }.to_bytes();
            ensure!(
                name == b"." || name == b"..",
                "prepare requires an existing empty store root"
            );
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{
            fs,
            os::unix::fs::{PermissionsExt, symlink},
        };

        struct Fixture {
            base: PathBuf,
            config: PrepareConfig,
        }
        impl Fixture {
            fn empty() -> Self {
                // Defaults here select disposable test scratch only, never runtime storage.
                let base = std::env::temp_dir()
                    .canonicalize()
                    .unwrap()
                    .join(format!("ouro-store-test-{}", Uuid::new_v4()));
                fs::create_dir(&base).unwrap();
                private_dir(&base);
                let root = base.join("store");
                fs::create_dir(&root).unwrap();
                private_dir(&root);
                let config = PrepareConfig {
                    root,
                    binding_file: base.join("binding.json"),
                    // SAFETY: geteuid has no pointer arguments and only observes process identity.
                    owner_uid: unsafe { libc::geteuid() },
                    firm_id: Uuid::new_v4(),
                    store_id: Uuid::new_v4(),
                    generation: Uuid::new_v4(),
                };
                Self { base, config }
            }
            fn prepared() -> Self {
                let f = Self::empty();
                prepare(&f.config).unwrap();
                f
            }
            fn open(&self) -> BoundStore {
                BoundStore::open(&self.config.binding_file).unwrap()
            }
            fn latch(&self) -> PathBuf {
                self.base.join(format!(
                    ".ouroboros-restricted-{}-{}",
                    self.config.store_id, self.config.generation
                ))
            }
            fn names(&self) -> Vec<std::ffi::OsString> {
                let mut names: Vec<_> = fs::read_dir(&self.config.root)
                    .unwrap()
                    .map(|e| e.unwrap().file_name())
                    .collect();
                names.sort();
                names
            }
        }
        impl Drop for Fixture {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.base);
            }
        }
        fn private_dir(path: &Path) {
            fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
        }
        fn private_file(path: &Path) {
            fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
        }
        fn rewrite_binding(f: &Fixture, modify: impl FnOnce(&mut StorageBinding)) {
            let mut binding: StorageBinding =
                serde_json::from_slice(&fs::read(&f.config.binding_file).unwrap()).unwrap();
            modify(&mut binding);
            fs::write(
                &f.config.binding_file,
                serde_json::to_vec(&binding).unwrap(),
            )
            .unwrap();
        }

        fn write_object(store: &BoundStore, id: Uuid, bytes: &[u8]) {
            let mut staged = store
                .begin_staged_object(
                    id,
                    &hash(bytes),
                    bytes.len() as u64,
                    bytes.len().max(1) as u64,
                )
                .unwrap();
            assert!(staged.requires_transfer());
            for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                store.write_blob_chunk(&mut staged, chunk).unwrap();
            }
            store.finish_staged_blob(staged).unwrap();
        }

        #[test]
        fn identical_content_keeps_distinct_uuid_objects_and_legacy_addresses() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = vec![0x81; BLOB_CHUNK_BYTES + 17];
            let digest = hash(&bytes);
            store.ensure_blob(&digest, &bytes).unwrap();
            let legacy = fs::metadata(f.config.root.join(&digest)).unwrap();
            let a = Uuid::new_v4();
            let b = Uuid::new_v4();
            write_object(&store, a, &bytes);
            write_object(&store, b, &bytes);
            let ma = fs::metadata(f.config.root.join(format!("blob-{a}"))).unwrap();
            let mb = fs::metadata(f.config.root.join(format!("blob-{b}"))).unwrap();
            assert!(!same_node(&ma, &mb));
            assert!(!same_node(&ma, &legacy));
            assert!(!same_node(&mb, &legacy));
            assert_eq!(ma.nlink(), 1);
            assert_eq!(mb.nlink(), 1);
            for id in [a, b] {
                let mut reader = store
                    .open_object(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .unwrap();
                let mut observed = Vec::new();
                loop {
                    let chunk = store
                        .read_blob_chunk(&mut reader, BLOB_CHUNK_BYTES)
                        .unwrap();
                    if chunk.is_empty() {
                        break;
                    }
                    observed.extend_from_slice(&chunk);
                }
                assert_eq!(observed, bytes);
            }
            assert_eq!(store.read_blob(&digest, bytes.len()).unwrap(), bytes);
            assert_eq!(f.names().len(), 4);
        }

        #[test]
        fn missing_object_never_uses_same_digest_or_another_object() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"no address fallback";
            let digest = hash(bytes);
            let a = Uuid::new_v4();
            let missing = Uuid::new_v4();
            write_object(&store, a, bytes);
            assert!(
                store
                    .open_blob(&digest, Some(bytes.len() as u64), 64)
                    .is_err()
            );
            assert!(
                store
                    .open_object(missing, &digest, bytes.len() as u64, 64)
                    .is_err()
            );
            store.ensure_blob(&digest, bytes).unwrap();
            assert!(
                store
                    .pin_object(missing, &digest, bytes.len() as u64, 64)
                    .is_err()
            );
            assert!(
                store
                    .pin_object(Uuid::nil(), &digest, bytes.len() as u64, 64)
                    .is_err()
            );
            assert!(
                store
                    .pin_object(a, &digest, bytes.len() as u64 - 1, 64)
                    .is_err()
            );
            assert!(!f.config.root.join(format!("blob-{missing}")).exists());
        }

        #[test]
        fn object_crash_recovery_reuses_only_its_recorded_uuid_address() {
            for fault in [
                WriteFault::FileSynced,
                WriteFault::Installed,
                WriteFault::StagingUnlinked,
                WriteFault::DirectorySynced,
            ] {
                let f = Fixture::prepared();
                let store = f.open();
                let bytes = vec![0; BLOB_CHUNK_BYTES + 7];
                let digest = hash(&bytes);
                let id = Uuid::new_v4();
                let mut staged = store
                    .begin_staged_object(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .unwrap();
                for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                    store.write_blob_chunk(&mut staged, chunk).unwrap();
                }
                assert!(store.finish_staged_blob_inner(staged, Some(fault)).is_err());
                assert!(!f.config.root.join(&digest).exists());
                drop(store);
                let store = f.open();
                let recovered = store
                    .begin_staged_object(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .unwrap();
                assert!(!recovered.requires_transfer());
                store.finish_staged_blob(recovered).unwrap();
                assert!(!f.config.root.join(format!(".staging-{id}")).exists());
                assert!(!f.config.root.join(&digest).exists());
                assert!(
                    store
                        .open_object(id, &digest, bytes.len() as u64, bytes.len() as u64)
                        .is_ok()
                );
                assert_eq!(f.names().len(), 2);
            }
        }

        #[test]
        fn staged_object_metadata_pins_without_verifying_recovered_bytes() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"recorded immutable bytes";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let path = f.config.root.join(format!("blob-{id}"));
            let corrupted = vec![b'x'; bytes.len()];
            fs::write(&path, &corrupted).unwrap();
            let mut staged = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(!staged.requires_transfer());
            assert_eq!(staged.file.stream_position().unwrap(), 0);
            // The metadata pin already excludes another writer/reader before verification.
            assert!(
                store
                    .open_object(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
            // Recovered bytes are never writable, even before the deferred verification.
            assert!(store.write_blob_chunk(&mut staged, b"replacement").is_err());
            drop(staged);
            let mut staged = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(store.verify_staged_blob(&mut staged).is_err());
            assert!(staged.failed);
            assert!(store.write_blob_chunk(&mut staged, b"replacement").is_err());
            assert!(store.finish_staged_blob(staged).is_err());
            assert_eq!(fs::read(path).unwrap(), corrupted);
            // Existing callers still receive verification failure directly from begin.
            assert!(
                store
                    .begin_staged_object(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
        }

        #[test]
        fn partial_recovered_stage_is_pinned_but_cannot_resume_or_finish() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"a transfer with a retained partial prefix";
            let id = Uuid::new_v4();
            let mut fresh = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            // Fresh verification performs no content hash and preserves write eligibility.
            store.verify_staged_blob(&mut fresh).unwrap();
            store.write_blob_chunk(&mut fresh, &bytes[..8]).unwrap();
            drop(fresh);
            let mut partial = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(!partial.requires_transfer());
            assert_eq!(partial.file.stream_position().unwrap(), 0);
            assert!(store.verify_staged_blob(&mut partial).is_err());
            assert!(store.write_blob_chunk(&mut partial, &bytes[8..]).is_err());
            assert!(store.finish_staged_blob(partial).is_err());
            assert_eq!(
                fs::read(f.config.root.join(format!(".staging-{id}"))).unwrap(),
                &bytes[..8]
            );
            assert!(!f.config.root.join(format!("blob-{id}")).exists());
            assert!(
                store
                    .begin_staged_object(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
        }

        #[test]
        fn recovered_stage_verification_binds_address_and_latches_failure() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"retain the original object address";
            let id = Uuid::new_v4();
            let other = Uuid::new_v4();
            write_object(&store, id, bytes);
            let mut staged = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            staged.staging_id = other;
            assert!(store.verify_staged_blob(&mut staged).is_err());
            staged.staging_id = id;
            assert!(store.verify_staged_blob(&mut staged).is_err());
            assert!(store.finish_staged_blob(staged).is_err());
            assert!(!f.config.root.join(format!("blob-{other}")).exists());
            assert_eq!(
                fs::read(f.config.root.join(format!("blob-{id}"))).unwrap(),
                bytes
            );

            let mut pinned = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            let path = f.config.root.join(format!("blob-{id}"));
            fs::rename(&path, f.config.root.join("displaced-object")).unwrap();
            fs::write(&path, bytes).unwrap();
            private_file(&path);
            assert!(store.verify_staged_blob(&mut pinned).is_err());
            assert!(store.finish_staged_blob(pinned).is_err());
            assert_eq!(fs::read(path).unwrap(), bytes);
        }

        #[test]
        fn metadata_stage_verification_cannot_cross_store_sessions() {
            let f = Fixture::prepared();
            let store = f.open();
            let other = Fixture::prepared();
            let other_store = other.open();
            let bytes = b"a complete recovered object";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let mut staged = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(other_store.verify_staged_blob(&mut staged).is_err());
            assert!(store.verify_staged_blob(&mut staged).is_err());
            drop(staged);
            let mut recovered = store
                .begin_staged_object_metadata(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.verify_staged_blob(&mut recovered).unwrap();
            store.finish_staged_blob(recovered).unwrap();
            assert_eq!(
                fs::read(f.config.root.join(format!("blob-{id}"))).unwrap(),
                bytes
            );
            assert_eq!(other.names().len(), 1);
        }

        #[test]
        fn object_pin_is_metadata_only_and_verification_rejects_corrupt_bytes() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"expected pinned content";
            let digest = hash(bytes);
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let path = f.config.root.join(format!("blob-{id}"));
            fs::write(&path, vec![0; bytes.len()]).unwrap();
            // Pin does not scan bytes while its caller holds a catalog transaction lock.
            let pinned = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            assert!(store.verify_pinned(pinned).is_err());
            fs::write(&path, bytes).unwrap();
            let pinned = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            fs::write(&path, vec![1; bytes.len()]).unwrap();
            assert!(store.verify_pinned(pinned).is_err());
        }

        #[test]
        fn collection_is_metadata_only_until_verification_and_failure_latches_the_pin() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"collection must verify these bytes";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let path = f.config.root.join(format!("blob-{id}"));
            fs::write(&path, vec![0; bytes.len()]).unwrap();
            let mut pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            let metadata = fs::metadata(&path).unwrap();
            assert_eq!(
                pin.identity(),
                &CollectionObjectIdentity {
                    object_id: id,
                    device: metadata.dev(),
                    inode: metadata.ino(),
                    sha256: hash(bytes),
                    size: bytes.len() as u64,
                }
            );
            let mut serialized = serde_json::to_value(pin.identity()).unwrap();
            serialized["path"] = serde_json::json!("another-object");
            assert!(serde_json::from_value::<CollectionObjectIdentity>(serialized).is_err());
            assert!(store.verify_collection(&mut pin).is_err());
            fs::write(&path, bytes).unwrap();
            assert!(store.verify_collection(&mut pin).is_err());
            assert!(store.remove_collection(pin).is_err());
            assert_eq!(fs::read(&path).unwrap(), bytes);
            store.validate().unwrap();

            let pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(store.remove_collection(pin).is_err()); // Metadata alone cannot delete.
            assert!(!store.confirm_collection_absence(id).unwrap());
        }

        #[test]
        fn collection_busy_readers_and_writers_do_not_restrict_the_store() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"reader owned object";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let reader = store
                .open_object(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            let busy = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .err()
                .unwrap();
            assert_eq!(
                busy.downcast_ref::<std::io::Error>().unwrap().kind(),
                std::io::ErrorKind::WouldBlock
            );
            store.validate().unwrap();
            assert!(!f.latch().exists());
            drop(reader);
            let writer = open_at(
                store.root.leaf().as_raw_fd(),
                OsStr::new(&format!("blob-{id}")),
                read_flags(),
                0,
            )
            .unwrap();
            lock(&writer).unwrap();
            let busy = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .err()
                .unwrap();
            assert_eq!(
                busy.downcast_ref::<std::io::Error>().unwrap().kind(),
                std::io::ErrorKind::WouldBlock
            );
            store.validate().unwrap();
            drop(writer);
            let pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            assert!(
                store
                    .open_object(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
            assert!(
                store
                    .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
            drop(pin);
            store.validate().unwrap();
            assert!(!f.latch().exists());
        }

        #[test]
        fn collection_removes_only_its_verified_uuid_and_preserves_equal_content_addresses() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = vec![0x81; BLOB_CHUNK_BYTES + 17];
            let digest = hash(&bytes);
            let selected = Uuid::new_v4();
            let sibling = Uuid::new_v4();
            write_object(&store, selected, &bytes);
            write_object(&store, sibling, &bytes);
            store
                .ensure_staged_blob(Uuid::new_v4(), &digest, &bytes)
                .unwrap();
            let mut pin = store
                .pin_collection(selected, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            store.verify_collection(&mut pin).unwrap();
            store.remove_collection(pin).unwrap();
            assert!(store.confirm_collection_absence(selected).unwrap());
            assert!(!store.confirm_collection_absence(sibling).unwrap());
            assert_eq!(
                fs::read(f.config.root.join(format!("blob-{sibling}"))).unwrap(),
                bytes
            );
            assert_eq!(store.read_blob(&digest, bytes.len()).unwrap(), bytes);
            assert!(
                store
                    .pin_collection(selected, &digest, bytes.len() as u64, bytes.len() as u64)
                    .is_err()
            );
            assert!(store.pin_collection(Uuid::nil(), &digest, 0, 1).is_err());
            assert!(store.confirm_collection_absence(Uuid::nil()).is_err());
        }

        #[test]
        fn collection_rejects_symlinks_hardlinks_and_nonregular_entries() {
            for kind in ["symlink", "hardlink", "directory"] {
                let f = Fixture::prepared();
                let store = f.open();
                let bytes = b"protected ordinary object";
                let original = Uuid::new_v4();
                let selected = Uuid::new_v4();
                write_object(&store, original, bytes);
                let source = f.config.root.join(format!("blob-{original}"));
                let path = f.config.root.join(format!("blob-{selected}"));
                match kind {
                    "symlink" => symlink(&source, &path).unwrap(),
                    "hardlink" => fs::hard_link(&source, &path).unwrap(),
                    "directory" => {
                        fs::create_dir(&path).unwrap();
                        private_dir(&path);
                    }
                    _ => unreachable!(),
                }
                assert!(
                    store
                        .pin_collection(selected, &hash(bytes), bytes.len() as u64, 64)
                        .is_err()
                );
                assert!(store.confirm_collection_absence(selected).is_err());
                assert_eq!(fs::read(&source).unwrap(), bytes);
            }
        }

        #[test]
        fn collection_rechecks_verified_fd_and_current_path_before_unlink() {
            for change in ["replacement", "symlink", "hardlink", "bytes"] {
                let f = Fixture::prepared();
                let store = f.open();
                let bytes = b"fixed verified collection file";
                let id = Uuid::new_v4();
                write_object(&store, id, bytes);
                let path = f.config.root.join(format!("blob-{id}"));
                let retained = f.config.root.join("retained-original");
                let mut pin = store
                    .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                    .unwrap();
                store.verify_collection(&mut pin).unwrap();
                match change {
                    "replacement" => {
                        fs::rename(&path, &retained).unwrap();
                        fs::write(&path, bytes).unwrap();
                        private_file(&path);
                    }
                    "symlink" => {
                        fs::rename(&path, &retained).unwrap();
                        symlink(&retained, &path).unwrap();
                    }
                    "hardlink" => fs::hard_link(&path, &retained).unwrap(),
                    "bytes" => fs::write(&path, b"changed length").unwrap(),
                    _ => unreachable!(),
                }
                assert!(store.remove_collection(pin).is_err());
                assert!(fs::symlink_metadata(&path).is_ok());
                if change != "bytes" {
                    assert_eq!(fs::read(&retained).unwrap(), bytes);
                }
            }
        }

        #[test]
        fn collection_pin_cannot_cross_a_store_or_reopened_session() {
            let f = Fixture::prepared();
            let other_fixture = Fixture::prepared();
            let store = f.open();
            let other = other_fixture.open();
            let bytes = b"session owned collection object";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            write_object(&other, id, bytes);
            let mut pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.verify_collection(&mut pin).unwrap();
            assert!(other.remove_collection(pin).is_err());
            let mut pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.verify_collection(&mut pin).unwrap();
            drop(store);
            let store = f.open();
            assert!(store.remove_collection(pin).is_err());
            assert!(!store.confirm_collection_absence(id).unwrap());
            assert!(!other.confirm_collection_absence(id).unwrap());
        }

        #[test]
        fn collection_fault_after_unlink_recovers_by_absence_without_another_delete() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"unlinked before acknowledgement";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let mut pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.verify_collection(&mut pin).unwrap();
            assert!(store.remove_collection_inner(pin, true).is_err());
            assert!(store.confirm_collection_absence(id).unwrap());
            assert!(store.confirm_collection_absence(id).unwrap());
            assert!(
                store
                    .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                    .is_err()
            );
            store.validate().unwrap();
        }

        #[test]
        fn collection_and_absence_observation_reject_a_changed_store_binding() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"old storage root";
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let mut pin = store
                .pin_collection(id, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.verify_collection(&mut pin).unwrap();
            let retained = f.base.join("original-store");
            fs::rename(&f.config.root, &retained).unwrap();
            fs::create_dir(&f.config.root).unwrap();
            private_dir(&f.config.root);
            assert!(store.remove_collection(pin).is_err());
            assert!(store.confirm_collection_absence(id).is_err());
            assert_eq!(
                fs::read(retained.join(format!("blob-{id}"))).unwrap(),
                bytes
            );
            assert!(f.latch().exists());
        }

        #[test]
        fn object_shared_pins_and_readers_exclude_an_exclusive_file_lock() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"shared reader lifetime";
            let digest = hash(bytes);
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let first = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            let second = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            let candidate = open_at(
                store.root.leaf().as_raw_fd(),
                OsStr::new(&format!("blob-{id}")),
                read_flags(),
                0,
            )
            .unwrap();
            assert!(lock(&candidate).is_err());
            let mut reader = store.verify_pinned(first).unwrap();
            drop(second);
            assert!(lock(&candidate).is_err());
            assert_eq!(store.read_blob_chunk(&mut reader, 64).unwrap(), bytes);
            drop(reader);
            lock(&candidate).unwrap();
            assert!(
                store
                    .pin_object(id, &digest, bytes.len() as u64, 64)
                    .is_err()
            );
            drop(candidate);
            assert!(
                store
                    .open_object(id, &digest, bytes.len() as u64, 64)
                    .is_ok()
            );
            store.validate().unwrap();
        }

        #[test]
        fn pinned_object_cannot_cross_store_session_or_change_address() {
            let f = Fixture::prepared();
            let other_fixture = Fixture::prepared();
            let store = f.open();
            let other = other_fixture.open();
            let bytes = b"original object";
            let digest = hash(bytes);
            let id = Uuid::new_v4();
            write_object(&store, id, bytes);
            let pinned = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            assert!(other.verify_pinned(pinned).is_err());
            let pinned = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            drop(store);
            let store = f.open();
            assert!(store.verify_pinned(pinned).is_err());
            let pinned = store
                .pin_object(id, &digest, bytes.len() as u64, 64)
                .unwrap();
            let path = f.config.root.join(format!("blob-{id}"));
            fs::rename(&path, f.config.root.join("retained-object-inode")).unwrap();
            fs::write(&path, bytes).unwrap();
            private_file(&path);
            assert!(store.verify_pinned(pinned).is_err());
        }

        #[test]
        fn staged_object_projection_cannot_retarget_its_fixed_destination() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"fixed object destination";
            let original = Uuid::new_v4();
            let other = Uuid::new_v4();
            let mut staged = store
                .begin_staged_object(original, &hash(bytes), bytes.len() as u64, 64)
                .unwrap();
            store.write_blob_chunk(&mut staged, bytes).unwrap();
            // The catalog can inspect these crate-local fields, but changing a projection
            // cannot change the immutable handle context or final physical destination.
            staged.staging_id = other;
            assert!(store.finish_staged_blob(staged).is_err());
            assert!(f.config.root.join(format!(".staging-{original}")).exists());
            assert!(!f.config.root.join(format!("blob-{original}")).exists());
            assert!(!f.config.root.join(format!("blob-{other}")).exists());
        }

        #[test]
        fn binary_stream_is_bounded_and_exact_beyond_one_chunk() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes: Vec<u8> = (0..BLOB_CHUNK_BYTES * 2 + 17)
                .map(|i| (i % 256) as u8)
                .collect();
            assert!(std::str::from_utf8(&bytes).is_err());
            let digest = hash(&bytes);
            let id = Uuid::new_v4();
            let mut upload = store
                .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            assert!(upload.requires_transfer());
            for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                store.write_blob_chunk(&mut upload, chunk).unwrap();
            }
            store.finish_staged_blob(upload).unwrap();
            let mut reader = store
                .open_blob(&digest, Some(bytes.len() as u64), bytes.len() as u64)
                .unwrap();
            assert_eq!(reader.size, bytes.len() as u64);
            // Simulate an I/O failure after consuming bytes but before delivering a chunk.
            assert!(
                reader
                    .file
                    .read_exact(&mut vec![0; bytes.len() + 1])
                    .is_err()
            );
            assert!(
                store
                    .read_blob_chunk(&mut reader, BLOB_CHUNK_BYTES + 1)
                    .is_err()
            );
            let mut received = Vec::new();
            loop {
                let chunk = store.read_blob_chunk(&mut reader, 17001).unwrap();
                assert!(chunk.len() <= 17001);
                if chunk.is_empty() {
                    break;
                }
                received.extend_from_slice(&chunk);
            }
            assert_eq!(received, bytes);
            assert!(
                store
                    .open_blob(&digest, Some(bytes.len() as u64 - 1), bytes.len() as u64)
                    .is_err()
            );
            let replay = store
                .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            assert!(!replay.requires_transfer());
            store.finish_staged_blob(replay).unwrap();
            assert_eq!(f.names().len(), 2);
        }

        #[test]
        fn staged_size_digest_and_chunk_failures_preserve_inventory() {
            for fault in 0..4 {
                let f = Fixture::prepared();
                let store = f.open();
                let bytes = vec![0x80; BLOB_CHUNK_BYTES];
                let digest = hash(&bytes);
                let id = Uuid::new_v4();
                let mut upload = store
                    .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .unwrap();
                match fault {
                    0 => {
                        store
                            .write_blob_chunk(&mut upload, &bytes[..bytes.len() - 1])
                            .unwrap();
                    }
                    1 => {
                        assert!(
                            store
                                .write_blob_chunk(&mut upload, &vec![0; BLOB_CHUNK_BYTES + 1])
                                .is_err()
                        );
                        assert!(store.write_blob_chunk(&mut upload, &bytes).is_err());
                    }
                    2 => {
                        store
                            .write_blob_chunk(&mut upload, &vec![0x81; bytes.len()])
                            .unwrap();
                    }
                    _ => {
                        store.write_blob_chunk(&mut upload, &bytes).unwrap();
                        assert!(store.write_blob_chunk(&mut upload, b"x").is_err());
                    }
                }
                assert!(store.finish_staged_blob(upload).is_err());
                assert!(!f.config.root.join(&digest).exists());
                assert!(f.config.root.join(format!(".staging-{id}")).exists());
            }
        }

        #[test]
        fn incomplete_stream_is_never_resumed_and_other_streams_are_independent() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = vec![0; BLOB_CHUNK_BYTES + 17];
            let digest = hash(&bytes);
            let id = Uuid::new_v4();
            let mut active = store
                .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            store
                .write_blob_chunk(&mut active, &bytes[..BLOB_CHUNK_BYTES])
                .unwrap();
            assert!(
                store
                    .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .is_err()
            );
            let other = b"independent stream";
            store.ensure_blob(&hash(other), other).unwrap();
            store.validate().unwrap(); // A busy stage does not restrict the store.
            drop(active);
            let path = f.config.root.join(format!(".staging-{id}"));
            let retained = fs::read(&path).unwrap();
            assert!(
                store
                    .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .is_err()
            );
            assert_eq!(fs::read(path).unwrap(), retained);
        }

        #[test]
        fn complete_uninstalled_stream_recovers_without_retransmission() {
            let f = Fixture::prepared();
            let bytes = vec![0xff; BLOB_CHUNK_BYTES + 17];
            let digest = hash(&bytes);
            let id = Uuid::new_v4();
            let store = f.open();
            let mut active = store
                .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            for chunk in bytes.chunks(BLOB_CHUNK_BYTES) {
                store.write_blob_chunk(&mut active, chunk).unwrap();
            }
            // Even complete bytes belong to the live writer until its file lock is released.
            assert!(
                store
                    .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                    .is_err()
            );
            drop(active);
            drop(store);
            let store = f.open();
            let recovered = store
                .begin_staged_blob(id, &digest, bytes.len() as u64, bytes.len() as u64)
                .unwrap();
            assert!(!recovered.requires_transfer());
            store.finish_staged_blob(recovered).unwrap();
            assert_eq!(store.read_blob(&digest, bytes.len()).unwrap(), bytes);
        }

        #[test]
        fn stream_handles_remain_bound_to_one_store_session() {
            let a = Fixture::prepared();
            let b = Fixture::prepared();
            let store = a.open();
            let other = b.open();
            let bytes = b"original store bytes";
            let digest = hash(bytes);
            let mut active = store
                .begin_staged_blob(Uuid::new_v4(), &digest, bytes.len() as u64, 64)
                .unwrap();
            assert!(other.write_blob_chunk(&mut active, bytes).is_err());
            assert!(store.write_blob_chunk(&mut active, bytes).is_err());
            store.ensure_blob(&digest, bytes).unwrap();
            let mut reader = store
                .open_blob(&digest, Some(bytes.len() as u64), 64)
                .unwrap();
            assert!(other.read_blob_chunk(&mut reader, 64).is_err());
            reader.size = 0;
            assert!(store.read_blob_chunk(&mut reader, 64).is_err());
            reader.size = bytes.len() as u64;
            assert_eq!(store.read_blob_chunk(&mut reader, 64).unwrap(), bytes);
            drop(store);
            let replacement = a.open();
            assert!(replacement.read_blob_chunk(&mut reader, 64).is_err());
        }

        #[test]
        fn binding_loss_between_chunks_blocks_writes_and_remains_restricted() {
            let f = Fixture::prepared();
            let store = f.open();
            let bytes = b"two chunks";
            let digest = hash(bytes);
            let mut active = store
                .begin_staged_blob(Uuid::new_v4(), &digest, bytes.len() as u64, 64)
                .unwrap();
            store.write_blob_chunk(&mut active, &bytes[..2]).unwrap();
            let original = f.base.join("original");
            fs::rename(&f.config.root, &original).unwrap();
            fs::create_dir(&f.config.root).unwrap();
            private_dir(&f.config.root);
            assert!(store.write_blob_chunk(&mut active, &bytes[2..]).is_err());
            assert!(f.latch().exists());
            fs::remove_dir(&f.config.root).unwrap();
            fs::rename(original, &f.config.root).unwrap();
            assert!(store.finish_staged_blob(active).is_err());
            drop(store);
            assert!(BoundStore::open(&f.config.binding_file).is_err());
        }

        #[test]
        fn changed_stage_inode_or_disk_content_cannot_be_installed() {
            for replace in [false, true] {
                let f = Fixture::prepared();
                let store = f.open();
                let bytes = b"verified before installation";
                let digest = hash(bytes);
                let id = Uuid::new_v4();
                let mut active = store
                    .begin_staged_blob(id, &digest, bytes.len() as u64, 64)
                    .unwrap();
                store.write_blob_chunk(&mut active, bytes).unwrap();
                let path = f.config.root.join(format!(".staging-{id}"));
                if replace {
                    fs::rename(&path, f.config.root.join("retained-test-inode")).unwrap();
                    fs::write(&path, bytes).unwrap();
                } else {
                    fs::write(&path, vec![0; bytes.len()]).unwrap();
                }
                private_file(&path);
                assert!(store.finish_staged_blob(active).is_err());
                assert!(!f.config.root.join(&digest).exists());
            }
        }

        #[test]
        fn content_survives_clean_restart_and_duplicate_writer_does_not_poison() {
            let f = Fixture::prepared();
            let bytes = b"one retained artifact";
            let digest = hash(bytes);
            let store = f.open();
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            assert!(!f.latch().exists());
            store.ensure_blob(&digest, bytes).unwrap();
            store.ensure_blob(&digest, bytes).unwrap();
            assert_eq!(store.read_blob(&digest, bytes.len()).unwrap(), bytes);
            assert!(store.read_blob(&digest, bytes.len() - 1).is_err());
            store.validate().unwrap();
            drop(store);
            let restarted = f.open();
            assert_eq!(restarted.read_blob(&digest, bytes.len()).unwrap(), bytes);
            assert_eq!(restarted.identity().store_id, f.config.store_id);
            assert_eq!(f.names().len(), 2);
        }

        #[test]
        fn partial_staging_is_retained_and_never_reported_as_durable_content() {
            for fault in [WriteFault::Created, WriteFault::PartialWrite] {
                let f = Fixture::prepared();
                let bytes = b"bounded crash fixture";
                let digest = hash(bytes);
                let staging = Uuid::new_v4();
                let store = f.open();
                assert!(
                    store
                        .ensure_staged_blob_inner(staging, &digest, bytes, Some(fault))
                        .is_err()
                );
                let path = f.config.root.join(format!(".staging-{staging}"));
                let retained = fs::read(&path).unwrap();
                assert!(retained.len() < bytes.len());
                assert!(!f.config.root.join(&digest).exists());
                drop(store);
                let restarted = f.open();
                assert!(
                    restarted
                        .ensure_staged_blob(staging, &digest, bytes)
                        .is_err()
                );
                assert_eq!(fs::read(path).unwrap(), retained);
                assert!(restarted.read_blob(&digest, 64).is_err());
            }
        }

        #[test]
        fn complete_staging_and_installation_recover_under_the_same_identity() {
            for fault in [
                WriteFault::Written,
                WriteFault::FileSynced,
                WriteFault::Installed,
                WriteFault::StagingUnlinked,
                WriteFault::DirectorySynced,
            ] {
                let f = Fixture::prepared();
                let bytes = b"bounded complete fixture";
                let digest = hash(bytes);
                let staging = Uuid::new_v4();
                let store = f.open();
                assert!(
                    store
                        .ensure_staged_blob_inner(staging, &digest, bytes, Some(fault))
                        .is_err()
                );
                let inventory_names = f.names();
                assert!(inventory_names.len() >= 2);
                if fault == WriteFault::Installed {
                    // A different identity cannot claim or unlink the surviving staging link.
                    assert!(
                        store
                            .ensure_staged_blob(Uuid::new_v4(), &digest, bytes)
                            .is_err()
                    );
                    assert_eq!(f.names(), inventory_names);
                }
                drop(store);
                let restarted = f.open();
                restarted
                    .ensure_staged_blob(staging, &digest, bytes)
                    .unwrap();
                assert_eq!(restarted.read_blob(&digest, 64).unwrap(), bytes);
                assert_eq!(f.names().len(), 2);
                assert!(!f.config.root.join(format!(".staging-{staging}")).exists());
            }
        }

        #[test]
        fn same_digest_reuse_does_not_discard_an_unresolved_other_staging_inode() {
            let f = Fixture::prepared();
            let bytes = b"same digest";
            let digest = hash(bytes);
            let incomplete = Uuid::new_v4();
            let store = f.open();
            assert!(
                store
                    .ensure_staged_blob_inner(
                        incomplete,
                        &digest,
                        bytes,
                        Some(WriteFault::PartialWrite)
                    )
                    .is_err()
            );
            store
                .ensure_staged_blob(Uuid::new_v4(), &digest, bytes)
                .unwrap();
            let names = f.names();
            assert!(
                store
                    .ensure_staged_blob(incomplete, &digest, bytes)
                    .is_err()
            );
            assert_eq!(f.names(), names);
            assert_eq!(store.read_blob(&digest, 64).unwrap(), bytes);
        }

        #[test]
        fn missing_root_is_not_created_and_restriction_survives_restore_and_restart() {
            let f = Fixture::prepared();
            let original = f.base.join("original");
            fs::rename(&f.config.root, &original).unwrap();
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            assert!(!f.config.root.exists());
            assert!(f.latch().exists());
            fs::rename(original, &f.config.root).unwrap();
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            let renamed = f.base.join("renamed-binding.json");
            fs::copy(&f.config.binding_file, &renamed).unwrap();
            assert!(
                BoundStore::open(&renamed).is_err(),
                "descriptor rename cannot clear restriction"
            );
            let alternate = f.base.join("alternate-anchor");
            fs::create_dir(&alternate).unwrap();
            private_dir(&alternate);
            let moved = alternate.join("binding.json");
            fs::copy(&f.config.binding_file, &moved).unwrap();
            assert!(
                BoundStore::open(&moved).is_err(),
                "descriptor parent relocation cannot clear restriction"
            );
        }

        #[test]
        fn copied_marker_on_replacement_root_fails_actual_physical_identity() {
            let f = Fixture::prepared();
            let clone = f.base.join("clone");
            fs::create_dir(&clone).unwrap();
            private_dir(&clone);
            fs::copy(f.config.root.join(MARKER), clone.join(MARKER)).unwrap();
            rewrite_binding(&f, |binding| binding.root = clone.clone());
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            assert!(f.latch().exists());
            assert_eq!(fs::read_dir(clone).unwrap().count(), 1);
        }

        #[test]
        fn swapped_root_cannot_redirect_pinned_fd_and_remains_restricted_after_restore() {
            let f = Fixture::prepared();
            let store = f.open();
            let original = f.base.join("original");
            fs::rename(&f.config.root, &original).unwrap();
            fs::create_dir(&f.config.root).unwrap();
            private_dir(&f.config.root);
            let sentinel = f.config.root.join("replacement-only");
            fs::write(&sentinel, b"must remain untouched").unwrap();
            assert!(
                open_at(
                    store.root.leaf().as_raw_fd(),
                    OsStr::new("replacement-only"),
                    read_flags(),
                    0
                )
                .is_err()
            );
            assert!(store.ensure_blob(&hash(b"denied"), b"denied").is_err());
            assert_eq!(fs::read(&sentinel).unwrap(), b"must remain untouched");
            assert_eq!(fs::read_dir(&original).unwrap().count(), 1);
            fs::remove_file(sentinel).unwrap();
            fs::remove_dir(&f.config.root).unwrap();
            fs::rename(original, &f.config.root).unwrap();
            assert!(store.validate().is_err());
            drop(store);
            assert!(BoundStore::open(&f.config.binding_file).is_err());
        }

        #[test]
        fn root_and_ancestor_symlinks_are_denied_without_following_them() {
            let f = Fixture::prepared();
            let original = f.base.join("original");
            fs::rename(&f.config.root, &original).unwrap();
            symlink(&original, &f.config.root).unwrap();
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            let other = Fixture::prepared();
            let alias = other.base.join("alias");
            symlink(&other.base, &alias).unwrap();
            rewrite_binding(&other, |binding| binding.root = alias.join("store"));
            assert!(BoundStore::open(&other.config.binding_file).is_err());
        }

        #[test]
        fn marker_replacement_and_late_external_restriction_are_latched() {
            let f = Fixture::prepared();
            let store = f.open();
            let marker = f.config.root.join(MARKER);
            let replacement = f.base.join("replacement-marker");
            fs::copy(&marker, &replacement).unwrap();
            fs::rename(&replacement, &marker).unwrap();
            assert!(store.validate().is_err());
            assert!(f.latch().exists());
            let other = Fixture::prepared();
            let store = other.open();
            fs::write(other.latch(), b"restricted").unwrap();
            assert!(store.ensure_blob(&hash(b"denied"), b"denied").is_err());
            assert_eq!(other.names().len(), 1);
        }

        #[test]
        fn descriptor_replacement_is_detected_even_with_identical_content() {
            let f = Fixture::prepared();
            let store = f.open();
            let copy = f.base.join("replacement-descriptor");
            fs::copy(&f.config.binding_file, &copy).unwrap();
            fs::rename(copy, &f.config.binding_file).unwrap();
            assert!(store.validate().is_err());
            assert!(f.latch().exists());
        }

        #[test]
        fn explicit_worker_restriction_survives_clean_restart() {
            let f = Fixture::prepared();
            let store = f.open();
            store.mark_restricted().unwrap();
            assert!(store.validate().is_err());
            drop(store);
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            assert_eq!(f.names().len(), 1);
        }

        #[test]
        fn empty_wrong_root_wrong_filesystem_and_missing_marker_fail_closed() {
            for variant in 0..3 {
                let f = Fixture::prepared();
                match variant {
                    0 => {
                        fs::remove_file(f.config.root.join(MARKER)).unwrap();
                    }
                    1 => rewrite_binding(&f, |binding| binding.device ^= 1),
                    _ => rewrite_binding(&f, |binding| {
                        binding.filesystem_id = "ffffffffffffffff".into()
                    }),
                }
                assert!(BoundStore::open(&f.config.binding_file).is_err());
                assert!(f.latch().exists());
                assert_eq!(f.names().len(), usize::from(variant != 0));
            }
        }

        #[test]
        fn unsafe_owner_modes_and_public_registration_parent_are_denied() {
            let mut f = Fixture::empty();
            f.config.owner_uid ^= 1;
            assert!(prepare(&f.config).is_err());
            assert!(f.names().is_empty());
            let f = Fixture::empty();
            fs::set_permissions(&f.config.root, fs::Permissions::from_mode(0o777)).unwrap();
            assert!(prepare(&f.config).is_err());
            assert!(f.names().is_empty());
            let f = Fixture::prepared();
            fs::set_permissions(&f.config.binding_file, fs::Permissions::from_mode(0o666)).unwrap();
            assert!(BoundStore::open(&f.config.binding_file).is_err());
            let f = Fixture::empty();
            fs::set_permissions(&f.base, fs::Permissions::from_mode(0o755)).unwrap();
            assert!(prepare(&f.config).is_err());
            assert!(f.names().is_empty());
        }

        #[test]
        fn prepare_requires_existing_empty_root_and_new_external_descriptor() {
            let f = Fixture::empty();
            fs::write(f.config.root.join("existing"), b"preserve").unwrap();
            assert!(prepare(&f.config).is_err());
            assert!(!f.config.binding_file.exists());
            assert_eq!(f.names().len(), 1);
            let f = Fixture::empty();
            fs::write(&f.config.binding_file, b"preserve").unwrap();
            assert!(prepare(&f.config).is_err());
            assert!(f.names().is_empty());
            assert_eq!(fs::read(&f.config.binding_file).unwrap(), b"preserve");
            let mut f = Fixture::empty();
            f.config.binding_file = f.config.root.join("binding.json");
            assert!(prepare(&f.config).is_err());
            assert!(f.names().is_empty());
            let f = Fixture::empty();
            fs::remove_dir(&f.config.root).unwrap();
            assert!(prepare(&f.config).is_err());
            assert!(!f.config.root.exists());
        }

        #[test]
        fn invalid_digests_and_content_never_create_unexpected_files() {
            let f = Fixture::prepared();
            let store = f.open();
            let before = f.names();
            for invalid in ["../escape", "/absolute", ".staging-forged", "UPPER", ""] {
                assert!(store.ensure_blob(invalid, b"denied").is_err());
                assert!(store.read_blob(invalid, 16).is_err());
            }
            assert!(store.ensure_blob(&hash(b"different"), b"denied").is_err());
            assert_eq!(f.names(), before);
            assert!(!f.base.join("escape").exists());
        }

        #[test]
        fn fifo_symlink_hardlink_and_corrupted_blobs_are_rejected_with_bounded_io() {
            let f = Fixture::prepared();
            let store = f.open();
            let digest = hash(b"payload");
            let path = f.config.root.join(&digest);
            let name = cstring(path.as_os_str()).unwrap();
            // SAFETY: name is a live NUL-terminated CString; mkfifo does not retain it.
            assert_eq!(unsafe { libc::mkfifo(name.as_ptr(), 0o600) }, 0);
            assert!(store.read_blob(&digest, 64).is_err());
            assert!(store.ensure_blob(&digest, b"payload").is_err());
            fs::remove_file(&path).unwrap();
            let external = f.base.join("external");
            fs::write(&external, b"payload").unwrap();
            private_file(&external);
            symlink(&external, &path).unwrap();
            assert!(store.read_blob(&digest, 64).is_err());
            fs::remove_file(&path).unwrap();
            fs::hard_link(&external, &path).unwrap();
            assert!(store.read_blob(&digest, 64).is_err());
            fs::remove_file(&path).unwrap();
            fs::write(&path, b"corrupt").unwrap();
            private_file(&path);
            assert!(store.read_blob(&digest, 64).is_err());
            assert_eq!(fs::read(external).unwrap(), b"payload");
        }

        #[test]
        fn strict_descriptor_rejects_duplicate_unknown_and_oversized_fields() {
            for variant in 0..3 {
                let f = Fixture::prepared();
                let bytes = fs::read_to_string(&f.config.binding_file).unwrap();
                let altered = match variant {
                    0 => bytes.replacen('{', "{\"schema_version\":1,", 1),
                    1 => bytes.replacen('{', "{\"unknown\":true,", 1),
                    _ => " ".repeat(MAX_BINDING_BYTES + 1),
                };
                fs::write(&f.config.binding_file, altered).unwrap();
                assert!(BoundStore::open(&f.config.binding_file).is_err());
                assert_eq!(f.names().len(), 1);
            }
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub struct BoundStore;
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub struct StagedBlob {
    pub(crate) staging_id: Uuid,
    pub(crate) digest: String,
    pub(crate) size: u64,
    _unsupported: (),
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
impl StagedBlob {
    pub fn requires_transfer(&self) -> bool {
        unreachable!("unsupported stores cannot begin a transfer")
    }
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub struct BlobReader {
    pub digest: String,
    pub size: u64,
    _unsupported: (),
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub struct PinnedBlob {
    _unsupported: (),
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub struct CollectionPin {
    _unsupported: (),
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
impl CollectionPin {
    pub fn identity(&self) -> &CollectionObjectIdentity {
        unreachable!("unsupported stores cannot pin collection objects")
    }
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
impl BoundStore {
    pub fn open(_: &Path) -> Result<Self> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn validate(&self) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn mark_restricted(&self) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn identity(&self) -> &StorageBinding {
        unreachable!("unsupported stores cannot open")
    }
    pub fn read_blob(&self, _: &str, _: usize) -> Result<Vec<u8>> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn ensure_staged_blob(&self, _: Uuid, _: &str, _: &[u8]) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn begin_staged_blob(&self, _: Uuid, _: &str, _: u64, _: u64) -> Result<StagedBlob> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn begin_staged_object(&self, _: Uuid, _: &str, _: u64, _: u64) -> Result<StagedBlob> {
        anyhow::bail!("unsupported storage platform")
    }
    pub(crate) fn begin_staged_object_metadata(
        &self,
        _: Uuid,
        _: &str,
        _: u64,
        _: u64,
    ) -> Result<StagedBlob> {
        anyhow::bail!("unsupported storage platform")
    }
    pub(crate) fn verify_staged_blob(&self, _: &mut StagedBlob) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn write_blob_chunk(&self, _: &mut StagedBlob, _: &[u8]) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn finish_staged_blob(&self, _: StagedBlob) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn open_blob(&self, _: &str, _: Option<u64>, _: u64) -> Result<BlobReader> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn open_object(&self, _: Uuid, _: &str, _: u64, _: u64) -> Result<BlobReader> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn pin_object(&self, _: Uuid, _: &str, _: u64, _: u64) -> Result<PinnedBlob> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn verify_pinned(&self, _: PinnedBlob) -> Result<BlobReader> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn pin_collection(&self, _: Uuid, _: &str, _: u64, _: u64) -> Result<CollectionPin> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn verify_collection(&self, _: &mut CollectionPin) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn remove_collection(&self, _: CollectionPin) -> Result<()> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn confirm_collection_absence(&self, _: Uuid) -> Result<bool> {
        anyhow::bail!("unsupported storage platform")
    }
    pub fn read_blob_chunk(&self, _: &mut BlobReader, _: usize) -> Result<Vec<u8>> {
        anyhow::bail!("unsupported storage platform")
    }
}
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn prepare(_: &PrepareConfig) -> Result<StorageBinding> {
    anyhow::bail!("unsupported storage platform")
}
