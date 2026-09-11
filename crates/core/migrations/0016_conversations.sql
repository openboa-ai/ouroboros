CREATE TABLE conversations (
 firm_id uuid NOT NULL, id uuid NOT NULL, work_id uuid NOT NULL,
 responsible_agent_id uuid NOT NULL, create_intent_id uuid NOT NULL,
 sequence bigint NOT NULL DEFAULT 0 CHECK(sequence>=0),
 content_bytes bigint NOT NULL DEFAULT 0 CHECK(content_bytes>=0 AND content_bytes<=1048576),
 PRIMARY KEY(firm_id,id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,responsible_agent_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,create_intent_id) REFERENCES intents(firm_id,id)
);
CREATE TABLE conversation_messages (
 firm_id uuid NOT NULL, conversation_id uuid NOT NULL, id uuid NOT NULL,
 sequence bigint NOT NULL CHECK(sequence>0), intent_id uuid NOT NULL,
 author_principal_id uuid NOT NULL, author_kind text NOT NULL CHECK(author_kind IN ('human','agent')),
 origin_instance_id uuid, origin_generation uuid,
 reply_to uuid, text text NOT NULL CHECK(octet_length(text) BETWEEN 1 AND 16384),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,conversation_id,id), UNIQUE(firm_id,conversation_id,sequence),
 UNIQUE(firm_id,intent_id),
 FOREIGN KEY(firm_id,conversation_id) REFERENCES conversations(firm_id,id),
 FOREIGN KEY(firm_id,conversation_id,reply_to) REFERENCES conversation_messages(firm_id,conversation_id,id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,author_principal_id) REFERENCES principals(firm_id,id),
 CHECK((origin_instance_id IS NULL)=(origin_generation IS NULL))
);
