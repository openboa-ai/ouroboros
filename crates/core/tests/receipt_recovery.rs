use ouroboros_contracts::{
    ReceiptSelector, ResourceReply, ResourceRequest, ResourceTicket, StorageClaim,
};
use ouroboros_core::{Caller, Core, Error, ResourceActor};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

struct Fixture {
    core: Core,
    pool: PgPool,
    caller: Caller,
    work: Uuid,
    grant: Uuid,
    inspector: Uuid,
    workspace: Uuid,
    storage: StorageClaim,
}
impl Fixture {
    async fn new() -> Self {
        let file = std::env::var("OURO_TEST_DATABASE_URL_FILE")
            .expect("explicit disposable database URL file required");
        let url = std::fs::read_to_string(file).unwrap();
        let pool = PgPool::connect(url.trim()).await.unwrap();
        Core::migrate(&pool).await.unwrap();
        let firm = Uuid::new_v4();
        let principal = Uuid::new_v4();
        let work = Uuid::new_v4();
        let grant = Uuid::new_v4();
        let inspector = Uuid::new_v4();
        let workspace = Uuid::new_v4();
        let storage = StorageClaim {
            firm_id: firm,
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
        };
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
            (
                grant,
                vec![
                    "inspect",
                    "file.upload",
                    "file.publish",
                    "file.read",
                    "db.write",
                ],
            ),
            (inspector, vec!["inspect"]),
        ] {
            sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')")
                .bind(firm).bind(id).bind(principal).bind(actions).execute(&pool).await.unwrap();
        }
        sqlx::query("INSERT INTO work VALUES($1,$2,$3,$4,'receipt observation fixture')")
            .bind(firm)
            .bind(work)
            .bind(principal)
            .bind(grant)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(firm)
            .bind(work)
            .bind(principal)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO resource_targets VALUES($1,'catalog','original-worker',true,$2,65536)")
            .bind(firm).bind(json!({"store_id":storage.store_id,"storage_generation":storage.generation,"workspace_id":workspace,"max_file_bytes":65536,"transfer_seconds":120})).execute(&pool).await.unwrap();
        for (id, actions) in [
            (
                grant,
                vec![
                    "inspect",
                    "file.upload",
                    "file.publish",
                    "file.read",
                    "db.write",
                ],
            ),
            (inspector, vec!["inspect"]),
        ] {
            sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,'catalog',$4)")
                .bind(firm)
                .bind(work)
                .bind(id)
                .bind(actions)
                .execute(&pool)
                .await
                .unwrap();
        }
        sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',100,0)")
            .bind(firm)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO storage_budgets VALUES($1,$2,$3,1000,0)")
            .bind(firm)
            .bind(storage.store_id)
            .bind(storage.generation)
            .execute(&pool)
            .await
            .unwrap();
        Self {
            core: Core::new(pool.clone(), firm),
            pool,
            caller: Caller { fingerprint },
            work,
            grant,
            inspector,
            workspace,
            storage,
        }
    }
    async fn admit(&self, operation: &str, input: Value) -> Uuid {
        self.core
            .resource_admit(
                ResourceActor::Human(self.caller.clone()),
                ResourceRequest {
                    target: "catalog".into(),
                    operation: operation.into(),
                    request_key: Uuid::new_v4().to_string(),
                    input,
                    work_id: Some(self.work),
                    delegation_id: Some(self.grant),
                },
            )
            .await
            .unwrap()
            .intent_id
    }
    async fn snapshot(&self) -> Value {
        sqlx::query_scalar("SELECT jsonb_build_object('intents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM intents i WHERE firm_id=$1),'calls',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id) FROM resource_calls r WHERE firm_id=$1),'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM attempts a WHERE firm_id=$1),'limits',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM limits l WHERE firm_id=$1),'reservations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id,limit_id) FROM reservations r WHERE firm_id=$1),'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY intent_id) FROM outbox o WHERE firm_id=$1),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM events e WHERE firm_id=$1),'storage_budgets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY store_id,generation) FROM storage_budgets b WHERE firm_id=$1),'storage_allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY intent_id) FROM storage_allocations a WHERE firm_id=$1))")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap()
    }
}

#[tokio::test]
async fn receipt_observation_preserves_original_attempt_and_current_reader_authority() {
    let f = Fixture::new().await;
    let digest = "a".repeat(64);
    let intent = f
        .admit("file.upload", json!({"sha256":digest,"size":70}))
        .await;
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, "original-worker", &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "an accepted upload must not be dispatched by recovery"
    );
    let dispatched = f
        .core
        .resource_claim(intent, "original-worker", Some(&f.storage))
        .await
        .unwrap();

    // The Registry's present worker/configuration is not authority to observe another
    // worker's historical obligation, and disabling a target does not erase that obligation.
    let replacement = StorageClaim {
        firm_id: f.core.firm,
        store_id: Uuid::new_v4(),
        generation: Uuid::new_v4(),
    };
    sqlx::query("UPDATE resource_targets SET active=false,worker_id='replacement-worker',configuration=$2 WHERE firm_id=$1")
        .bind(f.core.firm).bind(json!({"store_id":replacement.store_id,"storage_generation":replacement.generation,"workspace_id":Uuid::new_v4()})).execute(&f.pool).await.unwrap();
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.snapshot().await;
    for binding in [
        replacement,
        StorageClaim {
            firm_id: Uuid::new_v4(),
            ..f.storage.clone()
        },
        StorageClaim {
            store_id: Uuid::new_v4(),
            ..f.storage.clone()
        },
        StorageClaim {
            generation: Uuid::new_v4(),
            ..f.storage.clone()
        },
    ] {
        assert!(matches!(
            f.core
                .resource_receipt_recovery(intent, "original-worker", &binding)
                .await,
            Err(Error::Denied)
        ));
    }
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, "replacement-worker", &f.storage)
            .await,
        Err(Error::Denied)
    ));
    for _ in 0..2 {
        let ticket = f
            .core
            .resource_receipt_recovery(intent, "original-worker", &f.storage)
            .await
            .unwrap();
        assert_eq!(ticket.original_attempt_id, dispatched.attempt_id);
        assert_eq!(ticket.storage.generation, f.storage.generation);
        match &ticket.selector {
            ReceiptSelector::Upload { sha256, size } => {
                assert_eq!(sha256, &digest);
                assert_eq!(*size, 70);
            }
            _ => panic!("upload must have exact receipt selector"),
        }
        assert!(
            serde_json::from_value::<ResourceTicket>(json!(ticket)).is_err(),
            "observation is not execution authority"
        );
    }
    assert!(matches!(
        f.core
            .resource_claim(intent, "original-worker", Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_lookup(
                ResourceActor::Human(f.caller.clone()),
                intent,
                Some(f.work),
                Some(f.grant)
            )
            .await,
        Err(Error::Denied)
    ));
    let current = f
        .core
        .resource_lookup(
            ResourceActor::Human(f.caller.clone()),
            intent,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(current.state, "claimed");
    assert_eq!(
        f.snapshot().await,
        before,
        "observation and denied claims must not mutate effect/budget state"
    );

    let reply = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: json!({"intent_id":intent,"upload_id":intent,"sha256":digest}).to_string(),
        receipt: json!({"source":"catalog","upload_receipt":intent,"sha256":digest,"size":70}),
    };
    f.core
        .resource_complete(intent, "original-worker", reply.clone())
        .await
        .unwrap();
    let completed = f.snapshot().await;
    f.core
        .resource_complete(intent, "original-worker", reply)
        .await
        .unwrap();
    let recovered = f
        .core
        .resource_receipt_recovery(intent, "original-worker", &f.storage)
        .await
        .unwrap();
    assert_eq!(recovered.original_attempt_id, dispatched.attempt_id);
    assert_eq!(
        f.snapshot().await,
        completed,
        "repeated observation/completion cannot allocate, release or duplicate events"
    );
    assert_eq!(completed["attempts"].as_array().unwrap().len(), 1);
    assert_eq!(completed["storage_budgets"][0]["committed_bytes"], 70);
    assert_eq!(
        completed["storage_allocations"].as_array().unwrap().len(),
        1
    );

    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.inspector)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_lookup(
                ResourceActor::Human(f.caller.clone()),
                intent,
                Some(f.work),
                Some(f.inspector)
            )
            .await,
        Err(Error::Denied)
    ));
    // Internal observation authority never gives this now-revoked human a result route.
    assert!(
        f.core
            .resource_receipt_recovery(intent, "original-worker", &f.storage)
            .await
            .is_ok()
    );
    sqlx::query(
        "UPDATE attempts SET worker_id='other-attempt-worker' WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(f.core.firm)
    .bind(intent)
    .execute(&f.pool)
    .await
    .unwrap();
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, "original-worker", &f.storage)
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn publication_selector_is_exact_and_non_storage_effects_cannot_reconcile() {
    let f = Fixture::new().await;
    let upload = f
        .admit("file.upload", json!({"sha256":"b".repeat(64),"size":7}))
        .await;
    f.core
        .resource_claim(upload, "original-worker", Some(&f.storage))
        .await
        .unwrap();
    f.core
        .resource_complete(
            upload,
            "original-worker",
            ResourceReply {
                status: 200,
                content_type: "application/json".into(),
                body: json!({"intent_id":upload,"upload_id":upload,"sha256":"b".repeat(64)}).to_string(),
                receipt: json!({"source":"catalog","upload_receipt":upload,"sha256":"b".repeat(64),"size":7}),
            },
        )
        .await
        .unwrap();
    let files = json!({"results/first.txt":upload,"results/second.txt":upload});
    let publication = f
        .admit(
            "file.publish",
            json!({"workspace_id":f.workspace,"expected_revision":4,"files":files}),
        )
        .await;
    let dispatched = f
        .core
        .resource_claim(publication, "original-worker", Some(&f.storage))
        .await
        .unwrap();
    let before = f.snapshot().await;
    let ticket = f
        .core
        .resource_receipt_recovery(publication, "original-worker", &f.storage)
        .await
        .unwrap();
    assert_eq!(ticket.original_attempt_id, dispatched.attempt_id);
    match ticket.selector {
        ReceiptSelector::Publication {
            workspace_id,
            expected_revision,
            files: selected,
        } => {
            assert_eq!(workspace_id, f.workspace);
            assert_eq!(expected_revision, 4);
            assert_eq!(json!(selected), files);
        }
        _ => panic!("publication must preserve the full receipt selector"),
    }
    assert_eq!(f.snapshot().await, before);
    for (operation, input, storage) in [
        (
            "file.read",
            json!({"workspace_id":f.workspace,"revision":0,"path":"input.txt"}),
            Some(&f.storage),
        ),
        (
            "db.write",
            json!({"operation":"record_result","parameters":{"marker":"bounded-test"}}),
            None,
        ),
    ] {
        let intent = f.admit(operation, input).await;
        f.core
            .resource_claim(intent, "original-worker", storage)
            .await
            .unwrap();
        let before = f.snapshot().await;
        assert!(matches!(
            f.core
                .resource_receipt_recovery(intent, "original-worker", &f.storage)
                .await,
            Err(Error::Denied)
        ));
        assert_eq!(f.snapshot().await, before);
    }
    sqlx::query("UPDATE resource_calls SET configuration=jsonb_set(configuration,'{workspace_id}',to_jsonb($3::text)) WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm).bind(publication).bind(Uuid::new_v4().to_string()).execute(&f.pool).await.unwrap();
    assert!(
        matches!(
            f.core
                .resource_receipt_recovery(publication, "original-worker", &f.storage)
                .await,
            Err(Error::Denied)
        ),
        "conflicting original input and scope cannot produce an observation selector"
    );
}

#[tokio::test]
async fn unresolved_publication_fences_only_its_physical_workspace_across_grants_and_aliases() {
    let f = Fixture::new().await;
    let request = |key: &str, grant, target: &str, workspace| ResourceRequest {
        target: target.into(),
        operation: "file.publish".into(),
        request_key: key.into(),
        input: json!({"workspace_id":workspace,"expected_revision":0,"files":{}}),
        work_id: Some(f.work),
        delegation_id: Some(grant),
    };
    let actor = || ResourceActor::Human(f.caller.clone());
    let (one, two) = tokio::join!(
        f.core.resource_admit(
            actor(),
            request("concurrent-one", f.grant, "catalog", f.workspace)
        ),
        f.core.resource_admit(
            actor(),
            request("concurrent-two", f.grant, "catalog", f.workspace)
        ),
    );
    let first = match (one, two) {
        (Ok(a), Err(Error::Conflict)) | (Err(Error::Conflict), Ok(a)) => a,
        other => panic!("one publication must own the conflict boundary: {other:?}"),
    };
    let claimed = f
        .core
        .resource_claim(first.intent_id, "original-worker", Some(&f.storage))
        .await
        .unwrap();
    // A different currently authorized grant can observe/recover but cannot overwrite
    // the uncertain original effect, even after the old grant has been revoked.
    sqlx::query("UPDATE delegations SET actions=array_append(actions,'file.publish') WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.inspector).execute(&f.pool).await.unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=array_append(operations,'file.publish') WHERE firm_id=$1 AND delegation_id=$2")
        .bind(f.core.firm).bind(f.inspector).execute(&f.pool).await.unwrap();
    for (alias, workspace) in [
        ("same-store-alias", f.workspace),
        ("independent-workspace", Uuid::new_v4()),
    ] {
        sqlx::query("INSERT INTO resource_targets SELECT firm_id,$2,worker_id,active,jsonb_set(configuration,'{workspace_id}',$3),max_bytes FROM resource_targets WHERE firm_id=$1 AND id='catalog'")
            .bind(f.core.firm).bind(alias).bind(json!(workspace)).execute(&f.pool).await.unwrap();
        sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) VALUES($1,$2,$3,$4,ARRAY['inspect','file.publish'])")
            .bind(f.core.firm).bind(f.work).bind(f.inspector).bind(alias).execute(&f.pool).await.unwrap();
        if workspace == f.workspace {
            let before = f.snapshot().await;
            assert!(matches!(
                f.core
                    .resource_admit(
                        actor(),
                        request("alias-bypass", f.inspector, alias, workspace)
                    )
                    .await,
                Err(Error::Conflict)
            ));
            assert_eq!(before, f.snapshot().await);
        } else {
            assert!(
                f.core
                    .resource_admit(
                        actor(),
                        request("independent", f.inspector, alias, workspace)
                    )
                    .await
                    .is_ok()
            );
        }
    }
    // A read has no publication conflict; its own ordinary authority still applies.
    assert!(
        f.core
            .resource_admit(
                actor(),
                ResourceRequest {
                    target: "catalog".into(),
                    operation: "file.read".into(),
                    request_key: "read-during-unknown".into(),
                    input: json!({"workspace_id":f.workspace,"revision":0,"path":"input.txt"}),
                    work_id: Some(f.work),
                    delegation_id: Some(f.grant),
                }
            )
            .await
            .is_ok()
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_admit(
                actor(),
                request("replacement", f.inspector, "catalog", f.workspace)
            )
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(before, f.snapshot().await);
    let recovery = f
        .core
        .resource_receipt_recovery(first.intent_id, "original-worker", &f.storage)
        .await
        .unwrap();
    assert_eq!(recovery.original_attempt_id, claimed.attempt_id);
    // Exact late receipt resolves this one effect without restoring its old grant.
    f.core.resource_complete(first.intent_id,"original-worker",ResourceReply {
        status:200,content_type:"application/json".into(),
        body:json!({"intent_id":first.intent_id,"revision":1}).to_string(),
        receipt:json!({"source":"catalog","publication_receipt":first.intent_id,"revision":1}),
    }).await.unwrap();
    let mut next = request("replacement", f.inspector, "catalog", f.workspace);
    next.input["expected_revision"] = json!(1);
    assert!(f.core.resource_admit(actor(), next).await.is_ok());
    assert!(matches!(
        f.core
            .resource_admit(
                actor(),
                request("old-grant", f.grant, "catalog", f.workspace)
            )
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn preexisting_queued_publications_dispatch_in_order_and_preserve_unknown_claims() {
    let f = Fixture::new().await;
    let first = f
        .admit(
            "file.publish",
            json!({"workspace_id":f.workspace,"expected_revision":0,"files":{}}),
        )
        .await;
    // Model the valid two-queued-intent history permitted by the previous implementation.
    // This transient fixture setup does not pretend an actual receipt was received.
    sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(first)
        .execute(&f.pool)
        .await
        .unwrap();
    let second = f
        .admit(
            "file.publish",
            json!({"workspace_id":f.workspace,"expected_revision":1,"files":{}}),
        )
        .await;
    sqlx::query("UPDATE intents SET state='accepted',created_at=clock_timestamp()-interval '2 seconds' WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(first).execute(&f.pool).await.unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_claim(second, "original-worker", Some(&f.storage))
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(before, f.snapshot().await);
    let original = f
        .core
        .resource_claim(first, "original-worker", Some(&f.storage))
        .await
        .unwrap();
    // A lost worker response leaves the original claim and reservation in place.
    // It is not a new dispatch and does not make the effect known absent.
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_claim(second, "original-worker", Some(&f.storage))
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(before, f.snapshot().await);
    f.core
        .resource_complete(
            first,
            "original-worker",
            ResourceReply {
                status: 200,
                content_type: "application/json".into(),
                body: json!({"intent_id":first,"revision":1}).to_string(),
                receipt: json!({"source":"catalog","publication_receipt":first,"revision":1}),
            },
        )
        .await
        .unwrap();
    let next = f
        .core
        .resource_claim(second, "original-worker", Some(&f.storage))
        .await
        .unwrap();
    assert_ne!(next.attempt_id, original.attempt_id);
    assert_eq!(f.snapshot().await["attempts"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn company_observation_requires_original_dispatch_and_does_not_change_state() {
    let f = Fixture::new().await;
    let intent = f
        .admit(
            "db.write",
            json!({"operation":"record_result","parameters":{"marker":"retained"}}),
        )
        .await;
    assert!(matches!(
        f.core
            .company_receipt_recovery(intent, "original-worker")
            .await,
        Err(Error::Denied)
    ));
    let dispatched = f
        .core
        .resource_claim(intent, "original-worker", None)
        .await
        .unwrap();
    let before = f.snapshot().await;
    let observed = f
        .core
        .company_receipt_recovery(intent, "original-worker")
        .await
        .unwrap();
    assert_eq!(observed.original_attempt_id, dispatched.attempt_id);
    assert_eq!(observed.parameters, json!({"marker":"retained"}));
    assert!(matches!(
        f.core
            .company_receipt_recovery(intent, "other-worker")
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    sqlx::query(
        "UPDATE resource_targets SET active=false,worker_id='replacement-worker' WHERE firm_id=$1",
    )
    .bind(f.core.firm)
    .execute(&f.pool)
    .await
    .unwrap();
    let before = f.snapshot().await;
    assert!(
        f.core
            .company_receipt_recovery(intent, "original-worker")
            .await
            .is_ok()
    );
    assert!(matches!(
        f.core
            .company_receipt_recovery(intent, "replacement-worker")
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
}

#[tokio::test]
async fn admission_pause_keeps_company_observation_but_blocks_new_effects() {
    let f = Fixture::new().await;
    let input = json!({"operation":"record_result","parameters":{"marker":"pending"}});
    let intent = f.admit("db.write", input.clone()).await;
    let claimed = f
        .core
        .resource_claim(intent, "original-worker", None)
        .await
        .unwrap();
    let live = ouroboros_contracts::ResourceLiveRequest {
        attempt_id: claimed.attempt_id,
        storage: None,
    };
    f.core
        .resource_live(intent, "original-worker", &live)
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['environment.admission'] WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.grant).execute(&f.pool).await.unwrap();
    let revision: i64 = sqlx::query_scalar("SELECT revision FROM firms WHERE id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.pool)
        .await
        .unwrap();
    f.core
        .set_admission(
            &f.caller,
            "pause",
            ouroboros_contracts::AdmissionControlRequest {
                delegation_id: f.grant,
                expected_revision: revision,
                paused: true,
                reason: "Bounded shutdown".into(),
            },
        )
        .await
        .unwrap();
    let snapshot = f.snapshot().await;
    assert!(matches!(
        f.core.resource_live(intent, "original-worker", &live).await,
        Err(Error::Denied)
    ));
    let request = ResourceRequest {
        target: "catalog".into(),
        operation: "db.write".into(),
        request_key: "after-pause".into(),
        input,
        work_id: Some(f.work),
        delegation_id: Some(f.grant),
    };
    assert!(matches!(
        f.core
            .resource_admit(ResourceActor::from(&f.caller), request)
            .await,
        Err(Error::Denied)
    ));
    let receipt = f
        .core
        .company_receipt_recovery(intent, "original-worker")
        .await
        .unwrap();
    assert_eq!(receipt.original_attempt_id, claimed.attempt_id);
    assert!(
        f.core
            .resource_lookup(
                ResourceActor::from(&f.caller),
                intent,
                Some(f.work),
                Some(f.inspector)
            )
            .await
            .is_ok()
    );
    assert_eq!(f.snapshot().await, snapshot);
}
