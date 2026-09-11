mod identity;
mod ingress;
mod management;
mod resources;

use axum::Router;
use clap::Parser;
use ingress::forward;
#[cfg(target_os = "linux")]
use ingress::instance_forward;
use ouroboros_transport::TlsFiles;
use resources::native::NativeRoutes;
use serde::Deserialize;
use std::{net::SocketAddr, path::PathBuf};

#[derive(Parser)]
struct Args {
    #[arg(long)]
    recover_instance_socket: bool,
    #[arg(long)]
    config: PathBuf,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    listen: SocketAddr,
    tls: TlsFiles,
    core_url: String,
    core_client: TlsFiles,
    instance_socket: Option<PathBuf>,
    recovery_inspection: Option<ouroboros_transport::recovery::InspectionConfig>,
    #[serde(default)]
    native_routes: NativeRoutes,
    #[serde(default)]
    workers: std::collections::HashMap<String, String>,
}
#[derive(Clone)]
struct App {
    recovery: Option<ouroboros_transport::recovery::InspectionGate>,
    native_routes: NativeRoutes,
    client: reqwest::Client,
    core: String,
    workers: std::collections::HashMap<String, String>,
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let (mut cfg, root) = ouroboros_transport::config::load::<Config>(&args.config)?;
    cfg.tls.resolve_paths(&root)?;
    cfg.core_client.resolve_paths(&root)?;
    if let Some(path) = cfg.instance_socket.as_mut() {
        root.resolve(path)?;
    }
    if args.recover_instance_socket {
        #[cfg(target_os = "linux")]
        {
            let path = cfg
                .instance_socket
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("instance socket required"))?;
            ouroboros_transport::recover_instance_socket(path).await?;
            println!(
                "{{\"socket_retired\":true,\"listeners_started\":false,\"authority_changed\":false}}"
            );
            return Ok(());
        }
        #[cfg(not(target_os = "linux"))]
        anyhow::bail!("instance socket recovery requires Linux");
    }
    let url = reqwest::Url::parse(&cfg.core_url)?;
    anyhow::ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none()
            && url.path() == "/",
        "invalid fixed Core endpoint"
    );
    for endpoint in cfg.workers.values() {
        let url = reqwest::Url::parse(endpoint)?;
        anyhow::ensure!(
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none(),
            "invalid worker endpoint"
        );
    }
    cfg.native_routes.validate(&cfg.workers)?;
    let recovery = cfg.recovery_inspection.map(|c| c.activate()).transpose()?;
    anyhow::ensure!(
        recovery.is_none()
            || (cfg.instance_socket.is_none()
                && cfg.workers.is_empty()
                && cfg.native_routes.model.is_none()
                && cfg.native_routes.mcp.is_none()),
        "inspection cannot configure instances or resource workers"
    );
    let a = App {
        recovery,
        native_routes: cfg.native_routes,
        client: ouroboros_transport::client(&cfg.core_client)?,
        core: cfg.core_url.trim_end_matches('/').into(),
        workers: cfg
            .workers
            .into_iter()
            .map(|(k, v)| (k, v.trim_end_matches('/').into()))
            .collect(),
    };
    if let Some(path) = cfg.instance_socket {
        #[cfg(target_os = "linux")]
        {
            let unix = ouroboros_transport::serve_instance_socket(
                path,
                Router::new()
                    .fallback(instance_forward)
                    .with_state(a.clone()),
            );
            let human = ouroboros_transport::serve(
                cfg.listen,
                cfg.tls,
                Router::new().fallback(forward).with_state(a),
            );
            tokio::try_join!(unix, human)?;
            return Ok(());
        }
        #[cfg(not(target_os = "linux"))]
        {
            let _ = path;
            anyhow::bail!("instance ingress requires Linux");
        }
    }
    ouroboros_transport::serve(
        cfg.listen,
        cfg.tls,
        Router::new().fallback(forward).with_state(a),
    )
    .await
}
