-- BW-36.7R2: correct the dormant Workspace identity authority before adoption.
BEGIN;

DO $preflight$
DECLARE
  problem TEXT;
BEGIN
  IF to_regclass('public.app_identities') IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bw36_7r2_already_or_partially_applied: app_identities already exists; stop and inspect';
  END IF;
  IF to_regclass('public.workspaces') IS NULL OR to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bw36_7r2_schema_mismatch: BW-36.6 Workspace tables are required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.workspaces) OR EXISTS (SELECT 1 FROM public.workspace_memberships)
     OR EXISTS (SELECT 1 FROM public.brands WHERE workspace_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.boards WHERE workspace_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bw36_7r2_adoption_nonzero: do not edit around this guard; capture the error and stop';
  END IF;

  SELECT string_agg(expected, ', ' ORDER BY expected) INTO problem
  FROM (VALUES
    ('workspaces.created_by_user_id'), ('workspace_memberships.user_id'),
    ('workspace_memberships.invited_by_user_id'), ('brands.workspace_id'), ('boards.workspace_id')
  ) AS required(expected)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = split_part(expected, '.', 1)
      AND c.column_name = split_part(expected, '.', 2)
  );
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bw36_7r2_schema_mismatch: missing expected columns: ' || problem;
  END IF;

  IF to_regprocedure('public.workspace_has_active_role(uuid,text[])') IS NULL
     OR to_regprocedure('public.protect_workspace_last_owner()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.workspace_memberships'::regclass AND tgname = 'workspace_memberships_last_owner_guard' AND NOT tgisinternal)
     OR (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('workspaces','workspace_memberships') AND policyname IN ('workspace_member_read','workspace_membership_bounded_read')) <> 2
     OR (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('workspaces_status_updated_idx','workspace_memberships_user_status_idx','workspace_memberships_workspace_status_role_idx','brands_workspace_id_idx','boards_workspace_id_idx')) <> 5
     OR EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.workspaces'::regclass, 'public.workspace_memberships'::regclass) AND NOT relrowsecurity)
     OR NOT has_table_privilege('authenticated', 'public.workspaces', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.workspace_memberships', 'SELECT')
     OR has_table_privilege('anon', 'public.workspaces', 'SELECT')
     OR has_table_privilege('anon', 'public.workspace_memberships', 'SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='workspace_memberships'::regclass AND contype='f' AND confrelid='workspaces'::regclass AND confdeltype='r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='brands'::regclass AND contype='f' AND confrelid='workspaces'::regclass AND confdeltype='r')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='boards'::regclass AND contype='f' AND confrelid='workspaces'::regclass AND confdeltype='r') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bw36_7r2_schema_mismatch: expected BW-36.6 functions, trigger, policies, indexes, or restrictive foreign keys differ';
  END IF;
END
$preflight$;

CREATE TABLE public.app_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_email TEXT NOT NULL CONSTRAINT app_identities_canonical_email_check
    CHECK (canonical_email <> '' AND canonical_email = lower(btrim(canonical_email))),
  status TEXT NOT NULL DEFAULT 'active' CONSTRAINT app_identities_status_check
    CHECK (status IN ('active', 'disabled')),
  revision BIGINT NOT NULL DEFAULT 1 CONSTRAINT app_identities_revision_check CHECK (revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_identities_canonical_email_key ON public.app_identities (canonical_email);
ALTER TABLE public.app_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_identities FROM PUBLIC, anon, authenticated;

DROP POLICY workspace_member_read ON public.workspaces;
DROP POLICY workspace_membership_bounded_read ON public.workspace_memberships;
DROP FUNCTION public.workspace_has_active_role(UUID, TEXT[]);

ALTER TABLE public.workspaces RENAME COLUMN created_by_user_id TO created_by_identity_id;
ALTER TABLE public.workspace_memberships RENAME COLUMN user_id TO identity_id;
ALTER TABLE public.workspace_memberships RENAME COLUMN invited_by_user_id TO invited_by_identity_id;
ALTER TABLE public.workspace_memberships RENAME CONSTRAINT workspace_memberships_workspace_user_key TO workspace_memberships_workspace_identity_key;
ALTER INDEX public.workspace_memberships_user_status_idx RENAME TO workspace_memberships_identity_status_idx;

ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_created_by_identity_fkey
  FOREIGN KEY (created_by_identity_id) REFERENCES public.app_identities(id) ON DELETE RESTRICT;
ALTER TABLE public.workspace_memberships ADD CONSTRAINT workspace_memberships_identity_fkey
  FOREIGN KEY (identity_id) REFERENCES public.app_identities(id) ON DELETE RESTRICT;
ALTER TABLE public.workspace_memberships ADD CONSTRAINT workspace_memberships_invited_by_identity_fkey
  FOREIGN KEY (invited_by_identity_id) REFERENCES public.app_identities(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.protect_workspace_last_owner() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
DECLARE
  protected_workspace_id UUID := OLD.workspace_id;
  protected_identity_id UUID := OLD.identity_id;
  removes_owner BOOLEAN := FALSE;
BEGIN
  IF OLD.role = 'owner' AND OLD.status = 'accepted' THEN
    IF TG_OP = 'DELETE' THEN removes_owner := TRUE;
    ELSE removes_owner := NEW.role <> 'owner' OR NEW.status <> 'accepted'
      OR NEW.workspace_id <> OLD.workspace_id OR NEW.identity_id <> protected_identity_id;
    END IF;
  END IF;
  IF NOT removes_owner THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(protected_workspace_id::TEXT, 366));
  IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = protected_workspace_id AND w.status = 'active')
     AND (SELECT count(*) FROM public.workspace_memberships m WHERE m.workspace_id = protected_workspace_id AND m.role = 'owner' AND m.status = 'accepted') <= 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'workspace_last_owner_protected';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER workspace_memberships_last_owner_guard ON public.workspace_memberships;
CREATE TRIGGER workspace_memberships_last_owner_guard
BEFORE DELETE OR UPDATE OF workspace_id, identity_id, role, status ON public.workspace_memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_last_owner();

-- Signed Google sessions are verified by the application server. Browser roles
-- have no compatible database principal, so Workspace catalogs remain closed.
REVOKE ALL ON TABLE public.workspaces, public.workspace_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_workspace_last_owner() FROM PUBLIC, anon, authenticated;

COMMIT;
