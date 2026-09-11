//! Qualified fixture entry point for the real, unmodified native harness.
//! No provider credentials, user-supplied executable, or model routing fallback.
use anyhow::{Context, Result, ensure};
use bollard::{Docker, container::LogOutput, exec::StartExecResults, models::ExecConfig};
use futures_util::StreamExt;
use serde_json::{Value, json};
use std::{fs::OpenOptions, io::Write, os::unix::fs::OpenOptionsExt, path::Path};
use tokio::io::{AsyncRead, AsyncWrite, AsyncWriteExt};

struct Pump(tokio::task::JoinHandle<Result<()>>);
impl Drop for Pump {
    fn drop(&mut self) {
        self.0.abort();
    }
}
async fn next<R: AsyncRead + Unpin, W: AsyncWrite + Unpin>(
    channel: &mut super::native::Channel<R, W>,
    log: &mut std::fs::File,
    bytes: &mut usize,
) -> Result<Value> {
    let frame = channel.receive().await?;
    let mut line = serde_json::to_vec(&frame)?;
    line.push(b'\n');
    *bytes += line.len();
    ensure!(*bytes <= 2_097_152, "native evidence bound exhausted");
    log.write_all(&line)?;
    log.sync_data()?;
    // The fixture is noninteractive. An unexpected native approval must never be auto-approved.
    ensure!(
        frame.get("method").is_none() || frame.get("id").is_none(),
        "unexpected native server request"
    );
    Ok(frame)
}
async fn answer<R: AsyncRead + Unpin, W: AsyncWrite + Unpin>(
    channel: &mut super::native::Channel<R, W>,
    log: &mut std::fs::File,
    bytes: &mut usize,
    id: u64,
) -> Result<(Value, Vec<Value>)> {
    let mut events = Vec::new();
    loop {
        let f = next(channel, log, bytes).await?;
        if f["id"].as_u64() == Some(id) {
            ensure!(f.get("error").is_none(), "native control request failed");
            return Ok((f["result"].clone(), events));
        }
        ensure!(events.len() < 512, "native pending event bound exhausted");
        events.push(f);
    }
}
pub async fn run(
    docker: &Docker,
    cid: &str,
    root: &Path,
    observer: (&reqwest::Client, &str, uuid::Uuid),
    ticket: Option<&ouroboros_contracts::RuntimeTicket>,
) -> Result<()> {
    let invocation = ticket
        .and_then(|t| t.input.program.as_ref())
        .and_then(|p| p.native.as_ref());
    if invocation.and_then(|i| i.resume.as_ref()).is_some() {
        tokio::time::timeout(
            std::time::Duration::from_secs(5),
            super::native_checkpoint::restore(
                docker,
                cid,
                root,
                ticket.context("native ticket missing")?,
            ),
        )
        .await??;
    }
    let mut settings: Vec<String> = [
        "model=\"fixture-model\"",
        "model_provider=\"ouroboros\"",
        "model_providers.ouroboros.name=\"Ouroboros controlled fixture\"",
        "model_providers.ouroboros.base_url=\"http://127.0.0.1:18080/v1\"",
        "model_providers.ouroboros.wire_api=\"responses\"",
        "model_providers.ouroboros.requires_openai_auth=false",
        "model_providers.ouroboros.request_max_retries=0",
        "model_providers.ouroboros.stream_max_retries=0",
        "model_providers.ouroboros.supports_websockets=false",
        "mcp_servers.fixture.url=\"http://127.0.0.1:18080/mcp\"",
        "mcp_servers.fixture.startup_timeout_sec=10",
        "mcp_servers.fixture.tool_timeout_sec=10",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect();
    if let Some(ticket) = ticket {
        let grant = ticket
            .input
            .agent_delegation_id
            .context("managed MCP requires an instance grant")?;
        settings.extend([
            format!(
                "mcp_servers.managed.url=\"http://127.0.0.1:18080/mcp/work/{}/delegation/{grant}\"",
                ticket.input.work_id
            ),
            "mcp_servers.managed.required=true".into(),
            "mcp_servers.managed.startup_timeout_sec=10".into(),
            "mcp_servers.managed.tool_timeout_sec=10".into(),
        ]);
    }
    // The bounded home tmpfs starts empty; Codex requires its explicit home to exist.
    // Run this fixed bootstrap as the private UID, only after Runtime releases the instance.
    let mut command: Vec<String> = [
        "/bin/sh",
        "-c",
        "umask 077; mkdir -p \"$CODEX_HOME\" && exec \"$@\"",
        "ouroboros-native-bootstrap",
        "/usr/local/bin/codex",
    ]
    .into_iter()
    .map(String::from)
    .collect();
    for setting in settings {
        command.extend(["-c".into(), setting]);
    }
    command.push("app-server".into());
    let exec = docker
        .create_exec(
            cid,
            ExecConfig {
                attach_stdin: Some(true),
                attach_stdout: Some(true),
                attach_stderr: Some(true),
                cmd: Some(command),
                user: Some("65532:65532".into()),
                working_dir: Some("/workspace".into()),
                env: Some(vec![
                    "HOME=/home/agent".into(),
                    "CODEX_HOME=/home/agent/.codex".into(),
                    "PATH=/usr/local/bin:/usr/bin:/bin".into(),
                ]),
                privileged: Some(false),
                ..Default::default()
            },
        )
        .await?;
    let StartExecResults::Attached { mut output, input } =
        docker.start_exec(&exec.id, None).await?
    else {
        anyhow::bail!("native stdio unavailable")
    };
    let (reader, mut writer) = tokio::io::duplex(65536);
    let stderr_path = root.join("native-stderr.log");
    let pump = Pump(tokio::spawn(async move {
        let mut error = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(stderr_path)?;
        let mut n = 0usize;
        while let Some(chunk) = output.next().await {
            match chunk? {
                LogOutput::StdOut { message } => writer.write_all(&message).await?,
                LogOutput::StdErr { message } => {
                    n += message.len();
                    ensure!(n <= 65536, "native stderr bound exhausted");
                    error.write_all(&message)?;
                    error.sync_data()?;
                }
                _ => anyhow::bail!("unexpected native stream"),
            }
        }
        Ok::<(), anyhow::Error>(())
    }));
    let mut channel = super::native::Channel::new(reader, input);
    let result = async {
        let mut log = OpenOptions::new().write(true).create_new(true).mode(0o600).open(root.join("native.jsonl"))?;
        let mut bytes = 0;
        let id = channel.request("initialize",json!({"clientInfo":{"name":"ouroboros_fixture","version":"0.1.0"},"capabilities":{"experimentalApi":true}})).await?;
        answer(&mut channel,&mut log,&mut bytes,id).await?;
        channel.initialized().await?;
        let mut parameters=json!({"cwd":"/workspace","model":"fixture-model","modelProvider":"ouroboros","approvalPolicy":"never","sandbox":"workspace-write"});
        observer.0.get(format!("{}/runtime/executions/{}",observer.1,observer.2)).timeout(std::time::Duration::from_secs(1)).send().await?.error_for_status()?;
        let method=if let Some(resume)=invocation.and_then(|i|i.resume.as_ref()) {parameters["threadId"]=json!(resume.thread_id);"thread/resume"}else{"thread/start"};
        let id = channel.request(method,parameters).await?;
        let (thread, _) = answer(&mut channel,&mut log,&mut bytes,id).await?;
        let thread_id = thread["thread"]["id"].as_str().context("native thread identity missing")?;
        if let Some(resume)=invocation.and_then(|i|i.resume.as_ref()) {ensure!(thread_id==resume.thread_id.to_string(),"resumed native identity changed");}
        observer.0.get(format!("{}/runtime/executions/{}",observer.1,observer.2)).timeout(std::time::Duration::from_secs(1)).send().await?.error_for_status()?;
        let prompt=invocation.map(|i|i.prompt.as_str()).unwrap_or("Execute the authorized environment fixture using the registered MCP tool and the provided resource CLI workflow.");
        let id = channel.request("turn/start",json!({"threadId":thread_id,"input":[{"type":"text","text":prompt,"text_elements":[]}],"approvalPolicy":"never","sandboxPolicy":{"type":"externalSandbox","networkAccess":"enabled"}})).await?;
        let (started, events) = answer(&mut channel,&mut log,&mut bytes,id).await?;
        let mut turn=super::native::ActiveTurn::new(thread_id,&started)?;
        let turn_id=started["turn"]["id"].as_str().context("native turn identity missing")?;
        super::reporting::change(observer.0,observer.1,observer.2,"native-turn",
            json!({"thread_id":thread_id,"turn_id":turn_id,"status":"inProgress"})).await?;
        let mut pending=events.into_iter();
        let mut command: Option<(ouroboros_contracts::NativeControlTicket,u64)> = None;
        let mut terminal=None::<String>;
        let mut poll=tokio::time::interval(std::time::Duration::from_millis(200));
        loop {
            let event=if let Some(event)=pending.next(){event}else{
                tokio::select!{
                    event=next(&mut channel,&mut log,&mut bytes)=>event?,
                    _=poll.tick(), if command.is_none() && terminal.is_none()=>{
                        let ids:Vec<uuid::Uuid>=observer.0.get(format!("{}/runtime/executions/{}/native-controls",observer.1,observer.2))
                            .timeout(std::time::Duration::from_secs(2)).send().await?.error_for_status()?.json().await?;
                        for intent in ids {
                            let url=format!("{}/runtime/native-controls/{intent}",observer.1);
                            let response=observer.0.post(format!("{url}/claim")).json(&json!({})).timeout(std::time::Duration::from_secs(2)).send().await?;
                            if matches!(response.status().as_u16(),403|409){continue;}
                            let ticket:ouroboros_contracts::NativeControlTicket=response.error_for_status()?.json().await?;
                            ensure!(ticket.execution_id==observer.2 && ticket.request.thread_id==thread_id && ticket.request.turn_id==turn_id,"native command target changed");
                            let mut evidence=OpenOptions::new().write(true).create_new(true).mode(0o600).open(root.join(format!("native-control-{intent}.json")))?;
                            serde_json::to_writer(&mut evidence,&ticket)?;evidence.sync_all()?;
                            std::fs::File::open(root)?.sync_all()?;
                            observer.0.post(format!("{url}/check")).json(&json!({"attempt_id":ticket.attempt_id})).timeout(std::time::Duration::from_secs(2)).send().await?.error_for_status()?;
                            let native_id=match &ticket.request.instruction {
                                ouroboros_contracts::NativeInstruction::Steer{text}=>turn.steer(&mut channel,text).await?,
                                ouroboros_contracts::NativeInstruction::Interrupt=>turn.interrupt(&mut channel).await?,
                            };
                            command=Some((ticket,native_id));break;
                        }
                        continue;
                    }
                }
            };
            if let Some((ticket,id))=&command
                && event["id"].as_u64()==Some(*id) && event.get("method").is_none(){
                    let accepted=event.get("error").is_none();
                    if accepted {
                        match &ticket.request.instruction {
                            ouroboros_contracts::NativeInstruction::Steer{..}=>ensure!(event["result"]["turnId"]==turn_id,"steer acknowledgement targets another turn"),
                            ouroboros_contracts::NativeInstruction::Interrupt=>ensure!(event["result"].is_object(),"invalid interrupt acknowledgement"),
                        }
                    }
                    let ack=ouroboros_contracts::NativeControlAck{attempt_id:ticket.attempt_id,native_request_id:*id,accepted};
                    super::native_receipts::save(root,ticket,&ack)?;
                    super::native_receipts::report(observer.0,observer.1,ticket.intent_id,&ack).await?;
                    command=None;
            }
            if terminal.is_none() && let Some(status)=turn.observe(&event)? {
                    let report=ouroboros_contracts::NativeTurnReport {thread_id:thread_id.to_owned(),turn_id:turn_id.to_owned(),status:status.to_owned()};
                    super::native_receipts::save_terminal(root,observer.2,&report)?;
                    super::reporting::change(observer.0,observer.1,observer.2,"native-turn",json!(report)).await?;
                    terminal=Some(status.to_owned());
            }
            if command.is_none() && terminal.is_some(){
                ensure!(terminal.as_deref()!=Some("failed"),"native turn failed");break;
            }
        }
        tokio::time::timeout(std::time::Duration::from_secs(3),
            super::native_checkpoint::capture(docker,cid,root,observer.2,&thread["thread"],terminal.as_deref().context("terminal observation missing")?)).await??;
        Ok(())
    }.await;
    drop(pump);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn completion_before_start_reply_is_preserved() {
        let (client, mut server) = tokio::io::duplex(4096);
        let (r, w) = tokio::io::split(client);
        let mut channel = super::super::native::Channel::new(r, w);
        server.write_all(b"{\"method\":\"turn/completed\",\"params\":{\"threadId\":\"thread-a\",\"turn\":{\"id\":\"turn-a\",\"status\":\"completed\"}}}\n{\"id\":7,\"result\":{\"turn\":{\"id\":\"turn-a\"}}}\n").await.unwrap();
        let path = std::env::temp_dir().join(format!("native-events-{}", uuid::Uuid::new_v4()));
        let mut log = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)
            .unwrap();
        let (response, pending) = answer(&mut channel, &mut log, &mut 0, 7).await.unwrap();
        assert_eq!(pending.len(), 1);
        let mut turn = super::super::native::ActiveTurn::new("thread-a", &response).unwrap();
        assert_eq!(turn.observe(&pending[0]).unwrap(), Some("completed"));
        drop(log);
        std::fs::remove_file(path).unwrap();
    }
}
