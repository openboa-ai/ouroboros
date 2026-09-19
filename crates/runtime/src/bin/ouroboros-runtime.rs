#[cfg(target_os = "linux")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use clap::Parser;
    use ouroboros_runtime::command::Args;
    let args = Args::parse();
    let (mut config, root) =
        ouroboros_transport::config::load::<ouroboros_runtime::manager::Config>(&args.config)?;
    config.resolve_paths(&root)?;
    anyhow::ensure!(
        !(args.require_managed_guard || args.service) || config.managed_guard.is_some(),
        "managed service requires an independent guard; direct-child fallback refused"
    );
    if let Some(intent) = args.inspect_claim {
        return ouroboros_runtime::manager::inspect_claim(config, intent).await;
    }
    if args.service {
        return ouroboros_runtime::manager::service(
            config,
            args.poll_interval_seconds.unwrap_or(2),
        )
        .await;
    }
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
