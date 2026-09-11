-- Allocation consumes an explicitly provisioned namespace, never creates authority.
CREATE TABLE workspace_namespaces (
 firm_id uuid NOT NULL, id uuid NOT NULL, target_id text NOT NULL,
 store_id uuid NOT NULL, storage_generation uuid NOT NULL,
 capacity bigint NOT NULL CHECK(capacity>=0),
 allocated bigint NOT NULL DEFAULT 0 CHECK(allocated>=0 AND allocated<=capacity),
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,target_id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
 FOREIGN KEY(firm_id,store_id,storage_generation) REFERENCES storage_budgets(firm_id,store_id,generation)
);
ALTER TABLE resource_scopes ADD COLUMN namespace_id uuid;
ALTER TABLE resource_scopes ADD FOREIGN KEY(firm_id,namespace_id)
 REFERENCES workspace_namespaces(firm_id,id);
CREATE TABLE workspace_allocations (
 firm_id uuid NOT NULL, id uuid NOT NULL, creation_intent_id uuid NOT NULL,
 work_id uuid NOT NULL, target_id text NOT NULL, namespace_id uuid NOT NULL,
 store_id uuid NOT NULL, storage_generation uuid NOT NULL,
 label text NOT NULL CHECK(octet_length(label) BETWEEN 1 AND 128 AND label=btrim(label)),
 state text NOT NULL CHECK(state IN ('reserved','active')),
 created_sequence bigint NOT NULL CHECK(created_sequence>0),
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,creation_intent_id), UNIQUE(firm_id,created_sequence),
 FOREIGN KEY(firm_id,creation_intent_id) REFERENCES resource_calls(firm_id,intent_id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
 FOREIGN KEY(firm_id,namespace_id) REFERENCES workspace_namespaces(firm_id,id)
);
REVOKE ALL ON workspace_namespaces,workspace_allocations FROM PUBLIC;
