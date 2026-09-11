-- Explicit maintenance enrollment only. Normal worker startup must not insert or adopt a store.
CREATE TABLE storage_binding (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    firm_id uuid NOT NULL,
    store_id uuid NOT NULL,
    generation uuid NOT NULL
);
REVOKE ALL ON storage_binding FROM PUBLIC;

-- The worker may inspect/lock the binding, but cannot change it. A row lock prevents an
-- authorized maintenance update from racing a catalog transaction using the previous binding.
CREATE FUNCTION check_storage_binding(expected_firm uuid, expected_store uuid, expected_generation uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actual public.storage_binding%ROWTYPE;
BEGIN
    SELECT * INTO actual FROM public.storage_binding WHERE singleton FOR SHARE;
    RETURN COALESCE(actual.firm_id = expected_firm
        AND actual.store_id = expected_store
        AND actual.generation = expected_generation, false);
END;
$$;
REVOKE ALL ON FUNCTION check_storage_binding(uuid,uuid,uuid) FROM PUBLIC;
