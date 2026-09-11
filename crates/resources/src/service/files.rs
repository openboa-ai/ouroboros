//! Bounded binary transfer; pinned file identity and independent live checks survive backpressure.
use super::admission::{claim, complete, gateway_peer};
use super::catalog::{
    catalog_io, file_limits, upload_reply, validate_workspace_context, workspace_context,
};
use super::{App, Worker, id};
use anyhow::{Context, Result, ensure};
use axum::{
    Extension, Json,
    body::{Body, Bytes},
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::Response,
};
use futures_util::StreamExt;
use ouroboros_contracts::{ResourceLiveRequest, ResourceReply, ResourceTicket};
use ouroboros_resources::CatalogWorker;
use ouroboros_transport::Peer;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{sync::Arc, time::Duration};
use tokio::{sync::watch, time::Instant};
use uuid::Uuid;

const FILE_CHUNK_BYTES: usize = 64 * 1024;
const LIVE_PERIOD: Duration = Duration::from_millis(250);
const LIVE_INITIAL_TIMEOUT: Duration = Duration::from_millis(500);

async fn file_live(a: &App, worker: &CatalogWorker, ticket: &ResourceTicket) -> Result<()> {
    let storage = worker.preflight().await.inspect_err(|_| {
        eprintln!(
            "resource_file_live phase=storage_preflight intent={}",
            ticket.intent_id
        );
    })?;
    worker.validate_target(
        ticket.firm_id,
        id(&ticket.configuration, "store_id")?,
        id(&ticket.configuration, "storage_generation")?,
    )?;
    let response = a
        .client
        .post(format!("{}/resource/live/{}", a.core, ticket.intent_id))
        .json(&ResourceLiveRequest {
            attempt_id: ticket.attempt_id,
            storage: Some(storage),
        })
        .send()
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_live phase=core_transport intent={}",
                ticket.intent_id
            );
        })?;
    if response.status() != StatusCode::NO_CONTENT {
        eprintln!(
            "resource_file_live phase=core_decision status={} intent={}",
            response.status().as_u16(),
            ticket.intent_id
        );
    }
    ensure!(
        response.status() == StatusCode::NO_CONTENT,
        "transfer is not currently permitted"
    );
    Ok(())
}

struct FileTransfer {
    stopped: watch::Receiver<bool>,
    deadline: Instant,
}

impl FileTransfer {
    async fn run<T>(&self, operation: impl std::future::Future<Output = Result<T>>) -> Result<T> {
        ensure!(
            !*self.stopped.borrow() && Instant::now() < self.deadline,
            "transfer stopped"
        );
        let mut stopped = self.stopped.clone();
        tokio::select! {
            biased;
            _ = stopped.changed() => anyhow::bail!("transfer stopped"),
            _ = tokio::time::sleep_until(self.deadline) => anyhow::bail!("transfer deadline reached"),
            result = operation => result,
        }
    }
}

async fn file_transfer(
    a: Arc<App>,
    worker: Arc<CatalogWorker>,
    ticket: &ResourceTicket,
    started: Instant,
) -> Result<(FileTransfer, u64)> {
    let (max_bytes, duration) = file_limits(&ticket.configuration)?;
    let deadline = started + duration;
    ensure!(Instant::now() < deadline, "transfer deadline reached");
    tokio::time::timeout_at(
        deadline.min(Instant::now() + LIVE_INITIAL_TIMEOUT),
        file_live(&a, &worker, ticket),
    )
    .await
    .inspect_err(|_| {
        eprintln!(
            "resource_file_live phase=initial_timeout intent={}",
            ticket.intent_id
        );
    })
    .context("live check timed out")??;
    let (stop, stopped) = watch::channel(false);
    let ticket = ticket.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(LIVE_PERIOD);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        interval.tick().await;
        loop {
            tokio::select! {
                biased;
                _ = stop.closed() => return,
                _ = tokio::time::sleep_until(deadline) => break,
                _ = interval.tick() => {
                    let check = tokio::time::timeout_at(
                        deadline.min(Instant::now() + LIVE_PERIOD),
                        file_live(&a, &worker, &ticket),
                    ).await;
                    if !matches!(check, Ok(Ok(()))) {
                        break;
                    }
                },
            }
        }
        let _ = stop.send(true);
    });
    Ok((FileTransfer { stopped, deadline }, max_bytes))
}

pub(super) async fn upload_content(
    State(a): State<Arc<App>>,
    Extension(peer): Extension<Peer>,
    Path(intent): Path<Uuid>,
    headers: HeaderMap,
    body: Body,
) -> Result<Json<ResourceReply>, StatusCode> {
    gateway_peer(&a, &peer)?;
    if headers
        .get("content-type")
        .is_none_or(|value| value != "application/octet-stream")
    {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    let started = Instant::now();
    upload_content_inner(a, intent, headers, body, started)
        .await
        .map(Json)
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}

async fn upload_content_inner(
    a: Arc<App>,
    intent: Uuid,
    headers: HeaderMap,
    body: Body,
    started: Instant,
) -> Result<ResourceReply> {
    let Worker::Catalog(worker) = &a.worker else {
        anyhow::bail!("upload requires the catalog worker");
    };
    let worker = worker.clone();
    let ticket = claim(&a, intent).await?;
    ensure!(ticket.operation == "file.upload", "wrong upload operation");
    let (transfer, max_bytes) = file_transfer(a.clone(), worker.clone(), &ticket, started).await?;
    let size = ticket.input["size"]
        .as_u64()
        .context("upload size required")?;
    let digest = ticket.input["sha256"]
        .as_str()
        .context("upload digest required")?;
    ensure!(size <= max_bytes, "upload exceeds target bound");
    if let Some(length) = headers.get("content-length") {
        ensure!(
            length.to_str()?.parse::<u64>()? == size,
            "upload length differs from admitted size"
        );
    }
    let prepared = transfer
        .run({
            let worker = worker.clone();
            let digest = digest.to_owned();
            let firm = ticket.firm_id;
            catalog_io(async move {
                worker
                    .prepare_upload(firm, intent, &digest, size, max_bytes)
                    .await
            })
        })
        .await?;
    let mut stage = transfer
        .run({
            let worker = worker.clone();
            let prepared = prepared.clone();
            catalog_io(async move { worker.begin_upload(&prepared).await })
        })
        .await?;
    let mut input = body.into_data_stream();
    let mut actual_size = 0_u64;
    let mut actual_digest = Sha256::new();
    loop {
        let next = transfer
            .run(async { input.next().await.transpose().map_err(Into::into) })
            .await?;
        let Some(mut frame) = next else {
            break;
        };
        while !frame.is_empty() {
            let chunk = frame.split_to(frame.len().min(FILE_CHUNK_BYTES));
            actual_size = actual_size
                .checked_add(chunk.len() as u64)
                .context("upload size overflow")?;
            ensure!(actual_size <= size, "upload exceeds admitted size");
            actual_digest.update(&chunk);
            stage = transfer
                .run({
                    let worker = worker.clone();
                    async move {
                        tokio::task::spawn_blocking(move || {
                            // A previously installed/staged blob does not excuse validating this body.
                            if stage.requires_transfer() {
                                worker.write_upload_chunk(&mut stage, &chunk)?;
                            }
                            Ok::<_, anyhow::Error>(stage)
                        })
                        .await
                        .context("upload write task failed")?
                    }
                })
                .await?;
        }
    }
    ensure!(actual_size == size, "incomplete upload");
    ensure!(
        format!("{:x}", actual_digest.finalize()) == digest,
        "upload digest mismatch"
    );
    transfer.run(file_live(&a, &worker, &ticket)).await?;
    let installed = transfer
        .run({
            let worker = worker.clone();
            let firm = ticket.firm_id;
            catalog_io(async move { worker.finish_upload(firm, intent, &prepared, stage).await })
        })
        .await?;
    ensure!(installed == digest, "committed upload digest mismatch");
    let blob = transfer
        .run({
            let worker = worker.clone();
            let firm = ticket.firm_id;
            catalog_io(async move {
                worker
                    .upload_reference(firm, intent, &installed, actual_size)
                    .await?
                    .context("committed upload reference unavailable")
            })
        })
        .await?;
    let result = upload_reply(intent, &blob);
    // All bytes and their catalog receipt are committed. Publishing that existing observation
    // is not another byte transfer: Core marks this upload succeeded, which ends /live eligibility.
    // Do not let that expected state change cancel its own completion acknowledgment.
    let deadline = transfer.deadline;
    drop(transfer);
    tokio::time::timeout_at(deadline, complete(&a, intent, &result))
        .await
        .context("upload receipt completion remains unobserved")??;
    Ok(result)
}

pub(super) async fn download_file(
    a: Arc<App>,
    ticket: ResourceTicket,
    started: Instant,
) -> Result<Response> {
    let Worker::Catalog(worker) = &a.worker else {
        anyhow::bail!("file read requires the catalog worker");
    };
    let worker = worker.clone();
    let (transfer, max_bytes) = file_transfer(a.clone(), worker.clone(), &ticket, started)
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_read phase=initialize_live intent={}",
                ticket.intent_id
            );
        })?;
    let input = &ticket.input;
    let (workspace, revision, path) = (|| -> Result<_> {
        let (workspace, _) = workspace_context(&ticket)?;
        let revision = input["revision"].as_i64().context("revision required")?;
        let path = input["path"].as_str().context("path required")?.to_owned();
        Ok((workspace, revision, path))
    })()
    .inspect_err(|_| {
        eprintln!(
            "resource_file_read phase=prepare_input intent={}",
            ticket.intent_id
        );
    })?;
    let mut reader = transfer
        .run({
            let worker = worker.clone();
            let firm = ticket.firm_id;
            let ticket = ticket.clone();
            catalog_io(async move {
                validate_workspace_context(&worker, &ticket).await?;
                worker
                    .open_file(firm, workspace, revision, &path, max_bytes)
                    .await
            })
        })
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_read phase=open_file intent={}",
                ticket.intent_id
            );
        })?;
    let size = reader.size;
    let digest = reader.digest.clone();
    let result = ResourceReply {
        status: 200,
        content_type: "application/octet-stream".into(),
        body: String::new(),
        receipt: json!({"source":"catalog","stage":"prepared","sha256":digest,"size":size,"snapshot":input}),
    };
    transfer
        .run(file_live(&a, &worker, &ticket))
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_read phase=precomplete_live intent={}",
                ticket.intent_id
            );
        })?;
    // This receipt describes authorized content preparation, never completed client delivery.
    transfer
        .run(complete(&a, ticket.intent_id, &result))
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_read phase=completion intent={}",
                ticket.intent_id
            );
        })?;
    transfer
        .run(file_live(&a, &worker, &ticket))
        .await
        .inspect_err(|_| {
            eprintln!(
                "resource_file_read phase=postcomplete_live intent={}",
                ticket.intent_id
            );
        })?;
    let stream = async_stream::stream! {
        let mut delivered = 0_u64;
        loop {
            let next = transfer.run({
                let worker = worker.clone();
                async move {
                    tokio::task::spawn_blocking(move || {
                        let bytes = worker.read_file_chunk(&mut reader, FILE_CHUNK_BYTES)?;
                        Ok::<_, anyhow::Error>((reader, bytes))
                    }).await.context("file read task failed")?
                }
            }).await;
            let (returned, bytes) = match next {
                Ok(value) => value,
                Err(_) => {
                    yield Err(std::io::Error::other("file transfer stopped or unavailable"));
                    break;
                },
            };
            reader = returned;
            if bytes.is_empty() {
                if delivered != size {
                    yield Err(std::io::Error::other("incomplete file transfer"));
                }
                break;
            }
            delivered = match delivered.checked_add(bytes.len() as u64) {
                Some(count) if count <= size => count,
                _ => {
                    yield Err(std::io::Error::other("file transfer size changed"));
                    break;
                },
            };
            // The monitor runs independently of this stream, including downstream backpressure.
            let stopped = *transfer.stopped.borrow() || Instant::now() >= transfer.deadline;
            if stopped {
                yield Err(std::io::Error::other("file transfer stopped"));
                break;
            }
            yield Ok(Bytes::from(bytes));
        }
    };
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/octet-stream")
        .header("content-length", size.to_string())
        .header("x-ouro-content-sha256", digest)
        .header("x-ouro-intent-id", ticket.intent_id.to_string())
        .body(Body::from_stream(stream))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_transfer_configuration_has_no_implicit_limits() {
        for configuration in [
            json!({}),
            json!({"max_file_bytes":1}),
            json!({"transfer_seconds":1}),
            json!({"max_file_bytes":0,"transfer_seconds":1}),
            json!({"max_file_bytes":1,"transfer_seconds":0}),
            json!({"max_file_bytes":1,"transfer_seconds":301}),
            json!({"max_file_bytes":u64::MAX,"transfer_seconds":1}),
        ] {
            assert!(file_limits(&configuration).is_err());
        }
        for seconds in [1, 300] {
            assert_eq!(
                file_limits(&json!({"max_file_bytes":1,"transfer_seconds":seconds})).unwrap(),
                (1, Duration::from_secs(seconds)),
            );
        }
    }

    #[tokio::test]
    async fn live_restriction_interrupts_an_idle_transfer() {
        let (stop, stopped) = watch::channel(false);
        let transfer = FileTransfer {
            stopped,
            deadline: Instant::now() + Duration::from_secs(1),
        };
        let wait = transfer.run(std::future::pending::<Result<()>>());
        let restrict = async {
            stop.send(true).unwrap();
        };
        let (result, ()) = tokio::join!(wait, restrict);
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn expired_transfer_never_polls_another_operation() {
        let (_stop, stopped) = watch::channel(false);
        let transfer = FileTransfer {
            stopped,
            deadline: Instant::now(),
        };
        let result = transfer
            .run::<()>(async { panic!("expired operation executed") })
            .await;
        assert!(result.is_err());
    }
}
