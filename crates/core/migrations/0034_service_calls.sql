-- Root identity comes from an admitted execution, never Company request metadata.
CREATE TABLE service_calls (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    execution_id uuid NOT NULL,
    activation_id uuid NOT NULL,
    binding jsonb NOT NULL,
    invocation jsonb NOT NULL,
    input_fingerprint text NOT NULL,
    PRIMARY KEY(firm_id, root_intent_id),
    UNIQUE(firm_id, execution_id),
    FOREIGN KEY(firm_id, root_intent_id) REFERENCES intents(firm_id,id),
    FOREIGN KEY(firm_id, execution_id) REFERENCES adapter_invocations(firm_id,execution_id),
    FOREIGN KEY(firm_id, activation_id) REFERENCES adapter_activations(firm_id,id)
);
CREATE TABLE service_effects (
    firm_id uuid NOT NULL,
    root_intent_id uuid NOT NULL,
    effect_slot text NOT NULL,
    child_intent_id uuid NOT NULL,
    input_fingerprint text NOT NULL,
    PRIMARY KEY(firm_id, root_intent_id, effect_slot),
    UNIQUE(firm_id, child_intent_id),
    FOREIGN KEY(firm_id, root_intent_id) REFERENCES service_calls(firm_id,root_intent_id),
    FOREIGN KEY(firm_id, child_intent_id) REFERENCES resource_calls(firm_id,intent_id)
);
CREATE TRIGGER immutable_service_call BEFORE UPDATE OR DELETE ON service_calls
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_service_effect BEFORE UPDATE OR DELETE ON service_effects
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
