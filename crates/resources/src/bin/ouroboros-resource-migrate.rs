use clap::Parser;
#[derive(Parser)]
struct Args {
    #[arg(
        long,
        required_unless_present = "database_url_env",
        conflicts_with = "database_url_env"
    )]
    database_url_file: Option<std::path::PathBuf>,
    #[arg(long, required_unless_present = "database_url_file")]
    database_url_env: Option<String>,
    #[arg(long,value_parser=["company","catalog","custody"])]
    role: String,
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let a = Args::parse();
    let input = match (a.database_url_file, a.database_url_env) {
        (Some(path), None) => ouroboros_transport::config::SecretInput::File(path),
        (None, Some(name)) => ouroboros_transport::config::SecretInput::environment(name),
        _ => anyhow::bail!("exactly one database input required"),
    };
    let url = ouroboros_transport::config::postgres_url(&input)?;
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
