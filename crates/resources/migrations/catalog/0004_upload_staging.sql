-- Admission/reserved capacity belongs to Core. This catalog inventory survives interrupted
-- filesystem operations and must not be removed merely because a worker or lease disappeared.
CREATE TABLE upload_staging (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    store_id uuid NOT NULL,
    storage_generation uuid NOT NULL,
    staging_id uuid NOT NULL UNIQUE,
    digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
    declared_size bigint NOT NULL CHECK(declared_size >= 0 AND declared_size <= 65536),
    state text NOT NULL CHECK(state IN ('prepared','committed')),
    PRIMARY KEY(firm_id,intent_id)
);
REVOKE ALL ON upload_staging FROM PUBLIC;
