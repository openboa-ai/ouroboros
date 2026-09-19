//! Disposable SQL evidence. Program/worker observations are trusted fixtures, not a live service.
use super::*;

#[tokio::test]
async fn service_list_exposes_metadata_and_dependencies_without_payloads_or_read_side_effects() {
    let f = Fixture::new().await;
    let empty = f
        .core
        .work_service_continuations(f.actor(), f.work, None)
        .await
        .unwrap();
    assert_eq!(empty["items"], json!([]));
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, peer) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let child = f
        .core
        .resource_admit(Actor::Instance(peer.clone()), child_request())
        .await
        .unwrap();
    f.core
        .resource_claim(child.intent_id, "other-worker", None)
        .await
        .unwrap();
    f.core
        .resource_complete(
            child.intent_id,
            "other-worker",
            ResourceReply {
                status: 200,
                content_type: "application/json".into(),
                body: "PRIVATE-COMPANY-PAYLOAD".into(),
                receipt: json!({"private":"PRIVATE-COMPANY-RECEIPT"}),
            },
        )
        .await
        .unwrap();
    let before: (i64, i64) = sqlx::query_as("SELECT event_sequence,(SELECT count(*) FROM service_restarts WHERE firm_id=$1) FROM firms WHERE id=$1").bind(f.core.firm).fetch_one(&f.db).await.unwrap();
    let page = f
        .core
        .work_service_continuations(f.actor(), f.work, None)
        .await
        .unwrap();
    assert_eq!(page["source"], "core_service_records");
    assert_eq!(page["coverage"], "registered_call_continuations");
    assert_eq!(page["health_assessed"], false);
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(page["has_more"], false);
    assert!(page["next_cursor"].is_null());
    let service = &page["items"][0];
    assert_eq!(service["root_intent_id"], json!(root.intent_id));
    assert_eq!(service["operation"], "read_snapshot");
    assert_eq!(service["can_stop"], true);
    assert_eq!(service["health"], "not_observed");
    assert_eq!(
        service["dependencies"]["inputs"]["scope"],
        "current_execution_inputs"
    );
    assert_eq!(service["effects"][0]["receipt_available"], true);
    assert_eq!(service["effects"][0]["intent_id"], json!(child.intent_id));
    for target in service["dependencies"]["targets"].as_array().unwrap() {
        assert_eq!(target["selection"], "selection_current");
        assert_eq!(target["caller_access"], "permitted");
        assert_eq!(target["health"], "not_observed");
    }
    let serialized = service.to_string();
    for forbidden in [
        "PRIVATE-COMPANY",
        "input_equals",
        "configuration",
        "invocation",
        "credential",
        "argv",
    ] {
        assert!(!serialized.contains(forbidden), "leaked {forbidden}");
    }
    if let Some(directory) = std::env::var_os("OURO_TEST_TEMP_DIR") {
        // Sanitized disposable contract output for the Mac parser acceptance check.
        std::fs::write(
            std::path::PathBuf::from(directory).join("owner-service-observation.json"),
            serde_json::to_vec_pretty(&page).unwrap(),
        )
        .unwrap();
    }
    assert!(matches!(
        f.core
            .work_service_continuations(Actor::Instance(peer), f.work, None)
            .await,
        Err(Error::Denied)
    ));
    let after: (i64, i64) = sqlx::query_as("SELECT event_sequence,(SELECT count(*) FROM service_restarts WHERE firm_id=$1) FROM firms WHERE id=$1").bind(f.core.firm).fetch_one(&f.db).await.unwrap();
    assert_eq!(
        before, after,
        "reading cannot restart, emit events or change allowance"
    );
}

#[tokio::test]
async fn owner_sees_changed_dependency_and_removed_caller_permission_without_inventing_health() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    sqlx::query("UPDATE resource_targets SET configuration=configuration||'{\"private-test-setting\":true}' WHERE firm_id=$1 AND id='company'").bind(f.core.firm).execute(&f.db).await.unwrap();
    sqlx::query("UPDATE resource_scopes SET operations=array_remove(operations,'db.read') WHERE firm_id=$1 AND delegation_id=$2 AND target_id='company'").bind(f.core.firm).bind(f.human_grant).execute(&f.db).await.unwrap();
    sqlx::query("UPDATE delegations SET actions=array_remove(actions,'execution.stop') WHERE firm_id=$1 AND principal_id=(SELECT principal_id FROM credentials WHERE fingerprint=$2)").bind(f.core.firm).bind(&f.human.fingerprint).execute(&f.db).await.unwrap();
    let observed = f
        .core
        .read_service_continuation(f.actor(), root.intent_id)
        .await
        .unwrap();
    assert_eq!(observed["state"], "authority_blocked");
    assert_eq!(observed["can_stop"], false);
    let dependency = observed["dependencies"]["targets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["target"] == "company")
        .unwrap();
    assert_eq!(dependency["selection"], "selection_changed");
    assert_eq!(dependency["caller_access"], "restricted");
    assert!(!observed.to_string().contains("private-test-setting"));
    sqlx::query("UPDATE resource_targets SET active=false WHERE firm_id=$1 AND id='company'")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    let observed = f
        .core
        .read_service_continuation(f.actor(), root.intent_id)
        .await
        .unwrap();
    assert_eq!(
        observed["dependencies"]["targets"]
            .as_array()
            .unwrap()
            .iter()
            .find(|t| t["target"] == "company")
            .unwrap()["selection"],
        "disabled"
    );
    assert_eq!(observed["restarts_used"], 0);
}

#[tokio::test]
async fn original_service_stop_lookup_preserves_unknown_and_acceptance_until_actual_return() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    let lookup = f
        .core
        .service_continuation_stop_request(f.actor(), root.intent_id, "owner-stop")
        .await
        .unwrap();
    assert_eq!(lookup["recorded"], false);
    assert_eq!(lookup["resubmitted"], false);
    assert!(lookup["receipt"].is_null());
    let current = f
        .core
        .read_service_continuation(f.actor(), root.intent_id)
        .await
        .unwrap();
    assert_eq!(current["desired"], "complete_original_call");
    f.core
        .stop_service_continuation(
            f.actor(),
            root.intent_id,
            "owner-stop",
            ServiceContinuationStop {
                expected_execution_id: root.resource_id,
            },
        )
        .await
        .unwrap();
    let restored = Core::new(f.db.clone(), f.core.firm);
    let lookup = restored
        .service_continuation_stop_request(f.actor(), root.intent_id, "owner-stop")
        .await
        .unwrap();
    assert_eq!(lookup["recorded"], true);
    assert_eq!(lookup["receipt"]["execution_id"], json!(root.resource_id));
    assert_eq!(
        restored
            .read_service_continuation(f.actor(), root.intent_id)
            .await
            .unwrap()["state"],
        "stopping"
    );
    assert_eq!(
        restored
            .service_continuation_stop_request(f.actor(), root.intent_id, "another-key")
            .await
            .unwrap()["recorded"],
        false
    );
    // A separate visible owner cannot discover another issuer's original request by guessing its key.
    let fingerprint: String = sqlx::query_scalar(
        "SELECT fingerprint FROM credentials WHERE firm_id=$1 AND fingerprint<>$2 LIMIT 1",
    )
    .bind(f.core.firm)
    .bind(&f.human.fingerprint)
    .fetch_one(&f.db)
    .await
    .unwrap();
    let other = Actor::Human(Caller { fingerprint });
    assert_eq!(
        restored
            .service_continuation_stop_request(other.clone(), root.intent_id, "owner-stop")
            .await
            .unwrap()["recorded"],
        false
    );
    // Removing this viewer's work control hides both the list and the direct request record.
    sqlx::query("DELETE FROM work_controls WHERE firm_id=$1 AND principal_id=(SELECT principal_id FROM credentials WHERE fingerprint=$2)").bind(f.core.firm).bind(match &other { Actor::Human(c) => &c.fingerprint, _ => unreachable!() }).execute(&f.db).await.unwrap();
    assert!(matches!(
        restored
            .work_service_continuations(other.clone(), f.work, None)
            .await,
        Err(Error::NotFound)
    ));
    assert!(matches!(
        restored
            .read_service_continuation(other.clone(), root.intent_id)
            .await,
        Err(Error::NotFound)
    ));
    assert!(matches!(
        restored
            .service_continuation_stop_request(other, root.intent_id, "owner-stop")
            .await,
        Err(Error::NotFound)
    ));
    f.return_execution(root.resource_id).await;
    let page = restored
        .work_service_continuations(f.actor(), f.work, None)
        .await
        .unwrap();
    assert_eq!(page["items"][0]["state"], "stopped");
    assert_eq!(page["items"][0]["can_stop"], false);
    assert_eq!(page["items"][0]["effects_settled"], false);
}

#[tokio::test]
async fn service_pages_are_bounded_and_cursor_bound_to_actor_work_projection_and_revision() {
    let f = Fixture::new().await;
    let (id, invocation) = f.qualified_service(read_plan()).await;
    let (root, _) = f.released_service(id, invocation).await;
    f.continuation(&root).await;
    // Retained SQL records only: pagination is tested independently of admission/Runtime proof.
    for _ in 0..25 {
        let intent = Uuid::new_v4();
        let execution = Uuid::new_v4();
        sqlx::query("INSERT INTO intents(firm_id,id,principal_id,operation,request_key,input,resource_id,delegation_id,state,work_id) SELECT firm_id,$3,principal_id,operation,$3::text,input,$4,delegation_id,'accepted',work_id FROM intents WHERE firm_id=$1 AND id=$2").bind(f.core.firm).bind(root.intent_id).bind(intent).bind(execution).execute(&f.db).await.unwrap();
        sqlx::query("INSERT INTO executions(firm_id,id,work_id,intent_id) VALUES($1,$2,$3,$4)")
            .bind(f.core.firm)
            .bind(execution)
            .bind(f.work)
            .bind(intent)
            .execute(&f.db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO adapter_invocations SELECT firm_id,activation_id,$3 FROM service_calls WHERE firm_id=$1 AND root_intent_id=$2").bind(f.core.firm).bind(root.intent_id).bind(execution).execute(&f.db).await.unwrap();
        sqlx::query("INSERT INTO service_calls SELECT firm_id,$3,$4,activation_id,binding,invocation,input_fingerprint FROM service_calls WHERE firm_id=$1 AND root_intent_id=$2").bind(f.core.firm).bind(root.intent_id).bind(intent).bind(execution).execute(&f.db).await.unwrap();
        sqlx::query("INSERT INTO service_continuations SELECT firm_id,$3,issuer_id,$3::text,request,worker_id,profile_id,expires_at,created_at FROM service_continuations WHERE firm_id=$1 AND root_intent_id=$2").bind(f.core.firm).bind(root.intent_id).bind(intent).execute(&f.db).await.unwrap();
    }
    let first = f
        .core
        .work_service_continuations(f.actor(), f.work, None)
        .await
        .unwrap();
    assert_eq!(first["items"].as_array().unwrap().len(), 25);
    assert_eq!(first["has_more"], true);
    let cursor = first["next_cursor"].as_str().unwrap();
    let second = f
        .core
        .work_service_continuations(f.actor(), f.work, Some(cursor))
        .await
        .unwrap();
    assert_eq!(second["items"].as_array().unwrap().len(), 1);
    assert_eq!(second["has_more"], false);
    assert!(second["next_cursor"].is_null());
    assert!(
        !first["items"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v["root_intent_id"] == second["items"][0]["root_intent_id"])
    );
    for changed in [
        cursor.replace("service-continuations:", "executions:"),
        cursor.replace(&f.work.to_string(), &Uuid::new_v4().to_string()),
        cursor.replace(&f.human_grant.to_string(), &Uuid::new_v4().to_string()),
    ] {
        if changed != cursor {
            assert!(matches!(
                f.core
                    .work_service_continuations(f.actor(), f.work, Some(&changed))
                    .await,
                Err(Error::Conflict)
            ));
        }
    }
    let principal: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM credentials WHERE fingerprint=$1")
            .bind(&f.human.fingerprint)
            .fetch_one(&f.db)
            .await
            .unwrap();
    let changed = cursor.replace(&principal.to_string(), &Uuid::new_v4().to_string());
    assert_ne!(changed, cursor);
    assert!(matches!(
        f.core
            .work_service_continuations(f.actor(), f.work, Some(&changed))
            .await,
        Err(Error::Conflict)
    ));
    sqlx::query("UPDATE firms SET revision=revision+1 WHERE id=$1")
        .bind(f.core.firm)
        .execute(&f.db)
        .await
        .unwrap();
    assert!(matches!(
        f.core
            .work_service_continuations(f.actor(), f.work, Some(cursor))
            .await,
        Err(Error::Conflict)
    ));
}
