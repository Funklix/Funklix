# BW-36.13R3 — Phase 1B authoritative project creation

## Evidence and scope

Baseline is main at `e49036db82d9499a35ae28595994123f67a48b0c`, including merged PR #744 / BW-36.13R2. The BW-36.13 audit verified a fragmented creation dialog: Brand selection depended on another catalog, Workspace assignment was omitted, normal creation exposed unbranded Boards, new Brand creation was absent, and success changed pathname without explicitly switching the visible view. R1's logo containment and R2's first-Workspace transaction remain intact.

Hierarchy remains **Account/User → Workspace → Brands → Boards**. The user creates a **Project**, persisted as a **Board**. The **Brand Profile** is reusable shared authority. The **Campaign Brand Snapshot** is the stable Board-local copy. This change does not create a second hierarchy or redefine sharing.

## Final UX

One body-owned native dialog handles Project → Brand → Create. Project asks for a Unicode-normalized name and displays the active Workspace as read-only context. Brand shows exactly the active Workspace catalog's independently authorized Brands, including disabled read-only choices, confirmed logos with Unicode initials fallback, selection state, and a separate new-Brand card. Only Workspace owner/admin can select the new-Brand card. No normal unbranded option exists.

Controls preserve drafts, prevent duplicate submission, provide Back/Cancel, localized English/German inline errors, radio-card arrow navigation, native Enter/Space selection, Escape, Tab containment and focus restoration. The dialog uses semantic theme tokens, bounded desktop width/mobile scrolling, 44px controls, visible focus, forced colors and reduced motion. No toolbar/sidebar/profile redesign is included.

Uncertain responses retain the exact command and request ID; retry replays it. Definitive validation/permission errors permit corrected input. After a verified committed result, an opening failure retains the complete created context and retry only opens the same result, without another POST. Cancel closes the visual flow without undoing an already committed server command.

## Versioned request/response

`POST /api/projects` accepts exactly:

```json
{
  "contract": "project_command_v1",
  "request_id": "client-generated-UUID-or-bounded-request-id",
  "workspace_id": "workspace-UUID",
  "project_name": "Autumn launch",
  "brand": { "existing_id": "brand-UUID" }
}
```

The only alternative Brand shape is `{"new_name":"Acme"}`. Unknown fields, invalid UUIDs, ambiguous Brand choices, missing context, malformed/control-only/overlong names, and nonstring request IDs fail closed. Names use the existing NFC-aware validator plus the catalog's 160 UTF-16-unit bound. The browser sends no Canvas, ownership, snapshot, provider or revision claims.

Success contains exactly `contract`, echoed `request_id`, `ok`, `created`, safe `workspace`, safe `brand` with current authorized access, `setup_required`, complete safe `board`, `snapshot` provenance and `next_route`. Board context includes validated blank Canvas, matching Workspace/Brand, stable Core copy, source revision/source-updated timestamp/copied timestamp, timestamps and owner capabilities. It does not return owner emails, identity/session rows, tokens, SQL or provider material. The versioned failure envelope contains only `contract`, request ID, `ok:false`, and bounded `error:{code,category,retryable}`. Client validation rejects unknown response fields and inconsistent relationships/provenance/routes before reconciliation.

Error categories cover validation, authentication, permission, unavailable Workspace/Brand, cross-Workspace Brand, conflicts, database/schema availability, unknown outcomes, malformed responses and internal failures. There is no optimistic revision field in the approved request: locked current revisions are authoritative. `WORKSPACE_CHANGED`/`BRAND_CHANGED` are reserved bounded conflict categories for future revision-aware callers, not invented current checks.

## Authorization and transaction

The verified signed cookie session is the only authentication authority. Its canonical email resolves exactly one active application identity; missing, disabled, ambiguous, malformed and mismatched identities fail closed. Request/public-token/Board-only/provider identities cannot substitute.

One explicit transaction executes:

1. `BEGIN`, resolve and lock the active application identity.
2. Acquire a transaction advisory lock over application identity plus client request ID.
3. Lock the requested active Workspace and its accepted membership; validate role.
4. Resolve the durable command by identity/request ID and compare its normalized SHA-256 request fingerprint.
5. Existing Brand: lock Brand, lock its current membership, independently resolve existing `getBrandAccess` capabilities and require `canCreateBrandBoards`. Require matching `workspace_id`. Workspace membership alone grants no Brand authority; Brand viewer remains disabled/rejected.
6. New Brand: require Workspace owner/admin, insert matching Workspace and minimal name, revision 1 and empty valid reusable Core. Preserve the established `owner_email` ownership relationship. Do not insert a fake `owner` membership: `brand_members` permits only admin/editor/viewer, and ownership lives on Brand itself.
7. Insert Board with matching Workspace/Brand, validated server-created blank Canvas, signed user's established ownership fields, locked Brand Core and exact source provenance.
8. Independently validate the inserted Board owner and its Workspace/Brand relationship, then validate the complete safe response contract.
9. Insert the completed durable command outcome.
10. `COMMIT` and return the complete context.

All pre-commit failures roll back every new Brand, Board, snapshot, ownership field and command row. Commit acknowledgment failure is `OUTCOME_UNKNOWN`, and retry resolves the original durable command. The connection is always released. No runtime schema creation or production SQL is run by this command. `getBrandAccess` gains only opt-in transaction settings; its existing callers/default authorization remain unchanged.

## Durable idempotency and migration decision

No existing durable command table safely represented this operation. Exactly one additive migration creates server-only `public.project_commands` keyed by `(identity_id,request_id)`, with fingerprint, Workspace/Brand/Board outcome IDs and strict safe completed context. RLS is enabled; PUBLIC/anon/authenticated have no grants/policies. Use the existing privileged server PostgreSQL connection, never a browser table write.

Concurrent identical commands produce one Brand/Board outcome. Exact replay returns the stored snapshot/context with `created:false`, rechecking current Workspace membership, independent Brand create permission and Board ownership. Workspace summary and access reflect current authority; snapshot content/provenance remain the original result. Changed payload with the same key fails `IDEMPOTENCY_CONFLICT`. Brand/Board outcome IDs deliberately have no restrictive FK, so existing deletion behavior is preserved while the command remains a tombstone: replay after deletion fails authorization and never recreates a deleted project. Identity/Workspace keys remain restrictive, matching the current unsupported deletion boundary.

Historical migrations are not edited. Narrow historical tests now recognize the new normal command contract, its opt-in Brand helper extension and exactly this additive migration; they retain their original authorization, public isolation, provenance, no-provider and historical-schema assertions.

## Reconciliation, navigation and setup handoff

`project-command.js` owns strict construction/validation, one same-origin POST, account-object/catalog-generation/Workspace-bound single flight and stale rejection. Catalog and Boards library reconcile immutably from the returned result. Pending old library reads are invalidated. No follow-up creation, guessed outcome refetch, reload, localStorage or sessionStorage persistence is used.

Existing Brand success establishes active Workspace, Brand and Board, then the shared navigation helper changes pathname and visible view together. The complete returned Canvas/access/snapshot hydrate immediately in memory. Later catalog/library rendering does not switch back to overview. The memory-only hydration option avoids the existing Canvas/awareness storage writes without changing other hydration callers.

New Brand success routes to `/brands/{brandId}/setup?board={boardId}` and opens the existing reusable Brand Profile editor with the returned safe Brand. A localized setup notice explains the relationship and provides **Continue to project**. Saving the reusable Brand remains the existing revision-aware editor operation; it does not silently replace the stable Campaign Brand Snapshot. Use the existing explicit compare/refresh boundary later if the Board should adopt saved Profile changes. No fake completeness/Ready state or full guided wizard exists.

The setup route has a Vercel rewrite and authorized direct-link restoration through the existing catalog/Brand editor. Refreshing that route resolves the Brand and Board within the same authorized Workspace. Continue opens the corresponding Board through its established authenticated read when the original command context is no longer in memory. Account change/sign-out invalidates the operation and setup notice. Unsafe logo upload/discovery remains disabled by R1.

## Compatibility

Legacy `POST /api/boards` is unchanged and remains an internal/recovery compatibility boundary. Normal UI creation never silently falls back to it or composes Brand-then-Board writes. Existing first-Workspace creation, rename/selectors, Brand/Board authorization, sharing/public tokens, Board library reads, Canvas toolbar and compact bar, content/scheduling/Calendar/Auto-plan/CSV/PDF remain in place. No external provider/AI/publishing request is introduced.

## Post-merge deployment order and manual SQL

**No SQL has been executed against production.** A privileged operator must perform the following post-merge order:

1. Verify previously deployed prerequisites: existing Brand/Board schema including snapshot provenance and ownership columns; `20260928_bw36_6_workspace_schema_foundation.sql`, `20260929_bw36_7r2_application_identity_bridge.sql`, `20260929_bw36_8_transactional_workspace_backfill.sql`, and `20261001_bw36_12_brand_logo.sql`. Do not rerun already-applied historical migrations. Missing prerequisites require their documented ordered deployment first.
2. Execute **only the new** `migrations/20261006_bw36_13r3_project_commands.sql` once in the Supabase SQL editor using the privileged server schema role.
3. Verify, read-only:

```sql
SELECT to_regclass('public.project_commands') AS command_table,
       c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='project_commands';
SELECT count(*) AS browser_policies FROM pg_policies
WHERE schemaname='public' AND tablename='project_commands';
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='project_commands'
  AND grantee IN ('PUBLIC','anon','authenticated');
```

Expected: table present, RLS true, zero browser policies, zero listed browser grants. Verify the server connection role owns or can SELECT/INSERT this table; never grant browser roles to compensate.

4. Deploy `/api/projects`, its modules, browser assets and setup rewrite together after successful schema verification. Exercise authenticated manual acceptance before calling the production journey verified.
5. After a fixture creation, verify identifier relationships and single-outcome counts without dumping outcome JSON:

```sql
SELECT count(*) AS commands,
       count(*) FILTER (WHERE b.id IS NOT NULL AND br.id IS NOT NULL
         AND b.workspace_id=pc.workspace_id AND br.workspace_id=pc.workspace_id
         AND b.brand_id=pc.brand_id) AS matching_outcomes
FROM public.project_commands pc
LEFT JOIN public.boards b ON b.id=pc.board_id
LEFT JOIN public.brands br ON br.id=pc.brand_id;
```

Deleted entities remain tombstoned and legitimately no longer match. Confirm concurrent/replayed fixture commands yield one row for their identity/request ID without exposing that identity publicly.

Rollback the application commit/UI route together; retain the additive table and completed outcomes and every successfully created Brand/Board. Do not drop data or rewrite history. A schema rollback is intentionally not supplied because destroying durable command outcomes would undermine response-loss safety.

## Validation and manual acceptance

The focused regression uses real production contract/route/service/authorization/client/dialog/application-glue modules with invented PostgreSQL/DOM adapters and an invented signed-session key. It has no real database/network/provider/AI activity. It covers contracts/unknown fields, identity, roles, transaction order, rollback at Brand/Board/snapshot/ownership/command stages, commit ambiguity, no orphan Brand, provenance, concurrent exact replay/payload conflicts, stale account/generation, one POST, immutable projections, actual application navigation glue, setup/Continue, input retention, duplicate submission and keyboard/focus boundaries. Responsive/theme/forced-colors/reduced-motion rules are asserted as source boundaries, not visual proof.

Run `check:bw36.13r3`, R2/R1, directly affected authorization/sharing/public/Workspace/localization/responsive/browser checks, syntax checks for all changed JavaScript, `git diff --check`, and the complete Runtime Boot Safety workflow after final edits. The workflow includes all directly affected historical checks and registers R3 immediately after R2.

An authenticated production browser/session is unavailable in this environment; there are no authenticated visual screenshots or real Supabase transaction results. DOM adapters are not browser visual proof. Manual acceptance must cover desktop/compact/tablet/mobile/200% zoom and both themes, forced colors, keyboard/focus, long names, authorized multiple Brands, viewer suppression, Workspace owner/admin new Brand, request delay/double click, lost response/replay, navigation after library refresh, setup edits/Continue/direct refresh, account switch/sign-out, permission loss, and committed-Board opening recovery.

## Explicit Phase 2 deferrals

Guided Basics/Discover/Review/Ready setup; setup completeness; logo repair/upload/discovery/vector handling; Profile redesign; Workspace invitations/membership management; moving Brands/Boards; governed Learnings; AI/provider generation; publishing; Canvas redesign; unrelated cleanup and downstream feature changes remain deferred.
