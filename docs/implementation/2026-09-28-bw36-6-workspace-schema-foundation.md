# BW-36.6 — Additive Workspace schema and authorization foundation

## Decision and Phase 1 boundary

This implementation applies the approved hierarchy **Account/User → Workspace → Brands → Boards** and Option C rollout from the BW-36.5 audit. Workspace is the persisted tenant boundary. Brand remains reusable business identity, Board Brand association remains campaign truth, and Campaign Brand Snapshots are untouched.

Phase 1 is deliberately dormant. It adds one forward migration, a pure future server authorization vocabulary, and deterministic checks. It adds no Workspace row, backfill, route, selector, client authority, creation behavior, read/write cutover, Brand Learning, or AI behavior. BW-36.4 remains a temporary Brand projection and is unchanged; no UI or current behavior changes.

## Exact schema

`public.workspaces` has a generated UUID primary key; a trimmed 1–160 character name; optional bounded `avatar_url`; existing application locales `en|de`; `active|archived` status paired with `archived_at`; positive revision; UUID creation actor; and database-controlled creation/update timestamps. It stores no arbitrary authority JSON, provider material, secret, Brand data, or Board data.

`public.workspace_memberships` relates a UUID identity to a Workspace, uniquely by `(workspace_id, user_id)`. Its exact roles are `owner|admin|member|viewer`; lifecycle is `pending|accepted|revoked|expired`; it records inviter, positive revision, timestamps, and a status-consistent revocation timestamp. Phase 1 does not synthesize memberships from existing grants.

Nullable `workspace_id` foreign keys are added to `public.brands` and `public.boards` with `ON DELETE RESTRICT`. Indexes support Workspace status/catalog lookup, user and administrative membership lookup, and Workspace-filtered Brand/Board catalogs. They have no default and the migration has no DML, so old rows remain null and current inserts remain valid.

No composite Board/Brand constraint is added now: nullable legacy writes could otherwise acquire partially assigned identities before the write boundary exists. Phase 2 must backfill and verify both columns. Write cutover must atomically validate Workspace and Brand. Final contract enforcement then makes both tenant references non-null (and new production Board `brand_id` non-null), adds a supporting unique Brand `(id, workspace_id)` key and database composite Board `(brand_id, workspace_id)` foreign key. Client validation is never the final integrity boundary.

## RLS, helpers, and grants

RLS is enabled immediately on both new tables. `workspace_has_active_role` is a bounded boolean, `SECURITY DEFINER` helper with `search_path = pg_catalog`, explicit object qualification, `auth.uid()` validation, fixed roles, and no dynamic SQL. It avoids membership-policy recursion. Workspace SELECT requires an accepted membership. A membership SELECT reveals only the caller's accepted row; accepted owners/admins can list their Workspace membership rows. Members/viewers cannot list the roster.

There are no INSERT, UPDATE, or DELETE policies and authenticated receives only table SELECT plus execution of the bounded role helper. Anonymous receives nothing. Workspace-plus-owner creation, invitations, owner transfer, and all membership mutation therefore remain unavailable to browsers until a future same-transaction server service exists. The trigger function has execution revoked from `PUBLIC`, `anon`, and `authenticated`; trigger invocation remains internal. There are no sequences or views.

The small dependency-free `_workspace-authorization.js` module normalizes the same fixed role set, compares minimum permission, rejects absent identity, and returns bounded categories: unauthenticated, Workspace not found, membership missing/inactive, insufficient role, last-owner protected, invalid role, conflict, or storage failure. It performs no query and does not replace RLS.

## Last-owner boundary

The membership trigger runs before deletion or changes to Workspace, role, or status. When an accepted owner would be removed, downgraded, revoked, or moved, it takes a transaction-scoped advisory lock derived only from the Workspace UUID. Under that serialization it rejects loss of the final accepted owner of an active Workspace with the bounded `workspace_last_owner_protected` error. This covers single/bulk statements and competing transactions and remains compatible with a future transaction that adds a replacement owner before removing the old owner. Direct mutation is nevertheless closed in Phase 1. Existing Brand and Board owners are unaffected.

## Existing-access preservation and rollback boundary

The migration does not alter any policy or grant on Brands, Boards, `brand_members`, `board_editors`, public tokens, snapshots, schedules, publishing, or providers. It does not alter runtime storage/access modules. Nullable columns impose no requirement on current routes, and no browser state appears in the migration. Canvas, Home, Boards library, the current Brand sidebar, Content Workspace/Calendar, Brand Core, AI Brain, Insights, Funnel Simulator, auto-plan, exports, creation, sharing, public links, authentication, and current Brand/Board access continue on their existing code paths.

The repository uses forward migrations for adoption-sensitive changes. Rollback is operator-reviewed, never automatic:

1. Disable every future Workspace consumer and confirm the old app is serving all traffic.
2. Refuse rollback unless `SELECT count(*) FROM public.workspaces`, `SELECT count(*) FROM public.workspace_memberships`, `SELECT count(*) FROM public.brands WHERE workspace_id IS NOT NULL`, and the equivalent Boards query all return zero.
3. Reconfirm no later migration depends on these objects.
4. In one reviewed transaction remove the two nullable foreign-key columns/indexes, policies, trigger, functions, membership table/indexes, and Workspace table/indexes in dependency order.
5. Roll back application documentation/check registration only after schema verification.

Once Phase 2 or any consumer writes a Workspace, membership, or reference, destructive rollback is forbidden. Roll forward or disable consumers while retaining schema.

## Deployment and verification

Production operators must: (1) deploy only the additive migration; (2) verify tables, nullable columns, indexes, policies, functions, fixed search paths, and grants; (3) smoke-test existing Brand/Board operations and shares/public links; (4) confirm no Workspace rows were generated; (5) confirm every existing Brand/Board Workspace reference remains null; (6) monitor bounded storage/auth errors; and (7) **not activate Workspace reads or writes**.

Read-only verification queries include:

```sql
SELECT count(*) FROM public.workspaces;
SELECT count(*) FROM public.workspace_memberships;
SELECT count(*) FROM public.brands WHERE workspace_id IS NOT NULL;
SELECT count(*) FROM public.boards WHERE workspace_id IS NOT NULL;
SELECT tablename, policyname, roles, cmd FROM pg_policies
 WHERE schemaname = 'public' AND tablename IN ('workspaces', 'workspace_memberships');
SELECT routine_name, security_type FROM information_schema.routines
 WHERE routine_schema = 'public' AND routine_name LIKE '%workspace%';
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name IN ('workspaces', 'workspace_memberships');
```

Static repository verification parses the migration and exercises the pure helper with invented identities/memberships. No local PostgreSQL/Supabase runtime was required; consequently this is not executed-SQL proof. Phase 2 depends on production schema inventory, an idempotent mapping ledger/backfill, access-equivalence evidence, and ambiguity quarantine before any read activation.
