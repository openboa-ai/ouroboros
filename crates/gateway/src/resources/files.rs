//! Bounded binary transfer, digest validation, and upload receipt delivery.
use super::{
    access::{AccessMonitor, MonitoredStream, lookup_current},
    response,
};
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    body::Body,
    http::{HeaderMap, StatusCode},
    response::Response,
};
use futures_util::StreamExt;
use ouroboros_contracts::{ResourceAdmission, ResourceReply, UploadDescriptor};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    io,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use uuid::Uuid;

pub(super) fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

struct TransferCheck {
    size: u64,
    digest: String,
    received: u64,
    hash: Sha256,
}
impl TransferCheck {
    fn new(size: u64, digest: String) -> Result<Self, StatusCode> {
        if !valid_digest(&digest) {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        Ok(Self {
            size,
            digest,
            received: 0,
            hash: Sha256::new(),
        })
    }
    fn update(&mut self, bytes: &[u8]) -> Result<(), StatusCode> {
        let next = self
            .received
            .checked_add(bytes.len() as u64)
            .ok_or(StatusCode::PAYLOAD_TOO_LARGE)?;
        if next > self.size {
            return Err(StatusCode::PAYLOAD_TOO_LARGE);
        }
        self.received = next;
        self.hash.update(bytes);
        Ok(())
    }
    fn finish(self) -> Result<(), StatusCode> {
        if self.received != self.size {
            return Err(StatusCode::BAD_REQUEST);
        }
        if hex::encode(self.hash.finalize()) != self.digest {
            return Err(StatusCode::CONFLICT);
        }
        Ok(())
    }
}

#[derive(Default)]
struct UploadProgress {
    complete: AtomicBool,
    error: Mutex<Option<StatusCode>>,
}
impl UploadProgress {
    fn failure(&self, status: StatusCode) -> io::Error {
        if let Ok(mut error) = self.error.lock() {
            *error = Some(status);
        }
        io::Error::other("binary upload ended or failed its bound")
    }
    fn status(&self) -> StatusCode {
        self.error
            .lock()
            .ok()
            .and_then(|error| *error)
            .unwrap_or(StatusCode::SERVICE_UNAVAILABLE)
    }
}

fn upload_stream(
    body: Body,
    caller: ManagementCaller,
    check: TransferCheck,
    deadline: tokio::time::Instant,
    progress: Arc<UploadProgress>,
    monitor: Option<Arc<AccessMonitor>>,
) -> impl futures_util::Stream<Item = Result<bytes::Bytes, io::Error>> + Send {
    async_stream::try_stream! {
        let mut incoming = body.into_data_stream();
        let mut check = check;
        loop {
            let next = tokio::select! {
                biased;
                _ = caller.ended() => Err(progress.failure(StatusCode::FORBIDDEN)),
                _ = tokio::time::sleep_until(deadline) => Err(progress.failure(StatusCode::REQUEST_TIMEOUT)),
                status = async {
                    match monitor.as_ref() {
                        Some(monitor) => monitor.ended().await,
                        None => std::future::pending().await,
                    }
                } => Err(progress.failure(status)),
                next = incoming.next() => Ok(next),
            }?;
            if !caller.alive() { Err(progress.failure(StatusCode::FORBIDDEN))?; }
            if let Some(monitor) = monitor.as_ref() {
                monitor.check().map_err(|status| progress.failure(status))?;
            }
            match next {
                Some(Ok(chunk)) => {
                    check.update(&chunk).map_err(|status| progress.failure(status))?;
                    yield chunk;
                }
                Some(Err(_)) => Err(progress.failure(StatusCode::BAD_REQUEST))?,
                None => break,
            }
        }
        check.finish().map_err(|status| progress.failure(status))?;
        progress.complete.store(true, Ordering::Release);
        if let Some(monitor) = monitor {
            // The source reached verified EOF. Receiving the protected receipt now uses
            // current inspect authority; completion must not become a new byte admission.
            monitor.stop();
        }
    }
}

pub(super) async fn upload(
    a: &App,
    caller: ManagementCaller,
    headers: HeaderMap,
    id: Uuid,
    body: Body,
) -> Result<Response, StatusCode> {
    let admitted = lookup_current(a, &caller, &headers, id).await?;
    if admitted.operation != "file.upload" {
        return Err(StatusCode::CONFLICT);
    }
    let descriptor = admitted
        .upload
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    if descriptor.timeout_seconds == 0 {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let deadline = tokio::time::Instant::now()
        .checked_add(Duration::from_secs(descriptor.timeout_seconds))
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    if let Some(length) = headers.get("content-length") {
        let length = length
            .to_str()
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or(StatusCode::BAD_REQUEST)?;
        if length != descriptor.size {
            return Err(StatusCode::CONFLICT);
        }
    }
    tokio::time::timeout_at(
        deadline,
        upload_inner(a, caller, headers, admitted, body, deadline),
    )
    .await
    .map_err(|_| StatusCode::REQUEST_TIMEOUT)?
}

async fn upload_inner(
    a: &App,
    caller: ManagementCaller,
    headers: HeaderMap,
    admitted: ResourceAdmission,
    body: Body,
    deadline: tokio::time::Instant,
) -> Result<Response, StatusCode> {
    let id = admitted.intent_id;
    let descriptor: &UploadDescriptor = admitted
        .upload
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let check = TransferCheck::new(descriptor.size, descriptor.sha256.clone())?;
    let progress = Arc::new(UploadProgress::default());
    if let Some(reply) = admitted.reply.as_ref() {
        if admitted.state != "succeeded"
            || reply.receipt["sha256"].as_str() != Some(descriptor.sha256.as_str())
            || reply.receipt["size"].as_u64() != Some(descriptor.size)
        {
            return Err(StatusCode::CONFLICT);
        }
        let stream = upload_stream(
            body,
            caller.clone(),
            check,
            deadline,
            progress.clone(),
            None,
        );
        futures_util::pin_mut!(stream);
        while let Some(chunk) = stream.next().await {
            chunk.map_err(|_| progress.status())?;
        }
        let current = lookup_current(a, &caller, &headers, id).await?;
        if current.reply.as_ref() != Some(reply) {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        return Ok(response(id, reply.clone()));
    }
    if admitted.state != "accepted" {
        return Err(StatusCode::CONFLICT);
    }
    let scope = caller.actor.scope(&headers);
    // These are fixed admitted declarations. Only the receiving worker can verify the bytes.
    let ready = context(
        a.client.post(format!("{}/resource/uploads/{id}", a.core)),
        &caller.actor,
    )
    .json(&json!({"work_id":scope.work_id,
                     "delegation_id":scope.delegation_id,
                     "sha256":descriptor.sha256,"size":descriptor.size}))
    .send()
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !ready.status().is_success() {
        return Err(ready.status());
    }
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let monitor = AccessMonitor::start(a, caller.clone(), &headers, id).await?;
    let stream = upload_stream(
        body,
        caller.clone(),
        check,
        deadline,
        progress.clone(),
        Some(monitor.clone()),
    );
    let endpoint = a
        .workers
        .get(&admitted.target)
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let forward = async {
        // Chunked forwarding ensures EOF/overflow is observed, including a caller with no Content-Length.
        let result = a
            .client
            .put(format!("{endpoint}/uploads/{id}/content"))
            .header("content-type", "application/octet-stream")
            .timeout(deadline.saturating_duration_since(tokio::time::Instant::now()))
            .body(reqwest::Body::wrap_stream(stream))
            .send()
            .await
            .map_err(|_| progress.status())?;
        if !result.status().is_success() {
            return Err(result.status());
        }
        if !progress.complete.load(Ordering::Acquire) {
            return Err(progress.status());
        }
        let reply: ResourceReply = result
            .json()
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
        if reply.receipt["sha256"].as_str() != Some(descriptor.sha256.as_str())
            || reply.receipt["size"].as_u64() != Some(descriptor.size)
        {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        let current = lookup_current(a, &caller, &headers, id).await?;
        if current.reply.as_ref() != Some(&reply) {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        Ok(response(id, reply))
    };
    tokio::pin!(forward);
    tokio::select! {
        biased;
        status = monitor.ended() => {
            if progress.complete.load(Ordering::Acquire) {
                forward.await
            } else {
                Err(status)
            }
        },
        result = &mut forward => result,
    }
}

pub(super) async fn binary_read(
    a: &App,
    caller: ManagementCaller,
    headers: &HeaderMap,
    id: Uuid,
    expected_target: &str,
    expected_input: &serde_json::Value,
    mut upstream: reqwest::Response,
) -> Result<Response, StatusCode> {
    let remote_headers = upstream.headers();
    if remote_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        != Some("application/octet-stream")
        || remote_headers
            .get("x-ouro-intent-id")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| Uuid::parse_str(s).ok())
            != Some(id)
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let size = remote_headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let digest = remote_headers
        .get("x-ouro-content-sha256")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?
        .to_owned();
    let mut check = TransferCheck::new(size, digest.clone())?;
    let current = lookup_current(a, &caller, headers, id).await?;
    let receipt = current
        .reply
        .as_ref()
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    if current.operation != "file.read"
        || current.target != expected_target
        || current.state != "succeeded"
        || receipt.content_type != "application/octet-stream"
        || !receipt.body.is_empty()
        || receipt.receipt["source"] != "catalog"
        || receipt.receipt["snapshot"] != *expected_input
        || receipt.receipt["sha256"].as_str() != Some(digest.as_str())
        || receipt.receipt["size"].as_u64() != Some(size)
    {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let monitor = AccessMonitor::start(a, caller.clone(), headers, id).await?;
    let stream: std::pin::Pin<
        Box<dyn futures_util::Stream<Item = Result<bytes::Bytes, io::Error>> + Send>,
    > = Box::pin(async_stream::try_stream! {
        loop {
            let next = tokio::select! {
                biased;
                _ = caller.ended() => Err(io::Error::other("file reader instance ended")),
                next = upstream.chunk() => next.map_err(|_| io::Error::other("file content unavailable")),
            }?;
            if !caller.alive() { Err(io::Error::other("file reader instance ended"))?; }
            match next {
                Some(chunk) => {
                    check.update(&chunk).map_err(|_| io::Error::other("file content exceeds admitted length"))?;
                    yield chunk;
                }
                None => break,
            }
        }
        check.finish().map_err(|_| io::Error::other("file content identity mismatch"))?;
    });
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/octet-stream")
        .header("content-length", size.to_string())
        .header("x-ouro-content-sha256", digest)
        .header("x-ouro-intent-id", id.to_string())
        .body(Body::from_stream(MonitoredStream::new(stream, monitor)))
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}
#[cfg(test)]
mod binary_tests {
    use super::super::access::test_monitor;
    use super::*;
    use crate::identity::Actor;

    fn human() -> ManagementCaller {
        ManagementCaller {
            actor: Actor::Human("fixture-reader".into()),
            #[cfg(target_os = "linux")]
            peer: None,
        }
    }

    async fn consume(payload: Vec<u8>, expected: &[u8]) -> (Vec<u8>, Arc<UploadProgress>) {
        let chunks: Vec<_> = payload
            .chunks(8191)
            .map(|chunk| Ok::<_, io::Error>(bytes::Bytes::copy_from_slice(chunk)))
            .collect();
        let body = Body::from_stream(futures_util::stream::iter(chunks));
        let check =
            TransferCheck::new(expected.len() as u64, hex::encode(Sha256::digest(expected)))
                .unwrap();
        let progress = Arc::new(UploadProgress::default());
        let stream = upload_stream(
            body,
            human(),
            check,
            tokio::time::Instant::now() + Duration::from_secs(2),
            progress.clone(),
            None,
        );
        futures_util::pin_mut!(stream);
        let mut observed = Vec::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(chunk) => observed.extend_from_slice(&chunk),
                Err(_) => break,
            }
        }
        (observed, progress)
    }

    #[tokio::test]
    async fn binary_upload_preserves_non_utf8_past_the_old_fixture_limit() {
        let bytes: Vec<_> = (0..131_071).map(|i| (i % 256) as u8).collect();
        let (observed, progress) = consume(bytes.clone(), &bytes).await;
        assert_eq!(observed, bytes);
        assert!(progress.complete.load(Ordering::Acquire));
        assert!(progress.error.lock().unwrap().is_none());
    }

    #[tokio::test]
    async fn replay_body_cannot_succeed_with_a_suffix_truncation_or_changed_bytes() {
        let expected = vec![0xa5; 70_001];
        for (bytes, status) in [
            (
                [expected.clone(), vec![0]].concat(),
                StatusCode::PAYLOAD_TOO_LARGE,
            ),
            (expected[..70_000].to_vec(), StatusCode::BAD_REQUEST),
            (vec![0xa6; expected.len()], StatusCode::CONFLICT),
        ] {
            let (_, progress) = consume(bytes, &expected).await;
            assert!(!progress.complete.load(Ordering::Acquire));
            assert_eq!(progress.status(), status);
        }
    }

    #[tokio::test]
    async fn idle_upload_stops_at_its_fixed_deadline() {
        let never = futures_util::stream::pending::<Result<bytes::Bytes, io::Error>>();
        let progress = Arc::new(UploadProgress::default());
        let stream = upload_stream(
            Body::from_stream(never),
            human(),
            TransferCheck::new(0, hex::encode(Sha256::digest([]))).unwrap(),
            tokio::time::Instant::now() + Duration::from_millis(20),
            progress.clone(),
            None,
        );
        futures_util::pin_mut!(stream);
        assert!(stream.next().await.unwrap().is_err());
        assert_eq!(progress.status(), StatusCode::REQUEST_TIMEOUT);
        assert!(!progress.complete.load(Ordering::Acquire));
    }

    #[tokio::test]
    async fn upload_eof_ends_byte_monitor_without_invalidating_the_receipt_wait() {
        let (monitor, status, stopped) = test_monitor().await;
        drop(status);
        let progress = Arc::new(UploadProgress::default());
        let stream = upload_stream(
            Body::empty(),
            human(),
            TransferCheck::new(0, hex::encode(Sha256::digest([]))).unwrap(),
            tokio::time::Instant::now() + Duration::from_secs(2),
            progress.clone(),
            Some(monitor.clone()),
        );
        futures_util::pin_mut!(stream);
        assert!(stream.next().await.is_none());
        stopped.await.unwrap();
        assert!(progress.complete.load(Ordering::Acquire));
        assert!(progress.error.lock().unwrap().is_none());
        assert_eq!(monitor.ended().await, StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn idle_upload_is_cancelled_by_the_independent_access_signal() {
        let (monitor, status, _stopped) = test_monitor().await;
        let progress = Arc::new(UploadProgress::default());
        let stream = upload_stream(
            Body::from_stream(futures_util::stream::pending::<
                Result<bytes::Bytes, io::Error>,
            >()),
            human(),
            TransferCheck::new(0, hex::encode(Sha256::digest([]))).unwrap(),
            tokio::time::Instant::now() + Duration::from_secs(2),
            progress.clone(),
            Some(monitor),
        );
        futures_util::pin_mut!(stream);
        status.send(Some(StatusCode::FORBIDDEN)).unwrap();
        assert!(stream.next().await.unwrap().is_err());
        assert_eq!(progress.status(), StatusCode::FORBIDDEN);
        assert!(!progress.complete.load(Ordering::Acquire));
    }
}
