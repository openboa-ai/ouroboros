CREATE TABLE adapter_evaluations (
    firm_id uuid NOT NULL, id uuid NOT NULL, submission_id uuid NOT NULL,
    evaluator_id uuid NOT NULL, request_key text NOT NULL, request jsonb NOT NULL,
    verification_execution_id uuid NOT NULL, observation jsonb NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,evaluator_id,request_key),
    FOREIGN KEY(firm_id,submission_id) REFERENCES adapter_submissions(firm_id,id),
    FOREIGN KEY(firm_id,evaluator_id) REFERENCES principals(firm_id,id),
    FOREIGN KEY(firm_id,verification_execution_id) REFERENCES adapter_verifications(firm_id,execution_id),
    FOREIGN KEY(firm_id,verification_execution_id) REFERENCES program_observations(firm_id,execution_id)
);
CREATE TRIGGER immutable_adapter_evaluation BEFORE UPDATE OR DELETE ON adapter_evaluations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
