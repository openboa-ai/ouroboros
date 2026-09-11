CREATE TABLE adapter_activations (
    firm_id uuid NOT NULL, id uuid NOT NULL, submission_id uuid NOT NULL, acceptance_id uuid NOT NULL,
    activator_id uuid NOT NULL, delegation_id uuid NOT NULL, request_key text NOT NULL, request jsonb NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,acceptance_id), UNIQUE(firm_id,activator_id,request_key),
    FOREIGN KEY(firm_id,submission_id) REFERENCES adapter_submissions(firm_id,id),
    FOREIGN KEY(firm_id,acceptance_id) REFERENCES adapter_acceptances(firm_id,id),
    FOREIGN KEY(firm_id,activator_id) REFERENCES principals(firm_id,id),
    FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
CREATE TABLE active_adapters (
    firm_id uuid NOT NULL, target_id text NOT NULL, activation_id uuid NOT NULL,
    PRIMARY KEY(firm_id,target_id),
    FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
    FOREIGN KEY(firm_id,activation_id) REFERENCES adapter_activations(firm_id,id)
);
CREATE TABLE adapter_invocations (
    firm_id uuid NOT NULL, activation_id uuid NOT NULL, execution_id uuid NOT NULL,
    PRIMARY KEY(firm_id,execution_id),
    FOREIGN KEY(firm_id,activation_id) REFERENCES adapter_activations(firm_id,id),
    FOREIGN KEY(firm_id,execution_id) REFERENCES executions(firm_id,id)
);
CREATE TABLE adapter_stops (
    firm_id uuid NOT NULL, activation_id uuid NOT NULL, issuer_id uuid NOT NULL, request_key text NOT NULL,
    PRIMARY KEY(firm_id,activation_id), UNIQUE(firm_id,issuer_id,request_key),
    FOREIGN KEY(firm_id,activation_id) REFERENCES adapter_activations(firm_id,id),
    FOREIGN KEY(firm_id,issuer_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER immutable_adapter_activation BEFORE UPDATE OR DELETE ON adapter_activations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_adapter_invocation BEFORE UPDATE OR DELETE ON adapter_invocations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TRIGGER immutable_adapter_stop BEFORE UPDATE OR DELETE ON adapter_stops
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
