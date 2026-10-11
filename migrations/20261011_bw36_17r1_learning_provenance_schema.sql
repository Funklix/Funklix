-- BW-36.17R1: execute the complete forward migration exactly once after merge.
-- No application activation, production execution, row rewrite or backfill.
BEGIN;
DO $preflight$
DECLARE source_att smallint; board_att smallint; fk_name text; snapshot_att smallint; event_check text;
BEGIN
  IF to_regclass('public.brand_learnings') IS NULL OR to_regclass('public.brand_learning_events') IS NULL
    OR to_regclass('public.boards') IS NULL OR to_regclass('public.brands') IS NULL THEN
    RAISE EXCEPTION 'bw36_17r1_schema_missing';
  END IF;
  -- Freeze lifecycle writes and Board deletion while catalog evidence is checked.
  LOCK TABLE public.brands, public.boards, public.brand_learnings, public.brand_learning_events IN ACCESS EXCLUSIVE MODE;
  SELECT attnum INTO source_att FROM pg_attribute WHERE attrelid='public.brand_learnings'::regclass
    AND attname='source_board_id' AND atttypid='uuid'::regtype AND NOT attisdropped;
  SELECT attnum INTO board_att FROM pg_attribute WHERE attrelid='public.boards'::regclass
    AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped;
  IF source_att IS NULL OR board_att IS NULL OR EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid='public.brand_learnings'::regclass AND attname IN
    ('source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot') AND NOT attisdropped) THEN
    RAISE EXCEPTION 'bw36_17r1_unexpected_or_already_applied';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.brand_learnings'::regclass AND contype='f'
    AND source_att = ANY(conkey)) <> 1 THEN RAISE EXCEPTION 'bw36_17r1_source_fk_mismatch'; END IF;
  SELECT conname INTO fk_name FROM pg_constraint WHERE conrelid='public.brand_learnings'::regclass AND contype='f'
    AND conkey=ARRAY[source_att] AND confrelid='public.boards'::regclass AND confkey=ARRAY[board_att]
    AND confdeltype='n' AND confupdtype='a' AND convalidated AND NOT condeferrable;
  IF fk_name IS NULL THEN RAISE EXCEPTION 'bw36_17r1_source_fk_mismatch'; END IF;
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
      AND tgname='brand_learning_lifecycle' AND tgfoid=to_regprocedure('public.guard_brand_learning_lifecycle()') AND tgtype=23) THEN
    RAISE EXCEPTION 'bw36_17r1_lifecycle_mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_brand_learning_history()') AND md5(prosrc)='7a73a66fae205a2f93a9cad67fa3632f')
    OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.guard_brand_learning_truncate()') AND md5(prosrc)='0b3b00fcb4b9c56fe4e00336b948528f') THEN
    RAISE EXCEPTION 'bw36_17r1_history_mismatch';
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
    RAISE EXCEPTION 'bw36_17r1_governance_mismatch';
  END IF;
  SELECT attnum INTO snapshot_att FROM pg_attribute WHERE attrelid='public.brand_learning_events'::regclass AND attname='snapshot' AND atttypid='jsonb'::regtype;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass
    AND contype='c' AND conkey=ARRAY[snapshot_att] AND convalidated) <> 1 THEN
    RAISE EXCEPTION 'bw36_17r1_event_check_mismatch';
  END IF;
  -- Pin the complete original CHECK expression, including its closed key allowlist.
  -- Catalog names are discovered; unexpected schema/deparser output refuses safely.
  SELECT conname INTO event_check FROM pg_constraint WHERE conrelid='public.brand_learning_events'::regclass
    AND contype='c' AND conkey=ARRAY[snapshot_att] AND convalidated
    AND md5(pg_get_expr(conbin,conrelid))='6565df72e7b93bcb8cdd4055c4620cd4';
  IF event_check IS NULL THEN RAISE EXCEPTION 'bw36_17r1_event_check_mismatch'; END IF;
  EXECUTE format('ALTER TABLE public.brand_learnings DROP CONSTRAINT %I',fk_name);
  EXECUTE format('ALTER TABLE public.brand_learning_events DROP CONSTRAINT %I',event_check);
END $preflight$;

-- Transaction-local preservation evidence excludes only the three newly added nullable columns.
CREATE TEMP TABLE bw36_17r1_preservation ON COMMIT DROP AS
SELECT 'learnings' AS entity, count(*) AS n, md5(coalesce(string_agg(md5(to_jsonb(l)::text),'' ORDER BY l.id),'')) AS fingerprint FROM public.brand_learnings l
UNION ALL SELECT 'events', count(*), md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' ORDER BY e.id),'')) FROM public.brand_learning_events e;

ALTER TABLE public.brand_learnings
  ADD COLUMN source_board_name_snapshot text CONSTRAINT brand_learnings_source_board_name_snapshot_bounded CHECK (source_board_name_snapshot IS NULL OR (char_length(source_board_name_snapshot) BETWEEN 1 AND 200 AND source_board_name_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_board_name_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> '')),
  ADD COLUMN source_node_title_snapshot text CONSTRAINT brand_learnings_source_node_title_snapshot_bounded CHECK (source_node_title_snapshot IS NULL OR (char_length(source_node_title_snapshot) BETWEEN 1 AND 300 AND source_node_title_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_node_title_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> '')),
  ADD COLUMN source_node_type_snapshot text CONSTRAINT brand_learnings_source_node_type_snapshot_bounded CHECK (source_node_type_snapshot IS NULL OR (char_length(source_node_type_snapshot) BETWEEN 1 AND 100 AND source_node_type_snapshot !~ '[[:cntrl:]]' AND regexp_replace(source_node_type_snapshot, '[[:space:][:cntrl:]  -     　﻿]', '', 'g') <> ''));

CREATE OR REPLACE FUNCTION public.guard_brand_learning_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $lifecycle$
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
END $lifecycle$;

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

DO $preserve$
BEGIN
  IF EXISTS (
    (SELECT * FROM bw36_17r1_preservation EXCEPT (
      SELECT 'learnings', count(*), md5(coalesce(string_agg(md5((to_jsonb(l) - ARRAY['source_board_name_snapshot','source_node_title_snapshot','source_node_type_snapshot'])::text),'' ORDER BY l.id),'')) FROM public.brand_learnings l
      UNION ALL SELECT 'events', count(*), md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' ORDER BY e.id),'')) FROM public.brand_learning_events e))
  ) THEN RAISE EXCEPTION 'bw36_17r1_preservation_failed'; END IF;
END $preserve$;
COMMIT;
