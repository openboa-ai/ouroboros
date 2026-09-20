//! Actual disposable PostgreSQL; Runtime bindings and worker replies are explicit fixtures.
use super::*;
use ouroboros_contracts::{
    AllocationClosure, ComputeReturnReceipt, IntentState, ServiceHostPolicy, ServiceHostRequest,
};

fn host_plan(max_requests: u16) -> ServiceOperationPlan {
    let mut plan = read_plan();
    plan.host = Some(ServiceHostPolicy {
        max_requests,
        max_input_bytes: 1024,
        max_result_bytes: 1024,
    });
    plan
}

impl Fixture {
    fn host_request(&self, grant: Uuid, value: u8) -> ServiceHostRequest {
        ServiceHostRequest {
            work_id: self.work,
            delegation_id: grant,
            invocation: ServiceInvocation {
                operation: "read_snapshot".into(),
                input: json!({"value":value}),
            },
        }
    }
    async fn independent_host_caller(&self) -> (Actor, Uuid, Uuid) {
        let principal = Uuid::new_v4();
        let grant = Uuid::new_v4();
        let caller = Caller {
            fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        };
        sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
            .bind(self.core.firm)
            .bind(principal)
            .execute(&self.db)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
        )
        .bind(&caller.fingerprint)
        .bind(self.core.firm)
        .bind(principal)
        .execute(&self.db)
        .await
        .unwrap();
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(self.core.firm)
            .bind(self.work)
            .bind(principal)
            .execute(&self.db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) SELECT firm_id,$2,$3,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$4").bind(self.core.firm).bind(grant).bind(principal).bind(self.human_grant).execute(&self.db).await.unwrap();
        sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$2,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$3").bind(self.core.firm).bind(grant).bind(self.human_grant).execute(&self.db).await.unwrap();
        (Actor::Human(caller), grant, principal)
    }
    async fn host_counts(&self) -> (i64, i64) {
        let executions = sqlx::query_scalar("SELECT count(*) FROM executions WHERE firm_id=$1")
            .bind(self.core.firm)
            .fetch_one(&self.db)
            .await
            .unwrap();
        let compute =
            sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
                .bind(self.core.firm)
                .fetch_one(&self.db)
                .await
                .unwrap();
        (executions, compute)
    }
    async fn complete_host_effect(&self, peer: &BridgeIdentity, request: Uuid, value: u8) -> Uuid {
        let mut effect = child_request();
        effect.service_request_id = Some(request);
        effect.input["marker"] = json!(value);
        let child = self
            .core
            .resource_admit(Actor::Instance(peer.clone()), effect.clone())
            .await
            .unwrap();
        self.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await
            .unwrap();
        let reply = ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!({"value":value}).to_string(),
            receipt: json!({"fixture":true,"request":request}),
        };
        self.core
            .resource_complete(child.intent_id, "other-worker", reply.clone())
            .await
            .unwrap();
        effect.request_key = "changed-transport".into();
        let replay = self
            .core
            .resource_admit(Actor::Instance(peer.clone()), effect)
            .await
            .unwrap();
        assert_eq!(replay.intent_id, child.intent_id);
        assert_eq!(replay.reply, Some(reply));
        child.intent_id
    }
}

#[tokio::test]
async fn two_requests_keep_one_instance_independent_effects_and_original_results() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(2)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let before = f.host_counts().await;
    let mut children = Vec::new();
    let mut requests = Vec::new();
    let mut assignment = None;
    for value in [1, 2] {
        let key = format!("request-{value}");
        let input = f.host_request(f.human_grant, value);
        let call = f
            .core
            .admit_service_request(f.actor(), host.resource_id, &key, input.clone())
            .await
            .unwrap();
        let claim = f
            .core
            .claim_service_request(Actor::Instance(peer.clone()))
            .await
            .unwrap();
        assert_eq!(claim["request"]["intent_id"], json!(call.intent_id));
        assert_eq!(
            f.core
                .claim_service_request(Actor::Instance(peer.clone()))
                .await
                .unwrap(),
            claim
        );
        let processing = f
            .core
            .intent_by_request_key(f.actor(), "service.request", &key)
            .await
            .unwrap();
        assert_eq!(processing["intent"]["state"], "claimed");
        let child = f.complete_host_effect(&peer, call.intent_id, value).await;
        children.push(child);
        let response = json!({"value":value,"child":child});
        let receipt = f
            .core
            .reply_service_request(
                Actor::Instance(peer.clone()),
                call.intent_id,
                response.clone(),
            )
            .await
            .unwrap();
        assert_eq!(
            f.core
                .reply_service_request(
                    Actor::Instance(peer.clone()),
                    call.intent_id,
                    response.clone()
                )
                .await
                .unwrap(),
            receipt
        );
        assert!(matches!(
            f.core
                .reply_service_request(
                    Actor::Instance(peer.clone()),
                    call.intent_id,
                    json!({"changed":true})
                )
                .await,
            Err(Error::Conflict)
        ));
        let fresh = Core::new(f.db.clone(), f.core.firm);
        let lookup = fresh
            .intent_by_request_key(f.actor(), "service.request", &key)
            .await
            .unwrap();
        assert_eq!(lookup["intent"]["intent_id"], json!(call.intent_id));
        assert_eq!(lookup["resubmitted"], false);
        let restored = fresh
            .read_service_request(f.actor(), call.intent_id)
            .await
            .unwrap();
        assert_eq!(restored["result"], response);
        assert_eq!(restored["effects"][0]["intent_id"], json!(child));
        if let Some(previous) = assignment {
            assert_eq!(restored["assignment"], previous);
        }
        assignment = Some(restored["assignment"].clone());
        let repeated = fresh
            .admit_service_request(f.actor(), host.resource_id, &key, input)
            .await
            .unwrap();
        assert!(repeated.replayed);
        assert_eq!(repeated.intent_id, call.intent_id);
        assert_eq!(repeated.state, IntentState::Succeeded);
        requests.push(call.intent_id);
    }
    assert_ne!(children[0], children[1]);
    assert_ne!(requests[0], requests[1]);
    assert_eq!(f.host_counts().await, before);
    assert!(matches!(
        f.core
            .admit_service_request(
                f.actor(),
                host.resource_id,
                "third",
                f.host_request(f.human_grant, 3)
            )
            .await,
        Err(Error::Capacity)
    ));
    assert!(matches!(
        f.core
            .admit_service_request(
                f.actor(),
                host.resource_id,
                "request-1",
                f.host_request(f.human_grant, 9)
            )
            .await,
        Err(Error::Conflict)
    ));
    let observed = f
        .core
        .read(&f.human, "executions", host.resource_id)
        .await
        .unwrap();
    assert_eq!(
        observed["service_call"]["host"]["requests"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(
        observed["service_call"]["effects"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert_eq!(observed["service_call"]["effects_settled"], false);
}

#[tokio::test]
async fn concurrent_admission_and_claim_preserve_identity_and_quota() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(2)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let before = f.host_counts().await;
    let (left, right) = tokio::join!(
        f.core.admit_service_request(
            f.actor(),
            host.resource_id,
            "same",
            f.host_request(f.human_grant, 1)
        ),
        f.core.admit_service_request(
            f.actor(),
            host.resource_id,
            "same",
            f.host_request(f.human_grant, 1)
        )
    );
    let (left, right) = (left.unwrap(), right.unwrap());
    assert_eq!(left.intent_id, right.intent_id);
    assert_ne!(left.replayed, right.replayed);
    let (a, b) = tokio::join!(
        f.core.admit_service_request(
            f.actor(),
            host.resource_id,
            "second-a",
            f.host_request(f.human_grant, 2)
        ),
        f.core.admit_service_request(
            f.actor(),
            host.resource_id,
            "second-b",
            f.host_request(f.human_grant, 3)
        )
    );
    assert!(matches!(
        (&a, &b),
        (Ok(_), Err(Error::Capacity)) | (Err(Error::Capacity), Ok(_))
    ));
    let (a, b) = tokio::join!(
        f.core.claim_service_request(Actor::Instance(peer.clone())),
        f.core.claim_service_request(Actor::Instance(peer))
    );
    assert_eq!(a.unwrap(), b.unwrap());
    let counts: (i64, i64) = sqlx::query_as("SELECT (SELECT count(*) FROM service_host_requests WHERE firm_id=$1), (SELECT count(*) FROM service_host_claims WHERE firm_id=$1)")
        .bind(f.core.firm).fetch_one(&f.db).await.unwrap();
    assert_eq!(counts, (2, 1));
    assert_eq!(f.host_counts().await, before);
}

#[tokio::test]
async fn valid_other_host_cannot_use_a_foreign_request_or_reply() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(2)).await;
    let (host, peer) = f.released_service(id, invocation.clone()).await;
    let other = f
        .core
        .invoke_adapter(f.actor(), id, "second-host", invocation)
        .await
        .unwrap();
    let (ticket, other_peer) = f.bind(&other).await;
    f.finish_input(&other_peer).await;
    f.core
        .runtime_materialized(
            ticket.execution_id,
            RUNTIME,
            &Fixture::materialized(&ticket),
        )
        .await
        .unwrap();
    f.core
        .runtime_release(ticket.execution_id, RUNTIME)
        .await
        .unwrap();
    let call = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "first",
            f.host_request(f.human_grant, 1),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer))
        .await
        .unwrap();
    assert_eq!(
        f.core
            .claim_service_request(Actor::Instance(other_peer.clone()))
            .await
            .unwrap()["request"],
        Value::Null
    );
    let mut effect = child_request();
    effect.service_request_id = Some(call.intent_id);
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(other_peer.clone()), effect)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .reply_service_request(
                Actor::Instance(other_peer),
                call.intent_id,
                json!({"forged":true})
            )
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn revoked_unclaimed_request_is_observably_restricted_and_completed_replay_survives_stop() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(3)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let (caller, grant, _) = f.independent_host_caller().await;
    let denied = f
        .core
        .admit_service_request(
            caller.clone(),
            host.resource_id,
            "revoked",
            f.host_request(grant, 1),
        )
        .await
        .unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.invoke') WHERE firm_id=$1 AND delegation_id=$2")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert_eq!(
        f.core
            .claim_service_request(Actor::Instance(peer.clone()))
            .await
            .unwrap()["request"],
        Value::Null
    );
    let observed = f
        .core
        .read_service_request(caller, denied.intent_id)
        .await
        .unwrap();
    assert_eq!(observed["state"], "restricted");
    assert_eq!(observed["assignment"], Value::Null);
    let call = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "done",
            f.host_request(f.human_grant, 2),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    f.complete_host_effect(&peer, call.intent_id, 2).await;
    f.core
        .reply_service_request(Actor::Instance(peer), call.intent_id, json!({"value":2}))
        .await
        .unwrap();
    let before = f
        .core
        .read_service_request(f.actor(), call.intent_id)
        .await
        .unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    f.core
        .restrict(
            &f.human,
            "stop-after-result",
            "executions",
            host.resource_id,
            revision,
        )
        .await
        .unwrap();
    f.core
        .runtime_terminated(host.resource_id, RUNTIME)
        .await
        .unwrap();
    let replay = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "done",
            f.host_request(f.human_grant, 2),
        )
        .await
        .unwrap();
    assert_eq!(replay.intent_id, call.intent_id);
    assert!(replay.replayed);
    assert_eq!(
        f.core
            .read_service_request(f.actor(), call.intent_id)
            .await
            .unwrap(),
        before
    );
    assert!(matches!(
        f.core
            .admit_service_request(
                f.actor(),
                host.resource_id,
                "done",
                f.host_request(f.human_grant, 3)
            )
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        f.core
            .admit_service_request(
                f.actor(),
                host.resource_id,
                "new",
                f.host_request(f.human_grant, 3)
            )
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn effect_scope_rejects_missing_foreign_and_finalized_request_selectors() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(3)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let call = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "one",
            f.host_request(f.human_grant, 1),
        )
        .await
        .unwrap();
    let later = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "two",
            f.host_request(f.human_grant, 2),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    for selector in [None, Some(Uuid::new_v4()), Some(later.intent_id)] {
        let mut effect = child_request();
        effect.service_request_id = selector;
        assert!(matches!(
            f.core
                .resource_admit(Actor::Instance(peer.clone()), effect)
                .await,
            Err(Error::Denied)
        ));
    }
    let mut wrong_peer = peer.clone();
    wrong_peer.pid += 1;
    assert!(matches!(
        f.core
            .claim_service_request(Actor::Instance(wrong_peer))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core.claim_service_request(f.actor()).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .admit_service_request(
                Actor::Instance(peer.clone()),
                host.resource_id,
                "escape",
                f.host_request(f.agent_grant, 3)
            )
            .await,
        Err(Error::Denied)
    ));
    f.core
        .reply_service_request(
            Actor::Instance(peer.clone()),
            call.intent_id,
            json!({"done":true}),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    let mut delayed = child_request();
    delayed.service_request_id = Some(call.intent_id);
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), delayed)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .register_service_continuation(
                f.actor(),
                "no-host-restart",
                ouroboros_contracts::ServiceContinuationRequest {
                    execution_id: host.resource_id,
                    max_restarts: 1,
                    restart_window_seconds: 30,
                    backoff_seconds: 1
                }
            )
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn independent_caller_invocation_revocation_fences_admission_and_dispatch() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(3)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let (caller, grant, _) = f.independent_host_caller().await;
    let request = f
        .core
        .admit_service_request(
            caller.clone(),
            host.resource_id,
            "one",
            f.host_request(grant, 1),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    let mut effect = child_request();
    effect.service_request_id = Some(request.intent_id);
    let child = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), effect.clone())
        .await
        .unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.invoke') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'").bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core
            .resource_claim(child.intent_id, "other-worker", None)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_admit(Actor::Instance(peer.clone()), effect)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .reply_service_request(
                Actor::Instance(peer.clone()),
                request.intent_id,
                json!({"done":true})
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .admit_service_request(
                caller.clone(),
                host.resource_id,
                "two",
                f.host_request(grant, 2)
            )
            .await,
        Err(Error::Denied)
    ));
    // Inspection remains permitted, and an uncertain claimed request is not skipped or erased.
    let retained = f
        .core
        .read_service_request(caller, request.intent_id)
        .await
        .unwrap();
    assert_eq!(retained["result"], Value::Null);
    assert_eq!(retained["effects"][0]["intent_id"], json!(child.intent_id));
    assert!(matches!(
        f.core.claim_service_request(Actor::Instance(peer)).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn disabled_unclaimed_caller_is_restricted_without_blocking_later_authorized_request() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(3)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let (caller, grant, principal) = f.independent_host_caller().await;
    let first = f
        .core
        .admit_service_request(caller, host.resource_id, "one", f.host_request(grant, 1))
        .await
        .unwrap();
    let second = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "two",
            f.host_request(f.human_grant, 2),
        )
        .await
        .unwrap();
    sqlx::query("UPDATE principals SET enabled=false WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(principal)
        .execute(&f.db)
        .await
        .unwrap();
    let claim = f
        .core
        .claim_service_request(Actor::Instance(peer))
        .await
        .unwrap();
    assert_eq!(claim["request"]["intent_id"], json!(second.intent_id));
    let state: String = sqlx::query_scalar("SELECT state FROM intents WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(first.intent_id)
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(state, "restricted");
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM service_host_claims WHERE firm_id=$1 AND request_intent_id=$2",
    )
    .bind(f.core.firm)
    .bind(first.intent_id)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn stop_with_spare_quota_retains_unresolved_effects_and_returns_compute_once() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(host_plan(3)).await;
    let (host, peer) = f.released_service(id, invocation).await;
    let request = f
        .core
        .admit_service_request(
            f.actor(),
            host.resource_id,
            "one",
            f.host_request(f.human_grant, 1),
        )
        .await
        .unwrap();
    f.core
        .claim_service_request(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    let mut effect = child_request();
    effect.service_request_id = Some(request.intent_id);
    let child = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), effect)
        .await
        .unwrap();
    f.core
        .resource_claim(child.intent_id, "other-worker", None)
        .await
        .unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    f.core
        .restrict(
            &f.human,
            "stop-host",
            "executions",
            host.resource_id,
            revision,
        )
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .admit_service_request(
                f.actor(),
                host.resource_id,
                "two",
                f.host_request(f.human_grant, 2)
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core.claim_service_request(Actor::Instance(peer)).await,
        Err(Error::Denied)
    ));
    let before = f.host_counts().await;
    f.core
        .runtime_terminated(host.resource_id, RUNTIME)
        .await
        .unwrap();
    assert_eq!(f.host_counts().await, before);
    let history = f
        .core
        .runtime_history(host.resource_id, RUNTIME)
        .await
        .unwrap();
    let returned = ComputeReturnReceipt {
        instance_id: serde_json::from_value(history["instance_id"].clone()).unwrap(),
        generation: serde_json::from_value(history["generation"].clone()).unwrap(),
        binding: serde_json::from_value(history["binding"].clone()).unwrap(),
        cgroup: AllocationClosure::Empty,
        container_terminated: true,
        bridge_terminated: true,
        guard_terminated: true,
    };
    f.core
        .runtime_compute_return(host.resource_id, RUNTIME, &returned)
        .await
        .unwrap();
    let after = f.host_counts().await;
    assert_eq!(after.1, before.1 - 5);
    f.core
        .runtime_compute_return(host.resource_id, RUNTIME, &returned)
        .await
        .unwrap();
    assert_eq!(f.host_counts().await, after);
    let lookup = f
        .core
        .intent_by_request_key(f.actor(), "service.request", "one")
        .await
        .unwrap();
    assert_eq!(lookup["intent"]["intent_id"], json!(request.intent_id));
    let retained = f
        .core
        .read_service_request(f.actor(), request.intent_id)
        .await
        .unwrap();
    assert_eq!(retained["result"], Value::Null);
    assert_eq!(retained["effects"][0]["receipt_available"], false);
    assert_eq!(retained["effects_settled"], false);
    let observed = f
        .core
        .read(&f.human, "executions", host.resource_id)
        .await
        .unwrap();
    assert_eq!(
        observed["service_call"]["effects"][0]["intent_id"],
        json!(child.intent_id)
    );
}
