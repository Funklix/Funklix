-- Emergency compatibility rollback. It deliberately does NOT restore Data API grants.
-- The pre-BW-33.5 grants must be restored only from the prerequisite grant snapshot.
BEGIN;
DO $bw33_5$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'brands','social_publish_jobs','social_provider_attempts','brand_documents',
    'brand_document_upload_intents','brand_document_processing_jobs',
    'brand_document_processing_results','social_external_posts','brand_members',
    'social_token_secrets','social_connected_accounts','social_oauth_attempts','boards'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS bw33_5_deny_supabase_api_roles ON public.%I', table_name);
  END LOOP;
END
$bw33_5$;
-- boards was already RLS-enabled and remains so. The other 12 return to the
-- reported RLS state while revoked API grants retain the safer deny boundary.
ALTER TABLE public.brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publish_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_provider_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_upload_intents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_processing_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_document_processing_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_external_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_token_secrets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connected_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_oauth_attempts DISABLE ROW LEVEL SECURITY;
COMMIT;
