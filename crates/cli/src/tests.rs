use crate::client::resource_scope;
use crate::command::*;
use crate::output::{file_stream, write_binary_stream};
use clap::Parser;
use futures_util::StreamExt;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[test]
fn conversation_cli_preserves_text_and_reply_without_identity_claims() {
    let id = uuid::Uuid::new_v4();
    let path = std::env::temp_dir().join(format!("ouro-message-{id}"));
    std::fs::write(&path, "line one\n두 번째 줄").unwrap();
    let parsed = Args::try_parse_from([
        "ouroboros",
        "--instance",
        "conversations",
        "send",
        &id.to_string(),
        "--delegation",
        &id.to_string(),
        "--text-file",
        path.to_str().unwrap(),
        "--reply-to",
        &id.to_string(),
        "--key",
        "message-one",
    ])
    .unwrap();
    let Command::Conversations { command } = parsed.command else {
        panic!()
    };
    let (method, route, body, key) = conversation_request(command).unwrap();
    assert_eq!(method, "POST");
    assert_eq!(route, format!("/conversations/{id}/messages"));
    assert_eq!(key.as_deref(), Some("message-one"));
    assert_eq!(
        body.unwrap(),
        json!({"delegation_id": id, "reply_to": id, "text": "line one\n두 번째 줄"})
    );
    for text in [" ".to_string(), "bad\0text".to_string(), "x".repeat(16385)] {
        std::fs::write(&path, text).unwrap();
        assert!(
            conversation_request(ConversationCommand::Send {
                conversation: id,
                delegation: id,
                text_file: path.clone(),
                reply_to: None,
                key: "same".into()
            })
            .is_err()
        );
    }
    std::fs::remove_file(path).unwrap();
    assert!(
        Args::try_parse_from([
            "ouroboros",
            "--instance",
            "conversations",
            "read",
            &id.to_string(),
            "--cursor=-1"
        ])
        .is_err()
    );
}

fn program_input() -> Value {
    json!({"argv":["/usr/bin/python3","task.py"],"inputs":[{
        "target":"company-files","workspace_id":uuid::Uuid::new_v4(),"revision":1,
        "file":"tasks/task.py","destination":"task.py",
    }]})
}

#[test]
fn start_accepts_optional_local_program_file_without_changing_legacy_syntax() {
    for include_program in [false, true] {
        let mut args = vec![
            "ouro",
            "--instance",
            "start",
            "--input",
            "execution.json",
            "--key",
            "execution-one",
        ];
        if include_program {
            args.extend(["--program", "program.json"]);
        }
        let parsed = Args::try_parse_from(args).unwrap();
        let Command::Start {
            input,
            program,
            key,
        } = parsed.command
        else {
            panic!("start expected")
        };
        assert_eq!(input, PathBuf::from("execution.json"));
        assert_eq!(
            program,
            include_program.then(|| PathBuf::from("program.json"))
        );
        assert_eq!(key, "execution-one");
    }
    let parsed = Args::try_parse_from([
        "ouro",
        "--instance",
        "get",
        "executions",
        &uuid::Uuid::new_v4().to_string(),
    ]);
    assert!(parsed.is_ok());
}

#[test]
fn program_file_contents_are_embedded_without_local_path_or_implicit_execution_options() {
    let legacy = json!({"work_id":uuid::Uuid::new_v4(),"delegation_id":uuid::Uuid::new_v4(),
            "profile_id":"contained-python","units":1,"lifetime_seconds":30});
    let input = serde_json::to_vec(&legacy).unwrap();
    assert_eq!(execution_input(&input, None).unwrap(), legacy);
    let program = program_input();
    let result = execution_input(&input, Some(&serde_json::to_vec(&program).unwrap())).unwrap();
    let mut expected = legacy;
    expected["program"] = program;
    assert_eq!(result, expected);
    assert!(result.get("program_file").is_none());
    assert!(result.get("mounts").is_none());
    assert!(result.get("environment").is_none());
}

#[test]
fn split_program_input_cannot_overwrite_an_existing_program_or_add_host_configuration() {
    let program = program_input();
    let bytes = serde_json::to_vec(&program).unwrap();
    let existing = json!({"program":program});
    assert!(execution_input(&serde_json::to_vec(&existing).unwrap(), Some(&bytes)).is_err());
    assert_eq!(
        execution_input(&serde_json::to_vec(&existing).unwrap(), None).unwrap(),
        existing
    );
    let mut invalid = program;
    invalid["host_path"] = json!("local-only.py");
    assert!(execution_input(b"{}", Some(&serde_json::to_vec(&invalid).unwrap())).is_err());
    assert!(execution_input(b"[]", Some(&bytes)).is_err());
}

fn retirement_args(kind: &str, id: uuid::Uuid, extra: &[&str]) -> Vec<String> {
    let mut args = vec![
        "ouro".into(),
        "--instance".into(),
        "retire".into(),
        kind.into(),
        id.to_string(),
    ];
    args.extend(extra.iter().map(|value| (*value).to_owned()));
    args.extend([
        "--reason".into(),
        "No longer needed for current work".into(),
        "--policy-id".into(),
        uuid::Uuid::new_v4().to_string(),
        "--policy-revision".into(),
        "7".into(),
        "--key".into(),
        "retirement-one".into(),
        "--target".into(),
        "company-files".into(),
    ]);
    args
}

#[test]
fn collection_upload_has_only_explicit_upload_policy_and_scope() {
    let upload = uuid::Uuid::new_v4();
    let mut args = retirement_args("upload", upload, &[]);
    args[2] = "collect".into();
    let parsed = Args::try_parse_from(args.clone()).unwrap();
    let Command::Collect { command } = parsed.command else {
        panic!("collection expected")
    };
    let (path, body, key, scope) = collection_request(command);
    let body = body.unwrap();
    assert_eq!(path, "/collections");
    assert_eq!(body["upload_id"], upload.to_string());
    assert_eq!(body["policy_revision"], 7);
    assert_eq!(body.as_object().unwrap().len(), 4);
    assert_eq!(key, "retirement-one");
    assert_eq!(scope.target.as_deref(), Some("company-files"));
    for flag in ["--reason", "--policy-id", "--policy-revision", "--key"] {
        let mut missing = args.clone();
        let index = missing.iter().position(|value| value == flag).unwrap();
        missing.drain(index..index + 2);
        assert!(Args::try_parse_from(missing).is_err());
    }
}

#[test]
fn collection_advance_has_empty_body_and_no_new_target_or_policy() {
    let intent = uuid::Uuid::new_v4().to_string();
    let work = uuid::Uuid::new_v4().to_string();
    let grant = uuid::Uuid::new_v4().to_string();
    let base = vec![
        "ouro",
        "--instance",
        "collect",
        "advance",
        &intent,
        "--key",
        "step-one",
        "--work",
        &work,
        "--delegation",
        &grant,
    ];
    let parsed = Args::try_parse_from(base.clone()).unwrap();
    let Command::Collect { command } = parsed.command else {
        panic!("collection advance expected")
    };
    let (path, body, key, scope) = collection_request(command);
    assert_eq!(path, format!("/resource-intents/{intent}/advance"));
    assert!(body.is_none());
    assert!(scope.target.is_none());
    assert_eq!(key, "step-one");
    assert_eq!(scope.work.unwrap().to_string(), work);
    assert_eq!(scope.delegation.unwrap().to_string(), grant);
    for extra in [
        ["--target", "company-files"],
        ["--policy-revision", "2"],
        ["--reason", "new"],
    ] {
        let mut invalid = base.clone();
        invalid.extend(extra);
        assert!(Args::try_parse_from(invalid).is_err());
    }
    assert!(Args::try_parse_from(["ouro", "--instance", "collect", "advance", &intent]).is_err());
    assert!(Args::try_parse_from(["ouro", "--instance", "collect", "path", "/data/file"]).is_err());
}

#[test]
fn retirement_commands_serialize_only_explicit_material_targets_and_policy() {
    let id = uuid::Uuid::new_v4();
    for (kind, extra, expected) in [
        ("upload", vec![], json!({"kind":"upload","upload_id":id})),
        (
            "revision",
            vec!["5"],
            json!({"kind":"revision","workspace_id":id,"revision":5}),
        ),
        (
            "workspace",
            vec!["--expected-revision", "5"],
            json!({"kind":"workspace_close","workspace_id":id,"expected_revision":5}),
        ),
    ] {
        let parsed = Args::try_parse_from(retirement_args(kind, id, &extra)).unwrap();
        let Command::Retire { command } = parsed.command else {
            panic!("retirement command expected")
        };
        let (request, key, scope) = retirement_request(command);
        let body = serde_json::to_value(request).unwrap();
        assert_eq!(body["target"], expected);
        assert_eq!(body["reason"], "No longer needed for current work");
        assert_eq!(body["policy_revision"], 7);
        assert!(uuid::Uuid::parse_str(body["policy_id"].as_str().unwrap()).is_ok());
        assert_eq!(key, "retirement-one");
        assert_eq!(scope.target.as_deref(), Some("company-files"));
        assert_eq!(body.as_object().unwrap().len(), 4);
    }
}

#[test]
fn retirement_has_no_implicit_policy_reason_key_or_workspace_revision() {
    let base = retirement_args(
        "workspace",
        uuid::Uuid::new_v4(),
        &["--expected-revision", "2"],
    );
    for flag in [
        "--reason",
        "--policy-id",
        "--policy-revision",
        "--key",
        "--expected-revision",
    ] {
        let mut args = base.clone();
        let index = args.iter().position(|value| value == flag).unwrap();
        args.drain(index..index + 2);
        assert!(
            Args::try_parse_from(args).is_err(),
            "{flag} must be supplied"
        );
    }
    let mut args = base;
    let index = args.iter().position(|value| value == "--reason").unwrap();
    args[index + 1] = "   ".into();
    assert!(Args::try_parse_from(args).is_err());
    assert!(Args::try_parse_from(["ouro", "--instance", "retire", "path", "/data/file"]).is_err());
}

#[test]
fn workspace_commands_keep_work_scope_and_target_explicit() {
    let work = uuid::Uuid::new_v4().to_string();
    let grant = uuid::Uuid::new_v4().to_string();
    let parsed = Args::try_parse_from([
        "ouro",
        "--instance",
        "workspaces",
        "create",
        "--label",
        "Research output",
        "--key",
        "workspace-one",
        "--target",
        "company-files",
        "--work",
        &work,
        "--delegation",
        &grant,
    ])
    .unwrap();
    match parsed.command {
        Command::Workspaces {
            command: WorkspaceCommand::Create { label, key, scope },
        } => {
            assert_eq!(label, "Research output");
            assert_eq!(key, "workspace-one");
            assert_eq!(scope.target.as_deref(), Some("company-files"));
            assert_eq!(scope.work.unwrap().to_string(), work);
            assert_eq!(scope.delegation.unwrap().to_string(), grant);
        }
        _ => panic!("workspace create expected"),
    }
    let parsed = Args::try_parse_from([
        "ouro",
        "--instance",
        "workspaces",
        "list",
        "--cursor",
        "opaque+/=",
        "--target",
        "company-files",
    ])
    .unwrap();
    assert!(
        matches!(parsed.command, Command::Workspaces { command: WorkspaceCommand::List { cursor: Some(cursor), .. } } if cursor == "opaque+/=")
    );
    let id = uuid::Uuid::new_v4();
    let parsed = Args::try_parse_from([
        "ouro",
        "--instance",
        "workspaces",
        "show",
        &id.to_string(),
        "--target",
        "company-files",
    ])
    .unwrap();
    assert!(
        matches!(parsed.command, Command::Workspaces { command: WorkspaceCommand::Show { id: actual, .. } } if actual == id)
    );
}

#[test]
fn file_target_header_does_not_create_identity_or_change_the_gateway_endpoint() {
    let work = uuid::Uuid::new_v4();
    let grant = uuid::Uuid::new_v4();
    let request = resource_scope(
        reqwest::Client::new().post("https://gateway.invalid/uploads"),
        Some(work),
        Some(grant),
        Some("company-files"),
    )
    .build()
    .unwrap();
    assert_eq!(request.url().as_str(), "https://gateway.invalid/uploads");
    assert_eq!(request.headers()["x-ouro-resource-target"], "company-files");
    assert_eq!(request.headers()["x-ouro-work-id"], work.to_string());
    assert_eq!(request.headers()["x-ouro-delegation-id"], grant.to_string());
    assert!(!request.headers().contains_key("x-ouro-client-fingerprint"));
    assert!(!request.headers().contains_key("x-ouro-bridge-peer"));
    let legacy = resource_scope(
        reqwest::Client::new().get("https://gateway.invalid/workspaces"),
        None,
        None,
        None,
    )
    .build()
    .unwrap();
    assert!(!legacy.headers().contains_key("x-ouro-resource-target"));
}

#[test]
fn explicit_target_is_available_for_file_requests_and_rejects_urls() {
    let parsed = Args::try_parse_from([
        "ouro",
        "--instance",
        "request",
        "POST",
        "/uploads",
        "--target",
        "company-files",
    ])
    .unwrap();
    assert!(
        matches!(parsed.command, Command::Request { target: Some(target), .. } if target == "company-files")
    );
    for target in ["https://other.invalid", "catalog,other", "../catalog"] {
        assert!(
            Args::try_parse_from([
                "ouro",
                "--instance",
                "workspaces",
                "list",
                "--target",
                target
            ])
            .is_err()
        );
    }
}

struct Scratch(PathBuf);
impl Scratch {
    fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("ouroboros-cli-binary-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn binary_headers(expected: &[u8]) -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        "content-length",
        expected.len().to_string().parse().unwrap(),
    );
    headers.insert(
        "x-ouro-content-sha256",
        format!("{:x}", Sha256::digest(expected)).parse().unwrap(),
    );
    headers.insert(
        "x-ouro-intent-id",
        uuid::Uuid::new_v4().to_string().parse().unwrap(),
    );
    headers
}
fn chunks(
    bytes: &[u8],
) -> impl futures_util::Stream<Item = Result<bytes::Bytes, std::io::Error>> + use<> {
    let parts: Vec<_> = bytes
        .chunks(8191)
        .map(|part| Ok(bytes::Bytes::copy_from_slice(part)))
        .collect();
    futures_util::stream::iter(parts)
}

#[tokio::test]
async fn binary_file_round_trip_above_64k_preserves_every_byte() {
    let scratch = Scratch::new();
    let source = scratch.0.join("source");
    let destination = scratch.0.join("result");
    let data: Vec<_> = (0..131_071).map(|i| (i % 256) as u8).collect();
    std::fs::write(&source, &data).unwrap();
    let input = file_stream(
        tokio::fs::File::open(&source).await.unwrap(),
        data.len() as u64,
    );
    write_binary_stream(
        &binary_headers(&data),
        input,
        Some(&destination),
        data.len() as u64,
    )
    .await
    .unwrap();
    assert_eq!(std::fs::read(destination).unwrap(), data);
    assert_eq!(std::fs::read_dir(&scratch.0).unwrap().count(), 2);
}

#[tokio::test]
async fn incomplete_mismatched_and_over_limit_downloads_never_publish_a_result() {
    let expected = vec![0x80; 70_001];
    let cases = [
        (expected[..70_000].to_vec(), 80_000),
        (vec![0x81; expected.len()], 80_000),
        ([expected.clone(), vec![0]].concat(), 80_000),
        (expected.clone(), 65_536),
    ];
    for (data, limit) in cases {
        let scratch = Scratch::new();
        let destination = scratch.0.join("result");
        assert!(
            write_binary_stream(
                &binary_headers(&expected),
                chunks(&data),
                Some(&destination),
                limit
            )
            .await
            .is_err()
        );
        assert!(!destination.exists());
        assert_eq!(std::fs::read_dir(&scratch.0).unwrap().count(), 0);
    }
}

#[tokio::test]
async fn verified_download_cannot_replace_an_existing_user_file() {
    let scratch = Scratch::new();
    let destination = scratch.0.join("existing");
    std::fs::write(&destination, b"preserved").unwrap();
    let data = b"new binary content\x00\xff";
    assert!(
        write_binary_stream(&binary_headers(data), chunks(data), Some(&destination), 100)
            .await
            .is_err()
    );
    assert_eq!(std::fs::read(destination).unwrap(), b"preserved");
    assert_eq!(std::fs::read_dir(&scratch.0).unwrap().count(), 1);
}

#[tokio::test]
async fn file_upload_enforces_the_client_bound_while_reading() {
    let scratch = Scratch::new();
    let source = scratch.0.join("source");
    std::fs::write(&source, vec![0xff; 70_001]).unwrap();
    let stream = file_stream(tokio::fs::File::open(source).await.unwrap(), 65_536);
    futures_util::pin_mut!(stream);
    assert_eq!(stream.next().await.unwrap().unwrap().len(), 65_536);
    assert!(stream.next().await.unwrap().is_err());
}

#[test]
fn binary_client_bound_is_explicit_without_changing_json_commands() {
    let args = Args::try_parse_from([
        "ouroboros",
        "--instance",
        "request",
        "GET",
        "/file",
        "--max-bytes",
        "131071",
        "--output",
        "result",
    ])
    .unwrap();
    assert!(matches!(
        args.command,
        Command::Request {
            max_bytes: 131071,
            ..
        }
    ));
}

#[test]
fn list_work_uses_the_same_command_for_human_and_instance_clients() {
    for arguments in [
        vec![
            "ouroboros",
            "--config",
            "client.json",
            "list-work",
            "--cursor",
            "next",
        ],
        vec!["ouroboros", "--instance", "list-work", "--cursor", "next"],
    ] {
        let args = Args::try_parse_from(arguments).unwrap();
        assert!(
            matches!(args.command, Command::ListWork { cursor: Some(cursor) } if cursor == "next")
        );
    }
    let args = Args::try_parse_from(["ouroboros", "--instance", "list-work"]).unwrap();
    assert!(matches!(args.command, Command::ListWork { cursor: None }));
}

#[test]
fn list_and_events_encode_opaque_cursors_as_one_query_value() {
    for path in ["/work", "/events"] {
        let encoded = cursor_path(path, "firm:1&cursor=other/+%");
        let url = reqwest::Url::parse(&format!("https://gateway.invalid{encoded}")).unwrap();
        let query: Vec<_> = url.query_pairs().collect();
        assert_eq!(query.len(), 1);
        assert_eq!(query[0].0, "cursor");
        assert_eq!(query[0].1, "firm:1&cursor=other/+%");
    }
}

#[test]
fn stopping_and_revoking_keep_the_explicit_revision_and_request_key() {
    let id = uuid::Uuid::new_v4();
    for (command, path) in [
        ("stop", format!("/executions/{id}/stop")),
        ("revoke", format!("/delegations/{id}/revoke")),
    ] {
        for mode in [vec!["--instance"], vec!["--config", "human.json"]] {
            let mut argv = vec!["ouroboros"];
            argv.extend(mode);
            let id_text = id.to_string();
            argv.extend([
                command,
                &id_text,
                "--revision",
                "37",
                "--key",
                "original-request",
            ]);
            let parsed = Args::try_parse_from(argv).unwrap();
            let request = management_request(parsed.command).unwrap();
            assert_eq!(request.method, "POST");
            assert_eq!(request.path, path);
            assert_eq!(request.key.as_deref(), Some("original-request"));
            assert_eq!(request.body, Some(json!({"expected_revision": 37})));
            assert!(request.scope.is_none());
        }
    }
}
