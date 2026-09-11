-- End a named use without deleting its provenance, receipt, manifest, or object.
CREATE TABLE catalog_retirements (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    input jsonb NOT NULL,
    policy jsonb NOT NULL,
    record jsonb NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    PRIMARY KEY(firm_id,intent_id)
);
ALTER TABLE uploads ADD COLUMN completed_at timestamptz;
ALTER TABLE uploads ADD COLUMN retired_by uuid;
ALTER TABLE uploads ADD FOREIGN KEY(firm_id,retired_by) REFERENCES catalog_retirements(firm_id,intent_id);
ALTER TABLE workspace_snapshots ADD COLUMN completed_at timestamptz;
ALTER TABLE workspace_snapshots ADD COLUMN retired_by uuid;
ALTER TABLE workspace_snapshots ADD FOREIGN KEY(firm_id,retired_by) REFERENCES catalog_retirements(firm_id,intent_id);
ALTER TABLE workspaces ADD COLUMN completed_at timestamptz;
ALTER TABLE workspaces ADD COLUMN closed_by uuid;
ALTER TABLE workspaces ADD FOREIGN KEY(firm_id,closed_by) REFERENCES catalog_retirements(firm_id,intent_id);
ALTER TABLE upload_object_holds ADD COLUMN released_by uuid;
ALTER TABLE upload_object_holds ADD FOREIGN KEY(firm_id,released_by) REFERENCES catalog_retirements(firm_id,intent_id);
ALTER TABLE revision_object_holds ADD COLUMN released_by uuid;
ALTER TABLE revision_object_holds ADD FOREIGN KEY(firm_id,released_by) REFERENCES catalog_retirements(firm_id,intent_id);
-- Unknown historical ages are deliberately not backfilled with the migration time.
REVOKE ALL ON catalog_retirements FROM PUBLIC;
