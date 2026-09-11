CREATE TABLE native_control_acks (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, receipt jsonb NOT NULL,
 PRIMARY KEY(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES native_controls(firm_id,intent_id)
);
REVOKE ALL ON native_control_acks FROM PUBLIC;
