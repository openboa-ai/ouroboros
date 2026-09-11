-- A claim precedes use and is retained even when outcome or process liveness is unknown.
CREATE TABLE credential_use_claims (
    owner_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    version bigint NOT NULL,
    claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (owner_id, attempt_id),
    FOREIGN KEY (owner_id, credential_id, version)
        REFERENCES credential_versions(owner_id, credential_id, version)
);
