//! SQL contract evidence. Runtime/worker observations are explicit fixtures, not Linux execution.
use super::*;
#[path = "service_continuations.rs"]
mod continuations;
use ouroboros_contracts::{
    AdapterInvocationRequest, ServiceEffectSlot, ServiceInvocation, ServiceOperationPlan,
};

fn read_plan() -> ServiceOperationPlan {
    ServiceOperationPlan {
        name: "read_snapshot".into(),
        effects: vec![ServiceEffectSlot {
            slot: "snapshot".into(),
            target: "company".into(),
            operation: "db.read".into(),
            max_input_bytes: 1024,
            input_equals: [("operation".into(), json!("read_input"))].into(),
        }],
    }
}

impl Fixture {
    async fn qualified_service(
        &self,
        plan: ServiceOperationPlan,
    ) -> (Uuid, AdapterInvocationRequest) {
        sqlx::query("UPDATE delegations SET actions=actions||ARRAY['adapter.submit','adapter.verify','adapter.evaluate','adapter.accept','adapter.activate','adapter.invoke','adapter.stop'] WHERE firm_id=$1")
            .bind(self.core.firm).execute(&self.db).await.unwrap();
        sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.submit','adapter.verify','adapter.evaluate','adapter.accept','adapter.activate','adapter.invoke','adapter.stop'] WHERE firm_id=$1 AND target_id='model'")
            .bind(self.core.firm).execute(&self.db).await.unwrap();
        let operation = plan.name.clone();
        let source = self
            .core
            .start(&self.human, "service-source", self.execution())
            .await
            .unwrap();
        let submitted = self
            .core
            .submit_adapter(
                self.actor(),
                "service-submit",
                ouroboros_contracts::AdapterSubmissionRequest {
                    service_operation: Some(plan),
                    work_id: Some(self.work),
                    delegation_id: Some(self.human_grant),
                    target: "model".into(),
                    source_execution_id: source.resource_id,
                },
            )
            .await
            .unwrap();
        let id = Uuid::parse_str(submitted["id"].as_str().unwrap()).unwrap();
        // Separate fixture evaluator/acceptor: do not bypass existing qualification gates.
        let reviewer = Uuid::new_v4();
        let grant = Uuid::new_v4();
        let child = Uuid::new_v4();
        let caller = Caller {
            fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        };
        sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
            .bind(self.core.firm)
            .bind(reviewer)
            .execute(&self.db)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
        )
        .bind(&caller.fingerprint)
        .bind(self.core.firm)
        .bind(reviewer)
        .execute(&self.db)
        .await
        .unwrap();
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(self.core.firm)
            .bind(self.work)
            .bind(reviewer)
            .execute(&self.db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) SELECT firm_id,$2,$3,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$4")
            .bind(self.core.firm).bind(grant).bind(reviewer).bind(self.human_grant).execute(&self.db).await.unwrap();
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,$2,principal_id,$3,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$4")
            .bind(self.core.firm).bind(child).bind(grant).bind(self.agent_grant).execute(&self.db).await.unwrap();
        for next in [grant, child] {
            sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$2,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$3")
                .bind(self.core.firm).bind(next).bind(self.human_grant).execute(&self.db).await.unwrap();
        }
        let mut verification = self.execution();
        verification.program = None;
        verification.delegation_id = grant;
        verification.agent_delegation_id = Some(child);
        let verified = self
            .core
            .verify_adapter(
                Actor::Human(caller.clone()),
                id,
                "service-verify",
                verification,
            )
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO program_observations(firm_id,execution_id,receipt) VALUES($1,$2,$3)",
        )
        .bind(self.core.firm)
        .bind(verified.resource_id)
        .bind(json!({"exit_code":0,"fixture":"synthetic scoped-service evaluator"}))
        .execute(&self.db)
        .await
        .unwrap();
        let evaluated = self
            .core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "service-evaluate",
                ouroboros_contracts::AdapterEvaluationRequest {
                    work_id: Some(self.work),
                    delegation_id: Some(grant),
                    verification_execution_id: verified.resource_id,
                    conclusion: "supported".into(),
                    criteria: "Fixture supports exact operation plan".into(),
                    rationale: "SQL contract exercise".into(),
                    limitations: "No native runtime or provider execution".into(),
                },
            )
            .await
            .unwrap();
        let accepted = self
            .core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "service-accept",
                ouroboros_contracts::AdapterAcceptanceRequest {
                    work_id: Some(self.work),
                    delegation_id: Some(grant),
                    evaluation_id: Uuid::parse_str(evaluated["id"].as_str().unwrap()).unwrap(),
                    max_calls: 8,
                    lifetime_seconds: 300,
                    rationale: "Disposable contract".into(),
                    independence_basis: "Distinct fixture principal".into(),
                },
            )
            .await
            .unwrap();
        let active = self
            .core
            .activate_adapter(
                Actor::Human(caller),
                id,
                "service-activate",
                ouroboros_contracts::AdapterActivationRequest {
                    work_id: Some(self.work),
                    delegation_id: Some(grant),
                    acceptance_id: Uuid::parse_str(accepted["id"].as_str().unwrap()).unwrap(),
                    expected_activation_id: None,
                },
            )
            .await
            .unwrap();
        let mut execution = self.execution();
        execution.program = None;
        (
            id,
            AdapterInvocationRequest {
                activation_id: Uuid::parse_str(active["id"].as_str().unwrap()).unwrap(),
                execution,
                service: Some(ServiceInvocation {
                    operation,
                    input: json!({"reference":"fixture-input"}),
                }),
            },
        )
    }

    async fn released_service(
        &self,
        id: Uuid,
        invocation: AdapterInvocationRequest,
    ) -> (Accepted, BridgeIdentity) {
        let admitted = self
            .core
            .invoke_adapter(self.actor(), id, "service-root", invocation)
            .await
            .unwrap();
        let (ticket, peer) = self.bind(&admitted).await;
        self.finish_input(&peer).await;
        self.core
            .runtime_materialized(ticket.execution_id, RUNTIME, &Self::materialized(&ticket))
            .await
            .unwrap();
        self.core
            .runtime_release(ticket.execution_id, RUNTIME)
            .await
            .unwrap();
        (admitted, peer)
    }
}

fn child_request() -> ResourceRequest {
    ResourceRequest {
        effect_slot: Some("snapshot".into()),
        target: "company".into(),
        operation: "db.read".into(),
        request_key: "first-transport-key".into(),
        input: json!({"operation":"read_input","marker":"one"}),
        work_id: None,
        delegation_id: None,
    }
}

#[tokio::test]
async fn service_keeps_actual_agent_origin_after_caller_exit_and_rechecks_its_grant() {
    let f = Fixture::new().await;
    let (id, mut invocation) = f.qualified_service(read_plan()).await;
    let origin = f
        .core
        .start(&f.human, "origin-agent", f.execution())
        .await
        .unwrap();
    let (origin_ticket, origin_peer) = f.bind(&origin).await;
    f.finish_input(&origin_peer).await;
    f.core
        .runtime_materialized(
            origin.resource_id,
            RUNTIME,
            &Fixture::materialized(&origin_ticket),
        )
        .await
        .unwrap();
    f.core
        .runtime_release(origin.resource_id, RUNTIME)
        .await
        .unwrap();
    let service_principal = Uuid::new_v4();
    let service_grant = Uuid::new_v4();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'agent',true)")
        .bind(f.core.firm)
        .bind(service_principal)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id) SELECT firm_id,$2,$3,id,actions,expires_at,work_root_id FROM delegations WHERE firm_id=$1 AND id=$4")
        .bind(f.core.firm).bind(service_grant).bind(service_principal).bind(f.agent_grant).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$2,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$3")
        .bind(f.core.firm).bind(service_grant).bind(f.agent_grant).execute(&f.db).await.unwrap();
    invocation.execution.delegation_id = f.agent_grant;
    invocation.execution.agent_delegation_id = Some(service_grant);
    let admitted = f
        .core
        .invoke_adapter(Actor::Instance(origin_peer), id, "agent-root", invocation)
        .await
        .unwrap();
    let (ticket, peer) = f.bind(&admitted).await;
    f.finish_input(&peer).await;
    f.core
        .runtime_materialized(
            admitted.resource_id,
            RUNTIME,
            &Fixture::materialized(&ticket),
        )
        .await
        .unwrap();
    f.core
        .runtime_release(admitted.resource_id, RUNTIME)
        .await
        .unwrap();
    f.core
        .runtime_terminated(origin.resource_id, RUNTIME)
        .await
        .unwrap();
    let child = f
        .core
        .resource_admit(Actor::Instance(peer), child_request())
        .await
        .unwrap();
    let observed = f
        .core
        .read(&f.human, "executions", admitted.resource_id)
        .await
        .unwrap();
    assert_eq!(
        observed["service_call"]["effective_caller"]["instance_id"],
        json!(origin_ticket.instance_id)
    );
    assert_eq!(
        observed["service_call"]["effective_caller"]["generation"],
        json!(origin_ticket.generation)
    );
    assert_eq!(
        observed["service_call"]["assignment"]["service_principal_id"],
        json!(service_principal)
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.agent_grant)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .resource_lookup(
                f.actor(),
                child.intent_id,
                Some(f.work),
                Some(f.human_grant)
            )
            .await
            .unwrap()
            .state,
        "accepted"
    );
}

#[tokio::test]
async fn qualified_write_slot_and_managed_service_invocation_use_the_same_root_contract() {
    let f = Fixture::new().await;
    let mut plan = read_plan();
    plan.name = "snapshot_and_record".into();
    plan.effects.push(ServiceEffectSlot {
        slot: "persist".into(),
        target: "company".into(),
        operation: "db.write".into(),
        max_input_bytes: 1024,
        input_equals: [("operation".into(), json!("record_result"))].into(),
    });
    let (id, invocation) = f.qualified_service(plan).await;
    let (root, peer) = f.released_service(id, invocation.clone()).await;
    let mut write = child_request();
    write.effect_slot = Some("persist".into());
    write.operation = "db.write".into();
    write.input = json!({"operation":"record_result","parameters":{"marker":"service-result"}});
    let a = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), child_request())
        .await
        .unwrap();
    let b = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), write.clone())
        .await
        .unwrap();
    assert_ne!(a.intent_id, b.intent_id);
    assert_eq!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), write.clone())
            .await
            .unwrap()
            .intent_id,
        b.intent_id
    );
    f.core
        .resource_claim(b.intent_id, "other-worker", None)
        .await
        .unwrap();
    // An uncertain write remains the original claimed intent, including on another transport key.
    write.request_key = "after-response-loss".into();
    let unresolved = f
        .core
        .resource_admit(Actor::Instance(peer), write)
        .await
        .unwrap();
    assert_eq!(unresolved.intent_id, b.intent_id);
    assert_eq!(unresolved.state, "claimed");
    assert!(unresolved.reply.is_none());
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM service_effects WHERE firm_id=$1 AND root_intent_id=$2",
    )
    .bind(f.core.firm)
    .bind(root.intent_id)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(count, 2);
    let tool_name = format!("invoke_{}", invocation.activation_id.simple());
    let listed = f
        .core
        .managed_mcp(
            f.actor(),
            f.work,
            f.human_grant,
            json!({"jsonrpc":"2.0","id":1,"method":"tools/list"}),
        )
        .await
        .unwrap()
        .unwrap();
    let tool = listed["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .find(|tool| tool["name"] == tool_name)
        .unwrap();
    assert_eq!(
        tool["inputSchema"]["properties"]["service_input"]["type"],
        "object"
    );
    let invoked=f.core.managed_mcp(f.actor(),f.work,f.human_grant,json!({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":tool_name,"arguments":{"request_key":"managed-service-root","agent_delegation_id":f.agent_grant,"service_input":{"reference":"via-mcp"}}}})).await.unwrap().unwrap();
    assert_eq!(invoked["result"]["isError"], false, "{invoked}");
    let execution: Uuid = serde_json::from_value(
        invoked["result"]["structuredContent"]["admission"]["resource_id"].clone(),
    )
    .unwrap();
    let stored: Value = sqlx::query_scalar(
        "SELECT invocation FROM service_calls WHERE firm_id=$1 AND execution_id=$2",
    )
    .bind(f.core.firm)
    .bind(execution)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(
        stored,
        json!({"operation":"snapshot_and_record","input":{"reference":"via-mcp"}})
    );
}

#[tokio::test]
async fn service_root_binds_caller_and_one_child_across_concurrent_replay_and_core_restart() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let mut legacy = invocation.clone();
    legacy.service = None;
    assert!(matches!(
        f.core
            .invoke_adapter(f.actor(), id, "missing-service", legacy)
            .await,
        Err(Error::Invalid)
    ));
    let (root, peer) = f.released_service(id, invocation.clone()).await;
    let repeated = f
        .core
        .invoke_adapter(f.actor(), id, "service-root", invocation.clone())
        .await
        .unwrap();
    assert_eq!(root.intent_id, repeated.intent_id);
    let mut changed = invocation.clone();
    changed.service.as_mut().unwrap().input = json!({"reference":"changed"});
    assert!(matches!(
        f.core
            .invoke_adapter(f.actor(), id, "service-root", changed)
            .await,
        Err(Error::Conflict)
    ));
    let before: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='resource_calls'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    let request = child_request();
    let mut other = request.clone();
    other.request_key = "a-new-transport-key".into();
    let (a, b) = tokio::join!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), request.clone()),
        f.core.resource_admit(Actor::Instance(peer.clone()), other)
    );
    let child = a.unwrap();
    assert_eq!(child.intent_id, b.unwrap().intent_id);
    let after: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='resource_calls'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(after, before + 1);
    let event_work: Uuid = sqlx::query_scalar("SELECT work_id FROM events WHERE firm_id=$1 AND resource_id=$2 AND kind='service.effect_bound'")
        .bind(f.core.firm).bind(child.intent_id).fetch_one(&f.db).await.unwrap();
    assert_eq!(event_work, f.work);
    let mut conflict = request.clone();
    conflict.input["marker"] = json!("different");
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), conflict)
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "wrong-worker", None)
            .await,
        Err(Error::Denied)
    ));
    let ticket = f
        .core
        .resource_claim(child.intent_id, "other-worker", None)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied)
    ));
    let reply = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: "{\"value\":1}".into(),
        receipt: json!({"source":"company-db","fixture":true}),
    };
    f.core
        .resource_complete(child.intent_id, "other-worker", reply.clone())
        .await
        .unwrap();
    let core = Core::new(f.db.clone(), f.core.firm);
    let after_restart = core
        .resource_admit(Actor::Instance(peer.clone()), request)
        .await
        .unwrap();
    assert_eq!(after_restart.intent_id, child.intent_id);
    assert_eq!(after_restart.reply, Some(reply));
    let own=core.managed_mcp(Actor::Instance(peer.clone()),f.work,f.agent_grant,json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"execution_self","arguments":{}}})).await.unwrap().unwrap();
    let own = &own["result"]["structuredContent"]["service_call"];
    assert_eq!(own["root_intent_id"], json!(root.intent_id));
    assert_eq!(
        own["effective_caller"]["delegation_id"],
        json!(f.human_grant)
    );
    assert_eq!(
        own["assignment"]["service_delegation_id"],
        json!(f.agent_grant)
    );
    assert_eq!(own["invocation"], json!(invocation.service.unwrap()));
    assert_eq!(own["effects"][0]["intent_id"], json!(child.intent_id));
    assert_eq!(own["effects"][0]["attempt_id"], json!(ticket.attempt_id));
    assert_eq!(own["effects_settled"], false);
    assert!(own["binding"].get("selection").is_none());
    let owner = core
        .read(&f.human, "executions", root.resource_id)
        .await
        .unwrap();
    assert!(owner["service_call"].get("invocation").is_none());
    assert!(
        sqlx::query("UPDATE service_effects SET effect_slot='another' WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
    assert!(
        sqlx::query("DELETE FROM service_calls WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn service_operation_denies_undeclared_effects_and_management_escape() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (_, peer) = f.released_service(id, invocation.clone()).await;
    let request = child_request();
    let mut invalid = Vec::new();
    let mut r = request.clone();
    r.effect_slot = None;
    invalid.push(r);
    let mut r = request.clone();
    r.effect_slot = Some("new-slot".into());
    invalid.push(r);
    let mut r = request.clone();
    r.operation = "db.write".into();
    invalid.push(r);
    let mut r = request.clone();
    r.target = "model".into();
    invalid.push(r);
    let mut r = request.clone();
    r.work_id = Some(Uuid::new_v4());
    invalid.push(r);
    let mut r = request.clone();
    r.delegation_id = Some(f.human_grant);
    invalid.push(r);
    let mut r = request.clone();
    r.input["operation"] = json!("other_query");
    invalid.push(r);
    let mut r = request.clone();
    r.input["blob"] = json!("x".repeat(2048));
    invalid.push(r);
    let before = f.snapshot().await;
    for r in invalid {
        assert!(matches!(
            f.core
                .resource_admit(Actor::Instance(peer.clone()), r)
                .await,
            Err(Error::Denied)
        ));
    }
    assert!(matches!(
        f.core
            .start(Actor::Instance(peer.clone()), "escape", f.execution())
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .invoke_adapter(
                Actor::Instance(peer.clone()),
                id,
                "nested-escape",
                invocation
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .submit_adapter(
                Actor::Instance(peer.clone()),
                "escape-submit",
                ouroboros_contracts::AdapterSubmissionRequest {
                    service_operation: None,
                    work_id: Some(f.work),
                    delegation_id: Some(f.agent_grant),
                    target: "model".into(),
                    source_execution_id: Uuid::new_v4(),
                }
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(before, f.snapshot().await);
    let tools = f
        .core
        .managed_mcp(
            Actor::Instance(peer.clone()),
            f.work,
            f.agent_grant,
            json!({"jsonrpc":"2.0","id":1,"method":"tools/list"}),
        )
        .await
        .unwrap()
        .unwrap();
    assert_eq!(tools["result"]["tools"].as_array().unwrap().len(), 2);
    let spoof = serde_json::from_value::<ServiceInvocation>(
        json!({"operation":"read_snapshot","input":{},"effective_caller":f.human_grant}),
    );
    assert!(spoof.is_err());
    // An unscoped actor cannot claim a service slot or reserve its server-generated key space.
    let mut r = request.clone();
    r.work_id = Some(f.work);
    r.delegation_id = Some(f.human_grant);
    assert!(matches!(
        f.core.resource_admit(f.actor(), r.clone()).await,
        Err(Error::Denied)
    ));
    r.effect_slot = None;
    r.request_key = "service:pretend:snapshot".into();
    assert!(matches!(
        f.core.resource_admit(f.actor(), r).await,
        Err(Error::Denied)
    ));
    // Receipt reads also cannot use the service's broader work grant to inspect another root's data.
    let mut outside = child_request();
    outside.effect_slot = None;
    outside.work_id = Some(f.work);
    outside.delegation_id = Some(f.human_grant);
    let outside = f.core.resource_admit(f.actor(), outside).await.unwrap();
    assert!(matches!(
        f.core
            .resource_lookup(Actor::Instance(peer), outside.intent_id, None, None)
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn service_child_rechecks_each_grant_and_selection_before_claim_without_erasing_history() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation.clone()).await;
    let child = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), child_request())
        .await
        .unwrap();
    let owner: Uuid = sqlx::query_scalar("SELECT principal_id FROM work_controls WHERE firm_id=$1 AND root_work_id=$2 AND principal_id=(SELECT principal_id FROM delegations WHERE firm_id=$1 AND id=$3)")
        .bind(f.core.firm).bind(f.work).bind(f.human_grant).fetch_one(&f.db).await.unwrap();
    sqlx::query(
        "DELETE FROM work_controls WHERE firm_id=$1 AND root_work_id=$2 AND principal_id=$3",
    )
    .bind(f.core.firm)
    .bind(f.work)
    .bind(owner)
    .execute(&f.db)
    .await
    .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_lookup(Actor::Instance(peer.clone()), child.intent_id, None, None)
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
        .bind(f.core.firm)
        .bind(f.work)
        .bind(owner)
        .execute(&f.db)
        .await
        .unwrap();
    for grant in [f.human_grant, f.agent_grant] {
        sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'db.read') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='company'")
            .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
        assert!(matches!(
            f.core
                .resource_claim(child.intent_id, "other-worker", None)
                .await,
            Err(Error::Denied)
        ));
        sqlx::query("UPDATE resource_scopes SET operations=array_append(operations,'db.read') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='company'")
            .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    }
    sqlx::query("UPDATE resource_targets SET configuration='{\"revision\":2}' WHERE firm_id=$1 AND id='company'")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied) | Err(Error::Conflict)
    ));
    sqlx::query("UPDATE resource_targets SET configuration='{}' WHERE firm_id=$1 AND id='company'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    f.core
        .stop_adapter(
            f.actor(),
            id,
            "stop-service",
            ouroboros_contracts::AdapterStopRequest {
                work_id: Some(f.work),
                delegation_id: Some(f.human_grant),
                activation_id: invocation.activation_id,
            },
        )
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied)
    ));
    let observed = f
        .core
        .read(&f.human, "executions", root.resource_id)
        .await
        .unwrap();
    assert_eq!(observed["service_call"]["effects"][0]["state"], "accepted");
    assert_eq!(
        f.core
            .resource_lookup(
                f.actor(),
                child.intent_id,
                Some(f.work),
                Some(f.human_grant)
            )
            .await
            .unwrap()
            .intent_id,
        child.intent_id
    );
    let attempts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM attempts WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(child.intent_id)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(attempts, 0);
}
