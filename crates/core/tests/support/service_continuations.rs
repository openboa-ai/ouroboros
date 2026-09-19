//! Actual disposable PostgreSQL; Runtime identity, observations and clock are trusted fixtures.
use super::*;
#[path = "owner_services.rs"]
mod owner_observations;
use ouroboros_contracts::{
    AllocationClosure, ComputeReturnReceipt, RuntimeProgramObservation, ServiceContinuationRequest,
    ServiceContinuationStop,
};

fn policy(execution_id: Uuid) -> ServiceContinuationRequest {
    ServiceContinuationRequest {
        execution_id,
        max_restarts: 2,
        restart_window_seconds: 120,
        backoff_seconds: 1,
    }
}
impl Fixture {
    async fn allow_continuation(&self) {
        sqlx::query(
            "UPDATE delegations SET actions=actions||ARRAY['service.manage'] WHERE firm_id=$1",
        )
        .bind(self.core.firm)
        .execute(&self.db)
        .await
        .unwrap();
        sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['service.manage'] WHERE firm_id=$1 AND target_id='model'")
            .bind(self.core.firm).execute(&self.db).await.unwrap();
    }
    async fn continuation(&self, root: &Accepted) -> Value {
        self.allow_continuation().await;
        self.core
            .register_service_continuation(self.actor(), "continue", policy(root.resource_id))
            .await
            .unwrap()
    }
    async fn observe_program_exit(&self, execution: Uuid, exit_code: i32) {
        let history = self.core.runtime_history(execution, RUNTIME).await.unwrap();
        let manifest: String = sqlx::query_scalar(
            "SELECT manifest_digest FROM execution_programs WHERE firm_id=$1 AND execution_id=$2",
        )
        .bind(self.core.firm)
        .bind(execution)
        .fetch_one(&self.db)
        .await
        .unwrap();
        self.core
            .runtime_program_observation(
                execution,
                RUNTIME,
                &RuntimeProgramObservation {
                    instance_id: serde_json::from_value(history["instance_id"].clone()).unwrap(),
                    generation: serde_json::from_value(history["generation"].clone()).unwrap(),
                    manifest_digest: manifest,
                    exec_id: "0".repeat(64),
                    exit_code: exit_code.into(),
                    stdout_bytes: 0,
                    stderr_bytes: 0,
                    stdout_sha256: "0".repeat(64),
                    stderr_sha256: "0".repeat(64),
                },
            )
            .await
            .unwrap();
    }
    async fn return_execution(&self, execution: Uuid) {
        self.core
            .runtime_terminated(execution, RUNTIME)
            .await
            .unwrap();
        let history = self.core.runtime_history(execution, RUNTIME).await.unwrap();
        self.core
            .runtime_compute_return(
                execution,
                RUNTIME,
                &ComputeReturnReceipt {
                    instance_id: serde_json::from_value(history["instance_id"].clone()).unwrap(),
                    generation: serde_json::from_value(history["generation"].clone()).unwrap(),
                    binding: serde_json::from_value(history["binding"].clone()).unwrap(),
                    cgroup: AllocationClosure::Empty,
                    container_terminated: true,
                    bridge_terminated: true,
                    guard_terminated: true,
                },
            )
            .await
            .unwrap();
    }
    async fn advance_backoff(&self) {
        // Move ONLY the fixture clock reference, not policy/counters or product authority.
        sqlx::query("UPDATE compute_returns SET received_at=clock_timestamp()-interval '2 seconds' WHERE firm_id=$1")
            .bind(self.core.firm).execute(&self.db).await.unwrap();
    }
    async fn release_successor(&self, execution: Uuid) -> BridgeIdentity {
        let intent: Uuid =
            sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
                .bind(self.core.firm)
                .bind(execution)
                .fetch_one(&self.db)
                .await
                .unwrap();
        let (ticket, peer) = self
            .bind(&Accepted {
                resource_id: execution,
                intent_id: intent,
                state: ouroboros_contracts::IntentState::Accepted,
                replayed: false,
            })
            .await;
        self.finish_input(&peer).await;
        self.core
            .runtime_materialized(execution, RUNTIME, &Self::materialized(&ticket))
            .await
            .unwrap();
        self.core.runtime_release(execution, RUNTIME).await.unwrap();
        peer
    }
}

#[tokio::test]
async fn continuation_requires_explicit_original_authority_and_cannot_refresh_its_allowance() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation).await;
    assert!(matches!(
        f.core
            .register_service_continuation(f.actor(), "continue", policy(root.resource_id))
            .await,
        Err(Error::Denied)
    ));
    let first = f.continuation(&root).await;
    assert_eq!(first["state"], "execution_pending_or_active");
    assert_eq!(first["health"], "not_observed");
    assert!(matches!(
        f.core
            .register_service_continuation(
                Actor::Instance(peer),
                "escape",
                policy(root.resource_id)
            )
            .await,
        Err(Error::Denied)
    ));
    let retry = f
        .core
        .register_service_continuation(f.actor(), "continue", policy(root.resource_id))
        .await
        .unwrap();
    assert_eq!(
        first["restart_expires_at_seconds"],
        retry["restart_expires_at_seconds"]
    );
    assert!(matches!(
        f.core
            .register_service_continuation(f.actor(), "fresh-key", policy(root.resource_id))
            .await,
        Err(Error::Conflict)
    ));
    let mut changed = policy(root.resource_id);
    changed.max_restarts = 3;
    assert!(matches!(
        f.core
            .register_service_continuation(f.actor(), "continue", changed)
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        f.core
            .reconcile_service_continuation(root.intent_id, "another-runtime")
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .poll_service_continuations(RUNTIME, "wrong-profile")
            .await
            .unwrap()["checked"],
        json!([])
    );
    for query in [
        "UPDATE service_continuations SET request='{}' WHERE firm_id=$1",
        "DELETE FROM service_continuations WHERE firm_id=$1",
    ] {
        assert!(
            sqlx::query(query)
                .bind(f.core.firm)
                .execute(&f.db)
                .await
                .is_err()
        );
    }
}

#[tokio::test]
async fn restart_preserves_root_slots_receipts_and_survives_lost_response_and_core_restart() {
    let f = Fixture::new().await;
    let mut plan = read_plan();
    plan.effects[0].operation = "db.write".into();
    plan.effects[0].input_equals.clear();
    let (id, invocation) = f.qualified_service(plan).await;
    let (root, old_peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let mut request = child_request();
    request.operation = "db.write".into();
    let child = f
        .core
        .resource_admit(Actor::Instance(old_peer.clone()), request.clone())
        .await
        .unwrap();
    f.core
        .resource_claim(child.intent_id, "other-worker", None)
        .await
        .unwrap();
    let reply = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: "{\"rows\":1}".into(),
        receipt: json!({"source":"company-db","fixture":true}),
    };
    f.core
        .resource_complete(child.intent_id, "other-worker", reply.clone())
        .await
        .unwrap();
    f.observe_program_exit(root.resource_id, 1).await;
    f.core
        .runtime_terminated(root.resource_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "compute_return_pending"
    );
    f.return_execution(root.resource_id).await;
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "restart_backoff"
    );
    f.advance_backoff().await;
    let (a, b) = tokio::join!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME),
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
    );
    let a = a.unwrap();
    let b = b.unwrap();
    assert_eq!(a["current_execution_id"], b["current_execution_id"]);
    assert_eq!(a["restarts_used"], 1);
    let next: Uuid = serde_json::from_value(a["current_execution_id"].clone()).unwrap();
    assert_ne!(next, root.resource_id);
    let restored = Core::new(f.db.clone(), f.core.firm);
    assert_eq!(
        restored
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["current_execution_id"],
        json!(next)
    );
    let intent: Uuid =
        sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(next)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert!(matches!(
        f.core.runtime_claim(intent, "wrong-runtime").await,
        Err(Error::Denied)
    ));
    let peer = f.release_successor(next).await;
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM service_effects WHERE firm_id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    let replay = restored
        .resource_admit(Actor::Instance(peer.clone()), request.clone())
        .await
        .unwrap();
    assert_eq!(replay.intent_id, child.intent_id);
    assert_eq!(replay.reply, Some(reply));
    assert_eq!(
        before,
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM service_effects WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap()
    );
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(old_peer), request.clone())
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .start(Actor::Instance(peer.clone()), "escape", f.execution())
            .await,
        Err(Error::Denied)
    ));
    request.input["marker"] = json!("changed");
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), request)
            .await,
        Err(Error::Conflict)
    ));
    let observed=f.core.managed_mcp(Actor::Instance(peer),f.work,f.agent_grant,json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"execution_self","arguments":{}}})).await.unwrap().unwrap();
    assert_eq!(
        observed["result"]["structuredContent"]["service_call"]["root_intent_id"],
        json!(root.intent_id)
    );
    f.observe_program_exit(next, 0).await;
    f.return_execution(next).await;
    f.advance_backoff().await;
    let completed = f
        .core
        .reconcile_service_continuation(root.intent_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(completed["state"], "program_completed");
    assert_eq!(completed["restarts_used"], 1);
    assert_eq!(completed["work_success_confirmed"], false);
}

#[tokio::test]
async fn unresolved_child_effect_is_not_retried_when_container_and_compute_are_returned() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let child = f
        .core
        .resource_admit(Actor::Instance(peer), child_request())
        .await
        .unwrap();
    f.core
        .resource_claim(child.intent_id, "other-worker", None)
        .await
        .unwrap();
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    let blocked = f
        .core
        .reconcile_service_continuation(root.intent_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(blocked["state"], "child_effect_unresolved");
    assert_eq!(blocked["restarts_used"], 0);
    let restored = Core::new(f.db.clone(), f.core.firm);
    assert_eq!(
        restored
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "child_effect_unresolved"
    );
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
}

#[tokio::test]
async fn stop_fences_running_execution_and_cancels_unclaimed_successor_without_inventing_return() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    let next = f
        .core
        .reconcile_service_continuation(root.intent_id, RUNTIME)
        .await
        .unwrap();
    let execution = serde_json::from_value(next["current_execution_id"].clone()).unwrap();
    assert!(matches!(
        f.core
            .stop_service_continuation(
                f.actor(),
                root.intent_id,
                "stale",
                ServiceContinuationStop {
                    expected_execution_id: root.resource_id
                }
            )
            .await,
        Err(Error::Conflict)
    ));
    let request = ServiceContinuationStop {
        expected_execution_id: execution,
    };
    let intent = sqlx::query_scalar("SELECT intent_id FROM executions WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(execution)
        .fetch_one(&f.db)
        .await
        .unwrap();
    let before_claim = f
        .core
        .runtime_claim_observation(intent, RUNTIME)
        .await
        .unwrap();
    assert_eq!(before_claim.intent_state, "accepted");
    assert!(before_claim.claim.is_none() && !before_claim.never_dispatched);
    let stopped = f
        .core
        .stop_service_continuation(f.actor(), root.intent_id, "stop", request.clone())
        .await
        .unwrap();
    assert_eq!(stopped["unstarted_cancellation"]["never_dispatched"], true);
    assert_eq!(stopped["termination_confirmed"], false);
    // Stop commits after Runtime's observation but before its pinned claim reaches Core.
    assert!(matches!(
        f.core
            .runtime_claim_with_context(intent, RUNTIME, Some(&before_claim.context))
            .await,
        Err(Error::Denied)
    ));
    let after_stop = f
        .core
        .runtime_claim_observation(intent, RUNTIME)
        .await
        .unwrap();
    assert!(before_claim.context.same_record(&after_stop.context));
    assert_eq!(after_stop.intent_state, "restricted");
    assert!(after_stop.never_dispatched && after_stop.claim.is_none());
    assert!(!after_stop.slot_released());
    assert_eq!(
        stopped,
        f.core
            .stop_service_continuation(f.actor(), root.intent_id, "stop", request)
            .await
            .unwrap()
    );
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "stopped"
    );
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer), child_request())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["restarts_used"],
        1
    );
}

#[tokio::test]
async fn running_stop_remains_pending_until_actual_return_and_current_scope_blocks_restart() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    f.core
        .stop_service_continuation(
            f.actor(),
            root.intent_id,
            "stop",
            ServiceContinuationStop {
                expected_execution_id: root.resource_id,
            },
        )
        .await
        .unwrap();
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "stopping"
    );
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer), child_request())
            .await,
        Err(Error::Denied)
    ));
    f.core
        .runtime_terminated(root.resource_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "stopping"
    );
    f.return_execution(root.resource_id).await;
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "stopped"
    );
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'service.manage') WHERE firm_id=$1 AND delegation_id=$2")
        .bind(f.core.firm).bind(f.human_grant).execute(&f.db).await.unwrap();
    assert_eq!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "authority_blocked"
    );
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["restarts_used"],
        0
    );
}

#[tokio::test]
async fn restart_limit_is_consumed_by_fresh_admissions_and_cannot_be_reset_after_restart() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let mut execution = root.resource_id;
    for ordinal in 1..=2 {
        f.return_execution(execution).await;
        f.advance_backoff().await;
        let next = f
            .core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap();
        assert_eq!(next["restarts_used"], ordinal);
        execution = serde_json::from_value(next["current_execution_id"].clone()).unwrap();
        f.release_successor(execution).await;
    }
    f.return_execution(execution).await;
    f.advance_backoff().await;
    let restored = Core::new(f.db.clone(), f.core.firm);
    assert_eq!(
        restored
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "restart_limit_reached"
    );
    assert!(matches!(
        restored
            .register_service_continuation(f.actor(), "new-budget", policy(root.resource_id))
            .await,
        Err(Error::Conflict)
    ));
    assert!(
        sqlx::query("DELETE FROM service_restarts WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn agent_origin_can_end_but_current_grant_and_exact_selected_material_still_control_successor()
 {
    let f = Fixture::new().await;
    let (id, mut invocation) = f.qualified_service(read_plan()).await;
    f.allow_continuation().await;
    let origin = f
        .core
        .start(&f.human, "coordinator", f.execution())
        .await
        .unwrap();
    let origin_peer = f.release_successor(origin.resource_id).await;
    let principal = Uuid::new_v4();
    let grant = Uuid::new_v4();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'agent',true)")
        .bind(f.core.firm)
        .bind(principal)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id) SELECT firm_id,$2,$3,id,actions,expires_at,work_root_id FROM delegations WHERE firm_id=$1 AND id=$4")
        .bind(f.core.firm).bind(grant).bind(principal).bind(f.agent_grant).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$2,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$3")
        .bind(f.core.firm).bind(grant).bind(f.agent_grant).execute(&f.db).await.unwrap();
    invocation.execution.delegation_id = f.agent_grant;
    invocation.execution.agent_delegation_id = Some(grant);
    let root = f
        .core
        .invoke_adapter(
            Actor::Instance(origin_peer.clone()),
            id,
            "agent-call",
            invocation,
        )
        .await
        .unwrap();
    f.release_successor(root.resource_id).await;
    f.core
        .register_service_continuation(
            Actor::Instance(origin_peer),
            "continue",
            policy(root.resource_id),
        )
        .await
        .unwrap();
    f.return_execution(origin.resource_id).await;
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    let restored = Core::new(f.db.clone(), f.core.firm);
    let next = restored
        .reconcile_service_continuation(root.intent_id, RUNTIME)
        .await
        .unwrap();
    let execution = serde_json::from_value(next["current_execution_id"].clone()).unwrap();
    let peer = f.release_successor(execution).await;
    let observed = f
        .core
        .read(&f.human, "executions", execution)
        .await
        .unwrap();
    assert_eq!(
        observed["service_call"]["effective_caller"]["delegation_id"],
        json!(f.agent_grant)
    );
    assert_eq!(
        observed["service_call"]["root_intent_id"],
        json!(root.intent_id)
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.agent_grant)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer), child_request())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "authority_blocked"
    );
    // History remains independently inspectable by the owner after the coordinator is fenced.
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["history"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}

#[tokio::test]
async fn changed_selection_capacity_and_expiry_do_not_create_a_fresh_allowance() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.allow_continuation().await;
    let mut short = policy(root.resource_id);
    short.restart_window_seconds = 2;
    f.core
        .register_service_continuation(f.actor(), "short", short)
        .await
        .unwrap();
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    sqlx::query("UPDATE limits SET capacity=committed WHERE firm_id=$1 AND id='compute'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await,
        Err(Error::Capacity)
    ));
    assert_eq!(
        f.core
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["restarts_used"],
        0
    );
    sqlx::query("UPDATE resource_targets SET configuration=configuration||'{\"changed\":true}' WHERE firm_id=$1 AND id='company'").bind(f.core.firm).execute(&f.db).await.unwrap();
    assert_eq!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "authority_blocked"
    );
    sqlx::query("UPDATE resource_targets SET configuration=configuration-'changed' WHERE firm_id=$1 AND id='company'").bind(f.core.firm).execute(&f.db).await.unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(2100)).await;
    let observed = f
        .core
        .reconcile_service_continuation(root.intent_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(observed["state"], "restart_window_expired");
    assert_eq!(observed["restarts_used"], 0);
}

#[tokio::test]
async fn completed_binary_read_does_not_grant_cross_instance_byte_redelivery() {
    let f = Fixture::new().await;
    let mut plan = read_plan();
    plan.effects[0].target = FILES.into();
    plan.effects[0].operation = "file.read".into();
    plan.effects[0].input_equals.clear();
    let (id, invocation) = f.qualified_service(plan).await;
    let (root, peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let mut read = child_request();
    read.target = FILES.into();
    read.operation = "file.read".into();
    read.input = json!({"workspace_id":f.workspace,"revision":1,"file":"bin/program.py"});
    let child = f
        .core
        .resource_admit(Actor::Instance(peer), read)
        .await
        .unwrap();
    let ticket = f
        .core
        .resource_claim(child.intent_id, FILE_WORKER, Some(&f.storage))
        .await
        .unwrap();
    f.core.resource_complete(child.intent_id,FILE_WORKER,ResourceReply {status:200,content_type:"application/octet-stream".into(),body:String::new(),receipt:json!({"source":"catalog","stage":"prepared","sha256":"a".repeat(64),"size":70,"snapshot":ticket.input})}).await.unwrap();
    f.return_execution(root.resource_id).await;
    f.advance_backoff().await;
    assert_eq!(
        f.core
            .reconcile_service_continuation(root.intent_id, RUNTIME)
            .await
            .unwrap()["state"],
        "transfer_recovery_required"
    );
}
