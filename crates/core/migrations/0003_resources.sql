CREATE TABLE resource_targets (
 firm_id uuid NOT NULL REFERENCES firms(id), id text NOT NULL,
 worker_id text NOT NULL, active boolean NOT NULL,
 configuration jsonb NOT NULL, max_bytes bigint NOT NULL CHECK(max_bytes>0 AND max_bytes<=2097152),
 PRIMARY KEY(firm_id,id)
);
CREATE TABLE resource_scopes (
 firm_id uuid NOT NULL, work_id uuid NOT NULL, delegation_id uuid NOT NULL, target_id text NOT NULL,
 operations text[] NOT NULL,
 PRIMARY KEY(firm_id,work_id,delegation_id,target_id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id)
);
CREATE TABLE resource_calls (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, work_id uuid NOT NULL, delegation_id uuid NOT NULL,
 target_id text NOT NULL, instance_id uuid, operation text NOT NULL, configuration jsonb NOT NULL,
 worker_id text NOT NULL, reply jsonb,
 PRIMARY KEY(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
 FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
REVOKE ALL ON resource_targets,resource_scopes,resource_calls FROM PUBLIC;
