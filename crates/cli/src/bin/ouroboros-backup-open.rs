#[path = "../backup_crypto.rs"]
mod backup_crypto;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    backup_crypto::run(true).await
}
