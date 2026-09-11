//! PostgreSQL policy integration tests with explicitly fabricated Runtime bindings.
//! These exercise Core transactions, not Linux bridge/kernel identity or native Codex execution.
use ouroboros_contracts::{
    Accepted, BridgeIdentity, ExecutionRequest, ResourceRequest, RuntimeBinding, WorkRequest,
};
use ouroboros_core::{Actor, Caller, Core, Error};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const ACTIONS: &[&str] = &[
    "inspect",
    "work.create",
    "execution.start",
    "execution.stop",
    "delegation.revoke",
    "file.read",
];

struct Fixture {
    core: Core,
    db: PgPool,
    human: Caller,
    human_id: Uuid,
    human_grant: Uuid,
    agent_id: Uuid,
    root_a: Uuid,
    root_b: Uuid,
    grant_a: Uuid,
    grant_b: Uuid,
    actor_a: Actor,
    actor_b: Actor,
    execution_a: Uuid,
    execution_b: Uuid,
}

fn work_request(grant: Uuid, purpose: &str) -> WorkRequest {
    WorkRequest {
        delegation_id: grant,
        purpose: purpose.into(),
        parent_work_id: None,
    }
}

fn execution_request(work: Uuid, grant: Uuid, agent_grant: Uuid, units: i64) -> ExecutionRequest {
    ExecutionRequest {
        work_id: work,
        delegation_id: grant,
        profile_id: "management-test".into(),
        units,
        lifetime_seconds: 300,
        predecessor_execution_id: None,
        agent_delegation_id: Some(agent_grant),
        program: None,
    }
}

async fn bind_instance(core: &Core, accepted: &Accepted) -> (Actor, Uuid) {
    let ticket = core
        .runtime_claim(accepted.intent_id, "management-test-runtime")
        .await
        .unwrap();
    let peer = BridgeIdentity {
        pid: 123,
        uid: 100_001,
        start_ticks: 456,
        boot_id: Uuid::new_v4().to_string(),
    };
    core.runtime_bind(
        ticket.execution_id,
        "management-test-runtime",
        RuntimeBinding {
            allocation: Some(ouroboros_contracts::AllocationIdentity {
                boot_id: peer.boot_id.parse().unwrap(),
                device: 31,
                inode: 1001,
                events_inode: 1002,
            }),
            container_id: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
            peer: peer.clone(),
            deadline_boottime_ns: 1_000_000,
        },
    )
    .await
    .unwrap();
    core.runtime_release(ticket.execution_id, "management-test-runtime")
        .await
        .unwrap();
    (Actor::Instance(peer), ticket.execution_id)
}

async fn setup() -> Fixture {
    let file = std::env::var("OURO_TEST_DATABASE_URL_FILE")
        .expect("explicit disposable PostgreSQL URL file required");
    let url = std::fs::read_to_string(file).unwrap();
    let db = PgPool::connect(url.trim()).await.unwrap();
    Core::migrate(&db).await.unwrap();
    let core = Core::new(db.clone(), Uuid::new_v4());
    let human_id = Uuid::new_v4();
    let human_grant = Uuid::new_v4();
    let agent_id = Uuid::new_v4();
    let human = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    sqlx::query("INSERT INTO firms(id) VALUES($1)")
        .bind(core.firm)
        .execute(&db)
        .await
        .unwrap();
    for (id, kind) in [(human_id, "human"), (agent_id, "agent")] {
        sqlx::query("INSERT INTO principals(firm_id,id,kind,enabled) VALUES($1,$2,$3,true)")
            .bind(core.firm)
            .bind(id)
            .bind(kind)
            .execute(&db)
            .await
            .unwrap();
    }
    sqlx::query("INSERT INTO credentials(fingerprint,firm_id,principal_id,enabled,expires_at) VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')")
        .bind(&human.fingerprint).bind(core.firm).bind(human_id).execute(&db).await.unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')")
        .bind(core.firm).bind(human_grant).bind(human_id).bind(ACTIONS).execute(&db).await.unwrap();
    sqlx::query("INSERT INTO limits(firm_id,id,capacity,committed) VALUES($1,'compute',100,0),($1,'resource_calls',100,0)")
        .bind(core.firm).execute(&db).await.unwrap();
    sqlx::query("INSERT INTO profiles(firm_id,id,active,max_units,max_lifetime_seconds) VALUES($1,'management-test',true,100,600)")
        .bind(core.firm).execute(&db).await.unwrap();
    let root_a = core
        .create_work(&human, "root-a", work_request(human_grant, "Root A"))
        .await
        .unwrap()
        .resource_id;
    let root_b = core
        .create_work(&human, "root-b", work_request(human_grant, "Root B"))
        .await
        .unwrap()
        .resource_id;
    let grant_a = Uuid::new_v4();
    let grant_b = Uuid::new_v4();
    for (grant, root) in [(grant_a, root_a), (grant_b, root_b)] {
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour',$6)")
            .bind(core.firm).bind(grant).bind(agent_id).bind(human_grant).bind(ACTIONS).bind(root).execute(&db).await.unwrap();
    }
    let a = core
        .start(
            &human,
            "start-a",
            execution_request(root_a, human_grant, grant_a, 5),
        )
        .await
        .unwrap();
    let b = core
        .start(
            &human,
            "start-b",
            execution_request(root_b, human_grant, grant_b, 5),
        )
        .await
        .unwrap();
    let (actor_a, execution_a) = bind_instance(&core, &a).await;
    let (actor_b, execution_b) = bind_instance(&core, &b).await;
    Fixture {
        core,
        db,
        human,
        human_id,
        human_grant,
        agent_id,
        root_a,
        root_b,
        grant_a,
        grant_b,
        actor_a,
        actor_b,
        execution_a,
        execution_b,
    }
}

fn listed_ids(value: &Value) -> Vec<Uuid> {
    value["items"]
        .as_array()
        .expect("work list items")
        .iter()
        .map(|item| Uuid::parse_str(item["id"].as_str().expect("work identity")).unwrap())
        .collect()
}

fn denied<T>(result: Result<T, Error>) {
    assert!(matches!(
        result,
        Err(Error::Denied | Error::NotFound | Error::Conflict)
    ));
}

async fn revision(f: &Fixture) -> i64 {
    f.core.conditions(&f.human).await.unwrap()["revision"]
        .as_i64()
        .unwrap()
}

#[tokio::test]
async fn child_work_is_visible_to_parent_but_does_not_inherit_resource_access() {
    let f = setup().await;
    let child = f
        .core
        .create_work(
            &f.actor_a,
            "child",
            work_request(f.grant_a, "Retain useful work"),
        )
        .await
        .unwrap();
    let observed = f
        .core
        .read(&f.human, "work", child.resource_id)
        .await
        .unwrap();
    assert_eq!(observed["parent_id"], json!(f.root_a));
    assert_eq!(observed["principal_id"], json!(f.agent_id));
    assert!(
        f.core
            .read(&f.actor_a, "work", child.resource_id)
            .await
            .is_ok()
    );
    denied(f.core.read(&f.actor_b, "work", child.resource_id).await);
    let visible_a = listed_ids(&f.core.list_work(&f.actor_a, None).await.unwrap());
    assert!(visible_a.contains(&f.root_a) && visible_a.contains(&child.resource_id));
    assert!(!visible_a.contains(&f.root_b));
    let visible_b = listed_ids(&f.core.list_work(&f.actor_b, None).await.unwrap());
    assert!(visible_b.contains(&f.root_b));
    assert!(!visible_b.contains(&f.root_a) && !visible_b.contains(&child.resource_id));
    let human_visible = listed_ids(&f.core.list_work(&f.human, None).await.unwrap());
    assert!(human_visible.contains(&child.resource_id));

    sqlx::query("INSERT INTO resource_targets(firm_id,id,worker_id,active,configuration,max_bytes) VALUES($1,'management-input','input-worker',true,'{\"max_file_bytes\":65536,\"transfer_seconds\":120}',65536)")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    for grant in [f.human_grant, f.grant_a] {
        sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) VALUES($1,$2,$3,'management-input',ARRAY['inspect','file.read'])")
            .bind(f.core.firm).bind(f.root_a).bind(grant).execute(&f.db).await.unwrap();
    }
    let resource = |key: &str| ResourceRequest {
        target: "management-input".into(),
        operation: "file.read".into(),
        request_key: key.into(),
        input: json!({"path":"allowed.txt"}),
        work_id: None,
        delegation_id: None,
    };
    assert!(
        f.core
            .resource_admit(f.actor_a.clone(), resource("parent-read"))
            .await
            .is_ok()
    );
    let run = f
        .core
        .start(
            &f.actor_a,
            "run-child",
            execution_request(child.resource_id, f.grant_a, f.grant_a, 5),
        )
        .await
        .unwrap();
    let (child_actor, _) = bind_instance(&f.core, &run).await;
    denied(
        f.core
            .resource_admit(child_actor, resource("child-read"))
            .await,
    );
}

#[tokio::test]
async fn request_replay_and_event_cursors_remain_bound_to_current_work_scope() {
    let f = setup().await;
    let snapshot = f.core.conditions(&f.actor_a).await.unwrap();
    let cursor = snapshot["cursor"].as_str().unwrap();
    let child = f
        .core
        .create_work(
            &f.actor_a,
            "shared-key",
            work_request(f.grant_a, "Private A declaration"),
        )
        .await
        .unwrap();
    let replay = f
        .core
        .create_work(
            &f.actor_a,
            "shared-key",
            work_request(f.grant_a, "Private A declaration"),
        )
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.intent_id, child.intent_id);
    assert_eq!(replay.resource_id, child.resource_id);
    denied(
        f.core
            .create_work(
                &f.actor_b,
                "shared-key",
                work_request(f.grant_b, "Private A declaration"),
            )
            .await,
    );
    denied(f.core.read(&f.actor_b, "intents", child.intent_id).await);
    denied(f.core.events(&f.actor_b, cursor).await);
    denied(f.core.list_work(&f.actor_b, Some(cursor)).await);
    let events = f.core.events(&f.actor_a, cursor).await.unwrap();
    assert!(
        events
            .iter()
            .any(|event| event.resource_id == child.resource_id)
    );
    let parent_snapshot = f.core.conditions(&f.human).await.unwrap();
    let parent_cursor = parent_snapshot["cursor"].as_str().unwrap();
    let later = f
        .core
        .create_work(
            &f.actor_a,
            "later-child",
            work_request(f.grant_a, "Parent-visible event"),
        )
        .await
        .unwrap();
    assert!(
        f.core
            .events(&f.human, parent_cursor)
            .await
            .unwrap()
            .iter()
            .any(|event| event.resource_id == later.resource_id)
    );
    let intent = f
        .core
        .read(&f.actor_a, "intents", child.intent_id)
        .await
        .unwrap();
    assert!(
        intent.get("input").is_none(),
        "management projection must not expose raw input"
    );

    let mut stale = match &f.actor_a {
        Actor::Instance(peer) => peer.clone(),
        _ => unreachable!(),
    };
    stale.start_ticks += 1;
    denied(f.core.conditions(Actor::Instance(stale)).await);
}

#[tokio::test]
async fn authorship_is_not_a_management_grant() {
    let f = setup().await;
    let outsider_id = Uuid::new_v4();
    let outsider = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    sqlx::query("INSERT INTO principals(firm_id,id,kind,enabled) VALUES($1,$2,'human',true)")
        .bind(f.core.firm)
        .bind(outsider_id)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO credentials(fingerprint,firm_id,principal_id,enabled,expires_at) VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')")
        .bind(&outsider.fingerprint).bind(f.core.firm).bind(outsider_id).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,ARRAY['inspect','execution.start'],clock_timestamp()+interval '1 hour')")
        .bind(f.core.firm).bind(Uuid::new_v4()).bind(outsider_id).execute(&f.db).await.unwrap();
    // Deliberate fixture corruption of provenance: authority remains in the recorded controls.
    sqlx::query("UPDATE work SET principal_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.root_a)
        .bind(outsider_id)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(f.core.read(&f.human, "work", f.root_a).await.is_ok());
    denied(f.core.read(&outsider, "work", f.root_a).await);
    assert!(listed_ids(&f.core.list_work(&outsider, None).await.unwrap()).is_empty());
    let control: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM work_controls WHERE firm_id=$1 AND root_work_id=$2 AND principal_id=$3)")
        .bind(f.core.firm).bind(f.root_a).bind(f.human_id).fetch_one(&f.db).await.unwrap();
    assert!(control);
}

#[tokio::test]
async fn an_instance_cannot_borrow_another_grant_of_the_same_logical_agent() {
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=array_remove(actions,'execution.stop') WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.grant_a).execute(&f.db).await.unwrap();
    denied(
        f.core
            .create_work(
                &f.actor_a,
                "borrow-b",
                work_request(f.grant_b, "Wrong authority"),
            )
            .await,
    );
    denied(
        f.core
            .restrict(
                &f.actor_a,
                "borrow-stop",
                "executions",
                f.execution_a,
                revision(&f).await,
            )
            .await,
    );
    denied(
        f.core
            .start(
                &f.actor_a,
                "other-root",
                execution_request(f.root_b, f.grant_a, f.grant_a, 5),
            )
            .await,
    );
    assert!(f.core.conditions(&f.actor_b).await.is_ok());
    assert!(
        f.core
            .read(&f.human, "executions", f.execution_b)
            .await
            .is_ok()
    );
}

#[tokio::test]
async fn stopping_an_execution_and_revoking_a_scoped_grant_are_distinct() {
    let f = setup().await;
    let job = f
        .core
        .start(
            &f.actor_a,
            "controlled-job",
            execution_request(f.root_a, f.grant_a, f.grant_a, 5),
        )
        .await
        .unwrap();
    f.core
        .restrict(
            &f.actor_a,
            "stop-job",
            "executions",
            job.resource_id,
            revision(&f).await,
        )
        .await
        .unwrap();
    assert!(
        f.core
            .runtime_claim(job.intent_id, "management-test-runtime")
            .await
            .is_err()
    );
    assert_eq!(
        f.core
            .read(&f.human, "executions", job.resource_id)
            .await
            .unwrap()["stopped"],
        true
    );
    let revoked: bool =
        sqlx::query_scalar("SELECT revoked FROM delegations WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(f.grant_a)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert!(!revoked, "stop must not revoke the work's grant");
    assert!(f.core.conditions(&f.actor_a).await.is_ok());

    let inherited_child = Uuid::new_v4();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour')")
        .bind(f.core.firm).bind(inherited_child).bind(f.agent_id).bind(f.grant_a).bind(ACTIONS).execute(&f.db).await.unwrap();
    // A null own root still inherits root A from its ancestor. It is not a global grant.
    f.core
        .restrict(
            &f.actor_a,
            "revoke-inherited-child",
            "delegations",
            inherited_child,
            revision(&f).await,
        )
        .await
        .unwrap();
    let inherited_revoked: bool =
        sqlx::query_scalar("SELECT revoked FROM delegations WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(inherited_child)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert!(inherited_revoked);
    assert!(f.core.conditions(&f.actor_a).await.is_ok());
    let global_grant = Uuid::new_v4();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')")
        .bind(f.core.firm).bind(global_grant).bind(f.agent_id).bind(ACTIONS).execute(&f.db).await.unwrap();
    denied(
        f.core
            .restrict(
                &f.actor_a,
                "reject-global",
                "delegations",
                global_grant,
                revision(&f).await,
            )
            .await,
    );
    denied(
        f.core
            .restrict(
                &f.actor_a,
                "reject-sibling",
                "delegations",
                f.grant_b,
                revision(&f).await,
            )
            .await,
    );
    f.core
        .restrict(
            &f.actor_a,
            "revoke-a",
            "delegations",
            f.grant_a,
            revision(&f).await,
        )
        .await
        .unwrap();
    denied(f.core.conditions(&f.actor_a).await);
    assert!(f.core.conditions(&f.actor_b).await.is_ok());
    assert!(
        f.core
            .read(&f.human, "executions", f.execution_a)
            .await
            .is_ok()
    );
    assert!(
        f.core
            .start(
                &f.actor_a,
                "after-revocation",
                execution_request(f.root_a, f.grant_a, f.grant_a, 5),
            )
            .await
            .is_err()
    );
    let committed: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(
        committed, 15,
        "restrictions do not erase unresolved compute commitments"
    );
}

#[tokio::test]
async fn ancestor_work_constraints_and_shared_capacity_apply_to_instance_management() {
    let f = setup().await;
    // Two bound instances already reserve five units each; exactly 100 remain for this race.
    sqlx::query("UPDATE limits SET capacity=110 WHERE firm_id=$1 AND id='compute'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    let (left, right) = tokio::join!(
        f.core.start(
            &f.actor_a,
            "race-a",
            execution_request(f.root_a, f.grant_a, f.grant_a, 70)
        ),
        f.core.start(
            &f.actor_b,
            "race-b",
            execution_request(f.root_b, f.grant_b, f.grant_b, 70)
        ),
    );
    assert_eq!(usize::from(left.is_ok()) + usize::from(right.is_ok()), 1);
    assert!(matches!(
        (&left, &right),
        (Ok(_), Err(Error::Capacity)) | (Err(Error::Capacity), Ok(_))
    ));
    let committed: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(committed, 80);
    sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.human_grant)
        .bind(f.root_a)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(f.core.conditions(&f.actor_a).await.is_ok());
    denied(f.core.conditions(&f.actor_b).await);
    denied(
        f.core
            .start(
                &f.human,
                "ancestor-outside",
                execution_request(f.root_b, f.human_grant, f.grant_b, 5),
            )
            .await,
    );
    let visible = listed_ids(&f.core.list_work(&f.human, None).await.unwrap());
    assert!(visible.contains(&f.root_a));
    assert!(!visible.contains(&f.root_b));
}

async fn prepare_human_db_target(f: &Fixture) {
    sqlx::query(
        "UPDATE delegations SET actions=array_append(actions,'db.read') WHERE firm_id=$1 AND id=$2",
    )
    .bind(f.core.firm)
    .bind(f.human_grant)
    .execute(&f.db)
    .await
    .unwrap();
    sqlx::query("INSERT INTO resource_targets(firm_id,id,worker_id,active,configuration,max_bytes) VALUES($1,'management-db','management-db-worker',true,'{}',65536)")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) VALUES($1,$2,$3,'management-db',ARRAY['inspect','db.read'])")
        .bind(f.core.firm).bind(f.root_a).bind(f.human_grant).execute(&f.db).await.unwrap();
}

fn human_db_request(f: &Fixture, key: &str, marker: &str) -> ResourceRequest {
    ResourceRequest {
        target: "management-db".into(),
        operation: "db.read".into(),
        request_key: key.into(),
        input: json!({"query":"read_input","parameters":{"marker":marker}}),
        work_id: Some(f.root_a),
        delegation_id: Some(f.human_grant),
    }
}

#[tokio::test]
async fn removing_work_control_blocks_a_previously_admitted_human_resource_claim() {
    let f = setup().await;
    prepare_human_db_target(&f).await;
    let permitted = f
        .core
        .resource_admit(
            Actor::from(&f.human),
            human_db_request(&f, "permitted", "positive-control"),
        )
        .await
        .unwrap();
    assert!(
        f.core
            .resource_claim(permitted.intent_id, "management-db-worker", None)
            .await
            .is_ok()
    );
    let pending = f
        .core
        .resource_admit(
            Actor::from(&f.human),
            human_db_request(&f, "pending", "awaiting-dispatch"),
        )
        .await
        .unwrap();
    sqlx::query(
        "DELETE FROM work_controls WHERE firm_id=$1 AND root_work_id=$2 AND principal_id=$3",
    )
    .bind(f.core.firm)
    .bind(f.root_a)
    .bind(f.human_id)
    .execute(&f.db)
    .await
    .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(pending.intent_id, "management-db-worker", None)
            .await,
        Err(Error::Denied)
    ));
    let attempts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM attempts WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(pending.intent_id)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(
        attempts, 0,
        "a denied claim must not create a dispatch opportunity"
    );
    let state: String = sqlx::query_scalar("SELECT state FROM intents WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(pending.intent_id)
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(state, "accepted");
}

#[tokio::test]
async fn revoked_target_inspection_hides_both_matching_and_changed_retry_inputs() {
    let f = setup().await;
    prepare_human_db_target(&f).await;
    let accepted = f
        .core
        .resource_admit(
            Actor::from(&f.human),
            human_db_request(&f, "protected-key", "original"),
        )
        .await
        .unwrap();
    assert!(
        f.core
            .resource_admit(
                Actor::from(&f.human),
                human_db_request(&f, "protected-key", "original"),
            )
            .await
            .is_ok()
    );
    assert!(matches!(
        f.core
            .resource_admit(
                Actor::from(&f.human),
                human_db_request(&f, "protected-key", "changed"),
            )
            .await,
        Err(Error::Conflict)
    ));
    // Keep the work-level inspect action and db.read permission; remove only target inspection.
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'inspect') WHERE firm_id=$1 AND work_id=$2 AND delegation_id=$3 AND target_id='management-db'")
        .bind(f.core.firm).bind(f.root_a).bind(f.human_grant).execute(&f.db).await.unwrap();
    for marker in ["original", "changed"] {
        assert!(
            matches!(
                f.core
                    .resource_admit(
                        Actor::from(&f.human),
                        human_db_request(&f, "protected-key", marker),
                    )
                    .await,
                Err(Error::Denied)
            ),
            "input equality must not be observable without target inspect"
        );
    }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM intents WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(accepted.intent_id)
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn loss_of_the_submitting_instance_blocks_pending_child_dispatch_without_settlement() {
    for terminate in [false, true] {
        let f = setup().await;
        let child = f
            .core
            .create_work(
                &f.actor_a,
                "pending-child",
                work_request(f.grant_a, "A declared child job"),
            )
            .await
            .unwrap();
        let execution = f
            .core
            .start(
                &f.actor_a,
                "pending-child-run",
                execution_request(child.resource_id, f.grant_a, f.grant_a, 7),
            )
            .await
            .unwrap();
        if terminate {
            f.core
                .runtime_terminated(f.execution_a, "management-test-runtime")
                .await
                .unwrap();
        } else {
            f.core
                .restrict(
                    &f.human,
                    "stop-origin",
                    "executions",
                    f.execution_a,
                    revision(&f).await,
                )
                .await
                .unwrap();
        }
        assert!(matches!(
            f.core
                .runtime_claim(execution.intent_id, "management-test-runtime")
                .await,
            Err(Error::Denied)
        ));
        let grant_valid: bool = sqlx::query_scalar("SELECT NOT revoked AND expires_at>clock_timestamp() FROM delegations WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm).bind(f.grant_a).fetch_one(&f.db).await.unwrap();
        assert!(
            grant_valid,
            "the denial must result from origin loss, not grant revocation"
        );
        let attempts: i64 =
            sqlx::query_scalar("SELECT count(*) FROM attempts WHERE firm_id=$1 AND intent_id=$2")
                .bind(f.core.firm)
                .bind(execution.intent_id)
                .fetch_one(&f.db)
                .await
                .unwrap();
        assert_eq!(attempts, 0);
        let retained: bool = sqlx::query_scalar("SELECT units=7 AND NOT settled FROM reservations WHERE firm_id=$1 AND intent_id=$2 AND limit_id='compute'")
            .bind(f.core.firm).bind(execution.intent_id).fetch_one(&f.db).await.unwrap();
        assert!(retained);
        let committed: i64 =
            sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
                .bind(f.core.firm)
                .fetch_one(&f.db)
                .await
                .unwrap();
        assert_eq!(committed, 17);
        assert!(f.core.conditions(&f.actor_b).await.is_ok());
    }
}

#[tokio::test]
async fn work_pagination_is_bounded_complete_and_instance_scoped() {
    use std::collections::BTreeSet;
    let f = setup().await;
    let mut expected = BTreeSet::from([f.root_a]);
    for index in 0..55 {
        let created = f
            .core
            .create_work(
                &f.actor_a,
                &format!("page-work-{index}"),
                work_request(f.grant_a, "Scoped pagination item"),
            )
            .await
            .unwrap();
        expected.insert(created.resource_id);
    }
    let first = f.core.list_work(&f.actor_a, None).await.unwrap();
    let first_ids = listed_ids(&first);
    assert_eq!(first_ids.len(), 50);
    let next = first["next_cursor"]
        .as_str()
        .expect("remaining work needs a continuation cursor");
    assert!(matches!(
        f.core.list_work(&f.actor_b, Some(next)).await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        f.core.list_work(&f.human, Some(next)).await,
        Err(Error::Conflict)
    ));
    let second = f.core.list_work(&f.actor_a, Some(next)).await.unwrap();
    let second_ids = listed_ids(&second);
    assert_eq!(second_ids.len(), 6);
    assert!(second["next_cursor"].is_null());
    let mut observed: BTreeSet<_> = first_ids.iter().copied().collect();
    assert_eq!(observed.len(), 50);
    for id in second_ids {
        assert!(
            observed.insert(id),
            "successive pages must not repeat an item"
        );
    }
    assert_eq!(observed, expected);
    assert!(!observed.contains(&f.root_b));
    assert_eq!(
        listed_ids(&f.core.list_work(&f.actor_a, Some(next)).await.unwrap()).len(),
        6
    );
}

#[tokio::test]
async fn humans_and_instances_can_select_only_currently_authorized_parent_work() {
    let f = setup().await;
    let scoped_human_grant = Uuid::new_v4();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id) VALUES($1,$2,$3,$4,ARRAY['inspect','work.create'],clock_timestamp()+interval '1 hour',$5)")
        .bind(f.core.firm).bind(scoped_human_grant).bind(f.human_id).bind(f.human_grant).bind(f.root_a).execute(&f.db).await.unwrap();
    let request = |grant, parent| WorkRequest {
        delegation_id: grant,
        purpose: "Explicit scoped parent".into(),
        parent_work_id: Some(parent),
    };
    let human_child = f
        .core
        .create_work(
            &f.human,
            "human-scoped-child",
            request(scoped_human_grant, f.root_a),
        )
        .await
        .unwrap();
    let agent_child = f
        .core
        .create_work(
            &f.actor_a,
            "agent-scoped-child",
            request(f.grant_a, f.root_a),
        )
        .await
        .unwrap();
    for child in [human_child.resource_id, agent_child.resource_id] {
        assert_eq!(
            f.core.read(&f.human, "work", child).await.unwrap()["parent_id"],
            json!(f.root_a)
        );
        assert!(f.core.read(&f.actor_a, "work", child).await.is_ok());
        denied(f.core.read(&f.actor_b, "work", child).await);
    }
    assert!(matches!(
        f.core
            .create_work(
                &f.human,
                "human-outside-parent",
                request(scoped_human_grant, f.root_b),
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .create_work(
                &f.actor_b,
                "agent-outside-parent",
                request(f.grant_b, f.root_a),
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .create_work(
                &f.human,
                "scoped-root-request",
                work_request(
                    scoped_human_grant,
                    "Cannot create outside the scoped parent"
                ),
            )
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn wake_registration_preserves_actual_instance_scope() {
    use ouroboros_contracts::{WakeCancelRequest, WakeRequest};
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['wake.register','wake.cancel'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let now: i64 =
        sqlx::query_scalar("SELECT floor(extract(epoch FROM clock_timestamp()))::bigint")
            .fetch_one(&f.db)
            .await
            .unwrap();
    let mut request = WakeRequest {
        due_at_seconds: now + 60,
        expires_at_seconds: now + 120,
        execution: execution_request(f.root_a, f.grant_a, f.grant_a, 10),
    };
    // Agent-origin starts inherit the authenticated grant; no fabricated human parent is needed.
    request.execution.agent_delegation_id = None;
    let registered = f
        .core
        .register_wake(&f.actor_a, "agent-timer", request.clone())
        .await
        .unwrap();
    assert!(
        f.core
            .wake(&f.actor_a, registered.resource_id)
            .await
            .is_ok()
    );
    assert!(matches!(
        f.core.wake(&f.actor_b, registered.resource_id).await,
        Err(Error::Denied)
    ));
    request.execution.work_id = f.root_b;
    assert!(matches!(
        f.core
            .register_wake(&f.actor_a, "outside-timer", request.clone())
            .await,
        Err(Error::Denied)
    ));
    request.execution.work_id = f.root_a;
    request.execution.delegation_id = f.grant_b;
    assert!(matches!(
        f.core
            .register_wake(&f.actor_a, "other-grant-timer", request)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .cancel_wake(
                &f.actor_b,
                registered.resource_id,
                "outside-cancel",
                WakeCancelRequest {
                    delegation_id: f.grant_b
                }
            )
            .await,
        Err(Error::Denied)
    ));
    f.core
        .cancel_wake(
            &f.actor_a,
            registered.resource_id,
            "own-cancel",
            WakeCancelRequest {
                delegation_id: f.grant_a,
            },
        )
        .await
        .unwrap();
    assert_eq!(
        f.core
            .wake(&f.actor_a, registered.resource_id)
            .await
            .unwrap()["cancelled"],
        true
    );
}

#[tokio::test]
async fn explicit_wake_survives_origin_exit_without_reviving_ordinary_requests() {
    use ouroboros_contracts::WakeRequest;
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['wake.register'] WHERE firm_id=$1")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    let now: i64 =
        sqlx::query_scalar("SELECT floor(extract(epoch FROM clock_timestamp()))::bigint")
            .fetch_one(&f.db)
            .await
            .unwrap();
    // Select a child work so the fixture's other active jobs are not a coordinator conflict.
    let child = f
        .core
        .create_work(
            &f.actor_a,
            "continuation-child",
            work_request(f.grant_a, "continuing work"),
        )
        .await
        .unwrap()
        .resource_id;
    let execution = execution_request(child, f.grant_a, f.grant_a, 5);
    let wake = f
        .core
        .register_wake(
            &f.actor_a,
            "durable-wake",
            WakeRequest {
                due_at_seconds: now + 60,
                expires_at_seconds: now + 3600,
                execution,
            },
        )
        .await
        .unwrap();
    let ordinary = f
        .core
        .start(
            &f.actor_a,
            "ordinary-before-exit",
            execution_request(f.root_a, f.grant_a, f.grant_a, 5),
        )
        .await
        .unwrap();
    f.core
        .runtime_terminated(f.execution_a, "management-test-runtime")
        .await
        .unwrap();
    assert!(f.core.conditions(&f.actor_a).await.is_err());
    assert!(matches!(
        f.core
            .runtime_claim(ordinary.intent_id, "ordinary-worker")
            .await,
        Err(Error::Denied)
    ));

    sqlx::query("UPDATE wake_registrations SET due_at_seconds=$2 WHERE firm_id=$1")
        .bind(f.core.firm)
        .bind(now - 1)
        .execute(&f.db)
        .await
        .unwrap();
    let accepted = f.core.deliver_wake(wake.resource_id).await.unwrap();
    let ticket = f
        .core
        .runtime_claim(accepted.intent_id, "wake-runtime")
        .await
        .unwrap();
    assert_eq!(ticket.input.work_id, child);
    assert!(
        f.core
            .runtime_permitted(ticket.execution_id, "wake-runtime")
            .await
            .is_ok()
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant_a)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core.deliver_wake(wake.resource_id).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .runtime_permitted(ticket.execution_id, "wake-runtime")
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn conversation_preserves_attributed_messages_and_current_scope() {
    use ouroboros_contracts::{ConversationRequest, MessageRequest};
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['conversation.create','conversation.send','conversation.read'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let created = f
        .core
        .create_conversation(
            &f.human,
            "dialogue",
            ConversationRequest {
                work_id: f.root_a,
                delegation_id: f.human_grant,
                responsible_agent_id: f.agent_id,
            },
        )
        .await
        .unwrap();
    let conversation = created.resource_id;
    let message = MessageRequest {
        delegation_id: f.human_grant,
        text: "Explain the current work.".into(),
        reply_to: None,
    };
    let (a, b) = tokio::join!(
        f.core
            .send_message(&f.human, conversation, "question", message.clone()),
        f.core
            .send_message(&f.human, conversation, "question", message.clone())
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(a.resource_id, b.resource_id);
    assert_ne!(a.replayed, b.replayed);
    let mut changed = message.clone();
    changed.text = "Different request".into();
    assert!(matches!(
        f.core
            .send_message(&f.human, conversation, "question", changed)
            .await,
        Err(Error::Conflict)
    ));
    assert!(matches!(
        f.core
            .conversation_messages(&f.actor_b, conversation, 0)
            .await,
        Err(Error::Denied)
    ));
    let answer = f
        .core
        .send_message(
            &f.actor_a,
            conversation,
            "answer",
            MessageRequest {
                delegation_id: f.grant_a,
                text: "Here is the current work report.".into(),
                reply_to: Some(a.resource_id),
            },
        )
        .await
        .unwrap();
    let page = f
        .core
        .conversation_messages(&f.human, conversation, 0)
        .await
        .unwrap();
    assert_eq!(page["messages"].as_array().unwrap().len(), 2);
    assert_eq!(page["messages"][0]["author_kind"], "human");
    assert_eq!(page["messages"][1]["author_kind"], "agent");
    assert_eq!(page["messages"][1]["id"], json!(answer.resource_id));
    assert!(page["messages"][1]["origin_instance_id"].is_string());
    assert_eq!(page["cursor"], 2);
    let other = f
        .core
        .create_conversation(
            &f.human,
            "other-dialogue",
            ConversationRequest {
                work_id: f.root_b,
                delegation_id: f.human_grant,
                responsible_agent_id: f.agent_id,
            },
        )
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .send_message(
                &f.human,
                other.resource_id,
                "cross-reply",
                MessageRequest {
                    reply_to: Some(a.resource_id),
                    ..message
                }
            )
            .await,
        Err(Error::Invalid)
    ));
    f.core
        .runtime_terminated(f.execution_a, "management-test-runtime")
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .conversation_messages(&f.actor_a, conversation, 0)
            .await,
        Err(Error::Denied)
    ));
    let restarted = Core::new(f.db.clone(), f.core.firm);
    assert_eq!(
        restarted
            .conversation_messages(&f.human, conversation, 0)
            .await
            .unwrap(),
        page
    );
    let new_execution = f
        .core
        .start(
            &f.human,
            "replacement-dialogue-agent",
            execution_request(f.root_a, f.human_grant, f.grant_a, 5),
        )
        .await
        .unwrap();
    let (new_actor, _) = bind_instance(&f.core, &new_execution).await;
    assert_eq!(
        f.core
            .conversation_messages(&new_actor, conversation, 0)
            .await
            .unwrap(),
        page
    );
    sqlx::query(
        "UPDATE delegations SET actions=array_remove(actions,'conversation.read') WHERE firm_id=$1",
    )
    .bind(f.core.firm)
    .execute(&f.db)
    .await
    .unwrap();
    assert!(matches!(
        f.core
            .conversation_messages(&new_actor, conversation, 2)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .conversation_messages(&f.human, conversation, 2)
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn stored_message_delivery_is_bound_and_rechecks_conversation_access() {
    use ouroboros_contracts::{
        ConversationRequest, MessageDeliveryRequest, MessageRequest, NativeInstruction,
        NativeTurnReport,
    };
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['conversation.create','conversation.read','conversation.send','execution.steer'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let conversation = f
        .core
        .create_conversation(
            &f.human,
            "delivery-dialogue",
            ConversationRequest {
                work_id: f.root_a,
                delegation_id: f.human_grant,
                responsible_agent_id: f.agent_id,
            },
        )
        .await
        .unwrap()
        .resource_id;
    let message = f
        .core
        .send_message(
            &f.human,
            conversation,
            "user-message",
            MessageRequest {
                delegation_id: f.human_grant,
                text: "Explain progress without changing the work.".into(),
                reply_to: None,
            },
        )
        .await
        .unwrap()
        .resource_id;
    let thread = Uuid::new_v4().to_string();
    let turn = Uuid::new_v4().to_string();
    f.core
        .runtime_native_turn(
            f.execution_a,
            "management-test-runtime",
            &NativeTurnReport {
                thread_id: thread.clone(),
                turn_id: turn.clone(),
                status: "inProgress".into(),
            },
        )
        .await
        .unwrap();
    let request = MessageDeliveryRequest {
        delegation_id: f.human_grant,
        execution_id: f.execution_a,
        thread_id: thread,
        turn_id: turn,
    };
    let (a, b) = tokio::join!(
        f.core
            .deliver_message(&f.human, conversation, message, request.clone()),
        f.core
            .deliver_message(&f.human, conversation, message, request.clone())
    );
    let (a, b) = (a.unwrap(), b.unwrap());
    assert_eq!(a.intent_id, b.intent_id);
    assert_ne!(a.replayed, b.replayed);
    let changed = MessageDeliveryRequest {
        turn_id: Uuid::new_v4().to_string(),
        ..request
    };
    assert!(matches!(
        f.core
            .deliver_message(&f.human, conversation, message, changed)
            .await,
        Err(Error::Conflict)
    ));
    let ticket = f
        .core
        .native_claim(a.intent_id, "management-test-runtime")
        .await
        .unwrap();
    assert!(
        matches!(ticket.request.instruction,NativeInstruction::Steer{text} if text=="Explain progress without changing the work.")
    );
    let page = f
        .core
        .conversation_messages(&f.human, conversation, 0)
        .await
        .unwrap();
    assert_eq!(
        page["messages"][0]["deliveries"][0]["intent_id"],
        json!(a.intent_id)
    );
    // Losing conversation access fences transmission even with execution.steer still present.
    sqlx::query("UPDATE delegations SET actions=array_remove(actions,'conversation.read') WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.grant_a).execute(&f.db).await.unwrap();
    assert!(
        f.core
            .native_dispatch_check(a.intent_id, "management-test-runtime", ticket.attempt_id)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn group_conversation_has_multiple_authors_and_independent_recipients() {
    use ouroboros_contracts::{
        ConversationParticipantRequest, ConversationRequest, MessageDeliveryRequest,
        MessageRequest, NativeTurnReport,
    };
    let f = setup().await;
    let actions = [
        "conversation.create",
        "conversation.manage",
        "conversation.read",
        "conversation.send",
        "execution.steer",
        "inspect",
        "execution.start",
    ];
    sqlx::query("UPDATE delegations SET actions=actions||$2 WHERE firm_id=$1")
        .bind(f.core.firm)
        .bind(actions.as_slice())
        .execute(&f.db)
        .await
        .unwrap();
    let agent2 = Uuid::new_v4();
    let grant2 = Uuid::new_v4();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'agent',true)")
        .bind(f.core.firm)
        .bind(agent2)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at,work_root_id) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour',$6)")
        .bind(f.core.firm).bind(grant2).bind(agent2).bind(f.human_grant).bind(actions.as_slice()).bind(f.root_a).execute(&f.db).await.unwrap();
    let job = f
        .core
        .start(
            &f.human,
            "agent-two",
            execution_request(f.root_a, f.human_grant, grant2, 5),
        )
        .await
        .unwrap();
    let (actor2, execution2) = bind_instance(&f.core, &job).await;
    let conversation = f
        .core
        .create_conversation(
            &f.human,
            "group",
            ConversationRequest {
                work_id: f.root_a,
                delegation_id: f.human_grant,
                responsible_agent_id: f.agent_id,
            },
        )
        .await
        .unwrap()
        .resource_id;
    assert!(
        f.core
            .conversation_messages(&actor2, conversation, 0)
            .await
            .is_err()
    );
    f.core
        .set_conversation_participant(
            &f.human,
            conversation,
            "join-agent-two",
            ConversationParticipantRequest {
                delegation_id: f.human_grant,
                principal_id: agent2,
                active: true,
            },
        )
        .await
        .unwrap();
    let human2 = Uuid::new_v4();
    let human2_grant = Uuid::new_v4();
    let caller2 = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
        .bind(f.core.firm)
        .bind(human2)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
    )
    .bind(&caller2.fingerprint)
    .bind(f.core.firm)
    .bind(human2)
    .execute(&f.db)
    .await
    .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')").bind(f.core.firm).bind(human2_grant).bind(human2).bind(actions.as_slice()).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO work_controls(firm_id,root_work_id,principal_id) VALUES($1,$2,$3)")
        .bind(f.core.firm)
        .bind(f.root_a)
        .bind(human2)
        .execute(&f.db)
        .await
        .unwrap();
    f.core
        .set_conversation_participant(
            &f.human,
            conversation,
            "join-human-two",
            ConversationParticipantRequest {
                delegation_id: f.human_grant,
                principal_id: human2,
                active: true,
            },
        )
        .await
        .unwrap();
    let first = f
        .core
        .send_message(
            &f.human,
            conversation,
            "group-request",
            MessageRequest {
                delegation_id: f.human_grant,
                text: "Discuss this work together.".into(),
                reply_to: None,
            },
        )
        .await
        .unwrap();
    for (actor, grant, key) in [
        (&f.actor_a, f.grant_a, "agent-one-reply"),
        (&actor2, grant2, "agent-two-reply"),
    ] {
        f.core
            .send_message(
                actor,
                conversation,
                key,
                MessageRequest {
                    delegation_id: grant,
                    text: key.into(),
                    reply_to: Some(first.resource_id),
                },
            )
            .await
            .unwrap();
    }
    f.core
        .send_message(
            &caller2,
            conversation,
            "second-human",
            MessageRequest {
                delegation_id: human2_grant,
                text: "I have a follow-up.".into(),
                reply_to: Some(first.resource_id),
            },
        )
        .await
        .unwrap();
    let page = f
        .core
        .conversation_messages(&f.human, conversation, 0)
        .await
        .unwrap();
    assert_eq!(page["messages"].as_array().unwrap().len(), 4);
    for message in page["messages"].as_array().unwrap() {
        assert_eq!(message["deliveries"].as_array().unwrap().len(), 3);
    }
    let thread = Uuid::new_v4().to_string();
    let turn = Uuid::new_v4().to_string();
    for execution in [f.execution_a, execution2] {
        f.core
            .runtime_native_turn(
                execution,
                "management-test-runtime",
                &NativeTurnReport {
                    thread_id: thread.clone(),
                    turn_id: turn.clone(),
                    status: "inProgress".into(),
                },
            )
            .await
            .unwrap();
    }
    let request = MessageDeliveryRequest {
        delegation_id: f.human_grant,
        execution_id: f.execution_a,
        thread_id: thread,
        turn_id: turn,
    };
    let a = f
        .core
        .deliver_message(&f.human, conversation, first.resource_id, request.clone())
        .await
        .unwrap();
    let b = f
        .core
        .deliver_message(
            &f.human,
            conversation,
            first.resource_id,
            MessageDeliveryRequest {
                execution_id: execution2,
                ..request
            },
        )
        .await
        .unwrap();
    assert_ne!(a.intent_id, b.intent_id);
    f.core
        .set_conversation_participant(
            &f.human,
            conversation,
            "remove-agent-two",
            ConversationParticipantRequest {
                delegation_id: f.human_grant,
                principal_id: agent2,
                active: false,
            },
        )
        .await
        .unwrap();
    assert!(
        f.core
            .conversation_messages(&actor2, conversation, 0)
            .await
            .is_err()
    );
    assert!(
        f.core
            .native_claim(b.intent_id, "management-test-runtime")
            .await
            .is_err()
    );
    assert!(
        f.core
            .native_claim(a.intent_id, "management-test-runtime")
            .await
            .is_ok()
    );
    let after = f
        .core
        .conversation_messages(&f.human, conversation, 0)
        .await
        .unwrap();
    assert_eq!(
        after["messages"][0]["deliveries"].as_array().unwrap().len(),
        3
    );
    f.core
        .set_conversation_participant(
            &f.human,
            conversation,
            "rejoin-agent-two",
            ConversationParticipantRequest {
                delegation_id: f.human_grant,
                principal_id: agent2,
                active: true,
            },
        )
        .await
        .unwrap();
    assert!(
        f.core
            .conversation_messages(&actor2, conversation, 0)
            .await
            .is_ok()
    );
    assert!(
        f.core
            .native_claim(b.intent_id, "management-test-runtime")
            .await
            .is_err()
    );
}

/// Transaction-level service continuity probe; Runtime bindings are fabricated by setup.
/// A durable reply is not a receipt for an external effect or proof of service availability.
#[tokio::test]
async fn conversation_reply_survives_instance_replacement_without_duplicate_or_authority_restore() {
    use ouroboros_contracts::{ConversationRequest, MessageRequest};
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['conversation.create','conversation.send','conversation.read'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let conversation = f
        .core
        .create_conversation(
            &f.human,
            "service-dialogue",
            ConversationRequest {
                work_id: f.root_a,
                delegation_id: f.human_grant,
                responsible_agent_id: f.agent_id,
            },
        )
        .await
        .unwrap()
        .resource_id;
    let question = f
        .core
        .send_message(
            &f.human,
            conversation,
            "service-question",
            MessageRequest {
                delegation_id: f.human_grant,
                text: "Report the retained result.".into(),
                reply_to: None,
            },
        )
        .await
        .unwrap();
    let reply = MessageRequest {
        delegation_id: f.grant_a,
        text: "Retained result is available.".into(),
        reply_to: Some(question.resource_id),
    };
    let original = f
        .core
        .send_message(&f.actor_a, conversation, "service-answer", reply.clone())
        .await
        .unwrap();
    let before = f
        .core
        .conversation_messages(&f.human, conversation, 0)
        .await
        .unwrap();
    // Fabricate the stopped state here; Linux stop/guard enforcement is tested separately.
    sqlx::query("UPDATE executions SET stopped=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.execution_a)
        .execute(&f.db)
        .await
        .unwrap();
    let replacement = f
        .core
        .start(
            &f.human,
            "service-replacement",
            execution_request(f.root_a, f.human_grant, f.grant_a, 5),
        )
        .await
        .unwrap();
    let (replacement_actor, _) = bind_instance(&f.core, &replacement).await;
    let recovered = f
        .core
        .conversation_messages(&replacement_actor, conversation, 0)
        .await
        .unwrap();
    assert_eq!(recovered, before);
    let replay = f
        .core
        .send_message(
            &replacement_actor,
            conversation,
            "service-answer",
            reply.clone(),
        )
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.resource_id, original.resource_id);
    assert_eq!(
        f.core
            .conversation_messages(&f.human, conversation, 0)
            .await
            .unwrap(),
        before
    );
    assert!(matches!(
        f.core
            .conversation_messages(&f.actor_a, conversation, 0)
            .await,
        Err(Error::Denied)
    ));
    let mut changed = reply.clone();
    changed.text = "A different result".into();
    assert!(matches!(
        f.core
            .send_message(&replacement_actor, conversation, "service-answer", changed)
            .await,
        Err(Error::Conflict)
    ));
    // Losing membership denies both history and idempotent replay, even with a live grant.
    sqlx::query("UPDATE conversation_participants SET active=false WHERE firm_id=$1 AND conversation_id=$2 AND principal_id=$3")
        .bind(f.core.firm).bind(conversation).bind(f.agent_id).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core
            .conversation_messages(&replacement_actor, conversation, 0)
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .send_message(&replacement_actor, conversation, "service-answer", reply)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .conversation_messages(&f.human, conversation, 0)
            .await
            .unwrap(),
        before
    );
}

#[tokio::test]
async fn admission_pause_preserves_pending_work_and_replay_cannot_unpause() {
    use ouroboros_contracts::AdmissionControlRequest;
    let f = setup().await;
    let pending = f
        .core
        .start(
            &f.human,
            "before-pause",
            execution_request(f.root_a, f.human_grant, f.grant_a, 5),
        )
        .await
        .unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    let pause = AdmissionControlRequest {
        delegation_id: f.human_grant,
        expected_revision: revision,
        paused: true,
        reason: "Prepare bounded shutdown".into(),
    };
    assert!(matches!(
        f.core.set_admission(&f.human, "pause", pause.clone()).await,
        Err(Error::Denied)
    ));
    sqlx::query(
        "UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE firm_id=$1",
    )
    .bind(f.core.firm)
    .execute(&f.db)
    .await
    .unwrap();
    let scoped = AdmissionControlRequest {
        delegation_id: f.grant_a,
        ..pause.clone()
    };
    assert!(matches!(
        f.core
            .set_admission(&f.actor_a, "scope-denied", scoped)
            .await,
        Err(Error::Denied)
    ));
    let receipt = f
        .core
        .set_admission(&f.human, "pause", pause.clone())
        .await
        .unwrap();
    assert_eq!(receipt["admission_paused"], true);
    assert_eq!(receipt["backup_ready"], false);
    assert_eq!(
        f.core.conditions(&f.actor_a).await.unwrap()["admission_paused"],
        true
    );
    assert!(matches!(
        f.core
            .start(
                &f.human,
                "after-pause",
                execution_request(f.root_a, f.human_grant, f.grant_a, 5)
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .runtime_claim(pending.intent_id, "management-test-runtime")
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .runtime_permitted(f.execution_a, "management-test-runtime")
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .start(
                &f.human,
                "before-pause",
                execution_request(f.root_a, f.human_grant, f.grant_a, 5)
            )
            .await
            .unwrap()
            .intent_id,
        pending.intent_id
    );
    let units: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(units, 15);
    let stale = AdmissionControlRequest {
        paused: false,
        ..pause.clone()
    };
    assert!(matches!(
        f.core.set_admission(&f.human, "stale", stale).await,
        Err(Error::Conflict)
    ));
    let resume = AdmissionControlRequest {
        paused: false,
        expected_revision: receipt["revision"].as_i64().unwrap(),
        ..pause.clone()
    };
    f.core
        .set_admission(&f.human, "resume", resume)
        .await
        .unwrap();
    assert_eq!(
        f.core
            .set_admission(&f.human, "pause", pause.clone())
            .await
            .unwrap(),
        receipt
    );
    assert_eq!(
        f.core.conditions(&f.human).await.unwrap()["admission_paused"],
        false
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.human_grant)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core.set_admission(&f.human, "pause", pause).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn admission_pause_serializes_with_fresh_execution() {
    let f = setup().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.human_grant).execute(&f.db).await.unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    let (pause, start) = tokio::join!(
        f.core.set_admission(
            &f.human,
            "race-pause",
            ouroboros_contracts::AdmissionControlRequest {
                delegation_id: f.human_grant,
                expected_revision: revision,
                paused: true,
                reason: "Stop dispatch".into()
            }
        ),
        f.core.start(
            &f.human,
            "race-start",
            execution_request(f.root_a, f.human_grant, f.grant_a, 5)
        )
    );
    pause.unwrap();
    let additional = match start {
        Ok(start) => {
            assert!(matches!(
                f.core
                    .runtime_claim(start.intent_id, "management-test-runtime")
                    .await,
                Err(Error::Denied)
            ));
            5
        }
        Err(Error::Denied) => 0,
        other => panic!("unexpected admission race result: {other:?}"),
    };
    assert_eq!(
        f.core.conditions(&f.human).await.unwrap()["admission_paused"],
        true
    );
    let units: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(units, 10 + additional);
}

#[tokio::test]
async fn environment_inventory_requires_unrestricted_current_authority_and_preserves_records() {
    let f = setup().await;
    assert!(matches!(
        f.core.environment_status(&f.human, f.human_grant).await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE firm_id=$1 AND id=ANY($2)")
        .bind(f.core.firm).bind(vec![f.human_grant, f.grant_a]).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core.environment_status(&f.actor_a, f.grant_a).await,
        Err(Error::Denied)
    ));
    f.core
        .start(
            &f.human,
            "inventory-pending",
            execution_request(f.root_a, f.human_grant, f.grant_a, 5),
        )
        .await
        .unwrap();
    let before = f
        .core
        .environment_status(&f.human, f.human_grant)
        .await
        .unwrap();
    assert_eq!(before["instances_without_termination"], 2);
    assert_eq!(before["executions_without_instance"], 1);
    assert_eq!(before["unsettled_reservation_records"], 3);
    assert_eq!(before["dispatched_resources_without_reply"], 0);
    f.core
        .set_admission(
            &f.human,
            "inventory-pause",
            ouroboros_contracts::AdmissionControlRequest {
                delegation_id: f.human_grant,
                expected_revision: before["revision"].as_i64().unwrap(),
                paused: true,
                reason: "Observe outstanding records".into(),
            },
        )
        .await
        .unwrap();
    let after = f
        .core
        .environment_status(&f.human, f.human_grant)
        .await
        .unwrap();
    assert_eq!(after["admission_paused"], true);
    assert_eq!(after["instances_without_termination"], 2);
    assert_eq!(after["executions_without_instance"], 1);
    assert_eq!(after["unsettled_reservation_records"], 3);
    assert_eq!(after["drain_confirmed"], false);
    assert_eq!(after["backup_ready"], false);
    let repeated = f
        .core
        .environment_status(&f.human, f.human_grant)
        .await
        .unwrap();
    assert_eq!(repeated["revision"], after["revision"]);
    assert_eq!(repeated["event_cursor"], after["event_cursor"]);
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.human_grant)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core.environment_status(&f.human, f.human_grant).await,
        Err(Error::Denied)
    ));
}
