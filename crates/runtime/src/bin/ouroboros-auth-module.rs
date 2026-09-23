//! Fixed protected worker/installer. It never accepts a host executable from a package.
use anyhow::{Result, ensure};
use clap::{Parser, Subcommand};
use std::{fs::OpenOptions, io::Write, os::unix::fs::OpenOptionsExt, path::PathBuf};

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    Worker,
    Install {
        #[arg(long)]
        package: PathBuf,
        #[arg(long)]
        directory: PathBuf,
    },
}
fn run() -> Result<()> {
    match Args::parse().command {
        Command::Worker => ouroboros_runtime::auth_module::run(
            &mut std::io::stdin().lock(),
            &mut std::io::stdout().lock(),
        ),
        Command::Install { package, directory } => {
            let bytes = ouroboros_transport::config::read_regular(&package, 140_000)?;
            let package: ouroboros_contracts::auth_module::AuthModulePackage =
                serde_json::from_slice(&bytes)?;
            package.decode()?;
            let meta = std::fs::symlink_metadata(&directory)?;
            ensure!(
                meta.is_dir() && !meta.file_type().is_symlink(),
                "explicit package directory required"
            );
            let path = directory.join(format!("{}.json", package.selection.wasm_sha256));
            let staging = directory.join(format!(".install-{}", uuid::Uuid::new_v4()));
            let written = (|| -> Result<()> {
                let mut file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .mode(0o600)
                    .custom_flags(libc::O_NOFOLLOW)
                    .open(&staging)?;
                file.write_all(&serde_json::to_vec(&package)?)?;
                file.sync_all()?;
                // Atomic no-replace publication; an interrupted write cannot occupy the digest.
                std::fs::hard_link(&staging, &path)?;
                Ok(())
            })();
            let _ = std::fs::remove_file(&staging);
            written?;
            std::fs::File::open(&directory)?.sync_all()?;
            println!("{}", serde_json::to_string(&package.selection)?);
            Ok(())
        }
    }
}
fn main() {
    if run().is_err() {
        // Module traps, offsets, parser errors and secret-bearing output never become logs.
        eprintln!("protected authentication operation failed");
        std::process::exit(1);
    }
}
