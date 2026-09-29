# BW-36.8 transactional Workspace backfill

## Accepted evidence and write set

The manually executed R3 production preflight was `ok`: zero blockers, quarantine, access expansion, and access loss. It found zero existing identities, Workspaces, memberships, and assignments. The accepted projection is exactly **6** active application identities, **5** default Workspaces, **5** accepted owners plus **1** accepted viewer, **6** Brand assignments, and **20** Board assignments (6 branded and 14 unbranded). It also records 11 unchanged Board shares, 1 unchanged Brand membership, 20 unchanged Campaign Brand Snapshots, and 1 unchanged public-token state.

## Mapping and boundaries

Canonical identities are `lower(btrim(email))`; only primary owners and Brand members qualify. Each of five primary owners gets one private active `My Workspace` (locale `en`, revision 1), created by that new identity, and an accepted owner membership. The Brand collaborator gets an accepted viewer membership only in the Brand owner's Workspace; `brand_members` remains the sole Brand permission. Owner wins on overlap. Board-only collaborators and anonymous public-token users get neither identity nor membership.

Brands map only to their existing owner's default Workspace. Explicitly branded Boards inherit that Brand Workspace; unbranded Boards map to their existing owner's Workspace. Snapshot-only Boards remain unbranded. The migration changes only `workspace_id` on Brands and Boards and does not advance revisions. It does not infer Brands or mutate owners, Brand members, Board shares, snapshots, public access, content, publication/provider data, or authorization.

## Transaction, refusal, replay, and validation

One explicit transaction takes a dedicated transaction advisory lock, then `SHARE ROW EXCLUSIVE` locks every source/target authority table. It revalidates schema/browser closure and live authority after locking, stages the complete mapping in transaction-local temporary tables, validates exact accepted counts before writes, performs the set writes, and validates durable counts, referential integrity, one-owner invariants, branded inheritance, and preservation fingerprints before commit. Any `bw36_8_*` exception rolls back everything; diagnostics are bounded codes without identifiers or payloads.

Changed counts, unsafe identities, normalized collisions, owner mismatches, missing Brands, schema drift, and any partial adoption refuse. An exact completed shape refuses safely as `bw36_8_already_applied`; other nonzero adoption refuses as `bw36_8_partial_adoption`. Nonzero adoption is never silently accepted.

The separate verification is a single read-only aggregate statement with nine categories. It exposes only category, check name, status, count, and static notes. It does not expose emails, UUIDs, names, tokens, content, snapshots, metadata, or mappings.

## Deployment and manual execution

1. Merge and deploy BW-36.8.
2. Confirm Runtime Boot Safety is fully green.
3. Open the correct Supabase project.
4. Open `migrations/20260929_bw36_8_transactional_workspace_backfill.sql`.
5. Copy the complete raw migration without modification.
6. Paste it into a new Supabase SQL Editor query.
7. Verify the target environment.
8. Execute the migration exactly once.
9. If any `bw36_8_*` error appears, do not edit around it; capture the complete error and stop.
10. If successful, open `scripts/sql/bw36-8-workspace-backfill-verification.sql`.
11. Copy the complete raw verification query without modification.
12. Execute it exactly once in a new SQL Editor query.
13. Capture the complete nine-category result.
14. Confirm the final `workspace_backfill_verification` row is `ok` with count `0`.
15. Smoke-test existing Google login, Brand access, Board access, Board sharing, public-token access, Canvas, Content Workspace, Auto-plan, and Export.
16. Do not create, rename, move, or delete Workspaces manually.
17. Do not activate Workspace UI or APIs.
18. Do not proceed to Workspace API/read-cutover until the verification result is reviewed.

## Rollback and recovery

Failure before commit automatically rolls back the entire write set. For refusal, preserve the error and environment evidence, investigate drift, and prepare a reviewed forward correction; never edit around guards. No blind destructive rollback is supplied. After commit, prefer disable-and-roll-forward and require an operator-reviewed recovery plan preserving access and snapshots. A manual reversal can be considered only before any later phase or user interaction adopts these rows, after verification that no Workspace has been created/renamed/moved/deleted, no membership has become authoritative, and assignments have not been consumed. Otherwise never delete identities/Workspaces, clear assignments, or remove memberships; restore backups only under an approved incident procedure.

## Non-goals and dependency

This change performs no UI/API activation, login change, authorization cutover, provider/AI call, publishing, remote SQL, or production credential use. Successful verification authorizes only planning the later Workspace API/read-cutover phase; that separately reviewed phase remains required.
