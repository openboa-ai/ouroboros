use clap::Parser;
#[derive(Parser)]
struct Args {
    #[arg(long)]
    database_url_file: std::path::PathBuf,
    #[arg(long,value_parser=["company","catalog","custody"])]
    role: String,
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let a = Args::parse();
    let url = ouroboros_transport::config::postgres_url_file(&a.database_url_file)?;
    let p = sqlx::PgPool::connect(url.trim())
        .await
        .map_err(|_| anyhow::anyhow!("migration DB unavailable"))?;
    if a.role == "company" {
        ouroboros_resources::CompanyWorker::migrate(&p).await?
    } else if a.role == "custody" {
        ouroboros_resources::credential_store::CredentialStore::migrate(&p).await?
    } else {
        ouroboros_resources::CatalogWorker::migrate(&p).await?
    }
    Ok(())
}
