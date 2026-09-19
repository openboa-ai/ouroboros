//! A contained program's input delivery and process report. Core owns all execution authority.
use super::Profile;
use anyhow::{Context, Result, ensure};
use bollard::{Docker, container::LogOutput, exec::StartExecResults, models::ExecConfig};
use futures_util::StreamExt;
use ouroboros_contracts::{
    MaterializationReceipt, MaterializedInput, ProgramProfile, RuntimeTicket,
    program_manifest_digest,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap, fs::OpenOptions, future::Future, os::unix::fs::OpenOptionsExt,
    path::Path, time::Duration,
};
use tokio::io::AsyncWriteExt;

const RECEIPT_BYTES: usize = 262_144;

pub(crate) fn validate_profile(base: &Profile, program: &ProgramProfile) -> Result<()> {
    base.validate()?;
    program.validate()?;
    ensure!(
        base.image == program.image
            && base.memory_bytes == program.memory_bytes
            && base.nano_cpus == program.nano_cpus
            && base.pids_limit == program.pids_limit
            && base.lifetime_seconds == program.lifetime_seconds,
        "Runtime and activated program profiles differ"
    );
    Ok(())
}

pub(crate) fn validate_ticket(
    base: &Profile,
    configured: Option<&ProgramProfile>,
    ticket: &RuntimeTicket,
) -> Result<()> {
    match (configured, &ticket.program, &ticket.input.program) {
        (None, None, None) => Ok(()),
        (Some(profile), Some(program), Some(request)) => {
            validate_profile(base, profile)?;
            request.validate(profile)?;
            ensure!(
                profile == &program.profile
                    && ticket.input.units == profile.compute_units
                    && ticket.input.lifetime_seconds > 0
                    && ticket.input.lifetime_seconds as u64 <= profile.lifetime_seconds
                    && request.inputs.len() == program.inputs.len()
                    && program
                        .inputs
                        .iter()
                        .enumerate()
                        .all(|(index, input)| input.index as usize == index
                            && input.reference == request.inputs[index])
                    && program.manifest_digest
                        == program_manifest_digest(profile, &program.inputs)?,
                "admitted program descriptor differs from the configured profile or inputs"
            );
            Ok(())
        }
        _ => anyhow::bail!("program activation, request and ticket must agree"),
    }
}

pub(crate) fn spaces(profile: &ProgramProfile) -> HashMap<String, String> {
    [
        (
            "/workspace".into(),
            format!(
                "rw,nosuid,nodev,size={},uid=65532,gid=65532,mode=0700",
                profile.workspace_bytes
            ),
        ),
        (
            "/home/agent".into(),
            format!(
                "rw,nosuid,nodev,size={},uid=65532,gid=65532,mode=0700",
                profile.home_bytes
            ),
        ),
        (
            "/tmp".into(),
            format!("rw,nosuid,nodev,size={},mode=1777", profile.temporary_bytes),
        ),
    ]
    .into()
}

fn contained_command(argv: &[String]) -> Vec<String> {
    // Docker's ExecConfig.env merges with image/container environment. env -i removes all
    // inherited variables before running the fixed materializer or admitted private argv.
    [
        "/usr/bin/env",
        "-i",
        "HOME=/home/agent",
        "PATH=/usr/local/bin:/usr/bin:/bin",
    ]
    .into_iter()
    .map(String::from)
    .chain(argv.iter().cloned())
    .collect()
}

fn exec_config(argv: &[String], input: bool) -> ExecConfig {
    ExecConfig {
        attach_stdin: Some(input),
        attach_stdout: Some(true),
        attach_stderr: Some(true),
        tty: Some(false),
        cmd: Some(contained_command(argv)),
        user: Some("65532:65532".into()),
        working_dir: Some("/workspace".into()),
        privileged: Some(false),
        ..Default::default()
    }
}

async fn exit_code(docker: &Docker, exec: &str) -> Result<i64> {
    // Stream EOF and a confirmed process exit are different observations.
    for _ in 0..20 {
        let detail = docker.inspect_exec(exec).await?;
        if detail.running == Some(false) {
            return detail
                .exit_code
                .context("contained process exit code unavailable");
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    anyhow::bail!("contained process termination remains unobserved")
}

fn expected_receipt(ticket: &RuntimeTicket) -> Result<MaterializationReceipt> {
    let program = ticket.program.as_ref().context("program ticket missing")?;
    Ok(MaterializationReceipt {
        instance_id: ticket.instance_id,
        generation: ticket.generation,
        manifest_digest: program.manifest_digest.clone(),
        files: program
            .inputs
            .iter()
            .map(|input| MaterializedInput {
                index: input.index,
                sha256: input.sha256.clone(),
                size: input.size,
            })
            .collect(),
    })
}

fn check_receipt(ticket: &RuntimeTicket, bytes: &[u8]) -> Result<MaterializationReceipt> {
    ensure!(
        bytes.len() <= RECEIPT_BYTES,
        "materializer receipt exceeds bound"
    );
    let receipt: MaterializationReceipt = serde_json::from_slice(bytes)?;
    ensure!(
        receipt == expected_receipt(ticket)?,
        "materializer delivery receipt differs from admitted inputs"
    );
    Ok(receipt)
}

pub(crate) async fn materialize(
    docker: &Docker,
    cid: &str,
    ticket: &RuntimeTicket,
) -> Result<MaterializationReceipt> {
    let program = ticket.program.as_ref().context("program ticket missing")?;
    let descriptor = crate::materialize::MaterializationDescriptor {
        instance_id: ticket.instance_id,
        generation: ticket.generation,
        program: program.clone(),
    };
    let bytes = serde_json::to_vec(&descriptor)?;
    ensure!(
        bytes.len() <= 2_097_152,
        "materializer descriptor exceeds bound"
    );
    let exec = docker
        .create_exec(
            cid,
            exec_config(&["/usr/local/bin/ouroboros-materialize".into()], true),
        )
        .await?;
    let StartExecResults::Attached {
        mut output,
        mut input,
    } = docker.start_exec(&exec.id, None).await?
    else {
        anyhow::bail!("materializer channel unavailable")
    };
    input.write_all(&bytes).await?;
    input.shutdown().await?;
    let mut receipt = Vec::new();
    let mut errors = 0usize;
    while let Some(frame) = output.next().await {
        match frame? {
            LogOutput::StdOut { message } => {
                ensure!(
                    message.len() <= RECEIPT_BYTES.saturating_sub(receipt.len()),
                    "materializer receipt exceeds bound"
                );
                receipt.extend_from_slice(&message);
            }
            LogOutput::StdErr { message } => {
                errors = errors
                    .checked_add(message.len())
                    .context("materializer error size overflow")?;
                ensure!(errors <= 4096, "materializer diagnostic bound exhausted");
            }
            _ => anyhow::bail!("unexpected materializer channel"),
        }
    }
    ensure!(
        exit_code(docker, &exec.id).await? == 0,
        "contained input materialization failed"
    );
    check_receipt(ticket, &receipt)
}

async fn output_file(root: &Path, name: &str) -> Result<tokio::fs::File> {
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .mode(0o600)
        .open(root.join(name))?;
    Ok(tokio::fs::File::from_std(file))
}

async fn record(root: &Path, name: &str, value: serde_json::Value) -> Result<()> {
    let mut file = output_file(root, name).await?;
    let mut bytes = serde_json::to_vec(&value)?;
    bytes.push(b'\n');
    file.write_all(&bytes).await?;
    file.sync_all().await?;
    tokio::fs::File::open(root).await?.sync_all().await?;
    Ok(())
}

pub(crate) async fn run<F, Fut>(
    docker: &Docker,
    cid: &str,
    root: &Path,
    ticket: &RuntimeTicket,
    authorize: F,
) -> Result<()>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<()>>,
{
    let request = ticket
        .input
        .program
        .as_ref()
        .context("program request missing")?;
    let profile = &ticket
        .program
        .as_ref()
        .context("program ticket missing")?
        .profile;
    request.validate(profile)?;
    let mut stdout = output_file(root, "program-stdout.bin").await?;
    let mut stderr = output_file(root, "program-stderr.bin").await?;
    let exec = docker
        .create_exec(cid, exec_config(&request.argv, false))
        .await?;
    record(root, "program-start.json", json!({"source":"runtime_backend","instance_id":ticket.instance_id,"generation":ticket.generation,"exec_id":exec.id,"payload_started":false})).await?;
    authorize().await?;
    let StartExecResults::Attached { mut output, .. } = docker.start_exec(&exec.id, None).await?
    else {
        anyhow::bail!("contained program output unavailable")
    };
    let mut stdout_hash = Sha256::new();
    let mut stderr_hash = Sha256::new();
    let mut stdout_bytes = 0u64;
    let mut stderr_bytes = 0u64;
    while let Some(frame) = output.next().await {
        let frame = frame?;
        let total = stdout_bytes
            .checked_add(stderr_bytes)
            .context("program output size overflow")?;
        let (file, counter, hash, message) = match frame {
            LogOutput::StdOut { message } => {
                (&mut stdout, &mut stdout_bytes, &mut stdout_hash, message)
            }
            LogOutput::StdErr { message } => {
                (&mut stderr, &mut stderr_bytes, &mut stderr_hash, message)
            }
            _ => anyhow::bail!("unexpected contained program output channel"),
        };
        // Count both channels against one admitted bound. Never store the excess bytes.
        ensure!(
            message.len() as u64 <= profile.max_output_bytes.saturating_sub(total),
            "program output bound exhausted"
        );
        hash.update(&message);
        file.write_all(&message).await?;
        *counter += message.len() as u64;
    }
    stdout.sync_all().await?;
    stderr.sync_all().await?;
    let code = exit_code(docker, &exec.id).await?;
    let observation = ouroboros_contracts::RuntimeProgramObservation {
        instance_id: ticket.instance_id,
        generation: ticket.generation,
        manifest_digest: ticket
            .program
            .as_ref()
            .context("program ticket missing")?
            .manifest_digest
            .clone(),
        exec_id: exec.id.clone(),
        exit_code: code,
        stdout_bytes,
        stderr_bytes,
        stdout_sha256: hex::encode(stdout_hash.finalize()),
        stderr_sha256: hex::encode(stderr_hash.finalize()),
    };
    record(root, "program-observation.json", json!(observation)).await?;
    record(root, "program-result.json", json!({
        "source":"runtime_backend", "instance_id":ticket.instance_id, "generation":ticket.generation,
        "exec_id":exec.id, "exit_code":code, "program_succeeded":code==0,
        "stdout_bytes":stdout_bytes, "stderr_bytes":stderr_bytes, "output_complete":true,
        "output_source":"private_program", "effects_settled":false,
    })).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use ouroboros_contracts::{
        ExecutionRequest, ProgramInput, ProgramRequest, ProgramTicket, ResolvedProgramInput,
    };
    use uuid::Uuid;

    fn fixture() -> (Profile, ProgramProfile, RuntimeTicket) {
        let profile = ProgramProfile {
            native_codex: false,
            native_model: None,
            image: format!("sha256:{}", "a".repeat(64)),
            memory_bytes: 64 * 1024 * 1024,
            nano_cpus: 500_000_000,
            pids_limit: 32,
            lifetime_seconds: 30,
            compute_units: 7,
            workspace_bytes: 1024 * 1024,
            home_bytes: 1024 * 1024,
            temporary_bytes: 1024 * 1024,
            max_input_files: 10,
            max_input_bytes: 1024,
            max_file_bytes: 1024,
            max_output_bytes: 4096,
        };
        let base = Profile {
            image: profile.image.clone(),
            docker_socket: "/run/example/docker.sock".into(),
            memory_bytes: profile.memory_bytes,
            nano_cpus: profile.nano_cpus,
            pids_limit: profile.pids_limit,
            lifetime_seconds: profile.lifetime_seconds,
        };
        let reference = ProgramInput {
            target: "company-files".into(),
            workspace_id: Uuid::new_v4(),
            revision: 1,
            file: "code/task.sh".into(),
            destination: "task.sh".into(),
        };
        let inputs = vec![ResolvedProgramInput {
            index: 0,
            reference: reference.clone(),
            namespace_id: Uuid::new_v4(),
            upload_id: Uuid::new_v4(),
            object_id: Uuid::new_v4(),
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            sha256: "b".repeat(64),
            size: 12,
        }];
        let program = ProgramTicket {
            profile: profile.clone(),
            manifest_digest: program_manifest_digest(&profile, &inputs).unwrap(),
            inputs,
        };
        let ticket = RuntimeTicket {
            execution_id: Uuid::new_v4(),
            intent_id: Uuid::new_v4(),
            attempt_id: Uuid::new_v4(),
            instance_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            input: ExecutionRequest {
                work_id: Uuid::new_v4(),
                delegation_id: Uuid::new_v4(),
                profile_id: "program-example".into(),
                units: 7,
                lifetime_seconds: 20,
                predecessor_execution_id: None,
                agent_delegation_id: Some(Uuid::new_v4()),
                program: Some(ProgramRequest {
                    native: None,
                    argv: vec!["/bin/sh".into(), "task.sh".into()],
                    inputs: vec![reference],
                }),
            },
            program: Some(program),
        };
        (base, profile, ticket)
    }

    #[test]
    fn ticket_cannot_substitute_profile_input_or_fixed_compute_allocation() {
        let (base, profile, ticket) = fixture();
        validate_ticket(&base, Some(&profile), &ticket).unwrap();
        assert!(validate_ticket(&base, None, &ticket).is_err());
        let mut old = ticket.clone();
        old.program = None;
        old.input.program = None;
        assert!(validate_ticket(&base, Some(&profile), &old).is_err());
        validate_ticket(&base, None, &old).unwrap();
        let mut missing = ticket.clone();
        missing.program = None;
        assert!(validate_ticket(&base, Some(&profile), &missing).is_err());
        let mut cheap = ticket.clone();
        cheap.input.units = 1;
        assert!(validate_ticket(&base, Some(&profile), &cheap).is_err());
        let mut changed = ticket.clone();
        changed.input.program.as_mut().unwrap().inputs[0].destination = "another.sh".into();
        assert!(validate_ticket(&base, Some(&profile), &changed).is_err());
        let mut changed = ticket.clone();
        changed.program.as_mut().unwrap().inputs[0].object_id = Uuid::new_v4();
        assert!(validate_ticket(&base, Some(&profile), &changed).is_err());
        let mut changed = profile.clone();
        changed.memory_bytes *= 2;
        assert!(validate_profile(&base, &changed).is_err());
        let mut changed = profile.clone();
        changed.workspace_bytes *= 2;
        assert!(validate_ticket(&base, Some(&changed), &ticket).is_err());
    }

    #[test]
    fn delivered_receipt_requires_all_bytes_of_this_instance_and_generation() {
        let (_, _, ticket) = fixture();
        let receipt = expected_receipt(&ticket).unwrap();
        check_receipt(&ticket, &serde_json::to_vec(&receipt).unwrap()).unwrap();
        let mut stale = receipt.clone();
        stale.generation = Uuid::new_v4();
        assert!(check_receipt(&ticket, &serde_json::to_vec(&stale).unwrap()).is_err());
        let mut short = receipt.clone();
        short.files[0].size -= 1;
        assert!(check_receipt(&ticket, &serde_json::to_vec(&short).unwrap()).is_err());
        let mut omitted = receipt;
        omitted.files.clear();
        assert!(check_receipt(&ticket, &serde_json::to_vec(&omitted).unwrap()).is_err());
        assert!(check_receipt(&ticket, b"{\"ready\":true}").is_err());
    }

    #[test]
    fn admitted_argv_is_data_after_the_fixed_environment_reset() {
        let argv = vec!["/bin/sh".into(), "task.sh".into(), "$(host-command)".into()];
        let config = exec_config(&argv, false);
        let command = config.cmd.unwrap();
        assert_eq!(
            &command[..4],
            &[
                "/usr/bin/env",
                "-i",
                "HOME=/home/agent",
                "PATH=/usr/local/bin:/usr/bin:/bin"
            ]
        );
        assert_eq!(&command[4..], &argv);
        assert_eq!(config.user.as_deref(), Some("65532:65532"));
        assert_eq!(config.working_dir.as_deref(), Some("/workspace"));
        assert_eq!(config.privileged, Some(false));
        assert_eq!(config.attach_stdin, Some(false));
        let (_, profile, ticket) = fixture();
        let mut request = ticket.input.program.unwrap();
        for executable in [
            "CUSTOM=value",
            "/workspace/CUSTOM=value",
            "-S",
            "sh",
            "/workspace/../task",
            "//bin/sh",
        ] {
            request.argv = vec![executable.into()];
            assert!(request.validate(&profile).is_err());
        }
        request.argv = argv;
        request.validate(&profile).unwrap();
    }
}
