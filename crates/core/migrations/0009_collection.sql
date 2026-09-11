-- A collection fixes one upload generation. Advancing it is a new, bounded authorization,
-- not a retry lease or a restoration of the original submitter's authority.
CREATE TABLE resource_collections (
    firm_id uuid NOT NULL, intent_id uuid NOT NULL, work_id uuid NOT NULL,
    target_id text NOT NULL, namespace_id uuid NOT NULL, upload_id uuid NOT NULL,
    binding jsonb NOT NULL, policy jsonb NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed')),
    last_sequence bigint NOT NULL DEFAULT 0 CHECK(last_sequence>=0),
    current_step_id uuid, record jsonb,
    PRIMARY KEY(firm_id,intent_id), UNIQUE(firm_id,upload_id),
    CHECK((state='completed')=(record IS NOT NULL)),
    CHECK((last_sequence=0)=(current_step_id IS NULL)),
    FOREIGN KEY(firm_id,intent_id) REFERENCES resource_calls(firm_id,intent_id),
    FOREIGN KEY(firm_id,upload_id) REFERENCES storage_allocations(firm_id,intent_id),
    FOREIGN KEY(firm_id,work_id) REFERENCES work(firm_id,id),
    FOREIGN KEY(firm_id,target_id) REFERENCES resource_targets(firm_id,id),
    FOREIGN KEY(firm_id,namespace_id) REFERENCES workspace_namespaces(firm_id,id)
);
CREATE TABLE collection_steps (
    firm_id uuid NOT NULL, id uuid NOT NULL, collection_intent_id uuid NOT NULL,
    sequence bigint NOT NULL CHECK(sequence>0), principal_id uuid NOT NULL,
    realm text NOT NULL, delegation_id uuid NOT NULL, instance_id uuid, generation uuid,
    fingerprint text, request_key text NOT NULL, input jsonb NOT NULL,
    state text NOT NULL DEFAULT 'issued' CHECK(state IN ('issued','claimed','dispatched','busy')),
    issued_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
    PRIMARY KEY(firm_id,id), UNIQUE(firm_id,collection_intent_id,id),
    UNIQUE(firm_id,collection_intent_id,sequence),
    UNIQUE(firm_id,collection_intent_id,principal_id,realm,request_key),
    CHECK(expires_at>issued_at),
    CHECK((instance_id IS NULL AND generation IS NULL AND fingerprint IS NOT NULL)
        OR (instance_id IS NOT NULL AND generation IS NOT NULL AND fingerprint IS NULL)),
    CHECK(fingerprint IS NULL OR fingerprint ~ '^[0-9a-fA-F]{64}$'),
    FOREIGN KEY(firm_id,collection_intent_id) REFERENCES resource_collections(firm_id,intent_id),
    FOREIGN KEY(firm_id,principal_id) REFERENCES principals(firm_id,id),
    FOREIGN KEY(firm_id,delegation_id) REFERENCES delegations(firm_id,id)
);
ALTER TABLE resource_collections ADD FOREIGN KEY(firm_id,intent_id,current_step_id)
    REFERENCES collection_steps(firm_id,collection_intent_id,id);
-- A source allocation is credited only once, after an exact Catalog deletion receipt.
CREATE TABLE storage_releases (
    firm_id uuid NOT NULL, upload_intent_id uuid NOT NULL, collection_intent_id uuid NOT NULL,
    object_id uuid NOT NULL, store_id uuid NOT NULL, generation uuid NOT NULL,
    bytes bigint NOT NULL CHECK(bytes>=0), record jsonb NOT NULL,
    PRIMARY KEY(firm_id,upload_intent_id), UNIQUE(firm_id,collection_intent_id),
    FOREIGN KEY(firm_id,upload_intent_id) REFERENCES storage_allocations(firm_id,intent_id),
    FOREIGN KEY(firm_id,collection_intent_id) REFERENCES resource_collections(firm_id,intent_id),
    FOREIGN KEY(firm_id,store_id,generation) REFERENCES storage_budgets(firm_id,store_id,generation)
);
REVOKE ALL ON resource_collections,collection_steps,storage_releases FROM PUBLIC;
