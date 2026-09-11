CREATE TABLE connection_acceptances (
    firm_id uuid NOT NULL, id uuid NOT NULL, candidate_id uuid NOT NULL,
    acceptor_id uuid NOT NULL, delegation_id uuid NOT NULL, review_id uuid NOT NULL,
    request_key text NOT NULL, request jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,acceptor_id,request_key),
    FOREIGN KEY(firm_id,candidate_id) REFERENCES connection_candidates(firm_id,id),
    FOREIGN KEY(firm_id,review_id) REFERENCES connection_reviews(firm_id,id),
    FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
CREATE TRIGGER immutable_connection_acceptance BEFORE UPDATE OR DELETE ON connection_acceptances
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TABLE connection_activations (
    firm_id uuid NOT NULL, id uuid NOT NULL, acceptance_id uuid NOT NULL,
    target_id text NOT NULL, activator_id uuid NOT NULL, delegation_id uuid NOT NULL,
    request_key text NOT NULL, request jsonb NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,activator_id,request_key),
    UNIQUE(firm_id,acceptance_id),
    FOREIGN KEY(firm_id,acceptance_id) REFERENCES connection_acceptances(firm_id,id),
    FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
    FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
CREATE TRIGGER immutable_connection_activation BEFORE UPDATE OR DELETE ON connection_activations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TABLE active_connections (
    firm_id uuid NOT NULL, target_id text NOT NULL, activation_id uuid NOT NULL,
    PRIMARY KEY(firm_id,target_id),
    FOREIGN KEY(firm_id,activation_id) REFERENCES connection_activations(firm_id,id)
);
CREATE TABLE connection_call_slots (
    firm_id uuid NOT NULL, intent_id uuid NOT NULL, activation_id uuid NOT NULL,
    PRIMARY KEY(firm_id,intent_id),
    FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
    FOREIGN KEY(firm_id,activation_id) REFERENCES connection_activations(firm_id,id)
);
CREATE TRIGGER immutable_connection_call_slot BEFORE UPDATE OR DELETE ON connection_call_slots
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
