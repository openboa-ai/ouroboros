//! Contained, secretless input delivery. This helper runs before the private payload;
//! it neither authorizes execution nor accepts a host path or service credential.
use anyhow::{Context, Result, bail, ensure};
use ouroboros_contracts::{
    MaterializationReceipt, MaterializedInput, ProgramInput, ProgramRequest, ProgramTicket,
    ResolvedProgramInput, program_manifest_digest,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    ffi::CString,
    fs::{File, Metadata},
    io::{Read, Write},
    os::{
        fd::{AsRawFd, FromRawFd},
        unix::{ffi::OsStrExt, fs::MetadataExt},
    },
    path::Path,
    time::Duration,
};
use uuid::Uuid;

pub const DESCRIPTOR_LIMIT: usize = 2_097_152;
const WORKSPACE: &str = "/workspace";
const GATEWAY: &str = "http://127.0.0.1:18080";
const WRITE_CHUNK: usize = 65_536;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MaterializationDescriptor {
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub program: ProgramTicket,
}

pub fn parse_descriptor(bytes: &[u8]) -> Result<MaterializationDescriptor> {
    ensure!(
        !bytes.is_empty() && bytes.len() <= DESCRIPTOR_LIMIT,
        "descriptor exceeds bound"
    );
    let descriptor: MaterializationDescriptor = serde_json::from_slice(bytes)?;
    validate_descriptor(&descriptor)?;
    Ok(descriptor)
}

/// Reads at most the bound plus one byte, including whitespace or trailing data.
pub fn read_descriptor(reader: impl Read) -> Result<MaterializationDescriptor> {
    let mut bytes = Vec::new();
    reader
        .take(DESCRIPTOR_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)?;
    parse_descriptor(&bytes)
}

fn canonical_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn validate_descriptor(descriptor: &MaterializationDescriptor) -> Result<()> {
    ensure!(
        !descriptor.instance_id.is_nil() && !descriptor.generation.is_nil(),
        "invalid instance binding"
    );
    let program = &descriptor.program;
    program.profile.validate()?;
    ensure!(
        !program.inputs.is_empty()
            && program.inputs.len() <= program.profile.max_input_files as usize,
        "program inputs exceed bound"
    );
    // Reuse the admitted path/count/reference contract, without introducing an argv input.
    let references: Vec<ProgramInput> = program
        .inputs
        .iter()
        .map(|input| input.reference.clone())
        .collect();
    ProgramRequest {
        native: None,
        argv: vec!["/usr/local/bin/ouroboros-materialize".into()],
        inputs: references,
    }
    .validate_inputs(&program.profile)?;
    ensure!(
        canonical_digest(&program.manifest_digest),
        "invalid manifest digest"
    );
    let mut total = 0_u64;
    for (index, input) in program.inputs.iter().enumerate() {
        ensure!(
            input.index as usize == index,
            "inputs must have unique ordered contiguous indices"
        );
        ensure!(
            !input.namespace_id.is_nil()
                && !input.upload_id.is_nil()
                && !input.object_id.is_nil()
                && !input.store_id.is_nil()
                && !input.generation.is_nil(),
            "incomplete resolved input identity"
        );
        ensure!(canonical_digest(&input.sha256), "invalid input digest");
        ensure!(
            input.size <= program.profile.max_file_bytes,
            "input exceeds file bound"
        );
        total = total
            .checked_add(input.size)
            .context("input size overflow")?;
        ensure!(
            total <= program.profile.max_input_bytes,
            "inputs exceed aggregate bound"
        );
    }
    ensure!(
        program.manifest_digest == program_manifest_digest(&program.profile, &program.inputs)?,
        "input manifest digest mismatch"
    );
    Ok(())
}

/// The only product entry point. Tests may exercise private filesystem helpers at a
/// temporary root, but neither this function nor the executable accepts one.
pub async fn materialize(descriptor: MaterializationDescriptor) -> Result<MaterializationReceipt> {
    validate_descriptor(&descriptor)?;
    ensure!(
        cfg!(target_os = "linux"),
        "contained materialization requires Linux"
    );
    // SAFETY: These calls only read the process's actual effective identity.
    ensure!(
        unsafe { libc::geteuid() } == 65_532 && unsafe { libc::getegid() } == 65_532,
        "contained materializer requires the private identity"
    );
    let lifetime = Duration::from_secs(descriptor.program.profile.lifetime_seconds);
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .retry(reqwest::retry::never())
        .http1_only()
        .pool_max_idle_per_host(0)
        .connect_timeout(lifetime.min(Duration::from_secs(5)))
        .read_timeout(lifetime.min(Duration::from_secs(15)))
        .timeout(lifetime)
        .build()?;
    tokio::time::timeout(lifetime, materialize_inputs(descriptor, &client))
        .await
        .context("materialization deadline elapsed")?
}

async fn materialize_inputs(
    descriptor: MaterializationDescriptor,
    client: &reqwest::Client,
) -> Result<MaterializationReceipt> {
    let mut tree = DestinationTree::open(Path::new(WORKSPACE))?;
    let mut files = Vec::with_capacity(descriptor.program.inputs.len());
    let mut completed = Vec::with_capacity(descriptor.program.inputs.len());
    for input in &descriptor.program.inputs {
        // The URL contains only an already-validated integer. A path, target,
        // account, or user-supplied header can never select another endpoint.
        let mut response = client
            .get(format!("{GATEWAY}/execution-inputs/{}", input.index))
            .header(reqwest::header::ACCEPT_ENCODING, "identity")
            .send()
            .await?;
        validate_response_headers(response.status(), response.headers(), input)?;
        let mut destination = tree.create_file(&input.reference.destination)?;
        let mut verifier = InputVerifier::new(input);
        // Never collect a response body. Each transport chunk is checked before
        // writing, and disk writes are further bounded independently of framing.
        while let Some(chunk) = response.chunk().await? {
            verifier.write(&chunk, &mut destination.file)?;
        }
        verifier.finish()?; // Success requires an observed body EOF, not just its header.
        destination.file.sync_all()?;
        tree.verify_file(&destination, input.size)?;
        files.push(MaterializedInput {
            index: input.index,
            sha256: input.sha256.clone(),
            size: input.size,
        });
        completed.push((destination, input.size));
    }
    // Recheck every pinned destination and parent after the complete delivery.
    tree.sync_and_verify()?;
    for (destination, size) in &completed {
        tree.verify_file(destination, *size)?;
    }
    Ok(MaterializationReceipt {
        instance_id: descriptor.instance_id,
        generation: descriptor.generation,
        manifest_digest: descriptor.program.manifest_digest,
        files,
    })
}

fn validate_response_headers(
    status: reqwest::StatusCode,
    headers: &reqwest::header::HeaderMap,
    input: &ResolvedProgramInput,
) -> Result<()> {
    use reqwest::header::{CONTENT_ENCODING, CONTENT_LENGTH};
    ensure!(
        status == reqwest::StatusCode::OK,
        "input request was not accepted"
    );
    let encodings = headers.get_all(CONTENT_ENCODING);
    ensure!(
        encodings.iter().count() <= 1
            && encodings
                .iter()
                .all(|value| value.as_bytes() == b"identity"),
        "encoded input is not supported"
    );
    let lengths = headers.get_all(CONTENT_LENGTH);
    ensure!(
        lengths.iter().count() == 1
            && lengths.iter().all(|value| value
                .to_str()
                .ok()
                .filter(|text| !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit()))
                .and_then(|text| text.parse::<u64>().ok())
                == Some(input.size)),
        "input content length mismatch"
    );
    let digests = headers.get_all("x-ouro-content-sha256");
    ensure!(
        digests.iter().count() == 1
            && digests
                .iter()
                .all(|value| value.as_bytes() == input.sha256.as_bytes()),
        "input digest header mismatch"
    );
    Ok(())
}

struct InputVerifier<'a> {
    input: &'a ResolvedProgramInput,
    received: u64,
    hash: Sha256,
    failed: bool,
}

impl<'a> InputVerifier<'a> {
    fn new(input: &'a ResolvedProgramInput) -> Self {
        Self {
            input,
            received: 0,
            hash: Sha256::new(),
            failed: false,
        }
    }

    fn write(&mut self, bytes: &[u8], destination: &mut impl Write) -> Result<()> {
        ensure!(!self.failed, "input verifier has failed");
        self.failed = true;
        let received = self
            .received
            .checked_add(bytes.len() as u64)
            .context("input length overflow")?;
        ensure!(
            received <= self.input.size,
            "input body exceeds admitted size"
        );
        for chunk in bytes.chunks(WRITE_CHUNK) {
            destination.write_all(chunk)?;
            self.hash.update(chunk);
        }
        self.received = received;
        self.failed = false;
        Ok(())
    }

    fn finish(self) -> Result<()> {
        ensure!(
            !self.failed && self.received == self.input.size,
            "input body incomplete"
        );
        ensure!(
            hex::encode(self.hash.finalize()) == self.input.sha256,
            "input content digest mismatch"
        );
        Ok(())
    }
}

struct Directory {
    file: File,
    parent: Option<String>,
    name: CString,
}

struct Destination {
    file: File,
    parent: String,
    name: CString,
}

struct DestinationTree {
    root_name: CString,
    directories: BTreeMap<String, Directory>,
    device: u64,
    uid: u32,
}

impl DestinationTree {
    fn open(path: &Path) -> Result<Self> {
        let name = CString::new(path.as_os_str().as_bytes())?;
        let file = open_at(libc::AT_FDCWD, &name, libc::O_RDONLY | libc::O_DIRECTORY, 0)?;
        let metadata = file.metadata()?;
        // SAFETY: Read-only inspection of the current effective UID.
        let uid = unsafe { libc::geteuid() };
        ensure!(
            metadata.is_dir() && metadata.uid() == uid && metadata.mode() & 0o7777 == 0o700,
            "workspace directory identity or permissions are invalid"
        );
        let device = metadata.dev();
        let mut directories = BTreeMap::new();
        directories.insert(
            String::new(),
            Directory {
                file,
                parent: None,
                name: name.clone(),
            },
        );
        Ok(Self {
            root_name: name,
            directories,
            device,
            uid,
        })
    }

    fn create_file(&mut self, path: &str) -> Result<Destination> {
        ensure!(
            ouroboros_contracts::program_path(path),
            "invalid destination path"
        );
        self.verify_directories()?;
        let (parent_path, basename) = path.rsplit_once('/').unwrap_or(("", path));
        let mut current = String::new();
        for component in parent_path.split('/').filter(|part| !part.is_empty()) {
            let next = if current.is_empty() {
                component.into()
            } else {
                format!("{current}/{component}")
            };
            if !self.directories.contains_key(&next) {
                let name = CString::new(component)?;
                let parent = &self.directories[&current].file;
                // Existing directories are not adopted: only the root and directories
                // created by this invocation can participate in the destination tree.
                // SAFETY: The parent FD is live and the component is NUL-terminated.
                if unsafe { libc::mkdirat(parent.as_raw_fd(), name.as_ptr(), 0o700) } != 0 {
                    return Err(std::io::Error::last_os_error())
                        .context("cannot create input directory");
                }
                let file = open_at(
                    parent.as_raw_fd(),
                    &name,
                    libc::O_RDONLY | libc::O_DIRECTORY,
                    0,
                )?;
                self.verify_metadata(&file.metadata()?, true)?;
                file.sync_all()?;
                parent.sync_all()?;
                self.directories.insert(
                    next.clone(),
                    Directory {
                        file,
                        parent: Some(current.clone()),
                        name,
                    },
                );
            }
            current = next;
        }
        self.verify_directories()?;
        let name = CString::new(basename)?;
        let parent = &self.directories[&current].file;
        let file = open_at(
            parent.as_raw_fd(),
            &name,
            libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL,
            0o600,
        )?;
        self.verify_metadata(&file.metadata()?, false)?;
        parent.sync_all()?;
        Ok(Destination {
            file,
            parent: current,
            name,
        })
    }

    fn verify_metadata(&self, metadata: &Metadata, directory: bool) -> Result<()> {
        ensure!(
            metadata.dev() == self.device && metadata.uid() == self.uid,
            "destination identity changed"
        );
        if directory {
            ensure!(
                metadata.is_dir() && metadata.mode() & 0o7777 == 0o700,
                "unsafe destination directory"
            );
        } else {
            ensure!(
                metadata.is_file() && metadata.nlink() == 1 && metadata.mode() & 0o7777 == 0o600,
                "unsafe destination file"
            );
        }
        Ok(())
    }

    fn verify_directories(&self) -> Result<()> {
        for directory in self.directories.values() {
            let metadata = directory.file.metadata()?;
            self.verify_metadata(&metadata, true)?;
            let (parent, name) = match &directory.parent {
                Some(parent) => (self.directories[parent].file.as_raw_fd(), &directory.name),
                None => (libc::AT_FDCWD, &self.root_name),
            };
            verify_name(parent, name, &metadata)?;
        }
        Ok(())
    }

    fn verify_file(&self, destination: &Destination, expected_size: u64) -> Result<()> {
        self.verify_directories()?;
        let metadata = destination.file.metadata()?;
        self.verify_metadata(&metadata, false)?;
        ensure!(metadata.len() == expected_size, "destination size changed");
        verify_name(
            self.directories[&destination.parent].file.as_raw_fd(),
            &destination.name,
            &metadata,
        )
    }

    fn sync_and_verify(&mut self) -> Result<()> {
        for directory in self.directories.values() {
            directory.file.sync_all()?;
        }
        self.verify_directories()
    }
}

fn open_at(
    parent: libc::c_int,
    name: &CString,
    flags: libc::c_int,
    mode: libc::mode_t,
) -> Result<File> {
    // SAFETY: A live directory FD (or AT_FDCWD), valid C string, and explicit mode
    // are passed. File immediately assumes ownership of the newly opened FD.
    let fd = unsafe {
        libc::openat(
            parent,
            name.as_ptr(),
            flags | libc::O_CLOEXEC | libc::O_NOFOLLOW,
            mode as libc::c_uint,
        )
    };
    if fd < 0 {
        bail!(std::io::Error::last_os_error());
    }
    Ok(unsafe { File::from_raw_fd(fd) })
}

#[allow(clippy::unnecessary_cast)] // libc stat field types differ between Linux and macOS.
fn verify_name(parent: libc::c_int, name: &CString, metadata: &Metadata) -> Result<()> {
    let mut stat = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: fstatat initializes the stat buffer on success. Symlinks are not followed.
    if unsafe {
        libc::fstatat(
            parent,
            name.as_ptr(),
            stat.as_mut_ptr(),
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } != 0
    {
        return Err(std::io::Error::last_os_error()).context("destination binding unavailable");
    }
    let stat = unsafe { stat.assume_init() };
    ensure!(
        stat.st_dev as u64 == metadata.dev()
            && stat.st_ino as u64 == metadata.ino()
            && stat.st_mode as u32 == metadata.mode()
            && stat.st_nlink as u64 == metadata.nlink()
            && stat.st_uid == metadata.uid(),
        "destination path was replaced"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ouroboros_contracts::ProgramProfile;
    use std::os::unix::fs::{PermissionsExt, symlink};

    struct TestRoot(std::path::PathBuf);
    impl TestRoot {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("ouroboros-materialize-{}", Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
            Self(root)
        }
    }
    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn descriptor() -> MaterializationDescriptor {
        let profile = ProgramProfile {
            native_codex: false,
            native_model: None,
            image: format!("sha256:{}", "a".repeat(64)),
            memory_bytes: 1_048_576,
            nano_cpus: 1_000_000_000,
            pids_limit: 16,
            lifetime_seconds: 30,
            compute_units: 1,
            workspace_bytes: 65_536,
            home_bytes: 4096,
            temporary_bytes: 4096,
            max_input_files: 8,
            max_input_bytes: 4096,
            max_file_bytes: 2048,
            max_output_bytes: 4096,
        };
        let inputs = vec![ResolvedProgramInput {
            index: 0,
            reference: ProgramInput {
                target: "company-files".into(),
                workspace_id: Uuid::new_v4(),
                revision: 1,
                file: "source.bin".into(),
                destination: "input/source.bin".into(),
            },
            namespace_id: Uuid::new_v4(),
            upload_id: Uuid::new_v4(),
            object_id: Uuid::new_v4(),
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            sha256: hex::encode(Sha256::digest(b"a\0b\xff")),
            size: 4,
        }];
        MaterializationDescriptor {
            instance_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            program: ProgramTicket {
                manifest_digest: program_manifest_digest(&profile, &inputs).unwrap(),
                profile,
                inputs,
            },
        }
    }
    fn rehash(descriptor: &mut MaterializationDescriptor) {
        descriptor.program.manifest_digest =
            program_manifest_digest(&descriptor.program.profile, &descriptor.program.inputs)
                .unwrap();
    }

    #[test]
    fn descriptor_is_bounded_strict_and_binds_the_profile() {
        let mut input = descriptor();
        assert!(read_descriptor(serde_json::to_vec(&input).unwrap().as_slice()).is_ok());
        input.program.profile.max_input_bytes += 1;
        assert!(validate_descriptor(&input).is_err());
        let mut json = serde_json::to_value(descriptor()).unwrap();
        json["gateway"] = "http://example.invalid".into();
        assert!(parse_descriptor(&serde_json::to_vec(&json).unwrap()).is_err());
        assert!(read_descriptor(vec![b' '; DESCRIPTOR_LIMIT + 1].as_slice()).is_err());
        assert!(parse_descriptor(b"{}").is_err());
    }

    #[test]
    fn input_identity_index_and_size_cannot_be_weakened_by_rehashing() {
        for modify in [
            (|d: &mut MaterializationDescriptor| d.program.inputs[0].index = 1)
                as fn(&mut MaterializationDescriptor),
            |d| d.program.inputs[0].object_id = Uuid::nil(),
            |d| d.program.inputs[0].store_id = Uuid::nil(),
            |d| d.program.inputs[0].sha256 = "A".repeat(64),
            |d| d.program.inputs[0].size = 2049,
            |d| d.program.inputs[0].reference.target = "name\nheader".into(),
        ] {
            let mut input = descriptor();
            modify(&mut input);
            rehash(&mut input);
            assert!(validate_descriptor(&input).is_err());
        }
        let mut input = descriptor();
        for index in 1..3 {
            let mut file = input.program.inputs[0].clone();
            file.index = index;
            file.reference.destination = format!("input/{index}");
            input.program.inputs.push(file);
        }
        for file in &mut input.program.inputs {
            file.size = 2048;
        }
        rehash(&mut input);
        assert!(validate_descriptor(&input).is_err());
    }

    #[test]
    fn destinations_reject_traversal_duplicates_and_overlaps_in_both_orders() {
        for path in [
            "/absolute",
            "../escape",
            "a/../escape",
            "a//b",
            "a\\b",
            "a\0b",
            ".",
            "a/",
        ] {
            let mut input = descriptor();
            input.program.inputs[0].reference.destination = path.into();
            rehash(&mut input);
            assert!(validate_descriptor(&input).is_err());
        }
        for (first, second) in [("a", "a/b"), ("a/b", "a"), ("a", "a")] {
            let mut input = descriptor();
            input.program.inputs[0].reference.destination = first.into();
            let mut next = input.program.inputs[0].clone();
            next.index = 1;
            next.reference.destination = second.into();
            input.program.inputs.push(next);
            rehash(&mut input);
            assert!(validate_descriptor(&input).is_err());
        }
    }

    #[test]
    fn streamed_binary_requires_complete_exact_content_and_latches_failure() {
        let descriptor = descriptor();
        let input = &descriptor.program.inputs[0];
        let mut output = Vec::new();
        let mut verifier = InputVerifier::new(input);
        verifier.write(b"a\0", &mut output).unwrap();
        verifier.write(b"b\xff", &mut output).unwrap();
        verifier.finish().unwrap();
        assert_eq!(output, b"a\0b\xff");
        let mut truncated = InputVerifier::new(input);
        truncated.write(b"a", &mut Vec::new()).unwrap();
        assert!(truncated.finish().is_err());
        let mut corrupt = InputVerifier::new(input);
        corrupt.write(b"xxxx", &mut Vec::new()).unwrap();
        assert!(corrupt.finish().is_err());
        let mut overflow = InputVerifier::new(input);
        let mut output = Vec::new();
        assert!(overflow.write(b"a\0b\xff!", &mut output).is_err());
        assert!(output.is_empty());
        assert!(overflow.write(b"a\0b\xff", &mut output).is_err());
        assert!(overflow.finish().is_err());
    }

    #[test]
    fn response_headers_require_one_exact_full_response() {
        use reqwest::{
            StatusCode,
            header::{CONTENT_ENCODING, CONTENT_LENGTH, HeaderMap, HeaderValue},
        };
        let descriptor = descriptor();
        let input = &descriptor.program.inputs[0];
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_LENGTH, HeaderValue::from_static("4"));
        headers.insert(
            "x-ouro-content-sha256",
            HeaderValue::from_str(&input.sha256).unwrap(),
        );
        validate_response_headers(StatusCode::OK, &headers, input).unwrap();
        for status in [
            StatusCode::NO_CONTENT,
            StatusCode::PARTIAL_CONTENT,
            StatusCode::FOUND,
            StatusCode::FORBIDDEN,
        ] {
            assert!(validate_response_headers(status, &headers, input).is_err());
        }
        for length in ["3", "5", "+4", "18446744073709551616"] {
            let mut wrong = headers.clone();
            wrong.insert(CONTENT_LENGTH, HeaderValue::from_str(length).unwrap());
            assert!(validate_response_headers(StatusCode::OK, &wrong, input).is_err());
        }
        let mut missing = headers.clone();
        missing.remove(CONTENT_LENGTH);
        assert!(validate_response_headers(StatusCode::OK, &missing, input).is_err());
        let mut duplicate = headers.clone();
        duplicate.append(
            "x-ouro-content-sha256",
            HeaderValue::from_str(&input.sha256).unwrap(),
        );
        assert!(validate_response_headers(StatusCode::OK, &duplicate, input).is_err());
        headers.insert(CONTENT_ENCODING, HeaderValue::from_static("gzip"));
        assert!(validate_response_headers(StatusCode::OK, &headers, input).is_err());
    }

    #[test]
    fn zero_byte_inputs_succeed_but_a_failed_writer_cannot_emit_success() {
        let mut descriptor = descriptor();
        descriptor.program.inputs[0].size = 0;
        descriptor.program.inputs[0].sha256 = hex::encode(Sha256::digest([]));
        rehash(&mut descriptor);
        validate_descriptor(&descriptor).unwrap();
        InputVerifier::new(&descriptor.program.inputs[0])
            .finish()
            .unwrap();
        struct FailedWriter;
        impl Write for FailedWriter {
            fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
                Err(std::io::Error::other("injected full device"))
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        let mut input = descriptor.program.inputs[0].clone();
        input.size = 4;
        let mut verifier = InputVerifier::new(&input);
        assert!(verifier.write(b"data", &mut FailedWriter).is_err());
        assert!(verifier.write(b"data", &mut Vec::new()).is_err());
        assert!(verifier.finish().is_err());
    }

    #[test]
    fn destinations_are_exclusive_and_nested_bytes_survive_sync() {
        let root = TestRoot::new();
        let mut tree = DestinationTree::open(&root.0).unwrap();
        let mut first = tree.create_file("input/a").unwrap();
        first.file.write_all(b"a\0b\xff").unwrap();
        first.file.sync_all().unwrap();
        tree.verify_file(&first, 4).unwrap();
        let second = tree.create_file("input/b").unwrap();
        second.file.sync_all().unwrap();
        tree.verify_file(&second, 0).unwrap();
        tree.sync_and_verify().unwrap();
        assert_eq!(std::fs::read(root.0.join("input/a")).unwrap(), b"a\0b\xff");
        assert!(tree.create_file("input/a").is_err());
        assert!(tree.create_file("input/a/child").is_err());
    }

    #[test]
    fn preexisting_symlink_directory_file_and_hardlink_are_rejected() {
        let root = TestRoot::new();
        let outside = TestRoot::new();
        symlink(&outside.0, root.0.join("link")).unwrap();
        std::fs::create_dir(root.0.join("existing")).unwrap();
        std::fs::write(root.0.join("file"), b"old").unwrap();
        let mut tree = DestinationTree::open(&root.0).unwrap();
        for path in ["link/escape", "existing/child", "file"] {
            assert!(tree.create_file(path).is_err());
        }
        let destination = tree.create_file("new").unwrap();
        std::fs::hard_link(root.0.join("new"), outside.0.join("alias")).unwrap();
        assert!(tree.verify_file(&destination, 0).is_err());
        assert!(
            std::fs::read_dir(&outside.0)
                .unwrap()
                .all(|entry| entry.unwrap().file_name() == "alias")
        );
    }

    #[test]
    fn root_and_parent_replacement_and_special_files_fail_closed() {
        let root = TestRoot::new();
        let mut tree = DestinationTree::open(&root.0).unwrap();
        let destination = tree.create_file("input/result").unwrap();
        std::fs::rename(root.0.join("input"), root.0.join("moved")).unwrap();
        std::fs::create_dir(root.0.join("input")).unwrap();
        assert!(tree.verify_file(&destination, 0).is_err());
        assert!(tree.create_file("input/next").is_err());
        let root = TestRoot::new();
        let mut tree = DestinationTree::open(&root.0).unwrap();
        let fifo = CString::new(root.0.join("pipe").as_os_str().as_bytes()).unwrap();
        assert_eq!(unsafe { libc::mkfifo(fifo.as_ptr(), 0o600) }, 0);
        assert!(tree.create_file("pipe").is_err());
        let moved = root.0.with_extension("moved");
        std::fs::rename(&root.0, &moved).unwrap();
        std::fs::create_dir(&root.0).unwrap();
        assert!(tree.create_file("new").is_err());
        std::fs::remove_dir_all(moved).unwrap();
    }
}
