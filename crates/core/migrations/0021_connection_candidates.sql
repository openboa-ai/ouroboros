CREATE TABLE connection_candidates (
    firm_id uuid NOT NULL,
    id uuid NOT NULL,
    work_id uuid NOT NULL,
    target_id text NOT NULL,
    author_id uuid NOT NULL,
    origin_instance_id uuid,
    origin_generation uuid,
    request_key text NOT NULL,
    request jsonb NOT NULL,
    enrollment_intent_id uuid NOT NULL,
    worker_id text NOT NULL,
    base_configuration jsonb NOT NULL,
    proposed_configuration jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,id),
    UNIQUE(firm_id,author_id,request_key),
    FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
    FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
    FOREIGN KEY(firm_id,author_id) REFERENCES principals(firm_id,id),
    FOREIGN KEY(firm_id,enrollment_intent_id) REFERENCES intents(firm_id,id)
);
CREATE FUNCTION preserve_connection_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'connection candidates are immutable'; END $$;
CREATE TRIGGER immutable_connection_candidate BEFORE UPDATE OR DELETE ON connection_candidates
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
