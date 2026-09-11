//! User and instance CLI share the same authenticated Gateway contract.
mod client;
mod command;
mod credential;
mod output;
#[cfg(test)]
mod tests;
use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<std::process::ExitCode> {
    client::execute(command::Args::parse()).await
}
