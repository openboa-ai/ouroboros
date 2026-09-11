//! Whitelisted provider-reported metadata. Absence and ambiguity never imply zero usage.
use serde_json::{Value, json};

pub fn observe(content_type: &str, body: &str) -> Value {
    let response = if content_type.split(';').next() == Some("application/json") {
        serde_json::from_str::<Value>(body).ok()
    } else {
        let normalized = body.replace("\r\n", "\n");
        if !normalized.is_empty() && !normalized.ends_with("\n\n") {
            return unavailable("incomplete_stream");
        }
        let mut terminal = None;
        for event in normalized.split("\n\n") {
            let data = event
                .lines()
                .filter_map(|line| {
                    line.strip_prefix("data:")
                        .map(|v| v.strip_prefix(' ').unwrap_or(v))
                })
                .collect::<Vec<_>>()
                .join("\n");
            if data.is_empty() || data == "[DONE]" {
                continue;
            }
            let Ok(value) = serde_json::from_str::<Value>(&data) else {
                return unavailable("malformed");
            };
            if matches!(
                value["type"].as_str(),
                Some("response.completed" | "response.failed" | "response.incomplete")
            ) {
                if terminal.is_some() {
                    return unavailable("ambiguous");
                }
                terminal = value.get("response").cloned();
                if terminal.is_none() {
                    return unavailable("malformed");
                }
            }
        }
        terminal
    };
    let Some(response) = response.filter(Value::is_object) else {
        return unavailable("unavailable");
    };
    let usage = response.get("usage").filter(|v| !v.is_null());
    let (usage_state, usage) = match usage {
        None => ("unavailable", Value::Null),
        Some(value) => match usage_fields(value) {
            Some(v) => ("reported", v),
            None => ("invalid", Value::Null),
        },
    };
    json!({"source":"provider_response","state":"observed","response_id":identifier(&response["id"]),"reported_model":identifier(&response["model"]),"reported_effort":identifier(&response["reasoning"]["effort"]),"response_status":identifier(&response["status"]),"usage_state":usage_state,"usage":usage})
}
fn unavailable(state: &str) -> Value {
    json!({"source":"provider_response","state":state,"usage_state":"unavailable","usage":null})
}
fn identifier(value: &Value) -> Option<&str> {
    value.as_str().filter(|s| {
        !s.is_empty()
            && s.len() <= 256
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"-_./:".contains(&b))
    })
}
fn usage_fields(v: &Value) -> Option<Value> {
    let input = v.get("input_tokens")?.as_u64()?;
    let output = v.get("output_tokens")?.as_u64()?;
    let total = match v.get("total_tokens") {
        None | Some(Value::Null) => None,
        Some(v) => Some(v.as_u64()?),
    };
    let sum = input.checked_add(output)?;
    if total.is_some_and(|t| t != sum) {
        return None;
    }
    let cached = detail(v, "input_tokens_details", "cached_tokens")?;
    let reasoning = detail(v, "output_tokens_details", "reasoning_tokens")?;
    if cached.is_some_and(|v| v > input) || reasoning.is_some_and(|v| v > output) {
        return None;
    }
    Some(
        json!({"input_tokens":input,"output_tokens":output,"total_tokens":total,"cached_input_tokens":cached,"reasoning_output_tokens":reasoning}),
    )
}
fn detail(v: &Value, parent: &str, key: &str) -> Option<Option<u64>> {
    match v.get(parent) {
        None | Some(Value::Null) => Some(None),
        Some(parent) if parent.is_object() => match parent.get(key) {
            None | Some(Value::Null) => Some(None),
            Some(v) => Some(Some(v.as_u64()?)),
        },
        _ => None,
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reported_fields_do_not_invent_missing_counts_or_execution_effort() {
        let v = observe(
            "application/json",
            r#"{"model":"reported-model","usage":{"input_tokens":3,"output_tokens":4},"secret_extra":"not-recorded"}"#,
        );
        assert_eq!(v["reported_model"], "reported-model");
        assert!(v["reported_effort"].is_null());
        assert!(v["usage"]["total_tokens"].is_null());
        assert!(!v.to_string().contains("secret_extra"));
        for usage in [
            json!({"input_tokens":-1,"output_tokens":2}),
            json!({"input_tokens":1,"output_tokens":2,"total_tokens":4}),
            json!({"input_tokens":1,"output_tokens":2,"input_tokens_details":{"cached_tokens":3}}),
        ] {
            assert_eq!(
                observe("application/json", &json!({"usage":usage}).to_string())["usage_state"],
                "invalid"
            );
        }
        assert_eq!(
            observe("application/json", "{}")["usage_state"],
            "unavailable"
        );
    }
    #[test]
    fn stream_requires_unambiguous_terminal_evidence() {
        let event = "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"r1\",\"usage\":{\"input_tokens\":1,\"output_tokens\":2,\"total_tokens\":3}}}\r\n\r\n";
        assert_eq!(
            observe("text/event-stream", event)["usage"]["total_tokens"],
            3
        );
        assert_eq!(
            observe("text/event-stream", &format!("{event}{event}"))["state"],
            "ambiguous"
        );
        assert_eq!(
            observe("text/event-stream", "data: {bad}\n\n")["state"],
            "malformed"
        );
        assert_eq!(
            observe(
                "text/event-stream",
                "data: {\"type\":\"response.created\"}\n\n"
            )["state"],
            "unavailable"
        );
    }
}
