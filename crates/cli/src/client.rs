//! Authenticated Gateway transport. No command can supply an alternate identity or retry policy.
use crate::command::{Args, Command, ManagementRequest, management_request};
use ouroboros_transport::TlsFiles;
use serde::Deserialize;
use std::{path::Path, process::ExitCode};
pub(crate) fn resource_scope(
    mut request: reqwest::RequestBuilder,
    work: Option<uuid::Uuid>,
    delegation: Option<uuid::Uuid>,
    target: Option<&str>,
) -> reqwest::RequestBuilder {
    if let Some(work) = work {
        request = request.header("x-ouro-work-id", work.to_string());
    }
    if let Some(grant) = delegation {
        request = request.header("x-ouro-delegation-id", grant.to_string());
    }
    if let Some(target) = target {
        request = request.header("x-ouro-resource-target", target);
    }
    request
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    gateway_url: String,
    tls: TlsFiles,
}

struct GatewayClient {
    client: reqwest::Client,
    base: String,
}
impl GatewayClient {
    fn connect(instance: bool, config: Option<&Path>) -> anyhow::Result<Self> {
        let (client, base) = if instance {
            (
                reqwest::Client::builder()
                    .no_proxy()
                    .redirect(reqwest::redirect::Policy::none())
                    .retry(reqwest::retry::never())
                    .connect_timeout(std::time::Duration::from_secs(2))
                    .timeout(std::time::Duration::from_secs(10))
                    .build()?,
                "http://127.0.0.1:18080".to_owned(),
            )
        } else {
            let (mut cfg, root) =
                ouroboros_transport::config::load::<Config>(config.expect("clap requires config"))?;
            cfg.tls.resolve_paths(&root)?;
            let url = reqwest::Url::parse(&cfg.gateway_url)?;
            anyhow::ensure!(
                url.scheme() == "https"
                    && url.username().is_empty()
                    && url.password().is_none()
                    && url.path() == "/"
                    && url.query().is_none()
                    && url.fragment().is_none(),
                "invalid Gateway endpoint"
            );
            (
                ouroboros_transport::client(&cfg.tls)?,
                cfg.gateway_url.trim_end_matches('/').to_owned(),
            )
        };
        Ok(Self { client, base })
    }

    async fn send(&self, request: ManagementRequest) -> anyhow::Result<ExitCode> {
        let Self { client, base } = self;
        let ManagementRequest {
            method,
            path,
            body,
            key,
            scope: workspace_scope,
        } = request;
        let mut request = client.request(method.parse()?, format!("{base}{path}"));
        if let Some(scope) = workspace_scope {
            request = resource_scope(
                request,
                scope.work,
                scope.delegation,
                scope.target.as_deref(),
            );
        }
        if let Some(key) = key {
            ouroboros_contracts::request_key(&key)?;
            request = request.header("idempotency-key", key);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await.map_err(|_| {
            anyhow::anyhow!(
                "Gateway connection failed; outcome may be unresolved; preserve request key"
            )
        })?;
        crate::output::management_response(response).await
    }
}

pub(crate) async fn execute(args: Args) -> anyhow::Result<ExitCode> {
    let gateway = GatewayClient::connect(args.instance, args.config.as_deref())?;
    let client = &gateway.client;
    let base = &gateway.base;
    if let Command::CredentialSecret {
        intent,
        work,
        delegation,
    } = args.command
    {
        let receipt =
            crate::credential::transfer(client, base, args.instance, intent, work, delegation)
                .await?;
        println!("{receipt}");
        return Ok(ExitCode::SUCCESS);
    }
    if let Command::Request {
        method,
        path,
        input,
        key,
        work,
        delegation,
        target,
        select,
        output,
        max_bytes,
    } = args.command
    {
        anyhow::ensure!(
            path.starts_with('/')
                && !path.starts_with("//")
                && !path.contains(['#', '\\', '\r', '\n']),
            "relative API path required"
        );
        let mut request = client.request(method.parse()?, format!("{base}{path}"));
        if path.starts_with("/mcp/work/") {
            request = request
                .header("accept", "application/json, text/event-stream")
                .header("mcp-protocol-version", "2025-11-25");
        }
        if let Some(key) = key {
            ouroboros_contracts::request_key(&key)?;
            request = request.header("idempotency-key", key);
        }
        request = resource_scope(request, work, delegation, target.as_deref());
        if let Some(path) = input {
            if method == "PUT" {
                let file = tokio::fs::File::open(path).await?;
                let metadata = file.metadata().await?;
                anyhow::ensure!(
                    metadata.is_file() && metadata.len() <= max_bytes,
                    "CLI input bound or file type"
                );
                request = request
                    .header("content-type", "application/octet-stream")
                    .body(reqwest::Body::wrap_stream(crate::output::file_stream(
                        file, max_bytes,
                    )));
            } else {
                use std::io::Read;
                let mut bytes = Vec::new();
                std::fs::File::open(path)?
                    .take(65537)
                    .read_to_end(&mut bytes)?;
                anyhow::ensure!(bytes.len() <= 65536, "CLI JSON input bound");
                request = request
                    .header("content-type", "application/json")
                    .body(bytes);
            }
        }
        return crate::output::resource_response(
            request.send().await?,
            &method,
            select,
            output,
            max_bytes,
        )
        .await;
    }
    gateway.send(management_request(args.command)?).await
}
