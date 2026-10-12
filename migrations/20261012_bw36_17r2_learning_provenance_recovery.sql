-- BW-36.17R2: run the complete file once after merge, then run R2 verification unchanged.
-- No staging table, application activation, row mutation or backfill.
BEGIN;
DO $recovery$
DECLARE
  source_att smallint; board_att smallint; fk_name text; snapshot_att smallint; event_check text;
  current_state record; before_state record; original_relationships boolean;
BEGIN
  IF to_regclass('public.brand_learnings') IS NULL OR to_regclass('public.brand_learning_events') IS NULL
    OR to_regclass('public.boards') IS NULL OR to_regclass('public.brands') IS NULL
    OR to_regclass('public.app_identities') IS NULL THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  -- Lock before classification/baseline: prevent concurrent lifecycle writes and source/owner deletion.
  LOCK TABLE public.brands, public.boards, public.brand_learnings, public.brand_learning_events IN ACCESS EXCLUSIVE MODE;
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
SELECT c.*, f.* INTO current_state FROM checks c CROSS JOIN fingerprints f;
  IF NOT EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(current_state) - ARRAY['learning_count','learning_fingerprint','event_count','event_fingerprint']) kv WHERE kv.value IS DISTINCT FROM 'true'::jsonb) THEN
    RAISE NOTICE 'bw36_17r2_already_ready';
    RETURN;
  END IF;
  -- State B was not exact. Accept only the untouched State A; all mixtures refuse before DDL.
  IF NOT (current_state.guard_function_grants_closed IS TRUE AND current_state.exact_base_columns IS TRUE AND current_state.exact_base_checks IS TRUE AND current_state.exact_base_indexes IS TRUE AND current_state.source_uuid_preserved IS TRUE AND current_state.brand_ownership_cascade IS TRUE AND current_state.append_only_history_preserved IS TRUE AND current_state.exact_trigger_inventory IS TRUE AND current_state.rls_enabled IS TRUE AND current_state.no_browser_policies IS TRUE AND current_state.browser_grants_closed IS TRUE AND current_state.public_grants_closed IS TRUE AND current_state.no_provenance_backfill IS TRUE) THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
SELECT (SELECT bool_and(matches.n=1) FROM (VALUES
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
      AND (SELECT count(*)=8 FROM pg_constraint WHERE conrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND contype='f') INTO original_relationships;
  IF original_relationships IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  SELECT attnum INTO source_att FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass
    AND attname='source_board_id' AND atttypid='uuid'::regtype AND NOT attisdropped;
  SELECT attnum INTO board_att FROM pg_attribute WHERE attrelid='public.boards'::regclass
    AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped;
  IF source_att IS NULL OR board_att IS NULL OR EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid='public.brand_learnings'::regclass AND attname IN
    ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.brand_learnings'::regclass AND contype='f'
    AND source_att = ANY(conkey)) <> 1 THEN RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema'; END IF;
  SELECT conname INTO fk_name FROM pg_constraint WHERE conrelid='public.brand_learnings'::regclass AND contype='f'
    AND conkey=ARRAY[source_att] AND confrelid='public.boards'::regclass AND confkey=ARRAY[board_att]
    AND confdeltype='n' AND confupdtype='a' AND confmatchtype='s' AND convalidated AND NOT condeferrable AND NOT condeferred;
  IF fk_name IS NULL THEN RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_brand_learning_lifecycle()')
    AND btrim(prosrc)=btrim($expected$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'proposed' OR NEW.revision <> 0 THEN RAISE EXCEPTION 'learning_insert_state'; END IF;
  ELSE
    IF NEW.id <> OLD.id OR NEW.brand_id <> OLD.brand_id OR NEW.proposed_by_identity_id <> OLD.proposed_by_identity_id
      OR NEW.created_at <> OLD.created_at OR NEW.source_type <> OLD.source_type
      OR NEW.source_board_id IS DISTINCT FROM OLD.source_board_id
      OR NEW.source_node_id IS DISTINCT FROM OLD.source_node_id
      OR NEW.supersedes_learning_id IS DISTINCT FROM OLD.supersedes_learning_id
      OR NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'learning_revision_or_ownership'; END IF;
    IF NOT ((OLD.status = 'proposed' AND NEW.status IN ('proposed','approved','rejected'))
      OR (OLD.status = 'approved' AND NEW.status = 'archived')) THEN RAISE EXCEPTION 'learning_transition'; END IF;
    IF OLD.status <> 'proposed' AND (NEW.statement <> OLD.statement OR NEW.statement_key <> OLD.statement_key
      OR NEW.evidence_summary IS DISTINCT FROM OLD.evidence_summary
      OR NEW.reviewed_by_identity_id IS DISTINCT FROM OLD.reviewed_by_identity_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'learning_approved_immutable'; END IF;
  END IF;
  RETURN NEW;
END $expected$))
    OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND
      ((tgrelid='public.brand_learnings'::regclass AND tgname IN ('brand_learning_lifecycle','brand_learning_no_delete','brand_learning_no_truncate'))
      OR (tgrelid='public.brand_learning_events'::regclass AND tgname IN ('brand_learning_events_append_only','brand_learning_events_no_truncate')))) <> 5
    OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.brand_learnings'::regclass
      AND tgname='brand_learning_lifecycle' AND tgfoid=to_regprocedure('public.guard_brand_learning_lifecycle()') AND tgtype=23
      AND tgenabled='O' AND NOT tgisinternal AND tgqual IS NULL AND tgnargs=0 AND tgattr=''::int2vector) THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_brand_learning_history()') AND md5(prosrc)='7a73a66fae205a2f93a9cad67fa3632f')
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_brand_learning_truncate()') AND md5(prosrc)='0b3b00fcb4b9c56fe4e00336b948528f') THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass)
    AND contype='f' AND confrelid='public.brands'::regclass AND confdeltype='c' AND convalidated
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=conrelid AND attname='brand_id' AND NOT attisdropped)]
    AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.brands'::regclass AND attname='id' AND NOT attisdropped)]) <> 2
    OR (SELECT count(*) FROM pg_class WHERE oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND relrowsecurity) <> 2
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass))
    OR EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid IN ('public.brand_learnings'::regclass,'public.brand_learning_events'::regclass) AND a.grantee=0)
    OR EXISTS (SELECT 1 FROM (VALUES ('anon'),('authenticated')) roles(name) CROSS JOIN
      (VALUES ('public.brand_learnings'),('public.brand_learning_events')) tables(name)
      WHERE has_any_column_privilege(roles.name,tables.name,'SELECT,INSERT,UPDATE,REFERENCES'))
    OR has_table_privilege('anon','public.brand_learnings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated','public.brand_learnings','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('anon','public.brand_learning_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_table_privilege('authenticated','public.brand_learning_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  SELECT attnum INTO snapshot_att FROM pg_attribute WHERE attrelid='public.brand_learning_events'::regclass AND attname='snapshot' AND atttypid='jsonb'::regtype;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass
    AND contype='c' AND conkey=ARRAY[snapshot_att] AND convalidated) <> 1 THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  -- Pin the complete original CHECK expression, including its closed key allowlist.
  -- Catalog names are discovered; unexpected schema/deparser output refuses safely.
  SELECT conname INTO event_check FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass
    AND contype='c' AND conkey=ARRAY[snapshot_att] AND convalidated
    AND md5(pg_get_expr(conbin,conrelid))='6565df72e7b93bcb8cdd4055c4620cd4';
  IF event_check IS NULL THEN RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.guard_brand_learning_lifecycle()') AND NOT p.prosecdef AND p.prorettype='trigger'::regtype AND p.proconfig=ARRAY['search_path=pg_catalog, public'] AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  before_state := current_state;
  EXECUTE format('ALTER TABLE public.brand_learnings DROP CONSTRAINT %I',fk_name);
  EXECUTE format('ALTER TABLE public.brand_learning_events DROP CONSTRAINT %I',event_check);
ALTER TABLE public.brand_learnings
  ADD COLUMN source_board_name_snapshot text CONSTRAINT brand_learnings_source_board_name_snapshot_bounded CHECK (source_board_name_snapshot IS NULL OR (char_length(source_board_name_snapshot) BETWEEN 1 AND 200 AND source_board_name_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_board_name_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> '')),
  ADD COLUMN source_node_title_snapshot text CONSTRAINT brand_learnings_source_node_title_snapshot_bounded CHECK (source_node_title_snapshot IS NULL OR (char_length(source_node_title_snapshot) BETWEEN 1 AND 300 AND source_node_title_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_node_title_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> '')),
  ADD COLUMN source_node_type_snapshot text CONSTRAINT brand_learnings_source_node_type_snapshot_bounded CHECK (source_node_type_snapshot IS NULL OR (char_length(source_node_type_snapshot) BETWEEN 1 AND 100 AND source_node_type_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_node_type_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> ''));

EXECUTE $definition$CREATE OR REPLACE FUNCTION public.guard_brand_learning_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $lifecycle$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'proposed' OR NEW.revision <> 0 THEN RAISE EXCEPTION 'learning_insert_state'; END IF;
  ELSE
    IF NEW.id <> OLD.id OR NEW.brand_id <> OLD.brand_id OR NEW.proposed_by_identity_id <> OLD.proposed_by_identity_id
      OR NEW.created_at <> OLD.created_at OR NEW.source_type <> OLD.source_type
      OR NEW.source_board_id IS DISTINCT FROM OLD.source_board_id
      OR NEW.source_node_id IS DISTINCT FROM OLD.source_node_id
      OR NEW.source_board_name_snapshot IS DISTINCT FROM OLD.source_board_name_snapshot
      OR NEW.source_node_title_snapshot IS DISTINCT FROM OLD.source_node_title_snapshot
      OR NEW.source_node_type_snapshot IS DISTINCT FROM OLD.source_node_type_snapshot
      OR NEW.supersedes_learning_id IS DISTINCT FROM OLD.supersedes_learning_id
      OR NEW.revision <> OLD.revision + 1 THEN RAISE EXCEPTION 'learning_revision_or_ownership'; END IF;
    IF NOT ((OLD.status = 'proposed' AND NEW.status IN ('proposed','approved','rejected'))
      OR (OLD.status = 'approved' AND NEW.status = 'archived')) THEN RAISE EXCEPTION 'learning_transition'; END IF;
    IF OLD.status <> 'proposed' AND (NEW.statement <> OLD.statement OR NEW.statement_key <> OLD.statement_key
      OR NEW.evidence_summary IS DISTINCT FROM OLD.evidence_summary
      OR NEW.reviewed_by_identity_id IS DISTINCT FROM OLD.reviewed_by_identity_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN RAISE EXCEPTION 'learning_approved_immutable'; END IF;
  END IF;
  RETURN NEW;
END $lifecycle$;$definition$;

ALTER TABLE public.brand_learning_events ADD CONSTRAINT brand_learning_events_snapshot_bounded CHECK (
    jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 40000
    AND snapshot ?& ARRAY['statement','source_type']
    AND jsonb_typeof(snapshot->'statement') = 'string'
    AND char_length(snapshot->>'statement') BETWEEN 1 AND 2000
    AND jsonb_typeof(snapshot->'source_type') = 'string'
    AND snapshot->>'source_type' IN ('manual','campaign_observation','ai_suggestion')
    AND (snapshot->>'evidence_summary' IS NULL OR (jsonb_typeof(snapshot->'evidence_summary') = 'string' AND char_length(snapshot->>'evidence_summary') BETWEEN 1 AND 4000))
    AND (snapshot->>'supersedes_learning_id' IS NULL OR (jsonb_typeof(snapshot->'supersedes_learning_id') = 'string' AND snapshot->>'supersedes_learning_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
    AND (NOT snapshot ? 'source_board_id' OR jsonb_typeof(snapshot->'source_board_id') = 'null' OR (jsonb_typeof(snapshot->'source_board_id') = 'string' AND snapshot->>'source_board_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
    AND (NOT snapshot ? 'source_node_id' OR jsonb_typeof(snapshot->'source_node_id') = 'null' OR (jsonb_typeof(snapshot->'source_node_id') = 'string' AND snapshot->>'source_node_id' ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
    AND (NOT snapshot ? 'source_board_name_snapshot' OR jsonb_typeof(snapshot->'source_board_name_snapshot') = 'null' OR (jsonb_typeof(snapshot->'source_board_name_snapshot') = 'string' AND char_length((snapshot->>'source_board_name_snapshot')) BETWEEN 1 AND 200 AND (snapshot->>'source_board_name_snapshot') !~ '[[:cntrl:]]' AND regexp_replace((snapshot->>'source_board_name_snapshot'), '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> ''))
    AND (NOT snapshot ? 'source_node_title_snapshot' OR jsonb_typeof(snapshot->'source_node_title_snapshot') = 'null' OR (jsonb_typeof(snapshot->'source_node_title_snapshot') = 'string' AND char_length((snapshot->>'source_node_title_snapshot')) BETWEEN 1 AND 300 AND (snapshot->>'source_node_title_snapshot') !~ '[[:cntrl:]]' AND regexp_replace((snapshot->>'source_node_title_snapshot'), '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> ''))
    AND (NOT snapshot ? 'source_node_type_snapshot' OR jsonb_typeof(snapshot->'source_node_type_snapshot') = 'null' OR (jsonb_typeof(snapshot->'source_node_type_snapshot') = 'string' AND char_length((snapshot->>'source_node_type_snapshot')) BETWEEN 1 AND 100 AND (snapshot->>'source_node_type_snapshot') !~ '[[:cntrl:]]' AND regexp_replace((snapshot->>'source_node_type_snapshot'), '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> ''))
    AND (snapshot - ARRAY['statement','evidence_summary','source_type','supersedes_learning_id','source_board_id','source_node_id','source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot']) = '{}'::jsonb
);

  -- Reinspect the exact final contract and comparable fingerprints while locks remain held.
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
SELECT c.*, f.* INTO current_state FROM checks c CROSS JOIN fingerprints f;
  IF current_state.learning_count IS DISTINCT FROM before_state.learning_count
    OR current_state.learning_fingerprint IS DISTINCT FROM before_state.learning_fingerprint
    OR current_state.event_count IS DISTINCT FROM before_state.event_count
    OR current_state.event_fingerprint IS DISTINCT FROM before_state.event_fingerprint THEN
    RAISE EXCEPTION 'bw36_17r2_preservation_failed';
  END IF;
  IF NOT (NOT EXISTS (SELECT 1 FROM jsonb_each(to_jsonb(current_state) - ARRAY['learning_count','learning_fingerprint','event_count','event_fingerprint']) kv WHERE kv.value IS DISTINCT FROM 'true'::jsonb)) THEN
    RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
  END IF;
  RAISE NOTICE 'bw36_17r2_upgraded_preserved';
EXCEPTION WHEN OTHERS THEN
  -- Do not leak row values, catalog identifiers or underlying constraint details.
  IF SQLERRM = 'bw36_17r2_preservation_failed' THEN
    RAISE EXCEPTION 'bw36_17r2_preservation_failed';
  END IF;
  RAISE EXCEPTION 'bw36_17r2_partial_or_conflicting_schema';
END $recovery$;
COMMIT;
