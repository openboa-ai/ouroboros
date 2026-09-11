//! Prepared company operations. SQL and atomic effect receipts belong to CompanyWorker.
use super::admission::operation_live;
use super::{App, id, reply};
use anyhow::{Result, ensure};
use ouroboros_contracts::{ResourceReply, ResourceTicket};
use ouroboros_resources::CompanyWorker;
use serde_json::json;
use uuid::Uuid;

pub(super) async fn execute(
    a: &App,
    worker: &CompanyWorker,
    intent: Uuid,
    t: &ResourceTicket,
) -> Result<ResourceReply> {
    let input = &t.input;
    let cfg = &t.configuration;
    Ok(match t.operation.as_str() {
        "db.read" => {
            ensure!(
                input["operation"] == "read_input"
                    && id(&input["parameters"], "input_id")? == id(cfg, "input_id")?,
                "query scope mismatch"
            );
            operation_live(a, t).await?;
            reply(
                worker.read_input(t.firm_id, id(cfg, "input_id")?).await?,
                json!({"source":"company_db","query":"read_input"}),
            )
        }
        "db.write" => {
            ensure!(
                input["operation"] == "record_result",
                "unsupported prepared transaction"
            );
            operation_live(a, t).await?;
            let result = worker
                .record_result(t.firm_id, intent, input["parameters"].clone())
                .await?;
            reply(
                json!({"intent_id":intent,"result_id":result}),
                json!({"source":"company_db","effect_receipt":intent,"result_id":result}),
            )
        }
        _ => anyhow::bail!("operation is not served by this credential worker"),
    })
}
