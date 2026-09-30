# BW-36.9R1 — Workspace identity resolution repair

## Deployed evidence and scope

BW-36.8 completed successfully in production and is authoritative: 6 active application identities, 5 active Workspaces, 6 accepted memberships, 6 assigned Brands, and 20 assigned Boards. Its verification returned `workspace_backfill_verification = ok`, `record_count = 0`, zero identity collisions or orphaned identity references, and zero access-expansion or access-loss cases. Existing product smoke tests passed. After BW-36.9 deployment, an authenticated browser made exactly one `GET /api/workspaces`; the route returned HTTP 422 with contract `workspace_catalog_v1`, a bounded request ID, and `IDENTITY_INVALID` at the identity stage. The catalog projection was therefore never reached.

This R1 is limited to repairing that server identity boundary. It adds no UI and changes no production data, Workspace architecture, membership, Brand assignment, Board assignment, browser database access, or descendant authorization.

## Verified root cause

BW-36.7R2 defines `public.app_identities.revision` as PostgreSQL `BIGINT NOT NULL`. BW-36.8 inserted each identity with numeric revision `0`. The production adapter is the repository's standard `pg`/node-postgres `Pool`; node-postgres returns PostgreSQL `int8` (`BIGINT`, OID 20) as a string by default so it does not silently lose precision. Thus the deployed identity query returned the exact selected row shape `{ id, canonical_email, status, revision: "0" }` inside the normal `{ rows: [...] }` query-result envelope.

BW-36.9 selected the correct four columns and read the correct `rows` array, but `validateIdentityRow` required `Number.isSafeInteger(row.revision)`. That predicate rejects the valid production string `"0"`, classifying every backfilled identity as malformed and producing the observed HTTP 422. The BW-36.9 regression used `revision: 1` as a JavaScript number in its database double rather than the production adapter's string representation, so it did not reproduce the deployed boundary.

R1 retains the exact query and adapter envelope. It accepts only a non-negative canonical decimal string or non-negative safe integer, converts it to a safe integer, and continues to reject negative, fractional, non-canonical, non-numeric, and unsafe revisions. UUID, canonical email, status, duplicate, and relationship validation are unchanged and remain fail-closed.

## Corrected identity and catalog flow

1. The existing signed `funklix_session` is verified by the existing session boundary.
2. Only the verified session email is accepted and canonicalized with the established `lower(btrim(email))` equivalent (`trim().toLowerCase()`). Query/body identity, email, role, token, and membership values have no authority.
3. The server `pg` adapter queries `public.app_identities` for exactly `id`, `canonical_email`, `status`, and `revision`, bounded to two rows, and requires the production `{ rows: [] }` envelope.
4. A single active matching identity with a valid UUID, canonical email, status, and safely representable BIGINT revision proceeds to membership lookup. A missing identity returns HTTP 200 with an empty catalog. No accepted active Workspace membership also returns HTTP 200 with an empty catalog.
5. Disabled identities return `IDENTITY_DISABLED`; truly malformed rows or canonical mismatches return `IDENTITY_INVALID`; multiple matches return `IDENTITY_AMBIGUOUS`; database unavailability remains `DATABASE_UNAVAILABLE`.
6. Accepted membership establishes Workspace visibility only. Brand and Board rows still require their independent, existing authorization. A Board-only collaborator receives an empty Workspace catalog, public-token access cannot invoke signed-session identity authority, and any descendant outside an accepted active Workspace fails closed.
7. The response remains the privacy-bounded `workspace_catalog_v1` projection and contains no identity ID, email, membership ID, tokens, session content, or other sensitive identity fields.

## Diagnostics and errors

The same response `request_id` is carried through bounded internal diagnostics for identity query construction, query execution, response normalization, row validation, canonical comparison, membership lookup, catalog projection, and response construction. Final success/error diagnostics keep the existing bounded counts, code, stage, and coarse duration bucket. Diagnostics never include email, identity/Workspace UUID, names, tokens, session content, database rows, or raw SQL/database error text. Browser errors remain bounded to contract, request ID, code, and stage.

The production-shaped regression invokes the actual route handler through the real signed-session verifier, canonical-email helper, identity query, production query-result envelope, validator, catalog service, and JSON responder. Its invented BW-36.7R2/BW-36.8 identity uses a valid UUID, active status, canonical email, and the node-postgres BIGINT string `"0"`. It covers empty identity/membership behavior, disabled/malformed/ambiguous identity, database failure, exact selected columns, malformed adapter envelope, isolation/no expansion, public-token and Board-only behavior, request-authority rejection, duplicate browser request suppression, privacy-safe diagnostics, and zero writes/provider/AI/network calls.

## Database and authorization impact

No migration is required. No manual SQL is required. **BW-36.8 must not be rerun.** No production data repair is required. The repair performs only the same SELECT operations and does not change schemas, RLS, grants, identities, Workspace memberships, Brands, Boards, sharing, public tokens, or any authorization relationship. It does not use `auth.users` or `auth.uid()` and adds no fallback, retry, browser-local authority, or access inheritance.

## Deployment and rollback

Deploy the application repair, focused regression, Runtime Boot Safety registration, and this implementation record together after the complete workflow passes. No database action, maintenance window, backfill, environment-variable change, or provider change accompanies deployment.

Rollback by reverting the single `BW-36.9R1: repair Workspace identity resolution` commit and redeploying. Do not roll back BW-36.7R2/BW-36.8, rerun the backfill, or edit identities/memberships. Rollback restores the known HTTP 422 behavior for valid production BIGINT-backed identities but cannot alter production data because R1 contains no writes.

## Manual acceptance after deployment

The only required first browser check is:

1. Sign in normally.
2. Open DevTools Network with the filter `workspaces`.
3. Reload once.
4. Confirm exactly one `GET /api/workspaces`.
5. Confirm HTTP 200.
6. Confirm contract `workspace_catalog_v1`.
7. Confirm the authorized Workspace catalog is returned.

No authenticated deployed browser was available in the implementation environment, so this post-deployment browser acceptance remains for the user. No additional diagnostic procedure is required before proving this primary path.
