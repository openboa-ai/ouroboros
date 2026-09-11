//! Process stop intent: cancel private activity only inside its containment cleanup scope.
use anyhow::Result;
use tokio::{
    signal::unix::{SignalKind, signal},
    sync::watch,
    task::JoinHandle,
};

pub struct Stop {
    requested: watch::Receiver<bool>,
    observer: JoinHandle<()>,
}
impl Stop {
    pub fn listen() -> Result<Self> {
        let mut terminate = signal(SignalKind::terminate())?;
        let mut interrupt = signal(SignalKind::interrupt())?;
        let (sender, requested) = watch::channel(false);
        let observer = tokio::spawn(async move {
            tokio::select! {
                _ = terminate.recv() => {},
                _ = interrupt.recv() => {},
            }
            let _ = sender.send(true);
        });
        Ok(Self {
            requested,
            observer,
        })
    }
    pub fn requested(&self) -> bool {
        self.requested.has_changed().is_err() || *self.requested.borrow()
    }
    pub async fn wait(&self) {
        let mut receiver = self.requested.clone();
        // Loss of the observer is also a stop condition; it never enables more work.
        let _ = receiver.wait_for(|requested| *requested).await;
    }
}
impl Drop for Stop {
    fn drop(&mut self) {
        self.observer.abort();
    }
}
