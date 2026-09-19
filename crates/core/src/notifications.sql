WITH RECURSIVE
inspect_work AS (
 SELECT id FROM work WHERE firm_id=$1 AND id=ANY($3)
 UNION SELECT w.id FROM work w JOIN inspect_work p ON w.parent_id=p.id WHERE w.firm_id=$1
),
message_work AS (
 SELECT id FROM work WHERE firm_id=$1 AND id=ANY($4)
 UNION SELECT w.id FROM work w JOIN message_work p ON w.parent_id=p.id WHERE w.firm_id=$1
),
candidates AS (
 -- Message persistence, recipient membership and current read scope are all required.
 SELECT e.sequence,e.received_at,'message'::text AS category,'agent_message'::text AS kind,
        'stored'::text AS status,
        jsonb_build_object('work_id',c.work_id,'conversation_id',m.conversation_id,
                           'message_id',m.id,'intent_id',m.intent_id,'author_principal_id',m.author_principal_id) AS source
 FROM events e JOIN conversation_messages m ON (m.firm_id,m.intent_id)=(e.firm_id,e.resource_id)
 JOIN conversations c ON (c.firm_id,c.id)=(m.firm_id,m.conversation_id)
 JOIN conversation_recipients r ON (r.firm_id,r.conversation_id,r.message_id)=(m.firm_id,m.conversation_id,m.id)
 JOIN conversation_participants p ON (p.firm_id,p.conversation_id,p.principal_id)=(r.firm_id,r.conversation_id,r.principal_id)
 WHERE e.firm_id=$1 AND e.kind='intent.accepted' AND e.data->>'operation'='conversation.send'
   AND m.author_kind='agent' AND m.author_principal_id<>$2 AND r.principal_id=$2
   AND p.active AND p.revision=r.membership_revision AND c.work_id IN(SELECT id FROM message_work)
 UNION ALL
 -- A terminal native turn is not proof of successful work, resource return or settled effects.
 SELECT e.sequence,e.received_at,'execution','native_turn_'||(e.data->>'status'),e.data->>'status',
        jsonb_build_object('work_id',x.work_id,'execution_id',x.id,
                           'thread_id',e.data->>'thread_id','turn_id',e.data->>'turn_id')
 FROM events e JOIN executions x ON (x.firm_id,x.id)=(e.firm_id,e.resource_id)
 WHERE e.firm_id=$1 AND e.kind='native.turn_observed' AND e.data->>'status' IN('completed','interrupted','failed')
   AND x.work_id IN(SELECT id FROM inspect_work)
   AND NOT EXISTS(SELECT 1 FROM events old WHERE old.firm_id=e.firm_id AND old.kind=e.kind
      AND old.resource_id=e.resource_id AND old.sequence<e.sequence
      AND old.data->>'thread_id'=e.data->>'thread_id' AND old.data->>'turn_id'=e.data->>'turn_id'
      AND old.data->>'status' IN('completed','interrupted','failed'))
 UNION ALL
 -- intent.accepted is the canonical request; restriction.accepted is its mirrored event.
 SELECT e.sequence,e.received_at,'control',i.operation||'_accepted','accepted',
        jsonb_strip_nulls(jsonb_build_object('work_id',i.work_id,'intent_id',i.id,
          'execution_id',CASE WHEN i.operation='execution.stop' THEN i.resource_id END,
          'delegation_id',CASE WHEN i.operation='delegation.revoke' THEN i.resource_id END))
 FROM events e JOIN intents i ON (i.firm_id,i.id)=(e.firm_id,e.resource_id)
 WHERE e.firm_id=$1 AND e.kind='intent.accepted' AND i.principal_id=$2
   AND i.operation IN('execution.stop','delegation.revoke')
   AND (i.work_id IN(SELECT id FROM inspect_work) OR (i.work_id IS NULL AND $5))
 UNION ALL
 -- Relate only a later observed termination, never an earlier termination or causal success.
 SELECT e.sequence,e.received_at,'control','stop_target_terminated','terminated',
        jsonb_build_object('work_id',x.work_id,'execution_id',x.id,'intent_id',request.id)
 FROM events e JOIN executions x ON (x.firm_id,x.id)=(e.firm_id,e.resource_id)
 JOIN LATERAL (
   SELECT i.id FROM intents i JOIN events accepted ON (accepted.firm_id,accepted.resource_id)=(i.firm_id,i.id)
   WHERE i.firm_id=e.firm_id AND i.operation='execution.stop' AND i.principal_id=$2
     AND i.resource_id=x.id AND accepted.kind='intent.accepted' AND accepted.sequence<e.sequence
   ORDER BY accepted.sequence DESC LIMIT 1
 ) request ON true
 WHERE e.firm_id=$1 AND e.kind='runtime.terminated' AND x.work_id IN(SELECT id FROM inspect_work)
   AND NOT EXISTS(SELECT 1 FROM events old WHERE old.firm_id=e.firm_id AND old.kind=e.kind
      AND old.resource_id=e.resource_id AND old.sequence<e.sequence)
 UNION ALL
 -- Same metadata boundary as work activity. Namespace-protected file details stay in Library's API.
 SELECT e.sequence,e.received_at,'publication','publication_recorded','recorded',
        jsonb_build_object('work_id',r.work_id,'intent_id',r.intent_id)
 FROM events e JOIN resource_calls r ON (r.firm_id,r.intent_id)=(e.firm_id,e.resource_id)
 JOIN intents i ON (i.firm_id,i.id)=(r.firm_id,r.intent_id)
 WHERE e.firm_id=$1 AND e.kind='resource.completed' AND r.operation='file.publish'
   AND i.state='succeeded' AND r.reply IS NOT NULL AND r.work_id IN(SELECT id FROM inspect_work)
   AND NOT EXISTS(SELECT 1 FROM events old WHERE old.firm_id=e.firm_id AND old.kind=e.kind
      AND old.resource_id=e.resource_id AND old.sequence<e.sequence)
),
visible AS (
 SELECT c.*,r.read_at FROM candidates c LEFT JOIN owner_notification_reads r
   ON r.firm_id=$1 AND r.principal_id=$2 AND r.event_sequence=c.sequence
 WHERE c.sequence<=$6
),
page AS (SELECT * FROM visible WHERE sequence<$7 ORDER BY sequence DESC LIMIT 51)
SELECT jsonb_build_object(
 'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id','event:'||sequence,'sequence',sequence,
   'category',category,'kind',kind,'status',status,'received_at',received_at,'read_at',read_at,'source',source)
   ORDER BY sequence DESC),'[]'::jsonb) FROM page),
 'unread',jsonb_build_object('total',count(*) FILTER(WHERE read_at IS NULL),
   'by_category',jsonb_build_object(
     'message',count(*) FILTER(WHERE read_at IS NULL AND category='message'),
     'execution',count(*) FILTER(WHERE read_at IS NULL AND category='execution'),
     'control',count(*) FILTER(WHERE read_at IS NULL AND category='control'),
     'publication',count(*) FILTER(WHERE read_at IS NULL AND category='publication'))),
 'selected',(SELECT coalesce(jsonb_agg(jsonb_build_object('id','event:'||sequence,'read_at',read_at)
   ORDER BY sequence),'[]'::jsonb) FROM visible WHERE sequence=ANY($8))
) FROM visible
