-- Legacy library receipts remain observable but cannot prove a dispatched Core attempt.
ALTER TABLE credential_enrollments ADD COLUMN intent_id uuid;
ALTER TABLE credential_enrollments ADD COLUMN attempt_id uuid;
ALTER TABLE credential_enrollments ADD CONSTRAINT enrollment_attempt_pair
    CHECK ((intent_id IS NULL) = (attempt_id IS NULL));
CREATE UNIQUE INDEX enrollment_intent ON credential_enrollments(owner_id,intent_id)
    WHERE intent_id IS NOT NULL;
CREATE UNIQUE INDEX enrollment_attempt ON credential_enrollments(owner_id,attempt_id)
    WHERE attempt_id IS NOT NULL;
