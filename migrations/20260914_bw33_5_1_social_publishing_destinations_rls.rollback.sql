-- EMERGENCY USE ONLY: run only if BW-33.5.1 errors or its immediate Social
-- Connections/publishing-destination smoke test fails. Browser grants stay revoked.
BEGIN;

DROP POLICY IF EXISTS bw33_5_deny_supabase_api_roles
  ON public.social_publishing_destinations;

-- Production reported RLS disabled before BW-33.5.1.
ALTER TABLE public.social_publishing_destinations DISABLE ROW LEVEL SECURITY;

COMMIT;
