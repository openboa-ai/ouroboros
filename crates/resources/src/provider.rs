//! Trusted fixed-origin native Responses sender. Not a general HTTP adapter or secret API.
use crate::{
    credential_envelope::{Binding, CustodyError},
    credential_store::CredentialStore,
};
use ouroboros_contracts::{ResourceReply, ResourceTicket};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

#[derive(Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct ProviderBinding {
    pub target: String,
    pub endpoint: String,
    /// Explicit deployment-owned subscription routing; never supplied by the workload.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chatgpt_account_id: Option<String>,
    /// Pinned Codex wire dialect; no workload-controlled header forwarding.
    #[serde(default, skip_serializing_if = "is_false")]
    pub codex_responses_lite: bool,
    pub credential_id: Uuid,
    pub credential_version: u64,
    pub timeout_ms: u64,
    pub max_response_bytes: usize,
}
fn is_false(value: &bool) -> bool {
    !value
}
impl ProviderBinding {
    fn account_header(&self) -> Result<Option<reqwest::header::HeaderValue>, CustodyError> {
        let Some(account_id) = &self.chatgpt_account_id else {
            return if self.codex_responses_lite {
                Err(CustodyError)
            } else {
                Ok(None)
            };
        };
        // An account binding cannot turn a custom Responses origin into a subscription endpoint.
        if self.endpoint != "https://chatgpt.com/backend-api/codex/responses"
            || !(1..=128).contains(&account_id.len())
            || !account_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
        {
            return Err(CustodyError);
        }
        let mut header =
            reqwest::header::HeaderValue::from_str(account_id).map_err(|_| CustodyError)?;
        header.set_sensitive(true);
        Ok(Some(header))
    }

    fn request(
        &self,
        client: &reqwest::Client,
        secret: &[u8],
        body: Vec<u8>,
    ) -> Result<reqwest::Request, CustodyError> {
        let token = std::str::from_utf8(secret).map_err(|_| CustodyError)?;
        if token.is_empty() || !token.bytes().all(|b| b.is_ascii_graphic()) {
            return Err(CustodyError);
        }
        let mut auth = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
            .map_err(|_| CustodyError)?;
        auth.set_sensitive(true);
        let mut request = client
            .post(&self.endpoint)
            .header(reqwest::header::AUTHORIZATION, auth)
            .header(reqwest::header::CONTENT_TYPE, "application/json");
        if let Some(account) = self.account_header()? {
            request = request.header("ChatGPT-Account-ID", account);
        }
        if self.codex_responses_lite {
            request = request
                .header("x-openai-internal-codex-responses-lite", "true")
                .header(reqwest::header::ACCEPT, "text/event-stream");
        }
        request.body(body).build().map_err(|_| CustodyError)
    }
}
/// Trusted worker transport output. Bytes are provisional, not a completion receipt.
pub enum ProviderFrame {
    Head { status: u16, content_type: String },
    Data(Vec<u8>),
}
pub struct ProviderSender {
    binding: ProviderBinding,
    managed_versions: bool,
    client: reqwest::Client,
    custody: CredentialStore,
}
impl ProviderSender {
    pub fn new(binding: ProviderBinding, custody: CredentialStore) -> Result<Self, CustodyError> {
        Self::with_trust_root(binding, custody, None)
    }
    /// Optional deployment-owned trust root replaces built-in roots; never disables verification.
    pub fn with_trust_root(
        binding: ProviderBinding,
        custody: CredentialStore,
        root: Option<&[u8]>,
    ) -> Result<Self, CustodyError> {
        let url = reqwest::Url::parse(&binding.endpoint).map_err(|_| CustodyError)?;
        if url.scheme() != "https"
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || !url.path().ends_with("/responses")
            || binding.target.is_empty()
            || binding.credential_id.is_nil()
            || binding.credential_version == 0
            || !(1..=30000).contains(&binding.timeout_ms)
            || !(1..=2097152).contains(&binding.max_response_bytes)
        {
            return Err(CustodyError);
        }
        binding.account_header()?;
        let mut client = reqwest::Client::builder()
            .https_only(true)
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .retry(reqwest::retry::never())
            .timeout(Duration::from_millis(binding.timeout_ms));
        if let Some(pem) = root {
            if pem.len() > 65536 {
                return Err(CustodyError);
            }
            client = client.tls_built_in_root_certs(false).add_root_certificate(
                reqwest::Certificate::from_pem(pem).map_err(|_| CustodyError)?,
            );
        }
        let client = client.build().map_err(|_| CustodyError)?;
        Ok(Self {
            binding,
            managed_versions: false,
            client,
            custody,
        })
    }
    /// Deployment opt-in: only the version of the same credential may be selected by Core.
    /// Endpoint, protocol limits, target and credential identity remain pinned locally.
    pub fn with_managed_versions(mut self, enabled: bool) -> Self {
        self.managed_versions = enabled;
        self
    }
    /// Trusted recovery only, using the original ticket and current read authorization.
    /// This never decrypts a credential, allocates a claim or sends a provider request.
    pub async fn recover<F: std::future::Future<Output = Result<(), CustodyError>>>(
        &self,
        ticket: &ResourceTicket,
        authorize: impl FnOnce() -> F,
    ) -> Result<Option<ResourceReply>, CustodyError> {
        tokio::time::timeout(Duration::from_millis(500), authorize())
            .await
            .map_err(|_| CustodyError)??;
        self.custody.provider_reply(ticket).await
    }

    /// Called only with the original worker's authenticated Core observation selector.
    /// Caller delivery authorization remains the Gateway's responsibility.
    pub async fn observe(
        &self,
        selector: &ouroboros_contracts::ProviderRecoveryTicket,
    ) -> Result<Option<ResourceReply>, CustodyError> {
        self.custody.provider_observation(selector).await
    }

    /// Current Core live authorization must succeed inside the credential use immediately
    /// before send. The callback and configuration are supplied by the trusted worker.
    pub async fn execute<F: std::future::Future<Output = Result<(), CustodyError>>>(
        &self,
        ticket: &ResourceTicket,
        authorize: impl FnMut() -> F,
    ) -> Result<ResourceReply, CustodyError> {
        self.execute_stream(ticket, authorize, |_| async { Ok(()) })
            .await
    }

    /// Await each sink write: bounded backpressure and current-authority polling share the
    /// original dispatch deadline. A sink error cancels local work and never authorizes retry.
    /// Already emitted bytes are provisional; only the returned persisted reply is completion.
    pub async fn execute_stream<
        F: std::future::Future<Output = Result<(), CustodyError>>,
        S: std::future::Future<Output = Result<(), CustodyError>>,
    >(
        &self,
        ticket: &ResourceTicket,
        mut authorize: impl FnMut() -> F,
        mut emit: impl FnMut(ProviderFrame) -> S,
    ) -> Result<ResourceReply, CustodyError> {
        let selected: ProviderBinding =
            serde_json::from_value(ticket.configuration.clone()).map_err(|_| CustodyError)?;
        let mut permitted = self.binding.clone();
        if self.managed_versions
            && selected.credential_version > 0
            && selected.credential_version <= i64::MAX as u64
        {
            permitted.credential_version = selected.credential_version;
        }
        if selected != permitted
            || ticket.target != self.binding.target
            || ticket.operation != "model.responses"
            || ticket.attempt_id.is_nil()
        {
            return Err(CustodyError);
        }
        let body = serde_json::to_vec(&ticket.input).map_err(|_| CustodyError)?;
        let codex_stream = self.binding.chatgpt_account_id.is_some()
            && ticket
                .input
                .get("stream")
                .and_then(serde_json::Value::as_bool)
                == Some(true);
        if body.len() > 1048576 {
            return Err(CustodyError);
        }
        let binding = Binding {
            owner: ticket.firm_id,
            credential: self.binding.credential_id,
            version: selected.credential_version,
        };
        let result=self.custody.consume_async(binding,ticket.attempt_id,Duration::from_millis(self.binding.timeout_ms),|secret|async move {
            let request=self.binding.request(&self.client,&secret,body).map_err(|_|{eprintln!("provider request construction failed");CustodyError})?;
            tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|{eprintln!("provider dispatch authorization timed out");CustodyError})?.map_err(|_|{eprintln!("provider dispatch authorization denied");CustodyError})?;
            let transfer=async {
            let mut response=self.client.execute(request).await.map_err(|error|{
                eprintln!("provider transport failed: connect={} timeout={}",error.is_connect(),error.is_timeout());
                CustodyError
            })?;
            if !response.status().is_success() {
                // Never read or log an error body: it may reflect credentials or workload data.
                eprintln!("provider response rejected: status={}",response.status().as_u16());
                return Err(CustodyError)
            }
            let status=response.status().as_u16();
            let (content_type,inferred_stream)=response_media_type(response.headers(),codex_stream)?;
            // Only the validated media type is forwarded; arbitrary upstream header parameters
            // cannot become a credential reflection path.
            emit(ProviderFrame::Head {status,content_type:content_type.clone()}).await.map_err(|_|failure("response header delivery"))?;
            let mut bytes=Vec::new();
            let mut guard=crate::provider_stream::SafeChunks::new(&secret,self.binding.max_response_bytes)?;
            while let Some(chunk)=response.chunk().await.map_err(|_|failure("response body transport"))? {
                let safe=guard.push(&chunk).map_err(|_|failure("response safety bound"))?;
                bytes.extend_from_slice(&chunk);
                if !safe.is_empty() { emit(ProviderFrame::Data(safe)).await.map_err(|_|failure("response chunk delivery"))?; }
            }
            let tail=guard.finish();
            if !tail.is_empty() { emit(ProviderFrame::Data(tail)).await.map_err(|_|failure("response tail delivery"))?; }
            let body=String::from_utf8(bytes).map_err(|_|failure("response encoding"))?;
            let observation=crate::provider_observation::observe(&content_type,&body);
            if inferred_stream && !verified_stream(&observation) {return Err(failure("unverified Codex response stream"))}
            Ok(ResourceReply {status,content_type,body,receipt:json!({"source":"provider_worker","attempt_id":ticket.attempt_id,"credential_id":binding.credential,"credential_version":binding.version,"requested_model":ticket.input.get("model"),"requested_effort":ticket.input.pointer("/reasoning/effort"),"provider_observation":observation})})
            };
            tokio::pin!(transfer);
            let mut checks=tokio::time::interval(Duration::from_millis(250));
            checks.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            checks.tick().await;
            loop {
                tokio::select! {
                    biased;
                    _=checks.tick()=> {
                        tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|failure("authority recheck timeout"))?.map_err(|_|failure("authority recheck denied"))?;
                    }
                    result=&mut transfer=> {
                        let result=result?;
                        tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|failure("authority recheck timeout"))?.map_err(|_|failure("authority recheck denied"))?;
                        return Ok(result);
                    }
                }
            }
        }).await.map_err(|error|{eprintln!("provider custody use failed: {error:?}");CustodyError})?;
        self.custody
            .save_provider_reply(ticket, &result)
            .await
            .map_err(|_| failure("receipt persistence"))?;
        Ok(result)
    }
}

// Codex's SSE client does not require a Content-Type header. For its fixed subscription
// route only, negotiate SSE and verify terminal framing before persisting completion.
fn response_media_type(
    headers: &reqwest::header::HeaderMap,
    codex_stream: bool,
) -> Result<(String, bool), CustodyError> {
    match headers.get(reqwest::header::CONTENT_TYPE) {
        None if codex_stream => Ok(("text/event-stream".into(), true)),
        None => Err(failure("missing response media type")),
        Some(value) => match value.to_str().ok().and_then(|v| v.split(';').next()) {
            Some(kind @ ("application/json" | "text/event-stream")) => Ok((kind.into(), false)),
            _ => Err(failure("unsupported response media type")),
        },
    }
}
fn verified_stream(observation: &serde_json::Value) -> bool {
    // For SSE, observe only reports "observed" after one valid terminal event.
    // Codex requires the response id, but does not require a nested status field.
    observation["state"] == "observed" && observation["response_id"].is_string()
}

// Diagnostics are fixed local stages. Do not pass upstream error text, bodies, URLs or headers.
fn failure(stage: &'static str) -> CustodyError {
    eprintln!("provider failed: {stage}");
    CustodyError
}

#[cfg(test)]
mod tests {
    use super::*;

    fn binding() -> ProviderBinding {
        ProviderBinding {
            target: "model-fixture".into(),
            endpoint: "https://chatgpt.com/backend-api/codex/responses".into(),
            chatgpt_account_id: None,
            codex_responses_lite: false,
            credential_id: Uuid::from_u128(1),
            credential_version: 1,
            timeout_ms: 1000,
            max_response_bytes: 4096,
        }
    }

    #[test]
    fn explicit_subscription_account_is_sent_as_sensitive_header() {
        let mut binding = binding();
        binding.chatgpt_account_id = Some("account-fixture_123".into());
        let body = br#"{"model":"fixture-model"}"#.to_vec();
        let request = binding
            .request(&reqwest::Client::new(), b"fixture-token", body.clone())
            .unwrap();
        assert_eq!(request.url().as_str(), binding.endpoint);
        assert_eq!(request.method(), reqwest::Method::POST);
        assert_eq!(request.body().unwrap().as_bytes().unwrap(), body);
        let headers = request.headers();
        assert_eq!(headers.len(), 3);
        assert_eq!(headers["ChatGPT-Account-ID"], "account-fixture_123");
        assert!(headers["ChatGPT-Account-ID"].is_sensitive());
        assert_eq!(
            headers[reqwest::header::AUTHORIZATION],
            "Bearer fixture-token"
        );
        assert!(headers[reqwest::header::AUTHORIZATION].is_sensitive());
        assert_eq!(headers[reqwest::header::CONTENT_TYPE], "application/json");
    }

    #[test]
    fn codex_lite_marker_and_native_body_travel_together() {
        let mut binding = binding();
        binding.chatgpt_account_id = Some("account-fixture".into());
        binding.codex_responses_lite = true;
        // Lite carries instructions/tools inside input rather than in top-level fields.
        let body = br#"{"model":"gpt-5.6-sol","input":[],"stream":true,"reasoning":{"effort":"low","context":"all_turns"}}"#.to_vec();
        let request = binding
            .request(&reqwest::Client::new(), b"synthetic-token", body.clone())
            .unwrap();
        assert_eq!(
            request.headers()["x-openai-internal-codex-responses-lite"],
            "true"
        );
        assert_eq!(
            request.headers()[reqwest::header::ACCEPT],
            "text/event-stream"
        );
        assert_eq!(request.body().unwrap().as_bytes().unwrap(), body);
        binding.codex_responses_lite = false;
        let request = binding
            .request(&reqwest::Client::new(), b"synthetic-token", body)
            .unwrap();
        assert!(
            !request
                .headers()
                .contains_key("x-openai-internal-codex-responses-lite")
        );
    }

    #[test]
    fn codex_lite_requires_a_pinned_subscription_connection() {
        let mut binding = binding();
        binding.codex_responses_lite = true;
        assert!(
            binding
                .request(&reqwest::Client::new(), b"synthetic-token", vec![])
                .is_err()
        );
        binding.chatgpt_account_id = Some("account-fixture".into());
        binding.endpoint = "https://fixture.invalid/responses".into();
        assert!(
            binding
                .request(&reqwest::Client::new(), b"synthetic-token", vec![])
                .is_err()
        );
    }

    #[test]
    fn absent_codex_media_type_requires_an_actual_terminal_stream() {
        let mut headers = reqwest::header::HeaderMap::new();
        assert!(response_media_type(&headers, false).is_err());
        assert_eq!(
            response_media_type(&headers, true).unwrap(),
            ("text/event-stream".into(), true)
        );
        headers.insert(reqwest::header::CONTENT_TYPE, "text/html".parse().unwrap());
        assert!(response_media_type(&headers, true).is_err());
        for body in [
            "",
            "{\"error\":\"failure\"}",
            "data: {\"type\":\"response.created\"}\n\n",
        ] {
            assert!(!verified_stream(&crate::provider_observation::observe(
                "text/event-stream",
                body
            )));
        }
        let body = "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"fixture\",\"status\":\"completed\"}}\n\n";
        assert!(verified_stream(&crate::provider_observation::observe(
            "text/event-stream",
            body
        )));
        assert!(!verified_stream(&crate::provider_observation::observe(
            "text/event-stream",
            &format!("{body}{body}")
        )));
        assert!(verified_stream(&crate::provider_observation::observe(
            "text/event-stream",
            "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"fixture\"}}\n\n"
        )));
    }

    #[test]
    fn subscription_account_requires_exact_endpoint() {
        let mut binding = binding();
        binding.chatgpt_account_id = Some("account-fixture".into());
        for endpoint in [
            "https://api.openai.com/v1/responses",
            "https://localhost/responses",
            "http://chatgpt.com/backend-api/codex/responses",
            "https://chatgpt.com.example/backend-api/codex/responses",
            "https://chatgpt.com:8443/backend-api/codex/responses",
            "https://chatgpt.com/backend-api/codex/responses?account=fixture",
            "https://chatgpt.com/backend-api/codex/responses#fixture",
            "https://chatgpt.com/backend-api/codex/other/responses",
            "https://chatgpt.com/backend-api/codex/responses/../responses",
        ] {
            binding.endpoint = endpoint.into();
            assert!(binding.account_header().is_err(), "accepted {endpoint}");
            assert!(
                binding
                    .request(&reqwest::Client::new(), b"fixture-token", vec![])
                    .is_err()
            );
        }
    }

    #[test]
    fn subscription_account_rejects_empty_unsafe_or_unbounded_identifiers() {
        let mut binding = binding();
        for account in ["", "has space", "a\r\nx-extra: value", "a\t", "a/b", "é"] {
            binding.chatgpt_account_id = Some(account.into());
            assert!(binding.account_header().is_err());
        }
        binding.chatgpt_account_id = Some("a".repeat(129));
        assert!(binding.account_header().is_err());
        binding.chatgpt_account_id = Some("a".repeat(128));
        assert!(binding.account_header().is_ok());
    }

    #[test]
    fn omitted_account_preserves_existing_binding_and_request() {
        let mut binding = binding();
        binding.endpoint = "https://fixture.invalid/responses".into();
        let value = serde_json::to_value(&binding).unwrap();
        assert!(value.get("chatgpt_account_id").is_none());
        assert!(value.get("codex_responses_lite").is_none());
        let restored: ProviderBinding = serde_json::from_value(value.clone()).unwrap();
        assert!(restored == binding);
        let mut explicit_null = value.clone();
        explicit_null["chatgpt_account_id"] = serde_json::Value::Null;
        assert!(serde_json::from_value::<ProviderBinding>(explicit_null).unwrap() == binding);
        let request = restored
            .request(&reqwest::Client::new(), b"fixture-token", vec![])
            .unwrap();
        assert_eq!(request.url().as_str(), binding.endpoint);
        assert_eq!(request.headers().len(), 2);
        assert!(!request.headers().contains_key("ChatGPT-Account-ID"));
        assert_eq!(
            request.headers()[reqwest::header::AUTHORIZATION],
            "Bearer fixture-token"
        );
        let mut unknown_headers = value;
        unknown_headers["headers"] = json!({"ChatGPT-Account-ID":"account-fixture"});
        assert!(serde_json::from_value::<ProviderBinding>(unknown_headers).is_err());
    }
}
