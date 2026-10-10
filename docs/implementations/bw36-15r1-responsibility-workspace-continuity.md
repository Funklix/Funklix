# BW-36.15R1 — Responsibility Workspace continuity

Base: merged `origin/main` at `68ab23d` (BW-36.15, PR #757). This is a forward repair; it does not change Campaign V3 generation, Canvas display-density controls, or the underlying permission/assignment model.

## Verified cause and revision lifecycle

The browser already consumed `updated_at` after a successful responsibility PUT. The defect was in `api/_campaign-responsibilities.js`: `Date.parse(board.updated_at)` converts node-postgres's TIMESTAMPTZ `Date` to its whole-second string representation. The browser supplies an ISO timestamp, whose milliseconds survive `Date.parse`. After a first save returning, for example, `08:00:00.137Z`, the next request compared `08:00:00.000` against `08:00:00.137` and incorrectly returned 409. The old regression represented database rows as ISO strings and advanced timestamps by whole seconds, concealing the production type/precision mismatch. Restoring only the original comparison makes the new regression fail on the second mutation with 409 instead of 200; restoring the repair passes.

The locked server comparison now uses `new Date(value).getTime()` on both values. It retains the existing authorization, transaction, revision requirement, exact-snapshot replay, and 409 behavior. No revision is invented in the browser. Focused coverage uses actual production handlers with PostgreSQL-shaped Date rows and fractional .137/.274/.411 revision transitions.

Old lifecycle: optimistic assignment → locked save → returned ISO revision stored → next Date/ISO comparison loses server milliseconds → false conflict and held command.

Corrected lifecycle: optimistic assignment and immutable pending request → locked millisecond-preserving comparison → committed authoritative ISO revision plus affected assignments → immutable replacement of affected local nodes → saved Canvas baseline and counts/rows refreshed → pending command released → next request uses that exact returned revision.

## Individual, bulk, and conflict flows

Individual assignment, reassignment, and removal retain the existing single responsibility PUT and owner activity behavior. The minimal response adds only affected `{id, ownerEmail, ownerName, ownerAvatar}` values alongside existing `id`, `updated_at`, and `access`. It exposes no extra Board, Brand, or roster data. The client validates the affected IDs/emails, consumes authoritative identities, and replaces affected node objects without changing campaign content or topology. Counts are derived from the reconciled local nodes. The saved snapshot preserves the pre-existing saved Brand baseline, so unrelated unsaved Brand edits remain detectable.

Bulk selection still requires selecting a person and explicitly confirming “Assign unassigned only” (or the established replace-all choice). One atomic save updates every affected row, the unassigned count, and normal controls. Individual reassignment/removal and Add team member remain available afterward; the dialog stays open. Successful mutations need no follow-up GET.

A genuinely stale external revision still returns 409 and holds the failed command. The existing inline notice and Load latest project action reload the authorized Board, reconcile its revision/assignments, release the held command, and offer the remembered selection for explicit review. The user can cancel or reconfirm and continue. Confirmed-save/local-display-failure recovery and exact retry remain covered by BW-36.15. No native alert/confirm is introduced.

## Toolbar, authorization, and accessibility

One “Responsibilities” / “Verantwortlichkeiten” Tendra One secondary button is initialized once and placed in the primary Canvas action group immediately after Add node. Its label also supplies its tooltip and accessible name. There is no separate product icon registry for this action, so it uses the established text-button presentation. The former Utilities item and its dispatch are removed. Both the new button and Campaign V3's existing completion action open the same Responsibility Workspace.

The button is visible only on the Canvas Board surface with an active, view-authorized Board after hydration. Existing viewers/public viewers retain the established read-only workspace, with disabled assignment controls and no invitations. Owner/editor mutation access still depends on existing Board permissions and the server's locked permission checks. Public-token sessions are explicitly excluded from client mutation capability. Board load completion refreshes toolbar visibility so conflict recovery and Escape focus restoration remain correct.

CSS is scoped to this action and workspace. The containing primary action group may wrap while this button is visible. The button uses safe border-box/maximum-width sizing and full wrapping labels; workspace controls have at least 44px targets. Existing rounding, spacing, tokens, themes, focus indicators, forced colors and reduced motion are retained. No overflow hiding, label truncation, density-mode change, or unrelated toolbar redesign.

## Regression and historical compatibility

`check:bw36.15r1` performs the uninterrupted requested sequence in real Chromium: toolbar opening and absence from Utilities; two people on two nodes; reassignment; removal; confirmed bulk; post-bulk reassignment/removal; no self-conflict; real external revision conflict; authorized reload; further mutation; close/reopen with the correct assignments/revision. Every command runs the real production save handler and client reconciliation, with fractional PostgreSQL Date rows rather than a constant revision mock. It checks authoritative values, immutable row reconciliation, exact next revision, unchanged Brand/Board association/content/topology, and absence of AI/provider/native-dialog requests.

The real toolbar/dialog/picker are checked at 1440, 1024, 768, 480, 375, 320, and 720×450 (200%-equivalent reflow), in EN/DE and light/dark, with keyboard focus/Escape/restoration and accessibility media. Owner/editor/viewer/public boundaries and hidden entry states are covered.

Historical BW-36.15 keeps all generation, assignment, retry, conflict, permission, and overflow assertions; only its entry selectors/focus destination follow the toolbar move. Its server helper exports optional Date/fractional-clock support for the new regression. A local stress run also exposed Chromium coordinate rounding during the real hover transition (44px became 43.99994px). Geometry checks now wait for that real transition to finish; the strict 44px thresholds, hit testing and every overflow assertion remain unchanged. Animations are not disabled. The responsibility feature initializes one toolbar button beside the existing Add node control, guarding against duplicate creation. This keeps the historical static toolbar subtree and its existing surface-visibility authority byte-exact. All original BW-36.1R1, BW-36.2 and nested historical source guards remain unchanged. No historical assertion is loosened to accept overflow. BW-36.14R1 is unchanged.

## Changed files

- `app.js`: feature-owned toolbar initialization, authoritative assignment/revision reconciliation, access guards and focus destination.
- `api/_campaign-responsibilities.js`: millisecond-safe comparison and minimal affected-assignment response.
- `campaign-responsibilities.css`: scoped toolbar wrapping/sizing and 44px workspace controls.
- `language.js`: Responsibilities / Verantwortlichkeiten.
- `scripts/check-bw36-15r1-responsibility-workspace-continuity.js`: focused production-shaped server/Chromium regression.
- `scripts/check-bw36-15-campaign-team-responsibilities.js`: toolbar entry/focus selectors and reusable optional PostgreSQL-shaped fixture support.
- `package.json` and `.github/workflows/runtime-boot-safety.yml`: focused check registration and changed-script syntax coverage.
- This implementation record.

## Validation order

1. `npm run check:bw36.15r1`
2. `npm run check:bw36.15`
3. `npm run check:bw36.14r1`
4. `node scripts/check-bw18-board-access-roles.js`
5. `node scripts/check-bw19-private-public-board-sharing.js`
6. `node scripts/check-browser-script-integrity.js`
7. Syntax checks for all changed JavaScript files.
8. `git diff --check`
9. Complete Runtime Boot Safety workflow in its declared order, including the new focused regression.

## Deployment, rollback, manual acceptance

Deploy the browser assets and responsibility API together through the existing application deployment. No migration, manual SQL, backfill, database maintenance, Board reassignment, Brand mutation, or provider/AI operation is required. An older server response lacks authoritative assignments; the client preserves confirmed-save recovery rather than inventing state. Rollback reverts this repair's code/assets only; stored owner fields remain in their established format (rollback also restores the known Date-comparison defect).

Manual browser acceptance: open an authorized existing Board; locate Responsibilities beside Add node and confirm Utilities has no duplicate. Keep one dialog open through two-person individual edits, removal, confirmed bulk, then further reassignment/removal and invitations. Verify counts and owner chips/list/Dashboard. In a second session, change an assignment; attempt an edit in the first, load latest from the inline conflict notice, review/cancel or reconfirm, and continue editing. Close/reopen and refresh to verify persistence. Repeat at mobile/reflow widths in EN/DE and light/dark, using keyboard and Escape. Verify editor access, read-only viewers/public-token access, and absence outside Canvas. Do not merge automatically.
