ALTER TABLE work ADD COLUMN parent_id uuid;
ALTER TABLE work ADD FOREIGN KEY(firm_id,parent_id) REFERENCES work(firm_id,id);
ALTER TABLE work ADD CHECK(id IS DISTINCT FROM parent_id);
CREATE INDEX work_parent ON work(firm_id,parent_id);

-- Preserve previously enforced human own-work scope as an explicit control binding.
-- Authorship remains provenance; it is no longer the permission source.
CREATE TABLE work_controls (
 firm_id uuid NOT NULL, root_work_id uuid NOT NULL, principal_id uuid NOT NULL,
 PRIMARY KEY(firm_id,root_work_id,principal_id),
 FOREIGN KEY(firm_id,root_work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
INSERT INTO work_controls SELECT firm_id,id,principal_id FROM work;

-- A non-null root attenuates an existing delegation; null retains its old scope.
-- No public client operation creates or widens this binding.
ALTER TABLE delegations ADD COLUMN work_root_id uuid;
ALTER TABLE delegations ADD FOREIGN KEY(firm_id,work_root_id) REFERENCES work(firm_id,id);

ALTER TABLE intents ADD COLUMN work_id uuid;
ALTER TABLE intents ADD COLUMN origin_instance_id uuid;
ALTER TABLE intents ADD COLUMN origin_generation uuid;
ALTER TABLE intents ADD FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id);
ALTER TABLE intents ADD CHECK((origin_instance_id IS NULL)=(origin_generation IS NULL));
UPDATE intents i SET work_id=w.id FROM work w
 WHERE i.firm_id=w.firm_id AND i.resource_id=w.id AND i.operation='work.create';
UPDATE intents i SET work_id=e.work_id FROM executions e
 WHERE i.firm_id=e.firm_id AND i.resource_id=e.id AND i.operation IN ('execution.start','execution.stop');
UPDATE intents i SET work_id=r.work_id FROM resource_calls r
 WHERE (i.firm_id,i.id)=(r.firm_id,r.intent_id);

ALTER TABLE events ADD COLUMN work_id uuid;
ALTER TABLE events ADD FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id);
UPDATE events v SET work_id=w.id FROM work w
 WHERE v.firm_id=w.firm_id AND v.resource_id=w.id AND v.kind='work.created';
UPDATE events v SET work_id=e.work_id FROM executions e
 WHERE v.firm_id=e.firm_id AND v.resource_id=e.id
 AND (v.kind LIKE 'runtime.%' OR v.kind LIKE 'instance.%' OR v.kind='restriction.accepted');
UPDATE events v SET work_id=i.work_id FROM intents i
 WHERE (v.firm_id,v.resource_id)=(i.firm_id,i.id)
 AND (v.kind='intent.accepted' OR v.kind='dispatch.claimed' OR v.kind LIKE 'resource.%');
CREATE INDEX events_work ON events(firm_id,work_id,sequence);
CREATE INDEX intents_work ON intents(firm_id,work_id);
REVOKE ALL ON work_controls FROM PUBLIC;
