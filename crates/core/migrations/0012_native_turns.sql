CREATE TABLE native_turns (
 firm_id uuid NOT NULL, execution_id uuid NOT NULL, thread_id text NOT NULL, turn_id text NOT NULL,
 status text NOT NULL CHECK(status IN ('inProgress','completed','interrupted','failed')),
 PRIMARY KEY(firm_id,execution_id,thread_id,turn_id),
 FOREIGN KEY(firm_id,execution_id) REFERENCES runtime_instances(firm_id,execution_id)
);
CREATE UNIQUE INDEX native_one_active_turn ON native_turns(firm_id,execution_id) WHERE status='inProgress';
CREATE TABLE native_controls (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, execution_id uuid NOT NULL,
 thread_id text NOT NULL, turn_id text NOT NULL,
 PRIMARY KEY(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,execution_id,thread_id,turn_id) REFERENCES native_turns(firm_id,execution_id,thread_id,turn_id)
);
REVOKE ALL ON native_turns,native_controls FROM PUBLIC;
