CREATE TABLE workspaces(firm_id uuid NOT NULL,id uuid NOT NULL,revision bigint NOT NULL CHECK(revision>=0),manifest jsonb NOT NULL,PRIMARY KEY(firm_id,id));
CREATE TABLE uploads(firm_id uuid NOT NULL,intent_id uuid NOT NULL,digest text NOT NULL CHECK(length(digest)=64),size bigint NOT NULL CHECK(size>=0),PRIMARY KEY(firm_id,intent_id));
CREATE TABLE publication_receipts(firm_id uuid NOT NULL,intent_id uuid NOT NULL,workspace_id uuid NOT NULL,input jsonb NOT NULL,revision bigint NOT NULL,PRIMARY KEY(firm_id,intent_id),FOREIGN KEY(firm_id,workspace_id) REFERENCES workspaces(firm_id,id));
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
