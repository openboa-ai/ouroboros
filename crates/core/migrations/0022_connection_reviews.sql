CREATE TABLE connection_reviews (
    firm_id uuid NOT NULL,
    id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    origin_instance_id uuid,
    origin_generation uuid,
    request_key text NOT NULL,
    request jsonb NOT NULL,
    evidence jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,id),
    UNIQUE(firm_id,reviewer_id,request_key),
    FOREIGN KEY(firm_id,candidate_id) REFERENCES connection_candidates(firm_id,id),
    FOREIGN KEY(firm_id,reviewer_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER immutable_connection_review BEFORE UPDATE OR DELETE ON connection_reviews
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
