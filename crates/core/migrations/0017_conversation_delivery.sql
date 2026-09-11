CREATE TABLE conversation_deliveries (
 firm_id uuid NOT NULL, conversation_id uuid NOT NULL, message_id uuid NOT NULL,
 native_intent_id uuid NOT NULL,
 PRIMARY KEY(firm_id,conversation_id,message_id), UNIQUE(firm_id,native_intent_id),
 FOREIGN KEY(firm_id,conversation_id,message_id) REFERENCES conversation_messages(firm_id,conversation_id,id),
 FOREIGN KEY(firm_id,native_intent_id) REFERENCES native_controls(firm_id,intent_id)
);
