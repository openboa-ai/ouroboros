CREATE TABLE unstarted_cancellations (
    firm_id uuid NOT NULL, execution_id uuid NOT NULL, issuer_id uuid NOT NULL,
    request_key text NOT NULL, request jsonb NOT NULL, receipt jsonb NOT NULL,
    PRIMARY KEY(firm_id,execution_id), UNIQUE(firm_id,issuer_id,request_key),
    FOREIGN KEY(firm_id,execution_id) REFERENCES executions(firm_id,id),
    FOREIGN KEY(firm_id,issuer_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER immutable_unstarted_cancellation BEFORE UPDATE OR DELETE ON unstarted_cancellations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
