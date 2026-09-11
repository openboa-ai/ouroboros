//! Configuration, database connection and wake-loop startup for the Core process.
use super::{App, router};
use clap::Parser;
use ouroboros_core::Core;
use ouroboros_transport::TlsFiles;
use serde::Deserialize;
use std::{net::SocketAddr, path::PathBuf, time::Duration};
use uuid::Uuid;

#[derive(Parser)]
struct Args {
    #[arg(long)]
    config: PathBuf,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    listen: SocketAddr,
    tls: TlsFiles,
    database_url_file: PathBuf,
    firm_id: Uuid,
    gateway_fingerprint: String,
    runtime_fingerprint: Option<String>,
    wake_poll_interval_ms: Option<u64>,
    recovery_inspection: Option<ouroboros_transport::recovery::InspectionConfig>,
}

pub(crate) async fn run() -> anyhow::Result<()> {
    let args = Args::parse();
    let (mut cfg, root) = ouroboros_transport::config::load::<Config>(&args.config)?;
    cfg.tls.resolve_paths(&root)?;
    root.resolve(&mut cfg.database_url_file)?;
    let url = ouroboros_transport::config::postgres_url_file(&cfg.database_url_file)?;
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(8)
        .acquire_timeout(Duration::from_secs(5))
        .connect(url.trim())
        .await
        .map_err(|_| anyhow::anyhow!("control database unavailable"))?;
    let recovery = cfg.recovery_inspection.map(|c| c.activate()).transpose()?;
    if recovery.is_some() {
        anyhow::ensure!(
            cfg.wake_poll_interval_ms.is_none() && cfg.runtime_fingerprint.is_none(),
            "inspection cannot configure Runtime or wake polling"
        );
        let paused: Option<bool> =
            sqlx::query_scalar("SELECT admission_paused FROM firms WHERE id=$1")
                .bind(cfg.firm_id)
                .fetch_optional(&pool)
                .await?;
        anyhow::ensure!(paused == Some(true), "restored firm must already be paused");
    }
    let app = App {
        core: Core::new(pool, cfg.firm_id),
        gateway: cfg.gateway_fingerprint,
        runtime: cfg.runtime_fingerprint,
        recovery,
    };
    if let Some(interval) = cfg.wake_poll_interval_ms {
        anyhow::ensure!(
            (100..=60000).contains(&interval),
            "invalid wake polling interval"
        );
        let core = app.core.clone();
        tokio::spawn(async move {
            loop {
                if core.poll_wakes().await.is_err() {
                    eprintln!("wake polling failed; pending registrations retained");
                }
                tokio::time::sleep(Duration::from_millis(interval)).await;
            }
        });
    }
    ouroboros_transport::serve(cfg.listen, cfg.tls, router(app)).await
}
