-- C1a-01 store and maintenance records. Execute these statements in the initialization transaction.
CREATE TABLE company_store (
  company_id TEXT PRIMARY KEY NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  singleton INTEGER NOT NULL UNIQUE CHECK(singleton=1),
  schema_version INTEGER NOT NULL CHECK(schema_version>=1),
  schema_digest BLOB NOT NULL CHECK(length(schema_digest)=32),
  state_revision BLOB NOT NULL CHECK(length(state_revision)=8),
  record_sequence BLOB NOT NULL CHECK(length(record_sequence)=8),
  generation BLOB NOT NULL CHECK(length(generation)=8),
  created_at_ms INTEGER NOT NULL
) STRICT;
CREATE TABLE schema_migration (
  migration_number INTEGER PRIMARY KEY NOT NULL CHECK(migration_number>=1),
  migration_digest BLOB NOT NULL CHECK(length(migration_digest)=32),
  from_schema INTEGER NOT NULL CHECK(from_schema>=0),
  to_schema INTEGER NOT NULL CHECK(to_schema=from_schema+1),
  completed_at_ms INTEGER NOT NULL,
  UNIQUE(from_schema), UNIQUE(to_schema)
) STRICT;
CREATE TABLE mutation_group (
  company_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  generation BLOB NOT NULL CHECK(length(generation)=8),
  first_sequence BLOB NOT NULL CHECK(length(first_sequence)=8),
  last_sequence BLOB NOT NULL CHECK(length(last_sequence)=8 AND last_sequence>=first_sequence),
  state_before BLOB NOT NULL CHECK(length(state_before)=8),
  state_after BLOB NOT NULL CHECK(length(state_after)=8),
  recorded_at_ms INTEGER NOT NULL,
  PRIMARY KEY(company_id,transaction_id),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;
CREATE TABLE audit_entry (
  company_id TEXT NOT NULL,
  record_sequence BLOB NOT NULL CHECK(length(record_sequence)=8),
  transaction_id TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  body_bytes BLOB NOT NULL,
  body_digest BLOB NOT NULL CHECK(length(body_digest)=32),
  PRIMARY KEY(company_id,record_sequence),
  FOREIGN KEY(company_id,transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE storage_entry (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  entry_id TEXT NOT NULL CHECK(length(CAST(entry_id AS BLOB)) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK(kind IN ('CREATED','OPENED')),
  creation_id TEXT NOT NULL CHECK(length(CAST(creation_id AS BLOB)) BETWEEN 1 AND 256),
  store_id TEXT CHECK(store_id IS NULL OR (length(CAST(store_id AS BLOB)) BETWEEN 1 AND 256)),
  intent_digest BLOB CHECK(intent_digest IS NULL OR (length(intent_digest)=32)),
  allocation_digest BLOB CHECK(allocation_digest IS NULL OR (length(allocation_digest)=32)),
  generation BLOB NOT NULL CHECK(length(generation)=8 AND generation>X'0000000000000000'),
  previous_generation BLOB NOT NULL CHECK(length(previous_generation)=8),
  schema_version INTEGER NOT NULL CHECK(schema_version>=1),
  schema_digest BLOB NOT NULL CHECK(length(schema_digest)=32),
  transaction_id TEXT NOT NULL CHECK(length(CAST(transaction_id AS BLOB)) BETWEEN 1 AND 256),
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms BETWEEN -62135596800000 AND 253402300799999),
  PRIMARY KEY(company_id,entry_id),
  UNIQUE(company_id,generation),
  FOREIGN KEY(company_id,creation_id) REFERENCES storage_entry(company_id,entry_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  CONSTRAINT storage_entry_form CHECK((kind='CREATED' AND entry_id=creation_id AND store_id IS NOT NULL AND intent_digest IS NOT NULL AND allocation_digest IS NOT NULL AND previous_generation=X'0000000000000000' AND generation=X'0000000000000001') OR
    (kind='OPENED' AND entry_id<>creation_id AND store_id IS NULL AND intent_digest IS NULL AND allocation_digest IS NULL AND previous_generation>X'0000000000000000' AND generation>previous_generation)),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX one_creation ON storage_entry(company_id) WHERE kind='CREATED';

CREATE TABLE maintenance_operation (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  request_id TEXT NOT NULL CHECK(length(CAST(request_id AS BLOB)) BETWEEN 1 AND 256),
  principal_kind TEXT NOT NULL CHECK(principal_kind IN ('FIXTURE','COMPANY')),
  principal_id TEXT NOT NULL CHECK(length(CAST(principal_id AS BLOB)) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK(kind IN ('UPGRADE','REPAIR')),
  store_id TEXT NOT NULL CHECK(length(CAST(store_id AS BLOB)) BETWEEN 1 AND 256),
  intent_bytes BLOB NOT NULL CHECK(length(intent_bytes) BETWEEN 1 AND 65536),
  intent_digest BLOB NOT NULL CHECK(length(intent_digest)=32),
  plan_bytes BLOB NOT NULL CHECK(length(plan_bytes) BETWEEN 1 AND 65536),
  plan_digest BLOB NOT NULL CHECK(length(plan_digest)=32),
  source_bundle_digest BLOB NOT NULL CHECK(length(source_bundle_digest)=32),
  target_bundle_digest BLOB NOT NULL CHECK(length(target_bundle_digest)=32),
  source_schema INTEGER NOT NULL CHECK(source_schema>=1),
  source_schema_digest BLOB NOT NULL CHECK(length(source_schema_digest)=32),
  target_schema INTEGER NOT NULL CHECK(target_schema>=1),
  target_schema_digest BLOB NOT NULL CHECK(length(target_schema_digest)=32),
  unit_count INTEGER NOT NULL CHECK(unit_count>=1),
  original_not_after INTEGER NOT NULL CHECK(original_not_after BETWEEN -62135596800000 AND 253402300799999),
  budget_owner_operation_id TEXT NOT NULL CHECK(length(CAST(budget_owner_operation_id AS BLOB)) BETWEEN 1 AND 256),
  unit_attempt_limit INTEGER NOT NULL CHECK(unit_attempt_limit>=1),
  predecessor_operation_id TEXT CHECK(predecessor_operation_id IS NULL OR (length(CAST(predecessor_operation_id AS BLOB)) BETWEEN 1 AND 256)),
  created_transaction_id TEXT NOT NULL CHECK(length(CAST(created_transaction_id AS BLOB)) BETWEEN 1 AND 256),
  PRIMARY KEY(company_id,operation_id),
  UNIQUE(company_id,request_id),
  FOREIGN KEY(company_id,budget_owner_operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,predecessor_operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,created_transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  CONSTRAINT operation_lineage CHECK((kind='UPGRADE' AND predecessor_operation_id IS NULL AND budget_owner_operation_id=operation_id) OR
    (kind='REPAIR' AND predecessor_operation_id IS NOT NULL AND predecessor_operation_id<>operation_id AND budget_owner_operation_id<>operation_id)),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX one_repair_successor ON maintenance_operation(company_id,predecessor_operation_id) WHERE predecessor_operation_id IS NOT NULL;

CREATE INDEX operation_budget_lookup ON maintenance_operation(company_id,budget_owner_operation_id);

CREATE TABLE maintenance_unit (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  ordinal INTEGER NOT NULL CHECK(ordinal>=1),
  unit_id TEXT NOT NULL CHECK(length(CAST(unit_id AS BLOB)) BETWEEN 1 AND 256),
  unit_digest BLOB NOT NULL CHECK(length(unit_digest)=32),
  from_schema INTEGER NOT NULL CHECK(from_schema>=1),
  from_schema_digest BLOB NOT NULL CHECK(length(from_schema_digest)=32),
  to_schema INTEGER NOT NULL CHECK(to_schema>=1),
  to_schema_digest BLOB NOT NULL CHECK(length(to_schema_digest)=32),
  precondition_bytes BLOB NOT NULL CHECK(length(precondition_bytes) BETWEEN 1 AND 65536),
  permitted_write_set_bytes BLOB NOT NULL CHECK(length(permitted_write_set_bytes) BETWEEN 1 AND 65536),
  postcondition_bytes BLOB NOT NULL CHECK(length(postcondition_bytes) BETWEEN 1 AND 65536),
  preceding_checkpoint_digest BLOB NOT NULL CHECK(length(preceding_checkpoint_digest)=32),
  resulting_checkpoint_digest BLOB NOT NULL CHECK(length(resulting_checkpoint_digest)=32),
  bundled_entry_id TEXT NOT NULL CHECK(length(CAST(bundled_entry_id AS BLOB)) BETWEEN 1 AND 256),
  PRIMARY KEY(company_id,operation_id,ordinal),
  UNIQUE(company_id,operation_id,unit_id),
  FOREIGN KEY(company_id,operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  CONSTRAINT unit_schema_step CHECK(to_schema>=from_schema AND to_schema-from_schema<=1 AND (to_schema=from_schema)=(to_schema_digest=from_schema_digest)),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_admission (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  original_receipt_id TEXT NOT NULL CHECK(length(CAST(original_receipt_id AS BLOB)) BETWEEN 1 AND 256),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('FIXTURE','COMPANY')),
  source_record_kind TEXT NOT NULL CHECK(length(CAST(source_record_kind AS BLOB)) BETWEEN 1 AND 256),
  source_record_id TEXT NOT NULL CHECK(length(CAST(source_record_id AS BLOB)) BETWEEN 1 AND 256),
  source_record_revision BLOB NOT NULL CHECK(length(source_record_revision)=8 AND source_record_revision>X'0000000000000000'),
  source_record_digest BLOB NOT NULL CHECK(length(source_record_digest)=32),
  admission_control_digest BLOB NOT NULL CHECK(length(admission_control_digest)=32),
  original_responsible_kind TEXT NOT NULL CHECK(original_responsible_kind IN ('FIXTURE','COMPANY')),
  original_responsible_id TEXT NOT NULL CHECK(length(CAST(original_responsible_id AS BLOB)) BETWEEN 1 AND 256),
  original_continuity_bytes BLOB NOT NULL CHECK(length(original_continuity_bytes) BETWEEN 1 AND 65536),
  admitted_transaction_id TEXT NOT NULL CHECK(length(CAST(admitted_transaction_id AS BLOB)) BETWEEN 1 AND 256),
  PRIMARY KEY(company_id,operation_id),
  FOREIGN KEY(company_id,operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,operation_id,original_receipt_id) REFERENCES maintenance_receipt(company_id,operation_id,receipt_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,admitted_transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_control (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('APPLY_UNIT','FINALIZE','SUPERSEDE')),
  unit_ordinal INTEGER NOT NULL CHECK(unit_ordinal>=0),
  version BLOB NOT NULL CHECK(length(version)=8 AND version>X'0000000000000000'),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('FIXTURE','COMPANY')),
  source_record_kind TEXT NOT NULL CHECK(length(CAST(source_record_kind AS BLOB)) BETWEEN 1 AND 256),
  source_record_id TEXT NOT NULL CHECK(length(CAST(source_record_id AS BLOB)) BETWEEN 1 AND 256),
  source_record_revision BLOB NOT NULL CHECK(length(source_record_revision)=8 AND source_record_revision>X'0000000000000000'),
  source_record_digest BLOB NOT NULL CHECK(length(source_record_digest)=32),
  currentness TEXT NOT NULL CHECK(currentness IN ('VERIFIED','UNVERIFIED')),
  verdict TEXT NOT NULL CHECK(verdict IN ('ALLOW','DENY','UNDETERMINED')),
  reason_code TEXT NOT NULL CHECK(length(CAST(reason_code AS BLOB)) BETWEEN 1 AND 256),
  expected_checkpoint_digest BLOB NOT NULL CHECK(length(expected_checkpoint_digest)=32),
  dependency_digest BLOB NOT NULL CHECK(length(dependency_digest)=32),
  assessment_bytes BLOB NOT NULL CHECK(length(assessment_bytes) BETWEEN 1 AND 65536),
  updated_transaction_id TEXT NOT NULL CHECK(length(CAST(updated_transaction_id AS BLOB)) BETWEEN 1 AND 256),
  PRIMARY KEY(company_id,operation_id,action,unit_ordinal),
  FOREIGN KEY(company_id,operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,updated_transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  CONSTRAINT control_ordinal CHECK((action='APPLY_UNIT' AND unit_ordinal>0) OR (action<>'APPLY_UNIT' AND unit_ordinal=0)),
  CONSTRAINT unverified_cannot_allow CHECK(currentness='VERIFIED' OR verdict<>'ALLOW'),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_control_dependency (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK(action IN ('APPLY_UNIT','FINALIZE','SUPERSEDE')),
  unit_ordinal INTEGER NOT NULL CHECK(unit_ordinal>=0),
  dependency_kind TEXT NOT NULL CHECK(dependency_kind IN ('AUTHORITY','STOP','POLICY','RESOURCE','RESPONSIBILITY','BINDING','TIME')),
  dependency_id TEXT NOT NULL CHECK(length(CAST(dependency_id AS BLOB)) BETWEEN 1 AND 256),
  expected_revision BLOB NOT NULL CHECK(length(expected_revision)=8 AND expected_revision>X'0000000000000000'),
  source_digest BLOB NOT NULL CHECK(length(source_digest)=32),
  PRIMARY KEY(company_id,operation_id,action,unit_ordinal,dependency_kind,dependency_id),
  FOREIGN KEY(company_id,operation_id,action,unit_ordinal) REFERENCES maintenance_control(company_id,operation_id,action,unit_ordinal) ON DELETE RESTRICT,
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_executor (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  version BLOB NOT NULL CHECK(length(version)=8 AND version>X'0000000000000000'),
  operation_id TEXT CHECK(operation_id IS NULL OR (length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256)),
  bound_generation BLOB CHECK(bound_generation IS NULL OR (length(bound_generation)=8 AND bound_generation>X'0000000000000000')),
  committed_ordinal INTEGER NOT NULL CHECK(committed_ordinal>=0),
  checkpoint_digest BLOB CHECK(checkpoint_digest IS NULL OR (length(checkpoint_digest)=32)),
  actual_schema INTEGER NOT NULL CHECK(actual_schema>=1),
  actual_schema_digest BLOB NOT NULL CHECK(length(actual_schema_digest)=32),
  phase TEXT NOT NULL CHECK(phase IN ('IDLE','TRANSFORMING','TRANSFORMED')),
  responsible_kind TEXT CHECK(responsible_kind IS NULL OR (responsible_kind IN ('FIXTURE','COMPANY'))),
  responsible_id TEXT CHECK(responsible_id IS NULL OR (length(CAST(responsible_id AS BLOB)) BETWEEN 1 AND 256)),
  next_condition_bytes BLOB NOT NULL CHECK(length(next_condition_bytes) BETWEEN 1 AND 65536),
  last_progress_receipt_id TEXT CHECK(last_progress_receipt_id IS NULL OR (length(CAST(last_progress_receipt_id AS BLOB)) BETWEEN 1 AND 256)),
  PRIMARY KEY(company_id),
  FOREIGN KEY(company_id,operation_id) REFERENCES maintenance_admission(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,operation_id,last_progress_receipt_id) REFERENCES maintenance_receipt(company_id,operation_id,receipt_id) ON DELETE RESTRICT,
  CONSTRAINT executor_occupancy CHECK((phase='IDLE' AND operation_id IS NULL AND bound_generation IS NULL AND committed_ordinal=0 AND checkpoint_digest IS NULL AND responsible_kind IS NULL AND responsible_id IS NULL AND last_progress_receipt_id IS NULL) OR
    (phase<>'IDLE' AND operation_id IS NOT NULL AND bound_generation IS NOT NULL AND checkpoint_digest IS NOT NULL AND responsible_kind IS NOT NULL AND responsible_id IS NOT NULL AND last_progress_receipt_id IS NOT NULL AND (phase<>'TRANSFORMED' OR committed_ordinal>0))),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_restriction (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  restriction_id TEXT NOT NULL CHECK(length(CAST(restriction_id AS BLOB)) BETWEEN 1 AND 256),
  version BLOB NOT NULL CHECK(length(version)=8 AND version>X'0000000000000000'),
  origin_operation_id TEXT NOT NULL CHECK(length(CAST(origin_operation_id AS BLOB)) BETWEEN 1 AND 256),
  responsible_operation_id TEXT NOT NULL CHECK(length(CAST(responsible_operation_id AS BLOB)) BETWEEN 1 AND 256),
  status TEXT NOT NULL CHECK(status IN ('OPEN','RESOLVED')),
  responsible_kind TEXT NOT NULL CHECK(responsible_kind IN ('FIXTURE','COMPANY')),
  responsible_id TEXT NOT NULL CHECK(length(CAST(responsible_id AS BLOB)) BETWEEN 1 AND 256),
  next_condition_bytes BLOB NOT NULL CHECK(length(next_condition_bytes) BETWEEN 1 AND 65536),
  created_receipt_id TEXT NOT NULL CHECK(length(CAST(created_receipt_id AS BLOB)) BETWEEN 1 AND 256),
  resolution_receipt_id TEXT CHECK(resolution_receipt_id IS NULL OR (length(CAST(resolution_receipt_id AS BLOB)) BETWEEN 1 AND 256)),
  PRIMARY KEY(company_id,restriction_id),
  FOREIGN KEY(company_id,origin_operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,responsible_operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,origin_operation_id,created_receipt_id) REFERENCES maintenance_receipt(company_id,operation_id,receipt_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,responsible_operation_id,resolution_receipt_id) REFERENCES maintenance_receipt(company_id,operation_id,receipt_id) ON DELETE RESTRICT,
  CONSTRAINT restriction_resolution CHECK((status='OPEN' AND resolution_receipt_id IS NULL) OR (status='RESOLVED' AND resolution_receipt_id IS NOT NULL)),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE maintenance_receipt (
  company_id TEXT NOT NULL CHECK(length(CAST(company_id AS BLOB)) BETWEEN 1 AND 256),
  receipt_id TEXT NOT NULL CHECK(length(CAST(receipt_id AS BLOB)) BETWEEN 1 AND 256),
  operation_id TEXT NOT NULL CHECK(length(CAST(operation_id AS BLOB)) BETWEEN 1 AND 256),
  request_id TEXT NOT NULL CHECK(length(CAST(request_id AS BLOB)) BETWEEN 1 AND 256),
  parent_request_id TEXT CHECK(parent_request_id IS NULL OR (length(CAST(parent_request_id AS BLOB)) BETWEEN 1 AND 256)),
  request_bytes BLOB NOT NULL CHECK(length(request_bytes) BETWEEN 1 AND 65536),
  request_digest BLOB NOT NULL CHECK(length(request_digest)=32),
  principal_kind TEXT NOT NULL CHECK(principal_kind IN ('FIXTURE','COMPANY')),
  principal_id TEXT NOT NULL CHECK(length(CAST(principal_id AS BLOB)) BETWEEN 1 AND 256),
  kind TEXT NOT NULL CHECK(kind IN ('ADMITTED','UNIT_CLAIMED','UNIT_COMMITTED','FINAL_VALIDATED','SUPERSEDED','CONTROL_APPLIED','EXECUTOR_BOUND')),
  unit_ordinal INTEGER CHECK(unit_ordinal IS NULL OR (unit_ordinal>=1)),
  unit_digest BLOB CHECK(unit_digest IS NULL OR (length(unit_digest)=32)),
  claim_receipt_id TEXT CHECK(claim_receipt_id IS NULL OR (length(CAST(claim_receipt_id AS BLOB)) BETWEEN 1 AND 256)),
  checkpoint_digest BLOB CHECK(checkpoint_digest IS NULL OR (length(checkpoint_digest)=32)),
  result_schema INTEGER CHECK(result_schema IS NULL OR (result_schema>=1)),
  result_schema_digest BLOB CHECK(result_schema_digest IS NULL OR (length(result_schema_digest)=32)),
  schema_migration_number INTEGER CHECK(schema_migration_number IS NULL OR (schema_migration_number>=1)),
  generation BLOB NOT NULL CHECK(length(generation)=8 AND generation>X'0000000000000000'),
  transaction_id TEXT NOT NULL CHECK(length(CAST(transaction_id AS BLOB)) BETWEEN 1 AND 256),
  result_bytes BLOB NOT NULL CHECK(length(result_bytes) BETWEEN 1 AND 65536),
  recorded_at_ms INTEGER NOT NULL CHECK(recorded_at_ms BETWEEN -62135596800000 AND 253402300799999),
  PRIMARY KEY(company_id,receipt_id),
  UNIQUE(company_id,request_id),
  UNIQUE(company_id,operation_id,receipt_id),
  FOREIGN KEY(company_id,operation_id) REFERENCES maintenance_operation(company_id,operation_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,transaction_id) REFERENCES mutation_group(company_id,transaction_id) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,operation_id,unit_ordinal) REFERENCES maintenance_unit(company_id,operation_id,ordinal) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,operation_id,claim_receipt_id) REFERENCES maintenance_receipt(company_id,operation_id,receipt_id) ON DELETE RESTRICT,
  FOREIGN KEY(schema_migration_number) REFERENCES schema_migration(migration_number) ON DELETE RESTRICT,
  FOREIGN KEY(company_id,parent_request_id) REFERENCES maintenance_receipt(company_id,request_id) ON DELETE RESTRICT,
  CONSTRAINT receipt_parent CHECK(parent_request_id IS NULL OR (kind='ADMITTED' AND parent_request_id<>request_id)),
  CONSTRAINT receipt_unit_payload CHECK((kind IN ('UNIT_CLAIMED','UNIT_COMMITTED') AND unit_ordinal IS NOT NULL AND unit_digest IS NOT NULL) OR
    (kind NOT IN ('UNIT_CLAIMED','UNIT_COMMITTED') AND unit_ordinal IS NULL AND unit_digest IS NULL)),
  CONSTRAINT receipt_claim_link CHECK((kind='UNIT_COMMITTED' AND claim_receipt_id IS NOT NULL AND claim_receipt_id<>receipt_id) OR (kind<>'UNIT_COMMITTED' AND claim_receipt_id IS NULL)),
  CONSTRAINT receipt_schema_pair CHECK((result_schema IS NULL)=(result_schema_digest IS NULL) AND (result_schema IS NULL)=(checkpoint_digest IS NULL)),
  CONSTRAINT receipt_checkpoint CHECK(kind='CONTROL_APPLIED' OR checkpoint_digest IS NOT NULL),
  CONSTRAINT receipt_migration CHECK(schema_migration_number IS NULL OR kind='UNIT_COMMITTED'),
  FOREIGN KEY(company_id) REFERENCES company_store(company_id) ON DELETE RESTRICT
) STRICT;

CREATE UNIQUE INDEX one_committed_unit ON maintenance_receipt(company_id,operation_id,unit_ordinal) WHERE kind='UNIT_COMMITTED';

CREATE UNIQUE INDEX one_claim_consumption ON maintenance_receipt(company_id,claim_receipt_id) WHERE kind='UNIT_COMMITTED';

CREATE UNIQUE INDEX one_operation_endpoint ON maintenance_receipt(company_id,operation_id,kind) WHERE kind IN ('ADMITTED','FINAL_VALIDATED','SUPERSEDED');

CREATE INDEX receipt_operation_kind ON maintenance_receipt(company_id,operation_id,kind);
