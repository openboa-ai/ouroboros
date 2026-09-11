ALTER TABLE conversation_participants ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE conversation_recipients ADD COLUMN membership_revision bigint NOT NULL DEFAULT 0 CHECK(membership_revision>=0);
