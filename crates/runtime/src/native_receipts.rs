//! Persist observed native responses; recovery can report them, never resend commands.
use anyhow::{Result, ensure};
use ouroboros_contracts::{NativeControlAck, NativeControlTicket};
use std::{
    fs::{File, OpenOptions},
    io::Write,
    os::unix::fs::OpenOptionsExt,
    path::Path,
};
use uuid::Uuid;

pub(crate) fn save(
    root: &Path,
    ticket: &NativeControlTicket,
    ack: &NativeControlAck,
) -> Result<()> {
    ensure!(
        ack.attempt_id == ticket.attempt_id && ack.native_request_id > 0,
        "native receipt identity mismatch"
    );
    persist(
        root,
        &format!("native-ack-{}.json", ticket.intent_id),
        &serde_json::to_value(ack)?,
    )
}

fn persist(root: &Path, name: &str, value: &serde_json::Value) -> Result<()> {
    let target = root.join(name);
    if target.exists() {
        ensure!(
            serde_json::from_slice::<serde_json::Value>(&std::fs::read(target)?)? == *value,
            "native receipt conflict"
        );
        return Ok(());
    }
    let temporary = root.join(format!(".native-receipt-{}.tmp", Uuid::new_v4()));
    let result = (|| -> Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)?;
        serde_json::to_writer(&mut file, value)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        std::fs::hard_link(&temporary, &target)?;
        File::open(root)?.sync_all()?;
        Ok(())
    })();
    let _ = std::fs::remove_file(&temporary);
    result
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct TerminalReceipt {
    execution_id: Uuid,
    report: ouroboros_contracts::NativeTurnReport,
}
fn terminal_valid(report: &ouroboros_contracts::NativeTurnReport) -> bool {
    matches!(
        report.status.as_str(),
        "completed" | "interrupted" | "failed"
    ) && [&report.thread_id, &report.turn_id]
        .iter()
        .all(|id| !id.is_empty() && id.len() <= 512 && !id.chars().any(char::is_control))
}
pub(crate) fn save_terminal(
    root: &Path,
    execution: Uuid,
    report: &ouroboros_contracts::NativeTurnReport,
) -> Result<()> {
    ensure!(terminal_valid(report), "not a valid terminal observation");
    persist(
        root,
        "native-terminal.json",
        &serde_json::to_value(TerminalReceipt {
            execution_id: execution,
            report: report.clone(),
        })?,
    )
}
pub(crate) fn load_terminal(
    root: &Path,
    execution: Uuid,
) -> Result<Option<ouroboros_contracts::NativeTurnReport>> {
    let bytes = match std::fs::read(root.join("native-terminal.json")) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let receipt: TerminalReceipt = serde_json::from_slice(&bytes)?;
    ensure!(
        receipt.execution_id == execution && terminal_valid(&receipt.report),
        "native terminal identity mismatch"
    );
    Ok(Some(receipt.report))
}

pub(crate) fn load(
    root: &Path,
    execution: Uuid,
    instance: Uuid,
    generation: Uuid,
) -> Result<Vec<(Uuid, NativeControlAck)>> {
    let mut receipts = Vec::new();
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        let Some(id) = name
            .strip_prefix("native-ack-")
            .and_then(|s| s.strip_suffix(".json"))
        else {
            continue;
        };
        let intent = Uuid::parse_str(id)?;
        let ticket: NativeControlTicket = serde_json::from_slice(&std::fs::read(
            root.join(format!("native-control-{intent}.json")),
        )?)?;
        let ack: NativeControlAck = serde_json::from_slice(&std::fs::read(entry.path())?)?;
        ensure!(
            ticket.intent_id == intent
                && ticket.execution_id == execution
                && ticket.instance_id == instance
                && ticket.generation == generation
                && ticket.attempt_id == ack.attempt_id
                && ack.native_request_id > 0,
            "native recovery identity mismatch"
        );
        receipts.push((intent, ack));
    }
    receipts.sort_by_key(|(id, _)| *id);
    Ok(receipts)
}

pub(crate) async fn report(
    client: &reqwest::Client,
    base: &str,
    intent: Uuid,
    ack: &NativeControlAck,
) -> Result<()> {
    client
        .post(format!("{base}/runtime/native-controls/{intent}/ack"))
        .json(ack)
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await?
        .error_for_status()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_observed_terminal_can_be_recovered() -> Result<()> {
        let root = std::env::temp_dir().join(format!("ouro-terminal-{}", Uuid::new_v4()));
        std::fs::create_dir(&root)?;
        let execution = Uuid::new_v4();
        assert!(load_terminal(&root, execution)?.is_none());
        let mut report = ouroboros_contracts::NativeTurnReport {
            thread_id: "thread".into(),
            turn_id: "turn".into(),
            status: "inProgress".into(),
        };
        assert!(save_terminal(&root, execution, &report).is_err());
        report.status = "interrupted".into();
        save_terminal(&root, execution, &report)?;
        save_terminal(&root, execution, &report)?;
        assert_eq!(load_terminal(&root, execution)?, Some(report.clone()));
        assert!(load_terminal(&root, Uuid::new_v4()).is_err());
        report.status = "completed".into();
        assert!(save_terminal(&root, execution, &report).is_err());
        assert_eq!(
            load_terminal(&root, execution)?.unwrap().status,
            "interrupted"
        );
        std::fs::remove_dir_all(root)?;
        Ok(())
    }
    #[tokio::test]
    async fn failed_report_retries_only_receipt_endpoint() -> Result<()> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let base = format!("http://{}", listener.local_addr()?);
        let intent = Uuid::new_v4();
        let expected = format!("POST /runtime/native-controls/{intent}/ack HTTP/1.1");
        let peer = tokio::spawn(async move {
            for status in ["503 Service Unavailable", "200 OK"] {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut bytes = vec![0; 4096];
                let count = socket.read(&mut bytes).await.unwrap();
                assert!(String::from_utf8_lossy(&bytes[..count]).starts_with(&expected));
                socket
                    .write_all(
                        format!(
                            "HTTP/1.1 {status}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                        )
                        .as_bytes(),
                    )
                    .await
                    .unwrap();
            }
        });
        let ack = NativeControlAck {
            attempt_id: Uuid::new_v4(),
            native_request_id: 9,
            accepted: true,
        };
        let client = reqwest::Client::new();
        assert!(report(&client, &base, intent, &ack).await.is_err());
        report(&client, &base, intent, &ack).await?;
        tokio::time::timeout(std::time::Duration::from_secs(3), peer).await??;
        Ok(())
    }
    #[test]
    fn observed_only_recovery_and_identity_checks() -> Result<()> {
        let root = std::env::temp_dir().join(format!("ouro-native-{}", Uuid::new_v4()));
        std::fs::create_dir(&root)?;
        let ticket = NativeControlTicket {
            intent_id: Uuid::new_v4(),
            attempt_id: Uuid::new_v4(),
            execution_id: Uuid::new_v4(),
            instance_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            request: ouroboros_contracts::NativeControlRequest {
                delegation_id: Uuid::new_v4(),
                thread_id: "thread".into(),
                turn_id: "turn".into(),
                instruction: ouroboros_contracts::NativeInstruction::Interrupt,
            },
        };
        std::fs::write(
            root.join(format!("native-control-{}.json", ticket.intent_id)),
            serde_json::to_vec(&ticket)?,
        )?;
        // A claimed command and an incomplete write prove no response.
        std::fs::write(root.join(".native-ack-incomplete.tmp"), b"{")?;
        assert!(
            load(
                &root,
                ticket.execution_id,
                ticket.instance_id,
                ticket.generation
            )?
            .is_empty()
        );
        let ack = NativeControlAck {
            attempt_id: ticket.attempt_id,
            native_request_id: 7,
            accepted: true,
        };
        save(&root, &ticket, &ack)?;
        save(&root, &ticket, &ack)?;
        assert_eq!(
            load(
                &root,
                ticket.execution_id,
                ticket.instance_id,
                ticket.generation
            )?,
            vec![(ticket.intent_id, ack.clone())]
        );
        assert!(
            load(
                &root,
                ticket.execution_id,
                Uuid::new_v4(),
                ticket.generation
            )
            .is_err()
        );
        let contradictory = NativeControlAck {
            accepted: false,
            ..ack.clone()
        };
        assert!(save(&root, &ticket, &contradictory).is_err());
        assert_eq!(
            load(
                &root,
                ticket.execution_id,
                ticket.instance_id,
                ticket.generation
            )?,
            vec![(ticket.intent_id, ack)]
        );
        std::fs::remove_dir_all(root)?;
        Ok(())
    }
}
