# BW-36.7R2 — application identity bridge

## Evidence and root cause

BW-36.7 treated Supabase `auth.users` as the identity authority for Workspace backfill. BW-36.7R1's manually run production diagnostic disproved that assumption: six Brand-owner, twenty Board-owner, one Brand-member, and eleven Board-share relationships (38 total) were non-empty, email-shaped, unambiguous, and supported by the application's normalized signed-session-email model. None matched `auth.users`; there were zero unique blocking records and zero production identity anomalies. The reported 38 blockers were therefore false positives caused by the preflight join, not unresolved identities.

Repository inspection confirms that Google callback data is placed in a signed, HttpOnly session and server routes recover the verified user through `_auth-session.js`. Brand ownership/membership and Board ownership/shares compare `lower(trim(email))` at authenticated server boundaries. Database modules use the server-held connection/service credential. No browser code queries `workspaces` or `workspace_memberships`; those names occur only in migrations, diagnostics, documentation, and server-side checks. Existing browser calls target authenticated application APIs. Consequently no direct browser Workspace access is required, and no policy is weakened.

### Inspected BW-36.6 state

The historical migration defines `workspaces(id, name, avatar_url, locale, status, revision, created_by_user_id, created_at, updated_at, archived_at)` and `workspace_memberships(workspace_id, user_id, role, status, invited_by_user_id, revision, created_at, updated_at, revoked_at)`. Membership has a restrictive Workspace foreign key and a `(workspace_id, user_id)` unique constraint. Brands and Boards each have a nullable, restrictive `workspace_id` foreign key. There is no identity foreign key on the three misleading actor/member UUID columns.

Both Workspace tables have RLS enabled. Their only policies are authenticated SELECT policies: `workspace_member_read` and `workspace_membership_bounded_read`; both ultimately rely on `auth.uid()` through `workspace_has_active_role`. `PUBLIC`, `anon`, and `authenticated` have all table privileges revoked, then `authenticated` receives SELECT only. The role helper is executable only by `authenticated`; the last-owner helper is revoked from all browser roles. The `workspace_memberships_last_owner_guard` runs before deletion or updates to Workspace/role/status and uses a transaction advisory lock before refusing removal of the final accepted owner. These facts are all preconditions rather than assumptions in R2.

## Correct identity model

The hierarchy is: verified signed Google session email → canonical `lower(trim(email))` → one stable `public.app_identities.id` UUID → `workspace_memberships.identity_id`. Email remains the authenticated lookup key while legacy Brand and Board authorization remains email-based during migration. Email-change/merge semantics are explicitly outside this phase.

`public.app_identities` has exactly the durable minimum:

| column | contract |
|---|---|
| `id` | UUID primary key, `gen_random_uuid()` |
| `canonical_email` | private, non-empty normalized text, unique |
| `status` | exactly `active` or `disabled`; default `active` |
| `revision` | non-negative bigint; deterministic default `1` |
| `created_at`, `updated_at` | non-null timestamptz, default `now()` |

It stores no provider/access/refresh token, Google payload, avatar, display name, metadata, raw session, cookie, or password. Disabled identities retain references for audit but cannot pass future Workspace authorization. Public-token consumers never receive identity email or Workspace catalogs.

## Migration behavior and security

`20260929_bw36_7r2_application_identity_bridge.sql` is one transaction. Before DDL it refuses an existing/partial `app_identities`, any Workspace or membership row, any Brand/Board Workspace assignment, or a mismatch in the expected BW-36.6 columns, restrictive foreign keys, indexes, RLS policies, helper, and last-owner trigger. Its bounded `bw36_7r2_*` errors instruct the operator to stop. A transaction failure rolls everything back; a second execution refuses clearly.

The migration creates the empty identity table, enables RLS, creates no policy, and revokes `PUBLIC`, `anon`, and `authenticated`. It removes the two `auth.uid()` Workspace read policies and their helper, renames `created_by_user_id`, `user_id`, and `invited_by_user_id` to `created_by_identity_id`, `identity_id`, and `invited_by_identity_id`, and adds restrictive foreign keys to `app_identities(id)`. Existing role, lifecycle, revision, timestamps, revocation and uniqueness semantics remain. The last-owner trigger is recreated for `identity_id`, retaining its advisory transaction lock and accepted-owner rule. Workspaces and memberships stay RLS-enabled and directly inaccessible to browser roles.

Service-role bypass is transport capability, **not authorization**. Every future server operation must verify the signed session, resolve canonical email to one active identity, validate membership and explicit Workspace predicates, and execute authorization plus mutation in the same database transaction. `_app-identity.js` only constructs/validates that pure contract; it performs no lookup and grants no access. `_workspace-authorization.js` only evaluates stable UUID membership facts; it implies no Brand, Board, share, or public-token access.

## Isolation and non-goals

Board-only collaborators remain Board-only. Public Board tokens remain isolated anonymous Board access. Neither becomes Brand or Workspace membership. Existing Brand, Board, member, share, snapshot, content, Canvas, AI, provider, login, and UI behavior is unchanged.

This phase does not create identities. This phase does not create Workspaces. This phase does not create memberships. This phase does not backfill Brands or Boards. This phase does not activate UI. It also does not activate runtime Workspace routes or establish backfill readiness.

A later corrected preflight must project the distinct canonical emails that will become application identities. A later transactional backfill must create identities, Workspaces, memberships, and assignments atomically and idempotently while preserving Board-only and public-token isolation.

## Manual deployment and verification

1. Merge and deploy BW-36.7R2.
2. Open the correct Supabase project.
3. Open `migrations/20260929_bw36_7r2_application_identity_bridge.sql` from the merged repository.
4. Copy the complete raw file without modification.
5. Paste it into a new Supabase SQL Editor query.
6. Verify the target project and environment.
7. Execute the migration exactly once.
8. Confirm `public.app_identities` exists and contains zero rows.
9. Confirm `workspaces` still contains zero rows.
10. Confirm `workspace_memberships` still contains zero rows.
11. Confirm every Brand and Board still has a null `workspace_id`.
12. Confirm Workspace membership references `identity_id`.
13. Confirm all Workspace identity foreign keys reference `public.app_identities(id)` with restrictive deletion.
14. Confirm no direct browser policy exposes application identities or Workspace catalogs and browser roles have no table privileges.
15. Perform existing login, Brand, Board, sharing, public-token, and Canvas smoke tests.
16. Do not manually insert application identities.
17. Do not manually create Workspaces or memberships.
18. Do not run a backfill.
19. Capture the complete SQL success result and verification output before proceeding.

If the migration reports adoption or schema mismatch, do not edit around the guard. Capture the exact bounded error and stop. No production SQL is executed by repository checks.

## Rollback refusal

Rollback is operator-reviewed and is not automatically executed. Destructive removal of the bridge is permissible only while `app_identities`, `workspaces`, and `workspace_memberships` all contain zero rows, all Brand and Board `workspace_id` values remain null, and no later migration depends on the bridge. If any identity or Workspace adoption exists, destructive rollback must refuse; disable affected behavior and roll forward instead.
