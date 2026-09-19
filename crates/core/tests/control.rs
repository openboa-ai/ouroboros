use ouroboros_contracts::{ExecutionRequest, WorkRequest};
use ouroboros_core::{Caller, Core, Error};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

async fn setup() -> (Core, PgPool, Caller, Uuid, Uuid) {
    let file = std::env::var("OURO_TEST_DATABASE_URL_FILE")
        .expect("explicit disposable database URL file required");
    let url = std::fs::read_to_string(file).unwrap();
    let pool = PgPool::connect(url.trim()).await.unwrap();
    Core::migrate(&pool).await.unwrap();
    let firm = Uuid::new_v4();
    let principal = Uuid::new_v4();
    let work_grant = Uuid::new_v4();
    let inspector = Uuid::new_v4();
    let fingerprint = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    sqlx::query("INSERT INTO firms(id) VALUES($1)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
        .bind(firm)
        .bind(principal)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
    )
    .bind(&fingerprint)
    .bind(firm)
    .bind(principal)
    .execute(&pool)
    .await
    .unwrap();
    for (id, actions) in [
        (work_grant, vec!["work.create", "execution.start"]),
        (
            inspector,
            vec!["inspect", "execution.stop", "delegation.revoke"],
        ),
    ] {
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')").bind(firm).bind(id).bind(principal).bind(actions).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO limits VALUES($1,'compute',100,0)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO profiles VALUES($1,'fixture-no-payload',true,100,60)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    (
        Core::new(pool.clone(), firm),
        pool,
        Caller { fingerprint },
        work_grant,
        inspector,
    )
}
async fn work(c: &Core, p: &Caller, d: Uuid) -> Uuid {
    c.create_work(
        p,
        "work",
        WorkRequest {
            delegation_id: d,
            purpose: "environment test".into(),
            parent_work_id: None,
        },
    )
    .await
    .unwrap()
    .resource_id
}
fn start(w: Uuid, d: Uuid, n: i64) -> ExecutionRequest {
    ExecutionRequest {
        work_id: w,
        delegation_id: d,
        profile_id: "fixture-no-payload".into(),
        units: n,
        lifetime_seconds: 30,
        predecessor_execution_id: None,
        agent_delegation_id: None,
        program: None,
    }
}
#[tokio::test]
async fn admission_recovery_and_authority() {
    let (c, pool, p, d, _) = setup().await;
    let w = work(&c, &p, d).await;
    let before = c.conditions(&p).await.unwrap();
    let cursor = before["cursor"].as_str().unwrap();
    let (a, b) = tokio::join!(
        c.start(&p, "A", start(w, d, 70)),
        c.start(&p, "B", start(w, d, 70))
    );
    assert_eq!(
        a.is_ok() as u8 + b.is_ok() as u8,
        1,
        "70+70 must not fit 100"
    );
    let (won, key, lost) = match (a, b) {
        (Ok(a), b) => (a, "A", b),
        (a, Ok(b)) => (b, "B", a),
        _ => panic!("one admission must succeed"),
    };
    assert!(matches!(lost, Err(Error::Capacity)));
    // A lost acceptance reply is recovered using the original identity, even at exhausted capacity.
    let replay = c.start(&p, key, start(w, d, 70)).await.unwrap();
    assert!(replay.replayed);
    assert_eq!(won.intent_id, replay.intent_id);
    assert!(matches!(
        c.start(&p, key, start(w, d, 71)).await,
        Err(Error::Conflict)
    ));
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM outbox WHERE firm_id=$1")
        .bind(c.firm)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 1);
    let snapshot = c.conditions(&p).await.unwrap();
    assert_eq!(snapshot["limits"][0]["committed"], 70);
    let events = c.events(&p, cursor).await.unwrap();
    assert!(!events.is_empty());
    assert!(events.windows(2).all(|e| e[0].sequence < e[1].sequence));
    let revoked = c.restrict(&p, "revoke", "delegations", d, 0).await.unwrap();
    assert!(
        c.restrict(&p, "revoke", "delegations", d, 0)
            .await
            .unwrap()
            .replayed
    );
    assert!(matches!(
        c.claim(won.intent_id, "fixture-runtime").await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        c.start(&p, "new", start(w, d, 1)).await,
        Err(Error::Denied)
    ));
    assert!(matches!(c.events(&p, cursor).await, Err(Error::Conflict)));
    // Revocation did not release unknown commitments or prevent separately authorized evidence reads.
    assert_eq!(
        c.conditions(&p).await.unwrap()["limits"][0]["committed"],
        70
    );
    assert_eq!(
        c.read(&p, "intents", revoked.intent_id).await.unwrap()["state"],
        "accepted"
    );
    assert!(c.read(&p, "intents", won.intent_id).await.is_ok());
    sqlx::query("UPDATE credentials SET enabled=false WHERE fingerprint=$1")
        .bind(&p.fingerprint)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(c.conditions(&p).await, Err(Error::Denied)));
    assert!(matches!(
        c.start(&p, key, start(w, d, 70)).await,
        Err(Error::Denied)
    ));
}
#[tokio::test]
async fn dispatch_stop_unknown_and_replacement() {
    let (c, pool, p, d, _) = setup().await;
    let w = work(&c, &p, d).await;
    let a = c.start(&p, "one", start(w, d, 30)).await.unwrap();
    let (claim1, claim2) = tokio::join!(
        c.claim(a.intent_id, "runtime"),
        c.claim(a.intent_id, "runtime")
    );
    assert_eq!(claim1.is_ok() as u8 + claim2.is_ok() as u8, 1);
    c.restrict(&p, "stop", "executions", a.resource_id, 0)
        .await
        .unwrap();
    assert_eq!(
        c.read(&p, "executions", a.resource_id).await.unwrap()["terminated"],
        false
    );
    let mut replacement = start(w, d, 10);
    replacement.predecessor_execution_id = Some(a.resource_id);
    assert!(matches!(
        c.start(&p, "replacement", replacement.clone()).await,
        Err(Error::Conflict)
    ));
    // Simulate independent reconciliation in the test store, never a public API.
    sqlx::query("UPDATE executions SET terminated=true WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(a.resource_id)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        matches!(
            c.start(&p, "replacement", replacement).await,
            Err(Error::Conflict)
        ),
        "termination alone cannot settle effects"
    );
    assert!(
        c.start(&p, "separate-work", start(w, d, 10)).await.is_ok(),
        "instance stop must not revoke the delegation"
    );
}
#[tokio::test]
async fn parent_expiry_target_deactivation_and_scope() {
    let (c, pool, p, d, _) = setup().await;
    let w = work(&c, &p, d).await;
    let a = c.start(&p, "one", start(w, d, 10)).await.unwrap();
    sqlx::query("UPDATE profiles SET active=false WHERE firm_id=$1")
        .bind(c.firm)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(
        c.claim(a.intent_id, "runtime").await,
        Err(Error::Denied)
    ));
    assert!(c.read(&p, "intents", a.intent_id).await.is_ok());
    let parent = Uuid::new_v4();
    let principal: Uuid = sqlx::query("SELECT principal_id FROM credentials WHERE fingerprint=$1")
        .bind(&p.fingerprint)
        .fetch_one(&pool)
        .await
        .unwrap()
        .get("principal_id");
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at,revoked) VALUES($1,$2,$3,ARRAY['work.create','execution.start'],clock_timestamp()+interval '1 hour',true)").bind(c.firm).bind(parent).bind(principal).execute(&pool).await.unwrap();
    sqlx::query("UPDATE delegations SET parent_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(d)
        .bind(parent)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(
        c.create_work(
            &p,
            "child",
            WorkRequest {
                delegation_id: d,
                purpose: "child".into(),
                parent_work_id: None,
            }
        )
        .await,
        Err(Error::Denied)
    ));
    let (other, _, other_p, _, _) = setup().await;
    assert!(matches!(
        c.read(&other_p, "intents", a.intent_id).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        other.read(&other_p, "intents", a.intent_id).await,
        Err(Error::NotFound)
    ));
    let fake = Caller {
        fingerprint: "a".repeat(64),
    };
    assert!(matches!(c.conditions(&fake).await, Err(Error::Denied)));
    let value: Value = c.conditions(&p).await.unwrap();
    assert_eq!(value["runtime_ready"], false);
}

#[tokio::test]
async fn runtime_binding_is_current_scoped_and_never_settles_effects() {
    use ouroboros_contracts::{BridgeIdentity, RuntimeBinding};
    use serde_json::json;
    let (c, db, human, grant, _) = setup().await;
    // Explicit fixture grants, not Runtime-created authority.
    sqlx::query(
        "UPDATE delegations SET actions=array_append(actions,'inspect') WHERE firm_id=$1 AND id=$2",
    )
    .bind(c.firm)
    .bind(grant)
    .execute(&db)
    .await
    .unwrap();
    let agent = Uuid::new_v4();
    let child = Uuid::new_v4();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'agent',true)")
        .bind(c.firm)
        .bind(agent)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour')").bind(c.firm).bind(child).bind(agent).bind(grant).execute(&db).await.unwrap();
    let w = work(&c, &human, grant).await;
    sqlx::query("UPDATE delegations SET parent_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(grant)
        .bind(child)
        .execute(&db)
        .await
        .unwrap();
    assert!(
        c.start(&human, "cyclic", start(w, grant, 70))
            .await
            .is_err()
    );
    sqlx::query("UPDATE delegations SET parent_id=NULL WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(grant)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO profiles VALUES($1,'codex-fixture',true,100,60)")
        .bind(c.firm)
        .execute(&db)
        .await
        .unwrap();
    let mut req = start(w, grant, 70);
    req.profile_id = "codex-fixture".into();
    req.agent_delegation_id = Some(child);
    let accepted = c.start(&human, "runtime-start", req).await.unwrap();
    let unclaimed = c
        .runtime_claim_observation(accepted.intent_id, "worker-A")
        .await
        .unwrap();
    assert!(unclaimed.claim.is_none() && !unclaimed.slot_released());
    assert!(!unclaimed.never_dispatched);
    assert_eq!(unclaimed.context.execution_id, accepted.resource_id);
    assert_eq!(unclaimed.context.firm_id, c.firm);
    assert_eq!(unclaimed.context.profile_id, "codex-fixture");
    let before_claim: i64 = sqlx::query_scalar("SELECT count(*) FROM attempts WHERE firm_id=$1")
        .bind(c.firm)
        .fetch_one(&db)
        .await
        .unwrap();
    for field in 0..7 {
        let mut changed = unclaimed.context.clone();
        match field {
            0 => changed.environment_id = Uuid::new_v4(),
            1 => changed.firm_id = Uuid::new_v4(),
            2 => changed.serving_generation = Uuid::new_v4(),
            3 => changed.worker_id = "worker-B".into(),
            4 => changed.intent_id = Uuid::new_v4(),
            5 => changed.execution_id = Uuid::new_v4(),
            _ => changed.profile_id = "another-profile".into(),
        }
        assert!(matches!(
            c.runtime_claim_with_context(accepted.intent_id, "worker-A", Some(&changed))
                .await,
            Err(Error::Conflict)
        ));
    }
    let restarted = Core::new(db.clone(), c.firm);
    assert!(matches!(
        restarted
            .runtime_claim_with_context(accepted.intent_id, "worker-A", Some(&unclaimed.context))
            .await,
        Err(Error::Conflict)
    ));
    let current = restarted
        .runtime_claim_observation(accepted.intent_id, "worker-A")
        .await
        .unwrap();
    assert!(current.context.same_record(&unclaimed.context));
    assert_ne!(
        current.context.serving_generation,
        unclaimed.context.serving_generation
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM attempts WHERE firm_id=$1")
            .bind(c.firm)
            .fetch_one(&db)
            .await
            .unwrap(),
        before_claim
    );
    let ticket = c
        .runtime_claim_with_context(accepted.intent_id, "worker-A", Some(&unclaimed.context))
        .await
        .unwrap();
    let claimed = c
        .runtime_claim_observation(accepted.intent_id, "worker-A")
        .await
        .unwrap();
    let assignment = claimed.claim.as_ref().unwrap();
    assert_eq!(assignment.instance_id, ticket.instance_id);
    assert_eq!(assignment.generation, ticket.generation);
    assert_eq!(assignment.attempt_id, ticket.attempt_id);
    assert!(!claimed.slot_released());
    assert!(!claimed.never_dispatched);
    assert!(matches!(
        c.runtime_claim_observation(accepted.intent_id, "worker-B")
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        c.runtime_claim_observation(Uuid::new_v4(), "worker-A")
            .await,
        Err(Error::Denied)
    ));
    assert!(
        c.runtime_claim(accepted.intent_id, "worker-A")
            .await
            .is_err()
    );
    let peer = BridgeIdentity {
        pid: 123,
        uid: 100001,
        start_ticks: 456,
        boot_id: Uuid::new_v4().to_string(),
    };
    let binding = RuntimeBinding {
        allocation: Some(ouroboros_contracts::AllocationIdentity {
            boot_id: peer.boot_id.parse().unwrap(),
            device: 31,
            inode: 1001,
            events_inode: 1002,
        }),
        container_id: "a".repeat(64),
        peer: peer.clone(),
        deadline_boottime_ns: 10_000,
    };
    assert!(
        c.runtime_bind(ticket.execution_id, "worker-B", binding.clone())
            .await
            .is_err()
    );
    for invalid in [
        None,
        Some(ouroboros_contracts::AllocationIdentity {
            boot_id: Uuid::new_v4(),
            device: 31,
            inode: 1001,
            events_inode: 1002,
        }),
        Some(ouroboros_contracts::AllocationIdentity {
            boot_id: peer.boot_id.parse().unwrap(),
            device: 31,
            inode: 0,
            events_inode: 1002,
        }),
    ] {
        let mut candidate = binding.clone();
        candidate.allocation = invalid;
        assert!(matches!(
            c.runtime_bind(ticket.execution_id, "worker-A", candidate)
                .await,
            Err(ouroboros_core::Error::Invalid)
        ));
    }
    assert!(c.instance_conditions(peer.clone()).await.is_err());
    c.runtime_bind(ticket.execution_id, "worker-A", binding.clone())
        .await
        .unwrap();
    c.runtime_bind(ticket.execution_id, "worker-A", binding.clone())
        .await
        .unwrap();
    let mut replaced_allocation = binding.clone();
    replaced_allocation.allocation.as_mut().unwrap().inode += 1;
    assert!(matches!(
        c.runtime_bind(ticket.execution_id, "worker-A", replaced_allocation)
            .await,
        Err(ouroboros_core::Error::Conflict)
    ));
    let history = c
        .runtime_history(ticket.execution_id, "worker-A")
        .await
        .unwrap();
    assert_eq!(history["binding"]["allocation"], json!(binding.allocation));
    let mut other = binding;
    other.peer.start_ticks += 1;
    assert!(
        c.runtime_bind(ticket.execution_id, "worker-A", other)
            .await
            .is_err()
    );
    assert!(c.instance_conditions(peer.clone()).await.is_err());
    // Compute authority and a bound bridge cannot release Codex without current input scope.
    assert!(
        c.runtime_release(ticket.execution_id, "worker-A")
            .await
            .is_err()
    );
    sqlx::query("INSERT INTO resource_targets VALUES($1,'catalog','file-worker',true,$2,65536)")
        .bind(c.firm)
        .bind(json!({"workspace_id":Uuid::new_v4(),"max_file_bytes":65536,"transfer_seconds":120}))
        .execute(&db)
        .await
        .unwrap();
    for d in [grant, child] {
        sqlx::query(
            "UPDATE delegations SET actions=actions||ARRAY['file.read'] WHERE firm_id=$1 AND id=$2",
        )
        .bind(c.firm)
        .bind(d)
        .execute(&db)
        .await
        .unwrap();
        sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,'catalog',ARRAY['file.read'])")
            .bind(c.firm)
            .bind(w)
            .bind(d)
            .execute(&db)
            .await
            .unwrap();
    }
    // Old records remain observable, but cannot authorize a fresh private release.
    let original_binding = history["binding"].clone();
    sqlx::query("UPDATE runtime_instances SET binding=binding-'allocation' WHERE firm_id=$1 AND execution_id=$2")
        .bind(c.firm).bind(ticket.execution_id).execute(&db).await.unwrap();
    assert!(
        c.runtime_history(ticket.execution_id, "worker-A")
            .await
            .unwrap()["binding"]["allocation"]
            .is_null()
    );
    assert!(matches!(
        c.runtime_release(ticket.execution_id, "worker-A").await,
        Err(ouroboros_core::Error::Denied)
    ));
    sqlx::query("UPDATE runtime_instances SET binding=$3 WHERE firm_id=$1 AND execution_id=$2")
        .bind(c.firm)
        .bind(ticket.execution_id)
        .bind(original_binding)
        .execute(&db)
        .await
        .unwrap();
    c.runtime_release(ticket.execution_id, "worker-A")
        .await
        .unwrap();
    assert!(
        c.runtime_release(ticket.execution_id, "worker-A")
            .await
            .is_err()
    );
    let native = ouroboros_contracts::NativeTurnReport {
        thread_id: "thread-1".into(),
        turn_id: "turn-1".into(),
        status: "inProgress".into(),
    };
    assert!(
        c.runtime_native_turn(ticket.execution_id, "worker-B", &native)
            .await
            .is_err()
    );
    c.runtime_native_turn(ticket.execution_id, "worker-A", &native)
        .await
        .unwrap();
    c.runtime_native_turn(ticket.execution_id, "worker-A", &native)
        .await
        .unwrap();
    let request = ouroboros_contracts::NativeControlRequest {
        delegation_id: grant,
        thread_id: native.thread_id.clone(),
        turn_id: native.turn_id.clone(),
        instruction: ouroboros_contracts::NativeInstruction::Steer {
            text: "inspect the input".into(),
        },
    };
    assert!(matches!(
        c.native_control(&human, ticket.execution_id, "steer", request.clone())
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['execution.steer','execution.interrupt'] WHERE firm_id=$1 AND id=$2").bind(c.firm).bind(grant).execute(&db).await.unwrap();
    let command = c
        .native_control(&human, ticket.execution_id, "steer", request.clone())
        .await
        .unwrap();
    assert_eq!(
        c.native_control(&human, ticket.execution_id, "steer", request.clone())
            .await
            .unwrap()
            .intent_id,
        command.intent_id
    );
    let mut wrong_turn = request.clone();
    wrong_turn.turn_id = "other".into();
    assert!(matches!(
        c.native_control(&human, ticket.execution_id, "wrong-turn", wrong_turn)
            .await,
        Err(Error::Conflict)
    ));
    let mut agent_request = request.clone();
    agent_request.delegation_id = child;
    assert!(matches!(
        c.native_control(
            ouroboros_core::Actor::Instance(peer.clone()),
            ticket.execution_id,
            "agent-steer",
            agent_request.clone()
        )
        .await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['execution.steer'] WHERE firm_id=$1 AND id=$2").bind(c.firm).bind(child).execute(&db).await.unwrap();
    c.native_control(
        ouroboros_core::Actor::Instance(peer.clone()),
        ticket.execution_id,
        "agent-steer",
        agent_request,
    )
    .await
    .unwrap();
    assert_eq!(
        c.read(&human, "executions", ticket.execution_id)
            .await
            .unwrap()["native_turn"]["turn_id"],
        "turn-1"
    );
    for n in 1..15 {
        c.native_control(
            &human,
            ticket.execution_id,
            &format!("steer-{n}"),
            request.clone(),
        )
        .await
        .unwrap();
    }
    assert!(matches!(
        c.native_control(&human, ticket.execution_id, "overflow", request.clone())
            .await,
        Err(Error::Capacity)
    ));
    assert_eq!(
        c.native_pending(ticket.execution_id, "worker-A")
            .await
            .unwrap()
            .len(),
        16
    );
    assert!(
        c.native_pending(ticket.execution_id, "worker-B")
            .await
            .is_err()
    );
    let (one, two) = tokio::join!(
        c.native_claim(command.intent_id, "worker-A"),
        c.native_claim(command.intent_id, "worker-A")
    );
    assert_eq!(one.is_ok() as u8 + two.is_ok() as u8, 1);
    let claimed = one.or(two).unwrap();
    c.native_dispatch_check(command.intent_id, "worker-A", claimed.attempt_id)
        .await
        .unwrap();
    assert!(c.native_claim(command.intent_id, "worker-A").await.is_err());
    let conditions = c.instance_conditions(peer.clone()).await.unwrap();
    assert_eq!(conditions["principal_id"], json!(agent));
    assert_eq!(conditions["delegations"], json!([child]));
    let mut wrong = peer.clone();
    wrong.boot_id = Uuid::new_v4().to_string();
    assert!(c.instance_conditions(wrong).await.is_err());
    c.restrict(&human, "revoke-parent", "delegations", grant, 0)
        .await
        .unwrap();
    assert!(c.instance_conditions(peer).await.is_err());
    assert!(matches!(
        c.native_control(&human, ticket.execution_id, "revoked-control", request)
            .await,
        Err(Error::Denied)
    ));
    assert!(
        c.native_dispatch_check(command.intent_id, "worker-A", claimed.attempt_id)
            .await
            .is_err()
    );
    let ack = ouroboros_contracts::NativeControlAck {
        attempt_id: claimed.attempt_id,
        native_request_id: 9,
        accepted: true,
    };
    assert!(
        c.native_ack(command.intent_id, "worker-B", &ack)
            .await
            .is_err()
    );
    c.native_ack(command.intent_id, "worker-A", &ack)
        .await
        .unwrap();
    c.native_ack(command.intent_id, "worker-A", &ack)
        .await
        .unwrap();
    let opposite = ouroboros_contracts::NativeControlAck {
        accepted: false,
        ..ack
    };
    assert!(matches!(
        c.native_ack(command.intent_id, "worker-A", &opposite).await,
        Err(Error::Conflict)
    ));
    let terminal = ouroboros_contracts::NativeTurnReport {
        status: "interrupted".into(),
        ..native.clone()
    };
    c.runtime_native_turn(ticket.execution_id, "worker-A", &terminal)
        .await
        .unwrap();
    assert!(matches!(
        c.runtime_native_turn(ticket.execution_id, "worker-A", &native)
            .await,
        Err(Error::Conflict)
    ));

    assert!(
        c.runtime_permitted(ticket.execution_id, "worker-A")
            .await
            .is_err()
    );
    let receipt = ouroboros_contracts::ComputeReturnReceipt {
        instance_id: ticket.instance_id,
        generation: ticket.generation,
        binding: serde_json::from_value(history["binding"].clone()).unwrap(),
        cgroup: ouroboros_contracts::AllocationClosure::Empty,
        container_terminated: true,
        bridge_terminated: true,
        guard_terminated: true,
    };
    assert!(matches!(
        c.runtime_compute_return(ticket.execution_id, "worker-A", &receipt)
            .await,
        Err(ouroboros_core::Error::Conflict)
    ));
    // Revocation denies work, but the assigned worker can report old obligations/termination.
    c.runtime_terminated(ticket.execution_id, "worker-A")
        .await
        .unwrap();
    c.runtime_terminated(ticket.execution_id, "worker-A")
        .await
        .unwrap();
    let state = c
        .read(&human, "executions", ticket.execution_id)
        .await
        .unwrap();
    assert_eq!(state["terminated"], true);
    let stopped_claim = c
        .runtime_claim_observation(ticket.intent_id, "worker-A")
        .await
        .unwrap();
    assert!(stopped_claim.claim.as_ref().unwrap().terminated);
    assert!(!stopped_claim.never_dispatched);
    assert!(
        !stopped_claim.slot_released(),
        "termination without compute return cannot unblock the worker"
    );
    assert_eq!(
        c.conditions(&human).await.unwrap()["limits"][0]["committed"],
        70
    );
    for field in 0..3 {
        let mut incomplete = receipt.clone();
        match field {
            0 => incomplete.container_terminated = false,
            1 => incomplete.bridge_terminated = false,
            _ => incomplete.guard_terminated = false,
        }
        assert!(matches!(
            c.runtime_compute_return(ticket.execution_id, "worker-A", &incomplete)
                .await,
            Err(ouroboros_core::Error::Invalid)
        ));
    }
    let mut wrong = receipt.clone();
    wrong.generation = Uuid::new_v4();
    assert!(matches!(
        c.runtime_compute_return(ticket.execution_id, "worker-A", &wrong)
            .await,
        Err(ouroboros_core::Error::Conflict)
    ));
    assert!(matches!(
        c.runtime_compute_return(ticket.execution_id, "worker-B", &receipt)
            .await,
        Err(ouroboros_core::Error::Denied)
    ));
    sqlx::query("INSERT INTO limits VALUES($1,'external',100,7)")
        .bind(c.firm)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO reservations(firm_id,intent_id,limit_id,units) VALUES($1,$2,'external',7)",
    )
    .bind(c.firm)
    .bind(ticket.intent_id)
    .execute(&db)
    .await
    .unwrap();
    let (first, second) = tokio::join!(
        c.runtime_compute_return(ticket.execution_id, "worker-A", &receipt),
        c.runtime_compute_return(ticket.execution_id, "worker-A", &receipt)
    );
    first.unwrap();
    second.unwrap();
    assert_eq!(
        c.conditions(&human).await.unwrap()["limits"][0]["committed"],
        0
    );
    let returns: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM compute_returns WHERE firm_id=$1 AND execution_id=$2",
    )
    .bind(c.firm)
    .bind(ticket.execution_id)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(returns, 1);
    let returned = c
        .runtime_claim_observation(ticket.intent_id, "worker-A")
        .await
        .unwrap();
    assert!(returned.slot_released());
    assert!(!returned.never_dispatched);
    assert!(returned.context.same_record(&unclaimed.context));
    assert_eq!(
        returned.claim.as_ref().unwrap().instance_id,
        ticket.instance_id
    );
    let again = c
        .runtime_claim_observation(ticket.intent_id, "worker-A")
        .await
        .unwrap();
    assert_eq!(
        again, returned,
        "read-only claim recovery must preserve the original assignment"
    );
    let outstanding: bool=sqlx::query_scalar("SELECT NOT settled FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND limit_id='external'").bind(c.firm).bind(ticket.intent_id).fetch_one(&db).await.unwrap();
    assert!(outstanding);
    assert_eq!(
        c.read(&human, "executions", ticket.execution_id)
            .await
            .unwrap()["compute_return"]["units"],
        70
    );
    assert_eq!(
        c.runtime_history(ticket.execution_id, "worker-A")
            .await
            .unwrap()["compute_return"],
        json!(receipt)
    );

    let state: String = sqlx::query_scalar("SELECT state FROM intents WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(ticket.intent_id)
        .fetch_one(&db)
        .await
        .unwrap();
    assert_ne!(state, "succeeded");
    let mut contradictory = receipt.clone();
    contradictory.cgroup = ouroboros_contracts::AllocationClosure::Deactivated;
    assert!(matches!(
        c.runtime_compute_return(ticket.execution_id, "worker-A", &contradictory)
            .await,
        Err(ouroboros_core::Error::Conflict)
    ));
    // New authority is explicitly provisioned in the fixture, never revived from the old grant.
    let mut successor = start(w, grant, 70);
    successor.profile_id = "codex-fixture".into();
    successor.agent_delegation_id = Some(child);
    successor.predecessor_execution_id = Some(ticket.execution_id);
    assert!(matches!(
        c.start(&human, "revoked-successor", successor.clone())
            .await,
        Err(Error::Denied)
    ));
    let fresh = Uuid::new_v4();
    let fresh_child = Uuid::new_v4();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) SELECT firm_id,$3,principal_id,ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour' FROM delegations WHERE firm_id=$1 AND id=$2")
        .bind(c.firm).bind(grant).bind(fresh).execute(&db).await.unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour')")
        .bind(c.firm).bind(fresh_child).bind(agent).bind(fresh).execute(&db).await.unwrap();
    successor.delegation_id = fresh;
    successor.agent_delegation_id = Some(fresh_child);
    let other_work = Uuid::new_v4();
    sqlx::query("INSERT INTO work(firm_id,id,principal_id,delegation_id,purpose) SELECT firm_id,$3,principal_id,$4,'separate fixture work' FROM work WHERE firm_id=$1 AND id=$2")
        .bind(c.firm).bind(w).bind(other_work).bind(fresh).execute(&db).await.unwrap();
    sqlx::query("INSERT INTO work_controls(firm_id,principal_id,root_work_id) SELECT firm_id,principal_id,$3 FROM work WHERE firm_id=$1 AND id=$2")
        .bind(c.firm).bind(w).bind(other_work).execute(&db).await.unwrap();
    let mut cross_work = successor.clone();
    cross_work.work_id = other_work;
    assert!(matches!(
        c.start(&human, "cross-work-successor", cross_work).await,
        Err(Error::Conflict)
    ));
    sqlx::query("UPDATE limits SET capacity=60 WHERE firm_id=$1 AND id='compute'")
        .bind(c.firm)
        .execute(&db)
        .await
        .unwrap();
    assert!(matches!(
        c.start(&human, "capacity-successor", successor.clone())
            .await,
        Err(Error::Capacity)
    ));
    sqlx::query("UPDATE limits SET capacity=100 WHERE firm_id=$1 AND id='compute'")
        .bind(c.firm)
        .execute(&db)
        .await
        .unwrap();

    let next = c
        .start(&human, "fresh-successor", successor.clone())
        .await
        .unwrap();
    assert_ne!(next.resource_id, ticket.execution_id);
    assert_eq!(
        c.start(&human, "fresh-successor", successor)
            .await
            .unwrap()
            .resource_id,
        next.resource_id
    );
    let next_ticket = c.runtime_claim(next.intent_id, "worker-A").await.unwrap();
    assert_ne!(next_ticket.instance_id, ticket.instance_id);
    assert_ne!(next_ticket.generation, ticket.generation);
    assert_eq!(
        c.conditions(&human).await.unwrap()["limits"][0]["committed"],
        70
    );
    assert_eq!(
        c.read(&human, "executions", next.resource_id)
            .await
            .unwrap()["predecessor_id"],
        json!(ticket.execution_id)
    );
    let outstanding:bool=sqlx::query_scalar("SELECT NOT settled FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND limit_id='external'").bind(c.firm).bind(ticket.intent_id).fetch_one(&db).await.unwrap();
    assert!(outstanding);
    assert!(
        c.runtime_permitted(ticket.execution_id, "worker-A")
            .await
            .is_err()
    );
}

#[tokio::test]
async fn resource_dispatch_preserves_scope_receipts_and_call_budget() {
    use ouroboros_contracts::{ResourceReply, ResourceRequest};
    use ouroboros_core::ResourceActor;
    use serde_json::json;
    let (core, pool, caller, grant, _) = setup().await;
    let w = work(&core, &caller, grant).await;
    let firm: Uuid = sqlx::query_scalar("SELECT firm_id FROM work WHERE id=$1")
        .bind(w)
        .fetch_one(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['inspect','db.write'] WHERE firm_id=$1 AND id=$2").bind(firm).bind(grant).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO resource_targets VALUES($1,'company','worker',true,'{}',65536)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO resource_scopes VALUES($1,$2,$3,'company',ARRAY['inspect','db.write'])",
    )
    .bind(firm)
    .bind(w)
    .bind(grant)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',1,0)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    let request = ResourceRequest {
        service_request_id: None,
        effect_slot: None,
        target: "company".into(),
        operation: "db.write".into(),
        request_key: "resource-one".into(),
        input: json!({"operation":"record_result","parameters":{"value":1}}),
        work_id: Some(w),
        delegation_id: Some(grant),
    };
    let actor = ResourceActor::Human(caller.clone());
    let delegate = Uuid::new_v4();
    let principal: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM work WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(w)
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,ARRAY['inspect','db.write'],clock_timestamp()+interval '1 hour')").bind(firm).bind(delegate).bind(principal).bind(grant).execute(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO resource_scopes VALUES($1,$2,$3,'company',ARRAY['inspect','db.write'])",
    )
    .bind(firm)
    .bind(w)
    .bind(delegate)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=ARRAY['inspect'] WHERE firm_id=$1 AND delegation_id=$2").bind(firm).bind(grant).execute(&pool).await.unwrap();
    let mut delegated = request.clone();
    delegated.delegation_id = Some(delegate);
    assert!(matches!(
        core.resource_admit(actor.clone(), delegated).await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE resource_scopes SET operations=ARRAY['inspect','db.write'] WHERE firm_id=$1 AND delegation_id=$2").bind(firm).bind(grant).execute(&pool).await.unwrap();
    let (first, duplicate) = tokio::join!(
        core.resource_admit(actor.clone(), request.clone()),
        core.resource_admit(actor.clone(), request.clone())
    );
    let r = first.unwrap();
    assert_eq!(duplicate.unwrap().intent_id, r.intent_id);

    assert_eq!(
        core.resource_admit(actor.clone(), request.clone())
            .await
            .unwrap()
            .intent_id,
        r.intent_id
    );
    let mut changed = request.clone();
    changed.input = json!({"different":true});
    assert!(matches!(
        core.resource_admit(actor.clone(), changed).await,
        Err(Error::Conflict)
    ));
    let mut other = request.clone();
    other.request_key = "resource-two".into();
    assert!(matches!(
        core.resource_admit(actor.clone(), other).await,
        Err(Error::Capacity)
    ));
    assert!(
        core.resource_claim(r.intent_id, "another-worker", None)
            .await
            .is_err()
    );
    core.resource_claim(r.intent_id, "worker", None)
        .await
        .unwrap();
    assert!(
        core.resource_claim(r.intent_id, "worker", None)
            .await
            .is_err()
    );
    // A lost response must not turn this claimed external operation into a fresh execution.
    assert_eq!(
        core.resource_admit(actor.clone(), request.clone())
            .await
            .unwrap()
            .state,
        "claimed"
    );
    sqlx::query("UPDATE resource_targets SET active=false WHERE firm_id=$1")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(firm)
        .bind(grant)
        .execute(&pool)
        .await
        .unwrap();
    let reply = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: "{}".into(),
        receipt: json!({"effect":r.intent_id}),
    };
    // Observation may complete the original assigned attempt after restriction; new work may not.
    core.resource_complete(r.intent_id, "worker", reply.clone())
        .await
        .unwrap();
    core.resource_complete(r.intent_id, "worker", reply.clone())
        .await
        .unwrap();
    assert!(
        core.resource_lookup(actor.clone(), r.intent_id, Some(w), Some(grant))
            .await
            .is_err()
    );
    sqlx::query("UPDATE delegations SET revoked=false WHERE firm_id=$1 AND id=$2")
        .bind(firm)
        .bind(grant)
        .execute(&pool)
        .await
        .unwrap();
    let read = core
        .resource_lookup(actor.clone(), r.intent_id, Some(w), Some(grant))
        .await
        .unwrap();
    assert_eq!(read.reply, Some(reply));
    assert_eq!(read.operation, "db.write");
    assert_eq!(
        core.resource_admit(actor, request).await.unwrap().state,
        "succeeded"
    );
    let used: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='resource_calls'")
            .bind(firm)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(used, 1);
}

#[tokio::test]
async fn file_resource_claim_checks_storage_before_consuming_the_attempt() {
    use ouroboros_contracts::{ResourceRequest, StorageClaim};
    use ouroboros_core::ResourceActor;
    use serde_json::json;

    let (core, pool, caller, grant, _) = setup().await;
    let w = work(&core, &caller, grant).await;
    let storage = StorageClaim {
        firm_id: core.firm,
        store_id: Uuid::new_v4(),
        generation: Uuid::new_v4(),
    };
    let configuration = json!({
        "workspace": "fixture-workspace",
        "store_id": storage.store_id,
        "storage_generation": storage.generation,
        "max_file_bytes": 65536,
        "transfer_seconds": 120,
    });
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['inspect','file.read'] WHERE firm_id=$1 AND id=$2")
        .bind(core.firm).bind(grant).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO resource_targets VALUES($1,'files','file-worker',true,$2,65536)")
        .bind(core.firm)
        .bind(&configuration)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO resource_scopes VALUES($1,$2,$3,'files',ARRAY['inspect','file.read'])",
    )
    .bind(core.firm)
    .bind(w)
    .bind(grant)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',1,0)")
        .bind(core.firm)
        .execute(&pool)
        .await
        .unwrap();
    let admission = core
        .resource_admit(
            ResourceActor::Human(caller),
            ResourceRequest {
                service_request_id: None,
                effect_slot: None,
                target: "files".into(),
                operation: "file.read".into(),
                request_key: "storage-bound-read".into(),
                input: json!({"path": "result.txt"}),
                work_id: Some(w),
                delegation_id: Some(grant),
            },
        )
        .await
        .unwrap();
    assert_eq!(admission.state, "accepted");

    let wrong_store = StorageClaim {
        firm_id: core.firm,
        store_id: Uuid::new_v4(),
        generation: storage.generation,
    };
    let wrong_generation = StorageClaim {
        firm_id: core.firm,
        store_id: storage.store_id,
        generation: Uuid::new_v4(),
    };
    let wrong_firm = StorageClaim {
        firm_id: Uuid::new_v4(),
        ..storage.clone()
    };
    for (case, worker, binding) in [
        ("missing storage", "file-worker", None),
        ("wrong firm", "file-worker", Some(&wrong_firm)),
        ("wrong store", "file-worker", Some(&wrong_store)),
        ("wrong generation", "file-worker", Some(&wrong_generation)),
        ("wrong worker", "another-worker", Some(&storage)),
    ] {
        assert!(
            matches!(
                core.resource_claim(admission.intent_id, worker, binding)
                    .await,
                Err(Error::Denied)
            ),
            "{case} must be denied"
        );
        let row = sqlx::query("SELECT i.state,o.claimed,(SELECT count(*) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id) AS attempts FROM intents i JOIN outbox o ON (o.firm_id,o.intent_id)=(i.firm_id,i.id) WHERE i.firm_id=$1 AND i.id=$2")
            .bind(core.firm).bind(admission.intent_id).fetch_one(&pool).await.unwrap();
        assert_eq!(row.get::<String, _>("state"), "accepted", "{case}");
        assert!(!row.get::<bool, _>("claimed"), "{case}");
        assert_eq!(row.get::<i64, _>("attempts"), 0, "{case}");
    }

    let ticket = core
        .resource_claim(admission.intent_id, "file-worker", Some(&storage))
        .await
        .unwrap();
    assert_eq!(ticket.intent_id, admission.intent_id);
    assert_eq!(ticket.configuration, configuration);
    assert!(matches!(
        core.resource_claim(admission.intent_id, "file-worker", Some(&storage))
            .await,
        Err(Error::Denied)
    ));
    let attempts: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT id,worker_id FROM attempts WHERE firm_id=$1 AND intent_id=$2")
            .bind(core.firm)
            .bind(admission.intent_id)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(attempts, vec![(ticket.attempt_id, "file-worker".into())]);
    let claimed: (String, bool) = sqlx::query_as("SELECT i.state,o.claimed FROM intents i JOIN outbox o ON (o.firm_id,o.intent_id)=(i.firm_id,i.id) WHERE i.firm_id=$1 AND i.id=$2")
        .bind(core.firm).bind(admission.intent_id).fetch_one(&pool).await.unwrap();
    assert_eq!(claimed, ("claimed".into(), true));
}

struct UploadFixture {
    core: Core,
    pool: PgPool,
    caller: Caller,
    grant: Uuid,
    work: Uuid,
    storage: ouroboros_contracts::StorageClaim,
}
impl UploadFixture {
    async fn new(capacity: Option<i64>) -> Self {
        let (core, pool, caller, grant, _) = setup().await;
        let work = work(&core, &caller, grant).await;
        let storage = ouroboros_contracts::StorageClaim {
            firm_id: core.firm,
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
        };
        sqlx::query("UPDATE delegations SET actions=actions||ARRAY['inspect','file.upload'] WHERE firm_id=$1 AND id=$2")
            .bind(core.firm).bind(grant).execute(&pool).await.unwrap();
        for target in ["files", "files-alias"] {
            sqlx::query("INSERT INTO resource_targets VALUES($1,$2,'file-worker',true,$3,65536)")
                .bind(core.firm).bind(target)
                .bind(serde_json::json!({"store_id":storage.store_id,"storage_generation":storage.generation,"max_file_bytes":65536,"transfer_seconds":120}))
                .execute(&pool).await.unwrap();
            sqlx::query(
                "INSERT INTO resource_scopes VALUES($1,$2,$3,$4,ARRAY['inspect','file.upload'])",
            )
            .bind(core.firm)
            .bind(work)
            .bind(grant)
            .bind(target)
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',100,0)")
            .bind(core.firm)
            .execute(&pool)
            .await
            .unwrap();
        if let Some(bytes) = capacity {
            sqlx::query("INSERT INTO storage_budgets(firm_id,store_id,generation,capacity_bytes) VALUES($1,$2,$3,$4)")
                .bind(core.firm).bind(storage.store_id).bind(storage.generation).bind(bytes)
                .execute(&pool).await.unwrap();
        }
        Self {
            core,
            pool,
            caller,
            grant,
            work,
            storage,
        }
    }
    fn request(&self, target: &str, key: &str, bytes: u64) -> ouroboros_contracts::ResourceRequest {
        ouroboros_contracts::ResourceRequest {
            service_request_id: None,
            effect_slot: None,
            target: target.into(),
            operation: "file.upload".into(),
            request_key: key.into(),
            input: serde_json::json!({"size":bytes,"sha256":"a".repeat(64)}),
            work_id: Some(self.work),
            delegation_id: Some(self.grant),
        }
    }
    fn actor(&self) -> ouroboros_core::ResourceActor {
        ouroboros_core::ResourceActor::Human(self.caller.clone())
    }
    async fn assert_charged(&self, bytes: i64, allocations: i64) {
        let actual: i64 = sqlx::query_scalar(
            "SELECT COALESCE(sum(committed_bytes),0)::bigint FROM storage_budgets WHERE firm_id=$1",
        )
        .bind(self.core.firm)
        .fetch_one(&self.pool)
        .await
        .unwrap();
        let rows: (i64, i64) = sqlx::query_as("SELECT count(*),COALESCE(sum(bytes),0)::bigint FROM storage_allocations WHERE firm_id=$1")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap();
        let calls: i64 = sqlx::query_scalar(
            "SELECT committed FROM limits WHERE firm_id=$1 AND id='resource_calls'",
        )
        .bind(self.core.firm)
        .fetch_one(&self.pool)
        .await
        .unwrap();
        let outbox: i64 = sqlx::query_scalar("SELECT count(*) FROM outbox o JOIN resource_calls r USING(firm_id,intent_id) WHERE o.firm_id=$1")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap();
        assert_eq!(actual, bytes);
        assert_eq!(rows, (allocations, bytes));
        assert_eq!(
            calls, allocations,
            "call and byte admission must commit together"
        );
        assert_eq!(
            outbox, allocations,
            "rejected uploads cannot leave dispatch records"
        );
    }
}

#[tokio::test]
async fn storage_capacity_serializes_aliases_and_retains_completed_and_unknown_uploads() {
    use ouroboros_contracts::ResourceReply;
    use serde_json::json;
    let f = UploadFixture::new(Some(100)).await;
    let a = f.request("files", "capacity-A", 70);
    let b = f.request("files-alias", "capacity-B", 70);
    let (first, second) = tokio::join!(
        f.core.resource_admit(f.actor(), a.clone()),
        f.core.resource_admit(f.actor(), b.clone())
    );
    let (won, request) = match (first, second) {
        (Ok(won), Err(Error::Capacity)) => (won, a),
        (Err(Error::Capacity), Ok(won)) => (won, b),
        (a, b) => {
            panic!("exactly one 70-byte upload must fit a shared 100-byte store: {a:?}, {b:?}")
        }
    };
    f.assert_charged(70, 1).await;
    let (replay_a, replay_b) = tokio::join!(
        f.core.resource_admit(f.actor(), request.clone()),
        f.core.resource_admit(f.actor(), request.clone())
    );
    assert_eq!(replay_a.unwrap().intent_id, won.intent_id);
    assert_eq!(replay_b.unwrap().intent_id, won.intent_id);
    let mut changed = request.clone();
    changed.input["size"] = json!(69);
    assert!(matches!(
        f.core.resource_admit(f.actor(), changed).await,
        Err(Error::Conflict)
    ));
    f.assert_charged(70, 1).await;

    f.core
        .resource_upload_ready(
            f.actor(),
            won.intent_id,
            Some(f.work),
            Some(f.grant),
            &"a".repeat(64),
            70,
        )
        .await
        .unwrap();
    f.core
        .resource_claim(won.intent_id, "file-worker", Some(&f.storage))
        .await
        .unwrap();
    let reply = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: json!({"intent_id":won.intent_id,"upload_id":won.intent_id,"sha256":"a".repeat(64)})
            .to_string(),
        receipt: json!({"source":"catalog","upload_receipt":won.intent_id,"sha256":"a".repeat(64),"size":70}),
    };
    f.core
        .resource_complete(won.intent_id, "file-worker", reply.clone())
        .await
        .unwrap();
    f.core
        .resource_complete(won.intent_id, "file-worker", reply)
        .await
        .unwrap();
    f.assert_charged(70, 1).await;
    assert_eq!(
        f.core
            .resource_admit(f.actor(), request)
            .await
            .unwrap()
            .state,
        "succeeded"
    );

    // Equal content claims still reserve the full staging bound under a new intent.
    let unresolved = f
        .core
        .resource_admit(f.actor(), f.request("files-alias", "remaining", 30))
        .await
        .unwrap();
    f.core
        .resource_claim(unresolved.intent_id, "file-worker", Some(&f.storage))
        .await
        .unwrap();
    let reopened = Core::new(f.pool.clone(), f.core.firm);
    assert!(matches!(
        reopened
            .resource_admit(f.actor(), f.request("files", "overfull", 1))
            .await,
        Err(Error::Capacity)
    ));
    assert!(matches!(
        reopened
            .resource_claim(unresolved.intent_id, "file-worker", Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    reopened
        .restrict(&f.caller, "revoke-upload", "delegations", f.grant, 0)
        .await
        .unwrap();
    assert!(matches!(
        reopened
            .resource_admit(f.actor(), f.request("files", "revoked", 0))
            .await,
        Err(Error::Denied)
    ));
    f.assert_charged(100, 2).await;
    let states: Vec<String> = sqlx::query_scalar("SELECT i.state FROM storage_allocations s JOIN intents i ON (i.firm_id,i.id)=(s.firm_id,s.intent_id) WHERE s.firm_id=$1 ORDER BY s.bytes")
        .bind(f.core.firm).fetch_all(&f.pool).await.unwrap();
    assert_eq!(states, vec!["claimed", "succeeded"]);
}

#[tokio::test]
async fn storage_admission_rejects_missing_budgets_invalid_bounds_and_unreserved_dispatch() {
    use serde_json::json;
    let missing = UploadFixture::new(None).await;
    assert!(matches!(
        missing
            .core
            .resource_admit(missing.actor(), missing.request("files", "missing", 0))
            .await,
        Err(Error::Capacity)
    ));
    missing.assert_charged(0, 0).await;

    let f = UploadFixture::new(Some(65_536)).await;
    let mut invalid = vec![
        json!(-1),
        json!(1.5),
        json!("1"),
        Value::Null,
        json!(65_537),
        json!(u64::MAX),
    ];
    for (index, size) in invalid.drain(..).enumerate() {
        let mut request = f.request("files", &format!("bad-size-{index}"), 1);
        request.input["size"] = size;
        assert!(matches!(
            f.core.resource_admit(f.actor(), request).await,
            Err(Error::Invalid)
        ));
    }
    for (index, digest) in [
        json!("a".repeat(63)),
        json!("a".repeat(65)),
        json!("g".repeat(64)),
        json!("A".repeat(64)),
        json!(0),
        Value::Null,
    ]
    .into_iter()
    .enumerate()
    {
        let mut request = f.request("files", &format!("bad-digest-{index}"), 1);
        request.input["sha256"] = digest;
        assert!(matches!(
            f.core.resource_admit(f.actor(), request).await,
            Err(Error::Invalid)
        ));
    }
    f.assert_charged(0, 0).await;
    // A later call-budget rejection must undo the earlier byte reservation.
    sqlx::query("UPDATE limits SET capacity=0 WHERE firm_id=$1 AND id='resource_calls'")
        .bind(f.core.firm)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_admit(f.actor(), f.request("files", "no-call-budget", 1))
            .await,
        Err(Error::Capacity)
    ));
    f.assert_charged(0, 0).await;
    sqlx::query("UPDATE limits SET capacity=100 WHERE firm_id=$1 AND id='resource_calls'")
        .bind(f.core.firm)
        .execute(&f.pool)
        .await
        .unwrap();
    let accepted = f
        .core
        .resource_admit(f.actor(), f.request("files", "largest", 65_536))
        .await
        .unwrap();
    f.assert_charged(65_536, 1).await;
    // Simulate a pre-migration accepted request with no byte allocation. Neither
    // upload-ready nor a worker claim may start that unreserved effect.
    sqlx::query("DELETE FROM storage_allocations WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(accepted.intent_id)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_upload_ready(
                f.actor(),
                accepted.intent_id,
                Some(f.work),
                Some(f.grant),
                &"a".repeat(64),
                65_536
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_claim(accepted.intent_id, "file-worker", Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    let state: (String, i64) = sqlx::query_as("SELECT i.state,(SELECT count(*) FROM attempts a WHERE a.firm_id=i.firm_id AND a.intent_id=i.id) FROM intents i WHERE i.firm_id=$1 AND i.id=$2")
        .bind(f.core.firm).bind(accepted.intent_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(state, ("accepted".into(), 0));

    let zero = UploadFixture::new(Some(0)).await;
    zero.core
        .resource_admit(zero.actor(), zero.request("files", "empty", 0))
        .await
        .unwrap();
    assert!(matches!(
        zero.core
            .resource_admit(zero.actor(), zero.request("files", "nonempty", 1))
            .await,
        Err(Error::Capacity)
    ));
    zero.assert_charged(0, 1).await;
}

#[tokio::test]
async fn late_execution_admission_failure_rolls_back_all_effects() {
    let (core, pool, caller, grant, _) = setup().await;
    let work_id = work(&core, &caller, grant).await;
    // A late storage failure must not leave capacity, intent or dispatch fragments.
    // Audited DDL: generated UUID names/values; below, table names come from a literal set.
    let suffix = core.firm.simple().to_string();
    let function = format!("fail_outbox_{suffix}");
    let trigger = format!("fail_outbox_{suffix}");
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "CREATE FUNCTION {function}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.firm_id='{}'::uuid THEN RAISE EXCEPTION 'fixture late admission failure'; END IF; RETURN NEW; END $$",
        core.firm
    ))).execute(&pool).await.unwrap();
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "CREATE TRIGGER {trigger} BEFORE INSERT ON outbox FOR EACH ROW EXECUTE FUNCTION {function}()"
    ))).execute(&pool).await.unwrap();
    let result = core
        .start(&caller, "late-admission", start(work_id, grant, 70))
        .await;
    sqlx::query(sqlx::AssertSqlSafe(format!(
        "DROP TRIGGER {trigger} ON outbox"
    )))
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(sqlx::AssertSqlSafe(format!("DROP FUNCTION {function}()")))
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(result, Err(Error::Unavailable)));
    for table in ["executions", "reservations", "outbox"] {
        let count: i64 = sqlx::query_scalar(sqlx::AssertSqlSafe(format!(
            "SELECT count(*) FROM {table} WHERE firm_id=$1"
        )))
        .bind(core.firm)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 0, "partial {table} survived failed admission");
    }
    let committed: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(core.firm)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(committed, 0);
    let accepted = core
        .start(&caller, "late-admission", start(work_id, grant, 70))
        .await
        .unwrap();
    assert!(!accepted.replayed);
    let replay = core
        .start(&caller, "late-admission", start(work_id, grant, 70))
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(accepted.intent_id, replay.intent_id);
}

#[tokio::test]
async fn timer_registration_is_explicit_idempotent_and_does_not_reserve() {
    use ouroboros_contracts::{WakeCancelRequest, WakeRequest};
    let (core, pool, caller, grant, _) = setup().await;
    let work_id = work(&core, &caller, grant).await;
    let now: i64 =
        sqlx::query_scalar("SELECT floor(extract(epoch FROM clock_timestamp()))::bigint")
            .fetch_one(&pool)
            .await
            .unwrap();
    let request = WakeRequest {
        due_at_seconds: now + 60,
        expires_at_seconds: now + 120,
        execution: start(work_id, grant, 70),
    };
    assert!(matches!(
        core.register_wake(&caller, "timer", request.clone()).await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['wake.register','wake.cancel','inspect'] WHERE firm_id=$1 AND id=$2")
        .bind(core.firm).bind(grant).execute(&pool).await.unwrap();
    let (one, two) = tokio::join!(
        core.register_wake(&caller, "timer", request.clone()),
        core.register_wake(&caller, "timer", request.clone())
    );
    let (one, two) = (one.unwrap(), two.unwrap());
    assert_eq!(one.intent_id, two.intent_id);
    assert_ne!(one.replayed, two.replayed);
    assert_eq!(
        core.wake(&caller, one.resource_id).await.unwrap()["cancelled"],
        false
    );
    let mut changed = request.clone();
    changed.due_at_seconds += 1;
    assert!(matches!(
        core.register_wake(&caller, "timer", changed).await,
        Err(Error::Conflict)
    ));
    let committed: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(core.firm)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(committed, 0);
    let executions: i64 = sqlx::query_scalar("SELECT count(*) FROM executions WHERE firm_id=$1")
        .bind(core.firm)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(executions, 0);
    core.cancel_wake(
        &caller,
        one.resource_id,
        "cancel",
        WakeCancelRequest {
            delegation_id: grant,
        },
    )
    .await
    .unwrap();
    assert_eq!(
        core.wake(&caller, one.resource_id).await.unwrap()["cancelled"],
        true
    );
    let replay = core
        .register_wake(&caller, "timer", request.clone())
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(
        core.wake(&caller, replay.resource_id).await.unwrap()["cancelled"],
        true
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(core.firm)
        .bind(grant)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(
        core.register_wake(&caller, "new-timer", request).await,
        Err(Error::Denied)
    ));
    // The separate inspector remains authorized to read; removed mutation rights do not erase it.
    assert!(core.wake(&caller, one.resource_id).await.is_ok());
}

#[tokio::test]
async fn wake_delivery_is_atomic_deduplicated_and_currently_authorized() {
    use ouroboros_contracts::{WakeCancelRequest, WakeRequest};
    let (core, pool, caller, grant, _) = setup().await;
    let work_id = work(&core, &caller, grant).await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['wake.register','wake.cancel','inspect'] WHERE firm_id=$1 AND id=$2")
        .bind(core.firm).bind(grant).execute(&pool).await.unwrap();
    let now: i64 =
        sqlx::query_scalar("SELECT floor(extract(epoch FROM clock_timestamp()))::bigint")
            .fetch_one(&pool)
            .await
            .unwrap();
    let request = WakeRequest {
        due_at_seconds: now + 60,
        expires_at_seconds: now + 3600,
        execution: start(work_id, grant, 70),
    };
    let one = core
        .register_wake(&caller, "one", request.clone())
        .await
        .unwrap();
    let two = core.register_wake(&caller, "two", request).await.unwrap();
    assert!(matches!(
        core.deliver_wake(one.resource_id).await,
        Err(Error::Conflict)
    ));
    // Fixture clock selection avoids waiting and does not alter expiry or grants.
    sqlx::query("UPDATE wake_registrations SET due_at_seconds=$2 WHERE firm_id=$1")
        .bind(core.firm)
        .bind(now - 1)
        .execute(&pool)
        .await
        .unwrap();
    let (a, b) = tokio::join!(
        core.deliver_wake(one.resource_id),
        core.deliver_wake(one.resource_id)
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(a.intent_id, b.intent_id);
    assert_ne!(a.replayed, b.replayed);
    assert!(matches!(
        core.deliver_wake(two.resource_id).await,
        Err(Error::Conflict)
    ));
    let restarted = Core::new(pool.clone(), core.firm);
    assert_eq!(
        restarted
            .deliver_wake(one.resource_id)
            .await
            .unwrap()
            .intent_id,
        a.intent_id
    );
    let counts:(i64,i64)=sqlx::query_as("SELECT (SELECT count(*) FROM wake_occurrences WHERE firm_id=$1),(SELECT committed FROM limits WHERE firm_id=$1 AND id='compute')")
        .bind(core.firm).fetch_one(&pool).await.unwrap();
    assert_eq!(counts, (1, 70));
    core.cancel_wake(
        &caller,
        one.resource_id,
        "cancel-admitted",
        WakeCancelRequest {
            delegation_id: grant,
        },
    )
    .await
    .unwrap();
    assert!(matches!(
        core.claim(a.intent_id, "worker").await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        core.deliver_wake(one.resource_id).await,
        Err(Error::Denied)
    ));
    // Cancelling does not erase an unresolved reservation or fabricate a return receipt.
    let units: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(core.firm)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(units, 70);
}

#[tokio::test]
async fn credential_enrollment_admits_only_scoped_metadata() {
    use ouroboros_contracts::ResourceRequest;
    use ouroboros_core::ResourceActor;
    use serde_json::json;
    let (core, pool, caller, grant, _) = setup().await;
    let w = work(&core, &caller, grant).await;
    let firm: Uuid = sqlx::query_scalar("SELECT firm_id FROM work WHERE id=$1")
        .bind(w)
        .fetch_one(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['inspect','credential.enroll'] WHERE firm_id=$1 AND id=$2")
        .bind(firm).bind(grant).execute(&pool).await.unwrap();
    sqlx::query(
        "INSERT INTO resource_targets VALUES($1,'custody','custody-management',true,'{}',1024)",
    )
    .bind(firm)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',10,0)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    let actor = ResourceActor::Human(caller);
    let request = ResourceRequest {
        service_request_id: None,
        effect_slot: None,
        target: "custody".into(),
        operation: "credential.enroll".into(),
        request_key: "enroll-metadata".into(),
        input: json!({"credential_id":Uuid::new_v4(),"enrollment_id":Uuid::new_v4(),"version":1}),
        work_id: Some(w),
        delegation_id: Some(grant),
    };
    assert!(matches!(
        core.resource_admit(actor.clone(), request.clone()).await,
        Err(Error::Denied)
    ));
    sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,'custody',ARRAY['inspect','credential.enroll'])")
        .bind(firm).bind(w).bind(grant).execute(&pool).await.unwrap();
    for (key, value) in [
        ("secret", json!("synthetic-never-persist")),
        ("version", json!(0)),
        ("credential_id", json!(Uuid::nil())),
        ("enrollment_id", json!("invalid")),
    ] {
        let mut invalid = request.clone();
        invalid.input[key] = value;
        assert!(matches!(
            core.resource_admit(actor.clone(), invalid).await,
            Err(Error::Invalid)
        ));
    }
    let before: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM intents WHERE firm_id=$1 AND operation='credential.enroll'",
    )
    .bind(firm)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(before, 0);
    let admission = core
        .resource_admit(actor.clone(), request.clone())
        .await
        .unwrap();
    assert_eq!(admission.state, "accepted");
    core.credential_transfer_access(actor.clone(), admission.intent_id, Some(w), Some(grant))
        .await
        .unwrap();
    let replacement_fingerprint = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    sqlx::query("INSERT INTO credentials SELECT $1,firm_id,principal_id,true,clock_timestamp()+interval '1 hour' FROM delegations WHERE firm_id=$2 AND id=$3")
        .bind(&replacement_fingerprint).bind(firm).bind(grant).execute(&pool).await.unwrap();
    assert!(
        core.credential_transfer_access(
            ResourceActor::Human(Caller {
                fingerprint: replacement_fingerprint
            }),
            admission.intent_id,
            Some(w),
            Some(grant)
        )
        .await
        .is_err()
    );

    assert_eq!(
        core.resource_admit(actor.clone(), request.clone())
            .await
            .unwrap()
            .intent_id,
        admission.intent_id
    );
    let mut changed = request.clone();
    changed.input["version"] = json!(2);
    assert!(matches!(
        core.resource_admit(actor.clone(), changed).await,
        Err(Error::Conflict)
    ));
    let recorded: Value =
        sqlx::query_scalar("SELECT input FROM intents WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(admission.intent_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(recorded["input"], request.input);
    assert!(
        core.resource_claim(admission.intent_id, "provider-consumer", None)
            .await
            .is_err()
    );
    let mut model = request.clone();
    model.operation = "model.responses".into();
    model.request_key = "enrollment-does-not-grant-use".into();
    model.input = json!({"model":"fixture-only","input":"synthetic"});
    assert!(matches!(
        core.resource_admit(actor.clone(), model).await,
        Err(Error::Denied)
    ));
    assert!(
        core.enrollment_receipt_recovery(admission.intent_id, "custody-management")
            .await
            .is_err()
    );
    let mut observation_request = request.clone();
    observation_request.request_key = "claimed-enrollment-observation".into();
    observation_request.input["enrollment_id"] = json!(Uuid::new_v4());
    let observation = core
        .resource_admit(actor.clone(), observation_request.clone())
        .await
        .unwrap();
    let claimed = core
        .resource_claim(observation.intent_id, "custody-management", None)
        .await
        .unwrap();
    assert!(
        core.enrollment_receipt_recovery(observation.intent_id, "provider-consumer")
            .await
            .is_err()
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(firm)
        .bind(grant)
        .execute(&pool)
        .await
        .unwrap();
    assert!(core.resource_admit(actor, request).await.is_err());
    assert!(
        core.resource_claim(admission.intent_id, "custody-management", None)
            .await
            .is_err()
    );
    let recovered = core
        .enrollment_receipt_recovery(observation.intent_id, "custody-management")
        .await
        .unwrap();
    assert_eq!(recovered.original_attempt_id, claimed.attempt_id);
    assert_eq!(
        json!(recovered.enrollment_id),
        observation_request.input["enrollment_id"]
    );
}

#[tokio::test]
async fn unstarted_cancellation_is_atomic_current_and_does_not_settle_claimed_work() {
    let (c, db, p, grant, inspector) = setup().await;
    let w = work(&c, &p, grant).await;
    let first = c
        .start(&p, "cancel-source", start(w, grant, 70))
        .await
        .unwrap();
    assert!(matches!(
        c.cancel_unstarted(&p, first.resource_id, "cancel", 1).await,
        Err(Error::Conflict)
    ));
    let receipt = c
        .cancel_unstarted(&p, first.resource_id, "cancel", 0)
        .await
        .unwrap();
    assert_eq!(receipt["released_compute_units"], 70);
    assert_eq!(receipt["never_dispatched"], true);
    assert_eq!(
        c.cancel_unstarted(&p, first.resource_id, "cancel", 0)
            .await
            .unwrap(),
        receipt
    );
    let detail = c.read(&p, "executions", first.resource_id).await.unwrap();
    assert_eq!(detail["state"], "restricted");
    assert_eq!(detail["stopped"], true);
    assert_eq!(detail["terminated"], false);
    assert_eq!(detail["unstarted_cancellation"], receipt);
    assert!(matches!(
        c.claim(first.intent_id, "late-worker").await,
        Err(Error::Denied)
    ));
    let used: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(c.firm)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(used, 0);
    assert!(
        sqlx::query("DELETE FROM unstarted_cancellations WHERE firm_id=$1")
            .bind(c.firm)
            .execute(&db)
            .await
            .is_err()
    );
    let second = c.start(&p, "second", start(w, grant, 70)).await.unwrap();
    assert!(matches!(
        c.cancel_unstarted(&p, second.resource_id, "cancel", 0)
            .await,
        Err(Error::Conflict)
    ));
    let (claim, cancel) = tokio::join!(
        c.claim(second.intent_id, "racing-worker"),
        c.cancel_unstarted(&p, second.resource_id, "race", 1)
    );
    assert_eq!(usize::from(claim.is_ok()) + usize::from(cancel.is_ok()), 1);
    let used: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(c.firm)
            .fetch_one(&db)
            .await
            .unwrap();
    assert_eq!(used, if claim.is_ok() { 70 } else { 0 });
    if claim.is_ok() {
        assert!(matches!(
            c.cancel_unstarted(&p, second.resource_id, "cannot-settle", 1)
                .await,
            Err(Error::Conflict)
        ));
    }
    let third = c
        .start(&p, "already-claimed", start(w, grant, 20))
        .await
        .unwrap();
    c.claim(third.intent_id, "actual-claim").await.unwrap();
    let current: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(c.firm)
        .fetch_one(&db)
        .await
        .unwrap();
    assert!(matches!(
        c.cancel_unstarted(&p, third.resource_id, "claimed-denial", current)
            .await,
        Err(Error::Conflict)
    ));
    let retained: i64 = sqlx::query_scalar(
        "SELECT units FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND NOT settled",
    )
    .bind(c.firm)
    .bind(third.intent_id)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(retained, 20);
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(inspector)
        .execute(&db)
        .await
        .unwrap();
    assert!(matches!(
        c.cancel_unstarted(&p, first.resource_id, "cancel", 0).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn runtime_claim_non_dispatch_requires_original_settled_cancellation() {
    let (c, db, p, grant, _) = setup().await;
    let w = work(&c, &p, grant).await;
    let first = c
        .start(&p, "cancel-race", start(w, grant, 30))
        .await
        .unwrap();
    let before = c
        .runtime_claim_observation(first.intent_id, "runtime")
        .await
        .unwrap();
    assert!(before.claim.is_none() && !before.never_dispatched);
    c.cancel_unstarted(&p, first.resource_id, "cancel", 0)
        .await
        .unwrap();
    assert!(matches!(
        c.runtime_claim_with_context(first.intent_id, "runtime", Some(&before.context))
            .await,
        Err(Error::Denied)
    ));
    let canceled = c
        .runtime_claim_observation(first.intent_id, "runtime")
        .await
        .unwrap();
    assert!(before.context.same_record(&canceled.context));
    assert_eq!(canceled.intent_state, "restricted");
    assert!(canceled.claim.is_none() && canceled.never_dispatched);
    assert!(!canceled.slot_released());

    // Withhold or contradict one piece of original settlement evidence in this disposable DB.
    for (mutation, restore) in [
        (
            "UPDATE reservations SET settled=false WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'",
            "UPDATE reservations SET settled=true WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'",
        ),
        (
            "UPDATE reservations SET units=31 WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'",
            "UPDATE reservations SET units=30 WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'",
        ),
        (
            "UPDATE outbox SET claimed=true WHERE firm_id=$1 AND intent_id=$2",
            "UPDATE outbox SET claimed=false WHERE firm_id=$1 AND intent_id=$2",
        ),
        (
            "INSERT INTO attempts(firm_id,id,intent_id,worker_id,state) VALUES($1,gen_random_uuid(),$2,'runtime','claimed')",
            "DELETE FROM attempts WHERE firm_id=$1 AND intent_id=$2",
        ),
    ] {
        sqlx::query(mutation)
            .bind(c.firm)
            .bind(first.intent_id)
            .execute(&db)
            .await
            .unwrap();
        assert!(
            !c.runtime_claim_observation(first.intent_id, "runtime")
                .await
                .unwrap()
                .never_dispatched,
            "incomplete dispatch or settlement evidence cannot resolve a claim"
        );
        sqlx::query(restore)
            .bind(c.firm)
            .bind(first.intent_id)
            .execute(&db)
            .await
            .unwrap();
    }
    assert_eq!(
        c.runtime_claim_observation(first.intent_id, "runtime")
            .await
            .unwrap(),
        canceled
    );

    // Another execution's cancellation cannot prove non-dispatch for this stopped record.
    let other = c.start(&p, "other", start(w, grant, 30)).await.unwrap();
    for mutation in [
        "UPDATE executions SET stopped=true WHERE firm_id=$1 AND intent_id=$2",
        "UPDATE intents SET state='restricted' WHERE firm_id=$1 AND id=$2",
        "UPDATE reservations SET settled=true WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'",
    ] {
        sqlx::query(mutation)
            .bind(c.firm)
            .bind(other.intent_id)
            .execute(&db)
            .await
            .unwrap();
    }
    let incomplete = c
        .runtime_claim_observation(other.intent_id, "runtime")
        .await
        .unwrap();
    assert_eq!(incomplete.intent_state, "restricted");
    assert!(incomplete.claim.is_none() && !incomplete.never_dispatched);
}

/// Independent contract model: accepted requests retain their input, identity and capacity;
/// current execution authority gates fresh work and dispatch, never historical inspection.
/// The model uses no Core state representation, database query or implementation helper.
#[tokio::test]
async fn bounded_operation_sequences_preserve_authority_identity_and_capacity() {
    use std::collections::BTreeMap;

    #[derive(Clone, Copy, Debug)]
    enum Operation {
        Submit(usize, i64),
        Claim(usize),
        Revoke,
    }
    #[derive(Clone, Copy, Debug, PartialEq)]
    enum Expected {
        New,
        Replay,
        Conflict,
        Denied,
        Capacity,
        Claim,
        Revoked,
    }
    struct Model {
        authorized: bool,
        requests: BTreeMap<usize, (i64, bool)>,
    }
    impl Model {
        fn committed(&self) -> i64 {
            self.requests.values().map(|(units, _)| units).sum()
        }
        fn apply(&mut self, operation: Operation) -> Expected {
            match operation {
                Operation::Revoke => {
                    self.authorized = false;
                    Expected::Revoked
                }
                Operation::Claim(key) => match self.requests.get_mut(&key) {
                    Some((_, claimed)) if self.authorized && !*claimed => {
                        *claimed = true;
                        Expected::Claim
                    }
                    _ => Expected::Denied,
                },
                Operation::Submit(key, units) => {
                    if let Some((original, _)) = self.requests.get(&key) {
                        return if *original == units {
                            Expected::Replay
                        } else {
                            Expected::Conflict
                        };
                    }
                    if !self.authorized {
                        return Expected::Denied;
                    }
                    if self.committed() + units > 100 {
                        return Expected::Capacity;
                    }
                    self.requests.insert(key, (units, false));
                    Expected::New
                }
            }
        }
    }

    // Fixed finite sequences are reproducible. Generated suffixes vary ordering/key reuse;
    // the common prefix ensures every run includes acceptance, conflict, replay and overflow.
    for seed in [1_u64, 17, 63, 255] {
        let (core, _pool, caller, grant, _) = setup().await;
        let work = work(&core, &caller, grant).await;
        let mut operations = vec![
            Operation::Submit(0, 70),
            Operation::Submit(0, 70),
            Operation::Submit(0, 71),
            Operation::Submit(1, 70),
            Operation::Claim(0),
            Operation::Claim(0),
        ];
        let mut state = seed;
        for step in 0..24 {
            if step == 4 + (seed % 8) {
                operations.push(Operation::Revoke);
            }
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let key = (state % 6) as usize;
            operations.push(if state & 3 == 0 {
                Operation::Claim(0)
            } else {
                Operation::Submit(key, [1, 10, 30, 70][((state >> 8) % 4) as usize])
            });
        }
        operations.extend([
            Operation::Submit(0, 70),
            Operation::Submit(99, 1),
            Operation::Claim(0),
        ]);
        let mut model = Model {
            authorized: true,
            requests: BTreeMap::new(),
        };
        let mut identities = BTreeMap::new();
        for (step, operation) in operations.into_iter().enumerate() {
            let expected = model.apply(operation);
            let actual = match operation {
                Operation::Submit(key, units) => {
                    match core
                        .start(
                            &caller,
                            &format!("sequence-{key}"),
                            start(work, grant, units),
                        )
                        .await
                    {
                        Ok(value) if value.replayed => {
                            assert_eq!(
                                identities[&key],
                                (value.intent_id, value.resource_id),
                                "seed {seed} step {step}"
                            );
                            Expected::Replay
                        }
                        Ok(value) => {
                            assert!(
                                identities
                                    .insert(key, (value.intent_id, value.resource_id))
                                    .is_none()
                            );
                            Expected::New
                        }
                        Err(Error::Conflict) => Expected::Conflict,
                        Err(Error::Denied) => Expected::Denied,
                        Err(Error::Capacity) => Expected::Capacity,
                        Err(error) => panic!("unexpected {error:?}, seed {seed} step {step}"),
                    }
                }
                Operation::Claim(key) => {
                    match core.claim(identities[&key].0, "sequence-worker").await {
                        Ok(_) => Expected::Claim,
                        Err(Error::Denied) => Expected::Denied,
                        Err(error) => panic!("unexpected {error:?}, seed {seed} step {step}"),
                    }
                }
                Operation::Revoke => {
                    core.restrict(&caller, "sequence-revoke", "delegations", grant, 0)
                        .await
                        .unwrap();
                    Expected::Revoked
                }
            };
            assert_eq!(actual, expected, "seed {seed} step {step}: {operation:?}");
            let conditions = core.conditions(&caller).await.unwrap();
            let committed = conditions["limits"]
                .as_array()
                .unwrap()
                .iter()
                .find(|limit| limit["id"] == "compute")
                .unwrap()["committed"]
                .as_i64()
                .unwrap();
            assert_eq!(
                committed,
                model.committed(),
                "seed {seed} step {step}: capacity changed without settlement"
            );
            for (key, (_, claimed)) in &model.requests {
                let record = core
                    .read(&caller, "intents", identities[key].0)
                    .await
                    .unwrap();
                assert_eq!(
                    record["state"],
                    if *claimed { "claimed" } else { "accepted" }
                );
            }
        }
    }
}
