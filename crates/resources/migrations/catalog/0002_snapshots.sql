CREATE TABLE workspace_snapshots(firm_id uuid NOT NULL,workspace_id uuid NOT NULL,revision bigint NOT NULL,manifest jsonb NOT NULL,PRIMARY KEY(firm_id,workspace_id,revision),FOREIGN KEY(firm_id,workspace_id) REFERENCES workspaces(firm_id,id));
REVOKE ALL ON workspace_snapshots FROM PUBLIC;
