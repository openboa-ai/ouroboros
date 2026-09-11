//! Admitted, non-streaming effects. Core completion follows a domain's durable result.
use super::admission::{complete, operation_live};
use super::{App, Worker};
use anyhow::Result;
use ouroboros_contracts::{ResourceReply, ResourceTicket};
use uuid::Uuid;

pub(super) async fn execute_inner(
    a: &App,
    intent: Uuid,
    ticket: &ResourceTicket,
) -> Result<ResourceReply> {
    let result = match (&a.worker, ticket.operation.as_str()) {
        (Worker::Custody(store), "credential.disable") => {
            super::custody::disable(a, store, intent, ticket).await?
        }
        (Worker::Company(worker), _) => super::company::execute(a, worker, intent, ticket).await?,
        (Worker::Catalog(worker), _) => super::catalog::execute(a, worker, intent, ticket).await?,
        (Worker::Provider(worker), "model.responses") => {
            super::provider::execute(a, worker, ticket).await?
        }
        (Worker::Fixture(_), "mcp") => {
            operation_live(a, ticket).await?;
            super::fixture::mcp(&ticket.input)?
        }
        (Worker::Fixture(command), "model.responses") => {
            operation_live(a, ticket).await?;
            super::fixture::model(&ticket.input, command)?
        }
        _ => anyhow::bail!("operation is not served by this credential worker"),
    };
    complete(a, intent, &result).await?;
    Ok(result)
}
