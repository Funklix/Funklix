# BW-36.13R2 — Phase 1A first Workspace creation

## Evidence ledger

### Verified current behavior

- The signed `funklix_session`, verified by `getSessionUser()`, is the authentication authority. Its verified email is trimmed, lower-cased, syntax checked, and compared with the application identity canonical email.
- The deployed foundation has `app_identities`, active/archived `workspaces`, and accepted/pending/revoked/expired `workspace_memberships`. `created_by_identity_id`, `identity_id`, and `invited_by_identity_id` reference `app_identities` with restrictive deletion. Workspace names are database-bounded to 160 characters; locale defaults to `en`; Workspace and membership revisions default to 1. The last accepted owner trigger uses a transaction advisory lock.
- The server catalog is `workspace_catalog_v1`. It selects accepted memberships in active Workspaces, then independently authorized Brands and Boards, and rejects cross-Workspace relationships. Browser validation is strict. A successful no-identity GET and a successful identity with no accepted active membership both project as `workspaces: []`.
- Phase 0 preserves a confirmed catalog during retryable failure, while authentication, account, permission, and integrity failures clear it. Account identity plus generation prevent stale catalog reconciliation. Optional malformed logo metadata degrades locally, and the existing rename/menu behavior is body-owned and bounded.
- The deployed schema supports this phase without a migration: server-side PostgreSQL transactions can insert an application identity, Workspace, and membership, and the existing unique canonical-email index plus advisory lock supports serialization.

### Implementation decisions

- `POST /api/workspaces` alone owns `workspace_create_v1`. It accepts exactly `contract`, `request_id`, and `name`; the shared Unicode-aware name validator is authoritative.
- After signed-session verification and canonicalization, one explicit transaction obtains `pg_advisory_xact_lock(hashtextextended(canonical_email, 3613))`, resolves or creates the active identity, rechecks accepted memberships in active Workspaces, inserts the Workspace and exactly one accepted owner membership, checks that exactly one accepted owner exists, and commits.
- A post-lock single accepted active owner membership with the same normalized name is the response-loss/retry result (`created: false`). Any other accepted active membership is `WORKSPACE_ALREADY_EXISTS`. Board-only sharing is deliberately absent from this authorization query.
- The browser exposes creation only for authenticated `ready` catalog state with an exactly empty catalog. It strictly validates the complete response, reconciles it immutably without GET/reload/navigation/storage, and checks the captured account object, canonical identity, and catalog generation before reconciliation.

### Remaining deferred work

- Phase 1B and Phases 2–4 retain Project/Brand/Board creation, Brand setup/logo discovery, Profile/snapshot information architecture, and downstream Campaign/Calendar/export acceptance. Additional Workspace creation, invitations, membership management, selection persistence, archival/deletion, and all provider/AI work remain out of scope.

## Contracts and authorization

The request is `{"contract":"workspace_create_v1","request_id":"…","name":"…"}` with no unknown fields. Success echoes the client request ID and returns `ok`, `created`, and the catalog-compatible Workspace fields `id`, normalized `name`, `role: "owner"`, the deployed revision, and empty `brands`/`boards`. It exposes no identity, email, membership, session, token, provider, storage, or database row.

Only a valid signed session with zero accepted memberships in active Workspaces is eligible. No Workspace/Brand/Board/public/provider/AI role substitutes for the session. A missing identity is created active in the transaction; one active identity is reused; disabled, malformed, or ambiguous identities fail closed. Creation does not query or mutate Brand/Board authority and grants no descendant access.

Errors are bounded to the versioned contract with request/correlation ID, code, and stage. Supported create categories are `METHOD_NOT_ALLOWED`, `AUTHENTICATION_REQUIRED`, `SESSION_INVALID`, `REQUEST_INVALID`, `WORKSPACE_NAME_INVALID`, `IDENTITY_DISABLED`, `IDENTITY_AMBIGUOUS`, `WORKSPACE_ALREADY_EXISTS`, `WORKSPACE_SCHEMA_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, and `INTERNAL_ERROR`; SQL/JavaScript details are not returned.

## Transaction, duplicate safety, and rollback

The exact order is: verify session outside the database; canonicalize verified email; `BEGIN`; identity-scoped transaction advisory lock; select at most two identity rows; insert an active revision-0 identity only when absent; validate and compare it; lock/recheck accepted active memberships; either return the one same-name owner Workspace or insert an active `en` Workspace; insert one accepted owner membership; count exactly one accepted owner; `COMMIT`. Every pre-commit error issues `ROLLBACK`, including failures after identity or Workspace insertion. The connection is always released.

The lock serializes double-clicks and concurrent retries for one canonical identity. Identical names return the committed Workspace with `created: false`; different names yield one creation and one bounded conflict. The client also reuses its in-flight operation, but browser state is never treated as proof of server success.

## UI, account safety, privacy, and accessibility

The restrained localized action is “Create workspace” / “Workspace erstellen”. It exists only in authenticated, successfully loaded, genuinely empty state—not loading, refreshing/stale, retryable error, permission loss, or integrity error. A compact body-owned dialog has a heading, description, one name input, Cancel, and Create. It autofocuses, submits on Enter, closes without requests on Escape/Cancel, contains Tab focus, restores focus, prevents duplicate submits, retains input on recoverable errors, and uses an `aria-live` inline status. Controls meet 44px targets; desktop/mobile height, forced colors, dark tokens, reduced motion, and zoom remain bounded.

On success, strict response validation occurs before immutable catalog reconciliation. The captured lifecycle object, generation, and canonical account must still match. The Workspace becomes active with empty Brands/Boards and one existing hierarchy rerender; there is no follow-up GET, page reload, navigation, Canvas/compact-bar mutation, or browser storage. No native alert or raw error is rendered.

## Deployment, rollback, and manual acceptance

There is no migration, manual SQL, RLS/storage change, dependency, or previous-migration rerun. Deploy the route and browser assets together. Rollback is reverting this application commit; it must not remove successfully created identities, Workspaces, or memberships. To disable after deployment, roll forward with both route capability and UI action disabled rather than deleting data.

Manually verify a genuinely empty authenticated account, catalog-failure suppression, localized validation/errors, desktop/mobile/dark/forced-color/keyboard/200% layout, double-click behavior, immediate hierarchy reconciliation, reload durability, existing-account suppression, and rename continuity. Authenticated preview verification was unavailable in the implementation environment; DOM fixtures are automated evidence, not visual proof.

Phase 1B may rely on the resulting active Workspace and accepted owner membership, but must introduce its own atomic Project/Brand/Board boundary and must not broaden authorization from Workspace membership.
