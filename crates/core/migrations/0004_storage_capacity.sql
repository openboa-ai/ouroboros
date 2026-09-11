-- Explicit logical byte budgets. They do not measure filesystem free space or
-- authorize reclamation. Aliases of one store generation share this row.
CREATE TABLE storage_budgets (
 firm_id uuid NOT NULL REFERENCES firms(id), store_id uuid NOT NULL, generation uuid NOT NULL,
 capacity_bytes bigint NOT NULL CHECK(capacity_bytes>=0),
 committed_bytes bigint NOT NULL DEFAULT 0 CHECK(committed_bytes>=0 AND committed_bytes<=capacity_bytes),
 PRIMARY KEY(firm_id,store_id,generation)
);
-- Each distinct upload retains its full declared-byte charge, even when content
-- is deduplicated, dispatch never happens, or the original attempt completes.
-- There is deliberately no release/expiry path in this bounded implementation.
CREATE TABLE storage_allocations (
 firm_id uuid NOT NULL, intent_id uuid NOT NULL, store_id uuid NOT NULL, generation uuid NOT NULL,
 bytes bigint NOT NULL CHECK(bytes>=0 AND bytes<=65536),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(firm_id,intent_id),
 FOREIGN KEY(firm_id,intent_id) REFERENCES intents(firm_id,id),
 FOREIGN KEY(firm_id,store_id,generation) REFERENCES storage_budgets(firm_id,store_id,generation)
);
REVOKE ALL ON storage_budgets,storage_allocations FROM PUBLIC;
