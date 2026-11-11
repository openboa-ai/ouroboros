-- C1a-01 qualification schema. Compile this overlay in the qualification subject only.
CREATE TABLE fixture_fact (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  fact_id TEXT NOT NULL CHECK(length(CAST(fact_id AS BLOB)) BETWEEN 1 AND 256),
  payload BLOB NOT NULL CHECK(length(payload) BETWEEN 1 AND 65536),
  PRIMARY KEY(company_id,fact_id),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE fixture_allowance (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  allowance_id TEXT NOT NULL CHECK(length(CAST(allowance_id AS BLOB)) BETWEEN 1 AND 256),
  limit_units INTEGER NOT NULL CHECK(limit_units>=1),
  consumed_units INTEGER NOT NULL CHECK(consumed_units>=0),
  PRIMARY KEY(company_id,allowance_id),
  CONSTRAINT allowance_bounds CHECK(consumed_units<=limit_units),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE fixture_duty (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  duty_id TEXT NOT NULL CHECK(length(CAST(duty_id AS BLOB)) BETWEEN 1 AND 256),
  cause_id TEXT NOT NULL CHECK(length(CAST(cause_id AS BLOB)) BETWEEN 1 AND 256),
  responsible_id TEXT NOT NULL CHECK(length(CAST(responsible_id AS BLOB)) BETWEEN 1 AND 256),
  status TEXT NOT NULL CHECK(status IN ('UNRESOLVED')),
  PRIMARY KEY(company_id,duty_id),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE fixture_control_source (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  dependency_kind TEXT NOT NULL CHECK(dependency_kind IN ('AUTHORITY','STOP','POLICY','RESOURCE','RESPONSIBILITY','BINDING','TIME')),
  source_id TEXT NOT NULL CHECK(length(CAST(source_id AS BLOB)) BETWEEN 1 AND 256),
  revision BLOB NOT NULL CHECK(length(revision)=8 AND revision>X'0000000000000000'),
  body_bytes BLOB NOT NULL CHECK(length(body_bytes) BETWEEN 1 AND 65536),
  body_digest BLOB NOT NULL CHECK(length(body_digest)=32),
  transaction_id TEXT NOT NULL CHECK(length(CAST(transaction_id AS BLOB)) BETWEEN 1 AND 256),
  PRIMARY KEY(company_id,dependency_kind,source_id),
  FOREIGN KEY(company_id,transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;
