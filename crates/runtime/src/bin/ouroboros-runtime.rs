#[cfg(target_os = "linux")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use clap::Parser;
    #[derive(Parser)]
    struct Args {
        #[arg(long)]
        config: std::path::PathBuf,
        #[arg(long)]
        require_managed_guard: bool,
        #[arg(long, conflicts_with = "max_executions")]
        reconcile: Option<uuid::Uuid>,
        #[arg(long, value_parser = clap::value_parser!(u16).range(1..=100))]
        max_executions: Option<u16>,
        #[arg(long, requires = "max_executions", value_parser = clap::value_parser!(u16).range(1..=300))]
        idle_timeout_seconds: Option<u16>,
    }
    let args = Args::parse();
    let (mut config, root) =
        ouroboros_transport::config::load::<ouroboros_runtime::manager::Config>(&args.config)?;
    config.resolve_paths(&root)?;
    anyhow::ensure!(
        !args.require_managed_guard || config.managed_guard.is_some(),
        "managed service requires an independent guard; direct-child fallback refused"
    );
    match args.reconcile {
        Some(instance) => ouroboros_runtime::manager::reconcile(config, instance).await,
        None => match args.max_executions {
            Some(limit) => {
                ouroboros_runtime::manager::serve(
                    config,
                    limit,
                    args.idle_timeout_seconds.unwrap_or(30),
                )
                .await
            }
            None => ouroboros_runtime::manager::run(config).await,
        },
    }
}
#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("Runtime Manager requires the dedicated Linux backend");
    std::process::exit(78);
}
