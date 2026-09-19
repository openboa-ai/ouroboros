-- Stable identity of a firm's data, independent of a Gateway URL or display name.
-- A Core serving generation additionally fences restored/restarted server processes.
ALTER TABLE firms ADD COLUMN environment_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX firms_environment_identity ON firms(environment_id);
