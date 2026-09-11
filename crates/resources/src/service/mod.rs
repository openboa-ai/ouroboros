//! Resource worker composition. Core remains the only admission authority.
mod admission;
mod bootstrap;
mod catalog;
mod collection;
mod company;
mod custody;
mod effects;
mod files;
mod fixture;
mod provider;
mod recovery;
mod routes;

use anyhow::{Context, Result};
use ouroboros_contracts::ResourceReply;
use ouroboros_resources::{CatalogWorker, CompanyWorker};
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

pub(crate) use bootstrap::run;

struct App {
    client: reqwest::Client,
    core: String,
    gateway: String,
    worker: Worker,
}
enum Worker {
    Company(CompanyWorker),
    Catalog(Arc<CatalogWorker>),
    Fixture(String),
    Provider(Box<ouroboros_resources::provider::ProviderSender>),
    Custody(Box<ouroboros_resources::credential_store::CredentialStore>),
}
fn id(v: &Value, key: &str) -> Result<Uuid> {
    Ok(Uuid::parse_str(
        v.get(key)
            .and_then(Value::as_str)
            .context("missing identity")?,
    )?)
}
fn reply(body: Value, receipt: Value) -> ResourceReply {
    ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: body.to_string(),
        receipt,
    }
}
