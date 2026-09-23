//! Core authorization regression with synthetic completed worker evidence, not provider execution.
use ouroboros_contracts::{
    ConnectionAcceptanceRequest, ConnectionActivationRequest, ResourceLiveRequest, ResourceRequest,
};
use ouroboros_core::{Actor, Caller, Core, Error, ResourceActor};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

#[tokio::test]
async fn distinct_disabled_verifier_restricts_module_acceptance_and_use() {
    let file = std::env::var("OURO_TEST_DATABASE_URL_FILE")
        .expect("explicit disposable PostgreSQL URL file required");
    let pool = PgPool::connect(std::fs::read_to_string(file).unwrap().trim())
        .await
        .unwrap();
    Core::migrate(&pool).await.unwrap();
    let firm = Uuid::new_v4();
    let core = Core::new(pool.clone(), firm);
    let work = Uuid::new_v4();
    let author = Uuid::new_v4();
    let verifier = Uuid::new_v4();
    let acceptor = Uuid::new_v4();
    let consumer = Uuid::new_v4();
    let verification_grant = Uuid::new_v4();
    let acceptance_grant = Uuid::new_v4();
    let consumer_grant = Uuid::new_v4();
    let actors = [
        (author, Uuid::new_v4(), vec!["inspect"]),
        (
            verifier,
            verification_grant,
            vec!["inspect", "auth-module.verify"],
        ),
        (
            acceptor,
            acceptance_grant,
            vec![
                "inspect",
                "connection.accept",
                "connection.activate",
                "auth-module.accept",
                "auth-module.select",
            ],
        ),
        (consumer, consumer_grant, vec!["inspect", "model.responses"]),
    ];
    sqlx::query("INSERT INTO firms VALUES($1)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    for (principal, grant, actions) in &actors {
        sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
            .bind(firm)
            .bind(principal)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
        )
        .bind(principal.simple().to_string().repeat(2))
        .bind(firm)
        .bind(principal)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')")
            .bind(firm).bind(grant).bind(principal).bind(actions).execute(&pool).await.unwrap();
    }
    sqlx::query("INSERT INTO work VALUES($1,$2,$3,$4,'verifier authority regression')")
        .bind(firm)
        .bind(work)
        .bind(author)
        .bind(actors[0].1)
        .execute(&pool)
        .await
        .unwrap();
    let base = json!({"target":"model","endpoint":"https://fixture.invalid/responses","credential_id":Uuid::new_v4(),"credential_version":1,"timeout_ms":2000,"max_response_bytes":65536});
    let module = json!({"abi":"ouroboros.auth.bearer/1","wasm_sha256":"a".repeat(64)});
    let mut selected = base.clone();
    selected["auth_module"] = module.clone();
    sqlx::query("INSERT INTO resource_targets VALUES($1,'model','provider',true,$2,65536)")
        .bind(firm)
        .bind(&base)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',100,0)")
        .bind(firm)
        .execute(&pool)
        .await
        .unwrap();
    for (principal, grant, actions) in &actors {
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(firm)
            .bind(work)
            .bind(principal)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,'model',$4)")
            .bind(firm)
            .bind(work)
            .bind(grant)
            .bind(actions)
            .execute(&pool)
            .await
            .unwrap();
    }
    // Seed historical enrollment/verification records; exercise acceptance and use through Core.
    let enrollment = Uuid::new_v4();
    let verification = Uuid::new_v4();
    for (id, operation) in [
        (enrollment, "credential.enroll"),
        (verification, "auth-module.verify"),
    ] {
        sqlx::query("INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,delegation_id,state,work_id) VALUES($1,$2,$3,$4,$4,'{}',$2,$5,'succeeded',$6)")
            .bind(firm).bind(id).bind(verifier).bind(operation).bind(verification_grant).bind(work).execute(&pool).await.unwrap();
        sqlx::query("INSERT INTO resource_calls(firm_id,intent_id,work_id,delegation_id,target_id,operation,configuration,worker_id,reply) VALUES($1,$2,$3,$4,'model',$5,$6,'provider',$7)")
            .bind(firm).bind(id).bind(work).bind(verification_grant).bind(operation).bind(&base)
            .bind(json!({"receipt":{"source":"auth_module_verifier","module":module,"profile":"bounded-bearer-wasm-v1","vectors":2,"provider_calls":0}}))
            .execute(&pool).await.unwrap();
    }
    let candidate = Uuid::new_v4();
    let review = Uuid::new_v4();
    sqlx::query("INSERT INTO connection_candidates(firm_id,id,work_id,target_id,author_id,request_key,request,enrollment_intent_id,worker_id,base_configuration,proposed_configuration) VALUES($1,$2,$3,'model',$4,'candidate','{}',$5,'provider',$6,$7)")
        .bind(firm).bind(candidate).bind(work).bind(author).bind(enrollment).bind(&base).bind(selected).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO connection_reviews(firm_id,id,candidate_id,reviewer_id,request_key,request,evidence) VALUES($1,$2,$3,$4,'review',$5,$6)")
        .bind(firm).bind(review).bind(candidate).bind(verifier).bind(json!({"recommendation":"recommend"}))
        .bind(json!([{"intent_id":verification}])).execute(&pool).await.unwrap();
    let actor = || {
        Actor::Human(Caller {
            fingerprint: acceptor.simple().to_string().repeat(2),
        })
    };
    let acceptance = || ConnectionAcceptanceRequest {
        work_id: Some(work),
        delegation_id: Some(acceptance_grant),
        review_id: review,
        max_calls: 10,
        lifetime_seconds: 300,
    };
    let accepted = core
        .accept_connection(actor(), candidate, "enabled", acceptance())
        .await
        .unwrap();
    let aid: Uuid = serde_json::from_value(accepted["id"].clone()).unwrap();
    let activation = || ConnectionActivationRequest {
        work_id: Some(work),
        delegation_id: Some(acceptance_grant),
        acceptance_id: aid,
    };
    sqlx::query("UPDATE principals SET enabled=false WHERE firm_id=$1 AND id=$2")
        .bind(firm)
        .bind(verifier)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        matches!(
            core.accept_connection(actor(), candidate, "disabled", acceptance())
                .await,
            Err(Error::Denied)
        ),
        "disabled distinct verifier must prevent fresh acceptance"
    );
    assert!(
        matches!(
            core.activate_connection(actor(), candidate, "disabled", activation())
                .await,
            Err(Error::Denied)
        ),
        "disabled distinct verifier must prevent fresh selection"
    );
    sqlx::query("UPDATE principals SET enabled=true WHERE firm_id=$1 AND id=$2")
        .bind(firm)
        .bind(verifier)
        .execute(&pool)
        .await
        .unwrap();
    let activated = core
        .activate_connection(actor(), candidate, "enabled", activation())
        .await
        .unwrap();
    let request = || ResourceRequest {
        service_request_id: None,
        effect_slot: None,
        target: "model".into(),
        operation: "model.responses".into(),
        request_key: Uuid::new_v4().to_string(),
        input: json!({"model":"fixture","input":"synthetic"}),
        work_id: Some(work),
        delegation_id: Some(consumer_grant),
    };
    let caller = || {
        ResourceActor::Human(Caller {
            fingerprint: consumer.simple().to_string().repeat(2),
        })
    };
    let admitted = core.resource_admit(caller(), request()).await.unwrap();
    let ticket = core
        .resource_claim(admitted.intent_id, "provider", None)
        .await
        .unwrap();
    let live = || ResourceLiveRequest {
        attempt_id: ticket.attempt_id,
        storage: None,
    };
    core.resource_live(admitted.intent_id, "provider", &live())
        .await
        .unwrap();
    // Principal disable and delegation revocation independently restrict the same accepted scope.
    for disable_principal in [true, false] {
        let restrict = if disable_principal {
            "UPDATE principals SET enabled=false WHERE firm_id=$1 AND id=$2"
        } else {
            "UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2"
        };
        let restore = if disable_principal {
            "UPDATE principals SET enabled=true WHERE firm_id=$1 AND id=$2"
        } else {
            "UPDATE delegations SET revoked=false WHERE firm_id=$1 AND id=$2"
        };
        let id = if disable_principal {
            verifier
        } else {
            verification_grant
        };
        sqlx::query(restrict)
            .bind(firm)
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        let before: i64 =
            sqlx::query_scalar("SELECT count(*) FROM connection_call_slots WHERE firm_id=$1")
                .bind(firm)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(matches!(
            core.resource_admit(caller(), request()).await,
            Err(Error::Denied)
        ));
        assert!(matches!(
            core.resource_live(admitted.intent_id, "provider", &live())
                .await,
            Err(Error::Denied)
        ));
        let after: i64 =
            sqlx::query_scalar("SELECT count(*) FROM connection_call_slots WHERE firm_id=$1")
                .bind(firm)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            before, after,
            "rejected admission must not consume a connection slot"
        );
        // Historical activation replay observes its original identity without extending authority.
        assert_eq!(
            core.activate_connection(actor(), candidate, "enabled", activation())
                .await
                .unwrap(),
            activated
        );
        sqlx::query(restore)
            .bind(firm)
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        core.resource_live(admitted.intent_id, "provider", &live())
            .await
            .unwrap();
        core.resource_admit(caller(), request()).await.unwrap();
    }
    let stored: Value =
        sqlx::query_scalar("SELECT evidence FROM connection_reviews WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(review)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        stored,
        json!([{"intent_id":verification}]),
        "restriction must preserve historical evidence"
    );
}
