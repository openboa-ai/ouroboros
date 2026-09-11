//! Bounded transfer and CLI presentation. Rendering never promotes acceptance to execution.
use futures_util::StreamExt;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    io::Write,
    path::{Path, PathBuf},
    process::ExitCode,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
pub(crate) fn file_stream(
    mut file: tokio::fs::File,
    max_bytes: u64,
) -> impl futures_util::Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send {
    async_stream::try_stream! {
        let mut sent = 0u64;
        loop {
            let mut buffer = vec![0u8; 64 * 1024];
            let read = file.read(&mut buffer).await?;
            if read == 0 { break; }
            sent = sent.checked_add(read as u64).ok_or_else(|| std::io::Error::other("CLI input bound"))?;
            if sent > max_bytes { Err(std::io::Error::other("CLI input bound"))?; }
            buffer.truncate(read);
            yield bytes::Bytes::from(buffer);
        }
    }
}

struct PendingOutput {
    temporary: PathBuf,
    destination: PathBuf,
    file: tokio::fs::File,
}
impl PendingOutput {
    async fn create(destination: &Path) -> anyhow::Result<Self> {
        let parent = destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        anyhow::ensure!(
            destination.file_name().is_some(),
            "output filename required"
        );
        let temporary = parent.join(format!(
            ".ouroboros-download-{}.partial",
            uuid::Uuid::new_v4()
        ));
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = tokio::fs::File::from_std(options.open(&temporary)?);
        Ok(Self {
            temporary,
            destination: destination.to_owned(),
            file,
        })
    }
    async fn publish(self) -> anyhow::Result<()> {
        self.file.sync_all().await?;
        // Same-directory hard-link publication is atomic and refuses an existing target,
        // including a target created after transfer began. It never overwrites user data.
        tokio::fs::hard_link(&self.temporary, &self.destination).await?;
        tokio::fs::remove_file(&self.temporary).await?;
        let parent = self
            .destination
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or(Path::new("."));
        tokio::fs::File::open(parent).await?.sync_all().await?;
        Ok(())
    }
}
impl Drop for PendingOutput {
    fn drop(&mut self) {
        // Only the unique partial path created by this transfer is eligible for cleanup.
        let _ = std::fs::remove_file(&self.temporary);
    }
}

pub(crate) async fn write_binary_stream<S, E>(
    headers: &reqwest::header::HeaderMap,
    stream: S,
    output: Option<&Path>,
    max_bytes: u64,
) -> anyhow::Result<()>
where
    S: futures_util::Stream<Item = Result<bytes::Bytes, E>>,
    E: std::fmt::Display,
{
    let expected_size = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or_else(|| anyhow::anyhow!("binary response length missing"))?;
    anyhow::ensure!(expected_size <= max_bytes, "CLI response bound");
    let expected_digest = headers
        .get("x-ouro-content-sha256")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| anyhow::anyhow!("binary response digest missing"))?;
    anyhow::ensure!(
        expected_digest.len() == 64
            && expected_digest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "invalid binary response digest"
    );
    anyhow::ensure!(
        headers
            .get("x-ouro-intent-id")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| uuid::Uuid::parse_str(v).ok())
            .is_some(),
        "binary response intent missing"
    );
    let mut pending = match output {
        Some(path) => Some(PendingOutput::create(path).await?),
        None => None,
    };
    let mut received = 0u64;
    let mut hash = Sha256::new();
    futures_util::pin_mut!(stream);
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| {
            anyhow::anyhow!("binary transfer interrupted; complete output unavailable")
        })?;
        received = received
            .checked_add(chunk.len() as u64)
            .ok_or_else(|| anyhow::anyhow!("CLI response bound"))?;
        anyhow::ensure!(
            received <= expected_size && received <= max_bytes,
            "binary response exceeds declared bound"
        );
        hash.update(&chunk);
        if let Some(output) = pending.as_mut() {
            output.file.write_all(&chunk).await?;
        } else {
            std::io::stdout().write_all(&chunk)?;
        }
    }
    anyhow::ensure!(received == expected_size, "binary response truncated");
    anyhow::ensure!(
        hex::encode(hash.finalize()) == expected_digest,
        "binary response content mismatch"
    );
    if let Some(output) = pending {
        output.publish().await?;
    } else {
        std::io::stdout().flush()?;
    }
    Ok(())
}

pub(crate) async fn resource_response(
    mut r: reqwest::Response,
    method: &str,
    select: Option<String>,
    output: Option<PathBuf>,
    max_bytes: u64,
) -> anyhow::Result<ExitCode> {
    let status = r.status();
    if status.is_success()
        && r.headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            == Some("application/octet-stream")
    {
        anyhow::ensure!(
            method == "GET" && select.is_none(),
            "binary response requires GET without --select"
        );
        let headers = r.headers().clone();
        write_binary_stream(&headers, r.bytes_stream(), output.as_deref(), max_bytes).await?;
        return Ok(ExitCode::SUCCESS);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = r.chunk().await? {
        anyhow::ensure!(
            bytes.len() + chunk.len() <= 2_097_152,
            "CLI response bound; outcome may be unresolved"
        );
        bytes.extend_from_slice(&chunk);
    }
    if !status.is_success() {
        eprintln!(
            "HTTP {}: resource outcome may be unresolved",
            status.as_u16()
        );
        return Ok(ExitCode::from(2));
    }
    if let Some(pointer) = select {
        let value: Value = serde_json::from_slice(&bytes)?;
        let selected = value
            .pointer(&pointer)
            .ok_or_else(|| anyhow::anyhow!("response field missing"))?;
        bytes = selected
            .as_str()
            .map(|s| s.as_bytes().to_vec())
            .unwrap_or_else(|| selected.to_string().into_bytes());
    }
    if let Some(path) = output {
        std::fs::write(path, bytes)?;
    } else {
        std::io::stdout().write_all(&bytes)?;
        println!();
    }
    Ok(ExitCode::SUCCESS)
}

pub(crate) async fn management_response(
    mut response: reqwest::Response,
) -> anyhow::Result<ExitCode> {
    let status = response.status();
    eprintln!(
        "HTTP {} {}",
        status.as_u16(),
        if status.as_u16() == 202 {
            "accepted, execution not confirmed"
        } else {
            status.canonical_reason().unwrap_or("unknown")
        }
    );
    while let Some(chunk) = response.chunk().await? {
        std::io::stdout().write_all(&chunk)?;
        std::io::stdout().flush()?;
    }
    println!();
    if !status.is_success() {
        return Ok(ExitCode::from(2));
    }
    Ok(ExitCode::SUCCESS)
}
