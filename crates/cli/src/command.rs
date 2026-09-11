//! CLI syntax and explicit projection into existing Gateway contracts.
use clap::{Parser, Subcommand};
use ouroboros_contracts::{CollectionRequest, ProgramRequest, RetirementRequest, RetirementTarget};
use serde_json::{Value, json};
use std::path::PathBuf;
#[derive(Parser)]
pub(crate) struct Args {
    #[arg(
        long,
        required_unless_present = "instance",
        conflicts_with = "instance"
    )]
    pub(crate) config: Option<PathBuf>,
    #[arg(long)]
    pub(crate) instance: bool,
    #[command(subcommand)]
    pub(crate) command: Command,
}
#[derive(Subcommand)]
pub(crate) enum Command {
    /// Transfer a credential from non-terminal stdin to an already admitted enrollment.
    /// No secret argument, environment lookup, automatic login or resubmission.
    CredentialSecret {
        intent: uuid::Uuid,
        #[arg(long)]
        work: uuid::Uuid,
        #[arg(long)]
        delegation: uuid::Uuid,
    },
    Request {
        #[arg(value_parser=["GET","POST","PUT"])]
        method: String,
        path: String,
        #[arg(long)]
        input: Option<PathBuf>,
        #[arg(long)]
        key: Option<String>,
        #[arg(long)]
        work: Option<uuid::Uuid>,
        #[arg(long)]
        delegation: Option<uuid::Uuid>,
        /// Registered file-resource target; omitted preserves the legacy catalog target.
        #[arg(long, value_parser = parse_target)]
        target: Option<String>,
        #[arg(long)]
        select: Option<String>,
        #[arg(long)]
        output: Option<PathBuf>,
        /// Client transfer bound only; this cannot enlarge the server's admitted allocation.
        #[arg(long, default_value_t = 65536)]
        max_bytes: u64,
    },
    /// Admit a native control request; acceptance does not confirm native application.
    NativeControl {
        execution: uuid::Uuid,
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        key: String,
    },
    /// Read and write shared conversations through the ordinary Gateway.
    Conversations {
        #[command(subcommand)]
        command: ConversationCommand,
    },
    Conditions,
    Workspaces {
        #[command(subcommand)]
        command: WorkspaceCommand,
    },
    /// Retire an ordinary material reference under an explicit registered policy.
    Retire {
        #[command(subcommand)]
        command: RetirementCommand,
    },
    /// Prepare a fixed collection or explicitly advance one bounded step.
    Collect {
        #[command(subcommand)]
        command: CollectionCommand,
    },
    ListWork {
        #[arg(long)]
        cursor: Option<String>,
    },
    Work {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        key: String,
    },
    Start {
        #[arg(long)]
        input: PathBuf,
        /// Local JSON file containing immutable program inputs and contained argv.
        /// Only its contents are sent; this client file path is never an execution input.
        #[arg(long)]
        program: Option<PathBuf>,
        #[arg(long)]
        key: String,
    },
    Get {
        #[arg(value_parser=["work","executions","intents"])]
        kind: String,
        id: uuid::Uuid,
    },
    Stop {
        id: uuid::Uuid,
        #[arg(long)]
        revision: i64,
        #[arg(long)]
        key: String,
    },
    Revoke {
        id: uuid::Uuid,
        #[arg(long)]
        revision: i64,
        #[arg(long)]
        key: String,
    },
    Events {
        #[arg(long)]
        cursor: String,
    },
}

#[derive(Subcommand)]
pub(crate) enum ConversationCommand {
    List {
        work: uuid::Uuid,
    },
    Read {
        conversation: uuid::Uuid,
        #[arg(long, default_value_t = 0, value_parser = clap::value_parser!(i64).range(0..))]
        cursor: i64,
    },
    /// Store a message; storage does not deliver it to a running native turn.
    Send {
        conversation: uuid::Uuid,
        #[arg(long)]
        delegation: uuid::Uuid,
        /// UTF-8 text file, at most 16 KiB; avoids putting message text in shell arguments.
        #[arg(long)]
        text_file: PathBuf,
        #[arg(long)]
        reply_to: Option<uuid::Uuid>,
        #[arg(long)]
        key: String,
    },
}

pub(crate) fn conversation_request(
    command: ConversationCommand,
) -> anyhow::Result<(&'static str, String, Option<Value>, Option<String>)> {
    Ok(match command {
        ConversationCommand::List { work } => {
            ("GET", format!("/work/{work}/conversations"), None, None)
        }
        ConversationCommand::Read {
            conversation,
            cursor,
        } => (
            "GET",
            format!("/conversations/{conversation}/messages?cursor={cursor}"),
            None,
            None,
        ),
        ConversationCommand::Send {
            conversation,
            delegation,
            text_file,
            reply_to,
            key,
        } => {
            use std::io::Read;
            let mut bytes = Vec::new();
            std::fs::File::open(text_file)?
                .take(16385)
                .read_to_end(&mut bytes)?;
            anyhow::ensure!(bytes.len() <= 16384, "message exceeds 16 KiB");
            let text = String::from_utf8(bytes)?;
            anyhow::ensure!(
                !text.trim().is_empty() && !text.contains('\0'),
                "invalid message text"
            );
            (
                "POST",
                format!("/conversations/{conversation}/messages"),
                Some(json!({"delegation_id":delegation,"text":text,"reply_to":reply_to})),
                Some(key),
            )
        }
    })
}

#[derive(clap::Args)]
pub(crate) struct WorkspaceScope {
    #[arg(long)]
    pub(crate) work: Option<uuid::Uuid>,
    #[arg(long)]
    pub(crate) delegation: Option<uuid::Uuid>,
    /// Existing registered namespace target, for example company-files.
    #[arg(long, value_parser = parse_target)]
    pub(crate) target: Option<String>,
}

#[derive(Subcommand)]
pub(crate) enum WorkspaceCommand {
    Create {
        #[arg(long)]
        label: String,
        #[arg(long)]
        key: String,
        #[command(flatten)]
        scope: WorkspaceScope,
    },
    List {
        #[arg(long)]
        cursor: Option<String>,
        #[command(flatten)]
        scope: WorkspaceScope,
    },
    Show {
        id: uuid::Uuid,
        #[command(flatten)]
        scope: WorkspaceScope,
    },
}

#[derive(clap::Args)]
pub(crate) struct RetirementOptions {
    #[arg(long, value_parser = nonblank_reason)]
    pub(crate) reason: String,
    #[arg(long)]
    pub(crate) policy_id: uuid::Uuid,
    #[arg(long)]
    pub(crate) policy_revision: u64,
    #[arg(long)]
    pub(crate) key: String,
    #[command(flatten)]
    pub(crate) scope: WorkspaceScope,
}

#[derive(Subcommand)]
pub(crate) enum RetirementCommand {
    /// Retire one upload reference; retained data and holds remain independently managed.
    Upload {
        upload_id: uuid::Uuid,
        #[command(flatten)]
        options: RetirementOptions,
    },
    /// Retire one historical workspace revision under the selected policy.
    Revision {
        workspace_id: uuid::Uuid,
        revision: i64,
        #[command(flatten)]
        options: RetirementOptions,
    },
    /// Close workspace writes at the expected revision; preserve old revisions, data and holds.
    Workspace {
        workspace_id: uuid::Uuid,
        #[arg(long)]
        expected_revision: i64,
        #[command(flatten)]
        options: RetirementOptions,
    },
}

#[derive(Subcommand)]
pub(crate) enum CollectionCommand {
    /// Register a collection proposal; this command does not remove any bytes.
    Upload {
        upload_id: uuid::Uuid,
        #[command(flatten)]
        options: RetirementOptions,
    },
    /// Authorize one step for the original fixed collection using current authority.
    Advance {
        intent_id: uuid::Uuid,
        #[arg(long)]
        key: String,
        #[arg(long)]
        work: Option<uuid::Uuid>,
        #[arg(long)]
        delegation: Option<uuid::Uuid>,
    },
}

pub(crate) fn collection_request(
    command: CollectionCommand,
) -> (String, Option<Value>, String, WorkspaceScope) {
    match command {
        CollectionCommand::Upload { upload_id, options } => (
            "/collections".into(),
            Some(json!(CollectionRequest {
                upload_id,
                reason: options.reason,
                policy_id: options.policy_id,
                policy_revision: options.policy_revision,
            })),
            options.key,
            options.scope,
        ),
        CollectionCommand::Advance {
            intent_id,
            key,
            work,
            delegation,
        } => (
            format!("/resource-intents/{intent_id}/advance"),
            None,
            key,
            WorkspaceScope {
                work,
                delegation,
                target: None,
            },
        ),
    }
}

pub(crate) fn execution_input(input: &[u8], program: Option<&[u8]>) -> anyhow::Result<Value> {
    let mut execution: Value = serde_json::from_slice(input)?;
    if let Some(bytes) = program {
        let request: ProgramRequest = serde_json::from_slice(bytes)?;
        let fields = execution
            .as_object_mut()
            .ok_or_else(|| anyhow::anyhow!("execution input must be a JSON object"))?;
        anyhow::ensure!(
            fields.get("program").is_none_or(Value::is_null),
            "program is already present in execution input; select one definition"
        );
        // The client file is just a way to supply the contract. No host path, mount,
        // environment or program-file option is added to the product request.
        fields.insert("program".into(), serde_json::to_value(request)?);
    }
    Ok(execution)
}

pub(crate) fn nonblank_reason(reason: &str) -> Result<String, String> {
    if reason.trim().is_empty() {
        return Err("reason must be explicit and nonblank".into());
    }
    Ok(reason.to_owned())
}

pub(crate) fn retirement_request(
    command: RetirementCommand,
) -> (RetirementRequest, String, WorkspaceScope) {
    let (target, options) = match command {
        RetirementCommand::Upload { upload_id, options } => {
            (RetirementTarget::Upload { upload_id }, options)
        }
        RetirementCommand::Revision {
            workspace_id,
            revision,
            options,
        } => (
            RetirementTarget::Revision {
                workspace_id,
                revision,
            },
            options,
        ),
        RetirementCommand::Workspace {
            workspace_id,
            expected_revision,
            options,
        } => (
            RetirementTarget::WorkspaceClose {
                workspace_id,
                expected_revision,
            },
            options,
        ),
    };
    (
        RetirementRequest {
            target,
            reason: options.reason,
            policy_id: options.policy_id,
            policy_revision: options.policy_revision,
        },
        options.key,
        options.scope,
    )
}

pub(crate) fn parse_target(target: &str) -> Result<String, String> {
    if target.is_empty()
        || target.len() > 128
        || !target.as_bytes()[0].is_ascii_alphanumeric()
        || !target
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"._-".contains(&byte))
    {
        return Err("target must be one registered resource identifier".into());
    }
    Ok(target.to_owned())
}

pub(crate) fn cursor_path(path: &str, cursor: &str) -> String {
    format!(
        "{path}?cursor={}",
        url::form_urlencoded::byte_serialize(cursor.as_bytes()).collect::<String>()
    )
}

/// Local command projection only. Authentication and current authorization stay at the Gateway.
pub(crate) struct ManagementRequest {
    pub(crate) method: &'static str,
    pub(crate) path: String,
    pub(crate) body: Option<Value>,
    pub(crate) key: Option<String>,
    pub(crate) scope: Option<WorkspaceScope>,
}
pub(crate) fn management_request(command: Command) -> anyhow::Result<ManagementRequest> {
    let mut workspace_scope = None;
    let (method, path, body, key) = match command {
        Command::Request { .. } | Command::CredentialSecret { .. } => unreachable!(),
        Command::NativeControl {
            execution,
            input,
            key,
        } => {
            let request: ouroboros_contracts::NativeControlRequest =
                serde_json::from_slice(&std::fs::read(input)?)?;
            (
                "POST",
                format!("/executions/{execution}/native-controls"),
                Some(serde_json::to_value(request)?),
                Some(key),
            )
        }
        Command::Collect { command } => {
            let (path, body, key, scope) = collection_request(command);
            workspace_scope = Some(scope);
            ("POST", path, body, Some(key))
        }
        Command::Retire { command } => {
            let (retirement, key, scope) = retirement_request(command);
            workspace_scope = Some(scope);
            (
                "POST",
                "/retirements".into(),
                Some(serde_json::to_value(retirement)?),
                Some(key),
            )
        }
        Command::Workspaces { command } => match command {
            WorkspaceCommand::Create { label, key, scope } => {
                workspace_scope = Some(scope);
                (
                    "POST",
                    "/workspaces".into(),
                    Some(json!({"label":label})),
                    Some(key),
                )
            }
            WorkspaceCommand::List { cursor, scope } => {
                workspace_scope = Some(scope);
                (
                    "GET",
                    cursor.map_or_else(
                        || "/workspaces".into(),
                        |cursor| cursor_path("/workspaces", &cursor),
                    ),
                    None,
                    None,
                )
            }
            WorkspaceCommand::Show { id, scope } => {
                workspace_scope = Some(scope);
                ("GET", format!("/workspaces/{id}"), None, None)
            }
        },
        Command::Conversations { command } => conversation_request(command)?,
        Command::Conditions => ("GET", "/conditions".into(), None, None),
        Command::ListWork { cursor } => (
            "GET",
            cursor.map_or_else(|| "/work".into(), |cursor| cursor_path("/work", &cursor)),
            None,
            None,
        ),
        Command::Work { input, key } => (
            "POST",
            "/work".into(),
            Some(serde_json::from_slice::<Value>(&std::fs::read(input)?)?),
            Some(key),
        ),
        Command::Start {
            input,
            program,
            key,
        } => {
            let input = std::fs::read(input)?;
            let program = program.map(std::fs::read).transpose()?;
            (
                "POST",
                "/executions".into(),
                Some(execution_input(&input, program.as_deref())?),
                Some(key),
            )
        }
        Command::Get { kind, id } => ("GET", format!("/{kind}/{id}"), None, None),
        Command::Stop { id, revision, key } => (
            "POST",
            format!("/executions/{id}/stop"),
            Some(json!({"expected_revision":revision})),
            Some(key),
        ),
        Command::Revoke { id, revision, key } => (
            "POST",
            format!("/delegations/{id}/revoke"),
            Some(json!({"expected_revision":revision})),
            Some(key),
        ),
        Command::Events { cursor } => ("GET", cursor_path("/events", &cursor), None, None),
    };
    Ok(ManagementRequest {
        method,
        path,
        body,
        key,
        scope: workspace_scope,
    })
}
