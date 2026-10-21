-- PGlite compatibility fixture ONLY. Models row locking for legacy application
-- regressions. Identity/SECURITY DEFINER boundaries are tested in real PostgreSQL.
CREATE SCHEMA tendra_runtime_private;
CREATE FUNCTION tendra_runtime_private.lock_brand(p_id uuid,p_write boolean) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF p_write THEN PERFORM 1 FROM public.brands WHERE id=p_id FOR UPDATE;
 ELSE PERFORM 1 FROM public.brands WHERE id=p_id FOR SHARE; END IF;
END $$;
