-- BW-36.23A R3: REVIEW ONLY. No automatic installation or production approval.
-- Install AFTER 20261020_bw36_23_brand_knowledge_protection.sql and its verification.
-- Existing schema/memberships are prerequisites; no roles, passwords or default grants.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_catalog.pg_advisory_xact_lock(3623001);
DO $preflight$
DECLARE r record;
BEGIN
  IF current_setting('server_version_num')::int<160000 THEN RAISE EXCEPTION 'POSTGRES_16_REQUIRED'; END IF;
  IF to_regclass('public.brand_knowledge_history') IS NULL THEN RAISE EXCEPTION 'PROTECTION_INSTALL_REQUIRED_OR_DRIFTED'; END IF;
  SET LOCAL ROLE brand_knowledge_owner;
  IF brand_knowledge_private.install_fingerprint() IS DISTINCT FROM obj_description('brand_knowledge_private'::regnamespace) THEN
    RAISE EXCEPTION 'PROTECTION_INSTALL_REQUIRED_OR_DRIFTED'; END IF;
  RESET ROLE;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('brand_knowledge_owner','brand_knowledge_runtime','tendra_app_runtime'))<>3 THEN
    RAISE EXCEPTION 'EXISTING_ROLES_REQUIRED'; END IF;
  FOR r IN SELECT * FROM pg_roles WHERE rolname IN ('brand_knowledge_owner','brand_knowledge_runtime','tendra_app_runtime') LOOP
    IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication
       OR (r.rolname<>'tendra_app_runtime' AND r.rolcanlogin)
       OR (r.rolname<>'brand_knowledge_owner' AND pg_has_role(r.oid,'brand_knowledge_owner','MEMBER'))
       OR (r.rolname='tendra_app_runtime' AND NOT r.rolinherit) THEN RAISE EXCEPTION 'UNSAFE_EXISTING_ROLE: %',r.rolname; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_auth_members WHERE roleid='brand_knowledge_runtime'::regrole
     AND member='tendra_app_runtime'::regrole AND inherit_option AND NOT set_option AND NOT admin_option) THEN
    RAISE EXCEPTION 'EXACT_RUNTIME_MEMBERSHIP_REQUIRED'; END IF;
  -- No transitive membership, SET ROLE or ADMIN route to another role; no other
  -- identity may inherit the server capability group, including Supabase API roles.
  IF EXISTS(SELECT FROM pg_auth_members WHERE
    (member IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole)
      OR roleid IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole))
    AND NOT(roleid='brand_knowledge_runtime'::regrole AND member='tendra_app_runtime'::regrole
      AND inherit_option AND NOT set_option AND NOT admin_option)) THEN RAISE EXCEPTION 'UNREVIEWED_ROLE_MEMBERSHIP'; END IF;
  IF to_regclass('public.social_connector_schema_version') IS NULL THEN RAISE EXCEPTION 'SOCIAL_V4_REQUIRED'; END IF;
  IF NOT EXISTS(SELECT FROM public.social_connector_schema_version WHERE singleton AND version=4) THEN RAISE EXCEPTION 'SOCIAL_V4_REQUIRED'; END IF;
  IF EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND
    relowner IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole)) THEN RAISE EXCEPTION 'RUNTIME_TABLE_OWNERSHIP'; END IF;
END $preflight$;
-- Materialize document schema formerly created lazily. Existing rows are untouched.

    CREATE TABLE IF NOT EXISTS brand_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      original_filename TEXT NOT NULL, display_filename TEXT NOT NULL, media_type TEXT NOT NULL, extension TEXT NOT NULL,
      file_size INTEGER NOT NULL, content_hash TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE,
      upload_status TEXT NOT NULL DEFAULT 'uploaded', malware_scan_status TEXT NOT NULL DEFAULT 'not_configured',
      page_count INTEGER, page_count_status TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), replaced_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE, revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_documents_active_tile_uidx ON brand_documents(board_id,tile_id) WHERE active AND deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS brand_document_upload_intents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id TEXT NOT NULL UNIQUE, board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL, source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      original_filename TEXT NOT NULL, display_filename TEXT NOT NULL, declared_media_type TEXT NOT NULL, extension TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE, expected_document_id UUID, created_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_document_pending_tile_uidx ON brand_document_upload_intents(board_id,tile_id) WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS brand_document_processing_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      document_id UUID NOT NULL REFERENCES brand_documents(id) ON DELETE CASCADE,
      document_revision INTEGER NOT NULL CHECK (document_revision > 0),
      content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
      state TEXT NOT NULL CHECK (state IN ('queued','scanning','blocked','processing','completed','failed','cancelled','superseded')),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
      max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 3),
      safe_error_code TEXT,
      parser_version TEXT NOT NULL DEFAULT 'none-phase-b1',
      chunker_version TEXT NOT NULL DEFAULT 'none-phase-b1',
      scan_status TEXT NOT NULL DEFAULT 'not_configured' CHECK (scan_status IN ('not_configured','pending','clean','infected','error')),
      scan_reference TEXT,
      scan_version TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      lease_token TEXT,
      lease_owner TEXT,
      lease_expires_at TIMESTAMPTZ,
      requested_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      superseded_at TIMESTAMPTZ,
      UNIQUE(board_id,tile_id,source_type,document_id,document_revision,content_hash)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS brand_document_processing_active_revision_uidx
      ON brand_document_processing_jobs(board_id,tile_id,source_type,document_id,document_revision,content_hash)
      WHERE state IN ('queued','scanning','processing');
    CREATE INDEX IF NOT EXISTS brand_document_processing_claim_idx
      ON brand_document_processing_jobs(state,created_at) WHERE state = 'queued';
    CREATE TABLE IF NOT EXISTS brand_document_processing_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL UNIQUE REFERENCES brand_document_processing_jobs(id) ON DELETE CASCADE,
      board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      tile_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('pitch_deck','whitepaper')),
      document_id UUID NOT NULL REFERENCES brand_documents(id) ON DELETE CASCADE,
      document_revision INTEGER NOT NULL CHECK (document_revision > 0),
      content_hash TEXT NOT NULL CHECK (char_length(content_hash) = 64),
      parser_version TEXT NOT NULL,
      chunker_version TEXT NOT NULL,
      scan_reference TEXT,
      scan_version TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      superseded_at TIMESTAMPTZ,
      UNIQUE(board_id,tile_id,source_type,document_id,document_revision,content_hash)
    );

DO $schema$
DECLARE expected record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('brand_documents','id'),
    ('brand_documents','board_id'),
    ('brand_documents','tile_id'),
    ('brand_documents','source_type'),
    ('brand_documents','original_filename'),
    ('brand_documents','display_filename'),
    ('brand_documents','media_type'),
    ('brand_documents','extension'),
    ('brand_documents','file_size'),
    ('brand_documents','content_hash'),
    ('brand_documents','storage_key'),
    ('brand_documents','upload_status'),
    ('brand_documents','malware_scan_status'),
    ('brand_documents','page_count'),
    ('brand_documents','page_count_status'),
    ('brand_documents','schema_version'),
    ('brand_documents','created_by'),
    ('brand_documents','uploaded_at'),
    ('brand_documents','replaced_at'),
    ('brand_documents','deleted_at'),
    ('brand_documents','active'),
    ('brand_documents','revision'),
    ('brand_document_upload_intents','id'),
    ('brand_document_upload_intents','request_id'),
    ('brand_document_upload_intents','board_id'),
    ('brand_document_upload_intents','tile_id'),
    ('brand_document_upload_intents','source_type'),
    ('brand_document_upload_intents','original_filename'),
    ('brand_document_upload_intents','display_filename'),
    ('brand_document_upload_intents','declared_media_type'),
    ('brand_document_upload_intents','extension'),
    ('brand_document_upload_intents','storage_key'),
    ('brand_document_upload_intents','expected_document_id'),
    ('brand_document_upload_intents','created_by'),
    ('brand_document_upload_intents','status'),
    ('brand_document_upload_intents','created_at'),
    ('brand_document_upload_intents','expires_at'),
    ('brand_document_processing_jobs','id'),
    ('brand_document_processing_jobs','board_id'),
    ('brand_document_processing_jobs','tile_id'),
    ('brand_document_processing_jobs','source_type'),
    ('brand_document_processing_jobs','document_id'),
    ('brand_document_processing_jobs','document_revision'),
    ('brand_document_processing_jobs','content_hash'),
    ('brand_document_processing_jobs','state'),
    ('brand_document_processing_jobs','attempt_count'),
    ('brand_document_processing_jobs','max_attempts'),
    ('brand_document_processing_jobs','safe_error_code'),
    ('brand_document_processing_jobs','parser_version'),
    ('brand_document_processing_jobs','chunker_version'),
    ('brand_document_processing_jobs','scan_status'),
    ('brand_document_processing_jobs','scan_reference'),
    ('brand_document_processing_jobs','scan_version'),
    ('brand_document_processing_jobs','schema_version'),
    ('brand_document_processing_jobs','lease_token'),
    ('brand_document_processing_jobs','lease_owner'),
    ('brand_document_processing_jobs','lease_expires_at'),
    ('brand_document_processing_jobs','requested_by'),
    ('brand_document_processing_jobs','created_at'),
    ('brand_document_processing_jobs','updated_at'),
    ('brand_document_processing_jobs','started_at'),
    ('brand_document_processing_jobs','completed_at'),
    ('brand_document_processing_jobs','cancelled_at'),
    ('brand_document_processing_jobs','superseded_at'),
    ('brand_document_processing_results','id'),
    ('brand_document_processing_results','job_id'),
    ('brand_document_processing_results','board_id'),
    ('brand_document_processing_results','tile_id'),
    ('brand_document_processing_results','source_type'),
    ('brand_document_processing_results','document_id'),
    ('brand_document_processing_results','document_revision'),
    ('brand_document_processing_results','content_hash'),
    ('brand_document_processing_results','parser_version'),
    ('brand_document_processing_results','chunker_version'),
    ('brand_document_processing_results','scan_reference'),
    ('brand_document_processing_results','scan_version'),
    ('brand_document_processing_results','schema_version'),
    ('brand_document_processing_results','created_at'),
    ('brand_document_processing_results','superseded_at'),
    ('boards','id'),
    ('boards','name'),
    ('boards','canvas_json'),
    ('boards','brand_core_snapshot'),
    ('boards','order_index'),
    ('boards','created_at'),
    ('boards','updated_at'),
    ('boards','public_view_enabled'),
    ('boards','public_view_token_hash'),
    ('boards','public_view_token_created_at'),
    ('boards','owner_id'),
    ('boards','owner_email'),
    ('boards','owner_name'),
    ('boards','owner_avatar'),
    ('boards','created_by'),
    ('boards','brand_id'),
    ('boards','brand_core_source_revision'),
    ('boards','brand_core_source_updated_at'),
    ('boards','brand_core_snapshot_copied_at'),
    ('boards','brand_core_snapshot_backup'),
    ('boards','brand_core_backup_source_revision'),
    ('boards','brand_core_backup_source_updated_at'),
    ('boards','brand_core_backup_snapshot_copied_at'),
    ('boards','brand_core_snapshot_backup_created_at'),
    ('boards','workspace_id'),
    ('board_editors','board_id'),
    ('board_editors','email'),
    ('board_editors','role'),
    ('board_editors','created_at'),
    ('board_editors','created_by'),
    ('board_editors','name'),
    ('board_editors','avatar'),
    ('social_token_secrets','id'),
    ('social_token_secrets','owner_account_id'),
    ('social_token_secrets','platform'),
    ('social_token_secrets','encrypted_payload'),
    ('social_token_secrets','nonce'),
    ('social_token_secrets','authentication_tag'),
    ('social_token_secrets','encryption_key_version'),
    ('social_token_secrets','created_at'),
    ('social_token_secrets','updated_at'),
    ('social_token_secrets','rotated_at'),
    ('social_token_secrets','revoked_at'),
    ('social_connected_accounts','id'),
    ('social_connected_accounts','owner_account_id'),
    ('social_connected_accounts','platform'),
    ('social_connected_accounts','external_account_id'),
    ('social_connected_accounts','external_display_name'),
    ('social_connected_accounts','account_type'),
    ('social_connected_accounts','status'),
    ('social_connected_accounts','granted_scopes'),
    ('social_connected_accounts','token_secret_id'),
    ('social_connected_accounts','token_expires_at'),
    ('social_connected_accounts','last_validated_at'),
    ('social_connected_accounts','created_at'),
    ('social_connected_accounts','updated_at'),
    ('social_connected_accounts','disconnected_at'),
    ('social_connected_accounts','schema_version'),
    ('social_connected_accounts','last_oauth_attempt_id'),
    ('social_publishing_destinations','id'),
    ('social_publishing_destinations','connected_account_id'),
    ('social_publishing_destinations','owner_account_id'),
    ('social_publishing_destinations','external_destination_id'),
    ('social_publishing_destinations','destination_type'),
    ('social_publishing_destinations','display_name'),
    ('social_publishing_destinations','capabilities'),
    ('social_publishing_destinations','authorization_state'),
    ('social_publishing_destinations','status'),
    ('social_publishing_destinations','active'),
    ('social_publishing_destinations','last_capability_refresh_at'),
    ('social_publishing_destinations','created_at'),
    ('social_publishing_destinations','updated_at'),
    ('social_oauth_attempts','id'),
    ('social_oauth_attempts','owner_account_id'),
    ('social_oauth_attempts','platform'),
    ('social_oauth_attempts','return_path'),
    ('social_oauth_attempts','state_hash'),
    ('social_oauth_attempts','pkce_verifier_reference'),
    ('social_oauth_attempts','session_binding_fingerprint'),
    ('social_oauth_attempts','failure_classification'),
    ('social_oauth_attempts','last_confirmed_phase'),
    ('social_oauth_attempts','client_request_id'),
    ('social_oauth_attempts','server_request_id'),
    ('social_oauth_attempts','created_at'),
    ('social_oauth_attempts','expires_at'),
    ('social_oauth_attempts','consumed_at'),
    ('social_publish_jobs','id'),
    ('social_publish_jobs','owner_account_id'),
    ('social_publish_jobs','board_id'),
    ('social_publish_jobs','node_id'),
    ('social_publish_jobs','approved_fingerprint'),
    ('social_publish_jobs','content_snapshot'),
    ('social_publish_jobs','destination_id'),
    ('social_publish_jobs','delivery_mode'),
    ('social_publish_jobs','requested_delivery_at'),
    ('social_publish_jobs','original_local_time'),
    ('social_publish_jobs','original_timezone'),
    ('social_publish_jobs','status'),
    ('social_publish_jobs','idempotency_key'),
    ('social_publish_jobs','attempt_count'),
    ('social_publish_jobs','last_safe_error_classification'),
    ('social_publish_jobs','created_by_actor'),
    ('social_publish_jobs','created_at'),
    ('social_publish_jobs','updated_at'),
    ('social_publish_jobs','cancelled_at'),
    ('social_publish_jobs','completed_at'),
    ('social_publish_jobs','schema_version'),
    ('social_provider_attempts','id'),
    ('social_provider_attempts','publish_job_id'),
    ('social_provider_attempts','owner_account_id'),
    ('social_provider_attempts','adapter_platform'),
    ('social_provider_attempts','attempt_number'),
    ('social_provider_attempts','phase'),
    ('social_provider_attempts','status'),
    ('social_provider_attempts','safe_error_classification'),
    ('social_provider_attempts','ambiguous_outcome'),
    ('social_provider_attempts','provider_request_reference'),
    ('social_provider_attempts','started_at'),
    ('social_provider_attempts','completed_at'),
    ('social_external_posts','id'),
    ('social_external_posts','platform'),
    ('social_external_posts','external_post_id'),
    ('social_external_posts','destination_id'),
    ('social_external_posts','publish_job_id'),
    ('social_external_posts','owner_account_id'),
    ('social_external_posts','source_board_id'),
    ('social_external_posts','source_node_id'),
    ('social_external_posts','approved_fingerprint'),
    ('social_external_posts','published_snapshot_reference'),
    ('social_external_posts','external_url'),
    ('social_external_posts','published_at'),
    ('social_external_posts','delivery_state'),
    ('social_external_posts','deletion_state'),
    ('social_external_posts','last_synchronized_at'),
    ('social_external_posts','schema_version'),
    ('social_connector_schema_version','singleton'),
    ('social_connector_schema_version','version'),
    ('social_connector_schema_version','updated_at')
  ) AS required(table_name,column_name) LOOP
    IF NOT EXISTS(SELECT FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.relnamespace='public'::regnamespace AND c.relname=expected.table_name AND c.relkind='r'
      AND a.attname=expected.column_name AND a.attnum>0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'REQUIRED_COLUMN_MISSING: %.%',expected.table_name,expected.column_name; END IF;
  END LOOP;
END $schema$;

-- Lock-only entry point. No row contents, mutation, dynamic SQL or actor claims.
-- The caller must still authorize the user and read after this separate statement.
-- Does not alter the fingerprinted private protection schema/functions.
-- Separate owner schema leaves the original protection fingerprint unchanged and
-- avoids a temporary CREATE grant on public when Supabase transfers ownership.
DO $lock_schema$ BEGIN
 IF to_regnamespace('tendra_runtime_private') IS NOT NULL AND NOT EXISTS(
  SELECT FROM pg_namespace WHERE nspname='tendra_runtime_private' AND nspowner='brand_knowledge_owner'::regrole) THEN
  RAISE EXCEPTION 'LOCK_SCHEMA_OWNER_DRIFT'; END IF;
END $lock_schema$;
CREATE SCHEMA IF NOT EXISTS tendra_runtime_private AUTHORIZATION brand_knowledge_owner;
SET LOCAL ROLE brand_knowledge_owner;
DO $lock_preflight$ BEGIN
 IF to_regprocedure('tendra_runtime_private.lock_brand(uuid,boolean)') IS NOT NULL AND NOT EXISTS(
  SELECT FROM pg_proc WHERE oid=to_regprocedure('tendra_runtime_private.lock_brand(uuid,boolean)')
    AND prosecdef AND proowner='brand_knowledge_owner'::regrole AND proconfig=ARRAY['search_path=pg_catalog']
    AND btrim(regexp_replace(prosrc,'\s+',' ','g'))=$lockbody$BEGIN IF session_user<>'tendra_app_runtime' THEN RAISE EXCEPTION 'BACKEND_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF; IF p_write THEN PERFORM 1 FROM public.brands WHERE id=p_id FOR UPDATE; ELSE PERFORM 1 FROM public.brands WHERE id=p_id FOR SHARE; END IF; END$lockbody$) THEN RAISE EXCEPTION 'LOCK_FUNCTION_DRIFT'; END IF;
END $lock_preflight$;
REVOKE ALL ON SCHEMA tendra_runtime_private FROM PUBLIC;
GRANT USAGE ON SCHEMA tendra_runtime_private TO brand_knowledge_runtime;
CREATE OR REPLACE FUNCTION tendra_runtime_private.lock_brand(p_id uuid,p_write boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF session_user<>'tendra_app_runtime' THEN RAISE EXCEPTION 'BACKEND_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_write THEN PERFORM 1 FROM public.brands WHERE id=p_id FOR UPDATE;
  ELSE PERFORM 1 FROM public.brands WHERE id=p_id FOR SHARE; END IF;
END $$;
ALTER FUNCTION tendra_runtime_private.lock_brand(uuid,boolean) OWNER TO brand_knowledge_owner;
REVOKE ALL ON FUNCTION tendra_runtime_private.lock_brand(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tendra_runtime_private.lock_brand(uuid,boolean) TO brand_knowledge_runtime;
RESET ROLE;
GRANT USAGE ON SCHEMA public TO brand_knowledge_runtime;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO brand_knowledge_runtime;

ALTER TABLE public.board_editors ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_editors TO brand_knowledge_runtime;

ALTER TABLE public.app_identities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE (revision) ON public.app_identities TO brand_knowledge_runtime;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE (name, revision, updated_at) ON public.workspaces TO brand_knowledge_runtime;

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE (revision) ON public.workspace_memberships TO brand_knowledge_runtime;

ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_members TO brand_knowledge_runtime;

ALTER TABLE public.project_commands ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.project_commands TO brand_knowledge_runtime;

ALTER TABLE public.brand_learnings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brand_learnings TO brand_knowledge_runtime;

ALTER TABLE public.brand_learning_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.brand_learning_events TO brand_knowledge_runtime;

ALTER TABLE public.brand_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brand_documents TO brand_knowledge_runtime;

ALTER TABLE public.brand_document_upload_intents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brand_document_upload_intents TO brand_knowledge_runtime;

ALTER TABLE public.brand_document_processing_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.brand_document_processing_jobs TO brand_knowledge_runtime;

ALTER TABLE public.brand_document_processing_results ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (superseded_at) ON public.brand_document_processing_results TO brand_knowledge_runtime;

ALTER TABLE public.social_token_secrets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_token_secrets TO brand_knowledge_runtime;

ALTER TABLE public.social_connected_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_connected_accounts TO brand_knowledge_runtime;

ALTER TABLE public.social_publishing_destinations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_publishing_destinations TO brand_knowledge_runtime;

ALTER TABLE public.social_oauth_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_oauth_attempts TO brand_knowledge_runtime;

ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_publish_jobs TO brand_knowledge_runtime;

ALTER TABLE public.social_provider_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_provider_attempts TO brand_knowledge_runtime;

ALTER TABLE public.social_external_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.social_external_posts TO brand_knowledge_runtime;

ALTER TABLE public.social_connector_schema_version ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.social_connector_schema_version TO brand_knowledge_runtime;


DO $command_policies$
DECLARE r record; p text; q text; w text;
BEGIN
 FOR r IN SELECT * FROM (VALUES
 ('boards',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]),
 ('board_editors',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]),
 ('app_identities',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('workspaces',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('workspace_memberships',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('brand_members',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]),
 ('project_commands',ARRAY['SELECT','INSERT']::text[]),
 ('brand_learnings',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('brand_learning_events',ARRAY['SELECT','INSERT']::text[]),
 ('brand_documents',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('brand_document_upload_intents',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('brand_document_processing_jobs',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('brand_document_processing_results',ARRAY['SELECT','UPDATE']::text[]),
 ('social_token_secrets',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[]),
 ('social_connected_accounts',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('social_publishing_destinations',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('social_oauth_attempts',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('social_publish_jobs',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('social_provider_attempts',ARRAY['SELECT','INSERT','UPDATE']::text[]),
 ('social_external_posts',ARRAY['SELECT','INSERT']::text[]),
 ('social_connector_schema_version',ARRAY['SELECT']::text[])
 ) AS required(table_name,commands) LOOP
  FOREACH p IN ARRAY r.commands LOOP
   q:=CASE WHEN p IN ('SELECT','UPDATE','DELETE') THEN '(SESSION_USER = ''tendra_app_runtime''::name)' END;
   w:=CASE WHEN p IN ('INSERT','UPDATE') THEN '(SESSION_USER = ''tendra_app_runtime''::name)' END;
   IF EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname='bw36_23a_server_'||lower(p)) THEN
    IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname='bw36_23a_server_'||lower(p) AND cmd=p AND permissive='PERMISSIVE' AND roles=ARRAY['brand_knowledge_runtime']::name[] AND qual IS NOT DISTINCT FROM q AND with_check IS NOT DISTINCT FROM w) THEN RAISE EXCEPTION 'RUNTIME_POLICY_DRIFT'; END IF;
   ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO brand_knowledge_runtime%s%s','bw36_23a_server_'||lower(p),r.table_name,p,CASE WHEN q IS NULL THEN '' ELSE ' USING '||q END,CASE WHEN w IS NULL THEN '' ELSE ' WITH CHECK '||w END);
   END IF;
  END LOOP;
 END LOOP;
END $command_policies$;

DO $identity_fence$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['brands','boards','board_editors','app_identities','workspaces','workspace_memberships','brand_members','project_commands','brand_learnings','brand_learning_events','brand_documents','brand_document_upload_intents','brand_document_processing_jobs','brand_document_processing_results','social_token_secrets','social_connected_accounts','social_publishing_destinations','social_oauth_attempts','social_publish_jobs','social_provider_attempts','social_external_posts','social_connector_schema_version'] LOOP
  IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=('public.'||t)::regclass AND polname='bw36_23a_backend_identity') THEN
    EXECUTE format('CREATE POLICY bw36_23a_backend_identity ON public.%I AS RESTRICTIVE FOR ALL TO brand_knowledge_runtime USING (SESSION_USER = ''tendra_app_runtime''::name) WITH CHECK (SESSION_USER = ''tendra_app_runtime''::name)',t);
  ELSIF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='bw36_23a_backend_identity' AND permissive='RESTRICTIVE' AND cmd='ALL' AND roles=ARRAY['brand_knowledge_runtime']::name[] AND qual='(SESSION_USER = ''tendra_app_runtime''::name)' AND with_check='(SESSION_USER = ''tendra_app_runtime''::name)') THEN
    RAISE EXCEPTION 'BACKEND_IDENTITY_POLICY_DRIFT: %',t;
  END IF;
 END LOOP;
END $identity_fence$;

-- Do not change brands grants, history, private functions or their fingerprint.
-- Run the companion fail-closed verification before ending the operator window.
-- Read-only, fail-closed. Run as operator AND through the actual runtime connection.
DO $verify$
DECLARE r record; t text; p text; c record; expected boolean; actual boolean; verifier_role name := current_user;
BEGIN
  -- Operators may SET the owner without inheriting its schema lookup privileges.
  -- Runtime keeps its own identity and cannot take this branch.
  IF pg_has_role(current_user,'brand_knowledge_owner','SET') THEN SET LOCAL ROLE brand_knowledge_owner; END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('brand_knowledge_owner','brand_knowledge_runtime') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)<>2 THEN RAISE EXCEPTION 'UNSAFE_CAPABILITY_OR_OWNER_ROLE'; END IF;
  IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='tendra_app_runtime' AND rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication) THEN RAISE EXCEPTION 'UNSAFE_RUNTIME_LOGIN'; END IF;
  IF NOT EXISTS(SELECT FROM pg_auth_members WHERE roleid='brand_knowledge_runtime'::regrole AND member='tendra_app_runtime'::regrole AND inherit_option AND NOT set_option AND NOT admin_option) THEN RAISE EXCEPTION 'MEMBERSHIP_OPTIONS_INVALID'; END IF;
  IF EXISTS(SELECT FROM pg_auth_members WHERE
    (member IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole) OR roleid IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole))
    AND NOT(roleid='brand_knowledge_runtime'::regrole AND member='tendra_app_runtime'::regrole AND inherit_option AND NOT set_option AND NOT admin_option)) THEN RAISE EXCEPTION 'UNREVIEWED_ROLE_MEMBERSHIP'; END IF;
  FOREACH t IN ARRAY ARRAY['brand_knowledge_runtime','tendra_app_runtime'] LOOP
    IF pg_has_role(t,'brand_knowledge_owner','MEMBER') OR has_schema_privilege(t,'public','CREATE') OR has_schema_privilege(t,'brand_knowledge_private','CREATE') OR has_schema_privilege(t,'tendra_runtime_private','CREATE')
       OR has_table_privilege(t,'public.brands','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(t,'public.brands','INSERT,UPDATE,REFERENCES')
       OR has_table_privilege(t,'public.brand_knowledge_history','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(t,'public.brand_knowledge_history','SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'PROTECTED_ACCESS_LEAK: %',t; END IF;
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('boards',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[]),
    ('board_editors',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[]),
    ('app_identities',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY['revision']::text[]),
    ('workspaces',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY['name','revision','updated_at']::text[]),
    ('workspace_memberships',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY['revision']::text[]),
    ('brand_members',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[]),
    ('project_commands',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[]),
    ('brand_learnings',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('brand_learning_events',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[]),
    ('brand_documents',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('brand_document_upload_intents',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('brand_document_processing_jobs',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('brand_document_processing_results',ARRAY['SELECT','UPDATE']::text[],ARRAY['superseded_at']::text[]),
    ('social_token_secrets',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[]),
    ('social_connected_accounts',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('social_publishing_destinations',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('social_oauth_attempts',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('social_publish_jobs',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('social_provider_attempts',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[]),
    ('social_external_posts',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[]),
    ('social_connector_schema_version',ARRAY['SELECT']::text[],ARRAY[]::text[])
  ) AS required(table_name,commands,update_columns) LOOP
    IF NOT EXISTS(SELECT FROM pg_class WHERE oid=('public.'||r.table_name)::regclass AND relrowsecurity AND relowner NOT IN ('tendra_app_runtime'::regrole,'brand_knowledge_runtime'::regrole)) THEN RAISE EXCEPTION 'RLS_OR_OWNERSHIP_INVALID: %',r.table_name; END IF;
    IF EXISTS(SELECT FROM pg_attrdef WHERE adrelid=('public.'||r.table_name)::regclass AND pg_get_expr(adbin,adrelid) ~ '\mnextval\(') THEN RAISE EXCEPTION 'UNREVIEWED_SEQUENCE_DEFAULT: %',r.table_name; END IF;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected:=p=ANY(r.commands) AND (p<>'UPDATE' OR cardinality(r.update_columns)=0);
      actual:=has_table_privilege('tendra_app_runtime',('public.'||r.table_name)::regclass,p);
      IF actual<>expected THEN RAISE EXCEPTION 'UNEXPECTED_TABLE_PRIVILEGE: % % expected %',r.table_name,p,expected; END IF;
    END LOOP;
    FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=('public.'||r.table_name)::regclass AND attnum>0 AND NOT attisdropped LOOP
      FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
        expected:=p=ANY(r.commands) AND (p<>'UPDATE' OR cardinality(r.update_columns)=0 OR c.attname=ANY(r.update_columns));
        IF has_column_privilege('tendra_app_runtime',('public.'||r.table_name)::regclass,c.attname,p)<>expected THEN RAISE EXCEPTION 'UNEXPECTED_COLUMN_PRIVILEGE: %.% %',r.table_name,c.attname,p; END IF;
      END LOOP;
    END LOOP;
    IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname='bw36_23a_backend_identity' AND permissive='RESTRICTIVE' AND roles=ARRAY['brand_knowledge_runtime']::name[] AND cmd='ALL' AND qual='(SESSION_USER = ''tendra_app_runtime''::name)' AND with_check='(SESSION_USER = ''tendra_app_runtime''::name)') THEN RAISE EXCEPTION 'IDENTITY_FENCE_INVALID: %',r.table_name; END IF;
    FOREACH p IN ARRAY r.commands LOOP
      IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='public' AND tablename=r.table_name AND policyname='bw36_23a_server_'||lower(p) AND cmd=p AND roles=ARRAY['brand_knowledge_runtime']::name[] AND permissive='PERMISSIVE'
        AND qual IS NOT DISTINCT FROM CASE WHEN p IN ('SELECT','UPDATE','DELETE') THEN '(SESSION_USER = ''tendra_app_runtime''::name)' ELSE NULL END
        AND with_check IS NOT DISTINCT FROM CASE WHEN p IN ('INSERT','UPDATE') THEN '(SESSION_USER = ''tendra_app_runtime''::name)' ELSE NULL END) THEN RAISE EXCEPTION 'COMMAND_POLICY_INVALID: % %',r.table_name,p; END IF;
    END LOOP;
    -- Existing browser restrictions are preserved, including workspace catalogs.
    FOREACH t IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(t,('public.'||r.table_name)::regclass,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(t,('public.'||r.table_name)::regclass,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'BROWSER_PRIVILEGE_LEAK: % %',t,r.table_name; END IF;
    END LOOP;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF pg_has_role(t,'brand_knowledge_runtime','MEMBER') OR has_function_privilege(t,'tendra_runtime_private.lock_brand(uuid,boolean)','EXECUTE') THEN RAISE EXCEPTION 'BACKEND_CAPABILITY_LEAK: %',t; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_proc WHERE oid='tendra_runtime_private.lock_brand(uuid,boolean)'::regprocedure AND prosecdef AND proowner='brand_knowledge_owner'::regrole AND proconfig=ARRAY['search_path=pg_catalog'] AND btrim(regexp_replace(prosrc,'\s+',' ','g'))=$lockbody$BEGIN IF session_user<>'tendra_app_runtime' THEN RAISE EXCEPTION 'BACKEND_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF; IF p_write THEN PERFORM 1 FROM public.brands WHERE id=p_id FOR UPDATE; ELSE PERFORM 1 FROM public.brands WHERE id=p_id FOR SHARE; END IF; END$lockbody$) THEN RAISE EXCEPTION 'LOCK_FUNCTION_INVALID'; END IF;
  IF EXISTS(SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid='tendra_runtime_private.lock_brand(uuid,boolean)'::regprocedure
      AND (a.grantee NOT IN ('brand_knowledge_owner'::regrole,'brand_knowledge_runtime'::regrole)
        OR (a.grantee='brand_knowledge_runtime'::regrole AND a.is_grantable))) THEN RAISE EXCEPTION 'LOCK_EXECUTE_GRANT_LEAK'; END IF;
  IF EXISTS(SELECT FROM pg_proc WHERE pronamespace='tendra_runtime_private'::regnamespace AND oid<>'tendra_runtime_private.lock_brand(uuid,boolean)'::regprocedure AND has_function_privilege('tendra_app_runtime',oid,'EXECUTE')) THEN RAISE EXCEPTION 'UNREVIEWED_LOCK_SCHEMA_FUNCTION'; END IF;
  IF NOT has_function_privilege('tendra_app_runtime','tendra_runtime_private.lock_brand(uuid,boolean)','EXECUTE') THEN RAISE EXCEPTION 'LOCK_FUNCTION_NOT_EXECUTABLE'; END IF;
  IF EXISTS(SELECT FROM pg_proc WHERE pronamespace='brand_knowledge_private'::regnamespace AND has_function_privilege('tendra_app_runtime',oid,'EXECUTE') AND proname NOT IN ('write_brand','create_brand','lifecycle','logo_receipt')) THEN RAISE EXCEPTION 'PRIVATE_HELPER_EXPOSED'; END IF;
  FOREACH t IN ARRAY ARRAY['pg_catalog.gen_random_uuid()','pg_catalog.pg_advisory_xact_lock(bigint)','pg_catalog.hashtextextended(text,bigint)','pg_catalog.sha256(bytea)'] LOOP
    IF NOT has_function_privilege('tendra_app_runtime',t,'EXECUTE') THEN RAISE EXCEPTION 'BUILTIN_EXECUTE_REQUIRED: %',t; END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['brand_knowledge_private.write_brand(text,uuid,jsonb,jsonb,boolean)','brand_knowledge_private.create_brand(text,uuid,uuid,text,jsonb,uuid)','brand_knowledge_private.lifecycle(text,uuid,jsonb,jsonb)','brand_knowledge_private.logo_receipt(text,uuid,uuid,text)'] LOOP
    IF NOT has_function_privilege('tendra_app_runtime',t,'EXECUTE') THEN RAISE EXCEPTION 'PROTECTED_COMMAND_NOT_EXECUTABLE: %',t; END IF;
  END LOOP;
  EXECUTE format('SET LOCAL ROLE %I',verifier_role);
END $verify$;
SELECT 'BW36_23A_R3_RUNTIME_ACCESS_VERIFIED' AS result,
       session_user AS connection_identity,current_user AS effective_identity,
       (SELECT rolcanlogin FROM pg_roles WHERE rolname='tendra_app_runtime') AS login_enabled;
-- Preparation may return login_enabled=false; activation requires true, both
-- identities=tendra_app_runtime on the runtime connection and no SQL errors.

COMMIT;
