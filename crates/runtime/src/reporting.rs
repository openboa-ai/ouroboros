//! Durable observations and Core reports. Termination and returned compute never settle external effects.
use anyhow::{Result, ensure};
use ouroboros_contracts::RuntimeTicket;
use serde_json::{Value, json};
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::Path,
    time::Duration,
};
pub(super) async fn send_program_observation(
    client: &reqwest::Client,
    base: &str,
    root: &Path,
    ticket: &RuntimeTicket,
) -> Result<()> {
    let path = root.join("program-observation.json");
    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    ensure!(bytes.len() <= 8192, "program observation bound exceeded");
    let receipt: ouroboros_contracts::RuntimeProgramObservation = serde_json::from_slice(&bytes)?;
    ensure!(
        receipt.instance_id == ticket.instance_id
            && receipt.generation == ticket.generation
            && ticket
                .program
                .as_ref()
                .is_some_and(|p| p.manifest_digest == receipt.manifest_digest),
        "program observation binding mismatch"
    );
    change(
        client,
        base,
        ticket.execution_id,
        "program-result",
        json!(receipt),
    )
    .await
}
pub(super) fn journal(root: &Path, name: &str, value: &Value) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(root.join(name))?;
    serde_json::to_writer(&mut file, value)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    File::open(root)?.sync_all()?;
    Ok(())
}
pub(super) fn record_return_ack(root: &Path) -> Result<()> {
    let expected = json!({"capacity_returned":true,"effects_settled":false});
    match std::fs::read(root.join("compute-return-accepted.json")) {
        Ok(bytes) => ensure!(
            serde_json::from_slice::<Value>(&bytes)? == expected,
            "return acknowledgement conflict"
        ),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            journal(root, "compute-return-accepted.json", &expected)?
        }
        Err(error) => return Err(error.into()),
    }
    Ok(())
}
pub(super) async fn change(
    client: &reqwest::Client,
    base: &str,
    id: uuid::Uuid,
    action: &str,
    body: Value,
) -> Result<()> {
    let response = client
        .post(format!("{base}/runtime/executions/{id}/{action}"))
        .timeout(Duration::from_secs(2))
        .json(&body)
        .send()
        .await?;
    ensure!(
        response.status().is_success(),
        "Core rejected Runtime transition"
    );
    Ok(())
}
