//! One operation-only enrollment transfer. Secrets never enter command arguments or rendered responses.
use crate::client::resource_scope;
use serde_json::{Value, json};
pub(crate) async fn transfer(
    client: &reqwest::Client,
    base: &str,
    instance: bool,
    intent: uuid::Uuid,
    work: uuid::Uuid,
    delegation: uuid::Uuid,
) -> anyhow::Result<Value> {
    use std::io::{IsTerminal, Read};
    anyhow::ensure!(
        !instance,
        "credential input requires the external authenticated CLI"
    );
    anyhow::ensure!(
        !std::io::stdin().is_terminal(),
        "credential input requires a private pipe; terminal echo is not supported"
    );
    let mut secret = zeroize::Zeroizing::new(Vec::with_capacity(16385));
    std::io::stdin()
        .lock()
        .take(16385)
        .read_to_end(&mut secret)
        .map_err(|_| anyhow::anyhow!("credential input failed"))?;
    anyhow::ensure!(
        !secret.is_empty() && secret.len() <= 16384,
        "credential input size invalid"
    );
    // Bytes retains this owner until the HTTP stack releases it; the owner is zeroized.
    struct SecretBody(zeroize::Zeroizing<Vec<u8>>);
    impl AsRef<[u8]> for SecretBody {
        fn as_ref(&self) -> &[u8] {
            self.0.as_slice()
        }
    }
    let payload = bytes::Bytes::from_owner(SecretBody(secret));
    let operation = async {
        let mut result = resource_scope(
            client.put(format!("{base}/credential-enrollments/{intent}/secret")),
            Some(work),
            Some(delegation),
            None,
        )
        .header("content-type", "application/octet-stream")
        .body(payload)
        .send()
        .await
        .map_err(|_| {
            anyhow::anyhow!(
                "credential transfer unresolved; inspect the original intent before further action"
            )
        })?;
        anyhow::ensure!(
            result.status().is_success(),
            "credential transfer not confirmed; inspect the original intent before further action"
        );
        let mut bytes = Vec::new();
        while let Some(chunk) = result
            .chunk()
            .await
            .map_err(|_| anyhow::anyhow!("credential receipt unavailable"))?
        {
            anyhow::ensure!(
                bytes.len() + chunk.len() <= 8192,
                "credential receipt exceeds bound"
            );
            bytes.extend_from_slice(&chunk);
        }
        enrollment_receipt(&bytes, intent)
    };
    tokio::time::timeout(std::time::Duration::from_secs(20), operation)
        .await
        .map_err(|_| {
            anyhow::anyhow!(
                "credential transfer unresolved; inspect the original intent before further action"
            )
        })?
}

/// Render only receipt identifiers. Even a peer response containing extra secret fields is not echoed.
fn enrollment_receipt(bytes: &[u8], intent: uuid::Uuid) -> anyhow::Result<Value> {
    let record: Value =
        serde_json::from_slice(bytes).map_err(|_| anyhow::anyhow!("invalid credential receipt"))?;
    let parse_id = |key: &str| {
        record[key]
            .as_str()
            .and_then(|v| uuid::Uuid::parse_str(v).ok())
            .filter(|id| !id.is_nil())
            .ok_or_else(|| anyhow::anyhow!("invalid credential receipt"))
    };
    let credential = parse_id("credential_id")?;
    let enrollment = parse_id("enrollment_id")?;
    let version = record["version"]
        .as_u64()
        .filter(|v| *v > 0)
        .ok_or_else(|| anyhow::anyhow!("invalid credential receipt"))?;
    Ok::<Value, anyhow::Error>(
        json!({"intent_id":intent,"credential_id":credential,"enrollment_id":enrollment,"version":version,"state":"recorded"}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enrollment_output_never_echoes_provider_fields_or_credentials() {
        let intent = uuid::Uuid::new_v4();
        let credential = uuid::Uuid::new_v4();
        let enrollment = uuid::Uuid::new_v4();
        let received = json!({
            "credential_id": credential,
            "enrollment_id": enrollment,
            "version": 1,
            "access_token": "not-an-actual-secret",
            "provider_response": {"authorization": "not-an-actual-secret"},
            "state": "untrusted-state",
            "intent_id": uuid::Uuid::new_v4(),
        });
        let output = enrollment_receipt(&serde_json::to_vec(&received).unwrap(), intent).unwrap();
        assert_eq!(
            output,
            json!({"intent_id": intent, "credential_id": credential,
            "enrollment_id": enrollment, "version": 1, "state": "recorded"})
        );
        assert!(!output.to_string().contains("not-an-actual-secret"));
    }

    #[test]
    fn enrollment_without_valid_receipt_never_reports_recorded() {
        let intent = uuid::Uuid::new_v4();
        let valid = json!({"credential_id": uuid::Uuid::new_v4(),
            "enrollment_id": uuid::Uuid::new_v4(), "version": 1});
        for (field, value) in [
            ("credential_id", json!(uuid::Uuid::nil())),
            ("enrollment_id", json!("invalid")),
            ("version", json!(0)),
            ("version", json!(null)),
        ] {
            let mut invalid = valid.clone();
            invalid[field] = value;
            assert!(enrollment_receipt(&serde_json::to_vec(&invalid).unwrap(), intent).is_err());
        }
    }
}
