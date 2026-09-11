use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;

mod service;

#[derive(Parser)]
struct Args {
    #[arg(long)]
    config: PathBuf,
}

#[tokio::main]
async fn main() -> Result<()> {
    service::run(&Args::parse().config).await
}
