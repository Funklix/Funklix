# BW-36.21A-R2.2 — Multiple Workspaces and direct Brand selection

Date: 2026-10-17 (Europe/Berlin). Scope: R2.2 only.
Base: merged `main`, `0add1bacf00b1be3d5b26001c5d61ab00c648ba9`, including #784, #785 and #786; verified through GitHub and `git fetch origin main`.

## Product behavior

Any verified active eligible application identity may create independently owned Workspaces, including an identity whose existing access is member/viewer. There is no membership-count restriction or arbitrary quota. The existing sidebar selector and Home chooser expose the same creation controller for zero, one or multiple Workspaces. Rename and Brand management retain their selected object's existing permission checks.

Creation adds an authorized option without switching an existing Workspace or clearing its open/dirty Board or Profile. The dialog announces confirmation only after a validated server acknowledgment and offers **Switch to new Workspace**. That action calls the existing protected `selectSessionWorkspace`; Cancel retains work, while a deliberate discard retires outgoing state. Creating the first Workspace still activates it automatically. Same-Workspace selection remains a no-op.

Sidebar Brand row activation selects a navigation preference, including with a branded, unbranded or hidden-association Board loaded. Single-Brand selectors remain accessible. Home Brand cards use the same boundary. Ordinary selection does not automatically open a Profile. Home starts with All visible Boards and keeps its existing filter reset behavior; applying a Brand filter remains explicit. Continue Working retains the actual loaded Board.

## Backend contract and transaction

POST `/api/workspaces` accepts the additive contract:

```json
{
  "contract": "workspace_create_v2",
  "workspace_id": "25c01ce8-f0f1-43d5-81f5-4e89b8229454",
  "name": "Independent Studio",
  "request_id": "create-25c01ce8-f0f1-43d5-81f5-4e89b8229454"
}
```

The client generates a v4 UUID and a stable correlation ID per attempt. The shared name validator normalizes Unicode and whitespace and rejects invalid names. Only verified session identity is authoritative; request keys are strict. Disabled, ambiguous, malformed and session-mismatched identities reject creation. The existing first-creation identity bootstrap is retained.

Within one transaction, creation acquires the existing canonical-email advisory lock (including v1/bootstrap compatibility), validates/locks the v2 identity row, then acquires a UUID advisory lock across creators. An existing UUID is locked and replay-authorized. Otherwise a parameterized insert creates that exact Workspace UUID followed by its accepted owner membership; the owner invariant is checked before commit. Any failure rolls back both, including a newly bootstrapped identity. No Brands, Boards, sharing, tokens or other memberships are copied. Existing last-owner schema protection is unchanged.

The Workspace primary key is the durable deduplication key. Identical concurrent requests or a lost-response retry create one Workspace and owner membership. Different UUIDs remain independent even with identical names. A replay returns 200/`created:false` only for the same verified creator, normalized name, active Workspace and accepted owner membership. Both Workspace and membership must still have their initial revision (1). Renames or membership changes cannot make a different current name masquerade as the original creation input; they conservatively produce `WORKSPACE_CREATE_CONFLICT`, as do foreign/archived/revoked collisions. These failures contain no target metadata. New creation returns 201/`created:true` and echoes the request correlation ID.

`workspace_create_v1` remains compatible and first-only, including its original email-serialized/name-matching replay behavior. No migration, ledger or production SQL is needed. The v2 concurrency and rollback paths were also exercised with separate connections to a disposable PostgreSQL 18 server, beyond the default PGlite suite.

## Client confirmation and catalog reconciliation

`workspace-catalog.js` validates contract version, echoed request ID, confirmed UUID, owner projection and normalized requested name. Reconciliation appends to the existing catalog and retains all prior entries and descendant arrays. A replay against a populated entry is an acknowledgment and cannot replace its Brands/Boards with empty arrays.

The application captures the account object/email and catalog object/generation for the outstanding request. Obsolete or cross-account completions reject rather than announcing success or adopting state. The dialog retains immutable UUID/name/request ID across uncertain retries and dismissal/reopening in the same session. Duplicate submits are disabled and application single-flight rejects a competing creation. A definitive UUID conflict refreshes the catalog and retires the failed attempt, so closing/reopening the dialog can deliberately start a fresh creation. Uncertain network failures retain the original UUID. An account replacement or email change retires the dialog/attempt's authority.

After confirmed reconciliation, `retryWorkspaceCatalog` deliberately leaves its ready short-circuit and performs the authorized GET. A refresh preserves an explicitly selected Workspace and revalidates the resulting context. The explicit switch waits for an outstanding post-create refresh before entering the protected lifecycle. If the read fails, the dialog keeps the confirmed creation, announces localized retry feedback and retries the authorized GET on another switch attempt, without another POST. Account identity is rechecked after that wait. A refresh failure cannot reinterpret a confirmed commit as an uncertain POST or trigger another creation. The existing catalog remains the only authorized Workspace membership projection.

## Three separate Brand identities

| Identity | Existing owner | Behavior |
| --- | --- | --- |
| Selected navigation Brand | `ephemeralBrandSwitcherSelection`, with `state.session.brandId` as the reconciled projection | Validated against the account's ready catalog and active Workspace. Sidebar/Home and the explicit Brand-filtered library use it. Session-only; existing legacy browser hints do not restore or override it. |
| Open Board's saved Brand | `boardBrandAssociation`, Board response and `authoritativeBoardBrandCore` | Loading, serialization, Canvas snapshot and campaign operations remain Board-authoritative. Loading/saving/sidebar derivation no longer overwrite the independent preference. |
| Viewed canonical Profile | `canonicalBrandDetail.brandId` and the existing Profile controller | Explicit sidebar/Home target, or the selected authorized navigation Brand through regular Profile navigation. Existing leave/save/discard/conflict guards and viewer capabilities remain. |

The selector shows the selected row and a separate Open Board name/visible association status. Home keeps each Board's original Brand label. A hidden association stays hidden. A foreign Brand cannot select another Workspace or become an active Workspace preference. A partial legacy Brand collection cannot erase a valid Workspace preference; ready Workspace reconciliation clears preferences that are no longer authorized. Account/catalog reset clears the preference owner; legacy selection delegates to `selectSessionBrand` rather than persisting another selection path.

The regular Profile nav and Campaign Snapshot Profile entry invoke the existing function without forwarding a click event as a Brand target. The explicit Profile chooser opens its chosen Profile separately from navigation preference selection. Board-specific snapshot and campaign paths continue using their saved association, not a selected Y's canonical Core. Returning to Canvas retains Board A/X. Actual server viewer Profile access is tested as read-only.

## Lifecycle and accessibility

R2.1, R2.1R1 and R2.1R2 remain the Workspace exit owners: dirty Canvas/Profile guards, in-flight save/AI mutation blocking, membership revalidation, Board/save generation retirement, autosave/presence shutdown, private Canvas cleanup and same-Workspace no-op. Additional creation never calls Board retirement; accepting an explicit switch does. No AI Brain, Advisor, Learning, campaign prompt/provider, serializer, Board association permission or publishing contract changes are included.

Existing DOM IDs, selectors, body-owned popovers, search, focus return and keyboard handling are retained. Keyboard traversal excludes hidden search rows. Workspace creation is a separate footer action outside the listbox. Brand viewers receive an explicit Profile action without management permission. Tablet and mobile rules keep both selectors reachable for viewers and owners in collapsed/expanded modes, including one-entry selectors. Create dialogs trap enabled controls after input becomes immutable, announce creating/uncertain/confirmed states politely and provide English/German feedback. Home's new creation entry and navigation/Board separation note are localized. Existing theme, reduced-motion, forced-color and 44px-target styling remains.

## Validation

Final local results: PASS. Initial failures were corrected and the affected suites rerun; the complete workflow and all retained assertions were exercised. All browser transport uses intercepted disposable fixtures and mocked providers. No paid provider calls or production data/SQL writes are performed.

- `npm run check:bw36.21ar2.2`: **PASS**, 12 server/client groups and 18 Chromium groups, plus separately verified representative screenshot capture.
- The server suite also runs with `BW36_R22_LOCAL_POSTGRES=1` against an isolated loopback PostgreSQL database created and dropped by that run. Production connection variables are not used by that mode.
- Focused coverage includes first/additional Workspace creation, member/viewer entitlement, same/different UUID concurrency, creator/input collision, replay/timeout, rollback, identity failures, v1 compatibility, malformed confirmation, populated reconciliation and account retirement.
- Browser coverage includes actual populated Boards and exact Canvas/association/snapshot equality, branded/unbranded/hidden associations, selected Y and Board X campaign authority, Home All/Brand filters, explicit and regular Profile navigation, read-only viewers, reload, selectors at desktop/tablet/phone widths, search/keyboard focus, dirty Cancel/Discard switching, first activation, immutable retry after dismissal, cross-Workspace and logout rejection.
- Existing R2.1/R1/R2 lifecycle coverage retains all 96 groups. Existing authorization, Brand lifecycle, logo, Profile decisions, project/campaign and Learning assertions are retained. Older fixture catalogs now carry their authenticated account identity, and context-reset fixtures initialize the existing navigation preference owner consistently. Only intentionally changed navigation/persistence expectations are updated, and formerly automatic Profile transitions now use the explicit nav action.
- Complete Runtime Boot Safety: **PASS, 182/182 validation blocks**, including the new R2.2 gate. This is the consolidated result after initial failures were fixed and their affected validation blocks rerun; no failed assertion is waived. Dependencies and system Chromium are local setup; the CI browser installer remains unchanged. Local `--with-deps` installation requires root, so the installed system Chromium is used instead.
- Final syntax, browser-script integrity (44 local classic scripts) and `git diff --check`: **PASS**.

## Codex review feedback

The automated review of `cbff228391` reported two P2 recovery issues on [PR #787](https://github.com/Funklix/Funklix/pull/787):

- [Definitive creation conflicts retained the failed attempt](https://github.com/Funklix/Funklix/pull/787#discussion_r4302364436): fixed in `f3a3553`. The conflict refreshes access and retires the immutable attempt, while an uncertain transport failure retains it. A real dialog close/reopen regression verifies a deliberately new UUID/name can then succeed.
- [Switch could be clicked before post-create refresh settled](https://github.com/Funklix/Funklix/pull/787#discussion_r4302364434): the switch now awaits that refresh, remains visibly pending, rechecks account identity and then enters the existing guarded lifecycle. A failed read gives localized feedback and a switch retry refreshes access without another POST. Delayed-success and failed-read/retry Chromium cases cover both paths.

The final focused suite passes after both corrections. Remote CI and review of subsequent commits are reported on the PR; the fixes are not a claim that the bot independently reviewed the new head.

## Representative browser evidence

Disposable local fixtures; no production acceptance is implied. The selected navigation Brand is Y, while Continue Working and the selector's Board status retain X.

- [Desktop Light, expanded, English](bw36-21a-r2-2-visuals/r22-1440-light-en-expanded.png)
- [Desktop Dark, collapsed, German](bw36-21a-r2-2-visuals/r22-1440-dark-de-collapsed.png)
- [Tablet Light, collapsed, German](bw36-21a-r2-2-visuals/r22-768-light-de-collapsed.png)
- [Phone Dark, expanded, English](bw36-21a-r2-2-visuals/r22-390-dark-en-expanded.png)
- [Confirmed additional Workspace; explicit switch offered](bw36-21a-r2-2-visuals/r22-create-confirmed.png)

## Limitations and live acceptance

Creation attempts are retained in browser memory, including dialog reopening, not across a page reload. After leaving/reloading an uncertain operation, inspect the refreshed catalog before starting a deliberately new creation. A Workspace renamed or with a revised owner membership returns a conservative replay conflict; refresh/reselect its existing catalog entry rather than allocating a new UUID for the old operation. There is no new durable browser preference system or Workspace quota.

Workspace switching still requires online session/catalog verification and waits for operations without a safe cancellation contract to settle. These protections are intentionally preserved. PostgreSQL/schema deployment parity and live production behavior remain rollout checks; local mocks are not production acceptance.

After review/deployment, use designated test accounts and ordinary UI/APIs:

1. As owner and as viewer/member of W1, create W2 from sidebar and Home. Verify W2 has one accepted owner and no inherited content; W1 and its dirty Board/Profile remain active. Interrupt a response and retry the retained attempt; verify no duplicate.
2. Accept an explicit switch through Cancel/Discard and existing Profile Save/Discard/Cancel cases. Confirm outgoing private Canvas/presence state is retired and W2 has honest empty content. Confirm same-Workspace no-op.
3. With Board A/X loaded, select Y via Home and both sidebar sizes. Verify selected Y, All default/reset, explicit Y filtering, Continue A/X and no Board PUT/snapshot/AI request from selection.
4. Open Profile Y via the separate row/Home action and regular nav, including a viewer. Return to A, save an ordinary edit and reload: association/snapshot authority remains X. Exercise Profile dirty/save/conflict guards.
5. Exercise unbranded/hidden-association A, one Brand, mobile/tablet/desktop, keyboard search/focus/Escape, long names, EN/DE and Light/Dark. Revoke access, logout/change accounts and delay responses; verify no old selection or inaccessible context is adopted.

## Changed files

- `.github/workflows/runtime-boot-safety.yml`
- `api/workspaces.js`
- `app.js`
- `docs/implementations/bw36-21a-r2-2-multiple-workspaces-and-brand-selection.md`
- `docs/implementations/bw36-21a-r2-2-visuals/r22-1440-dark-de-collapsed.png`
- `docs/implementations/bw36-21a-r2-2-visuals/r22-1440-light-en-expanded.png`
- `docs/implementations/bw36-21a-r2-2-visuals/r22-390-dark-en-expanded.png`
- `docs/implementations/bw36-21a-r2-2-visuals/r22-768-light-de-collapsed.png`
- `docs/implementations/bw36-21a-r2-2-visuals/r22-create-confirmed.png`
- `home-foundation.js`
- `language.js`
- `package.json`
- `scripts/check-bw36-10-workspace-selector-and-sidebar-hierarchy.js`
- `scripts/check-bw36-11r1-sidebar-context-interaction.js`
- `scripts/check-bw36-13r3r1-workspace-catalog-repair.js`
- `scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js`
- `scripts/check-bw36-13r5-brand-lifecycle-stability.js`
- `scripts/check-bw36-13r5r2-brand-workspace-regression-recovery.js`
- `scripts/check-bw36-13r5r3-durable-brand-logo-and-readiness.js`
- `scripts/check-bw36-13r6-brand-profile-decision-and-deletion-ux.js`
- `scripts/check-bw36-17-governed-brand-learnings.js`
- `scripts/check-bw36-21a-home-foundation.js`
- `scripts/check-bw36-21a-r2-2-brand-navigation.js`
- `scripts/check-bw36-21a-r2-2-multiple-workspaces.js`
- `scripts/check-bw4-durable-brand-selection.js`
- `scripts/fixtures/bw36-18-browser.js`
- `scripts/fixtures/bw36-19-browser.js`
- `workspace-catalog.js`
- `workspace-sidebar.css`
- `workspace-sidebar.js`
