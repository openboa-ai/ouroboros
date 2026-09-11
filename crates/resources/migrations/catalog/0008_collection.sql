-- A collection marker fixes one non-reused object lifetime before physical removal.
CREATE TABLE catalog_collections (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    upload_id uuid NOT NULL,
    object_id uuid NOT NULL,
    input jsonb NOT NULL,
    binding jsonb NOT NULL,
    policy jsonb NOT NULL,
    physical_identity jsonb NOT NULL,
    state text NOT NULL CHECK(state IN ('deleting','deleted')),
    record jsonb,
    marked_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
    completed_at timestamptz,
    PRIMARY KEY(firm_id,intent_id),
    UNIQUE(firm_id,object_id),
    FOREIGN KEY(firm_id,object_id,upload_id)
        REFERENCES blob_objects(firm_id,object_id,upload_intent_id),
    CHECK((state='deleting' AND record IS NULL AND completed_at IS NULL)
        OR (state='deleted' AND record IS NOT NULL AND completed_at IS NOT NULL))
);
ALTER TABLE blob_objects DROP CONSTRAINT blob_objects_state_check;
ALTER TABLE blob_objects ADD CONSTRAINT blob_objects_state_check
    CHECK(state IN ('prepared','verified','deleting','deleted'));
REVOKE ALL ON catalog_collections FROM PUBLIC;
