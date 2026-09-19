//! Core/real-PostgreSQL authority and metadata tests. These do not execute a byte stream,
//! authenticate a real kernel peer, or prove a catalog's physical upload implementation.
use ouroboros_contracts::{
    ResourceAdmission, ResourceLiveRequest, ResourceReply, ResourceRequest, StorageClaim,
};
use ouroboros_core::{Caller, Core, Error, ResourceActor};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const MAX_FILE_BYTES: u64 = 1024 * 1024;
const TRANSFER_SECONDS: u64 = 120;
const WORKER: &str = "binary-worker";

struct Fixture {
    core: Core,
    pool: PgPool,
    caller: Caller,
    work: Uuid,
    grant: Uuid,
    inspector: Uuid,
    workspace: Uuid,
    storage: StorageClaim,
    configuration: Value,
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
        let fingerprint = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let storage = StorageClaim {
            firm_id: firm,
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
        };
        let configuration = json!({
            "store_id": storage.store_id,
            "storage_generation": storage.generation,
            "workspace_id": workspace,
            "max_file_bytes": MAX_FILE_BYTES,
            "transfer_seconds": TRANSFER_SECONDS,
        });
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
            (grant, vec!["inspect", "file.read", "file.upload"]),
            (inspector, vec!["inspect"]),
        ] {
            sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '1 hour')")
                .bind(firm).bind(id).bind(principal).bind(actions).execute(&pool).await.unwrap();
        }
        for (id, purpose) in [
            (work, "binary transfer"),
            (Uuid::new_v4(), "unrelated work"),
        ] {
            sqlx::query("INSERT INTO work(firm_id,id,principal_id,delegation_id,purpose) VALUES($1,$2,$3,$4,$5)")
                .bind(firm).bind(id).bind(principal).bind(grant).bind(purpose).execute(&pool).await.unwrap();
        }
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(firm)
            .bind(work)
            .bind(principal)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE delegations SET work_root_id=$2 WHERE firm_id=$1")
            .bind(firm)
            .bind(work)
            .execute(&pool)
            .await
            .unwrap();
        for target in ["catalog", "catalog-alias"] {
            // The 64KiB request JSON bound does not impose a 64KiB file bound.
            sqlx::query("INSERT INTO resource_targets VALUES($1,$2,$3,true,$4,65536)")
                .bind(firm)
                .bind(target)
                .bind(WORKER)
                .bind(&configuration)
                .execute(&pool)
                .await
                .unwrap();
            for (id, operations) in [
                (grant, vec!["inspect", "file.read", "file.upload"]),
                (inspector, vec!["inspect"]),
            ] {
                sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,$4,$5)")
                    .bind(firm)
                    .bind(work)
                    .bind(id)
                    .bind(target)
                    .bind(operations)
                    .execute(&pool)
                    .await
                    .unwrap();
            }
        }
        sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',100,0)")
            .bind(firm)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO storage_budgets VALUES($1,$2,$3,$4,0)")
            .bind(firm)
            .bind(storage.store_id)
            .bind(storage.generation)
            .bind(MAX_FILE_BYTES as i64)
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
            configuration,
        }
    }

    fn actor(&self) -> ResourceActor {
        ResourceActor::Human(self.caller.clone())
    }

    fn request(&self, operation: &str, target: &str, key: &str, input: Value) -> ResourceRequest {
        ResourceRequest {
            effect_slot: None,
            target: target.into(),
            operation: operation.into(),
            request_key: key.into(),
            input,
            work_id: Some(self.work),
            delegation_id: Some(self.grant),
        }
    }

    fn upload(&self, target: &str, key: &str, size: u64) -> ResourceRequest {
        self.request(
            "file.upload",
            target,
            key,
            json!({"sha256":"a".repeat(64),"size":size}),
        )
    }

    fn read(&self, key: &str) -> ResourceRequest {
        self.request(
            "file.read",
            "catalog",
            key,
            json!({"workspace_id":self.workspace,"revision":3,"path":"result.bin"}),
        )
    }

    async fn admit(&self, request: ResourceRequest) -> ResourceAdmission {
        self.core
            .resource_admit(self.actor(), request)
            .await
            .unwrap()
    }

    async fn claim(&self, intent: Uuid) -> ResourceLiveRequest {
        let ticket = self
            .core
            .resource_claim(intent, WORKER, Some(&self.storage))
            .await
            .unwrap();
        ResourceLiveRequest {
            attempt_id: ticket.attempt_id,
            storage: Some(self.storage.clone()),
        }
    }

    async fn configure(&self, configuration: &Value) {
        sqlx::query("UPDATE resource_targets SET configuration=$2 WHERE firm_id=$1")
            .bind(self.core.firm)
            .bind(configuration)
            .execute(&self.pool)
            .await
            .unwrap();
    }

    async fn change(&self, sql: &'static str) {
        sqlx::query(sql)
            .bind(self.core.firm)
            .execute(&self.pool)
            .await
            .unwrap();
    }

    async fn snapshot(&self) -> Value {
        sqlx::query_scalar("SELECT jsonb_build_object('intents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM intents i WHERE firm_id=$1),'calls',(SELECT jsonb_agg(to_jsonb(c) ORDER BY intent_id) FROM resource_calls c WHERE firm_id=$1),'transfers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY intent_id) FROM resource_transfers t WHERE firm_id=$1),'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM attempts a WHERE firm_id=$1),'limits',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM limits l WHERE firm_id=$1),'reservations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id,limit_id) FROM reservations r WHERE firm_id=$1),'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY intent_id) FROM outbox o WHERE firm_id=$1),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM events e WHERE firm_id=$1),'storage_budgets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY store_id,generation) FROM storage_budgets b WHERE firm_id=$1),'storage_allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY intent_id) FROM storage_allocations a WHERE firm_id=$1))")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap()
    }

    async fn deny_live_without_effect(
        &self,
        intent: Uuid,
        worker: &str,
        request: &ResourceLiveRequest,
    ) {
        let before = self.snapshot().await;
        assert!(matches!(
            self.core.resource_live(intent, worker, request).await,
            Err(Error::Denied)
        ));
        assert_eq!(
            self.snapshot().await,
            before,
            "denial cannot mint attempts, renew expiry or settle reservations"
        );
    }

    async fn deny_transfer_access(&self, intent: Uuid) {
        let before = self.snapshot().await;
        assert!(matches!(
            self.core
                .resource_transfer_access(self.actor(), intent, Some(self.work), Some(self.grant))
                .await,
            Err(Error::Denied)
        ));
        assert_eq!(
            self.snapshot().await,
            before,
            "buffered-byte access cannot mint or settle authority"
        );
    }
}

#[tokio::test]
async fn large_binary_admission_serializes_one_shared_store_and_preserves_descriptor() {
    let f = Fixture::new().await;
    let size = 700 * 1024;
    let a = f.upload("catalog", "large-a", size);
    let b = f.upload("catalog-alias", "large-b", size);
    let (first, second) = tokio::join!(
        f.core.resource_admit(f.actor(), a.clone()),
        f.core.resource_admit(f.actor(), b.clone())
    );
    let (won, request) = match (first, second) {
        (Ok(won), Err(Error::Capacity)) => (won, a),
        (Err(Error::Capacity), Ok(won)) => (won, b),
        (a, b) => panic!("700KiB + 700KiB cannot fit one shared 1MiB store: {a:?}, {b:?}"),
    };
    let descriptor = won.upload.as_ref().unwrap();
    assert_eq!(descriptor.size, size);
    assert_eq!(descriptor.sha256, "a".repeat(64));
    assert_eq!(descriptor.timeout_seconds, TRANSFER_SECONDS);
    assert_eq!(won.state, "accepted");
    assert!(
        won.reply.is_none(),
        "admission is not evidence that file bytes arrived"
    );
    let allocations: (i64, i64) = sqlx::query_as(
        "SELECT count(*),sum(bytes)::bigint FROM storage_allocations WHERE firm_id=$1",
    )
    .bind(f.core.firm)
    .fetch_one(&f.pool)
    .await
    .unwrap();
    assert_eq!(allocations, (1, size as i64));
    let committed: i64 =
        sqlx::query_scalar("SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(committed, size as i64);
    let transfers: (i64, String, bool) = sqlx::query_as("SELECT count(*),min(origin_fingerprint),bool_and(expires_at>clock_timestamp() AND expires_at<=clock_timestamp()+interval '120 seconds') FROM resource_transfers WHERE firm_id=$1")
        .bind(f.core.firm).fetch_one(&f.pool).await.unwrap();
    assert_eq!(transfers, (1, f.caller.fingerprint.clone(), true));
    let before = f.snapshot().await;
    let replay = f.admit(request).await;
    assert_eq!(replay.intent_id, won.intent_id);
    assert_eq!(json!(replay.upload), json!(won.upload));
    assert_eq!(
        f.snapshot().await,
        before,
        "replay cannot reset the admitted deadline or reserve twice"
    );
}

#[tokio::test]
async fn file_admission_requires_explicit_valid_limits_without_partial_commit() {
    let f = Fixture::new().await;
    let before = f.snapshot().await;
    let mut invalid = Vec::new();
    for key in ["max_file_bytes", "transfer_seconds"] {
        let mut cfg = f.configuration.clone();
        cfg.as_object_mut().unwrap().remove(key);
        invalid.push(cfg);
    }
    for (key, value) in [
        ("max_file_bytes", json!(0)),
        ("max_file_bytes", json!(-1)),
        ("max_file_bytes", json!(i64::MAX as u64 + 1)),
        ("transfer_seconds", json!(0)),
        ("transfer_seconds", json!(301)),
    ] {
        let mut cfg = f.configuration.clone();
        cfg[key] = value;
        invalid.push(cfg);
    }
    for cfg in invalid {
        f.configure(&cfg).await;
        for request in [
            f.read("invalid-read"),
            f.upload("catalog", "invalid-upload", 1),
        ] {
            assert!(matches!(
                f.core.resource_admit(f.actor(), request).await,
                Err(Error::Unavailable)
            ));
            assert_eq!(f.snapshot().await, before);
        }
    }
    f.configure(&f.configuration).await;
    assert!(matches!(
        f.core
            .resource_admit(
                f.actor(),
                f.upload("catalog", "too-large", MAX_FILE_BYTES + 1)
            )
            .await,
        Err(Error::Invalid)
    ));
    let missing_size = f.request(
        "file.upload",
        "catalog",
        "missing-size",
        json!({"sha256":"a".repeat(64)}),
    );
    assert!(matches!(
        f.core.resource_admit(f.actor(), missing_size).await,
        Err(Error::Invalid)
    ));
    let embedded_bytes = f.request(
        "file.upload",
        "catalog",
        "embedded-bytes",
        json!({"sha256":"a".repeat(64),"size":1,"content":"x"}),
    );
    assert!(matches!(
        f.core.resource_admit(f.actor(), embedded_bytes).await,
        Err(Error::Invalid)
    ));
    assert_eq!(f.snapshot().await, before);
}

#[tokio::test]
async fn live_transfer_rechecks_exact_attempt_storage_and_current_authority() {
    let f = Fixture::new().await;
    let admitted = f
        .admit(f.upload("catalog", "live-upload", 128 * 1024))
        .await;
    let request = f.claim(admitted.intent_id).await;
    let before = f.snapshot().await;
    f.core
        .resource_live(admitted.intent_id, WORKER, &request)
        .await
        .unwrap();
    f.core
        .resource_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
        .await
        .unwrap();
    assert_eq!(
        f.snapshot().await,
        before,
        "live checks are observations of one admitted attempt"
    );
    f.deny_live_without_effect(admitted.intent_id, "different-worker", &request)
        .await;
    f.deny_live_without_effect(
        admitted.intent_id,
        WORKER,
        &ResourceLiveRequest {
            attempt_id: Uuid::new_v4(),
            ..request.clone()
        },
    )
    .await;
    let another = f.admit(f.read("different-intent")).await;
    let other_attempt = f.claim(another.intent_id).await;
    f.deny_live_without_effect(
        admitted.intent_id,
        WORKER,
        &ResourceLiveRequest {
            attempt_id: other_attempt.attempt_id,
            ..request.clone()
        },
    )
    .await;
    for storage in [
        None,
        Some(StorageClaim {
            firm_id: Uuid::new_v4(),
            ..f.storage.clone()
        }),
        Some(StorageClaim {
            store_id: Uuid::new_v4(),
            ..f.storage.clone()
        }),
        Some(StorageClaim {
            generation: Uuid::new_v4(),
            ..f.storage.clone()
        }),
    ] {
        f.deny_live_without_effect(
            admitted.intent_id,
            WORKER,
            &ResourceLiveRequest {
                storage,
                ..request.clone()
            },
        )
        .await;
    }
    // Trusted fixture mutations simulate each independently committed control change. No new
    // authority or fake runtime identity is enrolled through the product under test.
    for (disable, restore) in [
        (
            "UPDATE credentials SET enabled=false WHERE firm_id=$1",
            "UPDATE credentials SET enabled=true WHERE firm_id=$1",
        ),
        (
            "UPDATE principals SET enabled=false WHERE firm_id=$1",
            "UPDATE principals SET enabled=true WHERE firm_id=$1",
        ),
        (
            "UPDATE delegations SET revoked=true WHERE firm_id=$1 AND 'file.upload'=ANY(actions)",
            "UPDATE delegations SET revoked=false WHERE firm_id=$1",
        ),
        (
            "DELETE FROM work_controls WHERE firm_id=$1",
            "INSERT INTO work_controls SELECT firm_id,id,principal_id FROM work WHERE firm_id=$1 AND purpose='binary transfer'",
        ),
        (
            "UPDATE delegations SET work_root_id=(SELECT id FROM work WHERE firm_id=$1 AND purpose='unrelated work') WHERE firm_id=$1 AND 'file.upload'=ANY(actions)",
            "UPDATE delegations SET work_root_id=(SELECT id FROM work WHERE firm_id=$1 AND purpose='binary transfer') WHERE firm_id=$1",
        ),
        (
            "UPDATE resource_scopes SET operations=array_remove(operations,'file.upload') WHERE firm_id=$1 AND 'file.upload'=ANY(operations)",
            "UPDATE resource_scopes SET operations=operations||ARRAY['file.upload'] WHERE firm_id=$1 AND 'file.read'=ANY(operations)",
        ),
        (
            "UPDATE resource_targets SET active=false WHERE firm_id=$1",
            "UPDATE resource_targets SET active=true WHERE firm_id=$1",
        ),
        (
            "UPDATE resource_targets SET worker_id='replacement-worker' WHERE firm_id=$1",
            "UPDATE resource_targets SET worker_id='binary-worker' WHERE firm_id=$1",
        ),
    ] {
        f.change(disable).await;
        f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
            .await;
        f.deny_transfer_access(admitted.intent_id).await;
        f.change(restore).await;
        f.core
            .resource_live(admitted.intent_id, WORKER, &request)
            .await
            .unwrap();
    }
    let mut changed = f.configuration.clone();
    changed["max_file_bytes"] = json!(MAX_FILE_BYTES - 1);
    f.configure(&changed).await;
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    f.deny_transfer_access(admitted.intent_id).await;
    f.configure(&f.configuration).await;
    f.core
        .resource_live(admitted.intent_id, WORKER, &request)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn expired_transfer_cannot_be_renewed_by_replay_or_metadata_lookup() {
    let f = Fixture::new().await;
    let input = f.upload("catalog", "expires-once", 96 * 1024);
    let admitted = f.admit(input.clone()).await;
    let request = f.claim(admitted.intent_id).await;
    // Set the persisted absolute expiry in this DB fixture; this is not a wall-clock/guard test.
    f.change("UPDATE resource_transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE firm_id=$1").await;
    let before = f.snapshot().await;
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    f.deny_transfer_access(admitted.intent_id).await;
    assert!(matches!(
        f.core
            .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    let replay = f.admit(input).await;
    assert_eq!(replay.intent_id, admitted.intent_id);
    assert_eq!(replay.state, "claimed");
    assert_eq!(json!(replay.upload), json!(admitted.upload));
    let history = f
        .core
        .resource_lookup(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(history.intent_id, admitted.intent_id);
    assert_eq!(f.snapshot().await, before);
    let reserved: (i64, bool) =
        sqlx::query_as("SELECT units,settled FROM reservations WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(admitted.intent_id)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(reserved, (1, false));
    let bytes: i64 =
        sqlx::query_scalar("SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(bytes, 96 * 1024);
}

#[tokio::test]
async fn succeeded_read_keeps_only_bound_metadata_and_requires_live_authority_for_bytes() {
    let f = Fixture::new().await;
    let read = f.read("read-metadata");
    let admitted = f.admit(read.clone()).await;
    assert!(admitted.upload.is_none());
    let request = f.claim(admitted.intent_id).await;
    let valid = ResourceReply {
        status: 200,
        content_type: "application/octet-stream".into(),
        body: String::new(),
        receipt: json!({"source":"catalog","sha256":"b".repeat(64),"size":128*1024,"snapshot":read.input}),
    };
    let mut invalid = Vec::new();
    for (field, value) in [
        ("source", json!("unverified-report")),
        ("sha256", json!("B".repeat(64))),
        ("size", json!(MAX_FILE_BYTES + 1)),
        ("snapshot", json!({"path":"different.bin"})),
    ] {
        let mut reply = valid.clone();
        reply.receipt[field] = value;
        invalid.push(reply);
    }
    let mut with_body = valid.clone();
    with_body.body = "bytes-must-not-enter-core-records".into();
    invalid.push(with_body);
    let mut with_text = valid.clone();
    with_text.content_type = "text/plain".into();
    invalid.push(with_text);
    let before = f.snapshot().await;
    for reply in invalid {
        assert!(matches!(
            f.core
                .resource_complete(admitted.intent_id, WORKER, reply)
                .await,
            Err(Error::Invalid)
        ));
        assert_eq!(f.snapshot().await, before);
    }
    f.core
        .resource_complete(admitted.intent_id, WORKER, valid.clone())
        .await
        .unwrap();
    f.core
        .resource_live(admitted.intent_id, WORKER, &request)
        .await
        .unwrap();
    f.core
        .resource_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
        .await
        .unwrap();
    let completed = f.snapshot().await;
    f.core
        .resource_complete(admitted.intent_id, WORKER, valid.clone())
        .await
        .unwrap();
    assert_eq!(
        f.snapshot().await,
        completed,
        "repeated metadata completion is not a new event or attempt"
    );
    let stored: Value =
        sqlx::query_scalar("SELECT reply FROM resource_calls WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(admitted.intent_id)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(stored, json!(valid));
    assert_eq!(stored["body"], "");
    f.change("UPDATE resource_transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE firm_id=$1").await;
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    f.deny_transfer_access(admitted.intent_id).await;
    let history = f
        .core
        .resource_lookup(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(history.state, "succeeded");
    assert_eq!(history.reply.unwrap(), valid);
    f.change(
        "UPDATE resource_scopes SET operations=array_remove(operations,'inspect') WHERE firm_id=$1",
    )
    .await;
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_lookup(
                f.actor(),
                admitted.intent_id,
                Some(f.work),
                Some(f.inspector)
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "historical metadata still requires current inspect scope"
    );
}

#[tokio::test]
async fn dispatched_upload_receipt_remains_recordable_after_revocation_and_expiry() {
    let f = Fixture::new().await;
    let admitted = f
        .admit(f.upload("catalog", "receipt-after-revoke", 80 * 1024))
        .await;
    let request = f.claim(admitted.intent_id).await;
    f.change("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND 'file.upload'=ANY(actions)")
        .await;
    f.change("UPDATE resource_transfers SET expires_at=clock_timestamp()-interval '1 second' WHERE firm_id=$1").await;
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    // This is a synthetic worker receipt for Core history behavior, not proof of physical bytes.
    let receipt = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":"a".repeat(64)}).to_string(),
        receipt: json!({"source":"catalog","upload_receipt":admitted.intent_id,"sha256":"a".repeat(64),"size":80*1024}),
    };
    f.core
        .resource_complete(admitted.intent_id, WORKER, receipt.clone())
        .await
        .unwrap();
    let history = f
        .core
        .resource_lookup(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(history.state, "succeeded");
    assert_eq!(history.reply.unwrap(), receipt);
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    let allocation: (i64, bool) = sqlx::query_as("SELECT s.bytes,r.settled FROM storage_allocations s JOIN reservations r USING(firm_id,intent_id) WHERE s.firm_id=$1 AND s.intent_id=$2")
        .bind(f.core.firm).bind(admitted.intent_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(allocation, (80 * 1024, false));
}

#[tokio::test]
async fn fresh_upload_completion_binds_declared_content_and_one_object_identity() {
    let f = Fixture::new().await;
    let size = 96 * 1024;
    let digest = "a".repeat(64);
    let object = Uuid::new_v4();
    let admitted = f
        .admit(f.upload("catalog", "exact-upload-completion", size))
        .await;
    let live = f.claim(admitted.intent_id).await;
    let valid = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":digest,"object_id":object}).to_string(),
        receipt: json!({"source":"catalog","upload_receipt":admitted.intent_id,"sha256":digest,"size":size,"object_id":object}),
    };
    let mut invalid = Vec::new();
    for (field, value) in [
        ("source", json!("unverified-report")),
        ("upload_receipt", json!(Uuid::new_v4())),
        ("sha256", json!("b".repeat(64))),
        ("size", json!(size - 1)),
        ("size", json!(size.to_string())),
        ("object_id", json!(Uuid::new_v4())),
        ("object_id", json!(Uuid::nil())),
        ("object_id", json!("invalid UUID")),
        ("object_id", Value::Null),
    ] {
        let mut wrong = valid.clone();
        wrong.receipt[field] = value;
        invalid.push(wrong);
    }
    for body in [
        "{".into(),
        json!({"intent_id":Uuid::new_v4(),"upload_id":admitted.intent_id,"sha256":digest,"object_id":object}).to_string(),
        json!({"intent_id":admitted.intent_id,"upload_id":Uuid::new_v4(),"sha256":digest,"object_id":object}).to_string(),
        json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":digest,"object_id":Uuid::new_v4()}).to_string(),
        json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":digest}).to_string(),
    ] {
        let mut wrong = valid.clone();
        wrong.body = body;
        invalid.push(wrong);
    }
    let mut wrong_content = valid.clone();
    wrong_content.body = json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":"b".repeat(64),"object_id":object}).to_string();
    wrong_content.receipt["sha256"] = json!("b".repeat(64));
    invalid.push(wrong_content);
    let mut wrong_type = valid.clone();
    wrong_type.content_type = "text/plain".into();
    invalid.push(wrong_type);
    let mut extra = valid.clone();
    extra.receipt["retired"] = json!(true);
    invalid.push(extra);
    let before = f.snapshot().await;
    for wrong in invalid {
        assert!(matches!(
            f.core
                .resource_complete(admitted.intent_id, WORKER, wrong)
                .await,
            Err(Error::Invalid)
        ));
        assert_eq!(
            f.snapshot().await,
            before,
            "invalid completion cannot set success, completion time, object identity or settle capacity"
        );
    }
    f.core
        .resource_live(admitted.intent_id, WORKER, &live)
        .await
        .unwrap();
    f.core
        .resource_complete(admitted.intent_id, WORKER, valid.clone())
        .await
        .unwrap();
    let completed = f.snapshot().await;
    f.core
        .resource_complete(admitted.intent_id, WORKER, valid.clone())
        .await
        .unwrap();
    assert_eq!(f.snapshot().await, completed);
    let historical = f
        .core
        .resource_lookup(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(historical.state, "succeeded");
    assert_eq!(historical.reply.unwrap(), valid);
    let replacement = Uuid::new_v4();
    let mut rewritten = valid;
    let mut body: Value = serde_json::from_str(&rewritten.body).unwrap();
    body["object_id"] = json!(replacement);
    rewritten.body = body.to_string();
    rewritten.receipt["object_id"] = json!(replacement);
    assert!(
        matches!(
            f.core
                .resource_complete(admitted.intent_id, WORKER, rewritten)
                .await,
            Err(Error::Conflict)
        ),
        "a coherent new UUID cannot replace a committed object's lifetime"
    );
    assert_eq!(f.snapshot().await, completed);
}

#[tokio::test]
async fn legacy_malformed_upload_history_is_observed_without_recertifying_or_rewriting_it() {
    let f = Fixture::new().await;
    let admitted = f.admit(f.upload("catalog", "historical-upload", 7)).await;
    f.claim(admitted.intent_id).await;
    let canonical = ResourceReply {
        status:200,content_type:"application/json".into(),
        body:json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":"a".repeat(64)}).to_string(),
        receipt:json!({"source":"catalog","upload_receipt":admitted.intent_id,"sha256":"a".repeat(64),"size":7}),
    };
    f.core
        .resource_complete(admitted.intent_id, WORKER, canonical.clone())
        .await
        .unwrap();
    // Represent a historical record predating strict completion. This deliberate
    // fixture edit is not a product repair API or a newly accepted worker result.
    let historical = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: "{}".into(),
        receipt: json!({"source":"catalog","upload_receipt":admitted.intent_id,"sha256":"a".repeat(64)}),
    };
    sqlx::query(
        "UPDATE resource_calls SET reply=$3,completed_at=NULL WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(f.core.firm)
    .bind(admitted.intent_id)
    .bind(json!(historical))
    .execute(&f.pool)
    .await
    .unwrap();
    let before = f.snapshot().await;
    let observed = f
        .core
        .resource_lookup(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(observed.reply.unwrap(), historical);
    f.core
        .resource_complete(admitted.intent_id, WORKER, historical)
        .await
        .unwrap();
    assert_eq!(
        f.snapshot().await,
        before,
        "exact historical replay is not renewed completion evidence"
    );
    assert!(matches!(
        f.core
            .resource_complete(admitted.intent_id, WORKER, canonical)
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "a canonical replacement cannot silently rewrite old history"
    );
}

#[tokio::test]
async fn another_valid_certificate_for_same_human_cannot_take_over_a_transfer() {
    let f = Fixture::new().await;
    let second = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    // Two independently registered, valid certificates deliberately map to the same human.
    sqlx::query("INSERT INTO credentials(fingerprint,firm_id,principal_id,enabled,expires_at) SELECT $2,firm_id,principal_id,true,clock_timestamp()+interval '1 hour' FROM credentials WHERE fingerprint=$1")
        .bind(&f.caller.fingerprint).bind(&second.fingerprint).execute(&f.pool).await.unwrap();
    let input = f.upload("catalog", "certificate-bound", 96 * 1024);
    let admitted = f.admit(input.clone()).await;
    let before = f.snapshot().await;
    let history = f
        .core
        .resource_lookup(
            ResourceActor::Human(second.clone()),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(
        history.intent_id, admitted.intent_id,
        "historical inspect uses current human scope"
    );
    assert!(matches!(
        f.core
            .resource_upload_ready(
                ResourceActor::Human(second.clone()),
                admitted.intent_id,
                Some(f.work),
                Some(f.grant),
                &"a".repeat(64),
                96 * 1024
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_transfer_access(
                ResourceActor::Human(second.clone()),
                admitted.intent_id,
                Some(f.work),
                Some(f.grant)
            )
            .await,
        Err(Error::Denied)
    ));
    f.core
        .resource_upload_ready(
            f.actor(),
            admitted.intent_id,
            Some(f.work),
            Some(f.grant),
            &"a".repeat(64),
            96 * 1024,
        )
        .await
        .unwrap();
    f.core
        .resource_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
        .await
        .unwrap();
    assert_eq!(f.snapshot().await, before);
    let request = f.claim(admitted.intent_id).await;
    sqlx::query("UPDATE credentials SET enabled=false WHERE fingerprint=$1")
        .bind(&f.caller.fingerprint)
        .execute(&f.pool)
        .await
        .unwrap();
    f.deny_live_without_effect(admitted.intent_id, WORKER, &request)
        .await;
    f.deny_transfer_access(admitted.intent_id).await;
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_transfer_access(
                ResourceActor::Human(second.clone()),
                admitted.intent_id,
                Some(f.work),
                Some(f.grant)
            )
            .await,
        Err(Error::Denied)
    ));
    let history = f
        .core
        .resource_lookup(
            ResourceActor::Human(second.clone()),
            admitted.intent_id,
            Some(f.work),
            Some(f.inspector),
        )
        .await
        .unwrap();
    assert_eq!(history.state, "claimed");
    let replay = f
        .core
        .resource_admit(ResourceActor::Human(second), input)
        .await
        .unwrap();
    assert_eq!(replay.intent_id, admitted.intent_id);
    assert_eq!(replay.state, "claimed");
    assert_eq!(
        f.snapshot().await,
        before,
        "new certificate can inspect but cannot renew old transfer authority"
    );
}

#[tokio::test]
async fn claimed_model_live_check_preserves_attempt_and_revocation_boundary() {
    let f = Fixture::new().await;
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['model.responses'] WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.grant).execute(&f.pool).await.unwrap();
    sqlx::query(
        "INSERT INTO resource_targets VALUES($1,'provider',$2,true,'{\"timeout_ms\":2000}',65536)",
    )
    .bind(f.core.firm)
    .bind(WORKER)
    .execute(&f.pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO resource_scopes VALUES($1,$2,$3,'provider',ARRAY['model.responses'])")
        .bind(f.core.firm)
        .bind(f.work)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    let admitted = f
        .admit(f.request(
            "model.responses",
            "provider",
            "provider-live",
            json!({"model":"synthetic","input":"test"}),
        ))
        .await;
    let ticket = f
        .core
        .resource_claim(admitted.intent_id, WORKER, None)
        .await
        .unwrap();
    let observation = f
        .core
        .provider_receipt_recovery(admitted.intent_id, WORKER)
        .await
        .unwrap();
    assert_eq!(observation, ticket.provider_recovery_selector().unwrap());
    assert!(
        f.core
            .provider_receipt_recovery(admitted.intent_id, "wrong-worker")
            .await
            .is_err()
    );
    let live = ResourceLiveRequest {
        attempt_id: ticket.attempt_id,
        storage: None,
    };
    f.core
        .model_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
        .await
        .unwrap();
    let before = f.snapshot().await;
    f.core
        .resource_live(admitted.intent_id, WORKER, &live)
        .await
        .unwrap();
    assert_eq!(f.snapshot().await, before);
    assert!(
        f.core
            .resource_live(admitted.intent_id, "wrong-worker", &live)
            .await
            .is_err()
    );
    assert!(
        f.core
            .resource_live(
                admitted.intent_id,
                WORKER,
                &ResourceLiveRequest {
                    attempt_id: Uuid::new_v4(),
                    storage: None
                }
            )
            .await
            .is_err()
    );
    assert!(
        f.core
            .resource_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
            .await
            .is_err()
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(
        f.core
            .resource_live(admitted.intent_id, WORKER, &live)
            .await
            .is_err()
    );
    assert!(
        f.core
            .model_transfer_access(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
            .await
            .is_err()
    );
    let before = f.snapshot().await;
    assert_eq!(
        f.core
            .provider_receipt_recovery(admitted.intent_id, WORKER)
            .await
            .unwrap(),
        observation
    );
    assert_eq!(f.snapshot().await, before);
}
