-- Existing records have no invented completion time. Zero minimum age is an explicit
-- policy choice; policies requiring age cannot retire undated historical effects.
ALTER TABLE resource_calls ADD COLUMN completed_at timestamptz;
ALTER TABLE workspace_allocations DROP CONSTRAINT workspace_allocations_state_check;
ALTER TABLE workspace_allocations ADD CHECK(state IN ('reserved','active','closed'));
CREATE TABLE resource_retirements (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, work_id uuid NOT NULL,
 target_id text NOT NULL, namespace_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('upload','revision','workspace_close')),
 material_id uuid NOT NULL, material_revision bigint CHECK(material_revision>=0),
 source_intent_id uuid NOT NULL, policy jsonb NOT NULL,
 PRIMARY KEY(firm_id,intent_id),
 UNIQUE NULLS NOT DISTINCT(firm_id,work_id,target_id,namespace_id,kind,material_id,material_revision),
 CHECK((kind='revision')=(material_revision IS NOT NULL)),
 FOREIGN KEY(firm_id,intent_id) REFERENCES resource_calls(firm_id,intent_id),
 FOREIGN KEY(firm_id,source_intent_id) REFERENCES resource_calls(firm_id,intent_id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,namespace_id) REFERENCES workspace_namespaces(firm_id,id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id)
);
CREATE TABLE workspace_releases (
 firm_id uuid NOT NULL, workspace_id uuid NOT NULL, retirement_intent_id uuid NOT NULL,
 namespace_id uuid NOT NULL,
 PRIMARY KEY(firm_id,workspace_id), UNIQUE(firm_id,retirement_intent_id),
 FOREIGN KEY(firm_id,workspace_id) REFERENCES workspace_allocations(firm_id,id),
 FOREIGN KEY(firm_id,retirement_intent_id) REFERENCES resource_retirements(firm_id,intent_id),
 FOREIGN KEY(firm_id,namespace_id) REFERENCES workspace_namespaces(firm_id,id)
);
REVOKE ALL ON resource_retirements,workspace_releases FROM PUBLIC;
