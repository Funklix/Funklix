# BW-36.13R3R1 — Workspace catalog and visible project launch repair

## Baseline and confirmed production evidence

Based on the merged default branch `main` at `54724ad2e0da1a7c3dd9346f43fb337513cebc5d` (merged BW-36.13R3). The supplied production evidence says the R3 migration was manually applied, existing Boards load through the Board API, the sidebar says “Workspace unavailable” without Brands, and New project appears inert. The supplied real GET `/api/workspaces` failure is `workspace_catalog_v1`, request ID `698a75cfdaf848c94686aa6`, code `WORKSPACE_CATALOG_CONFLICT`, stage `relationship_validation`.

This response proves which validation branch failed, but does not identify the particular production row. No production database query, data dump, SQL, migration, repair, provider call, or AI request was performed here. No deployed browser or screenshot verification is claimed.

## Exact discovered control flow and root cause

The targeted review covered `api/_workspace-catalog.js`, `api/workspaces.js`, `workspace-catalog.js`, `workspace-sidebar.js`, `app.js`, the BW-36.9/R1 catalog records/checks, BW-36.10/R1 sidebar records/checks, and BW-36.13R1/R2/R3 records/checks and creation paths.

1. `api/workspaces.js:createHandler` verifies the signed cookie with `getSessionUser`, canonicalizes only the verified email through `lookupRequestFromVerifiedSession`, selects at most two `app_identities`, validates the active identity and BIGINT revision, and compares canonical email. A missing identity remains the established HTTP 200 empty result. Disabled, malformed, ambiguous, mismatched, and unsigned identities retain their existing rejection boundaries.
2. `loadWorkspaceCatalog` selects memberships by that identity, `m.status = 'accepted'`, and `w.status = 'active'`. With no accepted active membership it returns empty before querying Brands/Boards.
3. Before this repair, both descendant queries applied existing independent owner/member/editor authorization but **no accepted-Workspace predicate**. The subsequent global `allowed.has(row.workspace_id)` check rejected all results if any independently accessible Brand or Board belonged elsewhere or had a null Workspace. This is the precise source branch matching the supplied production stage. Board-only sharing was incorrectly treated as evidence of Workspace relationship corruption.
4. `workspace-catalog.js:load` rejects the bounded error; `app.js:loadAuthorizedWorkspaceCatalog` catches `WORKSPACE_CATALOG_CONFLICT`, clears protected catalog/active context, sets `error`, and renders the sidebar. `workspace-sidebar.js:render` therefore displays unavailable context and no Brand descendants. The separate Board library/API keeps its independently authorized results.
5. `boardsCreateButton` already has a click listener for `createNewBoardFlow`. That function looked up the active Workspace only when catalog status was `ready`. A missing Workspace called `setSaveStatus(ProjectDialog.copy(...).not_found)` and returned. That status belongs to the Canvas/save UI and is invisible in the Boards view. The existing R3 two-step dialog was never mounted.
6. R1's confirmed-value/stale/error behavior, generation and identity guards and in-flight promise, R2's empty-only first-Workspace creation, and R3's transaction/dialog/reconciliation/navigation remain the foundations of this repair.

## Accepted descendants versus Board-only access

The catalog is the intersection of accepted active Workspace membership and independently authorized Brand/Board descendants. Membership never creates Brand or Board authority. Sharing a Board in Workspace B never creates membership, Brand visibility, or catalog authority for B.

An account with accepted membership in A, a shared Board in B, and a legacy Board with `workspace_id = NULL` receives A and only its independently authorized descendants. External and null rows are omitted; their independent Board read/share/public-token boundaries are unchanged. No heuristic Workspace inference or automatic record reassignment occurs.

## Server correction and integrity

Both descendant SELECTs now require `b.workspace_id = ANY($2::uuid[])` using IDs from the accepted active membership query, **and** retain the exact independent authorization predicates in parentheses. Membership projection is validated before UUID-array queries so malformed/duplicate Workspace IDs fail with a bounded catalog conflict instead of an adapter cast error. A defensive projection scope also omits null/out-of-scope rows returned by an adapter.

The Board SELECT additionally reads only the joined Brand's `workspace_id AS brand_workspace_id` for internal validation. Every projected Board with a Brand reference requires a valid, matching actual Brand Workspace, even if that Brand is independently invisible. Cross-Workspace, missing, or legacy-null referenced Brands fail closed at `relationship_validation`; no hidden Brand identifier or metadata is emitted. A valid same-Workspace hidden Brand still projects the Board with `brand_id: null` as before.

`projectCatalog` continues to reject duplicate projected Workspace/Brand/Board IDs, malformed UUIDs, invalid names/revisions/roles, and inconsistent projected relationships. The versioned response shape and browser validator are unchanged. Optional logos retain R1's presentation-only fallback. No raw row, name, email, identifier, session/token or SQL diagnostic is added; catalog logs retain bounded request IDs/stages/codes and aggregate counts.

## Visible project-launch feedback

The Boards view now has a dedicated live status immediately below its New project row, separate from filtering and Canvas/save statuses. A ready valid Workspace opens the unmodified R3 two-step `FunklixProjectDialog.mount` immediately from memory: no Workspace, Brand, or Board GET is performed. Repeated clicks focus an already open dialog.

Loading/refreshing/idle gives a localized wait-and-click-again message. Error/stale gives localized unavailability and Retry. Confirmed ready/empty gives localized first-Workspace guidance and opens the existing R2 creation dialog through a guarded sidebar controller method. Ready with multiple Workspaces but no selection instructs the user to choose in the existing sidebar. Authentication/pending failures have visible feedback too. Because the same handler is reachable from Canvas, unavailable-context feedback there uses a small native dialog with the existing project-dialog styling; no toolbar/navigation redesign or forced navigation is added.

Retry calls **only** existing `retryWorkspaceCatalog` → `loadAuthorizedWorkspaceCatalog`, preserving single flight, identity/generation checks and stale-response behavior. Feedback completion checks captured account, lifecycle, and whether feedback has been dismissed. Account clearing removes the local feedback. Successful Retry restores context; clicking New project then mounts R3 without another GET. No POST occurs on launch or Retry. Context is also rechecked after an asynchronous unsaved-leave confirmation before mounting the dialog.

English/German copy includes “Workspace unavailable. Please retry.” / “Workspace nicht verfügbar. Bitte erneut versuchen.” and “Retry” / “Erneut versuchen”. Loading, empty, selection, authentication, and pending messages are localized.

## Reachable creation-path review

Repository-wide searches for Board/Brand INSERTs found exactly three server entry points:

| Entry point | Discovered behavior | Final behavior |
| --- | --- | --- |
| `POST /api/projects` → `_project-command.execute` | Explicit transaction resolves active identity, locks active Workspace and accepted membership, independently checks Brand create capability, rejects `CROSS_WORKSPACE_BRAND`, inserts new Brand/Board with the same Workspace and validates outcome before commit | Unchanged authoritative R3 command; regression executes both existing/new Brand cases and cross-Workspace rejection |
| `POST /api/brands` | Inserted `(owner_email,name,brand_core)` without `workspace_id`; called by legacy `submitCanonicalBrandCreation` | Only creation is blocked with HTTP 409 `PROJECT_CREATION_REQUIRED` and New project guidance, before `ensureBrandsTable` or any insert. Existing form displays localized guidance for this 409 |
| `POST /api/boards` | Inserted Board/snapshot/ownership without `workspace_id`, with optional independently resolved Brand; called by `saveBoardAsNew` (conflict recovery) and `duplicateCurrentBoard` | Only creation is blocked with HTTP 409 `PROJECT_CREATION_REQUIRED` and readable guidance before schema/write work. Existing callers receive a string error through their established handling |

R3 normal New project never falls back to either legacy Collection POST. Legacy duplication/conflict-copy cannot safely preserve their old payload through the strict blank-project command and are therefore blocked, rather than silently dropping Canvas content or inventing a Workspace. The old direct Brand create path is similarly blocked instead of composing separate Brand and Board mutations. Existing Brand updates, Board updates/claims, collection GETs, direct reads, sharing and public tokens are unchanged. No existing data is edited and no normal successful Board/Brand creation can leave `workspace_id = NULL`.

## Focused automated validation

The new dependency-free `npm run check:bw36.13r3r1` uses the actual signed-session catalog handler, strict browser catalog, sidebar renderer, R3 dialog, application launch glue and loader, independent Board authorization, blocked legacy handlers, and authoritative project service against invented PostgreSQL/DOM adapters. No real network/database/provider/AI activity occurs.

Fixtures cover accepted A, extra shared B, extra null legacy Board/Brand, both SQL-scoped and defensive adapter projection, no external leaks, independent Board-only/legacy reads, no membership expansion, hidden/visible cross-Workspace Brand conflicts, dangling references, duplicate/malformed IDs and invalid roles, same-Workspace hidden Brand privacy, actual Workspace/Brand sidebar text, R3 open with zero GET, localized error/stale/loading feedback, double Retry with one GET and zero mutations, retry success/failure, account-change stale rejection, empty R2 dialog, missing selection, Canvas-visible feedback, legacy POST blocking, and atomic R3 Workspace assignment/cross-Workspace rollback.

Required checks passed:

- New `check:bw36.13r3r1`.
- `check:bw36.9r1`, `check:bw36.10r1`, `check:bw36.11r1`.
- `check:bw36.13r1`, `check:bw36.13r2`, `check:bw36.13r3`.
- `node scripts/check-browser-script-integrity.js` (34 local classic scripts).
- `node --check` for every changed JavaScript file.
- `git diff --check`.
- Directly affected historical checks: BW-36.9, BW-10, BW-11, BW-12, BW-18, BW-19, BW-20, and Canonical Brand foundation.

The old BW-36.9 and BW-36.9R1 fixtures previously expected a conflict merely because an independently accessible Brand was outside membership. Those assertions now expect successful exclusion and additionally assert a real in-scope Board-to-external-Brand conflict. Valid Board fixtures include the new internal joined Brand Workspace column. Identity, permission, privacy, strict response, no-write and no-migration checks are retained. Specifically, `check-bw11-create-board-from-canonical-brand.js` now asserts the legacy gate/no insert while retaining R3 Brand capability, Workspace match, snapshot and rollback assertions; `check-bw12-canonical-snapshot-provenance.js` checks creation provenance against `_project-command.js` instead of the retired Collection POST, retaining every read/edit/association/public boundary; `check-canonical-brand-foundation.js` expects 409 for all legacy creation payloads/actors, asserts no queries or inserts and keeps authentication, independent Brand reads/updates, ownership/revision immutability, legacy/shared Board reads/saves/restores and schema initialization/retry probes. Authoritative creation is dynamically covered by R3 and R3R1, rather than assuming old Collection POST success. The BW-36.9R1 check required execution outside the process sandbox because its internal `git status` subprocess reported `EPERM`; it then passed unchanged. No blanket npm sweep was performed. The new check is registered after R3 in Runtime Boot Safety; the full workflow remains CI's responsibility.

## Deployment and rollback

Deployment has **not** been performed. After the separately created normal PR is reviewed/merged and CI passes, deploy the server routes and browser assets together. The supplied evidence confirms the R3 migration was applied; this repair requires **no migration and no manual SQL**. Do not edit/rerun BW-36.8 or BW-36.13R3, repair rows, or run remote data changes.

Rollback by reverting this repair's application commit and redeploying the matching bundle. Retain all existing schemas and data. Rollback restores the known catalog failure behavior and the legacy creation gaps, so a forward fix is preferable; no data rollback or migration is part of it.

## Exact manual acceptance after deployment — not yet performed

1. Als Felix anmelden.
2. Boards öffnen.
3. Prüfen, dass der autorisierte Workspace links erscheint.
4. Prüfen, dass dessen autorisierte Brands erscheinen.
5. Bestehendes Board mit Brand öffnen und korrekten Kontext prüfen.
6. Zur Boards-Ansicht zurückkehren.
7. „New project“ klicken.
8. Prüfen, dass der zweistufige Dialog sofort öffnet.
9. Bestehende Brand auswählen und Projekt erstellen.
10. Prüfen, dass direkt in das neue Board navigiert wird.
11. Prüfen, dass Workspace und Brand im neuen Board erhalten bleiben.
12. Fehlerszenario kontrolliert simulieren und sichtbaren Retry prüfen. Beispielsweise im Browser die Katalogantwort lokal mit einem begrenzten 503-Fehler überschreiben, den Katalog kontrolliert erneut laden, New project klicken, Override entfernen und Retry klicken. Prüfen: verständlicher lokaler Fehler, ein GET bei Retry, keine Mutation, danach öffnet der nächste New-project-Klick sofort R3 ohne weiteren GET.
13. Keine Screenshot- oder Browserprüfung behaupten, wenn sie nicht tatsächlich durchgeführt wurde.

Additionally verify loading feedback, ready/empty first-Workspace guidance, no-selection guidance, English/German copy, keyboard focus, stale account rejection, and the visible feedback for the Canvas entry point. These are pending manual checks, not automated visual evidence. No PR or draft PR is created by this delivery.
