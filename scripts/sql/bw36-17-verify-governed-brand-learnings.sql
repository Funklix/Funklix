-- Manual, read-only, post-migration verification. Never register in a migration runner.
-- Run the final existing-data aggregate SELECT before execution as a baseline, then
-- compare after execution while unrelated writes are quiescent. No row content/IDs/emails.
BEGIN TRANSACTION READ ONLY;
SELECT
  to_regclass('public.brand_learnings') IS NOT NULL AS learnings_exist,
  to_regclass('public.brand_learning_events') IS NOT NULL AS events_exist,
  (SELECT count(*) = 2 AND bool_and(relrowsecurity) FROM pg_class
    WHERE oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS rls_enabled,
  (SELECT count(*) = 0 FROM pg_policy
    WHERE polrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS no_browser_policies,
  NOT (has_table_privilege('anon','public.brand_learnings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated','public.brand_learnings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('anon','public.brand_learning_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated','public.brand_learning_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS browser_grants_closed,
  NOT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.grantee = 0) AS public_grants_closed,
  (SELECT count(*) FROM public.brand_learnings) AS initial_learning_rows,
  (SELECT count(*) FROM public.brand_learning_events) AS initial_event_rows,
  (SELECT count(*) = 6 FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
    ('brand_learnings_listing_idx','brand_learnings_successor_idx','brand_learnings_proposal_key',
     'brand_learnings_approved_key','brand_learnings_open_successor_key','brand_learning_events_history_idx')) AS required_indexes,
  (SELECT count(*) = 5 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
    ('brand_learning_lifecycle','brand_learning_no_delete','brand_learning_events_append_only',
     'brand_learning_no_truncate','brand_learning_events_no_truncate')) AS lifecycle_history_guards,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.brand_learnings'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%proposed%approved%rejected%archived%') AS allowed_statuses;

-- Exact FK schema evidence, bounded to eight FK definitions, no entity UUIDs.
SELECT count(*) AS foreign_key_count, bool_and(convalidated) AS all_validated,
  bool_and(confrelid IN ('public.brands'::regclass,'public.boards'::regclass,
    'public.app_identities'::regclass,'public.brand_learnings'::regclass)) AS targets_resolve,
  count(*) FILTER (WHERE confrelid = 'public.brands'::regclass AND confdeltype = 'c') = 2 AS brand_cascade,
  count(*) FILTER (WHERE conrelid = 'public.brand_learning_events'::regclass
    AND confrelid = 'public.brand_learnings'::regclass AND array_length(conkey,1) = 2) = 1 AS event_brand_boundary,
  count(*) FILTER (WHERE conrelid = 'public.brand_learnings'::regclass
    AND confrelid = 'public.brand_learnings'::regclass AND array_length(conkey,1) = 2) = 1 AS successor_brand_boundary
FROM pg_constraint WHERE contype = 'f' AND conrelid IN
  ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass);
COMMIT;

-- Run this SELECT separately before migration, and again after. Fingerprints are
-- aggregate evidence only. Matching baselines establish no existing-record mutation
-- during a quiet execution window; a single post-execution query cannot prove history.
SELECT 'brands' AS entity, count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY b.id),'')) AS aggregate_fingerprint FROM public.brands b
UNION ALL SELECT 'boards_and_snapshots',count(*),md5(coalesce(string_agg(md5(to_jsonb(b)::text),'' ORDER BY b.id),'')) FROM public.boards b
UNION ALL SELECT 'workspaces',count(*),md5(coalesce(string_agg(md5(to_jsonb(w)::text),'' ORDER BY w.id),'')) FROM public.workspaces w
UNION ALL SELECT 'brand_memberships',count(*),md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' ORDER BY m.brand_id,m.email),'')) FROM public.brand_members m
UNION ALL SELECT 'workspace_memberships',count(*),md5(coalesce(string_agg(md5(to_jsonb(m)::text),'' ORDER BY m.workspace_id,m.identity_id),'')) FROM public.workspace_memberships m;
