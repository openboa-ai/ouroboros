//! Immutable program inputs and the activated, bounded container profile.
//! These records grant neither host paths nor authority to execute before materialization.
use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProgramInput {
    pub target: String,
    pub workspace_id: Uuid,
    pub revision: i64,
    pub file: String,
    pub destination: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProgramRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native: Option<NativeInvocation>,
    pub argv: Vec<String>,
    pub inputs: Vec<ProgramInput>,
}

fn is_false(value: &bool) -> bool {
    !value
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NativeInvocation {
    pub prompt: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume: Option<NativeResume>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct NativeResume {
    pub thread_id: Uuid,
    /// Exact immutable input destination, never a host or previous-container path.
    pub checkpoint_destination: String,
}

/// Complete activated execution properties, independent of the host's socket and file paths.
/// `compute_units` is the fixed concurrent capacity charge for one whole instance of this profile.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProgramProfile {
    #[serde(default, skip_serializing_if = "is_false")]
    pub native_codex: bool,
    /// A model selected by the activated profile, never a caller-controlled provider route.
    /// Omission preserves the legacy controlled fixture model.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_model: Option<String>,
    pub image: String,
    pub memory_bytes: i64,
    pub nano_cpus: i64,
    pub pids_limit: i64,
    pub lifetime_seconds: u64,
    pub compute_units: i64,
    pub workspace_bytes: u64,
    pub home_bytes: u64,
    pub temporary_bytes: u64,
    pub max_input_files: u32,
    pub max_input_bytes: u64,
    pub max_file_bytes: u64,
    pub max_output_bytes: u64,
}

pub fn program_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 512
        && !path.contains('\\')
        && !path.chars().any(char::is_control)
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

impl ProgramProfile {
    pub fn validate(&self) -> Result<()> {
        if let Some(model) = &self.native_model {
            ensure!(
                self.native_codex
                    && !model.is_empty()
                    && model.len() <= 128
                    && model.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-')
                    }),
                "invalid activated native model"
            );
        }
        let digest = self
            .image
            .strip_prefix("sha256:")
            .or_else(|| self.image.rsplit_once("@sha256:").map(|(_, digest)| digest));
        ensure!(
            digest.is_some_and(
                |digest| digest.len() == 64 && digest.bytes().all(|b| b.is_ascii_hexdigit())
            ),
            "program image digest required"
        );
        ensure!(
            self.memory_bytes > 0
                && self.nano_cpus > 0
                && self.pids_limit > 0
                && self.lifetime_seconds > 0
                && self.lifetime_seconds <= i32::MAX as u64
                && self.compute_units > 0,
            "finite program allocation required"
        );
        ensure!(
            [self.workspace_bytes, self.home_bytes, self.temporary_bytes]
                .iter()
                .all(|n| *n > 0 && *n <= self.memory_bytes as u64),
            "explicit bounded program spaces required"
        );
        ensure!(
            self.max_input_files > 0
                && self.max_input_files <= 1000
                && self.max_file_bytes > 0
                && self.max_file_bytes <= self.max_input_bytes
                && self.max_input_bytes <= self.workspace_bytes
                && self.max_output_bytes > 0
                && self.max_output_bytes <= 2_097_152,
            "invalid program input or output bounds"
        );
        Ok(())
    }
}

impl ProgramRequest {
    pub fn validate(&self, profile: &ProgramProfile) -> Result<()> {
        profile.validate()?;
        match (&self.native, profile.native_codex) {
            (Some(native), true) => {
                ensure!(
                    self.argv.is_empty(),
                    "native invocation cannot supply executable arguments"
                );
                ensure!(
                    !native.prompt.is_empty()
                        && native.prompt.len() <= 65536
                        && !native.prompt.contains('\0'),
                    "invalid native task input"
                );
                if let Some(resume) = &native.resume {
                    ensure!(
                        !resume.thread_id.is_nil()
                            && program_path(&resume.checkpoint_destination)
                            && self
                                .inputs
                                .iter()
                                .filter(|input| input.destination == resume.checkpoint_destination)
                                .count()
                                == 1,
                        "native checkpoint must select one admitted input"
                    );
                }
            }
            (None, false) => {
                ensure!(
                    !self.argv.is_empty()
                        && self.argv.len() <= 64
                        && !self.argv[0].is_empty()
                        && self.argv.iter().all(|v| !v.contains('\0'))
                        && self.argv.iter().map(String::len).sum::<usize>() <= 16_384,
                    "invalid contained program arguments"
                );
                // env's assignment parser must not reinterpret the admitted command. This is a
                // container path; it is never resolved or mounted from the host filesystem.
                ensure!(
                    self.argv[0].strip_prefix('/').is_some_and(program_path)
                        && !self.argv[0].contains('='),
                    "absolute contained executable required"
                );
            }
            _ => anyhow::bail!("native invocation requires an explicitly activated native profile"),
        }
        self.validate_inputs(profile)
    }
    pub fn validate_inputs(&self, profile: &ProgramProfile) -> Result<()> {
        profile.validate()?;
        ensure!(
            !self.inputs.is_empty() && self.inputs.len() <= profile.max_input_files as usize,
            "program inputs exceed bound"
        );
        let mut destinations = std::collections::BTreeSet::new();
        for input in &self.inputs {
            ensure!(
                !input.workspace_id.is_nil()
                    && input.revision > 0
                    && !input.target.is_empty()
                    && input.target.len() <= 128
                    && !input.target.chars().any(char::is_control)
                    && program_path(&input.file)
                    && program_path(&input.destination),
                "invalid immutable program input"
            );
            ensure!(
                destinations.insert(input.destination.as_str()),
                "duplicate program destination"
            );
        }
        for destination in &destinations {
            let mut prefix = String::new();
            let parts: Vec<_> = destination.split('/').collect();
            for part in parts.iter().take(parts.len() - 1) {
                if !prefix.is_empty() {
                    prefix.push('/');
                }
                prefix.push_str(part);
                ensure!(
                    !destinations.contains(prefix.as_str()),
                    "overlapping program destinations"
                );
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ResolvedProgramInput {
    pub index: u32,
    pub reference: ProgramInput,
    pub namespace_id: Uuid,
    pub upload_id: Uuid,
    pub object_id: Uuid,
    pub store_id: Uuid,
    pub generation: Uuid,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProgramTicket {
    pub profile: ProgramProfile,
    pub manifest_digest: String,
    pub inputs: Vec<ResolvedProgramInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProgramInputAdmission {
    pub admission: crate::ResourceAdmission,
    pub input: ResolvedProgramInput,
}

pub fn program_manifest_digest(
    profile: &ProgramProfile,
    inputs: &[ResolvedProgramInput],
) -> Result<String> {
    use sha2::{Digest, Sha256};
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(&(
        profile, inputs,
    ))?)))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct MaterializedInput {
    pub index: u32,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct MaterializationReceipt {
    pub instance_id: Uuid,
    pub generation: Uuid,
    pub manifest_digest: String,
    pub files: Vec<MaterializedInput>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn native_model_requires_a_native_profile_and_bounded_identifier() {
        let mut profile = profile();
        profile.native_model = Some("demo-model:v1".into());
        assert!(profile.validate().is_err());
        profile.native_codex = true;
        assert!(profile.validate().is_ok());
        for model in [
            String::new(),
            "x".repeat(129),
            "model name".into(),
            "model\nsetting=true".into(),
            "model\"".into(),
            "model/path".into(),
            "모델".into(),
        ] {
            profile.native_model = Some(model);
            assert!(profile.validate().is_err());
        }
        profile.native_model = Some("x".repeat(128));
        assert!(profile.validate().is_ok());
    }

    #[test]
    fn omitted_native_model_preserves_serialization_and_explicit_model_binds_manifest() {
        let mut profile = profile();
        profile.native_codex = true;
        let legacy = serde_json::to_value(&profile).unwrap();
        assert!(legacy.get("native_model").is_none());
        assert_eq!(
            serde_json::from_value::<ProgramProfile>(legacy.clone()).unwrap(),
            profile
        );
        let digest = program_manifest_digest(&profile, &[]).unwrap();
        profile.native_model = Some("demo-model:v1".into());
        assert_ne!(program_manifest_digest(&profile, &[]).unwrap(), digest);
        assert_eq!(
            serde_json::to_value(&profile).unwrap()["native_model"],
            "demo-model:v1"
        );
        profile.native_model = None;
        assert_eq!(serde_json::to_value(&profile).unwrap(), legacy);
        assert_eq!(program_manifest_digest(&profile, &[]).unwrap(), digest);
    }

    #[test]
    fn native_mode_is_explicit_and_checkpoint_is_an_exact_input() {
        let mut profile = profile();
        let mut request = ProgramRequest {
            native: Some(NativeInvocation {
                prompt: "Resume the authorized work".into(),
                resume: Some(NativeResume {
                    thread_id: Uuid::new_v4(),
                    checkpoint_destination: "state/session.jsonl".into(),
                }),
            }),
            argv: vec![],
            inputs: vec![input("state/session.jsonl")],
        };
        assert!(request.validate(&profile).is_err());
        profile.native_codex = true;
        assert!(request.validate(&profile).is_ok());
        request.argv.push("/bin/sh".into());
        assert!(request.validate(&profile).is_err());
        request.argv.clear();
        request
            .native
            .as_mut()
            .unwrap()
            .resume
            .as_mut()
            .unwrap()
            .checkpoint_destination = "../auth.json".into();
        assert!(request.validate(&profile).is_err());
        request
            .native
            .as_mut()
            .unwrap()
            .resume
            .as_mut()
            .unwrap()
            .checkpoint_destination = "other.jsonl".into();
        assert!(request.validate(&profile).is_err());
        assert!(request.validate_inputs(&profile).is_ok());
        let mut legacy = profile.clone();
        legacy.native_codex = false;
        assert!(
            serde_json::to_value(legacy)
                .unwrap()
                .get("native_codex")
                .is_none()
        );
    }
    fn profile() -> ProgramProfile {
        ProgramProfile {
            native_codex: false,
            native_model: None,
            image: format!("sha256:{}", "a".repeat(64)),
            memory_bytes: 64 * 1024 * 1024,
            nano_cpus: 1_000_000_000,
            pids_limit: 32,
            lifetime_seconds: 30,
            compute_units: 7,
            workspace_bytes: 1024 * 1024,
            home_bytes: 1024 * 1024,
            temporary_bytes: 1024 * 1024,
            max_input_files: 8,
            max_input_bytes: 4096,
            max_file_bytes: 2048,
            max_output_bytes: 4096,
        }
    }
    fn input(destination: &str) -> ProgramInput {
        ProgramInput {
            target: "company-files".into(),
            workspace_id: Uuid::new_v4(),
            revision: 1,
            file: "source.txt".into(),
            destination: destination.into(),
        }
    }
    #[test]
    fn paths_cannot_escape_or_alias_a_file_as_parent() {
        for path in [
            "", "/a", "../a", "a/../b", "a/./b", "a//b", "a/", "a\\b", "a\0b", "a\nb",
        ] {
            assert!(!program_path(path), "{path:?}");
        }
        let p = profile();
        let valid = ProgramRequest {
            native: None,
            argv: vec!["/bin/sh".into(), "code/job.sh".into()],
            inputs: vec![input("code/job.sh"), input("data/raw.bin")],
        };
        valid.validate(&p).unwrap();
        for pair in [
            ["code", "code/job.sh"],
            ["code/job.sh", "code"],
            ["same", "same"],
        ] {
            let request = ProgramRequest {
                inputs: pair.into_iter().map(input).collect(),
                ..valid.clone()
            };
            assert!(request.validate(&p).is_err());
        }
    }
    #[test]
    fn absent_capacity_and_nonimmutable_profiles_are_rejected() {
        let p = profile();
        p.validate().unwrap();
        let mut invalid = p.clone();
        invalid.compute_units = 0;
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.workspace_bytes = 0;
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.max_input_bytes = invalid.workspace_bytes + 1;
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.image = "image:latest".into();
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.temporary_bytes = invalid.memory_bytes as u64 + 1;
        assert!(invalid.validate().is_err());
        let request = ProgramRequest {
            native: None,
            argv: vec!["/bin/sh".into(), "bad\0arg".into()],
            inputs: vec![input("code")],
        };
        assert!(request.validate(&p).is_err());
        for command in ["sh", "A=B", "/A=B", "//bin/sh", "/bin/../sh", "/"] {
            let bad = ProgramRequest {
                native: None,
                argv: vec![command.into()],
                inputs: vec![input("code")],
            };
            assert!(bad.validate(&p).is_err(), "{command}");
        }
    }
    #[test]
    fn handoff_digest_binds_profile_destination_and_exact_object_not_just_bytes() {
        let p = profile();
        let i = ResolvedProgramInput {
            index: 0,
            reference: input("data.bin"),
            namespace_id: Uuid::new_v4(),
            upload_id: Uuid::new_v4(),
            object_id: Uuid::new_v4(),
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            sha256: "a".repeat(64),
            size: 2,
        };
        let original = program_manifest_digest(&p, std::slice::from_ref(&i)).unwrap();
        let decoded: ResolvedProgramInput =
            serde_json::from_slice(&serde_json::to_vec(&i).unwrap()).unwrap();
        assert_eq!(original, program_manifest_digest(&p, &[decoded]).unwrap());
        let mut changed = i.clone();
        changed.object_id = Uuid::new_v4();
        assert_ne!(original, program_manifest_digest(&p, &[changed]).unwrap());
        let mut changed = i.clone();
        changed.reference.destination = "other.bin".into();
        assert_ne!(original, program_manifest_digest(&p, &[changed]).unwrap());
        let mut changed = p;
        changed.nano_cpus /= 2;
        assert_ne!(original, program_manifest_digest(&changed, &[i]).unwrap());
    }
}
