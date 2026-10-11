-- One read-only statement, bounded aggregate output; no row text, UUIDs or identities.
-- Run unchanged BEFORE migration and record the four count/fingerprint outputs.
-- AFTER migration, replace only these four NULLs with that baseline, then rerun.
-- Missing baseline never reports ok. Quiesce unrelated Learning writes for comparison.
WITH expected_baseline(learning_count,learning_fingerprint,event_count,event_fingerprint) AS (
  VALUES (NULL::bigint, NULL::text, NULL::bigint, NULL::text)
), fingerprints AS (
  SELECT (SELECT count(*) FROM public.brand_learnings) AS learning_count,
    (SELECT md5(coalesce(string_agg(md5((to_jsonb(l) - ARRAY['source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'])::text),'' ORDER BY l.id),'')) FROM public.brand_learnings l) AS learning_fingerprint,
    (SELECT count(*) FROM public.brand_learning_events) AS event_count,
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' ORDER BY e.id),'')) FROM public.brand_learning_events e) AS event_fingerprint
), checks AS (
  SELECT
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass AND attname='source_board_id' AND atttypid='uuid'::regtype AND NOT attisdropped) AS source_uuid_preserved,
    NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid='public.brand_learnings'::regclass AND c.contype='f' AND a.attname='source_board_id') AS source_has_no_fk,
    (SELECT count(*)=2 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)
      AND c.contype='f' AND c.confrelid='public.brands'::regclass AND c.confdeltype='c' AND c.convalidated
      AND array_length(c.conkey,1)=1 AND a.attname='brand_id') AS brand_ownership_cascade,
    (SELECT count(*)=3 FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass AND attname IN
      ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot') AND atttypid='text'::regtype AND NOT attnotnull AND NOT attisdropped) AS nullable_snapshot_columns,
    (SELECT count(*)=3 FROM (VALUES ('brand_learnings_source_board_name_snapshot_bounded','617291d266bff195115c7efa152973b3'),('brand_learnings_source_node_title_snapshot_bounded','a085796d4c817a9c8f6e690a28a728d8'),('brand_learnings_source_node_type_snapshot_bounded','bf369a7f783da6ee008ddddda9bcea6f')) expected(name,hash)
      JOIN pg_constraint c ON c.conname=expected.name AND c.conrelid='public.brand_learnings'::regclass AND c.contype='c'
      AND c.convalidated AND md5(pg_get_expr(c.conbin,c.conrelid))=expected.hash) AS exact_bounded_column_checks,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
      WHERE p.oid=to_regprocedure('public.guard_brand_learning_lifecycle()') AND md5(p.prosrc)='6827aa328af1fd2a8182920c83909a2f'
      AND t.tgrelid='public.brand_learnings'::regclass AND t.tgname='brand_learning_lifecycle' AND t.tgtype=23 AND t.tgenabled='O'
      AND p.proconfig=ARRAY['search_path=pg_catalog, public']) AS immutable_provenance_and_lifecycle,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass AND conname='brand_learning_events_snapshot_bounded'
      AND contype='c' AND convalidated AND md5(pg_get_expr(conbin,conrelid))='e0c26ef7b20efc51ed44395bed8e3c89') AS exact_event_allowlist_and_bounds,
    (SELECT count(*)=4 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgenabled='O' AND NOT t.tgisinternal AND
      ((t.tgrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND t.tgname IN
        ('brand_learning_no_delete','brand_learning_events_append_only') AND p.oid=to_regprocedure('public.guard_brand_learning_history()')
        AND md5(p.prosrc)='7a73a66fae205a2f93a9cad67fa3632f') OR
       (t.tgrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND t.tgname IN
        ('brand_learning_no_truncate','brand_learning_events_no_truncate') AND p.oid=to_regprocedure('public.guard_brand_learning_truncate()')
        AND md5(p.prosrc)='0b3b00fcb4b9c56fe4e00336b948528f'))) AS append_only_history_preserved,
    (SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS rls_enabled,
    NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS no_browser_policies,
    NOT EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) roles(name) CROSS JOIN
      (VALUES ('public.brand_learnings'),('public.brand_learning_events')) tables(name)
      WHERE has_table_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,REFERENCES')) AS browser_grants_closed,
    NOT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.grantee=0) AS public_grants_closed,
    coalesce(f.learning_count=e.learning_count AND f.learning_fingerprint=e.learning_fingerprint
      AND f.event_count=e.event_count AND f.event_fingerprint=e.event_fingerprint,false) AS existing_rows_unchanged,
    (SELECT count(*)=0 FROM public.brand_learnings l WHERE to_jsonb(l)->>'source_board_name_snapshot' IS NOT NULL
      OR to_jsonb(l)->>'source_node_title_snapshot' IS NOT NULL OR to_jsonb(l)->>'source_node_type_snapshot' IS NOT NULL) AS no_provenance_backfill
  FROM fingerprints f CROSS JOIN expected_baseline e
)
SELECT c.*, f.*,
  CASE WHEN e.learning_count IS NULL OR e.learning_fingerprint IS NULL OR e.event_count IS NULL OR e.event_fingerprint IS NULL THEN 'baseline_required'
    WHEN NOT EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(c)) v WHERE v.value IS DISTINCT FROM 'true'::jsonb) THEN 'ok'
    ELSE 'not_ready' END AS overall_readiness
FROM checks c CROSS JOIN fingerprints f CROSS JOIN expected_baseline e;
