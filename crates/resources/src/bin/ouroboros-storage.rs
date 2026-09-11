use clap::{Parser, Subcommand};
use ouroboros_resources::storage::{PrepareConfig, prepare};

#[derive(Parser)]
#[command(about = "Explicit local fixture store maintenance; does not grant runtime authority")]
struct Args {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check an existing store under its owner UID; may latch an observed storage failure.
    Check {
        #[arg(long)]
        binding_file: std::path::PathBuf,
        #[arg(long)]
        firm: uuid::Uuid,
        #[arg(long)]
        store: uuid::Uuid,
        #[arg(long)]
        generation: uuid::Uuid,
    },
    /// Observe an explicitly selected Mac host volume without changing or enrolling it.
    HostCheck {
        #[arg(long)]
        config: std::path::PathBuf,
    },
    /// Bind one existing, empty, private directory using an explicit configuration file.
    Prepare {
        #[arg(long)]
        config: std::path::PathBuf,
    },
}

fn run() -> anyhow::Result<()> {
    match Args::parse().command {
        Command::Check {
            binding_file,
            firm,
            store,
            generation,
        } => {
            anyhow::ensure!(
                binding_file.is_absolute()
                    && !firm.is_nil()
                    && !store.is_nil()
                    && !generation.is_nil(),
                "explicit absolute binding and expected identity required"
            );
            let opened = ouroboros_resources::storage::BoundStore::open(&binding_file)?;
            let observed = opened.identity();
            anyhow::ensure!(
                observed.firm_id == firm
                    && observed.store_id == store
                    && observed.generation == generation,
                "store does not match expected company identity"
            );
            opened.validate()?;
            println!(
                "{}",
                serde_json::json!({"ready":true,"scope":"bound_store_open",
                "firm_id":firm,"store_id":store,"generation":generation,
                "exclusive_writer_checked":true,"catalog_verified":false,"authority_granted":false})
            );
            Ok(())
        }
        Command::HostCheck { config } => {
            let (mut config, base) = ouroboros_transport::config::load::<
                ouroboros_resources::host_storage::Config,
            >(&config)?;
            config.resolve_paths(&base)?;
            let report = ouroboros_resources::host_storage::check(&config)?;
            println!("{report}");
            anyhow::ensure!(report["ready"] == true, "host storage is not ready");
            Ok(())
        }
        Command::Prepare { config } => {
            let (mut config, base) = ouroboros_transport::config::load::<PrepareConfig>(&config)?;
            config.resolve_paths(&base)?;
            let binding = prepare(&config)?;
            println!(
                "{}",
                serde_json::json!({
                    "firm_id": binding.firm_id,
                    "store_id": binding.store_id,
                    "generation": binding.generation,
                    "status": "prepared"
                })
            );
            Ok(())
        }
    }
}

fn main() {
    if run().is_err() {
        eprintln!(
            "storage maintenance failed; inspect the result and verify the explicit configuration and protection"
        );
        std::process::exit(1);
    }
}
