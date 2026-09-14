-- BW-33.5.1 read-only verification. Expect one row with compliant=true.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname
      AND p.policyname = 'bw33_5_deny_supabase_api_roles'
      AND p.permissive = 'RESTRICTIVE'
      AND p.cmd = 'ALL'
      AND p.roles @> ARRAY['anon', 'authenticated']::name[]
      AND cardinality(p.roles) = 2
      AND p.qual = 'false'
      AND p.with_check = 'false'
  ) AS deny_policy,
  COALESCE(
    ARRAY(
      SELECT DISTINCT g.privilege_type::text
      FROM information_schema.role_table_grants AS g
      WHERE g.table_schema = 'public'
        AND g.table_name = c.relname
        AND g.grantee = 'anon'
      ORDER BY g.privilege_type::text
    ),
    ARRAY[]::text[]
  ) AS anon_privileges,
  COALESCE(
    ARRAY(
      SELECT DISTINCT g.privilege_type::text
      FROM information_schema.role_table_grants AS g
      WHERE g.table_schema = 'public'
        AND g.table_name = c.relname
        AND g.grantee = 'authenticated'
      ORDER BY g.privilege_type::text
    ),
    ARRAY[]::text[]
  ) AS authenticated_privileges,
  c.relrowsecurity
    AND NOT c.relforcerowsecurity
    AND EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = c.relname
        AND p.policyname = 'bw33_5_deny_supabase_api_roles'
        AND p.permissive = 'RESTRICTIVE'
        AND p.cmd = 'ALL'
        AND p.roles @> ARRAY['anon', 'authenticated']::name[]
        AND cardinality(p.roles) = 2
        AND p.qual = 'false'
        AND p.with_check = 'false'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants AS g
      WHERE g.table_schema = 'public'
        AND g.table_name = c.relname
        AND g.grantee IN ('anon', 'authenticated')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = c.relname
        AND p.policyname <> 'bw33_5_deny_supabase_api_roles'
    ) AS compliant
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'social_publishing_destinations'
  AND c.relkind IN ('r', 'p');
