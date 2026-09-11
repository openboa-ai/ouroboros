ALTER TABLE firms ADD COLUMN admission_paused boolean NOT NULL DEFAULT false;
CREATE TABLE environment_admission_changes (
 firm_id uuid NOT NULL REFERENCES firms(id), id uuid NOT NULL,
 principal_id uuid NOT NULL, request_key text NOT NULL, input jsonb NOT NULL, receipt jsonb NOT NULL,
 PRIMARY KEY(firm_id,id), UNIQUE(firm_id,principal_id,request_key),
 FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id)
);
CREATE TRIGGER preserve_environment_admission_changes BEFORE UPDATE OR DELETE ON environment_admission_changes
 FOR EACH ROW EXECUTE FUNCTION preserve_connection_candidate();
