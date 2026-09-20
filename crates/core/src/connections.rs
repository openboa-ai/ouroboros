//! Immutable fixed-provider proposals; no submission path changes active configuration.
use super::*;
use ouroboros_contracts::ConnectionCandidateRequest;
use sqlx::postgres::PgRow;

fn candidate(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"work_id":row.get::<Uuid,_>("work_id"),
        "target":row.get::<String,_>("target_id"),"author_id":row.get::<Uuid,_>("author_id"),
        "origin_instance_id":row.get::<Option<Uuid>,_>("origin_instance_id"),
        "origin_generation":row.get::<Option<Uuid>,_>("origin_generation"),
        "enrollment_intent_id":row.get::<Uuid,_>("enrollment_intent_id"),
        "worker_id":row.get::<String,_>("worker_id"),
        "base_configuration":row.get::<Value,_>("base_configuration"),
        "proposed_configuration":row.get::<Value,_>("proposed_configuration"),"state":"proposed"})
}
fn provider_configuration(value: &Value, target: &str) -> Result<(Uuid, u64)> {
    if serde_json::to_vec(value).map_err(|_| Error::Invalid)?.len() > 8192 {
        return Err(Error::Invalid);
    }
    let fields = value.as_object().ok_or(Error::Invalid)?;
    let keys = [
        "target",
        "endpoint",
        "credential_id",
        "credential_version",
        "timeout_ms",
        "max_response_bytes",
    ];
    let optional = ["chatgpt_account_id", "codex_responses_lite", "auth_module"];
    if fields.len()
        != keys.len()
            + optional
                .iter()
                .filter(|key| fields.contains_key(**key))
                .count()
        || !keys.iter().all(|k| fields.contains_key(*k))
        || value["target"] != target
    {
        return Err(Error::Invalid);
    }
    if let Some(module) = value.get("auth_module") {
        let module: ouroboros_contracts::auth_module::AuthModuleSelection =
            serde_json::from_value(module.clone()).map_err(|_| Error::Invalid)?;
        module.validate().map_err(|_| Error::Invalid)?;
    }
    if let Some(lite) = value.get("codex_responses_lite") {
        let lite = lite.as_bool().ok_or(Error::Invalid)?;
        if lite && value["chatgpt_account_id"].is_null() {
            return Err(Error::Invalid);
        }
    }
    if let Some(account) = value.get("chatgpt_account_id").filter(|v| !v.is_null()) {
        let account = account.as_str().ok_or(Error::Invalid)?;
        if value["endpoint"] != "https://chatgpt.com/backend-api/codex/responses"
            || !(1..=128).contains(&account.len())
            || !account
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
        {
            return Err(Error::Invalid);
        }
    }
    let endpoint = url::Url::parse(value["endpoint"].as_str().ok_or(Error::Invalid)?)
        .map_err(|_| Error::Invalid)?;
    if endpoint.scheme() != "https"
        || endpoint.host_str().is_none()
        || !endpoint.username().is_empty()
        || endpoint.password().is_some()
        || endpoint.query().is_some()
        || endpoint.fragment().is_some()
        || !endpoint.path().ends_with("/responses")
    {
        return Err(Error::Invalid);
    }
    let credential = value["credential_id"]
        .as_str()
        .and_then(|v| Uuid::parse_str(v).ok())
        .filter(|id| !id.is_nil())
        .ok_or(Error::Invalid)?;
    let version = value["credential_version"]
        .as_u64()
        .filter(|v| *v > 0 && *v <= i64::MAX as u64)
        .ok_or(Error::Invalid)?;
    value["timeout_ms"]
        .as_u64()
        .filter(|v| (1..=30000).contains(v))
        .ok_or(Error::Invalid)?;
    value["max_response_bytes"]
        .as_u64()
        .filter(|v| (1..=2097152).contains(v))
        .ok_or(Error::Invalid)?;
    Ok((credential, version))
}
impl Core {
    /// Retain a review with authoritative receipt references. Recommendations do not activate.
    pub async fn review_connection(
        &self,
        actor: Actor,
        id: Uuid,
        request_key: &str,
        request: ouroboros_contracts::ConnectionReviewRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(request_key).map_err(|_| Error::Invalid)?;
        let ids = &request.evidence_intent_ids;
        if !matches!(request.recommendation.as_str(), "recommend" | "reject")
            || request.rationale.trim().is_empty()
            || request.rationale.len() > 4096
            || ids.is_empty()
            || ids.len() > 8
            || ids.iter().any(Uuid::is_nil)
            || ids.iter().collect::<std::collections::HashSet<_>>().len() != ids.len()
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let actual_work: Uuid = row.get("work_id");
        let (principal, work, grant, instance) = self
            .resource_actor(
                &mut tx,
                &actor,
                request.work_id.or(Some(actual_work)),
                request.delegation_id,
            )
            .await?;
        if work != actual_work || principal == row.get::<Uuid, _>("author_id") {
            return Err(Error::Denied);
        }
        let target: String = row.get("target_id");
        if row
            .get::<Value, _>("proposed_configuration")
            .get("auth_module")
            .is_some()
        {
            self.resource_permission(
                &mut tx,
                principal,
                work,
                grant,
                &target,
                "auth-module.review",
            )
            .await?;
        }
        self.resource_permission(
            &mut tx,
            principal,
            work,
            grant,
            &target,
            "connection.review",
        )
        .await?;
        self.resource_permission(&mut tx, principal, work, grant, &target, "inspect")
            .await?;
        let source: String = sqlx::query_scalar(
            "SELECT target_id FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(row.get::<Uuid, _>("enrollment_intent_id"))
        .fetch_one(&mut *tx)
        .await?;
        self.resource_permission(&mut tx, principal, work, grant, &source, "inspect")
            .await?;
        // Read all referenced outcomes under current authority, including on replay.
        // A succeeded call is evidence of that call only, not candidate qualification.
        let mut evidence = Vec::new();
        for evidence_id in ids {
            let e = sqlx::query("SELECT r.target_id,r.operation,r.configuration FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND i.state='succeeded'")
                .bind(self.firm).bind(evidence_id).bind(work).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
            let evidence_target: String = e.get("target_id");
            self.resource_permission_namespace(
                &mut tx,
                principal,
                work,
                grant,
                &evidence_target,
                "inspect",
                super::workspaces::namespace(&e.get::<Value, _>("configuration"))?,
            )
            .await?;
            // Reference protected source records without copying arbitrary response bodies.
            evidence.push(json!({"intent_id":evidence_id,"target":evidence_target,
                "operation":e.get::<String,_>("operation"),"observed_state":"succeeded"}));
        }
        let fixed = json!({"candidate_id":id,"work_id":work,"recommendation":request.recommendation,
            "rationale":request.rationale,"evidence_intent_ids":ids});
        let old = sqlx::query("SELECT * FROM connection_reviews WHERE firm_id=$1 AND reviewer_id=$2 AND request_key=$3")
            .bind(self.firm).bind(principal).bind(request_key).fetch_optional(&mut *tx).await?;
        let review = if let Some(old) = old {
            if old.get::<Value, _>("request") != fixed {
                return Err(Error::Conflict);
            }
            old
        } else {
            let count: i64 = sqlx::query_scalar(
                "SELECT count(*) FROM connection_reviews WHERE firm_id=$1 AND candidate_id=$2",
            )
            .bind(self.firm)
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;
            if count >= 64 {
                return Err(Error::Capacity);
            }
            let review_id = Uuid::new_v4();
            let inserted = sqlx::query("INSERT INTO connection_reviews(firm_id,id,candidate_id,reviewer_id,origin_instance_id,origin_generation,request_key,request,evidence) VALUES($1,$2,$3,$4,$5,(SELECT generation FROM runtime_instances WHERE firm_id=$1 AND instance_id=$5),$6,$7,$8) RETURNING *")
                .bind(self.firm).bind(review_id).bind(id).bind(principal).bind(instance)
                .bind(request_key).bind(fixed).bind(json!(evidence)).fetch_one(&mut *tx).await?;
            self.event(
                &mut tx,
                principal,
                "connection.reviewed",
                review_id,
                json!({"candidate_id":id,"work_id":work}),
            )
            .await?;
            inserted
        };
        let result = json!({"id":review.get::<Uuid,_>("id"),"candidate_id":id,
            "reviewer_id":principal,"origin_instance_id":review.get::<Option<Uuid>,_>("origin_instance_id"),
            "origin_generation":review.get::<Option<Uuid>,_>("origin_generation"),
            "assessment":review.get::<Value,_>("request"),"evidence":review.get::<Value,_>("evidence"),
            "state":"recorded","operating_acceptance":false});
        tx.commit().await?;
        Ok(result)
    }
    pub async fn read_connection_candidate(
        &self,
        actor: Actor,
        id: Uuid,
        work: Option<Uuid>,
        grant: Option<Uuid>,
    ) -> Result<Value> {
        let mut tx = self.fence().await?;
        let row = sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(Error::Denied)?;
        let actual_work: Uuid = row.get("work_id");
        let (principal, work, grant, _) = self
            .resource_actor(&mut tx, &actor, work.or(Some(actual_work)), grant)
            .await?;
        if work != actual_work {
            return Err(Error::Denied);
        }
        self.resource_permission(
            &mut tx,
            principal,
            work,
            grant,
            &row.get::<String, _>("target_id"),
            "inspect",
        )
        .await?;
        let source: String = sqlx::query_scalar(
            "SELECT target_id FROM resource_calls WHERE firm_id=$1 AND intent_id=$2",
        )
        .bind(self.firm)
        .bind(row.get::<Uuid, _>("enrollment_intent_id"))
        .fetch_one(&mut *tx)
        .await?;
        self.resource_permission(&mut tx, principal, work, grant, &source, "inspect")
            .await?;
        let result = candidate(&row);
        tx.commit().await?;
        Ok(result)
    }
    pub async fn propose_connection(
        &self,
        actor: Actor,
        request_key: &str,
        request: ConnectionCandidateRequest,
    ) -> Result<Value> {
        ouroboros_contracts::request_key(request_key).map_err(|_| Error::Invalid)?;
        if request.expected_credential_version == 0
            || request.enrollment_intent_id.is_nil()
            || request.target.is_empty()
            || request.target.len() > 128
        {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let (principal, work, grant, instance) = self
            .resource_actor(&mut tx, &actor, request.work_id, request.delegation_id)
            .await?;
        self.resource_permission(
            &mut tx,
            principal,
            work,
            grant,
            &request.target,
            "connection.propose",
        )
        .await?;
        self.resource_permission(&mut tx, principal, work, grant, &request.target, "inspect")
            .await?;
        let mut fixed = json!({"work_id":work,"target":request.target,"expected_credential_version":request.expected_credential_version,"enrollment_intent_id":request.enrollment_intent_id});
        if let Some(module) = &request.auth_module {
            module.validate().map_err(|_| Error::Invalid)?;
            self.resource_permission(
                &mut tx,
                principal,
                work,
                grant,
                &request.target,
                "auth-module.propose",
            )
            .await?;
            fixed["auth_module"] = json!(module);
        }
        if let Some(row)=sqlx::query("SELECT * FROM connection_candidates WHERE firm_id=$1 AND author_id=$2 AND request_key=$3")
            .bind(self.firm).bind(principal).bind(request_key).fetch_optional(&mut *tx).await? {
            if row.get::<Value,_>("request")!=fixed {return Err(Error::Conflict);}
            let source:String=sqlx::query_scalar("SELECT target_id FROM resource_calls WHERE firm_id=$1 AND intent_id=$2")
                .bind(self.firm).bind(row.get::<Uuid,_>("enrollment_intent_id")).fetch_one(&mut *tx).await?;
            self.resource_permission(&mut tx,principal,work,grant,&source,"inspect").await?;
            let result=candidate(&row);tx.commit().await?;return Ok(result);
        }
        let target=sqlx::query("SELECT configuration,worker_id FROM resource_targets WHERE firm_id=$1 AND id=$2 AND active")
            .bind(self.firm).bind(&request.target).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let configuration: Value = target.get("configuration");
        let (credential, version) = provider_configuration(&configuration, &request.target)?;
        if version != request.expected_credential_version {
            return Err(Error::Conflict);
        }
        let enrollment=sqlx::query("SELECT r.target_id,i.input,r.reply FROM resource_calls r JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id) WHERE r.firm_id=$1 AND r.intent_id=$2 AND r.work_id=$3 AND r.operation='credential.enroll' AND i.state='succeeded'")
            .bind(self.firm).bind(request.enrollment_intent_id).bind(work).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        self.resource_permission(
            &mut tx,
            principal,
            work,
            grant,
            &enrollment.get::<String, _>("target_id"),
            "inspect",
        )
        .await?;
        let input: Value = enrollment.get("input");
        let reply: Value = enrollment.get("reply");
        let next = input["input"]["version"]
            .as_u64()
            .filter(|v| {
                (*v > version || (*v == version && request.auth_module.is_some()))
                    && *v <= i64::MAX as u64
            })
            .ok_or(Error::Invalid)?;
        let receipt = &reply["receipt"];
        if input["input"]["credential_id"] != json!(credential)
            || receipt["source"] != "credential_custody"
            || receipt["intent_id"] != json!(request.enrollment_intent_id)
            || receipt["credential_id"] != json!(credential)
            || receipt["version"] != json!(next)
            || receipt["enrollment_id"] != input["input"]["enrollment_id"]
        {
            return Err(Error::Denied);
        }
        let attempt = receipt["attempt_id"]
            .as_str()
            .and_then(|v| Uuid::parse_str(v).ok())
            .ok_or(Error::Denied)?;
        let proven:bool=sqlx::query_scalar("SELECT count(*)=1 AND bool_and(id=$3 AND state='succeeded') FROM attempts WHERE firm_id=$1 AND intent_id=$2")
            .bind(self.firm).bind(request.enrollment_intent_id).bind(attempt).fetch_one(&mut *tx).await?;
        if !proven {
            return Err(Error::Denied);
        }
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM connection_candidates WHERE firm_id=$1 AND target_id=$2",
        )
        .bind(self.firm)
        .bind(&request.target)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 128 {
            return Err(Error::Capacity);
        }
        let mut proposed = configuration.clone();
        proposed["credential_version"] = json!(next);
        if let Some(module) = &request.auth_module {
            proposed["auth_module"] = json!(module);
        }
        if proposed == configuration {
            return Err(Error::Conflict);
        }
        let id = Uuid::new_v4();
        let row=sqlx::query("INSERT INTO connection_candidates(firm_id,id,work_id,target_id,author_id,origin_instance_id,origin_generation,request_key,request,enrollment_intent_id,worker_id,base_configuration,proposed_configuration) VALUES($1,$2,$3,$4,$5,$6,(SELECT generation FROM runtime_instances WHERE firm_id=$1 AND instance_id=$6),$7,$8,$9,$10,$11,$12) RETURNING *")
            .bind(self.firm).bind(id).bind(work).bind(&request.target).bind(principal).bind(instance)
            .bind(request_key).bind(fixed).bind(request.enrollment_intent_id)
            .bind(target.get::<String,_>("worker_id")).bind(configuration).bind(proposed).fetch_one(&mut *tx).await?;
        self.event(&mut tx,principal,"connection.proposed",id,json!({"work_id":work,"target":request.target,"enrollment_intent_id":request.enrollment_intent_id})).await?;
        let result = candidate(&row);
        tx.commit().await?;
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn configuration() -> Value {
        json!({
            "target":"model-fixture",
            "endpoint":"https://fixture.invalid/responses",
            "credential_id":Uuid::from_u128(1),
            "credential_version":1,
            "timeout_ms":1000,
            "max_response_bytes":4096
        })
    }

    #[test]
    fn legacy_provider_configuration_keeps_its_existing_shape() {
        let mut value = configuration();
        assert_eq!(
            provider_configuration(&value, "model-fixture").unwrap(),
            (Uuid::from_u128(1), 1)
        );
        value["chatgpt_account_id"] = Value::Null;
        assert!(provider_configuration(&value, "model-fixture").is_ok());
        value["headers"] = json!({"x-extra":"rejected"});
        assert!(provider_configuration(&value, "model-fixture").is_err());
    }

    #[test]
    fn subscription_configuration_requires_fixed_origin_and_safe_account() {
        let mut value = configuration();
        value["chatgpt_account_id"] = json!("account-fixture_123");
        assert!(provider_configuration(&value, "model-fixture").is_err());
        value["endpoint"] = json!("https://chatgpt.com/backend-api/codex/responses");
        assert_eq!(
            provider_configuration(&value, "model-fixture").unwrap(),
            (Uuid::from_u128(1), 1)
        );
        for account in [
            json!(""),
            json!("a\r\nx-extra: value"),
            json!("a/b"),
            json!("é"),
            json!("a".repeat(129)),
            json!(123),
        ] {
            value["chatgpt_account_id"] = account;
            assert!(provider_configuration(&value, "model-fixture").is_err());
        }
        value["chatgpt_account_id"] = json!("a".repeat(128));
        assert!(provider_configuration(&value, "model-fixture").is_ok());
        value["headers"] = json!({"x-extra":"rejected"});
        assert!(provider_configuration(&value, "model-fixture").is_err());
    }

    #[test]
    fn codex_lite_configuration_is_boolean_and_subscription_bound() {
        let mut value = configuration();
        value["codex_responses_lite"] = json!(false);
        assert!(provider_configuration(&value, "model-fixture").is_ok());
        value["codex_responses_lite"] = json!(true);
        assert!(provider_configuration(&value, "model-fixture").is_err());
        value["chatgpt_account_id"] = json!("account-fixture");
        assert!(provider_configuration(&value, "model-fixture").is_err());
        value["endpoint"] = json!("https://chatgpt.com/backend-api/codex/responses");
        assert!(provider_configuration(&value, "model-fixture").is_ok());
        for invalid in [Value::Null, json!("true"), json!(1)] {
            value["codex_responses_lite"] = invalid;
            assert!(provider_configuration(&value, "model-fixture").is_err());
        }
    }
}
