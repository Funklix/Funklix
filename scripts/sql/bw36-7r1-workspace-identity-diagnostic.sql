-- BW-36.7R1 Workspace identity diagnostic.
-- Read-only, aggregate-only evidence query for one manual Supabase SQL Editor run.
-- The application authenticates with a signed Google session whose canonical authority is
-- lower(trim(session user email)); it does not persist an application user/profile table.
WITH
schema_columns AS (
  SELECT table_schema, table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE (table_schema = 'public' AND table_name IN ('brands','brand_members','boards','board_editors'))
     OR (table_schema = 'auth' AND table_name = 'users' AND column_name IN ('id','email'))
),
schema_constraints AS (
  SELECT tc.table_name, tc.constraint_type, kcu.column_name
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema AND kcu.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.table_name IN ('brands','brand_members','boards','board_editors')
),
schema_indexes AS (
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN ('brands','brand_members','boards','board_editors')
),
auth_email_counts AS (
  -- auth.users is measured only as the authority assumed by BW-36.7, not as application authority.
  SELECT lower(btrim(email)) AS identity_key, count(*)::bigint AS matches
  FROM auth.users
  WHERE email IS NOT NULL AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
),
auth_uuid_counts AS (
  SELECT id::text AS identity_key, count(*)::bigint AS matches
  FROM auth.users
  GROUP BY id::text
),
brand_owner_rel AS (
  SELECT 'brand_owner'::text AS relation_type, b.id::text AS entity_key,
    b.owner_email::text AS stored_identity, lower(btrim(b.owner_email)) AS normalized_identity,
    b.owner_email IS NOT NULL AND btrim(b.owner_email) <> '' AS nonempty,
    b.owner_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AS email_shape,
    b.owner_email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS uuid_shape,
    coalesce(a.matches,0)::bigint AS auth_email_matches, 0::bigint AS auth_uuid_matches
  FROM public.brands b
  LEFT JOIN auth_email_counts a ON a.identity_key = lower(btrim(b.owner_email))
),
brand_member_rel AS (
  SELECT 'brand_member'::text AS relation_type, (bm.brand_id::text || ':' || bm.email)::text AS entity_key,
    bm.email::text AS stored_identity, lower(btrim(bm.email)) AS normalized_identity,
    bm.email IS NOT NULL AND btrim(bm.email) <> '' AS nonempty,
    bm.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AS email_shape,
    bm.email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS uuid_shape,
    coalesce(a.matches,0)::bigint AS auth_email_matches, 0::bigint AS auth_uuid_matches,
    bm.brand_id, bm.role, (b.id IS NOT NULL) AS parent_exists
  FROM public.brand_members bm
  LEFT JOIN public.brands b ON b.id = bm.brand_id
  LEFT JOIN auth_email_counts a ON a.identity_key = lower(btrim(bm.email))
),
board_owner_rel AS (
  SELECT 'board_owner'::text AS relation_type, bo.id::text AS entity_key,
    coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),''))::text AS stored_identity,
    lower(coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),''))) AS normalized_identity,
    coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),'')) IS NOT NULL AS nonempty,
    coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),'')) ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AS email_shape,
    coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),'')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS uuid_shape,
    coalesce(a.matches,0)::bigint AS auth_email_matches, coalesce(u.matches,0)::bigint AS auth_uuid_matches,
    bo.owner_email, bo.owner_id, bo.brand_id, bo.public_view_enabled,
    (br.id IS NOT NULL) AS brand_exists
  FROM public.boards bo
  LEFT JOIN public.brands br ON br.id = bo.brand_id
  LEFT JOIN auth_email_counts a ON a.identity_key = lower(coalesce(nullif(btrim(bo.owner_email),''),nullif(btrim(bo.owner_id),'')))
  LEFT JOIN auth_uuid_counts u ON u.identity_key = coalesce(nullif(btrim(bo.owner_id),''),nullif(btrim(bo.owner_email),''))
),
board_share_rel AS (
  SELECT 'board_share'::text AS relation_type, (be.board_id::text || ':' || be.email)::text AS entity_key,
    be.email::text AS stored_identity, lower(btrim(be.email)) AS normalized_identity,
    be.email IS NOT NULL AND btrim(be.email) <> '' AS nonempty,
    be.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' AS email_shape,
    be.email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AS uuid_shape,
    coalesce(a.matches,0)::bigint AS auth_email_matches, 0::bigint AS auth_uuid_matches,
    be.board_id, be.role, bo.brand_id, (bo.id IS NOT NULL) AS parent_exists
  FROM public.board_editors be
  LEFT JOIN public.boards bo ON bo.id = be.board_id
  LEFT JOIN auth_email_counts a ON a.identity_key = lower(btrim(be.email))
),
all_relationships AS (
  SELECT relation_type,entity_key,stored_identity,normalized_identity,nonempty,email_shape,uuid_shape,auth_email_matches,auth_uuid_matches FROM brand_owner_rel
  UNION ALL SELECT relation_type,entity_key,stored_identity,normalized_identity,nonempty,email_shape,uuid_shape,auth_email_matches,auth_uuid_matches FROM brand_member_rel
  UNION ALL SELECT relation_type,entity_key,stored_identity,normalized_identity,nonempty,email_shape,uuid_shape,auth_email_matches,auth_uuid_matches FROM board_owner_rel
  UNION ALL SELECT relation_type,entity_key,stored_identity,normalized_identity,nonempty,email_shape,uuid_shape,auth_email_matches,auth_uuid_matches FROM board_share_rel
),
shape_rollup AS (
  SELECT relation_type, count(*)::bigint total,
    count(*) FILTER (WHERE nonempty)::bigint nonempty,
    count(*) FILTER (WHERE NOT nonempty)::bigint empty,
    count(*) FILTER (WHERE nonempty AND email_shape)::bigint email_shaped,
    count(*) FILTER (WHERE nonempty AND uuid_shape)::bigint uuid_shaped,
    count(*) FILTER (WHERE nonempty AND NOT email_shape AND NOT uuid_shape)::bigint unsupported_shaped,
    count(DISTINCT normalized_identity) FILTER (WHERE nonempty)::bigint distinct_normalized
  FROM all_relationships GROUP BY relation_type
),
normalized_duplicate_rollup AS (
  SELECT relation_type, coalesce(sum(n),0)::bigint AS duplicate_records
  FROM (SELECT relation_type, normalized_identity, count(*)::bigint n FROM all_relationships
        WHERE nonempty GROUP BY relation_type, normalized_identity HAVING count(*) > 1) d
  GROUP BY relation_type
),
resolution_rollup AS (
  SELECT relation_type,
    count(*) FILTER (WHERE nonempty AND email_shape AND stored_identity = normalized_identity)::bigint exact_canonical,
    count(*) FILTER (WHERE nonempty AND email_shape AND stored_identity <> normalized_identity)::bigint normalized_only,
    count(*) FILTER (WHERE uuid_shape AND auth_uuid_matches = 1)::bigint uuid_match,
    count(*) FILTER (WHERE email_shape)::bigint application_session_email_path,
    count(*) FILTER (WHERE auth_email_matches > 1 OR auth_uuid_matches > 1)::bigint ambiguous,
    count(*) FILTER (WHERE NOT nonempty OR (NOT email_shape AND NOT uuid_shape))::bigint genuinely_unresolved,
    count(*) FILTER (WHERE auth_email_matches > 0 AND auth_uuid_matches > 0)::bigint competing_paths,
    count(*) FILTER (WHERE auth_email_matches = 1)::bigint assumed_auth_email_match,
    count(*) FILTER (WHERE email_shape AND auth_email_matches = 0)::bigint application_only_email
  FROM all_relationships GROUP BY relation_type
),
brand_access_identities AS (
  SELECT b.id AS brand_id, lower(btrim(b.owner_email)) AS identity_key FROM public.brands b
  UNION
  SELECT bm.brand_id, lower(btrim(bm.email)) FROM public.brand_members bm
),
share_semantics AS (
  SELECT s.*,
    EXISTS (SELECT 1 FROM brand_access_identities ba WHERE ba.brand_id=s.brand_id AND ba.identity_key=s.normalized_identity) AS has_brand_access
  FROM board_share_rel s
),
old_brand_owner_blockers AS (
  SELECT entity_key FROM brand_owner_rel WHERE NOT nonempty OR auth_email_matches <> 1
),
old_board_owner_blockers AS (
  SELECT entity_key FROM board_owner_rel
  WHERE NOT nonempty OR (CASE WHEN owner_email IS NOT NULL THEN auth_email_matches ELSE auth_uuid_matches END) <> 1
     OR (brand_id IS NOT NULL AND NOT brand_exists)
),
old_brand_member_blockers AS (
  SELECT entity_key FROM brand_member_rel WHERE NOT parent_exists OR auth_email_matches <> 1
),
old_board_share_blockers AS (
  SELECT entity_key FROM board_share_rel WHERE NOT parent_exists OR auth_email_matches <> 1
),
old_raw_blockers AS (
  SELECT 'brand_owner'::text kind, entity_key FROM old_brand_owner_blockers
  UNION ALL SELECT 'board_owner', entity_key FROM old_board_owner_blockers
  UNION ALL SELECT 'brand_member', entity_key FROM old_brand_member_blockers
  UNION ALL SELECT 'board_share', entity_key FROM old_board_share_blockers
),
actual_blockers AS (
  -- Typed keys make unlike relationship records explicit; Board-only grants are not blockers.
  SELECT relation_type AS kind, entity_key FROM all_relationships
  WHERE NOT nonempty OR (NOT email_shape AND NOT uuid_shape)
     OR auth_email_matches > 1 OR auth_uuid_matches > 1
  UNION
  SELECT 'brand_member', entity_key FROM brand_member_rel WHERE NOT parent_exists
  UNION
  SELECT 'board_share', entity_key FROM board_share_rel WHERE NOT parent_exists
  UNION
  SELECT 'board_owner', entity_key FROM board_owner_rel WHERE brand_id IS NOT NULL AND NOT brand_exists
),
evidence AS (
  SELECT
    (SELECT count(*)::bigint FROM old_raw_blockers) AS raw_sum,
    (SELECT count(*)::bigint FROM (SELECT kind,entity_key FROM old_raw_blockers GROUP BY kind,entity_key) x) AS old_unique,
    (SELECT count(*)::bigint FROM actual_blockers) AS actual_unique,
    (SELECT count(*)::bigint FROM old_raw_blockers o JOIN actual_blockers a USING(kind,entity_key)) AS supported_overlap,
    (SELECT count(*)::bigint FROM all_relationships WHERE email_shape) AS repository_supported_email,
    (SELECT count(*)::bigint FROM all_relationships WHERE email_shape AND auth_email_matches=0) AS auth_join_misses,
    (SELECT count(*)::bigint FROM all_relationships WHERE NOT nonempty OR (NOT email_shape AND NOT uuid_shape)) AS unsupported,
    (SELECT count(*)::bigint FROM all_relationships WHERE auth_email_matches>1 OR auth_uuid_matches>1) AS ambiguous,
    (SELECT count(*)::bigint FROM schema_columns WHERE table_schema='auth' AND table_name='users' AND column_name IN ('id','email')) AS auth_columns,
    has_schema_privilege(current_user,'auth','USAGE') AND has_table_privilege(current_user,'auth.users','SELECT') AS auth_access
),
checks(sort_group,sort_item,category,check_name,status,record_count,notes) AS (
  -- A. Identity schema
  SELECT 1,1,'identity_schema','brand_owner_column',CASE WHEN count(*)=1 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Expected public.brands.owner_email type text and not nullable.' FROM schema_columns WHERE table_schema='public' AND table_name='brands' AND column_name='owner_email' AND data_type='text' AND is_nullable='NO'
  UNION ALL SELECT 1,2,'identity_schema','brand_member_identity_column',CASE WHEN count(*)=1 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Expected public.brand_members.email type text and not nullable.' FROM schema_columns WHERE table_schema='public' AND table_name='brand_members' AND column_name='email' AND data_type='text' AND is_nullable='NO'
  UNION ALL SELECT 1,3,'identity_schema','board_owner_email_column',CASE WHEN count(*)=1 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Expected public.boards.owner_email type text and nullable for legacy recovery.' FROM schema_columns WHERE table_schema='public' AND table_name='boards' AND column_name='owner_email' AND data_type='text' AND is_nullable='YES'
  UNION ALL SELECT 1,4,'identity_schema','board_owner_id_column',CASE WHEN count(*)=1 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Expected legacy public.boards.owner_id type text; runtime accepts session id or subject but current writes store canonical email.' FROM schema_columns WHERE table_schema='public' AND table_name='boards' AND column_name='owner_id' AND data_type='text'
  UNION ALL SELECT 1,5,'identity_schema','board_share_identity_column',CASE WHEN count(*)=1 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Expected public.board_editors.email type text and not nullable.' FROM schema_columns WHERE table_schema='public' AND table_name='board_editors' AND column_name='email' AND data_type='text' AND is_nullable='NO'
  UNION ALL SELECT 1,6,'identity_schema','application_identity_authority','review',0,'Repository authority is signed Google session email; no persistent application account or profile relation exists.'
  UNION ALL SELECT 1,7,'identity_schema','assumed_auth_relation_exists',CASE WHEN (SELECT auth_columns FROM evidence)=2 THEN 'ok' ELSE 'blocked' END,(SELECT auth_columns FROM evidence),'BW-36.7 assumed auth.users id and email; this is not the repository application identity authority.'
  UNION ALL SELECT 1,8,'identity_schema','assumed_auth_relation_accessible',CASE WHEN (SELECT auth_access FROM evidence) THEN 'ok' ELSE 'blocked' END,CASE WHEN (SELECT auth_access FROM evidence) THEN 1 ELSE 0 END,'SQL Editor role must have auth schema usage and auth.users select; otherwise stop at schema parity.'
  UNION ALL SELECT 1,9,'identity_schema','brand_member_unique_authority',CASE WHEN count(*)>0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'A unique Brand and email relationship is required.' FROM schema_constraints WHERE table_name='brand_members' AND constraint_type='UNIQUE'
  UNION ALL SELECT 1,10,'identity_schema','board_share_unique_authority',CASE WHEN count(*)>0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'A unique Board and email index is required.' FROM schema_indexes WHERE tablename='board_editors' AND indexname='board_editors_board_email_uidx'
  UNION ALL SELECT 1,11,'identity_schema','unexpected_nullable_authority_columns',CASE WHEN count(*)=0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Brand owner, Brand member, and Board share email columns must remain non-nullable.' FROM schema_columns WHERE table_schema='public' AND ((table_name='brands' AND column_name='owner_email') OR (table_name='brand_members' AND column_name='email') OR (table_name='board_editors' AND column_name='email')) AND is_nullable<>'NO'

  -- B. Stored identity shapes; generated separately for every relationship type.
  UNION ALL SELECT 2,1,'stored_identity_shapes',relation_type||'_total','info',total,'Total stored relationships.' FROM shape_rollup
  UNION ALL SELECT 2,2,'stored_identity_shapes',relation_type||'_nonempty','info',nonempty,'Non-empty stored identities.' FROM shape_rollup
  UNION ALL SELECT 2,3,'stored_identity_shapes',relation_type||'_empty_or_null',CASE WHEN empty=0 THEN 'ok' ELSE 'blocked' END,empty,'Empty or null stored identities.' FROM shape_rollup
  UNION ALL SELECT 2,4,'stored_identity_shapes',relation_type||'_email_shaped','info',email_shaped,'Email-shaped values; values are never projected.' FROM shape_rollup
  UNION ALL SELECT 2,5,'stored_identity_shapes',relation_type||'_uuid_shaped','info',uuid_shaped,'UUID-shaped values; values are never projected.' FROM shape_rollup
  UNION ALL SELECT 2,6,'stored_identity_shapes',relation_type||'_unsupported_shape',CASE WHEN unsupported_shaped=0 THEN 'ok' ELSE 'blocked' END,unsupported_shaped,'Values matching neither repository-supported form.' FROM shape_rollup
  UNION ALL SELECT 2,7,'stored_identity_shapes',s.relation_type||'_normalized_duplicate_records',CASE WHEN coalesce(d.duplicate_records,0)=0 THEN 'ok' ELSE 'review' END,coalesce(d.duplicate_records,0),'Records sharing a normalized identity within this relationship type.' FROM shape_rollup s LEFT JOIN normalized_duplicate_rollup d USING(relation_type)
  UNION ALL SELECT 2,8,'stored_identity_shapes',relation_type||'_distinct_normalized','info',distinct_normalized,'Distinct normalized identities.' FROM shape_rollup

  -- C. Repository-proven and comparison-only resolution paths.
  UNION ALL SELECT 3,1,'resolution_paths',relation_type||'_exact_canonical_match','info',exact_canonical,'Exact lower-trimmed email match to the application session comparison rule.' FROM resolution_rollup
  UNION ALL SELECT 3,2,'resolution_paths',relation_type||'_normalized_case_match','info',normalized_only,'Resolvable only after the repository canonical lower-trim rule.' FROM resolution_rollup
  UNION ALL SELECT 3,3,'resolution_paths',relation_type||'_uuid_match','info',uuid_match,'Legacy Board owner UUID path only; email relations do not support UUID authority.' FROM resolution_rollup
  UNION ALL SELECT 3,4,'resolution_paths',relation_type||'_application_session_match','info',application_session_email_path,'Repository-supported signed-session email shape; SQL cannot prove a live session.' FROM resolution_rollup
  UNION ALL SELECT 3,5,'resolution_paths',relation_type||'_assumed_auth_email_match','info',assumed_auth_email_match,'Comparison to auth.users used by BW-36.7; not application authority.' FROM resolution_rollup
  UNION ALL SELECT 3,6,'resolution_paths',relation_type||'_ambiguous_multiple_matches',CASE WHEN ambiguous=0 THEN 'ok' ELSE 'blocked' END,ambiguous,'Multiple matches in a candidate authority.' FROM resolution_rollup
  UNION ALL SELECT 3,7,'resolution_paths',relation_type||'_genuinely_unresolved',CASE WHEN genuinely_unresolved=0 THEN 'ok' ELSE 'blocked' END,genuinely_unresolved,'Empty or unsupported identity shapes.' FROM resolution_rollup
  UNION ALL SELECT 3,8,'resolution_paths',relation_type||'_competing_paths',CASE WHEN competing_paths=0 THEN 'ok' ELSE 'review' END,competing_paths,'Identity resolves through more than one candidate path.' FROM resolution_rollup
  UNION ALL SELECT 3,9,'resolution_paths',relation_type||'_application_only_email','review',application_only_email,'Repository-supported email absent from the separately assumed auth.users authority.' FROM resolution_rollup

  -- D. Relationship semantics.
  UNION ALL SELECT 4,1,'relationship_semantics','primary_brand_owners','info',count(*)::bigint,'Brand owners require Workspace owner treatment only after UUID authority is proven.' FROM brand_owner_rel
  UNION ALL SELECT 4,2,'relationship_semantics','brand_admins','info',count(*)::bigint,'Existing Brand admin access requires minimal Workspace visibility.' FROM brand_member_rel WHERE role='admin'
  UNION ALL SELECT 4,3,'relationship_semantics','brand_editors','info',count(*)::bigint,'Existing Brand editor access requires minimal Workspace visibility.' FROM brand_member_rel WHERE role='editor'
  UNION ALL SELECT 4,4,'relationship_semantics','brand_viewers','info',count(*)::bigint,'Existing Brand viewer access requires minimal Workspace visibility.' FROM brand_member_rel WHERE role='viewer'
  UNION ALL SELECT 4,5,'relationship_semantics','primary_board_owners','info',count(*)::bigint,'Board owner authority is independent and must be preserved.' FROM board_owner_rel
  UNION ALL SELECT 4,6,'relationship_semantics','board_editors','info',count(*)::bigint,'Board-scoped editor grants.' FROM board_share_rel WHERE role='editor'
  UNION ALL SELECT 4,7,'relationship_semantics','board_viewers','info',count(*)::bigint,'Board-scoped viewer grants.' FROM board_share_rel WHERE role='viewer'
  UNION ALL SELECT 4,8,'relationship_semantics','board_only_collaborators','info',count(*)::bigint,'Valid Board grants without associated Brand access remain Board-only.' FROM share_semantics WHERE NOT has_brand_access
  UNION ALL SELECT 4,9,'relationship_semantics','collaborators_with_brand_access','info',count(*)::bigint,'Board grants whose identities separately possess associated Brand access.' FROM share_semantics WHERE has_brand_access
  UNION ALL SELECT 4,10,'relationship_semantics','public_token_boards','info',count(*)::bigint,'Boolean state only; token values are neither read nor returned.' FROM board_owner_rel WHERE public_view_enabled IS TRUE
  UNION ALL SELECT 4,11,'relationship_semantics','workspace_owner_membership_candidates','review',count(*)::bigint,'Primary owner relationships need a proven UUID mapping before membership creation.' FROM brand_owner_rel
  UNION ALL SELECT 4,12,'relationship_semantics','minimal_workspace_visibility_candidates','review',count(*)::bigint,'Brand grants need visibility only; visibility must not create new Brand authorization.' FROM brand_member_rel
  UNION ALL SELECT 4,13,'relationship_semantics','must_remain_board_only','info',count(*)::bigint,'These grants must not become Workspace membership or Brand access.' FROM share_semantics WHERE NOT has_brand_access
  UNION ALL SELECT 4,14,'relationship_semantics','must_never_create_catalog_access','info',(SELECT count(*)::bigint FROM share_semantics WHERE NOT has_brand_access)+(SELECT count(*)::bigint FROM board_owner_rel WHERE public_view_enabled IS TRUE),'Board-only and anonymous public access never imply catalog access.'

  -- E. Reconstruct BW-36.7 without pretending unlike or overlapping components are disjoint.
  UNION ALL SELECT 5,1,'blocker_reconstruction','brand_owner_blockers','blocked',count(*)::bigint,'Raw BW-36.7 auth.users resolution component.' FROM old_brand_owner_blockers
  UNION ALL SELECT 5,2,'blocker_reconstruction','board_owner_blockers','blocked',count(*)::bigint,'Raw BW-36.7 owner or Brand-association quarantine component.' FROM old_board_owner_blockers
  UNION ALL SELECT 5,3,'blocker_reconstruction','brand_member_blockers','blocked',count(*)::bigint,'Raw BW-36.7 auth.users or parent-resolution component.' FROM old_brand_member_blockers
  UNION ALL SELECT 5,4,'blocker_reconstruction','board_editor_share_blockers','review',count(*)::bigint,'Raw BW-36.7 component; valid Board-only relationships are review-only, not Workspace blockers.' FROM old_board_share_blockers
  UNION ALL SELECT 5,5,'blocker_reconstruction','missing_brand_association_blockers',CASE WHEN count(*)=0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Boards referring to no reusable Brand.' FROM board_owner_rel WHERE brand_id IS NOT NULL AND NOT brand_exists
  UNION ALL SELECT 5,6,'blocker_reconstruction','ambiguous_identity_blockers',CASE WHEN count(*)=0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Ambiguous candidate authority matches.' FROM all_relationships WHERE auth_email_matches>1 OR auth_uuid_matches>1
  UNION ALL SELECT 5,7,'blocker_reconstruction','genuine_ownerless_record_blockers',CASE WHEN count(*)=0 THEN 'ok' ELSE 'blocked' END,count(*)::bigint,'Owner records with no stored authority.' FROM (SELECT nonempty FROM brand_owner_rel UNION ALL SELECT nonempty FROM board_owner_rel) x WHERE NOT nonempty
  UNION ALL SELECT 5,8,'blocker_reconstruction','review_only_incorrectly_included',CASE WHEN count(*)=0 THEN 'ok' ELSE 'review' END,count(*)::bigint,'Application-supported email relations counted only because auth.users was incorrectly assumed authoritative.' FROM old_raw_blockers o JOIN all_relationships r ON r.relation_type=o.kind AND r.entity_key=o.entity_key WHERE r.email_shape AND r.auth_email_matches=0
  UNION ALL SELECT 5,9,'blocker_reconstruction','overlapping_component_records','info',((SELECT raw_sum FROM evidence)-(SELECT old_unique FROM evidence)),'Overlap inside typed BW-36.7 component records; unlike entity types remain intentionally separate.'
  UNION ALL SELECT 5,10,'blocker_reconstruction','raw_blocker_component_sum','info',(SELECT raw_sum FROM evidence),'Arithmetic component sum only; it is not asserted to be a disjoint record population.'
  UNION ALL SELECT 5,11,'blocker_reconstruction','typed_unique_old_blocking_records','info',(SELECT old_unique FROM evidence),'Deduplicated only within explicit relationship entity types.'
  UNION ALL SELECT 5,12,'blocker_reconstruction','unique_blocking_records',CASE WHEN (SELECT actual_unique FROM evidence)=0 THEN 'ok' ELSE 'blocked' END,(SELECT actual_unique FROM evidence),'Typed unique records with malformed, ambiguous, missing-parent, or missing-association evidence; no misleading cross-type global identity count.'

  -- F. Derived bounded conclusion and readiness.
  UNION ALL SELECT 6,1,'diagnostic_conclusion','identity_model_confirmed',
    CASE WHEN auth_access AND auth_columns=2 AND unsupported=0 AND ambiguous=0 AND auth_join_misses=0 THEN 'ok' ELSE 'info' END,
    CASE WHEN auth_access AND auth_columns=2 AND unsupported=0 AND ambiguous=0 AND auth_join_misses=0 THEN 1 ELSE 0 END,
    'All supported identities also resolve in the assumed authority; this still does not authorize backfill.' FROM evidence
  UNION ALL SELECT 6,2,'diagnostic_conclusion','preflight_join_defect',
    CASE WHEN auth_access AND auth_columns=2 AND unsupported=0 AND ambiguous=0 AND repository_supported_email>0 AND auth_join_misses>0 THEN 'review' ELSE 'info' END,
    CASE WHEN auth_access AND auth_columns=2 AND unsupported=0 AND ambiguous=0 AND repository_supported_email>0 AND auth_join_misses>0 THEN 1 ELSE 0 END,
    'Repository-supported signed-session emails are absent from auth.users, demonstrating the old join is not authoritative.' FROM evidence
  UNION ALL SELECT 6,3,'diagnostic_conclusion','production_identity_anomalies',
    CASE WHEN unsupported>0 OR ambiguous>0 THEN 'blocked' ELSE 'info' END,
    CASE WHEN unsupported>0 OR ambiguous>0 THEN 1 ELSE 0 END,
    'Malformed, empty, or ambiguous stored authority requires evidence review; records are not labeled corrupt.' FROM evidence
  UNION ALL SELECT 6,4,'diagnostic_conclusion','mixed_identity_state',
    CASE WHEN (unsupported>0 OR ambiguous>0) AND auth_join_misses>0 THEN 'review' ELSE 'info' END,
    CASE WHEN (unsupported>0 OR ambiguous>0) AND auth_join_misses>0 THEN 1 ELSE 0 END,
    'Both repository-supported join misses and genuine anomalies are present.' FROM evidence
  UNION ALL SELECT 6,5,'diagnostic_conclusion','schema_parity_blocked',
    CASE WHEN NOT auth_access OR auth_columns<>2 THEN 'blocked' ELSE 'info' END,
    CASE WHEN NOT auth_access OR auth_columns<>2 THEN 1 ELSE 0 END,
    'Missing or inaccessible assumed authentication relation prevents complete comparison; stop without dynamic SQL.' FROM evidence
  UNION ALL SELECT 6,6,'diagnostic_conclusion','diagnostic_readiness',
    CASE WHEN NOT auth_access OR auth_columns<>2 OR unsupported>0 OR ambiguous>0 THEN 'blocked'
         WHEN auth_join_misses>0 THEN 'review' ELSE 'ok' END,
    actual_unique,
    'Evidence readiness only. Even ok permits only a later corrected-preflight proposal, never a backfill.' FROM evidence
)
SELECT category, check_name, status, record_count, notes
FROM checks
ORDER BY sort_group, sort_item, check_name;
