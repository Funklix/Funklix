-- Read-only browser ACL inventory for R3's server-only scope.
-- This file is diagnostic only; no production SQL is executed by tests or CI.
-- pg_has_role(...,'USAGE') follows effective inheritance, matching the verifier;
-- do not use information_schema.role_table_grants (it omits PUBLIC sources).
WITH relations AS (
 SELECT c.oid,c.relname,c.relowner FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY[
 'boards','board_editors','app_identities','workspaces','workspace_memberships','brand_members','project_commands','brand_learnings','brand_learning_events','brand_documents','brand_document_upload_intents','brand_document_processing_jobs','brand_document_processing_results','social_token_secrets','social_connected_accounts','social_publishing_destinations','social_oauth_attempts','social_publish_jobs','social_provider_attempts','social_external_posts','social_connector_schema_version'
 ])
), browsers AS (
 SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')
), acl AS (
 SELECT r.oid,r.relname,NULL::name AS column_name,a.*
 FROM relations r JOIN pg_class c ON c.oid=r.oid
 CROSS JOIN LATERAL aclexplode(c.relacl) a
 UNION ALL
 SELECT r.oid,r.relname,c.attname,a.*
 FROM relations r JOIN pg_attribute c ON c.attrelid=r.oid AND c.attnum>0 AND NOT c.attisdropped
 CROSS JOIN LATERAL aclexplode(c.attacl) a
)
SELECT b.rolname AS browser,a.relname AS table_name,a.column_name,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=b.oid THEN 'DIRECT' ELSE 'INHERITED' END AS source
FROM acl a CROSS JOIN browsers b
WHERE CASE WHEN a.grantee=0 THEN true ELSE pg_has_role(b.oid,a.grantee,'USAGE') END
ORDER BY browser,table_name,column_name NULLS FIRST,grantee,privilege_type;
