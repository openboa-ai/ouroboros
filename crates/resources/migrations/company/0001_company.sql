CREATE TABLE inputs(firm_id uuid NOT NULL,id uuid NOT NULL,content jsonb NOT NULL,PRIMARY KEY(firm_id,id));
CREATE TABLE results(firm_id uuid NOT NULL,id uuid NOT NULL,content jsonb NOT NULL,PRIMARY KEY(firm_id,id));
CREATE TABLE effect_receipts(firm_id uuid NOT NULL,intent_id uuid NOT NULL,input jsonb NOT NULL,result_id uuid NOT NULL,committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(firm_id,intent_id),FOREIGN KEY(firm_id,result_id) REFERENCES results(firm_id,id));
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
