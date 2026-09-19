-- A continuation consumes a finite, immutable allowance attached to ONE original call.
CREATE TABLE service_continuations (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    issuer_id uuid NOT NULL,
    request_key text NOT NULL,
    request jsonb NOT NULL,
    worker_id text NOT NULL,
    profile_id text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,root_intent_id),
    UNIQUE(firm_id,issuer_id,request_key),
    FOREIGN KEY(firm_id,root_intent_id) REFERENCES service_calls(firm_id,root_intent_id)
);
CREATE TABLE service_restarts (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 32),
    execution_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,root_intent_id,ordinal),
    UNIQUE(firm_id,execution_id),
    FOREIGN KEY(firm_id,root_intent_id) REFERENCES service_continuations(firm_id,root_intent_id),
    FOREIGN KEY(firm_id,execution_id) REFERENCES adapter_invocations(firm_id,execution_id)
);
CREATE VIEW service_execution_roots AS
    SELECT firm_id,root_intent_id,execution_id,0 AS ordinal FROM service_calls
    UNION ALL SELECT firm_id,root_intent_id,execution_id,ordinal FROM service_restarts;
CREATE TABLE service_continuation_stops (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    issuer_id uuid NOT NULL,
    request_key text NOT NULL,
    request jsonb NOT NULL,
    receipt jsonb NOT NULL,
    PRIMARY KEY(firm_id,root_intent_id),
    UNIQUE(firm_id,issuer_id,request_key),
    FOREIGN KEY(firm_id,root_intent_id) REFERENCES service_continuations(firm_id,root_intent_id)
);
-- Poll scheduling is mutable observation, never mutable authority or a resettable counter.
CREATE TABLE service_continuation_checks (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,root_intent_id),
    FOREIGN KEY(firm_id,root_intent_id) REFERENCES service_continuations(firm_id,root_intent_id)
);
CREATE TRIGGER immutable_service_continuation BEFORE UPDATE OR DELETE ON service_continuations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_restart BEFORE UPDATE OR DELETE ON service_restarts
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_continuation_stop BEFORE UPDATE OR DELETE ON service_continuation_stops
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
