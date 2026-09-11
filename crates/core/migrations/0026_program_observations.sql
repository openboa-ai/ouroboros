CREATE TABLE program_observations (
    firm_id uuid NOT NULL, execution_id uuid NOT NULL, receipt jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(firm_id,execution_id),
    FOREIGN KEY(firm_id,execution_id) REFERENCES execution_programs(firm_id,execution_id)
);
CREATE TRIGGER immutable_program_observation BEFORE UPDATE OR DELETE ON program_observations
    FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
