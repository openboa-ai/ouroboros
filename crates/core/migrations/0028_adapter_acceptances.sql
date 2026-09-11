CREATE TABLE adapter_acceptances (
    firm_id uuid NOT NULL, id uuid NOT NULL, submission_id uuid NOT NULL,
    acceptor_id uuid NOT NULL, delegation_id uuid NOT NULL, evaluation_id uuid NOT NULL,
    request_key text NOT NULL, request jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,acceptor_id,request_key),
    FOREIGN KEY(firm_id,submission_id) REFERENCES adapter_submissions(firm_id,id),
    FOREIGN KEY(firm_id,acceptor_id) REFERENCES principals(firm_id,id),
    FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id),
    FOREIGN KEY(firm_id,evaluation_id) REFERENCES adapter_evaluations(firm_id,id)
);
CREATE TRIGGER immutable_adapter_acceptance BEFORE UPDATE OR DELETE ON adapter_acceptances
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
