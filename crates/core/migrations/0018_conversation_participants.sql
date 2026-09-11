CREATE TABLE conversation_participants (
 firm_id uuid NOT NULL, conversation_id uuid NOT NULL, principal_id uuid NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(firm_id,conversation_id,principal_id),
 FOREIGN KEY(firm_id,conversation_id) REFERENCES conversations(firm_id,id),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
INSERT INTO conversation_participants(firm_id,conversation_id,principal_id)
SELECT c.firm_id,c.id,i.principal_id FROM conversations c JOIN intents i ON (i.firm_id,i.id)=(c.firm_id,c.create_intent_id)
UNION SELECT firm_id,id,responsible_agent_id FROM conversations;
CREATE TABLE conversation_recipients (
 firm_id uuid NOT NULL, conversation_id uuid NOT NULL, message_id uuid NOT NULL, principal_id uuid NOT NULL,
 PRIMARY KEY(firm_id,conversation_id,message_id,principal_id),
 FOREIGN KEY(firm_id,conversation_id,message_id) REFERENCES conversation_messages(firm_id,conversation_id,id),
 FOREIGN KEY(firm_id,conversation_id,principal_id) REFERENCES conversation_participants(firm_id,conversation_id,principal_id)
);
INSERT INTO conversation_recipients SELECT m.firm_id,m.conversation_id,m.id,p.principal_id
FROM conversation_messages m JOIN conversation_participants p USING(firm_id,conversation_id)
WHERE p.principal_id<>m.author_principal_id;
ALTER TABLE conversation_deliveries ADD COLUMN recipient_principal_id uuid;
UPDATE conversation_deliveries d SET recipient_principal_id=c.responsible_agent_id
FROM conversations c WHERE c.firm_id=d.firm_id AND c.id=d.conversation_id;
ALTER TABLE conversation_deliveries ALTER COLUMN recipient_principal_id SET NOT NULL;
ALTER TABLE conversation_deliveries DROP CONSTRAINT conversation_deliveries_pkey;
ALTER TABLE conversation_deliveries ADD PRIMARY KEY(firm_id,conversation_id,message_id,recipient_principal_id);
ALTER TABLE conversation_deliveries ADD FOREIGN KEY(firm_id,conversation_id,message_id,recipient_principal_id)
REFERENCES conversation_recipients(firm_id,conversation_id,message_id,principal_id);
