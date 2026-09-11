CREATE TABLE connection_stops (
    firm_id uuid NOT NULL, id uuid NOT NULL, activation_id uuid NOT NULL,
    principal_id uuid NOT NULL, request_key text NOT NULL, request jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,activation_id),
    UNIQUE(firm_id,principal_id,request_key),
    FOREIGN KEY(firm_id,activation_id) REFERENCES connection_activations(firm_id,id),
    FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER immutable_connection_stop BEFORE UPDATE OR DELETE ON connection_stops
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
