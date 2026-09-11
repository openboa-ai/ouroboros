-- Native results are protected company data, not credential values or new execution authority.
CREATE TABLE provider_receipts (
    owner_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    ticket_sha256 text NOT NULL CHECK (ticket_sha256 ~ '^[a-f0-9]{64}$'),
    reply jsonb NOT NULL CHECK (octet_length(reply::text) <= 16777216),
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY(owner_id,attempt_id),
    FOREIGN KEY(owner_id,attempt_id) REFERENCES credential_use_claims(owner_id,attempt_id)
);
