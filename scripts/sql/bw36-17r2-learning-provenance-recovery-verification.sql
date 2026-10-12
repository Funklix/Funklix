-- One read-only statement. Run unchanged after R2, before BW-36.18 activation.
-- Preservation is proved inside R2; these are current bounded aggregates, not a historical baseline.
WITH fingerprints AS (
  SELECT (SELECT count(*) FROM public.brand_learnings) AS learning_count,
    (SELECT md5(coalesce(string_agg(md5((to_jsonb(l) - ARRAY['source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'])::text),'' ORDER BY l.id),'')) FROM public.brand_learnings l) AS learning_fingerprint,
    (SELECT count(*) FROM public.brand_learning_events) AS event_count,
    (SELECT md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' ORDER BY e.id),'')) FROM public.brand_learning_events e) AS event_fingerprint
), checks AS (
  SELECT
    (SELECT md5(string_agg(concat_ws('|',c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,coalesce(pg_get_expr(d.adbin,d.adrelid),'')),E'\n' ORDER BY c.relname,a.attnum)) FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.attnum>0 AND NOT a.attisdropped AND a.attname NOT IN ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'))='6e7695d9dcbc6d85b475bd93beb15b9b' AS exact_base_columns,
    (SELECT md5(string_agg(c.relname||'|'||pg_get_expr(k.conbin,k.conrelid)||'|'||k.convalidated,E'\n' ORDER BY c.relname,pg_get_expr(k.conbin,k.conrelid))) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND k.contype='c' AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey) AND a.attname IN ('snapshot','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot')))='302c3fea29a319f0e78af763c18ae3c9' AS exact_base_checks,
    (SELECT md5(string_agg(pg_get_indexdef(i.indexrelid)||'|'||i.indisvalid||'|'||i.indisready,E'\n' ORDER BY pg_get_indexdef(i.indexrelid))) FROM pg_index i WHERE i.indrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass))='f31d5c729ed20cc5f7980566b8bdb9c9' AS exact_base_indexes,
    EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass AND attname='source_board_id' AND atttypid='uuid'::regtype AND NOT attisdropped) AS source_uuid_preserved,
    NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid='public.brand_learnings'::regclass AND c.contype='f' AND a.attname='source_board_id') AS source_has_no_fk,
    (SELECT count(*)=2 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
      WHERE c.conrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)
      AND c.contype='f' AND c.confrelid='public.brands'::regclass AND c.confdeltype='c' AND c.convalidated
      AND array_length(c.conkey,1)=1 AND a.attname='brand_id') AS brand_ownership_cascade,
    (SELECT bool_and(matches.n=1) FROM (VALUES
      ('public.brand_learnings',ARRAY['brand_id'],'public.brands',ARRAY['id'],'c'),
      ('public.brand_learnings',ARRAY['proposed_by_identity_id'],'public.app_identities',ARRAY['id'],'r'),
      ('public.brand_learnings',ARRAY['reviewed_by_identity_id'],'public.app_identities',ARRAY['id'],'r'),
      ('public.brand_learnings',ARRAY['brand_id','supersedes_learning_id'],'public.brand_learnings',ARRAY['brand_id','id'],'a'),
      ('public.brand_learning_events',ARRAY['brand_id'],'public.brands',ARRAY['id'],'c'),
      ('public.brand_learning_events',ARRAY['actor_identity_id'],'public.app_identities',ARRAY['id'],'r'),
      ('public.brand_learning_events',ARRAY['brand_id','learning_id'],'public.brand_learnings',ARRAY['brand_id','id'],'c')
      ) expected(rel,cols,target,target_cols,del)
      CROSS JOIN LATERAL (SELECT count(*) AS n FROM pg_constraint c
      WHERE c.conrelid=to_regclass(expected.rel) AND c.contype='f' AND c.confrelid=to_regclass(expected.target)
      AND ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord)=expected.cols
      AND ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord)=expected.target_cols
      AND c.confdeltype::text=expected.del AND c.confupdtype='a' AND c.confmatchtype='s' AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred) matches)
      AND (SELECT count(*)=7 FROM pg_constraint WHERE conrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND contype='f') AS exact_ownership_relationships,
    (SELECT count(*)=3 FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass AND attname IN
      ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot') AND atttypid='text'::regtype AND NOT attnotnull AND NOT attisdropped AND NOT atthasdef AND attgenerated='' AND attidentity='') AS nullable_snapshot_columns,
    (SELECT count(*)=3 FROM (VALUES ('brand_learnings_source_board_name_snapshot_bounded','617291d266bff195115c7efa152973b3'),('brand_learnings_source_node_title_snapshot_bounded','a085796d4c817a9c8f6e690a28a728d8'),('brand_learnings_source_node_type_snapshot_bounded','bf369a7f783da6ee008ddddda9bcea6f')) expected(name,hash)
      JOIN pg_constraint c ON c.conname=expected.name AND c.conrelid='public.brand_learnings'::regclass AND c.contype='c'
      AND c.convalidated AND md5(pg_get_expr(c.conbin,c.conrelid))=expected.hash) AND (SELECT count(*)=3 FROM pg_constraint c WHERE c.conrelid='public.brand_learnings'::regclass AND c.contype='c' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname IN ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'))) AS exact_bounded_column_checks,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_trigger t ON t.tgfoid=p.oid
      WHERE p.oid=to_regprocedure('public.guard_brand_learning_lifecycle()') AND md5(p.prosrc)='6827aa328af1fd2a8182920c83909a2f'
      AND t.tgrelid='public.brand_learnings'::regclass AND t.tgname='brand_learning_lifecycle' AND t.tgtype=23 AND t.tgenabled='O'
      AND p.proconfig=ARRAY['search_path=pg_catalog, public'] AND NOT p.prosecdef
      AND p.prorettype='trigger'::regtype AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND NOT t.tgisinternal AND t.tgqual IS NULL AND t.tgnargs=0 AND t.tgattr=''::int2vector) AS immutable_provenance_and_lifecycle,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass AND conname='brand_learning_events_snapshot_bounded'
      AND contype='c' AND convalidated AND md5(pg_get_expr(conbin,conrelid))='e0c26ef7b20efc51ed44395bed8e3c89') AND (SELECT count(*)=1 FROM pg_constraint c WHERE c.conrelid='public.brand_learning_events'::regclass AND c.contype='c' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) AND a.attname='snapshot')) AS exact_event_allowlist_and_bounds,
    (SELECT count(*)=4 FROM (VALUES
      ('public.brand_learnings','brand_learning_no_delete','public.guard_brand_learning_history()',11,'7a73a66fae205a2f93a9cad67fa3632f'),
      ('public.brand_learning_events','brand_learning_events_append_only','public.guard_brand_learning_history()',27,'7a73a66fae205a2f93a9cad67fa3632f'),
      ('public.brand_learnings','brand_learning_no_truncate','public.guard_brand_learning_truncate()',34,'0b3b00fcb4b9c56fe4e00336b948528f'),
      ('public.brand_learning_events','brand_learning_events_no_truncate','public.guard_brand_learning_truncate()',34,'0b3b00fcb4b9c56fe4e00336b948528f')
      ) expected(rel,name,func,kind,hash)
      JOIN pg_trigger t ON t.tgrelid=to_regclass(expected.rel) AND t.tgname=expected.name
      JOIN pg_proc p ON p.oid=t.tgfoid AND p.oid=to_regprocedure(expected.func)
      WHERE t.tgenabled='O' AND NOT t.tgisinternal AND t.tgtype=expected.kind
      AND t.tgqual IS NULL AND t.tgnargs=0 AND t.tgattr=''::int2vector AND md5(p.prosrc)=expected.hash
      AND NOT p.prosecdef AND p.prorettype='trigger'::regtype
      AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
      AND ((expected.kind=34 AND p.proconfig IS NULL) OR (expected.kind<>34 AND p.proconfig=ARRAY['search_path=pg_catalog, public']))) AS append_only_history_preserved,
    (SELECT count(*)=5 FROM pg_trigger WHERE tgrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND NOT tgisinternal) AS exact_trigger_inventory,
    NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid IN (to_regprocedure('public.guard_brand_learning_lifecycle()'),to_regprocedure('public.guard_brand_learning_history()'),to_regprocedure('public.guard_brand_learning_truncate()')) AND a.grantee=0)
    AND NOT EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) roles(name) CROSS JOIN
      (VALUES ('public.guard_brand_learning_lifecycle()'),('public.guard_brand_learning_history()'),('public.guard_brand_learning_truncate()')) funcs(name)
      WHERE has_function_privilege(roles.name,funcs.name,'EXECUTE')) AS guard_function_grants_closed,
    (SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS rls_enabled,
    NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)) AS no_browser_policies,
    NOT EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) roles(name) CROSS JOIN
      (VALUES ('public.brand_learnings'),('public.brand_learning_events')) tables(name)
      WHERE has_table_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,REFERENCES')) AS browser_grants_closed,
    NOT EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.grantee=0)
    AND NOT EXISTS (SELECT 1 FROM pg_attribute c, LATERAL aclexplode(c.attacl) a
      WHERE c.attrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.grantee=0) AS public_grants_closed,
    (SELECT count(*)=0 FROM public.brand_learnings l WHERE to_jsonb(l)->>'source_board_name_snapshot' IS NOT NULL
      OR to_jsonb(l)->>'source_node_title_snapshot' IS NOT NULL OR to_jsonb(l)->>'source_node_type_snapshot' IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.brand_learning_events e WHERE EXISTS (SELECT 1 FROM jsonb_each(e.snapshot) kv
      WHERE kv.key IN ('source_board_id','source_node_id','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot')
      AND kv.value <> 'null'::jsonb)) AS no_provenance_backfill

)
SELECT c.*, f.*,
  CASE WHEN NOT EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(c)) v WHERE v.value IS DISTINCT FROM 'true'::jsonb) THEN 'ok'
    ELSE 'not_ready' END AS overall_readiness
FROM checks c CROSS JOIN fingerprints f;
