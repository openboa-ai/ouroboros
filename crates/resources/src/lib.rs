//! Trusted resource workers. No raw SQL, credential or client authorization API.
//! Dispatch authentication and current Core admission must precede calls into these workers.
//! Company effects and file-catalog effects remain separate database transaction boundaries.
use anyhow::Result;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

mod catalog;
mod company;
pub mod storage;

pub use catalog::{
    CatalogWorker, CollectionPreparation, PreparedCollection, PreparedUpload, StoredBlob,
    WorkspaceRecord, validate_path,
};
pub use company::CompanyWorker;
pub use storage::{BlobReader, StagedBlob};

async fn intent_lock(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> Result<()> {
    // A hash collision only serializes unrelated transactions, never equates receipt identities.
    let key = i64::from_be_bytes(id.as_bytes()[..8].try_into()?);
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(key)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub mod credential_envelope;

pub mod credential_store;

pub mod credential_key;

pub mod provider;

mod provider_observation;

pub mod provider_stream;

pub mod host_storage;
