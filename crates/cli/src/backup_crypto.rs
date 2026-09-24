//! Authenticated recovery-file staging; does not establish coherence or restore authority.
use anyhow::{Result, ensure};
use clap::Parser;
use sha2::{Digest, Sha256};
use std::{io::Read, path::PathBuf, process::Stdio, time::Duration};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Parser)]
struct Args {
    #[arg(long)]
    age_binary: PathBuf,
    #[arg(long)]
    age_sha256: String,
    /// One classic age public recipient; no identity, passphrase, SSH key or plugin discovery.
    #[arg(long)]
    recipient_file: Option<PathBuf>,
    #[arg(long)]
    identity_file: Option<PathBuf>,
    #[arg(long)]
    plaintext_sha256: Option<String>,
    #[arg(long)]
    plaintext_bytes: Option<u64>,
    #[arg(long)]
    input: PathBuf,
    #[arg(long)]
    output: PathBuf,
    #[arg(long)]
    max_bytes: u64,
    #[arg(long)]
    timeout_seconds: u64,
}

fn regular(path: &std::path::Path, private: bool) -> Result<std::fs::File> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    ensure!(
        path.is_absolute() && path.canonicalize()? == path,
        "exact absolute input path required"
    );
    let file = std::fs::OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)?;
    let m = file.metadata()?;
    ensure!(
        m.is_file()
            // SAFETY: geteuid takes no pointers and has no memory preconditions.
            && (m.uid() == unsafe { libc::geteuid() } || m.uid() == 0)
            && m.mode() & if private { 0o077 } else { 0o022 } == 0,
        "unprotected input file"
    );
    Ok(file)
}

pub async fn run(open: bool) -> Result<()> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    let args = Args::parse();
    // Inherited by age; neither plaintext nor recovery identities belong in crash dumps.
    let no_core = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    ensure!(
        // SAFETY: no_core is an initialized rlimit, borrowed for this synchronous call.
        unsafe { libc::setrlimit(libc::RLIMIT_CORE, &no_core) } == 0,
        "cannot disable core dumps"
    );
    ensure!(
        (1..=1_099_511_627_776).contains(&args.max_bytes)
            && (1..=600).contains(&args.timeout_seconds),
        "explicit finite size and duration required"
    );
    let mut binary = regular(&args.age_binary, false)?;
    ensure!(
        binary.metadata()?.len() <= 64 * 1024 * 1024,
        "tool exceeds bounded profile"
    );
    let mut hasher = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    loop {
        match binary.read(&mut buffer) {
            Ok(0) => break,
            Ok(count) => hasher.update(&buffer[..count]),
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error.into()),
        }
    }
    ensure!(
        hex::encode(hasher.finalize()) == args.age_sha256,
        "encryption tool digest mismatch"
    );
    let native_args = if open {
        ensure!(
            args.recipient_file.is_none(),
            "public recipient is not a restore identity"
        );
        let identity = args
            .identity_file
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("protected recovery identity required"))?;
        let mut text = zeroize::Zeroizing::new(String::new());
        regular(identity, true)?
            .take(4097)
            .read_to_string(&mut text)?;
        ensure!(text.len() <= 4096, "identity exceeds bounded profile");
        let keys: Vec<_> = text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .collect();
        ensure!(
            keys.len() == 1
                && keys[0].len() == 74
                && keys[0].starts_with("AGE-SECRET-KEY-1")
                && keys[0]
                    .bytes()
                    .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'-'),
            "one classic recovery identity required"
        );
        ensure!(
            args.plaintext_bytes
                .is_some_and(|n| n > 0 && n <= args.max_bytes)
                && args.plaintext_sha256.as_ref().is_some_and(|h| h.len() == 64
                    && h.bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))),
            "expected plaintext length and digest required"
        );
        vec![
            "--decrypt".into(),
            "--identity".into(),
            identity.as_os_str().to_owned(),
        ]
    } else {
        ensure!(
            args.identity_file.is_none()
                && args.plaintext_sha256.is_none()
                && args.plaintext_bytes.is_none(),
            "sealing must not receive recovery identity or plaintext expectations"
        );
        let path = args
            .recipient_file
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("public recipient required"))?;
        let mut recipient = String::new();
        regular(path, false)?
            .take(257)
            .read_to_string(&mut recipient)?;
        let recipient = recipient.trim();
        ensure!(
            recipient.len() == 62
                && recipient.starts_with("age1")
                && recipient
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()),
            "one classic public recipient required"
        );
        vec![
            "--encrypt".into(),
            "--recipient".into(),
            std::ffi::OsString::from(recipient),
        ]
    };
    let input = regular(&args.input, true)?;
    let original = input.metadata()?;
    ensure!(
        original.len() > 0
            && original.len()
                <= args.max_bytes
                    + if open {
                        args.max_bytes / 65536 * 16 + 1024 * 1024
                    } else {
                        0
                    },
        "input exceeds configured bound"
    );
    ensure!(
        args.output.is_absolute() && !args.output.exists(),
        "new absolute candidate destination required"
    );
    let parent = args
        .output
        .parent()
        .ok_or_else(|| anyhow::anyhow!("destination parent required"))?;
    ensure!(
        parent.canonicalize()? == parent,
        "exact destination directory required"
    );
    let parent_file = std::fs::File::open(parent)?;
    let m = parent_file.metadata()?;
    ensure!(
        // SAFETY: geteuid takes no pointers and has no memory preconditions.
        m.is_dir() && m.uid() == unsafe { libc::geteuid() } && m.mode() & 0o077 == 0,
        "private destination directory required"
    );
    let mut pending_name = args.output.as_os_str().to_owned();
    pending_name.push(".partial");
    let pending = PathBuf::from(pending_name);
    let output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&pending)?;
    let mut output = tokio::fs::File::from_std(output);
    let mut source = tokio::fs::File::from_std(input);
    let mut child = tokio::process::Command::new(&args.age_binary)
        .args(native_args)
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()?;
    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = child.stdout.take().unwrap();
    let limit = original.len();
    let result = tokio::time::timeout(Duration::from_secs(args.timeout_seconds), async {
        let send = async {
            let count = tokio::io::copy(&mut (&mut source).take(limit + 1), &mut stdin).await?;
            ensure!(count == limit, "prepared input changed length");
            stdin.shutdown().await?;
            drop(stdin);
            let after = source.metadata().await?;
            ensure!(
                after.dev() == original.dev()
                    && after.ino() == original.ino()
                    && after.len() == original.len()
                    && after.mtime() == original.mtime()
                    && after.mtime_nsec() == original.mtime_nsec()
                    && after.ctime() == original.ctime()
                    && after.ctime_nsec() == original.ctime_nsec(),
                "prepared input changed during cryptographic operation"
            );
            Ok::<_, anyhow::Error>(())
        };
        let receive = async {
            let mut buffer = zeroize::Zeroizing::new([0u8; 65536]);
            let mut count = 0u64;
            let mut hash = Sha256::new();
            let ceiling = if open {
                args.plaintext_bytes.unwrap()
            } else {
                limit.checked_add(limit / 65536 * 16 + 1024 * 1024).unwrap()
            };
            loop {
                let n = stdout.read(&mut buffer[..]).await?;
                if n == 0 {
                    break;
                }
                count += n as u64;
                ensure!(count <= ceiling, "output exceeded bound");
                hash.update(&buffer[..n]);
                output.write_all(&buffer[..n]).await?;
            }
            let digest = hex::encode(hash.finalize());
            if open {
                ensure!(
                    Some(count) == args.plaintext_bytes
                        && Some(&digest) == args.plaintext_sha256.as_ref(),
                    "restored plaintext does not match expected inventory"
                );
            } else {
                ensure!(count > limit, "empty or invalid ciphertext output");
            }
            Ok::<_, anyhow::Error>((count, digest))
        };
        let (_, sealed) = tokio::try_join!(send, receive)?;
        ensure!(
            child.wait().await?.success(),
            "cryptographic operation failed; incomplete candidate retained"
        );
        output.sync_all().await?;
        Ok::<_, anyhow::Error>(sealed)
    })
    .await
    .map_err(|_| {
        anyhow::anyhow!("cryptographic operation timed out; incomplete candidate retained")
    })??;
    drop(output);
    // Publication never replaces an existing candidate. The caller owns the private parent.
    std::fs::hard_link(&pending, &args.output)?;
    parent_file.sync_all()?;
    std::fs::remove_file(&pending)?;
    parent_file.sync_all()?;
    let report = if open {
        serde_json::json!({"status":"restored_candidate", "plaintext_bytes":result.0, "plaintext_sha256":result.1,
            "stream_authentication_verified":true, "plaintext_match_verified":true,
            "coherent_backup_verified":false,"company_restore_verified":false,"authority_granted":false})
    } else {
        serde_json::json!({"status":"sealed_candidate","ciphertext_bytes":result.0,"ciphertext_sha256":result.1,
            "coherent_backup_verified":false,"independent_destination_verified":false,"restore_verified":false,"authority_granted":false})
    };
    println!("{report}");
    Ok(())
}
