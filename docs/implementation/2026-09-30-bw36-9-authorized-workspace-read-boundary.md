# BW-36.9 — Authorized Workspace read boundary

## Accepted production evidence

This implementation starts from the accepted, manually executed BW-36.8 production state: 6 identities, 5 Workspaces, 6 accepted memberships, 6 assigned Brands, and 20 assigned Boards. The complete verification reported `workspace_backfill_verification = ok`, zero exception records, access expansion/loss, quarantine rows, identity collisions, cross-Workspace inconsistencies, or orphan references. Existing Board shares, Brand memberships, Campaign Brand Snapshots, and public-token state were preserved. The reported Google login, Brands, Boards, Canvas, Content Workspace, Calendar, Auto-plan, sharing, and export smoke tests also passed.

## Endpoint and contract

`GET /api/workspaces` is the only new route. It accepts no request identity, email, role, membership, or filtering authority. It always sends JSON, `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, and a bounded random request ID. Non-GET methods receive `405` and `Allow: GET`.

Successful responses use the exact `workspace_catalog_v1` contract:

```json
{"contract":"workspace_catalog_v1","request_id":"24 lowercase hexadecimal characters","workspaces":[{"id":"Workspace UUID","name":"Name","avatar_url":null,"locale":"en","revision":1,"role":"owner","brands":[{"id":"Brand UUID","name":"Name","avatar_url":null,"revision":1,"role":"owner"}],"boards":[{"id":"Board UUID","name":"Name","brand_id":"Brand UUID or null","role":"owner"}]}]}
```

The schema has no canonical Brand avatar column. Therefore Brand `avatar_url` is deliberately `null`; no Brand Core or Campaign Snapshot is read to invent one. Board `brand_id` is returned only when that Brand is also independently authorized in the same Workspace. Otherwise it is privacy-preservingly `null`. No email, identity or membership ID, invitation/provider data, token/hash, content, Brand Core, Snapshot, prompt, comment, schedule, publication, or database metadata is projected.

## Identity and authorization flow

The route verifies the existing signed `funklix_session` cookie, canonicalizes its verified Google email with the application identity bridge's trim-and-lowercase rule, and performs a bounded lookup of `public.app_identities`. Missing identity is an authorized empty catalog. Malformed, disabled, or ambiguous identities fail closed. `auth.users` and `auth.uid()` are not application identity authorities.

The stable `app_identities.id` resolves only accepted `workspace_memberships.identity_id` rows joined to active Workspaces. Membership grants catalog discoverability, not descendant authority. Brands are independently selected only through existing ownership or `brand_members`; Boards are independently selected only through existing ownership, `board_editors`, or established Brand-derived Board access. Workspace membership never expands these sets.

A Brand member holding the minimal Workspace viewer membership sees that Workspace and only independently accessible descendants. A Workspace viewer does not see unrelated descendants. A Board-only collaborator without accepted Workspace membership gets an empty Workspace catalog and retains the unchanged Board route. Public-token requests have no signed session and receive `AUTHENTICATION_REQUIRED`; the public Board route remains separate. Revoked/pending/expired memberships and inactive/archived Workspaces are excluded. Missing, duplicate, or cross-Workspace relationships fail as `WORKSPACE_CATALOG_CONFLICT` rather than being inferred or silently reassigned.

## Runtime cutover and cleanup

The dependency-free classic script `workspace-catalog.js` loads immediately before `app.js`. It performs exactly `GET /api/workspaces` with `credentials: same-origin`, validates every allowlisted key/type/UUID/role and all relationships, rejects duplicates, and exposes only `load`, `validate`, and `deriveActiveWorkspaceId`. It has no DOM rendering, storage, database, provider, or AI access.

After a verified authenticated bootstrap, `app.js` starts one catalog request for that account/generation. The shared promise suppresses duplicates. Completion is accepted only while the lifecycle object, generation, and canonical account still match. Account change and sign-out immediately clear the catalog, error, active Workspace, and increment the generation, making late responses stale. There are no retries and resize/theme handlers cannot fetch it. A bounded failure remains runtime-only and cannot interrupt existing product boot.

Active Workspace derivation is deterministic: an authorized active Board first, then an authorized active Brand, then the sole Workspace, otherwise `null`. Board hydration recomputes this context because initial session loading intentionally precedes Board loading. The result is session-owned memory only: it moves nothing, persists nothing, reopens nothing, changes no association, and renders nothing.

## Errors, diagnostics, and privacy

The bounded codes are `METHOD_NOT_ALLOWED` (405), `AUTHENTICATION_REQUIRED` (401), `SESSION_INVALID` (401), `IDENTITY_INVALID` (422), `IDENTITY_DISABLED` (403), `IDENTITY_AMBIGUOUS` (409), `WORKSPACE_SCHEMA_UNAVAILABLE` (503), `WORKSPACE_CATALOG_CONFLICT` (409), `DATABASE_UNAVAILABLE` (503), `RESPONSE_INVALID` (500), and `INTERNAL_ERROR` (500). Responses include only contract, request ID, code, and stage.

Server diagnostics contain only request ID, stage/code, Workspace/Brand/Board/membership counts, and a coarse duration bucket. They never log names, emails, UUIDs, tokens, session/provider payloads, bodies, rows, content, or raw database errors.

## UI and database boundaries

There is intentionally no selector, sidebar/navigation change, status copy, or rendering in this phase. Canvas toolbar, compact context bar, temporary Brand sidebar, Brand/Board workspaces, Content/Calendar, Auto-plan, export, AI Brain, Insights, Funnel, localization, theme, and responsiveness remain unchanged.

No migration or manual SQL is required. BW-36.6, BW-36.7R2, and BW-36.8 already provide every required table, identity reference, Workspace assignment, status, role, revision, and index. This implementation performs SELECTs only and does not alter RLS, grants, production data, memberships, or descendant authorization.

## Deployment and rollback

Deploy the route/service, browser module, `app.js`/`index.html` registration, regression/workflow registration, and this record together after Runtime Boot Safety passes. Confirm `POSTGRES_URL` and the existing session secret are present; no new environment variable or SQL step is needed. Then perform the browser acceptance below.

Rollback by reverting the single BW-36.9 commit and redeploying. This removes the route and runtime read without data repair because the implementation has no mutation. Leave all BW-36.6–36.8 schema/data in place. If catalog conflicts appear, inspect production consistency privately; do not broaden access or infer associations.

## Manual browser acceptance

Using an authenticated deployed preview and invented/test-safe records where possible:

1. Sign in as an owner with one Workspace. In Network, confirm one successful `/api/workspaces` GET for the authenticated bootstrap and the bounded contract.
2. Sign in as a user with multiple authorized Workspaces. Confirm all and only accepted/active catalogs arrive and there is no visible selector or navigation change.
3. Sign in as the qualifying Brand member/Workspace viewer. Confirm only their existing Brand and independently authorized Boards appear in JSON.
4. Sign in as a Board-only collaborator. Confirm an empty Workspace catalog while their shared Board still opens.
5. Sign out, then sign in as another account. Confirm the first catalog clears immediately, one new request occurs, and no former UUID/name remains in runtime state.
6. Revoke a test membership and bootstrap again. Confirm its Workspace is absent without retry.
7. Open existing owned Brand and Board surfaces and a shared Board; verify unchanged permissions and content.
8. Open an existing public Board link in a signed-out/private window. Verify the Board works and `/api/workspaces` is neither used by that path nor accessible without authentication.
9. Exercise Canvas, Content Workspace, Content Calendar, Auto-plan, CSV export, PDF export, AI Brain, Insights, and Funnel Simulator; confirm established behavior.
10. Toggle dark/light mode and resize continuously. Confirm presentation is unchanged and neither action creates a Workspace request.
11. In Network, confirm exactly one Workspace request per authenticated bootstrap generation, no blind retries, no provider/AI request caused by catalog loading, and no Workspace mutation request.
12. In Console, confirm catalog diagnostics contain no names, emails, UUIDs, tokens, payloads, rows, content, or raw database errors.

No authenticated deployed preview/browser executable was available during implementation, so these are required manual release checks, not claims of visual proof. Deterministic handler and VM fixtures are regression evidence only.

## Later dependency and non-goals

The future Workspace selector/sidebar phase may consume this validated runtime catalog and active ID. It must retain this authority and lifecycle boundary. BW-36.9 does **not** add UI, preference persistence, Workspace mutation, invitation/member management, descendant inheritance, association changes, direct browser database access, new Brand inference, public catalog access, migrations, backfills, or production/provider/AI calls.
