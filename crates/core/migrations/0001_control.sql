CREATE TABLE firms (
 id uuid PRIMARY KEY, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 event_sequence bigint NOT NULL DEFAULT 0 CHECK(event_sequence>=0)
);
CREATE TABLE principals (
 firm_id uuid NOT NULL REFERENCES firms(id), id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('human','agent','service')),
 enabled boolean NOT NULL, PRIMARY KEY(firm_id,id)
);
CREATE TABLE credentials (
 fingerprint text PRIMARY KEY CHECK(length(fingerprint)=64),
 firm_id uuid NOT NULL, principal_id uuid NOT NULL,
 enabled boolean NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
CREATE TABLE delegations (
 firm_id uuid NOT NULL, id uuid NOT NULL, principal_id uuid NOT NULL,
 parent_id uuid, actions text[] NOT NULL, expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false,
 PRIMARY KEY(firm_id,id),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,parent_id) REFERENCES delegations(firm_id,id), CHECK(id IS DISTINCT FROM parent_id)
);
CREATE TABLE limits (
 firm_id uuid NOT NULL REFERENCES firms(id), id text NOT NULL,
 capacity bigint NOT NULL CHECK(capacity>=0), committed bigint NOT NULL DEFAULT 0 CHECK(committed>=0),
 PRIMARY KEY(firm_id,id)
);
CREATE TABLE profiles (
 firm_id uuid NOT NULL REFERENCES firms(id), id text NOT NULL, active boolean NOT NULL,
 max_units bigint NOT NULL CHECK(max_units>0), max_lifetime_seconds bigint NOT NULL CHECK(max_lifetime_seconds>0),
 PRIMARY KEY(firm_id,id)
);
CREATE TABLE work (
 firm_id uuid NOT NULL, id uuid NOT NULL, principal_id uuid NOT NULL, delegation_id uuid NOT NULL,
 purpose text NOT NULL, PRIMARY KEY(firm_id,id),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
CREATE TABLE intents (
 firm_id uuid NOT NULL, id uuid NOT NULL, principal_id uuid NOT NULL,
 operation text NOT NULL, request_key text NOT NULL, input jsonb NOT NULL,
 resource_id uuid NOT NULL, delegation_id uuid,
 state text NOT NULL CHECK(state IN ('accepted','claimed','succeeded','unresolved','restricted')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,principal_id,operation,request_key),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
 FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
CREATE TABLE executions (
 firm_id uuid NOT NULL, id uuid NOT NULL, work_id uuid NOT NULL, intent_id uuid NOT NULL,
 predecessor_id uuid, instance_id uuid, generation uuid,
 stopped boolean NOT NULL DEFAULT false, terminated boolean NOT NULL DEFAULT false,
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,intent_id), UNIQUE(firm_id,instance_id),
 FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,predecessor_id) REFERENCES executions(firm_id,id)
);
CREATE TABLE reservations (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, limit_id text NOT NULL,
 units bigint NOT NULL CHECK(units>0), settled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(firm_id,intent_id,limit_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,limit_id) REFERENCES limits(firm_id,id)
);
CREATE TABLE outbox (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, claimed boolean NOT NULL DEFAULT false,
 PRIMARY KEY(firm_id,intent_id), FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id)
);
CREATE TABLE attempts (
 firm_id uuid NOT NULL, id uuid NOT NULL, intent_id uuid NOT NULL, worker_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('claimed','succeeded','unresolved','restricted')),
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id)
);
CREATE TABLE events (
 firm_id uuid NOT NULL, sequence bigint NOT NULL, principal_id uuid NOT NULL,
 kind text NOT NULL, resource_id uuid NOT NULL, data jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,sequence), FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
