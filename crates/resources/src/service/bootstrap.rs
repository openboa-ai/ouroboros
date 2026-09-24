//! Process startup: resolve injected paths, validate the assigned role, then open only its resources.
use super::{App, Worker};
use anyhow::{Context, Result, ensure};
use ouroboros_resources::{CatalogWorker, CompanyWorker};
use ouroboros_transport::TlsFiles;
use serde::Deserialize;
use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    listen: SocketAddr,
    tls: TlsFiles,
    core_url: String,
    core_client: TlsFiles,
    gateway_fingerprint: String,
    role: String,
    #[serde(alias = "database_url_file")]
    database_url: Option<ouroboros_transport::config::SecretInput>,
    storage_binding_file: Option<PathBuf>,
    fixture_command: Option<String>,
    key_file: Option<PathBuf>,
    provider_ca_file: Option<PathBuf>,
    #[serde(default)]
    provider_managed_versions: bool,
    provider: Option<ouroboros_resources::provider::ProviderBinding>,
    auth_module_host: Option<ouroboros_resources::auth_module::AuthModuleHost>,
}
pub(crate) async fn run(config: &Path) -> Result<()> {
    let (mut cfg, root) = ouroboros_transport::config::load::<Config>(config)?;
    cfg.tls.resolve_paths(&root)?;
    if let Some(host) = cfg.auth_module_host.as_mut() {
        ensure!(
            cfg.role == "provider",
            "auth module host belongs only to protected provider worker"
        );
        root.resolve(&mut host.worker_executable)?;
        root.resolve(&mut host.package_directory)?;
        host.validate()?;
    }
    cfg.core_client.resolve_paths(&root)?;
    if let Some(path) = cfg.database_url.as_mut() {
        path.resolve(&root)?;
    }
    if let Some(path) = cfg.storage_binding_file.as_mut() {
        root.resolve(path)?;
    }
    ensure!(
        !cfg.provider_managed_versions || cfg.role == "provider",
        "managed versions belong only to provider role"
    );
    if let Some(path) = cfg.provider_ca_file.as_mut() {
        root.resolve(path)?;
    }
    if let Some(path) = cfg.key_file.as_mut() {
        root.resolve(path)?;
    }
    ensure!(
        matches!(cfg.role.as_str(), "provider" | "custody-management")
            || (cfg.key_file.is_none() && cfg.provider.is_none() && cfg.provider_ca_file.is_none()),
        "provider custody belongs only to provider worker"
    );
    ensure!(
        matches!(
            cfg.role.as_str(),
            "fixture" | "company" | "catalog" | "provider" | "custody-management"
        ),
        "unknown worker role"
    );
    ensure!(
        match cfg.role.as_str() {
            "fixture" =>
                cfg.fixture_command.is_some()
                    && cfg.database_url.is_none()
                    && cfg.storage_binding_file.is_none(),
            "company" =>
                cfg.fixture_command.is_none()
                    && cfg.database_url.is_some()
                    && cfg.storage_binding_file.is_none(),
            "provider" =>
                cfg.fixture_command.is_none()
                    && cfg.database_url.is_some()
                    && cfg.storage_binding_file.is_none()
                    && cfg.key_file.is_some()
                    && cfg.provider.is_some(),
            "custody-management" =>
                cfg.fixture_command.is_none()
                    && cfg.database_url.is_some()
                    && cfg.storage_binding_file.is_none()
                    && cfg.key_file.is_some()
                    && cfg.provider.is_none()
                    && cfg.provider_ca_file.is_none(),
            "catalog" =>
                cfg.fixture_command.is_none()
                    && cfg.database_url.is_some()
                    && cfg.storage_binding_file.is_some(),
            _ => false,
        },
        "worker configuration does not match assigned role"
    );
    let url = reqwest::Url::parse(&cfg.core_url)?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.path() == "/"
            && url.query().is_none()
            && url.fragment().is_none(),
        "fixed Core required"
    );
    let store = cfg
        .storage_binding_file
        .as_deref()
        .map(ouroboros_resources::storage::BoundStore::open)
        .transpose()?;
    let client = ouroboros_transport::client(&cfg.core_client)?;
    let worker = if cfg.role == "fixture" {
        ensure!(
            cfg.database_url.is_none() && cfg.storage_binding_file.is_none(),
            "fixture holds no DB or artifact authority"
        );
        Worker::Fixture(
            cfg.fixture_command
                .context("explicit fixture command required")?,
        )
    } else {
        let url = ouroboros_transport::config::postgres_url(
            &cfg.database_url.context("worker DB required")?,
        )?;
        let db = sqlx::postgres::PgPoolOptions::new()
            .max_connections(4)
            .acquire_timeout(Duration::from_secs(2))
            .connect(url.trim())
            .await
            .map_err(|_| anyhow::anyhow!("resource database unavailable"))?;
        match cfg.role.as_str() {
            "custody-management" => {
                let key = ouroboros_resources::credential_key::load_key(
                    cfg.key_file
                        .as_deref()
                        .context("custody key input required")?,
                )?;
                Worker::Custody(Box::new(
                    ouroboros_resources::credential_store::CredentialStore::new(db, key).await?,
                ))
            }
            "provider" => {
                let key = ouroboros_resources::credential_key::load_key(
                    cfg.key_file
                        .as_deref()
                        .context("provider key input required")?,
                )?;
                let custody =
                    ouroboros_resources::credential_store::CredentialStore::open_consumer(db, key)
                        .await?;
                let trust = cfg
                    .provider_ca_file
                    .as_deref()
                    .map(|p| ouroboros_transport::config::read_regular(p, 65536))
                    .transpose()?;
                Worker::Provider(Box::new(
                    ouroboros_resources::provider::ProviderSender::with_trust_root(
                        cfg.provider.context("provider binding required")?,
                        custody,
                        trust.as_deref(),
                    )?
                    .with_managed_versions(cfg.provider_managed_versions)
                    .with_auth_module_host(cfg.auth_module_host)?,
                ))
            }
            "company" => {
                ensure!(
                    cfg.storage_binding_file.is_none(),
                    "company worker holds no artifact authority"
                );
                Worker::Company(CompanyWorker::new(db))
            }
            "catalog" => Worker::Catalog(Arc::new(
                CatalogWorker::new(db, store.context("storage binding required")?).await?,
            )),
            _ => anyhow::bail!("unknown worker role"),
        }
    };
    let app = Arc::new(App {
        client,
        core: cfg.core_url.trim_end_matches('/').into(),
        gateway: cfg.gateway_fingerprint,
        worker,
    });
    ouroboros_transport::serve(cfg.listen, cfg.tls, super::routes::router(app)).await
}
