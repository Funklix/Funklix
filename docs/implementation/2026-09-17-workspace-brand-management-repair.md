# Workspace Brand management repair

## Canonical entity and terminology
The sidebar says **Workspace**, but its authoritative records are the existing `brands` rows exposed by `/api/brands`. This repair keeps that model and calls the destructive operation Canonical Brand deletion; it creates no Workspace table or parallel browser deletion state.

## Root causes
Deletion was missing because the item route accepted only GET and PUT and the selector rendered only selection buttons. The bright dark-mode trigger came from `.brand-switcher-summary { background: rgba(255, 255, 255, 0.72) }` (and a white-oriented hover/menu surface), bypassing the established theme variables.

## Authorization and transaction boundary
DELETE authenticates through the signed session, validates the UUID, locks and resolves the Brand by `id + owner_email`, and compares an exact server-authoritative name confirmation. Members, including admins, editors, and viewers, cannot delete. There is no system/undeletable Brand concept in the schema. A single PostgreSQL transaction explicitly detaches Boards, deletes exclusively Brand-owned memberships, and deletes the Brand; any failure rolls back all steps. Responses expose only allowlisted fields, stable codes, and a generated request ID. A failed deletion emits one sanitized event without content, email, request body, stack, or credentials.

## Persisted deletion graph and Board guarantee
The inspected Brand dependencies are `boards.brand_id` and `brand_members.brand_id`. Board-owned Brand Core snapshots/provenance live on Boards and are deliberately retained. Documents and processing rows are Board-scoped; social publishing, approvals, publications, connections, Canvas nodes, and user accounts are not Brand children and are untouched. The operation clears `boards.brand_id`, deletes `brand_members`, then deletes `brands`. The existing Board FK is `ON DELETE SET NULL` as defense in depth, but the route does not rely on cascade behavior. Workspace selection is a per-user local preference rather than a server row; the successful client response clears it only when it references the deleted Brand, then refreshes the authoritative catalog.

## Migration conclusion
No migration is required. The nullable `boards.brand_id` column and its existing `ON DELETE SET NULL` foreign key already represent the safe detach semantics, while `brand_members` is the only exclusive Brand child. Explicit transaction statements make the operation reviewable without changing schema or RLS policy. Server routes use the trusted backend pool and enforce ownership independently of client claims.

## UX and dark mode
Owner rows alone receive a compact action button. The themed dialog names the Brand, enumerates retained durable objects, requires typing the exact name, disables all controls while pending, and keeps failures bounded and retryable. Success removes the confirmed row, clears a matching selection to No Brand, leaves the current Board open, refreshes from `/api/brands`, and announces success. The selector trigger and menu now use surface, hover, selected, border, text, focus, and disabled design tokens in both themes without changing stable IDs or responsive structure.

## Changed files and regression coverage
Changes are limited to the Brand item route, selector/dialog client markup and behavior, theme styles, English/German interface copy, one focused dependency-free regression, its package command and Runtime Boot Safety registration, and this record. The regression uses invented in-memory fixtures and exercises owner/non-owner, invalid ID, duplicate request, Board/node retention, association cleanup, rollback, other-row isolation, authoritative client success/failure behavior, selection fallback, preservation copy, and token-based light/dark styling. Existing create/select/change/canonical view checks and browser integrity remain the compatibility suite. Social Connections, Facebook/LinkedIn publishing and engagement, approvals, and Content Workspace code are unchanged.

## Deployment, acceptance, and rollback
Deploy the server route and static client assets together; no SQL or backfill is required. After deployment, verify light and dark selector states, delete only an intentionally disposable owned Brand, reload to confirm removal, and verify all formerly associated Boards and content remain accessible. Only after that separate validation should an operator consider deleting any real obsolete Brand. Rollback is the application commit: it removes the new endpoint/UI and restores prior styling. A successfully deleted Brand cannot be reconstructed by code rollback; database restoration would require an authorized backup procedure, while preserved Boards remain intact throughout.
