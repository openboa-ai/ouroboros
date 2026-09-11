//! Explicit host maintenance; never enables boot startup or creates application authority.
use anyhow::Result;
#[cfg(target_os = "linux")]
use anyhow::ensure;
use serde_json::Value;
#[cfg(target_os = "linux")]
use serde_json::json;
use std::path::{Path, PathBuf};

#[derive(Clone, Copy, clap::ValueEnum)]
pub enum Phase {
    Control,
    Runtime,
}

pub struct Start<'a> {
    pub report: &'a Value,
    pub directory: &'a Path,
    pub receipts: &'a Path,
    pub reviewed: &'a str,
    pub phase: Phase,
    pub runtime_names: Vec<String>,
    pub gateway_config: PathBuf,
    pub client_config: PathBuf,
    pub firm: uuid::Uuid,
    pub resume_control: Option<uuid::Uuid>,
    pub restore_control: Option<uuid::Uuid>,
}

// systemd Type=exec confirms process creation, not that its listener is ready.
// Only read-only transport observations are repeated; start/restore are never replayed.
#[cfg(any(target_os = "linux", test))]
mod readiness {
    use anyhow::{Result, ensure};
    use serde_json::{Value, json};
    use std::{error::Error, future::Future, time::Duration};

    fn pending_transport(error: &reqwest::Error) -> bool {
        if error.is_timeout() {
            return true;
        }
        let mut source = error.source();
        while let Some(cause) = source {
            if let Some(io) = cause.downcast_ref::<std::io::Error>() {
                return io.kind() == std::io::ErrorKind::ConnectionRefused;
            }
            source = cause.source();
        }
        false // TLS/authentication, malformed protocol and other failures are terminal.
    }

    pub(super) async fn wait<F, Fut>(
        client: &reqwest::Client,
        url: &reqwest::Url,
        firm: uuid::Uuid,
        mut verify_live: F,
    ) -> Result<Value>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = Result<()>>,
    {
        // The one absolute deadline includes manager reads, transport and response body.
        // It never grants execution time or changes an existing Runtime deadline.
        tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                verify_live().await?;
                let mut response = match client
                    .get(url.clone())
                    .timeout(Duration::from_secs(3))
                    .send()
                    .await
                {
                    Ok(response) => response,
                    Err(error) if pending_transport(&error) => {
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                    Err(_) => anyhow::bail!("authenticated Gateway transport rejected"),
                };
                ensure!(
                    response.status() == reqwest::StatusCode::OK,
                    "Gateway readiness denied or unavailable"
                );
                let mut body = Vec::new();
                while let Some(chunk) = response.chunk().await? {
                    ensure!(
                        body.len() + chunk.len() <= 65536,
                        "conditions response exceeded bound"
                    );
                    body.extend_from_slice(&chunk);
                }
                let value: Value = serde_json::from_slice(&body)?;
                ensure!(
                    value["firm_id"] == firm.to_string()
                        && value["principal_id"]
                            .as_str()
                            .and_then(|s| uuid::Uuid::parse_str(s).ok())
                            .is_some()
                        && value["cursor"].is_string(),
                    "unexpected conditions identity"
                );
                // An authenticated response from an old invocation is not current readiness.
                verify_live().await?;
                // Readiness does not unpause admissions or qualify Runtime/economics.
                return Ok(json!({"firm_id":firm,"principal_id":value["principal_id"],
                    "cursor":value["cursor"],"admission_paused":value["admission_paused"]}));
            }
        })
        .await
        .map_err(|_| anyhow::anyhow!("authenticated Gateway readiness deadline exceeded"))?
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        };
        use tokio::{
            io::{AsyncReadExt, AsyncWriteExt},
            net::{TcpListener, TcpStream},
            sync::oneshot,
        };

        async fn request(socket: &mut TcpStream) {
            let mut bytes = Vec::new();
            loop {
                let mut byte = [0];
                assert_eq!(socket.read(&mut byte).await.unwrap(), 1);
                bytes.push(byte[0]);
                assert!(bytes.len() < 8192);
                if bytes.ends_with(b"\r\n\r\n") {
                    break;
                }
            }
            assert!(bytes.starts_with(b"GET /conditions HTTP/1.1\r\n"));
        }

        async fn respond(mut socket: TcpStream, status: &str, body: &str) {
            request(&mut socket).await;
            socket.write_all(format!("HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).as_bytes()).await.unwrap();
        }

        fn conditions(firm: uuid::Uuid) -> String {
            json!({"firm_id":firm,"principal_id":uuid::Uuid::new_v4(),"cursor":"initial", "admission_paused":true}).to_string()
        }

        fn client() -> reqwest::Client {
            reqwest::Client::builder().no_proxy().build().unwrap()
        }

        async fn listener() -> (TcpListener, reqwest::Url) {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let url = format!("http://{}/conditions", listener.local_addr().unwrap())
                .parse()
                .unwrap();
            (listener, url)
        }

        #[tokio::test]
        async fn delayed_listener_readiness_preserves_admission_and_only_repeats_reads() {
            let firm = uuid::Uuid::new_v4();
            let (listener, url) = listener().await;
            let (received_tx, received_rx) = oneshot::channel();
            let (release_tx, release_rx) = oneshot::channel();
            // The first accepted request cannot complete until the next identity
            // observation releases it. No timing sleep decides whether startup was delayed.
            let server = tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                request(&mut socket).await;
                received_tx.send(()).unwrap();
                release_rx.await.unwrap();
                drop(socket);
                respond(
                    listener.accept().await.unwrap().0,
                    "200 OK",
                    &conditions(firm),
                )
                .await;
            });
            let mut received = Some(received_rx);
            let mut release = Some(release_tx);
            let mut observations = 0;
            let result = wait(&client(), &url, firm, || {
                observations += 1;
                let barrier = if observations == 2 {
                    received.take().zip(release.take())
                } else {
                    None
                };
                async move {
                    if let Some((received, release)) = barrier {
                        received.await.unwrap();
                        release.send(()).unwrap();
                    }
                    Ok(())
                }
            })
            .await
            .unwrap();
            assert_eq!(result["admission_paused"], true);
            assert_eq!(result["firm_id"], firm.to_string());
            assert!(observations >= 3); // current identity also checked after the successful read
            server.await.unwrap();
        }

        #[tokio::test]
        async fn refused_connection_is_observed_until_the_same_service_listens() {
            let firm = uuid::Uuid::new_v4();
            // Reserve the port without listening: the initial probe must receive
            // ConnectionRefused, and no competing test can acquire this address.
            let socket = tokio::net::TcpSocket::new_v4().unwrap();
            socket.bind("127.0.0.1:0".parse().unwrap()).unwrap();
            let url = format!("http://{}/conditions", socket.local_addr().unwrap())
                .parse()
                .unwrap();
            let mut pending_socket = Some(socket);
            let mut server = None;
            let mut observations = 0;
            let result = wait(&client(), &url, firm, || {
                observations += 1;
                if observations == 2 {
                    let listener = pending_socket.take().unwrap().listen(1).unwrap();
                    server = Some(tokio::spawn(async move {
                        respond(
                            listener.accept().await.unwrap().0,
                            "200 OK",
                            &conditions(firm),
                        )
                        .await;
                    }));
                }
                std::future::ready(Ok(()))
            })
            .await
            .unwrap();
            assert_eq!(observations, 3);
            assert_eq!(result["admission_paused"], true);
            server.unwrap().await.unwrap();
        }

        #[tokio::test]
        async fn denial_and_wrong_identity_are_terminal_without_fallback() {
            for (status, wrong_firm, expected) in [
                ("401 Unauthorized", false, "Gateway readiness denied"),
                ("403 Forbidden", false, "Gateway readiness denied"),
                ("200 OK", true, "unexpected conditions identity"),
            ] {
                let firm = uuid::Uuid::new_v4();
                let (listener, url) = listener().await;
                let body = conditions(if wrong_firm {
                    uuid::Uuid::new_v4()
                } else {
                    firm
                });
                let server = tokio::spawn(async move {
                    respond(listener.accept().await.unwrap().0, status, &body).await;
                });
                let mut observations = 0;
                let error = wait(&client(), &url, firm, || {
                    observations += 1;
                    std::future::ready(Ok(()))
                })
                .await
                .unwrap_err();
                assert!(error.to_string().contains(expected));
                assert_eq!(observations, 1);
                server.await.unwrap();
            }
        }

        #[tokio::test]
        async fn successful_response_cannot_hide_invocation_replacement() {
            let firm = uuid::Uuid::new_v4();
            let (listener, url) = listener().await;
            let server = tokio::spawn(async move {
                respond(
                    listener.accept().await.unwrap().0,
                    "200 OK",
                    &conditions(firm),
                )
                .await;
            });
            let observations = Arc::new(AtomicUsize::new(0));
            let error = wait(&client(), &url, firm, || {
                let previous = observations.fetch_add(1, Ordering::SeqCst);
                std::future::ready(if previous == 0 {
                    Ok(())
                } else {
                    Err(anyhow::anyhow!("invocation changed"))
                })
            })
            .await
            .unwrap_err();
            assert_eq!(error.to_string(), "invocation changed");
            assert_eq!(observations.load(Ordering::SeqCst), 2);
            server.await.unwrap();
        }

        #[tokio::test]
        async fn fixed_deadline_also_bounds_unresponsive_manager_observation() {
            let firm = uuid::Uuid::new_v4();
            let (_listener, url) = listener().await;
            let result = tokio::time::timeout(
                Duration::from_secs(12),
                wait(&client(), &url, firm, || {
                    std::future::pending::<Result<()>>()
                }),
            )
            .await
            .expect("manager reads must share the readiness deadline");
            assert_eq!(
                result.unwrap_err().to_string(),
                "authenticated Gateway readiness deadline exceeded"
            );
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use super::*;
    use serde::Deserialize;
    use std::{collections::BTreeMap, process::Stdio, time::Duration};
    use tokio::io::AsyncReadExt;

    async fn ctl(args: &[&str]) -> Result<String> {
        let mut child = tokio::process::Command::new("/usr/bin/systemctl")
            .args(args)
            .env_clear()
            .env("PATH", "/usr/bin:/bin")
            .env("SYSTEMD_COLORS", "0")
            .env("SYSTEMD_PAGER", "")
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .stdout(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?;
        let mut output = child.stdout.take().unwrap().take(65537);
        let mut bytes = Vec::new();
        tokio::time::timeout(Duration::from_secs(20), async {
            output.read_to_end(&mut bytes).await?;
            ensure!(
                bytes.len() <= 65536,
                "service manager output exceeded bound"
            );
            ensure!(
                child.wait().await?.success(),
                "service manager command failed; inspect original state before retry"
            );
            Ok::<_, anyhow::Error>(())
        })
        .await
        .map_err(|_| anyhow::anyhow!("service manager outcome unresolved; no automatic retry"))??;
        Ok(String::from_utf8(bytes)?)
    }

    async fn state(name: &str) -> Result<BTreeMap<String, String>> {
        let text = ctl(&[
            "show",
            name,
            "--property=LoadState,ActiveState,MainPID,FragmentPath,DropInPaths,NeedDaemonReload,ControlGroup,Job,InvocationID",
        ])
        .await?;
        text.lines()
            .map(|line| {
                let (key, value) = line
                    .split_once('=')
                    .ok_or_else(|| anyhow::anyhow!("invalid manager observation"))?;
                Ok((key.to_owned(), value.to_owned()))
            })
            .collect()
    }

    fn loaded(s: &BTreeMap<String, String>, directory: &Path, name: &str) -> Result<()> {
        ensure!(
            s.get("LoadState").map(String::as_str) == Some("loaded")
                && s.get("FragmentPath")
                    == Some(&directory.join(name).to_string_lossy().into_owned())
                && s.get("DropInPaths").is_some_and(String::is_empty)
                && s.get("NeedDaemonReload").map(String::as_str) == Some("no"),
            "loaded service differs from the installed bundle"
        );
        Ok(())
    }

    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct ClientConfig {
        gateway_url: String,
        tls: ouroboros_transport::TlsFiles,
    }

    fn client(input: &Start<'_>) -> Result<(reqwest::Client, reqwest::Url)> {
        let (mut cfg, root) =
            ouroboros_transport::config::load::<ClientConfig>(&input.client_config)?;
        cfg.tls.resolve_paths(&root)?;
        let mut url = reqwest::Url::parse(&cfg.gateway_url)?;
        let (server, _) = ouroboros_transport::config::load::<Value>(&input.gateway_config)?;
        let listen: std::net::SocketAddr = server["listen"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Gateway listener missing"))?
            .parse()?;
        // The first host profile uses a literal, exact local listener, never DNS discovery.
        let host: std::net::IpAddr = url
            .host_str()
            .unwrap_or_default()
            .trim_matches(['[', ']'])
            .parse()?;
        ensure!(
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none()
                && host.is_loopback()
                && host == listen.ip()
                && url.port_or_known_default() == Some(listen.port()),
            "readiness client must select this bundle's exact local Gateway listener"
        );
        url.set_path("/conditions");
        Ok((ouroboros_transport::client(&cfg.tls)?, url))
    }

    async fn unchanged_controls(
        expected: &BTreeMap<String, BTreeMap<String, String>>,
        directory: &Path,
    ) -> Result<()> {
        ensure!(!expected.is_empty(), "control readiness identities missing");
        for (name, original) in expected {
            let current = state(name).await?;
            loaded(&current, directory, name)?;
            ensure!(
                current.get("ActiveState").map(String::as_str) == Some("active")
                    && current.get("MainPID").is_some_and(|pid| pid != "0")
                    && current.get("MainPID") == original.get("MainPID")
                    && current.get("InvocationID").is_some_and(|id| !id.is_empty())
                    && current.get("InvocationID") == original.get("InvocationID")
                    && current.get("Job").is_some_and(String::is_empty),
                "control invocation changed or stopped while awaiting Gateway readiness"
            );
        }
        Ok(())
    }

    async fn inventory(
        client: &reqwest::Client,
        base: &reqwest::Url,
        firm: uuid::Uuid,
        delegation: uuid::Uuid,
    ) -> Result<Value> {
        let mut url = base.clone();
        url.set_path(&format!("/environment/status/{delegation}"));
        let mut response = client
            .get(url)
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("current maintenance inventory unavailable"))?;
        ensure!(
            response.status() == reqwest::StatusCode::OK,
            "maintenance inventory denied or unavailable"
        );
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            ensure!(
                bytes.len() + chunk.len() <= 65536,
                "inventory exceeded bound"
            );
            bytes.extend_from_slice(&chunk);
        }
        let value: Value = serde_json::from_slice(&bytes)?;
        ensure!(
            value["firm_id"] == firm.to_string()
                && value["source"] == "core_records"
                && value["admission_paused"] == true,
            "separately authorized admission pause required"
        );
        Ok(value)
    }

    fn cgroup_events(s: &BTreeMap<String, String>) -> Result<Option<std::fs::File>> {
        use std::os::unix::fs::OpenOptionsExt;
        let group = s
            .get("ControlGroup")
            .ok_or_else(|| anyhow::anyhow!("missing cgroup observation"))?;
        if group.is_empty() {
            ensure!(
                s.get("MainPID").map(String::as_str) == Some("0")
                    && matches!(
                        s.get("ActiveState").map(String::as_str),
                        Some("inactive" | "failed")
                    ),
                "active unit lacks a cgroup"
            );
            return Ok(None);
        }
        let relative = group
            .strip_prefix('/')
            .ok_or_else(|| anyhow::anyhow!("invalid cgroup path"))?;
        ensure!(
            !relative.is_empty()
                && Path::new(relative)
                    .components()
                    .all(|c| matches!(c, std::path::Component::Normal(_))),
            "invalid cgroup path"
        );
        Ok(Some(
            std::fs::OpenOptions::new()
                .read(true)
                .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC)
                .open(
                    Path::new("/sys/fs/cgroup")
                        .join(relative)
                        .join("cgroup.events"),
                )?,
        ))
    }
    fn empty(events: &std::fs::File) -> Result<bool> {
        use std::os::unix::fs::FileExt;
        let mut bytes = [0; 4096];
        let size = match events.read_at(&mut bytes, 0) {
            Ok(size) => size,
            Err(e) if e.raw_os_error() == Some(libc::ENODEV) => return Ok(true),
            Err(e) => return Err(e.into()),
        };
        Ok(std::str::from_utf8(&bytes[..size])?
            .lines()
            .any(|l| l == "populated 0"))
    }

    pub async fn inspect(
        report: &Value,
        directory: &Path,
        receipts: &Path,
        reviewed: &str,
        operation: Option<uuid::Uuid>,
    ) -> Result<Value> {
        let proof =
            crate::service_install::verify_completed(report, directory, receipts, reviewed)?;
        let mut observations = Vec::new();
        for unit in report["units"].as_array().unwrap() {
            let name = unit["name"].as_str().unwrap();
            let observed = match state(name).await {
                Ok(s) => {
                    let matches = loaded(&s, directory, name).is_ok();
                    let group = match cgroup_events(&s) {
                        Ok(Some(events)) => match empty(&events) {
                            Ok(true) => "empty",
                            Ok(false) => "populated",
                            Err(_) => "unavailable",
                        },
                        Ok(None) => "no_current_unit_cgroup",
                        Err(_) => "unavailable",
                    };
                    json!({"unit":name,"source":"service_manager","manager":s,"matches_installed_fragment":matches,"cgroup_observation":group})
                }
                Err(_) => {
                    json!({"unit":name,"source":"service_manager","observation":"unavailable"})
                }
            };
            observations.push(observed);
        }
        let history = if let Some(id) = operation {
            let start = proof.read_event(&format!("start-{id}.prepared.json"))?;
            let stop = proof.read_event(&format!("stop-{id}.prepared.json"))?;
            let (kind, prepared) = match (start, stop) {
                (Some(v), None) => ("start", v),
                (None, Some(v)) => ("stop", v),
                _ => anyhow::bail!("operation missing or ambiguous"),
            };
            ensure!(
                prepared["bundle_sha256"] == reviewed,
                "operation belongs to another bundle"
            );
            let order = report[if kind == "start" {
                "start_order"
            } else {
                "stop_order"
            }]
            .as_array()
            .unwrap();
            let mut steps = Vec::new();
            // Stop indices enumerate the selected phase; start indices enumerate the full bundle.
            let phase = prepared["phase"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("operation phase missing"))?;
            ensure!(
                matches!(phase, "control" | "runtime"),
                "invalid operation phase"
            );
            for index in 0..order.len() {
                let intent = proof.read_event(&format!("{kind}-{id}.{index}.intent.json"))?;
                let observed = proof.read_event(&format!("{kind}-{id}.{index}.observed.json"))?;
                ensure!(
                    observed.is_none() || intent.is_some(),
                    "operation observation lacks intent"
                );
                if let Some(intent) = intent {
                    let unit = intent["unit"]
                        .as_str()
                        .ok_or_else(|| anyhow::anyhow!("operation unit missing"))?;
                    ensure!(
                        order.iter().any(|n| n == unit)
                            && observed.as_ref().is_none_or(|v| v["unit"] == unit),
                        "operation unit mismatch"
                    );
                    steps.push(json!({"index":index,"unit":unit,"intent":intent,"recorded_observation":observed,
                        "record_state":if observed.is_some(){"observation_recorded"}else{"requested_outcome_unrecorded"}}));
                }
            }
            let completion = proof.read_event(&format!("{kind}-{id}.complete.json"))?;
            if let Some(done) = &completion {
                ensure!(
                    done["bundle_sha256"] == reviewed
                        && done["operation_id"] == id.to_string()
                        && done["phase"] == phase,
                    "completion context mismatch"
                );
            }
            json!({"operation_id":id,"kind":kind,"phase":phase,"source":"protected_operation_records",
                "completion_recorded":completion.is_some(),"completion":completion,"steps":steps,
                "current_state_proven_by_history":false})
        } else {
            Value::Null
        };
        Ok(
            json!({"status":"observed","installation_verified":true,"bundle_sha256":reviewed,
            "units":observations,"operation":history,"application_inventory":"not_queried","sequential_observations":true,
            "authority_changed":false,"actions_performed":false,"recovery_authorized":false,"backup_ready":false}),
        )
    }

    pub async fn stop(input: Start<'_>, delegation: uuid::Uuid) -> Result<Value> {
        use std::os::unix::fs::MetadataExt;
        let proof = crate::service_install::verify_completed(
            input.report,
            input.directory,
            input.receipts,
            input.reviewed,
        )?;
        ensure!(
            matches!(
                input.directory.to_str(),
                Some("/run/systemd/system" | "/etc/systemd/system")
            ),
            "supported manager directory required"
        );
        let (client, url) = client(&input)?;
        let before = inventory(&client, &url, input.firm, delegation).await?;
        let names: Vec<&str> = input.report["stop_order"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        let is_runtime = |name: &str| input.runtime_names.iter().any(|n| n == name);
        if matches!(input.phase, Phase::Control) {
            for field in [
                "instances_without_termination",
                "runtime_records_without_termination",
                "dispatched_resources_without_reply",
            ] {
                ensure!(
                    before[field].as_u64() == Some(0),
                    "unresolved execution/effect records require control services to remain available"
                );
            }
            for name in names.iter().filter(|n| is_runtime(n)) {
                let s = state(name).await?;
                loaded(&s, input.directory, name)?;
                ensure!(
                    s.get("MainPID").map(String::as_str) == Some("0")
                        && matches!(
                            s.get("ActiveState").map(String::as_str),
                            Some("inactive" | "failed")
                        ),
                    "Runtime must stop before control services"
                );
                if let Some(events) = cgroup_events(&s)? {
                    ensure!(empty(&events)?, "Runtime cgroup remains populated");
                }
            }
        }
        let mut targets = Vec::new();
        for name in names {
            if is_runtime(name) != matches!(input.phase, Phase::Runtime) {
                continue;
            }
            let s = state(name).await?;
            loaded(&s, input.directory, name)?;
            ensure!(
                matches!(
                    s.get("ActiveState").map(String::as_str),
                    Some("active" | "inactive" | "failed")
                ),
                "manager transition already pending"
            );
            ensure!(
                s.get("Job").is_some_and(String::is_empty),
                "service manager job is pending"
            );
            let events = cgroup_events(&s)?;
            targets.push((name, s, events));
        }
        let operation = uuid::Uuid::new_v4();
        let phase = if matches!(input.phase, Phase::Runtime) {
            "runtime"
        } else {
            "control"
        };
        proof.event(&format!("stop-{operation}.prepared.json"),&json!({"bundle_sha256":input.reviewed,"phase":phase,"source":"host_maintenance","inventory_before":before,"boot_id":boot_id()?,"firm_id":input.firm,"units_before":targets.iter().map(|(name,state,_)|json!({"unit":name,"manager":state})).collect::<Vec<_>>()}))?;
        for (index, (name, before, events)) in targets.into_iter().enumerate() {
            let identity = events
                .as_ref()
                .map(|f| {
                    f.metadata()
                        .map(|m| json!({"device":m.dev(),"inode":m.ino()}))
                })
                .transpose()?;
            proof.event(&format!("stop-{operation}.{index}.intent.json"),&json!({"unit":name,"manager_before":before,"cgroup_events":identity,"status":"stop_requested"}))?;
            ctl(&["stop", name]).await?;
            let after = state(name).await?;
            loaded(&after, input.directory, name)?;
            ensure!(
                after.get("MainPID").map(String::as_str) == Some("0")
                    && matches!(
                        after.get("ActiveState").map(String::as_str),
                        Some("inactive" | "failed")
                    ),
                "unit termination unconfirmed"
            );
            if let Some(events) = events {
                ensure!(empty(&events)?, "original unit cgroup remains populated");
            }
            proof.event(&format!("stop-{operation}.{index}.observed.json"),&json!({"unit":name,"manager_after":after,"unit_cgroup_empty":true,"external_obligations_settled":false}))?;
        }
        if matches!(input.phase, Phase::Runtime) {
            let after = inventory(&client, &url, input.firm, delegation).await?;
            proof.event(&format!("stop-{operation}.inventory.json"), &after)?;
        }
        let result = json!({"status":"phase_stopped","phase":phase,"operation_id":operation,"bundle_sha256":input.reviewed,"authority_changed":false,"obligations_settled":false,"backup_ready":false});
        proof.event(&format!("stop-{operation}.complete.json"), &result)?;
        Ok(result)
    }

    fn boot_id() -> Result<String> {
        let text = std::fs::read_to_string("/proc/sys/kernel/random/boot_id")?;
        Ok(uuid::Uuid::parse_str(text.trim())?.to_string())
    }

    pub async fn start(input: Start<'_>) -> Result<Value> {
        let proof = crate::service_install::verify_completed(
            input.report,
            input.directory,
            input.receipts,
            input.reviewed,
        )?;
        ensure!(
            matches!(
                input.directory.to_str(),
                Some("/run/systemd/system" | "/etc/systemd/system")
            ),
            "supported system-manager directory required"
        );
        let (client, url) = client(&input)?; // validate all client inputs before manager mutations
        let names: Vec<&str> = input.report["start_order"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap())
            .collect();
        let is_runtime = |name: &str| input.runtime_names.iter().any(|n| n == name);
        let boot = boot_id()?;
        if let Some(origin) = input.resume_control {
            ensure!(
                matches!(input.phase, Phase::Control),
                "only control startup can be resumed"
            );
            let prepared = proof
                .read_event(&format!("start-{origin}.prepared.json"))?
                .ok_or_else(|| anyhow::anyhow!("original start record missing"))?;
            ensure!(
                prepared["phase"] == "control"
                    && prepared["bundle_sha256"] == input.reviewed
                    && prepared["boot_id"] == boot
                    && prepared["firm_id"] == input.firm.to_string(),
                "original start context differs or predates this boot"
            );
            ensure!(
                proof
                    .read_event(&format!("start-{origin}.complete.json"))?
                    .is_none()
                    && proof
                        .read_event(&format!("start-{origin}.resumed.json"))?
                        .is_none(),
                "original operation is already complete or superseded"
            );
        }
        let restoration = if let Some(origin) = input.restore_control {
            ensure!(
                matches!(input.phase, Phase::Control) && input.resume_control.is_none(),
                "exclusive control restoration required"
            );
            let prior = proof
                .read_event(&format!("stop-{origin}.prepared.json"))?
                .ok_or_else(|| anyhow::anyhow!("original shutdown record missing"))?;
            ensure!(
                prior["phase"] == "control"
                    && prior["boot_id"] == boot
                    && prior["firm_id"] == input.firm.to_string()
                    && prior["bundle_sha256"] == input.reviewed
                    && prior["inventory_before"]["admission_paused"] == true,
                "shutdown context differs or predates this boot"
            );
            ensure!(
                proof
                    .read_event(&format!("stop-{origin}.complete.json"))?
                    .is_none()
                    && proof
                        .read_event(&format!("stop-{origin}.restored.json"))?
                        .is_none(),
                "shutdown is complete or already restored"
            );
            Some((origin, prior))
        } else {
            None
        };
        let mut retained = std::collections::HashSet::new();
        let mut control_instances = BTreeMap::new();
        for (index, name) in names.iter().enumerate() {
            let s = state(name).await?;
            ensure!(
                s.get("Job").is_some_and(String::is_empty),
                "service manager job is pending"
            );
            if let Some(origin) = input.resume_control
                && !is_runtime(name)
            {
                let intent = proof.read_event(&format!("start-{origin}.{index}.intent.json"))?;
                let observed =
                    proof.read_event(&format!("start-{origin}.{index}.observed.json"))?;
                if s.get("ActiveState").map(String::as_str) == Some("active") {
                    let old = observed.ok_or_else(|| {
                        anyhow::anyhow!("active service lacks original observed identity")
                    })?;
                    ensure!(
                        intent.as_ref().is_some_and(|v| v["unit"] == *name)
                            && old["unit"] == *name
                            && old["manager"]["InvocationID"].as_str()
                                == s.get("InvocationID").map(String::as_str)
                            && s.get("InvocationID").is_some_and(|v| !v.is_empty()),
                        "service invocation differs from original observation"
                    );
                    retained.insert(*name);
                } else {
                    ensure!(
                        intent.is_none() && observed.is_none(),
                        "original start outcome requires separate reconciliation"
                    );
                }
            }
            if let Some((origin, prior)) = &restoration
                && !is_runtime(name)
            {
                let baseline = prior["units_before"]
                    .as_array()
                    .ok_or_else(|| anyhow::anyhow!("shutdown baseline missing"))?;
                let (position, old) = baseline
                    .iter()
                    .enumerate()
                    .find(|(_, v)| v["unit"] == *name)
                    .ok_or_else(|| anyhow::anyhow!("unit missing from shutdown baseline"))?;
                if s.get("ActiveState").map(String::as_str) == Some("active") {
                    ensure!(
                        old["manager"]["InvocationID"].as_str()
                            == s.get("InvocationID").map(String::as_str)
                            && s.get("InvocationID").is_some_and(|v| !v.is_empty()),
                        "remaining service invocation changed"
                    );
                    retained.insert(*name);
                } else {
                    let stopped = proof
                        .read_event(&format!("stop-{origin}.{position}.observed.json"))?
                        .ok_or_else(|| {
                            anyhow::anyhow!("stopped unit lacks original termination observation")
                        })?;
                    let requested = proof
                        .read_event(&format!("stop-{origin}.{position}.intent.json"))?
                        .ok_or_else(|| anyhow::anyhow!("stop intent missing"))?;
                    ensure!(
                        stopped["unit"] == *name
                            && stopped["unit_cgroup_empty"] == true
                            && requested["unit"] == *name,
                        "stop observation mismatch"
                    );
                    if let Some(events) = cgroup_events(&s)? {
                        ensure!(empty(&events)?, "stopped cgroup remains populated");
                    }
                }
            }
            let must_be_active = (matches!(input.phase, Phase::Runtime) || retained.contains(name))
                && !is_runtime(name);
            if must_be_active {
                loaded(&s, input.directory, name)?;
                ensure!(
                    s.get("ActiveState").map(String::as_str) == Some("active")
                        && s.get("MainPID").is_some_and(|p| p != "0"),
                    "control service is not active"
                );
                control_instances.insert((*name).to_owned(), s.clone());
            } else {
                ensure!(
                    (s.get("ActiveState").map(String::as_str) == Some("inactive")
                        || (input.restore_control.is_some()
                            && is_runtime(name)
                            && s.get("ActiveState").map(String::as_str) == Some("failed")))
                        && s.get("MainPID").map(String::as_str) == Some("0"),
                    "service is not inactive; inspect before retry"
                );
                if input.restore_control.is_some()
                    && is_runtime(name)
                    && let Some(events) = cgroup_events(&s)?
                {
                    ensure!(empty(&events)?, "Runtime cgroup remains populated");
                }
                if s.get("LoadState").map(String::as_str) != Some("not-found") {
                    loaded(&s, input.directory, name)?;
                }
            }
        }
        let operation = uuid::Uuid::new_v4();
        let phase = if matches!(input.phase, Phase::Control) {
            "control"
        } else {
            "runtime"
        };
        proof.event(&format!("start-{operation}.prepared.json"),&json!({"bundle_sha256":input.reviewed,"phase":phase,"status":"prepared","authority_granted":false,"boot_id":boot,"firm_id":input.firm,"resumes":input.resume_control,"restores_control_after_stop":input.restore_control}))?;
        if matches!(input.phase, Phase::Control) {
            ctl(&["daemon-reload"]).await?;
        }
        for name in &names {
            loaded(&state(name).await?, input.directory, name)?;
        }
        if matches!(input.phase, Phase::Runtime) {
            let observation = readiness::wait(&client, &url, input.firm, || {
                unchanged_controls(&control_instances, input.directory)
            })
            .await?;
            proof.event(&format!("start-{operation}.readiness.json"), &observation)?;
        }
        for (index, name) in names.iter().enumerate() {
            if is_runtime(name) != matches!(input.phase, Phase::Runtime) {
                continue;
            }
            proof.event(
                &format!("start-{operation}.{index}.intent.json"),
                &json!({"unit":name,"status":if retained.contains(name){"observe_existing_no_start"}else{"start_requested"}}),
            )?;
            if !retained.contains(name) {
                ctl(&["start", name]).await?;
            }
            let s = state(name).await?;
            loaded(&s, input.directory, name)?;
            ensure!(
                s.get("ActiveState").map(String::as_str) == Some("active")
                    && s.get("MainPID").is_some_and(|p| p != "0"),
                "service did not remain active; retained intent requires observation"
            );
            if !is_runtime(name)
                && let Some(original) = control_instances.get(*name)
            {
                ensure!(
                    s.get("MainPID") == original.get("MainPID")
                        && s.get("InvocationID") == original.get("InvocationID"),
                    "retained control invocation changed during startup"
                );
            }
            proof.event(
                &format!("start-{operation}.{index}.observed.json"),
                &json!({"unit":name,"manager":s}),
            )?;
            if !is_runtime(name) {
                control_instances.insert((*name).to_owned(), s);
            }
        }
        if matches!(input.phase, Phase::Control) {
            let observation = readiness::wait(&client, &url, input.firm, || {
                unchanged_controls(&control_instances, input.directory)
            })
            .await?;
            proof.event(&format!("start-{operation}.readiness.json"), &observation)?;
        }
        let result = json!({"status":"phase_started","phase":phase,"operation_id":operation,"bundle_sha256":input.reviewed,"authority_granted":false,"boot_enabled":false});
        proof.event(&format!("start-{operation}.complete.json"), &result)?;
        if let Some(origin) = input.resume_control {
            proof.event(&format!("start-{origin}.resumed.json"),&json!({"operation_id":operation,"bundle_sha256":input.reviewed,"existing_units_retained":retained.len()}))?;
        }
        if let Some(origin) = input.restore_control {
            proof.event(&format!("stop-{origin}.restored.json"),&json!({"operation_id":operation,"bundle_sha256":input.reviewed,
                "existing_units_retained":retained.len(),"shutdown_completed":false,"current_gateway_verified":true}))?;
        }
        Ok(result)
    }
}

pub async fn start(input: Start<'_>) -> Result<Value> {
    #[cfg(target_os = "linux")]
    {
        linux::start(input).await
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (
            input.report,
            input.directory,
            input.receipts,
            input.reviewed,
            input.phase,
            input.runtime_names,
            input.gateway_config,
            input.client_config,
            input.firm,
            input.resume_control,
            input.restore_control,
        );
        anyhow::bail!("service-manager application requires the qualified Linux host")
    }
}

pub async fn stop(input: Start<'_>, delegation: uuid::Uuid) -> Result<Value> {
    #[cfg(target_os = "linux")]
    {
        linux::stop(input, delegation).await
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = delegation;
        start(input).await
    }
}

pub async fn inspect(
    report: &Value,
    directory: &Path,
    receipts: &Path,
    reviewed: &str,
    operation: Option<uuid::Uuid>,
) -> Result<Value> {
    #[cfg(target_os = "linux")]
    {
        linux::inspect(report, directory, receipts, reviewed, operation).await
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (report, directory, receipts, reviewed, operation);
        anyhow::bail!("host inspection requires the qualified Linux host")
    }
}
