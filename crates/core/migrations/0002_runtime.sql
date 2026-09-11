CREATE TABLE runtime_instances (
 firm_id uuid NOT NULL, execution_id uuid NOT NULL, attempt_id uuid NOT NULL,
 worker_id text NOT NULL, instance_id uuid NOT NULL, generation uuid NOT NULL,
 phase text NOT NULL CHECK(phase IN ('preparing','bound','released','terminated')),
 binding jsonb, deadline_at timestamptz NOT NULL,
 PRIMARY KEY(firm_id,execution_id), UNIQUE(firm_id,instance_id), UNIQUE(firm_id,attempt_id),
 FOREIGN KEY(firm_id,execution_id) REFERENCES executions(firm_id,id),
 FOREIGN KEY(firm_id,attempt_id) REFERENCES attempts(firm_id,id)
);
CREATE UNIQUE INDEX runtime_live_bridge ON runtime_instances
 ((binding->'peer'->>'boot_id'),(binding->'peer'->>'pid'),(binding->'peer'->>'start_ticks'))
 WHERE phase IN ('bound','released');
REVOKE ALL ON runtime_instances FROM PUBLIC;
