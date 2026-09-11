//! Catalog ticket scope, frozen policy validation, and canonical receipt responses.
use super::admission::operation_live;
use super::{App, id, reply};
use anyhow::{Context, Result, ensure};
use ouroboros_contracts::{
    CollectionRecord, CollectionRequest, CollectionTicket, ResourceReply, ResourceTicket,
    RetirementPolicy, RetirementRecord, RetirementRequest, RetirementTarget,
};
use ouroboros_resources::{CatalogWorker, StoredBlob, WorkspaceRecord};
use serde_json::{Value, json};
use std::time::Duration;
use uuid::Uuid;

pub(super) fn file_limits(configuration: &Value) -> Result<(u64, Duration)> {
    let max_bytes = configuration["max_file_bytes"]
        .as_u64()
        .context("max_file_bytes required")?;
    let seconds = configuration["transfer_seconds"]
        .as_u64()
        .context("transfer_seconds required")?;
    ensure!(
        max_bytes > 0 && max_bytes <= i64::MAX as u64,
        "max_file_bytes outside storage bounds"
    );
    ensure!(
        (1..=300).contains(&seconds),
        "transfer_seconds outside bound"
    );
    Ok((max_bytes, Duration::from_secs(seconds)))
}

pub(super) fn upload_reply(intent: Uuid, blob: &StoredBlob) -> ResourceReply {
    let mut body = json!({"intent_id":intent,"upload_id":intent,"sha256":blob.sha256});
    let mut receipt =
        json!({"source":"catalog","upload_receipt":intent,"sha256":blob.sha256,"size":blob.size});
    // A legacy receipt has no object identity. Preserve its exact original response on recovery.
    if let Some(object) = blob.object_id {
        body["object_id"] = json!(object);
        receipt["object_id"] = json!(object);
    }
    reply(body, receipt)
}

pub(super) fn workspace_reply(intent: Uuid, workspace: &WorkspaceRecord) -> ResourceReply {
    reply(
        json!({"intent_id":intent,"workspace_id":workspace.workspace_id,
            "namespace_id":workspace.namespace_id,"work_id":workspace.work_id,
            "label":workspace.label,"revision":workspace.revision}),
        json!({"source":"catalog","workspace_creation_receipt":intent,
            "workspace_id":workspace.workspace_id,"namespace_id":workspace.namespace_id,
            "work_id":workspace.work_id,"label":workspace.label,"revision":workspace.revision}),
    )
}

pub(super) fn retirement_reply(intent: Uuid, record: &RetirementRecord) -> ResourceReply {
    reply(
        json!(record),
        json!({"source":"catalog","retirement_receipt":intent,"record":record}),
    )
}

fn validate_policy_definition(policy: &RetirementPolicy) -> Result<()> {
    let allowed: std::collections::BTreeSet<_> =
        policy.allowed.iter().map(String::as_str).collect();
    ensure!(
        !policy.id.is_nil()
            && policy.revision > 0
            && policy.revision <= i64::MAX as u64
            && policy.min_retention_seconds <= i32::MAX as u64
            && allowed.len() == policy.allowed.len()
            && allowed.iter().all(|action| matches!(
                *action,
                "upload" | "revision" | "workspace_close" | "collect"
            )),
        "invalid retirement policy"
    );
    Ok(())
}

pub(super) fn validate_retirement_policy(
    request: &RetirementRequest,
    policy: &RetirementPolicy,
) -> Result<()> {
    validate_policy_definition(policy)?;
    let action = match &request.target {
        RetirementTarget::Upload { .. } => "upload",
        RetirementTarget::Revision { .. } => "revision",
        RetirementTarget::WorkspaceClose { .. } => "workspace_close",
    };
    ensure!(
        request.policy_id == policy.id
            && request.policy_revision == policy.revision
            && policy.allowed.iter().any(|allowed| allowed == action),
        "retirement request is outside the frozen policy"
    );
    Ok(())
}

pub(super) fn retirement_context(
    ticket: &ResourceTicket,
) -> Result<(Uuid, RetirementRequest, RetirementPolicy)> {
    ensure!(ticket.operation == "file.retire", "not a retirement ticket");
    let CatalogScope::Namespace(namespace) = catalog_scope(&ticket.configuration)? else {
        anyhow::bail!("legacy workspace target cannot retire references");
    };
    let request: RetirementRequest = serde_json::from_value(ticket.input.clone())?;
    let policy: RetirementPolicy = serde_json::from_value(
        ticket
            .configuration
            .get("retirement_policy")
            .context("explicit retirement policy required")?
            .clone(),
    )?;
    validate_retirement_policy(&request, &policy)?;
    Ok((namespace, request, policy))
}

pub(super) fn collection_reply(intent: Uuid, record: &CollectionRecord) -> ResourceReply {
    reply(
        json!(record),
        json!({"source":"catalog","collection_receipt":intent,"record":record}),
    )
}

pub(super) fn validate_collection_policy(
    request: &CollectionRequest,
    policy: &RetirementPolicy,
) -> Result<()> {
    validate_policy_definition(policy)?;
    ensure!(
        !request.upload_id.is_nil()
            && request.policy_id == policy.id
            && request.policy_revision == policy.revision
            && policy.allowed.iter().any(|allowed| allowed == "collect")
            && !request.reason.is_empty()
            && request.reason.len() <= 1024
            && request.reason.trim() == request.reason
            && !request.reason.chars().any(char::is_control),
        "collection request is outside the frozen policy"
    );
    Ok(())
}

pub(super) fn collection_context(
    ticket: &CollectionTicket,
) -> Result<(Uuid, CollectionRequest, Duration)> {
    let resource = &ticket.resource;
    ensure!(
        resource.operation == "file.collect"
            && resource.workspace.is_none()
            && !ticket.step_id.is_nil()
            && ticket.sequence > 0,
        "not a fixed collection step ticket"
    );
    let CatalogScope::Namespace(namespace) = catalog_scope(&resource.configuration)? else {
        anyhow::bail!("legacy workspace target cannot collect objects");
    };
    let request: CollectionRequest = serde_json::from_value(resource.input.clone())?;
    let policy: RetirementPolicy = serde_json::from_value(
        resource
            .configuration
            .get("retirement_policy")
            .context("explicit collection policy required")?
            .clone(),
    )?;
    ensure!(
        policy == ticket.policy,
        "collection policy changed from admitted configuration"
    );
    validate_collection_policy(&request, &policy)?;
    let (max_bytes, limit) = file_limits(&resource.configuration)?;
    let binding = &ticket.binding;
    ensure!(
        binding.upload_id == request.upload_id
            && !binding.object_id.is_nil()
            && binding.store_id == id(&resource.configuration, "store_id")?
            && binding.generation == id(&resource.configuration, "storage_generation")?
            && binding.size <= max_bytes
            && binding.sha256.len() == 64
            && binding
                .sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)),
        "collection object differs from admitted storage or limits"
    );
    Ok((namespace, request, limit))
}

#[derive(Debug, PartialEq)]
pub(super) enum CatalogScope {
    Namespace(Uuid),
    LegacyWorkspace(Uuid),
}

pub(super) fn catalog_scope(configuration: &Value) -> Result<CatalogScope> {
    let configuration = configuration
        .as_object()
        .context("catalog configuration must be an object")?;
    // Presence, including null or an invalid UUID, selects namespace validation. A malformed
    // namespace must never fall through to the older single-workspace configuration.
    if configuration.contains_key("namespace_id") {
        ensure!(
            !configuration.contains_key("workspace_id"),
            "catalog configuration mixes namespace and legacy workspace"
        );
        let namespace = configuration["namespace_id"]
            .as_str()
            .context("namespace identity required")?
            .parse::<Uuid>()?;
        ensure!(!namespace.is_nil(), "namespace identity cannot be nil");
        Ok(CatalogScope::Namespace(namespace))
    } else {
        let workspace = configuration
            .get("workspace_id")
            .and_then(Value::as_str)
            .context("legacy workspace identity required")?
            .parse::<Uuid>()?;
        Ok(CatalogScope::LegacyWorkspace(workspace))
    }
}

pub(super) fn workspace_context(ticket: &ResourceTicket) -> Result<(Uuid, Option<Uuid>)> {
    ensure!(
        matches!(
            ticket.operation.as_str(),
            "workspace.create" | "file.read" | "file.publish"
        ),
        "operation has no workspace context"
    );
    let (workspace, namespace) = match catalog_scope(&ticket.configuration)? {
        CatalogScope::Namespace(namespace) => {
            let binding = ticket
                .workspace
                .as_ref()
                .context("workspace binding required")?;
            ensure!(
                binding.namespace_id == namespace && !binding.workspace_id.is_nil(),
                "workspace binding is outside the admitted namespace"
            );
            (binding.workspace_id, Some(namespace))
        }
        CatalogScope::LegacyWorkspace(workspace) => {
            ensure!(
                ticket.workspace.is_none() && ticket.operation != "workspace.create",
                "legacy target cannot create or bind a namespace workspace"
            );
            (workspace, None)
        }
    };
    if ticket.operation != "workspace.create" {
        ensure!(
            id(&ticket.input, "workspace_id")? == workspace,
            "workspace scope mismatch"
        );
    }
    Ok((workspace, namespace))
}

pub(super) async fn validate_workspace_context(
    worker: &CatalogWorker,
    ticket: &ResourceTicket,
) -> Result<Uuid> {
    let (workspace, namespace) = workspace_context(ticket)?;
    if let Some(namespace) = namespace {
        worker
            .validate_workspace(ticket.firm_id, workspace, ticket.work_id, namespace)
            .await?;
    }
    Ok(workspace)
}

// Catalog preparation/finalization can verify an entire blob or fsync after its metadata
// transaction. Keep that blocking filesystem work away from the live-check timer executor.
pub(super) async fn catalog_io<T: Send + 'static>(
    operation: impl std::future::Future<Output = Result<T>> + Send + 'static,
) -> Result<T> {
    let runtime = tokio::runtime::Handle::current();
    tokio::task::spawn_blocking(move || runtime.block_on(operation))
        .await
        .context("catalog task failed")?
}

pub(super) async fn execute(
    a: &App,
    worker: &CatalogWorker,
    intent: Uuid,
    t: &ResourceTicket,
) -> Result<ResourceReply> {
    let input = &t.input;
    Ok(match t.operation.as_str() {
        "file.upload" | "file.read" => {
            anyhow::bail!("file content requires the binary transfer path")
        }
        "workspace.create" => {
            let (workspace, namespace) = workspace_context(t)?;
            let namespace = namespace.context("workspace creation requires a namespace")?;
            let label = input["label"]
                .as_str()
                .context("workspace label required")?;
            operation_live(a, t).await?;
            let record = worker
                .create_workspace(t.firm_id, intent, t.work_id, namespace, workspace, label)
                .await?;
            workspace_reply(intent, &record)
        }
        "file.publish" => {
            let workspace = validate_workspace_context(worker, t).await?;
            operation_live(a, t).await?;
            let revision = worker
                .publish(
                    t.firm_id,
                    intent,
                    workspace,
                    input["expected_revision"]
                        .as_i64()
                        .context("revision required")?,
                    serde_json::from_value(input["files"].clone())?,
                )
                .await?;
            reply(
                json!({"intent_id":intent,"revision":revision}),
                json!({"source":"catalog","publication_receipt":intent,"revision":revision}),
            )
        }
        "file.retire" => {
            let (namespace, request, policy) = retirement_context(t)?;
            operation_live(a, t).await?;
            let record = worker
                .retire_reference(t.firm_id, intent, t.work_id, namespace, &request, &policy)
                .await?;
            retirement_reply(intent, &record)
        }
        _ => anyhow::bail!("operation is not served by this credential worker"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ouroboros_contracts::CollectionBinding;

    fn collection_ticket() -> CollectionTicket {
        let policy = RetirementPolicy {
            id: Uuid::new_v4(),
            revision: 2,
            min_retention_seconds: 60,
            allowed: vec!["collect".into()],
        };
        let binding = CollectionBinding {
            upload_id: Uuid::new_v4(),
            object_id: Uuid::new_v4(),
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
            sha256: "a".repeat(64),
            size: 4096,
        };
        let request = CollectionRequest {
            upload_id: binding.upload_id,
            reason: "Retired input without retained references".into(),
            policy_id: policy.id,
            policy_revision: policy.revision,
        };
        CollectionTicket {
            resource: workspace_ticket(
                json!({"namespace_id":Uuid::new_v4(),
            "store_id":binding.store_id,"storage_generation":binding.generation,
            "max_file_bytes":4096,"transfer_seconds":5,"retirement_policy":policy}),
                "file.collect",
                json!(request),
                None,
            ),
            step_id: Uuid::new_v4(),
            sequence: 1,
            binding,
            policy,
        }
    }

    #[test]
    fn collection_requires_exact_namespace_policy_object_and_step_limits() {
        let ticket = collection_ticket();
        assert!(collection_context(&ticket).is_ok());
        let mut changed = ticket.clone();
        changed.resource.operation = "file.retire".into();
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.sequence = 0;
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.binding.object_id = Uuid::nil();
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.binding.upload_id = Uuid::new_v4();
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.binding.generation = Uuid::new_v4();
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.binding.size += 1;
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.binding.sha256 = "A".repeat(64);
        assert!(collection_context(&changed).is_err());
        let mut changed = ticket.clone();
        changed.policy.revision += 1;
        assert!(collection_context(&changed).is_err());
        for field in ["retirement_policy", "max_file_bytes", "transfer_seconds"] {
            let mut changed = ticket.clone();
            changed
                .resource
                .configuration
                .as_object_mut()
                .unwrap()
                .remove(field);
            assert!(
                collection_context(&changed).is_err(),
                "{field} must be explicit"
            );
        }
        let mut changed = ticket;
        changed
            .resource
            .configuration
            .as_object_mut()
            .unwrap()
            .remove("namespace_id");
        changed.resource.configuration["workspace_id"] = json!(Uuid::new_v4());
        assert!(collection_context(&changed).is_err());
    }

    #[test]
    fn collection_permission_is_separate_from_reference_retirement() {
        let ticket = collection_ticket();
        let request: CollectionRequest = serde_json::from_value(ticket.resource.input).unwrap();
        for allowed in [
            vec![],
            vec!["upload".into()],
            vec!["collect".into(), "collect".into()],
        ] {
            let mut policy = ticket.policy.clone();
            policy.allowed = allowed;
            assert!(validate_collection_policy(&request, &policy).is_err());
        }
        for reason in ["", " leading", "trailing ", "control\ncharacter"] {
            let mut changed = request.clone();
            changed.reason = reason.into();
            assert!(validate_collection_policy(&changed, &ticket.policy).is_err());
        }
    }

    #[test]
    fn collection_completion_and_recovery_share_canonical_observation() {
        let ticket = collection_ticket();
        for confirmation in ["removed", "observed_absence"] {
            let record = CollectionRecord {
                intent_id: ticket.resource.intent_id,
                binding: ticket.binding.clone(),
                policy_id: ticket.policy.id,
                policy_revision: ticket.policy.revision,
                confirmation: confirmation.into(),
            };
            let result = collection_reply(record.intent_id, &record);
            assert_eq!(result.status, 200);
            assert_eq!(result.content_type, "application/json");
            assert_eq!(
                serde_json::from_str::<Value>(&result.body).unwrap(),
                json!(record)
            );
            assert_eq!(
                result.receipt,
                json!({"source":"catalog","collection_receipt":record.intent_id,"record":record})
            );
        }
    }

    fn retirement_fixture() -> (RetirementRequest, RetirementPolicy) {
        let policy = RetirementPolicy {
            id: Uuid::new_v4(),
            revision: 1,
            min_retention_seconds: 60,
            allowed: vec!["upload".into()],
        };
        let request = RetirementRequest {
            target: RetirementTarget::Upload {
                upload_id: Uuid::new_v4(),
            },
            reason: "Superseded output".into(),
            policy_id: policy.id,
            policy_revision: policy.revision,
        };
        (request, policy)
    }

    #[test]
    fn retirement_requires_the_exact_policy_and_allowed_target_kind() {
        let (request, policy) = retirement_fixture();
        assert!(validate_retirement_policy(&request, &policy).is_ok());
        let mut changed = request.clone();
        changed.policy_id = Uuid::new_v4();
        assert!(validate_retirement_policy(&changed, &policy).is_err());
        changed = request.clone();
        changed.policy_revision += 1;
        assert!(validate_retirement_policy(&changed, &policy).is_err());
        changed = request.clone();
        changed.target = RetirementTarget::Revision {
            workspace_id: Uuid::new_v4(),
            revision: 0,
        };
        assert!(validate_retirement_policy(&changed, &policy).is_err());
        for allowed in [
            vec![],
            vec!["upload".into(), "upload".into()],
            vec!["upload".into(), "unknown".into()],
            vec!["collect".into()],
        ] {
            let mut changed = policy.clone();
            changed.allowed = allowed;
            assert!(validate_retirement_policy(&request, &changed).is_err());
        }
        let mut changed = policy.clone();
        changed.min_retention_seconds = u64::MAX;
        assert!(validate_retirement_policy(&request, &changed).is_err());
        changed = policy.clone();
        changed.id = Uuid::nil();
        assert!(validate_retirement_policy(&request, &changed).is_err());
        changed = policy.clone();
        changed.revision = 0;
        assert!(validate_retirement_policy(&request, &changed).is_err());
    }

    #[test]
    fn retirement_cannot_inherit_legacy_scope_or_an_implicit_policy() {
        let (request, policy) = retirement_fixture();
        let namespace = Uuid::new_v4();
        let mut ticket = workspace_ticket(
            json!({"namespace_id":namespace,"retirement_policy":policy}),
            "file.retire",
            json!(request),
            None,
        );
        let (observed_namespace, observed_request, observed_policy) =
            retirement_context(&ticket).unwrap();
        assert_eq!(observed_namespace, namespace);
        assert_eq!(observed_request, request);
        assert_eq!(observed_policy, policy);
        ticket.configuration = json!({"workspace_id":Uuid::new_v4(),"retirement_policy":policy});
        assert!(retirement_context(&ticket).is_err());
        ticket.configuration = json!({"namespace_id":namespace});
        assert!(retirement_context(&ticket).is_err());
        ticket.configuration = json!({"namespace_id":null,"retirement_policy":policy});
        assert!(retirement_context(&ticket).is_err());
    }

    #[test]
    fn upload_receipt_carries_numeric_size_without_a_read_snapshot() {
        let intent = Uuid::new_v4();
        let digest = "a".repeat(64);
        let result = upload_reply(
            intent,
            &StoredBlob {
                object_id: None,
                sha256: digest.clone(),
                size: 131072,
            },
        );
        assert_eq!(result.receipt["source"], "catalog");
        assert_eq!(result.receipt["sha256"], digest);
        assert_eq!(result.receipt["size"].as_u64(), Some(131072));
        assert!(result.receipt.get("snapshot").is_none());
        assert!(result.receipt.get("object_id").is_none());
        assert_eq!(
            result.receipt,
            json!({"source":"catalog","upload_receipt":intent,
            "sha256":digest,"size":131072})
        );
        assert_eq!(
            serde_json::from_str::<Value>(&result.body).unwrap(),
            json!({"intent_id":intent,"upload_id":intent,"sha256":digest})
        );
    }

    #[test]
    fn upload_object_identity_comes_from_the_catalog_reference() {
        let intent = Uuid::new_v4();
        let object = Uuid::new_v4();
        let result = upload_reply(
            intent,
            &StoredBlob {
                object_id: Some(object),
                sha256: "a".repeat(64),
                size: 17,
            },
        );
        assert_eq!(result.receipt["object_id"], object.to_string());
        let body: Value = serde_json::from_str(&result.body).unwrap();
        assert_eq!(body["object_id"], object.to_string());
        assert_eq!(body["upload_id"], intent.to_string());
        assert_ne!(body["object_id"], body["upload_id"]);
    }

    fn workspace_ticket(
        configuration: Value,
        operation: &str,
        input: Value,
        workspace: Option<ouroboros_contracts::WorkspaceBinding>,
    ) -> ResourceTicket {
        ResourceTicket {
            firm_id: Uuid::new_v4(),
            intent_id: Uuid::new_v4(),
            attempt_id: Uuid::new_v4(),
            work_id: Uuid::new_v4(),
            target: "catalog".into(),
            operation: operation.into(),
            input,
            configuration,
            workspace,
        }
    }

    #[test]
    fn malformed_namespace_never_falls_back_to_legacy_workspace() {
        let workspace = Uuid::new_v4();
        for namespace in [
            Value::Null,
            json!(false),
            json!("invalid"),
            json!(Uuid::nil()),
        ] {
            assert!(catalog_scope(&json!({"namespace_id":namespace})).is_err());
            assert!(
                catalog_scope(&json!({"namespace_id":namespace,"workspace_id":workspace})).is_err()
            );
        }
        assert!(
            catalog_scope(&json!({"namespace_id":Uuid::new_v4(),"workspace_id":workspace}))
                .is_err()
        );
        assert_eq!(
            catalog_scope(&json!({"workspace_id":workspace})).unwrap(),
            CatalogScope::LegacyWorkspace(workspace)
        );
        assert!(catalog_scope(&json!({})).is_err());
    }

    #[test]
    fn namespace_workspace_requires_matching_server_binding_and_input() {
        let namespace = Uuid::new_v4();
        let workspace = Uuid::new_v4();
        let mut ticket = workspace_ticket(
            json!({"namespace_id":namespace}),
            "file.read",
            json!({"workspace_id":workspace}),
            Some(ouroboros_contracts::WorkspaceBinding {
                workspace_id: workspace,
                namespace_id: namespace,
            }),
        );
        assert_eq!(
            workspace_context(&ticket).unwrap(),
            (workspace, Some(namespace))
        );
        ticket.input["workspace_id"] = json!(Uuid::new_v4());
        assert!(workspace_context(&ticket).is_err());
        ticket.input["workspace_id"] = json!(workspace);
        ticket.workspace.as_mut().unwrap().namespace_id = Uuid::new_v4();
        assert!(workspace_context(&ticket).is_err());
        ticket.workspace = None;
        assert!(workspace_context(&ticket).is_err());
    }

    #[test]
    fn creation_requires_namespace_but_legacy_reads_keep_existing_scope() {
        let namespace = Uuid::new_v4();
        let workspace = Uuid::new_v4();
        let binding = ouroboros_contracts::WorkspaceBinding {
            workspace_id: workspace,
            namespace_id: namespace,
        };
        let mut ticket = workspace_ticket(
            json!({"namespace_id":namespace}),
            "workspace.create",
            json!({"label":"Results"}),
            Some(binding),
        );
        assert_eq!(
            workspace_context(&ticket).unwrap(),
            (workspace, Some(namespace))
        );
        ticket.configuration = json!({"workspace_id":workspace});
        assert!(workspace_context(&ticket).is_err());
        ticket.workspace = None;
        assert!(workspace_context(&ticket).is_err());
        ticket.operation = "file.read".into();
        ticket.input = json!({"workspace_id":workspace});
        assert_eq!(workspace_context(&ticket).unwrap(), (workspace, None));
        ticket.input["workspace_id"] = json!(Uuid::new_v4());
        assert!(workspace_context(&ticket).is_err());
    }
}
