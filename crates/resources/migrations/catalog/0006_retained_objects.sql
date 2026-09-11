-- New uploads have a non-reused physical lifetime. Legacy digest-named objects are not
-- adopted, rewritten or made collectible by this migration.
CREATE TABLE blob_objects (
    firm_id uuid NOT NULL,
    object_id uuid NOT NULL,
    upload_intent_id uuid NOT NULL,
    store_id uuid NOT NULL,
    storage_generation uuid NOT NULL,
    digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
    size bigint NOT NULL CHECK(size >= 0),
    state text NOT NULL CHECK(state IN ('prepared','verified')),
    PRIMARY KEY(firm_id,object_id),
    UNIQUE(firm_id,upload_intent_id),
    UNIQUE(firm_id,object_id,upload_intent_id),
    CHECK(object_id <> '00000000-0000-0000-0000-000000000000'::uuid)
);
ALTER TABLE upload_staging ADD COLUMN object_id uuid;
ALTER TABLE upload_staging ADD CONSTRAINT staging_object_identity
    CHECK(object_id IS NULL OR object_id=staging_id);
ALTER TABLE upload_staging ADD FOREIGN KEY(firm_id,object_id,intent_id)
    REFERENCES blob_objects(firm_id,object_id,upload_intent_id);
ALTER TABLE uploads ADD COLUMN object_id uuid;
ALTER TABLE uploads ADD FOREIGN KEY(firm_id,object_id,intent_id)
    REFERENCES blob_objects(firm_id,object_id,upload_intent_id);
ALTER TABLE uploads ADD UNIQUE(firm_id,intent_id,object_id);

-- These typed references are durable holds. This increment has no release or deletion API.
-- A head change adds a new revision hold and never releases the previous revision's hold.
CREATE TABLE upload_object_holds (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    object_id uuid NOT NULL,
    PRIMARY KEY(firm_id,intent_id),
    FOREIGN KEY(firm_id,intent_id,object_id) REFERENCES uploads(firm_id,intent_id,object_id),
    FOREIGN KEY(firm_id,object_id) REFERENCES blob_objects(firm_id,object_id)
);
CREATE TABLE revision_object_holds (
    firm_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    revision bigint NOT NULL,
    object_id uuid NOT NULL,
    PRIMARY KEY(firm_id,workspace_id,revision,object_id),
    FOREIGN KEY(firm_id,workspace_id,revision)
        REFERENCES workspace_snapshots(firm_id,workspace_id,revision),
    FOREIGN KEY(firm_id,object_id) REFERENCES blob_objects(firm_id,object_id)
);

ALTER TABLE workspaces ADD COLUMN namespace_id uuid;
ALTER TABLE workspaces ADD COLUMN work_id uuid;
ALTER TABLE workspaces ADD COLUMN label text;
ALTER TABLE workspaces ADD CONSTRAINT workspace_allocation_identity CHECK(
    (namespace_id IS NULL AND work_id IS NULL AND label IS NULL) OR
    (namespace_id IS NOT NULL AND work_id IS NOT NULL AND label IS NOT NULL
        AND octet_length(label) BETWEEN 1 AND 128 AND label=btrim(label))
);
ALTER TABLE workspaces ADD UNIQUE(firm_id,id,namespace_id,work_id,label);
CREATE TABLE workspace_create_receipts (
    firm_id uuid NOT NULL,
    intent_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    namespace_id uuid NOT NULL,
    work_id uuid NOT NULL,
    label text NOT NULL,
    revision bigint NOT NULL CHECK(revision=0),
    PRIMARY KEY(firm_id,intent_id),
    UNIQUE(firm_id,workspace_id),
    FOREIGN KEY(firm_id,workspace_id,namespace_id,work_id,label)
        REFERENCES workspaces(firm_id,id,namespace_id,work_id,label),
    FOREIGN KEY(firm_id,workspace_id,revision)
        REFERENCES workspace_snapshots(firm_id,workspace_id,revision)
);
REVOKE ALL ON blob_objects,upload_object_holds,revision_object_holds,workspace_create_receipts FROM PUBLIC;
