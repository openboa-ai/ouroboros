-- Immutable management receipt, committed with the new encrypted credential version.
CREATE TABLE credential_enrollments (
    owner_id uuid NOT NULL,
    enrollment_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (owner_id,enrollment_id),
    UNIQUE (owner_id,credential_id,version),
    FOREIGN KEY (owner_id,credential_id,version)
        REFERENCES credential_versions(owner_id,credential_id,version)
);
