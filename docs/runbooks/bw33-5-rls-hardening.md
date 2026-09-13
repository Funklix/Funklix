# BW-33.5 operator runbook (Felix)

This is a one-block, manually reviewed security change. **Do not use Ask Assistant, table toggles, CLI `db push`, or construct policies table by table.** Stop if any prerequisite differs.

## 1. Prerequisites and backup

1. Schedule a low-traffic window; confirm the deployed revision includes this audit and all CI checks passed.
2. In Supabase SQL Editor, run the read-only preflight below. Expect 13 rows; `boards.rls_enabled=true`; the other reported values may be false; `rls_forced=false` everywhere; `policies` empty everywhere. Expect the application login to have `owns_all=true` **or** `rolbypassrls=true`. If not, **stop**—do not run the migration.
3. Take/verify a Supabase point-in-time recovery backup (or an immediately restorable logical backup under the normal production backup procedure). Export the preflight output with the change record; it is the exact grant/policy/owner snapshot.

```sql
WITH target(name) AS (VALUES ('brands'),('social_publish_jobs'),('social_provider_attempts'),('brand_documents'),('brand_document_upload_intents'),('brand_document_processing_jobs'),('brand_document_processing_results'),('social_external_posts'),('brand_members'),('social_token_secrets'),('social_connected_accounts'),('social_oauth_attempts'),('boards'))
SELECT t.name,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner,
       COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=t.name),'[]') AS policies,
       COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g WHERE g.table_schema='public' AND g.table_name=t.name),'[]') AS grants
FROM target t LEFT JOIN pg_class c ON c.oid=to_regclass(format('public.%I',t.name)) ORDER BY t.name;

-- Replace only the placeholder with the POSTGRES_URL username shown by approved
-- deployment secret metadata; never paste the URL/password into SQL or notes.
SELECT r.rolname, r.rolbypassrls,
       bool_and(c.relowner=r.oid) AS owns_all
FROM pg_roles r CROSS JOIN pg_class c
WHERE r.rolname='<APPLICATION_LOGIN_ROLE>' AND c.oid = ANY(ARRAY[
  'public.brands'::regclass,'public.social_publish_jobs'::regclass,'public.social_provider_attempts'::regclass,
  'public.brand_documents'::regclass,'public.brand_document_upload_intents'::regclass,
  'public.brand_document_processing_jobs'::regclass,'public.brand_document_processing_results'::regclass,
  'public.social_external_posts'::regclass,'public.brand_members'::regclass,'public.social_token_secrets'::regclass,
  'public.social_connected_accounts'::regclass,'public.social_oauth_attempts'::regclass,'public.boards'::regclass])
GROUP BY r.rolname,r.rolbypassrls;
```

## 2. Apply and verify

Open **exactly** `migrations/20260911_bw33_5_supabase_rls_hardening.sql`, review its committed hash, copy the **entire file as the one SQL block**, and run it once in SQL Editor. Do not edit it. Its final query must return exactly 13 rows with `rls_enabled=true`, `rls_forced=false`, `deny_policy=true`, and both privilege arrays empty. Re-run the same file once: it must succeed with identical output. Do not continue on any exception or unexpected policy.

Smoke-test in order: (1) Google sign-in; (2) existing-session restoration; (3) Boards list; (4) private Board; (5) node hydration; (6) edit/save; (7) reload; (8) ownership; (9) create temporary Board; (10) delete it; (11) existing Brand; (12) Brand members; (13) small document upload; (14) intent/job/result completion; (15) existing documents; (16) Social Connections; (17) existing state; (18) **do not initiate/enable paused LinkedIn personal-profile publishing**; (19) confirm no tokens/secrets; (20) Content Workspace; (21) approved content; (22) publishing remains disabled where intended; (23) Canvas Inspector, Post-its, comments, density, emoji picker; (24) refresh Security Advisor; (25) confirm all 12 disabled-RLS errors and the Boards no-policy error are gone. If the Advisor describes secure deny-only policies, record that intentional result; never add allow policies to make it green.

## 3. Rollback

Trigger rollback immediately for server database permission/RLS errors or any failed Board, Brand, document, Social, approval, or publishing step. Copy and run **the complete single SQL block** from `migrations/20260911_bw33_5_supabase_rls_hardening.rollback.sql`; do not reconstruct it. It preserves revoked Data API grants. Repeat the failed smoke test. Restore captured grants only if separately approved after security review. If rollback does not restore service, use the verified backup/PITR procedure and escalate with the captured preflight and error classification.
