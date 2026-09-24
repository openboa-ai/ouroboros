//! Inventory-bound prepared recovery sets. Never stops or starts a company.
#[path = "../recovery_archive.rs"]
mod recovery_archive;
use anyhow::{Result, ensure};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    Stage {
        #[arg(long)]
        archive: PathBuf,
        #[arg(long)]
        expected_sha256: String,
        #[arg(long)]
        max_bytes: u64,
        #[arg(long)]
        max_entries: usize,
        #[arg(long)]
        staging_directory: PathBuf,
    },
    Create {
        #[arg(long)]
        spec: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
    Verify {
        #[arg(long)]
        archive: PathBuf,
        #[arg(long)]
        expected_sha256: String,
        #[arg(long)]
        max_bytes: u64,
        #[arg(long)]
        max_entries: usize,
    },
}
fn main() -> Result<()> {
    let args = Args::parse();
    let no_core = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    ensure!(
        // SAFETY: no_core is an initialized rlimit borrowed for this synchronous call.
        unsafe { libc::setrlimit(libc::RLIMIT_CORE, &no_core) } == 0,
        "cannot disable core dumps"
    );
    let receipt = match args.command {
        Command::Stage {
            archive,
            expected_sha256,
            max_bytes,
            max_entries,
            staging_directory,
        } => recovery_archive::stage(
            &archive,
            &expected_sha256,
            max_bytes,
            max_entries,
            &staging_directory,
        )?,
        Command::Create { spec, output } => recovery_archive::create(&spec, &output)?,
        Command::Verify {
            archive,
            expected_sha256,
            max_bytes,
            max_entries,
        } => recovery_archive::verify_report(&archive, &expected_sha256, max_bytes, max_entries)?,
    };
    println!("{receipt}");
    Ok(())
}
