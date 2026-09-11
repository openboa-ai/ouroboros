-- Registration never reserves execution capacity or authenticates a future instance.
CREATE TABLE wake_registrations (
 firm_id uuid NOT NULL, id uuid NOT NULL, intent_id uuid NOT NULL,
 work_id uuid NOT NULL, principal_id uuid NOT NULL, delegation_id uuid NOT NULL,
 due_at_seconds bigint NOT NULL CHECK(due_at_seconds>0),
 expires_at_seconds bigint NOT NULL CHECK(expires_at_seconds>due_at_seconds),
 execution_request jsonb NOT NULL,
 cancelled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
