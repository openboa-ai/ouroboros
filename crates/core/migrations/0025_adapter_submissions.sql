CREATE TABLE adapter_submissions (
    firm_id uuid NOT NULL, id uuid NOT NULL, work_id uuid NOT NULL, target_id text NOT NULL,
    registrant_id uuid NOT NULL, source_requester_id uuid NOT NULL, source_execution_id uuid NOT NULL,
    origin_instance_id uuid, origin_generation uuid,
    request_key text NOT NULL, request jsonb NOT NULL,
    profile_id text NOT NULL, program jsonb NOT NULL, ticket jsonb NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,registrant_id,request_key),
    FOREIGN KEY(firm_id,source_execution_id) REFERENCES execution_programs(firm_id,execution_id),
    FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
    FOREIGN KEY(firm_id,registrant_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER immutable_adapter_submission BEFORE UPDATE OR DELETE ON adapter_submissions
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
CREATE TABLE adapter_verifications (
    firm_id uuid NOT NULL, submission_id uuid NOT NULL, execution_id uuid NOT NULL,
    PRIMARY KEY(firm_id,execution_id),
    FOREIGN KEY(firm_id,submission_id) REFERENCES adapter_submissions(firm_id,id),
    FOREIGN KEY(firm_id,execution_id) REFERENCES executions(firm_id,id)
);
CREATE TRIGGER immutable_adapter_verification BEFORE UPDATE OR DELETE ON adapter_verifications
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
