-- BW-33.5: Data API deny boundary for Tendra One's server-only PostgreSQL tables.
-- UNAPPLIED: run only after the prerequisites in docs/runbooks/bw33-5-rls-hardening.md.
BEGIN;

-- Refuse to layer this migration over an unreviewed production policy. This is
-- intentionally before every change, so a failed prerequisite leaves no partial DDL.
DO $bw33_5$
DECLARE unexpected text;
BEGIN
  SELECT string_agg(format('%I.%I:%I', schemaname, tablename, policyname), ', ' ORDER BY tablename, policyname)
    INTO unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY[
      'brands','social_publish_jobs','social_provider_attempts','brand_documents',
      'brand_document_upload_intents','brand_document_processing_jobs',
      'brand_document_processing_results','social_external_posts','brand_members',
      'social_token_secrets','social_connected_accounts','social_oauth_attempts','boards'
    ])
    AND policyname <> 'bw33_5_deny_supabase_api_roles';
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'BW-33.5 stopped: review unexpected policies: %', unexpected;
  END IF;
END
$bw33_5$;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_provider_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_processing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_external_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_token_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_oauth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.brands, public.social_publish_jobs,
  public.social_provider_attempts, public.brand_documents,
  public.brand_document_upload_intents, public.brand_document_processing_jobs,
  public.brand_document_processing_results, public.social_external_posts,
  public.brand_members, public.social_token_secrets,
  public.social_connected_accounts, public.social_oauth_attempts, public.boards
FROM anon, authenticated;

DO $bw33_5$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'brands','social_publish_jobs','social_provider_attempts','brand_documents',
    'brand_document_upload_intents','brand_document_processing_jobs',
    'brand_document_processing_results','social_external_posts','brand_members',
    'social_token_secrets','social_connected_accounts','social_oauth_attempts','boards'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public'
        AND tablename = table_name AND policyname = 'bw33_5_deny_supabase_api_roles'
    ) THEN
      EXECUTE format(
        'CREATE POLICY bw33_5_deny_supabase_api_roles ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        table_name
      );
    END IF;
  END LOOP;
END
$bw33_5$;

COMMIT;

-- Verification (read-only): expect 13 rows, rls_enabled=true, rls_forced=false,
-- deny_policy=true, anon_privileges={} and authenticated_privileges={} on every row.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
         AND p.tablename=c.relname AND p.policyname='bw33_5_deny_supabase_api_roles'
         AND p.roles @> ARRAY['anon','authenticated']::name[]
         AND p.qual='false' AND p.with_check='false') AS deny_policy,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN grantee='anon' THEN privilege_type END),NULL) AS anon_privileges,
       ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN grantee='authenticated' THEN privilege_type END),NULL) AS authenticated_privileges
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN information_schema.role_table_grants g ON g.table_schema=n.nspname AND g.table_name=c.relname
WHERE n.nspname='public' AND c.relname = ANY (ARRAY[
  'brands','social_publish_jobs','social_provider_attempts','brand_documents',
  'brand_document_upload_intents','brand_document_processing_jobs',
  'brand_document_processing_results','social_external_posts','brand_members',
  'social_token_secrets','social_connected_accounts','social_oauth_attempts','boards'])
GROUP BY c.relname,c.relrowsecurity,c.relforcerowsecurity ORDER BY c.relname;
