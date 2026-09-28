-- BW-36.6 Phase 1: dormant, additive Workspace schema and authorization foundation.
-- Depends on the current public.brands and public.boards tables. This migration
-- deliberately creates no tenant rows and changes no existing access policy.
BEGIN;

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CONSTRAINT workspaces_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  avatar_url TEXT NULL CONSTRAINT workspaces_avatar_url_length_check CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048),
  locale TEXT NOT NULL DEFAULT 'en' CONSTRAINT workspaces_locale_check CHECK (locale IN ('en', 'de')),
  status TEXT NOT NULL DEFAULT 'active' CONSTRAINT workspaces_status_check CHECK (status IN ('active', 'archived')),
  revision BIGINT NOT NULL DEFAULT 1 CONSTRAINT workspaces_revision_check CHECK (revision >= 1),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT workspaces_archive_state_check CHECK (
    (status = 'active' AND archived_at IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL)
  )
);

CREATE TABLE public.workspace_memberships (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CONSTRAINT workspace_memberships_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'accepted' CONSTRAINT workspace_memberships_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id UUID NULL,
  revision BIGINT NOT NULL DEFAULT 1 CONSTRAINT workspace_memberships_revision_check CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT workspace_memberships_workspace_user_key UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_memberships_revocation_state_check CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR (status <> 'revoked' AND revoked_at IS NULL)
  )
);

ALTER TABLE public.brands ADD COLUMN workspace_id UUID NULL
  REFERENCES public.workspaces(id) ON DELETE RESTRICT;
ALTER TABLE public.boards ADD COLUMN workspace_id UUID NULL
  REFERENCES public.workspaces(id) ON DELETE RESTRICT;

CREATE INDEX workspaces_status_updated_idx ON public.workspaces (status, updated_at DESC, id);
CREATE INDEX workspace_memberships_user_status_idx ON public.workspace_memberships (user_id, status, workspace_id);
CREATE INDEX workspace_memberships_workspace_status_role_idx ON public.workspace_memberships (workspace_id, status, role, user_id);
CREATE INDEX brands_workspace_id_idx ON public.brands (workspace_id);
CREATE INDEX boards_workspace_id_idx ON public.boards (workspace_id);

CREATE FUNCTION public.workspace_has_active_role(
  target_workspace_id UUID,
  allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'member', 'viewer']::TEXT[]
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND allowed_roles <@ ARRAY['owner', 'admin', 'member', 'viewer']::TEXT[]
    AND EXISTS (
      SELECT 1
      FROM public.workspace_memberships AS membership
      WHERE membership.workspace_id = target_workspace_id
        AND membership.user_id = auth.uid()
        AND membership.status = 'accepted'
        AND membership.role = ANY (allowed_roles)
    );
$function$;

CREATE FUNCTION public.protect_workspace_last_owner() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  protected_workspace_id UUID := OLD.workspace_id;
  removes_owner BOOLEAN := FALSE;
BEGIN
  IF OLD.role = 'owner' AND OLD.status = 'accepted' THEN
    IF TG_OP = 'DELETE' THEN
      removes_owner := TRUE;
    ELSE
      removes_owner := NEW.role <> 'owner' OR NEW.status <> 'accepted'
        OR NEW.workspace_id <> OLD.workspace_id;
    END IF;
  END IF;

  IF NOT removes_owner THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- One transaction at a time may remove an owner in a Workspace. The lock is
  -- held until transaction end, closing concurrent downgrade/delete races.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(protected_workspace_id::TEXT, 366));

  IF EXISTS (
    SELECT 1 FROM public.workspaces AS workspace
    WHERE workspace.id = protected_workspace_id AND workspace.status = 'active'
  ) AND (
    SELECT count(*) FROM public.workspace_memberships AS membership
    WHERE membership.workspace_id = protected_workspace_id
      AND membership.role = 'owner' AND membership.status = 'accepted'
  ) <= 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'workspace_last_owner_protected';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER workspace_memberships_last_owner_guard
BEFORE DELETE OR UPDATE OF workspace_id, role, status
ON public.workspace_memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_last_owner();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_member_read ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.workspace_has_active_role(id));

CREATE POLICY workspace_membership_bounded_read ON public.workspace_memberships
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'accepted')
    OR public.workspace_has_active_role(workspace_id, ARRAY['owner', 'admin']::TEXT[])
  );

-- Phase 1 intentionally exposes reads only. Workspace creation and every
-- membership mutation stay behind a future atomic server transaction.
REVOKE ALL ON TABLE public.workspaces, public.workspace_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.workspaces, public.workspace_memberships TO authenticated;
REVOKE ALL ON FUNCTION public.workspace_has_active_role(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_has_active_role(UUID, TEXT[]) TO authenticated;
REVOKE ALL ON FUNCTION public.protect_workspace_last_owner() FROM PUBLIC, anon, authenticated;

COMMIT;
