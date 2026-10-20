-- SELECT-only. Authorized operator runs privately; no Brand payloads are selected.
SELECT current_database(),current_user,session_user,current_setting('server_version'),current_setting('session_replication_role');
SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolinherit FROM pg_roles WHERE rolname=current_user OR rolname IN ('brand_knowledge_owner','brand_knowledge_runtime','anon','authenticated','service_role');
SELECT member.rolname AS member, parent.rolname AS inherited_role FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles parent ON parent.oid=m.roleid;
SELECT n.nspname,c.relname,c.relkind,c.relispartition,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname IN ('brands','brand_members','brand_knowledge_history','boards','board_editors','workspaces','workspace_memberships','app_identities');
SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('brands','brand_members','boards','board_editors','app_identities','workspaces','workspace_memberships') ORDER BY table_name,ordinal_position;
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN (to_regclass('public.brands'),to_regclass('public.brand_members'),to_regclass('public.brand_knowledge_history'));
SELECT tgrelid::regclass,tgname,tgenabled,pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid IN (to_regclass('public.brands'),to_regclass('public.brand_members'),to_regclass('public.brand_knowledge_history')) AND NOT tgisinternal;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE tablename IN ('brands','brand_members','brand_knowledge_history','app_identities','workspaces','workspace_memberships','boards');
SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_name IN ('brands','brand_knowledge_history');
SELECT grantee,table_name,column_name,privilege_type FROM information_schema.column_privileges WHERE table_name IN ('brands','brand_knowledge_history');
SELECT defaclrole::regrole,defaclnamespace::regnamespace,defaclobjtype,defaclacl FROM pg_default_acl;
SELECT n.nspname,p.proname,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='brand_knowledge_private';
SELECT count(*) AS rows, count(*) FILTER(WHERE jsonb_typeof(brand_core)<>'object' OR octet_length(brand_core::text)>1048576 OR revision<1 OR revision>=9007199254740991 OR logo_revision<0) AS unsupported_rows,pg_size_pretty(pg_total_relation_size('public.brands')) AS size FROM public.brands;
-- Private operator evidence separately required: backup/restore test, role login
-- provenance, external writers/jobs, prior applied migrations and asset retention.
