use clap::Parser;
#[derive(Parser)]
struct Args {
    #[arg(long)]
    database_url_file: std::path::PathBuf,
}
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let url = ouroboros_transport::config::postgres_url_file(&Args::parse().database_url_file)?;
    let pool = sqlx::PgPool::connect(url.trim())
        .await
        .map_err(|_| anyhow::anyhow!("maintenance database unavailable"))?;
    ouroboros_core::Core::migrate(&pool).await?;
    println!("control migrations applied");
    Ok(())
}
