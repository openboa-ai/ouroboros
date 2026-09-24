//! One durable uncertain claim per exclusive slot, until return or proven non-dispatch.
use anyhow::{Result, ensure};
use ouroboros_contracts::{RuntimeClaimContext, RuntimeClaimObservation};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
    path::Path,
};

const PENDING: &str = "pending-claim.json";
const MAX_RECORD: u64 = 64 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(crate) struct PendingClaim {
    pub context: RuntimeClaimContext,
    pub launch_digest: String,
}

pub(crate) fn read<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    read_bounded(path, MAX_RECORD)
}
/// Instance journals include admitted program inputs and native prompts as well as the claim.
pub(crate) fn read_instance<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    read_bounded(path, 16 * 1024 * 1024)
}
fn read_bounded<T: DeserializeOwned>(path: &Path, limit: u64) -> Result<Option<T>> {
    let mut file = match OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC)
        .open(path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let meta = file.metadata()?;
    ensure!(
        meta.is_file()
            && meta.nlink() == 1
            // SAFETY: geteuid has no pointer arguments and only observes identity.
            && meta.uid() == unsafe { libc::geteuid() }
            && meta.permissions().mode() & 0o077 == 0
            && meta.len() <= limit,
        "invalid protected Runtime claim record"
    );
    let mut bytes = Vec::new();
    (&mut file).take(limit + 1).read_to_end(&mut bytes)?;
    ensure!(
        bytes.len() as u64 <= limit,
        "Runtime claim record exceeds bound"
    );
    Ok(Some(serde_json::from_slice(&bytes)?))
}
fn write(root: &Path, name: &str, value: &impl Serialize) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .mode(0o600)
        .open(root.join(name))?;
    serde_json::to_writer(&mut file, value)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    File::open(root)?.sync_all()?;
    Ok(())
}
pub(crate) fn pending(root: &Path) -> Result<Option<PendingClaim>> {
    read(&root.join(PENDING))
}
pub(crate) fn prepare(
    root: &Path,
    context: RuntimeClaimContext,
    launch_digest: String,
) -> Result<PendingClaim> {
    let record = PendingClaim {
        context,
        launch_digest,
    };
    write(root, PENDING, &record)?;
    Ok(record)
}
fn resolution_confirmed(observed: &RuntimeClaimObservation) -> bool {
    if observed.never_dispatched {
        observed.claim.is_none() && observed.intent_state == "restricted"
    } else {
        observed.slot_released()
    }
}
pub(crate) fn resolve(
    root: &Path,
    expected: &PendingClaim,
    observed: &RuntimeClaimObservation,
) -> Result<()> {
    ensure!(
        pending(root)?.as_ref() == Some(expected),
        "Runtime pending claim changed"
    );
    ensure!(
        expected.context.same_record(&observed.context) && resolution_confirmed(observed),
        "original Runtime claim remains unresolved: {}",
        expected.context.intent_id
    );
    // Archive the claim and the authoritative resolution before deleting the barrier.
    // A crash at either sync point is safe: the next invocation reads the original claim again.
    let name = format!("claim-resolved-{}.json", expected.context.intent_id);
    match read::<RuntimeClaimObservation>(&root.join(&name))? {
        Some(old) => ensure!(
            old.context.same_record(&observed.context)
                && old.claim == observed.claim
                && old.never_dispatched == observed.never_dispatched
                && resolution_confirmed(&old),
            "Runtime resolution evidence conflict"
        ),
        None => write(root, &name, observed)?,
    }
    std::fs::remove_file(root.join(PENDING))?;
    File::open(root)?.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ouroboros_contracts::RuntimeClaimAssignment;
    use uuid::Uuid;
    struct Scratch(std::path::PathBuf);
    impl Scratch {
        fn new() -> Self {
            let root = std::env::temp_dir().join(format!("ouro-claim-test-{}", Uuid::new_v4()));
            std::fs::create_dir(&root).unwrap();
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
            Self(root)
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }
    fn observed() -> RuntimeClaimObservation {
        RuntimeClaimObservation {
            context: RuntimeClaimContext {
                environment_id: Uuid::new_v4(),
                firm_id: Uuid::new_v4(),
                serving_generation: Uuid::new_v4(),
                worker_id: "assigned-runtime".into(),
                intent_id: Uuid::new_v4(),
                execution_id: Uuid::new_v4(),
                profile_id: "qualified-program".into(),
            },
            intent_state: "claimed".into(),
            never_dispatched: false,
            claim: Some(RuntimeClaimAssignment {
                attempt_id: Uuid::new_v4(),
                instance_id: Uuid::new_v4(),
                generation: Uuid::new_v4(),
                phase: "terminated".into(),
                terminated: true,
                capacity_returned: true,
            }),
        }
    }
    #[test]
    fn original_claim_survives_response_loss_and_requires_actual_return() {
        let dir = Scratch::new();
        let observed = observed();
        let original = prepare(&dir.0, observed.context.clone(), "a".repeat(64)).unwrap();
        assert_eq!(pending(&dir.0).unwrap(), Some(original.clone()));
        assert!(prepare(&dir.0, observed.context.clone(), "b".repeat(64)).is_err());
        for mutation in 0..6 {
            let mut incomplete = observed.clone();
            match mutation {
                0 => incomplete.claim = None,
                1 => incomplete.claim.as_mut().unwrap().terminated = false,
                2 => incomplete.claim.as_mut().unwrap().capacity_returned = false,
                3 => incomplete.claim.as_mut().unwrap().phase = "released".into(),
                4 => incomplete.context.environment_id = Uuid::new_v4(),
                _ => incomplete.context.worker_id = "other-runtime".into(),
            }
            assert!(resolve(&dir.0, &original, &incomplete).is_err());
            assert_eq!(pending(&dir.0).unwrap(), Some(original.clone()));
        }
        let mut after_restart = observed.clone();
        after_restart.context.serving_generation = Uuid::new_v4();
        resolve(&dir.0, &original, &after_restart).unwrap();
        assert!(pending(&dir.0).unwrap().is_none());
        let archive = dir.0.join(format!(
            "claim-resolved-{}.json",
            original.context.intent_id
        ));
        assert_eq!(
            read::<RuntimeClaimObservation>(&archive).unwrap(),
            Some(after_restart)
        );
    }
    #[test]
    fn canceled_before_dispatch_resolves_the_original_pending_claim() {
        let dir = Scratch::new();
        let mut canceled = observed();
        canceled.intent_state = "restricted".into();
        canceled.claim = None;
        canceled.never_dispatched = true;
        let original = prepare(&dir.0, canceled.context.clone(), "a".repeat(64)).unwrap();
        for mutation in 0..9 {
            let mut incomplete = canceled.clone();
            match mutation {
                0 => incomplete.never_dispatched = false,
                1 => incomplete.intent_state = "accepted".into(),
                2 => incomplete.claim = observed().claim,
                3 => incomplete.context.environment_id = Uuid::new_v4(),
                4 => incomplete.context.firm_id = Uuid::new_v4(),
                5 => incomplete.context.worker_id = "other-runtime".into(),
                6 => incomplete.context.intent_id = Uuid::new_v4(),
                7 => incomplete.context.execution_id = Uuid::new_v4(),
                _ => incomplete.context.profile_id = "other-profile".into(),
            }
            assert!(resolve(&dir.0, &original, &incomplete).is_err());
            assert_eq!(pending(&dir.0).unwrap(), Some(original.clone()));
        }
        assert!(!canceled.slot_released());
        canceled.context.serving_generation = Uuid::new_v4();
        resolve(&dir.0, &original, &canceled).unwrap();
        assert!(pending(&dir.0).unwrap().is_none());
        assert_eq!(
            read::<RuntimeClaimObservation>(&dir.0.join(format!(
                "claim-resolved-{}.json",
                original.context.intent_id
            )))
            .unwrap(),
            Some(canceled)
        );
    }
    #[test]
    fn legacy_claim_observation_cannot_invent_non_dispatch_proof() {
        let dir = Scratch::new();
        let mut legacy = serde_json::to_value(observed()).unwrap();
        legacy.as_object_mut().unwrap().remove("never_dispatched");
        legacy["intent_state"] = serde_json::json!("restricted");
        legacy["claim"] = serde_json::Value::Null;
        let observed: RuntimeClaimObservation = serde_json::from_value(legacy).unwrap();
        assert!(!observed.never_dispatched);
        let original = prepare(&dir.0, observed.context.clone(), "a".repeat(64)).unwrap();
        assert!(resolve(&dir.0, &original, &observed).is_err());
        assert_eq!(pending(&dir.0).unwrap(), Some(original));
    }
    #[test]
    fn non_dispatch_archive_survives_interruption_and_rejects_conflicting_evidence() {
        let dir = Scratch::new();
        let mut canceled = observed();
        canceled.intent_state = "restricted".into();
        canceled.claim = None;
        canceled.never_dispatched = true;
        let original = prepare(&dir.0, canceled.context.clone(), "a".repeat(64)).unwrap();
        let name = format!("claim-resolved-{}.json", original.context.intent_id);
        let mut conflicting = canceled.clone();
        conflicting.never_dispatched = false;
        write(&dir.0, &name, &conflicting).unwrap();
        assert!(resolve(&dir.0, &original, &canceled).is_err());
        assert_eq!(pending(&dir.0).unwrap(), Some(original.clone()));
        std::fs::remove_file(dir.0.join(&name)).unwrap();
        write(&dir.0, &name, &canceled).unwrap();
        let original_bytes = std::fs::read(dir.0.join(&name)).unwrap();
        canceled.context.serving_generation = Uuid::new_v4();
        resolve(&dir.0, &original, &canceled).unwrap();
        assert_eq!(std::fs::read(dir.0.join(&name)).unwrap(), original_bytes);
        assert!(pending(&dir.0).unwrap().is_none());
    }
    #[test]
    fn partial_and_aliased_records_never_allow_a_new_claim() {
        let dir = Scratch::new();
        let target = dir.0.join(PENDING);
        for bytes in [b"{".as_slice(), b"{}", &[b'a'; 65537]] {
            std::fs::write(&target, bytes).unwrap();
            std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o600)).unwrap();
            assert!(pending(&dir.0).is_err());
            std::fs::remove_file(&target).unwrap();
        }
        let source = dir.0.join("source");
        std::fs::write(&source, b"{}").unwrap();
        std::os::unix::fs::symlink(&source, &target).unwrap();
        assert!(pending(&dir.0).is_err());
        std::fs::remove_file(&target).unwrap();
        std::fs::hard_link(&source, &target).unwrap();
        assert!(pending(&dir.0).is_err());
    }
    #[test]
    fn interruption_after_archive_is_resolved_without_overwriting_evidence() {
        let dir = Scratch::new();
        let observed = observed();
        let original = prepare(&dir.0, observed.context.clone(), "a".repeat(64)).unwrap();
        let name = format!("claim-resolved-{}.json", original.context.intent_id);
        let mut legacy = serde_json::to_value(&observed).unwrap();
        legacy.as_object_mut().unwrap().remove("never_dispatched");
        write(&dir.0, &name, &legacy).unwrap();
        let original_bytes = std::fs::read(dir.0.join(&name)).unwrap();
        resolve(&dir.0, &original, &observed).unwrap();
        assert_eq!(std::fs::read(dir.0.join(&name)).unwrap(), original_bytes);
        assert!(pending(&dir.0).unwrap().is_none());
    }
    #[test]
    fn admitted_program_journal_has_a_separate_read_bound() {
        let dir = Scratch::new();
        let value = serde_json::json!({"native_prompt":"x".repeat(65536)});
        write(&dir.0, "intent.json", &value).unwrap();
        assert!(read::<serde_json::Value>(&dir.0.join("intent.json")).is_err());
        assert_eq!(
            read_instance::<serde_json::Value>(&dir.0.join("intent.json")).unwrap(),
            Some(value)
        );
    }
}
