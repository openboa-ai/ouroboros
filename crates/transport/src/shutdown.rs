//! Bounded transport drain. Completion describes connection tasks, not external effects.
use anyhow::{Context, Result};
use std::time::Duration;
use tokio::{sync::watch, task::JoinSet};

pub(crate) async fn signal() -> Result<()> {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
        tokio::select! { _ = term.recv() => {}, result = tokio::signal::ctrl_c() => { result?; } }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await?;
    Ok(())
}

pub(crate) async fn drain(
    tasks: &mut JoinSet<()>,
    stop: &watch::Sender<bool>,
    deadline: Duration,
) -> Result<()> {
    stop.send_replace(true);
    let result = tokio::time::timeout(deadline, async {
        while let Some(result) = tasks.join_next().await {
            result.context("connection task failed during shutdown")?;
        }
        Ok::<_, anyhow::Error>(())
    })
    .await;
    match result {
        Ok(Ok(())) => Ok(()),
        result => {
            tasks.abort_all();
            // Aborting async handlers is not proof their external transactions were cancelled.
            while tasks.join_next().await.is_some() {}
            match result {
                Ok(Err(error)) => Err(error),
                _ => {
                    anyhow::bail!("transport drain deadline expired; effects may remain unresolved")
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn drain_notifies_and_waits_for_final_handler_work() {
        let (tx, mut rx) = watch::channel(false);
        let done = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let observed = done.clone();
        let mut tasks = JoinSet::new();
        tasks.spawn(async move {
            rx.changed().await.unwrap();
            tokio::task::yield_now().await;
            observed.store(true, std::sync::atomic::Ordering::SeqCst);
        });
        drain(&mut tasks, &tx, Duration::from_secs(1))
            .await
            .unwrap();
        assert!(done.load(std::sync::atomic::Ordering::SeqCst));
        assert!(tasks.is_empty());
    }
    #[tokio::test]
    async fn stuck_handler_is_not_reported_as_drained() {
        let (tx, _) = watch::channel(false);
        let mut tasks = JoinSet::new();
        tasks.spawn(std::future::pending::<()>());
        assert!(
            drain(&mut tasks, &tx, Duration::from_millis(10))
                .await
                .is_err()
        );
        assert!(tasks.is_empty());
    }
}
