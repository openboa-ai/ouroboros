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

async fn notification_source_snapshot(pool: &PgPool, firm: Uuid) -> Value {
    sqlx::query_scalar("SELECT jsonb_build_object('firm',to_jsonb(f),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY sequence) FROM events e WHERE firm_id=$1),'intents',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM intents i WHERE firm_id=$1),'outbox',(SELECT jsonb_agg(to_jsonb(o) ORDER BY intent_id) FROM outbox o WHERE firm_id=$1),'attempts',(SELECT count(*) FROM attempts WHERE firm_id=$1),'limits',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM limits l WHERE firm_id=$1)) FROM firms f WHERE id=$1")
        .bind(firm).fetch_one(pool).await.unwrap()
}

#[tokio::test]
async fn notification_pagination_preserves_snapshot_and_counts_all_unread() {
    let (c, pool, p, d, _) = setup().await;
    let work = work(&c, &p, d).await;
    let execution = c
        .start(&p, "page-execution", start(work, d, 1))
        .await
        .unwrap()
        .resource_id;
    let principal: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM credentials WHERE fingerprint=$1")
            .bind(&p.fingerprint)
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query("INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data) SELECT $1,n,$2,'native.turn_observed',$3,jsonb_build_object('thread_id','thread','turn_id','turn-'||n,'status','completed') FROM generate_series(101,153) n")
        .bind(c.firm).bind(principal).bind(execution).execute(&pool).await.unwrap();
    sqlx::query("UPDATE firms SET event_sequence=153 WHERE id=$1")
        .bind(c.firm)
        .execute(&pool)
        .await
        .unwrap();
    let first = c.notifications(&p, None).await.unwrap();
    assert!(first["cursor"].is_null());
    assert_eq!(first["items"].as_array().unwrap().len(), 50);
    assert_eq!(first["unread"]["total"], 53);
    assert_eq!(first["has_more"], true);
    let cursor = first["next_cursor"].as_str().unwrap();
    let ids: Vec<String> = first["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["id"].as_str().unwrap().to_owned())
        .collect();
    assert_eq!(
        c.read_notifications(&p, &ids).await.unwrap()["unread"]["total"],
        3
    );
    sqlx::query("INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data) VALUES($1,154,$2,'native.turn_observed',$3,'{\"thread_id\":\"thread\",\"turn_id\":\"new-turn\",\"status\":\"failed\"}')")
        .bind(c.firm).bind(principal).bind(execution).execute(&pool).await.unwrap();
    sqlx::query("UPDATE firms SET event_sequence=154 WHERE id=$1")
        .bind(c.firm)
        .execute(&pool)
        .await
        .unwrap();
    let second = c.notifications(&p, Some(cursor)).await.unwrap();
    assert_eq!(second["cursor"], cursor);
    assert!(second["next_cursor"].is_null());
    assert_eq!(second["items"].as_array().unwrap().len(), 3);
    assert_eq!(second["unread"]["total"], 3);
    assert_eq!(second["snapshot_sequence"], 153);
    assert_eq!(second["has_more"], false);
    assert_eq!(second["items"][0]["id"], "event:103");
    let refreshed = c.notifications(&p, None).await.unwrap();
    assert_eq!(refreshed["unread"]["total"], 4);
    assert_eq!(refreshed["items"][0]["id"], "event:154");
}

#[tokio::test]
async fn notifications_preserve_sources_dedupe_history_and_fence_personal_reads() {
    let (c, pool, p, d, inspector) = setup().await;
    let w = work(&c, &p, d).await;
    let hidden = c
        .create_work(
            &p,
            "other-work",
            WorkRequest {
                delegation_id: d,
                purpose: "separate notification scope".into(),
                parent_work_id: None,
            },
        )
        .await
        .unwrap()
        .resource_id;
    let execution = c
        .start(&p, "visible", start(w, d, 1))
        .await
        .unwrap()
        .resource_id;
    let hidden_execution = c
        .start(&p, "hidden", start(hidden, d, 1))
        .await
        .unwrap()
        .resource_id;
    let principal: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM credentials WHERE fingerprint=$1")
            .bind(&p.fingerprint)
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(inspector)
        .bind(w)
        .execute(&pool)
        .await
        .unwrap();
    // Explicit historical fixture: NULL work_id, repeated terminal, and a sibling work.
    sqlx::query("INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data,work_id) SELECT $1,v.seq,$2,'native.turn_observed',v.execution,jsonb_build_object('source','native_runtime','thread_id','fixture-thread','turn_id',v.turn,'status',v.status,'body','private-transcript'),NULL FROM (VALUES (101,$3::uuid,'one','completed'),(102,$3::uuid,'one','completed'),(103,$3::uuid,'two','failed'),(104,$4::uuid,'hidden','completed')) v(seq,execution,turn,status)")
        .bind(c.firm).bind(principal).bind(execution).bind(hidden_execution).execute(&pool).await.unwrap();
    sqlx::query("UPDATE firms SET event_sequence=104 WHERE id=$1")
        .bind(c.firm)
        .execute(&pool)
        .await
        .unwrap();
    let before = notification_source_snapshot(&pool, c.firm).await;
    let first = c.notifications(&p, None).await.unwrap();
    let again = c.notifications(&p, None).await.unwrap();
    assert_eq!(first["items"], again["items"]);
    assert_eq!(first["unread"], again["unread"]);
    assert_eq!(first["items"].as_array().unwrap().len(), 2);
    assert_eq!(first["items"][0]["id"], "event:103");
    assert_eq!(first["items"][1]["id"], "event:101");
    assert_eq!(first["unread"]["total"], 2);
    assert_eq!(first["unread"]["by_category"]["execution"], 2);
    assert!(!first.to_string().contains("private-transcript"));
    assert_eq!(before, notification_source_snapshot(&pool, c.firm).await);
    assert!(matches!(
        c.read_notifications(&p, &["event:101".into(), "event:9999".into()])
            .await,
        Err(Error::NotFound)
    ));
    assert!(matches!(
        c.read_notifications(&p, &["event:104".into()]).await,
        Err(Error::NotFound)
    ));
    assert_eq!(
        c.notifications(&p, None).await.unwrap()["unread"]["total"],
        2
    );
    let receipts: i64 =
        sqlx::query_scalar("SELECT count(*) FROM owner_notification_reads WHERE firm_id=$1")
            .bind(c.firm)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        receipts, 0,
        "rejected batches must not create partial receipts"
    );
    let ids = vec!["event:101".to_owned(), "event:103".to_owned()];
    let read = c.read_notifications(&p, &ids).await.unwrap();
    let replay = c.read_notifications(&p, &ids).await.unwrap();
    assert_eq!(
        read, replay,
        "an acknowledgment replay retains its original timestamps"
    );
    assert_eq!(read["unread"]["total"], 0);
    assert!(read["read_at"].as_str().unwrap().contains('T'));
    let read_page = c.notifications(&p, None).await.unwrap();
    assert_eq!(read_page["unread"]["by_category"]["execution"], 0);
    assert!(
        read_page["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|item| item["read_at"].is_string())
    );
    assert_eq!(before, notification_source_snapshot(&pool, c.firm).await);

    let other_principal = Uuid::new_v4();
    let other_grant = Uuid::new_v4();
    let other = Caller {
        fingerprint: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    sqlx::query("INSERT INTO principals VALUES($1,$2,'human',true)")
        .bind(c.firm)
        .bind(other_principal)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO credentials VALUES($1,$2,$3,true,clock_timestamp()+interval '1 hour')",
    )
    .bind(&other.fingerprint)
    .bind(c.firm)
    .bind(other_principal)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO delegations(firm_id,id,principal_id,actions,expires_at,work_root_id) VALUES($1,$2,$3,ARRAY['inspect'],clock_timestamp()+interval '1 hour',$4)")
        .bind(c.firm).bind(other_grant).bind(other_principal).bind(hidden).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
        .bind(c.firm)
        .bind(hidden)
        .bind(other_principal)
        .execute(&pool)
        .await
        .unwrap();
    let other_page = c.notifications(&other, None).await.unwrap();
    assert_eq!(other_page["items"].as_array().unwrap().len(), 1);
    assert_eq!(other_page["items"][0]["id"], "event:104");
    assert!(matches!(
        c.read_notifications(&other, &ids).await,
        Err(Error::NotFound)
    ));
    let first_cursor = format!(
        "{}/{}:{}:notifications:{}:0",
        c.firm, principal, first["authority_revision"], first["snapshot_sequence"]
    );
    assert!(matches!(
        c.notifications(&other, Some(&first_cursor)).await,
        Err(Error::Conflict)
    ));
    // Grant the same source scope explicitly: another human still has independent unread state.
    sqlx::query("UPDATE delegations SET work_root_id=$3 WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(other_grant)
        .bind(w)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO work_controls VALUES($1,$2,$3)")
        .bind(c.firm)
        .bind(w)
        .bind(other_principal)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        c.notifications(&other, None).await.unwrap()["unread"]["total"],
        2
    );
    assert_eq!(
        c.notifications(&p, None).await.unwrap()["unread"]["total"],
        0
    );
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(other_grant)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(
        c.notifications(&other, None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        c.read_notifications(&other, &ids).await,
        Err(Error::Denied)
    ));
    sqlx::query("UPDATE credentials SET enabled=false WHERE fingerprint=$1")
        .bind(&p.fingerprint)
        .execute(&pool)
        .await
        .unwrap();
    assert!(matches!(
        c.notifications(&p, None).await,
        Err(Error::Denied)
    ));
    assert!(matches!(
        c.read_notifications(&p, &ids).await,
        Err(Error::Denied)
    ));
}

#[tokio::test]
async fn message_notifications_require_current_read_scope_and_recipient_membership() {
    let (c, pool, p, d, inspector) = setup().await;
    let w = work(&c, &p, d).await;
    let agent = Uuid::new_v4();
    let principal: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM credentials WHERE fingerprint=$1")
            .bind(&p.fingerprint)
            .fetch_one(&pool)
            .await
            .unwrap();
    sqlx::query("INSERT INTO principals VALUES($1,$2,'agent',true)")
        .bind(c.firm)
        .bind(agent)
        .execute(&pool)
        .await
        .unwrap();
    for (grant, action) in [(d, "conversation.create"), (inspector, "conversation.read")] {
        sqlx::query(
            "UPDATE delegations SET actions=array_append(actions,$3) WHERE firm_id=$1 AND id=$2",
        )
        .bind(c.firm)
        .bind(grant)
        .bind(action)
        .execute(&pool)
        .await
        .unwrap();
    }
    let conversation = c
        .create_conversation(
            &p,
            "notification-conversation",
            ouroboros_contracts::ConversationRequest {
                delegation_id: d,
                work_id: w,
                responsible_agent_id: agent,
            },
        )
        .await
        .unwrap()
        .resource_id;
    let intent = Uuid::new_v4();
    let message = Uuid::new_v4();
    // A persisted agent message and its exact acceptance event, without a live agent runtime.
    sqlx::query("INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,state,work_id) VALUES($1,$2,$3,'conversation.send','fixture-message','{}',$4,'succeeded',$5)")
        .bind(c.firm).bind(intent).bind(agent).bind(message).bind(w).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO conversation_messages(firm_id,conversation_id,id,sequence,intent_id,author_principal_id,author_kind,text) VALUES($1,$2,$3,1,$4,$5,'agent','private-message-body')")
        .bind(c.firm).bind(conversation).bind(message).bind(intent).bind(agent).execute(&pool).await.unwrap();
    sqlx::query("UPDATE conversations SET sequence=1,content_bytes=20 WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(conversation)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO conversation_recipients(firm_id,conversation_id,message_id,principal_id,membership_revision) VALUES($1,$2,$3,$4,0)")
        .bind(c.firm).bind(conversation).bind(message).bind(principal).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO events(firm_id,sequence,principal_id,kind,resource_id,data,work_id) VALUES($1,201,$2,'intent.accepted',$3,'{\"operation\":\"conversation.send\"}',$4)")
        .bind(c.firm).bind(agent).bind(intent).bind(w).execute(&pool).await.unwrap();
    sqlx::query("UPDATE firms SET event_sequence=201 WHERE id=$1")
        .bind(c.firm)
        .execute(&pool)
        .await
        .unwrap();
    let page = c.notifications(&p, None).await.unwrap();
    assert_eq!(page["unread"]["total"], 1);
    assert_eq!(page["unread"]["by_category"]["message"], 1);
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        page["items"][0]["source"]["message_id"],
        message.to_string()
    );
    assert!(!page.to_string().contains("private-message-body"));
    let ids = vec!["event:201".to_owned()];
    c.read_notifications(&p, &ids).await.unwrap();
    sqlx::query("UPDATE delegations SET actions=array_remove(actions,'conversation.read') WHERE firm_id=$1 AND id=$2")
        .bind(c.firm).bind(inspector).execute(&pool).await.unwrap();
    assert!(
        c.notifications(&p, None).await.unwrap()["items"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert!(matches!(
        c.read_notifications(&p, &ids).await,
        Err(Error::NotFound)
    ));
    sqlx::query("UPDATE delegations SET actions=array_append(actions,'conversation.read') WHERE firm_id=$1 AND id=$2")
        .bind(c.firm).bind(inspector).execute(&pool).await.unwrap();
    for active in [false, true] {
        sqlx::query("UPDATE conversation_participants SET active=$4,revision=revision+1 WHERE firm_id=$1 AND conversation_id=$2 AND principal_id=$3")
            .bind(c.firm).bind(conversation).bind(principal).bind(active).execute(&pool).await.unwrap();
        let hidden = c.notifications(&p, None).await.unwrap();
        assert!(
            hidden["items"].as_array().unwrap().is_empty(),
            "leaving and rejoining cannot revive an old recipient epoch"
        );
        assert_eq!(hidden["unread"]["total"], 0);
        assert!(matches!(
            c.read_notifications(&p, &ids).await,
            Err(Error::NotFound)
        ));
    }
}

#[tokio::test]
async fn original_request_lookup_is_principal_scoped_read_only_and_revocation_aware() {
    let (c, pool, p, d, inspector) = setup().await;
    let w = work(&c, &p, d).await;
    let before = notification_source_snapshot(&pool, c.firm).await;
    let found = c
        .intent_by_request_key(&p, "work.create", "work")
        .await
        .unwrap();
    assert_eq!(found["recorded"], true);
    assert_eq!(found["intent"]["resource_id"], w.to_string());
    assert_eq!(found["resubmitted"], false);
    assert!(found["intent"].get("input").is_none());
    assert_eq!(
        c.intent_by_request_key(&p, "execution.start", "work")
            .await
            .unwrap()["recorded"],
        false
    );
    assert_eq!(
        c.intent_by_request_key(&p, "work.create", "missing")
            .await
            .unwrap()["recorded"],
        false
    );
    assert_eq!(before, notification_source_snapshot(&pool, c.firm).await);
    sqlx::query("UPDATE delegations SET revoked=true WHERE firm_id=$1 AND id=$2")
        .bind(c.firm)
        .bind(inspector)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        c.intent_by_request_key(&p, "work.create", "work")
            .await
            .is_err()
    );
}
