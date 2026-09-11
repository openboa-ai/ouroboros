-- Operating roles may only insert the ciphertext columns and update disable metadata.
-- The trigger also prevents re-enablement through those otherwise legitimate columns.
CREATE FUNCTION guard_credential_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'credential version removal is forbidden';
    END IF;
    IF (NEW.owner_id, NEW.credential_id, NEW.version, NEW.envelope, NEW.created_at)
       IS DISTINCT FROM
       (OLD.owner_id, OLD.credential_id, OLD.version, OLD.envelope, OLD.created_at)
       OR (OLD.disabled AND (NOT NEW.disabled OR NEW.disabled_at IS DISTINCT FROM OLD.disabled_at)) THEN
        RAISE EXCEPTION 'credential version mutation is forbidden';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER credential_version_guard BEFORE UPDATE OR DELETE ON credential_versions
FOR EACH ROW EXECUTE FUNCTION guard_credential_version();
