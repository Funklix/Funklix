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
  -- Operator-only ADMIN rows are permitted only with an explicit all-SET
  -- path to the owner. INHERIT/SET capability edges are never exempted.
  IF EXISTS(WITH RECURSIVE operators(oid) AS (
    SELECT 'brand_knowledge_owner'::regrole::oid
    UNION SELECT m.member FROM pg_auth_members m JOIN operators o ON m.roleid=o.oid WHERE m.set_option
  ) SELECT FROM pg_auth_members WHERE
    (member IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole) OR roleid IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole))
    AND NOT(roleid='brand_knowledge_runtime'::regrole AND member='tendra_app_runtime'::regrole AND inherit_option AND NOT set_option AND NOT admin_option)
      AND NOT(roleid IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole)
        AND member IN (SELECT oid FROM operators)
        AND NOT inherit_option AND NOT set_option AND admin_option)) THEN RAISE EXCEPTION 'UNREVIEWED_ROLE_MEMBERSHIP'; END IF;
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
