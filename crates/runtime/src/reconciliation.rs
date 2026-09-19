//! Stop-only recovery of a recorded instance. This path cannot claim or release a successor.
use super::{
    docker_backend::{connect_docker, docker_binding},
    manager::{Config, recover_pending_claim, supervisor_lock},
    reporting::{change, journal, record_return_ack, send_program_observation},
};
use anyhow::{Result, ensure};
use ouroboros_contracts::{ComputeReturnReceipt, RuntimeBinding, RuntimeTicket};
use serde_json::{Value, json};
use std::time::Duration;
/// Re-observe one original binding. Never starts an instance or releases a reservation.
pub async fn reconcile(cfg: Config, instance: uuid::Uuid) -> Result<()> {
    let _slot = supervisor_lock(&cfg.evidence_dir)?;
    ensure!(
        unsafe { libc::geteuid() } == 0,
        "trusted Runtime identity required"
    );
    cfg.profile.validate()?;
    let root = cfg.evidence_dir.join(instance.to_string());
    let record: Value = serde_json::from_slice(&std::fs::read(root.join("intent.json"))?)?;
    ensure!(
        record["profile"] == json!(cfg.profile)
            && record
                .get("program_profile")
                .unwrap_or(&serde_json::Value::Null)
                == &json!(cfg.program),
        "recovery backend profile changed"
    );
    let ticket: RuntimeTicket = serde_json::from_value(record["ticket"].clone())?;
    ensure!(ticket.instance_id == instance, "journal identity mismatch");
    super::program::validate_ticket(&cfg.profile, cfg.program.as_ref(), &ticket)?;
    let binding: RuntimeBinding =
        serde_json::from_slice(&std::fs::read(root.join("binding.json"))?)?;
    let client = ouroboros_transport::client(&cfg.tls)?;
    let base = cfg.core_url.trim_end_matches('/');
    let current: Value = client
        .get(format!("{base}/runtime/history/{}", ticket.execution_id))
        .timeout(Duration::from_secs(2))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    ensure!(
        current["binding"] == json!(binding)
            && current["instance_id"] == json!(instance)
            && current["generation"] == json!(ticket.generation),
        "Core and local evidence disagree"
    );
    let backend = docker_binding(&cfg)?;
    backend.probe().await?;
    let docker = connect_docker(&backend)?;
    let actual = docker
        .inspect_container(&binding.container_id, None)
        .await?;
    let label = actual
        .config
        .as_ref()
        .and_then(|c| c.labels.as_ref())
        .and_then(|l| l.get("ouroboros.instance"));
    ensure!(
        label == Some(&instance.to_string())
            && actual.id.as_deref() == Some(binding.container_id.as_str()),
        "backend identity mismatch"
    );
    // Stop-only recovery against the exact original Docker ID, even if its ordinary grant expired.
    if actual.state.as_ref().and_then(|s| s.running) == Some(true) {
        backend.probe().await?;
        docker.kill_container(&binding.container_id, None).await?;
    }
    let actual = docker
        .inspect_container(&binding.container_id, None)
        .await?;
    ensure!(
        actual.state.as_ref().and_then(|s| s.running) == Some(false),
        "termination remains unresolved"
    );
    let guard_observation = super::guard_process::observe_recorded(
        &root,
        instance,
        ticket.generation,
        binding.deadline_boottime_ns,
        cfg.guard_uid,
    )?;
    // Evidence precedes reporting; duplicate recovery records remain independently attributable.
    journal(
        &root,
        &format!("reconciliation-{}.json", uuid::Uuid::new_v4()),
        &json!({"container_id":binding.container_id,"source":"runtime_backend","terminated":true,"guard":guard_observation,"effects_settled":false}),
    )?;
    change(&client, base, ticket.execution_id, "terminated", json!({})).await?;
    send_program_observation(&client, base, &root, &ticket).await?;
    // Replay a saved request, or use independently retained original guard closure evidence.
    // A stopped container alone never authorizes reconstruction.
    match std::fs::read(root.join("compute-return.json")) {
        Ok(bytes) => {
            let receipt: ComputeReturnReceipt = serde_json::from_slice(&bytes)?;
            ensure!(
                receipt.instance_id == instance
                    && receipt.generation == ticket.generation
                    && receipt.binding == binding,
                "saved return identity mismatch"
            );
            change(
                &client,
                base,
                ticket.execution_id,
                "compute-return",
                json!(receipt),
            )
            .await?;
            record_return_ack(&root)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            if let Some(cgroup) =
                super::guard_process::recover_closure(&root, &binding, &guard_observation)?
            {
                let receipt = ComputeReturnReceipt {
                    instance_id: instance,
                    generation: ticket.generation,
                    binding: binding.clone(),
                    cgroup,
                    container_terminated: true,
                    bridge_terminated: true,
                    guard_terminated: true,
                };
                journal(&root, "compute-return.json", &json!(receipt))?;
                change(
                    &client,
                    base,
                    ticket.execution_id,
                    "compute-return",
                    json!(receipt),
                )
                .await?;
                record_return_ack(&root)?;
            }
        }
        Err(error) => return Err(error.into()),
    }
    if let Some(report) = super::native_receipts::load_terminal(&root, ticket.execution_id)? {
        change(
            &client,
            base,
            ticket.execution_id,
            "native-turn",
            json!(report),
        )
        .await?;
    }
    for (intent, ack) in
        super::native_receipts::load(&root, ticket.execution_id, instance, ticket.generation)?
    {
        super::native_receipts::report(&client, base, intent, &ack).await?;
    }
    // A successful stop report alone is insufficient: this clears only a returned original claim.
    if super::claim_journal::pending(&cfg.evidence_dir)?
        .is_some_and(|pending| pending.context.intent_id == ticket.intent_id)
    {
        recover_pending_claim(&cfg).await?;
    }
    println!(
        "{}",
        json!({"instance_id":instance,"terminated":true,"guard":guard_observation,"effects_settled":false,"new_execution":false})
    );
    Ok(())
}
