//! Real-PostgreSQL tests of namespace allocation and current Core authority.
//! All principals, grants and namespace capacity below are explicit trusted fixtures.
//! Worker receipts are synthetic: these tests do not prove catalog effects, byte
//! transport, kernel identity, or a private agent's ability to enroll new authority.
use ouroboros_contracts::{
    CollectionAdvanceRequest, CollectionBinding, CollectionRecord, CollectionRequest,
    ReceiptSelector, ResourceAdmission, ResourceReply, ResourceRequest, RetirementPolicy,
    RetirementRecord, RetirementRequest, RetirementTarget, StorageClaim, WorkspaceQuery,
};
use ouroboros_core::{Caller, Core, Error, ResourceActor};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::collections::BTreeSet;
use uuid::Uuid;

const TARGET: &str = "company-files";
const OTHER_TARGET: &str = "other-files";
const WORKER: &str = "workspace-worker";
const OPERATIONS: &[&str] = &[
    "inspect",
    "workspace.create",
    "file.read",
    "file.upload",
    "file.publish",
];

struct Fixture {
    core: Core,
    pool: PgPool,
    caller: Caller,
    observer: Caller,
    work: Uuid,
    other_work: Uuid,
    parent: Uuid,
    grant: Uuid,
    inspector: Uuid,
    observer_grant: Uuid,
    namespace: Uuid,
    other_namespace: Uuid,
    storage: StorageClaim,
    configuration: Value,
}

impl Fixture {
    async fn new(capacity: i64) -> Self {
        let file = std::env::var("OURO_TEST_DATABASE_URL_FILE")
            .expect("explicit disposable database URL file required");
        let url = std::fs::read_to_string(file).unwrap();
        let pool = PgPool::connect(url.trim()).await.unwrap();
        Core::migrate(&pool).await.unwrap();
        let firm = Uuid::new_v4();
        let principal = Uuid::new_v4();
        let observer_principal = Uuid::new_v4();
        let work = Uuid::new_v4();
        let other_work = Uuid::new_v4();
        let parent = Uuid::new_v4();
        let grant = Uuid::new_v4();
        let inspector = Uuid::new_v4();
        let observer_grant = Uuid::new_v4();
        let namespace = Uuid::new_v4();
        let other_namespace = Uuid::new_v4();
        let fingerprint = || format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let caller = Caller {
            fingerprint: fingerprint(),
        };
        let observer = Caller {
            fingerprint: fingerprint(),
        };
        let storage = StorageClaim {
            firm_id: firm,
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
        };
        let configuration = json!({
            "namespace_id":namespace,
            "store_id":storage.store_id,
            "storage_generation":storage.generation,
            "max_file_bytes":1_048_576,
            "transfer_seconds":120,
        });
        sqlx::query("INSERT INTO firms(id) VALUES($1)")
            .bind(firm)
            .execute(&pool)
            .await
            .unwrap();
        for (id, credential) in [(principal, &caller), (observer_principal, &observer)] {
            sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
                .bind(firm)
                .bind(id)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query(
                "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
            )
            .bind(&credential.fingerprint)
            .bind(firm)
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        }
        for (id, owner, ancestor, actions) in [
            (parent, principal, None, OPERATIONS),
            (grant, principal, Some(parent), OPERATIONS),
            (inspector, principal, None, &["inspect"][..]),
            (observer_grant, observer_principal, None, &["inspect"][..]),
        ] {
            sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour')")
                .bind(firm).bind(id).bind(owner).bind(ancestor).bind(actions)
                .execute(&pool).await.unwrap();
        }
        for id in [work, other_work] {
            sqlx::query("INSERT INTO work(firm_id,id,principal_id,delegation_id,purpose) VALUES($1,$2,$3,$4,'workspace authority fixture')")
                .bind(firm).bind(id).bind(principal).bind(grant).execute(&pool).await.unwrap();
            sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
                .bind(firm)
                .bind(id)
                .bind(principal)
                .execute(&pool)
                .await
                .unwrap();
        }
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(firm)
            .bind(work)
            .bind(observer_principal)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
            .bind(firm)
            .bind(observer_grant)
            .bind(work)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO limits VALUES($1,'resource_calls',512,0)")
            .bind(firm)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO storage_budgets VALUES($1,$2,$3,8388608,0)")
            .bind(firm)
            .bind(storage.store_id)
            .bind(storage.generation)
            .execute(&pool)
            .await
            .unwrap();
        for (target, ns) in [(TARGET, namespace), (OTHER_TARGET, other_namespace)] {
            let mut cfg = configuration.clone();
            cfg["namespace_id"] = json!(ns);
            sqlx::query("INSERT INTO resource_targets VALUES($1,$2,$3,true,$4,65536)")
                .bind(firm)
                .bind(target)
                .bind(WORKER)
                .bind(cfg)
                .execute(&pool)
                .await
                .unwrap();
            sqlx::query("INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(firm).bind(ns).bind(target).bind(storage.store_id).bind(storage.generation).bind(capacity)
                .execute(&pool).await.unwrap();
            for w in [work, other_work] {
                for (d, ops) in [
                    (parent, OPERATIONS),
                    (grant, OPERATIONS),
                    (inspector, &["inspect"][..]),
                ] {
                    sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES($1,$2,$3,$4,$5,$6)")
                        .bind(firm).bind(w).bind(d).bind(target).bind(ops).bind(ns).execute(&pool).await.unwrap();
                }
            }
        }
        // Old catalog rights explicitly remain namespace-less, even when their
        // operation array contains workspace.create. No implicit upgrade is allowed.
        let mut legacy = configuration.clone();
        legacy.as_object_mut().unwrap().remove("namespace_id");
        legacy["workspace_id"] = json!(Uuid::new_v4());
        sqlx::query("INSERT INTO resource_targets VALUES($1,'catalog',$2,true,$3,65536)")
            .bind(firm)
            .bind(WORKER)
            .bind(legacy)
            .execute(&pool)
            .await
            .unwrap();
        for d in [parent, grant] {
            sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES($1,$2,$3,'catalog',$4,NULL)")
                .bind(firm).bind(work).bind(d).bind(OPERATIONS).execute(&pool).await.unwrap();
        }
        Self {
            core: Core::new(pool.clone(), firm),
            pool,
            caller,
            observer,
            work,
            other_work,
            parent,
            grant,
            inspector,
            observer_grant,
            namespace,
            other_namespace,
            storage,
            configuration,
        }
    }

    fn actor(&self) -> ResourceActor {
        ResourceActor::Human(self.caller.clone())
    }

    fn request(
        &self,
        target: &str,
        work: Uuid,
        operation: &str,
        key: &str,
        input: Value,
    ) -> ResourceRequest {
        ResourceRequest {
            target: target.into(),
            operation: operation.into(),
            request_key: key.into(),
            input,
            work_id: Some(work),
            delegation_id: Some(self.grant),
        }
    }

    fn query(&self, target: &str, work: Uuid, grant: Uuid) -> WorkspaceQuery {
        WorkspaceQuery {
            target_id: target.into(),
            work_id: Some(work),
            delegation_id: Some(grant),
            cursor: None,
        }
    }

    async fn create(&self, target: &str, work: Uuid, key: &str, label: &str) -> ResourceAdmission {
        self.core
            .resource_admit(
                self.actor(),
                self.request(
                    target,
                    work,
                    "workspace.create",
                    key,
                    json!({"label":label}),
                ),
            )
            .await
            .unwrap()
    }

    fn creation_reply(
        &self,
        admission: &ResourceAdmission,
        work: Uuid,
        label: &str,
    ) -> ResourceReply {
        let binding = admission.workspace.as_ref().unwrap();
        ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!({"intent_id":admission.intent_id,"workspace_id":binding.workspace_id,
                "namespace_id":binding.namespace_id,"work_id":work,"label":label,"revision":0})
            .to_string(),
            receipt: json!({"source":"catalog","workspace_creation_receipt":admission.intent_id,
                "workspace_id":binding.workspace_id,"namespace_id":binding.namespace_id,
                "work_id":work,"label":label,"revision":0}),
        }
    }

    async fn activate(
        &self,
        target: &str,
        work: Uuid,
        key: &str,
        label: &str,
    ) -> ResourceAdmission {
        let admission = self.create(target, work, key, label).await;
        let ticket = self
            .core
            .resource_claim(admission.intent_id, WORKER, Some(&self.storage))
            .await
            .unwrap();
        assert_eq!(ticket.workspace, admission.workspace);
        self.core
            .resource_complete(
                admission.intent_id,
                WORKER,
                self.creation_reply(&admission, work, label),
            )
            .await
            .unwrap();
        admission
    }

    async fn scope(&self, work: Uuid, grant: Uuid, ns: Option<Uuid>) {
        sqlx::query("UPDATE resource_scopes SET namespace_id=$5 WHERE firm_id=$1 AND work_id=$2 AND delegation_id=$3 AND target_id=$4")
            .bind(self.core.firm).bind(work).bind(grant).bind(TARGET).bind(ns).execute(&self.pool).await.unwrap();
    }

    async fn configure(&self, configuration: &Value) {
        sqlx::query("UPDATE resource_targets SET configuration=$3 WHERE firm_id=$1 AND id=$2")
            .bind(self.core.firm)
            .bind(TARGET)
            .bind(configuration)
            .execute(&self.pool)
            .await
            .unwrap();
    }

    async fn effect_snapshot(&self) -> Value {
        sqlx::query_scalar("SELECT jsonb_build_object('namespaces',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM workspace_namespaces n WHERE firm_id=$1),'workspaces',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM workspace_allocations w WHERE firm_id=$1),'intents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM intents i WHERE firm_id=$1),'calls',(SELECT jsonb_agg(to_jsonb(c) ORDER BY intent_id) FROM resource_calls c WHERE firm_id=$1),'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM attempts a WHERE firm_id=$1),'limits',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM limits l WHERE firm_id=$1),'reservations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id,limit_id) FROM reservations r WHERE firm_id=$1),'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY intent_id) FROM outbox o WHERE firm_id=$1),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM events e WHERE firm_id=$1),'bytes',(SELECT jsonb_agg(to_jsonb(b) ORDER BY store_id,generation) FROM storage_budgets b WHERE firm_id=$1),'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY intent_id) FROM storage_allocations a WHERE firm_id=$1),'transfers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY intent_id) FROM resource_transfers t WHERE firm_id=$1),'retirements',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id) FROM resource_retirements r WHERE firm_id=$1),'workspace_releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY workspace_id) FROM workspace_releases r WHERE firm_id=$1),'collections',(SELECT jsonb_agg(to_jsonb(c) ORDER BY intent_id) FROM resource_collections c WHERE firm_id=$1),'collection_steps',(SELECT jsonb_agg(to_jsonb(s) ORDER BY collection_intent_id,sequence) FROM collection_steps s WHERE firm_id=$1),'storage_releases',(SELECT jsonb_agg(to_jsonb(r) ORDER BY upload_intent_id) FROM storage_releases r WHERE firm_id=$1))")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap()
    }

    async fn authority_snapshot(&self) -> Value {
        sqlx::query_scalar("SELECT jsonb_build_object('principals',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM principals p WHERE firm_id=$1),'credentials',(SELECT jsonb_agg(to_jsonb(c) ORDER BY fingerprint) FROM credentials c WHERE firm_id=$1),'delegations',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM delegations d WHERE firm_id=$1),'scopes',(SELECT jsonb_agg(to_jsonb(s) ORDER BY work_id,delegation_id,target_id) FROM resource_scopes s WHERE firm_id=$1),'controls',(SELECT jsonb_agg(to_jsonb(c) ORDER BY root_work_id,principal_id) FROM work_controls c WHERE firm_id=$1),'targets',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM resource_targets t WHERE firm_id=$1))")
            .bind(self.core.firm).fetch_one(&self.pool).await.unwrap()
    }

    async fn denied_unchanged(&self, request: ResourceRequest) {
        let before = self.effect_snapshot().await;
        assert!(matches!(
            self.core.resource_admit(self.actor(), request).await,
            Err(Error::Denied)
        ));
        assert_eq!(
            self.effect_snapshot().await,
            before,
            "denial must not allocate, dispatch or settle anything"
        );
    }

    /// Explicit trusted enrollment only for retirement tests. Existing workspace
    /// tests retain their original capabilities and have no retirement policy.
    async fn enable_retirement(&mut self, minimum_age: u64) -> RetirementPolicy {
        let policy = RetirementPolicy {
            id: Uuid::new_v4(),
            revision: 1,
            min_retention_seconds: minimum_age,
            allowed: vec![
                "upload".into(),
                "revision".into(),
                "workspace_close".into(),
                "collect".into(),
            ],
        };
        self.configuration["retirement_policy"] = json!(policy);
        for (target, namespace) in [
            (TARGET, self.namespace),
            (OTHER_TARGET, self.other_namespace),
        ] {
            let mut configuration = self.configuration.clone();
            configuration["namespace_id"] = json!(namespace);
            sqlx::query("UPDATE resource_targets SET configuration=$3 WHERE firm_id=$1 AND id=$2")
                .bind(self.core.firm)
                .bind(target)
                .bind(configuration)
                .execute(&self.pool)
                .await
                .unwrap();
        }
        sqlx::query("UPDATE delegations SET actions=array_append(actions,'file.retire') WHERE firm_id=$1 AND id=ANY($2) AND NOT 'file.retire'=ANY(actions)")
            .bind(self.core.firm).bind(vec![self.parent,self.grant]).execute(&self.pool).await.unwrap();
        sqlx::query("UPDATE resource_scopes SET operations=array_append(operations,'file.retire') WHERE firm_id=$1 AND delegation_id=ANY($2) AND target_id=ANY($3) AND NOT 'file.retire'=ANY(operations)")
            .bind(self.core.firm).bind(vec![self.parent,self.grant]).bind(vec![TARGET,OTHER_TARGET])
            .execute(&self.pool).await.unwrap();
        policy
    }

    fn retirement_request(
        &self,
        resource_target: &str,
        work: Uuid,
        key: &str,
        target: RetirementTarget,
        policy: &RetirementPolicy,
    ) -> ResourceRequest {
        self.request(
            resource_target,
            work,
            "file.retire",
            key,
            json!(RetirementRequest {
                target,
                reason: "explicit fixture retention decision".into(),
                policy_id: policy.id,
                policy_revision: policy.revision,
            }),
        )
    }

    fn retirement_reply(
        intent: Uuid,
        request: &ResourceRequest,
        disposition: &str,
    ) -> ResourceReply {
        let input: RetirementRequest = serde_json::from_value(request.input.clone()).unwrap();
        let record = RetirementRecord {
            intent_id: intent,
            target: input.target,
            policy_id: input.policy_id,
            policy_revision: input.policy_revision,
            disposition: disposition.into(),
        };
        ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: serde_json::to_string(&record).unwrap(),
            receipt: json!({"source":"catalog","retirement_receipt":intent,"record":record}),
        }
    }

    async fn retained_upload(&self, target: &str, work: Uuid, key: &str) -> ResourceAdmission {
        let digest = "b".repeat(64);
        let object = Uuid::new_v4();
        let admitted = self
            .core
            .resource_admit(
                self.actor(),
                self.request(
                    target,
                    work,
                    "file.upload",
                    key,
                    json!({"sha256":digest,"size":70}),
                ),
            )
            .await
            .unwrap();
        self.core
            .resource_upload_ready(
                self.actor(),
                admitted.intent_id,
                Some(work),
                Some(self.grant),
                &digest,
                70,
            )
            .await
            .unwrap();
        self.core
            .resource_claim(admitted.intent_id, WORKER, Some(&self.storage))
            .await
            .unwrap();
        // Synthetic Catalog observation with an explicit immutable object lifetime.
        self.core.resource_complete(admitted.intent_id,WORKER,ResourceReply {
            status:200,content_type:"application/json".into(),
            body:json!({"intent_id":admitted.intent_id,"upload_id":admitted.intent_id,"sha256":digest,"object_id":object}).to_string(),
            receipt:json!({"source":"catalog","upload_receipt":admitted.intent_id,"sha256":digest,"size":70,"object_id":object}),
        }).await.unwrap();
        admitted
    }

    async fn retained_publication(
        &self,
        workspace: Uuid,
        expected_revision: i64,
        upload: Uuid,
        key: &str,
    ) -> ResourceAdmission {
        let admitted = self.core.resource_admit(self.actor(),self.request(TARGET,self.work,"file.publish",key,
            json!({"workspace_id":workspace,"expected_revision":expected_revision,"files":{"result.bin":upload}})))
            .await.unwrap();
        self.core
            .resource_claim(admitted.intent_id, WORKER, Some(&self.storage))
            .await
            .unwrap();
        self.core.resource_complete(admitted.intent_id,WORKER,ResourceReply {
            status:200,content_type:"application/json".into(),
            body:json!({"intent_id":admitted.intent_id,"revision":expected_revision+1}).to_string(),
            receipt:json!({"source":"catalog","publication_receipt":admitted.intent_id,"revision":expected_revision+1}),
        }).await.unwrap();
        admitted
    }

    async fn enable_collection(&mut self) -> RetirementPolicy {
        let policy = self.enable_retirement(0).await;
        sqlx::query("UPDATE delegations SET actions=array_append(actions,'file.collect') WHERE firm_id=$1 AND id=ANY($2) AND NOT 'file.collect'=ANY(actions)")
            .bind(self.core.firm).bind(vec![self.parent,self.grant]).execute(&self.pool).await.unwrap();
        sqlx::query("UPDATE resource_scopes SET operations=array_append(operations,'file.collect') WHERE firm_id=$1 AND delegation_id=ANY($2) AND target_id=ANY($3) AND NOT 'file.collect'=ANY(operations)")
            .bind(self.core.firm).bind(vec![self.parent,self.grant]).bind(vec![TARGET,OTHER_TARGET])
            .execute(&self.pool).await.unwrap();
        policy
    }

    fn collection_request(
        &self,
        upload: Uuid,
        key: &str,
        policy: &RetirementPolicy,
    ) -> ResourceRequest {
        self.request(
            TARGET,
            self.work,
            "file.collect",
            key,
            json!(CollectionRequest {
                upload_id: upload,
                reason: "explicit fixture object collection".into(),
                policy_id: policy.id,
                policy_revision: policy.revision,
            }),
        )
    }

    fn collection_step(&self, key: &str, grant: Uuid) -> CollectionAdvanceRequest {
        CollectionAdvanceRequest {
            request_key: key.into(),
            work_id: Some(self.work),
            delegation_id: Some(grant),
        }
    }

    async fn retired_collection_source(
        &self,
        key: &str,
        policy: &RetirementPolicy,
    ) -> CollectionBinding {
        let upload = self
            .retained_upload(TARGET, self.work, &format!("{key}-upload"))
            .await;
        let request = self.retirement_request(
            TARGET,
            self.work,
            &format!("{key}-retire"),
            RetirementTarget::Upload {
                upload_id: upload.intent_id,
            },
            policy,
        );
        let admitted = self
            .core
            .resource_admit(self.actor(), request.clone())
            .await
            .unwrap();
        self.core
            .resource_claim(admitted.intent_id, WORKER, Some(&self.storage))
            .await
            .unwrap();
        self.core
            .resource_complete(
                admitted.intent_id,
                WORKER,
                Self::retirement_reply(admitted.intent_id, &request, "upload_retired"),
            )
            .await
            .unwrap();
        let upload = self
            .core
            .resource_lookup(
                self.actor(),
                upload.intent_id,
                Some(self.work),
                Some(self.inspector),
            )
            .await
            .unwrap();
        let receipt = upload.reply.unwrap().receipt;
        CollectionBinding {
            upload_id: upload.intent_id,
            object_id: Uuid::parse_str(receipt["object_id"].as_str().unwrap()).unwrap(),
            store_id: self.storage.store_id,
            generation: self.storage.generation,
            sha256: receipt["sha256"].as_str().unwrap().to_owned(),
            size: receipt["size"].as_u64().unwrap(),
        }
    }

    fn collection_reply(
        intent: Uuid,
        binding: &CollectionBinding,
        policy: &RetirementPolicy,
        confirmation: &str,
    ) -> ResourceReply {
        let record = CollectionRecord {
            intent_id: intent,
            binding: binding.clone(),
            policy_id: policy.id,
            policy_revision: policy.revision,
            confirmation: confirmation.into(),
        };
        ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!(record).to_string(),
            receipt: json!({"source":"catalog","collection_receipt":intent,"record":record}),
        }
    }
}

#[tokio::test]
async fn creation_assigns_one_stable_binding_without_minting_authority() {
    let f = Fixture::new(8).await;
    let authority = f.authority_snapshot().await;
    let admission = f
        .create(TARGET, f.work, "stable-create", "research inputs")
        .await;
    assert_eq!(admission.state, "accepted");
    assert!(admission.reply.is_none());
    assert_eq!(
        admission.workspace.as_ref().unwrap().namespace_id,
        f.namespace
    );
    let before = f.effect_snapshot().await;
    let replay = f
        .create(TARGET, f.work, "stable-create", "research inputs")
        .await;
    assert_eq!(replay.intent_id, admission.intent_id);
    assert_eq!(replay.workspace, admission.workspace);
    assert_eq!(f.effect_snapshot().await, before);
    assert!(matches!(
        f.core
            .resource_admit(
                f.actor(),
                f.request(
                    TARGET,
                    f.work,
                    "workspace.create",
                    "stable-create",
                    json!({"label":"different"})
                )
            )
            .await,
        Err(Error::Conflict)
    ));
    for input in [
        json!({"label":"client id","workspace_id":Uuid::new_v4()}),
        json!({"label":"client scope","namespace_id":f.namespace}),
        json!({"label":"bad ",}),
        json!({"label":""}),
        json!({"label":"a\nb"}),
        json!({"label":"x".repeat(129)}),
    ] {
        assert!(matches!(
            f.core
                .resource_admit(
                    f.actor(),
                    f.request(TARGET, f.work, "workspace.create", "invalid-create", input)
                )
                .await,
            Err(Error::Invalid)
        ));
    }
    assert_eq!(f.effect_snapshot().await, before);
    let ticket = f
        .core
        .resource_claim(admission.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    assert_eq!(ticket.workspace, admission.workspace);
    assert_eq!(ticket.work_id, f.work);
    let reply = f.creation_reply(&admission, f.work, "research inputs");
    f.core
        .resource_complete(admission.intent_id, WORKER, reply.clone())
        .await
        .unwrap();
    let completed = f.effect_snapshot().await;
    f.core
        .resource_complete(admission.intent_id, WORKER, reply)
        .await
        .unwrap();
    assert_eq!(f.effect_snapshot().await, completed);
    let row = f
        .core
        .read_workspace(
            f.actor(),
            admission.workspace.unwrap().workspace_id,
            f.query(TARGET, f.work, f.grant),
        )
        .await
        .unwrap();
    assert_eq!(row["state"], "active");
    assert_eq!(
        f.authority_snapshot().await,
        authority,
        "workspace creation allocates only within prior rights"
    );
}

#[tokio::test]
async fn concurrent_namespace_capacity_is_kept_across_claim_and_unknown_result() {
    let f = Fixture::new(1).await;
    let authority = f.authority_snapshot().await;
    let a = f.request(
        TARGET,
        f.work,
        "workspace.create",
        "race-a",
        json!({"label":"a"}),
    );
    let b = f.request(
        TARGET,
        f.work,
        "workspace.create",
        "race-b",
        json!({"label":"b"}),
    );
    let (a_result, b_result) = tokio::join!(
        f.core.resource_admit(f.actor(), a.clone()),
        f.core.resource_admit(f.actor(), b.clone())
    );
    let (won, request) = match (a_result, b_result) {
        (Ok(won), Err(Error::Capacity)) => (won, a),
        (Err(Error::Capacity), Ok(won)) => (won, b),
        (a, b) => panic!("capacity one must admit exactly one allocation: {a:?}, {b:?}"),
    };
    let counts:(i64,i64,i64,i64) = sqlx::query_as("SELECT (SELECT allocated FROM workspace_namespaces WHERE firm_id=$1 AND id=$2),(SELECT count(*) FROM workspace_allocations WHERE firm_id=$1),(SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1),(SELECT count(*) FROM reservations WHERE firm_id=$1 AND NOT settled)")
        .bind(f.core.firm).bind(f.namespace).fetch_one(&f.pool).await.unwrap();
    assert_eq!(counts, (1, 1, 0, 1));
    let before = f.effect_snapshot().await;
    let replay = f
        .core
        .resource_admit(f.actor(), request.clone())
        .await
        .unwrap();
    assert_eq!(replay.workspace, won.workspace);
    assert_eq!(f.effect_snapshot().await, before);
    f.core
        .resource_claim(won.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    // There is no completion: the worker may have created the catalog record.
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_admit(
                f.actor(),
                f.request(
                    TARGET,
                    f.work,
                    "workspace.create",
                    "still-full",
                    json!({"label":"third"})
                )
            )
            .await,
        Err(Error::Capacity)
    ));
    f.core
        .resource_receipt_recovery(won.intent_id, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "unknown effect is not free capacity"
    );
    let other = f
        .create(OTHER_TARGET, f.work, "other-namespace", "separate count")
        .await;
    assert_eq!(other.workspace.unwrap().namespace_id, f.other_namespace);
    assert_eq!(f.authority_snapshot().await, authority);
}

#[tokio::test]
async fn namespace_requires_exact_leaf_and_ancestor_scope_without_legacy_fallback() {
    let f = Fixture::new(8).await;
    for (grant, ns) in [
        (f.grant, None),
        (f.parent, None),
        (f.parent, Some(f.other_namespace)),
    ] {
        f.scope(f.work, grant, ns).await;
        f.denied_unchanged(f.request(
            TARGET,
            f.work,
            "workspace.create",
            "scope-denied",
            json!({"label":"denied"}),
        ))
        .await;
        f.scope(f.work, grant, Some(f.namespace)).await;
    }
    f.denied_unchanged(f.request(
        "catalog",
        f.work,
        "workspace.create",
        "legacy-denied",
        json!({"label":"denied"}),
    ))
    .await;
    sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.parent)
        .bind(f.other_work)
        .execute(&f.pool)
        .await
        .unwrap();
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "workspace.create",
        "ancestor-work-denied",
        json!({"label":"denied"}),
    ))
    .await;
    sqlx::query("UPDATE delegations SET work_root_id=NULL WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.parent)
        .execute(&f.pool)
        .await
        .unwrap();
    for value in [Value::Null, json!("malformed namespace")] {
        let mut cfg = f.configuration.clone();
        cfg["namespace_id"] = value;
        f.configure(&cfg).await;
        let before = f.effect_snapshot().await;
        assert!(matches!(
            f.core
                .resource_admit(
                    f.actor(),
                    f.request(
                        TARGET,
                        f.work,
                        "workspace.create",
                        "bad-config",
                        json!({"label":"denied"})
                    )
                )
                .await,
            Err(Error::Unavailable)
        ));
        assert_eq!(f.effect_snapshot().await, before);
    }
    let mut cfg = f.configuration.clone();
    cfg["workspace_id"] = json!(Uuid::new_v4());
    f.configure(&cfg).await;
    assert!(matches!(
        f.core
            .resource_admit(
                f.actor(),
                f.request(
                    TARGET,
                    f.work,
                    "workspace.create",
                    "ambiguous-config",
                    json!({"label":"denied"})
                )
            )
            .await,
        Err(Error::Unavailable)
    ));
    cfg = f.configuration.clone();
    cfg["namespace_id"] = json!(f.other_namespace);
    f.configure(&cfg).await;
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "workspace.create",
        "wrong-registration",
        json!({"label":"denied"}),
    ))
    .await;
    f.configure(&f.configuration).await;
    let allowed = f.create(TARGET, f.work, "positive-scope", "allowed").await;
    assert_eq!(allowed.workspace.unwrap().namespace_id, f.namespace);
}

#[tokio::test]
async fn creation_receipt_recovers_original_binding_after_revocation_without_new_effect() {
    let f = Fixture::new(4).await;
    let created = f
        .create(TARGET, f.work, "lost-creation", "preserved original label")
        .await;
    let intent = created.intent_id;
    let id = created.workspace.as_ref().unwrap().workspace_id;
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "receipt recovery cannot dispatch an accepted operation"
    );
    let ticket = f
        .core
        .resource_claim(intent, WORKER, Some(&f.storage))
        .await
        .unwrap();
    let valid = f.creation_reply(&created, f.work, "preserved original label");
    for (field, wrong) in [
        ("workspace_id", json!(Uuid::new_v4())),
        ("namespace_id", json!(f.other_namespace)),
        ("work_id", json!(f.other_work)),
        ("label", json!("replacement label")),
        ("revision", json!(1)),
        ("workspace_creation_receipt", json!(Uuid::new_v4())),
    ] {
        let before = f.effect_snapshot().await;
        let mut bad = valid.clone();
        bad.receipt[field] = wrong;
        assert!(matches!(
            f.core.resource_complete(intent, WORKER, bad).await,
            Err(Error::Invalid)
        ));
        assert_eq!(
            f.effect_snapshot().await,
            before,
            "a mismatched receipt must not activate the allocation"
        );
    }
    let mut bad_body = valid.clone();
    let mut body: Value = serde_json::from_str(&bad_body.body).unwrap();
    body["workspace_id"] = json!(Uuid::new_v4());
    bad_body.body = body.to_string();
    assert!(matches!(
        f.core.resource_complete(intent, WORKER, bad_body).await,
        Err(Error::Invalid)
    ));
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE resource_targets SET active=false,worker_id='replacement-worker',configuration=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(TARGET).bind(json!({"namespace_id":f.other_namespace,"store_id":Uuid::new_v4(),"storage_generation":Uuid::new_v4()}))
        .execute(&f.pool).await.unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_claim(intent, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, "replacement-worker", &f.storage)
            .await,
        Err(Error::Denied)
    ));
    let mut wrong_storage = f.storage.clone();
    wrong_storage.generation = Uuid::new_v4();
    assert!(matches!(
        f.core
            .resource_receipt_recovery(intent, WORKER, &wrong_storage)
            .await,
        Err(Error::Denied)
    ));
    let recovered = f
        .core
        .resource_receipt_recovery(intent, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(recovered.original_attempt_id, ticket.attempt_id);
    match recovered.selector {
        ReceiptSelector::WorkspaceCreation {
            workspace_id,
            namespace_id,
            work_id,
            label,
        } => {
            assert_eq!(
                (workspace_id, namespace_id, work_id),
                (id, f.namespace, f.work)
            );
            assert_eq!(label, "preserved original label");
        }
        other => panic!("wrong recovery selector: {other:?}"),
    }
    assert_eq!(f.effect_snapshot().await, before);
    f.core
        .resource_complete(intent, WORKER, valid)
        .await
        .unwrap();
    let current = f
        .core
        .read_workspace(f.actor(), id, f.query(TARGET, f.work, f.inspector))
        .await
        .unwrap();
    assert_eq!(current["state"], "active");
    assert!(matches!(
        f.core
            .read_workspace(f.actor(), id, f.query(TARGET, f.work, f.grant))
            .await,
        Err(Error::Denied)
    ));
    let history = f
        .core
        .resource_lookup(f.actor(), intent, Some(f.work), Some(f.inspector))
        .await
        .unwrap();
    assert_eq!(history.state, "succeeded");
    assert_eq!(
        history.reply.unwrap().receipt["workspace_creation_receipt"],
        json!(intent)
    );
    f.scope(f.work, f.inspector, None).await;
    assert!(matches!(
        f.core
            .resource_lookup(f.actor(), intent, Some(f.work), Some(f.inspector))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .read_workspace(f.actor(), id, f.query(TARGET, f.work, f.inspector))
            .await,
        Err(Error::Denied)
    ));
    f.scope(f.work, f.inspector, Some(f.namespace)).await;
    assert!(
        f.core
            .read_workspace(f.actor(), id, f.query(TARGET, f.work, f.inspector))
            .await
            .is_ok()
    );
    let charged: i64 =
        sqlx::query_scalar("SELECT allocated FROM workspace_namespaces WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(f.namespace)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(charged, 1);
}

#[tokio::test]
async fn files_share_only_the_preexisting_work_namespace_and_dispatch_checks_current_config() {
    let f = Fixture::new(8).await;
    let pending = f.create(TARGET, f.work, "pending-space", "pending").await;
    let pending_id = pending.workspace.as_ref().unwrap().workspace_id;
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "file.read",
        "read-reserved",
        json!({"workspace_id":pending_id,"revision":0,"path":"input.bin"}),
    ))
    .await;
    let before = f.effect_snapshot().await;
    let mut changed = f.configuration.clone();
    changed["max_file_bytes"] = json!(524_288);
    f.configure(&changed).await;
    assert!(matches!(
        f.core
            .resource_claim(pending.intent_id, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "configuration drift does not free an allocation or create an attempt"
    );
    f.configure(&f.configuration).await;
    let a = f
        .activate(TARGET, f.work, "space-a", "a")
        .await
        .workspace
        .unwrap()
        .workspace_id;
    let b = f
        .activate(TARGET, f.work, "space-b", "b")
        .await
        .workspace
        .unwrap()
        .workspace_id;
    let outside_work = f
        .activate(TARGET, f.other_work, "space-other-work", "other work")
        .await
        .workspace
        .unwrap()
        .workspace_id;
    let outside_ns = f
        .activate(
            OTHER_TARGET,
            f.work,
            "space-other-namespace",
            "other namespace",
        )
        .await
        .workspace
        .unwrap()
        .workspace_id;
    for (target, work, id) in [
        (TARGET, f.other_work, a),
        (OTHER_TARGET, f.work, a),
        (TARGET, f.work, outside_work),
        (TARGET, f.work, outside_ns),
    ] {
        f.denied_unchanged(f.request(
            target,
            work,
            "file.read",
            "cross-read",
            json!({"workspace_id":id,"revision":0,"path":"input.bin"}),
        ))
        .await;
        f.denied_unchanged(f.request(
            target,
            work,
            "file.publish",
            "cross-publish",
            json!({"workspace_id":id,"expected_revision":0,"files":{}}),
        ))
        .await;
    }
    let read = f
        .core
        .resource_admit(
            f.actor(),
            f.request(
                TARGET,
                f.work,
                "file.read",
                "own-read",
                json!({"workspace_id":a,"revision":0,"path":"input.bin"}),
            ),
        )
        .await
        .unwrap();
    assert_eq!(read.workspace.unwrap().workspace_id, a);
    let digest = "a".repeat(64);
    let upload = f
        .core
        .resource_admit(
            f.actor(),
            f.request(
                TARGET,
                f.work,
                "file.upload",
                "shared-staging",
                json!({"size":70,"sha256":digest}),
            ),
        )
        .await
        .unwrap();
    assert!(
        upload.workspace.is_none(),
        "staging belongs to work and namespace, not a chosen workspace"
    );
    f.core
        .resource_upload_ready(
            f.actor(),
            upload.intent_id,
            Some(f.work),
            Some(f.grant),
            &digest,
            70,
        )
        .await
        .unwrap();
    f.core
        .resource_claim(upload.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    f.core.resource_complete(upload.intent_id,WORKER,ResourceReply{status:200,content_type:"application/json".into(),body:json!({"intent_id":upload.intent_id,"upload_id":upload.intent_id,"sha256":digest}).to_string(),receipt:json!({"source":"catalog","upload_receipt":upload.intent_id,"sha256":digest,"size":70})}).await.unwrap();
    for id in [a, b] {
        let admitted = f.core.resource_admit(f.actor(),f.request(TARGET,f.work,"file.publish",&format!("publish-{id}"),json!({"workspace_id":id,"expected_revision":0,"files":{"result.bin":upload.intent_id}}))).await.unwrap();
        assert_eq!(admitted.workspace.unwrap().workspace_id, id);
    }
    // Both destinations are otherwise authorized and active. The upload itself
    // cannot be laundered across work or namespace through those valid spaces.
    for (target, work, id) in [
        (TARGET, f.other_work, outside_work),
        (OTHER_TARGET, f.work, outside_ns),
    ] {
        f.denied_unchanged(f.request(target,work,"file.publish","cross-upload",json!({"workspace_id":id,"expected_revision":0,"files":{"result.bin":upload.intent_id}}))).await;
    }
    // Changes to an ancestor must be rechecked after admission, not just when
    // the namespace was initially allocated or the read was accepted.
    f.scope(f.work, f.parent, None).await;
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_claim(read.intent_id, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
}

#[tokio::test]
async fn paginated_workspace_metadata_is_scoped_and_rechecks_current_authority() {
    let f = Fixture::new(64).await;
    let mut expected = BTreeSet::new();
    for index in 0..52 {
        let item = f
            .create(
                TARGET,
                f.work,
                &format!("page-{index}"),
                &format!("space {index}"),
            )
            .await;
        expected.insert(item.workspace.unwrap().workspace_id.to_string());
    }
    let first = f
        .core
        .list_workspaces(f.actor(), f.query(TARGET, f.work, f.grant))
        .await
        .unwrap();
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    let cursor = first["next_cursor"].as_str().unwrap().to_owned();
    let late = f
        .create(TARGET, f.work, "later-space", "after first page")
        .await
        .workspace
        .unwrap()
        .workspace_id
        .to_string();
    let other = f
        .create(OTHER_TARGET, f.work, "other-space", "other namespace")
        .await
        .workspace
        .unwrap()
        .workspace_id
        .to_string();
    let mut query = f.query(TARGET, f.work, f.grant);
    query.cursor = Some(cursor.clone());
    let second = f
        .core
        .list_workspaces(f.actor(), query.clone())
        .await
        .unwrap();
    assert_eq!(second["items"].as_array().unwrap().len(), 2);
    assert!(second["next_cursor"].is_null());
    let actual: BTreeSet<String> = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .chain(second["items"].as_array().unwrap())
        .map(|row| row["workspace_id"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(actual, expected);
    assert!(!actual.contains(&late));
    assert!(!actual.contains(&other));
    assert!(first["authority_revision"].is_i64());
    assert!(first["event_sequence"].is_i64());
    for mut mismatch in [
        f.query(TARGET, f.other_work, f.grant),
        f.query(OTHER_TARGET, f.work, f.grant),
        f.query(TARGET, f.work, f.inspector),
    ] {
        mismatch.cursor = Some(cursor.clone());
        assert!(matches!(
            f.core.list_workspaces(f.actor(), mismatch).await,
            Err(Error::Conflict)
        ));
    }
    let id = Uuid::parse_str(expected.first().unwrap()).unwrap();
    assert!(matches!(
        f.core.read_workspace(f.actor(), id, query.clone()).await,
        Err(Error::Invalid)
    ));
    assert!(matches!(
        f.core
            .read_workspace(f.actor(), id, f.query(TARGET, f.other_work, f.grant))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .read_workspace(f.actor(), id, f.query(OTHER_TARGET, f.work, f.grant))
            .await,
        Err(Error::Denied)
    ));
    f.scope(f.work, f.parent, None).await;
    assert!(matches!(
        f.core.list_workspaces(f.actor(), query.clone()).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .read_workspace(f.actor(), id, f.query(TARGET, f.work, f.grant))
            .await,
        Err(Error::Denied)
    ));
    f.scope(f.work, f.parent, Some(f.namespace)).await;
    sqlx::query("UPDATE firms SET revision=revision+1 WHERE id=$1")
        .bind(f.core.firm)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(matches!(
        f.core.list_workspaces(f.actor(), query).await,
        Err(Error::Conflict)
    ));
    assert!(
        f.core
            .list_workspaces(f.actor(), f.query(TARGET, f.work, f.grant))
            .await
            .is_ok()
    );
    sqlx::query("UPDATE credentials SET enabled=false WHERE fingerprint=$1")
        .bind(&f.caller.fingerprint)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .list_workspaces(f.actor(), f.query(TARGET, f.work, f.grant))
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn work_management_events_do_not_reveal_namespace_protected_receipts() {
    let f = Fixture::new(4).await;
    let snapshot = f.core.conditions(&f.observer).await.unwrap();
    let cursor = snapshot["cursor"].as_str().unwrap();
    let label = "namespace-protected-label-marker";
    let created = f.activate(TARGET, f.work, "event-projection", label).await;
    let id = created.workspace.as_ref().unwrap().workspace_id;
    let observer = ResourceActor::Human(f.observer.clone());
    assert!(matches!(
        f.core
            .list_workspaces(observer.clone(), f.query(TARGET, f.work, f.observer_grant))
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .read_workspace(
                observer.clone(),
                id,
                f.query(TARGET, f.work, f.observer_grant)
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .resource_lookup(
                observer,
                created.intent_id,
                Some(f.work),
                Some(f.observer_grant)
            )
            .await,
        Err(Error::Denied)
    ));
    let management = f
        .core
        .read(&f.observer, "intents", created.intent_id)
        .await
        .unwrap();
    assert_eq!(management["state"], "succeeded");
    assert!(management.get("input").is_none());
    assert!(management.get("reply").is_none());
    let events = f.core.events(&f.observer, cursor).await.unwrap();
    assert!(
        events
            .iter()
            .any(|event| event.kind == "resource.completed"
                && event.resource_id == created.intent_id)
    );
    let wire = serde_json::to_string(&events).unwrap();
    assert!(!wire.contains(label));
    assert!(!wire.contains("workspace_creation_receipt"));
    assert!(
        events
            .iter()
            .all(|event| event.data.get("receipt").is_none())
    );
    let protected = f
        .core
        .resource_lookup(f.actor(), created.intent_id, Some(f.work), Some(f.grant))
        .await
        .unwrap();
    assert_eq!(protected.reply.unwrap().receipt["label"], label);
    // Historical writers once embedded receipts in work-visible events. A query
    // must project those old rows too, rather than relying only on new writers.
    sqlx::query("UPDATE events SET data=data||$3 WHERE firm_id=$1 AND resource_id=$2 AND kind='resource.completed'")
        .bind(f.core.firm).bind(created.intent_id).bind(json!({"receipt":{"label":label,"workspace_creation_receipt":created.intent_id},"input":{"label":label}}))
        .execute(&f.pool).await.unwrap();
    let historical = f.core.events(&f.observer, cursor).await.unwrap();
    assert!(
        historical
            .iter()
            .any(|event| event.kind == "resource.completed")
    );
    let historical_wire = serde_json::to_string(&historical).unwrap();
    assert!(!historical_wire.contains(label));
    assert!(!historical_wire.contains("workspace_creation_receipt"));
}

#[tokio::test]
async fn retirement_requires_explicit_policy_age_and_current_ancestor_authority() {
    let mut f = Fixture::new(8).await;
    let policy = f.enable_retirement(3600).await;
    let source = f.retained_upload(TARGET, f.work, "aged-source").await;
    let request = f.retirement_request(
        TARGET,
        f.work,
        "aged-retirement",
        RetirementTarget::Upload {
            upload_id: source.intent_id,
        },
        &policy,
    );
    let mut no_policy = f.configuration.clone();
    no_policy
        .as_object_mut()
        .unwrap()
        .remove("retirement_policy");
    f.configure(&no_policy).await;
    f.denied_unchanged(request.clone()).await;
    // Absence of a retirement policy does not disable ordinary workspace work.
    f.create(
        TARGET,
        f.work,
        "ordinary-without-retirement",
        "still allowed",
    )
    .await;
    f.configure(&f.configuration).await;
    f.denied_unchanged(request.clone()).await;
    sqlx::query("UPDATE resource_calls SET completed_at=NULL WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(source.intent_id)
        .execute(&f.pool)
        .await
        .unwrap();
    f.denied_unchanged(request.clone()).await;
    sqlx::query("UPDATE resource_calls SET completed_at=clock_timestamp()-interval '2 hours' WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm).bind(source.intent_id).execute(&f.pool).await.unwrap();
    sqlx::query("UPDATE delegations SET actions=array_remove(actions,'file.retire') WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.parent).execute(&f.pool).await.unwrap();
    f.denied_unchanged(request.clone()).await;
    sqlx::query("UPDATE delegations SET actions=array_append(actions,'file.retire') WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.parent).execute(&f.pool).await.unwrap();
    f.scope(f.work, f.parent, None).await;
    f.denied_unchanged(request.clone()).await;
    f.scope(f.work, f.parent, Some(f.namespace)).await;
    let mut stale = request.clone();
    stale.input["policy_revision"] = json!(policy.revision + 1);
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core.resource_admit(f.actor(), stale).await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let admitted = f.core.resource_admit(f.actor(), request).await.unwrap();
    assert_eq!(admitted.state, "accepted");

    // A zero minimum is explicit fixture policy, not an invented age for history.
    let zero = RetirementPolicy {
        revision: policy.revision + 1,
        min_retention_seconds: 0,
        ..policy.clone()
    };
    f.configuration["retirement_policy"] = json!(zero);
    f.configure(&f.configuration).await;
    let before = f.effect_snapshot().await;
    assert!(
        matches!(
            f.core
                .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
                .await,
            Err(Error::Denied)
        ),
        "an old retirement ticket cannot execute under a changed active policy"
    );
    assert_eq!(f.effect_snapshot().await, before);
    let undated = f
        .retained_upload(TARGET, f.work, "explicit-zero-source")
        .await;
    sqlx::query("UPDATE resource_calls SET completed_at=NULL WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(undated.intent_id)
        .execute(&f.pool)
        .await
        .unwrap();
    let accepted = f
        .core
        .resource_admit(
            f.actor(),
            f.retirement_request(
                TARGET,
                f.work,
                "explicit-zero-retirement",
                RetirementTarget::Upload {
                    upload_id: undated.intent_id,
                },
                &zero,
            ),
        )
        .await
        .unwrap();
    assert_eq!(accepted.state, "accepted");
}

#[tokio::test]
async fn publication_and_upload_retirement_race_has_one_admitted_winner() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_retirement(0).await;
    let workspace = f
        .activate(TARGET, f.work, "race-workspace", "race")
        .await
        .workspace
        .unwrap()
        .workspace_id;
    let upload = f.retained_upload(TARGET, f.work, "race-upload").await;
    let publication = f.request(TARGET,f.work,"file.publish","race-publication",
        json!({"workspace_id":workspace,"expected_revision":0,"files":{"result.bin":upload.intent_id}}));
    let retirement = f.retirement_request(
        TARGET,
        f.work,
        "race-retirement",
        RetirementTarget::Upload {
            upload_id: upload.intent_id,
        },
        &policy,
    );
    let authority = f.authority_snapshot().await;
    let (published, retired) = tokio::join!(
        f.core.resource_admit(f.actor(), publication.clone()),
        f.core.resource_admit(f.actor(), retirement.clone())
    );
    let admitted_retirement = match (published, retired) {
        (Err(Error::Denied), Ok(retired)) => retired,
        (Ok(published), Err(Error::Conflict)) => {
            // Once the already admitted publication is actually observed, its
            // retained revision owns the bytes and the upload use can be retired.
            f.core
                .resource_claim(published.intent_id, WORKER, Some(&f.storage))
                .await
                .unwrap();
            f.core.resource_complete(published.intent_id,WORKER,ResourceReply{
                status:200,content_type:"application/json".into(),body:json!({"intent_id":published.intent_id,"revision":1}).to_string(),
                receipt:json!({"source":"catalog","publication_receipt":published.intent_id,"revision":1}),
            }).await.unwrap();
            f.core
                .resource_admit(f.actor(), retirement.clone())
                .await
                .unwrap()
        }
        (publication, retirement) => panic!(
            "publication/retirement must serialize without dual acceptance: {publication:?}, {retirement:?}"
        ),
    };
    let replay = f
        .core
        .resource_admit(f.actor(), retirement.clone())
        .await
        .unwrap();
    assert_eq!(replay.intent_id, admitted_retirement.intent_id);
    let mut changed = retirement.clone();
    changed.input["reason"] = json!("different decision");
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core.resource_admit(f.actor(), changed).await,
        Err(Error::Conflict)
    ));
    let mut future_publication = publication;
    future_publication.request_key = "after-retirement-publication".into();
    f.denied_unchanged(future_publication).await;
    assert_eq!(f.effect_snapshot().await, before);
    let charged: i64 =
        sqlx::query_scalar("SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(
        charged, 70,
        "retirement admission is not confirmed physical reclamation"
    );
    assert_eq!(f.authority_snapshot().await, authority);
    let original = f
        .core
        .resource_lookup(f.actor(), upload.intent_id, Some(f.work), Some(f.inspector))
        .await
        .unwrap();
    assert_eq!(original.state, "succeeded");
    assert!(original.reply.unwrap().receipt["object_id"].is_string());
}

#[tokio::test]
async fn unreconciled_publication_blocks_retirement_even_after_its_grant_is_revoked() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_retirement(0).await;
    let workspace = f
        .activate(
            TARGET,
            f.work,
            "pending-retirement-workspace",
            "pending publication",
        )
        .await
        .workspace
        .unwrap()
        .workspace_id;
    let upload = f
        .retained_upload(TARGET, f.work, "pending-retirement-upload")
        .await;
    f.retained_publication(
        workspace,
        0,
        upload.intent_id,
        "completed-before-pending-publication",
    )
    .await;
    let publisher = Uuid::new_v4();
    // A separately revocable, preauthorized fixture delegate prevents denial from
    // being caused merely by removing the retirement caller's own permission.
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,$3,principal_id,parent_id,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(f.grant).bind(publisher).execute(&f.pool).await.unwrap();
    sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$3,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$2 AND target_id=$4 AND work_id=$5")
        .bind(f.core.firm).bind(f.grant).bind(publisher).bind(TARGET).bind(f.work).execute(&f.pool).await.unwrap();
    let mut publication = f.request(TARGET,f.work,"file.publish","unobserved-publication",
        json!({"workspace_id":workspace,"expected_revision":1,"files":{"result.bin":upload.intent_id}}));
    publication.delegation_id = Some(publisher);
    let admitted = f.core.resource_admit(f.actor(), publication).await.unwrap();
    let retirement = f.retirement_request(
        TARGET,
        f.work,
        "pending-upload-retirement",
        RetirementTarget::Upload {
            upload_id: upload.intent_id,
        },
        &policy,
    );
    let close = f.retirement_request(
        TARGET,
        f.work,
        "pending-workspace-close",
        RetirementTarget::WorkspaceClose {
            workspace_id: workspace,
            expected_revision: 1,
        },
        &policy,
    );
    let revision = f.retirement_request(
        TARGET,
        f.work,
        "pending-revision-retirement",
        RetirementTarget::Revision {
            workspace_id: workspace,
            revision: 0,
        },
        &policy,
    );
    for request in [&retirement, &close, &revision] {
        let before = f.effect_snapshot().await;
        assert!(matches!(
            f.core.resource_admit(f.actor(), request.clone()).await,
            Err(Error::Conflict)
        ));
        assert_eq!(f.effect_snapshot().await, before);
    }
    f.core
        .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(publisher)
        .execute(&f.pool)
        .await
        .unwrap();
    assert!(
        f.core
            .list_workspaces(f.actor(), f.query(TARGET, f.work, f.grant))
            .await
            .is_ok()
    );
    for state in ["claimed", "unresolved", "restricted"] {
        // Synthetic worker outcome states, not a claim that a Runtime stop was run.
        sqlx::query("UPDATE intents SET state=$3 WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(admitted.intent_id)
            .bind(state)
            .execute(&f.pool)
            .await
            .unwrap();
        sqlx::query("UPDATE attempts SET state=$3 WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(admitted.intent_id)
            .bind(state)
            .execute(&f.pool)
            .await
            .unwrap();
        for request in [&retirement, &close, &revision] {
            let before = f.effect_snapshot().await;
            assert!(matches!(
                f.core.resource_admit(f.actor(), request.clone()).await,
                Err(Error::Conflict)
            ));
            assert_eq!(
                f.effect_snapshot().await,
                before,
                "uncertainty must not release references or reservations"
            );
        }
    }
    // Re-establish the original claimed state for this synthetic late receipt;
    // no second claim, re-execution, replacement worker or new authority is used.
    sqlx::query("UPDATE intents SET state='claimed' WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(admitted.intent_id)
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE attempts SET state='claimed' WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(admitted.intent_id)
        .execute(&f.pool)
        .await
        .unwrap();
    let valid = ResourceReply {
        status: 200,
        content_type: "application/json".into(),
        body: json!({"intent_id":admitted.intent_id,"revision":2}).to_string(),
        receipt: json!({"source":"catalog","publication_receipt":admitted.intent_id,"revision":2}),
    };
    let mut wrong_results = Vec::new();
    let mut malformed = valid.clone();
    malformed.body = "{".into();
    wrong_results.push(malformed);
    let mut wrong_revision = valid.clone();
    wrong_revision.body = json!({"intent_id":admitted.intent_id,"revision":99}).to_string();
    wrong_revision.receipt["revision"] = json!(99);
    wrong_results.push(wrong_revision);
    let mut wrong_body_revision = valid.clone();
    wrong_body_revision.body = json!({"intent_id":admitted.intent_id,"revision":1}).to_string();
    wrong_results.push(wrong_body_revision);
    let mut wrong_body_intent = valid.clone();
    wrong_body_intent.body = json!({"intent_id":Uuid::new_v4(),"revision":2}).to_string();
    wrong_results.push(wrong_body_intent);
    let mut wrong_receipt_revision = valid.clone();
    wrong_receipt_revision.receipt["revision"] = json!(1);
    wrong_results.push(wrong_receipt_revision);
    let mut wrong_receipt_intent = valid.clone();
    wrong_receipt_intent.receipt["publication_receipt"] = json!(Uuid::new_v4());
    wrong_results.push(wrong_receipt_intent);
    let mut wrong_source = valid.clone();
    wrong_source.receipt["source"] = json!("unassigned-source");
    wrong_results.push(wrong_source);
    let mut wrong_type = valid.clone();
    wrong_type.content_type = "text/plain".into();
    wrong_results.push(wrong_type);
    let before = f.effect_snapshot().await;
    for wrong in wrong_results {
        assert!(matches!(
            f.core
                .resource_complete(admitted.intent_id, WORKER, wrong)
                .await,
            Err(Error::Invalid)
        ));
        assert_eq!(
            f.effect_snapshot().await,
            before,
            "malformed success cannot change intent, attempt, completion time or reservations"
        );
        for request in [&retirement, &revision] {
            assert!(
                matches!(
                    f.core.resource_admit(f.actor(), request.clone()).await,
                    Err(Error::Conflict)
                ),
                "an invalid success must not bypass the pending-publication retirement barrier"
            );
        }
        assert_eq!(f.effect_snapshot().await, before);
    }
    f.core
        .resource_complete(admitted.intent_id, WORKER, valid)
        .await
        .unwrap();
    assert!(f.core.resource_admit(f.actor(), retirement).await.is_ok());
    assert!(
        f.core.resource_admit(f.actor(), revision).await.is_ok(),
        "the older revision becomes retireable after the pending publication is observed"
    );
}

#[tokio::test]
async fn retirement_source_and_revision_barriers_preserve_work_namespace_and_history() {
    let mut f = Fixture::new(6).await;
    let policy = f.enable_retirement(0).await;
    let created = f
        .activate(
            TARGET,
            f.work,
            "revision-retirement-workspace",
            "revision source",
        )
        .await;
    let workspace = created.workspace.as_ref().unwrap().workspace_id;
    let upload = f
        .retained_upload(TARGET, f.work, "revision-retirement-upload")
        .await;
    let first = f
        .retained_publication(workspace, 0, upload.intent_id, "first-retained-revision")
        .await;
    f.retained_publication(workspace, 1, upload.intent_id, "second-retained-revision")
        .await;
    let retirement = f.retirement_request(
        TARGET,
        f.work,
        "retire-old-revision",
        RetirementTarget::Revision {
            workspace_id: workspace,
            revision: 1,
        },
        &policy,
    );
    for target in [
        RetirementTarget::Upload {
            upload_id: upload.intent_id,
        },
        RetirementTarget::Revision {
            workspace_id: workspace,
            revision: 1,
        },
        RetirementTarget::WorkspaceClose {
            workspace_id: workspace,
            expected_revision: 2,
        },
    ] {
        f.denied_unchanged(f.retirement_request(
            TARGET,
            f.other_work,
            "wrong-retirement-work",
            target.clone(),
            &policy,
        ))
        .await;
        f.denied_unchanged(f.retirement_request(
            OTHER_TARGET,
            f.work,
            "wrong-retirement-namespace",
            target,
            &policy,
        ))
        .await;
    }
    let head = f.retirement_request(
        TARGET,
        f.work,
        "retire-current-head",
        RetirementTarget::Revision {
            workspace_id: workspace,
            revision: 2,
        },
        &policy,
    );
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core.resource_admit(f.actor(), head).await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    // Fail closed on inconsistent retained source bindings, for both the initial
    // creation and a publication. This does not simulate a legitimate source edit.
    for (source, revision) in [(created.intent_id, 0), (first.intent_id, 1)] {
        let original: Value = sqlx::query_scalar(
            "SELECT configuration FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(f.core.firm)
        .bind(source)
        .fetch_one(&f.pool)
        .await
        .unwrap();
        for field in ["namespace_id", "store_id", "storage_generation"] {
            let mut wrong = original.clone();
            wrong[field] = json!(Uuid::new_v4());
            sqlx::query(
                "UPDATE resource_calls SET configuration=$3 WHERE firm_id=$1 AND intent_id=$2",
            )
            .bind(f.core.firm)
            .bind(source)
            .bind(wrong)
            .execute(&f.pool)
            .await
            .unwrap();
            f.denied_unchanged(f.retirement_request(
                TARGET,
                f.work,
                "inconsistent-source",
                RetirementTarget::Revision {
                    workspace_id: workspace,
                    revision,
                },
                &policy,
            ))
            .await;
            sqlx::query(
                "UPDATE resource_calls SET configuration=$3 WHERE firm_id=$1 AND intent_id=$2",
            )
            .bind(f.core.firm)
            .bind(source)
            .bind(&original)
            .execute(&f.pool)
            .await
            .unwrap();
        }
    }
    let read = f
        .core
        .resource_admit(
            f.actor(),
            f.request(
                TARGET,
                f.work,
                "file.read",
                "before-revision-retirement",
                json!({"workspace_id":workspace,"revision":1,"path":"result.bin"}),
            ),
        )
        .await
        .unwrap();
    let admitted = f
        .core
        .resource_admit(f.actor(), retirement.clone())
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_claim(read.intent_id, WORKER, Some(&f.storage))
            .await,
        Err(Error::Denied)
    ));
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "file.read",
        "after-revision-retirement",
        json!({"workspace_id":workspace,"revision":1,"path":"result.bin"}),
    ))
    .await;
    assert_eq!(f.effect_snapshot().await, before);
    // An already registered namespace cannot shed its lifetime barriers by
    // presenting a plausible legacy workspace configuration and NULL scopes.
    let mut downgraded = f.configuration.clone();
    downgraded.as_object_mut().unwrap().remove("namespace_id");
    downgraded["workspace_id"] = json!(workspace);
    f.configure(&downgraded).await;
    f.scope(f.work, f.parent, None).await;
    f.scope(f.work, f.grant, None).await;
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "file.read",
        "legacy-downgrade-read",
        json!({"workspace_id":workspace,"revision":1,"path":"result.bin"}),
    ))
    .await;
    // Empty publication is otherwise valid and has no upload-source namespace
    // mismatch that could make this denial pass for an unrelated reason.
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "file.publish",
        "legacy-downgrade-publication",
        json!({"workspace_id":workspace,"expected_revision":2,"files":{}}),
    ))
    .await;
    f.configure(&f.configuration).await;
    f.scope(f.work, f.parent, Some(f.namespace)).await;
    f.scope(f.work, f.grant, Some(f.namespace)).await;
    // Retirement of revision 1 leaves retained revision 2 separately usable.
    assert!(
        f.core
            .resource_admit(
                f.actor(),
                f.request(
                    TARGET,
                    f.work,
                    "file.read",
                    "different-retained-revision",
                    json!({"workspace_id":workspace,"revision":2,"path":"result.bin"})
                )
            )
            .await
            .is_ok()
    );
    f.core
        .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    f.core
        .resource_complete(
            admitted.intent_id,
            WORKER,
            Fixture::retirement_reply(admitted.intent_id, &retirement, "revision_retired"),
        )
        .await
        .unwrap();
    let history = f
        .core
        .resource_lookup(f.actor(), first.intent_id, Some(f.work), Some(f.inspector))
        .await
        .unwrap();
    assert_eq!(history.state, "succeeded");
    assert_eq!(history.reply.unwrap().receipt["revision"], 1);
    let counts:(i64,i64) = sqlx::query_as("SELECT (SELECT allocated FROM workspace_namespaces WHERE firm_id=$1 AND id=$2),(SELECT count(*) FROM workspace_releases WHERE firm_id=$1)")
        .bind(f.core.firm).bind(f.namespace).fetch_one(&f.pool).await.unwrap();
    assert_eq!(
        counts,
        (1, 0),
        "a revision retirement is not workspace closure"
    );
}

#[tokio::test]
async fn workspace_close_receipt_releases_one_slot_after_revocation_and_retains_history() {
    let mut f = Fixture::new(1).await;
    let policy = f.enable_retirement(0).await;
    let created = f
        .activate(TARGET, f.work, "close-workspace", "closed history")
        .await;
    let workspace = created.workspace.unwrap().workspace_id;
    let request = f.retirement_request(
        TARGET,
        f.work,
        "close-once",
        RetirementTarget::WorkspaceClose {
            workspace_id: workspace,
            expected_revision: 0,
        },
        &policy,
    );
    let admitted = f
        .core
        .resource_admit(f.actor(), request.clone())
        .await
        .unwrap();
    f.denied_unchanged(f.request(
        TARGET,
        f.work,
        "file.publish",
        "closed-to-new-publication",
        json!({"workspace_id":workspace,"expected_revision":0,"files":{}}),
    ))
    .await;
    let ticket = f
        .core
        .resource_claim(admitted.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    let mut bad = Fixture::retirement_reply(admitted.intent_id, &request, "workspace_closed");
    bad.receipt["record"]["target"]["workspace_id"] = json!(Uuid::new_v4());
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_complete(admitted.intent_id, WORKER, bad)
            .await,
        Err(Error::Invalid)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    let recovery = f
        .core
        .resource_receipt_recovery(admitted.intent_id, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(recovery.original_attempt_id, ticket.attempt_id);
    match recovery.selector {
        ReceiptSelector::Retirement {
            work_id,
            namespace_id,
            request: fixed,
            policy: fixed_policy,
        } => {
            assert_eq!((work_id, namespace_id), (f.work, f.namespace));
            assert_eq!(json!(fixed), request.input);
            assert_eq!(fixed_policy, policy);
        }
        other => panic!("wrong retirement receipt selector: {other:?}"),
    }
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "observation alone cannot release workspace quota"
    );
    let reply = Fixture::retirement_reply(admitted.intent_id, &request, "workspace_closed");
    f.core
        .resource_complete(admitted.intent_id, WORKER, reply.clone())
        .await
        .unwrap();
    let completed = f.effect_snapshot().await;
    f.core
        .resource_complete(admitted.intent_id, WORKER, reply)
        .await
        .unwrap();
    assert_eq!(f.effect_snapshot().await, completed);
    let counts:(i64,i64,i64) = sqlx::query_as("SELECT (SELECT allocated FROM workspace_namespaces WHERE firm_id=$1 AND id=$2),(SELECT count(*) FROM workspace_allocations WHERE firm_id=$1),(SELECT count(*) FROM workspace_releases WHERE firm_id=$1)")
        .bind(f.core.firm).bind(f.namespace).fetch_one(&f.pool).await.unwrap();
    assert_eq!(counts, (0, 1, 1));
    let workspace_record = f
        .core
        .read_workspace(f.actor(), workspace, f.query(TARGET, f.work, f.inspector))
        .await
        .unwrap();
    assert_eq!(workspace_record["state"], "closed");
    assert!(matches!(
        f.core
            .resource_lookup(f.actor(), admitted.intent_id, Some(f.work), Some(f.grant))
            .await,
        Err(Error::Denied)
    ));
    let mut replay = request;
    replay.delegation_id = Some(f.inspector);
    let observed = f.core.resource_admit(f.actor(), replay).await.unwrap();
    assert_eq!(observed.intent_id, admitted.intent_id);
    assert_eq!(observed.state, "succeeded");
    assert_eq!(f.effect_snapshot().await, completed);
    // Parent rights existed before the retired caller was revoked. They provide
    // a positive contrast for retained reads and reuse of the released quota.
    let mut read = f.request(
        TARGET,
        f.work,
        "file.read",
        "closed-historical-read",
        json!({"workspace_id":workspace,"revision":0,"path":"input.bin"}),
    );
    read.delegation_id = Some(f.parent);
    assert!(
        f.core.resource_admit(f.actor(), read).await.is_ok(),
        "Core closure does not retire every historical snapshot"
    );
    let mut replacement = f.request(
        TARGET,
        f.work,
        "workspace.create",
        "reused-quota",
        json!({"label":"new active workspace"}),
    );
    replacement.delegation_id = Some(f.parent);
    let replacement = f.core.resource_admit(f.actor(), replacement).await.unwrap();
    assert_ne!(replacement.workspace.unwrap().workspace_id, workspace);
    let counts:(i64,i64,i64) = sqlx::query_as("SELECT (SELECT allocated FROM workspace_namespaces WHERE firm_id=$1 AND id=$2),(SELECT count(*) FROM workspace_allocations WHERE firm_id=$1),(SELECT count(*) FROM workspace_releases WHERE firm_id=$1)")
        .bind(f.core.firm).bind(f.namespace).fetch_one(&f.pool).await.unwrap();
    assert_eq!(counts, (1, 2, 1));
}

#[tokio::test]
async fn collection_steps_require_fresh_progress_and_preserve_busy_obligations() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_collection().await;
    let binding = f
        .retired_collection_source("collection-steps", &policy)
        .await;
    let request = f.collection_request(binding.upload_id, "collection-root", &policy);
    let root = f
        .core
        .resource_admit(f.actor(), request.clone())
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(
        matches!(
            f.core
                .resource_claim(root.intent_id, WORKER, Some(&f.storage))
                .await,
            Err(Error::Denied)
        ),
        "ordinary resource dispatch cannot bypass the collection step protocol"
    );
    assert_eq!(f.effect_snapshot().await, before);
    let first = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("step-a", f.grant),
        )
        .await
        .unwrap();
    assert!(first.dispatch_allowed);
    let before = f.effect_snapshot().await;
    let replay = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("step-a", f.grant),
        )
        .await
        .unwrap();
    assert_eq!(
        (replay.step_id, replay.sequence),
        (first.step_id, first.sequence)
    );
    assert!(!replay.dispatch_allowed);
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "same-key observation cannot add attempts, events or charges"
    );
    assert!(matches!(
        f.core
            .collection_advance(
                f.actor(),
                root.intent_id,
                f.collection_step("step-a", f.parent)
            )
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "a valid alternate grant cannot change an existing step key's input"
    );
    let second = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("step-b", f.grant),
        )
        .await
        .unwrap();
    assert!(second.dispatch_allowed);
    assert_ne!(second.step_id, first.step_id);
    assert_eq!(second.sequence, first.sequence + 1);
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, first.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(
                root.intent_id,
                second.step_id,
                "unassigned-worker",
                &f.storage
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let ticket = f
        .core
        .collection_claim(root.intent_id, second.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(ticket.binding, binding);
    assert_eq!(ticket.step_id, second.step_id);
    assert_eq!(ticket.sequence, second.sequence);
    assert_eq!(ticket.resource.intent_id, root.intent_id);
    assert_eq!(ticket.policy, policy);
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, second.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    // Catalog observes a retained hold before any physical dispatch permit.
    f.core
        .collection_step_observe(root.intent_id, second.step_id, WORKER, "busy")
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    f.core
        .collection_step_observe(root.intent_id, second.step_id, WORKER, "busy")
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .collection_dispatch(root.intent_id, second.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let historical = f
        .core
        .resource_lookup(f.actor(), root.intent_id, Some(f.work), Some(f.inspector))
        .await
        .unwrap();
    assert_eq!(historical.state, "claimed");
    assert!(historical.reply.is_none());
    let counts:(i64,i64,i64) = sqlx::query_as("SELECT (SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1),(SELECT count(*) FROM storage_allocations WHERE firm_id=$1),(SELECT count(*) FROM attempts WHERE firm_id=$1 AND intent_id=$2)")
        .bind(f.core.firm).bind(root.intent_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(
        counts,
        (70, 1, 1),
        "busy observation cannot free bytes or manufacture another root attempt"
    );
    let before = f.effect_snapshot().await;
    let replay = f.core.resource_admit(f.actor(), request).await.unwrap();
    assert_eq!(replay.intent_id, root.intent_id);
    assert_eq!(replay.state, "claimed");
    assert_eq!(f.effect_snapshot().await, before);
    let third = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("step-c", f.grant),
        )
        .await
        .unwrap();
    let (a, b) = tokio::join!(
        f.core
            .collection_claim(root.intent_id, third.step_id, WORKER, &f.storage),
        f.core
            .collection_claim(root.intent_id, third.step_id, WORKER, &f.storage)
    );
    match (a, b) {
        (Ok(won), Err(Error::Denied)) | (Err(Error::Denied), Ok(won)) => {
            assert_eq!(won.resource.attempt_id, ticket.resource.attempt_id)
        }
        (a, b) => panic!("one step must allow exactly one claim: {a:?}, {b:?}"),
    }
    f.core
        .collection_dispatch(root.intent_id, third.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_dispatch(root.intent_id, third.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "dispatch consumption does not renew or re-charge a step"
    );
}

#[tokio::test]
async fn collection_successor_uses_current_grant_without_restoring_the_original_one() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_collection().await;
    let binding = f
        .retired_collection_source("collection-successor", &policy)
        .await;
    let root = f
        .core
        .resource_admit(
            f.actor(),
            f.collection_request(binding.upload_id, "successor-root", &policy),
        )
        .await
        .unwrap();
    let first = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("original-step", f.grant),
        )
        .await
        .unwrap();
    let original = f
        .core
        .collection_claim(root.intent_id, first.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.grant)
        .execute(&f.pool)
        .await
        .unwrap();
    // Late observation is still accepted, but it creates no fresh dispatch.
    f.core
        .collection_step_observe(root.intent_id, first.step_id, WORKER, "busy")
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_advance(
                f.actor(),
                root.intent_id,
                f.collection_step("revoked-step", f.grant)
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let second = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("successor-step", f.parent),
        )
        .await
        .unwrap();
    assert!(second.dispatch_allowed);
    assert_eq!(second.sequence, first.sequence + 1);
    let successor = f
        .core
        .collection_claim(root.intent_id, second.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(successor.resource.attempt_id, original.resource.attempt_id);
    assert_eq!(successor.binding, binding);
    let original_authority:(Uuid,bool) = sqlx::query_as("SELECT r.delegation_id,d.revoked FROM resource_calls r JOIN delegations d ON(d.firm_id,d.id)=(r.firm_id,r.delegation_id) WHERE r.firm_id=$1 AND r.intent_id=$2")
        .bind(f.core.firm).bind(root.intent_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(
        original_authority,
        (f.grant, true),
        "progress keeps original provenance and revocation"
    );
    // The successor grant was already authorized in the fixture. Revoking it
    // after claim must still block its not-yet-consumed dispatch permission.
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.parent)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_dispatch(root.intent_id, second.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let charged: i64 =
        sqlx::query_scalar("SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    assert_eq!(charged, 70);
}

#[tokio::test]
async fn collection_step_expiry_and_current_binding_cannot_be_renewed_by_replay() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_collection().await;
    let binding = f
        .retired_collection_source("collection-deadline", &policy)
        .await;
    let root = f
        .core
        .resource_admit(
            f.actor(),
            f.collection_request(binding.upload_id, "deadline-root", &policy),
        )
        .await
        .unwrap();
    let first = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("fixed-deadline", f.grant),
        )
        .await
        .unwrap();
    // Trusted clock fixture, not a production expiry mutation or a wall-clock sleep.
    sqlx::query("UPDATE collection_steps SET issued_at=clock_timestamp()-interval '130 seconds',expires_at=clock_timestamp()-interval '1 second' WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm).bind(first.step_id).execute(&f.pool).await.unwrap();
    let before = f.effect_snapshot().await;
    let replay = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("fixed-deadline", f.grant),
        )
        .await
        .unwrap();
    assert_eq!(
        (replay.step_id, replay.sequence),
        (first.step_id, first.sequence)
    );
    assert!(!replay.dispatch_allowed);
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, first.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "expired progress keeps its original deadline and obligations"
    );
    let second = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("new-deadline", f.grant),
        )
        .await
        .unwrap();
    assert!(second.dispatch_allowed);
    assert_eq!(second.sequence, first.sequence + 1);
    let original_configuration = f.configuration.clone();
    let mut changed = original_configuration.clone();
    changed["transfer_seconds"] = json!(121);
    f.configure(&changed).await;
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, second.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "claim binds the approved configuration, not just an unchanged object ID"
    );
    f.configure(&original_configuration).await;
    let mut other_storage = f.storage.clone();
    other_storage.generation = Uuid::new_v4();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, second.step_id, WORKER, &other_storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    // An issued step remembers the authenticated certificate. Existing general
    // grants alone do not keep that certificate live after its revocation.
    sqlx::query("UPDATE credentials SET enabled=false WHERE firm_id=$1 AND fingerprint=$2")
        .bind(f.core.firm)
        .bind(&f.caller.fingerprint)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .collection_claim(root.intent_id, second.step_id, WORKER, &f.storage)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let counts: (i64, i64) = sqlx::query_as("SELECT (SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1),(SELECT count(*) FROM attempts WHERE firm_id=$1 AND intent_id=$2)")
        .bind(f.core.firm).bind(root.intent_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(counts, (70, 0));
}

#[tokio::test]
async fn collection_exact_late_receipt_releases_bytes_once_and_preserves_provenance() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_collection().await;
    let binding = f
        .retired_collection_source("collection-receipt", &policy)
        .await;
    let root_request = f.collection_request(binding.upload_id, "receipt-root", &policy);
    let root = f
        .core
        .resource_admit(f.actor(), root_request.clone())
        .await
        .unwrap();
    let step = f
        .core
        .collection_advance(
            f.actor(),
            root.intent_id,
            f.collection_step("receipt-step", f.grant),
        )
        .await
        .unwrap();
    let ticket = f
        .core
        .collection_claim(root.intent_id, step.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    let canonical = Fixture::collection_reply(root.intent_id, &binding, &policy, "removed");
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_complete(root.intent_id, WORKER, canonical.clone())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "claim alone has no authority to certify physical deletion"
    );
    f.core
        .collection_dispatch(root.intent_id, step.step_id, WORKER, &f.storage)
        .await
        .unwrap();
    let canonical_record: Value = serde_json::from_str(&canonical.body).unwrap();
    let mut invalid = Vec::new();
    for (field, value) in [
        ("upload_id", json!(Uuid::new_v4())),
        ("object_id", json!(Uuid::new_v4())),
        ("store_id", json!(Uuid::new_v4())),
        ("generation", json!(Uuid::new_v4())),
        ("sha256", json!("c".repeat(64))),
        ("size", json!(binding.size + 1)),
    ] {
        let mut record = canonical_record.clone();
        record["binding"][field] = value;
        invalid.push(record);
    }
    for (field, value) in [
        ("intent_id", json!(Uuid::new_v4())),
        ("policy_id", json!(Uuid::new_v4())),
        ("policy_revision", json!(policy.revision + 1)),
        ("confirmation", json!("not_found_without_collection_proof")),
    ] {
        let mut record = canonical_record.clone();
        record[field] = value;
        invalid.push(record);
    }
    // Each body and receipt agrees with itself; Core must compare to frozen
    // source provenance and policy rather than merely compare those two copies.
    for record in invalid {
        let bad = ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: record.to_string(),
            receipt: json!({"source":"catalog","collection_receipt":root.intent_id,"record":record}),
        };
        let before = f.effect_snapshot().await;
        assert!(matches!(
            f.core.resource_complete(root.intent_id, WORKER, bad).await,
            Err(Error::Invalid)
        ));
        assert_eq!(
            f.effect_snapshot().await,
            before,
            "invalid deletion observation cannot settle attempts, reservations or bytes"
        );
    }
    let mut wrong_source = canonical.clone();
    wrong_source.receipt["source"] = json!("private-report");
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_complete(root.intent_id, WORKER, wrong_source)
            .await,
        Err(Error::Invalid)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.parent)
        .execute(&f.pool)
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    let recovery = f
        .core
        .resource_receipt_recovery(root.intent_id, WORKER, &f.storage)
        .await
        .unwrap();
    assert_eq!(recovery.original_attempt_id, ticket.resource.attempt_id);
    match recovery.selector {
        ReceiptSelector::Collection {
            work_id,
            namespace_id,
            request,
            binding: fixed,
            policy: fixed_policy,
        } => {
            assert_eq!((work_id, namespace_id), (f.work, f.namespace));
            assert_eq!(json!(request), root_request.input);
            assert_eq!(fixed, binding);
            assert_eq!(fixed_policy, policy);
        }
        other => panic!("wrong collection observation selector: {other:?}"),
    }
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "receipt lookup after revocation is observation, not another unlink or credit"
    );
    f.core
        .resource_complete(root.intent_id, WORKER, canonical.clone())
        .await
        .unwrap();
    let completed = f.effect_snapshot().await;
    f.core
        .resource_complete(root.intent_id, WORKER, canonical)
        .await
        .unwrap();
    assert_eq!(f.effect_snapshot().await, completed);
    let counts: (i64, i64, i64, i64) = sqlx::query_as("SELECT (SELECT committed_bytes FROM storage_budgets WHERE firm_id=$1),(SELECT count(*) FROM storage_allocations WHERE firm_id=$1),(SELECT count(*) FROM storage_releases WHERE firm_id=$1),(SELECT bytes FROM storage_releases WHERE firm_id=$1 AND upload_intent_id=$2)")
        .bind(f.core.firm).bind(binding.upload_id).fetch_one(&f.pool).await.unwrap();
    assert_eq!(
        counts,
        (0, 1, 1, 70),
        "credit is once per retained source allocation, which remains in history"
    );
    let history = f
        .core
        .resource_lookup(f.actor(), root.intent_id, Some(f.work), Some(f.inspector))
        .await
        .unwrap();
    assert_eq!(history.state, "succeeded");
    assert_eq!(history.reply.unwrap().receipt["record"], canonical_record);
    assert!(matches!(
        f.core
            .collection_advance(
                f.actor(),
                root.intent_id,
                f.collection_step("no-new-current-authority", f.grant)
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.effect_snapshot().await, completed);
}

#[tokio::test]
async fn collection_requires_retired_exact_source_policy_and_current_namespace_scope() {
    let mut f = Fixture::new(4).await;
    let policy = f.enable_collection().await;
    let pending = f
        .core
        .resource_admit(
            f.actor(),
            f.request(
                TARGET,
                f.work,
                "file.upload",
                "collection-pending-source",
                json!({"sha256":"a".repeat(64),"size":70}),
            ),
        )
        .await
        .unwrap();
    let active = f
        .retained_upload(TARGET, f.work, "collection-active-source")
        .await;
    for (source, key) in [
        (pending.intent_id, "pending-cannot-collect"),
        (active.intent_id, "active-cannot-collect"),
    ] {
        let before = f.effect_snapshot().await;
        assert!(matches!(
            f.core
                .resource_admit(f.actor(), f.collection_request(source, key, &policy))
                .await,
            Err(Error::Conflict)
        ));
        assert_eq!(
            f.effect_snapshot().await,
            before,
            "neither pending upload nor retained active upload is collectible"
        );
    }
    let retirement = f.retirement_request(
        TARGET,
        f.work,
        "source-retirement",
        RetirementTarget::Upload {
            upload_id: active.intent_id,
        },
        &policy,
    );
    let retired = f
        .core
        .resource_admit(f.actor(), retirement.clone())
        .await
        .unwrap();
    f.core
        .resource_claim(retired.intent_id, WORKER, Some(&f.storage))
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core
            .resource_admit(
                f.actor(),
                f.collection_request(active.intent_id, "retirement-unresolved", &policy)
            )
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(
        f.effect_snapshot().await,
        before,
        "retirement admission or lost completion is not an observed release of holds"
    );
    f.core
        .resource_complete(
            retired.intent_id,
            WORKER,
            Fixture::retirement_reply(retired.intent_id, &retirement, "upload_retired"),
        )
        .await
        .unwrap();
    let request = f.collection_request(active.intent_id, "eligible-source", &policy);
    let mut no_policy = f.configuration.clone();
    no_policy
        .as_object_mut()
        .unwrap()
        .remove("retirement_policy");
    f.configure(&no_policy).await;
    f.denied_unchanged(request.clone()).await;
    f.configure(&f.configuration).await;
    let mut wrong_policy = request.clone();
    wrong_policy.input["policy_revision"] = json!(policy.revision + 1);
    let before = f.effect_snapshot().await;
    assert!(matches!(
        f.core.resource_admit(f.actor(), wrong_policy).await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    let mut wrong_work = request.clone();
    wrong_work.work_id = Some(f.other_work);
    f.denied_unchanged(wrong_work).await;
    let mut wrong_namespace = request.clone();
    wrong_namespace.target = OTHER_TARGET.into();
    f.denied_unchanged(wrong_namespace).await;
    f.scope(f.work, f.parent, Some(f.other_namespace)).await;
    f.denied_unchanged(request.clone()).await;
    f.scope(f.work, f.parent, Some(f.namespace)).await;
    let source_configuration: Value = sqlx::query_scalar(
        "SELECT configuration FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
    )
    .bind(f.core.firm)
    .bind(active.intent_id)
    .fetch_one(&f.pool)
    .await
    .unwrap();
    let mut mismatched = source_configuration.clone();
    mismatched["storage_generation"] = json!(Uuid::new_v4());
    sqlx::query("UPDATE resource_calls SET configuration=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(active.intent_id)
        .bind(&mismatched)
        .execute(&f.pool)
        .await
        .unwrap();
    f.denied_unchanged(request.clone()).await;
    sqlx::query("UPDATE resource_calls SET configuration=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(active.intent_id)
        .bind(&source_configuration)
        .execute(&f.pool)
        .await
        .unwrap();
    let original: Value =
        sqlx::query_scalar("SELECT reply FROM resource_calls WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(active.intent_id)
            .fetch_one(&f.pool)
            .await
            .unwrap();
    // Explicit preexisting-history fixtures. They do not use fresh completion
    // to sneak a malformed reply past the strict upload validator.
    let mut legacy = original.clone();
    legacy["receipt"]
        .as_object_mut()
        .unwrap()
        .remove("object_id");
    let mut legacy_body: Value = serde_json::from_str(legacy["body"].as_str().unwrap()).unwrap();
    legacy_body.as_object_mut().unwrap().remove("object_id");
    legacy["body"] = json!(legacy_body.to_string());
    let mut malformed = original.clone();
    malformed["receipt"]["size"] = json!(71);
    for history in [legacy, malformed] {
        sqlx::query("UPDATE resource_calls SET reply=$3 WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(active.intent_id)
            .bind(&history)
            .execute(&f.pool)
            .await
            .unwrap();
        f.denied_unchanged(request.clone()).await;
        let observed = f
            .core
            .resource_lookup(f.actor(), active.intent_id, Some(f.work), Some(f.inspector))
            .await
            .unwrap();
        assert_eq!(
            json!(observed.reply.unwrap()),
            history,
            "legacy records remain visible as history without becoming collection authority"
        );
    }
    sqlx::query("UPDATE resource_calls SET reply=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(active.intent_id)
        .bind(&original)
        .execute(&f.pool)
        .await
        .unwrap();
    let authority = f.authority_snapshot().await;
    let admitted = f
        .core
        .resource_admit(f.actor(), request.clone())
        .await
        .unwrap();
    let before = f.effect_snapshot().await;
    let replay = f
        .core
        .resource_admit(f.actor(), request.clone())
        .await
        .unwrap();
    assert_eq!(replay.intent_id, admitted.intent_id);
    let mut duplicate_root = request;
    duplicate_root.request_key = "same-upload-different-root".into();
    assert!(matches!(
        f.core.resource_admit(f.actor(), duplicate_root).await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.effect_snapshot().await, before);
    assert_eq!(
        f.authority_snapshot().await,
        authority,
        "collection consumes preexisting rights and creates no grants or scopes"
    );
}
