//! Explicit reviewed host maintenance. Never grants application authority or enables boot startup.
#[path = "../service_install.rs"]
mod service_install;
#[path = "../service_manager.rs"]
mod service_manager;
#[path = "../service_render.rs"]
mod service_render;
use anyhow::{Result, ensure};
use clap::Parser;
use service_render::{Bundle, Role, Service, render, render_bundle};
use std::{
    io::{Read, Write},
    path::PathBuf,
};

#[derive(Parser)]
struct Args {
    /// Protected deployment input, containing paths and limits, never credential values.
    #[arg(long, conflicts_with = "bundle", required_unless_present = "bundle")]
    spec: Option<PathBuf>,
    /// Inline service specifications for a whole prepared host; outputs JSON, never installs.
    #[arg(long, conflicts_with = "spec", required_unless_present = "spec")]
    bundle: Option<PathBuf>,
    /// Install reviewed files without reloading or starting services (Linux root only).
    #[arg(long, requires_all = ["bundle", "receipt_directory", "reviewed_sha256"])]
    install_directory: Option<PathBuf>,
    #[arg(long, requires = "install_directory")]
    receipt_directory: Option<PathBuf>,
    #[arg(long, requires = "install_directory")]
    reviewed_sha256: Option<String>,
    /// Reconcile only the original protected installation plan and staged file identities.
    #[arg(long, requires = "install_directory")]
    resume_install: bool,
    /// Observe installed host units and optionally one protected operation; never signals.
    #[arg(long, requires="install_directory", conflicts_with_all=["resume_install","start_phase","stop_phase"])]
    inspect_installed: bool,
    #[arg(long, requires = "inspect_installed")]
    operation: Option<uuid::Uuid>,
    /// Resume an incomplete same-boot control start; never restarts an observed unit or Runtime.
    #[arg(long, requires_all=["install_directory","gateway_client","expected_firm"], conflicts_with_all=["resume_install","inspect_installed","start_phase","stop_phase"])]
    resume_control: Option<uuid::Uuid>,
    /// Restore controls after an incomplete same-boot shutdown, then recheck current Gateway access.
    #[arg(long, requires_all=["install_directory","gateway_client","expected_firm"], conflicts_with_all=["resume_install","inspect_installed","start_phase","stop_phase","resume_control"])]
    restore_control: Option<uuid::Uuid>,
    /// Start an installed phase after verifying its original completion records (Linux root).
    #[arg(long, value_enum, requires_all=["install_directory","gateway_client","expected_firm"], conflicts_with="resume_install")]
    start_phase: Option<service_manager::Phase>,
    /// Stop one installed phase after a separately authorized admission pause.
    #[arg(long, value_enum, requires_all=["install_directory","gateway_client","expected_firm","environment_delegation"], conflicts_with_all=["resume_install","start_phase"])]
    stop_phase: Option<service_manager::Phase>,
    #[arg(long, requires = "stop_phase")]
    environment_delegation: Option<uuid::Uuid>,
    #[arg(long, requires = "install_directory")]
    gateway_client: Option<PathBuf>,
    #[arg(long, requires = "install_directory")]
    expected_firm: Option<uuid::Uuid>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let bundled = args.bundle.is_some();
    let input = args
        .bundle
        .or(args.spec)
        .ok_or_else(|| anyhow::anyhow!("specification required"))?;
    let limit = if bundled { 1024 * 1024 } else { 65536 };
    let mut bytes = Vec::new();
    std::fs::File::open(input)?
        .take(limit + 1)
        .read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= limit,
        "service specification too large"
    );
    if bundled {
        let bundle: Bundle = serde_json::from_slice(&bytes)
            .map_err(|_| anyhow::anyhow!("invalid bundle specification"))?;
        let runtime_names = bundle
            .services
            .iter()
            .filter(|e| e.service.role == Role::Runtime)
            .map(|e| e.name.clone())
            .collect();
        let gateway_config = bundle
            .services
            .iter()
            .find(|e| e.service.role == Role::Gateway)
            .map(|e| e.service.config.clone());
        let report = render_bundle(bundle)?;
        if args.inspect_installed {
            let result = service_manager::inspect(
                &report,
                args.install_directory.as_ref().unwrap(),
                args.receipt_directory.as_ref().unwrap(),
                args.reviewed_sha256.as_ref().unwrap(),
                args.operation,
            )
            .await?;
            println!("{result}");
            return Ok(());
        }
        if let Some(phase) = args
            .start_phase
            .or(args.stop_phase)
            .or(args.resume_control.map(|_| service_manager::Phase::Control))
            .or(args
                .restore_control
                .map(|_| service_manager::Phase::Control))
        {
            let input = service_manager::Start {
                report: &report,
                directory: args.install_directory.as_ref().unwrap(),
                receipts: args.receipt_directory.as_ref().unwrap(),
                reviewed: args.reviewed_sha256.as_ref().unwrap(),
                phase,
                runtime_names,
                gateway_config: gateway_config.unwrap(),
                client_config: args.gateway_client.unwrap(),
                firm: args.expected_firm.unwrap(),
                resume_control: args.resume_control,
                restore_control: args.restore_control,
            };
            let result = if args.stop_phase.is_some() {
                service_manager::stop(input, args.environment_delegation.unwrap()).await?
            } else {
                service_manager::start(input).await?
            };
            println!("{result}");
            return Ok(());
        }
        if let Some(directory) = args.install_directory {
            let result = service_install::install(
                &report,
                &directory,
                &args.receipt_directory.unwrap(),
                &args.reviewed_sha256.unwrap(),
                args.resume_install,
            )?;
            println!("{result}");
        } else {
            println!("{report}");
        }
    } else {
        let service: Service = serde_json::from_slice(&bytes)
            .map_err(|_| anyhow::anyhow!("invalid service specification"))?;
        std::io::stdout().write_all(render(&service)?.as_bytes())?;
    }
    Ok(())
}
