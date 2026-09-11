use super::*;
use ouroboros_contracts::{ConversationRequest, MessageRequest};

impl Core {
    pub async fn create_conversation(
        &self,
        caller: impl Into<Actor>,
        key: &str,
        r: ConversationRequest,
    ) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        if let Some(a) = self
            .existing(&mut tx, &ctx, "conversation.create", key, &json!(r))
            .await?
        {
            return Ok(a);
        }
        self.actor_permission(
            &mut tx,
            &ctx,
            r.delegation_id,
            r.work_id,
            "conversation.create",
        )
        .await?;
        let agent:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM principals WHERE firm_id=$1 AND id=$2 AND kind='agent' AND enabled)")
            .bind(self.firm).bind(r.responsible_agent_id).fetch_one(&mut *tx).await?;
        if !agent {
            return Err(Error::Denied);
        }
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM conversations WHERE firm_id=$1 AND work_id=$2",
        )
        .bind(self.firm)
        .bind(r.work_id)
        .fetch_one(&mut *tx)
        .await?;
        if count >= 16 {
            return Err(Error::Capacity);
        }
        let id = Uuid::new_v4();
        let mut a = self
            .intent(
                &mut tx,
                ctx.principal,
                "conversation.create",
                key,
                json!(r),
                (id, Some(r.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, a.intent_id, Some(r.work_id))
            .await?;
        sqlx::query("INSERT INTO conversations(firm_id,id,work_id,responsible_agent_id,create_intent_id) VALUES($1,$2,$3,$4,$5)")
            .bind(self.firm).bind(id).bind(r.work_id).bind(r.responsible_agent_id).bind(a.intent_id).execute(&mut *tx).await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(a.intent_id)
            .execute(&mut *tx)
            .await?;
        for principal in [ctx.principal, r.responsible_agent_id] {
            sqlx::query("INSERT INTO conversation_participants(firm_id,conversation_id,principal_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING")
                .bind(self.firm).bind(id).bind(principal).execute(&mut *tx).await?;
        }
        a.state = IntentState::Succeeded;
        tx.commit().await?;
        Ok(a)
    }

    async fn conversation_access(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        ctx: &ActorContext,
        id: Uuid,
        action: &str,
        grant: Option<Uuid>,
    ) -> Result<(Uuid, Uuid)> {
        let row = sqlx::query(
            "SELECT work_id,responsible_agent_id FROM conversations WHERE firm_id=$1 AND id=$2",
        )
        .bind(self.firm)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(Error::NotFound)?;
        let work: Uuid = row.get("work_id");
        let agent: Uuid = row.get("responsible_agent_id");
        self.conversation_member(tx, id, ctx.principal).await?;
        if let Some(grant) = grant {
            self.actor_permission(tx, ctx, grant, work, action).await?;
        } else {
            self.any_work_permission(tx, ctx, work, action).await?;
        }
        Ok((work, agent))
    }

    pub async fn send_message(
        &self,
        caller: impl Into<Actor>,
        conversation: Uuid,
        key: &str,
        r: MessageRequest,
    ) -> Result<Accepted> {
        if r.text.trim().is_empty() || r.text.len() > 16384 || r.text.contains('\0') {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let input = json!({"conversation_id":conversation,"message":r});
        // Replay still requires access to this conversation, not just broad work inspection.
        let (work, _) = self
            .conversation_access(
                &mut tx,
                &ctx,
                conversation,
                "conversation.send",
                Some(r.delegation_id),
            )
            .await?;
        if let Some(a) = self
            .existing(&mut tx, &ctx, "conversation.send", key, &input)
            .await?
        {
            return Ok(a);
        }
        if let Some(reply) = r.reply_to {
            let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM conversation_messages WHERE firm_id=$1 AND conversation_id=$2 AND id=$3)")
                .bind(self.firm).bind(conversation).bind(reply).fetch_one(&mut *tx).await?;
            if !exists {
                return Err(Error::Invalid);
            }
        }
        let sequence:Option<i64>=sqlx::query_scalar("UPDATE conversations SET sequence=sequence+1,content_bytes=content_bytes+$3 WHERE firm_id=$1 AND id=$2 AND content_bytes+$3<=1048576 AND sequence<1024 RETURNING sequence")
            .bind(self.firm).bind(conversation).bind(r.text.len() as i64).fetch_optional(&mut *tx).await?;
        let sequence = sequence.ok_or(Error::Capacity)?;
        let id = Uuid::new_v4();
        let mut a = self
            .intent(
                &mut tx,
                ctx.principal,
                "conversation.send",
                key,
                input,
                (id, Some(r.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, a.intent_id, Some(work))
            .await?;
        let kind = if ctx.bound.is_some() {
            "agent"
        } else {
            "human"
        };
        sqlx::query("INSERT INTO conversation_messages(firm_id,conversation_id,id,sequence,intent_id,author_principal_id,author_kind,origin_instance_id,origin_generation,reply_to,text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)")
            .bind(self.firm).bind(conversation).bind(id).bind(sequence).bind(a.intent_id).bind(ctx.principal).bind(kind)
            .bind(ctx.bound.as_ref().map(|b|b.instance)).bind(ctx.bound.as_ref().map(|b|b.generation)).bind(r.reply_to).bind(r.text).execute(&mut *tx).await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(a.intent_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT INTO conversation_recipients(firm_id,conversation_id,message_id,principal_id,membership_revision) SELECT firm_id,conversation_id,$3,principal_id,revision FROM conversation_participants WHERE firm_id=$1 AND conversation_id=$2 AND active AND principal_id<>$4")
            .bind(self.firm).bind(conversation).bind(id).bind(ctx.principal).execute(&mut *tx).await?;
        if let Some(bound) = &ctx.bound {
            let native:Option<Value>=sqlx::query_scalar("SELECT jsonb_build_object('execution_id',execution_id,'thread_id',thread_id,'turn_id',turn_id,'source','core_active_turn') FROM native_turns WHERE firm_id=$1 AND execution_id=$2 AND status='inProgress'")
                .bind(self.firm).bind(bound.execution).fetch_optional(&mut *tx).await?;
            sqlx::query("UPDATE conversation_messages SET native_context=$4 WHERE firm_id=$1 AND conversation_id=$2 AND id=$3")
                .bind(self.firm).bind(conversation).bind(id).bind(native).execute(&mut *tx).await?;
        }
        a.state = IntentState::Succeeded;
        tx.commit().await?;
        Ok(a)
    }

    pub async fn conversation_messages(
        &self,
        caller: impl Into<Actor>,
        id: Uuid,
        after: i64,
    ) -> Result<Value> {
        if after < 0 {
            return Err(Error::Invalid);
        }
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let (work, agent) = self
            .conversation_access(&mut tx, &ctx, id, "conversation.read", None)
            .await?;
        let latest: i64 =
            sqlx::query_scalar("SELECT sequence FROM conversations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(id)
                .fetch_one(&mut *tx)
                .await?;
        if after > latest {
            return Err(Error::Conflict);
        }
        let mut messages:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'sequence',sequence,'author_principal_id',author_principal_id,'author_kind',author_kind,'origin_instance_id',origin_instance_id,'origin_generation',origin_generation,'reply_to',reply_to,'text',text,'received_at',received_at,'native_context',native_context,'deliveries',(SELECT COALESCE(jsonb_agg(jsonb_build_object('recipient_principal_id',r.principal_id,'intent_id',d.native_intent_id,'state',i.state) ORDER BY r.principal_id),'[]'::jsonb) FROM conversation_recipients r LEFT JOIN conversation_deliveries d ON (d.firm_id,d.conversation_id,d.message_id,d.recipient_principal_id)=(r.firm_id,r.conversation_id,r.message_id,r.principal_id) LEFT JOIN intents i ON (i.firm_id,i.id)=(d.firm_id,d.native_intent_id) WHERE r.firm_id=m.firm_id AND r.conversation_id=m.conversation_id AND r.message_id=m.id)) FROM conversation_messages m WHERE firm_id=$1 AND conversation_id=$2 AND sequence>$3 ORDER BY sequence LIMIT 9")
            .bind(self.firm).bind(id).bind(after).fetch_all(&mut *tx).await?;
        let more = messages.len() > 8;
        messages.truncate(8);
        let cursor = messages
            .last()
            .and_then(|v| v["sequence"].as_i64())
            .unwrap_or(after);
        Ok(
            json!({"conversation_id":id,"work_id":work,"responsible_agent_id":agent,"messages":messages,"cursor":cursor,"has_more":more,"snapshot_sequence":latest}),
        )
    }
}

impl Core {
    async fn conversation_member(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        conversation: Uuid,
        principal: Uuid,
    ) -> Result<()> {
        let allowed:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM conversation_participants WHERE firm_id=$1 AND conversation_id=$2 AND principal_id=$3 AND active)")
            .bind(self.firm).bind(conversation).bind(principal).fetch_one(&mut **tx).await?;
        if !allowed {
            return Err(Error::Denied);
        }
        Ok(())
    }
    pub async fn set_conversation_participant(
        &self,
        caller: impl Into<Actor>,
        conversation: Uuid,
        key: &str,
        r: ouroboros_contracts::ConversationParticipantRequest,
    ) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let work: Uuid =
            sqlx::query_scalar("SELECT work_id FROM conversations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(conversation)
                .fetch_optional(&mut *tx)
                .await?
                .ok_or(Error::NotFound)?;
        self.actor_permission(&mut tx, &ctx, r.delegation_id, work, "conversation.manage")
            .await?;
        let input = json!({"conversation_id":conversation,"participant":r});
        if let Some(a) = self
            .existing(&mut tx, &ctx, "conversation.participant", key, &input)
            .await?
        {
            return Ok(a);
        }
        let principal:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM principals WHERE firm_id=$1 AND id=$2 AND kind IN ('human','agent') AND enabled)").bind(self.firm).bind(r.principal_id).fetch_one(&mut *tx).await?;
        if !principal {
            return Err(Error::Denied);
        }
        let count:i64=sqlx::query_scalar("SELECT count(*) FROM conversation_participants WHERE firm_id=$1 AND conversation_id=$2 AND principal_id<>$3").bind(self.firm).bind(conversation).bind(r.principal_id).fetch_one(&mut *tx).await?;
        if count >= 32 {
            return Err(Error::Capacity);
        }
        let mut a = self
            .intent(
                &mut tx,
                ctx.principal,
                "conversation.participant",
                key,
                input,
                (conversation, Some(r.delegation_id)),
            )
            .await?;
        self.management_record(&mut tx, &ctx, a.intent_id, Some(work))
            .await?;
        sqlx::query("INSERT INTO conversation_participants(firm_id,conversation_id,principal_id,active) VALUES($1,$2,$3,$4) ON CONFLICT(firm_id,conversation_id,principal_id) DO UPDATE SET active=EXCLUDED.active,revision=conversation_participants.revision+CASE WHEN conversation_participants.active IS DISTINCT FROM EXCLUDED.active THEN 1 ELSE 0 END")
            .bind(self.firm).bind(conversation).bind(r.principal_id).bind(r.active).execute(&mut *tx).await?;
        sqlx::query("UPDATE intents SET state='succeeded' WHERE firm_id=$1 AND id=$2")
            .bind(self.firm)
            .bind(a.intent_id)
            .execute(&mut *tx)
            .await?;
        a.state = IntentState::Succeeded;
        tx.commit().await?;
        Ok(a)
    }

    pub async fn deliver_message(
        &self,
        caller: impl Into<Actor>,
        conversation: Uuid,
        message: Uuid,
        r: ouroboros_contracts::MessageDeliveryRequest,
    ) -> Result<Accepted> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        let (work, _) = self
            .conversation_access(
                &mut tx,
                &ctx,
                conversation,
                "conversation.send",
                Some(r.delegation_id),
            )
            .await?;
        let row=sqlx::query("SELECT text,author_principal_id FROM conversation_messages WHERE firm_id=$1 AND conversation_id=$2 AND id=$3")
            .bind(self.firm).bind(conversation).bind(message).fetch_optional(&mut *tx).await?.ok_or(Error::NotFound)?;
        if row.get::<Uuid, _>("author_principal_id") != ctx.principal {
            return Err(Error::Denied);
        }
        let execution=sqlx::query("SELECT e.work_id,i.input FROM executions e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE e.firm_id=$1 AND e.id=$2")
            .bind(self.firm).bind(r.execution_id).fetch_optional(&mut *tx).await?.ok_or(Error::Denied)?;
        let input: ExecutionRequest =
            serde_json::from_value(execution.get("input")).map_err(|_| Error::Unavailable)?;
        if execution.get::<Uuid, _>("work_id") != work {
            return Err(Error::Denied);
        }
        let recipient: Uuid =
            sqlx::query_scalar("SELECT principal_id FROM delegations WHERE firm_id=$1 AND id=$2")
                .bind(self.firm)
                .bind(input.agent_delegation_id.ok_or(Error::Denied)?)
                .fetch_one(&mut *tx)
                .await?;
        let intended:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM conversation_recipients r JOIN conversation_participants p USING(firm_id,conversation_id,principal_id) WHERE r.firm_id=$1 AND r.conversation_id=$2 AND r.message_id=$3 AND r.principal_id=$4 AND p.active AND p.revision=r.membership_revision)")
            .bind(self.firm).bind(conversation).bind(message).bind(recipient).fetch_one(&mut *tx).await?;
        if !intended {
            return Err(Error::Denied);
        }
        self.conversation_member(&mut tx, conversation, recipient)
            .await?;
        let native = ouroboros_contracts::NativeControlRequest {
            delegation_id: r.delegation_id,
            thread_id: r.thread_id,
            turn_id: r.turn_id,
            instruction: ouroboros_contracts::NativeInstruction::Steer {
                text: row.get("text"),
            },
        };
        let key = format!("conversation:{message}:{recipient}");
        let old:Option<Uuid>=sqlx::query_scalar("SELECT native_intent_id FROM conversation_deliveries WHERE firm_id=$1 AND conversation_id=$2 AND message_id=$3 AND recipient_principal_id=$4")
            .bind(self.firm).bind(conversation).bind(message).bind(recipient).fetch_optional(&mut *tx).await?;
        if let Some(old) = old {
            let result = self
                .existing(
                    &mut tx,
                    &ctx,
                    "execution.steer",
                    &key,
                    &json!({"execution_id":r.execution_id,"request":native}),
                )
                .await?
                .ok_or(Error::Conflict)?;
            if result.intent_id != old {
                return Err(Error::Conflict);
            }
            return Ok(result);
        }
        self.agent_grant(&mut tx, &input).await?;
        self.authorize(
            &mut tx,
            recipient,
            input.agent_delegation_id.ok_or(Error::Denied)?,
            "conversation.read",
        )
        .await?;
        let accepted = self
            .native_control_locked(&mut tx, &ctx, r.execution_id, &key, native)
            .await?;
        if accepted.replayed {
            return Err(Error::Conflict);
        }
        sqlx::query("INSERT INTO conversation_deliveries(firm_id,conversation_id,message_id,native_intent_id,recipient_principal_id) VALUES($1,$2,$3,$4,$5)")
            .bind(self.firm).bind(conversation).bind(message).bind(accepted.intent_id).bind(recipient).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(accepted)
    }
    pub(super) async fn conversation_delivery_allowed(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        intent: Uuid,
    ) -> Result<()> {
        let row=sqlx::query("SELECT d.conversation_id,d.recipient_principal_id,c.work_id,i.principal_id,i.delegation_id,i.origin_instance_id,i.origin_generation,n.execution_id FROM conversation_deliveries d JOIN conversations c ON (c.firm_id,c.id)=(d.firm_id,d.conversation_id) JOIN intents i ON (i.firm_id,i.id)=(d.firm_id,d.native_intent_id) JOIN native_controls n ON (n.firm_id,n.intent_id)=(d.firm_id,d.native_intent_id) WHERE d.firm_id=$1 AND d.native_intent_id=$2")
            .bind(self.firm).bind(intent).fetch_optional(&mut **tx).await?;
        let Some(row) = row else {
            return Ok(());
        };
        let current:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM conversation_deliveries d JOIN conversation_recipients r ON (r.firm_id,r.conversation_id,r.message_id,r.principal_id)=(d.firm_id,d.conversation_id,d.message_id,d.recipient_principal_id) JOIN conversation_participants p ON (p.firm_id,p.conversation_id,p.principal_id)=(r.firm_id,r.conversation_id,r.principal_id) WHERE d.firm_id=$1 AND d.native_intent_id=$2 AND p.active AND p.revision=r.membership_revision)")
            .bind(self.firm).bind(intent).fetch_one(&mut **tx).await?;
        if !current {
            return Err(Error::Denied);
        }
        let principal: Uuid = row.get("principal_id");
        self.conversation_member(tx, row.get("conversation_id"), principal)
            .await?;
        self.conversation_member(
            tx,
            row.get("conversation_id"),
            row.get("recipient_principal_id"),
        )
        .await?;
        self.authorize(tx, principal, row.get("delegation_id"), "conversation.send")
            .await?;
        self.grant_work_scope(tx, row.get("delegation_id"), row.get("work_id"))
            .await?;
        // native_dispatch_allowed separately revalidates the authenticated origin scope/lifetime.
        let input:Value=sqlx::query_scalar("SELECT i.input FROM executions e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.intent_id) WHERE e.firm_id=$1 AND e.id=$2")
            .bind(self.firm).bind(row.get::<Uuid,_>("execution_id")).fetch_one(&mut **tx).await?;
        let input: ExecutionRequest =
            serde_json::from_value(input).map_err(|_| Error::Unavailable)?;
        let agent = self.agent_grant(tx, &input).await?;
        if agent != row.get::<Uuid, _>("recipient_principal_id") {
            return Err(Error::Denied);
        }
        self.authorize(
            tx,
            agent,
            input.agent_delegation_id.ok_or(Error::Denied)?,
            "conversation.read",
        )
        .await?;
        Ok(())
    }
}

impl Core {
    pub async fn work_conversations(&self, caller: impl Into<Actor>, work: Uuid) -> Result<Value> {
        let mut tx = self.fence().await?;
        let ctx = self.actor_context(&mut tx, &caller.into()).await?;
        self.any_work_permission(&mut tx, &ctx, work, "conversation.read")
            .await?;
        let items:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',c.id,'responsible_agent_id',c.responsible_agent_id,'sequence',c.sequence) FROM conversations c JOIN conversation_participants p ON (p.firm_id,p.conversation_id)=(c.firm_id,c.id) WHERE c.firm_id=$1 AND c.work_id=$2 AND p.principal_id=$3 AND p.active ORDER BY c.id LIMIT 16")
            .bind(self.firm).bind(work).bind(ctx.principal).fetch_all(&mut *tx).await?;
        Ok(json!({"work_id":work,"items":items}))
    }
}
