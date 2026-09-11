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
    pub credential_id: Uuid,
    pub credential_version: u64,
    pub timeout_ms: u64,
    pub max_response_bytes: usize,
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
        if body.len() > 1048576 {
            return Err(CustodyError);
        }
        let binding = Binding {
            owner: ticket.firm_id,
            credential: self.binding.credential_id,
            version: selected.credential_version,
        };
        let result=self.custody.consume_async(binding,ticket.attempt_id,Duration::from_millis(self.binding.timeout_ms),|secret|async move {
            let token=std::str::from_utf8(&secret).map_err(|_|CustodyError)?;
            if token.is_empty() || !token.bytes().all(|b|b.is_ascii_graphic()) {return Err(CustodyError)}
            let mut auth=reqwest::header::HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_|CustodyError)?;
            auth.set_sensitive(true);
            let request=self.client.post(&self.binding.endpoint).header(reqwest::header::AUTHORIZATION,auth).header(reqwest::header::CONTENT_TYPE,"application/json").body(body).build().map_err(|_|CustodyError)?;
            tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|CustodyError)??;
            let transfer=async {
            let mut response=self.client.execute(request).await.map_err(|_|CustodyError)?;
            if !response.status().is_success() {return Err(CustodyError)}
            let status=response.status().as_u16();
            let content_type=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v|v.to_str().ok()).and_then(|v|v.split(';').next()).ok_or(CustodyError)?.to_owned();
            if !matches!(content_type.as_str(),"application/json"|"text/event-stream") {return Err(CustodyError)}
            // Only the validated media type is forwarded; arbitrary upstream header parameters
            // cannot become a credential reflection path.
            emit(ProviderFrame::Head {status,content_type:content_type.clone()}).await?;
            let mut bytes=Vec::new();
            let mut guard=crate::provider_stream::SafeChunks::new(&secret,self.binding.max_response_bytes)?;
            while let Some(chunk)=response.chunk().await.map_err(|_|CustodyError)? {
                let safe=guard.push(&chunk)?;
                bytes.extend_from_slice(&chunk);
                if !safe.is_empty() { emit(ProviderFrame::Data(safe)).await?; }
            }
            let tail=guard.finish();
            if !tail.is_empty() { emit(ProviderFrame::Data(tail)).await?; }
            let body=String::from_utf8(bytes).map_err(|_|CustodyError)?;
            let observation=crate::provider_observation::observe(&content_type,&body);
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
                        tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|CustodyError)??;
                    }
                    result=&mut transfer=> {
                        let result=result?;
                        tokio::time::timeout(Duration::from_millis(500),authorize()).await.map_err(|_|CustodyError)??;
                        return Ok(result);
                    }
                }
            }
        }).await.map_err(|_|CustodyError)?;
        self.custody.save_provider_reply(ticket, &result).await?;
        Ok(result)
    }
}
