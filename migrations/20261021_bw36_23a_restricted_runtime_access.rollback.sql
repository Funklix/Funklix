-- REVIEWED WRITE FREEZE ONLY. Requires separate production incident authorization.
-- First drain every app/job and terminate remaining runtime transactions outside
-- this transaction (runbook). Preserve history, baselines, triggers and policies.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_catalog.pg_advisory_xact_lock(3623001);
ALTER ROLE tendra_app_runtime NOLOGIN;
REVOKE EXECUTE ON FUNCTION
 brand_knowledge_private.write_brand(text,uuid,jsonb,jsonb,boolean),
 brand_knowledge_private.create_brand(text,uuid,uuid,text,jsonb,uuid),
 brand_knowledge_private.lifecycle(text,uuid,jsonb,jsonb)
FROM brand_knowledge_runtime,tendra_app_runtime;
DO $freeze$
DECLARE t text; c record;
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'boards','board_editors','app_identities','workspaces','workspace_memberships',
 'brand_members','project_commands','brand_learnings','brand_learning_events',
 'brand_documents','brand_document_upload_intents','brand_document_processing_jobs',
 'brand_document_processing_results','social_token_secrets','social_connected_accounts',
 'social_publishing_destinations','social_oauth_attempts','social_publish_jobs',
 'social_provider_attempts','social_external_posts'] LOOP
  EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON public.%I FROM brand_knowledge_runtime,tendra_app_runtime',t);
  FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=('public.'||t)::regclass AND attnum>0 AND NOT attisdropped LOOP
   EXECUTE format('REVOKE INSERT(%I),UPDATE(%I) ON public.%I FROM brand_knowledge_runtime,tendra_app_runtime',c.attname,c.attname,t);
  END LOOP;
 END LOOP;
END $freeze$;
COMMIT;
-- Expected: ALTER ROLE, REVOKE, DO, COMMIT. No data/history deletion.
-- Fail-closed runtime verification now intentionally fails. Re-enabling writes
-- requires incident review and explicit regrant of the three protected commands,
-- then this R3 migration + both verifiers, connectivity/staging, and LOGIN last.
