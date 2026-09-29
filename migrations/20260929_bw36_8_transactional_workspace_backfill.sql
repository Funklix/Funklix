-- BW-36.8 refusal-first, one-transaction initial Workspace adoption.
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bw36_8_transactional_workspace_backfill', 368));

LOCK TABLE public.app_identities, public.workspaces, public.workspace_memberships,
  public.brands, public.brand_members, public.boards, public.board_editors
  IN SHARE ROW EXCLUSIVE MODE;

DO $bw36_8$
DECLARE
  v_now timestamptz := transaction_timestamp();
  v_bad bigint;
BEGIN
  -- This is deliberately re-read after all authority tables have been locked.
  IF to_regclass('public.app_identities') IS NULL
     OR to_regclass('public.workspaces') IS NULL
     OR to_regclass('public.workspace_memberships') IS NULL
     OR NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.app_identities'::regclass),false)
     OR NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.workspaces'::regclass),false)
     OR NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.workspace_memberships'::regclass),false)
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN ('app_identities','workspaces','workspace_memberships'))
     OR has_table_privilege('anon','public.workspaces','SELECT') OR has_table_privilege('authenticated','public.workspaces','SELECT')
     OR has_table_privilege('anon','public.workspace_memberships','SELECT') OR has_table_privilege('authenticated','public.workspace_memberships','SELECT')
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='workspaces' AND column_name='created_by_user_id') OR (table_name='workspace_memberships' AND column_name IN ('user_id','invited_by_user_id'))))
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE contype='f' AND conrelid IN ('public.workspaces'::regclass,'public.workspace_memberships'::regclass) AND confrelid='auth.users'::regclass)
     OR (SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.app_identities'::regclass AND conrelid IN ('public.workspaces'::regclass,'public.workspace_memberships'::regclass) AND confdeltype='r') <> 3
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.workspace_memberships'::regclass AND tgname='workspace_memberships_last_owner_guard' AND NOT tgisinternal AND pg_get_triggerdef(oid) LIKE '%identity_id%') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='bw36_8_schema_mismatch';
  END IF;

  -- Exact completed state is a bounded refusal; anything else nonzero is partial adoption.
  IF EXISTS(SELECT 1 FROM app_identities) OR EXISTS(SELECT 1 FROM workspaces) OR EXISTS(SELECT 1 FROM workspace_memberships)
     OR EXISTS(SELECT 1 FROM brands WHERE workspace_id IS NOT NULL) OR EXISTS(SELECT 1 FROM boards WHERE workspace_id IS NOT NULL) THEN
    IF (SELECT count(*) FROM app_identities)=6 AND (SELECT count(*) FROM workspaces)=5
       AND (SELECT count(*) FROM workspace_memberships)=6 AND (SELECT count(*) FROM brands WHERE workspace_id IS NOT NULL)=6
       AND (SELECT count(*) FROM boards WHERE workspace_id IS NOT NULL)=20
       AND (SELECT count(*) FROM workspace_memberships WHERE role='owner' AND status='accepted')=5
       AND (SELECT count(*) FROM workspace_memberships WHERE role='viewer' AND status='accepted')=1
       AND NOT EXISTS(SELECT 1 FROM boards b JOIN brands br ON br.id=b.brand_id WHERE b.workspace_id IS DISTINCT FROM br.workspace_id)
    THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='bw36_8_already_applied';
    ELSE RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='bw36_8_partial_adoption'; END IF;
  END IF;

  CREATE TEMP TABLE bw36_8_brand ON COMMIT DROP AS SELECT id, lower(btrim(owner_email)) owner_key FROM public.brands;
  CREATE TEMP TABLE bw36_8_board ON COMMIT DROP AS SELECT id, brand_id, lower(btrim(coalesce(nullif(owner_email,''),owner_id))) owner_key FROM public.boards;
  CREATE TEMP TABLE bw36_8_member ON COMMIT DROP AS SELECT brand_id, lower(btrim(email)) identity_key FROM public.brand_members;
  CREATE TEMP TABLE bw36_8_share ON COMMIT DROP AS SELECT board_id, lower(btrim(email)) identity_key, role FROM public.board_editors;
  CREATE TEMP TABLE bw36_8_owner ON COMMIT DROP AS SELECT owner_key FROM bw36_8_brand UNION SELECT owner_key FROM bw36_8_board;
  CREATE TEMP TABLE bw36_8_identity ON COMMIT DROP AS SELECT owner_key identity_key FROM bw36_8_owner UNION SELECT identity_key FROM bw36_8_member;
  CREATE TEMP TABLE bw36_8_preserve ON COMMIT DROP AS SELECT
    (SELECT md5(string_agg(id::text||':'||owner_email,',' ORDER BY id)) FROM brands) brand_owners,
    (SELECT md5(string_agg(brand_id::text||':'||email||':'||role,',' ORDER BY brand_id,email)) FROM brand_members) brand_members,
    (SELECT md5(string_agg(id::text||':'||coalesce(owner_email,owner_id),',' ORDER BY id)) FROM boards) board_owners,
    (SELECT md5(string_agg(board_id::text||':'||email||':'||role,',' ORDER BY board_id,email)) FROM board_editors) board_shares,
    (SELECT md5(string_agg(id::text||':'||coalesce(brand_core_snapshot::text,'null'),',' ORDER BY id)) FROM boards) snapshots,
    (SELECT md5(string_agg(id::text||':'||public_view_enabled::text,',' ORDER BY id)) FROM boards) tokens;

  SELECT count(*) INTO v_bad FROM (
    SELECT owner_key k FROM bw36_8_owner UNION ALL SELECT identity_key FROM bw36_8_member
  ) s WHERE k IS NULL OR k='' OR k !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
  IF v_bad<>0 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='bw36_8_unsupported_identity'; END IF;
  IF EXISTS(SELECT 1 FROM bw36_8_member GROUP BY brand_id,identity_key HAVING count(*)>1)
     OR EXISTS(SELECT 1 FROM bw36_8_share GROUP BY board_id,identity_key HAVING count(*)>1) THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='bw36_8_normalized_collision';
  END IF;
  IF (SELECT count(*) FROM brands)<>6 OR (SELECT count(*) FROM boards)<>20
     OR (SELECT count(*) FROM boards WHERE brand_id IS NOT NULL)<>6 OR (SELECT count(*) FROM boards WHERE brand_id IS NULL)<>14
     OR (SELECT count(*) FROM boards WHERE brand_id IS NULL AND brand_core_snapshot IS NOT NULL)<>14
     OR (SELECT count(*) FROM brand_members)<>1 OR (SELECT count(*) FROM board_editors)<>11
     OR (SELECT count(*) FROM boards WHERE public_view_enabled)<>1 OR (SELECT count(*) FROM bw36_8_owner)<>5
     OR (SELECT count(*) FROM bw36_8_identity)<>6
     OR EXISTS(SELECT 1 FROM bw36_8_board b WHERE b.brand_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM bw36_8_brand br WHERE br.id=b.brand_id))
     OR EXISTS(SELECT 1 FROM bw36_8_board b JOIN bw36_8_brand br ON br.id=b.brand_id WHERE b.owner_key<>br.owner_key)
     OR (SELECT count(*) FROM (SELECT DISTINCT br.owner_key,m.identity_key FROM bw36_8_member m JOIN bw36_8_brand br ON br.id=m.brand_id WHERE m.identity_key<>br.owner_key) x)<>1
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='bw36_8_source_counts_changed'; END IF;

  ALTER TABLE bw36_8_identity ADD COLUMN identity_id uuid;
  UPDATE bw36_8_identity SET identity_id=gen_random_uuid();
  INSERT INTO app_identities(id,canonical_email,status,revision,created_at,updated_at)
    SELECT identity_id,identity_key,'active',0,v_now,v_now FROM bw36_8_identity;
  ALTER TABLE bw36_8_owner ADD COLUMN workspace_id uuid, ADD COLUMN identity_id uuid;
  UPDATE bw36_8_owner o SET workspace_id=gen_random_uuid(), identity_id=i.identity_id FROM bw36_8_identity i WHERE i.identity_key=o.owner_key;
  INSERT INTO workspaces(id,name,locale,status,revision,created_by_identity_id,created_at,updated_at)
    SELECT workspace_id,'My Workspace','en','active',1,identity_id,v_now,v_now FROM bw36_8_owner;
  INSERT INTO workspace_memberships(workspace_id,identity_id,role,status,revision,created_at,updated_at)
    SELECT workspace_id,identity_id,'owner','accepted',1,v_now,v_now FROM bw36_8_owner;
  INSERT INTO workspace_memberships(workspace_id,identity_id,role,status,revision,created_at,updated_at)
    SELECT DISTINCT o.workspace_id,i.identity_id,'viewer','accepted',1,v_now,v_now
    FROM bw36_8_member m JOIN bw36_8_brand br ON br.id=m.brand_id JOIN bw36_8_owner o ON o.owner_key=br.owner_key JOIN bw36_8_identity i ON i.identity_key=m.identity_key
    WHERE i.identity_id<>o.identity_id;
  UPDATE brands b SET workspace_id=o.workspace_id FROM bw36_8_brand s JOIN bw36_8_owner o ON o.owner_key=s.owner_key WHERE b.id=s.id;
  UPDATE boards b SET workspace_id=CASE WHEN b.brand_id IS NOT NULL THEN br.workspace_id ELSE o.workspace_id END
    FROM bw36_8_board s JOIN bw36_8_owner o ON o.owner_key=s.owner_key LEFT JOIN brands br ON br.id=s.brand_id WHERE b.id=s.id;

  -- Final blockers: quarantine_records=0, access_expansion_cases=0, access_loss_cases=0,
  -- brand_assignments_with_cross_workspace_inconsistency=0, board_assignments_with_cross_workspace_inconsistency=0.
  IF (SELECT count(*) FROM app_identities)<>6 OR EXISTS(SELECT 1 FROM app_identities WHERE status<>'active')
     OR (SELECT count(*) FROM workspaces)<>5 OR (SELECT count(*) FROM workspace_memberships)<>6
     OR (SELECT count(*) FROM workspace_memberships WHERE role='owner' AND status='accepted')<>5
     OR (SELECT count(*) FROM workspace_memberships WHERE role='viewer' AND status='accepted')<>1
     OR (SELECT count(*) FROM brands WHERE workspace_id IS NOT NULL)<>6 OR (SELECT count(*) FROM boards WHERE workspace_id IS NOT NULL)<>20
     OR (SELECT count(*) FROM boards WHERE brand_id IS NOT NULL)<>6 OR (SELECT count(*) FROM boards WHERE brand_id IS NULL)<>14
     OR EXISTS(SELECT 1 FROM boards b JOIN brands br ON br.id=b.brand_id WHERE b.workspace_id IS DISTINCT FROM br.workspace_id)
     OR EXISTS(SELECT 1 FROM workspaces w WHERE (SELECT count(*) FROM workspace_memberships m WHERE m.workspace_id=w.id AND m.role='owner' AND m.status='accepted')<>1)
     OR EXISTS(SELECT 1 FROM workspaces w LEFT JOIN app_identities a ON a.id=w.created_by_identity_id WHERE a.id IS NULL)
     OR EXISTS(SELECT 1 FROM workspace_memberships m LEFT JOIN app_identities a ON a.id=m.identity_id WHERE a.id IS NULL)
     OR EXISTS(SELECT 1 FROM brands b LEFT JOIN workspaces w ON w.id=b.workspace_id WHERE w.id IS NULL)
     OR EXISTS(SELECT 1 FROM boards b LEFT JOIN workspaces w ON w.id=b.workspace_id WHERE w.id IS NULL)
     OR EXISTS(SELECT 1 FROM bw36_8_preserve p WHERE p.brand_owners IS DISTINCT FROM (SELECT md5(string_agg(id::text||':'||owner_email,',' ORDER BY id)) FROM brands) OR p.brand_members IS DISTINCT FROM (SELECT md5(string_agg(brand_id::text||':'||email||':'||role,',' ORDER BY brand_id,email)) FROM brand_members) OR p.board_owners IS DISTINCT FROM (SELECT md5(string_agg(id::text||':'||coalesce(owner_email,owner_id),',' ORDER BY id)) FROM boards) OR p.board_shares IS DISTINCT FROM (SELECT md5(string_agg(board_id::text||':'||email||':'||role,',' ORDER BY board_id,email)) FROM board_editors) OR p.snapshots IS DISTINCT FROM (SELECT md5(string_agg(id::text||':'||coalesce(brand_core_snapshot::text,'null'),',' ORDER BY id)) FROM boards) OR p.tokens IS DISTINCT FROM (SELECT md5(string_agg(id::text||':'||public_view_enabled::text,',' ORDER BY id)) FROM boards))
  THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='bw36_8_final_validation_failed'; END IF;
END
$bw36_8$;

SELECT 'workspace_backfill'::text category, 'ok'::text status, 6::bigint identities_created,
  5::bigint workspaces_created, 6::bigint memberships_created, 6::bigint brands_assigned, 20::bigint boards_assigned;
COMMIT;
