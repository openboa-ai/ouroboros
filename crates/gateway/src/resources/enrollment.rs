//! Opaque bounded credential transfer to the already-admitted custody worker.
use super::{access::lookup_current, response};
use crate::{
    App,
    identity::{ManagementCaller, context},
};
use axum::{
    body::Body,
    http::{HeaderMap, StatusCode},
    response::Response,
};
use futures_util::StreamExt;
use ouroboros_contracts::ResourceReply;
use std::{io, pin::Pin};
use uuid::Uuid;

pub(super) async fn enrollment_transfer(
    a: &App,
    caller: ManagementCaller,
    headers: HeaderMap,
    id: Uuid,
    body: Body,
) -> Result<Response, StatusCode> {
    if headers.get("content-type").and_then(|v| v.to_str().ok()) != Some("application/octet-stream")
        || headers.contains_key("content-encoding")
    {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    let admitted = lookup_current(a, &caller, &headers, id).await?;
    if admitted.operation != "credential.enroll" || admitted.state != "accepted" {
        return Err(StatusCode::CONFLICT);
    }
    let access = context(
        a.client.post(format!(
            "{}/resource/credential-transfers/{id}/access",
            a.core
        )),
        &caller.actor,
    )
    .json(&caller.actor.scope(&headers))
    .send()
    .await
    .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if access.status() != StatusCode::NO_CONTENT {
        return Err(access.status());
    }
    let endpoint = a
        .workers
        .get(&admitted.target)
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    // Forward only bytes and a fixed media type. No caller-selected routing/auth headers,
    // content decoding, retry, JSON conversion or plaintext persistence.
    let mut input = body.into_data_stream();
    let stream = async_stream::try_stream! {
        let mut total=0usize;
        while let Some(chunk)=input.next().await {
            let chunk=chunk.map_err(|_|io::Error::other("enrollment transfer failed"))?;
            total=total.saturating_add(chunk.len());
            if total>16384 { Err(io::Error::other("enrollment transfer exceeded limit"))?; }
            yield chunk;
        }
        if total==0 { Err(io::Error::other("empty enrollment transfer"))?; }
    };
    let stream: Pin<Box<dyn futures_util::Stream<Item = Result<bytes::Bytes, io::Error>> + Send>> =
        Box::pin(stream);
    let result = a
        .client
        .put(format!("{endpoint}/enrollments/{id}/secret"))
        .header("content-type", "application/octet-stream")
        .body(reqwest::Body::wrap_stream(stream))
        .send()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    if !result.status().is_success() {
        return Err(result.status());
    }
    let reply: ResourceReply = result
        .json()
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    let current = lookup_current(a, &caller, &headers, id).await?;
    if current.reply.as_ref() != Some(&reply) || !caller.alive() {
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }
    Ok(response(id, reply))
}
