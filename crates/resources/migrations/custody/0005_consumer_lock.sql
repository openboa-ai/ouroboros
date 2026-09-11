-- Row locking without exposing UPDATE privilege to an operating credential consumer.
-- Returns ciphertext only; decryption remains in the trusted worker, never this database.
CREATE FUNCTION public.lock_credential_version(owner_key uuid, credential_key uuid, version_key bigint)
RETURNS bytea
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE ciphertext bytea;
BEGIN
    SELECT envelope INTO ciphertext FROM public.credential_versions
    WHERE owner_id=owner_key AND credential_id=credential_key AND version=version_key
      AND NOT disabled
    FOR SHARE;
    RETURN ciphertext;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_credential_version(uuid,uuid,bigint) FROM PUBLIC;
