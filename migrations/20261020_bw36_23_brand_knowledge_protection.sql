-- BW-36.23A. REVIEW ARTIFACT ONLY: never run automatically or against production.
-- Requires operator-created NOLOGIN brand_knowledge_owner and NOLOGIN
-- brand_knowledge_runtime roles and a separate restricted application LOGIN.
-- See preflight/runbook. No credential or runtime role membership is created here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT pg_catalog.pg_advisory_xact_lock(3623001);
DO $preflight$
DECLARE r record;
BEGIN
  IF current_setting('server_version_num')::int < 160000 THEN RAISE EXCEPTION 'POSTGRES_16_REQUIRED'; END IF;
  IF to_regclass('public.brands') IS NULL OR to_regclass('public.brand_members') IS NULL
    OR to_regclass('public.app_identities') IS NULL OR to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE EXCEPTION 'UNSUPPORTED_SCHEMA'; END IF;
  FOR r IN SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles
    WHERE rolname IN ('brand_knowledge_owner','brand_knowledge_runtime') LOOP
    IF r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication THEN
      RAISE EXCEPTION 'UNSAFE_PROTECTION_ROLE'; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='brand_knowledge_owner')
    OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname='brand_knowledge_runtime') THEN RAISE EXCEPTION 'ROLE_SEPARATION_REQUIRED'; END IF;
  IF EXISTS (SELECT FROM pg_roles runtime_role WHERE runtime_role.rolname IN ('brand_knowledge_runtime')
    AND pg_has_role(runtime_role.oid,'brand_knowledge_owner','MEMBER')) THEN RAISE EXCEPTION 'OWNER_MEMBERSHIP_FORBIDDEN'; END IF;
  IF EXISTS (SELECT FROM pg_class WHERE oid='public.brands'::regclass AND (relkind <> 'r' OR relispartition)) THEN
    RAISE EXCEPTION 'UNSUPPORTED_BRAND_TOPOLOGY'; END IF;
  IF EXISTS (SELECT FROM public.brands WHERE jsonb_typeof(brand_core) <> 'object' OR revision < 1
    OR revision >= 9007199254740991 OR logo_revision < 0) THEN RAISE EXCEPTION 'INVALID_BASELINE'; END IF;
  -- Exact reruns are allowed; conflicting partial installs abort rather than repair.
  IF to_regclass('public.brand_knowledge_history') IS NOT NULL AND
    obj_description(to_regclass('public.brand_knowledge_history')) IS DISTINCT FROM 'bw36-23a/v1; snapshots=1; same-brand-source=1' THEN
    RAISE EXCEPTION 'CONFLICTING_HISTORY_INSTALL'; END IF;
END $preflight$;
-- Validate legacy catalogs as their authorized installer before changing ownership.
-- Older completed installs created this function after the blanket owner EXECUTE
-- grant, so SET-only membership cannot execute it as brand_knowledge_owner yet.
DO $legacy_fingerprint$
DECLARE installer name := current_user; fingerprint oid; legacy_owner oid;
        borrowed_usage boolean; f record;
BEGIN
  IF to_regclass('public.brand_knowledge_history') IS NULL THEN RETURN; END IF;
  SET LOCAL ROLE brand_knowledge_owner;
  fingerprint := to_regprocedure('brand_knowledge_private.install_fingerprint()');
  IF fingerprint IS NULL THEN RAISE EXCEPTION 'PARTIAL_PROTECTION_INSTALL'; END IF;
  SELECT proowner INTO legacy_owner FROM pg_proc WHERE oid=fingerprint;
  IF legacy_owner='brand_knowledge_owner'::regrole THEN
    IF brand_knowledge_private.install_fingerprint() IS DISTINCT FROM obj_description('brand_knowledge_private'::regnamespace) THEN RAISE EXCEPTION 'PROTECTION_CATALOG_DRIFT'; END IF;
    RESET ROLE;
    RETURN;
  END IF;
  RESET ROLE;
  IF legacy_owner IN (SELECT oid FROM pg_roles WHERE rolname IN ('brand_knowledge_runtime','tendra_app_runtime','anon','authenticated','service_role')) THEN RAISE EXCEPTION 'UNSAFE_LEGACY_FUNCTION_OWNER'; END IF;
  -- EXECUTE alone never authorizes taking ownership of a previous installation.
  IF NOT pg_has_role(installer::regrole,legacy_owner,'USAGE') THEN RAISE EXCEPTION 'LEGACY_INSTALLER_OWNERSHIP_REQUIRED'; END IF;
  borrowed_usage := NOT has_schema_privilege(installer,'brand_knowledge_private','USAGE');
  SET LOCAL ROLE brand_knowledge_owner;
  IF borrowed_usage THEN EXECUTE format('GRANT USAGE ON SCHEMA brand_knowledge_private TO %I',installer); END IF;
  RESET ROLE;
  IF brand_knowledge_private.install_fingerprint() IS DISTINCT FROM obj_description('brand_knowledge_private'::regnamespace) THEN RAISE EXCEPTION 'PROTECTION_CATALOG_DRIFT'; END IF;
  -- Only the seven known installer-owned helpers may be normalized. The four
  -- SECURITY DEFINER entry points must already belong to the NOLOGIN owner.
  IF EXISTS(SELECT FROM pg_proc p WHERE p.pronamespace='brand_knowledge_private'::regnamespace
    AND p.proowner<>'brand_knowledge_owner'::regrole AND (p.proowner<>legacy_owner OR NOT p.oid=ANY(ARRAY[
      'brand_knowledge_private.immutable_history()'::regprocedure,
      'brand_knowledge_private.capture_brand()'::regprocedure,
      'brand_knowledge_private.no_brand_truncate()'::regprocedure,
      'brand_knowledge_private.is_empty(jsonb)'::regprocedure,
      'brand_knowledge_private.validate_json(jsonb,integer)'::regprocedure,
      'brand_knowledge_private.resolve_changes(jsonb,jsonb)'::regprocedure,
      'brand_knowledge_private.install_fingerprint()'::regprocedure]))) THEN
    RAISE EXCEPTION 'UNREVIEWED_LEGACY_FUNCTION_OWNER';
  END IF;
  FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='brand_knowledge_private'::regnamespace AND proowner=legacy_owner LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO brand_knowledge_owner',f.oid::regprocedure);
  END LOOP;
  SET LOCAL ROLE brand_knowledge_owner;
  IF borrowed_usage THEN EXECUTE format('REVOKE USAGE ON SCHEMA brand_knowledge_private FROM %I',installer); END IF;
  EXECUTE format('COMMENT ON SCHEMA brand_knowledge_private IS %L',brand_knowledge_private.install_fingerprint());
  RESET ROLE;
END $legacy_fingerprint$;
LOCK TABLE public.brands IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS brand_knowledge_private AUTHORIZATION brand_knowledge_owner;
SET LOCAL ROLE brand_knowledge_owner;
REVOKE ALL ON SCHEMA brand_knowledge_private FROM PUBLIC;
GRANT USAGE ON SCHEMA brand_knowledge_private TO brand_knowledge_runtime;
RESET ROLE;
-- Trigger DDL resolves private function names as the table-owning operator.
-- Borrow only schema USAGE (never CREATE), preserving an existing operator grant.
DO $operator_schema$
DECLARE operator_role name := current_user; borrowed boolean;
BEGIN
  borrowed := NOT has_schema_privilege(operator_role,'brand_knowledge_private','USAGE');
  PERFORM set_config('brand_knowledge.install_operator',operator_role,true);
  PERFORM set_config('brand_knowledge.install_borrowed_usage',borrowed::text,true);
  SET LOCAL ROLE brand_knowledge_owner;
  IF borrowed THEN EXECUTE format('GRANT USAGE ON SCHEMA brand_knowledge_private TO %I',operator_role); END IF;
  RESET ROLE;
END $operator_schema$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, brand_knowledge_runtime;
GRANT USAGE ON SCHEMA public TO brand_knowledge_owner;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS knowledge_event_seq bigint NOT NULL DEFAULT 0;
DO $column_check$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.brands'::regclass AND attname='knowledge_event_seq' AND atttypid='bigint'::regtype AND attnotnull) THEN RAISE EXCEPTION 'UNSUPPORTED_EVENT_SEQUENCE_COLUMN'; END IF;
END $column_check$;
CREATE TABLE IF NOT EXISTS public.brand_knowledge_history (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  workspace_id uuid,
  event_seq bigint NOT NULL CHECK(event_seq >= 0),
  previous_revision bigint,
  result_revision bigint,
  previous_logo_revision bigint,
  result_logo_revision bigint,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_identity_id uuid,
  operation_identity text,
  actor_key text GENERATED ALWAYS AS (CASE WHEN actor_identity_id IS NOT NULL THEN 'identity:'||actor_identity_id::text ELSE 'operation:'||operation_identity END) STORED,
  operation_type text NOT NULL CHECK(operation_type IN ('baseline','create','profile_edit','advanced_edit','accept_dna','accept_avatar','domain_accept','domain_fill','initialize','logo','delete','noop')),
  contract_version text NOT NULL CHECK(contract_version='canonical-brand-write/v1'),
  mutation_id uuid NOT NULL,
  request_digest text NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  before_state jsonb,
  after_state jsonb,
  source_event_id uuid NULL,
  intent jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(intent)='array' AND octet_length(intent::text)<=65536),
  provenance jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(provenance)='object' AND octet_length(provenance::text)<=4096),
  snapshot_format_version integer NOT NULL DEFAULT 1 CHECK(snapshot_format_version=1),
  CONSTRAINT brand_history_actor CHECK ((actor_identity_id IS NOT NULL)::int + (operation_identity IS NOT NULL)::int = 1),
  CONSTRAINT brand_history_registered_operation CHECK(operation_identity IS NULL OR operation_identity='bw36-23a-baseline'),
  CONSTRAINT brand_history_sequence UNIQUE(brand_id,event_seq),
  CONSTRAINT brand_history_brand_event UNIQUE(brand_id,event_id),
  CONSTRAINT brand_history_mutation UNIQUE(brand_id,actor_key,mutation_id),
  CONSTRAINT brand_history_source FOREIGN KEY(brand_id,source_event_id)
    REFERENCES public.brand_knowledge_history(brand_id,event_id) ON DELETE RESTRICT,
  CONSTRAINT brand_history_snapshots CHECK (
    (before_state IS NOT NULL OR after_state IS NOT NULL)
    AND (before_state IS NULL OR (jsonb_typeof(before_state)='object' AND jsonb_typeof(before_state->'brand_core')='object' AND before_state->>'id'=brand_id::text AND (before_state->>'revision')::bigint=previous_revision AND (before_state->>'logo_revision')::bigint=previous_logo_revision))
    AND (after_state IS NULL OR (jsonb_typeof(after_state)='object' AND jsonb_typeof(after_state->'brand_core')='object' AND after_state->>'id'=brand_id::text AND (after_state->>'revision')::bigint=result_revision AND (after_state->>'logo_revision')::bigint=result_logo_revision AND (after_state->>'knowledge_event_seq')::bigint=event_seq))
    AND (previous_revision IS NULL OR previous_revision>=1) AND (result_revision IS NULL OR result_revision>=1)
  ),
  CONSTRAINT brand_history_sides CHECK (
    CASE operation_type WHEN 'baseline' THEN event_seq=0 AND before_state=after_state AND operation_identity='bw36-23a-baseline'
    WHEN 'create' THEN before_state IS NULL AND after_state IS NOT NULL AND event_seq=1
    WHEN 'delete' THEN before_state IS NOT NULL AND after_state IS NULL
    ELSE before_state IS NOT NULL AND after_state IS NOT NULL END
  )
);
-- Fresh installs still own history as the operator; verified reruns use its owner.
DO $history_ddl_role$ BEGIN
  IF (SELECT relowner='brand_knowledge_owner'::regrole FROM pg_class WHERE oid='public.brand_knowledge_history'::regclass) THEN SET LOCAL ROLE brand_knowledge_owner; END IF;
END $history_ddl_role$;
COMMENT ON TABLE public.brand_knowledge_history IS 'bw36-23a/v1; snapshots=1; same-brand-source=1';
ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_knowledge_history FROM PUBLIC,brand_knowledge_runtime;
-- Baseline capture changes no existing Brand row or Core value.
INSERT INTO public.brand_knowledge_history(brand_id,workspace_id,event_seq,previous_revision,result_revision,previous_logo_revision,result_logo_revision,operation_identity,operation_type,contract_version,mutation_id,request_digest,before_state,after_state)
SELECT b.id,b.workspace_id,0,b.revision,b.revision,b.logo_revision,b.logo_revision,'bw36-23a-baseline','baseline','canonical-brand-write/v1',gen_random_uuid(),encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex'),to_jsonb(b),to_jsonb(b)
FROM public.brands b WHERE NOT EXISTS (SELECT FROM public.brand_knowledge_history h WHERE h.brand_id=b.id);

RESET ROLE;
-- Private schema/function ownership is used explicitly; SET does not imply INHERIT.
SET LOCAL ROLE brand_knowledge_owner;
CREATE OR REPLACE FUNCTION brand_knowledge_private.immutable_history() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'BRAND_HISTORY_APPEND_ONLY' USING ERRCODE='42501'; END $$;
CREATE OR REPLACE FUNCTION brand_knowledge_private.capture_brand() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE ctx jsonb; before_row jsonb; after_row jsonb; bid uuid; seq bigint;
BEGIN
  -- Not SECURITY DEFINER: caller-writable GUCs cannot authorize direct SQL.
  IF current_user <> 'brand_knowledge_owner' THEN RAISE EXCEPTION 'PROTECTED_BRAND_WRITE_REQUIRED' USING ERRCODE='42501'; END IF;
  ctx := current_setting('brand_knowledge.context',true)::jsonb;
  IF ctx IS NULL OR ctx->>'actor' IS NULL OR ctx->>'mutation_id' IS NULL OR ctx->>'operation' IS NULL THEN RAISE EXCEPTION 'MISSING_EVENT_CONTEXT'; END IF;
  IF TG_OP <> 'INSERT' THEN before_row:=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row:=to_jsonb(NEW); END IF;
  bid:=coalesce(NEW.id,OLD.id);
  IF ctx->>'brand_id' IS DISTINCT FROM bid::text THEN RAISE EXCEPTION 'EVENT_CONTEXT_MISMATCH'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.knowledge_event_seq<>1 THEN RAISE EXCEPTION 'INVALID_EVENT_SEQUENCE'; END IF;
    seq:=1;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.knowledge_event_seq<>OLD.knowledge_event_seq+1 OR NEW.id<>OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.owner_email<>OLD.owner_email
      OR NEW.revision NOT IN (OLD.revision,OLD.revision+1) THEN RAISE EXCEPTION 'INVALID_BRAND_TRANSITION'; END IF;
    seq:=NEW.knowledge_event_seq;
  ELSE seq:=OLD.knowledge_event_seq+1; END IF;
  INSERT INTO public.brand_knowledge_history(brand_id,workspace_id,event_seq,previous_revision,result_revision,previous_logo_revision,result_logo_revision,actor_identity_id,operation_type,contract_version,mutation_id,request_digest,before_state,after_state,intent,provenance)
  VALUES (bid,coalesce(NEW.workspace_id,OLD.workspace_id),seq,OLD.revision,NEW.revision,OLD.logo_revision,NEW.logo_revision,(ctx->>'actor')::uuid,ctx->>'operation','canonical-brand-write/v1',(ctx->>'mutation_id')::uuid,ctx->>'digest',before_row,after_row,coalesce(ctx->'intent','[]'),jsonb_build_object('source','verified-server-command','request_fingerprint',ctx->>'request_fingerprint'));
  RETURN coalesce(NEW,OLD);
END $$;
CREATE OR REPLACE FUNCTION brand_knowledge_private.no_brand_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'PROTECTED_BRAND_TRUNCATE_DENIED' USING ERRCODE='42501'; END $$;
RESET ROLE;
-- On verified reruns the fingerprint already proves these exact triggers exist.
-- Avoid recreating them as an operator that cannot EXECUTE private helpers.
DO $triggers$ BEGIN
  IF (SELECT relowner<>'brand_knowledge_owner'::regrole FROM pg_class WHERE oid='public.brand_knowledge_history'::regclass) THEN
    DROP TRIGGER IF EXISTS brand_knowledge_capture ON public.brands;
    CREATE TRIGGER brand_knowledge_capture AFTER INSERT OR UPDATE OR DELETE ON public.brands FOR EACH ROW EXECUTE FUNCTION brand_knowledge_private.capture_brand();
    DROP TRIGGER IF EXISTS brand_knowledge_no_truncate ON public.brands;
    CREATE TRIGGER brand_knowledge_no_truncate BEFORE TRUNCATE ON public.brands FOR EACH STATEMENT EXECUTE FUNCTION brand_knowledge_private.no_brand_truncate();
    DROP TRIGGER IF EXISTS brand_history_immutable ON public.brand_knowledge_history;
    CREATE TRIGGER brand_history_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.brand_knowledge_history FOR EACH STATEMENT EXECUTE FUNCTION brand_knowledge_private.immutable_history();
  END IF;
END $triggers$;

SET LOCAL ROLE brand_knowledge_owner;
CREATE OR REPLACE FUNCTION brand_knowledge_private.is_empty(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
SELECT v IS NULL OR v IN ('null','[]','{}') OR (jsonb_typeof(v)='string' AND btrim(v#>>'{}')='') $$;

CREATE OR REPLACE FUNCTION brand_knowledge_private.validate_json(v jsonb, depth integer DEFAULT 0) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE child jsonb; k text;
BEGIN
  IF depth>32 THEN RAISE EXCEPTION 'INVALID_JSON_DEPTH'; END IF;
  IF jsonb_typeof(v)='object' THEN
    FOR k,child IN SELECT key,value FROM jsonb_each(v) LOOP
      IF k IN ('__proto__','constructor','prototype') THEN RAISE EXCEPTION 'INVALID_JSON_KEY'; END IF;
      PERFORM brand_knowledge_private.validate_json(child,depth+1);
    END LOOP;
  ELSIF jsonb_typeof(v)='array' THEN
    FOR child IN SELECT value FROM jsonb_array_elements(v) LOOP PERFORM brand_knowledge_private.validate_json(child,depth+1); END LOOP;
  END IF;
  RETURN true;
END $$;

-- Pure PostgreSQL resolver repeats the contract rules; browser checks are advisory.
CREATE OR REPLACE FUNCTION brand_knowledge_private.resolve_changes(old_state jsonb, command jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE candidate jsonb:=old_state; c jsonb; p text[]; raw text; k text; parent jsonb; old_value jsonb; exists_old boolean; paths text[]:='{}'; path text; review boolean:=false; append_only boolean; op text:=command->>'operation';
BEGIN
  IF command->>'operation' IS NULL OR command->>'contract' IS DISTINCT FROM 'canonical-brand-write/v1' OR op NOT IN ('profile_edit','advanced_edit','accept_dna','accept_avatar','domain_accept','domain_fill','initialize')
    OR EXISTS(SELECT FROM jsonb_object_keys(command) keys(field) WHERE keys.field NOT IN ('contract','workspace_id','expected_revision','mutation_id','operation','changes','source'))
    OR jsonb_typeof(command->'changes') IS DISTINCT FROM 'array' OR jsonb_array_length(command->'changes')>256
    OR octet_length(command::text)>1048576 THEN RAISE EXCEPTION 'INVALID_WRITE_CONTRACT'; END IF;
  PERFORM brand_knowledge_private.validate_json(command);
  FOR c IN SELECT value FROM jsonb_array_elements(command->'changes') LOOP
    IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(c) keys(field) WHERE keys.field NOT IN ('path','action','expected','value')) OR c->>'action' IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD_ACTION'; END IF;
    path:=c->>'path';
    IF path IS NULL OR length(path)>2048 OR path !~ '^/' OR path ~ '~([^01]|$)' THEN RAISE EXCEPTION 'INVALID_PATH'; END IF;
    IF EXISTS(SELECT FROM unnest(paths) x WHERE x=path OR starts_with(x,path||'/') OR starts_with(path,x||'/')) THEN RAISE EXCEPTION 'OVERLAPPING_PATHS'; END IF;
    paths:=array_append(paths,path); p:='{}';
    FOREACH raw IN ARRAY string_to_array(substr(path,2),'/') LOOP
      k:=replace(replace(raw,'~1','/'),'~0','~');
      IF k='' OR k IN ('__proto__','constructor','prototype') THEN RAISE EXCEPTION 'INVALID_PATH'; END IF;
      p:=array_append(p,k);
    END LOOP;
    IF cardinality(p)>32 OR NOT (p=ARRAY['name'] OR (cardinality(p)>1 AND p[1]='brand_core' AND p[2]<>'_creation')) THEN RAISE EXCEPTION 'SERVER_OWNED_PATH'; END IF;
    parent:=candidate#>p[1:cardinality(p)-1];
    IF cardinality(p)=1 THEN parent:=candidate; END IF;
    IF jsonb_typeof(parent) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PATH_TYPE_MISMATCH'; END IF;
    exists_old:=parent ? p[cardinality(p)]; old_value:=candidate#>p;
    IF jsonb_typeof(c->'expected') IS DISTINCT FROM 'object' OR jsonb_typeof(c->'expected'->'exists') IS DISTINCT FROM 'boolean'
      OR (c->'expected' ? 'value') IS DISTINCT FROM (c->'expected'->>'exists')::boolean
      OR exists_old IS DISTINCT FROM (c->'expected'->>'exists')::boolean
      OR exists_old AND old_value IS DISTINCT FROM c->'expected'->'value' THEN RAISE EXCEPTION 'STALE_FIELD'; END IF;
    IF c->>'action' NOT IN ('add','replace','clear','remove','fill_empty') OR (c->>'action'='add' AND exists_old)
      OR (c->>'action' IN ('replace','clear','remove') AND NOT exists_old)
      OR (c->>'action'='fill_empty' AND (op<>'domain_fill' OR NOT brand_knowledge_private.is_empty(old_value)))
      OR ((c->>'action'<>'remove') <> (c ? 'value')) THEN RAISE EXCEPTION 'INVALID_FIELD_ACTION'; END IF;
    append_only:=false;
    IF jsonb_typeof(old_value)='array' AND jsonb_typeof(c->'value')='array' THEN
      append_only:=jsonb_array_length(c->'value')>=jsonb_array_length(old_value) AND NOT EXISTS(SELECT FROM jsonb_array_elements(old_value) WITH ORDINALITY item(value,n) WHERE (c->'value')->(item.n::integer-1) IS DISTINCT FROM item.value);
    END IF;
    IF c->>'action' IN ('clear','remove') OR (exists_old AND old_value IS DISTINCT FROM c->'value' AND NOT brand_knowledge_private.is_empty(old_value) AND NOT append_only AND (
      brand_knowledge_private.is_empty(c->'value') OR jsonb_typeof(old_value) IS DISTINCT FROM jsonb_typeof(c->'value')
      OR jsonb_typeof(old_value) IN ('object','array') OR path ~* '(approved|status|type|image|url|asset|logo)')) THEN review:=true; END IF;
    IF c->>'action'='clear' AND NOT brand_knowledge_private.is_empty(c->'value') THEN RAISE EXCEPTION 'INVALID_FIELD_ACTION'; END IF;
    IF op='domain_fill' AND c->>'action'<>'fill_empty' THEN RAISE EXCEPTION 'FILL_ONLY_REQUIRED'; END IF;
    IF c->>'action'='remove' THEN candidate:=candidate#-p; ELSE candidate:=jsonb_set(candidate,p,c->'value',true); END IF;
  END LOOP;
  IF jsonb_typeof(candidate->'brand_core') IS DISTINCT FROM 'object' OR octet_length((candidate->'brand_core')::text)>1048576
    OR jsonb_typeof(candidate->'name') IS DISTINCT FROM 'string' OR length(btrim(candidate->>'name')) NOT BETWEEN 1 AND 160
    OR candidate->>'name' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'INVALID_BRAND_VALUES'; END IF;
  -- Accepted child cannot be hidden by an unacknowledged parent downgrade.
  IF old_state#>'{brand_core,brandDNA,avatar,userApproved}'='true'::jsonb AND old_state#>'{brand_core,brandDNA,userApproved}'='true'::jsonb AND candidate#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM 'true'::jsonb
    AND NOT (paths && ARRAY['/brand_core/brandDNA/avatar/userApproved','/brand_core/brandDNA/avatar','/brand_core/brandDNA']) THEN RAISE EXCEPTION 'AVATAR_DEPENDENCY_REVIEW_REQUIRED'; END IF;
  IF candidate#>'{brand_core,brandDNA,userApproved}'='true'::jsonb AND old_state#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM 'true'::jsonb AND op NOT IN ('accept_dna','initialize') THEN RAISE EXCEPTION 'INVALID_DNA_ACCEPTANCE_INTENT'; END IF;
  IF candidate#>'{brand_core,brandDNA,avatar,userApproved}'='true'::jsonb AND (candidate#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM old_state#>'{brand_core,brandDNA,userApproved}' OR candidate#>'{brand_core,brandDNA,avatar}' IS DISTINCT FROM old_state#>'{brand_core,brandDNA,avatar}') AND (
    candidate#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(candidate#>'{brand_core,brandDNA,avatar,imageUrl}') IS DISTINCT FROM 'string'
    OR coalesce(candidate#>>'{brand_core,brandDNA,avatar,imageUrl}','')='') THEN RAISE EXCEPTION 'INVALID_AVATAR_DEPENDENCY'; END IF;
  IF candidate#>'{brand_core,brandDNA,avatar,userApproved}'='true'::jsonb AND old_state#>'{brand_core,brandDNA,avatar,userApproved}' IS DISTINCT FROM 'true'::jsonb AND op NOT IN ('accept_avatar','initialize') THEN RAISE EXCEPTION 'INVALID_AVATAR_ACCEPTANCE_INTENT'; END IF;
  IF op='accept_dna' AND candidate#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'INVALID_DNA_ACCEPTANCE'; END IF;
  IF op='accept_avatar' AND (candidate#>'{brand_core,brandDNA,userApproved}' IS DISTINCT FROM 'true'::jsonb
    OR candidate#>'{brand_core,brandDNA,avatar,userApproved}' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(candidate#>'{brand_core,brandDNA,avatar,imageUrl}') IS DISTINCT FROM 'string'
    OR length(candidate#>>'{brand_core,brandDNA,avatar,imageUrl}')=0) THEN RAISE EXCEPTION 'INVALID_AVATAR_ACCEPTANCE'; END IF;
  RETURN jsonb_build_object('candidate',candidate,'requires_review',review);
END $$;

CREATE OR REPLACE FUNCTION brand_knowledge_private.write_brand(p_email text,p_brand_id uuid,p_command jsonb,p_review jsonb DEFAULT NULL,p_preview boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; b public.brands%ROWTYPE; role_name text; receipt public.brand_knowledge_history%ROWTYPE; resolved jsonb; next_state jsonb; digest text; mid uuid; event public.brand_knowledge_history%ROWTYPE; ws uuid; source_board public.boards%ROWTYPE;
BEGIN
  IF p_email<>lower(btrim(p_email)) THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  SELECT id INTO STRICT actor FROM public.app_identities WHERE canonical_email=p_email AND status='active' FOR SHARE;
  IF p_command->>'contract' IS DISTINCT FROM 'canonical-brand-write/v1' THEN RAISE EXCEPTION 'WRITE_CONTRACT_REQUIRED'; END IF;
  mid:=(p_command->>'mutation_id')::uuid;
  IF mid IS NULL OR NOT (p_command ? 'workspace_id') OR coalesce(p_command->>'expected_revision','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'INVALID_WRITE_CONTRACT'; END IF;
  digest:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  SELECT * INTO b FROM public.brands WHERE id=p_brand_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BRAND_NOT_FOUND'; END IF;
  IF b.owner_email=p_email THEN role_name:='owner'; ELSE SELECT role INTO role_name FROM public.brand_members WHERE brand_id=p_brand_id AND email=p_email FOR SHARE; END IF;
  IF role_name IS NULL OR role_name NOT IN ('owner','admin','editor') THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  ws:=(p_command->>'workspace_id')::uuid;
  IF ws IS DISTINCT FROM b.workspace_id THEN RAISE EXCEPTION 'WORKSPACE_CONTEXT_CHANGED' USING ERRCODE='42501'; END IF;
  IF ws IS NOT NULL THEN
    PERFORM 1 FROM public.workspaces WHERE id=ws AND status='active' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
    PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=ws AND identity_id=actor AND status='accepted' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO receipt FROM public.brand_knowledge_history WHERE brand_id=p_brand_id AND actor_identity_id=actor AND mutation_id=mid;
  IF FOUND THEN
    IF receipt.request_digest<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN jsonb_build_object('brand',receipt.after_state,'event_id',receipt.event_id,'mutation_id',mid,'replay',true);
  END IF;
  IF b.revision<>(p_command->>'expected_revision')::bigint THEN RAISE EXCEPTION 'STALE_UPDATE'; END IF;
  IF b.revision>=9007199254740991 THEN RAISE EXCEPTION 'REVISION_RANGE_EXCEEDED'; END IF;
  resolved:=brand_knowledge_private.resolve_changes(jsonb_build_object('name',b.name,'brand_core',b.brand_core),p_command);
  next_state:=resolved->'candidate';
  IF p_command->>'operation'='initialize' THEN
    IF b.brand_core<>'{}'::jsonb THEN RAISE EXCEPTION 'INITIALIZATION_REQUIRES_EMPTY_CORE'; END IF;
    IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'INITIALIZATION_REQUIRES_SERIALIZABLE'; END IF;
    SELECT * INTO source_board FROM public.boards WHERE id=(p_command#>>'{source,board_id}')::uuid;
    IF source_board.id IS NULL OR source_board.brand_id IS DISTINCT FROM b.id OR source_board.workspace_id IS DISTINCT FROM b.workspace_id
      OR source_board.brand_core_snapshot IS DISTINCT FROM p_command#>'{source,snapshot}'
      OR next_state->'brand_core' IS DISTINCT FROM source_board.brand_core_snapshot THEN RAISE EXCEPTION 'INITIALIZATION_SOURCE_CHANGED'; END IF;
    -- Current canonical Brand edit authority grants access to its associated Boards
    -- through the existing Brand-wide Board access rule; unrelated Boards denied.
  END IF;
  IF p_preview THEN RETURN resolved; END IF;
  IF (resolved->>'requires_review')::boolean AND (p_review->'command' IS DISTINCT FROM p_command OR p_review->>'email' IS DISTINCT FROM p_email OR p_review->>'brand_id' IS DISTINCT FROM p_brand_id::text OR coalesce((p_review->>'expires')::bigint,0)<extract(epoch FROM clock_timestamp())) THEN
    RAISE EXCEPTION 'DESTRUCTIVE_REVIEW_REQUIRED'; END IF;
  PERFORM set_config('brand_knowledge.context',jsonb_build_object('actor',actor,'brand_id',p_brand_id,'mutation_id',mid,'digest',digest,'operation',CASE WHEN next_state=jsonb_build_object('name',b.name,'brand_core',b.brand_core) THEN 'noop' ELSE p_command->>'operation' END,'intent',(SELECT coalesce(jsonb_agg(jsonb_build_object('path',x->>'path','action',x->>'action')),'[]') FROM jsonb_array_elements(p_command->'changes') x))::text,true);
  UPDATE public.brands SET name=next_state->>'name',brand_core=next_state->'brand_core',revision=revision+CASE WHEN next_state=jsonb_build_object('name',b.name,'brand_core',b.brand_core) THEN 0 ELSE 1 END,knowledge_event_seq=knowledge_event_seq+1,updated_at=clock_timestamp() WHERE id=p_brand_id RETURNING * INTO b;
  SELECT * INTO STRICT event FROM public.brand_knowledge_history WHERE brand_id=p_brand_id AND event_seq=b.knowledge_event_seq;
  RETURN jsonb_build_object('brand',to_jsonb(b),'event_id',event.event_id,'mutation_id',mid,'replay',false);
END $$;

-- Create uses existing caller transaction, preserving coupled Project creation.
CREATE OR REPLACE FUNCTION brand_knowledge_private.create_brand(p_email text,p_id uuid,p_workspace uuid,p_name text,p_core jsonb,p_mutation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; b public.brands%ROWTYPE; digest text; receipt public.brand_knowledge_history%ROWTYPE;
BEGIN
  SELECT id INTO STRICT actor FROM public.app_identities WHERE canonical_email=p_email AND status='active' FOR SHARE;
  PERFORM 1 FROM public.workspaces WHERE id=p_workspace AND status='active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=p_workspace AND identity_id=actor AND status='accepted' AND role IN ('owner','admin') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,3623));
  digest:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_name,p_core)::text,'UTF8')),'hex');
  SELECT * INTO receipt FROM public.brand_knowledge_history WHERE brand_id=p_id AND actor_identity_id=actor AND mutation_id=p_mutation;
  IF FOUND THEN IF receipt.request_digest<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF; RETURN receipt.after_state; END IF;
  IF EXISTS (SELECT FROM public.brand_knowledge_history WHERE brand_id=p_id) THEN RAISE EXCEPTION 'BRAND_ID_REUSE_DENIED'; END IF;
  IF jsonb_typeof(p_core) IS DISTINCT FROM 'object' OR octet_length(p_core::text)>1048576 OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR p_name ~ '[[:cntrl:]]' OR p_mutation IS NULL THEN RAISE EXCEPTION 'INVALID_BRAND_VALUES'; END IF;
  PERFORM set_config('brand_knowledge.context',jsonb_build_object('actor',actor,'brand_id',p_id,'mutation_id',p_mutation,'digest',digest,'operation','create')::text,true);
  INSERT INTO public.brands(id,workspace_id,owner_email,name,brand_core,revision,knowledge_event_seq) VALUES(p_id,p_workspace,p_email,p_name,p_core,1,1) RETURNING * INTO b;
  RETURN to_jsonb(b);
END $$;

-- Metadata/lifecycle commands have their own revision and exact typed intent.
CREATE OR REPLACE FUNCTION brand_knowledge_private.lifecycle(p_email text,p_id uuid,p_command jsonb,p_review jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; b public.brands%ROWTYPE; role_name text; receipt public.brand_knowledge_history%ROWTYPE; digest text; mid uuid; op text:=p_command->>'operation';
BEGIN
  SELECT id INTO STRICT actor FROM public.app_identities WHERE canonical_email=p_email AND status='active' FOR SHARE;
  SELECT * INTO b FROM public.brands WHERE id=p_id FOR UPDATE;
  mid:=(p_command->>'mutation_id')::uuid;
  digest:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  IF b.id IS NULL THEN
    -- Only original verified actor may resolve its own delete receipt.
    SELECT * INTO receipt FROM public.brand_knowledge_history WHERE brand_id=p_id AND actor_identity_id=actor AND mutation_id=mid AND operation_type='delete';
    IF FOUND AND receipt.request_digest=digest THEN RETURN jsonb_build_object('deleted',true,'event_id',receipt.event_id,'replay',true); END IF;
    RAISE EXCEPTION 'BRAND_NOT_FOUND';
  END IF;
  IF b.owner_email=p_email THEN role_name:='owner'; ELSE SELECT role INTO role_name FROM public.brand_members WHERE brand_id=p_id AND email=p_email FOR SHARE; END IF;
  IF role_name IS NULL OR role_name NOT IN ('owner','admin','editor') OR (op='delete' AND role_name<>'owner') THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  IF (p_command->>'workspace_id')::uuid IS DISTINCT FROM b.workspace_id THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  IF b.workspace_id IS NOT NULL THEN
    PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=b.workspace_id AND identity_id=actor AND status='accepted' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO receipt FROM public.brand_knowledge_history WHERE brand_id=p_id AND actor_identity_id=actor AND mutation_id=mid;
  IF FOUND THEN IF receipt.request_digest<>digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF; RETURN jsonb_build_object('brand',receipt.after_state,'event_id',receipt.event_id,'replay',true); END IF;
  IF p_command->>'contract' IS DISTINCT FROM 'canonical-brand-write/v1' OR mid IS NULL OR op IS NULL OR op NOT IN ('logo','delete') THEN RAISE EXCEPTION 'INVALID_WRITE_CONTRACT'; END IF;
  IF coalesce(p_command->>'expected_revision','') !~ '^[1-9][0-9]*$' OR coalesce(p_command->>'expected_logo_revision','') !~ '^(0|[1-9][0-9]*)$' OR NOT (p_command ? 'workspace_id') THEN RAISE EXCEPTION 'INVALID_WRITE_CONTRACT'; END IF;
  IF b.revision<>(p_command->>'expected_revision')::bigint OR b.logo_revision<>(p_command->>'expected_logo_revision')::bigint THEN RAISE EXCEPTION 'STALE_UPDATE'; END IF;
  IF p_review->'command' IS DISTINCT FROM p_command OR p_review->>'email' IS DISTINCT FROM p_email OR p_review->>'brand_id' IS DISTINCT FROM p_id::text OR coalesce((p_review->>'expires')::bigint,0)<extract(epoch FROM clock_timestamp()) THEN RAISE EXCEPTION 'DESTRUCTIVE_REVIEW_REQUIRED'; END IF;
  PERFORM set_config('brand_knowledge.context',jsonb_build_object('actor',actor,'brand_id',p_id,'mutation_id',mid,'digest',digest,'operation',op,'request_fingerprint',p_command->>'input_digest')::text,true);
  IF op='delete' THEN
    IF p_command->>'confirmation_name' IS DISTINCT FROM b.name THEN RAISE EXCEPTION 'CONFIRMATION_MISMATCH'; END IF;
    IF EXISTS(SELECT FROM public.boards WHERE brand_id=p_id) THEN
      RAISE EXCEPTION 'BRAND_IN_USE' USING DETAIL=jsonb_build_object('boardCount',(SELECT count(*) FROM public.boards WHERE brand_id=p_id))::text;
    END IF;
    DELETE FROM public.brand_members WHERE brand_id=p_id;
    DELETE FROM public.brands WHERE id=p_id;
    RETURN jsonb_build_object('deleted',true);
  END IF;
  IF b.logo_revision>=9007199254740991 THEN RAISE EXCEPTION 'REVISION_RANGE_EXCEEDED'; END IF;
  IF jsonb_typeof(p_command->'metadata') IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(p_command->'metadata') k WHERE k NOT IN ('logo_object_path','logo_mime_type','logo_source','logo_source_host')) THEN RAISE EXCEPTION 'INVALID_LOGO_METADATA'; END IF;
  IF p_command#>>'{metadata,logo_object_path}' IS NOT NULL AND (
    NOT starts_with(p_command#>>'{metadata,logo_object_path}',p_id::text||'/')
    OR length(p_command#>>'{metadata,logo_object_path}')>256
    OR (p_command#>>'{metadata,logo_object_path}') !~ '^[0-9a-f-]{36}/[0-9]+(-[0-9a-f-]{36})?[.](png|jpg|webp|gif)$'
    OR coalesce(p_command#>>'{metadata,logo_mime_type}','') NOT IN ('image/png','image/jpeg','image/webp','image/gif')
    OR coalesce(p_command#>>'{metadata,logo_source}','') NOT IN ('uploaded','discovered')
    OR length(coalesce(p_command#>>'{metadata,logo_source_host}',''))>253) THEN RAISE EXCEPTION 'INVALID_LOGO_METADATA'; END IF;
  UPDATE public.brands SET logo_object_path=p_command#>>'{metadata,logo_object_path}',logo_mime_type=p_command#>>'{metadata,logo_mime_type}',logo_source=p_command#>>'{metadata,logo_source}',logo_source_host=p_command#>>'{metadata,logo_source_host}',logo_updated_at=clock_timestamp(),logo_revision=logo_revision+1,knowledge_event_seq=knowledge_event_seq+1 WHERE id=p_id RETURNING * INTO b;
  RETURN jsonb_build_object('brand',to_jsonb(b));
END $$;

-- Authorized receipt before upload/revision validation.
CREATE OR REPLACE FUNCTION brand_knowledge_private.logo_receipt(p_email text,p_id uuid,p_mutation uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; b public.brands%ROWTYPE; member_role text; h public.brand_knowledge_history%ROWTYPE;
BEGIN
  SELECT id INTO STRICT actor FROM public.app_identities WHERE canonical_email=p_email AND status='active' FOR SHARE;
  SELECT * INTO b FROM public.brands WHERE id=p_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'BRAND_NOT_FOUND'; END IF;
  SELECT role INTO member_role FROM public.brand_members WHERE brand_id=p_id AND email=p_email FOR SHARE;
  IF b.owner_email<>p_email AND coalesce(member_role,'') NOT IN ('owner','admin','editor') THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  IF b.workspace_id IS NOT NULL THEN
    PERFORM 1 FROM public.workspace_memberships WHERE workspace_id=b.workspace_id AND identity_id=actor AND status='accepted' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO h FROM public.brand_knowledge_history WHERE brand_id=p_id AND actor_identity_id=actor AND mutation_id=p_mutation;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF h.workspace_id IS DISTINCT FROM b.workspace_id THEN RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE='42501'; END IF;
  IF h.operation_type<>'logo' OR h.provenance->>'request_fingerprint' IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN h.after_state;
END $$;
RESET ROLE;

GRANT SELECT,INSERT,UPDATE,DELETE ON public.brands TO brand_knowledge_owner;
GRANT SELECT,UPDATE,DELETE ON public.brand_members TO brand_knowledge_owner;
GRANT SELECT,UPDATE ON public.app_identities,public.workspaces,public.workspace_memberships TO brand_knowledge_owner;
GRANT SELECT ON public.boards TO brand_knowledge_owner;
-- Owner needs row locks; no browser policy can grant EXECUTE below.
DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','brand_members','app_identities','workspaces','workspace_memberships','boards'] LOOP
    IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=('public.'||t)::regclass AND polname='brand_knowledge_function_owner') THEN
      EXECUTE format('CREATE POLICY brand_knowledge_function_owner ON public.%I TO brand_knowledge_owner USING (true) WITH CHECK (true)',t);
    END IF;
  END LOOP;
END $policies$;
-- Preserve existing server read projections. This role is backend-only; browser
-- roles receive no membership, table grant or policy. History has no runtime read.
GRANT SELECT ON public.brands,public.brand_members TO brand_knowledge_runtime;
DO $read_policies$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.brands'::regclass AND polname='brand_knowledge_server_read') THEN
    CREATE POLICY brand_knowledge_server_read ON public.brands FOR SELECT TO brand_knowledge_runtime USING(true);
  END IF;
  IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.brand_members'::regclass AND polname='brand_knowledge_server_read') THEN
    CREATE POLICY brand_knowledge_server_read ON public.brand_members FOR SELECT TO brand_knowledge_runtime USING(true);
  END IF;
END $read_policies$;
-- Never grant helpers to runtime. capture_brand runs as invoking function owner.
SET LOCAL ROLE brand_knowledge_owner;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA brand_knowledge_private TO brand_knowledge_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA brand_knowledge_private FROM PUBLIC;
RESET ROLE;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.brands FROM PUBLIC,brand_knowledge_runtime;
DO $close_grants$
DECLARE r record; col record;
BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','brand_knowledge_runtime') LOOP
    IF (SELECT relowner='brand_knowledge_owner'::regrole FROM pg_class WHERE oid='public.brand_knowledge_history'::regclass) THEN SET LOCAL ROLE brand_knowledge_owner; END IF;
    EXECUTE format('REVOKE ALL ON public.brand_knowledge_history FROM %I',r.rolname);
    RESET ROLE;
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES ON public.brands FROM %I',r.rolname);
    FOR col IN SELECT attname FROM pg_attribute WHERE attrelid='public.brands'::regclass AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.brands FROM %I',col.attname,col.attname,col.attname,r.rolname);
    END LOOP;
    SET LOCAL ROLE brand_knowledge_owner;
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA brand_knowledge_private FROM %I',r.rolname);
    RESET ROLE;
  END LOOP;
END $close_grants$;
-- All history DDL, baseline capture and ACL cleanup must precede this final transfer.
-- PostgreSQL checks CREATE on the destination schema even for a NOLOGIN owner.
-- Borrow it only for this transfer; preserve existing direct/inherited privileges.
DO $history_owner$
DECLARE temporary_create boolean := NOT has_schema_privilege('brand_knowledge_owner','public','CREATE');
BEGIN
  IF (SELECT relowner='brand_knowledge_owner'::regrole FROM pg_class WHERE oid='public.brand_knowledge_history'::regclass) THEN RETURN; END IF;
  IF temporary_create THEN GRANT CREATE ON SCHEMA public TO brand_knowledge_owner; END IF;
  ALTER TABLE public.brand_knowledge_history OWNER TO brand_knowledge_owner;
  IF temporary_create THEN REVOKE CREATE ON SCHEMA public FROM brand_knowledge_owner; END IF;
END $history_owner$;
SET LOCAL ROLE brand_knowledge_owner;
DO $operator_schema_cleanup$ BEGIN
  IF current_setting('brand_knowledge.install_borrowed_usage')::boolean THEN
    EXECUTE format('REVOKE USAGE ON SCHEMA brand_knowledge_private FROM %I',current_setting('brand_knowledge.install_operator'));
  END IF;
END $operator_schema_cleanup$;
GRANT EXECUTE ON FUNCTION brand_knowledge_private.write_brand(text,uuid,jsonb,jsonb,boolean),brand_knowledge_private.create_brand(text,uuid,uuid,text,jsonb,uuid),brand_knowledge_private.lifecycle(text,uuid,jsonb,jsonb),brand_knowledge_private.logo_receipt(text,uuid,uuid,text) TO brand_knowledge_runtime;
CREATE OR REPLACE FUNCTION brand_knowledge_private.install_fingerprint() RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
SELECT encode(sha256(convert_to(jsonb_build_object(
 'columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,attnotnull,attgenerated) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.brand_knowledge_history'::regclass AND attnum>0 AND NOT attisdropped),
 'constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname) FROM pg_constraint WHERE conrelid='public.brand_knowledge_history'::regclass),
 'functions',(SELECT jsonb_agg(jsonb_build_array(proname,pg_get_functiondef(oid),proowner,proacl::text) ORDER BY oid) FROM pg_proc WHERE pronamespace='brand_knowledge_private'::regnamespace),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(pg_get_triggerdef(oid),tgenabled) ORDER BY tgname) FROM pg_trigger WHERE tgrelid IN ('public.brands'::regclass,'public.brand_knowledge_history'::regclass) AND NOT tgisinternal),
 'grants',(SELECT jsonb_agg(jsonb_build_array(oid,relowner,relacl::text,relrowsecurity) ORDER BY oid) FROM pg_class WHERE oid IN ('public.brands'::regclass,'public.brand_knowledge_history'::regclass))
)::text,'UTF8')),'hex') $$;
REVOKE ALL ON FUNCTION brand_knowledge_private.install_fingerprint() FROM PUBLIC;
DO $fingerprint$ BEGIN
  EXECUTE format('COMMENT ON SCHEMA brand_knowledge_private IS %L',brand_knowledge_private.install_fingerprint());
END $fingerprint$;

-- Catalog verification also must be run in the operator's session before COMMIT.
DO $verify$
DECLARE runtime_role record;
BEGIN
  -- ADMIN alone is role-management authority, not inherited/SET capability.
  -- Follow explicit capability edges, never pg_has_role(superuser, ..., 'USAGE'):
  -- that function reports implicit superuser authority even without membership.
  FOR runtime_role IN WITH RECURSIVE members(oid) AS (
    SELECT oid FROM pg_roles WHERE rolname='brand_knowledge_runtime'
    UNION SELECT m.member FROM pg_auth_members m JOIN members r ON m.roleid=r.oid
      WHERE m.inherit_option OR m.set_option
  ), reachable(oid) AS (
    SELECT oid FROM members
    UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable r ON m.member=r.oid
      WHERE m.inherit_option OR m.set_option
  ) SELECT p.* FROM pg_roles p JOIN reachable r ON p.oid=r.oid LOOP
    IF runtime_role.rolsuper OR runtime_role.rolbypassrls OR runtime_role.rolcreaterole OR runtime_role.rolcreatedb OR runtime_role.rolreplication
      OR pg_has_role(runtime_role.oid,'brand_knowledge_owner','MEMBER')
      OR has_table_privilege(runtime_role.oid,'public.brands','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_any_column_privilege(runtime_role.oid,'public.brands','INSERT,UPDATE,REFERENCES')
      OR has_table_privilege(runtime_role.oid,'public.brand_knowledge_history','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,SELECT')
      OR has_any_column_privilege(runtime_role.oid,'public.brand_knowledge_history','INSERT,UPDATE,SELECT')
      OR has_schema_privilege(runtime_role.oid,'brand_knowledge_private','CREATE')
      OR has_schema_privilege(runtime_role.oid,'public','CREATE') THEN
      RAISE EXCEPTION 'UNSAFE_RUNTIME_PRIVILEGES: %',runtime_role.rolname;
    END IF;
  END LOOP;
  IF NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.brand_knowledge_history'::regclass AND conname='brand_history_source' AND confdeltype='r')
    OR EXISTS(SELECT FROM public.brands b WHERE NOT EXISTS(SELECT FROM public.brand_knowledge_history h WHERE h.brand_id=b.id AND h.event_seq=b.knowledge_event_seq AND h.after_state=to_jsonb(b))) THEN RAISE EXCEPTION 'PROTECTION_VERIFICATION_FAILED'; END IF;
END $verify$;
RESET ROLE;
COMMIT;
