CREATE TABLE credential_versions (
    owner_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    envelope bytea NOT NULL CHECK (octet_length(envelope) BETWEEN 58 AND 16441),
    disabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    disabled_at timestamptz,
    PRIMARY KEY (owner_id, credential_id, version),
    CHECK (disabled = (disabled_at IS NOT NULL))
);
