-- BW-33.5.1: extend the server-only Data API deny boundary to publishing destinations.
-- UNAPPLIED: follow docs/runbooks/bw33-5-1-social-publishing-destinations-rls.md.
BEGIN;

-- Validate every prerequisite before the first catalog mutation.
DO $bw33_5_1$
DECLARE unexpected text;
BEGIN
  IF to_regclass('public.social_publishing_destinations') IS NULL THEN
    RAISE EXCEPTION 'BW-33.5.1 stopped: public.social_publishing_destinations is missing';
  END IF;

  SELECT string_agg(format('%I.%I:%I', schemaname, tablename, policyname), ', ' ORDER BY policyname)
    INTO unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'social_publishing_destinations'
    AND policyname <> 'bw33_5_deny_supabase_api_roles';

  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'BW-33.5.1 stopped: review unexpected policies: %', unexpected;
  END IF;
END
$bw33_5_1$;

ALTER TABLE public.social_publishing_destinations ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.social_publishing_destinations
FROM anon, authenticated;

DO $bw33_5_1$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'social_publishing_destinations'
      AND policyname = 'bw33_5_deny_supabase_api_roles'
  ) THEN
    CREATE POLICY bw33_5_deny_supabase_api_roles
      ON public.social_publishing_destinations
      AS RESTRICTIVE
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END
$bw33_5_1$;

COMMIT;
