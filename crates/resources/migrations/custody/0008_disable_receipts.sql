-- A disabled bit alone cannot identify which admitted operation committed it.
CREATE TABLE credential_disables (
    owner_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    version bigint NOT NULL CHECK(version > 0),
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(owner_id,intent_id),
    UNIQUE(owner_id,attempt_id),
    FOREIGN KEY(owner_id,credential_id,version)
        REFERENCES credential_versions(owner_id,credential_id,version)
);
