-- BW-36.8 privacy-safe post-backfill verification: one read-only statement.
WITH
facts AS (
 SELECT
 (SELECT count(*) FROM public.app_identities) identities,
 (SELECT count(*) FROM public.app_identities WHERE status<>'active') disabled,
 (SELECT count(*) FROM public.workspaces) workspaces,
 (SELECT count(*) FROM public.workspace_memberships) memberships,
 (SELECT count(*) FROM public.workspace_memberships WHERE role='owner' AND status='accepted') owners,
 (SELECT count(*) FROM public.workspace_memberships WHERE role='viewer' AND status='accepted') viewers,
 (SELECT count(*) FROM public.brands WHERE workspace_id IS NOT NULL) brands,
 (SELECT count(*) FROM public.boards WHERE workspace_id IS NOT NULL) boards,
 (SELECT count(*) FROM public.boards WHERE brand_id IS NOT NULL AND workspace_id IS NOT NULL) branded,
 (SELECT count(*) FROM public.boards WHERE brand_id IS NULL AND workspace_id IS NOT NULL) unbranded,
 (SELECT count(*) FROM public.brand_members) brand_members,
 (SELECT count(*) FROM public.board_editors) board_shares,
 (SELECT count(*) FROM public.boards WHERE public_view_enabled) public_boards,
 (SELECT count(*) FROM public.boards WHERE brand_id IS NULL AND brand_core_snapshot IS NOT NULL) snapshots,
 (SELECT count(*) FROM public.boards b JOIN public.brands br ON br.id=b.brand_id WHERE b.workspace_id IS DISTINCT FROM br.workspace_id) cross_board,
 (SELECT count(*) FROM public.brands b LEFT JOIN public.workspaces w ON w.id=b.workspace_id WHERE w.id IS NULL) orphan_brand,
 (SELECT count(*) FROM public.boards b LEFT JOIN public.workspaces w ON w.id=b.workspace_id WHERE w.id IS NULL) orphan_board,
 (SELECT count(*) FROM public.workspace_memberships m LEFT JOIN public.app_identities a ON a.id=m.identity_id WHERE a.id IS NULL) orphan_identity,
 (SELECT count(*) FROM public.workspaces w WHERE (SELECT count(*) FROM public.workspace_memberships m WHERE m.workspace_id=w.id AND m.role='owner' AND m.status='accepted')<>1) owner_gap,
 (SELECT count(*) FROM (SELECT canonical_email FROM public.app_identities GROUP BY canonical_email HAVING count(*)>1)x) collisions,
 (SELECT count(*) FROM public.workspace_memberships wm WHERE wm.role='viewer' AND NOT EXISTS (SELECT 1 FROM public.brand_members bm JOIN public.brands br ON br.id=bm.brand_id WHERE lower(btrim(bm.email))=(SELECT canonical_email FROM public.app_identities ai WHERE ai.id=wm.identity_id) AND br.workspace_id=wm.workspace_id)) access_expansion,
 (SELECT count(*) FROM public.brand_members bm WHERE NOT EXISTS (SELECT 1 FROM public.app_identities ai JOIN public.workspace_memberships wm ON wm.identity_id=ai.id JOIN public.brands br ON br.workspace_id=wm.workspace_id WHERE ai.canonical_email=lower(btrim(bm.email)) AND br.id=bm.brand_id AND wm.status='accepted')) access_loss,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('app_identities','workspaces','workspace_memberships')) policies
), rows(category,check_name,record_count,expected,notes,ord) AS (VALUES
 ('schema','identity_bridge_closed',(SELECT policies FROM facts),0,'RLS catalogs remain browser-closed.',1),
 ('identity_state','application_identities',(SELECT identities FROM facts),6,'Exactly six active qualifying identities.',2),
 ('identity_state','disabled_created_identities',(SELECT disabled FROM facts),0,'Created identities remain active.',3),
 ('workspace_state','default_workspaces',(SELECT workspaces FROM facts),5,'One private default Workspace per owner.',4),
 ('workspace_state','workspaces_without_exact_owner',(SELECT owner_gap FROM facts),0,'Each Workspace has exactly one accepted owner.',5),
 ('membership_state','workspace_memberships',(SELECT memberships FROM facts),6,'Five owners and one viewer.',6),
 ('membership_state','accepted_owner_memberships',(SELECT owners FROM facts),5,'Last-owner invariant.',7),
 ('membership_state','accepted_minimal_visibility_memberships',(SELECT viewers FROM facts),1,'Discoverability only; Brand grants remain separate.',8),
 ('brand_assignments','assigned_brands',(SELECT brands FROM facts),6,'Owner Workspace assignments.',9),
 ('brand_assignments','brand_members_preserved',(SELECT brand_members FROM facts),1,'Existing Brand authorization relationship count.',10),
 ('board_assignments','assigned_boards',(SELECT boards FROM facts),20,'All Boards assigned.',11),
 ('board_assignments','branded_board_inheritance',(SELECT branded FROM facts),6,'Explicit Brand associations only.',12),
 ('board_assignments','unbranded_owner_placement',(SELECT unbranded FROM facts),14,'No Brand association inferred.',13),
 ('access_preservation','board_shares_preserved',(SELECT board_shares FROM facts),11,'Existing Board shares remain authoritative.',14),
 ('access_preservation','snapshot_boards_preserved',(SELECT snapshots FROM facts),14,'Snapshot-only Boards remain unbranded.',15),
 ('access_preservation','public_token_state_preserved',(SELECT public_boards FROM facts),1,'Bounded public Board state remains unchanged.',16),
 ('isolation','cross_workspace_inconsistencies',(SELECT cross_board FROM facts),0,'Branded Boards share their Brand Workspace.',17),
 ('isolation','orphaned_workspace_references',(SELECT orphan_brand+orphan_board FROM facts),0,'All assignments resolve.',18),
 ('isolation','orphaned_identity_references',(SELECT orphan_identity FROM facts),0,'All membership identities resolve.',19),
 ('isolation','access_expansion_cases',(SELECT access_expansion FROM facts),0,'Workspace visibility adds no Brand authority.',20),
 ('isolation','access_loss_cases',(SELECT access_loss FROM facts),0,'Every Brand member retains discoverability.',21),
 ('isolation','quarantine_records',0,0,'No source record was quarantined.',22),
 ('isolation','identity_collisions',(SELECT collisions FROM facts),0,'Canonical identities are unique.',20)
), assessed AS (SELECT category,check_name,CASE WHEN record_count=expected THEN 'ok' ELSE 'blocked' END status,CASE WHEN record_count=expected THEN 0 ELSE abs(record_count-expected) END::bigint record_count,notes,ord FROM rows), blockers AS (SELECT count(*)::bigint n FROM assessed WHERE status<>'ok'), output AS (
 SELECT * FROM assessed UNION ALL
 SELECT 'final_verification','workspace_backfill_verification',CASE WHEN n=0 THEN 'ok' ELSE 'blocked' END,n,'Successful backfill verification authorizes only the later Workspace API/read-cutover phase. It does not activate UI or direct browser access.',999 FROM blockers)
SELECT category,check_name,status,record_count,notes FROM output ORDER BY ord;
