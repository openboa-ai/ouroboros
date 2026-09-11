//! Bounded native-state capture candidate. Captured private bytes are not authority.
use anyhow::{Context, Result, ensure};
use bollard::{Docker, container::LogOutput, exec::StartExecResults, models::ExecConfig};
use futures_util::StreamExt;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::Path,
};
const LIMIT: usize = 4 * 1024 * 1024;

fn selected_path(thread: &str, path: &str) -> Result<()> {
    let id = uuid::Uuid::parse_str(thread)?;
    ensure!(id.to_string() == thread, "noncanonical native thread");
    let relative = path
        .strip_prefix("/home/agent/.codex/sessions/")
        .context("native state outside session directory")?;
    let parts: Vec<_> = relative.split('/').collect();
    ensure!(
        parts.len() == 4
            && parts[..3]
                .iter()
                .zip([4, 2, 2])
                .all(|(p, n)| p.len() == n && p.bytes().all(|b| b.is_ascii_digit())),
        "invalid native session layout"
    );
    ensure!(
        parts[3].starts_with("rollout-")
            && parts[3].ends_with(&format!("-{thread}.jsonl"))
            && !parts[3].contains("..")
            && parts[3]
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b)),
        "invalid native state name"
    );
    Ok(())
}
fn validate(thread: &str, bytes: &[u8]) -> Result<()> {
    ensure!(
        !bytes.is_empty() && bytes.len() <= LIMIT && bytes.last() == Some(&b'\n'),
        "incomplete or oversized native state"
    );
    let mut count = 0;
    for line in bytes.split(|b| *b == b'\n').filter(|line| !line.is_empty()) {
        ensure!(line.len() <= 1_048_576, "native state record exceeds bound");
        let value: Value = serde_json::from_slice(line)?;
        ensure!(value.is_object(), "invalid native record");
        if count == 0 {
            ensure!(
                value["type"] == "session_meta" && value["payload"]["id"] == thread,
                "native checkpoint identity mismatch"
            );
        } else {
            ensure!(value["type"] != "session_meta", "multiple native sessions");
        }
        count += 1;
    }
    ensure!(count > 1, "empty native session");
    Ok(())
}
async fn read_private_file(docker: &Docker, cid: &str, path: &str) -> Result<Vec<u8>> {
    let exec = docker
        .create_exec(
            cid,
            ExecConfig {
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                user: Some("65532:65532".into()),
                cmd: Some(vec![
                    "/bin/head".into(),
                    "-c".into(),
                    (LIMIT + 1).to_string(),
                    path.into(),
                ]),
                privileged: Some(false),
                ..Default::default()
            },
        )
        .await?;
    let StartExecResults::Attached { mut output, .. } = docker.start_exec(&exec.id, None).await?
    else {
        anyhow::bail!("native state stream missing")
    };
    let mut bytes = Vec::new();
    while let Some(chunk) = output.next().await {
        match chunk? {
            LogOutput::StdOut { message } => {
                ensure!(
                    bytes.len() + message.len() <= LIMIT,
                    "native state exceeds bound"
                );
                bytes.extend_from_slice(&message);
            }
            LogOutput::StdErr { message } => {
                ensure!(message.is_empty(), "native state read failed")
            }
            _ => anyhow::bail!("unexpected native state stream"),
        }
    }
    ensure!(
        docker.inspect_exec(&exec.id).await?.exit_code == Some(0),
        "native state reader did not complete"
    );
    Ok(bytes)
}

fn verify_restore(thread: &str, size: u64, digest: &str, bytes: &[u8]) -> Result<()> {
    ensure!(
        bytes.len() as u64 == size && hex::encode(Sha256::digest(bytes)) == digest,
        "checkpoint no longer matches admitted bytes"
    );
    validate(thread, bytes)
}

pub(crate) async fn restore(
    docker: &Docker,
    cid: &str,
    root: &Path,
    ticket: &ouroboros_contracts::RuntimeTicket,
) -> Result<()> {
    use tokio::io::AsyncWriteExt;
    let request = ticket
        .input
        .program
        .as_ref()
        .context("native request missing")?;
    let resume = request
        .native
        .as_ref()
        .and_then(|n| n.resume.as_ref())
        .context("native resume missing")?;
    let input = ticket
        .program
        .as_ref()
        .context("native input ticket missing")?
        .inputs
        .iter()
        .find(|i| i.reference.destination == resume.checkpoint_destination)
        .context("checkpoint input not admitted")?;
    ensure!(
        ouroboros_contracts::program_path(&input.reference.destination),
        "invalid checkpoint source"
    );
    let bytes = read_private_file(
        docker,
        cid,
        &format!("/workspace/{}", input.reference.destination),
    )
    .await?;
    let thread = resume.thread_id.to_string();
    verify_restore(&thread, input.size, &input.sha256, &bytes)?;
    let destination = format!(
        "/home/agent/.codex/sessions/1970/01/01/rollout-1970-01-01T00-00-00-{thread}.jsonl"
    );
    selected_path(&thread, &destination)?;
    // No private payload has started. All home directories are fresh; refuse any existing home state.
    let exec=docker.create_exec(cid,ExecConfig {attach_stdin:Some(true),attach_stdout:Some(true),attach_stderr:Some(true),user:Some("65532:65532".into()),cmd:Some(vec!["/bin/sh".into(),"-c".into(),"set -eu; umask 077; test ! -e /home/agent/.codex; mkdir -p /home/agent/.codex/sessions/1970/01/01; set -C; cat > \"$1\"".into(),"native-state-install".into(),destination.clone()]),privileged:Some(false),..Default::default()}).await?;
    let StartExecResults::Attached {
        mut output,
        input: mut stream,
    } = docker.start_exec(&exec.id, None).await?
    else {
        anyhow::bail!("native installation channel missing")
    };
    stream.write_all(&bytes).await?;
    stream.shutdown().await?;
    drop(stream);
    while let Some(chunk) = output.next().await {
        match chunk? {
            LogOutput::StdOut { message } | LogOutput::StdErr { message } => {
                ensure!(message.is_empty(), "native state install failed")
            }
            _ => anyhow::bail!("unexpected native install stream"),
        };
    }
    ensure!(
        docker.inspect_exec(&exec.id).await?.exit_code == Some(0),
        "native state install did not complete"
    );
    ensure!(
        read_private_file(docker, cid, &destination).await? == bytes,
        "installed native state differs"
    );
    let record = json!({"execution_id":ticket.execution_id,"instance_id":ticket.instance_id,"generation":ticket.generation,"thread_id":thread,"input_index":input.index,"sha256":input.sha256,"bytes":input.size,"installed":true});
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(root.join("native-restore.json"))?;
    serde_json::to_writer(&mut file, &record)?;
    file.sync_all()?;
    File::open(root)?.sync_all()?;
    Ok(())
}

pub(crate) async fn capture(
    docker: &Docker,
    cid: &str,
    root: &Path,
    execution: uuid::Uuid,
    thread: &Value,
    terminal: &str,
) -> Result<()> {
    let id = thread["id"].as_str().context("native thread missing")?;
    let path = thread["path"]
        .as_str()
        .context("native persisted path missing")?;
    selected_path(id, path)?;
    let bytes = read_private_file(docker, cid, path).await?;
    validate(id, &bytes)?;
    let manifest = json!({"execution_id":execution,"thread_id":id,"session_id":thread.get("sessionId"),"source_path":path,"observed_terminal":terminal,"sha256":hex::encode(Sha256::digest(&bytes)),"bytes":bytes.len(),"source":"private_native_state","resume_qualified":false});
    for (name, data) in [
        ("native-checkpoint.jsonl", bytes),
        ("native-checkpoint.json", serde_json::to_vec(&manifest)?),
    ] {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(root.join(name))?;
        file.write_all(&data)?;
        file.sync_all()?;
    }
    File::open(root)?.sync_all()?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restored_bytes_require_both_admitted_digest_and_native_identity() {
        let thread = uuid::Uuid::new_v4().to_string();
        let bytes = format!(
            "{}\n{}\n",
            json!({"type":"session_meta","payload":{"id":thread}}),
            json!({"type":"event_msg","payload":{}})
        )
        .into_bytes();
        let digest = hex::encode(Sha256::digest(&bytes));
        assert!(verify_restore(&thread, bytes.len() as u64, &digest, &bytes).is_ok());
        assert!(verify_restore(&thread, bytes.len() as u64 + 1, &digest, &bytes).is_err());
        assert!(verify_restore(&thread, bytes.len() as u64, &"0".repeat(64), &bytes).is_err());
        assert!(
            verify_restore(
                &uuid::Uuid::new_v4().to_string(),
                bytes.len() as u64,
                &digest,
                &bytes
            )
            .is_err()
        );
    }
    #[test]
    fn selected_state_is_bounded_and_not_arbitrary_home() {
        let id = uuid::Uuid::new_v4().to_string();
        let path = format!(
            "/home/agent/.codex/sessions/2026/09/10/rollout-2026-09-10T14-02-19-{id}.jsonl"
        );
        assert!(selected_path(&id, &path).is_ok());
        for bad in [
            path.replace("/sessions/", "/../sessions/"),
            path.replace("2026/09/10", "2026/../10"),
            "/home/agent/.codex/auth.json".into(),
        ] {
            assert!(selected_path(&id, &bad).is_err());
        }
        let data = format!(
            "{}\n{}\n",
            json!({"type":"session_meta","payload":{"id":id}}),
            json!({"type":"event_msg","payload":{}})
        );
        assert!(validate(&id, data.as_bytes()).is_ok());
        assert!(validate(&uuid::Uuid::new_v4().to_string(), data.as_bytes()).is_err());
        assert!(validate(&id, data.trim_end().as_bytes()).is_err());
        assert!(validate(&id, format!("{data}{data}").as_bytes()).is_err());
    }
}
