-- Profiles configure execution mechanics; registration does not grant authority.
CREATE TABLE program_profiles (
 firm_id uuid NOT NULL, profile_id text NOT NULL, profile jsonb NOT NULL,
 active boolean NOT NULL,
 PRIMARY KEY(firm_id,profile_id),
 FOREIGN KEY(firm_id,profile_id) REFERENCES profiles(firm_id,id)
);
CREATE TABLE execution_programs (
 firm_id uuid NOT NULL, execution_id uuid NOT NULL, profile_id text NOT NULL,
 profile jsonb NOT NULL, request jsonb NOT NULL,
 manifest_digest text NOT NULL CHECK(manifest_digest ~ '^[0-9a-f]{64}$'),
 materialization jsonb,
 PRIMARY KEY(firm_id,execution_id),
 FOREIGN KEY(firm_id,execution_id) REFERENCES executions(firm_id,id),
 FOREIGN KEY(firm_id,profile_id) REFERENCES program_profiles(firm_id,profile_id)
);
-- These references survive termination and replacement. A local execution ending
-- does not release retained company inputs or make their revisions disposable.
CREATE TABLE execution_inputs (
 firm_id uuid NOT NULL, execution_id uuid NOT NULL,
 input_index integer NOT NULL CHECK(input_index>=0),
 source_intent_id uuid NOT NULL, target_id text NOT NULL, namespace_id uuid NOT NULL,
 workspace_id uuid NOT NULL, revision bigint NOT NULL CHECK(revision>0),
 resolved jsonb NOT NULL, configuration jsonb NOT NULL, worker_id text NOT NULL,
 retained boolean NOT NULL DEFAULT true,
 read_intent_id uuid, read_instance_id uuid, read_generation uuid,
 PRIMARY KEY(firm_id,execution_id,input_index), UNIQUE(firm_id,read_intent_id),
 CHECK((read_intent_id IS NULL AND read_instance_id IS NULL AND read_generation IS NULL)
    OR (read_intent_id IS NOT NULL AND read_instance_id IS NOT NULL AND read_generation IS NOT NULL)),
 FOREIGN KEY(firm_id,execution_id) REFERENCES execution_programs(firm_id,execution_id),
 FOREIGN KEY(firm_id,source_intent_id) REFERENCES resource_calls(firm_id,intent_id),
 FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
 FOREIGN KEY(firm_id,namespace_id) REFERENCES workspace_namespaces(firm_id,id),
 FOREIGN KEY(firm_id,workspace_id) REFERENCES workspace_allocations(firm_id,id),
 FOREIGN KEY(firm_id,read_intent_id) REFERENCES resource_calls(firm_id,intent_id),
 FOREIGN KEY(firm_id,read_instance_id) REFERENCES runtime_instances(firm_id,instance_id)
);
CREATE INDEX execution_inputs_retained_revision
 ON execution_inputs(firm_id,target_id,workspace_id,revision,execution_id) WHERE retained;
ALTER TABLE runtime_instances DROP CONSTRAINT runtime_instances_phase_check;
ALTER TABLE runtime_instances ADD CHECK(phase IN ('preparing','bound','materializing','released','terminated'));
DROP INDEX runtime_live_bridge;
CREATE UNIQUE INDEX runtime_live_bridge ON runtime_instances
 ((binding->'peer'->>'boot_id'),(binding->'peer'->>'pid'),(binding->'peer'->>'start_ticks'))
 WHERE phase IN ('bound','materializing','released');
REVOKE ALL ON program_profiles,execution_programs,execution_inputs FROM PUBLIC;
