//! Native provider streaming, bounded backpressure, and completion-before-final-event delivery.
use super::admission::complete;
use super::{App, Worker};
use anyhow::Result;
use axum::{
    body::{Body, Bytes},
    http::StatusCode,
    response::Response,
};
use ouroboros_contracts::{ResourceLiveRequest, ResourceReply, ResourceTicket};
use std::{sync::Arc, time::Duration};

struct ProviderTask(tokio::task::JoinHandle<()>);
impl Drop for ProviderTask {
    fn drop(&mut self) {
        self.0.abort();
    }
}

pub(super) async fn stream_provider(
    a: Arc<App>,
    ticket: ResourceTicket,
) -> Result<Response, StatusCode> {
    use ouroboros_resources::{credential_envelope::CustodyError, provider::ProviderFrame};
    let intent = ticket.intent_id;
    let (send, mut receive) = tokio::sync::mpsc::channel::<Result<ProviderFrame, ()>>(2);
    let gate = Arc::new(std::sync::Mutex::new(
        ouroboros_resources::provider_stream::CompletionGate::new(),
    ));
    let task = ProviderTask(tokio::spawn(async move {
        let Worker::Provider(worker) = &a.worker else {
            return;
        };
        let result = worker
            .execute_stream(
                &ticket,
                || async {
                    let response = a
                        .client
                        .post(format!("{}/resource/live/{intent}", a.core))
                        .json(&ResourceLiveRequest {
                            attempt_id: ticket.attempt_id,
                            storage: None,
                        })
                        .send()
                        .await
                        .map_err(|_| CustodyError)?;
                    if response.status() == StatusCode::NO_CONTENT {
                        Ok(())
                    } else {
                        Err(CustodyError)
                    }
                },
                |frame| {
                    let send = send.clone();
                    let frame = match frame {
                        ProviderFrame::Data(bytes) => {
                            match gate.lock().expect("stream gate").push(&bytes) {
                                Ok(bytes) if bytes.is_empty() => None,
                                Ok(bytes) => Some(Ok(ProviderFrame::Data(bytes))),
                                Err(_) => Some(Err(())),
                            }
                        }
                        head => Some(Ok(head)),
                    };
                    async move {
                        if let Some(frame) = frame {
                            let invalid = frame.is_err();
                            send.send(frame).await.map_err(|_| CustodyError)?;
                            if invalid {
                                return Err(CustodyError);
                            }
                        }
                        Ok(())
                    }
                },
            )
            .await;
        let completed = match result {
            Ok(reply) => tokio::time::timeout(Duration::from_secs(2), complete(&a, intent, &reply))
                .await
                .is_ok_and(|r| r.is_ok()),
            Err(_) => false,
        };
        if completed {
            let tail = gate.lock().expect("stream gate").finish();
            if !tail.is_empty() {
                let _ = send.send(Ok(ProviderFrame::Data(tail))).await;
            }
        } else {
            let _ = send.send(Err(())).await;
        }
    }));
    // An owned abort guard covers cancellation both before headers and during body delivery.
    let head = tokio::time::timeout(Duration::from_secs(35), receive.recv()).await;
    let (status, content_type) = match head {
        Ok(Some(Ok(ProviderFrame::Head {
            status,
            content_type,
        }))) => (status, content_type),
        _ => return Err(StatusCode::SERVICE_UNAVAILABLE),
    };
    if content_type != "text/event-stream" || status != 200 {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    let stream = async_stream::stream! {
        let mut task=task;
        while let Some(frame)=receive.recv().await {
            match frame {
                Ok(ProviderFrame::Data(bytes))=>yield Ok(Bytes::from(bytes)),
                _=>{yield Err(std::io::Error::other("provider stream incomplete"));return;}
            }
        }
        if (&mut task.0).await.is_err() {yield Err(std::io::Error::other("provider task incomplete"));}
    };
    Response::builder()
        .status(status)
        .header("content-type", content_type)
        .header("x-ouro-intent-id", intent.to_string())
        .body(Body::from_stream(stream))
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)
}

pub(super) async fn execute(
    a: &App,
    worker: &ouroboros_resources::provider::ProviderSender,
    t: &ResourceTicket,
) -> Result<ResourceReply> {
    Ok(worker
        .execute(t, || async {
            let response = a
                .client
                .post(format!("{}/resource/live/{}", a.core, t.intent_id))
                .json(&ResourceLiveRequest {
                    attempt_id: t.attempt_id,
                    storage: None,
                })
                .send()
                .await
                .map_err(|_| ouroboros_resources::credential_envelope::CustodyError)?;
            if response.status() != StatusCode::NO_CONTENT {
                return Err(ouroboros_resources::credential_envelope::CustodyError);
            }
            Ok(())
        })
        .await?)
}
