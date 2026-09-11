//! Explicit PostgreSQL fixtures for frozen program inputs and Core materialization.
//! Canonical Catalog receipts and Runtime peers below are synthetic trusted inputs.
//! These tests do not prove byte transport, local writes, Linux identity or execution.
use ouroboros_contracts::{
    Accepted, BridgeIdentity, ExecutionRequest, MaterializationReceipt, MaterializedInput,
    ProgramInput, ProgramProfile, ProgramRequest, ResourceAdmission, ResourceReply,
    ResourceRequest, RetirementPolicy, RetirementRequest, RetirementTarget, RuntimeBinding,
    RuntimeTicket, StorageClaim,
};
use ouroboros_core::{Actor, Caller, Core, Error};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const FILES: &str = "program-files";
const FILE_WORKER: &str = "program-catalog";
const RUNTIME: &str = "program-runtime";
const PROFILE: &str = "bounded-program";
const ACTIONS: &[&str] = &[
    "inspect",
    "work.create",
    "execution.start",
    "execution.stop",
    "delegation.revoke",
    "workspace.create",
    "file.read",
    "file.upload",
    "file.publish",
    "file.retire",
    "db.read",
    "db.write",
    "model.responses",
    "mcp",
];

struct Fixture {
    core: Core,
    db: PgPool,
    human: Caller,
    root_grant: Uuid,
    human_grant: Uuid,
    agent_grant: Uuid,
    work: Uuid,
    namespace: Uuid,
    storage: StorageClaim,
    profile: ProgramProfile,
    configuration: Value,
    policy: RetirementPolicy,
    workspace: Uuid,
    upload: Uuid,
    object: Uuid,
    publication: Uuid,
}

impl Fixture {
    async fn new() -> Self {
        let path = std::env::var("OURO_TEST_DATABASE_URL_FILE")
            .expect("explicit disposable PostgreSQL URL file required");
        let url = std::fs::read_to_string(path).unwrap();
        let db = PgPool::connect(url.trim()).await.unwrap();
        Core::migrate(&db).await.unwrap();
        let core = Core::new(db.clone(), Uuid::new_v4());
        let human_id = Uuid::new_v4();
        let agent_id = Uuid::new_v4();
        let root_grant = Uuid::new_v4();
        let human_grant = Uuid::new_v4();
        let agent_grant = Uuid::new_v4();
        let work = Uuid::new_v4();
        let namespace = Uuid::new_v4();
        let human = Caller {
            fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        };
        let storage = StorageClaim {
            firm_id: core.firm,
            store_id: Uuid::new_v4(),
            generation: Uuid::new_v4(),
        };
        let profile = ProgramProfile {
            native_codex: false,
            image: format!("sha256:{}", "1".repeat(64)),
            memory_bytes: 67_108_864,
            nano_cpus: 100_000_000,
            pids_limit: 32,
            lifetime_seconds: 120,
            compute_units: 5,
            workspace_bytes: 1_048_576,
            home_bytes: 65_536,
            temporary_bytes: 65_536,
            max_input_files: 4,
            max_input_bytes: 512,
            max_file_bytes: 128,
            max_output_bytes: 4096,
        };
        let policy = RetirementPolicy {
            id: Uuid::new_v4(),
            revision: 1,
            min_retention_seconds: 0,
            allowed: vec![
                "upload".into(),
                "revision".into(),
                "workspace_close".into(),
                "collect".into(),
            ],
        };
        let configuration = json!({"namespace_id":namespace,"store_id":storage.store_id,
            "storage_generation":storage.generation,"max_file_bytes":1_048_576,
            "transfer_seconds":120,"retirement_policy":policy});
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
        for (grant, principal, parent) in [
            (root_grant, human_id, None),
            (human_grant, human_id, Some(root_grant)),
            (agent_grant, agent_id, Some(human_grant)),
        ] {
            sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()+interval '1 hour')")
                .bind(core.firm).bind(grant).bind(principal).bind(parent).bind(ACTIONS).execute(&db).await.unwrap();
        }
        sqlx::query("INSERT INTO work(firm_id,id,principal_id,delegation_id,purpose) VALUES($1,$2,$3,$4,'bounded program fixture')")
            .bind(core.firm).bind(work).bind(human_id).bind(human_grant).execute(&db).await.unwrap();
        sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
            .bind(core.firm)
            .bind(work)
            .bind(human_id)
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
            .bind(core.firm)
            .bind(agent_grant)
            .bind(work)
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO limits VALUES($1,'compute',100,0),($1,'resource_calls',512,0)")
            .bind(core.firm)
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO profiles(firm_id,id,active,max_units,max_lifetime_seconds) VALUES($1,$2,true,100,300)")
            .bind(core.firm).bind(PROFILE).execute(&db).await.unwrap();
        sqlx::query(
            "INSERT INTO program_profiles(firm_id,profile_id,profile,active) VALUES($1,$2,$3,true)",
        )
        .bind(core.firm)
        .bind(PROFILE)
        .bind(json!(profile))
        .execute(&db)
        .await
        .unwrap();
        sqlx::query("INSERT INTO storage_budgets VALUES($1,$2,$3,8388608,0)")
            .bind(core.firm)
            .bind(storage.store_id)
            .bind(storage.generation)
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO resource_targets VALUES($1,$2,$3,true,$4,1048576)")
            .bind(core.firm)
            .bind(FILES)
            .bind(FILE_WORKER)
            .bind(&configuration)
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO workspace_namespaces(firm_id,id,target_id,store_id,storage_generation,capacity) VALUES($1,$2,$3,$4,$5,4)")
            .bind(core.firm).bind(namespace).bind(FILES).bind(storage.store_id).bind(storage.generation).execute(&db).await.unwrap();
        for grant in [root_grant, human_grant, agent_grant] {
            sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(core.firm).bind(work).bind(grant).bind(FILES).bind(ACTIONS).bind(namespace).execute(&db).await.unwrap();
        }
        for target in ["company", "model", "mcp"] {
            sqlx::query(
                "INSERT INTO resource_targets VALUES($1,$2,'other-worker',true,'{}',1048576)",
            )
            .bind(core.firm)
            .bind(target)
            .execute(&db)
            .await
            .unwrap();
            for grant in [root_grant, human_grant, agent_grant] {
                sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations) VALUES($1,$2,$3,$4,$5)")
                    .bind(core.firm).bind(work).bind(grant).bind(target).bind(ACTIONS).execute(&db).await.unwrap();
            }
        }
        let mut f = Self {
            core,
            db,
            human,
            root_grant,
            human_grant,
            agent_grant,
            work,
            namespace,
            storage,
            profile,
            configuration,
            policy,
            workspace: Uuid::nil(),
            upload: Uuid::nil(),
            object: Uuid::new_v4(),
            publication: Uuid::nil(),
        };
        let created = f
            .admit(
                "workspace.create",
                "program-workspace",
                json!({"label":"program inputs"}),
            )
            .await;
        f.workspace = created.workspace.unwrap().workspace_id;
        f.complete(created.intent_id,ResourceReply {status:200,content_type:"application/json".into(),
            body:json!({"intent_id":created.intent_id,"workspace_id":f.workspace,"namespace_id":namespace,"work_id":work,"label":"program inputs","revision":0}).to_string(),
            receipt:json!({"source":"catalog","workspace_creation_receipt":created.intent_id,"workspace_id":f.workspace,"namespace_id":namespace,"work_id":work,"label":"program inputs","revision":0})}).await;
        let digest = "a".repeat(64);
        let upload = f
            .admit(
                "file.upload",
                "program-upload",
                json!({"sha256":digest,"size":70}),
            )
            .await;
        f.upload = upload.intent_id;
        f.core
            .resource_upload_ready(
                f.actor(),
                f.upload,
                Some(work),
                Some(human_grant),
                &digest,
                70,
            )
            .await
            .unwrap();
        f.complete(f.upload,ResourceReply {status:200,content_type:"application/json".into(),
            body:json!({"intent_id":f.upload,"upload_id":f.upload,"sha256":digest,"object_id":f.object}).to_string(),
            receipt:json!({"source":"catalog","upload_receipt":f.upload,"sha256":digest,"size":70,"object_id":f.object})}).await;
        let published = f.admit("file.publish","program-publication",json!({"workspace_id":f.workspace,"expected_revision":0,"files":{"bin/program.py":f.upload}})).await;
        f.publication = published.intent_id;
        f.complete(
            published.intent_id,
            Self::publication_reply(published.intent_id, 1),
        )
        .await;
        // Make revision one a retained non-head, so retirement denials test
        // execution dependency barriers rather than the current-head rule.
        let newer = f
            .admit(
                "file.publish",
                "newer-empty-head",
                json!({"workspace_id":f.workspace,"expected_revision":1,"files":{}}),
            )
            .await;
        f.complete(newer.intent_id, Self::publication_reply(newer.intent_id, 2))
            .await;
        f
    }

    fn actor(&self) -> Actor {
        Actor::Human(self.human.clone())
    }
    fn resource(&self, operation: &str, key: &str, input: Value) -> ResourceRequest {
        ResourceRequest {
            target: FILES.into(),
            operation: operation.into(),
            request_key: key.into(),
            input,
            work_id: Some(self.work),
            delegation_id: Some(self.human_grant),
        }
    }
    async fn admit(&self, operation: &str, key: &str, input: Value) -> ResourceAdmission {
        self.core
            .resource_admit(self.actor(), self.resource(operation, key, input))
            .await
            .unwrap()
    }
    async fn complete(&self, intent: Uuid, reply: ResourceReply) {
        self.core
            .resource_claim(intent, FILE_WORKER, Some(&self.storage))
            .await
            .unwrap();
        self.core
            .resource_complete(intent, FILE_WORKER, reply)
            .await
            .unwrap();
    }
    fn publication_reply(intent: Uuid, revision: i64) -> ResourceReply {
        ResourceReply {
            status: 200,
            content_type: "application/json".into(),
            body: json!({"intent_id":intent,"revision":revision}).to_string(),
            receipt: json!({"source":"catalog","publication_receipt":intent,"revision":revision}),
        }
    }
    fn execution(&self) -> ExecutionRequest {
        ExecutionRequest {
            work_id: self.work,
            delegation_id: self.human_grant,
            profile_id: PROFILE.into(),
            units: self.profile.compute_units,
            lifetime_seconds: self.profile.lifetime_seconds as i64,
            predecessor_execution_id: None,
            agent_delegation_id: Some(self.agent_grant),
            program: Some(ProgramRequest {
                native: None,
                argv: vec!["/usr/bin/python3".into(), "bin/program.py".into()],
                inputs: vec![ProgramInput {
                    target: FILES.into(),
                    workspace_id: self.workspace,
                    revision: 1,
                    file: "bin/program.py".into(),
                    destination: "bin/program.py".into(),
                }],
            }),
        }
    }
    fn retirement(&self, key: &str) -> ResourceRequest {
        self.resource(
            "file.retire",
            key,
            json!(RetirementRequest {
                target: RetirementTarget::Revision {
                    workspace_id: self.workspace,
                    revision: 1
                },
                reason: "retire the explicit prior input revision".into(),
                policy_id: self.policy.id,
                policy_revision: self.policy.revision
            }),
        )
    }
    fn materialized(ticket: &RuntimeTicket) -> MaterializationReceipt {
        let p = ticket.program.as_ref().unwrap();
        MaterializationReceipt {
            instance_id: ticket.instance_id,
            generation: ticket.generation,
            manifest_digest: p.manifest_digest.clone(),
            files: p
                .inputs
                .iter()
                .map(|i| MaterializedInput {
                    index: i.index,
                    sha256: i.sha256.clone(),
                    size: i.size,
                })
                .collect(),
        }
    }
    async fn bind(&self, accepted: &Accepted) -> (RuntimeTicket, BridgeIdentity) {
        let ticket = self
            .core
            .runtime_claim(accepted.intent_id, RUNTIME)
            .await
            .unwrap();
        let peer = BridgeIdentity {
            pid: 123,
            uid: 100_001,
            start_ticks: 456,
            boot_id: Uuid::new_v4().to_string(),
        };
        self.core
            .runtime_bind(
                ticket.execution_id,
                RUNTIME,
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
        (ticket, peer)
    }
    async fn finish_input(&self, peer: &BridgeIdentity) -> ResourceAdmission {
        let read = self
            .core
            .program_input_admit(peer.clone(), 0)
            .await
            .unwrap();
        let ticket = self
            .core
            .resource_claim(read.admission.intent_id, FILE_WORKER, Some(&self.storage))
            .await
            .unwrap();
        self.core.resource_complete(read.admission.intent_id,FILE_WORKER,ResourceReply {
            status:200,content_type:"application/octet-stream".into(),body:String::new(),
            receipt:json!({"source":"catalog","stage":"prepared","sha256":read.input.sha256,"size":read.input.size,"snapshot":ticket.input}),
        }).await.unwrap();
        read.admission
    }
    async fn snapshot(&self) -> Value {
        sqlx::query_scalar("SELECT jsonb_build_object('programs',(SELECT jsonb_agg(to_jsonb(p) ORDER BY execution_id) FROM execution_programs p WHERE firm_id=$1),'inputs',(SELECT jsonb_agg(to_jsonb(i) ORDER BY execution_id,input_index) FROM execution_inputs i WHERE firm_id=$1),'intents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM intents i WHERE firm_id=$1),'executions',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM executions e WHERE firm_id=$1),'runtime',(SELECT jsonb_agg(to_jsonb(r) ORDER BY execution_id) FROM runtime_instances r WHERE firm_id=$1),'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM attempts a WHERE firm_id=$1),'calls',(SELECT jsonb_agg(to_jsonb(c) ORDER BY intent_id) FROM resource_calls c WHERE firm_id=$1),'transfers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY intent_id) FROM resource_transfers t WHERE firm_id=$1),'limits',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM limits l WHERE firm_id=$1),'reservations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id,limit_id) FROM reservations r WHERE firm_id=$1),'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY intent_id) FROM outbox o WHERE firm_id=$1),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM events e WHERE firm_id=$1),'retirements',(SELECT jsonb_agg(to_jsonb(r) ORDER BY intent_id) FROM resource_retirements r WHERE firm_id=$1))")
            .bind(self.core.firm).fetch_one(&self.db).await.unwrap()
    }
}

#[tokio::test]
async fn program_admission_freezes_exact_published_lineage_and_rejects_unbounded_inputs() {
    let f = Fixture::new().await;
    let good = f.execution();
    let mut invalid = Vec::new();
    let mut r = good.clone();
    r.program.as_mut().unwrap().argv.clear();
    invalid.push(r);
    let mut r = good.clone();
    r.program
        .as_mut()
        .unwrap()
        .argv
        .push("unsafe\0argument".into());
    invalid.push(r);
    let mut r = good.clone();
    r.program.as_mut().unwrap().argv.push("x".repeat(16_384));
    invalid.push(r);
    for field in ["file", "destination"] {
        for value in [
            "/absolute",
            "../escape",
            "a/../escape",
            "a//empty",
            "a\\windows",
            "a/./dot",
        ] {
            let mut r = good.clone();
            let i = &mut r.program.as_mut().unwrap().inputs[0];
            if field == "file" {
                i.file = value.into();
            } else {
                i.destination = value.into();
            }
            invalid.push(r);
        }
    }
    for destination in ["bin/program.py", "bin", "bin/program.py/child"] {
        let mut r = good.clone();
        let p = r.program.as_mut().unwrap();
        let mut next = p.inputs[0].clone();
        next.destination = destination.into();
        p.inputs.push(next);
        invalid.push(r);
    }
    let mut r = good.clone();
    r.units = 4;
    invalid.push(r);
    let mut r = good.clone();
    r.units = 6;
    invalid.push(r);
    let mut r = good.clone();
    r.lifetime_seconds = 121;
    invalid.push(r);
    let mut r = good.clone();
    r.program.as_mut().unwrap().inputs[0].revision = 0;
    invalid.push(r);
    for (index, request) in invalid.into_iter().enumerate() {
        let before = f.snapshot().await;
        let result = f
            .core
            .start(&f.human, &format!("invalid-program-{index}"), request)
            .await;
        assert!(
            matches!(result, Err(Error::Invalid | Error::Denied)),
            "unexpected invalid program result {index}: {result:?}"
        );
        assert_eq!(
            f.snapshot().await,
            before,
            "invalid program cannot reserve capacity or retain input references"
        );
    }
    let mut smaller = f.profile.clone();
    smaller.max_file_bytes = 69;
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(smaller))
        .execute(&f.db)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .start(&f.human, "oversize-profile-input", good.clone())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(f.profile))
        .execute(&f.db)
        .await
        .unwrap();
    // Each file fits the per-file cap; their combined bytes exceed the
    // separately configured aggregate bound.
    let mut aggregate_profile = f.profile.clone();
    aggregate_profile.max_input_bytes = 128;
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(aggregate_profile))
        .execute(&f.db)
        .await
        .unwrap();
    let mut aggregate = good.clone();
    let mut second = aggregate.program.as_ref().unwrap().inputs[0].clone();
    second.destination = "copy/program.py".into();
    aggregate.program.as_mut().unwrap().inputs.push(second);
    let before = f.snapshot().await;
    assert!(matches!(
        f.core.start(&f.human, "aggregate-inputs", aggregate).await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(f.profile))
        .execute(&f.db)
        .await
        .unwrap();
    let mut absent = good.clone();
    absent.program = None;
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .start(&f.human, "program-profile-without-program", absent)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "omitting a payload cannot demote a program profile into unrestricted legacy admission"
    );
    let accepted = f
        .core
        .start(&f.human, "bounded-program", good.clone())
        .await
        .unwrap();
    let before = f.snapshot().await;
    let replay = f
        .core
        .start(&f.human, "bounded-program", good)
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.intent_id, accepted.intent_id);
    assert_eq!(f.snapshot().await, before);
    let ticket = f
        .core
        .runtime_claim(accepted.intent_id, RUNTIME)
        .await
        .unwrap();
    let program = ticket.program.unwrap();
    assert_eq!(program.profile, f.profile);
    assert_eq!(program.inputs.len(), 1);
    let input = &program.inputs[0];
    assert_eq!(input.index, 0);
    assert_eq!(input.reference, f.execution().program.unwrap().inputs[0]);
    assert_eq!(
        (input.namespace_id, input.upload_id, input.object_id),
        (f.namespace, f.upload, f.object)
    );
    assert_eq!(
        (input.store_id, input.generation),
        (f.storage.store_id, f.storage.generation)
    );
    assert_eq!(
        (input.sha256.as_str(), input.size),
        ("a".repeat(64).as_str(), 70)
    );
    assert_eq!(
        program.manifest_digest,
        ouroboros_contracts::program_manifest_digest(&f.profile, &program.inputs).unwrap()
    );
    let source:Uuid=sqlx::query_scalar("SELECT source_intent_id FROM execution_inputs WHERE firm_id=$1 AND execution_id=$2 AND input_index=0")
        .bind(f.core.firm).bind(accepted.resource_id).fetch_one(&f.db).await.unwrap();
    assert_eq!(
        source, f.publication,
        "a manifest entry has the exact completed publication lineage"
    );
    let units: i64 =
        sqlx::query_scalar("SELECT committed FROM limits WHERE firm_id=$1 AND id='compute'")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(units, 5);
}

#[tokio::test]
async fn execution_inputs_and_revision_retirement_serialize_in_both_orders() {
    let f = Fixture::new().await;
    let started = f
        .core
        .start(&f.human, "start-before-retire", f.execution())
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_admit(f.actor(), f.retirement("retire-after-start"))
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.snapshot().await, before);
    let (ticket, _) = f.bind(&started).await;
    f.core
        .runtime_terminated(ticket.execution_id, RUNTIME)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_admit(f.actor(), f.retirement("retire-after-termination"))
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "observed termination cannot discard an input hold or settle a compute obligation"
    );
    let retained:bool=sqlx::query_scalar("SELECT retained FROM execution_inputs WHERE firm_id=$1 AND execution_id=$2 AND input_index=0")
        .bind(f.core.firm).bind(started.resource_id).fetch_one(&f.db).await.unwrap();
    assert!(retained);
    let f = Fixture::new().await;
    f.core
        .resource_admit(f.actor(), f.retirement("retire-before-start"))
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .start(&f.human, "start-after-retire", f.execution())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    let f = Fixture::new().await;
    let (start, retire) = tokio::join!(
        f.core.start(&f.human, "racing-start", f.execution()),
        f.core
            .resource_admit(f.actor(), f.retirement("racing-retirement"))
    );
    assert!(
        matches!(
            (&start, &retire),
            (Ok(_), Err(Error::Conflict)) | (Err(Error::Denied), Ok(_))
        ),
        "the same revision cannot both gain a new retained execution and retire: {start:?}, {retire:?}"
    );
    let counts:(i64,i64)=sqlx::query_as("SELECT (SELECT count(*) FROM execution_inputs WHERE firm_id=$1),(SELECT count(*) FROM resource_retirements WHERE firm_id=$1)")
        .bind(f.core.firm).fetch_one(&f.db).await.unwrap();
    assert!(matches!(counts, (1, 0) | (0, 1)));
}

#[tokio::test]
async fn materializing_peer_has_only_its_exact_input_and_replays_one_read() {
    let f = Fixture::new().await;
    let accepted = f
        .core
        .start(&f.human, "materializing", f.execution())
        .await
        .unwrap();
    let (ticket, peer) = f.bind(&accepted).await;
    let phase: String = sqlx::query_scalar(
        "SELECT phase FROM runtime_instances WHERE firm_id=$1 AND execution_id=$2",
    )
    .bind(f.core.firm)
    .bind(ticket.execution_id)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(phase, "materializing");
    let before = f.snapshot().await;
    assert!(matches!(
        f.core.conditions(Actor::Instance(peer.clone())).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core.list_work(Actor::Instance(peer.clone()), None).await,
        Err(Error::Denied)
    ));
    for (target, operation, input) in [
        (
            FILES,
            "file.read",
            json!({"workspace_id":f.workspace,"revision":1,"path":"bin/program.py"}),
        ),
        ("company", "db.read", json!({"query":"read_input"})),
        (
            "model",
            "model.responses",
            json!({"model":"fixture","input":"unauthorized"}),
        ),
        (
            "mcp",
            "mcp",
            json!({"jsonrpc":"2.0","method":"tools/list","id":1}),
        ),
    ] {
        let request = ResourceRequest {
            target: target.into(),
            operation: operation.into(),
            request_key: format!("materializing-{target}"),
            input,
            work_id: Some(f.work),
            delegation_id: Some(f.agent_grant),
        };
        assert!(matches!(
            f.core
                .resource_admit(Actor::Instance(peer.clone()), request)
                .await,
            Err(Error::Denied)
        ));
    }
    assert!(matches!(
        f.core.program_input_admit(peer.clone(), 1).await,
        Err(Error::Denied)
    ));
    let mut other_peer = peer.clone();
    other_peer.start_ticks += 1;
    assert!(matches!(
        f.core.program_input_admit(other_peer, 0).await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    let first = f.core.program_input_admit(peer.clone(), 0).await.unwrap();
    assert_eq!(first.input, ticket.program.as_ref().unwrap().inputs[0]);
    let before = f.snapshot().await;
    let replay = f.core.program_input_admit(peer.clone(), 0).await.unwrap();
    assert_eq!(replay.admission.intent_id, first.admission.intent_id);
    assert_eq!(
        f.snapshot().await,
        before,
        "input response loss must not allocate another transfer or renew expiry"
    );
    // A separately registered synthetic instance has the same principal,
    // grant and company input but still receives its own preparation read.
    let other = f
        .core
        .start(&f.human, "other-materializing-instance", f.execution())
        .await
        .unwrap();
    let (_, other_peer) = f.bind(&other).await;
    let own = f
        .core
        .program_input_admit(other_peer.clone(), 0)
        .await
        .unwrap();
    assert_eq!(own.input, first.input);
    assert_ne!(own.admission.intent_id, first.admission.intent_id);
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .resource_lookup(
                Actor::Instance(other_peer),
                first.admission.intent_id,
                Some(f.work),
                Some(f.agent_grant)
            )
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "another live instance cannot borrow an input transfer by sharing a logical agent and grant"
    );
    let read = f
        .core
        .resource_claim(first.admission.intent_id, FILE_WORKER, Some(&f.storage))
        .await
        .unwrap();
    let snapshot = read.input.clone();
    f.core.resource_complete(first.admission.intent_id,FILE_WORKER,ResourceReply {status:200,content_type:"application/octet-stream".into(),body:String::new(),
        receipt:json!({"source":"catalog","stage":"prepared","sha256":first.input.sha256,"size":first.input.size,"snapshot":snapshot})}).await.unwrap();
    let before = f.snapshot().await;
    let replay = f.core.program_input_admit(peer.clone(), 0).await.unwrap();
    assert_eq!(replay.admission.intent_id, first.admission.intent_id);
    assert_eq!(replay.admission.state, "succeeded");
    assert!(matches!(
        f.core.runtime_release(ticket.execution_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "successful source read is not a local materialization receipt"
    );
    let expected = Fixture::materialized(&ticket);
    f.core
        .runtime_materialized(ticket.execution_id, RUNTIME, &expected)
        .await
        .unwrap();
    let before = f.snapshot().await;
    f.core
        .runtime_materialized(ticket.execution_id, RUNTIME, &expected)
        .await
        .unwrap();
    assert_eq!(
        f.snapshot().await,
        before,
        "same exact materialization observation is recorded once"
    );
    f.core
        .runtime_release(ticket.execution_id, RUNTIME)
        .await
        .unwrap();
    f.core
        .conditions(Actor::Instance(peer.clone()))
        .await
        .unwrap();
    let request = json!({"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"execution_self","arguments":{}}});
    let observed = f
        .core
        .managed_mcp(
            Actor::Instance(peer.clone()),
            f.work,
            f.agent_grant,
            request.clone(),
        )
        .await
        .unwrap()
        .unwrap();
    assert_eq!(observed["result"]["isError"], false);
    assert_eq!(
        observed["result"]["structuredContent"]["id"],
        json!(accepted.resource_id)
    );
    assert_eq!(
        observed["result"]["structuredContent"]["instance_id"],
        json!(ticket.instance_id)
    );
    let mut forged = request.clone();
    forged["params"]["arguments"] = json!({"execution_id":other.resource_id});
    let denied = f
        .core
        .managed_mcp(Actor::Instance(peer.clone()), f.work, f.agent_grant, forged)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(denied["result"]["isError"], true);
    assert!(matches!(
        f.core
            .managed_mcp(
                Actor::Instance(peer.clone()),
                f.work,
                f.human_grant,
                request.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    let denied = f
        .core
        .managed_mcp(f.actor(), f.work, f.human_grant, request.clone())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(denied["result"]["isError"], true);
    // Authentication and an old MCP session cannot retain a revoked work grant.
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.agent_grant)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .managed_mcp(Actor::Instance(peer), f.work, f.agent_grant, request)
            .await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn materialization_requires_exact_instance_manifest_and_verified_read_evidence() {
    {
        let f = Fixture::new().await;
        let accepted = f
            .core
            .start(&f.human, "wrong-source-read", f.execution())
            .await
            .unwrap();
        let (ticket, peer) = f.bind(&accepted).await;
        let read = f.core.program_input_admit(peer, 0).await.unwrap();
        let call = f
            .core
            .resource_claim(read.admission.intent_id, FILE_WORKER, Some(&f.storage))
            .await
            .unwrap();
        // A well-formed normal read result still is not proof that the exact
        // frozen program bytes were read. This is a synthetic worker response.
        f.core.resource_complete(read.admission.intent_id,FILE_WORKER,ResourceReply {
            status:200,content_type:"application/octet-stream".into(),body:String::new(),
            receipt:json!({"source":"catalog","stage":"prepared","sha256":"b".repeat(64),"size":71,"snapshot":call.input}),
        }).await.unwrap();
        let before = f.snapshot().await;
        assert!(matches!(
            f.core
                .runtime_materialized(
                    ticket.execution_id,
                    RUNTIME,
                    &Fixture::materialized(&ticket)
                )
                .await,
            Err(Error::Denied)
        ));
        assert!(matches!(
            f.core.runtime_release(ticket.execution_id, RUNTIME).await,
            Err(Error::Denied)
        ));
        assert_eq!(
            f.snapshot().await,
            before,
            "successful but different source bytes cannot satisfy the fixed input manifest"
        );
    }
    let f = Fixture::new().await;
    let accepted = f
        .core
        .start(&f.human, "exact-materialization", f.execution())
        .await
        .unwrap();
    let (ticket, peer) = f.bind(&accepted).await;
    let canonical = Fixture::materialized(&ticket);
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .runtime_materialized(ticket.execution_id, RUNTIME, &canonical)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "Runtime report cannot replace absent input read evidence"
    );
    f.finish_input(&peer).await;
    let mut invalid = Vec::new();
    let mut r = canonical.clone();
    r.instance_id = Uuid::new_v4();
    invalid.push(r);
    let mut r = canonical.clone();
    r.generation = Uuid::new_v4();
    invalid.push(r);
    let mut r = canonical.clone();
    r.manifest_digest = "b".repeat(64);
    invalid.push(r);
    let mut r = canonical.clone();
    r.files.clear();
    invalid.push(r);
    let mut r = canonical.clone();
    r.files.push(r.files[0].clone());
    invalid.push(r);
    let mut r = canonical.clone();
    r.files[0].index = 1;
    invalid.push(r);
    let mut r = canonical.clone();
    r.files[0].sha256 = "b".repeat(64);
    invalid.push(r);
    let mut r = canonical.clone();
    r.files[0].size += 1;
    invalid.push(r);
    for report in invalid {
        let before = f.snapshot().await;
        assert!(matches!(
            f.core
                .runtime_materialized(ticket.execution_id, RUNTIME, &report)
                .await,
            Err(Error::Conflict)
        ));
        assert_eq!(
            f.snapshot().await,
            before,
            "mismatched materialization must not release the private payload"
        );
    }
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .runtime_materialized(ticket.execution_id, "unassigned-runtime", &canonical)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    f.core
        .runtime_materialized(ticket.execution_id, RUNTIME, &canonical)
        .await
        .unwrap();
    let stored: Value = sqlx::query_scalar(
        "SELECT materialization FROM execution_programs WHERE firm_id=$1 AND execution_id=$2",
    )
    .bind(f.core.firm)
    .bind(ticket.execution_id)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(stored, json!(canonical));
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.agent_grant)
        .execute(&f.db)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core.runtime_release(ticket.execution_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core.program_input_admit(peer, 0).await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "a completed receipt never restores a revoked execution grant"
    );
}

#[tokio::test]
async fn program_current_profile_target_and_grant_are_checked_at_each_preparation_boundary() {
    let f = Fixture::new().await;
    let accepted = f
        .core
        .start(&f.human, "current-program", f.execution())
        .await
        .unwrap();
    let ticket = f
        .core
        .runtime_claim(accepted.intent_id, RUNTIME)
        .await
        .unwrap();
    let peer = BridgeIdentity {
        pid: 123,
        uid: 100_001,
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
        container_id: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        peer: peer.clone(),
        deadline_boottime_ns: 1_000_000,
    };
    let mut changed_profile = f.profile.clone();
    changed_profile.nano_cpus += 1;
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(changed_profile))
        .execute(&f.db)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .runtime_bind(ticket.execution_id, RUNTIME, binding.clone())
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    sqlx::query("UPDATE program_profiles SET profile=$3 WHERE firm_id=$1 AND profile_id=$2")
        .bind(f.core.firm)
        .bind(PROFILE)
        .bind(json!(f.profile))
        .execute(&f.db)
        .await
        .unwrap();
    f.core
        .runtime_bind(ticket.execution_id, RUNTIME, binding.clone())
        .await
        .unwrap();
    let mut replaced_binding = binding;
    replaced_binding.peer.start_ticks += 1;
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .runtime_bind(ticket.execution_id, RUNTIME, replaced_binding)
            .await,
        Err(Error::Conflict)
    ));
    assert_eq!(f.snapshot().await, before);
    let mut changed_target = f.configuration.clone();
    changed_target["transfer_seconds"] = json!(121);
    sqlx::query("UPDATE resource_targets SET configuration=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(FILES)
        .bind(&changed_target)
        .execute(&f.db)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core.program_input_admit(peer.clone(), 0).await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    sqlx::query("UPDATE resource_targets SET configuration=$3 WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(FILES)
        .bind(&f.configuration)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("UPDATE resource_scopes SET namespace_id=NULL WHERE firm_id=$1 AND work_id=$2 AND delegation_id=$3 AND target_id=$4")
        .bind(f.core.firm).bind(f.work).bind(f.root_grant).bind(FILES).execute(&f.db).await.unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core.program_input_admit(peer.clone(), 0).await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "the exact input does not waive an ancestor namespace scope"
    );
    sqlx::query("UPDATE resource_scopes SET namespace_id=$5 WHERE firm_id=$1 AND work_id=$2 AND delegation_id=$3 AND target_id=$4")
        .bind(f.core.firm).bind(f.work).bind(f.root_grant).bind(FILES).bind(f.namespace).execute(&f.db).await.unwrap();
    f.finish_input(&peer).await;
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.human_grant)
        .execute(&f.db)
        .await
        .unwrap();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .runtime_materialized(
                ticket.execution_id,
                RUNTIME,
                &Fixture::materialized(&ticket)
            )
            .await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core.runtime_release(ticket.execution_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.snapshot().await,
        before,
        "read completion cannot bridge a revoked submitter's authority into execution"
    );
}

#[tokio::test]
async fn program_lineage_cannot_upgrade_legacy_or_malformed_stored_sources() {
    let f = Fixture::new().await;
    let original: Value =
        sqlx::query_scalar("SELECT reply FROM resource_calls WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(f.upload)
            .fetch_one(&f.db)
            .await
            .unwrap();
    let mut legacy = original.clone();
    legacy["receipt"]
        .as_object_mut()
        .unwrap()
        .remove("object_id");
    let mut body: Value = serde_json::from_str(legacy["body"].as_str().unwrap()).unwrap();
    body.as_object_mut().unwrap().remove("object_id");
    legacy["body"] = json!(body.to_string());
    let mut bad_size = original.clone();
    bad_size["receipt"]["size"] = json!(71);
    let mut wrong_object = original.clone();
    wrong_object["receipt"]["object_id"] = json!(Uuid::new_v4());
    for (index, history) in [legacy, bad_size, wrong_object].into_iter().enumerate() {
        // Explicit old-history fixture: fresh completion itself cannot produce
        // these records, and a new consumer must not silently recertify them.
        sqlx::query("UPDATE resource_calls SET reply=$3 WHERE firm_id=$1 AND intent_id=$2")
            .bind(f.core.firm)
            .bind(f.upload)
            .bind(&history)
            .execute(&f.db)
            .await
            .unwrap();
        let before = f.snapshot().await;
        assert!(matches!(
            f.core
                .start(
                    &f.human,
                    &format!("unusable-history-{index}"),
                    f.execution()
                )
                .await,
            Err(Error::Denied)
        ));
        assert_eq!(f.snapshot().await, before);
    }
    sqlx::query("UPDATE resource_calls SET reply=$3 WHERE firm_id=$1 AND intent_id=$2")
        .bind(f.core.firm)
        .bind(f.upload)
        .bind(original)
        .execute(&f.db)
        .await
        .unwrap();
    let mut wrong_reference = f.execution();
    wrong_reference.program.as_mut().unwrap().inputs[0].file = "unpublished.py".into();
    let before = f.snapshot().await;
    assert!(matches!(
        f.core
            .start(&f.human, "not-in-manifest", wrong_reference)
            .await,
        Err(Error::Denied)
    ));
    assert_eq!(f.snapshot().await, before);
    f.core
        .start(&f.human, "restored-canonical-lineage", f.execution())
        .await
        .unwrap();
}

#[tokio::test]
async fn native_input_admission_requires_activation_and_known_predecessor() {
    let f = Fixture::new().await;
    let mut request = f.execution();
    let program = request.program.as_mut().unwrap();
    program.argv.clear();
    program.native = Some(ouroboros_contracts::NativeInvocation {
        prompt: "Continue authorized work".into(),
        resume: None,
    });
    let before = f.snapshot().await;
    assert!(
        f.core
            .start(&f.human, "native-inactive", request.clone())
            .await
            .is_err()
    );
    assert_eq!(before, f.snapshot().await);
    let mut profile = f.profile.clone();
    profile.native_codex = true;
    // Profile names repeat across disposable firms; native activation belongs only to this
    // fixture. Unscoped mutation contaminates concurrently running ordinary-program cases.
    sqlx::query("UPDATE program_profiles SET profile=$1 WHERE firm_id=$2 AND profile_id=$3")
        .bind(json!(profile))
        .bind(f.core.firm)
        .bind(PROFILE)
        .execute(&f.db)
        .await
        .unwrap();
    let mut invalid = request.clone();
    invalid
        .program
        .as_mut()
        .unwrap()
        .native
        .as_mut()
        .unwrap()
        .resume = Some(ouroboros_contracts::NativeResume {
        thread_id: Uuid::new_v4(),
        checkpoint_destination: "bin/program.py".into(),
    });
    assert!(matches!(
        f.core
            .start(&f.human, "native-no-predecessor", invalid.clone())
            .await,
        Err(Error::Invalid)
    ));
    invalid.predecessor_execution_id = Some(Uuid::new_v4());
    assert!(matches!(
        f.core
            .start(&f.human, "native-unknown-predecessor", invalid)
            .await,
        Err(Error::Denied)
    ));
    let admitted = f
        .core
        .start(&f.human, "native-start", request.clone())
        .await
        .unwrap();
    let repeated = f
        .core
        .start(&f.human, "native-start", request)
        .await
        .unwrap();
    assert_eq!(admitted.intent_id, repeated.intent_id);
    let ticket = f
        .core
        .runtime_claim(admitted.intent_id, RUNTIME)
        .await
        .unwrap();
    assert!(ticket.program.as_ref().unwrap().profile.native_codex);
    assert!(ticket.input.program.as_ref().unwrap().argv.is_empty());
    assert_eq!(ticket.program.as_ref().unwrap().inputs.len(), 1);
}

#[tokio::test]
async fn adapter_submission_freezes_material_and_verification_uses_current_runtime_authority() {
    let f = Fixture::new().await;
    let source = f
        .core
        .start(&f.human, "adapter-source", f.execution())
        .await
        .unwrap();
    let request = ouroboros_contracts::AdapterSubmissionRequest {
        work_id: Some(f.work),
        delegation_id: Some(f.human_grant),
        target: "model".into(),
        source_execution_id: source.resource_id,
    };
    assert!(matches!(
        f.core
            .submit_adapter(f.actor(), "adapter-submit", request.clone())
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['adapter.submit','adapter.verify'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.submit','adapter.verify'] WHERE firm_id=$1 AND target_id='model'")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let submitted = f
        .core
        .submit_adapter(f.actor(), "adapter-submit", request.clone())
        .await
        .unwrap();
    let id = Uuid::parse_str(submitted["id"].as_str().unwrap()).unwrap();
    assert_eq!(submitted["tool_exposed"], false);
    assert_eq!(
        f.core
            .submit_adapter(f.actor(), "adapter-submit", request.clone())
            .await
            .unwrap(),
        submitted
    );
    assert_eq!(
        f.core
            .inspect_adapter(f.actor(), id, Some(f.work), Some(f.human_grant))
            .await
            .unwrap(),
        submitted
    );
    let mut verification = f.execution();
    verification.program = None;
    assert!(matches!(
        f.core
            .verify_adapter(f.actor(), id, "self-verification", verification.clone())
            .await,
        Err(Error::Denied)
    ));
    let reviewer = Uuid::new_v4();
    let grant = Uuid::new_v4();
    let child = Uuid::new_v4();
    let caller = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
        .bind(f.core.firm)
        .bind(reviewer)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
    )
    .bind(&caller.fingerprint)
    .bind(f.core.firm)
    .bind(reviewer)
    .execute(&f.db)
    .await
    .unwrap();
    sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
        .bind(f.core.firm)
        .bind(f.work)
        .bind(reviewer)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at) SELECT firm_id,$2,$3,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$4")
        .bind(f.core.firm).bind(grant).bind(reviewer).bind(f.human_grant).execute(&f.db).await.unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,parent_id,actions,expires_at) SELECT firm_id,$2,principal_id,$3,actions,expires_at FROM delegations WHERE firm_id=$1 AND id=$4")
        .bind(f.core.firm).bind(child).bind(grant).bind(f.agent_grant).execute(&f.db).await.unwrap();
    for new_grant in [grant, child] {
        sqlx::query("INSERT INTO resource_scopes(firm_id,work_id,delegation_id,target_id,operations,namespace_id) SELECT firm_id,work_id,$2,target_id,operations,namespace_id FROM resource_scopes WHERE firm_id=$1 AND delegation_id=$3")
            .bind(f.core.firm).bind(new_grant).bind(f.human_grant).execute(&f.db).await.unwrap();
    }
    verification.delegation_id = grant;
    verification.agent_delegation_id = Some(child);
    let accepted = f
        .core
        .verify_adapter(
            Actor::Human(caller.clone()),
            id,
            "reviewer-verification",
            verification.clone(),
        )
        .await
        .unwrap();
    let replay = f
        .core
        .verify_adapter(
            Actor::Human(caller.clone()),
            id,
            "reviewer-verification",
            verification.clone(),
        )
        .await
        .unwrap();
    assert_eq!(accepted.resource_id, replay.resource_id);
    let saved: Value = sqlx::query_scalar(
        "SELECT request FROM execution_programs WHERE firm_id=$1 AND execution_id=$2",
    )
    .bind(f.core.firm)
    .bind(accepted.resource_id)
    .fetch_one(&f.db)
    .await
    .unwrap();
    assert_eq!(saved, submitted["program"]);
    let count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM adapter_verifications WHERE firm_id=$1")
            .bind(f.core.firm)
            .fetch_one(&f.db)
            .await
            .unwrap();
    assert_eq!(count, 1);
    let mut replaced = verification.clone();
    replaced.program = f.execution().program;
    assert!(matches!(
        f.core
            .verify_adapter(
                Actor::Human(caller.clone()),
                id,
                "replacement-program",
                replaced
            )
            .await,
        Err(Error::Invalid)
    ));
    let mut assessment = ouroboros_contracts::AdapterEvaluationRequest {
        work_id: Some(f.work),
        delegation_id: Some(grant),
        verification_execution_id: accepted.resource_id,
        conclusion: "unsupported".into(),
        criteria: "Output must match the fixture".into(),
        rationale: "The supplied result does not establish the criterion".into(),
        limitations: "Fabricated Runtime observation; no actual provider test".into(),
    };
    assert!(matches!(
        f.core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "assessment",
                assessment.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    sqlx::query(
        "UPDATE delegations SET actions=actions||ARRAY['adapter.evaluate'] WHERE firm_id=$1",
    )
    .bind(f.core.firm)
    .execute(&f.db)
    .await
    .unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.evaluate'] WHERE firm_id=$1 AND target_id='model'")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    // Still no complete backend observation: the evaluator cannot invent one in the API.
    assert!(matches!(
        f.core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "assessment",
                assessment.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("INSERT INTO program_observations(firm_id,execution_id,receipt) VALUES($1,$2,$3)")
        .bind(f.core.firm)
        .bind(accepted.resource_id)
        .bind(json!({"exit_code":7,"fixture":"fabricated"}))
        .execute(&f.db)
        .await
        .unwrap();
    let mut self_assessment = assessment.clone();
    self_assessment.delegation_id = Some(f.human_grant);
    assert!(matches!(
        f.core
            .evaluate_adapter(f.actor(), id, "self-assessment", self_assessment)
            .await,
        Err(Error::Denied)
    ));
    let assessed = f
        .core
        .evaluate_adapter(
            Actor::Human(caller.clone()),
            id,
            "assessment",
            assessment.clone(),
        )
        .await
        .unwrap();
    assert_eq!(assessed["runtime_observation"]["exit_code"], 7);
    assert_eq!(assessed["operating_acceptance"], false);
    assert_eq!(assessed["independence_confirmed"], false);
    assert_eq!(
        f.core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "assessment",
                assessment.clone()
            )
            .await
            .unwrap(),
        assessed
    );
    let mut acceptance = ouroboros_contracts::AdapterAcceptanceRequest {
        work_id: Some(f.work),
        delegation_id: Some(grant),
        evaluation_id: Uuid::parse_str(assessed["id"].as_str().unwrap()).unwrap(),
        max_calls: 2,
        lifetime_seconds: 60,
        rationale: "Limited environment exercise only".into(),
        independence_basis: "Distinct fixture evaluator; no general independence claim".into(),
    };
    assert!(matches!(
        f.core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "acceptance",
                acceptance.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['adapter.accept'] WHERE firm_id=$1")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.accept'] WHERE firm_id=$1 AND target_id='model'")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    // Negative assessment cannot be promoted to an acceptance even by an authorized acceptor.
    assert!(matches!(
        f.core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "negative-acceptance",
                acceptance.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    let mut positive = assessment.clone();
    positive.conclusion = "supported".into();
    positive.criteria = "The fixture retained a negative observation".into();
    let positive = f
        .core
        .evaluate_adapter(
            Actor::Human(caller.clone()),
            id,
            "positive-assessment",
            positive,
        )
        .await
        .unwrap();
    acceptance.evaluation_id = Uuid::parse_str(positive["id"].as_str().unwrap()).unwrap();
    let mut self_acceptance = acceptance.clone();
    self_acceptance.delegation_id = Some(f.human_grant);
    assert!(matches!(
        f.core
            .accept_adapter(f.actor(), id, "self-acceptance", self_acceptance)
            .await,
        Err(Error::Denied)
    ));
    let accepted_scope = f
        .core
        .accept_adapter(
            Actor::Human(caller.clone()),
            id,
            "acceptance",
            acceptance.clone(),
        )
        .await
        .unwrap();
    assert_eq!(accepted_scope["activation_required"], true);
    assert_eq!(accepted_scope["tool_exposed"], false);
    assert_eq!(
        f.core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "acceptance",
                acceptance.clone()
            )
            .await
            .unwrap(),
        accepted_scope
    );
    let inspected = f
        .core
        .inspect_adapter(Actor::Human(caller.clone()), id, Some(f.work), Some(grant))
        .await
        .unwrap();
    assert_eq!(inspected["evaluations"].as_array().unwrap().len(), 2);
    assert_eq!(inspected["acceptances"][0], accepted_scope);
    let activation = ouroboros_contracts::AdapterActivationRequest {
        work_id: Some(f.work),
        delegation_id: Some(grant),
        acceptance_id: Uuid::parse_str(accepted_scope["id"].as_str().unwrap()).unwrap(),
        expected_activation_id: None,
    };
    assert!(matches!(
        f.core
            .activate_adapter(
                Actor::Human(caller.clone()),
                id,
                "activation",
                activation.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE delegations SET actions=actions||ARRAY['adapter.activate','adapter.invoke','adapter.stop'] WHERE firm_id=$1")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.activate','adapter.invoke','adapter.stop'] WHERE firm_id=$1 AND target_id='model'")
        .bind(f.core.firm).execute(&f.db).await.unwrap();
    let active = f
        .core
        .activate_adapter(
            Actor::Human(caller.clone()),
            id,
            "activation",
            activation.clone(),
        )
        .await
        .unwrap();
    let aid = Uuid::parse_str(active["id"].as_str().unwrap()).unwrap();
    assert_eq!(
        f.core
            .activate_adapter(
                Actor::Human(caller.clone()),
                id,
                "activation",
                activation.clone()
            )
            .await
            .unwrap(),
        active
    );
    assert!(matches!(
        f.core
            .activate_adapter(
                Actor::Human(caller.clone()),
                id,
                "reuse-acceptance",
                activation.clone()
            )
            .await,
        Err(Error::Conflict)
    ));
    let init=f.core.managed_mcp(Actor::Human(caller.clone()),f.work,grant,json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"fixture","version":"1"}}})).await.unwrap().unwrap();
    assert_eq!(init["result"]["protocolVersion"], "2025-11-25");
    assert!(
        f.core
            .managed_mcp(
                Actor::Human(caller.clone()),
                f.work,
                grant,
                json!({"jsonrpc":"2.0","method":"notifications/initialized"})
            )
            .await
            .unwrap()
            .is_none()
    );
    let listed = f
        .core
        .managed_mcp(
            Actor::Human(caller.clone()),
            f.work,
            grant,
            json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        )
        .await
        .unwrap()
        .unwrap();
    let tool = format!("invoke_{}", aid.simple());
    assert!(
        listed["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["name"] == tool)
    );
    assert_eq!(f.core.managed_mcp(Actor::Human(caller.clone()),f.work,grant,json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"unknown","arguments":{}}})).await.unwrap().unwrap()["error"]["code"],-32602);
    let invocation = ouroboros_contracts::AdapterInvocationRequest {
        activation_id: aid,
        execution: verification.clone(),
    };
    let (one, two) = tokio::join!(
        f.core.invoke_adapter(
            Actor::Human(caller.clone()),
            id,
            "invoke-one",
            invocation.clone()
        ),
        f.core.invoke_adapter(
            Actor::Human(caller.clone()),
            id,
            "invoke-two",
            invocation.clone()
        )
    );
    let one = one.unwrap();
    let _two = two.unwrap();
    assert_eq!(
        f.core
            .invoke_adapter(
                Actor::Human(caller.clone()),
                id,
                "invoke-one",
                invocation.clone()
            )
            .await
            .unwrap()
            .resource_id,
        one.resource_id
    );
    assert!(matches!(
        f.core
            .invoke_adapter(
                Actor::Human(caller.clone()),
                id,
                "invoke-three",
                invocation.clone()
            )
            .await,
        Err(Error::Capacity)
    ));
    let uses: i64 = sqlx::query_scalar("SELECT count(*) FROM adapter_invocations WHERE firm_id=$1")
        .bind(f.core.firm)
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(uses, 2);
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.accept') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core.runtime_claim(one.intent_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE resource_scopes SET operations=operations||ARRAY['adapter.accept'] WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    let mcp_full=f.core.managed_mcp(Actor::Human(caller.clone()),f.work,grant,json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":tool,"arguments":{"request_key":"mcp-overflow","agent_delegation_id":child}}})).await.unwrap().unwrap();
    assert_eq!(mcp_full["result"]["isError"], true);
    assert_eq!(
        mcp_full["result"]["structuredContent"]["error"],
        "capacity_exhausted"
    );
    sqlx::query("UPDATE resource_targets SET active=false WHERE firm_id=$1 AND id='model'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core.runtime_claim(one.intent_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    let unavailable = f
        .core
        .managed_mcp(
            Actor::Human(caller.clone()),
            f.work,
            grant,
            json!({"jsonrpc":"2.0","id":40,"method":"tools/list"}),
        )
        .await
        .unwrap()
        .unwrap();
    assert!(
        !unavailable["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["name"] == tool)
    );
    sqlx::query("UPDATE resource_targets SET active=true WHERE firm_id=$1 AND id='model'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    let stop = ouroboros_contracts::AdapterStopRequest {
        work_id: Some(f.work),
        delegation_id: Some(grant),
        activation_id: aid,
    };
    let stopped = f
        .core
        .stop_adapter(
            Actor::Human(caller.clone()),
            id,
            "stop-adapter",
            stop.clone(),
        )
        .await
        .unwrap();
    assert_eq!(stopped["termination_confirmed"], false);
    assert_eq!(
        f.core
            .stop_adapter(
                Actor::Human(caller.clone()),
                id,
                "stop-adapter",
                stop.clone()
            )
            .await
            .unwrap(),
        stopped
    );
    assert!(matches!(
        f.core.runtime_claim(one.intent_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        f.core
            .invoke_adapter(Actor::Human(caller.clone()), id, "invoke-one", invocation)
            .await,
        Err(Error::Denied)
    ));
    let listed = f
        .core
        .managed_mcp(
            Actor::Human(caller.clone()),
            f.work,
            grant,
            json!({"jsonrpc":"2.0","id":5,"method":"tools/list"}),
        )
        .await
        .unwrap()
        .unwrap();
    assert!(
        !listed["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["name"] == tool)
    );
    let inspected=f.core.managed_mcp(Actor::Human(caller.clone()),f.work,grant,json!({"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"execution_get","arguments":{"execution_id":one.resource_id}}})).await.unwrap().unwrap();
    assert_eq!(
        inspected["result"]["structuredContent"]["id"],
        json!(one.resource_id)
    );
    let mut resurrect = f.execution();
    resurrect.delegation_id = grant;
    resurrect.agent_delegation_id = Some(child);
    resurrect.predecessor_execution_id = Some(one.resource_id);
    assert!(matches!(
        f.core
            .start(&caller, "managed-successor-bypass", resurrect)
            .await,
        Err(Error::Denied)
    ));
    assert!(
        sqlx::query("DELETE FROM adapter_invocations WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
    let mut short = acceptance.clone();
    short.max_calls = 1;
    short.lifetime_seconds = 2;
    let short = f
        .core
        .accept_adapter(Actor::Human(caller.clone()), id, "short-window", short)
        .await
        .unwrap();
    let replacement = ouroboros_contracts::AdapterActivationRequest {
        acceptance_id: Uuid::parse_str(short["id"].as_str().unwrap()).unwrap(),
        expected_activation_id: Some(aid),
        ..activation.clone()
    };
    let selected = f
        .core
        .activate_adapter(
            Actor::Human(caller.clone()),
            id,
            "replacement",
            replacement.clone(),
        )
        .await
        .unwrap();
    let next_aid = Uuid::parse_str(selected["id"].as_str().unwrap()).unwrap();
    // Old stop replay is historical and cannot stop the selected replacement.
    assert_eq!(
        f.core
            .stop_adapter(
                Actor::Human(caller.clone()),
                id,
                "stop-adapter",
                stop.clone()
            )
            .await
            .unwrap(),
        stopped
    );
    assert!(matches!(
        f.core
            .stop_adapter(Actor::Human(caller.clone()), id, "stale-stop", stop)
            .await,
        Err(Error::Conflict)
    ));
    let next = ouroboros_contracts::AdapterInvocationRequest {
        activation_id: next_aid,
        execution: verification.clone(),
    };
    let (left, right) = tokio::join!(
        f.core.invoke_adapter(
            Actor::Human(caller.clone()),
            id,
            "last-slot-left",
            next.clone()
        ),
        f.core
            .invoke_adapter(Actor::Human(caller.clone()), id, "last-slot-right", next)
    );
    let pending = match (left, right) {
        (Ok(a), Err(Error::Capacity)) | (Err(Error::Capacity), Ok(a)) => a,
        _ => panic!("one remaining slot must admit exactly one call"),
    };
    tokio::time::sleep(std::time::Duration::from_millis(2100)).await;
    assert!(matches!(
        f.core.runtime_claim(pending.intent_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    assert_eq!(
        f.core
            .activate_adapter(Actor::Human(caller.clone()), id, "replacement", replacement)
            .await
            .unwrap(),
        selected
    );
    acceptance.max_calls = 3;
    assert!(matches!(
        f.core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "acceptance",
                acceptance.clone()
            )
            .await,
        Err(Error::Conflict)
    ));
    acceptance.max_calls = 0;
    assert!(matches!(
        f.core
            .accept_adapter(
                Actor::Human(caller.clone()),
                id,
                "invalid-acceptance",
                acceptance.clone()
            )
            .await,
        Err(Error::Invalid)
    ));
    acceptance.max_calls = 2;
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.accept') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core
            .accept_adapter(Actor::Human(caller.clone()), id, "acceptance", acceptance)
            .await,
        Err(Error::Denied)
    ));
    assert!(
        sqlx::query("DELETE FROM adapter_acceptances WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
    assessment.conclusion = "supported".into();
    assert!(matches!(
        f.core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "assessment",
                assessment.clone()
            )
            .await,
        Err(Error::Conflict)
    ));
    assessment.verification_execution_id = source.resource_id;
    assert!(matches!(
        f.core
            .evaluate_adapter(
                Actor::Human(caller.clone()),
                id,
                "foreign-evidence",
                assessment.clone()
            )
            .await,
        Err(Error::Denied)
    ));
    assessment.verification_execution_id = accepted.resource_id;
    assessment.conclusion = "unsupported".into();
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.evaluate') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core
            .evaluate_adapter(Actor::Human(caller.clone()), id, "assessment", assessment)
            .await,
        Err(Error::Denied)
    ));
    assert!(
        sqlx::query("DELETE FROM adapter_evaluations WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
    let mut ordinary = verification.clone();
    ordinary.program = f.execution().program;
    f.core
        .start(&caller, "ordinary-not-verification", ordinary)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .verify_adapter(
                Actor::Human(caller),
                id,
                "ordinary-not-verification",
                verification
            )
            .await,
        Err(Error::Conflict)
    ));
    // Removing only verification scope restricts Runtime claim even with execution.start intact.
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'adapter.verify') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='model'")
        .bind(f.core.firm).bind(grant).execute(&f.db).await.unwrap();
    assert!(matches!(
        f.core.runtime_claim(accepted.intent_id, RUNTIME).await,
        Err(Error::Denied)
    ));
    let state: String = sqlx::query_scalar("SELECT state FROM intents WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(accepted.intent_id)
        .fetch_one(&f.db)
        .await
        .unwrap();
    assert_eq!(state, "accepted");
    assert!(
        sqlx::query("UPDATE adapter_submissions SET program='{}' WHERE firm_id=$1 AND id=$2")
            .bind(f.core.firm)
            .bind(id)
            .execute(&f.db)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn backend_observation_is_original_worker_bound_and_not_work_success() {
    let f = Fixture::new().await;
    let accepted = f
        .core
        .start(&f.human, "observed-program", f.execution())
        .await
        .unwrap();
    let (ticket, peer) = f.bind(&accepted).await;
    let mut report = ouroboros_contracts::RuntimeProgramObservation {
        instance_id: ticket.instance_id,
        generation: ticket.generation,
        manifest_digest: ticket.program.as_ref().unwrap().manifest_digest.clone(),
        exec_id: "a".repeat(64),
        exit_code: 7,
        stdout_bytes: 0,
        stderr_bytes: 0,
        stdout_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".into(),
        stderr_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".into(),
    };
    assert!(matches!(
        f.core
            .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
            .await,
        Err(Error::Denied)
    ));
    f.finish_input(&peer).await;
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
    assert!(matches!(
        f.core
            .runtime_program_observation(ticket.execution_id, "foreign-runtime", &report)
            .await,
        Err(Error::Denied)
    ));
    report.generation = Uuid::new_v4();
    assert!(matches!(
        f.core
            .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
            .await,
        Err(Error::Denied)
    ));
    report.generation = ticket.generation;
    report.stdout_bytes = f.profile.max_output_bytes + 1;
    assert!(matches!(
        f.core
            .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
            .await,
        Err(Error::Denied)
    ));
    report.stdout_bytes = 0;
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(f.core.firm)
        .bind(f.agent_grant)
        .execute(&f.db)
        .await
        .unwrap();
    f.core
        .runtime_terminated(ticket.execution_id, RUNTIME)
        .await
        .unwrap();
    f.core
        .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
        .await
        .unwrap();
    f.core
        .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
        .await
        .unwrap();
    let view = f
        .core
        .read(&f.human, "executions", ticket.execution_id)
        .await
        .unwrap();
    assert_eq!(view["program_observation"]["receipt"], json!(report));
    assert_eq!(view["program_observation"]["work_success_confirmed"], false);
    assert_ne!(view["state"], "succeeded");
    report.exit_code = 0;
    assert!(matches!(
        f.core
            .runtime_program_observation(ticket.execution_id, RUNTIME, &report)
            .await,
        Err(Error::Conflict)
    ));
    assert!(
        sqlx::query("DELETE FROM program_observations WHERE firm_id=$1")
            .bind(f.core.firm)
            .execute(&f.db)
            .await
            .is_err()
    );
}
