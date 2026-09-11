-- Expiry is fixed at admission, not renewed by connection, polling or worker replacement.
-- Legacy intents have no new transfer authority; their existing receipts remain observable.
CREATE TABLE resource_transfers (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    origin_fingerprint text,
    PRIMARY KEY(firm_id,intent_id),
    FOREIGN KEY(firm_id,intent_id) REFERENCES resource_calls(firm_id,intent_id),
    CHECK(origin_fingerprint IS NULL OR origin_fingerprint ~ '^[0-9a-fA-F]{64}$')
);
REVOKE ALL ON resource_transfers FROM PUBLIC;

ALTER TABLE storage_allocations DROP CONSTRAINT storage_allocations_bytes_check;
ALTER TABLE storage_allocations ADD CONSTRAINT storage_allocations_bytes_check CHECK(bytes>=0);
