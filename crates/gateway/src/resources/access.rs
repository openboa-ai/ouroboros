//! Current Core authority checks, independent revocation polling, and response-body lifetime.
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::http::{HeaderMap, StatusCode};
use ouroboros_contracts::ResourceAdmission;
use std::{
    future::Future,
    io,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Duration,
};
use uuid::Uuid;

pub(super) fn lookup_request(
    a: &App,
    caller: &ManagementCaller,
    headers: &HeaderMap,
    id: Uuid,
) -> reqwest::RequestBuilder {
    context(
        a.client.post(format!("{}/resource/lookup/{id}", a.core)),
        &caller.actor,
    )
    .json(&caller.actor.scope(headers))
}

pub(super) async fn lookup_current(
    a: &App,
    caller: &ManagementCaller,
    headers: &HeaderMap,
    id: Uuid,
) -> Result<ResourceAdmission, StatusCode> {
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let response = lookup_request(a, caller, headers, id)
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !response.status().is_success() {
        return Err(response.status());
    }
    let record: ResourceAdmission = response
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if record.intent_id != id || !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(record)
}

pub(super) struct AccessMonitor {
    task: tokio::task::JoinHandle<()>,
    status: tokio::sync::watch::Receiver<Option<StatusCode>>,
}
impl Drop for AccessMonitor {
    fn drop(&mut self) {
        self.task.abort();
    }
}
impl AccessMonitor {
    pub(super) fn stop(&self) {
        self.task.abort();
    }

    pub(super) fn check(&self) -> Result<(), StatusCode> {
        match *self.status.borrow() {
            Some(status) => Err(status),
            None if self.status.has_changed().is_err() => Err(StatusCode::SERVICE_UNAVAILABLE),
            None => Ok(()),
        }
    }

    pub(super) async fn ended(&self) -> StatusCode {
        let mut status = self.status.clone();
        loop {
            if let Some(status) = *status.borrow_and_update() {
                return status;
            }
            if status.changed().await.is_err() {
                return StatusCode::SERVICE_UNAVAILABLE;
            }
        }
    }

    pub(super) async fn start(
        a: &App,
        caller: ManagementCaller,
        headers: &HeaderMap,
        id: Uuid,
    ) -> Result<Arc<Self>, StatusCode> {
        Self::start_kind(a, caller, headers, id, false).await
    }
    pub(super) async fn start_kind(
        a: &App,
        caller: ManagementCaller,
        headers: &HeaderMap,
        id: Uuid,
        model: bool,
    ) -> Result<Arc<Self>, StatusCode> {
        let scope = caller.actor.scope(headers);
        delivery_access(a, &caller, id, &scope, model).await?;
        let a = a.clone();
        let (send, status) = tokio::sync::watch::channel(None);
        let task = tokio::spawn(async move {
            // An independent task still checks while either HTTP peer is backpressured.
            // The polling target is 250 ms plus a 250 ms check timeout; host scheduling
            // delays and bytes already handed to the transport are not a hard real-time guarantee.
            let period = Duration::from_millis(250);
            let mut ticks = tokio::time::interval_at(tokio::time::Instant::now() + period, period);
            ticks.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                let result = tokio::select! {
                    biased;
                    _ = caller.ended() => Err(StatusCode::FORBIDDEN),
                    _ = ticks.tick() => delivery_access(&a, &caller, id, &scope, model).await,
                };
                if let Err(status) = result {
                    let _ = send.send(Some(status));
                    return;
                }
            }
        });
        Ok(Arc::new(Self { task, status }))
    }
}

async fn delivery_access(
    a: &App,
    caller: &ManagementCaller,
    id: Uuid,
    scope: &crate::identity::ResourceScope,
    model: bool,
) -> Result<(), StatusCode> {
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    let request = context(
        a.client.post(format!(
            "{}/resource/{}/{id}/access",
            a.core,
            if model {
                "model-transfers"
            } else {
                "transfers"
            }
        )),
        &caller.actor,
    )
    .json(scope)
    .send();
    let response = tokio::select! {
        biased;
        _ = caller.ended() => return Err(StatusCode::FORBIDDEN),
        result = tokio::time::timeout(Duration::from_millis(250), request) => result
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?,
    };
    if !caller.alive() {
        return Err(StatusCode::FORBIDDEN);
    }
    match response.status() {
        StatusCode::NO_CONTENT => Ok(()),
        status if status.is_success() => Err(StatusCode::SERVICE_UNAVAILABLE),
        status => Err(status),
    }
}

// The monitor belongs to the response body, not the upstream generator. Finishing the
// upstream cannot drop its checks while the consumer still owns the downstream body.
pub(super) struct MonitoredStream<S> {
    inner: Pin<Box<S>>,
    monitor: Arc<AccessMonitor>,
    failure: Pin<Box<dyn Future<Output = StatusCode> + Send>>,
    failed: bool,
}
impl<S> MonitoredStream<S> {
    pub(super) fn new(inner: S, monitor: Arc<AccessMonitor>) -> Self {
        let waiting = monitor.clone();
        Self {
            inner: Box::pin(inner),
            monitor,
            failure: Box::pin(async move { waiting.ended().await }),
            failed: false,
        }
    }
}
impl<S> futures_util::Stream for MonitoredStream<S>
where
    S: futures_util::Stream<Item = Result<bytes::Bytes, io::Error>>,
{
    type Item = Result<bytes::Bytes, io::Error>;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = self.get_mut();
        if this.failed {
            return Poll::Ready(None);
        }
        if this.monitor.check().is_err() || this.failure.as_mut().poll(cx).is_ready() {
            this.failed = true;
            return Poll::Ready(Some(Err(io::Error::other("file transfer access ended"))));
        }
        // Bytes already yielded to the HTTP transport cannot be retracted on revocation.
        this.inner.as_mut().poll_next(cx)
    }
}

#[cfg(test)]
pub(super) async fn test_monitor() -> (
    Arc<AccessMonitor>,
    tokio::sync::watch::Sender<Option<StatusCode>>,
    tokio::sync::oneshot::Receiver<()>,
) {
    struct Stopped(Option<tokio::sync::oneshot::Sender<()>>);
    impl Drop for Stopped {
        fn drop(&mut self) {
            if let Some(signal) = self.0.take() {
                let _ = signal.send(());
            }
        }
    }
    let (send, status) = tokio::sync::watch::channel(None);
    let (started, ready) = tokio::sync::oneshot::channel();
    let (stop, stopped) = tokio::sync::oneshot::channel();
    let keeper = send.clone();
    let task = tokio::spawn(async move {
        let finish = Stopped(Some(stop));
        let _ = started.send(());
        std::future::pending::<()>().await;
        drop((keeper, finish));
    });
    ready.await.unwrap();
    (Arc::new(AccessMonitor { task, status }), send, stopped)
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::StreamExt;
    #[tokio::test]
    async fn completed_upstream_does_not_allow_buffered_bytes_after_access_ends() {
        let (monitor, status, stopped) = test_monitor().await;
        let (send, mut receive) = tokio::sync::mpsc::channel(2);
        let producer = tokio::spawn(async move {
            send.send(bytes::Bytes::from_static(b"first"))
                .await
                .unwrap();
            send.send(bytes::Bytes::from_static(b"buffered"))
                .await
                .unwrap();
        });
        producer.await.unwrap(); // The upstream has finished before the slow consumer reads.
        let upstream = async_stream::stream! {
            while let Some(chunk) = receive.recv().await {
                yield Ok::<_, io::Error>(chunk);
            }
        };
        let mut body = MonitoredStream::new(upstream, monitor);
        assert_eq!(body.next().await.unwrap().unwrap(), "first");
        status.send(Some(StatusCode::FORBIDDEN)).unwrap(); // No downstream polling is needed.
        assert!(body.next().await.unwrap().is_err());
        assert!(body.next().await.is_none());
        drop(body);
        stopped.await.unwrap();
    }

    #[tokio::test]
    async fn download_monitor_lives_through_upstream_eof_until_body_drop() {
        let (monitor, _status, mut stopped) = test_monitor().await;
        let upstream =
            futures_util::stream::iter([Ok::<_, io::Error>(bytes::Bytes::from_static(b"x"))]);
        let mut body = MonitoredStream::new(upstream, monitor);
        assert_eq!(body.next().await.unwrap().unwrap(), "x");
        assert!(body.next().await.is_none());
        assert!(matches!(
            stopped.try_recv(),
            Err(tokio::sync::oneshot::error::TryRecvError::Empty)
        ));
        drop(body);
        stopped.await.unwrap();
    }
}
