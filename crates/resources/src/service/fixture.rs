//! Deterministic environment fixture protocol. No real model request or credential is used.
use super::reply;
use anyhow::{Context, Result, ensure};
use ouroboros_contracts::ResourceReply;
use serde_json::{Value, json};

pub(super) fn mcp(input: &Value) -> Result<ResourceReply> {
    ensure!(input["jsonrpc"] == "2.0", "MCP JSON-RPC required");
    let result = match input["method"].as_str() {
        Some("initialize") => {
            json!({"protocolVersion":"2025-11-25","capabilities":{"tools":{}},"serverInfo":{"name":"ouroboros-fixture","version":"0.1.0"}})
        }
        Some("notifications/initialized") => {
            return Ok(ResourceReply {
                status: 202,
                content_type: "application/json".into(),
                body: String::new(),
                receipt: json!({"source":"mcp_fixture","notification":"initialized"}),
            });
        }
        Some("tools/list") => {
            json!({"tools":[{"name":"fixture_echo","description":"Return the supplied marker for an environment conformance test.","inputSchema":{"type":"object","properties":{"marker":{"type":"string","maxLength":64}},"required":["marker"],"additionalProperties":false}}]})
        }
        Some("tools/call") => {
            ensure!(
                input["params"]["name"] == "fixture_echo",
                "unregistered MCP tool"
            );
            let marker = input["params"]["arguments"]["marker"]
                .as_str()
                .context("marker required")?;
            ensure!(marker.len() <= 64, "marker bound");
            json!({"content":[{"type":"text","text":marker}],"isError":false})
        }
        _ => anyhow::bail!("unsupported MCP method"),
    };
    Ok(reply(
        json!({"jsonrpc":"2.0","id":input["id"],"result":result}),
        json!({"source":"mcp_fixture","method":input["method"]}),
    ))
}
pub(super) fn model(input: &Value, command: &str) -> Result<ResourceReply> {
    ensure!(
        input["model"] == "fixture-model" && input["stream"] == true,
        "fixture native protocol mismatch"
    );
    let history = input["input"]
        .as_array()
        .context("native input array required")?;
    // A restored thread includes earlier completed fixture calls. Only the current
    // user turn decides whether this synthetic response sequence has finished.
    let history = &history[history
        .iter()
        .rposition(|item| item["role"] == "user")
        .map_or(0, |index| index + 1)..];
    let done = |id: &str| {
        history
            .iter()
            .any(|x| x["type"] == "function_call_output" && x["call_id"] == id)
    };
    let item = if done("fixture_work") {
        json!({"id":"message_fixture","type":"message","role":"assistant","content":[{"type":"output_text","text":"Connected fixture workflow completed.","annotations":[]}]})
    } else if done("fixture_mcp")
        && !done("fixture_managed")
        && command.contains("# ouroboros-managed-mcp")
    {
        let (namespace, name) = input["tools"]
            .as_array()
            .context("native tools missing")?
            .iter()
            .find_map(|tool| {
                if tool["type"] == "namespace" && tool["name"] == "mcp__managed" {
                    tool["tools"]
                        .as_array()?
                        .iter()
                        .find(|v| v["type"] == "function" && v["name"] == "execution_self")
                        .map(|_| (Some("mcp__managed"), "execution_self"))
                } else {
                    tool["name"]
                        .as_str()
                        .filter(|n| *n == "mcp__managed__execution_self")
                        .map(|n| (None, n))
                }
            })
            .context("native managed MCP tool missing")?;
        json!({"id":"fc_managed","type":"function_call","call_id":"fixture_managed","namespace":namespace,"name":name,"arguments":"{}"})
    } else if done("fixture_managed")
        && !done("fixture_adapter")
        && command.contains("# ouroboros-adapter-child ")
    {
        let child = command
            .lines()
            .find_map(|line| line.strip_prefix("# ouroboros-adapter-child "))
            .context("fixture child missing")?;
        let child = uuid::Uuid::parse_str(child)?;
        let (namespace, name) = input["tools"]
            .as_array()
            .context("native tools missing")?
            .iter()
            .find_map(|tool| {
                if tool["type"] == "namespace" && tool["name"] == "mcp__managed" {
                    tool["tools"].as_array()?.iter().find_map(|v| {
                        v["name"]
                            .as_str()
                            .filter(|n| n.starts_with("invoke_"))
                            .map(|n| (Some("mcp__managed"), n))
                    })
                } else {
                    tool["name"]
                        .as_str()
                        .filter(|n| n.starts_with("mcp__managed__invoke_"))
                        .map(|n| (None, n))
                }
            })
            .context("approved native adapter missing")?;
        json!({"id":"fc_adapter","type":"function_call","call_id":"fixture_adapter","namespace":namespace,"name":name,"arguments":json!({"request_key":"native-adapter-call","agent_delegation_id":child}).to_string()})
    } else if done("fixture_mcp") {
        json!({"id":"fc_work","type":"function_call","call_id":"fixture_work","name":"exec_command","arguments":json!({"cmd":command,"max_output_tokens":1000,"yield_time_ms":10000}).to_string()})
    } else {
        let (namespace, name) = input["tools"]
            .as_array()
            .context("native tools missing")?
            .iter()
            .find_map(|tool| {
                if tool["type"] == "namespace" && tool["name"] == "mcp__fixture" {
                    tool["tools"]
                        .as_array()?
                        .iter()
                        .find(|child| {
                            child["type"] == "function" && child["name"] == "fixture_echo"
                        })
                        .map(|_| (Some("mcp__fixture"), "fixture_echo"))
                } else {
                    tool["name"]
                        .as_str()
                        .filter(|name| {
                            matches!(*name, "fixture_echo" | "mcp__fixture__fixture_echo")
                        })
                        .map(|name| (None, name))
                }
            })
            .context("native MCP tool missing")?;
        json!({"id":"fc_mcp","type":"function_call","call_id":"fixture_mcp","namespace":namespace,"name":name,"arguments":json!({"marker":"ouroboros-native-mcp"}).to_string()})
    };
    let response = json!({"id":"response_fixture","object":"response","model":"fixture-model","status":"completed","output":[item],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}});
    let events = vec![
        json!({"type":"response.created","response":{"id":"response_fixture","status":"in_progress","output":[]}}),
        json!({"type":"response.output_item.added","output_index":0,"item":item}),
        json!({"type":"response.output_item.done","output_index":0,"item":item}),
        json!({"type":"response.completed","response":response}),
    ];
    let body = events
        .into_iter()
        .map(|e| {
            format!(
                "event: {}\ndata: {}\n\n",
                e["type"].as_str().expect("fixed event"),
                e
            )
        })
        .collect::<String>();
    Ok(ResourceReply {
        status: 200,
        content_type: "text/event-stream".into(),
        body,
        receipt: json!({"source":"model_fixture","provider_call":false}),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fixture_preserves_registered_mcp_namespace() {
        let mut input = json!({"model":"fixture-model","stream":true,"input":[],"tools":[
            {"type":"namespace","name":"mcp__fixture","tools":[{"type":"function","name":"fixture_echo"}]}]});
        let response = model(&input, "unused").unwrap();
        let event: Value = serde_json::from_str(
            response
                .body
                .lines()
                .find(|line| line.starts_with("data: ") && line.contains("response.completed"))
                .unwrap()
                .trim_start_matches("data: "),
        )
        .unwrap();
        assert_eq!(event["response"]["output"][0]["namespace"], "mcp__fixture");
        assert_eq!(event["response"]["output"][0]["name"], "fixture_echo");
        input["tools"][0]["name"] = json!("unrelated_namespace");
        assert!(model(&input, "unused").is_err());
        input["tools"] = json!([{"name":"fixture_echo"}]);
        assert!(model(&input, "unused").is_ok());
    }

    #[test]
    fn fixture_resumed_turn_does_not_inherit_previous_completion() {
        let mut input = json!({"model":"fixture-model","stream":true,"input":[
            {"role":"user","content":"previous task"},
            {"type":"function_call_output","call_id":"fixture_work","output":"done"},
            {"role":"user","content":"continue from recorded state"}
        ],"tools":[{"name":"fixture_echo"}]});
        let output = |input: &Value| -> Value {
            let response = model(input, "read existing result").unwrap();
            let event: Value = serde_json::from_str(
                response
                    .body
                    .lines()
                    .find(|line| line.starts_with("data: ") && line.contains("response.completed"))
                    .unwrap()
                    .trim_start_matches("data: "),
            )
            .unwrap();
            event["response"]["output"][0].clone()
        };
        assert_eq!(output(&input)["call_id"], "fixture_mcp");
        input["input"]
            .as_array_mut()
            .unwrap()
            .push(json!({"type":"function_call_output","call_id":"fixture_mcp","output":"ok"}));
        assert_eq!(output(&input)["call_id"], "fixture_work");
        input["input"]
            .as_array_mut()
            .unwrap()
            .push(json!({"type":"function_call_output","call_id":"fixture_work","output":"done"}));
        assert_eq!(output(&input)["type"], "message");
    }
}
