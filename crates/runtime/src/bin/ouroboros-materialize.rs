//! Fixed helper for the contained, pre-payload materialization phase.
#[cfg(target_os = "linux")]
#[tokio::main(flavor = "current_thread")]
async fn main() {
    if run().await.is_err() {
        // Do not echo descriptor data, an HTTP response, or an input path on failure.
        eprintln!("contained input materialization failed");
        std::process::exit(1);
    }
}

#[cfg(target_os = "linux")]
async fn run() -> anyhow::Result<()> {
    use anyhow::ensure;
    use std::io::Write;
    ensure!(
        std::env::args_os().len() == 1,
        "materializer accepts no arguments"
    );
    let descriptor = ouroboros_runtime::materialize::read_descriptor(std::io::stdin().lock())?;
    let receipt = ouroboros_runtime::materialize::materialize(descriptor).await?;
    let mut bytes = serde_json::to_vec(&receipt)?;
    ensure!(
        bytes.len() < ouroboros_runtime::materialize::DESCRIPTOR_LIMIT,
        "receipt exceeds bound"
    );
    bytes.push(b'\n');
    let mut stdout = std::io::stdout().lock();
    stdout.write_all(&bytes)?;
    stdout.flush()?;
    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("Contained input materialization requires Linux");
    std::process::exit(78);
}
