# BW-36.11 — safe Workspace renaming

## Boundary and authorization

The only write boundary is `PATCH /api/workspaces` with the `workspace_update_v1` contract. The body contains only `contract`, `workspace_id`, `expected_revision`, `name`, and a bounded `request_id`. The signed session is verified and its email canonicalized before the active `public.app_identities` record is resolved. Client-supplied identity, membership, role, owner, Brand, Board, status, revision override, and arbitrary fields are rejected.

After identity resolution, one database transaction locks the active Workspace and then the caller's accepted membership. Only `owner` and `admin` may continue; `member`, `viewer`, missing, and revoked memberships receive bounded errors. Workspace membership confers no Brand or Board authority, and neither public-token nor Board-only collaboration is an authentication path for this mutation.

## Contracts, normalization, and concurrency

The shared `workspace-name.js` pure validator runs in Node and the browser. It NFC-normalizes, trims, collapses whitespace, rejects controls (including tabs and line breaks), empty/invisible/punctuation-only values, and values beyond the database boundary of 160 Unicode code points. It preserves safe text, accents, ampersands, and emoji. Markup is stored only as plain text and rendered with DOM `textContent`; it is never executed. Names are not globally unique and are never derived from identity or descendant data.

Following row locks and authorization, the server compares `expected_revision`. A mismatch rolls back with HTTP 409 and `WORKSPACE_CHANGED`; there is no retry or overwrite. A changed normalized name updates only `workspaces.name`, increments `workspaces.revision`, and sets `workspaces.updated_at`. An identical normalized name commits as an idempotent no-op without changing revision or timestamp. The response exposes only the catalog-safe Workspace summary (`id`, `name`, `avatar_url`, `locale`, `revision`, `role`) and echoes the caller correlation ID.

## Browser and UI

The compact selector shows a restrained 44px ellipsis action only for owners and admins. It opens a bounded inline dialog prefilled with the current name, autofocuses/selects the field, supports Enter, Escape, Cancel, and Save, prevents duplicate submission, and restores action focus after cancellation. Members and viewers retain their read-only treatment and have no rename action. Failures keep the editor and entered value open, release pending state, and require an explicit retry.

Success validates the response and immutably replaces only the matching item in the current `workspace_catalog_v1` state. The existing render updates the trigger and open option immediately. Active Workspace, Brand, Board, view, and all unrelated Workspace objects remain intact. The operation makes exactly one PATCH, no follow-up catalog GET, no reload, and no provider or AI request. English and German copy is complete. Existing light/dark tokens, compact/expanded layouts, mobile bounds, Canvas toolbar, and compact context bar remain unchanged.

## Privacy and operations

Diagnostics are bounded to correlation request ID, stage, code, role category, changed/no-op state, and duration bucket. They never log names, UUIDs, email, request/session content, or rows. Database failures are mapped to bounded public codes; raw SQL errors are not returned.

Deployment requires the application files only: **no migration and no manual SQL**. Deploy normally after Runtime Boot Safety succeeds. Manual acceptance: sign in as an owner/admin, rename from the selector, confirm immediate text replacement and preserved context; verify no GET follows the PATCH; test no-op and stale-revision behavior; confirm member/viewer suppression; test Enter, Escape, focus return, mobile bounds, and both languages/themes.

Rollback is an application-code rollback of this commit. Because there is no schema or data migration, no database rollback is needed; an already-renamed Workspace safely retains its valid name and revision.

## Explicit deferrals

Workspace creation, deletion, archival, invitations, membership management, avatar editing, general settings, Brand movement, and Board movement remain explicitly deferred. This phase does not mutate identities, memberships, Brands, Brand memberships, Boards, shares, snapshots, tokens, schedules, approvals, publications, provider data, or AI data.
