-- BW-36.7 production preflight. Read-only: one bounded aggregate result set.
-- Run manually in the authenticated Supabase SQL Editor; never as a migration.
WITH
auth_email_counts AS (
  SELECT lower(email) AS email_key, count(*)::bigint AS identity_count,
    CASE WHEN count(*) = 1 THEN min(id::text) END AS resolved_user_id
  FROM auth.users
  WHERE email IS NOT NULL
  GROUP BY lower(email)
),
brand_facts AS (
  SELECT b.id, b.owner_email, b.workspace_id, a.resolved_user_id AS resolved_owner_id,
    coalesce(a.identity_count, 0)::bigint AS owner_identity_count
  FROM public.brands b
  LEFT JOIN auth_email_counts a ON a.email_key = lower(b.owner_email)
),
brand_member_facts AS (
  SELECT bm.brand_id, bm.email, bm.role,
    coalesce(a.identity_count, 0)::bigint AS identity_count,
    (bf.id IS NOT NULL) AS brand_exists
  FROM public.brand_members bm
  LEFT JOIN brand_facts bf ON bf.id = bm.brand_id
  LEFT JOIN auth_email_counts a ON a.email_key = lower(bm.email)
),
brand_member_rollup AS (
  SELECT brand_id, count(*)::bigint AS member_count
  FROM brand_member_facts GROUP BY brand_id
),
board_facts AS (
  SELECT bo.id, bo.owner_email, bo.owner_id, bo.brand_id, bo.workspace_id,
    bo.public_view_enabled, bo.brand_core_snapshot IS NOT NULL AS has_snapshot,
    CASE WHEN bo.owner_email IS NOT NULL THEN coalesce(ao.identity_count, 0)
         WHEN ai.id IS NOT NULL THEN 1 ELSE 0 END::bigint AS owner_identity_count,
    CASE WHEN bo.owner_email IS NOT NULL THEN ao.resolved_user_id
         ELSE ai.id::text END AS resolved_owner_id,
    (bo.owner_email IS NOT NULL AND ai.id IS NOT NULL
      AND lower(ai.email) IS DISTINCT FROM lower(bo.owner_email)) AS owner_identity_conflict,
    bf.id IS NOT NULL AS brand_resolves,
    bf.owner_email AS brand_owner_email,
    bf.owner_identity_count AS brand_owner_identity_count
  FROM public.boards bo
  LEFT JOIN auth_email_counts ao ON ao.email_key = lower(bo.owner_email)
  LEFT JOIN auth.users ai ON ai.id::text = bo.owner_id
  LEFT JOIN brand_facts bf ON bf.id = bo.brand_id
),
board_editor_facts AS (
  SELECT be.board_id, be.email, be.role,
    coalesce(a.identity_count, 0)::bigint AS identity_count,
    (bo.id IS NOT NULL) AS board_exists,
    bo.brand_id
  FROM public.board_editors be
  LEFT JOIN public.boards bo ON bo.id = be.board_id
  LEFT JOIN auth_email_counts a ON a.email_key = lower(be.email)
),
brand_quarantine AS (
  SELECT count(*)::bigint AS n FROM brand_facts
  WHERE owner_email IS NULL OR owner_identity_count <> 1
),
board_quarantine AS (
  SELECT count(*)::bigint AS n FROM board_facts
  WHERE (coalesce(owner_email, owner_id) IS NULL OR owner_identity_count <> 1 OR owner_identity_conflict)
     OR (brand_id IS NOT NULL AND (NOT brand_resolves OR brand_owner_identity_count <> 1))
),
projected_owners AS (
  SELECT resolved_owner_id AS owner_key FROM brand_facts
  WHERE resolved_owner_id IS NOT NULL AND owner_identity_count = 1
  UNION
  SELECT resolved_owner_id FROM board_facts
  WHERE brand_id IS NULL AND resolved_owner_id IS NOT NULL AND owner_identity_count = 1 AND NOT owner_identity_conflict
),
additional_visibility AS (
  SELECT count(DISTINCT (bm.brand_id, lower(bm.email)))::bigint AS n
  FROM brand_member_facts bm
  JOIN brand_facts bf ON bf.id = bm.brand_id
  WHERE bm.identity_count = 1 AND bf.owner_identity_count = 1
    AND lower(bm.email) <> lower(bf.owner_email)
),
blocking AS (
  SELECT
    (SELECT n FROM brand_quarantine)
    + (SELECT n FROM board_quarantine)
    + (SELECT count(*) FROM brand_member_facts WHERE NOT brand_exists OR identity_count <> 1)
    + (SELECT count(*) FROM board_editor_facts WHERE NOT board_exists OR identity_count <> 1)
    AS n
),
irregular AS (
  SELECT
    (SELECT count(*) FROM public.workspaces)
    + (SELECT count(*) FROM public.workspace_memberships)
    + (SELECT count(*) FROM brand_facts WHERE workspace_id IS NOT NULL)
    + (SELECT count(*) FROM board_facts WHERE workspace_id IS NOT NULL)
    AS n
),
checks(sort_group, sort_item, category, check_name, status, record_count, notes) AS (
  VALUES
  (1,1,'schema','workspaces_table_exists',CASE WHEN to_regclass('public.workspaces') IS NOT NULL THEN 'ok' ELSE 'blocked' END,(to_regclass('public.workspaces') IS NOT NULL)::int::bigint,'Required BW-36.6 table.'),
  (1,2,'schema','workspace_memberships_table_exists',CASE WHEN to_regclass('public.workspace_memberships') IS NOT NULL THEN 'ok' ELSE 'blocked' END,(to_regclass('public.workspace_memberships') IS NOT NULL)::int::bigint,'Required BW-36.6 table.'),
  (1,3,'schema','brands_workspace_column',CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='brands' AND column_name='workspace_id') THEN 'ok' ELSE 'blocked' END,(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='brands' AND column_name='workspace_id'))::int::bigint,'Nullable adoption column must exist.'),
  (1,4,'schema','boards_workspace_column',CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='boards' AND column_name='workspace_id') THEN 'ok' ELSE 'blocked' END,(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='boards' AND column_name='workspace_id'))::int::bigint,'Nullable adoption column must exist.'),
  (1,5,'schema','workspace_rls_enabled',CASE WHEN coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.workspaces'::regclass),false) THEN 'ok' ELSE 'blocked' END,coalesce((SELECT relrowsecurity::int::bigint FROM pg_class WHERE oid='public.workspaces'::regclass),0),'Workspace RLS must be enabled.'),
  (1,6,'schema','workspace_membership_rls_enabled',CASE WHEN coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.workspace_memberships'::regclass),false) THEN 'ok' ELSE 'blocked' END,coalesce((SELECT relrowsecurity::int::bigint FROM pg_class WHERE oid='public.workspace_memberships'::regclass),0),'Membership RLS must be enabled.'),
  (1,7,'schema','authorization_helpers',CASE WHEN to_regprocedure('public.workspace_has_active_role(uuid,text[])') IS NOT NULL THEN 'ok' ELSE 'blocked' END,(to_regprocedure('public.workspace_has_active_role(uuid,text[])') IS NOT NULL)::int::bigint,'Required bounded authorization helper.'),
  (1,8,'schema','last_owner_guard',CASE WHEN to_regprocedure('public.protect_workspace_last_owner()') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='workspace_memberships_last_owner_guard' AND NOT tgisinternal) THEN 'ok' ELSE 'blocked' END,(to_regprocedure('public.protect_workspace_last_owner()') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='workspace_memberships_last_owner_guard' AND NOT tgisinternal))::int::bigint,'Function and trigger protect the final accepted owner.'),
  (1,9,'schema','workspace_indexes',CASE WHEN (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('workspaces_status_updated_idx','workspace_memberships_user_status_idx','workspace_memberships_workspace_status_role_idx'))=3 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM pg_indexes WHERE schemaname='public' AND indexname IN ('workspaces_status_updated_idx','workspace_memberships_user_status_idx','workspace_memberships_workspace_status_role_idx')),'Three BW-36.6 Workspace indexes expected.'),
  (1,10,'schema','brand_workspace_index',CASE WHEN to_regclass('public.brands_workspace_id_idx') IS NOT NULL THEN 'ok' ELSE 'blocked' END,(to_regclass('public.brands_workspace_id_idx') IS NOT NULL)::int::bigint,'Brand Workspace lookup index.'),
  (1,11,'schema','board_workspace_index',CASE WHEN to_regclass('public.boards_workspace_id_idx') IS NOT NULL THEN 'ok' ELSE 'blocked' END,(to_regclass('public.boards_workspace_id_idx') IS NOT NULL)::int::bigint,'Board Workspace lookup index.'),

  (2,1,'adoption state','existing_workspaces',CASE WHEN (SELECT count(*) FROM public.workspaces)=0 THEN 'ok' ELSE 'review' END,(SELECT count(*)::bigint FROM public.workspaces),'Expected zero before the approved backfill.'),
  (2,2,'adoption state','existing_workspace_memberships',CASE WHEN (SELECT count(*) FROM public.workspace_memberships)=0 THEN 'ok' ELSE 'review' END,(SELECT count(*)::bigint FROM public.workspace_memberships),'Expected zero before the approved backfill.'),
  (2,3,'adoption state','brands_with_workspace_reference',CASE WHEN (SELECT count(*) FROM brand_facts WHERE workspace_id IS NOT NULL)=0 THEN 'ok' ELSE 'review' END,(SELECT count(*)::bigint FROM brand_facts WHERE workspace_id IS NOT NULL),'Nonzero means prior adoption requires review.'),
  (2,4,'adoption state','boards_with_workspace_reference',CASE WHEN (SELECT count(*) FROM board_facts WHERE workspace_id IS NOT NULL)=0 THEN 'ok' ELSE 'review' END,(SELECT count(*)::bigint FROM board_facts WHERE workspace_id IS NOT NULL),'Nonzero means prior adoption requires review.'),

  (3,1,'brands','total_reusable_brands','info',(SELECT count(*)::bigint FROM brand_facts),'All reusable Brand records.'),
  (3,2,'brands','active_brands','info',(SELECT count(*)::bigint FROM brand_facts),'Current schema has no archive lifecycle; all rows are active.'),
  (3,3,'brands','archived_or_deleted_brands','info',0::bigint,'Current schema represents neither archived nor retained deleted Brands.'),
  (3,4,'brands','brands_with_primary_owner',CASE WHEN (SELECT count(*) FROM brand_facts WHERE owner_email IS NOT NULL)=0 AND (SELECT count(*) FROM brand_facts)>0 THEN 'blocked' ELSE 'ok' END,(SELECT count(*)::bigint FROM brand_facts WHERE owner_email IS NOT NULL),'Primary authority is brands.owner_email.'),
  (3,5,'brands','brands_without_primary_owner',CASE WHEN (SELECT count(*) FROM brand_facts WHERE owner_email IS NULL)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM brand_facts WHERE owner_email IS NULL),'Ownerless Brands require quarantine.'),
  (3,6,'brands','brand_owner_identity_anomalies',CASE WHEN (SELECT count(*) FROM brand_facts WHERE owner_email IS NOT NULL AND owner_identity_count<>1)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM brand_facts WHERE owner_email IS NOT NULL AND owner_identity_count<>1),'Owner must resolve exactly once in auth.users.'),
  (3,7,'brands','distinct_primary_brand_owners','info',(SELECT count(DISTINCT lower(owner_email))::bigint FROM brand_facts WHERE owner_email IS NOT NULL),'Distinct normalized primary owners.'),
  (3,8,'brands','brands_with_accepted_members','info',(SELECT count(*)::bigint FROM brand_member_rollup WHERE member_count>0),'Brand membership has no pending lifecycle; stored rows are existing grants.'),
  (3,9,'brands','brands_with_multiple_owner_members','info',0::bigint,'Brand member roles exclude owner; primary ownership is singular.'),
  (3,10,'brands','brands_without_memberships','info',(SELECT count(*)::bigint FROM brand_facts bf LEFT JOIN brand_member_rollup r ON r.brand_id=bf.id WHERE r.brand_id IS NULL),'Brands with no additional member grants.'),
  (3,11,'brands','projected_default_owner_workspaces_for_brands','info',(SELECT count(DISTINCT lower(owner_email))::bigint FROM brand_facts WHERE owner_identity_count=1),'Safe owned-Brand owner projection.'),

  (4,1,'boards','total_boards','info',(SELECT count(*)::bigint FROM board_facts),'All Board records.'),
  (4,2,'boards','active_boards','info',(SELECT count(*)::bigint FROM board_facts),'Current schema has no archive lifecycle; all rows are active.'),
  (4,3,'boards','archived_or_deleted_boards','info',0::bigint,'Current schema represents neither archived nor retained deleted Boards.'),
  (4,4,'boards','boards_with_current_owner','info',(SELECT count(*)::bigint FROM board_facts WHERE coalesce(owner_email,owner_id) IS NOT NULL),'Boards with stored owner authority.'),
  (4,5,'boards','ownerless_boards',CASE WHEN (SELECT count(*) FROM board_facts WHERE coalesce(owner_email,owner_id) IS NULL)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM board_facts WHERE coalesce(owner_email,owner_id) IS NULL),'Ownerless Boards require quarantine.'),
  (4,6,'boards','board_owner_identity_anomalies',CASE WHEN (SELECT count(*) FROM board_facts WHERE coalesce(owner_email,owner_id) IS NOT NULL AND (owner_identity_count<>1 OR owner_identity_conflict))=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM board_facts WHERE coalesce(owner_email,owner_id) IS NOT NULL AND (owner_identity_count<>1 OR owner_identity_conflict)),'Board owner authority must resolve exactly once in auth.users.'),
  (4,7,'boards','boards_with_brand_association','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NOT NULL),'Branded Boards.'),
  (4,8,'boards','boards_without_brand_association','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NULL),'Unbranded Boards need owner or recovery handling.'),
  (4,9,'boards','resolved_brand_associations','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NOT NULL AND brand_resolves),'Associations resolving to a reusable Brand.'),
  (4,10,'boards','missing_brand_associations',CASE WHEN (SELECT count(*) FROM board_facts WHERE brand_id IS NOT NULL AND NOT brand_resolves)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NOT NULL AND NOT brand_resolves),'Missing or deleted associated Brands require quarantine.'),
  (4,11,'boards','snapshot_only_boards','review',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NULL AND has_snapshot),'Unbranded Boards retaining Campaign Brand Snapshot data.'),
  (4,12,'boards','boards_without_brand_or_snapshot','review',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NULL AND NOT has_snapshot),'Unbranded Boards without usable snapshot provenance.'),
  (4,13,'boards','board_brand_owner_mismatches',CASE WHEN (SELECT count(*) FROM board_facts WHERE brand_resolves AND lower(owner_email)<>lower(brand_owner_email))=0 THEN 'ok' ELSE 'review' END,(SELECT count(*)::bigint FROM board_facts WHERE brand_resolves AND lower(owner_email)<>lower(brand_owner_email)),'Cross-owner Board relationships must preserve Board authority.'),
  (4,14,'boards','projected_unbranded_owner_workspaces','info',(SELECT count(DISTINCT resolved_owner_id)::bigint FROM board_facts WHERE brand_id IS NULL AND resolved_owner_id IS NOT NULL AND owner_identity_count=1 AND NOT owner_identity_conflict),'Safe owner Workspace projection for unbranded Boards.'),

  (5,1,'memberships/access','brand_members_requiring_workspace_visibility','info',(SELECT n FROM additional_visibility),'Minimal visibility only; never implicit Brand access.'),
  (5,2,'memberships/access','invalid_brand_member_identities',CASE WHEN (SELECT count(*) FROM brand_member_facts WHERE NOT brand_exists OR identity_count<>1)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM brand_member_facts WHERE NOT brand_exists OR identity_count<>1),'Membership must resolve to one identity and existing Brand.'),
  (5,3,'memberships/access','duplicate_brand_memberships',CASE WHEN (SELECT count(*) FROM (SELECT brand_id,lower(email) FROM brand_member_facts GROUP BY brand_id,lower(email) HAVING count(*)>1) d)=0 THEN 'ok' ELSE 'blocked' END,(SELECT count(*)::bigint FROM (SELECT brand_id,lower(email) FROM brand_member_facts GROUP BY brand_id,lower(email) HAVING count(*)>1) d),'Duplicate normalized membership shapes.'),
  (5,4,'memberships/access','accepted_brand_admin_relationships','info',(SELECT count(*)::bigint FROM brand_member_facts WHERE role='admin'),'Existing Brand access baseline by role.'),
  (5,5,'memberships/access','accepted_brand_editor_relationships','info',(SELECT count(*)::bigint FROM brand_member_facts WHERE role='editor'),'Existing Brand access baseline by role.'),
  (5,6,'memberships/access','accepted_brand_viewer_relationships','info',(SELECT count(*)::bigint FROM brand_member_facts WHERE role='viewer'),'Existing Brand access baseline by role.'),
  (5,7,'memberships/access','owned_brand_relationships','info',(SELECT count(*)::bigint FROM brand_facts WHERE owner_email IS NOT NULL),'Existing owner access baseline.'),
  (5,8,'memberships/access','owned_board_relationships','info',(SELECT count(*)::bigint FROM board_facts WHERE coalesce(owner_email,owner_id) IS NOT NULL),'Existing Board owner access baseline.'),
  (5,9,'memberships/access','board_editor_relationships','info',(SELECT count(*)::bigint FROM board_editor_facts WHERE role='editor'),'Existing Board editor baseline.'),
  (5,10,'memberships/access','board_share_relationships','info',(SELECT count(*)::bigint FROM board_editor_facts),'All bounded Board collaborator grants.'),
  (5,11,'memberships/access','boards_with_accepted_editors','info',(SELECT count(DISTINCT board_id)::bigint FROM board_editor_facts WHERE role='editor'),'Boards with editor grants.'),
  (5,12,'memberships/access','boards_with_collaborators','info',(SELECT count(DISTINCT board_id)::bigint FROM board_editor_facts),'Boards with editor or viewer grants.'),
  (5,13,'memberships/access','board_only_collaborators','info',(SELECT count(*)::bigint FROM board_editor_facts be WHERE be.brand_id IS NULL OR NOT EXISTS(SELECT 1 FROM brand_member_facts bm WHERE bm.brand_id=be.brand_id AND lower(bm.email)=lower(be.email))),'Board grants without matching associated-Brand membership.'),
  (5,14,'memberships/access','active_public_token_boards','info',(SELECT count(*)::bigint FROM board_facts WHERE public_view_enabled IS TRUE),'Public access baseline; no token value is read or returned.'),
  (5,15,'memberships/access','snapshot_only_access_cases','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NULL AND has_snapshot),'Historical snapshot baseline.'),

  (6,1,'migration risks','owners_with_brands_and_boards','info',(SELECT count(*)::bigint FROM (SELECT lower(owner_email) k FROM brand_facts WHERE owner_email IS NOT NULL INTERSECT SELECT lower(owner_email) FROM board_facts WHERE owner_email IS NOT NULL) x),'Distinct owners spanning both object types.'),
  (6,2,'migration risks','board_owners_without_brands','info',(SELECT count(*)::bigint FROM (SELECT DISTINCT lower(owner_email) k FROM board_facts WHERE owner_email IS NOT NULL EXCEPT SELECT DISTINCT lower(owner_email) FROM brand_facts WHERE owner_email IS NOT NULL) x),'Need an owner Workspace for unbranded Boards.'),
  (6,3,'migration risks','brand_owners_without_boards','info',(SELECT count(*)::bigint FROM (SELECT DISTINCT lower(owner_email) k FROM brand_facts WHERE owner_email IS NOT NULL EXCEPT SELECT DISTINCT lower(owner_email) FROM board_facts WHERE owner_email IS NOT NULL) x),'Brand-only owner population.'),
  (6,4,'migration risks','public_token_users_outside_catalogs','info',(SELECT count(*)::bigint FROM board_facts WHERE public_view_enabled IS TRUE),'Anonymous public access must not imply Workspace catalog access.'),
  (6,5,'migration risks','board_only_bounded_exceptions','info',(SELECT count(*)::bigint FROM board_editor_facts be WHERE be.brand_id IS NULL OR NOT EXISTS(SELECT 1 FROM brand_member_facts bm WHERE bm.brand_id=be.brand_id AND lower(bm.email)=lower(be.email))),'Preserve as Board-only grants.'),
  (6,6,'migration risks','potential_access_expansion_cases','review',(SELECT n FROM additional_visibility),'Workspace visibility must not grant reusable Brand access.'),
  (6,7,'migration risks','potential_access_loss_cases','review',(SELECT n FROM additional_visibility),'Brand grants need minimal Workspace visibility to remain discoverable.'),
  (6,8,'migration risks','cross_owner_board_shares','review',(SELECT count(*)::bigint FROM board_editor_facts be JOIN board_facts bo ON bo.id=be.board_id WHERE bo.owner_email IS NOT NULL AND lower(be.email)<>lower(bo.owner_email)),'Cross-owner Board grants must be preserved.'),
  (6,9,'migration risks','contradictory_ownership_shapes',CASE WHEN (SELECT count(*) FROM brand_facts WHERE owner_identity_count>1)+(SELECT count(*) FROM board_facts WHERE owner_identity_count>1 OR owner_identity_conflict)=0 THEN 'ok' ELSE 'blocked' END,((SELECT count(*) FROM brand_facts WHERE owner_identity_count>1)+(SELECT count(*) FROM board_facts WHERE owner_identity_count>1 OR owner_identity_conflict))::bigint,'Ambiguous or contradictory authenticated identities.'),
  (6,10,'migration risks','records_preventing_automatic_backfill',CASE WHEN (SELECT n FROM blocking)=0 THEN 'ok' ELSE 'blocked' END,(SELECT n::bigint FROM blocking),'Conservative sum of quarantine and invalid relationship records.'),

  (7,1,'projected backfill','default_owner_workspaces_to_create','info',(SELECT count(*)::bigint FROM projected_owners),'One deterministic default Workspace per safe primary owner.'),
  (7,2,'projected backfill','workspace_owner_memberships_to_create','info',(SELECT count(*)::bigint FROM projected_owners),'One accepted owner membership per projected Workspace.'),
  (7,3,'projected backfill','additional_visibility_memberships_to_create','info',(SELECT n FROM additional_visibility),'Deduplicated minimal Brand-member visibility projection.'),
  (7,4,'projected backfill','brands_safe_for_automatic_assignment','info',(SELECT count(*)::bigint FROM brand_facts WHERE owner_identity_count=1),'Owned Brands with exactly one authenticated identity.'),
  (7,5,'projected backfill','brands_requiring_quarantine',CASE WHEN (SELECT n FROM brand_quarantine)=0 THEN 'ok' ELSE 'blocked' END,(SELECT n FROM brand_quarantine),'Missing or ambiguous Brand owner authority.'),
  (7,6,'projected backfill','branded_boards_safe_for_inherited_assignment','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NOT NULL AND brand_resolves AND brand_owner_identity_count=1),'Can inherit the associated Brand Workspace.'),
  (7,7,'projected backfill','unbranded_boards_safe_for_owner_assignment','info',(SELECT count(*)::bigint FROM board_facts WHERE brand_id IS NULL AND resolved_owner_id IS NOT NULL AND owner_identity_count=1 AND NOT owner_identity_conflict),'Can use the current owner default Workspace.'),
  (7,8,'projected backfill','boards_requiring_quarantine',CASE WHEN (SELECT n FROM board_quarantine)=0 THEN 'ok' ELSE 'blocked' END,(SELECT n FROM board_quarantine),'Missing or ambiguous authority or Brand relationship.'),
  (7,9,'projected backfill','records_already_unexpectedly_migrated',CASE WHEN (SELECT n FROM irregular)=0 THEN 'ok' ELSE 'review' END,(SELECT n::bigint FROM irregular),'Workspace rows, memberships, or adopted object references.'),
  (7,10,'projected backfill','total_blocking_anomalies',CASE WHEN (SELECT n FROM blocking)=0 THEN 'ok' ELSE 'blocked' END,(SELECT n::bigint FROM blocking),'Zero is required for a fully automatic backfill.'),

  (8,1,'final readiness','workspace_backfill_readiness',CASE WHEN (SELECT n FROM blocking)>0 THEN 'blocked' WHEN (SELECT n FROM irregular)>0 OR EXISTS(SELECT 1 FROM board_facts WHERE brand_id IS NULL OR (brand_resolves AND lower(owner_email)<>lower(brand_owner_email))) THEN 'review' ELSE 'ok' END,(SELECT n::bigint FROM blocking),'OK is ready; review means inspect irregularities; blocked forbids automatic backfill.')
)
SELECT category, check_name, status, record_count, notes
FROM checks
ORDER BY sort_group, sort_item;
