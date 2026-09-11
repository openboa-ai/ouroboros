-- A return settles only the original compute reservation, never private work or external effects.
CREATE TABLE compute_returns (
 firm_id uuid NOT NULL, execution_id uuid NOT NULL,
 receipt jsonb NOT NULL, units bigint NOT NULL CHECK(units>0),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(firm_id,execution_id),
 FOREIGN KEY(firm_id,execution_id) REFERENCES runtime_instances(firm_id,execution_id)
);
REVOKE ALL ON compute_returns FROM PUBLIC;
