-- A finite host keeps its existing immutable launch binding. Each business request has
-- independent caller provenance, a single actual instance claim, reply and effect slots.
CREATE TABLE service_host_requests (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    execution_id uuid NOT NULL,
    ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 16),
    invocation jsonb NOT NULL,
    input_fingerprint text NOT NULL,
    PRIMARY KEY (firm_id,intent_id),
    UNIQUE (firm_id,execution_id,ordinal),
    FOREIGN KEY (firm_id,intent_id) REFERENCES intents(firm_id,id),
    FOREIGN KEY (firm_id,execution_id) REFERENCES service_calls(firm_id,execution_id)
);
CREATE TABLE service_host_claims (
    firm_id uuid NOT NULL,
    request_intent_id uuid NOT NULL,
    instance_id uuid NOT NULL,
    generation uuid NOT NULL,
    PRIMARY KEY (firm_id,request_intent_id),
    FOREIGN KEY (firm_id,request_intent_id) REFERENCES service_host_requests(firm_id,intent_id)
);
CREATE TABLE service_host_replies (
    firm_id uuid NOT NULL,
    request_intent_id uuid NOT NULL,
    result jsonb NOT NULL,
    PRIMARY KEY (firm_id,request_intent_id),
    FOREIGN KEY (firm_id,request_intent_id) REFERENCES service_host_claims(firm_id,request_intent_id)
);
CREATE TABLE service_host_effects (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    effect_slot text NOT NULL,
    child_intent_id uuid NOT NULL,
    input_fingerprint text NOT NULL,
    PRIMARY KEY (firm_id,root_intent_id,effect_slot),
    UNIQUE (firm_id,child_intent_id),
    FOREIGN KEY (firm_id,root_intent_id) REFERENCES service_host_claims(firm_id,request_intent_id),
    FOREIGN KEY (firm_id,child_intent_id) REFERENCES resource_calls(firm_id,intent_id)
);
CREATE TRIGGER immutable_service_host_request BEFORE UPDATE OR DELETE ON service_host_requests
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_host_claim BEFORE UPDATE OR DELETE ON service_host_claims
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_host_reply BEFORE UPDATE OR DELETE ON service_host_replies
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_host_effect BEFORE UPDATE OR DELETE ON service_host_effects
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
